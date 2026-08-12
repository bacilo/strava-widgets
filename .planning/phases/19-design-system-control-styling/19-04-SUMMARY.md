---
phase: 19-design-system-control-styling
plan: 04
subsystem: ui
tags: [css, focus-ring, accessibility, segmented-control, design-tokens, dashboard]

# Dependency graph
requires:
  - phase: 19-01
    provides: "--radius-control (4px) and --radius-panel (8px) theme-invariant CSS custom properties"
  - phase: 19-02
    provides: "Phase 19 banner block, input/select/textarea baseline, first shorthand font: inherit declaration"
  - phase: 19-03
    provides: "button baseline, shared button:where(:not(...)):hover, unscoped :disabled/[aria-disabled] treatment, .cta:hover repair, .activity-table tbody tr:hover retrofit — including a new .cta:focus-visible selector that this plan's Task 2 had to work around"
provides:
  - "Two-tone :focus-visible box-shadow ring (0 0 0 2px var(--bg), 0 0 0 4px var(--accent)) replacing the old outline-only rule, with outline: none in the same rule to suppress the UA default"
  - ".segmented no longer clips its focus ring (overflow: hidden removed); rounded silhouette reproduced via .segmented__option:first-child/:last-child end-child border-radius"
  - ".splits-scroll padded with var(--space-xs) so a future focusable element has ring clearance"
  - "Five new describe blocks in styles.test.ts guarding every Phase 19 rule against silent deletion, plus a new ruleWithHeadContaining() helper for comma-bearing :where(:not(...)) selector heads"
affects: [19-05, "any future plan adding a focusable control or touching .segmented/.splits-scroll/.records-jump"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-tone box-shadow focus ring: inner stop always --bg, outer stop always --accent — reduces UI-02's contrast requirement to exactly two precomputed pairs instead of an open-ended per-fill check"
    - "End-child border-radius (:first-child/:last-child) as a replacement mechanism for a container's overflow:hidden-based rounded silhouette, when that overflow was also clipping something that must now paint outside the box (the focus ring)"
    - "selectorListDeclares() over declarationsFor() for any selector whose literal text could also appear as a substring of a different, compound selector elsewhere in the file — declarationsFor's unanchored regex will silently match the wrong rule"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Block 4's :focus-visible assertions use selectorListDeclares(':focus-visible', ...) instead of the plan's specified declarationsFor(':focus-visible') — declarationsFor's unanchored regex matches plan 19-03's .cta:focus-visible rule first (its head contains the literal substring ':focus-visible {'), producing a false failure against the correct, working bare rule. selectorListDeclares' exact post-comma-split token match discriminates ':focus-visible' from '.cta:focus-visible' correctly. No new helper was needed for this — both are existing, plan-authorized helpers."
  - "Copied the gitignored data/stats/ and data/dashboard/ directories from the main repo checkout into this worktree (not committed — both remain gitignored) so npm test's five data-dependent view-logic suites could run and the plan's 884-baseline acceptance criterion could be verified. Worktrees do not inherit a parent checkout's untracked/gitignored files, and no pipeline step regenerates them inside a plan scoped to CSS/tests only."
  - "One inline test comment was reworded (prose only, no assertion changed) to avoid literally containing the plan's own acceptance-criteria grep needle `expect(css).not.toContain('overflow` — the comment explaining why a whole-file negative can't be used was itself matched by that grep as a false positive."

patterns-established:
  - "declarationsFor() vs selectorListDeclares() selection rule of thumb, extended: use selectorListDeclares even for a single (non-comma) selector if that selector's text is a substring of any other selector already in the file — declarationsFor is only safe when the target selector text cannot appear as a substring elsewhere."

requirements-completed: [UI-01, UI-02, UI-03]

# Metrics
duration: 18min
completed: 2026-08-12
---

# Phase 19 Plan 04: Two-Tone Focus Ring & Container Clipping Fixes Summary

**Two-tone `box-shadow` focus ring (`--bg` inner halo, `--accent` outer ring) replaces the old accent-only `outline`, fixing the ring's invisibility against the two `--accent-strong` active fills, with `.segmented`'s clipping `overflow: hidden` removed and its rounded silhouette rebuilt via end-child radii; five new `describe` blocks lock every Phase 19 CSS rule against silent deletion.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-12T19:04Z (approx, per worktree reset)
- **Completed:** 2026-08-12T19:21:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `:focus-visible` rule replaced in place (same location, same selector — bare and unscoped per D-12): `outline: 2px solid var(--accent); outline-offset: 2px;` became `outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);` — `outline: none` is in the same rule so no browser UA default outline paints alongside the box-shadow
- `.segmented`'s `overflow: hidden` removed; two new end-child rules (`.segmented__option:first-child` / `:last-child`) reproduce the previously-clipped rounded silhouette using `var(--radius-control)` — flagged below as a named checkpoint call-out per the plan, since this is a real visual-mechanism change, not a pure refactor
- `.splits-scroll` gained `padding: var(--space-xs)` for ring clearance; `.records-jump` (already 8px) and `.sr-only` (still `overflow: hidden`) were both confirmed untouched
- Five `describe('styles.css — Phase 19 ...')` blocks added to `styles.test.ts` — control baseline, button baseline, disabled treatment, focus ring, radius tokens — 25 new `it()` assertions, all using the correct existing helper per selector shape
- One new module-level helper, `ruleWithHeadContaining()`, added to `styles.test.ts` to handle plan 19-03's comma-bearing `button:where(:not(...)):hover` selector head, which `selectorListDeclares()`'s comma-split logic cannot match
- Mutation check performed and reverted: deleting the `input, select, textarea` rule and removing `outline: none` from `:focus-visible` both produced observed red runs (verbatim messages below), proving the new assertions can actually fail
- `git status --porcelain src/dashboard/views src/dashboard/nav.ts` empty after both tasks — both fixes are CSS/test-only, no TypeScript touched, confirming the single `.segmented` instance in `detail-charts.ts` needed no markup change

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the focus ring and fix both clipping containers** - `a1b02f2` (feat)
2. **Task 2: Add the five Phase 19 describe blocks to styles.test.ts** - `d295360` (test)

_Note: This is a worktree-isolated parallel executor run; the plan-metadata commit (SUMMARY.md) is committed separately per worktree protocol, not as a `docs:` commit alongside STATE.md/ROADMAP.md, which the orchestrator owns centrally after merge._

## Files Created/Modified
- `src/dashboard/styles.css` - Replaced the global `:focus-visible` rule with the two-tone box-shadow ring; removed `.segmented`'s clipping `overflow: hidden`; added `.segmented__option:first-child`/`:last-child` end-child radii; added `padding: var(--space-xs)` to `.splits-scroll`
- `src/dashboard/styles.test.ts` - Added `ruleWithHeadContaining()` helper and five Phase 19 `describe` blocks (control baseline, button baseline, disabled treatment, focus ring, radius tokens)

## The `:focus-visible` rule, before and after

**Before:**
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

**After** (same location, extended comment above it records the two-tone rationale and the two precomputed contrast ratios):
```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}
```

## D-09 + D-10 co-location, confirmed in one commit

Commit `a1b02f2` contains, in the same diff hunk set: the `outline: none` + two-tone `box-shadow` addition (D-09), the two end-child `border-radius` additions and the `.segmented` `overflow: hidden` removal (D-10), and the `.splits-scroll` padding addition. Verified via the plan's own Node script that inspects `git show HEAD`'s added/removed lines rather than a name-only file listing (which cannot distinguish a co-located fix from a partial one, since every edit in this task lands in the same single file).

## `.segmented` silhouette-mechanism change — checkpoint call-out

Named per the plan alongside 19-03's D-08 row-hover call-out. `.segmented__option` declares no `border-radius` of its own; its rounded-corner look previously came entirely from the parent `.segmented`'s `overflow: hidden` clipping square children into the parent's own rounded shape. That clipping also clipped the focus ring on the active option — the exact bug this plan exists to fix. The replacement mechanism is `.segmented__option:first-child { border-radius: var(--radius-control) 0 0 var(--radius-control) }` and `.segmented__option:last-child { border-radius: 0 var(--radius-control) var(--radius-control) 0 }`, alongside the parent's unchanged `border-radius: 4px`. This is a real change of visual mechanism (unclipped children with their own radii vs. a clipping parent), not a pure refactor — plan 19-05's human checkpoint should confirm the rendered silhouette still matches.

## The two contrast ratios, restated

From this plan's own `<contrast_record>` block (independently computed in `19-RESEARCH.md` via the W3C relative-luminance formula, agreeing with `19-UI-SPEC.md`), threshold 3:1 (WCAG 2.1 SC 1.4.11):

| Theme | Ring colour | Adjacent | Contrast ratio | Result |
|-------|-------------|----------|-----------------|--------|
| Light | `--accent` `#fc4c02` | `--bg` `#ffffff` | **3.40:1** | clears 3:1, margin ~13% |
| Dark | `--accent` `#ff6b35` | `--bg` `#1a1a2e` | **6.02:1** | clears 3:1 comfortably |

Per D-11, no luminance/contrast-ratio helper was added to `styles.test.ts` (`grep -ci 'luminance\|contrastRatio\|relativeLuminance' src/dashboard/styles.test.ts` returns `0`). These numbers are closed-form and change only if `--accent`/`--bg` themselves change.

## Five describe block titles, with assertion counts

1. **`'styles.css — Phase 19 control baseline'`** (D-01–D-04) — 5 `it()` blocks: the `input, select, textarea` shared box treatment (5 declaration checks in one `it`), `select` min-height, `textarea` font, `input[type="checkbox"]` border reset, and the D-02 no-`::-webkit-` negative.
2. **`'styles.css — Phase 19 button baseline'`** (D-05, D-06, D-08) — 6 `it()` blocks: the `button` baseline (4 declaration checks), the shared hover rule via `ruleWithHeadContaining` (formula + all 6 exclusion tokens checked), the no-bare-`button:hover` negative, `.cta:hover`'s accent-mix, `.activity-table tbody tr:hover`'s surface-mix, and the retired literal-black negative.
3. **`'styles.css — Phase 19 disabled treatment'`** (D-07) — 2 `it()` blocks: the three `:disabled` declarations and the `[aria-disabled="true"]` opacity.
4. **`'styles.css — Phase 19 focus ring'`** (D-09, D-10, D-12) — 7 `it()` blocks: the ring declarations + outline-offset negative (via `selectorListDeclares`, see deviation below), the single-box-shadow-in-file count, the scoped `.segmented` negative, the `.sr-only` survival check, the two end-child radius checks, `.splits-scroll` padding, `.records-jump` padding unchanged.
5. **`'styles.css — Phase 19 radius tokens'`** (D-13) — 5 `it()` blocks: both `:root` radius tokens, the theme-invariance negative on both `[data-theme]` blocks, the four retrofitted panel selectors' `border-radius`/`padding` pair (looped), `.stat-grid`'s gap, and the two retired-value negatives.

Total: 25 new `it()` assertions across 5 `describe` blocks (`npx vitest run src/dashboard/styles.test.ts` reports 40 tests total: 15 pre-existing + 25 new).

## New helper signature and why it was needed

```typescript
function ruleWithHeadContaining(needle: string): string
```

Scans `cssNoComments` with the same `/([^{}]+)\{([^}]*)\}/g` idiom `selectorListDeclares()` uses, and returns the first rule's `head + body` whose **head** contains `needle` as a substring. `selectorListDeclares()` splits a rule head on `,` and requires an exact post-trim match against one token — but plan 19-03's shared hover selector's head contains commas *inside* `:where(:not(…))` (`:disabled`, `[aria-disabled="true"]`, `.pagination__button--current`, `.segmented__option--active`, four `.calendar-day--tint-N` classes), so splitting on `,` produces fragments that never equal the full head. Used with the needle `':where(:not('` to locate the shared hover rule. Throws a named error when the needle isn't found, so a future deletion of this rule fails the test loudly.

## Two mutation-check failure messages, verbatim

**Mutation 1 — deleted the `input, select, textarea` rule from `styles.css`:**
```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 control baseline > textarea declares font: inherit
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
```
(3 of 40 tests failed in this run: the shared-box-treatment `it`, and two more in the same block that depend on the same rule — `expect(selectorListDeclares(...)).toBe(true)` assertions across the block all correctly went red.) Rule restored, verified green again (40/40) before proceeding.

**Mutation 2 — removed `outline: none` from the `:focus-visible` rule:**
```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 focus ring > :focus-visible declares the two-tone box-shadow ring and suppresses the UA outline
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
```
(1 of 40 tests failed, exactly the assertion targeting `outline: none`.) Declaration restored, verified green again (40/40) and `git diff src/dashboard/styles.css` confirmed byte-identical to the committed state before proceeding.

## Decisions Made

- **Block 4's `:focus-visible` assertions use `selectorListDeclares(':focus-visible', ...)` instead of the plan's specified `declarationsFor(':focus-visible')`.** `declarationsFor`'s regex (`` `${escaped}\s*\{` ``) is not selector-boundary-anchored — it finds the first substring match of `:focus-visible {` in the file, and plan 19-03 added a `.cta:hover, .cta:focus-visible { ... }` rule earlier in the file whose head literally contains that substring. `declarationsFor(':focus-visible')` therefore returned `.cta`'s hover-mix declaration instead of the bare rule's, producing a false failure (`expected '...color-mix...' to contain 'outline: none'`) against a correctly-implemented, working ring. `selectorListDeclares()` splits each rule head on `,` and requires an exact post-trim token match, so `':focus-visible'` (no comma) never equals either `.cta:hover` or `.cta:focus-visible` as split tokens — it correctly finds only the bare rule. This is a same-day interaction with 19-03's own selector (not foreseeable when 19-04 was planned, since 19-03 landed first in wave order but this plan's helper-usage guidance was written independent of that file's final shape), fixed using only the two pre-existing, plan-authorized helpers — no third helper was added.
- **Copied gitignored `data/stats/` and `data/dashboard/` from the main checkout into this worktree, not committed.** Five `npm test` suites (`trends-gear-logic`, `trends-training-load-logic`, `trends-yoy-logic`, and two others) read these generated, gitignored files directly via `fs.readFileSync`. A fresh worktree checkout does not inherit a parent checkout's untracked/gitignored files, and this plan is scoped to CSS/tests only — no pipeline step regenerates them. Copying let `npm test`'s 884-baseline acceptance criterion be verified honestly (909 passed) rather than skipped or asserted from memory. Both directories remain gitignored and were not staged or committed.
- **Reworded one test-file comment** (prose only) because the plan's own acceptance-criteria grep (`expect(css).not.toContain('overflow`) matched the comment's explanatory prose rather than any assertion — a false positive analogous to the `declarationsFor`/`.cta:focus-visible` collision above. No test logic changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `declarationsFor(':focus-visible')` false-negatives against `.cta:focus-visible` (19-03's rule)**
- **Found during:** Task 2, writing Block 4's first assertion exactly as specified
- **Issue:** `declarationsFor`'s unanchored regex matched `.cta:hover, .cta:focus-visible { background: color-mix(...) }` (added by plan 19-03, which lands earlier in the file) instead of the bare, correctly-implemented `:focus-visible { outline: none; box-shadow: ... }` rule from this plan's Task 1. The test failed with `expected '...color-mix...' to contain 'outline: none'` — a false failure against working code.
- **Fix:** Switched the three assertions in that `it()` to `selectorListDeclares(':focus-visible', ...)`, which does an exact post-comma-split token match and correctly discriminates `:focus-visible` from `.cta:focus-visible`. Both are existing, plan-authorized helpers — no redefinition, no new helper.
- **Files modified:** src/dashboard/styles.test.ts
- **Verification:** `npx vitest run src/dashboard/styles.test.ts` — 40/40 pass with the corrected assertions; confirmed the original `declarationsFor` form does fail (this became mutation check 2's control, doubling as evidence the collision is real).
- **Committed in:** d295360 (Task 2 commit)

**2. [Rule 3 - Blocking] Missing gitignored data fixtures blocked `npm test`'s 884-baseline criterion**
- **Found during:** Task 2 verification (`npm test`)
- **Issue:** Five test files (`trends-gear-logic`, `trends-training-load-logic`, `trends-yoy-logic`, plus two more) `readFileSync` gitignored files under `data/stats/` and `data/dashboard/` that do not exist in a fresh worktree checkout (worktrees don't inherit a parent checkout's untracked files), producing `ENOENT` failures unrelated to any Phase 19 change.
- **Fix:** Copied `data/stats/` and `data/dashboard/` from the main repo checkout into this worktree (not committed — both remain gitignored).
- **Files modified:** none tracked; two gitignored directories populated locally
- **Verification:** `npm test` — 909/909 passed across 46 files after the copy, exceeding the plan's 884 baseline (46 vs. 41 files before the copy, 5 fewer ENOENT failures).
- **Committed in:** N/A (gitignored, not committed)

---

**Total deviations:** 2 auto-fixed (1 bug fix in test helper usage, 1 blocking-issue workaround for a worktree-local environment gap)
**Impact on plan:** Both were necessary to honestly satisfy the plan's own acceptance criteria rather than paper over a false failure or an unrelated environment gap. No scope creep — the `styles.css` production code exactly matches the plan's specification; only test-helper *usage* (not the two pre-existing helper *implementations*) and local environment state were adjusted.

## Issues Encountered

The `declarationsFor(':focus-visible')` / `.cta:focus-visible` substring collision (deviation 1 above) was the only implementation surprise; it was caught immediately by the first `npx vitest run` after writing Block 4, not discovered later. No other issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`src/dashboard/styles.css` now has: a two-tone `:focus-visible` box-shadow ring as the file's only `box-shadow` declaration, an unclipped `.segmented` control with its silhouette carried by end-child radii, ring-clearance padding on `.splits-scroll`, and `.records-jump`/`.sr-only` confirmed untouched. `src/dashboard/styles.test.ts` now has 40 tests (15 pre-Phase-19 + 25 new), all passing, with a mutation check proving two of them can fail. `npm test` is green at 909 (up from the pre-Phase-19 baseline of 884) and `npx tsc --noEmit` is clean. No blockers for plan 19-05's human checkpoint, whose agenda per this plan's own `<verification>` section should include: whether the ring actually renders and renders unclipped on `.segmented`, `.records-jump`, and `.splits-scroll`; whether it renders correctly on the two `--accent-strong` fills (current pagination page, active segmented option); whether the light-theme 3.40:1 ring is perceptually clear, not merely technically passing; and whether `.segmented`'s rounded silhouette still visually matches its pre-plan appearance now that the mechanism is end-child radii instead of parent clipping. None of this is provable without a rendering engine, which this repo does not have.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*
