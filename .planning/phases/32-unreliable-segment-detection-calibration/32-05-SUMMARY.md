---
phase: 32-unreliable-segment-detection-calibration
plan: 05
subsystem: testing
tags: [calibration-artifact, reachability-matrix, negative-control-search, d13-insensitivity, checkpoint-decision]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "32-02's detector (dist/analytics/unreliable-segments.js: advanceSteps, detectUnreliableSegments) that this generator calibrates"
provides:
  - "scripts/compute-unreliable-segment-calibration.mjs — loadArchive, NAMED_ITEMS, buildReachabilityMatrix, findNegativeControlCandidates, candidateSpeedLimitStatistics, insensitivityCheck, renderCalibrationMarkdown, guarded main()"
  - "32-CALIBRATION.md pre-calibration sections (Reachability x2, Negative-control candidates, Candidate statistics+insensitivity, Inputs), regenerable and idempotent"
  - "Measured finding: D-10(d) is UNREACHABLE with the three research-proposed D-05 fixtures folded into must-spare across the whole scanned grid [1.1, 10] m/s; REACHABLE without them"
  - "Recorded blocking decision (this file, below): D-10(d) disposition, locked D-05 fixtures, chosen speed-limit statistic shape — the input plan 32-06 reads before deriving any constant"
affects: ["32-06 (derives the speed limit/floor constants from the locked statistic and disposition)", "32-07 (renders the final 32-CALIBRATION.md `## Chosen constants` section)", "32-09 (SEG-04 completion, disposition for the Suunto sample)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-calibration generator shape (loadArchive/buildReachabilityMatrix/findNegativeControlCandidates/candidateSpeedLimitStatistics/insensitivityCheck/renderCalibrationMarkdown/guarded main()) mirroring compute-pr-ceiling-calibration.mjs, extended with a deliberately circular strawman run through the same D-13 insensitivity harness and watched failing"
    - "Anti-quota discipline (D-10(e)): no archive-wide flagged count rendered anywhere before the statistic and disposition are chosen at a blocking checkpoint"
    - "Blocking developer decision recorded as three grep-able machine-readable lines (`disposition:`, `fixtures:`, `statistic:`) in the plan SUMMARY for a later plan to consume programmatically"

key-files:
  created:
    - scripts/compute-unreliable-segment-calibration.mjs
    - scripts/compute-unreliable-segment-calibration.test.mjs
    - .planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md
  modified:
    - package.json

key-decisions:
  - "D-10(d) is UNREACHABLE with the three research-proposed D-05 fixtures (16628769295, 7409028052, 8869338724) folded into must-spare: at every scanned L in [1.1, 10] m/s, 16628769295 (t=1032, 29.4m/2s = 14.700 m/s folded step) and 8869338724 (t=3004, 29.2m/2s = 14.600 m/s) each carry a folded step faster than the smallest named must-flag jump (3475740390 t=2587-2589, 24.7m/2s = 12.350 m/s), so no speed limit can flag that jump and spare those fixtures"
  - "Developer disposition: option-refixture — keep D-09/D-10's locked absolute-limit + excess-floor rule shape; re-select the D-05 fixtures at the detector's own judging scale instead of research's aggregate-scale (24-33s window) picks"
  - "D-05 fixtures locked: 7409028052 t=586-624 (dense, 13 folded steps, max folded step 8.700 m/s, headroom 3.650 m/s below the 12.350 m/s floor, Garmin fēnix 6 Pro, HR 142-148, cadence 179-185) and 3647739864 t=945-971 (decimated, single 26s folded step, 5.885 m/s, headroom 6.465 m/s, Suunto 9, HR 145-148, cadence 168-172) — deliberately one dense and one decimated stream, per D-11's no-decimation-exemption requirement"
  - "Speed-limit statistic chosen: S-A (R-7 p90 across activities of each activity's own R-7 p95 folded covered-step speed; 4.404 m/s, n=1873) over S-B (8.157 m/s, n=1873) — S-A's removedDelta is 8.28% vs S-B's 43.46%; S-B moves sharply when its own detected steps are removed, i.e. it is strongly coupled to the segments being calibrated (the circularity D-13 exists to catch), so S-A is the more independent base for 32-06"

patterns-established:
  - "Grep-able decision block (`disposition:`/`fixtures:`/`statistic:` at line start) as the machine-readable contract between a blocking checkpoint plan and the plan that consumes its answer"

requirements-completed: []  # Deliberate: this plan's `requirements: [SEG-04]` names the requirement it contributes to, but SEG-04's completion criteria (a calibration artifact with CHOSEN constants, non-circularity argument, and the Suunto disposition) are not met until plans 32-06/32-07/32-09 derive and render them. Ticking here would be premature — this plan only measures reachability and records the developer's disposition/fixture/statistic choices.

# Metrics
duration: ~35min (Task 1, previous session) + ~10min (Task 2, this continuation, record-only)
completed: 2026-09-20
---

# Phase 32 Plan 05: D-10(d) Reachability, D-05 Detector-Scale Candidates, Blocking Decision Summary

**Generator measured D-10(d) UNREACHABLE with research's three D-05 fixtures at the detector's own judging scale; developer resolved it by re-fixturing (option-refixture) rather than changing the rule shape or amending the criterion, locking two replacement fixtures and the S-A statistic for plan 32-06.**

## Performance

- **Duration:** ~35 min (Task 1) + ~10 min (Task 2, continuation)
- **Started:** 2026-09-19 (Task 1) / 2026-09-20T10:02:11Z (Task 2 continuation)
- **Completed:** 2026-09-20
- **Tasks:** 2 completed
- **Files modified:** 4 created/modified (Task 1) + this SUMMARY (Task 2)

## Accomplishments

- `scripts/compute-unreliable-segment-calibration.mjs` measures, on the real archive, whether
  D-10(d) is reachable with the research's D-05 fixtures: it is not, across the entire scanned
  grid, and the generator reports exactly which named items block feasibility at each transition
  point rather than hiding the conflict.
- The same generator finds D-05 negative-control candidates at the detector's own judging scale
  (max folded-step speed, max run aggregate speed inside each span) rather than at research's
  aggregate 24-33s window scale, surfacing the top 20 by aggregate speed and disclosing exactly why
  the three original fixtures fail at that scale.
- Two candidate speed-limit statistics (S-A, S-B) and a deliberately circular strawman are each run
  through the same D-13 insensitivity harness (removal + planted-clone re-derivation, 1% tolerance
  fixed before any check ran). The strawman fails as designed (watched failing), proving the harness
  is not vacuous.
- The blocking developer decision is now recorded (below): disposition, locked D-05 fixtures, and
  chosen statistic, unblocking plan 32-06.

## Task Commits

1. **Task 1: Generator skeleton (reachability matrix, negative-control candidates, candidate
   statistics with D-13 insensitivity and a watched-failing strawman)** - `a4452b0e` (feat)
2. **Task 2: Developer decision recorded** - this SUMMARY only; no code/artifact change per the
   task's own contract (record-only checkpoint). Captured in the plan metadata commit below.

**Plan metadata:** recorded in the final `docs(32-05)` commit that follows this SUMMARY.

## Files Created/Modified

- `scripts/compute-unreliable-segment-calibration.mjs` - pre-calibration generator (Task 1)
- `scripts/compute-unreliable-segment-calibration.test.mjs` - hand-built fixture tests incl. the
  watched-failing strawman (Task 1)
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` - generated,
  idempotent pre-calibration artifact (Task 1)
- `package.json` - `compute-unreliable-segment-calibration` and
  `compute-unreliable-segment-recount` npm scripts (Task 1)
- `.planning/phases/32-unreliable-segment-detection-calibration/32-05-SUMMARY.md` - this file
  (Task 2)

## Decision

The developer was presented with the generated `32-CALIBRATION.md` sections (both reachability
matrices with/without the D-05 fixtures as must-spare, the negative-control candidate table with
each research fixture's detector-scale figures, and the candidate-statistics/insensitivity table
including the strawman's watched-failing row). The matrix showed a REAL conflict, not
`no-conflict`: D-10(d) is unreachable with the three research-proposed D-05 fixtures across the
entire scanned grid [1.1, 10] m/s — `16628769295` (t=1032-1034, 29.4 m / 2 s = 14.700 m/s) and
`8869338724` (t=3004-3006, 29.2 m / 2 s = 14.600 m/s) each carry a single folded step faster than
the smallest named must-flag jump (`3475740390` t=2587-2589, 24.7 m / 2 s = 12.350 m/s), so no
speed limit can flag that jump and spare those fixtures.

The developer's reply, recorded verbatim as the three machine-readable lines:

```
disposition: option-refixture
fixtures: 7409028052:586-624, 3647739864:945-971
statistic: S-A
```

Rationale given alongside the reply:

- **disposition (option-refixture):** Research vetted the D-05 fixtures at aggregate scale
  (24-33s windows at ~6 m/s), where they look clean. At the detector's own judging scale,
  `16628769295` and `8869338724` are not valid negative controls, because each contains a single
  folded step faster than the smallest named must-flag jump — no speed limit can flag that jump
  and spare those fixtures. The requirement is kept (D-09/D-10's absolute-limit + excess-floor rule
  shape stays locked); the fixtures are replaced instead. These figures were independently
  recomputed from the committed raw t/d streams by the orchestrator and matched the generator
  exactly.
- **fixtures:** `7409028052 t=586-624` is research's one surviving fixture and is DENSE (13 folded
  steps, max folded step 8.700 m/s, headroom 3.650 m/s vs 12.35, Garmin fēnix 6 Pro, HR 142-148,
  cadence 179-185). `3647739864 t=945-971` is DECIMATED (a single 26s folded step, 5.885 m/s,
  headroom 6.465 m/s, Suunto 9, HR 145-148, cadence 168-172). The pair was chosen deliberately so
  the negative controls cover both a dense and a decimated stream, which is what D-11's "one rule
  for every stream, no decimation exemption" needs to be tested against.
- **statistic:** S-A was chosen over S-B because S-A's removedDelta is 8.28% against S-B's 43.46%.
  S-B moves sharply when the detected steps are removed, i.e. it is strongly coupled to the very
  segments being calibrated — the circularity D-13 exists to catch. S-A (4.404 m/s, n=1873) is the
  more independent base for 32-06 to derive the limit from.

No code or calibration-artifact change was made in this task. Deriving the actual speed-limit and
excess-floor constants from S-A is plan 32-06's job; no `## Chosen constants` section was added and
no archive-wide flagged count (D-10(e), anti-quota) was computed or recorded here.

## Decisions Made

See `## Decision` above (the blocking checkpoint decision) and the frontmatter `key-decisions` for
the measured D-10(d) unreachability finding from Task 1.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was completed and committed by a prior executor
session; this continuation resumed at Task 2 exactly as the checkpoint's resume-signal specified
(disposition/fixtures/statistic reply), performed no code or artifact change, and recorded the
decision verbatim.

## Issues Encountered

None. The `32-05-SUMMARY.md` file did not yet exist when this continuation began (Task 1's executor
correctly stopped at the checkpoint before plan-level summary creation, per this plan's non-
autonomous, checkpoint-gated structure) — this continuation created it fresh, including Task 1's
retrospective summary content plus the Task 2 decision, rather than appending to a partial file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 32-06 can now derive the speed-limit and excess-floor constants from S-A (4.404 m/s,
  n=1873), using the locked D-05 fixtures (`7409028052:586-624`, `3647739864:945-971`) as its
  must-spare negative controls, under the kept D-09/D-10 absolute-limit + excess-floor rule shape.
- No blockers. The disposition (option-refixture) means ROADMAP criterion 3 / SEG-03 is NOT
  amended — the five named jumps on `3475740390` remain mandatory must-flag items for 32-06's
  derived constants to satisfy.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: commit `a4452b0e` (Task 1) in `git log --oneline --all`
- FOUND: `scripts/compute-unreliable-segment-calibration.mjs`
- FOUND: `scripts/compute-unreliable-segment-calibration.test.mjs`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`
- Grep gate `^(disposition|fixtures|statistic): ` on this file returns exactly 3 lines
