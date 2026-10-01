/**
 * Phase 36 PR-09 — the archive-wide before/after clean-window diff the
 * developer signs (ROADMAP criterion 4, D-09's companion artifact).
 *
 * `36-CEILING-RECALIBRATION.md` (plan 36-10) records HOW every per-distance
 * ceiling moved. This script and its artifact
 * (`.planning/phases/36-.../36-DIFF.md`) record the much larger, per-EFFORT
 * change: every rank change, every newly demoted effort, every reinstated
 * effort (both kinds — see below), every moved-but-still-ranked effort, and
 * the same ceiling table cross-checked against 36-10's own artifact.
 *
 * ONE SHARED OLD-STATE RULE: `reconstructOldEfforts` and `buildPopulations`
 * are IMPORTED from `./compute-ceiling-recalibration.mjs`, never
 * reimplemented here. This phase has exactly one definition of "what did the
 * archive look like before Phase 36's clean-window search" — a second copy
 * inside this file would be free to drift from the artifact plan 36-10
 * already signs, producing two documents that quietly disagree about the
 * same pre-phase state. This file defines no reconstruction of its own; the
 * only reconstruction identifier appearing below is the imported one.
 *
 * FOUR POPULATIONS (36-CONTEXT.md's own definitions, restated so a reader
 * can audit which one fired): MOVED-BUT-RANKED (`contaminated != null` and
 * the effort ranks both before and after), NEWLY DEMOTED (ranked before, not
 * ranked after), REINSTATED (not ranked before, ranked after — split further
 * below), UNCHANGED (neither). A record falls into exactly one kind,
 * resolved by priority (REINSTATED first) rather than left ambiguous: 31
 * real activity/distance pairs (36-RESEARCH.md D-08) are BOTH "ranked on a
 * moved clean figure" and "not ranked before" at once — today's absolute
 * guards (`world-record`/`max-speed`) evaluate the single unconstrained
 * sweep result, so an effort whose RAW window fails an absolute guard but
 * which has a clean sub-interval is reinstated by this phase, not merely
 * moved. REINSTATED is checked first so these 31 pairs land there, where
 * 36-RESEARCH.md's own finding says they belong, not in MOVED-BUT-RANKED.
 * The genuinely ambiguous, fail-closed case this file guards against is a
 * malformed or duplicated OLD reconstruction — two OLD records claiming the
 * same activity/distance pair — which is rejected outright rather than
 * silently resolved by picking the first match.
 *
 * PR-09 LEG 2 (the internal reconciliation): `walkGuardCounts` is a plain
 * walk over the shipped document's own guard values, independent of the
 * classification above. `reconcileCounts` compares the two halves and NEVER
 * throws on a mismatch — a mismatch is exactly the finding this
 * reconciliation exists to surface, and the 31 reinstated-with-contamination
 * pairs above are expected to produce exactly this kind of reported,
 * non-silent gap between "how many moved-but-ranked records this diff
 * lists" and "how many contaminated efforts the shipped document itself
 * carries" (the latter also counts the 31 reinstated ones, which the former
 * deliberately excludes).
 *
 * PROVENANCE RULE (mirrors `compute-ceiling-recalibration.mjs` exactly): the
 * artifact's `**Generated:**` line is a wall-clock `new Date().toISOString()`
 * plus each durable input's own `generatedAt` — NEVER the current commit's
 * own identifying hash (queried via the version-control CLI) and NEVER a
 * hash of any source file. Neither a version-control-hash query nor Node's
 * hashing module is imported anywhere below.
 *
 * MUTATION SAFETY: `main()` runs the real `computeBestEfforts` exactly once,
 * against a throwaway `statsDir` AND a throwaway ceiling-state path (both
 * under `os.tmpdir()`, removed in a `finally`) — generating this report can
 * never rewrite `data/stats/best-efforts.json` or the committed
 * `data/best-effort-ceiling.json`. The ceiling-state write-gate's own opt-in
 * flag (36-07) is never passed here; this generator only ever READS
 * `36-CEILING-RECALIBRATION.md` for its cross-check, never writes it.
 *
 * Only write target: this script's own OUTPUT_PATH.
 *
 * T-36-67 (mitigate): an activity id or a reason string is only ever
 * rendered into a markdown table cell through `safeActivityId`/`safeCell`.
 *
 * Structure mirrors `compute-pr-ceiling-diff.mjs` and
 * `compute-ceiling-recalibration.mjs`: pure exported functions with zero
 * file I/O, plus one `main()` gated behind the standard self-execution guard
 * so `compute-clean-window-diff.test.mjs` can import every pure function
 * without triggering an archive sweep or a write as an import-time side
 * effect.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { computeBestEfforts } from '../dist/analytics/compute-best-efforts.js';
import { TARGET_METERS, TARGET_ORDER } from '../dist/analytics/best-effort.types.js';
import { markPRs, rankTopN, TOP_N } from '../dist/analytics/best-effort-utils.js';
import { deriveCeilings } from '../dist/analytics/best-effort-ceiling.js';

// The ONE shared definition of the pre-Phase-36 reconstruction rule —
// imported, never reimplemented. See this file's own top docblock.
import { buildPopulations, reconstructOldEfforts } from './compute-ceiling-recalibration.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md'
);
const RECALIBRATION_ARTIFACT_PATH = join(
  ROOT_DIR,
  '.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-CEILING-RECALIBRATION.md'
);
const RECALIBRATION_ARTIFACT_RELATIVE_PATH =
  '.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-CEILING-RECALIBRATION.md';

const REGENERATE_COMMAND = 'npm run compute-clean-window-diff';
const RECOUNT_SCRIPT = 'scripts/compute-clean-window-recount.mjs';

/** T-36-67: an activity id is only ever emitted after matching this shape. */
const VALID_ACTIVITY_ID = /^i?\d{1,20}$/;

/**
 * D-07-style render cap on the "Moved But Still Ranked" table — the probe
 * measured roughly 1,200 such pairs, far too many to render unbounded. The
 * FULL count is always stated above the table regardless of the cap, so a
 * capped table can never understate the population (T-36-66).
 */
const MOVED_BUT_RANKED_RENDER_CAP = 50;

/**
 * 36-CONTEXT.md's own "Archive-wide, per-distance ceiling recalibration"
 * probe table, quoted verbatim (the same reference `compute-ceiling-
 * recalibration.mjs` quotes) — a reference to reconcile against, never a
 * pinned expected value (ROADMAP criterion 1).
 */
const CONTEXT_PROBE_CEILING_TABLE = {
  '400m': { populationBefore: 1834, populationAfter: 1858, ceilingBefore: 5.1108, ceilingAfter: 5.0297 },
  '1k': { populationBefore: 1852, populationAfter: 1854, ceilingBefore: 4.7497, ceilingAfter: 4.7106 },
  '1mi': { populationBefore: 1851, populationAfter: 1848, ceilingBefore: 4.6282, ceilingAfter: 4.5977 },
  '5k': { populationBefore: 1788, populationAfter: 1726, ceilingBefore: 4.3453, ceilingAfter: 4.3384 },
  '10k': { populationBefore: 1468, populationAfter: 1147, ceilingBefore: 4.2204, ceilingAfter: 4.2522 },
  half: { populationBefore: 104, populationAfter: 69, ceilingBefore: 4.4017, ceilingAfter: null },
  marathon: { populationBefore: 0, populationAfter: 0, ceilingBefore: null, ceilingAfter: null },
};

/**
 * 36-CONTEXT.md's own "Effort-distance pairs" probe census — a reference to
 * reconcile against, never a pinned expected value.
 */
const CONTEXT_PROBE_CENSUS = { moved: 1200, unchanged: 7352, noCleanWindow: 439 };

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O (the guard test's contract)
// ---------------------------------------------------------------------------

/** T-36-67: renders an activity id only after validating its shape. */
function safeActivityId(activityId) {
  if (typeof activityId === 'string' && VALID_ACTIVITY_ID.test(activityId)) return activityId;
  return '(malformed id)';
}

/** T-36-67: strips characters that would break a markdown table cell or inject a link. */
function safeCell(value) {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/[\n\r|]/g, ' ').trim();
}

/** `n` m/s formatted to four decimals, or an em dash for `null`/`undefined`. */
function fmtMps(mps) {
  return mps === null || mps === undefined ? '—' : mps.toFixed(4);
}

/** `n` seconds formatted to one decimal, or an em dash for `null`/`undefined`. */
function fmtSec(sec) {
  return sec === null || sec === undefined ? '—' : sec.toFixed(1);
}

function paceSecPerKmFromDuration(durationSec, distance) {
  const meters = TARGET_METERS[distance];
  if (!meters || !(durationSec > 0)) return null;
  return durationSec / (meters / 1000);
}

/**
 * Classifies every activity/distance pair the NEW document carries into
 * exactly one of the four populations 36-CONTEXT.md defines, using the
 * priority rule stated in this file's top docblock (REINSTATED checked
 * first, which is what makes the 31 real reinstated-with-contamination pairs
 * land in exactly one bucket rather than tripping the fail-closed check).
 *
 * FAILS CLOSED on a genuinely ambiguous input: if `oldEfforts` carries two
 * records for the same activity/distance key, this throws rather than
 * silently picking one — `reconstructOldEfforts` is documented to emit at
 * most one record per effort, so a duplicate is a broken reconstruction, not
 * a legitimate OLD state. Likewise throws if a NEW effort has no OLD
 * reconstruction at all (every NEW effort must have exactly one OLD
 * counterpart).
 */
export function classifyEffortChanges(newDoc, oldEfforts) {
  const oldByKey = new Map();
  for (const old of oldEfforts) {
    const key = `${old.activityId}|${old.distance}`;
    if (oldByKey.has(key)) {
      throw new Error(
        `classifyEffortChanges: duplicate OLD record for ${key} — refusing to silently pick one ` +
          `(fail closed); a pair must fall into exactly one kind, and two OLD records for the same ` +
          `activity/distance pair means reconstructOldEfforts produced an ambiguous reconstruction.`
      );
    }
    oldByKey.set(key, old);
  }

  const changes = [];
  const activities = newDoc?.activities ?? {};

  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    if (!activity) continue;

    for (const effort of activity.efforts ?? []) {
      if (!effort) continue;
      const distance = effort.distance;
      const key = `${activityId}|${distance}`;
      const old = oldByKey.get(key);
      if (!old) {
        throw new Error(
          `classifyEffortChanges: no OLD reconstruction found for ${key} — reconstructOldEfforts must ` +
            `cover every effort the NEW document carries.`
        );
      }

      const oldGuard = old.demotion ? old.demotion.guard : null;
      const oldReason = old.demotion ? old.demotion.reason : null;
      const newGuard = effort.demotion ? effort.demotion.guard : null;
      const newReason = effort.demotion ? effort.demotion.reason : null;
      const contaminated = effort.contaminated ?? null;

      let kind;
      if (oldGuard !== null && newGuard === null) {
        kind = 'reinstated';
      } else if (oldGuard === null && newGuard === null && contaminated != null) {
        kind = 'moved-but-ranked';
      } else if (oldGuard === null && newGuard !== null) {
        kind = 'newly-demoted';
      } else {
        kind = 'unchanged';
      }

      changes.push({
        activityId,
        distance,
        oldDurationSec: old.durationSec,
        newDurationSec: effort.durationSec,
        oldPaceSecPerKm: paceSecPerKmFromDuration(old.durationSec, distance),
        newPaceSecPerKm: effort.paceSecPerKm,
        oldGuard,
        oldReason,
        newGuard,
        newReason,
        contaminatedReason: contaminated ? contaminated.reason : null,
        kind,
      });
    }
  }

  return changes;
}

/**
 * Partitions the `'reinstated'` records by their OLD guard — the two kinds
 * 36-RESEARCH.md D-08 found: `'world-record'`/`'max-speed'` (an absolute
 * guard reinstatement — 31 real pairs measured this session, since today's
 * single unconstrained sweep result is what `isPlausible` currently
 * evaluates, so this population is a direct consequence of the phase rather
 * than a ceiling side effect) and `'ceiling'` (a ceiling reinstatement). Each
 * retains its OLD guard name so the artifact states WHICH guard had demoted
 * the effort before this phase.
 */
export function splitReinstatements(changes) {
  const reinstated = changes.filter((c) => c.kind === 'reinstated');
  const absoluteGuard = reinstated.filter((c) => c.oldGuard === 'world-record' || c.oldGuard === 'max-speed');
  const ceiling = reinstated.filter((c) => c.oldGuard === 'ceiling');
  return { absoluteGuard, ceiling };
}

/**
 * Per distance, reconstructs the OLD top-10 ranking by feeding the OLD
 * population (ranked efforts only — `demotion === null`, never excluded)
 * through the SAME pure `markPRs`/`rankTopN` the shipped pipeline uses
 * (never a second ranking implementation), then compares it POSITION BY
 * POSITION against the NEW document's own `rankings[distance]`. A row is
 * emitted for every rank position whose activity id or duration differs
 * between the two sides, including a position that exists on only one side
 * (an effort that entered or fell out of the top `TOP_N`).
 */
export function buildRankChanges(newDoc, oldEfforts) {
  const activities = newDoc?.activities ?? {};
  const result = {};

  for (const distance of TARGET_ORDER) {
    const oldPopulation = [];
    for (const old of oldEfforts) {
      if (old.distance !== distance) continue;
      if (old.excludedFromRecords) continue;
      if (old.demotion !== null) continue;
      const activity = activities[old.activityId];
      if (!activity) continue;
      oldPopulation.push({
        activityId: old.activityId,
        startDate: activity.startDate,
        durationSec: old.durationSec,
      });
    }

    // markPRs is called for parity with the shipped pipeline's own dual
    // derivation (compute-pr-ceiling-diff.mjs's reconstructOldDocument calls
    // it alongside rankTopN from the same population) — this diff renders no
    // PR-flag section, so wasPRAtTheTime is unused beyond this call, but the
    // OLD ranking is reached through the identical pure function the shipped
    // pipeline uses, never a second implementation.
    const prMarked = markPRs(oldPopulation);
    const oldRanking = rankTopN(prMarked, TOP_N);
    const newRanking = (newDoc?.rankings?.[distance] ?? []).map((entry) => ({ ...entry }));

    const rows = [];
    const maxLen = Math.max(oldRanking.length, newRanking.length);
    for (let i = 0; i < maxLen; i++) {
      const oldEntry = oldRanking[i] ?? null;
      const newEntry = newRanking[i] ?? null;
      const changed =
        (oldEntry?.activityId ?? null) !== (newEntry?.activityId ?? null) ||
        (oldEntry?.durationSec ?? null) !== (newEntry?.durationSec ?? null);
      if (!changed) continue;

      rows.push({
        rank: i + 1,
        oldActivityId: oldEntry?.activityId ?? null,
        newActivityId: newEntry?.activityId ?? null,
        oldDurationSec: oldEntry?.durationSec ?? null,
        newDurationSec: newEntry?.durationSec ?? null,
      });
    }

    result[distance] = rows;
  }

  return result;
}

/**
 * PR-09's leg 2: a plain walk over the shipped document, counting (per
 * distance and in total) efforts by NEW guard — all four `EffortDemotionGuard`
 * values plus an `other` bucket for anything unrecognised — and efforts
 * whose `contaminated` field is non-null. This mirrors
 * `compute-best-efforts.ts:450-462`'s own walk-the-document `effortsDemoted`
 * count: a counter derived by re-reading the output, never threaded through
 * the computation pipeline itself.
 */
export function walkGuardCounts(newDoc) {
  const guardKeys = ['world-record', 'max-speed', 'ceiling', 'unreliable-segment'];
  const makeBucket = () => {
    const bucket = { other: 0, contaminated: 0 };
    for (const g of guardKeys) bucket[g] = 0;
    return bucket;
  };

  const perDistance = {};
  for (const distance of TARGET_ORDER) perDistance[distance] = makeBucket();
  const totals = makeBucket();

  const activities = newDoc?.activities ?? {};
  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    if (!activity) continue;

    for (const effort of activity.efforts ?? []) {
      if (!effort) continue;
      const bucket = perDistance[effort.distance];
      if (!bucket) continue;

      if (effort.demotion) {
        const guard = guardKeys.includes(effort.demotion.guard) ? effort.demotion.guard : 'other';
        bucket[guard]++;
        totals[guard]++;
      }
      if (effort.contaminated != null) {
        bucket.contaminated++;
        totals.contaminated++;
      }
    }
  }

  return { perDistance, totals };
}

/**
 * PR-09's internal cross-check: the diff's own classified lists against the
 * walked guard counts, two independent derivations of the same shipped
 * document. NEVER throws on a mismatch — a mismatch is exactly the finding
 * this reconciliation exists to surface, since the diff's lists and the
 * walked counts answer subtly different questions (see this file's top
 * docblock: the 31 reinstated-with-contamination pairs are counted once by
 * the walk, under `contaminated`, but classified as `'reinstated'` rather
 * than `'moved-but-ranked'` by the list above).
 */
export function reconcileCounts(changes, guardCounts) {
  const newlyDemotedUnreliableSegment = changes.filter(
    (c) => c.kind === 'newly-demoted' && c.newGuard === 'unreliable-segment'
  ).length;
  const walkedUnreliableSegment = guardCounts.totals['unreliable-segment'];

  const movedButRanked = changes.filter((c) => c.kind === 'moved-but-ranked').length;
  const walkedContaminated = guardCounts.totals.contaminated;

  return [
    {
      check: "'newly-demoted' (unreliable-segment) vs the walked unreliable-segment demotion count",
      listsFigure: newlyDemotedUnreliableSegment,
      walkedFigure: walkedUnreliableSegment,
      agrees: newlyDemotedUnreliableSegment === walkedUnreliableSegment,
    },
    {
      check: "'moved-but-ranked' record count vs the walked contaminated-effort count",
      listsFigure: movedButRanked,
      walkedFigure: walkedContaminated,
      agrees: movedButRanked === walkedContaminated,
    },
  ];
}

/** Per distance, the before/after ceiling figures the artifact's own table renders. */
export function buildCeilingTable(newCeilings, oldCeilings) {
  return TARGET_ORDER.map((distance) => {
    const oldC = oldCeilings[distance];
    const newC = newCeilings[distance];
    return {
      distance,
      oldCeilingMps: oldC?.ceilingMps ?? null,
      newCeilingMps: newC?.ceilingMps ?? null,
      oldP90Mps: oldC?.p90Mps ?? null,
      newP90Mps: newC?.p90Mps ?? null,
      oldPopulationN: oldC?.populationN ?? null,
      newPopulationN: newC?.populationN ?? null,
      failOpenReason: newC?.failOpenReason ?? null,
    };
  });
}

/** Extracts the value on a `**Generated:** <value>` line, or `null` if none is found. */
function extractGeneratedLine(markdownText) {
  const match = typeof markdownText === 'string' ? markdownText.match(/\*\*Generated:\*\*\s*(.+)/) : null;
  return match ? match[1].trim() : null;
}

/**
 * Parses `36-CEILING-RECALIBRATION.md`'s own `## Headline` table — the ONE
 * place this script reads another artifact's figures rather than deriving
 * its own — into `{ [distance]: { ceilingMpsBefore, ceilingMpsAfter } }`.
 * Returns `{}` for text that carries no recognisable `## Headline` table
 * rather than throwing, so a malformed or missing artifact degrades into
 * "cross-check unavailable" rather than crashing the whole diff.
 */
function parseRecalibrationHeadline(markdownText) {
  if (typeof markdownText !== 'string') return {};
  const headlineStart = markdownText.indexOf('## Headline');
  if (headlineStart === -1) return {};
  const nextSectionStart = markdownText.indexOf('\n## ', headlineStart + 1);
  const section = markdownText.slice(headlineStart, nextSectionStart === -1 ? undefined : nextSectionStart);

  const result = {};
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.startsWith('|---') || trimmed.startsWith('| Distance')) continue;
    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 3) continue;
    const [distance, beforeStr, afterStr] = cells;
    result[distance] = {
      ceilingMpsBefore: beforeStr === '—' ? null : Number.parseFloat(beforeStr),
      ceilingMpsAfter: afterStr === '—' ? null : Number.parseFloat(afterStr),
    };
  }
  return result;
}

/**
 * Cross-checks this run's own `ceilingTable` against
 * `36-CEILING-RECALIBRATION.md`'s figures, row by row, comparing at the same
 * 4-decimal precision both artifacts render at (string comparison after
 * formatting, so trailing floating-point noise below the rendered precision
 * never manufactures a false disagreement). `available: false` when no
 * recalibration text was supplied at all (distinct from `available: true`
 * with every row agreeing).
 */
export function crossCheckCeilingAgainstRecalibration(ceilingTable, recalibrationText) {
  if (!recalibrationText) {
    return { available: false, rows: [] };
  }

  const parsed = parseRecalibrationHeadline(recalibrationText);
  const rows = ceilingTable.map((row) => {
    const ref = parsed[row.distance];
    if (!ref) {
      return {
        distance: row.distance,
        measuredBefore: row.oldCeilingMps,
        measuredAfter: row.newCeilingMps,
        recalibrationBefore: null,
        recalibrationAfter: null,
        agrees: false,
      };
    }
    const agrees =
      fmtMps(row.oldCeilingMps) === fmtMps(ref.ceilingMpsBefore) &&
      fmtMps(row.newCeilingMps) === fmtMps(ref.ceilingMpsAfter);
    return {
      distance: row.distance,
      measuredBefore: row.oldCeilingMps,
      measuredAfter: row.newCeilingMps,
      recalibrationBefore: ref.ceilingMpsBefore,
      recalibrationAfter: ref.ceilingMpsAfter,
      agrees,
    };
  });

  return { available: true, rows };
}

/**
 * Addresses every row of 36-CONTEXT.md's two probe tables (the per-distance
 * ceiling recalibration table and the archive-wide moved/unchanged/no-clean
 * census), stating the measured difference for each — "drift is reported,
 * never silently absorbed" (ROADMAP criterion 1).
 */
export function reconcileAgainstProbe(changes, guardCounts, ceilingTable) {
  const rows = [];

  for (const row of ceilingTable) {
    const probe = CONTEXT_PROBE_CEILING_TABLE[row.distance];
    rows.push({
      label: `${row.distance} ceiling before/after`,
      measured: `${fmtMps(row.oldCeilingMps)} / ${fmtMps(row.newCeilingMps)}`,
      probe: `${fmtMps(probe.ceilingBefore)} / ${fmtMps(probe.ceilingAfter)}`,
    });
    rows.push({
      label: `${row.distance} population before/after`,
      measured: `${row.oldPopulationN ?? '—'} / ${row.newPopulationN ?? '—'}`,
      probe: `${probe.populationBefore} / ${probe.populationAfter}`,
    });
  }

  const movedCount = changes.filter((c) => c.kind === 'moved-but-ranked').length;
  const unchangedCount = changes.filter((c) => c.kind === 'unchanged').length;
  const noCleanWindowCount = guardCounts.totals['unreliable-segment'];

  rows.push({ label: 'archive-wide moved (moved-but-ranked)', measured: movedCount, probe: CONTEXT_PROBE_CENSUS.moved });
  rows.push({ label: 'archive-wide unchanged', measured: unchangedCount, probe: CONTEXT_PROBE_CENSUS.unchanged });
  rows.push({
    label: 'archive-wide no-clean-window (unreliable-segment demotions)',
    measured: noCleanWindowCount,
    probe: CONTEXT_PROBE_CENSUS.noCleanWindow,
  });

  return rows;
}

/**
 * Assembles the full report `renderDiffMarkdown` renders. ALL measurement
 * happens HERE, once — the renderer only formats fields already on this
 * object (the same idempotence contract `compute-ceiling-recalibration.mjs`
 * states: the only field that may vary between two calls over an unchanged
 * `report` is `generatedAt` itself).
 */
export function buildDiffReport({ newDoc, oldEfforts, oldCeilings, recalibrationText, inputs }) {
  const newCeilings = newDoc?.ceilings ?? {};
  const changes = classifyEffortChanges(newDoc, oldEfforts);
  const reinstatements = splitReinstatements(changes);
  const rankChanges = buildRankChanges(newDoc, oldEfforts);
  const guardCounts = walkGuardCounts(newDoc);
  const reconciliation = reconcileCounts(changes, guardCounts);
  const ceilingTable = buildCeilingTable(newCeilings, oldCeilings);
  const ceilingCrossCheck = crossCheckCeilingAgainstRecalibration(ceilingTable, recalibrationText);
  const probeReconciliation = reconcileAgainstProbe(changes, guardCounts, ceilingTable);

  return {
    generatedAt: new Date().toISOString(),
    archiveSize: newDoc?.totals?.activitiesConsidered ?? null,
    changes,
    reinstatements,
    rankChanges,
    guardCounts,
    reconciliation,
    ceilingTable,
    ceilingCrossCheck,
    probeReconciliation,
    inputs: inputs ?? {},
  };
}

/**
 * Renders `36-DIFF.md` from a `report` built by `buildDiffReport`. Pure
 * string assembly: no `Date`, no `Math.random`, no `process` read, and no
 * unsorted object-key/Set/Map iteration reaches the output — every loop
 * below iterates `report.changes`/`report.ceilingTable` (fixed arrays,
 * already in a stable order) or a `TARGET_ORDER`-driven loop. The only field
 * that may vary between two calls over an unchanged `report` (aside from
 * `generatedAt` itself, read from `report`, never generated HERE) would be a
 * bug in this function. NO sign-off block, no approval checkbox and no
 * sha256 — this artifact stays purely generated and therefore idempotent;
 * the developer's approval lives in this phase's VALIDATION.md, bound to
 * this file's content, never embedded in it.
 */
export function renderDiffMarkdown(report) {
  const lines = [];

  lines.push('# Phase 36 — Archive-wide Before/After Clean-Window Diff');
  lines.push('');
  lines.push(
    'This file is machine-written and regenerated by `npm run compute-clean-window-diff`. It covers ' +
      'every rank change, every newly demoted effort, every reinstated effort, every moved-but-ranked ' +
      'effort and every ceiling value the clean-window search (PR-06/PR-07) and its ceiling ' +
      'recalibration (PR-08) produced. It carries NO sign-off block by design: the developer\'s ' +
      'approval lives in this phase\'s VALIDATION.md, bound to this file\'s content, so the artifact ' +
      'stays purely generated and therefore idempotent.'
  );
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  const movedButRanked = report.changes.filter((c) => c.kind === 'moved-but-ranked');
  const newlyDemoted = report.changes.filter((c) => c.kind === 'newly-demoted');
  const unchanged = report.changes.filter((c) => c.kind === 'unchanged');
  const reinstatedTotal = report.reinstatements.absoluteGuard.length + report.reinstatements.ceiling.length;
  const ceilingMovedCount = report.ceilingTable.filter((r) => r.oldCeilingMps !== r.newCeilingMps).length;

  // ## Headline
  lines.push('## Headline');
  lines.push('');
  lines.push(`- Moved but still ranked: ${movedButRanked.length}`);
  lines.push(`- Newly demoted: ${newlyDemoted.length}`);
  lines.push(
    `- Reinstated: ${reinstatedTotal} (${report.reinstatements.absoluteGuard.length} absolute-guard, ` +
      `${report.reinstatements.ceiling.length} ceiling)`
  );
  lines.push(`- Unchanged: ${unchanged.length}`);
  lines.push(`- Distances whose ceiling moved: ${ceilingMovedCount} of ${report.ceilingTable.length}`);
  lines.push('');

  // ## Ceiling Values
  lines.push('## Ceiling Values');
  lines.push('');
  lines.push('| Distance | Ceiling before (m/s) | Ceiling after (m/s) | p90 before | p90 after | Population before -> after |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of report.ceilingTable) {
    lines.push(
      `| ${row.distance} | ${fmtMps(row.oldCeilingMps)} | ${fmtMps(row.newCeilingMps)} | ${fmtMps(row.oldP90Mps)} | ` +
        `${fmtMps(row.newP90Mps)} | ${row.oldPopulationN ?? '—'} -> ${row.newPopulationN ?? '—'} |`
    );
  }
  lines.push('');
  if (!report.ceilingCrossCheck.available) {
    lines.push(
      `No \`${RECALIBRATION_ARTIFACT_RELATIVE_PATH}\` text was available to cross-check against this run's ` +
        'own ceiling table.'
    );
  } else {
    const disagreeing = report.ceilingCrossCheck.rows.filter((r) => !r.agrees);
    if (disagreeing.length === 0) {
      lines.push(
        `Every figure above agrees with \`${RECALIBRATION_ARTIFACT_RELATIVE_PATH}\`'s own ceiling table.`
      );
    } else {
      lines.push(
        `**${disagreeing.length} of ${report.ceilingCrossCheck.rows.length} ceiling row(s) DISAGREE** with ` +
          `\`${RECALIBRATION_ARTIFACT_RELATIVE_PATH}\` — reported here, never silently absorbed:`
      );
      lines.push('');
      lines.push('| Distance | This run before/after | Recalibration artifact before/after |');
      lines.push('|---|---|---|');
      for (const r of disagreeing) {
        lines.push(
          `| ${r.distance} | ${fmtMps(r.measuredBefore)} / ${fmtMps(r.measuredAfter)} | ` +
            `${fmtMps(r.recalibrationBefore)} / ${fmtMps(r.recalibrationAfter)} |`
        );
      }
    }
  }
  lines.push('');

  // ## Rank Changes
  lines.push('## Rank Changes');
  lines.push('');
  const distancesWithRankChanges = TARGET_ORDER.filter((d) => (report.rankChanges[d] ?? []).length > 0);
  const distancesWithoutRankChanges = TARGET_ORDER.filter((d) => (report.rankChanges[d] ?? []).length === 0);
  for (const distance of distancesWithRankChanges) {
    lines.push(`### ${distance}`);
    lines.push('');
    lines.push('| Rank | Old activity ID | New activity ID | Old duration (s) | New duration (s) |');
    lines.push('|---|---|---|---|---|');
    for (const row of report.rankChanges[distance]) {
      lines.push(
        `| ${row.rank} | ${row.oldActivityId ? safeActivityId(row.oldActivityId) : '—'} | ` +
          `${row.newActivityId ? safeActivityId(row.newActivityId) : '—'} | ${fmtSec(row.oldDurationSec)} | ` +
          `${fmtSec(row.newDurationSec)} |`
      );
    }
    lines.push('');
  }
  if (distancesWithoutRankChanges.length > 0) {
    lines.push(`No rank position changed at: ${distancesWithoutRankChanges.join(', ')}.`);
    lines.push('');
  }

  // ## Newly Demoted
  lines.push('## Newly Demoted');
  lines.push('');
  lines.push(`Full count: ${newlyDemoted.length}.`);
  lines.push('');
  if (newlyDemoted.length === 0) {
    lines.push('None in this run.');
  } else {
    lines.push('| Activity ID | Distance | New guard | Reason |');
    lines.push('|---|---|---|---|');
    for (const c of newlyDemoted) {
      lines.push(
        `| ${safeActivityId(c.activityId)} | ${c.distance} | ${c.newGuard ?? '—'} | ${safeCell(c.newReason)} |`
      );
    }
  }
  lines.push('');

  // ## Reinstated
  lines.push('## Reinstated');
  lines.push('');
  lines.push(
    'Not purely a ceiling phenomenon (36-RESEARCH.md D-08): today\'s single unconstrained sweep result ' +
      'is what `isPlausible` evaluates, so an effort whose RAW window fails an absolute guard but which ' +
      'has a clean sub-interval is reinstated by this phase too — listed separately below.'
  );
  lines.push('');
  lines.push('### Absolute-guard reinstatements');
  lines.push('');
  lines.push(`Full count: ${report.reinstatements.absoluteGuard.length}.`);
  lines.push('');
  if (report.reinstatements.absoluteGuard.length === 0) {
    lines.push('None in this run.');
  } else {
    lines.push('| Activity ID | Distance | OLD guard | OLD reason | New pace (s/km) |');
    lines.push('|---|---|---|---|---|');
    for (const c of report.reinstatements.absoluteGuard) {
      lines.push(
        `| ${safeActivityId(c.activityId)} | ${c.distance} | ${c.oldGuard} | ${safeCell(c.oldReason)} | ` +
          `${fmtSec(c.newPaceSecPerKm)} |`
      );
    }
  }
  lines.push('');
  lines.push('### Ceiling reinstatements');
  lines.push('');
  lines.push(`Full count: ${report.reinstatements.ceiling.length}.`);
  lines.push('');
  if (report.reinstatements.ceiling.length === 0) {
    lines.push('None in this run.');
  } else {
    lines.push('| Activity ID | Distance | OLD guard | OLD reason | New pace (s/km) |');
    lines.push('|---|---|---|---|---|');
    for (const c of report.reinstatements.ceiling) {
      lines.push(
        `| ${safeActivityId(c.activityId)} | ${c.distance} | ${c.oldGuard} | ${safeCell(c.oldReason)} | ` +
          `${fmtSec(c.newPaceSecPerKm)} |`
      );
    }
  }
  lines.push('');

  // ## Moved But Still Ranked
  lines.push('## Moved But Still Ranked');
  lines.push('');
  lines.push(`Full count: ${movedButRanked.length}.`);
  lines.push('');
  if (movedButRanked.length === 0) {
    lines.push('None in this run.');
  } else {
    const shown = movedButRanked.slice(0, MOVED_BUT_RANKED_RENDER_CAP);
    lines.push('| Activity ID | Distance | Old pace (s/km) | New pace (s/km) | Contamination reason |');
    lines.push('|---|---|---|---|---|');
    for (const c of shown) {
      lines.push(
        `| ${safeActivityId(c.activityId)} | ${c.distance} | ${fmtSec(c.oldPaceSecPerKm)} | ` +
          `${fmtSec(c.newPaceSecPerKm)} | ${safeCell(c.contaminatedReason)} |`
      );
    }
    const remainder = movedButRanked.length - shown.length;
    if (remainder > 0) {
      lines.push('');
      lines.push(`+${remainder} more (full count ${movedButRanked.length}, stated above the table).`);
    }
  }
  lines.push('');

  // ## Guard Counts (leg 2)
  lines.push('## Guard Counts (leg 2)');
  lines.push('');
  lines.push(
    'A plain walk over the shipped document, independent of the classification above — PR-09\'s own ' +
      'internal cross-check compares these counts against the lists, never trusting one half alone.'
  );
  lines.push('');
  lines.push('| Distance | world-record | max-speed | ceiling | unreliable-segment | other | contaminated |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const distance of TARGET_ORDER) {
    const b = report.guardCounts.perDistance[distance];
    lines.push(
      `| ${distance} | ${b['world-record']} | ${b['max-speed']} | ${b.ceiling} | ${b['unreliable-segment']} | ` +
        `${b.other} | ${b.contaminated} |`
    );
  }
  const t = report.guardCounts.totals;
  lines.push(
    `| **Total** | **${t['world-record']}** | **${t['max-speed']}** | **${t.ceiling}** | ` +
      `**${t['unreliable-segment']}** | **${t.other}** | **${t.contaminated}** |`
  );
  lines.push('');

  // ## Internal Reconciliation
  lines.push('## Internal Reconciliation');
  lines.push('');
  lines.push('| Check | This diff\'s lists | Walked guard counts | Agrees |');
  lines.push('|---|---|---|---|');
  for (const row of report.reconciliation) {
    lines.push(`| ${row.check} | ${row.listsFigure} | ${row.walkedFigure} | ${row.agrees ? 'yes' : 'NO'} |`);
  }
  lines.push('');
  lines.push(
    `The third, independent reconciliation leg is \`${RECOUNT_SCRIPT}\` (plan 36-12), which ` +
      'deliberately shares no code with this generator.'
  );
  lines.push('');
  const disagreeingChecks = report.reconciliation.filter((r) => !r.agrees);
  if (disagreeingChecks.length > 0) {
    lines.push(
      `**${disagreeingChecks.length} check(s) above disagree.** This is reported as a finding, never ` +
        'silently absorbed or adjusted away — see this run\'s own SUMMARY for the explanation.'
    );
    lines.push('');
  }

  // ## Reconciliation Against the Probe
  lines.push('## Reconciliation Against the Probe');
  lines.push('');
  lines.push(
    'Every figure below is a reference to reconcile against, never a pinned expected value (ROADMAP ' +
      'criterion 1) — drift is reported, never silently absorbed.'
  );
  lines.push('');
  lines.push('| Figure | Measured this run | 36-CONTEXT.md probe |');
  lines.push('|---|---|---|');
  for (const row of report.probeReconciliation) {
    lines.push(`| ${row.label} | ${row.measured} | ${row.probe} |`);
  }
  lines.push('');

  // ## Inputs
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Archive denominator: ${report.inputs.archiveSize ?? '—'} activities considered`);
  lines.push('- Manifest path: `data/streams/manifest.json`');
  lines.push(
    `- \`${RECALIBRATION_ARTIFACT_RELATIVE_PATH}\` — generatedAt: ` +
      `${report.inputs.recalibrationGeneratedAt ? safeCell(report.inputs.recalibrationGeneratedAt) : '(unavailable)'}`
  );
  lines.push('');
  lines.push('Regenerate this report against the live committed archive with:');
  lines.push('');
  lines.push('```');
  lines.push(REGENERATE_COMMAND);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// I/O — one computeBestEfforts sweep, report build, markdown render, write
// ---------------------------------------------------------------------------

async function main() {
  console.log('Computing the Phase 36 PR-09 archive-wide clean-window diff...\n');

  // Both statsDir and the ceiling-state path are throwaway temp paths under
  // os.tmpdir() — this run never writes data/stats/best-efforts.json and
  // never touches the committed data/best-effort-ceiling.json. The
  // ceiling-state write-gate's own opt-in flag (36-07) is never passed, so
  // this generator is doubly safe even without the throwaway path.
  const tempDir = mkdtempSync(join(tmpdir(), 'clean-window-diff-'));
  const throwawayStatsDir = join(tempDir, 'stats');
  const throwawayCeilingStatePath = join(tempDir, 'ceiling-state.json');

  try {
    let newDoc;
    try {
      newDoc = await computeBestEfforts({
        statsDir: throwawayStatsDir,
        ceilingStatePath: throwawayCeilingStatePath,
      });
    } catch (error) {
      console.error(`Error: computeBestEfforts failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    // Each activity's own max_speed, for the OLD reconstruction's
    // isPlausible re-evaluation (same read compute-ceiling-recalibration.mjs
    // performs) — data/activities/{id}.json is the only place max_speed
    // lives.
    const activityMaxSpeeds = new Map();
    for (const activityId of Object.keys(newDoc.activities)) {
      try {
        const raw = readFileSync(join(ROOT_DIR, 'data/activities', `${activityId}.json`), 'utf8');
        const parsed = JSON.parse(raw);
        activityMaxSpeeds.set(activityId, typeof parsed.max_speed === 'number' ? parsed.max_speed : undefined);
      } catch (error) {
        console.warn(
          `  ${activityId}: could not read max_speed (${error.message}); OLD reconstruction treats it as undefined`
        );
        activityMaxSpeeds.set(activityId, undefined);
      }
    }

    const oldEfforts = reconstructOldEfforts(newDoc, activityMaxSpeeds);
    const oldPopulations = buildPopulations(oldEfforts, { useOld: true });
    const oldCeilings = deriveCeilings(oldPopulations);

    let recalibrationText = null;
    try {
      recalibrationText = readFileSync(RECALIBRATION_ARTIFACT_PATH, 'utf8');
    } catch (error) {
      console.warn(
        `Could not read ${RECALIBRATION_ARTIFACT_RELATIVE_PATH}: ${error.message} — ceiling cross-check will ` +
          'be reported unavailable.'
      );
    }

    const inputs = {
      archiveSize: newDoc.totals.activitiesConsidered,
      recalibrationGeneratedAt: extractGeneratedLine(recalibrationText),
    };

    const report = buildDiffReport({ newDoc, oldEfforts, oldCeilings, recalibrationText, inputs });

    console.log(`Archive size: ${report.archiveSize}`);
    console.log(`Moved-but-ranked: ${report.changes.filter((c) => c.kind === 'moved-but-ranked').length}`);
    console.log(`Newly demoted: ${report.changes.filter((c) => c.kind === 'newly-demoted').length}`);
    console.log(`Reinstated (absolute-guard): ${report.reinstatements.absoluteGuard.length}`);
    console.log(`Reinstated (ceiling): ${report.reinstatements.ceiling.length}`);
    console.log(`Unchanged: ${report.changes.filter((c) => c.kind === 'unchanged').length}`);
    for (const row of report.reconciliation) {
      console.log(`  ${row.check}: ${row.listsFigure} vs ${row.walkedFigure} (agrees: ${row.agrees})`);
    }

    const markdown = renderDiffMarkdown(report);

    // The one and only write this script performs.
    writeFileSync(OUTPUT_PATH, markdown, 'utf8');
    console.log(`\nWrote ${OUTPUT_PATH}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// Self-execution guard, mirroring compute-pr-ceiling-diff.mjs /
// compute-ceiling-recalibration.mjs: main() runs only under direct
// invocation, so compute-clean-window-diff.test.mjs can import every pure
// function above without triggering an archive sweep or a write to
// 36-DIFF.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
