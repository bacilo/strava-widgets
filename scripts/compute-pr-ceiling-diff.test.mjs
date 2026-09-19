/**
 * Guard test for the pure functions exported by compute-pr-ceiling-diff.mjs
 * (Phase 28 plan 07, PR-04/D-12). Importing this module must not run the
 * archive sweep or write 28-DIFF.md — if it does, the self-execution guard
 * documented at the bottom of compute-pr-ceiling-diff.mjs is wrong and must
 * be fixed rather than worked around here. No fixture in this file reads any
 * committed archive directory under the repo's top-level `data` folder —
 * every `newDoc` below is hand-built.
 */

import { describe, expect, it } from 'vitest';

import { TARGET_ORDER } from '../dist/analytics/best-effort.types.js';
import { markPRs, rankTopN } from '../dist/analytics/best-effort-utils.js';

import {
  buildDiffReport,
  diffPrState,
  extractNewState,
  reconstructOldDocument,
  renderDiffMarkdown,
} from './compute-pr-ceiling-diff.mjs';

/** Minimal `ComputedEffort`/`BestEffort`-shaped fixture builder. */
function makeEffort({
  distance = '400m',
  durationSec,
  demotion = null,
  wasPRAtTheTime = false,
  excludedFromRecords = false,
}) {
  return {
    distance,
    durationSec,
    paceSecPerKm: durationSec,
    startOffsetSec: 0,
    endOffsetSec: durationSec,
    lowConfidence: false,
    demotion,
    wasPRAtTheTime,
    excludedFromRecords,
  };
}

function makeActivity({ activityId, startDate, efforts, excludedFromRecords = false }) {
  return { activityId, startDate, distanceSource: 'native', efforts, excludedFromRecords };
}

/** Empty per-distance shape for every `TARGET_ORDER` key, for report fixtures. */
function emptyPerDistance() {
  const perDistance = {};
  for (const key of TARGET_ORDER) {
    perDistance[key] = {
      rankingRows: [],
      flagFlips: [],
      flagsBefore: 0,
      flagsAfter: 0,
      flagsFlipped: 0,
      demotedCount: 0,
      demotedExcludedCount: 0,
      netZeroButMoved: false,
    };
  }
  return perDistance;
}

function emptyCeilings() {
  const ceilings = {};
  for (const key of TARGET_ORDER) {
    ceilings[key] = { distance: key, populationN: 0, p90Mps: null, multiplier: 1.28, ceilingMps: null, failOpenReason: 'no data' };
  }
  return ceilings;
}

describe('reconstructOldDocument', () => {
  it('retains ceiling-demoted and clean efforts; drops world-record/max-speed/excluded ones, asserted per effort', () => {
    const newDoc = {
      totals: { activitiesConsidered: 6, effortsDemoted: 3 },
      ceilings: {},
      rankings: { '400m': [] },
      activities: {
        wr1: makeActivity({
          activityId: 'wr1',
          startDate: '2020-01-01T00:00:00Z',
          efforts: [makeEffort({ durationSec: 100, demotion: { guard: 'world-record', reason: 'r' } })],
        }),
        ms1: makeActivity({
          activityId: 'ms1',
          startDate: '2020-01-02T00:00:00Z',
          efforts: [makeEffort({ durationSec: 101, demotion: { guard: 'max-speed', reason: 'r' } })],
        }),
        ceil1: makeActivity({
          activityId: 'ceil1',
          startDate: '2020-01-03T00:00:00Z',
          efforts: [makeEffort({ durationSec: 102, demotion: { guard: 'ceiling', reason: 'r' } })],
        }),
        exclEffort1: makeActivity({
          activityId: 'exclEffort1',
          startDate: '2020-01-04T00:00:00Z',
          efforts: [makeEffort({ durationSec: 103, excludedFromRecords: true })],
        }),
        clean1: makeActivity({
          activityId: 'clean1',
          startDate: '2020-01-05T00:00:00Z',
          efforts: [makeEffort({ durationSec: 104 })],
        }),
        clean2: makeActivity({
          activityId: 'clean2',
          startDate: '2020-01-06T00:00:00Z',
          efforts: [makeEffort({ durationSec: 105 })],
        }),
      },
    };

    const { rankings, prFlags } = reconstructOldDocument(newDoc);
    const retainedIds = rankings['400m'].map((r) => r.activityId);

    // Per-effort membership assertions — not a count, so a rule inversion
    // (e.g. dropping ceiling instead of retaining it) cannot pass by
    // accidentally matching the same total.
    expect(retainedIds).toContain('ceil1');
    expect(retainedIds).toContain('clean1');
    expect(retainedIds).toContain('clean2');
    expect(retainedIds).not.toContain('wr1');
    expect(retainedIds).not.toContain('ms1');
    expect(retainedIds).not.toContain('exclEffort1');

    expect(prFlags['ceil1|400m']).toBeDefined();
    expect(prFlags['clean1|400m']).toBeDefined();
    expect(prFlags['clean2|400m']).toBeDefined();
    expect(prFlags['wr1|400m']).toBeUndefined();
    expect(prFlags['ms1|400m']).toBeUndefined();
    expect(prFlags['exclEffort1|400m']).toBeUndefined();
  });

  it('WR-04: a distance-scoped exclusion drops only the excluded distance, retaining a non-excluded effort of the same activity', () => {
    // The owner excluded only this activity's 400m effort; the pipeline sets
    // effort.excludedFromRecords per distance while activity.excludedFromRecords
    // is true for the whole activity (compute-best-efforts.ts:317). The OLD
    // reconstruction must key off the per-effort flag only, never the
    // activity-level one, or it drops the whole activity and loses the 5k effort.
    const newDoc = {
      totals: { activitiesConsidered: 1, effortsDemoted: 0 },
      ceilings: {},
      rankings: { '400m': [], '5k': [] },
      activities: {
        partial: makeActivity({
          activityId: 'partial',
          startDate: '2020-01-01T00:00:00Z',
          excludedFromRecords: true,
          efforts: [
            makeEffort({ distance: '400m', durationSec: 60, excludedFromRecords: true }),
            makeEffort({ distance: '5k', durationSec: 1200, excludedFromRecords: false }),
          ],
        }),
      },
    };

    const { rankings } = reconstructOldDocument(newDoc);
    expect(rankings['400m'].map((r) => r.activityId)).not.toContain('partial');
    expect(rankings['5k'].map((r) => r.activityId)).toContain('partial');
  });
});

/**
 * Builds the load-bearing D-12 fixture: three chronological '5k' efforts
 * where the middle one (B) is the fastest. `demoteB` toggles whether B
 * carries a ceiling demotion in the NEW document — the positive case is the
 * net-zero-count retroactive promotion; the negative control (demoteB:
 * false) proves `netZeroButMoved` actually discriminates rather than always
 * reading true.
 */
function buildRetroactivePromotionFixture(demoteB) {
  const bDemotion = demoteB ? { guard: 'ceiling', reason: 'r' } : null;
  // Under OLD (B always retained, demoted or not): chronological A(1000),
  // B(500), C(800) -> A PR (bestSoFar 1000), B PR (500 < 1000), C not PR
  // (800 not < 500). Under NEW when B is demoted: A(1000) PR, C(800) PR
  // (800 < 1000) since B is absent from NEW's marked population. When B is
  // NOT demoted, NEW matches OLD exactly (nothing removed): A PR, B PR, C
  // not PR.
  const newDoc = {
    totals: { activitiesConsidered: 3, effortsDemoted: demoteB ? 1 : 0 },
    ceilings: {},
    rankings: { '5k': [] },
    activities: {
      a: makeActivity({
        activityId: 'a',
        startDate: '2020-01-01T00:00:00Z',
        efforts: [makeEffort({ distance: '5k', durationSec: 1000, demotion: null, wasPRAtTheTime: true })],
      }),
      b: makeActivity({
        activityId: 'b',
        startDate: '2020-02-01T00:00:00Z',
        efforts: [
          makeEffort({
            distance: '5k',
            durationSec: 500,
            demotion: bDemotion,
            wasPRAtTheTime: !demoteB, // demoted -> never marked in NEW; not demoted -> PR
          }),
        ],
      }),
      c: makeActivity({
        activityId: 'c',
        startDate: '2020-03-01T00:00:00Z',
        efforts: [
          makeEffort({
            distance: '5k',
            durationSec: 800,
            demotion: null,
            wasPRAtTheTime: demoteB, // only becomes PR once B is removed from the chain
          }),
        ],
      }),
    },
  };
  return newDoc;
}

describe('diffPrState — net-zero-count retroactive promotion (D-12, the 1mi-shaped case)', () => {
  it('flags B lost (demoted) and C gained (knock-on), net count unchanged, netZeroButMoved true', () => {
    const newDoc = buildRetroactivePromotionFixture(true);
    const oldState = reconstructOldDocument(newDoc);
    const newState = extractNewState(newDoc);
    const { perDistance } = diffPrState(oldState, newState);
    const d = perDistance['5k'];

    expect(d.flagsBefore).toBe(d.flagsAfter);
    expect(d.flagsBefore).toBe(2);
    expect(d.flagsFlipped).toBe(2);
    expect(d.netZeroButMoved).toBe(true);

    const lost = d.flagFlips.filter((f) => f.direction === 'lost');
    const gained = d.flagFlips.filter((f) => f.direction === 'gained');
    expect(lost).toHaveLength(1);
    expect(gained).toHaveLength(1);
    expect(lost[0].activityId).toBe('b');
    expect(lost[0].demoted).toBe(true);
    expect(gained[0].activityId).toBe('c');
    expect(gained[0].demoted).toBe(false);
  });

  it('negative control: the same fixture with no demotion produces zero flips and netZeroButMoved false', () => {
    const newDoc = buildRetroactivePromotionFixture(false);
    const oldState = reconstructOldDocument(newDoc);
    const newState = extractNewState(newDoc);
    const { perDistance } = diffPrState(oldState, newState);
    const d = perDistance['5k'];

    expect(d.flagsFlipped).toBe(0);
    expect(d.flagFlips).toEqual([]);
    expect(d.netZeroButMoved).toBe(false);
  });
});

/**
 * Builds an 11-activity '10k' ranking-movement fixture: `r1` is fastest and
 * ceiling-demoted in NEW; `r2..r11` are clean. OLD's top-10 is r1..r10;
 * NEW's top-10 (r1 removed) is r2..r11 — r2..r10 each move up one rank, r1
 * is removed, and r11 (old rank 11, outside the old top-10) enters.
 * `idOrder` controls the insertion order of `activities`' keys, for the
 * insertion-order-independence assertion.
 */
function buildRankingMovementFixture(idOrder) {
  const durations = { r1: 100, r2: 101, r3: 102, r4: 103, r5: 104, r6: 105, r7: 106, r8: 107, r9: 108, r10: 109, r11: 110 };
  const population = Object.keys(durations).map((id, i) => ({
    activityId: id,
    startDate: `2020-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    durationSec: durations[id],
    paceSecPerKm: durations[id],
    lowConfidence: false,
  }));

  const oldTop10 = rankTopN(population); // r1..r10, ranks 1-10 (r11 excluded)
  const survivorsPopulation = population.filter((e) => e.activityId !== 'r1');
  const newTop10 = rankTopN(survivorsPopulation); // r2..r11, ranks 1-10
  const withPR = markPRs(survivorsPopulation);
  const wasPRById = new Map(withPR.map((e) => [e.activityId, e.wasPRAtTheTime]));

  const activities = {};
  for (const id of idOrder) {
    const durationSec = durations[id];
    const demotion = id === 'r1' ? { guard: 'ceiling', reason: 'r' } : null;
    const entry = population.find((e) => e.activityId === id);
    activities[id] = makeActivity({
      activityId: id,
      startDate: entry.startDate,
      efforts: [
        makeEffort({
          distance: '10k',
          durationSec,
          demotion,
          wasPRAtTheTime: id === 'r1' ? false : (wasPRById.get(id) ?? false),
        }),
      ],
    });
  }

  return {
    totals: { activitiesConsidered: 11, effortsDemoted: 1 },
    ceilings: {},
    rankings: { '10k': newTop10 },
    activities,
    _oldTop10ForReference: oldTop10, // test-only convenience, not read by the module
  };
}

describe('diffPrState — ranking movement', () => {
  it('one removed row, one entered row, and moved-up rows with correct old and new ranks', () => {
    const idOrder = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
    const newDoc = buildRankingMovementFixture(idOrder);
    const oldState = reconstructOldDocument(newDoc);
    const newState = extractNewState(newDoc);
    const { perDistance } = diffPrState(oldState, newState);
    const rows = perDistance['10k'].rankingRows;

    const removed = rows.filter((r) => r.movement === 'removed');
    const entered = rows.filter((r) => r.movement === 'entered');
    const movedUp = rows.filter((r) => r.movement === 'moved-up');

    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({ activityId: 'r1', oldRank: 1, newRank: null });

    expect(entered).toHaveLength(1);
    expect(entered[0]).toMatchObject({ activityId: 'r11', oldRank: null, newRank: 10 });

    expect(movedUp).toHaveLength(9); // r2..r10
    for (const row of movedUp) {
      expect(row.newRank).toBe(row.oldRank - 1);
    }
  });
});

describe('diffPrState — no-change control', () => {
  it('identical old and new states yield empty rankingRows, empty flagFlips, and all totals zero', () => {
    const population = [
      { activityId: 'a1', startDate: '2020-01-01T00:00:00Z', durationSec: 300, paceSecPerKm: 300, lowConfidence: false },
      { activityId: 'a2', startDate: '2020-02-01T00:00:00Z', durationSec: 310, paceSecPerKm: 310, lowConfidence: false },
    ];
    const withPR = markPRs(population);
    const top10 = rankTopN(population);

    const activities = {};
    for (const entry of withPR) {
      activities[entry.activityId] = makeActivity({
        activityId: entry.activityId,
        startDate: entry.startDate,
        efforts: [
          makeEffort({
            distance: '5k',
            durationSec: entry.durationSec,
            demotion: null,
            wasPRAtTheTime: entry.wasPRAtTheTime,
          }),
        ],
      });
    }

    const newDoc = {
      totals: { activitiesConsidered: 2, effortsDemoted: 0 },
      ceilings: {},
      rankings: { '5k': top10 },
      activities,
    };

    const oldState = reconstructOldDocument(newDoc);
    const newState = extractNewState(newDoc);
    const { perDistance, totals } = diffPrState(oldState, newState);

    expect(perDistance['5k'].rankingRows).toEqual([]);
    expect(perDistance['5k'].flagFlips).toEqual([]);
    expect(totals).toEqual({
      totalDemoted: 0,
      totalFlagFlips: 0,
      totalRetroactivePromotions: 0,
      totalRankingRowsMoved: 0,
      totalDemotedExcluded: 0,
    });
  });
});

describe('diffPrState — demotedExcludedCount / totalDemotedExcluded', () => {
  it('counts a ceiling-demoted, owner-excluded NEW effort separately from the plain demotedCount', () => {
    const newDoc = {
      totals: { activitiesConsidered: 2, effortsDemoted: 1 },
      ceilings: {},
      rankings: { '400m': [] },
      activities: {
        demotedExcluded: makeActivity({
          activityId: 'demotedExcluded',
          startDate: '2020-01-01T00:00:00Z',
          excludedFromRecords: true,
          efforts: [
            makeEffort({
              distance: '400m',
              durationSec: 45,
              demotion: { guard: 'ceiling', reason: 'r' },
              excludedFromRecords: true,
            }),
          ],
        }),
        demotedNotExcluded: makeActivity({
          activityId: 'demotedNotExcluded',
          startDate: '2020-01-02T00:00:00Z',
          efforts: [
            makeEffort({
              distance: '400m',
              durationSec: 46,
              demotion: { guard: 'ceiling', reason: 'r' },
            }),
          ],
        }),
      },
    };

    const oldState = reconstructOldDocument(newDoc);
    const newState = extractNewState(newDoc);
    const { perDistance, totals } = diffPrState(oldState, newState);

    expect(perDistance['400m'].demotedCount).toBe(2);
    expect(perDistance['400m'].demotedExcludedCount).toBe(1);
    expect(totals.totalDemotedExcluded).toBe(1);
  });
});

describe('buildDiffReport — ceilingDemotedExcluded', () => {
  function makeCeilingExcludedDoc() {
    return {
      totals: { activitiesConsidered: 3, effortsDemoted: 2 },
      ceilings: {
        '400m': { distance: '400m', populationN: 1800, p90Mps: 4.0, multiplier: 1.28, ceilingMps: 5.1098, failOpenReason: null },
        '1k': { distance: '1k', populationN: 1800, p90Mps: 3.7, multiplier: 1.28, ceilingMps: 4.7513, failOpenReason: null },
      },
      rankings: { '400m': [], '1k': [] },
      activities: {
        // 400m owner-excluded ceiling demotion, real activity id
        4556693525: makeActivity({
          activityId: '4556693525',
          startDate: '2020-01-01T00:00:00Z',
          excludedFromRecords: true,
          efforts: [
            makeEffort({
              distance: '400m',
              durationSec: 45.2,
              demotion: { guard: 'ceiling', reason: 'r' },
              excludedFromRecords: true,
            }),
          ],
        }),
        // 1k owner-excluded ceiling demotion, earlier in TARGET_ORDER's own
        // distance position but a "later" activityId, to prove the sort is
        // TARGET_ORDER index first, then activityId.
        1000000001: makeActivity({
          activityId: '1000000001',
          startDate: '2020-01-02T00:00:00Z',
          excludedFromRecords: true,
          efforts: [
            makeEffort({
              distance: '1k',
              durationSec: 200,
              demotion: { guard: 'ceiling', reason: 'r' },
              excludedFromRecords: true,
            }),
          ],
        }),
        // A ceiling demotion that is NOT excluded — must not appear.
        clean1: makeActivity({
          activityId: 'clean1',
          startDate: '2020-01-03T00:00:00Z',
          efforts: [
            makeEffort({
              distance: '400m',
              durationSec: 47,
              demotion: { guard: 'ceiling', reason: 'r' },
            }),
          ],
        }),
      },
    };
  }

  it('lists one row per ceiling-demoted, owner-excluded NEW effort, sorted by TARGET_ORDER then activityId', () => {
    const report = buildDiffReport(makeCeilingExcludedDoc());
    expect(report.ceilingDemotedExcluded).toHaveLength(2);
    // 400m precedes 1k in TARGET_ORDER
    expect(report.ceilingDemotedExcluded[0]).toMatchObject({
      activityId: '4556693525',
      distance: '400m',
      durationSec: 45.2,
      ceilingMps: 5.1098,
      reason: 'r',
    });
    expect(report.ceilingDemotedExcluded[0].impliedSpeedMps).toBeCloseTo(400 / 45.2, 6);
    expect(report.ceilingDemotedExcluded[1]).toMatchObject({
      activityId: '1000000001',
      distance: '1k',
      durationSec: 200,
      ceilingMps: 4.7513,
      reason: 'r',
    });
    expect(report.ceilingDemotedExcluded[1].impliedSpeedMps).toBeCloseTo(1000 / 200, 6);
  });

  it('excludes a ceiling-demoted effort that is not owner-excluded', () => {
    const report = buildDiffReport(makeCeilingExcludedDoc());
    expect(report.ceilingDemotedExcluded.some((row) => row.activityId === 'clean1')).toBe(false);
  });

  it('returns an empty array when no ceiling demotion is owner-excluded', () => {
    const newDoc = {
      totals: { activitiesConsidered: 1, effortsDemoted: 0 },
      ceilings: {},
      rankings: { '400m': [] },
      activities: {
        clean1: makeActivity({
          activityId: 'clean1',
          startDate: '2020-01-01T00:00:00Z',
          efforts: [makeEffort({ distance: '400m', durationSec: 60 })],
        }),
      },
    };
    const report = buildDiffReport(newDoc);
    expect(report.ceilingDemotedExcluded).toEqual([]);
  });
});

describe('diffPrState — determinism', () => {
  it('the same input produces deeply equal reports across two calls', () => {
    const idOrder = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
    const newDoc = buildRankingMovementFixture(idOrder);
    const oldState = reconstructOldDocument(newDoc);
    const newState = extractNewState(newDoc);

    const first = diffPrState(oldState, newState);
    const second = diffPrState(oldState, newState);

    expect(second).toEqual(first);
  });

  it('a different activity-id insertion order still returns identically ordered flagFlips and rankingRows', () => {
    const forwardOrder = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
    const reverseOrder = [...forwardOrder].reverse();

    const docForward = buildRankingMovementFixture(forwardOrder);
    const docReverse = buildRankingMovementFixture(reverseOrder);

    const diffForward = diffPrState(
      reconstructOldDocument(docForward),
      extractNewState(docForward)
    );
    const diffReverse = diffPrState(
      reconstructOldDocument(docReverse),
      extractNewState(docReverse)
    );

    expect(diffReverse.perDistance['10k'].rankingRows).toEqual(diffForward.perDistance['10k'].rankingRows);
    expect(diffReverse.perDistance['10k'].flagFlips).toEqual(diffForward.perDistance['10k'].flagFlips);
  });
});

describe('renderDiffMarkdown', () => {
  function baseReport(overrides = {}) {
    return {
      generatedAt: '2026-01-01T00:00:00.000Z',
      archiveSize: 1865,
      documentDemotedTotal: 52,
      ceilings: emptyCeilings(),
      perDistance: emptyPerDistance(),
      totals: {
        totalDemoted: 0,
        totalFlagFlips: 0,
        totalRetroactivePromotions: 0,
        totalRankingRowsMoved: 0,
        totalDemotedExcluded: 0,
      },
      ceilingK: 1.28,
      ceilingMinPopulation: 100,
      ceilingDemotedExcluded: [],
      ...overrides,
    };
  }

  it('called twice with the same report object returns identical strings', () => {
    const report = baseReport();
    expect(renderDiffMarkdown(report)).toBe(renderDiffMarkdown(report));
  });

  it('a report differing only in generatedAt produces identical output once the Generated line is stripped', () => {
    const reportA = baseReport({ generatedAt: '2026-01-01T00:00:00.000Z' });
    const reportB = baseReport({ generatedAt: '2026-06-15T12:34:56.000Z' });

    const strip = (md) => md.split('\n').filter((line) => !line.startsWith('**Generated:**')).join('\n');

    expect(strip(renderDiffMarkdown(reportA))).toBe(strip(renderDiffMarkdown(reportB)));
  });

  it('emits the Retroactive promotions heading with an explicit none statement when the list is empty', () => {
    const report = baseReport(); // zero flips everywhere -> zero retroactive promotions
    const markdown = renderDiffMarkdown(report);

    expect(markdown).toContain('## Retroactive promotions');
    const sectionStart = markdown.indexOf('## Retroactive promotions');
    const nextSectionStart = markdown.indexOf('## Reconciliation');
    const section = markdown.slice(sectionStart, nextSectionStart);
    expect(section).toMatch(/None in this run/);
  });

  it('renders a populated retroactive-promotions section when a gained flip exists', () => {
    const perDistance = emptyPerDistance();
    perDistance['1mi'] = {
      rankingRows: [],
      flagFlips: [{ activityId: '9000000001', distance: '1mi', direction: 'gained', durationSec: 800, demoted: false }],
      flagsBefore: 2,
      flagsAfter: 2,
      flagsFlipped: 1,
      demotedCount: 1,
      demotedExcludedCount: 0,
      netZeroButMoved: true,
    };
    const report = baseReport({
      perDistance,
      totals: {
        totalDemoted: 1,
        totalFlagFlips: 1,
        totalRetroactivePromotions: 1,
        totalRankingRowsMoved: 0,
        totalDemotedExcluded: 0,
      },
    });

    const markdown = renderDiffMarkdown(report);
    expect(markdown).toContain('| 9000000001 | 1mi | 800.0 |');
    expect(markdown).toMatch(/net-zero-count distance/);
  });

  it('writes no sign-off text', () => {
    const markdown = renderDiffMarkdown(baseReport());
    expect(markdown).not.toMatch(/signed off|approved by|reviewer:/i);
  });

  it('emits the owner-excluded Summary bullet, the new table column, and the new section with "None in this run." when ceilingDemotedExcluded is empty', () => {
    const report = baseReport({ ceilingDemotedExcluded: [] });
    const markdown = renderDiffMarkdown(report);

    expect(markdown).toContain('Of those, also owner-excluded (no ranking effect): 0');
    expect(markdown).toContain(
      '| Distance | Ceiling (m/s) | Demoted (ceiling) | Of which owner-excluded | Flags before | Flags after | Flags flipped |'
    );
    expect(markdown).toContain('## Ceiling demotions on owner-excluded efforts');

    const sectionStart = markdown.indexOf('## Ceiling demotions on owner-excluded efforts');
    const nextSectionStart = markdown.indexOf('## Reconciliation');
    const section = markdown.slice(sectionStart, nextSectionStart);
    expect(section).toMatch(/None in this run\./);

    // placed immediately after Retroactive promotions and before Reconciliation
    const retroIndex = markdown.indexOf('## Retroactive promotions');
    expect(retroIndex).toBeLessThan(sectionStart);
    expect(sectionStart).toBeLessThan(nextSectionStart);
  });

  it('renders one row per ceilingDemotedExcluded entry with speeds to 4 decimals and duration to 1 decimal, and (malformed id) for an invalid activity id', () => {
    const report = baseReport({
      ceilingDemotedExcluded: [
        {
          activityId: '4556693525',
          distance: '400m',
          durationSec: 45.2,
          impliedSpeedMps: 400 / 45.2,
          ceilingMps: 5.1098,
          reason:
            'implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740 m/s (1.28 x p90 3.992 m/s over 1825 filtered 400m efforts)',
        },
        {
          activityId: 'not-a-valid-id!',
          distance: '1k',
          durationSec: 200,
          impliedSpeedMps: 5,
          ceilingMps: 4.7513,
          reason: null,
        },
      ],
    });
    const markdown = renderDiffMarkdown(report);
    const sectionStart = markdown.indexOf('## Ceiling demotions on owner-excluded efforts');
    const nextSectionStart = markdown.indexOf('## Reconciliation');
    const section = markdown.slice(sectionStart, nextSectionStart);

    expect(section).toContain(
      '| Activity ID | Distance | Duration (s) | Implied speed (m/s) | Ceiling (m/s) | Reason |'
    );
    expect(section).toContain('4556693525');
    expect(section).toContain((400 / 45.2).toFixed(4));
    expect(section).toContain('45.2');
    expect(section).toContain('5.1098');
    expect(section).toContain('(malformed id)');
    expect(section).not.toContain('not-a-valid-id!');
    // TD-04/D-10: the signed diff carries the machine's own margin-bearing
    // reason text verbatim, not just the two numbers it was derived from.
    expect(section).toMatch(/by \d+\.\d{3} m\/s/);
    expect(section).toContain(
      'implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740 m/s'
    );
    // A missing reason (null) degrades to an em dash, never "null" or "undefined".
    expect(section).toContain('| — |');
    expect(section).not.toContain('null');
    expect(section).not.toContain('undefined');
  });

  it('Reconciliation names byGuard.ceiling and independentCeilingCount from the recount script, and carries no sign-off text', () => {
    const markdown = renderDiffMarkdown(baseReport());
    const sectionStart = markdown.indexOf('## Reconciliation');
    const nextSectionStart = markdown.indexOf('## Inputs');
    const section = markdown.slice(sectionStart, nextSectionStart);

    expect(section).toContain('byGuard.ceiling');
    expect(section).toContain('independentCeilingCount');
    expect(section).not.toMatch(/signed off|approved by|reviewer:/i);
  });
});
