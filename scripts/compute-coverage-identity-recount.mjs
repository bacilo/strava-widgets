/**
 * D-03's detector-free, gap-first, ARCHIVE-WIDE recount and artifact generator (33-CONTEXT.md
 * D-03, 33-VALIDATION.md Rule 2).
 *
 * WHY THIS EXISTS: `coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec` (the
 * four-way identity `classifyGaps` guarantees by construction) is near-tautological — it would
 * hold even if pass 3's containment test were inverted and marked the WRONG pairs unreliable,
 * because the four buckets exhaustively partition every pair exactly once by the shape of the
 * `if/else if/else` chain alone. The identity is a property of the CODE SHAPE, not of the
 * SEMANTICS. Rule 2 of 33-VALIDATION.md names the load-bearing assertion instead: `unreliableSec`
 * must equal an INDEPENDENTLY recounted segment-seconds total, produced by a genuinely different
 * traversal. This file is that second traversal.
 *
 * INDEPENDENCE (the zero-import + scoped-import discipline, Pitfall 11): this file has ZERO
 * `import`/`require`/dynamic-`import()` statements naming `unreliable-segments` (the detector's
 * own module), in any spelling, anywhere — `compute-coverage-identity-recount.test.mjs`'s
 * zero-import guard asserts this by scanning the comment-stripped source text. `classifyGaps`
 * (the shipped, WIRED classifier that internally calls the detector) IS imported, but its use is
 * structurally confined to `readShippedCoverage`, the ONE function in this file permitted to call
 * it — every other line of `recountActivity`'s own algorithm below is a fresh reimplementation,
 * never a call into the code under test. `classifyGaps` is read here only to obtain the NUMBER
 * under test (`unreliableSec`), never as a computation dependency this recount's own arithmetic
 * relies on. `classifyGapsThreeWay` (the PRE-detector gap list) and the two `GAP_PROFILE_*`
 * constants are imported freely — neither touches the detector; the first is the pre-detector
 * split D-01's time-movement finding measures FROM, the second is a pair of plain numeric
 * thresholds this file needs to reproduce the shipped D-05 tiering rule for its own reporting.
 *
 * TRAVERSAL, DELIBERATELY MIRRORED FROM `scripts/compute-unreliable-segment-recount.mjs` (Phase
 * 32's single-activity, gap-adjacent-only analog) BUT EXTENDED to all three mechanisms: the
 * detector (`src/analytics/unreliable-segments.ts`) is run-first — it finds advancing/fast runs
 * archive-wide, then checks gap adjacency. This recount is gap-first — for each local recording
 * gap it walks backward/forward accumulating consecutive fast steps, exactly like the Phase 32
 * analog — but it ALSO emits a row for every OTHER kept run in every inter-gap segment (one that
 * touches no gap at all), classified `hidden-pause` vs `isolated-jump` by the same
 * `metres >= hiddenPauseMinMetres` rule the detector itself uses. The Phase 32 analog's own
 * `computeRunsInSegment` already found every such run; it only ever turned the two
 * boundary-touching ones into output rows. Emitting a row for every OTHER kept run is the new
 * logic this file adds.
 *
 * ZERO-SHARED-VOCABULARY: `LOCAL_GAP_THRESHOLD_SEC` is a LOCAL DUPLICATE of
 * `RECORDING_GAP_ABS_THRESHOLD_SEC` (`src/analytics/pace-derivation.ts`), never imported from
 * there. `LOCAL_SPEED_LIMIT_MPS`/`LOCAL_EXCESS_FLOOR_M`/`LOCAL_HIDDEN_PAUSE_MIN_METRES` are parsed
 * out of `32-CALIBRATION.md`'s own "## Chosen constants" table (the same
 * `parseCalibrationArtifact`-style approach `compute-unreliable-segment-recount.mjs` already
 * established), rather than hand-copied as literals — a future recalibration cannot silently
 * desynchronise this recount from the shipped constants. Parsing proved straightforward (the
 * artifact's table shape is stable and already has a working precedent to copy), so no literal
 * fallback was needed.
 *
 * THE BOUND ON THIS RECOUNT'S CLAIM: it independently re-derives `unreliableSec` for EVERY
 * committed stream and compares it against the shipped, wired total. It does NOT and cannot
 * arbitrate whether the calibrated speed limit / excess floor / hidden-pause boundary themselves
 * are the right numbers (that is `compute-unreliable-segment-calibration.mjs`'s job) — it takes
 * those calibrated constants as given and asks only "does the detector's own bookkeeping, given
 * those constants, correctly total to what it claims."
 *
 * MEASURED, NOT ASSUMED (the local gap definition covers BOTH recording gaps AND pause spans):
 * an earlier draft of this file modelled RECORDING gaps only (`dt > LOCAL_GAP_THRESHOLD_SEC`),
 * mirroring the Phase 32 single-activity analog's own documented scope ("covers only RECORDING
 * gaps, which is sufficient for 3475724402 because every one of its gaps is a recording gap").
 * Running the archive-wide comparison against that draft surfaced 10 genuine mismatches (out of
 * 1874 streams) — every one of them a burst chaining a recording-gap directly into an ADJACENT
 * `pause` span (e.g. `11335618229`: a recording-gap `[2024, 2119]` touches a pause `[2119, 2124]`
 * touches a burst starting at `2124`; the shipped detector's own `isGapPair`
 * (`src/analytics/unreliable-segments.ts`) treats EITHER kind as a gap block indiscriminately, so
 * this three-way chain becomes ONE `gap-adjacent` segment with `gapCount: 2`). The Phase 32
 * analog's own narrower scope is safe only for its ONE pinned activity, not archive-wide. Fixed by
 * reconstructing the FULL pre-detector gap definition (recording-gap strict-priority over pause,
 * `LOCAL_PAUSE_GAP_P90_MULTIPLIER` below) — reimplemented fresh in this file
 * (`localNonCoveredSpans`, never calling `classifyGapsThreeWay` for this purpose), not because
 * re-deriving pause classification is itself under test here (it is Phase 26's own, separately
 * tested pre-existing behaviour, already the one canonical gap definition per D-14,
 * `33-01-SUMMARY.md`) but because `recountActivity`'s gap-first walk needs to know about every
 * pair the shipped detector treats as a gap, not only the recording-gap ones, to chain bursts the
 * same way the shipped detector does. `gapCount === 0` still structurally guarantees a
 * `hidden-pause`/`isolated-jump` segment touches NEITHER kind — this fix changes only which pairs
 * `recountActivity` recognises as gap-adjacent-eligible boundaries, never the hidden-pause/
 * isolated-jump classification rule itself. After this fix the archive-wide recount agreement
 * check reports zero mismatches (see the generated artifact) — the proof, not an assumption.
 *
 * `readShippedCoverage`'s own docblock states the scoped-import rule again, next to the one call
 * site it governs.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { classifyGaps, classifyGapsThreeWay } from '../dist/analytics/pace-derivation.js';
import { GAP_PROFILE_SEVERE_FRACTION, GAP_PROFILE_MINOR_FRACTION } from '../dist/analytics/pace-quality.js';

import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data', 'streams');
const CALIBRATION_ARTIFACT_PATH = join(
  ROOT_DIR,
  '.planning',
  'phases',
  '32-unreliable-segment-detection-calibration',
  '32-CALIBRATION.md'
);
const OUT_ARTIFACT_PATH = join(
  ROOT_DIR,
  '.planning',
  'phases',
  '33-coverage-integration-pace-clipping-segment-signal',
  '33-COVERAGE-IDENTITY.md'
);

const CHOSEN_CONSTANTS_HEADING = '## Chosen constants';

/**
 * A local duplicate of `RECORDING_GAP_ABS_THRESHOLD_SEC` (`src/analytics/pace-derivation.ts:42`),
 * NOT imported from there — D-03's zero-shared-vocabulary discipline forbids reaching into
 * `pace-derivation.ts`'s own neighbourhood for this too. See the module docblock's KNOWN SCOPE
 * LIMIT paragraph for why covering recording gaps only is sufficient archive-wide.
 */
const LOCAL_GAP_THRESHOLD_SEC = 10;

const MECHANISMS = ['gap-adjacent', 'hidden-pause', 'isolated-jump'];

/**
 * Parses `UNRELIABLE_SPEED_LIMIT_MPS`, `UNRELIABLE_EXCESS_FLOOR_M` and `HIDDEN_PAUSE_MIN_METRES`
 * out of `32-CALIBRATION.md`'s own "## Chosen constants" markdown table — the same
 * `parseCalibrationArtifact`-style row-extraction approach
 * `scripts/compute-unreliable-segment-recount.mjs` already established for the first two of these
 * three constants, extended here to the third. Fails closed (never throws) on: non-string input,
 * a missing heading, a missing row, or a non-numeric value.
 */
export function parseChosenConstants(markdown) {
  if (typeof markdown !== 'string') {
    return { ok: false, reason: 'artifact content is not a string' };
  }

  const headingIdx = markdown.indexOf(CHOSEN_CONSTANTS_HEADING);
  if (headingIdx === -1) {
    return { ok: false, reason: `missing "${CHOSEN_CONSTANTS_HEADING}" heading` };
  }

  const nextHeadingIdx = markdown.indexOf('\n## ', headingIdx + CHOSEN_CONSTANTS_HEADING.length);
  const section =
    nextHeadingIdx === -1 ? markdown.slice(headingIdx) : markdown.slice(headingIdx, nextHeadingIdx);

  function extractConstant(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\|\\s*`' + escaped + '`\\s*\\|\\s*([^|]+?)\\s*\\|');
    const match = section.match(re);
    if (!match) return { found: false };
    const raw = match[1].trim();
    const value = Number(raw);
    if (raw.length === 0 || !Number.isFinite(value)) return { found: true, valid: false, raw };
    return { found: true, valid: true, value };
  }

  const names = [
    ['speedLimitMps', 'UNRELIABLE_SPEED_LIMIT_MPS'],
    ['excessFloorMetres', 'UNRELIABLE_EXCESS_FLOOR_M'],
    ['hiddenPauseMinMetres', 'HIDDEN_PAUSE_MIN_METRES'],
  ];

  const constants = {};
  for (const [key, constantName] of names) {
    const result = extractConstant(constantName);
    if (!result.found) {
      return { ok: false, reason: `missing ${constantName} row in "${CHOSEN_CONSTANTS_HEADING}"` };
    }
    if (!result.valid) {
      return {
        ok: false,
        reason: `${constantName} value is not numeric: ${JSON.stringify(result.raw)}`,
      };
    }
    constants[key] = result.value;
  }

  return { ok: true, constants };
}

/**
 * This recount's own stream validation — never imports `validateStreamSeries`
 * (`src/analytics/best-effort-utils.ts`). Checks: both are arrays of equal length >= 2, every
 * value is a finite number, and `t`/`d` are non-decreasing. Never throws.
 */
export function checkStream(t, d) {
  if (!Array.isArray(t) || !Array.isArray(d)) {
    return { ok: false, reason: 't and d must both be arrays' };
  }
  if (t.length !== d.length) {
    return { ok: false, reason: `t and d have different lengths (${t.length} vs ${d.length})` };
  }
  if (t.length < 2) {
    return { ok: false, reason: `t and d must have at least 2 samples (got ${t.length})` };
  }
  for (let i = 0; i < t.length; i++) {
    if (typeof t[i] !== 'number' || !Number.isFinite(t[i])) {
      return { ok: false, reason: `t[${i}] is not a finite number: ${JSON.stringify(t[i])}` };
    }
    if (typeof d[i] !== 'number' || !Number.isFinite(d[i])) {
      return { ok: false, reason: `d[${i}] is not a finite number: ${JSON.stringify(d[i])}` };
    }
  }
  for (let i = 1; i < t.length; i++) {
    if (t[i] < t[i - 1]) {
      return { ok: false, reason: `t is not non-decreasing at index ${i} (${t[i - 1]} -> ${t[i]})` };
    }
    if (d[i] < d[i - 1]) {
      return { ok: false, reason: `d is not non-decreasing at index ${i} (${d[i - 1]} -> ${d[i]})` };
    }
  }
  return { ok: true };
}

/**
 * Returns spans for maximal runs of consecutive pairs with
 * `t[i+1] - t[i] > LOCAL_GAP_THRESHOLD_SEC`, as `[{ startIndex, endIndex, startSec, endSec }]`.
 * Assumes `checkStream(t, d).ok` already holds.
 */
export function localGapSpans(t, d) {
  const spans = [];
  const n = t.length;
  let k = 0;
  while (k < n - 1) {
    if (t[k + 1] - t[k] > LOCAL_GAP_THRESHOLD_SEC) {
      const startIndex = k;
      let endIndex = k + 1;
      while (endIndex < n - 1 && t[endIndex + 1] - t[endIndex] > LOCAL_GAP_THRESHOLD_SEC) {
        endIndex += 1;
      }
      spans.push({ startIndex, endIndex, startSec: t[startIndex], endSec: t[endIndex] });
      k = endIndex;
    } else {
      k += 1;
    }
  }
  return spans;
}

/**
 * A local duplicate of `PAUSE_GAP_P90_MULTIPLIER` (`src/analytics/pace-derivation.ts`), never
 * imported from there. See the module docblock's "MEASURED, NOT ASSUMED" paragraph for why the
 * gap-first walk needs to know about pause spans too, not only recording gaps.
 */
const LOCAL_PAUSE_GAP_P90_MULTIPLIER = 5;

/** R-7 linear-interpolation quantile, reimplemented fresh from `pace-derivation.ts`'s own
 * `quantile` (same formula, independent code) — `pos = (len - 1) * q`, interpolated. */
function localQuantile(sortedAsc, q) {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo]);
}

/** Reimplemented fresh from `pace-derivation.ts`'s own `advanceIntervals` — the real-time gap
 * between each pair of samples where `d` actually advances, seeded from the stream's own start. */
function localAdvanceIntervals(t, d) {
  const n = Math.min(t.length, d.length);
  if (n === 0) return [];
  const result = [];
  let lastAdvanceT = t[0];
  for (let i = 1; i < n; i++) {
    if (d[i] > d[i - 1]) {
      result.push(t[i] - lastAdvanceT);
      lastAdvanceT = t[i];
    }
  }
  return result.sort((a, b) => a - b);
}

/** Reimplemented fresh from `pace-derivation.ts`'s own `computeFlatRunDurations` — per pair index,
 * the duration of the maximal distance-flat run it belongs to, or `-1` if not distance-flat. */
function localFlatRunDurations(t, d, n) {
  const flatRunDuration = new Array(n - 1).fill(-1);
  let i = 0;
  while (i < n - 1) {
    if (d[i + 1] - d[i] <= 0) {
      let j = i;
      while (j < n - 1 && d[j + 1] - d[j] <= 0) j++;
      const duration = t[j] - t[i];
      for (let k = i; k < j; k++) flatRunDuration[k] = duration;
      i = j;
    } else {
      i++;
    }
  }
  return flatRunDuration;
}

/**
 * Returns spans for maximal runs of consecutive pairs classified as EITHER a recording gap
 * (`dt > LOCAL_GAP_THRESHOLD_SEC`) OR a pause (belongs to a distance-flat run whose duration
 * exceeds the resolved scale-relative pause threshold) — the FULL pre-detector gap definition the
 * shipped detector's own `isGapPair` (`src/analytics/unreliable-segments.ts`) is fed, reimplemented
 * fresh here (never calling `classifyGapsThreeWay`) so `recountActivity`'s chain walk recognises
 * every boundary the shipped detector does. Recording-gap takes strict priority over pause,
 * matching `pace-derivation.ts`'s own `classifyPairKinds` priority order exactly. Assumes
 * `checkStream(t, d).ok` already holds.
 */
function localNonCoveredSpans(t, d) {
  const n = t.length;
  const intervals = localAdvanceIntervals(t, d);
  const pauseThresholdSec =
    intervals.length === 0
      ? Infinity
      : LOCAL_PAUSE_GAP_P90_MULTIPLIER * localQuantile(intervals, 0.9);
  const flatRunDuration = localFlatRunDurations(t, d, n);

  const spans = [];
  let openStart = -1;
  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    const isNonCovered =
      dt > LOCAL_GAP_THRESHOLD_SEC || (flatRunDuration[i] >= 0 && flatRunDuration[i] > pauseThresholdSec);
    if (isNonCovered) {
      if (openStart === -1) openStart = i;
    } else if (openStart !== -1) {
      spans.push({ startIndex: openStart, endIndex: i, startSec: t[openStart], endSec: t[i] });
      openStart = -1;
    }
  }
  if (openStart !== -1) {
    spans.push({
      startIndex: openStart,
      endIndex: n - 1,
      startSec: t[openStart],
      endSec: t[n - 1],
    });
  }
  return spans;
}

/**
 * Forward-folds the covered pairs of one segment (`[segStart, segEnd]` sample indices, no local
 * gap inside) into steps: a step's end is the end index of an advancing pair (metres > 0 AND
 * seconds > 0); any immediately preceding zero-advance or zero-duration pairs are folded into
 * that step, extending its start backward. A pending step still open when the segment ends is
 * dropped — clean non-advancing time never becomes a step. Reimplemented here (not imported) from
 * `scripts/compute-unreliable-segment-recount.mjs`'s own `foldSegment`.
 */
function foldSegment(t, d, segStart, segEnd) {
  const steps = [];
  let pendingStart = segStart;
  for (let i = segStart; i < segEnd; i++) {
    const dt = t[i + 1] - t[i];
    const dd = d[i + 1] - d[i];
    if (dd > 0 && dt > 0) {
      steps.push({ startIndex: pendingStart, endIndex: i + 1 });
      pendingStart = i + 1;
    }
  }
  return steps;
}

function stepMetres(t, d, step) {
  return d[step.endIndex] - d[step.startIndex];
}
function stepSeconds(t, d, step) {
  return t[step.endIndex] - t[step.startIndex];
}
function isStepFast(t, d, step, speedLimitMps) {
  return stepMetres(t, d, step) > speedLimitMps * stepSeconds(t, d, step);
}

/**
 * Computes every maximal run of contiguous fast steps within one segment, each labelled `isBurst`
 * when its aggregate excess (`metres - speedLimitMps * seconds`) exceeds `excessFloorMetres`. A
 * run that is fast but does not clear the floor is not a burst. Every maximal fast run in the
 * segment is returned — not only the ones touching a segment boundary — which is what lets
 * `recountActivity` emit a row for hidden-pause/isolated-jump runs, not just gap-adjacent ones.
 */
function computeRunsInSegment(t, d, segStart, segEnd, speedLimitMps, excessFloorMetres) {
  const steps = foldSegment(t, d, segStart, segEnd);
  const runs = [];
  let i = 0;
  while (i < steps.length) {
    if (isStepFast(t, d, steps[i], speedLimitMps)) {
      let j = i;
      while (j + 1 < steps.length && isStepFast(t, d, steps[j + 1], speedLimitMps)) {
        j += 1;
      }
      const startIndex = steps[i].startIndex;
      const endIndex = steps[j].endIndex;
      const metres = d[endIndex] - d[startIndex];
      const seconds = t[endIndex] - t[startIndex];
      const excess = metres - speedLimitMps * seconds;
      runs.push({ startIndex, endIndex, metres, seconds, excess, isBurst: excess > excessFloorMetres });
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return runs;
}

/** The last run in `runs`, if it is a kept burst AND ends exactly at `boundaryIndex`. */
function lastBurstEndingAt(runs, boundaryIndex) {
  if (!runs || runs.length === 0) return null;
  const last = runs[runs.length - 1];
  return last.endIndex === boundaryIndex && last.isBurst ? last : null;
}

/** The first run in `runs`, if it is a kept burst AND starts exactly at `boundaryIndex`. */
function firstBurstStartingAt(runs, boundaryIndex) {
  if (!runs || runs.length === 0) return null;
  const first = runs[0];
  return first.startIndex === boundaryIndex && first.isBurst ? first : null;
}

/**
 * Merges rows that share or abut a sample-index boundary into one row (D-01's whole-merged-
 * segment rule), so `unreliableSec` never double-counts a shared boundary. `metres`/`seconds` are
 * always recomputed from the MERGED row's own `[startIndex, endIndex]` endpoints (never summed
 * from the inputs), which is what makes the merge safe even if two input rows overlapped. The
 * merged row's mechanism keeps `gap-adjacent` if either input was `gap-adjacent`, else
 * `hidden-pause` if either was `hidden-pause`, else `isolated-jump` — the same priority the
 * detector's own `mechanism` field implicitly carries (a segment touching a gap is never anything
 * else). In practice this rarely fires: `recountActivity`'s own gap-first chain walk (mirroring
 * the Phase 32 analog exactly) already merges every gap-adjacent chain before this function ever
 * runs, and a hidden-pause/isolated-jump run cannot itself be adjacent to another kept run inside
 * the same segment (two maximal fast runs are always separated by at least one non-fast step) —
 * this function exists as a fail-safe against the rare cross-segment edge case, not as the
 * primary merge mechanism.
 */
function mergeAdjacentRows(t, d, rows) {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => a.startIndex - b.startIndex);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.startIndex <= prev.endIndex) {
      const startIndex = prev.startIndex;
      const endIndex = Math.max(prev.endIndex, cur.endIndex);
      const mechanism =
        prev.mechanism === 'gap-adjacent' || cur.mechanism === 'gap-adjacent'
          ? 'gap-adjacent'
          : prev.mechanism === 'hidden-pause' || cur.mechanism === 'hidden-pause'
            ? 'hidden-pause'
            : 'isolated-jump';
      merged[merged.length - 1] = {
        startIndex,
        endIndex,
        startSec: t[startIndex],
        endSec: t[endIndex],
        seconds: t[endIndex] - t[startIndex],
        metres: d[endIndex] - d[startIndex],
        mechanism,
      };
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * The detector-free, gap-first, all-three-mechanisms recount for ONE activity (D-03, extending
 * the Phase 32 gap-adjacent-only analog). Walks every inter-gap segment (using
 * `localNonCoveredSpans`'s FULL pre-detector gap definition — recording-gap AND pause), finds
 * every kept (isBurst) run via `computeRunsInSegment`, and emits a row for each:
 *   - a run touching a local gap boundary chains with that gap (and any further
 *     touching gap/burst pairs, D-07's dedup) into one `gap-adjacent` row — the exact walk
 *     `scripts/compute-unreliable-segment-recount.mjs`'s own `recountGapFirst` performs, extended
 *     here to also track WHICH runs were consumed so the remaining loop below never double-emits
 *     them;
 *   - every OTHER kept run (touching no gap) becomes its own row, classified `hidden-pause` when
 *     `metres >= hiddenPauseMinMetres`, else `isolated-jump` — the same boundary rule the
 *     detector itself uses (`src/analytics/unreliable-segments.ts`'s own `mechanism` assignment).
 * Rows are then merged wherever they share or abut a boundary (`mergeAdjacentRows`) before
 * `unreliableSec` is summed, matching D-01's whole-merged-segment rule.
 *
 * Fails closed: a malformed stream (`checkStream`) or invalid/missing params returns
 * `{ ok: false, reason }` rather than throwing or returning a number.
 */
export function recountActivity(t, d, params) {
  const streamCheck = checkStream(t, d);
  if (!streamCheck.ok) return { ok: false, reason: streamCheck.reason };

  const speedLimitMps = params ? params.speedLimitMps : undefined;
  const excessFloorMetres = params ? params.excessFloorMetres : undefined;
  const hiddenPauseMinMetres = params ? params.hiddenPauseMinMetres : undefined;

  if (typeof speedLimitMps !== 'number' || !Number.isFinite(speedLimitMps) || speedLimitMps <= 0) {
    return {
      ok: false,
      reason: `speedLimitMps must be a finite positive number, got ${JSON.stringify(speedLimitMps)}`,
    };
  }
  if (
    typeof excessFloorMetres !== 'number' ||
    !Number.isFinite(excessFloorMetres) ||
    excessFloorMetres <= 0
  ) {
    return {
      ok: false,
      reason: `excessFloorMetres must be a finite positive number, got ${JSON.stringify(excessFloorMetres)}`,
    };
  }
  if (
    typeof hiddenPauseMinMetres !== 'number' ||
    !Number.isFinite(hiddenPauseMinMetres) ||
    hiddenPauseMinMetres < 0
  ) {
    return {
      ok: false,
      reason: `hiddenPauseMinMetres must be a finite non-negative number, got ${JSON.stringify(hiddenPauseMinMetres)}`,
    };
  }

  // Uses the FULL pre-detector gap definition (recording-gap AND pause), not `localGapSpans`
  // alone — see the module docblock's "MEASURED, NOT ASSUMED" paragraph for why.
  const gaps = localNonCoveredSpans(t, d);
  const n = t.length;

  const segments = [];
  let prevEnd = 0;
  for (const gap of gaps) {
    segments.push({ start: prevEnd, end: gap.startIndex });
    prevEnd = gap.endIndex;
  }
  segments.push({ start: prevEnd, end: n - 1 });

  const segRuns = segments.map((s) =>
    computeRunsInSegment(t, d, s.start, s.end, speedLimitMps, excessFloorMetres)
  );
  const consumedRun = segRuns.map((runs) => new Array(runs.length).fill(false));
  const consumedGap = new Array(gaps.length).fill(false);

  const gapAdjacentRows = [];

  for (let g = 0; g < gaps.length; g++) {
    if (consumedGap[g]) continue;

    const beforeRuns = segRuns[g];
    const beforeBurst = lastBurstEndingAt(beforeRuns, gaps[g].startIndex);
    const afterBurst = firstBurstStartingAt(segRuns[g + 1], gaps[g].endIndex);

    if (!beforeBurst && !afterBurst) continue;

    const chainGapIndices = [g];
    const chainBursts = [];
    if (beforeBurst) {
      chainBursts.push(beforeBurst);
      consumedRun[g][beforeRuns.length - 1] = true;
    }

    // `firstBurstStartingAt` always returns `segRuns[cursorGap + 1][0]` (the FIRST run of the
    // following segment) or null — so marking `consumedRun[cursorGap + 1][0]` below is always the
    // correct index for whatever `cursorBurst` currently holds.
    let cursorBurst = afterBurst;
    let cursorGap = g;
    while (cursorBurst) {
      consumedRun[cursorGap + 1][0] = true;
      chainBursts.push(cursorBurst);
      const nextGapIdx = cursorGap + 1;
      if (nextGapIdx < gaps.length && cursorBurst.endIndex === gaps[nextGapIdx].startIndex) {
        chainGapIndices.push(nextGapIdx);
        consumedGap[nextGapIdx] = true;
        cursorGap = nextGapIdx;
        cursorBurst = firstBurstStartingAt(segRuns[cursorGap + 1], gaps[cursorGap].endIndex);
      } else {
        cursorBurst = null;
      }
    }

    const firstGap = gaps[chainGapIndices[0]];
    const lastGap = gaps[chainGapIndices[chainGapIndices.length - 1]];
    const startIndex = beforeBurst ? beforeBurst.startIndex : firstGap.startIndex;
    const lastBurst = chainBursts.length > 0 ? chainBursts[chainBursts.length - 1] : null;
    const endIndex =
      lastBurst && lastBurst.endIndex > lastGap.endIndex ? lastBurst.endIndex : lastGap.endIndex;

    gapAdjacentRows.push({
      startIndex,
      endIndex,
      startSec: t[startIndex],
      endSec: t[endIndex],
      seconds: t[endIndex] - t[startIndex],
      metres: d[endIndex] - d[startIndex],
      mechanism: 'gap-adjacent',
    });
  }

  const otherRows = [];
  for (let s = 0; s < segRuns.length; s++) {
    for (let r = 0; r < segRuns[s].length; r++) {
      const run = segRuns[s][r];
      if (!run.isBurst || consumedRun[s][r]) continue;
      const mechanism = run.metres >= hiddenPauseMinMetres ? 'hidden-pause' : 'isolated-jump';
      otherRows.push({
        startIndex: run.startIndex,
        endIndex: run.endIndex,
        startSec: t[run.startIndex],
        endSec: t[run.endIndex],
        seconds: run.seconds,
        metres: run.metres,
        mechanism,
      });
    }
  }

  const rows = mergeAdjacentRows(t, d, [...gapAdjacentRows, ...otherRows]);
  const unreliableSec = rows.reduce((sum, r) => sum + r.seconds, 0);

  return { ok: true, rows, unreliableSec };
}

/**
 * The ONE function in this file permitted to call `classifyGaps` — the shipped, WIRED classifier
 * that internally calls `detectUnreliableSegments`. `classifyGaps` is called ONLY here, and only
 * to READ the number under test (`unreliableSec`, and the other three coverage totals for the
 * identity check), never as a computation dependency `recountActivity`'s own algorithm relies on.
 * `compute-coverage-identity-recount.test.mjs`'s scoped-import guard asserts every occurrence of
 * the whole word `classifyGaps` in this file's comment-stripped source falls either on the single
 * import line at the top of this file or inside this function's own body.
 */
export function readShippedCoverage(t, d) {
  return classifyGaps(t, d);
}

/**
 * Compares, per activity in `entries` (`[{ id, t, d }]`): the four-term identity to a 1e-6 second
 * tolerance, and `readShippedCoverage(t, d).unreliableSec` against
 * `recountActivity(t, d, params).unreliableSec` to the same tolerance — the load-bearing check.
 * Accumulates violations/mismatches with per-activity detail; a stream failing `checkStream` (or
 * whose recount fails closed) is counted as `skipped`, never crashing the scan. `pass` is true
 * only when both lists are empty AND `scannedCount > 0` (never vacuously PASS on an empty scan).
 * Also accumulates per-mechanism totals (activities/segments/metres/seconds), matching
 * `32-CALIBRATION.md`'s own "Figures of record" shape.
 */
export function evaluateArchive(entries, params) {
  const identityViolations = [];
  const recountMismatches = [];
  const skipped = [];
  let scannedCount = 0;

  const mechanismTotals = {};
  for (const m of MECHANISMS) {
    mechanismTotals[m] = { activities: 0, segments: 0, metres: 0, seconds: 0 };
  }
  let totalActivitiesWithUnreliable = 0;
  let totalUnreliableSec = 0;

  for (const entry of entries) {
    scannedCount += 1;

    const streamCheck = checkStream(entry.t, entry.d);
    if (!streamCheck.ok) {
      skipped.push({ id: entry.id, reason: streamCheck.reason });
      continue;
    }

    const shipped = readShippedCoverage(entry.t, entry.d);
    const identitySum =
      shipped.coveredSec + shipped.recordingGapSec + shipped.pauseSec + shipped.unreliableSec;
    if (Math.abs(identitySum - shipped.spanSec) > 1e-6) {
      identityViolations.push({
        id: entry.id,
        spanSec: shipped.spanSec,
        sum: identitySum,
        diff: identitySum - shipped.spanSec,
      });
    }

    const recount = recountActivity(entry.t, entry.d, params);
    if (!recount.ok) {
      skipped.push({ id: entry.id, reason: `recount failed: ${recount.reason}` });
      continue;
    }

    if (Math.abs(recount.unreliableSec - shipped.unreliableSec) > 1e-6) {
      recountMismatches.push({
        id: entry.id,
        shippedUnreliableSec: shipped.unreliableSec,
        recountUnreliableSec: recount.unreliableSec,
        diff: recount.unreliableSec - shipped.unreliableSec,
      });
    }

    if (recount.rows.length > 0) {
      totalActivitiesWithUnreliable += 1;
    }
    totalUnreliableSec += recount.unreliableSec;

    const mechanismsPresent = new Set();
    for (const row of recount.rows) {
      mechanismTotals[row.mechanism].segments += 1;
      mechanismTotals[row.mechanism].metres += row.metres;
      mechanismTotals[row.mechanism].seconds += row.seconds;
      mechanismsPresent.add(row.mechanism);
    }
    for (const m of mechanismsPresent) {
      mechanismTotals[m].activities += 1;
    }
  }

  return {
    scannedCount,
    skipped,
    identityViolations,
    recountMismatches,
    mechanismTotals,
    totalActivitiesWithUnreliable,
    totalUnreliableSec,
    pass: identityViolations.length === 0 && recountMismatches.length === 0 && scannedCount > 0,
  };
}

/** Reproduces `tierGapProfileFromCoverage`'s own bucketing rule (`src/analytics/pace-quality.ts`,
 * private/unexported there) from its two EXPORTED threshold constants — never a re-derivation of
 * the thresholds themselves, only the `>`/`>`/`else` bucketing they already ship with. */
function tierFromFraction(gapFraction) {
  if (gapFraction > GAP_PROFILE_SEVERE_FRACTION) return 'severe';
  if (gapFraction > GAP_PROFILE_MINOR_FRACTION) return 'minor';
  return 'none';
}

const TIER_NAMES = ['none', 'minor', 'severe', 'not-computable'];

/**
 * D-01 (time movement) and D-05 (tier migration) findings, computed together in one pass over
 * `entries` since both need the same `classifyGapsThreeWay` (pre-detector) vs
 * `readShippedCoverage` (post-detector, shipped) comparison per activity.
 *
 * D-01: archive-wide totals of seconds that moved OUT of `recordingGapSec` / `pauseSec` / (by
 * construction) `coveredSec`, INTO `unreliableSec`. Only `gap-adjacent` segments can move
 * recording-gap/pause seconds — a `hidden-pause`/`isolated-jump` segment has `gapCount === 0` by
 * the detector's own construction (`src/analytics/unreliable-segments.ts`'s own `mechanism`
 * assignment: `gapCount > 0 ? 'gap-adjacent' : ...`), so it can never have touched a pre-detector
 * gap of EITHER kind — its seconds move exclusively out of `coveredSec`.
 *
 * D-05: before/after tier per activity, under the two-term (`(recordingGapSec + pauseSec) /
 * spanSec`, pre-widening) vs three-term (`(recordingGapSec + pauseSec + unreliableSec) /
 * spanSec`, shipped) numerator, bucketed via `tierFromFraction`. `spanSec === 0` reports
 * `not-computable` on that side, matching `tierGapProfileFromCoverage`'s own `spanSec === 0`
 * branch.
 */
export function computeArchiveWideFindings(entries) {
  let recordingGapMovedSec = 0;
  let pauseMovedSec = 0;
  let coveredMovedSec = 0;

  const tierMatrix = {};
  for (const before of TIER_NAMES) {
    tierMatrix[before] = {};
    for (const after of TIER_NAMES) tierMatrix[before][after] = 0;
  }
  let changedCount = 0;
  let computedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const streamCheck = checkStream(entry.t, entry.d);
    if (!streamCheck.ok) {
      skippedCount += 1;
      continue;
    }

    const threeWay = classifyGapsThreeWay(entry.t, entry.d);
    const shipped = readShippedCoverage(entry.t, entry.d);

    recordingGapMovedSec += threeWay.recordingGapSec - shipped.recordingGapSec;
    pauseMovedSec += threeWay.pauseSec - shipped.pauseSec;
    coveredMovedSec += threeWay.coveredSec - shipped.coveredSec;

    const beforeTier =
      threeWay.spanSec === 0
        ? 'not-computable'
        : tierFromFraction((threeWay.recordingGapSec + threeWay.pauseSec) / threeWay.spanSec);
    const afterTier =
      shipped.spanSec === 0
        ? 'not-computable'
        : tierFromFraction(
            (shipped.recordingGapSec + shipped.pauseSec + shipped.unreliableSec) / shipped.spanSec
          );

    tierMatrix[beforeTier][afterTier] += 1;
    computedCount += 1;
    if (beforeTier !== afterTier) changedCount += 1;
  }

  return {
    recordingGapMovedSec,
    pauseMovedSec,
    coveredMovedSec,
    tierMatrix,
    changedCount,
    computedCount,
    skippedCount,
  };
}

function pct(part, whole) {
  if (whole === 0) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function renderMechanismTable(mechanismTotals, totalActivitiesWithUnreliable, streamCount) {
  const lines = [
    '| Mechanism | Activities | / stream files | Segments | Metres | Seconds |',
    '|---|---|---|---|---|---|',
  ];
  let totalSegments = 0;
  let totalMetres = 0;
  let totalSeconds = 0;
  for (const m of MECHANISMS) {
    const t = mechanismTotals[m];
    totalSegments += t.segments;
    totalMetres += t.metres;
    totalSeconds += t.seconds;
    lines.push(
      `| ${m} | ${t.activities} | ${t.activities} of ${streamCount} (${pct(t.activities, streamCount)}) | ${t.segments} | ${t.metres.toFixed(1)} m | ${t.seconds.toFixed(1)} s |`
    );
  }
  lines.push(
    `| total (distinct activities) | ${totalActivitiesWithUnreliable} | ${totalActivitiesWithUnreliable} of ${streamCount} (${pct(totalActivitiesWithUnreliable, streamCount)}) | ${totalSegments} | ${totalMetres.toFixed(1)} m | ${totalSeconds.toFixed(1)} s |`
  );
  lines.push(
    '',
    '_Per-mechanism activity counts may sum to more than the distinct total above — one activity can carry segments of more than one mechanism._'
  );
  return lines.join('\n');
}

function renderTierMatrix(tierMatrix) {
  const lines = [
    '| Before \\ After | none | minor | severe | not-computable |',
    '|---|---|---|---|---|',
  ];
  for (const before of TIER_NAMES) {
    const row = TIER_NAMES.map((after) => tierMatrix[before][after]);
    lines.push(`| ${before} | ${row.join(' | ')} |`);
  }
  return lines.join('\n');
}

function renderViolationList(items, formatter, label) {
  if (items.length === 0) return `_None — ${label}._`;
  return items.map(formatter).join('\n');
}

/**
 * Content-addressed provenance (2026-09-21). An earlier draft embedded `git rev-parse HEAD`, which
 * made the byte-identical-regeneration contract unsatisfiable for a COMMITTED artifact: committing
 * the file moves HEAD, so the next regeneration always differs. These ids instead name the run's
 * actual inputs — the committed stream archive's git tree (the calibration constants are already listed
 * above it). Classifier SOURCE hashes are deliberately absent: plan 33-08 uses this artifact's
 * byte-identity across a source edit as its proof that the edit changed no detection outcome.
 */
function gitId(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown (git failed)';
  }
}

function inputProvenance() {
  return {
    streamsTree: gitId('rev-parse HEAD:data/streams'),
  };
}

function renderArtifact({
  streamCount,
  computableCount,
  evalResult,
  findings,
  constants,
  provenance,
}) {
  const lines = [];

  lines.push('# Phase 33 — Coverage Identity Recount (COV-03)');
  lines.push('');
  lines.push(
    `Machine-written by \`npm run compute-coverage-identity-recount\`; never hand-edit. Regenerating this file against an unchanged archive and unchanged classifier behaviour produces a byte-identical result, including after this file is committed — provenance below is content-addressed, not a commit hash, and — no wall-clock timestamp appears anywhere below.`
  );
  lines.push('');

  lines.push('## Method');
  lines.push('');
  lines.push(
    `The archive-wide four-way identity (\`coveredSec + recordingGapSec + pauseSec + unreliableSec === spanSec\`) is a structural property of an exhaustive, mutually-exclusive pair partition — it holds even if the WRONG pairs were classified \`unreliable\`, because the partition shape guarantees the sum regardless of which pairs land in which bucket. It alone would NOT have discharged COV-03. The load-bearing check below instead compares the shipped \`unreliableSec\` against \`recountActivity\`'s own total, a gap-first, per-segment-run-enumeration traversal that shares no code with the detector module or with \`pace-derivation.ts\`'s own pass-2/pass-3 arithmetic — the only shared surface is the shipped classifier itself, read once per activity through \`readShippedCoverage\`, the ONE function in \`scripts/compute-coverage-identity-recount.mjs\` permitted to call it, structurally confined there by a scoped-import guard test.`
  );
  lines.push('');

  lines.push('## Archive-wide identity');
  lines.push('');
  lines.push(
    `Streams scanned (\`isStreamFile\`, excluding \`manifest.json\`): **${streamCount}**. Computable (pass this recount's own \`checkStream\`): **${computableCount}**. Skipped: **${evalResult.skipped.length}**.`
  );
  lines.push('');
  if (evalResult.skipped.length > 0) {
    lines.push('Skipped streams, with reason:');
    lines.push('');
    lines.push(
      evalResult.skipped.map((s) => `- \`${s.id}\`: ${s.reason}`).join('\n')
    );
    lines.push('');
  }
  lines.push(`Identity violations (expected 0): **${evalResult.identityViolations.length}**`);
  lines.push('');
  lines.push(
    renderViolationList(
      evalResult.identityViolations,
      (v) =>
        `- \`${v.id}\`: sum ${v.sum.toFixed(6)}s vs spanSec ${v.spanSec.toFixed(6)}s (diff ${v.diff.toFixed(6)}s)`,
      'the four-way identity held on every computable stream'
    )
  );
  lines.push('');

  lines.push('## Recount agreement (the load-bearing check)');
  lines.push('');
  lines.push(`Recount mismatches (expected 0): **${evalResult.recountMismatches.length}**`);
  lines.push('');
  lines.push(
    renderViolationList(
      evalResult.recountMismatches,
      (m) =>
        `- \`${m.id}\`: shipped unreliableSec ${m.shippedUnreliableSec.toFixed(6)}s vs recount ${m.recountUnreliableSec.toFixed(6)}s (diff ${m.diff.toFixed(6)}s)`,
      "the shipped unreliableSec matched this recount's own total on every computable stream"
    )
  );
  lines.push('');
  lines.push(
    `Activities carrying any unreliable time: **${evalResult.totalActivitiesWithUnreliable}** of ${computableCount}. Total unreliable seconds (this recount's own sum): **${evalResult.totalUnreliableSec.toFixed(1)} s**.`
  );
  lines.push('');
  lines.push(renderMechanismTable(evalResult.mechanismTotals, evalResult.totalActivitiesWithUnreliable, streamCount));
  lines.push('');

  lines.push('## Time movement (D-01)');
  lines.push('');
  lines.push(
    `Computed as the archive-wide sum, per activity, of \`classifyGapsThreeWay(t, d)\` (pre-detector) minus this recount's own \`readShippedCoverage(t, d)\` read (shipped, post-detector) on the same stream:`
  );
  lines.push('');
  lines.push(
    `- Seconds moved OUT of \`recordingGapSec\`: **${findings.recordingGapMovedSec.toFixed(1)} s**`
  );
  lines.push(`- Seconds moved OUT of \`pauseSec\`: **${findings.pauseMovedSec.toFixed(1)} s**`);
  lines.push(
    `- Seconds moved OUT of \`coveredSec\`: **${findings.coveredMovedSec.toFixed(1)} s**`
  );
  lines.push('');
  lines.push(
    `Per mechanism: only \`gap-adjacent\` can move recording-gap/pause seconds — a \`hidden-pause\`/\`isolated-jump\` segment has \`gapCount === 0\` by the detector's own construction (it touches no pre-detector gap of either kind), so its seconds move exclusively out of \`coveredSec\`. The archive-wide \`gap-adjacent\` mechanism total from the table above (**${evalResult.mechanismTotals['gap-adjacent'].seconds.toFixed(1)} s**, ${evalResult.mechanismTotals['gap-adjacent'].activities} activities) is the whole merged-segment total (burst seconds + gap seconds combined, D-01's own rule) — it is NOT the same figure as \`recordingGapMovedSec\` alone (that figure is the gap PORTION only), but the two are related: \`recordingGapMovedSec\` is bounded above by the gap-adjacent mechanism's own total seconds, since the gap portion of a gap-adjacent segment can be no larger than the segment itself.`
  );
  lines.push('');
  lines.push(
    `Reconciliation against \`32-CALIBRATION.md\`'s own "Figures of record (D-16)" reference (63 gap-adjacent activities, 85 segments, 12730.8 m, **11574.0 s**, recorded 2026-09-21): this run measured ${evalResult.mechanismTotals['gap-adjacent'].activities} gap-adjacent activities, ${evalResult.mechanismTotals['gap-adjacent'].segments} segments, ${evalResult.mechanismTotals['gap-adjacent'].metres.toFixed(1)} m, ${evalResult.mechanismTotals['gap-adjacent'].seconds.toFixed(1)} s. Any difference from the 32-CALIBRATION.md reference is attributed to archive growth (nightly CI commits) between that artifact's generation and this run, per this project's standing MERGE-01/D-16 reconciliation discipline — the reference is cited, never asserted equal.`
  );
  lines.push('');

  lines.push('## Tier migration (D-05)');
  lines.push('');
  lines.push(
    `Before (two-term numerator, pre-widening: \`(recordingGapSec + pauseSec) / spanSec\`) vs after (three-term numerator, shipped: \`(recordingGapSec + pauseSec + unreliableSec) / spanSec\`) \`gapProfile\` tier, bucketed via the SAME frozen thresholds \`gapProfileSignal\` ships with (\`GAP_PROFILE_SEVERE_FRACTION = ${GAP_PROFILE_SEVERE_FRACTION}\`, \`GAP_PROFILE_MINOR_FRACTION = ${GAP_PROFILE_MINOR_FRACTION}\`) — reported as a finding EVEN THOUGH it is ${findings.changedCount === 0 ? 'zero' : 'non-zero'}. Neither constant was moved by this widening (Phase 27's D-02 anti-quota rule: a constant is never moved to change a count); this section measures the effect of the WIDENED NUMERATOR alone, holding both thresholds fixed.`
  );
  lines.push('');
  lines.push(renderTierMatrix(findings.tierMatrix));
  lines.push('');
  lines.push(
    `Activities with a changed tier: **${findings.changedCount}** of ${findings.computedCount} computed (${findings.skippedCount} skipped as non-computable streams).`
  );
  lines.push('');

  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Stream directory: \`data/streams/\``);
  lines.push(`- Stream files scanned (\`isStreamFile\`, excluding \`manifest.json\`): **${streamCount}**`);
  lines.push(
    `- Constants used — \`speedLimitMps\`: ${constants.speedLimitMps} m/s, \`excessFloorMetres\`: ${constants.excessFloorMetres} m, \`hiddenPauseMinMetres\`: ${constants.hiddenPauseMinMetres} m, all parsed from \`.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md\`'s own "## Chosen constants" table (never hand-copied literals) — \`LOCAL_GAP_THRESHOLD_SEC\`: ${LOCAL_GAP_THRESHOLD_SEC} s, a local literal duplicate of \`RECORDING_GAP_ABS_THRESHOLD_SEC\` (\`src/analytics/pace-derivation.ts\`).`
  );
  lines.push(`- Stream archive git tree (\`HEAD:data/streams\`): \`${provenance.streamsTree}\``);
  lines.push('');
  lines.push('Regenerate this artifact against the live committed archive with:');
  lines.push('');
  lines.push('```');
  lines.push('npm run compute-coverage-identity-recount');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function main() {
  let calibrationRaw;
  try {
    calibrationRaw = readFileSync(CALIBRATION_ARTIFACT_PATH, 'utf8');
  } catch (err) {
    console.error(`FAILED: could not read calibration artifact ${CALIBRATION_ARTIFACT_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const parsedConstants = parseChosenConstants(calibrationRaw);
  if (!parsedConstants.ok) {
    console.error(`FAILED: could not parse calibration constants: ${parsedConstants.reason}`);
    process.exitCode = 1;
    return;
  }

  let filenames;
  try {
    filenames = readdirSync(STREAMS_DIR).filter(isStreamFile);
  } catch (err) {
    console.error(`FAILED: could not read stream directory ${STREAMS_DIR}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const entries = [];
  for (const filename of filenames) {
    const id = idFromFilename(filename);
    try {
      const raw = readFileSync(join(STREAMS_DIR, filename), 'utf8');
      const doc = JSON.parse(raw);
      entries.push({
        id,
        t: Array.isArray(doc.t) ? doc.t : null,
        d: Array.isArray(doc.d) ? doc.d : null,
      });
    } catch (err) {
      entries.push({ id, t: null, d: null, parseError: err.message });
    }
  }

  console.log(
    `D-03 archive-wide coverage identity recount: scanning ${entries.length} stream file(s) from ${STREAMS_DIR}, comparing against ${join('dist', 'analytics', 'pace-derivation.js')}'s shipped classifier (no detector import)...\n`
  );

  const evalResult = evaluateArchive(entries, parsedConstants.constants);
  const findings = computeArchiveWideFindings(entries);
  const provenance = inputProvenance();

  const streamCount = filenames.length;
  const computableCount = streamCount - evalResult.skipped.length;

  const artifact = renderArtifact({
    streamCount,
    computableCount,
    evalResult,
    findings,
    constants: parsedConstants.constants,
    provenance,
  });

  try {
    writeFileSync(OUT_ARTIFACT_PATH, artifact);
  } catch (err) {
    console.error(`FAILED: could not write artifact ${OUT_ARTIFACT_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Wrote ${OUT_ARTIFACT_PATH}`);
  console.log(
    `scanned=${evalResult.scannedCount} skipped=${evalResult.skipped.length} identityViolations=${evalResult.identityViolations.length} recountMismatches=${evalResult.recountMismatches.length}`
  );

  if (evalResult.pass) {
    console.log('PASS: archive-wide identity holds and the recount agrees with the shipped classifier on every computable stream.');
  } else {
    console.error('FAIL:');
    if (evalResult.scannedCount === 0) {
      console.error('  - vacuous: zero streams scanned');
    }
    for (const v of evalResult.identityViolations) {
      console.error(`  - identity violation: ${v.id} sum=${v.sum} spanSec=${v.spanSec}`);
    }
    for (const m of evalResult.recountMismatches) {
      console.error(
        `  - recount mismatch: ${m.id} shipped=${m.shippedUnreliableSec} recount=${m.recountUnreliableSec}`
      );
    }
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring compute-unreliable-segment-recount.mjs: main() runs only under
// direct invocation, so compute-coverage-identity-recount.test.mjs can import the pure functions
// above without triggering a real file read (or write) as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
