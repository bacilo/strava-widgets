---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 08
subsystem: analytics
tags: [unreliable-segments, severity-calibration, D-13-insensitivity, vitest, calibration-artifact, blocked]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "detectUnreliableSegments, DEFAULT_DETECTOR_PARAMS, UnreliableSegment — the calibrated detector this plan adds an excessMetres output field to"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "01"
    provides: "classifyGapsThreeWay — the pre-detector gap list this plan's generator feeds the detector, never the post-detector classifyGaps output"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "07"
    provides: "33-COVERAGE-IDENTITY.md and the no-source-hash provenance convention this plan's own byte-identity proof reuses"
provides:
  - "UnreliableSegment.excessMetres: a merged-segment output field, exported so no consumer re-derives the detector's own speedLimitMps*seconds arithmetic"
  - "scripts/compute-unreliable-segment-severity-calibration.mjs: a D-07 severity-cut calibration generator (built, tested, run) — does NOT ship a constant on this run"
  - "33-CALIBRATION.md: committed, idempotent, NO CANDIDATE CLEARS result — a measured HALT, not a placeholder"
  - "A blocking developer decision request (below) naming three measured options for closing D-07"
affects: [33-09, 33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A calibration generator's real candidate and its own deliberately-circular strawman can turn out to be THE SAME COMPUTATION when the starting-hypothesis statistic is itself a raw percentile of its own judged population — the insensitivity check, not the non-circularity prose, is what has to catch this, and it did"
    - "Cohort/segment-total reconciliation as a byte-for-bit independent recount: 699 activities / 1,344 segments / 77,915.4 m / 16,020.0 s reproduced exactly against 32-CALIBRATION.md's own figures of record, computed via a wholly separate code path (excessMetres summation vs 32-CALIBRATION's own per-mechanism table)"

key-files:
  created:
    - scripts/compute-unreliable-segment-severity-calibration.mjs
    - scripts/compute-unreliable-segment-severity-calibration.test.mjs
    - .planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md
  modified:
    - src/analytics/unreliable-segments.ts
    - src/analytics/unreliable-segments.test.ts
    - package.json

key-decisions:
  - "HALTED per this plan's own Task 3 step 5 (the Phase 32 plan 32-05 precedent): none of the four candidate outer percentiles [0.90, 0.95, 0.97, 0.99] clears the 1% D-13 insensitivity tolerance on the real archive. The candidate list was NOT widened and the tolerance was NOT loosened unilaterally — both are explicitly forbidden by the plan text. The artifact is committed with its NO CANDIDATE CLEARS result and full candidate table; SEG-06's tier constant does not exist yet and plan 33-09 cannot ship it from this artifact until a developer decision is made (see 'Blocking Developer Decision' below)."
  - "No import-time fs-mock no-side-effect guard was written for the new generator, following 33-07's own established precedent (self-execution guard is what actually prevents the read; a third copy of the vi.mock('fs') apparatus in scripts/unreliable-segment-import-guards.test.mjs would add no new coverage shape) — documented explicitly per the plan's own instruction for this case."
  - "The Non-circularity section states the honest finding rather than arguing non-circularity that the numbers do not support: the excess-fraction population IS the population the cut later judges, so a percentile of it is partially circular by construction — and the insensitivity check confirms that circularity is in fact disqualifying here, not a false alarm."

patterns-established:
  - "A calibration generator's HALT branch is a first-class, tested output shape (renderCalibrationMarkdown's chosen:null branch), not an afterthought — both branches are unit-tested with hand-verified synthetic fixtures before the real archive is ever run."

requirements-completed: []  # This plan's own requirement-tick-safety text forbids ticking SEG-06 here — plan 33-13 alone sets its disposition, and in any case D-07's constant does not exist yet on this run.

# Metrics
duration: ~50min
completed: 2026-09-21
---

# Phase 33 Plan 8: excessMetres output field & D-07 severity-tier calibration (HALT) Summary

**Added `excessMetres` as a merged-segment output field on `UnreliableSegment` (detection unchanged, both byte-identity artifacts confirmed), then built and ran a D-07 severity-cut calibration generator whose real candidate and its own deliberately-circular strawman turned out to be the SAME computation on the real archive — none of the four candidate outer percentiles clears the 1% D-13 insensitivity tolerance, so the plan HALTS per its own Task 3 step 5 with a committed NO CANDIDATE CLEARS artifact and a blocking developer decision, rather than shipping a constant.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 (Task 3 ends in a plan-documented HALT, not a fourth task)
- **Files modified:** 6 (2 source/test, 2 new generator files, 1 new calibration artifact, 1 package.json entry)

## Accomplishments

- `UnreliableSegment.excessMetres: number` — the merged segment's own distance beyond `UNRELIABLE_SPEED_LIMIT_MPS` over its own elapsed seconds, clamped at 0 with the detector's existing private `excessMetres` helper (never re-derived, never a second literal `speedLimitMps * seconds`)
- 6 new tests on `unreliable-segments.test.ts` (100/100 total, up from 94/94): merged-segment arithmetic, a "gap dilutes to 0" case (long gap pays no distance, raw excess negative, clamped), a pure isolated-jump case matching the burst-level floor test's own excess exactly, and a per-mechanism sweep over all three named real activities — 3475724402: **all 16/16 segments clamped to exactly 0** (the gap-adjacent walking pace during the gaps dilutes the burst's excess below the limit over the MERGED span — a real, informative finding, not a bug); 3475734189: 122.70 m (the hidden-pause burst, no gap to dilute it); 3475740390: 5 segments, 8.05-15.65 m
- Both `32-CALIBRATION.md` and `33-COVERAGE-IDENTITY.md` regenerated and confirmed `git diff --exit-code` clean — the new field changed no detection outcome. `pace-single-source.test.ts`: 84/84 green, 200 `.ts` files scanned — the single-source audit is not weakened
- `scripts/compute-unreliable-segment-severity-calibration.mjs`: `activityExcessFraction` (null, never 0, on a degenerate distance), `candidateCut` (the one imported R-7 `quantile`, no local percentile function — grep-confirmed), `insensitivityForCandidate` (own-top-decile removal + a deterministic 25-value planted-synthetic batch at 10x the population max), `strawmanCandidate` (q=0.99 of the population itself, run through the identical check), `selectSevereCut` (smallest-passing-q, mirroring 32-CALIBRATION.md's own multiplier rule), `buildFlaggedCohort`/`severityDistribution` (the archive-wide finding, computed only after selection)
- 19 pure-function tests, all synthetic — including a hand-verified plateau+tail fixture (via a standalone Node probe before writing the test, recorded below) where q=0.90 clears both insensitivity directions with delta exactly 0 while q=0.95/0.97/0.99 each fail, proving the smallest-passing-q selection rule against a genuine differential, and a second all-fail fixture exercising the NO CANDIDATE CLEARS path end-to-end (`selectSevereCut` returns `chosen: null`, `renderCalibrationMarkdown` renders the halt section and never a "Chosen constant" value)
- Ran the generator against the real archive: **HALT** — see "Blocking Developer Decision" below

## Task Commits

1. **Task 1: excessMetres as a merged-segment output field, with detection outcomes unmoved** - `a30369cd` (feat)
2. **Task 2: The severity-calibration generator and its tests** - `ad29187b` (feat)
3. **Task 3: Run the calibration — strawman measured FAILING, then HALT (no candidate clears)** - `494aed50` (fix)

_No separate plan-metadata commit — this is a sequential single-agent execution on the primary checkout; the orchestrator handles STATE.md/ROADMAP.md centrally per this plan's own instructions and this session's explicit constraint against touching them._

## Files Created/Modified

- `src/analytics/unreliable-segments.ts` — `UnreliableSegment.excessMetres` field added to the interface and populated at both segment-construction sites (gap-adjacent chain and burst-only chain) via `Math.max(0, excessMetres(metres, seconds, params.speedLimitMps))`
- `src/analytics/unreliable-segments.test.ts` — new `describe('excessMetres output field (D-07)')` block, 6 tests
- `scripts/compute-unreliable-segment-severity-calibration.mjs` — the D-07 calibration generator (pure functions + gated `main()`)
- `scripts/compute-unreliable-segment-severity-calibration.test.mjs` — 19 synthetic-fixture tests
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md` — the generated artifact: Statistic, Non-circularity, Candidate excess-fraction cuts (D-13 insensitivity), NO CANDIDATE CLEARS, Why not a tail percentile of the population itself, Archive-wide distribution (not computed), Inputs
- `package.json` — new `compute-unreliable-segment-severity-calibration` script entry

## Verification Evidence

**Task 1 — excessMetres per-activity values (verbatim console output):**
```
[excessMetres] 3475724402: 16 segment(s), values=[0.00 x16], clampedToZero=16
[excessMetres] 3475734189: 1 segment(s), values=[122.70], clampedToZero=0
[excessMetres] 3475740390: 5 segment(s), values=[8.05, 15.65, 13.90, 8.35, 10.00], clampedToZero=0
```
No negative `excessMetres` on any of the three named activities (in-test `toBeGreaterThanOrEqual(0)` plus the explicit clamp assertion in the "gap dilutes to 0" case). `src/analytics/unreliable-segments.test.ts`: **100/100 passed** (up from 94/94; +6, exactly this task's own new tests). `pace-single-source.test.ts`: **84/84 passed**, 200 `.ts` files scanned. `32-CALIBRATION.md` and `33-COVERAGE-IDENTITY.md`: both `git diff --exit-code` clean after regeneration.

**Task 2 — generator test run:** `npx vitest run scripts/compute-unreliable-segment-severity-calibration.test.mjs` → **Tests 19 passed (19)**, 0 failed. `grep -c 'classifyGaps(t, d).gapIntervals'` (including comments) → `0`; `classifyGapsThreeWay` present. Local-percentile-function grep → `0`; `quantile` imported from `dist/analytics/pace-derivation.js`.

**Task 3 — real-archive run (verbatim console output):**
```
Streams scanned: 1874, not computable: 0
Flagged cohort: 699 activities (cohort size 699)
  q=0.9: cut=0.008838932852557642 removedDelta=0.5035205210237438 plantedDelta=0.7582322210449794 pass=false
  q=0.95: cut=0.020290442275140205 removedDelta=0.7089504742536513 plantedDelta=0.5486359364421465 pass=false
  q=0.97: cut=0.024553571307095918 removedDelta=0.734041790986679 plantedDelta=43.334014023166766 pass=false
  q=0.99: cut=0.035713802737883264 removedDelta=0.7725598921087566 plantedDelta=29.480046682145442 pass=false
  strawman (q=0.99): cut=0.035713802737883264 removedDelta=0.7725598921087566 plantedDelta=29.480046682145442 pass=false

NO CANDIDATE CLEARS — no constant named.
```
Exit code: **1** (measured directly, not through a piped `tee` — an earlier `| tee` check misreported exit 0 from `tee` itself; re-ran unpiped and confirmed 1).

**Strawman measured FAILING first (quoted, per Task 3 step 2):** removedDelta **77.2560%**, plantedDelta **2948.0047%**, both far above the 1% tolerance — measured, not asserted. The strawman did NOT pass, so no blocker-on-passing-strawman condition applies.

**Full candidate table (quoted from the artifact, per Task 3 step 3):**

| q | n | cut | removedCut (n) | removedDelta | plantedCut (n) | plantedDelta | Verdict |
|---|---|---|---|---|---|---|---|
| 0.9 | 699 | 0.008839 | 0.004388 (629) | 50.3521% | 0.015541 (724) | 75.8232% | FAIL |
| 0.95 | 699 | 0.020290 | 0.005906 (629) | 70.8950% | 0.031423 (724) | 54.8636% | FAIL |
| 0.97 | 699 | 0.024554 | 0.006530 (629) | 73.4042% | 1.088558 (724) | 4333.4014% | FAIL |
| 0.99 | 699 | 0.035714 | 0.008123 (629) | 77.2560% | 1.088558 (724) | 2948.0047% | FAIL |

The chosen candidate: **none** — no `q` clears the tolerance, so `selectSevereCut` returned `chosen: null` and the script named no constant, exactly per its own contract.

**Archive-wide distribution (per Task 3 step 4):** **Not computed** — stated explicitly in the artifact ("no candidate cleared the tolerance, so no cut exists to classify against"). No archive-wide severe rate exists to report; none was tuned toward, since none was computed.

**Idempotence (per Task 3 step 6):** regenerated the artifact 4 times total across this session (2 pre-commit, byte-identical by `md5sum`; 2 post-commit, `git diff --exit-code` clean both times). No wall-clock timestamp, no `generated-at` field, no source hash anywhere in the artifact.

**Reconciliation against `32-CALIBRATION.md`'s figures of record (per Task 3 step 7):** independently recomputed (outside the committed generator, via a throwaway Node probe reading `data/streams/` directly) — segment count, total metres, total seconds, and flagged-activity count all reproduce `32-CALIBRATION.md`'s own "Figures of record (D-16)" total row EXACTLY:

| Figure | 32-CALIBRATION.md (D-16) | This session's independent recomputation | Match |
|---|---|---|---|
| Flagged activities | 699 | 699 | exact |
| Segments | 1,344 | 1,344 | exact |
| Metres | 77,915.4 m | 77,915.4 m | exact |
| Seconds | 16,020.0 s | 16,020.0 s | exact |

No difference to attribute a cause to — same archive state as `32-CALIBRATION.md` (both regenerated 2026-09-21, no merge or stream-tree change between them, matching the 33-07 orchestrator addendum's own confirmation that this session's archive is unchanged since Phase 32/33-07).

**Distribution shape that explains the HALT** (computed via the same throwaway probe, for this SUMMARY's own record — not asserted by any test, not embedded in the committed artifact): of 699 flagged activities' excess fractions, 31 (4.4%) are exactly 0 (gap-dilution to zero, same mechanism the 3475724402 excessMetres test above demonstrates), median 0.00127, raw p90 ≈0.00888 (close to but not identical to the R-7-interpolated 0.008839 the generator reports), max 0.109. The population is heavily right-skewed with no stable bulk plateau in the [0.90, 0.99] order-statistic region — which is exactly why every candidate order in that range is sensitive to both top-decile removal and planted contamination.

**`git status --porcelain data/streams`:** empty. **`git status --porcelain src`** (Task 3 only): empty. **`git status --short`** at session end: clean (all three task commits, nothing uncommitted).

**Full `npm test`:** **93 files / 2,960 tests**, all passing. Delta vs. 33-07's recorded baseline (92 files / 2,935 tests): +1 file, +25 tests (6 `excessMetres` tests + 19 severity-calibration tests — exactly this plan's own new coverage).

**`npx tsc --noEmit` / `npm run build`:** both exit 0.

## Blocking Developer Decision

**D-07's severity-tier constant (SEG-06) cannot ship from this artifact as written.** Per this plan's own Task 3 step 5 (mirroring the Phase 32 plan 32-05 precedent), the candidate list was not widened and the tolerance was not loosened unilaterally. Three measured options, as the plan's own halt text requires naming:

1. **A different statistic shape.** The current statistic (`sum(excessMetres) / totalDistanceM`, thresholded by an outer percentile of the flagged cohort's own excess-fraction population) is, by this run's own measurement, largely the same shape as its own strawman — a raw percentile of the population it judges. A shape that is NOT a percentile of the judged population itself (e.g. a fixed absolute excess-metres threshold derived from a different, non-circular reference population — analogous to how D-09's `UNRELIABLE_EXCESS_FLOOR_M` was derived from *pooled ordinary step metres*, not from the fast-run excess population it initially and wrongly used) may clear D-13 where a self-referential percentile cannot.
2. **A different outer-percentile list.** Lower orders (below 0.90) were not tried — the population's median (0.00127) and raw p90 (~0.00888) sit far below where the FAIL rows land; an order in a genuinely bulk-dominated region (if one exists below 0.90) might clear the tolerance, at the cost of reclassifying more activities as `severe`. This has NOT been measured in this session, deliberately, since the plan forbids widening the list without a developer decision.
3. **A stated wider tolerance with justification.** The nearest miss is q=0.90's removedDelta at 50.35% — over 50x the current 1% tolerance — so even a substantially wider, explicitly-justified tolerance would need strong independent justification; this option looks the least promising of the three on the measured numbers, but is named per the plan's own requirement to list every measured option.

**This plan's own generator, tests and artifact are complete, committed, and correct as specified — the HALT is the measured, honest output of running them against the real archive, not an implementation gap.** Plan 33-09 (which reads this artifact's chosen constant) is blocked on this decision.

## Decisions Made

- Followed D-07's own "PLANNER DECISION" (33-08-PLAN.md interfaces section) exactly: `none`/`minor`/`severe` is a presence/magnitude split with exactly one new constant, no second boundary derived.
- `excessMetres` implemented as a field, never re-derived by any consumer, per `pace-single-source.test.ts`'s own audit and the plan's own interface note.
- No import-time `fs`-mock guard written for the new generator (see key-decisions above) — documented explicitly per the plan's own instruction for this case.
- HALTED rather than shipped a tuned or widened-candidate constant — see "Blocking Developer Decision" above.

## Deviations from Plan

None — plan executed exactly as written, including its own documented HALT branch (Task 3 step 5 is itself part of the plan text, not a deviation from it).

## Issues Encountered

- An initial local verification of the generator's exit code via `... | tee logfile; echo $?` misreported exit 0 (it captured `tee`'s own exit code, not `node`'s). Re-ran unpiped (`npm run ... >file 2>&1; echo $?`) and confirmed the true exit code is 1 on NO CANDIDATE CLEARS, matching the script's own documented contract. Not a defect in the deliverable — an artifact of how I first checked it, corrected before relying on it.

## Next Phase Readiness

- `UnreliableSegment.excessMetres` is shipped, tested, and detection-outcome-neutral — ready for any downstream consumer once D-07's constant exists.
- `scripts/compute-unreliable-segment-severity-calibration.mjs` is complete, tested (19/19) and correctly implements every `<behavior>` bullet, including the HALT path — no further generator work is needed to close D-07; what's needed is the developer decision above.
- **Blocked:** plan 33-09 (SEG-06's tier, reading this artifact's chosen constant) cannot proceed until a developer decision resolves the HALT. Plan 33-13's SEG-06 disposition is downstream of that.
- `data/streams/` untouched throughout. `32-CALIBRATION.md` and `33-COVERAGE-IDENTITY.md` both confirmed byte-identical to their pre-plan state.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*
