/**
 * Chart-series derivation, hover geometry, and tamper-safe overlay-config
 * persistence for the detail page's stacked chart bands (DETAIL-03).
 *
 * PACE-01 / CR-03 (corrected 2026-09-09): this module owns NO pace
 * arithmetic and NO window resolution of its own. The pace band's series
 * comes directly from `derivePaceWithCoverage(stream)` — the same single
 * D-16 entry point `detail.ts` calls for the histogram, coverage caption
 * and split markers — so both surfaces resolve the same adaptively-chosen
 * window from the same stream. Previously this file held a thin
 * `derivePaceSeries` wrapper that took an explicit window width, and
 * `buildChannelSeries` called it with the fixed 20s floor rather than the
 * adaptive resolution; that wrapper is deleted, not re-argumented (CR-03,
 * `26-VERIFICATION.md`). `detail-charts-logic.test.ts`'s CR-03 block
 * asserts the chart's own `buildChannelSeries` output equals
 * `derivePaceWithCoverage(...).paceSeries` index-for-index on activity
 * `5059204779`, whose adaptive window is 150s, not the 20s floor — that is
 * the fact that makes this claim checkable rather than aspirational.
 *
 * Pure, DOM-free module — never imports `chart.js` or `leaflet`, and never
 * touches the browser's persisted key-value storage global directly. Any
 * storage read/write goes through an injected `Storage`-shaped parameter,
 * exactly like `theme.ts`'s tamper-guard pattern (RESEARCH.md "Don't Hand
 * Roll" table): allow-list valid values on READ, try/catch every storage
 * call, fall back safely.
 *
 * Committed streams are NOT uniformly sampled (RESEARCH.md Pitfall 1) — pace
 * smoothing and hover-time-to-distance conversion always weight by real `Δt`
 * / interpolate at the real crossing, never assume a fixed sample rate.
 */

import type { CanonicalStream } from '../../streams/stream.types.js';
import { validateStreamSeries } from '../../analytics/best-effort-utils.js';
import type { WebStorage } from '../storage.js';
import { derivePaceWithCoverage, interpValueAtTime } from '../../analytics/pace-derivation.js';

export { interpValueAtTime } from '../../analytics/pace-derivation.js';

// ---------------------------------------------------------------------------
// Channels and series
// ---------------------------------------------------------------------------

export type ChannelKey = 'pace' | 'hr' | 'cadence' | 'elevation';

/** Fixed band order: pace, hr, cadence, elevation (D-17). */
export const CHANNEL_KEYS: readonly ChannelKey[] = ['pace', 'hr', 'cadence', 'elevation'];

export type XAxisMode = 'distance' | 'time';

export interface SeriesPoint {
  x: number;
  y: number;
}

/**
 * Returns `[]` when the series fails `validateStreamSeries`; otherwise
 * `pace` (always present when the series validates) plus each of
 * `hr`/`cadence`/`elevation` whose array is present and non-empty, in
 * `CHANNEL_KEYS` order.
 */
export function availableChannels(stream: CanonicalStream): ChannelKey[] {
  const validation = validateStreamSeries(stream.t, stream.d);
  if (!validation.ok) return [];

  const result: ChannelKey[] = [];
  for (const key of CHANNEL_KEYS) {
    if (key === 'pace') {
      result.push('pace');
      continue;
    }
    const arr = key === 'hr' ? stream.hr : key === 'cadence' ? stream.cadence : stream.alt;
    if (arr && arr.length > 0) result.push(key);
  }
  return result;
}

/**
 * `x` is `stream.d[i] / 1000` for `'distance'` and `stream.t[i]` for
 * `'time'`; `y` is the smoothed pace for `'pace'` (skipping null entries)
 * and the raw channel array value otherwise. Returns `null` when the
 * channel is unavailable. Points are pre-shaped as `{x, y}` so Chart.js can
 * run with `parsing: false`.
 *
 * The pace branch calls `derivePaceWithCoverage(stream)` directly — the same
 * D-16 entry point the histogram, coverage caption and split markers use —
 * so this band's series is never resolved from a window this module chooses
 * on its own (CR-03).
 */
export function buildChannelSeries(
  stream: CanonicalStream,
  channel: ChannelKey,
  xAxis: XAxisMode
): SeriesPoint[] | null {
  const available = availableChannels(stream);
  if (!available.includes(channel)) return null;

  const n = stream.t.length;
  const xs = xAxis === 'distance' ? stream.d.map((v) => v / 1000) : stream.t;

  if (channel === 'pace') {
    const paceValues = derivePaceWithCoverage(stream).paceSeries;
    const points: SeriesPoint[] = [];
    for (let i = 0; i < n; i++) {
      const y = paceValues[i];
      if (y === null) continue;
      points.push({ x: xs[i], y });
    }
    return points;
  }

  const values = channel === 'hr' ? stream.hr! : channel === 'cadence' ? stream.cadence! : stream.alt!;
  const points: SeriesPoint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    points[i] = { x: xs[i], y: values[i] };
  }
  return points;
}

// ---------------------------------------------------------------------------
// Hover geometry (feeds both the crosshair and the D-26 map marker)
// ---------------------------------------------------------------------------

/**
 * Converts a hovered x value into a cumulative-distance fraction in
 * `[0, 1]`. For `'time'`, first interpolates the cumulative distance at that
 * elapsed time; for `'distance'`, uses the value directly. Clamped, never
 * NaN.
 */
export function distanceFractionAtX(stream: CanonicalStream, xAxis: XAxisMode, x: number): number {
  const n = stream.t.length;
  if (n === 0) return 0;

  const d0 = stream.d[0];
  const totalM = stream.d[n - 1] - d0;
  if (!(totalM > 0)) return 0;

  const distanceAtX =
    xAxis === 'distance' ? x * 1000 : interpValueAtTime(stream.t, stream.d, x);

  const fraction = (distanceAtX - d0) / totalM;
  return Math.min(1, Math.max(0, fraction));
}

/**
 * Walks the polyline's cumulative planar segment lengths and linearly
 * interpolates the position at `fraction`. Kept in this module (rather than
 * in `detail-map.ts`) precisely because it is Leaflet-free and therefore
 * unit-testable under `environment: 'node'`; it is the second half of the
 * same hover-sync pipeline.
 *
 * D-26 honesty caveat: the result is interpolated along a simplified
 * `summary_polyline` by cumulative distance, because committed streams
 * carry no lat/lng — it is approximate, not GPS-matched.
 */
export function pointAtDistanceFraction(
  coords: readonly [number, number][],
  fraction: number
): [number, number] | null {
  const n = coords.length;
  if (n === 0) return null;
  if (n === 1) return [coords[0][0], coords[0][1]];

  const clamped = Math.min(1, Math.max(0, fraction));

  const segLengths: number[] = [0];
  let total = 0;
  for (let i = 1; i < n; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    total += Math.sqrt(dx * dx + dy * dy);
    segLengths.push(total);
  }

  if (!(total > 0)) return [coords[0][0], coords[0][1]];

  const target = clamped * total;
  let i = 1;
  while (i < n && segLengths[i] < target) i++;
  if (i >= n) return [coords[n - 1][0], coords[n - 1][1]];

  const segStart = segLengths[i - 1];
  const segEnd = segLengths[i];
  const segFrac = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
  const x = coords[i - 1][0] + segFrac * (coords[i][0] - coords[i - 1][0]);
  const y = coords[i - 1][1] + segFrac * (coords[i][1] - coords[i - 1][1]);
  return [x, y];
}

// ---------------------------------------------------------------------------
// Overlay persistence (D-20, mirroring theme.ts's tamper-guard)
// ---------------------------------------------------------------------------

export type OverlayConfig = Readonly<Record<ChannelKey, ChannelKey[]>>;

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = Object.freeze({
  pace: [],
  hr: [],
  cadence: [],
  elevation: [],
});

export const OVERLAY_STORAGE_KEY = 'dashboard-detail-overlays';

/** D-18. */
export const MAX_OVERLAYS_PER_BAND = 2;

/**
 * Allow-lists every band key and every overlay entry against `CHANNEL_KEYS`,
 * drops any entry equal to its own band, de-duplicates, and truncates to
 * `MAX_OVERLAYS_PER_BAND`. Validation happens on READ, not only on write (the
 * `parseThemeMode` precedent). Never throws.
 */
export function parseOverlayConfig(raw: unknown): OverlayConfig {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_OVERLAY_CONFIG;

  const rawRecord = raw as Record<string, unknown>;
  const result: Record<ChannelKey, ChannelKey[]> = {
    pace: [],
    hr: [],
    cadence: [],
    elevation: [],
  };

  for (const band of CHANNEL_KEYS) {
    const value = rawRecord[band];
    if (!Array.isArray(value)) continue;

    const seen = new Set<ChannelKey>();
    const filtered: ChannelKey[] = [];
    for (const entry of value) {
      if (typeof entry !== 'string') continue;
      if (!(CHANNEL_KEYS as readonly string[]).includes(entry)) continue;
      const channelEntry = entry as ChannelKey;
      if (channelEntry === band) continue; // no self-overlay
      if (seen.has(channelEntry)) continue; // de-duplicate
      seen.add(channelEntry);
      filtered.push(channelEntry);
      if (filtered.length >= MAX_OVERLAYS_PER_BAND) break;
    }
    result[band] = filtered;
  }

  return Object.freeze(result);
}

/**
 * Reads the persisted overlay config from `storage`, tolerating a missing
 * handle (BL-03, `storage` is `null` when `resolveStorage` could not obtain
 * one), a throwing `getItem`, a `null` result, or invalid JSON by falling
 * back to `DEFAULT_OVERLAY_CONFIG`.
 */
export function readStoredOverlayConfig(storage: WebStorage | null): OverlayConfig {
  if (!storage) return DEFAULT_OVERLAY_CONFIG;
  try {
    const raw = storage.getItem(OVERLAY_STORAGE_KEY);
    if (raw === null) return DEFAULT_OVERLAY_CONFIG;
    return parseOverlayConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_OVERLAY_CONFIG;
  }
}

/**
 * Writes `config` to `storage`, tolerating a missing handle (BL-03) and
 * swallowing a throwing `setItem` (e.g. a private-browsing quota failure)
 * without propagating.
 */
export function writeStoredOverlayConfig(
  storage: WebStorage | null,
  config: OverlayConfig
): void {
  if (!storage) return;
  try {
    storage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Swallow storage write failures — matches theme.ts's applyThemeMode precedent.
  }
}
