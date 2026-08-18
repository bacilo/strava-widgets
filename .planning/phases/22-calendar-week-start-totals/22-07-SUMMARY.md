---
phase: 22-calendar-week-start-totals
plan: 07
subsystem: ui
tags: [security, storage, totality, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    provides: "plan 22-06's deepened 380px compaction and IN-05 header fix, and 22-VERIFICATION.md Gap 2 (CR-01) plus 22-REVIEW.md's WR-01 finding this plan closes"
provides:
  - "resolveWeekStartStorage(override?) in calendar-preferences.ts: the ONLY place in src/dashboard/ allowed to touch a storage global for WEEK_START_STORAGE_KEY, wrapping the globalThis.localStorage property GETTER (not just getItem/setItem) in try/catch"
  - "readStoredWeekStart/writeWeekStart widened to WeekStartStorage | null with an explicit falsy-handle early return (GC-2b)"
  - "calendar.ts's sole storage-resolution call site routed through resolveWeekStartStorage(deps.storage); globalThis.localStorage no longer appears in the file"
  - "weekStartOffset(weekStart): a total offset accessor in calendar-logic.ts so an off-union weekStart degrades to the D-03 Monday default instead of reaching new Array(NaN)"
  - "corrected T-22-WK-01/T-22-WK-02 security notes in calendar-preferences.ts that now describe what the shipped code actually guards"
affects: ["22-08"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded global-storage resolution: a single resolveWeekStartStorage-style function owns the try/catch around a storage global's PROPERTY ACCESS, separate from and in addition to the existing try/catch around getItem/setItem — because the property getter itself can throw before any method call runs"
    - "Total lookup accessor over a Record<Union, T>: replace a direct index expression with a named accessor using an explicit equality ternary (not ??) when the index key's static type is narrower than what a caller can pass at runtime via a cast or bypassed guard"

key-files:
  created: []
  modified:
    - src/dashboard/views/calendar-preferences.ts
    - src/dashboard/views/calendar-preferences.test.ts
    - src/dashboard/views/calendar.ts
    - src/dashboard/views/calendar-logic.ts
    - src/dashboard/views/calendar-logic.test.ts

key-decisions:
  - "GC-2a: resolveWeekStartStorage(override?) lives in calendar-preferences.ts (not calendar.ts), preserving D-06 — that module owns the whole persistence contract"
  - "GC-2b: readStoredWeekStart/writeWeekStart take WeekStartStorage | null and early-return on a falsy handle before their try/catch, making the fallback intentional rather than an artefact of a TypeError swallowed by a catch written for storage-subsystem failures"
  - "GC-2c: fixed the WR-01 totality defect in the CODE (weekStartOffset), not by weakening the JSDoc/security-note claims that assert totality"
  - "GC-2d: kept WEEK_START_OFFSET as-is and added weekStartOffset as a wrapping accessor, preserving plan 22-01's key_links pattern (the literal string WEEK_START_OFFSET) rather than deleting the const"
  - "GC-2e: the off-union regression test asserts deep equality with the 'monday' grid (not merely not.toThrow()), pinning the D-03 default rather than accepting an accidental Sunday fallback"

patterns-established:
  - "A module's own header/JSDoc security notes are treated as claims that must be independently true of the shipped code, not just documentation — corrected in the same commit as the code that makes them true, per this round's GC-2 objective"

requirements-completed: []  # This plan ticks no requirement — CAL-01's robustness caveat closes only on plan 22-08's Round 2 human checkpoint row R15 (a real blocked-site-data browser observation), per the plan's own <success_criteria>

# Metrics
duration: ~20min
completed: 2026-08-18
---

# Phase 22 Plan 07: Guard localStorage Property Access & Make buildMonthGrid Total Summary

**Closed Gap 2 of `22-VERIFICATION.md` (code-review finding CR-01, Critical) by wrapping the `globalThis.localStorage` property GETTER — not just `getItem`/`setItem` — in its own try/catch via a new `resolveWeekStartStorage` resolver, and closed the WR-01 totality defect by adding a total `weekStartOffset` accessor so an off-union `weekStart` degrades to the Monday default instead of throwing `RangeError: Invalid array length`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 5 (`calendar-preferences.ts`, `calendar-preferences.test.ts`, `calendar.ts`, `calendar-logic.ts`, `calendar-logic.test.ts`)

## Accomplishments

- `calendar-preferences.ts` now exports `resolveWeekStartStorage(override?)`, the only place in `src/dashboard/` permitted to touch a storage global for the calendar's week-start key. It returns the override immediately when supplied (never touching the global), otherwise reads `globalThis.localStorage` inside a `try`, returning `null` when absent or when the getter throws.
- `readStoredWeekStart`/`writeWeekStart` were widened to `WeekStartStorage | null` with an explicit `if (!storage)` early return, on top of their pre-existing `getItem`/`setItem` try/catch — so a missing handle is now an intentional, named path rather than an artefact of a `TypeError` being absorbed by an unrelated catch.
- `calendar.ts`'s single storage-resolution call site (`mount()`) now reads `const storage = resolveWeekStartStorage(deps.storage);` — the string `globalThis.localStorage` no longer appears anywhere in the file. Confirmed by both the plan's automated verify script and a direct grep.
- `calendar-preferences.ts`'s header T-22-WK-01/T-22-WK-02 security notes were rewritten to describe what the shipped code actually guards: T-22-WK-02 now names the property getter (not `getItem`/`setItem`) as the throwing operation under blocked site data and cites CR-01; T-22-WK-01 no longer claims a tampered value "can never reach the grid math" and instead describes the defence-in-depth pairing with `weekStartOffset`.
- `calendar-logic.ts` gained a module-private `weekStartOffset(weekStart)` total accessor (an explicit equality ternary, not `??`), used by `leadingPaddingFor` in place of the raw `WEEK_START_OFFSET[weekStart]` index. `WEEK_START_OFFSET` itself is unchanged, preserving plan 22-01's recorded `key_links` pattern.
- New regression tests: a getter-throwing `globalThis.localStorage` stand-in (installed via `Object.defineProperty` with a throwing `get()`, torn down in `afterEach` via `Reflect.deleteProperty`) plus null-handle read/write cases in `calendar-preferences.test.ts`; an off-union `weekStart` ('MONDAY' as never, undefined as never) deep-equality regression against the legitimate `'monday'` grid across two different months in `calendar-logic.test.ts`.
- Full phase gate re-run green on the combined 22-06 + 22-07 tree: `npm test` 1222/1222 (51 files), `npx tsc --noEmit` clean, `npm run build-widgets` exit 0 with zero `css-syntax-error` occurrences, `npm run verify-dashboard` 37/37.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard the localStorage property access end to end (CR-01) and make T-22-WK-02's claim true** - `7436632` (fix)
2. **Task 2: Make buildMonthGrid total for an off-union weekStart (WR-01) and re-run the full phase gate** - `ae80646` (fix)

_Plan metadata commit (SUMMARY.md) is committed separately by this executor per worktree-mode protocol._

## Files Created/Modified

- `src/dashboard/views/calendar-preferences.ts` - Added `resolveWeekStartStorage`, widened `readStoredWeekStart`/`writeWeekStart` to `WeekStartStorage | null`, corrected the T-22-WK-01/T-22-WK-02 header notes
- `src/dashboard/views/calendar-preferences.test.ts` - Added getter-throwing `globalThis` stand-in tests, null-handle read/write cases, and identity/silence assertions for the new resolver
- `src/dashboard/views/calendar.ts` - Replaced the unguarded `deps.storage ?? globalThis.localStorage` with `resolveWeekStartStorage(deps.storage)`; updated the surrounding lazy-resolution comment
- `src/dashboard/views/calendar-logic.ts` - Added `weekStartOffset(weekStart)`, changed `leadingPaddingFor` to call it, updated `buildMonthGrid`'s and the new accessor's JSDoc to cite WR-01
- `src/dashboard/views/calendar-logic.test.ts` - Added an off-union weekStart describe block with 4 regression cases

## Decisions Made

- GC-2a through GC-2e: all pre-settled by the plan's `<settled_decisions>` table; implemented exactly as specified, not reopened.
- No new decisions were required during execution — the plan's `<interfaces>` and `<action>` sections gave enough detail (exact function shapes, exact comment content, exact hard constraints) to implement both tasks without ambiguity.

## Deviations from Plan

**1. [Rule 1 - Bug] `weekStartOffset`'s own JSDoc initially defeated Task 2's negative verify assertion by quoting the literal pattern it was documenting the removal of**
- **Found during:** Task 2's automated verify script (`if(/WEEK_START_OFFSET\[weekStart\]/.test(l)) throw new Error(...)`)
- **Issue:** The first draft of `weekStartOffset`'s JSDoc explained the fix by quoting the old code shape verbatim — `` `WEEK_START_OFFSET[weekStart]` `` — twice in prose. The verify script's negative assertion scans the whole file for that literal substring to confirm the unguarded index expression no longer survives anywhere, so the comment's own quotation of the pattern (for explanatory purposes) tripped a false failure even though no code retained the unguarded index.
- **Fix:** Reworded both JSDoc sentences to describe the same fact ("indexing `WEEK_START_OFFSET` by weekday key is only `undefined` for...", "a direct index into `WEEK_START_OFFSET` is typed non-nullable...") without reproducing the exact bracket-index substring.
- **Files modified:** `src/dashboard/views/calendar-logic.ts`
- **Verification:** Re-ran the plan's exact verify script; it now reports success ("WR-01 closed: total offset accessor in place, off-union regression covered"). Re-ran `npx vitest run calendar-logic.test.ts` (58/58) and `npx tsc --noEmit` (clean) to confirm the wording-only change introduced no regression.
- **Committed in:** `ae80646` (Task 2 commit — caught and corrected before the task's single commit was made, not as a follow-up).

**2. [Rule 3 - Blocking] Copied gitignored generated stats/dashboard data into the worktree to unblock `npm test`, `npm run build-widgets` and `npm run verify-dashboard`**
- **Found during:** Task 2's verification (`npm test`, then the full phase gate)
- **Issue:** This worktree was reset (`git reset --hard`) to the expected phase base commit at agent start and never ran the stats-computation pipeline, so `data/stats/` and `data/dashboard/` (both gitignored) didn't exist here, though several test files and both build/verify scripts read them via `readFileSync`/HTTP. This is a worktree-isolation artifact, matching the identical deviation already documented in `22-06-SUMMARY.md` — not caused by any change in this plan.
- **Fix:** Copied `data/stats/` and `data/dashboard/` (both gitignored, untracked) from the main repo checkout (`/Users/pedf/workspace/strava-widgets/data/{stats,dashboard}`) into this worktree's filesystem. No tracked file was touched; `git status` remained clean of these paths before and after.
- **Files modified:** None tracked (gitignored data directories only).
- **Verification:** `npm test` went from failing (missing data files) to 1222/1222 passing (51 files); `npm run build-widgets` exited 0 with zero `css-syntax-error`; `npm run verify-dashboard` reported 37/37 checks passed.
- **Committed in:** N/A — gitignored, nothing to commit.

---

**Total deviations:** 2 auto-fixed (1 self-correction before commit, 1 blocking/environment)
**Impact on plan:** Neither affects the shipped TypeScript behavior. Deviation 1 was caught and corrected within Task 2 before its commit, so the committed source already reflects the corrected wording. Deviation 2 is a local, gitignored, worktree-only fix with no tracked-file footprint. No scope creep.

## Issues Encountered

None beyond the two items documented above under Deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The guarded storage resolver and the total offset accessor are ready for plan `22-08`'s Round 2 human browser checkpoint, whose row R15 is the only mechanism that can discharge the visual/behavioral claim that a real blocked-site-data browser renders the Calendar instead of "Something went wrong" — this plan's tests simulate the throw; they do not prove real browser behavior (per this plan's own `<verification>` section).
- No requirement is ticked by this plan, matching its `<success_criteria>` exactly — CAL-01's robustness caveat and CAL-02's ~380px overflow judgement both remain gated on plan `22-08`'s human checkpoint.
- `WR-05`'s separate disposition (recorded in `22-REVIEW.md` as resolved by this same widening) is not separately adjudicated here, per this plan's explicit out-of-scope note — it is a byproduct of CR-01's prescribed fix, not a distinct decision this plan made.
- `theme.ts` carries the same unguarded `options.storage ?? localStorage` shape CR-01 identified as a repeated pattern; it was deliberately not touched, as it sits outside this phase's file scope (per the plan's `<objective>`).

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*
