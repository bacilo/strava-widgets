---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Interface Polish
status: Roadmap created, awaiting /gsd-plan-phase 19
stopped_at: Phase 19 context gathered
last_updated: "2026-08-12T12:06:36.159Z"
last_activity: 2026-08-12
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** v2.1 Interface Polish — Phase 19 (Design System & Control Styling) is next

## Current Position

Phase: 19 (not started)
Plan: Not started
Status: Roadmap created, awaiting /gsd-plan-phase 19
Last activity: 2026-08-12

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**By Milestone:**

| Milestone | Plans | LOC | Duration |
|-----------|-------|-----|----------|
| v1.0 | 9 | 3,844 | 1 day |
| v1.1 | 10 | +2,858 | 3 days |
| v1.2 | 11 | +2,446 | 2 days |
| **Total** | **30** | **9,148** | **6 days** |
| Phase 16 P09 | ~30min | 2 tasks | 2 files |
| Phase 16 P14 | 40min | 3 tasks | 1 files |
| Phase 17 P15 | 25min | 3 tasks | 1 files |

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
- [Phase 16]: Non-fast-forward push rejections halt the executor rather than auto-merge/rebase; a coordinator-level decision resolved the divergence (merge over rebase, to avoid rewriting 179 phase commits for a one-line auto-generated timestamp conflict)
- [Phase 17]: 17-15 human checkpoint recorded as PARTIAL, not approved: 8 of 10 Manual-Only Verifications rows confirmed clean (BROWSE-01..06, DETAIL-01, DETAIL-05); DETAIL-02 (route-map basemap tiles absent, GAP 1) and DETAIL-03/DETAIL-04 (chart band x-axis misalignment undermining the shared crosshair, GAP 2) surfaced real defects, logged verbatim as gap-closure work rather than patched under checkpoint pressure, mirroring the 16-09 precedent. requirements-completed for 17-15 lists only BROWSE-01..06, DETAIL-01, DETAIL-05.

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

- RESOLVED 2026-08-11 (found by human testing during 16-15, fixed in 0b59d8c, redeployed via run 31488806924): the first live deploy rendered a black page with only the title. The dashboard build emitted root-absolute asset URLs (`/assets/index-*.js` + stylesheet); on a Pages *project* page under /strava-widgets/ those escape the project, GitHub returns its 404 HTML, and the browser fails parsing that HTML as JS/CSS. Fixed with `base: './'` on the dashboard build. IMPORTANT LESSON — the phase's own exit gate reported 15/15 green on this broken build for two independent reasons: verify-dashboard-publish.mjs served the publish dir at the server ROOT (where absolute URLs resolve), and its asset check did `src.replace(/^\//,'')`, normalising the broken URL into a working one before fetching it. Both are fixed: the verifier now mounts under /strava-widgets and treats a root-absolute asset URL as a hard failure, and it checks the stylesheet too. Confirmed load-bearing — 2 failures / exit 1 against the broken build, 16/16 / exit 0 after the fix. This is the same failure mode as 16-09 (asserting a local shape that production does not have), now closed structurally rather than by intent.

Previously resolved — SQLITE_CANTOPEN CI failure resolved by quick-1-01 (lazy geocoder init + dynamic import).

- RESOLVED 2026-08-11 (code fix landed; awaiting human confirmation in 16-15/16-16): Phase 16 GAP 1 (blocking, DASH-02) — deep-linked activity detail view rendered "Couldn't load this activity" in a real browser. Root cause was `isValidActivityId` rejecting `i`-prefixed intervals.icu ids before any fetch was issued; fixed in plan 16-10 by widening the single validation chokepoint to `/^i?\d{1,20}$/`, with regression tests added. GAP 2 (cosmetic, DASH-03) — theme toggle invisible in light mode; fixed in plan 16-11 by syncing `color-scheme` to `data-theme`, pinning the toggle color to `var(--text)`, and replacing a dead `fill` rule with real `display` toggling. Both remain pending live-browser confirmation by plans 16-15 and 16-16.
- RESOLVED 2026-08-11: Plan 16-14 push rejections (twice, non-fast-forward). Both were the nightly CI's `git-auto-commit-action` data commits landing on origin/master ahead of us — the second was from the very daily-refresh run (31487234659) that this plan triggered. Both had zero file overlap with local's `.planning/` commits. Resolved by the orchestrator with plain `git merge origin/master` (chosen over rebase to avoid rewriting 178 unpushed commits for auto-generated data), no conflicts, followed by a successful push. origin/master is now current at 9871285 (0 ahead, 0 behind) and carries src/dashboard. No force-push or history rewrite was used at any point.
- OPEN 2026-08-11: Phase 17 GAP 1 (DETAIL-02) — route-map basemap tiles do not render in a real browser; polyline renders correctly over a white background. RouteRenderer.addBasemapSwitcher() does register the tile layer, so the vector-renders-but-tiles-absent signature points at leaflet/dist/leaflet.css not taking effect for the dynamically-imported map chunk (implicates the phase's own MEDIUM-confidence async-CSS-injection assumption, T-17-MAP-04). Root cause still under active diagnosis, not yet fixed. See 17-VALIDATION.md Gap-Closure Record.
- OPEN 2026-08-11: Phase 17 GAP 2 (DETAIL-03/DETAIL-04) — chart band x-axis origins are not vertically aligned across bands in a real browser; each band auto-sizes its own y-axis gutter to its widest tick label (pace's '10:00/km' vs HR's '120'), so the bands' plot areas start at different x-offsets. This also undermines the shared hover-crosshair guarantee (17-UI-SPEC.md § 4c), since one screen x maps to a different data x per band. Not yet fixed. See 17-VALIDATION.md Gap-Closure Record.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix Daily Widget Refresh GitHub Actions workflow error | 2026-02-18 | 0f1d761 | [1-fix-daily-widget-refresh-github-actions-](./quick/1-fix-daily-widget-refresh-github-actions-/) |

## Deferred Items

Items acknowledged and deferred at the v2.0 milestone close on 2026-08-12.

**Update 2026-08-12:** six of these were absorbed into milestone v2.1 as requirements and are now tracked in ROADMAP.md, not here — CUR-01 (Phase 24), FIX-01 (Phase 21), FIX-02 / CI-01 / CI-02 / VER-01 (Phase 25). They remain listed below for the record but are no longer outstanding debt. Full detail in `.planning/v2.0-MILESTONE-AUDIT.md` (status `tech_debt`).

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 16 — `16-HUMAN-UAT.md`, 4 pending scenarios | partial |
| verification_gap | Phase 16 — `16-VERIFICATION.md` | human_needed |
| untested_seam | Phase 16 UAT items 1-3: light-OS legibility, first-paint white flash, live OS auto-follow — NOT discharged by phases 17/18 despite both running human checkpoints on the same shell | open |
| integration_warning | `daily-refresh.yml` runs the 8 compute steps in a different order than `src/index.ts`'s `compute-all-stats` chain; both currently safe, no shared source of truth | open |
| integration_warning | `verify-dashboard-publish.mjs` does not individually assert reachability for `weekly-distance`/`monthly-stats`/`yearly-stats`/`year-over-year`/`best-efforts.json`/shards — affects REC-02/03/05, TREND-01/02 | open |
| code_review | WR-01: Current Streak tile's `ended {date}` sub-label is structurally unreachable (root cause `streak-utils.ts:118`) | open |
| code_review | WR-02: `gear-aggregate-logic.ts` strict `label === null` Unknown-bucket test crashes `slugify()` on an absent `gearName` key | open |
| evidence_gap | REC-06's external correctness evidence is one distance (5k) with a 0.51-point unexplained delta; the plan asked for two | open |
| doc_defect | `18-UI-SPEC.md:843` checklist wording contradicts the authoritative chart spec at line 319 | open |
| quick_task | `1-fix-daily-widget-refresh-github-actions-` | missing |
| todo | Exclusion tickbox / local curation mode (`npm run curate`) — approach chosen 2026-08-12, not yet planned | new |
| todo | Garmin export adapter (STREAM-04) — blocked on the export arriving | deferred |
| ~~todo~~ | ~~Manual exclusion of activities from best efforts~~ — **CORRECTION 2026-08-12: not deferred. Shipped in Phase 16 plan 16-01 (`b9d10cd`); the todo file was simply never closed, so `audit-open` miscounted it and the v2.0 audit repeated the error.** | resolved |

## Session Continuity

Last session: 2026-08-12T12:06:36.147Z
Stopped at: Phase 19 context gathered
Resume file: .planning/phases/19-design-system-control-styling/19-CONTEXT.md

---
*Last updated: 2026-08-11 — Phase 17 (activity-browser-detail-views) all 15 planned plans executed and summarized; human checkpoint on plan 17-15 came back PARTIAL — 8/10 Manual-Only Verifications rows confirmed clean, GAP 1 (DETAIL-02, route-map basemap tiles absent) and GAP 2 (DETAIL-03/04, chart band x-axis misalignment) have open gaps pending gap-closure planning (`/gsd-plan-phase 17 --gaps`) before the phase gate closes*
