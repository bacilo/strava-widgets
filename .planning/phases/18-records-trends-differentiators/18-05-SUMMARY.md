---
phase: 18-records-trends-differentiators
plan: 05
subsystem: analytics
tags: [gear, dashboard-index, aggregate, typescript, vitest]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    provides: dashboard-index.types.ts / compute-dashboard-index.ts (Phase 17's browse-complete index this plan extends), gear-client.ts's parseGearDocument/resolveGearLabel (reused, not re-derived)
provides:
  - "gear-naming.ts: buildGearLabelMap, deterministic gearId -> label resolution with a Shoe-N ordinal fallback"
  - "DashboardIndexRow.gearName field on the published dashboard index, plus DashboardIndexTotals.withGear"
  - "gear-aggregate.types.ts / gear-aggregate-logic.ts / compute-gear-aggregate.ts: data/stats/gear-aggregate.json, the per-shoe rollup the Trends Gear tab (§ 12) reads"
affects: [18-10 (records/trends charts consuming gear-aggregate.json), 18-11 (CLI wiring for compute-gear-aggregate), 18-15 (Gear tab rendering)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass compute-step restructuring: collect all inputs a cross-activity resolution step needs (gear usage) before building any output row, resolve once, then assemble — activity files are still read exactly once"
    - "Time-weighted mean (not row-mean) for aggregate avgHr, matching the archive's variable-duration runs"
    - "Slug key with numeric-suffix de-duplication for label-derived public identifiers"

key-files:
  created:
    - src/analytics/gear-naming.ts
    - src/analytics/gear-naming.test.ts
    - src/analytics/gear-aggregate.types.ts
    - src/analytics/gear-aggregate-logic.ts
    - src/analytics/gear-aggregate-logic.test.ts
    - src/analytics/compute-gear-aggregate.ts
  modified:
    - src/analytics/dashboard-index.types.ts
    - src/analytics/compute-dashboard-index.ts
    - src/analytics/compute-dashboard-index.test.ts
    - src/dashboard/data/index-client.test.ts
    - src/dashboard/views/calendar-logic.test.ts
    - src/dashboard/views/list-logic.test.ts

key-decisions:
  - "Label = trimmed non-empty gearMap[gearId] value, else 'Shoe N' ordinal by first-use date (UTC, Z-suffix normalized), tie-broken by gearId string — deterministic and stable across config edits since ordinal numbering counts every shoe including named ones"
  - "device_name is NOT used as a shoe fallback in the index (unlike the detail view's Gear tile) — would silently fabricate gear coverage the archive does not have"
  - "Unknown bucket in the aggregate is always emitted when count > 0 and always sorted last regardless of distance, so absence reads as residual, never as a competing shoe"
  - "avgHr in the aggregate is moving-time-weighted, not a row-mean, and null (never 0) when no row in a bucket has HR data"

requirements-completed: [TREND-05]

# Metrics
duration: ~30min
completed: 2026-08-11
---

# Phase 18 Plan 05: Gear Naming, Index Field & Per-Shoe Aggregate Summary

**Gear resolved to a human name at build time (Shoe-N ordinal fallback for the archive's 16 currently-blank names), threaded through the published dashboard index as `gearName`, and rolled up into a new `data/stats/gear-aggregate.json` with an always-visible Unknown bucket and honest per-year coverage numbers (62.1% overall, 100% in 2023, 19.4% in 2026).**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-11
- **Tasks:** 3
- **Files modified:** 10 (6 created, 4 modified in the two feature commits, plus 3 pre-existing test fixtures updated for the new required field)

## Accomplishments

- `buildGearLabelMap` — deterministic, pure gear id → label resolution that structurally cannot leak a raw gear id, with a stable "Shoe N" ordinal fallback ordered by first-use date
- `DashboardIndexRow.gearName` now published on every dashboard index row (real name, ordinal, or `null` — never an id); `DashboardIndexTotals.withGear` added
- `compute-dashboard-index.ts` restructured into a two-pass build so the label map sees every activity's gear usage before any row is finalized, without reading any activity file twice
- New `data/stats/gear-aggregate.json` producer: per-shoe distance/runs/time-weighted avg pace & HR/date-range, an always-present Unknown bucket sorted last, and per-calendar-year coverage percentages that make the 2026 intervals.icu pipeline gap visible rather than smoothed away

## Task Commits

Each task was committed atomically:

1. **Task 1: Deterministic gear labelling with a Shoe-N ordinal fallback** - `dbc9fff` (feat)
2. **Task 2: Add gearName to the published dashboard index** - `28081b3` (feat)
3. **Task 3: Per-shoe aggregate compute step with an Unknown bucket and stated coverage** - `a70aa10` (feat)

_No plan-metadata commit yet — this is a worktree-isolated parallel executor; STATE.md/ROADMAP.md are updated centrally by the orchestrator after merge, per the parallel-execution contract._

## Files Created/Modified

- `src/analytics/gear-naming.ts` - `buildGearLabelMap`, `UNKNOWN_GEAR_LABEL`; pure, no I/O
- `src/analytics/gear-naming.test.ts` - 8 tests: all-blank archive state, mixed named/unnamed, null config, whitespace-only names, determinism/tie-breaking, Z-suffix mixing, no-id-leak invariant
- `src/analytics/dashboard-index.types.ts` - added `DashboardIndexRow.gearName`, `DashboardIndexTotals.withGear`, header comment update explaining the D-17 gear-as-name (not id) resolution
- `src/analytics/compute-dashboard-index.ts` - two-pass restructure: collect `{gearId, startDate}` per activity in pass one, `buildGearLabelMap` once, assemble final rows (with `gearName`) in pass two; new `gearConfigPath` option (default `data/config/gear.json`) read via the existing `parseGearDocument`, optional/warn-and-degrade
- `src/analytics/compute-dashboard-index.test.ts` - 6 new tests for `gearName`/`withGear` (real name, ordinal fallback, no-gear, missing config file, totals reconciliation, no-id-leak), plus `EXPECTED_ROW_KEYS` updated
- `src/analytics/gear-aggregate.types.ts` - `GEAR_AGGREGATE_SCHEMA_VERSION`, `GearShoeAggregate`, `GearYearCoverage`, `GearAggregateDocument`
- `src/analytics/gear-aggregate-logic.ts` - `buildGearAggregate` (per-shoe grouping, Unknown bucket, slug keys with collision de-dup), `buildGearCoverage` (overall + per-year coverage percentages)
- `src/analytics/gear-aggregate-logic.test.ts` - 11 tests: per-shoe sums, Unknown bucket never dropped, Unknown always last, time-weighted avgHr vs naive row-mean, zero-distance pace safety, slug collision, empty-input safety, per-year coverage spanning 0%/100%/partial years
- `src/analytics/compute-gear-aggregate.ts` - `computeGearAggregate`; reads the dashboard index (required, throws naming `compute-dashboard-index` as prerequisite), writes `data/stats/gear-aggregate.json`
- `src/dashboard/data/index-client.test.ts`, `src/dashboard/views/calendar-logic.test.ts`, `src/dashboard/views/list-logic.test.ts` - pre-existing `DashboardIndexRow`/`DashboardIndexTotals` fixture builders updated with `gearName: null` / `withGear: 0` now that those are required fields

## Decisions Made

- Ordinal numbering in `buildGearLabelMap` counts every shoe (named and unnamed) so a shoe's number never shifts when its config name is later filled in — verified by an explicit test.
- `resolveGearLabel`'s `device_name` fallback (used by the single-activity detail Gear tile) is deliberately NOT reused for the index/aggregate's shoe coverage — a device is not a shoe, and using it would fabricate coverage the archive doesn't have. Verified structurally: `grep -c "device_name" src/analytics/compute-dashboard-index.ts` returns `0`.
- The Unknown bucket in the aggregate is unconditionally last in sort order (even when it's the largest bucket by distance) so it always reads as a residual, never as a competing "shoe" in the table/chart.
- `avgHr` per bucket is moving-time-weighted, not a naive per-row mean, and explicitly `null` (never `0`) when zero rows in the bucket have HR data — `0` would misread as a real physiological measurement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed three pre-existing test fixture builders broken by adding `gearName` as a required field**
- **Found during:** Task 2, after making `DashboardIndexRow.gearName` a required (non-optional) field
- **Issue:** `src/dashboard/data/index-client.test.ts`, `src/dashboard/views/calendar-logic.test.ts`, and `src/dashboard/views/list-logic.test.ts` each construct `DashboardIndexRow`/`DashboardIndexDocument` literals (fixture helpers `fixtureRow`/`makeRow` plus two inline document literals) that predate this plan and did not include `gearName`/`withGear` — `tsc` failed with `TS2741: Property 'gearName' is missing`.
- **Fix:** Added `gearName: null` to the two fixture-builder default objects and to the two inline `index-client.test.ts` activity literals; added `withGear: 0` to the inline totals literal.
- **Files modified:** `src/dashboard/data/index-client.test.ts`, `src/dashboard/views/calendar-logic.test.ts`, `src/dashboard/views/list-logic.test.ts`
- **Verification:** `npm run build` and `npm test` (617 tests) both pass after the fix.
- **Committed in:** `28081b3` (Task 2 commit)

**2. [Rule 3 - Blocking] Reworded a code comment to avoid the literal string `device_name`**
- **Found during:** Task 2, running the plan's own acceptance check
- **Issue:** The plan's Task 2 acceptance criteria require `grep -c "device_name" src/analytics/compute-dashboard-index.ts` to return `0`, but the first draft's explanatory comment about deliberately not reusing `device_name` used that literal string, tripping the same grep it was meant to satisfy the intent of.
- **Fix:** Reworded the comment to describe the concept ("the recording device's own name") without the literal identifier, preserving the documented rationale.
- **Files modified:** `src/analytics/compute-dashboard-index.ts`
- **Verification:** `grep -c "device_name" src/analytics/compute-dashboard-index.ts` returns `0`; `grep -c device_name` on `resolveGearLabel`'s own file (`gear-client.ts`) is untouched and still correctly uses the field name.
- **Committed in:** `28081b3` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both fixes were mechanical corrections required to satisfy the plan's own stated acceptance criteria and keep the existing test suite green. No scope creep, no architectural changes.

## Issues Encountered

- The worktree's `data/stats/` directory was empty at session start (gitignored, derived, not yet regenerated in this fresh worktree), which made `npm run verify-dashboard` fail on two pre-existing, out-of-plan stats files (`all-time-totals.json`, `streaks.json`). Ran `npm run compute-all-stats` to regenerate the full derived-data set (out of this plan's scope, but necessary to run the plan's own verification command) before re-running `compute-dashboard-index` and `verify-dashboard`, both of which then passed cleanly (20/20 checks). This also incidentally bumped `data/geo/geo-metadata.json`'s `generatedAt` timestamp; that unrelated, gitignored-adjacent change was reverted with `git checkout --` before committing, since it was not part of this plan's file list.

## Observed Gear Coverage (measured 2026-08-11, live archive: 1,868 activities)

| Year | Runs | With Gear | Coverage % |
|------|------|-----------|------------|
| 2011 | 2 | 0 | 0% |
| 2013 | 6 | 0 | 0% |
| 2015 | 3 | 0 | 0% |
| 2016 | 11 | 0 | 0% |
| 2017 | 193 | 0 | 0% |
| 2018 | 158 | 0 | 0% |
| 2019 | 200 | 0 | 0% |
| **2020** | 172 | 97 | **56.4%** |
| 2021 | 239 | 238 | 99.6% |
| 2022 | 236 | 236 | 100% |
| 2023 | 153 | 153 | 100% |
| 2024 | 184 | 183 | 99.5% |
| 2025 | 239 | 239 | 100% |
| **2026** | 72 | 14 | **19.4%** |

**Overall totals:** 1,160 / 1,868 runs with gear (62.1%), 16 distinct named shoes (all currently using the "Shoe N" ordinal fallback since every config name is blank), plus the Unknown bucket covering the remaining 708 runs.

This confirms the shape the plan's objective described: gear tracking is absent pre-2020, ramps through a transitional 2020, is near-complete 2021-2025, and erodes sharply in 2026 (19.4%, matching the ~19% figure cited in the plan) because the intervals.icu ingestion pipeline (Aug 2026 migration) does not carry `gear_id`. This erosion is now a first-class, visible number in the published aggregate rather than being silently absorbed into an undifferentiated total.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `data/stats/gear-aggregate.json` and `DashboardIndexRow.gearName` are ready for plan 18-10 (records/trends charts) and 18-15 (Gear tab rendering, § 12 of 18-UI-SPEC.md) to consume.
- `compute-gear-aggregate` is not yet wired into the CLI (`src/index.ts`), the `compute-all-stats` chain, npm scripts, or CI — that wiring is explicitly plan 18-11's responsibility (confirmed against 18-11-PLAN.md, which registers `computeGearAggregateCommand` alongside the other new compute steps). This plan's own files list did not include `src/index.ts`, so no CLI wiring was added here; the compute step's `note` field text ("regenerated by `node dist/index.js compute-gear-aggregate`") describes the eventual wired state per the repo's established convention, matching how `compute-dashboard-index.ts`'s own note was written before its CLI command existed.
- No blockers for downstream gear-consuming plans.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*
