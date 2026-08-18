---
phase: 22-calendar-week-start-totals
plan: 02
subsystem: ui
tags: [typescript, vitest, css, localStorage, calendar]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    plan: 01
    provides: "WeekStart union exported from calendar-logic.ts; buildMonthGrid's required weekStart parameter"
provides:
  - "calendar-preferences.ts: WEEK_START_STORAGE_KEY, WeekStartStorage, parseWeekStart, readStoredWeekStart, writeWeekStart"
  - ".calendar-grid as an 8-track CSS grid (repeat(7, 1fr) auto)"
  - ".calendar-week-total / __distance / __time / __count stacked-cell CSS, no new .segmented CSS"
affects: [22-03-calendar-view-wiring, 22-04-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Calendar-scoped localStorage persistence module mirroring theme.ts's injectable-storage + allow-list-parse + throw-tolerant-both-paths discipline, narrowed to exactly three total functions with no key registry (D-06)"
    - "CSS 8th grid track sized `auto` (content-sized) rather than `1fr`, so a 3-value total cell does not fight the 7 equal day columns"

key-files:
  created:
    - src/dashboard/views/calendar-preferences.ts
    - src/dashboard/views/calendar-preferences.test.ts
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Reworded the CAL-03 discharge comment above the Calendar CSS block to avoid literally containing the exact substrings '.calendar-header .segmented' / '.calendar .segmented' inside a CSS comment — the plan's own styles.test.ts assertion checks the raw css string (including comments) for absence of those tokens, so a documentation comment naming them verbatim would have been a false positive on the exact guard it was written next to. Same intent (record that no calendar-scoped segmented nesting was added), different wording."
  - "Used bodyForSelectorListToken (not a bespoke check) for every 'resolves to a top-level rule, not media-nested' assertion — it already calls assertNotAtRuleScoped internally when a token is found only inside an at-rule block, which is exactly the plan's requested guard shape."

requirements-completed: []  # CAL-01/CAL-02 need calendar.ts (22-03) wired to this module and this CSS before either requirement is satisfiable end to end; this plan lands the two self-contained halves plan 22-03 consumes.

# Metrics
duration: ~25min
completed: 2026-08-18
---

# Phase 22 Plan 02: Calendar Preferences & Week-Total CSS Summary

**Built the calendar-scoped week-start persistence module (mirroring `theme.ts`'s injectable-storage discipline) and the `.calendar-grid` 8th column / `.calendar-week-total` stacked-cell CSS that plan 22-03's view wiring consumes.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-18T14:32:00Z
- **Completed:** 2026-08-18T14:36:30Z
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified — all in `files_modified` scope)

## Accomplishments

- `calendar-preferences.ts` exports exactly three total functions (`parseWeekStart`, `readStoredWeekStart`, `writeWeekStart`) plus `WEEK_START_STORAGE_KEY` and the `WeekStartStorage` interface — no key registry, no generic preference helper. `parseWeekStart` allow-lists the exact literals `'sunday'`/`'monday'` (case-sensitive — `'MONDAY'` falls back rather than being normalised) and falls back to `'monday'` for everything else with zero console output and no write-back. Both `readStoredWeekStart` and `writeWeekStart` wrap their storage call in try/catch, matching `theme.ts:63-69`/`:101-108` exactly.
- 22 new unit tests cover the allow-list (including all 10 named tamper values from the plan: `null`, `undefined`, `''`, `'MONDAY'`, `'Sunday'`, `'3'`, `0`, `{}`, `[]`, `true`), the no-console-output guard, the exact-key read (proving no collision with `dashboard-theme`), throwing-storage tolerance on both the read and write paths, and that a tampered read never triggers a `setItem` repair call.
- `.calendar-grid` is now an 8-track grid (`repeat(7, 1fr) auto`); `.calendar-week-total` has its own vertically stacked layout (no `grid-template-areas`, no border, no tint) reusing `.calendar-day__distance`'s 20px/600 and `.calendar-day__count`'s 14px/400/`--text-secondary` typography tokens verbatim. A 380px compaction reduces padding and the distance line to 14px/600, matching the existing `.calendar-day` compaction shape. No new `.segmented` CSS was added.
- `styles.test.ts` gained 16 new parse-level assertions in a `describe('styles.css — Phase 22 calendar week totals', ...)` block, all using existing helpers (`bodyForSelectorListToken` for the top-level-not-media-nested guard, raw `css` string checks for the absent-modifier and absent-segmented-nesting guards).
- Full suite green: `npx tsc --noEmit` clean; `calendar-preferences.test.ts` 22/22; `styles.test.ts` 108/108; `npm test` 50/50 files, 1172/1172 tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the calendar-scoped week-start persistence module and its unit tests** - `48e05ce` (feat)
2. **Task 2: Give the calendar grid an 8th track and the week-total cell its own stacked layout** - `4a53828` (feat)

_No separate plan-metadata commit in this worktree — orchestrator commits STATE.md/ROADMAP.md centrally after merge; SUMMARY.md is committed by this same executor per worktree protocol._

## Files Created/Modified

- `src/dashboard/views/calendar-preferences.ts` - new calendar-scoped persistence module: `WEEK_START_STORAGE_KEY`, `WeekStartStorage`, `parseWeekStart`, `readStoredWeekStart`, `writeWeekStart`, header threat notes T-22-WK-01/T-22-WK-02
- `src/dashboard/views/calendar-preferences.test.ts` - new test file, 22 tests covering the allow-list, tamper resistance, the Monday fallback, and throwing-storage tolerance on both paths
- `src/dashboard/styles.css` - `.calendar-grid`'s `grid-template-columns` extended to `repeat(7, 1fr) auto`; new `.calendar-week-total`/`__distance`/`__time`/`__count` rules; new 380px compaction block adjacent to the Calendar block; a CAL-03 discharge comment above the Calendar block recording that the third `.segmented` instance needs zero new CSS
- `src/dashboard/styles.test.ts` - new `describe('styles.css — Phase 22 calendar week totals', ...)` block, 16 tests

## Decisions Made

- Reworded the CAL-03 discharge comment to avoid literally containing the two forbidden selector-nesting substrings the plan's own test asserts are absent from the raw `css` string — see key-decisions above for the full reasoning. Functionally identical documentation, no scope change.
- Used `bodyForSelectorListToken` throughout the new test block rather than writing a bespoke at-rule-scope check, since it already implements exactly the "resolves to a top-level rule, throws loudly if only found inside a media query" behavior the plan asked for.

## Deviations from Plan

None functional — plan executed exactly as written, with one self-caught wording fix (see Decisions Made) discovered by running the plan's own verification gate rather than by a separate review pass.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied gitignored `data/stats/*.json` and `data/dashboard/index.json` fixtures into the worktree to run `npm test`**
- **Found during:** Task 2 verification (`npm test`)
- **Issue:** 5 test files (`trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`, and two siblings) read these gitignored, pipeline-generated files directly from disk at module load time. They are present in the main repo checkout but absent from this fresh git worktree — the same known worktree/untracked-file limitation plan 22-01 documented and resolved identically.
- **Fix:** Copied `data/stats/` and `data/dashboard/` from the main checkout (`/Users/pedf/workspace/strava-widgets/data/`) into this worktree, untracked (both are gitignored — confirmed via `git check-ignore -v`).
- **Files modified:** None tracked — `git status --porcelain` confirms only `src/dashboard/styles.css` and `src/dashboard/styles.test.ts` show as modified after the copy.
- **Verification:** `npm test` — 50/50 files, 1172/1172 tests green (up from 45/50 files before the copy).
- **Committed in:** N/A — untracked, gitignored, not committed (matching plan 22-01's precedent).

---

**Total deviations:** 1 auto-fixed (1 blocking, environment-only — no source change)
**Impact on plan:** None on scope. The fixture copy exists purely to exercise the plan's own `npm test` verification gate inside a fresh worktree; it leaves no trace in the git history.

## Issues Encountered

- Same worktree/untracked-fixture limitation plan 22-01 already documented — resolved the same way, with `git check-ignore -v` confirming both directories are gitignored before copying.
- One self-caught test failure: the CAL-03 discharge comment written above the Calendar CSS block (documenting that no `.calendar-header .segmented`/`.calendar .segmented` rule was added) literally contained those two substrings as backtick-quoted prose, which the plan's own `css.not.toContain(...)` assertion checks against the RAW stylesheet text (including comments), not the comment-stripped view. Caught immediately by running `npx vitest run src/dashboard/styles.test.ts` before committing; reworded the comment to convey the same fact without the literal substrings, re-ran, green.

## Next Phase Readiness

- `calendar-preferences.ts` is ready for plan 22-03's `calendar.ts` import: `readStoredWeekStart(globalThis.localStorage)` on mount, `writeWeekStart(storage, next)` in the toggle handler.
- `.calendar-week-total`/`__distance`/`__time`/`__count` and the 8-track `.calendar-grid` are ready for plan 22-03's `buildWeekTotalCell` and per-week render-loop restructuring.
- `theme.ts` untouched (`git status --porcelain src/dashboard/theme.ts` empty) — D-06's scope fence held.
- No blockers. This plan makes no visual claim (PROJECT.md line 49) — the CSS assertions are parse-level only; D-10's mobile-layout risk and CAL-03's rendered-focus-ring claim remain plan 22-04 checkpoint rows, as the plan explicitly states.

## Self-Check: PASSED

- FOUND: src/dashboard/views/calendar-preferences.ts
- FOUND: src/dashboard/views/calendar-preferences.test.ts
- FOUND commit: 48e05ce (Task 1)
- FOUND commit: 4a53828 (Task 2)

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*
