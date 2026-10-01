/**
 * Guard test for the pure functions exported by compute-clean-window-diff.mjs
 * (Phase 36 plan 11, PR-09). Importing this module must not run the archive
 * sweep or write 36-DIFF.md — if it does, the self-execution guard
 * documented at the bottom of compute-clean-window-diff.mjs is wrong and
 * must be fixed rather than worked around here. Every fixture below is
 * hand-built; no fixture reads any committed archive directory under the
 * repo's top-level `data` folder, and no test writes anywhere.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { TARGET_ORDER } from '../dist/analytics/best-effort.types.js';

import {
  buildRankChanges,
  classifyEffortChanges,
  crossCheckCeilingAgainstRecalibration,
  reconcileCounts,
  renderDiffMarkdown,
  splitReinstatements,
} from './compute-clean-window-diff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATOR_PATH = join(__dirname, 'compute-clean-window-diff.mjs');

/** `MOVED_BUT_RANKED_RENDER_CAP`'s own value, mirrored here so a test can assert cap behaviour precisely. */
const MOVED_BUT_RANKED_RENDER_CAP = 50;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Minimal flat OLD-effort record, the shape `reconstructOldEfforts` returns. */
function makeOldEffort({ activityId, distance, durationSec, demotion = null, excludedFromRecords = false }) {
  return { activityId, distance, durationSec, impliedSpeedMps: null, demotion, excludedFromRecords };
}

/** Minimal `ComputedEffort`/`BestEffort`-shaped NEW effort fixture. */
function makeNewEffort({
  distance,
  durationSec,
  paceSecPerKm,
  demotion = null,
  contaminated = null,
  excludedFromRecords = false,
}) {
  return {
    distance,
    durationSec,
    paceSecPerKm: paceSecPerKm ?? durationSec,
    startOffsetSec: 0,
    endOffsetSec: durationSec,
    lowConfidence: false,
    demotion,
    contaminated,
    excludedFromRecords,
  };
}

function makeActivity({ activityId, startDate = '2024-01-01T00:00:00Z', efforts }) {
  return { activityId, startDate, distanceSource: 'native', efforts, excludedFromRecords: false };
}

function makeNewDoc(activityList) {
  const activities = {};
  for (const a of activityList) activities[a.activityId] = a;
  return { activities, totals: { activitiesConsidered: activityList.length }, rankings: {}, ceilings: {} };
}

function emptyRankChanges() {
  const result = {};
  for (const d of TARGET_ORDER) result[d] = [];
  return result;
}

function emptyGuardCounts() {
  const guardKeys = ['world-record', 'max-speed', 'ceiling', 'unreliable-segment'];
  const makeBucket = () => {
    const bucket = { other: 0, contaminated: 0 };
    for (const g of guardKeys) bucket[g] = 0;
    return bucket;
  };
  const perDistance = {};
  for (const d of TARGET_ORDER) perDistance[d] = makeBucket();
  return { perDistance, totals: makeBucket() };
}

function emptyCeilingTable() {
  return TARGET_ORDER.map((d) => ({
    distance: d,
    oldCeilingMps: 5,
    newCeilingMps: 5,
    oldP90Mps: 4,
    newP90Mps: 4,
    oldPopulationN: 100,
    newPopulationN: 100,
    failOpenReason: null,
  }));
}

/** A fully-shaped `report` object, as `buildDiffReport` would produce, for renderer-only tests. */
function baseReport(overrides = {}) {
  return {
    generatedAt: '2020-01-01T00:00:00.000Z',
    archiveSize: 1000,
    changes: [],
    reinstatements: { absoluteGuard: [], ceiling: [] },
    rankChanges: emptyRankChanges(),
    guardCounts: emptyGuardCounts(),
    reconciliation: [],
    ceilingTable: emptyCeilingTable(),
    ceilingCrossCheck: { available: false, rows: [] },
    probeReconciliation: [],
    inputs: { archiveSize: 1000, recalibrationGeneratedAt: '2019-12-31T00:00:00.000Z' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// a. CLASSIFICATION — one record per kind, fails closed on ambiguity
// ---------------------------------------------------------------------------

describe('classifyEffortChanges', () => {
  it('classifies moved-but-ranked, newly-demoted, reinstated and unchanged each exactly once', () => {
    const newDoc = makeNewDoc([
      makeActivity({
        activityId: '1001',
        efforts: [
          makeNewEffort({
            distance: '400m',
            durationSec: 90,
            demotion: null,
            contaminated: {
              guard: 'unreliable-segment',
              reason: 'window intersects a segment',
              durationSec: 70,
              paceSecPerKm: 175,
              startOffsetSec: 0,
              endOffsetSec: 70,
            },
          }),
        ],
      }),
      makeActivity({
        activityId: '1002',
        efforts: [
          makeNewEffort({
            distance: '400m',
            durationSec: 200,
            demotion: { guard: 'unreliable-segment', reason: 'no clean window covers the distance' },
          }),
        ],
      }),
      makeActivity({
        activityId: '1003',
        efforts: [makeNewEffort({ distance: '400m', durationSec: 95, demotion: null })],
      }),
      makeActivity({
        activityId: '1004',
        efforts: [makeNewEffort({ distance: '400m', durationSec: 100, demotion: null })],
      }),
    ]);

    const oldEfforts = [
      // OLD ranked (demotion null), NEW ranked with contaminated populated -> moved-but-ranked.
      makeOldEffort({ activityId: '1001', distance: '400m', durationSec: 90, demotion: null }),
      // OLD ranked, NEW demoted -> newly-demoted.
      makeOldEffort({ activityId: '1002', distance: '400m', durationSec: 200, demotion: null }),
      // OLD demoted (world-record), NEW ranked -> reinstated.
      makeOldEffort({
        activityId: '1003',
        distance: '400m',
        durationSec: 999,
        demotion: { guard: 'world-record', reason: 'implied too fast' },
      }),
      // OLD ranked, NEW ranked, nothing changed -> unchanged.
      makeOldEffort({ activityId: '1004', distance: '400m', durationSec: 100, demotion: null }),
    ];

    const changes = classifyEffortChanges(newDoc, oldEfforts);
    const byActivity = Object.fromEntries(changes.map((c) => [c.activityId, c]));

    expect(byActivity['1001'].kind).toBe('moved-but-ranked');
    expect(byActivity['1002'].kind).toBe('newly-demoted');
    expect(byActivity['1003'].kind).toBe('reinstated');
    expect(byActivity['1004'].kind).toBe('unchanged');

    // Each record falls into exactly one kind.
    const kinds = ['moved-but-ranked', 'newly-demoted', 'reinstated', 'unchanged'];
    for (const change of changes) {
      const matches = kinds.filter((k) => k === change.kind);
      expect(matches.length).toBe(1);
    }
  });

  it('fails closed (throws) on a deliberately ambiguous pair: two OLD records for one activity/distance key', () => {
    const newDoc = makeNewDoc([
      makeActivity({
        activityId: '2001',
        efforts: [makeNewEffort({ distance: '400m', durationSec: 90, demotion: null })],
      }),
    ]);
    const oldEfforts = [
      makeOldEffort({ activityId: '2001', distance: '400m', durationSec: 90, demotion: null }),
      // Deliberately duplicate: a second, conflicting OLD record for the same key.
      makeOldEffort({
        activityId: '2001',
        distance: '400m',
        durationSec: 999,
        demotion: { guard: 'world-record', reason: 'conflicting reconstruction' },
      }),
    ];

    // The generator FAILS CLOSED rather than silently picking the first match.
    expect(() => classifyEffortChanges(newDoc, oldEfforts)).toThrow(/duplicate OLD record/);
  });
});

// ---------------------------------------------------------------------------
// b. REINSTATEMENT SPLIT
// ---------------------------------------------------------------------------

describe('splitReinstatements', () => {
  it('splits absolute-guard and ceiling reinstatements, retaining the OLD guard name in each row', () => {
    const changes = [
      { activityId: 'a', distance: '400m', kind: 'reinstated', oldGuard: 'max-speed', oldReason: 'exceeded max speed' },
      { activityId: 'b', distance: '400m', kind: 'reinstated', oldGuard: 'world-record', oldReason: 'exceeded WR pace' },
      { activityId: 'c', distance: '1k', kind: 'reinstated', oldGuard: 'ceiling', oldReason: 'exceeded ceiling' },
      { activityId: 'd', distance: '1k', kind: 'moved-but-ranked', oldGuard: null, oldReason: null },
    ];

    const { absoluteGuard, ceiling } = splitReinstatements(changes);

    expect(absoluteGuard.map((c) => c.activityId).sort()).toEqual(['a', 'b']);
    expect(absoluteGuard.every((c) => c.oldGuard === 'max-speed' || c.oldGuard === 'world-record')).toBe(true);
    expect(ceiling.map((c) => c.activityId)).toEqual(['c']);
    expect(ceiling[0].oldGuard).toBe('ceiling');
  });
});

// ---------------------------------------------------------------------------
// c. RANK CHANGES — OLD ranking reached through markPRs/rankTopN
// ---------------------------------------------------------------------------

describe('buildRankChanges', () => {
  it('emits a row when a faster activity moves behind a slower one, matching a hand-computed OLD ordering', () => {
    const newDoc = {
      activities: {
        A: { activityId: 'A', startDate: '2024-01-01T00:00:00Z', efforts: [] },
        B: { activityId: 'B', startDate: '2024-02-01T00:00:00Z', efforts: [] },
      },
      rankings: {
        '400m': [
          { rank: 1, activityId: 'B', startDate: '2024-02-01T00:00:00Z', durationSec: 80, paceSecPerKm: 200, lowConfidence: false },
          { rank: 2, activityId: 'A', startDate: '2024-01-01T00:00:00Z', durationSec: 95, paceSecPerKm: 237.5, lowConfidence: false },
        ],
      },
    };
    for (const distance of TARGET_ORDER) {
      if (distance !== '400m') newDoc.rankings[distance] = [];
    }

    // A was 70s (faster), B was 80s (slower) — OLD ordering: rank 1 = A, rank 2 = B.
    // Hand-computed: 70 < 80, so A ranks ahead of B. This is the ordering
    // rankTopN (fastest-first) must produce from this OLD population.
    const oldEfforts = [
      makeOldEffort({ activityId: 'A', distance: '400m', durationSec: 70, demotion: null }),
      makeOldEffort({ activityId: 'B', distance: '400m', durationSec: 80, demotion: null }),
    ];

    const rankChanges = buildRankChanges(newDoc, oldEfforts);

    expect(rankChanges['400m']).toEqual([
      { rank: 1, oldActivityId: 'A', newActivityId: 'B', oldDurationSec: 70, newDurationSec: 80 },
      { rank: 2, oldActivityId: 'B', newActivityId: 'A', oldDurationSec: 80, newDurationSec: 95 },
    ]);
  });

  it('produces no rows for a distance whose top-10 is unchanged between OLD and NEW', () => {
    const newDoc = {
      activities: {
        A: { activityId: 'A', startDate: '2024-01-01T00:00:00Z', efforts: [] },
      },
      rankings: {
        '1k': [{ rank: 1, activityId: 'A', startDate: '2024-01-01T00:00:00Z', durationSec: 200, paceSecPerKm: 200, lowConfidence: false }],
      },
    };
    for (const distance of TARGET_ORDER) {
      if (distance !== '1k') newDoc.rankings[distance] = [];
    }
    const oldEfforts = [makeOldEffort({ activityId: 'A', distance: '1k', durationSec: 200, demotion: null })];

    const rankChanges = buildRankChanges(newDoc, oldEfforts);
    expect(rankChanges['1k']).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// d. INTERNAL RECONCILIATION — both directions
// ---------------------------------------------------------------------------

describe('reconcileCounts', () => {
  it('reports agreement on both checks when the lists and the walked counts match', () => {
    const changes = [
      { kind: 'newly-demoted', newGuard: 'unreliable-segment' },
      { kind: 'moved-but-ranked' },
    ];
    const guardCounts = { totals: { 'unreliable-segment': 1, contaminated: 1 } };

    const rows = reconcileCounts(changes, guardCounts);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.agrees)).toBe(true);
  });

  it('reports a disagreement (never throws) when a contaminated effort is omitted from the lists, naming both figures', () => {
    const changes = [
      { kind: 'newly-demoted', newGuard: 'unreliable-segment' },
      // Deliberately NO 'moved-but-ranked' record here, even though the
      // walked document below claims 5 contaminated efforts exist.
    ];
    const guardCounts = { totals: { 'unreliable-segment': 1, contaminated: 5 } };

    const rows = reconcileCounts(changes, guardCounts);
    const movedRow = rows.find((r) => r.check.includes('moved-but-ranked'));
    expect(movedRow).toBeDefined();
    expect(movedRow.agrees).toBe(false);
    expect(movedRow.listsFigure).toBe(0);
    expect(movedRow.walkedFigure).toBe(5);

    // The sibling check (unreliable-segment) still agrees — a disagreement in
    // one check must not corrupt the other.
    const segmentRow = rows.find((r) => r.check.includes('unreliable-segment'));
    expect(segmentRow.agrees).toBe(true);
  });

  it('renders a disagreeing reconciliation row into the markdown rather than hiding it', () => {
    const report = baseReport({
      reconciliation: [
        {
          check: "'moved-but-ranked' record count vs the walked contaminated-effort count",
          listsFigure: 10,
          walkedFigure: 15,
          agrees: false,
        },
      ],
    });
    const markdown = renderDiffMarkdown(report);
    expect(markdown).toContain('| 10 | 15 | NO |');
    expect(markdown.toLowerCase()).toContain('disagree');
  });
});

// ---------------------------------------------------------------------------
// e. RENDERER IDEMPOTENCE
// ---------------------------------------------------------------------------

describe('renderDiffMarkdown idempotence', () => {
  it('is byte-identical across two calls over an unchanged report', () => {
    const report = baseReport();
    const first = renderDiffMarkdown(report);
    const second = renderDiffMarkdown(report);
    expect(second).toBe(first);
    expect(first).toContain('**Generated:** 2020-01-01T00:00:00.000Z');
  });

  it('the renderer function body contains no new Date( call, so it cannot itself break idempotence', () => {
    const source = readFileSync(GENERATOR_PATH, 'utf8');
    const start = source.indexOf('export function renderDiffMarkdown');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('\n}\n', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).not.toContain('new Date(');
  });
});

// ---------------------------------------------------------------------------
// f. TABLE SAFETY
// ---------------------------------------------------------------------------

describe('table safety', () => {
  it('renders a malformed activity id as (malformed id)', () => {
    const report = baseReport({
      changes: [
        {
          activityId: 'not-an-id',
          distance: '400m',
          oldDurationSec: 100,
          newDurationSec: 90,
          oldPaceSecPerKm: 250,
          newPaceSecPerKm: 225,
          oldGuard: null,
          oldReason: null,
          newGuard: 'unreliable-segment',
          newReason: 'no clean window covers the distance',
          contaminatedReason: null,
          kind: 'newly-demoted',
        },
      ],
    });
    const markdown = renderDiffMarkdown(report);
    expect(markdown).toContain('(malformed id)');
  });

  it('sanitizes an injected pipe/newline/CR in a reason string without changing the rendered line count', () => {
    const makeReportWithReason = (reason) =>
      baseReport({
        changes: [
          {
            activityId: '123456',
            distance: '400m',
            oldDurationSec: 100,
            newDurationSec: 90,
            oldPaceSecPerKm: 250,
            newPaceSecPerKm: 225,
            oldGuard: null,
            oldReason: null,
            newGuard: 'unreliable-segment',
            newReason: reason,
            contaminatedReason: null,
            kind: 'newly-demoted',
          },
        ],
      });

    const cleanMarkdown = renderDiffMarkdown(makeReportWithReason('no clean window because reasons'));
    const injectedMarkdown = renderDiffMarkdown(makeReportWithReason('no clean window | injected\r\nmore text'));

    expect(injectedMarkdown.split('\n').length).toBe(cleanMarkdown.split('\n').length);
    expect(injectedMarkdown).not.toContain('\r');
    expect(injectedMarkdown).not.toMatch(/injected\r?\nmore/);
  });
});

// ---------------------------------------------------------------------------
// g. CAP BEHAVIOUR — Moved But Still Ranked
// ---------------------------------------------------------------------------

describe('cap behaviour — Moved But Still Ranked', () => {
  it('caps the rendered table, shows a trailing remainder count, and states the FULL count above the table', () => {
    const total = MOVED_BUT_RANKED_RENDER_CAP + 10;
    const changes = Array.from({ length: total }, (_, i) => ({
      activityId: String(1000000 + i),
      distance: '400m',
      oldDurationSec: 100 + i,
      newDurationSec: 90 + i,
      oldPaceSecPerKm: 250,
      newPaceSecPerKm: 225,
      oldGuard: null,
      oldReason: null,
      newGuard: null,
      newReason: null,
      contaminatedReason: 'segment intersection',
      kind: 'moved-but-ranked',
    }));

    const report = baseReport({ changes });
    const markdown = renderDiffMarkdown(report);

    expect(markdown).toContain(`Full count: ${total}.`);
    const remainder = total - MOVED_BUT_RANKED_RENDER_CAP;
    expect(markdown).toContain(`+${remainder} more (full count ${total}`);

    const sectionStart = markdown.indexOf('## Moved But Still Ranked');
    const sectionEnd = markdown.indexOf('\n## ', sectionStart + 1);
    const section = markdown.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);
    const dataRows = section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Activity ID'));
    expect(dataRows.length).toBe(MOVED_BUT_RANKED_RENDER_CAP);
  });
});

// ---------------------------------------------------------------------------
// h. CEILING CROSS-CHECK — both directions
// ---------------------------------------------------------------------------

describe('crossCheckCeilingAgainstRecalibration', () => {
  const ceilingTable = [
    {
      distance: '400m',
      oldCeilingMps: 5.1098,
      newCeilingMps: 5.0295,
      oldP90Mps: 3.992,
      newP90Mps: 3.9293,
      oldPopulationN: 1834,
      newPopulationN: 1858,
      failOpenReason: null,
    },
  ];

  function makeRecalibrationText(afterCeiling) {
    return [
      '## Headline: per-distance ceiling before -> after',
      '',
      '| Distance | Ceiling before (m/s) | Ceiling after (m/s) | Delta | Movement | Population before -> after |',
      '|---|---|---|---|---|---|',
      `| 400m | 5.1098 | ${afterCeiling} | -0.0803 | fell | 1834 -> 1858 |`,
      '',
      '## Per-distance detail',
    ].join('\n');
  }

  it('reports a disagreement row when a figure differs from the recalibration artifact', () => {
    const result = crossCheckCeilingAgainstRecalibration(ceilingTable, makeRecalibrationText('5.9999'));
    expect(result.available).toBe(true);
    expect(result.rows[0].agrees).toBe(false);
  });

  it('reports agreement when every figure matches', () => {
    const result = crossCheckCeilingAgainstRecalibration(ceilingTable, makeRecalibrationText('5.0295'));
    expect(result.available).toBe(true);
    expect(result.rows[0].agrees).toBe(true);
  });

  it('renders the disagreement into the markdown rather than absorbing it, and an explicit agreement statement otherwise', () => {
    const disagreeing = crossCheckCeilingAgainstRecalibration(ceilingTable, makeRecalibrationText('5.9999'));
    const disagreeingMarkdown = renderDiffMarkdown(baseReport({ ceilingTable, ceilingCrossCheck: disagreeing }));
    expect(disagreeingMarkdown).toContain('DISAGREE');

    const agreeing = crossCheckCeilingAgainstRecalibration(ceilingTable, makeRecalibrationText('5.0295'));
    const agreeingMarkdown = renderDiffMarkdown(baseReport({ ceilingTable, ceilingCrossCheck: agreeing }));
    expect(agreeingMarkdown).toContain('Every figure above agrees with');
  });
});
