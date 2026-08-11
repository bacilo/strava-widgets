# Phase 17: Activity Browser & Detail Views - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 20 (11 new modules, 2 new committed data files, 6 new test files, 5 modified existing files — some overlap between categories)
**Analogs found:** 20 / 20 (every file has at least a role-match analog; none fall in "No Analog Found" for structure, though D-25's *lazy dynamic import* mechanism itself has no in-repo precedent — noted below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/dashboard/views/list.ts` (rewrite) | view/controller | request-response | itself (Phase 16 version, in place) + `src/dashboard/views/overview.ts` | exact |
| `src/dashboard/views/list-logic.ts` (new) | utility (pure logic) | transform | `src/dashboard/router.ts` (pure parse/match core) + `src/analytics/best-effort-exclusions.ts` (pure builder over untrusted input) | role-match |
| `src/dashboard/views/list-logic.test.ts` (new) | test | — | `src/dashboard/router.test.ts` + `src/dashboard/views/list.test.ts` | exact |
| `src/dashboard/views/calendar.ts` (new, replaces `calendar.stub.ts`) | view/controller | request-response | `src/dashboard/views/list.ts` / `overview.ts` (mount/unmount + stale-guard shape) | exact |
| `src/dashboard/views/calendar-logic.ts` (new) | utility (pure logic) | transform | `src/dashboard/router.ts` (pure date/path math) | role-match |
| `src/dashboard/views/calendar-logic.test.ts` (new) | test | — | `src/dashboard/router.test.ts` | exact |
| `src/dashboard/views/detail.ts` (grow in place) | view/controller | request-response | itself (Phase 16 version) | exact |
| `src/dashboard/views/detail-charts.ts` (new) | component/service (lazy chart mount) | streaming/transform | `src/widgets/comparison-chart/chart-config.ts` (multi-series line + Filler) + `src/widgets/streak-widget/chart-config.ts` (tree-shaken Chart.js registration) | role-match |
| `src/dashboard/views/detail-charts-logic.ts` (new, smoothing/decimation-prep) | utility (pure logic) | transform | `src/analytics/best-effort-utils.ts` (irregular-sample-aware math) | role-match |
| `src/dashboard/views/detail-charts-logic.test.ts` (new) | test | — | `src/analytics/best-effort-utils.ts`'s test conventions (node-env, pure fn) | role-match |
| `src/dashboard/views/detail-map.ts` (new) | component/service (lazy map mount) | request-response | `src/widgets/single-run-map/index.ts` (Leaflet wiring, marker-icon fix) + `src/widgets/shared/route-utils.ts` (`RouteRenderer`, reused directly per D-24) | exact (for the render logic) / partial (for the lazy-import + light-DOM mount shape, which has no in-repo precedent — see Shared Patterns) |
| `src/dashboard/views/detail-splits.ts` (new) | utility (pure logic) | transform | `src/analytics/best-effort-utils.ts` (`findBestEffort`'s exact-crossing interpolation — Pattern 2) | exact |
| `src/dashboard/views/detail-splits.test.ts` (new) | test | — | best-effort-utils' own test file conventions (not read directly, but the module under test is) | role-match |
| `src/dashboard/views/detail-zones.ts` (new) | utility (pure logic) | transform | `src/analytics/best-effort-utils.ts` (irregular Δt-weighted bucketing) + `src/analytics/best-effort-exclusions.ts` (`buildExclusionIndex` — tolerant parse of hand-maintained config) | role-match |
| `src/dashboard/views/detail-zones.test.ts` (new) | test | — | same as above | role-match |
| `src/dashboard/data/gear-client.ts` (new) | service (fetch client) | request-response | `src/dashboard/data/index-client.ts` (fetch-once, memoized, tolerant-of-failure client shape) | exact |
| `src/dashboard/data/gear-client.test.ts` (new) | test | — | `src/dashboard/data/index-client.test.ts` (`fakeFetch` harness) | exact |
| `src/dashboard/data/athlete-config-client.ts` (new) | service (fetch client) | request-response | `src/dashboard/data/index-client.ts` | exact |
| `src/dashboard/data/athlete-config-client.test.ts` (new) | test | — | `src/dashboard/data/index-client.test.ts` | exact |
| `data/athlete.json` (new, committed) | config | file-I/O | `data/best-effort-exclusions.json` (hand-maintained, `schemaVersion`+`note` convention) | exact |
| `data/gear.json` (new, committed) | config | file-I/O | `data/best-effort-exclusions.json` | exact |
| `src/dashboard/view-registry.ts` (modify) | config/registry | — | itself (in place) | exact |
| `src/dashboard/view.types.ts` (modify — drop `CALENDAR` from `STUB_PHASE`) | config/route table | — | itself (in place) | exact |
| `src/dashboard/styles.css` (modify — add `--accent-strong`, `--chart-*`, calendar tint, 720px breakpoint) | config (design tokens) | — | itself (in place, `:root[data-theme]` blocks + `@media (max-width: 640px)` block) | exact |
| `scripts/build-widgets.mjs` (modify `copyDataFiles`) | config/build | file-I/O | itself, `dataDirs` array (in place) | exact |
| `scripts/verify-dashboard-publish.mjs` (modify) | test (publish smoke gate) | request-response | itself, `expect200`/`expectAssetResolves` (in place) | exact |
| `src/dashboard/views/calendar.stub.ts` (deleted) | — | — | n/a — removed once `calendar.ts` ships | n/a |

## Pattern Assignments

### `src/dashboard/views/list.ts` (view, request-response) — full rewrite

**Analog:** itself (`src/dashboard/views/list.ts`, current Phase-16 shape) plus `src/dashboard/views/overview.ts` for the fetch/stale-guard idiom.

**Imports pattern** (current file, lines 13-16):
```typescript
import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import type { IndexClient } from '../data/index-client.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
```
Phase 17 adds: `import type { SortKey, SortState, FilterState } from './list-logic.js';` and the pure functions themselves (`sortRows`, `filterRows`, `paginate`, `parseListQuery`, `serializeListQuery`) — DOM code never re-implements sort/filter, it only calls into `list-logic.ts`.

**Do-not-duplicate pattern** (lines 36-72, carried forward verbatim): `formatActivityDate` and `formatPace` stay defined in `list.ts` and are imported by `detail.ts` (already true today, line 18 of `detail.ts`) and must now also be imported by `calendar.ts` and the new table-row builder — never re-implemented.

**Mount/stale-guard/error-state pattern** (lines 133-222, the whole `createListView` factory): keep the exact shape — `mountedContainer` tracked, `ctx.container.replaceChildren()` before paint, try/catch around `indexClient.loadIndex()` with a `mountedContainer !== ctx.container` guard both after the catch and after the success path (WR-01). The table/pagination/filter DOM is new, but it hangs off this same skeleton.

**Row renderer split (D-04):** `renderActivityRow` (lines 87-127) stays exactly as-is and is reused for mobile card mode; add a NEW, separate `buildTableRow(row, ...)` function in the same file (or a co-located helper) for the desktop `<tr>` — do not let `renderActivityRow` grow table-mode branches.

**Deletion required:** `MAX_ROWS = 100` (line 18) and the truncation-notice block (lines 207-212) must be deleted entirely (D-06), not hidden behind a flag.

---

### `src/dashboard/views/list-logic.ts` (utility, pure — new file)

**Analog:** `src/dashboard/router.ts`'s pure core (`parseHash`, `matchRoute`, `resolveHash`) for the "pure function, DOM-free, fully unit-testable" shape, and `src/analytics/best-effort-exclusions.ts`'s `buildExclusionIndex` for "never throw on untrusted/malformed input, degrade to the safe default."

**Pure-parsing pattern to mirror** (`router.ts` lines 21-33):
```typescript
export function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const questionIndex = withoutHash.indexOf('?');
  const pathPart = questionIndex === -1 ? withoutHash : withoutHash.slice(0, questionIndex);
  const queryPart = questionIndex === -1 ? '' : withoutHash.slice(questionIndex + 1);
  let path = pathPart === '' ? '/' : pathPart;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return { path, query: new URLSearchParams(queryPart) };
}
```
Apply the same shape to `parseListQuery(query: URLSearchParams): { sort: SortKey; dir: 'asc'|'desc'; page: number; filters: FilterState }` — every field allow-listed against a fixed union (Security Domain V5: `sort` from a fixed `SortKey` enum, `page` clamped `[1, totalPages]`, numeric filters `Number()` + `Number.isFinite` guarded, never propagate `NaN`).

**Tolerant-parse-of-untrusted-input pattern** (`best-effort-exclusions.ts` lines 30-67, `buildExclusionIndex`): total function, never throws, skips individually-malformed entries rather than aborting the whole parse — apply this same discipline to `parseListQuery`'s per-filter parsing (a malformed `dmin=Infinity` should drop that one filter, not crash the whole query-string parse).

**Sort comparator + pagination shape (new, no direct precedent — follow `findBestEffort`'s "small, pure, total function" discipline in `best-effort-utils.ts`):**
```typescript
export type SortKey = 'date' | 'distance' | 'movingTime' | 'pace' | 'avgHr';
export function compareRows(a: DashboardIndexRow, b: DashboardIndexRow, sort: SortKey, dir: 'asc' | 'desc'): number { /* ... */ }
export function sortRows(rows: DashboardIndexRow[], sort: SortKey, dir: 'asc' | 'desc'): DashboardIndexRow[] { /* stable, non-mutating: [...rows].sort(...) */ }
export function paginate<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; totalPages: number; clampedPage: number } { /* ... */ }
```
`markPRs`/`rankTopN` in `best-effort-utils.ts` (lines 171-200) already demonstrate the exact "non-mutating `[...arr].sort(...)`, then map" idiom to copy for `sortRows`.

**Error handling:** N/A — these are pure functions; the DOM layer (`list.ts`) owns try/catch, per Pitfall 4's node-environment-only testability split.

---

### `src/dashboard/views/calendar.ts` (view, request-response — new, replaces the stub)

**Analog:** `src/dashboard/views/list.ts` / `overview.ts` for the mount/unmount/stale-guard skeleton; `src/dashboard/views/calendar.stub.ts` (being deleted) only for the route/title wiring shape.

**Deleted-stub pattern** (`calendar.stub.ts`, 5 lines total):
```typescript
import { ROUTES } from '../view.types.js';
import { createStubView } from './stub-view.js';
export const calendarView = createStubView(ROUTES.CALENDAR, 'Calendar');
```
Replace this whole file's usage in `view-registry.ts` with a real `createCalendarView({ indexClient })` factory returning a `DashboardView`, following `createListView`'s shape exactly (constructor takes `{ indexClient }`, returns `{ route, title, mount, unmount }`).

**Mount pattern to copy** (`list.ts` lines 141-220): loading indicator → `indexClient.loadIndex()` (already-memoized, do NOT construct a second `IndexClient` per the Anti-Patterns list) → stale-guard → build DOM → append. Calendar has no fetch of its own beyond the already-loaded index rows (D-13's "derived from IndexClient rows").

**Independent URL contract (D-16):** unlike `list.ts`'s query parsing, `calendar.ts` parses only `?month=YYYY-MM` from `ctx.query` — do not reuse `list-logic.ts`'s `parseListQuery`, keep this a separate, smaller parser in `calendar-logic.ts`.

---

### `src/dashboard/views/calendar-logic.ts` (utility, pure — new file)

**Analog:** `src/dashboard/router.ts`'s pure core, same rationale as `list-logic.ts`.

**Pattern:** pure functions taking `(rows: DashboardIndexRow[], year: number, month: number)` and returning a grid structure (`{ weeks: (DayCell | null)[][]; monthTotalKm: number; runCount: number }`), grouping by `row.startDateLocal`'s date portion (reuse the Z-suffix-normalization technique from `formatActivityDate`, `list.ts` lines 36-42, to avoid re-deriving the same timezone bug independently — import the technique, or better, import `formatActivityDate` itself if the day-key can be derived from its normalized `Date`).

**Error handling:** total/pure, no throwing — a month with zero activities returns an all-rest-day grid, not an error.

---

### `src/dashboard/views/detail.ts` (view, request-response — grown in place)

**Analog:** itself (current Phase-16 proving slice).

**Preserve verbatim** (lines 213-273, `createDetailView` + `loadAndRender`): the `isValidActivityId` guard before any fetch, the `requestToken` stale-response guard (critical for D-26's hover-sync and the map/chart lazy mounts — a fast activity-to-activity navigation must cancel an in-flight Leaflet/Chart.js mount), and the `renderErrorState`/`Retry` pattern (lines 59-96) — reuse `renderErrorState`'s exact shape for the new "Couldn't load the charts / route map" states named in UI-SPEC's Copywriting Contract, parameterized by heading text.

**Extend, don't fork** `buildStatCard`/`formatOrDash`/`numOrNull` (lines 36-51, 29-34) for the new Gear tile — gear resolution is an additional stat card computed from `gear-client` + `activity.gear_id`/`device_name`, following the exact `formatOrDash(value, formatter)` idiom already used for HR/cadence.

**Decision point:** `buildStreamSummaryCard` (lines 98-138) was explicitly named a "Phase-16 proving-slice placeholder" (RESEARCH.md State of the Art) — CONTEXT.md leaves removal vs. keep-as-debug-panel to Claude's discretion during planning.

**Section orchestration (new):** `renderSuccess` (lines 140-201) grows to call out to `detail-map.ts`'s `mountRouteMap`, `detail-charts.ts`'s `mountChartBands`, `detail-splits.ts`'s pure `computeSplits` + a new DOM builder, and `detail-zones.ts`'s pure bucketing + a new DOM builder — each appended as its own `<section class="card">`, matching the existing `statsCard`/`buildStreamSummaryCard` sectioning idiom.

---

### `src/dashboard/views/detail-map.ts` (component, request-response — new)

**Analog:** `src/widgets/single-run-map/index.ts` (Leaflet wiring + marker-icon-path fix) and `src/widgets/shared/route-utils.ts` (`RouteRenderer`, reused directly per D-24 — do not re-wrap it).

**Marker-icon-path workaround — do NOT copy this part** (`single-run-map/index.ts` lines 10-20):
```typescript
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });
```
Per RESEARCH.md Pitfall 6 and UI-SPEC §4b, the D-26 position marker uses `L.circleMarker(...)` instead, which needs none of this — skip the icon-asset workaround entirely unless a pin-style marker is added later.

**CSS import — do NOT copy the Shadow-DOM `?inline` variant** (`single-run-map/index.ts` line 7: `import leafletCSS from 'leaflet/dist/leaflet.css?inline';` + lines 62-65 injecting it as a `<style>` string). The dashboard is light DOM (16-D01/D04); per RESEARCH.md Pitfall 5, use a plain side-effect import instead: `import 'leaflet/dist/leaflet.css';` inside the lazily-imported module.

**Route rendering — DO copy this exactly** (`RouteRenderer.renderRoute`, `route-utils.ts` lines 59-99): decode polyline, `L.polyline(...).addTo(map)`, `fitBounds` with the single-point fallback (`map.setView([startLat, startLng], 13)` when `bounds.isValid()` is false) — this is the exact "bounds-fit" logic D-24 forbids re-deriving.

**Hover pattern to extend, not fork** (`RouteRenderer.addHoverEffect`, lines 197-211): the existing `mouseover`/`mouseout` weight-toggle is for a *static* hover; D-26 needs a *programmatic* position marker driven by chart-hover events (crosshair sync), which is new code — but should still go through `RouteRenderer`'s style conventions (`--accent`, resolved per-theme, passed as `options.color` — UI-SPEC §4b — not the hardcoded `#fc4c02` default in `DEFAULT_OPTIONS`, `route-utils.ts` lines 39-45).

**Lazy-import boundary (D-25, no in-repo precedent — new pattern):**
```typescript
// Follow Vite's standard dynamic-import code-splitting; nothing in this repo
// does this yet (RESEARCH.md Pattern 3) — this is the first lazy browser chunk.
async function mountRouteMap(container: HTMLElement, polyline: string, accentColor: string): Promise<void> {
  const [{ default: L }, { RouteRenderer }] = await Promise.all([
    import('leaflet'),
    import('../../widgets/shared/route-utils.js'),
  ]);
  await import('leaflet/dist/leaflet.css');
  // ...
}
```

**Error handling:** wrap the mount in the same try/catch + `renderErrorState`-style retry as `detail.ts`'s `loadAndRender` (a malformed polyline degrades to the "Route unavailable" empty state per UI-SPEC §4b state 3, never a crash).

---

### `src/dashboard/views/detail-charts.ts` (component, streaming/transform — new)

**Analog:** `src/widgets/comparison-chart/chart-config.ts` (multi-series line chart, `Filler` plugin already registered for area fills — needed for D-19's overlay shading) and `src/widgets/streak-widget/chart-config.ts` (minimal tree-shaken registration pattern).

**Tree-shaken registration pattern to copy** (`comparison-chart/chart-config.ts` lines 6-37):
```typescript
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, Title, Tooltip, Legend, Filler,
  ChartConfiguration,
} from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, Title, Tooltip, Legend, Filler);
```
Phase 17 additionally needs `Decimation` (for D-22's LTTB capping) — register it alongside the above; `Decimation` is confirmed present in the installed 4.5.1 (RESEARCH.md Standard Stack).

**Theme-aware color pattern to copy** (`comparison-chart/chart-config.ts` lines 82-85, repeated per chart):
```typescript
const isDark = config?.theme === 'dark';
const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
const tickColor = isDark ? '#999' : '#666';
```
Adapt to read the resolved `--chart-pace`/`--chart-hr`/`--chart-cadence`/`--chart-elevation`/`--border` CSS custom properties directly (`getComputedStyle(document.documentElement).getPropertyValue(...)`) rather than hardcoding a light/dark branch, since UI-SPEC's chart palette is already theme-resolved via CSS variables — this is a deviation from the copied widgets (which don't have access to the dashboard's `data-theme` attribute), not a defect to reproduce.

**Overlay area-fill pattern** (`Filler` plugin usage — not directly demonstrated in any existing chart-config, but the plugin is already registered in `comparison-chart/chart-config.ts` line 36 and the dataset-level `fill: false`/`tension` options at lines 184-187 show the dataset config surface to extend): each overlay dataset sets `fill: true, backgroundColor: 'rgba(<channel-rgb>, 0.18)' /* or 0.10 for the 2nd */, borderWidth: 0, yAxisID: 'overlay' /* separate, undrawn scale per D-19 */`.

**Decimation config (D-22, new — Chart.js documented option, no in-repo precedent):**
```typescript
options: {
  parsing: false, // performance: pre-shaped {x,y} points
  plugins: { decimation: { enabled: true, algorithm: 'lttb', samples: 500 } },
}
```

**Lazy-import boundary:** same shape as `detail-map.ts`'s — `await import('chart.js')` inside the mount function, never at module top level, never imported by `list.ts`/`calendar.ts`/`overview.ts`.

**Persistence (D-20):** see Shared Patterns — `theme.ts`'s tamper-guard.

---

### `src/dashboard/views/detail-charts-logic.ts` (utility, pure — new)

**Analog:** `src/analytics/best-effort-utils.ts` for irregular-sample-aware math.

**Δt-weighted rolling-average pattern (new, mirrors the discipline in `validateStreamSeries`/`findBestEffort` rather than their exact code):** the smoothing window must weight by actual `t[i+1] - t[i]`, not by sample count (RESEARCH.md Pitfall 1) — same "never assume uniform spacing" discipline `findBestEffort`'s two-pointer sweep already embodies (`best-effort-utils.ts` lines 101-130).

**Validation reuse:** consider calling `validateStreamSeries(t, d)` (`best-effort-utils.ts` lines 50-91) as a pre-check before smoothing/decimating a stream's `t`/`d` arrays — it already handles the equal-length, minimum-sample-count, finiteness, and non-decreasing checks this phase would otherwise re-derive.

---

### `src/dashboard/views/detail-splits.ts` (utility, pure — new)

**Analog:** `src/analytics/best-effort-utils.ts`, `findBestEffort` (lines 101-130) — the exact-distance-crossing interpolation technique to mirror, walked forward once instead of swept with two pointers.

**Core pattern to copy (the interpolation formula only, not the sliding-window search):**
```typescript
// Source: src/analytics/best-effort-utils.ts lines 117-121 — the technique
const needed = targetMeters - (d[j - 1] - d[i]);
const segMeters = d[j] - d[j - 1];
const frac = segMeters > 0 ? needed / segMeters : 0;
const crossingTime = t[j - 1] + frac * (t[j] - t[j - 1]);
```
RESEARCH.md's Code Examples section already has the full sequential-walk adaptation (`computeSplits(t, d): Split[]`) — implement it as written there, including the D-28 final-partial-km branch.

**Error handling:** pure/total function — a stream with `< 2` samples or `d[last] < 1000` (no full km) returns an empty or partial-only splits array, never throws (mirrors `findBestEffort`'s `return undefined` early-exit at line 107, adapted to `return []`).

---

### `src/dashboard/views/detail-zones.ts` (utility, pure — new)

**Analog:** `src/analytics/best-effort-utils.ts` (Δt-weighted bucketing discipline) + `src/analytics/best-effort-exclusions.ts` (tolerant parse of a hand-maintained committed config, `buildExclusionIndex`).

**Tolerant-config-parse pattern to copy** (`best-effort-exclusions.ts` lines 30-67): total, never-throwing parse of `data/athlete.json`'s zone boundaries — individually validate `maxHr` is a finite positive number and each zone boundary is a finite bpm value in ascending order; on any structural failure, the caller (per D-31) must treat zones as entirely absent, not partially rendered.

**Time-weighted bucketing (new, same discipline as detail-charts-logic.ts):** both the pace-distribution histogram and the HR-zone breakdown must accumulate `Δt` (not sample count) per bucket/zone — RESEARCH.md Pitfall 1's warning sign ("a pace-distribution histogram whose total time doesn't sum to the activity's `movingTimeSec`") is the direct correctness check for this file's own test suite.

---

### `src/dashboard/data/gear-client.ts` and `src/dashboard/data/athlete-config-client.ts` (service, request-response — new)

**Analog:** `src/dashboard/data/index-client.ts` for the fetch-once/memoized/tolerant-of-404 client shape — NOT `src/analytics/best-effort-exclusions.ts`'s `loadExclusions` (that is a Node-only `FileStore` loader per RESEARCH.md Pitfall 8; the browser needs a `fetch`-based client).

**Imports pattern** (`index-client.ts` lines 9-13):
```typescript
import type { DashboardIndexDocument, DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
```
Adapt to import a new `AthleteConfig`/`GearMap` type instead.

**Fetch-once + memoize + non-poisoning-failure pattern** (`index-client.ts` lines 71-90, `loadIndex`):
```typescript
function loadIndex(): Promise<DashboardIndexDocument> {
  if (inFlight) return inFlight;
  inFlight = fetchDocument()
    .then((doc) => { document_ = doc; byId = new Map(...); return doc; })
    .catch((error: unknown) => {
      inFlight = null; // a transient failure must not permanently poison the client
      throw error;
    });
  return inFlight;
}
```
Copy this shape for both new clients, but change the *caller contract*: per D-31/D-33, `gear-client`/`athlete-config-client` must resolve to `null` (not reject) on a 404 or malformed body, since a missing `data/athlete.json`/`data/gear.json` is a legitimate degraded state (mirrors `overview.ts`'s `fetchStatsJson`, lines 64-75, which already does exactly this: try/catch around fetch+parse, returns `null` on any failure, logs via `console.error`, never rejects into the view).

**FetchLike reuse:** import the existing `FetchLike` type from `index-client.ts` (already exported, line 20) rather than redefining it — same minimal-fetch-shape-for-testability convention `detail-client.ts` line 12 already follows (`import type { FetchLike } from './index-client.js';`).

---

### `data/athlete.json` and `data/gear.json` (config, file-I/O — new, committed)

**Analog:** `data/best-effort-exclusions.json` (schema/shape convention only — not its Node-only loading mechanism, per RESEARCH.md Pitfall 8).

**Shape convention to copy** (`data/best-effort-exclusions.json`, full file):
```json
{
  "schemaVersion": 1,
  "note": "Hand-maintained by the developer. <purpose statement>.",
  "<payload-key>": [ /* ... */ ]
}
```
`data/gear.json` payload: an id→name map (`{ "schemaVersion": 1, "note": "...", "gear": { "g16649854": "Nike Pegasus 40", ... } }`). `data/athlete.json` payload: `{ "schemaVersion": 1, "note": "...", "maxHr": <number>, "hrZones": [{ "zone": 1, "minBpm": ..., "maxBpm": ... }, ...] }` (Claude's Discretion on exact field names per CONTEXT.md, but the `schemaVersion`+`note` envelope is the locked convention to follow).

---

## Shared Patterns

### Stale-render guard + fetch-once client (applies to: `list.ts`, `calendar.ts`, `detail.ts`, `detail-map.ts`, `detail-charts.ts`)
**Source:** `src/dashboard/views/detail.ts` lines 213-255 (`loadAndRender`'s `requestToken` pattern) and `src/dashboard/data/index-client.ts` lines 71-90 (`loadIndex`'s `inFlight` memoization).
```typescript
const myToken = ++requestToken;
// ...await...
if (myToken !== requestToken || mountedContainer !== container) return; // stale-guard
```
Apply to every new async view/sub-view mount (calendar month fetch/derive, chart lazy-import, map lazy-import) — a fast back-and-forth between two activities or two calendar months must never paint a superseded result (WR-01/T-16-VW-04 lineage).

### Athlete-authored text is `textContent`-only (applies to: every new render site)
**Source:** `src/dashboard/views/list.ts` lines 87-94 (`renderActivityRow`'s `nameEl.textContent = row.name;`) and `detail.ts` line 150 (`heading.textContent = activity.name; // athlete free text — textContent only`).
Applies to every new table cell, calendar multi-run picker row, and splits-table cell that touches `row.name`/`activity.name`/`location` — never an `innerHTML` string interpolation (T-16-VW-01, deliberately deviating from `route-utils.ts`'s own `formatPopupContent` which DOES use unescaped template-string HTML at lines 149-167 — that is the explicitly-flagged anti-pattern this dashboard must not copy, even though it lives in a shared file this phase otherwise reuses).

### Tamper-safe localStorage persistence (applies to: `detail-charts.ts`'s overlay config, D-20)
**Source:** `src/dashboard/theme.ts` lines 32-35 (`parseThemeMode`) and lines 63-69 (`readStoredMode`).
```typescript
export function parseThemeMode(raw: unknown): ThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  return 'auto';
}
export function readStoredMode(storage: ThemeStorage): ThemeMode {
  try { return parseThemeMode(storage.getItem(THEME_STORAGE_KEY)); }
  catch { return 'auto'; }
}
```
Mirror exactly for `OVERLAY_STORAGE_KEY`: allow-list every field (channel name against a fixed union, cap array length at 2 per band) on READ, not just on write, and wrap `getItem`/`setItem` in try/catch, falling back to "no overlay selected" on any parse failure — RESEARCH.md's Code Examples section (`readStoredOverlayConfig`) already sketches the adapted form.

### Fetch-and-degrade-gracefully for optional stats/config JSON (applies to: `gear-client.ts`, `athlete-config-client.ts`)
**Source:** `src/dashboard/views/overview.ts` lines 64-75 (`fetchStatsJson`):
```typescript
async function fetchStatsJson<T>(url: string, doFetch: FetchLike): Promise<T | null> {
  try {
    const response = await doFetch(url);
    if (!response.ok) throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}
```
This exact function — a missing `data/stats/*.json` already degrades to a `—` stat card rather than an error state. Reuse this idiom (or literally this generic helper, factored out) for `data/athlete.json`/`data/gear.json` — D-31/D-33's "hide the panel / omit the tile" behavior is this same null-propagation pattern one level up.

### Publish-pipeline extension for new committed data (applies to: `data/athlete.json`, `data/gear.json`)
**Source:** `scripts/build-widgets.mjs` lines 135-146 (`dataDirs` array in `copyDataFiles`):
```javascript
const dataDirs = [
  { src: 'data/stats', dest: 'dist/widgets/data/stats' },
  // ...
  { src: 'data/dashboard', dest: 'dist/widgets/data/dashboard' },
  { src: 'data/activities', dest: 'dist/widgets/data/activities' },
  { src: 'data/streams', dest: 'dist/widgets/data/streams' },
];
```
Per RESEARCH.md Pitfall 7 / Open Question 1: add one new directory-copy entry, e.g. `{ src: 'data/config', dest: 'dist/widgets/data/config' }`, and commit `data/athlete.json`/`data/gear.json` under `data/config/` — this reuses the tested per-directory copy loop (lines 148-176) with zero new logic, the lowest-risk option given the Phase 16 black-page precedent of an omitted copy path.

### Publish-contract smoke check extension (applies to: any new fetch URL and any new lazy chunk)
**Source:** `scripts/verify-dashboard-publish.mjs` lines 168-180 (`expect200`) and lines 93-110 (`expectAssetResolves`, the root-absolute-URL hard-fail rule).
```javascript
async function expect200(baseUrl, path, { nonEmpty = true } = {}) {
  const { status, body } = await get(`${baseUrl}${path}`);
  if (status !== 200) { fail(`GET ${path} expected 200, got ${status}`); return null; }
  if (nonEmpty && body.length === 0) { fail(`GET ${path} returned 200 but an empty body`); return null; }
  ok(`GET ${path} -> 200`);
  return body;
}
```
Add `await expect200(baseUrl, '/data/config/athlete.json');` and `.../gear.json` alongside the existing `all-time-totals.json`/`streaks.json` checks (lines 237-238). Per RESEARCH.md Open Question 2, treat automated dynamic-chunk-resolves verification as nice-to-have, not required — the mandatory gate for the Leaflet/Chart.js lazy chunks is the real-browser manual checkpoint (open a detail view, confirm Network tab has no 404s), consistent with how this same script's own MOUNT_PREFIX design already exists specifically because an earlier automated check missed a production defect.

### Design-token extension (applies to: `styles.css`)
**Source:** `src/dashboard/styles.css` lines 39-59 (`:root[data-theme="light"]`/`"dark"` blocks) and lines 287-308 (`@media (max-width: 640px)` block, the only existing breakpoint).
Add `--accent-strong` and the four `--chart-*` tokens inside both theme blocks (not `:root`, matching how every existing color token is theme-scoped), and add a new `@media (max-width: 720px)` block for the list table/card switch — modeled on the existing 640px block's structure but a distinct, non-coinciding breakpoint (UI-SPEC explicitly confirms these do not align).

## No Analog Found

None — every file has at least a role-match analog. The one caveat, not a missing analog but a missing *mechanism*: the lazy `import()` code-splitting boundary itself (D-25) has zero precedent anywhere in this browser-side codebase (RESEARCH.md Pattern 3 confirms via grep that the only existing `import()` usages are Node-CLI-side, in `src/index.ts` and `src/exports/geometry-readers.ts`). Treat Vite's documented dynamic-import behavior as the reference, not an in-repo file, and verify it in a real browser per Pitfall 5/Assumption A1.

## Metadata

**Analog search scope:** `src/dashboard/` (all views, data clients, router, registry, theme, styles), `src/widgets/shared/route-utils.ts`, `src/widgets/single-run-map/`, `src/widget/chart-config.ts`, `src/widgets/comparison-chart/chart-config.ts`, `src/widgets/streak-widget/chart-config.ts`, `src/analytics/best-effort-utils.ts`, `src/analytics/best-effort-exclusions.ts`, `data/best-effort-exclusions.json`, `scripts/build-widgets.mjs`, `scripts/verify-dashboard-publish.mjs`.
**Files scanned:** 24 read in full or in targeted sections; no file exceeded 2,000 lines (largest was `styles.css` at 308 lines and `verify-dashboard-publish.mjs` at 306 lines), so no offset/limit chunking was required.
**Pattern extraction date:** 2026-08-11
