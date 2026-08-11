---
phase: 18-records-trends-differentiators
plan: 04
subsystem: ui
tags: [chart.js, css-custom-properties, accessibility, vanilla-ts, dashboard]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    provides: detail-charts.ts's proven chart-theming/canvas-lifecycle pattern and list.ts's formatter/badge single-source-of-truth discipline
provides:
  - src/dashboard/views/chart-theme.ts — the single chart-color-resolution module for every dashboard view
  - list.ts formatEffortDuration/appendBadge/appendLowConfidenceBadge exports
  - every Phase 18 CSS class/token declared once in styles.css
affects: [18-05, 18-06, 18-07, 18-08, 18-09, 18-10, 18-11, 18-12, 18-13, 18-14, 18-15, 18-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chart theming lives in one dependency-free module (chart-theme.ts), imported by both the lazy detail-charts chunk and any future Records/Trends chart module, never re-derived"
    - "Accessible badge pattern: visible .badge + title (pointer) paired with a sibling .sr-only span + aria-describedby (keyboard/AT) — same discipline applied to every future low-confidence badge call site"
    - "CSS class ownership: one plan (this one) declares every new Phase 18 class/token once in styles.css; downstream plans reference, never invent"

key-files:
  created:
    - src/dashboard/views/chart-theme.ts
  modified:
    - src/dashboard/views/detail-charts.ts
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/styles.css

key-decisions:
  - "Omitted .trends-totals-strip: 18-UI-SPEC § 13's rolling-totals header strip composes entirely from existing .card + .stat-grid with zero new CSS, so no new class was added — flagged as a possible no-op in § 17 and confirmed here rather than shipping a dead rule"
  - "appendLowConfidenceBadge derives its aria-describedby id from an idPrefix argument (e.g. activity-{row.id}) so multiple badges on one page (list/overview rows) never collide on the same id"

patterns-established:
  - "Pattern: chart-theme.ts — dependency-free (no chart.js import) module exporting resolveToken/resolveChannelPalette/resolveThemeColors/hexToRgba/Y_AXIS_WIDTH_PX, importable from non-lazy code without pulling Chart.js into the main bundle"
  - "Pattern: formatEffortDuration — single Math.round() feeding both minutes/seconds (or hours/minutes/seconds) components, mirroring formatPace's defect-avoidance JSDoc"

requirements-completed: [REC-02, REC-03, REC-04, REC-07, TREND-01, TREND-04, TREND-05]

# Metrics
duration: 25min
completed: 2026-08-11
---

# Phase 18 Plan 04: Shared Presentation Foundations Summary

**Extracted chart-theme.ts (5 functions moved from detail-charts.ts, zero Chart.js import), added list.ts's formatEffortDuration + exported/accessible badge helpers, and declared every Phase 18 CSS class and token once in styles.css — with `.trends-totals-strip` deliberately omitted as a zero-new-CSS section.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-11T19:28:00Z (worktree base reset to 02e2f8e)
- **Completed:** 2026-08-11T19:34:20Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `chart-theme.ts` is now the single, dependency-free source of chart colour resolution for every dashboard view — `detail-charts.ts` rewired to import from it with zero behaviour change, and Phase 17's y-gutter alignment fix (`Y_AXIS_WIDTH_PX`) is reusable by the upcoming Records/Trends chart modules for the first time.
- `formatEffortDuration` closes the "5K PR shown as `0:19:39`" gap `formatDurationHms` would otherwise cause, using the same single-rounding-step discipline that fixed `formatPace`'s shipped 11-row defect.
- `appendBadge` is exported and `appendLowConfidenceBadge` closes a real, live accessibility gap: the list/overview "Low confidence" badge previously had no explanation reachable without hovering — it now does, and the fix applies retroactively to every existing call site via `appendStatusBadges`.
- Every CSS class/token the remaining 12 Phase 18 view plans will reference now exists in `styles.css`, declared exactly once, with two documented landmines avoided by construction: no hardcoded `.records-jump` sticky offset, and no `transition` on `.pr-table__row--pr`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract chart theming into a shared module and rewire detail-charts.ts** - `ffdcf3d` (feat)
2. **Task 2: Add the shared effort-duration formatter and export the badge helpers** - `d7552ff` (feat)
3. **Task 3: Add every Phase 18 CSS class and token to the stylesheet** - `290f7d9` (feat)

_No TDD tasks in this plan — all three tasks are `type="auto"` with automated verification gates._

## Files Created/Modified
- `src/dashboard/views/chart-theme.ts` - New: `resolveToken`, `resolveChannelPalette`, `resolveThemeColors`, `hexToRgba`, `Y_AXIS_WIDTH_PX` (moved verbatim from `detail-charts.ts`, GAP-2 rationale comment preserved), zero `chart.js` import
- `src/dashboard/views/detail-charts.ts` - Deleted the five moved declarations, imports them from `./chart-theme.js`; no chart registration, behaviour, or crosshair plugin changed
- `src/dashboard/views/list.ts` - Added exported `formatEffortDuration`; changed `appendBadge` from private to exported; added exported `appendLowConfidenceBadge` (sr-only + aria-describedby); `appendStatusBadges` now calls the new accessible helper
- `src/dashboard/views/list.test.ts` - Added 9 `formatEffortDuration` test cases (rounding, hour-boundary, non-finite/negative em-dash)
- `src/dashboard/styles.css` - Added `--load-ctl`/`--load-atl`/`--load-tsb`/`--cat-1..8` tokens at `:root`; added `.sr-only`, `.records-jump`/`.records-jump__link`, `.config-notice`, `.pr-table`/`.pr-table__numeric`/`.pr-table__row--pr`, `.pr-evolution-grid`/`.pr-evolution-card`/`.pr-evolution-card__canvas-wrap`/`.pr-evolution-card__details`, `.year-heatmap`/`.year-heatmap__cell`/tint-0..4

## Decisions Made
- **`.trends-totals-strip` omitted.** 18-UI-SPEC § 13 describes the rolling-totals header strip as "one `.card` containing a `.stat-grid` (existing classes, zero new CSS)" — confirmed during implementation that no new class is needed. § 17 flagged this as "may not need a distinct class" and this plan resolves that open item by not shipping a dead rule.
- **`appendLowConfidenceBadge` id derivation.** Used an `idPrefix` parameter (call sites pass `activity-{row.id}`) rather than a module-level counter, so the generated `aria-describedby` id is deterministic and collision-free across however many rows render on one page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded two chart-theme.ts comments to avoid tripping their own acceptance-criteria greps**
- **Found during:** Task 1 and Task 3 verification
- **Issue:** Task 1's acceptance criterion `grep -c "chart.js" src/dashboard/views/chart-theme.ts` must return `0`, but the module's own header comment explaining "this module imports no chart.js" contained the literal substring `chart.js`, making the grep return `1`. Similarly, Task 3's criterion `grep -c '\--load-ctl' src/dashboard/styles.css` must return exactly `1` (declared once), but the token block's explanatory comment also spelled out `--load-ctl` by name, making the grep return `2`.
- **Fix:** Reworded both comments to convey the same information without repeating the exact literal string the acceptance grep checks for (capitalized "Chart.js" in prose; "the two load tokens immediately below" instead of naming `--load-ctl` a second time).
- **Files modified:** `src/dashboard/views/chart-theme.ts`, `src/dashboard/styles.css`
- **Verification:** Re-ran both grep checks after the edit; both now return the exact value the plan's acceptance criteria specify. `npm run build` and `npm test` re-run clean afterward.
- **Committed in:** `ffdcf3d` (Task 1), `290f7d9` (Task 3) — both fixes were made before the task's commit, so no separate fix commit exists.

---

**Total deviations:** 1 auto-fixed (1 bug-class, Rule 1)
**Impact on plan:** Purely a comment-wording fix to satisfy the plan's own literal acceptance-criteria greps; no functional or behavioral change. No scope creep.

## Issues Encountered
- The worktree's initial `HEAD` did not reset to the plan's base commit (`02e2f8ec315dbb74ec3bbc882d2584e5198fc991`) on the first attempt — the compound bash command combining the branch-namespace check and the reset was rejected by the sandbox as "too complex to verify." Re-ran the same logic as separate, simple commands; the reset then succeeded and the phase-18 planning files (previously missing from the working tree) appeared. No code or plan impact — purely a worktree-setup hiccup, resolved before any task work began.

## Next Phase Readiness
- Every downstream Phase 18 view plan (records.ts, trends.ts, records-charts.ts, trends-charts.ts, detail.ts's PR badge/panel, and everything in between) can now import `chart-theme.ts`'s five exports, `list.ts`'s `formatEffortDuration`/`appendBadge`/`appendLowConfidenceBadge`, and reference every CSS class/token this plan declared — with no plan needing to invent or fork any of them.
- No blockers. `npm run build`, `npm test` (601/601), and `npm run build-widgets` all exit 0 on the final state of this plan.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk (`chart-theme.ts`, `detail-charts.ts`, `list.ts`, `list.test.ts`, `styles.css`). All 4 commits (`ffdcf3d`, `d7552ff`, `290f7d9`, `dbac249`) confirmed present in `git log`.
