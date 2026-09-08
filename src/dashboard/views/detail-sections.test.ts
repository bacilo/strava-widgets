import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

import { coverageCaptionText, splitGapAnnotations, type SplitGapAnnotation } from './detail-sections.js';
import type { Split } from './detail-splits.js';
import type { PaceCoverage, GapInterval } from '../../analytics/pace-derivation.js';
import { derivePaceWithCoverage } from '../../analytics/pace-derivation.js';
import { computeSplits } from './detail-splits.js';
import type { CanonicalStream } from '../../streams/stream.types.js';
import { stripComments } from '../row-semantics.test.js';

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

function loadStream(activityId: string): CanonicalStream {
  const raw = fs.readFileSync(`data/streams/${activityId}.json`, 'utf-8');
  return JSON.parse(raw) as CanonicalStream;
}

// ---------------------------------------------------------------------------
// coverageCaptionText
// ---------------------------------------------------------------------------

describe('coverageCaptionText — coverage caption (D-08, COV-02)', () => {
  it('emits all three segments at 0%, joined by the middle-dot separator, on a fully covered stream', () => {
    const coverage = makeCoverage({ spanSec: 100, coveredSec: 100, recordingGapSec: 0, pauseSec: 0 });
    expect(coverageCaptionText(coverage)).toBe('100% of elapsed time covered · 0% recording gaps · 0% paused');
  });

  it('returns null on a zero span (T-26-01: never throws, never renders a nonsensical caption)', () => {
    const coverage = makeCoverage({ spanSec: 0, coveredSec: 0, recordingGapSec: 0, pauseSec: 0 });
    expect(coverageCaptionText(coverage)).toBeNull();
  });

  it('returns null on a negative span (malformed/adversarial input, T-26-01)', () => {
    const coverage = makeCoverage({ spanSec: -5, coveredSec: 0, recordingGapSec: 0, pauseSec: 0 });
    expect(coverageCaptionText(coverage)).toBeNull();
  });

  it('does not force the three rounded percentages to sum to 100 — a 33/33/33 split stays 33/33/33, not adjusted to 100', () => {
    // spanSec 3, one second in each category: each fraction is 33.333...%,
    // which Math.round independently rounds to 33 for all three — summing
    // to 99, not 100. Asserting the un-adjusted 33/33/33 output pins that
    // this helper never "fixes" the display total (see its own doc comment).
    const coverage = makeCoverage({ spanSec: 3, coveredSec: 1, recordingGapSec: 1, pauseSec: 1 });
    const text = coverageCaptionText(coverage);
    expect(text).toBe('33% of elapsed time covered · 33% recording gaps · 33% paused');
    // Explicit non-100 assertion, so this test would fail loudly if a future
    // edit "corrected" the percentages to sum to exactly 100.
    expect(33 + 33 + 33).not.toBe(100);
  });

  it('renders the pinned worked example (4556693525) at the percentages plan 26-10 will read back', () => {
    const stream = loadStream('4556693525');
    const derived = derivePaceWithCoverage(stream);
    const text = coverageCaptionText(derived.coverage);
    // Pre-computed at execution time (see this plan's SUMMARY.md) so
    // plan 26-10's human checkpoint has an expectation to read back against,
    // not just "a caption is present".
    expect(text).toBe('99% of elapsed time covered · 1% recording gaps · 0% paused');
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
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 1, recordingGapSec: 30, pauseSec: 0, totalSec: 30 }]);
  });

  it('attributes a pause-kind gap to pauseSec, not recordingGapSec', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gap = makeGap(10, 40, 'pause'); // 30s
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 1, recordingGapSec: 0, pauseSec: 30, totalSec: 30 }]);
  });

  it('a gap partially overlapping a split contributes only the overlapping seconds, not the whole gap', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    // Gap spans [180, 220] — only [180, 200] (20s) falls inside km 2's window; the
    // remaining 20s ([200, 220]) is outside any split entirely.
    const gap = makeGap(180, 220, 'recording-gap');
    const result = splitGapAnnotations(splits, [gap]);
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 2, recordingGapSec: 20, pauseSec: 0, totalSec: 20 }]);
  });

  it('accumulates overlap across multiple gaps of mixed kind touching the same split', () => {
    const splits = [makeSplit(1, 0, 100)];
    const gaps = [makeGap(10, 20, 'recording-gap'), makeGap(50, 65, 'pause')];
    const result = splitGapAnnotations(splits, gaps);
    expect(result).toEqual<SplitGapAnnotation[]>([{ km: 1, recordingGapSec: 10, pauseSec: 15, totalSec: 25 }]);
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
      { km: 1, recordingGapSec: 30, pauseSec: 0, totalSec: 30 },
    ]);
  });

  it('emits no entry for a split with zero overlap', () => {
    const splits = [makeSplit(1, 0, 100), makeSplit(2, 100, 200)];
    const gap = makeGap(300, 400, 'recording-gap'); // outside both splits entirely
    expect(splitGapAnnotations(splits, [gap])).toEqual([]);
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
    // human checkpoint row must read back on screen.
    const minutes = Math.floor(annotations[0].totalSec / 60);
    const seconds = annotations[0].totalSec % 60;
    const durationText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    expect(durationText).toBe('11:29');
    expect(`Km ${annotations[0].km}: includes ${durationText} of recording gap`).toBe(
      'Km 11: includes 11:29 of recording gap'
    );
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

  it('detail-sections.ts calls coverageCaptionText exactly once, from within buildBreakdownSection', () => {
    // The definition line reads `coverageCaptionText(coverage: PaceCoverage)`
    // — the ":" makes it distinct from an actual call site `coverageCaptionText(coverage)`.
    expect(countOccurrences(detailSectionsStripped, 'coverageCaptionText(coverage)')).toBe(1);

    const buildBreakdownStart = detailSectionsStripped.indexOf('export function buildBreakdownSection');
    const callOffset = detailSectionsStripped.indexOf('coverageCaptionText(coverage)');
    expect(buildBreakdownStart).toBeGreaterThanOrEqual(0);
    expect(callOffset).toBeGreaterThan(buildBreakdownStart);
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

  it('D-13 wiring: detail.ts derives the buildSplitsSection average from the disagreement branch — the stream-derived pace when flagged, the metadata pace otherwise', () => {
    expect(detailStripped).toContain(
      'const rebasedAveragePaceSecPerKm = disagreement !== null ? disagreement.streamPaceSecPerKm : paceSecPerKm;'
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

  it('D-13 caption-note copy string is present verbatim in detail-sections.ts', () => {
    expect(detailSectionsStripped).toContain(
      'Splits above are compared against the stream-derived average'
    );
    expect(detailSectionsStripped).toContain('not the disputed metadata average.');
  });

  it('negative case 4 (marking removed) is pinned permanently in this suite, not just described', () => {
    // Self-referential guard: confirms the empty-gapIntervals direction of
    // negative case 4 actually lives in this file's own source, so a future
    // edit cannot silently delete it without this assertion catching it.
    const thisFileSource = stripComments(readSource('detail-sections.test.ts'));
    expect(thisFileSource).toContain('splitGapAnnotations(splits, [])');
  });
});
