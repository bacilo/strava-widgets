---
phase: 28-pr-plausibility-ceiling
plan: 03
subsystem: analytics
tags: [best-efforts, pr-ceiling, plausibility, order-statistics, demotion]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    plan: "01"
    provides: "CEILING_K = 1.28 and CEILING_MIN_POPULATION = 100, measured live and cited by section in 28-CEILING-CALIBRATION.md"
  - phase: 28-pr-plausibility-ceiling
    plan: "02"
    provides: "EffortDemotion/EffortDemotionGuard/CeilingDerivation types and the required ComputedEffort.demotion field"
provides:
  - "src/analytics/best-effort-ceiling.ts — the pure, file-I/O-free ceiling statistic: CEILING_K, CEILING_MIN_POPULATION, percentileNearestRank, deriveCeiling, deriveCeilings, ceilingDemotion"
  - "isPlausible's guard discriminator ('max-speed' | 'world-record') on PlausibilityResult's failing variant, so one shared demotion path can name which absolute guard fired"
affects: [28-05-three-pass-restructure, 28-04-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nearest-rank (interpolation-free) percentile so a derived statistic is always an observed data point, never synthesised between two"
    - "Fail-open (not fail-closed) below a measured population floor, with a machine-readable failOpenReason distinct from an error"
    - "A discriminated result union widened with an optional field (guard) rather than a required one, to avoid forcing an unrelated sibling function's failure branches into the same shape"

key-files:
  created:
    - src/analytics/best-effort-ceiling.ts
    - src/analytics/best-effort-ceiling.test.ts
  modified:
    - src/analytics/best-effort-utils.ts
    - src/analytics/best-effort-utils.test.ts
    - src/analytics/best-effort.types.ts
    - .planning/phases/28-pr-plausibility-ceiling/deferred-items.md

key-decisions:
  - "guard on PlausibilityResult's failing variant is optional, not required — validateStreamSeries shares the same return type for failures that correspond to no absolute guard at all, and making it required would have forced an unrelated function's error branches into the ceiling's guard vocabulary"
  - "CeilingDerivation's multiplier field is always set to CEILING_K, in both the fail-open and derivation branches, matching the plan's stated shape exactly"

patterns-established:
  - "A ceiling module's signature enforces non-circularity structurally: deriveCeiling takes only a distance key and a population array, so no caller can pass a pre-computed ceiling, a date window, or a target count"

requirements-completed: [PR-02, PR-03]

# Metrics
duration: ~25min
completed: 2026-09-10
---

# Phase 28 Plan 03: Pure Ceiling Module & isPlausible Guard Discriminator Summary

**A pure, file-I/O-free module derives one all-time personal plausibility ceiling per distance from an already-filtered population (`CEILING_K = 1.28`, `CEILING_MIN_POPULATION = 100`, both cited to 28-01's live measurement), fails open below the floor with a machine-readable reason, and is proven structurally unmovable by the outliers it rejects — while `isPlausible` gained a `guard` discriminator so every rejection can now be expressed as one `EffortDemotion` shape.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified — 1 of the 4 outside this plan's originally declared file list, see Deviations)

## Accomplishments

- `src/analytics/best-effort-ceiling.ts` exports `CEILING_K`/`CEILING_MIN_POPULATION` (values from `28-CEILING-CALIBRATION.md`'s "Chosen constants" section, doc comments quoting the argmax distance 10k's `max` = 4.1948 m/s and `p90` = 3.2997 m/s), `percentileNearestRank` (interpolation-free, nearest-rank), `deriveCeiling` (fail-open below the floor, non-circular by signature), `deriveCeilings` (one pass over `TARGET_ORDER`, exactly seven entries), and `ceilingDemotion` (strict `>`, house-register reason string, `guard: 'ceiling'`).
- The module is pure (no `fs`/`path`/`process`/`while`, verified by a source-scanning guard command) and single-shot (no recursion, no self-re-derivation).
- `isPlausible`'s `PlausibilityResult` failing variant now carries an optional `guard: 'max-speed' | 'world-record'`, set on both of `isPlausible`'s existing rejection branches, with both exact reason strings and `MAX_SPEED_MARGIN` byte-unchanged.
- 19 new unit tests in `best-effort-ceiling.test.ts` cover all six properties the phase's success criteria rest on: interpolation-freedom, the floor tested from both sides, the load-bearing outlier-injection proof (p90/ceiling unmoved by 20 injected extreme outliers via a sized plateau absorbing the known +18 index shift, contrasted against p99.5 of the same injection which DOES move), order-independence via a fixed non-random permutation, `deriveCeilings`'s missing-distance fail-open behaviour, and the strictness boundary plus reason-register regex on `ceilingDemotion`.
- 4 new unit tests in `best-effort-utils.test.ts` pin the guard discriminator, its exact-string reason preservation, the max-speed-before-world-record precedence, and the passing variant's absence of a `guard` property.

## Task Commits

Each task was committed atomically:

1. **Task 1: Give isPlausible a guard discriminator so one shared demotion path can name which guard fired** - `7f3cd562` (feat)
2. **Task 2: The pure ceiling module — constants, derivation, fail-open, and the demotion it produces** - `504f7c89` (feat)
3. **Task 3: Unit-test the ceiling module's fail-open, strictness, order-independence and reason register** - `c25f5256` (test)

_No separate plan-metadata commit — SUMMARY.md is committed by the orchestrator's worktree merge flow (STATE.md/ROADMAP.md excluded per worktree isolation)._

## Files Created/Modified

- `src/analytics/best-effort-ceiling.ts` - the pure ceiling module: constants, `percentileNearestRank`, `deriveCeiling`, `deriveCeilings`, `ceilingDemotion`
- `src/analytics/best-effort-ceiling.test.ts` - 19 tests across 6 describe blocks
- `src/analytics/best-effort-utils.ts` - `isPlausible`'s two rejection branches now set `guard: 'max-speed'` / `guard: 'world-record'`
- `src/analytics/best-effort-utils.test.ts` - 4 new cases in a new `isPlausible — guard discriminator` describe block
- `src/analytics/best-effort.types.ts` - `PlausibilityResult`'s failing variant widened with an optional `guard` field (deviation, see below)
- `.planning/phases/28-pr-plausibility-ceiling/deferred-items.md` - logged this plan's share of pre-existing, environment-only `npm test` failures

## Decisions Made

- **`guard` is optional, not required, on `PlausibilityResult`'s failing variant.** `validateStreamSeries` in the same file returns the same `PlausibilityResult` type for series-validation failures (length mismatch, non-finite values, decreasing sequences) that correspond to no absolute plausibility guard at all. Making `guard` required broke `tsc --noEmit` at every one of `validateStreamSeries`'s six failure returns; making it optional keeps the discriminated union's shape (`ok: true` has no `guard`; a failing `isPlausible` result always has one; a failing `validateStreamSeries` result has none) without inventing a meaningless guard value for series validation.
- **`CeilingDerivation.multiplier` is set to `CEILING_K` in both branches of `deriveCeiling`**, including the fail-open branch, per the plan's explicit instruction ("`multiplier: CEILING_K`" is named in both the fail-open bullet and the derivation-branch bullet of Task 2's action).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PlausibilityResult`'s declaration lives in `best-effort.types.ts`, not the two files this task named**
- **Found during:** Task 1, immediately on reading `best-effort-utils.ts`'s import (`import type { PlausibilityResult, ... } from './best-effort.types.js'`)
- **Issue:** Task 1's `files` list names only `src/analytics/best-effort-utils.ts` and its test, but the type the task's own `<action>` explicitly instructs to widen ("Widen `PlausibilityResult`'s failing variant to carry `guard`...") is declared in `best-effort.types.ts`. Widening it in place, without touching the declaration file, is not possible — TypeScript has one declaration site for the type.
- **Fix:** Edited `PlausibilityResult` in `best-effort.types.ts`, making `guard` optional rather than required (see Decisions Made) to avoid a second blocking break in `validateStreamSeries`'s six unrelated failure returns in the same file.
- **Files modified:** `src/analytics/best-effort.types.ts` (in addition to the plan's declared `best-effort-utils.ts`/`best-effort-utils.test.ts`)
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run src/analytics/best-effort-utils.test.ts` 36/36 green; the acceptance criterion's own reason-string grep (`git diff HEAD -- src/analytics/best-effort-utils.ts | grep -c "^-.*exceeds..."`) returns 0, confirming neither reason string moved.
- **Committed in:** `7f3cd562` (Task 1 commit)

**Total deviations:** 1 auto-fixed (Rule 3, a plan-scoping gap between the task's own instruction and its declared file list — not a defect in the instruction's intent, which this fix satisfies exactly).

**Impact on plan:** `git diff HEAD --stat` for Task 1's commit therefore lists 3 files, not the 2 the acceptance criteria literally state — the third (`best-effort.types.ts`) is the type's actual declaration site and was unavoidable to satisfy the task's own explicit action.

## Issues Encountered

- Full `npm test` run: 1918 passed / 10 failed. All 10 failures are pre-existing, environment-only gaps confirmed unrelated to any file this plan touches — three `scripts/*.test.mjs` files import from a `dist/analytics/` build output that does not exist in this fresh worktree (`npm run build` was never run here), and the remaining seven fail on `ENOENT` reading gitignored `data/stats/*.json` / `data/dashboard/index.json` documents or a missing `node_modules/chartjs-plugin-zoom` dist file — the same category plans 28-01 and 28-02 already logged in `deferred-items.md`. Logged the plan-03-specific additions there rather than fixed, per the scope boundary rule. In isolation, `npx tsc --noEmit` is clean and `npx vitest run src/analytics/best-effort-ceiling.test.ts src/analytics/best-effort-utils.test.ts` passes 55/55.

## Known Stubs

None — every export is fully implemented against its stated contract; no hardcoded empty/placeholder values were introduced. This plan builds the ceiling module in isolation; wiring it into the compute pipeline is explicitly plan 28-05's job (PR-01's three-pass restructure), not a stub in this plan's own scope.

## Threat Flags

None. All five threats named in this plan's `<threat_model>` (T-28-03-A DoS via a corrupted population, T-28-03-B tampering via a pre-computed ceiling bypassing the signature, T-28-03-C tampering via caller-supplied text in the reason string, T-28-03-D repudiation via an undocumented constant change, T-28-03-SC package-install tampering) are exactly the surfaces this plan's own code touches, each mitigated as specified: `deriveCeiling` sorts a copy and never throws on an empty array; its signature admits only a distance key and a population array; `ceilingDemotion`'s reason is assembled from `toFixed` and fixed literals only, no caller-supplied interpolation; both constants cite `28-CEILING-CALIBRATION.md` by section in their doc comments; and zero packages were installed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `deriveCeiling`/`deriveCeilings`/`ceilingDemotion` are ready for plan 28-05's three-pass restructure to call exactly once per run against Pass 2's already-filtered populations.
- `isPlausible`'s `guard` discriminator plus `ceilingDemotion`'s `guard: 'ceiling'` mean all three absolute/personal guards can now be routed through one shared `EffortDemotion`-producing path without any caller re-matching on reason-string prose.
- `CEILING_K`/`CEILING_MIN_POPULATION` are hard-coded and cited; per Phase 27's D-02 anti-quota rule, no later plan in this phase should adjust either value to hit a target demotion count — a change to either requires a new calibration run of `scripts/compute-pr-ceiling-calibration.mjs` and a corresponding update to `28-CEILING-CALIBRATION.md`, not a hand edit.
- `best-effort.types.ts`'s `PlausibilityResult.guard` is optional; a later plan reading it for `isPlausible`'s results specifically (as opposed to `validateStreamSeries`'s) can safely assume it is always present given `ok: false` from that specific call site, but the type itself does not enforce that per-call-site guarantee — worth a narrower type if a future plan finds this ambiguity load-bearing.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-10*

## Self-Check: PASSED

All created/modified files verified present on disk (`src/analytics/best-effort-ceiling.ts`,
`src/analytics/best-effort-ceiling.test.ts`, `src/analytics/best-effort-utils.ts`,
`src/analytics/best-effort-utils.test.ts`, `src/analytics/best-effort.types.ts`,
`deferred-items.md`, this summary). All three task commits (`7f3cd562`, `504f7c89`, `c25f5256`)
confirmed present in `git log --oneline --all`. No missing items.
