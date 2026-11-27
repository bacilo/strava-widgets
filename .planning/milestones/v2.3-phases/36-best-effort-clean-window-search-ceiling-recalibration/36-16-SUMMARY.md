---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 16
subsystem: verification
tags: [pr-09, reconciliation, before-state, cr-01, gap-closure]
requires: []
provides:
  - "scripts/compute-clean-window-before-state.mjs: PR-09 BEFORE-STATE leg running the shipped pre-phase pipeline (ebe0245c)"
  - "npm script compute-clean-window-before-state"
affects: [36-19]
tech-stack:
  added: []
  patterns: ["zero-import leg with two-direction source guard", "fail-closed null-field reconciliation"]
key-files:
  created:
    - scripts/compute-clean-window-before-state.mjs
    - scripts/compute-clean-window-before-state.test.mjs
  modified:
    - package.json
key-decisions:
  - "OLD state is the pre-phase pipeline's own output, not a reconstruction"
  - "Old rank rows are checked one row per rank; ceiling-before is checked against both 36-DIFF.md and 36-CEILING-RECALIBRATION.md"
requirements-completed: []
duration: 25min
completed: 2026-11-24
---

# Phase 36 Plan 16: Before-State Leg Summary

The leg runs the pre-phase pipeline (ebe0245c, built in a scratch worktree) next to the current one over the same tracked archive. Against the committed pre-fix 36-DIFF.md it exits 1 on the CR-01 misstatement.

This plan ticks no requirements. STATE.md, ROADMAP.md and REQUIREMENTS.md are untouched.

## Commits
- 96ca189b test(36-16): failing tests (RED)
- 2be4b3ce feat(36-16): leg, tests green, npm script

## Test evidence
- RED: the suite failed to load (module missing), so 0 tests ran and 1 file failed.
- GREEN: 15 tests pass in total. The `-t` filters matched: bucket derivation 5, reconciliation against the diff headline 6, zero-import guard 4. None was vacuous.
- `git diff 40cf1651 -- package.json` shows exactly one added line.
- Forbidden-import grep over the script (comments excluded) gives 0.
- One fixture fix happened between RED and GREEN. The "all rows agree" fixture listed only two distances in the Reinstated table, and the leg correctly failed closed on the other five. I gave the fixture all seven rows. The code was not changed.

## Live run (watched red)
Run from this worktree against the committed pre-fix `36-DIFF.md`:
- Final line: `BEFORE-STATE LEG: FAIL (52 disagreement(s))`. Exit code 1.
- Key row: `ceiling reinstatements (total) | derived=15 | artifact=0 | agrees=false`.
- Missing-field rows (the headline lines plan 36-15 adds): `demoted-guard-changed (total)` and `owner-excluded (total)` have artifact=null, and every per-distance reinstatement row has artifact=null.
- The pre-phase document carries `ceilings` and `rankings`.
- `git fetch origin` then `git rev-list --count HEAD..origin/master` printed 0.
- The scratch worktree was removed (`git worktree list | grep -c prephase` is 0). `git status --porcelain` is empty.
- The GREEN direction (`BEFORE-STATE LEG: OK` against the regenerated diff) is NOT claimed here. It is proven by plan 36-19 Task 2.

## Measurements
Reinstatements derived from the pre-phase document against the current one, not owner-excluded, by OLD guard:

| Distance | absolute-guard | ceiling |
|---|---|---|
| 400m | 24 | 7 |
| 1k | 4 | 5 |
| 1mi | 2 | 3 |
| 5k, 10k, half, marathon | 0 | 0 |
| total | 30 | 15 |

Other derived totals: newly demoted 372, demoted-guard-changed 0, moved-but-ranked 1044, unchanged 7469, owner-excluded 61. onlyInOld = 0, onlyInNew = 0, unrecognised OLD guards = 0.

Ceiling-reinstated pairs (activityId, OLD s -> NEW s):
- 400m: 3475712118 71 -> 130.5; 3475712272 66.9 -> 144.3; 3475714424 66.3 -> 124.1; 3475715984 78.2 -> 121; 3475723743 66.4 -> 190.2; 3475725279 68.9 -> 119.5; 3475733719 77.9 -> 128.7
- 1k: 3475724988 205.2 -> 302.7; 3475727699 193.6 -> 322.4; 3475734859 192.5 -> 320.7; 3475734925 203.7 -> 308.5; 3475735637 203.4 -> 286.1
- 1mi: 3475725842 287 -> 517.9; 3475730418 347.6 -> 531.5; 3475734859 342.9 -> 528

Ceiling before, compared at 4 dp with population, for all seven distances: the pre-phase document's own ceilings AGREE with both 36-DIFF.md and 36-CEILING-RECALIBRATION.md (400m 5.1098/1834, 1k 4.7496/1852, 1mi 4.6281/1851, 5k 4.3452/1788, 10k 4.2204/1468, half 4.4017/104, marathon none/0). The recalibration artifact's OLD side is therefore unaffected by CR-01.

OLD rank rows disagreeing with the pre-phase `rankings`: 30 rows, namely ranks 1-10 for each of 400m, 1k and 1mi. The 5k, 10k and half rows agree. The reviewer's predictions are confirmed. The 400m rank 1-8 rows and the 1mi rows at 287.0, 339.0, 342.9 and 347.6 s disagree. The 400m, 1k and 1mi rows carry efforts the pre-phase ranking does not contain. For example, 3475714424 (66.3 s) is a ceiling-reinstated pair in the pre-phase document, and the diff ranks it at OLD #1.

Reconciliation against the probe figures (measurements, not expected values):
- Reviewer's 15 (400m 7, 1k 5, 1mi 3) equals the derived ceiling reinstatements exactly, per distance, with no per-pair difference.
- Verifier's 31/9/5 equals derived absolute-guard plus ceiling per distance: 24+7 = 31, 4+5 = 9, 2+3 = 5. The verifier's figures are the unfiltered-by-bucket total, as that probe was described.
- Headline differences against the pre-fix artifact: the artifact's Moved (1097), Newly demoted (391) and Unchanged (7472) are higher than derived by 53, 19 and 3, and its absolute-guard count is 31 against a derived 30. Together that is 76, which is derived ceiling (15) plus derived owner-excluded (61). Both sides total 8991 pairs. So the artifact folds the 15 ceiling reinstatements and the 61 owner-excluded pairs into other buckets. The per-bucket attribution of those 76 pairs was not itemised. The one-pair absolute-guard difference is presumably an owner-excluded pair, but I did not verify it per pair.

## Deviations from Plan
- [Rule 3 - Blocking] The plan's verify block hard-codes the primary checkout as ROOT, uses a compound `bash -c`, and would write into the primary checkout. In this isolated worktree I ran the equivalent steps as separate commands against the worktree and put the scratch pre-phase worktree under the session scratchpad, with the same cleanup (node_modules symlink removed, `git worktree remove --force`, `git worktree prune`). The asserted outcomes were checked by hand: FAIL line, a false ceiling row, exit 1, and no leftover worktree.
- The worktree base was reset to e55f0540 per the branch check.
- `main()` and the full script landed in the Task 1 commit. Task 2 changed no files, since the live run needs no source change.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
- Files exist: scripts/compute-clean-window-before-state.mjs, scripts/compute-clean-window-before-state.test.mjs, package.json entry
- Commits 96ca189b and 2be4b3ce exist
