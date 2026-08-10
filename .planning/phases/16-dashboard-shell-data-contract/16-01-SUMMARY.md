---
phase: 16-dashboard-shell-data-contract
plan: 01
subsystem: analytics
tags: [best-effort-engine, exclusion-list, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 15-best-effort-engine
    provides: computeBestEfforts pipeline, BestEffort/ActivityBestEfforts/BestEffortsDocument types, markPRs/rankTopN accumulator
provides:
  - "data/best-effort-exclusions.json — committed, user-maintained exclusion list (activity id, optional per-distance scope, reason)"
  - "BestEffortExclusion / BestEffortExclusionsFile / BEST_EFFORT_EXCLUSIONS_SCHEMA_VERSION contract types"
  - "excludedFromRecords flag on BestEffort and ActivityBestEfforts, effortsExcluded total on BestEffortsDocument"
  - "src/analytics/best-effort-exclusions.ts — buildExclusionIndex/isExcluded (pure matcher) + loadExclusions (never-throws loader)"
  - "computeBestEfforts wired to withhold excluded efforts from PR marking/ranking while retaining them, flagged, in the output document"
affects: [16-04-dashboard-data-contract, 18-records-trends]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Never-throw loader pattern: loadExclusions degrades to an empty Map on any read/parse failure after one console.warn, matching loadManifest's tolerance convention"
    - "Gate-before-push: exclusion check happens at the byDistance accumulator push site, so markPRs/rankTopN need zero changes — promotion of the next-best effort is automatic"

key-files:
  created:
    - data/best-effort-exclusions.json
    - src/analytics/best-effort-exclusions.ts
    - src/analytics/best-effort-exclusions.test.ts
  modified:
    - src/analytics/best-effort.types.ts
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts
    - data/stats/best-efforts.json (regenerated, gitignored, not committed)

key-decisions:
  - "distances: null means union-absorbing 'all' in the ExclusionIndex; a later 'all' entry for the same activityId always wins over an earlier narrower one"
  - "Excluded efforts are computed and retained in activities[id].efforts (flagged excludedFromRecords: true) rather than deleted, keeping totals reconcilable per T-16-EX-04"
  - "exclusionsPath defaults to 'data/best-effort-exclusions.json', matching the existing activitiesDir/streamsDir default pattern in ComputeBestEffortsOptions"

patterns-established:
  - "Exclusion contract lives in best-effort.types.ts alongside the effort types it augments, not in a separate schema file"

requirements-completed: [DASH-02]

# Metrics
duration: ~20min
completed: 2026-08-10
---

# Phase 16 Plan 01: Best-Effort Manual Exclusion List Summary

**User-maintained `data/best-effort-exclusions.json` now withholds GPS-untrustworthy activities from PR rankings while keeping their computed efforts visible and flagged, promoting the next-best genuine effort automatically.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-10T18:44:00Z
- **Tasks:** 3/3
- **Files modified:** 6 (3 created, 3 modified) + 1 regenerated gitignored data file

## Accomplishments
- Closed the folded todo for manual best-effort exclusions: the two known-bad-device activities (`3475726256`, `3475725513`) are seeded into a committed, hand-maintained exclusion file
- `computeBestEfforts` now gates the PR accumulator on the exclusion index without touching `best-effort-utils.ts` — `markPRs`/`rankTopN` promote the next-best effort with zero code changes
- Real archive re-run confirmed both target promotions: 400m rank 1 moved to `4556693525`, 1k rank 1 moved to `4598855187`, and both excluded activities remain in the document with `excludedFromRecords: true` and no PR flags
- `excludedFromRecords` now exists on `BestEffort`/`ActivityBestEfforts` for Phase 16 plan 04's dashboard index generator to surface as a badge (D-09)

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the exclusion contract and seed the committed exclusion list** - `6bce9d8` (feat)
2. **Task 2: Build the exclusion loader/matcher and gate the PR accumulator** - `c377a5a` (test, RED) → `b9d10cd` (feat, GREEN)
3. **Task 3: Re-run the real archive computation and confirm the PR promotions** - verification-only, no commit (`data/stats/` is gitignored per plan)

_TDD task 2 followed RED → GREEN: `c377a5a` added 33 failing/erroring test cases (module didn't exist yet), `b9d10cd` implemented the module and made all 39 exclusion-adjacent tests pass. No refactor commit needed._

## Files Created/Modified
- `data/best-effort-exclusions.json` - Committed exclusion list; 2 seeded entries with `distances: null`
- `src/analytics/best-effort.types.ts` - `BestEffortExclusion`, `BestEffortExclusionsFile`, `BEST_EFFORT_EXCLUSIONS_SCHEMA_VERSION`; `excludedFromRecords` on `BestEffort`/`ActivityBestEfforts`; `effortsExcluded` on `BestEffortsDocument.totals`
- `src/analytics/best-effort-exclusions.ts` - `buildExclusionIndex`, `isExcluded`, `loadExclusions`
- `src/analytics/best-effort-exclusions.test.ts` - Unit coverage for matcher union semantics and loader tolerance
- `src/analytics/compute-best-efforts.ts` - Loads exclusions, gates the `byDistance` push, flags efforts/activities, extends totals + console summary
- `src/analytics/compute-best-efforts.test.ts` - 4 new archive-orchestration cases under an `exclusions` describe block
- `data/stats/best-efforts.json` - Regenerated against the real 1,867-activity archive (gitignored, not committed by this plan)

## Decisions Made
- Kept the exclusion check as a per-effort gate at the accumulator-push site rather than filtering the manifest loop upfront, so low-confidence counting and per-activity `efforts` retention stay untouched by the exclusion logic (only the ranking-eligible push is skipped)
- `loadExclusions` logs a one-line success summary (`Loaded N best-effort exclusions from <path>`) mirroring `loadManifest`'s existing console conventions, for CI log legibility

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their `<action>`/`<verify>`/`<acceptance_criteria>` blocks with no auto-fixes needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `excludedFromRecords` is available on both `BestEffort` and `ActivityBestEfforts` for Phase 16 plan 04's dashboard index generator to read directly (D-09's low-confidence/exclusion badge)
- `data/best-effort-exclusions.json` is the durable, hand-editable extension point if more untrustworthy-device activities surface later — no code changes required, only a JSON entry
- No blockers for downstream plans in this phase or Phase 18 (records/trends)
