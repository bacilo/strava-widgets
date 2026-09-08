# Phase 23: Trends Zoom, Pan & Taller Bands - Pattern Map

**Mapped:** 2026-08-19
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/dashboard/views/trends-zoom-logic.ts` | utility (pure logic) | transform | `src/dashboard/views/trends-training-load-logic.ts` | exact |
| `src/dashboard/views/trends-zoom-logic.test.ts` | test | — | `src/dashboard/views/trends-training-load-logic.test.ts` / `trends-volume-logic.test.ts` | exact |
| `src/dashboard/views/trends.ts` | view/controller (DOM wiring, within-tab state) | request-response (event-driven within-tab) | itself (existing `volumeGranularity`/`loadWindow`/`trimpModel` state + `renderVolumeTab`/`renderTrainingLoadTab`/`renderCadenceHrTab`) | exact (same file, extend existing pattern) |
| `src/dashboard/views/trends-charts.ts` | component (Chart.js mount functions) | event-driven (chart lifecycle) | itself (`mountVolumeChart`, `buildChannelBand`/`mountChannelBands`, `mountTrainingLoadChart`, `createThinCoverageShadingPlugin`) | exact (same file, extend existing pattern) |
| `src/dashboard/styles.css` | config (CSS rules) | — | `.chart-band__canvas-wrap` / `.pr-evolution-card__canvas-wrap` (the two existing height + 380px-breakpoint pairs) | exact |
| `src/dashboard/styles.test.ts` | test (structural CSS scanner) | — | `IN-06/GC-7` media-query-count test, `WR-03` assert-by-value tests | exact |
| Button/control markup (inside `trends.ts` and/or `trends-charts.ts`) | component (DOM-building) | request-response | `detail-charts.ts`'s `buildBand` (`.chart-band__header` + `.overlay-picker` checkbox cluster), and `trends.ts`'s `.segmented` group builders (volume granularity, TRIMP model, load window) | exact |

## Pattern Assignments

### `src/dashboard/views/trends-zoom-logic.ts` (new — pure, DOM-free logic)

**Analog:** `src/dashboard/views/trends-training-load-logic.ts` (312 lines) and `src/dashboard/views/trends-volume-logic.ts` (246 lines) — both are the established `*-logic.ts` split: total, DOM-free, never construct `new Date()` internally (caller injects `now`), export named pure functions plus their types, tolerant parsing that never throws.

**Header-comment convention** (`trends-training-load-logic.ts:1-13`):
```typescript
/**
 * Pure, DOM-free logic behind the Trends page's Training Load tab
 * (TREND-04, D-13/D-14/D-15/D-16). Parses the published
 * `data/stats/training-load.json` document ... scopes it to a displayed
 * window without ever discarding from the underlying full-archive series,
 * selects the active TRIMP model's series, and detects thin-HR-coverage
 * spans for the honesty shading.
 *
 * `now` is always injected by the caller, never constructed fresh inside
 * this module — the same `calendar-logic.ts` discipline.
 */
```
`trends-zoom-logic.ts` must open with the same shape: what it is pure logic *for* (D-06 default window, D-09 limits, D-12 zoom/pan math, D-13 label formatting, D-22 restore-or-default state shape), and an explicit "no DOM, no fresh clock reads" declaration if any function needs "now" (the default-window computation likely does, for an open-ended "last 12 months").

**Export shape convention — allow-list parse function** (`trends-training-load-logic.ts:162-168`, mirrored by `trends-volume-logic.ts:26-31`):
```typescript
export type LoadWindow = '3mo' | '12mo' | 'all';
export const TRAINING_LOAD_WINDOWS: readonly LoadWindow[] = ['3mo', '12mo', 'all'];
export const DEFAULT_LOAD_WINDOW: LoadWindow = '12mo';

/** Allow-list, default `'12mo'`. */
export function parseLoadWindow(raw: string | null): LoadWindow {
  if (raw !== null && (TRAINING_LOAD_WINDOWS as readonly string[]).includes(raw)) {
    return raw as LoadWindow;
  }
  return DEFAULT_LOAD_WINDOW;
}
```
If D-22's restore-or-default zoom state is ever made URL-shareable (not required by any locked decision — RESEARCH.md's Security section explicitly flags this as the one boundary worth naming if it happens), this exact allow-list-then-clamp shape is what to copy — never trust a raw numeric range from a URL without clamping through the same bounds the UI enforces.

**Core pure-transform pattern — window/slice computation over injected `now`** (`trends-training-load-logic.ts:170-196`):
```typescript
const WINDOW_DAYS: Readonly<Record<Exclude<LoadWindow, 'all'>, number>> = {
  '3mo': 90,
  '12mo': 365,
};

/**
 * Returns the trailing 90 days, 365 days, or everything, relative to `now`.
 * The underlying series always covers the full archive (D-16); only the
 * DISPLAYED window is scoped here, so this function never mutates or
 * discards from the source array — it returns a new array (a slice/filter),
 * leaving `days` itself untouched.
 */
export function sliceLoadWindow(
  days: readonly DailyLoadEntry[],
  window: LoadWindow,
  now: Date
): DailyLoadEntry[] {
  if (window === 'all') return [...days];
  const windowDays = WINDOW_DAYS[window];
  const cutoffMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return days.filter((d) => {
    const ms = Date.parse(`${d.date}T00:00:00Z`);
    return Number.isFinite(ms) && ms >= cutoffMs;
  });
}
```
This is the direct analog for `computeDefaultWindow(granularity, archiveStartMs, archiveEndMs, now)` (D-06) — same "returns bounds, never mutates the source" discipline, generalized from a *slice* to a *scale-bounds pair* per D-06's "expressed as zoom state, never a dataset slice" requirement. Note the exact epoch-ms parsing idiom (`Date.parse(...)`, finiteness-guarded) to reuse for any date-string boundary math in `trends-zoom-logic.ts`.

**Tolerant, own-property, never-throwing parse pattern** (`trends-training-load-logic.ts:21-32`, `48-61`) — reuse only if `trends-zoom-logic.ts` ever parses a raw JSON shape (unlikely; its inputs are more likely to be already-typed `VolumePoint[]`/`LoadPoint[]` arrays from the sibling `*-logic.ts` modules, not raw fetch payloads):
```typescript
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
```

**Pure math functions — model D-12's zoom-factor/pan-fraction and D-13's label formatting as ordinary total functions**, following the style of `trends-volume-logic.ts`'s `toDerivedLabel`/`buildSeriesForGranularity`: small, single-purpose, no side effects, explicit input types, no internal `Date.now()`.

**Suggested shape for `trends-zoom-logic.ts`'s own exports** (not copied from an existing file verbatim — synthesized from CONTEXT.md/RESEARCH.md's own D-06/D-09/D-12/D-13/D-22 language plus this codebase's established `*-logic.ts` conventions):
```typescript
export type ZoomableTab = 'volume' | 'cadence-hr' | 'training-load';

export interface ZoomRange { min: number; max: number; }

export function computeDefaultWindow(
  granularity: VolumeGranularity, // or a wider param set per-tab, per planning
  archiveStartMs: number,
  archiveEndMs: number
): ZoomRange { /* D-06 */ }

export function computeLimits(
  archiveStartMs: number,
  archiveEndMs: number,
  minSpanMs: number
): { min: number; max: number; minRange: number } { /* D-09, Pitfall 1 — literal numbers, never 'original' */ }

export function panDeltaPx(chartAreaWidthPx: number, fraction: number): number { /* D-12, Pitfall 5 */ }

export function formatRangeLabel(prefix: string, minMs: number, maxMs: number): string { /* D-13 */ }

export function restoreOrDefault(saved: ZoomRange | null, fallback: ZoomRange): ZoomRange { /* D-22 */ }
```

---

### `src/dashboard/views/trends-zoom-logic.test.ts` (new)

**Analog:** `src/dashboard/views/trends-volume-logic.test.ts` (import style, fixture style) and `src/dashboard/views/trends-training-load-logic.test.ts` (describe/it structure for a `*-logic.ts` module with pure date-window math).

**Import + fixture convention** (`trends-volume-logic.test.ts:1-47`):
```typescript
import { describe, expect, it } from 'vitest';

import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import {
  buildVolumeSeries,
  buildYearGrid,
  listActivityYears,
  yearGridSummary,
} from './trends-volume-logic.js';

const weeklyFixture = [
  { weekStartISO: '2026-01-05T00:00:00.000Z', totalKm: 10.5, runCount: 2, /* ... */ },
  { weekStartISO: '2026-01-12T00:00:00.000Z', totalKm: 20.2, runCount: 3, /* ... */ },
];

describe('buildVolumeSeries — live field shapes', () => {
  it('weekly reads weekStartISO', () => {
    const series = buildVolumeSeries(weeklyFixture, null, null, 'weekly');
    expect(series).toHaveLength(2);
    expect(series[0].x).toBe(Date.parse('2026-01-05T00:00:00.000Z'));
  });
});
```
Note the `.js` extension on relative imports (ESM/NodeNext convention, used everywhere in this codebase) and the `describe` block grouped by *behavioural claim* ("live field shapes", "null/malformed inputs return [] without throwing", "sorted ascending even when shuffled") rather than by function name — `trends-zoom-logic.test.ts` should group by the same kind of claim: "computeDefaultWindow — matches D-06 shape per granularity", "computeLimits — Pitfall 1 literal-numbers discipline", "panDeltaPx — Pitfall 5 sign convention", "restoreOrDefault — D-22 restore-vs-default".

**"never throws on malformed input" idiom** (`trends-volume-logic.test.ts:72-89`):
```typescript
describe('buildVolumeSeries — null/malformed inputs return [] without throwing', () => {
  it('null weekly returns []', () => {
    expect(() => buildVolumeSeries(null, monthlyFixture, yearlyFixture, 'weekly')).not.toThrow();
    expect(buildVolumeSeries(null, monthlyFixture, yearlyFixture, 'weekly')).toEqual([]);
  });
});
```

**Quick-run command convention** (RESEARCH.md's own Validation Architecture table, already computed): `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts`.

---

### `src/dashboard/views/trends.ts` (modified — within-tab state, tab lifecycle)

**Analog:** the file's own existing within-tab-state block and tab-switch machinery — this is the file the planner extends, not a different file to imitate.

**Within-tab state declaration convention** (`trends.ts:429-452`):
```typescript
  // Volume tab's own within-tab state (18-UI-SPEC § 8) — survives a
  // granularity/year change (destroy-and-rebuild the chart only), but not a
  // full page remount (reset on unmount()).
  let volumeGranularity: VolumeGranularity = 'weekly';
  let volumeYear: number | null = null;

  // Year-over-Year tab's own within-tab state (18-UI-SPEC § 9) — the set of
  // selected years, defaulted to the 3 most recent on first activation.
  let yoySelectedYears: number[] = [];

  // Training Load tab's own within-tab state (18-UI-SPEC § 11) — the parsed
  // document (this tab's own fetch, not part of the shared TrendsRawData),
  // the TRIMP model toggle (D-14, default Edwards), and the display window
  // (D-16, default 12mo — the underlying series always covers the full
  // archive; only the DISPLAYED window is scoped).
  let trainingLoadDoc: TrainingLoadDocument | null = null;
  let trimpModel: TrimpModel = 'edwards';
  let loadWindow: LoadWindow = DEFAULT_LOAD_WINDOW;

  // Gear tab's own within-tab state (18-UI-SPEC § 12) — the active sort
  // column/direction; re-sorting rebuilds nothing on the canvas (the chart
  // is unaffected by table sort order).
  let gearSort: GearSortKey = 'distanceM';
  let gearSortDir: 'asc' | 'desc' = 'desc';
```
D-22's new zoom state slots one comment block further, in exactly this shape — e.g. `let volumeZoomRange: ZoomRange | null = null;` (and analogous slots for Cadence & HR's synced pair and Training Load, since D-02 means one range serves both Cadence/HR charts, and D-03 means Training Load's `loadWindow` becomes a *preset selector over* the zoom range rather than a separate mechanism — the comment block must say this explicitly, mirroring how the existing Training Load comment already explains "only the DISPLAYED window is scoped").

**`destroyActiveChart` — the seam every rebuild goes through** (`trends.ts:454-457`):
```typescript
  function destroyActiveChart(): void {
    activeChartHandle?.destroy();
    activeChartHandle = null;
  }
```
Both D-22's save-before-destroy (read the live chart's current x min/max into the closure variable immediately before this is called) and D-23's granularity-change reset must hook in around this call site, exactly where `mountChartForGranularity` (`trends.ts:605-610`) and `rebuildChart` (`trends.ts:921-942`) already call it.

**Mount/rebuild-on-control-change idiom — Volume granularity** (`trends.ts:605-633`):
```typescript
    function mountChartForGranularity(): void {
      if (!data) return;
      destroyActiveChart();
      const points = buildVolumeSeries(data.weekly, data.monthly, data.yearly, volumeGranularity);
      activeChartHandle = chartsModule.mountVolumeChart(canvas, points, volumeGranularity);
    }

    VOLUME_GRANULARITIES.forEach((granularity) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = GRANULARITY_LABELS[granularity];
      const isActive = granularity === volumeGranularity;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.className = isActive ? 'segmented__option segmented__option--active' : 'segmented__option';
      btn.addEventListener('click', () => {
        if (volumeGranularity === granularity) return;
        volumeGranularity = granularity;
        /* ...repaint every button's active state... */
        mountChartForGranularity();
      });
      controls.appendChild(btn);
      granularityButtons[granularity] = btn;
    });
```
This "no-op guard, mutate closure state, repaint sibling controls, destroy-and-remount" idiom is exactly what D-23 needs for "granularity change resets to the new default window": inside this same click handler, after `volumeGranularity = granularity;`, also clear/reset the saved zoom-range closure variable *before* calling `mountChartForGranularity()`, so the rebuilt chart reads `null` and falls back to `computeDefaultWindow`.

**Mount/rebuild idiom — Training Load's window control (the D-03 repurposing target)** (`trends.ts:881-895`, `921-942`):
```typescript
    TRAINING_LOAD_WINDOWS.forEach((w) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = WINDOW_LABELS[w];
      btn.addEventListener('click', () => {
        if (loadWindow === w) return;
        loadWindow = w;
        updateWindowButtons();
        rebuildChart();
      });
      windowGroup.appendChild(btn);
      windowButtons[w] = btn;
    });
    ...
    function rebuildChart(): void {
      destroyActiveChart();
      const windowedDays = sliceLoadWindow(doc.days, loadWindow, new Date());
      const points = selectModelSeries(windowedDays, trimpModel);
      const spans = findThinCoverageSpans(windowedDays);
      /* ...empty-state guard... */
      activeChartHandle = chartsModule.mountTrainingLoadChart(canvas, points, spans);
      caption.textContent = coverageCaption(spans);
    }
```
D-03 changes what happens *inside* this click handler and `rebuildChart`: `loadWindow` becomes a **preset selector that computes a zoom range** (via the new `computeDefaultWindow`-style helper, not `sliceLoadWindow`) rather than a value handed to `sliceLoadWindow` to filter `doc.days`. `mountTrainingLoadChart` must be called with the FULL `doc.days` series every time (mapped through `selectModelSeries`/`findThinCoverageSpans` unfiltered), and the window preset instead sets the new chart's `scales.x.min/max` (or calls `chart.zoom`/pans to that range post-mount). Whether `sliceLoadWindow` itself survives as a pure helper or is retired is Claude's Discretion (CONTEXT.md); either way this call site is where the wiring changes, and the existing `windowButtons`/`updateWindowButtons` DOM-update idiom is unaffected — only what the click handler *does* with `loadWindow` changes.

**`switchTab` — the destroy/rebuild seam D-22's restore hangs off** (`trends.ts:1075-1101`):
```typescript
  function switchTab(tab: TrendTabKey, focusButton: boolean): void {
    if (tab === activeTab) {
      if (focusButton) tabButtons[tab]?.focus();
      return;
    }
    const previousButton = tabButtons[activeTab];
    const previousPanel = tabPanels[activeTab];
    if (previousButton) applyTabButtonState(previousButton, false);
    if (previousPanel) previousPanel.hidden = true;

    destroyActiveChart();

    activeTab = tab;
    /* ...activate next button/panel... */
    updateTabUrl(tab);

    const myToken = ++requestToken;
    void renderActiveTabContent(tab, myToken);
  }
```
No new pattern needed here — `destroyActiveChart()` already runs on every tab switch, and each `render*Tab` function already re-reads its own within-tab state (`volumeGranularity`, `loadWindow`, etc.) when it rebuilds. The zoom-range closure variables need the SAME "read on rebuild" treatment: `renderVolumeTab`/`renderCadenceHrTab`/`renderTrainingLoadTab` must pass the saved range (or `null`) into their `mount*Chart` call, exactly as `renderVolumeTab` already passes `volumeGranularity` into `mountChartForGranularity`.

**`unmount()` — confirmed behavior, a discrepancy from CONTEXT.md worth flagging to the planner** (`trends.ts:1227-1235`):
```typescript
    unmount(): void {
      requestToken++; // invalidate any in-flight request or tab render
      destroyActiveChart();
      mountedContainer?.replaceChildren();
      mountedContainer = null;
      data = null;
      tabButtons = {};
      tabPanels = {};
    },
```
**Verified discrepancy:** `createTrendsView(...)` is called exactly once at app startup (`view-registry.ts:37`), so all the `let` state declared in the factory's closure (`volumeGranularity`, `volumeYear`, `yoySelectedYears`, `trimpModel`, `loadWindow`, `gearSort`, etc.) is **NOT actually reset by `unmount()` today** — it is never reassigned there. `unmount()` resets `data`, `mountedContainer`, `tabButtons`, `tabPanels`, and invalidates `requestToken`, but the six named within-tab state variables persist in memory across a full unmount/remount cycle (e.g. navigate to `#/trends`, away, and back — `volumeGranularity` still reads whatever it was left at). CONTEXT.md's D-22 text ("resets on unmount... `unmount()` at `trends.ts:1228` resets everything") does not match what the code at that line actually does. This is not necessarily a defect to fix in this phase — planning should decide explicitly whether the new zoom-range state (a) follows the existing (arguably already slightly-wrong) behavior of simply not being touched by `unmount()`, or (b) is the first within-tab state to add an explicit reset inside `unmount()`, which would be new code, not a copy of an existing pattern. Either way, write down which one is chosen — do not assume `unmount()` already does this for the other six variables, because it does not.

---

### `src/dashboard/views/trends-charts.ts` (modified — chart construction, per-instance plugins)

**Analog:** the module's own `createThinCoverageShadingPlugin` + its `plugins: [shadingPlugin]` usage in `mountTrainingLoadChart` — this is the exact, already-proven per-instance-plugin idiom D-05 requires for `chartjs-plugin-zoom`.

**The module-wide `Chart.register(...)` call D-05 must NOT join** (`trends-charts.ts:46-68`):
```typescript
// ---------------------------------------------------------------------------
// Registration — Bar* powers both this plan's Volume and Year-over-Year
// charts; Line*/CategoryScale/Filler power the Cadence & HR bands and the
// Training Load area/lines; Decimation caps the Training Load chart's drawn
// points (its series can carry 5,000+ days), mirroring detail-charts.ts's
// DECIMATION_CONFIG. ONE registration call for this module — the
// thin-coverage shading plugin below is deliberately NOT registered here; it
// is passed via each Training Load chart instance's own `plugins:` array
// instead (T-18-CANVAS-01/the same local-plugin idiom `detail-charts.ts`'s
// crosshair plugin already uses).
// ---------------------------------------------------------------------------
Chart.register(
  BarController, BarElement, LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Tooltip, Filler, Decimation
);
```
`chartjs-plugin-zoom`'s default export must never appear in this list — this is the literal line D-05's "never added to `Chart.register(...)`" instruction refers to, and the comment immediately above it already states the precedent (`T-18-CANVAS-01`) the new plugin follows.

**Per-instance plugin idiom to copy exactly** (`trends-charts.ts:466-494`, `521-522`, `560`):
```typescript
export function createThinCoverageShadingPlugin(getSpans: () => CoverageSpan[], color: string): Plugin<'line'> {
  return {
    id: 'trainingLoadCoverageShading',
    afterDraw(chart) {
      const spans = getSpans();
      if (spans.length === 0) return;
      const xScale = chart.scales.x;
      if (!xScale) return;
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = color;
      for (const span of spans) {
        const startPixel = xScale.getPixelForValue(span.startX);
        const endPixel = xScale.getPixelForValue(span.endX);
        if (!Number.isFinite(startPixel) || !Number.isFinite(endPixel)) continue;
        const left = Math.min(startPixel, endPixel);
        const width = Math.max(1, Math.abs(endPixel - startPixel));
        ctx.fillRect(left, top, width, bottom - top);
      }
      ctx.restore();
    },
  };
}
...
  const shadingPlugin = createThinCoverageShadingPlugin(() => [...spans], shadingColor);
  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets: [ /* ... */ ] },
    plugins: [shadingPlugin],   // <-- per-instance, NOT Chart.register
    options: { /* ... */ },
  });
```
The zoom plugin's `plugins: [zoomPlugin]` (or `plugins: [zoomPlugin, shadingPlugin]` on the Training Load chart specifically, since it already carries the shading plugin this way) goes in this exact array position on `mountVolumeChart`, `buildChannelBand` (both calls, since D-02 needs the pair wired together), and `mountTrainingLoadChart` only — never on `mountYoyChart` or `mountGearChart` (D-01's structural exclusion).

**`VOLUME_ARIA_LABELS` — the label-swap mechanism D-13 extends** (`trends-charts.ts:82-86`, `113`):
```typescript
const VOLUME_ARIA_LABELS: Record<VolumeGranularity, string> = {
  weekly: 'Weekly distance chart',
  monthly: 'Monthly distance chart',
  yearly: 'Yearly distance chart',
};
...
  canvas.setAttribute('aria-label', VOLUME_ARIA_LABELS[granularity]);
```
D-13 wants the label rewritten on every zoom/pan settle to *also* name the visible range (e.g. "Weekly distance chart, Sep 2025 to Aug 2026"). The mechanism to copy is the `canvas.setAttribute('aria-label', ...)` call itself — D-13's `onSettle(chart)` function (see RESEARCH.md's Code Examples) should build on this exact call, e.g. `canvas.setAttribute('aria-label', `${VOLUME_ARIA_LABELS[granularity]}, ${formatRangeLabel(...)}`)`, re-invoked on every settle rather than only at mount time as today.

**Chart construction shape (bar/line, `'linear'` x scale, gutter pin, tooltip)** — see `mountVolumeChart` (`trends-charts.ts:105-173`) and `buildChannelBand` (`trends-charts.ts:328-415`) in full; both share the `type`, `parsing: false`, `scales.x.type: 'linear'` + `ticks.callback`, `scales.y.afterFit` gutter-pin, and `plugins.tooltip.callbacks.label` shape that any new `options.plugins.zoom: {...}` block is added alongside, not in place of.

**`ChartHandle`/idempotent-destroy convention**, reused unchanged by every mount function including the zoomable ones (`trends-charts.ts:165-173`, `436-446`, `596-604`):
```typescript
  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      chart.destroy();
    },
  };
```
Per RESEARCH.md Pattern 1 (verified against Chart.js core source), `chart.destroy()` alone is sufficient teardown for `chartjs-plugin-zoom` + Hammer — no new code needed in this block.

**IMPORTANT — `.chart-band` markup gap, verified by direct read, not assumed from CONTEXT.md:**
Only `buildChannelBand` (Cadence & HR, `trends-charts.ts:334-353`) constructs `.chart-band` / `.chart-band__header` / `.chart-band__canvas-wrap` markup today. `mountVolumeChart` takes a bare `<canvas>` with no wrapper at all — the `.chart-band` wrapper, header, and `.chart-band__canvas-wrap` div are built in `trends.ts`'s `renderVolumeTab`/`renderTrainingLoadTab`, and **as currently written those callers do NOT apply any of the three classes**:
```typescript
// trends.ts:601-603 (Volume tab) — no className set on canvasWrap:
    const canvasWrap = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);

// trends.ts:899-901 (Training Load tab) — identical, no className:
    const canvasWrap = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);
```
This means, TODAY, Volume and Training Load charts render with **no `.chart-band__canvas-wrap` height rule applied at all** — only Cadence & HR (via `buildChannelBand`) and the activity-detail view (via `detail-charts.ts`'s `buildBand`, see below) get the existing 140px/380px-breakpoint styling. **This is a real, load-bearing gap the planner must resolve, not an oversight in this scan**: D-10 ("the control cluster lives in each `.chart-band__header`") and D-18/D-19 (the tall-band modifier class) only have somewhere to attach on Volume and Training Load if those two tabs' `canvasWrap` divs are given the `.chart-band` / `.chart-band__header` / `.chart-band__canvas-wrap` classes for the first time in this phase — most naturally by extracting the wrapper-building portion of `buildChannelBand` (`trends-charts.ts:334-353`) into a small shared helper (e.g. `buildChartBandWrapper(container, headingText, ariaLabel): { header: HTMLElement; canvas: HTMLCanvasElement }`) that `mountVolumeChart`/`mountTrainingLoadChart` and `renderVolumeTab`/`renderTrainingLoadTab` all call, rather than three call sites independently deciding whether to add the classes.

---

### `src/dashboard/styles.css` (modified — tall-band modifier, control cluster, media query count)

**Analog:** the existing `.chart-band__canvas-wrap` rule + its 380px override, and the sibling `.pr-evolution-card__canvas-wrap` pair — the two existing instances of exactly the "fixed height + phone-width override" shape D-19/D-21 need a third instance of.

**The rule to extend, byte-for-byte** (`styles.css:999-1021`):
```css
.chart-band {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-md);
}

.chart-band__canvas-wrap {
  position: relative;
  height: 140px;
}

@media (max-width: 380px) {
  .chart-band__canvas-wrap {
    height: 112px;
  }
}

.chart-band__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```
D-18's new rule is a **sibling** class, never an edit to `.chart-band__canvas-wrap` itself (that rule and its 380px override must stay byte-unchanged so the activity-detail view is untouched):
```css
.chart-band__canvas-wrap--tall {
  height: clamp(180px, 34vh, 420px); /* exact numbers: Claude's Discretion, tuned live */
}
```
D-21's phone-width floor for `--tall` needs its OWN breakpoint choice, explicitly justified (Pitfall 7 in RESEARCH.md) — reusing `max-width: 380px` verbatim would silently become a THIRD `@media (max-width: 380px)` block and break the `IN-06/GC-7` count test below. Either pick a different, justified breakpoint, or update the count test and the `styles.css:882-884` comment in the same change (never one without the other).

**The § comment this decision must keep in sync** (`styles.css:882-884`):
```css
   `styles.css` now has exactly TWO `@media (max-width: 380px)` blocks
   (`.chart-band__canvas-wrap`, `.pr-evolution-card__canvas-wrap`) —
   neither is calendar-related. */
```

**`.chart-band__header`'s existing flex/space-between shape — the D-10 control cluster's second flex child, no new layout CSS needed** (`styles.css:1017-1021`, already quoted above) — confirmed empty of any other rule; the cluster can be appended as a second `<div>` child with zero CSS changes to this rule itself.

**`.segmented` — the existing button-group visual vocabulary the D-11 cluster may reuse** (`styles.css:1038-1051`, `1082-1093`):
```css
.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}

.segmented__option {
  background: var(--surface);
  color: var(--text-secondary);
  border: none;
  border-radius: 0;
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}
.segmented__option:first-child { border-radius: var(--radius-control) 0 0 var(--radius-control); }
.segmented__option:last-child { border-radius: 0 var(--radius-control) var(--radius-control) 0; }
.segmented__option--active { background: var(--accent-strong); color: #ffffff; }
```
Whether the five zoom controls read as a `.segmented` group or as loose `<button>`s is Claude's Discretion (CONTEXT.md); either way they need NO new visual vocabulary — the shared button baseline below already covers hover/disabled/focus for any bare `<button>`.

---

### `src/dashboard/styles.test.ts` (modified — new structural assertions)

**Analog:** the `IN-06/GC-7` media-query-count test and the `WR-03` assert-by-value precedent, both already in this file.

**`IN-06/GC-7` — the exact test that goes red if D-21's breakpoint collides** (`styles.test.ts:1928-1949`):
```typescript
  it('IN-06/GC-7: this stylesheet carries exactly two disjoint @media (max-width: 380px) blocks, neither calendar-related', () => {
    const preludes = [...cssNoComments.matchAll(/@media \(max-width: 380px\)\s*\{/g)];
    expect(preludes).toHaveLength(2);
    for (const m of preludes) {
      let i = m.index! + m[0].length;
      let depth = 1;
      while (depth > 0 && i < cssNoComments.length) {
        if (cssNoComments[i] === '{') depth++;
        else if (cssNoComments[i] === '}') depth--;
        i++;
      }
      const body = cssNoComments.slice(m.index! + m[0].length, i - 1);
      expect(body).not.toContain('.calendar-');
    }
  });
```
If D-21 reuses 380px, this literal expects `toHaveLength(2)` to `toHaveLength(3)` **and** the comment quoted above must gain a third named rule — both edits, same commit.

**`WR-03` assert-by-value precedent — read the exact VALUE, not just that an override exists** (`styles.test.ts:2029-2040`):
```typescript
  it('WR-03: the <=640px day-cell compaction is asserted by VALUE', () => {
    expect(atRuleBodiesFor('.calendar-day', 'min-width')[0]).toContain('min-width: 0');
    expect(atRuleBodiesFor('.calendar-day__distance', 'font-size')[0]).toContain('font-size: 14px');
  });
```
This is the exact discipline the new `.chart-band__canvas-wrap--tall` height rule's test case must follow — e.g. `expect(bodyForSelectorListToken('.chart-band__canvas-wrap--tall')).toContain('clamp(...)')`, not merely `expect(css).toContain('.chart-band__canvas-wrap--tall')`. The file's helper functions to reuse (already defined near the top of `styles.test.ts`, confirmed present): `bodyForSelectorListToken`, `atRuleBodiesFor`, `assertNoAtRuleOverride`, operating on the module-level `cssNoComments` string built via `readFileSync(new URL('./styles.css', import.meta.url), 'utf8')` (`styles.test.ts:14, 31`).

---

### Button/control markup — the D-11 `←` `→` `−` `+` + Reset cluster

**Analog:** `detail-charts.ts`'s `buildBand` (the `.chart-band__header` + right-hand `.overlay-picker` control cluster, the closest existing "title + interactive controls in one header" precedent) and `trends.ts`'s three existing `.segmented` group builders (Volume granularity, TRIMP model, Training Load window).

**The exact "real `<button type="button">`, no invented DOM idiom" convention** (`trends.ts:612-633`, reused identically at `815-824`, `881-893`):
```typescript
    VOLUME_GRANULARITIES.forEach((granularity) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = GRANULARITY_LABELS[granularity];
      const isActive = granularity === volumeGranularity;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.className = isActive ? 'segmented__option segmented__option--active' : 'segmented__option';
      btn.addEventListener('click', () => { /* mutate closure state, repaint, rebuild */ });
      controls.appendChild(btn);
    });
```
Every one of D-11's five buttons is `document.createElement('button')` + `btn.type = 'button'` + a plain `addEventListener('click', ...)` — this codebase has zero precedent for any other control-construction idiom (no JSX, no template literals for interactive elements, no framework). `aria-pressed` is specific to *toggle* buttons (segmented options); D-11's zoom/pan buttons are *action* buttons, not toggles, so they should NOT carry `aria-pressed` — instead they need `aria-label` (e.g. "Zoom in", "Pan to earlier dates") since their visible glyphs (`←ᅟ→ᅟ−ᅟ+`) are not self-describing text content, and `.disabled`/`hidden` per D-11's clamp/Reset-visibility rules, using the plain DOM properties (`btn.disabled = true`), which is exactly how `banisterBtn.disabled = banisterUnavailable;` (`trends.ts:824`) already does it elsewhere in this file.

**The `.chart-band__header` "title + right-hand interactive cluster" shape to copy structurally** (`detail-charts.ts:353-398`):
```typescript
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-band';

    const header = document.createElement('div');
    header.className = 'chart-band__header';

    const channelLabelEl = document.createElement('span');
    channelLabelEl.className = 'text-label';
    channelLabelEl.textContent = CHANNEL_META[channel].label;
    header.appendChild(channelLabelEl);

    const picker = document.createElement('div');
    picker.className = 'overlay-picker';
    /* ...interactive controls built and appended to picker... */
    header.appendChild(picker);
    wrapper.appendChild(header);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'chart-band__canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', CHANNEL_META[channel].ariaLabel);
    canvasWrap.appendChild(canvas);
    wrapper.appendChild(canvasWrap);
```
This is the load-bearing structural precedent for D-10: a `.chart-band__header` with a text label on the left and a `<div>` of interactive controls on the right, both appended as flex children with no extra layout CSS (the header rule is already `display: flex; justify-content: space-between`). D-11's cluster (and D-17's hint text) should be built the same way — a dedicated wrapper `<div>` (e.g. `.chart-zoom-controls`, new class, or reusing `.overlay-picker`'s flex-row shape if visually appropriate) appended as `header`'s second child, exactly where `picker` is appended above.

## Shared Patterns

### Real `<button type="button">` for every interactive control, never a `<div>`/`<span>` with a click handler
**Source:** `trends.ts:613-614`, `815-816`, `883-884`; `detail-charts.ts`'s checkbox-based picker uses real `<input type="checkbox">` + `<label>` for the same reason.
**Apply to:** every one of D-11's five zoom/pan/reset controls — this is how TRN-02's "works with no pointing device at all" requirement is satisfied for free (native keyboard operability), and it is the only interactive-element idiom this codebase has ever used.

### Phase 19 button baseline — shared hover, `:disabled`/`[aria-disabled]`, two-tone focus ring
**Source:** `styles.css:1496-1600` (button baseline, disabled treatment) and `styles.css:456-459` (focus ring — quoted below).
**Apply to:** all five new zoom/pan/reset buttons; no opt-in work needed, only correct use of the native `disabled` property / `aria-disabled="true"` attribute at the D-09 clamps.
```css
button {
  font: inherit;
  min-height: 32px;
  cursor: pointer;
  border-radius: var(--radius-control);
}

button:where(:not(
      :disabled,
      [aria-disabled="true"],
      .pagination__button--current,
      .segmented__option--active,
      .calendar-day--tint-1, .calendar-day--tint-2, .calendar-day--tint-3, .calendar-day--tint-4
    )):hover {
  background: color-mix(in srgb, var(--surface) 92%, var(--text));
}

:disabled,
[aria-disabled="true"] {
  color: var(--text-secondary);
  opacity: 0.6;
  cursor: default;
}

:disabled:focus-visible,
[aria-disabled="true"]:focus-visible {
  opacity: 1;
}
```
```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
  position: relative;
  /* z-index: 1 below — see styles.css GAP 2 comment for why */
}
```
Use the plain `<button>` element with no extra class for the disabled treatment to apply automatically — `banisterBtn.disabled = banisterUnavailable;` (`trends.ts:824`) is the one-line precedent for "disable at a clamp": D-11's `←`/`→` buttons at the pan bounds and `−` at full zoom-out should set `.disabled = true` the same way, inside the shared `onSettle(chart)` function RESEARCH.md's Code Examples section already specifies.

### Query-string parse-and-clamp allow-list idiom
**Source:** `trends-training-load-logic.ts:162-168` (`parseLoadWindow`), `trends-volume-logic.ts:25-31` (`parseVolumeGranularity`), and `trends-logic.ts`'s `parseTrendTab` (not re-read in full this session, but the same shape per CONTEXT.md's own description).
**Apply to:** any URL-driven zoom state, if planning chooses to add one (not required by any locked decision; D-24 explicitly declines persistence, and no decision asks for URL-encoded zoom state). If added, this exact "check membership in a `readonly` allow-list array, fall back to a named default" shape is mandatory — never trust a raw numeric range from a URL without clamping it through the same `limits` bounds the D-09 UI itself enforces.
```typescript
export function parseVolumeGranularity(raw: string | null): VolumeGranularity {
  if (raw !== null && (VOLUME_GRANULARITIES as readonly string[]).includes(raw)) {
    return raw as VolumeGranularity;
  }
  return 'weekly';
}
```

### Lazy-chunk boundary — `trends-charts.ts`'s static `chart.js` import is the chunk boundary; `trends.ts` never imports it statically
**Source:** `trends-charts.ts:1-22` (header comment, quoted in full):
```typescript
/**
 * ...
 * LAZY-CHUNK BOUNDARY: this module places a PLAIN TOP-LEVEL STATIC import of
 * `chart.js`. That import is exactly what makes THIS MODULE the lazy chunk
 * boundary — `trends.ts` reaches it only via
 * `await import('./trends-charts.js')`, so Vite places Chart.js inside that
 * async chunk. No other module may import `trends-charts.ts` statically —
 * `trends.ts`'s own static import graph, and every other dashboard view,
 * must never pay for Chart.js just to reach `#/trends`.
 * ...
 */
```
`trends.ts`'s own reach pattern (`trends.ts:583`, `654`, `775-776`): `const chartsModule = await import('./trends-charts.js');` inside each `render*Tab` function, always followed by the `if (myToken !== requestToken || !mountedContainer) return;` race guard.
**Apply to:** `import zoomPlugin from 'chartjs-plugin-zoom';` and `import 'hammerjs';` (or however the plugin's own import graph pulls in Hammer) MUST land as top-level static imports inside `trends-charts.ts` — never inside `trends.ts`, `chart-theme.ts`, or any module reachable from the main bundle's static import graph. Verify the actual built chunk graph after adding the dependency (e.g. `npm run build` and inspect `dist/` chunk names/sizes) rather than assuming the import placement alone guarantees the lazy split — RESEARCH.md's own Wave 0 gaps list does not include a build-graph check, so this is worth adding as an explicit plan verification step.

### `chart-theme.ts` — the shared-module precedent D-04's extraction follows
**Source:** `chart-theme.ts:1-19` (header comment):
```typescript
/**
 * Single source of chart colour resolution for every DASHBOARD VIEW
 * (`detail-charts.ts`, and Phase 18's `records-charts.ts`/`trends-charts.ts`).
 * ...
 * This module deliberately imports no charting library — it reads CSS
 * custom properties only. That keeps it importable from non-lazy code
 * without dragging Chart.js into the main bundle, which is why it lives as
 * its own file rather than an export off `detail-charts.ts` (a deliberate
 * lazy-chunk boundary per D-25 — see that file's header comment).
 */
```
**Apply to:** if planning extracts shared zoom wiring per D-04 ("Extract any shared zoom wiring into a module both surfaces could import"), the extracted module must follow this same "imports no charting library, safe to import from non-lazy code" discipline **only if** the extracted piece is genuinely DOM/Chart.js-free (e.g. pure config-object builders). If the extraction includes anything that imports `chart.js` or `chartjs-plugin-zoom` types at runtime (not just as a TypeScript `type`-only import), it must NOT be `chart-theme.ts` itself (which is reachable from non-lazy code) — a new sibling module (e.g. `chart-zoom-theme.ts`) reachable only from `trends-charts.ts`/`detail-charts.ts`'s own lazy-loaded contexts would be the correct home instead. This is exactly the discretion point CONTEXT.md leaves open ("`chart-theme.ts` vs a new sibling module").

## No Analog Found

None. Every file in this phase's scope has at least one exact-match analog already in the codebase — this phase is additive to five files whose shapes are already well-established (`*-logic.ts` pure modules, `trends.ts`'s within-tab-state/tab-lifecycle machinery, `trends-charts.ts`'s per-instance-plugin mount functions, and `styles.css`/`styles.test.ts`'s existing `.chart-band__canvas-wrap` + `@media (max-width: 380px)` pair).

The one item with NO existing precedent anywhere in this codebase, flagged in RESEARCH.md and confirmed by this scan, is **cross-platform modifier-key detection** (`navigator.userAgentData?.platform` / `navigator.platform` to pick `'meta'` vs `'ctrl'` for D-14's wheel-zoom gate) — genuinely new code, not extractable from an existing pattern. See RESEARCH.md's Code Examples section for the recommended implementation shape.

## Metadata

**Analog search scope:** `src/dashboard/views/*.ts` (all `trends-*`, `detail-charts.ts`, `chart-theme.ts`), `src/dashboard/styles.css`, `src/dashboard/styles.test.ts`, `package.json`
**Files scanned:** `trends.ts` (1237 lines, read in targeted ranges: 1-130, 400-530, 576-960, 1040-1237), `trends-charts.ts` (700 lines, read in full via two ranges: 1-220, 280-640 approx), `trends-volume-logic.ts` (246 lines, read in full), `trends-volume-logic.test.ts` (first 100 lines), `trends-training-load-logic.ts` (312 lines, read in full), `chart-theme.ts` (97 lines, read in full), `detail-charts.ts` (targeted range 330-410), `styles.css` (targeted ranges: 420-460, 870-900, 990-1035, 1038-1093, 1345-1364, 1490-1600), `styles.test.ts` (targeted ranges: 1-40, 1900-1950, 2020-2065)
**Pattern extraction date:** 2026-08-19
