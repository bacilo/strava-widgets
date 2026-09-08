---
phase: 23-trends-zoom-pan-taller-bands
plan: 04
subsystem: ui
tags: [chart.js, chartjs-plugin-zoom, hammerjs, trends, zoom, pan]

# Dependency graph
requires:
  - phase: 23-01
    provides: "trends-zoom-logic.ts — the pure, DOM-free D-06/D-09/D-12/D-13/D-14/D-22 math this module composes"
  - phase: 23-02
    provides: "the .chart-band__header--zoom, .chart-zoom-controls, .chart-zoom-hint, .chart-band__canvas-wrap--tall CSS classes this module's cluster attaches to"
provides:
  - "src/dashboard/views/chart-zoom.ts — the single shared home for chartjs-plugin-zoom configuration, the D-10/D-11/D-17 control cluster, and the D-11/D-12/D-13 settle updater"
  - "chartZoomPlugin, buildZoomPluginOptions, resolveModifierKey, buildZoomControlCluster, applyGrabCursor, attachZoomController (+ ZoomController/ZoomMember/ZoomControlCluster interfaces) — the full documented contract plan 23-05 wires into trends-charts.ts"
affects: [23-05, 23-06, 23-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First source import of chartjs-plugin-zoom/hammerjs anywhere in this repo — a top-level static default import inside a module never reachable except through trends-charts.ts's own lazy chunk boundary"
    - "Per-instance plugin registration (D-05): chartZoomPlugin is exported for a chart's own plugins:[...] array, never added to trends-charts.ts's module-wide Chart.register(...) call"
    - "Settle-function idiom (Pitfall 3): a single settle(source?) closure called both from onZoomComplete/onPanComplete (gesture path) and directly, synchronously, from every button's click handler (imperative-API path)"

key-files:
  created:
    - src/dashboard/views/chart-zoom.ts
  modified: []

key-decisions:
  - "D-08 is a numbering pointer with no independent content — its forwarded decisions (D-10 through D-13) are the ones actually implemented; recorded in-file so a reviewer does not mistake it for an unimplemented decision."
  - "applyRange() deliberately bypasses chart.resetZoom()/the plugin's own API — it only ever receives ranges this module already computed (D-06 default, D-03 preset, D-22 restore), all inside limits by construction, and going through the plugin would make Reset depend on the plugin's own originalScaleLimits bookkeeping, which under D-22 could have been captured from a restored window rather than the default one."
  - "currentRange()/settle() read chart.scales.x (the live instance) as the single source of truth rather than keeping a parallel cache, per the plan's own Don't-Hand-Roll guidance."

patterns-established:
  - "*-controller return-object idiom: attachZoomController returns { settle, applyRange, currentRange, destroy } rather than a class instance, matching this codebase's existing ChartHandle-style plain-object handle convention."

requirements-completed: [TRN-01, TRN-02]

# Metrics
duration: ~9min
completed: 2026-08-19
---

# Phase 23 Plan 04: Chart Zoom Wiring Module Summary

**Created `src/dashboard/views/chart-zoom.ts` (487 lines) — the single shared module holding chartjs-plugin-zoom's per-instance configuration, the five-button D-11 control cluster with D-17 hint, D-15's grab/grabbing cursor, and the D-02/D-11/D-13 settle updater that keeps every member chart's aria-label and button-disabled state honest after both gestures and button presses.**

## Performance

- **Duration:** ~9 min (17:14 first exploration through 17:22:51 last commit)
- **Started:** 2026-08-19T17:14:00+02:00
- **Completed:** 2026-08-19T17:22:51+02:00
- **Tasks:** 3 (all auto)
- **Files modified:** 1 (`src/dashboard/views/chart-zoom.ts`, created)

## Accomplishments

- `chart-zoom.ts` created with the full documented export contract: `chartZoomPlugin`, `buildZoomPluginOptions`, `resolveModifierKey`, `buildZoomControlCluster`, `applyGrabCursor`, `attachZoomController`, plus `ZoomController`/`ZoomMember`/`ZoomControlCluster` interfaces — matches the plan's `<interfaces>` block exactly
- `chartjs-plugin-zoom` imported as a top-level static default import for the first time anywhere in this repo; `chartZoomPlugin` is exported for per-instance `plugins: [...]` use only, with a header comment stating it must never join `trends-charts.ts`'s module-wide `Chart.register(...)` call (D-05)
- `buildZoomPluginOptions` emits x-only zoom/pan (D-07), literal numeric `limits.x` computed via `computeLimits` — never the plugin's `'original'` sentinel (D-09, Pitfall 1) — a platform-resolved wheel modifier (D-14), pinch enabled, `zoom.drag` disabled (D-15/D-16, Pitfall 4)
- `buildZoomControlCluster` builds the D-17 persistent hint plus five bare `<button type="button">` action buttons (←, →, −, +, Reset) with no `aria-pressed` (verified: 0 occurrences of that string anywhere in the file, including comments) and Reset starting `hidden`
- `attachZoomController`'s `settle()` is the single update path: propagates a settled range to sibling members (D-02, the Cadence & HR sync), rewrites every member's `aria-label` via `withRangeSuffix` (D-13), and updates Reset visibility plus pan/zoom-out disabled state at the D-09 clamps (D-11) — called from 6 places (5 button handlers + one initial call before `attachZoomController` returns), satisfying Pitfall 3's "every button handler calls settle() directly" requirement
- Reset restores the D-06 default window via `applyRange(defaultWindow)`, never `chart.resetZoom()` — the plan's D-22 correctness requirement (a restored window differs from the constructed one)
- Closing comment block documents the three checkpoint-only claims this module's DOM-less test suite cannot see, and no `chart-zoom.test.ts` was added by design
- Full gate green: `npx tsc --noEmit` clean, `npm test` 54/54 files / 1317/1317 tests (identical count to plan 23-01's baseline), `npm run build-widgets` succeeds, `npm run verify-dashboard` 37/37 checks pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create chart-zoom.ts with the plugin export and the zoom option builder** - `29ef58c` (feat)
2. **Task 2: Add the control cluster, grab cursor, and the settle-driven controller** - `0820a53` (feat)
3. **Task 3: Record the untestable seams and gate the module** - `c09af85` (docs)

## Files Created/Modified

- `src/dashboard/views/chart-zoom.ts` - new module: `chartZoomPlugin` (per-instance plugin export), `resolveModifierKey` (D-14 platform read), `buildZoomPluginOptions` (D-07/D-09/D-14/D-15/D-16 config builder), `ZoomMember`/`ZoomControlCluster`/`ZoomController` interfaces, `buildZoomControlCluster` (D-10/D-11/D-17 DOM), `applyGrabCursor` (D-15 cursor), `attachZoomController` (D-02/D-11/D-13 settle-driven wiring)

## Decisions Made

See `key-decisions` in frontmatter above (D-08 numbering-pointer note, `applyRange`'s deliberate bypass of the plugin's own API, and the live-scale-as-source-of-truth choice for `currentRange`/`settle`) — none of these are deviations from the plan; all three are things the plan's own `<action>` text explicitly asked to be recorded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied gitignored `data/stats/*.json` and `data/dashboard/index.json` fixtures into the worktree to run `npm test`**
- **Found during:** pre-Task-1 verification (`npm test` before any code change)
- **Issue:** This fresh git worktree does not carry untracked/gitignored files, and 5 test files read `data/stats/*.json`/`data/dashboard/index.json` directly from disk at module load time. Identical to the gap plan 23-01 documented and resolved (`23-01-SUMMARY.md` Deviations).
- **Fix:** Copied `data/stats/` and `data/dashboard/` from the main checkout (`/Users/pedf/workspace/strava-widgets/data/`) into this worktree.
- **Files modified:** None tracked — both directories are gitignored; `git status --short` never shows them.
- **Verification:** `npm test` went from 49/54 files passing (1224/1224 individual tests passing, 5 files failing to load) to 54/54 files, 1317/1317 tests passing, before any of this plan's own code was written.
- **Committed in:** N/A — untracked, gitignored, matches plan 22-01/22-02/23-01's established precedent exactly.

**2. [Rule 1 - Bug] Removed the literal string `aria-pressed` from a Task 2 comment**
- **Found during:** Task 2 acceptance-criteria verification
- **Issue:** The plan's own acceptance criterion `grep -c "aria-pressed" src/dashboard/views/chart-zoom.ts` prints `0` is a raw grep with no comment-stripping, but my first draft's doc comment explaining "these buttons don't carry `aria-pressed`" contained that exact literal substring, so the raw grep counted 1, not 0.
- **Fix:** Reworded the comment to say "the toggle-only pressed-state attribute" instead of naming the attribute literally, preserving the same explanation without tripping the gate.
- **Files modified:** `src/dashboard/views/chart-zoom.ts` (comment text only, no behavior change)
- **Verification:** `grep -c "aria-pressed" src/dashboard/views/chart-zoom.ts` now prints `0`; `npx tsc --noEmit` still clean.
- **Committed in:** `0820a53` (Task 2 commit — caught and fixed before that commit was made, not a follow-up)

---

**Total deviations:** 2 auto-fixed (1 blocking environment gap, 1 self-referential gate-wording bug caught before commit)
**Impact on plan:** No scope creep. The fixture copy is a worktree-environment workaround with an established precedent in this exact phase. The aria-pressed wording fix is a same-task correction, not a later patch — Task 2's commit already reflects the corrected text.

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `chart-zoom.ts`'s full documented contract (`chartZoomPlugin`, `buildZoomPluginOptions`, `resolveModifierKey`, `buildZoomControlCluster`, `applyGrabCursor`, `attachZoomController`, plus its three interfaces) is ready for plan 23-05 to import inside `trends-charts.ts`'s lazy chunk.
- Per this plan's own scope note, `chart-zoom.ts` is the only file this plan touches — `trends-charts.ts` and `trends.ts` (owned by plan 23-03, running in parallel) were not read for editing and not modified.
- No source file yet imports `chart-zoom.js`/`chartjs-plugin-zoom`/`hammerjs` outside this new module itself (confirmed: `grep -rn "chart-zoom.js" src/dashboard/ | grep -v "chart-zoom.ts"` returns nothing) — the LAZY-CHUNK BOUNDARY invariant plan 23-05 must respect is untouched by this plan.
- No blockers. This worktree still lacks generated `data/stats`/`data/dashboard` in git-tracked form (by design, gitignored); any downstream plan executed in a *different* fresh worktree touching a `*-logic.test.ts` file will need the same fixture-copy step.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: src/dashboard/views/chart-zoom.ts
- FOUND: .planning/phases/23-trends-zoom-pan-taller-bands/23-04-SUMMARY.md
- FOUND commit: 29ef58c (Task 1)
- FOUND commit: 0820a53 (Task 2)
- FOUND commit: c09af85 (Task 3)
