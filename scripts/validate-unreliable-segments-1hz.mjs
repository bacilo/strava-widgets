/**
 * D-12 1 Hz FIT cross-check of detected unreliable segments — LOCAL-ONLY, VALIDATION ONLY,
 * NEVER DERIVATION.
 *
 * Every constant the detector ships (`UNRELIABLE_SPEED_LIMIT_MPS`, `UNRELIABLE_EXCESS_FLOOR_M`,
 * `HIDDEN_PAUSE_MIN_METRES`) is derived from committed `t`/`d` alone, so CI and anyone without
 * `export_data/` can regenerate the calibration artifact of record. This script does the
 * opposite direction: it takes the SHIPPED detector's output on the committed, decimated stream
 * and asks what the 1 Hz FIT original underneath it actually looked like — does the burst still
 * exist at 1 Hz? How did decimation change its measured speed and metres? It imports the shipped
 * constants and detector only; it derives NOTHING, and no calibration artifact or shipped
 * constant may ever be regenerated from this script's output.
 *
 * LOCAL-ONLY BY CONSTRUCTION (D-12, T-32-21):
 *   - `export_data/` is gitignored and exists only on the developer's machine (bulk Strava
 *     export). `vitest.config.ts` collects `scripts/**\/*.test.mjs`, so this file deliberately has
 *     NO `.test.mjs` sibling — a sibling would risk `export_data/` state leaking into `npm test`
 *     and CI, where it never exists.
 *   - Not referenced by any `.github/workflows/` file.
 *   - Degrades gracefully: if the export root or its `activities.csv` is absent, this prints a
 *     message and exits 0 without throwing or writing anything (`existsSync` guard, mirroring
 *     `src/exports/consolidate.ts`'s own graceful-absence pattern).
 *
 * DETERMINISTIC SAMPLE: every segment the shipped detector finds on the four named scoping
 * activities (3475724402, 3475734189, 3475740390, 4556693525), plus every segment on the first
 * 20 flagged activities (by numeric activity id, ascending) that have a FIT original in
 * `activities.csv`'s `Filename` column (`.fit.gz`; `.gpx.gz` originals carry no distance channel
 * and are skipped). Both halves are computed fresh, in this script, from the committed streams
 * with the shipped detector — never a hand-typed list.
 *
 * METHOD, per sampled activity:
 *   1. `activities.csv`'s `Activity ID` -> `Filename` column locates the FIT original.
 *   2. The FIT original is decoded (gunzip + `Decoder`) via `readOriginal` /
 *      `fitRecordsToSamples` (the exact functions `src/exports/geometry-readers.ts` uses for
 *      bulk-export ingestion) — never a bespoke second FIT parser.
 *   3. FIT record timestamps (`tEpochS`, absolute epoch seconds) are aligned to the committed
 *      stream's relative seconds via `data/activities/{id}.json`'s `start_date`
 *      (`tRel = tEpochS - startEpoch`). The alignment residual — FIT distance at each committed
 *      sample's own `t`, linearly interpolated between the two bracketing 1 Hz FIT samples, minus
 *      the committed `d` at that same index — is reported per activity as a median absolute
 *      metres value.
 *   4. Over each segment's `[startSec, endSec]` window: the 1 Hz sample count, 1 Hz metres and
 *      seconds spanned, the fastest single 1 Hz consecutive-pair speed inside the window, and
 *      whether that max pair speed exceeds the shipped `UNRELIABLE_SPEED_LIMIT_MPS` (the burst
 *      "exists at 1 Hz" iff so) are all reported, alongside the committed segment's own aggregate
 *      metres/seconds/speed for comparison.
 *
 * Provenance is dated via a REQUIRED `--as-of YYYY-MM-DD` CLI flag rather than a wall-clock
 * timestamp, so re-running with the same flag over an unchanged archive and export produces a
 * byte-identical report (idempotence, Pitfall 13's standing discipline) — a missing or malformed
 * flag exits 1 with a usage line rather than silently defaulting to `new Date()`.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  detectUnreliableSegments,
  DEFAULT_DETECTOR_PARAMS,
  UNRELIABLE_SPEED_LIMIT_MPS,
} from '../dist/analytics/unreliable-segments.js';
import { classifyGaps } from '../dist/analytics/pace-derivation.js';
import { validateStreamSeries } from '../dist/analytics/best-effort-utils.js';
import { parseCsv, columnIndices } from '../dist/exports/csv.js';
import { readOriginal } from '../dist/exports/geometry-readers.js';
import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data/activities');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/32-unreliable-segment-detection-calibration/32-1HZ-VALIDATION.md'
);

const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390', '4556693525'];
const FIRST_N_FLAGGED = 20;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** Parses `--as-of YYYY-MM-DD` from argv. Returns null on missing/malformed. */
export function parseArgs(argv) {
  const idx = argv.indexOf('--as-of');
  if (idx === -1 || argv[idx + 1] === undefined) return null;
  const value = argv[idx + 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return { asOf: value };
}

// ---------------------------------------------------------------------------
// activities.csv -> FIT filename map
// ---------------------------------------------------------------------------

/** `Map<Activity ID, Filename>` from a Strava bulk-export `activities.csv`. Last occurrence of a
 * duplicated column name wins (mirrors `src/exports/consolidate.ts`'s `last()` convention). */
export function loadCsvFilenameMap(csvPath) {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const header = rows[0];
  const cols = columnIndices(header);
  const idIndices = cols.get('Activity ID');
  const filenameIndices = cols.get('Filename');
  if (!idIndices || !filenameIndices) {
    throw new Error('activities.csv is missing "Activity ID" or "Filename" column');
  }
  const idIdx = idIndices[0];
  const filenameIdx = filenameIndices[filenameIndices.length - 1];

  const map = new Map();
  for (const row of rows.slice(1)) {
    const id = row[idIdx];
    const filename = row[filenameIdx];
    if (id && filename) map.set(id, filename);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Sample selection
// ---------------------------------------------------------------------------

/**
 * Every `data/streams/` activity where the shipped detector flags at least one segment, sorted
 * by numeric activity id ascending, restricted to those whose `activities.csv` `Filename` is a
 * `.fit.gz` original (`.gpx.gz` carries no distance channel — see this file's docblock). Returns
 * the full ascending list; callers slice to `FIRST_N_FLAGGED`.
 */
export function findFlaggedActivitiesWithFitOriginal(streamsDir, csvMap) {
  const files = readdirSync(streamsDir)
    .filter(isStreamFile)
    .sort((a, b) => Number(idFromFilename(a)) - Number(idFromFilename(b)));

  const result = [];
  for (const filename of files) {
    const id = idFromFilename(filename);
    let stream;
    try {
      stream = JSON.parse(readFileSync(join(streamsDir, filename), 'utf8'));
    } catch {
      continue;
    }
    const t = Array.isArray(stream.t) ? stream.t : [];
    const d = Array.isArray(stream.d) ? stream.d : [];
    if (!validateStreamSeries(t, d).ok) continue;

    const gaps = classifyGaps(t, d).gapIntervals;
    const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);
    if (segments.length === 0) continue;

    const csvFile = csvMap.get(id);
    if (csvFile && csvFile.endsWith('.fit.gz')) {
      result.push(id);
    }
  }
  return result;
}

/** Named IDs first (in their documented order), then the first N flagged-with-FIT IDs ascending,
 * de-duplicated (a named id that also lands in the flagged-ascending list is not repeated). */
export function buildSampleActivityIds(streamsDir, csvMap) {
  const flagged = findFlaggedActivitiesWithFitOriginal(streamsDir, csvMap).slice(
    0,
    FIRST_N_FLAGGED
  );
  const seen = new Set(NAMED_ACTIVITY_IDS);
  const rest = flagged.filter((id) => !seen.has(id));
  return [...NAMED_ACTIVITY_IDS, ...rest];
}

// ---------------------------------------------------------------------------
// FIT alignment + 1 Hz measurement
// ---------------------------------------------------------------------------

/** `{t, d}[]` sorted ascending by `t` (stream-relative seconds), built from FIT `RawSample[]`
 * with a defined `distanceM`, aligned via `startEpoch`. */
export function buildRelDistanceSamples(samples, startEpoch) {
  const points = [];
  for (const s of samples) {
    if (typeof s.distanceM === 'number' && typeof s.tEpochS === 'number') {
      points.push({ t: s.tEpochS - startEpoch, d: s.distanceM });
    }
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

/** Linear interpolation of `points` (sorted ascending by `.t`) at `t`. Clamps to the first/last
 * point outside the covered range. Returns null for an empty array. */
export function distanceAt(points, t) {
  if (points.length === 0) return null;
  if (t <= points[0].t) return points[0].d;
  const last = points[points.length - 1];
  if (t >= last.t) return last.d;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.t <= t && t <= b.t) {
      if (b.t === a.t) return a.d;
      const frac = (t - a.t) / (b.t - a.t);
      return a.d + frac * (b.d - a.d);
    }
  }
  return null;
}

/** Median of absolute committed-vs-FIT distance residuals, sampled at every committed `t[i]`. */
export function alignmentResidualMedian(t, d, relPoints) {
  const residuals = [];
  for (let i = 0; i < t.length; i++) {
    const fitD = distanceAt(relPoints, t[i]);
    if (fitD !== null) residuals.push(Math.abs(fitD - d[i]));
  }
  if (residuals.length === 0) return null;
  const sorted = [...residuals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 1 Hz measurement over a segment's `[startSec, endSec]` window: every FIT relative-distance
 * point with `startSec <= t <= endSec`, the metres/seconds spanned end-to-end, the fastest single
 * consecutive-pair speed inside the window, and whether that exceeds the shipped speed limit
 * (the burst "exists at 1 Hz"). Returns `insufficientData: true` when fewer than two points fall
 * in the window (decimation removed the samples that would let 1 Hz corroborate or refute it).
 */
export function measureSegmentAt1Hz(relPoints, startSec, endSec, speedLimitMps) {
  const inWindow = relPoints.filter((p) => p.t >= startSec && p.t <= endSec);
  if (inWindow.length < 2) {
    return { sampleCount: inWindow.length, insufficientData: true };
  }

  const seconds1Hz = inWindow[inWindow.length - 1].t - inWindow[0].t;
  const metres1Hz = inWindow[inWindow.length - 1].d - inWindow[0].d;

  let maxPairSpeedMps = 0;
  for (let i = 0; i < inWindow.length - 1; i++) {
    const dt = inWindow[i + 1].t - inWindow[i].t;
    const dd = inWindow[i + 1].d - inWindow[i].d;
    if (dt > 0) {
      const speed = dd / dt;
      if (speed > maxPairSpeedMps) maxPairSpeedMps = speed;
    }
  }

  return {
    sampleCount: inWindow.length,
    insufficientData: false,
    seconds1Hz,
    metres1Hz,
    maxPairSpeedMps,
    burstExistsAt1Hz: maxPairSpeedMps > speedLimitMps,
  };
}

// ---------------------------------------------------------------------------
// Per-activity assembly
// ---------------------------------------------------------------------------

/** Builds the full per-activity finding: committed segments, FIT alignment, and each segment's
 * 1 Hz measurement. Returns `{ id, skipped: reason }` when the FIT original is absent/unreadable,
 * decode fails, the committed stream is missing/unparseable, or the committed stream has no
 * array `t`/`d` channels — never throws (CR-03: the committed-stream read used to be unguarded
 * and could throw ENOENT/SyntaxError, and `validateStreamSeries` itself dereferences `t.length`,
 * which throws on a non-array rather than returning a not-ok result — the explicit
 * `Array.isArray` check below exists so this function never reaches that dereference on
 * malformed on-disk JSON). */
export async function buildActivityFinding(id, streamsDir, activitiesDir, csvMap, exportRoot) {
  const csvFile = csvMap.get(id);
  if (!csvFile) {
    return { id, skipped: 'no Filename in activities.csv' };
  }
  if (!csvFile.endsWith('.fit.gz')) {
    return { id, skipped: `original is not a FIT file (${csvFile})` };
  }

  const fitPath = join(exportRoot, csvFile);
  if (!existsSync(fitPath)) {
    return { id, skipped: `FIT original not found on disk (${csvFile})` };
  }

  let stream;
  try {
    stream = JSON.parse(readFileSync(join(streamsDir, `${id}.json`), 'utf8'));
  } catch (error) {
    return { id, skipped: `committed stream missing or unparseable: ${error.message}` };
  }
  const t = stream?.t;
  const d = stream?.d;
  if (!Array.isArray(t) || !Array.isArray(d)) {
    return { id, skipped: 'committed stream has no array t/d channels' };
  }
  if (!validateStreamSeries(t, d).ok) {
    return { id, skipped: 'committed stream fails validateStreamSeries' };
  }

  const gaps = classifyGaps(t, d).gapIntervals;
  const segments = detectUnreliableSegments(t, d, gaps, DEFAULT_DETECTOR_PARAMS);
  if (segments.length === 0) {
    return { id, skipped: 'shipped detector finds no segment on this activity' };
  }

  let activityDoc;
  try {
    activityDoc = JSON.parse(readFileSync(join(activitiesDir, `${id}.json`), 'utf8'));
  } catch {
    return { id, skipped: 'data/activities/{id}.json missing or unreadable' };
  }
  const startEpoch = Math.floor(Date.parse(activityDoc.start_date) / 1000);
  if (!Number.isFinite(startEpoch)) {
    return { id, skipped: 'activity doc start_date unparseable' };
  }

  let recording;
  try {
    recording = await readOriginal(fitPath);
  } catch (error) {
    return { id, skipped: `FIT decode failed (${error.message})` };
  }

  const relPoints = buildRelDistanceSamples(recording.samples, startEpoch);
  const residualMedian = alignmentResidualMedian(t, d, relPoints);

  const segmentFindings = segments.map((segment) =>
    Object.assign(
      { startSec: segment.startSec, endSec: segment.endSec, mechanism: segment.mechanism,
        committedMetres: segment.metres, committedSeconds: segment.seconds },
      measureSegmentAt1Hz(relPoints, segment.startSec, segment.endSec, UNRELIABLE_SPEED_LIMIT_MPS)
    )
  );

  return {
    id,
    skipped: null,
    csvFile,
    fitSampleCount: recording.samples.length,
    fitDistanceSampleCount: relPoints.length,
    residualMedian,
    segments: segmentFindings,
  };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function fmt(v, digits = 1) {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(digits);
}

export function renderReport(asOf, findings) {
  const lines = [];
  lines.push('# 1 Hz FIT Cross-Check of Detected Unreliable Segments (D-12)');
  lines.push('');
  lines.push(`As of: ${asOf}`);
  lines.push('');
  lines.push(
    'LOCAL-ONLY, VALIDATION ONLY. Derives no constant; the calibration artifact ' +
      '(`32-CALIBRATION.md`) and the shipped detector constants are unaffected by anything in ' +
      'this file. Regenerate with `npm run validate-unreliable-segments-1hz -- --as-of ' +
      '<date>` on a machine with a local, gitignored `export_data/strava/` bulk export.'
  );
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push(
    'Sample: every segment the shipped detector (`detectUnreliableSegments`, ' +
      '`DEFAULT_DETECTOR_PARAMS`) finds on the four named scoping activities (3475724402, ' +
      '3475734189, 3475740390, 4556693525), plus every segment on the first 20 flagged ' +
      'activities (by numeric activity id, ascending) that have a `.fit.gz` original in ' +
      '`activities.csv`. FIT record timestamps are aligned to the committed stream\'s relative ' +
      'seconds via `data/activities/{id}.json`\'s `start_date`. Over each segment\'s ' +
      '`[startSec, endSec]` window, the 1 Hz sample count, metres/seconds spanned, and the ' +
      'fastest single 1 Hz consecutive-pair speed are measured directly from the FIT original ' +
      '— never from the committed, decimated stream.'
  );
  lines.push('');

  const skipped = findings.filter((f) => f.skipped);
  const ok = findings.filter((f) => !f.skipped);

  lines.push('## Per-activity alignment');
  lines.push('');
  lines.push('| Activity | FIT original | 1 Hz samples (w/ distance) | Alignment residual (median abs m) | Segments |');
  lines.push('|---|---|---|---|---|');
  for (const f of ok) {
    lines.push(
      `| ${f.id} | ${f.csvFile} | ${f.fitDistanceSampleCount} | ${fmt(f.residualMedian, 2)} | ${f.segments.length} |`
    );
  }
  lines.push('');

  if (skipped.length > 0) {
    lines.push('## Skipped');
    lines.push('');
    lines.push('| Activity | Reason |');
    lines.push('|---|---|');
    for (const f of skipped) {
      lines.push(`| ${f.id} | ${f.skipped} |`);
    }
    lines.push('');
  }

  lines.push('## Per-segment 1 Hz measurement');
  lines.push('');
  lines.push(
    '| Activity | Mechanism | startSec | endSec | Committed m | Committed s | Committed speed (m/s) | 1 Hz samples in window | 1 Hz m | 1 Hz s | Max 1 Hz pair speed (m/s) | Burst exists at 1 Hz |'
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');

  let totalSegments = 0;
  let confirmedAt1Hz = 0;
  let notConfirmedAt1Hz = 0;
  let insufficientCount = 0;

  for (const f of ok) {
    for (const s of f.segments) {
      totalSegments++;
      const committedSpeed = s.committedMetres / s.committedSeconds;
      if (s.insufficientData) {
        insufficientCount++;
        lines.push(
          `| ${f.id} | ${s.mechanism} | ${s.startSec} | ${s.endSec} | ${fmt(s.committedMetres)} | ${fmt(s.committedSeconds)} | ${fmt(committedSpeed, 2)} | ${s.sampleCount} | — | — | — | insufficient 1 Hz data |`
        );
        continue;
      }
      if (s.burstExistsAt1Hz) confirmedAt1Hz++;
      else notConfirmedAt1Hz++;
      lines.push(
        `| ${f.id} | ${s.mechanism} | ${s.startSec} | ${s.endSec} | ${fmt(s.committedMetres)} | ${fmt(s.committedSeconds)} | ${fmt(committedSpeed, 2)} | ${s.sampleCount} | ${fmt(s.metres1Hz)} | ${fmt(s.seconds1Hz)} | ${fmt(s.maxPairSpeedMps, 2)} | ${s.burstExistsAt1Hz ? 'yes' : 'no'} |`
      );
    }
  }
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(
    `${totalSegments} segments sampled across ${ok.length} activities (${skipped.length} activities skipped — see above). ` +
      `${confirmedAt1Hz} of ${totalSegments} segments carry a 1 Hz consecutive-pair speed above the shipped ` +
      `${UNRELIABLE_SPEED_LIMIT_MPS} m/s limit inside their own window ("burst exists at 1 Hz"); ` +
      `${notConfirmedAt1Hz} do not (decimation's run-level folding produced a fast aggregate that no single 1 Hz ` +
      `consecutive pair reproduces); ${insufficientCount} had fewer than two 1 Hz distance samples inside the ` +
      'window (decimation removed the very samples that would let 1 Hz corroborate or refute the segment — ' +
      'the FIT recording auto-pauses, so a window can straddle a real recording gap).'
  );
  lines.push('');
  lines.push(
    'This is a validation-only cross-check: it neither derives nor moves any shipped constant ' +
      '(`UNRELIABLE_SPEED_LIMIT_MPS`, `UNRELIABLE_EXCESS_FLOOR_M`, `HIDDEN_PAUSE_MIN_METRES`), and ' +
      'a segment not confirmed at 1 Hz is not thereby un-flagged — D-11 already established that ' +
      'decimation-tracking is measured and reported, never used to exempt a stream or a segment.'
  );
  lines.push('');

  lines.push('## First evidence for STREAM-05');
  lines.push('');
  lines.push(
    'STREAM-05 (deferred at the v2.2 close, carried into v2.3 — see `.planning/PROJECT.md` § ' +
      'Active and `.planning/STATE.md`) asks whether re-deriving streams from the 1 Hz FIT ' +
      'originals, rather than the currently-committed decimated `t`/`d` arrays, would help. This ' +
      'report is the FIRST measured evidence bearing on that question for the unreliable-segment ' +
      'detector specifically.'
  );
  lines.push('');
  if (notConfirmedAt1Hz === 0 && insufficientCount === 0 && totalSegments > 0) {
    lines.push(
      `On this sample, all ${totalSegments} of ${totalSegments} segments the shipped detector ` +
        'flags on the decimated stream are corroborated by an actual 1 Hz consecutive-pair speed ' +
        'above the shipped limit inside the same window — this sample found NO case of decimated ' +
        'run-level folding manufacturing a fast-looking aggregate that a 1 Hz reading would not ' +
        'corroborate, and no case where decimation removed the very samples that would let 1 Hz ' +
        'judge the segment at all. That is evidence AGAINST re-deriving from 1 Hz improving ' +
        '*burst-existence* discrimination for this detector, at least at this sample size — it ' +
        'does not bear on the separate, still-open over-measurement-vs-jump discriminator ' +
        '(D-12\'s own text: "a reliable over-measurement-vs-jump discriminator would need ' +
        'lat/lng or the 1 Hz speed channel"), which this report does not attempt to resolve, ' +
        'since none of the sampled segments carry the ambiguous signature (sustained speed with ' +
        'reported GPS-geometry contradiction) that motivated the question. A STREAM-05 ' +
        're-derivation revisit is not required to close this phase; a larger or differently ' +
        'targeted sample (e.g. deliberately including a segment with that ambiguous signature, ' +
        'if the archive\'s FIT originals hold one) could still move this finding.'
    );
  } else {
    lines.push(
      `${confirmedAt1Hz} of ${totalSegments} sampled segments have their fast aggregate ` +
        'corroborated by an actual 1 Hz consecutive-pair speed above the limit; the remainder ' +
        `(${notConfirmedAt1Hz} not confirmed, ${insufficientCount} with too few 1 Hz points to ` +
        'judge) show that decimated run-level folding can either manufacture a fast-looking ' +
        'aggregate a 1 Hz reading would not corroborate, or that decimation removes exactly the ' +
        'samples that would settle the question either way — consistent with, but not sufficient ' +
        'to resolve on its own, the over-measurement-vs-jump discriminator the deferred item ' +
        'names (D-12\'s own text: "a reliable over-measurement-vs-jump discriminator would need ' +
        'lat/lng or the 1 Hz speed channel"). A STREAM-05 re-derivation revisit is not required ' +
        'to close this phase; this output is deliberately scoped as evidence for that future ' +
        'decision, not a recommendation to make it now.'
    );
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error('Usage: node scripts/validate-unreliable-segments-1hz.mjs --as-of YYYY-MM-DD');
    process.exitCode = 1;
    return;
  }

  const exportRoot = process.env.UNRELIABLE_1HZ_EXPORT_ROOT ?? 'export_data/strava';
  const csvPath = join(exportRoot, 'activities.csv');
  if (!existsSync(exportRoot) || !existsSync(csvPath)) {
    console.log(`Nothing to validate: ${exportRoot} not present (local-only, D-12).`);
    return;
  }

  const csvMap = loadCsvFilenameMap(csvPath);
  const sampleIds = buildSampleActivityIds(STREAMS_DIR, csvMap);

  const findings = [];
  for (const id of sampleIds) {
    findings.push(
      await buildActivityFinding(id, STREAMS_DIR, ACTIVITIES_DIR, csvMap, exportRoot)
    );
  }

  const report = renderReport(args.asOf, findings);
  writeFileSync(OUTPUT_PATH, report);
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Sampled ${sampleIds.length} activities.`);
}

// Self-execution guard: `main()` runs only under direct invocation. This file deliberately has
// no `.test.mjs` sibling (D-12), but the guard is kept for structural consistency with every
// other generator under `scripts/` and to keep `main()` out of the module's import-time path.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
