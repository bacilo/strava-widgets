---
phase: 17-activity-browser-detail-views
plan: 11
subsystem: ui
tags: [typescript, leaflet, code-splitting, route-map, dashboard]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    plan: "01"
    provides: ".route-map / .route-map__canvas / .route-map__caveat class contract in src/dashboard/styles.css, plus the reused .empty-state/.error-state/.text-heading/.text-body/.cta classes"
  - phase: 17-activity-browser-detail-views
    plan: "04"
    provides: "pointAtDistanceFraction — pure, Leaflet-free hover-to-map-position geometry"
provides:
  - "mountRouteMap(container, options) — lazily-imported, light-DOM Leaflet route map with a programmatic circleMarker position indicator, reusing RouteRenderer.renderRoute for decode/bounds-fit"
  - "renderRouteSection(container, state, onRetry) — single entry point for all four route-section states (no-map, no-polyline, error, ready), each with pinned copy"
  - "RouteSectionState discriminated union and RouteMapHandle/MountRouteMapOptions types"
affects: [17-14-detail-distribution-zones]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-25 lazy-chunk boundary placed at the module edge (plain top-level static imports of leaflet/leaflet.css/route-utils), reached only via a dynamic import from outside — first browser-side dynamic import in this dashboard"
    - "L.circleMarker (no icon assets) for a programmatic hover-sync position marker, avoiding the repo's existing default-marker-icon-path bundling workaround entirely"
    - "Decode-once-at-mount, reuse-per-hover pattern for the marker's coordinate array — mirrors the D-22 pace-smoothing module's single-pass-then-interpolate discipline"

key-files:
  created:
    - src/dashboard/views/detail-map.ts
  modified: []

key-decisions:
  - "MountRouteMapOptions gained an optional activityId field beyond the plan's pinned list, because the plan's action text calls for deriving RouteData.id from the activity id but the pinned interface had no id field to derive it from. Kept optional so the field remains fully backward-compatible with the plan's literal shape; falls back to 0 (unused by RouteRenderer.renderRoute) when omitted."
  - "renderRouteSection intentionally returns void and does not surface the RouteMapHandle for the ready case — callers that need setPositionByFraction for hover-marker sync (D-26, wired by 17-14) should call mountRouteMap directly instead, keeping renderRouteSection's signature uniform across all four states."
  - "no-map/no-polyline states use the existing .empty-state class (not .error-state) since they represent 'nothing to show', not a fetch failure — matches styles.css's own documented distinction between the two classes. Only the error (import/decode failure) state mirrors detail.ts's .error-state + Retry shape, per the plan's explicit instruction."

requirements-completed: [DETAIL-02]

# Metrics
duration: ~40min
completed: 2026-08-11
---

# Phase 17 Plan 11: Route Map Summary

**Lazily-imported, light-DOM Leaflet route map (`src/dashboard/views/detail-map.ts`) reusing `RouteRenderer` for decode/bounds-fit, with a programmatic `circleMarker` hover-sync indicator and four pinned-copy route-section states — proven to code-split Leaflet into its own async chunk via a throwaway build probe.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-11
- **Tasks:** 2 completed
- **Files created:** 1 (313 lines)

## Accomplishments

- `mountRouteMap(container, options)` builds a `.route-map__canvas`, mounts a Leaflet map via `RouteRenderer.addBasemapSwitcher` + `RouteRenderer.renderRoute` (theme-resolved accent color, `weight: 4`, `showPopup: false` to avoid `formatPopupContent`'s unescaped-HTML anti-pattern), and returns a `RouteMapHandle` with `setPositionByFraction`/`destroy`.
- The D-26 position marker is an `L.circleMarker` — no icon assets, no `_getIconUrl` workaround — created lazily on first non-null `setPositionByFraction` call and moved (never re-created) on every subsequent call; the polyline backing it is decoded exactly once at mount via `@mapbox/polyline`, reusing 17-04's `pointAtDistanceFraction` for the actual interpolation.
- `renderRouteSection(container, state, onRetry)` is the single entry point for all four states — `no-map` ("No route recorded"), `no-polyline` ("Route unavailable", visibly distinct copy per 17-RESEARCH.md finding #3), `error` (mirrors `detail.ts`'s `.error-state` + Retry), and `ready` (wraps `mountRouteMap` in try/catch, T-17-POLY-01/T-17-MAP-02) — so the three empty/failure copy blocks live in exactly one place.
- The D-25 lazy-chunk boundary is placed at the module's own top level (static imports of `leaflet`, `leaflet/dist/leaflet.css`, `RouteRenderer`) — this is the first browser-side dynamic-import boundary in the dashboard, verified against a real Vite build rather than assumed from documentation (see Verification below).

## Task Commits

1. **Task 1: Lazy-chunk route map mounting on RouteRenderer** — `bfe3edd` (feat)
2. **Task 2: The three route states and lazy-chunk failure handling** — `7c184c9` (feat)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/dashboard/views/detail-map.ts` (313 lines) — `mountRouteMap`, `renderRouteSection`, `RouteSectionState`, `RouteMapHandle`, `MountRouteMapOptions`, plus the three private state-renderer helpers.

## Verification

- `npx tsc --noEmit -p tsconfig.json` — clean, both tasks.
- `npm test -- --run src/dashboard` — 312 passed (no test file added for `detail-map.ts` by design; DOM/Leaflet code is untestable under this repo's `environment: 'node'` vitest config, per 17-RESEARCH.md Pitfall 4 and 17-04's precedent). Full project suite (`npm test -- --run`): 554 passed.
- All 8 source-assertion greps from both tasks' acceptance criteria pass exactly as specified (single leaflet.css import, zero `?inline`/icon-workaround/`formatPopupContent`/`fetch(`/`route-list.json`/`innerHTML` references, exactly one `showPopup: false`, at least one `circleMarker`/`pointAtDistanceFraction`/`try {`, and the three pinned copy strings each appearing exactly once).
- `npm run build-widgets && npm run verify-dashboard`: 20/20 checks green. This worktree had no locally generated `data/stats/` or `data/dashboard/index.json` yet, so `npm run compute-all-stats` and `npm run compute-dashboard-index` were run first (both purely local recomputation from already-committed `data/activities`/`data/streams`, no network calls) — this is environment setup, not a plan deviation; a `data/geo/geo-metadata.json` timestamp side-effect from that recomputation was reverted before committing since it's outside this plan's `files_modified` scope.
- **D-25 build-output proof:** the real `npm run build-widgets` output confirms the D-25 negative half directly — `dist/widgets/assets/index-*.js` (the dashboard's actual entry chunk) contains zero Leaflet references, because nothing in the codebase imports `detail-map.ts` yet (that wiring is plan 17-14's job, a later wave). To prove the positive half (Vite actually *splits* this specific module into an async chunk with an accompanying CSS asset, rather than this being an untested assumption), a throwaway, never-committed probe entry (`src/dashboard/__probe-detail-map.ts`, deleted after use) forced a dynamic `import('./views/detail-map.js')` and was built through Vite's real dashboard build config (`root: src/dashboard`, `base: './'`). Result: the probe's own entry chunk contained 0 occurrences of "leaflet" (case-insensitive grep) while the resulting async chunk (`detail-map-*.js`, 401 KB) contained 112, with a `detail-map-*.css` asset (19 KB, the Leaflet stylesheet) emitted alongside it — confirming Vite splits rather than silently drops the CSS import. Resolved asset directory for both checks: `dist/widgets/assets/` (not `dist/widgets/dashboard/assets/` as the plan's verification text names — matches the same pre-existing path correction already recorded in 17-01's SUMMARY).
- Real map rendering, tile styling (the Pitfall 5/Assumption A1 async-CSS question), and hover-marker behaviour remain untestable under Node and are explicitly deferred to plan 17-15's real-browser checkpoint, per the plan's own `<verification>` section.

## Decisions Made

- Added an optional `activityId` field to `MountRouteMapOptions` (see key-decisions above) to give the plan's own "derive `RouteData.id` from the activity id" instruction something to read, since the pinned interface omitted an id field entirely. This is additive and backward-compatible — every literally-pinned field remains present and required exactly as specified.
- Used `.empty-state` (not `.error-state`) for the `no-map`/`no-polyline` states, reserving `.error-state` + Retry strictly for the `error` (import/decode failure) case, matching both the plan's explicit "mirror `detail.ts`'s `renderErrorState`" instruction (scoped only to the error case) and `styles.css`'s own documented empty-state/error-state distinction.
- Chose the discriminated-union + single-dispatcher shape (`RouteSectionState` + `renderRouteSection`) over the plan's alternative "small exported builders" shape, since it more directly matches the plan's literally-declared function signature and keeps the try/catch wrapping in one obvious place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - missing critical functionality, spec gap] Added optional `activityId` field to `MountRouteMapOptions`**
- **Found during:** Task 1, while implementing `RouteData.id` derivation.
- **Issue:** The plan's action text ("derive `RouteData.id` with `Number.parseInt` on the numeric portion of the activity id and fall back to `0` when the id is `i`-prefixed") assumes an activity id is available in `options`, but the plan's own pinned `MountRouteMapOptions` interface (listed verbatim in the action text) has no id field at all.
- **Fix:** Added an optional `activityId?: string` field, documented inline with the rationale. `deriveRouteId` reads it when present and falls back to `0` (a value `RouteRenderer.renderRoute` never reads, so the fallback has zero rendering effect) when absent — satisfying both the letter of the pinned interface (every originally-listed field is still present, unchanged) and the intent of the derivation instruction.
- **Files modified:** `src/dashboard/views/detail-map.ts`
- **Verification:** `npx tsc --noEmit` clean; the field is optional so no caller is forced to supply it.
- **Committed in:** `bfe3edd` (Task 1)

**2. [Rule 3 - blocking issue] Generated missing local data before `verify-dashboard` could run**
- **Found during:** Task 2 verification (`npm run verify-dashboard`).
- **Issue:** This worktree had no `data/dashboard/index.json` or `data/stats/*.json` — both are gitignored, locally-generated files, and this fresh worktree had never run the generation pipeline. `verify-dashboard` failed with a `FATAL: dist/widgets is not fully built` error unrelated to any Task 2 code change.
- **Fix:** Ran `npm run build` (compile the Node CLI), `npm run compute-dashboard-index`, and `npm run compute-all-stats` — all pure local recomputation from already-committed `data/activities/`/`data/streams/` files, no network calls, no credentials needed — then rebuilt widgets. A `data/geo/geo-metadata.json` timestamp-only side effect from `compute-all-stats` was reverted with `git checkout --` before committing, since it falls outside this plan's `files_modified` scope.
- **Files modified:** none committed (only generated gitignored data + a reverted timestamp file).
- **Verification:** `npm run verify-dashboard` went from 18/20 to 20/20 after regeneration.
- **Committed in:** not applicable — no code change, environment setup only.

---

**Total deviations:** 2 (1 Rule 2 spec-gap fix in shipped code, 1 Rule 3 environment-setup fix with no code impact)
**Impact on plan:** Zero impact on the module's documented export surface or behavior; both fixes closed gaps between the plan's own text and either its pinned interface or this fresh worktree's local data state.

## Known Stubs

None. The `no-map`/`no-polyline`/`error` states are intentional, spec-required UI states (not stubs) — each renders real, pinned copy in place of the map, exactly as 17-UI-SPEC §4b requires.

## Threat Flags

None. All three trust boundaries this module touches (polyline decode, third-party tile requests, dynamically-imported chunk resolution) are already covered by the plan's own `<threat_model>` STRIDE register (T-17-POLY-01, T-17-VW-01, T-17-MAP-01/02/03) and implemented exactly as dispositioned there — no new surface introduced beyond what the plan anticipated.

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## User Setup Required

None — no external service configuration required. (The local data regeneration above used only already-committed repository data, no credentials.)

## Next Phase Readiness

- `mountRouteMap`, `renderRouteSection`, `RouteSectionState`, `RouteMapHandle`, and `MountRouteMapOptions` are all exported and ready for plan 17-14 to reach via `await import('./detail-map.js')` from `detail.ts`.
- Plan 17-14 should call `mountRouteMap` directly (not `renderRouteSection`) for the `ready` case specifically when it needs the returned `RouteMapHandle` to drive `setPositionByFraction` from chart hover events (D-26); `renderRouteSection` remains the convenient one-call path for the three non-hover-driving states plus a self-contained `ready` mount when hover sync isn't needed by the caller.
- The D-25 async-chunk split is verified structurally (throwaway probe build, documented above) but not yet in a real browser — that confirmation is explicitly plan 17-15's job, per this plan's own `<verification>` section and 17-RESEARCH.md Assumption A1.
- No blockers for 17-14 or 17-15.

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/detail-map.ts
- FOUND commit bfe3edd
- FOUND commit 7c184c9
