import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { StreamManifest } from '../streams/stream.types.js';
import { ceilingDemotion, deriveCeilings } from './best-effort-ceiling.js';
import { findBestEffort, isPlausible, WORLD_RECORD_SPEED_MPS } from './best-effort-utils.js';
import { TARGET_ORDER } from './best-effort.types.js';
import type { CeilingDerivation, RawEffort, TargetDistanceKey } from './best-effort.types.js';
import {
  complementSubIntervals,
  computeActivityEfforts,
  computeBestEfforts,
  CONTAMINATION_REASON_SEGMENT_CAP,
  segmentIntersectionReason,
  segmentsIntersectingWindow,
  wholeSpanCuts,
  type ActivityEffortInput,
  type CleanSubInterval,
} from './compute-best-efforts.js';
// `classifyGapsWithSegments` is a VALUE import of a `pace-derivation.js`
// re-export (never a direct `unreliable-segments.js` import), the detector's
// one permitted accessor (Phase 33 plan 33-09) — plan 36-05's real-archive
// demonstrations (splice fabrication D-02, D-08 precedence, the scoping
// activities' after-state) call this directly against real committed
// streams, the SAME call the production per-activity loop makes.
import { classifyGapsWithSegments } from './pace-derivation.js';
// Type-only imports of the detector's own shapes are permitted in *.test.ts
// files (pace-single-source.test.ts's SEG-05a audit exempts every test
// file), so this file — unlike compute-best-efforts.ts itself — may import
// directly from the detector module.
import type { SegmentMechanism, SegmentPart, UnreliableSegment } from './unreliable-segments.js';

/** Builds a synthetic constant-pace series: `count` samples, `metersPerSec` m/s, 1s spacing. */
function constantPaceSeries(count: number, metersPerSec: number): { t: number[]; d: number[] } {
  const t: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < count; i++) {
    t.push(i);
    d.push(round1(i * metersPerSec));
  }
  return { t, d };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** mm:ss conversion, computed locally — mirrors best-effort-utils.test.ts's own copy (this file is analytics, must not import a dashboard formatter). */
function paceMinSec(paceSecPerKm: number): string {
  return `${Math.floor(paceSecPerKm / 60)}:${String(Math.round(paceSecPerKm) % 60).padStart(2, '0')}`;
}

/** Reads a committed stream file from `data/streams/` — never the derived stats output (mirrors pace-derivation.test.ts's own `readStream`). */
async function readRealStream(activityId: string): Promise<{ t: number[]; d: number[] }> {
  const raw = await fs.readFile(path.join('data/streams', `${activityId}.json`), 'utf-8');
  return JSON.parse(raw) as { t: number[]; d: number[] };
}

/** Reads a committed activity record from `data/activities/` — the real `max_speed`/`distance` fields plan 36-05's real-archive demonstrations depend on. */
async function readRealActivity(activityId: string): Promise<{ max_speed?: number; distance: number }> {
  const raw = await fs.readFile(path.join('data/activities', `${activityId}.json`), 'utf-8');
  return JSON.parse(raw) as { max_speed?: number; distance: number };
}

function baseInput(overrides: Partial<ActivityEffortInput> = {}): ActivityEffortInput {
  const { t, d } = constantPaceSeries(2000, 3); // 3 m/s ~ 5:33/km, well under any world record
  return {
    activityId: 'a1',
    startDate: '2026-01-01T00:00:00Z',
    activityDistanceM: d[d.length - 1],
    maxSpeedMps: undefined,
    distanceSource: 'native',
    t,
    d,
    // Empty by default — this file's pre-existing describe blocks exercise
    // the no-segments (Branch 1) path. The "clean-window search branches"
    // describe (Task 3) passes its own non-empty `segments` per-test.
    segments: [],
    ...overrides,
  };
}

/**
 * Builds a complete, internally consistent synthetic `UnreliableSegment` —
 * every field present, `parts` matching the whole span by default, and
 * `burstMetres + gapMetres === metres` / `burstSeconds + gapSeconds ===
 * seconds` maintained by construction (D-07's conservation rule,
 * unreliable-segments.ts's own docblock). Every clean-window-search fixture
 * in this file uses this ONE helper so a field cannot drift between them.
 */
function makeSegment(overrides: Partial<UnreliableSegment> = {}): UnreliableSegment {
  const startIndex = overrides.startIndex ?? 0;
  const endIndex = overrides.endIndex ?? startIndex + 1;
  const startSec = overrides.startSec ?? 0;
  const endSec = overrides.endSec ?? startSec + 1;
  const metres = overrides.metres ?? 50;
  const seconds = overrides.seconds ?? endSec - startSec;
  const mechanism: SegmentMechanism = overrides.mechanism ?? 'isolated-jump';
  const burstMetres = overrides.burstMetres ?? metres;
  const burstSeconds = overrides.burstSeconds ?? seconds;
  const gapMetres = overrides.gapMetres ?? metres - burstMetres;
  const gapSeconds = overrides.gapSeconds ?? seconds - burstSeconds;
  const parts: SegmentPart[] = overrides.parts ?? [
    { kind: 'burst', startIndex, endIndex, startSec, endSec, metres: burstMetres, seconds: burstSeconds },
  ];
  return {
    startIndex,
    endIndex,
    startSec,
    endSec,
    metres,
    seconds,
    mechanism,
    burstMetres,
    burstSeconds,
    gapMetres,
    gapSeconds,
    burstCount: overrides.burstCount ?? 1,
    gapCount: overrides.gapCount ?? 0,
    parts,
    excessMetres: overrides.excessMetres ?? 0,
  };
}

describe('computeActivityEfforts — pre-filter', () => {
  it('an activity with distance 1500m (under the 1mi 0.99 threshold) yields no 1mi/5k/10k/half/marathon entries, eligibleTargets count is 2', () => {
    // 1mi * 0.99 = 1593.25m — 1500m falls just short, isolating 400m/1k as the
    // only eligible targets (D-01's own formula, verbatim from <action>).
    const input = baseInput({ activityDistanceM: 1500 });
    const result = computeActivityEfforts(input);
    expect(result.eligibleTargets).toEqual(['400m', '1k']);
    expect(result.eligibleTargets.length).toBe(2);
  });

  it('an activity with distance 4960m IS eligible for 5k (4960 >= 5000 * 0.99)', () => {
    const input = baseInput({ activityDistanceM: 4960 });
    const result = computeActivityEfforts(input);
    expect(result.eligibleTargets).toContain('5k');
  });

  it('an activity with distance 4950m (just under the 0.99 margin) is NOT eligible for 5k', () => {
    const input = baseInput({ activityDistanceM: 4949 });
    const result = computeActivityEfforts(input);
    expect(result.eligibleTargets).not.toContain('5k');
  });

  it('efforts are ordered by TARGET_ORDER, ascending distance, regardless of computation order', () => {
    const { t, d } = constantPaceSeries(6000, 3);
    const input = baseInput({ activityDistanceM: d[d.length - 1], t, d });
    const result = computeActivityEfforts(input);
    const distances = result.efforts.map((e) => e.distance);
    const sorted = [...distances].sort(
      (a, b) =>
        ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon'].indexOf(a) -
        ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon'].indexOf(b)
    );
    expect(distances).toEqual(sorted);
  });
});

describe('computeActivityEfforts — lowConfidence', () => {
  it('lowConfidence is true on every effort when distanceSource is geo', () => {
    const input = baseInput({ activityDistanceM: 3000, distanceSource: 'geo' });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
    expect(result.efforts.every((e) => e.lowConfidence === true)).toBe(true);
  });

  it('lowConfidence is false on every effort when distanceSource is native', () => {
    const input = baseInput({ activityDistanceM: 3000, distanceSource: 'native' });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
    expect(result.efforts.every((e) => e.lowConfidence === false)).toBe(true);
  });
});

describe('computeActivityEfforts — per-target isolation', () => {
  it('a 400m window implying a world-record-beating speed is rejected while 1k/5k survive', () => {
    // First 400m covered in 20s -> implied 20 m/s, beats the ~9.30 m/s 400m world-record ceiling.
    // Remainder of the series runs at a normal 3 m/s.
    const t: number[] = [];
    const d: number[] = [];
    t.push(0);
    d.push(0);
    t.push(20);
    d.push(400);
    // Continue at 3 m/s for the rest of a 6km run.
    let time = 20;
    let dist = 400;
    while (dist < 6000) {
      time += 1;
      dist = round1(dist + 3);
      t.push(time);
      d.push(dist);
    }

    const input = baseInput({ activityDistanceM: dist, t, d });
    const result = computeActivityEfforts(input);

    const distances = result.efforts.map((e) => e.distance);
    expect(distances).toContain('1k');
    expect(distances).toContain('5k');
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].distance).toBe('400m');
  });

  it("a rejected effort's reason is the verbatim string produced by isPlausible, containing the offending numbers", () => {
    const t: number[] = [0, 20];
    const d: number[] = [0, 400];
    // Extend so activity is at least eligible for the 400m distance, single window test.
    const input = baseInput({ activityDistanceM: 400, t, d });
    const result = computeActivityEfforts(input);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].reason).toMatch(/exceeds world-record pace/);
    expect(result.rejected[0].reason).toMatch(/m\/s/);
  });

  it('max_speed of 0 does not suppress efforts — the activity still returns its plausible distances', () => {
    const input = baseInput({ activityDistanceM: 3000, maxSpeedMps: 0 });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
  });

  it('max_speed of undefined does not suppress efforts — the activity still returns its plausible distances', () => {
    const input = baseInput({ activityDistanceM: 3000, maxSpeedMps: undefined });
    const result = computeActivityEfforts(input);
    expect(result.efforts.length).toBeGreaterThan(0);
  });
});

describe('computeActivityEfforts — malformed series', () => {
  it('a length-mismatched series returns zero efforts, zero rejected rows, and a populated seriesError', () => {
    const input = baseInput({ t: [0, 1, 2], d: [0, 3] });
    const result = computeActivityEfforts(input);
    expect(result.efforts).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.eligibleTargets).toEqual([]);
    expect(result.seriesError).toBeDefined();
    expect(result.seriesError).toMatch(/length mismatch/);
  });

  it('a non-finite entry returns zero efforts and a populated seriesError', () => {
    const input = baseInput({ t: [0, 1, 2], d: [0, NaN, 6] });
    const result = computeActivityEfforts(input);
    expect(result.efforts).toEqual([]);
    expect(result.seriesError).toBeDefined();
  });

  it('a decreasing distance array returns zero efforts and a populated seriesError', () => {
    const input = baseInput({ t: [0, 1, 2], d: [0, 6, 3] });
    const result = computeActivityEfforts(input);
    expect(result.efforts).toEqual([]);
    expect(result.seriesError).toBeDefined();
    expect(result.seriesError).toMatch(/decreases/);
  });
});

describe('computeActivityEfforts — rounding and pace consistency', () => {
  it('paceSecPerKm is consistent with durationSec: a 1k effort of 300.0s has paceSecPerKm 300.0', () => {
    const t: number[] = [0, 300];
    const d: number[] = [0, 1000];
    const input = baseInput({ activityDistanceM: 1000, t, d });
    const result = computeActivityEfforts(input);
    const oneK = result.efforts.find((e) => e.distance === '1k');
    expect(oneK).toBeDefined();
    expect(oneK!.durationSec).toBe(300.0);
    expect(oneK!.paceSecPerKm).toBe(300.0);
  });

  it('durationSec, paceSecPerKm and endOffsetSec are rounded to at most one decimal place', () => {
    const t: number[] = [0, 333];
    const d: number[] = [0, 1000];
    const input = baseInput({ activityDistanceM: 1000, t, d });
    const result = computeActivityEfforts(input);
    const oneK = result.efforts.find((e) => e.distance === '1k');
    expect(oneK).toBeDefined();
    const isRoundedTo1Decimal = (n: number) => Math.round(n * 10) === n * 10;
    expect(isRoundedTo1Decimal(oneK!.durationSec)).toBe(true);
    expect(isRoundedTo1Decimal(oneK!.paceSecPerKm)).toBe(true);
    expect(isRoundedTo1Decimal(oneK!.endOffsetSec)).toBe(true);
  });
});

describe('complementSubIntervals boundary rule (PR-06, D-01)', () => {
  it('no cuts on a streamLength of 10 yields the whole span as one clean sub-interval', () => {
    expect(complementSubIntervals(10, [])).toEqual([{ startIndex: 0, endIndex: 10 }]);
  });

  it('one cut {4,7} on streamLength 10 yields [{0,5},{7,10}] — the +1 boundary correction', () => {
    // Hand computation: cursor starts at 0. cut.startIndex=4 >= cursor+1=1,
    // so push {startIndex: cursor, endIndex: cut.startIndex + 1} = {0, 5}.
    // cursor becomes max(0, cut.endIndex) = 7; streamLength - cursor = 3 >=
    // 2, so the trailing sub-interval {7, 10} is pushed too.
    const result = complementSubIntervals(10, [{ startIndex: 4, endIndex: 7 }]);
    expect(result).toEqual([
      { startIndex: 0, endIndex: 5 },
      { startIndex: 7, endIndex: 10 },
    ]);
    // 36-RESEARCH.md's illustrative snippet pushes `endIndex: cut.startIndex`
    // (4, not 5) for the leading sub-interval — that off-by-one silently
    // drops the last clean pair (samples 3..4). Assert the corrected value
    // explicitly, in the direction that would catch the research snippet's
    // own error.
    expect(result[0].endIndex).toBe(5);
    expect(result[0].endIndex).not.toBe(4);
  });

  it('a cut starting at index 0 produces no leading sub-interval', () => {
    // cursor=0; cut.startIndex=0 >= cursor+1=1 is false, so nothing is
    // pushed before the cut. Only the trailing {cut.endIndex, streamLength}
    // sub-interval exists.
    const result = complementSubIntervals(10, [{ startIndex: 0, endIndex: 3 }]);
    expect(result).toEqual([{ startIndex: 3, endIndex: 10 }]);
  });

  it('a cut ending at the last sample produces no trailing sub-interval', () => {
    // cursor becomes max(0, cut.endIndex) = 10 after the cut; streamLength -
    // cursor = 0, which is < 2, so no trailing sub-interval is pushed.
    const result = complementSubIntervals(10, [{ startIndex: 6, endIndex: 10 }]);
    expect(result).toEqual([{ startIndex: 0, endIndex: 7 }]);
  });

  it('overlapping and adjacent cuts both merge via the Math.max cursor; no zero-length or 1-sample sub-interval is emitted', () => {
    // Two OVERLAPPING cuts {3,6} and {5,9} on streamLength 12: after {3,6},
    // cursor=6. The second cut's startIndex=5 >= cursor+1=7 is false (5 < 7),
    // so nothing is pushed between them; cursor becomes max(6,9)=9. Leading:
    // cut[0].startIndex=3 >= cursor+1=1, push {0,4}. Trailing: 12-9=3 >= 2,
    // push {9,12}.
    const overlapping = complementSubIntervals(12, [
      { startIndex: 3, endIndex: 6 },
      { startIndex: 5, endIndex: 9 },
    ]);
    expect(overlapping).toEqual([
      { startIndex: 0, endIndex: 4 },
      { startIndex: 9, endIndex: 12 },
    ]);

    // Two ADJACENT cuts {4,7} and {7,9}: cursor after the first cut is 7;
    // the second cut's startIndex=7 >= cursor+1=8 is false, so no
    // sub-interval is emitted between them either — adjacency is handled
    // identically to overlap by the same Math.max cursor.
    const adjacent = complementSubIntervals(12, [
      { startIndex: 4, endIndex: 7 },
      { startIndex: 7, endIndex: 9 },
    ]);
    expect(adjacent).toEqual([
      { startIndex: 0, endIndex: 5 },
      { startIndex: 9, endIndex: 12 },
    ]);

    for (const sub of [...overlapping, ...adjacent]) {
      expect(sub.endIndex - sub.startIndex).toBeGreaterThanOrEqual(2);
    }
  });

  it('cuts supplied in descending order produce the same result as ascending order, and the input array is not mutated', () => {
    const ascending: CleanSubInterval[] = [
      { startIndex: 2, endIndex: 4 },
      { startIndex: 8, endIndex: 10 },
    ];
    const descending: CleanSubInterval[] = [
      { startIndex: 8, endIndex: 10 },
      { startIndex: 2, endIndex: 4 },
    ];
    const snapshot = descending.map((c) => ({ ...c }));

    const ascResult = complementSubIntervals(14, ascending);
    const descResult = complementSubIntervals(14, descending);

    expect(descResult).toEqual(ascResult);
    // The detector's own segments array is documented as unsorted — this
    // function must sort a COPY, never the caller's own array.
    expect(descending).toEqual(snapshot);
  });

  it('streamLength 0 and 1 both yield an empty array (too short to hold any 2-sample sub-interval)', () => {
    expect(complementSubIntervals(0, [])).toEqual([]);
    expect(complementSubIntervals(1, [])).toEqual([]);
  });
});

describe('clean-window search branches (PR-07, D-04/D-05/D-06)', () => {
  it('Branch 1 (segments: []): contaminated is null, demotion is null, and durationSec matches the hand-computed constant-pace duration', () => {
    // Constant 3 m/s pace (baseInput's own series) — 400m is reached at
    // exactly t = 400 / 3 = 133.33...s.
    const input = baseInput({ activityDistanceM: 6000 });
    const result = computeActivityEfforts(input);
    const fourHundred = result.efforts.find((e) => e.distance === '400m');
    expect(fourHundred).toBeDefined();
    expect(fourHundred!.contaminated).toBeNull();
    expect(fourHundred!.demotion).toBeNull();
    expect(fourHundred!.durationSec).toBeCloseTo(400 / 3, 1);
  });

  it('Branch 1: a non-intersecting segment leaves contaminated null; moved to touch the window boundary exactly, it is STILL non-intersecting (touching is not overlap, asserted in the direction that can fail)', () => {
    const { t, d } = constantPaceSeries(2000, 3);
    const raw = findBestEffort(t, d, 400);
    expect(raw).toBeDefined();

    // A segment strictly AFTER the raw window's own pair range.
    const farSegment = makeSegment({
      startIndex: raw!.endIndex + 10,
      endIndex: raw!.endIndex + 11,
      startSec: t[raw!.endIndex + 10],
      endSec: t[raw!.endIndex + 11],
    });
    const farResult = computeActivityEfforts(
      baseInput({ activityDistanceM: d[d.length - 1], t, d, segments: [farSegment] })
    );
    expect(farResult.efforts.find((e) => e.distance === '400m')!.contaminated).toBeNull();

    // The SAME segment moved to touch the window's end sample EXACTLY:
    // seg.startIndex === raw.endIndex. Touching shares only the boundary
    // sample and is NOT overlap (segmentsIntersectingWindow's own docblock)
    // — if the predicate used `<=` instead of `<`, this case would wrongly
    // report an intersection.
    const touchingSegment = makeSegment({
      startIndex: raw!.endIndex,
      endIndex: raw!.endIndex + 1,
      startSec: t[raw!.endIndex],
      endSec: t[raw!.endIndex + 1],
    });
    const touchingResult = computeActivityEfforts(
      baseInput({ activityDistanceM: d[d.length - 1], t, d, segments: [touchingSegment] })
    );
    expect(touchingResult.efforts.find((e) => e.distance === '400m')!.contaminated).toBeNull();
  });

  it('Branch 2: a fabricated burst wins the raw 400m sweep, but a slower clean 400m sub-interval exists — the effort ranks on the CLEAN figure and carries the RAW figure as contaminated', () => {
    // Sample 0->1: 400m in 1s (the burst — by far the fastest way to cover
    // 400m, so the UNCONSTRAINED sweep always picks it). Sample 1->2: 400m
    // over 200s (2 m/s, clean, well under any world record). The segment
    // supplied directly below covers exactly pair 0 (the burst), matching
    // D-01's whole-merged-span convention.
    const t = [0, 1, 201];
    const d = [0, 400, 800];
    const segment = makeSegment({ startIndex: 0, endIndex: 1, startSec: 0, endSec: 1, metres: 400, seconds: 1 });

    const raw = findBestEffort(t, d, 400)!;
    // Hand computation, RAW (unconstrained): i=0, d[1]-d[0]=400 >= 400
    // stops immediately at j=1; frac=400/400=1, crossingTime=t[0]+1*(t[1]-
    // t[0])=1; durationSec=1-0=1s. This is faster than the i=1 alternative
    // (400m over 200s) so it is the sweep's overall minimum.
    expect(raw.durationSec).toBeCloseTo(1, 5);
    expect(raw.startIndex).toBe(0);
    expect(raw.endIndex).toBe(1);

    const result = computeActivityEfforts(
      baseInput({ activityDistanceM: 800, t, d, segments: [segment] })
    );
    const fourHundred = result.efforts.find((e) => e.distance === '400m')!;

    expect(fourHundred.demotion).toBeNull();
    // Hand computation, CLEAN (bounded to the complement {1,3}): i=1,
    // d[2]-d[1]=400 >= 400 stops at j=2; frac=1, crossingTime=t[1]+1*(t[2]-
    // t[1])=201; durationSec=201-1=200s.
    expect(fourHundred.durationSec).toBeCloseTo(200, 1);
    expect(fourHundred.paceSecPerKm).toBeCloseTo(500, 1);

    expect(fourHundred.contaminated).not.toBeNull();
    expect(fourHundred.contaminated!.guard).toBe('unreliable-segment');
    // The contaminated record carries the RAW figure — round1(1)=1.0,
    // round1(1/(400/1000))=round1(2.5)=2.5.
    expect(fourHundred.contaminated!.durationSec).toBeCloseTo(1, 1);
    expect(fourHundred.contaminated!.paceSecPerKm).toBeCloseTo(2.5, 1);
    expect(fourHundred.contaminated!.startOffsetSec).toBeCloseTo(raw.startOffsetSec, 1);
    expect(fourHundred.contaminated!.endOffsetSec).toBeCloseTo(raw.endOffsetSec, 1);

    // The ranked (clean) figure is strictly SLOWER than the raw contaminated
    // one — a search that mistakenly returned the raw window as "clean"
    // would fail this.
    expect(fourHundred.contaminated!.durationSec).toBeLessThan(fourHundred.durationSec);
  });

  it('Branch 3: no clean 400m sub-interval covers the distance — the effort is kept-and-demoted under the RAW figure, with exactly one rejected row and no max-speed/world-record row', () => {
    // Same burst as Branch 2's fixture, but the remainder covers only 100m
    // (not enough for a clean 400m sub-interval): sample 1->2 is 100m over
    // 200s.
    const t = [0, 1, 201];
    const d = [0, 400, 500];
    const segment = makeSegment({ startIndex: 0, endIndex: 1, startSec: 0, endSec: 1, metres: 400, seconds: 1 });

    const raw = findBestEffort(t, d, 400)!;
    expect(raw.durationSec).toBeCloseTo(1, 5);

    const result = computeActivityEfforts(
      baseInput({ activityDistanceM: 500, t, d, segments: [segment] })
    );
    const fourHundred = result.efforts.find((e) => e.distance === '400m')!;

    expect(fourHundred.contaminated).toBeNull();
    expect(fourHundred.demotion).not.toBeNull();
    expect(fourHundred.demotion!.guard).toBe('unreliable-segment');
    // The top-level fields hold the RAW (contaminated) figure — round1(1)=1.0.
    expect(fourHundred.durationSec).toBeCloseTo(1, 1);
    expect(fourHundred.demotion!.reason).toContain(
      'no clean 400m sub-interval covers the distance'
    );
    // Hand computation: the only clean sub-interval is {1,3}, spanning
    // d[2]-d[1] = 500-400 = 100m.
    expect(fourHundred.demotion!.reason).toContain('longest clean sub-interval spans 100.0m');

    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].distance).toBe('400m');
    expect(result.rejected.some((r) => r.reason.includes('max_speed'))).toBe(false);
    expect(result.rejected.some((r) => r.reason.includes('world-record'))).toBe(false);
  });

  it("D-08's short-circuit: the same Branch 3 fixture with an implausibly low maxSpeedMps still demotes under 'unreliable-segment', not 'max-speed' — isPlausible is never independently evaluated", () => {
    const t = [0, 1, 201];
    const d = [0, 400, 500];
    const segment = makeSegment({ startIndex: 0, endIndex: 1, startSec: 0, endSec: 1, metres: 400, seconds: 1 });

    const result = computeActivityEfforts(
      baseInput({ activityDistanceM: 500, t, d, segments: [segment], maxSpeedMps: 0.001 })
    );
    const fourHundred = result.efforts.find((e) => e.distance === '400m')!;

    expect(fourHundred.demotion!.guard).toBe('unreliable-segment');
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].reason).not.toMatch(/max_speed/);
  });

  it('Branch 2 crossed with an absolute guard: the RAW figure fails max-speed but the CLEAN figure does not — demotion is null (the absolute guard saw only the clean figure) and contaminated is populated', () => {
    // Same Branch 2 fixture (raw implied speed 400 m/s, clean implied speed
    // 2 m/s). maxSpeedMps=3 sets the max-speed threshold at 3*1.02=3.06 —
    // the RAW figure (400 m/s) would fail it by a huge margin, but Branch 2
    // never evaluates isPlausible against the raw figure; only the CLEAN
    // figure (2 m/s, well under 3.06) is evaluated. The real-activity form
    // of this exact row is plan 36-05's `3475725842` fixture; this synthetic
    // version exists only to pin the branch in isolation, not to replace it.
    const t = [0, 1, 201];
    const d = [0, 400, 800];
    const segment = makeSegment({ startIndex: 0, endIndex: 1, startSec: 0, endSec: 1, metres: 400, seconds: 1 });

    const result = computeActivityEfforts(
      baseInput({ activityDistanceM: 800, t, d, segments: [segment], maxSpeedMps: 3 })
    );
    const fourHundred = result.efforts.find((e) => e.distance === '400m')!;

    expect(fourHundred.demotion).toBeNull();
    expect(fourHundred.contaminated).not.toBeNull();
    expect(fourHundred.contaminated!.guard).toBe('unreliable-segment');
  });
});

describe('contamination reason strings (PR-07, D-07)', () => {
  const raw: RawEffort = {
    durationSec: 79.9,
    startOffsetSec: 2508,
    endOffsetSec: 2587.9,
    startIndex: 629,
    endIndex: 657,
  };

  it('a single intersecting segment renders the single-segment template with every number at exactly 1 decimal place', () => {
    const segment = makeSegment({
      startSec: 2508,
      endSec: 2513,
      metres: 52.4,
      seconds: 5,
      mechanism: 'isolated-jump',
    });
    const reason = segmentIntersectionReason('400m', raw, [segment]);
    expect(reason).toContain('contaminated window: 400m in 79.9s at t=2508.0-2587.9s');
    expect(reason).toContain(
      'intersecting an unreliable segment at t=2508.0-2513.0s (isolated-jump, 52.4m/5.0s)'
    );
  });

  it('four intersecting segments name exactly CONTAMINATION_REASON_SEGMENT_CAP of them (the two with the smallest startSec) and end with "+2 more"', () => {
    expect(CONTAMINATION_REASON_SEGMENT_CAP).toBe(2);
    const segments = [
      makeSegment({ startSec: 2580, endSec: 2583, metres: 30.4, seconds: 3, mechanism: 'isolated-jump' }),
      makeSegment({ startSec: 2508, endSec: 2513, metres: 52.4, seconds: 5, mechanism: 'isolated-jump' }),
      makeSegment({ startSec: 2587, endSec: 2589, metres: 24.7, seconds: 2, mechanism: 'isolated-jump' }),
      makeSegment({ startSec: 2536, endSec: 2538, metres: 28.6, seconds: 2, mechanism: 'isolated-jump' }),
    ];
    // segmentIntersectionReason itself does not sort — the CALLER
    // (segmentsIntersectingWindow) is responsible for the deterministic
    // startSec-ascending order. Sort here to match how the two compose in
    // computeActivityEfforts.
    const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
    const reason = segmentIntersectionReason('400m', raw, sorted);
    expect(reason).toContain('intersecting 4 unreliable segments');
    expect(reason).toContain('isolated-jump 52.4m/5.0s at t=2508.0');
    expect(reason).toContain('isolated-jump 28.6m/2.0s at t=2536.0');
    expect(reason.endsWith('+2 more)')).toBe(true);
    // The two NAMED are the two with the smallest startSec (2508, 2536) —
    // not the later 2580/2587 pair.
    expect(reason).not.toContain('t=2580.0');
    expect(reason).not.toContain('t=2587.0');
  });

  it('exactly CONTAMINATION_REASON_SEGMENT_CAP segments: the "; +0 more" clause is absent', () => {
    const segments = [
      makeSegment({ startSec: 2508, endSec: 2513, metres: 52.4, seconds: 5, mechanism: 'isolated-jump' }),
      makeSegment({ startSec: 2536, endSec: 2538, metres: 28.6, seconds: 2, mechanism: 'isolated-jump' }),
    ];
    expect(segments.length).toBe(CONTAMINATION_REASON_SEGMENT_CAP);
    const reason = segmentIntersectionReason('400m', raw, segments);
    expect(reason).not.toContain('more');
    expect(reason).not.toContain('; +0');
  });

  it('the four-segment reason contains no "|" or newline and stays under 320 characters', () => {
    const segments = [
      makeSegment({ startSec: 2580, endSec: 2583, metres: 30.4, seconds: 3, mechanism: 'isolated-jump' }),
      makeSegment({ startSec: 2508, endSec: 2513, metres: 52.4, seconds: 5, mechanism: 'isolated-jump' }),
      makeSegment({ startSec: 2587, endSec: 2589, metres: 24.7, seconds: 2, mechanism: 'isolated-jump' }),
      makeSegment({ startSec: 2536, endSec: 2538, metres: 28.6, seconds: 2, mechanism: 'isolated-jump' }),
    ].sort((a, b) => a.startSec - b.startSec);
    const reason = segmentIntersectionReason('400m', raw, segments);
    expect(reason).not.toContain('|');
    expect(reason).not.toContain('\n');
    expect(reason.length).toBeLessThan(320);
  });

  it('the reason contains none of the banned adjectives (Phase 27 D-09 register)', () => {
    const segment = makeSegment({
      startSec: 2508,
      endSec: 2513,
      metres: 52.4,
      seconds: 5,
      mechanism: 'isolated-jump',
    });
    const reason = segmentIntersectionReason('400m', raw, [segment]);
    for (const banned of ['unrealistic', 'implausible', 'suspicious', 'bad', 'wrong']) {
      expect(reason.toLowerCase()).not.toContain(banned);
    }
  });
});

/**
 * D-02 — the d-rebased splice fabricates a strictly faster window than the
 * shipped partition on the locked real fixture (`3475740390`@400m,
 * 36-CONTEXT.md's own pinned row). Reads the REAL committed
 * `data/streams/<id>.json` directly — no synthetic look-alike (Pitfall 12,
 * 36-RESEARCH.md).
 *
 * Reachability is proven FIRST: `segments.length > 0` and a non-empty
 * intersection for the raw (unconstrained) window, so this fixture is known
 * to have something for the splice to get wrong before any comparison runs
 * — without this, the whole row could pass against a stream carrying no
 * segments at all.
 */
describe('splice fabricates a faster window than the shipped partition (D-02, PR-06)', () => {
  /**
   * The WRONG implementation a competent maintainer would actually write
   * (36-RESEARCH.md Pitfall 7): walk the samples in order; for each
   * whole-span cut (`wholeSpanCuts(segments)`), DROP every sample strictly
   * inside the cut (indices `cut.startIndex + 1` through `cut.endIndex`,
   * inclusive) and SUBTRACT that cut's own `d[cut.endIndex] -
   * d[cut.startIndex]` from every retained DOWNSTREAM `d` value — rebasing
   * distance as if the segment's metres had never been covered. `t` is left
   * untouched, so the surviving samples stitch across the removed span.
   * TEST-ONLY: the shipped code never builds a combined/stitched array
   * (Pattern 1, 36-RESEARCH.md — partition, never splice).
   */
  function dRebasedSplice(
    t: readonly number[],
    d: readonly number[],
    segments: readonly UnreliableSegment[]
  ): { t: number[]; d: number[] } {
    const cuts = [...wholeSpanCuts(segments)].sort((a, b) => a.startIndex - b.startIndex);
    const splicedT: number[] = [];
    const splicedD: number[] = [];
    let offset = 0;
    let cutIndex = 0;
    for (let i = 0; i < t.length; i++) {
      while (cutIndex < cuts.length && i > cuts[cutIndex].endIndex) cutIndex++;
      const cut = cuts[cutIndex];
      if (cut && i > cut.startIndex && i <= cut.endIndex) {
        if (i === cut.endIndex) offset += d[cut.endIndex] - d[cut.startIndex];
        continue;
      }
      splicedT.push(t[i]);
      splicedD.push(d[i] - offset);
    }
    return { t: splicedT, d: splicedD };
  }

  /** Independently re-derives the honest partition answer from complementSubIntervals + the bounded sweep — never read off the splice's own output. */
  function honestPartitionDuration(
    t: readonly number[],
    d: readonly number[],
    segments: readonly UnreliableSegment[]
  ): RawEffort | undefined {
    const subs = complementSubIntervals(t.length, wholeSpanCuts(segments));
    let best: RawEffort | undefined;
    for (const sub of subs) {
      const candidate = findBestEffort(t as number[], d as number[], 400, sub);
      if (candidate && (!best || candidate.durationSec < best.durationSec)) best = candidate;
    }
    return best;
  }

  it("3475740390@400m: the d-rebased splice is STRICTLY faster than the honest partition, and NOTHING is asserted against today's unconstrained figure", async () => {
    const { t, d } = await readRealStream('3475740390');
    const { segments } = classifyGapsWithSegments(t, d);

    // REACHABILITY PROOF.
    expect(segments.length).toBeGreaterThan(0);
    const rawWindow = findBestEffort(t, d, 400);
    expect(rawWindow).toBeDefined();
    expect(segmentsIntersectingWindow(segments, rawWindow!).length).toBeGreaterThan(0);

    const spliced = dRebasedSplice(t, d, segments);
    expect(spliced.t.length).toBeLessThan(t.length);
    for (let i = 1; i < spliced.d.length; i++) {
      expect(spliced.d[i]).toBeGreaterThanOrEqual(spliced.d[i - 1]);
    }

    const splicedResult = findBestEffort(spliced.t, spliced.d, 400);
    expect(splicedResult).toBeDefined();

    const honestPartition = honestPartitionDuration(t, d, segments);
    expect(honestPartition).toBeDefined();

    const shippedResult = computeActivityEfforts(
      baseInput({ activityDistanceM: d[d.length - 1], t, d, segments })
    );
    const shippedEffort = shippedResult.efforts.find((e) => e.distance === '400m')!;
    expect(shippedEffort.durationSec).toBeCloseTo(honestPartition!.durationSec, 1);

    // THE ROW: the splice fabricates a STRICTLY faster window than
    // partitioning does. A shipped implementation that spliced would make
    // these equal, failing this assertion — the row's CAN FAIL direction.
    expect(splicedResult!.durationSec).toBeLessThan(shippedEffort.durationSec);

    // Measured 2026-09-28 (re-verify against a moving archive; reconciled in
    // full, with mm:ss, in 36-05-SUMMARY.md): today (raw, unconstrained)
    // ~79.9s; honest partition ~119.6s; naive splice (delete only, no
    // rebase) ~81.5s — SLOWER than today, so a "splice beats today"
    // assertion would be FALSE on this activity — the comparison that holds
    // is splice vs partition, asserted above; the d-rebased splice measured
    // here, ~116.6s — FASTER than the honest partition (~119.6s) but NEVER
    // compared against today's unconstrained figure.
  });

  it("3475724402@400m: re-measures the d-rebased splice — DELIBERATELY NOT paired with this variant (36-CONTEXT.md finding 2); no ordering is asserted", async () => {
    const { t, d } = await readRealStream('3475724402');
    const { segments } = classifyGapsWithSegments(t, d);
    expect(segments.length).toBeGreaterThan(0);

    const spliced = dRebasedSplice(t, d, segments);
    expect(spliced.t.length).toBeLessThan(t.length);
    for (let i = 1; i < spliced.d.length; i++) {
      expect(spliced.d[i]).toBeGreaterThanOrEqual(spliced.d[i - 1]);
    }
    const splicedResult = findBestEffort(spliced.t, spliced.d, 400);
    expect(splicedResult).toBeDefined();

    const honestPartition = honestPartitionDuration(t, d, segments);
    expect(honestPartition).toBeDefined();

    // DELIBERATELY NOT paired with the d-rebased variant as this plan's
    // locked test row (D-02 pins 3475740390 only): the two source documents
    // disagree about this activity's own d-rebased-vs-partition ordering —
    // 36-CONTEXT.md finding 2 measured the splice SLOWER than partition here
    // (roughly 118.8s versus 116.1s), 36-RESEARCH.md's own re-implementation
    // measured them IDENTICAL (both roughly 116.1s) — so pairing this
    // variant with this fixture would be an unsatisfiable row either way
    // (36-RESEARCH.md Pitfall 7). No ordering is asserted below; both
    // re-measured figures (and which source document this run's own
    // measurement agrees with), in mm:ss, are recorded in 36-05-SUMMARY.md.
  });
});

/**
 * D-08's precedence, demonstrated on two REAL activities whose raw window
 * genuinely fails an absolute guard (the "moved" case — 31 real pairs on
 * the live archive, swept 2026-09-28, 36-VALIDATION.md § Two-Direction
 * Reachability). D-08's LITERAL bound ("a real activity that trips both the
 * unreliable-segment guard AND an absolute guard") is UNSATISFIABLE for the
 * no-clean-window case: 0 of 440 no-clean-window occurrences independently
 * fail an absolute guard on the live archive — plan 36-01's REQUIREMENTS.md
 * amendment records this asymmetry. No synthetic fixture is built for the
 * empty combination here; only the moved case (this describe) is
 * demonstrated.
 */
describe('3475725842 & 3475713251 — D-08 precedence on real activities whose raw window fails an absolute guard', () => {
  it("3475725842@400m: raw fails max-speed, ranked figure is plausible, demotion is null, contaminated carries the raw figure under 'unreliable-segment'", async () => {
    const { t, d } = await readRealStream('3475725842');
    const activity = await readRealActivity('3475725842');
    const { segments } = classifyGapsWithSegments(t, d);

    const raw = findBestEffort(t, d, 400);
    expect(raw).toBeDefined();
    const rawSpeed = 400 / raw!.durationSec;
    const rawPlausibility = isPlausible(rawSpeed, activity.max_speed, WORLD_RECORD_SPEED_MPS['400m']);
    expect(rawPlausibility.ok).toBe(false);
    if (rawPlausibility.ok) throw new Error('unreachable — asserted false above');
    expect(rawPlausibility.guard).toBe('max-speed');

    expect(segmentsIntersectingWindow(segments, raw!).length).toBeGreaterThan(0);

    const result = computeActivityEfforts(
      baseInput({
        activityDistanceM: activity.distance,
        t,
        d,
        segments,
        maxSpeedMps: activity.max_speed,
      })
    );
    const effort = result.efforts.find((e) => e.distance === '400m')!;
    expect(effort.demotion).toBeNull();
    expect(effort.contaminated).not.toBeNull();
    expect(effort.contaminated!.guard).toBe('unreliable-segment');
    const rankedSpeed = 400 / effort.durationSec;
    expect(isPlausible(rankedSpeed, activity.max_speed, WORLD_RECORD_SPEED_MPS['400m']).ok).toBe(true);
    expect(effort.contaminated!.durationSec).toBeLessThan(effort.durationSec);
    expect(effort.contaminated!.reason).not.toMatch(/max_speed/);
    expect(effort.contaminated!.reason).not.toMatch(/world-record/);
  });

  it("3475713251@400m: raw fails world-record, ranked figure is plausible, demotion is null, contaminated carries the raw figure under 'unreliable-segment'", async () => {
    const { t, d } = await readRealStream('3475713251');
    const activity = await readRealActivity('3475713251');
    const { segments } = classifyGapsWithSegments(t, d);

    const raw = findBestEffort(t, d, 400);
    expect(raw).toBeDefined();
    const rawSpeed = 400 / raw!.durationSec;
    const rawPlausibility = isPlausible(rawSpeed, activity.max_speed, WORLD_RECORD_SPEED_MPS['400m']);
    expect(rawPlausibility.ok).toBe(false);
    if (rawPlausibility.ok) throw new Error('unreachable — asserted false above');
    expect(rawPlausibility.guard).toBe('world-record');

    expect(segmentsIntersectingWindow(segments, raw!).length).toBeGreaterThan(0);

    const result = computeActivityEfforts(
      baseInput({
        activityDistanceM: activity.distance,
        t,
        d,
        segments,
        maxSpeedMps: activity.max_speed,
      })
    );
    const effort = result.efforts.find((e) => e.distance === '400m')!;
    expect(effort.demotion).toBeNull();
    expect(effort.contaminated).not.toBeNull();
    expect(effort.contaminated!.guard).toBe('unreliable-segment');
    const rankedSpeed = 400 / effort.durationSec;
    expect(isPlausible(rankedSpeed, activity.max_speed, WORLD_RECORD_SPEED_MPS['400m']).ok).toBe(true);
    expect(effort.contaminated!.durationSec).toBeLessThan(effort.durationSec);
    expect(effort.contaminated!.reason).not.toMatch(/max_speed/);
    expect(effort.contaminated!.reason).not.toMatch(/world-record/);
  });
});

/**
 * All three scoping activities' after-state (ROADMAP criterion 1/4,
 * 36-02-SUMMARY.md's BEFORE reference table). Every `contaminated` record
 * below is checked against the SAME pinned BEFORE figures plan 36-02
 * asserts directly on `findBestEffort` — proving the contaminated record is
 * provably the ORIGINAL figure, not something new — while the ranked
 * top-level figure is asserted strictly slower and, for 3475740390, moved
 * off the detected segments entirely (criterion 1). The three scoping
 * activities' pinned per-km AFTER pace figures (36-CONTEXT.md's own
 * "Measured during this discussion" table) are never asserted here — they
 * are references to reconcile against, recorded only in 36-05-SUMMARY.md.
 */
describe('scoping activities after — contaminated retains the BEFORE window, ranked figure moves off it', () => {
  it("3475740390@400m: contaminated is the pinned BEFORE window (3:20/km, startOffsetSec=2508); ranked is strictly slower and does not overlap any detected segment", async () => {
    const { t, d } = await readRealStream('3475740390');
    const activity = await readRealActivity('3475740390');
    const { segments } = classifyGapsWithSegments(t, d);

    const result = computeActivityEfforts(
      baseInput({
        activityDistanceM: activity.distance,
        t,
        d,
        segments,
        maxSpeedMps: activity.max_speed,
      })
    );
    const effort = result.efforts.find((e) => e.distance === '400m')!;
    expect(effort.contaminated).not.toBeNull();
    expect(paceMinSec(effort.contaminated!.paceSecPerKm)).toBe('3:20');
    expect(effort.contaminated!.startOffsetSec).toBe(2508);
    expect(effort.paceSecPerKm).toBeGreaterThan(effort.contaminated!.paceSecPerKm);
    expect(effort.demotion).toBeNull();

    // Criterion 1: the shipped (ranked) window no longer spans any detected
    // segment. Rounding tolerance: 0.6s total, stated in two named
    // components — 0.5s from Math.round on startOffsetSec, plus 0.05s from
    // round1 on endOffsetSec, plus float slack.
    const OVERLAP_TOLERANCE_SEC = 0.6;
    for (const seg of segments) {
      const overlaps =
        seg.startSec < effort.endOffsetSec - OVERLAP_TOLERANCE_SEC &&
        effort.startOffsetSec + OVERLAP_TOLERANCE_SEC < seg.endSec;
      expect(overlaps).toBe(false);
    }
    expect(effort.startOffsetSec).not.toBe(effort.contaminated!.startOffsetSec);

    // Criterion 1's reason content: derive the intersecting segments' own
    // metres/seconds from the detector's output — never hardcoded — and
    // confirm the first CONTAMINATION_REASON_SEGMENT_CAP of them appear in
    // the reason string, formatted to one decimal place.
    const raw = findBestEffort(t, d, 400)!;
    const intersecting = segmentsIntersectingWindow(segments, raw);
    expect(intersecting.length).toBeGreaterThan(0);
    for (const seg of intersecting.slice(0, CONTAMINATION_REASON_SEGMENT_CAP)) {
      expect(effort.contaminated!.reason).toContain(seg.metres.toFixed(1));
      expect(effort.contaminated!.reason).toContain(seg.seconds.toFixed(1));
    }
  });

  it("3475724402@400m: contaminated is the pinned BEFORE window (3:21/km, startOffsetSec=3061); ranked is strictly slower", async () => {
    const { t, d } = await readRealStream('3475724402');
    const activity = await readRealActivity('3475724402');
    const { segments } = classifyGapsWithSegments(t, d);

    const result = computeActivityEfforts(
      baseInput({
        activityDistanceM: activity.distance,
        t,
        d,
        segments,
        maxSpeedMps: activity.max_speed,
      })
    );
    const effort = result.efforts.find((e) => e.distance === '400m')!;
    expect(effort.contaminated).not.toBeNull();
    expect(paceMinSec(effort.contaminated!.paceSecPerKm)).toBe('3:21');
    expect(effort.contaminated!.startOffsetSec).toBe(3061);
    expect(effort.paceSecPerKm).toBeGreaterThan(effort.contaminated!.paceSecPerKm);
    expect(effort.demotion).toBeNull();

    const raw = findBestEffort(t, d, 400)!;
    const intersecting = segmentsIntersectingWindow(segments, raw);
    expect(intersecting.length).toBeGreaterThan(0);
    for (const seg of intersecting.slice(0, CONTAMINATION_REASON_SEGMENT_CAP)) {
      expect(effort.contaminated!.reason).toContain(seg.metres.toFixed(1));
      expect(effort.contaminated!.reason).toContain(seg.seconds.toFixed(1));
    }
  });

  it("3475734189@400m: contaminated is the pinned BEFORE window (3:22/km, startOffsetSec=1285); ranked is strictly slower", async () => {
    const { t, d } = await readRealStream('3475734189');
    const activity = await readRealActivity('3475734189');
    const { segments } = classifyGapsWithSegments(t, d);

    const result = computeActivityEfforts(
      baseInput({
        activityDistanceM: activity.distance,
        t,
        d,
        segments,
        maxSpeedMps: activity.max_speed,
      })
    );
    const effort = result.efforts.find((e) => e.distance === '400m')!;
    expect(effort.contaminated).not.toBeNull();
    expect(paceMinSec(effort.contaminated!.paceSecPerKm)).toBe('3:22');
    expect(effort.contaminated!.startOffsetSec).toBe(1285);
    expect(effort.paceSecPerKm).toBeGreaterThan(effort.contaminated!.paceSecPerKm);
    expect(effort.demotion).toBeNull();

    const raw = findBestEffort(t, d, 400)!;
    const intersecting = segmentsIntersectingWindow(segments, raw);
    expect(intersecting.length).toBeGreaterThan(0);
    for (const seg of intersecting.slice(0, CONTAMINATION_REASON_SEGMENT_CAP)) {
      expect(effort.contaminated!.reason).toContain(seg.metres.toFixed(1));
      expect(effort.contaminated!.reason).toContain(seg.seconds.toFixed(1));
    }
  });
});

describe('computeBestEfforts — archive orchestration', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'best-efforts-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /** A constant-pace (t, d) series long enough to yield a 1k effort. */
  function series(durationForOneKm: number): { t: number[]; d: number[] } {
    // Two-sample series is enough for findBestEffort's interpolation.
    return { t: [0, durationForOneKm], d: [0, 1000] };
  }

  async function writeActivity(
    id: string,
    startDate: string,
    distance = 1000,
    maxSpeed: number | undefined = undefined
  ): Promise<void> {
    await fileStore.writeJson(path.join('activities', `${id}.json`), {
      id,
      type: 'Run',
      start_date: startDate,
      start_date_local: startDate,
      distance,
      moving_time: 300,
      max_speed: maxSpeed,
    });
  }

  async function writeStream(
    id: string,
    durationForOneKm: number,
    distanceSourceOverride?: 'native' | 'geo'
  ): Promise<void> {
    const { t, d } = series(durationForOneKm);
    await fileStore.writeJson(path.join('streams', `${id}.json`), {
      schemaVersion: 1,
      id,
      source: 'fit',
      distanceSource: distanceSourceOverride ?? 'native',
      sampleCount: t.length,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      t,
      d,
    });
  }

  async function writeManifest(manifest: StreamManifest): Promise<void> {
    await fileStore.writeJson('streams/manifest.json', manifest);
  }

  function emptyManifestDoc(): StreamManifest {
    return {
      schemaVersion: 1,
      generated_at: '',
      note: 'test manifest',
      totals: { activities: 0, with_streams: 0, without_streams: 0, by_reason: {} },
      activities: {},
    };
  }

  it('manifest-driven: reads exactly the available entries and reports skippedNoStream for unavailable ones, ignoring extra unlisted stream files', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['a1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['a2'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['a3'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['a4'] = { available: false, reason: 'manual' };
    manifest.activities['a5'] = { available: false, reason: 'no-original' };
    await writeManifest(manifest);

    await writeActivity('a1', '2026-01-01T00:00:00Z');
    await writeStream('a1', 300);
    await writeActivity('a2', '2026-02-01T00:00:00Z');
    await writeStream('a2', 280);
    await writeActivity('a3', '2026-03-01T00:00:00Z');
    await writeStream('a3', 290);

    // Extra unlisted stream file — must be ignored (manifest is the source of truth).
    await writeStream('unlisted', 999);

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    expect(doc.totals.skippedNoStream).toBe(2);
    // activitiesConsidered excludes skippedNoStream entries — it counts only
    // activities for which computation was actually attempted (3 available),
    // not the full manifest size (5).
    expect(doc.totals.activitiesConsidered).toBe(3);
    expect(Object.keys(doc.activities).sort()).toEqual(['a1', 'a2', 'a3']);
  });

  it('a corrupt stream file warns, increments skippedUnreadable, and does not abort the run — other activities still produce efforts', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['good'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['corrupt'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);

    await writeActivity('good', '2026-01-01T00:00:00Z');
    await writeStream('good', 300);

    await writeActivity('corrupt', '2026-01-01T00:00:00Z');
    // Deliberately corrupt (invalid JSON) stream file.
    await fs.mkdir(path.join(tmpDir, 'streams'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'streams', 'corrupt.json'), '{ not valid json', 'utf-8');

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    expect(doc.totals.skippedUnreadable).toBe(1);
    expect(doc.activities['good']).toBeDefined();
    expect(doc.activities['good'].efforts.length).toBeGreaterThan(0);
    expect(doc.activities['corrupt']).toBeUndefined();
  });

  it('an available entry whose activity record is missing under activitiesDir warns and increments skippedUnreadable', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['noactivity'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeStream('noactivity', 300);
    // Deliberately no activities/noactivity.json written.

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    expect(doc.totals.skippedUnreadable).toBe(1);
  });

  it('rankings contains one key per TargetDistanceKey, sorted fastest-first with 1-based rank, empty for unreached distances', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['fast'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['slow'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);

    await writeActivity('fast', '2026-01-01T00:00:00Z');
    await writeStream('fast', 250); // faster 1k
    await writeActivity('slow', '2026-01-02T00:00:00Z');
    await writeStream('slow', 300); // slower 1k

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    for (const key of ['400m', '1k', '1mi', '5k', '10k', 'half', 'marathon']) {
      expect(doc.rankings[key as keyof typeof doc.rankings]).toBeDefined();
    }
    // Neither stream is long enough for 5k+ — those rankings must be empty.
    expect(doc.rankings['5k']).toEqual([]);
    expect(doc.rankings.marathon).toEqual([]);

    expect(doc.rankings['1k'][0].activityId).toBe('fast');
    expect(doc.rankings['1k'][0].rank).toBe(1);
    expect(doc.rankings['1k'][1].activityId).toBe('slow');
    expect(doc.rankings['1k'][1].rank).toBe(2);
  });

  it('wasPRAtTheTime is true on the chronologically first effort and each improvement, false on a slower later effort', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['first'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['improved'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['slower'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);

    await writeActivity('first', '2026-01-01T00:00:00Z');
    await writeStream('first', 300);
    await writeActivity('improved', '2026-02-01T00:00:00Z');
    await writeStream('improved', 280); // faster — new PR
    await writeActivity('slower', '2026-03-01T00:00:00Z');
    await writeStream('slower', 320); // slower — not a PR

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    const firstEffort = doc.activities['first'].efforts.find((e) => e.distance === '1k');
    const improvedEffort = doc.activities['improved'].efforts.find((e) => e.distance === '1k');
    const slowerEffort = doc.activities['slower'].efforts.find((e) => e.distance === '1k');

    expect(firstEffort?.wasPRAtTheTime).toBe(true);
    expect(improvedEffort?.wasPRAtTheTime).toBe(true);
    expect(slowerEffort?.wasPRAtTheTime).toBe(false);
  });

  it("a geo-sourced activity's effort appears in rankings with lowConfidence true — not filtered out of PR contention", async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['geoact'] = {
      available: true,
      source: 'gpx',
      distanceSource: 'geo',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('geoact', '2026-01-01T00:00:00Z');
    await writeStream('geoact', 300, 'geo');

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    expect(doc.rankings['1k'].length).toBe(1);
    expect(doc.rankings['1k'][0].activityId).toBe('geoact');
    expect(doc.rankings['1k'][0].lowConfidence).toBe(true);
  });

  it('a world-record-guard rejection is retained and flagged, not deleted: rejected row AND a demoted effort with guard/reason set', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['implausible'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('implausible', '2026-01-01T00:00:00Z', 21390);
    // Phase 36 note: this fixture was originally an 80 m/s two-segment burst
    // (400m in 5s), which — now that `computeBestEfforts` wires the REAL
    // detector into every run (this plan) — is *structurally* impossible to
    // isolate from `classifyGapsWithSegments`: the 400m world-record ceiling
    // (~9.296 m/s) exceeds `UNRELIABLE_SPEED_LIMIT_MPS` (7.35 m/s,
    // unreliable-segments.ts), so ANY window failing 400m's world-record
    // guard also trips the detector's fast-step classification, taking a
    // different code path (`contaminated`/`'unreliable-segment'`, exercised
    // by the "clean-window search branches" describe block below) rather
    // than this plain absolute-guard one. Redesigned as a single
    // constant-pace pair at 6.2 m/s — deliberately BELOW the detector's own
    // threshold, so `classifyGapsWithSegments` returns zero segments and this
    // fixture exercises Branch 1 (untouched by the clean-window search)
    // exactly as it did before this plan. 6.2 m/s exceeds the HALF
    // marathon's own world-record ceiling (~6.133 m/s) but stays under every
    // shorter distance's own (much higher) ceiling — 400m's is ~9.296 m/s —
    // so only the half-marathon effort is implausible; the 400m effort on
    // the SAME activity, at the SAME constant pace, survives.
    await fileStore.writeJson(path.join('streams', 'implausible.json'), {
      schemaVersion: 1,
      id: 'implausible',
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      t: [0, 3450],
      d: [0, 21390],
    });

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    // The `rejected` row still exists — it is the archive-wide report of
    // which guard fired, not evidence the effort was deleted.
    expect(doc.rejected.length).toBe(1);
    expect(doc.rejected[0]).toMatchObject({ activityId: 'implausible', distance: 'half' });
    expect(doc.rejected[0].reason).toMatch(/exceeds world-record pace/);

    // D-08: the effort is RETAINED in activities[id].efforts, not removed —
    // this is the assertion the old test inverted (it used to assert the
    // demoted effort was ABSENT).
    const demotedHalf = doc.activities['implausible'].efforts.find((e) => e.distance === 'half');
    expect(demotedHalf).toBeDefined();
    expect(demotedHalf!.demotion).not.toBeNull();
    expect(demotedHalf!.demotion!.guard).toBe('world-record');
    expect(demotedHalf!.demotion!.reason).toMatch(/exceeds world-record pace/);
    // Phase 36: this stream carries no detected segment (its single pair's
    // implied speed is under the detector's own threshold), so the
    // clean-window search never engages — `contaminated` stays null exactly
    // as D-05's docblock states for an effort whose raw window never
    // intersected a segment.
    expect(demotedHalf!.contaminated).toBeNull();

    // The plausible 400m effort, at the SAME constant pace, survives untouched.
    const fourHundred = doc.activities['implausible'].efforts.find((e) => e.distance === '400m');
    expect(fourHundred).toBeDefined();
    expect(fourHundred!.demotion).toBeNull();
  });

  it('a max-speed-guard rejection is also retained and flagged with guard "max-speed"', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['maxspeed-implausible'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    // max_speed 3 m/s means the max-speed guard (3 * 1.02 = 3.06 m/s) fires
    // well before the 400m world-record ceiling (~9.30 m/s) would — this
    // isolates the max-speed branch specifically.
    await writeActivity('maxspeed-implausible', '2026-01-01T00:00:00Z', 1000, 3);
    await fileStore.writeJson(path.join('streams', 'maxspeed-implausible.json'), {
      schemaVersion: 1,
      id: 'maxspeed-implausible',
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 3,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      // First 400m in 80s implies 5 m/s — exceeds max_speed*1.02 (3.06 m/s)
      // but not the 400m world-record ceiling. Remaining 600m over 220s
      // (~2.7 m/s) keeps the whole-series 1k window under the max_speed
      // margin too.
      t: [0, 80, 300],
      d: [0, 400, 1000],
    });

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    const demoted400m = doc.activities['maxspeed-implausible'].efforts.find(
      (e) => e.distance === '400m'
    );
    expect(demoted400m).toBeDefined();
    expect(demoted400m!.demotion).not.toBeNull();
    expect(demoted400m!.demotion!.guard).toBe('max-speed');
    expect(demoted400m!.demotion!.reason).toMatch(/exceeds activity max_speed/);
  });

  describe('demoted efforts remain in the efforts array', () => {
    /**
     * Walks `doc.rejected`, and for every row whose reason is not an
     * `unexpected error:` row (those have no corresponding effort — the
     * computation itself threw), asserts a matching `(activityId, distance)`
     * effort exists in `doc.activities[activityId].efforts` with a non-null
     * `demotion`. Returns the list of violations rather than asserting
     * directly, so the SAME helper can be run against both a correct
     * document (expecting zero violations) and a deliberately-mutated one
     * (expecting a violation per demoted effort removed) — a one-directional
     * audit is not evidence.
     */
    function auditNoDemotedEffortRemoved(doc: {
      rejected: { activityId: string; distance: string; reason: string }[];
      activities: Record<string, { efforts: { distance: string; demotion: unknown }[] }>;
    }): string[] {
      const violations: string[] = [];
      for (const row of doc.rejected) {
        if (row.reason.startsWith('unexpected error:')) continue;
        const activity = doc.activities[row.activityId];
        const effort = activity?.efforts.find((e) => e.distance === row.distance);
        if (!effort || effort.demotion == null) {
          violations.push(`${row.activityId} ${row.distance}: no retained, flagged effort found`);
        }
      }
      return violations;
    }

    it('returns zero violations against the freshly computed document, and at least one violation against a delete-mutated copy', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['implausible'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('implausible', '2026-01-01T00:00:00Z', 1000);
      await fileStore.writeJson(path.join('streams', 'implausible.json'), {
        schemaVersion: 1,
        id: 'implausible',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 5, 300],
        d: [0, 400, 1000],
      });

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
      });

      // Direction 1: the audit passes against the correct, freshly computed document.
      expect(auditNoDemotedEffortRemoved(doc)).toEqual([]);

      // Direction 2: demonstrate the audit failing. Build a mutated copy of
      // the same document with every demoted effort spliced OUT of its
      // efforts array — the literal "mutated to delete instead of flag"
      // state ROADMAP criterion 4 names — and assert the audit returns a
      // violation for each.
      const mutated = structuredClone(doc);
      for (const activity of Object.values(mutated.activities)) {
        activity.efforts = activity.efforts.filter((e) => e.demotion == null);
      }
      const violations = auditNoDemotedEffortRemoved(mutated);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.length).toBe(mutated.rejected.filter((r) => !r.reason.startsWith('unexpected error:')).length);
    });
  });

  describe('4556693525', () => {
    it('4556693525 WITHOUT an exclusion entry: 400m ceiling-demoted (non-excluded path)', async () => {
      // D-04: the live pipeline computes 45.2s / 8.85 m/s for activity
      // 4556693525's 400m effort. PR-05 and the original ROADMAP Criterion 3
      // both state 44.0s / 9.09 m/s — that figure matches no record in the
      // live archive and was corrected to 45.2s / 8.85 m/s on 2026-09-10 per
      // D-04; pinning the wrong (44.0/9.09) value would produce a test that
      // fails on day one for the wrong reason.
      const manifest = emptyManifestDoc();

      const BULK_COUNT = 150;
      const bulkIds: string[] = [];
      for (let i = 0; i < BULK_COUNT; i++) {
        const id = `bulk-${i}`;
        bulkIds.push(id);
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      manifest.activities['4556693525'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);

      // Bulk 400m population: 150 ordinary efforts, speeds spanning
      // 3.00-4.11 m/s so the nearest-rank p90 lands near the live
      // calibration's 400m figure (~4.00 m/s, ceiling ~5.11 m/s — see
      // 28-CEILING-CALIBRATION.md "Resulting coverage and demotions"),
      // clearing CEILING_MIN_POPULATION (100).
      for (let i = 0; i < BULK_COUNT; i++) {
        const speed = 3.0 + (i / (BULK_COUNT - 1)) * 1.112;
        const durationSec = round1(400 / speed);
        await writeActivity(bulkIds[i], '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${bulkIds[i]}.json`), {
          schemaVersion: 1,
          id: bulkIds[i],
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      // The pinned activity: 400m in 45.2s (8.85 m/s implied) plus an
      // ordinary 1k effort. max_speed 16.4 means the max-speed guard does
      // NOT fire (16.4 * 1.02 clears 8.85 easily) — only the personal
      // ceiling demotes this effort.
      await writeActivity('4556693525', '2026-01-01T00:00:00Z', 1000, 16.4);
      await fileStore.writeJson(path.join('streams', '4556693525.json'), {
        schemaVersion: 1,
        id: '4556693525',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 45.2, 225.4],
        d: [0, 400, 1000],
      });

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        // Explicit non-existent path (deliberately NOT the default
        // relative 'data/best-effort-exclusions.json'): this test covers
        // the NON-EXCLUDED path only — the activity is not excluded here,
        // so the ceiling demotes it via the ordinary (non-excluded)
        // survivors-loop path. The next test, "4556693525 with its
        // committed-fixture exclusion entry...", covers the real production
        // state, where this exact activity IS excluded (CR-01).
        // `loadExclusions` degrades a missing file to an empty index
        // (T-16-EX-01).
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      // Sanity: the personal ceiling was actually derived (not fail-open)
      // at 400m, confirming the bulk population cleared
      // CEILING_MIN_POPULATION, and it sits well below 8.85 m/s.
      expect(doc.ceilings['400m'].ceilingMps).not.toBeNull();
      expect(doc.ceilings['400m'].ceilingMps!).toBeLessThan(8.85);

      const effort400m = doc.activities['4556693525'].efforts.find((e) => e.distance === '400m');
      expect(effort400m).toBeDefined();
      expect(effort400m!.durationSec).toBe(45.2);
      expect(effort400m!.demotion).not.toBeNull();
      expect(effort400m!.demotion!.guard).toBe('ceiling');

      // The 1k effort is untouched here — not because it is implausible,
      // but because this fixture supplies no 1k bulk population, so the 1k
      // ceiling fails open (D-02) and cannot demote anything. The next
      // test supplies a 1k bulk population and pins the 1k effort's own
      // ceiling demotion.
      const effort1k = doc.activities['4556693525'].efforts.find((e) => e.distance === '1k');
      expect(effort1k).toBeDefined();
      expect(effort1k!.demotion).toBeNull();
    });

    /** A constant-pace (t, d) archive built once per test, shared by Tests A,
     * C and D. The negative control (3475711469) is excluded in the REAL
     * committed exclusions file but its effort is well under the ceiling —
     * proving the sweep does not demote every excluded effort, only the
     * ones that actually exceed it. */
    const BULK_400M_COUNT = 150;
    const BULK_1K_COUNT = 150;
    const NEGATIVE_CONTROL_SPEED_MPS = 3.5;

    // D-01: a committed fixture that copies the real file's two relevant
    // entries verbatim, so the arithmetic assertions below never move when
    // an owner curation edit touches data/best-effort-exclusions.json.
    const fixtureExclusionsPath = fileURLToPath(
      new URL('./__fixtures__/best-effort-exclusions.fixture.json', import.meta.url)
    );

    async function buildPinnedArchive({
      withOneKmBulk,
    }: {
      withOneKmBulk: boolean;
    }): Promise<{
      bulk400Count: number;
      bulk1kCount: number;
      negativeControlDurationSec: number;
    }> {
      const manifest = emptyManifestDoc();

      const bulkIds: string[] = [];
      for (let i = 0; i < BULK_400M_COUNT; i++) {
        const id = `bulk-${i}`;
        bulkIds.push(id);
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }

      const bulk1kIds: string[] = [];
      if (withOneKmBulk) {
        for (let i = 0; i < BULK_1K_COUNT; i++) {
          const id = `bulk1k-${i}`;
          bulk1kIds.push(id);
          manifest.activities[id] = {
            available: true,
            source: 'fit',
            distanceSource: 'native',
            sampleCount: 2,
            channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          };
        }
      }

      manifest.activities['4556693525'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['3475711469'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };

      await writeManifest(manifest);

      // 150 bulk 400m efforts, speeds spanning 3.00-4.112 m/s — matches the
      // fixture already used by the non-excluded-path test above so the
      // derived 400m ceiling sits well below 8.85 m/s.
      for (let i = 0; i < BULK_400M_COUNT; i++) {
        const speed = 3.0 + (i / (BULK_400M_COUNT - 1)) * 1.112;
        const durationSec = round1(400 / speed);
        await writeActivity(bulkIds[i], '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${bulkIds[i]}.json`), {
          schemaVersion: 1,
          id: bulkIds[i],
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      if (withOneKmBulk) {
        // 150 more bulk activities at distance 1000: each ALSO yields a
        // 400m effort via the same constant-pace stream (interpolated
        // crossing), widening the 400m population to 300 while supplying
        // the 1k population needed for the pinned activity's 1k effort to
        // be judged against a real (non-fail-open) ceiling. Speeds
        // 2.9-3.8 m/s give a nearest-rank p90 around 3.709 m/s -> a 1k
        // ceiling around 4.75 m/s, below the pinned effort's 4.8216 m/s
        // (207.4s).
        for (let i = 0; i < BULK_1K_COUNT; i++) {
          const speed = 2.9 + (i / (BULK_1K_COUNT - 1)) * 0.9;
          const durationSec = round1(1000 / speed);
          await writeActivity(bulk1kIds[i], '2020-06-01T00:00:00Z', 1000);
          await fileStore.writeJson(path.join('streams', `${bulk1kIds[i]}.json`), {
            schemaVersion: 1,
            id: bulk1kIds[i],
            source: 'fit',
            distanceSource: 'native',
            sampleCount: 2,
            channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
            t: [0, durationSec],
            d: [0, 1000],
          });
        }
      }

      // The pinned activity: 400m in 45.2s (8.85 m/s implied), 1k in
      // 207.4s (4.82 m/s implied). max_speed 16.4 means the max-speed
      // guard does NOT fire at either distance (16.4 * 1.02 clears both
      // easily) — only the personal ceiling can demote these.
      await writeActivity('4556693525', '2026-01-01T00:00:00Z', 1000, 16.4);
      await fileStore.writeJson(path.join('streams', '4556693525.json'), {
        schemaVersion: 1,
        id: '4556693525',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 45.2, 207.4],
        d: [0, 400, 1000],
      });

      // The negative control: also present in the REAL exclusions file,
      // but its 400m effort is well under the ceiling.
      const negativeControlDurationSec = round1(400 / NEGATIVE_CONTROL_SPEED_MPS);
      await writeActivity('3475711469', '2021-01-01T00:00:00Z', 400);
      await fileStore.writeJson(path.join('streams', '3475711469.json'), {
        schemaVersion: 1,
        id: '3475711469',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, negativeControlDurationSec],
        d: [0, 400],
      });

      return {
        bulk400Count: BULK_400M_COUNT,
        bulk1kCount: withOneKmBulk ? BULK_1K_COUNT : 0,
        negativeControlDurationSec,
      };
    }

    /** The shape of data/best-effort-exclusions.json (and its committed
     * fixture copy) that checkExclusionPremise reads. */
    interface ExclusionsDocument {
      exclusions: Array<{ activityId: string; distances: string[] | null; reason: string }>;
    }

    /**
     * D-01/D-02: the ONE thing a curation edit to
     * data/best-effort-exclusions.json is still allowed to break — whether
     * 4556693525 remains excluded all-distance, the premise the four CR-01
     * fixture-backed tests above assume. `ok: false`'s message must be
     * actionable in one minute: it names the entry, the live file, the
     * committed fixture to re-pin, and this test file. Deliberately no
     * conditional bypass of any kind — a red nightly is the intended
     * behaviour when the premise fails.
     */
    function checkExclusionPremise(doc: ExclusionsDocument): { ok: boolean; message: string } {
      const entry = doc.exclusions.find((e) => e.activityId === '4556693525');
      if (entry !== undefined && entry.distances === null) {
        return { ok: true, message: '' };
      }
      return {
        ok: false,
        message:
          '4556693525 is no longer excluded all-distance in data/best-effort-exclusions.json; ' +
          'if intentional, update src/analytics/__fixtures__/best-effort-exclusions.fixture.json ' +
          'and the premise in src/analytics/compute-best-efforts.test.ts',
      };
    }

    it("4556693525's REAL committed exclusion entry satisfies the CR-01 premise", async () => {
      // The ONLY test in this file that reads the live,
      // owner-editable data/best-effort-exclusions.json — and it asserts
      // no arithmetic (D-01). It must NOT call computeBestEfforts.
      const realExclusionsPath = fileURLToPath(
        new URL('../../data/best-effort-exclusions.json', import.meta.url)
      );
      const realExclusionsRaw = await fs.readFile(realExclusionsPath, 'utf-8');
      const realExclusionsDoc = JSON.parse(realExclusionsRaw) as ExclusionsDocument;
      const result = checkExclusionPremise(realExclusionsDoc);
      expect(result.ok, result.message).toBe(true);
    });

    it('checkExclusionPremise message names the entry, the real file, the fixture and the test (premise message test)', () => {
      const requiredSubstrings = [
        '4556693525',
        'data/best-effort-exclusions.json',
        'best-effort-exclusions.fixture.json',
        'compute-best-efforts.test.ts',
      ];

      const entryAbsent: ExclusionsDocument = { exclusions: [] };
      const absentResult = checkExclusionPremise(entryAbsent);
      expect(absentResult.ok).toBe(false);
      for (const substring of requiredSubstrings) {
        expect(absentResult.message).toContain(substring);
      }

      const entryWrongShape: ExclusionsDocument = {
        exclusions: [{ activityId: '4556693525', distances: ['400m'], reason: 'test' }],
      };
      const wrongShapeResult = checkExclusionPremise(entryWrongShape);
      expect(wrongShapeResult.ok).toBe(false);
      for (const substring of requiredSubstrings) {
        expect(wrongShapeResult.message).toContain(substring);
      }
    });

    it('4556693525 with its committed-fixture exclusion entry is ceiling-demoted at 400m and 1k', async () => {
      // D-01: this test's premise (the entry must exist and be
      // all-distance) is checked by the standalone "REAL committed
      // exclusion ... premise" test below, which is the ONLY test in this
      // file that still reads data/best-effort-exclusions.json. All
      // arithmetic here runs against the committed fixture, so a curation
      // edit to unrelated entries in the live file cannot move any number
      // this test asserts.
      const { negativeControlDurationSec } = await buildPinnedArchive({ withOneKmBulk: true });

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath: fixtureExclusionsPath,
      });

      // Preconditions — the assertions below cannot pass vacuously.
      expect(doc.ceilings['400m'].ceilingMps).not.toBeNull();
      expect(doc.ceilings['400m'].ceilingMps!).toBeLessThan(400 / 45.2);
      expect(doc.ceilings['1k'].ceilingMps).not.toBeNull();
      expect(doc.ceilings['1k'].ceilingMps!).toBeLessThan(1000 / 207.4);
      expect(400 / negativeControlDurationSec).toBeLessThan(doc.ceilings['400m'].ceilingMps!);

      const effort400m = doc.activities['4556693525'].efforts.find((e) => e.distance === '400m');
      expect(effort400m).toBeDefined();
      expect(effort400m!.durationSec).toBe(45.2);
      expect(effort400m!.excludedFromRecords).toBe(true);
      expect(effort400m!.demotion).not.toBeNull();
      expect(effort400m!.demotion!.guard).toBe('ceiling');
      expect(effort400m!.demotion!.reason).toMatch(/exceeds personal ceiling/);
      expect(effort400m!.wasPRAtTheTime).toBe(false);

      const effort1k = doc.activities['4556693525'].efforts.find((e) => e.distance === '1k');
      expect(effort1k).toBeDefined();
      expect(effort1k!.excludedFromRecords).toBe(true);
      expect(effort1k!.demotion).not.toBeNull();
      expect(effort1k!.demotion!.guard).toBe('ceiling');
      expect(effort1k!.demotion!.reason).toMatch(/exceeds personal ceiling/);
      expect(effort1k!.wasPRAtTheTime).toBe(false);

      expect(
        doc.rejected.some((r) => r.activityId === '4556693525' && r.distance === '400m')
      ).toBe(true);
      expect(
        doc.rejected.some((r) => r.activityId === '4556693525' && r.distance === '1k')
      ).toBe(true);

      expect(doc.rankings['400m'].some((r) => r.activityId === '4556693525')).toBe(false);
      expect(doc.rankings['1k'].some((r) => r.activityId === '4556693525')).toBe(false);

      // Negative control: excluded, under the ceiling, no ceiling demotion
      // — the sweep does not demote every excluded effort.
      const negEffort = doc.activities['3475711469'].efforts.find((e) => e.distance === '400m');
      expect(negEffort).toBeDefined();
      expect(negEffort!.excludedFromRecords).toBe(true);
      expect(negEffort!.demotion).toBeNull();
    });

    it('an excluded activity whose effort beats the world record keeps its world-record demotion, not the ceiling', async () => {
      const manifest = emptyManifestDoc();
      const BULK_COUNT = 150;
      const bulkIds: string[] = [];
      for (let i = 0; i < BULK_COUNT; i++) {
        const id = `bulk-${i}`;
        bulkIds.push(id);
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      manifest.activities['wr-excluded'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);

      for (let i = 0; i < BULK_COUNT; i++) {
        const speed = 3.0 + (i / (BULK_COUNT - 1)) * 1.112;
        const durationSec = round1(400 / speed);
        await writeActivity(bulkIds[i], '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${bulkIds[i]}.json`), {
          schemaVersion: 1,
          id: bulkIds[i],
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      // wr-excluded: 400m in 14.6s (27.4 m/s implied), well past the 400m
      // world-record guard (9.296 m/s) — mirrors live 3475725513@400m.
      await writeActivity('wr-excluded', '2019-01-01T00:00:00Z', 400, 30);
      await fileStore.writeJson(path.join('streams', 'wr-excluded.json'), {
        schemaVersion: 1,
        id: 'wr-excluded',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 14.6],
        d: [0, 400],
      });

      const exclusionsPath = path.join(tmpDir, 'wr-excluded-exclusions.json');
      await fileStore.writeJson('wr-excluded-exclusions.json', {
        schemaVersion: 1,
        note: 'test',
        exclusions: [
          { activityId: 'wr-excluded', distances: null, reason: 'implausible device speed' },
        ],
      });

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath,
      });

      const effort = doc.activities['wr-excluded'].efforts.find((e) => e.distance === '400m');
      expect(effort).toBeDefined();
      expect(effort!.excludedFromRecords).toBe(true);
      expect(effort!.demotion).not.toBeNull();
      expect(effort!.demotion!.guard).toBe('world-record');

      const rejectedRows = doc.rejected.filter(
        (r) => r.activityId === 'wr-excluded' && r.distance === '400m'
      );
      expect(rejectedRows.length).toBe(1);
    });

    it('excluded efforts never feed the ceiling derivation, with or without the committed exclusions fixture', async () => {
      const { bulk400Count, bulk1kCount } = await buildPinnedArchive({ withOneKmBulk: true });
      const base400 = bulk400Count + bulk1kCount; // bulk1k activities also yield a 400m effort
      const base1k = bulk1kCount;

      const withRealExclusions = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-real'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state-real.json'),
        exclusionsPath: fixtureExclusionsPath,
      });

      const withMissingExclusions = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-missing'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state-missing.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      // The fixture excludes 4556693525 (400m + 1k) and 3475711469
      // (all-distance, but under the 400m ceiling — see the negative
      // control above), so the with-fixture run's population is exactly
      // the bulk count; the missing-exclusions run additionally admits
      // both excluded fixture activities into byDistance.
      expect(withRealExclusions.ceilings['400m'].populationN).toBe(base400);
      expect(withMissingExclusions.ceilings['400m'].populationN).toBe(base400 + 2);
      expect(withRealExclusions.ceilings['1k'].populationN).toBe(base1k);
      expect(withMissingExclusions.ceilings['1k'].populationN).toBe(base1k + 1);
    });

    it('two runs of the real-exclusion fixture produce byte-identical documents apart from generatedAt', async () => {
      await buildPinnedArchive({ withOneKmBulk: true });

      const baseOptions = {
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        exclusionsPath: fixtureExclusionsPath,
      };

      const doc1 = await computeBestEfforts({
        ...baseOptions,
        statsDir: path.join(tmpDir, 'stats-run1'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state-run1.json'),
      });
      const doc2 = await computeBestEfforts({
        ...baseOptions,
        statsDir: path.join(tmpDir, 'stats-run2'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state-run2.json'),
      });

      const strip = (doc: typeof doc1): Omit<typeof doc1, 'generatedAt'> => {
        const { generatedAt: _generatedAt, ...rest } = structuredClone(doc);
        return rest;
      };

      expect(JSON.stringify(strip(doc1))).toBe(JSON.stringify(strip(doc2)));
    });

    it('totals.effortsDemoted and totals.effortsRejected count the two new ceiling demotions; totals.effortsExcluded is unaffected by the fix', async () => {
      await buildPinnedArchive({ withOneKmBulk: true });

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath: fixtureExclusionsPath,
      });

      // The fixture's only excluded activities are 4556693525 (400m + 1k =
      // 2 efforts) and 3475711469 (all-distance = 1 effort here, since this
      // archive only builds its 400m stream) — 3 excluded efforts total.
      // This count is unaffected by CR-01's fix since exclusion is
      // determined in Pass 1, before the new excluded-effort sweep runs.
      expect(doc.totals.effortsExcluded).toBe(3);

      // The only demotions in this fixture are the two new ceiling
      // demotions on the excluded pinned activity's 400m and 1k efforts —
      // no bulk activity and no other excluded activity exceeds its
      // ceiling.
      expect(doc.totals.effortsDemoted).toBe(2);
      expect(doc.totals.effortsRejected).toBe(2);
    });

    it('mutating a fixture copy (never the committed fixture itself) changes the 1k demotion — the D-03 proof the fixture is not a silent second source of truth', async () => {
      // D-03: this test never writes to
      // src/analytics/__fixtures__/best-effort-exclusions.fixture.json and
      // never writes to data/best-effort-exclusions.json — both copies
      // below live only under this test's own tmpDir, cleaned up by the
      // existing afterEach teardown.
      await buildPinnedArchive({ withOneKmBulk: true });

      const fixtureRaw = await fs.readFile(fixtureExclusionsPath, 'utf-8');
      const fixtureDoc = JSON.parse(fixtureRaw) as {
        schemaVersion: number;
        note: string;
        exclusions: Array<{ activityId: string; distances: string[] | null; reason: string }>;
      };

      // Copy 1: byte-for-byte the same parsed document, unchanged.
      await fileStore.writeJson('fixture-copy-unchanged.json', fixtureDoc);

      // Copy 2: the SAME document with 4556693525's `distances` narrowed
      // from `null` (all-distance) to `['400m']` — no longer excluding its
      // 1k effort.
      const mutatedDoc = structuredClone(fixtureDoc);
      const mutatedEntry = mutatedDoc.exclusions.find((e) => e.activityId === '4556693525');
      expect(mutatedEntry).toBeDefined();
      mutatedEntry!.distances = ['400m'];
      await fileStore.writeJson('fixture-copy-mutated.json', mutatedDoc);

      const unchangedDoc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-unchanged'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state-unchanged.json'),
        exclusionsPath: path.join(tmpDir, 'fixture-copy-unchanged.json'),
      });
      const mutatedResultDoc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-mutated'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state-mutated.json'),
        exclusionsPath: path.join(tmpDir, 'fixture-copy-mutated.json'),
      });

      // The discriminating pair, asserted in BOTH directions so this test
      // cannot pass vacuously: against the unchanged copy the 1k effort is
      // still excluded (matches Task 1's fixture-backed assertions above);
      // against the mutated copy — no longer excluded all-distance — the
      // 1k effort is no longer excludedFromRecords. A silent edit to the
      // committed fixture would therefore change this assertion rather
      // than sliding through unnoticed.
      const unchangedEffort1k = unchangedDoc.activities['4556693525'].efforts.find(
        (e) => e.distance === '1k'
      );
      expect(unchangedEffort1k).toBeDefined();
      expect(unchangedEffort1k!.excludedFromRecords).toBe(true);

      const mutatedEffort1k = mutatedResultDoc.activities['4556693525'].efforts.find(
        (e) => e.distance === '1k'
      );
      expect(mutatedEffort1k).toBeDefined();
      expect(mutatedEffort1k!.excludedFromRecords).toBe(false);
    });
  });

  it('totals are internally consistent: effortsComputed and lowConfidenceEfforts match the activities data', async () => {
    const manifest = emptyManifestDoc();
    manifest.activities['x1'] = {
      available: true,
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    manifest.activities['x2'] = {
      available: true,
      source: 'gpx',
      distanceSource: 'geo',
      sampleCount: 2,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
    };
    await writeManifest(manifest);
    await writeActivity('x1', '2026-01-01T00:00:00Z');
    await writeStream('x1', 300);
    await writeActivity('x2', '2026-01-02T00:00:00Z');
    await writeStream('x2', 310, 'geo');

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    const sumEfforts = Object.values(doc.activities).reduce((sum, a) => sum + a.efforts.length, 0);
    const sumLowConfidence = Object.values(doc.activities).reduce(
      (sum, a) => sum + a.efforts.filter((e) => e.lowConfidence).length,
      0
    );
    expect(doc.totals.effortsComputed).toBe(sumEfforts);
    expect(doc.totals.lowConfidenceEfforts).toBe(sumLowConfidence);
  });

  it('writes best-efforts.json to <statsDir>, parses as JSON, with schemaVersion 1 and a non-empty ISO generatedAt', async () => {
    const manifest = emptyManifestDoc();
    await writeManifest(manifest);

    const statsDir = path.join(tmpDir, 'stats');
    await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir,
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    const written = await fs.readFile(path.join(statsDir, 'best-efforts.json'), 'utf-8');
    const parsed = JSON.parse(written);
    expect(parsed.schemaVersion).toBe(1);
    expect(typeof parsed.generatedAt).toBe('string');
    expect(parsed.generatedAt.length).toBeGreaterThan(0);
    expect(() => new Date(parsed.generatedAt).toISOString()).not.toThrow();
  });

  it('a run over an empty manifest writes a valid document with zero totals rather than throwing', async () => {
    const manifest = emptyManifestDoc();
    await writeManifest(manifest);

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
    });

    expect(doc.totals.activitiesConsidered).toBe(0);
    expect(doc.totals.effortsComputed).toBe(0);
    expect(doc.totals.skippedNoStream).toBe(0);
    expect(doc.totals.skippedUnreadable).toBe(0);
    expect(Object.keys(doc.activities)).toEqual([]);
  });

  describe('exclusions', () => {
    async function writeExclusions(
      exclusions: Array<{ activityId: string; distances: string[] | null; reason: string }>
    ): Promise<string> {
      const exclusionsPath = path.join(tmpDir, 'best-effort-exclusions.json');
      await fileStore.writeJson('best-effort-exclusions.json', {
        schemaVersion: 1,
        note: 'test',
        exclusions,
      });
      return exclusionsPath;
    }

    it('with two activities where the faster one is excluded (all distances), rankings[1k][0] is the slower, non-excluded activity', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['fast-excluded'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['slow'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('fast-excluded', '2026-01-01T00:00:00Z');
      await writeStream('fast-excluded', 250); // faster 1k, but excluded
      await writeActivity('slow', '2026-01-02T00:00:00Z');
      await writeStream('slow', 300); // slower 1k

      const exclusionsPath = await writeExclusions([
        { activityId: 'fast-excluded', distances: null, reason: 'bad gps device' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath,
      });

      expect(doc.rankings['1k'][0].activityId).toBe('slow');
    });

    it('an excluded activity is still present in activities, with excludedFromRecords true on every effort and the activity, and wasPRAtTheTime false', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['excluded-act'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('excluded-act', '2026-01-01T00:00:00Z');
      await writeStream('excluded-act', 300);

      const exclusionsPath = await writeExclusions([
        { activityId: 'excluded-act', distances: null, reason: 'bad gps device' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath,
      });

      const activity = doc.activities['excluded-act'];
      expect(activity).toBeDefined();
      expect(activity.efforts.length).toBeGreaterThan(0);
      expect(activity.excludedFromRecords).toBe(true);
      for (const effort of activity.efforts) {
        expect(effort.excludedFromRecords).toBe(true);
        expect(effort.wasPRAtTheTime).toBe(false);
      }
    });

    it('totals.effortsExcluded equals the excluded activity effort count, and effortsComputed still counts them', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['excluded-act'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      manifest.activities['normal-act'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('excluded-act', '2026-01-01T00:00:00Z');
      await writeStream('excluded-act', 300);
      await writeActivity('normal-act', '2026-01-02T00:00:00Z');
      await writeStream('normal-act', 310);

      const exclusionsPath = await writeExclusions([
        { activityId: 'excluded-act', distances: null, reason: 'bad gps device' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath,
      });

      const excludedEffortCount = doc.activities['excluded-act'].efforts.length;
      expect(doc.totals.effortsExcluded).toBe(excludedEffortCount);
      const sumEfforts = Object.values(doc.activities).reduce((sum, a) => sum + a.efforts.length, 0);
      expect(doc.totals.effortsComputed).toBe(sumEfforts);
    });

    it('a per-distance exclusion removes the activity from that rankings entry but leaves it ranked elsewhere', async () => {
      // Build a series long enough for both 1k and 5k.
      const t: number[] = [0, 250, 1300];
      const d: number[] = [0, 1000, 5000];

      const manifest = emptyManifestDoc();
      manifest.activities['partial-excluded'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);

      await fileStore.writeJson(path.join('activities', 'partial-excluded.json'), {
        id: 'partial-excluded',
        type: 'Run',
        start_date: '2026-01-01T00:00:00Z',
        start_date_local: '2026-01-01T00:00:00Z',
        distance: 5000,
        moving_time: 1300,
        max_speed: undefined,
      });
      await fileStore.writeJson(path.join('streams', 'partial-excluded.json'), {
        schemaVersion: 1,
        id: 'partial-excluded',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: t.length,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t,
        d,
      });

      const exclusionsPath = await writeExclusions([
        { activityId: 'partial-excluded', distances: ['1k'], reason: 'bad gps device for 1k only' },
      ]);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath,
      });

      expect(doc.rankings['1k'].some((r) => r.activityId === 'partial-excluded')).toBe(false);
      expect(doc.rankings['5k'].some((r) => r.activityId === 'partial-excluded')).toBe(true);
    });
  });

  describe('deterministic across two runs', () => {
    /** Writes 120 clean 400m efforts plus one world-record-demoted 400m effort (and its ordinary 1k sibling), returning the activity ids in write order. */
    async function writeFixtureFiles(): Promise<string[]> {
      const bulkCount = 120;
      const ids: string[] = [];
      for (let i = 0; i < bulkCount; i++) {
        const id = `bulk-${i}`;
        ids.push(id);
        const speed = 3.0 + (i / (bulkCount - 1)) * 1.0; // 3.0-4.0 m/s
        const durationSec = round1(400 / speed);
        await writeActivity(id, '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }
      ids.push('implausible-det');
      await writeActivity('implausible-det', '2026-01-01T00:00:00Z', 1000);
      await fileStore.writeJson(path.join('streams', 'implausible-det.json'), {
        schemaVersion: 1,
        id: 'implausible-det',
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 3,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, 5, 300],
        d: [0, 400, 1000],
      });
      return ids;
    }

    async function writeManifestWithOrder(ids: string[]): Promise<void> {
      const manifest = emptyManifestDoc();
      for (const id of ids) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: id === 'implausible-det' ? 3 : 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);
    }

    /** The full `(activityId, distance) -> {demotion, wasPRAtTheTime}` projection of a document. */
    function projection(
      doc: Awaited<ReturnType<typeof computeBestEfforts>>
    ): Record<string, { demotion: unknown; wasPRAtTheTime: boolean }> {
      const result: Record<string, { demotion: unknown; wasPRAtTheTime: boolean }> = {};
      for (const [id, activity] of Object.entries(doc.activities)) {
        for (const effort of activity.efforts) {
          result[`${id}:${effort.distance}`] = {
            demotion: effort.demotion,
            wasPRAtTheTime: effort.wasPRAtTheTime,
          };
        }
      }
      return result;
    }

    it('running twice against unchanged input produces identical ceilings and an identical (activityId, distance) -> {demotion, wasPRAtTheTime} projection', async () => {
      const ids = await writeFixtureFiles();
      await writeManifestWithOrder(ids);

      const common = {
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
      };

      const doc1 = await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats1') });
      const doc2 = await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats2') });

      // `generatedAt` is excluded from the comparison — it is a wall-clock
      // stamp, and criterion 1 asks for byte-identical CEILING VALUES AND
      // FLAGS, not a byte-identical file.
      expect(JSON.stringify(doc1.ceilings)).toBe(JSON.stringify(doc2.ceilings));
      expect(projection(doc1)).toEqual(projection(doc2));
    });

    it('order-independence at the orchestration level: reversed manifest entry order produces identical ceilings', async () => {
      const ids = await writeFixtureFiles();

      await writeManifestWithOrder(ids);
      const docForward = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-forward'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      await writeManifestWithOrder([...ids].reverse());
      const docReversed = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats-reversed'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      expect(JSON.stringify(docForward.ceilings)).toBe(JSON.stringify(docReversed.ceilings));
    });
  });

  describe('no iteration to convergence', () => {
    /**
     * The WRONG variant PR-01 forbids, implemented here in the test file
     * only: calls `deriveCeilings`, removes every entry the resulting
     * ceilings demote, re-derives from the survivors, and repeats until the
     * ceilings stop moving or a fixed iteration cap is reached.
     */
    function iterateToConvergence(
      populationsByDistance: ReadonlyMap<TargetDistanceKey, readonly number[]>,
      maxIterations = 25
    ): Record<TargetDistanceKey, CeilingDerivation> {
      let current = new Map<TargetDistanceKey, readonly number[]>(populationsByDistance);
      let ceilings = deriveCeilings(current);
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let anyRemoved = false;
        const next = new Map<TargetDistanceKey, readonly number[]>();
        for (const key of TARGET_ORDER) {
          const derivation = ceilings[key];
          const population = current.get(key) ?? [];
          const survivors = population.filter((speed) => ceilingDemotion(speed, derivation) === null);
          if (survivors.length !== population.length) anyRemoved = true;
          next.set(key, survivors);
        }
        if (!anyRemoved) break;
        current = next;
        ceilings = deriveCeilings(current);
      }
      return ceilings;
    }

    /** Clean bulk (100 @ 3.5 m/s) plus an 18-entry contaminated tail (5.0-9.0 m/s, all under the 400m world-record ceiling ~9.296 m/s) — a fixture whose 400m population carries a contaminated tail. */
    function contaminatedPopulation(): Map<TargetDistanceKey, number[]> {
      const clean = Array.from({ length: 100 }, () => 3.5);
      const contaminated = Array.from({ length: 18 }, (_, i) => 5.0 + (i / 17) * 4.0);
      const populations = new Map<TargetDistanceKey, number[]>();
      for (const key of TARGET_ORDER) {
        populations.set(key, key === '400m' ? [...clean, ...contaminated] : []);
      }
      return populations;
    }

    it('the iterated result strictly diverges from the single-pass result (lower ceiling, strictly larger demoted set at 400m), and the shipped document matches the single-pass value', async () => {
      const populations = contaminatedPopulation();

      // Divergence must be proven BEFORE anything else — if the two methods
      // ever coincide on this fixture, the fixture is too weak and must be
      // strengthened until they diverge.
      const singlePass = deriveCeilings(populations);
      const iterated = iterateToConvergence(populations);

      const singlePassCeiling = singlePass['400m'].ceilingMps;
      const iteratedCeiling = iterated['400m'].ceilingMps;
      expect(singlePassCeiling).not.toBeNull();
      expect(iteratedCeiling).not.toBeNull();
      expect(iteratedCeiling!).toBeLessThan(singlePassCeiling!);

      const population400m = populations.get('400m')!;
      const singlePassDemoted = population400m.filter(
        (speed) => ceilingDemotion(speed, singlePass['400m']) !== null
      ).length;
      const iteratedDemoted = population400m.filter(
        (speed) => ceilingDemotion(speed, iterated['400m']) !== null
      ).length;
      expect(iteratedDemoted).toBeGreaterThan(singlePassDemoted);

      // Now run the SAME population through the real archive orchestration
      // (each population entry becomes its own single-effort activity) and
      // confirm the shipped document matches the single-pass value, never
      // the iterated one.
      const manifest = emptyManifestDoc();
      const ids = population400m.map((_, i) => `pop-${i}`);
      for (const id of ids) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);
      for (let i = 0; i < population400m.length; i++) {
        const durationSec = round1(400 / population400m[i]);
        await writeActivity(ids[i], '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${ids[i]}.json`), {
          schemaVersion: 1,
          id: ids[i],
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      // The recomputed implied speed inside compute-best-efforts.ts derives
      // from a ROUNDED durationSec (round1), so a small tolerance is used
      // rather than bit-exact equality against our own unrounded design
      // values.
      expect(doc.ceilings['400m'].ceilingMps).not.toBeNull();
      expect(doc.ceilings['400m'].ceilingMps!).toBeCloseTo(singlePassCeiling!, 1);
      expect(
        Math.abs(doc.ceilings['400m'].ceilingMps! - iteratedCeiling!)
      ).toBeGreaterThan(0.5);
    });

    it("the production file's single deriveCeilings call site sits between the derive pass's own marker and the next pass's marker, with no enclosing loop", async () => {
      const source = await fs.readFile(
        new URL('./compute-best-efforts.ts', import.meta.url),
        'utf-8'
      );
      const pass2Index = source.indexOf('PASS 2');
      const pass3Index = source.indexOf('PASS 3');
      expect(pass2Index).toBeGreaterThan(-1);
      expect(pass3Index).toBeGreaterThan(pass2Index);

      const rawSlice = source.slice(pass2Index, pass3Index);
      const strippedSlice = rawSlice
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');
      expect(strippedSlice).toContain('deriveCeilings(');
      expect(strippedSlice).not.toMatch(/\bfor\s*\(/);
      expect(strippedSlice).not.toMatch(/\bwhile\s*\(/);
    });
  });

  describe('ceiling is non-circular', () => {
    it('the shipped ceiling matches the population filtered by the absolute guard + exclusion list, not the unfiltered raw sweep — divergence, then equality-with-filtered, then populationN equality, in that order', async () => {
      // Independent, in-test candidates over two populations that MUST
      // diverge for this fixture to mean anything:
      const CLEAN_COUNT = 100; // exactly CEILING_MIN_POPULATION once filtered
      const cleanSpeeds = Array.from({ length: CLEAN_COUNT }, () => 3.5);
      const excludedSpeed = 3.6; // ordinary pace, but excluded by activity id
      const guardFailingSpeeds = Array.from({ length: 15 }, (_, i) => 15 + (i / 14) * 9); // 15-24 m/s

      const filteredCandidate = new Map<TargetDistanceKey, number[]>();
      const unfilteredCandidate = new Map<TargetDistanceKey, number[]>();
      for (const key of TARGET_ORDER) {
        filteredCandidate.set(key, key === '400m' ? [...cleanSpeeds] : []);
        unfilteredCandidate.set(
          key,
          key === '400m' ? [...cleanSpeeds, excludedSpeed, ...guardFailingSpeeds] : []
        );
      }

      const filteredResult = deriveCeilings(filteredCandidate);
      const unfilteredResult = deriveCeilings(unfilteredCandidate);

      // 1. Divergence — the fixture actually discriminates.
      expect(filteredResult['400m'].ceilingMps).not.toBeNull();
      expect(unfilteredResult['400m'].ceilingMps).not.toBeNull();
      expect(filteredResult['400m'].ceilingMps).not.toBe(unfilteredResult['400m'].ceilingMps);

      // Build the matching real archive fixture: 100 clean 400m efforts, 15
      // guard-failing 400m efforts (world-record guard fires at 15-24 m/s,
      // well past the 400m ceiling of ~9.296 m/s), and 1 excluded 400m
      // effort at an otherwise-ordinary pace.
      const manifest = emptyManifestDoc();
      const cleanIds = cleanSpeeds.map((_, i) => `nc-clean-${i}`);
      const guardIds = guardFailingSpeeds.map((_, i) => `nc-guard-${i}`);
      const excludedId = 'nc-excluded';
      for (const id of [...cleanIds, ...guardIds, excludedId]) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);

      async function writeSingle400m(id: string, speed: number): Promise<void> {
        const durationSec = round1(400 / speed);
        await writeActivity(id, '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      for (let i = 0; i < cleanIds.length; i++) await writeSingle400m(cleanIds[i], cleanSpeeds[i]);
      for (let i = 0; i < guardIds.length; i++) await writeSingle400m(guardIds[i], guardFailingSpeeds[i]);
      await writeSingle400m(excludedId, excludedSpeed);

      await fileStore.writeJson('nc-exclusions.json', {
        schemaVersion: 1,
        note: 'test',
        exclusions: [{ activityId: excludedId, distances: null, reason: 'non-circularity fixture' }],
      });
      const exclusionsPath = path.join(tmpDir, 'nc-exclusions.json');

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath,
      });

      // 2. Equality with the FILTERED candidate, not the unfiltered one.
      expect(doc.ceilings['400m'].ceilingMps).toBeCloseTo(filteredResult['400m'].ceilingMps!, 2);
      expect(doc.ceilings['400m'].ceilingMps).not.toBeCloseTo(unfilteredResult['400m'].ceilingMps!, 0);

      // 3. `populationN` itself testifies to which population was used.
      expect(doc.ceilings['400m'].populationN).toBe(CLEAN_COUNT);
    });
  });

  describe("ceiling population (D-14): contaminated timings never enter the ceiling's p90 population", () => {
    it('divergence first: two hand-built deriveCeilings candidates (clean-only vs raw-included) diverge; the shipped 400m ceiling equals the CLEAN candidate, not the RAW one, and populationN=120 testifies every contaminated activity contributed its clean figure', async () => {
      const CLEAN_COUNT = 100;
      const CLEAN_SPEED_MPS = 3.5;
      const CONTAM_COUNT = 20;
      // The SLOW hand-chosen pace of the genuine clean sub-interval each
      // contaminated activity's stream carries, UNIFORMLY from just after
      // the fabricated burst to the end of its stream — so the bounded
      // clean-window search finds exactly this value, never a blend with
      // the burst.
      const CONTAM_CLEAN_SPEED_MPS = 2.5;
      // The UNBOUNDED sweep's fastest 400m window's own average speed —
      // guard-passing (strictly below WORLD_RECORD_SPEED_MPS['400m'],
      // ~9.296 m/s, and below the fixture's own max_speed, 20 m/s, set
      // below), yet clearly faster than the clean pace — so this fixture
      // does not rely on an absolute guard to do the ceiling's job.
      const RAW_TARGET_SPEED_MPS = 7.0;
      const BURST_DURATION_SEC = 1;

      // Arithmetic (stated, not hidden): the raw window's own duration is
      // 400 / RAW_TARGET_SPEED_MPS; the burst contributes BURST_DURATION_SEC
      // of that; the remainder is covered entirely at CONTAM_CLEAN_SPEED_MPS
      // (uniform from the burst onward), so:
      const rawDurationSec = 400 / RAW_TARGET_SPEED_MPS; // ~57.142857s
      const tailDurationForRawSec = rawDurationSec - BURST_DURATION_SEC; // ~56.142857s
      const tailMetresForRaw = tailDurationForRawSec * CONTAM_CLEAN_SPEED_MPS; // ~140.357m
      const burstMetres = 400 - tailMetresForRaw; // ~259.6m in 1s — a huge, clearly-flagged burst
      expect(RAW_TARGET_SPEED_MPS).toBeLessThan(WORLD_RECORD_SPEED_MPS['400m']);

      const CONTAM_MAX_SPEED_MPS = 20; // comfortably above RAW_TARGET_SPEED_MPS
      expect(RAW_TARGET_SPEED_MPS).toBeLessThan(CONTAM_MAX_SPEED_MPS);

      const STEP_SEC = 10; // <= the 10s recording-gap threshold — never classified as a recording gap
      const STEP_METRES = STEP_SEC * CONTAM_CLEAN_SPEED_MPS;
      const TAIL_STEPS = 20; // 200s / 500m of uniform clean tail — enough for one full 400m clean sub-interval

      const manifest = emptyManifestDoc();
      const cleanIds = Array.from({ length: CLEAN_COUNT }, (_, i) => `d14-clean-${i}`);
      const contamIds = Array.from({ length: CONTAM_COUNT }, (_, i) => `d14-contam-${i}`);
      for (const id of cleanIds) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      for (const id of contamIds) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: TAIL_STEPS + 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);

      async function writeClean400m(id: string, speed: number): Promise<void> {
        const durationSec = round1(400 / speed);
        await writeActivity(id, '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      async function writeContaminated400m(id: string): Promise<{ t: number[]; d: number[] }> {
        const t = [0, BURST_DURATION_SEC];
        const d = [0, burstMetres];
        for (let i = 1; i <= TAIL_STEPS; i++) {
          t.push(BURST_DURATION_SEC + i * STEP_SEC);
          d.push(burstMetres + i * STEP_METRES);
        }
        await writeActivity(id, '2021-01-01T00:00:00Z', d[d.length - 1], CONTAM_MAX_SPEED_MPS);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: t.length,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t,
          d,
        });
        return { t, d };
      }

      for (const id of cleanIds) await writeClean400m(id, CLEAN_SPEED_MPS);
      const contamStreams: Record<string, { t: number[]; d: number[] }> = {};
      for (const id of contamIds) contamStreams[id] = await writeContaminated400m(id);

      // Reachability: the fabricated burst is actually detected as a
      // segment for EVERY contaminated activity — without this, the whole
      // fixture would be vacuous.
      for (const id of contamIds) {
        const { segments } = classifyGapsWithSegments(contamStreams[id].t, contamStreams[id].d);
        expect(segments.length).toBeGreaterThan(0);
      }

      // Two independent, hand-built deriveCeilings candidates, from
      // hand-written speed arrays — never from the production output.
      const cleanCandidate = new Map<TargetDistanceKey, number[]>();
      const rawCandidate = new Map<TargetDistanceKey, number[]>();
      for (const key of TARGET_ORDER) {
        if (key === '400m') {
          cleanCandidate.set(key, [
            ...Array.from({ length: CLEAN_COUNT }, () => CLEAN_SPEED_MPS),
            ...Array.from({ length: CONTAM_COUNT }, () => CONTAM_CLEAN_SPEED_MPS),
          ]);
          rawCandidate.set(key, [
            ...Array.from({ length: CLEAN_COUNT }, () => CLEAN_SPEED_MPS),
            ...Array.from({ length: CONTAM_COUNT }, () => RAW_TARGET_SPEED_MPS),
          ]);
        } else {
          cleanCandidate.set(key, []);
          rawCandidate.set(key, []);
        }
      }
      const cleanResult = deriveCeilings(cleanCandidate);
      const rawResult = deriveCeilings(rawCandidate);

      // DIVERGENCE FIRST — the fixture must discriminate before anything else runs.
      expect(cleanResult['400m'].ceilingMps).not.toBeNull();
      expect(rawResult['400m'].ceilingMps).not.toBeNull();
      expect(cleanResult['400m'].ceilingMps).not.toBe(rawResult['400m'].ceilingMps);

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      // 2. Equality with the CLEAN candidate, inequality with the RAW one.
      expect(doc.ceilings['400m'].ceilingMps).toBeCloseTo(cleanResult['400m'].ceilingMps!, 2);
      expect(doc.ceilings['400m'].ceilingMps).not.toBeCloseTo(rawResult['400m'].ceilingMps!, 0);

      // 3. `populationN` testifies: every contaminated activity contributed
      // its CLEAN figure to the population, none was dropped entirely.
      expect(doc.ceilings['400m'].populationN).toBe(CLEAN_COUNT + CONTAM_COUNT);

      const expectedCleanPaceSecPerKm = 400 / CONTAM_CLEAN_SPEED_MPS / (400 / 1000);
      for (const id of contamIds) {
        const effort = doc.activities[id].efforts.find((e) => e.distance === '400m')!;
        expect(effort.demotion).toBeNull();
        expect(effort.contaminated).not.toBeNull();
        expect(effort.paceSecPerKm).toBeCloseTo(expectedCleanPaceSecPerKm, 1);
      }
    });

    it("no-clean-window activities are excluded entirely from populationN — 100, not 103 — while carrying demotion under 'unreliable-segment'", async () => {
      const CLEAN_COUNT = 100;
      const CLEAN_SPEED_MPS = 3.5;
      const manifest = emptyManifestDoc();
      const cleanIds = Array.from({ length: CLEAN_COUNT }, (_, i) => `d14nc-clean-${i}`);
      const noCleanIds = ['d14nc-a', 'd14nc-b', 'd14nc-c'];
      for (const id of cleanIds) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      for (const id of noCleanIds) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 3,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);

      for (const id of cleanIds) {
        const durationSec = round1(400 / CLEAN_SPEED_MPS);
        await writeActivity(id, '2020-01-01T00:00:00Z', 400);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t: [0, durationSec],
          d: [0, 400],
        });
      }

      // Burst covers almost the entire 400m target (395m in 1s — a huge,
      // clearly-flagged burst); the remainder (5m over 10s) is the ONLY
      // clean sub-interval available, far short of a full 400m — no clean
      // window exists.
      const t = [0, 1, 11];
      const d = [0, 395, 400];
      for (const id of noCleanIds) {
        const { segments } = classifyGapsWithSegments(t, d);
        expect(segments.length).toBeGreaterThan(0); // reachability
        await writeActivity(id, '2021-01-01T00:00:00Z', 400, 20);
        await fileStore.writeJson(path.join('streams', `${id}.json`), {
          schemaVersion: 1,
          id,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: t.length,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
          t,
          d,
        });
      }

      const doc = await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
      });

      expect(doc.ceilings['400m'].populationN).toBe(CLEAN_COUNT);
      for (const id of noCleanIds) {
        const effort = doc.activities[id].efforts.find((e) => e.distance === '400m')!;
        expect(effort.demotion).not.toBeNull();
        expect(effort.demotion!.guard).toBe('unreliable-segment');
      }
    });
  });

  it('D-02 fails open below CEILING_MIN_POPULATION: ceilings.half.ceilingMps is null with a non-null failOpenReason, and every half effort in the fixture is still ranked', async () => {
    const manifest = emptyManifestDoc();
    const ids = ['half-1', 'half-2', 'half-3'];
    for (const id of ids) {
      manifest.activities[id] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
    }
    await writeManifest(manifest);

    const halfDurations = [5000, 5100, 5200]; // ordinary half-marathon paces, well under the world record
    for (let i = 0; i < ids.length; i++) {
      await writeActivity(ids[i], `2026-0${i + 1}-01T00:00:00Z`, 21200);
      await fileStore.writeJson(path.join('streams', `${ids[i]}.json`), {
        schemaVersion: 1,
        id: ids[i],
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        t: [0, halfDurations[i]],
        d: [0, 21200],
      });
    }

    const doc = await computeBestEfforts({
      activitiesDir: path.join(tmpDir, 'activities'),
      streamsDir: path.join(tmpDir, 'streams'),
      streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
      statsDir: path.join(tmpDir, 'stats'),
      ceilingStatePath: path.join(tmpDir, 'ceiling-state.json'),
      exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
    });

    expect(doc.ceilings.half.ceilingMps).toBeNull();
    expect(doc.ceilings.half.failOpenReason).not.toBeNull();
    expect(doc.rankings.half.length).toBe(3);
    for (const id of ids) {
      expect(doc.activities[id].efforts.find((e) => e.distance === 'half')?.demotion).toBeNull();
    }
  });

  describe('committed ceiling state (Phase 28 D-06/D-07)', () => {
    it('the first run (no previous state file) writes a ceiling-state file with schemaVersion, note, generatedAt and all seven TARGET_ORDER-keyed ceilings', async () => {
      const manifest = emptyManifestDoc();
      await writeManifest(manifest);
      const ceilingStatePath = path.join(tmpDir, 'ceiling-state.json');

      await computeBestEfforts({
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        statsDir: path.join(tmpDir, 'stats'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
        ceilingStatePath,
      });

      const written = JSON.parse(await fs.readFile(ceilingStatePath, 'utf-8'));
      expect(written.schemaVersion).toBe(1);
      expect(typeof written.note).toBe('string');
      expect(written.note.length).toBeGreaterThan(0);
      expect(typeof written.generatedAt).toBe('string');
      expect(Object.keys(written.ceilings)).toEqual([
        '400m',
        '1k',
        '1mi',
        '5k',
        '10k',
        'half',
        'marathon',
      ]);
    });

    it('a second run over unchanged input reports no movement and leaves the committed ceiling-state file byte-unmodified (writeJson is gated on a non-empty diff)', async () => {
      const manifest = emptyManifestDoc();
      const ids = ['cs-1', 'cs-2', 'cs-3'];
      for (const id of ids) {
        manifest.activities[id] = {
          available: true,
          source: 'fit',
          distanceSource: 'native',
          sampleCount: 2,
          channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
        };
      }
      await writeManifest(manifest);
      for (let i = 0; i < ids.length; i++) {
        await writeActivity(ids[i], `2026-0${i + 1}-01T00:00:00Z`);
        await writeStream(ids[i], 300 + i);
      }

      const ceilingStatePath = path.join(tmpDir, 'ceiling-state.json');
      const common = {
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
        ceilingStatePath,
      };

      // First run: no previous state exists, so exactly one first-run
      // movement row is reported and the file IS written.
      await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats-run1') });
      const firstWrite = await fs.readFile(ceilingStatePath, 'utf-8');
      const firstParsed = JSON.parse(firstWrite);
      expect(firstParsed.schemaVersion).toBe(1);

      // Second run: identical input, so the freshly re-derived ceilings must
      // match the just-committed previous state exactly (D-06's own
      // guarantee) — the diff is empty and the file is left untouched.
      await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats-run2') });
      const secondWrite = await fs.readFile(ceilingStatePath, 'utf-8');
      const secondParsed = JSON.parse(secondWrite);

      expect(secondParsed.generatedAt).toBe(firstParsed.generatedAt);
      expect(secondWrite).toBe(firstWrite);
    });

    it('a genuine population change between runs produces an updated, non-byte-identical ceiling-state file', async () => {
      const manifest = emptyManifestDoc();
      manifest.activities['cs-a'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);
      await writeActivity('cs-a', '2026-01-01T00:00:00Z');
      await writeStream('cs-a', 300);

      const ceilingStatePath = path.join(tmpDir, 'ceiling-state.json');
      const common = {
        activitiesDir: path.join(tmpDir, 'activities'),
        streamsDir: path.join(tmpDir, 'streams'),
        streamsManifestPath: path.join(tmpDir, 'streams', 'manifest.json'),
        exclusionsPath: path.join(tmpDir, 'no-such-exclusions.json'),
        ceilingStatePath,
      };

      await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats-run1') });
      const firstWrite = await fs.readFile(ceilingStatePath, 'utf-8');

      // Add a second activity — the 1k population grows from 1 to 2, so
      // `populationN` differs even though both stay far below
      // CEILING_MIN_POPULATION (both fail-open) — a genuine, reportable
      // movement distinct from "unchanged."
      await writeActivity('cs-b', '2026-01-02T00:00:00Z');
      await writeStream('cs-b', 310);
      manifest.activities['cs-b'] = {
        available: true,
        source: 'fit',
        distanceSource: 'native',
        sampleCount: 2,
        channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      };
      await writeManifest(manifest);

      await computeBestEfforts({ ...common, statsDir: path.join(tmpDir, 'stats-run2') });
      const secondWrite = await fs.readFile(ceilingStatePath, 'utf-8');

      expect(secondWrite).not.toBe(firstWrite);
      const secondParsed = JSON.parse(secondWrite);
      expect(secondParsed.ceilings['1k'].populationN).toBe(2);
    });
  });
});
