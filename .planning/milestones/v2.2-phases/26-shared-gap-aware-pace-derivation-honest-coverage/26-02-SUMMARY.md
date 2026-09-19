---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 02
subsystem: analytics
tags: [pace-derivation, adaptive-window, gap-clipping, coverage, vitest]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "classifyGaps/advanceIntervals/quantile (26-01) and the named ERA-03 fixture library (26-03)"
provides:
  - "adaptiveWindowSec(t, d) — per-activity averaging window width, max(20, 2.5 x p90(advance intervals))"
  - "derivePaceSeriesGapAware(t, d, options) — the centred windowed pace series, clipped at gap boundaries by default"
  - "derivePaceWithCoverage(stream, options?) — the single D-16 entry point returning pace series, coverage and window width together"
  - "paceHistogramSamples(t, paceSeries) — the Δt-weighted histogram-input primitive, weight-identical to computePaceDistribution"
  - "interpValueAtTime — moved here verbatim from detail-charts-logic.ts, exported"
affects: [26-04, 26-05, 26-06, 26-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Running-max/running-min clamp over a small sorted gapIntervals array per sample, rather than a binary search, since gap counts are small relative to sample counts"
    - "D-16 single-return-value contract: no exported function anywhere in this module lets a caller obtain a pace series without the coverage it was derived under"

key-files:
  created: []
  modified:
    - src/analytics/pace-derivation.ts
    - src/analytics/pace-derivation.test.ts

key-decisions:
  - "D-02/D-03: PACE_WINDOW_FLOOR_SEC stays at 20 (not unfloored to ~10s for 4556693525) because the floored configuration is what PACE-03/06's cited figures were measured under; diverging without re-deriving those figures would violate D-03"
  - "'Coverage' in the fastMassAndCoverage test helper is the fraction of the stream's own span that a WINDOWED estimate resolved to non-null (totalT / spanSec via paceHistogramSamples), not PaceCoverage.coveredSec / spanSec — the latter is window-independent (classifyGaps never sees windowSec) and would report ~100% under both the fixed and adaptive windows, which cannot reproduce the fixed-window distortion the plan requires demonstrating. This is a correction to the plan's own helper description, discovered by direct re-measurement (see Deviations)."

requirements-completed: [PACE-02, PACE-03]

# Metrics
duration: ~25min
completed: 2026-09-08
---

# Phase 26 Plan 02: Adaptive Gap-Clipped Pace Series & D-16 Entry Point Summary

**Adaptive per-activity averaging window (`max(20, 2.5 x p90(advance intervals))`) that clips at gap boundaries and welds pace to coverage in one `derivePaceWithCoverage` return value, recovering three activities a fixed 20s window wrongly declared "beyond repair."**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 1 (extended; no new files, as instructed)

## Accomplishments

- `adaptiveWindowSec` resolves each activity's own averaging window from its distance-advance-interval distribution, measured against all four profile activities: 5059204779 -> 150.00s, 3647739864 -> 221.00s, 4598855187 -> 247.50s, 4556693525 -> 20.00s (floor engaged) — all within this plan's stated bands, three landing at or within a fraction of a second of the exact target.
- `derivePaceSeriesGapAware` reuses `derivePaceSeries`'s exact body (both `null` guards, interpolated window edges) and adds gap clamping: window bounds clip forward/backward at the nearest gap boundary by default, and any sample strictly inside a gap resolves to `null`; `clipAtGaps: false` exists solely to demonstrate the pre-clip distortion in a permanent in-suite test.
- `derivePaceWithCoverage` is the sole entry point (D-16): it calls `classifyGaps` once, resolves the window, derives the gap-clipped series, and returns `{ paceSeries, coverage, windowSec }` together — no exported function in this module lets a caller obtain pace without coverage. Never throws on an invalid stream (T-26-01).
- `paceHistogramSamples` reproduces `computePaceDistribution`'s exact Δt weighting, so plan 26-04's histogram will be weight-identical to today's shipped one.
- The fixed-20s distortion is reproduced and pinned as a permanent negative case, then the adaptive recovery is asserted on the same real streams — in that demonstrated-failing order, per plan instruction.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the adaptive window, gap-clipped series, and D-16 single entry point** - `4cb90787` (feat)
2. **Task 2: Stage negative cases 1 and 3 failing, then pin adaptive recovery on all four measured profiles** - `5c25c1bd` (test)

**Plan metadata:** commit pending (this SUMMARY, executed by the orchestrator after wave merge in worktree mode)

_Note: Task 2 is `tdd="true"` at the level of embedding demonstrated-failing negative cases (fixed-20s distortion, gap-bridging) permanently inside the test suite, not classic test-before-implementation — Task 1's implementation (`derivePaceWithCoverage`, `derivePaceSeriesGapAware`, `adaptiveWindowSec`, `paceHistogramSamples`) is a prerequisite import for Task 2's assertions, per the plan's own task ordering. This mirrors 26-01's established precedent for this same file. See "TDD Gate Compliance" below._

## Files Created/Modified

- `src/analytics/pace-derivation.ts` (262 -> 495 lines) — added `PACE_WINDOW_P90_MULTIPLIER`, `PACE_WINDOW_FLOOR_SEC`, `interpValueAtTime`, `adaptiveWindowSec`, `derivePaceSeriesGapAware`, `PaceDerivationResult`, `derivePaceWithCoverage`, `paceHistogramSamples`. Still pure (no `fs`/`fetch`/DOM); the `CanonicalStream` type import is type-only.
- `src/analytics/pace-derivation.test.ts` (206 -> 423 lines) — added a `derivePaceWithCoverage — adaptive window, gap clipping, D-16 entry point` describe block: negative case 1 (fixed-20s distortion), positive adaptive recovery, four `adaptiveWindowSec` profile assertions, two recovery assertions, negative case 3 (unclipped gap bridging vs. clipped match), the interval-session tolerance check, and the standstill null-never-zero check. 22 tests total in this file, 56 combined with `pace-fixtures.test.ts`.

## Measured Figures (stated under the window they were measured with, per 26-CONTEXT.md)

| Activity | `adaptiveWindowSec` (measured) | Target band | Fixed-20s fast mass / coverage (measured) | Adaptive fast mass / coverage (measured) |
|---|---|---|---|---|
| 5059204779 | 150.00s | 142-158s | 94.80% / 30.44% | 1.17% / 97.12% |
| 3647739864 | 221.00s | 200-240s | 59.65% / 38.94% | 0.62% / 100.00% |
| 4598855187 | 247.50s | 235.5-259.5s | 42.72% / 45.01% | 0.00% / 100.00% |
| 4556693525 | 20.00s (floor) | exactly 20s | 2.42% / 100.00% (floor already engaged, no fixed-vs-adaptive delta) | 2.42% / 100.00% |

"Coverage" above is the fraction of the stream's own span that a windowed pace estimate resolved to non-null (`totalT / spanSec` via `paceHistogramSamples`), not `PaceCoverage.coveredSec / spanSec` — see Decisions.

Gap-boundary demonstration (`syntheticRecordingGapStream`, `windowSec: 40`, index at `t=200`, immediately before the 200-500s recording gap): unclipped pace 666.67 sec/km (window bridges 20s into the gap's flat-interpolated boundary); clipped pace 333.33 sec/km, exactly matching the pre-gap segment computed alone (333.33 sec/km, diff 0).

Interval-session (`syntheticIntervalSessionStream`, adaptive window resolved to 20s — floor engaged, dense 2s sampling): index 20 (t=40s, inside the first fast rep) resolved to 210.08 sec/km (target 210, diff 0.08); index 60 (t=120s, inside the first slow rep) resolved to 390.63 sec/km (target 390, diff 0.63) — both well within the fixture's stated ±20 sec/km tolerance.

Standstill (`syntheticStandstillStream`): all 51 series entries `null`; zero `0` or `Infinity` entries.

## Decisions Made

- Kept `PACE_WINDOW_FLOOR_SEC` at 20 rather than letting the formula run unfloored for 4556693525 (which would give ~10s) — the floored value is the configuration PACE-03/06's cited figures were measured under (D-02, D-03).
- 3647739864's adaptive window measured 221.00s, inside the plan's own stated `[200, 240]` band and consistent with 26-RESEARCH.md Open Question 1's ~4% methodology-variance note against the roadmap's cited ~230s — treated as expected variance, not a defect, per that research note's own instruction.
- Corrected the plan's `fastMassAndCoverage` helper description (`result.coverage.coveredSec / result.coverage.spanSec`) to `totalT / result.coverage.spanSec` (from `paceHistogramSamples`) — see Deviations below for the reasoning and verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the `fastMassAndCoverage` test helper's covered-fraction formula**
- **Found during:** Task 2, while measuring the demonstrated-failing fixed-20s case on real 5059204779 before trusting it.
- **Issue:** The plan's task text states the helper computes "the covered fraction (`result.coverage.coveredSec / result.coverage.spanSec`)". That value comes from `classifyGaps`, which is entirely independent of `windowSec` — it never sees the averaging window. Implementing the helper literally as written produced ~100% coverage under BOTH the fixed-20s and adaptive windows for 5059204779 (confirmed by direct measurement: 100.00% / 100.00%), which cannot reproduce the plan's own stated demonstrated-failing target of 30.4% coverage under the fixed window vs. 97.1% under adaptive — the two numbers would be identical and the negative case would be unwritable as specified.
- **Fix:** Implemented the covered fraction as `totalT / result.coverage.spanSec`, where `totalT` is the sum of `paceHistogramSamples`' weighted time (i.e., the fraction of the stream's own span that the WINDOWED pace estimate actually resolved to non-null). Re-measured against real 5059204779 and got 30.44% (fixed-20s) / 97.12% (adaptive) — matching the plan's stated targets (30.4% / 97.1%) almost exactly, confirming this is the formula the plan's own cited figures were actually produced with.
- **Files modified:** `src/analytics/pace-derivation.test.ts`
- **Verification:** All four profile activities' fast-mass/coverage pairs measured under this corrected formula land within the plan's stated bands (see Measured Figures table above); `npx vitest run src/analytics/pace-derivation.test.ts` passes 22/22.
- **Committed in:** `5c25c1bd` (Task 2's commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** A correction to a test helper's own internal formula, caught by re-deriving the plan's own measured targets before trusting the assertion, per the plan's own "demonstrated-failing order" instruction. No change to `pace-derivation.ts`'s production code; no scope creep.

## TDD Gate Compliance

This plan's Task 2 is `tdd="true"` but is a demonstrated-failing-negative-case pin, not a classic RED-then-GREEN cycle: Task 1 (`feat`, `4cb90787`) shipped the implementation first, and Task 2 (`test`, `5c25c1bd`) added the tests after, per the plan's own explicit task ordering (Task 1 is a prerequisite import for Task 2's positive assertions). This mirrors 26-01's identical precedent for the same file. Standard RED->GREEN gate sequence (test commit before feat commit) does not apply here by plan design; no gate-sequence warning is raised.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `derivePaceWithCoverage`, `derivePaceSeriesGapAware`, `adaptiveWindowSec`, `paceHistogramSamples`, and `interpValueAtTime` are all exported and ready for plan 26-04 to consume (re-exporting `interpValueAtTime`/`derivePaceSeries` from `detail-charts-logic.ts` rather than keeping a second copy, and wiring the dashboard's chart/histogram render paths to the shared module).
- `clipAtGaps` and explicit `windowSec` exist only as test-only overrides (T-26-06) — plan 26-05's single-source audit should confirm neither literal appears in any non-test file outside `pace-derivation.ts`.
- Pre-existing unrelated test failures noted in 26-01's SUMMARY (missing `data/stats/*.json`, missing `chartjs-plugin-zoom` dist file — 7 test files, environment gap in this fresh worktree) persist unchanged; `npm run test` shows 1524 passing / 0 new failures beyond those 7 pre-existing ones. Not a regression introduced by this plan.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/analytics/pace-derivation.ts
- FOUND: src/analytics/pace-derivation.test.ts
- FOUND: .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-02-SUMMARY.md
- FOUND: 4cb90787 (feat: adaptive gap-clipped pace series and D-16 entry point)
- FOUND: 5c25c1bd (test: negative cases and adaptive recovery pins)
