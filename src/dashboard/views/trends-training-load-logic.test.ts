import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { DailyLoadEntry, TrainingLoadDocument } from '../../analytics/training-load.types.js';
import {
  coverageCaption,
  DEFAULT_LOAD_WINDOW,
  findThinCoverageSpans,
  parseLoadWindow,
  parseTrainingLoad,
  parseTrimpModel,
  selectModelSeries,
  sliceLoadWindow,
  TRAINING_LOAD_WINDOWS,
} from './trends-training-load-logic.js';

const liveDoc: unknown = JSON.parse(fs.readFileSync('data/stats/training-load.json', 'utf-8'));

function fixtureDay(overrides: Partial<DailyLoadEntry> & { date: string }): DailyLoadEntry {
  return {
    runs: 0,
    runsWithHr: 0,
    edwards: { trimp: 0, ctl: 0, atl: 0, tsb: 0 },
    banister: null,
    ...overrides,
  };
}

describe('parseTrainingLoad — live document', () => {
  it('non-null, days.length matches the recomputed spine length', () => {
    const doc = parseTrainingLoad(liveDoc);
    expect(doc).not.toBeNull();
    expect(doc!.days.length).toBeGreaterThan(0);
    expect(doc!.days.length).toBe((liveDoc as TrainingLoadDocument).days.length);
  });
});

describe('parseTrainingLoad — malformed input', () => {
  it('null/{}/[]/__proto__-keyed input returns null or an empty result without throwing', () => {
    expect(parseTrainingLoad(null)).toBeNull();
    expect(parseTrainingLoad({})).toBeNull();
    expect(parseTrainingLoad([])).toBeNull();

    const proto = JSON.parse('{"__proto__": {"polluted": true}, "days": []}');
    expect(() => parseTrainingLoad(proto)).not.toThrow();
    const result = parseTrainingLoad(proto);
    expect(result).not.toBeNull();
    expect(result!.days).toEqual([]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('parseTrimpModel', () => {
  it('returns edwards when banister is requested but the document reports it disabled', () => {
    const doc: TrainingLoadDocument = {
      schemaVersion: 1,
      generatedAt: '',
      note: '',
      timeConstants: { ctlDays: 42, atlDays: 7 },
      models: { edwards: true, banister: false },
      banisterDisabledReason: 'no identity config',
      firstDate: '2024-01-01',
      lastDate: '2024-01-01',
      totals: { daysInSpine: 0, activitiesConsidered: 0, activitiesWithHr: 0, activitiesWithoutHr: 0, activitiesUnreadable: 0 },
      days: [],
    };
    expect(parseTrimpModel('banister', doc)).toBe('edwards');
  });

  it('returns banister when the document reports it enabled', () => {
    const doc: TrainingLoadDocument = {
      schemaVersion: 1,
      generatedAt: '',
      note: '',
      timeConstants: { ctlDays: 42, atlDays: 7 },
      models: { edwards: true, banister: true },
      banisterDisabledReason: null,
      firstDate: '2024-01-01',
      lastDate: '2024-01-01',
      totals: { daysInSpine: 0, activitiesConsidered: 0, activitiesWithHr: 0, activitiesWithoutHr: 0, activitiesUnreadable: 0 },
      days: [],
    };
    expect(parseTrimpModel('banister', doc)).toBe('banister');
  });

  it('unknown values return edwards', () => {
    expect(parseTrimpModel('nonsense', null)).toBe('edwards');
    expect(parseTrimpModel(null, null)).toBe('edwards');
  });
});

describe('parseLoadWindow', () => {
  it('allow-list including null, empty string, and an unknown string', () => {
    expect(parseLoadWindow(null)).toBe(DEFAULT_LOAD_WINDOW);
    expect(parseLoadWindow('')).toBe(DEFAULT_LOAD_WINDOW);
    expect(parseLoadWindow('bogus')).toBe(DEFAULT_LOAD_WINDOW);
    for (const w of TRAINING_LOAD_WINDOWS) {
      expect(parseLoadWindow(w)).toBe(w);
    }
  });
});

describe('sliceLoadWindow', () => {
  const days: DailyLoadEntry[] = [];
  const start = new Date('2023-01-01T00:00:00Z');
  for (let i = 0; i < 500; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    days.push(fixtureDay({ date: d.toISOString().slice(0, 10) }));
  }
  const now = new Date(start.getTime() + 499 * 24 * 60 * 60 * 1000);

  it('3mo yields ~90 entries', () => {
    const sliced = sliceLoadWindow(days, '3mo', now);
    expect(sliced.length).toBeGreaterThanOrEqual(88);
    expect(sliced.length).toBeLessThanOrEqual(92);
  });

  it('12mo yields ~365 entries', () => {
    const sliced = sliceLoadWindow(days, '12mo', now);
    expect(sliced.length).toBeGreaterThanOrEqual(363);
    expect(sliced.length).toBeLessThanOrEqual(367);
  });

  it('all yields the full array', () => {
    const sliced = sliceLoadWindow(days, 'all', now);
    expect(sliced.length).toBe(500);
  });

  it('the source array is unmutated', () => {
    const originalLength = days.length;
    sliceLoadWindow(days, '3mo', now);
    expect(days.length).toBe(originalLength);
  });
});

describe('selectModelSeries', () => {
  it('model: banister over days whose banister is null returns [], not zeros', () => {
    const days = [
      fixtureDay({ date: '2024-01-01', banister: null }),
      fixtureDay({ date: '2024-01-02', banister: null }),
    ];
    expect(selectModelSeries(days, 'banister')).toEqual([]);
  });

  it('model: edwards always returns points', () => {
    const days = [fixtureDay({ date: '2024-01-01', edwards: { trimp: 10, ctl: 1, atl: 2, tsb: -1 } })];
    const series = selectModelSeries(days, 'edwards');
    expect(series).toHaveLength(1);
    expect(series[0].ctl).toBe(1);
  });
});

describe('findThinCoverageSpans — runs but no HR', () => {
  it('five consecutive days with runs>0 and runsWithHr===0 produce one span with the correct runsWithoutHr total', () => {
    const days = [
      fixtureDay({ date: '2024-01-01', runs: 1, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-02', runs: 1, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-03', runs: 2, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-04', runs: 1, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-05', runs: 1, runsWithHr: 0 }),
    ];
    const spans = findThinCoverageSpans(days);
    expect(spans).toHaveLength(1);
    expect(spans[0].days).toBe(5);
    expect(spans[0].runsWithoutHr).toBe(6);
    expect(spans[0].startDate).toBe('2024-01-01');
    expect(spans[0].endDate).toBe('2024-01-05');
  });
});

describe('findThinCoverageSpans — pure rest is not a span', () => {
  it('five consecutive days with runs === 0 produce zero spans', () => {
    const days = [
      fixtureDay({ date: '2024-01-01', runs: 0, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-02', runs: 0, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-03', runs: 0, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-04', runs: 0, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-05', runs: 0, runsWithHr: 0 }),
    ];
    expect(findThinCoverageSpans(days)).toEqual([]);
  });
});

describe('findThinCoverageSpans — mixed', () => {
  it('a rest gap adjacent to a no-HR run block yields one span whose boundaries include only the run days', () => {
    const days = [
      fixtureDay({ date: '2024-01-01', runs: 0, runsWithHr: 0 }), // rest
      fixtureDay({ date: '2024-01-02', runs: 0, runsWithHr: 0 }), // rest
      fixtureDay({ date: '2024-01-03', runs: 1, runsWithHr: 0 }), // no-HR run
      fixtureDay({ date: '2024-01-04', runs: 1, runsWithHr: 0 }), // no-HR run
    ];
    const spans = findThinCoverageSpans(days);
    expect(spans).toHaveLength(1);
    expect(spans[0].startDate).toBe('2024-01-01');
    expect(spans[0].endDate).toBe('2024-01-04');
    expect(spans[0].runsWithoutHr).toBe(2);
  });

  it('two no-HR blocks separated by a day with HR yield two distinct spans', () => {
    const days = [
      fixtureDay({ date: '2024-01-01', runs: 1, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-02', runs: 1, runsWithHr: 1 }), // has HR, breaks the span
      fixtureDay({ date: '2024-01-03', runs: 1, runsWithHr: 0 }),
    ];
    const spans = findThinCoverageSpans(days);
    expect(spans).toHaveLength(2);
    expect(spans[0].startDate).toBe('2024-01-01');
    expect(spans[1].startDate).toBe('2024-01-03');
  });
});

describe('findThinCoverageSpans — single isolated day', () => {
  it('a single isolated no-HR run day yields a one-day span', () => {
    const days = [
      fixtureDay({ date: '2024-01-01', runs: 1, runsWithHr: 1 }),
      fixtureDay({ date: '2024-01-02', runs: 1, runsWithHr: 0 }),
      fixtureDay({ date: '2024-01-03', runs: 1, runsWithHr: 1 }),
    ];
    const spans = findThinCoverageSpans(days);
    expect(spans).toHaveLength(1);
    expect(spans[0].days).toBe(1);
    expect(spans[0].startDate).toBe('2024-01-02');
    expect(spans[0].endDate).toBe('2024-01-02');
  });
});

describe('findThinCoverageSpans — live document', () => {
  it('at least one span, every runsWithoutHr > 0, total shaded days far smaller than the spine length', () => {
    const doc = parseTrainingLoad(liveDoc)!;
    const spans = findThinCoverageSpans(doc.days);
    expect(spans.length).toBeGreaterThan(0);
    for (const s of spans) {
      expect(s.runsWithoutHr).toBeGreaterThan(0);
    }
    const totalDays = spans.reduce((sum, s) => sum + s.days, 0);
    expect(totalDays).toBeLessThan(doc.days.length * 0.5);
  });
});

describe('coverageCaption', () => {
  it('returns the exact copy for a non-empty span list', () => {
    const spans = findThinCoverageSpans([
      fixtureDay({ date: '2024-01-01', runs: 1, runsWithHr: 0 }),
    ]);
    expect(coverageCaption(spans)).toBe('Shaded regions indicate no HR data (not zero training).');
  });

  it('returns "" for an empty span list', () => {
    expect(coverageCaption([])).toBe('');
  });
});
