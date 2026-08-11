import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { BestEffortsDocument, ActivityBestEfforts, PRRankingEntry } from './best-effort.types.js';
import { computeAgeGrading } from './compute-age-grading.js';

// The exact user-facing copy the Records page renders when age-grading is
// off (18-UI-SPEC's Copywriting Contract, path corrected per plan 18-01's
// locked deviation). Duplicated here deliberately so a drift between the
// module and this string is caught by the test, not silently absorbed.
const DISABLED_REASON =
  'Age-grading is off — add birthDate and sex to data/private/athlete-private.json to enable it.';

/**
 * A minimal, self-contained WMA factor table fixture — NOT the real
 * committed data/wma/*.json. `wma-factors.test.ts` (plan 18-02) owns
 * formula-level correctness against the real tables; this file only needs
 * enough shape to exercise the wiring and degradation contract.
 *
 * Female deliberately lacks a '10k' entry (only '5k' is populated) so a
 * female athlete's 10k effort has nowhere to resolve — the fixture for the
 * "null grade is omitted" case (item 6) below.
 */
function roadFactorsFixture() {
  return {
    schemaVersion: 1,
    surface: 'road',
    edition: 'fixture-road-2025',
    source: 'fixture',
    openStandardSec: {
      male: { '5k': 800, '10k': 1700, half: 3800, marathon: 8000 },
      female: { '5k': 900 },
    },
    factors: {
      male: {
        '5k': { '20': 0.95, '30': 1.0, '40': 0.97, '50': 0.9, '70': 0.75 },
        '10k': { '30': 1.0 },
        half: { '30': 1.0 },
        marathon: { '30': 1.0 },
      },
      female: {
        '5k': { '30': 1.0 },
      },
    },
  };
}

function trackFactorsFixture() {
  return {
    schemaVersion: 1,
    surface: 'track',
    edition: 'fixture-track-2023',
    source: 'fixture',
    openStandardSec: {
      male: { '400m': 43, '800m': 100, '1mi': 218 },
      female: { '400m': 48, '800m': 113, '1mi': 246 },
    },
    factors: {
      male: {
        '400m': { '30': 1.0 },
        '800m': { '30': 1.0 },
        '1mi': { '30': 1.0 },
      },
      female: {
        '400m': { '30': 1.0 },
        '800m': { '30': 1.0 },
        '1mi': { '30': 1.0 },
      },
    },
  };
}

describe('computeAgeGrading — cross-referencing and degradation contract', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'age-grading-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const baseOptions = () => ({
    statsDir: path.join(tmpDir, 'stats'),
    wmaDir: path.join(tmpDir, 'wma'),
    athletePrivatePath: path.join(tmpDir, 'private', 'athlete-private.json'),
  });

  async function writeWmaTables(): Promise<void> {
    await fileStore.writeJson('wma/road-factors.json', roadFactorsFixture());
    await fileStore.writeJson('wma/track-factors.json', trackFactorsFixture());
  }

  async function writeBestEfforts(doc: Partial<BestEffortsDocument>): Promise<void> {
    await fileStore.writeJson('stats/best-efforts.json', {
      schemaVersion: 1,
      generatedAt: '',
      note: 'fixture best-efforts',
      totals: {
        activitiesConsidered: 0,
        activitiesWithEfforts: 0,
        effortsComputed: 0,
        effortsRejected: 0,
        effortsExcluded: 0,
        lowConfidenceEfforts: 0,
        skippedNoStream: 0,
        skippedUnreadable: 0,
      },
      rankings: {
        '400m': [],
        '1k': [],
        '1mi': [],
        '5k': [],
        '10k': [],
        half: [],
        marathon: [],
      },
      rejected: [],
      activities: {},
      ...doc,
    });
  }

  async function writeAthletePrivate(config: Record<string, unknown> | null): Promise<void> {
    if (config === null) return; // deliberately not written — the "no config" case
    await fileStore.writeJson('private/athlete-private.json', config);
  }

  function rankingEntry(overrides: Partial<PRRankingEntry> & { activityId: string; startDate: string }): PRRankingEntry {
    return {
      rank: 1,
      durationSec: 1000,
      paceSecPerKm: 200,
      lowConfidence: false,
      ...overrides,
    };
  }

  function activityEntry(overrides: Partial<ActivityBestEfforts> & { activityId: string; startDate: string }): ActivityBestEfforts {
    return {
      distanceSource: 'native',
      efforts: [],
      excludedFromRecords: false,
      ...overrides,
    };
  }

  // 1. No private config.
  it('with no private config: enabled is false, disabledReason matches the Copywriting Contract exactly, rankings/activities are both empty, and the step does not throw', async () => {
    await writeWmaTables();
    await writeBestEfforts({});
    await writeAthletePrivate(null);

    const doc = await computeAgeGrading(baseOptions());

    expect(doc.enabled).toBe(false);
    expect(doc.disabledReason).toBe(DISABLED_REASON);
    expect(Object.keys(doc.rankings)).toHaveLength(0);
    expect(Object.keys(doc.activities)).toHaveLength(0);
  });

  // 2. Valid private config — wiring check (one hand-computed value).
  it('with a valid private config: enabled is true, disabledReason is null, and a ranking agePercent matches a hand-computed value from the fixture table', async () => {
    await writeWmaTables();
    await writeBestEfforts({
      rankings: {
        '400m': [],
        '1k': [],
        '1mi': [],
        // birthDate 1994-01-01, effort at 2024-01-02 -> age 30 (peak factor 1.0).
        // percent = openStandard(800) / actualSec(1000) / factor(1.0) * 100 = 80.0
        '5k': [rankingEntry({ activityId: 'act5k', startDate: '2024-01-02T00:00:00Z', durationSec: 1000 })],
        '10k': [],
        half: [],
        marathon: [],
      },
    });
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1994-01-01', sex: 'male', restingHr: null });

    const doc = await computeAgeGrading(baseOptions());

    expect(doc.enabled).toBe(true);
    expect(doc.disabledReason).toBeNull();
    const entry = doc.rankings['5k']?.[0];
    expect(entry).toBeDefined();
    expect(entry?.agePercent).toBe(80.0);
  });

  // 3. Age-at-effort-date, not age-today — directional.
  it('grades age at the EFFORT date, not today: for identical durationSec, the older-at-effort-time entry grades higher than the younger one', async () => {
    await writeWmaTables();
    await writeBestEfforts({
      rankings: {
        '400m': [],
        '1k': [],
        '1mi': [],
        '5k': [
          // birthDate 1974-01-01: age 20 at 1994-01-02, age 50 at 2024-01-02.
          // factor(age20)=0.95 -> percent = 800/1000/0.95*100 = 84.2
          // factor(age50)=0.90 -> percent = 800/1000/0.90*100 = 88.9
          rankingEntry({ rank: 1, activityId: 'young', startDate: '1994-01-02T00:00:00Z', durationSec: 1000 }),
          rankingEntry({ rank: 2, activityId: 'old', startDate: '2024-01-02T00:00:00Z', durationSec: 1000 }),
        ],
        '10k': [],
        half: [],
        marathon: [],
      },
    });
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1974-01-01', sex: 'male', restingHr: null });

    const doc = await computeAgeGrading(baseOptions());

    const byId = Object.fromEntries((doc.rankings['5k'] ?? []).map((e) => [e.activityId, e]));
    expect(byId['young']).toBeDefined();
    expect(byId['old']).toBeDefined();
    // Directional: the OLDER-at-effort-time athlete grades higher for an
    // identical time, not merely "the two values differ". A bug that
    // substitutes today's date for the effort's date would either produce
    // an identical percent for both (same "today" age) or the wrong
    // direction; this assertion fails either way.
    expect(byId['old'].agePercent).toBeGreaterThan(byId['young'].agePercent);
  });

  // 4. derived true only for 1k.
  it('derived is true for 1k and false for every other resolvable distance', async () => {
    await writeWmaTables();
    await writeBestEfforts({
      rankings: {
        // birthDate 1994-01-01, all efforts at 2024-01-02 -> age 30 (factor 1.0 everywhere fixtured).
        '400m': [rankingEntry({ activityId: 'a400', startDate: '2024-01-02T00:00:00Z', durationSec: 43 })],
        '1k': [rankingEntry({ activityId: 'a1k', startDate: '2024-01-02T00:00:00Z', durationSec: 240 })],
        '1mi': [rankingEntry({ activityId: 'a1mi', startDate: '2024-01-02T00:00:00Z', durationSec: 218 })],
        '5k': [rankingEntry({ activityId: 'a5k', startDate: '2024-01-02T00:00:00Z', durationSec: 800 })],
        '10k': [rankingEntry({ activityId: 'a10k', startDate: '2024-01-02T00:00:00Z', durationSec: 1700 })],
        half: [rankingEntry({ activityId: 'ahalf', startDate: '2024-01-02T00:00:00Z', durationSec: 3800 })],
        marathon: [],
      },
    });
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1994-01-01', sex: 'male', restingHr: null });

    const doc = await computeAgeGrading(baseOptions());

    expect(doc.rankings['1k']?.[0]?.derived).toBe(true);
    expect(doc.rankings['400m']?.[0]?.derived).toBe(false);
    expect(doc.rankings['1mi']?.[0]?.derived).toBe(false);
    expect(doc.rankings['5k']?.[0]?.derived).toBe(false);
    expect(doc.rankings['10k']?.[0]?.derived).toBe(false);
    expect(doc.rankings['half']?.[0]?.derived).toBe(false);
    // Sixth non-1k distance (marathon) covered separately via `activities`
    // in the next test, since `rankings.marathon` is deliberately empty
    // here (item 5) — see below.
  });

  // 5. marathon rankings empty in, empty out.
  it('rankings.marathon is an empty array in the fixture and an empty array in the output — no crash, no synthesized entry', async () => {
    await writeWmaTables();
    await writeBestEfforts({});
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1994-01-01', sex: 'male', restingHr: null });

    const doc = await computeAgeGrading(baseOptions());

    expect(doc.rankings['marathon']).toEqual([]);
  });

  // 6. A null grade is omitted, not emitted as 0.
  it('an effort whose resolveAgeGrade returns null is omitted from activities, not emitted as 0', async () => {
    await writeWmaTables();
    await writeBestEfforts({
      activities: {
        // Female + 10k has no factor table entry in the fixture (item 6's
        // deliberate gap) — age doesn't matter, the lookup itself is absent.
        femaleActivity: activityEntry({
          activityId: 'femaleActivity',
          startDate: '2024-01-02T00:00:00Z',
          efforts: [
            {
              distance: '10k',
              durationSec: 1700,
              paceSecPerKm: 170,
              startOffsetSec: 0,
              endOffsetSec: 1700,
              lowConfidence: false,
              wasPRAtTheTime: true,
              excludedFromRecords: false,
            },
          ],
        }),
      },
    });
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1994-01-01', sex: 'female', restingHr: null });

    const doc = await computeAgeGrading(baseOptions());

    const graded = doc.activities['femaleActivity'];
    expect(graded).toBeDefined();
    expect(graded && Object.prototype.hasOwnProperty.call(graded, '10k')).toBe(false);
  });

  // 7. activities covers non-PR efforts too.
  it('activities covers every effort, not only PR-setting ones: a fixture activity with 3 efforts (1 PR) yields 3 graded entries', async () => {
    await writeWmaTables();
    await writeBestEfforts({
      activities: {
        multiEffort: activityEntry({
          activityId: 'multiEffort',
          startDate: '2024-01-02T00:00:00Z',
          efforts: [
            {
              distance: '400m',
              durationSec: 43,
              paceSecPerKm: 107.5,
              startOffsetSec: 0,
              endOffsetSec: 43,
              lowConfidence: false,
              wasPRAtTheTime: false,
              excludedFromRecords: false,
            },
            {
              distance: '1k',
              durationSec: 240,
              paceSecPerKm: 240,
              startOffsetSec: 0,
              endOffsetSec: 240,
              lowConfidence: false,
              wasPRAtTheTime: true, // the only PR-setting effort in this activity
              excludedFromRecords: false,
            },
            {
              distance: '5k',
              durationSec: 800,
              paceSecPerKm: 160,
              startOffsetSec: 0,
              endOffsetSec: 800,
              lowConfidence: false,
              wasPRAtTheTime: false,
              excludedFromRecords: false,
            },
          ],
        }),
      },
    });
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1994-01-01', sex: 'male', restingHr: null });

    const doc = await computeAgeGrading(baseOptions());

    const graded = doc.activities['multiEffort'];
    expect(graded).toBeDefined();
    expect(Object.keys(graded ?? {})).toHaveLength(3);
  });

  // 8. Missing best-efforts.json throws, naming compute-best-efforts.
  it('a missing best-efforts.json throws, naming compute-best-efforts as the prerequisite', async () => {
    await writeWmaTables();
    // best-efforts.json deliberately not written.
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1994-01-01', sex: 'male', restingHr: null });

    await expect(computeAgeGrading(baseOptions())).rejects.toThrow(/compute-best-efforts/);
  });

  // 9. Missing/malformed WMA table throws, naming the converter script.
  it('a malformed WMA table throws, naming scripts/convert-wma-tables.mjs', async () => {
    await fileStore.writeJson('wma/road-factors.json', { not: 'a valid table' });
    await fileStore.writeJson('wma/track-factors.json', trackFactorsFixture());
    await writeBestEfforts({});
    await writeAthletePrivate({ schemaVersion: 1, birthDate: '1994-01-01', sex: 'male', restingHr: null });

    await expect(computeAgeGrading(baseOptions())).rejects.toThrow(/scripts\/convert-wma-tables\.mjs/);
  });

  // 10. sex present but birthDate malformed -> parseAthletePrivateConfig rejects -> enabled: false, no NaN age.
  it('a private config with a malformed birthDate is rejected upstream, reporting enabled: false rather than grading against a NaN age', async () => {
    await writeWmaTables();
    await writeBestEfforts({});
    await writeAthletePrivate({ schemaVersion: 1, birthDate: 'not-a-date', sex: 'male', restingHr: null });

    const doc = await computeAgeGrading(baseOptions());

    expect(doc.enabled).toBe(false);
    expect(doc.disabledReason).toBe(DISABLED_REASON);
  });
});
