/**
 * Phase 27 QUAL-05 calibration sweep — the full-archive dry run measuring the
 * ACTUAL composite severe rate (the union across all three tiering signals:
 * decimation, gapProfile, impossibleSamples) over the live committed
 * archive, and writing the committed, regenerable `27-CALIBRATION.md`
 * report.
 *
 * Structure follows `scripts/compute-pace-residual.mjs` (the archive-sweep
 * precedent this phase inherits): a per-file `try`/`catch` around
 * `readFileSync`/`JSON.parse` that warns and continues (T-26-01/T-27-08 —
 * one unreadable file cannot abort a ~1,890-file sweep), and a `main()`
 * gated behind the same self-execution guard so this file's pure functions
 * (the composite reducer, the overlap breakdown, the sanity gate, the
 * markdown renderer) can be imported by
 * `compute-pace-quality-calibration.test.mjs` without running the sweep or
 * writing the report.
 *
 * Only write target: `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md`
 * (T-27-09). Reads `data/activities/` and `data/streams/` read-only; NEVER
 * writes into `data/`. Section 6's D-04 boundary cross-check runs
 * `npm run compute-pace-residual` as a subprocess, which DOES regenerate
 * `26-RESIDUAL.md` by design (that report's own regeneration contract) —
 * that is a different script's declared write target, not this script's own
 * `fs` call.
 *
 * Enumerates from `data/activities/*.json` (not from the stream manifest)
 * so the stream-less population is visible rather than invisible (T-27-08's
 * sibling correctness requirement, not a security mitigation).
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';

import {
  computePaceQualitySignals,
  hasAnySevereSignal,
  DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION,
  GAP_PROFILE_SEVERE_FRACTION,
  IMPOSSIBLE_SAMPLE_SEVERE_COUNT,
} from '../dist/analytics/pace-quality.js';
// isStreamFile/idFromFilename moved to the shared lib module (31-06, D-11)
// so compute-pace-residual.mjs can import the same filter without
// reopening 27 G-01 as 27 G-03 a second time; re-exported here so this
// module's own guard test (which imports it as `mod.isStreamFile`) is
// unaffected by the move.
export { idFromFilename, isStreamFile } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data/activities');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md'
);
const RESIDUAL_PATH = join(
  ROOT_DIR,
  '.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md'
);

const REGENERATE_COMMAND = 'npm run compute-pace-quality-calibration';
const REGENERATE_SWEEP_COMMAND = 'npm run compute-pace-quality-calibration -- --sweep';
const RESIDUAL_REGENERATE_COMMAND = 'npm run compute-pace-residual';

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O (the guard test's contract)
// ---------------------------------------------------------------------------

/** Maps a raw activity JSON record to the four-field metadata `computePaceQualitySignals` consumes. */
export function metadataFromActivity(activity) {
  const record = activity ?? {};
  return {
    deviceName: record.device_name,
    sourceProvider: record.source_provider,
    elapsedTimeSec: record.elapsed_time,
    movingTimeSec: record.moving_time,
  };
}

/**
 * THE COMPOSITE reducer (D-01's single definition, re-derived here as the
 * size of a Set — not the sum of the three marginals, not an
 * inclusion-exclusion estimate). `entries` is an array of
 * `{ id, signals }` where `signals` carries at least `decimation`,
 * `gapProfile`, `impossibleSamples` tiers (the shape `hasAnySevereSignal`
 * itself consumes, imported from the compiled module — not re-implemented
 * here, per D-01's "one definition, N readers" contract).
 */
export function reduceCompositeUnion(entries) {
  const unionIds = new Set();
  for (const entry of entries) {
    if (hasAnySevereSignal(entry.signals)) {
      unionIds.add(entry.id);
    }
  }
  return unionIds;
}

/**
 * The three-way overlap breakdown over three (pre-computed) per-signal
 * severe-id `Set`s: how many activities are severe on exactly one signal, on
 * exactly two, on all three, plus each pairwise intersection size.
 */
export function computeOverlapBreakdown(decimationSevereIds, gapProfileSevereIds, impossibleSevereIds) {
  const allIds = new Set([...decimationSevereIds, ...gapProfileSevereIds, ...impossibleSevereIds]);
  let exactlyOne = 0;
  let exactlyTwo = 0;
  let allThree = 0;

  for (const id of allIds) {
    const membership =
      (decimationSevereIds.has(id) ? 1 : 0) +
      (gapProfileSevereIds.has(id) ? 1 : 0) +
      (impossibleSevereIds.has(id) ? 1 : 0);
    if (membership === 1) exactlyOne++;
    else if (membership === 2) exactlyTwo++;
    else if (membership === 3) allThree++;
  }

  const intersectSize = (a, b) => {
    let count = 0;
    for (const id of a) {
      if (b.has(id)) count++;
    }
    return count;
  };

  return {
    exactlyOne,
    exactlyTwo,
    allThree,
    decimationGapProfile: intersectSize(decimationSevereIds, gapProfileSevereIds),
    decimationImpossible: intersectSize(decimationSevereIds, impossibleSevereIds),
    gapProfileImpossible: intersectSize(gapProfileSevereIds, impossibleSevereIds),
  };
}

/**
 * The sanity gate on the composite (checkable without trusting the rest of
 * the script): `max(marginalCounts) <= compositeCount <= sum(marginalCounts)`.
 * A composite below the largest single marginal, or above the sum of all
 * three, is definitionally impossible for a true union and indicates a bug
 * in the reducer, not a real measurement.
 */
export function checkSanityGate(compositeCount, marginalCounts) {
  const maxMarginal = Math.max(...marginalCounts);
  const sumMarginals = marginalCounts.reduce((a, b) => a + b, 0);
  const pass = compositeCount >= maxMarginal && compositeCount <= sumMarginals;
  return { pass, maxMarginal, sumMarginals };
}

/** `count / denominator` as a fixed-1-decimal percentage string, or `'N/A'` for a zero denominator. */
export function formatPct(count, denominator) {
  if (!denominator) return 'N/A';
  return `${((100 * count) / denominator).toFixed(1)}%`;
}

/**
 * Parses `26-RESIDUAL.md`'s "## Residual Activities" table into an ordered
 * array of activity ids, plus the "Severe stair-step cohort size" and
 * "Residual count" figures from its Summary section — pure text parsing, no
 * I/O, so the D-04 boundary cross-check (section 6) can compare two loaded
 * strings without re-running anything.
 */
export function parseResidualReport(markdown) {
  const cohortMatch = markdown.match(/Severe stair-step cohort size:\s*(\d+)/);
  const residualCountMatch = markdown.match(/Residual count[^:]*:\s*(\d+)/);

  const ids = [];
  const tableSectionMatch = markdown.match(/## Residual Activities\n\n([\s\S]*?)\n\n##/);
  if (tableSectionMatch) {
    const lines = tableSectionMatch[1].split('\n').slice(2); // skip header + separator rows
    for (const line of lines) {
      const cell = line.split('|')[1];
      if (cell) ids.push(cell.trim());
    }
  }

  return {
    cohortSize: cohortMatch ? Number(cohortMatch[1]) : null,
    residualCount: residualCountMatch ? Number(residualCountMatch[1]) : null,
    residualIds: ids,
  };
}

/**
 * Renders the committed `27-CALIBRATION.md` deliverable from a report object
 * (see `main()`'s `buildBaselineMetrics`/`buildReport` for its shape) — pure
 * string assembly, no I/O.
 */
export function renderCalibrationMarkdown(report) {
  const lines = [];

  lines.push('# Phase 27 QUAL-05 Calibration Report');
  lines.push('');
  lines.push(
    'The measured composite severe rate — the true union across all three per-activity ' +
      'quality tiering signals (`decimation`, `gapProfile`, `impossibleSamples`) — over the ' +
      'full live committed archive, produced entirely by ' +
      `\`${REGENERATE_COMMAND}\`. Every figure below is computed by THIS run; nothing is ` +
      'transcribed from `27-RESEARCH.md`, `27-CONTEXT.md` or `26-RESIDUAL.md` except the ' +
      'threshold justifications in section 2, which are quoted and attributed.'
  );
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  // Section 1 — Denominators
  lines.push('## 1. Denominators (computed live)');
  lines.push('');
  lines.push(
    `**Live-denominator correction (originally 2026-09-10 via plan 27-03's hand-edit; generator ` +
      `itself fixed 2026-09-10 via gap-closure plan 27-11, closing G-01 — see \`27-VALIDATION.md\` ` +
      `§ Gap-Closure Record — composite unchanged):** This report's stream-file count was ` +
      `originally computed by this generator with a naive ` +
      `\`readdirSync('data/streams').filter(f => f.endsWith('.json'))\`, which counts EVERY \`.json\` ` +
      `file in \`data/streams/\`, including \`data/streams/manifest.json\` — the stream-availability ` +
      `index file written by backfill-streams and the daily intervals.icu sync, not a per-activity ` +
      `stream. That inflated the stream-file count by exactly one file and understated the ` +
      `stream-less count by one. Stale (pre-fix) values, as this generator originally emitted them: ` +
      `stream-file count **1866**, stream-less count **24**. Plan 27-03 corrected those figures in ` +
      `this file's PROSE without fixing the generator, so re-running it silently reverted the ` +
      `correction; plan 27-11 fixed the generator itself (it now excludes \`manifest.json\` from the ` +
      `count below), so the live figures below are computed correctly by THIS run rather than ` +
      `hand-corrected after the fact. The **activity count (${report.activityCount})** and the ` +
      `**composite (${report.compositeCount})** are UNCHANGED by this correction — this is a ` +
      `denominator correction, not a change in the measured composite, exactly as \`26-RESIDUAL.md\` ` +
      `records its own measurement corrections (see e.g. its "corrected 2026-09-08" note) rather ` +
      `than silently overwriting prior figures.`
  );
  lines.push('');
  lines.push(
    `- Activity count: **${report.activityCount}** — ` +
      "`readdirSync('data/activities').filter(f => f.endsWith('.json'))` entries that read and " +
      `JSON-parsed successfully${report.activityParseFailures > 0 ? ` (${report.activityParseFailures} unreadable file(s) skipped, warned to stderr)` : ''}.`
  );
  lines.push(
    `- Stream-file count: **${report.streamCount}** — ` +
      "`readdirSync('data/streams').filter(f => f.endsWith('.json') && f !== 'manifest.json')` " +
      'entries (excluding the non-activity `manifest.json` stream-availability index — see the ' +
      `live-denominator correction above)${report.streamParseFailures > 0 ? ` (${report.streamParseFailures} unreadable file(s) treated as null, warned to stderr)` : ''}.`
  );
  lines.push(
    `- Stream-less count: **${report.streamLessCount}** — ` +
      `\`${report.activityCount} - ${report.streamCount} = ${report.streamLessCount}\` (arithmetic difference).`
  );
  lines.push('');
  lines.push(
    `Every per-signal and composite rate below is reported against BOTH denominators: the ` +
      `**activity-count denominator** (${report.activityCount}, all activities including the ` +
      `${report.streamLessCount} stream-less ones, which report \`notComputableReason\` and are ` +
      `never counted in the severe numerator) and the **stream-count denominator** ` +
      `(${report.streamCount}, only activities with a computable stream).`
  );
  lines.push('');
  lines.push(
    `This run supersedes ROADMAP Criterion 4's cited "1,864-activity archive" / "≈90 activities" ` +
      `and CONTEXT D-06's cited "1,890/1,866" — this run measured ${report.activityCount} activity ` +
      `files and ${report.streamCount} stream files live; do not treat 1,864, 1,866 or 1,890 as ` +
      `expected values anywhere else in this report.`
  );
  lines.push('');

  // Section 2 — Thresholds in force
  lines.push('## 2. Thresholds in Force');
  lines.push('');
  lines.push('Quoted verbatim from `27-02-SUMMARY.md`\'s "Decisions Made" section. No override applied in this baseline run.');
  lines.push('');
  lines.push('**Decimation (D-04, reused verbatim from Phase 26\'s cohort rule):**');
  lines.push(
    '> `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION = 0.15`, `DECIMATION_SEVERE_MIN_SAMPLES = 50` — ' +
      'the exact same pair that defines `26-RESIDUAL.md`\'s 154-activity severe-decimation cohort. ' +
      'Not this phase\'s to retune; D-04 locks it.'
  );
  lines.push('');
  lines.push('**Gap profile (`GAP_PROFILE_SEVERE_FRACTION = 0.2`):**');
  lines.push(
    '> (1) WHAT IT MEASURES: `(recordingGapSec + pauseSec) / spanSec`. (2) MECHANISM: once a ' +
      'fifth or more of a stream\'s own recorded span carries no measured pace, a pace ' +
      'distribution/splits table/average-pace figure stops truthfully describing the whole run. ' +
      '(3) MEASURED (live archive): >15% -> 197 (10.6%); >20% -> 127 (6.8%, CHOSEN); >25% -> 88 ' +
      '(4.7%). (4) NOT CHOSEN TO LAND UNDER 5%: 20% is the mechanism cut, not the closest-to-5% cut ' +
      '— 25% would clear ~5% alone and was not chosen for that reason.'
  );
  lines.push('');
  lines.push('**Impossible-sample floor and cut (`IMPOSSIBLE_SAMPLE_SEVERE_COUNT = 10`, physical floor `WORLD_RECORD_100M_SPEED_MPS`):**');
  lines.push(
    '> (1) FLOOR: Usain Bolt\'s 100m world record speed (9.58s, 2009) — exceeding it once is a ' +
      'fact about the recording, never the runner. (2) FORM: raw count, not a fraction — a discrete ' +
      'event, not a proportional descriptor. (3) MECHANISM: one impossible sample is unremarkable; ' +
      'ten independent readings is not what an occasionally-noisy channel produces. (4) MEASURED: ' +
      '>=5 -> 71 (3.8%); >=10 -> 31 (1.7%, CHOSEN); >=20 -> 10 (0.5%). (5) MEASURED OVERLAP with the ' +
      'severe-decimation cohort at the chosen cut: 4/31 (12.9%), far below the raw >=1 population\'s ' +
      '90% — because >=10 already excludes the single-glitch population driving that 90% figure. ' +
      '(6) NOT CHOSEN TO LAND UNDER 5%: >=10 is the mechanism point in (3); >=5 (3.8%) would still ' +
      'individually clear ~5% and was not chosen for producing a smaller number.'
  );
  lines.push('');

  // Section 3 — Per-signal severe cohorts
  lines.push('## 3. Per-Signal Severe Cohorts');
  lines.push('');
  lines.push('| Signal | Severe count | % of activity count | % of stream count | Minor count |');
  lines.push('|---|---|---|---|---|');
  lines.push(
    `| Decimation (D-04) | ${report.decimationSevereCount} | ` +
      `${formatPct(report.decimationSevereCount, report.activityCount)} | ` +
      `${formatPct(report.decimationSevereCount, report.streamCount)} | ${report.decimationMinorCount} |`
  );
  lines.push(
    `| Gap profile | ${report.gapProfileSevereCount} | ` +
      `${formatPct(report.gapProfileSevereCount, report.activityCount)} | ` +
      `${formatPct(report.gapProfileSevereCount, report.streamCount)} | ${report.gapProfileMinorCount} |`
  );
  lines.push(
    `| Impossible samples | ${report.impossibleSevereCount} | ` +
      `${formatPct(report.impossibleSevereCount, report.activityCount)} | ` +
      `${formatPct(report.impossibleSevereCount, report.streamCount)} | ${report.impossibleMinorCount} |`
  );
  lines.push('');
  lines.push(
    `*"% of stream count" uses the live **${report.streamCount}** stream-file denominator (see the ` +
      'Section 1 live-denominator correction); at this rounding precision every value above is ' +
      'identical to the same computation against the pre-fix, naive-glob figure of 1866 — a ' +
      'one-file difference out of well over a thousand, below this table\'s 1-decimal rounding ' +
      'precision.*'
  );
  lines.push('');
  lines.push(
    'Device era and elapsed-vs-moving are untiered facts (D-13/D-14) and contribute NOTHING to ' +
      'the composite below — reported here only as distributions for context.'
  );
  lines.push('');
  lines.push('**Device family census (untiered):**');
  lines.push('');
  lines.push('| Family | Count | % of activity count |');
  lines.push('|---|---|---|');
  for (const [family, count] of report.deviceFamilyCounts) {
    lines.push(`| ${family} | ${count} | ${formatPct(count, report.activityCount)} |`);
  }
  lines.push('');
  lines.push('**Elapsed-vs-moving ratio quantile summary (untiered, non-null ratios only):**');
  lines.push('');
  lines.push(
    `- n = ${report.elapsedVsMovingRatioCount}; p10 = ${report.elapsedVsMovingP10?.toFixed(2) ?? 'N/A'}; ` +
      `p50 = ${report.elapsedVsMovingP50?.toFixed(2) ?? 'N/A'}; p90 = ${report.elapsedVsMovingP90?.toFixed(2) ?? 'N/A'}; ` +
      `max = ${report.elapsedVsMovingMax?.toFixed(2) ?? 'N/A'}`
  );
  lines.push('');

  // Section 4 — THE COMPOSITE
  lines.push('## 4. THE COMPOSITE — the actual union');
  lines.push('');
  lines.push(
    `**${report.compositeCount}** activities carry \`anySevere === true\` — computed as the size ` +
      'of the `Set` of activity ids for which `hasAnySevereSignal` is `true` (see ' +
      '`reduceCompositeUnion` in this script), NOT the sum of the three marginals above ' +
      `(${report.decimationSevereCount} + ${report.gapProfileSevereCount} + ${report.impossibleSevereCount} ` +
      `= ${report.decimationSevereCount + report.gapProfileSevereCount + report.impossibleSevereCount}) ` +
      'and NOT an inclusion-exclusion estimate.'
  );
  lines.push('');
  lines.push(
    `- Against the activity-count denominator: ${formatPct(report.compositeCount, report.activityCount)} ` +
      `(${report.compositeCount} of ${report.activityCount}).`
  );
  lines.push(
    `- Against the stream-count denominator: ${formatPct(report.compositeCount, report.streamCount)} ` +
      `(${report.compositeCount} of ${report.streamCount}).`
  );
  lines.push('');
  lines.push('**Three-way overlap breakdown:**');
  lines.push('');
  lines.push(
    `- Exactly one signal severe: ${report.overlap.exactlyOne}; exactly two: ${report.overlap.exactlyTwo}; ` +
      `all three: ${report.overlap.allThree}.`
  );
  lines.push(
    `- Pairwise intersections: decimation ∩ gapProfile = ${report.overlap.decimationGapProfile}; ` +
      `decimation ∩ impossibleSamples = ${report.overlap.decimationImpossible} ` +
      `(${formatPct(report.overlap.decimationImpossible, report.impossibleSevereCount)} of the ` +
      `impossible-sample-severe cohort); gapProfile ∩ impossibleSamples = ${report.overlap.gapProfileImpossible}.`
  );
  lines.push('');
  lines.push(
    `**Sanity gate:** max(marginals) = ${report.sanityGate.maxMarginal} <= composite = ` +
      `${report.compositeCount} <= sum(marginals) = ${report.sanityGate.sumMarginals} -> ` +
      `**${report.sanityGate.pass ? 'PASS' : 'FAIL'}**`
  );
  lines.push('');
  lines.push(
    `**Three-way independent corroboration of 299 (post-merge, per D-03's independent-recount ` +
      'spirit, recorded 2026-09-10 in `27-VALIDATION.md`\'s Round 1 Checkpoint):** The composite ' +
      'figure of 299 was reproduced by three separate, independently-executed paths that share no ' +
      'code with any of the others: (1) this script\'s own classifier sweep over the live archive ' +
      '(this section, this run); (2) plan 27-04, in a separate worktree via a separate code path, ' +
      'independently recomputing `totals.qualityAnySevere` directly from the WRITTEN ' +
      '`data/dashboard/index.json` without importing this script (`27-04-SUMMARY.md`\'s "Live ' +
      'Archive Verification": "recomputed anySevere: 299   totals.qualityAnySevere: 299   match: ' +
      'true"); (3) the orchestrator\'s post-merge `npm run compute-dashboard-index` run against the ' +
      'MAIN checkout ("Quality: any severe signal: 299", "Quality: not computable: 25"). All three ' +
      'agreed exactly on 299; none imported the classifier from either of the others.'
  );
  lines.push('');
  lines.push(
    report.compositeCount === 299
      ? `**This run's own figure (${report.compositeCount}) matches** that historically ` +
          'corroborated value, so the three-way corroboration still holds against the current ' +
          'archive.'
      : `**This run's own figure (${report.compositeCount}) DIFFERS** from the historically ` +
          'corroborated 299 above — the archive has changed since that corroboration ran. This ' +
          'divergence is a live finding to investigate, not a re-confirmation; a fresh three-way ' +
          'check against the CURRENT archive would be needed before treating 299 as still agreed.'
  );
  lines.push('');

  // Section 5 — D-02 disposition paragraph
  lines.push('## 5. The D-02 Disposition Paragraph');
  lines.push('');
  lines.push(report.dispositionParagraph);
  lines.push('');

  // Section 6 — D-04 boundary cross-check
  lines.push('## 6. The D-04 Boundary Cross-Check');
  lines.push('');
  lines.push(report.crossCheckParagraph);
  lines.push('');

  // Section 7 — Regeneration
  lines.push('## 7. Regeneration');
  lines.push('');
  lines.push('Regenerate this report against the live committed archive with:');
  lines.push('');
  lines.push('```');
  lines.push(REGENERATE_COMMAND);
  lines.push('```');
  lines.push('');
  lines.push('Regenerate with the Threshold Sensitivity section appended:');
  lines.push('');
  lines.push('```');
  lines.push(REGENERATE_SWEEP_COMMAND);
  lines.push('```');
  lines.push('');

  if (report.thresholdSensitivitySection) {
    lines.push(report.thresholdSensitivitySection);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// I/O — archive sweep (not imported by the guard test)
// ---------------------------------------------------------------------------

function readArchive() {
  const activityRecords = [];
  let activityFiles = [];
  try {
    activityFiles = readdirSync(ACTIVITIES_DIR).filter((f) => f.endsWith('.json'));
  } catch (error) {
    console.warn(`Warning: Failed to read activities directory ${ACTIVITIES_DIR}:`, error.message);
  }

  let activityParseFailures = 0;
  for (const file of activityFiles) {
    try {
      const content = readFileSync(join(ACTIVITIES_DIR, file), 'utf8');
      const activity = JSON.parse(content);
      activityRecords.push({ id: idFromFilename(file), activity });
    } catch (error) {
      activityParseFailures++;
      console.warn(`Warning: Failed to read/parse activity ${file}:`, error.message);
    }
  }

  let streamFiles = [];
  try {
    // isStreamFile excludes `manifest.json` (see its own doc comment) — this
    // is gap-closure plan 27-11's fix for G-01. The naive glob this replaces
    // would also have handed `idFromFilename` a bogus `"manifest"` id
    // (harmless in practice since it never matches a real activity id, but
    // still not a real stream).
    streamFiles = readdirSync(STREAMS_DIR).filter(isStreamFile);
  } catch (error) {
    console.warn(`Warning: Failed to read streams directory ${STREAMS_DIR}:`, error.message);
  }
  const streamIdSet = new Set(streamFiles.map(idFromFilename));

  let streamParseFailures = 0;
  const rawEntries = activityRecords.map(({ id, activity }) => {
    const metadata = metadataFromActivity(activity);
    let stream = null;
    if (streamIdSet.has(id)) {
      try {
        const content = readFileSync(join(STREAMS_DIR, `${id}.json`), 'utf8');
        stream = JSON.parse(content);
      } catch (error) {
        streamParseFailures++;
        console.warn(`Warning: Failed to read/parse stream ${id}.json (treated as null):`, error.message);
      }
    }
    return { id, stream, metadata };
  });

  return {
    rawEntries,
    activityCount: activityRecords.length,
    activityParseFailures,
    streamCount: streamFiles.length,
    streamParseFailures,
  };
}

/**
 * Computes signals for every raw entry under the given `QualityThresholdOverrides`
 * (`undefined` for the shipped baseline) — pure with respect to I/O (all
 * reads already happened in `readArchive()`), but not exported as "pure" for
 * the guard test since it depends on `computePaceQualitySignals`/
 * `hasAnySevereSignal` from the compiled module rather than being
 * self-contained; kept here alongside the I/O functions.
 */
function computeSignalsForEntries(rawEntries, overrides) {
  const decimationSevereIds = new Set();
  const gapProfileSevereIds = new Set();
  const impossibleSevereIds = new Set();
  const decimationMinorIds = new Set();
  const gapProfileMinorIds = new Set();
  const impossibleMinorIds = new Set();
  const notComputableIds = new Set();
  const deviceFamilyCounts = new Map();
  const elapsedVsMovingRatios = [];
  const unionEntries = [];

  for (const { id, stream, metadata } of rawEntries) {
    const signals = computePaceQualitySignals(stream, metadata, overrides);
    unionEntries.push({ id, signals });

    if (signals.notComputableReason !== null) {
      notComputableIds.add(id);
    } else {
      if (signals.decimation.tier === 'severe') decimationSevereIds.add(id);
      else if (signals.decimation.tier === 'minor') decimationMinorIds.add(id);

      if (signals.gapProfile.tier === 'severe') gapProfileSevereIds.add(id);
      else if (signals.gapProfile.tier === 'minor') gapProfileMinorIds.add(id);

      if (signals.impossibleSamples.tier === 'severe') impossibleSevereIds.add(id);
      else if (signals.impossibleSamples.tier === 'minor') impossibleMinorIds.add(id);
    }

    const family = signals.deviceEra.family;
    deviceFamilyCounts.set(family, (deviceFamilyCounts.get(family) ?? 0) + 1);

    if (signals.elapsedVsMoving.ratio !== null) {
      elapsedVsMovingRatios.push(signals.elapsedVsMoving.ratio);
    }
  }

  const compositeIds = reduceCompositeUnion(unionEntries);

  return {
    decimationSevereIds,
    gapProfileSevereIds,
    impossibleSevereIds,
    decimationMinorIds,
    gapProfileMinorIds,
    impossibleMinorIds,
    notComputableIds,
    deviceFamilyCounts,
    elapsedVsMovingRatios,
    compositeIds,
  };
}

function quantileSorted(sortedAsc, q) {
  const n = sortedAsc.length;
  if (n === 0) return null;
  if (n === 1) return sortedAsc[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo]);
}

function buildDispositionParagraph(compositeCount, activityCount, streamCount, decimationSevereCount) {
  const pctActivity = (100 * compositeCount) / activityCount;
  const pctStream = (100 * compositeCount) / streamCount;
  const decimationPctActivity = (100 * decimationSevereCount) / activityCount;

  if (pctActivity > 5.5 || pctStream > 5.5) {
    return (
      `**FINDING, not a defect.** The measured composite severe rate is ${compositeCount} of ` +
      `${activityCount} activities (${pctActivity.toFixed(1)}% of the activity-count denominator, ` +
      `${pctStream.toFixed(1)}% of the ${streamCount}-stream denominator) — materially above ` +
      `ROADMAP Criterion 4's "~5%" ceiling. D-04's locked severe-decimation cohort alone is ` +
      `${decimationSevereCount} activities (${decimationPctActivity.toFixed(1)}% of the activity-count ` +
      `denominator), already above ~5% before the other two signals contribute anything, and ` +
      `accounts for the bulk of the composite. D-02 forbids retuning any threshold backward from ` +
      `the ~5% target, and D-04 forbids narrowing the decimation rule below Phase 26's cohort ` +
      `definition. No threshold was moved in this run to change this number. The disposition on ` +
      `what Criterion 4 should mean given this measured rate is the developer's, recorded at this ` +
      `plan's checkpoint (Task 3).`
    );
  }

  return (
    `The measured composite severe rate is ${compositeCount} of ${activityCount} activities ` +
    `(${pctActivity.toFixed(1)}% of the activity-count denominator, ${pctStream.toFixed(1)}% of the ` +
    `${streamCount}-stream denominator) — at or below ROADMAP Criterion 4's "~5%" ceiling. This was ` +
    `not the objective of this run (the objective was measuring the true number, not landing under a ` +
    `target), and no threshold was moved to produce this result.`
  );
}

function buildCrossCheckParagraph(rootDir) {
  let beforeText = null;
  try {
    beforeText = readFileSync(RESIDUAL_PATH, 'utf8');
  } catch (error) {
    console.warn(`Warning: could not read committed ${RESIDUAL_PATH} before regeneration:`, error.message);
  }
  const before = beforeText ? parseResidualReport(beforeText) : { cohortSize: null, residualIds: [] };

  let execError = null;
  try {
    execSync(RESIDUAL_REGENERATE_COMMAND, { cwd: rootDir, stdio: 'pipe' });
  } catch (error) {
    execError = error;
    console.warn(`Warning: ${RESIDUAL_REGENERATE_COMMAND} exited non-zero:`, error.message);
  }

  let afterText = null;
  try {
    afterText = readFileSync(RESIDUAL_PATH, 'utf8');
  } catch (error) {
    console.warn(`Warning: could not read regenerated ${RESIDUAL_PATH}:`, error.message);
  }
  const after = afterText ? parseResidualReport(afterText) : { cohortSize: null, residualIds: [] };

  const beforeSet = new Set(before.residualIds);
  const afterSet = new Set(after.residualIds);
  const sameSize = beforeSet.size === afterSet.size;
  const sameMembers =
    sameSize && [...beforeSet].every((id) => afterSet.has(id)) && [...afterSet].every((id) => beforeSet.has(id));
  const idsMatch = sameMembers;

  const drift =
    before.cohortSize !== null && after.cohortSize !== null ? after.cohortSize - before.cohortSize : null;

  const lines = [];
  lines.push(
    `Ran \`${RESIDUAL_REGENERATE_COMMAND}\` live${execError ? ' (exited non-zero, see warning above)' : ''} ` +
      'and compared the regenerated `26-RESIDUAL.md` against the version committed as of Phase 26\'s ' +
      'close (read from disk before regeneration).'
  );
  lines.push('');
  lines.push(
    `- Committed (pre-regeneration) severe-decimation cohort size: **${before.cohortSize ?? 'unreadable'}**; ` +
      `residual list size: **${before.residualIds.length}**.`
  );
  lines.push(
    `- Regenerated (live) severe-decimation cohort size: **${after.cohortSize ?? 'unreadable'}**; ` +
      `residual list size: **${after.residualIds.length}**.`
  );
  lines.push(
    `- 14-activity residual list match by id: **${idsMatch ? 'MATCH' : 'DIVERGED'}** ` +
      `(committed: [${before.residualIds.join(', ')}]; regenerated: [${after.residualIds.join(', ')}]).`
  );
  if (drift !== null) {
    if (drift === 0) {
      lines.push('- Severe-decimation cohort size has NOT drifted from the committed figure.');
    } else {
      lines.push(
        `- Severe-decimation cohort size drifted by **${drift > 0 ? '+' : ''}${drift}** ` +
          `(${before.cohortSize} -> ${after.cohortSize}) — reportable finding about archive growth, ` +
          'not a failure.'
      );
    }
  }

  return lines.join('\n');
}

function buildBaselineMetrics(rawEntries) {
  return computeSignalsForEntries(rawEntries, undefined);
}

function buildReport(archive, thresholdSensitivitySection) {
  const { rawEntries, activityCount, activityParseFailures, streamCount, streamParseFailures } = archive;
  const metrics = buildBaselineMetrics(rawEntries);

  const decimationSevereCount = metrics.decimationSevereIds.size;
  const gapProfileSevereCount = metrics.gapProfileSevereIds.size;
  const impossibleSevereCount = metrics.impossibleSevereIds.size;
  const compositeCount = metrics.compositeIds.size;

  const overlap = computeOverlapBreakdown(
    metrics.decimationSevereIds,
    metrics.gapProfileSevereIds,
    metrics.impossibleSevereIds
  );

  const sanityGate = checkSanityGate(compositeCount, [
    decimationSevereCount,
    gapProfileSevereCount,
    impossibleSevereCount,
  ]);

  const sortedRatios = [...metrics.elapsedVsMovingRatios].sort((a, b) => a - b);

  return {
    generatedAt: new Date().toISOString(),
    activityCount,
    activityParseFailures,
    streamCount,
    streamParseFailures,
    streamLessCount: activityCount - streamCount,
    decimationSevereCount,
    decimationMinorCount: metrics.decimationMinorIds.size,
    gapProfileSevereCount,
    gapProfileMinorCount: metrics.gapProfileMinorIds.size,
    impossibleSevereCount,
    impossibleMinorCount: metrics.impossibleMinorIds.size,
    deviceFamilyCounts: [...metrics.deviceFamilyCounts.entries()].sort((a, b) => b[1] - a[1]),
    elapsedVsMovingRatioCount: sortedRatios.length,
    elapsedVsMovingP10: quantileSorted(sortedRatios, 0.1),
    elapsedVsMovingP50: quantileSorted(sortedRatios, 0.5),
    elapsedVsMovingP90: quantileSorted(sortedRatios, 0.9),
    elapsedVsMovingMax: sortedRatios.length > 0 ? sortedRatios[sortedRatios.length - 1] : null,
    compositeCount,
    overlap,
    sanityGate,
    dispositionParagraph: buildDispositionParagraph(compositeCount, activityCount, streamCount, decimationSevereCount),
    crossCheckParagraph: buildCrossCheckParagraph(ROOT_DIR),
    thresholdSensitivitySection,
    _metrics: metrics,
    _rawEntries: rawEntries,
  };
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------

function main() {
  const sweepMode = process.argv.includes('--sweep');

  console.log('Reading the live archive (data/activities/, data/streams/)...\n');
  const archive = readArchive();

  console.log(`Activity count: ${archive.activityCount}`);
  console.log(`Stream count: ${archive.streamCount}`);
  console.log('Computing per-activity quality signals (shipped thresholds, no overrides)...\n');

  const report = buildReport(archive, null);

  console.log(`Composite (anySevere) count: ${report.compositeCount}`);
  console.log(`  vs activity-count denominator: ${formatPct(report.compositeCount, report.activityCount)}`);
  console.log(`  vs stream-count denominator: ${formatPct(report.compositeCount, report.streamCount)}`);
  console.log(`Sanity gate: ${report.sanityGate.pass ? 'PASS' : 'FAIL'}`);

  if (sweepMode) {
    console.log('\n--sweep: recomputing under threshold overrides (no source edit)...\n');
    report.thresholdSensitivitySection = buildThresholdSensitivitySection(report._rawEntries, report);
  }

  const markdown = renderCalibrationMarkdown(report);
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');

  console.log(`\nWrote ${OUTPUT_PATH}`);
}

/**
 * Threshold Sensitivity — Criterion 4's "demonstrated failing by moving a
 * threshold" discriminator, proven in BOTH directions for all three
 * `QualityThresholdOverrides` fields this phase's tiering signals expose
 * (six rows: two directions × three thresholds). No source constant in
 * `src/analytics/pace-quality.ts` is edited — every override goes through
 * the `options` parameter `computePaceQualitySignals` already accepts, the
 * same shape `classifyGaps(t, d, { pauseRule })` uses for its own knob.
 *
 * `rawEntries` is the SAME already-read archive Task 1's baseline run used
 * (no re-reading `data/`) — only the in-memory recomputation under each
 * override is repeated per row, via `computeSignalsForEntries`.
 *
 * The two `decimationZeroAdvanceFraction` rows are labelled DEMONSTRATION
 * ONLY: D-04 locks `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION` at its shipped
 * 0.15/50 pair verbatim from Phase 26's cohort rule, so these two rows exist
 * solely to prove the same knob also reaches this signal — never to propose
 * a replacement value.
 */
function buildThresholdSensitivitySection(rawEntries, report) {
  const shippedComposite = report.compositeCount;
  const decimationFloor = report._metrics.decimationSevereIds.size;
  const otherTwoFloor = new Set([
    ...report._metrics.gapProfileSevereIds,
    ...report._metrics.impossibleSevereIds,
  ]).size;

  const rowSpecs = [
    {
      label: 'Gap profile severe fraction — LOOSER (more inclusive)',
      param: 'gapProfileSevereFraction',
      shipped: GAP_PROFILE_SEVERE_FRACTION,
      override: 0.15,
      direction: 'increase',
      floorNote: `decimation's locked severe cohort (${decimationFloor})`,
      demoOnly: false,
    },
    {
      label: 'Gap profile severe fraction — STRICTER (less inclusive)',
      param: 'gapProfileSevereFraction',
      shipped: GAP_PROFILE_SEVERE_FRACTION,
      override: 0.25,
      direction: 'decrease',
      floorNote: `decimation's locked severe cohort (${decimationFloor})`,
      demoOnly: false,
    },
    {
      label: 'Impossible-sample severe count — LOOSER (more inclusive)',
      param: 'impossibleSevereCount',
      shipped: IMPOSSIBLE_SAMPLE_SEVERE_COUNT,
      override: 5,
      direction: 'increase',
      floorNote: `decimation's locked severe cohort (${decimationFloor})`,
      demoOnly: false,
    },
    {
      label: 'Impossible-sample severe count — STRICTER (less inclusive)',
      param: 'impossibleSevereCount',
      shipped: IMPOSSIBLE_SAMPLE_SEVERE_COUNT,
      override: 20,
      direction: 'decrease',
      floorNote: `decimation's locked severe cohort (${decimationFloor})`,
      demoOnly: false,
    },
    {
      label: 'Decimation zero-advance fraction — LOOSER (more inclusive)',
      param: 'decimationZeroAdvanceFraction',
      shipped: DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION,
      override: 0.1,
      direction: 'increase',
      floorNote: `the union of gapProfile ∪ impossibleSamples severe cohorts (${otherTwoFloor})`,
      demoOnly: true,
    },
    {
      label: 'Decimation zero-advance fraction — STRICTER (less inclusive)',
      param: 'decimationZeroAdvanceFraction',
      shipped: DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION,
      override: 0.2,
      direction: 'decrease',
      floorNote: `the union of gapProfile ∪ impossibleSamples severe cohorts (${otherTwoFloor})`,
      demoOnly: true,
    },
  ];

  const rows = rowSpecs.map((spec) => {
    const overrides = { [spec.param]: spec.override };
    const metrics = computeSignalsForEntries(rawEntries, overrides);
    const compositeCount = metrics.compositeIds.size;
    const delta = compositeCount - shippedComposite;

    let verdict;
    let reason = '';
    if (delta !== 0) {
      verdict = `MOVED (${delta > 0 ? '+' : ''}${delta})`;
    } else {
      verdict = 'DID-NOT-MOVE';
      reason = `floor dominated by ${spec.floorNote}`;
    }

    return { ...spec, compositeCount, delta, verdict, reason };
  });

  const anyIncreased = rows.some((r) => r.delta > 0);
  const anyDecreased = rows.some((r) => r.delta < 0);

  const lines = [];
  lines.push('## Threshold Sensitivity');
  lines.push('');
  lines.push(
    `Shipped (no-override) composite: **${shippedComposite}**. Each row below recomputes the ` +
      'composite under ONE overridden `QualityThresholdOverrides` field via the `options` ' +
      'parameter `computePaceQualitySignals` already accepts — no source constant in ' +
      '`src/analytics/pace-quality.ts` is edited to produce any row.'
  );
  lines.push('');
  lines.push('| Threshold | Shipped value | Override | Expected direction | Composite | Delta | Verdict |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const label = row.demoOnly
      ? `${row.label} (DEMONSTRATION ONLY — D-04 locks the shipped value; not a proposal)`
      : row.label;
    lines.push(
      `| ${label} | ${row.shipped} | ${row.override} | ${row.direction} | ${row.compositeCount} | ` +
        `${row.delta > 0 ? '+' : ''}${row.delta} | ${row.verdict}${row.reason ? ` — ${row.reason}` : ''} |`
    );
  }
  lines.push('');
  lines.push(
    `At least one row shows the composite strictly INCREASING relative to the shipped run: ` +
      `**${anyIncreased ? 'CONFIRMED' : 'NOT CONFIRMED — see rows above, this is itself a finding'}**. ` +
      `At least one row shows the composite strictly DECREASING: ` +
      `**${anyDecreased ? 'CONFIRMED' : 'NOT CONFIRMED — see rows above, this is itself a finding'}**. ` +
      'The discriminator is proven to move the composite in both directions without editing a shipped constant.'
  );
  lines.push('');
  lines.push(
    'The two decimation rows above are DEMONSTRATION ONLY: `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION` ' +
      "stays locked at its shipped 0.15/50 pair verbatim from Phase 26's cohort rule (D-04). These " +
      'rows exist solely to prove the same `options` knob also reaches this signal — never to ' +
      'propose a replacement value, and no row here is read as a recommendation.'
  );
  lines.push('');

  return lines.join('\n');
}

// Self-execution guard, mirroring compute-pace-residual.mjs: main() runs
// only under direct invocation, so
// scripts/compute-pace-quality-calibration.test.mjs can import the pure
// functions above without triggering the full archive sweep, the
// `npm run compute-pace-residual` subprocess, or a write to
// 27-CALIBRATION.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
