---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Training Dashboard
status: ready_to_plan
stopped_at: Phase 14 complete (5/5) — ready to discuss Phase 15
last_updated: 2026-08-10T13:24:00.784Z
last_activity: 2026-08-10 -- Phase 14 execution started
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 5
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 15 — best effort engine

## Current Position

Phase: 15
Plan: Not started
Status: Ready to plan
Last activity: 2026-08-10

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**By Milestone:**

| Milestone | Plans | LOC | Duration |
|-----------|-------|-----|----------|
| v1.0 | 9 | 3,844 | 1 day |
| v1.1 | 10 | +2,858 | 3 days |
| v1.2 | 11 | +2,446 | 2 days |
| **Total** | **30** | **9,148** | **6 days** |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Roadmap-level decisions for v2.0 (from research, see .planning/research/SUMMARY.md):

- Stream ingestion (Phase 14) is the foundational blocker — must land first, storage/algorithm decisions (decimation, native-distance, timestamp-indexing) locked before any file is committed.
- Best-effort computation (Phase 15) is isolated as pure backend work, testable before it feeds any UI.
- Records/trends "view" requirements (weekly/monthly totals, TRIMP, YoY) do not depend on streams and are grouped into presentation (Phase 18) rather than gated behind stream work.
- Commit derived/decimated stream JSON to data/streams/, never raw full-resolution — repo already has a bloat precedent from data/heatmap/all-points.json.

### Key Findings

Carried forward for future milestones:

- ~~GeoNames database lives in node_modules~~ RESOLVED 2026-08: committed to data/geo/geonames.db (13.5 MB)
- Multi-city route prevalence: 86% of activities pass through multiple cities
- Pre-decoded heatmap points file is 12.7 MB — acceptable for CDN but worth monitoring
- Cadence unit semantics on intervals.icu's streams endpoint not yet empirically verified — flagged for Phase 14 planning (probe-intervals-style check before trusting the field).

### Aug 2026 maintenance arc (outside GSD, commits 5e36da9..3787c20)

- **Ingestion migrated Strava → intervals.icu** (Garmin bridge): Strava paywalled API access (June 2026); Garmin has no personal API. Adapter validated against live payloads (latlng = data/data2 parallel arrays; geometry distance-validated + reverse-geocode checked). Dedupe by start_date epoch.
- **CI recovered**: commit-step bug (gitignored data/stats in file_pattern) had frozen gh-pages since Feb 23; geocoding silently broken since March. Both fixed; nightly green with zero warnings.
- **Bulk-export consolidation**: `consolidate-exports` command + data/provenance.json linking 1,841/1,866 records to original FIT/GPX in export_data/ (gitignored, local-only — needs private backup). 4 runs rescued that the API never delivered.
- Archive: 1,866 runs, 20,744.7 km, 24 countries, 88 cities. See ~/.claude memory `intervals-icu-migration` for hard-won API facts.

### Pending Todos

1 pending — `.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md` (write garmin adapter for consolidate-exports once the requested Garmin bulk export lands in export_data/garmin/)

### Blockers/Concerns

None active — SQLITE_CANTOPEN CI failure resolved by quick-1-01 (lazy geocoder init + dynamic import).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix Daily Widget Refresh GitHub Actions workflow error | 2026-02-18 | 0f1d761 | [1-fix-daily-widget-refresh-github-actions-](./quick/1-fix-daily-widget-refresh-github-actions-/) |

## Session Continuity

Last session: 2026-08-10T11:40:01.288Z
Stopped at: Phase 14 context gathered
Resume file: .planning/phases/14-stream-ingestion-foundation/14-CONTEXT.md

---
*Last updated: 2026-08-10 after v2.0 roadmap creation*
