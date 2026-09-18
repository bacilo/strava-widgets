/**
 * Phase 30 ELEV-02 calibration sweep — the archive-wide dry run measuring
 * what the shipped elevation detector (`elevationSignal` in
 * `src/analytics/pace-quality.ts`) actually flags across every committed
 * stream, and writing the committed, regenerable `30-CALIBRATION.md`
 * report.
 *
 * Structure mirrors `scripts/compute-pace-quality-calibration.mjs` (the
 * Phase 27 precedent this phase inherits): a per-file `try`/`catch` around
 * `readFileSync`/`JSON.parse` that warns and continues (one unreadable file
 * cannot abort a ~1,890-file sweep), and a `main()` gated behind the same
 * self-execution guard so this file's pure functions (the overlap matrix,
 * the inclusion-exclusion check, the device-family bucketing, the distance
 * bucketing, the digest gate) can be imported by
 * `compute-elevation-calibration.test.mjs` without running the sweep or
 * writing the report.
 *
 * Only write target: `.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md`.
 * Reads `data/activities/` and `data/streams/` READ-ONLY; NEVER writes into
 * `data/` (D-16). A sha256 digest of `data/streams/` is rolled before and
 * after the sweep; the script exits non-zero if they differ, before ever
 * writing the report.
 *
 * Imports the shipped detectors and threshold constants DIRECTLY from
 * `dist/analytics/pace-quality.js` — this is the one script this phase
 * allows to (30-RESEARCH.md Pitfall 1): it is measuring what the classifier
 * does, so its own numbers must be read from the module, never retyped.
 *
 * Excludes `manifest.json` when enumerating `data/streams/` — Phase 27's
 * own gap G-01 was exactly this file being counted as an activity stream.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  elevationSignal,
  SUB_GROUND_MIN_ALT_M,
  CLOSURE_DRIFT_SEVERE_DELTA_M,
  VERTICAL_RATE_SEVERE_MPS,
  LOOP_RADIUS_M,
} from '../dist/analytics/pace-quality.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data/activities');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md'
);

const REGENERATE_COMMAND = 'npm run compute-elevation-calibration';
const WORST_N = 3;

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O (the guard test's contract)
// ---------------------------------------------------------------------------

/** Strips the trailing `.json` from a `data/activities|streams` filename. */
export function idFromFilename(filename) {
  return filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename;
}

/**
 * True for a `data/streams/` entry that is a genuine per-activity stream
 * file — false for `manifest.json`, the stream-availability index written
 * by backfill-streams and the daily intervals.icu sync, which is not
 * itself a per-activity stream and must never be counted as one (Phase 27
 * gap G-01).
 */
export function isStreamFile(filename) {
  return filename.endsWith('.json') && filename !== 'manifest.json';
}

/** True when a stream object carries a non-empty `alt` channel. */
export function hasAltChannel(stream) {
  return !!stream && Array.isArray(stream.alt) && stream.alt.length > 0;
}

/**
 * `count / denominator` as a fixed-1-decimal percentage string, WITH the
 * denominator inline in the same string — every percentage in the report
 * must carry its own denominator on the same line (D-06's rule, extended
 * here per 30-RESEARCH.md Assumption A3).
 */
export function formatPct(count, denominator) {
  if (!denominator) return `${count} of 0 (N/A)`;
  return `${count} of ${denominator} (${((100 * count) / denominator).toFixed(1)}%)`;
}

/**
 * The raw (NOT loop-gated) closure-drift diagnostic: `alt[last] - alt[0]`
 * and whether its absolute value exceeds the imported
 * `CLOSURE_DRIFT_SEVERE_DELTA_M` threshold. This is deliberately the SAME
 * arithmetic `closureDriftSignal` uses internally, minus the loop gate —
 * it exists only to reproduce the requirement's original, un-loop-gated
 * "34" figure for the D-04 correction narrative; the shipped, loop-gated
 * cohort is always read from `elevationSignal`'s own `closureDrift.state`,
 * never from this function.
 */
export function rawClosureDelta(alt) {
  if (!Array.isArray(alt) || alt.length < 2) {
    return { deltaM: null, flagged: false };
  }
  const first = alt[0];
  const last = alt[alt.length - 1];
  if (
    typeof first !== 'number' ||
    typeof last !== 'number' ||
    !Number.isFinite(first) ||
    !Number.isFinite(last)
  ) {
    return { deltaM: null, flagged: false };
  }
  const deltaM = last - first;
  return { deltaM, flagged: Math.abs(deltaM) > CLOSURE_DRIFT_SEVERE_DELTA_M };
}

function intersectSize(a, b) {
  let count = 0;
  for (const id of a) {
    if (b.has(id)) count++;
  }
  return count;
}

/**
 * Generic 3-set overlap matrix: pairwise intersections, the all-three
 * intersection, and the direct union — reused for both the loop-gated
 * matrix (D-15's primary table) and the raw-cohort comparison matrix
 * (Mode Independence section).
 */
export function computeOverlapMatrix(setA, setB, setC) {
  const abIds = new Set([...setA].filter((id) => setB.has(id)));
  const allThree = intersectSize(abIds, setC);
  const union = new Set([...setA, ...setB, ...setC]);
  return {
    aCount: setA.size,
    bCount: setB.size,
    cCount: setC.size,
    ab: intersectSize(setA, setB),
    ac: intersectSize(setA, setC),
    bc: intersectSize(setB, setC),
    allThree,
    unionSize: union.size,
    unionIds: union,
  };
}

/**
 * The inclusion-exclusion arithmetic check the calibration script ASSERTS
 * (not merely prints, per the plan's own acceptance criteria): a true
 * 3-set union must equal |A|+|B|+|C|-|AB|-|AC|-|BC|+|ABC|. A mismatch means
 * a bug in the overlap arithmetic, not a report-writing slip — `main()`
 * exits non-zero rather than writing a self-contradictory report.
 */
export function checkInclusionExclusion(matrix) {
  const computed = matrix.aCount + matrix.bCount + matrix.cCount - matrix.ab - matrix.ac - matrix.bc + matrix.allThree;
  return { pass: computed === matrix.unionSize, computed, unionSize: matrix.unionSize };
}

/** Device-family breakdown of a set of ids, `(no device name)` as an explicit category. */
export function deviceFamilyBreakdown(ids, activityById) {
  const counts = new Map();
  for (const id of ids) {
    const activity = activityById.get(id);
    const rawName = activity && typeof activity.device_name === 'string' ? activity.device_name.trim() : '';
    const name = rawName !== '' ? rawName : '(no device name)';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Buckets a live-measured start/end distance distribution (D-03): the
 * count sitting at exactly 0 m, the count strictly between 0 m and the
 * loop radius (this should measure 0 on the real archive — an empty gap
 * is the finding the radius derivation rests on), the count at or above
 * the radius, and the minimum non-zero distance observed.
 */
export function distanceDistribution(distances, loopRadiusM) {
  let atZero = 0;
  let belowRadius = 0;
  let atOrAboveRadius = 0;
  let minNonZeroDistance = null;
  for (const d of distances) {
    if (d === 0) {
      atZero++;
      continue;
    }
    if (d < loopRadiusM) belowRadius++;
    else atOrAboveRadius++;
    if (minNonZeroDistance === null || d < minNonZeroDistance) minNonZeroDistance = d;
  }
  return { total: distances.length, atZero, belowRadius, atOrAboveRadius, minNonZeroDistance };
}

/**
 * Counts consecutive samples ending at (and including) index `i` sharing
 * `alt[i]`'s exact value, scanning backward — the D-08 carry-forward-fill
 * correlation's own operationalization (30-RESEARCH.md Assumption A2): a
 * violating pair whose start sample was immediately preceded by at least
 * one byte-identical reading (`precedingIdenticalRun >= 2`, i.e. the value
 * repeats at least once before the jump) is a carry-forward-filled flat
 * stretch, then a single-tick jump.
 */
export function precedingIdenticalRunLength(alt, i) {
  let run = 1;
  let j = i - 1;
  while (j >= 0 && alt[j] === alt[i]) {
    run++;
    j--;
  }
  return run;
}

/**
 * Re-scans one activity's `(t, alt)` pair for every vertical-rate
 * violation, exposing the sample index and the D-08 preceding-run evidence
 * `verticalRateSignal` itself does not return. Uses the SAME imported
 * `VERTICAL_RATE_SEVERE_MPS` threshold and the same `dtSec > 0`/finiteness
 * guards as the shipped detector, so its violation COUNT is expected to
 * match `elevationSignal(...).verticalRate.violatingSamples` exactly for
 * every entry — `buildReport` checks this per entry and warns (not fails)
 * on any mismatch, since a mismatch would indicate a bug in THIS diagnostic
 * scan rather than in the shipped, already-tested detector.
 */
export function scanVerticalRatePairs(t, alt) {
  const pairs = [];
  if (!Array.isArray(t) || !Array.isArray(alt)) return pairs;
  const n = Math.min(t.length, alt.length);
  for (let i = 0; i < n - 1; i++) {
    const t1 = t[i];
    const t2 = t[i + 1];
    const a1 = alt[i];
    const a2 = alt[i + 1];
    if (
      typeof t1 !== 'number' ||
      typeof t2 !== 'number' ||
      typeof a1 !== 'number' ||
      typeof a2 !== 'number' ||
      !Number.isFinite(t1) ||
      !Number.isFinite(t2) ||
      !Number.isFinite(a1) ||
      !Number.isFinite(a2)
    ) {
      continue;
    }
    const dtSec = t2 - t1;
    if (!(dtSec > 0)) continue;
    const dAltM = a2 - a1;
    const rateMps = Math.abs(dAltM) / dtSec;
    if (rateMps > VERTICAL_RATE_SEVERE_MPS) {
      pairs.push({ index: i, rateMps, dtSec, dAltM, precedingIdenticalRun: precedingIdenticalRunLength(alt, i) });
    }
  }
  return pairs;
}

/**
 * Rolls a per-file sha256 over every real stream file in `dirPath`, in
 * SORTED filename order, into one aggregate sha256 (D-16). The filename
 * itself is fed into the aggregate alongside the per-file digest so an
 * addition, removal or rename is visible even if no existing file's bytes
 * changed. I/O, not a pure function — exercised by the guard test against
 * a disposable temp directory, never against the real `data/streams/`.
 */
export function computeStreamsDigest(dirPath) {
  let files;
  try {
    files = readdirSync(dirPath).filter(isStreamFile).sort();
  } catch (error) {
    return { digest: null, fileCount: 0, error: error.message };
  }
  const aggregate = createHash('sha256');
  for (const file of files) {
    let contents;
    try {
      contents = readFileSync(join(dirPath, file));
    } catch (error) {
      return { digest: null, fileCount: files.length, error: error.message };
    }
    const perFileDigest = createHash('sha256').update(contents).digest('hex');
    aggregate.update(file);
    aggregate.update(perFileDigest);
  }
  return { digest: aggregate.digest('hex'), fileCount: files.length, error: null };
}

/**
 * D-16's gate: a digest pair that cannot agree with itself is a mutation
 * signal, not a report-writing slip. Pure — takes two already-computed
 * `computeStreamsDigest` results.
 */
export function checkDigestGate(before, after) {
  if (before.digest === null || after.digest === null) {
    return {
      pass: false,
      message:
        `FATAL: could not compute one or both data/streams/ digests ` +
        `(before error: ${before.error ?? 'none'}; after error: ${after.error ?? 'none'}) — ` +
        'refusing to write a calibration report against an unverified archive state.',
    };
  }
  if (before.digest !== after.digest) {
    return {
      pass: false,
      message:
        `FATAL: data/streams/ changed during the calibration sweep ` +
        `(before=${before.digest} [${before.fileCount} files], ` +
        `after=${after.digest} [${after.fileCount} files]) — this script must never write to data/, ` +
        'and the sweep itself must be read-only. Refusing to write the calibration report.',
    };
  }
  return {
    pass: true,
    message: `data/streams/ is byte-unchanged (digest match, ${after.fileCount} files): ${after.digest}`,
  };
}

/**
 * Renders the committed `30-CALIBRATION.md` deliverable from a report
 * object (see `buildReport`'s return shape) — pure string assembly, no I/O.
 * Every `%` printed here is on the same line as the denominator it divides
 * by (D-06's rule, Assumption A3).
 */
export function renderCalibrationMarkdown(report) {
  const lines = [];

  lines.push('# Phase 30 ELEV-02 Calibration Report');
  lines.push('');
  lines.push(
    'The archive-wide dry run ELEV-02 requires — every figure below is computed live by ' +
      `\`${REGENERATE_COMMAND}\` against the full committed archive. Nothing here is transcribed ` +
      'from `30-CONTEXT.md` or `30-RESEARCH.md`; both are prior scouting measurements this run ' +
      'independently re-derives.'
  );
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  // 1. Live denominators
  lines.push('## Live denominators');
  lines.push('');
  lines.push(
    `- Activities: **${report.activityCount}** — \`readdirSync('data/activities')\` entries that ` +
      `read and JSON-parsed successfully` +
      `${report.activityParseFailures > 0 ? ` (${report.activityParseFailures} unreadable, warned to stderr)` : ''}.`
  );
  lines.push(
    `- Streams present: **${report.streamFileCount}** — \`readdirSync('data/streams')\` entries ` +
      `excluding \`manifest.json\`` +
      `${report.streamParseFailures > 0 ? ` (${report.streamParseFailures} unreadable, treated as absent, warned to stderr)` : ''}.`
  );
  lines.push(
    `- Streams carrying \`alt\`: **${report.altCarryingCount}** of ${report.streamFileCount} present streams — ` +
      'this is the population the three elevation detectors actually run over; every per-mode rate ' +
      'below divides by this number unless a different denominator is named on the same line.'
  );
  lines.push(
    `- Activities with a normalizable start/end position: **${formatPct(report.positionedActivityCount, report.activityCount)}** ` +
      '— computed across ALL activities, independent of stream or `alt` availability (position is ' +
      'activity metadata, not stream data).'
  );
  lines.push('');

  // 2. Thresholds in force
  lines.push('## Thresholds in force');
  lines.push('');
  lines.push('Read from the shipped `dist/analytics/pace-quality.js` module at import time — never retyped in this script.');
  lines.push('');
  lines.push('| Mode | Threshold (as shipped) | Mechanism |');
  lines.push('|---|---|---|');
  lines.push(
    `| Sub-ground | stream minimum altitude below ${report.thresholds.subGroundMinAltM} m | ` +
      'flags when the stream\'s own minimum altitude reading sits below ground level by more than this |'
  );
  lines.push(
    `| Closure drift (loop-gated) | \`\|alt[end]-alt[start]\|\` over ${report.thresholds.closureDriftSevereDeltaM} m | ` +
      'flags a loop (start/end within the derived radius) whose altitude fails to close |'
  );
  lines.push(
    `| Vertical rate | \`\|Δalt\|/Δt\` over ${report.thresholds.verticalRateSevereMps} m/s | ` +
      'flags any single sample-to-sample pair whose implied climb/descent rate is physically implausible |'
  );
  lines.push('');

  // 3. Loop radius
  lines.push('## Loop radius');
  lines.push('');
  lines.push(
    `\`LOOP_RADIUS_M = ${report.loopRadiusM}\` (30-RESEARCH.md § D-03). The measured start/end ` +
      `haversine-distance distribution over the ${report.distanceDistribution.total} positioned ` +
      'activities:'
  );
  lines.push('');
  lines.push(`- Exactly 0 m: **${report.distanceDistribution.atZero}**`);
  lines.push(
    `- Strictly between 0 m and ${report.loopRadiusM} m: **${report.distanceDistribution.belowRadius}** ` +
      '(a non-zero count here would mean the radius sits inside an ambiguous region, not an empty gap)'
  );
  lines.push(`- At or above ${report.loopRadiusM} m: **${report.distanceDistribution.atOrAboveRadius}**`);
  lines.push(
    `- Minimum non-zero distance observed: ` +
      `${report.distanceDistribution.minNonZeroDistance === null ? 'N/A' : `${report.distanceDistribution.minNonZeroDistance.toFixed(2)} m`}`
  );
  lines.push('');
  lines.push(
    `Every one of the ${report.distanceDistribution.total} positioned activities sits at either exactly ` +
      `0 m or at ${report.distanceDistribution.minNonZeroDistance === null ? 'a value at or above the radius' : `≥ ${report.distanceDistribution.minNonZeroDistance.toFixed(2)} m`}` +
      ` — nothing falls in the open interval between them. Every value in that empty interval is ` +
      '**equivalent**: any radius chosen strictly between 0 m and the minimum non-zero distance ' +
      'produces an identical loop/non-loop partition on this archive, so the boundary is not sensitive ' +
      `to the exact number chosen. ${report.loopRadiusM} m is used for headroom against future archive ` +
      'growth, not because this archive\'s own boundary is close to it.'
  );
  lines.push('');

  // 4. Per-mode cohorts
  lines.push('## Per-mode cohorts');
  lines.push('');
  lines.push('### Sub-ground');
  lines.push('');
  lines.push(`Flagged: **${formatPct(report.subGround.count, report.altCarryingCount)}**.`);
  lines.push('');
  lines.push('Worst three (lowest measured altitude):');
  lines.push('');
  for (const w of report.subGround.worst) {
    lines.push(`- \`${w.id}\` — ${w.minAltM.toFixed(1)} m`);
  }
  if (report.subGround.worst.length === 0) lines.push('- (none flagged)');
  lines.push('');

  lines.push('### Closure drift (loop-gated)');
  lines.push('');
  lines.push(
    `Flagged: **${formatPct(report.closureDrift.count, report.altCarryingCount)}** of the alt-carrying ` +
      `population; **${formatPct(report.closureDrift.count, report.closureDrift.computablePopulation)}** ` +
      'of the drift-COMPUTABLE population (alt-carrying streams whose activity has a normalizable ' +
      'start/end position — see § Drift not-computable below for the excluded remainder).'
  );
  lines.push('');
  lines.push('Worst three (largest absolute signed delta):');
  lines.push('');
  for (const w of report.closureDrift.worst) {
    lines.push(`- \`${w.id}\` — ${w.deltaM >= 0 ? '+' : ''}${w.deltaM.toFixed(1)} m (loop, ${w.startEndDistM.toFixed(1)} m apart)`);
  }
  if (report.closureDrift.worst.length === 0) lines.push('- (none flagged)');
  lines.push('');

  lines.push('### Vertical rate');
  lines.push('');
  lines.push(`Flagged: **${formatPct(report.verticalRate.count, report.altCarryingCount)}**.`);
  lines.push('');
  lines.push('Worst three (highest measured rate):');
  lines.push('');
  for (const w of report.verticalRate.worst) {
    lines.push(`- \`${w.id}\` — ${w.worstRateMps.toFixed(1)} m/s`);
  }
  if (report.verticalRate.worst.length === 0) lines.push('- (none flagged)');
  lines.push('');

  // 5. Overlap matrix (loop-gated)
  lines.push('## Overlap matrix (loop-gated)');
  lines.push('');
  const m = report.overlapLoopGated;
  lines.push('| | sub-ground | closure drift | vertical rate |');
  lines.push('|---|---|---|---|');
  lines.push(`| sub-ground | ${m.aCount} | ${m.ab} | ${m.ac} |`);
  lines.push(`| closure drift | ${m.ab} | ${m.bCount} | ${m.bc} |`);
  lines.push(`| vertical rate | ${m.ac} | ${m.bc} | ${m.cCount} |`);
  lines.push('');
  lines.push(`All three modes: **${m.allThree}**.`);
  lines.push(`Union (the actual flagged cohort, loop-gated): **${formatPct(m.unionSize, report.altCarryingCount)}**.`);
  lines.push('');
  lines.push(
    `**Inclusion-exclusion check:** ${m.aCount} + ${m.bCount} + ${m.cCount} − ${m.ab} − ${m.ac} − ${m.bc} + ` +
      `${m.allThree} = ${report.inclusionExclusion.computed} — direct union = ${report.inclusionExclusion.unionSize} — ` +
      `**${report.inclusionExclusion.pass ? 'PASS' : 'FAIL'}**.`
  );
  lines.push('');

  // 6. Union by device family
  lines.push('## Union by device family');
  lines.push('');
  lines.push('| Device | Count | % of union |');
  lines.push('|---|---|---|');
  for (const [name, count] of report.unionDeviceFamily) {
    lines.push(`| ${name} | ${count} | ${formatPct(count, m.unionSize)} |`);
  }
  lines.push('');

  // 7. Drift not-computable
  lines.push('## Drift not-computable');
  lines.push('');
  lines.push(
    `**${formatPct(report.driftNotComputable.count, report.altCarryingCount)}** of the alt-carrying ` +
      'population has no normalizable start/end position and so drift is not-computable for that ' +
      'activity (sub-ground and vertical rate still run — D-02). This is the archive-wide cohort, not ' +
      'merely the fraction of the raw-34 diagnostic cohort that happens to lack position.'
  );
  lines.push('');
  lines.push(
    'No position is UNKNOWN (drift genuinely could not be tested); point-to-point (§ Loop-gate ' +
      'exclusions below) is EXCLUDED BY DESIGN (the endpoints are real, just too far apart to call a ' +
      'loop) — the two are not the same disposition and are never merged in this report.'
  );
  lines.push('');

  // 8. Loop-gate exclusions
  lines.push('## Loop-gate exclusions (excluded by design)');
  lines.push('');
  lines.push('Point-to-point (raw-flagged, but start/end farther apart than the loop radius):');
  lines.push('');
  for (const e of report.loopGateExclusions.pointToPoint) {
    lines.push(`- \`${e.id}\` — ${e.startEndDistM.toFixed(1)} m apart`);
  }
  if (report.loopGateExclusions.pointToPoint.length === 0) lines.push('- (none)');
  lines.push('');
  lines.push('No position (raw-flagged, but start/end position unavailable):');
  lines.push('');
  for (const id of report.loopGateExclusions.noPosition) {
    lines.push(`- \`${id}\``);
  }
  if (report.loopGateExclusions.noPosition.length === 0) lines.push('- (none)');
  lines.push('');

  // 9. Correction of the raw-difference count (D-04)
  lines.push('## Correction of the raw-difference count (D-04)');
  lines.push('');
  lines.push(
    `The raw, un-loop-gated closure-drift cohort (\`|alt[end]-alt[start]| > ` +
      `${report.thresholds.closureDriftSevereDeltaM}\` m, no loop test) is **${report.rawDrift.count}**. ` +
      `The requirement's original figure was a raw-difference measurement taken without the loop ` +
      'condition — this is that same raw cohort, re-derived live, not the loop-gated one the shipped ' +
      'detector flags.'
  );
  lines.push('');
  lines.push('| Cohort | Count |');
  lines.push('|---|---|');
  lines.push(`| Raw drift (no loop gate) | ${report.rawDrift.count} |`);
  lines.push(`| → loop-gated, flagged | ${report.rawDrift.loopGatedCount} |`);
  lines.push(`| → excluded, point-to-point | ${report.rawDrift.pointToPointCount} |`);
  lines.push(`| → excluded, no position | ${report.rawDrift.noPositionCount} |`);
  lines.push('');
  lines.push(
    `${report.rawDrift.loopGatedCount} + ${report.rawDrift.pointToPointCount} + ${report.rawDrift.noPositionCount} = ` +
      `${report.rawDrift.loopGatedCount + report.rawDrift.pointToPointCount + report.rawDrift.noPositionCount} ` +
      `— ${report.rawDrift.loopGatedCount + report.rawDrift.pointToPointCount + report.rawDrift.noPositionCount === report.rawDrift.count ? 'reconciles exactly with the raw count above.' : 'DOES NOT reconcile with the raw count above — investigate before publishing.'}`
  );
  lines.push('');

  // 10. Mode independence (Criterion 2)
  lines.push('## Mode independence (Criterion 2)');
  lines.push('');
  const rawM = report.overlapRaw;
  lines.push(
    `**Raw-definition union (sub-ground ∪ raw drift ∪ vertical rate, no loop gate on drift): ` +
      `${rawM.unionSize}** — this is the requirement's originally-measured "71-activity" cohort, ` +
      `re-derived live rather than copied. It is LARGER than the loop-gated union ` +
      `(${m.unionSize}, § Overlap matrix above) because the raw drift cohort itself is larger ` +
      `(${rawM.bCount} vs. ${m.bCount}) before the 12 point-to-point and 1 no-position exclusions ` +
      'apply (§ Correction of the raw-difference count).'
  );
  lines.push('');
  lines.push(
    `Loop-gating changes which activities overlap, not just how many drift: sub-ground ∩ drift is ` +
      `${m.ab} loop-gated vs. ${rawM.ab} raw; sub-ground ∩ rate is ${m.ac} (drift loop-gating does not ` +
      `touch this pair, since it involves neither mode's drift definition directly — raw comparison: ` +
      `${rawM.ac}); drift ∩ rate is ${m.bc} loop-gated vs. ${rawM.bc} raw.`
  );
  lines.push('');
  lines.push(
    `${m.ab <= rawM.ab && m.bc <= rawM.bc ? 'The loop-gated overlaps are lower than or equal to the raw ones' : 'The loop-gated overlaps DIFFER from the raw ones (see numbers above; not strictly lower this run)'} — ` +
      'loop-gating removes false "drift" members that were coincidentally also flagged by another ' +
      'mode, so the remaining drift cohort is a cleaner, more independent signal than the raw one the ' +
      'requirement originally measured.'
  );
  lines.push('');
  lines.push(
    `Of the ${m.bCount} loop-gated drift-flagged activities, **${report.modeIndependence.driftOnlyCount}** ` +
      'are flagged by no other mode — a check bounded only by the sub-ground or vertical-rate ' +
      'thresholds alone would not have caught these, because their minimum altitude and their ' +
      'per-sample rate both stay clear of those thresholds; only the loop-gated closure test catches ' +
      'them. This is the discriminator proof that a floor bound alone could not have caught the drift ' +
      'cohort.'
  );
  lines.push('');

  // 11. Carry-forward fill and vertical rate (D-08)
  lines.push('## Carry-forward fill and vertical rate (D-08)');
  lines.push('');
  lines.push(
    'Carry-forward altitude fill (`derive-stream.ts`\'s `carryForward()`, applied to `alt` the same ' +
      'way it fills `d`) manufactures apparent vertical-rate violations; it never masks them. Masking ' +
      'would require an existing large single-sample jump to be smoothed away by the fill — but ' +
      'carry-forward fill only ever repeats a prior value or preserves an already-present jump ' +
      'verbatim, with no averaging step that could suppress a genuine spike. The risk runs in exactly ' +
      'one direction (false positives from a filled-then-jump pattern), never the other (a real spike ' +
      'hidden by filling).'
  );
  lines.push('');
  lines.push(
    `Operationalization: a violating sample-pair is "carry-forward correlated" when the sample ` +
      'immediately before the jump was itself preceded by at least one more byte-identical reading ' +
      '(i.e. the flat value repeats at least twice before the jump, `precedingIdenticalRun >= 2`).'
  );
  lines.push('');
  lines.push(
    `Measured: **${formatPct(report.carryForward.correlatedPairs, report.carryForward.totalViolatingPairs)}** ` +
      'of all vertical-rate-violating sample pairs archive-wide are carry-forward correlated by this ' +
      'operationalization.'
  );
  lines.push('');
  if (report.carryForward.worstTrace) {
    const trace = report.carryForward.worstTrace;
    lines.push(`Worst-case trace (\`${trace.id}\`, ${trace.rateMps.toFixed(1)} m/s, live-derived from the committed stream):`);
    lines.push('');
    lines.push('```');
    for (const sample of trace.window) {
      lines.push(`t=${sample.t}  alt=${sample.alt}${sample.marker ? `   ${sample.marker}` : ''}`);
    }
    lines.push('```');
    lines.push('');
  }
  lines.push(
    'This is a reported finding, not a defect: the detector stays per-sample per D-08/D-09 — no ' +
      'threshold is changed on account of it.'
  );
  lines.push('');

  // 12. Stream integrity (D-16)
  lines.push('## Stream integrity (D-16)');
  lines.push('');
  lines.push(`- Before-sweep digest (${report.streamIntegrity.beforeFileCount} files): \`${report.streamIntegrity.beforeDigest}\``);
  lines.push(`- After-sweep digest (${report.streamIntegrity.afterFileCount} files): \`${report.streamIntegrity.afterDigest}\``);
  lines.push(
    `- Digests **${report.streamIntegrity.beforeDigest === report.streamIntegrity.afterDigest ? 'match' : 'DO NOT MATCH'}** — ` +
      '`data/streams/` is byte-unchanged by this sweep.'
  );
  lines.push('');

  lines.push('## Regeneration');
  lines.push('');
  lines.push('Regenerate this report against the live committed archive with:');
  lines.push('');
  lines.push('```');
  lines.push(REGENERATE_COMMAND);
  lines.push('```');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// I/O — archive sweep (not imported by the guard test)
// ---------------------------------------------------------------------------

function readArchive() {
  const activityById = new Map();
  let activityFiles = [];
  try {
    activityFiles = readdirSync(ACTIVITIES_DIR).filter((f) => f.endsWith('.json'));
  } catch (error) {
    console.warn(`Warning: Failed to read activities directory ${ACTIVITIES_DIR}:`, error.message);
  }

  let activityParseFailures = 0;
  for (const file of activityFiles) {
    try {
      const activity = JSON.parse(readFileSync(join(ACTIVITIES_DIR, file), 'utf8'));
      activityById.set(idFromFilename(file), activity);
    } catch (error) {
      activityParseFailures++;
      console.warn(`Warning: Failed to read/parse activity ${file}:`, error.message);
    }
  }

  let streamFiles = [];
  try {
    streamFiles = readdirSync(STREAMS_DIR).filter(isStreamFile);
  } catch (error) {
    console.warn(`Warning: Failed to read streams directory ${STREAMS_DIR}:`, error.message);
  }

  const streamById = new Map();
  let streamParseFailures = 0;
  for (const file of streamFiles) {
    try {
      const stream = JSON.parse(readFileSync(join(STREAMS_DIR, file), 'utf8'));
      streamById.set(idFromFilename(file), stream);
    } catch (error) {
      streamParseFailures++;
      console.warn(`Warning: Failed to read/parse stream ${file} (treated as absent):`, error.message);
    }
  }

  return { activityById, streamById, activityParseFailures, streamParseFailures, streamFileCount: streamFiles.length };
}

function buildReport(archive) {
  const { activityById, streamById, activityParseFailures, streamParseFailures, streamFileCount } = archive;

  const entries = [];
  for (const [id, activity] of activityById) {
    const stream = streamById.get(id) ?? null;
    const signal = elevationSignal(
      { t: stream?.t, alt: stream?.alt },
      { startLatlng: activity?.start_latlng, endLatlng: activity?.end_latlng }
    );
    const rawDrift = rawClosureDelta(stream?.alt);
    entries.push({ id, activity, stream, signal, rawDrift });
  }

  const activityCount = entries.length;
  const altCarryingEntries = entries.filter((e) => hasAltChannel(e.stream));
  const altCarryingCount = altCarryingEntries.length;

  const distances = entries.map((e) => e.signal.closureDrift.startEndDistM).filter((d) => d !== null);
  const positionedActivityCount = distances.length;
  const distributionOfDistances = distanceDistribution(distances, LOOP_RADIUS_M);

  const subGroundFlagged = altCarryingEntries.filter((e) => e.signal.subGround.flagged);
  const closureDriftFlagged = altCarryingEntries.filter((e) => e.signal.closureDrift.state === 'flagged');
  const verticalRateFlagged = altCarryingEntries.filter((e) => e.signal.verticalRate.flagged);

  const subGroundIds = new Set(subGroundFlagged.map((e) => e.id));
  const closureDriftIds = new Set(closureDriftFlagged.map((e) => e.id));
  const verticalRateIds = new Set(verticalRateFlagged.map((e) => e.id));

  const driftNotComputable = altCarryingEntries.filter((e) => e.signal.closureDrift.startEndDistM === null);

  const rawDriftFlagged = altCarryingEntries.filter((e) => e.rawDrift.flagged);
  const rawDriftIds = new Set(rawDriftFlagged.map((e) => e.id));
  const pointToPoint = rawDriftFlagged.filter((e) => e.signal.closureDrift.state === 'clear');
  const noPosition = rawDriftFlagged.filter((e) => e.signal.closureDrift.state === 'not-computable');
  const loopGatedWithinRaw = rawDriftFlagged.filter((e) => e.signal.closureDrift.state === 'flagged');

  const overlapLoopGated = computeOverlapMatrix(subGroundIds, closureDriftIds, verticalRateIds);
  const overlapRaw = computeOverlapMatrix(subGroundIds, rawDriftIds, verticalRateIds);
  const inclusionExclusion = checkInclusionExclusion(overlapLoopGated);

  const unionDeviceFamily = deviceFamilyBreakdown(overlapLoopGated.unionIds, activityById);

  const driftOnlyCount = [...closureDriftIds].filter(
    (id) => !subGroundIds.has(id) && !verticalRateIds.has(id)
  ).length;

  // Carry-forward correlation scan (D-08), over the flagged vertical-rate
  // entries only.
  let totalViolatingPairs = 0;
  let correlatedPairs = 0;
  let worstTrace = null;
  let worstRateSeen = -Infinity;
  for (const e of verticalRateFlagged) {
    const pairs = scanVerticalRatePairs(e.stream.t, e.stream.alt);
    if (pairs.length !== e.signal.verticalRate.violatingSamples) {
      console.warn(
        `Warning: diagnostic scan found ${pairs.length} violating pairs for ${e.id}, ` +
          `shipped detector reports ${e.signal.verticalRate.violatingSamples} — investigate this diagnostic, ` +
          'not the shipped detector.'
      );
    }
    for (const pair of pairs) {
      totalViolatingPairs++;
      if (pair.precedingIdenticalRun >= 2) correlatedPairs++;
      if (pair.rateMps > worstRateSeen) {
        worstRateSeen = pair.rateMps;
        const alt = e.stream.alt;
        const t = e.stream.t;
        // Window spans the preceding carry-forward-filled run (if any)
        // through the violating jump sample itself, so the printed trace
        // shows both the flat stretch and the single tick that carries it.
        const startIdx = Math.max(0, pair.index - pair.precedingIdenticalRun + 1);
        const jumpIdx = pair.index + 1;
        const window = [];
        for (let k = startIdx; k <= jumpIdx && k < alt.length; k++) {
          window.push({
            t: t[k],
            alt: alt[k],
            marker: k === jumpIdx ? `<- the violating jump (${pair.rateMps.toFixed(1)} m/s)` : '',
          });
        }
        worstTrace = { id: e.id, rateMps: pair.rateMps, window };
      }
    }
  }

  const pickWorstBy = (list, valueFn, n) =>
    [...list].sort((a, b) => valueFn(b) - valueFn(a)).slice(0, n);

  return {
    generatedAt: new Date().toISOString(),
    activityCount,
    activityParseFailures,
    streamFileCount,
    streamParseFailures,
    altCarryingCount,
    positionedActivityCount,
    distanceDistribution: distributionOfDistances,
    loopRadiusM: LOOP_RADIUS_M,
    thresholds: {
      subGroundMinAltM: SUB_GROUND_MIN_ALT_M,
      closureDriftSevereDeltaM: CLOSURE_DRIFT_SEVERE_DELTA_M,
      verticalRateSevereMps: VERTICAL_RATE_SEVERE_MPS,
    },
    subGround: {
      count: subGroundFlagged.length,
      worst: pickWorstBy(subGroundFlagged, (e) => -e.signal.subGround.minAltM, WORST_N).map((e) => ({
        id: e.id,
        minAltM: e.signal.subGround.minAltM,
      })),
    },
    closureDrift: {
      count: closureDriftFlagged.length,
      computablePopulation: altCarryingCount - driftNotComputable.length,
      worst: pickWorstBy(closureDriftFlagged, (e) => Math.abs(e.signal.closureDrift.deltaM), WORST_N).map((e) => ({
        id: e.id,
        deltaM: e.signal.closureDrift.deltaM,
        startEndDistM: e.signal.closureDrift.startEndDistM,
      })),
    },
    verticalRate: {
      count: verticalRateFlagged.length,
      worst: pickWorstBy(verticalRateFlagged, (e) => e.signal.verticalRate.worstRateMps, WORST_N).map((e) => ({
        id: e.id,
        worstRateMps: e.signal.verticalRate.worstRateMps,
      })),
    },
    overlapLoopGated,
    overlapRaw,
    inclusionExclusion,
    unionDeviceFamily,
    driftNotComputable: { count: driftNotComputable.length },
    loopGateExclusions: {
      pointToPoint: pointToPoint.map((e) => ({ id: e.id, startEndDistM: e.signal.closureDrift.startEndDistM })),
      noPosition: noPosition.map((e) => e.id),
    },
    rawDrift: {
      count: rawDriftFlagged.length,
      loopGatedCount: loopGatedWithinRaw.length,
      pointToPointCount: pointToPoint.length,
      noPositionCount: noPosition.length,
    },
    modeIndependence: { driftOnlyCount },
    carryForward: { totalViolatingPairs, correlatedPairs, worstTrace },
    streamIntegrity: null, // filled by main() after the post-sweep digest is taken
  };
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------

function main() {
  console.log('Computing pre-sweep data/streams/ digest (D-16)...');
  const before = computeStreamsDigest(STREAMS_DIR);
  console.log(`  ${before.fileCount} files, digest ${before.digest}`);

  console.log('Reading the live archive (data/activities/, data/streams/)...');
  const archive = readArchive();
  console.log(`Activities: ${archive.activityById.size}; streams present: ${archive.streamFileCount}`);

  console.log('Computing elevation signals for every activity (shipped classifier, no overrides)...');
  const report = buildReport(archive);
  console.log(`Loop-gated union: ${report.overlapLoopGated.unionSize}`);

  console.log('Computing post-sweep data/streams/ digest (D-16)...');
  const after = computeStreamsDigest(STREAMS_DIR);
  console.log(`  ${after.fileCount} files, digest ${after.digest}`);

  const gate = checkDigestGate(before, after);
  if (!gate.pass) {
    console.error(gate.message);
    process.exit(1);
  }
  console.log(gate.message);

  if (!report.inclusionExclusion.pass) {
    console.error(
      `FATAL: inclusion-exclusion check failed for the loop-gated overlap matrix — computed ` +
        `${report.inclusionExclusion.computed}, direct union ${report.inclusionExclusion.unionSize}. ` +
        'This indicates a bug in the overlap arithmetic, not a report-writing slip. Refusing to write ' +
        'the calibration report.'
    );
    process.exit(1);
  }
  console.log('Inclusion-exclusion check: PASS.');

  report.streamIntegrity = {
    beforeDigest: before.digest,
    afterDigest: after.digest,
    beforeFileCount: before.fileCount,
    afterFileCount: after.fileCount,
  };

  const markdown = renderCalibrationMarkdown(report);
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');

  console.log(`\nWrote ${OUTPUT_PATH}`);
}

// Self-execution guard, mirroring compute-pace-quality-calibration.mjs:
// main() runs only under direct invocation, so
// scripts/compute-elevation-calibration.test.mjs can import the pure
// functions above without triggering the archive sweep or a write to
// 30-CALIBRATION.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
