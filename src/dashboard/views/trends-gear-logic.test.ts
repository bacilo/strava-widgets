import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { GearAggregateDocument, GearShoeAggregate } from '../../analytics/gear-aggregate.types.js';
import {
  buildGearChartBuckets,
  coverageSentence,
  GEAR_CHART_MAX_CATEGORIES,
  parseGearAggregate,
  sortShoes,
} from './trends-gear-logic.js';

const liveDoc: unknown = JSON.parse(fs.readFileSync('data/stats/gear-aggregate.json', 'utf-8'));

function fixtureShoe(overrides: Partial<GearShoeAggregate> & { key: string; label: string }): GearShoeAggregate {
  return {
    isUnknown: false,
    runs: 10,
    distanceM: 50000,
    movingTimeSec: 18000,
    avgPaceSecPerKm: 360,
    avgHr: 150,
    runsWithHr: 10,
    firstDate: '2024-01-01',
    lastDate: '2024-06-01',
    ...overrides,
  };
}

describe('parseGearAggregate — live document', () => {
  it('non-null, at least 16 shoes plus Unknown', () => {
    const doc = parseGearAggregate(liveDoc);
    expect(doc).not.toBeNull();
    expect(doc!.shoes.length).toBeGreaterThanOrEqual(16);
    expect(doc!.shoes.some((s) => s.isUnknown)).toBe(true);
  });
});

describe('parseGearAggregate — malformed input', () => {
  it('null/[]/__proto__-keyed input returns null without throwing', () => {
    expect(parseGearAggregate(null)).toBeNull();
    expect(parseGearAggregate([])).toBeNull();

    const proto = JSON.parse('{"__proto__": {"polluted": true}, "shoes": [], "totals": {"runs": 0}}');
    expect(() => parseGearAggregate(proto)).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('sortShoes — Unknown always last', () => {
  const shoes = [
    fixtureShoe({ key: 'a', label: 'Shoe A', distanceM: 1000 }),
    fixtureShoe({ key: 'unknown', label: 'Unknown', isUnknown: true, distanceM: 999999 }),
    fixtureShoe({ key: 'b', label: 'Shoe B', distanceM: 2000 }),
  ];

  it('descending by distanceM: Unknown is last', () => {
    const sorted = sortShoes(shoes, 'distanceM', 'desc');
    expect(sorted[sorted.length - 1].isUnknown).toBe(true);
    expect(sorted[0].label).toBe('Shoe B');
  });

  it('ascending by distanceM: Unknown is still last', () => {
    const sorted = sortShoes(shoes, 'distanceM', 'asc');
    expect(sorted[sorted.length - 1].isUnknown).toBe(true);
    expect(sorted[0].label).toBe('Shoe A');
  });
});

describe('sortShoes — nulls sort last in both directions', () => {
  const shoes = [
    fixtureShoe({ key: 'a', label: 'A', avgHr: 150 }),
    fixtureShoe({ key: 'b', label: 'B', avgHr: null }),
    fixtureShoe({ key: 'c', label: 'C', avgHr: 160 }),
  ];

  it('descending: null comes last', () => {
    const sorted = sortShoes(shoes, 'avgHr', 'desc');
    expect(sorted[sorted.length - 1].avgHr).toBeNull();
  });

  it('ascending: null comes last', () => {
    const sorted = sortShoes(shoes, 'avgHr', 'asc');
    expect(sorted[sorted.length - 1].avgHr).toBeNull();
  });
});

describe('sortShoes — label ordering documented behaviour', () => {
  it('ascending label sort is plain lexicographic ("Shoe 10" before "Shoe 9")', () => {
    const shoes = [
      fixtureShoe({ key: 's9', label: 'Shoe 9' }),
      fixtureShoe({ key: 's10', label: 'Shoe 10' }),
    ];
    const sorted = sortShoes(shoes, 'label', 'asc');
    expect(sorted.map((s) => s.label)).toEqual(['Shoe 10', 'Shoe 9']);
  });
});

describe('buildGearChartBuckets — top 8 plus Other', () => {
  it('12 named shoes yields 8 named buckets plus one Other bucket with mergedCount === 4', () => {
    const shoes: GearShoeAggregate[] = [];
    for (let i = 1; i <= 12; i++) {
      shoes.push(fixtureShoe({ key: `s${i}`, label: `Shoe ${i}`, distanceM: 13000 - i * 1000 }));
    }

    const { buckets, caption } = buildGearChartBuckets(shoes);
    const named = buckets.filter((b) => !b.isOther);
    const other = buckets.filter((b) => b.isOther);

    expect(named).toHaveLength(8);
    expect(other).toHaveLength(1);
    expect(other[0].mergedCount).toBe(4);

    const expectedOtherDistance = shoes
      .slice()
      .sort((a, b) => b.distanceM - a.distanceM)
      .slice(8)
      .reduce((sum, s) => sum + s.distanceM, 0);
    expect(other[0].distanceM).toBe(expectedOtherDistance);
    expect(caption).toContain('Top 8 shoes shown by distance');
  });
});

describe('buildGearChartBuckets — 8 or fewer named shoes', () => {
  it('no Other bucket and an empty caption', () => {
    const shoes: GearShoeAggregate[] = [];
    for (let i = 1; i <= 5; i++) {
      shoes.push(fixtureShoe({ key: `s${i}`, label: `Shoe ${i}`, distanceM: 1000 * i }));
    }
    const { buckets, caption } = buildGearChartBuckets(shoes);
    expect(buckets.every((b) => !b.isOther)).toBe(true);
    expect(caption).toBe('');
  });
});

describe('buildGearChartBuckets — Unknown never in buckets', () => {
  it('excludes Unknown even when it has the largest distanceM of all', () => {
    const shoes = [
      fixtureShoe({ key: 'a', label: 'Shoe A', distanceM: 1000 }),
      fixtureShoe({ key: 'unknown', label: 'Unknown', isUnknown: true, distanceM: 9999999 }),
    ];
    const { buckets } = buildGearChartBuckets(shoes);
    expect(buckets.some((b) => b.label === 'Unknown')).toBe(false);
  });
});

describe('coverageSentence — live totals', () => {
  it('contains the real archive-wide percentage and the most recent year percentage, with no hardcoded number in the source', () => {
    const doc = parseGearAggregate(liveDoc)!;
    const sentence = coverageSentence(doc.totals, doc.byYear);

    expect(sentence).toContain(`${doc.totals.percentWithGear.toFixed(1)}%`);
    const mostRecent = doc.byYear[doc.byYear.length - 1];
    expect(sentence).toContain(`${mostRecent.percentWithGear.toFixed(1)}%`);
    expect(sentence).toContain(String(mostRecent.year));
  });
});

describe('coverageSentence — empty input', () => {
  it('handles zero runs without dividing by zero', () => {
    expect(() =>
      coverageSentence({ runs: 0, runsWithGear: 0, runsWithoutGear: 0, percentWithGear: 0, distinctShoes: 0 }, [])
    ).not.toThrow();
    const sentence = coverageSentence(
      { runs: 0, runsWithGear: 0, runsWithoutGear: 0, percentWithGear: 0, distinctShoes: 0 },
      []
    );
    expect(sentence).toContain('0 of 0 runs');
  });
});

describe('buildGearChartBuckets — empty shoe list', () => {
  it('returns empty buckets and an empty caption without throwing', () => {
    expect(() => buildGearChartBuckets([])).not.toThrow();
    const { buckets, caption } = buildGearChartBuckets([]);
    expect(buckets).toEqual([]);
    expect(caption).toBe('');
  });
});

describe('GEAR_CHART_MAX_CATEGORIES', () => {
  it('is 8', () => {
    expect(GEAR_CHART_MAX_CATEGORIES).toBe(8);
  });
});
