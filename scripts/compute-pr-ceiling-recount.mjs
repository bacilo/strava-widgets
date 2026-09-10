/**
 * D-15's classifier-independent recount — the standalone verifier ROADMAP Criterion 5 requires:
 * it opens the SHIPPED `data/stats/best-efforts.json` off disk with `readFileSync` + `JSON.parse`
 * and counts demoted efforts with its OWN arithmetic.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the ceiling module (`dist/analytics/best-effort-ceiling.js` or its `src/` equivalent),
 * the compute step (`dist/analytics/compute-best-efforts.js` / `src/` equivalent), the
 * best-effort utils (`dist/analytics/best-effort-utils.js` / `src/` equivalent), or the
 * best-effort types (`dist/analytics/best-effort.types.js` / `src/` equivalent), by any spelling.
 * The reason: a verifier that pulls in the classifier that produced the numbers it is checking
 * agrees with itself by construction — the exact failure mode D-15 exists to rule out, mirroring
 * D-03's discipline for Phase 27's `compute-pace-quality-recount.mjs`.
 *
 * THE BOUND ON ITS CLAIM: this script verifies that what shipped matches what the diff and the
 * document's own totals claim — nothing more. It does NOT and CANNOT arbitrate whether the
 * ceiling multiplier or the world-record/max-speed guards themselves are right; that question
 * belongs to `compute-pr-ceiling-calibration.mjs` and `28-DIFF.md`, which DO import the ceiling
 * logic because that is their job.
 *
 * Distance keys come from the document itself (`Object.keys(doc.rankings).sort()`), never from
 * `best-effort.types.js`, so this recount shares no vocabulary module with the code it checks.
 *
 * Shape follows `scripts/compute-pace-quality-recount.mjs` (Phase 27, D-03): pure exported
 * functions, a guarded `main()` behind the self-execution check, so
 * `compute-pr-ceiling-recount.test.mjs` can import the counting functions without triggering a
 * real file read as an import-time side effect.
 *
 * Only read target in this task: `data/stats/best-efforts.json`. Writes nothing, ever.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BEST_EFFORTS_PATH = join(__dirname, '../data/stats/best-efforts.json');

/** The closed set of guard values the shared demotion path is known to emit. */
const KNOWN_GUARDS = new Set(['world-record', 'max-speed', 'ceiling']);

/** The pinned regression activity (D-04): its 400m effort is 45.2s / 8.85 m/s. */
const PINNED_ACTIVITY_ID = '4556693525';
const PINNED_DISTANCE = '400m';
const PINNED_DURATION_SEC = 45.2;

/**
 * Reads and parses a shipped JSON document off disk. Never throws an unhandled error — returns
 * a `{ ok: false, reason }` shape on any failure (missing file, malformed JSON) so `main()` can
 * exit non-zero with a named reason instead of an unhandled exception (T-28-08-A).
 */
export function readShippedJson(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    return { ok: false, reason: `could not read ${path}: ${err.message}` };
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `could not parse ${path} as JSON: ${err.message}` };
  }
  return { ok: true, doc };
}

/**
 * The recount's own arithmetic over `data/stats/best-efforts.json`, driven entirely off
 * `activities[*].efforts[*].demotion` — never a read of `totals.effortsDemoted` as an answer.
 * Pure: no I/O, hand-testable on any document shape.
 */
export function recountDemoted(bestEffortsDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};
  const rankings =
    bestEffortsDoc && bestEffortsDoc.rankings && typeof bestEffortsDoc.rankings === 'object'
      ? bestEffortsDoc.rankings
      : {};
  const distances = Object.keys(rankings).sort();

  const byGuard = { 'world-record': 0, 'max-speed': 0, ceiling: 0, unrecognisedGuards: [] };
  const byDistance = {};
  for (const distance of distances) byDistance[distance] = 0;

  let ownDemotedTotal = 0;
  const demotedWithoutReason = [];

  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    for (const effort of efforts) {
      const demotion = effort.demotion;
      if (!demotion || typeof demotion !== 'object' || typeof demotion.guard !== 'string') continue;

      ownDemotedTotal += 1;
      const label = `${activityId}@${effort.distance}`;

      if (KNOWN_GUARDS.has(demotion.guard)) {
        byGuard[demotion.guard] += 1;
      } else {
        byGuard.unrecognisedGuards.push(`${label} (guard=${JSON.stringify(demotion.guard)})`);
      }

      if (byDistance[effort.distance] === undefined) byDistance[effort.distance] = 0;
      byDistance[effort.distance] += 1;

      if (!demotion.reason || typeof demotion.reason !== 'string' || demotion.reason.length === 0) {
        demotedWithoutReason.push(label);
      }
    }
  }

  const rejected = Array.isArray(bestEffortsDoc.rejected) ? bestEffortsDoc.rejected : [];
  const ownRejectedNonErrorRows = rejected.filter(
    (r) => typeof r.reason === 'string' && !r.reason.startsWith('unexpected error:')
  ).length;

  // Cross-check: every ranked row's matching effort at that distance must NOT be demoted. A
  // non-empty list here means a demoted effort is still ranked in the top 10.
  const rankedButDemotedIds = [];
  for (const distance of distances) {
    const rows = Array.isArray(rankings[distance]) ? rankings[distance] : [];
    for (const row of rows) {
      const activity = activities[row.activityId];
      const effort =
        activity && Array.isArray(activity.efforts)
          ? activity.efforts.find((e) => e.distance === distance)
          : undefined;
      if (effort && effort.demotion && typeof effort.demotion === 'object') {
        rankedButDemotedIds.push(`${row.activityId}@${distance}`);
      }
    }
  }

  const totalsEffortsDemoted = bestEffortsDoc.totals ? bestEffortsDoc.totals.effortsDemoted : undefined;
  const disagreesWithTotals = {
    effortsDemotedMismatch: totalsEffortsDemoted !== ownDemotedTotal,
    ownDemotedTotal,
    totalsEffortsDemoted,
    rejectedMismatch: ownRejectedNonErrorRows !== ownDemotedTotal,
    ownRejectedNonErrorRows,
  };

  const pinnedActivity = activities[PINNED_ACTIVITY_ID];
  let pinnedFixture;
  if (!pinnedActivity) {
    pinnedFixture = {
      present: false,
      note: `activity ${PINNED_ACTIVITY_ID} is absent from the shipped document`,
    };
  } else {
    const effort =
      Array.isArray(pinnedActivity.efforts)
        ? pinnedActivity.efforts.find((e) => e.distance === PINNED_DISTANCE)
        : undefined;
    if (!effort) {
      pinnedFixture = {
        present: false,
        note: `activity ${PINNED_ACTIVITY_ID} has no ${PINNED_DISTANCE} effort in the shipped document`,
      };
    } else {
      const guard = effort.demotion && typeof effort.demotion === 'object' ? effort.demotion.guard : null;
      pinnedFixture = {
        present: true,
        durationSec: effort.durationSec,
        guard,
        durationMatches45_2: effort.durationSec === PINNED_DURATION_SEC,
        guardIsCeiling: guard === 'ceiling',
      };
    }
  }

  return {
    ownDemotedTotal,
    byGuard,
    byDistance,
    ownRejectedNonErrorRows,
    rankedButDemotedIds,
    demotedWithoutReason,
    disagreesWithTotals,
    pinnedFixture,
  };
}

/**
 * Assembles the full pass/fail verdict for the combined report, plus an optional
 * `--expect-demoted` pin. Pure — no `process.exit`, no console — so tests can assert on the
 * verdict shape directly. `readErrors` (any unreadable/unparseable input) are always reported as
 * problems regardless of what else could be computed.
 */
export function evaluateReport(report, expectedDemoted) {
  const problems = [];

  for (const err of report.readErrors || []) {
    problems.push(`unreadable input: ${err}`);
  }

  const demoted = report.demoted;
  if (demoted) {
    if (demoted.rankedButDemotedIds.length > 0) {
      problems.push(
        `${demoted.rankedButDemotedIds.length} ranked-but-demoted effort(s) found (a demoted effort is still ranked): ${demoted.rankedButDemotedIds.join(', ')}`
      );
    }
    if (demoted.demotedWithoutReason.length > 0) {
      problems.push(
        `${demoted.demotedWithoutReason.length} demoted effort(s) missing a reason string: ${demoted.demotedWithoutReason.join(', ')}`
      );
    }
    if (demoted.disagreesWithTotals.effortsDemotedMismatch) {
      problems.push(
        `recomputed ownDemotedTotal (${demoted.disagreesWithTotals.ownDemotedTotal}) disagrees with doc.totals.effortsDemoted (${demoted.disagreesWithTotals.totalsEffortsDemoted})`
      );
    }
    if (demoted.disagreesWithTotals.rejectedMismatch) {
      problems.push(
        `ownRejectedNonErrorRows (${demoted.disagreesWithTotals.ownRejectedNonErrorRows}) disagrees with ownDemotedTotal (${demoted.disagreesWithTotals.ownDemotedTotal})`
      );
    }
    if (demoted.byGuard.unrecognisedGuards.length > 0) {
      problems.push(
        `${demoted.byGuard.unrecognisedGuards.length} unrecognised guard value(s) found: ${demoted.byGuard.unrecognisedGuards.join(', ')}`
      );
    }
    if (expectedDemoted !== undefined && demoted.ownDemotedTotal !== expectedDemoted) {
      problems.push(
        `recomputed ownDemotedTotal (${demoted.ownDemotedTotal}) does not equal --expect-demoted ${expectedDemoted}`
      );
    }
  }

  return { pass: problems.length === 0, problems };
}

/**
 * Parses `--expect-demoted <n>`, optional, an integer, returning `undefined` when absent so
 * nothing is hardcoded. Throws on a malformed (non-integer) value, mirroring the analog's
 * `parseExpectFlag`.
 */
export function parseExpectFlags(argv) {
  function parseOne(flagName) {
    const idx = argv.indexOf(flagName);
    if (idx === -1) return undefined;
    const value = argv[idx + 1];
    const parsed = Number(value);
    if (value === undefined || !Number.isInteger(parsed)) {
      throw new Error(`${flagName} requires an integer argument, got ${JSON.stringify(value)}`);
    }
    return parsed;
  }

  return {
    expectDemoted: parseOne('--expect-demoted'),
  };
}

function main() {
  console.log(
    'D-15 independent recount: reading data/stats/best-efforts.json off disk (no ceiling/compute/utils/types import)...\n'
  );

  let expectDemoted;
  try {
    ({ expectDemoted } = parseExpectFlags(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const readErrors = [];

  const bestEffortsRead = readShippedJson(BEST_EFFORTS_PATH);
  if (!bestEffortsRead.ok) readErrors.push(bestEffortsRead.reason);

  const demoted = bestEffortsRead.ok ? recountDemoted(bestEffortsRead.doc) : null;

  const report = { readErrors, demoted };
  const verdict = evaluateReport(report, expectDemoted);

  if (readErrors.length > 0) {
    console.error('FAILED to read one or more shipped documents:');
    for (const err of readErrors) console.error(`  - ${err}`);
  }

  if (demoted) {
    console.log(`Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): ${demoted.ownDemotedTotal}`);
    console.log('  Per-guard breakdown (own arithmetic):');
    console.log(`    world-record: ${demoted.byGuard['world-record']}`);
    console.log(`    max-speed:    ${demoted.byGuard['max-speed']}`);
    console.log(`    ceiling:      ${demoted.byGuard.ceiling}`);
    console.log(`    unrecognised guards: ${demoted.byGuard.unrecognisedGuards.length}`);
    console.log('  Per-distance breakdown (own arithmetic):');
    for (const distance of Object.keys(demoted.byDistance).sort()) {
      console.log(`    ${distance}: ${demoted.byDistance[distance]}`);
    }
    console.log(
      `  Cross-check vs. doc.totals.effortsDemoted: own=${demoted.disagreesWithTotals.ownDemotedTotal} totals=${demoted.disagreesWithTotals.totalsEffortsDemoted} disagrees=${demoted.disagreesWithTotals.effortsDemotedMismatch}`
    );
    console.log(
      `  Cross-check ownRejectedNonErrorRows vs. ownDemotedTotal: rejected=${demoted.disagreesWithTotals.ownRejectedNonErrorRows} demoted=${demoted.disagreesWithTotals.ownDemotedTotal} disagrees=${demoted.disagreesWithTotals.rejectedMismatch}`
    );
    console.log(`  rankedButDemotedIds (${demoted.rankedButDemotedIds.length}): ${demoted.rankedButDemotedIds.join(', ') || '(none)'}`);
    console.log(`  demotedWithoutReason (${demoted.demotedWithoutReason.length}): ${demoted.demotedWithoutReason.join(', ') || '(none)'}`);
    if (demoted.pinnedFixture.present) {
      console.log(
        `  Pinned fixture ${PINNED_ACTIVITY_ID}@${PINNED_DISTANCE}: durationSec=${demoted.pinnedFixture.durationSec} guard=${JSON.stringify(demoted.pinnedFixture.guard)} durationMatches45_2=${demoted.pinnedFixture.durationMatches45_2} guardIsCeiling=${demoted.pinnedFixture.guardIsCeiling}`
      );
    } else {
      console.log(`  Pinned fixture ${PINNED_ACTIVITY_ID}@${PINNED_DISTANCE}: ${demoted.pinnedFixture.note}`);
    }
    if (expectDemoted !== undefined) {
      console.log(`  --expect-demoted ${expectDemoted}: ${demoted.ownDemotedTotal === expectDemoted ? 'MATCH' : 'MISMATCH'}`);
    }
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

// Self-execution guard, mirroring compute-pace-quality-recount.mjs: main() runs only under
// direct invocation, so compute-pr-ceiling-recount.test.mjs can import the pure functions above
// without triggering a real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
