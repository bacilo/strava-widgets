import fs from 'node:fs';
import path from 'node:path';

import { readOriginal } from '../exports/geometry-readers.js';
import { config } from '../config/strava.config.js';
import { FileStore } from '../storage/file-store.js';
import { deriveFromSamples } from './derive-stream.js';
import { loadManifest, saveManifest, upsertAvailable, upsertUnavailable } from './stream-manifest.js';
import type { StreamSource, StreamUnavailableReason } from './stream.types.js';

/**
 * Local backfill over `export_data/` originals, driven by `data/provenance.json`.
 *
 * `export_data/` is gitignored and structurally absent from CI, so this is
 * the only path that can ever produce streams for the ~1,841 historical
 * activities — committed fidelity here is the ceiling on Phase 15's PR
 * accuracy. Every write path funnels through `deriveFromSamples` (the single
 * normalization seam from plan 14-01), and every touched activity gets a
 * manifest entry whether or not a stream file was produced.
 *
 * Mirrors `consolidate.ts`'s shape: index-then-process, per-item try/catch,
 * final summary block. CLI registration, the intervals reconciliation
 * branch, and the D-02 size gate land in plan 14-05.
 */

const PROVENANCE_PATH = 'data/provenance.json';
const ACTIVITIES_DIR = 'data/activities';

interface ProvenanceEntry {
  strava_id?: string;
  original?: string;
  matched_by: 'strava_id' | 'start_date' | 'imported';
  gear?: string;
}

interface ProvenanceDoc {
  generated_at: string;
  note: string;
  sources: Record<string, unknown>;
  archive_total: number;
  archive_without_original: string[];
  activities: Record<string, ProvenanceEntry>;
}

interface ArchiveRecord {
  manual?: boolean;
  trainer?: boolean;
  source_provider?: string;
}

/**
 * Classify why an activity with no recoverable original is unavailable.
 *
 * Rules derived from the measured archive composition (RESEARCH.md): 23
 * archive entries are `manual: true` (user-typed Strava entries, no
 * recording ever existed); `treadmill` is reserved for `trainer: true`
 * entries (zero current instances, but the taxonomy must be extensible);
 * everything else falls back to `no-original`.
 */
export function classifyUnavailable(activity: ArchiveRecord): StreamUnavailableReason {
  if (activity.manual === true) return 'manual';
  if (activity.trainer === true) return 'treadmill';
  return 'no-original';
}

/** Resolve a provenance `original` value (`"<source>:<relative/path>"`) into a filesystem path under `export_data/`. */
function resolveOriginalPath(original: string): string {
  const sepIndex = original.indexOf(':');
  const source = original.slice(0, sepIndex);
  const relativePath = original.slice(sepIndex + 1);
  return path.join('export_data', source, relativePath);
}

/**
 * Select backfill work from provenance: activities with a resolvable
 * original (to decode), and activities with none (to flag). Pure — no
 * filesystem access — so it is unit-testable without `export_data/`
 * (gitignored, absent from CI).
 */
export function buildBackfillTargets(
  provenance: ProvenanceDoc,
  existingStreamIds: Set<string>
): { withOriginal: Array<{ id: string; originalPath: string }>; withoutOriginal: string[] } {
  const withOriginal: Array<{ id: string; originalPath: string }> = [];
  const withoutOriginalSet = new Set<string>();

  for (const [id, entry] of Object.entries(provenance.activities)) {
    if (existingStreamIds.has(id)) continue;
    if (entry.original) {
      withOriginal.push({ id, originalPath: resolveOriginalPath(entry.original) });
    } else {
      withoutOriginalSet.add(id);
    }
  }

  for (const id of provenance.archive_without_original) {
    if (existingStreamIds.has(id)) continue;
    withoutOriginalSet.add(id);
  }

  return { withOriginal, withoutOriginal: Array.from(withoutOriginalSet) };
}

export async function backfillStreams(): Promise<void> {
  if (!fs.existsSync(PROVENANCE_PATH)) {
    console.log(
      `Nothing to backfill: ${PROVENANCE_PATH} not found. Run: node dist/index.js consolidate-exports`
    );
    return;
  }

  const fileStore = new FileStore('.');

  // Idempotency: skip ids that already have a stream file — no separate
  // "already processed" bookkeeping file.
  const existingStreamFiles = await fileStore.listFiles(config.streamsDir, '.json');
  const existingStreamIds = new Set(
    existingStreamFiles.filter(name => name !== 'manifest.json').map(name => name.replace(/\.json$/, ''))
  );

  // Archive index — loaded once so classifyUnavailable doesn't re-read files inside the loop.
  const archiveById = new Map<string, ArchiveRecord>();
  for (const file of fs.readdirSync(ACTIVITIES_DIR).filter(f => f.endsWith('.json'))) {
    const activity = JSON.parse(fs.readFileSync(path.join(ACTIVITIES_DIR, file), 'utf-8')) as ArchiveRecord;
    const id = file.replace(/\.json$/, '');
    archiveById.set(id, activity);
  }

  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf-8')) as ProvenanceDoc;

  const manifest = await loadManifest(fileStore, config.streamsManifestPath);
  const { withOriginal, withoutOriginal } = buildBackfillTargets(provenance, existingStreamIds);

  let written = 0;
  let flagged = 0;
  const flaggedByReason: Record<string, number> = {};
  const total = withOriginal.length + withoutOriginal.length;
  let processed = 0;

  const reportProgress = () => {
    if (processed % 100 === 0) {
      console.log(
        `  ... ${processed}/${total} processed (${written} written, ${existingStreamIds.size} skipped, ${flagged} flagged)`
      );
    }
  };

  for (const { id, originalPath } of withOriginal) {
    processed++;
    try {
      const recording = await readOriginal(originalPath);
      const source: StreamSource = /\.fit(\.gz)?$/.test(originalPath) ? 'fit' : 'gpx';
      const stream = deriveFromSamples(id, recording.samples, source);
      if (stream) {
        await fileStore.writeJson(`${config.streamsDir}/${id}.json`, stream);
        upsertAvailable(manifest, id, {
          source: stream.source,
          distanceSource: stream.distanceSource,
          sampleCount: stream.sampleCount,
          channels: stream.channels,
        });
        written++;
      } else {
        upsertUnavailable(manifest, id, 'no-samples');
        flaggedByReason['no-samples'] = (flaggedByReason['no-samples'] ?? 0) + 1;
        flagged++;
        console.warn(`  ${id}: no usable samples in original; flagged no-samples`);
      }
    } catch (error: any) {
      upsertUnavailable(manifest, id, 'unreadable-original');
      flaggedByReason['unreadable-original'] = (flaggedByReason['unreadable-original'] ?? 0) + 1;
      flagged++;
      console.warn(`  ${id}: could not read original (${error.message}); flagged unreadable-original`);
    }
    reportProgress();
  }

  for (const id of withoutOriginal) {
    processed++;
    const reason = classifyUnavailable(archiveById.get(id) ?? {});
    upsertUnavailable(manifest, id, reason);
    flaggedByReason[reason] = (flaggedByReason[reason] ?? 0) + 1;
    flagged++;
    reportProgress();
  }

  await saveManifest(fileStore, config.streamsManifestPath, manifest);

  const streamFilesNow = (await fileStore.listFiles(config.streamsDir, '.json')).filter(
    name => name !== 'manifest.json'
  ).length;

  console.log(`\nBackfill complete.`);
  console.log(`  archive total: ${provenance.archive_total}`);
  console.log(`  stream files written this run: ${written}`);
  console.log(`  skipped as already present: ${existingStreamIds.size}`);
  console.log(`  flagged unavailable: ${flagged}`);
  for (const [reason, count] of Object.entries(flaggedByReason)) {
    console.log(`    ${reason}: ${count}`);
  }
  console.log(`  files now under ${config.streamsDir}/: ${streamFilesNow}`);
}
