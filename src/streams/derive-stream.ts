import { IntervalsProvider } from '../api/intervals-provider.js';
import {
  STREAM_SCHEMA_VERSION,
  type CanonicalStream,
  type DistanceSource,
  type RawSample,
  type StreamChannels,
  type StreamSource,
} from './stream.types.js';

/**
 * The single pure normalization seam every write path to `data/streams/`
 * funnels through — the FIT/GPX backfill, the daily intervals.icu sync, and
 * the intervals-only reconciliation pass all call one of the two exports
 * below, which converge on `normalize()`. This module does no I/O: callers
 * decode files or fetch API responses and pass the result in.
 */

/** Bounds constants — exported so tests can reference them directly. */
export const HR_MIN = 20;
export const HR_MAX = 250;
export const CADENCE_RAW_MAX = 150;
export const ALT_MIN = -500;
export const ALT_MAX = 9000;

const MAX_SAMPLES = 3000;
/** D-01's ~1-3s decimation band, tried in order until the ceiling is met. */
const DECIMATION_LADDER = [1, 2, 3];

const EARTH_RADIUS_M = 6371000;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function inBounds(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Fill gaps in a per-channel value series by carrying the last valid value
 * forward; a leading gap (before any valid value) takes the first valid
 * value. Keeps parallel arrays index-aligned and ensures no `null`/gap ever
 * reaches a committed array (D-01's "strip nulls").
 */
function carryForward(values: (number | undefined)[]): number[] {
  const firstValidIndex = values.findIndex(v => v !== undefined);
  if (firstValidIndex === -1) return values.map(() => 0);

  let last = values[firstValidIndex] as number;
  return values.map(v => {
    if (v !== undefined) {
      last = v;
      return v;
    }
    return last;
  });
}

/** Pick indices to keep at a given minimum spacing; always keeps first + last. */
function decimationIndices(t: number[], minIntervalS: number): number[] {
  const indices = new Set<number>([0]);
  let lastKeptT = t[0];
  for (let i = 1; i < t.length - 1; i++) {
    if (t[i] - lastKeptT >= minIntervalS) {
      indices.add(i);
      lastKeptT = t[i];
    }
  }
  indices.add(t.length - 1);
  return Array.from(indices).sort((a, b) => a - b);
}

interface KeptSample {
  t: number;
  sample: RawSample;
}

/**
 * The shared internal normalizer both entry points below call. Deterministic
 * and independently testable via the two public functions.
 */
function normalize(id: string, samples: RawSample[], source: StreamSource): CanonicalStream | null {
  if (samples.length === 0) return null;

  // Rule 2: time — relative to the first sample; drop out-of-order records.
  const t0 = samples[0].tEpochS;
  const kept: KeptSample[] = [];
  let lastKeptT = -Infinity;
  for (const sample of samples) {
    const t = Math.round(sample.tEpochS - t0);
    if (t < lastKeptT) continue;
    kept.push({ t, sample });
    lastKeptT = t;
  }

  if (kept.length < 2) return null;

  // Rule 3: distance — native cumulative series preferred, geo (haversine)
  // fallback when no distance field exists at all.
  const hasNativeDistance = kept.some(k => typeof k.sample.distanceM === 'number' && Number.isFinite(k.sample.distanceM));

  let distanceSource: DistanceSource;
  let dRaw: number[];

  if (hasNativeDistance) {
    distanceSource = 'native';
    const rawValues = kept.map(k =>
      typeof k.sample.distanceM === 'number' && Number.isFinite(k.sample.distanceM)
        ? k.sample.distanceM
        : undefined
    );
    dRaw = carryForward(rawValues);
  } else {
    const hasLatLng = kept.some(k => typeof k.sample.lat === 'number' && typeof k.sample.lng === 'number');
    if (!hasLatLng) return null;

    distanceSource = 'geo';
    dRaw = [];
    let cumulative = 0;
    let prev: { lat: number; lng: number } | undefined;
    for (const k of kept) {
      const { lat, lng } = k.sample;
      if (typeof lat === 'number' && typeof lng === 'number') {
        if (prev) cumulative += haversineMeters(prev.lat, prev.lng, lat, lng);
        prev = { lat, lng };
      }
      dRaw.push(cumulative);
    }
  }

  // Clamp non-decreasing (cumulative max) and round to 0.1m.
  let runningMax = -Infinity;
  const d = dRaw.map(v => {
    runningMax = Math.max(runningMax, v);
    return round1(runningMax);
  });

  // Rules 4-6: hr, cadence, alt — bounds-check, then carry-forward fill only
  // if the channel is present at all.
  const hrRaw = kept.map(k => inBounds(k.sample.hr, HR_MIN, HR_MAX));
  const altRaw = kept.map(k => inBounds(k.sample.altM, ALT_MIN, ALT_MAX));
  const cadenceRaw = kept.map(k => {
    const raw = k.sample.cadenceRawRpm;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > CADENCE_RAW_MAX) {
      return undefined;
    }
    if (source === 'intervals') {
      // Pitfall 1: intervals.icu interleaves 0 as a pause/dropout marker, not
      // a real zero-cadence sample.
      if (raw === 0) return undefined;
      return round1(raw * 2);
    }
    // FIT/GPX: raw half-cadence retains 0.5-step precision via fractionalCadence.
    return round1(2 * (raw + (k.sample.fractionalCadence ?? 0)));
  });

  const hrPresent = hrRaw.some(v => v !== undefined);
  const cadencePresent = cadenceRaw.some(v => v !== undefined);
  const altPresent = altRaw.some(v => v !== undefined);

  const hrFilled = hrPresent ? carryForward(hrRaw).map(v => Math.round(v)) : undefined;
  const cadenceFilled = cadencePresent ? carryForward(cadenceRaw) : undefined;
  const altFilled = altPresent ? carryForward(altRaw) : undefined;

  // Rule 7: decimation ladder — light only, never a total-bytes budget.
  const t = kept.map(k => k.t);
  let indices = decimationIndices(t, DECIMATION_LADDER[0]);
  for (const minIntervalS of DECIMATION_LADDER) {
    const candidate = decimationIndices(t, minIntervalS);
    indices = candidate;
    if (candidate.length <= MAX_SAMPLES) break;
  }

  const finalT = indices.map(i => t[i]);
  const finalD = indices.map(i => d[i]);
  const finalHr = hrFilled ? indices.map(i => hrFilled[i]) : undefined;
  const finalCadence = cadenceFilled ? indices.map(i => cadenceFilled[i]) : undefined;
  const finalAlt = altFilled ? indices.map(i => altFilled[i]) : undefined;

  const channels: StreamChannels = {
    time: true,
    distance: true,
    hr: hrPresent,
    cadence: cadencePresent,
    elevation: altPresent,
  };

  const result: CanonicalStream = {
    schemaVersion: STREAM_SCHEMA_VERSION,
    id,
    source,
    distanceSource,
    sampleCount: finalT.length,
    channels,
    t: finalT,
    d: finalD,
  };
  if (finalHr) result.hr = finalHr;
  if (finalCadence) result.cadence = finalCadence;
  if (finalAlt) result.alt = finalAlt;

  return result;
}

/** Used by the FIT and GPX backfill paths. */
export function deriveFromSamples(id: string, samples: RawSample[], source: StreamSource): CanonicalStream | null {
  return normalize(id, samples, source);
}

/** Find a named stream's data series, handling both container shapes intervals.icu returns. */
function seriesFor(streams: unknown, names: string[]): unknown[] | undefined {
  const asArray = Array.isArray(streams) ? (streams as Record<string, unknown>[]) : undefined;
  const asObject =
    !Array.isArray(streams) && typeof streams === 'object' && streams !== null
      ? (streams as Record<string, unknown>)
      : undefined;

  for (const name of names) {
    if (asArray) {
      const hit = asArray.find(s => s.type === name || s.name === name);
      const data = (hit?.data ?? hit?.values) as unknown;
      if (Array.isArray(data)) return data;
    }
    if (asObject) {
      const entry = asObject[name];
      if (Array.isArray(entry)) return entry;
      if (entry && typeof entry === 'object') {
        const data = ((entry as Record<string, unknown>).data ??
          (entry as Record<string, unknown>).values) as unknown;
        if (Array.isArray(data)) return data;
      }
    }
  }
  return undefined;
}

/**
 * Convert a loosely-typed intervals.icu streams response into RawSample[].
 * Reuses IntervalsProvider.extractCoordinates for the geo-distance fallback
 * rather than re-implementing the data/data2 parallel-array quirk.
 */
function intervalsStreamsToSamples(streams: unknown): RawSample[] | undefined {
  const timeSeries = seriesFor(streams, ['time']);
  const distanceSeries = seriesFor(streams, ['distance']);
  const hrSeries = seriesFor(streams, ['heartrate', 'hr']);
  const cadenceSeries = seriesFor(streams, ['cadence']);
  const altSeries = seriesFor(streams, ['altitude', 'elevation', 'ele']);
  const coordinates = IntervalsProvider.extractCoordinates(streams);

  const lengths = [
    timeSeries?.length,
    distanceSeries?.length,
    hrSeries?.length,
    cadenceSeries?.length,
    altSeries?.length,
    coordinates.length,
  ].filter((n): n is number => typeof n === 'number' && n > 0);

  if (lengths.length === 0) return undefined;
  const n = Math.max(...lengths);

  const samples: RawSample[] = [];
  for (let i = 0; i < n; i++) {
    // No time stream: fall back to sample index, matching intervals.icu's
    // fixed-rate stream convention.
    const tEpochS = typeof timeSeries?.[i] === 'number' ? (timeSeries[i] as number) : i;
    const distanceM = typeof distanceSeries?.[i] === 'number' ? (distanceSeries[i] as number) : undefined;
    const hr = typeof hrSeries?.[i] === 'number' ? (hrSeries[i] as number) : undefined;
    const cadenceRawRpm = typeof cadenceSeries?.[i] === 'number' ? (cadenceSeries[i] as number) : undefined;
    const altM = typeof altSeries?.[i] === 'number' ? (altSeries[i] as number) : undefined;
    const coord = coordinates[i];

    samples.push({
      tEpochS,
      distanceM,
      hr,
      cadenceRawRpm,
      altM,
      lat: coord?.[0],
      lng: coord?.[1],
    });
  }
  return samples;
}

/** Used by the daily sync and the intervals-only reconciliation branch. */
export function deriveFromIntervalsStreams(id: string, streams: unknown): CanonicalStream | null {
  const samples = intervalsStreamsToSamples(streams);
  if (!samples) return null;
  return normalize(id, samples, 'intervals');
}
