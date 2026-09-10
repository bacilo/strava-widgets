import { describe, expect, it } from 'vitest';

import {
  CEILING_K,
  CEILING_MIN_POPULATION,
  ceilingDemotion,
  deriveCeiling,
  deriveCeilings,
  percentileNearestRank,
} from './best-effort-ceiling.js';
import { TARGET_ORDER } from './best-effort.types.js';
import type { TargetDistanceKey } from './best-effort.types.js';

describe('percentileNearestRank', () => {
  it('returns null for an empty array', () => {
    expect(percentileNearestRank([], 0.9)).toBeNull();
  });

  it('every returned value is a member of the input (interpolation-free)', () => {
    const sorted = [1, 2, 5, 5, 9, 13, 20];
    for (const fraction of [0, 0.1, 0.5, 0.9, 0.995, 1]) {
      const result = percentileNearestRank(sorted, fraction);
      expect(sorted).toContain(result);
    }
  });

  it('returns the 90th element (1-based) of a hundred-element ascending array at fraction 0.90', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    // ceil(0.90 * 100) - 1 = 89 (0-based) -> value 90.
    expect(percentileNearestRank(sorted, 0.9)).toBe(90);
  });

  it('fraction 1.0 returns the last element', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentileNearestRank(sorted, 1.0)).toBe(5);
  });

  it('fraction 0 clamps to the first element', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentileNearestRank(sorted, 0)).toBe(1);
  });
});

describe('deriveCeiling — fail-open branch', () => {
  it('a population one element below CEILING_MIN_POPULATION returns fail-open with both numbers named', () => {
    const population = Array.from({ length: CEILING_MIN_POPULATION - 1 }, (_, i) => 3 + i * 0.01);
    const result = deriveCeiling('5k', population);
    expect(result.ceilingMps).toBeNull();
    expect(result.p90Mps).toBeNull();
    expect(result.failOpenReason).not.toBeNull();
    expect(result.failOpenReason).toContain(String(CEILING_MIN_POPULATION - 1));
    expect(result.failOpenReason).toContain(String(CEILING_MIN_POPULATION));
  });

  it('a population exactly at CEILING_MIN_POPULATION returns a non-null ceiling (floor tested from both sides)', () => {
    const population = Array.from({ length: CEILING_MIN_POPULATION }, (_, i) => 3 + i * 0.01);
    const result = deriveCeiling('5k', population);
    expect(result.ceilingMps).not.toBeNull();
    expect(result.p90Mps).not.toBeNull();
    expect(result.failOpenReason).toBeNull();
  });

  it('an empty population returns the fail-open shape rather than throwing', () => {
    expect(() => deriveCeiling('marathon', [])).not.toThrow();
    const result = deriveCeiling('marathon', []);
    expect(result.ceilingMps).toBeNull();
    expect(result.p90Mps).toBeNull();
    expect(result.populationN).toBe(0);
    expect(result.failOpenReason).not.toBeNull();
  });
});

describe('deriveCeiling — derivation branch', () => {
  it('ceilingMps equals Math.ceil(CEILING_K * p90 * 1e4) / 1e4 for a hand-built population with a known p90', () => {
    // 200 elements, values 1..200 (ascending). p90 index = ceil(0.9*200)-1 = 179 (0-based) -> value 180.
    const population = Array.from({ length: 200 }, (_, i) => i + 1);
    const result = deriveCeiling('10k', population);
    expect(result.p90Mps).toBe(180);
    expect(result.ceilingMps).toBe(Math.ceil(CEILING_K * 180 * 1e4) / 1e4);
  });

  it('appending twenty extreme outliers leaves p90Mps and ceilingMps UNCHANGED when the plateau absorbs the index shift, but WOULD move p99.5 (load-bearing: the ceiling cannot be moved by the outliers it rejects)', () => {
    // Build a 200-element population: 1..179 ascending, a 19-wide plateau at
    // 200 spanning indices 179..197, then 201, 202. Appending 20 outliers
    // (0.9 * 20 = 18, an exact integer shift) moves the p90 INDEX from 179
    // to 197 — both endpoints of the plateau — so the VALUE returned is
    // identical before and after. This is a structural proof, not a
    // coincidence: the plateau is sized to exactly absorb the known shift.
    const basePopulation: number[] = [];
    for (let i = 1; i <= 179; i++) basePopulation.push(i);
    for (let i = 0; i < 19; i++) basePopulation.push(200);
    basePopulation.push(201);
    basePopulation.push(202);
    expect(basePopulation).toHaveLength(200);

    const before = deriveCeiling('5k', basePopulation);
    expect(before.p90Mps).toBe(200);

    const outliers = Array.from({ length: 20 }, () => 1_000_000);
    const injected = [...basePopulation, ...outliers];
    const after = deriveCeiling('5k', injected);

    expect(after.p90Mps).toBe(before.p90Mps);
    expect(after.ceilingMps).toBe(before.ceilingMps);

    // Contrasting case, computed here rather than cited: the p99.5 of the
    // same injected population DOES move, because its index (218, 0-based)
    // lands inside the outlier block rather than the plateau.
    const sortedBefore = [...basePopulation].sort((a, b) => a - b);
    const sortedAfter = [...injected].sort((a, b) => a - b);
    const p995Before = percentileNearestRank(sortedBefore, 0.995);
    const p995After = percentileNearestRank(sortedAfter, 0.995);
    expect(p995Before).toBe(201);
    expect(p995After).toBe(1_000_000);
    expect(p995After).not.toBe(p995Before);
  });
});

describe('deriveCeiling — order-independence', () => {
  it('the same multiset in three different orders produces three deeply equal CeilingDerivation objects, without mutating the caller array', () => {
    const ascending = Array.from({ length: 150 }, (_, i) => i + 1); // 1..150
    const descending = [...ascending].reverse();
    // Fixed permutation, no randomness involved: i -> (i*7 + 3) mod 150.
    // gcd(7, 150) = 1, so this is a bijection on the index set and
    // therefore a genuine permutation of the same multiset.
    const shuffled = Array.from({ length: 150 }, (_, i) => ascending[(i * 7 + 3) % 150]);

    const ascendingCopy = [...ascending];
    const descendingCopy = [...descending];
    const shuffledCopy = [...shuffled];

    const r1 = deriveCeiling('1mi', ascending);
    const r2 = deriveCeiling('1mi', descending);
    const r3 = deriveCeiling('1mi', shuffled);

    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);

    expect(ascending).toEqual(ascendingCopy);
    expect(descending).toEqual(descendingCopy);
    expect(shuffled).toEqual(shuffledCopy);
  });
});

describe('deriveCeilings', () => {
  it('returns exactly seven keys matching TARGET_ORDER', () => {
    const population = Array.from({ length: 150 }, (_, i) => i + 1);
    const map = new Map<TargetDistanceKey, readonly number[]>([['5k', population]]);
    const result = deriveCeilings(map);
    expect(Object.keys(result).sort()).toEqual([...TARGET_ORDER].sort());
    expect(Object.keys(result)).toHaveLength(7);
  });

  it('treats a distance absent from the input map as an empty population, coming back fail-open rather than undefined', () => {
    const map = new Map<TargetDistanceKey, readonly number[]>();
    const result = deriveCeilings(map);
    for (const distance of TARGET_ORDER) {
      expect(result[distance]).toBeDefined();
      expect(result[distance].ceilingMps).toBeNull();
      expect(result[distance].failOpenReason).not.toBeNull();
      expect(result[distance].populationN).toBe(0);
    }
  });
});

describe('ceilingDemotion', () => {
  const bigPopulation = Array.from({ length: 200 }, (_, i) => i + 1); // p90 = 180

  it('returns null for a fail-open derivation regardless of how fast the implied speed is', () => {
    const failOpen = deriveCeiling('marathon', []);
    expect(ceilingDemotion(1_000_000, failOpen)).toBeNull();
  });

  it('returns null when the implied speed exactly equals ceilingMps (strictness, boundary)', () => {
    const derivation = deriveCeiling('10k', bigPopulation);
    expect(ceilingDemotion(derivation.ceilingMps as number, derivation)).toBeNull();
  });

  it('returns a demotion when the implied speed is one ten-thousandth above ceilingMps', () => {
    const derivation = deriveCeiling('10k', bigPopulation);
    const justAbove = (derivation.ceilingMps as number) + 0.0001;
    const demotion = ceilingDemotion(justAbove, derivation);
    expect(demotion).not.toBeNull();
    expect(demotion?.guard).toBe('ceiling');
  });

  it('the reason string matches the house register: implied speed, exceeds personal ceiling, ceiling value, and a parenthetical with multiplier/p90/population', () => {
    const derivation = deriveCeiling('10k', bigPopulation);
    const justAbove = (derivation.ceilingMps as number) + 0.0001;
    const demotion = ceilingDemotion(justAbove, derivation);
    expect(demotion?.reason).toMatch(
      /^implied \d+\.\d{2} m\/s exceeds personal ceiling \d+\.\d{2} m\/s \(\d+\.\d{2} x p90 \d+\.\d{2} m\/s over \d+ filtered \S+ efforts\)$/
    );
  });

  it('the reason contains no adjective from the forbidden list (implausible, suspicious, unrealistic, bogus)', () => {
    const derivation = deriveCeiling('10k', bigPopulation);
    const justAbove = (derivation.ceilingMps as number) + 0.0001;
    const demotion = ceilingDemotion(justAbove, derivation);
    expect(demotion?.reason).not.toMatch(/implausible|suspicious|unrealistic|bogus/i);
  });

  it('realistic-shape case: a 400m population whose p90 matches the live-measured value demotes an 8.85 m/s effort with the exact reason string', () => {
    // Live 400m figures from 28-CEILING-CALIBRATION.md: n = 1825, p90 =
    // 3.9920 m/s, ceiling = 5.1098 m/s. Construct a 1825-element population
    // whose nearest-rank p90 element (0-based index ceil(0.9*1825)-1 =
    // 1642) is exactly 3.9920, via a tiny per-step increment around that
    // index so the whole array stays strictly increasing (already sorted).
    const n = 1825;
    const p90Index = Math.ceil(0.9 * n) - 1; // 1642
    const population = Array.from({ length: n }, (_, i) => 3.992 + (i - p90Index) * 0.0001);

    const derivation = deriveCeiling('400m', population);
    expect(derivation.populationN).toBe(1825);
    expect(derivation.p90Mps).toBeCloseTo(3.992, 10);
    expect(derivation.ceilingMps).toBeCloseTo(5.1098, 4);

    const demotion = ceilingDemotion(8.85, derivation);
    expect(demotion).not.toBeNull();
    expect(demotion?.guard).toBe('ceiling');
    expect(demotion?.reason).toBe(
      'implied 8.85 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90 3.99 m/s over 1825 filtered 400m efforts)'
    );
  });
});
