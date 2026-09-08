---
phase: 20-row-click-interaction-pattern
plan: 03
subsystem: ui
tags: [typescript, dom-navigation, hash-router, accessibility]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    plan: 01
    provides: "Shared row-navigation module (attachRowNavigation, activityDetailHref, NAVIGABLE_ROW_CLASS)"
provides:
  - "Records PR tables and PR-progression tables with row-click navigation (REC-08)"
  - "Both 'View Activity' CTA columns removed from records.ts (UX-02)"
  - "D-10 navigable marker class applied to exactly the two activity tables in records.ts, not buildRiegelTable"
affects: [20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Date-cell anchor + row-level attachRowNavigation, mirroring list.ts's anchor-in-cell shape, reused a second time in the same file for a differently-shaped row type (ProgressionRow)"
    - "Curated three-part aria-label (date, distance label, effort time) for row types that carry no activity name, deliberately distinct from list.ts's name-first template — documented inline so a later reader does not 'fix' the inconsistency"

key-files:
  created: []
  modified:
    - src/dashboard/views/records.ts

key-decisions:
  - "buildProgressionTable's signature gained distance as its first parameter solely to build the shared D-04 aria-label shape; its one call site in buildEvolutionCard already had distance in scope"
  - "Did not join activity names into PrTableRow/ProgressionRow — D-05 explicitly defers this to future Phase 21-shaped work; the aria-label uses only date, distance label, and duration"

patterns-established: []

requirements-completed: [REC-08, UX-01, UX-02]

# Metrics
duration: ~15min
completed: 2026-08-13
---

# Phase 20 Plan 03: Records Row-Click Navigation Summary

**Both Records activity tables (PR table, PR-progression table) now navigate on row click via the shared `attachRowNavigation` helper, with the Date cell carrying a real keyboard-operable anchor and both redundant "View Activity" CTA columns deleted.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-13
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- `buildPrTable`'s Date cell now holds an `<a href="activityDetailHref(row.activityId)">`, and `attachRowNavigation(tr, row.activityId)` gives the whole row the mouse affordance; the `headers` array dropped from seven entries to six (Activity column gone)
- `buildProgressionTable` gained `distance` as its first parameter (needed only to build the shared aria-label), its Date cell got the identical anchor-in-cell treatment, and its header row dropped from four labels to three (Run column gone)
- The string `'View Activity'` no longer appears anywhere in `src/dashboard/` — confirmed by the plan's own automated checks after both tasks
- `buildRiegelTable` (race predictions, not activities) received zero changes — it keeps its non-navigable, non-marked rows, closing T-20-REC-02 (four unrelated tables currently show a pointer cursor and hover state while doing nothing; now only the two real activity tables carry `NAVIGABLE_ROW_CLASS`)
- `records.ts:130`'s retry button (`className = 'cta'`) survives untouched — confirmed via `git diff` and a `.cta` presence check in the plan's own verify script

## Task Commits

Each task was committed atomically:

1. **Task 1: PR tables — drop the Activity column, anchor the Date cell, attach row navigation** - `670e368` (feat)
2. **Task 2: PR-progression tables — drop the Run column, anchor the Date cell, attach row navigation** - `d0ab680` (feat)

**Plan metadata:** (pending — final metadata commit follows this summary in worktree mode)

## Files Created/Modified
- `src/dashboard/views/records.ts` - `buildPrTable` and `buildProgressionTable` now produce navigable rows with a Date-cell anchor and no CTA column; `buildProgressionTable`'s signature gained `distance`; imports `attachRowNavigation`/`activityDetailHref` from `../row-navigation.js`

## Decisions Made
- Followed D-04/D-05 exactly: built the Date-anchor `aria-label` from only the fields `PrTableRow`/`ProgressionRow` actually carry (formatted start date, `DISTANCE_LABELS[distance]`, `formatEffortDuration(row.durationSec)`), explicitly not joining an activity name in — that remains deferred work
- Reused the identical three-part `aria-label` shape across both tables so a progression row and a PR row for the same activity announce the same way, as the plan's acceptance criteria required

## Deviations from Plan

None — plan executed exactly as written. Both tasks' automated verify scripts (embedded in the plan) passed on first attempt; no auto-fixes, no blocking issues, no architectural questions.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 20-04 (stylesheet re-scoping) can now key its `cursor: pointer`/hover rules off `NAVIGABLE_ROW_CLASS` (D-10), confident that in `records.ts` the marker lands on exactly the PR table and the PR-progression table, and not on `buildRiegelTable`'s race-prediction rows.
- Plan 20-05's human browser checkpoint is the only remaining proof that a Records row is actually clickable and lands on the right activity — nothing in this plan's automated gates (tsc, vitest, the plan's own structural checks, `npm run build-widgets`) can observe that.
- 5 pre-existing test failures (missing gitignored `data/stats/*.json`/`data/dashboard/index.json` in this fresh worktree, first logged in plan 20-01's `deferred-items.md`) persist unchanged: 852/852 non-pre-existing tests pass before and after this plan's changes, same 5 files fail identically.

## Self-Check: PASSED

- FOUND: src/dashboard/views/records.ts (modified, both tasks' changes present)
- FOUND: 670e368 (Task 1 commit)
- FOUND: d0ab680 (Task 2 commit)

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-13*
