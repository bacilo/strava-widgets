---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 19
subsystem: best-effort PR-09 verification
tags: [regeneration, reconciliation, before-state-leg, checkpoint-rows]
requires: [36-15, 36-16, 36-17, 36-18]
provides:
  - regenerated, idempotent 36-DIFF.md (CR-01 and WR-01 corrected)
  - four-leg reconciliation, all green, leg 4 independent of the diff generator
  - round-2 checkpoint rows with a Requirement column and the a-h mapping
affects: [36-20]
key-files:
  modified:
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-VALIDATION.md
decisions:
  - "36-CEILING-RECALIBRATION.md was re-verified content-identical and left at the signed bytes"
metrics:
  tasks: 3
  completed: 2026-11-24
---

# Phase 36 Plan 19: Round-2 regeneration and four-leg proof Summary

The corrected diff (45 reinstatements: 30 absolute-guard, 15 ceiling) is regenerated, committed and idempotent. All four reconciliation legs are green, and leg 4 (the pre-phase pipeline) independently confirms the before-state on 90 of 90 rows. 36-VALIDATION.md has the round-2 record appended.

## Commits

- `3200aa41` docs(36-19): regenerate 36-DIFF.md after CR-01 and WR-01 fixes
- `74a8aa3f` docs(36-19): append round-2 validation record, four-leg reconciliation and checkpoint rows

## Task 1: merge, gate, regeneration

- `git fetch origin`; `rev-list --count HEAD..origin/master` was 0. No merge, no merge commit (truthful no-op). HEAD `8a942e16` at start.
- `npm run build`, `compute-all-stats`, `build-widgets`, `verify-dashboard` (67 passed, 0 failures) all exit 0. `compute-all-stats` moved `data/geo/geo-metadata.json` `generatedAt` from `2026-09-19T12:56:11.589Z` to `2026-11-24T22:55:54.393Z`. I reverted it with `git checkout`. `git status --porcelain data/` is empty. Ceiling baseline sha256 `01802d20...8a20` is unchanged.
- `npx tsc --noEmit` is green. `npm test` ran 108 files and 3,971 tests, all passed, in 24.9 s. The baseline was 107 files / 3,921 tests. The new file is `scripts/compute-clean-window-before-state.test.mjs` (15 tests). The other 35 new tests are in existing files from plans 36-15, 36-17 and 36-18.
- Recalibration: the regenerated output was content-identical with the Generated line stripped, so I restored the signed bytes. The sha256 is still `48b9e083...8e89`. The generator is unchanged against `40cf1651`.
- Diff headline: moved-but-ranked 1044, newly demoted 372, reinstated 45 (30 absolute-guard, 15 ceiling), guard-changed 0, unchanged 7469, owner-excluded 61, 6 of 7 ceilings moved.
- Idempotence was proved as regen, commit, regen. The second run changed only the `**Generated:**` line, and the stripped diff exited 0. Neither the full nor the short HEAD sha appears in the artifact. The Inputs line cites the recalibration Generated value `2026-10-01T12:08:24.589Z`.

## Task 2: legs 3 and 4, served digest, hashes

- Leg 3 exited 0 with pass=1440, fail=0, notAssessable=74, the same as baseline. 36-17's deferred live recount therefore matches expectations. Internal consistency had no violations, and the three pinned fixtures matched (3:20, 3:21, 3:22).
- Leg 4 printed `BEFORE-STATE LEG: OK` with exit 0. All 90 rows were `agrees=true` and none were `false`, with onlyInOld=0 and onlyInNew=0. The pre-fix state was RED: 52 disagreements, ceiling derived=15 vs artifact=0. Plan 36-15's real pair `3475714424` (66.3 s to 124.1 s at 400m) is in the ceiling-reinstated list. The temp worktree was removed, and `git worktree list | grep -c prephase` is 0.
- Probe reconciliation (artifact = leg 4): 400m 24 absolute + 7 ceiling, 1k 4 + 5, 1mi 2 + 3, all other distances 0. The reviewer's 15 (7/5/3) is the ceiling bucket. The verifier's 31/9/5 is absolute + ceiling per distance (24+7, 4+5, 2+3). The differences are bucket definitions, not disagreements on pairs.
- Served bundle `assets/index-C7XxjkuI.js` has sha256 `eaf8e3d3cf4f9bf95dda50a095b39946b5f89d241f2e81ba14dba7cc2f88f8b2`. It matches the on-disk file and contains `Measured on clean window`.
- sha256 at HEAD `3200aa41152ee787e9b59bbcc09606b2f2007671`:
  - `36-DIFF.md` `e67f3cba48ac7e96e1ecac3de7f9db7d8525d5deaea124f14f55a78e39afacb4`
  - `36-CEILING-RECALIBRATION.md` `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`

## Task 3: 36-VALIDATION.md round 2

I appended the section `## Gap-Closure Round 2 (plans 36-15..36-19)`. It adds 117 lines and rewrites no existing line, and the `updated:` date already read 2026-11-24. It holds:

- the regeneration record
- the four-leg table, with the verbatim sentence naming leg 4 as the only independent BEFORE-state leg
- IN-01 and IN-04 notes
- 14 map rows with live matched counts: 7, 2, 5, 4, 5, 6, 4, 3, 4, 7, 5, 3, 10, plus the leg-4 exit-code row
- checkpoint rows d2, e2, g2, i, b2 and h2, plus an f carry-forward record, with a Requirement column
- the a-h mapping table with Superseded-by

Expected values come from a Python walk of `data/stats/best-efforts.json` that applies the Records screen's filters and imports no `records-logic`.

| Row | Expected | Defect alternative |
|---|---|---|
| d2 | contamination 247, demotion 4 (3 max-speed + 1 ceiling) | 258 and 5 |
| e2 | 278 | 285 |
| g2 | 33 unreliable-segment, 0 ceiling | 35 |

- Half still fails open (population 71, ceiling null), so g2 is exercisable.
- Row i uses `3475711469`@400m, which is owner-excluded and contaminated with `demotion` null. 39 such efforts exist across 11 activities.
- b2 pins `3475740390`@400m to the `Ranked` copy.
- f carries forward: `10367206938`@5k is neither excluded nor demoted.
- Row d2 cannot discriminate the WR-04 clause on live data, because contaminated-and-demoted measures 0 at every distance. That clause is covered only by plan 36-18's unit test.

## Deviations from Plan

None. Task 3's pre-written verify script passed.

## Notes for the orchestrator

- `git diff 40cf1651` for REQUIREMENTS.md and ROADMAP.md is non-empty. It shows earlier orchestrator amendments (the WR-02 text). I made no edits to REQUIREMENTS.md, ROADMAP.md or STATE.md. The PR-06..09 and SEG-05b checkbox states are unchanged and STATE.md has no working-tree diff.
- All round-2 checkpoint verdict cells are empty, and h2 needs the developer's own signature in plan 36-20.

## Self-Check: PASSED

- Commits `3200aa41` and `74a8aa3f` exist.
- `36-DIFF.md` is committed byte-identical to the regenerated file.
- Both artifact hashes are re-confirmed.
- `git status --porcelain` is clean apart from this SUMMARY.
