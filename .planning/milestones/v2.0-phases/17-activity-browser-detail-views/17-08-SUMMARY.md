---
phase: 17-activity-browser-detail-views
plan: 08
subsystem: ui
tags: [typescript, dom, dashboard, url-state, pagination, accessibility]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    provides: "17-02: list-logic.ts pure sort/filter/paginate/URL-state module; 17-01: styles.css list/table/pagination class contract"
provides:
  - "src/dashboard/views/list.ts: paginated, sortable activity browser — desktop table + mobile cards, both URL-driven"
  - "exported formatDurationHms (was private) for detail.ts to consume in a later plan"
  - "exported noteViewedActivity(id) for detail.ts to call on mount in a later plan (D-08 return-from-detail highlight)"
  - "empty .list-toolbar seam for plan 17-09's filter bar"
affects: [17-09-filter-ui, 17-14-detail-formatter-reuse, activity-browser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared badge-rendering helper (appendStatusBadges) consumed by both the mobile card renderer and the new desktop table Status cell, so the two surfaces can never drift"
    - "All list state transitions (sort click, sort select, page click) build a next ListState and call serializeListQuery + navigateTo — zero direct DOM mutation, zero location.hash writes"
    - "Both desktop and mobile layouts are always in the DOM simultaneously; the 720px CSS switch (plan 17-01) shows exactly one. Return-from-detail highlight/focus/scroll acts on both — the CSS-hidden one is a harmless no-op"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts

key-decisions:
  - "Split list.ts into two atomic commits matching the plan's two tasks (desktop table + URL sorting, then pagination + return-highlight) even though both were authored together, so git history stays task-traceable per the execution protocol"
  - "Page-button windowing (buildPageList — which of the up-to-7 numbered buttons to show) was kept in list.ts as presentation-only logic, not added to list-logic.ts, since it is a rendering decision layered on top of the already-tested paginate() arithmetic, not new sort/filter/paginate math"
  - "Row click and the Activity-cell anchor both navigate to the same destination; the row's click handler checks event.target.closest('a') and no-ops when the click originated from the anchor, avoiding a redundant duplicate navigateTo call"
  - "Return-from-detail highlight/scroll/focus is applied to the matching element in BOTH the desktop <tr> and the mobile card (found by page-relative index, not a DOM query on notedActivityId, since renderActivityRow intentionally carries no data-activity-id attribute) — only the CSS-visible one has any real effect"

patterns-established:
  - "Pure-logic/DOM-split module consumption: list.ts imports 100% of its sort/filter/paginate/URL-state arithmetic from list-logic.ts and adds no arithmetic of its own beyond page-button windowing"

requirements-completed: [BROWSE-01, BROWSE-02]

# Metrics
duration: ~20min
completed: 2026-08-11
---

# Phase 17 Plan 08: Activity List View — Sortable Table, Pagination, Return Highlight Summary

**Rewrote `src/dashboard/views/list.ts` from a newest-100 truncation slice into a fully URL-driven, paginated activity browser: a 7-column aria-sort-annotated desktop table above 720px, the unchanged mobile card layout below it, numbered pagination over all 1,867+ rows, and return-from-detail row highlighting.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-11T17:30:42+02:00
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Deleted `MAX_ROWS = 100`, the truncation slice, and the "Browsing, sorting and filtering land in Phase 17" notice entirely (D-06)
- Added a real `<table class="activity-table">` (7 columns: Date, Activity, Distance, Moving Time, Pace, Avg HR, Status) with full-cell sort `<button>`s, `aria-sort` on every `<th>`, and an inline-SVG direction arrow on the active column, alongside the unchanged mobile `renderActivityRow` cards plus an equivalent sort `<select>` (D-01/D-02/D-03/D-04)
- All state transitions (header click, select change, page click) build a `ListState` and route through `serializeListQuery` + `navigateTo` — zero `location.hash` writes, zero `innerHTML` (T-17-VW-01/T-17-URL-01/T-17-URL-02 all mitigated as specified)
- Added numbered pagination (`‹ Prev`, up to 7 numbered buttons with ellipsis windowing, `Next ›`, always-visible "Page {n} of {total}" label) rendered from `paginate()`'s `clampedPage`, so a hostile `?page=99999` clamps to the last page instead of rendering blank
- Added `noteViewedActivity(id)` (in-memory only, no session/local storage) plus return-from-detail highlight/scroll/focus applied to both layouts, guarded by the same `mountedContainer !== ctx.container` stale-render check used throughout the mount path
- Exported the previously-private `formatDurationHms` so `detail.ts` can drop its own duplicate copy in a later plan
- Left an empty `<div class="list-toolbar">` seam for plan 17-09's filter bar, and already call `filterRows` with the URL-parsed (currently-empty) `FilterState` so 17-09 only needs to add controls, not a new data path

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the truncation slice with URL-driven sorting and a desktop table** - `e578d96` (feat)
2. **Task 2: Numbered pagination and return-from-detail row restoration** - `df0311d` (feat)

**Plan metadata:** committed alongside this SUMMARY (worktree final commit)

## Files Created/Modified
- `src/dashboard/views/list.ts` - Rewritten from 223 to 627 lines: URL-driven `ListState` on every mount, `buildHeaderRow`/`buildTableRow`/`buildDesktopTable` (new), `buildSortSelect`/`buildMobileCardList` (mobile equivalent), `buildPageList`/`buildPagination` (new), `noteViewedActivity`/`applyReturnHighlight` (new, D-08), exported `formatDurationHms`; `formatActivityDate`, `formatPace`, and `renderActivityRow`'s markup/behavior all unchanged

## Decisions Made
- Authored both tasks' code together (they compose into one coherent mount() flow) but split the commit history into two atomic commits — one for the desktop table/URL-sorting rewrite, one for pagination/return-highlight — to preserve per-task traceability in git log even though the work was produced as a single pass.
- Kept page-button windowing (`buildPageList`, deciding which of up to 7 numbered buttons to show) in `list.ts` rather than `list-logic.ts`, since it is a rendering/UI decision on top of the already-unit-tested `paginate()` arithmetic, not new sort/filter/pagination math that needs its own DOM-free test coverage.
- The row `<tr>` click handler checks whether the click originated inside an `<a>` and no-ops in that case, so clicking the Activity-cell anchor doesn't also trigger a redundant `navigateTo` call from the row handler bubbling.
- Since `renderActivityRow` intentionally carries no `data-activity-id` (its markup is frozen, D-04), the return-highlight logic locates the matching card by its page-relative array index rather than a DOM attribute query — the desktop `<tr>` (which does carry `data-activity-id`, added fresh in this plan) is located by the same index for consistency.

## Deviations from Plan

None — plan executed exactly as written. One minor self-correction during execution: an early draft of the "URL-state navigation" section comment used the literal substring `location.hash` inside a comment explaining why the module avoids direct hash writes; since the plan's acceptance criteria enforce `grep -c 'location.hash' ... returns 0` as a blunt substring check (not AST/comment-aware), the comment was reworded to "hash assignment" before committing, preserving the same explanation without a false-positive match.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `list.ts` now exports everything plan 17-09 (filter bar) needs to build into: the empty `.list-toolbar` div is already in the DOM in the right position, and `filterRows(indexClient.getRows(), state.filters)` is already wired with the URL-parsed `FilterState`, so 17-09 only needs to add the filter controls and let them write to the same URL query params — no new data path.
- `noteViewedActivity` and the exported `formatDurationHms` are ready for plan 17-14 (`detail.ts`) to call/import — `detail.ts` already imports `formatActivityDate`/`formatPace` from this module, so the dependency direction is unchanged.
- Full automated suite green: `npm test -- --run src/dashboard` (312/312 tests, including the untouched `list.test.ts` formatter tests), `npx tsc --noEmit` clean, `npm run build-widgets` succeeds.
- `npm run verify-dashboard` could not be run to completion in this environment: it requires `dist/widgets/data/dashboard/index.json`, which in turn requires `npm run compute-dashboard-index` against `data/dashboard/index.json`, a generated data artifact not present in this worktree (pre-existing environment gap, unrelated to this plan's source changes — confirmed the missing file has no relationship to `list.ts`). Flagged here for the phase's browser-checkpoint plan (17-15) rather than fixed in this plan, since regenerating the dashboard index is out of this plan's scope (DOM construction/event wiring only, per the plan's own objective).
- DOM interaction behavior (header-click sorting, `aria-sort` toggling, the 720px layout switch, pagination clicks, return-from-detail highlight/scroll/focus) is not automatable without jsdom in this repo (17-RESEARCH.md Pitfall 4) and is carried into plan 17-15's browser checkpoint, as the plan's own `<verification>` section anticipates.
- No blockers for 17-09.

## Self-Check: PASSED

- FOUND: src/dashboard/views/list.ts
- FOUND: commit e578d96 (Task 1)
- FOUND: commit df0311d (Task 2)

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*
