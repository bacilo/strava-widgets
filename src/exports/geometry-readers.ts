import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';

/**
 * Read route geometry out of bulk-export original files.
 *
 * Strava exports hold two kinds of originals: .fit.gz (device recordings —
 * and the format the whole Garmin export will be in) and .gpx (Strava
 * phone-app recordings). Both reduce to the same thing here: an ordered
 * [lat, lng] track.
 */

export interface OriginalRecording {
  coordinates: [number, number][];
  /** Epoch seconds of the recording's start, when the file states one. */
  startEpoch?: number;
}

/** FIT stores coordinates as int32 semicircles; 2^31 semicircles = 180°. */
const SEMICIRCLE = 180 / 2 ** 31;

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

  const coordinates: [number, number][] = [];
  for (const rec of messages.recordMesgs ?? []) {
    if (typeof rec.positionLat === 'number' && typeof rec.positionLong === 'number') {
      coordinates.push([rec.positionLat * SEMICIRCLE, rec.positionLong * SEMICIRCLE]);
    }
  }

  const startTime = messages.sessionMesgs?.[0]?.startTime;
  const startEpoch =
    startTime instanceof Date ? Math.floor(startTime.getTime() / 1000) : undefined;

  return { coordinates, startEpoch };
}

/**
 * Extract the track from a GPX file.
 *
 * Strava-generated GPX is regular enough that targeted matching beats a full
 * XML dependency: every point is a <trkpt lat="..." lon="..."> element.
 */
export async function readGpx(filePath: string): Promise<OriginalRecording> {
  const text = fs.readFileSync(filePath, 'utf-8');

  const coordinates: [number, number][] = [];
  const pointPattern = /<trkpt\s+lat="(-?[\d.]+)"\s+lon="(-?[\d.]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pointPattern.exec(text)) !== null) {
    coordinates.push([parseFloat(match[1]), parseFloat(match[2])]);
  }

  const timeMatch = text.match(/<trkpt[^>]*>[\s\S]*?<time>([^<]+)<\/time>/);
  const startEpoch = timeMatch
    ? Math.floor(new Date(timeMatch[1]).getTime() / 1000)
    : undefined;

  return { coordinates, startEpoch };
}

/** Dispatch on file extension. */
export async function readOriginal(filePath: string): Promise<OriginalRecording> {
  if (/\.fit(\.gz)?$/.test(filePath)) return readFit(filePath);
  if (/\.gpx(\.gz)?$/.test(filePath)) {
    if (filePath.endsWith('.gz')) {
      throw new Error(`gzipped gpx not implemented: ${filePath}`);
    }
    return readGpx(filePath);
  }
  throw new Error(`unsupported original format: ${filePath}`);
}
