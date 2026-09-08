---
phase: 23-trends-zoom-pan-taller-bands
plan: 08
subsystem: ui
tags: [chart.js, chartjs-plugin-zoom, vitest, trends, zoom-pan]

# Dependency graph
requires:
  - phase: 23-trends-zoom-pan-taller-bands
    provides: "plan 23-04's zoom/pan control cluster and settle() wiring, plan 23-05's Cadence & HR sibling-sync, and the Round 1 checkpoint (23-07) that recorded R8/R11/R16 as FAIL and named Findings 1/4/10 as their root causes"
provides:
  - "zoomStepRange and panStepRange — pure, unit-tested range functions replacing the plugin's imperative chart.zoom()/chart.pan() API for all four on-screen buttons"
  - "buildZoomPluginOptionsShape — the whole options.plugins.zoom object with onZoomComplete/onPanComplete correctly nested inside zoom/pan, fixing Finding 10 (the root cause of R11 and R16)"
  - "A source-text guard pinning chartjs-plugin-zoom@2.2.0's own onZoomComplete/onPanComplete lookup paths, so a future dependency bump cannot silently reintroduce Finding 10"
affects: ["23-11 gap-closure re-verification (R8, R11, R16 re-runs)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure range arithmetic (zoomStepRange/panStepRange) computed in the DOM-free logic module, applied directly onto the chart scale via the existing applyRange+settle path, instead of delegating to a charting plugin's imperative API"
    - "Source-text guard test (readFileSync + import.meta.url) pinning a vendored dependency's internal option-lookup path, in the style already established by row-semantics.test.ts and storage.test.ts"

key-files:
  created: []
  modified:
    - src/dashboard/views/trends-zoom-logic.ts
    - src/dashboard/views/trends-zoom-logic.test.ts
    - src/dashboard/views/chart-zoom.ts

key-decisions:
  - "zoomStepRange/panStepRange are centre-preserving / span-preserving translate-then-clamp functions (never re-scale to fit), matching the exact date-string expectations in the Round 1 table (Oct 2025 to Jun 2026 / Feb 2025 to Aug 2026 / May 2025 to May 2026)"
  - "buildZoomPluginOptionsShape takes a bare type parameter for the chart rather than importing chart.js, keeping trends-zoom-logic.ts loadable under vitest's environment: 'node'"
  - "buildZoomPluginOptions in chart-zoom.ts keeps its exported signature byte-for-byte unchanged, delegating its whole body to buildZoomPluginOptionsShape, so trends-charts.ts needed no edit"

requirements-completed: [TRN-02, TRN-04]

# Metrics
duration: 12min
completed: 2026-08-26
---

# Phase 23 Plan 08: Zoom/pan gap closure (Findings 1 and 10) Summary

**Fixed the two root causes behind Round 1's R8/R11/R16 FAILs: `onZoomComplete`/`onPanComplete` now sit inside `zoom`/`pan` where the plugin actually reads them, and all four zoom/pan buttons compute their target range with new pure `zoomStepRange`/`panStepRange` functions instead of the plugin's imperative API that silently produced the wrong step magnitude.**

## Performance

- **Duration:** ~12 min (09:41 branch setup through 09:53 final commit)
- **Started:** 2026-08-26T07:41:00Z (approx, worktree branch check)
- **Completed:** 2026-08-26T07:53:42Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `zoomStepRange` (centre-preserving proportional zoom) and `panStepRange` (span-preserving proportional pan) to the pure `trends-zoom-logic.ts` module, both pinned by literal date-string assertions to the Round 1 expected-value table: one `+` press from the weekly default now reads `Oct 2025 to Jun 2026` (8 months, not Round 1's 6-month `Nov 2025 to May 2026`), one `←` press now reads `May 2025 to May 2026` (25% of span, not Round 1's ~33% `Apr 2025 to Apr 2026`).
- Deleted `panDeltaPx` entirely — the pixel-space delta function whose sign/magnitude the plugin's `panNumericalScale` re-derived incorrectly.
- Added `buildZoomPluginOptionsShape`, the whole `options.plugins.zoom` object with `onZoomComplete`/`onPanComplete` correctly nested INSIDE `zoom`/`pan` (Finding 10's fix). `chart-zoom.ts`'s exported `buildZoomPluginOptions` now delegates to it as a thin adapter, keeping `trends-charts.ts` untouched.
- Added a structural test asserting the exact inversion of the shipped defect (`'onZoomComplete' in shape` is `false`, `typeof shape.zoom.onZoomComplete` is `'function'`), plus a source-text guard reading `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` directly, pinning `state.options.zoom.onZoomComplete` / `state.options.pan.onPanComplete` so a future plugin upgrade that moves the lookup fails the suite instead of shipping green.
- Rewired all four zoom/pan button handlers (`zoomIn`, `zoomOut`, `panEarlier`, `panLater`) to read the rendered range via `currentRange()`, compute a target with the new pure functions, apply it with the existing `applyRange`, then call `settle()` — the same shape `reset` already used successfully (Round 1's R10(c) PASS).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add zoomStepRange and panStepRange, retire panDeltaPx** - `fc5a842` (feat)
2. **Task 2: Nest onZoomComplete/onPanComplete inside zoom/pan (Finding 10)** - `ee21551` (fix)
3. **Task 3: Route the four zoom/pan buttons through pure range math (Finding 1)** - `299fca9` (fix)

_Plan metadata commit (SUMMARY.md) follows this summary._

## Files Created/Modified

- `src/dashboard/views/trends-zoom-logic.ts` - Added `zoomStepRange`, `panStepRange`, `buildZoomPluginOptionsShape`; deleted `panDeltaPx`; rewrote stale D-12 doc comments
- `src/dashboard/views/trends-zoom-logic.test.ts` - Replaced `panDeltaPx and zoomFactor` describe block with `zoomStepRange and panStepRange` (12 tests pinned to Round 1 date strings), added `buildZoomPluginOptionsShape` (4 tests) and `chartjs-plugin-zoom option lookup contract` (2 tests) describe blocks
- `src/dashboard/views/chart-zoom.ts` - `buildZoomPluginOptions` reduced to a thin adapter delegating to `buildZoomPluginOptionsShape`; all four button handlers rewired off `chart.zoom()`/`chart.pan()` onto `zoomStepRange`/`panStepRange` + `applyRange` + `settle()`; stale Pitfall-3/footer comments rewritten to match

## Decisions Made

- Confirmed by reading the vendored source directly (not trusting the plan's line numbers): every read of `onZoomComplete`/`onPanComplete` in `chartjs-plugin-zoom@2.2.0` is qualified by `.zoom.`/`.pan.` (lines 388, 616, 630, 649, 665, 674, 677, 767, 800) — no unqualified `state.options.onZoomComplete` form exists anywhere in the file, confirming Finding 10's fix is complete and the source-text guard's negative assertion is sound.
- Verified all pinned date-string expectations (`Oct 2025 to Jun 2026`, `Feb 2025 to Aug 2026`, `May 2025 to May 2026`) by computing the exact arithmetic in Node before writing the implementation, rather than deriving the implementation from the expected strings backwards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a literal `panDeltaPx` mention surviving in a doc comment**
- **Found during:** Task 1
- **Issue:** After deleting `panDeltaPx`, one doc comment on `panStepRange` still said "the retired `panDeltaPx`", which would have failed the task's own acceptance grep (`grep -c "panDeltaPx" trends-zoom-logic.ts` must output `0`, comments included).
- **Fix:** Reworded the comment to describe the retired pixel-space handler without naming it.
- **Files modified:** `src/dashboard/views/trends-zoom-logic.ts`
- **Verification:** `grep -c "panDeltaPx" src/dashboard/views/trends-zoom-logic.ts` outputs `0`.
- **Committed in:** `fc5a842` (Task 1 commit)

**2. [Rule 1 - Bug] Removed a literal `ZOOM_FACTOR` mention surviving in a Task 3 doc comment**
- **Found during:** Task 3
- **Issue:** A new explanatory comment above the button handlers used the literal text `ZOOM_FACTOR (1.5)`, which would have failed Task 3's own unfiltered acceptance grep (`grep -c "panDeltaPx\|ZOOM_FACTOR" chart-zoom.ts` must output `0`).
- **Fix:** Reworded to "the old 1.5 zoom factor" — same meaning, no literal identifier match.
- **Files modified:** `src/dashboard/views/chart-zoom.ts`
- **Verification:** `grep -c "panDeltaPx\|ZOOM_FACTOR" src/dashboard/views/chart-zoom.ts` outputs `0`.
- **Committed in:** `299fca9` (Task 3 commit)

**3. [Rule 3 - Blocking] Symlinked `node_modules`, `data/dashboard` and `data/stats` into the worktree for verification only**
- **Found during:** Task 1 setup
- **Issue:** This git worktree has no `node_modules` (never installed) and is missing the gitignored `data/dashboard`/`data/stats` directories that 5 test files and `build-widgets` read from disk, blocking every `<verify>` command in this plan.
- **Fix:** Verified `package-lock.json` is byte-identical between the worktree and the main checkout, then symlinked `node_modules`, `data/dashboard` and `data/stats` from the main repo into the worktree (no install run, no new dependency introduced — matches the Package Legitimacy Gate's exclusion scope, since nothing was installed). All three symlinks are untracked and excluded by `.gitignore`'s `node_modules/`/`data/stats/`/`data/dashboard/` rules; none were staged or committed.
- **Files modified:** none (symlinks only, outside git)
- **Verification:** `npx vitest run`, `npx tsc --noEmit`, `npm test` and `npm run build-widgets` all ran and exited 0 through these symlinks.
- **Committed in:** N/A (not a tracked change)

### Plan-Ordering Note (not a deviation, documented for the record)

Tasks 1-3 are tightly coupled through a single shared file (`chart-zoom.ts`): Task 1 deletes `panDeltaPx` from the pure module that `chart-zoom.ts`'s button handlers were the only caller of, so `npx tsc --noEmit` — listed in both Task 1's and Task 2's own `<acceptance_criteria>` — could not pass in isolation until Task 3's button-handler rewire also landed. This is a plan-sequencing property of a 3-task change that necessarily spans one shared file, not a code defect. `npx tsc --noEmit` was red between the Task 1 and Task 3 commits and green from Task 3's commit onward, confirmed by running it again after the Task 3 commit landed. Full `npx tsc --noEmit && npm test && npm run build-widgets` — the plan's own top-level `<verification>` — all exit 0 at the final state.

### Structural grep count note (not a deviation)

Task 3's acceptance criteria expect `grep -c "zoomStepRange"` (comment-filtered) to output `2` ("the `+` and `−` handlers"). The actual count is `3`: the import line (`zoomStepRange,`) plus the two handler call sites. Same for `panStepRange` (`3`, not `2`). This is expected given the plan's own filtered-grep does not exclude import statements, and does not indicate any missing or extra call site — both handlers correctly call the pure function exactly once each, confirmed by reading the diff directly.

---

**Total deviations:** 2 auto-fixed (both Rule 1, doc-comment wording), 1 auto-fixed (Rule 3, verification-environment symlinks), plus 2 documented non-deviation notes explaining expected transient/count discrepancies against the plan's own acceptance criteria.
**Impact on plan:** All auto-fixes are cosmetic (comment wording) or environment-only (symlinks, no tracked changes, no installs). No scope creep. The final committed state fully satisfies every task's `<behavior>`, `<action>` and the plan's top-level `<verification>` and `<success_criteria>`.

## Issues Encountered

None beyond the plan-ordering and grep-count notes documented above.

## Notes for 23-11 (gap-closure re-verification, per this plan's `<output>` spec)

- The verification-map row keyed `23-01/T3` with the filter `-t "panDeltaPx|zoomFactor"` is now **stale** and must be re-keyed to `-t "zoomStepRange and panStepRange"` (the describe block's new name; `panDeltaPx` no longer exists anywhere in `src/`, confirmed by `grep -rn "panDeltaPx" src/` returning no matches).
- Three new automated commands this plan adds, for 23-11's Per-Task Verification Map (paste exactly):
  - `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "zoomStepRange and panStepRange"`
  - `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "buildZoomPluginOptionsShape"`
  - `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "chartjs-plugin-zoom option lookup contract"`
- Not verified by this plan, and deliberately so (transferred in full to 23-11's browser checkpoint per the threat register's T-23-GC-REPUD disposition): that a real ⌘+wheel or a real drag now updates the `aria-label`, reveals Reset, and moves the Cadence & HR sibling band. No test in this repository can construct a `Chart` under `environment: 'node'`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TRN-02 and TRN-04's remaining Pending status (blocked on R8, R11, R16) is now backed by a green automated suite; the actual re-verification of those three rows is 23-11's browser checkpoint, not this plan's job.
- `panDeltaPx` no longer exists anywhere in `src/` (confirmed via repo-wide grep), satisfying the plan's top-level success criterion.
- Full `npx tsc --noEmit`, `npm test` (54 files / 1326 tests — baseline 1313 plus this plan's 13 new tests), and `npm run build-widgets` all exit 0 at the plan's final commit.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/dashboard/views/trends-zoom-logic.ts
- FOUND: src/dashboard/views/trends-zoom-logic.test.ts
- FOUND: src/dashboard/views/chart-zoom.ts
- FOUND commit: fc5a842 (feat(23-08): add zoomStepRange/panStepRange, retire panDeltaPx)
- FOUND commit: ee21551 (fix(23-08): nest onZoomComplete/onPanComplete inside zoom/pan)
- FOUND commit: 299fca9 (fix(23-08): route zoom/pan buttons through pure range math)
- Confirmed `grep -rn "panDeltaPx" src/` returns no matches
