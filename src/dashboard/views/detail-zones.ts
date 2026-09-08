/**
 * Pace-distribution histogram and HR-zone breakdown for the activity detail
 * view (DETAIL-05). Pure, DOM-free module — no `fetch`, no `document`, no
 * `window`. Fetching the committed athlete config is plan 17-07's job; this
 * module only validates and computes over data it is handed.
 *
 * Two independently-gated halves (CONTEXT.md D-29):
 * - `computePaceDistribution` always works for any already-derived pace
 *   result — no configuration required.
 * - `parseAthleteConfig` + `computeHrZoneTimes` are conditional: a valid
 *   committed `data/config/athlete.json` body AND an HR stream must both be
 *   present, or the caller gets `null` and omits the panel entirely (D-31).
 *   `parseAthleteConfig` is the ONE place athlete-config validation lives —
 *   plan 17-07's browser client imports it from here rather than
 *   re-validating.
 *
 * PACE-01/PACE-04: `computePaceDistribution` no longer re-derives pace from
 * raw per-segment `dt/dd` — that was the shipped bug producing a phantom
 * fast cluster the smoothed chart never showed. It is now a thin consumer
 * of `../../analytics/pace-derivation.js`'s `paceHistogramSamples`, bucketing
 * the SAME gap-aware, windowed `paceSeries` the chart reads. Bucket
 * `timeSec` now sums to `derived.coverage.coveredSec` (not the full span);
 * the excluded remainder (`recordingGapSec` + `pauseSec`) is itemised in the
 * `PaceCoverage` returned alongside `derived` by the caller, not dropped
 * silently.
 *
 * `computeHrZoneTimes` is unaffected by this change: it still walks
 * CONSECUTIVE SEGMENTS directly and weights by each segment's real `Δt`,
 * never by sample count — `CanonicalStream.t` is irregularly spaced
 * (17-RESEARCH.md Pitfall 1), so naive per-sample counting silently
 * misweights time.
 */

import type { CanonicalStream } from '../../streams/stream.types.js';
import { paceHistogramSamples, type PaceDerivationResult } from '../../analytics/pace-derivation.js';

/** 17-UI-SPEC § 4e pins 15-second-per-km-wide pace buckets. */
export const PACE_BUCKET_WIDTH_SEC = 15;

export interface PaceBucket {
  minSecPerKm: number;
  maxSecPerKm: number;
  label: string;
  timeSec: number;
}

/**
 * Formats a pace-in-seconds-per-km bucket BOUND as `m:ss` (no `/km` suffix
 * — that is appended once by the caller for the full range label). Rounds
 * to whole seconds in a SINGLE step feeding both the minutes and seconds
 * components — the exact defect class documented on `formatPace` in
 * `list.ts` (deriving `floor(s/60)` and `round(s%60)` independently lets
 * the seconds half roll over to 60 while minutes stays put). Do not import
 * `formatPace` itself: it appends `/km` to a single value and this needs a
 * bare `m:ss` range component.
 */
function formatPaceBound(secPerKm: number): string {
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Δt-weighted pace-distribution histogram, built from an already-derived
 * shared `PaceDerivationResult` (PACE-01, PACE-04) rather than re-deriving
 * pace from raw per-segment `dt/dd` — that recomputation was the shipped
 * bug that let the histogram disagree with the chart. Delegates to
 * `paceHistogramSamples(t, derived.paceSeries)` for the Δt-weighted samples
 * and buckets each sample at `floor(paceSecPerKm / bucketWidthSec)`, summing
 * real `Δt` per bucket so bucket totals sum to `derived.coverage.coveredSec`,
 * never to a sample count. Total function: never throws.
 *
 * Gap-segment masking (found while pinning the exact bucket-sum-equals-
 * coveredSec identity, T-26-07): `derivePaceSeriesGapAware`'s window
 * clipping deliberately leaves the LAST sample before a gap non-null — a
 * shrunk-but-valid trailing window, so the CHART shows a continuous line
 * right up to the gap edge rather than a dropout. But that sample's own
 * FORWARD segment `[t[i], t[i+1]]` *is* the gap itself (`classifyGaps`
 * classifies it `recording-gap` or `pause`, not `covered`). Passing
 * `derived.paceSeries` to `paceHistogramSamples` unmodified therefore
 * attributes the gap's own `Δt` to a covered-looking bucket — a silent
 * re-inclusion of excluded time that breaks the `coveredSec` identity.
 * This function masks any index whose forward segment starts inside a
 * `derived.coverage.gapIntervals` entry to `null` before delegating to
 * `paceHistogramSamples`, so only genuinely `covered` segments are counted
 * — `paceHistogramSamples`'s own Δt-weighting logic is untouched and still
 * the single shared primitive.
 */
export function computePaceDistribution(
  derived: PaceDerivationResult,
  t: readonly number[],
  bucketWidthSec: number = PACE_BUCKET_WIDTH_SEC
): PaceBucket[] {
  const { gapIntervals } = derived.coverage;
  const maskedPaceSeries =
    gapIntervals.length === 0
      ? derived.paceSeries
      : derived.paceSeries.map((pace, i) => {
          if (pace === null) return null;
          const segStart = t[i];
          const inGap = gapIntervals.some((g) => segStart >= g.startSec && segStart < g.endSec);
          return inGap ? null : pace;
        });

  const samples = paceHistogramSamples(t, maskedPaceSeries);

  const bucketTimeSec = new Map<number, number>();

  for (const { paceSecPerKm, timeSec } of samples) {
    const index = Math.floor(paceSecPerKm / bucketWidthSec);
    bucketTimeSec.set(index, (bucketTimeSec.get(index) ?? 0) + timeSec);
  }

  const sortedIndices = [...bucketTimeSec.keys()].sort((a, b) => a - b);

  return sortedIndices.map((index) => {
    const minSecPerKm = index * bucketWidthSec;
    const maxSecPerKm = (index + 1) * bucketWidthSec;
    return {
      minSecPerKm,
      maxSecPerKm,
      label: `${formatPaceBound(minSecPerKm)}–${formatPaceBound(maxSecPerKm)}/km`,
      timeSec: bucketTimeSec.get(index) as number,
    };
  });
}

export interface AthleteHrZone {
  zone: 1 | 2 | 3 | 4 | 5;
  minBpm: number;
  maxBpm: number | null;
}

export interface AthleteConfig {
  schemaVersion: number;
  maxHr: number;
  hrZones: AthleteHrZone[];
}

/** Own-property read only — guards against prototype-pollution reachability (T-17-CFG-01). */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Total, never-throwing, all-or-nothing gate over the parsed JSON body of
 * `data/config/athlete.json`. Any single validation failure returns `null`
 * so the whole zone panel is omitted (D-31) rather than half-rendered with
 * a partially-valid config. Mirrors the tolerant-parse discipline of
 * `buildExclusionIndex` in `best-effort-exclusions.ts`.
 */
export function parseAthleteConfig(raw: unknown): AthleteConfig | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (!hasOwn(obj, 'schemaVersion')) return null;
  const schemaVersion = obj.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) return null;

  if (!hasOwn(obj, 'maxHr')) return null;
  const maxHr = obj.maxHr;
  if (typeof maxHr !== 'number' || !Number.isFinite(maxHr) || maxHr <= 0 || maxHr > 260) return null;

  if (!hasOwn(obj, 'hrZones')) return null;
  const rawZones = obj.hrZones;
  if (!Array.isArray(rawZones) || rawZones.length !== 5) return null;

  const zones: AthleteHrZone[] = [];
  let prevMax: number | null = null;

  for (let i = 0; i < rawZones.length; i++) {
    const rawZone = rawZones[i];
    if (typeof rawZone !== 'object' || rawZone === null || Array.isArray(rawZone)) return null;
    const z = rawZone as Record<string, unknown>;

    const expectedZone = i + 1;
    if (!hasOwn(z, 'zone') || z.zone !== expectedZone) return null;

    if (!hasOwn(z, 'minBpm')) return null;
    const minBpm = z.minBpm;
    if (typeof minBpm !== 'number' || !Number.isFinite(minBpm)) return null;

    if (!hasOwn(z, 'maxBpm')) return null;
    const maxBpmRaw = z.maxBpm;
    const isFinal = i === rawZones.length - 1;

    let maxBpm: number | null;
    if (maxBpmRaw === null) {
      if (!isFinal) return null;
      maxBpm = null;
    } else {
      if (typeof maxBpmRaw !== 'number' || !Number.isFinite(maxBpmRaw)) return null;
      maxBpm = maxBpmRaw;
    }

    if (prevMax !== null && minBpm <= prevMax) return null;
    if (maxBpm !== null && maxBpm <= minBpm) return null;

    zones.push({ zone: expectedZone as 1 | 2 | 3 | 4 | 5, minBpm, maxBpm });
    prevMax = maxBpm;
  }

  return { schemaVersion, maxHr, hrZones: zones };
}

export interface ZoneTime {
  zone: 1 | 2 | 3 | 4 | 5;
  minBpm: number;
  maxBpm: number | null;
  label: string;
  timeSec: number;
  percent: number;
}

/**
 * Finds the zone index (0-based) containing `hrValue`. Values below zone
 * 1's `minBpm` clamp to zone 1; values above the final zone's boundary (or
 * any gap/ordering edge) clamp to the last zone — an HR sample is never
 * dropped or allowed to index outside the fixed 5-entry array (T-17-STR-03).
 * Assumes `zones` is already validated ascending by `parseAthleteConfig`.
 */
function findZoneIndex(hrValue: number, zones: AthleteHrZone[]): number {
  if (hrValue < zones[0].minBpm) return 0;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (hrValue >= z.minBpm && (z.maxBpm === null || hrValue <= z.maxBpm)) return i;
  }
  return zones.length - 1;
}

/**
 * Returns `null` when `config` is null OR when `stream.hr` is absent/empty
 * — the two D-31 absence conditions, surfaced as the same `null` so the
 * caller has one branch to omit the panel. Otherwise walks consecutive
 * segments exactly as `computePaceDistribution` does, attributing each
 * segment's real `Δt` to the zone containing the segment's STARTING HR
 * sample. Always returns all five zones (including zero-time zones) so the
 * panel renders a stable five-bar shape; `percent` is 0 rather than NaN
 * when the total zone time is 0.
 */
export function computeHrZoneTimes(
  stream: CanonicalStream,
  config: AthleteConfig | null
): ZoneTime[] | null {
  if (config === null) return null;

  const hr = stream.hr;
  if (!hr || hr.length === 0) return null;

  const { t } = stream;
  const zones = config.hrZones;
  const zoneTimeSec = [0, 0, 0, 0, 0];

  const n = Math.min(t.length, hr.length);
  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    if (dt <= 0) continue;

    const hrValue = hr[i];
    if (!Number.isFinite(hrValue)) continue;

    const zoneIndex = findZoneIndex(hrValue, zones);
    zoneTimeSec[zoneIndex] += dt;
  }

  const totalZoneTimeSec = zoneTimeSec.reduce((sum, v) => sum + v, 0);

  return zones.map((z, i) => {
    const label =
      z.maxBpm === null
        ? `Zone ${z.zone} (${z.minBpm}+ bpm)`
        : `Zone ${z.zone} (${z.minBpm}–${z.maxBpm} bpm)`;
    return {
      zone: z.zone,
      minBpm: z.minBpm,
      maxBpm: z.maxBpm,
      label,
      timeSec: zoneTimeSec[i],
      percent: totalZoneTimeSec > 0 ? (zoneTimeSec[i] / totalZoneTimeSec) * 100 : 0,
    };
  });
}
