# Phase 23: Trends Zoom, Pan & Taller Bands - Research

**Researched:** 2026-08-19
**Domain:** Chart.js v4 zoom/pan plugin integration on a `'linear'`-scale, destroy-and-rebuild chart lifecycle; viewport-relative CSS sizing
**Confidence:** HIGH (plugin API/lifecycle — read directly from the installed package source, not docs prose); MEDIUM (band-height/ResizeObserver interaction, exact tuning constants — genuinely require the D-19/D-21/D-25 browser checkpoint)

## Summary

The single highest-value finding of this research came from reading `chartjs-plugin-zoom@2.2.0`'s actual shipped source (verified by a real, then-reverted, `npm install`) rather than trusting its docs prose, which is thin on exactly the questions CONTEXT.md's decisions depend on. Two corrections to CONTEXT.md's own stated assumptions surfaced this way, both load-bearing for planning:

1. **Hammer.js is not only a touch/pinch dependency — it is required for D-15's plain mouse drag-to-pan too.** `chartjs-plugin-zoom` wires *all* panning (mouse, touch, and pinch alike) through `Hammer.Manager`/`Hammer.Pan`; only wheel-zoom and the (unused-here) drag-to-zoom-rectangle feature avoid it. D-16 already accepts the Hammer dependency, so this doesn't change the decision, but it does mean Hammer cannot be scoped to "touch only" — it is on the critical path for every pan gesture in this phase.
2. **`chart.zoom()`/`chart.pan()` — the exact API the D-11 +/−/←/→ buttons call — do NOT fire `onZoomComplete`/`onPanComplete`.** Those "Complete" callbacks are wired only to gesture-driven interaction (wheel debounced 250ms, drag-release, pinch-end, Hammer `panend`). The imperative API fires only the *continuous* `onZoom`/`onPan` callbacks. This means D-13's aria-label rewrite and D-11's Reset-visibility/disabled-state logic **cannot** be implemented by registering `onZoomComplete`/`onPanComplete` alone — the button click handlers must call the same "settle" update function directly, in addition to registering it as the gesture-path callback. Missing this produces a real defect (buttons functionally work, but the aria-label and Reset button silently never update after a button press) that is invisible to this repo's DOM-less test suite and would very likely surface only at the D-25 browser checkpoint — exactly the failure class this project has been burned by three times already (Phase 16/17/19).

Beyond those two corrections, the plugin's `'linear'`-scale path is a first-class, fully-supported code path (not a workaround) — no `TimeScale`/date-adapter is needed, confirming 18-UI-SPEC § 14 holds. The plugin cleans up correctly on `chart.destroy()` via Chart.js's own `stop` plugin hook (verified in both the plugin's and Chart.js core's source), which de-risks TRN-04's canvas-lifecycle concern for the zoom/pan machinery specifically — the destroy-and-rebuild pattern this codebase already uses is sufficient, no extra teardown code is needed for the plugin itself.

**Primary recommendation:** Install `chartjs-plugin-zoom@^2.2.0` + `hammerjs@^2.0.8` (D-16, no viable maintained alternative exists — see Package Legitimacy Audit), wire per-instance via each chart's own `plugins: [...]` array (D-05, verified compatible with Chart.js's plugin lifecycle), configure `zoom.mode: 'x'` / `pan.mode: 'x'` with `limits.x` set to **literal computed numeric bounds** (never the `'original'` sentinel — see Pitfall 1), and give every button handler its own explicit call to a shared `onSettle()` function rather than relying on `onZoomComplete`/`onPanComplete` alone.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Zoom/pan gesture handling (wheel, drag, pinch, touch) | Browser / Client | — | `chartjs-plugin-zoom` + Hammer.js attach DOM listeners directly to the chart's `<canvas>`; no server or SSR involvement — this whole phase is client-only |
| Zoom/pan on-screen controls (+/−/←/→/Reset) | Browser / Client | — | Real `<button>` elements calling the plugin's imperative `chart.zoom()`/`chart.pan()`/`chart.resetZoom()` API |
| Chart rendering / axis scaling | Browser / Client | — | Chart.js `'linear'` scale, entirely in-browser; data already delivered as static JSON, no new fetch |
| Zoom state persistence within a page session | Browser / Client | — | View-closure state (D-22), same pattern as `volumeGranularity` etc. — no server round-trip |
| Default-window / limits computation | Browser / Client | — | Pure functions over the already-fetched dataset (D-06, D-09) — candidate for a new `trends-zoom-logic.ts`, unit-testable under Node (no DOM) |
| Underlying data (weekly/monthly/yearly/training-load JSON) | Database / Storage (static, build-time) | — | Unchanged by this phase — these are pre-computed, published JSON files; zoom/pan slices the *already-fetched* dataset client-side, never re-fetches |
| Band height (CSS) | Browser / Client | — | Pure CSS (`clamp()`, `vh`/`dvh`), resolved by the browser's layout engine; no build-time computation |

There is no backend, SSR, or CDN-caching dimension to this phase — every capability in TRN-01..04 resolves entirely client-side against data the Trends view already has in memory.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Zoom scope — which charts**

- **D-01: Zoom/pan lands on the three time-axis tabs only — Volume, Cadence & HR, and
  Training Load.** Year-over-Year and Gear are excluded because their x scales are
  `'category'`, not `'linear'`: zooming them means "show fewer bars", which is not what
  TRN-01 describes. YoY's 12-month axis exists precisely so multiple years overlay on one
  fixed domain (18-UI-SPEC § 9); narrowing it defeats the chart. Gear's ~16 shoes have no
  ordering that panning would respect.
  **The exclusion is enforced, not merely unconfigured** — see D-05.

- **D-02: Cadence & HR's two stacked bands zoom and pan in lockstep.** `mountChannelBands`
  (`trends-charts.ts:422`) builds two Chart.js instances in one `.chart-stack` behind a
  single `ChartHandle`. An `onZoom`/`onPan` callback on either applies the same x min/max
  to its sibling, so the two series always show the same date range — which is the entire
  reason they are stacked. One control cluster drives the pair (D-08).
  **Rejected:** independent zoom. The bands can drift out of alignment while still
  *looking* aligned, so you would be comparing cadence in 2019 against HR in 2024 —
  actively misleading, and worse than not zooming at all.

- **D-03: Training Load keeps its 3mo/12mo/All control, but the control now sets the
  chart's zoom min/max instead of slicing the dataset.** It becomes a set of zoom
  **presets**, and free zoom/pan continues from wherever a preset put you. One mechanism
  underneath, two ways to drive it — the same shape as D-06's default window.
  **Two consequences the planner must handle deliberately:**
  (a) `sliceLoadWindow` (`trends-training-load-logic.ts`) stops gating the dataset; the
  chart always holds the full series. Whether the function survives as a pure helper or
  is retired is a planning call, but the *chart* must no longer depend on it for what it
  displays.
  (b) **LTTB decimation now runs against the full series at every zoom level.** Chart.js's
  `Decimation` plugin samples from the data the scale can see; with the full series always
  loaded, a deep zoom must still resolve to real points rather than a 500-sample skeleton
  of the whole archive. This belongs on the checkpoint list — zoom into a two-week span on
  Training Load and confirm daily resolution actually appears.
  **Rejected:** keeping the window control as a dataset slicer with zoom operating inside
  it — switching window would silently discard zoom, and "All + zoomed to 3 months" vs
  "3mo" become two paths to one picture with different state. Also rejected: dropping the
  control, which would remove 18-D16's readable 12mo default.

- **D-04: Trends only — the activity detail view's chart bands do not get zoom.** The
  phase boundary is `#/trends`, the detail view was not among the walkthrough complaints,
  and a single run's bands cover one activity rather than 15 years, so the compression
  problem does not exist there. **Extract any shared zoom wiring into a module both
  surfaces could import** (`chart-theme.ts` or a sibling, following 18-UI-SPEC § 14's
  extract-don't-duplicate rule) so a later phase can adopt it cheaply — but wire it only
  on Trends in this phase.

- **D-05: `chartjs-plugin-zoom` is passed per-instance via each chart's own
  `plugins: [...]` array — never added to `trends-charts.ts`'s module-wide
  `Chart.register(...)` call.** This follows the codebase's own stated discipline
  (T-18-CANVAS-01, the reason the thin-coverage shading plugin at
  `trends-charts.ts:466` is deliberately kept out of that one registration call) rather
  than the plugin's documented convention. Two payoffs: D-01's exclusions become
  structural — YoY and Gear are *incapable* of zooming rather than merely lacking an
  opt-in — and a plugin holding per-canvas state stays off the global registry, which is
  the exact shape of the "Canvas is already in use" defect class TRN-04 names.
  **Rejected:** module-wide registration. It would require an explicit `zoom: false` on
  YoY and Gear — an opt-OUT list a future chart could silently forget.

**The opening picture**

- **D-06: Each granularity opens on a readable default window, expressed as initial zoom
  state over the full dataset — never as a dataset slice.** Weekly ≈ last 12 months,
  monthly ≈ last 5 years, yearly = everything. **Exact spans are for planning to settle
  against a real browser at the D-14 band height** — this decision locks the shape, not
  the constants.
  This is what actually discharges TRN-01, whose wording is outcome-shaped: *"so a weekly
  view no longer shows the entire 15-year archive compressed into one screen."* Shipping
  only the capability leaves that screen looking identical until the user discovers the
  zoom. Because it is zoom state and not a slice, "zoom out to see everything" stays
  literally true, and it is the same one-mechanism shape as D-03.

- **D-07: Zoom and pan act on the x-axis only (`mode: 'x'`), and the y-axis rescales to
  the visible window.** Every complaint here is horizontal compression. X-only gives
  "reset" one meaning and maps the +/− and ←/→ controls onto exactly two behaviours.
  Y-rescale is what makes zoom feel like it did something — zooming into a quiet year
  re-fits y to that year rather than leaving the bars squashed under an outlier week's
  scale. **The trade is real and belongs on the checkpoint list:** two screenshots at
  different pans are not directly y-comparable.
  **Rejected:** both-axis zoom — doubles the control set (or overloads +/−) and makes
  "am I looking at a comparable y-scale?" a live question on every view.

- **D-08 is under Controls below.** *(numbering continues there)*

**Limits**

- **D-09: `limits` clamps pan to the data range, floors the zoom-in, and caps zoom-out at
  the full range.** Panning stops at the first and last data point, so you can never
  scroll off into blank space and lose the chart. Zoom-in stops at a sensible minimum span
  (order of a handful of periods) so a single bar cannot fill the screen with no context.
  Capping zoom-out at the full data range also gives "fully zoomed out" a well-defined
  target for the Reset control (D-11) and for the `−` button's disabled state.
  Exact constants are Claude's discretion, tuned against the real archive.

**Controls (TRN-02)**

- **D-10: The control cluster lives in each `.chart-band__header`.** That header is
  already `display: flex; align-items: center; justify-content: space-between`
  (`styles.css:1017`) holding the band title, so it absorbs a right-hand cluster with no
  new layout CSS — the same way `.calendar-header` absorbed Phase 22's toggle (22-D02).
  Putting the controls *on* the thing they act on matters on Cadence & HR, where two bands
  are visible at once; per D-02 they zoom in lockstep, so **one cluster serves the pair**
  (planning picks which band's header carries it, or a cluster above the stack). This also
  keeps the zoom controls clear of each tab's existing `.segmented` controls, which sit
  above the chart.

- **D-11: The cluster is `←` `→` `−` `+`, plus a Reset that appears only when zoomed.**
  Four always-present buttons cover both halves of TRN-02 plainly. Reset materialises once
  the chart is off its D-06 default view, so it never advertises an action on an
  already-default chart — **and its presence doubles as the only visible signal that you
  are zoomed at all**, which matters because D-07's y-rescale means a zoomed chart does
  not obviously look zoomed. Reset returns to the granularity's default window (D-06), not
  merely to full zoom-out.
  Buttons **disable** at their clamps (`←`/`→` at the pan bounds, `−` at full zoom-out)
  using Phase 19's `:disabled` / `[aria-disabled]` treatment (19-D07) rather than hiding.
  All four are real `<button type="button">` elements, so keyboard operation is native —
  this is how TRN-02's "no pointing device at all" is satisfied.
  **Rejected:** an always-present Reset (a dead control most of the time), and omitting
  Reset entirely (pressing `−` repeatedly reaches full zoom-out but never restores the
  designed opening window, making it unreachable).

- **D-12: One press zooms ~1.5× or pans ~25% of the visible range.** Proportional steps
  mean the same thing at every zoom level and under every granularity, so one
  implementation serves weekly, monthly and yearly with no per-granularity table, and it
  maps directly onto the plugin's `zoom(factor)` / `pan({x})` API. 25% keeps enough of the
  previous view on screen to stay oriented while still moving usefully — roughly three
  presses to walk a full screen. Exact factors are Claude's discretion.
  **Rejected:** pan-by-one-period (at a 12-month weekly window one press moves ~2% of the
  view — fifty presses to reach last year), and a fixed-span zoom ladder (fights free
  wheel/pinch zoom, which lands between rungs, and needs different rungs per granularity).

- **D-13: The canvas `aria-label` is rewritten to name the visible range** — e.g.
  "Weekly distance chart, Sep 2025 to Aug 2026" — on every zoom/pan settle. This extends
  the existing `VOLUME_ARIA_LABELS` mechanism (`trends-charts.ts:112`) rather than
  inventing a second one, needs no new ARIA machinery, and does not fire on every wheel
  tick. Without it, TRN-02's pointer-free requirement is satisfied only mechanically: the
  buttons are reachable and pressable while the result of pressing them is unobservable to
  anyone not looking at the screen.
  **Rejected:** a polite live region — better feedback, but it needs debouncing against
  wheel and drag (which fire continuously), and this codebase has no live-region precedent
  outside `role="status"` loading indicators.
  **Also rejected, and worth stating so a reviewer does not read it as a gap:** making the
  `<canvas>` focusable so arrow keys pan it. TRN-02 is discharged by the buttons; a
  focusable canvas adds a Tab stop with no visible focus indication and no precedent here
  (18-UI-SPEC § 16 and T-18-A11Y-03 deliberately kept the year heatmap's 371 cells
  non-focusable for the same reason).

**Gestures**

- **D-14: ⌘/Ctrl + wheel zooms; a bare wheel scrolls the page as it does today.**
  Via `zoom.wheel.modifierKey`. The reason is specific to this page: on a macOS trackpad a
  two-finger scroll **is** a wheel event, so bare-wheel zoom means the page traps your
  scroll every time you pass a chart — and Cadence & HR stacks two, at the D-16 height.
  This is the convention Google Maps embeds settled on, and the single most-reported
  `chartjs-plugin-zoom` complaint is the behaviour it avoids.

- **D-15: Dragging across the plot area pans.** The natural gesture on a zoomed chart, and
  Trends charts carry no click-to-navigate behaviour to conflict with — unlike the
  activity rows, where Phase 20 spent five gap-closure rounds on exactly that ambiguity
  (20-D16's `shouldNavigateOnRowClick` predicate). Tooltips still work on hover; only a
  real drag pans. The cursor should signal it (`grab` / `grabbing`); that is a checkpoint
  row.

- **D-16: Take the Hammer.js dependency for pinch-to-zoom and touch pan.** TRN-01 names
  pinch explicitly, and Phase 22 established that real phone widths (390/393/412px) are a
  live concern for this dashboard rather than hypothetical. `chartjs-plugin-zoom`'s wheel
  and mouse-drag paths work without it; pinch and touch pan do not. It lands inside the
  already-lazy `trends-charts.js` chunk (18-UI-SPEC's LAZY-CHUNK BOUNDARY rule), so it
  costs nothing on any other route.
  **Stated cost, recorded rather than discovered later: Hammer.js is effectively
  unmaintained.** Research should confirm the current `chartjs-plugin-zoom` major's exact
  Hammer requirement and whether a maintained fork or a pointer-events alternative is
  viable before the dependency is added.
  > **Research correction (see Common Pitfalls, Pitfall 4):** the plugin's source shows
  > mouse-drag pan is *also* wired through Hammer's `Hammer.Pan` recognizer, not just
  > touch/pinch. The "mouse-drag paths work without it" half of this decision's stated
  > reasoning does not hold against the shipped code — Hammer is on the critical path for
  > D-15's plain desktop drag-to-pan too. This does not change the decision (D-16 already
  > accepts the dependency), only its stated scope.

- **D-17: A persistent hint in the band header advertises the modifier.** Something like
  "⌘/Ctrl + scroll to zoom", sitting near the D-10 control cluster. Modifier-gated wheel
  zoom is otherwise undiscoverable — you cannot find it by trying. Fits the existing
  `.chart-band__header` and matches this project's actionable-notice habit (18-D13's
  config notice, the `c502537` blocked-basemap notice).
  **Rejected:** a show-on-scroll-attempt overlay (the Google Maps behaviour) — more
  elegant when it fires, but it is a new interaction primitive with its own timing,
  dismissal and accessibility questions, and it is invisible to keyboard users entirely.

**Band height (TRN-03)**

- **D-18: A Trends-only modifier class — the shared `.chart-band__canvas-wrap` rule and
  the detail view are byte-unchanged.** Something like
  `.chart-band__canvas-wrap--tall`, applied by `trends-charts.ts` only. TRN-03's own
  justification is "on a page with room to spare", which is the Trends page: the detail
  view stacks its bands under a route map and a splits table and is *not* a page with room
  to spare. Silently doubling its height would be a rendering change nobody asked for on a
  screen Phase 17 tuned and Phase 19 restyled, and no checkpoint row would be watching it.

- **D-19: The height is viewport-relative with clamps — shape `clamp(180px, 34vh, 420px)`,
  exact numbers for planning to settle against a real browser.** Roughly doubles the band
  on a laptop, grows on a large monitor where "room to spare" is literally true, and never
  collapses below a readable floor on a short window. This matters more than usual here:
  once a chart is zoomable, y-axis range is what makes a zoomed view worth looking at, and
  a fixed px height wastes a large display.
  **Rejected:** a fixed larger px value (~280px) — predictable and trivially testable by
  `styles.test.ts`'s rule scanner, but identical on a 13-inch laptop and a 4K monitor.
  Also rejected: aspect-ratio-driven height — most "correct" for a chart, but it interacts
  with `maintainAspectRatio: false` (which every chart here sets) and Chart.js's
  ResizeObserver path in ways this codebase has zero precedent for, and the Trends page is
  not where to find that out.

- **D-20: Cadence & HR's two stacked bands both get the full height; the tab scrolls.**
  The two series are meant to be read against each other, so shrinking them undercuts the
  reason they are stacked — and it would reintroduce exactly the squashed y-axis TRN-03
  exists to fix, on the one tab with two charts to squash. A scrolling tab is normal here
  (Records is deliberately long enough to need a sticky jump list, 18-D02). Equal heights
  also keep D-02's synced pair on one plot geometry.

- **D-21: Keep an explicit small-screen floor, retuned against real phone widths.** A
  clamp's lower bound does most of the work, but a phone must never get a band taller than
  it is wide. **Whatever breakpoint is chosen must be justified against real phone widths,
  not inherited** — Phase 22 pinned its Round 3 overflow fix to `@media (max-width: 380px)`
  while the defect-causing rules stayed unconditional at 381px+, which reopened CAL-02 at
  the 390/393/412px widths no round had tested and cost a whole gap-closure round.
  Note `styles.css`'s § comment near line 883 asserts the file has exactly **two**
  `@media (max-width: 380px)` blocks and a test enforces related structure — if this
  decision changes that count or that breakpoint, the comment and any dependent assertion
  must be updated in the same change, not left stale.

**Zoom state lifecycle (TRN-04)**

- **D-22: Zoom is within-tab state held in the view closure — survives a tab switch,
  resets on unmount.** Store each zoomable tab's x min/max exactly the way
  `volumeGranularity`, `volumeYear`, `yoySelectedYears`, `trimpModel`, `loadWindow`,
  `gearSort` already are (`trends.ts:427-452`). This is 18-UI-SPEC § 8's within-tab-state
  contract verbatim: survives a destroy-and-rebuild, does not survive a full page remount
  (`unmount()` at `trends.ts:1228` resets everything). No new pattern.
  It also means **the TRN-04 checkpoint exercises restore-on-rebuild rather than skipping
  it** — rapid tab cycling with zoom present is a real state round-trip, which is exactly
  what criterion 4 asks to be proven.

- **D-23: A granularity change resets to the new granularity's D-06 default window.**
  Each granularity has its own designed opening density, and that is what the toggle is
  for. Carrying a 3-month zoom into "Yearly" would show three bars; carrying a 15-year
  view into "Weekly" recreates the exact compression TRN-01 exists to fix.
  **Rejected:** preserving the date range across the switch — arguably the more powerful
  reading (granularity as a pure detail-level control over a fixed window), but it
  collides with D-06 (which granularity's window wins on first open?) and can land you on
  Yearly showing a single bar.

- **D-24: Zoom position does NOT survive a page reload — no `localStorage`, no storage
  module in this phase.** A reload should give you the designed opening picture, not
  wherever you left the chart last week. A persisted window is a silent data filter that
  survives long enough to forget you set it, which cuts against this project's hard rule
  that absences must be visible and never made up. Follows 21-D04's precedent (the Records
  scope deliberately does not persist), and leaves nothing to invalidate as the archive
  grows.
  **This does not reopen 22-D06** — localStorage remains sanctioned for view state,
  per-view and narrowly. This phase simply has no case for it.

**Verification**

- **D-25: The TRN-04 checkpoint must be a discriminator, not a presence check.**
  "Cycle the tabs, see no console errors" is the weak form that scored FAIL across two
  rounds of Phase 20's validation and that 22-D16 was written to prevent — a
  silently-reset zoom, a stranded duplicate canvas, and a correctly-working chart can all
  produce a clean console.
  The checkpoint must instead: (a) establish a **specific, readable** zoom state on at
  least two tabs — a named date range the developer writes down, not "zoomed in a bit";
  (b) rapidly cycle all five tabs and the granularity toggle several times; (c) **return
  and read the range back** off the canvas `aria-label` (D-13) and the axis ticks. A reset
  state, a doubled canvas, or a desynced Cadence & HR pair are then all distinguishable
  from success by a value, not by an absence of errors.
  Planning must write the expected read-back values into the plan, computed in advance —
  the discipline that closed Phase 21's R15 and Phase 22's CAL-02.
  **No staged fixture is expected or permitted here** — 1,868 activities across 15 years
  are exactly the data this feature exists for.

### Claude's Discretion

- Exact default-window spans per granularity (D-06), tuned against a real browser at the
  D-19 height. Weekly ≈ 12 months / monthly ≈ 5 years / yearly = all is the starting shape.
- Exact `limits` constants (D-09): the minimum zoom span and how pan bounds are expressed.
- Exact zoom factor and pan fraction (D-12); ~1.5× and ~25% are the starting shape.
- Exact clamp values in D-19 and the D-21 breakpoint — both must be justified against a
  real browser and real phone widths respectively, not asserted.
- Which band's header carries the shared cluster on Cadence & HR (D-10), or whether it
  sits above the `.chart-stack`.
- Button glyphs and `aria-label` wording for the five controls, and the exact hint copy
  (D-17) including how it renders on a touch device where there is no modifier key.
- Whether `sliceLoadWindow` survives as a pure helper or is retired under D-03.
- Where the shared zoom wiring is extracted to under D-04 (`chart-theme.ts` vs a new
  sibling module), and how much of it is pure enough to unit-test without a DOM — the
  established `*-logic.ts` / rendering split (17 precedent, 18-D-discretion).
- Whether the Reset control is a fifth button in the cluster or a distinct affordance.

### Deferred Ideas (OUT OF SCOPE)

- **Zoom/pan on the activity detail view's chart bands.** D-04 keeps this phase on
  `#/trends`. D-04's extraction requirement is what makes a future phase cheap — the
  wiring will already be in a shared module. Would need its own checkpoint rows and would
  have to be reconciled with the crosshair plugin and the Distance/Time x-axis toggle.
- **Zoom on the Records page's seven PR-evolution small multiples** (18-D06). Same
  compression argument applies — 6-21 steps per distance across 15 years — but Records is
  outside this phase's boundary entirely.
- **Category-axis zoom for Year-over-Year and Gear.** D-01 excludes them on structural
  grounds, not because the idea is worthless: zooming YoY to "March through June across 3
  years" is a real thing someone might want. If it is ever wanted, it is a different
  interaction (range selection over a fixed category domain), not the same feature.
- **Persisting zoom position across reloads.** D-24 declines it. If a second persisted view
  preference ever appears alongside Phase 22's calendar week start, generalizing from two
  concrete cases beats guessing now (22-D06's own reasoning).
- **Replacing or removing Hammer.js.** D-16 takes the dependency with its unmaintained
  status recorded. If `chartjs-plugin-zoom` ships a pointer-events touch path, or a
  maintained alternative appears, revisit.
- **Making weekly aggregates honour the Calendar's week-start preference** — carried
  forward from 22's deferred list, which explicitly noted it "would need to be reconciled
  with Phase 23's Trends work". **It is not reconciled here**: 22-D15 stands, Trends
  remains Monday-fixed from the pipeline, and this phase changes nothing about it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRN-01 | User can zoom in and out of trend charts via `chartjs-plugin-zoom`, so a weekly view no longer shows the entire 15-year archive at once | Confirmed `chartjs-plugin-zoom@2.2.0` fully supports Chart.js 4.5.1 (`peerDependencies: {"chart.js": ">=3.2.0"}`, verified by local install) on a `'linear'` x scale carrying epoch-ms — no `TimeScale`/date-adapter needed. `zoom.wheel`, `zoom.pinch`, imperative `chart.zoom(factor)` all verified against source. D-06's "initial zoom state over the full dataset" pattern is directly implementable by setting `scales.x.min`/`max` at chart construction — see Code Examples. |
| TRN-02 | User can scroll/pan charts horizontally, with explicit +/− and left/right controls in addition to gestures (controls must work without a pointer) | `pan.enabled`/`pan.mode: 'x'` wires Hammer-driven drag pan (gesture half); `chart.pan({x: deltaPx})` is the exact imperative API the buttons call, verified to interpret `delta` in **pixels**, not data units, with a sign convention verified against source (see Pitfall 5). All-native `<button>` elements give free keyboard operability, matching D-11. |
| TRN-03 | Chart bands are taller than the current fixed 140px so the y-axis has usable range on a page with room to spare | `.chart-band__canvas-wrap` currently declares `height: 140px` unconditionally (`styles.css:1006-1008`) with one `@media (max-width: 380px)` override to `112px` (`styles.css:1011-1015`) — confirmed by direct read, this is one of exactly two `@media (max-width: 380px)` blocks in the whole stylesheet (the other is `.pr-evolution-card__canvas-wrap`), an invariant `styles.test.ts`'s `IN-06/GC-7` test (line 1928) enforces by exact count. Chart.js's official responsive-chart guidance and its ResizeObserver implementation (read directly from `chart.js@4.5.1`'s bundled source) confirm a `clamp()`+`vh`-sized container is a supported, standard case for `maintainAspectRatio: false` — see Common Pitfalls for the one real risk (mobile `vh` + toolbar collapse). |
| TRN-04 | Zoom/pan composes correctly with the existing granularity toggle and the five-tab structure, and does not regress the canvas lifecycle (no "Canvas is already in use" on tab cycling) | Read Chart.js core's plugin-service source directly: a plugin passed via a chart's own `plugins: [...]` array (D-05's chosen mechanism) receives the *identical* `start`/`stop` lifecycle as a globally-registered plugin, scoped to that one chart instance. `chart.destroy()` triggers `afterDestroy` → `stop` on every plugin descriptor, and `chartjs-plugin-zoom`'s own `stop` hook (`removeListeners` + `stopHammer` + `removeState`) tears down its wheel/drag listeners and destroys its `Hammer.Manager`. The existing destroy-and-rebuild pattern this codebase already uses (18-UI-SPEC § 7) is therefore sufficient — no extra manual teardown code is needed for the zoom plugin specifically. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `chartjs-plugin-zoom` | `^2.2.0` | Wheel/pinch zoom, drag/touch pan, imperative zoom/pan/reset API for Chart.js charts | The official Chart.js-org zoom plugin (`chartjs/chartjs-plugin-zoom` on GitHub, published under the `chart.js` npm scope umbrella). `[VERIFIED: npm registry]` — peer-dependency-compatible with the installed `chart.js@4.5.1` (`peerDependencies: {"chart.js": ">=3.2.0"}`), 435,218 downloads/week, actively released (latest 2.2.0 published 2025-09-18, prior releases show a healthy cadence back to 2016). No maintained fork improves on it (see Package Legitimacy Audit). |
| `hammerjs` | `^2.0.8` | Gesture recognition (pinch, pan/drag) that `chartjs-plugin-zoom` depends on for all non-wheel interaction | `[VERIFIED: npm registry]` — a **hard runtime dependency** of `chartjs-plugin-zoom@2.2.0` (`"dependencies": {"hammerjs": "^2.0.8", ...}` in that package's own `package.json`, confirmed by direct install). D-16 already accepts this dependency knowingly; see Common Pitfalls Pitfall 4 for the corrected scope of what it's needed for. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | No additional supporting libraries needed | The plugin's own imperative API (`chart.zoom`, `chart.pan`, `chart.resetZoom`, `chart.getZoomLevel`, `chart.isZoomedOrPanned`) covers every button/state need in D-11. No date-math or DOM-utility library is needed beyond what this codebase already has. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chartjs-plugin-zoom@2.2.0` + `hammerjs` | `@flora-suite/chartjs-plugin-zoom@1.0.0` | Found via web search as a "fork." On inspection it is a single-version (published 2025-05-28), unofficial republish of the same code that still depends on `hammerjs@^2.0.8` — it does not remove or replace the Hammer dependency, has no independent commit history visible via `npm view`, and offers no advantage. `[ASSUMED — not recommended]`. |
| `chartjs-plugin-zoom` (Hammer-based pan/pinch) | Hand-rolled pointer-events pan/pinch | Rejected structurally: this is exactly the "Don't Hand-Roll" case below. Chart.js's own scale-pixel math (`getPixelForValue`/`getValueForPixel`), zoom-limit clamping, and pinch-center math are non-trivial to reproduce correctly, and D-16 already priced in the Hammer.js cost. |
| Native CSS `vh` for D-19's band height | `dvh` (dynamic viewport height) | `dvh` sidesteps the well-documented mobile-Safari issue where `vh` recomputes as the address bar collapses/expands during scroll (see Common Pitfalls, Pitfall 6). `dvh` has been supported in Safari since 15.4 (2022) and Chrome since 108 (2022) — safely available in 2026. Recommended over plain `vh` for the D-19 clamp; this is Claude's Discretion territory per CONTEXT.md, not a locked decision. |

**Installation:**
```bash
npm install chartjs-plugin-zoom@^2.2.0 hammerjs@^2.0.8
```

**Version verification:** Confirmed live against the npm registry and by a real (then-reverted) local install:
```
$ npm view chartjs-plugin-zoom version        # 2.2.0
$ npm view chartjs-plugin-zoom peerDependencies # { 'chart.js': '>=3.2.0' }
$ npm view chartjs-plugin-zoom dependencies     # { hammerjs: '^2.0.8', '@types/hammerjs': '^2.0.45' }
$ npm view hammerjs version                    # 2.0.8 (published 2022-11-18 — see Package Legitimacy Audit)
$ node -e "console.log(require('./node_modules/chart.js/package.json').version)"  # 4.5.1 — matches package.json's "^4.5.1"
```
`package.json` in this repo declares `"chart.js": "^4.5.1"` with no `chartjs-plugin-zoom`/`hammerjs` entries today — both are genuinely new dependencies for this phase, matching D-16's framing. **Process note for future research sessions:** the `slopcheck install` subcommand (see Package Legitimacy Audit below) performs a *real* `npm install`, modifying `package.json`/`package-lock.json` in the working tree — this research session ran it, confirmed the OK verdicts, and then `git checkout -- package.json package-lock.json` to leave the repo clean (verified via `git status`). Future research agents should expect this side effect and revert it the same way; it is not itself a defect in the tool, but it must not be left uncommitted-and-forgotten in a research-only session.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads/week | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------------|--------------|-----------|-------------|
| `chartjs-plugin-zoom` | npm | Created 2016-10-23 (registry); latest release 2.2.0, 2025-09-18 | 435,218 | `github.com/chartjs/chartjs-plugin-zoom` (not archived, last push 2025-02-17, 622 stars) | `[OK]` | Approved |
| `hammerjs` | npm | Created 2013-02-27; **last release 2.0.8, 2022-11-18** (~3.75 years stale as of this research) | 1,587,784 | `github.com/hammerjs/hammer.js` (not archived, last push 2026-01-04, 317 open issues) | `[OK]` | Approved, with the unmaintained-status caveat D-16 already records |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none — both packages passed `slopcheck` cleanly (`[92m[OK]` for both, run as `slopcheck install chartjs-plugin-zoom hammerjs`).

**Package name provenance:** Both package names were discovered via WebSearch/training knowledge *and* independently confirmed present in official documentation (`chartjs.org/chartjs-plugin-zoom`, `chartjs-plugin-zoom`'s own `package.json` naming `hammerjs` as a dependency) *and* passed `slopcheck`. Per the provenance rule, this combination qualifies for `[VERIFIED: npm registry]` tagging above — both names came from an authoritative source (the plugin's own shipped `package.json` and its official docs site), not merely a search-engine hit.

**No suspicious postinstall scripts found:**
```
$ npm view chartjs-plugin-zoom scripts.postinstall   # (empty)
$ npm view hammerjs scripts.postinstall               # (empty)
```

**Hammer.js maintenance status, stated plainly (this is what D-16 asked research to confirm):** `hammerjs` has had no new npm release since 2022-11-18 (v2.0.8). Its GitHub repo is **not archived** and shows a push as recent as 2026-01-04 (likely docs/CI/community-merge activity, not a new npm-published version), and carries 317 open issues. No maintained fork exists that drops the Hammer dependency — `@flora-suite/chartjs-plugin-zoom` (the only alternative surfaced by search) is a single-version, unofficial republish that itself still depends on `hammerjs@^2.0.8`. There is an open, unresolved GitHub issue on the upstream plugin repo (`chartjs/chartjs-plugin-zoom#938`, "Find a solution for hammerjs") acknowledging the problem with no maintainer-stated timeline or resolution as of this research. **Conclusion: D-16's decision to take the dependency, with its unmaintained status recorded rather than hidden, is confirmed to be the only currently-viable path** — there is no pointer-events-native alternative or maintained fork to switch to instead.

## Architecture Patterns

### System Architecture Diagram

```
User gesture / button press
        │
        ├─ Wheel (⌘/Ctrl+scroll) ──────────┐
        ├─ Mouse/touch drag on canvas ─────┤   (Hammer.Manager, wired by
        ├─ Pinch (touch) ───────────────────┤    chartjs-plugin-zoom's
        │                                    │    `start` plugin hook)
        └─ +/−/←/→/Reset <button> click ────┤
                                             ▼
                              chartjs-plugin-zoom (per-chart-instance
                              `plugins: [...]`, NOT Chart.register)
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                 ▼
            scale.options.min/max  onZoom/onPan   onZoomComplete/
            updated (D-07: x-only)  (continuous,  onPanComplete
                    │                every tick)  (gesture-settle
                    ▼                    │         ONLY — see
            chart.update()               │         Pitfall 3)
                    │                    │              │
                    ▼                    └──────┬───────┘
        Chart.js re-renders visible             ▼
        window, y-axis auto-rescales    updateAriaLabelAndControls()
        to the new x range (D-07)       (D-13 aria-label rewrite,
                    │                    D-11 Reset visibility/
                    │                    disabled state)
                    │                            ▲
                    │            Button handlers call this DIRECTLY
                    │            too (not just via onZoomComplete/
                    │            onPanComplete) — see Pitfall 3
                    ▼
        View-closure state updated (D-22: per-tab x min/max,
        survives tab switch, resets on full unmount)
                    │
                    ▼
        Tab switch → destroyActiveChart() → chart.destroy()
        → Chart.js `afterDestroy` → plugin `stop` hook fires
        automatically → Hammer.Manager destroyed, listeners
        removed (TRN-04 — no extra teardown code needed)
                    │
                    ▼
        Tab switched back → chart rebuilt with `scales.x.min/max`
        set from the saved D-22 state (or D-06 default if none) →
        same destroy-and-rebuild pattern this codebase already uses
```

### Recommended Project Structure

No new files are structurally required by the plugin itself (D-05 wires it per-instance inside the existing `trends-charts.ts` mount functions), but CONTEXT.md's own Claude's-Discretion list flags exactly the split that should happen:

```
src/dashboard/views/
├── trends-charts.ts          # existing — gains `plugins: [chartjsPluginZoom]` per zoomable
│                              # chart's construction (mountVolumeChart, buildChannelBand,
│                              # mountTrainingLoadChart), and the D-10 control-cluster DOM
├── trends-zoom-logic.ts      # NEW — pure, DOM-free: D-06 default-window computation,
│                              # D-09 limits computation, D-12 zoom-factor/pan-pixel math,
│                              # D-13 range→aria-label text formatting. Unit-testable under
│                              # this repo's `environment: 'node'` vitest config (no DOM
│                              # needed for any of this — mirrors the existing
│                              # `trends-training-load-logic.ts` / `trends-volume-logic.ts`
│                              # split, D-04's extraction requirement)
├── chart-theme.ts            # existing — D-04 candidate home if the zoom-config-building
│                              # (not the pure math above) is judged shared-enough to extract
│                              # for a future detail-view adoption
└── trends.ts                 # existing — gains D-22's per-tab zoom-state slots in the
                               # existing within-tab-state block (trends.ts:427-452)
```

### Pattern 1: Per-instance plugin registration (D-05), verified against Chart.js's plugin service

**What:** Pass `chartjsPluginZoom` via each zoomable chart's own `plugins: [...]` array in its `new Chart(...)` config, never via the module-wide `Chart.register(...)` call at `trends-charts.ts:57-68`.

**When to use:** Every zoomable chart (Volume, Cadence & HR ×2, Training Load) — never YoY or Gear (D-01).

**Verification (HIGH confidence, read directly from installed source — `chart.js@4.5.1` `dist/chart.js`):**
```javascript
// Chart.js core's plugin service (chart.js/dist/chart.js) — confirms local
// (per-instance) plugins get the SAME lifecycle as globally registered ones:
function allPlugins(config) {
  const plugins = [...registry.plugins.items()]; // globally registered
  const local = config.plugins || [];             // per-chart `plugins: [...]`
  for (const plugin of local) {
    if (plugins.indexOf(plugin) === -1) plugins.push(plugin); // merged, same treatment
  }
  return { plugins, localIds };
}
// `stop` fires automatically for every plugin descriptor on chart.destroy():
notify(chart, hook) {
  // ...
  if (hook === 'afterDestroy') {
    this._notify(descriptors, chart, 'stop');   // <-- chartjs-plugin-zoom's own
    this._notify(this._init, chart, 'uninstall'); //     stop() hook runs here
  }
}
```
This is the exact mechanism that makes D-05's "structural exclusion" claim true (YoY/Gear literally never construct a chart with the plugin in its `plugins:` array, so they cannot zoom, vs. an opt-out flag a future chart could forget) and confirms `chart.destroy()` alone is sufficient teardown.

**Example — a zoomable chart's construction shape** (illustrative, mirrors `mountVolumeChart`'s existing structure):
```typescript
// Source: verified against chartjs-plugin-zoom@2.2.0's shipped dist/chartjs-plugin-zoom.esm.js
import zoomPlugin from 'chartjs-plugin-zoom';

const chart = new Chart(canvas, {
  type: 'bar',
  data: { /* ... */ },
  plugins: [zoomPlugin], // D-05 — per-instance, NOT Chart.register
  options: {
    scales: {
      x: {
        type: 'linear',
        // D-06: initial view is the granularity's default window, expressed
        // as scale bounds, NOT a filtered dataset — the underlying `data`
        // array always holds every point.
        min: defaultWindowStartMs,
        max: defaultWindowEndMs,
      },
    },
    plugins: {
      zoom: {
        limits: {
          // D-09 — MUST be literal computed numbers, NEVER the 'original'
          // sentinel string. See Pitfall 1.
          x: { min: archiveStartMs, max: archiveEndMs, minRange: minSpanMs },
        },
        pan: {
          enabled: true,
          mode: 'x', // D-07
          // D-15's plain mouse drag pan goes through Hammer too — see Pitfall 4
        },
        zoom: {
          wheel: { enabled: true, modifierKey: isMac ? 'meta' : 'ctrl' }, // D-14, Pitfall 2
          pinch: { enabled: true }, // D-16
          mode: 'x', // D-07
          drag: { enabled: false }, // MUST stay false — see Pitfall 4's drag-vs-pan note
        },
        onZoomComplete: ({ chart }) => onSettle(chart),
        onPanComplete: ({ chart }) => onSettle(chart),
      },
    },
  },
});
```

### Anti-Patterns to Avoid

- **Relying only on `onZoomComplete`/`onPanComplete` for button-driven UI updates:** these callbacks are wired to the gesture path only. Every button handler must call the settle-update function directly too — see Pitfall 3.
- **Using `limits.x.min/max: 'original'` when the initial scale bounds are the D-06 default window, not the full archive:** this silently caps pan/zoom-out at the granularity's opening window instead of the full data range D-09 wants — see Pitfall 1.
- **Enabling both `zoom.drag` and `pan` on the same chart:** they are two different gesture engines (native mouse listeners vs. Hammer) competing for the same physical drag on the canvas. D-15 wants plain drag-to-pan; leave `zoom.drag.enabled` at its default `false`.
- **Registering the plugin module-wide via `Chart.register(...)`:** defeats D-05's structural-exclusion guarantee for YoY/Gear.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wheel/pinch/drag zoom-to-pixel math | A custom `wheel`/`touchmove` handler computing new scale bounds | `chartjs-plugin-zoom`'s `zoomNumericalScale`/`panNumericalScale` (verified against source: `linearZoomDelta`, `getValueForPixel`/`getPixelForValue` round-tripping, focal-point-preserving zoom) | Getting focal-point-preserving zoom and pixel-accurate pan correct against a `'linear'` scale with a live y-axis rescale is exactly the kind of "looks right until you test the edges" problem this project has shipped defects on three times (16-09, 17-15, 19-05) |
| Pinch gesture recognition | Custom multi-touch `touchstart`/`touchmove`/`touchend` tracking, distance/angle math | Hammer.js's `Hammer.Pinch` recognizer (already a hard dependency of the chosen plugin) | Multi-touch gesture disambiguation (pinch vs. two-finger scroll vs. accidental double-tap) is a well-known hard problem; D-16 already prices in taking this dependency rather than reinventing it |
| Zoom/pan clamping to data bounds | Manual min/max comparisons scattered through button handlers | `limits.x.{min,max,minRange}` in the plugin config, resolved once | Centralizes D-09's clamp logic in one place the plugin itself enforces on every gesture AND every imperative call, rather than re-deriving "am I at the edge" per button |
| Reading the current visible range for the D-13 aria-label | Manually tracking `scale.min`/`scale.max` via a mutation observer or a private cache | `chart.scales.x.min` / `chart.scales.x.max` (read directly off the live Chart.js scale object after any `chart.update()`), or `chart.getZoomedScaleBounds()` | Chart.js's scale object is already the single source of truth for the currently-rendered range; no separate bookkeeping needed |

**Key insight:** every one of these "don't hand-roll" items is already solved *inside* the dependency D-16 already committed to taking — the risk in this phase is not reinventing plugin internals, it's mis-wiring the plugin's actual callback/API surface (Pitfalls 1-5 below), which is a much easier trap to fall into unnoticed.

## Common Pitfalls

### Pitfall 1: `limits.x.min/max: 'original'` silently caps the wrong range

**What goes wrong:** D-09 wants pan/zoom-out limits to be the full archive's date range. If the planner reaches for the plugin's documented `'original'` sentinel (`limits: { x: { min: 'original', max: 'original' } }`, meaning "clamp to the scale's bounds as configured at chart construction"), and the chart is constructed with `scales.x.min/max` already set to the D-06 default window (not the full archive, per D-06's design) — `'original'` resolves to the *default window*, not the full dataset. The `−` button and pan would then hard-stop at the granularity's opening view, never reaching the true archive edges.

**Why it happens:** Read directly from source (`chartjs-plugin-zoom@2.2.0`, `getLimit`/`storeOriginalScaleLimits`): `'original'` is captured **lazily, on the first zoom/pan/reset call**, from whatever `scale.options.min`/`max` happen to be at that moment — which, under D-06, is the granularity's default window, not the archive bounds.
```javascript
// verified: dist/chartjs-plugin-zoom.esm.js
function getLimit(state, scale, scaleLimits, prop, fallback) {
  let limit = scaleLimits[prop];
  if (limit === 'original') {
    const original = state.originalScaleLimits[scale.id][prop]; // <-- captured at
    limit = valueOrDefault(original.options, original.scale);   //     FIRST zoom/pan,
  }                                                              //     = D-06 default,
  return valueOrDefault(limit, fallback);                       //     NOT the archive
}
```

**How to avoid:** Compute the true archive-wide min/max (e.g., `Math.min(...allPoints.map(p => p.x))` / `Math.max(...)`, or "now" for the open end) as **literal numbers** and pass those to `limits.x.min/max` — never the `'original'` string, for any chart whose D-06 initial window is narrower than its full dataset (true of every zoomable chart in this phase).

**Warning signs:** the `−` button (or repeated pinch-out) stops working well before the chart reaches "show everything," even though `chart.resetZoom()` correctly returns to the D-06 default — a symptom that would look like a bug in D-11's "cap zoom-out at the full range," not in `limits`.

### Pitfall 2: `zoom.wheel.modifierKey` only accepts one platform's key at a time

**What goes wrong:** D-14 wants "⌘/Ctrl + wheel." The plugin's `modifierKey` option is a single string (`'ctrl' | 'alt' | 'shift' | 'meta'`, checked internally as `event[key + 'Key']`) — there is no array/either-of form in this version.

**Why it happens:** Verified against source (`getModifierKey`/`keyNotPressed`, `dist/chartjs-plugin-zoom.esm.js` lines 10-12):
```javascript
const getModifierKey = opts => opts && opts.enabled && opts.modifierKey;
const keyNotPressed = (key, event) => key && !event[key + 'Key']; // single key only
```
On macOS, the Cmd key sets `event.metaKey`, not `event.ctrlKey`; setting `modifierKey: 'ctrl'` would not recognize a Mac user's ⌘, and `modifierKey: 'meta'` would not recognize a Windows/Linux user's Ctrl.

**How to avoid:** Resolve the platform once (e.g., via `navigator.userAgentData?.platform` with a `navigator.platform`/UA-string fallback for browsers that haven't shipped `userAgentData`) and set `modifierKey: 'meta'` on macOS, `'ctrl'` elsewhere, at chart construction time.

**Warning signs:** ⌘+scroll does nothing on a Mac in dev, while Ctrl+scroll (tested via an external Windows keyboard's Ctrl key, or browser DevTools device emulation which doesn't emulate `metaKey` correctly) appears to work — an easy false-negative in cross-platform manual testing.

### Pitfall 3: `chart.zoom()`/`chart.pan()` (the button API) do not fire `onZoomComplete`/`onPanComplete`

**What goes wrong:** D-13's aria-label rewrite and D-11's Reset-visibility/disabled-button-state updates are specified to happen "on every zoom/pan settle," and the natural first implementation is to put all of that update logic inside the `onZoomComplete`/`onPanComplete` plugin callbacks. That works for gesture-driven zoom/pan (wheel, drag, pinch) — but the D-11 +/−/←/→ buttons call `chart.zoom(factor)`/`chart.pan({x: delta})` directly, and **those calls never invoke the "Complete" callbacks.**

**Why it happens:** Verified directly from source (`dist/chartjs-plugin-zoom.esm.js`):
```javascript
function zoom(chart, amount, transition = 'none', trigger = 'api') {
  // ... applies the zoom ...
  callback(zoomOptions.onZoom, [{chart, trigger}]);   // <-- onZoom, NOT onZoomComplete
}
function pan(chart, delta, enabledScales, transition = 'none') {
  // ... applies the pan ...
  callback(onPan, [{chart}]);                          // <-- onPan, NOT onPanComplete
}
// chart.pan/chart.zoom are wired directly to these two functions:
chart.pan = (delta, panScales, transition) => pan(chart, delta, panScales, transition);
chart.zoom = (args, transition) => zoom(chart, args, transition);
```
`onZoomComplete`/`onPanComplete` are fired only from the gesture-handling code paths: a **250ms-debounced** wrapper on the wheel handler, `mouseup` after a drag, Hammer's `panend`/`pinchend` events, and (uniquely) `chart.resetZoom()` (which calls `onZoomComplete` directly, but never `onPanComplete`, even though it also resets the pan position).

**How to avoid:** Extract a single `onSettle(chart)` function (updates the aria-label per D-13, updates Reset visibility and the four buttons' disabled state per D-11) and call it from **two** places: (a) as the value of `onZoomComplete`/`onPanComplete` in the chart's zoom plugin config, for gesture-driven settles, and (b) **explicitly, synchronously, right after** every button click handler calls `chart.zoom(...)`/`chart.pan(...)`/`chart.resetZoom(...)`.

**Warning signs:** pressing +/−/←/→ visibly moves the chart, but the aria-label text and the Reset button's appearance never change — a defect this repo's DOM-less test suite cannot see, and one a sighted human tester could easily miss too if they're only watching the chart move and not reading the aria-label or noticing Reset's exact appear/disappear timing. This is precisely the class of defect the D-25 checkpoint's "read the range back, don't just watch it move" discipline exists to catch — make this an explicit named check in the plan's checkpoint rows, not an assumed side effect of "the button works."

### Pitfall 4: Hammer.js is required for ALL panning (mouse included), not just touch/pinch — and `zoom.drag`/`pan` are two different gesture engines

**What goes wrong (two related traps):**
1. Assuming (as D-16's own stated reasoning does) that Hammer.js can be scoped to "touch and pinch only" while ordinary desktop mouse-drag pan works independently of it. It cannot, in this version.
2. Enabling both `zoom.drag.enabled` and `pan.enabled` at once, expecting them to "just work together" for D-15's drag-to-pan — they are two independently-wired gesture systems (native `mousedown`/`mouseup` listeners for `zoom.drag`'s rectangle-select-zoom vs. `Hammer.Manager`'s `Hammer.Pan` recognizer for `pan`) that both attach to the same canvas drag gesture.

**Why it happens:** Verified directly from source:
```javascript
// pan is wired through Hammer regardless of pointer type:
function startHammer(chart, options) {
  const mc = new Hammer.Manager(canvas);
  if (zoomOptions && zoomOptions.pinch.enabled) { mc.add(new Hammer.Pinch()); /* ... */ }
  if (panOptions && panOptions.enabled) {
    mc.add(new Hammer.Pan({ threshold: panOptions.threshold, enable: createEnabler(chart, state) }));
    mc.on('panstart', ...); mc.on('panmove', ...); mc.on('panend', ...);
  }
}
// zoom.drag (rectangle-select zoom — a DIFFERENT feature from `pan`) is wired
// via plain native listeners, entirely separately:
function addListeners(chart, options) {
  if (dragOptions.enabled) {
    addHandler(chart, canvas, 'mousedown', mouseDown);
    addHandler(chart, canvas.ownerDocument, 'mouseup', mouseUp);
  }
}
```
This means D-16's own text — "wheel and mouse-drag paths work without [Hammer.js]" — is not accurate against the shipped v2.2.0 code for the *pan* mouse-drag path (D-15's chosen mechanism); only `zoom.wheel` and `zoom.drag` (the rectangle-select feature, which D-15 does **not** use) avoid Hammer.

**How to avoid:** Take D-16's dependency decision as-is (already locked, and correct regardless of this scope correction), but do not architect around an assumption that Hammer could later be made touch-only or lazy-loaded only on touch devices — it is required for the desktop drag-to-pan gesture too. Keep `zoom.drag.enabled` at its default `false`; only `pan.enabled: true` implements D-15.

**Warning signs:** none at the code level — this is purely a documentation-accuracy correction for the planner's mental model, not a functional risk, since D-16 already takes the dependency unconditionally.

### Pitfall 5: `chart.pan(delta)`'s `delta` is in **pixels**, with a sign that is easy to get backwards

**What goes wrong:** D-12 specifies "~25% of the visible range" per button press. Implementing this naively as a *data-value* delta (e.g., 25% of `scale.max - scale.min` in epoch-ms) silently does nothing, or pans by a wildly wrong amount, because the plugin's `pan()` function interprets `delta` as **screen pixels**, converted through the scale's own pixel↔value mapping.

**Why it happens:** Verified from source:
```javascript
function panNumericalScale(scale, delta, limits, pan = false) {
  const {min: prevStart, max: prevEnd, options} = scale;
  const newMin = scale.getValueForPixel(scale.getPixelForValue(prevStart) - delta); // pixels
  const newMax = scale.getValueForPixel(scale.getPixelForValue(prevEnd) - delta);
  return updateRange(scale, {min: newMin, max: newMax}, limits, pan ? 'pan' : false);
}
```
The correct button implementation computes `deltaPx = 0.25 * (scale.right - scale.left)` (i.e., 25% of the plot area's pixel width), not 25% of the data-value range.

**The sign is also easy to invert.** Tracing the drag-gesture path for calibration: `handlePan` calls `pan(chart, {x: e.deltaX - priorDelta.x, ...})` where `e.deltaX` is Hammer's cumulative rightward-drag distance in pixels (positive = dragged right). A positive `x` delta therefore corresponds to the *drag-right* gesture, which — per the pixel math above — **decreases** the resulting `min`/`max` (shows *earlier*, smaller-value data), matching the standard "drag right reveals content that was off-screen to the left" scroll convention. For the on-screen buttons this means:
- **`→` (show later/more-recent data)** must call `chart.pan({x: -deltaPx})` — a *negative* x delta.
- **`←` (show earlier data)** must call `chart.pan({x: +deltaPx})` — a *positive* x delta.

**How to avoid:** Compute `deltaPx` from `chart.chartArea` (or the x scale's own `.left`/`.right`) at click time, not from a percentage of the data-value range, and apply the sign mapping above. Verify empirically once at the checkpoint: press `→` and confirm the aria-label's date range moves to *later* dates, not earlier ones — an inverted sign is exactly the kind of thing that reads as "it works" if you only glance at the chart moving, without reading which direction it moved.

**Warning signs:** the chart visibly pans on button press (looks correct at a glance), but `→` reveals older/earlier data instead of newer/later data — only detectable by reading the D-13 aria-label or axis labels, not by watching the chart shift.

### Pitfall 6: `vh`-based band height on mobile Safari (D-19/D-21)

**What goes wrong:** `clamp(180px, 34vh, 420px)` uses `vh`, whose resolved pixel value on mobile Safari (and some other mobile browsers) **changes as the address-bar/toolbar chrome collapses and expands during scroll** — a long-documented mobile-viewport quirk, not a Chart.js-specific bug. Each such change fires Chart.js's `ResizeObserver` (confirmed present and active in the installed `chart.js@4.5.1` source: `createResizeObserver`, watching the canvas's parent container per the official responsive-charts documentation's own guidance that the container must be "relatively positioned and dedicated to the chart canvas only" — which `.chart-band__canvas-wrap` already satisfies), causing the chart to visibly resize mid-scroll.

**Why it happens:** This is a well-known browser behavior (Safari's `100vh` historically includes/excludes the collapsing toolbar inconsistently across scroll states), not something specific to this codebase or this plugin. It does **not** create an infinite resize loop (the container's size is driven by the CSS viewport unit and toolbar state, not by the chart's own rendered output, so there's no feedback cycle) — but it can look janky, and is exactly the kind of thing a synthetic/emulated-viewport browser check (DevTools device emulation, which does not simulate real toolbar collapse behavior) will not catch.

**How to avoid:** Prefer `dvh` (dynamic viewport height) over plain `vh` for the D-19 clamp — `dvh` has been supported in Safari since 15.4 and Chrome since 108 (both years-old as of 2026) and is designed specifically to handle this case more gracefully. This is Claude's Discretion territory (CONTEXT.md leaves the exact unit/values open), not a locked decision, so it's a recommendation, not a requirement.

**Warning signs:** this is exactly the kind of defect that requires a **real mobile Safari device or a real-device remote-debug session**, not Chrome DevTools' device-emulation mode — flag explicitly in the checkpoint (see Validation Architecture) as something DevTools emulation cannot substitute for.

### Pitfall 7: A third `@media (max-width: 380px)` block silently breaks `styles.test.ts`'s `IN-06/GC-7` invariant

**What goes wrong:** `styles.css` currently has **exactly two** `@media (max-width: 380px)` blocks (`.chart-band__canvas-wrap` at line 1011, `.pr-evolution-card__canvas-wrap` at line 1360 — confirmed by direct grep), and both a stylesheet comment (`styles.css:882-884`, "`styles.css` now has exactly TWO `@media (max-width: 380px)` blocks") and a test (`styles.test.ts`, `IN-06/GC-7`, line 1928) assert this exact count. If D-21's small-screen floor for `.chart-band__canvas-wrap--tall` is implemented as a **new, third** `@media (max-width: 380px)` block, `IN-06/GC-7` goes red immediately — and CONTEXT.md's own D-21 text already flags this exact risk.

**Why it happens:** `.chart-band__canvas-wrap--tall` is a new, additive class (D-18); the most natural first-draft implementation is to give it its own small-screen override at the same breakpoint the existing (unmodified, per D-18) `.chart-band__canvas-wrap` rule already uses, for visual consistency — which is precisely what breaks the count invariant.

**How to avoid:** Two valid options, both requiring the same discipline: (a) pick a **different, explicitly-justified breakpoint** for `.chart-band__canvas-wrap--tall`'s floor (matching D-21's own instruction to justify the value "against real phone widths, not inherited" — Phase 22's Round 3→4 history is the cautionary precedent for inheriting 380px without re-testing it), which naturally avoids colliding with the `IN-06/GC-7` count; or (b) if 380px genuinely is the right value, update **both** the `styles.css:882-884` comment (now "three" or otherwise re-worded) **and** the `styles.test.ts` `IN-06/GC-7` test's expected count, in the same change — never one without the other.

**Warning signs:** `npm test` fails on `IN-06/GC-7` immediately after adding the new breakpoint — this is a fast, reliable, automated signal (unlike most of this phase's other risks), so there is no excuse for this one reaching the browser checkpoint undetected.

## Code Examples

### Setting up a zoomable chart's x-scale bounds for D-06's opening picture and D-22's restore-on-rebuild

```typescript
// Source: verified pattern against chartjs-plugin-zoom@2.2.0 source + this
// codebase's existing mountVolumeChart shape (trends-charts.ts:105-173)
function mountZoomableVolumeChart(
  canvas: HTMLCanvasElement,
  points: readonly VolumePoint[],
  granularity: VolumeGranularity,
  // D-22: `null` on first open for this granularity (use the D-06 default);
  // a saved {min, max} when restoring after a tab switch.
  savedRange: { min: number; max: number } | null
): ChartHandle {
  const { min: archiveStartMs, max: archiveEndMs } = getArchiveBounds(points); // pure, in trends-zoom-logic.ts
  const { min: windowStartMs, max: windowEndMs } =
    savedRange ?? computeDefaultWindow(granularity, archiveStartMs, archiveEndMs); // D-06, pure

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { datasets: [{ data: points.map((p) => ({ x: p.x, y: p.km })) }] },
    plugins: [zoomPlugin], // D-05
    options: {
      scales: {
        x: {
          type: 'linear',
          min: windowStartMs, // D-06 default OR D-22 restored state — same mechanism
          max: windowEndMs,
        },
      },
      plugins: {
        zoom: {
          limits: {
            // Pitfall 1: literal numbers, never 'original', because the
            // scale's constructed bounds are the D-06 window, not the archive.
            x: { min: archiveStartMs, max: archiveEndMs, minRange: minSpanForGranularity(granularity) },
          },
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true, modifierKey: platformModifierKey() }, // Pitfall 2
            pinch: { enabled: true },
            mode: 'x',
          },
          onZoomComplete: ({ chart }) => onSettle(chart),
          onPanComplete: ({ chart }) => onSettle(chart),
        },
      },
    },
  });
  // ... existing ChartHandle wrapper, destroy() unchanged (Pattern 1 confirms
  // chart.destroy() alone is sufficient teardown for the plugin + Hammer)
}
```

### Button handlers — explicit settle call, correct pixel/sign math (Pitfalls 3 & 5)

```typescript
// Source: verified against chartjs-plugin-zoom@2.2.0's panNumericalScale/zoomNumericalScale
function wireZoomControls(chart: Chart, cluster: ZoomControlCluster): void {
  const zoomIn = () => { chart.zoom(1.5); onSettle(chart); };   // Pitfall 3: explicit call
  const zoomOut = () => { chart.zoom(1 / 1.5); onSettle(chart); };
  const panForward = () => {
    const deltaPx = 0.25 * (chart.chartArea.right - chart.chartArea.left);
    chart.pan({ x: -deltaPx }); // Pitfall 5: NEGATIVE x moves the view LATER
    onSettle(chart);
  };
  const panBackward = () => {
    const deltaPx = 0.25 * (chart.chartArea.right - chart.chartArea.left);
    chart.pan({ x: deltaPx }); // POSITIVE x moves the view EARLIER
    onSettle(chart);
  };
  const reset = () => { chart.resetZoom(); /* resetZoom() already calls onZoomComplete internally */ };

  cluster.zoomInBtn.addEventListener('click', zoomIn);
  cluster.zoomOutBtn.addEventListener('click', zoomOut);
  cluster.panForwardBtn.addEventListener('click', panForward);
  cluster.panBackwardBtn.addEventListener('click', panBackward);
  cluster.resetBtn.addEventListener('click', reset);
}

// Called from BOTH the plugin's onZoomComplete/onPanComplete AND directly
// after every button click above (Pitfall 3).
function onSettle(chart: Chart): void {
  const xScale = chart.scales.x;
  updateAriaLabel(chart.canvas, xScale.min, xScale.max); // D-13
  const isZoomed = chart.isZoomedOrPanned();
  cluster.resetBtn.hidden = !isZoomed; // D-11: Reset appears only when zoomed
  cluster.panBackwardBtn.disabled = xScale.min <= archiveStartMs; // D-11 clamp disable
  cluster.panForwardBtn.disabled = xScale.max >= archiveEndMs;
  cluster.zoomOutBtn.disabled = xScale.max - xScale.min >= archiveEndMs - archiveStartMs;
}
```

### Cross-platform wheel modifier key (Pitfall 2)

```typescript
// No existing precedent in this codebase for platform detection — new code.
function platformModifierKey(): 'meta' | 'ctrl' {
  const platform =
    (navigator as any).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac/i.test(platform) ? 'meta' : 'ctrl';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `chartjs-plugin-zoom@0.7.x` for Chart.js 2.6-2.9 | `chartjs-plugin-zoom@2.x` for Chart.js 3.2+ | Major rewrite alongside Chart.js 3 (documented on the plugin's own docs site) | Not directly relevant here — this repo is already on Chart.js 4.5.1, squarely inside `2.x`'s supported range; no migration path needed |
| `zoom.enabled` / `pan.enabled` as flat top-level toggles | Split into `zoom.wheel.enabled` / `zoom.drag.enabled` / `zoom.pinch.enabled` (each independently configurable) | Some point in the `2.x` line, prior to 2.2.0 | The plugin actively `console.warn`s if the old flat `zoom.enabled` key is present in config (verified in source, `plugin.start`) — a useful smoke-test: if this warning ever appears in the console during development, the config shape is stale |
| Training Load window as a dataset slicer (18-D16, shipped) | Training Load window as zoom presets over an always-full dataset (D-03, this phase) | This phase | `sliceLoadWindow` stops gating what the chart *displays*; LTTB decimation now always samples from the full 5,000+-day series (D-03(b)'s explicit checkpoint item) |

**Deprecated/outdated:** none of the plugin's exposed API surface used by this phase's decisions (`zoom.wheel`, `zoom.pinch`, `pan`, `limits`, `chart.zoom/pan/resetZoom`) is flagged deprecated as of `2.2.0`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `dvh` is a better choice than `vh` for D-19's clamp, on mobile-Safari-toolbar-collapse grounds | Common Pitfalls, Pitfall 6 | Low — this is explicitly Claude's Discretion in CONTEXT.md, not a locked decision; if wrong, `vh` remains a safe, if slightly less polished, fallback and the plan can note it as a discretionary swap |
| A2 | `navigator.userAgentData?.platform` / `navigator.platform` reliably distinguishes macOS from Windows/Linux for the purposes of picking `'meta'` vs `'ctrl'` as `zoom.wheel.modifierKey` | Common Pitfalls, Pitfall 2; Code Examples | Low-Medium — `navigator.platform` is a long-deprecated-but-still-functional API; if a future browser removes it entirely before `userAgentData` is universal, the modifier-key detection would need a different signal (e.g., listening for the first Cmd-vs-Ctrl keydown and remembering it). Flagged here rather than presented as settled, since this repo has zero existing platform-detection precedent to point to |
| A3 | The `@flora-suite/chartjs-plugin-zoom` fork offers no advantage over upstream and should not be used | Standard Stack, Alternatives Considered | Low — based on a single `npm view` inspection (single published version, same Hammer dependency, no visible independent development); if this project's needs change, worth re-checking before assuming it's still true |

**Package-name provenance note:** `chartjs-plugin-zoom` and `hammerjs` are tagged `[VERIFIED: npm registry]` above (not `[ASSUMED]`) because both names were confirmed via an authoritative source (the plugin's own shipped `package.json`, which names `hammerjs` as its dependency, plus the plugin's official `chartjs.org` docs site) *and* passed `slopcheck`, satisfying both provenance-rule conditions — not registry-existence alone.

## Open Questions

1. **Exact D-06 default-window spans, D-09 limits/minRange constants, D-12 zoom-factor/pan-fraction, D-19 clamp values, and D-21 breakpoint**
   - What we know: CONTEXT.md explicitly leaves all of these as Claude's Discretion, "tuned against a real browser" / "against the real archive" / "against real phone widths." The archive itself is confirmed concrete: 486 weekly entries spanning `2011-08-15` to `2026-08-10` (≈15 years), read directly from `data/stats/weekly-distance.json`.
   - What's unclear: the actual pixel/visual outcome of any specific constant choice can only be judged by looking at the rendered chart — this genuinely is not something research (or code-reading) can settle.
   - Recommendation: the planner should pick starting values consistent with CONTEXT.md's stated shapes (weekly≈12mo, monthly≈5yr, yearly=all; ~1.5× zoom; ~25% pan; `clamp(180px, 34vh, 420px)`-shaped height) and write them into the plan as the checkpoint's expected-values table (per D-25's discipline), explicitly flagged as subject to correction at the checkpoint rather than presented as final.

2. **Whether the Training Load LTTB decimation genuinely resolves to daily granularity at a deep zoom (D-03(b))**
   - What we know: Chart.js's `Decimation` plugin (already registered module-wide in `trends-charts.ts`) samples from the data visible to the *current scale range* — this is documented Chart.js behavior, and D-03(b) explicitly names it as a checkpoint item.
   - What's unclear: whether the existing `DECIMATION_CONFIG` (`{ enabled: true, algorithm: 'lttb', samples: 500 }`, mirrored from `detail-charts.ts`) was tuned assuming a fixed window (`sliceLoadWindow`'s old behavior) — under D-03, the full 5,000+-day series is always the dataset the scale ranges over, which changes what "500 samples" means at different zoom depths. This needs the D-25 checkpoint's explicit "zoom into a two-week span, confirm daily resolution" row — not something this research session's static reading of the Decimation plugin's source can settle without a real render.
   - Recommendation: keep this as an explicit, separate checkpoint row (already named in CONTEXT.md D-03(b)) rather than assuming it "just works" because the config already exists.

## Environment Availability

This is a client-side, code-only phase — no new external service, database, or CLI tool dependency beyond the two npm packages already covered in Package Legitimacy Audit.

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js / npm | Build, install | Yes (repo already builds) | Not independently re-verified this session (unchanged from prior phases) | — |
| Real browser for the D-25 checkpoint | TRN-01..04's human verification (REQUIREMENTS.md line 67 — no automated test discharges a TRN requirement) | N/A — required at execution time, not at research time | — | None — REQUIREMENTS.md is explicit that this is non-optional for every TRN requirement |
| Real mobile Safari device (not DevTools emulation) | D-21's phone-width floor, Pitfall 6's `vh`-toolbar-collapse risk | Not verifiable from this research session | — | DevTools device emulation is a **partial** fallback for layout/width checks but explicitly does **not** reproduce toolbar-collapse `vh` recalculation — flag this gap in the plan's checkpoint rows rather than silently substituting emulation for it |

**Missing dependencies with no fallback:** the human browser checkpoint itself — inherent to this milestone's verification model, not specific to this phase.
**Missing dependencies with fallback:** real-mobile-Safari-only behavior (Pitfall 6) has a partial DevTools-emulation fallback for layout, but not for the toolbar-collapse resize behavior specifically.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']`. **No jsdom, no headless browser, no canvas polyfill anywhere in this repo** — confirmed by direct read of `vitest.config.ts` and by the complete absence of any `trends.test.ts`/`trends-charts.test.ts` file (only the pure `*-logic.ts` modules have `.test.ts` siblings today: `trends-volume-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-yoy-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-logic.test.ts`) |
| Quick run command | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts` (new file, once it exists) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| TRN-01 | D-06 default-window computation given a granularity and archive bounds | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "computeDefaultWindow"` | ❌ Wave 0 |
| TRN-01 | D-09 `limits` bounds computation from a dataset (archive start/end, minRange per granularity) | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "computeLimits"` | ❌ Wave 0 |
| TRN-01/TRN-02 | Actual on-screen zoom/pan gesture and rendering behavior | **manual-only** | — no automated command; jsdom/canvas is absent from this repo entirely, and Chart.js cannot construct a real chart without a `<canvas>` 2D rendering context, which `environment: 'node'` does not provide | N/A |
| TRN-02 | D-12 zoom-factor/pan-pixel-delta math (pure arithmetic, no Chart.js instance needed) | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "panDeltaPx\|zoomFactor"` | ❌ Wave 0 |
| TRN-02 | D-13 range→aria-label text formatting (e.g., epoch-ms pair → "Sep 2025 to Aug 2026") | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "formatRangeLabel"` | ❌ Wave 0 |
| TRN-02 | Buttons keyboard-operable, disabled-state at clamps, Reset appear/disappear | **manual-only** | — DOM/interaction behavior, no jsdom in this repo | N/A |
| TRN-03 | `.chart-band__canvas-wrap--tall` CSS rule exists with the chosen `clamp()` shape | unit (structural, via the existing rule-scanner helpers) | `npx vitest run src/dashboard/styles.test.ts -t "chart-band__canvas-wrap--tall"` (new case) | ❌ Wave 0 (new test case in the existing file) |
| TRN-03 | `styles.css` still has the SAME `@media (max-width: 380px)` block count the `IN-06/GC-7` test asserts (or the test/comment were updated together — Pitfall 7) | unit (regression guard, existing test) | `npx vitest run src/dashboard/styles.test.ts -t "IN-06"` | ✅ exists (`styles.test.ts:1928`) |
| TRN-03 | Rendered band height, ResizeObserver behavior, mobile-Safari `vh`/toolbar interaction | **manual-only** | — genuinely requires a real browser (and ideally a real mobile device for the toolbar-collapse case — see Pitfall 6) | N/A |
| TRN-04 | `chart.destroy()` triggers the plugin's `stop` hook (Hammer manager destroyed, listeners removed) | Not independently unit-testable in this repo (no DOM/canvas) — **confirmed instead by direct source-reading in this research session** (see Architecture Patterns, Pattern 1) rather than by a runtime assertion | — | N/A (verified via static source analysis, not a runtime test) |
| TRN-04 | D-22 within-tab zoom-state storage/restore logic (pure state shape, no DOM) | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "restoreOrDefault"` | ❌ Wave 0 |
| TRN-04 | No "Canvas is already in use," no stranded/duplicate canvas, correct restore-on-rebuild across rapid tab cycling | **manual-only, discriminator checkpoint per D-25** | — this is the phase's central browser-checkpoint claim; automated tests structurally cannot observe a rendered `<canvas>` in this repo | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts` (fast — pure logic only)
- **Per wave merge:** `npm test` (full suite, `vitest run`)
- **Phase gate:** Full suite green (`npm test`, `tsc`, `npm run build-widgets`) **plus** the D-25 discriminator browser checkpoint — per REQUIREMENTS.md line 67, no automated command discharges TRN-01 through TRN-04; this project has shipped rendering defects behind a fully-green automated gate three times already (Phase 16 black page, Phase 17's two rendering gaps, Phase 18's near-miss — all cited directly in `18-UI-SPEC.md § 19` and `REQUIREMENTS.md`'s own Verification Note)

### Wave 0 Gaps

- [ ] `src/dashboard/views/trends-zoom-logic.ts` — new pure module (D-06 default window, D-09 limits, D-12 zoom/pan math, D-13 label formatting, D-22 restore-or-default state shape)
- [ ] `src/dashboard/views/trends-zoom-logic.test.ts` — its unit test sibling, following the existing `*-logic.test.ts` pattern exactly
- [ ] New case(s) in the existing `src/dashboard/styles.test.ts` asserting the `.chart-band__canvas-wrap--tall` rule's shape (by VALUE, per this file's own `WR-03` precedent of asserting values not just existence — see `styles.test.ts:2029`'s comment on why existence-only assertions are insufficient)
- [ ] No framework install needed — Vitest is already present and configured; the gap is test *files*, not test *infrastructure*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | This phase adds no auth surface — Trends is an already-public, read-only client view with no login |
| V3 Session Management | No | No session/cookie surface touched |
| V4 Access Control | No | No new access boundary — same static-JSON-fetch model every other Trends tab already uses |
| V5 Input Validation | Marginal | The zoom/pan controls accept only synthetic browser events (wheel deltas, pointer coordinates, button clicks) — no free-text or externally-supplied string input is newly introduced. The one boundary worth naming: any URL-query-string-driven zoom state (if the planner chooses to make zoom range shareable via `?tab=...` query params, which is **not** required by any locked decision — D-24 explicitly declines persistence, and no decision asks for URL-encoded zoom state) would need the same allow-list-and-clamp discipline `parseTrendTab`/`parseVolumeGranularity`/`parseLoadWindow` already use for every other query-string-driven state in this file, never trusting a raw numeric range from the URL without clamping it through the same `limits` bounds the UI itself enforces |
| V6 Cryptography | No | Not applicable — no crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Third-party dependency supply-chain risk (an old, low-maintenance library gaining a malicious maintainer takeover, or a known-unpatched vulnerability) | Tampering | `hammerjs` has had no release since 2022 and is a hard dependency of the chosen plugin — this is the one genuine, non-hypothetical security-adjacent consideration in this phase. Mitigation is exactly what the Package Legitimacy Audit already performed (registry provenance, download-count sanity check, `slopcheck`, repo-not-archived check) — no additional runtime mitigation is applicable since this is a build-time/client-bundle dependency, not a server-side one processing untrusted input. No known CVE was surfaced by this research session's checks; a routine `npm audit` at install time (the standard project practice, already run incidentally by this session's reverted `npm install` — 13 vulnerabilities reported across the full dependency tree at that time, none specific to `hammerjs`/`chartjs-plugin-zoom` by name in the summarized output) remains the standard ongoing control |
| Denial-of-service via unbounded event handler thrash (e.g., a malicious or malfunctioning input device firing wheel/pan events faster than the debounce/threshold can absorb) | Denial of Service | Already mitigated by the plugin itself — the 250ms debounce on `onZoomComplete` for wheel, and the `pan.threshold`/`zoom.drag.threshold` config options, are the plugin's own built-in rate-limiting; no additional code needed |

Given this phase's actual attack surface (a client-side charting interaction layer over already-public, already-fetched static JSON, with no new authentication, session, access-control, or cryptography boundary), the security-relevant work here is fully covered by the Package Legitimacy Audit above — there is no additional ASVS control this phase needs to implement in application code.

## Sources

### Primary (HIGH confidence)

- `chartjs-plugin-zoom@2.2.0` shipped source, read directly (`node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js`, verified via a real, then-reverted, local `npm install`) — `zoom()`/`pan()`/`resetZoom()`/`zoomScale()` implementations, `onZoom`/`onZoomComplete`/`onPan`/`onPanComplete` wiring, `startHammer`/`stopHammer`, the `stop` plugin lifecycle hook, `zoomFunctions`/`panFunctions` per-scale-type dispatch, `getLimit`/`storeOriginalScaleLimits`'s `'original'` sentinel semantics
- `chart.js@4.5.1` shipped source, read directly (`node_modules/chart.js/dist/chart.js`) — `PluginService.notify`/`_notify`/`_notifyStateChanges`/`allPlugins` (confirms local per-instance plugins receive full `start`/`stop` lifecycle identical to globally-registered ones), `createResizeObserver`
- This repository's own source, read directly: `package.json`, `vitest.config.ts`, `src/dashboard/views/trends.ts`, `src/dashboard/views/trends-charts.ts`, `src/dashboard/views/chart-theme.ts`, `src/dashboard/views/trends-training-load-logic.ts`, `src/dashboard/views/trends-volume-logic.ts`, `src/dashboard/views/detail-charts.ts` (lines 380-410), `src/dashboard/styles.css` (lines 860-1040, 1350-1370), `src/dashboard/styles.test.ts` (lines 1900-1950), `data/stats/weekly-distance.json`
- npm registry, queried directly: `npm view chartjs-plugin-zoom {version,peerDependencies,dependencies,versions,scripts.postinstall}`, `npm view hammerjs {version,time,repository,scripts.postinstall}`
- `slopcheck install chartjs-plugin-zoom hammerjs` — both packages `[OK]`
- GitHub API, queried directly: `api.github.com/repos/chartjs/chartjs-plugin-zoom`, `api.github.com/repos/hammerjs/hammer.js` (archived status, last push date)
- `api.npmjs.org/downloads/point/last-week/{chartjs-plugin-zoom,hammerjs}`

### Secondary (MEDIUM confidence)

- `chartjs.org/chartjs-plugin-zoom/latest/guide/options.html` — options schema prose (cross-checked against and confirmed by the source read above; used for the human-readable default values table)
- `chartjs.org/docs/latest/developers/plugins.html` — official responsive-chart / container-sizing guidance, and inline-vs-registered-plugin documentation (this page's own wording — "some plugins require registering" — was the reason this research went to the Chart.js core source directly rather than trusting docs prose alone for the D-05 lifecycle question)
- GitHub issue `chartjs/chartjs-plugin-zoom#938` ("Find a solution for hammerjs") — confirms the maintainers have not yet resolved the Hammer dependency question, no stated timeline

### Tertiary (LOW confidence)

- WebSearch results surfacing `@flora-suite/chartjs-plugin-zoom` as a possible fork — investigated and found not to offer any advantage (see Alternatives Considered); flagged low confidence because it rests on a single `npm view` snapshot, not a deep audit of that package's own history

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and peer-dependency compatibility confirmed by direct registry query and a real local install; Hammer.js maintenance status confirmed by registry timestamps and GitHub API, not inference
- Architecture (plugin lifecycle, per-instance registration, teardown): HIGH — read directly from both packages' shipped source code, not from documentation prose, specifically because the official docs page's own wording ("some plugins require registering") was ambiguous enough to warrant going to the source
- Pitfalls 1, 2, 3, 4, 5 (limits sentinel, modifier key, onComplete callbacks, Hammer pan scope, pixel/sign math): HIGH — every one of these is a direct quote/trace of the shipped plugin source, not an inference from docs or training data
- Pitfall 6 (mobile `vh`/toolbar): MEDIUM — the underlying browser behavior is well-established and widely documented, but its specific interaction with this codebase's exact CSS/layout was not (and could not be) rendered and observed in this research session; genuinely requires the D-25/D-21 browser checkpoint
- Pitfall 7 (styles.test.ts collision): HIGH — the exact test and stylesheet comment were read directly, and CONTEXT.md's own D-21 text already names this exact risk
- Exact tuning constants (D-06 spans, D-09 limits, D-12 factors, D-19 clamp values, D-21 breakpoint): LOW/not-applicable by design — CONTEXT.md explicitly assigns these to Claude's Discretion, tuned against a real browser; no amount of research can substitute for that observation

**Research date:** 2026-08-19
**Valid until:** ~30 days for the plugin/API findings (stable, slow-moving ecosystem — `chartjs-plugin-zoom` releases roughly annually); re-verify the Hammer.js maintenance-status claim if this phase is replanned more than ~90 days from now, since "no release since 2022" is a snapshot that could change (for better, if a new release ships, or for worse, if a security issue surfaces)
