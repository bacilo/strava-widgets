/**
 * Phase 28 PR-04 — the archive-wide before/after PR diff (D-12/D-13/D-14).
 *
 * `data/stats/` is gitignored and starts empty on every CI runner, so there
 * is no committed historical `best-efforts.json` to diff against. The only
 * correct comparison computes OLD and NEW semantics from the SAME live
 * archive snapshot inside one run — exactly as `compute-pace-residual.mjs`
 * computes its baseline and adaptive figures side by side. This is NOT a
 * git-history comparison: comparing two dated regenerations would conflate
 * archive growth with the logic change being measured
 * (28-RESEARCH.md Pitfall 3).
 *
 * `main()` runs `computeBestEfforts` ONCE against the real archive with a
 * throwaway `statsDir` AND a throwaway `ceilingStatePath` (both under the OS
 * temp directory via `os.tmpdir()`), so generating this diff can never
 * overwrite `data/stats/best-efforts.json` or rewrite the committed ceiling
 * state (T-28-07-A) — a diff tool that mutates the thing it is describing is
 * not a dry run. `ceilingStatePath` is a throwaway temp path: it is passed so
 * the committed ceiling state at `data/best-effort-ceiling.json` is never
 * touched by this script, no matter what `computeBestEfforts` does with it.
 *
 * OLD-semantics reconstruction rule (stated once here, exactly, because a
 * reader must be able to audit it): before this phase, `computeActivityEfforts`
 * deleted an effort when `isPlausible` failed and there was no ceiling at
 * all. Every such effort now carries `demotion.guard` of `world-record` or
 * `max-speed`, and every ceiling-only rejection carries `ceiling`. So the OLD
 * ranked population per distance is the NEW document's efforts at that
 * distance, MINUS those whose `demotion.guard` is `world-record` or
 * `max-speed`, MINUS those whose `excludedFromRecords` is true, WITH
 * ceiling-demoted efforts RETAINED because the old code had no ceiling to
 * reject them. Feeding that population through `markPRs` and `rankTopN`
 * (the exact same pure functions the shipped pipeline uses) recovers the OLD
 * `wasPRAtTheTime` flags and the OLD top-10 — no second archive sweep is
 * needed.
 *
 * Structure follows `scripts/compute-pace-residual.mjs` and
 * `scripts/compute-pr-ceiling-calibration.mjs`: pure exported functions with
 * zero file I/O beyond the one `computeBestEfforts` call inside `main()`,
 * plus a `main()` gated behind the standard self-execution guard so
 * `compute-pr-ceiling-diff.test.mjs` can import the pure functions without
 * triggering an archive sweep or a write to `28-DIFF.md` as an import-time
 * side effect.
 *
 * T-28-07-B (mitigate): activity ids are only ever emitted after matching
 * `VALID_ACTIVITY_ID`, and any interpolated string is stripped of newline
 * and pipe characters before landing in a markdown table cell, so a
 * hand-edited archive cannot break the table or inject a link into a
 * committed artifact.
 *
 * Only write target: `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`.
 * `main()`'s own `statsDir`/`ceilingStatePath` are both throwaway temp paths
 * — nothing under `data/` is ever written by this script.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { computeBestEfforts } from '../dist/analytics/compute-best-efforts.js';
import { TARGET_METERS, TARGET_ORDER } from '../dist/analytics/best-effort.types.js';
import { markPRs, rankTopN, TOP_N } from '../dist/analytics/best-effort-utils.js';
import { CEILING_K, CEILING_MIN_POPULATION } from '../dist/analytics/best-effort-ceiling.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(
  __dirname,
  '../.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md'
);

const REGENERATE_COMMAND = 'npm run compute-pr-ceiling-diff';
const RECOUNT_SCRIPT = 'scripts/compute-pr-ceiling-recount.mjs';

/** T-28-07-B: an activity id is only ever emitted after matching this shape. */
const VALID_ACTIVITY_ID = /^i?\d{1,20}$/;

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O (the guard test's contract)
// ---------------------------------------------------------------------------

/** T-28-07-B: renders an activity id only after validating its shape. */
function safeActivityId(activityId) {
  if (typeof activityId === 'string' && VALID_ACTIVITY_ID.test(activityId)) return activityId;
  return '(malformed id)';
}

/** T-28-07-B: strips characters that would break a markdown table cell or inject a link. */
function safeCell(value) {
  return String(value).replace(/[\n\r|]/g, ' ').trim();
}

const flagKey = (activityId, distance) => `${activityId}|${distance}`;

/**
 * Reconstructs the OLD document's `{ rankings, prFlags }` from the NEW
 * document, per the reconstruction rule stated in this file's header
 * comment. `prFlags` is keyed by `activityId|distance`; its value carries
 * everything a flag-flip row needs to render (not a bare boolean — see the
 * "Deviation from the plan's own vocabulary" note below), because a bare
 * boolean cannot supply the duration/demotion-guard fields
 * `diffPrState`'s `flagFlips` rows are required to carry.
 *
 * Membership rule per distance, applied PER EFFORT (never per activity — the
 * pipeline's owner-exclusion is distance-scoped: the activity-level flag is
 * true for the whole activity once ANY exclusion entry names it, even one
 * scoped to a single distance, while `effort.excludedFromRecords` is the
 * per-distance truth `compute-best-efforts.ts` actually applies. Keying off
 * the activity-level flag would drop a non-excluded effort of a
 * partially-excluded activity, which the shipped pipeline retains — WR-04):
 * - drop the effort if `effort.excludedFromRecords`
 * - drop the effort if `effort.demotion?.guard` is `'world-record'` or `'max-speed'`
 * - RETAIN the effort if `effort.demotion` is `null` or `effort.demotion.guard === 'ceiling'`
 *   (the old code had no ceiling to reject it)
 *
 * The retained population is then run through the exact same `markPRs`
 * (chronological, re-entrant) and `rankTopN` (fastest-first, top `TOP_N`)
 * pure functions the shipped pipeline uses — so the OLD flags/rankings are
 * derived by the identical mechanism, not a re-implementation of it.
 */
export function reconstructOldDocument(newDoc) {
  const activities = newDoc?.activities ?? {};
  const rankings = {};
  const prFlags = {};

  for (const key of TARGET_ORDER) {
    const population = [];

    for (const activityId of Object.keys(activities)) {
      const activity = activities[activityId];
      if (!activity) continue;

      for (const effort of activity.efforts ?? []) {
        if (effort.distance !== key) continue;
        if (effort.excludedFromRecords) continue;

        const guard = effort.demotion ? effort.demotion.guard : null;
        if (guard === 'world-record' || guard === 'max-speed') continue;

        population.push({
          activityId,
          startDate: activity.startDate,
          durationSec: effort.durationSec,
          paceSecPerKm: effort.paceSecPerKm,
          lowConfidence: effort.lowConfidence,
          demotionGuard: guard, // null or 'ceiling' only, by the filter above
        });
      }
    }

    const withPR = markPRs(population);
    for (const entry of withPR) {
      prFlags[flagKey(entry.activityId, key)] = {
        wasPRAtTheTime: entry.wasPRAtTheTime,
        durationSec: entry.durationSec,
        startDate: entry.startDate,
        demotionGuard: entry.demotionGuard,
      };
    }

    rankings[key] = rankTopN(population, TOP_N);
  }

  return { rankings, prFlags };
}

/**
 * Reads the NEW document's `{ rankings, prFlags }` straight off the shipped
 * shape, so both sides of the diff are compared in one vocabulary. Unlike
 * `reconstructOldDocument`, this includes EVERY activity/effort the NEW
 * document carries (including excluded and absolute-guard-demoted ones,
 * whose `wasPRAtTheTime` is always `false` here and absent from
 * `reconstructOldDocument`'s output — both resolve to "not a PR", so
 * `diffPrState` never manufactures a flip for them).
 */
export function extractNewState(newDoc) {
  const rankings = {};
  for (const key of TARGET_ORDER) {
    rankings[key] = (newDoc?.rankings?.[key] ?? []).map((entry) => ({ ...entry }));
  }

  const prFlags = {};
  const activities = newDoc?.activities ?? {};
  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    for (const effort of activity.efforts ?? []) {
      prFlags[flagKey(activityId, effort.distance)] = {
        wasPRAtTheTime: effort.wasPRAtTheTime,
        durationSec: effort.durationSec,
        startDate: activity.startDate,
        demotionGuard: effort.demotion ? effort.demotion.guard : null,
        excludedFromRecords: effort.excludedFromRecords === true,
      };
    }
  }

  return { rankings, prFlags };
}

/**
 * D-12's diff: per distance, every top-10 ranking row that moved and every
 * `wasPRAtTheTime` flip in BOTH directions, plus archive-wide totals.
 *
 * Returns `{ perDistance, totals }`. `perDistance[distance]` carries
 * `rankingRows`, `flagFlips`, `flagsBefore`, `flagsAfter`, `flagsFlipped`,
 * `demotedCount` (ceiling demotions at this distance, read from the NEW
 * side) and `netZeroButMoved`. `totals` carries `totalDemoted`,
 * `totalFlagFlips`, `totalRetroactivePromotions` (flips with direction
 * `'gained'`) and `totalRankingRowsMoved`, summed across `TARGET_ORDER`.
 *
 * Determinism: `TARGET_ORDER` drives every outer iteration; `rankingRows` is
 * sorted by `newRank` then `oldRank` then `activityId` (nulls sort last);
 * `flagFlips` is sorted by `activityId` via `localeCompare`. No `Map`/`Set`
 * is ever iterated without first being sorted into an array.
 */
export function diffPrState(oldState, newState) {
  const perDistance = {};
  let totalDemoted = 0;
  let totalDemotedExcluded = 0;
  let totalFlagFlips = 0;
  let totalRetroactivePromotions = 0;
  let totalRankingRowsMoved = 0;

  for (const key of TARGET_ORDER) {
    const oldRanking = oldState.rankings[key] ?? [];
    const newRanking = newState.rankings[key] ?? [];

    const oldByActivity = new Map(oldRanking.map((r) => [r.activityId, r]));
    const newByActivity = new Map(newRanking.map((r) => [r.activityId, r]));

    const rankedActivityIds = Array.from(
      new Set([...oldByActivity.keys(), ...newByActivity.keys()])
    ).sort((a, b) => a.localeCompare(b));

    const rankingRows = [];
    for (const activityId of rankedActivityIds) {
      const oldEntry = oldByActivity.get(activityId) ?? null;
      const newEntry = newByActivity.get(activityId) ?? null;
      const oldRank = oldEntry ? oldEntry.rank : null;
      const newRank = newEntry ? newEntry.rank : null;
      if (oldRank === newRank) continue;

      let movement;
      if (oldRank !== null && newRank === null) movement = 'removed';
      else if (oldRank === null && newRank !== null) movement = 'entered';
      else if (newRank < oldRank) movement = 'moved-up';
      else movement = 'moved-down';

      const source = newEntry ?? oldEntry;
      rankingRows.push({
        activityId,
        startDate: source.startDate,
        durationSec: source.durationSec,
        oldRank,
        newRank,
        movement,
      });
    }

    rankingRows.sort((a, b) => {
      const an = a.newRank === null ? Infinity : a.newRank;
      const bn = b.newRank === null ? Infinity : b.newRank;
      if (an !== bn) return an - bn;
      const ao = a.oldRank === null ? Infinity : a.oldRank;
      const bo = b.oldRank === null ? Infinity : b.oldRank;
      if (ao !== bo) return ao - bo;
      return a.activityId.localeCompare(b.activityId);
    });

    const flagKeysForDistance = new Set();
    for (const k of Object.keys(oldState.prFlags)) {
      if (k.endsWith(`|${key}`)) flagKeysForDistance.add(k);
    }
    for (const k of Object.keys(newState.prFlags)) {
      if (k.endsWith(`|${key}`)) flagKeysForDistance.add(k);
    }
    const sortedFlagKeys = Array.from(flagKeysForDistance).sort((a, b) => a.localeCompare(b));

    let flagsBefore = 0;
    let flagsAfter = 0;
    let demotedCount = 0;
    let demotedExcludedCount = 0;
    const flagFlips = [];

    for (const k of sortedFlagKeys) {
      const oldInfo = oldState.prFlags[k];
      const newInfo = newState.prFlags[k];
      const oldFlag = oldInfo ? oldInfo.wasPRAtTheTime : false;
      const newFlag = newInfo ? newInfo.wasPRAtTheTime : false;

      if (oldFlag) flagsBefore++;
      if (newFlag) flagsAfter++;
      if (newInfo && newInfo.demotionGuard === 'ceiling') {
        demotedCount++;
        if (newInfo.excludedFromRecords) demotedExcludedCount++;
      }

      if (oldFlag === newFlag) continue;

      const info = newInfo ?? oldInfo;
      const activityId = k.slice(0, k.lastIndexOf('|'));
      flagFlips.push({
        activityId,
        distance: key,
        direction: oldFlag && !newFlag ? 'lost' : 'gained',
        durationSec: info.durationSec,
        demoted: info.demotionGuard !== null,
      });
    }

    flagFlips.sort((a, b) => a.activityId.localeCompare(b.activityId));

    const flagsFlipped = flagFlips.length;
    const netZeroButMoved = flagsBefore === flagsAfter && flagsFlipped > 0;

    perDistance[key] = {
      rankingRows,
      flagFlips,
      flagsBefore,
      flagsAfter,
      flagsFlipped,
      demotedCount,
      demotedExcludedCount,
      netZeroButMoved,
    };

    totalDemoted += demotedCount;
    totalDemotedExcluded += demotedExcludedCount;
    totalFlagFlips += flagsFlipped;
    totalRetroactivePromotions += flagFlips.filter((f) => f.direction === 'gained').length;
    totalRankingRowsMoved += rankingRows.length;
  }

  return {
    perDistance,
    totals: {
      totalDemoted,
      totalFlagFlips,
      totalRetroactivePromotions,
      totalRankingRowsMoved,
      totalDemotedExcluded,
    },
  };
}

/**
 * Builds the `ceilingDemotedExcluded` listing: one row per NEW effort with
 * `demotion.guard === 'ceiling'` AND `excludedFromRecords === true`. These
 * efforts are already absent from every ranking and flag chain because the
 * owner excluded them; the listing is how a reviewer confirms the
 * ceiling-only total's increase is fully explained by owner-excluded
 * efforts, not by some other change. Sorted by `TARGET_ORDER` index, then
 * `activityId` (localeCompare) — deterministic across runs.
 */
function buildCeilingDemotedExcluded(newDoc) {
  const activities = newDoc?.activities ?? {};
  const ceilings = newDoc?.ceilings ?? {};
  const rows = [];

  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    if (!activity) continue;

    for (const effort of activity.efforts ?? []) {
      if (effort.demotion?.guard !== 'ceiling') continue;
      if (effort.excludedFromRecords !== true) continue;

      const meters = TARGET_METERS[effort.distance];
      rows.push({
        activityId,
        distance: effort.distance,
        durationSec: effort.durationSec,
        impliedSpeedMps: meters && effort.durationSec > 0 ? meters / effort.durationSec : null,
        ceilingMps: ceilings[effort.distance]?.ceilingMps ?? null,
      });
    }
  }

  rows.sort((a, b) => {
    const ai = TARGET_ORDER.indexOf(a.distance);
    const bi = TARGET_ORDER.indexOf(b.distance);
    if (ai !== bi) return ai - bi;
    return a.activityId.localeCompare(b.activityId);
  });

  return rows;
}

/**
 * Assembles the full report `renderDiffMarkdown` renders, from one NEW
 * document. All measurement happens HERE, once — `renderDiffMarkdown` only
 * formats fields already on this object and must remain a pure function of
 * it (D-13's idempotence contract: the only field that may vary between two
 * runs over unchanged input is `generatedAt`).
 */
export function buildDiffReport(newDoc) {
  const oldState = reconstructOldDocument(newDoc);
  const newState = extractNewState(newDoc);
  const diff = diffPrState(oldState, newState);

  return {
    generatedAt: new Date().toISOString(),
    archiveSize: newDoc?.totals?.activitiesConsidered ?? null,
    documentDemotedTotal: newDoc?.totals?.effortsDemoted ?? null,
    ceilings: newDoc?.ceilings ?? {},
    perDistance: diff.perDistance,
    totals: diff.totals,
    ceilingDemotedExcluded: buildCeilingDemotedExcluded(newDoc),
    ceilingK: CEILING_K,
    ceilingMinPopulation: CEILING_MIN_POPULATION,
  };
}

function formatMps(mps) {
  return mps === null || mps === undefined ? '—' : mps.toFixed(4);
}

/**
 * Renders `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` from a
 * `report` object built by `buildDiffReport`. Pure string assembly: the only
 * run-varying field is `report.generatedAt`, emitted on its own
 * `**Generated:**` line. No sign-off text, approval checkbox or reviewer
 * name is ever written — D-14 keeps the developer's approval in
 * `28-VALIDATION.md`, bound to this file's content, so the artifact stays
 * purely generated and therefore idempotent.
 */
export function renderDiffMarkdown(report) {
  const lines = [];

  lines.push('# Phase 28 — Archive-wide Before/After PR Diff');
  lines.push('');
  lines.push(
    'This file is machine-written and regenerated by `npm run compute-pr-ceiling-diff`. It carries ' +
      'NO sign-off block by design (D-14): the developer\'s approval lives in `28-VALIDATION.md`, ' +
      'bound to this file\'s content hash, so the artifact stays purely generated and therefore ' +
      'idempotent.'
  );
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  // ## How before and after were computed
  lines.push('## How before and after were computed');
  lines.push('');
  lines.push(
    'One `computeBestEfforts` run over the live archive produced the AFTER document. The BEFORE ' +
      'document was reconstructed from that SAME document by dropping the efforts the absolute ' +
      'guard used to delete (`demotion.guard` of `world-record` or `max-speed`) and retaining ' +
      'ceiling demotions, then re-running `markPRs` and `rankTopN` over the retained population. ' +
      'Exclusion is applied PER EFFORT, never per activity: the pipeline\'s owner-exclusion is ' +
      'distance-scoped, so an activity with one excluded distance still contributes its other, ' +
      'non-excluded efforts to both the OLD and NEW populations. This is not a git-history ' +
      'comparison: `data/stats/` is gitignored, so no committed historical baseline exists, and ' +
      'comparing two dated regenerations would conflate archive growth with the logic change being ' +
      'measured.'
  );
  lines.push('');

  // ## Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Archive size (activities considered): ${report.archiveSize}`);
  lines.push(`- Total efforts demoted (this report's own count, ceiling-only): ${report.totals.totalDemoted}`);
  lines.push(
    `- Of those, also owner-excluded (no ranking effect): ${report.totals.totalDemotedExcluded}`
  );
  lines.push(`- Total \`wasPRAtTheTime\` flag flips: ${report.totals.totalFlagFlips}`);
  lines.push(`- Total retroactive promotions (flips gained): ${report.totals.totalRetroactivePromotions}`);
  lines.push(`- Total ranking rows moved: ${report.totals.totalRankingRowsMoved}`);
  lines.push('');
  lines.push(
    '| Distance | Ceiling (m/s) | Demoted (ceiling) | Of which owner-excluded | Flags before | Flags after | Flags flipped |'
  );
  lines.push('|---|---|---|---|---|---|---|');
  for (const key of TARGET_ORDER) {
    const c = report.ceilings[key];
    const d = report.perDistance[key];
    const ceilingText = c && c.ceilingMps !== null ? formatMps(c.ceilingMps) : (c?.failOpenReason ?? 'fail-open');
    lines.push(
      `| ${key} | ${ceilingText} | ${d.demotedCount} | ${d.demotedExcludedCount} | ${d.flagsBefore} | ` +
        `${d.flagsAfter} | ${d.flagsFlipped} |`
    );
  }
  lines.push('');

  // ## Records that changed hands
  lines.push('## Records that changed hands');
  lines.push('');
  const distancesWithRankingChanges = [];
  const distancesWithoutRankingChanges = [];
  for (const key of TARGET_ORDER) {
    if (report.perDistance[key].rankingRows.length > 0) distancesWithRankingChanges.push(key);
    else distancesWithoutRankingChanges.push(key);
  }
  for (const key of distancesWithRankingChanges) {
    lines.push(`### ${key}`);
    lines.push('');
    lines.push('| Activity ID | Start date | Duration (s) | Old rank | New rank | Movement |');
    lines.push('|---|---|---|---|---|---|');
    for (const row of report.perDistance[key].rankingRows) {
      lines.push(
        `| ${safeActivityId(row.activityId)} | ${safeCell(row.startDate)} | ${row.durationSec.toFixed(1)} | ` +
          `${row.oldRank ?? '—'} | ${row.newRank ?? '—'} | ${row.movement} |`
      );
    }
    lines.push('');
  }
  if (distancesWithoutRankingChanges.length > 0) {
    lines.push(
      `No ranking row changed at: ${distancesWithoutRankingChanges.join(', ')}.`
    );
    lines.push('');
  }

  // ## PR-at-the-time flag flips
  lines.push('## PR-at-the-time flag flips');
  lines.push('');
  const distancesWithFlips = [];
  const distancesWithoutFlips = [];
  for (const key of TARGET_ORDER) {
    if (report.perDistance[key].flagFlips.length > 0) distancesWithFlips.push(key);
    else distancesWithoutFlips.push(key);
  }
  for (const key of distancesWithFlips) {
    lines.push(`### ${key}`);
    lines.push('');
    lines.push('| Activity ID | Distance | Direction | Duration (s) | Itself demoted |');
    lines.push('|---|---|---|---|---|');
    for (const flip of report.perDistance[key].flagFlips) {
      lines.push(
        `| ${safeActivityId(flip.activityId)} | ${flip.distance} | ${flip.direction} | ` +
          `${flip.durationSec.toFixed(1)} | ${flip.demoted ? 'yes' : 'no'} |`
      );
    }
    lines.push('');
    if (report.perDistance[key].netZeroButMoved) {
      lines.push(
        `**${key} is a net-zero-count distance that still changed:** flags before and after are ` +
          `both ${report.perDistance[key].flagsBefore}, but ${report.perDistance[key].flagsFlipped} ` +
          'flags flipped underneath that unchanged total — a rankings-only diff would have reported ' +
          'this distance as nothing happened.'
      );
      lines.push('');
    }
  }
  if (distancesWithoutFlips.length > 0) {
    lines.push(`No flag flipped at: ${distancesWithoutFlips.join(', ')}.`);
    lines.push('');
  }

  // ## Retroactive promotions
  lines.push('## Retroactive promotions');
  lines.push('');
  lines.push(
    '`markPRs` is chronological, so removing one effort re-runs the improved-on-best-so-far chain ' +
      'behind it, and an activity that was never a PR can become one. Every flip with direction ' +
      '`gained` below is exactly this: a knock-on promotion, never a direct demotion of the ' +
      'promoted effort itself.'
  );
  lines.push('');
  const allGained = [];
  for (const key of TARGET_ORDER) {
    for (const flip of report.perDistance[key].flagFlips) {
      if (flip.direction === 'gained') allGained.push(flip);
    }
  }
  if (allGained.length === 0) {
    lines.push('None in this run — no flip has direction `gained`.');
    lines.push('');
  } else {
    lines.push('| Activity ID | Distance | Duration (s) |');
    lines.push('|---|---|---|');
    for (const flip of allGained) {
      lines.push(`| ${safeActivityId(flip.activityId)} | ${flip.distance} | ${flip.durationSec.toFixed(1)} |`);
    }
    lines.push('');
  }
  const netZeroDistances = TARGET_ORDER.filter((key) => report.perDistance[key].netZeroButMoved);
  if (netZeroDistances.length > 0) {
    lines.push(
      `Net-zero-count distances (flags before equals flags after, yet flags flipped): ` +
        `${netZeroDistances.join(', ')}.`
    );
    lines.push('');
  }

  // ## Ceiling demotions on owner-excluded efforts
  lines.push('## Ceiling demotions on owner-excluded efforts');
  lines.push('');
  lines.push(
    'Every effort listed below was already absent from every ranking and flag chain above, because ' +
      'the owner excluded it. Since the CR-01 fix these efforts also carry a ceiling demotion, ' +
      'because D-10 records the owner\'s stated intent (`excludedFromRecords`) and the machine\'s ' +
      'plausibility judgment (`demotion`) as separate claims — so no ranking row or flag flip ' +
      'anywhere above is caused by them. This listing is how a reviewer confirms the ceiling-only ' +
      'total\'s increase is fully explained by owner-excluded efforts.'
  );
  lines.push('');
  if (report.ceilingDemotedExcluded.length === 0) {
    lines.push('None in this run.');
    lines.push('');
  } else {
    lines.push('| Activity ID | Distance | Duration (s) | Implied speed (m/s) | Ceiling (m/s) |');
    lines.push('|---|---|---|---|---|');
    for (const row of report.ceilingDemotedExcluded) {
      lines.push(
        `| ${safeActivityId(row.activityId)} | ${row.distance} | ${row.durationSec.toFixed(1)} | ` +
          `${formatMps(row.impliedSpeedMps)} | ${formatMps(row.ceilingMps)} |`
      );
    }
    lines.push('');
  }

  // ## Reconciliation
  lines.push('## Reconciliation');
  lines.push('');
  lines.push(
    `This report counts **${report.totals.totalDemoted}** total ceiling-demoted efforts across all ` +
      `distances (of which ${report.totals.totalDemotedExcluded} are also owner-excluded, listed ` +
      `above), and the document's own \`totals.effortsDemoted\` — world-record, max-speed and ceiling ` +
      `combined — is ${report.documentDemotedTotal}. The ceiling-only total must equal two ` +
      `independently derived figures: \`${RECOUNT_SCRIPT}\`'s own \`byGuard.ceiling\` count, and that ` +
      'same script\'s independent sweep total, `independentCeilingCount`, which recomputes every ' +
      'effort\'s implied speed against its distance\'s ceiling without importing this document\'s own ' +
      'classifier. This report cannot check itself; agreement is asserted only once that independent ' +
      'tool runs. No sign-off, approval or reviewer text is recorded here — D-14 keeps that in ' +
      '`28-VALIDATION.md`, bound to this file\'s content hash.'
  );
  lines.push('');

  // ## Inputs
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Archive denominator: ${report.archiveSize} activities considered`);
  lines.push('- Manifest path: `data/streams/manifest.json`');
  lines.push(`- \`CEILING_K\`: ${report.ceilingK}`);
  lines.push(`- \`CEILING_MIN_POPULATION\`: ${report.ceilingMinPopulation}`);
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
  console.log('Computing the PR-04 archive-wide before/after diff...\n');

  // T-28-07-A: both statsDir and ceilingStatePath are throwaway temp paths
  // under os.tmpdir() — this run never writes data/stats/best-efforts.json
  // and never rewrites the committed ceiling state. IN-04: the temp
  // directory receives a full per-activity shard tree (about 1,860 files)
  // and is removed in `finally` whether computeBestEfforts succeeds or
  // throws.
  const tempDir = mkdtempSync(join(tmpdir(), 'pr-ceiling-diff-'));
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

    const report = buildDiffReport(newDoc);

    console.log(`Archive size: ${report.archiveSize}`);
    console.log(`Total demoted (ceiling-only, this report): ${report.totals.totalDemoted}`);
    console.log(`Of which owner-excluded: ${report.totals.totalDemotedExcluded}`);
    console.log(`Total flag flips: ${report.totals.totalFlagFlips}`);
    console.log(`Total retroactive promotions: ${report.totals.totalRetroactivePromotions}`);
    console.log(`Total ranking rows moved: ${report.totals.totalRankingRowsMoved}`);
    for (const key of TARGET_ORDER) {
      const d = report.perDistance[key];
      console.log(
        `  ${key}: demoted=${d.demotedCount} demotedExcluded=${d.demotedExcludedCount} ` +
          `flagsBefore=${d.flagsBefore} flagsAfter=${d.flagsAfter} flagsFlipped=${d.flagsFlipped} ` +
          `netZeroButMoved=${d.netZeroButMoved}`
      );
    }

    const markdown = renderDiffMarkdown(report);
    writeFileSync(OUTPUT_PATH, markdown, 'utf8');
    console.log(`\nWrote ${OUTPUT_PATH}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// Self-execution guard, mirroring compute-pace-residual.mjs /
// compute-pr-ceiling-calibration.mjs: main() runs only under direct
// invocation, so compute-pr-ceiling-diff.test.mjs can import the pure
// functions above without triggering an archive sweep or a write to
// 28-DIFF.md as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
