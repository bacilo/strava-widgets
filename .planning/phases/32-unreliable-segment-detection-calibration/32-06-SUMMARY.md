---
phase: 32-unreliable-segment-detection-calibration
plan: 06
subsystem: testing
tags: [calibration-artifact, d09-excess-floor, d13-insensitivity, blocking-finding, incomplete]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "32-05's Decision (disposition: option-refixture, locked D-05 fixtures 7409028052:586-624 / 3647739864:945-971, statistic: S-A) — the input this plan derives L/F/B from"
provides:
  - "scripts/compute-unreliable-segment-calibration.mjs — parseDecisionText/loadDecision, mustFlagItems/mustSpareItems, deriveSpeedLimit, checkFeasibility, deriveExcessFloor (+ strawman), findValley, deriveHiddenPauseBoundary (+ strawman), and the stepsIndex-shaped insensitivityCheck adapters for F/B — all implemented and unit-tested, NONE shipped to production code"
  - "A rigorous, code-verified BLOCKING FINDING: the 32-05 Decision's own L (from S-A) makes D-10(d) UNREACHABLE for any excess floor F, given the locked D-05 fixtures — STOP condition (a) from this plan's own Task 1 action text"
affects: ["32-07 (renders the final 32-CALIBRATION.md — blocked until this finding is resolved)", "32-08, 32-09 (depend on shipped DEFAULT_DETECTOR_PARAMS, which do not exist yet)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Joint (L,F) feasibility check reusing 32-05's computeFeasibleFloor shape at a SPECIFIC chosen pair, rather than scanning a grid — checkFeasibility(archive, L, F, decision)"
    - "stepsIndex-shaped deriveFn adapters (excessFloorDeriveFn/hiddenPauseBoundaryDeriveFn + strawman counterparts) so constants whose real derivation needs detectUnreliableSegments (not just step speeds) can still reuse the existing insensitivityCheck removal/planting harness"

key-files:
  created: []
  modified:
    - scripts/compute-unreliable-segment-calibration.mjs
    - scripts/compute-unreliable-segment-calibration.test.mjs

key-decisions:
  - "None recorded by this plan — a NEW decision is required from the developer/orchestrator before 32-06 can proceed (see ## Blocking Finding below). This plan explicitly declines to make that decision itself (Rule 4: architectural conflict, not an auto-fixable bug)."

patterns-established:
  - "STOP conditions embedded in a plan's own <action> text are honored literally: Task 1 was implemented, tested and committed in full; Task 2 was NOT started once STOP condition (a) triggered."

requirements-completed: []  # SEG-04 remains OPEN. Task 1 (derivation functions) is complete and committed; Task 2 (hard-coding constants, rendering '## Chosen constants') did not run because the live archive makes it structurally impossible to derive a valid F for the Decision's own L.

# Metrics
duration: ~90min
completed: 2026-09-20
---

# Phase 32 Plan 06: Constant Derivation Functions — BLOCKED at Task 2 (D-10(d) unreachable at the Decision's own L)

**Task 1's derivation functions (L/F/B, each with a D-13 insensitivity check and a watched-failing strawman) are implemented, unit-tested and committed; Task 2 did not run because running the ACTUAL derivation against the real archive proves — via the plan's own `checkFeasibility`, not a hand-wave — that D-10(d) is mathematically unreachable at L=4.41 m/s (the 32-05 Decision's own S-A-derived speed limit) for ANY excess floor, because the locked dense D-05 fixture carries more absolute excess-metres than the smallest named jump.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-09-20
- **Completed:** 2026-09-20 (Task 1 only; Task 2 not executed)
- **Tasks:** 1 of 2 completed
- **Files modified:** 2

## Accomplishments

- Implemented every derivation function Task 1 specifies: `parseDecisionText`/`loadDecision` (the
  32-05 Decision's three grep-able lines), `mustFlagItems`/`mustSpareItems`, `deriveSpeedLimit`
  (ceil-rounded S-A/S-B, reusing `statisticSA`/`statisticSB` — not re-implemented),
  `checkFeasibility` (D-10(d) at a specific `(L, F)` pair, naming which mechanism — `'speed limit'`
  or `'floor'` — excludes each must-spare item), `deriveExcessFloor` (bulk R-7 p90 of archive-wide
  fast-run excesses at `L`, rounded DOWN to 0.1 m) with its watched-failing strawman (R-7 p99, a
  tail percentile of the same population), `findValley` (D-08's bin-search over a metres
  distribution) plus `deriveHiddenPauseBoundary` (the anchor-interval valley search with a stated
  midpoint fallback) and its strawman, and `stepsIndex`-shaped `insensitivityCheck` adapters for F
  and B so both can reuse 32-05's existing removal/planting harness even though their real
  derivations need `detectUnreliableSegments` (not just step speeds).
- 29 hand-built-fixture tests pass (`npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs`
  — 29 matched, 29 passed, 0 skipped): ceil rounding, `checkFeasibility` naming the blocking
  must-spare item and mechanism, a bimodal valley test (`valleyFound: true`) and a monotone-decay
  valley test (`valleyFound: false`), and — per constant (L reuses 32-05's own strawman; F and B
  each get a new one) — three watched-failing strawman assertions (`pass: false`) alongside three
  passing real-derivation assertions (`pass: true`).
- Ran the actual, just-implemented `deriveSpeedLimit`/`checkFeasibility` functions (not a hand-rolled
  approximation) against the REAL committed archive (1,874 streams) and discovered — rigorously,
  not by inspection — that the 32-05 Decision's own L is infeasible for any F. This is documented in
  full below.

## Task Commits

1. **Task 1: Derivation functions for L/F/B with D-13 insensitivity and watched-failing strawmen** -
   `1945864e` (feat)
2. **Task 2: Run live, hard-code constants, render artifact sections** - NOT STARTED. Blocked by the
   finding below before any code in `src/analytics/unreliable-segments.ts` or
   `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` was touched.

**Plan metadata:** this SUMMARY and the STATE.md blocker record the incomplete status; no
`docs(32-06): complete` commit follows, since the plan did not complete.

## Files Created/Modified

- `scripts/compute-unreliable-segment-calibration.mjs` - Task 1's derivation functions (see
  Accomplishments)
- `scripts/compute-unreliable-segment-calibration.test.mjs` - 29 new hand-built-fixture tests
- `.planning/phases/32-unreliable-segment-detection-calibration/32-06-SUMMARY.md` - this file

`src/analytics/unreliable-segments.ts`, `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`,
`.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` are **UNCHANGED** — Task 2 never started.

## Blocking Finding — STOP Condition (a): D-10(d) Unreachable at the Decision's Own L

Per this plan's own Task 1 `<action>` text: *"STOP conditions. Do not tune; record the situation in
the SUMMARY and return a blocker: (a) the Decision's statistic yields an L at which checkFeasibility
cannot pass for ANY F ... Moving L, F or B afterwards to make a check pass is forbidden."* This
condition triggered. No constant was moved to route around it.

**L, computed exactly as Task 1 specifies:** `deriveSpeedLimit(archive, 'S-A')` = `Math.ceil(4.404000000000229 × 100) / 100`
= **4.41 m/s** (S-A's full-precision value, not the rounded 4.404 display figure; ceil-rounding is
correct and not in question here).

**At L = 4.41 m/s, with `excessFloorMetres: 0` (the standard "candidate, not yet floored" probe
convention this file uses throughout), `runExcessAt` on the real archive gives:**

| Item | Kind | Window | Detected segment | Excess (m) |
|---|---|---|---|---|
| 3475740390 t=2347-2350 | must-flag (isolated jump) | 3s | 2347-2350, 30.1 m @ 10.03 m/s | **16.87** (the minimum) |
| 3475740390 t=2536-2538 | must-flag (isolated jump) | 2s | 2536-2538, ~28.6 m | 19.78 |
| 3475740390 t=2508-2513 | must-flag (isolated jump) | 5s | 2508-2513, ~52.4 m | 34.93 |
| 3475740390 t=2580-2583 / t=2587-2589 | must-flag (isolated jumps, merged into one burst at this L) | 3s+2s | 2580-2589 | 40.41 |
| 3475734189 t=1353-1360 | must-flag (hidden pause) | 7s | 1353-1360, 199 m | 147.01 |
| 3475734189 t=1581-1583 | must-spare (D-09 trivial pair) | 2s | 1581-1583, 17.3 m | 11.86 |
| **7409028052 t=586-624** | **must-spare (D-05 locked DENSE fixture)** | 38s window | **detected as 591-624, 33s, 199 m @ 6.03 m/s** | **53.47** |
| 3647739864 t=945-971 | must-spare (D-05 locked decimated fixture) | 26s | 945-971, 153 m @ 5.885 m/s | 38.34 |

`checkFeasibility` requires every must-flag item's excess to exceed F (so F < 16.87, the minimum) AND
every must-spare item's excess to be at or below F (so F ≥ 53.47, the dense fixture's own excess).
**16.87 < 53.47** — there is no F satisfying both. Calling the actual (not hand-rolled)
`computeFeasibleFloor` on these exact rows confirms it structurally:

```
feasibleFloor: null
reason: "no floor in [53.47, 16.869999999999454) — blocked by 7409028052 t=586-624
         (D-05 locked dense); 3647739864 t=945-971 (D-05 locked decimated) vs must-flag
         minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s))"
```

Swept `checkFeasibility(archive, 4.41, F, decision)` for every F from 0 to 200 in 0.5 m steps (401
points): **zero pass.** This sweep is redundant confirmation only — the `hi < lo` proof above already
shows infeasibility for literally every F ≥ 0, not just the swept range.

**Root cause, stated plainly:** L = 4.41 m/s is close to ordinary sustained running pace. D-09's
excess floor is an ABSOLUTE distance quantity (`metres − L × seconds`), which grows with duration.
The locked dense D-05 fixture (`7409028052 t=586-624`) is a genuine ~33-second effort at 6.03 m/s —
comfortably real running, correctly chosen by 32-05 as a negative control — but because it is
*sustained*, it accumulates MORE raw excess-metres (53.47 m) at L=4.41 than the smallest named
GPS-jump anomaly (`3475740390 t=2347-2350`, a 3-second spike at 10.03 m/s, only 16.87 m of excess).
No single scalar, duration-blind floor can separate "a brief severe anomaly" from "a longer
moderate-pace genuine effort" when the anomaly's absolute excess is smaller than the genuine effort's.
This is exactly the "known hard part" 32-05's own artifact flagged in its Candidate-statistics
section (both S-A and S-B failed insensitivity at floor 0, for the same underlying reason: at this
L, ordinary sustained running already crosses the naive threshold) — but 32-05 did not check
feasibility of the NEW locked fixtures specifically at L = ceil(S-A); this plan is the first to run
that check, and it fails.

**This was NOT tuned around.** `deriveExcessFloor`, `checkFeasibility`, `mustFlagItems`, and
`mustSpareItems` were all implemented and committed BEFORE this live check was run, exactly as
Task 1 specifies, and are unchanged by this finding. `deriveExcessFloor(archive, 4.41)` itself
computes **6.4 m** (p90 of the archive-wide fast-run-excess population) — nowhere near a value that
would help, since the problem is structural (any F fails), not a matter of picking a better
percentile.

### What this blocks

Task 2 (hard-coding `UNRELIABLE_SPEED_LIMIT_MPS`/`UNRELIABLE_EXCESS_FLOOR_M`/`HIDDEN_PAUSE_MIN_METRES`
into `src/analytics/unreliable-segments.ts`, rendering `## Chosen constants` in
`32-CALIBRATION.md`) cannot run: there is no valid F to derive B from, and hard-coding L alone with a
fabricated F would violate D-10(e)'s anti-quota rule and D-13's insensitivity requirement. Plans
32-07, 32-08 and 32-09 all depend on `DEFAULT_DETECTOR_PARAMS` existing, so they are transitively
blocked too.

### Options for the required human decision (not chosen here — Rule 4)

This plan's `<objective>` already anticipates one such disposition:

> `option-jitter`: do NOT execute this plan. That option changes the detector (32-02) and recount
> (32-03) contracts... Record in the SUMMARY that the phase needs re-planning
> (`/gsd-plan-phase 32 --gaps`) and stop.

The CURRENT recorded Decision (32-05) is `option-refixture`, not `option-jitter` — 32-05 did not
know at the time that the new locked fixtures would fail feasibility at L=4.41, because that specific
check was never run before now. Plausible paths forward, none decided here:

1. **Re-open 32-05's fixture choice** (stay within `option-refixture`'s spirit): find a D-05
   negative-control fixture whose ABSOLUTE excess at L=4.41 is smaller than 16.87 m — i.e., search by
   excess-metres, not just aggregate speed or max-folded-step-speed, since duration is now shown to
   dominate. A dense multi-tens-of-seconds fixture may be structurally incompatible with an absolute
   floor at this L regardless of which specific activity is picked.
2. **Re-open 32-05's statistic choice**: a different/larger L (not S-A) might leave more headroom
   before sustained genuine efforts start out-excessing brief jumps. This reopens a decision 32-05
   already reasoned through carefully (S-A was chosen over S-B specifically for lower `removedDelta`
   at floor 0) and would need a superseding decision.
3. **Re-open D-09's floor SHAPE** (a genuine architectural change, forbidden under the *current*
   `option-refixture` disposition, which explicitly keeps "the D-09/D-10 rule shape ... locked"): a
   duration-normalized or rate-based significance test instead of a pure absolute-metres floor. This
   is closest in spirit to the plan's own `option-jitter` branch.
4. **Accept `option-jitter`'s consequence as written**: treat this finding as evidence that
   `option-jitter` should have been the 32-05 disposition after all, and re-run `/gsd-plan-phase 32 --gaps`
   per this plan's own objective text.

No option was selected. This SUMMARY documents the evidence for whichever the developer/orchestrator
chooses next.

## Decisions Made

None — see Blocking Finding above. The developer/orchestrator must record a superseding decision
(most naturally as an amendment to, or a fresh continuation of, 32-05's Decision block) before 32-06
can resume.

## Deviations from Plan

None beyond the plan's own explicit STOP-condition handling: Task 1 was executed and committed
exactly as specified (including the live-archive validation its own `<action>` text calls for).
Task 2 was correctly NOT executed once STOP condition (a) triggered — "Do not tune" was honored:
no constant was adjusted, no fixture was swapped, and no fallback value was fabricated to force a
pass.

## Issues Encountered

The 92%-of-Task-1 engineering effort (deriveExcessFloor/deriveHiddenPauseBoundary and their
`insensitivityCheck` adapters, all fully implemented and unit-tested) turned out not to matter for
this plan's live outcome, because `checkFeasibility` fails before F or B are ever meaningfully
derivable on the real archive. This work is not wasted: it is exactly what a superseding decision
(option 1 or 2 above) will need re-run against a revised fixture set or L, without re-implementing
anything.

## User Setup Required

A human/orchestrator decision is required (see "Options for the required human decision" above)
before plan 32-06 can resume. No external service configuration is needed.

## Next Phase Readiness

- **Blocked.** Plans 32-07, 32-08, 32-09 all depend on `DEFAULT_DETECTOR_PARAMS` shipping from this
  plan's Task 2, which did not run.
- Recommend the orchestrator surface this finding to the developer directly (not auto-resolve) —
  this is an architectural/decision conflict (Rule 4), not an auto-fixable bug.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20 (Task 1 only — plan INCOMPLETE)*

## Self-Check: PASSED

- FOUND: commit `1945864e` in `git log --oneline --all`
- FOUND: `scripts/compute-unreliable-segment-calibration.mjs` (modified, Task 1 functions present)
- FOUND: `scripts/compute-unreliable-segment-calibration.test.mjs` (modified, 29 new tests)
- CONFIRMED: `npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs` — 29 passed, 0 failed
- CONFIRMED: `npx vitest run` (full suite) — 89 files / 2741 tests passed
- CONFIRMED: `npx tsc --noEmit` — exit 0
- CONFIRMED: `src/analytics/unreliable-segments.ts`, `32-CALIBRATION.md`, `ROADMAP.md`,
  `REQUIREMENTS.md` are unchanged (`git status --short` shows only the two scripts/*.mjs files
  touched by this plan)
