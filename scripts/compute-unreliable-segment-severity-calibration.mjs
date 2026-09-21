/**
 * Phase 33 plan 08 / D-07: the unreliable-segment SEVERITY-tier calibration generator.
 *
 * Derives the one new D-07 constant SEG-06 needs: the excess-metres fraction above which an
 * activity's unreliable-segment signal is `severe` rather than `minor`. `none` (zero detected
 * segments) needs no calibration — it is a presence fact, not a magnitude judgement (33-08-PLAN.md
 * "PLANNER DECISION"). This is a calibration GENERATOR, not a recount: unlike
 * `scripts/compute-coverage-identity-recount.mjs` (plan 33-07, deliberately forbidden from
 * importing the detector), this script IS allowed to import `detectUnreliableSegments` —
 * calibrating the detector's own downstream tier is exactly this generator's job.
 *
 * Imports `classifyGapsThreeWay`/`quantile` from `../dist/analytics/pace-derivation.js` (the ONE
 * pre-detector gap list and the ONE R-7 percentile implementation this codebase uses — this file
 * never writes a second percentile function) and `detectUnreliableSegments`/
 * `DEFAULT_DETECTOR_PARAMS` from `../dist/analytics/unreliable-segments.js`. The detector is fed
 * the pre-detector `classifyGapsThreeWay` gap list, never the POST-detector `classifyGaps` output —
 * `classifyGaps` now folds `detectUnreliableSegments` into its own output (Phase 33 D-14), so
 * feeding that back in would be the detector judging its own prior output (plan 33-01 Task 2's
 * circularity rule).
 *
 * ANTI-QUOTA (T-33-11b): the archive-wide severe/minor/none distribution the chosen cut produces is
 * a REPORTED FINDING, computed and rendered only AFTER the candidate is selected, never consulted
 * while selecting it. A candidate is chosen by clearing the D-13 insensitivity tolerance at the
 * SMALLEST outer-percentile order that does — never by the count or rate it yields. This file's
 * `selectSevereCut` takes the excess-fraction population and a fixed candidate list; it has no
 * parameter through which a flagged count could reach it.
 *
 * CIRCULARITY (T-33-11): a deliberately circular strawman — a raw tail percentile (q=0.99) of the
 * excess-fraction population ITSELF — is computed and run through the exact same insensitivity
 * check as every real candidate, and its `pass: false` verdict is rendered as a blocker if it
 * should ever come back true (mirroring Phase 32's own `strawmanTailPercentile` precedent).
 *
 * No wall-clock timestamp or generated-at field appears anywhere in the rendered output: a re-run
 * against an unchanged archive is byte-identical.
 *
 * Shape follows `compute-unreliable-segment-calibration.mjs`: pure exported functions with zero
 * file I/O, plus a `main()` gated behind the standard self-execution guard so
 * `compute-unreliable-segment-severity-calibration.test.mjs` can import every pure function below
 * without triggering an archive read or a write to `33-CALIBRATION.md` as an import-time side
 * effect.
 *
 * No import-time `fs`-mock no-side-effect guard was written for this file (33-08-SUMMARY.md
 * records this decision explicitly) — plan 33-07's own precedent already established that the
 * self-execution guard below (`import.meta.url === pathToFileURL(...)`) is what actually prevents a
 * real file read as an import-time side effect, and this repo's own recorded memory ("fs spy cannot
 * observe named imports") disqualifies a `vi.spyOn(fs, ...)` guard for a module consuming `fs` via
 * named imports without ALSO writing the full `vi.mock('fs')` + two-positive-control apparatus
 * `scripts/unreliable-segment-import-guards.test.mjs` already built and demonstrated OBSERVED for
 * the sibling calibration/recount generators — duplicating that apparatus a third time for this
 * file adds no new coverage shape, only a third copy of the same mechanism.
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  detectUnreliableSegments,
  DEFAULT_DETECTOR_PARAMS,
} from '../dist/analytics/unreliable-segments.js';
import { classifyGapsThreeWay, quantile } from '../dist/analytics/pace-derivation.js';
import { validateStreamSeries } from '../dist/analytics/best-effort-utils.js';
import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md'
);

const REGENERATE_COMMAND = 'npm run build && npm run compute-unreliable-segment-severity-calibration';

/** D-13's tolerance, fixed BEFORE any insensitivity check runs (never adjusted after seeing a delta) — the
 * same 1% Phase 32 used, per this plan's own `removedDelta` convention. */
export const INSENSITIVITY_TOLERANCE = 0.01;

/** The candidate outer-percentile list, fixed and round BEFORE any check runs (32-CONTEXT.md D-10's
 * own multiplier-selection precedent). Smallest-clearing-q wins (33-08-PLAN.md § interfaces). */
export const CANDIDATE_OUTER_PERCENTILES = [0.9, 0.95, 0.97, 0.99];

/** The strawman's own tail-percentile order — deliberately the population's own top order, the
 * circular shape D-07's real rule is NOT. */
export const STRAWMAN_PERCENTILE = 0.99;

/** Deterministic planted-synthetic batch size and multiplier (33-08-PLAN.md's own "say 25, at 10x
 * the cohort maximum"). Both fixed constants, never derived from a flagged count. */
export const PLANT_COUNT = 25;
export const PLANT_MULTIPLIER = 10;

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O
// ---------------------------------------------------------------------------

/**
 * One activity's excess fraction: the summed `excessMetres` of every detected segment, over the
 * activity's own total distance (`totalDistanceM`, the caller's job to compute — this function
 * takes no `t`/`d`). Returns `null`, NEVER `0`, when `totalDistanceM` is not a positive finite
 * number — a zero-or-negative denominator is unmeasurable, not "zero excess".
 */
export function activityExcessFraction(segments, totalDistanceM) {
  if (!Number.isFinite(totalDistanceM) || !(totalDistanceM > 0)) return null;
  let sum = 0;
  for (const segment of segments) sum += segment.excessMetres;
  return sum / totalDistanceM;
}

/**
 * The R-7 percentile (imported `quantile`, no local percentile implementation) of `fractions` at
 * order `q`, over a freshly sorted-ascending copy — never mutates the caller's array.
 */
export function candidateCut(fractions, q) {
  const sorted = [...fractions].sort((a, b) => a - b);
  return quantile(sorted, q);
}

/**
 * D-13's two-direction insensitivity check for ONE candidate order `q`, over an already-built
 * excess-fraction population (`fractions`, the flagged cohort's own values — the caller decides
 * which population this is, so the same function serves both a real candidate and the strawman).
 *
 * (a) removal: re-derives the cut over the population with its OWN top decile removed (the
 *     highest-valued 10%, by sorted rank) — never a fixed absolute cut.
 * (b) planted synthetics: re-derives the cut over the population plus `PLANT_COUNT` synthetic
 *     values, each equal to `PLANT_MULTIPLIER x` the population's own maximum — a deterministic
 *     plant, so two runs over the same archive are byte-identical.
 *
 * `pass` requires BOTH relative deltas to clear `tolerance`. An empty or degenerate population
 * (fewer than 2 values, so a top-decile removal would empty it, or a `null`/zero base) reports both
 * deltas as `null` and `pass: false` — never divides by zero.
 */
export function insensitivityForCandidate(fractions, q, { tolerance }) {
  const sorted = [...fractions].sort((a, b) => a - b);
  const base = sorted.length === 0 ? null : candidateCut(sorted, q);

  const keepCount = Math.floor(sorted.length * 0.9);
  const removedPopulation = sorted.slice(0, keepCount);
  const removedCut = removedPopulation.length > 0 ? candidateCut(removedPopulation, q) : null;
  const removedDelta =
    base === null || base === 0 || removedCut === null
      ? null
      : Math.abs(removedCut - base) / Math.abs(base);

  const maxValue = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const plantedValue = maxValue * PLANT_MULTIPLIER;
  const plantedPopulation = [...sorted, ...Array(PLANT_COUNT).fill(plantedValue)];
  const plantedCut = candidateCut(plantedPopulation, q);
  const plantedDelta =
    base === null || base === 0 ? null : Math.abs(plantedCut - base) / Math.abs(base);

  const pass =
    removedDelta !== null &&
    plantedDelta !== null &&
    removedDelta <= tolerance &&
    plantedDelta <= tolerance;

  return {
    q,
    base,
    n: sorted.length,
    removedCut,
    removedN: removedPopulation.length,
    removedDelta,
    plantedCut,
    plantedN: plantedPopulation.length,
    plantedDelta,
    pass,
  };
}

/**
 * Runs every candidate in `CANDIDATE_OUTER_PERCENTILES` (in order) through
 * `insensitivityForCandidate`, and selects the SMALLEST `q` whose `pass` is `true` — mirroring
 * `32-CALIBRATION.md`'s own multiplier-selection rule ("smallest candidate that clears the
 * tolerance wins"). `chosen` is `null` when no candidate passes; `results` always carries every
 * candidate's full row for rendering, regardless of outcome.
 */
export function selectSevereCut(fractions, { tolerance = INSENSITIVITY_TOLERANCE } = {}) {
  const results = CANDIDATE_OUTER_PERCENTILES.map((q) =>
    insensitivityForCandidate(fractions, q, { tolerance })
  );
  const chosen = results.find((r) => r.pass) ?? null;
  return { results, chosen, tolerance };
}

/**
 * STRAWMAN (Pitfall C, watched failing before any real candidate is trusted): the raw
 * `STRAWMAN_PERCENTILE` tail percentile of the excess-fraction population itself, run through the
 * SAME `insensitivityForCandidate` two-direction check. Deliberately circular — the top X% is
 * "severe" by construction regardless of X, so this population is exactly the one D-07's real rule
 * must NOT threshold against.
 */
export function strawmanCandidate(fractions, { tolerance = INSENSITIVITY_TOLERANCE } = {}) {
  return insensitivityForCandidate(fractions, STRAWMAN_PERCENTILE, { tolerance });
}

/**
 * Builds the flagged cohort — every archive activity with at least one detected segment — and each
 * member's own excess fraction. `gaps` MUST be the caller's pre-detector `classifyGapsThreeWay`
 * list (D-02/D-14); this function does not compute gaps itself, it only consumes `activity.gaps`.
 * Activities whose fraction comes back `null` (a zero/degenerate total distance) are counted in
 * `notComputableInCohort` and excluded from `fractions` — never silently coerced to `0`.
 */
export function buildFlaggedCohort(archive) {
  const members = [];
  let notComputableInCohort = 0;

  for (const activity of archive.activities) {
    const segments = detectUnreliableSegments(
      activity.t,
      activity.d,
      activity.gaps,
      DEFAULT_DETECTOR_PARAMS
    );
    if (segments.length === 0) continue;

    const totalDistanceM = activity.d[activity.d.length - 1] - activity.d[0];
    const fraction = activityExcessFraction(segments, totalDistanceM);
    if (fraction === null) {
      notComputableInCohort++;
      continue;
    }
    members.push({ id: activity.id, segmentCount: segments.length, totalDistanceM, fraction });
  }

  return {
    members,
    fractions: members.map((m) => m.fraction),
    cohortSize: members.length + notComputableInCohort,
    notComputableInCohort,
  };
}

/**
 * The archive-wide severe/minor/none/not-computable distribution the chosen `cut` produces — a
 * REPORTED FINDING computed only from an already-selected `cut`, never consulted while selecting
 * one. `none` = zero detected segments (a presence fact); `minor` = at least one segment with
 * `fraction <= cut`; `severe` = `fraction > cut`; `not-computable` = at least one segment but a
 * `null` fraction (degenerate total distance).
 */
export function severityDistribution(archive, cut) {
  let none = 0;
  let minor = 0;
  let severe = 0;
  let notComputable = 0;

  for (const activity of archive.activities) {
    const segments = detectUnreliableSegments(
      activity.t,
      activity.d,
      activity.gaps,
      DEFAULT_DETECTOR_PARAMS
    );
    if (segments.length === 0) {
      none++;
      continue;
    }
    const totalDistanceM = activity.d[activity.d.length - 1] - activity.d[0];
    const fraction = activityExcessFraction(segments, totalDistanceM);
    if (fraction === null) {
      notComputable++;
      continue;
    }
    if (fraction > cut) severe++;
    else minor++;
  }

  return { none, minor, severe, notComputable, total: archive.activities.length };
}

/**
 * Loads the archive: every `data/streams/*.json` file (via `isStreamFile`, never `manifest.json`),
 * classified as `notComputable` (and excluded from `activities`) on a parse failure or a
 * `validateStreamSeries` rejection — never silently dropped without a trace, since both counts
 * always reach the rendered `## Inputs` section. `gaps` is `classifyGapsThreeWay(t, d).gapIntervals`
 * — the ONE pre-detector shape the detector is ever fed (D-02/D-14).
 */
export function loadArchive(streamsDir) {
  const files = readdirSync(streamsDir).filter(isStreamFile).sort();
  const activities = [];
  let notComputable = 0;

  for (const filename of files) {
    const id = idFromFilename(filename);

    let stream;
    try {
      stream = JSON.parse(readFileSync(join(streamsDir, filename), 'utf8'));
    } catch {
      notComputable++;
      continue;
    }

    const t = Array.isArray(stream.t) ? stream.t : [];
    const d = Array.isArray(stream.d) ? stream.d : [];
    if (!validateStreamSeries(t, d).ok) {
      notComputable++;
      continue;
    }

    const gaps = classifyGapsThreeWay(t, d).gapIntervals;
    activities.push({ id, t, d, gaps });
  }

  return { activities, streamFileCount: files.length, notComputable };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtPct(v, decimals = 4) {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(decimals)}%`;
}

function fmtNum(v, decimals = 6) {
  return v === null || v === undefined ? '—' : v.toFixed(decimals);
}

function renderInsensitivityTable(rows) {
  const lines = [];
  lines.push('| q | n | cut | removedCut (n) | removedDelta | plantedCut (n) | plantedDelta | Verdict |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(
      `| ${r.q} | ${r.n} | ${fmtNum(r.base)} | ${fmtNum(r.removedCut)} (${r.removedN}) | ` +
        `${fmtPct(r.removedDelta)} | ${fmtNum(r.plantedCut)} (${r.plantedN}) | ${fmtPct(r.plantedDelta)} | ` +
        `${r.pass ? 'PASS' : 'FAIL'} |`
    );
  }
  return lines.join('\n');
}

/**
 * Renders the full artifact. `selection.chosen` is `null` on a NO CANDIDATE CLEARS outcome — that
 * branch omits any "Chosen constant" value and states the halt condition instead (33-08-PLAN.md
 * Task 3 step 5), never inventing a fallback constant.
 */
export function renderCalibrationMarkdown({ archive, cohort, selection, strawman, distribution }) {
  const lines = [];

  lines.push('# Phase 33 Plan 8: D-07 severity-tier calibration (SEG-06)');
  lines.push('');
  lines.push(
    `Regenerate with \`${REGENERATE_COMMAND}\`. This artifact carries no wall-clock timestamp or ` +
      'generated-at field — a re-run against an unchanged archive is byte-identical.'
  );
  lines.push('');

  lines.push('## Statistic');
  lines.push('');
  lines.push(
    'For each activity with at least one detected unreliable segment, `excessFraction = ' +
      'sum(segment.excessMetres) / (d[n-1] - d[0])` — the summed merged-segment excess over the ' +
      "activity's own total distance (D-07: a fraction of the activity's OWN distance, never " +
      'unreliable-seconds over span). The candidate cut is `quantile(sortedAsc(excessFractions), q)` ' +
      `for \`q\` drawn in order from \`[${CANDIDATE_OUTER_PERCENTILES.join(', ')}]\`; the smallest ` +
      'passing candidate wins.'
  );
  lines.push('');

  lines.push('## Non-circularity');
  lines.push('');
  lines.push(
    `The cut is derived from the flagged cohort's own excess-fraction population — ${cohort.members.length} ` +
      `of ${archive.activities.length} activities with at least one detected segment ` +
      `(cohort size ${cohort.cohortSize}, ${cohort.notComputableInCohort} not computable within it). This ` +
      "population IS the population the cut later judges (every flagged activity's own fraction), so a " +
      'percentile of it is PARTIALLY circular by construction — stated plainly here rather than argued away. ' +
      'The insensitivity check below is what adjudicates whether that partial circularity is disqualifying: ' +
      'a candidate clears D-13 only when removing its own top decile, or planting extreme synthetic ' +
      'contamination, barely moves it — evidence the cut is not merely restating an arbitrary rank of its own ' +
      'judged population.'
  );
  lines.push('');

  lines.push('## Candidate excess-fraction cuts (D-13 insensitivity)');
  lines.push('');
  lines.push(
    `Tolerance: ${fmtPct(selection.tolerance, 0)}. Selection rule: the SMALLEST \`q\` whose both deltas ` +
      'clear the tolerance wins — never the count or severe rate it produces.'
  );
  lines.push('');
  lines.push(renderInsensitivityTable(selection.results));
  lines.push('');

  if (selection.chosen) {
    lines.push('## Chosen constant');
    lines.push('');
    lines.push(
      `**SEG_SEVERE_EXCESS_FRACTION = ${fmtNum(selection.chosen.base)}** (q=${selection.chosen.q}, the ` +
        'smallest candidate clearing the tolerance).'
    );
    lines.push('');
  } else {
    lines.push('## NO CANDIDATE CLEARS');
    lines.push('');
    lines.push(
      `None of \`[${CANDIDATE_OUTER_PERCENTILES.join(', ')}]\` cleared the ${fmtPct(selection.tolerance, 0)} ` +
        'tolerance in both directions — see the candidate table above for every measured delta. No constant ' +
        'is named; this is a HALT condition for a developer decision (33-08-PLAN.md Task 3 step 5), not a ' +
        'widened candidate list or a loosened tolerance chosen unilaterally.'
    );
    lines.push('');
  }

  lines.push('## Why not a tail percentile of the population itself');
  lines.push('');
  lines.push(
    `The deliberately circular strawman — \`quantile(excessFractions, ${STRAWMAN_PERCENTILE})\`, a raw tail ` +
      'percentile of the excess-fraction population ITSELF — is run through the identical two-direction ' +
      'insensitivity check as every real candidate:'
  );
  lines.push('');
  lines.push(renderInsensitivityTable([strawman]));
  lines.push('');
  lines.push(
    strawman.pass
      ? '**BLOCKER: the strawman PASSED the insensitivity tolerance.** An unfalsifiable candidate clearing ' +
          'this check means the check itself is not discriminating — the constant above cannot be trusted ' +
          'until this is understood. Do not ship it as-is.'
      : `**FAILED** — removedDelta ${fmtPct(strawman.removedDelta)}, plantedDelta ${fmtPct(strawman.plantedDelta)}, ` +
          `both measured against the ${fmtPct(selection.tolerance, 0)} tolerance. The strawman's own top rank ` +
          'moves with its own top decile and with planted contamination close to exactly as much as removing or ' +
          'planting would move any other tail percentile of the same population — it fails for the same ' +
          'structural reason Phase 32\'s two strawmen did.'
  );
  lines.push('');

  lines.push('## Archive-wide severe/minor/none distribution (reported finding)');
  lines.push('');
  if (selection.chosen) {
    lines.push(
      `At the chosen cut (${fmtNum(selection.chosen.base)}): **severe ${distribution.severe}**, ` +
        `**minor ${distribution.minor}**, **none ${distribution.none}**, not-computable ` +
        `${distribution.notComputable}, of ${distribution.total} activities.`
    );
    lines.push('');
    lines.push(
      'This rate is reported as a finding, never tuned toward. Nothing in `selectSevereCut` or this ' +
        'rendering step adjusts `q`, the tolerance, the statistic, or the synthetic plant in response to it.'
    );
  } else {
    lines.push('Not computed — no candidate cleared the tolerance, so no cut exists to classify against.');
  }
  lines.push('');

  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Streams scanned: ${archive.streamFileCount}, not computable: ${archive.notComputable}`);
  lines.push(
    `- Flagged cohort: ${cohort.members.length} activities with ≥1 detected segment ` +
      `(cohort size ${cohort.cohortSize}, ${cohort.notComputableInCohort} not computable within it)`
  );
  lines.push(`- Candidate outer percentiles: [${CANDIDATE_OUTER_PERCENTILES.join(', ')}]`);
  lines.push(`- Insensitivity tolerance: ${fmtPct(selection.tolerance, 0)}`);
  lines.push(`- Planted-synthetic batch: ${PLANT_COUNT} values at ${PLANT_MULTIPLIER}x the population's own maximum`);
  lines.push(`- Detector constants (imported, never re-derived here): speedLimitMps=${DEFAULT_DETECTOR_PARAMS.speedLimitMps}, excessFloorMetres=${DEFAULT_DETECTOR_PARAMS.excessFloorMetres}, hiddenPauseMinMetres=${DEFAULT_DETECTOR_PARAMS.hiddenPauseMinMetres}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main() — gated behind the self-execution guard
// ---------------------------------------------------------------------------

function main() {
  console.log('Computing the D-07 unreliable-segment severity-tier calibration...\n');

  let archive;
  try {
    archive = loadArchive(STREAMS_DIR);
  } catch (error) {
    console.error(`Error: could not read the archive: ${error.message}`);
    console.error(`Run \`npm run build\` first, then re-run \`npm run compute-unreliable-segment-severity-calibration\`.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Streams scanned: ${archive.streamFileCount}, not computable: ${archive.notComputable}`);

  const cohort = buildFlaggedCohort(archive);
  console.log(`Flagged cohort: ${cohort.members.length} activities (cohort size ${cohort.cohortSize})`);
  if (cohort.members.length === 0) {
    console.error('Error: the flagged cohort is empty — cannot derive a percentile over zero activities.');
    process.exitCode = 1;
    return;
  }

  const selection = selectSevereCut(cohort.fractions, { tolerance: INSENSITIVITY_TOLERANCE });
  for (const r of selection.results) {
    console.log(
      `  q=${r.q}: cut=${r.base} removedDelta=${r.removedDelta} plantedDelta=${r.plantedDelta} pass=${r.pass}`
    );
  }

  const strawman = strawmanCandidate(cohort.fractions, { tolerance: INSENSITIVITY_TOLERANCE });
  console.log(
    `  strawman (q=${STRAWMAN_PERCENTILE}): cut=${strawman.base} removedDelta=${strawman.removedDelta} plantedDelta=${strawman.plantedDelta} pass=${strawman.pass}`
  );

  const distribution = selection.chosen
    ? severityDistribution(archive, selection.chosen.base)
    : { none: 0, minor: 0, severe: 0, notComputable: 0, total: archive.activities.length };

  const markdown = renderCalibrationMarkdown({ archive, cohort, selection, strawman, distribution });
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`\nWrote ${OUTPUT_PATH}`);

  if (!selection.chosen) {
    console.error('\nNO CANDIDATE CLEARS — no constant named. See the artifact for the full candidate table.');
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring compute-unreliable-segment-calibration.mjs / compute-coverage-identity-recount.mjs:
// main() runs only under direct invocation, so compute-unreliable-segment-severity-calibration.test.mjs can import
// every pure function above without triggering an archive read or a write to 33-CALIBRATION.md as an import-time
// side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
