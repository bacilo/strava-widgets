---
phase: 22-calendar-week-start-totals
plan: 04
subsystem: ui
tags: [typescript, vitest, dom, calendar, localStorage, accessibility]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    plan: 02
    provides: "writeWeekStart(storage, value) — calendar-preferences.ts; .segmented CSS already reaching a third instance with zero opt-in"
  - phase: 22-calendar-week-start-totals
    plan: 03
    provides: "renderGrid(gridEl, grid, month, weekStart, pickerHost, indexClient); mount()-scoped let weekStart/let grid seeded by readStoredWeekStart; const storage resolved lazily"
provides:
  - "The Sunday/Monday .segmented control in .calendar-header, a third faithful instance of the shape at records.ts:633-652 and detail-charts.ts:257-276"
  - "setWeekStart(next) — synchronous, persists via writeWeekStart, clears an open picker, rebuilds the grid in place with buildMonthGrid/renderGrid, moves focus nowhere"
  - "calendar.test.ts source-structure guard block asserting the toggle handler never grows focus()/mount()/navigateTo/await and the segmented markup never drifts from the two shipped instances"
affects: [22-05-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third .segmented instance copying records.ts's setScope/detail-charts.ts's setXAxisMode shape exactly: early-return on no-op, reassign the mode variable, toggle --active + aria-pressed on BOTH options, call one named rebuild function"
    - "A toggle handler closes over gridEl/pickerHost declared later in the same synchronous mount() body — safe because nothing appends to ctx.container or can receive a click until mount() finishes constructing the whole view"
    - "Source-structure guard tests (readFileSync + brace-balanced function-body extraction) as the automated proxy for a focus/interaction invariant that Node/Vitest cannot observe directly, matching row-semantics.test.ts's precedent"

key-files:
  created: []
  modified:
    - src/dashboard/views/calendar.ts
    - src/dashboard/views/calendar.test.ts

key-decisions:
  - "Reworded two in-source comments to avoid literal '.focus()' and 'focus' substrings that would have been counted by the plan's own exact-count guards (grep -c '\\.focus()' == 2, and Task 2's setWeekStart-body-must-not-contain-'focus' assertion) — same wording-vs-guard tension plans 22-02/22-03 already documented for their own prose. Said 'ends by moving focus to the heading below' instead of 'ends in `h1.focus()`', and 'the active element stays on that button' instead of 'focus is on that button', in both cases preserving the sentence's meaning."
  - "Used brace-balanced function-body extraction in the guard test (counting nested {/}) rather than a naive match-to-first-closing-brace, matching the plan's literal instruction in spirit while staying correct if a future edit adds a nested block inside setWeekStart."

requirements-completed: [CAL-01, CAL-03]

# Metrics
duration: ~20min
completed: 2026-08-18
---

# Phase 22 Plan 04: Week-Start Toggle Control Summary

**Added the third `.segmented` Sunday/Monday toggle in the calendar header, wired to a synchronous `setWeekStart` that persists via `writeWeekStart`, clears an open picker, and rebuilds the grid in place with zero focus movement and zero new CSS.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-18T14:46:00Z
- **Completed:** 2026-08-18T14:51:16Z
- **Tasks:** 2 completed
- **Files modified:** 2 (both in `files_modified` scope)

## Accomplishments

- `.calendar-header` gained a `div.segmented` with `role="group"` and `aria-label="Week start"`, containing `sundayOption`/`mondayOption` buttons — a faithful third instance of the shape at `records.ts:633-652` and `detail-charts.ts:257-276`, appended immediately after the `.calendar-jump` wrapper and before `view.appendChild(header)` (D-02). Unlike both shipped instances, the initial active option is derived from `weekStart` (already read from storage), not hard-coded to the first-listed option — with nothing stored, Monday starts active (D-03).
- `setWeekStart(next)` early-returns on a no-op, reassigns `weekStart`, toggles `--active`/`aria-pressed` on both options, calls `writeWeekStart(storage, next)` (D-05), clears the picker host (DISC-7), reassigns `grid` via `buildMonthGrid`, and rebuilds via `renderGrid` — fully synchronous, containing none of `focus`, `mount(`, `navigateTo`, or `await` (D-04). `h1.focus()` and the two `mountedContainer !== ctx.container` guards were left untouched.
- No new CSS: `.segmented`/`.segmented__option[--active]` and the shared hover/focus rules already reach a third instance with zero opt-in — confirmed by an empty `git status --porcelain src/dashboard/styles.css`.
- `calendar.test.ts` gained a `describe('calendar.ts — Phase 22 source-structure guards', ...)` block (10 new tests): brace-balanced extraction of `setWeekStart`'s body asserts the four forbidden substrings are absent and the four required calls are present; a file-wide check confirms exactly two `.focus()` sites, neither inside the extracted body; the segmented markup, `tabindex` count, ARIA-grid-role absence, and D-02 source-position ordering are each independently asserted.
- Full suite green: `npx tsc --noEmit` clean; `calendar.test.ts` 31/31 (21 pre-existing + 10 new); `npm test` 51/51 files, 1203/1203 tests; `npm run build-widgets` clean (pre-existing unrelated esbuild standalone-page warnings only); `npm run verify-dashboard` 37/37 checks passed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the Sunday/Monday segmented control and the in-place, focus-preserving setWeekStart** - `3d8e134` (feat)
2. **Task 2: Guard the toggle contract and the segmented markup invariants with source-structure tests** - `55699ff` (test)

_No separate plan-metadata commit in this worktree — orchestrator commits STATE.md/ROADMAP.md centrally after merge; SUMMARY.md is committed by this same executor per worktree protocol._

## Files Created/Modified

- `src/dashboard/views/calendar.ts` - imports `writeWeekStart`; builds the `.segmented` Sunday/Monday control in `.calendar-header` with storage-derived initial state; adds `setWeekStart(next)` (synchronous, persist + clear picker + rebuild grid, no focus movement) and its two click listeners
- `src/dashboard/views/calendar.test.ts` - new `describe('calendar.ts — Phase 22 source-structure guards', ...)` block, 10 tests covering D-04 (toggle handler contract), D-01 (segmented markup), D-11 (no new focus stop), D-02 (source placement)

## Decisions Made

See `key-decisions` in frontmatter — both are wording adjustments made to keep the plan's own exact-count/substring-absence guards meaningful (avoiding literal `.focus()`/`focus` occurrences inside prose that the guards scan), with no change to behavior or scope.

## Deviations from Plan

None functional — plan executed exactly as written, with two self-caught wording fixes (see Decisions Made) discovered by running the plan's own verification gates before committing, the same pattern plans 22-02 and 22-03 already established for this codebase.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied gitignored `data/dashboard/` and `data/stats/` fixtures into the worktree to run `npm test`/`npm run build-widgets`/`npm run verify-dashboard`**
- **Found during:** Task 1 verification (`npm test`)
- **Issue:** Several test files and the build/verify scripts read these gitignored, pipeline-generated files directly from disk. They are present in the main repo checkout but absent from this fresh git worktree — the same known worktree/untracked-file limitation plans 22-01/22-02/22-03 already documented and resolved identically.
- **Fix:** Copied `data/dashboard/` and `data/stats/` from the main checkout (`/Users/pedf/workspace/strava-widgets/data/`) into this worktree, untracked (both gitignored — confirmed via `git check-ignore -v`).
- **Files modified:** None tracked — `git status --short` after the copy showed only the intended source/test files.
- **Verification:** `npm test` 51/51 files, 1203/1203 tests; `npm run build-widgets` clean; `npm run verify-dashboard` 37/37 checks passed.
- **Committed in:** N/A — untracked, gitignored, not committed (matching plans 22-01/22-02/22-03's precedent).

---

**Total deviations:** 1 auto-fixed (1 blocking, environment-only — no source change)
**Impact on plan:** None on scope. The fixture copy exists purely to exercise the plan's own verification gates inside a fresh worktree; it leaves no trace in the git history.

## Issues Encountered

- Two self-caught wording collisions with the plan's own exact-count/substring-absence guards: the D-04 comment above `setWeekStart` originally read "...ends in `h1.focus()`..." which pushed the file-wide `.focus()` count to 3 (expected 2); the DISC-7 comment inside `setWeekStart`'s body originally used the word "focus" twice, which Task 2's own guard test would have flagged as present inside the extracted body. Both caught by running the plan's verification commands (Task 1's grep-based checks, then Task 2's own vitest run) before committing; reworded to convey the same fact without the literal substrings, re-ran, both green.

## Next Phase Readiness

- CAL-01 (selectable, persisted week start) and CAL-03 (shared control styling) are now both structurally complete — the control exists, persists, and reuses Phase 19's button baseline with zero new CSS.
- **No visual or interaction claim is discharged by this plan.** That the control renders with Phase 19's hover/focus-ring/active contrast, that the header baseline holds across four mixed-height controls (D-02's flagged risk), and that focus genuinely stays on the pressed button after a toggle are all plan 22-05's blocking browser checkpoint rows (PROJECT.md line 49). The source-structure guard tests added here are the automated proxy for those claims, not a substitute.
- No blockers.

## Self-Check: PASSED

- FOUND: src/dashboard/views/calendar.ts (modified, contains `segmented__option`, `aria-label', 'Week start'`)
- FOUND: src/dashboard/views/calendar.test.ts (modified, contains `setWeekStart`, `readFileSync`)
- FOUND commit: 3d8e134 (Task 1)
- FOUND commit: 55699ff (Task 2)

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*
