import { describe, expect, it } from 'vitest';

import type { ActivityBestEfforts, BestEffort } from '../../analytics/best-effort.types.js';
import type { AgeGradingDocument } from '../../analytics/age-grading.types.js';
import type { ExclusionIndex } from '../../analytics/best-effort-exclusions.js';
import { buildBestEffortsPanelRows, buildPrBadgeLabels } from './detail-best-efforts-logic.js';

function effort(overrides: Partial<BestEffort> & Pick<BestEffort, 'distance'>): BestEffort {
  return {
    durationSec: 1200,
    paceSecPerKm: 240,
    startOffsetSec: 0,
    endOffsetSec: 1200,
    lowConfidence: false,
    wasPRAtTheTime: false,
    excludedFromRecords: false,
    ...overrides,
  };
}

function activity(overrides: Partial<ActivityBestEfforts> = {}): ActivityBestEfforts {
  return {
    activityId: 'a1',
    startDate: '2026-01-01T00:00:00Z',
    distanceSource: 'native',
    efforts: [],
    excludedFromRecords: false,
    ...overrides,
  };
}

describe('buildPrBadgeLabels', () => {
  it('returns [] for a null entry', () => {
    expect(buildPrBadgeLabels(null)).toEqual([]);
  });

  it('returns [] for an entry with no PR-setting efforts', () => {
    const entry = activity({ efforts: [effort({ distance: '5k', wasPRAtTheTime: false })] });
    expect(buildPrBadgeLabels(entry)).toEqual([]);
  });

  it('two PR distances yield exactly two labels, in TARGET_ORDER, with the exact "PR — 5K" formatting', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '10k', wasPRAtTheTime: true }),
        effort({ distance: '5k', wasPRAtTheTime: true }),
        effort({ distance: '1mi', wasPRAtTheTime: false }),
      ],
    });
    expect(buildPrBadgeLabels(entry)).toEqual(['PR — 5K', 'PR — 10K']);
  });

  it('an excluded PR-setting effort yields no badge for it', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: true }),
        effort({ distance: '10k', wasPRAtTheTime: true, excludedFromRecords: false }),
      ],
    });
    expect(buildPrBadgeLabels(entry)).toEqual(['PR — 10K']);
  });

  it('formats every distance display name correctly', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '400m', wasPRAtTheTime: true }),
        effort({ distance: '1k', wasPRAtTheTime: true }),
        effort({ distance: '1mi', wasPRAtTheTime: true }),
        effort({ distance: 'half', wasPRAtTheTime: true }),
        effort({ distance: 'marathon', wasPRAtTheTime: true }),
      ],
    });
    expect(buildPrBadgeLabels(entry)).toEqual([
      'PR — 400m',
      'PR — 1K',
      'PR — 1 Mile',
      'PR — Half Marathon',
      'PR — Marathon',
    ]);
  });
});

describe('buildBestEffortsPanelRows', () => {
  it('returns [] for a null entry', () => {
    expect(buildBestEffortsPanelRows(null, null, null)).toEqual([]);
  });

  it('returns [] for an activity with zero efforts', () => {
    expect(buildBestEffortsPanelRows(activity({ efforts: [] }), null, null)).toEqual([]);
  });

  it('five efforts of which two are PRs yield five rows with isPr true on exactly two', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '400m', wasPRAtTheTime: false }),
        effort({ distance: '1k', wasPRAtTheTime: true }),
        effort({ distance: '1mi', wasPRAtTheTime: false }),
        effort({ distance: '5k', wasPRAtTheTime: true }),
        effort({ distance: '10k', wasPRAtTheTime: false }),
      ],
    });
    const rows = buildBestEffortsPanelRows(entry, null, null);
    expect(rows.length).toBe(5);
    expect(rows.filter((r) => r.isPr).length).toBe(2);
  });

  it('panel rows are ordered by TARGET_ORDER regardless of the source array order', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '10k' }),
        effort({ distance: '400m' }),
        effort({ distance: '5k' }),
      ],
    });
    const rows = buildBestEffortsPanelRows(entry, null, null);
    expect(rows.map((r) => r.distance)).toEqual(['400m', '5k', '10k']);
  });

  it('age-grade joins by (activityId, distance); a missing grade produces null, never 0', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k' }), effort({ distance: '10k' })],
    });
    const ageGrading: AgeGradingDocument = {
      schemaVersion: 1,
      generatedAt: '2026-08-11T00:00:00Z',
      note: 'test',
      enabled: true,
      disabledReason: null,
      editions: { road: '2025', track: '2023' },
      rankings: {},
      activities: {
        a1: { '5k': { agePercent: 62.3, derived: false } },
      },
    };
    const rows = buildBestEffortsPanelRows(entry, ageGrading, null);
    const fiveK = rows.find((r) => r.distance === '5k');
    const tenK = rows.find((r) => r.distance === '10k');
    expect(fiveK?.agePercent).toBe(62.3);
    expect(tenK?.agePercent).toBeNull();
  });

  it('a disabled age-grading document produces null on every row', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k' })],
    });
    const disabledDoc: AgeGradingDocument = {
      schemaVersion: 1,
      generatedAt: '2026-08-11T00:00:00Z',
      note: 'test',
      enabled: false,
      disabledReason: 'no config',
      editions: { road: '2025', track: '2023' },
      rankings: {},
      activities: { a1: { '5k': { agePercent: 99, derived: false } } },
    };
    const rows = buildBestEffortsPanelRows(entry, disabledDoc, null);
    expect(rows[0].agePercent).toBeNull();
  });

  it('a null age-grading document produces null on every row', () => {
    const entry = activity({ efforts: [effort({ distance: '5k' })] });
    const rows = buildBestEffortsPanelRows(entry, null, null);
    expect(rows[0].agePercent).toBeNull();
  });

  it('ageDerived is true only for 1k', () => {
    const entry = activity({
      efforts: [effort({ distance: '1k' }), effort({ distance: '5k' })],
    });
    const rows = buildBestEffortsPanelRows(entry, null, null);
    expect(rows.find((r) => r.distance === '1k')?.ageDerived).toBe(true);
    expect(rows.find((r) => r.distance === '5k')?.ageDerived).toBe(false);
  });

  it('lowConfidence and excluded pass through unchanged from the source effort', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '5k', lowConfidence: true, excludedFromRecords: true }),
        effort({ distance: '10k', lowConfidence: false, excludedFromRecords: false }),
      ],
    });
    const rows = buildBestEffortsPanelRows(entry, null, null);
    const fiveK = rows.find((r) => r.distance === '5k');
    const tenK = rows.find((r) => r.distance === '10k');
    expect(fiveK?.lowConfidence).toBe(true);
    expect(fiveK?.excluded).toBe(true);
    expect(tenK?.lowConfidence).toBe(false);
    expect(tenK?.excluded).toBe(false);
  });
});

describe('GAP-24-01 — panel row exclusion derives from the live exclusions file', () => {
  it('a live index that marks the activity excluded wins over a false precomputed flag (post-Save, pre-Recompute window)', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [
        effort({ distance: '5k', excludedFromRecords: false }),
        effort({ distance: '10k', excludedFromRecords: false }),
      ],
    });
    const liveExclusions: ExclusionIndex = new Map([['a1', 'all']]);
    const rows = buildBestEffortsPanelRows(entry, null, liveExclusions);
    expect(rows.every((r) => r.excluded === true)).toBe(true);
  });

  it('a live index that is loaded and empty overrides a stale true precomputed flag (R11 mirror-image staleness — entry untied from disk, stats not yet recomputed)', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [
        effort({ distance: '5k', excludedFromRecords: true }),
        effort({ distance: '10k', excludedFromRecords: true }),
      ],
    });
    const liveExclusions: ExclusionIndex = new Map();
    const rows = buildBestEffortsPanelRows(entry, null, liveExclusions);
    expect(rows.every((r) => r.excluded === false)).toBe(true);
  });

  it('a null live index (document unreachable or unparseable) falls back to the precomputed excludedFromRecords flag per effort', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [
        effort({ distance: '5k', excludedFromRecords: true }),
        effort({ distance: '10k', excludedFromRecords: false }),
      ],
    });
    const rows = buildBestEffortsPanelRows(entry, null, null);
    const fiveK = rows.find((r) => r.distance === '5k');
    const tenK = rows.find((r) => r.distance === '10k');
    expect(fiveK?.excluded).toBe(true);
    expect(tenK?.excluded).toBe(false);
  });

  it('a distance-scoped live entry badges only the distances it names, even when excludedFromRecords is false on disk (D-05 read tolerance)', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [
        effort({ distance: '5k', excludedFromRecords: false }),
        effort({ distance: '10k', excludedFromRecords: false }),
      ],
    });
    const liveExclusions: ExclusionIndex = new Map([['a1', new Set(['5k'])]]);
    const rows = buildBestEffortsPanelRows(entry, null, liveExclusions);
    const fiveK = rows.find((r) => r.distance === '5k');
    const tenK = rows.find((r) => r.distance === '10k');
    expect(fiveK?.excluded).toBe(true);
    expect(tenK?.excluded).toBe(false);
  });

  it('the live index is keyed on entry.activityId, not hardcoded — an index keyed to a different activity id leaves every row unexcluded', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k', excludedFromRecords: false })],
    });
    const liveExclusions: ExclusionIndex = new Map([['a2', 'all']]);
    const rows = buildBestEffortsPanelRows(entry, null, liveExclusions);
    expect(rows.every((r) => r.excluded === false)).toBe(true);
  });

  it('non-regression: buildPrBadgeLabels still takes exactly one argument and still gates on effort.excludedFromRecords only, with no live state available at all', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: false })],
    });
    expect(buildPrBadgeLabels(entry)).toEqual(['PR — 5K']);
  });
});
