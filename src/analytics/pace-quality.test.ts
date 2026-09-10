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

import { describe, expect, it } from 'vitest';

import {
  DECIMATION_SEVERE_MIN_SAMPLES,
  DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION,
  GAP_PROFILE_SEVERE_FRACTION,
  IMPOSSIBLE_SAMPLE_SEVERE_COUNT,
  NOT_COMPUTABLE_NO_STREAM,
  countImpossibleSamples,
  decimationSignal,
  elapsedVsMovingSignal,
  gapProfileSignal,
  impossibleSampleSignal,
  notComputableSignals,
  resolveDeviceFamily,
  type ActivityQualityMetadata,
  type DeviceEraSignal,
} from './pace-quality.js';
import {
  PINNED_FIXTURES,
  loadPinnedActivity,
  loadPinnedStream,
  makeStream,
  syntheticDecimationAliasedStream,
  syntheticImpossibleSpeedStream,
  syntheticMultiHourPauseStream,
  syntheticRecordingGapStream,
} from './pace-fixtures.js';

/** Builds the two-field metadata slice `resolveDeviceFamily` consumes from a raw activity record. */
function metadataOf(activity: unknown): Pick<ActivityQualityMetadata, 'deviceName' | 'sourceProvider'> {
  const record = activity as Record<string, unknown>;
  return { deviceName: record.device_name, sourceProvider: record.source_provider };
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
