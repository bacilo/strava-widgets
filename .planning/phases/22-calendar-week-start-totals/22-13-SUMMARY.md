---
phase: 22-calendar-week-start-totals
plan: 13
subsystem: testing
tags: [vitest, typescript, localStorage, theme, storage-resolver, tdd-mutation-gate]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    provides: "storage.ts's resolveStorage BL-03 resolver and theme.ts's applyThemeMode/watchSystemTheme, both established in earlier Round 1-3 plans"
provides:
  - "resolveStorage(override?: WebStorage | null) that discriminates on override !== undefined, so an explicit null is an honoured opt-out rather than a truthiness-coerced fallthrough (WR-01)"
  - "theme.ts's applyThemeMode/watchSystemTheme passing options.storage through to resolveStorage untouched (no ?? undefined coercion)"
  - "watchSystemTheme's isAuto?: () => boolean guard option, letting an in-memory mode controller decide the auto-only guard instead of re-deriving it from storage"
  - "sentinel-backed GC-9a/b/c/d tests in storage.test.ts and theme.test.ts that fail if the null override is silently discarded, replacing three vacuous environment: 'node' passes"
  - "GC-8a/b/c isAuto coverage in both directions plus an unedited-fallback confirmation"
affects: [22-14-nav-theme-in-memory-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "presence-discriminated optional override (override !== undefined) instead of a truthiness check, to distinguish an explicit null opt-out from an omitted argument"
    - "recording sentinel global (setItemCalls array) installed via Object.defineProperty(globalThis, 'localStorage', { get() {...} }) inside a test, torn down in afterEach with Reflect.deleteProperty — makes a fallthrough-to-global bug detectable instead of accidentally passing under environment: 'node'"
    - "verify-time non-vacuity mutation gate: temporarily revert the fix under test, assert the suite goes red, then unconditionally restore the file — proves the new tests actually discriminate the bug rather than passing for an unrelated reason"

key-files:
  created: []
  modified:
    - src/dashboard/storage.ts
    - src/dashboard/theme.ts
    - src/dashboard/storage.test.ts
    - src/dashboard/theme.test.ts

key-decisions:
  - "resolveStorage's override param widened to WebStorage | null and its short-circuit changed from `if (override)` to `if (override !== undefined)`, matching the plan's exact target signature and fixing WR-01 without touching the BL-03 try/catch body below it"
  - "theme.ts's two `resolveStorage(options.storage ?? undefined)` call sites became `resolveStorage(options.storage)`, letting the resolver's own presence check do the discrimination instead of a caller-side coercion that was silently erasing null"
  - "isAuto is captured once (`const isAuto = options.isAuto;`) before the listener closure is built, per the plan's explicit instruction not to read options.isAuto inside the listener body"
  - "the three vacuous storage: null tests were deleted rather than kept alongside the new sentinel cases, since their assertions are now fully subsumed by GC-9b/GC-9c under the sentinel-backed environment"

patterns-established:
  - "non-vacuity mutation gate as a mandatory build step for degraded-storage/opt-out test suites: revert the fix, assert red, restore unconditionally in a finally block"

requirements-completed: [CAL-01]

# Metrics
duration: 20min
completed: 2026-08-19
---

# Phase 22 Plan 13: Honour explicit storage: null and add isAuto guard Summary

**`resolveStorage` now discriminates presence (`override !== undefined`) instead of truthiness, so an explicit `storage: null` opt-out is honoured end to end instead of being silently upgraded to the real `globalThis.localStorage`; `watchSystemTheme` gained an `isAuto` guard seam for plan 22-14's in-memory theme controller, and the three tests that used to pass vacuously now fail if either regresses.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-19T11:49:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Closed `22-REVIEW.md` WR-01 / `22-VERIFICATION.md` truth #8: `theme.ts` no longer coerces an explicit `storage: null` into `undefined` before calling `resolveStorage`, so the real browser store is never touched when a caller opts out.
- Landed the `isAuto` seam `watchSystemTheme` needs for plan 22-14's in-memory theme-mode controller (second half of CR-01).
- Replaced three vacuous `storage: null` tests (that passed only because `vitest.config.ts` runs `environment: 'node'` with no `globalThis.localStorage` set at all) with sentinel-backed GC-9a/b/c/d cases that install a live, recording `globalThis.localStorage` and fail if the null override is ignored.
- Added a mandatory non-vacuity mutation gate to the verify step: temporarily reverting `resolveStorage` to its old truthiness form turns the new suite red, proving the replacement tests are discriminating rather than passing for the wrong reason (the exact defect pattern flagged as Repudiation threat T-22-R4-12).
- Added GC-8a/b/c covering `isAuto` overriding the storage-derived guard in both directions, plus confirmation that omitting `isAuto` still consults storage unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Honour an explicit `storage: null` in the resolver and stop coercing it away in theme.ts, and add watchSystemTheme's isAuto guard option** - `b508830` (fix)
2. **Task 2: Replace the three vacuous null-storage tests with sentinel-global cases that fail if the override is ignored, and cover the isAuto guard** - `19e3eb2` (test)

_Note: both tasks were marked `tdd="true"`. The plan structures its own RED/GREEN proof across the two tasks rather than within a single task: Task 1 lands the fix and its verify re-runs the pre-existing suite unedited; Task 2 writes the new sentinel-backed tests and its verify includes a mandatory mutation gate that reverts Task 1's fix and asserts the Task-2 suite goes red before restoring the file — functionally the same red-then-green discipline, expressed as a build-verify-mutate-restore proof instead of a literal test-then-implement ordering._

## Files Created/Modified
- `src/dashboard/storage.ts` - `resolveStorage`'s override param widened to `WebStorage | null`; short-circuit changed from `if (override)` to `if (override !== undefined)`; JSDoc rewritten to state the three-way contract and cite WR-01
- `src/dashboard/theme.ts` - both `resolveStorage(options.storage ?? undefined)` call sites (`applyThemeMode`, `watchSystemTheme`) changed to `resolveStorage(options.storage)`; `watchSystemTheme` options gained `isAuto?: () => boolean`, captured once before the listener; JSDoc updated on both functions
- `src/dashboard/storage.test.ts` - added GC-9a (`resolveStorage(null)` returns `null` under an installed live sentinel)
- `src/dashboard/theme.test.ts` - added `sentinelStorage`/`installSentinelGlobal` helpers; replaced two `applyThemeMode` vacuous cases with GC-9b/GC-9d; replaced one `watchSystemTheme` vacuous case with GC-9c; added GC-8a/GC-8b/GC-8c for the `isAuto` guard; added `afterEach` teardown in both describe blocks

## Decisions Made
- Kept the BL-03 `try { globalThis.localStorage ?? null } catch { null }` body in `storage.ts` byte-for-byte untouched — only the entry short-circuit changed, preserving the throwing-getter and absent-global guards Task 1's verify re-ran unedited.
- Deleted rather than retained the three original vacuous `storage: null` tests, since GC-9b/GC-9c/GC-9d fully subsume their assertions under a sentinel that makes them actually discriminating.
- Used the identical sentinel install/teardown shape already established in `storage.test.ts` (`Object.defineProperty` getter + `Reflect.deleteProperty` in `afterEach`), per the plan's explicit instruction not to introduce `vi.stubGlobal`.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and the mandatory non-vacuity gate passed on the first implementation attempt; no auto-fixes were required.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 22-14 (nav.ts in-memory theme mode) can now consume `watchSystemTheme`'s `isAuto` option to fix CR-01 without re-deriving the guard from storage.
- `resolveStorage(null)` is a fully honoured, tested opt-out for any future caller (dashboard module or test) that needs to declare "no storage" explicitly.
- `npx tsc --noEmit -p tsconfig.json` exits 0; `npx vitest run src/dashboard` is fully green apart from the five pre-existing `data/stats/`-dependent environmental failures documented in `deferred-items.md`, untouched by this plan.
- `git status --porcelain` (verified pre-commit-metadata) shows only this plan's four `files_modified` entries touched.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-19*

## Self-Check: PASSED

All four modified source/test files and this SUMMARY.md were confirmed present on disk; both task commit hashes (`b508830`, `19e3eb2`) were confirmed present in `git log --oneline --all`.
