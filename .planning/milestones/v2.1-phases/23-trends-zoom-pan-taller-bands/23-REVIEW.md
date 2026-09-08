---
phase: 23-trends-zoom-pan-taller-bands
reviewed: 2026-08-27T10:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/chart-zoom.ts
  - src/dashboard/views/trends-charts.ts
  - src/dashboard/views/trends-tick-format.ts
  - src/dashboard/views/trends-tick-format.test.ts
  - src/dashboard/views/trends-training-load-logic.ts
  - src/dashboard/views/trends-training-load-logic.test.ts
  - src/dashboard/views/trends-zoom-logic.ts
  - src/dashboard/views/trends-zoom-logic.test.ts
  - src/dashboard/views/trends.ts
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
critical_resolved: 1
resolved_commits:
  - 49add71  # CR-01 — archive bounds threaded to the Cadence & HR zoom plugin
---

# Phase 23: Code Review Report

**Reviewed:** 2026-08-27T10:00:00Z
**Depth:** standard (per-file analysis, cross-checked against `chartjs-plugin-zoom@2.2.0`'s shipped source and `23-VALIDATION.md`'s recorded observations)
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Diff base for this review: `30b334a` (last commit before `c002025`, "feat(23-01): install chartjs-plugin-zoom and hammerjs") → `HEAD`. That is Phase 23's true source span; the earlier `61ee687` pointer used in `deferred-items.md` also drags in Phases 19–22.

The teardown discipline this phase was asked about is genuinely correct. All four `ChartHandle.destroy()` implementations (`trends-charts.ts:260`, `347`, `463`, `733`, `914`, `1018`, `1118`) are idempotent via a `destroyed` flag, and every one of them calls `controller?.destroy()` **before** `chart.destroy()`, in the order the plan claims. `applyGrabCursor`'s four pointer listeners are all removed by the returned detacher (`chart-zoom.ts:233-238`), which `attachZoomController.destroy()` runs (`chart-zoom.ts:421`); `observeCanvasResize`'s `ResizeObserver` is disconnected on every path including both empty-series branches. I found no listener or observer added without matching teardown. The Finding 10 nesting fix is correctly wired: `buildZoomPluginOptionsShape` puts `onZoomComplete` inside `zoom` and `onPanComplete` inside `pan` (`trends-zoom-logic.ts:198`, `210`), and `trends-zoom-logic.test.ts:449-463` pins that against the vendored plugin's own lookup path. Zoom-range closure state in `trends.ts` is not leaked across mount/unmount — all three slots are nulled in `unmount()` (`trends.ts:1316-1318`) and `volumeZoomRange` is correctly cleared on granularity change (`trends.ts:668`). No injection, XSS, secret, `eval`, or `innerHTML` exposure exists anywhere in the changed surface; every athlete-derived string still goes through `textContent`.

What the phase did **not** get right is one asymmetric argument at the Cadence & HR call site that hands the zoom plugin the *opening window* where every other call site hands it the *archive bounds*. This is the exact Pitfall-1 failure mode `trends-zoom-logic.ts:146-152` was written to prevent, reached by a different route than the `'original'` sentinel it guards against. It is not speculative: `23-VALIDATION.md` R36(b) records the symptom verbatim and the row passed anyway because it asserted only that the two bands agreed with each other.

The remaining findings are state-consistency and test-strength defects. Finding 12, the `.trends-tablist-scroll` chunk location, the box-shadow focus indicator, and the `→`-disabled-at-default behaviour are all treated as already-dispositioned and are not re-raised.

## Critical Issues

> **RESOLVED 2026-08-27 — commit `49add71`.** Confirmed independently before fixing:
> `:712` builds `initial` from `computeDefaultWindow`/`restoreOrDefault` (the opening
> window), and `buildChannelBand`'s parameter type at `:593` never carried the archive
> bounds, so they were not in scope at `:647`. Fix threads `bounds` through
> `buildChannelBand` alongside `initial` and passes it at the call site, matching what
> `attachZoomController` already received. Two guards added to
> `trends-zoom-logic.test.ts`: one proving window-derived and archive-derived clamps are
> not interchangeable, and a source-text consumer guard over all three call sites. The
> guard was verified to FAIL with the bug reintroduced and PASS with it fixed, so it is
> not a vacuous assertion. Gate after fix: tsc 0, build 0, 1361 tests (+2),
> build-widgets 0, verify-dashboard 37/37. A real outward gesture on the Cadence & HR
> tab remains unconfirmed in a browser — no round ever exercised that path, which is
> exactly why this survived three checkpoints.

### CR-01: Cadence & HR zoom limits are computed from the opening window, not the archive — two thirds of the data is unreachable by gesture, and drag-to-pan dies silently after a button zoom-out

**File:** `src/dashboard/views/trends-charts.ts:647` (with `588-594`, `709-715`)

**Issue:**
`buildZoomPluginOptions`'s `bounds` parameter is contractually the **archive** bounds — `computeLimits(key, bounds)` derives `limits.x.min`/`.max` from `computeFullRange(key, bounds)`, which is what makes D-09's "zoom out to see everything stays literally true" hold. Two of the three call sites honour that:

```
trends-charts.ts:319   buildZoomPluginOptions({ scaleKey, bounds, ... })        // mountVolumeChart      — archive bounds ✓
trends-charts.ts:992   buildZoomPluginOptions({ scaleKey, bounds, ... })        // mountTrainingLoadChart — archive bounds ✓
trends-charts.ts:647   buildZoomPluginOptions({ scaleKey: 'cadence-hr',
                                                bounds: zoom.initial, ... })    // buildChannelBand       — OPENING WINDOW ✗
```

`buildChannelBand`'s `zoom` parameter (`trends-charts.ts:593`) is typed `{ initial: ZoomRange; onSettle }` and carries no archive bounds at all, so the only `ZoomRange` in scope is `zoom.initial` — the D-06 default window on first open, or the D-22 restored window on a rebuild. TypeScript cannot catch the substitution because both are `ZoomRange`.

Consequences, all reachable in normal use on the Cadence & HR tab:

1. **Gesture zoom-out is capped at ~5 years of a ~15-year archive.** With cadence-hr archive bounds `[2011-08-01, 2026-08-01]`, `computeDefaultWindow` yields `[2021-08-15T23:15Z, 2026-08-16T05:15Z]`. Passing that as `bounds` makes `limits.x = { min: 2021-07-31T18:00Z, max: 2026-08-31T09:30Z }` (the window ± half a `PERIOD_MS['cadence-hr']`). `23-VALIDATION.md` R36(b) recorded exactly this: 111 trusted ⌘+wheel events over the HR band ended at `Jul 2021 to Aug 2026` and stopped there. `2021-07-31T18:00Z` formats through `formatRangeLabel` as `Jul 2021` — the recorded value is the predicted clamp, to the month.
2. **The controller and the plugin disagree within the same mount.** `attachZoomController` receives the real archive `bounds` (`trends-charts.ts:725`), so `full`, `isAtFullRange`, and `zoomStepRange`/`panStepRange` all span 2011→2026, and `applyRange` writes straight onto the scale, deliberately bypassing plugin limits (`chart-zoom.ts:302-310`). The `−` button therefore *does* reach the full archive while the wheel refuses to.
3. **Drag-to-pan then becomes a silent no-op.** Once the button-applied range lies outside `limits`, `chartjs-plugin-zoom`'s `updateRange` short-circuits for pan: `if (zoom === 'pan' && (min < minLimit || max > maxLimit)) return true;` (`node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js:179-181`). The drag produces no movement and no feedback.
4. **A restore makes it strictly worse.** On a tab switch back, `zoomCfg.initial` is `restoreOrDefault(zoom.savedRange, ...)` (`trends-charts.ts:712`). R51 left the pair at `Jun 2023 to Dec 2023`; on return, gestures would be confined to roughly `[2023-05-17, 2024-01-15]` for the rest of the session.

No checkpoint row ever gestured *outward* past the default on this tab (R48(b) zoomed in, R51 zoomed in, R52 used buttons), which is why three rounds missed it.

**Fix:** carry the archive bounds down to `buildChannelBand` and pass them where the API expects them. The opening window keeps driving `scales.x.min`/`.max` only.

```ts
// trends-charts.ts:588-594 — widen the parameter
function buildChannelBand(
  stack: HTMLElement,
  points: readonly MonthlyPoint[],
  channel: MonthlyChannel,
  themeColors: { border: string; text: string; textSecondary: string },
  zoom: { initial: ZoomRange; bounds: ZoomRange; onSettle: (chart: Chart) => void } | null
): ChannelBandHandle {

// trends-charts.ts:647 — hand it the archive bounds, not the window
? { zoom: buildZoomPluginOptions({ scaleKey: 'cadence-hr', bounds: zoom.bounds, onSettle: zoom.onSettle }) }

// trends-charts.ts:709-712 — supply it once, alongside `initial`
const zoomCfg =
  bounds === null
    ? null
    : {
        initial: restoreOrDefault(zoom.savedRange, computeDefaultWindow('cadence-hr', bounds)),
        bounds,
        onSettle,
      };
```

Add a regression test that does not need a browser — assert at the pure layer that the limits a chart is built with equal `computeLimits(key, archiveBounds)` and are strictly wider than the opening window:

```ts
// trends-zoom-logic.test.ts
it('limits.x always spans the ARCHIVE, never the opening window (CR-01)', () => {
  const bounds = { min: Date.parse('2011-08-01T00:00:00Z'), max: Date.parse('2026-08-01T00:00:00Z') };
  const shape = buildZoomPluginOptionsShape<{ id: string }>({
    scaleKey: 'cadence-hr', bounds, modifierKey: 'meta', onSettle: () => {},
  });
  const x = (shape.limits as { x: { min: number; max: number } }).x;
  const win = computeDefaultWindow('cadence-hr', bounds);
  expect(x.min).toBeLessThan(win.min);
  expect(x.max - x.min).toBeGreaterThan((win.max - win.min) * 2);
});
```

## Warnings

### WR-01: The Training Load window preset reports `aria-pressed="true"` for a window that is no longer displayed

**File:** `src/dashboard/views/trends.ts:923-952`, `980-1006`

**Issue:** Before this phase the 3mo/12mo/All control sliced the dataset, so `loadWindow` *was* the truth. D-03 turned it into a zoom preset that writes `loadZoomRange` (`trends.ts:946`), but nothing clears the pressed state when the range subsequently changes by another route. `onRangeChange` (`trends.ts:1001-1003`) is called on every settle — every wheel zoom, every drag, every `+`/`−`/`←`/`→` press, and every Reset — and each one overwrites `loadZoomRange` while leaving `loadWindow` untouched and the button visually and semantically "pressed". Reset makes this deterministic rather than incidental: `computeDefaultWindow('training-load', ...)` and `loadWindowRange('12mo', ...)` are the same span (`DEFAULT_SPAN_MS['training-load']` and `LOAD_WINDOW_SPAN_MS['12mo']` are both `31536000000`), so pressing `3mo` then `Reset` leaves `3mo` pressed while a 12-month window is drawn. A screen-reader user is told the wrong window is active.

**Fix:** make the preset state derived rather than remembered. Recompute it on every settle and drop the pressed state when no preset matches:

```ts
// inside renderTrainingLoadTab, replacing the direct slot write at 1001-1003
onRangeChange: (r) => {
  loadZoomRange = r;
  const b = currentBounds();
  const match = b === null
    ? undefined
    : TRAINING_LOAD_WINDOWS.find((w) => rangesEqual(loadWindowRange(w, b), r));
  loadWindow = match ?? loadWindow;
  TRAINING_LOAD_WINDOWS.forEach((w) => {
    const btn = windowButtons[w];
    if (!btn) return;
    const active = match === w;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.className = active ? 'segmented__option segmented__option--active' : 'segmented__option';
  });
},
```

(`rangesEqual` is already exported from `trends-zoom-logic.ts:394`.)

### WR-02: `loadWindow` survives `unmount()` while `loadZoomRange` is reset, so a remount opens with a preset pressed that contradicts the rendered window

**File:** `src/dashboard/views/trends.ts:452`, `1306-1319`

**Issue:** `unmount()` deliberately nulls the three zoom slots (`trends.ts:1316-1318`) but leaves the other within-tab state alone, as the declaration comment at `trends.ts:429-437` explains. `loadWindow` is part of that "left alone" set. Because `createTrendsView` is instantiated once at app startup, a user who selects `3mo`, navigates away, and returns gets `loadZoomRange === null` → `computeDefaultWindow('training-load', bounds)` → a 12-month chart, with the `3mo` button still `aria-pressed="true"` from `updateWindowButtons()` at `trends.ts:952`. This is a distinct trigger from WR-01 (that one is within a single mount) but has the same root cause: two variables encode one piece of state with only one of them being reset.

**Fix:** reset `loadWindow` alongside the zoom slots so the two stay in agreement, and record why in the comment at `trends.ts:1314-1315`:

```ts
// unmount()
volumeZoomRange = null;
cadenceHrZoomRange = null;
loadZoomRange = null;
// loadWindow is the label for loadZoomRange, not independent state — resetting
// one without the other leaves the segmented control asserting a window that
// is not drawn.
loadWindow = DEFAULT_LOAD_WINDOW;
```

Adopting WR-01's derived-state fix instead makes this one disappear as a side effect; either is acceptable, but shipping neither leaves the control lying on the very first interaction after a remount.

### WR-03: Disabling the currently-focused pan/zoom button drops keyboard focus to `<body>`

**File:** `src/dashboard/views/chart-zoom.ts:346-349`

**Issue:** `settle()` sets `disabled` on `panEarlier`, `panLater`, and `zoomOut` based on the new range. A keyboard user pressing `←` repeatedly reaches the earliest edge and, on that final press, the button they are standing on becomes `disabled` — browsers blur a focused element that becomes disabled and reset focus to the document body. The user loses their place in the control cluster with no announcement. `zoomOut` has the same behaviour at full range. Every browser checkpoint row that exercised these buttons did so by click or by a single trusted Enter (R36(a), R51(a)), so none reached the disable transition while focused.

**Fix:** move focus to a still-enabled sibling before the state flips.

```ts
// chart-zoom.ts, replacing lines 346-349
function setDisabled(btn: HTMLButtonElement, disabled: boolean): void {
  if (disabled && document.activeElement === btn) {
    // Reset is the stable neighbour: it is only hidden at the default window,
    // where none of the three step buttons can be at their own clamp.
    (cluster.reset.hidden ? cluster.zoomIn : cluster.reset).focus();
  }
  btn.disabled = disabled;
}

cluster.reset.hidden = rangesEqual(current, defaultWindow);
setDisabled(cluster.panEarlier, isAtEarliestEdge(current, full));
setDisabled(cluster.panLater, isAtLatestEdge(current, full));
setDisabled(cluster.zoomOut, isAtFullRange(current, full));
```

### WR-04: `restoreOrDefault` accepts any finite ordered pair, so a restored range can open a chart entirely outside its data

**File:** `src/dashboard/views/trends-zoom-logic.ts:382-387`; consumed at `src/dashboard/views/trends-charts.ts:275`, `712`, `925`

**Issue:** `restoreOrDefault` validates finiteness and `min < max` but never checks the range against the `fallback`'s own domain. On the Training Load tab the saved range is deliberately carried across a TRIMP model switch (`trends.ts:877-879`), and the two models do not share an x domain: `selectModelSeries(doc.days, 'banister')` drops every day whose `banister` is `null` (`trends-training-load-logic.ts`), so an athlete whose Banister configuration only covers recent years gets a Banister series starting years after the Edwards one. Zoom to 2012 on Edwards, switch to Banister, and `mountTrainingLoadChart` restores `[2012-…, 2012-…]` over a series that begins in, say, 2018 — a blank chart with no explanation. The `bounds` derived at `trends-charts.ts:834` are the Banister ones, so `full` and the button predicates are correct, but the *opening* range is not clamped into them.

**Fix:** clamp the restore into the fallback's own full range rather than only sanity-checking its shape.

```ts
export function restoreOrDefault(saved: ZoomRange | null, fallback: ZoomRange): ZoomRange {
  if (saved === null) return fallback;
  if (!Number.isFinite(saved.min) || !Number.isFinite(saved.max)) return fallback;
  if (saved.min >= saved.max) return fallback;
  return fallback;  // placeholder — see the bounds-aware signature below
}
```

Prefer the bounds-aware form, since every call site already has the archive bounds in scope:

```ts
export function restoreOrDefaultWithin(
  saved: ZoomRange | null,
  fallback: ZoomRange,
  full: ZoomRange
): ZoomRange {
  if (saved === null) return fallback;
  if (!Number.isFinite(saved.min) || !Number.isFinite(saved.max)) return fallback;
  if (saved.min >= saved.max) return fallback;
  // A saved window with no overlap at all belongs to a different domain
  // (e.g. the other TRIMP model) — fall back rather than open on blank space.
  if (saved.max <= full.min || saved.min >= full.max) return fallback;
  return { min: Math.max(saved.min, full.min), max: Math.min(saved.max, full.max) };
}
```

### WR-05: The accessible-equivalent `<details>` table was moved inside `.year-heatmap-scroll`, falsifying the rule's own documented rationale

**File:** `src/dashboard/views/trends.ts:521`, `552-586`; `src/dashboard/styles.css:1540-1546`

**Issue:** `styles.css:1540-1546` justifies omitting `tabindex="0"` on the scroll wrapper by asserting two facts: that the heatmap's cells are non-focusable, and that "the 'View as table' `<details>` disclosure **directly below**" supplies the accessible equivalent. The second is not true of the shipped DOM. `renderGridForYear` appends the disclosure to `gridWrap` (`trends.ts:586`) — the same element that now carries `className = 'year-heatmap-scroll'` (`trends.ts:521`). The `<summary>` is a focusable element living *inside* the `overflow-x: auto` container, which is exactly the focus-into-scroll-container hazard `styles.css:876-891` says was avoided here. It also means the table shares a horizontal scroll offset with the 634px grid: a reader who has scrolled right to reach December and then expands the disclosure finds the table shifted with it.

Nothing here is a correctness bug in the containment fix itself (R35's `scrollWidth`/`clientWidth` result is unaffected), but the comment records a DOM fact the code does not have, and a future reader auditing the a11y rationale will draw the wrong conclusion.

**Fix:** append the disclosure to `section`, the wrapper's parent, so the comment becomes true and the only thing inside the scroll container is the non-focusable grid.

```ts
// trends.ts — hoist `details` out of gridWrap
function buildYearHeatmapSection(rows: readonly DashboardIndexRow[]): HTMLElement {
  const section = document.createElement('div');
  // ...
  const gridWrap = document.createElement('div');
  gridWrap.className = 'year-heatmap-scroll';
  section.appendChild(gridWrap);

  const tableWrap = document.createElement('div'); // sibling of gridWrap, outside the scroll container
  section.appendChild(tableWrap);

  function renderGridForYear(): void {
    gridWrap.replaceChildren();
    tableWrap.replaceChildren();
    // ... gridWrap.appendChild(grid);
    // ... tableWrap.appendChild(details);   // was gridWrap.appendChild(details)
  }
```

### WR-06: Two new negative CSS assertions pass vacuously when the selector is absent

**File:** `src/dashboard/styles.test.ts:2228`, `2301`

**Issue:**

```ts
expect(() => atRuleBodiesFor('.chart-zoom-hint', 'display')).toThrow();
expect(() => atRuleBodiesFor('.trends-tablist-scroll', 'overflow-x')).toThrow();
```

`atRuleBodiesFor` throws whenever `bodies.length === 0` (`styles.test.ts:543-547`), which is true both when the property is not overridden **and** when the selector does not exist at all. Deleting or renaming `.chart-zoom-hint` or `.trends-tablist-scroll` therefore keeps both assertions green. The first is the guard D-17's "never hidden at any breakpoint" promise rests on; the second is the guard D-21's "exactly one 430px block" reasoning rests on. Neither can currently detect the regression it names.

This file already ships the correct helper: `assertNoAtRuleOverride` (`styles.test.ts:470-497`) throws *only* when a real at-rule override exists and is silent otherwise — the existing `.calendar-weekday--total` test at line 1904 uses it correctly.

**Fix:**

```ts
// line 2228
expect(() => assertNoAtRuleOverride('.chart-zoom-hint', 'display')).not.toThrow();
// pin existence separately, so a deleted rule fails loudly
expect(declarationsFor('.chart-zoom-hint')).toContain('font-size');

// line 2301
expect(() => assertNoAtRuleOverride('.trends-tablist-scroll', 'overflow-x')).not.toThrow();
```

(The pre-existing `.calendar-grid` instance at line 2076 has the identical weakness; it is outside this phase's diff and is noted here only so a fix can sweep all three.)

### WR-07: Every chart `options` object is cast `as any`, so the zoom config, scale min/max and tick callbacks this phase added are entirely untyped

**File:** `src/dashboard/views/trends-charts.ts:253`, `331`, `456`, `662`, `907`, `1002`, `1111`

**Issue:** The pattern predates Phase 23 (`mountYoyChart`, `mountGearChart`), but this phase added four new instances and, more importantly, moved genuinely new structure *inside* the cast: `plugins.zoom` (lines 319, 647, 992), the `scales.x.min`/`.max` restore writes (299-300, 628, 974-975), and the three-argument `ticks.callback` signature (226-227, 303-304, 631-632, 884-885, 978-979). Because the whole object is `as any`, a typo in `plugins.zoom` — or the `zoom` key landing at the wrong nesting depth, which is precisely Finding 10's failure mode — compiles clean. The blanket cast is why Finding 10 needed a browser round to surface and why `trends-zoom-logic.test.ts` had to be written to assert the option *shape* out-of-band.

**Fix:** narrow the cast to the specific properties Chart.js's types genuinely reject (the `afterFit` scale handler and the widened `ticks.callback`), leaving the rest checked:

```ts
import type { ChartOptions } from 'chart.js';

const options: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  parsing: false,
  scales: {
    x: {
      type: 'linear',
      min: initial.min,
      max: initial.max,
      grid: { display: false },
      ticks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: ((value: number | string, _i: number, ticks: readonly { value: number }[]) =>
          formatAdaptiveTimeTick(Number(value), stepMsFromTicks(ticks))) as any,
      },
    },
    // ...
  },
  plugins: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zoom: buildZoomPluginOptions({ scaleKey, bounds, onSettle: (c) => controller?.settle(c) }) as any,
    // ...
  },
};
const chart = new Chart(canvas, { type: 'bar', data: { /* ... */ }, plugins: [chartZoomPlugin], options });
```

At minimum, do this for the three zoom-carrying mounts (`mountVolumeChart`, `buildChannelBand`, `mountTrainingLoadChart`) — the ones where an unchecked option silently disables a shipped feature.

## Info

### IN-01: `applyGrabCursor` never restores the canvas cursor on detach

**File:** `src/dashboard/views/chart-zoom.ts:221-239`

**Issue:** The returned detacher removes all four pointer listeners but leaves the inline `canvas.style.cursor = 'grab'` set at line 222. In the Volume tab the canvas is `band.canvas`, built once per `renderVolumeTab` and reused across every granularity change (`trends.ts:630`, `636`), so a switch to a granularity whose series is empty takes `mountVolumeChart`'s no-zoom branch (`trends-charts.ts:190-267`) and leaves a stale grab cursor advertising a drag that does nothing.

**Fix:** capture and restore in the detacher — `const previous = canvas.style.cursor;` before line 222, then `canvas.style.cursor = previous;` inside the returned function.

### IN-02: `MONTH_ABBR` is duplicated across two new pure modules

**File:** `src/dashboard/views/trends-zoom-logic.ts:345`, `src/dashboard/views/trends-tick-format.ts:46`

**Issue:** Both arrays are byte-identical and both were added in this phase. `deferred-items.md`'s own fix shape for Finding 12 ("format through the same `D MMM YYYY` shape `formatTimeAxisTick` already produces, rather than inventing a new date formatter") depends on there being one canonical formatter to reuse; two copies of the month table is the first step toward there being two.

**Fix:** have `trends-zoom-logic.ts` import `formatTimeAxisTick` from `trends-tick-format.js` (both are DOM-free and charting-library-free, so the import direction is safe) and build `formatRangeLabel` on top of it: `` `${formatTimeAxisTick(minMs, 'month')} to ${formatTimeAxisTick(maxMs, 'month')}` ``, keeping the non-finite guard.

### IN-03: Three exports in `chart-zoom.ts` have no consumer, in production or in tests

**File:** `src/dashboard/views/chart-zoom.ts:101` (`resolveModifierKey`), `:180` (`buildZoomControlCluster`), `:221` (`applyGrabCursor`); plus the `ZoomControlCluster` and `ZoomMember` interfaces

**Issue:** All are referenced only from within `chart-zoom.ts` itself, and the module deliberately has no test file (`chart-zoom.ts:433-478`). Exporting them widens the surface a future module could import — and `chart-zoom.ts`'s own header (lines 10-19) turns on this module never being reachable from `trends.ts`'s static graph, so every extra export is one more way to breach that boundary.

**Fix:** drop `export` from all three functions and from `ZoomControlCluster`. Keep `ZoomMember` exported only if `attachZoomController`'s public argument type is meant to be nameable by callers.

### IN-04: `trends-tick-format.ts`'s stated invariant is stronger than what holds, and the test suite only exercises steps ≥ 1 day

**File:** `src/dashboard/views/trends-tick-format.ts:11-14`; `src/dashboard/views/trends-tick-format.test.ts:85-108`

**Issue:** The header claims "two adjacent ticks — `anchor` and `anchor + step` — can NEVER format to the same string, at any step size". That is false below one day: `formatAdaptiveTimeTick(t, 43200000)` and `formatAdaptiveTimeTick(t + 43200000, 43200000)` both render `6 Feb 2026`. The invariant holds *in practice* only because `MIN_RANGE_MS` floors every scale at ≥ 7 days (`trends-zoom-logic.ts:64-70`), so Chart.js's nice-number tick spacing never falls below ~1.16 days. The `steps` array in the never-duplicates test starts at 86400000, so the sub-day region is untested and the constraint that actually protects it is undocumented.

**Fix:** restate the invariant as conditional — "for any step ≥ 1 day, which every Trends scale guarantees via `MIN_RANGE_MS`" — and add a test that makes the dependency explicit: `expect(Math.min(...Object.values(MIN_RANGE_MS)) / 12).toBeGreaterThanOrEqual(86400000)` (or assert the floor directly), so lowering a `MIN_RANGE_MS` entry fails loudly instead of silently reopening Finding 7.

### IN-05: `renderVolumeTab` hardcodes the weekly aria-label for a band that may open at any granularity

**File:** `src/dashboard/views/trends.ts:630`

**Issue:** `buildChartBand(panel, 'Distance', 'Weekly distance chart')` passes the weekly string unconditionally, even though `volumeGranularity` persists across unmount (`trends.ts:438`) and can be `monthly` or `yearly` when the tab is re-rendered. It happens to be harmless today because `mountVolumeChart:186` immediately overwrites the attribute from `VOLUME_ARIA_LABELS[granularity]` — but `mountChartForGranularity` returns early when `!data` (`trends.ts:633`), which would leave the wrong label in place, and the literal duplicates a value that `VOLUME_ARIA_LABELS` already owns.

**Fix:** export `VOLUME_ARIA_LABELS` from `trends-charts.ts` and pass `chartsModule.VOLUME_ARIA_LABELS[volumeGranularity]`, or pass an empty string and let `mountVolumeChart` remain the single writer of that attribute.

---

_Reviewed: 2026-08-27T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
