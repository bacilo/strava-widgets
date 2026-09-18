/**
 * Stratified, reusable pace-derivation fixture library (ERA-03, D-20).
 *
 * (a) TEST-LAYER ONLY. This module reads the filesystem via `node:fs` and
 *     must never be imported from `src/dashboard/` or `src/widgets/` — a
 *     `node:fs` import reaching either would break the browser bundle. This
 *     is a hard contrast with `pace-derivation.ts` (D-15), which is pure and
 *     client-safe by design. `pace-fixtures.test.ts` Task 2 group 4 asserts
 *     this boundary in both directions.
 *
 * (b) Synthetic fixtures below each carry a hand-derived expected answer in
 *     their own doc comment, stated in seconds and metres. No ground truth
 *     exists for real GPS data — a synthetic stream is the only way to know
 *     the "true" answer a gap-aware derivation should produce, per ERA-03's
 *     own text ("fixtures must be synthetic where the expected answer must
 *     be known").
 *
 * (c) Pinned real-archive fixtures below read ONLY `data/streams/` and
 *     `data/activities/`, both committed and present on a fresh clone.
 *     They NEVER read the derived, gitignored computed-stats output — that
 *     directory does not exist until the stats pipeline has run locally.
 *     This mirrors `best-effort-fixtures.test.ts`'s archive-read pattern
 *     exactly (lines 107-130 of that file).
 *
 * (d) Changing a pinned fixture's stated `expected` property to make a test
 *     pass is a REGRESSION, not a fix — identical discipline to
 *     `best-effort-fixtures.test.ts`'s own provenance header. A mismatch
 *     between a pinned fixture's `expected` value and what
 *     `loadPinnedStream`/`loadPinnedActivity` actually returns means either
 *     the archive changed underneath this fixture or a planning-time
 *     measurement was wrong — both are findings to record, never silently
 *     absorbed by relaxing the expected value.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { DeviceFamilyKind } from './pace-quality.js';
import type { CanonicalStream, DistanceSource, StreamSource } from '../streams/stream.types.js';

// ---------------------------------------------------------------------------
// Shared stream-building helper
// ---------------------------------------------------------------------------

export interface MakeStreamOptions {
  id?: string;
  source?: StreamSource;
  distanceSource?: DistanceSource;
  t: number[];
  d: number[];
  hr?: number[];
  cadence?: number[];
  alt?: number[];
}

/**
 * Builds a valid `CanonicalStream` from `t`/`d` plus optional `hr`/`cadence`/
 * `alt`, modelled on `detail-zones.test.ts`'s `makeStream` helper. Sets
 * `schemaVersion: 1`, `sampleCount: t.length` and a consistent `channels`
 * object derived from which optional arrays were actually supplied.
 */
export function makeStream(opts: MakeStreamOptions): CanonicalStream {
  const { id = 'synthetic', source = 'fit', distanceSource = 'native', t, d, hr, cadence, alt } = opts;
  return {
    schemaVersion: 1,
    id,
    source,
    distanceSource,
    sampleCount: t.length,
    channels: {
      time: true,
      distance: true,
      hr: hr !== undefined,
      cadence: cadence !== undefined,
      elevation: alt !== undefined,
    },
    t,
    d,
    ...(hr !== undefined ? { hr } : {}),
    ...(cadence !== undefined ? { cadence } : {}),
    ...(alt !== undefined ? { alt } : {}),
  };
}

/** Builds a steady-pace segment: `steps = durationS / stepS` samples, `stepS` apart, distance advancing at `speedMps`. */
function steadySegment(
  startT: number,
  durationS: number,
  stepS: number,
  startD: number,
  speedMps: number
): { t: number[]; d: number[] } {
  const t: number[] = [];
  const d: number[] = [];
  const steps = durationS / stepS;
  for (let i = 0; i <= steps; i++) {
    t.push(startT + i * stepS);
    d.push(Math.round((startD + i * stepS * speedMps) * 10) / 10);
  }
  return { t, d };
}

/** Builds a flat (distance-frozen) segment: dense `stepS`-apart samples, `d` constant at `dValue`. */
function flatSegment(startT: number, durationS: number, stepS: number, dValue: number): { t: number[]; d: number[] } {
  const t: number[] = [];
  const d: number[] = [];
  const steps = durationS / stepS;
  for (let i = 0; i <= steps; i++) {
    t.push(startT + i * stepS);
    d.push(dValue);
  }
  return { t, d };
}

// ---------------------------------------------------------------------------
// Synthetic constructors
// ---------------------------------------------------------------------------

/**
 * Dense 2s-advancing sampling for 200s, then a single 300s jump in `t` with
 * NO samples across it (the device stopped recording), then dense 2s
 * sampling for 200s more.
 *
 * Hand-derived expected answer: exactly 300s of recording gap (the jump from
 * t=200 to t=500); total span 700s (0..700); 202 samples; distance 0..1200m
 * at a steady 3 m/s (5:33/km) throughout both covered segments.
 */
export function syntheticRecordingGapStream(): CanonicalStream {
  const seg1 = steadySegment(0, 200, 2, 0, 3);
  const seg2 = steadySegment(500, 200, 2, 600, 3);
  return makeStream({
    id: 'synthetic-recording-gap',
    t: seg1.t.concat(seg2.t),
    d: seg1.d.concat(seg2.d),
  });
}

/**
 * An otherwise-normal short run — dense 2s sampling throughout, with `d`
 * frozen for 3 hours (10,800s) in the middle. This fixture is explicitly
 * synthetic: an exhaustive scan of the whole committed archive
 * (26-RESEARCH.md Pitfall 4) found no real densely-sampled pause longer
 * than 10.4 minutes (`3475742397`, the `real-pause` pinned fixture below) —
 * nothing in the archive demonstrates a multi-hour pause with dense
 * sampling maintained throughout.
 *
 * Hand-derived expected answer: 600s covered (0..600s, 0..1800m at 3 m/s),
 * then exactly 10,800s of zero-advance pause (600..11,400s, `d` held at
 * 1800m), then 600s covered again (11,400..12,000s, 1800..3600m at 3 m/s).
 * Total span 12,000s (200 min); 6,001 samples, every one 2s apart (no
 * recording gap anywhere in this fixture — it is pure pause, by
 * construction).
 */
export function syntheticMultiHourPauseStream(): CanonicalStream {
  const pre = steadySegment(0, 600, 2, 0, 3); // t 0..600, d 0..1800
  const pauseRest = flatSegment(602, 10798, 2, 1800); // t 602..11400, d constant 1800
  const postFull = steadySegment(11400, 600, 2, 1800, 3); // t 11400..12000, d 1800..3600
  const post = { t: postFull.t.slice(1), d: postFull.d.slice(1) }; // drop duplicate t=11400 boundary sample
  return makeStream({
    id: 'synthetic-multi-hour-pause',
    t: pre.t.concat(pauseRest.t, post.t),
    d: pre.d.concat(pauseRest.d, post.d),
  });
}

/**
 * Covered running + one recording gap + one pause, in a single stream — the
 * fixture Roadmap Criterion 3 calls "a synthetic multi-category fixture".
 *
 * Hand-derived expected answer, by exact second count:
 * - Covered: 400s total (200s at 0..200s, 0..600m; another 200s at
 *   880..1080s, 600..1200m — both at 3 m/s).
 * - Recording gap: 500s (single jump, t=200 to t=700, NO samples across it —
 *   the device stopped recording; `d` unchanged at 600m across the jump).
 * - Pause: 180s (dense 2s samples, t=700..880, `d` frozen at 600m).
 * Total span 1080s (400 + 500 + 180 = 1080); 292 samples.
 */
export function syntheticMultiCategoryCoverageStream(): CanonicalStream {
  const coveredA = steadySegment(0, 200, 2, 0, 3); // t 0..200, d 0..600
  const gapSample = { t: [700], d: [600] }; // resumes recording at t=700, no distance change across the gap
  const pauseRest = flatSegment(702, 178, 2, 600); // t 702..880, d constant 600
  const coveredBFull = steadySegment(880, 200, 2, 600, 3); // t 880..1080, d 600..1200
  const coveredB = { t: coveredBFull.t.slice(1), d: coveredBFull.d.slice(1) }; // drop duplicate t=880 boundary sample
  return makeStream({
    id: 'synthetic-multi-category-coverage',
    t: coveredA.t.concat(gapSample.t, pauseRest.t, coveredB.t),
    d: coveredA.d.concat(gapSample.d, pauseRest.d, coveredB.d),
  });
}

/**
 * A constructed interval session: 6 repetitions of 400m at 3:30/km (210
 * sec/km) followed by 200m at 6:30/km (390 sec/km), densely sampled every 2s.
 *
 * Hand-derived expected answer: each fast 400m rep takes exactly 84s (42
 * samples of 2s), each slow 200m rep takes exactly 78s (39 samples of 2s).
 * Total: 972s span, 3,600m distance, 487 samples. Roadmap Criterion 5
 * requires the smoothed output to resolve this session's own fast/slow
 * splits to within a stated tolerance — the intended tolerance is
 * **±20 sec/km**, stated here so plan 26-02's assertion inherits it rather
 * than inventing its own.
 */
export function syntheticIntervalSessionStream(): CanonicalStream {
  const fastSpeedMps = 1000 / 210; // 3:30/km
  const slowSpeedMps = 1000 / 390; // 6:30/km
  const t: number[] = [0];
  const d: number[] = [0];
  let curT = 0;
  let curD = 0;
  for (let rep = 0; rep < 6; rep++) {
    for (let i = 1; i <= 42; i++) {
      curT += 2;
      curD += fastSpeedMps * 2;
      t.push(curT);
      d.push(Math.round(curD * 10) / 10);
    }
    for (let i = 1; i <= 39; i++) {
      curT += 2;
      curD += slowSpeedMps * 2;
      t.push(curT);
      d.push(Math.round(curD * 10) / 10);
    }
  }
  return makeStream({ id: 'synthetic-interval-session', t, d });
}

/**
 * The alternating full-advance/zero-advance pattern `derive-stream.ts`'s
 * index-selection decimation manufactures on a signal whose true distance
 * updates every ~2s: dense 2s sampling where every ODD step advances by
 * double the per-tick distance and every EVEN step advances by zero, so each
 * adjacent PAIR of steps (4s) still covers the correct total distance.
 *
 * Hand-derived expected answer: underlying true pace 5:00/km (300 sec/km,
 * 3.3333 m/s). 100 samples, span 200s, distance 666.7m — averaging back out
 * to 3.3335 m/s over the whole fixture (5:00/km within rounding), even
 * though no individual 2s step reflects that pace on its own — exactly the
 * aliasing signature a naive per-sample `dt / (dd/1000)` derivation
 * manufactures a fake fast/zero bimodal split from.
 */
export function syntheticDecimationAliasedStream(): CanonicalStream {
  const trueSpeedMps = 1000 / 300; // 5:00/km
  const perPairDist = trueSpeedMps * 4; // distance covered per 4s (two 2s steps)
  const t: number[] = [0];
  const d: number[] = [0];
  let curT = 0;
  let curD = 0;
  for (let i = 1; i <= 100; i++) {
    curT += 2;
    if (i % 2 === 1) {
      curD += perPairDist; // full advance on odd steps
    } // even steps: zero advance (aliasing)
    t.push(curT);
    d.push(Math.round(curD * 10) / 10);
  }
  return makeStream({ id: 'synthetic-decimation-aliased', t, d });
}

/**
 * A steady 3 m/s (5:33/km) stream with one sample pair exceeding the
 * `WORLD_RECORD_SPEED_MPS` (10.44 m/s, the 100m world record) plausibility
 * guard.
 *
 * Hand-derived expected answer: the offending pair is index 9 -> 10 (t=18s
 * to t=20s), where `d` jumps from 54m to 84m — 30m over 2s, **15 m/s**,
 * comfortably faster than the 100m world record's 10.44 m/s. The extra 30m
 * injected at index 10 is carried forward through every later sample so `d`
 * stays non-decreasing throughout (21 samples, t 0..40s, d 0..150m).
 */
export function syntheticImpossibleSpeedStream(): CanonicalStream {
  const seg = steadySegment(0, 40, 2, 0, 3); // 21 samples, t 0..40, d 0..120
  const idx = 10;
  const extraOffsetM = 24; // raises the idx-1 -> idx step from 6m (3 m/s) to 30m (15 m/s)
  for (let i = idx; i < seg.d.length; i++) {
    seg.d[i] = Math.round((seg.d[i] + extraOffsetM) * 10) / 10;
  }
  return makeStream({ id: 'synthetic-impossible-speed', t: seg.t, d: seg.d });
}

/**
 * A stream whose distance never advances at all — used to prove a
 * gap-aware derivation returns `null` rather than `0` or `Infinity` when
 * there is no motion anywhere in the stream to derive a pace from.
 *
 * Hand-derived expected answer: 51 samples, dense 2s sampling, t 0..100s,
 * `d` constant at 500m for every sample (an activity that never moved after
 * its first recorded position).
 */
export function syntheticStandstillStream(): CanonicalStream {
  const seg = flatSegment(0, 100, 2, 500);
  return makeStream({ id: 'synthetic-standstill', t: seg.t, d: seg.d });
}

// ---------------------------------------------------------------------------
// Elevation synthetic fixtures (Phase 30, D-14) — each fires exactly one of
// the three altitude detectors, so removing its own fixture is what makes
// "that mode alone stops firing" a real test (Criterion 2). All three reuse
// the same 101-sample, 2s-dense pace baseline via `steadySegment` — only
// `alt` differs — and none needs a new builder API: `makeStream` already
// accepts `alt` (lines 45-83 above).
// ---------------------------------------------------------------------------

/**
 * Fires `subGroundSignal` ONLY. A smooth V-shaped altitude profile dips
 * from 10 m to -120 m and back to 10 m over the whole 200s fixture (~1.3
 * m/s per 2s step) — comfortably below `SUB_GROUND_MIN_ALT_M` (-50 m) at
 * its minimum, while every adjacent pair stays well under
 * `VERTICAL_RATE_SEVERE_MPS` (5 m/s) and the start/end altitude (10 m,
 * 10 m) never drifts.
 */
export function syntheticSubGroundStream(): CanonicalStream {
  const base = steadySegment(0, 200, 2, 0, 3);
  const n = base.t.length;
  const mid = Math.floor(n / 2);
  const alt: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i <= mid) {
      const frac = i / mid;
      alt.push(Math.round((10 - frac * 130) * 10) / 10); // 10 m -> -120 m
    } else {
      const frac = (i - mid) / (n - 1 - mid);
      alt.push(Math.round((-120 + frac * 130) * 10) / 10); // -120 m -> 10 m
    }
  }
  return makeStream({ id: 'synthetic-sub-ground', t: base.t, d: base.d, alt });
}

/**
 * Fires `closureDriftSignal` ONLY (when paired with an in-radius start/end
 * position — the fixture itself carries no position, matching D-01's own
 * loop test living on activity metadata, not the stream). A smooth
 * monotonic climb from 0 m to 90 m over the whole 200s fixture (~0.45 m/s
 * per 2s step) — well over `CLOSURE_DRIFT_SEVERE_DELTA_M` (60 m) between
 * first and last sample, while the minimum altitude (0 m) stays
 * comfortably above `SUB_GROUND_MIN_ALT_M` (-50 m) and every adjacent pair
 * stays well under `VERTICAL_RATE_SEVERE_MPS` (5 m/s).
 */
export function syntheticClosureDriftStream(): CanonicalStream {
  const base = steadySegment(0, 200, 2, 0, 3);
  const n = base.t.length;
  const alt: number[] = [];
  for (let i = 0; i < n; i++) {
    const frac = i / (n - 1);
    alt.push(Math.round(frac * 90 * 10) / 10); // 0 m -> 90 m
  }
  return makeStream({ id: 'synthetic-closure-drift', t: base.t, d: base.d, alt });
}

/**
 * Fires `verticalRateSignal` ONLY. A flat 10 m baseline with a single
 * sample spiking to 50 m (a 40 m rise over one 2s pair, ~20 m/s — well
 * over `VERTICAL_RATE_SEVERE_MPS`) before the very next sample returns to
 * the 10 m baseline. Start and end altitude are both 10 m (delta 0, well
 * under `CLOSURE_DRIFT_SEVERE_DELTA_M`), and the minimum altitude (10 m)
 * never dips near `SUB_GROUND_MIN_ALT_M` (-50 m).
 */
export function syntheticVerticalRateSpikeStream(): CanonicalStream {
  const base = steadySegment(0, 200, 2, 0, 3);
  const n = base.t.length;
  const alt: number[] = new Array(n).fill(10);
  const spikeIdx = Math.floor(n / 2);
  alt[spikeIdx] = 50;
  return makeStream({ id: 'synthetic-vertical-rate-spike', t: base.t, d: base.d, alt });
}

// ---------------------------------------------------------------------------
// Pinned real-archive fixtures
// ---------------------------------------------------------------------------

export interface PinnedFixture {
  name: string;
  activityId: string;
  deviceFamily: DeviceFamilyKind;
  streamSource: StreamSource;
  why: string;
  /** Verified property values from the planning-time table in 26-03-PLAN.md's `<interfaces>` block. */
  expected: Record<string, number | string | null>;
}

/**
 * One entry per row of the pinned-candidates table in this plan's
 * `<interfaces>` block. Each `expected` carries the verified property that
 * row states (sample count, span, distance, max `Δt`, zero-advance fraction,
 * offending index/speed — whichever the row names). Re-verified at
 * execution time against the live archive by `pace-fixtures.test.ts`; any
 * mismatch is a finding, not something this file silently absorbs.
 */
export const PINNED_FIXTURES: readonly PinnedFixture[] = [
  {
    name: 'fenix-6-pro-fit',
    activityId: '10041312551',
    deviceFamily: 'garmin-fenix-6-pro',
    streamSource: 'fit',
    why: 'device_name "Garmin fēnix 6 Pro", stream source: fit, 939 samples',
    expected: { sampleCount: 939 },
  },
  {
    name: 'suunto-9-fit',
    activityId: '3480808722',
    deviceFamily: 'suunto-9',
    streamSource: 'fit',
    why: 'device_name "Suunto 9", stream source: fit, 1620 samples (same format as fēnix, different family — ERA-01\'s point)',
    expected: { sampleCount: 1620 },
  },
  {
    name: 'gpx-source',
    activityId: '10146303423',
    deviceFamily: 'strava-app-gpx',
    streamSource: 'gpx',
    why: 'stream source: gpx, device_name "Strava App", 2545 samples',
    expected: { sampleCount: 2545 },
  },
  {
    name: 'intervals-icu-only',
    activityId: 'i174284902',
    deviceFamily: 'intervals-icu',
    streamSource: 'intervals',
    why: 'stream source: intervals, no device_name, 886 samples',
    expected: { sampleCount: 886 },
  },
  {
    name: 'no-device-name',
    activityId: '11183705198',
    // Explicit own category — never a fabricated device name, never a
    // default fallthrough. Distinct from `real-pause` below, which also
    // has no `device_name` but is pinned for a different property.
    deviceFamily: 'no-device-name',
    streamSource: 'fit',
    why: 'device_name absent, stream source: fit, 923 samples',
    expected: { sampleCount: 923 },
  },
  {
    name: 'decimation-aliased',
    activityId: '5059204779',
    deviceFamily: 'suunto-9',
    streamSource: 'fit',
    why: '96.9% zero-advance samples, span 3788s, distance 10804m, max Δt 7s',
    expected: { zeroAdvanceFraction: 0.969, spanSec: 3788, distanceM: 10804, maxDtSec: 7 },
  },
  {
    name: 'recording-gap',
    activityId: '11544429866',
    deviceFamily: 'garmin-fenix-6-pro',
    streamSource: 'fit',
    why: 'single 127,478s (35.4h) recording gap, span 132,212s',
    expected: { maxGapSec: 127478, spanSec: 132212 },
  },
  {
    name: 'impossible-speed-sample',
    activityId: '10232917652',
    deviceFamily: 'strava-app-gpx',
    streamSource: 'gpx',
    why: '14.55 m/s between consecutive samples at index 303 (faster than the 100m world record\'s 10.44 m/s)',
    expected: { offendingIndex: 303, offendingSpeedMps: 14.55 },
  },
  {
    name: 'gap-crossing-split',
    activityId: '10198771331',
    deviceFamily: 'garmin-fenix-6-pro',
    streamSource: 'fit',
    why: '688s recording gap falling strictly inside km 11 of 11 splits; span 5225s, distance 11169m',
    expected: { maxGapSec: 688, spanSec: 5225, distanceM: 11169 },
  },
  {
    name: 'real-pause',
    activityId: '3475742397',
    // Resolution of the taxonomy collision the pattern search flagged: this
    // activity has no `device_name` and no `source_provider` key at all, so
    // under D-12's three-outcome ladder its family IS `no-device-name` —
    // `unrecognized-device` by definition requires a NON-blank `device_name`
    // absent from the lookup table, which this activity does not have and
    // cannot have. The prior hyphenated "unknown device" string here was not
    // a second taxonomy concept; it was a stale, pre-taxonomy annotation for
    // exactly this slot. This fixture remains pinned for its pause-length property,
    // not to represent the no-device-name category — sharing a family with
    // the `no-device-name` fixture above is now a fact `resolveDeviceFamily`
    // reproduces, not a collision.
    deviceFamily: 'no-device-name',
    streamSource: 'fit',
    why: "the archive's longest real densely-sampled pause, 10.4 min; also Criterion 1's tie-at-zero case",
    // 625s = 10.42 min, which the plan's table rounds to "10.4 min".
    expected: { longestPauseSec: 625 },
  },
  {
    name: 'worked-example',
    activityId: '4556693525',
    deviceFamily: 'suunto-9',
    streamSource: 'fit',
    why: "the pinned PACE-04 exemplar; span 3394s vs metadata elapsed_time 3393, distance 10130m, 28.7% zero-advance",
    expected: { spanSec: 3394, elapsedTimeSec: 3393, distanceM: 10130, zeroAdvanceFraction: 0.287 },
  },
] as const;

class PinnedFixtureNotFoundError extends Error {
  constructor(name: string) {
    super(
      `Unknown pinned fixture "${name}" — not present in PINNED_FIXTURES. ` +
        `This is a broken test setup: check the name against PACE_FIXTURE_NAMES.`
    );
    this.name = 'PinnedFixtureNotFoundError';
  }
}

class PinnedFixtureFileMissingError extends Error {
  constructor(name: string, filePath: string) {
    super(
      `Pinned fixture "${name}" expects a file at "${filePath}" but it does not exist. ` +
        `This is a broken test setup — either the archive file was removed or the pinned ` +
        `activityId is wrong; re-derive the fixture rather than silently swapping the id.`
    );
    this.name = 'PinnedFixtureFileMissingError';
  }
}

function resolvePinnedFixture(name: string): PinnedFixture {
  const fixture = PINNED_FIXTURES.find((f) => f.name === name);
  if (!fixture) throw new PinnedFixtureNotFoundError(name);
  return fixture;
}

/** Reads and parses `data/streams/<activityId>.json` for the named pinned fixture. Never reads the derived, gitignored computed-stats output. */
export function loadPinnedStream(name: string): CanonicalStream {
  const fixture = resolvePinnedFixture(name);
  const filePath = path.join('data/streams', `${fixture.activityId}.json`);
  if (!fs.existsSync(filePath)) throw new PinnedFixtureFileMissingError(name, filePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CanonicalStream;
}

/** Reads and parses `data/activities/<activityId>.json` for the named pinned fixture. Never reads the derived, gitignored computed-stats output. */
export function loadPinnedActivity(name: string): unknown {
  const fixture = resolvePinnedFixture(name);
  const filePath = path.join('data/activities', `${fixture.activityId}.json`);
  if (!fs.existsSync(filePath)) throw new PinnedFixtureFileMissingError(name, filePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Required fixture names (Roadmap Criterion 6)
// ---------------------------------------------------------------------------

/**
 * Every fixture name ERA-03 and Roadmap Criterion 6 require, exactly once:
 * the eleven pinned names above plus the four synthetic-only names. This is
 * what Criterion 6's presence-by-name assertion iterates in
 * `pace-fixtures.test.ts` — a deleted fixture fails with the missing name in
 * the test title, not as a silent count change.
 */
export const PACE_FIXTURE_NAMES: readonly string[] = [
  ...PINNED_FIXTURES.map((f) => f.name),
  'multi-hour-pause',
  'interval-session',
  'standstill',
  'multi-category-coverage',
] as const;
