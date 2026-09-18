/**
 * Guard test for the pure helpers exported by
 * compute-elevation-calibration.mjs (Phase 30 plan 04, ELEV-02).
 * Importing this module must not run the archive sweep or write
 * `30-CALIBRATION.md` — if it does, the self-execution guard documented at
 * the bottom of compute-elevation-calibration.mjs is wrong and must be
 * fixed rather than worked around here (mirrors
 * scripts/compute-pace-quality-calibration.test.mjs's own contract).
 *
 * The module is loaded via a dynamic `import()` inside `beforeAll` (not a
 * static top-level import) specifically so this file can capture
 * `30-CALIBRATION.md`'s mtime BEFORE the import happens and compare it
 * against the mtime AFTER — a static import is hoisted and would already
 * have run by the time any test-file code could read the "before" mtime.
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { existsSync, statSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '../.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md');
const CALIBRATION_SCRIPT_PATH = join(__dirname, 'compute-elevation-calibration.mjs');
const PACE_QUALITY_SOURCE_PATH = join(__dirname, '../src/analytics/pace-quality.ts');

let mod;
let mtimeBeforeImport;

beforeAll(async () => {
  mtimeBeforeImport = existsSync(OUTPUT_PATH) ? statSync(OUTPUT_PATH).mtimeMs : null;
  mod = await import('./compute-elevation-calibration.mjs');
});

describe('importing the module does not run the sweep or write the report', () => {
  it('leaves 30-CALIBRATION.md byte-for-byte untouched (mtime unchanged across the import), or confirms it still does not exist (Task 1 runs before Task 2 first generates it)', () => {
    const existsAfterImport = existsSync(OUTPUT_PATH);
    if (mtimeBeforeImport === null) {
      expect(existsAfterImport).toBe(false);
      return;
    }
    expect(existsAfterImport).toBe(true);
    const mtimeAfterImport = statSync(OUTPUT_PATH).mtimeMs;
    expect(mtimeAfterImport).toBe(mtimeBeforeImport);
  });
});

describe('D-16: no fs write target under data/ in the calibration script or the analytics module', () => {
  const WRITE_CALL_PATTERN = /\b(writeFileSync|writeFile|appendFile|appendFileSync|mkdir|mkdirSync)\s*\(\s*[^)]*/g;

  function assertNoWriteUnderData(sourceText, label) {
    const matches = [...sourceText.matchAll(WRITE_CALL_PATTERN)];
    const offendingCalls = matches.filter((m) => m[0].includes('data/'));
    expect(offendingCalls, `${label} must have no fs write call whose path resolves under data/`).toEqual([]);
  }

  it('compute-elevation-calibration.mjs has no fs write call under data/', () => {
    const source = readFileSync(CALIBRATION_SCRIPT_PATH, 'utf8');
    assertNoWriteUnderData(source, 'compute-elevation-calibration.mjs');
    // The only write call in this file must target 30-CALIBRATION.md.
    expect(source).toMatch(/writeFileSync\(OUTPUT_PATH/);
  });

  it('src/analytics/pace-quality.ts has no fs write call under data/ (it has no fs import at all — client-safe contract)', () => {
    const source = readFileSync(PACE_QUALITY_SOURCE_PATH, 'utf8');
    assertNoWriteUnderData(source, 'src/analytics/pace-quality.ts');
    expect(source).not.toMatch(/from\s+['"](node:)?fs['"]/);
  });
});

describe('idFromFilename', () => {
  it('strips the trailing .json extension, including intervals.icu "i"-prefixed ids', () => {
    expect(mod.idFromFilename('12345.json')).toBe('12345');
    expect(mod.idFromFilename('i182749188.json')).toBe('i182749188');
  });

  it('returns the input unchanged when it has no .json suffix', () => {
    expect(mod.idFromFilename('12345')).toBe('12345');
  });
});

describe('isStreamFile — the manifest.json exclusion (Phase 27 gap G-01)', () => {
  it('excludes manifest.json even though it ends with .json', () => {
    expect(mod.isStreamFile('manifest.json')).toBe(false);
  });

  it('includes ordinary numeric and intervals.icu "i"-prefixed stream filenames', () => {
    expect(mod.isStreamFile('12345.json')).toBe(true);
    expect(mod.isStreamFile('i182749188.json')).toBe(true);
  });

  it('excludes non-.json entries', () => {
    expect(mod.isStreamFile('manifest.txt')).toBe(false);
    expect(mod.isStreamFile('README')).toBe(false);
  });
});

describe('hasAltChannel', () => {
  it('is true only for a stream with a non-empty alt array', () => {
    expect(mod.hasAltChannel({ alt: [1, 2, 3] })).toBe(true);
    expect(mod.hasAltChannel({ alt: [] })).toBe(false);
    expect(mod.hasAltChannel({})).toBe(false);
    expect(mod.hasAltChannel(null)).toBe(false);
    expect(mod.hasAltChannel(undefined)).toBe(false);
  });
});

describe('formatPct', () => {
  it('formats count/denominator with the denominator always inline', () => {
    expect(mod.formatPct(21, 1865)).toBe('21 of 1865 (1.1%)');
  });

  it('does not divide by zero', () => {
    expect(mod.formatPct(5, 0)).toBe('5 of 0 (N/A)');
  });
});

describe('rawClosureDelta — the un-loop-gated diagnostic', () => {
  it('flags when the absolute signed delta exceeds the imported threshold', () => {
    const result = mod.rawClosureDelta([100, 105, 10]); // delta = -90
    expect(result.deltaM).toBe(-90);
    expect(result.flagged).toBe(true);
  });

  it('does not flag a small delta', () => {
    const result = mod.rawClosureDelta([100, 105, 102]); // delta = 2
    expect(result.flagged).toBe(false);
  });

  it('is total: absent/short/non-finite alt returns a null, unflagged result', () => {
    expect(mod.rawClosureDelta(undefined)).toEqual({ deltaM: null, flagged: false });
    expect(mod.rawClosureDelta([5])).toEqual({ deltaM: null, flagged: false });
    expect(mod.rawClosureDelta([NaN, 10])).toEqual({ deltaM: null, flagged: false });
  });
});

describe('computeOverlapMatrix + checkInclusionExclusion', () => {
  it('classifies pairwise and all-three membership correctly and reconciles by inclusion-exclusion', () => {
    const a = new Set(['1', '2', '5']); // sub-ground
    const b = new Set(['2', '3', '5']); // closure drift
    const c = new Set(['5']); // vertical rate
    // 1: a-only; 2: a&b; 3: b-only; 5: all three -> union = {1,2,3,5} = 4

    const matrix = mod.computeOverlapMatrix(a, b, c);

    expect(matrix.aCount).toBe(3);
    expect(matrix.bCount).toBe(3);
    expect(matrix.cCount).toBe(1);
    expect(matrix.ab).toBe(2); // {2,5}
    expect(matrix.ac).toBe(1); // {5}
    expect(matrix.bc).toBe(1); // {5}
    expect(matrix.allThree).toBe(1); // {5}
    expect(matrix.unionSize).toBe(4);

    const check = mod.checkInclusionExclusion(matrix);
    // 3 + 3 + 1 - 2 - 1 - 1 + 1 = 4
    expect(check.computed).toBe(4);
    expect(check.unionSize).toBe(4);
    expect(check.pass).toBe(true);
  });

  it('checkInclusionExclusion fires (pass: false) on a deliberately inconsistent hand-built matrix', () => {
    const brokenMatrix = { aCount: 5, bCount: 5, cCount: 5, ab: 0, ac: 0, bc: 0, allThree: 0, unionSize: 1 };
    const check = mod.checkInclusionExclusion(brokenMatrix);
    expect(check.pass).toBe(false);
    expect(check.computed).toBe(15);
  });

  it('returns all zeros for three disjoint sets', () => {
    const matrix = mod.computeOverlapMatrix(new Set(['a']), new Set(['b']), new Set(['c']));
    expect(matrix.ab).toBe(0);
    expect(matrix.ac).toBe(0);
    expect(matrix.bc).toBe(0);
    expect(matrix.allThree).toBe(0);
    expect(matrix.unionSize).toBe(3);
    expect(mod.checkInclusionExclusion(matrix).pass).toBe(true);
  });
});

describe('deviceFamilyBreakdown — the (no device name) explicit category', () => {
  it('buckets raw device_name, falling back to (no device name) for missing/blank values', () => {
    const activityById = new Map([
      ['1', { device_name: 'Suunto 9' }],
      ['2', { device_name: 'Suunto 9' }],
      ['3', { device_name: '' }],
      ['4', {}],
      ['5', null],
    ]);

    const result = mod.deviceFamilyBreakdown(['1', '2', '3', '4', '5'], activityById);

    // Sorted by count descending: (no device name) has 3, Suunto 9 has 2.
    expect(result).toEqual([
      ['(no device name)', 3],
      ['Suunto 9', 2],
    ]);
  });
});

describe('distanceDistribution — D-03 evidence', () => {
  it('buckets exactly-zero, strictly-below-radius, and at-or-above-radius counts, and finds the minimum non-zero value', () => {
    const distances = [0, 0, 0, 600, 700, 552.44];
    const result = mod.distanceDistribution(distances, 100);

    expect(result.total).toBe(6);
    expect(result.atZero).toBe(3);
    expect(result.belowRadius).toBe(0);
    expect(result.atOrAboveRadius).toBe(3);
    expect(result.minNonZeroDistance).toBe(552.44);
  });

  it('reports belowRadius > 0 when a value genuinely falls inside the gap (the ambiguous case)', () => {
    const result = mod.distanceDistribution([0, 50], 100);
    expect(result.belowRadius).toBe(1);
    expect(result.atOrAboveRadius).toBe(0);
  });

  it('handles an empty distance list without throwing', () => {
    const result = mod.distanceDistribution([], 100);
    expect(result.total).toBe(0);
    expect(result.minNonZeroDistance).toBeNull();
  });
});

describe('precedingIdenticalRunLength', () => {
  it('counts a flat run ending at index i, inclusive, going backward', () => {
    const alt = [191.8, 191.8, 191.8, 30.8];
    expect(mod.precedingIdenticalRunLength(alt, 2)).toBe(3);
  });

  it('returns 1 when the value at i does not repeat', () => {
    const alt = [10, 20, 30];
    expect(mod.precedingIdenticalRunLength(alt, 1)).toBe(1);
  });

  it('returns 1 at index 0 (nothing precedes it)', () => {
    expect(mod.precedingIdenticalRunLength([5, 5, 5], 0)).toBe(1);
  });
});

describe('scanVerticalRatePairs', () => {
  it('reproduces the pinned worst-case trace shape (3149636661): a flat run then a single-tick jump', () => {
    const t = [69, 70, 71, 75, 76, 78, 80, 82];
    const alt = [191.8, 191.8, 191.8, 191.8, 191.8, 191.6, 191.6, 30.8];

    const pairs = mod.scanVerticalRatePairs(t, alt);

    expect(pairs.length).toBe(1);
    expect(pairs[0].index).toBe(6); // the pair (alt[6]=191.6, alt[7]=30.8)
    expect(pairs[0].rateMps).toBeCloseTo(80.4, 1);
    expect(pairs[0].precedingIdenticalRun).toBeGreaterThanOrEqual(2);
  });

  it('is total: mismatched-length or non-array input returns no pairs rather than throwing', () => {
    expect(mod.scanVerticalRatePairs(undefined, [1, 2])).toEqual([]);
    expect(mod.scanVerticalRatePairs([1, 2], undefined)).toEqual([]);
  });

  it('skips a pair with non-positive dt rather than dividing by zero', () => {
    const pairs = mod.scanVerticalRatePairs([10, 10], [0, 1000]);
    expect(pairs).toEqual([]);
  });
});

describe('computeStreamsDigest + checkDigestGate (D-16)', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'elev-calibration-digest-'));
    writeFileSync(join(tempDir, '1.json'), '{"alt":[1,2,3]}');
    writeFileSync(join(tempDir, '2.json'), '{"alt":[4,5,6]}');
    writeFileSync(join(tempDir, 'manifest.json'), '{"ignored":true}');
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the same digest for the same directory contents across two calls', () => {
    const first = mod.computeStreamsDigest(tempDir);
    const second = mod.computeStreamsDigest(tempDir);
    expect(first.digest).not.toBeNull();
    expect(first.digest).toBe(second.digest);
    expect(first.fileCount).toBe(2); // manifest.json excluded
  });

  it('excludes manifest.json from the digest — mutating it alone does not change the digest', () => {
    const before = mod.computeStreamsDigest(tempDir);
    writeFileSync(join(tempDir, 'manifest.json'), '{"ignored":false,"changed":true}');
    const after = mod.computeStreamsDigest(tempDir);
    expect(after.digest).toBe(before.digest);
  });

  it('DEMONSTRATED FAILING: mutating one byte of one real stream file changes the digest, and the gate reports FAIL with a named message', () => {
    const before = mod.computeStreamsDigest(tempDir);

    // Mutate one byte of a real (non-manifest) stream file.
    writeFileSync(join(tempDir, '1.json'), '{"alt":[1,2,9]}');
    const after = mod.computeStreamsDigest(tempDir);

    expect(after.digest).not.toBe(before.digest);

    const gate = mod.checkDigestGate(before, after);
    expect(gate.pass).toBe(false);
    expect(gate.message).toMatch(/FATAL/);
    expect(gate.message).toMatch(/data\/streams\//);

    // Restore, confirm the gate reports PASS again.
    writeFileSync(join(tempDir, '1.json'), '{"alt":[1,2,3]}');
    const restored = mod.computeStreamsDigest(tempDir);
    const restoredGate = mod.checkDigestGate(before, restored);
    expect(restoredGate.pass).toBe(true);
    expect(restoredGate.message).toMatch(/match/);
  });

  it('checkDigestGate fails closed when a digest could not be computed at all', () => {
    const gate = mod.checkDigestGate(
      { digest: null, fileCount: 0, error: 'ENOENT' },
      { digest: 'abc', fileCount: 1, error: null }
    );
    expect(gate.pass).toBe(false);
    expect(gate.message).toMatch(/FATAL/);
  });
});

describe('renderCalibrationMarkdown — the report renderer', () => {
  it('renders all twelve named sections plus Regeneration for a hand-built report object', () => {
    const unionIds = new Set(['a', 'b', 'c']);
    const report = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      activityCount: 100,
      activityParseFailures: 0,
      streamFileCount: 98,
      streamParseFailures: 0,
      altCarryingCount: 95,
      positionedActivityCount: 90,
      distanceDistribution: { total: 90, atZero: 60, belowRadius: 0, atOrAboveRadius: 30, minNonZeroDistance: 600 },
      loopRadiusM: 100,
      thresholds: { subGroundMinAltM: -50, closureDriftSevereDeltaM: 60, verticalRateSevereMps: 5 },
      subGround: { count: 2, worst: [{ id: 'a', minAltM: -100 }] },
      closureDrift: { count: 1, computablePopulation: 80, worst: [{ id: 'b', deltaM: -70, startEndDistM: 0 }] },
      verticalRate: { count: 1, worst: [{ id: 'c', worstRateMps: 12.3 }] },
      overlapLoopGated: { aCount: 2, bCount: 1, cCount: 1, ab: 1, ac: 1, bc: 1, allThree: 1, unionSize: 3, unionIds },
      overlapRaw: { aCount: 2, bCount: 2, cCount: 1, ab: 1, ac: 1, bc: 1, allThree: 1, unionSize: 3, unionIds },
      inclusionExclusion: { pass: true, computed: 3, unionSize: 3 },
      unionDeviceFamily: [['Suunto 9', 2], ['(no device name)', 1]],
      driftNotComputable: { count: 5 },
      loopGateExclusions: { pointToPoint: [{ id: 'p2p-1', startEndDistM: 1000 }], noPosition: ['np-1'] },
      rawDrift: { count: 3, loopGatedCount: 1, pointToPointCount: 1, noPositionCount: 1 },
      modeIndependence: { driftOnlyCount: 1 },
      carryForward: {
        totalViolatingPairs: 4,
        correlatedPairs: 1,
        worstTrace: { id: 'c', rateMps: 12.3, window: [{ t: 1, alt: 10, marker: '' }, { t: 2, alt: 20, marker: '<- the violating jump (12.3 m/s)' }] },
      },
      streamIntegrity: { beforeDigest: 'abc123', afterDigest: 'abc123', beforeFileCount: 98, afterFileCount: 98 },
    };

    const markdown = mod.renderCalibrationMarkdown(report);

    for (const heading of [
      '## Live denominators',
      '## Thresholds in force',
      '## Loop radius',
      '## Per-mode cohorts',
      '## Overlap matrix (loop-gated)',
      '## Union by device family',
      '## Drift not-computable',
      '## Loop-gate exclusions',
      '## Correction of the raw-difference count (D-04)',
      '## Mode independence (Criterion 2)',
      '## Carry-forward fill and vertical rate (D-08)',
      '## Stream integrity (D-16)',
      '## Regeneration',
    ]) {
      expect(markdown).toContain(heading);
    }

    expect(markdown).toContain('manufactures');
    expect(markdown).toContain('never masks');
    expect(markdown).toContain('equivalent');
    expect(markdown).toContain('excluded by design');
  });
});
