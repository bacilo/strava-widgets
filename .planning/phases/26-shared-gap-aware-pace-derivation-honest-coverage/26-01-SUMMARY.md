---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 01
subsystem: analytics
tags: [pace-derivation, coverage-accounting, gap-classification, vitest, honest-coverage]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "CanonicalStream contract (stream.types.ts), validateStreamSeries (best-effort-utils.ts), trimp.ts purity/header precedent"
provides:
  - "classifyGaps(t, d, options?) — segments a stream into recording-gap/pause/covered by strict priority, summing exactly to the stream's own span"
  - "advanceIntervals(t, d) and quantile(sortedAsc, q) — the R-7 quantile implementation Phase 28's PR plausibility ceiling will reuse"
  - "RECORDING_GAP_ABS_THRESHOLD_SEC (10) and PAUSE_GAP_P90_MULTIPLIER (5) exported constants"
  - "Permanent in-suite negative-case pins for D-05 (absolute pause threshold trap) and D-07 (the dd<=0 silent drop)"
affects: [26-02, 26-03, 26-04, 26-09, "27 (Phase 27's index additivity and quality badges)", "28 (PR plausibility ceiling reuses quantile)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strict-priority segment classification (recording-gap > pause > covered) rather than independent overlapping checks, to preserve an exact-sum identity"
    - "Total, never-throwing pure function contract guarded by validateStreamSeries, returning a zeroed result rather than throwing"

key-files:
  created:
    - src/analytics/pace-derivation.ts
    - src/analytics/pace-derivation.test.ts
  modified: []

key-decisions:
  - "D-06: coverage denominator is the stream's own span (t[n-1]-t[0]), never activity metadata's elapsed_time, since CanonicalStream carries no such field"
  - "D-04/D-05: pause threshold is scale-relative (multiplier x p90 of the activity's own advance-interval distribution), not absolute — an absolute 30s rule misclassifies 96.9% of a real stream that has no recording gap at all"
  - "Classification priority is strict (recording-gap checked before pause) so no segment can be double-counted, preserving coveredSec + recordingGapSec + pauseSec === spanSec exactly"

patterns-established:
  - "Demonstrated-failing negative case embedded as a local replica function (brokenCoverageFromDdSkip) inside the permanent test suite, rather than a throwaway script — the regression stays pinned"

requirements-completed: [PACE-02, COV-01]

# Metrics
duration: ~15min
completed: 2026-09-08
---

# Phase 26 Plan 01: Shared Gap-Aware Pace Derivation & Honest Coverage — Classification Half Summary

**`classifyGaps` in `src/analytics/pace-derivation.ts` classifies every stream segment into exactly one of recording-gap/pause/covered by strict priority, closing the 964-of-3,394-second silent drop in the shipped pace histogram and permanently pinning both the fixed dd<=0 bug and the absolute-pause-threshold misclassification trap as in-suite negative tests.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-08T21:58:56Z (base commit)
- **Completed:** 2026-09-08T22:08:54Z
- **Tasks:** 2 completed
- **Files modified:** 2 created

## Accomplishments

- `classifyGaps(t, d, options?)` exactly accounts every second of a stream's span into `recording-gap` / `pause` / `covered`, with the exact-sum identity `coveredSec + recordingGapSec + pauseSec === spanSec` holding by construction, verified with strict `toBe` (not `toBeCloseTo`) on two real archive streams and a hand-derived synthetic multi-category fixture.
- The pause rule is scale-relative (multiplier × p90 of the activity's own distance-advance-interval distribution), demonstrated correct against real activity 5059204779 (samples every 2s, max Δt of 7s, 97% of elapsed time inside distance-flat runs) — the exact case an absolute distance-flat threshold would misclassify.
- `advanceIntervals` and `quantile` (R-7 linear interpolation, matching numpy/D3's default) are exported standalone, ready for Phase 28's PR plausibility ceiling to reuse without reimplementing.
- Two permanent regression pins live in the test suite: `brokenCoverageFromDdSkip` (a verbatim replica of `detail-zones.ts`'s located defect) is observed leaving 900-1,000s unaccounted on real activity 4556693525, and the absolute 30s pause rule is observed misclassifying >90% of real activity 5059204779 as paused.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pace-derivation.ts with the segment-priority classifier and exact coverage accounting** - `c8d5faf7` (feat)
2. **Task 2: Stage negative cases 2 and 5 failing, then pin the exact-sum invariant** - `d754c9f0` (test)

**Plan metadata:** `678165ca` (docs: log pre-existing unrelated test failures as deferred)

_Note: Task 2 is `tdd="true"` at the level of embedding a demonstrated-failing negative-case replica (`brokenCoverageFromDdSkip`) permanently inside the test suite, not classic test-before-implementation — Task 1's implementation is a prerequisite import for Task 2's positive assertions, per the plan's own task ordering. See "TDD Gate Compliance" below._

## Files Created/Modified

- `src/analytics/pace-derivation.ts` (262 lines) - `classifyGaps`, `advanceIntervals`, `quantile`, `RECORDING_GAP_ABS_THRESHOLD_SEC`, `PAUSE_GAP_P90_MULTIPLIER`, and the `GapKind`/`GapInterval`/`PaceCoverage`/`PauseRule` types. Pure, client-safe (no `fs`/`fetch`/DOM), header mirrors `trimp.ts`'s purity/Δt-integration discipline.
- `src/analytics/pace-derivation.test.ts` (206 lines) - 10 tests: the two demonstrated-failing negative cases (D-05, D-07), the exact-sum identity on two real streams plus a hand-derived synthetic fixture, and four totality (never-throws) cases.

## Decisions Made

- Confirmed via direct re-measurement against the committed archive (re-derived independently in this session, not merely trusted from planning docs) that the measured figures cited in the plan hold: 4556693525's `dd<=0` skip leaves exactly 964s unaccounted (28.4% of 3,394s span); 5059204779's absolute-30s pause rule reads 96.86% paused despite a 7s max Δt; 11544429866's two recording gaps (464s + 127,478s) sum to 127,942s, exceeding the 120,000s floor asserted in the test.
- Used a two-pointer maximal-flat-run precomputation (`computeFlatRunDurations`) rather than a per-segment lookahead, so a single long distance-flat run is judged as one duration rather than as independent short segments — this is the mechanism D-05's discriminator depends on.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria (grep-based structural checks, `tsc --noEmit`, `vitest run`) all pass as specified.

## Issues Encountered

**Acceptance-criteria self-collision on `data/stats` grep:** the test file's own header comment, written to explain what `data/stats/` is and why it's not read, initially caused `grep -c "data/stats" pace-derivation.test.ts` to return 2 instead of the required 0 — the criterion is a literal string check with no comment-awareness. Reworded both mentions to describe the derived-stats directory without spelling the literal path string; re-verified `grep -c "data/stats"` returns 0 and the suite still passes 10/10.

**Pre-existing unrelated test failures in this fresh worktree:** `npm run test` after Task 2 shows 7 failing test files (6 on `ENOENT` reading gitignored `data/stats/*.json` computed artifacts absent until the compute pipeline runs; 1 on a missing `node_modules/chartjs-plugin-zoom` dist file). None import or touch `pace-derivation.ts`. Confirmed out of scope per the deviation rules' scope boundary and logged to `deferred-items.md` rather than fixed. `npx tsc --noEmit` is clean and the plan's own verification command (`npx vitest run src/analytics/pace-derivation.test.ts`) exits 0 with 10/10 passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `classifyGaps`, `advanceIntervals`, and `quantile` are ready for plan 26-02 (the pace-series half of the same module, per D-16's single-entry-point requirement) to compose in the same wave.
- The two demonstrated-failing negative cases stay in the permanent suite as regression guards — any future change that reintroduces the `dd<=0` skip or an absolute pause threshold will fail these tests immediately.
- Blocker/concern: the 7 pre-existing unrelated test failures noted above are an environment gap in this fresh worktree (missing `data/stats/` compute output, missing `chartjs-plugin-zoom` dist file), not a defect introduced by this plan — worth flagging to the orchestrator so it isn't mistaken for a regression when the wave's results are merged and re-tested against the integrated tree.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*
