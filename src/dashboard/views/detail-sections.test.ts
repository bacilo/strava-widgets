import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

import {
  coverageCaptionText,
  splitGapAnnotations,
  dominantGapKindLabel,
  breakdownSectionPlan,
  qualitySignalsSectionPlan,
  EXPLANATION_PROBE_QUALITY,
  UNRELIABLE_SEGMENTS_EXPLANATION,
  PAUSES_SUMMARY_EXPLANATION,
  pausesSectionPlan,
  runningPaceTilePlan,
  type SplitGapAnnotation,
} from './detail-sections.js';
import type { Split } from './detail-splits.js';
import type { PaceBucket } from './detail-zones.js';
import type { PaceCoverage, GapInterval } from '../../analytics/pace-derivation.js';
import { derivePaceWithCoverage } from '../../analytics/pace-derivation.js';
import { computeSplits } from './detail-splits.js';
import type { CanonicalStream } from '../../streams/stream.types.js';
import { stripComments } from '../row-semantics.test.js';
import { qualityBadgeSpecs, formatPace, formatEffortDuration, formatMetres } from './list.js';
import type { RunningPaceRow } from '../../analytics/dashboard-index.types.js';
import type { ActivityQualitySignals, DeviceFamilyKind, PaceQualityShard } from '../../analytics/pace-quality.js';
import {
  buildPaceQualityShard,
  UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION,
  type ActivityQualityMetadata,
} from '../../analytics/pace-quality.js';
import { classifyGapsWithSegments } from '../../analytics/pace-derivation.js';
import { parsePaceQualityShard } from '../data/pace-quality-client.js';

/*
 * Unit tests for the pure D-08/D-09 helpers (`coverageCaptionText`,
 * `splitGapAnnotations`), plus source-text wiring guards, following
 * `curation-seam.test.ts`'s idiom. Vitest runs in this repository with
 * `environment: 'node'` — there is no DOM-simulation library dependency
 * anywhere in the tree, so this file never invokes a DOM builder
 * (`buildBreakdownSection`/`buildSplitsSection` themselves). Rendering
 * itself is proven only by the mandatory human browser checkpoint
 * (plan 26-10).
 */

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeCoverage(overrides: Partial<PaceCoverage>): PaceCoverage {
  return {
    spanSec: 0,
    coveredSec: 0,
    recordingGapSec: 0,
    pauseSec: 0,
    // Phase 33 (D-02) widened PaceCoverage with a fourth term; this fixture
    // predates that widening and is untouched by this plan's own scope
    // otherwise — zeroed here to keep this file's tests as they were.
    unreliableSec: 0,
    gapIntervals: [],
    ...overrides,
  };
}

/** Minimal `Split` fixture — only `km`/`startTimeSec`/`endTimeSec` matter to `splitGapAnnotations`. */
function makeSplit(km: number, startTimeSec: number, endTimeSec: number): Split {
  return {
    km,
    distanceM: 1000,
    durationSec: endTimeSec - startTimeSec,
    paceSecPerKm: endTimeSec - startTimeSec,
    isPartial: false,
    startTimeSec,
    endTimeSec,
    avgHr: null,
    avgCadence: null,
    elevDeltaM: null,
  };
}

function makeGap(startSec: number, endSec: number, kind: GapInterval['kind']): GapInterval {
  return { startSec, endSec, kind };
}

function makeBucket(overrides: Partial<PaceBucket>): PaceBucket {
  return { minSecPerKm: 0, maxSecPerKm: 0, label: '', timeSec: 0, ...overrides };
}

function loadStream(activityId: string): CanonicalStream {
  const raw = fs.readFileSync(`data/streams/${activityId}.json`, 'utf-8');
  return JSON.parse(raw) as CanonicalStream;
}

/**
 * Loads a committed elevation-quality shard verbatim (Phase 30, plan 30-06
 * Task 2) — the shard JSON on disk already has exactly `PaceQualityShard`'s
 * shape, so this is a straight parse, matching `loadStream`'s own precedent
 * one file over. Used only by the three pinned-real-activity tests below;
 * every other test in this file uses hand-built fixtures.
 */
function loadShard(activityId: string): PaceQualityShard {
  const raw = fs.readFileSync(`data/stats/pace-quality/${activityId}.json`, 'utf-8');
  return JSON.parse(raw) as PaceQualityShard;
}

// ---------------------------------------------------------------------------
// coverageCaptionText
// ---------------------------------------------------------------------------

describe('coverageCaptionText — coverage caption (D-08, D-10, COV-02, COV-03)', () => {
  it('emits all four segments at 0%, joined by the middle-dot separator, on a fully covered stream', () => {
    const coverage = makeCoverage({ spanSec: 100, coveredSec: 100, recordingGapSec: 0, pauseSec: 0, unreliableSec: 0 });
    expect(coverageCaptionText(coverage)).toBe(
      '100% of elapsed time covered · 0% recording gaps · 0% paused · 0% unreliable'
    );
  });

  it("D-10's always-on proof: a coverage with unreliableSec 0 still renders the fourth term, reading '0% unreliable', never omitted", () => {
    const coverage = makeCoverage({ spanSec: 200, coveredSec: 150, recordingGapSec: 50, pauseSec: 0, unreliableSec: 0 });
    const text = coverageCaptionText(coverage);
    expect(text).toBe('75% of elapsed time covered · 25% recording gaps · 0% paused · 0% unreliable');
    expect(text).toContain('0% unreliable');
  });

  it('returns null on a zero span (T-26-01: never throws, never renders a nonsensical caption)', () => {
    const coverage = makeCoverage({ spanSec: 0, coveredSec: 0, recordingGapSec: 0, pauseSec: 0, unreliableSec: 0 });
    expect(coverageCaptionText(coverage)).toBeNull();
  });

  it('returns null on a negative span (malformed/adversarial input, T-26-01)', () => {
    const coverage = makeCoverage({ spanSec: -5, coveredSec: 0, recordingGapSec: 0, pauseSec: 0, unreliableSec: 0 });
    expect(coverageCaptionText(coverage)).toBeNull();
  });

  it('does not force the four rounded percentages to sum to 100 — a fixture chosen so they demonstrably do not', () => {
    // spanSec 7: coveredSec 2 (~28.57% -> 29), recordingGapSec 2 (~28.57% ->
    // 29), pauseSec 2 (~28.57% -> 29), unreliableSec 1 (~14.29% -> 14).
    // Rounded sum: 29+29+29+14 = 101, not 100 — computed and asserted in the
    // test itself so this case cannot pass vacuously against a fixture that
    // happens to be clean.
    const coverage = makeCoverage({ spanSec: 7, coveredSec: 2, recordingGapSec: 2, pauseSec: 2, unreliableSec: 1 });
    const text = coverageCaptionText(coverage);
    expect(text).toBe('29% of elapsed time covered · 29% recording gaps · 29% paused · 14% unreliable');
    const sum = 29 + 29 + 29 + 14;
    expect(sum).toBe(101);
    expect(sum).not.toBe(100);
  });

  it('renders the pinned worked example (4556693525) at the percentages plan 26-10 will read back, now with the fourth unreliable term', () => {
    const stream = loadStream('4556693525');
    const derived = derivePaceWithCoverage(stream);
    const text = coverageCaptionText(derived.coverage);
    // Phase 33 (2026-09-21, D-01/D-02/D-10): this stream carries a detected
    // unreliable segment (measured coverage.unreliableSec = 32 of spanSec
    // 3394 = 0.94%, rounds to 1%). coveredSec is 3331 of 3394 = 98.14%,
    // rounds to 98%; recordingGapSec is 31 of 3394 = 0.91%, rounds to 1%;
    // pauseSec is 0. The fourth term now discloses the 32s that moved out of
    // coveredSec, closing the gap the earlier plan-01 comment named.
    expect(text).toBe('98% of elapsed time covered · 1% recording gaps · 0% paused · 1% unreliable');
  });

  it('real stream 3475724402: the unreliable term, recomputed in-test from the same coverage object, is greater than 0', () => {
    const stream = loadStream('3475724402');
    const derived = derivePaceWithCoverage(stream);
    const coverage = derived.coverage;
    const unreliablePercent = Math.round((coverage.unreliableSec / coverage.spanSec) * 100);
    expect(coverage.unreliableSec).toBeGreaterThan(0);
    expect(unreliablePercent).toBeGreaterThan(0);
    const text = coverageCaptionText(coverage);
    expect(text).toContain(`${unreliablePercent}% unreliable`);
    // Measured live this session: spanSec 4345, coveredSec 3548,
    // recordingGapSec 46, pauseSec 0, unreliableSec 751 -> 82/1/0/17.
    expect(text).toBe('82% of elapsed time covered · 1% recording gaps · 0% paused · 17% unreliable');
  });
});

// ---------------------------------------------------------------------------
// splitGapAnnotations
// ---------------------------------------------------------------------------

describe('splitGapAnnotations — gap marker source of truth', () => {
  it('returns one entry naming the correct km and the correct overlapping seconds, attributed to the correct kind', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    const gap = makeGap(50, 80, 'recording-gap'); // fully inside km 1's window: 30s
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([
      { km: 1, recordingGapSec: 30, pauseSec: 0, unreliableSec: 0, totalSec: 30 },
    ]);
  });

  it('attributes a pause-kind gap to pauseSec, not recordingGapSec', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gap = makeGap(10, 40, 'pause'); // 30s
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([
      { km: 1, recordingGapSec: 0, pauseSec: 30, unreliableSec: 0, totalSec: 30 },
    ]);
  });

  it('a gap partially overlapping a split contributes only the overlapping seconds, not the whole gap', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    // Gap spans [180, 220] — only [180, 200] (20s) falls inside km 2's window; the
    // remaining 20s ([200, 220]) is outside any split entirely.
    const gap = makeGap(180, 220, 'recording-gap');
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([
      { km: 2, recordingGapSec: 20, pauseSec: 0, unreliableSec: 0, totalSec: 20 },
    ]);
  });

  it('accumulates overlap across multiple gaps of mixed kind touching the same split', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gaps = [makeGap(10, 20, 'recording-gap'), makeGap(50, 65, 'pause')];
    const result = splitGapAnnotations(splits, gaps);
    expect(result).toEqual<SplitGapAnnotation[]>([
      { km: 1, recordingGapSec: 10, pauseSec: 15, unreliableSec: 0, totalSec: 25 },
    ]);
  });

  it('an unreliable-kind interval overlapping a split contributes to unreliableSec and totalSec, and ZERO to pauseSec — a test that would still pass under the old two-way else is not acceptable', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gap = makeGap(10, 40, 'unreliable'); // 30s
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([
      { km: 1, recordingGapSec: 0, pauseSec: 0, unreliableSec: 30, totalSec: 30 },
    ]);
    // Explicit negative assertion: pauseSec must be exactly 0, never carrying
    // the unreliable interval's seconds (the exact trap the old `else {
    // pauseSec += overlapSec }` branch would have produced).
    expect(result[0].pauseSec).toBe(0);
  });

  it('totalSec equals the three-term sum, and a split with only unreliable overlap is still emitted (totalSec > 0)', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gaps = [makeGap(5, 10, 'recording-gap'), makeGap(20, 25, 'pause'), makeGap(40, 50, 'unreliable')];
    const result = splitGapAnnotations(splits, gaps);
    expect(result).toHaveLength(1);
    const annotation = result[0];
    expect(annotation.totalSec).toBe(annotation.recordingGapSec + annotation.pauseSec + annotation.unreliableSec);
    expect(annotation.totalSec).toBe(20);

    const unreliableOnlySplits = [makeSplit(2, 100, 200)];
    const unreliableOnlyResult = splitGapAnnotations(unreliableOnlySplits, [makeGap(110, 115, 'unreliable')]);
    expect(unreliableOnlyResult).toEqual<SplitGapAnnotation[]>([
      { km: 2, recordingGapSec: 0, pauseSec: 0, unreliableSec: 5, totalSec: 5 },
    ]);
  });

  it('returns entries in km ascending order, matching the input split order', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200), makeSplit(3, 200, 300)];
    const gaps = [makeGap(210, 220, 'recording-gap'), makeGap(10, 20, 'pause')];
    const result = splitGapAnnotations(splits, gaps);
    expect(result.map((entry) => entry.km)).toEqual([1, 3]);
  });

  it('negative case 4 (permanent, two-directional): an empty gapIntervals array yields no annotations, while the SAME splits with a real gap interval yields one — marking removed produces zero, not vacuously', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    const realGap = makeGap(50, 80, 'recording-gap');

    // CAN FAIL direction: marking removed (empty gapIntervals) must produce
    // nothing — no marker, no legend possible downstream.
    expect(splitGapAnnotations(splits, [])).toEqual([]);

    // CAN PASS direction: the identical splits, with the real gap interval
    // restored, must produce exactly one annotation — proving the empty
    // result above is not simply "this function always returns []".
    expect(splitGapAnnotations(splits, [realGap])).toEqual<SplitGapAnnotation[]>([
      { km: 1, recordingGapSec: 30, pauseSec: 0, unreliableSec: 0, totalSec: 30 },
    ]);
  });

  it('emits no entry for a split with zero overlap', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    const gap = makeGap(300, 400, 'recording-gap'); // outside both splits entirely
    expect(splitGapAnnotations(splits, [gap])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dominantGapKindLabel — unreliable-first marker priority (D-09)
// ---------------------------------------------------------------------------

describe('splitGapAnnotations — dominantGapKindLabel unreliable-first priority (D-09)', () => {
  it("D-09's own worked example: pauseSec 200 and unreliableSec 2.7 returns the unreliable label, not 'pause'", () => {
    const annotation: SplitGapAnnotation = { km: 1, recordingGapSec: 0, pauseSec: 200, unreliableSec: 2.7, totalSec: 202.7 };
    expect(dominantGapKindLabel(annotation)).toBe('unreliable segment');
  });

  it('recordingGapSec 5, pauseSec 5, unreliableSec 0 still returns the unchanged tie rule: recording gap', () => {
    const annotation: SplitGapAnnotation = { km: 1, recordingGapSec: 5, pauseSec: 5, unreliableSec: 0, totalSec: 10 };
    expect(dominantGapKindLabel(annotation)).toBe('recording gap');
  });

  it('recordingGapSec 1, pauseSec 9, unreliableSec 0 still returns pause (magnitude rule unchanged)', () => {
    const annotation: SplitGapAnnotation = { km: 1, recordingGapSec: 1, pauseSec: 9, unreliableSec: 0, totalSec: 10 };
    expect(dominantGapKindLabel(annotation)).toBe('pause');
  });

  it('unreliableSec > 0 wins even when it is the smallest of the three categories', () => {
    const annotation: SplitGapAnnotation = { km: 1, recordingGapSec: 50, pauseSec: 50, unreliableSec: 1, totalSec: 101 };
    expect(dominantGapKindLabel(annotation)).toBe('unreliable segment');
  });
});

// ---------------------------------------------------------------------------
// Real archive activity 3475740390 — the split-8 unreliable fixture (PACE-09)
// ---------------------------------------------------------------------------

describe('splitGapAnnotations — real activity 3475740390 (split-8 unreliable fixture, PACE-09)', () => {
  it("the split covering t=2508's isolated GPS jump is derived in-test as km 8 and carries unreliableSec > 0 with the unreliable label", () => {
    const stream = loadStream('3475740390');
    const derived = derivePaceWithCoverage(stream);
    const splits = computeSplits(stream);

    // Reachability proof, derived from the raw stream in-test rather than
    // trusted from 33-VALIDATION.md's stated d=7305 m: find the raw sample
    // index at t=2508 and the split whose window contains it.
    const tIndex = stream.t.findIndex((t) => t === 2508);
    expect(tIndex).toBeGreaterThanOrEqual(0);
    const dAtJump = stream.d[tIndex];
    expect(dAtJump).toBe(7305);

    const containingSplit = splits.find((split) => 2508 >= split.startTimeSec && 2508 <= split.endTimeSec);
    expect(containingSplit).toBeDefined();
    expect(containingSplit?.km).toBe(8);

    const annotations = splitGapAnnotations(splits, derived.coverage.gapIntervals);
    const km8 = annotations.find((annotation) => annotation.km === 8);
    expect(km8).toBeDefined();
    expect(km8!.unreliableSec).toBeGreaterThan(0);
    expect(dominantGapKindLabel(km8!)).toBe('unreliable segment');
  });
});

// ---------------------------------------------------------------------------
// Real archive activity — resolves plan 26-10's checkpoint row 2 (D-09/PACE-05)
// ---------------------------------------------------------------------------

describe('splitGapAnnotations — real activity 10198771331 (gap-crossing split, pinned by pace-fixtures.ts)', () => {
  it('flags exactly km 11 with the 688s recording gap (plus 1s of pause boundary noise), for a stated 11:29 legend duration', () => {
    const stream = loadStream('10198771331');
    const derived = derivePaceWithCoverage(stream);
    const splits = computeSplits(stream);
    const annotations = splitGapAnnotations(splits, derived.coverage.gapIntervals);

    expect(annotations).toHaveLength(1);
    expect(annotations[0].km).toBe(11);
    expect(annotations[0].recordingGapSec).toBe(688);
    expect(annotations[0].pauseSec).toBe(1);
    expect(annotations[0].totalSec).toBe(689);

    // 689s = 11 minutes 29 seconds — the exact legend string plan 26-10's
    // human checkpoint row must read back on screen. The kind label is now
    // read from the real dominantGapKindLabel call (Phase 33, D-09) — this
    // is the one production call site's expected-copy test.
    const kindLabel = dominantGapKindLabel(annotations[0]);
    expect(kindLabel).toBe('recording gap');
    const minutes = Math.floor(annotations[0].totalSec / 60);
    const seconds = annotations[0].totalSec % 60;
    const durationText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    expect(durationText).toBe('11:29');
    expect(`Km ${annotations[0].km}: includes ${durationText} of ${kindLabel}`).toBe(
      'Km 11: includes 11:29 of recording gap'
    );
  });
});

// ---------------------------------------------------------------------------
// breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression)
// ---------------------------------------------------------------------------

describe('breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression)', () => {
  it('renders the pace heading and caption for real activity 11865310195 even though its histogram is empty, from a hand-built fixture', () => {
    const coverage = makeCoverage({
      spanSec: 18,
      coveredSec: 6,
      recordingGapSec: 12,
      pauseSec: 0,
      gapIntervals: [makeGap(2, 14, 'recording-gap')],
    });

    const plan = breakdownSectionPlan([], coverage, null);

    expect(plan).not.toBeNull();
    expect(plan!.captionText).toBe('33% of elapsed time covered · 67% recording gaps · 0% paused · 0% unreliable');
    expect(plan!.showPaceHeading).toBe(true);
    expect(plan!.showBars).toBe(false);
    expect(plan!.showHrZones).toBe(false);
  });

  it('renders the same caption from the real committed stream 11865310195, not just a synthetic look-alike', () => {
    const stream = loadStream('11865310195');
    const derived = derivePaceWithCoverage(stream);

    expect(derived.coverage.spanSec).toBe(18);
    expect(derived.coverage.coveredSec).toBe(6);
    expect(derived.coverage.recordingGapSec).toBe(12);
    expect(derived.coverage.unreliableSec).toBe(0);

    const plan = breakdownSectionPlan([], derived.coverage, null);
    expect(plan).not.toBeNull();
    expect(plan!.captionText).toBe('33% of elapsed time covered · 67% recording gaps · 0% paused · 0% unreliable');
  });

  it('returns null when there is no coverage, no buckets, and no zone times — nothing to show, nothing rendered', () => {
    expect(breakdownSectionPlan([], null, null)).toBeNull();
  });

  it('returns null on a zero-span coverage (cannot fail guard): a zero span is not captionable, so this must not become a heading over an empty card', () => {
    const coverage = makeCoverage({ spanSec: 0 });
    expect(breakdownSectionPlan([], coverage, null)).toBeNull();
  });

  it('renders the all-gap edge case with a deliberate 0% caption and a 0:00 note', () => {
    const coverage = makeCoverage({ spanSec: 100, coveredSec: 0, recordingGapSec: 100, pauseSec: 0 });
    const plan = breakdownSectionPlan([], coverage, null);

    expect(plan).not.toBeNull();
    expect(plan!.captionText).toBe('0% of elapsed time covered · 100% recording gaps · 0% paused · 0% unreliable');
    expect(plan!.noteText).toContain('0:00');
  });

  it('does not invert into "caption always, bars never": buckets whose timeSec sums to coveredSec show bars, a caption, and no note', () => {
    const coverage = makeCoverage({ spanSec: 100, coveredSec: 100, recordingGapSec: 0, pauseSec: 0 });
    const buckets = [makeBucket({ timeSec: 60 }), makeBucket({ timeSec: 40 })];
    const plan = breakdownSectionPlan(buckets, coverage, null);

    expect(plan).not.toBeNull();
    expect(plan!.showBars).toBe(true);
    expect(plan!.captionText).not.toBeNull();
    expect(plan!.noteText).toBeNull();
  });

  it('D-31 re-pinned at the fix site: the plan for real activity 11865310195 carries showHrZones false and no HR-related copy', () => {
    const coverage11865310195 = makeCoverage({
      spanSec: 18,
      coveredSec: 6,
      recordingGapSec: 12,
      pauseSec: 0,
      gapIntervals: [makeGap(2, 14, 'recording-gap')],
    });
    const plan = breakdownSectionPlan([], coverage11865310195, null);

    expect(plan!.showHrZones).toBe(false);
    expect(plan!.noteText).not.toMatch(/HR|heart rate/i);
    expect(plan!.captionText).not.toMatch(/HR|heart rate/i);
  });
});

// ---------------------------------------------------------------------------
// Source wiring — text-scan guards, no DOM builder invoked (node environment)
// ---------------------------------------------------------------------------

const VIEWS_DIR = new URL('./', import.meta.url);

function readSource(relativePath: string): string {
  return fs.readFileSync(new URL(relativePath, VIEWS_DIR), 'utf8');
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const detailSectionsStripped = stripComments(readSource('detail-sections.ts'));
const detailStripped = stripComments(readSource('detail.ts'));

describe('source wiring — detail-sections.ts / detail.ts (text-structure guard, no DOM)', () => {
  it('detail-sections.ts exports both coverageCaptionText and splitGapAnnotations exactly once each', () => {
    expect(countOccurrences(detailSectionsStripped, 'export function coverageCaptionText')).toBe(1);
    expect(countOccurrences(detailSectionsStripped, 'export function splitGapAnnotations')).toBe(1);
  });

  it('detail-sections.ts calls coverageCaptionText exactly once, from within breakdownSectionPlan', () => {
    // The definition line reads `coverageCaptionText(coverage: PaceCoverage)`
    // — the ":" makes it distinct from an actual call site `coverageCaptionText(coverage)`.
    expect(countOccurrences(detailSectionsStripped, 'coverageCaptionText(coverage)')).toBe(1);

    const breakdownPlanStart = detailSectionsStripped.indexOf('export function breakdownSectionPlan');
    const callOffset = detailSectionsStripped.indexOf('coverageCaptionText(coverage)');
    expect(breakdownPlanStart).toBeGreaterThanOrEqual(0);
    expect(callOffset).toBeGreaterThan(breakdownPlanStart);
  });

  it('buildSplitsSection accepts a gapAnnotations parameter (D-09 wiring point)', () => {
    expect(detailSectionsStripped).toContain('gapAnnotations: readonly SplitGapAnnotation[]');
  });

  it('the split-gap marker glyph is aria-hidden and never the sole signal (accessibility constraint)', () => {
    expect(detailSectionsStripped).toContain("marker.setAttribute('aria-hidden', 'true')");
    expect(detailSectionsStripped).toContain("paceCell.setAttribute('aria-label'");
  });

  it('detail.ts calls splitGapAnnotations and passes the result directly into buildSplitsSection, consuming the same derived.coverage.gapIntervals the histogram is built from', () => {
    // 26-08 (D-13) reformatted this call across multiple lines to add the
    // rebased-average and isRebasedAverage arguments, so this is a
    // proximity check (all four pieces present, in order, within one call
    // site) rather than a single-line literal match.
    const callSiteIndex = detailStripped.indexOf('buildSplitsSection(');
    expect(callSiteIndex).toBeGreaterThanOrEqual(0);
    const callSite = detailStripped.slice(callSiteIndex, callSiteIndex + 300);
    expect(callSite).toContain('splits,');
    expect(callSite).toContain('splitGapAnnotations(splits, derived.coverage.gapIntervals)');
  });

  it('detail.ts passes derived.coverage (not a second, independently-derived value) to buildBreakdownSection', () => {
    expect(detailStripped).toContain('buildBreakdownSection(buckets, derived.coverage, zoneTimes)');
  });

  // ---------------------------------------------------------------------
  // D-13 (26-08, PACE-07) — the rebased vs. Avg baseline for a flagged
  // activity. The DOM builder cannot be invoked in this node-environment
  // suite, so the wiring is pinned as a comment-stripped source scan
  // instead — the same idiom this file already uses above.
  // ---------------------------------------------------------------------

  it('D-13 wiring: detail.ts derives the buildSplitsSection average from the disagreement branch — the running pace when flagged, the metadata pace otherwise (35-11: the population-widening consequence — this line is unchanged by plan 35-11, only the copy that describes its result was retargeted)', () => {
    expect(detailStripped).toContain(
      'const rebasedAveragePaceSecPerKm = disagreement !== null ? disagreement.runningPaceSecPerKm : paceSecPerKm;'
    );
  });

  it('D-13 wiring: detail.ts passes both rebasedAveragePaceSecPerKm and the disagreement!==null flag into the SAME buildSplitsSection call already asserted above', () => {
    const callSiteIndex = detailStripped.indexOf('buildSplitsSection(');
    expect(callSiteIndex).toBeGreaterThanOrEqual(0);
    const callSite = detailStripped.slice(callSiteIndex, callSiteIndex + 300);
    expect(callSite).toContain('rebasedAveragePaceSecPerKm');
    expect(callSite).toContain('disagreement !== null');
  });

  it('D-13 wiring: buildSplitsSection accepts the isRebasedAverage flag and builds its caption note from the SAME activityAvgPaceSecPerKm argument already in scope, not a re-derived value', () => {
    expect(detailSectionsStripped).toContain('isRebasedAverage: boolean = false');
    expect(detailSectionsStripped).toContain('isRebasedAverage && activityAvgPaceSecPerKm !== null');
    expect(detailSectionsStripped).toContain('formatPace(activityAvgPaceSecPerKm)');
  });

  it('D-13 caption-note copy string is present verbatim in detail-sections.ts, retargeted to name the running pace (35-11, 33-D-11)', () => {
    expect(detailSectionsStripped).toContain(
      'Splits above are compared against the running pace'
    );
    expect(detailSectionsStripped).toContain('not the disputed metadata average.');
    // The retired wording no longer uniquely names one number (both the
    // retired span-based pace and the running pace are stream-derived) and
    // must not survive the retarget anywhere in this file.
    expect(detailSectionsStripped).not.toContain('stream-derived average');
  });

  // ---------------------------------------------------------------------
  // 35-11 (Task 2): the rebase note and the vs. Avg bars must move together
  // onto the running pace, and stay off it when the activity is not
  // disputed. `buildSplitsSection` and `buildPaceBarCell` both call
  // `document.createElement` directly, and this suite runs under vitest's
  // `environment: 'node'` with no DOM-simulation library installed anywhere
  // in this tree (confirmed: no jsdom/happy-dom dependency) — the SAME
  // constraint this file's own header comment already documents for
  // `buildBreakdownSection`/`buildSplitsSection`. These two builders
  // therefore cannot be invoked here; the assertions below are the
  // strongest DOM-free proof available (single-parameter source wiring),
  // and the value-level claim — that the rendered bars actually differ
  // between a rebased and a non-rebased call on the same splits — is
  // covered only by the mandatory human browser checkpoint (plan 35-13),
  // per 35-VALIDATION.md's "Splits 'vs. Avg' bars rebase to the running
  // pace on the widened badged population" Manual-Only row, extending the
  // "unit + manual" D-09 row already on that table.
  // ---------------------------------------------------------------------

  it('the rebase footnote is emitted from exactly ONE call site in buildSplitsSection, gated by isRebasedAverage && activityAvgPaceSecPerKm !== null — proving the false/null direction renders no footnote at all, not merely a differently-worded one', () => {
    const body = isolateFunctionBody(detailSectionsStripped, 'function buildSplitsSection(');
    const guardNeedle = 'if (isRebasedAverage && activityAvgPaceSecPerKm !== null)';
    const noteNeedle = 'Splits above are compared against the running pace';

    expect(countOccurrences(body, noteNeedle)).toBe(1);
    const guardIndex = body.indexOf(guardNeedle);
    const noteIndex = body.indexOf(noteNeedle);
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(noteIndex).toBeGreaterThan(guardIndex);

    // No second, unconditional emission of the same note exists anywhere
    // else in the file — the guarded call site above is the only source.
    expect(countOccurrences(detailSectionsStripped, noteNeedle)).toBe(1);
  });

  it('the vs. Avg bars and the rebase footnote read the SAME activityAvgPaceSecPerKm parameter — a rebased and a non-rebased call cannot show the note and the bars disagreeing, because both read one parameter, not two independently-set values', () => {
    const body = isolateFunctionBody(detailSectionsStripped, 'function buildSplitsSection(');

    expect(body).toContain('buildPaceBarCell(split, activityAvgPaceSecPerKm)');
    expect(body).toContain('formatPace(activityAvgPaceSecPerKm)');
    // Exactly one parameter of this name in the signature — no second,
    // differently-scoped average exists for the bars to read from while the
    // note reads another.
    expect(countOccurrences(body, 'activityAvgPaceSecPerKm: number | null')).toBe(1);
  });

  it('negative case 4 (marking removed) is pinned permanently in this suite, not just described', () => {
    // Self-referential guard: confirms the empty-gapIntervals direction of
    // negative case 4 actually lives in this file's own source, so a future
    // edit cannot silently delete it without this assertion catching it.
    const thisFileSource = stripComments(readSource('detail-sections.test.ts'));
    expect(thisFileSource).toContain('splitGapAnnotations(splits, [])');
  });
});

// ---------------------------------------------------------------------------
// buildPrFlagsCell wiring (source guard) — Phase 28, plan 28-04, D-09.
// `buildPrFlagsCell` cannot itself be invoked in this node-environment
// suite (no DOM-simulation library exists anywhere in this tree), so its
// wiring is pinned by isolating the function's own body from a
// comment-stripped source read and asserting on that slice directly. This
// mirrors the `source wiring` describe block above.
// ---------------------------------------------------------------------------

function isolateFunctionBody(source: string, declarationNeedle: string): string {
  const start = source.indexOf(declarationNeedle);
  if (start < 0) {
    throw new Error(`isolateFunctionBody: declaration not found: ${declarationNeedle}`);
  }
  const nextTopLevelFunction = /\n(export )?function /g;
  nextTopLevelFunction.lastIndex = start + declarationNeedle.length;
  const nextMatch = nextTopLevelFunction.exec(source);
  const end = nextMatch ? nextMatch.index : source.length;
  return source.slice(start, end);
}

describe('buildPrFlagsCell wiring (source guard)', () => {
  const buildPrFlagsCellBody = isolateFunctionBody(detailSectionsStripped, 'function buildPrFlagsCell(');

  it('the body contains exactly one prFlagBadgeSpecs( call', () => {
    expect(countOccurrences(buildPrFlagsCellBody, 'prFlagBadgeSpecs(')).toBe(1);
  });

  it('the body contains exactly one appendAccessibleBadge( call and zero appendBadge( calls', () => {
    expect(countOccurrences(buildPrFlagsCellBody, 'appendAccessibleBadge(')).toBe(1);
    expect(countOccurrences(buildPrFlagsCellBody, 'appendBadge(')).toBe(0);
  });

  it('the body contains zero occurrences of the literal badge-text strings — every string now lives in prFlagBadgeSpecs', () => {
    expect(buildPrFlagsCellBody).not.toContain('Excluded');
    expect(buildPrFlagsCellBody).not.toContain("PR'");
    expect(buildPrFlagsCellBody).not.toContain('Demoted');
    expect(buildPrFlagsCellBody).not.toContain('Low confidence');
  });

  it('the body contains zero if ( statements — it decides nothing, it only renders', () => {
    expect(countOccurrences(buildPrFlagsCellBody, 'if (')).toBe(0);
  });

  it('the description id passed to appendAccessibleBadge is built from both row.distance and spec.descriptionIdSuffix, so two badges in one cell cannot collide on one id', () => {
    expect(buildPrFlagsCellBody).toContain('${row.distance}-${spec.descriptionIdSuffix}');
  });
});

// ---------------------------------------------------------------------------
// qualitySignalsSectionPlan — quality signals section (Phase 27, plan 27-09:
// QUAL-01, QUAL-04, ERA-02). Only the pure plan is tested — there is no
// DOM-simulation dependency anywhere in this tree, so `buildQualitySignalsSection`
// (the emitter) cannot itself be invoked here; that mirrors this file's own
// existing header comment about `buildBreakdownSection`/`buildSplitsSection`.
// ---------------------------------------------------------------------------

const HEALTHY_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'none', zeroAdvanceFraction: 0.01, sampleCount: 500 },
  gapProfile: { tier: 'none', gapFraction: 0, recordingGapSec: 0, pauseSec: 0, spanSec: 1000 },
  impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
  // Phase 30 (ELEV-01): a required field this suite does not exercise (the
  // three per-mode rows are plan 30-06's job) -- a clean/not-flagged
  // default, same precedent as the three signals above.
  elevation: {
    tier: 'none',
    subGround: { flagged: false, minAltM: 12 },
    closureDrift: { state: 'clear', deltaM: 4, startEndDistM: 38 },
    verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
  },
  // Seventh signal (Phase 33, SEG-06, plan 33-09 Task 3): a required field
  // this suite does not exercise -- a clean/zero default, same precedent
  // as the three signals and elevation above.
  unreliableSegments: {
    tier: 'none',
    count: 0,
    totalMetres: 0,
    totalExcessMetres: 0,
    totalSeconds: 0,
    excessFraction: 0,
    mechanisms: [],
  },
  deviceEra: { family: 'garmin-fenix-6-pro', rawDeviceName: null },
  elapsedVsMoving: { ratio: 1.01, elapsedSec: 1010, movingSec: 1000 },
  // Ninth/tenth signals (Phase 34, PAUSE-02/STOP-01/STOP-03): required
  // fields this suite does not exercise (rows/sections ship in plan
  // 34-09) -- a clean/zero default, same precedent as the signals above.
  pauseClassification: {
    intervalCount: 0,
    stationaryCount: 0,
    walkedCount: 0,
    ranThroughCount: 0,
    transportedCount: 0,
    notClassifiableCount: 0,
  },
  forgottenStop: {
    computable: true,
    reason: null,
    count: 0,
    totalSec: 0,
    longestSec: 0,
    creepCount: 0,
    creepTotalSec: 0,
    creepLongestSec: 0,
    pauseCount: 0,
    pauseTotalSec: 0,
    pauseLongestSec: 0,
  },
  anySevere: false,
  notComputableReason: null,
};

const NOT_COMPUTABLE_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null },
  gapProfile: { tier: 'not-computable', gapFraction: null, recordingGapSec: null, pauseSec: null, spanSec: null },
  impossibleSamples: { tier: 'not-computable', count: null, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: null },
  // Whole-signal not-computable, matching notComputableSignals's own shape.
  elevation: {
    tier: 'not-computable',
    subGround: { flagged: false, minAltM: null },
    closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
    verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
  },
  // Seventh signal (Phase 33, SEG-06, plan 33-09 Task 3): whole-signal
  // not-computable, matching notComputableSignals's own shape, mirroring
  // every other tiering signal above.
  unreliableSegments: {
    tier: 'not-computable',
    count: null,
    totalMetres: null,
    totalExcessMetres: null,
    totalSeconds: null,
    excessFraction: null,
    mechanisms: null,
  },
  deviceEra: { family: 'no-device-name', rawDeviceName: null },
  elapsedVsMoving: { ratio: null, elapsedSec: null, movingSec: null },
  // Ninth/tenth signals (Phase 34): whole-signal not-computable, matching
  // notComputableSignals' own shape, mirroring every other tiering signal
  // above.
  pauseClassification: {
    intervalCount: null,
    stationaryCount: null,
    walkedCount: null,
    ranThroughCount: null,
    transportedCount: null,
    notClassifiableCount: null,
  },
  forgottenStop: {
    computable: false,
    reason: 'no stream committed for this activity',
    count: null,
    totalSec: null,
    longestSec: null,
    creepCount: null,
    creepTotalSec: null,
    creepLongestSec: null,
    pauseCount: null,
    pauseTotalSec: null,
    pauseLongestSec: null,
  },
  anySevere: false,
  notComputableReason: 'no stream committed for this activity',
};

function makeShard(overrides: Partial<PaceQualityShard>): PaceQualityShard {
  return {
    activityId: 'test-activity',
    signals: HEALTHY_QUALITY,
    gapIntervals: [],
    impossibleSamples: [],
    impossibleSamplesTruncated: false,
    zeroAdvanceRunProfile: null,
    adaptiveWindowSec: null,
    notComputableReason: null,
    elevationVerticalRateSamples: [],
    elevationVerticalRateSamplesTruncated: false,
    elevationLoopRadiusM: 100,
    elevationStartEndDistM: 38,
    // SEG-06 evidence (Phase 33, D-08, plan 33-10 Task 1): a required field
    // this suite does not exercise -- an empty/untruncated default, same
    // precedent as elevationVerticalRateSamples above.
    unreliableSegments: [],
    unreliableSegmentsTruncated: false,
    // Phase 34 (PAUSE-02, D-15) evidence: a required field this suite does
    // not exercise (the Pauses section ships in plan 34-09) -- an
    // empty/untruncated default, same precedent as unreliableSegments above.
    pauseIntervals: [],
    pauseIntervalsTruncated: false,
    ...overrides,
  };
}

describe('qualitySignalsSectionPlan — quality signals section (D-08, D-09, D-12, D-17)', () => {
  it('a fully healthy row produces ten rows (Phase 30: three elevation rows extend the original five; Phase 33 SEG-06 adds a ninth; Phase 34/plan 34-09 adds a tenth for Pauses), all four tiering rows carrying an explicit healthy statement, none blank/undefined/null/NaN', () => {
    const plan = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    expect(plan.rows).toHaveLength(10);

    for (const row of plan.rows) {
      expect(row.valueText.length).toBeGreaterThan(0);
      expect(row.valueText).not.toContain('undefined');
      expect(row.valueText).not.toContain('null');
      expect(row.valueText).not.toContain('NaN');
    }

    const [decimation, gapProfile, impossibleSamples, unreliableSegments] = plan.rows;
    expect(decimation.valueText).toBe('No decimation detected');
    expect(decimation.tier).toBe('none');
    expect(gapProfile.valueText).toBe('No gaps, pauses or unreliable segments');
    expect(gapProfile.tier).toBe('none');
    expect(gapProfile.label).toBe('Coverage gaps');
    expect(impossibleSamples.valueText).toBe('No impossible samples');
    expect(impossibleSamples.tier).toBe('none');
    expect(unreliableSegments.valueText).toBe('No unreliable segments detected');
    expect(unreliableSegments.tier).toBe('none');
    expect(unreliableSegments.label).toBe('Unreliable segments');
  });

  it('gapProfileRow severe with a shard: the gap row names the percentage and its evidenceText itemises unreliable segments separately from gap/pause intervals; evidenceText is absent when shard is null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      gapProfile: { tier: 'severe', gapFraction: 0.2655, recordingGapSec: 2112, pauseSec: 1, spanSec: 7958 },
      anySevere: true,
    };

    const withoutShard = qualitySignalsSectionPlan(quality, null);
    const gapRowNoShard = withoutShard.rows[1];
    expect(gapRowNoShard.label).toBe('Coverage gaps');
    expect(gapRowNoShard.valueText).toBe('27% of recorded time in gaps, pauses or unreliable segments');
    expect(gapRowNoShard.tier).toBe('severe');
    expect(gapRowNoShard.evidenceText).toBeNull();

    // Fixture with 3 recording-gap/pause intervals and 2 unreliable
    // intervals — built as explicit object literals (Pitfall B: a shard
    // with no unreliable entry would prove nothing about the itemisation).
    const shard = makeShard({
      signals: quality,
      gapIntervals: [
        { startSec: 78, endSec: 127, kind: 'recording-gap' },
        { startSec: 4766, endSec: 5769, kind: 'recording-gap' }, // 1003s, the longest across ALL intervals
        { startSec: 6000, endSec: 6010, kind: 'pause' },
        { startSec: 200, endSec: 210, kind: 'unreliable' },
        { startSec: 300, endSec: 305, kind: 'unreliable' },
      ],
    });
    const withShard = qualitySignalsSectionPlan(quality, shard);
    const gapRowWithShard = withShard.rows[1];
    expect(gapRowWithShard.valueText).toBe('27% of recorded time in gaps, pauses or unreliable segments');
    expect(gapRowWithShard.evidenceText).not.toBeNull();
    expect(gapRowWithShard.evidenceText).toBe('3 gap/pause intervals, 2 unreliable segments; longest 16:43');
    expect(gapRowWithShard.evidenceText).toContain('16:43'); // longest interval, 1003s

    // Zero-unreliable-intervals case: the count is stated explicitly, not
    // omitted (same always-on reasoning as D-10's fourth caption term).
    const shardNoUnreliable = makeShard({
      signals: quality,
      gapIntervals: [
        { startSec: 78, endSec: 127, kind: 'recording-gap' },
        { startSec: 4766, endSec: 5769, kind: 'recording-gap' },
      ],
    });
    const withShardNoUnreliable = qualitySignalsSectionPlan(quality, shardNoUnreliable);
    const gapRowNoUnreliable = withShardNoUnreliable.rows[1];
    expect(gapRowNoUnreliable.evidenceText).toBe('2 gap/pause intervals, 0 unreliable segments; longest 16:43');
    expect(gapRowNoUnreliable.evidenceText).toContain('0 unreliable segments');
  });

  it('gapProfileRow D-11 itemised evidence: singular/plural nouns are correct for 1 vs many in both counts', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      gapProfile: { tier: 'minor', gapFraction: 0.05, recordingGapSec: 50, pauseSec: 0, spanSec: 1000 },
    };
    const oneOfEach = makeShard({
      signals: quality,
      gapIntervals: [
        { startSec: 78, endSec: 127, kind: 'recording-gap' },
        { startSec: 200, endSec: 210, kind: 'unreliable' },
      ],
    });
    const singularPlan = qualitySignalsSectionPlan(quality, oneOfEach);
    expect(singularPlan.rows[1].evidenceText).toBe('1 gap/pause interval, 1 unreliable segment; longest 0:49');

    const manyOfEach = makeShard({
      signals: quality,
      gapIntervals: [
        { startSec: 78, endSec: 127, kind: 'recording-gap' },
        { startSec: 200, endSec: 210, kind: 'pause' },
        { startSec: 300, endSec: 305, kind: 'unreliable' },
        { startSec: 400, endSec: 405, kind: 'unreliable' },
      ],
    });
    const pluralPlan = qualitySignalsSectionPlan(quality, manyOfEach);
    expect(pluralPlan.rows[1].evidenceText).toBe('2 gap/pause intervals, 2 unreliable segments; longest 0:49');
  });

  it('a not-computable row: all four tiering rows (including unreliableSegmentsRow) read "Not computable — {reason}" with tier not-computable, and NO row reads 0% or a healthy statement', () => {
    const plan = qualitySignalsSectionPlan(NOT_COMPUTABLE_QUALITY, null);
    const [decimation, gapProfile, impossibleSamples, unreliableSegments] = plan.rows;

    for (const row of [decimation, gapProfile, impossibleSamples, unreliableSegments]) {
      expect(row.valueText).toBe('Not computable — no stream committed for this activity');
      expect(row.tier).toBe('not-computable');
      expect(row.valueText).not.toContain('0%');
      expect(row.valueText).not.toBe('No decimation detected');
      expect(row.valueText).not.toBe('No gaps, pauses or unreliable segments');
      expect(row.valueText).not.toBe('No impossible samples');
      expect(row.valueText).not.toBe('No unreliable segments detected');
    }
    expect(gapProfile.label).toBe('Coverage gaps');
    expect(unreliableSegments.label).toBe('Unreliable segments');
    expect(unreliableSegments.evidenceText).toBeNull();
  });

  it('unreliableSegmentsRow (SEG-06, plan 33-11) / pausesSummaryRow (plan 34-09): qualitySignalsSectionPlan and notAvailableRows return the SAME ten labels, in the SAME fixed order — a reordering fails this test with a readable diff', () => {
    const EXPECTED_LABELS = [
      'Decimation',
      'Coverage gaps',
      'Impossible samples',
      'Unreliable segments',
      'Lowest altitude',
      'Start/end altitude',
      'Max vertical rate',
      'Device / recording source',
      'Elapsed vs. moving',
      'Pauses',
    ];
    const healthyLabels = qualitySignalsSectionPlan(HEALTHY_QUALITY, null).rows.map((r) => r.label);
    const notAvailableLabels = qualitySignalsSectionPlan(null, null).rows.map((r) => r.label);
    expect(healthyLabels).toEqual(EXPECTED_LABELS);
    expect(notAvailableLabels).toEqual(EXPECTED_LABELS);
  });

  it('quality === null: the section plan is still produced (never null/undefined) and says so', () => {
    const plan = qualitySignalsSectionPlan(null, null);
    expect(plan).not.toBeNull();
    expect(plan.rows).toHaveLength(10);
    for (const row of plan.rows) {
      expect(row.valueText).toBe('Quality data not available for this activity');
    }
  });

  const DEVICE_FAMILY_EXPECTATIONS: [DeviceFamilyKind, string][] = [
    ['garmin-fenix-6-pro', 'Garmin fēnix 6 Pro'],
    ['suunto-9', 'Suunto 9'],
    ['garmin-vivoactive-4', 'Garmin vívoactive 4'],
    ['strava-app-gpx', 'Strava App'],
    ['intervals-icu', 'intervals.icu (migrated)'],
    ['no-device-name', 'No device name recorded'],
  ];

  it.each(DEVICE_FAMILY_EXPECTATIONS)('device family %s maps to a distinct display string: %s', (family, expected) => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      deviceEra: { family, rawDeviceName: null },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const deviceRow = plan.rows[7];
    expect(deviceRow.valueText).toBe(expected);
  });

  it('unrecognized-device includes the raw string verbatim, and an XSS-shaped payload survives into valueText unescaped', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      deviceEra: { family: 'unrecognized-device', rawDeviceName: payload },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const deviceRow = plan.rows[7];
    expect(deviceRow.valueText).toBe(`Unrecognized device: ${payload}`);
  });

  it('all seven DeviceFamilyKind values map to distinct display strings (including unrecognized-device)', () => {
    const allFamilies: DeviceFamilyKind[] = [
      'garmin-fenix-6-pro',
      'suunto-9',
      'garmin-vivoactive-4',
      'strava-app-gpx',
      'intervals-icu',
      'no-device-name',
      'unrecognized-device',
    ];
    const displayNames = allFamilies.map((family) => {
      const quality: ActivityQualitySignals = {
        ...HEALTHY_QUALITY,
        deviceEra: { family, rawDeviceName: family === 'unrecognized-device' ? 'Some Watch X1' : null },
      };
      return qualitySignalsSectionPlan(quality, null).rows[7].valueText;
    });
    expect(new Set(displayNames).size).toBe(allFamilies.length);
  });

  it('the three tiering explanation strings are identical to the ones list.ts exports via qualityBadgeSpecs — a drift between the two surfaces fails this test', () => {
    // Imports EXPLANATION_PROBE_QUALITY from detail-sections.ts itself
    // (G-05, 27-REVIEW.md WR-01) rather than hand-typing a second copy of
    // the same literal here — this test now exercises the SAME object
    // production's EXPLANATION_PROBE_SPECS is built from, so the two
    // sides cannot silently diverge from each other.
    const listSpecs = qualityBadgeSpecs({ quality: EXPLANATION_PROBE_QUALITY });
    const sectionRows = qualitySignalsSectionPlan(EXPLANATION_PROBE_QUALITY, null).rows;

    const bySignal = new Map(listSpecs.map((spec) => [spec.signal, spec.explanation]));
    expect(sectionRows[0].explanation).toBe(bySignal.get('decimation'));
    expect(sectionRows[1].explanation).toBe(bySignal.get('gapProfile'));
    expect(sectionRows[2].explanation).toBe(bySignal.get('impossibleSamples'));
  });

  it('G-05: the three tiering explanation strings are directly asserted non-empty, not only compared for equality against list.ts (the equality check above would pass even if BOTH sides were "")', () => {
    const sectionRows = qualitySignalsSectionPlan(EXPLANATION_PROBE_QUALITY, null).rows;
    expect(sectionRows[0].explanation.length, 'decimation row explanation must not be empty').toBeGreaterThan(0);
    expect(sectionRows[1].explanation.length, 'gapProfile row explanation must not be empty').toBeGreaterThan(0);
    expect(
      sectionRows[2].explanation.length,
      'impossibleSamples row explanation must not be empty'
    ).toBeGreaterThan(0);
  });

  it('the impossible-samples row names the fastest implied speed from shard.impossibleSamples and the zero-advance-run overlap, absent when shard is null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      impossibleSamples: { tier: 'severe', count: 11, maxImpliedSpeedMps: 15.2, countInsideZeroAdvanceRun: 3 },
      anySevere: true,
    };

    const withoutShard = qualitySignalsSectionPlan(quality, null);
    expect(withoutShard.rows[2].evidenceText).toBeNull();

    const shard = makeShard({
      signals: quality,
      impossibleSamples: [
        { index: 10, impliedSpeedMps: 12.1, dtSec: 1, ddM: 12.1 },
        { index: 20, impliedSpeedMps: 15.2, dtSec: 1, ddM: 15.2 },
      ],
    });
    const withShard = qualitySignalsSectionPlan(quality, shard);
    expect(withShard.rows[2].evidenceText).toContain('15.2 m/s');
    expect(withShard.rows[2].evidenceText).toContain('3 of these fall inside a zero-advance run');
  });

  it('the decimation row names the longest zero-advance run and the resolved adaptive window from the shard, absent when shard is null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      decimation: { tier: 'severe', zeroAdvanceFraction: 0.2033, sampleCount: 200 },
      anySevere: true,
    };

    const withoutShard = qualitySignalsSectionPlan(quality, null);
    expect(withoutShard.rows[0].evidenceText).toBeNull();

    const shard = makeShard({
      signals: quality,
      zeroAdvanceRunProfile: { runCount: 4, longestRunSamples: 12, longestRunSec: 48, medianRunSamples: 3, p90RunSec: 30 },
      adaptiveWindowSec: 20,
    });
    const withShard = qualitySignalsSectionPlan(quality, shard);
    expect(withShard.rows[0].evidenceText).toContain('12 samples');
    expect(withShard.rows[0].evidenceText).toContain('48.0s');
    expect(withShard.rows[0].evidenceText).toContain('adaptive window 20.0s');
  });

  it('elapsedVsMoving reports an explicit unavailable statement rather than a fabricated ratio when null', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elapsedVsMoving: { ratio: null, elapsedSec: null, movingSec: null },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    expect(plan.rows[8].valueText).toBe('Elapsed/moving ratio not available');
    expect(plan.rows[8].tier).toBe('untiered');
  });

  it('deviceEra and elapsedVsMoving carry the untiered tier value, never one of the four QualityTier members', () => {
    const plan = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    expect(plan.rows[7].tier).toBe('untiered');
    expect(plan.rows[8].tier).toBe('untiered');
  });
});

describe('unreliableSegmentsRow (SEG-06, D-06, D-08, plan 33-11 Task 2)', () => {
  it('unreliableSegmentsRow not-computable branch renders "Not computable — {reason}" with tier not-computable and evidenceText null', () => {
    const plan = qualitySignalsSectionPlan(NOT_COMPUTABLE_QUALITY, null);
    const row = plan.rows[3];
    expect(row.label).toBe('Unreliable segments');
    expect(row.valueText).toBe('Not computable — no stream committed for this activity');
    expect(row.tier).toBe('not-computable');
    expect(row.evidenceText).toBeNull();
  });

  it('unreliableSegmentsRow healthy (tier none) branch renders a plain-language no-segments statement, evidenceText null when the shard carries no segments', () => {
    const plan = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    const row = plan.rows[3];
    expect(row.valueText).toBe('No unreliable segments detected');
    expect(row.tier).toBe('none');
    expect(row.evidenceText).toBeNull();
  });

  it('unreliableSegmentsRow tiered branch (minor) renders the measured count/metres/seconds/mechanisms, byte-identical to unreliableSegmentsBadgeContent\'s own visibleText', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      unreliableSegments: {
        tier: 'minor',
        count: 16,
        totalMetres: 2148.7,
        totalExcessMetres: 0,
        totalSeconds: 751,
        excessFraction: 0,
        mechanisms: ['gap-adjacent'],
      },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const row = plan.rows[3];
    expect(row.tier).toBe('minor');
    expect(row.valueText).toBe('16 unreliable segments, 2149 m over 12:31 (gap adjacent)');
    // D-06: qualityBadgeSpecs never badges a 'minor' tier on the list row —
    // this row is the ONLY surface that discloses a minor-tier activity's
    // measured value, so the text must genuinely be produced here, not
    // merely inherited from a badge that would never have been shown.
    const specs = qualityBadgeSpecs({ quality });
    expect(specs).toEqual([]);
  });

  it('unreliableSegmentsRow tiered branch (severe) renders the measured value, matching the SAME text list.ts\'s badge would show for the identical signal', () => {
    const signal: ActivityQualitySignals['unreliableSegments'] = {
      tier: 'severe',
      count: 1,
      totalMetres: 181.5,
      totalExcessMetres: 122.7,
      totalSeconds: 8,
      excessFraction: 0.017964072,
      mechanisms: ['hidden-pause'],
    };
    const quality: ActivityQualitySignals = { ...HEALTHY_QUALITY, unreliableSegments: signal, anySevere: true };
    const plan = qualitySignalsSectionPlan(quality, null);
    const row = plan.rows[3];
    expect(row.tier).toBe('severe');
    expect(row.valueText).toBe('1 unreliable segment, 182 m over 0:08 (hidden pause)');

    const badgeSpecs = qualityBadgeSpecs({ quality });
    expect(badgeSpecs).toHaveLength(1);
    expect(badgeSpecs[0].visibleText).toBe(row.valueText);
  });

  it("unreliableSegmentsRow evidenceText names the first segment's start time and the longest segment's duration when the shard carries segments", () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      unreliableSegments: {
        tier: 'minor',
        count: 3,
        totalMetres: 300,
        totalExcessMetres: 10,
        totalSeconds: 40,
        excessFraction: 0.001,
        mechanisms: ['isolated-jump'],
      },
    };
    const shard = makeShard({
      signals: quality,
      unreliableSegments: [
        { startSec: 120, endSec: 128, metres: 100, excessMetres: 3, seconds: 8, mechanism: 'isolated-jump' },
        { startSec: 500, endSec: 525, metres: 150, excessMetres: 5, seconds: 25, mechanism: 'isolated-jump' },
        { startSec: 900, endSec: 907, metres: 50, excessMetres: 2, seconds: 7, mechanism: 'isolated-jump' },
      ],
    });
    const plan = qualitySignalsSectionPlan(quality, shard);
    const row = plan.rows[3];
    expect(row.evidenceText).toBe('First segment at 2:00; longest 0:25');
  });

  it('unreliableSegmentsRow evidenceText states the truncation when unreliableSegmentsTruncated is true', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      unreliableSegments: {
        tier: 'minor',
        count: 150,
        totalMetres: 4500,
        totalExcessMetres: 150,
        totalSeconds: 750,
        excessFraction: 0.02,
        mechanisms: ['isolated-jump'],
      },
    };
    const entries = Array.from({ length: 100 }, (_, i) => ({
      startSec: i * 10,
      endSec: i * 10 + 5,
      metres: 30,
      excessMetres: 1,
      seconds: 5,
      mechanism: 'isolated-jump' as const,
    }));
    const shard = makeShard({ signals: quality, unreliableSegments: entries, unreliableSegmentsTruncated: true });
    const plan = qualitySignalsSectionPlan(quality, shard);
    const row = plan.rows[3];
    expect(row.evidenceText).toContain('list truncated');
    expect(row.evidenceText).toContain('100');
  });

  it('unreliableSegmentsRow: a null shard yields evidenceText null without throwing', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      unreliableSegments: {
        tier: 'severe',
        count: 1,
        totalMetres: 181.5,
        totalExcessMetres: 122.7,
        totalSeconds: 8,
        excessFraction: 0.017964072,
        mechanisms: ['hidden-pause'],
      },
    };
    expect(() => qualitySignalsSectionPlan(quality, null)).not.toThrow();
    const row = qualitySignalsSectionPlan(quality, null).rows[3];
    expect(row.evidenceText).toBeNull();
  });

  it("unreliableSegmentsRow's explanation is UNRELIABLE_SEGMENTS_EXPLANATION on every branch, and is NOT obtained from tieringExplanation/EXPLANATION_PROBE_SPECS", () => {
    expect(UNRELIABLE_SEGMENTS_EXPLANATION.length).toBeGreaterThan(0);

    const notComputableRow = qualitySignalsSectionPlan(NOT_COMPUTABLE_QUALITY, null).rows[3];
    const healthyRow = qualitySignalsSectionPlan(HEALTHY_QUALITY, null).rows[3];
    const tieredQuality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      unreliableSegments: {
        tier: 'severe',
        count: 1,
        totalMetres: 181.5,
        totalExcessMetres: 122.7,
        totalSeconds: 8,
        excessFraction: 0.017964072,
        mechanisms: ['hidden-pause'],
      },
    };
    const tieredRow = qualitySignalsSectionPlan(tieredQuality, null).rows[3];

    for (const row of [notComputableRow, healthyRow, tieredRow]) {
      expect(row.explanation).toBe(UNRELIABLE_SEGMENTS_EXPLANATION);
    }

    // EXPLANATION_PROBE_SPECS' own three-member loop never names
    // 'unreliableSegments' (T-33-12) — qualityBadgeSpecs({ quality:
    // EXPLANATION_PROBE_QUALITY }) therefore produces no spec whose signal
    // is 'unreliableSegments' for this row's explanation to have come from.
    const probeSpecs = qualityBadgeSpecs({ quality: EXPLANATION_PROBE_QUALITY });
    expect(probeSpecs.find((s) => s.signal === 'unreliableSegments')).toBeUndefined();
  });

  it('notAvailableRows() supplies the same "Unreliable segments" ninth row, not-computable, with the same explanation', () => {
    const plan = qualitySignalsSectionPlan(null, null);
    const row = plan.rows[3];
    expect(row.label).toBe('Unreliable segments');
    expect(row.valueText).toBe('Quality data not available for this activity');
    expect(row.tier).toBe('not-computable');
    expect(row.explanation).toBe(UNRELIABLE_SEGMENTS_EXPLANATION);
    expect(row.evidenceText).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pauses summary row (Phase 34, PAUSE-02, STOP-01, STOP-03, D-09, D-10,
// D-11, D-14, plan 34-09) — the tenth Quality Signals row. Only tested
// indirectly through qualitySignalsSectionPlan's rows[9], same pattern
// every other private row function (decimationRow, gapProfileRow, ...) in
// this file already uses.
// ---------------------------------------------------------------------------

describe('Pauses summary row (Phase 34, PAUSE-02, STOP-01, STOP-03, D-09, D-10, D-11, D-14, plan 34-09) — qualitySignalsSectionPlan rows[9]', () => {
  it('is always tier "untiered", label "Pauses", with the shared PAUSES_SUMMARY_EXPLANATION, across the computable, whole-signal-not-computable and quality===null branches', () => {
    const computable = qualitySignalsSectionPlan(HEALTHY_QUALITY, null).rows[9];
    const notComputable = qualitySignalsSectionPlan(NOT_COMPUTABLE_QUALITY, null).rows[9];
    const nullQuality = qualitySignalsSectionPlan(null, null).rows[9];
    for (const row of [computable, notComputable, nullQuality]) {
      expect(row.label).toBe('Pauses');
      expect(row.tier).toBe('untiered');
    }
    expect(computable.explanation).toBe(PAUSES_SUMMARY_EXPLANATION);
    expect(notComputable.explanation).toBe(PAUSES_SUMMARY_EXPLANATION);
  });

  it('valueText numbers equal the signal\'s own class counts (a fixture with 2/3/1/0 renders "2 stationary, 3 walked, 1 ran through, 0 transported")', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      pauseClassification: {
        intervalCount: 6,
        stationaryCount: 2,
        walkedCount: 3,
        ranThroughCount: 1,
        transportedCount: 0,
        notClassifiableCount: 0,
      },
    };
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.valueText).toContain('6 intervals: 2 stationary, 3 walked, 1 ran through, 0 transported');
  });

  it('a computable forgottenStop with zero stretches reads "possible forgotten stop: none found"', () => {
    const row = qualitySignalsSectionPlan(HEALTHY_QUALITY, null).rows[9];
    expect(row.valueText).toContain('possible forgotten stop: none found');
  });

  it('a computable forgottenStop with non-zero stretches itemises count/total/longest and both named sources (D-09)', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      forgottenStop: {
        computable: true,
        reason: null,
        count: 3,
        totalSec: 210,
        longestSec: 120,
        creepCount: 1,
        creepTotalSec: 90,
        creepLongestSec: 90,
        pauseCount: 2,
        pauseTotalSec: 120,
        pauseLongestSec: 120,
      },
    };
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.valueText).toContain(
      'possible forgotten stop: 3 stretches, 3:30 total, longest 2:00 (creep 1/1:30, paused 2/2:00)'
    );
  });

  // CR-01 render boundary (34-REVIEW.md, plan 34-16): even given a
  // hand-built signal claiming `computable: true` with `count === null` (a
  // shape the fixed parser itself should no longer produce, but this
  // boundary defends the render path independently so the index-row path
  // cannot regress on its own), the row reads the not-computable sentence —
  // NEVER "possible forgotten stop: none found".
  it('a hand-built computable:true, count:null forgottenStop renders the not-computable sentence, never a fabricated "none found"', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      forgottenStop: {
        computable: true,
        reason: null,
        count: null,
        totalSec: null,
        longestSec: null,
        creepCount: 3,
        creepTotalSec: 180,
        creepLongestSec: 90,
        pauseCount: 1,
        pauseTotalSec: 60,
        pauseLongestSec: 60,
      },
    };
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.valueText).toContain('possible forgotten stop: not computable');
    expect(row.valueText).not.toContain('possible forgotten stop: none found');
  });

  // Negative control (hard constraint): a well-formed computable:true,
  // count:0 signal must still render the honest "none found" sentence.
  it('a well-formed computable:true, count:0 forgottenStop (an honest, genuinely-measured zero) still renders "none found"', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      forgottenStop: {
        computable: true,
        reason: null,
        count: 0,
        totalSec: 0,
        longestSec: 0,
        creepCount: 0,
        creepTotalSec: 0,
        creepLongestSec: 0,
        pauseCount: 0,
        pauseTotalSec: 0,
        pauseLongestSec: 0,
      },
    };
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.valueText).toContain('possible forgotten stop: none found');
  });

  it('forgottenStop computable: false with reason R reads "not computable — R", and never the bare word "none"', () => {
    const reason = 'distance-triggered recording: a standstill would be written as a recording gap, not a covered creep';
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      forgottenStop: {
        computable: false,
        reason,
        count: null,
        totalSec: null,
        longestSec: null,
        creepCount: null,
        creepTotalSec: null,
        creepLongestSec: null,
        pauseCount: null,
        pauseTotalSec: null,
        pauseLongestSec: null,
      },
    };
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.valueText).toContain(`possible forgotten stop: not computable — ${reason}`);
    expect(row.valueText).not.toContain('none');
  });

  it('stale index.json (pauseClassification and forgottenStop both genuinely absent as keys): the row renders from NOT_COMPUTABLE_PAUSE_CLASSIFICATION / NOT_COMPUTABLE_FORGOTTEN_STOP without throwing, and valueText contains "not computable"', () => {
    const full: ActivityQualitySignals = { ...HEALTHY_QUALITY, notComputableReason: null };
    const { pauseClassification, forgottenStop, ...withoutBoth } = full;
    void pauseClassification;
    void forgottenStop;
    const quality = withoutBoth as ActivityQualitySignals;
    expect('pauseClassification' in quality).toBe(false);
    expect('forgottenStop' in quality).toBe(false);

    expect(() => qualitySignalsSectionPlan(quality, null)).not.toThrow();
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.label).toBe('Pauses');
    expect(row.tier).toBe('untiered');
    expect(row.valueText.toLowerCase()).toContain('not computable');
    expect(row.valueText).not.toMatch(/undefined|NaN/);
  });

  it('whole-signal not-computable (NOT_COMPUTABLE_QUALITY fixture): valueText names the whole-signal reason for both clauses, never a healthy statement', () => {
    const row = qualitySignalsSectionPlan(NOT_COMPUTABLE_QUALITY, null).rows[9];
    expect(row.valueText).toContain(`not computable — ${NOT_COMPUTABLE_QUALITY.notComputableReason}`);
    expect(row.valueText).not.toContain('intervals:');
    expect(row.valueText).not.toContain('none found');
  });

  // -------------------------------------------------------------------------
  // notClassifiableCount disclosure (D-01, D-14, D-22's closing bullet,
  // plan 34-15) — "not-classifiable" is not "none": an isolated-jump or
  // hidden-pause segment is disclosed with its count and mechanism label,
  // never silently dropped from the row a reader sees.
  // -------------------------------------------------------------------------

  it('notClassifiableCount > 0 (3475740390\'s own shape: 5 classified intervals, 5 not-classifiable) discloses the count and mechanism label in the SAME classification clause, and the row reads coherently as a whole: classified counts, then the not-classifiable disclosure, then the forgotten-stop clause', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      pauseClassification: {
        intervalCount: 5,
        stationaryCount: 0,
        walkedCount: 5,
        ranThroughCount: 0,
        transportedCount: 0,
        notClassifiableCount: 5,
      },
    };
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    // R4 (34-16): the clause reads as a CATEGORY ("not-classifiable"), never naming both
    // mechanisms (isolated-jump/hidden-pause) as if both are always present on the row.
    expect(row.valueText).toContain(
      '5 intervals: 0 stationary, 5 walked, 0 ran through, 0 transported (5 not-classifiable — see Unreliable segments)'
    );
    // Never "none" for a genuinely non-classifiable count, and never silently omitted (D-01).
    expect(row.valueText).not.toMatch(/not-classifiable: none/);
    // Whole-row coherence: classification clause (with its not-classifiable disclosure) precedes
    // the forgotten-stop clause.
    const classificationIdx = row.valueText.indexOf('not-classifiable');
    const forgottenStopIdx = row.valueText.indexOf('possible forgotten stop');
    expect(classificationIdx).toBeGreaterThan(-1);
    expect(forgottenStopIdx).toBeGreaterThan(classificationIdx);
  });

  it('notClassifiableCount === 0 adds NO not-classifiable clause at all — a clean row stays clean', () => {
    const row = qualitySignalsSectionPlan(HEALTHY_QUALITY, null).rows[9]; // HEALTHY_QUALITY's own notClassifiableCount is 0
    expect(row.valueText).not.toContain('not-classifiable');
  });

  it('notClassifiableCount === null (a stale index.json row predating this field, CR-01) renders exactly as it did before this disclosure existed: no crash, no invented zero, no not-classifiable clause', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      pauseClassification: {
        intervalCount: 4,
        stationaryCount: 1,
        walkedCount: 2,
        ranThroughCount: 1,
        transportedCount: 0,
        notClassifiableCount: null,
      },
    };
    expect(() => qualitySignalsSectionPlan(quality, null)).not.toThrow();
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.valueText).toContain('4 intervals: 1 stationary, 2 walked, 1 ran through, 0 transported');
    expect(row.valueText).not.toContain('not-classifiable');
    expect(row.valueText).not.toMatch(/undefined|NaN/);
  });

  it('the not-computable forgotten-stop clause (D-10) is unchanged by this disclosure and still reads "not computable — {reason}", distinct from the not-classifiable clause', () => {
    const reason = 'distance-triggered recording: a standstill would be written as a recording gap, not a covered creep';
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      pauseClassification: {
        intervalCount: 5,
        stationaryCount: 0,
        walkedCount: 5,
        ranThroughCount: 0,
        transportedCount: 0,
        notClassifiableCount: 5,
      },
      forgottenStop: {
        computable: false,
        reason,
        count: null,
        totalSec: null,
        longestSec: null,
        creepCount: null,
        creepTotalSec: null,
        creepLongestSec: null,
        pauseCount: null,
        pauseTotalSec: null,
        pauseLongestSec: null,
      },
    };
    const row = qualitySignalsSectionPlan(quality, null).rows[9];
    expect(row.valueText).toContain('(5 not-classifiable — see Unreliable segments)');
    expect(row.valueText).toContain(`possible forgotten stop: not computable — ${reason}`);
  });
});

// ---------------------------------------------------------------------------
// pausesSectionPlan (Phase 34, PAUSE-02, D-14, D-15, plan 34-09) — the pure
// Pauses section plan, fully invokable in this node-environment suite
// (unlike buildPausesSection, which builds real DOM and is instead pinned
// by a source-text guard below).
// ---------------------------------------------------------------------------

describe('pausesSectionPlan (Phase 34, PAUSE-02, D-14, D-15, plan 34-09)', () => {
  function makePauseInterval(
    overrides: Partial<PaceQualityShard['pauseIntervals'][number]>
  ): PaceQualityShard['pauseIntervals'][number] {
    return {
      source: 'recording-gap',
      pauseClass: 'stationary',
      startSec: 100,
      endSec: 150,
      seconds: 50,
      metres: 0,
      startMetres: 500,
      ...overrides,
    };
  }

  it('shard null gives { kind: "unavailable" }', () => {
    expect(pausesSectionPlan(null, null)).toEqual({ kind: 'unavailable' });
  });

  it('a present shard with an empty pauseIntervals list, on a COMPUTABLE activity, gives { kind: "empty" }', () => {
    const shard = makeShard({ pauseIntervals: [] });
    expect(pausesSectionPlan(shard, HEALTHY_QUALITY)).toEqual({ kind: 'empty' });
  });

  it('a shard with unreliableSegments entries (mechanism isolated-jump) and an empty pauseIntervals still gives kind "empty" — no plan row can come from anything but shard.pauseIntervals (D-15)', () => {
    const shard = makeShard({
      pauseIntervals: [],
      unreliableSegments: [
        { startSec: 10, endSec: 15, metres: 20, excessMetres: 5, seconds: 5, mechanism: 'isolated-jump' },
      ],
    });
    expect(pausesSectionPlan(shard, HEALTHY_QUALITY)).toEqual({ kind: 'empty' });
  });

  // -------------------------------------------------------------------------
  // IN-01 (34-16): `quality` now distinguishes "genuinely zero pauses" from
  // "the whole activity's quality data was not computable" — both produce
  // an empty `shard.pauseIntervals`, but only the first is `'empty'`.
  // -------------------------------------------------------------------------

  it('an empty pauseIntervals list with quality === null gives { kind: "not-computable" }, never "empty"', () => {
    const shard = makeShard({ pauseIntervals: [] });
    expect(pausesSectionPlan(shard, null)).toEqual({ kind: 'not-computable' });
  });

  it('an empty pauseIntervals list with a set quality.notComputableReason gives { kind: "not-computable" }', () => {
    const shard = makeShard({ pauseIntervals: [], notComputableReason: NOT_COMPUTABLE_QUALITY.notComputableReason });
    expect(pausesSectionPlan(shard, NOT_COMPUTABLE_QUALITY)).toEqual({ kind: 'not-computable' });
  });

  it('a populated shard yields one row per entry with atText/classText/durationText/distanceText', () => {
    const shard = makeShard({
      pauseIntervals: [makePauseInterval({ startSec: 90, startMetres: 1500, seconds: 40, metres: 0 })],
      pauseIntervalsTruncated: false,
    });
    const plan = pausesSectionPlan(shard, null);
    expect(plan.kind).toBe('rows');
    if (plan.kind !== 'rows') throw new Error('expected kind rows');
    expect(plan.rows).toEqual([
      { atText: '1:30 · km 1.50', classText: 'Stationary', durationText: '0:40', distanceText: '0 m' },
    ]);
    expect(plan.truncated).toBe(false);
  });

  it('the truncated flag is read straight from shard.pauseIntervalsTruncated, not recomputed', () => {
    const shard = makeShard({ pauseIntervals: [makePauseInterval({})], pauseIntervalsTruncated: true });
    const plan = pausesSectionPlan(shard, null);
    expect(plan.kind).toBe('rows');
    if (plan.kind === 'rows') expect(plan.truncated).toBe(true);
  });

  it('a covered-creep row is marked as a possible forgotten stop (D-09); a zero-advance-pause row is marked as paused; every other source renders the plain class label', () => {
    const shard = makeShard({
      pauseIntervals: [
        makePauseInterval({ source: 'covered-creep', pauseClass: 'stationary' }),
        makePauseInterval({ source: 'zero-advance-pause', pauseClass: 'stationary' }),
        makePauseInterval({ source: 'recording-gap', pauseClass: 'walked' }),
        makePauseInterval({ source: 'merged-segment', pauseClass: 'ran-through' }),
      ],
    });
    const plan = pausesSectionPlan(shard, null);
    expect(plan.kind).toBe('rows');
    if (plan.kind !== 'rows') throw new Error('expected kind rows');
    expect(plan.rows.map((r) => r.classText)).toEqual([
      'Stationary — possible forgotten stop (timer running)',
      'Stationary — paused (timer running)',
      'Walked',
      'Ran through',
    ]);
  });

  it('all four PauseClass labels render distinct, correctly-cased text', () => {
    const shard = makeShard({
      pauseIntervals: [
        makePauseInterval({ pauseClass: 'stationary' }),
        makePauseInterval({ pauseClass: 'walked' }),
        makePauseInterval({ pauseClass: 'ran-through' }),
        makePauseInterval({ pauseClass: 'transported' }),
      ],
    });
    const plan = pausesSectionPlan(shard, null);
    expect(plan.kind).toBe('rows');
    if (plan.kind !== 'rows') throw new Error('expected kind rows');
    expect(plan.rows.map((r) => r.classText)).toEqual(['Stationary', 'Walked', 'Ran through', 'Transported']);
  });
});

// ---------------------------------------------------------------------------
// buildPausesSection (T-34-30) — cannot be invoked in this node-environment
// suite (no DOM-simulation library anywhere in this tree), so its
// textContent-only discipline is pinned as a comment-stripped source scan,
// the same idiom the buildPrFlagsCell wiring guard above uses.
// ---------------------------------------------------------------------------

describe('buildPausesSection source guard (T-34-30) — textContent only, no raw-markup DOM assignment', () => {
  const buildPausesSectionBody = isolateFunctionBody(detailSectionsStripped, 'export function buildPausesSection(');

  it('the body contains no innerHTML, insertAdjacentHTML or outerHTML', () => {
    expect(buildPausesSectionBody).not.toContain('innerHTML');
    expect(buildPausesSectionBody).not.toContain('insertAdjacentHTML');
    expect(buildPausesSectionBody).not.toContain('outerHTML');
  });

  it('the body writes cell/label text through textContent (both directly and via buildTextCell)', () => {
    expect(buildPausesSectionBody).toContain('.textContent =');
    expect(buildPausesSectionBody).toContain('buildTextCell(');
  });
});

/**
 * A `quality` object shaped like a pre-Phase-33 parsed `index.json` entry
 * (CR-01, 30-REVIEW.md precedent): every original sub-key present,
 * `unreliableSegments` genuinely ABSENT as a key — the exact shape a
 * browser cache or a staged build lagging the bundle serves.
 * `ActivityQualitySignals.unreliableSegments` is required on the write
 * side, so this cast mirrors the same boundary `qualityMissingElevation`
 * below exercises for the sixth signal, one signal later.
 */
function qualityMissingUnreliableSegments(): ActivityQualitySignals {
  const full: ActivityQualitySignals = { ...HEALTHY_QUALITY, notComputableReason: null };
  const { unreliableSegments, ...withoutUnreliableSegments } = full;
  void unreliableSegments;
  return withoutUnreliableSegments as ActivityQualitySignals;
}

describe('CR-01 (30-REVIEW.md precedent) — quality missing the unreliableSegments key does not crash qualitySignalsSectionPlan', () => {
  it("the fixture helper's own quality object genuinely lacks the key (not present-and-undefined)", () => {
    const quality = qualityMissingUnreliableSegments();
    expect('unreliableSegments' in quality).toBe(false);
  });

  it('does not throw and still returns ten rows, the fourth (Unreliable segments) reading its own not-computable fallback phrasing (CR-01: the whole-signal notComputableReason is null here, same as qualityMissingElevation\'s own fixture, so the row reads its OWN unavailable-data text, not "Not computable — {reason}")', () => {
    const quality = qualityMissingUnreliableSegments();
    expect(() => qualitySignalsSectionPlan(quality, null)).not.toThrow();
    const plan = qualitySignalsSectionPlan(quality, null);
    expect(plan.rows).toHaveLength(10);
    const row = plan.rows[3];
    expect(row.label).toBe('Unreliable segments');
    expect(row.valueText).toBe('Unreliable-segment data unavailable');
    expect(row.tier).toBe('not-computable');
    expect(row.valueText).not.toMatch(/null|undefined|NaN/);
  });
});

describe('Task 3 (33-11): end-to-end render-plan proof on the named activities — compute -> serialise -> parse -> render', () => {
  const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390'] as const;

  function buildMetadata(stream: CanonicalStream): ActivityQualityMetadata {
    return {
      deviceName: 'test-device',
      sourceProvider: undefined,
      elapsedTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
      movingTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
      startLatlng: undefined,
      endLatlng: undefined,
    };
  }

  it.each(NAMED_ACTIVITY_IDS)(
    "named activities %s: compute -> JSON.parse(JSON.stringify(shard)) -> parsePaceQualityShard -> qualitySignalsSectionPlan reproduces the computed signal's own count/metres/seconds exactly, and the observed tier reconciles against an independently-recomputed excess fraction",
    (id) => {
      const stream = JSON.parse(fs.readFileSync(`data/streams/${id}.json`, 'utf-8')) as CanonicalStream;
      const metadata = buildMetadata(stream);

      const rawShard = buildPaceQualityShard(id, stream, metadata);
      const computedSignal = rawShard.signals.unreliableSegments;

      // Independent reconciliation: recompute excessFraction from the
      // detector's OWN segments (classifyGapsWithSegments), never from
      // unreliableSegmentsSignal's own output, and re-derive what tier that
      // fraction implies against the shipped constant — a genuine
      // non-circular cross-check, not a restatement of the code under test.
      const { segments } = classifyGapsWithSegments(stream.t, stream.d);
      const totalDistanceM = stream.d[stream.d.length - 1] - stream.d[0];
      const independentExcessFraction = segments.reduce((sum, s) => sum + s.excessMetres, 0) / totalDistanceM;
      const independentTier =
        segments.length === 0
          ? 'none'
          : independentExcessFraction > UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION
            ? 'severe'
            : 'minor';

      expect(computedSignal.tier).toBe(independentTier);

      // The serialise/parse hop — a genuine wire-shaped document, not the
      // in-memory object handed straight to the render plan. This is where
      // plan 33-05's VALID_GAP_KINDS trap and plan 33-10's new parsers
      // actually bite.
      const wireShard = JSON.parse(JSON.stringify(rawShard)) as unknown;
      const parsedShard = parsePaceQualityShard(wireShard);
      expect(parsedShard).not.toBeNull();
      const parsed = parsedShard as PaceQualityShard;

      const parsedSignal = parsed.signals.unreliableSegments;
      expect(parsedSignal.count).toBe(computedSignal.count);
      expect(parsedSignal.totalMetres).toBe(computedSignal.totalMetres);
      expect(parsedSignal.totalExcessMetres).toBe(computedSignal.totalExcessMetres);
      expect(parsedSignal.totalSeconds).toBe(computedSignal.totalSeconds);
      expect(parsedSignal.mechanisms).toEqual(computedSignal.mechanisms);
      expect(parsedSignal.tier).toBe(computedSignal.tier);

      const sectionRows = qualitySignalsSectionPlan(parsed.signals, parsed).rows;
      const row = sectionRows[3];
      expect(row.label).toBe('Unreliable segments');
      expect(row.tier).toBe(computedSignal.tier);

      // Double-disclosure check (environment note): gapProfileRow (index 1)
      // ALSO itemises unreliable-kind gapIntervals in its own evidenceText
      // ("N unreliable segments"). Both numbers are read from the SAME
      // detector segments (one 'unreliable'-kind gapIntervals entry per
      // detected segment, classifyGapsWithSegments' own agreement) — assert
      // here, on a real named activity, that the two disclosures cannot
      // contradict each other.
      const gapProfileRowResult = sectionRows[1];
      if (computedSignal.count !== null && computedSignal.count > 0) {
        expect(gapProfileRowResult.evidenceText).toContain(`${computedSignal.count} unreliable`);
      }

      const badgeSpecs = qualityBadgeSpecs({ quality: parsed.signals });
      const badgeSpec = badgeSpecs.find((s) => s.signal === 'unreliableSegments');
      // The badge is present exactly when the observed tier is 'severe'.
      if (computedSignal.tier === 'severe') {
        expect(badgeSpec).toBeDefined();
        expect(badgeSpec?.visibleText).toBe(row.valueText);
      } else {
        expect(badgeSpec).toBeUndefined();
      }

      // eslint-disable-next-line no-console
      console.log(
        `[33-11 Task 3 named activity ${id}] count=${computedSignal.count} totalMetres=${computedSignal.totalMetres} ` +
          `totalExcessMetres=${computedSignal.totalExcessMetres} totalSeconds=${computedSignal.totalSeconds} ` +
          `mechanisms=${JSON.stringify(computedSignal.mechanisms)} excessFraction=${computedSignal.excessFraction} ` +
          `independentExcessFraction=${independentExcessFraction} tier=${computedSignal.tier} ` +
          `badgePresent=${badgeSpec !== undefined} valueText=${JSON.stringify(row.valueText)} ` +
          `evidenceText=${JSON.stringify(row.evidenceText)}`
      );
    }
  );

  it("named activities: at least one of the three produces a non-'none' tier, so this proof cannot pass vacuously against a pipeline that found nothing", () => {
    const tiers = NAMED_ACTIVITY_IDS.map((id) => {
      const stream = JSON.parse(fs.readFileSync(`data/streams/${id}.json`, 'utf-8')) as CanonicalStream;
      const metadata = buildMetadata(stream);
      return buildPaceQualityShard(id, stream, metadata).signals.unreliableSegments.tier;
    });
    expect(tiers.some((t) => t !== 'none')).toBe(true);
  });
});

/**
 * A `quality` object shaped like a pre-Phase-30 parsed `index.json` entry
 * (30-REVIEW.md CR-01): every original sub-key present, `elevation`
 * genuinely ABSENT as a key — the exact shape a browser cache or a staged
 * build lagging the bundle serves. `ActivityQualitySignals.elevation` is
 * required on the write side, so this cast mirrors the same
 * `as DashboardIndexRow`/`as ActivityQualitySignals` boundary
 * `index-client.ts`'s blind cast produces at runtime.
 */
function qualityMissingElevation(): ActivityQualitySignals {
  const full: ActivityQualitySignals = { ...HEALTHY_QUALITY, notComputableReason: null };
  const { elevation, ...withoutElevation } = full;
  void elevation;
  return withoutElevation as ActivityQualitySignals;
}

describe('CR-01 (30-REVIEW.md) — quality missing the elevation key does not crash qualitySignalsSectionPlan', () => {
  it("the fixture helper's own quality object genuinely lacks the key (not present-and-undefined)", () => {
    const quality = qualityMissingElevation();
    expect('elevation' in quality).toBe(false);
  });

  it('does not throw and still returns ten rows', () => {
    const quality = qualityMissingElevation();
    expect(() => qualitySignalsSectionPlan(quality, null)).not.toThrow();
    expect(qualitySignalsSectionPlan(quality, null).rows).toHaveLength(10);
  });

  it('renders the three elevation rows in the not-computable fallback phrasing, with no null/undefined/NaN anywhere', () => {
    const quality = qualityMissingElevation();
    const plan = qualitySignalsSectionPlan(quality, null);
    const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);

    expect(subGround.valueText).toBe('Lowest-altitude data unavailable');
    expect(subGround.tier).toBe('none');

    expect(closureDrift.valueText).toBe('start/end position unknown — drift not checked');
    expect(closureDrift.tier).toBe('not-computable');

    expect(verticalRate.valueText).toBe('Vertical-rate data unavailable');
    expect(verticalRate.tier).toBe('none');

    for (const row of [subGround, closureDrift, verticalRate]) {
      expect(row.valueText).not.toMatch(/null|undefined|NaN/);
    }
  });
});

// ---------------------------------------------------------------------------
// elevation rows (D-02, D-11, D-17, Phase 30 ELEV-01) — subGroundRow,
// closureDriftRow, verticalRateRow. Every branch the three builders can
// take is exercised here: an untested branch is a branch the human
// checkpoint (plan 30-08) may be the first to reach (T-30-24, T-30-25,
// T-30-26 in the plan's own threat register).
// ---------------------------------------------------------------------------

describe('elevation rows — subGroundRow / closureDriftRow / verticalRateRow (D-02, D-11)', () => {
  it('healthy activity: all three elevation rows present, each carrying a number, none blank/undefined/null/NaN, tier none on each', () => {
    const plan = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);

    for (const row of [subGround, closureDrift, verticalRate]) {
      expect(row.valueText.length).toBeGreaterThan(0);
      expect(row.valueText).not.toContain('undefined');
      expect(row.valueText).not.toContain('null');
      expect(row.valueText).not.toContain('NaN');
      expect(row.tier).toBe('none');
    }

    expect(subGround.label).toBe('Lowest altitude');
    expect(subGround.valueText).toBe('lowest altitude 12 m');
    expect(closureDrift.label).toBe('Start/end altitude');
    expect(closureDrift.valueText).toBe('start/end altitude differ by 4 m (loop, 38 m apart)');
    expect(verticalRate.label).toBe('Max vertical rate');
    expect(verticalRate.valueText).toBe('max vertical rate 1.2 m/s');
  });

  it('sub-ground flagged: the row names the measured minimum and carries tier severe; the other two elevation rows still read healthy with their own numbers', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elevation: {
        ...HEALTHY_QUALITY.elevation,
        tier: 'severe',
        subGround: { flagged: true, minAltM: -282 },
      },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);

    expect(subGround.valueText).toBe('lowest altitude -282 m — below plausible ground level');
    expect(subGround.tier).toBe('severe');
    expect(closureDrift.valueText).toBe('start/end altitude differ by 4 m (loop, 38 m apart)');
    expect(closureDrift.tier).toBe('none');
    expect(verticalRate.valueText).toBe('max vertical rate 1.2 m/s');
    expect(verticalRate.tier).toBe('none');
  });

  it('drift flagged on a loop: the row names both the absolute delta and the endpoint distance', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elevation: {
        ...HEALTHY_QUALITY.elevation,
        tier: 'severe',
        closureDrift: { state: 'flagged', deltaM: -198, startEndDistM: 0 },
      },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const closureDrift = plan.rows[5];

    expect(closureDrift.valueText).toBe(
      'start and end altitudes differ by 198 m on a loop whose endpoints are 0 m apart'
    );
    expect(closureDrift.tier).toBe('severe');
  });

  it("drift clear on a loop: D-11's own phrasing shape, with both numbers present", () => {
    const plan = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    const closureDrift = plan.rows[5];

    expect(closureDrift.valueText).toBe('start/end altitude differ by 4 m (loop, 38 m apart)');
    expect(closureDrift.tier).toBe('none');
  });

  it('drift excluded, endpoints far apart: the row says drift was not checked and names the measured distance, and contains no delta figure', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elevation: {
        ...HEALTHY_QUALITY.elevation,
        closureDrift: { state: 'clear', deltaM: null, startEndDistM: 9600 },
      },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const closureDrift = plan.rows[5];

    expect(closureDrift.valueText).toBe('start/end position measured 9600 m apart — not a loop, so drift was not checked');
    expect(closureDrift.tier).toBe('none');
    expect(closureDrift.valueText).not.toMatch(/differ by/);
  });

  it('drift position unknown: the row says position is unknown in words, contains no distance and no delta, and is distinguishable from the excluded case by its text', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elevation: {
        ...HEALTHY_QUALITY.elevation,
        closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
      },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const closureDrift = plan.rows[5];

    expect(closureDrift.valueText).toBe('start/end position unknown — drift not checked');
    expect(closureDrift.tier).toBe('not-computable');
    expect(closureDrift.valueText).not.toMatch(/\d/); // no distance, no delta -- no digit at all

    // T-30-25: the excluded (not-a-loop) and position-unknown states must
    // never collapse into the same string — a mutation demonstration of
    // this exact assertion failing is recorded verbatim in 30-06-SUMMARY.md.
    const excludedQuality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elevation: {
        ...HEALTHY_QUALITY.elevation,
        closureDrift: { state: 'clear', deltaM: null, startEndDistM: 9600 },
      },
    };
    const excludedRow = qualitySignalsSectionPlan(excludedQuality, null).rows[5];
    expect(closureDrift.valueText).not.toBe(excludedRow.valueText);
  });

  it('vertical rate flagged: the row names the worst rate and the violating-pair count', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elevation: {
        ...HEALTHY_QUALITY.elevation,
        tier: 'severe',
        verticalRate: { flagged: true, worstRateMps: 80.4, violatingSamples: 3 },
      },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const verticalRate = plan.rows[6];

    expect(verticalRate.valueText).toContain('80.4 m/s');
    expect(verticalRate.valueText).toContain('3');
    expect(verticalRate.tier).toBe('severe');
  });

  // WR-04 (30-REVIEW.md, T-26-02): `violatingSamples` can be `null` on a
  // flagged row (any non-finite raw value degrades to `null` in
  // `pace-quality-client.ts`'s parse, and the index-row path has no parse
  // at all) -- the row must never fabricate a plausible-looking "0
  // violating sample pairs" via `?? 0`.
  it('vertical rate flagged with violatingSamples null: the row states the count is unavailable rather than fabricating a zero', () => {
    const quality: ActivityQualitySignals = {
      ...HEALTHY_QUALITY,
      elevation: {
        ...HEALTHY_QUALITY.elevation,
        tier: 'severe',
        verticalRate: { flagged: true, worstRateMps: 80.4, violatingSamples: null },
      },
    };
    const plan = qualitySignalsSectionPlan(quality, null);
    const verticalRate = plan.rows[6];

    expect(verticalRate.valueText).toBe('max vertical rate 80.4 m/s — violating sample count unavailable');
    expect(verticalRate.tier).toBe('severe');
    expect(verticalRate.valueText).not.toContain('0 violating');
    expect(verticalRate.valueText).not.toMatch(/null|undefined|NaN/);
  });

  it('whole-signal not-computable (stream-less): the sub-ground and vertical-rate rows read "Not computable — {reason}" with tier not-computable, and NO elevation row reads 0 m, 0 m/s or any healthy statement (T-30-26, T-26-02)', () => {
    const plan = qualitySignalsSectionPlan(NOT_COMPUTABLE_QUALITY, null);
    const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);

    expect(subGround.valueText).toBe('Not computable — no stream committed for this activity');
    expect(subGround.tier).toBe('not-computable');
    expect(verticalRate.valueText).toBe('Not computable — no stream committed for this activity');
    expect(verticalRate.tier).toBe('not-computable');
    // The whole-signal not-computable cohort's own closureDrift.state is
    // 'not-computable' too (D-07) -- same position-unknown phrasing.
    expect(closureDrift.valueText).toBe('start/end position unknown — drift not checked');
    expect(closureDrift.tier).toBe('not-computable');

    for (const row of [subGround, closureDrift, verticalRate]) {
      expect(row.valueText).not.toContain('0 m/s');
      expect(row.valueText).not.toBe('lowest altitude 0 m');
      expect(row.valueText).not.toContain('max vertical rate 0');
    }
  });

  it('quality === null: notAvailableRows() supplies ten rows including the three elevation ones and the tenth Pauses row, so the section still says something rather than vanishing', () => {
    const plan = qualitySignalsSectionPlan(null, null);
    expect(plan.rows).toHaveLength(10);

    const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);
    expect(subGround.label).toBe('Lowest altitude');
    expect(closureDrift.label).toBe('Start/end altitude');
    expect(verticalRate.label).toBe('Max vertical rate');
    for (const row of [subGround, closureDrift, verticalRate]) {
      expect(row.valueText).toBe('Quality data not available for this activity');
      expect(row.tier).toBe('not-computable');
    }
  });

  it("shard null: every elevation row's evidenceText is null while its valueText is unchanged, so a failed shard fetch degrades the evidence line only (T-30-27)", () => {
    const withoutShard = qualitySignalsSectionPlan(HEALTHY_QUALITY, null);
    const [subGroundNoShard, closureDriftNoShard, verticalRateNoShard] = withoutShard.rows.slice(4, 7);
    expect(subGroundNoShard.evidenceText).toBeNull();
    expect(closureDriftNoShard.evidenceText).toBeNull();
    expect(verticalRateNoShard.evidenceText).toBeNull();

    const shard = makeShard({
      signals: HEALTHY_QUALITY,
      elevationLoopRadiusM: 100,
      elevationStartEndDistM: 38,
      elevationVerticalRateSamples: [{ index: 42, rateMps: 1.2, dtSec: 1, dAltM: 1.2 }],
    });
    const withShard = qualitySignalsSectionPlan(HEALTHY_QUALITY, shard);
    const [subGroundShard, closureDriftShard, verticalRateShard] = withShard.rows.slice(4, 7);

    // valueText comes from `quality` alone -- unchanged by the shard's presence.
    expect(subGroundShard.valueText).toBe(subGroundNoShard.valueText);
    expect(closureDriftShard.valueText).toBe(closureDriftNoShard.valueText);
    expect(verticalRateShard.valueText).toBe(verticalRateNoShard.valueText);

    // evidence degrades independently per row: subGround has no shard
    // evidence field at all (always null); closureDrift and verticalRate
    // both gain one once a shard is available.
    expect(subGroundShard.evidenceText).toBeNull();
    expect(closureDriftShard.evidenceText).not.toBeNull();
    expect(verticalRateShard.evidenceText).not.toBeNull();
  });

  describe('pinned real activities (30-03-SUMMARY.md) — rendered valueText read back against the committed shard', () => {
    it('4556693525 (severe, sub-ground exemplar) — data/stats/pace-quality/4556693525.json', () => {
      const shard = loadShard('4556693525');
      const plan = qualitySignalsSectionPlan(shard.signals, shard);
      const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);

      expect(subGround.valueText).toBe('lowest altitude -282 m — below plausible ground level');
      expect(closureDrift.valueText).toBe('start/end altitude differ by 6 m (loop, 0 m apart)');
      expect(verticalRate.valueText).toBe('max vertical rate 3.3 m/s');
    });

    it('17257505831 (healthy exemplar) — data/stats/pace-quality/17257505831.json', () => {
      const shard = loadShard('17257505831');
      const plan = qualitySignalsSectionPlan(shard.signals, shard);
      const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);

      expect(subGround.valueText).toBe('lowest altitude 8 m');
      expect(closureDrift.valueText).toBe('start/end altitude differ by 2 m (loop, 0 m apart)');
      expect(verticalRate.valueText).toBe('max vertical rate 1.4 m/s');
    });

    it('i184264408 (drift not-computable, position unknown exemplar) — data/stats/pace-quality/i184264408.json', () => {
      const shard = loadShard('i184264408');
      const plan = qualitySignalsSectionPlan(shard.signals, shard);
      const [subGround, closureDrift, verticalRate] = plan.rows.slice(4, 7);

      expect(subGround.valueText).toBe('lowest altitude -1 m');
      expect(closureDrift.valueText).toBe('start/end position unknown — drift not checked');
      expect(verticalRate.valueText).toBe('max vertical rate 1.2 m/s');
    });
  });
});

describe('deviceFamilyDisplayName exhaustive switch (ERA-02, Criterion 5) — no default branch', () => {
  it('the switch(family) mapping in detail-sections.ts has zero default branches', () => {
    const source = readSource('detail-sections.ts');
    const switchIndex = source.indexOf('switch (family)');
    expect(switchIndex).toBeGreaterThanOrEqual(0);
    const switchBlock = source.slice(switchIndex, switchIndex + 1500);
    // Bounded to the switch statement itself (up to the next top-level
    // closing brace at the same indent), not the whole file.
    const closeIndex = switchBlock.indexOf('\n}');
    const bounded = closeIndex >= 0 ? switchBlock.slice(0, closeIndex) : switchBlock;
    expect(bounded).not.toContain('default:');
  });
});

// ---------------------------------------------------------------------------
// runningPaceTilePlan (Phase 35, plan 35-10: RPACE-02, D-10) — the Running
// Pace stat tile's pure plan function. Every expectation below asserts
// FULL-STRING equality, never `toContain`, per the plan's own instruction.
// ---------------------------------------------------------------------------

/** Fixture builder — every field explicit, no defaults hidden behind `...overrides`. */
function makeRunningPaceRow(overrides: Partial<RunningPaceRow> = {}): RunningPaceRow {
  return {
    runningPaceSecPerKm: null,
    excludedM: 0,
    excludedSec: 0,
    computable: true,
    notComputableReason: null,
    ...overrides,
  };
}

describe('runningPaceTilePlan (Phase 35, plan 35-10: RPACE-02, D-10)', () => {
  it('returns null for a null runningPace (the "no stream at all" / tile-omitted case)', () => {
    expect(runningPaceTilePlan(null)).toBeNull();
  });

  it('returns null for an undefined runningPace (a stale re-parsed row missing the key)', () => {
    expect(runningPaceTilePlan(undefined)).toBeNull();
  });

  it('not-computable with a real reason returns the dash value and the exact "Not computable — {reason}" sentence', () => {
    const row = makeRunningPaceRow({
      computable: false,
      runningPaceSecPerKm: null,
      notComputableReason: 'stream failed validateStreamSeries: fewer than two usable samples',
    });
    expect(runningPaceTilePlan(row)).toEqual({
      value: '—',
      note: 'Not computable — stream failed validateStreamSeries: fewer than two usable samples',
    });
  });

  it('not-computable with an empty-string reason returns the contract-violation note, not a dangling "Not computable — " prefix', () => {
    const row = makeRunningPaceRow({ computable: false, runningPaceSecPerKm: null, notComputableReason: '' });
    const plan = runningPaceTilePlan(row);
    expect(plan!.value).toBe('—');
    expect(plan!.note).not.toBe('Not computable — ');
    expect(plan!.note).toBe(
      'Not computable — no reason was recorded for this not-computable running pace (producer contract violation)'
    );
  });

  it('not-computable with a null reason (a producer-contract violation of its own kind) returns the same contract-violation note', () => {
    const row = makeRunningPaceRow({ computable: false, runningPaceSecPerKm: null, notComputableReason: null });
    const plan = runningPaceTilePlan(row);
    expect(plan!.note).toBe(
      'Not computable — no reason was recorded for this not-computable running pace (producer contract violation)'
    );
  });

  it('computable with both excludedM and excludedSec rounding to exactly 0 returns the zero sentence verbatim', () => {
    const row = makeRunningPaceRow({ runningPaceSecPerKm: 300, excludedM: 0, excludedSec: 0, computable: true });
    expect(runningPaceTilePlan(row)).toEqual({
      value: '5:00/km',
      note: 'No time excluded — every second of this activity is covered.',
    });
  });

  it('computable, nonzero exclusion — worked example (real archive activity 3475724402) — sentence built from the shared helpers, not a hand-typed literal', () => {
    const row = makeRunningPaceRow({
      runningPaceSecPerKm: 317.6,
      excludedM: 2253.1,
      excludedSec: 797,
      computable: true,
    });
    const plan = runningPaceTilePlan(row);
    expect(plan!.value).toBe(formatPace(317.6));
    // Pinned to the values the shared helpers themselves produce — never a
    // hand-typed string that could silently drift from either convention.
    expect(plan!.note).toBe(
      `Excludes ${formatMetres(2253.1)} over ${formatEffortDuration(797)} of recording gaps, pauses and unreliable segments.`
    );
    // Quoted verbatim for the SUMMARY's worked example / thousands-separator
    // discrepancy record.
    expect(plan!.note).toBe('Excludes 2253 m over 13:17 of recording gaps, pauses and unreliable segments.');
  });

  it('a sub-0.5 m excluded distance (rounds to 0) with large excluded seconds does NOT take the zero branch', () => {
    const row = makeRunningPaceRow({
      runningPaceSecPerKm: 317.6,
      excludedM: 0.4,
      excludedSec: 797,
      computable: true,
    });
    const plan = runningPaceTilePlan(row);
    // Pins which branch fired: the nonzero sentence, built from the same
    // shared helpers, never the zero sentence.
    expect(plan!.note).not.toBe('No time excluded — every second of this activity is covered.');
    expect(plan!.note).toBe(
      `Excludes ${formatMetres(0.4)} over ${formatEffortDuration(797)} of recording gaps, pauses and unreliable segments.`
    );
  });

  it('the mirrored rounding boundary — a sub-0.5 sec excluded duration with a real excluded distance — also does NOT take the zero branch', () => {
    const row = makeRunningPaceRow({
      runningPaceSecPerKm: 317.6,
      excludedM: 5,
      excludedSec: 0.4,
      computable: true,
    });
    const plan = runningPaceTilePlan(row);
    expect(plan!.note).not.toBe('No time excluded — every second of this activity is covered.');
    expect(plan!.note).toBe(
      `Excludes ${formatMetres(5)} over ${formatEffortDuration(0.4)} of recording gaps, pauses and unreliable segments.`
    );
  });
});
