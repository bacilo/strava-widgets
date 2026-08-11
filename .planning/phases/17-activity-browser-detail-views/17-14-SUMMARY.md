---
phase: 17-activity-browser-detail-views
plan: 14
subsystem: ui
tags: [typescript, dom-rendering, orchestration, lazy-import, leaflet, chart.js]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    plan: "07"
    provides: "createGearClient/resolveGearLabel and createAthleteConfigClient — degrade-to-null browser clients for the Gear tile and HR-zone panel"
  - phase: 17-activity-browser-detail-views
    plan: "11"
    provides: "mountRouteMap/renderRouteSection/RouteMapHandle — lazily-imported Leaflet route map with a hover-sync position marker"
  - phase: 17-activity-browser-detail-views
    plan: "12"
    provides: "mountChartBands/ChartBandsHandle — lazily-imported stacked Chart.js bands with an onHover(fraction) broadcast"
  - phase: 17-activity-browser-detail-views
    plan: "13"
    provides: "buildSplitsSection/buildBreakdownSection DOM renderers over computeSplits/computePaceDistribution/computeHrZoneTimes"
provides:
  - "The full DETAIL-01..05 activity page: eight-tile stats header with resolved/omitted Gear tile, prev/next archive nav, route map, chart bands, splits table, pace/zone breakdown, all in the 17-UI-SPEC § 4 fixed order"
  - "The D-25 lazy-import boundary made real: detail.ts is the only module that dynamically imports detail-map.ts/detail-charts.ts, verified against a real Vite build"
  - "D-26 hover sync wiring: chart onHover drives the route map's setPositionByFraction"
  - "The full requestToken/mountedContainer stale-render guard extended across every new await point this plan introduces (gear load, config load, both dynamic imports, both mount calls)"
affects: [17-15-browser-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "typeof import('./module.js') type-only queries for the two lazy module's handle/module types, avoiding any static `import type ... from` that would defeat D-25's static-import grep guarantee while still getting full type safety at every call site"
    - "try/catch import helpers (tryImportDetailMap/tryImportDetailCharts) returning `Module | null` instead of throwing, so a failed chunk load degrades to the same Retry-driven error UI as every other failure mode in this view"
    - "Synchronous-first-paint, async-fill-in orchestration: renderSuccess awaits only the two lightweight config loads (gear, athlete config) before painting the stats header/splits/breakdown, then fires mountHeavySections without awaiting it so the route map and charts stream in afterward"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail.ts
    - src/dashboard/view-registry.ts

key-decisions:
  - "Added a stale-render guard after gearClient.load() beyond what the plan's own threat model (T-17-VW-04) enumerates (detail fetch, config load, both dynamic imports) — gear resolution is itself a new await point this plan introduces before any DOM is painted, so the same class of fast-navigation race applies to it. Documented here since the literal-string acceptance grep only required 3 occurrences of the guard and this makes a 4th correctness-motivated one."
  - "Added 'Route' and 'Pace & Effort' as the section headings for the route map and chart bands sections, inferred from 17-UI-SPEC.md's Typography section listing exactly these two strings among the detail page's section headers (alongside 'Splits'/'Heart Rate Zones'/'Pace Distribution', which detail-sections.ts already implements) even though the Surface Contracts section for §4b/4c didn't spell out heading text explicitly."
  - "The chart-bands section (heading + placeholder container) is omitted entirely when detail.stream is null, rather than rendered empty and left unfilled — mountChartSection is never even invoked in that case, matching the same 'absence is a state' discipline plan 17-13 established for the HR-zone panel."
  - "Called mountRouteMap directly (not renderRouteSection) for the 'ready' state, per 17-11's own SUMMARY guidance, since only mountRouteMap returns the RouteMapHandle the D-26 hover sync needs; renderRouteSection is used for the no-map/no-polyline/error states where no handle is needed, matching detail-map.ts's own '.route-map' wrapper structure manually for the ready case so both paths render identically."
  - "@mapbox/polyline is imported statically at detail.ts's top level (not behind the D-25 boundary) since it's a small, DOM-free decode library already a direct dependency — used only as the startLat/startLng fallback when activity.start_latlng is absent. This does not defeat D-25, which is specifically about Leaflet/Chart.js entering the entry chunk."

requirements-completed: [DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, BROWSE-06]

# Metrics
duration: ~50min
completed: 2026-08-11
---

# Phase 17 Plan 14: Activity Detail Orchestration Summary

**Grew the Phase 16 proving-slice detail view into the full DETAIL-01..05 activity page — eight-tile stats header with gear resolution, prev/next archive nav, lazily-imported route map and chart bands with D-26 hover sync, splits table, and pace/zone breakdown — with every new async render-path step guarded against a superseded navigation.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-11T15:57:13Z
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments

- `detail.ts`'s stats header now renders all eight 17-UI-SPEC § 4a tiles (Distance, Moving Time, Pace, Elevation Gain, Avg HR, Max HR, Cadence, Gear), with the Gear tile resolved via `gearClient.load()` + `resolveGearLabel`'s D-32/D-33 ladder and omitted entirely (never empty-labelled, never a raw id) when unresolved.
- Deleted the Phase-16 `buildStreamSummaryCard` debug card and the private `formatDurationHms` duplicate; both formatters (`formatDurationHms`, `formatPace`, `formatActivityDate`) and `noteViewedActivity` now come from `list.ts`'s single source.
- Added the `‹ Newer` / `Older ›` prev/next archive nav (D-08 companion) resolved from `indexClient.getRows()`'s newest-first ordering, omitting either link at the archive's edges.
- Wired `computeSplits`/`computePaceDistribution`/`computeHrZoneTimes` into `buildSplitsSection`/`buildBreakdownSection`, reusing the same average-pace value already shown in the Pace stat tile; a stream-less activity (23 manual entries) gets a named "No recorded stream" section instead of broken splits/breakdown.
- Added the two D-25 dynamic imports (`await import('./detail-map.js')`, `await import('./detail-charts.js')`) behind `tryImportDetailMap`/`tryImportDetailCharts` helpers that degrade to `null` rather than throw; the route map reads `activity.map?.summary_polyline` (D-23, zero extra requests) and falls back to the first decoded polyline coordinate for `startLat`/`startLng` when `start_latlng` is absent.
- Wired D-26 hover sync: the chart's `onHover(fraction)` calls `routeMapHandle?.setPositionByFraction(fraction)`, a harmless no-op when the map never mounted.
- Every new await point this plan introduces (gear load, athlete-config load, both dynamic imports, both mount calls) is guarded by the literal `myToken !== requestToken || mountedContainer !== container` check (11 occurrences in the final file); `routeMapHandle`/`chartBandsHandle` are destroyed before a new load and in `unmount()`, and a handle created by an already-superseded mount is destroyed immediately rather than assigned.
- Registry (`view-registry.ts`): constructed `gearClient`/`athleteConfigClient` as shared singletons alongside the existing `indexClient`/`detailClient`, additive to the calendar route plan 17-10 already registered.
- Verified the D-25 chunk split against a real build: `dist/widgets/assets/index-B6ipuGeN.js` (dashboard entry chunk) has zero Leaflet/Chart.js occurrences; the async `detail-map-*.js` chunk (154 KB + 15.6 KB CSS) carries 104 Leaflet references and `detail-charts-*.js` carries 7 Chart.js references. `npm run verify-dashboard`: 20/20 checks green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stats header with gear resolution, client wiring, and page chrome** — `1a15a26` (feat)
2. **Task 2: Splits and breakdown sections wired to the computed stream** — `3ff5be6` (feat)
3. **Task 3: Lazy map and chart mounting with stale guards and hover sync** — `e9ba250` (feat)

**Plan metadata:** committed alongside this summary (worktree mode — orchestrator commits SUMMARY.md centrally after merge).

## Files Created/Modified

- `src/dashboard/views/detail.ts` (653 lines) — grown from the Phase 16 proving slice into the full activity detail page: `createDetailView`, `DetailViewDeps`, stats header, prev/next nav, splits/breakdown wiring, `mountRouteMapSection`/`mountChartSection`/`mountHeavySections`, the two D-25 lazy-import helpers, and the shared stale-render guard.
- `src/dashboard/view-registry.ts` (46 lines) — additive: constructs and injects `gearClient`/`athleteConfigClient` into `createDetailView`, alongside the existing calendar route.

## Decisions Made

See `key-decisions` in the frontmatter above — five decisions, all either extending an existing plan-documented pattern (the extra gear-load stale guard, matching T-17-VW-04's own stated rationale) or filling a genuine gap the plan's own text left open (section heading text for Route/Pace & Effort, inferred from 17-UI-SPEC's Typography section; `mountRouteMap` vs. `renderRouteSection` call-site choice, per 17-11's own SUMMARY "Next Phase Readiness" guidance).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Added a stale-render guard after `gearClient.load()`**
- **Found during:** Task 1, wiring the Gear tile.
- **Issue:** The plan's threat model (T-17-VW-04) enumerates the guarded await points as "detail fetch, config load, both dynamic imports" — it does not mention the gear-client load, but `gearClient.load()` is itself a new await point this plan introduces before any DOM is painted. Without a guard, a fast activity-to-activity navigation during a slow gear fetch could paint a wrong-activity stats header into a container a newer load already claims.
- **Fix:** Added the same `myToken !== requestToken || mountedContainer !== container` guard immediately after `await gearClient.load()`, before any DOM is touched.
- **Files modified:** `src/dashboard/views/detail.ts`
- **Verification:** `npx tsc --noEmit` clean; `npm test -- --run` 592/592 green; the guard is one of the 11 total `myToken !== requestToken` occurrences in the final file (acceptance criterion required ≥3).
- **Committed in:** `1a15a26` (Task 1)

**2. [Rule 3 - Blocking, environment setup] Generated missing local data before `verify-dashboard` could run**
- **Found during:** Task 3 verification (`npm run build-widgets && npm run verify-dashboard`).
- **Issue:** This worktree had no `data/dashboard/index.json` or `data/stats/*.json` (both gitignored, locally-generated files) — the same fresh-worktree gap every prior Phase 17 plan (17-11, 17-12, 17-13) hit and documented.
- **Fix:** Ran `npm run build` (compile the Node CLI), `npm run compute-dashboard-index`, and `npm run compute-all-stats` — all pure local recomputation from already-committed `data/activities/`/`data/streams/`, no network calls — then rebuilt widgets. A `data/geo/geo-metadata.json` `generatedAt` timestamp-only side effect from `compute-all-stats` was reverted with `git checkout --` before committing, since it is outside this plan's `files_modified` scope.
- **Files modified:** none committed (only generated gitignored data + a reverted timestamp file).
- **Verification:** `npm run verify-dashboard` went from failing (missing build artifacts) to 20/20 green after regeneration.
- **Committed in:** not applicable — no code change, environment setup only.

---

**Total deviations:** 2 (1 Rule 1 correctness fix in shipped code, 1 Rule 3 environment-setup fix with no code impact)
**Impact on plan:** The gear-load guard closes a genuine race the plan's own threat-model rationale implies should apply everywhere a new await point exists; the environment-setup fix is identical in kind to the same fix already documented in 17-11/17-12/17-13's summaries and has zero effect on shipped code.

## Issues Encountered

The worktree's initial `HEAD` did not match this agent's expected phase-17 base commit (`9711d797...`) — a `git reset --hard` to the expected base was required per the `<worktree_branch_check>` setup step before any file was read or written. Documented here for traceability; not a plan deviation (same class of issue 17-12's summary also recorded).

## User Setup Required

None — no external service configuration required. Leaflet, Chart.js, and `@mapbox/polyline` are all pre-existing, already-installed dependencies; no new package installs this plan.

## Next Phase Readiness

- The full activity detail page (DETAIL-01..05, BROWSE-06) is implemented and ready for plan 17-15's real-browser checkpoint, which is where actual rendering, chunk loading over the network, Vite's async-CSS `<link>` injection (17-RESEARCH.md Assumption A1), and hover-marker behaviour get their first real verification — all deferred here per this plan's own `<verification>` section, consistent with the DOM/Leaflet/Chart.js-is-untestable-under-Node precedent every prior Phase 17 UI plan documented.
- `view-registry.ts`'s `clients` export now carries `gearClient`/`athleteConfigClient` alongside `indexClient`/`detailClient`, available to any future view that needs them without constructing a second instance.
- No blockers for 17-15. `npm test` (592 tests, full suite), `npx tsc --noEmit`, `npm run build-widgets`, and `npm run verify-dashboard` (20/20) are all green against the final state of both modified files.

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/detail.ts
- FOUND: src/dashboard/view-registry.ts
- FOUND: .planning/phases/17-activity-browser-detail-views/17-14-SUMMARY.md
- FOUND: commit 1a15a26 (Task 1)
- FOUND: commit 3ff5be6 (Task 2)
- FOUND: commit e9ba250 (Task 3)
