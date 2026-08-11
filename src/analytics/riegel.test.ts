import { describe, expect, it } from 'vitest';

import type { PRRankingEntry, TargetDistanceKey } from './best-effort.types.js';
import {
  RIEGEL_STANDARD_B,
  buildRiegelMatrix,
  fitRiegelExponent,
  riegelPredict,
  selectFitPoints,
  type RiegelFitPoint,
} from './riegel.js';

function rankingEntry(overrides: Partial<PRRankingEntry> & { activityId: string; durationSec: number }): PRRankingEntry {
  return {
    rank: 1,
    startDate: '2024-01-01T00:00:00Z',
    paceSecPerKm: 240,
    lowConfidence: false,
    ...overrides,
  };
}

describe('fitRiegelExponent — the live-archive suppression scenario', () => {
  it('returns null for three fit points at 5k/10k/half all sharing one activityId (D-11 guard, load-bearing)', () => {
    // This is exactly the archive's real state: 5k (19:39.3), 10k (39:43.9)
    // and half (1:26:51.3) PRs are all splits of activity 7827165619. A
    // row-count implementation (`points.length < 3`) sees 3 rows and
    // returns a fit here; the correct distinct-activity guard must return
    // null because there is only ONE independent effort backing these
    // three rows.
    const points: RiegelFitPoint[] = [
      { distance: '5k', distanceM: 5000, durationSec: 1179.3, activityId: '7827165619' },
      { distance: '10k', distanceM: 10000, durationSec: 2383.9, activityId: '7827165619' },
      { distance: 'half', distanceM: 21097.5, durationSec: 5211.3, activityId: '7827165619' },
    ];

    expect(fitRiegelExponent(points)).toBeNull();
  });
});

describe('fitRiegelExponent — distinct-activity counting', () => {
  it('returns a non-null fit with distinctActivities === 3 for three points across three distinct activities', () => {
    const points: RiegelFitPoint[] = [
      { distance: '5k', distanceM: 5000, durationSec: 1200, activityId: 'a1' },
      { distance: '10k', distanceM: 10000, durationSec: 2500, activityId: 'a2' },
      { distance: 'half', distanceM: 21097.5, durationSec: 5400, activityId: 'a3' },
    ];

    const fit = fitRiegelExponent(points);
    expect(fit).not.toBeNull();
    expect(fit!.distinctActivities).toBe(3);
  });

  it('returns a fit with distinctActivities === 4 for six points across four distinct activities (the live archive shape)', () => {
    const points: RiegelFitPoint[] = [
      { distance: '400m', distanceM: 400, durationSec: 75, activityId: 'a1' },
      { distance: '1k', distanceM: 1000, durationSec: 210, activityId: 'a2' },
      { distance: '1mi', distanceM: 1609.344, durationSec: 360, activityId: 'a3' },
      { distance: '5k', distanceM: 5000, durationSec: 1179.3, activityId: 'a4' },
      { distance: '10k', distanceM: 10000, durationSec: 2383.9, activityId: 'a4' },
      { distance: 'half', distanceM: 21097.5, durationSec: 5211.3, activityId: 'a4' },
    ];

    const fit = fitRiegelExponent(points);
    expect(fit).not.toBeNull();
    expect(fit!.distinctActivities).toBe(4);
  });
});

describe('fitRiegelExponent — fit accuracy', () => {
  it('recovers b within 0.01 of 1.15 from synthetic points generated with that exponent', () => {
    const trueB = 1.15;
    const distances: { distance: TargetDistanceKey; distanceM: number }[] = [
      { distance: '5k', distanceM: 5000 },
      { distance: '10k', distanceM: 10000 },
      { distance: 'half', distanceM: 21097.5 },
    ];
    const points: RiegelFitPoint[] = distances.map((d, i) => ({
      distance: d.distance,
      distanceM: d.distanceM,
      durationSec: 100 * Math.pow(d.distanceM / 1000, trueB),
      activityId: `activity-${i}`,
    }));

    const fit = fitRiegelExponent(points);
    expect(fit).not.toBeNull();
    expect(Math.abs(fit!.b - trueB)).toBeLessThan(0.01);
  });
});

describe('fitRiegelExponent — degenerate inputs', () => {
  it('returns null when all points are at the same distance across three activities (zero x-variance)', () => {
    const points: RiegelFitPoint[] = [
      { distance: '5k', distanceM: 5000, durationSec: 1200, activityId: 'a1' },
      { distance: '5k', distanceM: 5000, durationSec: 1210, activityId: 'a2' },
      { distance: '5k', distanceM: 5000, durationSec: 1190, activityId: 'a3' },
    ];

    expect(fitRiegelExponent(points)).toBeNull();
  });

  it('returns null and does not throw for an empty input', () => {
    expect(() => fitRiegelExponent([])).not.toThrow();
    expect(fitRiegelExponent([])).toBeNull();
  });

  it('returns null and does not throw for a single-point input', () => {
    const points: RiegelFitPoint[] = [
      { distance: '5k', distanceM: 5000, durationSec: 1200, activityId: 'a1' },
    ];
    expect(() => fitRiegelExponent(points)).not.toThrow();
    expect(fitRiegelExponent(points)).toBeNull();
  });
});

describe('riegelPredict', () => {
  it('predicts a doubled distance as more than 2x the base time (exponent above 1) and close to t1 * 2^1.06', () => {
    const predicted = riegelPredict(1179, 5000, 10000);
    expect(predicted).toBeGreaterThan(2 * 1179);
    expect(predicted).toBeCloseTo(1179 * Math.pow(2, RIEGEL_STANDARD_B), 1);
  });

  it('returns 0, not Infinity or NaN, for a zero or negative distance', () => {
    expect(riegelPredict(1179, 5000, 0)).toBe(0);
    expect(riegelPredict(1179, 5000, -100)).toBe(0);
    expect(riegelPredict(1179, 0, 10000)).toBe(0);
    expect(riegelPredict(1179, -5000, 10000)).toBe(0);
  });

  it('returns 0 for a zero or negative base time', () => {
    expect(riegelPredict(0, 5000, 10000)).toBe(0);
    expect(riegelPredict(-100, 5000, 10000)).toBe(0);
  });
});

describe('buildRiegelMatrix', () => {
  it('excludes an empty-ranking distance (marathon) from rows but keeps it in columns; diagonal cells are actual; off-diagonal cells are finite and positive', () => {
    const rankings: Partial<Record<TargetDistanceKey, PRRankingEntry[]>> = {
      '400m': [rankingEntry({ activityId: 'a1', durationSec: 75 })],
      '1k': [rankingEntry({ activityId: 'a2', durationSec: 210 })],
      '1mi': [rankingEntry({ activityId: 'a3', durationSec: 360 })],
      '5k': [rankingEntry({ activityId: 'a4', durationSec: 1179.3 })],
      '10k': [rankingEntry({ activityId: 'a4', durationSec: 2383.9 })],
      half: [rankingEntry({ activityId: 'a4', durationSec: 5211.3 })],
      marathon: [],
    };

    const matrix = buildRiegelMatrix(rankings);

    expect(matrix.rows).not.toContain('marathon');
    expect(matrix.columns).toContain('marathon');
    expect(matrix.columns).toHaveLength(7);

    for (const row of matrix.cells) {
      for (const cell of row) {
        if (cell.from === cell.to) {
          expect(cell.isActual).toBe(true);
          expect(cell.predictedSec).toBeGreaterThan(0);
        } else {
          expect(cell.isActual).toBe(false);
          expect(cell.predictedSec).toBeGreaterThan(0);
          expect(Number.isFinite(cell.predictedSec)).toBe(true);
        }
      }
    }

    // Diagonal cells carry the exact rank-1 durations.
    const fiveKRowIndex = matrix.rows.indexOf('5k');
    const fiveKColIndex = matrix.columns.indexOf('5k');
    expect(matrix.cells[fiveKRowIndex][fiveKColIndex].predictedSec).toBe(1179.3);
  });
});

describe('selectFitPoints', () => {
  it('selects only rank-1 entries, excluding empty-ranking distances', () => {
    const rankings: Partial<Record<TargetDistanceKey, PRRankingEntry[]>> = {
      '5k': [
        rankingEntry({ rank: 1, activityId: 'a1', durationSec: 1179.3 }),
        rankingEntry({ rank: 2, activityId: 'a2', durationSec: 1200 }),
      ],
      marathon: [],
    };

    const points = selectFitPoints(rankings);
    expect(points).toHaveLength(1);
    expect(points[0].activityId).toBe('a1');
    expect(points[0].distance).toBe('5k');
  });
});
