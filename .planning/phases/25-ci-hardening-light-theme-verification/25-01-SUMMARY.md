---
phase: 25-ci-hardening-light-theme-verification
plan: 01
subsystem: analytics
tags: [typescript, vitest, tdd, gear-aggregate, type-safety]

# Dependency graph
requires: []
provides:
  - "gearName optional on DashboardIndexRow (D-13), compiler-enumerated presence assumption"
  - "Widened Unknown-bucket predicate at both gear-aggregate-logic.ts call sites (D-12)"
  - "Eight regression tests for absent/undefined/empty/non-string gearName shapes"
affects: [gear-aggregate, dashboard-index, ci-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-and-emptiness predicate (typeof x !== 'string' || x === '') for runtime-optional fields re-parsed from generated JSON, replacing identity checks (=== null) that don't cover the full malformed-input space"
    - "Destructure-omit helper (makeRowWithoutGearName) for constructing an absent-key test fixture when the base builder's spread contract can only set-to-undefined, never omit"

key-files:
  created: []
  modified:
    - src/analytics/dashboard-index.types.ts
    - src/analytics/gear-aggregate-logic.ts
    - src/analytics/gear-aggregate-logic.test.ts

key-decisions:
  - "D-12 predicate applied verbatim at both call sites: typeof label !== 'string' || label === ''"
  - "D-13: gearName made optional; tsc --noEmit triage came back at zero errors, confirming RESEARCH Pattern 4's exhaustive-grep prediction of zero consumer overflow — no todo file needed"

patterns-established:
  - "Type-and-emptiness guard over identity check for optional fields sourced from re-parsed generated JSON"

requirements-completed: [FIX-02]

# Metrics
duration: 3min
completed: 2026-09-04
---

# Phase 25 Plan 01: Gear-Aggregate Unknown-Bucket Hardening Summary

**Widened the Unknown-bucket predicate in `gear-aggregate-logic.ts` from an `=== null` identity check to a `typeof`-and-emptiness test at both call sites, made `gearName` optional on `DashboardIndexRow`, and added eight TDD regression cases observed RED before the fix landed.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-09-04T05:54:00Z (approx, first task commit)
- **Completed:** 2026-09-04T05:55:57Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `gear-aggregate-logic.ts`'s `buildGearAggregate` no longer crashes `slugify(undefined)` when an index row's `gearName` key is absent, `undefined`, or a malformed non-string value — it now degrades into the `Unknown` bucket.
- `buildGearCoverage`'s parallel silent mis-bucketing (counting an absent/undefined/non-string `gearName` as `runsWithGear`) is closed with the same predicate.
- `DashboardIndexRow.gearName` is now `gearName?: string | null`, and `tsc --noEmit` came back clean (zero errors), confirming the RESEARCH Pattern 4 prediction that no other consumer holds the same presence assumption.
- Eight new regression cases (four shapes × two functions) were observed RED against the unfixed predicate before the fix, per the D-11 precedent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make gearName optional on DashboardIndexRow and run the bounded tsc triage (D-13)** - `b3a52741` (feat)
2. **Task 2: Add the four regression shapes and observe them RED against the unfixed predicate (D-12)** - `15b9af05` (test)
3. **Task 3: Widen the Unknown-bucket predicate at both call sites (D-12)** - `467c344b` (feat)

**Plan metadata:** committed as part of this worktree's history; the orchestrator applies the final metadata commit after merge.

_Note: Task 2 is the TDD RED task; Task 3 is the corresponding GREEN task. No REFACTOR commit was needed — the implementation change was already minimal (a single predicate swap at each of two call sites)._

## Files Created/Modified
- `src/analytics/dashboard-index.types.ts` - `gearName` widened from `string | null` to `string | null | undefined` (optional), JSDoc extended with the runtime-reparse rationale (D-13)
- `src/analytics/gear-aggregate-logic.ts` - Both `buildGearAggregate` and `buildGearCoverage` now use the D-12 type-and-emptiness predicate instead of `=== null` / `!== null` identity checks; inline comments cross-reference FIX-02/D-12
- `src/analytics/gear-aggregate-logic.test.ts` - Added `makeRowWithoutGearName` destructure-omit helper plus eight new regression cases (absent key / undefined / empty string / non-string `gearName`, across both `buildGearAggregate` and `buildGearCoverage`)

## D-13 tsc triage

Verbatim `tsc --noEmit` output immediately after widening `gearName` to optional (Task 1), before any other change in this plan:

```
(no output — exit code with zero "error TS" lines; `grep -c "error TS"` on the captured output returned 0)
```

**Disposition of every reported error: N/A — zero errors were reported.** This confirms RESEARCH Pattern 4's exhaustive grep, which predicted the only non-test production sites reading `.gearName` were the two call sites in `gear-aggregate-logic.ts` (fixed in Task 3), the producer `compute-dashboard-index.ts` (always assigns the key, unaffected by widening to optional), and `scripts/verify-dashboard-publish.mjs` (already optional-safe). No `.planning/todos/pending/` file was created — the D-13 bound (fix only overflow up to a handful of files) was never triggered because there was no overflow.

A second `tsc --noEmit` run after Task 3's predicate widening (to confirm the full plan leaves the compiler clean) also produced zero errors.

## RED observations (D-11 precedent)

Verbatim vitest failure output per new case from Task 2, run against the unwidened predicate (`gear-aggregate-logic.ts` untouched at that point):

**`buildGearAggregate > absent gearName key lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)`**
```
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
 ❯ slugify src/analytics/gear-aggregate-logic.ts:43:6
 ❯ buildGearAggregate src/analytics/gear-aggregate-logic.ts:167:18
 ❯ src/analytics/gear-aggregate-logic.test.ts:141:19
```

**`buildGearAggregate > gearName: undefined lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)`**
```
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
 ❯ slugify src/analytics/gear-aggregate-logic.ts:43:6
 ❯ buildGearAggregate src/analytics/gear-aggregate-logic.ts:167:18
 ❯ src/analytics/gear-aggregate-logic.test.ts:150:19
```

**`buildGearAggregate > gearName: empty string lands in the Unknown bucket rather than the shoe fallback key (FIX-02, D-12)`**
```
AssertionError: expected undefined to be 'Unknown' // Object.is equality
- Expected: "Unknown"
+ Received: undefined
 ❯ src/analytics/gear-aggregate-logic.test.ts:161:28
```

**`buildGearAggregate > non-string gearName lands in the Unknown bucket instead of crashing slugify (FIX-02, D-12)`**
```
TypeError: label.toLowerCase is not a function
 ❯ slugify src/analytics/gear-aggregate-logic.ts:43:6
 ❯ buildGearAggregate src/analytics/gear-aggregate-logic.ts:167:18
 ❯ src/analytics/gear-aggregate-logic.test.ts:168:19
```

**`buildGearCoverage > absent gearName key is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:225:33
```

**`buildGearCoverage > gearName: undefined is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:232:33
```

**`buildGearCoverage > gearName: empty string is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:239:33
```

**`buildGearCoverage > non-string gearName is not counted in runsWithGear (FIX-02, D-12)`**
```
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/analytics/gear-aggregate-logic.test.ts:246:33
```

Test file run summary at RED: `Test Files 1 failed (1)`, `Tests 8 failed | 11 passed (19)`. `git diff --name-only` at that point confirmed `src/analytics/gear-aggregate-logic.ts` was NOT modified in Task 2.

After Task 3's predicate widening, all 19 tests in the file pass (`Test Files 1 passed (1)`, `Tests 19 passed (19)`), and `npx vitest run src/analytics` passes all 247 tests across 15 files (no sibling analytics test regressed).

## Decisions Made
- Followed D-12's predicate verbatim at both call sites, with `buildGearCoverage` restructured to bind `row.gearName` to a local `label` const before the `typeof`/`!==` check — required because TypeScript's control-flow narrowing of aliased boolean conditions did not propagate to a bare `row.gearName` re-access two lines later (confirmed via `tsc --noEmit` producing a real type error until the local-binding pattern, matching the one already used in `buildGearAggregate`, was applied). This is a minor implementation detail, not a deviation from D-12's predicate itself.
- Followed D-13's bounded-triage instruction: since `tsc --noEmit` reported zero errors, no todo file was created and no overflow occurred.

## Deviations from Plan

None — plan executed exactly as written. One out-of-scope observation was logged (not fixed, per the scope-boundary rule) rather than treated as a deviation:

### Out-of-scope discovery (logged, not fixed)

**Pre-existing NUL byte in `gear-aggregate-logic.ts`'s `unknownKey` literal**, unrelated to any task's changes in this plan (confirmed present in the commit immediately preceding Task 1 via a byte-level read). Functionally harmless — a NUL byte sorts before any printable character in string comparison, same as the intended leading space — but it causes `git diff`/`file` to classify the file as binary (`Bin X -> Y bytes` diff stat instead of line-level diffs). Logged to `.planning/phases/25-ci-hardening-light-theme-verification/deferred-items.md` rather than fixed, since it is out of scope for FIX-02/D-12/D-13.

## Issues Encountered

TypeScript's aliased-condition control-flow narrowing did not propagate through a bare re-access of `row.gearName` in `buildGearCoverage` — resolved by binding to a local `label` const first (same pattern already used in `buildGearAggregate`), confirmed clean by a follow-up `tsc --noEmit` run. Not a deviation from the plan's specified predicate, just an implementation detail needed to satisfy the compiler.

## Next Phase Readiness

FIX-02 is closed: an index row with an absent/undefined/empty/non-string `gearName` degrades into the Unknown bucket in both `buildGearAggregate` and `buildGearCoverage`, with regression coverage for all four shapes. `gearName` is honest on the type level, and the bounded `tsc` triage confirmed zero blast radius beyond the two fixed call sites. No blockers for the rest of Phase 25's wave 1 plans (CI-01, CI-02, D-06 theme-bootstrap pin).

---
*Phase: 25-ci-hardening-light-theme-verification*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: src/analytics/dashboard-index.types.ts
- FOUND: src/analytics/gear-aggregate-logic.ts
- FOUND: src/analytics/gear-aggregate-logic.test.ts
- FOUND: .planning/phases/25-ci-hardening-light-theme-verification/25-01-SUMMARY.md
- FOUND: .planning/phases/25-ci-hardening-light-theme-verification/deferred-items.md
- FOUND commit: b3a52741 (Task 1)
- FOUND commit: 15b9af05 (Task 2)
- FOUND commit: 467c344b (Task 3)
