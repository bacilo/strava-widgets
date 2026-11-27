/**
 * Phase 34 plan 05 (PAUSE-03, D-04, D-05): re-measures v2.2's "transport gaps are essentially
 * absent" finding (`.planning/milestones/v2.2-REQUIREMENTS.md:165`, "9 activities … all at
 * <=14 km/h") on MERGED gap-bearing intervals — the correction v2.2's own gap-interval-alone
 * measurement missed (34-RESEARCH.md § PAUSE-03 Re-Measurement, Pitfall 2/3).
 *
 * NO v2.2 SCRIPT SURVIVES (34-RESEARCH.md Pitfall 3): three independent `git log --all -S`
 * searches ("essentially absent", "advance >100", "teleport") find the rule text first appearing
 * verbatim in the v2.2 REQUIREMENTS.md-defining commit itself, with no accompanying script. The
 * RULE TEXT is therefore the spec — `V22_MIN_INTERVAL_SEC`/`V22_MIN_ADVANCE_M` below quote it
 * directly — and this file is its first committed implementation, applied side by side to two
 * interval sources:
 *   - OLD RULE: the pre-detector `recording-gap` interval alone (`classifyGapsThreeWay`), exactly
 *     v2.2's own unit of measurement — never re-deriving the gap definition, only reading the
 *     ONE canonical pre-detector list `pace-derivation.ts` already exposes for this purpose.
 *   - MERGED RULE: `recording-gap` OR `merged-segment` intervals (`collectPauseIntervals`, plan
 *     34-03) — the merged gap-plus-adjacent-burst span the detector actually produces.
 * Plus D-04(b): the transported-class count (`isTransported`, imported from
 * `pause-classification.js`, never a local literal) over every gap-bearing interval with no
 * duration floor (D-03) — band-independent, so it is final whatever plan 34-06 calibrates.
 *
 * `main()` runs only under direct invocation (the standard self-execution guard at the bottom) so
 * `compute-pause-transport-remeasurement.test.mjs` can import every pure function above without
 * triggering an archive read or a write to `34-PAUSE03-REMEASUREMENT.md` as an import-time side
 * effect. Regenerating this file against an unchanged archive is byte-identical — no wall-clock
 * timestamp anywhere below, and provenance is content-addressed (a `data/streams` git TREE id,
 * never a bare `rev-parse HEAD` commit hash — committing this artifact moves HEAD, which would
 * make byte-identical regeneration unsatisfiable for a commit-hash-based provenance scheme).
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { classifyGapsThreeWay, classifyGapsWithSegments } from '../dist/analytics/pace-derivation.js';
import { collectPauseIntervals, isTransported } from '../dist/analytics/pause-classification.js';
import { validateStreamSeries } from '../dist/analytics/best-effort-utils.js';
import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data/activities');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning',
  'milestones', 'v2.3-phases',
  '34-pause-classification-forgotten-stop',
  '34-PAUSE03-REMEASUREMENT.md'
);
const REGENERATE_COMMAND = 'npm run compute-pause-transport-remeasurement';

// ---------------------------------------------------------------------------
// v2.2's rule text, quoted verbatim (`.planning/milestones/v2.2-REQUIREMENTS.md:165`,
// REQUIREMENTS PAUSE-03) — "an activity counts if ANY interval of duration 30 s or more advances
// more than 100 m". Named constants, never tuned.
// ---------------------------------------------------------------------------

/** "…duration of 30 s OR MORE…" — inclusive. */
export const V22_MIN_INTERVAL_SEC = 30;

/** "…advances MORE THAN 100 m…" — strict. */
export const V22_MIN_ADVANCE_M = 100;

// ---------------------------------------------------------------------------
// remeasureActivity — one activity, both rule sources plus the transported class
// ---------------------------------------------------------------------------

function buildIndexByTime(t) {
  const map = new Map();
  for (let i = 0; i < t.length; i++) map.set(t[i], i);
  return map;
}

/** v2.2's rule, applied to one already-measured `{ startSec, endSec, seconds, metres }` interval. */
function v22Qualifies(interval) {
  return interval.seconds >= V22_MIN_INTERVAL_SEC && interval.metres > V22_MIN_ADVANCE_M;
}

function withKmh(interval) {
  return { ...interval, kmh: interval.seconds > 0 ? (interval.metres / interval.seconds) * 3.6 : 0 };
}

/**
 * Re-measures ONE activity's `t`/`d` stream under both interval sources plus the transported
 * class. Total: a malformed/invalid stream flows straight through `classifyGapsThreeWay`/
 * `classifyGapsWithSegments`/`collectPauseIntervals`, each already total (T-26-01) and each
 * returning an empty/zeroed result on bad input — no special-casing needed here, matching the
 * project's own "insufficient data is a zeroed result, never thrown" discipline.
 *
 * `oldRule` reads ONLY `classifyGapsThreeWay`'s `'recording-gap'`-kind intervals — the PRE-detector
 * list, exactly v2.2's own "the gap interval alone" unit (34-RESEARCH.md Pitfall 3). `GapInterval`/
 * `PreDetectorGapInterval` carry no `metres` field (34-RESEARCH.md Pattern 2/Pitfall 2), so metres
 * is derived via a `t`-to-index lookup, differencing `d`.
 *
 * `mergedRule` reads `collectPauseIntervals`'s `'recording-gap'` OR `'merged-segment'` sourced
 * intervals — never `'zero-advance-pause'`, which is zero-metres by construction and can never
 * qualify (D-01/D-03). `merged-segment` entries use the detector's own `metres`/`seconds`
 * directly (never re-derived from `gapIntervals`), so a raw gap that got folded into a merged
 * segment because an adjacent burst absorbed distance the gap interval alone never saw — the
 * exact v2.2 blind spot — is measured on its full merged span here.
 *
 * `transported` counts every gap-bearing interval (`collectPauseIntervals`'s full list, including
 * `'recording-gap'`, `'merged-segment'` AND `'zero-advance-pause'` — though a zero-advance pause
 * is always 0 m/0-plus-s and can never itself read as transported) whose speed is strictly above
 * the imported `isTransported` boundary, with NO duration floor (D-03) — a short gap-bearing
 * interval above the limit counts.
 */
export function remeasureActivity(t, d) {
  const threeWay = classifyGapsThreeWay(t, d);
  const indexByTime = buildIndexByTime(t ?? []);

  // Full list of old-rule-source intervals (NOT filtered to qualifying ones) — `qualifies` is
  // derived from this same list via `.some(v22Qualifies)`, so a caller can always see every
  // interval considered, not only the ones that happened to clear the rule.
  const oldIntervals = (threeWay.gapIntervals ?? [])
    .filter((gi) => gi.kind === 'recording-gap')
    .map((gi) => {
      const startIdx = indexByTime.get(gi.startSec);
      const endIdx = indexByTime.get(gi.endSec);
      const metres = startIdx !== undefined && endIdx !== undefined ? d[endIdx] - d[startIdx] : 0;
      return withKmh({ startSec: gi.startSec, endSec: gi.endSec, seconds: gi.endSec - gi.startSec, metres });
    });

  const { coverage, segments } = classifyGapsWithSegments(t, d);
  const collected = collectPauseIntervals(t, d, coverage, segments);

  const mergedIntervals = collected.intervals
    .filter((iv) => iv.source === 'recording-gap' || iv.source === 'merged-segment')
    .map((iv) => withKmh({ startSec: iv.startSec, endSec: iv.endSec, seconds: iv.seconds, metres: iv.metres }));

  const transportIntervals = collected.intervals.filter((iv) => isTransported(iv.metres, iv.seconds));

  return {
    oldRule: { qualifies: oldIntervals.some(v22Qualifies), intervals: oldIntervals },
    mergedRule: { qualifies: mergedIntervals.some(v22Qualifies), intervals: mergedIntervals },
    transported: { count: transportIntervals.length, intervals: transportIntervals },
  };
}

// ---------------------------------------------------------------------------
// remeasureArchive — the archive-wide sweep
// ---------------------------------------------------------------------------

/**
 * Sweeps `entries` (`[{ id, t, d }]`), applying `remeasureActivity` to every computable stream.
 * `computable`/`notComputable` follow `validateStreamSeries` (the same totality gate every sibling
 * archive-wide generator in this phase uses). Id lists are sorted (default lexicographic, matching
 * this codebase's own established `.sort()` convention for id lists — e.g.
 * `compute-pause-classification-calibration.mjs`'s `computableIds`).
 */
export function remeasureArchive(entries) {
  let computable = 0;
  let notComputable = 0;

  const oldRuleSet = new Set();
  const mergedRuleSet = new Set();
  let oldQualifyingIntervalCount = 0;
  let mergedQualifyingIntervalCount = 0;
  let maxKmhOld = 0;
  let maxKmhMerged = 0;
  let transportedIntervals = 0;
  const transportedActivitySet = new Set();

  for (const entry of entries) {
    if (entry.t == null || entry.d == null || !validateStreamSeries(entry.t, entry.d).ok) {
      notComputable++;
      continue;
    }
    computable++;

    const r = remeasureActivity(entry.t, entry.d);

    const oldQualifying = r.oldRule.intervals.filter(v22Qualifies);
    if (oldQualifying.length > 0) {
      oldRuleSet.add(entry.id);
      oldQualifyingIntervalCount += oldQualifying.length;
      for (const iv of oldQualifying) maxKmhOld = Math.max(maxKmhOld, iv.kmh);
    }
    const mergedQualifying = r.mergedRule.intervals.filter(v22Qualifies);
    if (mergedQualifying.length > 0) {
      mergedRuleSet.add(entry.id);
      mergedQualifyingIntervalCount += mergedQualifying.length;
      for (const iv of mergedQualifying) maxKmhMerged = Math.max(maxKmhMerged, iv.kmh);
    }
    if (r.transported.count > 0) {
      transportedActivitySet.add(entry.id);
      transportedIntervals += r.transported.count;
    }
  }

  const oldRuleActivities = [...oldRuleSet].sort();
  const mergedRuleActivities = [...mergedRuleSet].sort();
  const newlyCaught = mergedRuleActivities.filter((id) => !oldRuleSet.has(id)).sort();
  const noLongerCaught = oldRuleActivities.filter((id) => !mergedRuleSet.has(id)).sort();
  const transportedActivities = [...transportedActivitySet].sort();

  return {
    streamsScanned: entries.length,
    computable,
    notComputable,
    oldRuleActivities,
    mergedRuleActivities,
    newlyCaught,
    noLongerCaught,
    maxKmhOld,
    maxKmhMerged,
    oldQualifyingIntervalCount,
    mergedQualifyingIntervalCount,
    transportedIntervals,
    transportedActivities,
  };
}

// ---------------------------------------------------------------------------
// Rendering — deterministic markdown, no wall-clock, content-addressed provenance
// ---------------------------------------------------------------------------

function renderIdList(ids, label) {
  if (ids.length === 0) return `${label}: _none_.`;
  return `${label} (${ids.length}): ${ids.map((id) => `\`${id}\``).join(', ')}`;
}

/**
 * Renders the figure-of-record artifact. Deterministic (two calls with the same `result`/
 * `provenance` give a byte-identical string) — no `Date.now()`/`new Date()`, no random ordering
 * (every list above is already sorted). Headings match 34-05-PLAN.md's `<behavior>` list exactly.
 */
export function renderRemeasurementMarkdown(result, provenance) {
  const lines = [];

  lines.push('# PAUSE-03 Re-Measurement — Transport Gaps on Merged Segments');
  lines.push('');
  lines.push(
    'Machine-written by `npm run compute-pause-transport-remeasurement`; never hand-edit. ' +
      'Regenerating this file against an unchanged archive produces a byte-identical result, ' +
      'including after this file is committed — provenance below is content-addressed, not a ' +
      'wall-clock timestamp and not a bare HEAD commit hash.'
  );
  lines.push('');

  lines.push('## Figure of record');
  lines.push('');
  lines.push(
    `Merged rule (v2.2's own rule re-run on merged gap-bearing intervals, PAUSE-03's corrected ` +
      `figure): **${result.mergedRuleActivities.length} activities** (max ${result.maxKmhMerged.toFixed(1)} km/h). ` +
      `Old rule (v2.2's rule on the gap interval alone, re-run against today's archive): ` +
      `**${result.oldRuleActivities.length} activities** (max ${result.maxKmhOld.toFixed(1)} km/h). ` +
      `Transported class (D-05, band-independent, no duration floor): ` +
      `**${result.transportedActivities.length} activities**, **${result.transportedIntervals} intervals**.`
  );
  lines.push('');

  lines.push('## The v2.2 rule re-run');
  lines.push('');
  lines.push(
    `v2.2's exact rule (\`.planning/milestones/v2.2-REQUIREMENTS.md:165\`): an activity counts if ` +
      `ANY interval of duration \`>= ${V22_MIN_INTERVAL_SEC}\` s advances \`> ${V22_MIN_ADVANCE_M}\` m ` +
      `(\`V22_MIN_INTERVAL_SEC\`/\`V22_MIN_ADVANCE_M\`, quoted from the rule text, never tuned). Applied ` +
      `side by side to two interval sources:`
  );
  lines.push('');
  lines.push('| Rule | Source | Activities matching | Qualifying intervals | Max km/h |');
  lines.push('|---|---|---|---|---|');
  lines.push(
    `| Old | pre-detector \`recording-gap\` intervals alone (\`classifyGapsThreeWay\`) | ` +
      `${result.oldRuleActivities.length} | ${result.oldQualifyingIntervalCount} | ${result.maxKmhOld.toFixed(1)} |`
  );
  lines.push(
    `| Merged | \`recording-gap\` OR \`merged-segment\` intervals (\`collectPauseIntervals\`) | ` +
      `${result.mergedRuleActivities.length} | ${result.mergedQualifyingIntervalCount} | ${result.maxKmhMerged.toFixed(1)} |`
  );
  lines.push('');

  lines.push('## Transported class (D-05)');
  lines.push('');
  lines.push(
    `Every gap-bearing interval (\`collectPauseIntervals\`, no duration floor, D-03) whose implied ` +
      `speed reads strictly above the imported \`UNRELIABLE_SPEED_LIMIT_MPS\` boundary (via ` +
      `\`isTransported\`, never a local literal) counts toward this figure. Band-independent — final ` +
      `whatever plan 34-06 calibrates for the walk/run and stationary/walk boundaries.`
  );
  lines.push('');
  lines.push(`- Transported activities: **${result.transportedActivities.length}**`);
  lines.push(`- Transported intervals: **${result.transportedIntervals}**`);
  lines.push('');

  lines.push('## Newly caught / no longer caught');
  lines.push('');
  lines.push(renderIdList(result.newlyCaught, 'Newly caught by the merged rule (matched merged, not old)'));
  lines.push('');
  lines.push(renderIdList(result.noLongerCaught, 'No longer caught (matched old, not merged)'));
  lines.push('');

  lines.push("## Reconciliation against v2.2's figure");
  lines.push('');
  lines.push(
    `v2.2's cited historical figure (\`.planning/milestones/v2.2-REQUIREMENTS.md:165\`, superseded by ` +
      `this artifact): "9 activities, all at <=14 km/h". No v2.2 script survives to diff against — ` +
      `three independent \`git log --all -S\` searches ("essentially absent", "advance >100", ` +
      `"teleport", 34-RESEARCH.md Pitfall 3) found the rule text first appearing in the v2.2 ` +
      `REQUIREMENTS.md-defining commit itself, with no accompanying script. This run's old-rule count ` +
      `is **${result.oldRuleActivities.length}**, beside the historical **9** — not asserted equal. ` +
      `The most likely single factor is archive growth: the archive has grown materially since v2.2's ` +
      `own ad hoc scoping probe, and the old rule here is re-stated exactly as the PRE-detector ` +
      `\`recording-gap\` interval (never re-derived or hand-tuned toward either reference).`
  );
  lines.push('');
  lines.push(
    `Research's own illustrative probe (this session only, reference, never an expected value): ` +
      `old-rule 12, merged-rule 26 activities, on an earlier archive snapshot. This run's own ` +
      `committed figures: old-rule **${result.oldRuleActivities.length}**, merged-rule ` +
      `**${result.mergedRuleActivities.length}**.`
  );
  lines.push('');
  lines.push(
    result.mergedRuleActivities.length < result.oldRuleActivities.length
      ? `**DEFECT SIGNAL:** the merged-rule count is lower than the old-rule count, which contradicts ` +
          `the widening's own logic (a merged interval always contains its own gap, so it can only ` +
          `qualify at least as often as the gap alone) — this must be investigated and reported as a ` +
          `defect, never treated as a finding.`
      : `The merged-rule count is at or above the old-rule count, consistent with the widening's own ` +
          `logic (a merged interval always contains its own gap).`
  );
  lines.push('');
  lines.push(
    `Activity \`3475724402\` (the phase's own named criterion-1 fixture): merged rule ` +
      `${result.mergedRuleActivities.includes('3475724402') ? 'INCLUDES' : 'does not include'} it; ` +
      `old rule ${result.oldRuleActivities.includes('3475724402') ? 'INCLUDES' : 'does not include'} it.`
  );
  lines.push('');

  lines.push('## Live denominator');
  lines.push('');
  lines.push(
    `Streams scanned: **${result.streamsScanned}**. Computable: **${result.computable}**. ` +
      `Not computable: **${result.notComputable}**.`
  );
  lines.push('');

  lines.push('## Provenance');
  lines.push('');
  lines.push('Measured for Phase 34 (PAUSE-03), plan 34-05.');
  lines.push('');
  lines.push(`- \`data/streams\` git tree: \`${provenance.streamsTree}\``);
  lines.push(`- Newest activity start date: ${provenance.newestActivityStartDate ?? 'unknown'}`);
  lines.push(`- Regenerate: \`${REGENERATE_COMMAND}\``);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main() — gated behind the self-execution guard
// ---------------------------------------------------------------------------

/** Content-addressed provenance: names the run's actual input (the committed stream archive's git
 * tree), never `rev-parse HEAD` alone, never a wall-clock read. */
function gitId(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown (git failed)';
  }
}

function loadEntries(streamsDir) {
  const files = readdirSync(streamsDir).filter(isStreamFile).sort();
  const entries = [];
  for (const filename of files) {
    const id = idFromFilename(filename);
    let t = null;
    let d = null;
    try {
      const doc = JSON.parse(readFileSync(join(streamsDir, filename), 'utf8'));
      t = Array.isArray(doc.t) ? doc.t : null;
      d = Array.isArray(doc.d) ? doc.d : null;
    } catch {
      t = null;
      d = null;
    }
    entries.push({ id, t, d });
  }
  return entries;
}

function newestActivityStartDate(activitiesDir) {
  let newest = null;
  let files;
  try {
    files = readdirSync(activitiesDir);
  } catch {
    return null;
  }
  for (const filename of files) {
    if (!filename.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(activitiesDir, filename), 'utf8'));
      if (typeof doc.start_date === 'string' && (newest === null || doc.start_date > newest)) {
        newest = doc.start_date;
      }
    } catch {
      // skip malformed activity docs — not this script's concern
    }
  }
  return newest;
}

function main() {
  console.log('Computing the PAUSE-03 transport re-measurement (plan 34-05)...\n');

  let entries;
  try {
    entries = loadEntries(STREAMS_DIR);
  } catch (error) {
    console.error(`Error: could not read the archive: ${error.message}`);
    console.error(`Run \`npm run build\` first, then re-run \`${REGENERATE_COMMAND}\`.`);
    process.exitCode = 1;
    return;
  }

  const result = remeasureArchive(entries);
  const provenance = {
    streamsTree: gitId('rev-parse HEAD:data/streams'),
    newestActivityStartDate: newestActivityStartDate(ACTIVITIES_DIR),
  };

  const markdown = renderRemeasurementMarkdown(result, provenance);
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(
    `streamsScanned=${result.streamsScanned} computable=${result.computable} ` +
      `notComputable=${result.notComputable} oldRule=${result.oldRuleActivities.length} ` +
      `mergedRule=${result.mergedRuleActivities.length} transportedActivities=${result.transportedActivities.length}`
  );
}

// Self-execution guard, mirroring every sibling generator in this phase: main() runs only under
// direct invocation, so compute-pause-transport-remeasurement.test.mjs can import the pure
// functions above without triggering a real file read (or write) as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
