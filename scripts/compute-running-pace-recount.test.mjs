/**
 * Tests for compute-running-pace-recount.mjs (Phase 35 plan 04, D-08). Every functional test case
 * drives its target on a hand-built fixture; only the zero-import guard and the local-duplicated-
 * constant cross-check read real files (the recount's own source, and `pace-derivation.ts` /
 * `unreliable-segments.ts`, both read-only — never written to, never checked out).
 *
 * The zero-import guard below is the one part of this file that reads the real SOURCE (not data)
 * of compute-running-pace-recount.mjs, mirroring compute-unreliable-segment-recount.test.mjs /
 * compute-pause-classification-recount.test.mjs's own guards exactly — string-scan after stripping
 * comments, never an unverified runtime spy on the `fs` module's namespace object (that shape
 * cannot observe a named `import { readFileSync } from 'fs'` and would pass vacuously — the
 * fs-spy lesson, restated verbatim across three prior phases' PATTERNS.md).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  checkStreamLocal,
  findOverspeedRanges,
  findPauseRanges,
  findRecordingGapRanges,
  isStreamFile,
  localAdvanceIntervalsSec,
  localQuantileR7,
  mergeExcludedRanges,
  NAMED_ACTIVITY_IDS,
  recountRunningPace,
  renderRecountMarkdown,
  sweepArchive,
} from './compute-running-pace-recount.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-running-pace-recount.mjs', import.meta.url));
const PACE_DERIVATION_SOURCE_PATH = fileURLToPath(
  new URL('../src/analytics/pace-derivation.ts', import.meta.url)
);
const UNRELIABLE_SEGMENTS_SOURCE_PATH = fileURLToPath(
  new URL('../src/analytics/unreliable-segments.ts', import.meta.url)
);
const STREAMS_DIR = fileURLToPath(new URL('../data/streams', import.meta.url));

const FORBIDDEN_MODULE_NAMES = [
  'pace-derivation',
  'unreliable-segments',
  'pace-quality',
  'best-effort',
  'dist/',
  'src/',
];

/**
 * Strips comments BEFORE searching for forbidden module names — load-bearing, since this script's
 * own header docblock legitimately NAMES the forbidden modules while explaining why each is
 * forbidden. Block comments first, then `//`-to-end-of-line, mirroring
 * compute-unreliable-segment-recount.test.mjs / compute-pause-classification-recount.test.mjs's own
 * stripComments helper exactly.
 */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

/** Scans comment-stripped source for any occurrence of a FORBIDDEN_MODULE_NAMES entry. */
function findForbiddenNames(strippedSource) {
  return FORBIDDEN_MODULE_NAMES.filter((name) => strippedSource.includes(name));
}

describe('zero-import guard (D-08)', () => {
  it('OBSERVATION 1: the scanner REPORTS a planted forbidden import on an in-memory mutated copy — watched RED before being trusted', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const mutated =
      raw + "\nimport { detectUnreliableSegments } from '../src/analytics/unreliable-segments.js';\n";
    const strippedMutated = stripComments(mutated);
    const reported = findForbiddenNames(strippedMutated);
    expect(reported.length).toBeGreaterThan(0);
    expect(reported).toContain('unreliable-segments');
  });

  it('OBSERVATION 2: the scanner reports NOTHING against the real, unplanted source — compute-running-pace-recount.mjs itself contains none of the forbidden module names once comments are stripped', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);

    // Sanity check first: the RAW source legitimately names every forbidden module (in its header
    // docblock, explaining why each is forbidden, and via the split-string trick in its rendered
    // artifact prose) — if this failed, the test below would be vacuous.
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden);
    }

    const reported = findForbiddenNames(stripped);
    expect(reported).toEqual([]);
  });

  it('OBSERVATION 3: a forbidden specifier planted INSIDE a `//` comment is NOT reported — proving comment-stripping is load-bearing, not decorative, and the guard cannot be defeated (or satisfied) by prose', () => {
    const fixture = [
      'const ok = 1;',
      '// imports dist/analytics/pace-derivation.js, forbidden',
      '/* also forbidden: unreliable-segments, pace-quality, best-effort, src/ */',
      'const alsoOk = 2;',
    ].join('\n');

    const stripped = stripComments(fixture);

    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(fixture).toContain(forbidden); // sanity: the raw fixture DOES name every forbidden module
      expect(stripped).not.toContain(forbidden); // the stripper removed it
    }
    expect(stripped).toContain('const ok = 1;');
    expect(stripped).toContain('const alsoOk = 2;');
  });

});

/**
 * Extracts a `NAME = <number>` declaration from raw source text. Used only to compare two LIVE
 * values read from their own respective source files — never to hardcode a number twice in this
 * test.
 */
function extractConstNumber(source, name) {
  const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*([0-9.]+)');
  const match = source.match(re);
  return match ? Number(match[1]) : null;
}

describe('local duplicated constants match their live source values, both parsed from source (D-08)', () => {
  const scriptSource = readFileSync(SCRIPT_PATH, 'utf8');
  const paceDerivationSource = readFileSync(PACE_DERIVATION_SOURCE_PATH, 'utf8');
  const unreliableSegmentsSource = readFileSync(UNRELIABLE_SEGMENTS_SOURCE_PATH, 'utf8');

  it('LOCAL_GAP_THRESHOLD_SEC equals the live RECORDING_GAP_ABS_THRESHOLD_SEC value', () => {
    const local = extractConstNumber(scriptSource, 'LOCAL_GAP_THRESHOLD_SEC');
    const live = extractConstNumber(paceDerivationSource, 'RECORDING_GAP_ABS_THRESHOLD_SEC');
    expect(local).not.toBeNull();
    expect(live).not.toBeNull();
    expect(local).toBe(live);
  });

  it('LOCAL_PAUSE_MULTIPLIER equals the live PAUSE_GAP_P90_MULTIPLIER value', () => {
    const local = extractConstNumber(scriptSource, 'LOCAL_PAUSE_MULTIPLIER');
    const live = extractConstNumber(paceDerivationSource, 'PAUSE_GAP_P90_MULTIPLIER');
    expect(local).not.toBeNull();
    expect(live).not.toBeNull();
    expect(local).toBe(live);
  });

  it('LOCAL_SPEED_LIMIT_MPS equals the live UNRELIABLE_SPEED_LIMIT_MPS value', () => {
    const local = extractConstNumber(scriptSource, 'LOCAL_SPEED_LIMIT_MPS');
    const live = extractConstNumber(unreliableSegmentsSource, 'UNRELIABLE_SPEED_LIMIT_MPS');
    expect(local).not.toBeNull();
    expect(live).not.toBeNull();
    expect(local).toBe(live);
  });
});

describe('isStreamFile', () => {
  it('accepts a numeric activity id file and rejects manifest.json', () => {
    expect(isStreamFile('3475724402.json')).toBe(true);
    expect(isStreamFile('manifest.json')).toBe(false);
    expect(isStreamFile('3475724402.txt')).toBe(false);
  });
});

describe('checkStreamLocal', () => {
  it('accepts a valid, non-decreasing, equal-length pair', () => {
    expect(checkStreamLocal([0, 5, 10], [0, 5, 10]).ok).toBe(true);
  });

  it('rejects non-array input without throwing', () => {
    expect(checkStreamLocal(null, null)).toEqual({ ok: false, reason: 't and d must both be arrays' });
    expect(checkStreamLocal(undefined, [1]).ok).toBe(false);
  });

  it('rejects mismatched lengths', () => {
    const result = checkStreamLocal([0, 1], [0, 1, 2]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('different lengths');
  });

  it('rejects fewer than 2 samples', () => {
    const result = checkStreamLocal([0], [0]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('at least 2 samples');
  });

  it('rejects a non-finite value', () => {
    const result = checkStreamLocal([0, NaN], [0, 1]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not a finite number');
  });

  it('rejects a decreasing t or d', () => {
    expect(checkStreamLocal([0, 5, 3], [0, 1, 2]).ok).toBe(false);
    expect(checkStreamLocal([0, 5, 10], [0, 5, 3]).ok).toBe(false);
  });
});

describe('localQuantileR7 — an independently-written R-7 interpolation', () => {
  it('returns NaN for an empty array', () => {
    expect(Number.isNaN(localQuantileR7([], 0.9))).toBe(true);
  });

  it('returns the single value for a 1-element array', () => {
    expect(localQuantileR7([42], 0.9)).toBe(42);
  });

  it('matches a hand-computed interpolation: [10,20,30,40] at q=0.5 -> 25', () => {
    // n=4, rank=(4-1)*0.5=1.5, lo=1 (20), hi=2 (30), frac=0.5 -> 20 + 0.5*(30-20) = 25
    expect(localQuantileR7([10, 20, 30, 40], 0.5)).toBe(25);
  });

  it('matches a hand-computed interpolation at q=0.9 on an odd-length array: [1,2,3,4,5] -> 4.6', () => {
    // n=5, rank=(5-1)*0.9=3.6, lo=3 (4), hi=4 (5), frac=0.6 -> 4 + 0.6*(5-4) = 4.6
    expect(localQuantileR7([1, 2, 3, 4, 5], 0.9)).toBeCloseTo(4.6, 10);
  });
});

describe('localAdvanceIntervalsSec', () => {
  it('measures the first advance from the stream\'s own start (t[0]), not from 0', () => {
    // t[0]=100 (not 0); one advance at i=2. Interval must be t[2]-t[0], not t[2]-0.
    const t = [100, 105, 110];
    const d = [0, 0, 5];
    expect(localAdvanceIntervalsSec(t, d)).toEqual([10]);
  });

  it('a stream that never advances returns an empty array', () => {
    expect(localAdvanceIntervalsSec([0, 5, 10], [0, 0, 0])).toEqual([]);
  });

  it('returns intervals sorted ascending even when advances are not evenly spaced', () => {
    const t = [0, 20, 25, 45];
    const d = [0, 5, 10, 15];
    // advance at i=1: 20-0=20; i=2: 25-20=5; i=3: 45-25=20
    expect(localAdvanceIntervalsSec(t, d)).toEqual([5, 20, 20]);
  });
});

describe('findRecordingGapRanges (a)', () => {
  it('finds a single-pair gap above LOCAL_GAP_THRESHOLD_SEC', () => {
    const t = [0, 5, 20, 25];
    const d = [0, 5, 5, 10];
    expect(findRecordingGapRanges(t, d)).toEqual([{ startIndex: 1, endIndex: 2 }]);
  });

  it('merges two consecutive gap pairs into one maximal range', () => {
    const t = [0, 25, 50, 55];
    const d = [0, 1, 2, 3];
    expect(findRecordingGapRanges(t, d)).toEqual([{ startIndex: 0, endIndex: 2 }]);
  });

  it('a pair at exactly the threshold is NOT a gap (strict >, not >=)', () => {
    const t = [0, 10, 20];
    const d = [0, 1, 2];
    expect(findRecordingGapRanges(t, d)).toEqual([]);
  });

  it('finds no ranges on a clean stream', () => {
    expect(findRecordingGapRanges([0, 5, 10], [0, 5, 10])).toEqual([]);
  });
});

describe('findPauseRanges (b) — takes an already-resolved p90AdvanceSec, never re-derives it', () => {
  it('flags a long zero-advance run whose duration exceeds LOCAL_PAUSE_MULTIPLIER * p90AdvanceSec', () => {
    const t = [0, 5, 10, 15, 20];
    const d = [0, 0, 0, 0, 0];
    // duration = 20, threshold = 5 * 1 = 5, 20 > 5 -> flagged
    expect(findPauseRanges(t, d, 1)).toEqual([{ startIndex: 0, endIndex: 4 }]);
  });

  it('does NOT flag a zero-advance run whose duration does not exceed the threshold', () => {
    const t = [0, 5, 10];
    const d = [0, 0, 0];
    // duration = 10, threshold = 5 * 10 = 50, 10 <= 50 -> not flagged
    expect(findPauseRanges(t, d, 10)).toEqual([]);
  });

  it('never flags anything when p90AdvanceSec is not finite (no advance interval exists at all)', () => {
    const t = [0, 5, 10, 15];
    const d = [0, 0, 0, 0];
    expect(findPauseRanges(t, d, Infinity)).toEqual([]);
    expect(findPauseRanges(t, d, NaN)).toEqual([]);
  });

  it('only flags the zero-advance runs, leaving advancing pairs untouched', () => {
    const t = [0, 5, 10, 15, 20];
    const d = [0, 5, 5, 5, 10]; // pair0 advances, pairs1-2 flat, pair3 advances
    // flat run duration = t[3]-t[1] = 10, threshold = 5*1 = 5, 10 > 5 -> flagged
    expect(findPauseRanges(t, d, 1)).toEqual([{ startIndex: 1, endIndex: 3 }]);
  });
});

describe('findOverspeedRanges (c)', () => {
  it('flags a maximal advancing run whose AGGREGATE speed exceeds LOCAL_SPEED_LIMIT_MPS', () => {
    const t = [0, 1, 2, 3];
    const d = [0, 10, 20, 30]; // 10 m/s throughout, one continuous advancing run
    expect(findOverspeedRanges(t, d, [])).toEqual([{ startIndex: 0, endIndex: 3 }]);
  });

  it('does NOT flag a run whose aggregate speed stays under the limit even though one pair is individually fast — the rule is AGGREGATE over the whole maximal advancing run, not per-pair', () => {
    const t = [0, 1, 2, 3];
    const d = [0, 10, 11, 12]; // pair0 alone is 10 m/s, but the whole run's aggregate is 12/3=4 m/s
    expect(findOverspeedRanges(t, d, [])).toEqual([]);
  });

  it('breaks a run at a zero-advance pair — two short bursts are judged independently, not pooled into one aggregate', () => {
    const t = [0, 1, 2, 3, 4];
    const d = [0, 10, 10, 10, 20]; // pair0: 10 m/s (own run); pair1-2: flat; pair3: 10 m/s (own run)
    expect(findOverspeedRanges(t, d, [])).toEqual([
      { startIndex: 0, endIndex: 1 },
      { startIndex: 3, endIndex: 4 },
    ]);
  });

  it('flags a single pair immediately AFTER a recording gap on its OWN speed, even though it sits inside a longer run whose AGGREGATE stays under the limit (so the general scan alone would miss it)', () => {
    // gap: pair0 (t0-20, dt=20>10). pair1 (t20-21, d0-10): immediately after the gap
    // (gap.endIndex=1), individually 10 m/s. pair2 (t21-26, d10-11): slow, 0.2 m/s. pair1+pair2
    // form one continuous advancing run whose AGGREGATE is 11/6=1.83 m/s (< 7.35) — the general
    // scan does NOT flag it; only the gap-adjacent single-pair check does.
    const t = [0, 20, 21, 26];
    const d = [0, 0, 10, 11];
    const recordingGapRanges = [{ startIndex: 0, endIndex: 1 }];
    expect(findOverspeedRanges(t, d, recordingGapRanges)).toEqual([{ startIndex: 1, endIndex: 2 }]);
  });

  it('checks the pair immediately BEFORE a gap\'s start too, again inside a run whose AGGREGATE stays under the limit', () => {
    // pair0 (t0-10, d0-1): slow, 0.1 m/s. pair1 (t10-11, d1-11): immediately before the gap
    // (gap.startIndex=2), individually 10 m/s. pair0+pair1 form one continuous advancing run whose
    // AGGREGATE is 11/11=1.0 m/s (< 7.35) — the general scan does NOT flag it. pair2 (t11-31,
    // dt=20>10) is the gap itself.
    const t = [0, 10, 11, 31];
    const d = [0, 1, 11, 11];
    const recordingGapRanges = [{ startIndex: 2, endIndex: 3 }];
    expect(findOverspeedRanges(t, d, recordingGapRanges)).toEqual([{ startIndex: 1, endIndex: 2 }]);
  });
});

describe('mergeExcludedRanges (d)', () => {
  it('returns an empty array for empty input', () => {
    expect(mergeExcludedRanges([])).toEqual([]);
  });

  it('leaves non-overlapping, non-touching ranges separate, sorted by startIndex', () => {
    const result = mergeExcludedRanges([
      { startIndex: 10, endIndex: 12 },
      { startIndex: 0, endIndex: 2 },
    ]);
    expect(result).toEqual([
      { startIndex: 0, endIndex: 2 },
      { startIndex: 10, endIndex: 12 },
    ]);
  });

  it('merges overlapping ranges into one', () => {
    const result = mergeExcludedRanges([
      { startIndex: 0, endIndex: 5 },
      { startIndex: 3, endIndex: 8 },
    ]);
    expect(result).toEqual([{ startIndex: 0, endIndex: 8 }]);
  });

  it('merges touching ranges (end of one equals start of the next) into one', () => {
    const result = mergeExcludedRanges([
      { startIndex: 0, endIndex: 5 },
      { startIndex: 5, endIndex: 9 },
    ]);
    expect(result).toEqual([{ startIndex: 0, endIndex: 9 }]);
  });
});

describe('recountRunningPace (e) — the complement direction, integration over (a)+(b)+(c)+(d)', () => {
  it('a clean stream with no exclusions: excludedM=0, excludedSec=0, coveredM/coveredSec equal the full span', () => {
    const t = [0, 10, 20, 30];
    const d = [0, 30, 60, 90];
    const result = recountRunningPace(t, d);
    expect(result.ok).toBe(true);
    expect(result.recountExcludedM).toBe(0);
    expect(result.recountExcludedSec).toBe(0);
    expect(result.recountCoveredSec).toBe(30);
    expect(result.recountCoveredM).toBe(90);
    expect(result.recountRunningPaceSecPerKm).toBeCloseTo(30 / (90 / 1000), 10);
  });

  it('THE BOUNDARY CASE — a recording gap with zero distance advance: excludedM=0 (exact), excludedSec exactly the gap\'s own duration', () => {
    // pair0: t0-10, d0-20 (dt=10, dd=20). pair1: t10-30, d20-20 (dt=20>10 -> recording gap, dd=0).
    // pair2: t30-40, d20-40 (dt=10, dd=20). Advance intervals: i=1 (d20>0): interval=t[1]-t[0]=10.
    // i=3 (d40>20): interval=t[3]-lastAdvanceT(t[1]=10)=40-10=30. sorted=[10,30]. p90 (R7, n=2):
    // rank=0.9, lo=0,hi=1,frac=0.9 -> 10+0.9*(30-10)=28. pauseThreshold=5*28=140. The flat run at
    // pair1 has duration 20 < 140, so it is NOT independently flagged as pause — only the
    // recording-gap range covers it, no double-count.
    const t = [0, 10, 30, 40];
    const d = [0, 20, 20, 40];
    const result = recountRunningPace(t, d);
    expect(result.ok).toBe(true);
    expect(result.recountExcludedM).toBe(0);
    expect(result.recountExcludedSec).toBe(20);
    expect(result.recountCoveredSec).toBe(20);
    expect(result.recountCoveredM).toBe(40);
    expect(result.recountRunningPaceSecPerKm).toBeCloseTo(20 / (40 / 1000), 10);
  });

  it('propagates a checkStreamLocal failure without throwing', () => {
    const result = recountRunningPace([0, 1], [0, 1, 2]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('different lengths');
  });

  it('a stream that never advances has recountCoveredM <= 0 and a null pace, never a computed zero standing in for "not computable"', () => {
    const t = [0, 5, 10, 15];
    const d = [0, 0, 0, 0];
    const result = recountRunningPace(t, d);
    expect(result.ok).toBe(true);
    expect(result.recountCoveredM).toBeLessThanOrEqual(0);
    expect(result.recountRunningPaceSecPerKm).toBeNull();
  });
});

describe('sweepArchive — reachability against the real archive (read-only, never writes)', () => {
  const swept = sweepArchive(STREAMS_DIR);

  it('runs against the real data/streams/ directory without throwing and returns ok', () => {
    expect(swept.ok).toBe(true);
    expect(swept.streamFileCount).toBeGreaterThan(0);
  });

  it('reports a row for every named activity (or explicitly records it as not computable)', () => {
    for (const id of NAMED_ACTIVITY_IDS) {
      expect(swept.namedRows[id]).toBeDefined();
    }
  });

  it('never treats manifest.json as a stream file', () => {
    // Indirect proof: streamFileCount excludes manifest.json — parseError only counts files that
    // WERE attempted and failed to parse; manifest.json is a valid JSON document (it would parse),
    // so if it were swept it would land in skipped.invalidShape or be silently miscounted rather
    // than excluded outright. isStreamFile's own unit test above is the direct proof.
    expect(isStreamFile('manifest.json')).toBe(false);
  });
});

describe('renderRecountMarkdown — deterministic rendering', () => {
  const syntheticResult = {
    streamFileCount: 3,
    computableCount: 2,
    skipped: { parseError: 0, invalidShape: 0, notComputableNoCoveredDistance: 1 },
    namedRows: {
      '3475724402': {
        id: '3475724402',
        computable: true,
        recountCoveredM: 1000,
        recountCoveredSec: 300,
        recountExcludedM: 10,
        recountExcludedSec: 20,
        recountRunningPaceSecPerKm: 300,
      },
      '3475734189': { id: '3475734189', computable: false, reason: 'no covered distance' },
      '3475740390': undefined,
      '5059204779': undefined,
    },
    archive: { spanSec: 1000, totalM: 5000, excludedSec: 100, excludedM: 50, coveredSec: 900, coveredM: 4950 },
    provenance: { streamsTree: 'deadbeef', newestActivityStartDate: '2026-01-01T00:00:00Z' },
  };

  it('renders every required section, in the plan\'s stated order', () => {
    const markdown = renderRecountMarkdown(syntheticResult);
    const sections = [
      '## Scope and bound on claim',
      '## Local duplicated constants',
      '## Named activities',
      '## Archive-wide reconciliation',
      '## Skipped and non-computable',
      '## Inputs',
    ];
    let lastIndex = -1;
    for (const section of sections) {
      const idx = markdown.indexOf(section);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('is byte-identical across two renders of the same result — no wall-clock timestamp, no bare rev-parse HEAD, no source-file hash embedded', () => {
    const first = renderRecountMarkdown(syntheticResult);
    const second = renderRecountMarkdown(syntheticResult);
    expect(first).toBe(second);
    expect(first).not.toContain('rev-parse HEAD)');
  });

  it('handles a missing named-activity row without throwing', () => {
    const markdown = renderRecountMarkdown(syntheticResult);
    expect(markdown).toContain('not found');
  });
});
