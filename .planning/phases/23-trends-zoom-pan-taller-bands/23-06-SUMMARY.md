---
phase: 23-trends-zoom-pan-taller-bands
plan: 06
subsystem: ui
tags: [chart.js, chartjs-plugin-zoom, trends, zoom, training-load, typescript]

# Dependency graph
requires:
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 01
    provides: "trends-zoom-logic.ts — computeArchiveBounds, loadWindowRange, ZoomRange"
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 05
    provides: "trends.ts's three D-22 zoom-range closure slots (volumeZoomRange, cadenceHrZoomRange, loadZoomRange) and the ZoomMountOptions contract both mount call sites this plan rewrites already consume"
provides:
  - "D-23: the Volume granularity toggle clears volumeZoomRange before rebuilding, so a new granularity opens on its own D-06 default window instead of carrying over a stale zoom"
  - "D-03: the Training Load 3mo/12mo/All control sets loadZoomRange via loadWindowRange(window, bounds) instead of slicing the dataset — mountTrainingLoadChart always receives the FULL doc.days series"
  - "D-03(a): sliceLoadWindow and its module-private WINDOW_DAYS table are permanently deleted from trends-training-load-logic.ts, from trends.ts's import list, and from the test file"
affects: [23-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Preset-as-zoom-write: a discrete control (window preset) writes the same closure slot a continuous gesture (zoom/pan settle) writes, so both mechanisms compose through one piece of state rather than two competing sources of truth"
    - "currentBounds() local helper recomputes ZoomRange from the currently-selected TRIMP model's series on demand, rather than caching archive bounds once — cheap (selectModelSeries over ~5,475 days) and always correct if the document ever changes model availability mid-session"

key-files:
  created: []
  modified:
    - src/dashboard/views/trends.ts
    - src/dashboard/views/trends-training-load-logic.ts
    - src/dashboard/views/trends-training-load-logic.test.ts

key-decisions:
  - "D-03's window-preset acceptance-criteria script (`node -e ...` scanning 900 chars from the first literal occurrence of 'TRAINING_LOAD_WINDOWS.forEach') constrained comment placement and length more than the plan's prose implied: `updateWindowButtons` and the button-creation loop both contain that literal string, and `updateWindowButtons` appears first in source order (it must, since the button-creation loop's own click handler calls it). This meant every doc comment placed between the two forEach calls counted against the acceptance window's budget. Resolved by moving the D-03 rationale to a block comment ABOVE the '-- Window control' section (before either forEach, so it doesn't count against the window) and keeping only a one-line note at `currentBounds()` — no loss of documentation, just relocated so the mechanical acceptance check and the human-readable comment both succeed."
  - "currentBounds() is defined once per renderTrainingLoadTab call (not memoized across window-preset clicks) — it's a ~5,475-element map+filter, cheap enough that redefining and recomputing per click is simpler than threading a cached value through and has no correctness risk if the model changes between clicks."

patterns-established:
  - "Retirement doc-comment convention confirmed: a dated paragraph in the module's own header JSDoc stating what was removed, why (open invitation to reintroduce a removed mechanism vs. an unused pure helper), and what replaced it — matches the shape 23-01 and prior phases used for superseded behaviour. Note: the acceptance criteria explicitly forbid the literal deleted identifier appearing anywhere in src/ (including comments), so the retirement note must describe the removed function by role ('the trailing-window dataset filter') rather than by name."

requirements-completed: []  # TRN-01/TRN-04 deliberately NOT ticked — see key-decisions below and REQUIREMENTS.md notes; gated on plan 23-07's browser checkpoint per this phase's established precedent (23-02/23-03/23-05)

# Metrics
duration: ~20min
completed: 2026-08-19
---

# Phase 23 Plan 06: Granularity zoom reset and Training Load preset-as-zoom Summary

**Volume's granularity toggle now clears its saved zoom range before rebuilding (D-23), and the Training Load 3mo/12mo/All control was converted from a dataset slicer into a set of zoom presets over one always-complete series (D-03), with `sliceLoadWindow` permanently retired from the codebase.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-19 (worktree base commit `d3e7152`)
- **Completed:** 2026-08-19
- **Tasks:** 3 completed
- **Files modified:** 3 (`trends.ts`, `trends-training-load-logic.ts`, `trends-training-load-logic.test.ts`)

## Accomplishments

- The Volume granularity button's click handler now sets `volumeZoomRange = null` after mutating `volumeGranularity` and before `mountChartForGranularity()`, with a comment stating D-23's reasoning (each granularity has its own designed opening density; a null slot falls back to `computeDefaultWindow` for the NEW granularity). The existing no-op guard (`if (volumeGranularity === granularity) return;`) is untouched — pressing the already-active granularity is genuinely still a no-op.
- `trends.ts` imports `computeArchiveBounds` and `loadWindowRange` from `./trends-zoom-logic.js` (a static import — that module carries no charting dependency, so it's safe in the main bundle graph). A local `currentBounds(): ZoomRange | null` helper inside `renderTrainingLoadTab` computes `computeArchiveBounds(selectModelSeries(doc.days, trimpModel).map((p) => p.x))`, stable across a TRIMP model switch since both models carry one entry per day.
- `rebuildChart()` no longer calls `sliceLoadWindow` at all — `selectModelSeries(doc.days, trimpModel)` and `findThinCoverageSpans(doc.days)` both run over the FULL document unconditionally. `mountTrainingLoadChart` is always handed the complete series; only `loadZoomRange` (read by the chart's own `savedRange` option) determines what's visible.
- The window preset button click handler's no-op guard (`if (loadWindow === w) return;`) was removed entirely. The handler now sets `loadWindow = w`, calls `updateWindowButtons()`, computes `const b = currentBounds()`, sets `loadZoomRange = b === null ? null : loadWindowRange(loadWindow, b)`, then calls `rebuildChart()` — so pressing the already-active preset re-applies its range rather than being inert, which matters after a free zoom has moved away from it.
- The TRIMP model handlers (`edwardsBtn`/`banisterBtn` click listeners) are functionally unchanged — they still call `rebuildChart()` without touching `loadZoomRange` — with a new comment stating this is deliberate: a model switch changes the y series, not the x domain, so the visible range must survive it.
- `sliceLoadWindow` and its module-private `WINDOW_DAYS` lookup table are deleted from `trends-training-load-logic.ts`. A repository-wide grep before deletion confirmed the only other references were `trends.ts`'s import list and the test file — both updated. Every other export (`parseTrainingLoad`, `TrimpModel`, `parseTrimpModel`, `LoadWindow`, `TRAINING_LOAD_WINDOWS`, `DEFAULT_LOAD_WINDOW`, `parseLoadWindow`, `LoadPoint`, `selectModelSeries`, `CoverageSpan`, `findThinCoverageSpans`, `coverageCaption`) survives unchanged, confirmed by a by-name regex assertion against the file.
- The module's header JSDoc now records the retirement with its date and D-03, describing the removed function by role ("the trailing-window dataset filter... plus its module-private day-count lookup table") rather than by its literal identifier — the acceptance criteria requires zero occurrences of `sliceLoadWindow` anywhere in `src/`, including comments.
- `trends-training-load-logic.test.ts`: only the `describe('sliceLoadWindow')` block and its name in the import list were deleted. `git diff` confirms no other describe block was touched. Test count for this file went from 20 to 16 (a deliberate 4-test drop matching the four `sliceLoadWindow`-specific assertions, not a regression) — confirmed via `npx vitest run` before and after.
- Full gate green: `npx tsc --noEmit` clean, `npm test` 54/54 files / **1313/1313 tests** (down from 1317/1317 before this plan — the stated 4-test delta from the `sliceLoadWindow` describe-block deletion, nothing else), `npm run build-widgets` succeeds, `npm run verify-dashboard` 37/37 checks pass.
- **Stated consequence, as the plan's `<output>` section requires:** `findThinCoverageSpans` now runs over the full archive (`doc.days`) instead of the displayed window, so the thin-HR-coverage shading covers every gap across the full 15-year archive and `coverageCaption` will essentially always render its fixed sentence once any thin-coverage span exists anywhere in the archive (which it does — the archive predates consistent HR tracking). `coverageCaption` reports no count — it returns one fixed sentence when `spans.length > 0` and `''` otherwise — so no number on screen changes; what changes is that the sentence is now effectively permanent rather than window-dependent. Whether the shading itself still draws correctly at every zoom level (18-D15) is unverified by this plan (no canvas polyfill in this repo's test environment) and is recorded as a Manual-Only row for plan 23-07's browser checkpoint (D-03b), not assumed.
- Confirmed via `git diff` against the base commit: nothing in Year-over-Year or Gear tab code changed (D-01) — this plan touched only Volume's granularity handler and Training Load's window/model handlers.

## Task Commits

Each task was committed atomically:

1. **Task 1 (23-06/T1): Reset the zoom on a granularity change (D-23)** - `5813642` (feat)
2. **Task 2 (23-06/T2): Turn the Training Load window control into zoom presets (D-03)** - `0f7e0dd` (feat)
3. **Task 3 (23-06/T3): Retire sliceLoadWindow and its tests** - `71c01c3` (refactor)

## Files Created/Modified

- `src/dashboard/views/trends.ts` — Volume granularity handler clears `volumeZoomRange` before remounting (D-23); `computeArchiveBounds`/`loadWindowRange` imported from `trends-zoom-logic.js`; Training Load's `currentBounds()` helper; `rebuildChart()` rewritten to use the full `doc.days` for both the series and the coverage spans; window-preset click handler rewritten to set `loadZoomRange` via `loadWindowRange` with the no-op guard removed; `sliceLoadWindow` removed from the import list
- `src/dashboard/views/trends-training-load-logic.ts` — `sliceLoadWindow` and the module-private `WINDOW_DAYS` table deleted; module header JSDoc records the retirement, its date, and the reasoning (an exported slicer invites reintroducing the exact mechanism D-03 removed)
- `src/dashboard/views/trends-training-load-logic.test.ts` — `describe('sliceLoadWindow')` block and its import removed; all other describe blocks (`parseTrainingLoad`, `parseTrimpModel`, `parseLoadWindow`, `selectModelSeries`, `findThinCoverageSpans`, `coverageCaption`) untouched, confirmed via `git diff`

## Decisions Made

See `key-decisions` in the frontmatter above (the acceptance-criteria-driven comment relocation for Task 2, and `currentBounds()`'s deliberately non-memoized recomputation per click).

## Deviations from Plan

None beyond the documented comment-placement adjustment recorded in `key-decisions` above, which is a same-task formatting choice made to satisfy the plan's own literal acceptance-criteria script, not a scope or behavior change — no Rule 1-4 deviation category applies; the code the plan specified was written exactly as specified, only the comment's position moved to fit the same information within the acceptance check's byte budget.

## Issues Encountered

None beyond the comment-placement iteration described above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `trends.ts`'s Volume and Training Load control handlers are in their final Phase 23 shape; plan 23-07's browser checkpoint is the next and only remaining consumer.
- The stated D-03(a) consequence (thin-coverage shading now spans the full archive, `coverageCaption`'s sentence effectively permanent) is recorded above and should inform 23-07's own Manual-Only Verification rows — it is not itself something this plan's automated gate can discharge.
- `data/stats/*.json` and `data/dashboard/index.json` remain on disk in this worktree (gitignored, copied from the main checkout per the established Phase 23 precedent) for any later plan run in this same worktree session.
- REQUIREMENTS.md's TRN-01 and TRN-04 entries were extended with this plan's contribution (D-03's preset-as-zoom-write, D-23's granularity reset) but deliberately left unticked, per the phase's established precedent (plans 23-02/23-03/23-05) of gating requirement completion on plan 23-07's human browser checkpoint rather than on a green automated gate alone.
- No blockers.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: src/dashboard/views/trends.ts
- FOUND: src/dashboard/views/trends-training-load-logic.ts
- FOUND: src/dashboard/views/trends-training-load-logic.test.ts
- FOUND: .planning/phases/23-trends-zoom-pan-taller-bands/23-06-SUMMARY.md
- FOUND commit 5813642 (Task 1) in `git log --oneline`
- FOUND commit 0f7e0dd (Task 2) in `git log --oneline`
- FOUND commit 71c01c3 (Task 3) in `git log --oneline`
