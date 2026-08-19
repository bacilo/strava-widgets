---
phase: 23-trends-zoom-pan-taller-bands
plan: 02
subsystem: ui
tags: [css, vitest, chart.js, trends, design-system]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling
    provides: bare-<button> baseline (size/radius/hover/disabled/focus-ring) that the new zoom control buttons reuse without a new class
  - phase: 17-activity-browser-detail-views
    provides: the shared .chart-band / .chart-band__canvas-wrap / .chart-band__header rules this plan sits beside and must not edit
provides:
  - .chart-band__canvas-wrap--tall (D-18/D-19) — viewport-relative clamp(200px, 34dvh, 420px), Trends-only sibling of the shared canvas-wrap rule
  - a phone-width floor for the tall band at @media (max-width: 430px): clamp(160px, 30dvh, 260px) (D-21)
  - .chart-band__header--zoom, .chart-zoom-controls, .chart-zoom-hint layout classes (D-10/D-11/D-17) for plans 23-04/23-05 to attach the zoom control cluster to
  - by-value, mutation-verified structural tests in styles.test.ts guarding every new rule
affects: [23-04, 23-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS modifier-class discipline (D-18): a shared rule with multiple consumers gets a sibling modifier class, never an in-place edit — mirrors the existing .chart-band__canvas-wrap / detail-charts.ts precedent"
    - "Breakpoint selection justified against real observed device widths (D-21), not inherited from a nearby existing breakpoint — citing Phase 22's CAL-02 reopening as the cautionary precedent"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "D-18: new tall-band and zoom-cluster CSS added as sibling rules after .chart-band__header, never editing .chart-band, .chart-band__canvas-wrap, its 380px override, or .chart-band__header — confirmed byte-unchanged via git diff"
  - "D-19/D-21: dvh (not vh) used for the viewport-relative clamp, since mobile Safari recomputes vh as the address bar collapses during scroll, which fires Chart.js's ResizeObserver mid-scroll"
  - "D-21: new breakpoint pinned at 430px, not 380px — covers 390/393/412/430px real phone widths the existing 380px breakpoint left uncovered (the same gap that reopened CAL-02 in Phase 22); keeps styles.test.ts's IN-06/GC-7 380px-block count at exactly two"
  - "Comment wording in styles.css deliberately avoids repeating the literal strings 'chart-band__canvas-wrap--tall' and '@media (max-width: 380px)' beyond the plan's exact acceptance-criteria grep counts (2 and 3 respectively), while still carrying the full D-18/D-19/D-21 rationale in prose"

patterns-established:
  - "By-value structural CSS tests (WR-03 precedent extended): every new rule asserted by its exact declaration value via bodyForSelectorListToken/atRuleBodiesFor, never by selector existence alone, and proved load-bearing via three executed-and-reverted mutations"

requirements-completed: [TRN-03, TRN-02]

# Metrics
duration: ~23min
completed: 2026-08-19
---

# Phase 23 Plan 02: Trends tall-band CSS and zoom-cluster layout classes Summary

**Added the D-18/D-19 viewport-relative tall-band CSS (`clamp(200px, 34dvh, 420px)`, with a 430px-breakpoint phone floor) and the D-10/D-17 zoom-control-cluster layout classes to `styles.css`, plus six mutation-verified by-value tests in `styles.test.ts` — all without touching the shared `.chart-band__canvas-wrap`/`.chart-band__header` rules the activity detail view also depends on.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-08-19T16:44:50+02:00 (worktree base commit)
- **Completed:** 2026-08-19T17:07:39+02:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `.chart-band__canvas-wrap--tall` ships with the exact D-19 clamp value, plus a D-21 phone-width floor at a new, isolated `@media (max-width: 430px)` block that does not disturb the file's existing two-block `@media (max-width: 380px)` count (`IN-06`/`GC-7` stays green, untouched).
- The shared `.chart-band__canvas-wrap` rule, its 380px override, and `.chart-band__header` are confirmed byte-unchanged via `git diff` review — the activity detail view (`detail-charts.ts:401`) renders exactly as before.
- `.chart-band__header--zoom`, `.chart-zoom-controls`, and `.chart-zoom-hint` exist with the exact stated values, ready for plans 23-04/23-05 to attach the zoom control cluster to — no shared header rule was touched.
- Six new by-value test cases in `styles.test.ts` guard every new rule; three targeted mutations against `styles.css` were executed and each drove its corresponding case RED, then reverted, proving the guards are load-bearing rather than existence-only.

## Task Commits

Each task was committed atomically:

1. **Task 1 (23-02/T1): Add the tall-band and zoom-cluster rules to styles.css** - `c87fb46` (feat)
2. **Task 2 (23-02/T2): Add by-value structural tests to styles.test.ts** - `e798cab` (test)

_Note: styles.css comment wording was tuned in-place during Task 1 (before commit) to hit the plan's exact grep-count acceptance criteria — no separate commit was needed since the task wasn't yet committed._

## Files Created/Modified
- `src/dashboard/styles.css` - New Phase 23 block after `.chart-band__header`: `.chart-band__canvas-wrap--tall`, `.chart-band__header--zoom`, `.chart-zoom-controls`, `.chart-zoom-hint`, and one `@media (max-width: 430px)` block with the D-21-ordered zoom-hint/tall-band overrides; extended the section comment near line 882 recording the new breakpoint
- `src/dashboard/styles.test.ts` - New `describe('Phase 23 (TRN-03) — .chart-band__canvas-wrap--tall tall Trends bands', ...)` block with 6 by-value cases

## Decisions Made
- Kept the CSS comments' literal occurrences of `chart-band__canvas-wrap--tall` (2) and `@media (max-width: 380px)` (3) exactly matching the plan's stated `grep -c` acceptance criteria, rewording the explanatory prose around those points rather than the plan's specified values, since the plan listed those exact counts as pass/fail acceptance criteria.
- Used `atRuleBodiesFor('.chart-zoom-hint', 'display')` wrapped in `.toThrow()` (rather than `assertNoAtRuleOverride`) for the "hint never hidden" guard — functionally equivalent per the plan's stated options, chosen because it's the more direct read of "no override declares `display`" for a property that legitimately has zero at-rule-scoped declarations anywhere in the file.

## Deviations from Plan

None — plan executed exactly as written. One out-of-scope discovery was logged (not fixed) per the SCOPE BOUNDARY rule:

### Deferred (out of scope, not fixed)

**5 pre-existing test files fail on a fresh worktree due to missing `data/stats/*.json`**
- **Found during:** Task 2, running the plan's `npm test` full-suite verification step.
- **Issue:** `records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts` all fail with `ENOENT` reading live `data/stats/*.json` fixtures. `data/stats/` is gitignored and populated only by running `npm run compute-all-stats`, which this fresh worktree never ran — `ls data/stats/*.json` finds nothing.
- **Scope determination:** Zero relationship to `styles.css`/`styles.test.ts`, the only two files this plan touches. Not caused by this plan's changes; pre-existing environment/data-generation gap.
- **Action:** Logged to `.planning/phases/23-trends-zoom-pan-taller-bands/deferred-items.md`, not fixed, per the executor's SCOPE BOUNDARY rule.
- **Verification that it's isolated:** `styles.test.ts` itself is 135/135 green; the other 48 test files (1185 tests) all pass. Only these 5 files fail to load their live-data fixture.

## Issues Encountered
None beyond the deferred item above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

- `.chart-band__canvas-wrap--tall`, `.chart-band__header--zoom`, `.chart-zoom-controls`, and `.chart-zoom-hint` are ready for plans 23-04 (zoom control cluster wiring) and 23-05 to consume — no further CSS class additions needed for the layout contract those plans depend on.
- This plan is the single owner of `src/dashboard/styles.css` for Phase 23 (mirroring 17-01's precedent); no later Phase 23 plan should need to touch the stylesheet.
- The pre-existing `data/stats/*.json` gap (see Deviations) is unrelated to Phase 23 and does not block any subsequent Phase 23 plan, since none of them depend on those five test files' data fixtures for CSS/JS-only Trends zoom/pan work.

## Mutation-Check Results (Task 2 acceptance criterion)

All three required mutations were executed against `src/dashboard/styles.css`, confirmed to turn the corresponding new test case RED, then reverted (confirmed via `git diff --stat` showing zero changes to `styles.css` afterward, and the full `styles.test.ts` suite back to 135/135 green):

| # | Mutation | Case driven RED | Result |
|---|----------|------------------|--------|
| a | Base tall height `clamp(200px, 34dvh, 420px)` → `280px` | `TRN-03/D-19: the tall modifier declares a viewport-relative clamp by value` | RED confirmed, reverted |
| b | 430px override `clamp(160px, 30dvh, 260px)` → `clamp(160px, 30dvh, 400px)` | `TRN-03/D-21: the phone-width floor is asserted by value at its own breakpoint` | RED confirmed, reverted |
| c | Shared `.chart-band__canvas-wrap` height `140px` → `160px` | `TRN-03/D-18: the SHARED .chart-band__canvas-wrap rule is untouched` | RED confirmed, reverted |

`IN-06`/`GC-7` (the pre-existing exact-count-of-two `@media (max-width: 380px)` test) was not modified and remains green, count still 2 — confirmed via `npx vitest run src/dashboard/styles.test.ts -t "IN-06"`.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `src/dashboard/styles.css`
- FOUND: `src/dashboard/styles.test.ts`
- FOUND: `.planning/phases/23-trends-zoom-pan-taller-bands/23-02-SUMMARY.md`
- FOUND commit `c87fb46` (Task 1) in `git log --oneline`
- FOUND commit `e798cab` (Task 2) in `git log --oneline`
- FOUND commit `224cf90` (docs: complete plan) in `git log --oneline`
