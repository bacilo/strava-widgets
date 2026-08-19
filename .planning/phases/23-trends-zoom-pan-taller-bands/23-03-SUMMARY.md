---
phase: 23-trends-zoom-pan-taller-bands
plan: 03
subsystem: ui
tags: [chart.js, trends, dom-structure, design-system]

# Dependency graph
requires:
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 02
    provides: ".chart-band__canvas-wrap--tall / .chart-band__header--zoom / .chart-zoom-controls / .chart-zoom-hint CSS rules this plan's markup now carries"
provides:
  - "buildChartBand(parent, headingText, ariaLabel): ChartBandParts — the single shared helper every Trends band's markup is now built through"
  - "all three zoomable Trends tabs (Volume, Cadence & HR, Training Load) rendering inside .chart-band / .chart-band__header--zoom / .chart-band__canvas-wrap--tall markup"
affects: [23-04, 23-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-04 extract-don't-duplicate applied to DOM wrapper construction itself: one exported buildChartBand() replaces three independent call sites (one already existing, two bare unclassed divs) that were each deciding on their own whether to add the shared classes"
    - "ChartBandParts return-object pattern: buildChartBand hands back { band, header, canvasWrap, canvas } so a caller (rebuildChart in the Training Load tab) can toggle visibility on the whole band, not just the canvas, for an empty-model state"

key-files:
  created: []
  modified:
    - src/dashboard/views/trends-charts.ts
    - src/dashboard/views/trends.ts

key-decisions:
  - "buildChartBand exported from trends-charts.ts (not trends.ts) — trends.ts reaches it only through the existing `await import('./trends-charts.js')` lazy-chunk boundary, so this plan adds zero new imports to either file's static graph"
  - "Training Load's empty-model branch now hides band.band (the whole .chart-band, including its header/title) rather than only band.canvasWrap, so an empty-model state never shows a title floating above nothing — the plan's own explicit ask, going slightly beyond what the previous bare-canvasWrap code did (which only hid the canvas)"
  - "Did NOT tick TRN-03 complete in REQUIREMENTS.md despite the plan's requirements: [TRN-03] frontmatter — mirroring plan 23-02's precedent. The tall modifier class now lands on real DOM in all three zoomable tabs (mechanically verified: grep/tsc/tests/build all confirm it), but no human has visually confirmed the taller bands render correctly in a browser yet, and this project's established pattern (PROJECT.md: 'automated gates have missed rendering defects... three times') gates a requirement's completion on a rendered checkpoint, not an autonomous plan alone. Left for whichever later Phase 23 plan runs the phase's human browser checkpoint."

patterns-established:
  - "Single shared DOM-construction helper per markup shape, exported from the module that owns the CSS class contract, consumed via the existing lazy-import boundary rather than a new static import"

requirements-completed: []  # TRN-03 deliberately NOT ticked — see key-decisions above

# Metrics
duration: ~40min
completed: 2026-08-19
---

# Phase 23 Plan 03: Shared buildChartBand helper for all three Trends tabs Summary

**Extracted an exported `buildChartBand(parent, headingText, ariaLabel): ChartBandParts` helper into `trends-charts.ts`, refactored the existing Cadence & HR band builder onto it, and converted both the Volume and Training Load tabs' bare unclassed canvas wrappers to use it — so all three zoomable Trends tabs now render inside `.chart-band` / `.chart-band__header--zoom` / `.chart-band__canvas-wrap--tall` markup from one single place, with `detail-charts.ts` confirmed byte-unchanged.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-19 (worktree base commit `2d58f68`)
- **Completed:** 2026-08-19
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- `buildChartBand` is exported from `trends-charts.ts` with the exact `ChartBandParts` contract the plan specified (`{ band, header, canvasWrap, canvas }`), building `.chart-band` > `.chart-band__header.chart-band__header--zoom` (title span first, ready for plan 23-05's control cluster as the header's second child) > `.chart-band__canvas-wrap.chart-band__canvas-wrap--tall` > `canvas` with an immediate `aria-label` — appended to `parent` before returning.
- `buildChannelBand` (Cadence & HR) now builds no markup of its own — it calls `buildChartBand(stack, channelLabel(channel), CHANNEL_ARIA_LABELS[channel])` and uses the returned canvas. Every other line (dataset shape, `spanGaps: false`, raw possibly-null values, the `scale.width = Y_AXIS_WIDTH_PX` gutter pin, the tooltip callback) is untouched.
- `renderVolumeTab` (Volume tab, `trends.ts`) now builds its band via `chartsModule.buildChartBand(panel, 'Distance', 'Weekly distance chart')`; `mountChartForGranularity()` closes over `band.canvas`. Append order: `controls` group, then the band, then the granularity button loop populates `controls` (safe regardless of `controls`' own attach time, since buttons append to `controls` not `panel`), then the initial mount, then the year heatmap section — unchanged relative order otherwise.
- `renderTrainingLoadTab` (Training Load tab, `trends.ts`) now builds its band via `chartsModule.buildChartBand(panel, 'Training load', 'Training load chart: CTL, ATL, and TSB over time')` at the same position the old bare `canvasWrap` occupied (after the model/window control groups, before `emptyModelState`/`caption`). `rebuildChart()` uses `band.canvas` for `mountTrainingLoadChart` and toggles `band.band.hidden` (the whole band, title included) rather than only the canvas-wrap, for the empty-model state.
- All three zoomable tabs — Volume, both Cadence & HR bands, Training Load — now render on the D-19 tall height and all three have a `.chart-band__header--zoom` for plan 23-05's control cluster.
- `detail-charts.ts` is confirmed byte-unchanged (`git diff --stat` empty both before and after each task's commit) — the activity detail view's bands still render at the shared 140px, unaffected by the `--tall` modifier.
- No `.chart-band*` class name is written anywhere in `trends.ts` — every occurrence comes from `trends-charts.ts`'s helper.

## Task Commits

Each task was committed atomically:

1. **Task 1 (23-03/T1): Extract buildChartBand in trends-charts.ts and refactor buildChannelBand onto it** - `dfbb743` (feat)
2. **Task 2 (23-03/T2): Convert the Volume and Training Load tabs to buildChartBand** - `b36229c` (feat)

## Files Created/Modified

- `src/dashboard/views/trends-charts.ts` — new exported `ChartBandParts` interface and `buildChartBand()` function (with a doc comment explaining the D-04 extract-don't-duplicate rationale and the explicit `detail-charts.ts` non-conversion note), `buildChannelBand` refactored to call it instead of building its own three-element markup tree
- `src/dashboard/views/trends.ts` — `renderVolumeTab` and `renderTrainingLoadTab` both converted from bare unclassed `canvasWrap`/`canvas` pairs to `chartsModule.buildChartBand(...)` calls; `rebuildChart()` (Training Load) updated to use `band.canvas` and `band.band.hidden`

## Decisions Made

- See `key-decisions` in the frontmatter for the full record (export location, whole-band-hidden empty-model behavior, and the deliberate non-tick of TRN-03).

## Deviations from Plan

### Auto-fixed Issues

None — both tasks' code changes were implemented exactly as specified in the plan's `<action>` blocks.

### Verification-environment fix (Rule 3 — blocking issue)

**1. [Rule 3 - Blocking] `npm run verify-dashboard` failed with a FATAL missing-file error on a fresh worktree**
- **Found during:** Task 2's verify step (`npx tsc --noEmit && npm test && npm run build-widgets && npm run verify-dashboard`).
- **Issue:** `data/dashboard/index.json` and every file under `data/stats/` are gitignored, generated-only artifacts. This worktree was never run through the stats pipeline, so `verify-dashboard` failed outright (`FATAL: dist/widgets is not fully built... Missing: .../dist/widgets/data/dashboard/index.json`), and the same root cause was already responsible for 5 pre-existing test-file failures documented in plan 23-02's `deferred-items.md`.
- **Fix:** Ran `npm run build` (compiles `dist/index.js`, itself also missing on a fresh worktree), then `npm run compute-dashboard-index` and `npm run compute-all-stats` — both succeed entirely from the already-committed archive (`data/activities/`, `data/streams/`), no network calls, `data/private/athlete-private.json` absence degrades age-grading/Banister TRIMP to disabled (documented, non-fatal, matches the existing athlete-private test's own ENOENT-tolerant contract).
- **Verification that it's isolated:** `data/stats/` and `data/dashboard/` are both `.gitignore`d (`git status --ignored` confirms `!! data/dashboard/` / `!! data/stats/`) — nothing from this generation step is committed; it only makes the local verification gate runnable. One accidental side effect (`data/geo/geo-metadata.json`'s `generatedAt` timestamp, touched by a shared code path inside `compute-all-stats`) was caught via `git status --short` before staging and reverted with `git checkout -- data/geo/geo-metadata.json` prior to the Task 2 commit — confirmed clean via `git status --short` showing only `src/dashboard/views/trends.ts` modified.
- **Result after fix:** `npx tsc --noEmit` clean; `npm test` 54/54 files, 1317/1317 tests (the 5 previously-failing files now load their fixtures); `npm run build-widgets` succeeds with the same pre-existing (unrelated) `type="module"` bundling warnings as Task 1; `npm run verify-dashboard` reports 37/37 checks passing.
- **Files modified:** None (data-generation only; `data/stats/*.json` and `data/dashboard/index.json` are gitignored, not committed).
- **Commit:** N/A (no committable change; documented in `deferred-items.md` for future Phase 23 plans that also run the full gate).

### Acceptance-criteria discrepancies (documented, not code changes)

**1. Task 1's `div creations in code` acceptance script**
- The plan's `node -e` script counts `createElement('div')` calls stripped of comments and states it should print `2`, then in the same sentence contradicts itself ("the `band` and `canvasWrap` inside `buildChartBand` plus the `chart-stack` div in `mountChannelBands` is 3"). The actual post-refactor count is **4**: `buildChartBand` creates `band`, `header`, and `canvasWrap` (3 divs), plus `mountChannelBands`' own `stack` div (1) — the plan's own criterion text omitted `header` from its count. The substantive assertion the criterion cares about — that `buildChannelBand` itself creates zero markup — is true and was verified by reading the refactored function. Not a defect; the plan's example count was miscalculated at write time.

**2. Task 2's file-wide "no bare canvasWrap" check**
- The plan's `node -e` script checks the entire `trends.ts` file for `const canvasWrap = document.createElement('div')` and expects zero matches. Two occurrences remain — in `renderYoyTab` (Year-over-Year tab) and the Gear tab's chart section — both pre-existing, both explicitly out of scope: the plan's own objective and success criteria name only "Volume, both Cadence & HR bands, Training Load" as the three zoomable tabs this phase targets; YoY and Gear are not among them and were never described in the plan's `<interfaces>` section as having a bare-canvasWrap problem to fix. Converting them would have exceeded this task's stated action ("Convert both bare `canvasWrap` / `canvas` pairs" — explicitly two, not four) and the plan's own `<files_modified>` scope. Left untouched. `grep -n "chart-band" src/dashboard/views/trends.ts` (the criterion that actually matters — no `.chart-band*` class name written into the view file) returns zero matches, confirmed clean.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `buildChartBand` and the `ChartBandParts` return shape are ready for plan 23-05 to consume: appending the D-10 zoom control cluster as `header`'s second child requires no changes to `buildChartBand` itself.
- All three zoomable tabs now share one markup source, so plan 23-04 (zoom/pan wiring) and 23-05 (control cluster) each attach to exactly one contract instead of reconciling three independent DOM shapes.
- The `data/stats/*.json` and `data/dashboard/index.json` fixtures generated during this plan's verification remain on disk (gitignored, not committed) — any later Phase 23 plan in this same worktree session can run `npm test` / `npm run verify-dashboard` without regenerating them, though regeneration is free and idempotent if they're absent again in a fresh worktree.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `src/dashboard/views/trends-charts.ts`
- FOUND: `src/dashboard/views/trends.ts`
- FOUND: `.planning/phases/23-trends-zoom-pan-taller-bands/23-03-SUMMARY.md`
- FOUND commit `dfbb743` (Task 1) in `git log --oneline`
- FOUND commit `b36229c` (Task 2) in `git log --oneline`
