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
  NOT_COMPUTABLE_NO_STREAM,
  elapsedVsMovingSignal,
  notComputableSignals,
  resolveDeviceFamily,
  type ActivityQualityMetadata,
  type DeviceEraSignal,
} from './pace-quality.js';
import { PINNED_FIXTURES, loadPinnedActivity, loadPinnedStream } from './pace-fixtures.js';

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
