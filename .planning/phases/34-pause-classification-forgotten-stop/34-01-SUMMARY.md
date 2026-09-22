---
phase: 34-pause-classification-forgotten-stop
plan: 01
subsystem: docs
tags: [requirements, roadmap, amendment, planning]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: SEG-04's dated in-place amendment house style (the pattern this plan reuses), UNRELIABLE_SPEED_LIMIT_MPS
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    provides: SEG-05b reopened as Pending, the D-15 per-consumer-phase pattern this plan's SEG-05b edit follows
provides:
  - PAUSE-01 amended in place to name four classes (stationary/walked/ran-through/transported) and the gap-bearing merged-segment scope, with hidden-pause/isolated-jump segments explicitly not-classifiable
  - STOP-01 amended in place to widen scope from covered time to recorded timer-running time, naming both sources (covered-time creep, zero-advance pause intervals) and excluding recording gaps
  - SEG-05b traceability names Phase 34 as a consumer of the unreliable-segment detector
  - ROADMAP Phase 34 goal, criterion 1 and criterion 4 amended in place to match the REQUIREMENTS wording
  - A dated forward pointer beside v2.2-REQUIREMENTS.md's superseded "9 activities" transport figure, naming the plan-34-05 re-measurement artifact without quoting any new number
affects: [34-02, 34-03, 34-04, 34-05, 34-06, 34-07, 34-08, 34-09, 34-10, 34-11]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/milestones/v2.2-REQUIREMENTS.md

key-decisions:
  - "Amendments keep the original sentence verbatim and append a dated note, per the SEG-04/32-CONTEXT.md D-03 house style, so the verifier can see both the original and the amended scope."
  - "The v2.2 forward pointer quotes no new figure — the pointer names only the artifact path, so it can never drift from the regenerable artifact plan 34-05 will produce."
  - "SEG-05b's row text (not only the traceability table) carried the same '(33, 34/35, 36)' token, so both were widened to '(33, 34, 35, 36)' with a dated consumer-list-widened note."

patterns-established: []

requirements-completed: []  # This plan ticks nothing (requirement-tick safety, plan frontmatter and objective both state this explicitly). PAUSE-01/PAUSE-03/STOP-01 remain Pending; plan 34-11 alone sets dispositions.

# Metrics
duration: ~3min
completed: 2026-09-22
---

# Phase 34 Plan 01: Dated Requirement & Roadmap Amendments Summary

**Locked in the three dated in-place amendments D-01/D-02/D-04/D-09 require — four pause classes, timer-running stop scope, and a non-drifting forward pointer to the superseded v2.2 transport figure — before any Phase 34 code exists.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-09-22T11:06:50Z
- **Completed:** 2026-09-22T11:09:00Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- PAUSE-01 and ROADMAP Phase 34's goal/criterion 1 now name four classes (stationary, walked, ran-through, transported) and define "merged segment" as gap-bearing only, with hidden-pause/isolated-jump segments explicitly not-classifiable — so the verifier scores the fourth class and the classification scope as intended, not as a deviation.
- STOP-01 and ROADMAP criterion 4 now read "recorded, timer-running time", name both sources (covered-time creep and zero-advance pause intervals) and state recording gaps are excluded — closing the gap between the old "covered time" wording and D-09's actual scope.
- SEG-05b's traceability cell and row text both now name Phase 34 as a consumer of the unreliable-segment detector, staying Pending.
- v2.2-REQUIREMENTS.md's archived "9 activities" transport figure keeps its original text and gains a dated pointer to the plan-34-05 re-measurement artifact, quoting no new figure.
- No checkbox, Status cell or progress table row was touched anywhere in the three files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend PAUSE-01 (D-01/D-02) and STOP-01 (D-09) in REQUIREMENTS.md, and name Phase 34 in SEG-05b's traceability** - `d89eb88d` (docs)
2. **Task 2: Amend ROADMAP Phase 34 goal, criterion 1 and criterion 4, and add the v2.2 forward pointer (D-04)** - `3a838f78` (docs)

**Plan metadata:** committed separately below (docs: complete plan)

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - PAUSE-01 and STOP-01 rows gain dated amendment notes; two new Amendments-list bullets; SEG-05b traceability cell and row text both name Phase 34
- `.planning/ROADMAP.md` - Phase 34 goal, criterion 1 and criterion 4 gain dated amendment notes matching REQUIREMENTS
- `.planning/milestones/v2.2-REQUIREMENTS.md` - the "Transport/teleport gap handling" Out of Scope row gains a dated forward pointer naming `34-PAUSE03-REMEASUREMENT.md`, no new figure quoted

## Decisions Made
- Kept every original sentence verbatim, appending amendments rather than rewriting, per the interfaces section's house style and the Phase 32 D-03 precedent — an amendment made late is scored as a deviation, so this had to land before any Phase 34 code exists.
- Widened both the SEG-05b traceability table cell and its row prose (which independently repeated the same phase list as a parenthetical), since the plan's automated check only asserted the table cell but the row's own text carried the same stale token.
- Left `.planning/PROJECT.md` (lines 31, 93) and the STATE.md Out of Scope row citing the old "9 activities" figure untouched, per the plan's explicit instruction — those are the phase-completion PROJECT.md evolution step's job, not this plan's.

## Deviations from Plan

None - plan executed exactly as written. Both automated verification blocks (Task 1's grep chain, Task 2's Python script) passed on first run.

## Self-Check: PASSED

- FOUND: .planning/REQUIREMENTS.md (grep confirms "ran-through", "timer-running", both dated amendment strings, SEG-05b traceability row)
- FOUND: .planning/ROADMAP.md (Phase 34 section confirmed to contain both D-02 amendments and the D-09 amendment; phase checkbox at line 111 unchanged)
- FOUND: .planning/milestones/v2.2-REQUIREMENTS.md (single Transport/ row, original text intact, pointer present)
- FOUND: commit d89eb88d (git log confirms)
- FOUND: commit 3a838f78 (git log confirms)
- No file deletions in either commit (`git diff --diff-filter=D` empty both times)
- `git diff --stat` for each commit touched only the files named in `files_modified`
