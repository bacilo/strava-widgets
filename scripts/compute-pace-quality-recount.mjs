/**
 * D-03's independent recount — the standalone verifier Phase 27's ROADMAP Criterion 4a
 * requires: it opens the SHIPPED `data/dashboard/index.json` off disk with `readFileSync` +
 * `JSON.parse` and counts severe-tier activities with its OWN arithmetic.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the classifier module (source path `src/analytics/pace-quality.ts`, or its compiled
 * `dist/analytics/` output), by any spelling. The reason: a verifier that pulls in the
 * classifier that produced the numbers it is checking agrees with itself by construction — the
 * exact failure mode D-03 exists to rule out, and the same lesson this project's own history
 * already paid for (three shipped defects that lived behind a green gate; see Phase 23's CR-01).
 *
 * THE BOUND ON ITS CLAIM: this script verifies that what shipped matches what was reported —
 * nothing more. It does NOT and CANNOT arbitrate whether the severity thresholds themselves are
 * right; that question belongs to `27-CALIBRATION.md` and the classifier's own sweep
 * (`scripts/compute-pace-quality-calibration.mjs`), which DOES import the classifier because
 * that is its job. This script's only job is to catch a compute step that silently stopped
 * emitting a field while its own summary flag kept reporting success.
 *
 * Its own arithmetic, not a re-read of the answer: the composite is recomputed from the three
 * tier STRINGS (`quality.decimation.tier`, `quality.gapProfile.tier`,
 * `quality.impossibleSamples.tier`) being exactly `'severe'` on at least one of the three —
 * never by reading `row.quality.anySevere` as the count, which would just be the same
 * circularity in a cheaper form. That recount is then compared, separately, against
 * `row.quality.anySevere` and against `totals.qualityAnySevere` as two independent
 * cross-checks, and any disagreement is reported with the offending activity ids.
 *
 * Shape follows `scripts/compute-pace-residual.mjs`: pure exported functions, a guarded
 * `main()` behind the self-execution check, so `compute-pace-quality-recount.test.mjs` can
 * import the counting function without triggering a real file read as an import-time side
 * effect.
 *
 * Only read target: `data/dashboard/index.json`. Writes nothing, ever.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, '../data/dashboard/index.json');

/** The closed set of tier strings every tiering signal must fall into. */
const VALID_TIERS = new Set(['none', 'minor', 'severe', 'not-computable']);

/** The three signals that tier and therefore contribute to the composite (D-05). */
const TIERING_SIGNAL_KEYS = ['decimation', 'gapProfile', 'impossibleSamples'];

/** The five named sub-objects every row's `quality` field must carry (WR-06/QUAL-01). */
const REQUIRED_QUALITY_SUBKEYS = [
  'decimation',
  'gapProfile',
  'impossibleSamples',
  'deviceEra',
  'elapsedVsMoving',
];

/**
 * Reads and parses the shipped index off disk. Never throws an unhandled error — returns a
 * `{ ok: false, reason }` shape on any failure (missing file, malformed JSON) so `main()` can
 * exit non-zero with a named reason instead of an unhandled exception (T-27-18).
 */
export function readShippedIndex(indexPath = INDEX_PATH) {
  let raw;
  try {
    raw = readFileSync(indexPath, 'utf8');
  } catch (err) {
    return { ok: false, reason: `could not read ${indexPath}: ${err.message}` };
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `could not parse ${indexPath} as JSON: ${err.message}` };
  }
  return { ok: true, doc };
}

/**
 * The recount's own arithmetic, driven entirely off `doc.activities` — no import of the
 * classifier, no read of `row.quality.anySevere` as an answer. Pure: no I/O, hand-testable on
 * any document shape.
 *
 * Returns a report object naming every disagreement found, rather than throwing, so the caller
 * (`main()` or a test) decides what to do with it.
 */
export function recountComposite(doc) {
  const findings = [];

  if (doc.schemaVersion !== 1) {
    findings.push(`schemaVersion is ${JSON.stringify(doc.schemaVersion)}, expected 1`);
  }

  const activities = Array.isArray(doc.activities) ? doc.activities : [];
  const totalRows = activities.length;

  let notComputableCount = 0;
  let ownComposite = 0;
  let anySevereFlagCount = 0;
  const perSignalSevereCounts = { decimation: 0, gapProfile: 0, impossibleSamples: 0 };
  const compositeDisagreementIds = [];
  const missingFieldIds = [];
  const invalidTierIds = [];

  for (const row of activities) {
    const id = row && row.id !== undefined ? row.id : '(missing id)';
    const quality = row ? row.quality : undefined;

    if (!quality || typeof quality !== 'object') {
      missingFieldIds.push(id);
      continue;
    }

    const missingSubkeys = REQUIRED_QUALITY_SUBKEYS.filter((key) => !(key in quality));
    if (missingSubkeys.length > 0) {
      missingFieldIds.push(id);
      continue;
    }

    let rowHasSevere = false;
    let rowHasInvalidTier = false;

    for (const signalKey of TIERING_SIGNAL_KEYS) {
      const tier = quality[signalKey] && quality[signalKey].tier;
      if (!VALID_TIERS.has(tier)) {
        rowHasInvalidTier = true;
        continue;
      }
      if (tier === 'severe') {
        perSignalSevereCounts[signalKey] += 1;
        rowHasSevere = true;
      }
    }

    if (rowHasInvalidTier) {
      invalidTierIds.push(id);
      continue;
    }

    if (quality.notComputableReason !== null && quality.notComputableReason !== undefined) {
      notComputableCount += 1;
    }

    if (rowHasSevere) {
      ownComposite += 1;
    }
    if (quality.anySevere === true) {
      anySevereFlagCount += 1;
    }

    // Cross-check 1: the recount's own verdict for this row vs. the classifier's own
    // `anySevere` flag for the SAME row. Disagreement here is exactly the regression D-03
    // exists to catch — the summary flag surviving while a tier field silently stopped being
    // emitted (or vice versa).
    if (rowHasSevere !== Boolean(quality.anySevere)) {
      compositeDisagreementIds.push(id);
    }
  }

  // Cross-check 2: the recount's own composite vs. the published totals field.
  const totalsComposite = doc.totals ? doc.totals.qualityAnySevere : undefined;
  const disagreesWithTotals = totalsComposite !== ownComposite;

  return {
    totalRows,
    notComputableCount,
    ownComposite,
    anySevereFlagCount,
    perSignalSevereCounts,
    totalsComposite,
    disagreesWithTotals,
    compositeDisagreementIds,
    missingFieldIds,
    invalidTierIds,
    schemaFindings: findings,
  };
}

/**
 * Assembles the full pass/fail verdict for a report produced by `recountComposite`, plus an
 * optional `--expect <n>` pin. Pure — no process.exit, no console — so tests can assert on the
 * verdict shape directly.
 */
export function evaluateReport(report, expected) {
  const problems = [...report.schemaFindings];

  if (report.missingFieldIds.length > 0) {
    problems.push(
      `${report.missingFieldIds.length} row(s) missing "quality" or one of its five named sub-objects: ${report.missingFieldIds.join(', ')}`
    );
  }
  if (report.invalidTierIds.length > 0) {
    problems.push(
      `${report.invalidTierIds.length} row(s) have a tier string outside the closed set (none/minor/severe/not-computable): ${report.invalidTierIds.join(', ')}`
    );
  }
  if (report.disagreesWithTotals) {
    problems.push(
      `recomputed composite (${report.ownComposite}) disagrees with totals.qualityAnySevere (${report.totalsComposite})`
    );
  }
  if (report.compositeDisagreementIds.length > 0) {
    problems.push(
      `${report.compositeDisagreementIds.length} row(s) disagree between the recomputed tier-based verdict and their own "anySevere" flag: ${report.compositeDisagreementIds.join(', ')}`
    );
  }
  if (expected !== undefined && report.ownComposite !== expected) {
    problems.push(`recomputed composite (${report.ownComposite}) does not equal --expect ${expected}`);
  }

  return { pass: problems.length === 0, problems };
}

function parseExpectFlag(argv) {
  const idx = argv.indexOf('--expect');
  if (idx === -1) return undefined;
  const value = argv[idx + 1];
  const parsed = Number(value);
  if (value === undefined || Number.isNaN(parsed)) {
    throw new Error(`--expect requires a numeric argument, got ${JSON.stringify(value)}`);
  }
  return parsed;
}

function main() {
  console.log(
    'D-03 independent recount: reading data/dashboard/index.json off disk (no classifier import)...\n'
  );

  let expected;
  try {
    expected = parseExpectFlag(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const read = readShippedIndex();
  if (!read.ok) {
    console.error(`FAILED: ${read.reason}`);
    process.exitCode = 1;
    return;
  }

  const report = recountComposite(read.doc);
  const verdict = evaluateReport(report, expected);

  const notComputableDenominator = report.totalRows - report.notComputableCount;

  console.log(`Total rows (activity-count denominator): ${report.totalRows}`);
  console.log(
    `Rows with a computable stream (notComputableReason === null): ${notComputableDenominator}`
  );
  console.log(`Not-computable count: ${report.notComputableCount}`);
  console.log(`Per-signal severe counts (own arithmetic, tier === 'severe'):`);
  console.log(`  decimation:        ${report.perSignalSevereCounts.decimation}`);
  console.log(`  gapProfile:        ${report.perSignalSevereCounts.gapProfile}`);
  console.log(`  impossibleSamples: ${report.perSignalSevereCounts.impossibleSamples}`);
  console.log(`Recomputed composite (own arithmetic, union of the three tiers): ${report.ownComposite}`);
  console.log(`  vs. totals.qualityAnySevere:        ${report.totalsComposite}`);
  console.log(`  vs. count of row.quality.anySevere:  ${report.anySevereFlagCount}`);
  if (expected !== undefined) {
    console.log(`--expect ${expected}: ${report.ownComposite === expected ? 'MATCH' : 'MISMATCH'}`);
  }

  if (verdict.pass) {
    console.log('\nPASS: recount agrees with the shipped totals; no disagreements found.');
  } else {
    console.error('\nFAIL:');
    for (const problem of verdict.problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring compute-pace-residual.mjs: main() runs only under direct
// invocation, so compute-pace-quality-recount.test.mjs can import the pure functions above
// without triggering a real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
