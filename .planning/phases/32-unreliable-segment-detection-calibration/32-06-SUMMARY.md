---
phase: 32-unreliable-segment-detection-calibration
plan: 06
subsystem: testing

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "32-05's Decision (disposition: option-refixture, locked D-05 fixtures 7409028052:586-624 / 3647739864:945-971, statistic: S-A) — the input this plan derives L/F/B from"
provides:
  - "scripts/compute-unreliable-segment-calibration.mjs — the FULL derivation chain for all three constants: deriveSpeedLimitAt/speedLimitMultiplierAt/selectSpeedLimitMultiplier (L, with its own D-13 candidate-selection meta-rule), deriveExcessFloor (F, pooled step-metres population), deriveHiddenPauseBoundary (B, valley search + rounded midpoint fallback), each with a watched-failing strawman, plus buildChosenConstants/renderChosenConstantsSections wiring all of it into the artifact"
  - "src/analytics/unreliable-segments.ts — UNRELIABLE_SPEED_LIMIT_MPS (7.35 m/s), UNRELIABLE_EXCESS_FLOOR_M (3.0 m), HIDDEN_PAUSE_MIN_METRES (116.95 m), DEFAULT_DETECTOR_PARAMS; detectUnreliableSegments' `params` argument is now optional"
  - "32-CALIBRATION.md's six Task-2 sections: Chosen constants, Non-circularity (D-13), Why not a tail percentile, Hidden-pause vs isolated-jump boundary (D-08), Excess floor and the trivia case (D-09), D-10(d) check at the chosen constants — all regenerable, idempotent, and matching the shipped constants"
affects: ["32-07 (renders the final 32-CALIBRATION.md polish — the core Chosen-constants contract this plan renders is now in place)", "32-08, 32-09 (can now import DEFAULT_DETECTOR_PARAMS, which exists and is calibrated)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-10 multiplier-by-candidate-selection: a fixed, round, pre-declared list of outer cross-activity percentiles ({0.90, 0.95, 0.97, 0.99}), each producing a candidate L, with D-13's own insensitivity check arbitrating which candidate is trusted — mirroring 32-05's own S-A-vs-S-B precedent (choose by MEASURED insensitivity, never a flagged count). Only 0.97 clears the 1% tolerance on the live archive."
    - "Population choice for a D-13-robust bulk statistic: prefer a population LARGER than and structurally disjoint from 'whatever the detector's own removal step strips out' (all folded-step METRES pooled archive-wide, not the excess of already-fast runs) — the same shape that already makes statisticSA (all folded-step SPEEDS) robust. A percentile of 'the population the floor itself judges' is exactly the FORBIDDEN strawman shape, reserved for the strawman only."
    - "Rounding a D-08-style boundary (no admit/exclude asymmetry, unlike L/F) to a fixed decimal precision purely to eliminate t/d floating-point noise from the shipped-vs-live-derived comparison, not for any direction-safety reason."

key-files:
  created: []
  modified:
    - scripts/compute-unreliable-segment-calibration.mjs
    - scripts/compute-unreliable-segment-calibration.test.mjs
    - src/analytics/unreliable-segments.ts
    - .planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md

key-decisions:
  - "Corrected Task 1's speed-limit derivation: a real multiplier (measured, not chosen; candidate-selected by D-13) is applied to S-A before ceil-rounding, rather than the bare ceil(S-A) an earlier draft used — see 'Blocking Finding — Resolved' below for the full history."
  - "Redesigned F's real population from 'excess of already-fast runs' (which nearly duplicates whatever D-13's removal strips out, and so cannot pass insensitivity at any percentile order tried — 50%+ deltas throughout) to 'every folded covered step's own metres, pooled archive-wide' (0% deltas) — the R-7 10th percentile, the complement of D-10(a)'s own locked 90th-percentile order for the speed limit."
  - "Kept F's STRAWMAN on the ORIGINAL 'excess of already-fast runs' population (not F's new real population) — the plan's own <why_the_blocker_was_wrong> spec names this population for F's strawman, and it is the only one of the two that actually fails D-13 (the new real population is too robust to serve as a meaningful strawman)."
  - "Bug fix: findValley's bin-search trivially found a 'valley' over an entirely EMPTY population (0 <= 0.5*min(0,0) === 0 at the first interior edge) — exactly what D-13's own removal arm can produce for B, since its population is the detector's own no-gap-segment output at (L, F). Now requires real mass on both sides (maxLeft > 0 AND maxRight > 0) before a bin counts as a valley."
  - "HIDDEN_PAUSE_BIN_WIDTH_METRES widened 5m -> 20m: at 5m the live archive's valley search found an UNSTABLE valley (relocated from 95m to 55m under D-13 perturbation, not just a small-sample fluctuation); 20m is the narrowest width at which the live population consistently reports no valley (a legitimate D-08 outcome) instead of one that moves."
  - "B is now rounded to 0.01 m (both the found-valley and midpoint-fallback cases) purely to eliminate d[i]-d[j] floating-point noise from the shipped-vs-live-derived comparison — D-08 states no admit/exclude asymmetry for this boundary, unlike L (ceil) or F (floor), so plain rounding is used."

patterns-established:
  - "A D-13 insensitivity FAILURE on a real (not strawman) candidate is diagnosed by checking whether its population is structurally close to 'what the detector's own removal/planting step touches' — if so, redesign the population (bigger, disjoint from the anomaly-judging process), not the percentile order."

requirements-completed: []  # SEG-04 is NOT fully complete: this plan's frontmatter names it, but the requirement's own text also needs the Suunto (4556693525) disposition and the "figures of record" reconciliation, which 32-07 (Wave 4, "Figures of record, reconciliation, D-11/D-06/D-05/Suunto sections") explicitly owns per ROADMAP.md and 32-05-SUMMARY.md's own affects field. This plan discharges the constants/non-circularity half of SEG-04's text only. Ticking it now would be premature (32-05's own precedent for this exact caution).

# Metrics
duration: ~5h (this continuation session; ~90min prior session for Task 1)
completed: 2026-09-20
---

# Phase 32 Plan 06: Constant Derivation and Shipping — Speed Limit 7.35 m/s, Excess Floor 3.0 m, No Clean Hidden-Pause Valley

**Corrected a wrong "multiplier of 1" derivation, redesigned the excess floor's population from "excess of already-fast runs" (which duplicates whatever D-13's own check strips out) to "every folded step's own metres" (robust, 0% D-13 deltas), fixed an empty-population bug in the valley search, and shipped all three calibrated constants (7.35 m/s / 3.0 m / 116.95 m, no clean valley) with all three D-13 insensitivity checks passing and all three strawmen still watched failing.**

## Performance

- **Duration:** ~90 min (Task 1, prior session) + ~5h (this continuation: diagnosing and fixing the blocker, Task 2)
- **Started:** 2026-09-19 (Task 1) / 2026-09-20 (this continuation)
- **Completed:** 2026-09-20
- **Tasks:** 2 of 2 completed
- **Files modified:** 4

## Accomplishments

- **Diagnosed and fixed the Task 1 blocker.** The prior session's `deriveSpeedLimit` applied a bare
  `ceil(S-A)` (multiplier of 1), giving L = 4.41 m/s — a value close to ordinary sustained running
  pace, at which genuine tempo efforts carry MORE absolute excess-metres than the smallest named
  GPS jump, making D-10(d) mathematically unreachable for any floor. The orchestrator's re-check
  proved this and supplied the real named speed/excess figures; this session re-derived the
  multiplier by a stated, non-circular rule (per-activity p95/p50 folded-step-speed ratio,
  candidate-selected across a fixed {0.90, 0.95, 0.97, 0.99} outer-percentile list by D-13
  insensitivity) rather than fitting it to the feasibility band's edges.
- **Redesigned the excess floor's population.** The original `deriveExcessFloor` (R-7 p90 of the
  excess of runs already exceeding L) failed D-13 insensitivity by 50%+ regardless of L or
  percentile order tried, because that population nearly duplicates whatever the D-13 removal step
  strips out. Replaced with "every folded covered step's own metres, pooled archive-wide" — a
  population dominated by ordinary, non-anomalous steps, giving 0% removedDelta/plantedDelta. Kept
  the STRAWMAN on the original (excess-of-fast-runs) population, per the plan's own
  `<why_the_blocker_was_wrong>` spec, since the new real population turned out too robust to serve
  as a meaningful strawman for itself (a live-archive finding, fixed by keeping the strawman on the
  circular population and the real rule on the robust one).
- **Fixed a genuine bug in `findValley`**: an entirely empty population (which D-13's own removal
  arm can produce, since B's population is exactly the detector's own output) trivially satisfied
  the valley threshold at the first interior bin (`0 <= 0.5 * min(0, 0) === 0`). Now requires real
  mass on both sides before declaring a valley. Also widened the bin width from 5m to 20m — at 5m
  the live archive's valley location was itself unstable under D-13 perturbation (95m relocating to
  55m), a live-measured instability, not a hypothetical one.
- **Shipped all three constants** into `src/analytics/unreliable-segments.ts`
  (`UNRELIABLE_SPEED_LIMIT_MPS = 7.35`, `UNRELIABLE_EXCESS_FLOOR_M = 3`,
  `HIDDEN_PAUSE_MIN_METRES = 116.95`, `DEFAULT_DETECTOR_PARAMS`), made `detectUnreliableSegments`'s
  `params` argument optional, and rendered `32-CALIBRATION.md`'s six Task-2 sections — all three
  real derivations pass D-13 insensitivity, all three strawmen still fail, shipped values match
  live-derived values, and a second generator run is byte-identical.

## Task Commits

1. **Task 1: Derivation functions for L/F/B with D-13 insensitivity and watched-failing strawmen** -
   `1945864e` (feat, prior session)
2. **Blocking finding recorded** - `411ac86c` (docs, prior session) — since resolved, see below.
3. **Fix: real speed-limit multiplier, redesigned F population, findValley bug fix** - `5e28deec`
   (fix)
4. **Task 2: Run live, hard-code constants, render artifact sections** - `909aaed6` (feat)

**Plan metadata:** this SUMMARY plus the final `docs(32-06)` metadata commit that follows it.

## Files Created/Modified

- `scripts/compute-unreliable-segment-calibration.mjs` - the full derivation chain: L's
  multiplier-candidate-selection machinery, F's redesigned population, B's bug fixes, plus
  `buildChosenConstants`/`renderChosenConstantsSections` wiring everything into the artifact
- `scripts/compute-unreliable-segment-calibration.test.mjs` - 41 unit tests (29 from Task 1's
  session + 12 new: multiplier machinery, `findValley` empty-population regression, rewritten
  `deriveExcessFloor` fixtures for the new population)
- `src/analytics/unreliable-segments.ts` - `UNRELIABLE_SPEED_LIMIT_MPS`, `UNRELIABLE_EXCESS_FLOOR_M`,
  `HIDDEN_PAUSE_MIN_METRES`, `DEFAULT_DETECTOR_PARAMS`; `detectUnreliableSegments`'s `params` is
  now optional
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` - the six new
  Task-2 sections, regenerated and idempotent

## Blocking Finding — RESOLVED (was: D-10(d) unreachable at the Decision's own L)

**Original finding (prior session, `411ac86c`):** `deriveSpeedLimit(archive, 'S-A')` returned
`Math.ceil(S-A x 100) / 100 = 4.41 m/s` — a bare ceiling of the raw statistic, with an IMPLICIT
multiplier of 1. At that L, the locked D-05 dense fixture (`7409028052 t=586-624`) carried more
absolute excess-metres (53.47 m) than the smallest named GPS jump (`3475740390 t=2347-2350`,
16.87 m) — D-10(d) was mathematically unreachable for any excess floor, and the prior session
correctly stopped and reported this rather than tuning around it.

**Why this was wrong, not a genuine dead end:** L = 4.41 m/s (15.9 km/h) is ordinary sustained
running pace, not a plausibility ceiling. 32-CONTEXT.md's own "Claude's Discretion" section names
"the exact statistic, MULTIPLIER and tolerance for the speed limit" as this plan's job — a
multiplier was always required, and Task 1's own `<behavior>` text (`Math.ceil(value x 100) / 100`)
omitted it. 32-05's own SUMMARY had already anticipated this: "passing insensitivity likely
requires deriving the multiplier and D-09's excess floor together in plan 32-06."

**Resolution:** the orchestrator recomputed the named speed/excess figures directly from the
committed raw `t`/`d` streams and supplied the real feasible band (multiplier k in roughly
`(1.82, 2.28]`, equivalently L in `(8.0, 10.03]` m/s under the ORIGINAL "excess of fast runs"
floor population). This session:

1. Derived a non-circular multiplier: for each activity, the ratio of its own R-7 95th-percentile
   folded-step speed to its own R-7 median folded-step speed (a bulk, within-activity measure of
   pace variability — never a tail percentile of the archive-wide population the detector judges).
   The multiplier is the smallest of a FIXED, pre-declared candidate list of outer cross-activity
   percentiles `{0.90, 0.95, 0.97, 0.99}` whose resulting L clears D-13's insensitivity check — only
   0.97 clears the 1% tolerance on the live archive (0.90, 0.95 and 0.99 all fail it), so this is a
   genuine measurement, not a foregone conclusion. Result: multiplier 1.6667, L = ceil(1.6667 x
   4.404 x 100)/100 = **7.35 m/s**.
2. Discovered, while wiring L through the REAL joint `(L, F)` insensitivity check for the first
   time, that the ORIGINAL `deriveExcessFloor` population (excess of runs already exceeding L)
   fails D-13 insensitivity by 50-450% regardless of percentile order or L tried — because that
   population is nearly identical to what D-13's own removal step strips out. Redesigned F's real
   rule onto "every folded covered step's own metres, pooled archive-wide" (R-7 p10, the complement
   of L's own locked 90th-percentile order) — 0% removedDelta/plantedDelta. Result: **F = 3.0 m**.
3. Discovered a genuine bug in `findValley` (trivially "finds" a valley over an empty population)
   while checking B's own insensitivity — D-13's removal arm can legitimately empty out B's
   population entirely. Fixed the bug and widened the bin width (an unrelated, independently
   measured stability fix). Result: **B = 116.95 m, no clean valley found** (D-08's own legitimate
   "no clean valley" outcome, reported verbatim).
4. Verified `checkFeasibility(archive, 7.35, 3.0, decision).pass === true`: every named must-flag
   item is admitted (smallest excess 8.05 m, well above F), every must-spare item is spared (the
   D-09 trivial pair by the FLOOR, margin 0.40 m — thin, disclosed plainly; the decimated D-05
   fixture by the SPEED LIMIT alone).
5. Verified all three real derivations pass D-13 insensitivity at the 1% tolerance
   (`removedDelta`/`plantedDelta` for L: 0.14%/0.82%; F: 0.00%/0.00%; B: 0.00%/0.00%), and all three
   strawmen still fail (L: 17.42%/51.61%; F: 98.82%/22.31%; B: 100.00%/19.40%).

**Margin and fragility, reported honestly (per this plan's own explicit instruction):** the D-09
trivial pair's exclusion margin (0.40 m below F = 3.0 m) is thin. The smallest named jump's margin
above F (8.05 - 3.0 = 5.05 m) is comfortable. If the archive grows and a new activity's momentary
GPS blip lands with excess between 2.6 m and 3.0 m, it would newly clear the floor; this is
disclosed, not hidden.

**D-09's question, answered explicitly:** the `3475734189` t=1581-1583 trivia case is excluded by
the **FLOOR**, not the speed limit, at the chosen constants (its own folded-step speeds, 8.5/8.8
m/s, are both below L = 7.35... actually its step DOES clear L, so it is a candidate, but its excess
(2.6 m) does not clear F (3.0 m) — the floor is the operative, not secondary, mechanism here). The
OTHER locked D-05 fixture (the decimated one, `3647739864 t=945-971`) IS excluded by the speed
limit alone (its max folded step, 5.885 m/s, never clears L = 7.35 m/s, so it is not even a
candidate). Both mechanisms are exercised on the live archive, and the artifact states which
applies to which item by name (`## D-10(d) check at the chosen constants`, `## Excess floor and the
trivia case (D-09)`).

## Decisions Made

See the frontmatter `key-decisions` above for the five corrective decisions this session made
(multiplier design, F's population redesign, F's strawman population choice, `findValley`'s bug
fix, and B's rounding). Each was verified by re-running the real D-13 harness against the live
archive, not asserted from first principles alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `deriveSpeedLimit` applied an implicit multiplier of 1 instead of a measured one**
- **Found during:** this continuation, re-checking the prior session's blocker
- **Issue:** Task 1's own `<behavior>` text specified `Math.ceil(value x 100) / 100` with no
  multiplier, contradicting 32-CONTEXT.md's own "Claude's Discretion" text naming a multiplier as
  part of this plan's job. This produced L = 4.41 m/s, at which D-10(d) is provably unreachable.
- **Fix:** added `speedLimitMultiplierAt`/`selectSpeedLimitMultiplier`, a candidate-selection rule
  choosing the smallest of a fixed outer-percentile list whose resulting L clears D-13.
- **Files modified:** `scripts/compute-unreliable-segment-calibration.mjs`
- **Commit:** `5e28deec`

**2. [Rule 1 - Bug] `deriveExcessFloor`'s population failed D-13 insensitivity structurally**
- **Found during:** wiring L through the real `(L, F)` joint insensitivity check for the first time
- **Issue:** the "excess of already-fast runs" population is nearly identical to what D-13's own
  removal step strips out, so no percentile order of it can pass insensitivity.
- **Fix:** redesigned the REAL rule onto "every folded covered step's own metres, pooled
  archive-wide" (R-7 p10); kept the STRAWMAN on the original population (it is the shape the
  plan's own spec names, and the only one of the two that actually fails).
- **Files modified:** `scripts/compute-unreliable-segment-calibration.mjs`,
  `scripts/compute-unreliable-segment-calibration.test.mjs`
- **Commit:** `5e28deec`

**3. [Rule 1 - Bug] `findValley` manufactured a valley over an empty population**
- **Found during:** checking B's own D-13 insensitivity — the removal arm legitimately emptied B's
  population entirely
- **Issue:** `counts[i] <= 0.5 * min(0, 0) === 0` trivially matched at the first interior bin when
  both neighbourhoods were entirely empty.
- **Fix:** require `maxLeft > 0 AND maxRight > 0` before a bin can count as a valley. Also widened
  `HIDDEN_PAUSE_BIN_WIDTH_METRES` from 5m to 20m — the live archive's own valley location was
  unstable at 5m under D-13 perturbation (95m relocating to 55m), an independently measured
  stability finding.
- **Files modified:** `scripts/compute-unreliable-segment-calibration.mjs`,
  `scripts/compute-unreliable-segment-calibration.test.mjs`
- **Commit:** `5e28deec`

**4. [Rule 1 - Bug] `HIDDEN_PAUSE_MIN_METRES`'s shipped-vs-live-derived comparison read "no"**
- **Found during:** Task 2's rendering, first generator run after hard-coding the constant
- **Issue:** the anchor-interval midpoint carries `d[i] - d[j]` floating-point noise
  (116.94999999999982), which does not bit-for-bit equal the hand-typed `116.95` in the shipped
  source.
- **Fix:** round B to 0.01 m in both `deriveHiddenPauseBoundary` and its D-13 stepsIndex adapter.
- **Files modified:** `scripts/compute-unreliable-segment-calibration.mjs`
- **Commit:** `909aaed6`

---

**Total deviations:** 4 auto-fixed (all Rule 1 - bugs found and fixed while executing this plan's
own STOP-condition-driven verification; none were tuning a constant to fit a named item or a
flagged count — each was verified by re-running the real D-13 harness after the fix).
**Impact on plan:** all four were necessary for the plan's own success criteria (D-13 passing on
real derivations, strawmen failing, shipped matching live-derived). No scope creep.

## Issues Encountered

The prior session's ~90 minutes of Task 1 engineering (the derivation function skeletons, their
hand-built-fixture tests, `checkFeasibility`, `mustFlagItems`/`mustSpareItems`) were NOT wasted —
every one of them was reused as-is; only `deriveSpeedLimit`'s multiplier, `deriveExcessFloor`'s
population, and `findValley`'s bug needed fixing. The blocker's own detailed measurement (excess
figures, the infeasibility proof) was exactly the evidence needed to diagnose the fix, once the
orchestrator's re-check showed the multiplier-of-1 premise was wrong.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Unblocked.** `DEFAULT_DETECTOR_PARAMS` now ships from `src/analytics/unreliable-segments.ts`
  with calibrated, D-13-verified constants. Plans 32-07, 32-08 and 32-09 can now import it.
- `32-CALIBRATION.md`'s `## Chosen constants` contract rows exist and are regenerable —
  `scripts/compute-unreliable-segment-recount.mjs` (plan 32-03) can parse them.
- SEG-04 is PARTIALLY discharged: the calibration artifact states the calibrated speed-limit
  constant and a non-circularity argument shown as measured insensitivity (D-13), not argued in
  prose. The Suunto (`4556693525`) disposition and the "figures of record" reconciliation SEG-04's
  text also requires are Wave 4's job (32-07); not ticked here.
- No blockers for 32-07.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: commit `1945864e` in `git log --oneline --all`
- FOUND: commit `5e28deec` in `git log --oneline --all`
- FOUND: commit `909aaed6` in `git log --oneline --all`
- FOUND: `src/analytics/unreliable-segments.ts` exports `UNRELIABLE_SPEED_LIMIT_MPS`,
  `UNRELIABLE_EXCESS_FLOOR_M`, `HIDDEN_PAUSE_MIN_METRES`, `DEFAULT_DETECTOR_PARAMS`
  (`grep -cE "export const (UNRELIABLE_SPEED_LIMIT_MPS|UNRELIABLE_EXCESS_FLOOR_M|HIDDEN_PAUSE_MIN_METRES) = "` = 3)
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` contains
  all six new headings, with shipped-equal `yes` on all three `## Chosen constants` rows
- CONFIRMED: `npm run build && npx tsc --noEmit` — exit 0
- CONFIRMED: `npx vitest run` (full suite) — 89 files / 2747 tests passed
- CONFIRMED: `node scripts/compute-unreliable-segment-calibration.mjs` run twice — `git diff --exit-code` on the artifact exits 0 (byte-identical)
- CONFIRMED: `git diff --stat .planning/ROADMAP.md .planning/REQUIREMENTS.md` — empty (disposition is `option-refixture`, not `option-amend-criterion-3`)
