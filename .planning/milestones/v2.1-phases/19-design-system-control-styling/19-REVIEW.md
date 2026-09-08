---
phase: 19-design-system-control-styling
reviewed: 2026-08-13T03:55:04Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
findings:
  critical: 3
  warning: 3
  info: 3
  total: 9
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-13T03:55:04Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

This review covers the post-gap-closure state of `src/dashboard/styles.css` and
`src/dashboard/styles.test.ts` (plans 19-01..19-09). It **replaces** the earlier
19-REVIEW.md, whose three findings were re-verified as genuinely closed:

- WR-01 (`.segmented` literal radius) — closed correctly; `styles.css:834` now uses
  `var(--radius-control)` and `styles.test.ts:496` guards it.
- WR-02 (false "fills in what's unset" comment) — closed correctly; the comment at
  `styles.css:1222-1248` now names the three class-less `calendar.ts` buttons and I
  confirmed all three exist (`calendar.ts:75, 258, 266`) and that the four `trends.ts`
  candidates are indeed classed before append.
- WR-03 (comma-splitting helper) — closed correctly; `splitTopLevelSelectors`
  (`styles.test.ts:71-87`) is depth-aware and self-tested.

The specific hazard called out in the review brief — another comment whose prose
contains a literal `*/` — **does not exist**. I re-ran the stripping regex over the
file: zero stray `*/` and zero stray `/*` survive, and no comment body contains an
inner `/*` (which is the one input that would defeat the `styles.test.ts:614` guard).
That guard is sound against the file as it stands today.

What the gap-closure round did **not** catch is that two of its own fixes have
unaudited blast radius, and that the suite that certifies them has holes in exactly
the places it claims coverage:

1. The 19-07 `z-index: 1` promotion was audited downward (what the ring must beat) and
   upward only against `.records-jump`. It missed `.app-nav`, which is sticky with
   **no** `z-index` — so every focused control on every page now paints over the global
   sticky header (CR-01).
2. The 19-03 `button` baseline's `border-radius` reaches middle `.segmented__option`
   children, which the 19-04 comment explicitly claims are unaffected. Three shipped
   Trends controls have 3+ options (CR-02).
3. The 19-03 `opacity: 0.6` disabled treatment applies to the *same element* that
   carries the focus ring on calendar rest days, dropping the ring below the 3:1
   threshold the file's own comment precomputes (CR-03).

All 50 tests pass (`npx vitest run src/dashboard/styles.test.ts`). None of the three
critical findings is detectable by the current suite.

## Critical Issues

### CR-01: The focus ring's `z-index: 1` paints focused controls over the sticky app nav

**File:** `src/dashboard/styles.css:380-385` (with `src/dashboard/styles.css:159-168`)

**Issue:** `:focus-visible` now declares `position: relative; z-index: 1`. `.app-nav`
declares `position: sticky; top: 0` and **no `z-index`** — I grepped the entire
dashboard and there are exactly three `z-index` declarations in the codebase:
`:focus-visible` (1), `.splits-table__km` (1), `.records-jump` (10). `.app-nav` has
none.

A sticky element with `z-index: auto` does not create a stacking context; it paints in
CSS 2.1 Appendix E **step 8** (positioned descendants with `z-index: auto | 0`). A
focused element with `z-index: 1` paints in **step 9**. Step 9 is after step 8, so the
focused element — and its 4px ring — renders **on top of** the opaque
`background: var(--surface)` header instead of scrolling beneath it. `.view` declares
no `transform`/`opacity`/`z-index`, so there is no intervening stacking context to
contain it; both elements live in the root stacking context.

This is global (the nav renders on every route) and trivially reachable: Tab to any
control on a list/records/trends page and scroll it under the header. It is also
reachable *without* scrolling, because several views call `heading.focus()` on a
`tabindex="-1"` `<h1>` after keyboard navigation (`trends.ts:1212`, `detail.ts:662`,
`calendar.ts:92,320`, `overview.ts:255`, `records.ts:163`) — a keyboard-initiated
programmatic focus matches `:focus-visible` in Chrome/Firefox, and `records.ts:163`
focuses section headings that land directly under the sticky chrome.

The rule's own governing comment (`styles.css:371-377`) states the invariant it is
protecting: "staying strictly below `.records-jump`'s deliberate `z-index: 10` ... so
the sticky jump bar still paints above a focused control elsewhere on the page." The
same reasoning applies verbatim to `.app-nav` and was not applied. `styles.test.ts:523-532`
encodes the invariant for `.records-jump` only, so the suite reports green.

**Fix:** give the sticky header an explicit layer above the focus ring, and extend the
existing numeric ordering assertion to cover it.

```css
.app-nav {
  display: flex;
  /* ... */
  position: sticky;
  top: 0;
  /* Must sit above :focus-visible's z-index: 1 — a focused control elsewhere on
     the page is promoted to its own stacking context (see the focus-ring rule)
     and would otherwise paint over this opaque sticky header. */
  z-index: 20;
}
```

```ts
it('.app-nav paints above a focused control (strictly greater z-index)', () => {
  const focusRingZIndex = extractNumericDeclaration(
    bodyForSelectorListToken(':focus-visible'),
    'z-index',
  );
  const appNavZIndex = extractNumericDeclaration(declarationsFor('.app-nav'), 'z-index');
  expect(appNavZIndex).toBeGreaterThan(focusRingZIndex);
});
```

Note the same latent conflict exists between `:focus-visible`'s `z-index: 1` and
`.splits-table__km`'s `z-index: 1` (`styles.css:885-891`) — equal z-index resolves by
tree order, so a focusable cell added later in a splits row would paint over the sticky
km column. `.splits-scroll`'s comment (`styles.css:868-870`) explicitly anticipates
future focusables there, so this should be resolved in the same edit.

---

### CR-02: The `button` baseline rounds the middle options of every 3+-option segmented control

**File:** `src/dashboard/styles.css:1249-1254` (interacting with `src/dashboard/styles.css:831-856`)

**Issue:** `button { border-radius: var(--radius-control) }` is `0,0,1` and applies to
every `.segmented__option`, which declares no `border-radius` of its own
(`styles.css:837-843`). Only the two end-child rules at `0,1,1`
(`styles.css:850-856`) override it. **Every middle option therefore gets 4px on all
four corners.** Because plan 19-04 removed `overflow: hidden` from `.segmented`, there
is no longer any clipping to square them off, and `.segmented` declares no background —
so the page background shows through a 4px notch at every internal join.

The governing comment at `styles.css:845-849` asserts the opposite: "these two end-child
rules reproduce the previous rounded silhouette without clipping anything." That claim
holds only for exactly two options. Three shipped controls have more:

- `trends.ts:1110` — `role="tablist"` with `className = 'segmented'` over
  `TREND_TAB_KEYS` = 5 keys (`trends-logic.ts:20-26`) → **3 middle options**
- `trends.ts:867` — window group over `TRAINING_LOAD_WINDOWS = ['3mo','12mo','all']`
  (`trends-training-load-logic.ts:158`) → **1 middle option**
- `trends.ts:595` — volume granularity group over `VOLUME_GRANULARITIES` (weekly /
  monthly / yearly, `trends.ts:588-592`) → **1 middle option**

The defect is most visible when a middle option is active: `.segmented__option--active`
fills with `var(--accent-strong)` (`styles.css:858-861`), so selecting "12mo",
"Monthly", or any of the three middle Trends tabs renders a fully-rounded accent pill
inside the group while the end options render correctly as D-shapes. Inactive middles
show `--surface`-vs-`--bg` notches — subtle in light theme, clearly visible in dark
(`#242444` on `#1a1a2e`). This is a regression introduced by this phase: before 19-03
there was no `button` rule at all and `.segmented { overflow: hidden }` clipped every
child square.

**Fix:** neutralise the inherited radius on the option and let only the end children
opt back in.

```css
.segmented__option {
  background: var(--surface);
  color: var(--text-secondary);
  border: none;
  /* Cancels the `button` baseline's border-radius: middle options must stay
     square so adjacent options join seamlessly. The :first-child/:last-child
     rules below re-round only the outer corners. */
  border-radius: 0;
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}
```

Add a regression assertion, since the current suite (`styles.test.ts:476-489`) only
checks the two end-child rules and would still pass with a rounded middle:

```ts
it('.segmented__option cancels the button baseline radius so middles stay square', () => {
  expect(declarationsFor('.segmented__option')).toContain('border-radius: 0');
});
```

---

### CR-03: `opacity: 0.6` washes the focus ring below its own documented 3:1 threshold on focusable rest-day cells

**File:** `src/dashboard/styles.css:1300-1305` (interacting with `src/dashboard/styles.css:380-385`)

**Issue:** `[aria-disabled="true"] { opacity: 0.6 }` and `:focus-visible`'s
`box-shadow` ring land on the **same element**. `opacity` applies to the element's
entire rendered output including its `box-shadow`, so the ring is composited at 60%.

Calendar rest days are the live case and they are *deliberately* focusable:
`calendar.ts:126-131` keeps them as real `<button>`s with no `disabled` attribute
("still a real, focusable button for a consistent Tab order") and sets
`aria-disabled="true"`. Tab reaches them, `:focus-visible` matches, and the ring paints
at 0.6 alpha.

Recomputing the file's own numbers (`styles.css:346-350`, W3C relative-luminance, SC
1.4.11 non-text 3:1 threshold) with the accent stop blended at 60% over the backdrop:

| theme | ring stop | backdrop | blended | contrast | file claims |
|---|---|---|---|---|---|
| light | `--accent` `#fc4c02` | `--bg` `#ffffff` | `#fd9467` | **2.19:1** | 3.40:1 |
| dark | `--accent` `#ff6b35` | `--bg` `#1a1a2e` | `#a34b32` | **2.93:1** | 6.02:1 |

Both fail the 3:1 threshold the focus-ring comment asserts the design clears. The
two-tone separation degrades as well, since the inner `--bg` stop is faded by the same
factor. In a typical month roughly a third to a half of the calendar grid is rest days,
so this is the common case, not an edge.

Note also that the rule's justification comment is partly wrong on its own terms: it
cites "pagination labels" as an informative-but-disabled case this opacity keeps
legible, but `.pagination__label` is a `<span>` (`list.ts:526-528`) that neither
`:disabled` nor `[aria-disabled="true"]` ever matches. The genuinely disabled
pagination controls are prev/next (`list.ts:491, 521`), which use the real `disabled`
property and are therefore *not* focusable — so rest days are in fact the only place
where dimming meets the focus ring.

**Fix:** restore full opacity while the element is focus-visible, so the dimming never
attenuates the ring.

```css
:disabled,
[aria-disabled="true"] {
  color: var(--text-secondary);
  opacity: 0.6;
  cursor: default;
}

/* An aria-disabled control can still be focusable (calendar rest days keep a
   consistent Tab order, calendar.ts:126). Dimming the element also dims its
   focus ring — measured 2.19:1 light / 2.93:1 dark against --bg, both under the
   3:1 SC 1.4.11 floor the focus-ring rule documents. Full opacity while focused
   keeps the ring at its audited 3.40:1 / 6.02:1. */
:disabled:focus-visible,
[aria-disabled="true"]:focus-visible {
  opacity: 1;
}
```

(Alternatively, move the dimming onto the cell's inner content rather than the button
itself. Either way, add an assertion — the current suite has no coverage tying the
disabled treatment to the focus ring.)

## Warnings

### WR-01: The hover-exclusion test would pass with two of the four tint exclusions deleted

**File:** `src/dashboard/styles.test.ts:379-388`

**Issue:** The test named "the shared hover rule excludes disabled controls and the
accent-strong fills" asserts `.calendar-day--tint-1` and `.calendar-day--tint-4` but
**not** `--tint-2` or `--tint-3`. Deleting those two exclusions from
`styles.css:1280-1281` leaves all 50 tests green while reintroducing precisely the
defect the CSS comment says the exclusions prevent (`styles.css:1268-1271`: "a bare
hover would flatten the hovered day to grey exactly where the pointer is"). An
assertion that survives deletion of the thing it protects is not a guard.

Compounding this: `ruleWithHeadContaining` returns `head + body` **concatenated**
(`styles.test.ts:167`), so none of these six `toContain` checks can distinguish a
selector token in the head from a substring in a declaration value. A future rewrite
that moved an exclusion into the body as, say, a comment-free declaration value would
still satisfy them.

**Fix:** assert all four tints, and assert against the head only.

```ts
it('the shared hover rule excludes disabled controls and the accent-strong fills', () => {
  const rule = ruleWithHeadContaining(':where(:not(');
  expect(rule).toContain('color-mix(in srgb, var(--surface) 92%, var(--text))');
  for (const excluded of [
    ':disabled',
    '[aria-disabled="true"]',
    '.pagination__button--current',
    '.segmented__option--active',
    '.calendar-day--tint-1',
    '.calendar-day--tint-2',
    '.calendar-day--tint-3',
    '.calendar-day--tint-4',
  ]) {
    expect(rule).toContain(excluded);
  }
});
```

---

### WR-02: The test helpers cannot see inside `@media` blocks, and the shipped helper audit does not say so

**File:** `src/dashboard/styles.test.ts:97, 121, 164` (audit comment at `src/dashboard/styles.test.ts:300-322`)

**Issue:** All three rule-scanning helpers iterate `/([^{}]+)\{([^}]*)\}/g`. The body
class `[^}]*` permits `{`, so an `@media` prelude is consumed as a *rule head* and the
first nested rule is swallowed into its "body". I confirmed this by running the exact
regex over the file — seven pseudo-rules come out with an at-rule head:

```
HEAD: "@media (max-width: 640px)"  | BODY: ".app-nav__links { display: none;"
HEAD: "@media (max-width: 720px)"  | BODY: ".activity-table-wrapper { display: none;"
HEAD: "@media (min-width: 721px)"  | BODY: ".route-map__canvas { min-height: 320px;"
HEAD: "@media (max-width: 380px)"  | BODY: ".chart-band__canvas-wrap { height: 112px;"
HEAD: "@media (min-width: 640px)"  | BODY: ".pr-evolution-grid { grid-template-columns: repeat(2, 1fr);"
HEAD: "@media (min-width: 1000px)" | BODY: ".pr-evolution-grid { grid-template-columns: repeat(3, 1fr);"
HEAD: "@media (max-width: 380px)"  | BODY: ".pr-evolution-card__canvas-wrap { height: 112px;"
```

Consequences: `selectorListDeclares('.pr-evolution-grid', 'grid-template-columns: repeat(2, 1fr)')`
returns `false` even though the declaration exists, and
`selectorListDeclares('@media (max-width: 640px)', 'display: none')` returns `true`.
No current assertion is wrong because of this, but any future claim about a responsive
rule will silently fail closed (or, for `ruleWithHeadContaining`, match the wrong
block).

The material defect is that `styles.test.ts:300-322` is presented as a complete
per-helper audit of "what the helper proves and the class of false pass it cannot rule
out", and it enumerates four blind spots — none of which is at-rule nesting, the one
structural limitation that actually exists in the current stylesheet.

**Fix:** either brace-match properly, or — cheaper and honest — document the limit and
fail loudly on it:

```ts
function assertNotAtRule(head: string, needle: string): void {
  if (head.trim().startsWith('@')) {
    throw new Error(
      `Helper matched an at-rule prelude ("${head.trim()}") while looking for "${needle}". ` +
        'These helpers do not descend into @media blocks — see the helper audit.',
    );
  }
}
```

and add the omission to the audit comment: "*all three rule-scanning helpers treat an
`@media` prelude as a rule head and fuse the first nested rule into its body; no
assertion may target a rule inside an at-rule block.*"

---

### WR-03: Radius-token adoption is partial, so retuning either token now produces a mixed-radius UI

**File:** `src/dashboard/styles.css:244, 268, 288, 299, 506, 524, 600, 679, 763, 796`

**Issue:** This phase introduced `--radius-control: 4px` / `--radius-panel: 8px`
(`styles.css:55-59`) and retrofitted six selectors — the four panels plus `.segmented`
and the `input`/`button` baselines. Ten rules still hardcode the same numbers:

| line | selector | literal | should be |
|---|---|---|---|
| 288 | `.badge` | `4px` | `var(--radius-control)` |
| 506 | `.filter-toggle` | `4px` | `var(--radius-control)` |
| 600 | `.pagination__button` | `4px` | `var(--radius-control)` |
| 679 | `.calendar-day` | `4px` | `var(--radius-control)` |
| 244 | `.card` | `8px` | `var(--radius-panel)` |
| 268 | `.activity-row` | `8px` | `var(--radius-panel)` |
| 524 | `.filter-panel--open` | `8px` | `var(--radius-panel)` |
| 763 | `.route-map` | `8px` | `var(--radius-panel)` |
| 796 | `.chart-band` | `8px` | `var(--radius-panel)` |
| 299 | `.cta` | `6px` | matches **neither** token |

This is the exact argument that closed WR-01 for `.segmented`, and it is now sharper
than before the phase: `button { border-radius: var(--radius-control) }`
(`styles.css:1253`) applies the *token* to every class-less button and every segmented
option, while `.pagination__button` and `.calendar-day` override it with a *literal*.
Retuning `--radius-control` to 6px would silently split the control set into two
radii — a divergence that did not exist before this phase, because before it no button
derived its radius from the token at all. `.cta`'s `6px` is off the scale entirely and
will never track a retune.

**Fix:** migrate the ten literals onto the tokens (choose `--radius-control` or
`--radius-panel` for `.cta` explicitly rather than leaving 6px), and extend the
existing negative assertion:

```ts
it('no control/panel radius is still a literal', () => {
  const literalRadii = cssNoComments.match(/border-radius:\s*\d+px/g) ?? [];
  // 999px pills (.chip, .preset-chip) and the 2px heatmap cell are deliberate
  // off-scale values; everything else must come from a token.
  expect(literalRadii).toEqual([]);
});
```

## Info

### IN-01: Empty ruleset

**File:** `src/dashboard/styles.css:1067-1068`

**Issue:** `.pr-table { }` declares nothing. The comment above explains the intent
("composes with `.activity-table` ... only what differs is declared here"), but the
result is a rule that a minifier drops and a reader has to parse to learn it does
nothing. The class is genuinely used (26 references outside the stylesheet), so only
the empty rule is dead — not the class.

**Fix:** delete the empty block and keep the comment attached to `.pr-table__numeric`,
which is the rule the comment's contract actually governs.

---

### IN-02: A test named "on these selectors" asserts against the whole raw file

**File:** `src/dashboard/styles.test.ts:558-561`

**Issue:** `it('no retired --space-2xl padding or --space-xl gap survived on these
selectors')` asserts `expect(css).not.toContain(...)` on the **raw** stylesheet,
comments included, with no selector scoping at all. It will fail if any future comment
merely quotes the string `padding: var(--space-2xl)` while explaining why it was
retired — the sibling assertions in this file deliberately use `cssNoComments` for
exactly that reason (`styles.test.ts:14-18`).

**Fix:** assert against `cssNoComments`, and rename the test to state the actual
(whole-file) scope.

---

### IN-03: Two declarations on one line, inconsistent with the rest of the file

**File:** `src/dashboard/styles.css:605`

**Issue:** `background: var(--accent-strong); border-color: var(--accent-strong);`
is the only place in 1305 lines where two declarations share a line, which makes the
`border-color` override easy to miss when scanning `.pagination__button--current`
against `.pagination__button`'s `border: 1px solid var(--border)`.

**Fix:** split onto separate lines to match the file's convention.

---

_Reviewed: 2026-08-13T03:55:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
