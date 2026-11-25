---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 20
subsystem: validation
tags: [checkpoint, pr-09, signature, disposition]
requires:
  - phase: 36-19
    provides: regenerated 36-DIFF.md, four-leg reconciliation, round-2 checkpoint rows
provides:
  - round-2 verbatim verdicts d2, e2, g2, i, b2, h2 (all PASS), f carried forward
  - round-2 PR-09 signature (sign-both) over the corrected diff, fail-open finding covered
  - PR-06..PR-09 dispositioned from the explicit mapping (all ticked)
affects: [phase-36 verification]
key-files:
  modified:
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-VALIDATION.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Developer signed both artifacts (sign-both), reconfirmed after the full Fail-Open Findings readout (D-10); CEILING_MIN_POPULATION not moved"
metrics:
  completed: 2026-11-25
  tasks: 3
---

# Phase 36 Plan 20: Round-2 verdicts, PR-09 re-signature and disposition Summary

Round-2 rows judged PASS on a digest-verified served build, PR-09 re-signed over `36-DIFF.md` e67f3cba... and `36-CEILING-RECALIBRATION.md` 48b9e083..., and PR-06..PR-09 all ticked from the explicit row-to-requirement mapping.

## Commits
- d4ca5fcc Task 1: round-2 verdicts d2, e2, g2, i, b2 (served bundle index-C7XxjkuI.js sha256 eaf8e3d3..., equal to on-disk; primary checkout; build log not treated as evidence)
- 4fb5ee67 Task 2: Round 2 Signature Record, h2 PASS (both hashes re-computed externally beside HEAD 3200aa41)
- 9116cc6f Task 3: Round 2 Requirement Disposition, REQUIREMENTS.md ticks

## Task 2 presentation (enumerated)
Hashes and HEAD; corrected headline 1044 / 372 / 45 (30 absolute, 15 ceiling) / 0 guard-changed / 7469 / 61 owner-excluded / 6 of 7 ceilings moved, against round 1's 1097 / 391 / 31 (31, 0) / 7472; per-distance table beside leg 4 and both probes; leg 4 90/90 agree (previously 52 disagreements); IN-01 (corroboration, not proof); IN-04 (rounded OLD duration, no boundary disagreement, not proof for other archives); why CR-01 cannot move the recalibration artifact; Fail-Open Findings verbatim (half 104 to 71, marathon 0 to 0, 33 half efforts lost every clean sub-interval); WR-02 as already decided 2026-11-24; D-17 no queue change. The developer answered "all pass 2. sign-both" first, then "sign-both" after the full readout; both are recorded.

## Disposition
- PR-06 (a): stays ticked. PR-07 (b, c, f carried, d2, e2, i, b2): ticked. PR-08 (g2): ticked. PR-09 (a, h2, sign-both): ticked, Reopened note retained.
- `36-VALIDATION.md` frontmatter: `nyquist_compliant: true`, `status: passed`; Sign-Off lines updated to agree. Checkbox and Traceability agree for each.

## Limits stated honestly
- d2 is partly vacuous: `contAndDemoted` is 0 at every distance on live data, so it cannot discriminate the WR-04 clause. PR-07's tick for that clause rests on plan 36-18's unit test alone (3 matched). Recorded in VALIDATION.md and in PR-07's note.
- Row f was carried forward from round 1, not re-judged on the round-2 bundle.
- The ticks precede phase verification; a `gaps_found` result must reopen the artifacts.

## Deviations from Plan
- **[Rule 1 - consistency] Mapping table `pending` cells** for d2, e2, g2, i, b2, h2 were filled with PASS. The plan says to update no other existing line, but leaving `pending` would contradict the disposition it feeds. Only those cells changed.
- The Re-signed note is dated 2026-11-25 (the actual decision date), not 2026-11-24 as the plan template reads. The frontmatter `updated` date was set to 2026-11-25.
- The line "Frontmatter `status: partial` ... stay until plan 36-20" in the mapping section was left as written; it is superseded by the new disposition section and the changed frontmatter.

## Phase-gate safety
ROADMAP.md and STATE.md were not edited by this plan (verified: Phase 36 checkbox still `- [ ]`, STATE.md has no diff). The only ROADMAP change since 3200aa41 is the orchestrator's earlier tracking commit. SEG-05b untouched. WR-02 amendment present exactly once.

## Server
Nothing is listening on 127.0.0.1:8765 now (`lsof` shows no listener).

## Self-Check: PASSED
Commits d4ca5fcc, 4fb5ee67, 9116cc6f exist; the disposition guard script exited ok (round-1 signature record byte-identical to 40cf1651).
