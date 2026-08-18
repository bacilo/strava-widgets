---
phase: 20-row-click-interaction-pattern
reviewed: 2026-08-18T08:40:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/dashboard/row-navigation.test.ts
  - src/dashboard/row-navigation.ts
  - src/dashboard/row-semantics.test.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/list.test.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/overview.test.ts
  - src/dashboard/views/overview.ts
  - src/dashboard/views/records.ts
findings:
  critical: 1
  warning: 9
  info: 5
  total: 15
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-18T08:40:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Full re-review from current `HEAD` (`b7e806d`). The previous round's CR-01 (identical
`aria-label` on every Records cell anchor) is confirmed fixed — `buildCellLink` no longer
receives a label at any of its seven call sites, and `cellLinkLabelViolations` is a real,
self-tested guard for it. All 233 tests across the five reviewed test files pass.

The two developer-accepted behaviours named in the review brief — the hand-built Date-cell
anchors not going through `buildCellLink`, and a double-click's first click still navigating —
are **not** reported as defects below. They are referenced only where a *different* defect
attaches to the same code (WR-03, WR-06), and are explicitly marked accepted there.

What this round did find, in order of weight:

1. **A live data-correctness bug in the progression table** (CR-01). The Improvement cell
   hard-codes a minus sign over `Math.abs()`, so a step the model explicitly supports and
   unit-tests — a *slower* time — is rendered as an improvement.
2. **Three test guards that are false-green, each proved by executed mutation, not by
   reading** (WR-01, WR-02, WR-08). The brief asked specifically whether the guards in
   `row-semantics.test.ts` and `styles.test.ts` fail on the mutations they claim to pin. Two
   of them do not. Worst of these is WR-02: `assertNoAtRuleOverride` — the helper that exists
   *solely* to close the at-rule blind spot the last round found — is itself blind to the
   first rule inside every at-rule block, and four of the seven `@media` blocks in
   `styles.css` contain exactly one rule, i.e. one that is wholly invisible to it.
3. **Two accessibility regressions introduced by D-17's label removal** (WR-04, WR-05) that
   the decision record does not account for: em-dash-only cells are now unlabelled links
   named `—`, and the low-confidence badge's `.sr-only` explanation is now folded into the
   Flags link's accessible name.
4. **Documentation known to be false left in the source** (WR-03). `20-CONTEXT.md` D-16
   point 6 correctly records that `MouseEvent.detail` is `1` on the first click of a
   double-click. `row-navigation.ts`'s header and four `row-navigation.test.ts` test names
   still assert the opposite, in the same "written so a later agent does not undo it"
   register the rest of the file uses.
5. **Duplication between the two Records table renderers** (WR-06), which is the mechanism
   by which the accepted Date-anchor scope gap exists in two independent places rather than
   one.

Security scan is clean: no `innerHTML`/`outerHTML`/`insertAdjacentHTML` (guarded), no `eval`,
no `location.hash` assignment (guarded), every athlete-authored string reaches the DOM via
`textContent`, and every `href` is built by `activityDetailHref`, which is unconditionally
`#`-prefixed and therefore cannot carry a `javascript:` scheme. No debug artifacts, no
`TODO`/`FIXME`, no empty catch blocks.

## Structural Findings (fallow)

No structural pre-pass was supplied for this round; no `<structural_findings>` block was
present in the invocation. The unused-export and duplicate-block observations below (WR-07,
IN-01) were derived by direct grep and are flagged as narrative findings.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Progression table renders a slower step as an improvement (sign inversion)

**File:** `src/dashboard/views/records.ts:650-651`

**Issue:** The Improvement cell prints a hard-coded U+2212 minus sign in front of
`Math.abs(row.improvementSec)`:

```ts
improvementLink.textContent =
  row.improvementSec === null ? '—' : `−${formatEffortDuration(Math.abs(row.improvementSec))}`;
```

`improvementSec` is `point.y - previous.y` (`records-logic.ts:208`) and its own contract
states the sign is meaningful — `records-logic.ts:192`: *"`durationSec -
previousDurationSec`; negative means faster (an improvement)"*. A **positive** value is not a
theoretical shape: `records-logic.test.ts:275-282` is a dedicated test named *"a non-improving
step yields a positive value rather than throwing"* asserting `improvementSec === 50`.

`Math.abs()` discards that sign and the template re-adds the wrong one, so a step that was
50 seconds **slower** renders as `−0:50` — indistinguishable from a 50-second PR improvement.
`improvementSec === 0` renders `−0:00`. In a repository whose stated discipline is data
honesty (`T-18-HONEST-05`, the low-confidence and exclusion badges), silently inverting the
sign of a displayed delta is the strongest class of defect on this page.

This line is in scope: it was modified by this phase in `d433bcd` (20-17) and again in
`2e54d73` (20-19).

**Fix:** Derive the sign from the value instead of asserting it:

```ts
improvementLink.textContent =
  row.improvementSec === null
    ? '—'
    : `${row.improvementSec <= 0 ? '−' : '+'}${formatEffortDuration(Math.abs(row.improvementSec))}`;
```

Add a `records-logic`-fixture-driven assertion (or a source-shape guard in
`row-semantics.test.ts`) that a positive `improvementSec` does not render with a leading `−`,
so the inversion cannot come back.

## Warnings

### WR-01: The "only inside a conditional" guard on `flagsTd.appendChild` is false-green

**File:** `src/dashboard/row-semantics.test.ts:607-621`

**Issue:** The test claims to prove that the Flags anchor is appended only under a condition
("An unconditional append would put an empty labelled anchor in every flag-less row"). Its
mechanism is:

```ts
const between = recordsStripped.slice(declIndex, appendIndex);
expect(between, 'the append must be guarded by an if ( - see comment above').toContain('if (');
```

`declIndex` is the offset of the *declaration* `const flagsAnchor = …` (`records.ts:511`) and
`appendIndex` is the offset of the append (`records.ts:527`). Between them sit two unrelated
statements — `if (row.lowConfidence)` at `:513` and `if (row.excluded && …)` at `:517` — so
`between` contains `if (` no matter what happens to the actual `if (hasFlagBadge)` guard.

Proved by executed mutation (deleting the `if (hasFlagBadge) { … }` wrapper and leaving
`flagsTd.appendChild(flagsAnchor);` unconditional):

```
ORIGINAL                    | count===1: true | between contains "if (": true => GUARD PASSES: true
MUT-A unconditional append  | count===1: true | between contains "if (": true => GUARD PASSES: true
```

The guard cannot see the regression it was written for.

**Fix:** Anchor the check to the guard variable rather than to "some `if (` somewhere":

```ts
const guarded = /if\s*\(\s*hasFlagBadge\s*\)\s*\{\s*flagsTd\.appendChild\(flagsAnchor\);\s*\}/;
expect(
  guarded.test(recordsStripped),
  'the flags anchor must be appended only under the hasFlagBadge guard - an unconditional append ' +
    'puts an empty link in every flag-less row',
).toBe(true);
```

and add a self-test pair (guarded shape passes, unconditional shape fails) mirroring the
blind-spot-proof convention already used elsewhere in this file.

### WR-02: `assertNoAtRuleOverride` is blind to the first rule inside every at-rule block

**File:** `src/dashboard/styles.test.ts:470-497` (helper), used at `:1430, 1437, 1459, 1471, 1512, 1517, 1524, 1599, 1606, 1616`

**Issue:** `assertNoAtRuleOverride` is the companion added by plan 20-14 specifically to close
the blind spot that `cascadeWinningBodyDeclaring` / `bodyForSelectorListToken` /
`bodiesForSelectorListToken` have by construction. Its JSDoc claims it "throws when any such
body declares `property`". It does not.

It walks `RULE_SCANNER()` — `/([^{}]+)\{([^}]*)\}/g` — whose body class permits an unmatched
`{`. Against an `@media` block, that regex consumes the `@media (…)` prelude as a rule *head*
and swallows the **first nested rule** into that pseudo-rule's body. That first rule's
selector therefore never becomes a top-level selector token, so
`splitTopLevelSelectors(head).some(s => s === needle)` can never match it.

The file *knows* this — `styles.test.ts:1550-1558` deliberately inserts a leading
`.placeholder` rule into both synthetic `@media` blocks so the override becomes reachable —
but that workaround is only in the *proof*; nothing tells the reader the helper is inert
against a differently-ordered real block, and the helper's own JSDoc still claims complete
coverage.

Executed proof (same override, different position in the block):

```
override is FIRST rule in @media  => assertNoAtRuleOverride threw: false | cascade winner: "cursor: pointer;"
override is SECOND rule in @media => assertNoAtRuleOverride threw: true  | cascade winner: "cursor: pointer;"
```

This is not hypothetical for `styles.css`. Enumerating the real file's at-rule blocks:

```
@media (max-width: 640px)   | rules: 4 | first (invisible): .app-nav__links
@media (max-width: 720px)   | rules: 3 | first (invisible): .activity-table-wrapper
@media (min-width: 721px)   | rules: 1 | first (invisible): .route-map__canvas
@media (max-width: 380px)   | rules: 1 | first (invisible): .chart-band__canvas-wrap
@media (min-width: 640px)   | rules: 1 | first (invisible): .pr-evolution-grid
@media (min-width: 1000px)  | rules: 1 | first (invisible): .pr-evolution-grid
@media (max-width: 380px)   | rules: 1 | first (invisible): .pr-evolution-card__canvas-wrap
```

Four of the seven blocks contain exactly one rule, so that rule is *entirely* invisible to
every rule-scanning helper in this file. Adding
`@media (max-width: 720px) { .activity-table__row--navigable { cursor: default; } }` as a new
single-rule block would kill D-10's pointer cursor on mobile with all ten paired assertions
still green.

**Fix:** Stop deriving nested rules from `RULE_SCANNER()`. `computeAtRuleRanges` already
brace-matches each block's `[start, end)`; scan the block *body* independently:

```ts
function atRuleNestedRules(source: string): Array<{ head: string; body: string }> {
  const out: Array<{ head: string; body: string }> = [];
  for (const [start, end] of computeAtRuleRanges(source)) {
    const inner = source.slice(source.indexOf('{', start) + 1, end - 1);
    for (const m of inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      out.push({ head: m[1], body: m[2] });
    }
  }
  return out;
}
```

then drive `assertNoAtRuleOverride` off that list. Add a blind-spot proof with the override as
the **first** rule of a single-rule `@media` block (i.e. drop the `.placeholder` scaffolding),
which is the case the current suite cannot express.

### WR-03: `row-navigation.ts` and four test names still assert a browser model the phase already knows is false

**File:** `src/dashboard/row-navigation.ts:47-56, 118-120`; `src/dashboard/row-navigation.test.ts:140-144, 158-172`

**Issue:** *(The behaviour is developer-accepted — see the brief's item 2 and `20-CONTEXT.md`
D-16 point 6. What is reported here is the documentation, not the behaviour.)*

`20-CONTEXT.md` D-16 point 6 states the correction plainly: *"`MouseEvent.detail` is `1` on the
first click of a double-click (`2` only from the second) … D-14's `clickCount > 1` refusal can
only ever refuse the second click — at both call sites."*

The reviewed source was not updated to match, and it is written in the imperative
"do-not-undo-this" register that future agents are instructed to trust:

- `row-navigation.ts:47-49`: *"the row-click listener refuses navigation on the first click of
  a double-click, closing `20-REVIEW.md`'s WR-05"* — it does not; WR-05 is open.
- `row-navigation.ts:118-120`: *"`clickCount > 1` (D-14) — the first click of a double-click is
  a select gesture … the browser fires the first `click` before the word selection exists"* —
  conflates `detail: 2` with "the first click".
- `row-navigation.test.ts:140`: test titled *"the first click of a double-click (clickCount: 2)
  … must not navigate (D-14, WR-05)"* — `clickCount: 2` is the **second** click.
- `row-navigation.test.ts:158-172`: the comment block and the test title *"WR-05 blind spot:
  clickCount: 2 with hasTextSelection: false (the actual first-click state)"* assert the false
  state explicitly and instruct the reader **not** to delete the case as redundant.

Secondary consequence worth recording: because the first click navigates and tears the view
down, the `clickCount > 1` branch at `row-navigation.ts:136-138` is effectively unreachable on
the row path in practice, and on the `buildCellLink` path it can only fire on a second click
that arrives after the browser has already followed the `href`. The guard is close to dead
code, which the current comments actively conceal.

**Fix:** Rewrite the four sites to describe what the guard does — refuse the *second and
subsequent* clicks of a repeat-click sequence — and carry D-16 point 6's residual sentence
into `row-navigation.ts`'s header so the residual is visible where the code lives, e.g.:

```
 * D-14, corrected: `clickCount > 1` refuses the SECOND and subsequent clicks of a
 * repeat-click sequence. It cannot refuse the first: `MouseEvent.detail` is 1 at that
 * moment, indistinguishable from a single click. WR-05 is therefore NOT closed — see
 * D-16 point 6 in 20-CONTEXT.md, accepted by the developer in the Round 5 checkpoint.
```

Rename the two misleading `it(...)` titles accordingly.

### WR-04: Em-dash placeholder cells are now anchors, producing links whose accessible name is "—"

**File:** `src/dashboard/views/records.ts:496-499`, `src/dashboard/views/records.ts:649-651`

**Issue:** D-13 wrapped every content-carrying cell in a `buildCellLink` anchor; D-17 then
removed the `aria-label` from those anchors so each falls through to name-from-content. For
cells whose content is the em-dash placeholder, the resulting accessible name is literally
`—`:

```ts
const ageLink = buildCellLink(row.activityId);
ageLink.textContent =
  row.agePercent !== null ? `${row.agePercent.toFixed(1)}%${row.ageDerived ? '*' : ''}` : '—';
```

This is not an edge case. `buildConfigNotice` (`records.ts:314-322`) renders the
"Age-grading is off" notice whenever `ageGrading?.enabled` is falsy, which is the default
state of this repository (no `birthDate`/`sex` in `data/private/athlete-private.json`). In
that state **every row of all seven PR tables** contributes a link named `—`. The progression
table adds one more per table (`records.ts:651`, the first row's `null` improvement).

D-17's rationale — *"each cell's own visible text is already its correct accessible name"* —
holds for Rank/Time/Pace/Flags. It does not hold for a placeholder glyph, and the decision
record does not carve this case out. WCAG 2.4.4 (Link Purpose, In Context) is arguable via
table context, but a screen-reader link list on this page will be dominated by identical
`—` entries.

**Fix:** Do not anchor a placeholder. Keep the `<td>`'s plain text when the value is absent:

```ts
const ageTd = document.createElement('td');
ageTd.className = 'pr-table__numeric';
if (row.agePercent !== null) {
  const ageLink = buildCellLink(row.activityId);
  ageLink.textContent = `${row.agePercent.toFixed(1)}%${row.ageDerived ? '*' : ''}`;
  ageTd.appendChild(ageLink);
} else {
  ageTd.textContent = '—';
}
```

The row-level `attachRowNavigation` listener still covers the cell for mouse clicks, so no
affordance is lost. Apply the same shape to the Improvement cell. Note this changes the
`buildCellLink(row.activityId)` count pinned at `row-semantics.test.ts:760` (7) — update that
count and D-13's note in `20-CONTEXT.md` together, as that test instructs.

### WR-05: The low-confidence `.sr-only` explanation is now folded into the Flags link's accessible name

**File:** `src/dashboard/views/records.ts:513-528`; `src/dashboard/views/list.ts:185-201`

**Issue:** `appendLowConfidenceBadge(container, idPrefix)` appends **two** children: the
visible `.badge` span and a sibling `.sr-only` span carrying the full explanation
(`list.ts:196-200`). D-13 changed the `container` for the Records Flags cell from the plain
`flagsTd` to `flagsAnchor` (`records.ts:514`).

`.sr-only` is clip-based (`styles.css:1113-1123` — `clip-path: inset(50%)`, not
`display: none`), so it participates in accessible-name-from-content. The Flags cell link's
accessible name is therefore:

> "Low confidence GPS-reconstructed distance; treat this time with caution"

and, for an excluded row, with `Excluded — <reason>` appended.

`records.ts:521-525` states the opposite as settled fact:

> *"the badge text written into it by `appendLowConfidenceBadge` / `appendBadge` above is
> precisely what a screen reader announces for this cell (D-17 point 2)"*

That claim omits the description span. The `aria-describedby` on the badge
(`list.ts:193`) now points at an element inside the very link whose name already contains that
text, so the explanation is both duplicated and mis-scoped.

**Fix:** Exclude the description span from the link's name, e.g. append the badge into the
anchor but keep the description as a sibling of the anchor inside the `<td>`. That needs a
small split of `appendLowConfidenceBadge` (a `badgeContainer` / `descriptionContainer` pair),
or an `aria-hidden`-free equivalent such as moving the whole low-confidence badge back out of
the anchor. Whichever route, correct the claim at `records.ts:521-525` and D-17 point 2 — the
current text asserts a rendered outcome that does not hold, which is the exact failure class
`20-VALIDATION.md` exists to catch.

### WR-06: The two Records table renderers duplicate the Date-anchor block and the curated-label template verbatim

**File:** `src/dashboard/views/records.ts:471` + `:502-507`; `src/dashboard/views/records.ts:632` + `:634-639`

**Issue:** `buildPrTable` and `buildProgressionTable` each carry a byte-identical copy of:

```ts
const curatedLabel = `${formatActivityDate(row.startDate)}, ${DISTANCE_LABELS[distance]}, ${formatEffortDuration(row.durationSec)}`;
```

and a byte-identical six-line Date-anchor construction:

```ts
const dateTd = document.createElement('td');
const dateAnchor = document.createElement('a');
dateAnchor.href = activityDetailHref(row.activityId);
dateAnchor.textContent = formatActivityDate(row.startDate);
dateAnchor.setAttribute('aria-label', curatedLabel);
dateTd.appendChild(dateAnchor);
```

This duplication is load-bearing, not cosmetic. It is precisely *why* the accepted D-16 scope
boundary (Date anchors lack `draggable = false` and the `shouldNavigateOnRowClick` guard)
exists in two independent places instead of one — closing it later requires two edits, and a
partial fix would leave the two tables behaving differently on the same gesture with no test
able to see the divergence. `row-semantics.test.ts` pins the *counts* (`curatedLabel` × 4,
`dateAnchor.setAttribute('aria-label', curatedLabel)` × 2), which locks the duplication in
rather than flagging it.

*(The absence of the D-16 treatment on these anchors is developer-accepted and is not being
reported. The duplication is.)*

**Fix:** Extract a single `buildDateCell(activityId, startDate, curatedLabel)` alongside
`buildCellLink`, used by both renderers, and hoist `curatedLabel` into a
`curatedRowLabel(distance, startDate, durationSec)` helper. Update the pinned counts in
`row-semantics.test.ts:768-770` and `:596-601` in the same change. This also makes any future
decision to give the Date anchors the D-16 contract a one-line edit.

### WR-07: `stripComments` is triplicated verbatim, and `row-semantics.test.ts` exports it to nobody

**File:** `src/dashboard/row-semantics.test.ts:68-71`, `src/dashboard/row-navigation.test.ts:201-204`, `src/dashboard/views/list.test.ts:514-517`

**Issue:** The identical two-line implementation (non-greedy block strip, then `(?<!:)//` to
end of line) exists three times. `row-semantics.test.ts:68` marks its copy `export function`
and `:216` exports `cellLinkLabelViolations`; grep confirms **neither export is imported
anywhere** — the export keywords are inert.

Three copies of a comment stripper is a correctness risk, not just noise: every source-shape
assertion in three files depends on all three stripping identically, and the copies already
carry different JSDoc claims about why. `list.test.ts:508-512` acknowledges this as a "knowing
third copy" deferred under `deferred-items.md ## Plan 20-12`; the deferral has now survived
eight further plans while a fourth consumer's worth of assertions was added on top.

**Fix:** Move `stripComments` (and `countOccurrences`) into
`src/dashboard/test-utils/source-text.ts` and import it in all three files; drop the unused
`export` on `cellLinkLabelViolations` or move it into the same module if it is meant to be
shared. Keep the existing self-tests, but in one place.

### WR-08: `rowSemanticViolations` misses every non-identifier receiver and every non-literal spelling

**File:** `src/dashboard/row-semantics.test.ts:155-200`

**Issue:** All four patterns require the receiver to be a bare identifier immediately preceding
the `.` (`([A-Za-z_$][\w$]*)\s*\.\s*…`). Executed probe of the shipped predicate:

```
 1 | baseline caught                    | "tr.tabIndex = 0;"
 0 | member-expression receiver         | "tbody.rows[0].tabIndex = 0;"
 0 | member-expression role             | "tbody.children[0].setAttribute('role', 'link');"
 0 | Object.assign                      | "Object.assign(tr, { tabIndex: 0, role: 'link' });"
 0 | attr name via constant             | "tr.setAttribute(ATTR_ROLE, 'link');"
 0 | aria reflection prop               | "tr.ariaRoleDescription = 'link';"
 0 | allowlisted name aliasing a <tr>   | "const heading = tr; heading.tabIndex = -1;"
 0 | allowlisted name aliasing a <tr>   | "const cellAnchor = tr; cellAnchor.tabIndex = -1;"
```

Seven of the eight D-01-violating shapes pass undetected. The file's own JSDoc
(`:107-153`) claims the scan is "spelling-agnostic … in ANY spelling this codebase uses" and
enumerates exactly four; the receiver restriction that makes the other shapes invisible is not
stated anywhere. The last two rows are the more serious class: the allowlist is keyed on
*variable name*, so any `<tr>` assigned to a variable named `heading`/`h1`/`cellAnchor` is
waved through — the guard checks naming convention, not element identity.

**Fix:** Widen the receiver group to a member expression and accept a non-literal
`setAttribute` name, reporting the latter as a violation rather than skipping it:

```ts
const RECEIVER = String.raw`([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[[^\]]*\])*)`;
const tabIndexPropertyPattern = new RegExp(`${RECEIVER}\\s*\\.\\s*tabIndex\\s*=(?!=)\\s*([^;]*);`, 'gi');
const tabIndexAttrPattern = new RegExp(
  `${RECEIVER}\\s*\\.\\s*setAttribute\\s*\\(\\s*(?:['"]tabindex['"]|[A-Za-z_$][\\w$]*)\\s*,\\s*([^)]*)\\)`, 'gi');
```

and add a `writes the guarded property via Object.assign` scan
(`/Object\.assign\([^)]*\b(?:tabIndex|role)\s*:/g`). Add the seven probe cases above as
self-tests so the closure is proved, matching the WR-01/WR-02 blind-spot-proof convention this
file already uses everywhere else.

### WR-09: `buildCellLink`'s `ariaLabel` parameter is dead, and a test pins the dead branch in place

**File:** `src/dashboard/views/records.ts:392, 396-398`; `src/dashboard/row-semantics.test.ts:759-763`

**Issue:** After D-17, no call site passes a second argument — `row-semantics.test.ts:752-757`
asserts exactly that (`cellLinkLabelViolations(recordsStripped)` is empty), and `:760` pins
`buildCellLink(row.activityId)` at 7 occurrences, i.e. all of them. The `if (ariaLabel)` branch
at `records.ts:396-398` is therefore unreachable in production.

That alone would be a defensible "retained seam". What makes it a finding is
`row-semantics.test.ts:759-763`, which *requires* the dead code to exist:

```ts
expect(recordsStripped).toContain('ariaLabel?: string');
expect(recordsStripped).toContain('if (ariaLabel)');
```

Removing the dead parameter now turns the suite red, and the assertion offers no reason why
the parameter must survive — it is dead code enforced by a test.

**Fix:** Either delete the parameter and the branch (and the two assertions above), or, if the
seam is genuinely wanted, replace those two assertions with the invariant that actually
matters — that no call site supplies a label — which `cellLinkLabelViolations` already proves
one assertion earlier. Keeping both is redundant; keeping only the `toContain` pair is
backwards.

## Info

### IN-01: `flagsAnchor` is built (element + click listener) for every row, then discarded when the row has no flags

**File:** `src/dashboard/views/records.ts:511-528`

**Issue:** `const flagsAnchor = buildCellLink(row.activityId);` runs before `hasFlagBadge` is
known, so every flag-less row allocates an `<a>`, sets four properties and registers a `click`
listener on an element that is never attached. Harmless (the node is unreachable and
collectable) but it reads as if the anchor is always used, which is exactly the confusion
WR-01's guard was supposed to prevent.

**Fix:** Compute the badge texts first and build the anchor only when at least one applies, or
inline the construction inside the `if (hasFlagBadge)` block after collecting the badges into
a fragment.

### IN-02: Stale JSDoc — `noteViewedActivity` is described as called by "a future plan"

**File:** `src/dashboard/views/list.ts:1057-1062`

**Issue:** *"Called by `detail.ts` on mount (a future plan)"*. `detail.ts:665` already calls it
and `detail.ts:37` already imports it.

**Fix:** Drop "(a future plan)" and cite `detail.ts:665`.

### IN-03: Redundant conjunction — `row.excluded` is derived from `row.exclusionReason`

**File:** `src/dashboard/views/records.ts:517`

**Issue:** `if (row.excluded && row.exclusionReason)`. `buildPrTableRows` sets
`excluded: exclusionReason !== null` (`records-logic.ts:132`), so `excluded` can never be true
with a null reason. The conjunction implies an independence that does not exist.

**Fix:** `if (row.exclusionReason)` — or keep the pair and add a comment saying it is defensive
against a future decoupling of the two fields.

### IN-04: Inconsistent focus-target spelling across the three views

**File:** `src/dashboard/views/overview.ts:283` vs `src/dashboard/views/list.ts:1303`, `src/dashboard/views/records.ts:253, 577, 725, 802, 920`

**Issue:** `overview.ts` writes `heading.setAttribute('tabindex', '-1')`; `list.ts` and
`records.ts` write `heading.tabIndex = -1`. `rowSemanticViolations` allowlists both spellings,
so nothing is broken — but the divergence is the reason the allowlist needs two rules instead
of one, and it is the same camelCase-vs-attribute split that made the previous guard vacuous
(WR-02 of the earlier round).

**Fix:** Standardise on `heading.tabIndex = -1` and drop the `setAttribute` arm of the
allowlist once no call site needs it.

### IN-05: `atRuleRangesCache` is an unbounded `Map` keyed by whole source strings

**File:** `src/dashboard/styles.test.ts:186-205`

**Issue:** Every distinct `source` string passed to a helper — including each of the ~10
synthetic CSS strings in the self-tests — is retained as a `Map` key for the process lifetime,
holding the full text plus its computed ranges. Trivial at this scale, but the JSDoc's
justification ("most calls reuse the default `cssNoComments` instance") no longer matches the
file, which now passes synthetic sources at ten call sites.

**Fix:** Either drop the memoisation (the brace walk is linear and the file is 1.6 kLOC) or
bound the cache to the default source only.

---

_Reviewed: 2026-08-18T08:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
