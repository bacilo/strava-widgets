/**
 * Guard test for the pure helpers exported by compute-pr-ceiling-calibration.mjs
 * (Phase 28 plan 01, PR-02/PR-05). Importing this module must not run an
 * archive read or a write to 28-CEILING-CALIBRATION.md — if it does, the
 * self-execution guard documented at the bottom of
 * compute-pr-ceiling-calibration.mjs is wrong and must be fixed rather than
 * worked around here.
 *
 * No test in this file reads any file under the live archive directories —
 * every fixture below is hand-built.
 */

import { describe, expect, it } from 'vitest';

import {
  applyCeiling,
  buildFilteredPopulations,
  deriveCeilingMultiplier,
  deriveMinimumPopulation,
  nearestRankPercentile,
  partitionMechanismClean,
  renderCalibrationMarkdown,
} from './compute-pr-ceiling-calibration.mjs';

describe('nearestRankPercentile', () => {
  it('returns null for an empty array', () => {
    expect(nearestRankPercentile([], 0.9)).toBeNull();
  });

  it('returns the single element at every fraction for a one-element array', () => {
    expect(nearestRankPercentile([42], 0)).toBe(42);
    expect(nearestRankPercentile([42], 0.5)).toBe(42);
    expect(nearestRankPercentile([42], 1)).toBe(42);
  });

  it('returns the 9th element at 0.90 and the 10th at 1.0 for a ten-element ascending array', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(nearestRankPercentile(sorted, 0.9)).toBe(9);
    expect(nearestRankPercentile(sorted, 1.0)).toBe(10);
  });

  it('always returns a member of the input array — the interpolation-free property', () => {
    const sorted = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7];
    for (const fraction of [0, 0.1, 0.25, 0.5, 0.9, 0.99, 1.0]) {
      const value = nearestRankPercentile(sorted, fraction);
      expect(sorted.includes(value)).toBe(true);
    }
  });
});

describe('buildFilteredPopulations', () => {
  function makeEffort(overrides) {
    return {
      distance: '400m',
      durationSec: 60,
      paceSecPerKm: 150,
      startOffsetSec: 0,
      endOffsetSec: 60,
      lowConfidence: false,
      wasPRAtTheTime: false,
      excludedFromRecords: false,
      ...overrides,
    };
  }

  const fixtureDoc = {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00Z',
    note: 'fixture',
    totals: {},
    // Deliberately lists the effort-excluded activity's effort in rankings
    // (rank 1), to prove membership is never read from here. This activity
    // really is excluded (effort.excludedFromRecords), unlike
    // act-activity-excluded below, which is only excluded at the
    // activity level and is therefore INCLUDED under WR-04.
    rankings: {
      '400m': [
        {
          rank: 1,
          activityId: 'act-effort-excluded',
          startDate: '2020-01-02T00:00:00Z',
          durationSec: 60,
          paceSecPerKm: 150,
          lowConfidence: false,
        },
      ],
    },
    rejected: [],
    activities: {
      // Distance-scoped owner exclusion: the activity carries
      // excludedFromRecords: true (set whenever ANY exclusion entry names
      // the activity, even a distance-scoped one — compute-best-efforts.ts),
      // but THIS effort is not itself excluded. The pipeline includes it
      // (WR-04): only effort.excludedFromRecords governs membership.
      'act-activity-excluded': {
        activityId: 'act-activity-excluded',
        startDate: '2020-01-01T00:00:00Z',
        distanceSource: 'native',
        excludedFromRecords: true,
        efforts: [makeEffort({ durationSec: 50, excludedFromRecords: false })],
      },
      // Really excluded at the effort level — dropped.
      'act-effort-excluded': {
        activityId: 'act-effort-excluded',
        startDate: '2020-01-02T00:00:00Z',
        distanceSource: 'native',
        excludedFromRecords: false,
        efforts: [makeEffort({ durationSec: 60, excludedFromRecords: true })],
      },
      // Clean, unflagged effort — included.
      'act-clean': {
        activityId: 'act-clean',
        startDate: '2020-01-03T00:00:00Z',
        distanceSource: 'native',
        excludedFromRecords: false,
        efforts: [makeEffort({ durationSec: 70, excludedFromRecords: false })],
      },
      // Absolute-guard demoted (world-record) — dropped, even at an absurd
      // implied speed (400m / 0.4s = 1000 m/s).
      'act-world-record': {
        activityId: 'act-world-record',
        startDate: '2020-01-04T00:00:00Z',
        distanceSource: 'native',
        excludedFromRecords: false,
        efforts: [
          makeEffort({
            durationSec: 0.4,
            excludedFromRecords: false,
            demotion: { guard: 'world-record', reason: 'r' },
          }),
        ],
      },
      // Absolute-guard demoted (max-speed) — dropped.
      'act-max-speed': {
        activityId: 'act-max-speed',
        startDate: '2020-01-05T00:00:00Z',
        distanceSource: 'native',
        excludedFromRecords: false,
        efforts: [
          makeEffort({
            durationSec: 45,
            excludedFromRecords: false,
            demotion: { guard: 'max-speed', reason: 'r' },
          }),
        ],
      },
      // Ceiling-demoted — the ceiling did not exist when Pass 1
      // accumulated, so this is INCLUDED.
      'act-ceiling': {
        activityId: 'act-ceiling',
        startDate: '2020-01-06T00:00:00Z',
        distanceSource: 'native',
        excludedFromRecords: false,
        efforts: [
          makeEffort({
            durationSec: 48,
            excludedFromRecords: false,
            demotion: { guard: 'ceiling', reason: 'r' },
          }),
        ],
      },
    },
  };

  it('mirrors Pass 1: per-effort exclusion only, absolute-guard demotions dropped, ceiling demotions kept', () => {
    const populations = buildFilteredPopulations(fixtureDoc);
    const pop400 = populations.get('400m');
    const includedIds = pop400.map((e) => e.activityId).sort();

    expect(includedIds).toEqual(['act-activity-excluded', 'act-ceiling', 'act-clean']);
    expect(pop400.some((e) => e.activityId === 'act-effort-excluded')).toBe(false);
    expect(pop400.some((e) => e.activityId === 'act-world-record')).toBe(false);
    expect(pop400.some((e) => e.activityId === 'act-max-speed')).toBe(false);
  });

  it('never reads rankings for membership: the excluded activity does not appear despite ranking rank 1', () => {
    const populations = buildFilteredPopulations(fixtureDoc);
    const pop400 = populations.get('400m');
    expect(pop400.some((e) => e.activityId === 'act-effort-excluded')).toBe(false);
  });
});

describe('partitionMechanismClean', () => {
  it('returns exactly 5k/10k/half/marathon clean and 400m/1k/1mi vulnerable, independent of population data', () => {
    const emptyPopulations = new Map([
      ['400m', []],
      ['1k', []],
      ['1mi', []],
      ['5k', []],
      ['10k', []],
      ['half', []],
      ['marathon', []],
    ]);
    const busyPopulations = new Map([
      ['400m', [{ activityId: 'a', speedMps: 100 }]],
      ['1k', [{ activityId: 'b', speedMps: 100 }]],
      ['1mi', [{ activityId: 'c', speedMps: 100 }]],
      ['5k', [{ activityId: 'd', speedMps: 0.001 }]],
      ['10k', [{ activityId: 'e', speedMps: 0.001 }]],
      ['half', [{ activityId: 'f', speedMps: 0.001 }]],
      ['marathon', [{ activityId: 'g', speedMps: 0.001 }]],
    ]);

    const resultEmpty = partitionMechanismClean(emptyPopulations);
    const resultBusy = partitionMechanismClean(busyPopulations);

    expect(resultEmpty.mechanismClean).toEqual(['5k', '10k', 'half', 'marathon']);
    expect(resultEmpty.mechanismVulnerable).toEqual(['400m', '1k', '1mi']);
    expect(resultBusy.mechanismClean).toEqual(resultEmpty.mechanismClean);
    expect(resultBusy.mechanismVulnerable).toEqual(resultEmpty.mechanismVulnerable);
  });
});

describe('deriveMinimumPopulation', () => {
  it('returns 100 for the default ten-points-above-boundary argument', () => {
    const result = deriveMinimumPopulation();
    expect(result.n).toBe(100);
  });

  it('satisfies minimality: n clears the inequality but n - 1 does not', () => {
    const result = deriveMinimumPopulation();
    const { n, minPointsAboveBoundary } = result;

    expect(n - Math.ceil(0.9 * n)).toBeGreaterThanOrEqual(minPointsAboveBoundary);
    expect((n - 1) - Math.ceil(0.9 * (n - 1))).toBeLessThan(minPointsAboveBoundary);
  });
});

describe('deriveCeilingMultiplier', () => {
  function makePopulation(speeds) {
    return speeds.map((speedMps, i) => ({
      activityId: `a${String(i).padStart(5, '0')}`,
      startDate: '2020-01-01T00:00:00Z',
      durationSec: 100,
      speedMps,
    }));
  }

  // 100-point populations for the three mechanism-clean distances: values
  // 1..99 plus one top value, chosen so p90 is identical (90) across all
  // three and only the top value (hence max/p90) differs, isolating the
  // ratio comparison to the injected maximum.
  function buildBase({ fourHundredMax = 10000 } = {}) {
    const ascendingTail = Array.from({ length: 99 }, (_, i) => i + 1); // 1..99
    const populations = new Map();
    populations.set('400m', makePopulation([...ascendingTail, fourHundredMax])); // vulnerable
    populations.set('1k', makePopulation([1, 2, 3])); // vulnerable, tiny, irrelevant
    populations.set('1mi', makePopulation([1, 2, 3])); // vulnerable, tiny, irrelevant
    populations.set('5k', makePopulation([...ascendingTail, 100])); // clean, ratio 100/90
    populations.set('10k', makePopulation([...ascendingTail, 300])); // clean, ratio 300/90 (argmax)
    populations.set('half', makePopulation([...ascendingTail, 100])); // clean, ratio 100/90
    populations.set('marathon', []); // clean, but n=0 fails the floor
    return populations;
  }

  it('picks 10k as argmax with k equal to its ratio rounded up to two decimals', () => {
    const populations = buildBase();
    const { k, argmaxDistance } = deriveCeilingMultiplier(populations);

    expect(argmaxDistance).toBe('10k');
    expect(k).toBe(Math.ceil((300 / 90) * 100) / 100);
  });

  it('leaves k unchanged when a much larger ratio is injected at the mechanism-vulnerable 400m', () => {
    const baseline = deriveCeilingMultiplier(buildBase());
    const contaminated = deriveCeilingMultiplier(buildBase({ fourHundredMax: 1e9 }));

    expect(contaminated.k).toBe(baseline.k);
    expect(contaminated.argmaxDistance).toBe(baseline.argmaxDistance);
  });
});

describe('applyCeiling', () => {
  function makePopulation(speeds) {
    return speeds.map((speedMps, i) => ({
      activityId: `b${String(i).padStart(5, '0')}`,
      startDate: '2020-01-01T00:00:00Z',
      durationSec: 100,
      speedMps,
    }));
  }

  it('does not demote an effort exactly at the ceiling, but demotes one a hair above it', () => {
    // p90 of [1..10] (n=10) is 9 (index 8, 0-based). k=1.0 -> ceilingMps = 9.0 exactly.
    const populations = new Map([['5k', makePopulation([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])]]);
    const applied = applyCeiling(populations, 1.0, 5);

    const entry = applied['5k'];
    expect(entry.ceilingMps).toBe(9.0);
    // The effort at exactly 9.0 is retained (not demoted); only the effort at 10 (> 9.0) is.
    expect(entry.demotedCount).toBe(1);
  });

  it('fails open (ceilingMps: null, eligible: false, demotedCount: 0) below the population floor', () => {
    const populations = new Map([['5k', makePopulation([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])]]);
    const applied = applyCeiling(populations, 1.0, 20);

    const entry = applied['5k'];
    expect(entry.ceilingMps).toBeNull();
    expect(entry.eligible).toBe(false);
    expect(entry.demotedCount).toBe(0);
  });
});

describe('renderCalibrationMarkdown', () => {
  const sampleReport = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    bestEffortsGeneratedAt: '2026-01-01T00:00:00.000Z',
    indexGeneratedAt: '2026-01-01T00:00:00.000Z',
    liveActivitiesConsidered: 1000,
    liveArchiveActivityCount: 1010,
    minPopulation: 100,
    minPointsAboveBoundary: 10,
    pointsAboveBoundary: 10,
    k: 1.28,
    argmaxDistance: '10k',
    kPerDistance: {
      '400m': { n: 1000, max: 6.0, p90: 4.0, ratio: 1.5, mechanismClean: false, floorEligible: true },
      '1k': { n: 1000, max: 6.0, p90: 3.7, ratio: 1.62, mechanismClean: false, floorEligible: true },
      '1mi': { n: 1000, max: 5.5, p90: 3.6, ratio: 1.53, mechanismClean: false, floorEligible: true },
      '5k': { n: 1000, max: 4.2, p90: 3.4, ratio: 1.24, mechanismClean: true, floorEligible: true },
      '10k': { n: 1000, max: 4.2, p90: 3.3, ratio: 1.27, mechanismClean: true, floorEligible: true },
      half: { n: 100, max: 4.0, p90: 3.4, ratio: 1.18, mechanismClean: true, floorEligible: true },
      marathon: { n: 0, max: null, p90: null, ratio: null, mechanismClean: true, floorEligible: false },
    },
    applied: {
      '400m': { ceilingMps: 5.11, eligible: true, n: 1000, demotedCount: 8, demotedTop10Count: 8 },
      '1k': { ceilingMps: 4.75, eligible: true, n: 1000, demotedCount: 7, demotedTop10Count: 7 },
      '1mi': { ceilingMps: 4.63, eligible: true, n: 1000, demotedCount: 3, demotedTop10Count: 3 },
      '5k': { ceilingMps: 4.35, eligible: true, n: 1000, demotedCount: 0, demotedTop10Count: 0 },
      '10k': { ceilingMps: 4.22, eligible: true, n: 1000, demotedCount: 0, demotedTop10Count: 0 },
      half: { ceilingMps: 4.4, eligible: true, n: 100, demotedCount: 0, demotedTop10Count: 0 },
      marathon: { ceilingMps: null, eligible: false, n: 0, demotedCount: 0, demotedTop10Count: 0 },
    },
    riegel: {
      fastest10kActivityId: '7827165619',
      fastest10kDurationSec: 2383.9,
      perDistance: {
        '400m': { outOfRange: true },
        '1k': { riegelCeilingMps: 4.82, riegelOnlyDemotions: 0, ourOnlyDemotions: 0 },
        '1mi': { riegelCeilingMps: 4.68, riegelOnlyDemotions: 0, ourOnlyDemotions: 0 },
        '5k': { riegelCeilingMps: 4.37, riegelOnlyDemotions: 0, ourOnlyDemotions: 0 },
        '10k': { riegelCeilingMps: 4.19, riegelOnlyDemotions: 0, ourOnlyDemotions: 0 },
        half: { riegelCeilingMps: 4.01, riegelOnlyDemotions: 1, ourOnlyDemotions: 0 },
        marathon: { riegelCeilingMps: 3.85, riegelOnlyDemotions: 0, ourOnlyDemotions: 0 },
      },
    },
    percentileFinding: {
      '400m': { p995: 4.98, demotedTop10AtP995: 9, top10Count: 10 },
      '1k': { p995: 4.62, demotedTop10AtP995: 9, top10Count: 10 },
      '1mi': { p995: 4.03, demotedTop10AtP995: 9, top10Count: 10 },
      '5k': { p995: 3.76, demotedTop10AtP995: 8, top10Count: 10 },
      '10k': { p995: 3.69, demotedTop10AtP995: 7, top10Count: 10 },
      half: { p995: 4.05, demotedTop10AtP995: 0, top10Count: 10 },
      marathon: { p995: null, demotedTop10AtP995: 0, top10Count: 0 },
    },
    sensitivity: [
      {
        k: 1.23,
        isChosen: false,
        perDistanceCounts: { '400m': 11, '1k': 12, '1mi': 4, '5k': 1, '10k': 1, half: 0, marathon: 0 },
      },
      {
        k: 1.28,
        isChosen: true,
        perDistanceCounts: { '400m': 8, '1k': 7, '1mi': 3, '5k': 0, '10k': 0, half: 0, marathon: 0 },
      },
      {
        k: 1.33,
        isChosen: false,
        perDistanceCounts: { '400m': 5, '1k': 4, '1mi': 1, '5k': 0, '10k': 0, half: 0, marathon: 0 },
      },
    ],
    reconciliation: {
      '400m': { liveN: 1825, referenceN: 1831, drift: -6 },
      '1k': { liveN: 1843, referenceN: 1849, drift: -6 },
      '1mi': { liveN: 1842, referenceN: 1848, drift: -6 },
      '5k': { liveN: 1779, referenceN: 1786, drift: -7 },
      '10k': { liveN: 1459, referenceN: 1464, drift: -5 },
      half: { liveN: 104, referenceN: 105, drift: -1 },
      marathon: { liveN: 0, referenceN: 0, drift: 0 },
    },
    fourHundredCeilingSec: 78.3,
  };

  it('is a pure function of report: two calls over the same object produce identical strings', () => {
    const first = renderCalibrationMarkdown(sampleReport);
    const second = renderCalibrationMarkdown(sampleReport);
    expect(first).toBe(second);
  });

  it('differs only in the **Generated:** line when generatedAt differs', () => {
    const reportA = { ...sampleReport, generatedAt: '2026-01-01T00:00:00.000Z' };
    const reportB = { ...sampleReport, generatedAt: '2099-12-31T23:59:59.000Z' };

    const stripGeneratedLine = (markdown) =>
      markdown
        .split('\n')
        .filter((line) => !line.startsWith('**Generated:**'))
        .join('\n');

    expect(stripGeneratedLine(renderCalibrationMarkdown(reportA))).toBe(
      stripGeneratedLine(renderCalibrationMarkdown(reportB))
    );
  });
});
