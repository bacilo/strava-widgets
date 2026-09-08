/**
 * Coverage guard for the ERA-03 fixture library (`pace-fixtures.ts`, D-20).
 *
 * Four groups, per this plan's Task 2:
 *   1. Presence by name — Roadmap Criterion 6's requirement that every
 *      fixture is verified present BY NAME, not by count.
 *   2. Stratification guards — the pinned set spans the required device/
 *      source diversity, and `no-device-name` carries its own explicit
 *      category string.
 *   3. Pinned archive files resolve and still match their recorded
 *      `expected` properties — a mismatch here is a finding, not something
 *      to silently absorb (per `pace-fixtures.ts`'s own provenance header).
 *   4. Import boundary — this module's `node:fs` use must never reach
 *      `src/dashboard/` or `src/widgets/`, checked in BOTH directions so
 *      the guard cannot pass vacuously.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PACE_FIXTURE_NAMES,
  PINNED_FIXTURES,
  loadPinnedActivity,
  loadPinnedStream,
  syntheticDecimationAliasedStream,
  syntheticImpossibleSpeedStream,
  syntheticIntervalSessionStream,
  syntheticMultiCategoryCoverageStream,
  syntheticMultiHourPauseStream,
  syntheticRecordingGapStream,
  syntheticStandstillStream,
  type PinnedFixture,
} from './pace-fixtures.js';
import type { CanonicalStream } from '../streams/stream.types.js';

// ---------------------------------------------------------------------------
// Group 1: presence by name (Roadmap Criterion 6)
// ---------------------------------------------------------------------------

/** Maps each synthetic-only fixture name to the constructor that produces it. */
const SYNTHETIC_CONSTRUCTORS: Record<string, () => CanonicalStream> = {
  'multi-hour-pause': syntheticMultiHourPauseStream,
  'interval-session': syntheticIntervalSessionStream,
  standstill: syntheticStandstillStream,
  'multi-category-coverage': syntheticMultiCategoryCoverageStream,
};

describe('PACE_FIXTURE_NAMES — every required fixture is resolvable by name', () => {
  it.each(PACE_FIXTURE_NAMES)('fixture "%s" is resolvable', (name) => {
    const pinned = PINNED_FIXTURES.find((f) => f.name === name);
    const synthetic = SYNTHETIC_CONSTRUCTORS[name];
    expect(
      pinned !== undefined || synthetic !== undefined,
      `expected "${name}" to be present in PINNED_FIXTURES or SYNTHETIC_CONSTRUCTORS`
    ).toBe(true);
    if (synthetic) {
      // Prove the constructor actually produces a stream, not just that a
      // function reference exists.
      const stream = synthetic();
      expect(stream.t.length).toBeGreaterThan(0);
      expect(stream.t.length).toBe(stream.d.length);
    }
  });

  it('PACE_FIXTURE_NAMES contains every category ERA-03 and Criterion 6 name explicitly', () => {
    const required = [
      'fenix-6-pro-fit',
      'suunto-9-fit',
      'gpx-source',
      'intervals-icu-only',
      'no-device-name',
      'decimation-aliased',
      'recording-gap',
      'multi-hour-pause',
      'impossible-speed-sample',
      'worked-example',
    ];
    for (const name of required) {
      expect(PACE_FIXTURE_NAMES, `expected PACE_FIXTURE_NAMES to contain "${name}"`).toContain(name);
    }
  });

  it('PACE_FIXTURE_NAMES has no duplicate entries', () => {
    expect(new Set(PACE_FIXTURE_NAMES).size).toBe(PACE_FIXTURE_NAMES.length);
  });
});

// ---------------------------------------------------------------------------
// Group 2: stratification guards
// ---------------------------------------------------------------------------

describe('PINNED_FIXTURES — stratification guards', () => {
  it('spans at least three distinct streamSource values', () => {
    const sources = new Set(PINNED_FIXTURES.map((f) => f.streamSource));
    expect(sources.size).toBeGreaterThanOrEqual(3);
  });

  it('spans at least four distinct deviceFamily values', () => {
    const families = new Set(PINNED_FIXTURES.map((f) => f.deviceFamily));
    expect(families.size).toBeGreaterThanOrEqual(4);
  });

  it('"no-device-name"\'s deviceFamily is its own explicit category string, never fabricated and never a fallthrough', () => {
    const fixture = PINNED_FIXTURES.find((f) => f.name === 'no-device-name');
    expect(fixture).toBeDefined();
    expect(fixture!.deviceFamily).toBe('no-device-name');
    // Not a fabricated real-looking device name.
    expect(fixture!.deviceFamily.toLowerCase()).not.toMatch(/garmin|suunto|fenix|forerunner|coros|polar/);
    // Not shared with any other fixture's deviceFamily (i.e. not a generic default).
    const others = PINNED_FIXTURES.filter((f) => f.name !== 'no-device-name');
    expect(others.some((f) => f.deviceFamily === fixture!.deviceFamily)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 3: pinned archive files resolve and still match
// ---------------------------------------------------------------------------

interface StreamStats {
  sampleCount: number;
  spanSec: number;
  distanceM: number;
  maxDtSec: number;
  maxGapSec: number;
  zeroAdvanceFraction: number;
}

function computeStreamStats(stream: CanonicalStream): StreamStats {
  const { t, d } = stream;
  const n = t.length;
  let maxDt = 0;
  let zeroAdvance = 0;
  for (let i = 1; i < n; i++) {
    const dt = t[i] - t[i - 1];
    if (dt > maxDt) maxDt = dt;
    if (d[i] - d[i - 1] === 0) zeroAdvance++;
  }
  return {
    sampleCount: stream.sampleCount,
    spanSec: t[n - 1] - t[0],
    distanceM: Math.round((d[n - 1] - d[0]) * 10) / 10,
    maxDtSec: maxDt,
    maxGapSec: maxDt,
    zeroAdvanceFraction: n > 1 ? zeroAdvance / (n - 1) : 0,
  };
}

/** Longest run of consecutive zero-distance-advance samples with internal dt <=30s (26-RESEARCH.md's density filter). */
function longestZeroAdvanceRunSec(stream: CanonicalStream): number {
  const { t, d } = stream;
  let longest = 0;
  let curStart: number | null = null;
  for (let i = 1; i < t.length; i++) {
    const dt = t[i] - t[i - 1];
    const dd = d[i] - d[i - 1];
    if (dd === 0 && dt <= 30) {
      if (curStart === null) curStart = t[i - 1];
      longest = Math.max(longest, t[i] - curStart);
    } else {
      curStart = null;
    }
  }
  return longest;
}

/**
 * Checks each key of `fixture.expected` against the live-loaded stream (and,
 * for `elapsedTimeSec`, the live-loaded activity). Reports both the
 * planning-time and execution-time value in the failure message so a
 * mismatch is recorded as a finding rather than silently swallowed.
 */
function assertExpectedProperties(fixture: PinnedFixture, stream: CanonicalStream): void {
  const stats = computeStreamStats(stream);
  for (const [key, expectedValue] of Object.entries(fixture.expected)) {
    const label = `fixture "${fixture.name}" (activity ${fixture.activityId}) property "${key}": planning-time ${expectedValue}`;
    switch (key) {
      case 'sampleCount':
        expect(stats.sampleCount, `${label}, execution-time ${stats.sampleCount}`).toBe(expectedValue);
        break;
      case 'spanSec':
        expect(stats.spanSec, `${label}, execution-time ${stats.spanSec}`).toBe(expectedValue);
        break;
      case 'distanceM':
        expect(stats.distanceM, `${label}, execution-time ${stats.distanceM}`).toBeCloseTo(expectedValue as number, 0);
        break;
      case 'maxDtSec':
        expect(stats.maxDtSec, `${label}, execution-time ${stats.maxDtSec}`).toBe(expectedValue);
        break;
      case 'maxGapSec':
        expect(stats.maxGapSec, `${label}, execution-time ${stats.maxGapSec}`).toBe(expectedValue);
        break;
      case 'zeroAdvanceFraction':
        expect(stats.zeroAdvanceFraction, `${label}, execution-time ${stats.zeroAdvanceFraction}`).toBeCloseTo(
          expectedValue as number,
          2
        );
        break;
      case 'longestPauseSec': {
        const actual = longestZeroAdvanceRunSec(stream);
        expect(actual, `${label}, execution-time ${actual}`).toBe(expectedValue);
        break;
      }
      case 'offendingIndex': {
        // Cross-checked together with offendingSpeedMps below.
        break;
      }
      case 'offendingSpeedMps': {
        const idx = fixture.expected.offendingIndex as number;
        const dt = stream.t[idx] - stream.t[idx - 1];
        const dd = stream.d[idx] - stream.d[idx - 1];
        const actualSpeed = dd / dt;
        expect(
          actualSpeed,
          `fixture "${fixture.name}" offending speed at index ${idx}: planning-time ${expectedValue}, execution-time ${actualSpeed}`
        ).toBeCloseTo(expectedValue as number, 1);
        break;
      }
      case 'elapsedTimeSec': {
        const activity = loadPinnedActivity(fixture.name) as { elapsed_time?: number };
        expect(
          activity.elapsed_time,
          `${label}, execution-time ${activity.elapsed_time}`
        ).toBe(expectedValue);
        break;
      }
      default:
        throw new Error(`assertExpectedProperties: unhandled expected key "${key}" on fixture "${fixture.name}"`);
    }
  }
}

describe('PINNED_FIXTURES — archive files resolve and match their recorded expectations', () => {
  it.each(PINNED_FIXTURES)('loadPinnedStream("$name") parses and matches expected properties', (fixture) => {
    const stream = loadPinnedStream(fixture.name);
    expect(stream.t.length, `fixture "${fixture.name}": t/d length mismatch`).toBe(stream.d.length);
    expect(stream.source, `fixture "${fixture.name}": streamSource mismatch`).toBe(fixture.streamSource);
    assertExpectedProperties(fixture, stream);
  });

  it('loadPinnedStream throws a named, actionable error for an unknown fixture name', () => {
    expect(() => loadPinnedStream('does-not-exist')).toThrow(/Unknown pinned fixture/);
  });
});

// ---------------------------------------------------------------------------
// Group 4: import boundary
// ---------------------------------------------------------------------------

function listTsFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFilesRecursive(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(entryPath);
    }
  }
  return out;
}

/** The scanner under test: does `source` import the pace-fixtures module? */
function importsPaceFixtures(source: string): boolean {
  return /from\s+['"][^'"]*pace-fixtures(\.js)?['"]/.test(source) || /require\(['"][^'"]*pace-fixtures(\.js)?['"]\)/.test(source);
}

describe('Import boundary — pace-fixtures.ts never reaches the browser bundle', () => {
  it('no file under src/dashboard/ or src/widgets/ imports pace-fixtures (negative direction)', () => {
    const files = [...listTsFilesRecursive('src/dashboard'), ...listTsFilesRecursive('src/widgets')];
    expect(files.length, 'expected to find at least one .ts file under src/dashboard or src/widgets').toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf-8');
      if (importsPaceFixtures(source)) offenders.push(file);
    }
    expect(offenders, `these files import pace-fixtures and must not: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the scanner DOES detect a planted import in synthetic in-memory source text (positive direction, proves the guard is not vacuous)', () => {
    const plantedEsm = `import { PACE_FIXTURE_NAMES } from '../../analytics/pace-fixtures.js';\nconsole.log(PACE_FIXTURE_NAMES);\n`;
    const plantedCjs = `const { PACE_FIXTURE_NAMES } = require('../../analytics/pace-fixtures');\n`;
    const clean = `import { renderActivityRow } from './row-semantics.js';\n`;

    expect(importsPaceFixtures(plantedEsm)).toBe(true);
    expect(importsPaceFixtures(plantedCjs)).toBe(true);
    expect(importsPaceFixtures(clean)).toBe(false);
  });
});
