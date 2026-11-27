---
phase: 35-stream-derived-running-pace
plan: 01
subsystem: planning-docs
tags: [requirements, roadmap, decision-record, pre-declaration]

# Dependency graph
requires: []
provides:
  - "RPACE-01/02/03 dated amendments in REQUIREMENTS.md recording six pre-declared discretion resolutions (D-01/D-02/D-04/D-06/D-07/D-08/D-10)"
  - "ROADMAP Phase 35 goal and criteria 1/3 amended in place naming the chosen running-pace reading, the eligibility gate, the direction and the BASIS GATE / GATE FAILED HALT contract"
  - "Both live citations of the superseded 5:51/km figure of record carry a figure-free dated forward pointer to 35-CONTEXT.md D-01 and 35-CALIBRATION.md"
affects: [35-03, 35-05, 35-06, 35-07, 35-08, 35-09, 35-10, 35-11, 35-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dated in-place amendment: keep the original sentence verbatim, append a bold Amended YYYY-MM-DD (source D-NN) note, never overwrite"
    - "Superseded figure-of-record pointer: append an italic note naming the artifact path and the decision, quoting no new number, so regeneration can never make it stale"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/milestones/v2.2-REQUIREMENTS.md

key-decisions:
  - "D-08 shipped reading (RPACE-01): covered metres over coveredSec, both read off the same final pairKinds partition classifyGapsWithSegments already produces — Reading B (a fresh gapIntervals re-scan) rejected as re-deriving a second gap-boundary convention (the 32-13/32-17 defect fixed twice)"
  - "D-10 rendering contract (RPACE-02): fourth stat tile 'Running Pace' after the metadata 'Pace' tile, always-on exclusion line, omitted only when the activity has no stream at all"
  - "D-01/D-02/D-06/D-07 pre-declared before any measurement (RPACE-03): the running pace is the one comparator (streamPaceSecPerKm retired and to be deleted); eligibility gate is zero-free-parameter (withheld distance > 0); direction is slower-only; statistic families and their constant names (PACE_DISAGREEMENT_RUNNING_DELTA_SEC_PER_KM / PACE_DISAGREEMENT_RUNNING_RATIO) declared with a NO SHAPE CLEARS / GATE FAILED HALT contract"
  - "D-04: 5059204779's 5:51/km figure of record is superseded, not silently overwritten — both citations in v2.2-REQUIREMENTS.md now carry a dated, figure-free pointer to 35-CONTEXT.md D-01 and the future 35-CALIBRATION.md artifact"

patterns-established:
  - "This phase's amendments-first sequencing: every discretion resolution (D-01/02/04/06/07/08/10) is on the record in wave 1, before plan 35-05's calibration generator or plan 35-06/07's measurement exist, satisfying D-05's pre-declaration rule and avoiding a circular calibration"

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-09-24
---

# Phase 35 Plan 01: Dated Amendments Recording Every Discretion Resolution Summary

**Six pre-declared discretion resolutions (D-01/D-02/D-04/D-06/D-07/D-08/D-10) recorded as dated in-place amendments in REQUIREMENTS.md and ROADMAP.md before any measurement exists, plus a figure-free forward pointer superseding the 5:51/km figure of record.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-09-24T10:51:22Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- RPACE-01/02/03 in `.planning/REQUIREMENTS.md` each carry a dated `35-CONTEXT.md` amendment recording the shipped running-pace definition and boundary rule (D-08), the fourth-stat-tile rendering contract (D-10), and RPACE-03's comparator/eligibility-gate/direction/statistic-family pre-declaration (D-01/D-02/D-06/D-07) — all written before plan 35-06's calibration generator or plan 35-07's measurement exist, satisfying D-05's non-circularity rule
- Three bullets added to REQUIREMENTS.md's top-level Amendments list
- ROADMAP Phase 35's goal and criteria 1 and 3 amended in place with the same dated notes, including the BASIS GATE / GATE FAILED HALT contract for criterion 3
- Both live citations of the 5059204779 5:51/km figure of record (PACE-06's Correction paragraph and the PACE-07 row in `.planning/milestones/v2.2-REQUIREMENTS.md`) now carry a dated, figure-free `Superseded 2026-09-24 (35-CONTEXT.md D-01)` pointer naming `data/dashboard/index.json` and `35-CALIBRATION.md` as where the new figure will live
- Nothing ticked: zero `- [x] **RPACE-` rows, SEG-05b stays `[ ]` Pending, all three RPACE Traceability cells stay Pending, the ROADMAP Phase 35 checkbox and progress table are untouched, `git diff --stat` across the three commits touches exactly `REQUIREMENTS.md`, `ROADMAP.md` and `v2.2-REQUIREMENTS.md`

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend RPACE-01/02/03 in REQUIREMENTS.md with the six pre-declared discretion resolutions** - `e822f826` (docs)
2. **Task 2: Amend ROADMAP Phase 35's goal and criteria 1 and 3, and pointer-amend every 5:51/km citation (D-04)** - `3cd778f8` (docs)

_No plan-metadata commit was made separately — Task 2's commit is the final commit for this plan; SUMMARY.md and this plan's own STATE.md entry are handled by the orchestrator per the Requirement-tick safety note._

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - RPACE-01/02/03 each gain a dated `35-CONTEXT.md` amendment note; three bullets added to the Amendments list
- `.planning/ROADMAP.md` - Phase 35's Goal and Success Criteria 1 and 3 each gain a dated amendment note; `**Plans**:` line, plan list, progress table and checkbox untouched
- `.planning/milestones/v2.2-REQUIREMENTS.md` - both citations of `5:51/km` (PACE-06 Correction paragraph, PACE-07 row) gain an italic, figure-free `Superseded 2026-09-24 (35-CONTEXT.md D-01)` pointer; original text kept verbatim; PACE-07 row stays one physical line

## Decisions Made

All six decisions were already resolved by the developer/planner in `35-CONTEXT.md`; this plan's job was purely to record them as dated amendments before any code or measurement exists. No new decisions were made during execution. One wording adjustment was needed to satisfy the plan's own automated verification: the plan's action text specified the RPACE-03 amendment read "the direction is SLOWER-ONLY" (all-caps), but the plan's own verify script asserts the literal lowercase token `slower-only` is present in the same note. Resolved by writing "SLOWER-ONLY (slower-only: the running pace slower than metadata, ...)" so both the plan's specified capitalized emphasis and its own verification requirement are satisfied without contradicting either.

## Deviations from Plan

None - plan executed exactly as written, except for one auto-fixed internal inconsistency between the plan's own action text and its own verify script (see Decisions Made above), which is not a deviation from the plan's intent but a mechanical fix to make the plan's stated acceptance criteria and its verify script agree.

### Auto-fixed Issues

**1. [Rule 1 - Bug] RPACE-03 amendment note missing the literal lowercase `slower-only` token its own verify script requires**
- **Found during:** Task 1, running the automated verify script
- **Issue:** The plan's action text instructed writing "the direction is SLOWER-ONLY" (all-caps only), but the plan's own `<verify><automated>` script asserts `'slower-only' in s` (a case-sensitive literal-string check) against RPACE-03's note. All-caps alone does not satisfy a case-sensitive lowercase check.
- **Fix:** Added a parenthetical lowercase restatement — "SLOWER-ONLY (slower-only: the running pace slower than metadata, i.e. larger sec/km)" — so both the emphasis the action text asked for and the token the verify script checks are present in the same sentence.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Re-ran the Task 1 automated verify script; it now exits with `ok`.
- **Committed in:** `e822f826` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to make the plan's own stated acceptance criteria pass. No scope creep — the substantive wording (direction is slower-only, matching the milestone's claim that distance covered off the clock is reported as speed) is unchanged from the plan's intent.

## Issues Encountered

None beyond the auto-fix above.

**Remaining `5:51` citations left deliberately untouched (historical, closed-phase records):** per the plan's Task 2 step 6, these sit under the already-closed `.planning/milestones/v2.2-phases/26-shared-gap-aware-pace-derivation-honest-coverage/` directory and are not edited — the two live figures-of-record surfaces (`v2.2-REQUIREMENTS.md`'s PACE-06 and PACE-07 rows) now carry the dated pointer that supersedes them:
- `26-07-PLAN.md:19, :51, :98, :130, :209`
- `26-07-SUMMARY.md:44, :56, :96, :106`
- `26-08-PLAN.md:22, :118`
- `26-08-SUMMARY.md:99, :101, :102`
- `26-10-PLAN.md:115`
- `26-10-SUMMARY.md:49`
- `26-CONTEXT.md:110, :313`
- `26-DISCUSSION-LOG.md:91, :114`
- `26-UI-SPEC.md:126, :214`
- `26-VALIDATION.md:209, :261, :265, :284, :287, :338`

Also noted, out of this plan's stated scope (the plan's step 6 names only the `26-.../` directory) and therefore also left untouched: `.planning/milestones/v2.2-ROADMAP.md:171, :177, :508`, `.planning/MILESTONES.md:12` and `.planning/RETROSPECTIVE.md:138` — all narrative/archived-milestone documents, not the two live figures-of-record surfaces D-04 names.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every discretion resolution this phase makes (D-01/D-02/D-04/D-06/D-07/D-08/D-10) is now on the record with a dated amendment, before plan 35-03's `deriveRunningPace` implementation or plan 35-06/35-07's calibration measurement exist — D-05's pre-declaration rule is satisfied, so the eventual calibration cannot be circular by construction.
- Plan 35-02 (the folded `validateStreamSeries` null-safety todo) and plan 35-03 (the running-pace derivation itself) are unblocked to proceed.
- No blockers. SEG-05b stays Pending, to be recorded by plan 35-13 alongside Phase 36's half, per D-11.

---
*Phase: 35-stream-derived-running-pace*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: `.planning/phases/35-stream-derived-running-pace/35-01-SUMMARY.md`
- FOUND: `e822f826` (Task 1 commit)
- FOUND: `3cd778f8` (Task 2 commit)
- FOUND: `8be06d90` (SUMMARY commit)
