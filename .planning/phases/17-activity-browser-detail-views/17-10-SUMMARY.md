---
phase: 17-activity-browser-detail-views
plan: 10
subsystem: ui
tags: [calendar, dashboard, view-registry, accessibility, vanilla-ts]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views (plan 03)
    provides: "Pure calendar-logic module (parseMonthParam, buildMonthGrid, shiftMonth, monthLabel, formatMonthParam, tintStepForDistance)"
  - phase: 17-activity-browser-detail-views (plan 01)
    provides: "Full calendar CSS class contract (.calendar-header, .calendar-grid, .calendar-day, tint steps, .calendar-picker)"
provides:
  - "Real #/calendar view: tinted month grid, prev/next/jump navigation, multi-run picker"
  - "STUB_PHASE table with no CALENDAR entry (BROWSE-05 is no longer a stub)"
  - "Cross-surface <h1> focus-on-mount rule applied to overview.ts"
affects: [17-15 (browser checkpoint plan — calendar grid/tinting/picker verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin DOM-wiring view over a pure logic module (calendar.ts wraps calendar-logic.ts exactly like list.ts wraps list-logic.ts)"
    - "In-place picker panel (no modal/tooltip) rendered below a grid, replaced on re-open, cleared on unmount"

key-files:
  created: [src/dashboard/views/calendar.ts]
  modified:
    - src/dashboard/view-registry.ts
    - src/dashboard/view-registry.test.ts
    - src/dashboard/view.types.ts
    - src/dashboard/views/overview.ts
  deleted:
    - src/dashboard/views/calendar.stub.ts

key-decisions:
  - "Derived prev/next nav-button month names from monthLabel(shiftMonth(...)) by splitting on the space and dropping the year when it matches the current month, instead of a second month-name table"
  - "Reworded a doc comment that literally contained the substring 'list-logic.ts' (it would have tripped the plan's own grep -c \"list-logic\" == 0 acceptance check on a comment, not code) — kept the intent (D-16 independence) without the literal substring"
  - "overview.ts had no <h1> at all before this plan — added one (text-heading, tabindex=-1, focused after mount) to satisfy the cross-surface focus rule, since the plan's read_first note assumed an existing heading that wasn't actually there"

patterns-established:
  - "Rest-day calendar cells stay real, focusable buttons (consistent Tab order) but carry aria-disabled and no click handler; only outside-the-month cells get the HTML disabled attribute (paired with aria-hidden, since a focusable aria-hidden element is an a11y anti-pattern)"

requirements-completed: [BROWSE-05]

# Metrics
duration: ~10min
completed: 2026-08-11
---

# Phase 17 Plan 10: Calendar View & Cross-Surface Focus Rule Summary

**Real `#/calendar` month-grid training log wired into the view registry — tinted day cells, bookmarkable `?month=YYYY-MM` navigation, a reusable multi-run picker, and the `<h1>` focus-on-mount rule extended to `overview.ts`.**

## Performance

- **Duration:** ~10 min (base commit 17:20:46 → final task commit 17:29:41 CEST)
- **Started:** 2026-08-11T17:20:46+02:00
- **Completed:** 2026-08-11T17:29:41+02:00
- **Tasks:** 2 completed
- **Files modified:** 5 (1 created, 4 modified, 1 deleted)

## Accomplishments
- `createCalendarView({ indexClient })` renders a Sunday-first month grid derived from `buildMonthGrid` (plan 17-03), with a Display-typography month total, an "across {n} runs" caption, visible-text prev/next nav, and a "Jump to month" input — every navigation goes through `navigateTo`/`URLSearchParams`, never `location.hash` directly, so `#/calendar?month=YYYY-MM` stays bookmarkable (D-13)
- Day cells: every grid position (including outside-the-month padding) renders a real `<button>` for a consistent Tab order; rest days show a plain "–" with `aria-disabled`; active days show the day number, a Heading-typography distance figure, an optional `×N` run-count marker, and a distance-tint class (steps 1-4)
- Single-run days navigate straight to `#/activity/:id`; multi-run days open a `.calendar-picker` panel below the grid built from `renderActivityRow` (list.ts's shared card renderer, D-04) — ids the index doesn't know are skipped rather than thrown on (T-17-CAL-03)
- The calendar imports nothing from the list's filter-query module and reads only the shared `IndexClient` (D-16, zero second fetch)
- `calendar.stub.ts` deleted, `view-registry.ts` now imports `createCalendarView`, and `STUB_PHASE` no longer has a `ROUTES.CALENDAR` entry — guarded by a new regression test asserting `STUB_PHASE[ROUTES.CALENDAR]` is `undefined` while `RECORDS`/`TRENDS` remain stubbed (T-17-REG-01)
- `overview.ts` gained a focusable `<h1>` (it had none previously) that receives focus after mount, completing the 17-UI-SPEC § 5 cross-surface focus rule across overview, list (owned by a sibling plan), calendar, and detail

## Task Commits

Both tasks were committed atomically:

1. **Task 1: Build the real calendar view module** - `0f89026` (feat)
2. **Task 2: Multi-run day picker, registry wiring, and stub removal** - `e856d35` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/dashboard/views/calendar.ts` (328 lines, new) — `createCalendarView`, header/grid/day-cell/picker construction, all navigation via `navigateTo`
- `src/dashboard/view-registry.ts` — swapped the `calendarView` stub import/entry for `createCalendarView({ indexClient })`, same array position
- `src/dashboard/view.types.ts` — removed `STUB_PHASE[ROUTES.CALENDAR]`, updated the doc comment
- `src/dashboard/view-registry.test.ts` — new `STUB_PHASE` describe block (regression guard)
- `src/dashboard/views/overview.ts` — added a `text-heading` `<h1>Overview</h1>` with `tabindex="-1"`, focused after mount
- `src/dashboard/views/calendar.stub.ts` — deleted

## Decisions Made
- Note: Task 1's implementation already included the multi-run picker wiring described under Task 2's action text (they share one file, `calendar.ts`, built in a single pass) — Task 2's commit therefore covers only the registry/stub/overview.ts portion of its scope. Both tasks' acceptance criteria are independently satisfied.
- Combined `compute-all-stats` + `compute-dashboard-index` local regeneration was needed purely to get `npm run verify-dashboard` green in this worktree (gitignored `data/stats/`/`data/dashboard/` outputs didn't exist locally yet) — no source files were touched by this, and the resulting `data/geo/geo-metadata.json` timestamp bump from the same pipeline run was explicitly reverted (`git checkout --`) before committing, since it is unrelated to this plan's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a doc comment containing the literal substring "list-logic.ts"**
- **Found during:** Task 1 acceptance verification (`grep -c "list-logic" src/dashboard/views/calendar.ts` must return 0)
- **Issue:** The module's header comment documented D-16 independence by naming `list-logic.ts` explicitly, which is a comment (not code) but still matched the plan's own literal grep check
- **Fix:** Reworded to "the list's pure filter-query module" — same meaning, no literal substring match
- **Files modified:** src/dashboard/views/calendar.ts
- **Verification:** `grep -c "list-logic" src/dashboard/views/calendar.ts` returns 0; full test suite and `tsc --noEmit` still clean
- **Committed in:** 0f89026 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added a page `<h1>` to `overview.ts`, which had none**
- **Found during:** Task 2 (applying the cross-surface focus rule per 17-UI-SPEC § 5)
- **Issue:** The plan's read_first note assumed `overview.ts` already had an `<h1>` to add `tabindex` to ("the `<h1>` construction — the only view no other Phase 17 plan touches"), but the file only had `<h2>` card headings and no page-level heading at all — so there was nothing for assistive tech to focus on hash-navigation into `#/`
- **Fix:** Added `<h1 class="text-heading">Overview</h1>` with `tabindex="-1"`, focused via `.focus()` after mount, matching the pattern used in list.ts/calendar.ts
- **Files modified:** src/dashboard/views/overview.ts
- **Verification:** `grep -c 'tabindex' src/dashboard/views/overview.ts` returns 1; full test suite green (no `overview.test.ts` exists — DOM views aren't unit-tested in this repo's jsdom-free Node test environment, consistent with `router.ts`'s documented precedent)
- **Committed in:** e856d35 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug — wording adjustment to satisfy the plan's own acceptance check; 1 missing critical — added the heading the focus rule required)
**Impact on plan:** Both fixes are necessary for the plan's own stated acceptance criteria and the 17-UI-SPEC focus-management requirement. No scope creep — no other part of `overview.ts` was touched.

## Issues Encountered
- `npm run verify-dashboard` initially failed with two 404s (`data/stats/all-time-totals.json`, `data/stats/streaks.json`) because this worktree had never locally run the gitignored compute-stats pipeline. Ran `npm run build`, `npm run compute-all-stats`, and `npm run compute-dashboard-index`, then rebuilt widgets — all 20 verify-dashboard checks pass. This is a local-environment setup step, not a code defect; no source files changed as a result.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `#/calendar` is a fully registered, real view — plan 17-15's browser checkpoint can exercise grid rendering, distance tinting, and the multi-run picker directly.
- Every Phase 17 view that mounts now focuses its `<h1>` on mount (list.ts's own tabindex addition is owned by a sibling wave-2 plan, 17-08, not yet merged into this worktree at execution time — not a gap in this plan's scope).
- `STUB_PHASE` now only carries `RECORDS` and `TRENDS`, both still Phase 18 stubs, both guarded by the new regression test.
- No blockers for downstream Wave 2+ plans. Full project test suite (555 tests) and `npm run build-widgets && npm run verify-dashboard` (20/20) both pass with these changes included.

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/calendar.ts
- FOUND: calendar.stub.ts deleted
- FOUND: .planning/phases/17-activity-browser-detail-views/17-10-SUMMARY.md
- FOUND: 0f89026 (Task 1 commit)
- FOUND: e856d35 (Task 2 commit)
