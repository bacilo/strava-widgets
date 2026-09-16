---
phase: 28-pr-plausibility-ceiling
plan: 10
subsystem: testing
tags: [tdd, verification, ceiling, recount, vitest, cli]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling (plan 08)
    provides: the original compute-pr-ceiling-recount.mjs D-15 recount, pinned-fixture computation, KNOWN_GUARDS
provides:
  - recountCeilingSweep(bestEffortsDoc) - classifier-independent sweep comparing every effort's own arithmetic (TARGET_METERS_LOCAL/durationSec) against doc.ceilings[d].ceilingMps, never reading effort.demotion as the over-ceiling answer
  - parseInputPaths(argv) - --best-efforts/--index CLI flags, defaulting to the committed data/ paths
  - evaluateReport now fails on the sweep's problems (over-ceiling-with-no-demotion, ceiling-guard-not-over-ceiling, independent-count-vs-byGuard.ceiling disagreement, unevaluable efforts, missing ceilings) and on the pinned fixture (absent, guard != 'ceiling', durationSec != 45.2), plus "ceiling sweep was not run" if sweep is ever omitted
  - IN-03 fix: recountDemoted(null) / recountDemoted({}) no longer throw
  - Verbatim FAIL demonstration against the real pre-fix data/stats/best-efforts.json (generatedAt 2026-09-10T23:08:32.377Z): exit 1, all 13 CR-01 labels, independent ceiling count 31 vs byGuard.ceiling 18, guardIsCeiling=false
affects: [28-11 (CR-01 fix, parallel worktree), 28-14 (reconciles regenerated diff against this recount's 31 figure), 28-15 (Round 2 checkpoint)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Classifier-independent verification: recompute the answer from raw inputs using locally-declared constants (TARGET_METERS_LOCAL), never trust the field the classifier under test wrote (effort.demotion) as ground truth for what SHOULD have happened"
    - "A computed-but-unused check is not a check: guardIsCeiling existed since plan 08 but only evaluateReport wiring it into problems[] gave it teeth (WR-05)"

key-files:
  created: []
  modified:
    - scripts/compute-pr-ceiling-recount.mjs
    - scripts/compute-pr-ceiling-recount.test.mjs

key-decisions:
  - "Distance meters are duplicated locally in TARGET_METERS_LOCAL rather than imported from best-effort.types, per D-15's zero-import discipline - the whole point of an independent recount is sharing no vocabulary module with the code it checks"
  - "recountCeilingSweep never reads effort.demotion to decide whether an effort IS over the ceiling (only to decide whether something ALREADY demoted it) - this is what makes CR-01's shape (an over-ceiling effort with demotion: null) detectable at all"
  - "Fail-open distances (ceilingMps null) are reported separately in failOpenDistances rather than folded into unevaluable, since a fail-open distance is a valid state (per D-15/D-08), not an evaluation failure"

requirements-completed: []  # PR-04/PR-05 stay reopened per orchestrator instruction; this plan builds the verifier, it does not itself satisfy the requirement (28-11 fixes the classifier, 28-15 re-verifies)

# Metrics
duration: ~20min
completed: 2026-09-16
---

# Phase 28 Plan 10: Ceiling Sweep Teeth for the Classifier-Independent Recount Summary

**`recountCeilingSweep` gives D-15's recount independent arithmetic over every effort's implied speed vs. `doc.ceilings`, and `evaluateReport` now actually fails on the pinned-fixture check it already computed but never used — demonstrated failing against the real pre-fix archive (13 labels, 31 vs 18, `guardIsCeiling=false`).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-16T11:44:00Z (approx, worktree branch verification)
- **Completed:** 2026-09-16T11:53:00Z
- **Tasks:** 2 (RED, GREEN)
- **Files modified:** 2

## Accomplishments

- `recountCeilingSweep(bestEffortsDoc)` walks every effort in the shipped document, computes `TARGET_METERS_LOCAL[distance] / durationSec` itself, and compares it against `doc.ceilings[distance].ceilingMps` — a genuinely classifier-independent check that never reads `effort.demotion` as the answer to "is this effort over the ceiling."
- `evaluateReport` now fails the verdict on 5 new sweep-derived conditions and 3 pinned-fixture conditions that were previously either unchecked or computed-but-ignored (WR-05, 28-REVIEW.md).
- `parseInputPaths` adds `--best-efforts <path>` / `--index <path>` flags so the recount can be pointed at an absolute primary-tree path from a worktree where `data/` is gitignored and absent.
- IN-03 closed: `recountDemoted(null)` / `recountDemoted({})` no longer throw.
- The recount was run against the real pre-fix `data/stats/best-efforts.json` (generatedAt `2026-09-10T23:08:32.377Z`, confirmed via precondition check before AND after the CLI run) and demonstrated failing exactly as WR-05/CR-01 predicted.

## Task Commits

1. **Task 1: RED — tests for the ceiling sweep, the pinned-fixture verdict and the input-path flags** - `e0ddb312` (test)
2. **Task 2: GREEN — implement the sweep, the verdict checks and the path flags, then show a FAIL on the real pre-fix archive** - `16962c8c` (feat)

_Note: no plan-metadata commit hash yet — this SUMMARY's own commit is the metadata commit for this worktree (orchestrator does not want STATE.md/ROADMAP.md touched here)._

## Files Created/Modified

- `scripts/compute-pr-ceiling-recount.mjs` - Added `TARGET_METERS_LOCAL`, `recountCeilingSweep`, `parseInputPaths`; extended `evaluateReport` with sweep and pinned-fixture problems; fixed IN-03; wired sweep + path flags into `main()`; updated header docblock.
- `scripts/compute-pr-ceiling-recount.test.mjs` - Added `recountCeilingSweep` describe block (8 tests), `parseInputPaths` describe block (4 tests), sweep-problems and pinned-fixture-problems describe blocks under `evaluateReport` (9 tests), `recountDemoted` null-safety test, and the named CR-01 regression-shape test. Updated `cleanDemotedReport()`'s `pinnedFixture` to a clean present/ceiling/matching shape and added a `cleanSweep()` helper; every pre-existing `evaluateReport` call that passes a `demoted` object was updated to also pass `sweep: cleanSweep()` so it stays clean under the new checks.

## RED Phase — Failing Test Names (captured before implementation)

`npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` at the RED commit (`e0ddb312`): **23 failed / 24 passed** (47 total). The 23 failures (all due to `recountCeilingSweep`/`parseInputPaths` being undefined, or `evaluateReport` not yet reading `report.sweep`/`pinnedFixture` problems):

```
evaluateReport > fails naming "ceiling sweep was not run" when sweep is absent but demoted is present
evaluateReport > sweep problems > fails naming every label when sweep.overCeilingWithoutDemotion is non-empty
evaluateReport > sweep problems > fails naming the problem when sweep.ceilingDemotedButNotOverCeiling is non-empty
evaluateReport > sweep problems > fails naming both numbers when independentCeilingCount disagrees with byGuard.ceiling
evaluateReport > sweep problems > fails naming the problem when sweep.unevaluable is non-empty
evaluateReport > sweep problems > fails naming the problem when sweep.ceilingsMissing is true
evaluateReport > pinned-fixture problems > fails naming the problem when the pinned fixture guard is not "ceiling"
evaluateReport > pinned-fixture problems > fails naming the problem when pinnedFixture durationSec does not match 45.2
evaluateReport > pinned-fixture problems > fails naming the problem when the pinned fixture is absent (PR-05 check would be vacuous)
recountCeilingSweep > returns overCeilingWithoutDemotion and independentCeilingCount 1 for one excluded 400m effort over the ceiling with demotion null
recountCeilingSweep > does not flag an effort at exactly ceiling speed (strict >)
recountCeilingSweep > lists an effort with guard "ceiling" whose implied speed is not over the ceiling in ceilingDemotedButNotOverCeiling
recountCeilingSweep > does not count or list an over-ceiling effort already demoted by world-record or max-speed
recountCeilingSweep > contributes nothing for a fail-open distance (ceilingMps null) and lists it in failOpenDistances
recountCeilingSweep > lists an effort whose distance has no local meters entry in unevaluable, never silently skipping it
recountCeilingSweep > returns ceilingsMissing true when the document has no ceilings object
recountCeilingSweep > does not throw for null or empty input, returning ceilingsMissing true
recountDemoted null-safety (IN-03) > does not throw for recountDemoted(null) or recountDemoted({})
CR-01 regression shape (D-04, D-15) > fails on the CR-01 shape: an owner-excluded over-ceiling effort with demotion null
parseInputPaths > returns the two default paths when no flags are present
parseInputPaths > returns the given paths when both flags are present
parseInputPaths > throws naming the flag when --best-efforts has no value
parseInputPaths > throws naming the flag when --index has no value
```

## GREEN Phase — Test Result

`npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` at the GREEN commit (`16962c8c`): **47/47 passed** (0 failed), including all pre-existing tests from plan 08.

## Pre-Fix CLI Demonstration — Verbatim Output

Precondition confirmed both before and after the run: `data/stats/best-efforts.json`'s `generatedAt` is `2026-09-10T23:08:32.377Z` (unchanged — the pre-fix document has NOT been regenerated).

Command run from this worktree (absolute primary-tree paths, since `data/` is gitignored and absent inside the worktree):

```
node scripts/compute-pr-ceiling-recount.mjs --best-efforts /Users/pedf/workspace/strava-widgets/data/stats/best-efforts.json --index /Users/pedf/workspace/strava-widgets/data/dashboard/index.json
```

**Exit code: 1**

Verbatim stdout/stderr:

```
D-15 independent recount: reading /Users/pedf/workspace/strava-widgets/data/stats/best-efforts.json and /Users/pedf/workspace/strava-widgets/data/dashboard/index.json off disk (no ceiling/compute/utils/types import)...

Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 52
  Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      18
    unrecognised guards: 0
  Per-distance breakdown (own arithmetic):
    10k: 0
    1k: 11
    1mi: 5
    400m: 36
    5k: 0
    half: 0
    marathon: 0
  Cross-check vs. doc.totals.effortsDemoted: own=52 totals=52 disagrees=false
  Cross-check ownRejectedNonErrorRows vs. ownDemotedTotal: rejected=52 demoted=52 disagrees=false
  rankedButDemotedIds (0): (none)
  demotedWithoutReason (0): (none)
  Pinned fixture 4556693525@400m: durationSec=45.2 guard=null durationMatches45_2=true guardIsCeiling=false

Ceiling sweep (own arithmetic, doc.ceilings vs TARGET/durationSec):
  independentCeilingCount: 31
  overCeilingWithoutDemotion (13): 14122328106@400m, 3475711469@400m, 3475711630@400m, 3475715178@400m, 3475725513@1k, 3475726256@400m, 3475727228@400m, 3475732221@400m, 3475735603@400m, 4556693525@400m, 4556693525@1k, 5059204779@400m, 5588316886@400m
  Per-distance overCeilingWithoutDemotion counts:
    1k: 2
    400m: 11
  ceilingDemotedButNotOverCeiling (0): (none)
  failOpenDistances: marathon
  unevaluable (0): (none)
  ceilingsMissing: false

PR-05 impossible-sample cohort (own arithmetic, live denominator):
  archiveDenominator: 1890
  rowsWithQuality:    1890
  rowsMissingQuality: 0
  cohortCount:        662
  cohortPct:          35%

  CAUTION: the impossible-sample cohort (activities carrying at least one physically impossible SAMPLE anywhere in their stream) and the demoted-effort population (efforts at one of the seven target distances rejected by a guard) are two different measurements, not two views of one number. A sample can be impossible mid-run without ever landing inside a swept target window, and a demoted effort can occur in an activity whose other samples never crossed the per-sample floor.
  Overlap with the demoted-effort population:
    cohortWithDemotedEffort:    35
    cohortWithoutDemotedEffort: 627
    demotedNotInCohort:         1
    biteRatePct (finding, not a threshold): 5.3%

FAIL:
  - pinned fixture 4556693525@400m guard is null, not "ceiling" (guardIsCeiling=false)
  - 13 over-ceiling effort(s) carry no demotion (CR-01 shape): 14122328106@400m, 3475711469@400m, 3475711630@400m, 3475715178@400m, 3475725513@1k, 3475726256@400m, 3475727228@400m, 3475732221@400m, 3475735603@400m, 4556693525@400m, 4556693525@1k, 5059204779@400m, 5588316886@400m
  - independent ceiling count (31) disagrees with byGuard.ceiling (18)
```

**Verified:** the 13 labels in `overCeilingWithoutDemotion` are exactly the 13 the planner's interfaces block and 28-VERIFICATION.md list (11 at 400m, 2 at 1k), with no additions and no omissions. `independent ceiling count (31) disagrees with byGuard.ceiling (18)` and `guardIsCeiling=false` both appear verbatim in the FAIL block, closing 28-VERIFICATION.md gap 1 and gap 3's "the recount reports PASS" defect.

`git status --porcelain data/` after the run: empty (nothing under `data/` was written; the script remains read-only).

## Decisions Made

- Distance meters (`TARGET_METERS_LOCAL`) duplicated locally rather than imported, per D-15 — this is the entire point of an independent recount and was explicitly required by the plan's interfaces block.
- `recountCeilingSweep` treats a fail-open distance (`ceilingMps: null`) as a distinct, valid, non-evaluable-failure state (`failOpenDistances`), separate from `unevaluable` (which is reserved for a genuinely unrecognised distance key or an invalid `durationSec`) — this distinction matters because a fail-open distance is D-08's designed behavior, not a data defect.
- Extended the printed CLI output with a new "Ceiling sweep" block (independent count, per-distance breakdown, fail-open distances, unevaluable count) so the sweep's own numbers are visible on every run, not just embedded in the pass/fail verdict.

## Deviations from Plan

None - plan executed exactly as written. One acceptance-criterion nuance worth recording: the criterion `grep -n "dist/analytics\|src/analytics" scripts/compute-pr-ceiling-recount.test.mjs` returns nothing` does not hold literally — line 58 of the test file (pre-existing from plan 08, unmodified by this plan) contains the string `dist/analytics/best-effort-ceiling.js` inside a **test fixture string** deliberately constructed to prove the `stripComments()` helper actually removes such strings before the real zero-import guard test runs against the script's own source. This is not a real import and was already present before this plan started; the actual zero-import guard (`grep -vE '^\s*(\*|//)' scripts/compute-pr-ceiling-recount.mjs | grep -cE "import .*(...)"` against the `.mjs` source file, not the test file) returns `0` as required.

## Issues Encountered

- The worktree had no `node_modules` (native `sqlite3` failed to build via `npm install` — Xcode license not accepted on this machine, unrelated to this plan). Resolved by symlinking `node_modules` from the main repo checkout, since `package.json`/`package-lock.json` are byte-identical between the worktree and main repo at this base commit. `node_modules` is gitignored so this did not affect `git status`.

## Next Phase Readiness

- The recount now genuinely fails on the CR-01 shape and reports an independently-derived ceiling count of **31** against `byGuard.ceiling`'s **18** — this 31 figure is what plan 28-14 must reconcile the regenerated diff against once plan 28-11's CR-01 fix lands.
- This worktree's `scripts/compute-pr-ceiling-recount.mjs` reflects the sweep/verdict fix ONLY — `src/analytics/compute-best-efforts.ts` (the actual CR-01 fix) is untouched here by design; that is plan 28-11's job in its own parallel worktree.
- No blockers for the wave's other plans. PR-04/PR-05 remain reopened in `REQUIREMENTS.md` as instructed — this plan does not tick them.

---

## Self-Check: PASSED

- FOUND: `scripts/compute-pr-ceiling-recount.mjs`
- FOUND: `scripts/compute-pr-ceiling-recount.test.mjs`
- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-10-SUMMARY.md`
- FOUND: commit `e0ddb312` (RED, test)
- FOUND: commit `16962c8c` (GREEN, feat)

---

*Phase: 28-pr-plausibility-ceiling*
*Plan: 10*
*Completed: 2026-09-16*
