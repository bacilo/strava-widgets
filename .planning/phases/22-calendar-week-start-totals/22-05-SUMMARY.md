---
phase: 22-calendar-week-start-totals
plan: 05
subsystem: ui
tags: [checkpoint, browser-verification, calendar, accessibility, wcag]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    plan: 01
    provides: "buildMonthGrid(rows, month, weekStart) with weekTotals derivation"
  - phase: 22-calendar-week-start-totals
    plan: 02
    provides: "calendar-preferences.ts persistence (parseWeekStart, readStoredWeekStart, writeWeekStart)"
  - phase: 22-calendar-week-start-totals
    plan: 03
    provides: "week-start-aware weekday row, Total header, per-week total cells wired into calendar.ts render"
  - phase: 22-calendar-week-start-totals
    plan: 04
    provides: "the .segmented Sunday/Monday control and setWeekStart in .calendar-header"
provides:
  - "an eleven-row Round 1 browser checkpoint record in 22-VALIDATION.md — 10 PASS, 1 FAIL (R11, day-cell overflow at narrow viewport)"
  - "CAL-01 and CAL-03 ticked Complete in REQUIREMENTS.md, gated strictly on their row maps"
  - "CAL-02 recorded still Pending, with R11's FAIL named and pointed at 22-VALIDATION.md Round 1"
affects: [22-VERIFICATION, any future 22-06 gap-closure round for CAL-02/R11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "House-rule-waiver disclosure pattern: when a manual-observer row is instead observed by agent browser automation at the developer's explicit request, the waiver is stated plainly in the row's own Observation cell AND in a dedicated process note, rather than silently blended into a PASS"

key-files:
  created: []
  modified:
    - .planning/phases/22-calendar-week-start-totals/22-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "R11 recorded FAIL, not a documented PASS, because the developer explicitly chose FAIL over a documented-PASS alternative when offered both — the total column holds up at narrow width but day-cell values slightly overflow; the .splits-scroll-style horizontal-scroll wrapper (DISC-6b) is the recorded fallback and was NOT implemented this session"
  - "House rule 1 (no automated result as evidence for a manual row) was waived for R6, R7, R8 and R10 only, at the developer's explicit and repeated request — these four are value read-backs and storage-state checks, not aesthetic judgements, which is why the waiver was accepted for them and not extended to R9 or R11"
  - "House rule 2 (rows presented strictly one at a time) was relaxed after R4 into grouped batches for R5-R11, at the developer's request, while preserving full R1..R11 ordering and each row's complete Required detail/Observer required clauses"

requirements-completed: [CAL-01, CAL-03]

# Metrics
duration: ~34min
completed: 2026-08-18
---

# Phase 22 Plan 05: Calendar Week-Start Browser Checkpoint Summary

**Ran the mandatory eleven-row human/agent browser checkpoint against a production-shaped build served on 127.0.0.1, reading the October 2025 week-total values back under both week starts; recorded 10 PASS and 1 FAIL, and gated CAL-01/CAL-02/CAL-03 in REQUIREMENTS.md strictly on their row maps.**

## Performance

- **Duration:** ~34 min (Task 1 commit `dd8711b` at 15:00:34+02:00 to Task 3 commit `6985896` at 15:34:10+02:00)
- **Started:** 2026-08-18T13:00:34Z
- **Completed:** 2026-08-18T13:34:10Z
- **Tasks:** 3 (Task 1 gate+staging, Task 2 blocking human checkpoint, Task 3 recording — this continuation agent executed Task 3 only)
- **Files modified:** 2

## Accomplishments

- Eleven Round 1 rows (R1-R11) answered and recorded verbatim in `22-VALIDATION.md`, each with a named observer, its required detail, and one `R22-VERDICT` token: R1-R5, R9, R11 observed by the developer's own eyes in Safari; R6, R7, R8, R10 observed by Claude via Chrome browser automation, with house rule 1 explicitly waived for those four at the developer's request.
- The D-16 discriminator pair (R3/R4) both PASS: the October 2025 week-total grid genuinely re-groups (not repaints) when toggling Sunday/Monday — rows 3 and 4 correctly turn from the Monday-start `80.0 km` pair with differing run counts into the Sunday-start `56.0 km` / `104.1 km` pair, matching both discriminator tables exactly.
- R11 (CAL-02, D-10, narrow-viewport grid) recorded FAIL: day-cell values slightly overflow at ~380px width, though the total column itself holds up. The developer explicitly chose FAIL over an offered documented-PASS alternative.
- `## Checkpoint Outcome (Round 1)`, `## Known and Accepted`, and `## Settled Discretion (phase 22)` sections added below the Round 1 table, recording the 357.349 km rounding artifact, the D-15 scope fence, and the nine settled implementation-discretion choices from the phase.
- The Per-Task Verification Map's three manual-only Status cells updated to reflect the Round 1 verdicts (two ✅ green, one ❌ red naming R11).
- `REQUIREMENTS.md` gated strictly on the row map: CAL-01 ticked Complete (R2, R5, R7, R8 all PASS), CAL-03 ticked Complete (R9, R10 both PASS), CAL-02 stays Pending with a note naming R11's FAIL and pointing at `22-VALIDATION.md` Round 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-run the full gate, serve a production-shaped build, and stage the eleven-row Round 1 agenda** - `dd8711b` (docs)
2. **Task 2: [BLOCKING] The eleven-row browser checkpoint** - no commit (human/agent checkpoint conducted by the orchestrator with the developer; answers captured for Task 3)
3. **Task 3: Record the Round 1 outcome and gate CAL-01, CAL-02 and CAL-03 on their row maps** - `6985896` (docs)

_No separate plan-metadata commit — this executor runs on the main working tree, not a worktree; Task 3's commit already carries both modified files._

## Files Created/Modified

- `.planning/phases/22-calendar-week-start-totals/22-VALIDATION.md` - eleven Round 1 Observation/Verdict cells filled in; `## Checkpoint Outcome (Round 1)`, `## Known and Accepted`, `## Settled Discretion (phase 22)` sections added; Per-Task Verification Map's three manual-only Status cells updated; frontmatter set to `status: partial`, `nyquist_compliant: false`, `round1_answered: 2026-08-18`
- `.planning/REQUIREMENTS.md` - CAL-01 and CAL-03 ticked `[x]` with `Closed 2026-08-18 (plan 22-05, Round 1)` notes naming the rows that closed them; CAL-02 stays `[ ]` with a note naming R11's FAIL; status-table rows for CAL-01/CAL-03 set to `Complete`, CAL-02 stays `Pending`

## Decisions Made

See `key-decisions` in frontmatter. In brief: R11 was recorded as a genuine FAIL rather than smoothed into a documented PASS, because the developer was explicitly offered both options and chose FAIL; the house-rule-1 waiver for R6/R7/R8/R10 (agent-observed value read-backs and storage-state checks) was not extended to R9 or R11 (aesthetic/judgement rows), keeping the strongest available evidence for the two rows where developer judgement is load-bearing.

## Deviations from Plan

### Process Deviations (developer-authorized, not code changes)

**1. House rule 2 (rows presented ONE AT A TIME) was relaxed at the developer's explicit request.**
- **Found during:** Task 2, after R4
- **What happened:** R1-R4 were presented individually, in order. The developer then said the process was tiresome and, from an explicit set of options offered, chose to have R5-R11 presented in grouped batches rather than strictly one row at a time.
- **Mitigation preserved:** All rows were still asked in R1..R11 order, and each row's full `Required detail:` and `Observer required:` clauses were quoted in full regardless of batching. No row's evidence quality was reduced by the batching itself.
- **Recorded in:** `22-VALIDATION.md` `## Checkpoint Outcome (Round 1)` process note, and here.

**2. House rule 1 (no automated result as evidence for a manual row) was waived for R6, R7, R8 and R10 at the developer's explicit and repeated request.**
- **Found during:** Task 2
- **What happened:** Those four rows were observed by Claude via Chrome browser automation against the same served build (`http://127.0.0.1:8099/strava-widgets/`, bundle `assets/index-YqJHQsHW.js`) rather than by the developer's own eyes. R1, R2, R3, R4, R5, R9 and R11 remain developer-observed in Safari. The agent rows were observed in Chrome; the developer's rows were observed in Safari; both hit the same served build and bundle filename.
- **Why accepted for these four and not others:** R6, R7, R8 and R10 are value read-backs and storage-state checks (DOM text content, `localStorage` values, computed CSS values) rather than aesthetic or subjective judgements, which is why the waiver was accepted specifically for them. It was NOT extended to R9 (header alignment, a visual/aesthetic judgement) or R11 (narrow-viewport overflow, also a visual/aesthetic judgement) — those two stayed developer-observed.
- **Weaker evidence, stated plainly:** This is a weaker form of evidence than the plan's contract requires (house rule 1 exists precisely because an automated/agent result should never substitute for a manual row). It is stated here and in `22-VALIDATION.md`'s `## Checkpoint Outcome (Round 1)` section explicitly, so a later verifier is not misled into treating those four rows as developer-observed.
- **Recorded in:** `22-VALIDATION.md`, each of R6/R7/R8/R10's own Observation cell, plus the `## Checkpoint Outcome (Round 1)` process note, and here.

No source file was edited during this plan. `git status --porcelain src scripts` is empty.

## Issues Encountered

None beyond the two process deviations above.

## Next Phase Readiness

- CAL-01 and CAL-03 are fully closed for Phase 22.
- CAL-02 remains open pending a decision on R11 (day-cell overflow at ~380px viewport width). The documented fallback is the `.splits-scroll`-style horizontal-scroll wrapper (DISC-6b), not yet implemented. A future gap-closure plan (e.g. `22-06`) would apply that fallback and re-ask R11 under the Round 2 numbering convention (continuing at R12), following the `21-08` precedent.
- `ROADMAP.md` was NOT touched by this plan, per the plan's own instruction — closing the phase checkbox belongs to verification and `/gsd-progress`.

## Self-Check: PASSED

- FOUND: .planning/phases/22-calendar-week-start-totals/22-VALIDATION.md
- FOUND: .planning/REQUIREMENTS.md
- FOUND commit: dd8711b (Task 1)
- FOUND commit: 6985896 (Task 3)

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*
