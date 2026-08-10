import fs from 'node:fs';
import path from 'node:path';

import { readOriginal } from '../exports/geometry-readers.js';
import { config } from '../config/strava.config.js';
import { FileStore } from '../storage/file-store.js';
import { IntervalsClient } from '../api/intervals-client.js';
import { deriveFromSamples, deriveFromIntervalsStreams } from './derive-stream.js';
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

/**
 * Select the third reconciliation branch: archive activities synced from
 * intervals.icu (RESEARCH.md Pitfall 3) that have no committed stream file
 * yet, after the FIT/GPX and unavailable-flag passes ran.
 *
 * Keying on `source_provider === 'intervals'` rather than provenance
 * membership is what makes this robust — it catches activities with no
 * provenance entry at all, activities listed in
 * `archive_without_original`, and any FIT/GPX decode failure, without three
 * separate special cases. Pure — no filesystem or network access — so it is
 * unit-testable in isolation.
 */
export function selectReconciliationTargets(
  archive: Map<string, { source_provider?: string }>,
  streamIds: Set<string>
): string[] {
  const targets: string[] = [];
  for (const [id, record] of archive) {
    if (record.source_provider === 'intervals' && !streamIds.has(id)) {
      targets.push(id);
    }
  }
  return targets;
}

/**
 * Format a human-inspectable size report for the committed `data/streams/`
 * tree. Pure — takes a pre-computed file list rather than reading the
 * filesystem itself — so it is unit-testable without a real archive.
 *
 * CONTEXT.md D-02: the backfill enforces a size gate WITH a report, never
 * auto-tightening decimation or dropping files to fit — the developer
 * inspects this report and decides. This module never invokes git.
 */
export function formatSizeReport(
  files: Array<{ name: string; bytes: number }>,
  budgetMb = 50
): string {
  const lines: string[] = [];
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  const totalMb = totalBytes / (1024 * 1024);

  lines.push('Size report: data/streams/');
  lines.push(`  file count: ${files.length}`);
  lines.push(`  total size: ${totalMb.toFixed(2)} MB`);

  const largest = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10);
  if (largest.length > 0) {
    lines.push('  ten largest files:');
    for (const f of largest) {
      lines.push(`    ${(f.bytes / 1024).toFixed(1)} KB  ${f.name}`);
    }
  }

  const meanKb = files.length > 0 ? totalBytes / files.length / 1024 : 0;
  lines.push(`  mean file size: ${meanKb.toFixed(2)} KB`);
  lines.push(
    `  git object estimate: ~${totalMb.toFixed(2)} MB raw (JSON compresses well in a packfile, so this is a ceiling, not a prediction)`
  );

  if (totalMb > budgetMb) {
    lines.push(
      `WARNING: total size ${totalMb.toFixed(2)} MB exceeds the ${budgetMb} MB budget by ${(totalMb - budgetMb).toFixed(2)} MB`
    );
  }

  return lines.join('\n');
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
  const writtenIds = new Set<string>();
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
        writtenIds.add(id);
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

  // Third branch: activities already archived from intervals.icu with no
  // export original and still no committed stream file (RESEARCH.md
  // Pitfall 3) — neither STREAM-01-eligible nor STREAM-02-eligible, so they
  // would silently have no streams forever without this pass.
  const streamIdsAfterLocalPasses = new Set([...existingStreamIds, ...writtenIds]);
  const reconciliationTargets = selectReconciliationTargets(archiveById, streamIdsAfterLocalPasses);

  if (reconciliationTargets.length > 0) {
    const apiKey = process.env.INTERVALS_API_KEY || '';
    if (!apiKey) {
      console.log(
        `  ${reconciliationTargets.length} activities need live intervals.icu reconciliation but INTERVALS_API_KEY is not set; leaving them flagged`
      );
    } else {
      const client = new IntervalsClient({
        apiKey,
        athleteId: process.env.INTERVALS_ATHLETE_ID || '0',
      });

      console.log(
        `\nReconciling ${reconciliationTargets.length} intervals-sourced activities with no local original...`
      );

      for (const id of reconciliationTargets) {
        const previousEntry = manifest.activities[id];
        try {
          const payload = await client.getAllStreams(id);
          const stream = deriveFromIntervalsStreams(id, payload);
          if (stream) {
            await fileStore.writeJson(`${config.streamsDir}/${id}.json`, stream);
            upsertAvailable(manifest, id, {
              source: stream.source,
              distanceSource: stream.distanceSource,
              sampleCount: stream.sampleCount,
              channels: stream.channels,
            });
            written++;
            if (previousEntry && previousEntry.available === false) {
              flagged--;
              flaggedByReason[previousEntry.reason] = Math.max(
                0,
                (flaggedByReason[previousEntry.reason] ?? 0) - 1
              );
            }
            console.log(`  ${id}: reconciled via live intervals.icu API`);
          } else {
            upsertUnavailable(manifest, id, 'no-samples');
            if (!previousEntry || previousEntry.available !== false || previousEntry.reason !== 'no-samples') {
              flaggedByReason['no-samples'] = (flaggedByReason['no-samples'] ?? 0) + 1;
              if (!previousEntry) flagged++;
            }
            console.warn(`  ${id}: live intervals.icu fetch returned no usable samples; flagged no-samples`);
          }
        } catch (error: any) {
          // RESEARCH.md Assumption A2: intervals.icu retains roughly a year,
          // so an activity older than the window 404s here and correctly
          // settles as no-original rather than aborting the reconciliation pass.
          upsertUnavailable(manifest, id, 'no-original');
          if (!previousEntry || previousEntry.available !== false || previousEntry.reason !== 'no-original') {
            flaggedByReason['no-original'] = (flaggedByReason['no-original'] ?? 0) + 1;
            if (!previousEntry) flagged++;
          }
          console.warn(`  ${id}: live intervals.icu reconciliation failed (${error.message}); flagged no-original`);
        }
      }
    }
  }

  await saveManifest(fileStore, config.streamsManifestPath, manifest);

  const allStreamFileNames = await fileStore.listFiles(config.streamsDir, '.json');
  const streamFilesNow = allStreamFileNames.filter(name => name !== 'manifest.json').length;

  console.log(`\nBackfill complete.`);
  console.log(`  archive total: ${provenance.archive_total}`);
  console.log(`  stream files written this run: ${written}`);
  console.log(`  skipped as already present: ${existingStreamIds.size}`);
  console.log(`  flagged unavailable: ${flagged}`);
  for (const [reason, count] of Object.entries(flaggedByReason)) {
    console.log(`    ${reason}: ${count}`);
  }
  console.log(`  files now under ${config.streamsDir}/: ${streamFilesNow}`);

  // D-02 size gate: report every committed *.json under data/streams/
  // (including the manifest itself) so the developer can inspect the total
  // before deciding to commit. This command never runs git.
  const sizeFiles = allStreamFileNames.map(name => ({
    name,
    bytes: fs.statSync(path.join(config.streamsDir, name)).size,
  }));
  console.log(`\n${formatSizeReport(sizeFiles)}`);
  console.log(
    '\nThis command wrote no git objects. Review the report above, then commit data/streams/ manually if it looks right.'
  );
}
