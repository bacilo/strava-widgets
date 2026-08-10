import type { FileStore } from '../storage/file-store.js';
import {
  STREAM_SCHEMA_VERSION,
  type DistanceSource,
  type StreamChannels,
  type StreamManifest,
  type StreamManifestEntry,
  type StreamSource,
  type StreamUnavailableReason,
} from './stream.types.js';

/**
 * Central availability index — `data/streams/manifest.json` (CONTEXT.md D-04).
 *
 * Both ingestion paths (local backfill and the daily intervals.icu sync)
 * read-merge-write into this single committed file: every activity's
 * availability, channels present, and a reason code when unavailable. No
 * per-activity stub files.
 */

const NOTE =
  'Stream availability index for data/streams/. Written by both backfill-streams and the ' +
  'daily intervals.icu sync. available:false means no data/streams/<id>.json exists for that activity.';

export function emptyManifest(): StreamManifest {
  return {
    schemaVersion: STREAM_SCHEMA_VERSION,
    generated_at: '',
    note: NOTE,
    totals: { activities: 0, with_streams: 0, without_streams: 0, by_reason: {} },
    activities: {},
  };
}

/**
 * Load the manifest, or an empty one when the file doesn't exist yet.
 *
 * A JSON parse failure on an EXISTING file throws rather than returning
 * `emptyManifest()` — losing 1,867 availability entries to a swallowed
 * error is worse than a loud failure (T-14-07).
 */
export async function loadManifest(
  fileStore: FileStore,
  manifestPath: string
): Promise<StreamManifest> {
  try {
    return await fileStore.readJson<StreamManifest>(manifestPath);
  } catch (error) {
    if ((error as Error).message.startsWith('File not found:')) {
      return emptyManifest();
    }
    throw error;
  }
}

export function upsertAvailable(
  manifest: StreamManifest,
  id: string,
  entry: {
    source: StreamSource;
    distanceSource: DistanceSource;
    sampleCount: number;
    channels: StreamChannels;
  }
): void {
  manifest.activities[id] = { available: true, ...entry };
}

export function upsertUnavailable(
  manifest: StreamManifest,
  id: string,
  reason: StreamUnavailableReason
): void {
  manifest.activities[id] = { available: false, reason };
}

function computeTotals(activities: Record<string, StreamManifestEntry>) {
  let withStreams = 0;
  const byReason: Record<string, number> = {};

  for (const entry of Object.values(activities)) {
    if (entry.available) {
      withStreams++;
    } else {
      byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
    }
  }

  const total = Object.keys(activities).length;
  return {
    activities: total,
    with_streams: withStreams,
    without_streams: total - withStreams,
    by_reason: byReason,
  };
}

/**
 * Rebuild totals, serialize activity ids in sorted order (diff-stable
 * output), and persist atomically via `FileStore.writeJson`.
 *
 * `generated_at` is bumped to now ONLY when the sorted-entries payload
 * differs from what's already on disk; otherwise the on-disk timestamp is
 * carried forward so a no-op re-run doesn't dirty git (D-02).
 */
export async function saveManifest(
  fileStore: FileStore,
  manifestPath: string,
  manifest: StreamManifest
): Promise<void> {
  const sortedIds = Object.keys(manifest.activities).sort((a, b) => a.localeCompare(b));
  const sortedActivities: Record<string, StreamManifestEntry> = {};
  for (const id of sortedIds) sortedActivities[id] = manifest.activities[id];

  const totals = computeTotals(sortedActivities);

  const comparableNext = {
    schemaVersion: manifest.schemaVersion,
    note: manifest.note,
    totals,
    activities: sortedActivities,
  };

  let existing: StreamManifest | undefined;
  try {
    existing = await fileStore.readJson<StreamManifest>(manifestPath);
  } catch {
    existing = undefined;
  }

  const comparableExisting = existing
    ? {
        schemaVersion: existing.schemaVersion,
        note: existing.note,
        totals: existing.totals,
        activities: existing.activities,
      }
    : undefined;

  const changed =
    !existing || JSON.stringify(comparableExisting) !== JSON.stringify(comparableNext);

  const doc: StreamManifest = {
    schemaVersion: manifest.schemaVersion,
    generated_at: changed ? new Date().toISOString() : existing!.generated_at,
    note: manifest.note,
    totals,
    activities: sortedActivities,
  };

  await fileStore.writeJson(manifestPath, doc);
}
