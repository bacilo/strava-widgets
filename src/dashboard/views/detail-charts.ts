/**
 * Stacked per-channel chart bands for the activity detail page (DETAIL-03,
 * D-17..D-22, D-25).
 *
 * LAZY-CHUNK BOUNDARY (D-25): this module places a PLAIN TOP-LEVEL STATIC
 * import of `chart.js`. That import is exactly what makes THIS MODULE the
 * lazy chunk boundary — plan 17-14 reaches it only via
 * `await import('./detail-charts.js')`, so Vite places Chart.js inside that
 * async chunk. No other module may import `detail-charts.ts` statically —
 * `list.ts`, `calendar.ts`, and `overview.ts` must never pay for Chart.js.
 *
 * All series derivation, pace smoothing, and hover geometry live in
 * `detail-charts-logic.ts` (plan 17-04, unit-tested). This module is
 * Chart.js configuration and DOM wiring only — it is not testable under
 * `environment: 'node'` and is verified manually in a real browser
 * (plan 17-15).
 *
 * Task 1 of this plan lands stacked bands, the theme-resolved palette, and
 * the x-axis toggle. Task 2 (next commit) adds per-band overlay pickers,
 * the undrawn overlay axis, persistence, and the hover crosshair broadcast.
 */

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Filler,
  Decimation,
} from 'chart.js';

import type { CanonicalStream } from '../../streams/stream.types.js';
import {
  type ChannelKey,
  type XAxisMode,
  availableChannels,
  buildChannelSeries,
} from './detail-charts-logic.js';

// ---------------------------------------------------------------------------
// Registration — tree-shaken, mirroring comparison-chart/chart-config.ts and
// streak-widget/chart-config.ts's minimal-registration pattern. `Filler` is
// required for D-19's overlay area fills (Task 2); `Decimation` is required
// for D-22's LTTB point capping. No caption/key plugin is registered — each
// band's heading is plain DOM, and a drawn key would fight the compact
// 140px band height.
// ---------------------------------------------------------------------------
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Filler, Decimation);

/**
 * D-22: caps drawn points per band at ~500 via Chart.js's built-in LTTB
 * decimation. Declared once and referenced by every band's chart config so
 * the algorithm literal appears exactly once in this file's source.
 */
const DECIMATION_CONFIG = { enabled: true, algorithm: 'lttb', samples: 500 } as const;

// ---------------------------------------------------------------------------
// Theme palette resolution
//
// DEVIATION from comparison-chart/chart-config.ts's hardcoded
// `isDark ? ... : ...` branch: that widget has no access to the dashboard's
// `data-theme` attribute, so it hardcodes two literal palettes. This module
// DOES have access (it lives inside the same document), so every colour is
// resolved from the live CSS custom properties at mount time instead of a
// light/dark literal table — this is an intentional divergence from the
// copied widgets, not a defect to reproduce.
// ---------------------------------------------------------------------------

/**
 * Reads a CSS custom property off `document.documentElement`, falling back
 * to `fallback` when the property is empty (e.g. a missing token) so a
 * theming gap degrades to a visible colour rather than an invisible chart.
 */
function resolveToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

interface ChannelPalette {
  pace: string;
  hr: string;
  cadence: string;
  elevation: string;
}

function resolveChannelPalette(): ChannelPalette {
  return {
    pace: resolveToken('--chart-pace', '#fc4c02'),
    hr: resolveToken('--chart-hr', '#e11d48'),
    cadence: resolveToken('--chart-cadence', '#0891b2'),
    elevation: resolveToken('--chart-elevation', '#16a34a'),
  };
}

interface ThemeColors {
  border: string;
  text: string;
  textSecondary: string;
}

function resolveThemeColors(): ThemeColors {
  return {
    border: resolveToken('--border', '#e5e5e5'),
    text: resolveToken('--text', '#333333'),
    textSecondary: resolveToken('--text-secondary', '#666666'),
  };
}

/**
 * Converts a resolved `#rrggbb` (or `#rgb`) token into an `rgba(...)` string
 * at `alpha`. Every resolved token in this file's design-token contract is a
 * hex literal (styles.css), so a non-hex value degrades to opaque black
 * rather than producing an invalid canvas fill style.
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.trim().replace('#', '');
  const expanded = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const parsed = parseInt(expanded, 16);
  if (expanded.length !== 6 || Number.isNaN(parsed)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Channel presentation metadata (labels, aria descriptions, tooltip units)
// ---------------------------------------------------------------------------

function formatPaceValue(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

interface ChannelMeta {
  label: string;
  ariaLabel: string;
  formatValue: (raw: number) => string;
}

const CHANNEL_META: Record<ChannelKey, ChannelMeta> = {
  pace: {
    label: 'Pace',
    ariaLabel: 'Pace chart, by distance',
    formatValue: formatPaceValue,
  },
  hr: {
    label: 'Heart Rate',
    ariaLabel: 'Heart rate chart, beats per minute by distance',
    formatValue: (v) => `${Math.round(v)} bpm`,
  },
  cadence: {
    label: 'Cadence',
    ariaLabel: 'Cadence chart, steps per minute by distance',
    formatValue: (v) => `${Math.round(v)} spm`,
  },
  elevation: {
    label: 'Elevation',
    ariaLabel: 'Elevation chart, metres by distance',
    formatValue: (v) => `${Math.round(v)} m`,
  },
};

/** Formats a shared x-axis tick: `m:ss` for time mode, `N.N km` for distance mode. */
function formatXTick(value: number, mode: XAxisMode): string {
  if (mode === 'time') {
    const totalSeconds = Math.round(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return `${value.toFixed(1)} km`;
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface MountChartBandsOptions {
  stream: CanonicalStream;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  onHover?: (fraction: number | null) => void;
}

export interface ChartBandsHandle {
  destroy(): void;
}

interface BandState {
  channel: ChannelKey;
  chart: Chart;
  wrapper: HTMLElement;
}

/**
 * Mounts up to four stacked, theme-resolved Chart.js line bands (pace, hr,
 * cadence, elevation — CHANNEL_KEYS order, D-17) on a shared x domain, with
 * a distance/time toggle (D-21). `options.storage`/`options.onHover` are
 * accepted now (locked interface, per plan) and wired up by Task 2.
 */
export function mountChartBands(container: HTMLElement, options: MountChartBandsOptions): ChartBandsHandle {
  const { stream } = options;
  const channels = availableChannels(stream);

  // D-17: an absent channel simply omits its band; if NO channel is
  // available at all, render nothing rather than a broken/empty shell.
  if (channels.length === 0) {
    return {
      destroy(): void {
        // No-op — nothing was ever mounted.
      },
    };
  }

  let xAxisMode: XAxisMode = 'distance';

  const palette = resolveChannelPalette();
  const themeColors = resolveThemeColors();

  let sharedMin = 0;
  let sharedMax = 1;

  /** Computed once per axis-mode from the FIRST available channel's series (per plan §Band construction 4). */
  function computeSharedDomain(): void {
    const firstSeries = buildChannelSeries(stream, channels[0], xAxisMode) ?? [];
    if (firstSeries.length > 0) {
      sharedMin = firstSeries[0].x;
      sharedMax = firstSeries[firstSeries.length - 1].x;
    } else {
      sharedMin = 0;
      sharedMax = 1;
    }
  }

  // -- Root DOM: segmented x-axis control above a `.chart-stack` --------

  const root = document.createElement('div');

  const segmented = document.createElement('div');
  segmented.className = 'segmented';
  segmented.setAttribute('role', 'group');
  segmented.setAttribute('aria-label', 'Chart x-axis');

  const distanceOption = document.createElement('button');
  distanceOption.type = 'button';
  distanceOption.className = 'segmented__option segmented__option--active';
  distanceOption.textContent = 'Distance';
  distanceOption.setAttribute('aria-pressed', 'true');

  const timeOption = document.createElement('button');
  timeOption.type = 'button';
  timeOption.className = 'segmented__option';
  timeOption.textContent = 'Time';
  timeOption.setAttribute('aria-pressed', 'false');

  segmented.appendChild(distanceOption);
  segmented.appendChild(timeOption);
  root.appendChild(segmented);

  const stack = document.createElement('div');
  stack.className = 'chart-stack';
  root.appendChild(stack);

  container.appendChild(root);

  const bands: BandState[] = [];

  // -- Band construction ---------------------------------------------------

  function buildBand(channel: ChannelKey, isBottomMost: boolean): BandState {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-band';

    const header = document.createElement('div');
    header.className = 'chart-band__header';

    const channelLabelEl = document.createElement('span');
    channelLabelEl.className = 'text-label';
    channelLabelEl.textContent = CHANNEL_META[channel].label;
    header.appendChild(channelLabelEl);
    wrapper.appendChild(header);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'chart-band__canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', CHANNEL_META[channel].ariaLabel);
    canvasWrap.appendChild(canvas);
    wrapper.appendChild(canvasWrap);

    const primarySeries = buildChannelSeries(stream, channel, xAxisMode) ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scales: Record<string, any> = {
      x: {
        type: 'linear',
        min: sharedMin,
        max: sharedMax,
        grid: { display: false },
        ticks: {
          display: isBottomMost,
          font: { size: 14 },
          callback: (value: number | string) => formatXTick(Number(value), xAxisMode),
        },
      },
      y: {
        type: 'linear',
        grid: { display: true, color: hexToRgba(themeColors.border, 0.4) },
        ticks: {
          font: { size: 14 },
          callback:
            channel === 'pace' ? (value: number | string) => formatPaceValue(Number(value)) : undefined,
        },
      },
    };

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: CHANNEL_META[channel].label,
            data: primarySeries,
            parsing: false,
            yAxisID: 'y',
            borderColor: palette[channel],
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: 'index', intersect: false },
        scales,
        plugins: {
          decimation: DECIMATION_CONFIG,
          tooltip: {
            callbacks: {
              label: (context: { parsed: { y: unknown } }) => {
                const raw = context.parsed.y;
                if (typeof raw !== 'number') return '';
                return `${CHANNEL_META[channel].label}: ${CHANNEL_META[channel].formatValue(raw)}`;
              },
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    return { channel, chart, wrapper };
  }

  function rebuildBands(): void {
    for (const band of bands) band.chart.destroy();
    bands.length = 0;
    stack.replaceChildren();

    computeSharedDomain();

    channels.forEach((channel, i) => {
      const band = buildBand(channel, i === channels.length - 1);
      bands.push(band);
      stack.appendChild(band.wrapper);
    });
  }

  rebuildBands();

  // -- X-axis toggle (D-21) — in-memory only, never persisted, never in the URL --

  function setXAxisMode(mode: XAxisMode): void {
    if (xAxisMode === mode) return;
    xAxisMode = mode;

    const isDistance = mode === 'distance';
    distanceOption.classList.toggle('segmented__option--active', isDistance);
    distanceOption.setAttribute('aria-pressed', String(isDistance));
    timeOption.classList.toggle('segmented__option--active', !isDistance);
    timeOption.setAttribute('aria-pressed', String(!isDistance));

    rebuildBands();
  }

  distanceOption.addEventListener('click', () => setXAxisMode('distance'));
  timeOption.addEventListener('click', () => setXAxisMode('time'));

  // -- Handle ---------------------------------------------------------------

  let destroyed = false;

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const band of bands) band.chart.destroy();
      bands.length = 0;
      root.remove();
    },
  };
}
