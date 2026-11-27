/**
 * ARCHIVE-PINNED test (Phase 36.1, L-02).
 *
 * (a) This file reads the whole live archive (`data/activities`, `data/streams`) and compares the
 *     result to a figure parsed from the committed `35-CALIBRATION.md`. The nightly sync moves the
 *     archive, so this can go red with no code change.
 * (b) It runs in the non-blocking `test:archive` suite (`*.archive.test.ts`), not in `test:logic`.
 * (c) When it goes red, the fix is regenerating the artifact via
 *     `compute-running-pace-dispute-calibration` and recommitting it. Never loosen the `toBe`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CanonicalStream } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { detectPaceDisagreement, deriveRunningPace } from './pace-derivation.js';

describe('pace disagreement (archive-pinned)', () => {
  const ACTIVITIES_DIR = 'data/activities';
  const STREAMS_DIR = 'data/streams';
  const CALIBRATION_PATH = path.join(
    '.planning',
    'milestones', 'v2.3-phases',
    '35-stream-derived-running-pace',
    '35-CALIBRATION.md'
  );

  function metadataPaceSecPerKm(activity: StravaActivity): number | null {
    const distanceM = activity.distance;
    const movingTimeSec = activity.moving_time;
    return distanceM > 0 && movingTimeSec > 0 ? movingTimeSec / (distanceM / 1000) : null;
  }

  async function readCalibration(): Promise<string> {
    return fs.readFile(CALIBRATION_PATH, 'utf-8');
  }

  /** Parses "Newly-disputed count under the chosen cut (population E): <n>" from 35-CALIBRATION.md § Gates. */
  async function parsedArchiveWideFlaggedCount(): Promise<number> {
    const artifact = await readCalibration();
    const match = /Newly-disputed count under the chosen cut \(population E\): (\d+)/.exec(
      artifact
    );
    if (match === null) {
      throw new Error(
        `Expected a "Newly-disputed count under the chosen cut (population E): <n>" line in ` +
          `${CALIBRATION_PATH} — a re-run of the generator landing on its own HALT branch is the ` +
          'likely cause; never skip, never silently pass.'
      );
    }
    return Number(match[1]);
  }

  it('flags EXACTLY the archive-wide count parsed from 35-CALIBRATION.md § Gates (population E, D-02 eligibility gate)', async () => {
    // Scans every committed activity record, matching the writer's own
    // per-activity loop (compute-dashboard-index.ts) — the denominator is
    // the archive's full activity count (~1,890), not the smaller subset
    // that happens to have a matching stream file (~1,865). A missing
    // stream degrades to "not flagged" here too, exactly as the real writer
    // degrades on a stream read failure (T-26-01).
    const activityFiles = (await fs.readdir(ACTIVITIES_DIR)).filter((f) => f.endsWith('.json'));

    let scanned = 0;
    const flagged: string[] = [];

    for (const file of activityFiles) {
      const id = file.replace(/\.json$/, '');

      const activity = JSON.parse(
        await fs.readFile(path.join(ACTIVITIES_DIR, file), 'utf-8')
      ) as StravaActivity;

      scanned++;

      let stream: CanonicalStream | null = null;
      try {
        stream = JSON.parse(
          await fs.readFile(path.join(STREAMS_DIR, `${id}.json`), 'utf-8')
        ) as CanonicalStream;
      } catch {
        stream = null; // No matching stream file — cannot be flagged, same as the writer.
      }

      const result =
        stream !== null
          ? detectPaceDisagreement(metadataPaceSecPerKm(activity), deriveRunningPace(stream))
          : null;
      if (result !== null) flagged.push(id);
    }

    console.log(
      `pace disagreement sweep: scanned ${scanned} activities, flagged ${flagged.length} (${flagged.join(', ')})`
    );

    const expectedCount = await parsedArchiveWideFlaggedCount();

    // Phase 36 gap closure (`.planning/debug/36-recount-isolated-jump.md`): the detector fix in
    // `unreliable-segments.ts`'s `extendThroughTrailingStall` stopped these two activities being
    // flagged. 35-CALIBRATION.md was re-derived on 2026-11-25 (quick 261125-cvq) against the
    // post-fix detector, so its parsed count already reflects that and NO subtraction applies. The
    // two ids are still asserted unflagged below as an independent check.
    const PHASE_36_GAP_CLOSURE_NO_LONGER_FLAGGED = ['14675028146', '4598855187'];
    for (const id of PHASE_36_GAP_CLOSURE_NO_LONGER_FLAGGED) {
      expect(
        flagged,
        `${id}: expected to no longer be flagged post Phase-36-gap-closure (was flagged under the ` +
          'pre-fix detector per 35-CALIBRATION.md) — see .planning/debug/36-recount-isolated-jump.md'
      ).not.toContain(id);
    }

    expect(scanned).toBeGreaterThanOrEqual(1890);
    expect(
      flagged.length,
      `flagged.length (${flagged.length}) !== 35-CALIBRATION.md's parsed archive-wide count ` +
        `(${expectedCount}). ` +
        'A mismatch most likely means the nightly ' +
        "archive moved since 35-CALIBRATION.md was rendered — re-run 35-07's generator (idempotent, " +
        'content-addressed to `rev-parse HEAD:data/streams`) and recommit the artifact. A mismatch ' +
        'of tens means the comparator has diverged from the calibration — the failure this row ' +
        'exists to catch. Never widen or soften this assertion to make it pass.'
    ).toBe(expectedCount);
    // Reads and derives pace over the whole ~1,890-activity archive, which lands
    // just under vitest's 5s default and fails intermittently on a busy machine.
    // The budget is generous on purpose — this guards the assertions above, not
    // the sweep's runtime.
  }, 60_000);
});
