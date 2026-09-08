---
phase: 17-activity-browser-detail-views
plan: 02
subsystem: ui
tags: [typescript, vitest, pure-functions, url-state, dashboard]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract
    provides: DashboardIndexRow contract, hash router's pure parse core (parseHash/isValidActivityId), list.ts's Z-suffix date-normalization convention
provides:
  - "src/dashboard/views/list-logic.ts: pure sort/filter/paginate/URL-state/chip functions, DOM-free"
  - "Node-environment vitest coverage for BROWSE-01..04 and BROWSE-06 sort/filter/paginate/URL-state logic"
affects: [17-08-list-view, 17-09-filter-ui, activity-browser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-logic/DOM-split module: all sort/filter/paginate/URL-state logic lives in a DOM-free file so it is testable under vitest's node environment (this repo has no jsdom); the eventual DOM view (plan 17-08/17-09) only calls into these functions"
    - "Hostile-input tolerant parsing: parseListQuery never throws, allow-lists sort keys against a fixed union, requires Number.isFinite for every numeric filter, and never uses a user-controlled string as an object index (no __proto__ reachability)"
    - "Injected clock parameter: datePresetRange(id, now) takes 'now' as an argument rather than reading the wall clock internally, keeping it deterministic and testable"

key-files:
  created:
    - src/dashboard/views/list-logic.ts
    - src/dashboard/views/list-logic.test.ts
  modified: []

key-decisions:
  - "Distance/pace/duration chip labels for min-only and max-only bounds follow the same three-shape pattern as the plan's pinned distance examples ('{min} km+', 'up to {max} km') — extended by symmetry to pace ('{min}/km+', 'up to {max}/km') and duration ('{min} min+', 'up to {max} min') since the plan named only the combined-example format for those two ('4:30–5:30/km', '30–90 min')."

patterns-established:
  - "Pure sort/filter/paginate/URL-state module with zero DOM dependency, unit tested in node environment"

requirements-completed: [BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-06]

# Metrics
duration: 7min
completed: 2026-08-11
---

# Phase 17 Plan 02: Activity List Sort/Filter/Paginate/URL-State Logic Summary

**Pure, DOM-free sort/filter/paginate/URL-state module (`list-logic.ts`) with 54 node-environment vitest cases covering every BROWSE-01..04/BROWSE-06 behavior, including hostile-query-string safety and round-trip URL serialization.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-11T15:07:03Z
- **Completed:** 2026-08-11T15:14:03Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `sortRows`/`compareRows`: non-mutating, stable, nulls-last-in-both-directions sort over five keys (date, distance, movingTime, pace, avgHr), with the date key using the same Z-suffix wall-clock normalization as `formatActivityDate`
- `paginate`: `totalPages` always >= 1, `clampedPage` always clamped into `[1, totalPages]`, verified with the exact 120-item/page-3 slice-identity assertion the plan specifies
- `parseListQuery`/`serializeListQuery`: total, never-throwing hash-query-string codec; a hostile query string (`sort=__proto__&dir=sideways&page=-99999&dmin=Infinity&dmax=abc`) resolves entirely to safe defaults with no prototype-key reachability; round-trips proven for 3 distinct non-default states; a pristine `ListState` serializes to an empty query string
- `parsePaceInput`/`formatPaceInput`: `m:ss` <-> integer-seconds conversion with single-rounding-step discipline (avoiding the "5:60" defect class documented on `formatPace` in `list.ts`)
- `filterRows`: AND semantics across all nine `FilterState` fields (D-11); name-only case-insensitive search; null-pace exclusion under an active pace filter; date-range matching via the same Z-normalization rule as the date sort, proven against both a Z-suffixed boundary row and a no-Z intervals.icu-era row
- `buildFilterChips`/`removeChip`/`activeFilterCount`: one removable chip per active filter group (D-12), ordered `q, date, distance, pace, duration`, every pinned label format matched exactly (distance both/min-only/max-only, date exact-calendar-year vs. general range vs. from-only/to-only, name chip, pace/duration ranges via `formatPaceInput`)
- `DISTANCE_PRESETS` (5K/10K/HM+/Marathon+) and `datePresetRange` (`this-year`, `last-12-months`) with an injected `now` parameter — zero internal wall-clock reads

## Task Commits

Each task was committed atomically:

1. **Task 1: Sort comparators, pagination, and query-string state** - `c3a99ce` (feat)
2. **Task 2: Filter predicates, presets, and filter chips** - `ead6ede` (feat)

**Plan metadata:** committed alongside this SUMMARY (see worktree final commit)

## Files Created/Modified
- `src/dashboard/views/list-logic.ts` - 475-line pure module: types/constants, `parseListQuery`/`serializeListQuery`, `compareRows`/`sortRows`, `paginate`, `parsePaceInput`/`formatPaceInput`, `filterRows`, `buildFilterChips`/`removeChip`/`activeFilterCount`, `DISTANCE_PRESETS`, `datePresetRange` — imports only a type-only `DashboardIndexRow` from `../../analytics/dashboard-index.types.js`, nothing DOM-related
- `src/dashboard/views/list-logic.test.ts` - 494-line node-environment test file, 54 test cases across `describe` blocks for every behavior bullet in both tasks

## Decisions Made
- Extended the plan's pinned distance-chip three-shape pattern (`{min}–{max} km`, `{min} km+`, `up to {max} km`) by symmetry to pace and duration chip labels for their unstated min-only/max-only cases, since the plan only pinned the combined-range example for those two groups. This keeps the three groups' labeling internally consistent without inventing an unrelated format.
- All acceptance-criteria automated checks (`grep -c 'document\.\|window\.'` = 0, `grep -c 'new Date()'` = 0, hostile-input test, round-trip test, non-mutation test) were verified literally as specified, including rewording an early doc comment that incidentally contained the literal substring `new Date()` so the grep-based purity check reports 0 rather than a false positive on a comment.

## Deviations from Plan

None — plan executed exactly as written. One minor self-correction during execution: an early docstring for `datePresetRange` used the literal text `new Date()` inside a comment explaining the injected-clock pattern; since the plan's acceptance criteria enforce `grep -c 'new Date()' ... returns 0` as a blunt substring check (not AST-aware), the comment was reworded before committing to avoid a false-positive match while preserving the same explanation.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `list-logic.ts` exports the full interface plans 17-08 (list view) and 17-09 (filter UI) depend on: `SortKey`, `SortDir`, `FilterState`, `ListState`, `PAGE_SIZE`, `DEFAULT_DIR`, `parseListQuery`, `serializeListQuery`, `filterRows`, `sortRows`, `paginate`, `buildFilterChips`, `removeChip`, `activeFilterCount`, `parsePaceInput`, `formatPaceInput`, `DISTANCE_PRESETS`, `datePresetRange`
- Full test suite green: 427/427 tests pass (373 pre-existing + 54 new), zero regressions
- `npx tsc --noEmit` clean
- No blockers for plans 17-08/17-09, which are thin DOM layers calling into this module

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/list-logic.ts
- FOUND: src/dashboard/views/list-logic.test.ts
- FOUND: .planning/phases/17-activity-browser-detail-views/17-02-SUMMARY.md
- FOUND: commit c3a99ce (Task 1)
- FOUND: commit ead6ede (Task 2)
- FOUND: commit 3e8c2f3 (docs: SUMMARY)
