/**
 * PACE-06 residual report — the archive sweep producing the baseline-vs-adaptive
 * fast-mass comparison and the committed `26-RESIDUAL.md` deliverable (D-19).
 *
 * D-19: the report ships with the script that regenerates it. Phase 27 consumes
 * `26-RESIDUAL.md`'s residual list as pre-flagged input and re-derives it at its
 * own boundary by running `npm run compute-pace-residual` again, rather than
 * trusting a transcribed table.
 *
 * Structure follows `compute-route-data.mjs` (the archive-sweep analog): a
 * per-file try/catch around `readFileSync`/`JSON.parse` that warns and
 * continues (T-26-01 — one unreadable stream cannot abort the sweep), and a
 * `main()` that drives the whole run.
 *
 * Deviation from the compute-route-data.mjs convention (Rule 1 — see
 * 26-09-SUMMARY.md "Deviations"): this script also ships a guard test that
 * imports its pure functions directly, so — mirroring `curate-server.mjs` and
 * `exclusion-cli.mjs`, both of which have the same shape — `main()` is gated
 * behind a self-execution check rather than invoked unconditionally at module
 * scope. Without the guard, importing this file for the unit test would run
 * the whole archive sweep (and write `26-RESIDUAL.md`) as a side effect of
 * every `npx vitest run` invocation, which the plan's own task text says the
 * guard test must NOT do ("exercise them without running the whole sweep").
 *
 * Only write target: `.planning/phases/.../26-RESIDUAL.md` (T-26-10). Reads
 * `data/streams/` read-only; never writes into `data/`.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { derivePaceWithCoverage, paceHistogramSamples } from '../dist/analytics/pace-derivation.js';
import { isStreamFile } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STREAMS_DIR = join(__dirname, '../data/streams');
const OUTPUT_PATH = join(
  __dirname,
  '../.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md'
);

/** 3:00/km — the same "phantom fast mode" threshold PACE-04/06 are measured against. */
const FAST_THRESHOLD_SEC_PER_KM = 180;

/** PACE-06's residual definition: covered-time fast mass still above 0.5%. */
const RESIDUAL_THRESHOLD_FRACTION = 0.005;

/**
 * Cohort definition reproducing the roadmap's documented "154": more than 15%
 * of consecutive samples have zero distance advance.
 */
const SEVERE_STAIR_STEP_ZERO_ADVANCE_FRACTION = 0.15;

/**
 * The 50-sample floor excludes one degenerate near-empty stream (`11865310195`,
 * 100% zero-distance because it is a manual/short entry, not a decimation
 * artifact) which would otherwise raise the raw cohort count from 154 to 155.
 * This floor is what reproduces the documented cohort size rather than a
 * larger one — 26-RESEARCH.md § "Measured Figures".
 */
const SEVERE_STAIR_STEP_MIN_SAMPLES = 50;

const REGENERATE_COMMAND = 'npm run compute-pace-residual';

/**
 * The fraction of consecutive `[i-1, i]` sample pairs whose distance does not
 * advance (`d[i] <= d[i-1]`), over `n - 1`. Total: any stream with fewer than
 * two samples returns 0 rather than dividing by zero.
 */
export function zeroAdvanceFraction(stream) {
  const t = stream?.t ?? [];
  const d = stream?.d ?? [];
  const n = Math.min(t.length, d.length);
  if (n < 2) return 0;

  let zeroCount = 0;
  for (let i = 1; i < n; i++) {
    if (d[i] <= d[i - 1]) zeroCount++;
  }
  return zeroCount / (n - 1);
}

/**
 * The severe stair-step cohort membership test: `zeroAdvanceFraction(stream)
 * > 0.15` AND `stream.t.length >= 50`. See SEVERE_STAIR_STEP_MIN_SAMPLES above
 * for the 50-sample floor's reason.
 */
export function isSevereStairStep(stream) {
  const t = stream?.t ?? [];
  if (t.length < SEVERE_STAIR_STEP_MIN_SAMPLES) return false;
  return zeroAdvanceFraction(stream) > SEVERE_STAIR_STEP_ZERO_ADVANCE_FRACTION;
}

/**
 * Negative case 8 — the unfixed, pre-Phase-26 per-sample path, replicated
 * verbatim from `detail-zones.ts`'s `computePaceDistribution` (`dt <= 0 || dd
 * <= 0` skip, `dt / (dd / 1000)` pace, weighted by each segment's own `dt`).
 * Kept deliberately so the "after" column (`adaptiveFastMass`) is measured
 * against something real that shipped, rather than against an assertion.
 * Returns the Δt-weighted fraction of time faster than `FAST_THRESHOLD_SEC_PER_KM`.
 */
export function baselineFastMass(t, d) {
  const n = Math.min(t.length, d.length);
  let fastWeightedSec = 0;
  let totalWeightedSec = 0;

  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    const dd = d[i + 1] - d[i];
    if (dt <= 0 || dd <= 0) continue;

    const paceSecPerKm = dt / (dd / 1000);
    totalWeightedSec += dt;
    if (paceSecPerKm < FAST_THRESHOLD_SEC_PER_KM) fastWeightedSec += dt;
  }

  if (totalWeightedSec === 0) return 0;
  return fastWeightedSec / totalWeightedSec;
}

/**
 * The shared derivation's own fast mass, restricted to covered time only —
 * Criterion 1's "restricting the histogram to covered time" requirement.
 * Derives the pace series via `derivePaceWithCoverage` (which resolves the
 * adaptive window internally), builds the Δt-weighted histogram samples via
 * `paceHistogramSamples(t, paceSeries, gapIntervals)` — `gapIntervals` is a
 * required argument (cross-plan integration repair, 2026-09-08) because a
 * null-index skip alone is NOT sufficient to exclude gap time: the sample
 * immediately before a gap is deliberately left non-null by
 * `derivePaceSeriesGapAware`, so its own forward segment (which IS the gap)
 * must be excluded by checking `gapIntervals` directly, which
 * `paceHistogramSamples` now does internally — and returns both the
 * fast-mass fraction and the resolved window width together.
 */
export function adaptiveFastMass(stream) {
  const result = derivePaceWithCoverage(stream);
  const samples = paceHistogramSamples(stream.t, result.paceSeries, result.coverage.gapIntervals);

  let fastWeightedSec = 0;
  let totalWeightedSec = 0;
  for (const sample of samples) {
    totalWeightedSec += sample.timeSec;
    if (sample.paceSecPerKm < FAST_THRESHOLD_SEC_PER_KM) fastWeightedSec += sample.timeSec;
  }

  const fastMass = totalWeightedSec === 0 ? 0 : fastWeightedSec / totalWeightedSec;
  return { fastMass, windowSec: result.windowSec };
}

function formatPct(fraction) {
  return `${(fraction * 100).toFixed(2)}%`;
}

/**
 * Renders the committed `26-RESIDUAL.md` deliverable from a report object
 * (see `buildReport` for its shape) — the new code with no template this
 * codebase already has (26-PATTERNS.md § "No Analog Found").
 */
export function renderResidualMarkdown(report) {
  const {
    generatedAt,
    archiveSize,
    cohortSize,
    residual,
    maxResidualPct,
    criterion1,
  } = report;

  const lines = [];

  lines.push('# Phase 26 PACE-06 Residual Report');
  lines.push('');
  lines.push(
    'The residue the adaptive gap-aware derivation (`src/analytics/pace-derivation.ts`) does ' +
      'not fix, quantified rather than smoothed into plausibility (PACE-06, D-19). This is the ' +
      'committed, regenerable deliverable Phase 27 consumes as pre-flagged input and re-derives ' +
      'at its own boundary — see `npm run compute-pace-residual` below.'
  );
  lines.push('');
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push('');
  lines.push('## Cohort Definition');
  lines.push('');
  lines.push(
    'The severe stair-step cohort: more than 15% of consecutive samples have zero distance ' +
      'advance (`d[i] <= d[i-1]`), AND the stream has at least 50 samples (the 50-sample floor ' +
      'excludes one degenerate near-empty manual-entry stream, `11865310195`, which would ' +
      'otherwise raise the cohort by one).'
  );
  lines.push('');
  lines.push('## Window Formula (D-03: every figure states the window it was measured under)');
  lines.push('');
  lines.push(
    'Every "after" figure below is measured under the adaptive averaging window ' +
      '`max(20, 2.5 x p90(advance intervals))`, resolved per activity from that activity\'s own ' +
      'distance-advance-interval distribution (`adaptiveWindowSec`), with the pace series ' +
      'clipped at gap boundaries and the fast-mass fraction restricted to covered time only.'
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Archive size scanned: ${archiveSize}`);
  lines.push(`- Severe stair-step cohort size: ${cohortSize}`);
  lines.push(`- Residual count (after fast mass > 0.5% of covered time): ${residual.length}`);
  lines.push(`- Max residual: ${maxResidualPct.toFixed(2)}%`);
  lines.push('');
  lines.push('## Residual Activities');
  lines.push('');
  lines.push('| Activity ID | After % (covered time) | Baseline % (unfixed per-sample) | Window (s) | Note |');
  lines.push('|---|---|---|---|---|');
  for (const entry of residual) {
    lines.push(
      `| ${entry.id} | ${entry.afterPct.toFixed(2)}% | ${entry.baselinePct.toFixed(2)}% | ` +
        `${entry.windowSec.toFixed(2)} | ${entry.note || '—'} |`
    );
  }
  lines.push('');
  lines.push('## Criterion 1 Reconciliation');
  lines.push('');
  lines.push(
    'Amended rule (D-19 / 26-RESEARCH.md Pitfall 2): the after-value is strictly lower than that ' +
      'same activity\'s own baseline, OR both are exactly zero — a literal "strictly lower for ' +
      'all" reading is unsatisfiable for any activity whose baseline is already 0.00%.'
  );
  lines.push('');
  lines.push(`- Strictly improved: ${criterion1.strictlyImproved}`);
  lines.push(`- Tied at zero: ${criterion1.tied}`);
  lines.push(`- Regressed: ${criterion1.regressed}`);
  lines.push('');
  if (criterion1.ties.length > 0) {
    lines.push('Ties (baseline and after both exactly 0.00%), named by ID:');
    lines.push('');
    for (const id of criterion1.ties) {
      lines.push(`| ${id} |`);
    }
    lines.push('');
  } else {
    lines.push('No ties found in this run.');
    lines.push('');
  }
  if (criterion1.violations.length > 0) {
    lines.push('**VIOLATIONS — activities failing the amended Criterion 1 rule:**');
    lines.push('');
    lines.push('| Activity ID | Baseline % | After % |');
    lines.push('|---|---|---|');
    for (const violation of criterion1.violations) {
      lines.push(
        `| ${violation.id} | ${violation.baselinePct.toFixed(2)}% | ${violation.afterPct.toFixed(2)}% |`
      );
    }
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  lines.push(
    'Activity `4556693525` appears both as the PACE-04 worked example (the shipped ' +
      'phantom-fast-mode fix) and, if its after-value exceeds 0.5%, in this residual list. That is ' +
      'consistent rather than a measurement error — 26-RESEARCH.md Open Question 2 records that ' +
      'the same activity legitimately holds both roles.'
  );
  lines.push('');
  lines.push('## Regeneration');
  lines.push('');
  lines.push('Regenerate this report against the live committed archive with:');
  lines.push('');
  lines.push('```');
  lines.push(REGENERATE_COMMAND);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

/**
 * Lists the per-activity stream filenames in `dirPath`, excluding
 * `manifest.json` — the stream-availability index, not a per-activity
 * stream (27 G-03: the naive `f.endsWith('.json')` glob previously counted
 * it, reopening 27 G-01's manifest miscount in this script independently).
 * Extracted as its own pure, unit-testable seam so a test can reach the
 * exclusion directly without sweeping and parsing every stream at archive
 * scale (`sweepArchive` itself is not unit-testable that way). Degrades the
 * same way `sweepArchive`'s own try/catch does for an unreadable directory:
 * returns an empty list rather than throwing.
 */
export function listStreamFilenames(dirPath) {
  try {
    return readdirSync(dirPath).filter(isStreamFile);
  } catch (error) {
    console.warn(`Warning: Failed to read stream directory ${dirPath}:`, error.message);
    return [];
  }
}

function sweepArchive() {
  const streams = [];
  const files = listStreamFilenames(STREAMS_DIR);

  for (const file of files) {
    try {
      const content = readFileSync(join(STREAMS_DIR, file), 'utf8');
      const stream = JSON.parse(content);
      streams.push(stream);
    } catch (error) {
      console.warn(`Warning: Failed to read ${file}:`, error.message);
    }
  }

  return streams;
}

function buildReport(streams) {
  const archiveSize = streams.length;
  const cohort = streams.filter(isSevereStairStep);

  const residual = [];
  const ties = [];
  const violations = [];
  let strictlyImproved = 0;
  let tied = 0;
  let regressed = 0;

  for (const stream of cohort) {
    const baselineFraction = baselineFastMass(stream.t, stream.d);
    const { fastMass: afterFraction, windowSec } = adaptiveFastMass(stream);

    if (afterFraction < baselineFraction) {
      strictlyImproved++;
    } else if (afterFraction === 0 && baselineFraction === 0) {
      tied++;
      ties.push(stream.id);
    } else {
      regressed++;
      violations.push({
        id: stream.id,
        baselinePct: baselineFraction * 100,
        afterPct: afterFraction * 100,
      });
    }

    if (afterFraction > RESIDUAL_THRESHOLD_FRACTION) {
      residual.push({
        id: stream.id,
        afterPct: afterFraction * 100,
        baselinePct: baselineFraction * 100,
        windowSec,
        note: stream.id === '4556693525' ? 'Also the PACE-04 worked example' : '',
      });
    }
  }

  residual.sort((a, b) => b.afterPct - a.afterPct);

  const maxResidualPct = residual.length > 0 ? residual[0].afterPct : 0;

  return {
    generatedAt: new Date().toISOString(),
    archiveSize,
    cohortSize: cohort.length,
    residual,
    maxResidualPct,
    criterion1: { strictlyImproved, tied, regressed, ties, violations },
  };
}

function main() {
  console.log('Computing PACE-06 residual report from the committed stream archive...\n');

  const streams = sweepArchive();
  const report = buildReport(streams);

  const markdown = renderResidualMarkdown(report);
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');

  console.log(`Archive size scanned: ${report.archiveSize}`);
  console.log(`Severe stair-step cohort size: ${report.cohortSize}`);
  console.log(`Residual count (after fast mass > 0.5%): ${report.residual.length}`);
  console.log(`Max residual: ${report.maxResidualPct.toFixed(2)}%`);
  console.log(
    `Criterion 1: ${report.criterion1.strictlyImproved} strictly improved, ` +
      `${report.criterion1.tied} tied at zero, ${report.criterion1.regressed} regressed`
  );

  if (report.criterion1.violations.length > 0) {
    console.error('\nCRITERION 1 VIOLATIONS FOUND:');
    for (const violation of report.criterion1.violations) {
      console.error(
        `  ${violation.id}: baseline ${formatPct(violation.baselinePct / 100)} -> ` +
          `after ${formatPct(violation.afterPct / 100)} (not strictly lower, not both zero)`
      );
    }
    process.exitCode = 1;
  } else {
    console.log('\nZero Criterion 1 violations.');
  }

  console.log(`\nWrote ${OUTPUT_PATH}`);
}

// Self-execution guard, mirroring curate-server.mjs / exclusion-cli.mjs: main()
// runs only under direct invocation, so scripts/compute-pace-residual.test.mjs
// can import the pure functions above without triggering the full archive
// sweep and a write to 26-RESIDUAL.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
