import { describe, expect, it } from 'vitest';
import {
  ATL_TAU_DAYS,
  CTL_TAU_DAYS,
  buildDailySpine,
  computeCtlAtlTsb,
  decayStep,
} from './training-load.js';

describe('buildDailySpine', () => {
  it('walks every calendar day inclusive across a leap-year February', () => {
    expect(buildDailySpine('2024-02-27', '2024-03-02')).toEqual([
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
      '2024-03-02',
    ]);
  });

  it('crosses the year boundary correctly', () => {
    expect(buildDailySpine('2023-12-30', '2024-01-02')).toEqual([
      '2023-12-30',
      '2023-12-31',
      '2024-01-01',
      '2024-01-02',
    ]);
  });

  it('returns [] for reversed or malformed inputs', () => {
    expect(buildDailySpine('2024-03-02', '2024-02-27')).toEqual([]);
    expect(buildDailySpine('not-a-date', '2024-01-02')).toEqual([]);
    expect(buildDailySpine('2024-01-02', 'not-a-date')).toEqual([]);
    expect(buildDailySpine('', '')).toEqual([]);
  });
});

describe('decayStep', () => {
  it('responds faster with a shorter time constant', () => {
    const fast = decayStep(0, 100, 7);
    const slow = decayStep(0, 100, 42);
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('computeCtlAtlTsb', () => {
  it('decays CTL across a 60-day gap after a single 100-TRIMP day (Pitfall 3)', () => {
    const map = new Map<string, number>([['2024-01-01', 100]]);
    const points = computeCtlAtlTsb(map, '2024-01-01', '2024-03-01'); // 60 days after day 1 = 61 total

    expect(points).toHaveLength(61);

    const first = points[0];
    const last = points[points.length - 1];

    expect(last.ctl).toBeLessThan(first.ctl);
    expect(last.ctl).toBeGreaterThan(0);

    // Strict day-over-day decrease across the whole tail (from the day
    // after the load, since ctl still rises on day 1 itself).
    for (let i = 2; i < points.length; i++) {
      expect(points[i].ctl).toBeLessThan(points[i - 1].ctl);
    }
  });

  it('decays ATL faster than CTL: atl drops near 0 by day 60 while ctl does not', () => {
    const map = new Map<string, number>([['2024-01-01', 100]]);
    const points = computeCtlAtlTsb(map, '2024-01-01', '2024-03-01');
    const last = points[points.length - 1];

    expect(last.atl).toBeLessThan(last.ctl);
    expect(last.atl).toBeLessThan(0.01);
    expect(last.ctl).toBeGreaterThan(0.01);
  });

  it('TSB reflects the state going into the day, not after it (Pitfall 4)', () => {
    const map = new Map<string, number>([
      ['2024-01-01', 100],
      ['2024-01-02', 100],
    ]);
    const points = computeCtlAtlTsb(map, '2024-01-01', '2024-01-03');

    // Day 1: nothing preceded it, so tsb === 0 regardless of that day's load.
    expect(points[0].tsb).toBe(0);

    // Day 2: tsb equals ctl[0] - atl[0] exactly (day 1's post-update values).
    expect(points[1].tsb).toBeCloseTo(points[0].ctl - points[0].atl, 10);
  });

  it('drives ctl and atl toward the steady-state load, and tsb toward 0, under constant load', () => {
    const map = new Map<string, number>();
    const spine = buildDailySpine('2023-01-01', '2024-02-04'); // > 400 days
    for (const date of spine) map.set(date, 50);

    const points = computeCtlAtlTsb(map, '2023-01-01', '2024-02-04');
    const last = points[points.length - 1];

    expect(last.ctl).toBeCloseTo(50, 0);
    expect(last.atl).toBeCloseTo(50, 0);
    expect(last.tsb).toBeCloseTo(0, 0);
  });

  it('exposes the exponential time constants', () => {
    expect(CTL_TAU_DAYS).toBe(42);
    expect(ATL_TAU_DAYS).toBe(7);
  });
});
