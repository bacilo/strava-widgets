import { IntervalsClient } from '../api/intervals-client.js';
import { IntervalsProvider } from '../api/intervals-provider.js';
import { findNearMatch, isFitImported, type NearCandidate } from '../exports/near-match.js';
import { FileStore } from '../storage/file-store.js';
import { SyncStateManager } from '../storage/sync-state.js';
import { deriveFromIntervalsStreams } from '../streams/derive-stream.js';
import { loadManifest, saveManifest, upsertAvailable, upsertUnavailable } from '../streams/stream-manifest.js';
import type { StreamManifest } from '../streams/stream.types.js';

/** A delivery skipped because it starts within the near-match window of a FIT-imported record. Ids, date, signed delta only. */
export interface NearMatchSkip {
  intervalsId: string;
  existingId: string;
  deltaS: number;
  startDate: string;
}

export interface IntervalsSyncResult {
  newRuns: number;
  totalFetched: number;
  skipped: number;
  nearMatches: NearMatchSkip[];
}

/**
 * Sync loop for the intervals.icu provider.
 *
 * Same contract as the Strava ActivitySync: fetch activities newer than the
 * sync-state high watermark, write canonical records to data/activities/, and
 * advance the watermark. Differences that matter:
 *
 * - No pagination: the activities endpoint returns a whole date window at once.
 * - Geometry costs one extra streams request per activity, because
 *   intervals.icu ships no encoded polyline or start_latlng on the summary.
 *   Every reconstructed route is validated against the device's recorded
 *   distance before it is trusted (see IntervalsProvider.validateGeometry).
 * - Dedupe is by start_date epoch, not id, against every record on disk.
 *   Verified against live data: all 113 activities in the archive/intervals
 *   overlap window matched exactly, and start_date is unique across all 1,808
 *   archived activities. On top of that, a delivery within the shared
 *   near-match window (findNearMatch, window defined in near-match.ts) of a
 *   FIT-imported record (source_provider garmin-export; strava-export is not
 *   FIT-imported) is skipped and reported, never written and never replacing
 *   the FIT record. Only FIT-imported records read from disk are compared,
 *   never epochs added earlier in the same batch. A skip is reported only in
 *   the returned nearMatches and the console log; nothing is written to data/.
 *   The 1-day watermark overlap re-reports it on later nights only while the
 *   watermark stays within a day of the skipped start. Once a later run is
 *   written and the watermark moves past that, the skip is never reported
 *   again, so the CI log is the only trace.
 */
export class IntervalsSync {
  private provider: IntervalsProvider;
  private fileStore: FileStore;
  private syncStateManager: SyncStateManager;
  private activitiesDir: string;
  private streamsDir: string;
  private streamsManifestPath: string;

  constructor({
    client,
    fileStore,
    syncStateManager,
    activitiesDir,
    streamsDir,
    streamsManifestPath,
  }: {
    client: IntervalsClient;
    fileStore: FileStore;
    syncStateManager: SyncStateManager;
    activitiesDir: string;
    streamsDir: string;
    streamsManifestPath: string;
  }) {
    this.provider = new IntervalsProvider(client);
    this.fileStore = fileStore;
    this.syncStateManager = syncStateManager;
    this.activitiesDir = activitiesDir;
    this.streamsDir = streamsDir;
    this.streamsManifestPath = streamsManifestPath;
  }

  /**
   * Epoch seconds of every activity on disk (exact dedupe), plus the FIT-imported
   * ones as near-match candidates. An unreadable record is skipped rather than
   * aborting the sync, so an unreadable FIT-imported record is absent from the
   * near index too.
   */
  private async loadArchiveIndex(): Promise<{ epochs: Set<number>; fitImported: NearCandidate[] }> {
    const epochs = new Set<number>();
    const fitImported: NearCandidate[] = [];
    const files = await this.fileStore.listFiles(this.activitiesDir, '.json');
    for (const file of files) {
      try {
        const activity = await this.fileStore.readJson<{ start_date?: string; source_provider?: string }>(
          `${this.activitiesDir}/${file}`
        );
        if (activity.start_date) {
          const epoch = Math.floor(new Date(activity.start_date).getTime() / 1000);
          epochs.add(epoch);
          if (isFitImported(activity.source_provider) && Number.isFinite(epoch)) {
            fitImported.push({ id: file.replace(/\.json$/, ''), epoch });
          }
        }
      } catch {
        // Unreadable file — skip rather than abort the sync.
      }
    }
    return { epochs, fitImported };
  }

  async syncNewActivities(): Promise<IntervalsSyncResult> {
    const state = await this.syncStateManager.load();

    // Overlap the watermark by a day: the activities endpoint filters by local
    // date, not instant, and dedupe-by-epoch (plus the near rule
    // against FIT-imported records) makes re-fetching harmless.
    const since =
      state.last_sync_timestamp > 0
        ? new Date((state.last_sync_timestamp - 24 * 60 * 60) * 1000)
        : undefined;

    console.log(
      since
        ? `Starting intervals.icu sync from ${since.toISOString()}`
        : 'Starting intervals.icu sync from beginning of history'
    );

    const rawActivities = await this.provider.fetchRawActivities({ since });
    console.log(`Fetched ${rawActivities.length} activities from intervals.icu`);

    const { epochs: existing, fitImported } = await this.loadArchiveIndex();
    const nearMatches: NearMatchSkip[] = [];

    // Loaded once before the loop, saved once after — a 30-activity sync
    // writes the manifest a single time, not per activity.
    const manifest: StreamManifest = await loadManifest(this.fileStore, this.streamsManifestPath);

    let newRuns = 0;
    let skipped = 0;
    let maxTimestamp = state.last_sync_timestamp;

    // Oldest first, so the watermark only ever covers what has been written.
    for (const raw of [...rawActivities].reverse()) {
      const activity = this.provider.toCanonical(raw);

      if (activity.type !== 'Run') {
        skipped++;
        continue;
      }

      const epoch = Math.floor(new Date(activity.start_date).getTime() / 1000);
      if (existing.has(epoch)) {
        skipped++;
        continue;
      }

      // Near rule: FIT-imported records read from disk only; `existing` also
      // holds epochs added in this batch and is deliberately not consulted.
      const near = findNearMatch(epoch, fitImported);
      if (near) {
        skipped++;
        nearMatches.push({
          intervalsId: String(activity.id),
          existingId: near.id,
          deltaS: near.deltaS,
          startDate: activity.start_date,
        });
        const signed = near.deltaS > 0 ? `+${near.deltaS}` : `${near.deltaS}`;
        console.log(`  ~ near-match skip: ${activity.id} (${activity.start_date}) is ${signed}s from FIT-imported ${near.id}; not written`);
        continue;
      }

      // Enrich with geometry. A failed validation logs and proceeds without a
      // route — the run still counts toward stats; it just won't draw on maps.
      const streamTypes = Array.isArray(raw.stream_types)
        ? (raw.stream_types as string[])
        : undefined;
      try {
        const geometry = await this.provider.fetchGeometry(String(activity.id), {
          streamTypes,
          expectedMeters: activity.distance,
          allChannels: true,
        });
        if (geometry.summaryPolyline && geometry.startLatLng && geometry.validation?.ok) {
          activity.map = { summary_polyline: geometry.summaryPolyline };
          activity.start_latlng = geometry.startLatLng;
          activity.end_latlng = undefined; // not consumed downstream; omit rather than guess
        } else {
          console.warn(
            `  ${activity.id} (${activity.name}): geometry rejected — ` +
            `${geometry.validation?.reason ?? 'no coordinates'}; saving without route`
          );
        }

        // Under the allChannels flag above, raw and rawAll hold the same
        // unfiltered payload — the `??` here is belt-and-braces, not the
        // mechanism that supplies HR/cadence/altitude.
        const stream = deriveFromIntervalsStreams(String(activity.id), geometry.rawAll ?? geometry.raw);
        if (stream) {
          await this.fileStore.writeJson(`${this.streamsDir}/${activity.id}.json`, stream);
          upsertAvailable(manifest, String(activity.id), {
            source: stream.source,
            distanceSource: stream.distanceSource,
            sampleCount: stream.sampleCount,
            channels: stream.channels,
          });
        } else {
          upsertUnavailable(manifest, String(activity.id), 'no-samples');
          console.warn(`  ${activity.id}: no usable stream samples; flagged no-samples`);
        }
      } catch (error: any) {
        console.warn(
          `  ${activity.id}: streams fetch failed (${error.message}); saving without route or stream`
        );
        upsertUnavailable(manifest, String(activity.id), 'no-samples');
      }

      await this.fileStore.writeJson(`${this.activitiesDir}/${activity.id}.json`, activity);
      existing.add(epoch);
      newRuns++;
      if (epoch > maxTimestamp) maxTimestamp = epoch;

      // Advance the watermark as we go so an interrupted sync resumes cleanly.
      await this.syncStateManager.save({
        last_sync_timestamp: maxTimestamp,
        last_activity_id: String(activity.id),
        total_activities: state.total_activities + newRuns,
        last_sync_date: new Date().toISOString(),
      });

      console.log(
        `  + ${activity.start_date.slice(0, 10)} ${activity.name} ` +
        `(${(activity.distance / 1000).toFixed(1)} km)`
      );
    }

    // Written once per sync, not per activity — a no-op on disk when nothing
    // about the entries changed.
    await saveManifest(this.fileStore, this.streamsManifestPath, manifest);

    console.log(
      `Sync complete: ${newRuns} new runs saved, ${skipped} skipped (already present or not runs)`
    );

    return { newRuns, totalFetched: rawActivities.length, skipped, nearMatches };
  }
}
