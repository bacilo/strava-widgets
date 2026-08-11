/**
 * Seven independent PR-evolution step charts for the Records page
 * (REC-02/03, D-06, 18-UI-SPEC § 3).
 *
 * LAZY-CHUNK BOUNDARY: this module places a PLAIN TOP-LEVEL STATIC import of
 * `chart.js`. That import is exactly what makes THIS MODULE the lazy chunk
 * boundary — `records.ts` reaches it only via
 * `await import('./records-charts.js')`, so Vite places Chart.js inside
 * that async chunk. No other module may import `records-charts.ts`
 * statically — `records.ts`'s own static import graph, and every other
 * dashboard view, must never pay for Chart.js just to reach `#/records`.
 *
 * Each of the seven cards is mounted as its own fully independent Chart.js
 * instance: independent y-range (44 seconds to 87 minutes across the seven
 * distances), independent x (date) range, and a single uniform series
 * colour that carries no comparative meaning — the card's own heading and
 * big current-PR number carry the identity, per 18-UI-SPEC § 3's explicit
 * MUST-NOT on any cross-card shared-domain logic.
 *
 * This module is Chart.js configuration and DOM wiring only — it is not
 * testable under `environment: 'node'` and is verified manually in a real
 * browser (plan 18-16).
 */

import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip } from 'chart.js';

import type { TargetDistanceKey } from '../../analytics/best-effort.types.js';
import type { EvolutionPoint } from './records-logic.js';
import { resolveToken } from './chart-theme.js';
import { formatEffortDuration } from './list.js';

// ---------------------------------------------------------------------------
// Registration — tree-shaken, only what a stepped single-series line chart
// needs. No area-fill plugin (no fill in this contract) and no point-capping
// plugin (78-79 points archive-wide across all seven cards combined — far
// below the count either omitted plugin would exist to address).
// ---------------------------------------------------------------------------
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

/** One card's mount inputs. */
export interface EvolutionChartCard {
  distance: TargetDistanceKey;
  /** Display name for the aria-label and tooltip context ("5K", "Half Marathon", ...). */
  displayName: string;
  canvas: HTMLCanvasElement;
  points: readonly EvolutionPoint[];
}

export interface EvolutionChartsHandle {
  destroy(): void;
}

/**
 * Mounts one independent stepped-line Chart.js instance per card. A card
 * with an empty `points` array is simply skipped — `records.ts` never hands
 * this function a card without a canvas, but an empty series is still
 * defensively skipped here rather than constructing a chart over nothing.
 */
export function mountEvolutionCharts(cards: readonly EvolutionChartCard[]): EvolutionChartsHandle {
  const seriesColor = resolveToken('--chart-pace', '#fc4c02');
  const charts: Chart[] = [];

  for (const card of cards) {
    if (card.points.length === 0) continue;

    card.canvas.setAttribute('aria-label', `${card.displayName} PR evolution chart, time by date`);

    const chart = new Chart(card.canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: card.displayName,
            data: card.points.map((point) => ({ x: point.x, y: point.y })),
            stepped: 'after',
            pointRadius: 3,
            borderWidth: 2,
            fill: false,
            borderColor: seriesColor,
            backgroundColor: seriesColor,
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
            ticks: {
              callback: (value: number | string) => String(new Date(Number(value)).getUTCFullYear()),
            },
          },
          y: {
            type: 'linear',
            reverse: true,
            ticks: {
              callback: (value: number | string) => formatEffortDuration(Number(value)),
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: { parsed: { y: unknown } }) => {
                const raw = context.parsed.y;
                return typeof raw === 'number' ? formatEffortDuration(raw) : '';
              },
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    charts.push(chart);
  }

  let destroyed = false;

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const chart of charts) chart.destroy();
      charts.length = 0;
    },
  };
}
