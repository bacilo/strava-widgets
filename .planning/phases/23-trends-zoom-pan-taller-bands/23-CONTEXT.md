# Phase 23: Trends Zoom, Pan & Taller Bands - Context

**Gathered:** 2026-08-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The `#/trends` view gains navigable charts: `chartjs-plugin-zoom` wheel/pinch zoom,
horizontal pan by gesture **and** by pointer-free on-screen controls, on taller chart
bands — without regressing the five-tab structure, the Volume granularity toggle, or the
destroy-and-rebuild canvas lifecycle Phase 18 locked.

Requirements: **TRN-01** (zoom via `chartjs-plugin-zoom`), **TRN-02** (horizontal pan by
gesture plus explicit +/− and ←/→ controls that work with no pointing device at all),
**TRN-03** (bands taller than the current fixed 140px), **TRN-04** (composes with the
granularity toggle and the five tabs; no "Canvas is already in use" on tab cycling).

Three things inside this boundary that a surface reading of the requirements misses:

1. **Not all six charts are zoomable in the same sense.** Volume (bar, `'linear'` x
   carrying epoch-ms), Cadence & HR (two line bands), and Training Load (line, 5,000+
   day series behind LTTB decimation) have real time axes. **Year-over-Year's x is a
   12-slot `'category'` axis** (Jan..Dec, deliberately fixed so years overlay) and
   **Gear's is ~16 shoe names**. D-01 excludes both, structurally.

2. **`.chart-band__canvas-wrap` — the literal 140px TRN-03 names — is shared.**
   `trends-charts.ts:349` *and* `detail-charts.ts:401` both use it. Changing that one
   rule would resize every pace/HR/cadence band on the activity detail view too. D-13
   scopes the change to Trends.

3. **Training Load already ships a range control.** 18-D16's 3mo/12mo/All window slices
   the displayed series. Adding zoom to that tab creates two competing range mechanisms;
   D-03 resolves it by making the window control a set of zoom presets over one
   underlying mechanism, which changes what `sliceLoadWindow` is for.

Not in this phase: the activity detail view's chart bands (D-04), the Records page's
seven PR-evolution small multiples, local curation mode (Phase 24), and the CI/theme
items (Phase 25).

</domain>

<decisions>
## Implementation Decisions

### Zoom scope — which charts

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

### The opening picture

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

### Limits

- **D-09: `limits` clamps pan to the data range, floors the zoom-in, and caps zoom-out at
  the full range.** Panning stops at the first and last data point, so you can never
  scroll off into blank space and lose the chart. Zoom-in stops at a sensible minimum span
  (order of a handful of periods) so a single bar cannot fill the screen with no context.
  Capping zoom-out at the full data range also gives "fully zoomed out" a well-defined
  target for the Reset control (D-11) and for the `−` button's disabled state.
  Exact constants are Claude's discretion, tuned against the real archive.

### Controls (TRN-02)

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

### Gestures

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

- **D-17: A persistent hint in the band header advertises the modifier.** Something like
  "⌘/Ctrl + scroll to zoom", sitting near the D-10 control cluster. Modifier-gated wheel
  zoom is otherwise undiscoverable — you cannot find it by trying. Fits the existing
  `.chart-band__header` and matches this project's actionable-notice habit (18-D13's
  config notice, the `c502537` blocked-basemap notice).
  **Rejected:** a show-on-scroll-attempt overlay (the Google Maps behaviour) — more
  elegant when it fires, but it is a new interaction primitive with its own timing,
  dismissal and accessibility questions, and it is invisible to keyboard users entirely.

### Band height (TRN-03)

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

### Zoom state lifecycle (TRN-04)

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

### Verification

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

### Reviewed Todos

*(none folded — see Deferred)*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

ROADMAP.md carries no `Canonical refs:` line for Phase 23. The list below was accumulated
from REQUIREMENTS.md, prior-phase CONTEXT and UI-SPEC files, and the codebase scout.

### Requirements and phase scope
- `.planning/ROADMAP.md` § "Phase 23: Trends Zoom, Pan & Taller Bands" — goal, the five
  success criteria, and criterion 4's explicit naming of the canvas-lifecycle failure mode
  "Phase 18 flagged as the one to watch"
- `.planning/REQUIREMENTS.md` lines 39-42 — TRN-01..TRN-04 as worded; **line 67** — the
  standing rule that automated tests cannot discharge any TRN requirement and every phase
  ends with a human browser checkpoint against a production-shaped URL

### The design contract this phase extends (read before planning)
- `.planning/phases/18-records-trends-differentiators/18-UI-SPEC.md`
  - **§ 7** — the Trends tab bar: real `role="tablist"` (not `.segmented` ARIA), roving
    tabindex with automatic activation, **5 persistent tabpanels**, and the locked
    **destroy-and-rebuild chart lifecycle** across tab switches with its stated reason
    (Chart.js `chartArea` mis-measurement behind `display:none`). D-22 works within this,
    never around it.
  - **§ 8** — the Volume tab: one chart, the 3-way granularity toggle, and the
    **within-tab-state contract** D-22 copies
  - **§ 10** — Cadence & HR's two bands and the shared y-gutter alignment intent D-02 preserves
  - **§ 11** — Training Load, the window control D-03 repurposes, and the thin-coverage
    shading plugin's per-instance `plugins:` idiom D-05 follows
  - **§ 14** — the chart theming contract: **`'linear'` scales with `ticks.callback`,
    never a `TimeScale` or date adapter** (restated there as a hard requirement — no
    adapter is installed and there is zero precedent), and the extract-don't-duplicate
    rule D-04 follows
  - **§ 16** — the accessibility baseline, incl. T-18-A11Y-03's deliberate
    non-focusable-canvas stance that D-13 upholds
- `.planning/phases/18-records-trends-differentiators/18-CONTEXT.md` — **D-02/D-03**
  (Trends is tabbed, five tabs, each owning its own controls, no shared global range
  control), **D-16** (the training-load window; the underlying series always covers
  everything, only the *displayed* window is scoped — the premise D-03 builds on),
  **D-15** (thin-HR-coverage spans are shaded, never filled — the shading plugin must keep
  drawing correctly at every zoom level)

### Prior decisions this phase is bound by
- `.planning/phases/19-design-system-control-styling/19-CONTEXT.md` — **D-05/D-06**
  (button baseline and shared hover, which the five new controls inherit for free),
  **D-07** (the `:disabled` / `[aria-disabled]` treatment D-11 uses at the clamps),
  **D-09/D-10** (the two-tone focus ring, and the `overflow: hidden` removal that lets it
  paint on control groups)
- `.planning/phases/21-overview-rebuild/21-CONTEXT.md` — **D-04**, the deliberate
  no-persistence decision D-24 follows
- `.planning/phases/22-calendar-week-start-totals/22-CONTEXT.md` — **D-06** (localStorage
  sanctioned for view state but per-view and narrow — D-24 declines to use it, and does
  not reopen it), **D-16** (the read-back discriminator discipline D-25 applies)
- `.planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md` — the drag-vs-click
  ambiguity and `shouldNavigateOnRowClick`; D-15 notes Trends charts have no equivalent
  conflict, but the planner should confirm that rather than assume it

### Code that must be read before planning
- `src/dashboard/views/trends.ts` — the whole view factory. Specifically:
  the within-tab state block (**lines 427-452**), `destroyActiveChart` (**454**), the
  single `activeChartHandle` slot (**108-111**), `switchTab` (**1075**),
  `renderActiveTabContent` (**~1050**), the `requestToken` race discipline at every await
  point, `load()` (**1148**), and `unmount()` (**1228**)
- `src/dashboard/views/trends-charts.ts` — the lazy-chunk boundary header comment (**1-23**),
  the **single module-wide `Chart.register(...)`** call (**58-70**) that D-05 must not join,
  `DECIMATION_CONFIG` (**~75**), `mountVolumeChart` (**105**) incl. its
  "the caller is responsible for destroying the previous instance … the 'Canvas is already
  in use' defect class" comment, `mountYoyChart` (**221**), the `.chart-band` /
  `.chart-band__canvas-wrap` markup builder (**291-355**), `mountChannelBands` (**422**),
  `createThinCoverageShadingPlugin` (**466**) as the per-instance-plugin precedent,
  `mountTrainingLoadChart` (**509**), `mountGearChart` (**630**)
- `src/dashboard/views/chart-theme.ts` — `resolveToken`, `resolveThemeColors`, `hexToRgba`,
  `Y_AXIS_WIDTH_PX`; the shared module D-04 would extend
- `src/dashboard/views/trends-training-load-logic.ts` — `sliceLoadWindow`,
  `TRAINING_LOAD_WINDOWS`, `DEFAULT_LOAD_WINDOW`, `findThinCoverageSpans`; all four are in
  D-03's blast radius
- `src/dashboard/views/trends-volume-logic.ts` — `buildVolumeSeries`,
  `VOLUME_GRANULARITIES`; the x domain D-06's default windows are expressed over
- `src/dashboard/views/detail-charts.ts` **lines 355, 358, 401** — the *other* consumer of
  `.chart-band`, `.chart-band__header` and `.chart-band__canvas-wrap`. **D-18 exists
  because of these three lines.**
- `src/dashboard/styles.css` **lines 999-1030** — `.chart-band`,
  `.chart-band__canvas-wrap` (the 140px at **1008**, the 380px/112px block at **1012**),
  `.chart-band__header` (**1017**); and **lines 875-890** — the § comment asserting the
  file has exactly two `@media (max-width: 380px)` blocks (D-21)
- `src/dashboard/styles.test.ts` — the rule scanner; any new height rule or media query
  must satisfy it, and the WR-06 ordering constraint noted at `styles.css:879` is real
- `package.json` — `chart.js: ^4.5.1` today; `chartjs-plugin-zoom` and its Hammer.js
  requirement (D-16) are new

### Hard-won lessons that constrain this phase
- `.planning/phases/17-activity-browser-detail-views/17-VALIDATION.md` — Phase 17's gate
  was green (592/592 tests, clean tsc, 20/20 verify-dashboard) while two real defects sat
  in the browser, **both chart/map rendering defects invisible to automated checks**
- `.planning/PROJECT.md` line 49 and `.planning/REQUIREMENTS.md` line 67 — rendering
  defects have shipped behind a green gate three times; the house rule since checkpoint
  16-09 is that unit tests never discharge a visual claim. D-25 is its application here.
- `.planning/phases/22-calendar-week-start-totals/` Round 3→4 history — the
  `max-width: 380px` breakpoint that was assumed rather than measured, and reopened a
  requirement. D-21 exists because of it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.chart-band__header`** (`styles.css:1017`) — already a
  `flex` / `space-between` row; D-10's cluster is a second flex child, no new layout CSS.
- **`.segmented` + Phase 19's button baseline** — the five new controls inherit hover,
  `:disabled` and the two-tone focus ring with zero opt-in work. Whether the cluster reads
  as a `.segmented` group or as loose buttons is a planning call, but neither needs new
  visual vocabulary.
- **`createThinCoverageShadingPlugin`** (`trends-charts.ts:466`) — the exact
  per-instance-plugin idiom D-05 follows, already proven in this module.
- **`VOLUME_ARIA_LABELS`** (`trends-charts.ts:112`) — the label-swap mechanism D-13
  extends rather than replacing.
- **The within-tab-state block** (`trends.ts:427-452`) — six existing pieces of exactly
  the state D-22 adds a seventh to, with the reset-on-unmount discipline already written.
- **`chart-theme.ts`** — the shared-module precedent D-04's extraction follows.

### Established Patterns
- **Destroy-and-rebuild, never mutate a live instance** — stated in
  `trends-charts.ts:100-104` and enforced everywhere. A zoom implementation must apply
  state *at build time* or through the plugin's API, never by reaching into a live chart's
  scales behind the handle's back.
- **`requestToken` increment-and-compare at every await point** — `trends.ts` re-checks
  after the shared stats fetch and after each `await import('./trends-charts.js')`. Any new
  await this phase adds joins that discipline (T-18-RACE-02).
- **Lazy-chunk boundary** — `trends.ts`'s static import graph must never pull in Chart.js.
  `chartjs-plugin-zoom` and Hammer.js belong behind `trends-charts.js`, imported statically
  *there*. Verify the built chunk graph, don't assume it.
- **No `TimeScale`, no date adapter** — `'linear'` x scales carrying epoch-ms with a
  `ticks.callback` (`formatVolumeTick`). Zoom must work against that, which it does, but a
  researcher reading `chartjs-plugin-zoom` docs will find every example written against a
  time scale. This is the single likeliest spot for an unfamiliar pattern to creep in.
- **UTC everywhere** for date math.
- **Every canvas carries an explicit `aria-label`** (18-UI-SPEC § 14).

### Integration Points
- `trends.ts:427-452` — the within-tab state block gains zoom min/max per zoomable tab (D-22).
- `trends.ts:454` `destroyActiveChart` and `trends.ts:1075` `switchTab` — the
  destroy/rebuild seam D-22's restore hangs off.
- `trends.ts` volume granularity handler (**~607**) and the Training Load `rebuildChart`
  (**~921**) — D-23 and D-03 both land here.
- `trends-charts.ts:58-70` — the module-wide `Chart.register(...)` D-05 must NOT join.
- `trends-charts.ts:291-355` — the `.chart-band` markup builder; D-10's cluster and D-17's
  hint are emitted here, and D-18's modifier class is applied here.
- `trends-charts.ts:105 / 422 / 509` — the three mount functions that gain `zoom` options
  and a per-instance `plugins: [chartjsPluginZoom]`.
- `styles.css:1008` — the 140px D-18 leaves alone, beside the new Trends-only rule.
- `package.json` — two new dependencies (D-16).

### Verified during the scout
- **Six chart instances across five tabs**, and their x scale types differ: Volume `linear`
  (epoch-ms), YoY `category` (12 months), Cadence & HR `linear` ×2, Training Load `linear`,
  Gear `category` (~16 shoes). D-01's split follows this directly.
- **Zero zoom/pan precedent** anywhere in `src/dashboard/` — no prior art to copy inside
  this repo. (The v1.2 Leaflet map widgets have zoom, but that is Leaflet's own, not
  Chart.js, and shares no code path.)
- **`.chart-band__canvas-wrap` has exactly two consumers**, `trends-charts.ts:349` and
  `detail-charts.ts:401` — confirmed by grep, and the reason D-18 exists.
- `activeChartHandle` is a **single** slot, and Cadence & HR's two charts already hide
  behind one composite handle with an idempotent `destroy()` — so D-02's synced pair does
  not need a new handle shape.

</code_context>

<specifics>
## Specific Ideas

- **The user took the recommended option on all 24 decisions.** Several of those
  recommendations deliberately chose the *smaller* blast radius over the more capable
  answer — D-01 (three tabs, not five), D-04 (Trends only, not both surfaces), D-07
  (x-only), D-18 (Trends-only height), D-24 (no persistence). Downstream agents should
  read those as considered scope boundaries, not as work left undone.
- **Two decisions deliberately exceed the requirement's literal wording**, and both were
  taken knowingly: D-06 changes the opening picture (TRN-01 names the *capability*; its
  stated purpose is the *outcome*), and D-03 repurposes a shipped control from Phase 18.
  Neither is scope creep — both are the phase's own requirements read for intent — but a
  verifier should expect to see them and not score them as drift.
- **D-14's modifier-key gating is a UX cost taken on purpose.** It makes wheel zoom
  undiscoverable, which is exactly why D-17's hint is not optional. If the hint is dropped
  during planning, D-14 should be revisited rather than left as a silent feature.

</specifics>

<deferred>
## Deferred Ideas

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

### Reviewed Todos (not folded)
- **Exclusion tickbox via local curation mode**
  (`.planning/todos/pending/2026-08-12-exclusion-tickbox-local-curation-mode.md`, match
  score 0.6) — not folded. It is literally Phase 24's stated goal ("Local Curation Mode");
  it matched only on generic keywords ("via", "mode", "user") and the `dashboard` area tag,
  not on Trends scope. Same disposition as Phase 22 gave it.
- **Garmin export adapter when export arrives**
  (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`, match
  score 0.5) — not folded, deferred again. This is the deferred STREAM-04 work, blocked on
  the export arriving; `export_data/` still holds only `strava/`. Unrelated to Trends.

</deferred>

---

*Phase: 23-trends-zoom-pan-taller-bands*
*Context gathered: 2026-08-19*
