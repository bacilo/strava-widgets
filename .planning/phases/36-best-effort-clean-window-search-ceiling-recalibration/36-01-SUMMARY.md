---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 01
subsystem: docs
tags: [requirements, roadmap, documentation-of-record, decision-tracking]

# Dependency graph
requires: []
provides:
  - "Eleven delegated resolutions (D-01, D-02, D-04, D-05/D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-17) recorded as dated in-place amendments on PR-06..PR-09 in REQUIREMENTS.md"
  - "D-08's measured 0-of-440 no-clean-window unsatisfiability finding and its 31-pair moved-case satisfiability finding, with named fixtures 3475725842 and 3475713251"
  - "D-02's splice-versus-partition comparison pinned to the d-rebased variant on 3475740390, with 3475724402 excluded and the reason stated"
  - "ROADMAP Phase 36 criteria 1-4 amended in place with the same dated notes, cross-referenced to REQUIREMENTS.md"
affects: [36-02, 36-03, 36-04, 36-05, 36-06, 36-07, 36-08, 36-09, 36-10, 36-11, 36-12, 36-13, 36-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "House amendment style: keep original sentence verbatim, append **Amended YYYY-MM-DD (NN-CONTEXT.md D-NN):** ... — no deletions, only appends"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "All eleven delegated-resolution amendments dated 2026-09-28, each citing 36-CONTEXT.md D-NN, appended to the end of their existing PR-06..PR-09 sentences rather than replacing any text"
  - "D-08's literal bound ('a real activity that trips both, no-clean-window case') is recorded as UNSATISFIABLE (0 of 440) and the precedence demonstration is redirected to the MOVED case (31 real pairs), per 36-RESEARCH.md's own reachability analysis"
  - "The Plans block in ROADMAP.md Phase 36 was already filled ('14 plans', all fourteen files listed by wave) by an earlier commit (03d82a14) before this plan ran, so Task 2's step 5 required no action"

patterns-established: []

requirements-completed: []  # This plan ticks nothing — PR-06..PR-09 stay Pending. It only records the pre-declared resolutions their eventual implementation must honor.

# Metrics
duration: 5min
completed: 2026-09-28
---

# Phase 36 Plan 01: Dated Amendments Recording Delegated Resolutions Summary

**Recorded all eleven delegated 36-CONTEXT.md decisions (D-01, D-02, D-04 through D-14, D-17) plus both satisfiability findings as dated, additive amendments on REQUIREMENTS.md's PR-06..PR-09 rows and ROADMAP.md's Phase 36 criteria, before any code or test exists.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-28T15:29:38+02:00
- **Completed:** 2026-09-28T15:34:07+02:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PR-06's row now states the exclusion-granularity decision (D-01, whole merged segment span) and the splice-versus-partition fixture pinning (D-02, d-rebased variant on `3475740390`, with `3475724402` explicitly excluded and why).
- PR-07's row now states the structural demotion trigger (D-04), the `contaminated`/`demotion` two-home record shape (D-05/D-06), the bounded multi-segment reason wording rule (D-07), the precedence-satisfiability finding with its 0-of-440 sweep and two named moved-case fixtures (D-08), and the Phase 29 review-queue evidence bound (D-17).
- PR-08's row now states the Pass-1 placement proof that keeps the existing no-loop audit passing unmodified (D-14), the half-marathon fail-open named finding with the `CEILING_MIN_POPULATION` floor that may not move (D-10), and the opt-in write-gate mechanism for `data/best-effort-ceiling.json` (D-11).
- PR-09's row now states the new `36-CEILING-RECALIBRATION.md` artifact-of-record rule (D-09), the every-row-gets-a-cause explanation-depth bound (D-12), and the zero-import third reconciliation leg's design (D-13).
- ROADMAP.md's Phase 36 criteria 1-4 each carry the matching dated note, cross-referencing the same decision IDs, so a later reader sees the resolution recorded in both documents of record.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend PR-06, PR-07, PR-08 and PR-09 with the eleven pre-declared resolutions** - `8fd368cf` (docs)
2. **Task 2: Amend ROADMAP Phase 36 criteria 2, 3 and 4 and fill the Plans block** - `b0611a7a` (docs)

**Plan metadata:** (this SUMMARY.md commit, to follow)

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - PR-06..PR-09 rows each gained dated `**Amended 2026-09-28 (36-CONTEXT.md D-NN):**` sentences (all thirteen decision citations present); four new bullets added to the top-level `**Amendments:**` list naming PR-06 through PR-09 and their decision IDs.
- `.planning/ROADMAP.md` - Phase 36's four success criteria each gained the matching dated note. The Plans block (`**Plans**: 14 plans`, all fourteen plan files grouped by wave) was already present from an earlier commit and needed no edit.

## Decisions Made
- Followed the plan's literal amendment text verbatim for both tasks — the plan itself was written at the level of exact sentences to append, leaving no discretion for this execution beyond correct placement and citation completeness.
- Confirmed via `git diff` before each commit (not after) that: (a) REQUIREMENTS.md's `git diff -U0` removes zero non-list-prefixed original lines (the plan's own verify script's definition of "additive"), (b) the `SEG-05b` string never appears in the REQUIREMENTS.md diff, (c) no `- [x] **PR-0[6789]**` line exists anywhere in the file, (d) ROADMAP.md's diff touches none of Phase 32/33/34/35/37's `### Phase N` headers and no `| Phase` progress-table row, and (e) the Phase 36 checkbox stays `- [ ]` throughout.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verify scripts (embedded in `36-01-PLAN.md`) were run after each edit and printed `ok` / `seg-05b untouched` with zero failures; no auto-fix was needed.

## Issues Encountered

**Worktree HEAD mismatch at startup:** on first inspection this worktree's HEAD was at an unrelated prior-milestone commit (`5e902283`, "chore: archive v2.2 phase directories to milestones/v2.2-phases"), not the expected `d26bcf5c` base, even though it was already an ancestor of the expected base and the `worktree_branch_check` script's own merge-base condition should have triggered a reset. A manual `git reset --hard d26bcf5c1cb0f8be3a77477e695dbfa4d7e924c0` corrected it before any file was read or edited; `node_modules` symlink and `data/` copy (already present) were re-verified intact afterward. No commits were made before the correction, so no work was lost or needed re-doing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 36-02 (Wave 1, parallel) is unaffected by this plan's file scope (`REQUIREMENTS.md`, `ROADMAP.md` only) and had no dependency on it per `depends_on: []`.
- Every downstream Phase 36 plan (36-03 through 36-14) can now cite the exact dated amendment text recorded here rather than re-deriving or re-stating the eleven delegated resolutions from `36-CONTEXT.md`/`36-RESEARCH.md` directly.
- SEG-05b's row (REQUIREMENTS.md line ~30) remains untouched and Pending, as required — it re-ticks only in plan 36-14 after Phase 36's own consumer is shown reading the detector.
- No checkbox, progress-table row or STATE.md line was touched by this plan, consistent with its "documentation-of-record, ticks nothing" objective.

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*

## Self-Check: PASSED
- FOUND: `.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-01-SUMMARY.md`
- FOUND: commit `8fd368cf` (Task 1)
- FOUND: commit `b0611a7a` (Task 2)
