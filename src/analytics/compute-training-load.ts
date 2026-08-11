/**
 * Manifest-driven training-load computation over the committed stream
 * archive (TREND-04, D-14, D-15, D-16, D-20).
 *
 * Reads the Phase 14 stream manifest (`data/streams/manifest.json`) plus
 * per-activity canonical activity JSON and stream JSON, computes Edwards and
 * Banister TRIMP per activity (plan 18-03's `trimp.ts`), and writes the
 * gitignored `data/stats/training-load.json` continuous daily CTL/ATL/TSB
 * document (plan 18-03's `training-load.ts`) that Phase 18's Trends UI
 * reads and never recomputes.
 *
 * D-20: the stream archive is ~142 MB across ~1,687 files — this sweep is a
 * build-time-only job, never run in the browser.
 *
 * Mirrors `compute-best-efforts.ts`'s structure: a required manifest input
 * (throws), optional inputs that warn-and-degrade rather than abort, and a
 * per-activity `try/catch` that logs and continues so one bad file can
 * never lose the rest of the archive.
 */

import * as path from 'path';

import type { AthleteConfig } from '../dashboard/views/detail-zones.js';
import { parseAthleteConfig } from '../dashboard/views/detail-zones.js';
import type { AthletePrivateConfig } from './athlete-private.js';
import { loadAthletePrivateConfig } from './athlete-private.js';
import { computeActivityTrimp } from './trimp.js';
import { ATL_TAU_DAYS, CTL_TAU_DAYS, computeCtlAtlTsb } from './training-load.js';
import type { DailyLoadEntry, TrainingLoadDocument } from './training-load.types.js';
import { TRAINING_LOAD_SCHEMA_VERSION } from './training-load.types.js';
import type { CanonicalStream, StreamManifest } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';

/** Rounds to at most two decimal places (the archive's ~5,500-day span makes unrounded floats roughly triple the published file for no readable precision). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normalized calendar day (`YYYY-MM-DD`, UTC) for an activity's
 * `start_date_local`. Z-suffixed values parse as UTC directly; no-`Z`
 * intervals.icu values are made comparable by appending `Z` before parsing
 * (mirrors `compute-dashboard-index.ts`'s `startDateSortKey`). Returns
 * `null` for an unparseable value rather than corrupting the whole spine.
 */
function toCalendarDay(startDateLocal: string): string | null {
  const normalized = startDateLocal.endsWith('Z') ? startDateLocal : `${startDateLocal}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function bump(map: Map<string, number>, key: string, delta: number): void {
  map.set(key, (map.get(key) ?? 0) + delta);
}

/** Options for `computeTrainingLoad`, each defaulted to the repo's standard data layout. */
export interface ComputeTrainingLoadOptions {
  activitiesDir?: string;
  streamsDir?: string;
  streamsManifestPath?: string;
  athleteConfigPath?: string;
  athletePrivatePath?: string;
  statsDir?: string;
}

/** Canonical, hardcoded path names used in operator-facing messages — deliberately NOT the (possibly overridden) option values, so the guidance always names the real committed location. */
const CANONICAL_ATHLETE_CONFIG_PATH = 'data/config/athlete.json';
const CANONICAL_ATHLETE_PRIVATE_PATH = 'data/private/athlete-private.json';

/**
 * Reads the stream manifest, sweeps every manifest activity's stream for
 * Edwards and (when available) Banister TRIMP, and writes
 * `<statsDir>/training-load.json` atomically. Returns the document as well
 * as writing it, so tests can assert without re-reading the file.
 */
export async function computeTrainingLoad(
  options: ComputeTrainingLoadOptions = {}
): Promise<TrainingLoadDocument> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const streamsDir = options.streamsDir || 'data/streams';
  const streamsManifestPath = options.streamsManifestPath || 'data/streams/manifest.json';
  const athleteConfigPath = options.athleteConfigPath || 'data/config/athlete.json';
  const athletePrivatePath = options.athletePrivatePath || 'data/private/athlete-private.json';
  const statsDir = options.statsDir || 'data/stats';

  const fileStore = new FileStore('.');

  console.log(`Computing training load from manifest: ${streamsManifestPath}`);

  // REQUIRED — without the manifest there is nothing to sweep.
  let manifest: StreamManifest;
  try {
    manifest = await fileStore.readJson<StreamManifest>(streamsManifestPath);
  } catch (error) {
    throw new Error(
      `Stream manifest not found at ${streamsManifestPath} (${(error as Error).message}). ` +
        `Please run: npm run backfill-streams`
    );
  }

  // REQUIRED-FOR-ANYTHING — without valid zone boundaries neither model can
  // run at all (D-14: Edwards' only input is these five bpm boundaries).
  // Non-blocking-failure convention: report, never throw.
  let athleteConfig: AthleteConfig | null = null;
  try {
    const raw = await fileStore.readJson<unknown>(athleteConfigPath);
    athleteConfig = parseAthleteConfig(raw);
  } catch {
    athleteConfig = null;
  }

  if (!athleteConfig) {
    const reason =
      `Edwards and Banister TRIMP both disabled: ${CANONICAL_ATHLETE_CONFIG_PATH} is missing ` +
      `or invalid (maxHr/hrZones required).`;
    console.warn(reason);

    const doc: TrainingLoadDocument = {
      schemaVersion: TRAINING_LOAD_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      note:
        'Derived, gitignored, and regenerated by `node dist/index.js compute-training-load`. ' +
        'Consumers read this file rather than recomputing.',
      timeConstants: { ctlDays: CTL_TAU_DAYS, atlDays: ATL_TAU_DAYS },
      models: { edwards: false, banister: false },
      banisterDisabledReason: reason,
      firstDate: '',
      lastDate: '',
      totals: {
        daysInSpine: 0,
        activitiesConsidered: 0,
        activitiesWithHr: 0,
        activitiesWithoutHr: 0,
        activitiesUnreadable: 0,
      },
      days: [],
    };

    await fileStore.writeJson(path.join(statsDir, 'training-load.json'), doc);
    return doc;
  }

  const zones = athleteConfig.hrZones;

  // OPTIONAL — never throws (loadAthletePrivateConfig's own contract).
  const privateConfig: AthletePrivateConfig | null = await loadAthletePrivateConfig(
    fileStore,
    athletePrivatePath
  );

  let banisterEnabled = false;
  let banisterDisabledReason: string | null = null;
  let banisterInputs: { restingHr: number; maxHr: number; sex: 'male' | 'female' } | null = null;

  if (privateConfig === null) {
    banisterDisabledReason =
      `Banister TRIMP disabled: ${CANONICAL_ATHLETE_PRIVATE_PATH} is missing or invalid ` +
      `(birthDate and sex required).`;
  } else if (privateConfig.restingHr === null) {
    banisterDisabledReason =
      `Banister TRIMP disabled: ${CANONICAL_ATHLETE_PRIVATE_PATH} is missing required field: ` +
      `restingHr.`;
  } else if (!privateConfig.sex) {
    banisterDisabledReason =
      `Banister TRIMP disabled: ${CANONICAL_ATHLETE_PRIVATE_PATH} is missing required field: sex.`;
  } else {
    // Never substitute a default resting HR (D-13) — restingHr comes ONLY
    // from the validated private config at this point.
    banisterEnabled = true;
    banisterInputs = { restingHr: privateConfig.restingHr, maxHr: athleteConfig.maxHr, sex: privateConfig.sex };
  }

  if (banisterDisabledReason) console.warn(banisterDisabledReason);

  let activitiesWithHr = 0;
  let activitiesWithoutHr = 0;
  let activitiesUnreadable = 0;

  const runsByDay = new Map<string, number>();
  const runsWithHrByDay = new Map<string, number>();
  const edwardsByDay = new Map<string, number>();
  const banisterByDay = new Map<string, number>();

  for (const [id, entry] of Object.entries(manifest.activities)) {
    let activity: StravaActivity;
    try {
      activity = await fileStore.readJson<StravaActivity>(path.join(activitiesDir, `${id}.json`));
    } catch (error) {
      console.warn(`  ${id}: ${(error as Error).message}; skipping`);
      activitiesUnreadable++;
      continue;
    }

    const day = toCalendarDay(activity.start_date_local);
    if (day === null) {
      console.warn(`  ${id}: unparseable start_date_local "${activity.start_date_local}"; skipping`);
      activitiesUnreadable++;
      continue;
    }

    // Every manifest activity contributes to `runs` — including ones with
    // no stream and ones with no HR channel (D-15: the day a no-HR run
    // happened must not look identical to a rest day).
    bump(runsByDay, day, 1);

    if (entry.available && entry.channels.hr) {
      try {
        const stream = await fileStore.readJson<CanonicalStream>(path.join(streamsDir, `${id}.json`));
        const trimp = computeActivityTrimp(stream, zones, banisterInputs);
        if (trimp) {
          bump(runsWithHrByDay, day, 1);
          bump(edwardsByDay, day, trimp.edwards);
          if (banisterEnabled && trimp.banister !== null) {
            bump(banisterByDay, day, trimp.banister);
          }
          activitiesWithHr++;
        } else {
          // Manifest metadata said HR was present but the stream itself had
          // none — honest fallback, matches a no-HR activity.
          activitiesWithoutHr++;
        }
      } catch (error) {
        console.warn(`  ${id}: ${(error as Error).message}; skipping`);
        activitiesUnreadable++;
      }
    } else {
      activitiesWithoutHr++;
    }
  }

  const activeDays = [...runsByDay.keys()].sort();
  const firstDate = activeDays[0] ?? '';
  const lastDate = activeDays[activeDays.length - 1] ?? '';

  const edwardsSeries = computeCtlAtlTsb(edwardsByDay, firstDate, lastDate);
  const banisterSeries = banisterEnabled ? computeCtlAtlTsb(banisterByDay, firstDate, lastDate) : null;

  const days: DailyLoadEntry[] = edwardsSeries.map((point, i) => {
    const banisterPoint = banisterSeries ? banisterSeries[i] : null;
    return {
      date: point.date,
      runs: runsByDay.get(point.date) ?? 0,
      runsWithHr: runsWithHrByDay.get(point.date) ?? 0,
      edwards: {
        trimp: round2(point.trimp),
        ctl: round2(point.ctl),
        atl: round2(point.atl),
        tsb: round2(point.tsb),
      },
      banister: banisterPoint
        ? {
            trimp: round2(banisterPoint.trimp),
            ctl: round2(banisterPoint.ctl),
            atl: round2(banisterPoint.atl),
            tsb: round2(banisterPoint.tsb),
          }
        : null,
    };
  });

  const doc: TrainingLoadDocument = {
    schemaVersion: TRAINING_LOAD_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    note:
      'Derived, gitignored, and regenerated by `node dist/index.js compute-training-load`. ' +
      'Consumers read this file rather than recomputing.',
    timeConstants: { ctlDays: CTL_TAU_DAYS, atlDays: ATL_TAU_DAYS },
    models: { edwards: true, banister: banisterEnabled },
    banisterDisabledReason,
    firstDate,
    lastDate,
    totals: {
      daysInSpine: days.length,
      activitiesConsidered: Object.keys(manifest.activities).length,
      activitiesWithHr,
      activitiesWithoutHr,
      activitiesUnreadable,
    },
    days,
  };

  await fileStore.writeJson(path.join(statsDir, 'training-load.json'), doc);

  const serializedSize = Buffer.byteLength(JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`\nGenerated training load:`);
  console.log(`- Days in spine: ${doc.totals.daysInSpine}`);
  console.log(`- Activities considered: ${doc.totals.activitiesConsidered}`);
  console.log(`- With HR: ${doc.totals.activitiesWithHr}`);
  console.log(`- Without HR: ${doc.totals.activitiesWithoutHr}`);
  console.log(`- Unreadable: ${doc.totals.activitiesUnreadable}`);
  console.log(`- Banister produced: ${banisterEnabled}`);
  console.log(`- Document size: ${(serializedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nOutput written to: ${path.join(statsDir, 'training-load.json')}`);

  return doc;
}
