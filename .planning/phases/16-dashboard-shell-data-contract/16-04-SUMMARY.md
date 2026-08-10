---
phase: 16-dashboard-shell-data-contract
plan: 04
subsystem: analytics
tags: [compute-step, dashboard-index, typescript, vitest, tdd, cli]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 01)
    provides: excludedFromRecords on ActivityBestEfforts/BestEffort, effortsExcluded totals
  - phase: 16-dashboard-shell-data-contract (plan 03)
    provides: DASHBOARD_INDEX_SCHEMA_VERSION, DashboardIndexRow, DashboardIndexDocument, DashboardIndexStreams, DashboardIndexTotals contract types
  - phase: 14-stream-ingestion-foundation
    provides: data/streams/manifest.json (StreamManifest), CanonicalStream distanceSource/channels
  - phase: 15-best-effort-engine
    provides: data/stats/best-efforts.json (BestEffortsDocument), computeBestEfforts pipeline
provides:
  - "src/analytics/compute-dashboard-index.ts — computeDashboardIndex(options) generator producing data/dashboard/index.json"
  - "compute-dashboard-index CLI subcommand, npm script, and gitignore entry"
  - "data/dashboard/index.json — the published, browse-complete dashboard index manifest (generated, gitignored)"
affects: [16-05, 16-06, 16-07, 16-08, 16-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compute-step CLI + gitignored-output convention (mirrors compute-best-efforts.ts and computeBestEffortsCommand exactly): defaulted options object -> FileStore read/write -> schemaVersion/generatedAt/note/totals envelope -> atomic write -> console summary -> CLI wrapper with actionable ENOENT hint"
    - "Required-vs-optional input tolerance split: manifest read is unguarded (throws, it drives the row set); best-efforts and activity-cities reads are try/catch-guarded and degrade to empty lookups with a warning"
    - "Explicit member-by-member row object literal (never a source-record spread) to keep private/identifier fields out of a public artifact"

key-files:
  created:
    - src/analytics/compute-dashboard-index.ts
    - src/analytics/compute-dashboard-index.test.ts
  modified:
    - src/index.ts
    - package.json
    - .gitignore
    - data/dashboard/index.json (generated, gitignored, not committed)

key-decisions:
  - "Deliberately did NOT use stream-manifest.ts's loadManifest helper — it tolerates a missing manifest file by returning an empty manifest, but this plan's <behavior> spec requires a missing manifest to throw (it is the required driver of the row set). Read the manifest directly via fileStore.readJson instead."
  - "sportType falls back to activity.type when sport_type is absent (Rule 1 auto-fix, found during real-archive verification — see Deviations)"
  - "Not folded into compute-all-stats, per RESEARCH.md Open Question 1's per-stage continue-on-error isolation convention; plan 08 owns the CI workflow step"

patterns-established:
  - "numOrNull(v: unknown): number | null local helper for the undefined/null/NaN -> null nullable-numeric-field convention, reused by any future compute step touching optional StravaActivity numeric fields"

requirements-completed: [DASH-02]

# Metrics
duration: ~25min
completed: 2026-08-10
---

# Phase 16 Plan 04: Dashboard Index Generator Summary

**`compute-dashboard-index` CLI subcommand generates a browse-complete, privacy-scoped `data/dashboard/index.json` over the real 1,867-activity archive, resolving stream badges, low-confidence, PR counts, and record exclusions at generation time.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-10T18:52:00Z
- **Tasks:** 2/2
- **Files modified:** 5 (2 created, 3 modified) + 1 regenerated gitignored data file

## Accomplishments

- Built `computeDashboardIndex`, structurally mirroring `compute-best-efforts.ts`'s options-object/manifest-driven-loop/atomic-write/console-summary shape
- Every manifest entry (available or not) produces a row, keeping the index browse-complete for the full archive; unavailable entries carry `streams.available: false` with the manifest's reason code
- Per-row reads are try/catch-guarded (`totals.skippedUnreadable`), and both optional cross-reference inputs (`best-efforts.json`, `activity-cities.json`) degrade to empty lookups with a warning rather than aborting the build
- Registered `compute-dashboard-index` as a first-class CLI subcommand (help text, switch case, npm script) mirroring `compute-best-efforts` exactly, and added `data/dashboard/` to `.gitignore` following the `data/stats/` D-12 convention
- Real-archive run: 1,867 rows, 1,842 with streams / 25 without, 1,687 with HR, 1,166 with cadence, 38 low-confidence, 0 skipped-unreadable, 842,671 bytes — well under the 3MB verification ceiling, sorted newest-first, zero leaked identifier fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the dashboard index generator** - `15880f2` (feat) — TDD-style fixture coverage (25 tests, not a strict RED/GREEN cycle since the plan's `tdd="true"` attribute called for behavior-driven fixture tests written alongside the implementation)
2. **Task 2: Wire the CLI subcommand, npm script, and gitignore entry** - `f3638f3` (feat)

## Files Created/Modified

- `src/analytics/compute-dashboard-index.ts` — `computeDashboardIndex`/`ComputeDashboardIndexOptions`; manifest-required, best-efforts/cities-optional, per-row try/catch, explicit row object literal
- `src/analytics/compute-dashboard-index.test.ts` — 25 fixture-based tests covering row shape, pace/nullable-numeric rules, stream badge mirroring, low-confidence, location fallback chain, exclusion/PR-count mirroring, sort order, error tolerance, totals reconciliation, document envelope, and the leaked-field guard
- `src/index.ts` — `computeDashboardIndexCommand()`, help text (commands + examples), `case 'compute-dashboard-index'` in the switch block
- `package.json` — `"compute-dashboard-index": "node dist/index.js compute-dashboard-index"` script
- `.gitignore` — `data/dashboard/` entry alongside `data/stats/`
- `data/dashboard/index.json` — regenerated against the real 1,867-activity archive (gitignored, not committed by this plan)

## Decisions Made

- Read the stream manifest directly via `fileStore.readJson` rather than the existing `loadManifest` helper (`stream-manifest.ts`), because `loadManifest` tolerates a missing file by returning an empty manifest — this plan's spec requires a missing manifest to throw, since it is the required driver of the browse-complete row set
- Kept `sportType` fallback logic local to the row-construction site rather than adding a shared helper, since this is the first (and so far only) compute step reading `sport_type`/`type` from mixed-provenance activity records

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `sportType` fell back to `activity.type` when `sport_type` is absent**
- **Found during:** Task 2's real-archive verification run (`node dist/index.js compute-dashboard-index` against the live 1,867-activity archive)
- **Issue:** 59 intervals.icu-migrated activities (Aug 2026 ingestion switch, `i`-prefixed ids — see project memory `intervals-icu-migration`) carry `type` but not `sport_type`. The plan's interface spec sourced `sportType` straight from `sport_type` based on a Strava-only sample record, which produced rows with `sportType: undefined`, failing the row-shape acceptance check (`row missing sportType`) against the real archive.
- **Fix:** `sportType: (activity.sport_type as string | undefined) ?? activity.type` — falls back to the always-present `type` field.
- **Files modified:** `src/analytics/compute-dashboard-index.ts`, `src/analytics/compute-dashboard-index.test.ts` (added a covering fixture test for the fallback)
- **Commit:** `f3638f3`

## Issues Encountered

None beyond the sportType deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `data/dashboard/index.json` exists on disk (gitignored) with the full D-09 field set per row, ready for plan 05's index client to fetch
- `compute-dashboard-index` is wired into the CLI the same way every other compute step is, ready for plan 08 to add its CI workflow step (deliberately excluded from `compute-all-stats`)
- No blockers for downstream plans in this phase

## Self-Check: PASSED

All created files verified present on disk; both task commit hashes (`15880f2`, `f3638f3`) verified present in `git log --oneline --all`.
