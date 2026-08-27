/**
 * Chart.js mounting for the Trends page's Volume and Year-over-Year tabs
 * (D-04, TREND-02, 18-UI-SPEC § 8/§ 9).
 *
 * LAZY-CHUNK BOUNDARY: this module places a PLAIN TOP-LEVEL STATIC import of
 * `chart.js`. That import is exactly what makes THIS MODULE the lazy chunk
 * boundary — `trends.ts` reaches it only via
 * `await import('./trends-charts.js')`, so Vite places Chart.js inside that
 * async chunk. No other module may import `trends-charts.ts` statically —
 * `trends.ts`'s own static import graph, and every other dashboard view,
 * must never pay for Chart.js just to reach `#/trends`.
 *
 * Every axis with a duration/distance/percentage domain is a `'linear'` (or
 * `'category'` for the YoY month axis) Chart.js scale with a `ticks.callback`
 * — NEVER Chart.js's date-axis scale type or a calendar-adapter package
 * (18-UI-SPEC § 14's restated hard requirement; this repo has zero
 * precedent for that scale type and no adapter installed).
 *
 * This module is Chart.js configuration and DOM wiring only — it is not
 * testable under `environment: 'node'` and is verified manually in a real
 * browser (plan 18-16).
 */

import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  Decimation,
  type Plugin,
} from 'chart.js';

import { resolveToken, resolveThemeColors, hexToRgba, Y_AXIS_WIDTH_PX } from './chart-theme.js';
import type { VolumePoint, VolumeGranularity } from './trends-volume-logic.js';
import type { YoySeries } from './trends-yoy-logic.js';
import { channelLabel, type MonthlyChannel, type MonthlyPoint } from './trends-cadence-hr-logic.js';
import type { CoverageSpan, LoadPoint } from './trends-training-load-logic.js';
import type { GearChartBucket } from './trends-gear-logic.js';
import {
  chartZoomPlugin,
  buildZoomPluginOptions,
  attachZoomController,
  type ZoomController,
} from './chart-zoom.js';
import {
  type ZoomRange,
  computeArchiveBounds,
  computeDefaultWindow,
  restoreOrDefault,
  volumeScaleKey,
} from './trends-zoom-logic.js';
import { formatAdaptiveTimeTick, stepMsFromTicks } from './trends-tick-format.js';

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
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  Decimation
);

/**
 * D-22-style cap: mirrors `detail-charts.ts`'s `DECIMATION_CONFIG` exactly,
 * applied here to the Training Load chart's 5,000+ day series.
 */
const DECIMATION_CONFIG = { enabled: true, algorithm: 'lttb', samples: 500 } as const;

export interface ChartHandle {
  destroy(): void;
}

/**
 * D-22's per-mount zoom contract: the header a chart's D-10 control cluster
 * attaches to, the D-22 saved range to restore (`null` means "use the D-06
 * default"), and the settle-time write-back to the caller's own zoom-range
 * slot. `mountChannelBands` takes `Omit<ZoomMountOptions, 'header'>` because
 * it builds its own two bands and therefore owns the header the shared
 * cluster attaches to (the cadence band's header, per D-10).
 */
export interface ZoomMountOptions {
  header: HTMLElement;
  savedRange: ZoomRange | null;
  onRangeChange: (range: ZoomRange) => void;
}

/**
 * Finding 8's fix: attaches a `ResizeObserver` to `canvas.parentElement` —
 * the `.chart-band__canvas-wrap` `buildChartBand` puts every canvas inside
 * — so a narrowing viewport re-fits the chart the same way a fresh load at
 * that width already does. Chart.js's own `responsive: true` handling did
 * not act on the observed R15/Finding-8 regression (a 770 × 206 canvas
 * left inside a 370px wrapper after a 1200 → 500px narrowing, against a
 * correct 370 × 223 on a fresh load at the same width); Round 1 measured
 * that empirically but did not isolate why Chart.js 4.5.1's own internal
 * observer failed to act on it. This explicit observer is a deterministic
 * remedy regardless of that cause.
 *
 * Deliberately calls `chart.resize()` with NO arguments and ignores the
 * observer entry's `contentRect` entirely: a no-arg `resize()` makes
 * Chart.js re-measure the container itself, which is what makes this
 * robust for a chart constructed while its tab panel was hidden.
 * `chart.resize()` compares against the current size and no-ops when
 * nothing changed, so the common case is cheap.
 *
 * Cannot feed back on itself: the OBSERVED element is the wrapper, whose
 * height comes from the `.chart-band__canvas-wrap`/`--tall` CSS `clamp()`
 * and whose width comes from its block containing block — neither is
 * content-derived, so resizing the canvas inside it cannot change the
 * observed box and cannot re-trigger this callback.
 *
 * Rejected alternative: adding `overflow: hidden` to the wrapper or
 * `max-width: 100%` to the canvas would make R15's `scrollWidth` clause
 * pass while the chart stayed drawn at the wrong scale — clipping or
 * rescaling a mis-sized canvas instead of resizing it. This plan fixes the
 * size; it does not hide the symptom. No CSS is changed by this plan.
 *
 * Returns a no-op detach when `ResizeObserver` is unavailable (keeps this
 * module importable with no DOM) or when the canvas has no parent yet.
 */
function observeCanvasResize(chart: Chart, canvas: HTMLCanvasElement): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const wrap = canvas.parentElement;
  if (wrap === null) return () => {};

  const observer = new ResizeObserver(() => {
    chart.resize();
  });
  observer.observe(wrap);

  return () => {
    observer.disconnect();
  };
}

const VOLUME_ARIA_LABELS: Record<VolumeGranularity, string> = {
  weekly: 'Weekly distance chart',
  monthly: 'Monthly distance chart',
  yearly: 'Yearly distance chart',
};

/**
 * Mounts the Volume tab's single chart — a bar per period, x pinned to the
 * shared `Y_AXIS_WIDTH_PX` gutter (18-UI-SPEC § 10's alignment fix, applied
 * here too so every chart on the page starts its plot area at the same x).
 * `aria-label` changes with `granularity`; the caller is responsible for
 * destroying the previous instance before calling this again (never an
 * in-place dataset mutation — the "Canvas is already in use" defect class).
 *
 * D-05: the zoom plugin is added to THIS chart's own `plugins: [...]` array
 * only — never to the module-wide `Chart.register(...)` call above. An empty
 * series (`computeArchiveBounds` returns `null`) mounts with no zoom plugin,
 * no zoom options and no control cluster at all: a chart with no data has no
 * range to zoom.
 */
export function mountVolumeChart(
  canvas: HTMLCanvasElement,
  points: readonly VolumePoint[],
  granularity: VolumeGranularity,
  zoom: ZoomMountOptions
): ChartHandle {
  const color = resolveToken('--chart-pace', '#fc4c02');
  const themeColors = resolveThemeColors();

  canvas.setAttribute('aria-label', VOLUME_ARIA_LABELS[granularity]);

  const bounds = computeArchiveBounds(points.map((p) => p.x));

  if (bounds === null) {
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        datasets: [
          {
            label: 'Distance',
            data: points.map((point) => ({ x: point.x, y: point.km })),
            backgroundColor: color,
            borderColor: color,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        scales: {
          x: {
            type: 'linear',
            grid: { display: false },
            ticks: {
              // Finding 7 fix: the tick format now follows the axis's own
              // visible span (via each callback's own tick step) instead of
              // the `granularity` toggle, so `granularity` still selects the
              // aria-label base and the scale key below but no longer
              // selects the tick format directly. Visible consequence at
              // D-06's default weekly window (~365 days, ~8 ticks, a ~46-day
              // step): renders `Aug 2025` rather than `13 Aug 2025`; at full
              // zoom-out (~685-day step): renders `2011` rather than
              // `11 Aug 2011`. Both are the intended outcome of an
              // axis that follows the visible span, and both invalidate the
              // first/last-tick columns of `23-VALIDATION.md`'s Round 1
              // expected-value table — plan 23-11 Task 1 recomputes those
              // before Round 2 opens; the two documents must not drift apart
              // silently.
              callback: (value: number | string, _index: number, ticks: readonly { value: number }[]) =>
                formatAdaptiveTimeTick(Number(value), stepMsFromTicks(ticks)),
            },
          },
          y: {
            type: 'linear',
            // Pin every Trends chart's gutter to the same width every detail
            // band already shares — see Y_AXIS_WIDTH_PX's own doc comment.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            afterFit: (scale: any) => {
              scale.width = Y_AXIS_WIDTH_PX;
            },
            grid: { color: hexToRgba(themeColors.border, 0.4) },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: { dataIndex: number }) => {
                const point = points[context.dataIndex];
                if (!point) return '';
                return `${point.km.toFixed(1)} km, ${point.runs} run${point.runs === 1 ? '' : 's'}`;
              },
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    const detachEmpty = observeCanvasResize(chart, canvas);

    let destroyedEmpty = false;
    return {
      destroy(): void {
        if (destroyedEmpty) return;
        destroyedEmpty = true;
        detachEmpty();
        chart.destroy();
      },
    };
  }

  const scaleKey = volumeScaleKey(granularity);
  // D-06/D-22: this ONE line serves both the opening picture (no saved
  // range yet, falls through to the granularity's D-06 default window) and
  // the restore-after-rebuild (a saved range from a prior settle) — there is
  // one mechanism, not two, because both cases are "what range does this
  // chart open at".
  const initial = restoreOrDefault(zoom.savedRange, computeDefaultWindow(scaleKey, bounds));

  let controller: ZoomController | null = null;

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      datasets: [
        {
          label: 'Distance',
          data: points.map((point) => ({ x: point.x, y: point.km })),
          backgroundColor: color,
          borderColor: color,
        },
      ],
    },
    plugins: [chartZoomPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: 'linear',
          min: initial.min,
          max: initial.max,
          grid: { display: false },
          ticks: {
            callback: (value: number | string, _index: number, ticks: readonly { value: number }[]) =>
              formatAdaptiveTimeTick(Number(value), stepMsFromTicks(ticks)),
          },
        },
        y: {
          type: 'linear',
          // Pin every Trends chart's gutter to the same width every detail
          // band already shares — see Y_AXIS_WIDTH_PX's own doc comment.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterFit: (scale: any) => {
            scale.width = Y_AXIS_WIDTH_PX;
          },
          grid: { color: hexToRgba(themeColors.border, 0.4) },
        },
      },
      plugins: {
        zoom: buildZoomPluginOptions({ scaleKey, bounds, onSettle: (c) => controller?.settle(c) }),
        tooltip: {
          callbacks: {
            label: (context: { dataIndex: number }) => {
              const point = points[context.dataIndex];
              if (!point) return '';
              return `${point.km.toFixed(1)} km, ${point.runs} run${point.runs === 1 ? '' : 's'}`;
            },
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  controller = attachZoomController({
    members: [{ chart, canvas, ariaBase: VOLUME_ARIA_LABELS[granularity] }],
    header: zoom.header,
    scaleKey,
    bounds,
    groupLabel: 'Volume chart zoom and pan controls',
    onRangeChange: zoom.onRangeChange,
  });

  const detach = observeCanvasResize(chart, canvas);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      controller?.destroy();
      detach();
      chart.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// Year-over-Year (18-UI-SPEC § 9) — per-year colour resolved from LIVE CSS
// tokens via resolveToken, never a hardcoded rgba palette (the mechanism
// `src/widgets/comparison-chart/chart-config.ts` correctly uses instead,
// since that widget renders in Shadow DOM with no access to the dashboard's
// `data-theme` attribute — reproducing that pattern here would regress).
// ---------------------------------------------------------------------------

/**
 * Ordered token budget for up to 11 simultaneously-visible years: the three
 * channel colours first (matching the default 3-year selection), then the
 * 8 categorical tokens. A 12th+ selected year falls back to `hexToRgba` at
 * decreasing alpha over the LAST token, rather than silently repeating an
 * already-visible colour for two different years.
 */
const YOY_YEAR_TOKENS = [
  '--chart-pace',
  '--chart-hr',
  '--chart-cadence',
  '--cat-1',
  '--cat-2',
  '--cat-3',
  '--cat-4',
  '--cat-5',
  '--cat-6',
  '--cat-7',
  '--cat-8',
] as const;

function resolveYoyYearColor(index: number): string {
  if (index < YOY_YEAR_TOKENS.length) {
    return resolveToken(YOY_YEAR_TOKENS[index], '#4E79A7');
  }
  const lastToken = resolveToken(YOY_YEAR_TOKENS[YOY_YEAR_TOKENS.length - 1], '#9C755F');
  const overflow = index - YOY_YEAR_TOKENS.length + 1;
  const alpha = Math.max(0.3, 1 - overflow * 0.15);
  return hexToRgba(lastToken, alpha);
}

/**
 * Mounts the Year-over-Year tab's grouped bar chart: one dataset per
 * selected year, twelve `monthLabels` (from the parsed document, `Jan`…
 * `Dec`) on a `'category'` x-scale, y pinned to `Y_AXIS_WIDTH_PX`. The
 * caller destroys the previous instance before calling this again on any
 * year-selection change — never an in-place dataset mutation.
 */
export function mountYoyChart(
  canvas: HTMLCanvasElement,
  series: readonly YoySeries[],
  monthLabels: readonly string[]
): ChartHandle {
  canvas.setAttribute('aria-label', 'Year-over-year monthly distance comparison chart');

  const datasets = series.map((s, index) => {
    const color = resolveYoyYearColor(index);
    return {
      label: String(s.year),
      data: s.km,
      backgroundColor: color,
      borderColor: color,
    };
  });

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [...monthLabels],
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'category',
        },
        y: {
          type: 'linear',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterFit: (scale: any) => {
            scale.width = Y_AXIS_WIDTH_PX;
          },
          ticks: {
            callback: (value: number | string) => `${value} km`,
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y: unknown } }) => {
              const raw = context.parsed.y;
              const km = typeof raw === 'number' ? raw.toFixed(1) : '0.0';
              return `${context.dataset.label ?? ''}: ${km} km`;
            },
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  const detach = observeCanvasResize(chart, canvas);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      detach();
      chart.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// Cadence & HR (18-UI-SPEC § 10) — two stacked SINGLE-AXIS bands sharing one
// x-axis meaning (month), never one dual-axis chart (D-19's "no competing
// right-hand tick labels" rule, reapplied here). Reuses the exact
// `.chart-stack`/`.chart-band`/`.chart-band__canvas-wrap` markup
// `detail-charts.ts` already established.
// ---------------------------------------------------------------------------

const CHANNEL_ARIA_LABELS: Record<MonthlyChannel, string> = {
  cadence: 'Average cadence by month chart',
  hr: 'Average heart rate by month chart',
};

const CHANNEL_COLOR_TOKENS: Record<MonthlyChannel, string> = {
  cadence: '--chart-cadence',
  hr: '--chart-hr',
};

function formatChannelValue(channel: MonthlyChannel, value: number): string {
  return channel === 'cadence' ? `${value.toFixed(1)} rpm` : `${Math.round(value)} bpm`;
}

/**
 * The shape of one `.chart-band` built by `buildChartBand`: the outer band
 * element, its header (title only — plan 23-05 appends the D-10 zoom
 * control cluster as the header's SECOND child), the canvas-wrap, and the
 * canvas itself.
 */
export interface ChartBandParts {
  band: HTMLElement;
  header: HTMLElement;
  canvasWrap: HTMLElement;
  canvas: HTMLCanvasElement;
}

/**
 * Builds one `.chart-band` / `.chart-band__header` / `.chart-band__canvas-wrap`
 * / `canvas` markup tree, appends it to `parent`, and returns the parts.
 *
 * WHY THIS EXISTS (D-04): before Phase 23, only this Cadence & HR module
 * built this markup (`buildChannelBand`, below) — the Volume tab
 * (`trends.ts`) and the Training Load tab (`trends.ts`) each created a bare,
 * unclassed `<div>` of their own. That meant three call sites were
 * independently deciding whether to add `.chart-band__canvas-wrap`, and two
 * of them silently did not, so those two charts got NO height rule at all
 * and nowhere for D-10's control cluster or D-18/D-19's tall modifier to
 * attach. `buildChartBand` is the single, shared source of this markup for
 * every Trends band, extract-don't-duplicate applied to the wrapper itself.
 *
 * `detail-charts.ts` has its own `buildBand` (activity detail view, the
 * OTHER consumer of these same three class names) and is deliberately NOT
 * converted to this helper in this phase — D-04 scopes Phase 23 to
 * `#/trends` only, and the detail view's bands stay at the shared 140px
 * height, never the Trends-only `--tall` modifier.
 *
 * The `--zoom` header modifier and `--tall` canvas-wrap modifier are the
 * Trends-only CSS plan 23-02 added as siblings of the shared rules; the
 * shared `.chart-band__header` / `.chart-band__canvas-wrap` rules themselves
 * are untouched by this helper, so `detail-charts.ts`'s bands are unaffected.
 */
export function buildChartBand(
  parent: HTMLElement,
  headingText: string,
  ariaLabel: string
): ChartBandParts {
  const band = document.createElement('div');
  band.className = 'chart-band';

  const header = document.createElement('div');
  header.className = 'chart-band__header chart-band__header--zoom';
  const headingEl = document.createElement('span');
  headingEl.className = 'text-label';
  headingEl.textContent = headingText;
  header.appendChild(headingEl);
  band.appendChild(header);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'chart-band__canvas-wrap chart-band__canvas-wrap--tall';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', ariaLabel);
  canvasWrap.appendChild(canvas);
  band.appendChild(canvasWrap);

  parent.appendChild(band);

  return { band, header, canvasWrap, canvas };
}

/** `buildChannelBand`'s return shape: the constructed chart plus the `canvas` and `header` `buildChartBand` gave it, so `mountChannelBands` can attach one shared D-10 cluster to the cadence band's header without rebuilding any markup. `detach` disconnects this band's own `observeCanvasResize` (Finding 8) — `mountChannelBands` calls both bands' `detach` in its own `destroy()`. */
interface ChannelBandHandle {
  chart: Chart;
  canvas: HTMLCanvasElement;
  header: HTMLElement;
  detach: () => void;
}

/**
 * Mounts one stacked, single-axis line band into `stack` for `channel`.
 * `spanGaps: false` and the raw (possibly-null) `MonthlyPoint.value` are
 * passed straight through — a month with no qualifying data renders as a
 * genuine GAP in the line, never a zero and never an interpolated bridge
 * (18-UI-SPEC § 10, D-15's principle applied to a new context). The nulls
 * are NEVER filtered out of the dataset — filtering them would close the gap.
 *
 * THE GUTTER IS THE LOAD-BEARING DETAIL: `scale.width = Y_AXIS_WIDTH_PX` is
 * pinned unconditionally, exactly as `detail-charts.ts` does, even though
 * cadence (`170`) and HR (`142`) tick labels happen to be similar widths
 * today — a future channel with wider labels must not silently reintroduce
 * Phase 17's GAP 2 (misaligned stacked-band x-axes).
 *
 * `zoom` is `null` only when `mountChannelBands` found BOTH channels' series
 * empty (D-05: a chart with no data has no range to zoom) — in that one
 * case this function omits the plugin, the zoom options and the x-scale
 * min/max entirely, mirroring `mountVolumeChart`/`mountTrainingLoadChart`'s
 * own empty-series branch (Task 1).
 */
function buildChannelBand(
  stack: HTMLElement,
  points: readonly MonthlyPoint[],
  channel: MonthlyChannel,
  themeColors: { border: string; text: string; textSecondary: string },
  zoom: { initial: ZoomRange; bounds: ZoomRange; onSettle: (chart: Chart) => void } | null
): ChannelBandHandle {
  // channelLabel's cadence heading states the single-leg rpm unit explicitly
  // (matching detail.ts's `Cadence (rpm, single-leg)` stat-card label),
  // because the index value is deliberately not doubled to steps-per-minute.
  const { canvas, header } = buildChartBand(stack, channelLabel(channel), CHANNEL_ARIA_LABELS[channel]);

  const color = resolveToken(CHANNEL_COLOR_TOKENS[channel], channel === 'cadence' ? '#0891b2' : '#e11d48');

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: channelLabel(channel),
          data: points.map((point) => ({ x: point.x, y: point.value })),
          parsing: false,
          spanGaps: false,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
        },
      ],
    },
    plugins: zoom ? [chartZoomPlugin] : [],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: 'linear',
          ...(zoom ? { min: zoom.initial.min, max: zoom.initial.max } : {}),
          grid: { display: false },
          ticks: {
            callback: (value: number | string, _index: number, ticks: readonly { value: number }[]) =>
              formatAdaptiveTimeTick(Number(value), stepMsFromTicks(ticks)),
          },
        },
        y: {
          type: 'linear',
          // Pin the gutter unconditionally — see this function's doc comment.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterFit: (scale: any) => {
            scale.width = Y_AXIS_WIDTH_PX;
          },
          grid: { color: hexToRgba(themeColors.border, 0.4) },
        },
      },
      plugins: {
        ...(zoom
          ? { zoom: buildZoomPluginOptions({ scaleKey: 'cadence-hr', bounds: zoom.bounds, onSettle: zoom.onSettle }) }
          : {}),
        tooltip: {
          callbacks: {
            label: (context: { dataIndex: number }) => {
              const point = points[context.dataIndex];
              if (!point || point.value === null) {
                return `No data (${point?.runs ?? 0} run${(point?.runs ?? 0) === 1 ? '' : 's'})`;
              }
              return `${formatChannelValue(channel, point.value)} (${point.contributing} of ${point.runs} run${point.runs === 1 ? '' : 's'})`;
            },
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  const detach = observeCanvasResize(chart, canvas);

  return { chart, canvas, header, detach };
}

/**
 * Mounts the Cadence & HR tab's two stacked bands (cadence, then HR) sharing
 * one `.chart-stack`. Idempotent `destroy()` destroys both Chart.js
 * instances and removes the stack element.
 *
 * D-02/D-10: both bands are constructed at the SAME initial range and share
 * ONE `settle`-driven controller, whose D-10 cluster lives in the cadence
 * band's header rather than above the stack. D-02 means the pair always
 * shows the same range, so two clusters would just be two ways to drive one
 * piece of state — one cluster is the only shape that cannot go out of sync
 * with itself. The header choice mirrors `detail-charts.ts`'s existing
 * pattern of putting a band's own overlay picker inside that band's header,
 * rather than inventing a page-level control location.
 */
export function mountChannelBands(
  root: HTMLElement,
  cadence: readonly MonthlyPoint[],
  hr: readonly MonthlyPoint[],
  zoom: Omit<ZoomMountOptions, 'header'>
): ChartHandle {
  const themeColors = resolveThemeColors();

  const stack = document.createElement('div');
  stack.className = 'chart-stack';
  root.appendChild(stack);

  // Union of both channels' x values: the pair shares one domain even if one
  // channel's data starts later than the other's.
  const bounds = computeArchiveBounds([...cadence.map((p) => p.x), ...hr.map((p) => p.x)]);

  let controller: ZoomController | null = null;
  const onSettle = (c: Chart) => controller?.settle(c);

  // D-05: `zoomCfg` is `null` only when BOTH channels' series are empty — a
  // chart with no data has no range to zoom, so `buildChannelBand` omits the
  // plugin, the zoom options and the x-scale min/max entirely for that one
  // case (mirroring mountVolumeChart/mountTrainingLoadChart's own
  // empty-series branch, Task 1) while still calling `buildChannelBand`
  // exactly once per channel either way.
  const zoomCfg =
    bounds === null
      ? null
      : {
          initial: restoreOrDefault(zoom.savedRange, computeDefaultWindow('cadence-hr', bounds)),
          // CR-01: the zoom plugin's limits MUST come from the archive bounds,
          // never from `initial`. `initial` is the OPENING WINDOW (a default
          // window, or a D-22 restored range) — handing it to
          // `buildZoomPluginOptions` as `bounds` caps gesture zoom-out at the
          // opening window instead of the archive, and a restored range
          // narrows the cage further on every subsequent mount. Both are
          // `ZoomRange`, so the compiler cannot tell them apart; keep these
          // two fields separate and pass `bounds` — matching what
          // `attachZoomController` below already receives.
          bounds,
          onSettle,
        };

  const cadenceHandle = buildChannelBand(stack, cadence, 'cadence', themeColors, zoomCfg);
  const hrHandle = buildChannelBand(stack, hr, 'hr', themeColors, zoomCfg);

  if (bounds !== null) {
    controller = attachZoomController({
      members: [
        { chart: cadenceHandle.chart, canvas: cadenceHandle.canvas, ariaBase: CHANNEL_ARIA_LABELS.cadence },
        { chart: hrHandle.chart, canvas: hrHandle.canvas, ariaBase: CHANNEL_ARIA_LABELS.hr },
      ],
      header: cadenceHandle.header,
      scaleKey: 'cadence-hr',
      bounds,
      groupLabel: 'Cadence and heart rate chart zoom and pan controls',
      onRangeChange: zoom.onRangeChange,
    });
  }

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      controller?.destroy();
      cadenceHandle.detach();
      hrHandle.detach();
      cadenceHandle.chart.destroy();
      hrHandle.chart.destroy();
      stack.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Training Load (18-UI-SPEC § 11, D-14/D-15/D-16) — CTL/ATL/TSB over a
// selectable window, with a thin-HR-coverage shading plugin drawn as a FLAT
// rectangle (never a diagonal cross-pattern fill — a flat fill is trivially
// verifiable in a screenshot, and a hand-rolled diagonal-pattern primitive is
// one more canvas primitive this phase does not need to risk getting subtly
// wrong).
// ---------------------------------------------------------------------------

/**
 * A sibling of `detail-charts.ts`'s `createCrosshairPlugin`, in exactly the
 * same shape: a local plugin with an `id` and an `afterDraw` hook, handed to
 * each chart instance's OWN `plugins: [...]` array — NEVER registered
 * module-wide (T-18-CANVAS-01, T-18-SC). For each span it computes the
 * pixel x for `startX`/`endX`, guards both for finiteness (a span outside
 * the current window/scale range must not throw or draw garbage), and fills
 * a flat, low-opacity rectangle from `chartArea.top` to `chartArea.bottom`.
 */
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

function formatLoadValue(raw: unknown): string {
  return typeof raw === 'number' ? raw.toFixed(1) : '—';
}

/** Hoisted so the string is not duplicated between `aria-label` and the D-13 `ariaBase`. */
const TRAINING_LOAD_ARIA_LABEL = 'Training load chart: CTL, ATL, and TSB over time';

/**
 * Mounts the Training Load chart: three datasets over `{ x: epochMs, y }` —
 * CTL as a `Filler`-based filled area (mirroring `detail-charts.ts`'s
 * `hexToRgba(palette[channel], 0.18)` overlay-fill technique), ATL and TSB
 * as plain lines. `pointRadius: 0` plus Chart.js's built-in LTTB
 * `Decimation` handle the series's 5,000+ possible days. The caller
 * destroys the previous instance before calling this again — never an
 * in-place dataset mutation.
 *
 * D-03(b): from this phase on, the chart always holds the full 5,000+ day
 * series (D-06/D-16's "never filter the dataset" rule applies here too), so
 * `DECIMATION_CONFIG`'s LTTB sampling runs over everything the scale can
 * see at every zoom level, not a pre-filtered slice. Whether a deep zoom
 * actually resolves to daily resolution on screen is a browser-checkpoint
 * question (23-VALIDATION.md's last Manual-Only row) — this config alone
 * does not settle it.
 */
export function mountTrainingLoadChart(
  canvas: HTMLCanvasElement,
  points: readonly LoadPoint[],
  spans: readonly CoverageSpan[],
  zoom: ZoomMountOptions
): ChartHandle {
  const ctlColor = resolveToken('--load-ctl', '#3b82f6');
  const atlColor = resolveToken('--load-atl', '#ef4444');
  const tsbColor = resolveToken('--load-tsb', '#9ca3af');
  const themeColors = resolveThemeColors();

  canvas.setAttribute('aria-label', TRAINING_LOAD_ARIA_LABEL);

  const shadingColor = hexToRgba(resolveToken('--text-secondary', themeColors.textSecondary), 0.08);
  const shadingPlugin = createThinCoverageShadingPlugin(() => [...spans], shadingColor);

  const bounds = computeArchiveBounds(points.map((p) => p.x));

  if (bounds === null) {
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'CTL (Fitness)',
            data: points.map((p) => ({ x: p.x, y: p.ctl })),
            parsing: false,
            borderColor: ctlColor,
            backgroundColor: hexToRgba(ctlColor, 0.18),
            fill: 'origin',
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: 'ATL (Fatigue)',
            data: points.map((p) => ({ x: p.x, y: p.atl })),
            parsing: false,
            borderColor: atlColor,
            backgroundColor: atlColor,
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: 'TSB (Form)',
            data: points.map((p) => ({ x: p.x, y: p.tsb })),
            parsing: false,
            borderColor: tsbColor,
            backgroundColor: tsbColor,
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      plugins: [shadingPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'linear',
            grid: { display: false },
            ticks: {
              callback: (value: number | string, _index: number, ticks: readonly { value: number }[]) =>
                formatAdaptiveTimeTick(Number(value), stepMsFromTicks(ticks)),
            },
          },
          y: {
            type: 'linear',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            afterFit: (scale: any) => {
              scale.width = Y_AXIS_WIDTH_PX;
            },
            grid: { color: hexToRgba(themeColors.border, 0.4) },
          },
        },
        plugins: {
          decimation: DECIMATION_CONFIG,
          tooltip: {
            callbacks: {
              label: (context: { dataset: { label?: string }; parsed: { y: unknown } }) =>
                `${context.dataset.label ?? ''}: ${formatLoadValue(context.parsed.y)}`,
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    const detachEmpty = observeCanvasResize(chart, canvas);

    let destroyedEmpty = false;
    return {
      destroy(): void {
        if (destroyedEmpty) return;
        destroyedEmpty = true;
        detachEmpty();
        chart.destroy();
      },
    };
  }

  const scaleKey = 'training-load' as const;
  // D-06/D-22: same one-mechanism rationale as `mountVolumeChart` above.
  const initial = restoreOrDefault(zoom.savedRange, computeDefaultWindow(scaleKey, bounds));

  let controller: ZoomController | null = null;

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'CTL (Fitness)',
          data: points.map((p) => ({ x: p.x, y: p.ctl })),
          parsing: false,
          borderColor: ctlColor,
          backgroundColor: hexToRgba(ctlColor, 0.18),
          fill: 'origin',
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: 'ATL (Fatigue)',
          data: points.map((p) => ({ x: p.x, y: p.atl })),
          parsing: false,
          borderColor: atlColor,
          backgroundColor: atlColor,
          fill: false,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: 'TSB (Form)',
          data: points.map((p) => ({ x: p.x, y: p.tsb })),
          parsing: false,
          borderColor: tsbColor,
          backgroundColor: tsbColor,
          fill: false,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    plugins: [chartZoomPlugin, shadingPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'linear',
          min: initial.min,
          max: initial.max,
          grid: { display: false },
          ticks: {
            callback: (value: number | string, _index: number, ticks: readonly { value: number }[]) =>
              formatAdaptiveTimeTick(Number(value), stepMsFromTicks(ticks)),
          },
        },
        y: {
          type: 'linear',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterFit: (scale: any) => {
            scale.width = Y_AXIS_WIDTH_PX;
          },
          grid: { color: hexToRgba(themeColors.border, 0.4) },
        },
      },
      plugins: {
        zoom: buildZoomPluginOptions({ scaleKey, bounds, onSettle: (c) => controller?.settle(c) }),
        decimation: DECIMATION_CONFIG,
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y: unknown } }) =>
              `${context.dataset.label ?? ''}: ${formatLoadValue(context.parsed.y)}`,
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  controller = attachZoomController({
    members: [{ chart, canvas, ariaBase: TRAINING_LOAD_ARIA_LABEL }],
    header: zoom.header,
    scaleKey,
    bounds,
    groupLabel: 'Training load chart zoom and pan controls',
    onRangeChange: zoom.onRangeChange,
  });

  const detach = observeCanvasResize(chart, canvas);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      controller?.destroy();
      detach();
      chart.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// Gear (18-UI-SPEC § 12, D-17/D-18/D-19) — a bounded bar chart, at most the
// top 8 named shoes plus one neutral merged Other bar (never inside the
// 8-colour category budget, since "Other" is not itself a category).
// ---------------------------------------------------------------------------

const CATEGORY_TOKENS = [
  '--cat-1',
  '--cat-2',
  '--cat-3',
  '--cat-4',
  '--cat-5',
  '--cat-6',
  '--cat-7',
  '--cat-8',
] as const;

/**
 * Mounts the Gear tab's bar chart: one bar per bucket, height =
 * `distanceM / 1000`. Named buckets take `--cat-1` through `--cat-8` IN
 * ORDER, derived from the bucket's position (never eight hardcoded
 * branches); the Other bucket takes a neutral, deliberately-outside-the-
 * budget `--text-secondary` at low opacity.
 */
export function mountGearChart(canvas: HTMLCanvasElement, buckets: readonly GearChartBucket[]): ChartHandle {
  const themeColors = resolveThemeColors();
  const otherColor = hexToRgba(resolveToken('--text-secondary', themeColors.textSecondary), 0.5);

  canvas.setAttribute('aria-label', 'Total distance by shoe chart, top 8 shown');

  let namedIndex = 0;
  const colors = buckets.map((bucket) => {
    if (bucket.isOther) return otherColor;
    const token = CATEGORY_TOKENS[namedIndex % CATEGORY_TOKENS.length];
    namedIndex += 1;
    return resolveToken(token, '#4E79A7');
  });

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: 'Distance',
          data: buckets.map((b) => b.distanceM / 1000),
          backgroundColor: colors,
          borderColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'category',
          grid: { display: false },
        },
        y: {
          type: 'linear',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterFit: (scale: any) => {
            scale.width = Y_AXIS_WIDTH_PX;
          },
          ticks: {
            callback: (value: number | string) => `${value} km`,
          },
          grid: { color: hexToRgba(themeColors.border, 0.4) },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: { dataIndex: number }) => {
              const bucket = buckets[context.dataIndex];
              if (!bucket) return '';
              return `${bucket.label}: ${(bucket.distanceM / 1000).toFixed(1)} km`;
            },
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  const detach = observeCanvasResize(chart, canvas);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      detach();
      chart.destroy();
    },
  };
}
