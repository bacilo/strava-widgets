---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 11
subsystem: analytics
tags: [pace-derivation, coverage-accounting, vitest, gap-closure, wr-01]

# Dependency graph
requires:
  - phase: 26-01
    provides: "classifyGaps, PaceCoverage, the exact-sum coverage model"
  - phase: 26-02
    provides: "derivePaceSeriesGapAware, adaptiveWindowSec"
  - phase: 26-04
    provides: "paceHistogramSamples and its (now-corrected) exact-coverage invariant claim"
  - phase: 26-10
    provides: "26-REVIEW.md's WR-01 finding and 26-VERIFICATION.md's unsettled-in-both-directions carry-forward"
provides:
  - "WR-01 adjudicated: the zero-net-advance-covered-segment-flanked-by-recording-gaps shape is REACHABLE, proven by a passing classifyGaps assertion"
  - "The old paceHistogramSamples exact-sum claim watched failing twice (synthetic + real archive activity 11865310195), transcript in this file"
  - "unbucketedCoveredSec(coverage, bucketedTimesSec) and paceHistogramAccounting(t, paceSeries, coverage) — the exact, unconditional identity coveredSec === bucketedSec + unbucketedCoveredSec"
  - "paceHistogramSamples's doc comment corrected — the false EXACTLY claim removed"
  - "Archive-wide measurement of the unbucketed-covered residue: 44/1865 activities affected, 43 partial-shortfall, max 109s (activity 5059204779), max ratio 1.0 (activity 11865310195)"
affects: ["26-12", "26-13"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Itemised covered-time accounting: a lossy sum function (paceHistogramSamples) paired with a named residue function (unbucketedCoveredSec) so the two together satisfy an unconditional exact identity, rather than patching the lossy function to be exact"
    - "Demonstrated-failing negative test committed alongside its fix in the SAME commit (Task 1's RED assertions were rewritten to the corrected GREEN identity in Task 2, one commit) — distinct from this file's other TDD-staged blocks which commit RED and GREEN separately"

key-files:
  created: []
  modified:
    - src/analytics/pace-derivation.ts
    - src/analytics/pace-derivation.test.ts

key-decisions:
  - "unbucketedCoveredSec is deliberately NOT clamped at zero — a negative result would indicate bucketed time exceeding covered time, a worse defect than the one being measured, and clamping would hide it (T-26-21, accept-with-control, pinned by a toBeGreaterThanOrEqual(0) test)"
  - "paceHistogramAccounting takes the whole PaceCoverage object, not a bare gapIntervals array, so the itemisation cannot be computed against a coverage object different from the one the samples were derived under (D-16 applied one layer down)"
  - "paceHistogramSamples's signature and body are unchanged — its three existing call sites (detail-zones.ts, compute-pace-residual.mjs, the pre-existing exact-coverage-invariant test block) are untouched; only its doc comment was corrected"
  - "The archive sweep script is throwaway (session scratch dir), never committed to scripts/ — its six measured figures are transcribed into this SUMMARY and a two-activity sample (11865310195, 4556693525) is pinned as a permanent regression test instead"

requirements-completed: []  # COV-01 stays held open for plan 26-13, per this plan's own <success_criteria> — adjudication lands here, requirement closure lands after the browser checkpoint

# Metrics
duration: ~20min
completed: 2026-09-09
---

# Phase 26 Plan 11: WR-01 Adjudication & Itemised Covered-Time Accounting Summary

**Settled WR-01 as a real, reachable defect (not a hypothetical); replaced `paceHistogramSamples`'s false "exact sum" doc claim with an unconditional itemised identity (`unbucketedCoveredSec` + `paceHistogramAccounting`); measured the residue at 44 of 1,865 archive activities.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 completed
- **Files modified:** 2 (`src/analytics/pace-derivation.ts`, `src/analytics/pace-derivation.test.ts`)

## Accomplishments

- WR-01's shape (`makeStream({ t: [0, 12, 14, 26], d: [0, 30, 30, 60] })`) proven reachable with a passing `classifyGaps` assertion — the middle `[12, 14]` segment classifies `covered`, not `pause`, exactly as the interfaces block predicted.
- The old documented invariant ("sum of every returned `timeSec` equals `coverage.coveredSec` EXACTLY") watched failing twice: `0` vs `2` on the synthetic shape, `0` vs `6` on real archive activity `11865310195` — verbatim transcripts below.
- Two new exports land the exact, unconditional replacement identity: `unbucketedCoveredSec(coverage, bucketedTimesSec)` and `paceHistogramAccounting(t, paceSeries, coverage)`, guaranteeing `coveredSec === bucketedSec + unbucketedCoveredSec` by construction.
- `paceHistogramSamples`'s doc comment corrected — the false `EXACTLY` claim is gone (confirmed: `grep -c "EXACTLY"` was `1` at HEAD before this plan, `0` after).
- Archive-wide sweep (1,865 streams, 2026-09-09): 44 activities carry `unbucketedCoveredSec > 0`, 43 of those are the "partial shortfall" case (bars render but understate covered time), max residue 109s (activity `5059204779`), max ratio 1.0 (activity `11865310195`, the same pathological case from Tasks 1-2). Zero identity violations across the whole scanned archive.

## Task Commits

1. **Task 1: Stage WR-01's shape and watch the documented invariant fail** — folded into `d72181a9` (Task 1's RED assertions were rewritten to Task 2's GREEN identity assertions in the same commit, per the plan's own instruction: "Do not commit at the end of this task... both tasks land in one commit.")
2. **Task 1 + Task 2: Itemise the unbucketed covered time and correct the invariant's statement** — `d72181a9` (fix)
3. **Task 3: Measure the archive-wide size of the unbucketed-covered residue** — `c5bf3772` (test)

_Note: Task 1 alone was never committed standalone — the plan explicitly deferred that commit to land jointly with Task 2's fix, so the tree was never left in the deliberately-red intermediate state on disk._

## Demonstrated Failing (Task 1, captured before Task 2's fix)

Running `npx vitest run src/analytics/pace-derivation.test.ts` against the tree with only Task 1's assertions staged (before Task 2's rewrite) produced exactly 2 failing tests, both inside the new `WR-01 — zero-net-advance covered segment flanked by recording gaps` describe block; the reachability assertion (`classifyGaps` returning `coveredSec: 2`) passed. Verbatim vitest output:

```
FAIL src/analytics/pace-derivation.test.ts > WR-01 — zero-net-advance covered segment flanked by recording gaps > demonstrated-failing: the documented invariant is FALSE on the synthetic shape (0 vs 2)
AssertionError: expected +0 to be 2 // Object.is equality
- Expected
+ Received
- 2
+ 0
 ❯ src/analytics/pace-derivation.test.ts:557:30

FAIL src/analytics/pace-derivation.test.ts > WR-01 — zero-net-advance covered segment flanked by recording gaps > demonstrated-failing: the documented invariant is FALSE on real archive activity 11865310195 (0 vs 6)
AssertionError: expected +0 to be 6 // Object.is equality
- Expected
+ Received
- 6
+ 0
 ❯ src/analytics/pace-derivation.test.ts:572:30

 Test Files  1 failed (1)
      Tests  2 failed | 28 passed (30)
```

This is the evidence WR-01 is a real defect, not a hypothetical — matching the plan's `<interfaces>` block predictions exactly (`0 === coveredSec (2)` → FALSE; same shortfall on `11865310195`, `0` vs `6`).

## Archive-wide unbucketed-covered residue (Task 3)

Throwaway node script (session scratch dir, not committed), built against `dist/analytics/pace-derivation.js` (`npm run build` run first), walked every `data/streams/*.json`:

1. **Total streams scanned:** 1,865
2. **Activities with `unbucketedCoveredSec > 0`:** 44
3. **Of those, partial-shortfall (`bucketedSec > 0` too):** 43 — **this is NOT zero.** A histogram DOES render bars for 43 of these 44 activities while the caption's covered-percentage figure overstates what those bars actually sum to; plan 26-12's explanatory note must therefore be able to render alongside bars, not only when bars are entirely absent.
4. **Max `unbucketedCoveredSec` observed:** 109s, activity `5059204779`
5. **Max `unbucketedCoveredSec / coveredSec` ratio observed:** 1.0 (100%), activity `11865310195` — the same pathological, near-degenerate 6-sample stream from Tasks 1-2, where every covered second is unbucketed
6. **Identity violations across the whole scan:** 0 — `coveredSec === bucketedSec + unbucketedCoveredSec` held on all 1,865 streams, script exit code 0

**Scan date:** 2026-09-09. Stream count: 1,865 (the archive grows nightly — re-verify at any later date rather than trusting this number blindly).

Pinned permanently: a new test in the `WR-01` describe block asserts the identity for two named real activities via `readStream` — `11865310195` (`unbucketedCoveredSec` 6, the pathological case) and `4556693525` (`unbucketedCoveredSec` 0 exactly, the pinned worked exemplar — the measured value, not a rounder assumption).

## Files Created/Modified

- `src/analytics/pace-derivation.ts` — added `unbucketedCoveredSec` and `paceHistogramAccounting` exports; corrected `paceHistogramSamples`'s doc comment (removed the false `EXACTLY` claim, named WR-01 and the reproducing shape, pointed to the new function for the general-case identity)
- `src/analytics/pace-derivation.test.ts` — added the `WR-01 — zero-net-advance covered segment flanked by recording gaps` describe block (reachability, itemised-identity on synthetic + real shapes, no-clamp pin, named-sample pin); narrowed the existing `paceHistogramSamples — exact coverage invariant` block's header prose to the two fixtures it actually covers

## Decisions Made

- `unbucketedCoveredSec` is not clamped at zero (T-26-21, accept-with-control) — a negative value is a worse, distinct defect that clamping would hide.
- `paceHistogramAccounting` takes the whole `PaceCoverage`, not a bare `gapIntervals` array, so the itemisation and the samples it itemises cannot silently drift onto different coverage objects (D-16 applied one layer down).
- `paceHistogramSamples`'s three existing call sites were left untouched — only its doc comment changed. Confirmed via `git diff --stat src/dashboard scripts` returning empty.
- The archive sweep script stayed throwaway per the plan's explicit instruction; its six figures are transcribed above rather than the script being committed to `scripts/`.

## Deviations from Plan

None — plan executed exactly as written. Task 1's RED assertions were rewritten in place to Task 2's GREEN `paceHistogramAccounting` assertions within the same task-2 edit pass, matching the plan's own instruction ("Turn Task 1's two failing assertions into the corrected identity... Commit Task 1 and Task 2 together once green").

## Issues Encountered

None related to plan execution. One process note: an early verification attempt used `git stash` to compare working-tree state against a clean checkout — recognized mid-command as a prohibited operation for worktree-isolated agents (stash is shared across the parent repo and all worktrees) and immediately reverted with `git stash pop` before any other command ran, confirmed via `git stash list` showing a single, freshly-created, own-branch entry with nothing intervening. No data was lost; both modified files were restored intact and diffed identically before/after. No `git stash` command was used again for the remainder of this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `unbucketedCoveredSec` / `paceHistogramAccounting` are ready for plan 26-12 to import directly (PACE-01's single-derivation rule) rather than recomputing the subtraction in the dashboard layer.
- Plan 26-12 now has the answer to "does the explanatory note need to render alongside bars, or only when bars are absent": **alongside bars too** — 43 of 44 affected activities are partial-shortfall, not bars-absent.
- COV-01 stays held open per this plan's own `<success_criteria>` — adjudication is complete, but the requirement itself closes in plan 26-13, after the browser checkpoint, per the phase's established pattern.
- `npm run test` in this worktree reports 7 pre-existing, unrelated test-file failures (missing gitignored `data/stats/*.json` fixtures and a missing `node_modules/chartjs-plugin-zoom/dist` asset) — already documented in this phase's `deferred-items.md` from plan 26-01's own execution, confirmed unrelated to this plan's two modified files (`git diff --stat` touches only `pace-derivation.ts`/`.test.ts`). Not fixed, out of scope.

## Self-Check

- `npx vitest run src/analytics/pace-derivation.test.ts` — 32/32 passing (confirmed after Task 3)
- `npx tsc --noEmit` — clean
- `npx vitest run src/analytics/pace-single-source.test.ts` — 73/73 passing (PACE-01 unbroken)
- `npx vitest run src/analytics/pace-fixtures.test.ts` — 34/34 passing (ERA-03 untouched, no fixture name added)
- Built `dist/` node check: `node -e "...paceHistogramAccounting..."` printed `true 6 0 6` for activity `11865310195`, exactly as the plan's acceptance criterion specifies
- `grep -c "EXACTLY" src/analytics/pace-derivation.ts` → `0`; `git show HEAD:src/analytics/pace-derivation.ts | grep -c EXACTLY` (pre-plan) → `1`
- `grep -c "WR-01" src/analytics/pace-derivation.ts` → `3`
- `grep -c "4556693525" src/analytics/pace-derivation.test.ts` → `9`
- `git diff --stat src/dashboard scripts` → empty (no caller touched)
- `git status --porcelain scripts` → empty (sweep script never committed)

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Plan: 11*
*Completed: 2026-09-09*
