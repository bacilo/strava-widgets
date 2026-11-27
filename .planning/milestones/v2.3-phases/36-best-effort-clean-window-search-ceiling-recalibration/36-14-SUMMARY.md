---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 14
subsystem: validation
tags: [checkpoint, signature, sha256, requirements-disposition, seg-05b]
requires:
  - phase: 36-13
    provides: frozen checkpoint rows a-h, regenerated signed artifacts, served-digest procedure
provides:
  - "Verbatim developer verdicts for checkpoint rows a-h (5 PASS, 3 FAIL as row defects)"
  - "PR-09 signature (sign-both) recorded in 36-VALIDATION.md beside both sha256 values and commit 893eec64"
  - "Per-requirement disposition: PR-06, PR-09, SEG-05b ticked; PR-07, PR-08 withheld"
affects: [36-gaps-round, verify-work]
key-files:
  modified:
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-VALIDATION.md
    - .planning/REQUIREMENTS.md
decisions:
  - "PR-09 signed: developer decision 'sign-both' (after first answering 'you decide'; the orchestrator declined to sign for them and recommended sign-both)"
  - "d, e, g recorded FAIL (row defect) at the developer's explicit choice, left unpatched"
  - "nyquist_compliant set false (checkpoint rows d, e, g not PASS); status partial"
metrics:
  completed: 2026-11-24
---

# Phase 36 Plan 14: Checkpoint Round, PR-09 Signature and Requirement Disposition Summary

Eight checkpoint rows judged on a digest-verified served build (5 PASS, 3 FAIL), both PR-09 artifacts signed (`sign-both`) with the half-marathon fail-open in scope, and requirements dispositioned per row: PR-06, PR-09 and SEG-05b ticked, PR-07 and PR-08 withheld.

## Task 1: Checkpoint round (primary checkout, not a worktree)

Evidence: build, compute-all-stats, build-widgets and verify-dashboard all exit 0 (67 passed, 0 failures). The build log was not treated as evidence. `data/best-effort-ceiling.json` sha256 `01802d20...8a20` is byte-unchanged. `compute-all-stats` dirtied `data/geo/geo-metadata.json` (`generatedAt` 2026-09-19T12:56:11.589Z to 2026-11-24T14:26:43.716Z); this was reverted with `git checkout --`.

Served digest (local static server, `dist/widgets`, 127.0.0.1:4173, since stopped): served `assets/index-CgwZxcPm.js` `c6b7d4cd5890109af0df7775d0868acb5b768991f8645c4ddf941d6e9ece0117` equals the on-disk file. Served `index.html` `ae3e239e...3984` equals on-disk.

| Row | Verdict | Developer quote |
|---|---|---|
| a | PASS | "a,b,c PASS" |
| b | PASS | "a,b,c PASS" |
| c | PASS | "a,b,c PASS" |
| d | FAIL (row defect) | "d: contamination 247 but demotion says 4 not 5" |
| e | FAIL (row defect) | "278 10K efforts were demoted ... (278 by the unreliable-segment guard ...)" (expected 285) |
| f | PASS | "f: PASS" |
| g | FAIL (row defect) | "g: I guess pass? 33 demotions ..." (expected 35) |
| h | PASS | "h: maybe you can do this?" (orchestrator ran shasum; both hashes match) |

Counts: 5 PASS, 3 FAIL, 0 BLOCKED, 0 NOT EXERCISABLE.

Orchestrator diagnosis (measured on `data/stats/best-efforts.json`; recorded here only, not in VALIDATION.md): `countDemotedAtDistance` (`records-logic.ts:225`) skips `excludedFromRecords === true` efforts and the screen says so, whereas the frozen Expected values counted every demotion. Unfiltered vs minus owner-excluded: 400m 5 (3 max-speed, 2 ceiling) to 4 (3 max-speed, 1 ceiling); 10k 285 to 278; half 35 to 33. The code appears correct and the Expected values defective. The count-independent PASS clauses held: d two different counts shown (247, 4), e guard named with the exact parenthetical, g 0 ceiling demotions. Redrafting belongs to the next planning round; the rows are unpatched.

Changed lines in `36-VALIDATION.md`: the 8 Verdict cells are the only changes inside the checkpoint table (8 lines changed, nothing else in the table). The rest of the file's change is the frontmatter (`status`, `nyquist_compliant`, `updated`), three added sections (served-build record, signature record, requirement disposition, gap-closure record) and two Sign-Off lines (the `nyquist_compliant` box and the Approval line). Expected, CAN FAIL and CAN PASS cells are untouched.

## Task 2: PR-09 signature

Decision, verbatim: "sign-both". Recorded in 36-VALIDATION.md, not in either artifact, beside `36-CEILING-RECALIBRATION.md` `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89` and `36-DIFF.md` `0f3803b3ec56c7cbdf4a42a117ed7d44d0df6f2ee8a8a6e4111fc9d2aac589e1` (re-computed at checkpoint time, equal to 36-13's record), bound to commit `893eec64`. There is no merge commit: 36-13's origin merge was a no-op. The signature explicitly covers the half-marathon fail-open (population 104 to 71, floor 100). Shown: totals (moved 1097, newly demoted 391, reinstated 31 = 31 absolute-guard + 0 ceiling, unchanged 7472), every per-distance ceiling row with cause (marathon not moving, 10k rising), the fail-open finding, the three-way reconciliation with both recount caveats, and D-17 evidence with no queue change made.

## Task 3: Disposition

The checkpoint table has no Requirement column, so the row-to-requirement mapping was inferred from the map's Requirement column by matching behaviour (recorded in 36-VALIDATION.md so it can be contested). PR-06 maps to a; PR-07 to b, c, d, e, f; PR-08 to g; PR-09 to a and h plus the signature.

- Ticked (checkbox and Traceability agree): PR-06, PR-09, SEG-05b.
- Withheld: PR-07 (rows d and e FAIL), PR-08 (row g FAIL). Each has one sentence in its REQUIREMENTS.md row.
- SEG-05b: the row text carries the Phase 33, 34 and 35 halves and now Phase 36's. The stub proof is green in the map (`-t "Phase 36 half"`, matched 1). Real vs stubbed values from 36-05-SUMMARY: real `3475740390`@400m has non-null `contaminated`; stubbed `detectUnreliableSegments` returns `[]`, giving `contaminated: null`, `durationSec` 79.9 and pace `3:20`. Both conditions held, so it was ticked and set to Complete.
- `nyquist_compliant: false`, `status: partial`, a Gap-Closure Record appended.
- ROADMAP.md and STATE.md were not touched; no SDK state or roadmap command was run.

## Deviations from Plan

- The SEG-05b note is dated 2026-11-24 (the actual date) rather than the plan's pinned 2026-09-28.
- The checkpoint-to-requirement mapping is an inference, since the checkpoint table has no Requirement column.
- Two Sign-Off lines in 36-VALIDATION.md (the `nyquist_compliant` box and the Approval line) were edited so they do not contradict the new frontmatter.

## Known Stubs

None.

## Self-Check: PASSED
