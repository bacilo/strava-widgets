---
phase: 22-calendar-week-start-totals
plan: 01
subsystem: ui
tags: [typescript, vitest, calendar, pure-module, date-math]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    provides: calendar-logic.ts's original buildMonthGrid/DayCell/MonthGrid pure module and its Sunday-hard-coded firstWeekdayOfMonth
provides:
  - "WeekStart union ('sunday' | 'monday') exported from calendar-logic.ts"
  - "buildMonthGrid(rows, month, weekStart) with weekStart as a required third parameter — no default, no optional marker"
  - "DayCell.totalTimeSec, summed via the same || 0 reduce shape as totalDistanceM"
  - "WeekTotal interface and MonthGrid.weekTotals[] — per-week distance/time/runCount, daysShown, isPartial, derived from in-month cells only (D-13)"
  - "54 passing calendar-logic.test.ts cases: every pre-existing Sunday expectation re-pinned explicitly, 5 new Monday-start padding cases, a both-starts comparison, and 7 weekTotals derivation cases"
affects: [22-02-calendar-preferences, 22-03-calendar-view-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required (non-optional, non-defaulted) parameter as the sole compile-time enforcement mechanism for a behavior change (D-08) — verified by npx tsc --noEmit failing on any missed call site"
    - "Pure per-row derivation (weekTotals) computed via .map()/.reduce() immediately after the existing weeks construction, filtering to non-null cells first"

key-files:
  created: []
  modified:
    - src/dashboard/views/calendar-logic.ts
    - src/dashboard/views/calendar-logic.test.ts
    - src/dashboard/views/calendar.ts

key-decisions:
  - "D-08's required weekStart parameter breaks calendar.ts's one production call site at compile time by design; since that call site's real wiring is plan 22-03's job, this plan pinned it to a literal 'sunday' (preserving pre-phase runtime behavior) with a TODO(22-03) comment, rather than leaving the repo non-compiling or expanding this plan's scope into calendar.ts's toggle/persistence work"
  - "weekTotals derivation lives inside buildMonthGrid itself (not a separate exported function) — it needs only the already-built weeks array and DayCell fields, keeping the module's single-pass-then-derive shape"

requirements-completed: []  # CAL-01/CAL-02 need calendar.ts (22-03) and calendar-preferences.ts (22-02) wired before either requirement is satisfiable end to end; this plan lands only the pure-module half.

# Metrics
duration: ~35min
completed: 2026-08-18
---

# Phase 22 Plan 01: Calendar Grid Math Generalization Summary

**Generalized `buildMonthGrid`'s hard-coded Sunday-first leading padding to a required `WeekStart` parameter and added a `weekTotals` per-week derivation (distance/time/run count, in-month-only), with 54 passing unit tests covering both week starts.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-18T~11:53:00Z
- **Completed:** 2026-08-18T12:28:54Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 in scope per `files_modified`, 1 out-of-scope compile fix — see Deviations)

## Accomplishments

- `buildMonthGrid(rows, month, weekStart)` now takes `weekStart: WeekStart` as a required third parameter (no default, no `?`), replacing the raw `firstWeekdayOfMonth` Sunday hard-coding with `(rawDow - WEEK_START_OFFSET[weekStart] + 7) % 7` via a new module-private `leadingPaddingFor` helper.
- `DayCell` gained `totalTimeSec` (same `|| 0` reduce shape as `totalDistanceM`, summing `movingTimeSec`); `MonthGrid` gained `weekTotals: WeekTotal[]`, one entry per `weeks[i]` row, summing only the non-null (in-month) cells in that row (D-13) and carrying `daysShown`/`isPartial` (D-14).
- Every pre-existing Sunday-first `buildMonthGrid` expectation in `calendar-logic.test.ts` is re-pinned to pass `'sunday'` explicitly, with test titles naming Sunday so none rides an implicit default now that the app default is Monday (D-03).
- 13 new tests added: 5 Monday-start padding cases matching the plan's verified arithmetic table, a same-month-both-starts comparison, and 7 `weekTotals` derivation cases (length invariant, full week, D-13 boundary exclusion of an adjacent-month run, rest week zeros, multi-run same-day time rollup, both-week-starts reconciliation against `monthTotalM`/`runCount`, and NaN-`movingTimeSec` totality).
- `tsc --noEmit` across all 49 test files confirms D-08's enforcement mechanism: the one production call site (`calendar.ts:236`) was the only place a two-argument call survived, and it now fails to compile without a third argument.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalize buildMonthGrid to a required weekStart, add totalTimeSec and weekTotals, re-pin every existing test to explicit 'sunday'** - `e92b494` (feat)
2. **Task 2: Prove both week starts and the week-total derivation with new unit cases** - `4b28caa` (test)

_No separate plan-metadata commit in this worktree — orchestrator commits STATE.md/ROADMAP.md centrally after merge; SUMMARY.md is committed by this same executor per worktree protocol._

## Files Created/Modified

- `src/dashboard/views/calendar-logic.ts` - `WeekStart` union, `WEEK_START_OFFSET`, `leadingPaddingFor` helper; `buildMonthGrid`'s required third parameter; `DayCell.totalTimeSec`; `WeekTotal` interface; `MonthGrid.weekTotals` derivation; updated doc comments (module header D-15 scope-fence note, `MonthGrid`/`buildMonthGrid` no-longer-Sunday-hard-coded wording)
- `src/dashboard/views/calendar-logic.test.ts` - twelve pre-existing `buildMonthGrid` call sites re-pinned to `'sunday'` with titles naming it; 13 new tests (5 Monday-start padding + both-starts comparison + 7 `weekTotals` derivation cases)
- `src/dashboard/views/calendar.ts` - one-line call-site fix at line 236, pinning `buildMonthGrid`'s new required third argument to the literal `'sunday'` with a `TODO(22-03)` comment (see Deviations)

## Decisions Made

- Kept `weekTotals` derivation as an inline `.map()`/`.reduce()` directly in `buildMonthGrid`, matching the exact shape sketched in `22-PATTERNS.md`, rather than extracting a separately-exported helper — there is no consumer for a standalone derivation function outside this one call site.
- Did NOT add `monthTotalTimeSec` to `MonthGrid` per the plan's explicit non-goal (no consumer; `calendar.ts:243` renders only km and run count).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned `calendar.ts`'s one production `buildMonthGrid` call site to a literal `'sunday'` argument**
- **Found during:** Task 1 verification (`npx tsc --noEmit -p tsconfig.json`)
- **Issue:** D-08 requires `weekStart` as a required (non-optional, non-defaulted) third parameter — by design, this makes any call site missing the argument a compile error. `calendar.ts:236` is the one production call site, and its real wiring (reading the persisted `WeekStart` preference) is explicitly plan 22-03's scope, not this plan's. Left unfixed, the repo would not compile after Task 1, failing this plan's own `npx tsc --noEmit` verification gate.
- **Fix:** Added a one-line literal `'sunday'` third argument at `calendar.ts:236`, with a `TODO(22-03)` comment explaining it is a temporary placeholder preserving the pre-phase runtime behavior (the app was hard-coded Sunday-first before this phase) until plan 22-03 wires in the real preference.
- **Files modified:** `src/dashboard/views/calendar.ts`
- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0; `calendar.ts`'s rendered behavior is unchanged (still Sunday-first) until 22-03 lands.
- **Committed in:** `e92b494` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the repo compiling after D-08's required-parameter change; scoped to the minimum one-line fix, with an explicit TODO pointing at the plan (22-03) that owns the real wiring. No scope creep into calendar.ts's toggle/persistence work.

## Issues Encountered

- `npm test` initially failed 5 test files with `ENOENT` errors reading `data/stats/*.json` and `data/dashboard/index.json` — these are gitignored, pipeline-generated files present in the main repo checkout but not copied into this fresh git worktree (a known worktree/untracked-file limitation, unrelated to this plan's changes). Copied them from the main checkout into the worktree (untracked, no git diff) to actually exercise the full suite as the plan's verification step requires; confirmed `git status --porcelain` shows only the intended source file changed. Resolved: full suite green (49/49 files, 1135/1135 tests) with no regression in `trends-logic.test.ts` or `records-logic.test.ts`.

## Next Phase Readiness

- `calendar-logic.ts` now exports `WeekStart`, and `buildMonthGrid`'s generalized signature and `weekTotals` derivation are ready for plan 22-02 (`calendar-preferences.ts`, which imports `type WeekStart`) and plan 22-03 (`calendar.ts`'s segmented toggle, render-loop restructuring, and replacing the temporary `'sunday'` literal at line 236 with the persisted preference).
- D-15 scope fence held: `git status --porcelain` on `trends-logic.ts`, `records-logic.ts`, and `analytics.types.ts` is empty — none were touched.
- No blockers. The `calendar.ts:236` literal is a known, documented placeholder, not a hidden gap — it is named explicitly in both the inline `TODO(22-03)` comment and this summary.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*
