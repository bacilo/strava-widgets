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
} from 'chart.js';

import { resolveToken, resolveThemeColors, hexToRgba, Y_AXIS_WIDTH_PX } from './chart-theme.js';
import type { VolumePoint, VolumeGranularity } from './trends-volume-logic.js';
import type { YoySeries } from './trends-yoy-logic.js';
import { channelLabel, type MonthlyChannel, type MonthlyPoint } from './trends-cadence-hr-logic.js';

// ---------------------------------------------------------------------------
// Registration — Bar* powers both this plan's Volume and Year-over-Year
// charts; Line*/CategoryScale/Filler are registered now too since plan
// 18-15 (Cadence & HR's line charts, Training Load's Filler-based CTL area
// fill) extends this SAME shared module rather than re-registering.
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
  Filler
);

export interface ChartHandle {
  destroy(): void;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const VOLUME_ARIA_LABELS: Record<VolumeGranularity, string> = {
  weekly: 'Weekly distance chart',
  monthly: 'Monthly distance chart',
  yearly: 'Yearly distance chart',
};

function formatVolumeTick(epochMs: number, granularity: VolumeGranularity): string {
  const d = new Date(epochMs);
  const year = d.getUTCFullYear();
  if (granularity === 'yearly') return String(year);
  const month = MONTH_ABBR[d.getUTCMonth()];
  if (granularity === 'monthly') return `${month} ${year}`;
  return `${d.getUTCDate()} ${month} ${year}`;
}

/**
 * Mounts the Volume tab's single chart — a bar per period, x pinned to the
 * shared `Y_AXIS_WIDTH_PX` gutter (18-UI-SPEC § 10's alignment fix, applied
 * here too so every chart on the page starts its plot area at the same x).
 * `aria-label` changes with `granularity`; the caller is responsible for
 * destroying the previous instance before calling this again (never an
 * in-place dataset mutation — the "Canvas is already in use" defect class).
 */
export function mountVolumeChart(
  canvas: HTMLCanvasElement,
  points: readonly VolumePoint[],
  granularity: VolumeGranularity
): ChartHandle {
  const color = resolveToken('--chart-pace', '#fc4c02');
  const themeColors = resolveThemeColors();

  canvas.setAttribute('aria-label', VOLUME_ARIA_LABELS[granularity]);

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
            callback: (value: number | string) => formatVolumeTick(Number(value), granularity),
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

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
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

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
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

function formatMonthYearTick(epochMs: number): string {
  const d = new Date(epochMs);
  return `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatChannelValue(channel: MonthlyChannel, value: number): string {
  return channel === 'cadence' ? `${value.toFixed(1)} rpm` : `${Math.round(value)} bpm`;
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
 */
function buildChannelBand(
  stack: HTMLElement,
  points: readonly MonthlyPoint[],
  channel: MonthlyChannel,
  themeColors: { border: string; text: string; textSecondary: string }
): Chart {
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-band';

  const header = document.createElement('div');
  header.className = 'chart-band__header';
  const headingEl = document.createElement('span');
  headingEl.className = 'text-label';
  // channelLabel's cadence heading states the single-leg rpm unit explicitly
  // (matching detail.ts's `Cadence (rpm, single-leg)` stat-card label),
  // because the index value is deliberately not doubled to steps-per-minute.
  headingEl.textContent = channelLabel(channel);
  header.appendChild(headingEl);
  wrapper.appendChild(header);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'chart-band__canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', CHANNEL_ARIA_LABELS[channel]);
  canvasWrap.appendChild(canvas);
  wrapper.appendChild(canvasWrap);

  stack.appendChild(wrapper);

  const color = resolveToken(CHANNEL_COLOR_TOKENS[channel], channel === 'cadence' ? '#0891b2' : '#e11d48');

  return new Chart(canvas, {
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: 'linear',
          grid: { display: false },
          ticks: {
            callback: (value: number | string) => formatMonthYearTick(Number(value)),
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
}

/**
 * Mounts the Cadence & HR tab's two stacked bands (cadence, then HR) sharing
 * one `.chart-stack`. Idempotent `destroy()` destroys both Chart.js
 * instances and removes the stack element.
 */
export function mountChannelBands(
  root: HTMLElement,
  cadence: readonly MonthlyPoint[],
  hr: readonly MonthlyPoint[]
): ChartHandle {
  const themeColors = resolveThemeColors();

  const stack = document.createElement('div');
  stack.className = 'chart-stack';
  root.appendChild(stack);

  const cadenceChart = buildChannelBand(stack, cadence, 'cadence', themeColors);
  const hrChart = buildChannelBand(stack, hr, 'hr', themeColors);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cadenceChart.destroy();
      hrChart.destroy();
      stack.remove();
    },
  };
}
