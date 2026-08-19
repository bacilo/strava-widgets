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
  ZOOM_FACTOR,
  computeFullRange,
  computeDefaultWindow,
  computeLimits,
  panDeltaPx,
  withRangeSuffix,
  rangesEqual,
  isAtEarliestEdge,
  isAtLatestEdge,
  isAtFullRange,
  modifierKeyForPlatform,
  zoomHintText,
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

// ---------------------------------------------------------------------------
// D-10/D-11/D-17 — the on-screen control cluster
// ---------------------------------------------------------------------------

/** One chart this controller drives, plus the aria-label base text D-13's range suffix is appended to. */
export interface ZoomMember {
  chart: Chart;
  canvas: HTMLCanvasElement;
  ariaBase: string;
}

/** The five action buttons plus the persistent hint, as built by `buildZoomControlCluster`. */
export interface ZoomControlCluster {
  root: HTMLElement;
  hint: HTMLElement;
  panEarlier: HTMLButtonElement;
  panLater: HTMLButtonElement;
  zoomOut: HTMLButtonElement;
  zoomIn: HTMLButtonElement;
  reset: HTMLButtonElement;
}

/**
 * Builds the D-10/D-11/D-17 control cluster: a `role="group"` `<div>`
 * appended to `header` as its SECOND child (the caller's title span is
 * always the first), holding, in order, the D-17 persistent modifier hint
 * and five plain `<button type="button">` elements with no class of their
 * own — Phase 19's bare button baseline already supplies hover, disabled
 * and focus-ring treatment, and this codebase has zero precedent for any
 * other control-construction idiom (`document.createElement('button')` +
 * `btn.type = 'button'` + `addEventListener('click', ...)`, e.g.
 * `trends.ts`'s TRIMP-model and training-load-window buttons).
 *
 * These are ACTION buttons, not toggles, so none of them carry the
 * toggle-only pressed-state attribute — that attribute is reserved for the
 * `.segmented` option buttons elsewhere in this codebase. Reset starts
 * `hidden`: D-11 says it
 * materialises only once the view differs from its D-06 default, and its
 * mere presence doubles as the only visible signal that the chart is
 * zoomed at all, since D-07's y-axis rescale means a zoomed chart does not
 * obviously look zoomed.
 */
export function buildZoomControlCluster(header: HTMLElement, groupLabel: string): ZoomControlCluster {
  const root = document.createElement('div');
  root.className = 'chart-zoom-controls';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', groupLabel);

  const hint = document.createElement('span');
  hint.className = 'chart-zoom-hint';
  hint.textContent = zoomHintText(resolveModifierKey());
  root.appendChild(hint);

  function makeButton(text: string, ariaLabel: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.setAttribute('aria-label', ariaLabel);
    root.appendChild(btn);
    return btn;
  }

  const panEarlier = makeButton('←', 'Pan to earlier dates');
  const panLater = makeButton('→', 'Pan to later dates');
  const zoomOut = makeButton('−', 'Zoom out');
  const zoomIn = makeButton('+', 'Zoom in');
  const reset = makeButton('Reset', 'Reset to the default view');
  reset.hidden = true;

  header.appendChild(root);

  return { root, hint, panEarlier, panLater, zoomOut, zoomIn, reset };
}

/**
 * D-15's grab/grabbing cursor signal. Sets the canvas cursor to `'grab'`
 * immediately, swaps it to `'grabbing'` for the duration of a pointer-down
 * drag, and restores `'grab'` on pointer-up/cancel/leave. Returns a detach
 * function that removes all four listeners, used by
 * `attachZoomController.destroy()`. D-15's cursor requirement is a
 * checkpoint row, so this must be real DOM wiring, not an assumed CSS-only
 * treatment.
 */
export function applyGrabCursor(canvas: HTMLCanvasElement): () => void {
  canvas.style.cursor = 'grab';
  const onDown = () => {
    canvas.style.cursor = 'grabbing';
  };
  const onUp = () => {
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onUp);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onUp);
  };
}

// ---------------------------------------------------------------------------
// D-02/D-11/D-13 — the settle-driven controller
// ---------------------------------------------------------------------------

/** The handle `attachZoomController` returns — `settle`/`applyRange` are also called internally by the button handlers it wires. */
export interface ZoomController {
  settle(source?: Chart): void;
  applyRange(range: ZoomRange): void;
  currentRange(): ZoomRange | null;
  destroy(): void;
}

/**
 * Wires the D-10 control cluster, the D-15 grab cursor and the D-11/D-13
 * settle updater onto one or more charts sharing the same x-scale bounds.
 * `members.length` is 1 for Volume/Training Load and 2 for the Cadence &
 * HR stacked pair (D-02) — all five buttons always act on `members[0]`'s
 * chart, and `settle` propagates the resulting range to every other
 * member so the pair can never drift out of alignment while still looking
 * aligned.
 */
export function attachZoomController(args: {
  members: readonly ZoomMember[];
  header: HTMLElement;
  scaleKey: ZoomScaleKey;
  bounds: ZoomRange;
  groupLabel: string;
  onRangeChange?: (range: ZoomRange) => void;
}): ZoomController {
  const { members, header, scaleKey, bounds, groupLabel, onRangeChange } = args;

  const full = computeFullRange(scaleKey, bounds);
  const defaultWindow = computeDefaultWindow(scaleKey, bounds);

  const cluster = buildZoomControlCluster(header, groupLabel);
  const cursorDetachers = members.map((member) => applyGrabCursor(member.canvas));

  /**
   * Reads the currently rendered range off `members[0]`'s live Chart.js
   * scale — the single source of truth for the rendered range. No
   * parallel cache is kept.
   */
  function currentRange(): ZoomRange | null {
    const primary = members[0];
    if (!primary) return null;
    const scale = primary.chart.scales.x;
    if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return null;
    return { min: scale.min, max: scale.max };
  }

  /**
   * Writes `range` directly onto every member's `scales.x.min`/`.max` and
   * calls `chart.update('none')`. Deliberately bypasses the plugin's own
   * zoom/pan API: this is only ever called with a range this module
   * computed (the D-06 default, a D-03 preset, or a D-22 restore), all of
   * which are inside `limits` by construction. Going through the plugin's
   * API instead would make Reset depend on the plugin's own internal
   * `originalScaleLimits` bookkeeping, which under D-22 may have been
   * captured from a RESTORED window rather than the default one.
   */
  function applyRange(range: ZoomRange): void {
    for (const member of members) {
      const xOptions = member.chart.options.scales?.x;
      if (!xOptions) continue;
      xOptions.min = range.min;
      xOptions.max = range.max;
      member.chart.update('none');
    }
  }

  /**
   * The single update path, called from both the gesture callbacks
   * (`onZoomComplete`/`onPanComplete` in `buildZoomPluginOptions`) and
   * every button handler below (Pitfall 3).
   */
  function settle(source?: Chart): void {
    const sourceChart = source ?? members[0]?.chart;
    if (!sourceChart) return;
    const sourceScale = sourceChart.scales.x;
    if (!sourceScale || !Number.isFinite(sourceScale.min) || !Number.isFinite(sourceScale.max)) return;
    const current: ZoomRange = { min: sourceScale.min, max: sourceScale.max };

    // D-02 sync: for every OTHER member, write the same min/max and call
    // update('none'). This cannot recurse — writing scale options plus
    // update('none') fires no zoom/pan callback — and is what stops the
    // stacked Cadence & HR pair from drifting out of alignment while
    // still looking aligned, which would mean comparing cadence in one
    // year against heart rate in another.
    for (const member of members) {
      if (member.chart === sourceChart) continue;
      const xOptions = member.chart.options.scales?.x;
      if (!xOptions) continue;
      xOptions.min = current.min;
      xOptions.max = current.max;
      member.chart.update('none');
    }

    // D-13: rewrite every member's aria-label to name the visible range,
    // extending the existing aria-label mechanism.
    for (const member of members) {
      member.canvas.setAttribute('aria-label', withRangeSuffix(member.ariaBase, current.min, current.max));
    }

    // D-11 button state.
    cluster.reset.hidden = rangesEqual(current, defaultWindow);
    cluster.panEarlier.disabled = isAtEarliestEdge(current, full);
    cluster.panLater.disabled = isAtLatestEdge(current, full);
    cluster.zoomOut.disabled = isAtFullRange(current, full);
    // zoomIn is left always enabled — the plugin's own minRange clamps
    // it, and disabling it here would need a second floor definition
    // that could disagree with `limits`.

    // D-22's save hook — the only place this module writes the caller's
    // closure state.
    onRangeChange?.(current);
  }

  // Pitfall 3: every handler below calls settle() DIRECTLY, never relying
  // on onZoomComplete/onPanComplete alone, because chart.zoom()/chart.pan()
  // do not fire those callbacks. Omitting the direct call here would
  // reproduce exactly the defect this repo's DOM-less test suite cannot
  // see: the chart visibly moves, but the aria-label and Reset button
  // never update.
  cluster.zoomIn.addEventListener('click', () => {
    const chart = members[0]?.chart;
    if (!chart) return;
    chart.zoom(ZOOM_FACTOR);
    settle();
  });
  cluster.zoomOut.addEventListener('click', () => {
    const chart = members[0]?.chart;
    if (!chart) return;
    chart.zoom(1 / ZOOM_FACTOR);
    settle();
  });
  cluster.panEarlier.addEventListener('click', () => {
    const chart = members[0]?.chart;
    if (!chart) return;
    const deltaPx = panDeltaPx(chart.chartArea.right - chart.chartArea.left, 'earlier');
    chart.pan({ x: deltaPx });
    settle();
  });
  cluster.panLater.addEventListener('click', () => {
    const chart = members[0]?.chart;
    if (!chart) return;
    const deltaPx = panDeltaPx(chart.chartArea.right - chart.chartArea.left, 'later');
    chart.pan({ x: deltaPx });
    settle();
  });
  cluster.reset.addEventListener('click', () => {
    // Reset returns to the granularity's D-06 default window, NOT to full
    // zoom-out, and NOT via chart.resetZoom(): under D-22 a rebuilt chart
    // may have been constructed at a restored window, and resetZoom()
    // would return to THAT instead of the designed opening picture.
    applyRange(defaultWindow);
    settle();
  });

  // Settle once before returning, so the initial button states and the
  // initial range-suffixed aria-label are correct from first paint rather
  // than only after the first interaction.
  settle();

  function destroy(): void {
    // Does NOT destroy any chart — the caller's existing
    // ChartHandle.destroy() owns that, and chart.destroy() alone already
    // tears the plugin and its Hammer manager down through the plugin's
    // own `stop` hook (verified in both packages' source).
    cluster.root.remove();
    for (const detach of cursorDetachers) detach();
  }

  return { settle, applyRange, currentRange, destroy };
}

// Note on D-08: CONTEXT.md's D-08 is a numbering pointer ("D-08 is under
// Controls below") with no independent content of its own — the control-
// cluster decisions it forwards to are D-10 through D-13, all implemented
// above. Recorded here so a reviewer does not read D-08 as an
// unimplemented decision.
