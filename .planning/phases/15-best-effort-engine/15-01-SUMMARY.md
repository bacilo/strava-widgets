---
phase: 15-best-effort-engine
plan: 01
subsystem: analytics
tags: [typescript, vitest, tdd, best-effort, two-pointer-sweep]

# Dependency graph
requires:
  - phase: 14-stream-ingestion-foundation
    provides: CanonicalStream schema (t/d arrays, distanceSource) and manifest-driven stream availability
provides:
  - Locked best-effort data contracts (best-effort.types.ts) consumed by plans 02/03/04 and Phases 16-18
  - Pure two-pointer O(n) sweep with exact-crossing interpolation (findBestEffort)
  - Series validator rejecting malformed t/d input with a named reason (validateStreamSeries)
  - Implausibility guards against max_speed and world-record ceilings (isPlausible)
  - Chronological PR marking (markPRs) and tie-broken top-N ranking (rankTopN)
affects: [15-02, 15-03, 15-04, 16-dashboard-shell, 18-records-and-trends]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure module (best-effort-utils.ts) + contracts module (best-effort.types.ts) split, mirroring streak-utils.ts"
    - "TDD RED-GREEN per task for algorithmic/guard logic"

key-files:
  created:
    - src/analytics/best-effort.types.ts
    - src/analytics/best-effort-utils.ts
    - src/analytics/best-effort-utils.test.ts
  modified: []

key-decisions:
  - "Reworded doc comments to avoid the substrings 'lat'/'lng'/'polyline' entirely (even inside prose like 'interpolated' and 'relative') to satisfy the plan's literal grep-based acceptance gate for best-effort.types.ts"

patterns-established:
  - "World-record reference constants live in a small, inline-cited table (WORLD_RECORD_SPEED_MPS) rather than embedded magic numbers"

requirements-completed: [REC-01]

# Metrics
duration: 30min
completed: 2026-08-10
---

# Phase 15 Plan 01: Best-Effort Contracts and Pure Sweep Summary

**Two-pointer O(n) best-effort sweep with exact-crossing linear interpolation, timestamp-indexed durations, max_speed/world-record implausibility guards, and chronological PR marking — all pure functions with zero I/O.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-10T14:55:00Z (approx.)
- **Completed:** 2026-08-10T15:23:39Z
- **Tasks:** 3
- **Files modified:** 3 (all newly created)

## Accomplishments
- Locked the seven target racing distances and the full `BestEffortsDocument` output contract in `best-effort.types.ts`, ready for plans 02-04 and Phases 16-18 to build against without reading implementation code.
- Implemented the two-pointer O(n) sweep (`findBestEffort`) with exact-crossing linear interpolation — verified against a 200,000-sample synthetic series completing well under 2 seconds, and against real pause-gap scenarios (10-minute stream gap) proving timestamp-indexing rather than index-counting.
- Implemented `validateStreamSeries` covering length mismatch, non-finite values, and decreasing `t`/`d`, satisfying threat T-15-01.
- Implemented `isPlausible` with a graceful degrade when `activityMaxSpeedMps` is falsy (the real archive case, activity `11865310195`), satisfying threat T-15-04.
- Implemented `markPRs` (chronological PR marking, order-independent, ties do not create a new record) and `rankTopN` (1-based rank, tie-broken by earlier `startDate`).

## Task Commits

Each task was committed atomically, TDD tasks producing separate RED/GREEN commits:

1. **Task 1: Lock the best-effort contracts** - `559b4a3` (feat)
2. **Task 2: Build the two-pointer sweep and the series validator** - `8b039f1` (test/RED), `b4254a5` (feat/GREEN)
3. **Task 3: Add the implausibility guards, PR marking and top-N ranking** - `29b196c` (test/RED), `749028e` (feat/GREEN)

_No REFACTOR commits were needed — GREEN implementations were already clean._

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified
- `src/analytics/best-effort.types.ts` - Target distance table, `RawEffort`/`PlausibilityResult`/`ComputedEffort`/`BestEffort`/`ActivityBestEfforts`/`PRRankingEntry`/`RejectedEffort`/`BestEffortsDocument` contracts (135 lines, 12 exports)
- `src/analytics/best-effort-utils.ts` - `validateStreamSeries`, `findBestEffort`, `isPlausible`, `markPRs`, `rankTopN`, plus `MAX_SPEED_MARGIN`/`TOP_N`/`WORLD_RECORD_SPEED_MPS` constants (200 lines)
- `src/analytics/best-effort-utils.test.ts` - 30 tests covering every behavior in the plan's `<behavior>` blocks across both TDD tasks (288 lines)

## Decisions Made
- Reworded three doc-comment sentences in `best-effort.types.ts` to avoid the literal substrings "lat"/"lng"/"polyline" (e.g., "interpolated" → "computed at the exact crossing", "relative to" → "measured from", "carries no lat/lng" → "carries no coordinate data") because the plan's acceptance criteria uses a literal `grep -Ec "lat|lng|polyline"` check that also matches these substrings inside unrelated English words. No functional change — purely a wording adjustment to satisfy the mandated acceptance gate.

## Deviations from Plan

None - plan executed exactly as written. The doc-comment wording adjustment above is not a deviation from planned functionality; it is compliance work to pass the plan's own literal acceptance-criteria grep pattern.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `best-effort.types.ts` and `best-effort-utils.ts` are ready for plan 02 (the I/O-orchestrating `compute-best-efforts.ts`) to consume directly — no further contract changes expected.
- All threat-model mitigations assigned to this plan (T-15-01, T-15-03, T-15-04) are implemented and covered by dedicated unit tests.
- Full test suite (166 tests) is green with no regressions against the pre-existing 136.

---
*Phase: 15-best-effort-engine*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: src/analytics/best-effort.types.ts
- FOUND: src/analytics/best-effort-utils.ts
- FOUND: src/analytics/best-effort-utils.test.ts
- FOUND: .planning/phases/15-best-effort-engine/15-01-SUMMARY.md
- FOUND commits: 559b4a3, 8b039f1, b4254a5, 29b196c, 749028e
- Re-ran plan-level `<verification>`: `npx tsc --noEmit` exit 0; `npx vitest run src/analytics/best-effort-utils.test.ts` 30/30 passing; full suite `npx vitest run` 166/166 passing (no regressions vs. 136 baseline); zero `node:fs`/`node:path`/`src/geo/` imports in best-effort-utils.ts
- Re-ran all task-level `<acceptance_criteria>`: all passing (see task commits)
