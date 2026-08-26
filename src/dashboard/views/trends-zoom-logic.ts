/**
 * Pure, DOM-free logic behind the Trends page's zoom/pan/taller-bands
 * feature (TRN-01/TRN-02/TRN-04, D-06/D-09/D-12/D-13/D-14/D-22). Computes
 * each zoomable scale's D-06 default opening window and D-09 pan/zoom
 * limits as literal numeric bounds over the series' own archive bounds,
 * D-12's zoom-step/pan-step range arithmetic, D-13's range-to-label
 * formatting, D-14's cross-platform wheel-modifier-key resolution, and
 * D-22's restore-or-default state shape shared by first-open and
 * restore-on-rebuild.
 *
 * This module reads no clock, no DOM, no `localStorage`, no
 * `sessionStorage` and no URL query string (D-24) — every "now" this
 * module needs is the series' own last data point, never `Date.now()` or
 * `new Date()`, which is what makes every function here deterministic
 * under vitest's `environment: 'node'` (no jsdom, no canvas polyfill —
 * Chart.js itself cannot be constructed in a test in this repo).
 */

import type { VolumeGranularity } from './trends-volume-logic.js';
import type { LoadWindow } from './trends-training-load-logic.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ZoomScaleKey = 'volume-weekly' | 'volume-monthly' | 'volume-yearly' | 'cadence-hr' | 'training-load';

export interface ZoomRange {
  min: number;
  max: number;
}

// ---------------------------------------------------------------------------
// D-12 — zoom factor and pan fraction, shared by the button handlers
// (23-04, rewired to pure range math in 23-08's gap closure) and this
// module's own zoomStepRange/panStepRange arithmetic below.
// ---------------------------------------------------------------------------

export const ZOOM_FACTOR = 1.5;
export const PAN_FRACTION = 0.25;

// ---------------------------------------------------------------------------
// Per-scale constant tables (D-06 default span, D-09 zoom-in floor, and each
// scale's nominal period used to pad `computeFullRange`'s edges by half a
// period so the first/last bar is never clipped in half).
// ---------------------------------------------------------------------------

const PERIOD_MS: Readonly<Record<ZoomScaleKey, number>> = {
  'volume-weekly': 604800000, // 7 days
  'volume-monthly': 2629800000, // 30.4375 days
  'volume-yearly': 31557600000, // 365.25 days
  'cadence-hr': 2629800000, // 30.4375 days
  'training-load': 86400000, // 1 day
};

const DEFAULT_SPAN_MS: Readonly<Record<ZoomScaleKey, number | null>> = {
  'volume-weekly': 31536000000, // ~12 months
  'volume-monthly': 157788000000, // ~5 years
  'volume-yearly': null, // everything — yearly opens on the full range
  'cadence-hr': 157788000000, // ~5 years
  'training-load': 31536000000, // ~12 months
};

const MIN_RANGE_MS: Readonly<Record<ZoomScaleKey, number>> = {
  'volume-weekly': 4838400000, // 8 weeks
  'volume-monthly': 15778800000, // ~6 months
  'volume-yearly': 94672800000, // ~3 years
  'cadence-hr': 15778800000, // ~6 months
  'training-load': 604800000, // 7 days
};

const LOAD_WINDOW_SPAN_MS: Readonly<Record<LoadWindow, number | null>> = {
  '3mo': 7776000000,
  '12mo': 31536000000,
  all: null,
};

// ---------------------------------------------------------------------------
// Scale-key mapping and archive bounds
// ---------------------------------------------------------------------------

/** Maps the Volume tab's granularity toggle to its own zoomable scale key. */
export function volumeScaleKey(granularity: VolumeGranularity): ZoomScaleKey {
  switch (granularity) {
    case 'weekly':
      return 'volume-weekly';
    case 'monthly':
      return 'volume-monthly';
    case 'yearly':
      return 'volume-yearly';
  }
}

/**
 * The archive-wide min/max over a series' own x values. Returns `null` for
 * an empty input or one whose entries are all non-finite; otherwise returns
 * `{min, max}` over the finite entries only, silently ignoring any
 * non-finite entry rather than letting it poison the whole result.
 */
export function computeArchiveBounds(xs: readonly number[]): ZoomRange | null {
  let min = Infinity;
  let max = -Infinity;
  let found = false;

  for (const x of xs) {
    if (!Number.isFinite(x)) continue;
    found = true;
    if (x < min) min = x;
    if (x > max) max = x;
  }

  return found ? { min, max } : null;
}

// ---------------------------------------------------------------------------
// D-06 default window, D-09 limits
// ---------------------------------------------------------------------------

/**
 * The full pan/zoom-out range for a scale: the archive bounds padded by
 * half the scale's nominal period on each side, so the first and last bar
 * are never clipped in half at the scale edges. This is also the single
 * well-defined target for full zoom-out and the Reset control.
 */
export function computeFullRange(key: ZoomScaleKey, bounds: ZoomRange): ZoomRange {
  const halfPeriod = PERIOD_MS[key] / 2;
  return { min: bounds.min - halfPeriod, max: bounds.max + halfPeriod };
}

/**
 * D-06's opening picture: each granularity/scale opens on a readable
 * default window expressed as zoom state over the full dataset, never a
 * dataset slice. When the scale's `DEFAULT_SPAN_MS` is `null` (yearly —
 * opens on everything), this equals `computeFullRange` exactly. Otherwise
 * it is the trailing `DEFAULT_SPAN_MS` window ending at the full range's
 * max, never wider than the full range itself.
 */
export function computeDefaultWindow(key: ZoomScaleKey, bounds: ZoomRange): ZoomRange {
  const full = computeFullRange(key, bounds);
  const span = DEFAULT_SPAN_MS[key];
  if (span === null) return full;
  return { min: Math.max(full.min, full.max - span), max: full.max };
}

/**
 * D-09's pan/zoom-out clamp, expressed as LITERAL NUMBERS. Never emit the
 * plugin's `'original'` sentinel string from this module — under D-06 the
 * scale is constructed at the default window, so `'original'` would
 * resolve to that window and hard-stop pan/zoom-out there, making "zoom out
 * to see everything" impossible (Pitfall 1). `min`/`max` always equal
 * `computeFullRange`'s own `min`/`max` for the same key and bounds.
 */
export function computeLimits(key: ZoomScaleKey, bounds: ZoomRange): { min: number; max: number; minRange: number } {
  const full = computeFullRange(key, bounds);
  return { min: full.min, max: full.max, minRange: MIN_RANGE_MS[key] };
}

/**
 * D-03's training-load window presets, expressed as a zoom RANGE over the
 * always-full series — never a dataset slice. `'all'` equals
 * `computeFullRange('training-load', bounds)` exactly; `'3mo'`/`'12mo'`
 * return the trailing window of that length ending at the full range's max.
 */
export function loadWindowRange(window: LoadWindow, bounds: ZoomRange): ZoomRange {
  const full = computeFullRange('training-load', bounds);
  const span = LOAD_WINDOW_SPAN_MS[window];
  if (span === null) return full;
  return { min: Math.max(full.min, full.max - span), max: full.max };
}

// ---------------------------------------------------------------------------
// D-12 — zoom/pan arithmetic
//
// Both functions below work entirely in VALUE space (epoch-ms bounds), not
// pixel space. The button handlers in `chart-zoom.ts` no longer hand a
// pixel delta or a zoom factor to the plugin's imperative `chart.zoom()` /
// `chart.pan()` API at all (Finding 1, 23-08 gap-closure): the plugin's own
// `linearZoomDelta` computes `newRange = range * (zoom - 1)` and REMOVES
// that much, so passing `ZOOM_FACTOR` (1.5) directly halved the window
// instead of dividing it by 1.5, and `chart.pan()`'s `panNumericalScale`
// re-derives its delta through `scale.getPixelForValue` /
// `scale.getValueForPixel` rather than through the plot width the caller
// measured, producing a step of roughly 33% of the visible span instead of
// this module's own `PAN_FRACTION` (25%). `zoomStepRange` and
// `panStepRange` are the pure replacement: the runtime now computes a
// target range here and writes it straight onto the scale via `applyRange`,
// so the step magnitude the tests below assert is the step magnitude the
// browser renders.
// ---------------------------------------------------------------------------

/**
 * Centre-preserving proportional zoom. Computes the current span and
 * centre, targets `span / ZOOM_FACTOR` ('in') or `span * ZOOM_FACTOR`
 * ('out'), clamps that target span into `[minRangeMs, full.max - full.min]`,
 * lays it symmetrically around the unchanged centre, then TRANSLATES
 * (never re-scales) the result back inside `full`: shift left if the new
 * max would exceed `full.max`, then shift right if the new min would then
 * fall below `full.min`, and finally hard-clamp each bound to `full`.
 *
 * Returns `current` unchanged, without throwing, when any of `current.min`,
 * `current.max`, `full.min`, `full.max` or `minRangeMs` is non-finite, or
 * when `current.max <= current.min`.
 */
export function zoomStepRange(current: ZoomRange, full: ZoomRange, minRangeMs: number, direction: 'in' | 'out'): ZoomRange {
  if (
    !Number.isFinite(current.min) ||
    !Number.isFinite(current.max) ||
    !Number.isFinite(full.min) ||
    !Number.isFinite(full.max) ||
    !Number.isFinite(minRangeMs) ||
    current.max <= current.min
  ) {
    return current;
  }

  const span = current.max - current.min;
  const centre = (current.min + current.max) / 2;
  const fullSpan = full.max - full.min;
  const rawTargetSpan = direction === 'in' ? span / ZOOM_FACTOR : span * ZOOM_FACTOR;
  const targetSpan = Math.min(Math.max(rawTargetSpan, minRangeMs), fullSpan);

  let min = centre - targetSpan / 2;
  let max = centre + targetSpan / 2;

  if (max > full.max) {
    const overshoot = max - full.max;
    min -= overshoot;
    max -= overshoot;
  }
  if (min < full.min) {
    const undershoot = full.min - min;
    min += undershoot;
    max += undershoot;
  }

  return { min: Math.max(min, full.min), max: Math.min(max, full.max) };
}

/**
 * Span-preserving proportional pan. Computes `delta = PAN_FRACTION * span`,
 * signed negative for `'earlier'` (smaller epoch-ms — the retired pixel-space
 * handler's drag-right convention made `'earlier'` positive; this function
 * works in value space, where earlier genuinely means smaller, so
 * `'earlier'` subtracts) and positive for `'later'`. Adds the signed
 * delta to both bounds, then translates the pair back inside `full` the
 * same way `zoomStepRange` does (shift, never shrink), so the span is
 * preserved exactly whenever `span <= full.max - full.min`.
 *
 * Returns `current` unchanged, without throwing, when any of `current.min`,
 * `current.max`, `full.min` or `full.max` is non-finite, or when
 * `current.max <= current.min`.
 */
export function panStepRange(current: ZoomRange, full: ZoomRange, direction: 'earlier' | 'later'): ZoomRange {
  if (
    !Number.isFinite(current.min) ||
    !Number.isFinite(current.max) ||
    !Number.isFinite(full.min) ||
    !Number.isFinite(full.max) ||
    current.max <= current.min
  ) {
    return current;
  }

  const span = current.max - current.min;
  const delta = PAN_FRACTION * span * (direction === 'earlier' ? -1 : 1);

  let min = current.min + delta;
  let max = current.max + delta;

  if (max > full.max) {
    const overshoot = max - full.max;
    min -= overshoot;
    max -= overshoot;
  }
  if (min < full.min) {
    const undershoot = full.min - min;
    min += undershoot;
    max += undershoot;
  }

  return { min: Math.max(min, full.min), max: Math.min(max, full.max) };
}

// ---------------------------------------------------------------------------
// D-13 — range label formatting
// ---------------------------------------------------------------------------

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an epoch-ms pair as `"MMM yyyy to MMM yyyy"` in UTC. Returns the
 * empty string when either argument is non-finite, so callers (see
 * `withRangeSuffix`) can detect "no label" without a separate check.
 */
export function formatRangeLabel(minMs: number, maxMs: number): string {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return '';
  const minDate = new Date(minMs);
  const maxDate = new Date(maxMs);
  const minLabel = `${MONTH_ABBR[minDate.getUTCMonth()]} ${minDate.getUTCFullYear()}`;
  const maxLabel = `${MONTH_ABBR[maxDate.getUTCMonth()]} ${maxDate.getUTCFullYear()}`;
  return `${minLabel} to ${maxLabel}`;
}

/**
 * D-13's composition point: extends the existing `VOLUME_ARIA_LABELS`
 * mechanism (`trends-charts.ts`) rather than inventing a second one.
 * Returns `base` unchanged when `formatRangeLabel` returns empty (no valid
 * range to append); otherwise `"${base}, ${label}"`.
 */
export function withRangeSuffix(base: string, minMs: number, maxMs: number): string {
  const label = formatRangeLabel(minMs, maxMs);
  return label === '' ? base : `${base}, ${label}`;
}

// ---------------------------------------------------------------------------
// D-22 — restore-or-default state shape
// ---------------------------------------------------------------------------

/**
 * D-22's single code path shared by first-open and restore-on-rebuild:
 * returns `fallback` when `saved` is `null`, when either of its bounds is
 * non-finite, or when `saved.min >= saved.max` (a malformed/degenerate
 * saved range); otherwise returns `saved` unchanged.
 */
export function restoreOrDefault(saved: ZoomRange | null, fallback: ZoomRange): ZoomRange {
  if (saved === null) return fallback;
  if (!Number.isFinite(saved.min) || !Number.isFinite(saved.max)) return fallback;
  if (saved.min >= saved.max) return fallback;
  return saved;
}

/**
 * True when both bounds match within 1 ms. D-11 uses this to decide
 * whether the Reset control is showing: Reset appears exactly when the
 * live range differs from the D-06 default window.
 */
export function rangesEqual(a: ZoomRange, b: ZoomRange): boolean {
  return Math.abs(a.min - b.min) <= 1 && Math.abs(a.max - b.max) <= 1;
}

// ---------------------------------------------------------------------------
// D-11 — button-disable predicates. A 1 ms tolerance absorbs floating-point
// pixel round-tripping through the scale so a button cannot be left
// permanently enabled at its own clamp.
// ---------------------------------------------------------------------------

export function isAtEarliestEdge(current: ZoomRange, full: ZoomRange): boolean {
  return current.min <= full.min + 1;
}

export function isAtLatestEdge(current: ZoomRange, full: ZoomRange): boolean {
  return current.max >= full.max - 1;
}

export function isAtFullRange(current: ZoomRange, full: ZoomRange): boolean {
  return isAtEarliestEdge(current, full) && isAtLatestEdge(current, full);
}

// ---------------------------------------------------------------------------
// D-14 — cross-platform wheel-modifier-key resolution
// ---------------------------------------------------------------------------

/**
 * Maps a platform string to `'meta'` on macOS and `'ctrl'` elsewhere.
 * `zoom.wheel.modifierKey` accepts exactly one key (Pitfall 2), so D-14's
 * "⌘/Ctrl + scroll" genuinely requires this resolution rather than a
 * single hard-coded value. Takes the platform string as an argument — the
 * `navigator` read itself stays in the DOM layer (plan 23-04) so this
 * function stays testable under vitest's `environment: 'node'`.
 */
export function modifierKeyForPlatform(platform: string): 'meta' | 'ctrl' {
  return /mac/i.test(platform) ? 'meta' : 'ctrl';
}

/**
 * D-17's persistent hint copy naming the resolved modifier. Names "pinch"
 * too, covering the touch case where no modifier key exists at all.
 */
export function zoomHintText(modifier: 'meta' | 'ctrl'): string {
  return modifier === 'meta'
    ? '⌘ + scroll to zoom · drag or pinch to pan'
    : 'Ctrl + scroll to zoom · drag or pinch to pan';
}
