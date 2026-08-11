---
phase: 18-records-trends-differentiators
plan: 03
subsystem: analytics
tags: [trimp, training-load, ctl-atl-tsb, heart-rate, pure-functions, vitest]

# Dependency graph
requires:
  - phase: 14-stream-ingestion-foundation
    provides: "CanonicalStream { t, hr } committed per-activity streams"
  - phase: 17-activity-browser-detail-views
    provides: "AthleteHrZone / parseAthleteConfig athlete-config validation chokepoint"
provides:
  - "edwardsTrimp / banisterTrimp / zoneForHr / computeActivityTrimp (src/analytics/trimp.ts) — decimation-invariant TRIMP over a decimated HR stream"
  - "buildDailySpine / decayStep / computeCtlAtlTsb (src/analytics/training-load.ts) — continuous calendar-day CTL/ATL/TSB recursion"
  - "TrainingLoadDocument / DailyLoadEntry / TRAINING_LOAD_SCHEMA_VERSION (src/analytics/training-load.types.ts) — the published document contract plan 18-07's build step will emit"
affects: ["18-07 (compute-training-load.ts build step)", "18-10/18-11 (Trends training-load tab UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-Δt segment integration over decimated streams (mirrors detail-charts-logic.ts / detail-zones.ts) applied to a third consumer (TRIMP)"
    - "Continuous calendar-day spine walk — first daily-date-spine helper in the codebase (no prior analog existed in date-utils.ts)"
    - "Mutation-check discipline documented inline via JSDoc naming the exact defect class (Pitfall N) each formula guards against"

key-files:
  created:
    - src/analytics/trimp.ts
    - src/analytics/trimp.test.ts
    - src/analytics/training-load.ts
    - src/analytics/training-load.types.ts
    - src/analytics/training-load.test.ts
  modified: []

key-decisions:
  - "TSB capture happens before the day's ctl/atl update, not after (D-16/Pitfall 4) — proven with an explicit mutation check"
  - "buildDailySpine walks every calendar day, not activity days (Pitfall 3) — proven with a 60-day-gap strict-decrease test"
  - "computeActivityTrimp returns null (not a zero/estimate) when stream.hr is absent, matching D-15's 'nothing is invented' rule"

patterns-established:
  - "Every pure formula module states its guarded-against defect class (Pitfall N) directly in a JSDoc header, and its test suite includes both a positive proof and a manual mutation-check recorded in the plan's SUMMARY"

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-08-11
---

# Phase 18 Plan 03: Training Load Formulas (TRIMP + CTL/ATL/TSB) Summary

**Edwards and Banister TRIMP integrating by real elapsed Δt over decimated HR streams, plus a continuous calendar-day CTL/ATL/TSB recursion with a day-1-lag TSB — both proven decimation-invariant and gap-correct by tests with matching mutation checks.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-11T19:26:00Z (approx, worktree base commit)
- **Completed:** 2026-08-11T19:33:32Z
- **Tasks:** 2/2
- **Files modified:** 5 (all new)

## Accomplishments
- `src/analytics/trimp.ts` — `zoneForHr`, `edwardsTrimp`, `banisterTrimp`, `computeActivityTrimp`, all pure and total (never throw, never NaN, degrade to 0/null)
- `src/analytics/training-load.ts` — `buildDailySpine`, `decayStep`, `computeCtlAtlTsb`, walking every calendar day including rest days/gaps
- `src/analytics/training-load.types.ts` — `TrainingLoadDocument` published-artifact contract, structurally excluding `restingHr`/`sex`/`birthDate`
- Both RESEARCH-identified silent-wrongness defect classes (Pitfall 2 uniform-sampling assumption, Pitfall 3 activity-indexed spine, Pitfall 4 same-day TSB) closed by tests that provably fail when the defect is reintroduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Edwards and Banister TRIMP over decimated streams** - `08bcaf0` (feat)
2. **Task 2: Continuous daily spine, CTL/ATL decay, and TSB day-offset** - `bb10bee` (feat)

_No plan-metadata commit in worktree mode — SUMMARY.md is committed separately below per worktree protocol._

## Files Created/Modified
- `src/analytics/trimp.ts` - Edwards/Banister TRIMP formulas over `{t, hr}`, real-Δt segment integration
- `src/analytics/trimp.test.ts` - 14 vitest cases (decimation invariance, non-uniform weighting, zone boundaries, Banister monotonicity/clamping/sex coefficients, degenerate inputs)
- `src/analytics/training-load.ts` - `buildDailySpine`, `decayStep`, `computeCtlAtlTsb`
- `src/analytics/training-load.types.ts` - `TrainingLoadDocument` / `DailyLoadEntry` / `TRAINING_LOAD_SCHEMA_VERSION`
- `src/analytics/training-load.test.ts` - 9 vitest cases (spine continuity incl. leap year and year boundary, gap decay, ATL-faster-than-CTL, TSB day-offset, steady state, time constants)

## Decisions Made
- Followed D-14/D-15/D-16 as specified: Edwards needs no identity input, Banister requires resting HR/max HR/sex and is `null` when absent, no-HR activities contribute nothing (`computeActivityTrimp` returns `null` rather than an estimate).
- `zoneForHr` returns zone 1 for any bpm below zone 1's floor rather than throwing or dropping the sample, per D-15 ("the run still happened").
- `training-load.types.ts`'s header comment states the public-artifact rule explicitly and the acceptance-criteria grep enforces it structurally (T-18-PII-05).

## Deviations from Plan

**None — plan executed exactly as written.** One test-authoring correction was made and resolved within Task 1 before commit (not a deviation from the plan's code requirements): the initial "swapping durations" test case swapped segment *order* rather than swapping which zone received which duration, which is mathematically a no-op for a commutative sum. Corrected to swap the durations assigned to each zone (600s in zone 1 / 60s in zone 5 vs. the original 60s in zone 1 / 600s in zone 5), which does produce a different total (15 vs 51) as the plan's acceptance criteria require. No production code was affected.

One documentation wording adjustment was made in `trimp.ts`'s header comment: the anti-pattern example `total / t.length` was rephrased in prose to avoid tripping the plan's own acceptance-criteria grep (`grep -cE "\.length \* |/ *(t\.length|n)\b"` matches comments as well as code) while preserving the same explanation. No functional code changed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification

- `npm run build && npm test` — 615 tests pass, 0 pre-existing tests regressed.
- Task 1 acceptance-criteria greps: real-Δt integration count ≥2 (found 3), no sample-count weighting (found 0, after rewording a doc comment), no `fs`/`fetch`/`document` usage (found 0).
- Task 2 acceptance-criteria greps: exact exponential form present exactly once, UTC-only date arithmetic (4 matches, ≥2 required), zero local-timezone date methods, zero `restingHr`/`birthDate`/`sex` occurrences outside comments in `training-load.types.ts`.
- **Mutation check 1 (Task 1, Pitfall 2):** replaced `edwardsTrimp`'s `deltaMin = (t[i + 1] - t[i]) / 60` with a hardcoded `deltaMin = 1`. Result: 3 of 14 tests failed, including the decimation-invariance case — `expected 0.9833333333333333 to be less than 0.01` (98.3% relative error between the 1s- and 60s-sampled streams, vs. the required <1%). Reverted; re-ran green (14/14 pass).
- **Mutation check 2 (Task 2, Pitfall 4):** moved the `tsb = ctl - atl` capture in `computeCtlAtlTsb` to after the `ctl`/`atl` `decayStep` calls. Result: the day-1 `tsb === 0` assertion failed — `expected -10.959378690206167 to be +0`. Reverted; re-ran green (9/9 pass).

## Next Phase Readiness
- `src/analytics/trimp.ts` and `src/analytics/training-load.ts` are ready for plan 18-07's `compute-training-load.ts` build step to consume: it sweeps the stream manifest, calls `computeActivityTrimp` per activity, accumulates into a `Map<string, number>` keyed by UTC date, and runs `computeCtlAtlTsb` over the resulting map to produce a `TrainingLoadDocument`.
- No blockers. `TREND-04` remains "Pending" in REQUIREMENTS.md's traceability table by design — per this project's established convention (visible in the Phase 15/16/17 precedent), requirement checkboxes are marked complete only at the phase's validation/human-checkpoint plan, not by the individual plans that partially implement a multi-plan requirement. TREND-04 is claimed by 8 plans in this phase (18-01, 18-03, 18-04, 18-07, 18-10, 18-11, 18-15, 18-16); this plan supplies only the pure formula layer, not the build step or UI.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*
