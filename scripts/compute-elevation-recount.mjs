/**
 * D-15's independent elevation recount — the standalone verifier that reproduces the elevation
 * cohorts from the SHIPPED `data/dashboard/index.json` alone, with its own arithmetic, never by
 * importing the module that computed them.
 *
 * FORBIDDEN, DELIBERATELY (D-03/D-15, mirroring the Phase 27 recount script's own shape): this
 * file has zero `import`/`require`/dynamic-`import()` statements naming the analytics module
 * that computes these six signals (its source lives under `src/analytics/`, its compiled output
 * under `dist/analytics/`), by any spelling. A verifier that imports the classifier that
 * produced the numbers it is checking agrees with itself by construction — the exact failure
 * mode D-03 exists to rule out. Because it imports nothing from `dist/`, this script never
 * requires `npm run build` first (see its `package.json` line).
 *
 * D-06's second boundary, enforced here as well as in the type system: elevation stays OUTSIDE
 * the pace-trust severity composite the sibling recount reads from `totals.qualityAnySevere` and
 * per-row. This file never reads, recomputes or reports that composite flag, and defines its OWN
 * elevation-only key list — `ELEVATION_MODE_KEYS` below — which is not, and must never become, a
 * tiering-composite key list feeding that flag. A future reader widening a tiering-composite key
 * list to include `'elevation'` (in this file or its Phase 27 sibling) is exactly the quiet
 * reversal D-06 forbids.
 *
 * THE BOUND ON ITS CLAIM: this script verifies that what shipped matches what was reported —
 * nothing more. It does NOT and CANNOT arbitrate whether the elevation thresholds themselves are
 * right; that question belongs to `30-CALIBRATION.md` and its own generating script, which DOES
 * import the classifier because that is its job.
 *
 * Its own arithmetic, not a re-read of the answer: the rolled-up severe count is recomputed as
 * the UNION of the three per-mode booleans (`subGround.flagged`, `closureDrift.state ===
 * 'flagged'`, `verticalRate.flagged`) read straight off each row, with an inclusion-exclusion
 * check printed and cross-checked against the directly-counted union before ever being compared
 * against the shipped `elevation.tier === 'severe'` field. A disagreement between the two is a
 * real defect and exits non-zero naming every offending row.
 *
 * Shape follows the Phase 27 recount script: pure exported functions, a guarded `main()` behind
 * the self-execution check, so `compute-elevation-recount.test.mjs` can import the counting
 * function without triggering a real file read as an import-time side effect.
 *
 * Only read target: `data/dashboard/index.json`. Writes nothing, ever — no `fs` write call in
 * this file resolves anywhere, let alone under `data/`.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, '../data/dashboard/index.json');

/**
 * The closed set of tier strings `elevation.tier` must fall into. Deliberately THREE members,
 * not the four-member tier set the sibling recount uses for its own three signals — elevation
 * has no `'minor'` band (D-07).
 */
const VALID_ELEVATION_TIERS = new Set(['severe', 'none', 'not-computable']);

/**
 * Elevation's own three per-mode evidence keys, read straight off `quality.elevation`. This is
 * NOT a tiering-composite key list — it never feeds the pace-trust severity flag, and no reader
 * may repurpose it as one (see header doc block).
 */
const ELEVATION_MODE_KEYS = ['subGround', 'closureDrift', 'verticalRate'];

/**
 * Reads and parses the shipped index off disk. Never throws an unhandled error — returns a
 * `{ ok: false, reason }` shape on any failure (missing file, malformed JSON), mirroring the
 * Phase 27 recount's own `readShippedIndex` exactly (T-30-31).
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

/** True for a plain object, false for null/arrays/primitives — never throws. */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads one row's `quality.elevation` object, returning `null` (never throwing) when `quality`
 * or `quality.elevation` is absent or malformed. A malformed/absent elevation object counts
 * toward `missingElevationIds`, never toward any per-mode severe count (T-30-31: a malformed row
 * degrades rather than crashing the sweep).
 */
function readElevation(row) {
  if (!isPlainObject(row)) return null;
  const quality = row.quality;
  if (!isPlainObject(quality)) return null;
  const elevation = quality.elevation;
  if (!isPlainObject(elevation)) return null;
  return elevation;
}

/** `subGround.flagged === true`, tolerant of a missing/malformed `subGround` object. */
function subGroundFlagged(elevation) {
  return isPlainObject(elevation.subGround) && elevation.subGround.flagged === true;
}

/** `closureDrift.state === 'flagged'`, tolerant of a missing/malformed `closureDrift` object. */
function closureDriftFlagged(elevation) {
  return isPlainObject(elevation.closureDrift) && elevation.closureDrift.state === 'flagged';
}

/** `closureDrift.state === 'not-computable'` (D-02) — position unknown, drift not tested. */
function closureDriftNotComputable(elevation) {
  return isPlainObject(elevation.closureDrift) && elevation.closureDrift.state === 'not-computable';
}

/** `verticalRate.flagged === true`, tolerant of a missing/malformed `verticalRate` object. */
function verticalRateFlagged(elevation) {
  return isPlainObject(elevation.verticalRate) && elevation.verticalRate.flagged === true;
}

/**
 * The recount's own arithmetic, driven entirely off `doc.activities` — no import of the
 * classifier, no read of `elevation.tier` as an answer for the per-mode counts (only as the
 * cross-check target). Pure: no I/O, hand-testable on any document shape.
 *
 * Never touches the pace-trust severity composite and never defines a tiering-composite key list
 * (D-06's second boundary — see header doc block).
 */
export function recountElevation(doc) {
  const findings = [];

  if (doc.schemaVersion !== 1) {
    findings.push(`schemaVersion is ${JSON.stringify(doc.schemaVersion)}, expected 1`);
  }

  const activities = Array.isArray(doc.activities) ? doc.activities : [];
  const totalRows = activities.length;

  let rowsWithQuality = 0;
  let rowsWithElevation = 0;
  const missingElevationIds = [];
  const invalidTierIds = [];

  let subGroundCount = 0;
  let closureDriftCount = 0;
  let verticalRateCount = 0;
  let closureDriftNotComputableCount = 0;
  let elevationTierNotComputableCount = 0;
  let recountedSevereCount = 0;
  let shippedSevereCount = 0;

  let subDriftOverlap = 0;
  let subRateOverlap = 0;
  let driftRateOverlap = 0;
  let allThreeOverlap = 0;

  const tierDisagreementIds = [];
  const deviceFamilyBreakdown = {};

  for (const row of activities) {
    const id = row && row.id !== undefined ? row.id : '(missing id)';
    const quality = isPlainObject(row) ? row.quality : undefined;

    if (isPlainObject(quality)) {
      rowsWithQuality += 1;
    }

    const elevation = readElevation(row);
    if (elevation === null) {
      missingElevationIds.push(id);
      continue;
    }
    rowsWithElevation += 1;

    if (!VALID_ELEVATION_TIERS.has(elevation.tier)) {
      invalidTierIds.push(id);
      continue;
    }
    if (elevation.tier === 'not-computable') {
      elevationTierNotComputableCount += 1;
    }

    const sub = subGroundFlagged(elevation);
    const drift = closureDriftFlagged(elevation);
    const rate = verticalRateFlagged(elevation);
    // D-02's cohort is "position unknown, drift not tested" for a row whose OTHER two modes are
    // still computed — distinct from the whole-signal not-computable (stream-less) cohort
    // counted separately in elevationTierNotComputableCount, so it is excluded here (D-04's own
    // "these count different things" rule).
    if (closureDriftNotComputable(elevation) && elevation.tier !== 'not-computable') {
      closureDriftNotComputableCount += 1;
    }

    if (sub) subGroundCount += 1;
    if (drift) closureDriftCount += 1;
    if (rate) verticalRateCount += 1;
    if (sub && drift) subDriftOverlap += 1;
    if (sub && rate) subRateOverlap += 1;
    if (drift && rate) driftRateOverlap += 1;
    if (sub && drift && rate) allThreeOverlap += 1;

    const recountedSevere = sub || drift || rate;
    if (recountedSevere) recountedSevereCount += 1;

    const shippedSevere = elevation.tier === 'severe';
    if (shippedSevere) shippedSevereCount += 1;

    // The real defect this recount exists to catch: the three per-mode booleans disagree with
    // the shipped rolled-up tier for the SAME row (T-30-30's own regression signature).
    if (recountedSevere !== shippedSevere) {
      tierDisagreementIds.push({ id, recountedSevere, shippedSevere });
    }

    if (recountedSevere) {
      // Device-family breakdown of the severe set (from quality.deviceEra.family), with an
      // explicit no-device-name category — never throws on a malformed deviceEra.
      const deviceEra = isPlainObject(quality) ? quality.deviceEra : undefined;
      const family =
        isPlainObject(deviceEra) && typeof deviceEra.family === 'string'
          ? deviceEra.family
          : 'no-device-name';
      deviceFamilyBreakdown[family] = (deviceFamilyBreakdown[family] ?? 0) + 1;
    }
  }

  // Inclusion-exclusion cross-check: |A|+|B|+|C| - |A∩B| - |A∩C| - |B∩C| + |A∩B∩C| must equal
  // the directly-counted union (recountedSevereCount). A mismatch means this function's own
  // bookkeeping is broken, not the archive.
  const inclusionExclusionUnion =
    subGroundCount +
    closureDriftCount +
    verticalRateCount -
    subDriftOverlap -
    subRateOverlap -
    driftRateOverlap +
    allThreeOverlap;
  const inclusionExclusionMatches = inclusionExclusionUnion === recountedSevereCount;

  return {
    totalRows,
    rowsWithQuality,
    rowsWithElevation,
    missingElevationIds,
    invalidTierIds,
    subGroundCount,
    closureDriftCount,
    verticalRateCount,
    closureDriftNotComputableCount,
    elevationTierNotComputableCount,
    recountedSevereCount,
    shippedSevereCount,
    overlaps: {
      subDrift: subDriftOverlap,
      subRate: subRateOverlap,
      driftRate: driftRateOverlap,
      allThree: allThreeOverlap,
    },
    inclusionExclusionUnion,
    inclusionExclusionMatches,
    tierDisagreementIds,
    deviceFamilyBreakdown,
    schemaFindings: findings,
  };
}

/**
 * Assembles the full pass/fail verdict for a report produced by `recountElevation`, plus an
 * optional `--expect <n>` pin against the recounted union. Pure — no process.exit, no console —
 * so tests can assert on the verdict shape directly.
 */
export function evaluateReport(report, expected) {
  const problems = [...report.schemaFindings];

  if (report.invalidTierIds.length > 0) {
    problems.push(
      `${report.invalidTierIds.length} row(s) have an elevation.tier outside the closed set (severe/none/not-computable): ${report.invalidTierIds.join(', ')}`
    );
  }
  if (!report.inclusionExclusionMatches) {
    problems.push(
      `inclusion-exclusion union (${report.inclusionExclusionUnion}) disagrees with the directly-counted union (${report.recountedSevereCount})`
    );
  }
  if (report.tierDisagreementIds.length > 0) {
    problems.push(
      `${report.tierDisagreementIds.length} row(s) disagree between the recounted per-mode union and the shipped elevation.tier: ${report.tierDisagreementIds
        .map((d) => `${d.id} (recounted=${d.recountedSevere}, shipped=${d.shippedSevere})`)
        .join(', ')}`
    );
  }
  if (expected !== undefined && report.recountedSevereCount !== expected) {
    problems.push(
      `recounted union (${report.recountedSevereCount}) does not equal --expect ${expected}`
    );
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

/** Optional override of the index path, used by the demonstrated-failing fixture run. */
function parseIndexPathFlag(argv) {
  const idx = argv.indexOf('--index-path');
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function formatPct(numerator, denominator) {
  if (denominator === 0) return `${numerator} of 0 (n/a)`;
  return `${numerator} of ${denominator} (${((numerator / denominator) * 100).toFixed(1)}%)`;
}

function main() {
  console.log(
    'D-15 independent elevation recount: reading data/dashboard/index.json off disk (no classifier import)...\n'
  );

  let expected;
  let indexPathOverride;
  try {
    expected = parseExpectFlag(process.argv.slice(2));
    indexPathOverride = parseIndexPathFlag(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const read = readShippedIndex(indexPathOverride);
  if (!read.ok) {
    console.error(`FAILED: ${read.reason}`);
    process.exitCode = 1;
    return;
  }

  const report = recountElevation(read.doc);
  const verdict = evaluateReport(report, expected);

  console.log(`Total rows: ${report.totalRows}`);
  console.log(`Rows carrying a "quality" object: ${formatPct(report.rowsWithQuality, report.totalRows)}`);
  console.log(
    `Rows carrying "quality.elevation": ${formatPct(report.rowsWithElevation, report.totalRows)}`
  );
  console.log('');
  console.log("Per-mode flagged counts (own arithmetic, read from each row's per-mode fields):");
  console.log(`  subGround.flagged:              ${formatPct(report.subGroundCount, report.rowsWithElevation)}`);
  console.log(`  closureDrift.state==='flagged': ${formatPct(report.closureDriftCount, report.rowsWithElevation)}`);
  console.log(`  verticalRate.flagged:           ${formatPct(report.verticalRateCount, report.rowsWithElevation)}`);
  console.log('');
  console.log('Overlaps:');
  console.log(`  subGround ∩ closureDrift: ${report.overlaps.subDrift}`);
  console.log(`  subGround ∩ verticalRate: ${report.overlaps.subRate}`);
  console.log(`  closureDrift ∩ verticalRate: ${report.overlaps.driftRate}`);
  console.log(`  all three: ${report.overlaps.allThree}`);
  console.log(
    `  inclusion-exclusion check: ${report.subGroundCount} + ${report.closureDriftCount} + ${report.verticalRateCount} - ${report.overlaps.subDrift} - ${report.overlaps.subRate} - ${report.overlaps.driftRate} + ${report.overlaps.allThree} = ${report.inclusionExclusionUnion} vs. direct union ${report.recountedSevereCount}: ${report.inclusionExclusionMatches ? 'MATCH' : 'MISMATCH'}`
  );
  console.log('');
  console.log(
    `Recounted union (own arithmetic, subGround OR closureDrift OR verticalRate): ${report.recountedSevereCount}`
  );
  console.log(`  vs. shipped elevation.tier === 'severe' count: ${report.shippedSevereCount}`);
  console.log('');
  console.log(
    `closureDrift not-computable (position unknown, D-02 — among elevation-computable rows): ${formatPct(report.closureDriftNotComputableCount, report.rowsWithElevation - report.elevationTierNotComputableCount)}`
  );
  console.log(
    `elevation.tier not-computable (whole-signal, stream-less cohort): ${formatPct(report.elevationTierNotComputableCount, report.totalRows)}`
  );
  console.log('');
  console.log('Device-family breakdown of the recounted severe set:');
  const families = Object.keys(report.deviceFamilyBreakdown).sort(
    (a, b) => report.deviceFamilyBreakdown[b] - report.deviceFamilyBreakdown[a]
  );
  if (families.length === 0) {
    console.log('  (no severe rows)');
  }
  for (const family of families) {
    console.log(`  ${family}: ${report.deviceFamilyBreakdown[family]}`);
  }
  if (expected !== undefined) {
    console.log('');
    console.log(
      `--expect ${expected}: ${report.recountedSevereCount === expected ? 'MATCH' : 'MISMATCH'}`
    );
  }

  if (verdict.pass) {
    console.log('\nPASS: recount agrees with the shipped elevation tiers; no disagreements found.');
  } else {
    console.error('\nFAIL:');
    for (const problem of verdict.problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring the Phase 27 recount script: main() runs only under direct
// invocation, so compute-elevation-recount.test.mjs can import the pure functions above without
// triggering a real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
