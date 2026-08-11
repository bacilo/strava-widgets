/**
 * Edwards and Banister TRIMP (training impulse) over the committed,
 * decimated `{t[], hr[]}` stream shape (TREND-04, D-14, D-15).
 *
 * Pure, client-safe module — no `fs`, no `fetch`, no DOM. Both models are
 * computed per activity from the HR **stream**, never from `avgHr`, per
 * D-14.
 *
 * Pitfall 2 (18-RESEARCH.md § Common Pitfalls): `CanonicalStream.t` is
 * decimated and irregularly spaced (variable sample intervals), not
 * fixed-Hz. A TRIMP implementation that sums/averages over sample COUNT
 * (e.g. dividing the running total by the number of samples) rather than
 * real elapsed time will silently misweight any activity whose decimation
 * density differs from another's,
 * even at identical duration and intensity. Warning sign: TRIMP that does
 * not scale sensibly with activity duration, or that differs wildly between
 * two runs of similar length/intensity but different decimation density.
 * The fix, mirrored from `detail-charts-logic.ts`'s `derivePaceSeries` and
 * `detail-zones.ts`'s `computeHrZoneTimes`: integrate by the REAL `Δt`
 * between consecutive samples (`t[i + 1] - t[i]`), never by sample count.
 */

import type { AthleteHrZone } from '../dashboard/views/detail-zones.js';
import type { CanonicalStream } from '../streams/stream.types.js';

/**
 * Returns the zone whose `[minBpm, maxBpm]` range contains `hr`.
 * `maxBpm === null` (zone 5, the final entry) is open-ended — any value at
 * or above its floor lands in zone 5. A value below zone 1's floor returns
 * `1` rather than throwing or being dropped: per D-15 the run still
 * happened, and a warm-up sample below the zone floor is not absence of
 * training. Assumes `zones` is ordered ascending by `minBpm` (the shape
 * `parseAthleteConfig` already guarantees).
 */
export function zoneForHr(hr: number, zones: readonly AthleteHrZone[]): 1 | 2 | 3 | 4 | 5 {
  for (const z of zones) {
    if (hr >= z.minBpm && (z.maxBpm === null || hr <= z.maxBpm)) return z.zone;
  }
  return 1;
}

/**
 * Edwards zone-based TRIMP: `Σ over consecutive segments of (Δt_minutes ×
 * zoneWeight)`, where `Δt_minutes = (t[i+1] - t[i]) / 60` and the zone is
 * evaluated at the segment's starting `hr[i]`. See the module header for
 * why this must never become `duration / sampleCount` (Pitfall 2).
 *
 * Total, never-throwing function: segments with a non-positive `Δt` or a
 * non-finite `hr[i]` are skipped; empty arrays, mismatched lengths, or a
 * single sample all return `0`.
 */
export function edwardsTrimp(
  t: readonly number[],
  hr: readonly number[],
  zones: readonly AthleteHrZone[]
): number {
  if (t.length === 0 || hr.length === 0 || t.length !== hr.length) return 0;

  let total = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const deltaMin = (t[i + 1] - t[i]) / 60;
    if (!(deltaMin > 0)) continue;
    const hrValue = hr[i];
    if (!Number.isFinite(hrValue)) continue;
    const zone = zoneForHr(hrValue, zones);
    total += deltaMin * zone;
  }
  return total;
}

/**
 * Banister exponential TRIMP: `Σ (Δt_minutes × HRr × a × e^(b·HRr))`, with
 * `[a, b] = [0.64, 1.92]` for male and `[0.86, 1.67]` for female, and
 * `HRr = clamp((hr[i] - restingHr) / (maxHr - restingHr), 0, 1)`. Same
 * per-segment real-`Δt` discipline as `edwardsTrimp` (Pitfall 2) and the
 * same total/never-throws contract. Returns `0` when
 * `maxHr - restingHr <= 0`.
 */
export function banisterTrimp(
  t: readonly number[],
  hr: readonly number[],
  restingHr: number,
  maxHr: number,
  sex: 'male' | 'female'
): number {
  if (t.length === 0 || hr.length === 0 || t.length !== hr.length) return 0;

  const hrReserve = maxHr - restingHr;
  if (!(hrReserve > 0)) return 0;

  const [a, b] = sex === 'male' ? [0.64, 1.92] : [0.86, 1.67];

  let total = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const deltaMin = (t[i + 1] - t[i]) / 60;
    if (!(deltaMin > 0)) continue;
    const hrValue = hr[i];
    if (!Number.isFinite(hrValue)) continue;
    const hrr = Math.max(0, Math.min(1, (hrValue - restingHr) / hrReserve));
    total += deltaMin * hrr * a * Math.exp(b * hrr);
  }
  return total;
}

export interface ActivityTrimp {
  edwards: number;
  banister: number | null;
  sampleCount: number;
  hrSamplePairs: number;
}

/**
 * Computes both TRIMP models for one activity's stream. Returns `null` when
 * `stream.hr` is absent or empty — D-15: a run with no HR contributes
 * nothing, and the caller records the absence rather than substituting an
 * estimate. `banister` is `null` when `banisterInputs` is `null` (D-14:
 * Edwards must work without any identity input), while `edwards` is still
 * computed.
 */
export function computeActivityTrimp(
  stream: CanonicalStream,
  zones: readonly AthleteHrZone[],
  banisterInputs: { restingHr: number; maxHr: number; sex: 'male' | 'female' } | null
): ActivityTrimp | null {
  const hr = stream.hr;
  if (!hr || hr.length === 0) return null;

  const { t } = stream;
  const hrSamplePairs = Math.min(t.length, hr.length);

  const edwards = edwardsTrimp(t, hr, zones);
  const banister = banisterInputs
    ? banisterTrimp(t, hr, banisterInputs.restingHr, banisterInputs.maxHr, banisterInputs.sex)
    : null;

  return {
    edwards,
    banister,
    sampleCount: stream.sampleCount,
    hrSamplePairs,
  };
}
