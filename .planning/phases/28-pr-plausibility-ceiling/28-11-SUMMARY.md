---
phase: 28-pr-plausibility-ceiling
plan: 11
subsystem: analytics
tags: [best-effort-engine, plausibility-ceiling, ceiling-demotion, exclusions, vitest, tdd]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    provides: "The three-pass compute-best-efforts.ts shape, best-effort-ceiling.ts's pure deriveCeilings/ceilingDemotion, and D-10's separate demotion/excludedFromRecords fields (plans 28-01..28-09)"
provides:
  - "compute-best-efforts.ts's Pass 3 applies ceilingDemotion to every owner-excluded effort whose own demotion is still null, closing CR-01"
  - "A real-exclusion pinned regression test for 4556693525 that reads data/best-effort-exclusions.json directly, asserting demotion.guard === 'ceiling' at both 400m and 1k"
  - "A precedence test proving an excluded, world-record-beating effort keeps its world-record demotion, not the ceiling"
  - "A non-circularity-with-exclusion test proving the derivation population is unaffected by the fix"
  - "Corrected IN-01 stale comments/strings in compute-best-efforts.ts and best-effort.types.ts, and a WR-06 comment-only fix in daily-refresh.yml"
affects: [28-12, 28-13, 28-14, 28-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Excluded-effort ceiling sweep: a second, per-distance pass inside the same TARGET_ORDER loop as the survivors partition, walking Object.keys(activities).sort(...) and reusing the exact ceilingDemotion(...) constructor the survivors loop calls (D-08's single shared path) — never a second, diverging demotion constructor"
    - "buildPinnedArchive({ withOneKmBulk }) fixture helper: a reusable async builder for the 4556693525 pinned-activity test family, returning bulk counts so population-size assertions are derived from the fixture rather than hard-coded"

key-files:
  created: []
  modified:
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts
    - src/analytics/best-effort.types.ts
    - .github/workflows/daily-refresh.yml

key-decisions:
  - "Kept the plan's specified placement for the excluded-effort sweep (nested inside the per-distance TARGET_ORDER loop, walking sorted activity ids) rather than 28-REVIEW.md's illustrative CR-01 patch (a single flat sweep over Object.values(activities) after the whole per-distance loop) — the plan's own <action> text explicitly specifies the per-distance placement so rejected rows stay grouped by distance; the review's snippet is offered as evidence of the fix's shape, not as the literal diff to apply."

requirements-completed: []  # Deliberately empty: this plan's frontmatter names PR-01/PR-02/PR-03/PR-05, but
# the orchestrator's explicit instruction for this gap-closure wave is "Do NOT tick requirements in
# REQUIREMENTS.md — PR-03/PR-04/PR-05 stay reopened until plan 28-15 and re-verification." CR-01 is closed
# in code and by test here, but data/stats/best-efforts.json and 28-DIFF.md still reflect the pre-fix state
# (plan 28-14 regenerates them), and re-verification has not yet run against the fix. Ticking here would be
# premature per the verification-after-requirement-tick lesson (STATE.md memory).

# Metrics
duration: ~55min
completed: 2026-09-16
---

# Phase 28 Plan 11: Apply the personal ceiling to owner-excluded efforts (CR-01) Summary

**Pass 3 of `compute-best-efforts.ts` now sweeps every owner-excluded effort against its distance's already-derived ceiling, closing the gap where 13 real efforts (including the pinned D-04 regression case, activity 4556693525) shipped with `demotion: null` despite exceeding their ceiling.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-16T13:45:00Z (approx, worktree branch check)
- **Completed:** 2026-09-16T14:40:00Z (approx)
- **Tasks:** 2 (RED test commit, GREEN fix commit)
- **Files modified:** 4 (1 test-only, 3 source/workflow)

## Accomplishments

- Closed 28-VERIFICATION.md's CR-01 root cause: Pass 1 correctly excludes owner-excluded efforts from the ceiling's *derivation population* (PR-02), but Pass 3 previously never applied the ceiling *check* to those same efforts. Now it does, via a second per-distance sweep reusing the exact `ceilingDemotion(...)` call the survivors loop uses.
- The pinned regression fixture for activity `4556693525` now uses the REAL committed exclusion entry (read directly from `data/best-effort-exclusions.json` via `fileURLToPath`), not a missing-file dodge — both its 400m and 1k efforts are demonstrated ceiling-demoted while `excludedFromRecords` stays `true`, satisfying D-10's two-independent-claims contract.
- Added four supporting tests: precedence (an excluded world-record-beating effort keeps its `world-record` demotion, not the ceiling), non-circularity-with-exclusion (population counts are unaffected by the fix), determinism (two runs of the real-exclusion fixture are byte-identical apart from `generatedAt`), and totals (the two new ceiling demotions are counted; `effortsExcluded` is unaffected).
- Fixed IN-01's stale comments/strings in `compute-best-efforts.ts` and `best-effort.types.ts`, and WR-06's comment-only misdescription in `daily-refresh.yml` / `compute-best-efforts.ts` of when the committed ceiling-state file is rewritten.
- `data/stats/` was never regenerated by this plan — confirmed via `git status --porcelain data/` (empty) and the main repo's `data/stats/best-efforts.json` `generatedAt` unchanged at `2026-09-10T23:08:32.377Z`.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — real-exclusion pinned regression, precedence, non-circularity and determinism tests** - `703304cf` (test)
2. **Task 2: GREEN — apply the ceiling to excluded efforts in Pass 3, and correct the stale comments** - `ea0f651c` (fix)

_TDD plan: RED precedes GREEN, confirmed below._

## Files Created/Modified

- `src/analytics/compute-best-efforts.ts` - Added the excluded-effort ceiling sweep inside Pass 3's per-distance loop; corrected IN-01 stale strings/comments; corrected WR-06's write-gate comment; console tail now reports the excluded share of each distance's demoted count
- `src/analytics/compute-best-efforts.test.ts` - Reworked the `4556693525` describe block: renamed the original missing-exclusions-file test to make explicit it covers only the non-excluded path, added a reusable `buildPinnedArchive({ withOneKmBulk })` fixture helper, and added the five new tests (real-exclusion regression, precedence, non-circularity-with-exclusion, determinism, totals)
- `src/analytics/best-effort.types.ts` - Corrected IN-01's four stale doc comments/file-name references; added a sentence to the `demotion` field's doc comment documenting D-10's coexistence-with-`excludedFromRecords` and absolute-guard precedence
- `.github/workflows/daily-refresh.yml` - Comment-only WR-06 fix describing when the committed ceiling-state file is actually rewritten; no `uses:`/`with:`/`file_pattern`/step changed (verified via `git diff` filtered to non-comment lines, empty)

## Decisions Made

- **Sweep placement follows the plan's `<action>` text over the review's illustrative patch.** 28-REVIEW.md's CR-01 snippet sweeps `Object.values(activities)` once, after the entire per-distance `TARGET_ORDER` loop. The plan's own Task 2 `<action>` instead specifies walking `Object.keys(activities).sort(...)` *inside* the per-distance loop, at its end, "so that the rejected rows stay grouped by distance" — this is what was implemented. Both shapes are functionally equivalent for the demotion outcome; the per-distance placement additionally keeps `rejected`'s ordering grouped by distance, matching the survivors loop's own grouping and PR-01's determinism goals.
- **`excludedCeilingDemotedCounts` is a separate map from `ceilingDemotedCounts`**, so the console tail line can report both the total demoted count and the excluded share (`${demotedCount} demoted (${excludedCount} of them owner-excluded)`) without conflating the two loops' outputs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a `tsc` error in the determinism test's `strip()` helper**
- **Found during:** Task 1 (writing the determinism test)
- **Issue:** `delete clone.generatedAt` on a `structuredClone(doc1)`-typed object failed `tsc --noEmit` with `TS2790: The operand of a 'delete' operator must be optional` — `BestEffortsDocument.generatedAt` is a required string field, not optional.
- **Fix:** Replaced the `delete` with an object-rest destructure: `const { generatedAt: _generatedAt, ...rest } = structuredClone(doc); return rest;`
- **Files modified:** `src/analytics/compute-best-efforts.test.ts`
- **Verification:** `npx tsc --noEmit` clean
- **Committed in:** `703304cf` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, TypeScript compile error)
**Impact on plan:** Minor, mechanical fix required to make the plan's own TDD test compile. No scope creep.

### Acceptance-criterion note (not a deviation, documented for transparency)

Task 1's acceptance criteria states: `grep -c "no-such-exclusions.json" src/analytics/compute-best-efforts.test.ts` should be `1`, "only the renamed non-excluded variant still uses it." This does not hold literally: the file already had **9 pre-existing occurrences** of that literal string *before* this plan touched anything, spread across four unrelated describe blocks this plan does not touch (`deterministic across two runs`, `no iteration to convergence`, `ceiling is non-circular`, `committed ceiling state (Phase 28 D-06/D-07)`) — each uses a missing-exclusions-file path simply to bypass exclusion handling for fixtures unrelated to activity `4556693525`. This plan added one more (Test C's `withMissingExclusions` run), bringing the total to 10. Rewriting those four unrelated suites to stop using this pattern would be out of this plan's declared file scope (`compute-best-efforts.test.ts` is in scope, but touching unrelated, already-passing suites for a cosmetic grep count is not something Task 1's `<action>` asked for) and risks destabilizing tests this plan has no context to re-validate. Verified instead, and this is what the criterion's substance actually requires: within the `describe('4556693525', ...)` block, only the renamed non-excluded-path test still uses the missing-file dodge — every new test (A, C, D, E) either resolves the real committed `data/best-effort-exclusions.json` path or (Test C's second run only, by design, to prove the population delta) uses the missing-file path as an explicit contrast case.

## Issues Encountered

None beyond the deviation above.

## RED Evidence (Task 1)

Filtered run before the fix (`npx vitest run src/analytics/compute-best-efforts.test.ts -t "REAL committed exclusion"`):

```
AssertionError: expected null not to be null
 ❯ src/analytics/compute-best-efforts.test.ts:985:40
    983|       expect(effort400m!.durationSec).toBe(45.2);
    984|       expect(effort400m!.excludedFromRecords).toBe(true);
    985|       expect(effort400m!.demotion).not.toBeNull();
```

The Test E (totals) failure at the same pre-fix commit:

```
AssertionError: expected +0 to be 2 // Object.is equality
 ❯ src/analytics/compute-best-efforts.test.ts:1195:41
    1195|       expect(doc.totals.effortsDemoted).toBe(2);
```

**Tests B, C and D already passed against the pre-fix code** — they are guards against precedence/non-circularity/determinism regressions, not RED drivers for CR-01:
- Test B (precedence) passed because absolute-guard demotions were already correctly retained for excluded efforts before this plan — that code path was never broken.
- Test C (non-circularity-with-exclusion) passed because Pass 1's population-filtering (keeping excluded efforts out of `byDistance`) was already correct; CR-01 was entirely about the missing *check*, not the population.
- Test D (determinism) passed because determinism was never at risk — the bug was a missing code path, not a nondeterministic one.

## GREEN Evidence (Task 2)

- `npx vitest run src/analytics/compute-best-efforts.test.ts` → **46/46 passed**, including all five new tests and the reworked non-excluded-path test.
- `npx tsc --noEmit` → clean.
- `npm test` → **2056 passed / 11 failed**. All 11 failures independently confirmed as the exact same pre-existing, environment-only failures already logged in this phase's `deferred-items.md` (plans 28-01/28-03 entries): `ENOENT` reading gitignored `data/stats/*.json` / `data/dashboard/index.json` documents this fresh worktree never generated (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`), `Cannot find module '../dist/analytics/*.js'` from `.mjs` scripts that import compiled output this worktree never built (`compute-pace-quality-calibration.test.mjs`, `compute-pace-residual.test.mjs`, `compute-pr-ceiling-calibration.test.mjs`, `compute-pr-ceiling-diff.test.mjs`), a live-HTTP-probe failure against a `dist/` that was never built (`verify-dashboard-publish-stats.test.mjs`), and a missing `node_modules/chartjs-plugin-zoom` build artifact (`trends-zoom-logic.test.ts`). None are caused by this plan's file changes — verified by reading each failure's actual error message before counting it.
- `git status --porcelain data/` → empty. Main repo `data/stats/best-efforts.json` `generatedAt` unchanged at `2026-09-10T23:08:32.377Z` (read-only check, main repo untouched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-01 is closed in code and by test. `data/stats/best-efforts.json` and `28-DIFF.md` still reflect the PRE-FIX state (deliberately, per this plan's scope) — regenerating them is plan 28-14's job, and re-running the Round 1 checkpoint rows that touch activity `4556693525` (R3) plus obtaining a fresh PR-04 sign-off is downstream work for plans 28-14/28-15.
- PR-03 and PR-05's REQUIREMENTS.md ticks stay reopened per the orchestrator's instruction — this plan does not re-tick them; that is verification's job after the full gap-closure wave completes and `28-DIFF.md` is regenerated.
- CR-02 (the Records demotion-note misattribution) and WR-05 (the recount script's un-wired `guardIsCeiling` check) are explicitly out of this plan's scope — tracked for whichever sibling plan (28-12/28-13) owns those files.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: `.planning/phases/28-pr-plausibility-ceiling/28-11-SUMMARY.md`
- FOUND: `src/analytics/compute-best-efforts.ts`
- FOUND: `src/analytics/compute-best-efforts.test.ts`
- FOUND: `src/analytics/best-effort.types.ts`
- FOUND: `.github/workflows/daily-refresh.yml`
- FOUND commit: `703304cf` (test(28-11): pin 4556693525 with its real exclusion entry)
- FOUND commit: `ea0f651c` (fix(28-11): apply the personal ceiling to owner-excluded efforts)
