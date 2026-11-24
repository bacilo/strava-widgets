/**
 * Guard test for the pure functions exported by compute-clean-window-diff.mjs
 * (Phase 36 plan 11, PR-09). Importing this module must not run the archive
 * sweep or write 36-DIFF.md — if it does, the self-execution guard
 * documented at the bottom of compute-clean-window-diff.mjs is wrong and
 * must be fixed rather than worked around here. Every fixture below is
 * hand-built EXCEPT one describe ('real-pair ceiling reinstatement CR-01'),
 * which reads two TRACKED files read-only (`data/streams/<id>.json` and
 * `data/activities/<id>.json`) and never the gitignored `data/stats/` or the
 * CI-rewritten `data/best-effort-ceiling.json`. No test writes anywhere.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { TARGET_METERS, TARGET_ORDER } from '../dist/analytics/best-effort.types.js';

import { computeActivityEfforts } from '../dist/analytics/compute-best-efforts.js';
import { classifyGapsWithSegments } from '../dist/analytics/pace-derivation.js';
import { buildPopulations, reconstructOldEfforts } from './compute-ceiling-recalibration.mjs';
import {
  applyOldCeilings,
  buildRankChanges,
  classifyEffortChanges,
  crossCheckCeilingAgainstRecalibration,
  reconcileCounts,
  renderDiffMarkdown,
  splitReinstatements,
} from './compute-clean-window-diff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATOR_PATH = join(__dirname, 'compute-clean-window-diff.mjs');
const REPO_ROOT = join(__dirname, '..');

/** `MOVED_BUT_RANKED_RENDER_CAP`'s own value, mirrored here so a test can assert cap behaviour precisely. */
const MOVED_BUT_RANKED_RENDER_CAP = 50;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Minimal flat OLD-effort record, the shape `reconstructOldEfforts` returns. */
function makeOldEffort({ activityId, distance, durationSec, demotion = null, excludedFromRecords = false }) {
  // applyOldCeilings reads impliedSpeedMps, so a fixture carries the real one (meters / duration).
  const meters = TARGET_METERS[distance];
  const impliedSpeedMps = meters && durationSec > 0 ? meters / durationSec : null;
  return { activityId, distance, durationSec, impliedSpeedMps, demotion, excludedFromRecords };
}

/** A full CeilingDerivation fixture. */
function makeCeiling(distance, ceilingMps) {
  return {
    distance,
    populationN: 100,
    p90Mps: ceilingMps === null ? null : ceilingMps / 1.28,
    multiplier: 1.28,
    ceilingMps,
    failOpenReason: ceilingMps === null ? 'population below minimum' : null,
  };
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
// CR-01 — the OLD state applies the pre-phase ceiling
// ---------------------------------------------------------------------------

describe('applyOldCeilings CR-01', () => {
  // 400m at 60 s is 6.667 m/s; at 100 s is 4.0 m/s.
  const ceilings = { '400m': makeCeiling('400m', 5.0), '1k': makeCeiling('1k', null) };

  it('sets guard ceiling on a null-demotion record whose speed is strictly above the ceiling', () => {
    const out = applyOldCeilings([makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60 })], ceilings);
    expect(out[0].demotion.guard).toBe('ceiling');
    expect(typeof out[0].demotion.reason).toBe('string');
  });

  it('leaves a record at or below the ceiling unchanged (demotion stays null)', () => {
    const out = applyOldCeilings([makeOldEffort({ activityId: '1', distance: '400m', durationSec: 100 })], ceilings);
    expect(out[0].demotion).toBeNull();
  });

  it('never overwrites an absolute guard: a max-speed record keeps max-speed', () => {
    const demotion = { guard: 'max-speed', reason: 'above max_speed' };
    const out = applyOldCeilings(
      [makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60, demotion })],
      ceilings
    );
    expect(out[0].demotion).toEqual(demotion);
  });

  it('leaves a record at a distance whose ceilingMps is null (or absent) unchanged', () => {
    const out = applyOldCeilings(
      [
        makeOldEffort({ activityId: '1', distance: '1k', durationSec: 100 }),
        makeOldEffort({ activityId: '2', distance: '5k', durationSec: 600 }),
      ],
      ceilings
    );
    expect(out[0].demotion).toBeNull();
    expect(out[1].demotion).toBeNull();
  });

  it('also demotes an owner-excluded over-ceiling record (production parity with the excluded sweep)', () => {
    const out = applyOldCeilings(
      [makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60, excludedFromRecords: true })],
      ceilings
    );
    expect(out[0].demotion.guard).toBe('ceiling');
    expect(out[0].excludedFromRecords).toBe(true);
  });

  it('does not mutate its input array or its records', () => {
    const input = [
      makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60 }),
      makeOldEffort({ activityId: '2', distance: '400m', durationSec: 100 }),
    ];
    const before = structuredClone(input);
    const out = applyOldCeilings(input, ceilings);
    expect(input).toEqual(before);
    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(input[0]);
  });

  it('ORDERING: buildPopulations(useOld) rejects the ceiling-applied array, so the ceiling must be derived first', () => {
    const input = [makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60 })];
    expect(() => buildPopulations(input, { useOld: true })).not.toThrow();
    const applied = applyOldCeilings(input, ceilings);
    expect(() => buildPopulations(applied, { useOld: true })).toThrow(/ceiling/);
  });
});

// ---------------------------------------------------------------------------
// CR-01 on REAL input — the ceiling-reinstatement bucket is reachable
// ---------------------------------------------------------------------------

/**
 * The pre-phase personal ceilings, an INDEPENDENT source: written by the
 * pre-phase pipeline in CI and committed. Re-read with
 * `git show ebe0245c:data/best-effort-ceiling.json` (generatedAt
 * 2026-09-19T07:42:53.759Z). The live `data/best-effort-ceiling.json` must NOT
 * be read from a test, because CI rewrites it nightly.
 */
const PRE_PHASE_CEILINGS_EBE0245C = {
  '400m': { distance: '400m', populationN: 1834, p90Mps: 3.992015968063872, multiplier: 1.28, ceilingMps: 5.1098, failOpenReason: null },
  '1k': { distance: '1k', populationN: 1852, p90Mps: 3.7105751391465676, multiplier: 1.28, ceilingMps: 4.7496, failOpenReason: null },
  '1mi': { distance: '1mi', populationN: 1851, p90Mps: 3.6156908559874186, multiplier: 1.28, ceilingMps: 4.6281, failOpenReason: null },
};

/**
 * One real committed pair, chosen by probe: its pre-phase window implies a
 * speed above the pre-phase ceiling, yet it passes the absolute guards
 * (the activity's own max_speed is well above it), and the clean-window
 * search finds a clean sub-interval so it ranks after the phase.
 */
const REAL_PAIR = { activityId: '3475714424', distance: '400m' };

function loadRealPair({ activityId, distance }) {
  const activity = JSON.parse(readFileSync(join(REPO_ROOT, 'data/activities', `${activityId}.json`), 'utf8'));
  const stream = JSON.parse(readFileSync(join(REPO_ROOT, 'data/streams', `${activityId}.json`), 'utf8'));
  const { segments } = classifyGapsWithSegments(stream.t, stream.d);
  const result = computeActivityEfforts({
    activityId,
    startDate: activity.start_date,
    activityDistanceM: activity.distance,
    maxSpeedMps: activity.max_speed,
    distanceSource: 'native',
    t: stream.t,
    d: stream.d,
    segments,
  });
  const effort = result.efforts.find((e) => e.distance === distance);
  const newDoc = { activities: { [activityId]: { activityId, startDate: activity.start_date, efforts: [effort] } } };
  const activityMaxSpeeds = new Map([[activityId, activity.max_speed]]);
  return { effort, newDoc, activityMaxSpeeds };
}

describe('real-pair ceiling reinstatement CR-01', () => {
  it('the ceiling-applied OLD state classifies the real pair as a ceiling reinstatement', () => {
    const { effort, newDoc, activityMaxSpeeds } = loadRealPair(REAL_PAIR);
    // Preconditions, asserted so a changed archive fails loudly here.
    expect(effort.contaminated).not.toBeNull();
    expect(effort.demotion).toBeNull();

    const oldEfforts = reconstructOldEfforts(newDoc, activityMaxSpeeds);
    expect(oldEfforts).toHaveLength(1);
    expect(oldEfforts[0].demotion).toBeNull();
    expect(oldEfforts[0].impliedSpeedMps).toBeGreaterThan(PRE_PHASE_CEILINGS_EBE0245C[REAL_PAIR.distance].ceilingMps);

    const withCeiling = applyOldCeilings(oldEfforts, PRE_PHASE_CEILINGS_EBE0245C);
    expect(withCeiling[0].demotion.guard).toBe('ceiling');

    const changes = classifyEffortChanges(newDoc, withCeiling);
    expect(changes[0].kind).toBe('reinstated');
    const { ceiling, absoluteGuard } = splitReinstatements(changes);
    expect(ceiling.length).toBe(1);
    expect(ceiling[0].activityId).toBe(REAL_PAIR.activityId);
    expect(absoluteGuard.length).toBe(0);
  });

  it('the SAME pair without applyOldCeilings (the CR-01 defect path) lands outside reinstated', () => {
    const { newDoc, activityMaxSpeeds } = loadRealPair(REAL_PAIR);
    const oldEfforts = reconstructOldEfforts(newDoc, activityMaxSpeeds);
    const changes = classifyEffortChanges(newDoc, oldEfforts);
    expect(changes[0].kind).toBe('moved-but-ranked');
    expect(splitReinstatements(changes).ceiling.length).toBe(0);
  });
});

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
    const kinds = ['excluded', 'reinstated', 'moved-but-ranked', 'newly-demoted', 'demoted-guard-changed', 'unchanged'];
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

describe('classifyEffortChanges — owner-excluded and guard-changed kinds WR-01', () => {
  const classifyOne = (oldEffort, newEffort) => {
    const newDoc = makeNewDoc([makeActivity({ activityId: oldEffort.activityId, efforts: [newEffort] })]);
    return classifyEffortChanges(newDoc, [oldEffort])[0];
  };
  const ceilingGuard = { guard: 'ceiling', reason: 'over ceiling' };

  it('files an effort owner-excluded on the NEW side as excluded, whatever its guards', () => {
    const c = classifyOne(
      makeOldEffort({ activityId: '1', distance: '400m', durationSec: 90 }),
      makeNewEffort({ distance: '400m', durationSec: 90, excludedFromRecords: true })
    );
    expect(c.kind).toBe('excluded');
  });

  it('files an effort owner-excluded on the OLD side as excluded even with a reinstating guard pattern', () => {
    const c = classifyOne(
      makeOldEffort({
        activityId: '1',
        distance: '400m',
        durationSec: 60,
        demotion: ceilingGuard,
        excludedFromRecords: true,
      }),
      makeNewEffort({ distance: '400m', durationSec: 90 })
    );
    expect(c.kind).toBe('excluded');
  });

  it('old ceiling plus new null is reinstated', () => {
    const c = classifyOne(
      makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60, demotion: ceilingGuard }),
      makeNewEffort({ distance: '400m', durationSec: 90 })
    );
    expect(c.kind).toBe('reinstated');
  });

  it('old ceiling plus new unreliable-segment is demoted-guard-changed, never unchanged or newly-demoted', () => {
    const c = classifyOne(
      makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60, demotion: ceilingGuard }),
      makeNewEffort({
        distance: '400m',
        durationSec: 60,
        demotion: { guard: 'unreliable-segment', reason: 'no clean window' },
      })
    );
    expect(c.kind).toBe('demoted-guard-changed');
    expect(c.oldGuard).toBe('ceiling');
    expect(c.newGuard).toBe('unreliable-segment');
  });

  it('old ceiling plus new ceiling is unchanged', () => {
    const c = classifyOne(
      makeOldEffort({ activityId: '1', distance: '400m', durationSec: 60, demotion: ceilingGuard }),
      makeNewEffort({ distance: '400m', durationSec: 60, demotion: ceilingGuard })
    );
    expect(c.kind).toBe('unchanged');
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

  it('throws (fails closed) on a reinstated record with an unknown OLD guard, naming the pair and guard', () => {
    const changes = [
      { activityId: 'z', distance: '1k', kind: 'reinstated', oldGuard: 'unreliable-segment', oldReason: 'x' },
    ];
    expect(() => splitReinstatements(changes)).toThrow(/z.*1k.*unreliable-segment/s);
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
      { kind: 'newly-demoted', newGuard: 'unreliable-segment', contaminatedReason: null },
      { kind: 'moved-but-ranked', newGuard: null, contaminatedReason: 'segment' },
    ];
    const guardCounts = { totals: { 'unreliable-segment': 1, contaminated: 1 } };

    const rows = reconcileCounts(changes, guardCounts);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.agrees)).toBe(true);
    expect(rows.every((r) => typeof r.addends === 'object')).toBe(true);
  });

  it('agrees on a fixture mixing moved, reinstated-with-contamination, excluded-contaminated and excluded-unreliable-segment records', () => {
    const changes = [
      { kind: 'moved-but-ranked', newGuard: null, contaminatedReason: 'seg' },
      { kind: 'reinstated', newGuard: null, contaminatedReason: 'seg' },
      { kind: 'excluded', newGuard: null, contaminatedReason: 'seg' },
      { kind: 'excluded', newGuard: 'unreliable-segment', contaminatedReason: null },
      { kind: 'newly-demoted', newGuard: 'unreliable-segment', contaminatedReason: null },
      { kind: 'demoted-guard-changed', newGuard: 'unreliable-segment', contaminatedReason: null },
    ];
    const guardCounts = { totals: { 'unreliable-segment': 3, contaminated: 3 } };
    const rows = reconcileCounts(changes, guardCounts);
    expect(rows.every((r) => r.agrees)).toBe(true);
    const contaminatedRow = rows.find((r) => r.check.includes('contaminated'));
    expect(contaminatedRow.addends).toMatchObject({ 'moved-but-ranked': 1, reinstated: 1, excluded: 1 });
    const segmentRow = rows.find((r) => r.check.includes('unreliable-segment'));
    expect(segmentRow.addends).toMatchObject({ 'newly-demoted': 1, 'demoted-guard-changed': 1, excluded: 1 });
  });

  it('reports a disagreement (never throws) when a contaminated effort is omitted from the lists, naming both figures', () => {
    const changes = [
      { kind: 'newly-demoted', newGuard: 'unreliable-segment', contaminatedReason: null },
      // Deliberately NO contaminated record here, even though the
      // walked document below claims 5 contaminated efforts exist.
    ];
    const guardCounts = { totals: { 'unreliable-segment': 1, contaminated: 5 } };

    const rows = reconcileCounts(changes, guardCounts);
    const contaminatedRow = rows.find((r) => r.check.includes('contaminated'));
    expect(contaminatedRow).toBeDefined();
    expect(contaminatedRow.agrees).toBe(false);
    expect(contaminatedRow.listsFigure).toBe(0);
    expect(contaminatedRow.walkedFigure).toBe(5);

    // The sibling check (unreliable-segment) still agrees — a disagreement in
    // one check must not corrupt the other.
    const segmentRow = rows.find((r) => r.check.includes('unreliable-segment'));
    expect(segmentRow.agrees).toBe(true);
  });

  it('renders a disagreeing reconciliation row into the markdown rather than hiding it', () => {
    const report = baseReport({
      reconciliation: [
        {
          check: 'contaminated records across every kind vs the walked contaminated-effort count',
          listsFigure: 10,
          walkedFigure: 15,
          agrees: false,
          addends: { 'moved-but-ranked': 10 },
        },
      ],
    });
    const markdown = renderDiffMarkdown(report);
    expect(markdown).toContain('| 10 | 15 | NO |');
    expect(markdown.toLowerCase()).toContain('disagree');
  });
});

describe('renderDiffMarkdown headline and new sections', () => {
  const change = (kind, extra = {}) => ({
    activityId: '123456',
    distance: '400m',
    oldDurationSec: 100,
    newDurationSec: 90,
    oldPaceSecPerKm: 250,
    newPaceSecPerKm: 225,
    oldGuard: null,
    oldReason: null,
    newGuard: null,
    newReason: null,
    contaminatedReason: null,
    kind,
    ...extra,
  });

  it('renders the seven exact headline lines', () => {
    const md = renderDiffMarkdown(baseReport());
    const lines = md.split('\n');
    const has = (prefix) => lines.some((l) => l.startsWith(prefix));
    expect(has('- Moved but still ranked: ')).toBe(true);
    expect(has('- Newly demoted: ')).toBe(true);
    expect(lines).toContain('- Reinstated: 0 (0 absolute-guard, 0 ceiling)');
    expect(has('- Demoted before and after, guard changed: ')).toBe(true);
    expect(has('- Unchanged: ')).toBe(true);
    expect(lines).toContain(
      '- Owner-excluded, omitted from the five populations above: 0 (the Records screen skips these too)'
    );
    expect(has('- Distances whose ceiling moved: ')).toBe(true);
  });

  it('renders the per-distance reinstatement table first under ## Reinstated', () => {
    const absolute = change('reinstated', { oldGuard: 'max-speed', oldReason: 'r' });
    const ceiling = change('reinstated', { oldGuard: 'ceiling', oldReason: 'r', distance: '1k' });
    const md = renderDiffMarkdown(
      baseReport({
        changes: [absolute, ceiling],
        reinstatements: { absoluteGuard: [absolute], ceiling: [ceiling] },
      })
    );
    const start = md.indexOf('## Reinstated');
    const section = md.slice(start).split('\n');
    const headerIdx = section.indexOf('| Distance | Absolute-guard reinstatements | Ceiling reinstatements |');
    expect(headerIdx).toBe(2);
    expect(section[headerIdx + 1]).toBe('|---|---|---|');
    expect(section[headerIdx + 2]).toBe('| 400m | 1 | 0 |');
    expect(section[headerIdx + 3]).toBe('| 1k | 0 | 1 |');
  });

  it('renders the owner-excluded section, its per-distance table, and the headline count', () => {
    const md = renderDiffMarkdown(baseReport({ changes: [change('excluded'), change('excluded')] }));
    expect(md).toContain('## Owner-Excluded Efforts');
    expect(md).toContain('| Distance | Owner-excluded efforts |');
    expect(md).toContain('| 400m | 2 |');
    expect(md).toContain(
      '- Owner-excluded, omitted from the five populations above: 2 (the Records screen skips these too)'
    );
  });

  it('renders the guard-changed section with old and new guard, or the none sentence', () => {
    const md = renderDiffMarkdown(
      baseReport({
        changes: [change('demoted-guard-changed', { oldGuard: 'ceiling', newGuard: 'unreliable-segment' })],
      })
    );
    expect(md).toContain('## Demoted Before and After, Guard Changed');
    expect(md).toContain('| 123456 | 400m | ceiling | unreliable-segment |');
    expect(md).toContain('- Demoted before and after, guard changed: 1');
    expect(renderDiffMarkdown(baseReport())).toContain('No effort changed demotion guard.');
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
