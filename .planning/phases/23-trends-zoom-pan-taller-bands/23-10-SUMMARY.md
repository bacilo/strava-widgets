---
phase: 23-trends-zoom-pan-taller-bands
plan: 10
subsystem: ui
tags: [chart.js, resize-observer, trends, tick-formatting, gap-closure]

# Dependency graph
requires:
  - phase: 23-trends-zoom-pan-taller-bands
    provides: "23-07's zoom/pan chart infrastructure (trends-zoom-logic.ts, trends-charts.ts) that this plan's tick formatting and resize handling build on"
provides:
  - "trends-tick-format.ts: pure step-aware time-axis tick formatter (tickGranularityForStep, formatTimeAxisTick, stepMsFromTicks, formatAdaptiveTimeTick)"
  - "All five Trends time-axis tick callbacks routed through the adaptive formatter (Finding 7 closed)"
  - "An explicit per-chart ResizeObserver on all seven Trends charts, with matching teardown (Finding 8 closed)"
affects: ["23-11 (Round 2 checkpoint planning, must recompute the invalidated Round 1 tick-value rows below)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure DOM-free logic module + co-located test sibling (trends-tick-format.ts / .test.ts), following trends-zoom-logic.ts's house style"
    - "Structural typing for a Chart.js tick-callback's third argument (readonly { value: number }[]) instead of importing the library's Tick type"
    - "observeCanvasResize(chart, canvas) helper: one ResizeObserver construction shared by all seven chart mounts, detach function returned and invoked in each ChartHandle.destroy() before chart.destroy()"

key-files:
  created:
    - src/dashboard/views/trends-tick-format.ts
    - src/dashboard/views/trends-tick-format.test.ts
  modified:
    - src/dashboard/views/trends-charts.ts

key-decisions:
  - "formatVolumeTick and formatMonthYearTick (and the MONTH_ABBR array that backed both) were deleted from trends-charts.ts entirely rather than left dead — trends-tick-format.ts now owns all tick-string formatting for this file"
  - "The ResizeObserver watches canvas.parentElement (.chart-band__canvas-wrap) rather than the canvas itself, and calls chart.resize() with no arguments so Chart.js re-measures the container — this is what makes it correct for a chart constructed while its tab panel was hidden"
  - "No tooltip configuration was touched anywhere in trends-charts.ts — Finding 6 stays explicitly out of scope for this phase"

requirements-completed: [TRN-01, TRN-03]

# Metrics
duration: 12min
completed: 2026-08-26
---

# Phase 23 Plan 10: Adaptive Tick Formatting and Explicit Chart Resize Summary

**New `trends-tick-format.ts` pure module gives every Trends time axis a step-aware granularity (day/month/year) instead of a fixed format, and all seven Trends charts now attach an explicit `ResizeObserver` on their canvas wrapper with matching teardown — closing Finding 7 (duplicate tick labels at deep zoom) and Finding 8 (canvas not re-fitting on viewport narrowing).**

## Performance

- **Duration:** ~12 min (first commit `d563872` 09:46:17+02:00 → last commit `85ef507` 09:52:37+02:00)
- **Started:** 2026-08-26T07:45:42Z
- **Completed:** 2026-08-26T07:55:17Z
- **Tasks:** 3 completed (Task 1 ran as TDD RED→GREEN, two commits)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Created `src/dashboard/views/trends-tick-format.ts`, a pure, DOM-free module with `tickGranularityForStep`, `formatTimeAxisTick`, `stepMsFromTicks`, and the composition point `formatAdaptiveTimeTick`, plus two named threshold constants (`DAY_STEP_MAX_MS` = 32 days, `MONTH_STEP_MAX_MS` = 366 days) derived directly from the never-duplicate-a-label invariant.
- 16 tests in `trends-tick-format.test.ts`, including a loop asserting the invariant across 6 steps × 4 anchors (24 assertions), one of which is a leap-year February anchor proving the 28-day threshold would have failed.
- Rewired all five Trends x-axis `ticks.callback` sites (Volume ×2, Cadence/HR band, Training Load ×2) to derive their granularity from Chart.js's own tick array via `stepMsFromTicks`/`formatAdaptiveTimeTick`, instead of a fixed format keyed off the `granularity`/toggle state. Both y-axis `${value} km` callbacks (YoY, Gear) are untouched.
- Attached an explicit `observeCanvasResize(chart, canvas)` ResizeObserver at all seven `new Chart(...)` construction sites, with the returned detach function called in every `ChartHandle.destroy()` before `chart.destroy()` — see line numbers below.

## Task Commits

Each task was committed atomically (Task 1 as a TDD RED→GREEN pair):

1. **Task 1a (RED): failing test for adaptive tick formatting** - `d563872` (test)
2. **Task 1b (GREEN): implement trends-tick-format.ts** - `8c7291c` (feat)
3. **Task 2: route all five Trends time axes through the adaptive formatter** - `0a6d1be` (feat)
4. **Task 3: attach explicit per-chart ResizeObserver** - `85ef507` (feat)

_No plan-metadata commit yet — this SUMMARY and its metadata commit follow._

## Files Created/Modified

- `src/dashboard/views/trends-tick-format.ts` - Pure step-aware tick formatter: `tickGranularityForStep`, `formatTimeAxisTick`, `stepMsFromTicks`, `formatAdaptiveTimeTick`, `DAY_STEP_MAX_MS`, `MONTH_STEP_MAX_MS`
- `src/dashboard/views/trends-tick-format.test.ts` - 16 tests covering both thresholds from both sides, the ~11-day Finding-7 case, the never-duplicate-a-label invariant loop (leap-year anchor included), and `stepMsFromTicks`'s edge cases
- `src/dashboard/views/trends-charts.ts` - Imports and routes all five time-axis tick callbacks through `formatAdaptiveTimeTick`/`stepMsFromTicks`; deletes `formatVolumeTick`, `formatMonthYearTick`, `MONTH_ABBR`; adds `observeCanvasResize` helper and wires it into all seven chart mounts and `ChartHandle`/`ChannelBandHandle` destroy paths

## Decisions Made

- Deleted `MONTH_ABBR` from `trends-charts.ts` along with the two functions that used it — confirmed via grep it had no other reader, so `trends-tick-format.ts` is now the single owner of month-abbreviation strings for this file.
- Typed the third tick-callback parameter structurally (`readonly { value: number }[]`) rather than importing Chart.js's `Tick` type, per the plan's own guidance, keeping `tsc --noEmit` clean under `strict`.
- Regenerated `data/stats/*.json` and `data/dashboard/index.json` in this worktree (via `npm run build`, `npm run compute-dashboard-index`, `npm run compute-all-stats`) because this fresh worktree had never been run through the data pipeline — `data/stats/` is gitignored, generation is idempotent, and this precedent was already recorded and resolved identically in plan 23-03 (see `deferred-items.md`). The one side effect (`data/geo/geo-metadata.json`'s `generatedAt` timestamp) was reverted via `git checkout --` before any task commit, matching that precedent exactly.

## Deviations from Plan

None beyond the pre-existing/deferred data-pipeline regeneration noted above (not caused by this plan's own file changes, already documented in `deferred-items.md` from plan 23-03, and reverted where it touched an unrelated file).

## Issues Encountered

- The literal acceptance-criteria grep `grep -c "chart.js\|document\.\|window\." src/dashboard/views/trends-tick-format.ts` expects `0`, but the module's own header comment originally used the literal string `` `chart.js` `` to describe what it does NOT import. Reworded to "charting-library import" so the module both stays genuinely pure (verified: no `chart.js`/`document.`/`window.` references anywhere, including comments) and satisfies the letter of the grep.
- `grep -c "formatAdaptiveTimeTick"`/`"stepMsFromTicks"` against `trends-charts.ts` return `6`, not the plan's literal `5`, because the necessary `import { formatAdaptiveTimeTick, stepMsFromTicks } from './trends-tick-format.js'` line also matches the grep. The five genuine per-axis call sites are all present and correct (verified by reading each); the sixth match in both cases is the single required import line. Noting this so it isn't mistaken for a defect.

## Automated command this plan adds

For plan 23-11 Task 1's Per-Task Verification Map, paste verbatim:

```
npx vitest run src/dashboard/views/trends-tick-format.test.ts
```

## Round 1 expected-tick-value invalidations (for 23-11 Task 1)

Computed from the live archive (`data/stats/weekly-distance.json`, same bounds as `23-VALIDATION.md`'s Round 1: min `2011-08-15T00:00:00.000Z`, max `2026-08-10T00:00:00.000Z`) plus `trends-zoom-logic.ts`'s own `computeFullRange`/`computeDefaultWindow` formulas and this plan's new granularity thresholds, assuming Chart.js's own ~8-tick default (the same assumption `23-VALIDATION.md`'s "~46-day step" comment already used). **Exact literal first/last tick strings still require live-browser confirmation** — Chart.js's real autotick placement is not reproducible outside a browser; the granularity-level change below is what's certain and is what invalidates the table.

| `23-VALIDATION.md` Round 1 row | Window span (unchanged) | Old tick format | New tick format | Invalidated? |
|---|---|---|---|---|
| Volume weekly, default (D-06 opening window) | 365 days, ~46-day step | day-precision (`D MMM YYYY`, e.g. `13 Aug 2025`) | month-precision (`MMM YYYY`, e.g. `Aug 2025`) | **Yes** — granularity changed day→month |
| Volume weekly, after one `+` (zoom in ×1.5) | ~243 days, ~30-day step | day-precision | **day-precision (unchanged)** — 30.4-day step stays below the 32-day threshold | No |
| Volume weekly, after one `←` (pan earlier 25%) | 365 days (same span as default), ~46-day step | day-precision | month-precision, e.g. `May 2025` | **Yes** — same day→month change as the default row |
| Volume weekly, at full zoom-out (Reset/`−` clamp) | ~5,481 days (~15 years), ~685-day step | day-precision | **year-precision** (`YYYY`, e.g. `2011`) | **Yes** — granularity changed day→year, dropping the month entirely |
| Volume monthly, default | ~5 years, ~228-day step | month-precision (fixed by the old `granularity==='monthly'` branch) | month-precision (step-derived) | No — same granularity both ways |
| Volume yearly, default (= full range) | ~15 years, ~685-day step | year-precision, **bare year only** (old `formatVolumeTick`'s `granularity==='yearly'` branch returns `String(year)`, no month) | year-precision, bare year only | No — same granularity and same bare-year format both ways. Flagging for 23-11: the Round 1 table's recorded "Expected first/last x-axis tick" values for this row (`Jul 2010`/`Jul 2026`, with month) do not match what the old code's `yearly` branch actually emits (bare year, no month) — this looks like a pre-existing table inaccuracy unrelated to this plan's change, worth a second look but not something Finding 7's fix caused. |
| Training Load, 12mo default | 365 days, ~46-day step | month-precision (fixed by the old `formatMonthYearTick`, always month regardless of step) | month-precision (step-derived) | No — same granularity both ways |

**Net effect for 23-11 Task 1:** three rows need their "Expected first/last x-axis tick" cells republished — the two ~365-day-span weekly rows (default, pan) drop from day-precision to month-precision, and the full-zoom-out weekly row drops from day-precision to bare-year. The zoom-in row, both non-weekly Volume rows, and the Training Load row keep the same granularity and do not need republishing on this axis (independent of the pre-existing yearly-row table discrepancy flagged above, which predates this plan).

## `ChartHandle.destroy()` line numbers where the observer detach was inserted

(Line numbers as of commit `85ef507`, current `src/dashboard/views/trends-charts.ts`)

| Line | Mount function | Branch |
|---|---|---|
| 263 (`detachEmpty()`, inside `destroy()` starting line 260) | `mountVolumeChart` | Empty-data early return |
| 351 (`detach()`, inside `destroy()` starting line 347) | `mountVolumeChart` | Main path |
| 466 (`detach()`, inside `destroy()` starting line 463) | `mountYoyChart` | Only path |
| 737–738 (`cadenceHandle.detach()` / `hrHandle.detach()`, inside `destroy()` starting line 733) | `mountChannelBands` | Both stacked bands, one shared `destroy()` |
| 917 (`detachEmpty()`, inside `destroy()` starting line 914) | `mountTrainingLoadChart` | Empty-data early return |
| 1022 (`detach()`, inside `destroy()` starting line 1018) | `mountTrainingLoadChart` | Main path |
| 1121 (`detach()`, inside `destroy()` starting line 1118) | `mountGearChart` | Only path |

Every detach call sits after the existing idempotence-flag check and before `controller?.destroy()`/`chart.destroy()`, matching the plan's required ordering.

## Verification

- `npx vitest run src/dashboard/views/trends-tick-format.test.ts` — 16/16 passed.
- `npx tsc --noEmit` — exit 0 (checked after each task).
- `npm test` — 55/55 test files, 1329/1329 tests passed (after regenerating the gitignored `data/stats/`/`data/dashboard/` fixtures this fresh worktree lacked).
- `npm run build-widgets` — succeeded, all widgets/pages/dashboard SPA built.
- `npm run verify-dashboard` — 37/37 checks passed, matching the recorded baseline.
- `git diff --name-only` after Task 3 — no `.css` file listed.
- `git diff --unified=0 src/dashboard/views/trends-charts.ts | grep -c "tooltip"` (Task 2) — `0`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Finding 7 and Finding 8 are both closed at the code level; `trends-tick-format.ts`'s never-duplicate-a-label invariant and `observeCanvasResize`'s teardown discipline are unit-tested, but the plan's own `<verification>` section is explicit that the rendering claims (eight distinct dates at deep zoom; a narrowed-then-loaded viewport re-fitting) are NOT verified here — `environment: 'node'` has no canvas and no layout engine.
- Plan 23-11 Round 2 must add a browser-checkpoint row for each rendering claim, and must republish the three invalidated `23-VALIDATION.md` Round 1 tick-value cells identified above (using the table in this SUMMARY as the starting point, then confirming exact literal strings against a real rendered DOM).
- The `data/stats/`/`data/dashboard/index.json` fixtures this worktree generated are gitignored and were left in place (not reverted) for any later Phase 23 plan/checkpoint in this same worktree session that also needs `npm run verify-dashboard` or a staged build, per the precedent already recorded in `deferred-items.md`.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-26*
