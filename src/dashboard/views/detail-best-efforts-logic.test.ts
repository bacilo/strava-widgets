import { describe, expect, it } from 'vitest';

import type { ActivityBestEfforts, BestEffort, TargetDistanceKey } from '../../analytics/best-effort.types.js';
import type { AgeGradingDocument } from '../../analytics/age-grading.types.js';
import type { ExclusionIndex } from '../../analytics/best-effort-exclusions.js';
import {
  buildBestEffortsPanelRows,
  buildPrBadgeLabels,
  DISTANCE_DISPLAY_NAMES,
  resolveExcluded,
} from './detail-best-efforts-logic.js';

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
    expect(buildPrBadgeLabels(null, null)).toEqual([]);
  });

  it('returns [] for an entry with no PR-setting efforts', () => {
    const entry = activity({ efforts: [effort({ distance: '5k', wasPRAtTheTime: false })] });
    expect(buildPrBadgeLabels(entry, null)).toEqual([]);
  });

  it('two PR distances yield exactly two labels, in TARGET_ORDER, with the exact "PR — 5K" formatting', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '10k', wasPRAtTheTime: true }),
        effort({ distance: '5k', wasPRAtTheTime: true }),
        effort({ distance: '1mi', wasPRAtTheTime: false }),
      ],
    });
    expect(buildPrBadgeLabels(entry, null)).toEqual(['PR — 5K', 'PR — 10K']);
  });

  it('an excluded PR-setting effort yields no badge for it', () => {
    const entry = activity({
      efforts: [
        effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: true }),
        effort({ distance: '10k', wasPRAtTheTime: true, excludedFromRecords: false }),
      ],
    });
    expect(buildPrBadgeLabels(entry, null)).toEqual(['PR — 10K']);
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
    expect(buildPrBadgeLabels(entry, null)).toEqual([
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

});

describe('WR-05 — the header PR badges and the panel rows never disagree in one paint', () => {
  it('post-Save, pre-Recompute: a live index marking the whole activity excluded suppresses every header badge', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: false })],
    });
    const liveExclusions: ExclusionIndex = new Map([['a1', 'all']]);
    expect(buildPrBadgeLabels(entry, liveExclusions)).toEqual([]);
  });

  it('a distance-scoped live entry suppresses only the distances it names (D-05 read tolerance)', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [
        effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: false }),
        effort({ distance: '10k', wasPRAtTheTime: true, excludedFromRecords: false }),
      ],
    });
    const liveExclusions: ExclusionIndex = new Map([['a1', new Set(['5k'])]]);
    expect(buildPrBadgeLabels(entry, liveExclusions)).toEqual(['PR — 10K']);
  });

  it('R19 mirror-image: a loaded-and-empty live index overrides a stale true precomputed flag', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: true })],
    });
    const liveExclusions: ExclusionIndex = new Map();
    expect(buildPrBadgeLabels(entry, liveExclusions)).toEqual(['PR — 5K']);
  });

  it('a null live index means UNKNOWN and falls back to the precomputed flag, never to NOT-EXCLUDED', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [
        effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: true }),
        effort({ distance: '10k', wasPRAtTheTime: true, excludedFromRecords: false }),
      ],
    });
    expect(buildPrBadgeLabels(entry, null)).toEqual(['PR — 10K']);
  });

  it('PRExcluded: the R15 contradiction reproduced as one assertion over both derivations from the same index', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [
        effort({ distance: '400m', wasPRAtTheTime: true, excludedFromRecords: false }),
        effort({ distance: '5k', wasPRAtTheTime: false, excludedFromRecords: false }),
      ],
    });
    const liveExclusions: ExclusionIndex = new Map([['a1', 'all']]);

    const labels = buildPrBadgeLabels(entry, liveExclusions);
    const rows = buildBestEffortsPanelRows(entry, null, liveExclusions);

    expect(labels).toEqual([]);
    expect(rows.some((r) => r.isPr === true && r.excluded === true)).toBe(false);
    expect(rows.every((r) => r.excluded === true)).toBe(true);
  });

  it('isPr is suppressed for a live-excluded row even when wasPRAtTheTime is true — buildPrFlagsCell renders isPr and excluded into the same <td>', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: false })],
    });
    const liveExclusions: ExclusionIndex = new Map([['a1', 'all']]);
    const rows = buildBestEffortsPanelRows(entry, null, liveExclusions);
    expect(rows.every((r) => r.isPr === false)).toBe(true);
  });

  it('isPr is NOT suppressed when the live index is loaded and does not name the activity — stops the fix over-suppressing', () => {
    const entry = activity({
      activityId: 'a1',
      efforts: [effort({ distance: '5k', wasPRAtTheTime: true, excludedFromRecords: true })],
    });
    const liveExclusions: ExclusionIndex = new Map();
    const rows = buildBestEffortsPanelRows(entry, null, liveExclusions);
    expect(rows.find((r) => r.distance === '5k')?.isPr).toBe(true);
  });
});

describe('WR-17 — one definition of excluded, and the two derivations cannot diverge', () => {
  describe('resolveExcluded', () => {
    it('a null live index falls back to a true precomputed flag (UNKNOWN -> excluded)', () => {
      expect(resolveExcluded(null, 'a1', '5k', { excludedFromRecords: true })).toBe(true);
    });

    it('a null live index falls back to a false precomputed flag (UNKNOWN -> not excluded)', () => {
      expect(resolveExcluded(null, 'a1', '5k', { excludedFromRecords: false })).toBe(false);
    });

    it('a loaded-and-empty live index overrides a stale-true precomputed flag (R19/R26 mirror direction, at the helper level)', () => {
      expect(resolveExcluded(new Map(), 'a1', '5k', { excludedFromRecords: true })).toBe(false);
    });

    it("an 'all' live entry excludes regardless of a false precomputed flag", () => {
      const liveExclusions: ExclusionIndex = new Map([['a1', 'all']]);
      expect(resolveExcluded(liveExclusions, 'a1', '5k', { excludedFromRecords: false })).toBe(true);
    });

    it('a distance-scoped live entry does not exclude a distance it does not name (D-05 per-distance read tolerance)', () => {
      const liveExclusions: ExclusionIndex = new Map([['a1', new Set(['5k'])]]);
      expect(resolveExcluded(liveExclusions, 'a1', '10k', { excludedFromRecords: false })).toBe(false);
    });

    it('the index is keyed on the passed activityId, not hardcoded', () => {
      const liveExclusions: ExclusionIndex = new Map([['a2', 'all']]);
      expect(resolveExcluded(liveExclusions, 'a1', '5k', { excludedFromRecords: false })).toBe(false);
    });
  });

  describe('the header PR set and the panel isPr set agree across all 12 reachable combinations', () => {
    const liveExclusionStates: Array<{ name: string; value: ExclusionIndex | null }> = [
      { name: 'null (UNKNOWN, falls back to precomputed flag)', value: null },
      { name: 'loaded-and-empty', value: new Map() },
      { name: "loaded, a1 -> 'all'", value: new Map([['a1', 'all']]) },
    ];

    function distancesFromLabels(labels: string[]): Set<TargetDistanceKey> {
      const entries = Object.entries(DISTANCE_DISPLAY_NAMES) as Array<[TargetDistanceKey, string]>;
      return new Set(
        labels.map((label) => {
          const found = entries.find(([, display]) => label === `PR — ${display}`);
          if (!found) throw new Error(`unparseable PR label: ${label}`);
          return found[0];
        })
      );
    }

    for (const wasPRAtTheTime of [true, false]) {
      for (const excludedFromRecords of [true, false]) {
        for (const liveState of liveExclusionStates) {
          const combo = `wasPRAtTheTime=${wasPRAtTheTime}, excludedFromRecords=${excludedFromRecords}, liveExclusions=${liveState.name}`;

          it(`agree when ${combo}`, () => {
            const effortInput = { excludedFromRecords };
            const entry = activity({
              activityId: 'a1',
              efforts: [effort({ distance: '5k', wasPRAtTheTime, excludedFromRecords })],
            });

            const labels = buildPrBadgeLabels(entry, liveState.value);
            const prDistances = distancesFromLabels(labels);

            const rows = buildBestEffortsPanelRows(entry, null, liveState.value);
            const isPrDistances = new Set(rows.filter((row) => row.isPr).map((row) => row.distance));

            expect(prDistances, `[${combo}] header PR set vs. panel isPr set`).toEqual(isPrDistances);

            expect(
              rows[0].excluded,
              `[${combo}] row.excluded should equal resolveExcluded's own answer, not a re-derivation`
            ).toBe(resolveExcluded(liveState.value, 'a1', '5k', effortInput));
          });
        }
      }
    }
  });
});
