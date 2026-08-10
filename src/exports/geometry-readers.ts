import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';

import type { RawSample } from '../streams/stream.types.js';

/**
 * Read route geometry out of bulk-export original files.
 *
 * Strava exports hold two kinds of originals: .fit.gz (device recordings —
 * and the format the whole Garmin export will be in) and .gpx (Strava
 * phone-app recordings). Both reduce to the same thing here: an ordered
 * [lat, lng] track, plus (as of this extension) the multi-channel raw
 * samples every stream-ingestion producer needs.
 */

export interface OriginalRecording {
  coordinates: [number, number][];
  /** Epoch seconds of the recording's start, when the file states one. */
  startEpoch?: number;
  /** Per-record raw samples (time, distance, hr, cadence, altitude, position). */
  samples: RawSample[];
}

/** FIT stores coordinates as int32 semicircles; 2^31 semicircles = 180°. */
const SEMICIRCLE = 180 / 2 ** 31;

/**
 * Pure transform: FIT SDK record messages -> RawSample[].
 *
 * Exported so it is testable without a real FIT file (`export_data/` is
 * gitignored and absent from CI). Every field is guarded with
 * `typeof === 'number'` and omitted (not defaulted) on failure. Cadence is
 * emitted RAW and undoubled — the x2 normalization to steps-per-minute
 * belongs exclusively to `derive-stream.ts`.
 */
export function fitRecordsToSamples(records: unknown[]): RawSample[] {
  const samples: RawSample[] = [];

  for (const raw of records) {
    const rec = raw as Record<string, unknown>;
    const timestamp = rec.timestamp;
    if (!(timestamp instanceof Date)) continue;

    const sample: RawSample = { tEpochS: Math.floor(timestamp.getTime() / 1000) };

    if (typeof rec.distance === 'number') sample.distanceM = rec.distance;
    if (typeof rec.heartRate === 'number') sample.hr = rec.heartRate;
    if (typeof rec.cadence === 'number') {
      sample.cadenceRawRpm = rec.cadence;
      if (typeof rec.fractionalCadence === 'number') {
        sample.fractionalCadence = rec.fractionalCadence;
      }
    }

    const altM =
      typeof rec.enhancedAltitude === 'number'
        ? rec.enhancedAltitude
        : typeof rec.altitude === 'number'
          ? rec.altitude
          : undefined;
    if (altM !== undefined) sample.altM = altM;

    if (typeof rec.positionLat === 'number' && typeof rec.positionLong === 'number') {
      sample.lat = rec.positionLat * SEMICIRCLE;
      sample.lng = rec.positionLong * SEMICIRCLE;
    }

    samples.push(sample);
  }

  return samples;
}

/** Decode a FIT file (gzipped or not) via Garmin's official SDK. */
export async function readFit(filePath: string): Promise<OriginalRecording> {
  const { Decoder, Stream } = await import('@garmin/fitsdk');

  let buf = fs.readFileSync(filePath);
  if (filePath.endsWith('.gz')) buf = gunzipSync(buf);

  const decoder = new Decoder(Stream.fromBuffer(buf));
  if (!decoder.isFIT()) throw new Error(`not a FIT file: ${filePath}`);

  const { messages, errors } = decoder.read();
  if (errors.length > 0) {
    // Partial decodes still carry usable records; only warn.
    console.warn(`  FIT decode warnings for ${filePath}: ${errors.length}`);
  }

  const samples = fitRecordsToSamples(messages.recordMesgs ?? []);

  const coordinates: [number, number][] = [];
  for (const sample of samples) {
    if (typeof sample.lat === 'number' && typeof sample.lng === 'number') {
      coordinates.push([sample.lat, sample.lng]);
    }
  }

  const startTime = messages.sessionMesgs?.[0]?.startTime;
  const startEpoch =
    startTime instanceof Date ? Math.floor(startTime.getTime() / 1000) : undefined;

  return { coordinates, startEpoch, samples };
}

/**
 * Extract the track from GPX text.
 *
 * Strava-generated GPX is regular enough that targeted matching beats a full
 * XML dependency: every point is a <trkpt lat="..." lon="...">...</trkpt>
 * (or self-closing <trkpt lat="..." lon="..." />) element. Archive GPX
 * carries no HR/cadence/distance extensions (RESEARCH.md Pitfall 2 — 0/38
 * files sampled had them), so only time/ele are extracted per point.
 */
export function readGpxText(text: string): OriginalRecording {
  const trkptPattern = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;

  const points: { lat: number; lng: number; time?: number; ele?: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = trkptPattern.exec(text)) !== null) {
    const attrs = match[1];
    const body = match[2] ?? '';

    const latMatch = attrs.match(/lat="(-?[\d.]+)"/);
    const lonMatch = attrs.match(/lon="(-?[\d.]+)"/);
    if (!latMatch || !lonMatch) continue;

    const lat = parseFloat(latMatch[1]);
    const lng = parseFloat(lonMatch[1]);

    const timeMatch = body.match(/<time>([^<]+)<\/time>/);
    const eleMatch = body.match(/<ele>([^<]+)<\/ele>/);

    const time = timeMatch ? Math.floor(new Date(timeMatch[1]).getTime() / 1000) : undefined;
    const ele = eleMatch ? parseFloat(eleMatch[1]) : undefined;

    points.push({ lat, lng, time, ele });
  }

  const coordinates: [number, number][] = points.map(p => [p.lat, p.lng]);

  const firstTime = points.find(p => p.time !== undefined)?.time;

  const samples: RawSample[] = [];
  if (firstTime !== undefined) {
    points.forEach((p, index) => {
      const tEpochS = p.time ?? firstTime + index;
      const sample: RawSample = { tEpochS, lat: p.lat, lng: p.lng };
      if (p.ele !== undefined) sample.altM = p.ele;
      samples.push(sample);
    });
  }

  const startEpoch = samples[0]?.tEpochS;

  return { coordinates, startEpoch, samples };
}

/** Read and parse a GPX file from disk. */
export async function readGpx(filePath: string): Promise<OriginalRecording> {
  const text = fs.readFileSync(filePath, 'utf-8');
  return readGpxText(text);
}

/** Dispatch on file extension. */
export async function readOriginal(filePath: string): Promise<OriginalRecording> {
  if (/\.fit(\.gz)?$/.test(filePath)) return readFit(filePath);
  if (/\.gpx(\.gz)?$/.test(filePath)) {
    if (filePath.endsWith('.gz')) {
      const text = gunzipSync(fs.readFileSync(filePath)).toString('utf-8');
      return readGpxText(text);
    }
    return readGpx(filePath);
  }
  throw new Error(`unsupported original format: ${filePath}`);
}
