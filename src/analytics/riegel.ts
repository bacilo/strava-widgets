/**
 * Riegel race-time prediction (Riegel 1977, textbook exponent b≈1.06) and a
 * guarded log-log OLS fit of a personal exponent from this archive's own PRs
 * (REC-07, D-11). Pure, client-safe: no `fs`, no `fetch`, no DOM. D-21 puts
 * this on the client — it is arithmetic over an already-fetched document
 * with no identity inputs.
 */

import type { PRRankingEntry, TargetDistanceKey } from './best-effort.types.js';
import { TARGET_METERS, TARGET_ORDER } from './best-effort.types.js';

/** Textbook Riegel exponent (Riegel 1977). */
export const RIEGEL_STANDARD_B = 1.06;

/**
 * Predicts a time at `d2M` from a known time `t1Sec` at `d1M`, using the
 * Riegel formula `t2 = t1 * (d2/d1) ** b`. Defaults `b` to the textbook
 * exponent. Total: non-positive or non-finite inputs return `0` rather than
 * `NaN`/`Infinity`, since a table cell must never render a broken value.
 */
export function riegelPredict(
  t1Sec: number,
  d1M: number,
  d2M: number,
  b: number = RIEGEL_STANDARD_B
): number {
  if (!(t1Sec > 0) || !(d1M > 0) || !(d2M > 0) || !Number.isFinite(b)) return 0;
  const predicted = t1Sec * Math.pow(d2M / d1M, b);
  return Number.isFinite(predicted) ? predicted : 0;
}

/** One source point feeding the fitted-exponent regression. */
export interface RiegelFitPoint {
  distance: TargetDistanceKey;
  distanceM: number;
  durationSec: number;
  activityId: string;
}

/** The result of a successful fit. */
export interface RiegelFit {
  b: number;
  distances: TargetDistanceKey[];
  distinctActivities: number;
}

/**
 * Fits a personal Riegel exponent via log-log ordinary least squares over
 * `points`: the slope of `ln(durationSec)` vs `ln(distanceM)` IS the
 * exponent (mathworld.wolfram.com/LeastSquaresFittingLogarithmic.html).
 *
 * THE GUARD COMES FIRST, AND IT IS EVALUATED ON DISTINCT `activityId`
 * VALUES, NEVER ON `points.length`. This archive's road PRs today — 5k
 * (19:39.3), 10k (39:43.9), half (1:26:51.3) — are all splits of ONE run,
 * activity `7827165619` (2022-09-18). A row-counting guard would see three
 * rows and pass; those three rows share a single near-constant pace and
 * would fit a slope near 1.03-1.06, an artifact of one effort's pacing
 * rather than a genuine fatigue curve across independent races. Counting
 * distinct `activityId`s via a `Set` is the only check that actually
 * distinguishes "three races" from "three splits of one race." A future
 * archive state could add more distances that still collapse onto that
 * same activity (or a different one) without ever adding an independent
 * effort — row count would keep silently passing; distinct-activity count
 * would not.
 *
 * Returns `null` when fewer than 3 distinct activities back the points, or
 * when the x-variance denominator is not positive (every point at the same
 * distance — the regression is undefined).
 */
export function fitRiegelExponent(points: readonly RiegelFitPoint[]): RiegelFit | null {
  const distinctActivityIds = new Set(points.map((p) => p.activityId));
  if (distinctActivityIds.size < 3) return null;

  const n = points.length;
  const xs = points.map((p) => Math.log(p.distanceM));
  const ys = points.map((p) => Math.log(p.durationSec));
  const xMean = xs.reduce((sum, v) => sum + v, 0) / n;
  const yMean = ys.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xMean) * (ys[i] - yMean);
    denominator += (xs[i] - xMean) ** 2;
  }
  if (!(denominator > 0)) return null;

  const b = numerator / denominator;
  const distances = TARGET_ORDER.filter((d) => points.some((p) => p.distance === d));

  return { b, distances, distinctActivities: distinctActivityIds.size };
}

/**
 * Selects the fit-point subset for `fitRiegelExponent`: rank-1 entries
 * only, one per distance whose ranking is non-empty. Rank-1 is the
 * smallest defensible subset, and the one the UI can name in a single
 * phrase (D-11 requires the fitted table state which distances backed it).
 */
export function selectFitPoints(
  rankings: Partial<Record<TargetDistanceKey, readonly PRRankingEntry[]>>
): RiegelFitPoint[] {
  const points: RiegelFitPoint[] = [];

  for (const distance of TARGET_ORDER) {
    const entries = rankings[distance];
    if (!entries || entries.length === 0) continue;

    const rankOne = entries.find((e) => e.rank === 1);
    if (!rankOne) continue;

    points.push({
      distance,
      distanceM: TARGET_METERS[distance],
      durationSec: rankOne.durationSec,
      activityId: rankOne.activityId,
    });
  }

  return points;
}

/** One cell in the prediction matrix. */
export interface RiegelCell {
  from: TargetDistanceKey;
  to: TargetDistanceKey;
  predictedSec: number;
  isActual: boolean;
}

/**
 * Builds the full prediction matrix: `rows` are the distances with a
 * non-empty ranking (so a distance with zero PRs, e.g. marathon today, is
 * never a row — there is no rank-1 time to predict *from*). `columns` are
 * always all seven distances in `TARGET_ORDER` (so marathon is still a
 * column — the only place a marathon time appears anywhere in Records is
 * as a Riegel *prediction*, per 18-UI-SPEC § 4b). The diagonal cell (a
 * distance predicting itself) carries the actual rank-1 time with
 * `isActual: true`; every other cell is a Riegel prediction from that
 * row's rank-1 time.
 */
export function buildRiegelMatrix(
  rankings: Partial<Record<TargetDistanceKey, readonly PRRankingEntry[]>>,
  b: number = RIEGEL_STANDARD_B
): { rows: TargetDistanceKey[]; columns: TargetDistanceKey[]; cells: RiegelCell[][] } {
  const rows = TARGET_ORDER.filter((d) => (rankings[d]?.length ?? 0) > 0);
  const columns = [...TARGET_ORDER];

  const cells: RiegelCell[][] = rows.map((fromDistance) => {
    const entries = rankings[fromDistance];
    const rankOne = entries?.find((e) => e.rank === 1);
    const t1Sec = rankOne?.durationSec ?? 0;
    const d1M = TARGET_METERS[fromDistance];

    return columns.map((toDistance): RiegelCell => {
      if (toDistance === fromDistance) {
        return { from: fromDistance, to: toDistance, predictedSec: t1Sec, isActual: true };
      }
      const d2M = TARGET_METERS[toDistance];
      const predictedSec = riegelPredict(t1Sec, d1M, d2M, b);
      return { from: fromDistance, to: toDistance, predictedSec, isActual: false };
    });
  });

  return { rows, columns, cells };
}
