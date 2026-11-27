---
phase: 35-stream-derived-running-pace
plan: 06
subsystem: analytics
tags: [running-pace, pace-derivation, calibration, D-05, D-02, D-06, D-07, insensitivity, HALT]

# Dependency graph
requires:
  - phase: 35-stream-derived-running-pace (plan 35-01)
    provides: "the six pre-declared discretion resolutions (D-01/D-02/D-04/D-06/D-07/D-08) recorded in REQUIREMENTS.md/ROADMAP.md before any measurement — this plan's own SHAPES/populations/direction encode them"
  - phase: 35-stream-derived-running-pace (plan 35-03)
    provides: "deriveRunningPace(stream) in pace-derivation.ts (computable/runningPaceSecPerKm/excludedM/excludedSec) — the shipped function this generator legitimately imports and arbitrates over"
provides:
  - "scripts/compute-running-pace-dispute-calibration.mjs: the HALT-capable calibration generator encoding D-05's pre-declaration verbatim — populations E/C/B with a runtime disjointness assertion, seven pre-declared shapes (S0 strawman, C1/C3/C2/C4, B1/B2) in first-clearing order, three D-13 insensitivity axes (Axis A structural-only for six shapes, Axis B proportional planting, Axis C base-tail removal), a single shapeClears() predicate, first-clearing arbitration, and a non-substituting basis gate. Never run against data/streams/ in this plan."
  - "scripts/compute-running-pace-dispute-calibration.test.mjs: plant/removal accounting watched RED before trusted, Axis C watched both failing and clearing on the two declared synthetic fixtures, disjointness watched aborting, all three terminal branches (Chosen constants / NO SHAPE CLEARS / GATE FAILED) proven via hand-built results, a genuine strawman-clears archive proven to halt before selecting a real shape, renderer determinism"
  - "npm run compute-running-pace-dispute-calibration script (build-then-run, since the generator imports compiled dist/analytics/pace-derivation.js)"
  - "compute-running-pace-dispute-calibration.mjs certified import-side-effect-free via unreliable-segment-import-guards.test.mjs's wrapped-fs mechanism"
affects: [35-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Axis B and Axis C both split into a 'real mechanism' function (plantMaxStatistic / trimBaseTail) and a generic 'accounting + movement + status' evaluator (evaluateAxisBFromPlanted / evaluateAxisCFromTrimmed) that takes an ALREADY-BUILT population — so a test can drive the evaluator with either the real mechanism's output or a deliberately broken one (a self-reported plantsEntered/membersRemoved that does not match the population's actual growth/shrinkage), without needing a real bug in production code to prove the guard is falsifiable"
    - "plantsEntered is a SELF-REPORTED counter incremented once per successful array push, kept independent of population.length, so the accounting check (plantedItems === baseItems + plantsEntered) is a genuine assertion rather than the tautology it would be if plantsEntered were derived FROM population.length"
    - "shapeClears(axes) is the single named predicate (never re-implemented at a call site) that reads only axisB.status/axisC.status and structurally cannot read axisA — enforced by a source-text regex in Task 1's own verify script, not just convention"
    - "movement computation (relativeMovement) is one shared helper across all three axes, Number.isFinite-gated so NaN/null bases and NaN/null perturbed cuts are uniformly treated as non-clearable rather than producing a false PASS via a stray comparison"

key-files:
  created:
    - scripts/compute-running-pace-dispute-calibration.mjs
    - scripts/compute-running-pace-dispute-calibration.test.mjs
  modified:
    - package.json
    - scripts/unreliable-segment-import-guards.test.mjs

key-decisions:
  - "Axis A for S0 is genuinely computed (not structural): it removes the badged population (statistic > baseCut, slower-only per D-06) from E and re-derives S0's own cut. Since S0's cut function reads the target activity BY ID, and the target is itself always in the badged set (S0's cut sits just below the target's own delta by construction), removing the badged population removes the target — S0's own cut function (strawmanCutS0) then returns null, producing a genuine, non-vacuous FAIL. This is a structural consequence of S0's circularity, not a hand-tuned special case."
  - "Axis B's plant-entry accounting is checked against a SELF-REPORTED plantsEntered counter (incremented in the planting loop), never against population.length - baseItems.length. If plantsEntered were derived from the population arrays themselves, a broken planter that silently drops plants into the wrong array would produce a tautologically-true accounting check (0 === 0) — exactly the vacuity 34 D-19 was written to fix. The self-reported counter makes the broken-planter test in Task 2 a genuine RED case rather than an unfalsifiable one."
  - "Axis B and Axis C each expose their 'real mechanism' (plantMaxStatistic / trimBaseTail) and their 'accounting + verdict' evaluator (evaluateAxisBFromPlanted / evaluateAxisCFromTrimmed) as SEPARATE exported functions, so Task 2's watched-RED tests can hand the evaluator a deliberately broken population/counter pair without needing to inject a bug into the real mechanism function itself."
  - "The basis gate (applyBasisGate) requires BOTH the D-02 eligibility gate (excludedM > 0) AND the slower-only direction (statistic > cut) on 3475724402 specifically — computed once, from the already-selected shape's own cutValue, never re-run against a substitute shape on failure (per the anti-quota rule, Phase 27 D-02)."
  - "Findings that depend on a cut (newlyDisputedCount, fasterSideCount, and each named activity's badged/not-badged status) are null / 'not evaluated' when no constant shipped — never coerced to a fabricated zero or a false status."

patterns-established:
  - "A synthetic archive can be crafted to make a genuinely-circular strawman (S0) clear both insensitivity axes on purpose, by placing the target's own delta a tiny, isolated distance above an otherwise well-separated population (so the global-minimum-positive-gap the strawman's cut depends on sits far from both the plant location — the population's own max — and the trim location — the population's own top 1%). This proves the HALT branch's plumbing (strawmanCleared -> selectedId stays null -> NO SHAPE CLEARS, never proceeding to C1) without needing the real archive."

requirements-completed: []  # Requirement-tick safety (plan's own Objective): this plan ticks nothing.

# Metrics
duration: ~55min
completed: 2026-09-27
---

# Phase 35 Plan 6: Running-Pace Dispute Threshold Calibration Generator (Build-Only) Summary

**Built (never ran against the archive) the seven-shape, three-axis, HALT-capable calibration generator for RPACE-03's disagreement threshold — `shapeClears()` requiring both Axis B (proportional planting) and Axis C (base-tail removal, its own removal accounting mirroring Axis B's plant accounting) to clear, with Axis A rendered but structurally excluded from six of the seven shapes.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-27
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **`scripts/compute-running-pace-dispute-calibration.mjs`** encodes 35-06-PLAN.md's `<interfaces>` block verbatim:
  - **Populations.** `E` (`computable && metadataPaceSecPerKm>0 && excludedM>0`), `C` (adds `excludedSec===0`), `B` (`excludedM===0` only). `assertPopulationsDisjoint(E, C, B)` throws a named-reason `Error` (never returns a boolean) when C or B overlaps E — verified live (see Task 2) to throw `D-05 disjointness violated: population C shares 1 activity id(s) with population E (overlap-1) -- C requires excludedM === 0 while E requires excludedM > 0, so no activity may legitimately belong to both. Aborting rather than proceeding with a contaminated population.`
  - **Seven shapes, first-clearing order**: `S0` (strawman: `delta(3475724402)` minus the smallest positive gap between adjacent delta ranks in `E`), `C1`/`C3` (q95 delta/ratio over `C`), `C2`/`C4` (q99 delta/ratio over `C`), `B1`/`B2` (q95 delta/ratio over `B`). Each carries generated `meaning`/`nonCircularity`/`caveats` prose — no artifact prose is hand-written; the renderer (`renderPreDeclaredShape`) reads these fields directly off the `SHAPES` array declared before any measurement.
  - **Axis A** (`axisAForShape`): for all six C/B-based shapes, returns the literal `structural (0 by construction)` status, never a numeric pass. For S0 (`basePopulation === 'E'`) it genuinely removes the badged population (`statistic > baseCut`) from `E` and re-derives the cut — since S0's own cut function reads the target activity by id, and the target is always inside its own badged set, this removes the target and `strawmanCutS0` returns `null`, a genuine FAIL.
  - **Axis B** (`plantMaxStatistic` + `evaluateAxisBFromPlanted`, wired by `axisBForShape`): plants `Math.ceil(INSENSITIVITY_TOLERANCE * N)` synthetic records, each carrying the base population's own observed maximum statistic value, via a SELF-REPORTED `plantsEntered` counter kept independent of the population array's own length. Accounting: `plantedItems === baseItems + plantsEntered`; a violation renders `invalid (plant accounting failed)`, never `cleared`.
  - **Axis C** (`trimBaseTail` + `evaluateAxisCFromTrimmed`, wired by `axisCForShape`): drops the `Math.ceil(INSENSITIVITY_TOLERANCE * N)` largest-statistic members (sorted by the shape's OWN statistic), re-derives the cut over the remainder, and computes `movement = |trimmedCut - baseCut| / |baseCut|`. Returns `baseItems`, `membersRemoved`, `trimmedItems`, `removedStatisticValues`, `baseCut`, `trimmedCut`, `movement`, `status`. Removal accounting (`trimmedItems === baseItems - membersRemoved`) failing renders `invalid (removal accounting failed)`; `membersRemoved === 0` renders `invalid (no member removed)` — a zero movement counts as a clear ONLY when at least one member was actually removed.

    ```js
    export function evaluateAxisCFromTrimmed(shape, basePopulation, baseCut, trimmedPopulation, membersRemoved) {
      const baseItems = basePopulation.length;
      const trimmedItems = trimmedPopulation.length;
      const accountingOk = trimmedItems === baseItems - membersRemoved;
      // ... removedStatisticValues computed by id-set difference ...
      const trimmedCut = shape.cut(trimmedPopulation);
      const movement = relativeMovement(baseCut, trimmedCut);
      let status;
      if (!accountingOk) status = 'invalid (removal accounting failed)';
      else if (membersRemoved === 0) status = 'invalid (no member removed)';
      else status = movement !== null && movement <= INSENSITIVITY_TOLERANCE ? 'cleared' : 'failed';
      return { baseItems, membersRemoved, trimmedItems, removedStatisticValues, baseCut, trimmedCut, movement, status };
    }
    ```

  - **`shapeClears(axes)`**: `return axes.axisB.status === 'cleared' && axes.axisC.status === 'cleared'` — the source text never mentions `axisA`, asserted by Task 1's own regex over the function body.
  - **Arbitration + basis gate** (`runCalibration`): evaluates all seven shapes, halts with `strawmanCleared: true` if S0 clears (selection never proceeds to C1), otherwise selects the first of C1..B2 that clears; applies `applyBasisGate` to the selected shape ONLY (3475724402 must be eligible — `excludedM > 0` — AND its statistic must exceed the cut); on gate failure renders `## GATE FAILED` with no substitution.
  - **Findings** (`buildFindings`): archive-wide newly-disputed count under the chosen cut, the faster-side count at the mirror cut (D-06), the gate-excluded (`B`) population size with its own delta summary (D-02), non-computable counts by reason, and the badged/not-badged status of all four named activities — all `null`/`not evaluated` (never a fabricated zero) when no constant shipped.
  - **Renderer** (`renderCalibrationMarkdown`): all eleven required sections in order (`## Statistic and scope` through `## Inputs`), the contamination statement quoting no probe figure, and exactly one of the three mutually-exclusive terminal branches. Provenance: `gitId('rev-parse HEAD:data/streams')` — never a bare `rev-parse HEAD`, never a wall-clock read.
  - **`.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` does NOT exist** — the generator was imported and exercised extensively (dry runs, synthetic smoke tests) but its `main()` — which reads `data/streams/`/`data/activities/` and can `writeFileSync` — was never invoked, per this plan's own Task 1 action item 13 ("DO NOT run this script against `data/streams/` in this plan"). All correctness proofs below run against fabricated in-memory record arrays only.
- **`scripts/compute-running-pace-dispute-calibration.test.mjs`** — 25 tests, all synthetic, none reading the real archive (`grep -c "data/streams"` → `0`):
  - **Plant accounting watched RED first** (verbatim): a broken plant result (`{ population: [...basePopulation], plantsEntered: 5 }`, i.e. plants claimed but the read population unchanged) produces `accountingOk: false`, `movement: 0`, `status: 'invalid (plant accounting failed)'`. The REAL planter then passes `plantedItems === baseItems + plantsEntered` for **every one of the seven shapes, including S0**. Plant counts confirmed `ceil(0.01*N)` for N=1 (→1), 99 (→1), 100 (→1), 101 (→2), each plant carrying the population's own max statistic value.
  - **Axis C watched in BOTH directions, matching the plan's own hand-computed fixtures exactly:**
    - FAIL: N=100 (95×delta=10, 5×delta=1000), untrimmed q95 measured `59.499999999997...` (≈59.5), `membersRemoved=1`, trimmed q95 measured `10` exactly, **movement measured 0.8319327731092357 (≈83.2%)**, `status: 'failed'`. `shapeClears` asserted `false` even with `axisB` forced to `'cleared'`.
    - CLEAR: N=1000 (`1000 + i*0.001`), `membersRemoved=10`, untrimmed q95 `1000.9490499999999`, trimmed q95 `1000.93955`, **movement measured 0.000009490992573387269 (<0.0001)**, `status: 'cleared'`.
  - **Removal accounting watched RED** (verbatim): a broken trimmer that hands back the population UNCHANGED but claims `membersRemoved=1` produces **movement exactly `0`** yet `status: 'invalid (removal accounting failed)'` — never `cleared`.
  - **Never-vacuous status:** an empty base population → `membersRemoved=0`, `status: 'invalid (no member removed)'`.
  - **Tolerance boundary pair**, read from the exported `INSENSITIVITY_TOLERANCE` constant (never a pinned `0.01` literal): movements of `INSENSITIVITY_TOLERANCE - 0.0005` and `INSENSITIVITY_TOLERANCE + 0.0005` measured `cleared` then `failed` respectively.
  - **Disjointness watched firing:** a synthetic `{ id: 'overlap-1' }` present in both `E` and `C` makes `assertPopulationsDisjoint` throw `D-05 disjointness violated: population C shares 1 activity id(s) with population E (overlap-1) -- ...`; the mirror case (`overlap-2` in both `E` and `B`) throws the `population B shares...` variant.
  - **All three terminal branches**, driven by hand-built `result` objects: (a) a cleared shape + passing gate renders `## Chosen constants` with **exactly one** `PACE_DISAGREEMENT_RUNNING_\w+ = ...` line, matched by whole-string regex; (b) no shape clearing renders `## NO SHAPE CLEARS` with **zero** `PACE_DISAGREEMENT_RUNNING_` matches anywhere in the whole string; (c) a cleared shape + failing gate renders `## GATE FAILED`, likewise zero matches. A fourth test confirms a rendered shape block contains all three exact axis labels and the Axis C row prints `membersRemoved=` and its status verbatim.
  - **Strawman-clears halts before C1** — a genuine (not hand-built) synthetic archive: target `3475724402` at delta=50, an isolated pair at delta=10/10.0001 (defines the population's global-minimum-positive-gap S0's cut depends on), and 987 filler records at delta≈1000+ (well above both the plant location and the trim boundary). `runCalibration` measures `s0.axisB.status==='cleared'`, `s0.axisC.status==='cleared'`, `result.strawmanCleared===true`, `result.selectedId===null` (never proceeds to C1 even though C1..B2 are all still evaluated for the artifact), `decideOutcome(result)` → `{ exitCode: 1, reason: 'strawman-s0-passed' }`, and the rendered markdown contains `## NO SHAPE CLEARS` and `strawmanCleared: true` with zero `PACE_DISAGREEMENT_RUNNING_` matches.
  - **Renderer determinism:** the same `result` object rendered twice produces byte-identical strings; neither contains an ISO date or timestamp pattern.
  - Plus `strawmanCutS0`/`applyBasisGate` edge cases (target absent, target ineligible, target eligible-and-badged) and a direct assertion that `shapeClears` ignores `axisA` regardless of its status.
  - **`compute-running-pace-dispute-calibration.mjs` added to `unreliable-segment-import-guards.test.mjs`'s certified set** (new describe block mirroring the existing five), confirmed to record **zero fs calls at import** — the generator's `main()` never fires as an import-time side effect.
- **`npm run compute-running-pace-dispute-calibration`** added to `package.json`, `npm run build &&`-prefixed (the generator imports compiled `dist/analytics/pace-derivation.js`).
- Full gate: `npx tsc --noEmit` clean; `npx vitest run` **3630/3630** (up from 3604 before this plan — 25 new tests in the new file + 1 new test in the import-guard file = 26, matching exactly); `git status --porcelain data/` empty throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the HALT-capable calibration generator encoding the pre-declaration verbatim** - `4edf777c` (feat)
2. **Task 2: Plant and removal accounting watched RED, Axis C watched clearing AND failing, disjointness, renderer determinism, import-time certification** - `20b3b352` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `scripts/compute-running-pace-dispute-calibration.mjs` — the generator: populations, seven shapes, three axes, `shapeClears`, arbitration, basis gate, findings, renderer, provenance, `main()` behind a self-execution guard. Never invoked against the real archive in this plan.
- `scripts/compute-running-pace-dispute-calibration.test.mjs` — 25 synthetic-only tests covering every mechanism above.
- `package.json` — one new script, `compute-running-pace-dispute-calibration`, `npm run build &&`-prefixed.
- `scripts/unreliable-segment-import-guards.test.mjs` — one new describe block certifying the new generator performs no fs read at import time, mirroring the file's existing five blocks; its two positive controls (`import-time-read-probe-named.mjs`/`import-time-read-probe-default.mjs`) untouched.

## Decisions Made

See `key-decisions` in the frontmatter above: (1) Axis A for S0 is genuinely computed, not structural, and its own circularity guarantees a FAIL by structural consequence; (2) Axis B's plant-entry accounting reads a self-reported counter rather than deriving it from population length, so a broken planter is genuinely falsifiable; (3) both Axis B and Axis C are split into a "real mechanism" function and a generic "accounting + verdict" evaluator so tests can exercise broken inputs without injecting bugs into production code; (4) the basis gate is applied once, to the selected shape only, with no substitution on failure; (5) cut-dependent findings are `null`/"not evaluated" rather than a fabricated zero when no constant ships.

## Deviations from Plan

None — plan executed exactly as written. The generator's structure follows `compute-pause-classification-calibration.mjs`'s section order and `main()`/provenance shape as instructed, adapted from three families down to one, and from the pause file's `evaluateShape(removed, planted)` two-axis harness to this plan's own three-axis (A/B/C) design, which the plan's own `<interfaces>` block specifies in full.

## Issues Encountered

None. Every fixture in the plan's own pre-declaration (the N=100 tail-heavy Axis C FAIL case, the N=1000 flat Axis C CLEAR case, the plant-count boundary at N=1/99/100/101) was verified by hand-computation before being encoded as a test, and every computed number (59.5 → 10.0, 83.2% movement; 1000.94905 → 1000.93955, <0.0001 movement) matched the plan text exactly on first computation — no arithmetic discrepancy required investigation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The generator is fully built, tested against synthetic fixtures proving both HALT branches (`NO SHAPE CLEARS` via a genuinely-clearing strawman, `GATE FAILED` via a gate-ineligible target) and the success branch (`Chosen constants`) are each reachable and mutually exclusive, and has never touched `data/streams/` or `data/activities/`.
- Plan 35-07 can now run `npm run compute-running-pace-dispute-calibration -- --write` against the real archive, read the rendered `35-CALIBRATION.md`, and either accept a named constant (subject to the basis gate) or accept a HALT with the reported findings (population sizes, plant counts, `membersRemoved`, non-computable counts) as the basis for a developer decision — per this plan's own "declare the constant when calibration HALTs" standing lesson, the HALT path is fully expressible and never silently widened.
- `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` does not exist; `git status --porcelain data/` is empty.
- No blockers for plan 35-07.

---
*Phase: 35-stream-derived-running-pace*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 3 files confirmed present via `[ -f ... ]`: this summary,
`scripts/compute-running-pace-dispute-calibration.mjs`,
`scripts/compute-running-pace-dispute-calibration.test.mjs`. Both task commit hashes
(`4edf777c`, `20b3b352`) confirmed present via `git log --oneline --all`.
`.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` confirmed absent.
`git status --porcelain data/` confirmed empty.
