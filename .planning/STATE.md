---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Training Dashboard
status: executing
stopped_at: Phase 16 plan 09 checkpoint PARTIAL - gap-closure pending on DASH-02/DASH-03
last_updated: "2026-08-11T11:32:09.702Z"
last_activity: 2026-08-11 -- Phase 16 execution started
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 25
  completed_plans: 22
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 16 — dashboard-shell-data-contract

## Current Position

Phase: 16 (dashboard-shell-data-contract) — EXECUTING
Plan: 1 of 16
Status: Executing Phase 16
Last activity: 2026-08-11 -- Phase 16 execution started

Progress: [██████████] 100% (plans); phase gate open pending gap-closure

## Performance Metrics

**By Milestone:**

| Milestone | Plans | LOC | Duration |
|-----------|-------|-----|----------|
| v1.0 | 9 | 3,844 | 1 day |
| v1.1 | 10 | +2,858 | 3 days |
| v1.2 | 11 | +2,446 | 2 days |
| **Total** | **30** | **9,148** | **6 days** |
| Phase 16 P09 | ~30min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Roadmap-level decisions for v2.0 (from research, see .planning/research/SUMMARY.md):

- Stream ingestion (Phase 14) is the foundational blocker — must land first, storage/algorithm decisions (decimation, native-distance, timestamp-indexing) locked before any file is committed.
- Best-effort computation (Phase 15) is isolated as pure backend work, testable before it feeds any UI.
- Records/trends "view" requirements (weekly/monthly totals, TRIMP, YoY) do not depend on streams and are grouped into presentation (Phase 18) rather than gated behind stream work.
- Commit derived/decimated stream JSON to data/streams/, never raw full-resolution — repo already has a bloat precedent from data/heatmap/all-points.json.
- Phase 15 plan 04 (D-05 external validation): 2 of 8 candidate fixture rows (5k on activities 7827165619 and 9716153503) were dropped rather than frozen, because Strava does not surface a 5k best-effort panel for either activity and no platform-reported value existed — only the developer's manual judgment, which the plan's own anti-circularity rule forbids using as an expected value. The remaining 6 rows still clear every coverage guard.
- [Phase 16]: 16-09 human checkpoint recorded as PARTIAL, not approved: navigation (DASH-01) and error/degraded states confirmed working; deep-link detail rendering (DASH-02) and theme-toggle visibility (DASH-03) both surfaced real defects, logged verbatim as gap-closure work rather than patched under checkpoint pressure. requirements-completed for 16-09 lists only DASH-01.

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

**Not yet filed as a todo item — flagged during Phase 15 plan 04 for triage:** manual per-activity exclusion from personal-best/PR calculations (developer wants to exclude activities like `3475726256`/`3475725513`, recorded with an inaccurate GPS device, from PR consideration despite their engine-computed times matching Strava's own reported values exactly). Natural fit for Phase 18 (Records & Trends) planning — that's where PR-list presentation and any exclusion/override UI would live. See `.planning/phases/15-best-effort-engine/15-04-SUMMARY.md` Follow-ups section.

### Blockers/Concerns

Previously resolved — SQLITE_CANTOPEN CI failure resolved by quick-1-01 (lazy geocoder init + dynamic import).

- Phase 16 gap-closure needed before phase gate closes: GAP 1 (blocking, DASH-02) — deep-linked activity detail view renders 'Couldn't load this activity' in a real browser despite the same files serving 200 over plain HTTP in the automated smoke check; likely a client-side fetch-path bug in src/dashboard/data/detail-client.ts or how the hash router passes the id into it. GAP 2 (cosmetic, DASH-03) — theme toggle control is invisible in light mode though still functional when clicked. See .planning/phases/16-dashboard-shell-data-contract/16-09-SUMMARY.md Follow-ups section for full detail.
- Plan 16-14 Task 2: git push origin master rejected as non-fast-forward. origin/master has 2 commits not in local master (dfaaf1e, bca8ae1 -- both automated 'chore: update activities and stats [skip ci]' from the nightly CI git-auto-commit-action), both touching only the generatedAt timestamp field in data/geo/geo-metadata.json. Local master is 177 commits ahead of the pre-divergence base but 2 commits behind current origin/master. A real 3-way merge would conflict on that single timestamp line. Per explicit authorization boundary (STOP and report, do not force), executor halted without force-pushing, merging, or rebasing. Awaiting explicit instruction on how to integrate (merge accepting origin's newer timestamp, or rebase local onto origin/master) before push/deploy can proceed.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix Daily Widget Refresh GitHub Actions workflow error | 2026-02-18 | 0f1d761 | [1-fix-daily-widget-refresh-github-actions-](./quick/1-fix-daily-widget-refresh-github-actions-/) |

## Session Continuity

Last session: 2026-08-11T08:09:42.394Z
Stopped at: Phase 16 plan 09 checkpoint PARTIAL - gap-closure pending on DASH-02/DASH-03
Resume file: None (gap-closure planning next)

---
*Last updated: 2026-08-11 — Phase 16 (dashboard-shell-data-contract) all 9 plans executed and summarized; human checkpoint on plan 09 came back PARTIAL — DASH-01 confirmed, DASH-02 (blocking) and DASH-03 (cosmetic) have open gaps pending gap-closure planning before the phase gate closes*
