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
