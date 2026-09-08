---
phase: 22-calendar-week-start-totals
plan: 14
subsystem: ui
tags: [vitest, typescript, theme, dom-free-controller, tdd-mutation-gate]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    provides: "storage.ts's resolveStorage (presence-discriminated null opt-out) and theme.ts's watchSystemTheme isAuto seam, both from plan 22-13"
provides:
  - "nav-theme.ts's createThemeToggleController — a DOM-free, in-memory theme-mode state machine (mode/isAuto/toggle/syncSystemTheme) seeded once by the caller and reassigned per toggle()"
  - "nav.ts wired onto the controller: exactly one storage-backed theme read at mount, zero per-click reads, watchSystemTheme's auto-only guard routed through isAuto"
  - "a source-scanning regression guard (GC-8j) that fails if a per-click readStoredMode(resolveStorage()) is ever reintroduced into nav.ts"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extracted DOM-free controller module for unit-testability under environment: 'node' — mirrors calendar.ts:443's `let weekStart = readStoredWeekStart(storage)` shape, now generalized into a reusable in-memory-state-machine pattern"
    - "source-scanning regression guard: comment-strip a consumer module and assert exact occurrence counts of the fixed API, plus a body-slice check on the specific function that must not regress"
    - "verify-time non-vacuity mutation gate (carried from plan 22-13): temporarily reintroduce the literal defect shape in the controller, assert the suite goes red, then unconditionally restore the file"

key-files:
  created:
    - src/dashboard/nav-theme.ts
    - src/dashboard/nav-theme.test.ts
  modified:
    - src/dashboard/nav.ts

key-decisions:
  - "GC-8d's 'no storage installed' assertion was made hermetic by explicitly Reflect.deleteProperty(globalThis, 'localStorage') before deriving the seed, rather than asserting on ambient Node-version behavior — Node 22+ ships a built-in globalThis.localStorage even under vitest's environment: 'node', which the plan's own working assumption (written against an older Node baseline) did not anticipate. storage.test.ts's existing afterEach already relied on this same deletion; this plan's new test now does the same deletion explicitly and eagerly rather than by incidental test-order side effect."
  - "apply: applyThemeMode type-checks directly as the controller's void-returning apply dep without a wrapper, since a function returning Theme is structurally assignable to a void-returning signature — no adapter function needed, exactly as the plan's interfaces block anticipated."

patterns-established:
  - "in-memory session-state controller as the fix shape for any future per-click storage-re-read bug: seed once from resolveStorage()-backed read, reassign in a single closure variable, never re-derive from storage inside the event handler"

requirements-completed: [CAL-01]

# Metrics
duration: ~15min
completed: 2026-08-19
---

# Phase 22 Plan 14: DOM-free in-memory theme-mode controller closing CR-01 Summary

**New `src/dashboard/nav-theme.ts` extracts the header theme toggle's mode into an in-memory, DOM-free `createThemeToggleController`, seeded once at mount and reassigned per click, fixing the CR-01 defect where a null/unusable storage handle stranded the toggle on light forever and made dark and auto unreachable.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-19T11:59:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Closed `22-VERIFICATION.md` Gap 2 / `22-REVIEW.md` CR-01: `nav.ts`'s theme toggle no longer re-derives the current mode from storage on every click. `readStoredMode(resolveStorage())` under a null handle returned a constant `'auto'`, and `cycleThemeMode('auto')` returned a constant `'light'`, so click 1, click 2 and click N all applied light — dark and auto were unreachable.
- Extracted the fix into a new, DOM-free `src/dashboard/nav-theme.ts` module (`createThemeToggleController`) that holds the mode in a single closure variable, mirroring `calendar.ts:443`'s `let weekStart = readStoredWeekStart(storage)` — the working precedent that never had this bug, because it already reassigns in memory instead of re-reading storage per interaction.
- Proved the fix with a unit test (`nav-theme.test.ts`, GC-8d) asserting three toggles apply exactly `['light', 'dark', 'auto']` with no storage global installed at all — the exact configuration that produced `['light', 'light', 'light']` before — plus seed-relative cycling (GC-8f), `isAuto()` tracking (GC-8g), `syncSystemTheme` behavior (GC-8h), and immunity to a throwing `localStorage` sentinel (GC-8i).
- Closed the second half of CR-01: `watchSystemTheme`'s auto-only guard is now routed through `isAuto: () => themeController.isAuto()` instead of re-reading storage on every system colour-scheme change, so a user's in-session choice is no longer silently overridden under a null handle.
- Added a source-scanning regression guard (GC-8j) over `nav.ts` — comment-stripped, it asserts exactly one `readStoredMode(` (the mount seed), zero `cycleThemeMode`, exactly one `createThemeToggleController(`, exactly one `isAuto:`, and that `handleThemeToggleClick`'s body contains neither `readStoredMode` nor `resolveStorage`. This guard was RED at the end of Task 1 (by design — Task 2 had not yet wired `nav.ts`) and GREEN at the end of Task 2.
- Ran the plan's mandatory non-vacuity gate: reverting `nav-theme.ts`'s `currentMode = cycleThemeMode(currentMode);` to the literal CR-01 shape `currentMode = cycleThemeMode('auto');` turns `nav-theme.test.ts` red, proving GC-8d discriminates the actual defect rather than merely asserting the controller's existence. The file was restored unconditionally afterward and confirmed byte-identical (`git status --porcelain` clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the DOM-free in-memory theme-mode controller and prove three clicks reach dark with no storage at all** - `66a358f` (test)
2. **Task 2: Wire nav.ts onto the controller, route watchSystemTheme's guard through isAuto, and prove the defective form goes red** - `1ac4542` (fix)

_Note: this plan structures its own RED/GREEN proof across the two tasks, same as plan 22-13's pattern — Task 1 lands the controller and its test suite (with GC-8j's source guard intentionally RED, since `nav.ts` had not yet been rewired), and Task 2's verify includes the mandatory mutation gate that reverts the controller's fix and asserts the suite goes red before restoring the file._

## Files Created/Modified
- `src/dashboard/nav-theme.ts` (created) - `createThemeToggleController`: one `let currentMode: ThemeMode` closure variable; `mode()`, `isAuto()`, `toggle()` (reassigns before calling `apply`/`render`, then returns the new mode), `syncSystemTheme(prefersDark)` (applies/renders `'auto'` without reassigning `currentMode`). Imports only `cycleThemeMode`/`ThemeMode`/`ApplyThemeOptions` from `theme.ts` — no storage import, no storage global reference.
- `src/dashboard/nav-theme.test.ts` (created) - GC-8d through GC-8j: the three-click no-storage proof (with an explicit hermetic `Reflect.deleteProperty(globalThis, 'localStorage')` before deriving the seed and in an `afterEach`), return-value/seed-relative/isAuto/syncSystemTheme cases, a throwing-sentinel immunity case, and the source-scanning guard over `nav.ts`.
- `src/dashboard/nav.ts` (modified) - Replaced the `cycleThemeMode` import with `createThemeToggleController` from `./nav-theme.js`; constructs the controller once at mount seeded by the sole remaining `readStoredMode(resolveStorage())` call; `handleThemeToggleClick` now delegates to `themeController.toggle()`; `watchSystemTheme` is now called with `{ isAuto: () => themeController.isAuto() }` and its callback delegates to `themeController.syncSystemTheme(prefersDark)`; header comment rewritten to describe the new one-seed/zero-per-click-read/in-memory-controller shape. `THEME_MODE_LABEL`, the SVG builders, nav links, hamburger handlers and `setActiveRoute` are all untouched; `destroy()`'s `removeEventListener('click', handleThemeToggleClick)` still works unchanged since the named function reference was preserved.

## Decisions Made
- Made GC-8d's "no storage installed" precondition hermetic against Node 22+'s built-in `globalThis.localStorage` (present even under vitest's `environment: 'node'`) by explicitly deleting the global before deriving the seed, rather than relying on ambient Node-version behavior the plan's own wording assumed. This is a same-file, test-correctness fix scoped entirely to the new test this plan adds — no production code or contract changed.
- `apply: applyThemeMode` needed no wrapper function — `applyThemeMode`'s `Theme`-returning signature is structurally assignable to the controller's `void`-returning `apply` dependency, exactly as the plan's `<interfaces>` block predicted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made the new GC-8d "no storage" test hermetic against Node 22+'s built-in `globalThis.localStorage`**
- **Found during:** Task 1, first run of `nav-theme.test.ts`
- **Issue:** The plan's GC-8d instructions assumed `environment: 'node'` under this repo's Node baseline has no `globalThis.localStorage` at all. Node 22+ (this worktree runs Node 25) ships a built-in `localStorage` global by default, so `expect('localStorage' in globalThis).toBe(false)` failed when the test file ran in isolation — the ambient assumption baked into the plan is now false for this Node version. (`storage.test.ts`'s equivalent assertion only passes today because an earlier test's `afterEach` incidentally deletes the built-in as a side effect before that assertion runs — an order-dependent accident, not something this new file could rely on in isolation.)
- **Fix:** Added an explicit `Reflect.deleteProperty(globalThis, 'localStorage')` immediately before deriving the seed in GC-8d, plus an `afterEach` in the enclosing describe block doing the same, so the "no storage handle at all" precondition is asserted deterministically rather than assumed from environment defaults.
- **Files modified:** `src/dashboard/nav-theme.test.ts`
- **Verification:** `npx vitest run src/dashboard/nav-theme.test.ts` — all 11 cases pass (GC-8d through GC-8i green immediately; GC-8j green after Task 2).
- **Committed in:** `66a358f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test-only, no production code affected)
**Impact on plan:** Test-correctness fix confined to the plan's own new test file. Does not change the controller's contract, `nav.ts`'s wiring, or any acceptance criterion — GC-8d still discriminates the exact `['light','light','light']` defect shape the plan specified, now deterministically rather than by incidental Node-version luck.

## Issues Encountered
None beyond the Node-version test-hermeticity fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CR-01 is fully closed at the code level: the header theme toggle reaches dark and auto under a null/unusable storage handle, and `watchSystemTheme`'s auto-only guard no longer overrides an explicit in-session choice.
- `npx tsc --noEmit -p tsconfig.json` exits 0; `npx vitest run src/dashboard` is fully green apart from the five pre-existing `data/stats/`-dependent environmental failures (a worktree artifact — those fixtures are gitignored and absent in this worktree, confirmed unrelated to this plan's changes), matching the same five failures noted in `22-13-SUMMARY.md`.
- `git status --porcelain` (verified pre-commit-metadata) shows only this plan's three `files_modified` entries touched.
- Automated tests cannot observe the rendered toggle under a real browser's blocked-site-data configuration — that remains checkpoint row **R27**, staged for plan `22-16`'s browser checkpoint per this plan's own `<verification>` section. Not exercised by this plan; non-waivable per house rule 14.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-19*

## Self-Check: PASSED

All three modified/created source files (`src/dashboard/nav-theme.ts`, `src/dashboard/nav-theme.test.ts`, `src/dashboard/nav.ts`) and this SUMMARY.md were confirmed present on disk; both task commit hashes (`66a358f`, `1ac4542`) were confirmed present in `git log --oneline --all`.
