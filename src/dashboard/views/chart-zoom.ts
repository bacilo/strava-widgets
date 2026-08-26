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
import type { Chart, Plugin } from 'chart.js';

import {
  type ZoomScaleKey,
  type ZoomRange,
  computeFullRange,
  computeDefaultWindow,
  computeLimits,
  buildZoomPluginOptionsShape,
  withRangeSuffix,
  rangesEqual,
  isAtEarliestEdge,
  isAtLatestEdge,
  isAtFullRange,
  modifierKeyForPlatform,
  zoomHintText,
  zoomStepRange,
  panStepRange,
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
 *
 * The `as unknown as Plugin` below is a type-only cast, not a runtime
 * change: `chartjs-plugin-zoom@2.2.0` ships as CommonJS with an ambient
 * `.d.ts` that uses a bare `export default Zoom` (no `export =`) — under
 * this repo's `moduleResolution: Node16` + `esModuleInterop`, that shape
 * makes TypeScript infer the DEFAULT IMPORT's type as the whole module
 * namespace (`typeof import(...)`, missing `id`/`start`/`stop`/etc.)
 * instead of the actual `Plugin`-shaped value `export default` names.
 * Confirmed as a types-only mismatch, not a real runtime shape mismatch,
 * by reading the same `.d.ts`'s own `declare const Zoom: Plugin & {...}`
 * — the RUNTIME default export genuinely is a `Plugin`, only its inferred
 * TYPE at the import site is wrong.
 */
export const chartZoomPlugin: Plugin = zoomPlugin as unknown as Plugin;

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

  // Finding 10 (23-08 gap closure): the whole option-object shape,
  // including the settle callbacks correctly nested INSIDE `zoom`/`pan`,
  // now lives in the pure, unit-tested `buildZoomPluginOptionsShape`. This
  // adapter's exported signature stays byte-for-byte unchanged so
  // `trends-charts.ts` needs no edit.
  return buildZoomPluginOptionsShape<Chart>({
    scaleKey,
    bounds,
    modifierKey: resolveModifierKey(), // D-14 — the `navigator` read stays in this DOM layer
    onSettle,
  });
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

// =============================================================================
// What automated tests in this repo can and cannot see
// =============================================================================
//
// There is no jsdom, no headless browser and no canvas polyfill in this
// repo — `vitest.config.ts` runs with `environment: 'node'` — so no test in
// this project can construct a Chart.js instance, and therefore no test can
// exercise anything in this file. There is deliberately no
// `chart-zoom.test.ts`.
//
// Every piece of arithmetic and formatting this file depends on (D-06's
// default window, D-09's limits, D-12's zoom/pan arithmetic, D-13's label
// formatting) is unit-tested in `trends-zoom-logic.ts` /
// `trends-zoom-logic.test.ts` instead — this file is composition and DOM
// wiring only. Anyone adding computation here in the future should move it
// to the logic module rather than leaving it unreachable by any test.
//
// Three specific claims this module makes can only be settled by a real
// browser checkpoint, not by this repo's automated gate (see
// `23-VALIDATION.md`'s Manual-Only Verifications table):
//
//   1. The canvas aria-label actually updates after a BUTTON press, not
//      only after a gesture (Pitfall 3, source-verified: chart.zoom()/
//      chart.pan() never fire onZoomComplete/onPanComplete) — the row
//      "aria-label names the visible range on settle (D-13)", which asks
//      for the canvas aria-label quoted verbatim after both a gesture zoom
//      and a button zoom.
//   2. The → button reveals LATER, not earlier, data — the sign Pitfall 5
//      warns is easy to invert unnoticed — the row "All four buttons
//      operate with no pointing device at all (D-11)", which asks for each
//      button's aria-label and the x-range change it produced to be quoted,
//      not just "the chart moved."
//   3. The Cadence & HR pair stays in lockstep across a settle originating
//      on either chart (D-02's sibling-sync requirement, implemented in
//      this file's settle()). No 23-VALIDATION.md row is quoted verbatim
//      here because the pair itself is wired together by plan 23-05, which
//      is where that checkpoint row belongs — this module only supplies the
//      sync mechanism the later checkpoint will exercise.
//
// No test file was added for this module. A test that imports it would
// either fail to construct a chart (no canvas polyfill) or assert nothing
// meaningful about its DOM wiring — this project has been burned three
// times before (16-09, 17-15, 19-05) by tests that assert a shape
// production does not have.
