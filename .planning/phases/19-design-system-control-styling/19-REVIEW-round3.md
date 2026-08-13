---
phase: 19-design-system-control-styling
reviewed: 2026-08-13T09:27:52Z
depth: standard
diff_base: 3fff321ae851eaf412a752e76d3971113c8ab238
scope: phase 19 waves 10-12 only (waves 01-09 reviewed in 19-REVIEW.md)
files_reviewed: 2
files_reviewed_list:
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
findings:
  critical: 2
  warning: 4
  info: 5
  total: 11
status: issues_found
---

# Phase 19 (waves 10-12): Code Review Report — Round 3

**Reviewed:** 2026-08-13T09:27:52Z
**Depth:** standard
**Diff range:** `3fff321..HEAD` — `src/dashboard/styles.css`, `src/dashboard/styles.test.ts`
**Files Reviewed:** 2
**Status:** issues_found

## Summary

The four CSS edits in this range (`.app-nav { z-index: 20 }`, `.splits-table__km` `1`→`2`,
`.segmented__option { border-radius: 0 }`, `:disabled:focus-visible / [aria-disabled="true"]:focus-visible
{ opacity: 1 }`) are each individually well-formed, cascade correctly on inspection, and — for CR-02 and
CR-03 — were independently confirmed on rendered evidence by Round 3 Probes A and C. **I found no defect
in the shipped CSS declarations themselves.**

Every finding below is in the *guard layer* — the test assertions and the in-source comments that this
phase is relying on to prevent the next false green. That is deliberate: this phase's gate is open
precisely because of false-green mechanisms, and waves 10-12 shipped three new guards
(`assertNotAtRuleHead`, the four-rung ladder assertion, the widened eight-token hover assertion) that
were sold as closing holes. **Two of the three do not close what they claim to close, and I proved that
by mutation rather than by reading.** Every mutation result quoted below was executed against a copy of
the real stylesheet with the real helper implementations; none of it is inferred.

**Verification stance, per this round's critical context.** Findings R3-CR-01, R3-CR-02, R3-WR-01 and
R3-WR-02 are *executed* — I reimplemented the helpers verbatim, mutated the stylesheet text, and observed
the assertions stay green. Finding R3-WR-03 is **inferred from CSS source + spec only**, not verified in a
browser, and is marked as such in its body. Finding R3-WR-04 rests on the phase's own recorded Round 3
probe output, not on a new rendering claim of mine. GAP 7 (the nav not sticking at all) is **not**
re-reported here.

Baseline confirmed before mutating: `npx vitest run src/dashboard/styles.test.ts` → 52 passed.

---

## Critical Issues

### R3-CR-01: `assertNotAtRuleHead` does not close the `@media`-swallowed-match hole, and the helper audit now documents a guarantee that is false

**File:** `src/dashboard/styles.test.ts:123-132` (the guard), `:152` and `:193` (call sites),
`:349-360` and `:368-384` (the audit comment that claims the hole is closed)

**Issue:**
The guard only fires when a resolved match's head *begins with* `@` — i.e. only for the at-rule prelude
pseudo-rule itself. That is one of two ways the generic `/([^{}]+)\{([^}]*)\}/g` scanner mis-handles an
`@media` block, and it is the *unreachable* one. The other way — every nested rule after the first, which
the scanner emits as an ordinary-looking head with a correct-looking body — is completely unguarded.

Executed against the real stylesheet with the real helper bodies:

```
rules resolved by the generic regex that live INSIDE an @media but do NOT look like at-rules:
  '.app-nav__toggle'
  '.app-nav[data-open="true"] .app-nav__links'
  '.app-nav[data-open="true"] .app-nav__link'
  '.activity-list--cards'
  '.sort-select'

media-nested-only selectors (no top-level counterpart) -> helper silently returns the @media body:
  '.app-nav[data-open="true"] .app-nav__links'
  '.app-nav[data-open="true"] .app-nav__link'

bodyForSelectorListToken('.app-nav[data-open="true"] .app-nav__links')
  -> RESOLVED (no throw). body = "display: flex;\n    flex-direction: column;"
```

So `bodyForSelectorListToken` does exactly what the audit comment says it can no longer do: silently
return the body of a rule that lives inside a block the helper "cannot see", with no error.

Reachability of the guard from any realistic needle, executed:

```
'@media (max-width: 640px)' -> AT-RULE GUARD FIRED
'.app-nav'                  -> resolved, guard not fired
'.splits-table__km'         -> resolved, guard not fired
':focus-visible'            -> resolved, guard not fired
'.segmented__option'        -> resolved, guard not fired
':disabled:focus-visible'   -> resolved, guard not fired
```

For `bodyForSelectorListToken` the guard is effectively **dead code**: it requires
`splitTopLevelSelectors(head)` to contain the needle as an exact post-trim token, and the only token an
at-rule prelude produces is the literal string `@media (max-width: 640px)`. No caller will ever pass that.
It is weakly reachable in `ruleWithHeadContaining` only (a needle that is a raw substring of a prelude,
e.g. `max-width`), which is not the case WR-02 named.

Why this is BLOCKER-tier rather than a nitpick: the file now *asserts in prose* that the hole is closed —
`"bodyForSelectorListToken: … guarded — throws rather than silently returning the wrong block's body"`
(`:352-353`) and `"assertNotAtRuleHead now makes the two single-match helpers … fail loudly … instead of
either silently matching the wrong block"` (`:376-379`). A future author extending this file will trust
that line and put a claim behind a helper that cannot honour it. Documented-but-false safety is the exact
GAP-1 mechanism this phase is open over.

**Fix:** Compute at-rule block ranges once by brace matching, then reject any match whose offset falls
inside one — this catches nested rules at every position, not just the first:

```ts
const AT_RULE_RANGES: Array<[number, number]> = (() => {
  const ranges: Array<[number, number]> = [];
  for (const m of cssNoComments.matchAll(/@[a-z-]+[^{]*\{/g)) {
    let i = m.index! + m[0].length;
    let depth = 1;
    while (depth > 0 && i < cssNoComments.length) {
      if (cssNoComments[i] === '{') depth++;
      else if (cssNoComments[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index!, i]);
  }
  return ranges;
})();

function assertNotAtRuleScoped(offset: number, head: string, needle: string): void {
  const trimmed = head.trim();
  if (trimmed.startsWith('@') || AT_RULE_RANGES.some(([a, b]) => offset > a && offset < b)) {
    throw new Error(
      `Match for "${needle}" resolves inside an at-rule block (head: "${trimmed}") — ` +
        'these helpers do not model at-rule nesting; assert on a top-level rule instead.',
    );
  }
}
```

Call it with `match.index` at both existing call sites, and correct `:349-360` / `:368-384` to state the
real coverage. If the fuller guard is out of scope for this round, the **minimum** acceptable change is to
downgrade the audit comment from "guarded" to an accurate statement of what is and is not caught — the
false guarantee is worse than the missing guard.

---

### R3-CR-02: the widened eight-token hover assertion survives deletion of `:hover` and of the `button` scope

**File:** `src/dashboard/styles.test.ts:457-468` (assertion), `src/dashboard/styles.css:1344-1355` (rule
under guard)

**Issue:**
This test was rewritten in this range specifically to become the authoritative guard for the shared hover
rule (WR-01 closure: "Now asserts all eight required exclusion tokens"). Its own comment enumerates one
limitation (head-vs-body indistinguishability). It omits two far larger ones: the assertion never checks
that the rule is still a `:hover` rule, and never checks that it is still scoped to `button`.

Executed mutations against the real stylesheet with the real helper:

```
baseline hover test passes: true
mutation "removed :hover"          applied: true | hover test still passes: true
mutation "removed button scope"    applied: true | hover test still passes: true
```

Mutation 1 changes `button:where(:not(…)):hover` to `button:where(:not(…))`, which applies the
surface-mix background to every non-excluded button **unconditionally**, permanently overriding
`.pagination__button`'s and `.filter-toggle`'s own backgrounds. Mutation 2 changes the `button` scope to
`*`, applying the hover mix to every element on the page. Both are severe, immediately visible
regressions in the exact rule this test names in its title, and both stay green.

The eight `.toContain()` checks only prove that eight strings appear somewhere in `head + body`. They
constrain the exclusion *list* and nothing else about the rule.

**Fix:** Assert the head's shape, not just its substrings. Parse the `:not()` argument out of the head and
compare it as a set, and pin the parts the current test cannot see:

```ts
it('the shared hover rule is button-scoped, hover-gated, and excludes all eight tokens', () => {
  const rule = ruleWithHeadContaining(':where(:not(');
  const head = rule.slice(0, rule.indexOf('{') === -1 ? rule.length : rule.indexOf('{'));
  const normalized = head.replace(/\s+/g, ' ').trim();

  expect(normalized.startsWith('button:where(:not(')).toBe(true);   // scope not widened
  expect(normalized.endsWith(')):hover')).toBe(true);               // still hover-gated

  const notArg = normalized.slice('button:where(:not('.length, normalized.lastIndexOf(')):hover'));
  expect(splitTopLevelSelectors(notArg)).toEqual([
    ':disabled',
    '[aria-disabled="true"]',
    '.pagination__button--current',
    '.segmented__option--active',
    '.calendar-day--tint-1',
    '.calendar-day--tint-2',
    '.calendar-day--tint-3',
    '.calendar-day--tint-4',
  ]);
  expect(rule).toContain('color-mix(in srgb, var(--surface) 92%, var(--text))');
});
```

This also retires the head-vs-body limitation the current comment documents, since the token set is now
extracted from the head only, and it reuses `splitTopLevelSelectors` (which already has self-tests).

---

## Warnings

### R3-WR-01: the four-rung ladder assertion survives deletion of `position: sticky` from both sticky rungs

**File:** `src/dashboard/styles.test.ts:669-689`; `src/dashboard/styles.css:194-204`, `:955-961`

**Issue:**
`z-index` has no effect on a `position: static` element. The ladder test reads only `z-index` values; no
assertion anywhere in the file pins `position: sticky` on `.app-nav`, `.records-jump` or
`.splits-table__km` (grep for `sticky`/`position:` in the test file returns only the `:focus-visible`
`position: relative` check at `:650` and prose in comments).

Executed:

```
mutation "deleted position: sticky from .app-nav and .splits-table__km"
  applied: true | ladder values still: {"a":20,"k":2} -> test still green
```

With that mutation the entire CR-01 fix is inert — the nav no longer sticks, the km column no longer
sticks, and all four `z-index` declarations stop participating in any positioned-element ordering — yet
the assertion whose title is "the sticky-layer ladder … holds numerically and in order" passes. The guard
is one-dimensional: it defends the number and not the precondition that makes the number mean anything.

Note this is a *different* regression from the one 19-10 watched fail: deleting `z-index: 20` does
correctly throw from `extractNumericDeclaration`. The gap is the positioning precondition, not the value.

**Fix:** Add the precondition to the same test, so the ladder cannot go inert silently:

```ts
expect(bodyForSelectorListToken('.app-nav')).toContain('position: sticky');
expect(declarationsFor('.records-jump')).toContain('position: sticky');
expect(bodyForSelectorListToken('.splits-table__km')).toContain('position: sticky');
expect(bodyForSelectorListToken(':focus-visible')).toContain('position: relative');
```

---

### R3-WR-02: `bodyForSelectorListToken` is first-rule-wins and `extractNumericDeclaration` is first-declaration-wins — both new assertions pass against a later declaration that actually wins the cascade

**File:** `src/dashboard/styles.test.ts:145-157` (helper), `:167-173` (helper), `:618-626` (CR-02 test),
`:669-689` (ladder test); audit comment `:349-353` omits this blind spot

**Issue:**
`bodyForSelectorListToken` returns the body of the **first** rule whose selector list contains the token,
and `extractNumericDeclaration` returns the **first** numeric match in that body. CSS resolves both by
last-wins. Every assertion built on these two helpers therefore reads a value that may not be the one the
browser uses. The helper audit at `:349-353` lists `bodyForSelectorListToken`'s blind spots and does not
mention either.

Executed, appending realistic later overrides to the end of the stylesheet:

```
appended: .app-nav { z-index: 0; }  .segmented__option { border-radius: var(--radius-control); }

ladder test reads .app-nav z-index = 20   (real cascade winner is 0)
CR-02 test fragments contain 'border-radius: 0' = true  (real cascade winner is 4px)
```

And within a single body:

```
.app-nav body declaring z-index twice (20 then 0) -> helper reports 20 (real cascade winner is 0)
```

The CR-02 case is the sharper one: `.segmented__option { border-radius: 0 }` is precisely a
*cancellation* whose whole value is that it wins over `button`'s `0,0,1` baseline. A later equal-specificity
redeclaration silently un-does it, and the test written to guard exactly that cancellation reports green.

**Fix:** Make both helpers last-wins, matching CSS. For the helper, collect all matching bodies and return
the last (or return them concatenated in source order); for the extractor, use `matchAll` and take the
final match:

```ts
function extractNumericDeclaration(body: string, property: string): number {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...body.matchAll(new RegExp(`(?:^|;|\\s)${escaped}\\s*:\\s*(-?\\d+)`, 'g'))];
  if (matches.length === 0) throw new Error(`No numeric ${property} declaration found in: ${body}`);
  return Number(matches[matches.length - 1][1]);
}
```

At minimum, add both blind spots to the helper-audit comment so the next author does not assume
cascade-accurate reads.

---

### R3-WR-03: the ladder is written and asserted as a global total order, but three of its four rungs create their own stacking contexts — the model does not describe a focused `.app-nav__link`

**File:** `src/dashboard/styles.css:159-193` (the ladder comment), `src/dashboard/styles.test.ts:669-689`

**INFERRED ONLY — not verified against a rendered page.** This is derived from the CSS source plus the
positioned-layout spec and from reading `src/dashboard/nav.ts:127-158`. I did **not** run a DOM probe. Per
this round's context requirement, here is what would have to be true of the DOM for the finding to be
real: (a) `.app-nav__link` elements are DOM descendants of the `.app-nav` element — this I *did* verify
in source (`nav.ts:127` `navEl.className = 'app-nav'` → `:146` `linksEl.className = 'app-nav__links'`
appended to it → `:154` `link.className = 'app-nav__link'` appended to that); and (b) `position: sticky`
establishes a stacking context unconditionally — spec-level, not verified here.

**Issue:**
`z-index` totally orders elements only within a shared stacking context. `.app-nav` (sticky, z-index 20),
`.records-jump` (sticky, z-index 10) and `.splits-table__km` (sticky, z-index 2) each establish one. Any
`:focus-visible` ring on a **descendant** of those three is contained inside that ancestor's context and
is not ordered against rung 4 at all — it paints above its own ancestor's background regardless of the
numbers.

That is not hypothetical: the nav links are the most commonly focused controls on the page, and
`.app-nav__link:focus-visible` (`styles.css:225`) sits inside `.app-nav`. The written ladder — "4 (top)
.app-nav … 1 (bottom) :focus-visible" — predicts the nav paints over its own focused link's ring. It does
not, because of containment. The same applies to any focusable cell added *inside* `.splits-table__km`,
which is one of the two futures the `.splits-table__km` comment (`:946-954`) says the `1`→`2` bump exists
to protect against — the bump does nothing for the descendant case and only helps the sibling-`<td>` case.

The comment is a "single, written, totally-ordered statement" of something that is not totally ordered,
and the test enshrines it as an invariant. The risk is not a rendering bug today; it is that the next
maintainer trusts the ladder as a paint-order model and mis-diagnoses (or "fixes") a stacking problem
using it — the same failure shape as the previous round's CR-01.

**Fix:** Scope the claim in `styles.css:159-193` to what it actually governs — sibling/cousin ordering
within the root stacking context between these four *specific* rules — and add one explicit sentence that
a `:focus-visible` ring on a descendant of a sticky rung is contained by that rung and is deliberately
outside the ladder. Correspondingly, narrow the `.splits-table__km` comment at `:946-954` to the
sibling-cell case it actually covers. No test change required.

---

### R3-WR-04: the new `.app-nav` ladder comment states as established fact a rendered behavior the phase's own Round 3 probe disproved

**File:** `src/dashboard/styles.css:169-177`

**Issue:**
The comment shipped in this range asserts, unhedged: *".app-nav is `position: sticky; top: 0` … and every
route scrolls its content underneath it"* and *"with no `z-index` here, a focused control scrolled under
the nav painted OVER the opaque global chrome on every route."* Both are statements about what the
rendered page does. `19-VALIDATION.md` § Gap-Closure Record, GAP 7, records Probe D returning
`navH: 77, parentH: 77` — zero travel distance — and row 18 as FAIL: the premise is not exercisable.

**I am not re-reporting GAP 7.** The nav-stickiness defect is recorded and a gap-closure round is being
planned. This finding is narrower and separate: the *source comment*, which is the artifact a maintainer
reads and which will long outlive the phase directory, presents a disproven runtime claim as settled
fact, with no hedge and no pointer to the probe that contradicts it. When GAP 7 is fixed the claim may
become true; until then the file is documenting something the project has measured to be false.

**Fix:** Hedge the two sentences and cross-reference the record, e.g. replace *"and every route scrolls
its content underneath it"* with *"and is intended to remain on screen while every route scrolls its
content underneath it — as of 2026-08-13 it does not; see 19-VALIDATION.md GAP 7. This z-index is
therefore correct but currently guards an unreachable state."* Re-visit and un-hedge once GAP 7 closes.

---

## Info

### R3-IN-01: `extractNumericDeclaration` interpolates `property` into a `RegExp` unescaped

**File:** `src/dashboard/styles.test.ts:168`
**Issue:** `new RegExp(`${property}:\\s*(-?\\d+)`)` — `declarationsFor` (`:41`) escapes its input for
exactly this reason; this helper does not. Benign for `'z-index'`, but inconsistent, and a future
`property` containing `-`, `(` or `.` (e.g. a custom property name, or `padding-inline`) would behave
differently than intended. It is also unanchored, so it can match a `z-index` occurring anywhere in the
body — including inside a nested rule swallowed by the generic scanner (see R3-CR-01).
**Fix:** Apply the same `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` escape and anchor the match to a
declaration boundary (see the snippet in R3-WR-02).

### R3-IN-02: the ladder test mixes two helpers with different blind-spot profiles, for no stated reason

**File:** `src/dashboard/styles.test.ts:670-679`
**Issue:** Three rungs use `bodyForSelectorListToken`; `.records-jump` alone uses `declarationsFor`. The
comment above explains why `:focus-visible` cannot use `declarationsFor`, but not why `.records-jump`
should. The two helpers have different failure modes (`declarationsFor` is not selector-boundary anchored;
`bodyForSelectorListToken` is first-rule-wins), so a reader cannot reason about the test uniformly.
**Fix:** Use `bodyForSelectorListToken` for all four rungs, or add one sentence explaining the split.

### R3-IN-03: duplicated scanner regex and duplicated fragment-splitting idiom

**File:** `src/dashboard/styles.test.ts:97`, `:146`, `:188` (regex); `:525-528`, `:620-623`, `:753-756`
(idiom)
**Issue:** The literal `/([^{}]+)\{([^}]*)\}/g` now appears in three helpers, and the
`body.split(';').map(trim).filter(Boolean)` fragment idiom appears in three tests — two of them added in
this range. Both are the shared substrate of the false-green class this phase keeps hitting; having three
copies means a future correction (e.g. the R3-CR-01 fix) has to land in three places or silently only
land in some.
**Fix:** Extract `const RULE_SCANNER = () => /([^{}]+)\{([^}]*)\}/g;` (fresh instance per call, since
`lastIndex` is stateful) and `function declarationFragments(body: string): string[]`, and route all
callers through them.

### R3-IN-04: the CR-02 test's second assertion is a verbatim duplicate of an existing assertion

**File:** `src/dashboard/styles.test.ts:625` duplicates `:438`
**Issue:** `expect(selectorListDeclares('button', 'border-radius: var(--radius-control)')).toBe(true)`
already exists in the `button declares the quiet baseline` test. The CR-02 comment justifies it ("a future
'fix' that deletes the baseline's radius instead must fail this test too"), which is reasonable intent,
but two independent tests will now fail for one cause and the reader must diff the failures to see they
are the same fact.
**Fix:** Keep it if the coupling is deliberate, but say so in one clause referencing `:438`; otherwise
drop it.

### R3-IN-05: review-round bookkeeping is accumulating in a production asset

**File:** `src/dashboard/styles.css:159-193`, `:882-910`, `:946-954`, `:1371-1379`, `:1387-1419`
**Issue:** This range added roughly 110 lines of comment prose to support 4 lines of CSS, and the new
prose references planning artifacts by name and line (`19-REVIEW.md`, `CR-01`/`CR-02`/`CR-03`,
`trends.ts:1110`, `calendar.ts:118-131`, `list.ts:526-528`). `index.html:55` links `styles.css` directly
and no build step processes it, so this ships to browsers verbatim. More consequentially for
maintainability: the hardcoded foreign line numbers rot the moment `trends.ts` or `calendar.ts` is edited,
and R3-WR-04 above is an instance of this prose already being wrong. Not flagging asset size (out of v1
scope) — flagging that the stylesheet is being used as a review log.
**Fix:** Keep the *rationale* (why `border-radius: 0`, why `opacity: 1` under focus) in the stylesheet;
move the review-round narrative and the cross-file line citations to the phase directory, and reference
them as `see 19-REVIEW.md CR-02` rather than restating them.

---

## Notes on what was checked and found sound

Recorded so a later reader can see the negative space, not to validate the work:

- `.segmented__option { border-radius: 0 }` — specificity chain confirmed: `0,1,0` beats `button`'s
  `0,0,1`, loses to `:first-child`/`:last-child` at `0,1,1`, order-independent. No conflict with
  `.segmented__option--active` (`0,1,0`, declares no radius). No other class-less-button site regresses.
- `:disabled:focus-visible, [aria-disabled="true"]:focus-visible { opacity: 1 }` — `0,2,0`, placed last,
  beats `:disabled, [aria-disabled="true"]` at `0,1,0`. The live case is real and confirmed in source:
  `calendar.ts:127-131` builds rest days as `<button>` with `aria-disabled="true"` and **no** `disabled`
  property, so they are focusable; `calendar.ts:112` builds outside-month cells with `btn.disabled = true`,
  so the `:disabled:focus-visible` arm is genuinely dead-but-symmetric exactly as the comment states.
- Comment hygiene: no stray `*/` introduced by the ~110 new comment lines
  (`expect(cssNoComments).not.toContain('*/')` passes), and `esbuild transformSync` reports zero warnings —
  the GAP 1 mechanism did not recur in this range.
- `splitTopLevelSelectors` depth handling is correct against every head this stylesheet produces,
  including the seven at-rule preludes (which contain parentheses but no depth-0 comma).

---

_Reviewed: 2026-08-13T09:27:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
