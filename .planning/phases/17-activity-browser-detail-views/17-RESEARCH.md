# Phase 17: Activity Browser & Detail Views - Research

**Researched:** 2026-08-11
**Domain:** Client-side data browsing/filtering, calendar grids, and multi-series charting over a static-hosted vanilla-TS SPA (no framework, no backend)
**Confidence:** HIGH — this phase extends an existing, fully-inspected codebase rather than introducing new technology. Every stack/library claim below was verified directly against this repo's `node_modules`, source, and committed data, not against training-data assumptions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Activity list — layout and sorting**
- **D-01:** Sortable table on desktop, existing card rows on mobile. A real `<table>` with clickable column headers above roughly 700px; below that the view falls back to Phase 16's `renderActivityRow` card layout.
- **D-02:** Desktop columns: date, name, distance, moving time, pace, avg HR — every BROWSE-02 sort key is visible and clickable — plus the existing badges inline (no streams / no HR / low confidence / excluded from records / PR count). Elevation and location stay on the detail page.
- **D-03:** Sort by clicking column headers. Second click flips direction; the active column shows a direction arrow and carries `aria-sort`. Mobile card mode gets a compact sort dropdown as the equivalent control.
- **D-04:** Two row renderers, each with one job. `renderActivityRow` stays the shared card renderer used by the overview's recent-activities and by the list's mobile mode; the table row builder is list-only. The overview does NOT become a mini table. No date/pace formatter may be duplicated in either (16-12 rule: one `formatActivityDate`, one `formatPace`).

**Activity list — scale and pagination**
- **D-05:** Numbered pagination, not infinite scroll and not a virtualizer. Changing sort or filters resets to page 1.
- **D-06:** 50 rows per page (~38 pages over the archive). Phase 16's newest-100 truncation notice is a placeholder and must be removed.
- **D-07:** Full list state lives in the hash query string — sort key, direction, page, and every active filter (e.g. `#/list?sort=pace&dir=asc&page=3&dmin=10`).
- **D-08:** Return-from-detail restores position. Coming back to the list restores page and sort from the URL and scrolls the just-viewed activity's row into view with a brief highlight — no separate session storage needed.

**Activity list — filters and search**
- **D-09:** Always-visible search box and chips row; range filters behind a collapsible "Filters" panel. No new shell layout — nothing like a sidebar rail.
- **D-10:** Range entry is presets plus numeric min/max. Quick chips for common cases (5k, 10k, HM+, marathon+; This year, Last 12 months) alongside plain min/max inputs for date, distance, pace, and duration. No dual-thumb sliders. Both forms must serialize cleanly into the query string (D-07).
- **D-11:** AND semantics with a live, debounced result count. All active filters narrow together; the count updates as you type (~150–250ms debounce on text, immediate on chips/presets). The whole index is already in memory — no refetch.
- **D-12:** One removable chip per active filter, plus Clear all at two or more. Each chip names its constraint. Zero matches renders a proper empty state that names the active filters and offers a one-click clear — never a blank table.

**Calendar training log**
- **D-13:** Month grid with prev/next navigation, a month/year jump, and a month-total header (distance + run count). Bookmarkable as `#/calendar?month=YYYY-MM`. Not a year heatmap, not continuously scrolling months.
- **D-14:** Day cell shows the day's total km as text, with the cell tinted by distance using the existing orange accent scale. Rest days render a plain dash. Distance must be readable without hovering (there is no hover on mobile).
- **D-15:** Multi-run days show the day total plus a run-count marker (e.g. "×2"); clicking a multi-run day opens a compact per-run picker, while a single-run day navigates straight to its detail view.
- **D-16:** The calendar is never filtered. It keeps state fully independent of the list's filters. Separate URL contract, no shared filter state.

**Detail — charts**
- **D-17:** Stacked per-channel bands on one shared x-axis: pace, HR, cadence, elevation, each its own short chart, vertically aligned. Each keeps its own readable y-scale; an absent channel simply omits its band rather than breaking a shared axis.
- **D-18:** Each band takes up to two optional shaded companion overlays, chosen per band. Independent per-chart checkbox pickers (not one global control). Capped at two companions per band for legibility.
- **D-19:** Overlays render on their own auto-scaled but undrawn y-axis, as a low-opacity filled area behind the full-contrast primary line. No competing right-hand tick labels; the tooltip reports the overlay's true value with units. Overlays are never normalized to a percentage.
- **D-20:** Overlay configuration persists in localStorage, same persistence approach as the existing theme choice. Not in the URL.
- **D-21:** X-axis is distance by default, with a toggle to elapsed time. Both series come straight from the stream's `t` and `d` arrays.
- **D-22:** Pace is smoothed for presentation only, then decimated. A rolling window (~15–30s) tames 1 Hz Δd/Δt spikiness before plotting, and Chart.js's LTTB decimation plugin caps drawn points. Raw values still drive the splits table and stats — smoothed values are never persisted and never feed a computation.

**Detail — route map**
- **D-23:** The polyline comes from the activity's own detail JSON (`data/activities/<id>.json` → `map.summary_polyline`), which the detail view already fetches. Zero extra requests, zero extra bytes. Do NOT fetch `data/routes/route-list.json`, and do NOT add a new per-activity route pipeline output.
- **D-24:** A dashboard-native map module that imports the shared `RouteRenderer`/`route-utils` helpers directly. The `<single-run-map>` custom element is not embedded. Share the rendering logic, not the widget lifecycle.
- **D-25:** Leaflet and Chart.js load via lazy dynamic import on first detail-view open — not a CDN script tag, not statically bundled into the SPA entry. List, calendar, and overview never pay for them.
- **D-26:** Hover syncs a crosshair across every band and a position marker on the route map. **Known limit, to be represented honestly:** committed streams carry no lat/lng by design, so the map position is interpolated by cumulative distance along the simplified `summary_polyline` — approximate, not survey-exact.

**Detail — splits, zones, and the stats header**
- **D-27:** Seven-column splits table: km, pace, cumulative elapsed time, avg HR, avg cadence, elevation Δ, and a horizontal bar showing the split against the activity's average pace. Columns for absent channels render an em dash. **Planning must solve the responsive story** — seven columns will not fit a phone; column collapse or horizontal scroll within its own container is required, and the page body must never scroll horizontally.
- **D-28:** The final partial kilometre is shown, labelled with its real distance (e.g. "0.4 km") and visually marked as partial, so the splits sum to the actual activity distance.
- **D-29:** Both breakdowns, with different availability rules. A pace-distribution histogram always renders. An HR-zone time breakdown renders additionally when threshold config exists and the activity has HR.
- **D-30:** HR zones come from a committed athlete config file (e.g. `data/athlete.json`) holding max HR plus explicit bpm boundaries between the five zones — not derived from the archive's observed max and not relative to each activity's own peak. Phase 18's TRIMP training load will read the same file.
- **D-31:** Missing config or missing HR hides the zone panel entirely, while the pace histogram carries DETAIL-05 on its own. No placeholder box, no fabricated zones.
- **D-32:** Gear resolves through a hand-written `data/gear.json` id→name map. Only 16 distinct `gear_id` values exist across the archive. Unmapped ids must fall back gracefully rather than rendering a raw `g16649854`.
- **D-33:** When gear is unknown, fall back to `device_name` if present, otherwise omit the tile. Never render an empty-labelled tile.

### Claude's Discretion
- Detail-page section order and the exact stats-header tile set (DETAIL-01 names distance, time, pace, elevation, avg/max HR, cadence, gear — arrangement and grouping are open).
- Text-search matching semantics (case-insensitive substring vs token matching; whether `location` is searched alongside `name`). Whatever is chosen, athlete-authored `name` is untrusted and must be rendered with `textContent`.
- Exact rolling-window size, decimation thresholds, and pace-bucket widths for the histogram.
- Prev/next activity navigation from within a detail view, and keyboard navigation for the table and calendar grid.
- Whether the collapsible filter panel's open/closed state persists, and its exact breakpoint (alongside the ~700px table/card switch).
- Concrete schema and file names for `data/athlete.json` and `data/gear.json` — follow existing `data/` conventions (schemaVersion, generated_at/note where applicable) and decide whether they are committed hand-maintained inputs (they should be) versus generated output.
- How the splits table collapses on narrow screens (which columns drop first).
- Module decomposition: how much of filter/sort/paginate logic is pure and unit-tested separately from DOM rendering.

### Deferred Ideas (OUT OF SCOPE)
- Year-over-time consistency heatmap (GitHub-style 53×7 year grid colored by distance) — user wants this, routed to Phase 18 (Records, Trends & Differentiators). Not a `#/calendar?mode=year` toggle in this phase.
- Gear as an index field / gear filtering in the browser — `data/gear.json` lands here for the detail header only. Putting gear into the published index is Phase 18's gear-aware-trends territory.
- Pace/speed color coding along the route polyline — already in PROJECT.md's future-vision list; the detail map ships as a plain route with a hover marker.
- Native device-recorded laps table with a splits/laps toggle — already tracked as DETAIL-06 in REQUIREMENTS.md's deferred set (needs FIT lap-marker recovery). D-27's splits are auto-computed from streams only.
- Records/PR presentation and trends (`#/records`, `#/trends` stay Phase 18 stubs), any change to the index-manifest or stream contracts, any new per-activity pipeline output.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BROWSE-01 | User can browse a paginated list of all activities (1,867+) | Numbered pagination over the already in-memory `IndexClient` rows (D-05/D-06); see Standard Stack, Architecture Patterns, Validation Architecture test map |
| BROWSE-02 | User can sort the list by date, distance, pace, duration, and heart rate | Pure sort comparators, unit-testable per Pitfall 4; D-02/D-03 column/header-click contract |
| BROWSE-03 | User can filter by date range and by distance/pace/duration ranges | Pure filter predicates, AND semantics, presets+min/max (D-10/D-11); local in-memory array pass, no refetch needed given confirmed index size (Pitfall 3) |
| BROWSE-04 | User can text-search activities by name | Pure predicate function, `textContent` XSS constraint carried into Security Domain |
| BROWSE-05 | User can view a calendar/month-grid training log | New `calendar.ts` replacing the stub; pure month-grid/group-by-day math isolated per Pitfall 4; D-13..D-16 |
| BROWSE-06 | Active filters show as removable chips with a result count, and missing-data states render cleanly | Chip serialization logic (D-12); missing-data patterns already established by existing `renderActivityRow` badges (D-04) |
| DETAIL-01 | Stats header per activity (distance, time, pace, elevation, avg/max HR, cadence, gear) | Existing `detail.ts` stat-card pattern extends directly; gear resolution verified against real field-presence counts (Pitfall 2); new `data/gear.json` + client (D-32/D-33, Pitfall 8) |
| DETAIL-02 | Route map on the detail page, reusing existing map infrastructure | `RouteRenderer` reuse (D-24, Pattern 2/Don't-Hand-Roll), polyline already in fetched detail JSON (D-23, verified presence Pitfall 2), lazy import (D-25, Pattern 3, Pitfall 5/6) |
| DETAIL-03 | Pace, HR, cadence, elevation charts over distance/time from streams | Chart.js 4.5.1 + built-in LTTB Decimation (Standard Stack, verified via `node_modules`), stacked bands + overlays (D-17..D-22), irregular-sample handling (Pitfall 1) |
| DETAIL-04 | Auto-computed per-km splits table | Reused exact-crossing interpolation technique from `best-effort-utils.ts` (Pattern 2, Code Examples), partial-km handling (D-28) |
| DETAIL-05 | Pace-distribution/zone breakdown per activity | Pace histogram always-on + HR-zone conditional-on-config (D-29..D-31), new `data/athlete.json` + client (Pitfall 8), irregular-sample time-weighting (Pitfall 1) |
</phase_requirements>

## Summary

Phase 17 is pure extension of the Phase 16 shell, using tools already installed and patterns already established — no new npm dependency is required. The list, calendar, and detail views are three more entries in the existing `VIEWS` registry (`src/dashboard/view-registry.ts`), following the exact mount/unmount/stale-guard shape that `list.ts`, `detail.ts`, and `overview.ts` already demonstrate. Chart.js 4.5.1 (with its built-in LTTB `Decimation` plugin) and Leaflet 1.9.4 are already dependencies; the shared `RouteRenderer` in `src/widgets/shared/route-utils.ts` already does polyline decode + bounds-fit + hover and is directly importable by a new, non-Shadow-DOM map module.

The two real engineering risks in this phase are not "which library" but "how do you keep 1,867 rows and per-activity streams cheap on a static host," and "how do you compute splits/zones correctly off irregularly-sampled, per-era-inconsistent data." On the first: the published index (`data/dashboard/index.json`) is 1.22 MB uncompressed (not the ~300-500 KB the Phase 16 code comment estimates — verify this, it changes the "is client-side filtering fine" answer, though at 1,867 rows an in-memory array-filter pass is still trivially fast regardless). On the second: streams are NOT uniformly 1 Hz (samples are irregular, e.g. `t = [0,1,5,10,14,16,...]`), and the codebase already has a proven, reusable technique for interpolating an exact-distance crossing point (`findBestEffort` in `src/analytics/best-effort-utils.ts`) that splits computation should mirror rather than re-derive independently.

A third real risk, specific to this repo's history: Phase 16 shipped a "15/15 green but the production site was a black page" defect because its own verifier asserted a URL shape production doesn't have (root-mounted, not project-path-mounted). Any new committed input this phase adds (`data/athlete.json`, `data/gear.json`) — and any lazily-imported JS/CSS chunk (Leaflet, Chart.js, `leaflet/dist/leaflet.css`) — must be proven to resolve under the same `/strava-widgets/` project-path mount that `scripts/verify-dashboard-publish.mjs` already enforces for the initial bundle. Nothing currently exercises a *dynamically imported* chunk through that verifier; this phase is the first to add one.

**Primary recommendation:** Build three new view modules (`list.ts` full rewrite, `calendar.ts` replacing the stub, `detail.ts` extended in place) using only already-installed dependencies, decompose all sort/filter/paginate/split/zone/pace-bucket logic into pure, `environment: 'node'`-testable functions separate from DOM-rendering functions (this repo has no jsdom and never unit-tests DOM), reuse `RouteRenderer` and the best-effort engine's crossing-point interpolation technique rather than writing new versions, and extend (not fork) `scripts/build-widgets.mjs`'s `copyDataFiles` and `scripts/verify-dashboard-publish.mjs` for every new committed data file and lazy-loaded chunk.

## Architectural Responsibility Map

This is a static-hosted, single-tier SPA (GitHub Pages, no backend, no server-rendering). All capabilities below live in one tier: **Browser / Client**, split only by *when* code runs (build-time Node compute steps vs. runtime browser code).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Activity list sort/filter/paginate | Browser / Client (runtime) | Build-time Node (index generation, Phase 16, unchanged) | The full index is already fetched once into memory (`IndexClient`); sort/filter/paginate is a pure in-memory array pass, no new backend or refetch |
| Filter/sort/page URL state | Browser / Client (runtime, hash router) | — | `parseHash`/`matchRoute`/`navigateTo` already own hash+query parsing (Phase 16); this phase adds new query keys, not a new state mechanism |
| Calendar month grid | Browser / Client (runtime) | — | Derived from the same in-memory index, grouped by `startDateLocal`; no new data source |
| Route map rendering | Browser / Client (runtime, lazy-loaded) | — | Leaflet + `RouteRenderer` render client-side from the polyline already embedded in the per-activity detail JSON; no map tile server is owned by this project (third-party CARTO/OSM tiles) |
| Multi-series charts (pace/HR/cadence/elevation) | Browser / Client (runtime, lazy-loaded) | — | Chart.js renders client-side from the per-activity stream JSON already fetched by `DetailClient` |
| Per-km splits computation | Browser / Client (runtime) | — | **Not** a build-time compute step — CONTEXT.md D-04 explicitly forbids a new per-activity pipeline output; splits are derived on the fly from the already-fetched stream, mirroring how `paceSecPerKm` is already derived client-side in `detail.ts` |
| Pace-distribution / HR-zone breakdown | Browser / Client (runtime) | Committed config (`data/athlete.json`, build-time hand-maintained input) | Bucketing logic runs client-side over the fetched stream; zone *boundaries* come from a committed, hand-maintained config file, not a live computation |
| Gear label resolution | Browser / Client (runtime) | Committed config (`data/gear.json`, build-time hand-maintained input) | `gear_id` → name mapping is a static lookup table, not computed; the map itself is authored once, by hand, and fetched client-side like `data/athlete.json` |
| Data publish/copy | Build-time Node (`scripts/build-widgets.mjs`) | — | Any new committed JSON this phase adds must flow through `copyDataFiles` into `dist/widgets/data/` or it 404s in production — the exact Phase 16 failure mode |
| Production URL-shape verification | Build-time Node (`scripts/verify-dashboard-publish.mjs`) | — | Must be extended, not bypassed, for every new fetch URL and every new lazy-loaded chunk this phase introduces |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chart.js | 4.5.1 (installed; matches latest npm `chart.js@4.5.1` `[VERIFIED: npm registry]`) | Pace/HR/cadence/elevation bands, pace-distribution histogram | Already the dashboard's charting library (`src/widget/chart-config.ts` et al.); ships a built-in `Decimation` plugin with LTTB support confirmed present in `node_modules/chart.js/dist/types/index.d.ts` (`export declare const Decimation: Plugin`) — no separate decimation package needed |
| leaflet | 1.9.4 (installed; matches latest npm `leaflet@1.9.4` `[VERIFIED: npm registry]`) | Route map rendering | Already the dashboard's map library; `RouteRenderer` (`src/widgets/shared/route-utils.ts`) already wraps it with decode/bounds-fit/hover |
| @mapbox/polyline | 1.2.1 (installed; matches latest npm `@mapbox/polyline@1.2.1` `[VERIFIED: npm registry]`) | Decodes `activity.map.summary_polyline` | Already a dependency, already used inside `RouteRenderer.renderRoute` |

No new runtime dependency is required for this phase. `npm view chart.js version`, `npm view leaflet version`, and `npm view @mapbox/polyline version` were run against the live npm registry and each matches the version already pinned in `package.json` and installed in `node_modules` — training-data version numbers were NOT relied on; every version above was confirmed by direct registry query. `[VERIFIED: npm registry]`

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 (installed) | Unit tests for pure sort/filter/paginate/split/zone-bucket logic | Every new pure function this phase adds, following the existing `*.test.ts` colocated convention |
| vite | ^7.3.1 (installed) | Dev server + production build, including code-splitting for the lazy Leaflet/Chart.js dynamic imports (D-25) | Already builds the dashboard SPA (`buildDashboard()` in `scripts/build-widgets.mjs`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js LTTB decimation | A dedicated downsampling library (e.g. `downsample-lttb`) | Chart.js already ships LTTB built in (`DecimationAlgorithm.Lttb`); an extra package would duplicate functionality already present and is explicitly what CONTEXT.md D-22 names ("Chart.js's LTTB decimation plugin") |
| Hand-rolled month-grid calendar | A calendar library (e.g. FullCalendar, `react-calendar`) | This is a vanilla-TS, framework-free codebase (16-D01) rendering a single month at a time with ~35-42 day cells; a full calendar library brings a large bundle and a component model this project deliberately does not use. A month grid is `<table>`/`<div>` + date-math, well within the project's existing hand-rolled patterns (activity list, stat grids) |
| Custom crossing-point interpolation for splits | Re-deriving a new interpolation routine from scratch | `src/analytics/best-effort-utils.ts`'s `findBestEffort` already contains the exact linear-interpolation-at-crossing technique this needs (see Code Examples below) — reuse the *technique*, not necessarily the function signature, since splits are sequential fixed boundaries rather than a sliding best-window search |

**Installation:** None required — every library above is already present in `package.json`/`node_modules`.

## Package Legitimacy Audit

**Not applicable — this phase installs no new external packages.** All three libraries used (`chart.js`, `leaflet`, `@mapbox/polyline`) are pre-existing dependencies already vetted and in production use elsewhere in this codebase (widget system). No `slopcheck` run was necessary; no `[ASSUMED]` package names appear in this research.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │        GitHub Pages (static host)         │
                     │   dist/widgets/ served at /strava-widgets/ │
                     └─────────────────────────────────────────┘
                                       │  HTTP GET (relative URLs, base: './')
                                       ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Dashboard SPA (single index.html, hash routing, light DOM)           │
  │                                                                        │
  │  main.ts ── router.ts (hashchange) ── view-registry.ts (VIEWS map)    │
  │                                             │                          │
  │        ┌────────────────────┬───────────────┼───────────────┐         │
  │        ▼                    ▼                ▼               ▼         │
  │   list.ts (NEW)        calendar.ts (NEW)  detail.ts (grown) overview.ts│
  │   fetch once via       derived from       fetch per-id via  (unchanged)│
  │   IndexClient (cached) IndexClient rows   DetailClient       │
  │        │                    │                │                        │
  │        ▼                    ▼                ▼                        │
  │  ┌──────────────┐    ┌──────────────┐  ┌──────────────────────────┐  │
  │  │ pure: sort/   │    │ pure: group- │  │ pure: splits/zones/pace- │  │
  │  │ filter/       │    │ by-day, month│  │ bucket derivation        │  │
  │  │ paginate      │    │ math          │  │ (from CanonicalStream)   │  │
  │  │ (unit tested) │    │ (unit tested)│  │ (unit tested)            │  │
  │  └──────┬────────┘    └──────┬───────┘  └───────────┬──────────────┘  │
  │         ▼                    ▼                       ▼                │
  │  table/card DOM        month-grid DOM         stats header +          │
  │  render (manual         render (manual         lazy-loaded chart      │
  │  verify — no jsdom)    verify — no jsdom)      bands + lazy-loaded    │
  │                                                 route map (manual     │
  │                                                 verify — no jsdom)    │
  │                                                       │                │
  │                                          dynamic import() on first    │
  │                                          detail-view open:            │
  │                                          Leaflet + Chart.js chunks    │
  └──────────────────────────────────────────────────────────────────────┘
           │ fetch (once, memoized)         │ fetch (lazy, per-id, cached)
           ▼                                ▼
  data/dashboard/index.json          data/activities/<id>.json
  (1.22 MB, all 1,867 rows)          data/streams/<id>.json
                                      data/athlete.json (NEW)
                                      data/gear.json (NEW)
```

### Recommended Project Structure
```
src/dashboard/
├── views/
│   ├── list.ts                    # rewritten: mount/unmount + DOM only
│   ├── list-logic.ts              # NEW: pure sort/filter/paginate/URL-state (unit tested)
│   ├── calendar.ts                # NEW: replaces calendar.stub.ts; mount/unmount + DOM only
│   ├── calendar-logic.ts          # NEW: pure month-grid/group-by-day math (unit tested)
│   ├── detail.ts                  # grown in place: stats header + orchestration
│   ├── detail-charts.ts           # NEW: lazy Chart.js band setup, dynamic import boundary
│   ├── detail-map.ts              # NEW: lazy Leaflet setup, imports RouteRenderer directly
│   ├── detail-splits.ts           # NEW: pure per-km split computation (unit tested)
│   └── detail-zones.ts            # NEW: pure pace-bucket + HR-zone bucketing (unit tested)
├── data/
│   ├── athlete-config-client.ts   # NEW: fetch data/athlete.json, tolerant of 404/malformed
│   └── gear-client.ts             # NEW: fetch data/gear.json, tolerant of 404/malformed
data/
├── athlete.json                   # NEW: committed, hand-maintained (schema: Claude's discretion)
└── gear.json                      # NEW: committed, hand-maintained (schema: Claude's discretion)
```

### Pattern 1: Fetch-once client + pure derivation, DOM as the last step
**What:** Every existing view (`overview.ts`, `list.ts`, `detail.ts`) follows: fetch/derive data → guard against stale mount (`mountedContainer !== ctx.container`) → build DOM with `document.createElement` + `textContent` → append. No view manipulates `innerHTML` with interpolated data.
**When to use:** Every new view/sub-view this phase adds (list table, calendar grid, splits table, zone panel).
**Example:**
```typescript
// Source: src/dashboard/views/detail.ts (this repo)
async function loadAndRender(container: HTMLElement, id: string): Promise<void> {
  const myToken = ++requestToken;
  // ...loading indicator...
  let detail: ActivityDetail;
  try {
    detail = await detailClient.loadDetail(id);
  } catch (error) {
    if (myToken !== requestToken || mountedContainer !== container) return; // stale-guard
    renderErrorState(container, { onRetry: () => void loadAndRender(container, id) });
    return;
  }
  if (myToken !== requestToken || mountedContainer !== container) return; // stale-guard again
  renderSuccess(container, detail, indexClient);
}
```

### Pattern 2: Exact-distance-crossing interpolation (reuse for splits)
**What:** `findBestEffort` never snaps to the nearest sample; it linearly interpolates the exact time a cumulative-distance boundary is crossed. Per-km splits need the same boundary-crossing math, just walked forward sequentially (0km, 1km, 2km, ...) instead of searched as a sliding window.
**When to use:** DETAIL-04 per-km splits table; DETAIL-05's pace-distribution bucketing should also interpolate rather than bucket by raw sample (irregular sample spacing, see Common Pitfalls).
**Example:**
```typescript
// Source: src/analytics/best-effort-utils.ts (this repo), lines 112-126 — the technique to mirror
for (let i = 0; i < n; i++) {
  if (j < i + 1) j = i + 1;
  while (j < n && d[j] - d[i] < targetMeters) j++;
  if (j >= n) break;
  // Linear interpolation at the exact crossing — never snap to d[j]/t[j].
  const needed = targetMeters - (d[j - 1] - d[i]);
  const segMeters = d[j] - d[j - 1];
  const frac = segMeters > 0 ? needed / segMeters : 0;
  const crossingTime = t[j - 1] + frac * (t[j] - t[j - 1]);
}
```
For sequential splits, drop the two-pointer sliding search and simply walk `d[]` once looking for each successive `km * 1000` boundary — O(n), single forward pass, same interpolation formula.

### Pattern 3: Lazy dynamic import at the detail-view boundary (D-25)
**What:** No existing browser-side code in this dashboard currently uses a dynamic `import()` (the codebase's only `import()` usages are in the Node CLI, `src/index.ts`, and `src/exports/geometry-readers.ts` for `@garmin/fitsdk` — confirmed via grep). This phase is the first to introduce a lazy browser chunk, so there is no in-repo precedent to copy; use Vite's standard dynamic-import code-splitting, which the dashboard's `buildDashboard()` config (root: `src/dashboard`, `base: './'`) already supports without extra configuration.
**When to use:** The moment a detail view actually needs to draw a chart or map — never at module top-level, never in list/calendar/overview.
**Example:**
```typescript
// New pattern for this phase — not yet in the repo, follow Vite's documented dynamic import
async function mountRouteMap(container: HTMLElement, polyline: string): Promise<void> {
  const [{ default: L }, { RouteRenderer }] = await Promise.all([
    import('leaflet'),
    import('../../widgets/shared/route-utils.js'),
  ]);
  await import('leaflet/dist/leaflet.css'); // side-effect import, NOT the `?inline` widget variant — see Pitfall 5
  // ...
}
```

### Anti-Patterns to Avoid
- **Per-view re-fetch of the index:** `IndexClient.loadIndex()` already memoizes; list/calendar/overview must all call the same shared `clients.indexClient` instance from `view-registry.ts`, never construct a second client.
- **Duplicating `formatActivityDate`/`formatPace`:** Both carry defect-driven fixes (Z-suffix timezone handling; single-rounding-step m:ss). Import from `list.ts`, never reimplement.
- **A second polyline-fetch path:** Do not fetch `data/routes/route-list.json` from the detail view (2.4 MB, misses ~28 activities per D-23) — the polyline is already inside the already-fetched `data/activities/<id>.json`.
- **Embedding `<single-run-map>`:** It is Shadow-DOM-encapsulated and owns its own fetch with no polyline-injection API — reuse `RouteRenderer` directly instead (D-24).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exact-distance boundary crossing time | A new interpolation formula | Mirror `findBestEffort`'s linear-interpolation-at-crossing technique (`best-effort-utils.ts`) | Already correct, already tested against 1,843 real streams; a second, slightly different implementation is a second place for the exact defect class (`RESEARCH.md`-documented rounding bugs) to reappear |
| LTTB downsampling for chart rendering | A custom decimation algorithm or a new npm package | Chart.js's built-in `Decimation` plugin (`DecimationAlgorithm.Lttb`), confirmed present in the installed 4.5.1 | Already installed, already the CONTEXT.md D-22 decision, zero new bytes |
| Polyline decode / bounds-fit / hover-highlight | New Leaflet wiring in the dashboard | `RouteRenderer` (`src/widgets/shared/route-utils.ts`) — `renderRoute`, `addHoverEffect` | Already handles the "single-point route" bounds-fallback edge case and the Strava-orange default styling; duplicating it is exactly what D-24 forbids |
| Date/pace formatting | New formatters in `calendar.ts`/`detail.ts` | `formatActivityDate`, `formatPace` from `list.ts` | Both fixed real defects that hit real data (11 of 1,867 rows for the pace rounding bug); a third copy reintroduces the risk class |
| Theme-style persisted UI preference (overlay config, D-20) | A generic settings-store abstraction | The same direct, allow-listed localStorage read/write pattern as `theme.ts` (`parseThemeMode`-style validation, try/catch around `getItem`/`setItem`) | `theme.ts`'s tamper-guard pattern (never trust a raw localStorage string; allow-list valid values, fall back safely) is the established, security-reviewed precedent for exactly this kind of persisted client preference |

**Key insight:** Every "hard part" of this phase already has a correct, tested analog somewhere in the repo (interpolation math in the best-effort engine, map rendering in `route-utils`, formatting in `list.ts`, tamper-safe persistence in `theme.ts`). The actual net-new logic is comparatively small: table sorting/pagination, month-grid date math, and bucketing values into pace/HR-zone histograms.

## Common Pitfalls

### Pitfall 1: Assuming stream samples are uniformly spaced
**What goes wrong:** Splits, pace smoothing, and pace-distribution buckets computed by naive per-index averaging (e.g., "average every 15 samples") silently misweight time, because samples are not 1-per-second.
**Why it happens:** The `CanonicalStream.t` array is irregular — verified directly: `t[:10] = [0, 1, 5, 10, 14, 16, 18, 20, 22, 24]` for a real committed stream file (`data/streams/10041312551.json`). GPS/FIT recording intervals vary by device and by GPS lock quality.
**How to avoid:** Any time-window operation (rolling-average smoothing for D-22, pace-distribution time-per-bucket for DETAIL-05) must weight by actual `Δt` between consecutive samples, not by sample count. Any distance-boundary operation (splits) must linearly interpolate at the boundary, mirroring `findBestEffort` (see Code Examples).
**Warning signs:** A "smoothed" pace line that looks jagged near low-sample-density stretches, or a pace-distribution histogram whose total time doesn't sum to the activity's `movingTimeSec`.

### Pitfall 2: Treating field presence as era-determined rather than per-file-determined
**What goes wrong:** Code assumes "all Strava-era activities have `gear_id`/`device_name`/`average_cadence`" and renders a raw `undefined` or crashes.
**Why it happens:** CONTEXT.md's code-context notes ("1,808 have gear_id... device_name is committed for 1,808 Strava-era records") describe *era boundaries*, not per-file field *presence*, and this research found the two are meaningfully different when measured directly against the committed data.
**How to avoid — verified counts, direct measurement over all 1,868 files in `data/activities/`, 2026-08-11:**

| Field | Files with a truthy value | Notes |
|---|---|---|
| `gear_id` | 1,160 / 1,868 (708 absent) | All 1,160 are Strava-era (0 of 56 intervals.icu-era files have one) — confirms D-33's "no intervals.icu-era activity has one" |
| `device_name` | 1,149 / 1,868 (719 absent) | Also Strava-era only |
| `average_cadence` | 1,111 / 1,868 | Matches CONTEXT.md's "Roughly 1,111" claim |
| Strava-era files total | 1,812 (ids without an `i` prefix) | Slightly higher than CONTEXT.md's "1,808" (data drifts daily via the intervals.icu sync; treat both as approximate, re-check at plan/execution time) |
| intervals.icu-era files total | 56 (ids with an `i` prefix) | — |
| `map.summary_polyline` present | 1,841 / 1,868 (27 activities have a `map` object but an empty/missing `summary_polyline`) | D-23's "zero extra requests" plan still needs an explicit missing-polyline empty state — do not assume every activity has a route |

**`[VERIFIED: direct data inspection, 2026-08-11]`** — do not reuse the "1,808 have gear_id" figure verbatim from CONTEXT.md's code-context section; the actual gear_id-present count is 1,160. Both `device_name` fallback (D-33) and gear resolution (D-32) must handle the ~708/719 absent case as the *common* case, not an edge case — well over a third of the archive.

### Pitfall 3: `data/dashboard/index.json` is larger than the code comment claims
**What goes wrong:** Planning a performance budget around "300-500KB" (the comment in `index-client.ts`) under-budgets the actual initial-load cost.
**Why it happens:** The comment was likely accurate at an earlier row count / field set and was never updated as the index grew.
**How to avoid:** Budget against the measured size — `data/dashboard/index.json` is **1,221,747 bytes (1.22 MB) uncompressed** for 1,868 rows, verified via `wc -c`. GitHub Pages serves with gzip/brotli compression automatically (typical JSON compresses 4-6x), so the wire cost is likely ~200-300KB compressed, but this should be confirmed with a real browser Network-tab check during verification, not assumed. This does not block client-side filtering (1,868 elements is trivial for a single `.filter()` pass, sub-millisecond), but it does mean the *initial index fetch* is the dominant one-time cost of visiting the dashboard at all, larger than any one detail view's payload.
**Warning signs:** None currently — this is a documentation/estimate correction, not a functional bug. Flag for the planner: consider updating the stale comment in `index-client.ts` while touching this area, or leave it (Claude's discretion, not a phase requirement).

### Pitfall 4: No jsdom in this repo — DOM-touching code cannot be unit tested
**What goes wrong:** Writing `*.test.ts` files that construct DOM elements, click table headers, or assert rendered HTML will fail because `vitest.config.ts` sets `environment: 'node'` and there is no `jsdom`/`happy-dom` dependency installed (`npm ls jsdom` returns empty).
**Why it happens:** `router.test.ts`'s own header comment states the precedent explicitly: "this repo's precedent is that every `.test.ts` covers node-environment logic only; the DOM binding is verified manually." `list.test.ts` only tests `formatActivityDate`/`formatPace` — never `renderActivityRow` itself.
**How to avoid:** Every new view module MUST separate pure logic (sort comparators, filter predicates, pagination math, month-grid date math, split/zone/bucket computation, URL query-string (de)serialization) into standalone functions in a sibling `-logic.ts`/`-utils.ts` file that takes/returns plain data (no DOM), and unit-test only those. DOM rendering (table building, chart mounting, map mounting) stays untested by `npm test` and is verified manually, exactly like Phase 16's `checkpoint:human-verify` pattern.
**Warning signs:** A `*.test.ts` file that imports `document` or constructs `HTMLElement`s will either throw (no `document` global in Node) or silently no-op depending on how it's written — this is what "Module decomposition" is called out as Claude's Discretion for in CONTEXT.md, but it is not actually discretionary from a *testability* standpoint: only the pure-function split makes this phase's logic testable at all under the current toolchain.

### Pitfall 5: The widget system's `?inline` CSS import pattern doesn't apply to the dashboard
**What goes wrong:** Copying `import leafletCSS from 'leaflet/dist/leaflet.css?inline';` (the pattern used by every Shadow-DOM widget — `single-run-map`, `heatmap-widget`, `route-browser`, etc.) into the dashboard's detail-map module, then trying to inject it as a string into a `<style>` tag.
**Why it happens:** The `?inline` variant exists specifically because Shadow-DOM widgets need the CSS as a JS string to append inside their shadow root — there is no `<link>` tag inside a shadow root in this codebase's pattern. The dashboard is explicit light DOM (16-D01/D04), so it doesn't need that workaround.
**How to avoid:** Use a plain side-effect import — `import 'leaflet/dist/leaflet.css';` — inside the lazily-imported map module. Vite's default (non-widget) build extracts CSS side-effect imports into a real, hashed stylesheet and — for a dynamically-imported module — bundles/loads that stylesheet as part of the async chunk, injecting a `<link>` when the chunk loads. This is standard, documented Vite async-CSS behavior `[CITED: Vite docs, code-splitting/dynamic-import CSS handling]`, but was not exercised anywhere in this specific repo before, so treat it as MEDIUM confidence pending a real-browser check in verification (see Validation Architecture) — this is exactly the class of thing the Phase 16 black-page defect teaches you to verify in a real browser, not assume from documentation.
**Warning signs:** Map tiles render with no border/zoom-control styling, or the marker icons/zoom controls are unstyled/missing — a classic "Leaflet CSS didn't load" symptom.

### Pitfall 6: Leaflet's default marker icon path breaks under Vite bundling (pre-existing, must-repeat pattern)
**What goes wrong:** `L.marker(...)` renders a broken image (Leaflet's default marker points at a relative path that doesn't survive bundling).
**Why it happens:** Every existing map widget in this repo (`single-run-map/index.ts` and others) works around this with the same boilerplate: `delete (L.Icon.Default.prototype as any)._getIconUrl; L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });` with the three PNGs imported from `leaflet/dist/images/`.
**How to avoid for D-26's position marker:** Prefer `L.circleMarker([lat, lng], { radius, color })` instead of `L.marker(...)` — it needs no icon assets at all, avoids this entire workaround, and is visually simpler/cheaper for a moving crosshair-sync dot. Only reach for the icon-asset workaround if a pin-style marker is specifically wanted (Claude's discretion territory, not a locked decision).
**Warning signs:** A broken-image icon on the map, or a 404 for `marker-icon.png` in the Network tab.

### Pitfall 7: New committed data files silently 404 in production unless the publish pipeline is extended
**What goes wrong:** `data/athlete.json` and `data/gear.json` are created and read correctly in local dev (`vite` serves the whole repo root in dev mode) but 404 on the deployed GitHub Pages site, because `scripts/build-widgets.mjs`'s `copyDataFiles()` only copies six specific *directories* (`data/stats`, `data/geo`, `data/routes`, `data/heatmap`, `data/dashboard`, `data/activities`, `data/streams`) — it does not glob `data/*.json` or handle arbitrary top-level files.
**Why it happens:** This is the exact failure class the Phase 16 postmortem (`.planning/STATE.md` § Blockers/Concerns) names: a check (or, here, an omission) that passes locally but breaks the real deployed shape.
**How to avoid:** Either (a) add a new `data/config/` directory containing both files and add `{ src: 'data/config', dest: 'dist/widgets/data/config' }` to the `dataDirs` array (matches the existing directory-copy pattern exactly, no new code path), or (b) add explicit single-file copy logic for the two new top-level files. Option (a) is lower-risk since it reuses tested code. Either way, `scripts/verify-dashboard-publish.mjs` must also gain an `expect200`/tolerant-404 check for the new URL(s) — it currently checks `index.json`, two `data/stats/*.json` files, one activity, and one stream, but nothing for a new config file.
**Warning signs:** Gear tiles and HR-zone panels work in `npm run dev` but are silently empty (degrading "cleanly" per D-31/D-33 masks the fact that they 404, rather than legitimately having no data) on the live site.

### Pitfall 8: `data/best-effort-exclusions.json`'s loader pattern is build-time-only, not a template for client fetch
**What goes wrong:** Copying `src/analytics/best-effort-exclusions.ts`'s `loadExclusions`/`FileStore` pattern for `data/athlete.json`/`data/gear.json`, which would only work in the Node CLI, not in the browser.
**Why it happens:** `best-effort-exclusions.json` is read once at build time by `compute-best-efforts.ts` (a Node script) and never fetched by the browser — it has no corresponding browser-side client. `data/athlete.json` and `data/gear.json`, by contrast, must be readable by the *browser* at runtime (the detail view needs live gear/zone lookups), so they need a `fetch`-based client following the `IndexClient`/`DetailClient` shape (tolerant of a non-ok response, degrading per D-31/D-33), not a Node `FileStore` loader.
**How to avoid:** Reuse the *JSON shape convention* (`schemaVersion`, `note`, hand-maintained) from `best-effort-exclusions.json`, but reuse the *loading mechanism* (fetch-once, memoize, tolerate 404, never throw into the view) from `index-client.ts`/`detail-client.ts`.

## Code Examples

### Splits: sequential km-boundary walk (new code, following the reused interpolation technique)
```typescript
// New pattern for this phase, following the technique in best-effort-utils.ts's
// findBestEffort (see Pattern 2 above) but walked forward once, not searched.
interface Split {
  km: number;          // 1-based; the final entry may be a partial km (D-28)
  distanceM: number;    // real distance covered by this split (1000 for full km, less for the final partial)
  durationSec: number;
  isPartial: boolean;
}

function computeSplits(t: number[], d: number[]): Split[] {
  const splits: Split[] = [];
  const totalM = d[d.length - 1];
  let boundaryM = 1000;
  let lastCrossingTime = t[0];
  let j = 1;
  let km = 1;

  while (boundaryM <= totalM && j < d.length) {
    while (j < d.length && d[j] < boundaryM) j++;
    if (j >= d.length) break;
    const segMeters = d[j] - d[j - 1];
    const frac = segMeters > 0 ? (boundaryM - d[j - 1]) / segMeters : 0;
    const crossingTime = t[j - 1] + frac * (t[j] - t[j - 1]);
    splits.push({ km, distanceM: 1000, durationSec: crossingTime - lastCrossingTime, isPartial: false });
    lastCrossingTime = crossingTime;
    boundaryM += 1000;
    km++;
  }

  // Final partial km (D-28) — only if real distance remains beyond the last full boundary
  const remainderM = totalM - (boundaryM - 1000);
  if (remainderM > 0 && (boundaryM - 1000) < totalM) {
    splits.push({
      km,
      distanceM: remainderM,
      durationSec: t[t.length - 1] - lastCrossingTime,
      isPartial: true,
    });
  }

  return splits;
}
```

### Theme-style persisted preference, applied to overlay config (D-20)
```typescript
// Source: src/dashboard/theme.ts (this repo) — the pattern to mirror, not copy verbatim
// (overlay config is a per-band structure, not a single mode string, but the
// tamper-guard shape — allow-list valid values, try/catch every storage call,
// fall back safely — is identical).
const OVERLAY_STORAGE_KEY = 'dashboard-detail-overlays';

export function readStoredOverlayConfig(storage: Pick<Storage, 'getItem'>): OverlayConfig {
  try {
    const raw = storage.getItem(OVERLAY_STORAGE_KEY);
    return raw ? parseOverlayConfig(JSON.parse(raw)) : DEFAULT_OVERLAY_CONFIG; // parseOverlayConfig must allow-list channel names, cap at 2 per band
  } catch {
    return DEFAULT_OVERLAY_CONFIG;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Phase 16: list view shows newest 100 rows with a truncation notice | Phase 17: full paginated/sorted/filtered browse over all 1,867+ rows | This phase | The `MAX_ROWS = 100` constant and the truncation-notice paragraph in `list.ts` must both be removed entirely, not just hidden (D-06 explicitly calls this out) |
| Phase 16: calendar is a stub (`createStubView`) | Phase 17: real month-grid | This phase | `STUB_PHASE[ROUTES.CALENDAR]` entry in `view.types.ts` must be removed once shipped |
| Phase 16: detail view has no chart/map/splits, only a stats grid + stream-availability summary card | Phase 17: full stats header, route map, 4-channel charts, splits table, pace/zone breakdown | This phase | `buildStreamSummaryCard`'s "Samples/Channels/Distance Source" debug card in `detail.ts` was a Phase-16 proving-slice placeholder — decide (Claude's discretion) whether it's removed or kept as a secondary debug panel once real charts exist |

**Deprecated/outdated:**
- The `index-client.ts` file-comment's "~300-500KB" index-size estimate is stale; see Pitfall 3.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite's async-CSS chunk injection (a `<link>` auto-inserted when a dynamically-imported module side-effect-imports CSS) works correctly with this project's `base: './'` + hash-routing dashboard build | Pitfall 5, Pattern 3 | If wrong, Leaflet map tiles/controls render unstyled on first detail-view open; low severity (visually broken, not a hard crash) and directly catchable by the phase's own manual verification step, but should be confirmed early rather than assumed |
| A2 | GitHub Pages applies gzip/brotli compression automatically to `.json` responses, making the actual wire cost of `data/dashboard/index.json` meaningfully smaller than 1.22 MB | Pitfall 3 | If wrong, initial page load is heavier than expected; does not block correctness, only a performance nice-to-have; confirm via a real Network-tab check against the live `https://bacilo.github.io/strava-widgets/` site during verification |

**If this table is empty:** N/A — two low-risk assumptions logged above; every other claim in this document was verified directly against this repo's source, installed packages, or committed data.

## Open Questions (RESOLVED)

*Both questions were settled during planning; each is annotated inline with the plan that resolved it.*

1. **[RESOLVED — 17-06]** **Should the `data/config/` directory (or equivalent) house both `athlete.json` and `gear.json`, or should they stay flat at `data/` root with individual copy logic added to `copyDataFiles`?**
   - What we know: The directory-based copy pattern in `copyDataFiles` is simpler to extend correctly (Pitfall 7) and matches every existing entry in `dataDirs`.
   - What's unclear: Whether a new subdirectory is stylistically consistent with the rest of `data/`'s flat, purpose-named-directory convention (`data/stats/`, `data/geo/`, `data/streams/`) or whether these two files are conceptually closer to the flat `data/best-effort-exclusions.json`/`data/provenance.json` top-level files.
   - Recommendation: Either works; CONTEXT.md explicitly leaves "Concrete schema and file names... versus generated output" as Claude's Discretion. This research recommends the `data/config/` subdirectory purely because it reuses tested copy code with zero new logic — lower defect risk given the Phase 16 precedent of an omitted-copy-path production bug.
   - **Resolution:** Plan 17-06 adopted the `data/config/` subdirectory, holding both `athlete.json` and `gear.json`, and extends `copyDataFiles`'s `dataDirs` array rather than adding per-file copy logic.

2. **[RESOLVED — 17-11 / 17-12 / 17-15]** **Does `verify-dashboard-publish.mjs` need a new check for the dynamically-imported Leaflet/Chart.js chunk specifically, beyond the existing module-script/stylesheet checks?**
   - What we know: The verifier currently resolves the `<script type="module">` and `<link rel="stylesheet">` referenced directly in `index.html`'s initial markup. It has no mechanism to discover or fetch a chunk that is only referenced from *inside* already-loaded JS (i.e., the target of a `import('leaflet')` call).
   - What's unclear: Whether extending the automated HTTP verifier to crawl dynamic-import targets is worth the added complexity, versus relying on the existing "real browser" manual-checkpoint step (which Phase 16's own postmortem shows is necessary anyway, since the verifier's own local-shape assertions previously missed a real production defect).
   - Recommendation: Treat automated dynamic-chunk-resolves-at-the-mount-prefix verification as nice-to-have; treat a real-browser manual check (open a detail view, confirm the map/charts actually render, check Network tab for 404s) as the mandatory gate, consistent with how Phase 16 handled its own analogous gaps.
   - **Resolution:** Plans 17-11 and 17-12 prove the lazy-chunk boundary with a build-output assertion (entry chunk contains no Leaflet/Chart.js code), and plan 17-15 makes the real-browser checkpoint a blocking, non-autonomous gate covering dynamic-chunk 404s. The HTTP verifier is not extended to crawl dynamic imports.

## Environment Availability

No new external tool, service, or runtime dependency is introduced by this phase — it extends an already-fully-provisioned Node/Vite/vitest toolchain with libraries already installed. Skipping this section per the stated skip condition (no new external dependencies).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (installed, `[VERIFIED: node_modules]`) |
| Config file | `vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`) |
| Quick run command | `npm test -- --run src/dashboard` (targeted) |
| Full suite command | `npm test` (373 tests currently pass in ~540ms, `[VERIFIED: ran locally]`) |

**Critical constraint (see Pitfall 4):** No `jsdom`/`happy-dom` is installed; `environment: 'node'` means `document`/`window` are undefined in test files. Every automated test this phase adds MUST target pure functions with no DOM dependency. DOM rendering, chart mounting, map mounting, and click/keyboard interaction are **not** automatable under this toolchain and must be verified manually in a real browser, exactly as `router.ts`'s own header comment documents for the existing hash-binding code.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROWSE-01 | Pagination math (page size, page count, page-1 reset on filter/sort change) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ Wave 0 |
| BROWSE-02 | Sort comparators for date/distance/pace/duration/HR, direction flip | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ Wave 0 |
| BROWSE-02 | Table renders correctly, header click sorts, `aria-sort` set | manual | real-browser checkpoint | — (not automatable, no jsdom) |
| BROWSE-03 | Date-range/numeric-range filter predicates (AND semantics, preset chip values) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ Wave 0 |
| BROWSE-04 | Text-search matching (case-insensitive substring, whatever semantics Claude's Discretion lands on) | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ Wave 0 |
| BROWSE-05 | Month-grid date math (day-of-week offsets, leap years, month boundaries, group-activities-by-day) | unit | `vitest run src/dashboard/views/calendar-logic.test.ts` | ❌ Wave 0 |
| BROWSE-05 | Calendar renders, cell tinting, multi-run picker opens | manual | real-browser checkpoint | — |
| BROWSE-06 | Filter-chip serialization/removal logic, zero-match empty-state message construction | unit | `vitest run src/dashboard/views/list-logic.test.ts` | ❌ Wave 0 |
| BROWSE-06 | Missing-HR/cadence badges render cleanly (already covered for existing badges by `list.ts`'s current behavior — extend, don't replace) | manual | real-browser checkpoint | — |
| DETAIL-01 | Gear/device_name fallback resolution logic (gear.json lookup → device_name → omit) | unit | `vitest run src/dashboard/data/gear-client.test.ts` | ❌ Wave 0 |
| DETAIL-01 | Stats header renders all named tiles | manual | real-browser checkpoint | — |
| DETAIL-02 | Route map renders, hover-syncs a position marker | manual | real-browser checkpoint (Leaflet is not testable under Node) | — |
| DETAIL-03 | Chart bands render, overlay checkbox picker limits to 2, x-axis toggle (distance/time) | manual | real-browser checkpoint (Chart.js canvas is not testable under Node) | — |
| DETAIL-03 | Smoothing rolling-window math, LTTB decimation input prep | unit | `vitest run src/dashboard/views/detail-charts-logic.test.ts` | ❌ Wave 0 |
| DETAIL-04 | Per-km split computation (interpolated boundary crossings, final-partial-km handling per D-28) | unit | `vitest run src/dashboard/views/detail-splits.test.ts` | ❌ Wave 0 |
| DETAIL-04 | Splits table renders 7 columns, responsive collapse on narrow screens | manual | real-browser checkpoint | — |
| DETAIL-05 | Pace-bucket histogram computation; HR-zone time-in-zone computation against `data/athlete.json` boundaries | unit | `vitest run src/dashboard/views/detail-zones.test.ts` | ❌ Wave 0 |
| DETAIL-05 | Zone panel hides entirely when config/HR absent (D-31) | unit + manual | logic unit-tested; visual absence confirmed manually | ❌ Wave 0 (logic) |

### Sampling Rate
- **Per task commit:** `npm test -- --run src/dashboard` (targeted subset, fast — full suite already runs in ~540ms so targeting is a minor optimization, not a necessity)
- **Per wave merge:** `npm test` (full suite) + `npm run build-widgets && npm run verify-dashboard`
- **Phase gate:** Full suite green, `verify-dashboard` green, PLUS a real-browser manual checkpoint covering every "manual" row above (list sort/filter/paginate interaction, calendar navigation, detail map+charts+splits+zones rendering) before `/gsd-verify-work` — mirroring exactly how Phase 16's plan 16-09 checkpoint caught two real defects (`isValidActivityId` rejecting `i`-prefixed ids; invisible theme toggle) that its own automated 15/15 verifier missed.

### Wave 0 Gaps
- [ ] `src/dashboard/views/list-logic.test.ts` — sort/filter/paginate/URL-state pure functions (BROWSE-01..04, BROWSE-06)
- [ ] `src/dashboard/views/calendar-logic.test.ts` — month-grid date math, group-by-day (BROWSE-05)
- [ ] `src/dashboard/views/detail-splits.test.ts` — per-km split computation, partial-km handling (DETAIL-04)
- [ ] `src/dashboard/views/detail-zones.test.ts` — pace-bucket + HR-zone bucketing (DETAIL-05)
- [ ] `src/dashboard/data/gear-client.test.ts` — gear/device_name fallback resolution, tolerant fetch (DETAIL-01)
- [ ] `src/dashboard/data/athlete-config-client.test.ts` — tolerant fetch/parse of `data/athlete.json` (DETAIL-05 zone-config gate)
- [ ] No framework install needed — vitest is already configured and working; these are new test files, not new tooling

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-athlete static site, no login |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No access boundaries — all published data is intentionally public |
| V5 Input Validation | Yes | Reuse `isValidActivityId` (`/^i?\d{1,20}$/`) for the detail route; new URL-driven filter/sort/page query params need their own allow-listed parsing (sort key from a fixed enum, page clamped to `[1, totalPages]`, numeric ranges parsed with `Number()` + `Number.isFinite` guards, never `eval`/`Function`) |
| V6 Cryptography | No | No secrets/crypto in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Athlete-authored activity `name`/`location` rendered via `innerHTML` (XSS) | Tampering | Continue the established `textContent`-only rule (T-16-VW-01); applies to every new render site this phase adds — table cells, calendar multi-run picker labels, splits table |
| Malformed/adversarial hash query params (`?sort=__proto__`, `?page=-99999`, `?dmin=Infinity`) crash or misrender the list | Tampering / Denial of Service (client-side) | New filter/sort/page parsing must allow-list sort keys against a fixed `SortKey` union, clamp `page` to a valid integer range, and treat any unparseable numeric filter as absent rather than `NaN`-propagating into comparisons |
| Tampered `localStorage` overlay-config value (`dashboard-detail-overlays`) referencing a non-existent channel or >2 entries | Tampering | Mirror `theme.ts`'s `parseThemeMode` allow-list pattern: validate every field against a known channel-name union and enforce the 2-companion cap when *reading* stored config, not just when writing it (T-16-TH-01 analog) |
| A crafted/mangled `activity.map.summary_polyline` decoded by `@mapbox/polyline` in the route map | Tampering (low severity — data is self-published, not third-party user input) | `polylineCodec.decode` already runs inside the existing, reused `RouteRenderer.renderRoute` — no new decode path is introduced; wrap the detail-map mount in the same error/retry pattern `detail.ts` already uses for fetch failures so a malformed polyline degrades to an omitted map, not a crash |
| Information disclosure via a new committed `data/gear.json`/`data/athlete.json` accidentally including private data (e.g. max HR is arguably personal health data, though this is a single-athlete personal project) | Information Disclosure | Both files are explicitly hand-maintained/committed per CONTEXT.md D-30/D-32 — the athlete has already consented to publishing HR data (it's already in every committed stream and activity JSON); no new disclosure surface beyond what's already public. Gear names (shoe models) carry no privacy risk |

## Sources

### Primary (HIGH confidence — direct inspection of this repository)
- `src/dashboard/views/list.ts`, `detail.ts`, `overview.ts`, `calendar.stub.ts` — existing view patterns, formatters, stale-guard idioms
- `src/dashboard/router.ts`, `view.types.ts`, `view-registry.ts` — routing, registry, URL-state precedent
- `src/dashboard/data/index-client.ts`, `detail-client.ts` — fetch-once/lazy-fetch client patterns
- `src/dashboard/theme.ts` — localStorage tamper-guard precedent for D-20
- `src/dashboard/styles.css` — confirmed design tokens, confirmed absence of an "orange accent scale" (only a single `--accent`) and absence of a ~700px breakpoint (only 640px exists, for nav collapse)
- `src/widgets/shared/route-utils.ts` — `RouteRenderer` (reused directly per D-24)
- `src/analytics/best-effort-utils.ts`, `compute-best-efforts.ts` — exact-distance-crossing interpolation technique to mirror for splits
- `src/analytics/best-effort-exclusions.ts`, `data/best-effort-exclusions.json` — hand-maintained committed-JSON convention (shape only, not the Node-only loading mechanism)
- `src/analytics/dashboard-index.types.ts`, `src/streams/stream.types.ts`, `src/analytics/best-effort.types.ts` — locked data contracts this phase reads
- `src/types/strava.types.ts` — `StravaActivity` shape, confirms era-dependent extra fields live behind its index signature
- `scripts/build-widgets.mjs` (`copyDataFiles`, `buildDashboard`) — publish pipeline, `base: './'` rationale
- `scripts/verify-dashboard-publish.mjs` — production URL-shape verification gate
- `vitest.config.ts` — confirmed `environment: 'node'`, confirmed no jsdom via `npm ls jsdom`
- `data/streams/manifest.json`, `data/streams/10041312551.json`, `data/activities/3149636661.json`, `data/activities/i174110305.json` — direct inspection of real committed data (sample irregularity, era field differences, polyline presence)
- `npm view chart.js version`, `npm view leaflet version`, `npm view @mapbox/polyline version` — live registry version checks against installed `node_modules`
- `node -e "require('chart.js')"` — confirmed `Decimation` export present in the installed 4.5.1
- `npm test -- --run` — confirmed 373 passing tests, ~540ms, all under `environment: 'node'`
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/config.json` — project state, requirements, Phase 16 postmortem, workflow config (`nyquist_validation: true`)

### Secondary (MEDIUM confidence)
- Vite's async-CSS-chunk-injection behavior for dynamically-imported modules (Pitfall 5, Assumption A1) — standard, documented Vite behavior, not previously exercised in this specific repo `[CITED: Vite docs]`

### Tertiary (LOW confidence)
- None — every claim in this document traces to either direct repository/data inspection or a live registry/tool check.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every version verified against the live npm registry and the installed `node_modules`
- Architecture: HIGH — every pattern cited traces to an existing, working file in this repository
- Pitfalls: HIGH for data/testing pitfalls (directly measured against committed data and the actual toolchain config); MEDIUM for the one Vite dynamic-CSS-import claim (documented Vite behavior, not yet exercised in this repo — flagged as Assumption A1)

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 (30 days — stable, framework-free stack; the only fast-moving element is the committed data itself, which drifts daily via the intervals.icu sync, so re-verify exact row/field counts at plan/execution time rather than trusting this document's snapshot numbers verbatim)
