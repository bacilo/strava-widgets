import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import type { CanonicalStream } from '../../streams/stream.types.js';
import {
  PACE_BUCKET_WIDTH_SEC,
  computePaceDistribution,
  parseAthleteConfig,
  computeHrZoneTimes,
  type AthleteConfig,
} from './detail-zones.js';
import {
  classifyGaps,
  classifyGapsThreeWay,
  derivePaceWithCoverage,
  adaptiveWindowSec,
  paceHistogramAccounting,
} from '../../analytics/pace-derivation.js';
import {
  detectUnreliableSegments,
  DEFAULT_DETECTOR_PARAMS,
} from '../../analytics/unreliable-segments.js';

/**
 * Reads the pinned worked-example stream (activity 4556693525) directly via
 * `node:fs`, mirroring `../../analytics/pace-fixtures.ts`'s `loadPinnedStream`
 * pattern rather than importing that module — `pace-fixtures.ts` is
 * test-layer only and its own import-boundary guard (D-20,
 * `pace-fixtures.test.ts`) asserts NO file under `src/dashboard/` ever
 * imports it, including test files, since the scanner does not distinguish
 * production from test sources. Reading the committed stream file inline
 * here (like `trends-cadence-hr-logic.test.ts` and `records-logic.test.ts`
 * already do for their own committed fixtures) keeps that boundary intact.
 */
function loadWorkedExampleStream(): CanonicalStream {
  const raw = fs.readFileSync('data/streams/4556693525.json', 'utf-8');
  return JSON.parse(raw) as CanonicalStream;
}

/**
 * Reads any committed stream by id via `node:fs`, for the named 33-CONTEXT.md
 * fixture (3475740390) and this task's clean-control activity (10146303423,
 * the same id Task 1 pinned in `detail-charts-logic.test.ts`) — same
 * import-boundary rationale as `loadWorkedExampleStream` above.
 */
function loadStreamById(id: string): CanonicalStream {
  const raw = fs.readFileSync(`data/streams/${id}.json`, 'utf-8');
  return JSON.parse(raw) as CanonicalStream;
}

/**
 * A from-scratch linear interpolation, written independently of
 * `interpValueAtTime` (pace-derivation.ts) — mirrors
 * `detail-charts-logic.test.ts`'s own `handInterp`, duplicated here rather
 * than imported cross-file since each test file owns its fixture helpers in
 * this codebase.
 */
function handInterp(t: readonly number[], d: readonly number[], time: number): number {
  const n = t.length;
  if (n === 0) return NaN;
  if (n === 1 || time <= t[0]) return d[0];
  if (time >= t[n - 1]) return d[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  const i = lo;
  const j = Math.min(i + 1, n - 1);
  if (t[j] === t[i]) return d[i];
  const frac = (time - t[i]) / (t[j] - t[i]);
  return d[i] + frac * (d[j] - d[i]);
}

/**
 * D-13 (mirrors `detail-charts-logic.test.ts`'s Task 1 method exactly, per
 * this task's own `<action>` instruction to reuse it): the
 * independently-derived post-clip FASTEST pace, computed from raw `t`/`d`,
 * sharing only the production `adaptiveWindowSec` width and never calling
 * `derivePaceSeriesGapAware`/`computePaceDistribution`.
 */
function independentFastestPaceSecPerKm(
  t: readonly number[],
  d: readonly number[],
  windowSec: number,
  gapIntervals: readonly { startSec: number; endSec: number }[]
): number {
  const n = t.length;
  let fastest = Infinity;
  for (let i = 0; i < n; i++) {
    const time = t[i];
    const insideGap = gapIntervals.some((g) => g.startSec < time && time < g.endSec);
    if (insideGap) continue;

    let windowStart = Math.max(t[0], time - windowSec / 2);
    let windowEnd = Math.min(t[n - 1], time + windowSec / 2);
    for (const g of gapIntervals) {
      if (g.endSec <= time && g.endSec > windowStart) windowStart = g.endSec;
      if (g.startSec >= time && g.startSec < windowEnd) windowEnd = g.startSec;
    }

    const windowElapsedSec = windowEnd - windowStart;
    if (!(windowElapsedSec > 0)) continue;
    const dStart = handInterp(t, d, windowStart);
    const dEnd = handInterp(t, d, windowEnd);
    const windowMetres = dEnd - dStart;
    if (!(windowMetres > 0)) continue;

    // Deliberately NOT `elapsed / (metres / 1000)` — pace-single-source.test.ts's
    // single-source-of-truth audit bans that exact literal anywhere outside
    // pace-derivation.ts (the historical duplicate-implementation defect
    // shape), and this hand computation is meant to be structurally distinct
    // from the production formula it is checking, not a copy of it.
    const pace = (windowElapsedSec * 1000) / windowMetres;
    if (pace < fastest) fastest = pace;
  }
  return fastest;
}

/**
 * D-13: the detector's own segment boundaries, obtained via the pre-detector
 * `classifyGapsThreeWay` path — see `detail-charts-logic.test.ts`'s identical
 * helper for the full rationale.
 */
function detectedSegmentsFor(stream: CanonicalStream) {
  const preDetector = classifyGapsThreeWay(stream.t, stream.d);
  const gaps = preDetector.gapIntervals.map((g) => ({ startSec: g.startSec, endSec: g.endSec }));
  return detectUnreliableSegments(stream.t, stream.d, gaps, DEFAULT_DETECTOR_PARAMS);
}

/** Builds a minimal valid `CanonicalStream` fixture for pure-function tests. */
function makeStream(t: number[], d: number[], hr?: number[]): CanonicalStream {
  return {
    schemaVersion: 1,
    id: 'test-activity',
    source: 'intervals',
    distanceSource: 'native',
    sampleCount: t.length,
    channels: {
      time: true,
      distance: true,
      hr: hr !== undefined,
      cadence: false,
      elevation: false,
    },
    t,
    d,
    ...(hr !== undefined ? { hr } : {}),
  };
}

describe('PACE_BUCKET_WIDTH_SEC', () => {
  it('is 15 seconds per the UI-SPEC § 4e bucket width', () => {
    expect(PACE_BUCKET_WIDTH_SEC).toBe(15);
  });
});

describe('computePaceDistribution — Δt-weighted pace-distribution histogram (PACE-01, PACE-04)', () => {
  it('buckets a dense, constant 5 m/s, 1000 s stream into a single 3:15–3:30/km bucket containing the whole span', () => {
    // Sampled every 5s (well under the 10s recording-gap threshold) so
    // `classifyGaps` does not misclassify the whole stream as one big gap —
    // the shared derivation needs realistic sample density, unlike the old
    // raw dt/dd computation this replaces, which tolerated any spacing.
    const t: number[] = [];
    const d: number[] = [];
    for (let s = 0; s <= 1000; s += 5) {
      t.push(s);
      d.push(s * 5);
    }
    const stream = makeStream(t, d);
    const derived = derivePaceWithCoverage(stream);
    const buckets = computePaceDistribution(derived, stream.t);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe('3:15–3:30/km');
    expect(buckets[0].minSecPerKm).toBe(195);
    expect(buckets[0].maxSecPerKm).toBe(210);
    expect(buckets[0].timeSec).toBeCloseTo(1000, 2);
  });

  it('sums bucket timeSec to derived.coverage.coveredSec exactly, and coveredSec + recordingGapSec + pauseSec === spanSec, on an irregular fixture', () => {
    const stream = makeStream([0, 1, 5, 10, 14, 16, 18, 20], [0, 5, 25, 50, 70, 80, 90, 100]);
    const derived = derivePaceWithCoverage(stream);
    const buckets = computePaceDistribution(derived, stream.t);
    const total = buckets.reduce((sum, b) => sum + b.timeSec, 0);
    // Exact identity (D-16, T-26-07): the histogram and the coverage
    // accounting are pinned to each other in this one test so a silent
    // re-drop or re-inclusion of segments fails the suite.
    expect(total).toBe(derived.coverage.coveredSec);
    expect(
      derived.coverage.coveredSec + derived.coverage.recordingGapSec + derived.coverage.pauseSec
    ).toBe(derived.coverage.spanSec);
    // This fixture has no gap or pause segments (max Δt is 5s, d strictly
    // increases throughout), so coveredSec equals the full 20s span.
    expect(derived.coverage.coveredSec).toBeCloseTo(20, 2);
  });

  it('weights time by real Δt, never by sample count — a short densely-sampled stretch does not out-weigh a long sparsely-sampled one', () => {
    // Region A: dense, SHORT duration — 21 samples at 1s spacing, 5 m/s
    // (200 sec/km), spanning 20 real seconds.
    // Region B: sparse, LONG duration — 9 more samples at 9s spacing, 1 m/s
    // (1000 sec/km), spanning 81 real seconds.
    // Region A holds MORE raw samples (21) than region B (9) but far LESS
    // real time (20s vs 81s). A sample-count-weighted (bugged) histogram
    // would give region A's clean 200 sec/km bucket the majority share
    // (21 of 30 raw pace values ≈ 70%); the real-Δt-weighted result below
    // is the opposite — region B's clean 1000 sec/km bucket dominates,
    // because it represents 4x more real time despite fewer samples.
    const t: number[] = [0];
    const d: number[] = [0];
    for (let s = 1; s <= 20; s++) {
      t.push(s);
      d.push(s * 5);
    }
    let dist = d[d.length - 1];
    for (let k = 1; k <= 9; k++) {
      dist += 9;
      t.push(20 + k * 9);
      d.push(dist);
    }
    const stream = makeStream(t, d);
    const derived = derivePaceWithCoverage(stream);
    const buckets = computePaceDistribution(derived, stream.t);
    const totalT = buckets.reduce((sum, b) => sum + b.timeSec, 0);
    expect(totalT).toBeCloseTo(101, 6); // full 101s span, no gaps

    const cleanA = buckets.find((b) => b.minSecPerKm === 195); // region A's own pace, 200 sec/km
    const dominantB = buckets.find((b) => b.minSecPerKm === 990); // region B's own pace, 1000 sec/km
    expect((cleanA?.timeSec ?? 0) / totalT).toBeLessThan(0.2);
    expect((dominantB?.timeSec ?? 0) / totalT).toBeGreaterThan(0.5);
  });

  it('returns buckets in ascending pace order with three dominant, well-separated non-empty buckets', () => {
    // Three 150s, densely-sampled (2s spacing) constant-pace segments, each
    // far longer than the 20s smoothing window so each segment's OWN core
    // resolves to a stable, distinct pace: 400, 200, 600 sec/km in that
    // (out-of-ascending-time) order — mirroring the original raw-per-segment
    // test's intent under the smoothed, gap-aware derivation. Minor blending
    // at the two segment boundaries is expected and tolerated.
    const t: number[] = [0];
    const d: number[] = [0];
    let time = 0;
    let dist = 0;
    for (let s = 0; s < 150; s += 2) {
      time += 2;
      dist += 2 * 2.5; // 400 sec/km
      t.push(time);
      d.push(dist);
    }
    for (let s = 0; s < 150; s += 2) {
      time += 2;
      dist += 2 * 5; // 200 sec/km
      t.push(time);
      d.push(dist);
    }
    for (let s = 0; s < 150; s += 2) {
      time += 2;
      dist += 2 * (1000 / 600); // 600 sec/km
      t.push(time);
      d.push(dist);
    }
    const stream = makeStream(t, d);
    const derived = derivePaceWithCoverage(stream);
    const buckets = computePaceDistribution(derived, stream.t);

    const mins = buckets.map((b) => b.minSecPerKm);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));

    const bucket200 = buckets.find((b) => b.minSecPerKm === 195);
    const bucket400 = buckets.find((b) => b.minSecPerKm === 390);
    const bucket600 = buckets.find((b) => b.minSecPerKm === 600);
    expect(bucket200?.timeSec ?? 0).toBeGreaterThan(120);
    expect(bucket400?.timeSec ?? 0).toBeGreaterThan(120);
    expect(bucket600?.timeSec ?? 0).toBeGreaterThan(120);
  });

  it('formats a pace safely inside the 4:00-4:15/km bucket as the literal label 4:00–4:15/km', () => {
    // 250 sec/km (4 m/s), comfortably inside the bucket rather than exactly
    // on its 240s boundary — a windowed, multi-sample derivation introduces
    // floating-point noise that a single dt/dd division never had, so
    // targeting the exact boundary is flaky; the label-formatting behaviour
    // this test exists to pin is identical either way.
    const t: number[] = [];
    const d: number[] = [];
    for (let s = 0; s <= 240; s += 10) {
      t.push(s);
      d.push(s * 4);
    }
    const stream = makeStream(t, d);
    const derived = derivePaceWithCoverage(stream);
    const buckets = computePaceDistribution(derived, stream.t);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe('4:00–4:15/km');
  });

  it('excludes a genuine pause segment via classifyGaps — no Infinity/NaN ever, and the pause carries no bucket time', () => {
    // Advance 60s @ 1 m/s, then a genuine PAUSE (flat for 40s, sampled every
    // 5s so no individual segment crosses the 10s recording-gap threshold —
    // classifyGaps only classifies this a `pause`, not a `recording-gap`),
    // then resume advancing 60s @ 1 m/s.
    const t: number[] = [0];
    const d: number[] = [0];
    let time = 0;
    let dist = 0;
    for (let s = 0; s < 60; s++) {
      time += 1;
      dist += 1;
      t.push(time);
      d.push(dist);
    }
    for (let s = 0; s < 40; s += 5) {
      time += 5;
      t.push(time);
      d.push(dist);
    }
    for (let s = 0; s < 60; s++) {
      time += 1;
      dist += 1;
      t.push(time);
      d.push(dist);
    }
    const stream = makeStream(t, d);
    const derived = derivePaceWithCoverage(stream);

    expect(derived.coverage.pauseSec).toBeCloseTo(40, 2);
    expect(derived.coverage.coveredSec).toBeCloseTo(120, 2);
    for (const p of derived.paceSeries) {
      if (p !== null) expect(Number.isFinite(p)).toBe(true);
    }

    const buckets = computePaceDistribution(derived, stream.t);
    const total = buckets.reduce((sum, b) => sum + b.timeSec, 0);
    expect(total).toBe(derived.coverage.coveredSec);
    for (const b of buckets) {
      expect(Number.isFinite(b.minSecPerKm)).toBe(true);
      expect(Number.isFinite(b.maxSecPerKm)).toBe(true);
    }
  });

  it('returns [] without throwing for a stream failing validateStreamSeries', () => {
    const stream = makeStream([0, 1, 0.5], [0, 5, 10]); // t decreases at index 2
    const derived = derivePaceWithCoverage(stream);
    expect(() => computePaceDistribution(derived, stream.t)).not.toThrow();
    expect(computePaceDistribution(derived, stream.t)).toEqual([]);
  });

  it('returns [] without throwing for a stream with fewer than 2 samples', () => {
    const stream = makeStream([0], [0]);
    const derived = derivePaceWithCoverage(stream);
    expect(() => computePaceDistribution(derived, stream.t)).not.toThrow();
    expect(computePaceDistribution(derived, stream.t)).toEqual([]);
  });
});

describe('computePaceDistribution — PACE-04 worked example 4556693525 (phantom fast cluster and spurious slow buckets)', () => {
  // This run's own splits (independent reference, NOT the derivation's own
  // self-report): 4:35, 4:18, 5:17, 5:22, 5:44, 5:24, 5:22, 6:12, 6:08, 6:53,
  // overall 5:35 (335.0 sec/km). The modal-bucket band below is derived from
  // this independent reference.
  const stream = loadWorkedExampleStream();
  const derived = derivePaceWithCoverage(stream);
  const buckets = computePaceDistribution(derived, stream.t);
  const totalT = buckets.reduce((sum, b) => sum + b.timeSec, 0);

  it('the fraction of bucketed time faster than 180 sec/km is at most 0.05 (phantom fast cluster gone)', () => {
    const fastT = buckets
      .filter((b) => b.maxSecPerKm <= 180)
      .reduce((sum, b) => sum + b.timeSec, 0);
    expect(fastT / totalT).toBeLessThanOrEqual(0.05);
  });

  it("the modal bucket's minSecPerKm lies in [300, 375] (5:00-6:15/km), matching this run's own 5:35 overall split", () => {
    let modal = buckets[0];
    for (const b of buckets) {
      if (b.timeSec > modal.timeSec) modal = b;
    }
    expect(modal.minSecPerKm).toBeGreaterThanOrEqual(300);
    expect(modal.minSecPerKm).toBeLessThanOrEqual(375);
  });

  it('no bucket above 450 sec/km carries more than 2% of bucketed time (spurious slow buckets gone)', () => {
    for (const b of buckets) {
      if (b.minSecPerKm >= 450) {
        expect(b.timeSec / totalT).toBeLessThanOrEqual(0.02);
      }
    }
  });
});

/**
 * PACE-08, D-02, D-12 (33-06 Task 2): the pace histogram excludes unreliable
 * segments exactly as it excludes recording gaps and pauses — with NO edit
 * to `detail-zones.ts`. `computePaceDistribution` calls
 * `paceHistogramSamples(t, derived.paceSeries, derived.coverage.gapIntervals)`
 * unchanged; this describe block proves the widened `classifyGaps` reaches
 * the histogram through that unchanged call site, on the real committed
 * stream 33-CONTEXT.md names for the isolated-jump case (3475740390), the
 * WR-01 accounting identity on 3475724402, plus Task 1's clean control.
 *
 * Every case below is named to be selected by `-t "unreliable"`.
 */
describe('unreliable segment exclusion reaches the histogram with zero source-file change (unreliable, PACE-08)', () => {
  describe('activity 3475740390 (five isolated jumps, the 1:10-1:40/km case)', () => {
    const stream = loadStreamById('3475740390');
    const derived = derivePaceWithCoverage(stream);
    const windowSec = adaptiveWindowSec(stream.t, stream.d);
    const segments = detectedSegmentsFor(stream);
    const unreliableIntervals = derived.coverage.gapIntervals.filter((g) => g.kind === 'unreliable');
    const buckets = computePaceDistribution(derived, stream.t);

    it('the detector finds exactly the five named isolated jumps — non-vacuity (unreliable)', () => {
      expect(segments.length).toBe(5);
      for (const seg of segments) {
        expect(seg.mechanism).toBe('isolated-jump');
      }
    });

    it("each of the five jumps' own sample start falls inside an unreliable interval — attributable, not incidental (unreliable)", () => {
      // Same membership test paceHistogramSamples itself uses
      // (segStart >= g.startSec && segStart < g.endSec) — confirms the
      // detector's own segment starts are what the histogram's exclusion
      // rule actually catches, not a coincidence of some other gap kind.
      for (const seg of segments) {
        const segStartTime = stream.t[seg.startIndex];
        const inside = unreliableIntervals.some(
          (g) => segStartTime >= g.startSec && segStartTime < g.endSec
        );
        expect(inside).toBe(true);
      }
    });

    it('no sample in the distribution falls in the 1:10-1:40/km band (unreliable)', () => {
      const overlapping = buckets.filter((b) => b.minSecPerKm < 100 && b.maxSecPerKm > 70);
      expect(overlapping).toEqual([]);
    });

    it('discriminator: total bucketed seconds is greater than zero and at least 3 buckets are populated, so this cannot pass against an empty histogram (unreliable)', () => {
      const totalBucketedSec = buckets.reduce((sum, b) => sum + b.timeSec, 0);
      expect(totalBucketedSec).toBeGreaterThan(0);
      expect(buckets.length).toBeGreaterThanOrEqual(3);
    });

    it("load-bearing: the five isolated jumps' own EXCLUSION (not merely their absence from a pace band) is what the histogram reflects — bucketed seconds never exceed coveredSec (unreliable)", () => {
      // The band-absence and fastest-edge checks above are insensitive to
      // WR-01's documented subtle leak (a segment's own START sample stays
      // non-null and is not itself an "impossible" pace value — see
      // pace-derivation.ts's paceHistogramSamples docblock) — a caller that
      // dropped 'unreliable' entries from the gapIntervals list passed to
      // paceHistogramSamples would leak exactly those 5 start samples in
      // without moving the fastest bucket or the 1:10-1:40 band. This
      // accounting-identity check is the one that DOES catch it: the total
      // time computePaceDistribution buckets can never exceed
      // derived.coverage.coveredSec, because coveredSec excludes unreliable
      // seconds by construction. Watched failing: temporarily dropping
      // 'unreliable' from the gapIntervals array passed to
      // paceHistogramSamples inside detail-zones.ts's own
      // computePaceDistribution call site made this exact assertion fail
      // (bucketedSec 3584 > coveredSec 3569, unbucketedCoveredSec -15) before
      // being reverted — see the SUMMARY's Deviations section.
      const totalBucketedSec = buckets.reduce((sum, b) => sum + b.timeSec, 0);
      expect(totalBucketedSec).toBeLessThanOrEqual(derived.coverage.coveredSec + 1e-6);
    });

    it("the distribution's fastest populated bucket edge is no faster than the independently-derived post-clip fastest pace, within one bucket width of quantization slop (unreliable)", () => {
      const independentFastest = independentFastestPaceSecPerKm(
        stream.t,
        stream.d,
        windowSec,
        derived.coverage.gapIntervals
      );
      expect(Number.isFinite(independentFastest)).toBe(true);

      const fastestBucket = buckets[0]; // buckets returned in ascending pace order
      // Bucket edges are quantized to PACE_BUCKET_WIDTH_SEC (15s) floors, so
      // a genuine sample at the independently-derived fastest pace can land
      // in a bucket whose OWN minSecPerKm reads up to one full bucket width
      // below that value (e.g. a 160 sec/km sample floors into the
      // 150-165 bucket) — this is expected quantization, not a defect. The
      // discriminator this guards against is a bucket edge more than one
      // full bucket width faster than physically achievable, which a
      // leaked-clipping bug would produce.
      expect(fastestBucket.minSecPerKm).toBeGreaterThanOrEqual(
        independentFastest - PACE_BUCKET_WIDTH_SEC
      );
    });
  });

  it('3475724402: paceHistogramAccounting\'s coveredSec === bucketedSec + unbucketedCoveredSec identity holds with the now-smaller coveredSec (unreliable)', () => {
    const stream = loadStreamById('3475724402');
    const derived = derivePaceWithCoverage(stream);
    expect(derived.coverage.unreliableSec).toBeGreaterThan(0); // non-vacuity: this stream's coveredSec IS smaller now

    const accounting = paceHistogramAccounting(stream.t, derived.paceSeries, derived.coverage);
    expect(accounting.bucketedSec + accounting.unbucketedCoveredSec).toBeCloseTo(
      derived.coverage.coveredSec,
      6
    );
  });

  describe('clean control 10146303423 (same id Task 1 pinned)', () => {
    it('the detector finds this activity clean — non-vacuity for the control itself (unreliable)', () => {
      const stream = loadStreamById('10146303423');
      const coverage = classifyGaps(stream.t, stream.d);
      expect(coverage.unreliableSec).toBe(0);
    });

    it('produces an IDENTICAL distribution through the widened detector path and a path with the detector stubbed to return [] (unreliable)', async () => {
      const stream = loadStreamById('10146303423');

      vi.resetModules();
      const real = await import('../../analytics/pace-derivation.js');
      const realZones = await import('./detail-zones.js');
      const realDerived = real.derivePaceWithCoverage(stream);
      const realBuckets = realZones.computePaceDistribution(realDerived, stream.t);

      vi.doMock('../../analytics/unreliable-segments.js', async () => {
        const actual = await vi.importActual<typeof import('../../analytics/unreliable-segments.js')>(
          '../../analytics/unreliable-segments.js'
        );
        return { ...actual, detectUnreliableSegments: () => [] };
      });
      vi.resetModules();
      const stubbed = await import('../../analytics/pace-derivation.js');
      const stubbedZones = await import('./detail-zones.js');
      const stubbedDerived = stubbed.derivePaceWithCoverage(stream);
      const stubbedBuckets = stubbedZones.computePaceDistribution(stubbedDerived, stream.t);

      expect(stubbedBuckets).toEqual(realBuckets);

      vi.doUnmock('../../analytics/unreliable-segments.js');
      vi.resetModules();
    });
  });
});

const VALID_CONFIG_RAW = {
  schemaVersion: 1,
  maxHr: 190,
  hrZones: [
    { zone: 1, minBpm: 0, maxBpm: 114 },
    { zone: 2, minBpm: 115, maxBpm: 133 },
    { zone: 3, minBpm: 134, maxBpm: 152 },
    { zone: 4, minBpm: 153, maxBpm: 171 },
    { zone: 5, minBpm: 172, maxBpm: null },
  ],
};

/** A variant with a finite (non-open-ended) top zone, for above-range clamp tests. */
const FINITE_TOP_CONFIG_RAW = {
  schemaVersion: 1,
  maxHr: 190,
  hrZones: [
    { zone: 1, minBpm: 0, maxBpm: 114 },
    { zone: 2, minBpm: 115, maxBpm: 133 },
    { zone: 3, minBpm: 134, maxBpm: 152 },
    { zone: 4, minBpm: 153, maxBpm: 171 },
    { zone: 5, minBpm: 172, maxBpm: 190 },
  ],
};

describe('parseAthleteConfig — tolerant all-or-nothing gate (D-31)', () => {
  it('parses a well-formed document with five ascending zones', () => {
    const config = parseAthleteConfig(VALID_CONFIG_RAW);
    expect(config).not.toBeNull();
    expect(config?.hrZones).toHaveLength(5);
    expect(config?.maxHr).toBe(190);
  });

  const malformedCases: Array<[string, unknown]> = [
    ['null', null],
    ['a bare string', 'nonsense'],
    ['a bare number', 42],
    ['an empty object', {}],
    ['maxHr with no zones', { maxHr: 190 }],
    ['non-finite maxHr', { ...VALID_CONFIG_RAW, maxHr: NaN }],
    ['zero maxHr', { ...VALID_CONFIG_RAW, maxHr: 0 }],
    ['negative maxHr', { ...VALID_CONFIG_RAW, maxHr: -5 }],
    ['maxHr above 260', { ...VALID_CONFIG_RAW, maxHr: 261 }],
    [
      'zones not strictly ascending',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [
          { zone: 1, minBpm: 0, maxBpm: 114 },
          { zone: 2, minBpm: 100, maxBpm: 133 }, // overlaps zone 1
          { zone: 3, minBpm: 134, maxBpm: 152 },
          { zone: 4, minBpm: 153, maxBpm: 171 },
          { zone: 5, minBpm: 172, maxBpm: null },
        ],
      },
    ],
    [
      'a non-finite zone bound',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [
          { zone: 1, minBpm: 0, maxBpm: 114 },
          { zone: 2, minBpm: 115, maxBpm: NaN },
          { zone: 3, minBpm: 134, maxBpm: 152 },
          { zone: 4, minBpm: 153, maxBpm: 171 },
          { zone: 5, minBpm: 172, maxBpm: null },
        ],
      },
    ],
    [
      'fewer than 5 zones',
      { ...VALID_CONFIG_RAW, hrZones: VALID_CONFIG_RAW.hrZones.slice(0, 4) },
    ],
    [
      'more than 5 zones',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [...VALID_CONFIG_RAW.hrZones, { zone: 6, minBpm: 200, maxBpm: null }],
      },
    ],
    [
      'a non-final zone with a null maxBpm',
      {
        ...VALID_CONFIG_RAW,
        hrZones: [
          { zone: 1, minBpm: 0, maxBpm: null },
          { zone: 2, minBpm: 115, maxBpm: 133 },
          { zone: 3, minBpm: 134, maxBpm: 152 },
          { zone: 4, minBpm: 153, maxBpm: 171 },
          { zone: 5, minBpm: 172, maxBpm: null },
        ],
      },
    ],
  ];

  it.each(malformedCases)('rejects: %s', (_name, raw) => {
    expect(parseAthleteConfig(raw)).toBeNull();
  });

  it('rejects a config carrying maxHr only via a polluted prototype (own-property read only)', () => {
    const tainted = Object.create({ maxHr: 190 }) as Record<string, unknown>;
    tainted.schemaVersion = 1;
    tainted.hrZones = VALID_CONFIG_RAW.hrZones;
    expect(parseAthleteConfig(tainted)).toBeNull();
  });
});

describe('computeHrZoneTimes — Δt-weighted HR zone times, D-31 absence gate', () => {
  const config = parseAthleteConfig(VALID_CONFIG_RAW) as AthleteConfig;

  it('returns null when the stream has no HR channel', () => {
    const stream = makeStream([0, 300], [0, 0]);
    expect(computeHrZoneTimes(stream, config)).toBeNull();
  });

  it('returns null when config is null', () => {
    const stream = makeStream([0, 300], [0, 0], [120, 120]);
    expect(computeHrZoneTimes(stream, null)).toBeNull();
  });

  it('returns exactly 5 ZoneTime entries in ascending zone order, including zero-time zones', () => {
    const stream = makeStream([0, 300], [0, 0], [120, 120]);
    const zones = computeHrZoneTimes(stream, config);
    expect(zones).toHaveLength(5);
    expect(zones?.map((z) => z.zone)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is Δt-weighted: 300 s at 120 bpm assigns to zone 2, 60 s at 170 bpm assigns to zone 4', () => {
    const stream = makeStream([0, 300, 360], [0, 0, 0], [120, 170, 170]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    const zone2 = zones.find((z) => z.zone === 2);
    const zone4 = zones.find((z) => z.zone === 4);
    expect(zone2?.timeSec).toBeCloseTo(300, 2);
    expect(zone4?.timeSec).toBeCloseTo(60, 2);
  });

  it('sums zone timeSec to the HR-covered elapsed time within 0.01 s', () => {
    const stream = makeStream([0, 300, 360], [0, 0, 0], [120, 170, 170]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    const total = zones.reduce((sum, z) => sum + z.timeSec, 0);
    expect(total).toBeCloseTo(360, 2);
  });

  it('computes percent as timeSec / total * 100, summing to 100 within 0.01', () => {
    const stream = makeStream([0, 300, 360], [0, 0, 0], [120, 170, 170]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    const zone2 = zones.find((z) => z.zone === 2);
    expect(zone2?.percent).toBeCloseTo((300 / 360) * 100, 2);
    const totalPercent = zones.reduce((sum, z) => sum + z.percent, 0);
    expect(totalPercent).toBeCloseTo(100, 2);
  });

  it('returns percent 0 (never NaN) for every zone when total zone time is 0', () => {
    // A single-sample HR stream produces no segments at all -> zero total time.
    const stream = makeStream([0], [0], [120]);
    const zones = computeHrZoneTimes(stream, config) ?? [];
    expect(zones).toHaveLength(5);
    for (const z of zones) {
      expect(z.percent).toBe(0);
      expect(Number.isNaN(z.percent)).toBe(false);
    }
  });

  it('clamps an HR sample below zone 1 to zone 1 and above the final zone to zone 5', () => {
    const finiteConfig = parseAthleteConfig(FINITE_TOP_CONFIG_RAW) as AthleteConfig;
    const stream = makeStream([0, 10, 20], [0, 0, 0], [-10, 250, 250]);
    const zones = computeHrZoneTimes(stream, finiteConfig) ?? [];
    const zone1 = zones.find((z) => z.zone === 1);
    const zone5 = zones.find((z) => z.zone === 5);
    expect(zone1?.timeSec).toBeCloseTo(10, 2);
    expect(zone5?.timeSec).toBeCloseTo(10, 2);
  });
});
