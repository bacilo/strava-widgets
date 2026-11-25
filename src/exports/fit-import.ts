import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import polyline from '@mapbox/polyline';

import { IntervalsProvider } from '../api/intervals-provider.js';
import { FileStore } from '../storage/file-store.js';
import { deriveFromSamples } from '../streams/derive-stream.js';
import {
  loadManifest,
  saveManifest,
  upsertAvailable,
  upsertUnavailable,
} from '../streams/stream-manifest.js';
import type { StravaActivity } from '../types/strava.types.js';
import { fitRecordsToSamples } from './geometry-readers.js';
import { NEAR_MATCH_TOLERANCE_S } from './reconcile.js';

/**
 * Import ONE original FIT file into the archive (ING-03).
 *
 * Every directory is a required option with no default, so a test can never
 * reach the real data/ tree by omission. The dedupe key is the FIT session's
 * start time (the same epoch key IntervalsSync uses), never the file-id
 * creation time, which can sit a couple of seconds away from it.
 *
 * Everything ambiguous is refused with a thrown error BEFORE the first write.
 */

export const MAX_FIT_BYTES = 50 * 1024 * 1024;

/** Seconds between the Unix epoch and the FIT epoch (1989-12-31T00:00:00Z). */
const FIT_EPOCH_OFFSET_S = 631065600;

export type FitImportResult =
  | { status: 'imported'; id: string; startDate: string; streamSampleCount: number | null }
  | { status: 'duplicate'; existingId: string; startDate: string };

export interface FitImportOptions {
  fitPath: string;
  garminId: string;
  source: string;
  exportRoot: string;
  activitiesDir: string;
  streamsDir: string;
  manifestPath: string;
  provenancePath: string;
  name?: string;
}

type Mesg = Record<string, unknown>;

interface DecodedMessages {
  sessionMesgs?: Mesg[];
  recordMesgs?: Mesg[];
  activityMesgs?: Mesg[];
  deviceInfoMesgs?: Mesg[];
}

function toUnixSeconds(value: unknown): number | undefined {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  return undefined;
}

/** Pure mapper: decoded FIT messages plus identity fields -> canonical record. */
export function fitSessionToActivity(
  messages: DecodedMessages,
  ctx: { garminId: string; name?: string; original: string; externalId: string }
): StravaActivity {
  const session = (messages.sessionMesgs ?? [])[0] ?? {};
  const startTime = session.startTime as Date;
  const epoch = Math.floor(startTime.getTime() / 1000);
  const startDate = startTime.toISOString().replace('.000Z', 'Z');

  let startDateLocal = startDate.replace(/Z$/, '');
  const activityMesg = (messages.activityMesgs ?? [])[0];
  if (activityMesg) {
    const local = activityMesg.localTimestamp;
    const ts = toUnixSeconds(activityMesg.timestamp);
    let unixLocal: number | undefined;
    if (typeof local === 'number') unixLocal = local + FIT_EPOCH_OFFSET_S;
    else if (local instanceof Date) unixLocal = Math.floor(local.getTime() / 1000);
    if (unixLocal !== undefined && ts !== undefined) {
      const offset = unixLocal - ts;
      startDateLocal = new Date((epoch + offset) * 1000).toISOString().slice(0, 19);
    }
  }

  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  const distance = num(session.totalDistance) ?? 0;
  const movingTime = Math.round(num(session.totalTimerTime) ?? 0);
  const elapsedTime = Math.round(num(session.totalElapsedTime) ?? 0);

  const activity: StravaActivity = {
    id: Number(ctx.garminId),
    name: ctx.name ?? 'Run',
    type: 'Run',
    start_date: startDate,
    start_date_local: startDateLocal,
    distance,
    moving_time: movingTime,
    elapsed_time: elapsedTime,
    total_elevation_gain: num(session.totalAscent) ?? 0,
    average_speed:
      num(session.enhancedAvgSpeed) ??
      num(session.avgSpeed) ??
      (movingTime > 0 ? distance / movingTime : 0),
    max_speed: num(session.enhancedMaxSpeed) ?? num(session.maxSpeed) ?? 0,
    average_heartrate: num(session.avgHeartRate),
    max_heartrate: num(session.maxHeartRate),
    map: { summary_polyline: '' },
    source_provider: 'garmin-export',
    garmin_activity_id: ctx.garminId,
    external_id: ctx.externalId,
    original_file: ctx.original,
    field_origin: 'fit-session',
  };

  for (const info of messages.deviceInfoMesgs ?? []) {
    if (info.deviceIndex === 'creator' || info.deviceIndex === 0) {
      if (typeof info.productName === 'string' && info.productName.length > 0) {
        activity.device_name = info.productName;
        break;
      }
    }
  }

  return activity;
}

function realpathOrThrow(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    throw new Error(`outside export root: cannot resolve ${p}`);
  }
}

export async function importFit(opts: FitImportOptions): Promise<FitImportResult> {
  // 1. Identity fields.
  if (!/^\d{1,20}$/.test(opts.garminId)) {
    throw new Error(`invalid garmin id: ${JSON.stringify(opts.garminId)}`);
  }
  if (!/^[a-z]+$/.test(opts.source)) {
    throw new Error(`invalid source: ${JSON.stringify(opts.source)}`);
  }
  const id = opts.garminId;

  // 2. Path containment.
  const sourceRoot = realpathOrThrow(path.join(opts.exportRoot, opts.source));
  const resolvedFit = realpathOrThrow(path.resolve(opts.fitPath));
  if (!resolvedFit.startsWith(sourceRoot + path.sep)) {
    throw new Error(`outside export root: ${opts.fitPath}`);
  }

  // 2b. Account-identifier refusal (CR-01). Garmin bulk exports name uploaded
  // FIT files `<account-email>_<n>.fit`, and the relative path becomes the
  // public `original_file` / provenance `original`. Refuse any '@' in either
  // the path as given or the resolved path (a neutral symlink can point at an
  // email-named file), before anything is read or written.
  const rel = path
    .relative(sourceRoot, resolvedFit)
    .split(path.sep)
    .join('/');
  if (opts.fitPath.includes('@') || rel.includes('@')) {
    throw new Error(
      'refusing: FIT path contains an account identifier (@); copy it to a neutral name first'
    );
  }

  // 3. Size cap, before reading.
  if (fs.statSync(resolvedFit).size > MAX_FIT_BYTES) {
    throw new Error(`FIT file too large (> ${MAX_FIT_BYTES} bytes): ${opts.fitPath}`);
  }

  // 4-5. Read and decode.
  let buf: Buffer = fs.readFileSync(resolvedFit);
  if (resolvedFit.endsWith('.gz')) {
    // The size check above bounds only the compressed bytes; cap the inflated
    // output too, or a small .fit.gz can exhaust memory (36.1 WR-08).
    try {
      buf = gunzipSync(buf, { maxOutputLength: MAX_FIT_BYTES });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ERR_BUFFER_TOO_LARGE' || /maxOutputLength|buffer too large/i.test((error as Error).message)) {
        throw new Error(`FIT file too large (> ${MAX_FIT_BYTES} bytes once decompressed): ${opts.fitPath}`);
      }
      throw new Error(`could not decompress ${opts.fitPath}: ${(error as Error).message}`);
    }
  }

  const { Decoder, Stream } = await import('@garmin/fitsdk');
  const decoder = new Decoder(Stream.fromBuffer(buf));
  if (!decoder.isFIT()) throw new Error(`not a FIT file: ${opts.fitPath}`);
  if (!decoder.checkIntegrity()) throw new Error(`FIT integrity check failed: ${opts.fitPath}`);
  const { messages: rawMessages, errors } = decoder.read();
  // A file can pass the CRC yet hold undecodable records; importing what did
  // decode would be a partial activity (36.1 WR-09). Fail closed.
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(`FIT decode errors (${errors.length}): ${String(errors[0])}: ${opts.fitPath}`);
  }
  const messages = rawMessages as unknown as DecodedMessages;

  // 6-8. Session checks.
  const sessions = messages.sessionMesgs ?? [];
  if (sessions.length !== 1) {
    throw new Error(`expected exactly one session, found ${sessions.length}`);
  }
  if (sessions[0].sport !== 'running') {
    throw new Error(`not a running activity (sport: ${String(sessions[0].sport)})`);
  }
  const startTime = sessions[0].startTime;
  if (!(startTime instanceof Date)) {
    throw new Error('FIT session has no startTime');
  }
  const epoch = Math.floor(startTime.getTime() / 1000);
  const startDate = startTime.toISOString().replace('.000Z', 'Z');

  // 9. One scan of the archive: epoch map plus id set.
  const epochToId = new Map<number, string>();
  const takenIds = new Set<string>();
  if (fs.existsSync(opts.activitiesDir)) {
    for (const file of fs.readdirSync(opts.activitiesDir).filter(f => f.endsWith('.json'))) {
      takenIds.add(file.replace(/\.json$/, ''));
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(opts.activitiesDir, file), 'utf-8')) as {
          id?: unknown;
          start_date?: string;
          garmin_activity_id?: unknown;
        };
        if (rec.id !== undefined) takenIds.add(String(rec.id));
        if (rec.garmin_activity_id !== undefined) takenIds.add(String(rec.garmin_activity_id));
        if (rec.start_date) {
          epochToId.set(
            Math.floor(new Date(rec.start_date).getTime() / 1000),
            file.replace(/\.json$/, '')
          );
        }
      } catch {
        // Unreadable record: the filename id above still counts for collisions.
      }
    }
  }

  const exact = epochToId.get(epoch);
  if (exact !== undefined) {
    return { status: 'duplicate', existingId: exact, startDate };
  }
  for (const [otherEpoch, otherId] of epochToId) {
    const delta = Math.abs(otherEpoch - epoch);
    if (delta >= 1 && delta <= NEAR_MATCH_TOLERANCE_S) {
      throw new Error(
        `near-match: archive record ${otherId} starts ${delta}s from this FIT; refusing to import`
      );
    }
  }
  if (takenIds.has(id)) {
    throw new Error(`id collision: ${id} already exists in ${opts.activitiesDir}`);
  }

  // Build everything before writing. external_id is derived from the id, never
  // from the source filename (CR-01); `original` stays the `<source>:<rel>`
  // locator that backfill-streams resolves, already refused above if it holds '@'.
  const original = `${opts.source}:${rel}`;
  const externalId = `${id}${resolvedFit.endsWith('.gz') ? '.fit.gz' : '.fit'}`;
  if (original.includes('@') || externalId.includes('@')) {
    throw new Error('refusing: derived public field contains an account identifier (@)');
  }
  const activity = fitSessionToActivity(messages, {
    garminId: id,
    name: opts.name,
    original,
    externalId,
  });

  const samples = fitRecordsToSamples(messages.recordMesgs ?? []);
  const coords: [number, number][] = [];
  for (const s of samples) {
    if (typeof s.lat === 'number' && typeof s.lng === 'number') coords.push([s.lat, s.lng]);
  }
  if (coords.length > 0) {
    const validation = IntervalsProvider.validateGeometry(coords, activity.distance);
    if (validation.ok) {
      activity.map = { summary_polyline: polyline.encode(coords) };
      activity.start_latlng = coords[0];
    } else {
      console.warn(`  ${id}: geometry rejected (${validation.reason}); importing without route`);
    }
  }

  const stream = deriveFromSamples(id, samples, 'fit');

  // Load and validate every document that will be rewritten, and stage all
  // in-memory updates, BEFORE the first write (36.1 WR-07): a corrupt
  // provenance or manifest must refuse the import, not strand a half-written one.
  const store = new FileStore('/');
  const abs = (p: string) => path.resolve(p);
  const manifestAbs = abs(opts.manifestPath);
  const provAbs = abs(opts.provenancePath);

  let provDoc: { activities: Record<string, unknown>; [k: string]: unknown } = { activities: {} };
  if (fs.existsSync(provAbs)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(provAbs, 'utf-8'));
    } catch (error) {
      throw new Error(`provenance file is not valid JSON (${(error as Error).message}): ${opts.provenancePath}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`provenance file is not a JSON object: ${opts.provenancePath}`);
    }
    const acts = (parsed as Record<string, unknown>).activities;
    if (acts !== undefined && (typeof acts !== 'object' || acts === null || Array.isArray(acts))) {
      throw new Error(`provenance file "activities" is not an object: ${opts.provenancePath}`);
    }
    provDoc = parsed as typeof provDoc;
    if (!provDoc.activities) provDoc.activities = {};
  }
  provDoc.activities[id] = { matched_by: 'imported', original };

  const manifest = await loadManifest(store, manifestAbs);
  if (typeof manifest?.activities !== 'object' || manifest.activities === null || Array.isArray(manifest.activities)) {
    throw new Error(`stream manifest has no activities object: ${opts.manifestPath}`);
  }
  if (stream) {
    upsertAvailable(manifest, id, {
      source: stream.source,
      distanceSource: stream.distanceSource,
      sampleCount: stream.sampleCount,
      channels: stream.channels,
    });
  } else {
    upsertUnavailable(manifest, id, 'no-samples');
  }

  // Writes. The activity record goes last: it is the dedupe key, so a run
  // interrupted before it stays importable on a re-run.
  if (stream) {
    await store.writeJson(path.join(abs(opts.streamsDir), `${id}.json`), stream);
  }
  await saveManifest(store, manifestAbs, manifest);
  await store.writeJson(provAbs, provDoc);
  await store.writeJson(path.join(abs(opts.activitiesDir), `${id}.json`), activity);

  return {
    status: 'imported',
    id,
    startDate,
    streamSampleCount: stream ? stream.sampleCount : null,
  };
}
