# Phase 18: Records, Trends & Differentiators - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 27 (new) + 4 (modified)
**Analogs found:** 27 / 27 (all files have at least a role-match; several have exact matches)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/dashboard/views/records.ts` | view (registry module) | request-response (fetch + render) | `src/dashboard/views/overview.ts` | exact (multi-card page, stats fetch, error/loading states) |
| `src/dashboard/views/records-logic.ts` | utility (pure logic) | transform | `src/dashboard/views/calendar-logic.ts` | exact (pure, DOM-free, tested) |
| `src/dashboard/views/records-logic.test.ts` | test | — | `src/dashboard/views/calendar-logic.test.ts` | exact |
| `src/dashboard/views/records-charts.ts` | component (chart mount) | streaming/render | `src/dashboard/views/detail-charts.ts` | exact (canvas lifecycle, theming, destroy handle) |
| `src/dashboard/views/trends.ts` | view (registry module) | request-response, tabbed | `src/dashboard/views/detail.ts` (tab-less but async multi-section) + `src/dashboard/views/calendar.ts` (query-string state) | role-match (no existing tabbed view; compose from two analogs) |
| `src/dashboard/views/trends-volume-logic.ts` | utility (pure logic) | transform | `src/dashboard/views/calendar-logic.ts` (grid/tint math) | exact |
| `src/dashboard/views/trends-yoy-logic.ts` | utility (pure logic) | transform (thin pass-through) | `src/dashboard/views/calendar-logic.ts` | role-match |
| `src/dashboard/views/trends-cadence-hr-logic.ts` | utility (pure logic) | transform (aggregate over index) | `src/dashboard/views/list-logic.ts` (`filterRows`/`sortRows` style reduction) | role-match |
| `src/dashboard/views/trends-training-load-logic.ts` | utility (pure logic) | transform (gap/coverage detection) | `src/dashboard/views/calendar-logic.ts` | role-match |
| `src/dashboard/views/trends-gear-logic.ts` | utility (pure logic) | transform (grouping) | `src/dashboard/views/list-logic.ts` | role-match |
| `src/dashboard/views/trends-charts.ts` | component (chart mount) | streaming/render | `src/dashboard/views/detail-charts.ts` | exact |
| `src/dashboard/views/chart-theme.ts` | utility (extracted shared module) | — | `src/dashboard/views/detail-charts.ts` lines 92-151 | exact (this is a literal extraction) |
| `src/dashboard/views/detail.ts` (MODIFIED — PR badge + panel) | view | request-response | itself (existing file, extend in place) | exact |
| `src/dashboard/views/detail-sections.ts` (MODIFIED — best-efforts panel) | component (section builder) | request-response | `src/dashboard/views/detail-sections.ts` `buildSplitsSection`/`buildBreakdownSection` (same file, sibling functions) | exact |
| `src/dashboard/views/list.ts` (MODIFIED — export `appendBadge`) | utility (existing file) | — | itself | exact |
| `src/dashboard/view.types.ts` (MODIFIED — remove `STUB_PHASE` entries) | config/types | — | itself (17-10 calendar precedent) | exact |
| `src/dashboard/view-registry.ts` (MODIFIED — swap stub imports) | route/registry | — | itself | exact |
| `src/analytics/compute-training-load.ts` | service (build-time compute step) | batch (reads 1,687 stream files) | `src/analytics/compute-best-efforts.ts` | exact (manifest-driven sweep, schemaVersion/note doc) |
| `src/analytics/training-load.types.ts` | model (types) | — | `src/analytics/best-effort.types.ts` | exact |
| `src/analytics/trimp.ts` | utility (pure formula) | transform | `src/dashboard/views/detail-charts-logic.ts` `derivePaceSeries`/`interpValueAtTime` (real-Δt integration over decimated stream) | exact |
| `src/analytics/trimp.test.ts` | test | — | `src/analytics/best-effort-utils.test.ts` | exact |
| `src/analytics/training-load.test.ts` | test | — | `src/analytics/streak-utils.test.ts` | role-match |
| `src/analytics/compute-age-grading.ts` | service (build-time compute step) | batch (reads config + best-efforts + wma tables) | `src/analytics/compute-dashboard-index.ts` | exact (reads multiple committed/generated inputs, cross-references, writes one document) |
| `src/analytics/age-grading.types.ts` | model (types) | — | `src/analytics/best-effort.types.ts` | exact |
| `src/analytics/wma-factors.ts` | utility (pure lookup) | transform | `src/analytics/date-utils.ts` (small pure exported functions, no class) | role-match |
| `src/analytics/wma-factors.test.ts` | test | — | `src/analytics/best-effort-utils.test.ts` | exact |
| `src/analytics/riegel.ts` | utility (pure formula + OLS fit) | transform | `src/analytics/streak-utils.ts` (`calculateDailyStreaks` — pure function taking arrays, returning a result object) | role-match |
| `src/analytics/riegel.test.ts` | test | — | `src/analytics/streak-utils.test.ts` | exact |
| `src/analytics/compute-gear-aggregate.ts` | service (build-time compute step) | batch (reduces 1,867 index rows) | `src/analytics/compute-dashboard-index.ts` | exact |
| `src/analytics/gear-aggregate.types.ts` | model (types) | — | `src/analytics/dashboard-index.types.ts` | exact |
| `src/analytics/compute-dashboard-index.ts` (MODIFIED — resolved gear name field) | service (existing build step, extended) | batch | itself | exact |
| `data/wma/road-factors.json`, `data/wma/track-factors.json` | config (committed data) | — | `data/best-effort-exclusions.json` (schemaVersion/note/hand-maintained JSON precedent) | exact |
| `data/config/athlete.json` (MODIFIED — split, see Pitfall 1) | config | — | itself + `data/config/gear.json` (sibling hand-maintained config) | exact |
| `data/config/athlete-private.json` (NEW, if Pitfall-1 split adopted) | config (must NOT be published) | — | no existing analog — first "must not be copied" config file in the repo | none (flagged below) |
| `src/dashboard/data/athlete-config-client.ts` (MODIFIED — birthDate/sex/restingHr) | service (client, existing) | request-response | itself | exact |
| `src/index.ts` (MODIFIED — new CLI subcommands + `compute-all-stats` chain) | route (CLI switch) | request-response | itself, `computeBestEffortsCommand`/`computeDashboardIndexCommand` (lines ~185-226) | exact |
| `scripts/build-widgets.mjs` (MODIFIED — `copyDataFiles` list) | config (build script) | file-I/O | itself, `copyDataFiles` (line 134) | exact |
| `scripts/verify-dashboard-publish.mjs` (MODIFIED — new asserts + first negative/404 check) | test (integration/HTTP) | request-response | itself, `expect200`/`expect404` (lines 168-190) | exact |

## Pattern Assignments

### `src/dashboard/views/records.ts` (view, request-response)

**Analog:** `src/dashboard/views/overview.ts` (multi-card page fetching several `data/stats/*.json` files in parallel) + `src/dashboard/views/list.ts` (stale-render/error/loading conventions, `.view` wrapper)

**Imports pattern** (`overview.ts` lines 11-19):
```typescript
import type { DashboardView, ViewMountContext } from '../view.types.js';
import { ROUTES } from '../view.types.js';
import type { IndexClient, FetchLike } from '../data/index-client.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import { renderActivityRow, formatActivityDate } from './list.js';
```
Records needs `formatActivityDate`, the new `formatEffortDuration` (add to `list.ts` per 18-UI-SPEC § 14), and `appendBadge` (export it — see Shared Patterns below).

**Parallel-stats-fetch pattern** (`overview.ts` lines 195-225, `fetchStatsJson` helper at lines 64-75):
```typescript
async function fetchStatsJson<T>(url: string, doFetch: FetchLike): Promise<T | null> {
  try {
    const response = await doFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}
// ...
[, totals, streaks] = await Promise.all([
  indexClient.loadIndex(),
  fetchStatsJson<AllTimeTotals>(`${STATS_BASE_URL}all-time-totals.json`, doFetch),
  fetchStatsJson<StreaksStats>(`${STATS_BASE_URL}streaks.json`, doFetch),
]);
```
Records fetches `best-efforts.json`, `age-grading.json` (may be absent per D-13 — must degrade to `null`, not throw), `weekly-distance.json`, `monthly-stats.json`, `streaks.json` this same way — one `fetchStatsJson<T>` call per file, `Promise.all`.

**Stale-render / mount-guard pattern** (`overview.ts` lines 185-231):
```typescript
mountedContainer = ctx.container;
ctx.container.replaceChildren();
// ...loading indicator...
try {
  [/* fetches */] = await Promise.all([...]);
} catch (error) {
  if (mountedContainer !== ctx.container) return; // WR-01
  // render error-state
  return;
}
if (mountedContainer !== ctx.container) return;
ctx.container.replaceChildren();
// build view, append heading with tabIndex=-1, .focus() at the end
```
Records is single-token (no activity-to-activity race like detail.ts), so `mountedContainer !== ctx.container` is the only guard needed — do not import `detail.ts`'s heavier `requestToken` machinery, it is solving a different problem (rapid param changes), which Records does not have.

**Error-state pattern** (`overview.ts` lines 213-224, verbatim 3-part formula per Copywriting Contract):
```typescript
const errorState = document.createElement('section');
errorState.className = 'error-state';
const heading = document.createElement('h2');
heading.className = 'text-heading';
heading.textContent = "Couldn't load records"; // exact 18-UI-SPEC copy
const body = document.createElement('p');
body.className = 'text-body';
body.textContent = 'Check your connection and try again.';
errorState.appendChild(heading);
errorState.appendChild(body);
```
Add a Retry `<button class="cta">` per `detail.ts`'s `renderErrorState` (lines 148-173) since Records' error state is retryable (unlike detail's malformed-id case).

**Section/card pattern** (`detail-sections.ts` lines 134-151, `detail.ts` lines 468-507): every Records section is `<section class="card detail-section">` with an `<h2>`/`<h3 class="text-heading">` — reuse verbatim, do not invent a new section wrapper class.

**Sticky jump list + `IntersectionObserver`:** no existing analog in this codebase (first sticky in-page nav). Implement fresh per 18-UI-SPEC § 1; the only reusable precedent is `list.ts`'s `highlightAndFocus` (`scrollIntoView` + `.focus()` on a heading, lines 877-889) for the click-to-jump behavior.

---

### `src/dashboard/views/records-logic.ts` (utility, transform)

**Analog:** `src/dashboard/views/calendar-logic.ts` (whole file — pure, DOM-free, `now`/inputs always injected, never constructed internally)

**Module header convention** (`calendar-logic.ts` lines 1-10):
```typescript
/**
 * Calendar training log — pure, DOM-free date math and per-day aggregation.
 * ...
 * `now` is always injected by the caller, never constructed fresh
 * inside this module — keeps every function here total and deterministic.
 */
```
Apply the same discipline to `records-logic.ts`: table sort/empty-state derivation, Riegel-matrix-row building (calls into `riegel.ts`), superlative selection (`max()` over `weekly-distance.json`/`monthly-stats.json`) — every function total, no `new Date()` inside, no DOM.

**Total/never-throws function shape** (`calendar-logic.ts` `parseMonthParam`, lines 36-51): every malformed-input branch falls back to a safe default rather than throwing — apply this to the marathon-empty-state check (`rankings.marathon.length === 0` → return a sentinel, never throw) and to reading `age-grading.json` fields (missing → `null`, not an exception).

---

### `src/dashboard/views/records-charts.ts` (component, streaming/render — the 7 PR-evolution step charts)

**Analog:** `src/dashboard/views/detail-charts.ts` (whole-file structure: registration, theming, canvas lifecycle, destroy handle)

**Lazy-chunk-boundary comment convention** (`detail-charts.ts` lines 1-17) — copy this exact framing, adjusted for Records:
```typescript
/**
 * LAZY-CHUNK BOUNDARY (D-25 precedent): this module places a PLAIN TOP-LEVEL
 * STATIC import of `chart.js`. No other module may import this file
 * statically — `records.ts` reaches it only via `await import(...)`.
 */
```

**Tree-shaken registration** (`detail-charts.ts` line 54):
```typescript
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Filler, Decimation);
```
Records' evolution charts need only `LineController, LineElement, PointElement, LinearScale, Tooltip` — no `Filler` (no area fill per D-06) — trim the registration list to what's actually used, matching this file's own "tree-shaken" framing.

**Theme/token resolution** (`detail-charts.ts` lines 97-151 — `resolveToken`, `resolveChannelPalette`, `resolveThemeColors`, `hexToRgba`): per 18-UI-SPEC § 14, extract these four functions into a new shared `src/dashboard/views/chart-theme.ts` and import from both `detail-charts.ts` and `records-charts.ts`/`trends-charts.ts` — do not re-copy them a second time.

**Duration axis tick formatting** (`detail-charts.ts` lines 195-203, `formatXTick`):
```typescript
function formatXTick(value: number, mode: XAxisMode): string {
  if (mode === 'time') {
    const totalSeconds = Math.round(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return `${value.toFixed(1)} km`;
}
```
Same `ticks.callback` pattern for the evolution charts' y-axis (`formatEffortDuration`) and x-axis (year-only per 18-UI-SPEC § 3). Never introduce `TimeScale`/a date adapter (RESEARCH confirms zero precedent, and 18-UI-SPEC § 14 restates this as a hard requirement).

**Canvas destroy-and-rebuild handle** (`detail-charts.ts` lines 260-267, 600-647):
```typescript
export interface ChartBandsHandle {
  destroy(): void;
}
function rebuildBands(): void {
  for (const band of bands) band.chart.destroy();
  bands.length = 0;
  // ...rebuild...
}
// public handle:
return {
  destroy(): void {
    if (destroyed) return;
    destroyed = true;
    for (const band of bands) band.chart.destroy();
    bands.length = 0;
    root.remove();
  },
};
```
For Records' 7 independent instances (never rebuilt after initial mount per 18-UI-SPEC § 3 — no tab-switch churn), the `rebuildBands`-per-toggle machinery is not needed; keep only the `destroy()` handle shape, called once from `records.ts`'s `unmount()`.

**MUST NOT copy:** the cross-band shared-x-domain computation (`computeSharedDomain`, referenced at `detail-charts.ts` line 606) — 18-UI-SPEC § 3 explicitly forbids a shared scale across the 7 evolution cards (different date ranges, 44s–87min value range). Each chart's `min`/`max` must be independently auto-ranged.

---

### `src/dashboard/views/trends.ts` (view, tabbed request-response)

**No exact existing analog — first tabbed view in this codebase.** Compose from two:

**Query-string state parsing** (`calendar-logic.ts` `parseMonthParam`, lines 36-51 — total, allow-list, never throws) crossed with `list-logic.ts`'s allow-list convention (lines 16-20, 106-114):
```typescript
export const SORT_KEYS: readonly SortKey[] = ['date', 'distance', 'movingTime', 'pace', 'avgHr'];
// ...
const sort: SortKey =
  sortParam !== null && (SORT_KEYS as readonly string[]).includes(sortParam)
    ? (sortParam as SortKey)
    : DEFAULT_SORT;
```
Model `TREND_TAB_KEYS` and `parseTrendTab(raw: string | null): TrendTabKey` on this exact shape — unrecognized value falls back to `'volume'`, never throws (V5 Input Validation requirement in RESEARCH's Security Domain).

**Multi-section async mount with per-await stale-render guards** (`detail.ts` lines 380-435, 437-450 — `mountHeavySections`, each `await` re-checks `myToken`/`mountedContainer`): Trends' lazy per-tab chart module import needs the same discipline — every `await import('./trends-charts.js')` and every subsequent stats fetch re-checks a token before painting, exactly like `detail.ts`'s `mountChartSection`.

**Tabpanel loading indicator** (`overview.ts` lines 189-193):
```typescript
const loading = document.createElement('div');
loading.className = 'loading-indicator';
loading.setAttribute('role', 'status');
loading.textContent = 'Loading overview…';
```
Reuse verbatim per tab, text swapped to "Loading {tab name}…" per 18-UI-SPEC § 7.

**Rolling-totals header strip** (`.stat-grid`, `buildStatCard`): copy `overview.ts`'s `buildStatCard` (lines 44-55) and `buildHeadlineStatsCard` (lines 101-123) shape directly — same two-line tile anatomy, zero new CSS.

---

### `src/dashboard/views/trends-volume-logic.ts` / `trends-training-load-logic.ts` / `trends-gear-logic.ts` / `trends-cadence-hr-logic.ts` / `trends-yoy-logic.ts` (utility, transform)

**Analog:** `src/dashboard/views/calendar-logic.ts` `buildMonthGrid` (lines 149-201) for grouping/reduction shape, and `list-logic.ts` `filterRows`/`sortRows` (lines 205-258) for array-reduction-over-index-rows shape.

**Grouping-by-key pattern** (`calendar-logic.ts` lines 151-164):
```typescript
const byDay = new Map<string, DashboardIndexRow[]>();
for (const row of rows) {
  const dayKey = activityDayKey(row.startDateLocal);
  if (dayKey === null) continue;
  if (!dayKey.startsWith(`${monthPrefix}-`)) continue;
  const existing = byDay.get(dayKey);
  if (existing) existing.push(row);
  else byDay.set(dayKey, [row]);
}
```
Directly reusable shape for: the year heatmap's daily-totals derivation (group by day, D-04), `trends-cadence-hr-logic.ts`'s monthly-mean grouping (group by `YYYY-MM`), and `trends-gear-logic.ts`'s per-shoe grouping (group by resolved gear name, with an explicit `'Unknown'` key per D-18 — never a filtered-out `null`).

**Tint-step / cell-placement math** (`calendar-logic.ts` `tintStepForDistance`, lines 120-126, and `DayCell`/`buildMonthGrid`'s week-row layout, lines 96-201) is the direct model for the year heatmap's `buildYearGrid`/`distanceToColor` functions (RESEARCH Pattern 3) — same "pure, unit-testable placement math, no DOM" discipline, same Sunday-first / UTC-day-key convention.

**Date normalization rule — MUST reuse, never refork** (`list.ts` lines 49-66, `calendar-logic.ts` lines 71-92): every new logic module that buckets by day/month must call the existing Z-suffix-normalization convention (append `Z` when absent, read via `getUTC*`), not invent a second date-parsing routine. Import `activityDayKey` from `calendar-logic.ts` rather than duplicating it, or extract the shared normalizer if `calendar-logic.ts` shouldn't itself be imported by `trends-*`.

---

### `src/dashboard/views/trends-charts.ts` (component, streaming/render)

**Analog:** `src/dashboard/views/detail-charts.ts` — same registration/theming/destroy-handle patterns as `records-charts.ts` above. Additional patterns specific to Trends:

**Filler-based area fill for CTL** (`detail-charts.ts` line 54 registers `Filler`; overlay area-fill config around line 540):
```typescript
backgroundColor: hexToRgba(palette[overlayChannel], i === 0 ? 0.18 : 0.1),
```
Reuse this alpha-blended fill approach for the CTL series (`--load-ctl` at low alpha) per 18-UI-SPEC § 11.

**Local (non-`Chart.register`) plugin for the thin-HR-coverage shading** (`detail-charts.ts` `createCrosshairPlugin`, lines 231-254 — the exact per-instance `afterDraw` shape 18-UI-SPEC § 11 names explicitly):
```typescript
function createCrosshairPlugin(getActiveX: () => number | null, color: string): Plugin<'line'> {
  return {
    id: 'chartBandsCrosshair',
    afterDraw(chart) {
      const activeX = getActiveX();
      if (activeX === null) return;
      const xScale = chart.scales.x;
      if (!xScale) return;
      const pixelX = xScale.getPixelForValue(activeX);
      if (!Number.isFinite(pixelX)) return;
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pixelX, top);
      ctx.lineTo(pixelX, bottom);
      ctx.stroke();
      ctx.restore();
    },
  };
}
```
Write a sibling `createThinCoverageShadingPlugin` in exactly this shape (`afterDraw`, registered via each chart's own `plugins: [...]` array, not globally) — draw a filled rectangle instead of a stroked line, per 18-UI-SPEC's "flat rectangle, not a hatch pattern" requirement.

**Pinned y-axis gutter width** (`detail-charts.ts` `Y_AXIS_WIDTH_PX = 72`, lines 63-78 and its application at line 514, `scale.width = Y_AXIS_WIDTH_PX`): mandatory reuse for the Cadence & HR tab's two stacked single-axis charts (18-UI-SPEC § 10 explicitly calls this out as "a mandatory reuse, not a suggestion" — it is the exact fix for Phase 17's GAP 2 misaligned-axis defect).

**Destroy-and-rebuild on tab switch:** same `rebuildBands()` shape (`detail-charts.ts` lines 600-613) — call `chart.destroy()` on every chart in the outgoing tab before mounting the incoming tab's charts, per 18-UI-SPEC § 7's locked decision.

---

### `src/analytics/compute-training-load.ts` (service, build-time compute step)

**Analog:** `src/analytics/compute-best-efforts.ts` (whole file — manifest-driven stream sweep, per-activity computation, schemaVersion/note doc, console summary)

**Manifest-driven sweep shape** (`compute-best-efforts.ts` lines 149-179, mirrored in `compute-dashboard-index.ts` lines 72-126):
```typescript
const fileStore = new FileStore('.');
const manifest = await loadManifest(fileStore, streamsManifestPath);
for (const [id, entry] of Object.entries(manifest.activities)) {
  try {
    // read data/streams/{id}.json when entry.available
    // compute per-activity result
  } catch (error) {
    console.warn(`  ${id}: ${(error as Error).message}; skipping`);
    continue;
  }
}
```
`compute-training-load.ts` follows this exactly: sweep the manifest, read each available stream, call `edwardsTrimp`/`banisterTrimp` (from `trimp.ts`) per activity, accumulate into the daily map, then run `computeCtlAtlTsb` (from a `training-load.ts` pure module) over the continuous spine.

**Optional-input degrade-with-warning pattern** (`compute-dashboard-index.ts` lines 90-114):
```typescript
let bestEfforts: BestEffortsDocument | undefined;
try {
  bestEfforts = await fileStore.readJson<BestEffortsDocument>(path.join(statsDir, 'best-efforts.json'));
} catch (error) {
  console.warn(`Could not read best-efforts document (${(error as Error).message}); PR counts ... will be absent.`);
}
```
Apply this to reading `data/config/athlete-private.json` (or wherever `birthDate`/`sex`/`restingHr` live post-Pitfall-1-split, if they're needed for Banister) — a missing file degrades the Banister series to absent, never a hard failure of the whole compute step (Edwards must still run per D-14).

**Schema/doc shape** (`compute-best-efforts.ts` lines 287-297, `compute-dashboard-index.ts` lines 222-230):
```typescript
const doc = {
  schemaVersion: TRAINING_LOAD_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  note: 'Derived, gitignored, and regenerated by `node dist/index.js compute-training-load`. Consumers read this file rather than recomputing.',
  totals: { /* ... */ },
  // per-day series
};
await fileStore.writeJson(path.join(outDir, 'training-load.json'), doc);
```
Follow this `schemaVersion`/`generatedAt`/`note` triple verbatim — every `data/stats/*.json` file in this repo has exactly this shape.

---

### `src/analytics/trimp.ts` (utility, pure formula over a decimated stream)

**Analog:** `src/dashboard/views/detail-charts-logic.ts` `derivePaceSeries`/`interpValueAtTime` (lines 67-130) — the established "integrate by real elapsed time between samples, never assume uniform sampling" pattern (directly addresses RESEARCH's Pitfall 2).

**Real-Δt integration pattern** (`detail-charts-logic.ts` lines 96-130):
```typescript
export function derivePaceSeries(t: number[], d: number[], windowSec: number): (number | null)[] {
  // ...
  for (let i = 0; i < n; i++) {
    const windowStart = Math.max(tStart, t[i] - half);
    const windowEnd = Math.min(tEnd, t[i] + half);
    const elapsed = windowEnd - windowStart; // REAL elapsed time, not a sample count
    if (!(elapsed > 0)) { result[i] = null; continue; }
    // ...
  }
}
```
`edwardsTrimp`/`banisterTrimp` must use the same real-`Δt` shape (`(t[i+1] - t[i]) / 60`, never `duration / n`) — this is exactly what the phase's own RESEARCH.md Code Examples section already drafts; the analog confirms it is this codebase's established idiom, not a one-off.

---

### `src/analytics/compute-age-grading.ts` (service, build-time compute step)

**Analog:** `src/analytics/compute-dashboard-index.ts` (whole file — reads multiple committed/generated inputs, cross-references by activity id, writes one output document)

**Cross-referencing multiple sources pattern** (`compute-dashboard-index.ts` lines 91-114, 159-164):
```typescript
const bestEffortsEntry: ActivityBestEfforts | undefined = bestEfforts?.activities[id];
const prCount = bestEffortsEntry
  ? bestEffortsEntry.efforts.filter((e) => e.wasPRAtTheTime === true).length
  : 0;
```
`compute-age-grading.ts` reads `data/stats/best-efforts.json` (rankings), the committed `data/wma/*.json` factor tables, and `data/config/athlete.json` (or the private split) for `birthDate`/`sex`, then emits **only the resulting percentage** per ranking entry (D-20's "identity inputs never reach the published payload" — confirmed as a real gap, see Pitfall 1 note below).

---

### `src/analytics/riegel.ts` / `src/analytics/wma-factors.ts` (utility, pure formula/lookup — CLIENT-SAFE, no Node-only imports)

**Analog:** `src/analytics/streak-utils.ts` `calculateDailyStreaks` (lines 49-125) — pure function, typed input array, typed result object, no I/O, unit-tested by a colocated `*.test.ts`.

**Guard-and-return-null-or-a-result-object pattern**, matching D-11's self-suppression requirement, modeled on `calculateDailyStreaks`'s own defensive-empty-input handling:
```typescript
export function fitRiegelExponent(
  points: { distanceM: number; durationSec: number; activityId: string }[]
): { b: number; distances: string[] } | null {
  const distinctActivities = new Set(points.map((p) => p.activityId));
  if (distinctActivities.size < 3) return null; // D-11 guard, evaluated by activityId, never by row count
  // ...OLS...
}
```
(This exact function is already drafted in RESEARCH.md's Code Examples — cite it directly; the codebase precedent is `streak-utils.ts`'s "guard on the real input shape, return a structured null-able result" idiom, not a thrown exception.)

**`normalizeToUTCMidnight`-style day-key discipline** (`streak-utils.ts` line 30) is the precedent `wma-factors.ts`'s age-at-activity-date computation should follow if it needs to derive age from `birthDate` — UTC-only, no local-timezone date arithmetic, matching `date-utils.ts`'s stated convention ("All functions use UTC methods exclusively for timezone safety").

---

### `src/analytics/compute-gear-aggregate.ts` (service, build-time compute step)

**Analog:** `src/analytics/compute-dashboard-index.ts` — same "sweep rows, group, aggregate, write one document" shape as above. Group by resolved gear name (post D-17 resolution, computed in the same pass as `compute-dashboard-index.ts`'s extension), including an explicit `'Unknown'` bucket (D-18) — never drop ungeared rows from the aggregate.

---

### `src/analytics/compute-dashboard-index.ts` (MODIFIED — D-17 gear-name resolution)

**Existing pattern to extend** (lines 126-207, the per-activity `for` loop building each `row`): add gear-name resolution inline, reusing `resolveGearLabel` from `gear-client.ts` (lines 61-78) — **but note `gear-client.ts` is a browser client module; the build step needs the pure resolution ladder without the fetch wrapper.** Either import the pure `resolveGearLabel` function directly (it has no browser-only dependency — it's already pure, taking `gearMap`/`gearId`/`deviceName` as plain arguments) or extract it to a shared location both the client and the build step import from. Read `data/config/gear.json` directly via `fileStore.readJson` (same optional-degrade pattern as the best-efforts read at lines 90-101) rather than going through the browser `GearClient`.

---

### `src/dashboard/views/detail.ts` + `detail-sections.ts` (MODIFIED — D-08 PR badge + best-efforts panel)

**Analog:** the file's own existing `buildStatCard`/section patterns (`detail.ts` lines 454-536) plus `list.ts`'s `appendBadge` (lines 103-108, to be exported).

**Badge placement** (`detail.ts` lines 454-463, insert immediately after):
```typescript
const heading = document.createElement('h1');
heading.className = 'text-heading';
heading.tabIndex = -1;
heading.textContent = activity.name;
view.appendChild(heading);
// INSERT: PR badges here, one per PR-setting distance, using the exported appendBadge
const dateLine = document.createElement('p');
// ...
```

**Best-efforts panel as a new section function in `detail-sections.ts`**, mirroring `buildSplitsSection`'s shape exactly (lines 134-151):
```typescript
export function buildSplitsSection(splits: readonly Split[], activityAvgPaceSecPerKm: number | null): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';
  // heading...
  if (splits.length === 0) {
    // empty state
    return section;
  }
  // table...
  return section;
}
```
`buildBestEffortsSection(efforts: BestEffort[], ...)` follows this identical shape: `card detail-section` wrapper, heading, empty-state early-return (per D-08's "empty run renders named empty state, not omission"), else a `.pr-table`-styled table with the permanent-highlight modifier on PR rows.

**Stale-render guard reuse** (`detail.ts` lines 380-415, `mountChartSection`'s `myToken !== requestToken || mountedContainer !== container` checks): if the best-efforts panel needs its own data fetch (e.g. `data/stats/age-grading.json` for its Age-Grade column), guard that fetch with the exact same token check already threaded through `renderSuccess`.

---

### `src/dashboard/views/list.ts` (MODIFIED — export `appendBadge`, add `formatEffortDuration`)

**Existing private helper to export** (lines 103-108):
```typescript
function appendBadge(container: HTMLElement, text: string): void {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = text;
  container.appendChild(badge);
}
```
Change to `export function appendBadge(...)`. Add `formatEffortDuration` alongside `formatDurationHms`/`formatPace` (lines 74-101), following the exact same JSDoc-with-defect-precedent convention those two carry — document why it differs from `formatDurationHms` (omits the leading `0:` hour component) per 18-UI-SPEC § 14.

---

### `src/dashboard/data/athlete-config-client.ts` (MODIFIED — D-12 new fields)

**Analog:** itself — the existing `parseAthleteConfig`/`load()`/never-rejects shape (lines 36-83) is unchanged; only the fields validated inside `parseAthleteConfig` (in `detail-zones.ts`, per the file's own comment at line 5: "routed through `parseAthleteConfig` — the single validation chokepoint") grow to include `birthDate`, `sex`, `restingHr`. **Do not add a second validation path** — the file's own header comment states this explicitly.

---

### CLI wiring: `src/index.ts` (MODIFIED)

**Analog:** `computeBestEffortsCommand`/`computeDashboardIndexCommand` (lines 185-226):
```typescript
async function computeTrainingLoadCommand() {
  try {
    const { computeTrainingLoad } = await import('./analytics/compute-training-load.js');
    console.log('Computing training load from committed streams...\n');
    await computeTrainingLoad({
      activitiesDir: config.activitiesDir,
      streamsDir: config.streamsDir,
      streamsManifestPath: config.streamsManifestPath,
      statsDir: 'data/stats',
    });
    console.log('\nTraining load generated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Compute training load error:', error.message);
    process.exit(1);
  }
}
```
Add one such function per new compute step, one `case 'compute-training-load':` (etc.) in the `switch (command)` block (~line 502), one help-text line (~line 478-483), and wire each into `computeAllStatsCommand`'s chain (~line 228) alongside the existing `compute-best-efforts`/`compute-dashboard-index` calls — this is D-20's explicit instruction ("wired into the `compute-all-stats` chain").

---

### `scripts/build-widgets.mjs` (MODIFIED — `copyDataFiles`, D-22)

**Existing copy list** (lines 134-148, confirmed live):
```javascript
function copyDataFiles() {
  const dirs = [
    { src: 'data/stats', dest: 'dist/widgets/data/stats' },
    { src: 'data/geo', dest: 'dist/widgets/data/geo' },
    { src: 'data/routes', dest: 'dist/widgets/data/routes' },
    { src: 'data/heatmap', dest: 'dist/widgets/data/heatmap' },
    // ...
    { src: 'data/dashboard', dest: 'dist/widgets/data/dashboard' },
    { src: 'data/activities', dest: 'dist/widgets/data/activities' },
    { src: 'data/streams', dest: 'dist/widgets/data/streams' },
    // Hand-maintained athlete.json and gear.json that the activity detail
    { src: 'data/config', dest: 'dist/widgets/data/config' }
  ];
```
**CONFIRMED (RESEARCH Pitfall 1 is real, verified by direct read):** `data/config` is copied **wholesale** — every `*.json` under it, no per-file filtering. `data/stats` already gets a new sibling entry for free (add `data/wma` as one more `{ src, dest }` pair, same as `data/stats`/`data/geo` — trivial). **The `athlete-private.json` split (if adopted) must NOT go under `data/config/`** — it needs a directory outside every entry in this list (e.g. a new top-level `data/private/` that is deliberately absent from `dirs`), or `copyDataFiles` must change from directory-wildcard to a per-file allow-list. Either way, this file is the one and only place D-22's "every new data file must be added or it 404s" is enforced — and, symmetrically, the one place a file must be *kept out* of for Pitfall 1.

---

### `scripts/verify-dashboard-publish.mjs` (MODIFIED — new asserts + first negative-reachability check)

**Existing positive-assertion pattern** (lines 168-181, `expect200`):
```javascript
async function expect200(baseUrl, path, { nonEmpty = true } = {}) {
  const { status, body } = await get(`${baseUrl}${path}`);
  if (status !== 200) {
    fail(`GET ${path} expected 200, got ${status}`);
  }
  // ...
}
await expect200(baseUrl, '/data/stats/all-time-totals.json');
await expect200(baseUrl, '/data/stats/streaks.json');
```
Add one `expect200(baseUrl, '/data/stats/training-load.json')` / `.../age-grading.json` / `.../gear-aggregate.json` / `/data/wma/road-factors.json` / `/data/wma/track-factors.json` line each, asserting `schemaVersion` on the parsed body exactly like the existing `indexJsonBody` check (lines 225-230).

**Existing negative-assertion pattern** (lines 182-190, `expect404` — already used once, for a stream-unavailable activity):
```javascript
async function expect404(baseUrl, path) {
  const { status } = await get(`${baseUrl}${path}`);
  if (status !== 404) {
    fail(`GET ${path} expected 404 (stream-unavailable activity), got ${status}`);
  }
  ok(`GET ${path} -> 404 (expected, stream-unavailable)`);
}
```
This is the exact function to reuse for Pitfall 1's negative check: `await expect404(baseUrl, '/data/private/athlete-private.json')` (or wherever the split lands) — RESEARCH explicitly flags this as "the FIRST negative-reachability assertion in this script [for a config file]" but the *mechanism* (`expect404`) already exists and is proven; only a new call site is needed, not new plumbing.

---

## Shared Patterns

### Date/day-key normalization (Z-suffix rule)
**Source:** `src/dashboard/views/list.ts` lines 49-66 (`formatActivityDate`), `src/dashboard/views/calendar-logic.ts` lines 71-92 (`activityDayKey`)
**Apply to:** every new logic module that groups `DashboardIndexRow`s by day/week/month (`trends-volume-logic.ts`'s heatmap daily totals, `trends-cadence-hr-logic.ts`'s monthly grouping, `trends-gear-logic.ts`'s coverage-by-year math). Two archive date shapes exist (Strava Z-suffixed vs. intervals.icu no-Z) — every new bucketing function must append `Z` before parsing, exactly like both existing call sites, never invent a third date-parsing routine.
```typescript
const normalized = isoLocal.endsWith('Z') ? isoLocal : `${isoLocal}Z`;
const d = new Date(normalized);
```

### Formatter single-source discipline
**Source:** `src/dashboard/views/list.ts` (owns `formatActivityDate`, `formatDurationHms`, `formatPace`, and the new `formatEffortDuration`); `appendBadge` (to be exported from the same file)
**Apply to:** every new view/logic file that needs a duration, pace, date, or badge — import from `list.ts`, never fork a local copy. The file's own comments explicitly call out that a prior fork of `formatPace` caused a real, shipped rounding defect (11/1,867 rows) — this is a hard-won lesson, not a style preference.

### Chart theming via live CSS custom properties
**Source:** `src/dashboard/views/detail-charts.ts` lines 92-151 (`resolveToken`, `resolveChannelPalette`, `resolveThemeColors`, `hexToRgba`) — to be extracted into `src/dashboard/views/chart-theme.ts` per 18-UI-SPEC § 14
**Apply to:** `records-charts.ts`, `trends-charts.ts` — every new chart resolves color from `getComputedStyle(document.documentElement).getPropertyValue(...)`, never a hardcoded light/dark literal table (that pattern belongs only to the Shadow-DOM widget system, e.g. `comparison-chart/chart-config.ts`, which lacks access to `data-theme`; the dashboard views have that access and must use it).

### Chart.js canvas lifecycle (register locally, destroy before rebuild)
**Source:** `src/dashboard/views/detail-charts.ts` lines 54 (tree-shaken `Chart.register`), 231-254 (locally-registered per-instance plugin), 600-647 (`rebuildBands`/`destroy` handle)
**Apply to:** `records-charts.ts` (destroy-once-on-unmount, no rebuild churn), `trends-charts.ts` (destroy-and-rebuild on every tab switch, per 18-UI-SPEC § 7's locked decision). Never call `new Chart(canvas, ...)` on a canvas with a live instance — always `chart.destroy()` first (the "Canvas is already in use" defect class RESEARCH's Pattern 2 names explicitly).

### Build-time compute-step shape (manifest sweep → cross-reference → schemaVersion doc)
**Source:** `src/analytics/compute-best-efforts.ts`, `src/analytics/compute-dashboard-index.ts` (whole files)
**Apply to:** `compute-training-load.ts`, `compute-age-grading.ts`, `compute-gear-aggregate.ts`. Every one: instantiate `FileStore('.')`, read required inputs with a hard failure on a missing REQUIRED input (manifest) vs. a warn-and-degrade on an OPTIONAL input (best-efforts, athlete config), loop with a per-activity try/catch that warns-and-skips rather than aborting the whole run, and write `{ schemaVersion, generatedAt, note, ...payload }` via `fileStore.writeJson`.

### CLI subcommand + `compute-all-stats` chain wiring
**Source:** `src/index.ts` lines 185-226 (`computeBestEffortsCommand`, `computeDashboardIndexCommand`), `switch (command)` block (~line 502), `computeAllStatsCommand` (~line 228)
**Apply to:** every new `compute-*` step (D-20). One async `compute*Command()` function, one `case`, one help-text line, one addition to the `compute-all-stats` chain — this is a strict one-file, four-touch-point pattern already proven three times in this file.

### `copyDataFiles` publish-dir gate (D-22)
**Source:** `scripts/build-widgets.mjs` lines 134-148
**Apply to:** every new committed (`data/wma/`) or generated (`data/stats/training-load.json` etc., already covered by the existing `data/stats` wildcard entry) data file. `data/wma/` needs its own new `{ src: 'data/wma', dest: 'dist/widgets/data/wma' }` entry — `data/stats/*.json` outputs need none (already wildcard-copied). **Exception, load-bearing:** `athlete-private.json` (if the Pitfall 1 split is adopted) must be placed somewhere this list does NOT reach.

### Stale-render / navigation-race guard
**Source:** `src/dashboard/views/detail.ts` (`requestToken` pattern, lines 261, 287, 351, 358, etc.), `src/dashboard/views/overview.ts` (`mountedContainer !== ctx.container`, lines 209, 229)
**Apply to:** `records.ts` (single-token `mountedContainer` guard is sufficient — no per-param race), `trends.ts` (needs the fuller `requestToken` treatment because tab switches are a real navigation race during an in-flight fetch, more like `detail.ts`'s activity-to-activity case than `overview.ts`'s single-shot case).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `data/config/athlete-private.json` (if Pitfall 1 split adopted) | config (must-not-publish) | — | First "deliberately excluded from `copyDataFiles`" config file in the repo — no precedent for a *negative* publish contract on a config file (only on individual routes, e.g. the stream-unavailable 404 case). Planner should treat this as new ground, validated by the `expect404` reuse noted above. |
| Sticky in-page jump list + `IntersectionObserver` active-section tracking (`records.ts` § 1) | component (nav) | event-driven | No existing view has in-page anchored navigation; `list.ts`'s `highlightAndFocus` (scroll+focus on return-from-detail) is the closest partial precedent but solves a different problem (return-navigation highlight, not persistent jump-nav). Build fresh per 18-UI-SPEC § 1's explicit spec. |
| Real ARIA `tablist`/`tab`/`tabpanel` with roving tabindex (`trends.ts` § 7) | component (nav) | event-driven | Every existing multi-option control in this codebase (`x-axis toggle`, `granularity segmented control`) uses `role="group"`/`aria-pressed`, which 18-UI-SPEC explicitly says is the WRONG pattern for 5 mutually-exclusive tabs. No tablist precedent exists yet — implement per the WAI-ARIA APG pattern named in 18-UI-SPEC § 7, hand-wired, no library. |
| CTL/ATL continuous daily-spine walk (`compute-training-load.ts`) | service (build) | batch | No existing compute step walks a continuous calendar-day spine (all existing steps are activity-indexed or manifest-indexed). `date-utils.ts`'s `getWeekStart`/`getMonthStart`/`getYearStart` are the closest partial precedent (UTC-safe date arithmetic) but nothing in the codebase decays a running value across every calendar day including days with zero activities — this is genuinely new logic, matching RESEARCH's own Pitfall 3 finding. |

## Metadata

**Analog search scope:** `src/dashboard/views/`, `src/dashboard/data/`, `src/analytics/`, `src/index.ts`, `scripts/build-widgets.mjs`, `scripts/verify-dashboard-publish.mjs`
**Files scanned:** ~40 (all `src/dashboard/**/*.ts` and `src/analytics/*.ts` non-test files, plus the three named scripts)
**Pattern extraction date:** 2026-08-11
