/**
 * Unit coverage for `pace-quality.ts`'s device-family resolution (ERA-01,
 * ERA-02), the untiered elapsed-vs-moving fact, and the explicit
 * not-computable constructor.
 *
 * Reads the real committed archive via `pace-fixtures.ts`'s pinned-fixture
 * loaders (`loadPinnedActivity`), never the derived/gitignored stats
 * output. A mismatch between a pinned fixture's declared `deviceFamily` and
 * what `resolveDeviceFamily` computes from the real activity JSON is a
 * finding, never silently absorbed by relaxing the fixture.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  CLOSURE_DRIFT_SEVERE_DELTA_M,
  DECIMATION_SEVERE_MIN_SAMPLES,
  DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION,
  GAP_PROFILE_MINOR_FRACTION,
  GAP_PROFILE_SEVERE_FRACTION,
  IMPOSSIBLE_SAMPLE_SEVERE_COUNT,
  LOOP_RADIUS_M,
  NOT_COMPUTABLE_NO_STREAM,
  SUB_GROUND_MIN_ALT_M,
  UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION,
  VERTICAL_RATE_SEVERE_MPS,
  buildPaceQualityShard,
  closureDriftSignal,
  computePaceQualitySignals,
  countImpossibleSamples,
  decimationSignal,
  elapsedVsMovingSignal,
  elevationSignal,
  gapProfileSignal,
  hasAnySevereSignal,
  impossibleSampleSignal,
  notComputableSignals,
  resolveDeviceFamily,
  subGroundSignal,
  unreliableSegmentsSignal,
  verticalRateSignal,
  type ActivityQualityMetadata,
  type ActivityQualitySignals,
  type DeviceEraSignal,
  type UnreliableSegmentsSignal,
} from './pace-quality.js';
import {
  PINNED_FIXTURES,
  loadPinnedActivity,
  loadPinnedStream,
  makeStream,
  syntheticClosureDriftStream,
  syntheticDecimationAliasedStream,
  syntheticImpossibleSpeedStream,
  syntheticMultiHourPauseStream,
  syntheticRecordingGapStream,
  syntheticSubGroundStream,
  syntheticVerticalRateSpikeStream,
} from './pace-fixtures.js';
import {
  adaptiveWindowSec as recomputeAdaptiveWindowSec,
  classifyGaps,
  classifyGapsWithSegments,
} from './pace-derivation.js';
import type { UnreliableSegment, SegmentMechanism } from './pace-derivation.js';
import type { CanonicalStream } from '../streams/stream.types.js';

/** Builds the two-field metadata slice `resolveDeviceFamily` consumes from a raw activity record. */
function metadataOf(activity: unknown): Pick<ActivityQualityMetadata, 'deviceName' | 'sourceProvider'> {
  const record = activity as Record<string, unknown>;
  return { deviceName: record.device_name, sourceProvider: record.source_provider };
}

/** Builds the full six-field metadata `computePaceQualitySignals`/`buildPaceQualityShard` consume. */
function fullMetadataOf(activity: unknown): ActivityQualityMetadata {
  const record = activity as Record<string, unknown>;
  return {
    deviceName: record.device_name,
    sourceProvider: record.source_provider,
    elapsedTimeSec: record.elapsed_time,
    movingTimeSec: record.moving_time,
    startLatlng: record.start_latlng,
    endLatlng: record.end_latlng,
  };
}

describe('resolveDeviceFamily — device family (ERA-01)', () => {
  it('differentiates fēnix 6 Pro from Suunto 9 despite identical FIT stream format', () => {
    const fenix = loadPinnedActivity('fenix-6-pro-fit');
    const suunto = loadPinnedActivity('suunto-9-fit');

    expect(resolveDeviceFamily(metadataOf(fenix)).family).toBe('garmin-fenix-6-pro');
    expect(resolveDeviceFamily(metadataOf(suunto)).family).toBe('suunto-9');

    const fenixFixture = PINNED_FIXTURES.find((f) => f.name === 'fenix-6-pro-fit')!;
    const suuntoFixture = PINNED_FIXTURES.find((f) => f.name === 'suunto-9-fit')!;
    expect(fenixFixture.streamSource).toBe('fit');
    expect(suuntoFixture.streamSource).toBe('fit');
  });

  it.each(PINNED_FIXTURES.map((f) => [f.name, f] as const))(
    'reproduces pinned fixture "%s"\'s declared deviceFamily from its real activity JSON',
    (_name, fixture) => {
      const activity = loadPinnedActivity(fixture.name);
      const resolved = resolveDeviceFamily(metadataOf(activity));
      expect(resolved.family).toBe(fixture.deviceFamily);
    }
  );

  it('intervals-icu-only resolves to intervals-icu, NOT no-device-name', () => {
    const activity = loadPinnedActivity('intervals-icu-only');
    const resolved = resolveDeviceFamily(metadataOf(activity));
    expect(resolved.family).toBe('intervals-icu');
    expect(resolved.family).not.toBe('no-device-name');
  });

  it('a non-blank device_name absent from the lookup table reports unrecognized-device with the raw string verbatim', () => {
    const resolved = resolveDeviceFamily({ deviceName: 'Coros Pace 3', sourceProvider: undefined });
    expect(resolved.family).toBe('unrecognized-device');
    expect(resolved.rawDeviceName).toBe('Coros Pace 3');
  });

  it('a whitespace-only device_name is treated as blank, falling through to source_provider', () => {
    const resolved = resolveDeviceFamily({ deviceName: '   ', sourceProvider: 'intervals' });
    expect(resolved.family).toBe('intervals-icu');
  });

  it('preserves a hostile device_name string byte-for-byte unescaped at rest', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const resolved = resolveDeviceFamily({ deviceName: hostile, sourceProvider: undefined });
    expect(resolved.family).toBe('unrecognized-device');
    expect(resolved.rawDeviceName).toBe(hostile);
  });

  it('is total: non-string/non-object metadata shapes never throw', () => {
    expect(() => resolveDeviceFamily({ deviceName: 42, sourceProvider: null })).not.toThrow();
    expect(() => resolveDeviceFamily({ deviceName: undefined, sourceProvider: {} })).not.toThrow();

    const a = resolveDeviceFamily({ deviceName: 42, sourceProvider: null });
    const b = resolveDeviceFamily({ deviceName: undefined, sourceProvider: {} });
    const validFamilies = new Set<DeviceEraSignal['family']>([
      'garmin-fenix-6-pro',
      'suunto-9',
      'garmin-vivoactive-4',
      'strava-app-gpx',
      'intervals-icu',
      'no-device-name',
      'unrecognized-device',
    ]);
    expect(validFamilies.has(a.family)).toBe(true);
    expect(validFamilies.has(b.family)).toBe(true);
  });
});

describe('resolveDeviceFamily — no-device-name category (ERA-02)', () => {
  it('an activity with no device_name and no source_provider reports the explicit no-device-name category, never a fabricated device', () => {
    const activity = loadPinnedActivity('no-device-name');
    const resolved = resolveDeviceFamily(metadataOf(activity));
    expect(resolved.family).toBe('no-device-name');
    expect(resolved.rawDeviceName).toBeNull();
    expect(resolved.family).not.toMatch(/garmin|suunto|fenix|forerunner|coros|polar|vivoactive/i);
  });

  it('loads the pinned no-device-name stream without throwing (sanity: fixture file present)', () => {
    expect(() => loadPinnedStream('no-device-name')).not.toThrow();
  });
});

describe('resolveDeviceFamily — NOT_COMPUTABLE constant sanity', () => {
  it('NOT_COMPUTABLE_NO_STREAM is a non-empty, stable string', () => {
    expect(typeof NOT_COMPUTABLE_NO_STREAM).toBe('string');
    expect(NOT_COMPUTABLE_NO_STREAM.length).toBeGreaterThan(0);
  });
});

describe('elapsedVsMovingSignal and notComputableSignals — not computable', () => {
  it('computes a rounded ratio from finite elapsed/moving seconds', () => {
    const result = elapsedVsMovingSignal({ elapsedTimeSec: 3600, movingTimeSec: 3000 });
    expect(result.ratio).toBe(1.2);
    expect(result.elapsedSec).toBe(3600);
    expect(result.movingSec).toBe(3000);
  });

  it('movingTimeSec 0 yields ratio null, never 0 and never 1', () => {
    const result = elapsedVsMovingSignal({ elapsedTimeSec: 100, movingTimeSec: 0 });
    expect(result.ratio).toBeNull();
    expect(result.ratio).not.toBe(0);
    expect(result.ratio).not.toBe(1);
    expect(result.movingSec).toBe(0);
  });

  it('undefined elapsedTimeSec yields ratio null and elapsedSec null without throwing', () => {
    expect(() =>
      elapsedVsMovingSignal({ elapsedTimeSec: undefined, movingTimeSec: 3000 })
    ).not.toThrow();
    const result = elapsedVsMovingSignal({ elapsedTimeSec: undefined, movingTimeSec: 3000 });
    expect(result.ratio).toBeNull();
    expect(result.elapsedSec).toBeNull();
  });

  it('notComputableSignals returns all three tiering signals as not-computable with null evidence, anySevere false, and the passed reason', () => {
    const deviceEra: DeviceEraSignal = { family: 'no-device-name', rawDeviceName: null };
    const elapsedVsMoving = elapsedVsMovingSignal({ elapsedTimeSec: 100, movingTimeSec: 90 });
    const result = notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM);

    expect(result.decimation.tier).toBe('not-computable');
    expect(result.decimation.zeroAdvanceFraction).toBeNull();
    expect(result.decimation.sampleCount).toBeNull();

    expect(result.gapProfile.tier).toBe('not-computable');
    expect(result.gapProfile.gapFraction).toBeNull();
    expect(result.gapProfile.recordingGapSec).toBeNull();
    expect(result.gapProfile.pauseSec).toBeNull();
    expect(result.gapProfile.spanSec).toBeNull();

    expect(result.impossibleSamples.tier).toBe('not-computable');
    expect(result.impossibleSamples.count).toBeNull();
    expect(result.impossibleSamples.maxImpliedSpeedMps).toBeNull();
    expect(result.impossibleSamples.countInsideZeroAdvanceRun).toBeNull();

    expect(result.anySevere).toBe(false);
    expect(result.notComputableReason).toBe(NOT_COMPUTABLE_NO_STREAM);

    // Untiered facts pass through unchanged.
    expect(result.deviceEra).toEqual(deviceEra);
    expect(result.elapsedVsMoving).toEqual(elapsedVsMoving);
  });

  it('two successive notComputableSignals calls return distinct, unmutated objects', () => {
    const deviceEra: DeviceEraSignal = { family: 'no-device-name', rawDeviceName: null };
    const elapsedVsMoving: ReturnType<typeof elapsedVsMovingSignal> = {
      ratio: null,
      elapsedSec: null,
      movingSec: null,
    };

    const first = notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM);
    const second = notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM);

    expect(first).not.toBe(second);
    expect(first.decimation).not.toBe(second.decimation);
    expect(first.gapProfile).not.toBe(second.gapProfile);
    expect(first.impossibleSamples).not.toBe(second.impossibleSamples);

    // Mutating the first must not affect the second.
    first.decimation.sampleCount = 999;
    expect(second.decimation.sampleCount).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// decimation signal (D-04) and gap profile (Task 1)
// ---------------------------------------------------------------------------

/**
 * Builds a stream of `sampleCount` samples where the first `zeroCount` steps
 * are zero-advance (`d[i] === d[i-1]`) and every remaining step advances by
 * 1m — gives an exact, hand-controlled `zeroAdvanceFraction` of
 * `zeroCount / (sampleCount - 1)` for boundary testing.
 */
function buildDecimationBoundaryStream(sampleCount: number, zeroCount: number) {
  const t: number[] = [0];
  const d: number[] = [0];
  for (let i = 1; i < sampleCount; i++) {
    t.push(i);
    d.push(i <= zeroCount ? d[i - 1] : d[i - 1] + 1);
  }
  return makeStream({ id: `boundary-${sampleCount}-${zeroCount}`, t, d });
}

describe('decimation signal (D-04)', () => {
  it('syntheticDecimationAliasedStream reports severe, above the constant, above the sample floor', () => {
    const stream = syntheticDecimationAliasedStream();
    const result = decimationSignal(stream.t, stream.d);
    expect(result.tier).toBe('severe');
    expect(result.zeroAdvanceFraction).not.toBeNull();
    expect(result.zeroAdvanceFraction!).toBeGreaterThan(DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION);
    expect(result.sampleCount).not.toBeNull();
    expect(result.sampleCount!).toBeGreaterThanOrEqual(DECIMATION_SEVERE_MIN_SAMPLES);
  });

  it('the pinned decimation-aliased fixture (5059204779) agrees with compute-pace-residual.mjs\'s own rule', () => {
    const fixture = PINNED_FIXTURES.find((f) => f.name === 'decimation-aliased')!;
    const stream = loadPinnedStream('decimation-aliased');
    const result = decimationSignal(stream.t, stream.d);

    expect(result.tier).toBe('severe');
    expect(result.zeroAdvanceFraction).not.toBeNull();
    expect(
      Math.abs(result.zeroAdvanceFraction! - (fixture.expected.zeroAdvanceFraction as number))
    ).toBeLessThanOrEqual(0.005);
  });

  it('a clean, strictly-increasing stream reports none with a genuine zero fraction, not a fabricated one', () => {
    const t = Array.from({ length: 60 }, (_, i) => i);
    const d = Array.from({ length: 60 }, (_, i) => i);
    const stream = makeStream({ id: 'clean-increasing', t, d });

    const result = decimationSignal(stream.t, stream.d);
    expect(result.tier).toBe('none');
    expect(result.zeroAdvanceFraction).toBe(0);
  });

  it('boundary: exactly 15.0% zero-advance is NOT severe (strict >, not >=)', () => {
    const stream = buildDecimationBoundaryStream(101, 15); // 15/100 = 0.15 exactly
    const result = decimationSignal(stream.t, stream.d);
    expect(result.zeroAdvanceFraction).toBe(0.15);
    expect(result.tier).not.toBe('severe');
  });

  it('boundary: above 15% zero-advance but only 49 samples is NOT severe (floor unmet)', () => {
    const stream = buildDecimationBoundaryStream(49, 10); // 10/48 = 0.2083, sampleCount 49 < 50
    const result = decimationSignal(stream.t, stream.d);
    expect(result.zeroAdvanceFraction!).toBeGreaterThan(0.15);
    expect(result.sampleCount).toBe(49);
    expect(result.tier).not.toBe('severe');
  });

  it('totality: malformed/adversarial input reports not-computable rather than throwing', () => {
    const cases: Array<[number[], number[]]> = [
      [[], []],
      [[0, 1, 2], [0, 1]], // mismatched lengths
      [[0, 1], [NaN, 1]],
      [[2, 1], [0, 1]], // decreasing t
    ];
    for (const [t, d] of cases) {
      expect(() => decimationSignal(t, d)).not.toThrow();
      const result = decimationSignal(t, d);
      expect(result.tier).toBe('not-computable');
      expect(result.zeroAdvanceFraction).toBeNull();
      expect(result.sampleCount).toBeNull();
    }
  });
});

describe('gap profile signal', () => {
  it('syntheticRecordingGapStream fires with recordingGapSec populated, pauseSec at zero', () => {
    const stream = syntheticRecordingGapStream();
    const result = gapProfileSignal(stream.t, stream.d);
    expect(result.tier).toBe('severe');
    expect(result.recordingGapSec).toBe(300);
    expect(result.pauseSec).toBe(0);
  });

  it('syntheticMultiHourPauseStream fires with pauseSec populated, recordingGapSec at zero', () => {
    const stream = syntheticMultiHourPauseStream();
    const result = gapProfileSignal(stream.t, stream.d);
    expect(result.tier).toBe('severe');
    expect(result.pauseSec).toBe(10800);
    expect(result.recordingGapSec).toBe(0);
  });

  it('gapFraction always equals (recordingGapSec + pauseSec) / spanSec, recomputed independently', () => {
    for (const stream of [syntheticRecordingGapStream(), syntheticMultiHourPauseStream()]) {
      const result = gapProfileSignal(stream.t, stream.d);
      const recomputed =
        (result.recordingGapSec! + result.pauseSec!) / result.spanSec!;
      expect(result.gapFraction).toBeCloseTo(recomputed, 10);
    }
  });

  it('threshold override is connected in both directions', () => {
    const stream = syntheticRecordingGapStream(); // gapFraction ~= 0.4286 by construction

    const low = gapProfileSignal(stream.t, stream.d, { gapProfileSevereFraction: 0.01 });
    expect(low.tier).toBe('severe');

    const high = gapProfileSignal(stream.t, stream.d, { gapProfileSevereFraction: 0.9 });
    expect(high.tier).not.toBe('severe');
  });

  it('the shipped scale-relative gap classification is never overridden by this signal', () => {
    expect(GAP_PROFILE_SEVERE_FRACTION).toBeGreaterThan(0);
    expect(GAP_PROFILE_SEVERE_FRACTION).toBeLessThan(1);
  });

  it('totality: malformed/adversarial input reports not-computable rather than throwing, never gapFraction 0', () => {
    const cases: Array<[number[], number[]]> = [
      [[], []],
      [[0, 1, 2], [0, 1]],
      [[0, 1], [NaN, 1]],
      [[2, 1], [0, 1]],
    ];
    for (const [t, d] of cases) {
      expect(() => gapProfileSignal(t, d)).not.toThrow();
      const result = gapProfileSignal(t, d);
      expect(result.tier).toBe('not-computable');
      expect(result.gapFraction).toBeNull();
      expect(result.recordingGapSec).toBeNull();
      expect(result.pauseSec).toBeNull();
      expect(result.spanSec).toBeNull();
    }
  });
});

/**
 * gapProfile numerator widening (COV-03, 33-CONTEXT.md D-04) and the D-05
 * anti-quota constant freeze. Named so `-t "gapProfile"` selects every test
 * in this block.
 *
 * The synthetic-coverage cases below mock `classifyGapsWithSegments`
 * (imported by `pace-quality.ts` from `pace-derivation.js` — Phase 33 plan
 * 33-09 widened `resolveCoverage` to call this instead of the bare
 * `classifyGaps`) to return an exact, hand-specified coverage object —
 * `tierGapProfileFromCoverage` is a private, unexported pure function of
 * that object, so this is the only way to pin its arithmetic to an exact
 * `{ spanSec, recordingGapSec, pauseSec, unreliableSec }` combination
 * without engineering a real stream whose detected-segment seconds happen
 * to land on a chosen value — the same `vi.doMock` + dynamic-`import()`
 * technique `pace-single-source.test.ts`'s D-15 load-bearing proof already
 * established in this tree. Each case cleans its own mock up via
 * `vi.doUnmock` + `vi.resetModules()` so later tests in this file (and the
 * real-stream/shard-passthrough cases below, which need the REAL
 * `classifyGapsWithSegments`) are never contaminated.
 */
describe('gapProfile numerator widening (D-04) and constant freeze (D-05)', () => {
  type MockCoverage = {
    spanSec: number;
    coveredSec: number;
    recordingGapSec: number;
    pauseSec: number;
    unreliableSec: number;
  };

  /**
   * Mocks `classifyGapsWithSegments` to return `{ coverage, segments: [] }`
   * with `coverage` set to `coverage` verbatim (plus an empty
   * `gapIntervals`, irrelevant to `gapProfileSignal`'s own return shape),
   * dynamically re-imports a fresh `pace-quality.js` bound to that mock,
   * calls its `gapProfileSignal`, then tears the mock down before
   * returning — so every caller gets a clean module registry regardless of
   * pass/fail.
   */
  async function gapProfileSignalOverCoverage(
    coverage: MockCoverage,
    options?: Parameters<typeof gapProfileSignal>[2]
  ): Promise<ReturnType<typeof gapProfileSignal>> {
    vi.doMock('./pace-derivation.js', async () => {
      const actual =
        await vi.importActual<typeof import('./pace-derivation.js')>('./pace-derivation.js');
      return {
        ...actual,
        classifyGapsWithSegments: () => ({
          coverage: { ...coverage, gapIntervals: [] },
          segments: [],
        }),
      };
    });
    vi.resetModules();
    try {
      const mod = await import('./pace-quality.js');
      return mod.gapProfileSignal([], [], options);
    } finally {
      vi.doUnmock('./pace-derivation.js');
      vi.resetModules();
    }
  }

  it('coverage { recordingGapSec 0, pauseSec 0, unreliableSec 30, spanSec 100 } tiers severe with gapFraction 0.30', async () => {
    const result = await gapProfileSignalOverCoverage({
      spanSec: 100,
      coveredSec: 70,
      recordingGapSec: 0,
      pauseSec: 0,
      unreliableSec: 30,
    });
    expect(result.tier).toBe('severe');
    expect(result.gapFraction).toBeCloseTo(0.3, 10);
    expect(result.recordingGapSec).toBe(0);
    expect(result.pauseSec).toBe(0);
    expect(result.spanSec).toBe(100);
  });

  it('coverage { recordingGapSec 3, pauseSec 2, unreliableSec 1, spanSec 100 } tiers minor with gapFraction 0.06', async () => {
    const result = await gapProfileSignalOverCoverage({
      spanSec: 100,
      coveredSec: 94,
      recordingGapSec: 3,
      pauseSec: 2,
      unreliableSec: 1,
    });
    expect(result.tier).toBe('minor');
    expect(result.gapFraction).toBeCloseTo(0.06, 10);
  });

  it('unreliableSec 0 reproduces today\'s (pre-D-04) tier and fraction exactly, for a matrix of recordingGapSec/pauseSec combinations', async () => {
    const cases: Array<{ recordingGapSec: number; pauseSec: number; spanSec: number; expectTier: 'severe' | 'minor' | 'none' }> = [
      { recordingGapSec: 25, pauseSec: 0, spanSec: 100, expectTier: 'severe' }, // 0.25 > 0.20
      { recordingGapSec: 3, pauseSec: 3, spanSec: 100, expectTier: 'minor' }, // 0.06 > 0.05
      { recordingGapSec: 0, pauseSec: 1, spanSec: 100, expectTier: 'none' }, // 0.01 <= 0.05
    ];
    for (const c of cases) {
      const result = await gapProfileSignalOverCoverage({
        spanSec: c.spanSec,
        coveredSec: c.spanSec - c.recordingGapSec - c.pauseSec,
        recordingGapSec: c.recordingGapSec,
        pauseSec: c.pauseSec,
        unreliableSec: 0,
      });
      const expectedFraction = (c.recordingGapSec + c.pauseSec) / c.spanSec;
      expect(result.tier).toBe(c.expectTier);
      expect(result.gapFraction).toBeCloseTo(expectedFraction, 10);
    }
  });

  it('spanSec 0 still returns tier not-computable with every numeric field null, even when unreliableSec is present on the mocked coverage', async () => {
    const result = await gapProfileSignalOverCoverage({
      spanSec: 0,
      coveredSec: 0,
      recordingGapSec: 0,
      pauseSec: 0,
      unreliableSec: 50,
    });
    expect(result.tier).toBe('not-computable');
    expect(result.gapFraction).toBeNull();
    expect(result.recordingGapSec).toBeNull();
    expect(result.pauseSec).toBeNull();
    expect(result.spanSec).toBeNull();
  });

  it("D-05: GAP_PROFILE_SEVERE_FRACTION and GAP_PROFILE_MINOR_FRACTION are frozen at their pre-Phase-33 values, never re-derived for the widened numerator", () => {
    expect(GAP_PROFILE_SEVERE_FRACTION).toBe(0.2);
    expect(GAP_PROFILE_MINOR_FRACTION).toBe(0.05);
  });

  it('real stream 3475724402: gapFraction equals the three-term (recordingGapSec + pauseSec + unreliableSec) / spanSec recomputed independently from classifyGaps\' own coverage object, and is strictly greater than the two-term fraction over the same object', () => {
    const stream = JSON.parse(
      fs.readFileSync(path.join('data', 'streams', '3475724402.json'), 'utf-8')
    ) as CanonicalStream;

    // The real, unmocked classifyGaps — this test runs after the mocked
    // cases above each tear their own mock down in a `finally` block, so
    // this call resolves the genuine module.
    const coverage = classifyGaps(stream.t, stream.d);
    const result = gapProfileSignal(stream.t, stream.d);

    const threeTermFraction =
      (coverage.recordingGapSec + coverage.pauseSec + coverage.unreliableSec) / coverage.spanSec;
    const twoTermFraction = (coverage.recordingGapSec + coverage.pauseSec) / coverage.spanSec;

    // eslint-disable-next-line no-console
    console.log(
      '[pace-quality gapProfile 3475724402] ' +
        JSON.stringify({
          spanSec: coverage.spanSec,
          recordingGapSec: coverage.recordingGapSec,
          pauseSec: coverage.pauseSec,
          unreliableSec: coverage.unreliableSec,
          threeTermFraction,
          twoTermFraction,
        })
    );

    // Reachability: this stream must actually carry detected unreliable
    // time for the "strictly greater" discriminator below to be checkable
    // at all (33-CONTEXT.md's own named fixture: 18 gaps, 30 gap-adjacent
    // bursts).
    expect(coverage.unreliableSec).toBeGreaterThan(0);

    expect(result.gapFraction).toBeCloseTo(threeTermFraction, 10);
    expect(threeTermFraction).toBeGreaterThan(twoTermFraction);
  });

  it("shard passthrough: buildPaceQualityShard on real stream 3475724402 carries at least one kind: 'unreliable' interval, and every interval's kind is one of the four valid GapKind values", () => {
    const stream = JSON.parse(
      fs.readFileSync(path.join('data', 'streams', '3475724402.json'), 'utf-8')
    ) as CanonicalStream;
    const metadata: ActivityQualityMetadata = {
      deviceName: 'test-device',
      sourceProvider: undefined,
      elapsedTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
      movingTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
      startLatlng: undefined,
      endLatlng: undefined,
    };

    const shard = buildPaceQualityShard('3475724402', stream, metadata);

    // The four-valued PairKind superset ('recording-gap' | 'pause' |
    // 'unreliable' | 'covered') — 'covered' never actually appears in
    // `gapIntervals` (only non-covered runs are pushed), but is included
    // here so this assertion checks against the real full kind universe
    // rather than a narrower assumption of which three are reachable.
    const validKinds = new Set(['recording-gap', 'pause', 'unreliable', 'covered']);
    expect(shard.gapIntervals.length).toBeGreaterThan(0);
    for (const interval of shard.gapIntervals) {
      expect(validKinds.has(interval.kind)).toBe(true);
    }
    const unreliableIntervals = shard.gapIntervals.filter((g) => g.kind === 'unreliable');
    // eslint-disable-next-line no-console
    console.log(
      '[pace-quality shard passthrough 3475724402] ' +
        JSON.stringify({
          totalIntervals: shard.gapIntervals.length,
          unreliableIntervals: unreliableIntervals.length,
        })
    );
    expect(unreliableIntervals.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// unreliableSegments — the seventh quality signal (D-06/D-07/D-08, SEG-06, plan 33-09)
// ---------------------------------------------------------------------------

/**
 * Builds a minimal, valid `UnreliableSegment` for `unreliableSegmentsSignal`
 * unit tests — every field the interface requires, with sane defaults a
 * caller overrides only the fields a given case cares about. Test-only;
 * never read by production code.
 */
function fakeSegment(
  overrides: Pick<UnreliableSegment, 'metres' | 'seconds' | 'excessMetres' | 'mechanism'> &
    Partial<UnreliableSegment>
): UnreliableSegment {
  return {
    startIndex: 0,
    endIndex: 1,
    startSec: 0,
    endSec: overrides.seconds,
    burstMetres: overrides.metres,
    burstSeconds: overrides.seconds,
    gapMetres: 0,
    gapSeconds: 0,
    burstCount: 1,
    gapCount: 0,
    parts: [],
    ...overrides,
  };
}

describe('unreliableSegmentsSignal — the seventh quality signal (D-06/D-07/D-08, SEG-06, plan 33-09)', () => {
  // A flat-distance, otherwise-valid stream — totalDistanceM (d[n-1] - d[0])
  // is exactly 0, distinct from an invalid stream (validateStreamSeries
  // still passes: t strictly increasing, d non-decreasing).
  const FLAT_DISTANCE_STREAM = makeStream({ t: [0, 10, 20, 30], d: [100, 100, 100, 100] });
  // An ordinary, valid stream with real distance (totalDistanceM = 1000) —
  // the "count 0" / "minor" / "severe" / mechanisms / sum cases below all
  // share this as their t/d, varying only the hand-crafted `segments` array
  // passed to `unreliableSegmentsSignal`.
  const REAL_STREAM = makeStream({ t: [0, 10, 20, 30, 40], d: [0, 50, 100, 150, 1000] });
  // totalDistanceM = 1 exactly — division by 1 is exact in IEEE-754, so the
  // D-07 boundary case below can compare against
  // UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION with no floating-point
  // rounding risk.
  const UNIT_DISTANCE_STREAM = makeStream({ t: [0, 10], d: [0, 1] });

  it('zero segments: tier none, count 0, totalMetres 0, totalExcessMetres 0, totalSeconds 0, excessFraction 0, mechanisms []', () => {
    const result = unreliableSegmentsSignal(REAL_STREAM.t, REAL_STREAM.d, []);
    expect(result).toEqual<UnreliableSegmentsSignal>({
      tier: 'none',
      count: 0,
      totalMetres: 0,
      totalExcessMetres: 0,
      totalSeconds: 0,
      excessFraction: 0,
      mechanisms: [],
    });
  });

  it('a segment whose excessFraction is at or below the D-07 cut tiers minor — including exactly 0 excess (the 3475724402 gap-dilution finding) and exactly AT the cut (division by 1, no floating-point risk)', () => {
    // Below the cut: a single segment with 0 excess metres.
    const belowCutSegments = [
      fakeSegment({ metres: 30, seconds: 10, excessMetres: 0, mechanism: 'gap-adjacent' }),
    ];
    const belowCutResult = unreliableSegmentsSignal(REAL_STREAM.t, REAL_STREAM.d, belowCutSegments);
    expect(belowCutResult.tier).toBe('minor');
    expect(belowCutResult.count).toBe(1);
    expect(belowCutResult.excessFraction).toBe(0);

    // Exactly AT the cut: UNIT_DISTANCE_STREAM's totalDistanceM is 1, so
    // excessFraction === excessMetres exactly (division by 1) — strictly
    // greater-than is what promotes to severe (matching
    // tierGapProfileFromCoverage's own >-not->= convention), so exactly AT
    // the cut must still be minor.
    const atCutSegments = [
      fakeSegment({
        metres: 1,
        seconds: 10,
        excessMetres: UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION,
        mechanism: 'gap-adjacent',
      }),
    ];
    const atCutResult = unreliableSegmentsSignal(
      UNIT_DISTANCE_STREAM.t,
      UNIT_DISTANCE_STREAM.d,
      atCutSegments
    );
    expect(atCutResult.excessFraction).toBe(UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION);
    expect(atCutResult.tier).toBe('minor');
  });

  it('a segment whose excessFraction is above the D-07 cut tiers severe', () => {
    const aboveCutSegments = [
      fakeSegment({
        metres: 1,
        seconds: 10,
        excessMetres: UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION + 0.001,
        mechanism: 'hidden-pause',
      }),
    ];
    const result = unreliableSegmentsSignal(
      UNIT_DISTANCE_STREAM.t,
      UNIT_DISTANCE_STREAM.d,
      aboveCutSegments
    );
    expect(result.tier).toBe('severe');
  });

  it('totalDistanceM <= 0 (a flat-distance but otherwise-valid stream) returns tier not-computable with every numeric field null and mechanisms null — never zeroed', () => {
    const segments = [fakeSegment({ metres: 5, seconds: 5, excessMetres: 1, mechanism: 'isolated-jump' })];
    const result = unreliableSegmentsSignal(FLAT_DISTANCE_STREAM.t, FLAT_DISTANCE_STREAM.d, segments);
    expect(result).toEqual<UnreliableSegmentsSignal>({
      tier: 'not-computable',
      count: null,
      totalMetres: null,
      totalExcessMetres: null,
      totalSeconds: null,
      excessFraction: null,
      mechanisms: null,
    });
  });

  it('a stream failing validateStreamSeries (length mismatch) returns tier not-computable with every numeric field null and mechanisms null', () => {
    const result = unreliableSegmentsSignal([0, 1, 2], [0, 1], []);
    expect(result).toEqual<UnreliableSegmentsSignal>({
      tier: 'not-computable',
      count: null,
      totalMetres: null,
      totalExcessMetres: null,
      totalSeconds: null,
      excessFraction: null,
      mechanisms: null,
    });
  });

  it('mechanisms lists each distinct mechanism present, in the fixed gap-adjacent/hidden-pause/isolated-jump order, with no duplicates, regardless of detection order', () => {
    const segments = [
      fakeSegment({ metres: 10, seconds: 5, excessMetres: 0, mechanism: 'isolated-jump' }),
      fakeSegment({ metres: 10, seconds: 5, excessMetres: 0, mechanism: 'gap-adjacent' }),
      fakeSegment({ metres: 10, seconds: 5, excessMetres: 0, mechanism: 'isolated-jump' }), // duplicate mechanism
      fakeSegment({ metres: 10, seconds: 5, excessMetres: 0, mechanism: 'hidden-pause' }),
    ];
    const result = unreliableSegmentsSignal(REAL_STREAM.t, REAL_STREAM.d, segments);
    expect(result.mechanisms).toEqual<SegmentMechanism[]>(['gap-adjacent', 'hidden-pause', 'isolated-jump']);
    expect(result.count).toBe(4); // count is the raw segment count, not the distinct-mechanism count
  });

  it("totalExcessMetres/totalMetres/totalSeconds are exact sums of the segments' own fields — no excess arithmetic of its own", () => {
    const segments = [
      fakeSegment({ metres: 12.5, seconds: 4.2, excessMetres: 1.1, mechanism: 'gap-adjacent' }),
      fakeSegment({ metres: 30.75, seconds: 9.8, excessMetres: 2.9, mechanism: 'hidden-pause' }),
    ];
    const result = unreliableSegmentsSignal(REAL_STREAM.t, REAL_STREAM.d, segments);
    expect(result.totalMetres).toBeCloseTo(12.5 + 30.75, 10);
    expect(result.totalSeconds).toBeCloseTo(4.2 + 9.8, 10);
    expect(result.totalExcessMetres).toBeCloseTo(1.1 + 2.9, 10);
  });

  describe("real-stream count/totalMetres/totalSeconds match classifyGapsWithSegments' own segments (3475724402, 3475734189, 3475740390)", () => {
    const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390'] as const;

    it.each(NAMED_ACTIVITY_IDS)('%s', (id) => {
      const stream = JSON.parse(
        fs.readFileSync(path.join('data', 'streams', `${id}.json`), 'utf-8')
      ) as CanonicalStream;
      const { segments } = classifyGapsWithSegments(stream.t, stream.d);
      expect(segments.length).toBeGreaterThan(0); // reachability — all three named activities carry >=1 segment

      const expectedTotalMetres = segments.reduce((sum, s) => sum + s.metres, 0);
      const expectedTotalSeconds = segments.reduce((sum, s) => sum + s.seconds, 0);

      const result = unreliableSegmentsSignal(stream.t, stream.d, segments);

      // eslint-disable-next-line no-console
      console.log(
        `[pace-quality unreliableSegmentsSignal ${id}] ` +
          JSON.stringify({
            count: result.count,
            totalMetres: result.totalMetres,
            totalExcessMetres: result.totalExcessMetres,
            totalSeconds: result.totalSeconds,
            excessFraction: result.excessFraction,
            tier: result.tier,
          })
      );

      expect(result.count).toBe(segments.length);
      expect(result.totalMetres).toBeCloseTo(expectedTotalMetres, 9);
      expect(result.totalSeconds).toBeCloseTo(expectedTotalSeconds, 9);
    });
  });

  /**
   * One-detector-run-per-producer (T-33-12c): `computePaceQualitySignals`
   * and `buildPaceQualityShard` each resolve coverage-and-segments EXACTLY
   * ONCE per activity, sharing the result between `gapProfile` and this
   * signal — never a second independent `classifyGapsWithSegments` call
   * within one producer. A namespace `vi.spyOn` cannot observe a named
   * import (Phase 32 GAP 2's exact shape) — this counts real invocations of
   * the REAL `classifyGapsWithSegments` via a `vi.doMock` wrapper instead,
   * and first demonstrates the counter itself is observant (reads 2 after
   * two calls) before trusting its 1-per-producer readings.
   */
  describe('one detector run per producer (T-33-12c)', () => {
    async function withCountingClassifyGapsWithSegments<T>(
      fn: (getCallCount: () => number) => Promise<T>
    ): Promise<T> {
      let callCount = 0;
      vi.doMock('./pace-derivation.js', async () => {
        const actual =
          await vi.importActual<typeof import('./pace-derivation.js')>('./pace-derivation.js');
        return {
          ...actual,
          classifyGapsWithSegments: (...args: Parameters<typeof classifyGapsWithSegments>) => {
            callCount++;
            return actual.classifyGapsWithSegments(...args);
          },
        };
      });
      vi.resetModules();
      try {
        return await fn(() => callCount);
      } finally {
        vi.doUnmock('./pace-derivation.js');
        vi.resetModules();
      }
    }

    it('the counter itself observes: calling the mocked classifyGapsWithSegments twice reads 2, proving it is not vacuously fixed at 0/1', async () => {
      await withCountingClassifyGapsWithSegments(async (getCallCount) => {
        const mod = await import('./pace-derivation.js');
        mod.classifyGapsWithSegments([0, 10], [0, 5]);
        mod.classifyGapsWithSegments([0, 10], [0, 5]);
        expect(getCallCount()).toBe(2);
      });
    });

    it('computePaceQualitySignals causes exactly ONE classifyGapsWithSegments call per activity', async () => {
      const stream = JSON.parse(
        fs.readFileSync(path.join('data', 'streams', '3475724402.json'), 'utf-8')
      ) as CanonicalStream;
      const metadata: ActivityQualityMetadata = {
        deviceName: 'test-device',
        sourceProvider: undefined,
        elapsedTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
        movingTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
        startLatlng: undefined,
        endLatlng: undefined,
      };

      await withCountingClassifyGapsWithSegments(async (getCallCount) => {
        const mod = await import('./pace-quality.js');
        const result = mod.computePaceQualitySignals(stream, metadata);
        expect(getCallCount()).toBe(1);
        // Reachability: the shared call genuinely fed both signals — not a
        // vacuous 1-call reading against a producer that short-circuited.
        expect(result.unreliableSegments.count).toBeGreaterThan(0);
      });
    });

    it('buildPaceQualityShard causes exactly ONE classifyGapsWithSegments call per activity', async () => {
      const stream = JSON.parse(
        fs.readFileSync(path.join('data', 'streams', '3475724402.json'), 'utf-8')
      ) as CanonicalStream;
      const metadata: ActivityQualityMetadata = {
        deviceName: 'test-device',
        sourceProvider: undefined,
        elapsedTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
        movingTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
        startLatlng: undefined,
        endLatlng: undefined,
      };

      await withCountingClassifyGapsWithSegments(async (getCallCount) => {
        const mod = await import('./pace-quality.js');
        const shard = mod.buildPaceQualityShard('3475724402', stream, metadata);
        expect(getCallCount()).toBe(1);
        expect(shard.signals.unreliableSegments.count).toBeGreaterThan(0);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// impossible samples (Task 2)
// ---------------------------------------------------------------------------

describe('impossible samples detector', () => {
  it('syntheticImpossibleSpeedStream reports count > 0 with maxImpliedSpeedMps above the floor', () => {
    const stream = syntheticImpossibleSpeedStream();
    const result = countImpossibleSamples(stream.t, stream.d);
    expect(result.count).toBeGreaterThan(0);
    expect(result.maxImpliedSpeedMps).not.toBeNull();
    expect(result.maxImpliedSpeedMps!).toBeGreaterThan(10.44);
  });

  it('the pinned impossible-speed-sample fixture (10232917652) reproduces the recorded offending index and speed', () => {
    const fixture = PINNED_FIXTURES.find((f) => f.name === 'impossible-speed-sample')!;
    const stream = loadPinnedStream('impossible-speed-sample');
    const result = countImpossibleSamples(stream.t, stream.d);

    const entry = result.samples.find((s) => s.index === (fixture.expected.offendingIndex as number));
    expect(entry).toBeDefined();
    expect(Math.round(entry!.impliedSpeedMps * 100) / 100).toBeCloseTo(
      fixture.expected.offendingSpeedMps as number,
      1
    );
  });

  it('a clean stream reports count 0, maxImpliedSpeedMps null (never 0), tier none', () => {
    const t = Array.from({ length: 30 }, (_, i) => i * 2);
    const d = Array.from({ length: 30 }, (_, i) => i * 6); // 3 m/s, well under the floor
    const stream = makeStream({ id: 'clean-impossible-check', t, d });

    const raw = countImpossibleSamples(stream.t, stream.d);
    expect(raw.count).toBe(0);
    expect(raw.maxImpliedSpeedMps).toBeNull();

    const signal = impossibleSampleSignal(stream.t, stream.d);
    expect(signal.tier).toBe('none');
  });

  it('loadPinnedStream("decimation-aliased") carries BOTH severe decimation AND a non-zero impossible count with the coupling disclosed', () => {
    const stream = loadPinnedStream('decimation-aliased');
    const decimation = decimationSignal(stream.t, stream.d);
    const impossible = countImpossibleSamples(stream.t, stream.d);

    expect(decimation.tier).toBe('severe');
    expect(impossible.count).toBeGreaterThan(0);
    expect(impossible.countInsideZeroAdvanceRun).toBeGreaterThan(0);
  });

  it('impossibleFloorMps override is connected in both directions', () => {
    const firingStream = syntheticImpossibleSpeedStream();
    const highOverride = impossibleSampleSignal(firingStream.t, firingStream.d, {
      impossibleFloorMps: 1000,
    });
    expect(highOverride.count).toBe(0);

    const t = Array.from({ length: 30 }, (_, i) => i * 2);
    const d = Array.from({ length: 30 }, (_, i) => i * 6); // 3 m/s clean stream
    const cleanStream = makeStream({ id: 'clean-override-check', t, d });
    const lowOverride = impossibleSampleSignal(cleanStream.t, cleanStream.d, {
      impossibleFloorMps: 0.1,
    });
    expect(lowOverride.count!).toBeGreaterThan(0);
  });

  it('samples is capped at 100 while count exceeds 100', () => {
    const n = 150;
    const t = Array.from({ length: n }, (_, i) => i); // 1s apart
    const d = Array.from({ length: n }, (_, i) => i * 20); // 20 m/s, well over the floor, every pair offends
    const stream = makeStream({ id: 'many-impossible', t, d });

    const result = countImpossibleSamples(stream.t, stream.d);
    expect(result.count).toBeGreaterThan(100);
    expect(result.samples.length).toBe(100);
  });

  it('totality: malformed/adversarial input returns the zeroed shape without throwing and without Infinity', () => {
    const cases: Array<[number[], number[]]> = [
      [[], []],
      [[0, 1, 2], [0, 1]], // mismatched lengths
      [[0, 0], [0, 0]], // dt === 0
      [[0, 1], [NaN, 1]],
    ];
    for (const [t, d] of cases) {
      expect(() => countImpossibleSamples(t, d)).not.toThrow();
      const result = countImpossibleSamples(t, d);
      expect(result.count).toBe(0);
      expect(result.maxImpliedSpeedMps).not.toBe(Infinity);
      expect(Number.isFinite(result.maxImpliedSpeedMps ?? 0)).toBe(true);
      expect(result.samples).toEqual([]);
    }
  });

  it('IMPOSSIBLE_SAMPLE_SEVERE_COUNT is a positive integer cut, not a fraction', () => {
    expect(Number.isInteger(IMPOSSIBLE_SAMPLE_SEVERE_COUNT)).toBe(true);
    expect(IMPOSSIBLE_SAMPLE_SEVERE_COUNT).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// independent signals (QUAL-02) and shard (Task 3)
// ---------------------------------------------------------------------------

describe('independent signals (QUAL-02)', () => {
  it('deviceEra and decimation are two separately readable fields that cannot be collapsed', () => {
    const activity = loadPinnedActivity('decimation-aliased');
    const stream = loadPinnedStream('decimation-aliased');
    const metadata = fullMetadataOf(activity);

    const result = computePaceQualitySignals(stream, metadata);

    expect(result.deviceEra.family).toBe('suunto-9');
    expect(result.decimation.tier).toBe('severe');
    expect(result.deviceEra).not.toHaveProperty('tier');

    // Mutating decimation.tier must not affect deviceEra.
    result.decimation.tier = 'none';
    expect(result.deviceEra.family).toBe('suunto-9');
  });

  it('impossibleSamples and decimation are separately readable and the coupling is disclosed, not resolved by dropping one', () => {
    const activity = loadPinnedActivity('decimation-aliased');
    const stream = loadPinnedStream('decimation-aliased');
    const metadata = fullMetadataOf(activity);

    const result = computePaceQualitySignals(stream, metadata);

    expect(result.decimation.tier).toBe('severe');
    expect(result.impossibleSamples.tier).not.toBeNull();
    expect(result.impossibleSamples.countInsideZeroAdvanceRun).not.toBeNull();
    expect(result.impossibleSamples.countInsideZeroAdvanceRun!).toBeGreaterThan(0);
  });

  it('computePaceQualitySignals(null, metadata) reports all three tiering signals not-computable, anySevere false, deviceEra still resolved', () => {
    const metadata: ActivityQualityMetadata = {
      deviceName: 'Suunto 9',
      sourceProvider: undefined,
      elapsedTimeSec: 3600,
      movingTimeSec: 3000,
      startLatlng: undefined,
      endLatlng: undefined,
    };

    const result = computePaceQualitySignals(null, metadata);

    expect(result.decimation.tier).toBe('not-computable');
    expect(result.gapProfile.tier).toBe('not-computable');
    expect(result.impossibleSamples.tier).toBe('not-computable');
    expect(result.notComputableReason).toBe(NOT_COMPUTABLE_NO_STREAM);
    expect(result.anySevere).toBe(false);
    expect(result.deviceEra.family).toBe('suunto-9');
  });

  it('hasAnySevereSignal truth table', () => {
    const none: ActivityQualitySignals['decimation'] = { tier: 'none', zeroAdvanceFraction: 0, sampleCount: 10 };
    const minor: ActivityQualitySignals['decimation'] = { tier: 'minor', zeroAdvanceFraction: 0.1, sampleCount: 10 };
    const severe: ActivityQualitySignals['decimation'] = { tier: 'severe', zeroAdvanceFraction: 0.5, sampleCount: 10 };
    const notComputable: ActivityQualitySignals['decimation'] = {
      tier: 'not-computable',
      zeroAdvanceFraction: null,
      sampleCount: null,
    };

    const gapNone: ActivityQualitySignals['gapProfile'] = {
      tier: 'none',
      gapFraction: 0,
      recordingGapSec: 0,
      pauseSec: 0,
      spanSec: 100,
    };
    const impossibleNone: ActivityQualitySignals['impossibleSamples'] = {
      tier: 'none',
      count: 0,
      maxImpliedSpeedMps: null,
      countInsideZeroAdvanceRun: 0,
    };

    // Severe in each of the three slots individually -> true.
    expect(
      hasAnySevereSignal({ decimation: severe, gapProfile: gapNone, impossibleSamples: impossibleNone })
    ).toBe(true);
    expect(
      hasAnySevereSignal({
        decimation: none,
        gapProfile: { ...gapNone, tier: 'severe' },
        impossibleSamples: impossibleNone,
      })
    ).toBe(true);
    expect(
      hasAnySevereSignal({
        decimation: none,
        gapProfile: gapNone,
        impossibleSamples: { ...impossibleNone, tier: 'severe' },
      })
    ).toBe(true);

    // All minor -> false.
    expect(
      hasAnySevereSignal({
        decimation: minor,
        gapProfile: { ...gapNone, tier: 'minor' },
        impossibleSamples: { ...impossibleNone, tier: 'minor' },
      })
    ).toBe(false);

    // All not-computable -> false.
    expect(
      hasAnySevereSignal({
        decimation: notComputable,
        gapProfile: { ...gapNone, tier: 'not-computable' },
        impossibleSamples: { ...impossibleNone, tier: 'not-computable' },
      })
    ).toBe(false);

    // Mixed not-computable/severe -> true.
    expect(
      hasAnySevereSignal({
        decimation: notComputable,
        gapProfile: { ...gapNone, tier: 'severe' },
        impossibleSamples: impossibleNone,
      })
    ).toBe(true);
  });
});

describe('D-17 evidence shard', () => {
  it('buildPaceQualityShard on a clean synthetic stream: intervals, non-null run profile, matching adaptiveWindowSec, under 20 KB', () => {
    const stream = syntheticMultiHourPauseStream();
    const metadata: ActivityQualityMetadata = {
      deviceName: 'Suunto 9',
      sourceProvider: undefined,
      elapsedTimeSec: 12000,
      movingTimeSec: 12000,
      startLatlng: undefined,
      endLatlng: undefined,
    };

    const shard = buildPaceQualityShard('synthetic-clean', stream, metadata);

    expect(Array.isArray(shard.gapIntervals)).toBe(true);
    expect(shard.zeroAdvanceRunProfile).not.toBeNull();
    expect(shard.adaptiveWindowSec).toBe(recomputeAdaptiveWindowSec(stream.t, stream.d));
    expect(JSON.stringify(shard).length).toBeLessThan(20_000);
  });

  it('buildPaceQualityShard on the decimation-aliased fixture (worst case for run count) stays under 20 KB serialized', () => {
    const activity = loadPinnedActivity('decimation-aliased');
    const stream = loadPinnedStream('decimation-aliased');
    const metadata = fullMetadataOf(activity);

    const shard = buildPaceQualityShard('5059204779', stream, metadata);

    expect(JSON.stringify(shard).length).toBeLessThan(20_000);
  });

  it('buildPaceQualityShard(id, null, metadata) returns a shard with activityId set, empty evidence, and NOT_COMPUTABLE_NO_STREAM', () => {
    const metadata: ActivityQualityMetadata = {
      deviceName: 'Suunto 9',
      sourceProvider: undefined,
      elapsedTimeSec: 3600,
      movingTimeSec: 3000,
      startLatlng: undefined,
      endLatlng: undefined,
    };

    const shard = buildPaceQualityShard('no-stream-activity', null, metadata);

    expect(shard.activityId).toBe('no-stream-activity');
    expect(shard.gapIntervals).toEqual([]);
    expect(shard.impossibleSamples).toEqual([]);
    expect(shard.impossibleSamplesTruncated).toBe(false);
    expect(shard.zeroAdvanceRunProfile).toBeNull();
    expect(shard.adaptiveWindowSec).toBeNull();
    expect(shard.notComputableReason).toBe(NOT_COMPUTABLE_NO_STREAM);
    expect(shard.signals.notComputableReason).toBe(NOT_COMPUTABLE_NO_STREAM);
  });
});

describe('elevation detectors (D-07..D-09, ELEV-01)', () => {
  describe('subGroundSignal — threshold boundary', () => {
    it('flags when the minimum altitude is just below -50 m', () => {
      const belowThreshold = SUB_GROUND_MIN_ALT_M - 0.1;
      const result = subGroundSignal([10, belowThreshold, 5]);
      expect(result.flagged).toBe(true);
      expect(result.minAltM).toBe(belowThreshold);
    });

    it('does not flag at exactly the threshold (strict inequality)', () => {
      const result = subGroundSignal([10, SUB_GROUND_MIN_ALT_M, 5]);
      expect(result.flagged).toBe(false);
      expect(result.minAltM).toBe(SUB_GROUND_MIN_ALT_M);
    });

    it('does not flag just above the threshold', () => {
      const aboveThreshold = SUB_GROUND_MIN_ALT_M + 0.1;
      const result = subGroundSignal([10, aboveThreshold, 5]);
      expect(result.flagged).toBe(false);
      expect(result.minAltM).toBe(aboveThreshold);
    });
  });

  describe('closureDriftSignal — threshold boundary (in-loop pair, distance 0)', () => {
    const inLoopStart = [46.5, 7.3];
    const inLoopEnd = [46.5, 7.3];

    it('flags when |deltaM| is just above the threshold', () => {
      const overThreshold = CLOSURE_DRIFT_SEVERE_DELTA_M + 0.1;
      const result = closureDriftSignal([0, overThreshold], inLoopStart, inLoopEnd);
      expect(result.state).toBe('flagged');
      expect(result.deltaM).toBe(overThreshold);
      expect(result.startEndDistM).toBe(0);
    });

    it('does not flag at exactly the threshold (strict inequality)', () => {
      const result = closureDriftSignal([0, CLOSURE_DRIFT_SEVERE_DELTA_M], inLoopStart, inLoopEnd);
      expect(result.state).toBe('clear');
      expect(result.deltaM).toBe(CLOSURE_DRIFT_SEVERE_DELTA_M);
    });

    it('does not flag just below the threshold', () => {
      const underThreshold = CLOSURE_DRIFT_SEVERE_DELTA_M - 0.1;
      const result = closureDriftSignal([0, underThreshold], inLoopStart, inLoopEnd);
      expect(result.state).toBe('clear');
      expect(result.deltaM).toBe(underThreshold);
    });
  });

  describe('verticalRateSignal — threshold boundary', () => {
    it('flags when the rate is just above the threshold', () => {
      const result = verticalRateSignal([0, 2], [0, VERTICAL_RATE_SEVERE_MPS * 2 + 0.2]);
      expect(result.flagged).toBe(true);
      expect(result.worstRateMps).toBeCloseTo(VERTICAL_RATE_SEVERE_MPS + 0.1, 5);
      expect(result.violatingSamples).toBe(1);
    });

    it('does not flag at exactly the threshold (strict inequality), but still reports the worst rate', () => {
      const result = verticalRateSignal([0, 2], [0, VERTICAL_RATE_SEVERE_MPS * 2]);
      expect(result.flagged).toBe(false);
      expect(result.worstRateMps).toBe(VERTICAL_RATE_SEVERE_MPS);
      expect(result.violatingSamples).toBe(0);
    });

    it('does not flag just below the threshold', () => {
      const result = verticalRateSignal([0, 2], [0, VERTICAL_RATE_SEVERE_MPS * 2 - 0.2]);
      expect(result.flagged).toBe(false);
      expect(result.worstRateMps).toBeCloseTo(VERTICAL_RATE_SEVERE_MPS - 0.1, 5);
      expect(result.violatingSamples).toBe(0);
    });
  });

  describe('closureDriftSignal — position outcomes (D-01/D-02, Pitfall 4)', () => {
    it('reports not-computable when both positions are absent', () => {
      const result = closureDriftSignal([0, 10], undefined, undefined);
      expect(result).toEqual({ state: 'not-computable', deltaM: null, startEndDistM: null });
    });

    it("reports not-computable for Strava's own empty-array no-GPS convention", () => {
      const result = closureDriftSignal([0, 10], [], [46.5, 7.3]);
      expect(result.state).toBe('not-computable');
      expect(result.deltaM).toBeNull();
      expect(result.startEndDistM).toBeNull();
    });

    it('reports not-computable for a one-element position array', () => {
      const result = closureDriftSignal([0, 10], [46.5], [46.5, 7.3]);
      expect(result.state).toBe('not-computable');
      expect(result.startEndDistM).toBeNull();
    });

    it('reports not-computable for a non-finite coordinate', () => {
      const result = closureDriftSignal([0, 10], [NaN, 7.3], [46.5, 7.3]);
      expect(result.state).toBe('not-computable');
      expect(result.startEndDistM).toBeNull();
    });

    it('reports clear (excluded by design) for a point-to-point pair ~1 km apart, distance retained and distinguishable from not-computable', () => {
      // ~1 km of latitude at this longitude: 1 degree latitude ~= 111.2 km.
      const start = [46.5, 7.3];
      const end = [46.509, 7.3];
      // A delta that WOULD flag if the loop gate did not exclude this pair first.
      const result = closureDriftSignal([0, 90], start, end);
      expect(result.state).toBe('clear');
      expect(result.deltaM).toBeNull();
      expect(result.startEndDistM).not.toBeNull();
      expect(result.startEndDistM!).toBeGreaterThan(LOOP_RADIUS_M);
    });
  });

  describe('totality (T-26-01/T-26-02) — malformed input never throws, never coerces to a plausible zero', () => {
    it('subGroundSignal(undefined) is not-computable-shaped, never a fabricated 0', () => {
      expect(() => subGroundSignal(undefined)).not.toThrow();
      expect(subGroundSignal(undefined)).toEqual({ flagged: false, minAltM: null });
    });

    it('subGroundSignal([]) is not-computable-shaped', () => {
      expect(subGroundSignal([])).toEqual({ flagged: false, minAltM: null });
    });

    it('subGroundSignal([NaN, NaN]) ignores non-finite entries rather than poisoning the minimum', () => {
      expect(() => subGroundSignal([NaN, NaN])).not.toThrow();
      expect(subGroundSignal([NaN, NaN])).toEqual({ flagged: false, minAltM: null });
    });

    it('closureDriftSignal never throws on undefined/empty/non-finite input', () => {
      expect(() => closureDriftSignal(undefined, undefined, undefined)).not.toThrow();
      expect(() => closureDriftSignal([], [], [])).not.toThrow();
      expect(() => closureDriftSignal([NaN, NaN], [NaN, NaN], [NaN, NaN])).not.toThrow();
      // A valid in-radius position pair with a too-short alt array is
      // not-computable but the measured distance (0) is still retained.
      expect(closureDriftSignal([], [46.5, 7.3], [46.5, 7.3])).toEqual({
        state: 'not-computable',
        deltaM: null,
        startEndDistM: 0,
      });
    });

    it('verticalRateSignal(undefined, undefined) is not-computable-shaped, never a fabricated 0', () => {
      expect(() => verticalRateSignal(undefined, undefined)).not.toThrow();
      expect(verticalRateSignal(undefined, undefined)).toEqual({
        flagged: false,
        worstRateMps: null,
        violatingSamples: null,
      });
    });

    it('verticalRateSignal([], []) is not-computable-shaped', () => {
      expect(verticalRateSignal([], [])).toEqual({
        flagged: false,
        worstRateMps: null,
        violatingSamples: null,
      });
    });

    it('verticalRateSignal([NaN, NaN], [NaN, NaN]) never throws and never coerces to 0', () => {
      expect(() => verticalRateSignal([NaN, NaN], [NaN, NaN])).not.toThrow();
      expect(verticalRateSignal([NaN, NaN], [NaN, NaN])).toEqual({
        flagged: false,
        worstRateMps: null,
        violatingSamples: null,
      });
    });

    it('verticalRateSignal handles a mismatched-length t/alt pair without throwing', () => {
      const t = [0, 2, 4, 6, 8];
      const alt = [0, 5, 10]; // shorter than t
      expect(() => verticalRateSignal(t, alt)).not.toThrow();
      const result = verticalRateSignal(t, alt);
      expect(result.worstRateMps).not.toBeNull();
      expect(result.flagged).toBe(false);
    });
  });
});

describe('elevation assembly, anySevere exclusion, and not-computable rollup (D-05..D-07, Phase 30 D-06)', () => {
  it("anySevere excludes elevation: a severe elevation tier never flips hasAnySevereSignal (Phase 30's own most-consequential-mistake guard)", () => {
    const tieringNone: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'> = {
      decimation: { tier: 'none', zeroAdvanceFraction: 0, sampleCount: 10 },
      gapProfile: { tier: 'none', gapFraction: 0, recordingGapSec: 0, pauseSec: 0, spanSec: 100 },
      impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
    };
    const severeElevation: ActivityQualitySignals['elevation'] = {
      tier: 'severe',
      subGround: { flagged: true, minAltM: -282 },
      closureDrift: { state: 'clear', deltaM: null, startEndDistM: 500 },
      verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
    };
    const full = { ...tieringNone, elevation: severeElevation };

    // Primary assertion: all three TIERING signals are 'none', elevation is
    // 'severe' — hasAnySevereSignal must still read false. A future
    // widening of the Pick<> to fold elevation into this composite (the
    // single most consequential mistake this phase could make, D-06) would
    // flip this to true.
    expect(hasAnySevereSignal(full)).toBe(false);

    // Structural guard: severe-ifying each of the three TIERING keys DOES
    // flip the result (proving they ARE read)...
    expect(hasAnySevereSignal({ ...full, decimation: { ...full.decimation, tier: 'severe' } })).toBe(true);
    expect(hasAnySevereSignal({ ...full, gapProfile: { ...full.gapProfile, tier: 'severe' } })).toBe(true);
    expect(
      hasAnySevereSignal({ ...full, impossibleSamples: { ...full.impossibleSamples, tier: 'severe' } })
    ).toBe(true);

    // ...while deleting 'elevation' entirely must NOT throw and must NOT
    // change the (false) result — proving the function never dereferences
    // `signals.elevation` at all. A future accidental
    // `signals.elevation.tier === 'severe'` read inside this function
    // would throw here rather than pass silently.
    const withoutElevation: Record<string, unknown> = { ...full };
    delete withoutElevation.elevation;
    const asTiering = withoutElevation as Pick<
      ActivityQualitySignals,
      'decimation' | 'gapProfile' | 'impossibleSamples'
    >;
    expect(() => hasAnySevereSignal(asTiering)).not.toThrow();
    expect(hasAnySevereSignal(asTiering)).toBe(false);
  });

  describe('mode independence (Criterion 2, D-14)', () => {
    const inRadiusStart = [46.5, 7.3];
    const inRadiusEnd = [46.5, 7.3]; // distance 0, inside LOOP_RADIUS_M

    function metadataWithPosition(): Pick<ActivityQualityMetadata, 'startLatlng' | 'endLatlng'> {
      return { startLatlng: inRadiusStart, endLatlng: inRadiusEnd };
    }

    it('mode independence: each synthetic fixture fires exactly its own mode, the other two report clear/unflagged', () => {
      const subGroundOnly = elevationSignal(syntheticSubGroundStream(), metadataWithPosition());
      expect(subGroundOnly.subGround.flagged).toBe(true);
      expect(subGroundOnly.closureDrift.state).not.toBe('flagged');
      expect(subGroundOnly.verticalRate.flagged).toBe(false);
      expect(subGroundOnly.tier).toBe('severe');

      const driftOnly = elevationSignal(syntheticClosureDriftStream(), metadataWithPosition());
      expect(driftOnly.closureDrift.state).toBe('flagged');
      expect(driftOnly.subGround.flagged).toBe(false);
      expect(driftOnly.verticalRate.flagged).toBe(false);
      expect(driftOnly.tier).toBe('severe');

      const rateOnly = elevationSignal(syntheticVerticalRateSpikeStream(), metadataWithPosition());
      expect(rateOnly.verticalRate.flagged).toBe(true);
      expect(rateOnly.subGround.flagged).toBe(false);
      expect(rateOnly.closureDrift.state).not.toBe('flagged');
      expect(rateOnly.tier).toBe('severe');
    });

    it('mode independence (converse): replacing a fixture with the clean baseline stops that mode alone, the other two unchanged', () => {
      const subGroundStream = syntheticSubGroundStream();
      const cleanStream = makeStream({
        id: 'clean-baseline',
        t: subGroundStream.t,
        d: subGroundStream.d,
        alt: new Array(subGroundStream.t.length).fill(10),
      });
      const clean = elevationSignal(cleanStream, metadataWithPosition());
      expect(clean.tier).toBe('none');
      expect(clean.subGround.flagged).toBe(false);
      expect(clean.closureDrift.state).not.toBe('flagged');
      expect(clean.verticalRate.flagged).toBe(false);

      // Sub-ground-only fixture vs the clean baseline: only subGround differs.
      const subGroundOnly = elevationSignal(subGroundStream, metadataWithPosition());
      expect(subGroundOnly.subGround.flagged).toBe(true);
      expect(subGroundOnly.closureDrift.state).toBe(clean.closureDrift.state);
      expect(subGroundOnly.verticalRate.flagged).toBe(clean.verticalRate.flagged);

      // Drift-only fixture vs clean: only closureDrift differs.
      const driftOnly = elevationSignal(syntheticClosureDriftStream(), metadataWithPosition());
      expect(driftOnly.closureDrift.state).toBe('flagged');
      expect(driftOnly.subGround.flagged).toBe(clean.subGround.flagged);
      expect(driftOnly.verticalRate.flagged).toBe(clean.verticalRate.flagged);

      // Rate-only fixture vs clean: only verticalRate differs.
      const rateOnly = elevationSignal(syntheticVerticalRateSpikeStream(), metadataWithPosition());
      expect(rateOnly.verticalRate.flagged).toBe(true);
      expect(rateOnly.subGround.flagged).toBe(clean.subGround.flagged);
      expect(rateOnly.closureDrift.state).toBe(clean.closureDrift.state);
    });
  });

  it('notComputableSignals sets elevation.tier to not-computable with no field reading a coerced 0 (T-26-02)', () => {
    const deviceEra: DeviceEraSignal = { family: 'no-device-name', rawDeviceName: null };
    const elapsedVsMoving = { ratio: null, elapsedSec: null, movingSec: null };

    const result = notComputableSignals(deviceEra, elapsedVsMoving, NOT_COMPUTABLE_NO_STREAM);

    expect(result.elevation.tier).toBe('not-computable');
    expect(result.elevation.subGround).toEqual({ flagged: false, minAltM: null });
    expect(result.elevation.closureDrift).toEqual({ state: 'not-computable', deltaM: null, startEndDistM: null });
    expect(result.elevation.verticalRate).toEqual({ flagged: false, worstRateMps: null, violatingSamples: null });
  });
});

// ---------------------------------------------------------------------------
// UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION shipped from 33-CALIBRATION.md
// (D-16, plan 33-14) — named so `-t "shipped from 33-CALIBRATION"` selects it
// ---------------------------------------------------------------------------

describe('UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION shipped from 33-CALIBRATION', () => {
  const ARTIFACT_PATH = path.join(
    '.planning',
    'phases',
    '33-coverage-integration-pace-clipping-segment-signal',
    '33-CALIBRATION.md'
  );
  const SOURCE_PATH = path.join('src', 'analytics', 'pace-quality.ts');
  const CONSTANT_LINE_PATTERN = /^\*\*UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = ([0-9.]+)\*\*$/gm;
  const SOURCE_LITERAL_PATTERN =
    /export const UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = ([0-9.]+);/;

  it('finds exactly one Chosen-constant line in the committed artifact and matches the production export, numerically AND character-for-character', () => {
    if (!fs.existsSync(ARTIFACT_PATH)) {
      throw new Error(
        `Missing ${ARTIFACT_PATH} — likely a milestone-archival \`git mv\` moved this phase's ` +
          'directory; update this test\'s ARTIFACT_PATH to the archived location. Never skip this test.'
      );
    }
    const artifactContent = fs.readFileSync(ARTIFACT_PATH, 'utf8');
    const matches = [...artifactContent.matchAll(CONSTANT_LINE_PATTERN)];
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one line-anchored "**UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = ...**" ` +
          `in ${ARTIFACT_PATH}, found ${matches.length}. A milestone-archival `+
          '\`git mv\` moving this phase\'s directory is the likely cause of zero matches; a re-run of ' +
          'the generator landing on its own NO SHAPE CLEARS halt branch (never shipping a line) is ' +
          'the likely cause too — never skip, never silently pass.'
      );
    }
    const artifactLiteral = matches[0][1];

    if (!fs.existsSync(SOURCE_PATH)) {
      throw new Error(`Missing ${SOURCE_PATH} — cannot read the production source literal.`);
    }
    const sourceContent = fs.readFileSync(SOURCE_PATH, 'utf8');
    const sourceMatch = SOURCE_LITERAL_PATTERN.exec(sourceContent);
    if (!sourceMatch) {
      throw new Error(
        `Could not find "export const UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = <literal>;" in ` +
          `${SOURCE_PATH} — the export may have been renamed or removed.`
      );
    }
    const sourceLiteral = sourceMatch[1];

    // Numeric equality against the runtime export (parses correctly, not just textually).
    expect(Number(artifactLiteral)).toBe(UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION);
    // Character-for-character against the SOURCE TEXT literal (never the runtime `String(value)`,
    // which would silently normalise away a trailing-zero mismatch a plain numeric check cannot
    // catch — plan 33-09's own acceptance wording).
    expect(sourceLiteral).toBe(artifactLiteral);
  });
});
