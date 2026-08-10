/**
 * External-reference validation suite for the best-effort engine (D-05).
 *
 * The `expectedDurationSec` value in every fixture row below was read
 * manually by the developer from Strava's own "Best Efforts" panel (or, for
 * the `intervals`-sourced rows, from intervals.icu / Garmin Connect) on the
 * date recorded in that row's `reference` field. These are the ONLY external
 * reference this engine has — unit tests prove internal consistency, this
 * suite proves correctness against a source the engine did not produce
 * itself. Changing an `expectedDurationSec` value to make a test pass is a
 * correctness regression in the engine, not a fix to this file.
 *
 * Provenance and the full candidate-selection rationale (including the two
 * rows dropped because no platform panel reported that distance) live in
 * `.planning/phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md`.
 *
 * This suite reads the REAL committed archive (`data/streams/<id>.json` and
 * `data/activities/<id>.json`) directly via `node:fs` — it never reads the
 * derived, gitignored stats output under `data/stats/`, which is absent on
 * a fresh clone.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeActivityEfforts, type ActivityEffortInput } from './compute-best-efforts.js';
import type { TargetDistanceKey } from './best-effort.types.js';
import type { CanonicalStream, DistanceSource, StreamSource } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';

/** 2% tolerance per D-05 — wide enough to absorb the decimation bias RESEARCH.md Pitfall 4 describes. */
const TOLERANCE = 0.02;

interface FixtureCase {
  activityId: string;
  source: StreamSource;
  distanceSource: DistanceSource;
  target: TargetDistanceKey;
  /** Seconds, hand-transcribed from the platform's own reported value. */
  expectedDurationSec: number;
  /** Which platform the value came from, and the date it was read. */
  reference: string;
  /** Per-row override, at most 0.05, only when Notes documented a concrete reason. */
  tolerance?: number;
}

/**
 * Frozen external reference values. Populated from the developer-filled
 * worksheet (`15-FIXTURE-CANDIDATES.md`) only. Two candidate rows were
 * DROPPED, not estimated: the 5k efforts on activities `7827165619` and
 * `9716153503`, because Strava does not display a 5k best-effort panel for
 * either activity and no platform-reported value exists for them.
 */
export const FIXTURES: FixtureCase[] = [
  {
    activityId: '3475726256',
    source: 'fit',
    distanceSource: 'native',
    target: '400m',
    expectedDurationSec: 44.0,
    reference: 'Strava Best Efforts panel, read 2026-08-10 (3rd-best 400m overall on the account)',
  },
  {
    activityId: '3475725513',
    source: 'fit',
    distanceSource: 'native',
    target: '1k',
    expectedDurationSec: 148.9,
    reference: 'Strava Best Efforts panel, read 2026-08-10 (best 1k on the account)',
  },
  {
    activityId: '7827165619',
    source: 'fit',
    distanceSource: 'native',
    target: '10k',
    expectedDurationSec: 2383.9,
    reference: 'Strava Best Efforts panel, read 2026-08-10',
  },
  {
    activityId: '7827165619',
    source: 'fit',
    distanceSource: 'native',
    target: 'half',
    expectedDurationSec: 5211.3,
    reference: 'Strava Best Efforts panel, read 2026-08-10',
  },
  {
    activityId: 'i174284902',
    source: 'intervals',
    distanceSource: 'native',
    target: '5k',
    expectedDurationSec: 1670.9,
    reference: 'intervals.icu / Garmin Connect, read 2026-08-10',
  },
  {
    activityId: 'i174284902',
    source: 'intervals',
    distanceSource: 'native',
    target: '10k',
    expectedDurationSec: 3412.5,
    reference: 'intervals.icu / Garmin Connect, read 2026-08-10',
  },
];

/** Reads the committed activity + stream JSON for `activityId` and computes its efforts. */
function computeEffortsForActivity(
  activityId: string,
  distanceSource: DistanceSource
): ReturnType<typeof computeActivityEfforts> {
  const activity = JSON.parse(
    fs.readFileSync(path.join('data/activities', `${activityId}.json`), 'utf-8')
  ) as StravaActivity;
  const stream = JSON.parse(
    fs.readFileSync(path.join('data/streams', `${activityId}.json`), 'utf-8')
  ) as CanonicalStream;

  const input: ActivityEffortInput = {
    activityId,
    startDate: activity.start_date,
    activityDistanceM: activity.distance,
    maxSpeedMps: activity.max_speed,
    distanceSource,
    t: stream.t,
    d: stream.d,
  };

  return computeActivityEfforts(input);
}

describe('best-effort fixtures — external reference validation', () => {
  it.each(FIXTURES)(
    'matches the platform-reported $target effort for activity $activityId within tolerance',
    (fx) => {
      const result = computeEffortsForActivity(fx.activityId, fx.distanceSource);
      const effort = result.efforts.find((e) => e.distance === fx.target);

      expect(
        effort,
        `expected a computed ${fx.target} effort for activity ${fx.activityId}, but none was found ` +
          `(eligibleTargets: ${result.eligibleTargets.join(', ')}, seriesError: ${result.seriesError ?? 'none'})`
      ).toBeDefined();

      const computed = effort!.durationSec;
      const tolerance = fx.tolerance ?? TOLERANCE;
      const delta = Math.abs(computed - fx.expectedDurationSec) / fx.expectedDurationSec;
      const deltaPct = (delta * 100).toFixed(2);

      expect(
        delta,
        `activity ${fx.activityId} ${fx.target}: computed ${computed}s vs expected ${fx.expectedDurationSec}s ` +
          `(${deltaPct}% delta, tolerance ${(tolerance * 100).toFixed(0)}%)`
      ).toBeLessThanOrEqual(tolerance);
    }
  );

  // Coverage guards — keep the fixture set from silently eroding.
  it('has at least 5 fixture rows', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(5);
  });

  it('includes at least one short-distance (400m or 1k) fixture', () => {
    const hasShort = FIXTURES.some((fx) => fx.target === '400m' || fx.target === '1k');
    expect(hasShort).toBe(true);
  });

  it('spans at least two distinct stream sources', () => {
    const sources = new Set(FIXTURES.map((fx) => fx.source));
    expect(sources.size).toBeGreaterThanOrEqual(2);
  });

  it('every fixture row carries a non-empty reference string', () => {
    for (const fx of FIXTURES) {
      expect(fx.reference.length).toBeGreaterThan(0);
    }
  });
});
