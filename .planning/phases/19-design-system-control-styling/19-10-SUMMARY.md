---
phase: 19-design-system-control-styling
plan: 10
subsystem: ui
tags: [css, z-index, stacking-context, accessibility, focus-ring, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling
    provides: "plan 19-07's :focus-visible position:relative; z-index:1 promotion (GAP 2 fix), and 19-09's closed phase gate that this gap-closure round reopened"
provides:
  - "An explicit, written, totally-ordered four-rung sticky-layer z-index ladder in src/dashboard/styles.css (.app-nav 20 > .records-jump 10 > .splits-table__km 2 > :focus-visible 1)"
  - "A numeric vitest assertion pinning all four rungs, watched RED against the real shipped defect before the fix landed"
  - "A hover-exclusion test that now fails when any one of the four required .calendar-day--tint-N exclusions is deleted"
  - "An at-rule guard (assertNotAtRuleHead) in the two single-match CSS test helpers, so they fail loudly instead of silently resolving to the wrong @media-nested block"
affects: [19-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Written, totally-ordered stacking-layer ladder as a single governing CSS comment, cross-referenced from each rung's own rule, instead of leaving relative order to CSS 2.1 Appendix E / tree order"
    - "assertNotAtRuleHead guard shared by the two single-resolved-match CSS test helpers (throw-on-@-prelude), deliberately withheld from the boolean-iterator helper"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Task 1's RED assertion was written and run BEFORE the CSS fix, and the verbatim throw (extractNumericDeclaration failing on .app-nav's missing z-index) was recorded, per the plan's anti-false-green requirement"
  - "The plan's own acceptance-criteria verification one-liner (comparing JSON.stringify(z) against a literal object) has a key-insertion-order bug — z accumulates keys in the CSS file's physical rule order (.app-nav, :focus-visible, .splits-table__km, .records-jump), not the ladder's logical order used in the literal comparison object, so JSON.stringify never matches even when every value is correct. Verified the same check with an order-independent comparison instead; documented rather than silently worked around."
  - "npm test's full run shows 5 pre-existing test-file collection failures (0 test failures) caused by ENOENT on gitignored data/stats/*.json fixtures absent in this git-worktree-isolated agent — documented in deferred-items.md as out of scope (SCOPE BOUNDARY), unrelated to this plan's two files"

patterns-established: []

requirements-completed: [UI-02]

# Metrics
duration: 15min
completed: 2026-08-13
---

# Phase 19 Plan 10: CR-01 sticky-layer z-index ladder Summary

**The sticky global nav now declares `z-index: 20`, explicitly above the promoted focus ring, closing a regression where a focused control scrolled under the header painted over the opaque nav on every route — the file states its full four-rung stacking order as one written invariant, pinned by a numeric assertion watched failing against the real defect first.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-13T06:56:00Z
- **Completed:** 2026-08-13T07:03:00Z
- **Tasks:** 2
- **Files modified:** 2 (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`)

## Accomplishments

- Gave `.app-nav` (sticky, opaque, previously no `z-index`) an explicit `z-index: 20`, above `:focus-visible`'s `z-index: 1` — fixing CR-01, a paint-order regression introduced by plan 19-07's own GAP-2 fix
- Moved `.splits-table__km` from `z-index: 1` to `z-index: 2`, breaking a latent equal-value tie with `:focus-visible` that `.splits-scroll` (no stacking context of its own) would otherwise have resolved by tree order
- Wrote one governing comment above `.app-nav` stating the full four-rung ladder (20 / 10 / 2 / 1), the mechanism (CSS 2.1 Appendix E step 8 vs step 9), and why each neighbour sits where it does; cross-referenced from `.splits-table__km`'s own comment
- Replaced the two-rung `.records-jump`-vs-ring numeric assertion with a four-rung ladder assertion, watched RED against the real shipped defect before the CSS fix landed
- Closed WR-01 (hover-exclusion test missing 2 of 4 required tint exclusions) and WR-02 (CSS test helpers silently swallowing `@media` blocks as rule bodies), both mutation-checked

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the ladder assertion RED, then give .app-nav and .splits-table__km their explicit layers (CR-01)** - `63788f1` (fix)
2. **Task 2: Close the two test-suite holes the review found around this area (WR-01, WR-02)** - `1fc1e8b` (test)

**Plan metadata:** committed alongside this SUMMARY (worktree mode — STATE.md/ROADMAP.md excluded; orchestrator applies those centrally after merge)

## Files Created/Modified

- `src/dashboard/styles.css` — `.app-nav` gained `z-index: 20` and a 35-line governing ladder comment; `.splits-table__km` changed from `z-index: 1` to `2` with an 8-line cross-reference comment. `:focus-visible`'s rule body (`outline: none`, the two-tone `box-shadow`, `position: relative`, `z-index: 1`) is byte-identical to before this plan — verified via `git diff` showing no modification inside that rule.
- `src/dashboard/styles.test.ts` — replaced the `.records-jump paints above a focused control` two-rung test with a four-rung ladder assertion; added `assertNotAtRuleHead` and applied it in `bodyForSelectorListToken`/`ruleWithHeadContaining`; extended the hover-exclusion test to all eight required `:not()` tokens; amended the per-helper audit comment to document the at-rule blind spot for all three rule-scanning helpers and add the previously-missing `bodyForSelectorListToken` bullet.

## Task 1 — Verbatim RED output (Step 1, recorded before any CSS change)

```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 focus ring > the sticky-layer ladder (.app-nav > .records-jump > .splits-table__km > :focus-visible) holds numerically and in order
Error: No numeric z-index declaration found in:

  display: flex;
  flex-direction: row;
  align-items: center;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: var(--space-md);
  position: sticky;
  top: 0;

 ❯ extractNumericDeclaration src/dashboard/styles.test.ts:144:11
 ❯ src/dashboard/styles.test.ts:533:26

Test Files  1 failed (1)
     Tests  1 failed | 49 passed (50)
```

This is exactly the failure the plan predicted: `extractNumericDeclaration` throws because `.app-nav`'s rule body (shown verbatim above) has no `z-index` declaration at all — proving the assertion would have caught the shipped CR-01 defect, not merely restating a fix written after the fact.

## Task 1 — Declarations added/changed, with line numbers (post-fix)

- `src/dashboard/styles.css:203` — `.app-nav` gains `z-index: 20;` (the only line added inside that rule body; `position: sticky` and `top: 0` are unchanged).
- `src/dashboard/styles.css:928` — `.splits-table__km`'s `z-index: 1` changed to `z-index: 2;` (the only value changed inside that rule body).
- `src/dashboard/styles.css:159-193` — new 35-line governing ladder comment above `.app-nav`.
- `src/dashboard/styles.css:918-925` — new 8-line cross-reference comment above `.splits-table__km`.
- `:focus-visible` (`src/dashboard/styles.css` § Global focus ring) — **unchanged**: `outline: none`, `box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent)`, `position: relative`, `z-index: 1` all byte-identical to pre-plan state.

## Task 1 — Ladder comment as written

> Sticky-layer ladder (CR-01, 19-REVIEW.md). Four sticky/promoted rules in this file compete for paint order; this comment is the single, written, totally-ordered statement of that order — no rung's position is left to tree order or CSS 2.1 Appendix E happening to resolve favourably.
>
> ```
>   4 (top)  .app-nav              z-index: 20  (this rule)
>   3        .records-jump         z-index: 10  (styles.css, § Records sticky jump list)
>   2        .splits-table__km     z-index: 2   (styles.css, § Splits table)
>   1 (bottom) :focus-visible      z-index: 1   (styles.css, § Global focus ring)
> ```
>
> `.app-nav` is `position: sticky; top: 0` with opaque `background: var(--surface)`, and every route scrolls its content underneath it. A sticky element with `z-index: auto` paints in CSS 2.1 Appendix E step 8; `:focus-visible`'s promoted stacking context (added by plan 19-07 to fix GAP 2, see that rule's own comment below) paints in step 9 — so with no `z-index` here, a focused control scrolled under the nav painted OVER the opaque global chrome on every route. That is CR-01, a regression introduced by 19-07's own fix: it was audited against `.records-jump` only, never against `.app-nav`. `z-index: 20` fixes it by giving the nav an explicit layer above `:focus-visible`'s `z-index: 1` — a layer added ABOVE the ring, not a demotion of the ring itself; `:focus-visible`'s `position: relative; z-index: 1` is unchanged by this plan.
>
> `.records-jump` sits below the nav at `10`: its `top` is computed at runtime from the live `.app-nav` height (see that rule's own comment), so the jump bar abuts the nav rather than overlapping it in normal layout — nav-over-jump-bar is the correct, intended outcome in the rare case a resize transiently overlaps them.
>
> `.splits-table__km` moved from `1` to `2` (see that rule's own comment) to break what was otherwise an equal-value tie with `:focus-visible`, which tree order — not design — would have resolved.
>
> Gaps of 8-10x are deliberate, leaving room for a future layer between any two rungs without renumbering the rest.

## Task 1 — Blast-radius audit (Step 4)

1. **`.app-nav` becomes a stacking context.** `position: sticky` + a numeric `z-index` makes any element a stacking context per the CSS spec. `nav.ts:126-175` (`createNav`) appends exactly four in-flow children into `.app-nav`: `brand` (`<a class="app-nav__brand">`), `toggleBtn` (`<button class="app-nav__toggle">`), `linksEl` (`<ul class="app-nav__links">` containing `<li><a class="app-nav__link">` per route), and `themeToggleBtn` (`<button class="theme-toggle">`, itself containing two inline SVG icons). None of these — nor any rule in `styles.css` targeting them (`.app-nav__link`, `.app-nav__link:hover,:focus-visible,[aria-current]`, `.app-nav__toggle`, `.theme-toggle`, `.theme-toggle__icon`, `.theme-toggle__icon--active`) — declares `position: absolute`, `position: fixed`, `transform`, `opacity`, or `filter`. Nothing moves and nothing is newly clipped: `.app-nav`'s own rule (`styles.css:194-204`) declares no `overflow` property at all — confirmed by reading the full rule body, not assumed.
2. **A focused `.app-nav__link`, `.app-nav__toggle`, or `.theme-toggle` now resolves inside `.app-nav`'s own stacking context rather than the root context.** All three inherit the bare `:focus-visible` rule (`z-index: 1; position: relative`) via the unscoped selector (D-12). Because `.app-nav` is now itself a stacking context at layer 20 in the root context, its focused descendants' `z-index: 1` is scoped to compete only against `.app-nav`'s own other children (all `z-index: auto` in-flow siblings) — the descendant still paints above its nav siblings exactly as before, and the whole nav (descendant ring included) still paints as one unit at layer 20 in the root context. No behavioral change to focus-ring visibility inside the nav.
3. **The `@media (max-width: 640px)` mobile nav** (`styles.css:423-434`) only toggles `display: none` / `display: inline-flex` on `.app-nav__links` and `.app-nav__toggle` — no `position`, `z-index`, `transform`, or `overflow` declaration in that block. It has zero interaction with the new stacking context; the collapse behavior is unaffected.
4. **`.records-jump` at 10 vs. `.app-nav` at 20.** `.records-jump`'s own comment (`styles.css` § Records sticky jump list) states its `top` is deliberately not hardcoded and is computed at runtime from the live `.app-nav` height, so in normal layout the two elements abut rather than overlap — `.records-jump` still paints above a focused control elsewhere on the page (`10 > 1`, its original invariant, unchanged by this plan). In the overlap case (e.g. a resize transiently overlapping them before the runtime `top` recalculates), `.app-nav` at `20` now wins over `.records-jump` at `10` — the intended outcome per the plan's stated design, since the nav is the outermost global chrome.
5. **`.splits-table__km` at 2 vs. a focused element at 1.** Read `src/dashboard/views/detail-sections.ts`'s `buildSplitsSection` (lines 136-191) end to end: the builder produces a `<section>` containing an `<h2>` heading, a `.splits-scroll` `<div>` wrapping a `.splits-table` `<table>` with a `<thead>`/`<tbody>`. Every cell is built via `buildTextCell` (`<td>` with `textContent`, no children) or the inline `buildPaceBarCell` (a `<td>` containing a `.pace-bar` `<div>` with `.pace-bar__track`/`.pace-bar__tick`/`.pace-bar__fill` `<div>`s, none of which is focusable — divs with no `tabindex`, no interactive role, no href). No `<a>`, `<button>`, `<input>`, or `tabindex`-bearing element exists anywhere inside `.splits-scroll` today. This confirms the change is a latent-tie resolution with no rendered effect: before this change, a focusable cell added later inside `.splits-scroll` would have tied at `z-index: 1` with `:focus-visible` and resolved by tree order (silently, undocumented) rather than by design.

## WR-01 mutation-check observation (verbatim)

Deleted `.calendar-day--tint-2` from the `:not()` exclusion list in `src/dashboard/styles.css`, ran `npx vitest run src/dashboard/styles.test.ts`:

```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 button baseline > the shared hover rule excludes disabled controls and the accent-strong fills (all eight tokens)
AssertionError: expected '\n\n\nbutton:where(:not(\n      :disa…' to contain '.calendar-day--tint-2'

- Expected
+ Received

- .calendar-day--tint-2
+
+
+ button:where(:not(
+       :disabled,
+       [aria-disabled="true"],
+       .pagination__button--current,
+       .segmented__option--active,
+       .calendar-day--tint-1,
+       .calendar-day--tint-3,
+       .calendar-day--tint-4
+     )):hover
+   background: color-mix(in srgb, var(--surface) 92%, var(--text));

Test Files  1 failed (1)
     Tests  1 failed | 49 passed (50)
```

Restored `styles.css` immediately after (`git diff --quiet src/dashboard/styles.css` confirmed clean). This proves the assertion now fails on a deletion that previously passed green (the pre-existing test only checked `--tint-1`/`--tint-4`).

## WR-02 mutation-check observation (verbatim)

Constructed a throwaway local reproduction of `ruleWithHeadContaining` (not committed) and called it with `'max-width: 640px'` — a needle that only appears inside an `@media` prelude:

```
THREW AS EXPECTED: Matched an @-rule prelude ("@media (max-width: 640px)") while looking for "max-width: 640px" — these helpers do not descend into @media (or other at-rule) blocks, so this match is the at-rule prelude itself, not the rule the caller intended.
```

The throwaway reproduction was discarded after this observation; the guard as committed lives only inside `assertNotAtRuleHead`, applied in `bodyForSelectorListToken` and `ruleWithHeadContaining`.

## `detail-sections.ts` reading (recorded per plan's output spec)

`buildSplitsSection` (`src/dashboard/views/detail-sections.ts:136-191`) builds only `<th>`/`<td>` text cells via `buildTextCell` and `.pace-bar` `<div>` structures (`.pace-bar__track`, `.pace-bar__tick`, `.pace-bar__fill`) via the inline `buildPaceBarCell`. No focusable element (`<a>`, `<button>`, `<input>`, or any element carrying `tabindex`) exists inside `.splits-scroll` today.

## Test counts

- `npx vitest run src/dashboard/styles.test.ts`: **50/50 passing** (up from 50 pre-plan — the ladder test replaced the old two-rung test 1-for-1; the hover-exclusion test was extended in place; no new `it()` blocks were added).
- `npm test` (full suite): **837 tests passed, 0 failed**; 5 test *files* fail to collect (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) with `ENOENT` on gitignored `data/stats/*.json` fixtures. These files' own header comments state the fixtures are "absent on a fresh clone until [`compute-all-stats`] runs" — this is a structural characteristic of `git worktree`-isolated execution (worktrees only check out tracked files; `data/stats/` is gitignored pipeline output from the main checkout), unrelated to `src/dashboard/styles.css`/`styles.test.ts`. Logged in `.planning/phases/19-design-system-control-styling/deferred-items.md`, not fixed, per the executor's SCOPE BOUNDARY rule. The plan's referenced 919-test baseline is therefore not directly comparable from this worktree; the 50/50 result on this plan's actual surface (`styles.test.ts`) and the 837/837-with-zero-failures result on everything that *does* load are the meaningful numbers here.
- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `npm run build-widgets`: exit 0, zero `css-syntax-error` occurrences in the captured log.

## Decisions Made

- Recorded the RED failure verbatim before touching the stylesheet, confirming the new assertion is a real guard against the shipped CR-01 defect rather than a fix restated as a test.
- Identified and documented (rather than silently working around) a key-insertion-order bug in the plan's own literal `JSON.stringify` acceptance-criteria verification command; substituted an order-independent equality check that verifies the same underlying claim (all four values correct and strictly descending in the intended order).
- Logged the 5 pre-existing, worktree-environment-caused `npm test` file-level failures to `deferred-items.md` rather than attempting to fix them (would require invoking the live intervals.icu data pipeline, entirely out of scope for a CSS stacking-context plan, and forbidden from this isolated agent context).

## Deviations from Plan

### Auto-fixed Issues

None — this plan's tasks were followed as written; both "deviations" below are documentation/verification-method adjustments, not code auto-fixes.

**1. [Verification-method substitution] Plan's literal ladder-verification node one-liner has a key-order bug**
- **Found during:** Task 1, running the acceptance-criteria verification command
- **Issue:** The command's `JSON.stringify(z) !== JSON.stringify(expectedLiteral)` comparison is sensitive to object key insertion order. `z` accumulates keys in the CSS file's physical rule order (`.app-nav`, `:focus-visible`, `.splits-table__km`, `.records-jump`), while the literal comparison object's keys are written in logical ladder order (`.app-nav`, `.records-jump`, `.splits-table__km`, `:focus-visible`). These orders can never match without physically relocating rules in the file, which is not what the plan intends.
- **Fix:** none to the code — this is a verification-tooling artifact, not a stylesheet defect. Verified the same underlying claim (four correct values, strictly descending in the intended order) with an order-independent per-key comparison; documented the finding above rather than silently omitting the check.
- **Files modified:** none (verification only)
- **Committed in:** N/A — recorded here in the SUMMARY only

**2. [Out-of-scope, logged not fixed] 5 pre-existing `npm test` file collection failures from missing gitignored data**
- **Found during:** Task 1 and Task 2 verification gates (`npm test`)
- **Issue:** `data/stats/*.json` (gitignored pipeline output) is absent in this git-worktree-isolated checkout, causing 5 unrelated view-logic test files to fail at module load (`ENOENT`)
- **Fix:** not fixed — out of scope per SCOPE BOUNDARY (unrelated files, requires live data pipeline access not appropriate here)
- **Files modified:** `.planning/phases/19-design-system-control-styling/deferred-items.md` (new — documents the finding)
- **Committed in:** with this SUMMARY's metadata commit

---

**Total deviations:** 0 code auto-fixes; 2 documentation/scope notes (1 verification-method substitution, 1 out-of-scope logged item).
**Impact on plan:** None on the CSS/test changes this plan actually ships. Both notes are transparency about tooling/environment artifacts, not scope creep.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Not proven by anything in this plan** (stated per the plan's own `<verification>` closing note): that the nav actually paints above a focused control in a real browser. Row 18 of plan 19-12's checkpoint is the sole proof of the rendered outcome. This plan's green suite is the precondition for opening that checkpoint, never a substitute for it.
- All four acceptance-criteria code-level checks pass: RED-then-GREEN ladder assertion, exact four `z-index` declarations (up from three), `:focus-visible` byte-identical, no TypeScript file touched.
- `deferred-items.md` now exists for Phase 19, tracking the worktree-environment `npm test` gap for future infra planning (not proposed as an in-scope fix here).

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-13*
