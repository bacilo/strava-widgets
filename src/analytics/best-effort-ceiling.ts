/**
 * The pure personal plausibility ceiling (Phase 28 PR-01/PR-02, D-01/D-02).
 *
 * Three contracts this module obeys absolutely:
 *
 * 1. PURE. No `fs`, no `path`, no other Node builtin, no `process` access.
 *    This module is reachable from the dashboard through the types it
 *    names, so it carries Phase 26 D-15's purity rule into the browser
 *    bundle without exception.
 * 2. ONE ALL-TIME VALUE PER DISTANCE. No date parameter and no window
 *    parameter exists anywhere on this module's surface (D-05) — a ceiling
 *    is derived once from a population and never re-windowed by calendar
 *    time.
 * 3. CALLED EXACTLY ONCE PER RUN. Pass 2 derives every distance's ceiling a
 *    single time and never re-runs after a demotion (PR-01's no-iteration
 *    clause); plan 28-05 enforces this at the call site with a source
 *    guard. Nothing in this module loops back on its own output — there is
 *    no recursion and no `while` anywhere below.
 */

import type {
  CeilingDerivation,
  EffortDemotion,
  TargetDistanceKey,
} from './best-effort.types.js';
import { TARGET_ORDER } from './best-effort.types.js';

/**
 * The ceiling multiplier applied to a distance's own bulk (p90) to derive
 * its personal plausibility ceiling: `ceiling = CEILING_K * p90`.
 *
 * Measured, not chosen: `CEILING_K` is the largest observed `max / p90`
 * ratio among the mechanism-clean, floor-eligible distances (target
 * distances of at least 5,000 m, where a single aliased distance-advance
 * sample cannot materially inflate the ratio the way it can at 400m/1k/1mi).
 * Recorded in `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md`,
 * section "Chosen constants": the argmax distance is **10k**, whose own
 * `max` = 4.1948 m/s and `p90` = 3.2997 m/s (ratio 1.2713), rounded UP to
 * 1.28 so the derivation can only ever admit more of the argmax distance's
 * own maximum, never demote more of it. Per section "Per-distance
 * distributions" in the same artifact.
 *
 * Phase 27's D-02 anti-quota rule forbids moving this value to change a
 * demotion count — `CEILING_K` is fixed by measurement alone and takes no
 * demotion-count argument, structurally, not by promise.
 */
export const CEILING_K = 1.28;

/**
 * The minimum population size a distance must have before a personal
 * ceiling is derived for it at all. Below this floor the distance fails
 * open (D-02) rather than deriving a ceiling from too few observations.
 *
 * Measured, not chosen: `CEILING_MIN_POPULATION` is the smallest integer
 * `n` such that `n - Math.ceil(0.90 * n) >= 10` — the smallest population
 * at which at least ten observations lie strictly above the p90 order
 * statistic, so a single contaminated point above the boundary is a
 * bounded minority of the points it would have to out-vote. Recorded in
 * `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md`,
 * section "Chosen constants": that integer is **100**.
 *
 * Phase 27's D-02 anti-quota rule forbids moving this value to change a
 * demotion count — `CEILING_MIN_POPULATION` is fixed by order-statistic
 * arithmetic alone and takes no demotion-count argument, structurally, not
 * by promise.
 */
export const CEILING_MIN_POPULATION = 100;

/**
 * Interpolation-free (nearest-rank) percentile: returns the element at
 * index `Math.ceil(fraction * n) - 1` of a pre-sorted ascending array,
 * clamped into `[0, n - 1]`. Returns `null` for an empty array.
 *
 * Interpolation is deliberately forbidden here — the returned value must
 * be an OBSERVED data point from the population, never a value synthesised
 * between two observed points, so it cannot move under floating-point
 * tie-breaks. This is what makes PR-01's byte-reproducibility claim true:
 * two runs over the same population, regardless of input order, return the
 * exact same p90.
 */
export function percentileNearestRank(
  sortedAscending: readonly number[],
  fraction: number
): number | null {
  const n = sortedAscending.length;
  if (n === 0) return null;

  const rawIndex = Math.ceil(fraction * n) - 1;
  const clampedIndex = Math.min(Math.max(rawIndex, 0), n - 1);
  return sortedAscending[clampedIndex];
}

/**
 * Derives one target distance's personal plausibility ceiling from its
 * already-filtered population of implied speeds. Takes no parameter beyond
 * the distance key and the population itself — no options object, no date,
 * no window, no maximum — so PR-02's non-circularity (a ceiling cannot be
 * computed from anything the ceiling itself would reject) is enforced by
 * this function's signature, not by convention.
 *
 * Sorts a COPY of `populationSpeedsMps` ascending; the caller's array is
 * never mutated.
 *
 * Below `CEILING_MIN_POPULATION`, returns the D-02 fail-open shape:
 * `p90Mps: null`, `ceilingMps: null`, and a `failOpenReason` naming both
 * the actual population and the minimum. This is an honest auditable
 * state, not a failure — the distance stays exactly as guarded as it is
 * today (world-record and max_speed only), never failed closed.
 *
 * At or above the floor, `p90Mps` is the interpolation-free 90th
 * percentile and `ceilingMps` is `CEILING_K * p90Mps`, rounded UP to four
 * decimal places. The upward rounding is direction-safe: it can only admit
 * a borderline effort, never demote one that a floating-point-exact
 * multiplication would have admitted, and it is what keeps the argmax
 * distance's own measured maximum inside its own ceiling.
 */
export function deriveCeiling(
  distance: TargetDistanceKey,
  populationSpeedsMps: readonly number[]
): CeilingDerivation {
  const populationN = populationSpeedsMps.length;

  if (populationN < CEILING_MIN_POPULATION) {
    return {
      distance,
      populationN,
      p90Mps: null,
      multiplier: CEILING_K,
      ceilingMps: null,
      failOpenReason: `population ${populationN} below minimum ${CEILING_MIN_POPULATION} — no personal ceiling derived; world-record and max_speed guards still apply`,
    };
  }

  const sorted = [...populationSpeedsMps].sort((a, b) => a - b);
  // Non-null: populationN >= CEILING_MIN_POPULATION > 0, so `sorted` is
  // guaranteed non-empty and percentileNearestRank cannot return null here.
  const p90Mps = percentileNearestRank(sorted, 0.9)!;
  const ceilingMps = Math.ceil(CEILING_K * p90Mps * 1e4) / 1e4;

  return {
    distance,
    populationN,
    p90Mps,
    multiplier: CEILING_K,
    ceilingMps,
    failOpenReason: null,
  };
}

/**
 * Derives every target distance's ceiling in one pass, iterating
 * `TARGET_ORDER` and calling `deriveCeiling` exactly once per distance. A
 * distance absent from `populationsByDistance` is treated as an empty
 * population (and so comes back fail-open, never `undefined`). No loop
 * here calls itself again, no `while`, no recursion — Pass 2 runs once.
 */
export function deriveCeilings(
  populationsByDistance: ReadonlyMap<TargetDistanceKey, readonly number[]>
): Record<TargetDistanceKey, CeilingDerivation> {
  const result = {} as Record<TargetDistanceKey, CeilingDerivation>;

  for (const distance of TARGET_ORDER) {
    const population = populationsByDistance.get(distance) ?? [];
    result[distance] = deriveCeiling(distance, population);
  }

  return result;
}

/**
 * Rejects an effort whose implied speed strictly exceeds its distance's
 * derived personal ceiling. Returns `null` when the derivation is
 * fail-open (`ceilingMps: null` — D-02's honest "no personal ceiling
 * exists here" state binds no effort) or when `impliedSpeedMps` does not
 * STRICTLY exceed `ceilingMps` (an effort exactly at the ceiling is
 * admitted, not demoted).
 *
 * The reason string follows the house register `isPlausible` already
 * established (a named condition with its measured numbers, never an
 * adjective — Phase 27 D-09): the implied speed, the words `exceeds
 * personal ceiling`, the ceiling value, an explicit `by <margin> m/s`
 * clause, then a parenthetical giving the multiplier, `p90`, the p90 value
 * and the population size with the distance key. Implied speed, ceiling
 * and p90 all render at three decimals; the multiplier stays at two (D-10).
 * The margin is stated explicitly because at two decimals the sentence
 * could read as self-contradictory — the live `3475730418@1mi` case
 * renders "implied 4.63 m/s exceeds personal ceiling 4.63 m/s" at 2dp,
 * even though a real 0.002 m/s margin exists. For example, at the live 1mi
 * ceiling of 4.628 m/s derived from 1,851 filtered efforts with p90
 * 3.616 m/s and multiplier 1.28: `implied 4.630 m/s exceeds personal
 * ceiling 4.628 m/s by 0.002 m/s (1.28 x p90 3.616 m/s over 1851 filtered
 * 1mi efforts)`.
 *
 * WR-01 (Phase 31): a margin below 0.0005 m/s rounds to `0.000` at three
 * decimals, which self-contradicts the sentence's own "exceeds" claim (and
 * at the live archive's 0.1s duration resolution, that band is reachable
 * with ordinary inputs). Since a margin is only ever rendered once the
 * strict `>` guard above has already confirmed it is positive, `0.000`
 * would always be a rounding artefact, never a true value — so the margin
 * clause renders the sub-resolution case explicitly as `<0.001` rather
 * than ever printing three zero digits. Today's live archive has no
 * ceiling margin below 0.002 m/s, so this branch does not change any
 * shipped reason string; it exists to keep a future thin-margin activity
 * honest.
 */
export function ceilingDemotion(
  impliedSpeedMps: number,
  derivation: CeilingDerivation
): EffortDemotion | null {
  if (derivation.ceilingMps === null) return null;
  if (!(impliedSpeedMps > derivation.ceilingMps)) return null;

  // Non-null: ceilingMps is only ever set alongside p90Mps in deriveCeiling.
  const p90Mps = derivation.p90Mps!;
  const margin = impliedSpeedMps - derivation.ceilingMps;
  // WR-01: never render a margin that rounds to "0.000" — state the
  // sub-resolution case explicitly instead of letting toFixed(3) produce a
  // self-contradictory sentence for a strictly-positive margin.
  const marginText = margin < 0.0005 ? '<0.001' : margin.toFixed(3);

  return {
    guard: 'ceiling',
    reason: `implied ${impliedSpeedMps.toFixed(3)} m/s exceeds personal ceiling ${derivation.ceilingMps.toFixed(3)} m/s by ${marginText} m/s (${derivation.multiplier.toFixed(2)} x p90 ${p90Mps.toFixed(3)} m/s over ${derivation.populationN} filtered ${derivation.distance} efforts)`,
  };
}
