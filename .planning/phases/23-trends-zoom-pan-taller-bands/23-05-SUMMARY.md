---
phase: 23-trends-zoom-pan-taller-bands
plan: 05
subsystem: ui
tags: [chart.js, chartjs-plugin-zoom, trends, zoom, pan, typescript]

# Dependency graph
requires:
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 01
    provides: "trends-zoom-logic.ts — computeArchiveBounds, computeDefaultWindow, restoreOrDefault, volumeScaleKey, ZoomRange"
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 03
    provides: "buildChartBand(parent, headingText, ariaLabel) — the shared ChartBandParts markup helper this plan's mount functions build on"
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 04
    provides: "chart-zoom.ts — chartZoomPlugin, buildZoomPluginOptions, attachZoomController, ZoomController/ZoomMember"
provides:
  - "Volume, Cadence & HR (as a synced pair), and Training Load charts constructed with plugins:[chartZoomPlugin], opening at their D-06 default window or a D-22 restored range"
  - "ZoomMountOptions contract exported from trends-charts.ts, consumed by all three mount call sites in trends.ts"
  - "trends.ts's three D-22 zoom-range closure slots (volumeZoomRange, cadenceHrZoomRange, loadZoomRange), written on settle and read on rebuild, explicitly cleared by unmount()"
affects: [23-06, 23-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ZoomMountOptions { header, savedRange, onRangeChange } as the per-mount zoom contract; mountChannelBands takes Omit<ZoomMountOptions, 'header'> because it owns two bands and picks the cadence band's header itself"
    - "Empty-series guard mirrored across all three mount functions and buildChannelBand: computeArchiveBounds returning null skips the plugin, zoom options and cluster entirely (D-05) rather than constructing a chart with nothing to zoom"
    - "mountChannelBands computes a single zoomCfg (null or {initial, onSettle}) once and passes it unconditionally to both buildChannelBand calls, so the null-bounds guard never duplicates the call count (kept at exactly one call per channel)"

key-files:
  created: []
  modified:
    - src/dashboard/views/trends-charts.ts
    - src/dashboard/views/trends.ts
    - src/dashboard/views/chart-zoom.ts

key-decisions:
  - "chart-zoom.ts's chartZoomPlugin export needed an `as unknown as Plugin` type-only cast: chartjs-plugin-zoom@2.2.0 ships CJS with an ambient .d.ts using a bare `export default Zoom` (no `export =`), which under this repo's moduleResolution: Node16 + esModuleInterop makes TypeScript infer the default import's TYPE as the whole module namespace instead of the Plugin-shaped value it actually is at runtime — confirmed types-only by the .d.ts's own `declare const Zoom: Plugin & {...}`. Plan 23-04 never surfaced this because chart-zoom.ts had zero importers until this plan; fixed as a Rule 1 bug, not a scope change."
  - "mountVolumeChart and mountTrainingLoadChart each split into two full construction branches (empty-bounds vs. zoom-enabled) rather than conditionally assembling one Chart config, matching the plan's own explicit ask and keeping the D-05 guard textually obvious rather than threaded through optional spreads"
  - "buildChannelBand instead takes one nullable `zoom: {initial, onSettle} | null` parameter (rather than duplicating its whole Chart construction like the two functions above) so mountChannelBands could compute a single zoomCfg and call buildChannelBand exactly once per channel either way — preserves the plan's own acceptance criterion (buildChannelBand called exactly twice, both with the same initial) without needing a would-be four-call empty-bounds branch"
  - "unmount()'s zoom-slot reset comment names the specific D-22/TRN-04 reasoning (23-VALIDATION.md's remount-and-observe-default row) rather than a bare 'D-22 says so', so a future reader does not mistake it for scope creep beyond the plan's original six variables"
  - "Did NOT tick TRN-01/TRN-02/TRN-04 complete in REQUIREMENTS.md despite the plan's requirements: [TRN-01, TRN-02, TRN-04] frontmatter — mirroring plans 23-02/23-03's precedent in this exact phase. Every source-level assertion this plan's own acceptance criteria can check (plugin placement, controller/cluster counts, empty-dataset guards, closure-state round-trip, no persistence) is green, but nothing in this repo's test environment can construct a Chart.js instance (no canvas polyfill), so whether zoom/pan actually work with a pointer or keyboard, whether the aria-label updates after a button press and not only a gesture, and whether the Cadence & HR pair visibly stays in lockstep are all still unconfirmed. Plan 23-07's human browser checkpoint is where these tick."

patterns-established:
  - "Per-mount zoom option object (header/savedRange/onRangeChange) as the seam between a DOM-wiring module (trends-charts.ts) and its view's within-tab closure state (trends.ts) — settle is the only writer, mount is the only reader"

requirements-completed: []  # TRN-01/TRN-02/TRN-04 deliberately NOT ticked — see key-decisions above

# Metrics
duration: ~45min
completed: 2026-08-19
---

# Phase 23 Plan 05: Wire chart-zoom.ts into Trends' three zoomable tabs Summary

**Volume, the Cadence & HR pair, and Training Load now construct with `plugins:[chartZoomPlugin]`, opening at their D-06 default window or a D-22-restored range over the always-complete dataset, with three closure-held zoom-range slots in `trends.ts` that survive a tab switch and are explicitly cleared on unmount.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-19 (worktree base commit `fe84847`)
- **Completed:** 2026-08-19
- **Tasks:** 3 completed
- **Files modified:** 3 (`trends-charts.ts`, `trends.ts`, `chart-zoom.ts`)

## Accomplishments

- `mountVolumeChart` and `mountTrainingLoadChart` both gained a required `zoom: ZoomMountOptions` parameter (`{ header, savedRange, onRangeChange }`, exported from `trends-charts.ts`), and both construct with `plugins: [chartZoomPlugin]` in their own per-instance array — the module-wide `Chart.register(...)` call is untouched, and `mountYoyChart`/`mountGearChart` were never read for editing.
- Both empty-series guards mirror each other exactly: `computeArchiveBounds(points.map(...))` returning `null` mounts the pre-existing non-zoom chart config verbatim, with no `chartZoomPlugin`, no zoom options and no `attachZoomController` call — a chart with nothing plotted has no range to zoom (D-05).
- `buildChannelBand` (Cadence & HR) now returns `{ chart, canvas, header }` instead of a bare `Chart`, and takes a nullable `zoom: { initial: ZoomRange; onSettle } | null` fourth parameter. `mountChannelBands` computes the union of both channels' x values for `bounds`, builds both bands at the SAME `initial` range, and attaches exactly ONE `attachZoomController` — its D-10 cluster living in the cadence band's header, `groupLabel: 'Cadence and heart rate chart zoom and pan controls'`. `spanGaps: false`, the null-carrying dataset, the `Y_AXIS_WIDTH_PX` gutter pin, and the tooltip callback are all byte-identical to before this plan.
- `trends.ts` gained three D-22 closure slots — `volumeZoomRange`, `cadenceHrZoomRange`, `loadZoomRange` — each `null` by default (meaning "use the D-06 default window"), written only inside each mount call's `onRangeChange` closure and read only at that same mount call. All three tabs' mount call sites (`mountChartForGranularity`, the `mountChannelBands` call in `renderCadenceHrTab`, and `rebuildChart` in the Training Load tab) now pass the full `zoom` argument.
- `unmount()` explicitly resets all three zoom slots to `null` — the first within-tab state this view genuinely resets on unmount, by deliberate decision (D-22's own text, and 23-VALIDATION.md's TRN-04 remount-and-observe-default row). The other six pre-existing within-tab variables (`volumeGranularity`, `volumeYear`, `yoySelectedYears`, `trimpModel`, `loadWindow`, `gearSort`/`gearSortDir`) are untouched — the stale comment above `volumeGranularity` that used to claim those six "reset on unmount()" was corrected to state the verified fact instead: `createTrendsView(...)` runs exactly once at app startup (`view-registry.ts:37`), so every closure `let` outlives `unmount()` except the three zoom slots.
- `grep -n "localStorage\|sessionStorage"` over `trends.ts` and `trends-charts.ts` returns nothing — D-24 holds: zoom state lives only in the view closure.
- Full gate green after Task 3: `npx tsc --noEmit` clean, `npm test` 54/54 files / 1317/1317 tests, `npm run build-widgets` succeeds, `npm run verify-dashboard` 37/37 checks pass.

## Task Commits

Each task was committed atomically:

1. **Task 1 (23-05/T1): Wire zoom into mountVolumeChart and mountTrainingLoadChart** - `e51a921` (feat)
2. **Task 2 (23-05/T2): Wire the Cadence and HR pair to one shared controller (D-02)** - `c91251f` (feat)
3. **Task 3 (23-05/T3): Add D-22 zoom state to trends.ts and update the three call sites** - `901fa05` (feat)

## Files Created/Modified

- `src/dashboard/views/trends-charts.ts` — `ZoomMountOptions` interface; `mountVolumeChart`/`mountTrainingLoadChart` each split into an empty-bounds branch (unchanged config) and a zoom-enabled branch (`plugins:[chartZoomPlugin]`, D-06/D-22 initial window, `attachZoomController`); `buildChannelBand` returns `{chart, canvas, header}` and takes a nullable zoom config; `mountChannelBands` computes union bounds, builds both bands at one shared range, attaches one controller to the cadence band's header
- `src/dashboard/views/trends.ts` — `ZoomRange` type import; three D-22 zoom-range closure slots with a corrected comment above the Volume block; all three mount call sites pass the new `zoom` argument; `unmount()` resets all three slots
- `src/dashboard/views/chart-zoom.ts` — `chartZoomPlugin`'s export type fixed with an `as unknown as Plugin` cast plus an explanatory comment (see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above (the `chart-zoom.ts` typing fix, the two-branch-vs-nullable-parameter split between the Volume/Training-Load functions and `buildChannelBand`, and the unmount comment's specific TRN-04 citation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `chart-zoom.ts`'s `chartZoomPlugin` export inferred the wrong TypeScript type once a real `plugins:[...]` array consumed it**
- **Found during:** Task 1's verify step (`npx tsc --noEmit`)
- **Issue:** `import zoomPlugin from 'chartjs-plugin-zoom'; export const chartZoomPlugin = zoomPlugin;` type-checked fine in isolation (plan 23-04, zero importers), but once `trends-charts.ts` placed `chartZoomPlugin` into a real `plugins: [chartZoomPlugin]` array against a concrete `Chart<'bar', ...>`/`Chart<'line', ...>` config, `tsc` reported `Property 'id' is missing in type 'typeof import(".../chartjs-plugin-zoom/types/index")' but required in type 'Plugin<"bar", AnyObject>'` — the default import's inferred TYPE was the whole module namespace object, not the `Plugin`-shaped default export value. Root cause: `chartjs-plugin-zoom@2.2.0` ships CommonJS with an ambient `.d.ts` using a bare `export default Zoom` (no `export =`); under this repo's `moduleResolution: Node16` + `esModuleInterop: true`, that shape is a known TypeScript interop gap for CJS packages whose `.d.ts` doesn't use `export =`.
- **Fix:** Added an explicit `: Plugin` type annotation (surfacing the same error at its true source, `chart-zoom.ts:70`, rather than at every call site) then an `as unknown as Plugin` cast, with a comment citing the `.d.ts`'s own `declare const Zoom: Plugin & {...}` as evidence this is a types-only mismatch, not a runtime one.
- **Files modified:** `src/dashboard/views/chart-zoom.ts` (one export line plus a doc comment; no behavior change)
- **Verification:** `npx tsc --noEmit` went from 2 unexpected `TS2741` errors down to exactly the 2 expected `TS2554` (argument-count) errors Task 1's own acceptance criteria call for; confirmed clean of `TS2741` after the fix, and still clean of it through Tasks 2 and 3.
- **Committed in:** `e51a921` (Task 1 commit)

**2. [Rule 3 - Blocking] Copied gitignored `data/stats/*.json` and `data/dashboard/index.json` fixtures into the worktree to run `npm test`**
- **Found during:** Task 1's verify step, before any acceptance-criteria check
- **Issue:** This fresh git worktree (base commit `fe84847`) does not carry untracked/gitignored files; 5 test files read `data/stats/*.json`/`data/dashboard/index.json` directly from disk at module load time. Identical to the gap plans 23-01/23-03/23-04 each independently documented and resolved in their own worktree sessions.
- **Fix:** Copied `data/stats/` and `data/dashboard/` from the main checkout (`/Users/pedf/workspace/strava-widgets/data/`) into this worktree.
- **Files modified:** None tracked — both directories are gitignored; `git status --short` never shows them.
- **Verification:** `npm test` went from 49/54 files passing (1224/1224 individual tests, 5 files failing to load) to 54/54 files, 1317/1317 tests, before any of this plan's own code was written.
- **Committed in:** N/A — untracked, gitignored, matches plans 22-01/22-02/23-01/23-03/23-04's established precedent exactly.

---

**Total deviations:** 2 auto-fixed (1 bug in an adjacent module surfaced by this plan's own wiring, 1 blocking environment gap with an established precedent)
**Impact on plan:** No scope creep. The typing fix is a same-task correction inside Task 1's own commit, in a file the plan's `<interfaces>` section explicitly names as a consumed contract (`chart-zoom.ts`'s exports), not an unrelated module. The fixture copy is a worktree-environment workaround with four prior precedents in this exact phase.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `ZoomMountOptions` and the three mount functions' final shapes are stable for plan 23-06 (D-23's granularity-change zoom reset) and plan 23-07 (the phase's browser checkpoint and chunk-graph assertion) to build on directly.
- The three checkpoint-only claims `chart-zoom.ts` itself could not verify (23-04-SUMMARY.md's list: button-press aria-label update, the pan-direction sign, and the Cadence & HR sibling-sync) are now all WIRED and reachable in a real browser for the first time — this plan supplied the sync mechanism's actual call sites (`mountChannelBands`'s shared controller), but did not and could not exercise them itself (no canvas polyfill in this repo's test environment, per `chart-zoom.ts`'s own closing comment block).
- `data/stats/*.json` and `data/dashboard/index.json` remain on disk in this worktree (gitignored, not committed) for any later Phase 23 plan run in this same worktree session.
- No blockers.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `src/dashboard/views/trends-charts.ts`
- FOUND: `src/dashboard/views/trends.ts`
- FOUND: `src/dashboard/views/chart-zoom.ts`
- FOUND commit `e51a921` (Task 1) in `git log --oneline`
- FOUND commit `c91251f` (Task 2) in `git log --oneline`
- FOUND commit `901fa05` (Task 3) in `git log --oneline`
