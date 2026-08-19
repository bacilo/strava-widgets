/**
 * D-04's single shared home for every piece of Trends' zoom/pan wiring:
 * per-chart plugin configuration, the on-screen +/-/<-/->/Reset control
 * cluster, the persistent modifier-key hint, and the settle updater that
 * keeps the aria-label and the button states honest after every zoom/pan.
 * `trends-charts.ts` imports this module today; a future phase's
 * `detail-charts.ts` could import the exact same contract to adopt zoom on
 * the activity detail view without copying anything out of this file.
 *
 * Unlike `chart-theme.ts` (which deliberately imports no charting library so
 * it stays safe to import from non-lazy code), this module DOES import a
 * charting dependency — `chartjs-plugin-zoom`, which in turn pulls in
 * `hammerjs` — so it must NEVER be imported from `trends.ts` or any other
 * module reachable from the dashboard's main, non-lazy bundle. It is only
 * ever imported from `trends-charts.ts`, a module already behind the
 * `await import('./trends-charts.js')` lazy-chunk boundary. Naming this
 * constraint here, explicitly, is what stops a later change from importing
 * this module from `trends.ts` and dragging Chart.js and Hammer into the
 * main bundle.
 *
 * Hammer.js is on the critical path for ALL panning implemented here,
 * including plain desktop mouse drag — not only touch and pinch. D-16's own
 * text describes Hammer as scoped to touch/pinch; research verified against
 * `chartjs-plugin-zoom@2.2.0`'s shipped source that `pan.enabled` (D-15's
 * drag-to-pan) is wired through `Hammer.Manager`/`Hammer.Pan` regardless of
 * pointer type. The dependency decision (D-16) stands; only its stated scope
 * was too narrow. Nothing in this module may assume Hammer could later be
 * loaded only on touch devices.
 */

import zoomPlugin from 'chartjs-plugin-zoom';
import type { Chart } from 'chart.js';

import {
  type ZoomScaleKey,
  type ZoomRange,
  computeLimits,
  modifierKeyForPlatform,
} from './trends-zoom-logic.js';

// ---------------------------------------------------------------------------
// D-05 — the plugin, exported for per-instance `plugins: [...]` arrays ONLY.
// ---------------------------------------------------------------------------

/**
 * `chartjs-plugin-zoom`'s default export, re-exported for use in a chart's
 * own `plugins: [...]` array — NEVER add this to `trends-charts.ts`'s
 * module-wide `Chart.register(...)` call (currently at that file's own
 * registration block). D-05 requires per-instance registration: because
 * Year-over-Year and Gear never construct a chart carrying this plugin, they
 * are structurally incapable of zooming (D-01) rather than relying on an
 * opt-out flag a future chart could forget to set, and a plugin holding
 * per-canvas state stays off the global registry — the exact shape of the
 * "Canvas is already in use" defect class TRN-04 names. Per-instance
 * plugins receive the identical `start`/`stop` lifecycle as a
 * globally-registered one (verified against Chart.js core's plugin
 * service), so `chart.destroy()` alone is sufficient teardown; no extra
 * code is needed to tear the plugin or its Hammer manager down.
 */
export const chartZoomPlugin = zoomPlugin;

// ---------------------------------------------------------------------------
// D-14 — cross-platform wheel-modifier-key resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the current platform to `'meta'` (macOS) or `'ctrl'` (everywhere
 * else) for `zoom.wheel.modifierKey`, which accepts exactly one key — a bare
 * wheel event still scrolls the page rather than zooming. Reads, in order,
 * `navigator.userAgentData?.platform`, then the deprecated-but-functional
 * `navigator.platform`, then falls back to the empty string (which
 * `modifierKeyForPlatform` resolves to `'ctrl'`, the non-Mac default). The
 * `navigator` read stays here, in the DOM layer, while the actual mac/other
 * decision lives in the pure, unit-tested `modifierKeyForPlatform` — this
 * codebase has zero prior platform-detection precedent, so this function
 * itself is genuinely new code with nothing to copy from an existing file.
 */
export function resolveModifierKey(): 'meta' | 'ctrl' {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  return modifierKeyForPlatform(platform);
}

// ---------------------------------------------------------------------------
// D-07/D-09/D-14/D-15/D-16 — the `options.plugins.zoom` config builder
// ---------------------------------------------------------------------------

/**
 * Builds the object that goes at a zoomable chart's `options.plugins.zoom`.
 * X-only zoom/pan (D-07 — the y-axis is never zoomed and rescales to the
 * visible window on every settle), literal numeric limits (D-09), a
 * platform-resolved wheel modifier (D-14), pinch enabled and `zoom.drag`
 * disabled (D-15/D-16).
 */
export function buildZoomPluginOptions(args: {
  scaleKey: ZoomScaleKey;
  bounds: ZoomRange;
  onSettle: (chart: Chart) => void;
}): Record<string, unknown> {
  const { scaleKey, bounds, onSettle } = args;

  return {
    limits: {
      // D-09: literal computed numbers ONLY — the plugin's `'original'`
      // sentinel string must never appear here. Under D-06 the scale is
      // constructed at the granularity's opening window, not the archive,
      // so `'original'` would capture THAT window on first zoom/pan and
      // hard-stop pan/zoom-out there, making D-06's own promise ("zoom out
      // to see everything stays literally true") false (Pitfall 1,
      // verified against chartjs-plugin-zoom@2.2.0's `getLimit`/
      // `storeOriginalScaleLimits`, which capture 'original' lazily from
      // whatever `scale.options.min/max` happen to be at the first
      // zoom/pan call).
      x: computeLimits(scaleKey, bounds),
    },
    pan: {
      enabled: true, // D-15
      mode: 'x', // D-07
    },
    zoom: {
      wheel: { enabled: true, modifierKey: resolveModifierKey() }, // D-14
      pinch: { enabled: true }, // D-16
      // `zoom.drag` (rectangle-select-zoom, wired on native mouse
      // listeners) and `pan` (Hammer.Pan) are two independent gesture
      // engines that would fight over the same physical canvas drag if
      // both were enabled at once. D-15 wants plain drag-to-pan, so
      // `zoom.drag.enabled` MUST stay false (Pitfall 4).
      drag: { enabled: false },
      mode: 'x', // D-07
    },
    // Pitfall 3 (source-verified against chartjs-plugin-zoom@2.2.0's
    // shipped `zoom()`/`pan()` functions): `chart.zoom()` and `chart.pan()`
    // — the exact imperative API the D-11 buttons call — fire `onZoom`/
    // `onPan` ONLY, never `onZoomComplete`/`onPanComplete`. These two
    // callbacks below are wired to the GESTURE half of the settle
    // contract only (250ms-debounced wheel, drag `mouseup`, Hammer
    // `panend`/`pinchend`). Every button handler in
    // `attachZoomController` (Task 2, below) must call the same settle
    // function DIRECTLY, right after its imperative `chart.zoom()`/
    // `chart.pan()` call, or the buttons will visibly move the chart
    // while the aria-label and Reset button silently never update — a
    // defect this repo's DOM-less test suite structurally cannot see. Do
    // not let this comment drift from `attachZoomController`'s button
    // handlers.
    onZoomComplete: ({ chart }: { chart: Chart }) => onSettle(chart),
    onPanComplete: ({ chart }: { chart: Chart }) => onSettle(chart),
  };
}
