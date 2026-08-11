/**
 * Stacked per-channel chart bands for the activity detail page (DETAIL-03,
 * D-17..D-22, D-25, D-26).
 *
 * LAZY-CHUNK BOUNDARY (D-25): this module places a PLAIN TOP-LEVEL STATIC
 * import of `chart.js`. That import is exactly what makes THIS MODULE the
 * lazy chunk boundary — plan 17-14 reaches it only via
 * `await import('./detail-charts.js')`, so Vite places Chart.js inside that
 * async chunk. No other module may import `detail-charts.ts` statically —
 * `list.ts`, `calendar.ts`, and `overview.ts` must never pay for Chart.js.
 *
 * All series derivation, pace smoothing, hover geometry, and the overlay
 * tamper-guard live in `detail-charts-logic.ts` (plan 17-04, unit-tested).
 * This module is Chart.js configuration and DOM wiring only — it is not
 * testable under `environment: 'node'` and is verified manually in a real
 * browser (plan 17-15).
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
  type Plugin,
} from 'chart.js';

import type { CanonicalStream } from '../../streams/stream.types.js';
import {
  type ChannelKey,
  type XAxisMode,
  type SeriesPoint,
  availableChannels,
  buildChannelSeries,
  distanceFractionAtX,
  type OverlayConfig,
  MAX_OVERLAYS_PER_BAND,
  parseOverlayConfig,
  readStoredOverlayConfig,
  writeStoredOverlayConfig,
} from './detail-charts-logic.js';
import { resolveChannelPalette, resolveThemeColors, hexToRgba, Y_AXIS_WIDTH_PX } from './chart-theme.js';

// ---------------------------------------------------------------------------
// Registration — tree-shaken, mirroring comparison-chart/chart-config.ts and
// streak-widget/chart-config.ts's minimal-registration pattern. `Filler` is
// required for D-19's overlay area fills; `Decimation` is required for
// D-22's LTTB point capping. No caption/key plugin is registered — each
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
// Theme palette resolution and Y_AXIS_WIDTH_PX now live in `chart-theme.ts`
// (imported above) — the single source of chart colour resolution for every
// dashboard view. See that module's header comment for the DEVIATION note
// on why this differs from comparison-chart/chart-config.ts's hardcoded
// light/dark literal table.
// ---------------------------------------------------------------------------

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

/** Nearest-point lookup by x value (points are x-sorted, per `buildChannelSeries`). */
function nearestIndexForX(points: readonly SeriesPoint[], xValue: number): number {
  const n = points.length;
  if (n === 0) return -1;
  if (xValue <= points[0].x) return 0;
  if (xValue >= points[n - 1].x) return n - 1;

  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < xValue) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return 0;
  const before = points[lo - 1];
  const after = points[lo];
  return xValue - before.x <= after.x - xValue ? lo - 1 : lo;
}

/**
 * A tiny inline Chart.js plugin (D-26) drawing a shared 1px vertical
 * crosshair at the active hovered x, registered LOCALLY per chart instance
 * (via each band's own `plugins: [...]` config array) rather than globally
 * via `Chart.register` and rather than an npm dependency.
 */
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
  overlayCheckboxes: Map<ChannelKey, HTMLInputElement>;
  hintEl: HTMLElement;
}

/**
 * Mounts up to four stacked, theme-resolved Chart.js line bands (pace, hr,
 * cadence, elevation — CHANNEL_KEYS order, D-17) on a shared x domain, with
 * per-band multi-check overlay shading (D-18/D-19), a distance/time toggle
 * (D-21), persisted overlay config (D-20), and a synced hover crosshair that
 * broadcasts a distance fraction for the route map marker (D-26).
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

  const storage = options.storage ?? globalThis.localStorage;
  let overlayConfig: OverlayConfig = readStoredOverlayConfig(storage);
  let xAxisMode: XAxisMode = 'distance';

  const palette = resolveChannelPalette();
  const themeColors = resolveThemeColors();

  let sharedMin = 0;
  let sharedMax = 1;
  let activeXValue: number | null = null;

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

  /**
   * Validates a candidate next config through `parseOverlayConfig` (the
   * cap/allow-list/self-overlay-drop/de-dup logic lives there exactly once,
   * per plan §Overlay picker) rather than hand-counting checked boxes here.
   */
  function computeCandidateConfig(band: ChannelKey, overlayChannel: ChannelKey, checked: boolean): OverlayConfig {
    const current = overlayConfig[band];
    const nextList = checked ? [...current, overlayChannel] : current.filter((c) => c !== overlayChannel);
    const candidateRaw: Record<string, unknown> = { ...overlayConfig, [band]: nextList };
    return parseOverlayConfig(candidateRaw);
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

  // -- Hover broadcast: draws the crosshair + tooltip in every band and ---
  // -- notifies options.onHover with the D-26 distance fraction. ----------

  function clearActiveElements(chart: Chart): void {
    chart.setActiveElements([]);
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
    chart.update('none');
  }

  function broadcastHover(xValue: number | null): void {
    activeXValue = xValue;

    for (const band of bands) {
      if (xValue === null) {
        clearActiveElements(band.chart);
        continue;
      }

      const primaryDatasetIndex = band.chart.data.datasets.length - 1;
      const primaryDataset = band.chart.data.datasets[primaryDatasetIndex];
      const points = (primaryDataset?.data as SeriesPoint[] | undefined) ?? [];
      const idx = nearestIndexForX(points, xValue);
      if (idx === -1) {
        clearActiveElements(band.chart);
        continue;
      }

      const point = points[idx];
      const xScale = band.chart.scales.x;
      const yScale = band.chart.scales.y;
      const pixelX = xScale ? xScale.getPixelForValue(point.x) : 0;
      const pixelY = yScale ? yScale.getPixelForValue(point.y) : 0;

      band.chart.setActiveElements([{ datasetIndex: primaryDatasetIndex, index: idx }]);
      band.chart.tooltip?.setActiveElements(
        [{ datasetIndex: primaryDatasetIndex, index: idx }],
        { x: pixelX, y: pixelY }
      );
      band.chart.update('none');
    }

    if (options.onHover) {
      options.onHover(xValue === null ? null : distanceFractionAtX(stream, xAxisMode, xValue));
    }
  }

  // -- Per-band overlay picker UI (enable/disable + the cap-reached hint) ---

  function updateOverlayPickerUI(band: BandState): void {
    const overlays = overlayConfig[band.channel];
    const atCap = overlays.length >= MAX_OVERLAYS_PER_BAND;
    band.overlayCheckboxes.forEach((checkbox, otherChannel) => {
      const checked = overlays.includes(otherChannel);
      checkbox.checked = checked;
      checkbox.disabled = atCap && !checked;
    });
    band.hintEl.style.display = atCap ? '' : 'none';
  }

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

    const picker = document.createElement('div');
    picker.className = 'overlay-picker';

    const pickerLabelEl = document.createElement('span');
    pickerLabelEl.textContent = 'Shade behind';
    picker.appendChild(pickerLabelEl);

    const overlayCheckboxes = new Map<ChannelKey, HTMLInputElement>();
    // A band cannot overlay itself, and an unavailable channel is not offered.
    const otherChannels = channels.filter((c) => c !== channel);

    for (const otherChannel of otherChannels) {
      const optionLabel = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => {
        const candidate = computeCandidateConfig(channel, otherChannel, checkbox.checked);
        overlayConfig = candidate;
        writeStoredOverlayConfig(storage, overlayConfig);
        rebuildBands();
      });
      optionLabel.appendChild(checkbox);
      optionLabel.appendChild(document.createTextNode(CHANNEL_META[otherChannel].label));
      picker.appendChild(optionLabel);
      overlayCheckboxes.set(otherChannel, checkbox);
    }

    const hintEl = document.createElement('span');
    hintEl.className = 'overlay-picker__hint';
    hintEl.textContent = 'Up to 2';
    picker.appendChild(hintEl);

    header.appendChild(picker);
    wrapper.appendChild(header);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'chart-band__canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', CHANNEL_META[channel].ariaLabel);
    canvasWrap.appendChild(canvas);
    wrapper.appendChild(canvasWrap);

    // -- Datasets: overlays first (so the primary line draws on top), each --
    // -- on its own undrawn, auto-scaled axis (D-19). ------------------------

    const overlays = overlayConfig[channel];
    const primarySeries = buildChannelSeries(stream, channel, xAxisMode) ?? [];

    const datasetChannels: ChannelKey[] = [];
    // Chart.js's own generic dataset/scale typings don't accommodate a
    // per-band dynamic overlay scale count cleanly; the config objects below
    // are built loosely and handed to `new Chart(...)` as-is.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [];
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
        // Pin every band's gutter to the same width so all bands share one
        // left edge — see Y_AXIS_WIDTH_PX. Without this each band self-sizes
        // to its own widest label and the x-axes drift out of alignment.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        afterFit: (scale: any) => {
          scale.width = Y_AXIS_WIDTH_PX;
        },
        grid: { display: true, color: hexToRgba(themeColors.border, 0.4) },
        ticks: {
          font: { size: 14 },
          callback:
            channel === 'pace' ? (value: number | string) => formatPaceValue(Number(value)) : undefined,
        },
      },
    };

    overlays.forEach((overlayChannel, i) => {
      const overlaySeries = buildChannelSeries(stream, overlayChannel, xAxisMode) ?? [];
      const scaleId = `overlay${i}`;
      // Undrawn overlay axis (D-19) — auto-scaled but never rendered, so no
      // competing right-hand tick labels; the tooltip carries the true value.
      scales[scaleId] = { type: 'linear', display: false, position: 'right' };
      datasetChannels.push(overlayChannel);
      datasets.push({
        label: CHANNEL_META[overlayChannel].label,
        data: overlaySeries,
        parsing: false,
        yAxisID: scaleId,
        fill: true,
        borderWidth: 0,
        pointRadius: 0,
        backgroundColor: hexToRgba(palette[overlayChannel], i === 0 ? 0.18 : 0.1),
        order: i === 0 ? 1 : 2, // second overlay drawn further back
      });
    });

    datasetChannels.push(channel);
    datasets.push({
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
    });

    const crosshairPlugin = createCrosshairPlugin(() => activeXValue, themeColors.textSecondary);

    const chart = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      plugins: [crosshairPlugin],
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
              label: (context: { datasetIndex: number; parsed: { y: unknown } }) => {
                const ch = datasetChannels[context.datasetIndex];
                const raw = context.parsed.y;
                if (typeof raw !== 'number') return '';
                return `${CHANNEL_META[ch].label}: ${CHANNEL_META[ch].formatValue(raw)}`;
              },
            },
          },
        },
        onHover: (_event: unknown, elements: { index: number }[]) => {
          if (elements.length === 0) return;
          const point = primarySeries[elements[0].index];
          if (point) broadcastHover(point.x);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    canvas.addEventListener('mouseleave', () => broadcastHover(null));

    const band: BandState = { channel, chart, wrapper, overlayCheckboxes, hintEl };
    updateOverlayPickerUI(band);
    return band;
  }

  function rebuildBands(): void {
    for (const band of bands) band.chart.destroy();
    bands.length = 0;
    stack.replaceChildren();
    activeXValue = null;

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
