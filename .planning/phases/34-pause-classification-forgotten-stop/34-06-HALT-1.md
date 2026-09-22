---
phase: 34-pause-classification-forgotten-stop
plan: 06
subsystem: analytics
tags: [calibration, d13-insensitivity, halt, pause-classification, forgotten-stop, d-08]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "scripts/compute-pause-classification-calibration.mjs (runCalibration/decideOutcome/renderCalibrationMarkdown, PREDECLARED_SHAPES, the D-13 harness) from plan 34-04, never run against the real archive until this plan"
  - phase: 34-pause-classification-forgotten-stop
    provides: "34-WALKING-BREAK-CONTROL.md's three CONFIRMED_CONTROL lines from plan 34-02 (unused this run — gates never reached)"
provides:
  - ".planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md: the real archive's first-ever measured run — strawman G watched FAILING, all three Family G shapes (G1/G2/G3) watched FAILING D-13 insensitivity, NO SHAPE CLEARS, Families M/W never run (upstream HALT), D-10 rule and join exhaustiveness both independently PASS"
  - "A committed, exit-1, byte-identical-across-three-runs NO-VALUE artifact for the developer decision named in this SUMMARY's Blocking Developer Decision section"
affects: [34-07, 34-08, 34-09, 34-10, 34-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First real-archive run of a HALT-capable generator is itself evidence, not a defect: the generator, its 58 synthetic tests and its render logic from plan 34-04 are unchanged and correct — the HALT is the measured, honest output of running them, mirroring the 33-08/32-05 precedent"

key-files:
  created:
    - .planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md
  modified: []

key-decisions:
  - "D-08 enacted, not resolved: no shape, order, tolerance or margin was widened, loosened, reordered or hand-picked. The artifact is committed as NO SHAPE CLEARS with nothing shipped, and the phase HALTS for a developer decision (see Blocking Developer Decision below)."
  - "Task 2 (shipping constants, the equality guard, the walking-break control test) was skipped entirely per the plan's own exit-1 branch — nothing in src/ changed this plan."

patterns-established: []

requirements-completed: []  # HALT branch: PAUSE-01/STOP-02 tick nothing; this plan's own text says Task 1 exit-1 stops the plan with nothing shipped

# Metrics
duration: single session (commit 15:41:35 local, 2026-09-22)
completed: 2026-09-22
---

# Phase 34 Plan 06: Pause-Classification Calibration — NO SHAPE CLEARS, Phase HALTS Summary

**Ran the real archive through plan 34-04's HALT-capable generator for the first time (1,874 streams): strawman G watched failing first as required, then all three pre-declared Family G shapes (cadence-silent stillness cut) failed the fixed 1% D-13 insensitivity tolerance by 2.5x-90x, so NO SHAPE CLEARS, Families M and W never ran (fixed upstream-HALT dependency), no constant ships, and the phase HALTS per D-08 for a developer decision on Family G's shape list.**

## Performance

- **Duration:** single session
- **Completed:** 2026-09-22T13:41:35Z (commit `00c02bda`)
- **Tasks:** 1 of 2 (Task 2 skipped per the plan's own exit-1 branch)
- **Files modified:** 1 (created)

## Accomplishments

- Built and ran `npm run compute-pause-classification-calibration` against the real, unmodified 1,874-stream archive (`data/streams` git tree `dfdc7b35...`, newest activity 2026-09-18) for the first time — this generator (plan 34-04) had never touched the real archive before this plan, by design (D-08: no peeking).
- Strawman G quoted and confirmed FAIL before any shape row was read: base=0.908333 (n=5362), removed=emptied (null, matching the "unfalsifiable-fail" property), plantedDelta=0.0000% — the harness genuinely distinguishes circular from non-circular populations.
- All three pre-declared Family G shapes (34-04-PLAN.md `<predeclared_shapes>`) then measured and quoted in full, including every row after the (non-existent) winner:
  - **G1** (cadence-silent covered pairs, pooled, n=7943): base=2.723333, removed=2.650000 (n=4569, removedDelta 2.6928%), planted=3.000000 (n=13305, plantedDelta 10.1591%) — FAIL
  - **G2** (cadence-silent covered pairs, per activity, n=50): base=1.655000, removed=1.612738 (n=35, removedDelta 2.5536%), planted=1.740000 (n=57, plantedDelta 5.1360%) — FAIL
  - **G3** (pause-boundary run-in, n=2737): base=1.900000, removed=0.200000 (n=965, removedDelta 89.4737%), planted=1.900000 (n=2737, plantedDelta 0.0000%) — FAIL
- Selected: **NO SHAPE CLEARS**. Families M and W rendered "not computed: upstream HALT" per the plan's own fixed-order dependency — they were never evaluated, not merely skipped.
- Gates section: "Not evaluated — not every family cleared" (as the plan's own render logic specifies; gates only run on shipped, rounded values, which don't exist here).
- Two gate-independent checks still ran and both PASS on their own: the D-10 blind-spot rule (all four named anchors — 3475740390 true, 3475724402/3475734189/4556693525 false — correctly classified; nearest ratios either side of the ±0.02 margin around 0.8 are 0.767 below / 0.928 above, clear; findings: 104 distance-triggered, 1 insufficient-data, 1873 computable) and join exhaustiveness (summed `joinViolations` = 0 archive-wide).
- Regenerated the artifact three times total; sha256 `cbcf1b7ba60156bc...` identical across all three runs. Committed, then regenerated a fourth time and confirmed `git diff --exit-code` clean.
- Regenerated `32-CALIBRATION.md`, `33-CALIBRATION.md` and `33-COVERAGE-IDENTITY.md`; all three `git diff --exit-code` clean — nothing upstream moved. `git status --porcelain data/streams` empty throughout.

## Task Commits

1. **Task 1: Run the calibration — strawman G watched failing, Family G's three shapes all fail D-13, NO SHAPE CLEARS, HALT** - `00c02bda` (docs)

Task 2 (shipping constants from the artifact) is **skipped** — the plan's frontmatter and Task 2's own `<action>` state "ONLY on Task 1's exit-0 branch. On exit 1 this task is skipped and the SUMMARY says so." This is that statement: Task 2 did not run, `src/analytics/pause-classification.ts` and `src/analytics/pause-classification.test.ts` are unchanged (`git diff --stat src` is empty).

## Files Created/Modified

- `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md` - the committed NO-VALUE artifact: pre-declared shapes text, rejected-on-argument list, non-circularity arguments, strawmen-watched-failing section, full shape-arbitration tables for Family G (Families M/W "not computed: upstream HALT"), the NO SHAPE CLEARS section, D-10 blind-spot rule (PASS), drift-while-stationary ("not computed — upstream G family did not clear"), join exhaustiveness (PASS), per-interval class table for 3475724402 ("not rendered — not every family cleared"), archive-wide findings ("not computed"), and the Inputs/provenance section

## Decisions Made

- **D-08 enacted exactly as written.** No shape was reordered, no tolerance was widened past 1%, no fallback to a later shape occurred (there is no later shape in Family G — all three pre-declared shapes failed), and no value was hand-picked. The artifact records the honest measured outcome and the plan stops.
- **Task 2 skipped, not attempted-then-reverted.** Since Task 2's own `<action>` gates on Task 1's exit code, and Task 1 exited 1, Task 2 was never started — no constants, no equality guard, no walking-break control test were written this session.

## Deviations from Plan

None — plan executed exactly as written, including its own documented HALT branch (Task 1 step 4's exit-1 instructions are plan text, not a deviation from it).

## Blocking Developer Decision

**Family G (the stationary/walked speed boundary, D-07, which also ships as STOP-02's near-zero threshold) cannot ship from this artifact as written.** Per this plan's own Task 1 step 4 (mirroring the 33-08/32-05 precedent), the shape list was not widened and the 1% tolerance was not loosened unilaterally. Three measured options, named per the plan's own requirement:

1. **A different pre-declared shape list for Family G.** All three tried shapes are variations on "a percentile of cadence-silent covered-pair speeds" (G1 pooled, G2 per-activity, G3 pause-boundary run-in). G2 is the closest miss (removedDelta 2.55%, plantedDelta 5.14% — both roughly 2.5x-5x the 1% bound) but is a two-level per-activity statistic over only 50 qualifying activities (activities with >=30 cadence-silent covered pairs), so a small, non-representative sample may itself be the problem. A shape built from a differently-gated or larger population (cadence is present on only 1,198 of 1,874 streams per the planner's own channel-presence reference count) might clear where these three cannot.
2. **G3's 89.47% removedDelta is itself a finding worth investigating before retrying its shape.** G3's population (covered pairs bracketing a zero-advance pause boundary) is defined independently of J's neighbourhood, yet the REMOVED perturbation (which only drops items intersecting a J-interval's neighbourhood) erased 89% of it (965 of 2737 pairs survived at n dropping in the removed column, i.e. 1772 items lost) while leaving plantedDelta at exactly 0.0000%. That asymmetry suggests most pause-boundary run-in pairs in this archive sit near a recording-gap or merged-segment interval too — a genuine overlap between the two populations this shape's own non-circularity argument did not anticipate, not an implementation defect (the harness and generator are unchanged and correct, per 34-04's own 58 passing synthetic tests).
3. **A stated wider tolerance with justification.** The nearest miss on both axes simultaneously is G2 (2.55%/5.14%), 2.5x-5x the current 1% bound — closer than G1 (2.69%/10.16%) or G3 (89.47%/0.00%), but still well outside a bound that would need strong independent justification to widen. Named per the plan's own requirement to list every measured option; this option looks the least promising of the three on the measured numbers, same as 33-08's precedent.

**This plan's own generator (built in plan 34-04), its 58 synthetic tests and this artifact are complete, committed and correct as specified — the HALT is the measured, honest output of running them against the real archive, not an implementation gap.** Plans 34-07 through 34-11 (per-interval table wiring, pace-quality wiring, detail-view disclosure, the independent recount, and the requirements-tick disposition) are all blocked on this decision, since none of PAUSE-01's four classes or STOP-02's threshold exist without Family G's constant.

## Issues Encountered

None. The unpiped exit-code capture (`npm run ... >"$LOG" 2>&1; echo $?`) was used throughout, avoiding the `tee`-exit-code mistake the plan's own `<interfaces>` section names as 33-08's recorded error.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Blocked:** every downstream plan in this phase (34-07 onward) needs `STATIONARY_MAX_SPEED_MPS` and/or `WALK_RUN_BOUNDARY_MPS`, neither of which exists. The phase cannot proceed past this HALT without a developer decision on the options above.
- `scripts/compute-pause-classification-calibration.mjs` and its 58 synthetic tests (plan 34-04) need no further generator work to resolve this HALT — what's needed is a developer decision on Family G's shape list (or accepting a stated wider tolerance), followed by a straightforward re-run.
- `32-CALIBRATION.md`, `33-CALIBRATION.md` and `33-COVERAGE-IDENTITY.md` all confirmed byte-identical to their pre-plan state; `data/streams/` untouched throughout.
- Family M and W's own shapes (M1/M2, W1/W2) were never measured against the real archive this session — they remain exactly as pre-declared in 34-04-PLAN.md, unmeasured, pending Family G's resolution.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-06-SUMMARY.md` (this file)
- FOUND commit: `00c02bda`
