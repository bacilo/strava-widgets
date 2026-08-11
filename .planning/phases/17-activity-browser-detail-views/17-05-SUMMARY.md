---
phase: 17-activity-browser-detail-views
plan: 05
subsystem: analytics
tags: [pure-functions, pace-histogram, hr-zones, athlete-config, tdd]

# Dependency graph
requires:
  - phase: 14-stream-ingestion-foundation
    provides: CanonicalStream contract (t/d/hr arrays) and validateStreamSeries pre-check pattern
provides:
  - "computePaceDistribution — Δt-weighted pace-distribution histogram, always available for any valid stream"
  - "parseAthleteConfig — the single tolerant, all-or-nothing validation chokepoint for data/config/athlete.json"
  - "computeHrZoneTimes — Δt-weighted HR-zone time breakdown, null when config or HR stream is absent"
affects: [17-07-detail-client-and-config-fetch, 17-13-detail-view-zone-panel-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consecutive-segment Δt-weighting for time-series bucketing (mirrors findBestEffort's exact-crossing discipline from best-effort-utils.ts)"
    - "Total, never-throwing, all-or-nothing config parser with own-property-only reads (mirrors buildExclusionIndex's tolerant-parse discipline)"
    - "Single-rounding-step m:ss formatting to avoid the :60 rollover defect documented on list.ts's formatPace"

key-files:
  created:
    - src/dashboard/views/detail-zones.ts
    - src/dashboard/views/detail-zones.test.ts
  modified: []

key-decisions:
  - "Bucket/zone computation walks consecutive segments [i, i+1], attributing each segment's real Δt rather than counting samples — required because CanonicalStream.t is irregularly spaced (17-RESEARCH.md Pitfall 1)."
  - "parseAthleteConfig reads only own properties (Object.prototype.hasOwnProperty) on both the top-level object and each zone entry, closing the T-17-CFG-01 prototype-pollution path."
  - "computeHrZoneTimes clamps out-of-range HR values to the nearest boundary zone (never drops a sample or indexes outside the fixed 5-entry array) — T-17-STR-03."

patterns-established:
  - "Pattern: DOM-free, fetch-free pure computation modules under src/dashboard/views/ are unit-testable with environment: 'node' (no jsdom needed), enforced here via a grep-based acceptance criterion."

requirements-completed: [DETAIL-05]

# Metrics
duration: 20min
completed: 2026-08-11
---

# Phase 17 Plan 05: Pace Distribution & HR Zone Breakdown Summary

**Δt-weighted pace-distribution histogram and a tolerant, all-or-nothing athlete-config parser feeding Δt-weighted HR-zone time accumulation, both pure and DOM-free in `detail-zones.ts`.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-11T17:13:00+02:00
- **Completed:** 2026-08-11T17:16:10+02:00
- **Tasks:** 2 completed
- **Files modified:** 2 (both created)

## Accomplishments
- `computePaceDistribution` produces a bucketed, time-weighted pace histogram for any validated stream — no configuration required — with bucket totals proven (by test) to sum to the stream's elapsed time within 0.01s.
- `parseAthleteConfig` is now the single validation chokepoint for the future `data/config/athlete.json`, proven against 13 distinct malformed shapes (12 structural cases plus a dedicated prototype-pollution repro) returning `null` in every case.
- `computeHrZoneTimes` returns a stable five-zone breakdown or `null` for both D-31 absence conditions (missing config, missing HR stream), with Δt-weighted attribution, NaN-free percentages, and boundary clamping for out-of-range HR samples.

## Task Commits

Each task followed the RED → GREEN TDD cycle with separate commits:

1. **Task 1: Δt-weighted pace-distribution histogram**
   - `1214f20` (test) — failing tests for bucketing, elapsed-time sum, Δt weighting, label formatting, standstill exclusion, invalid-stream handling
   - `66abf95` (feat) — real `computePaceDistribution` implementation, all 9 tests green
2. **Task 2: Tolerant athlete-config parsing and Δt-weighted HR zone times**
   - `fc15c49` (test) — failing tests for `parseAthleteConfig` (13 malformed cases) and `computeHrZoneTimes` (absence gate, weighting, percent, clamping)
   - `5dc22fe` (feat) — real `parseAthleteConfig`/`computeHrZoneTimes` implementation, all 33 tests green (full file)

**Plan metadata:** committed alongside this summary.

## Files Created/Modified
- `src/dashboard/views/detail-zones.ts` (249 lines) — pure module exporting `PACE_BUCKET_WIDTH_SEC`, `PaceBucket`, `computePaceDistribution`, `AthleteHrZone`, `AthleteConfig`, `parseAthleteConfig`, `ZoneTime`, `computeHrZoneTimes`
- `src/dashboard/views/detail-zones.test.ts` (283 lines) — 33 tests covering every behavior bullet in the plan

## Decisions Made
- Followed the plan's exact implementation contract for both functions; no architectural deviations.
- Added an explicit prototype-pollution regression test (`Object.create({maxHr: 190})`) beyond the plan's literal behavior list, directly exercising the T-17-CFG-01 threat-register mitigation.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<behavior>` bullets, `<action>` contracts, and `<acceptance_criteria>` were implemented and verified as specified.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. This plan does not create `data/config/athlete.json` itself; it only builds the parser that will validate it once a later plan (17-07) fetches it.

## Next Phase Readiness

- `parseAthleteConfig` and `computeHrZoneTimes` are ready for plan 17-07 (browser client / config fetch) to import and for plan 17-13 (detail view zone-panel rendering) to consume.
- `computePaceDistribution` is ready to be wired into the detail view's pace histogram panel with no further gating.
- No blockers. The real `data/config/athlete.json` file does not exist yet — by design (D-31), `computeHrZoneTimes` degrades to `null` and the HR-zone panel is simply omitted until the config is authored.

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*
