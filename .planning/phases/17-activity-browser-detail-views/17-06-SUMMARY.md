---
phase: 17-activity-browser-detail-views
plan: 06
subsystem: infra
tags: [publish-pipeline, static-config, build-widgets, verify-dashboard]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract
    provides: "dataDirs copy-loop in build-widgets.mjs and expect200/expect404 assertion helpers in verify-dashboard-publish.mjs, plus the mounted-under-/strava-widgets publish verifier pattern from the Phase 16 black-page postmortem"
provides:
  - "data/config/gear.json: committed gear_id to display-name map, all 16 archive gear ids seeded (empty-string placeholder, falls back to device_name per D-33)"
  - "data/config/athlete.json: committed maxHr + five-zone hrZones envelope for the HR-zone panel (D-30/D-31)"
  - "data/config copied into dist/widgets/data/config on every build-widgets run"
  - "publish verifier HTTP+shape assertions for both new config URLs, proven load-bearing by rename experiment"
affects: [17-05-parseAthleteConfig, 17-07-detail-view-gear-hr-zone-rendering, phase-18-trimp-training-load]

# Tech tracking
tech-stack:
  added: []
  patterns: ["hand-maintained committed config in data/config/ using the schemaVersion+note+payload-key envelope from data/best-effort-exclusions.json"]

key-files:
  created: [data/config/gear.json, data/config/athlete.json]
  modified: [scripts/build-widgets.mjs, scripts/verify-dashboard-publish.mjs]

key-decisions:
  - "Seeded all 16 gear ids with empty-string placeholders rather than partial real names, so the empty-string-falls-back-to-device_name contract (D-33) is exercised for every id until the developer fills them in"
  - "Reused the existing per-directory copy loop in copyDataFiles (one dataDirs entry) instead of new copy logic, per 17-RESEARCH.md Pitfall 7"
  - "Verifier asserts document SHAPE (gear object, five-entry hrZones), not just HTTP 200, to close the exact Phase 16 postmortem gap where a 200-with-HTML response passed a reachability-only check"

patterns-established:
  - "Load-bearing verifier changes are proven with a rename-and-restore experiment before being trusted, with both exit codes recorded in the SUMMARY"

requirements-completed: [DETAIL-01, DETAIL-05]

# Metrics
duration: 5min
completed: 2026-08-11
---

# Phase 17 Plan 06: Committed Config Files & Publish Pipeline Wiring Summary

**Hand-maintained gear.json and athlete.json config files added, copied into dist/widgets/data/config by build-widgets.mjs, and asserted by two new HTTP+shape checks in verify-dashboard-publish.mjs — proven load-bearing by a rename/restore experiment (exit 1 → exit 0).**

## Performance

- **Duration:** ~5 min (task work; excludes local pipeline regeneration for verification)
- **Started:** 2026-08-11T15:10:00Z (approx)
- **Completed:** 2026-08-11T15:13:06Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Authored `data/config/gear.json` with all 16 distinct archive gear ids and `data/config/athlete.json` with a five-zone HR config, both in the locked schemaVersion+note envelope
- Extended `copyDataFiles`'s `dataDirs` array in `scripts/build-widgets.mjs` so `data/config` is copied into `dist/widgets/data/config` on every build, reusing the existing proven copy loop
- Added two `expect200` assertions plus document-shape checks (`gear` object, five-entry `hrZones`) to `scripts/verify-dashboard-publish.mjs`
- Proved the new verifier assertions are load-bearing: renaming `dist/widgets/data/config/gear.json` produced exit 1 (18 passed, 1 failure naming the exact path); restoring it produced exit 0 (20 passed, 0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author data/config/gear.json and data/config/athlete.json** - `e72ae80` (feat)
2. **Task 2: Copy data/config into the publish dir and assert it over HTTP** - `69f5d1c` (feat)

_No plan-metadata commit in this worktree — the orchestrator commits SUMMARY.md/STATE.md/ROADMAP.md centrally after merge (worktree mode)._

## Files Created/Modified
- `data/config/gear.json` - schemaVersion 1, note, and a `gear` object mapping all 16 archive gear_ids to empty-string placeholders (falls back to device_name per D-33 until filled in)
- `data/config/athlete.json` - schemaVersion 1, note, `maxHr: 190`, and 5 ascending `hrZones` (zone 5 `maxBpm: null`), carrying the D-30 not-derived-from-observed-max rationale in `note`
- `scripts/build-widgets.mjs` - added `{ src: 'data/config', dest: 'dist/widgets/data/config' }` to the `dataDirs` array in `copyDataFiles`, with a comment noting it carries the hand-maintained athlete/gear config
- `scripts/verify-dashboard-publish.mjs` - added `expect200` + shape assertions for `/data/config/gear.json` (`gear` object) and `/data/config/athlete.json` (five-entry `hrZones` array), placed immediately after the existing `/data/stats/streaks.json` assertion

## Decisions Made
- All 16 gear ids seeded with empty-string placeholders (not partial real names) — makes the empty-string → device_name fallback path (D-33) the default, verifiably exercised state rather than an edge case
- `dataDirs` array extension reused verbatim rather than any new per-file copy path, per 17-RESEARCH.md Pitfall 7 guidance
- Shape assertions (not just reachability) added to the verifier to close the specific class of failure the Phase 16 postmortem identified (a 200-with-HTML GitHub Pages error page passing a status-only check)

## Deviations from Plan

None - plan executed exactly as written. To exercise `npm run verify-dashboard` locally (a fresh worktree checkout has no generated `data/stats/` or `data/dashboard/`, both gitignored), `npm run build`, `npm run compute-all-stats`, and `npm run compute-dashboard-index` were run first to produce those directories before `npm run build-widgets && npm run verify-dashboard` — this is setup for local verification only, not a plan change. One of those pipeline runs regenerated `data/geo/geo-metadata.json`'s `generatedAt` timestamp as an out-of-scope side effect; that file was reverted with `git checkout -- data/geo/geo-metadata.json` before committing, since it's not part of this plan's `files_modified`.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Both config files ship with placeholder values (empty gear names, a plausible-but-generic 190bpm HR-zone split) that satisfy the phase's success criteria on their own; filling in real values is a manual follow-up for the developer, explicitly documented in each file's `note` field, and not a blocker for this plan or the phase.

## Next Phase Readiness
- `data/config/gear.json` and `data/config/athlete.json` are committed, publish-verified, and ready for plan 17-05's `parseAthleteConfig` and plan 17-07's detail-view gear tile / HR-zone panel to consume
- Phase 18's TRIMP training load work can read `data/config/athlete.json` unchanged
- No blockers identified

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*
