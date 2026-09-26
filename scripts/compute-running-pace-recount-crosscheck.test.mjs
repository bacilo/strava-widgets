/**
 * `npm test`-time reconciliation of the shipped `deriveRunningPace` (D-08) against D-08's own
 * independent, zero-import, interval-first recount (`compute-running-pace-recount.mjs`) — for the
 * four named scoping activities and archive-wide (RPACE-01, plan 35-05).
 *
 * The agreement bar is FIXED HERE, before any measurement, and is never widened: covered/excluded
 * metres agree within `1e-6` m and covered/excluded seconds agree within `1e-6` s. A row outside
 * that bar is a DIVERGENCE, closed only by naming a structural cause (never by widening the bar,
 * never by editing this recount's own algorithm to match production, never by editing the
 * committed artifact).
 *
 * UNEXPLAINED IS NOT REQUIRED TO BE ZERO (2026-09-26 correction, defect 3). It previously read
 * "must be exactly 0", enforced by an UNCONDITIONAL fallback to EXPLAINED DIVERGENCE /
 * `TRAVERSAL_BOUNDARY_CAUSE` for every non-conserving-violation divergence, regardless of size —
 * 677 archive-wide activities were stamped EXPLAINED by that fallback with no check that a
 * traversal-boundary effect could plausibly produce a divergence of the observed MAGNITUDE.
 * `classifyDivergence` below now gates that branch on an honestly-derived magnitude bound (see its
 * own docblock); a divergence too large for a bounded number of boundary-pair reclassifications to
 * plausibly explain falls through to UNEXPLAINED. On the real archive this is a legitimate,
 * non-zero, reportable count — see the archive-wide sweep test below for the actual figure and its
 * cause split. Never tune the bound to force this back to 0.
 *
 * This file is the deliberate exception (mirroring
 * `scripts/unreliable-segment-recount-crosscheck.test.mjs`) that imports the COMPILED production
 * function (`deriveRunningPace`, from `../dist/analytics/pace-derivation.js` — `npm run build` must
 * run first) alongside the recount script's own pure helpers (`compute-running-pace-recount.mjs`
 * itself stays zero-import; that discipline is proven by its own
 * `compute-running-pace-recount.test.mjs`, not by this file).
 *
 * WHY THE 1e-6 BAR IS CHECKED AGAINST THE LIVE RECOUNT, NOT THE ROUNDED ARTIFACT TEXT: the
 * committed artifact renders every metres figure to one decimal place (`round1`) for readability.
 * Comparing a *rounded* number against a 1e-6 bar would report a false divergence for any row that
 * actually agrees exactly, purely from the rounding — that is a presentation choice of the
 * generator, not a fact about whether the two computations agree. So the 1e-6 comparison below
 * runs against a FRESH, unrounded call to `recountRunningPace` on the same `data/streams/*.json`
 * input the artifact was generated from — this is the artifact's row, just not display-rounded.
 * The committed artifact's own `## Named activities` table is still parsed (fail-closed) and is
 * still where this file's watched-failing perturbation control operates, per the plan's own
 * instruction — that is a real, independent consumer of the artifact text, not a decorative parse.
 *
 * THE FINDING THIS FILE PREVIOUSLY DISCLOSED ON 5059204779 WAS ITSELF A DEFECT IN THIS RECOUNT, NOT
 * IN PRODUCTION (2026-09-26 correction, defect 1, fixed in `compute-running-pace-recount.mjs`'s
 * `findOverspeedRanges`). 5059204779's stream is a QUANTIZED-DISTANCE stream: the device ticks a
 * timestamp every second but only reports cumulative distance in an occasional lump (1,833/1,892
 * pairs are zero-advance). Judging each lump's speed over its own 1-2s dt alone (the recount's
 * PRE-2026-09-26 behaviour) produced a self-refuting reading — 37-184 m/s per lump on a stream
 * whose own average pace is 2.85 m/s — and excluded `recountCoveredM=0` for an activity that
 * plainly covered 10,804 m. That was NOT a legitimate second opinion; it was this recount's own
 * over-speed rule misreading a physically ordinary stream shape. The fix measures each lump's
 * speed over a window that includes the elapsed time since the device's last report (the
 * immediately preceding zero-advance, non-gap stretch), which is the physically correct reading.
 * After the fix, this recount and production both report a sane covered distance for 5059204779
 * (`recountCoveredM=10638`, matching production's own `coveredM=10638` exactly; a small 2s
 * boundary-difference remains in `coveredSec`/`excludedSec`, EXPLAINED DIVERGENCE below). This
 * activity is no longer named as "the central finding" — it is an ordinary, small, EXPLAINED row
 * like the other three named activities.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { deriveRunningPace } from '../dist/analytics/pace-derivation.js';
import {
  NAMED_ACTIVITY_IDS,
  isStreamFile,
  idFromFilename,
  recountRunningPace,
  findRecordingGapRanges,
  findPauseRanges,
  findOverspeedRanges,
  mergeExcludedRanges,
  localAdvanceIntervalsSec,
  localQuantileR7,
  LOCAL_GAP_THRESHOLD_SEC,
  LOCAL_SPEED_LIMIT_MPS,
} from './compute-running-pace-recount.mjs';

const ARTIFACT_PATH = path.join(
  '.planning',
  'phases',
  '35-stream-derived-running-pace',
  '35-RUNNING-PACE-RECOUNT.md'
);
const STREAMS_DIR = path.join('data', 'streams');

/** The agreement bar (D-08 / T-35-17): fixed here, checked as a literal, never widened. */
const AGREEMENT_BAR_M = 1e-6;
const AGREEMENT_BAR_SEC = 1e-6;

function readStream(id) {
  const raw = fs.readFileSync(path.join(STREAMS_DIR, `${id}.json`), 'utf-8');
  const doc = JSON.parse(raw);
  return { t: doc.t, d: doc.d };
}

/**
 * Fail-closed parse of the committed artifact's own `## Named activities` table. Never silently
 * skips a row that fails to parse — returns `{ ok:false, reason }` naming exactly what went wrong.
 */
export function parseNamedActivitiesTable(markdown) {
  const sectionMarker = '## Named activities';
  const sectionStart = markdown.indexOf(sectionMarker);
  if (sectionStart === -1) {
    return { ok: false, reason: `section "${sectionMarker}" not found in artifact` };
  }

  const rest = markdown.slice(sectionStart + sectionMarker.length);
  const nextSectionIdx = rest.indexOf('\n## ');
  const sectionBody = nextSectionIdx === -1 ? rest : rest.slice(0, nextSectionIdx);

  const tableLines = sectionBody.split('\n').filter((line) => line.trim().startsWith('|'));
  if (tableLines.length < 3) {
    return {
      ok: false,
      reason: `expected a header row + separator row + at least one data row, found ${tableLines.length} table line(s)`,
    };
  }

  const dataLines = tableLines.slice(2); // skip header row and the |---|---| separator
  const rows = {};
  for (const line of dataLines) {
    const rawCells = line.split('|');
    // A well-formed `| a | b | ... |` row splits into an empty leading cell, an empty trailing
    // cell, and the real cells in between.
    const cells = rawCells.slice(1, rawCells.length - 1).map((c) => c.trim());
    if (cells.length !== 7) {
      return { ok: false, reason: `row "${line.trim()}" has ${cells.length} cells, expected 7` };
    }
    const [id, computableCell, coveredMCell, coveredSecCell, excludedMCell, excludedSecCell, paceCell] =
      cells;
    if (computableCell === 'yes') {
      const coveredM = Number(coveredMCell);
      const coveredSec = Number(coveredSecCell);
      const excludedM = Number(excludedMCell);
      const excludedSec = Number(excludedSecCell);
      if ([coveredM, coveredSec, excludedM, excludedSec].some((n) => !Number.isFinite(n))) {
        return { ok: false, reason: `row for ${id} has a non-numeric cell: "${line.trim()}"` };
      }
      rows[id] = { id, computable: true, coveredM, coveredSec, excludedM, excludedSec, paceCell };
    } else {
      rows[id] = { id, computable: false, computableCell, paceCell };
    }
  }
  return { ok: true, rows };
}

/**
 * Compares two `{ coveredM, coveredSec, excludedM, excludedSec }` rows against the fixed 1e-6 bar.
 * Pure, and independent of where the two rows came from — used both by the watched-failing
 * perturbation control (item 3) and by the real named-activity reconciliation (item 4).
 */
export function compareFields(rowA, rowB) {
  const diffs = {
    coveredM: Math.abs(rowA.coveredM - rowB.coveredM),
    coveredSec: Math.abs(rowA.coveredSec - rowB.coveredSec),
    excludedM: Math.abs(rowA.excludedM - rowB.excludedM),
    excludedSec: Math.abs(rowA.excludedSec - rowB.excludedSec),
  };
  const agrees =
    diffs.coveredM <= AGREEMENT_BAR_M &&
    diffs.excludedM <= AGREEMENT_BAR_M &&
    diffs.coveredSec <= AGREEMENT_BAR_SEC &&
    diffs.excludedSec <= AGREEMENT_BAR_SEC;
  return { agrees, diffs };
}

/** A human-readable message naming both compared values for every field outside the bar. */
export function describeComparison(id, rowA, rowB, comparison) {
  if (comparison.agrees) {
    return `${id}: AGREES within the bar (${JSON.stringify(comparison.diffs)})`;
  }
  const divergentFields = Object.entries(comparison.diffs).filter(([field, diff]) => {
    const bar = field.endsWith('Sec') ? AGREEMENT_BAR_SEC : AGREEMENT_BAR_M;
    return diff > bar;
  });
  const fieldMessages = divergentFields.map(
    ([field, diff]) => `${field}: rowA=${rowA[field]} rowB=${rowB[field]} diff=${diff}`
  );
  return `${id}: DIVERGES on ${divergentFields.map(([f]) => f).join(', ')} -- ${fieldMessages.join('; ')}`;
}

/**
 * A NAMED structural cause: the recount's over-speed rule has no excess-floor requirement, so on a
 * stream where advancing pairs are sparse (most samples are zero-advance), it flags most or all of
 * them individually — production's excess-floor-gated, chain-merged detector does not. Verified
 * structurally (not narrated) via `gapFreeExcludedShare` below: this cause is only named when at
 * least 90% of the recount's own excluded metres come from ranges that do not overlap any
 * recording-gap range (i.e., from the over-speed/pause rules, not gap absorption) AND this recount
 * excludes strictly more than production.
 *
 * NOTE (2026-09-26 correction, defect 1): before the fix to `findOverspeedRanges`'s aggregate-speed
 * window, this cause fired catastrophically on quantized-distance streams (5059204779: recount
 * excluded the ENTIRE activity). That was a bug in this recount, not a legitimate second opinion —
 * fixed by measuring a lump's implied speed over the elapsed time since the device's last report,
 * not the lump's own 1-2s dt alone. This cause still fires (n=6 on the real archive, worst case
 * 162.6 m of a multi-thousand-metre activity) for GENUINELY isolated single-pair bursts not
 * preceded by a proportionate quiet stretch — a real, bounded, and much smaller-scale instance of
 * the same no-excess-floor mechanism, not the same defect recurring.
 */
export const NO_EXCESS_FLOOR_CAUSE =
  'no-excess-floor over-speed rule: this recount flags every isolated/near-isolated advancing run ' +
  'whose own aggregate speed exceeds LOCAL_SPEED_LIMIT_MPS, with no minimum-excess gate; on a stream ' +
  'where most samples are zero-advance, this can flag most or all of the advancing pairs ' +
  "individually, excluding far more metres than production's excess-floor-gated, chain-merged " +
  'detector (which requires a run of excess over the limit to clear UNRELIABLE_EXCESS_FLOOR_M ' +
  'before flagging it)';

/**
 * A NAMED structural cause: the two traversals are independently-derived and structurally
 * different (D-08's own docblock, "TRAVERSAL, DELIBERATELY DIFFERENT") — a gap-adjacent burst's
 * exact extent, the independently-derived R-7 pause threshold, or a recording-gap boundary pair can
 * legitimately classify differently between this recount's interval-first traversal and
 * production's three-pass, strict-priority, chain-merged classifier.
 *
 * MAGNITUDE-BOUNDED (2026-09-26 correction, defect 3): this cause is a CHECKED STRUCTURAL FACT about
 * the SIZE of a given divergence, never an assumption that any two independently-derived readings
 * must agree by construction. `classifyDivergence` only names this cause when the divergence does
 * not exceed what a bounded number of boundary-PAIR reclassifications could plausibly produce: at
 * most 2 boundary pairs per recording-gap/pause/over-speed range this recount itself detected (one
 * at each end, where the two traversals' differing pass order or threshold estimate could disagree
 * about a single pair's classification), each pair capped at `LOCAL_GAP_THRESHOLD_SEC` seconds
 * (any pair that is not itself a recording gap has `dt <= LOCAL_GAP_THRESHOLD_SEC` by definition)
 * and `LOCAL_GAP_THRESHOLD_SEC * LOCAL_SPEED_LIMIT_MPS` metres (any pair not itself flagged
 * over-speed has `speed <= LOCAL_SPEED_LIMIT_MPS`). A divergence exceeding that bound is NOT
 * explained by this cause — it is UNEXPLAINED, because a small, bounded number of boundary pairs
 * cannot plausibly account for it, whatever its true origin.
 */
export const TRAVERSAL_BOUNDARY_CAUSE =
  "traversal-shape/boundary difference, magnitude-checked: the interval-first recount's " +
  "gap-adjacent single-pair check, independently-derived R-7 pause threshold, or recording-gap " +
  'boundary handling classifies a different (but structurally comparable) SMALL pair set than ' +
  "production's three-pass, strict-priority, chain-merged classifier — named only when this " +
  'divergence\'s own magnitude is within what a bounded number of boundary-pair reclassifications ' +
  '(2 per recording-gap/pause/over-speed range this recount detected, each capped at ' +
  'LOCAL_GAP_THRESHOLD_SEC seconds / LOCAL_GAP_THRESHOLD_SEC*LOCAL_SPEED_LIMIT_MPS metres) could ' +
  'plausibly produce, checked structurally by classifyDivergence, never asserted by fiat';

function rangesOverlap(a, b) {
  return a.startIndex < b.endIndex && b.startIndex < a.endIndex;
}

/**
 * What share of the recount's own merged excluded metres comes from a range that does NOT overlap
 * any recording-gap range — i.e., from the pause/over-speed rules acting alone, not from gap
 * absorption. Used to distinguish the no-excess-floor cause (dominated by gap-free ranges) from
 * ordinary gap-adjacent burst-sizing differences.
 */
export function gapFreeExcludedShare(d, recordingGapRanges, merged) {
  let gapFreeM = 0;
  let totalM = 0;
  for (const range of merged) {
    const rangeM = d[range.endIndex] - d[range.startIndex];
    totalM += rangeM;
    if (!recordingGapRanges.some((g) => rangesOverlap(g, range))) {
      gapFreeM += rangeM;
    }
  }
  return totalM > 0 ? gapFreeM / totalM : 0;
}

const CONSERVATION_TOLERANCE = 1e-6;

function conserves(row, spanSec, totalM) {
  return (
    Math.abs(row.coveredSec + row.excludedSec - spanSec) <= CONSERVATION_TOLERANCE &&
    Math.abs(row.coveredM + row.excludedM - totalM) <= CONSERVATION_TOLERANCE
  );
}

/**
 * The magnitude bound on `TRAVERSAL_BOUNDARY_CAUSE` (2026-09-26 correction, defect 3): what a
 * BOUNDED NUMBER of boundary-pair reclassifications could plausibly produce. `boundaryPairBound` is
 * the count of individual pairs whose classification the two traversals could plausibly disagree
 * about — at most 2 per recording-gap/pause/over-speed range this recount itself detected (one at
 * each end of the range, where a differing pass order or threshold estimate could shift a single
 * pair's classification). Each such pair is capped, independently of the real archive, at
 * `LOCAL_GAP_THRESHOLD_SEC` seconds (a pair that is not itself a recording gap has
 * `dt <= LOCAL_GAP_THRESHOLD_SEC` by `findRecordingGapRanges`' own definition) and
 * `LOCAL_GAP_THRESHOLD_SEC * LOCAL_SPEED_LIMIT_MPS` metres (a pair not itself flagged over-speed has
 * `speed <= LOCAL_SPEED_LIMIT_MPS` by `findOverspeedRanges`' own definition). This is NOT
 * production's `UNRELIABLE_EXCESS_FLOOR_M` rebadged — it is derived entirely from THIS recount's own
 * two local duplicated constants and its own detected range counts, never from a number chosen to
 * make the current archive pass (verified live against the real archive: applying this bound
 * honestly yields a non-zero UNEXPLAINED count, reported by the archive-wide sweep test below, not
 * tuned back to 0).
 */
export function classifyDivergence({
  recountRow,
  shippedRow,
  spanSec,
  totalM,
  gapFreeShare,
  boundaryPairBound,
}) {
  const comparison = compareFields(recountRow, shippedRow);
  if (comparison.agrees) {
    return { classification: 'FULL AGREEMENT', comparison };
  }

  if (!conserves(shippedRow, spanSec, totalM)) {
    return {
      classification: 'UNEXPLAINED',
      cause:
        "shipped deriveRunningPace violates its own coveredSec+excludedSec=spanSec / " +
        'coveredM+excludedM=totalM conservation identity -- not a traversal-shape difference, ' +
        'a genuine defect',
      comparison,
    };
  }

  const recountExcludesMore =
    recountRow.excludedM > shippedRow.excludedM + AGREEMENT_BAR_M ||
    recountRow.excludedSec > shippedRow.excludedSec + AGREEMENT_BAR_SEC;

  if (recountExcludesMore && gapFreeShare >= 0.9) {
    return { classification: 'EXPLAINED DIVERGENCE', cause: NO_EXCESS_FLOOR_CAUSE, comparison };
  }

  const maxBoundaryM = boundaryPairBound * LOCAL_GAP_THRESHOLD_SEC * LOCAL_SPEED_LIMIT_MPS;
  const maxBoundarySec = boundaryPairBound * LOCAL_GAP_THRESHOLD_SEC;
  const withinBoundaryBound =
    comparison.diffs.coveredM <= maxBoundaryM &&
    comparison.diffs.excludedM <= maxBoundaryM &&
    comparison.diffs.coveredSec <= maxBoundarySec &&
    comparison.diffs.excludedSec <= maxBoundarySec;

  if (withinBoundaryBound) {
    return { classification: 'EXPLAINED DIVERGENCE', cause: TRAVERSAL_BOUNDARY_CAUSE, comparison };
  }

  return {
    classification: 'UNEXPLAINED',
    cause:
      `divergence exceeds the honestly-derived boundary-pair bound (boundaryPairBound=${boundaryPairBound}, ` +
      `maxBoundaryM=${maxBoundaryM.toFixed(1)}, maxBoundarySec=${maxBoundarySec.toFixed(1)}) -- a ` +
      'bounded number of boundary-pair reclassifications cannot plausibly account for a divergence ' +
      'this large; this is a genuine, unaccounted-for difference between this recount and production, ' +
      'not a traversal-shape/boundary nuance',
    comparison,
  };
}

/** Computes recount + shipped rows for a real stream, then classifies via `classifyDivergence`. */
export function classifyActivity(id, t, d) {
  const recount = recountRunningPace(t, d);
  if (!recount.ok) {
    return { id, classification: 'UNEXPLAINED', cause: `recount failed: ${recount.reason}` };
  }
  const shipped = deriveRunningPace({ t, d });

  const recountRow = {
    coveredM: recount.recountCoveredM,
    coveredSec: recount.recountCoveredSec,
    excludedM: recount.recountExcludedM,
    excludedSec: recount.recountExcludedSec,
  };
  const shippedRow = {
    coveredM: shipped.coveredM,
    coveredSec: shipped.coveredSec,
    excludedM: shipped.excludedM,
    excludedSec: shipped.excludedSec,
  };

  const recordingGapRanges = findRecordingGapRanges(t, d);
  const advanceIntervalsSec = localAdvanceIntervalsSec(t, d);
  const p90AdvanceSec =
    advanceIntervalsSec.length === 0 ? Infinity : localQuantileR7(advanceIntervalsSec, 0.9);
  const pauseRanges = findPauseRanges(t, d, p90AdvanceSec);
  const overspeedRanges = findOverspeedRanges(t, d, recordingGapRanges);
  const merged = mergeExcludedRanges([...recordingGapRanges, ...pauseRanges, ...overspeedRanges]);
  const gapFreeShare = gapFreeExcludedShare(d, recordingGapRanges, merged);

  // 2026-09-26 correction (defect 3): the honestly-derived boundary-pair bound's own input — 2
  // boundary pairs per range this recount itself detected, see TRAVERSAL_BOUNDARY_CAUSE's docblock.
  const boundaryPairBound = 2 * (recordingGapRanges.length + pauseRanges.length + overspeedRanges.length);

  const result = classifyDivergence({
    recountRow,
    shippedRow,
    spanSec: recount.spanSec,
    totalM: recount.totalM,
    gapFreeShare,
    boundaryPairBound,
  });

  return { id, recountRow, shippedRow, gapFreeShare, boundaryPairBound, ...result };
}

describe('D-08 crosscheck — shipped deriveRunningPace vs the independent recount', () => {
  describe('watched failing first: the comparison is a real discriminator, not vacuous', () => {
    it('CAN PASS: an unperturbed synthetic pair agrees within the bar', () => {
      const baseline = { coveredM: 1000, coveredSec: 500, excludedM: 50, excludedSec: 20 };
      const shipped = { ...baseline };
      const result = compareFields(baseline, shipped);
      expect(result.agrees).toBe(true);
    });

    it('CAN FAIL: perturbing the parsed artifact\'s own row (excludedM +1.0) is reported as a divergence naming both values', () => {
      const markdown = fs.readFileSync(ARTIFACT_PATH, 'utf-8');
      const parsed = parseNamedActivitiesTable(markdown);
      expect(parsed.ok).toBe(true);

      const realRow = parsed.rows['3475724402'];
      expect(realRow.computable).toBe(true);

      const perturbedRow = { ...realRow, excludedM: realRow.excludedM + 1.0 };
      const { t, d } = readStream('3475724402');
      const shipped = deriveRunningPace({ t, d });
      const shippedRow = {
        coveredM: shipped.coveredM,
        coveredSec: shipped.coveredSec,
        excludedM: shipped.excludedM,
        excludedSec: shipped.excludedSec,
      };

      const perturbedComparison = compareFields(perturbedRow, shippedRow);
      expect(perturbedComparison.agrees).toBe(false);
      expect(perturbedComparison.diffs.excludedM).toBeGreaterThan(1.0 - 1e-9);

      const message = describeComparison('3475724402 (perturbed)', perturbedRow, shippedRow, perturbedComparison);
      expect(message).toContain('excludedM');
      expect(message).toContain(String(perturbedRow.excludedM));
      expect(message).toContain(String(shippedRow.excludedM));
      // Recorded verbatim in the SUMMARY.
      console.log('WATCHED FAILING (perturbed row):', message);

      const unperturbedComparison = compareFields(realRow, shippedRow);
      const unperturbedMessage = describeComparison('3475724402 (unperturbed)', realRow, shippedRow, unperturbedComparison);
      console.log('UNPERTURBED comparison (still diverges, but this is the real, EXPLAINED finding, not the watched-failing control):', unperturbedMessage);
    });
  });

  describe('classifyDivergence: UNEXPLAINED and EXPLAINED DIVERGENCE are each independently reachable', () => {
    it('CAN report UNEXPLAINED: a shipped row that violates its own conservation identity', () => {
      const result = classifyDivergence({
        recountRow: { coveredM: 100, coveredSec: 50, excludedM: 0, excludedSec: 0 },
        // 100 (coveredM) + 5 (excludedM) = 105 != totalM (100) -- shipped's own conservation is broken.
        shippedRow: { coveredM: 100, coveredSec: 50, excludedM: 5, excludedSec: 0 },
        spanSec: 50,
        totalM: 100,
        gapFreeShare: 1,
      });
      expect(result.classification).toBe('UNEXPLAINED');
    });

    it('CAN report EXPLAINED DIVERGENCE (no-excess-floor cause): a gap-free, recount-excludes-more divergence', () => {
      const result = classifyDivergence({
        recountRow: { coveredM: 0, coveredSec: 100, excludedM: 500, excludedSec: 50 },
        shippedRow: { coveredM: 490, coveredSec: 100, excludedM: 10, excludedSec: 50 },
        spanSec: 150,
        totalM: 500,
        gapFreeShare: 1,
        // Irrelevant here: the no-excess-floor branch returns before the boundary-pair bound is
        // ever consulted -- 0 proves that (a bound of 0 would reject this if the bound path ran).
        boundaryPairBound: 0,
      });
      expect(result.classification).toBe('EXPLAINED DIVERGENCE');
      expect(result.cause).toBe(NO_EXCESS_FLOOR_CAUSE);
    });

    it('CAN report EXPLAINED DIVERGENCE (traversal-boundary cause): a small, non-gap-free divergence within the boundary-pair bound', () => {
      const result = classifyDivergence({
        recountRow: { coveredM: 480, coveredSec: 490, excludedM: 20, excludedSec: 10 },
        shippedRow: { coveredM: 470, coveredSec: 480, excludedM: 30, excludedSec: 20 },
        spanSec: 500,
        totalM: 500,
        gapFreeShare: 0,
        // 1 detected range -> boundaryPairBound=2 -> maxBoundaryM=2*10*7.35=147, maxBoundarySec=20;
        // this fixture's diffs (10m, 10s) sit comfortably inside that bound.
        boundaryPairBound: 2,
      });
      expect(result.classification).toBe('EXPLAINED DIVERGENCE');
      expect(result.cause).toBe(TRAVERSAL_BOUNDARY_CAUSE);
    });

    it('CAN report FULL AGREEMENT: identical rows', () => {
      const row = { coveredM: 100, coveredSec: 50, excludedM: 0, excludedSec: 0 };
      const result = classifyDivergence({
        recountRow: row,
        shippedRow: { ...row },
        spanSec: 50,
        totalM: 100,
        gapFreeShare: 0,
        boundaryPairBound: 0,
      });
      expect(result.classification).toBe('FULL AGREEMENT');
    });

    it('CAN report UNEXPLAINED via the MAGNITUDE path specifically (2026-09-26, defect 3) -- a conserving divergence too large for a bounded number of boundary pairs to explain, distinct from the conservation-violation fixture above -- AND the identical divergence classifies as EXPLAINED DIVERGENCE given a bound generous enough to cover it, proving the gate is a real discriminator checked in both directions, not a number chosen to always reject or always accept', () => {
      // Conserves on both sides (100+900=1000, 500+0=500 on shipped; recount excludes nothing).
      const recountRow = { coveredM: 1000, coveredSec: 500, excludedM: 0, excludedSec: 0 };
      const shippedRow = { coveredM: 100, coveredSec: 500, excludedM: 900, excludedSec: 0 };

      // Direction 1: a small bound (1 detected range -> maxBoundaryM=73.5) cannot explain a 900m
      // divergence -- UNEXPLAINED, naming the magnitude-bound cause, not TRAVERSAL_BOUNDARY_CAUSE.
      const tooSmall = classifyDivergence({
        recountRow,
        shippedRow,
        spanSec: 500,
        totalM: 1000,
        gapFreeShare: 0,
        boundaryPairBound: 1,
      });
      expect(tooSmall.classification).toBe('UNEXPLAINED');
      expect(tooSmall.cause).toContain('boundary-pair bound');
      expect(tooSmall.cause).not.toBe(TRAVERSAL_BOUNDARY_CAUSE);

      // Direction 2: the SAME divergence, given a bound generous enough to cover it (100 detected
      // ranges -> maxBoundaryM=7350), is EXPLAINED DIVERGENCE -- the gate is not a rule that always
      // fires regardless of its own input.
      const generous = classifyDivergence({
        recountRow,
        shippedRow,
        spanSec: 500,
        totalM: 1000,
        gapFreeShare: 0,
        boundaryPairBound: 100,
      });
      expect(generous.classification).toBe('EXPLAINED DIVERGENCE');
      expect(generous.cause).toBe(TRAVERSAL_BOUNDARY_CAUSE);
    });
  });

  describe('the four named activities: shipped deriveRunningPace vs. this recount, all sixteen numbers', () => {
    it('the artifact\'s Named activities table parses and names all four activities (fail-closed)', () => {
      const markdown = fs.readFileSync(ARTIFACT_PATH, 'utf-8');
      const parsed = parseNamedActivitiesTable(markdown);
      expect(parsed.ok).toBe(true);
      for (const id of NAMED_ACTIVITY_IDS) {
        expect(parsed.rows[id]).toBeDefined();
      }
    });

    it('classifies every named activity and prints all sixteen compared numbers (2026-09-26 correction: UNEXPLAINED is no longer required to be 0 -- see defect 3)', () => {
      const results = NAMED_ACTIVITY_IDS.map((id) => {
        const { t, d } = readStream(id);
        return classifyActivity(id, t, d);
      });

      for (const result of results) {
        console.log(
          `${result.id}: classification=${result.classification}` +
            (result.cause ? ` cause=${result.cause}` : '') +
            ` boundaryPairBound=${result.boundaryPairBound}` +
            ` | recount coveredM=${result.recountRow.coveredM} coveredSec=${result.recountRow.coveredSec}` +
            ` excludedM=${result.recountRow.excludedM} excludedSec=${result.recountRow.excludedSec}` +
            ` | shipped coveredM=${result.shippedRow.coveredM} coveredSec=${result.shippedRow.coveredSec}` +
            ` excludedM=${result.shippedRow.excludedM} excludedSec=${result.shippedRow.excludedSec}`
        );
      }

      // 2026-09-26 correction (defect 1): 5059204779 is no longer the extreme, near-total-exclusion
      // finding it was pre-fix -- it is now a small EXPLAINED DIVERGENCE (traversal-boundary,
      // a 2-second coveredSec difference), like 3475724402 and 3475740390.
      const byId = Object.fromEntries(results.map((r) => [r.id, r]));
      expect(byId['5059204779'].classification).toBe('EXPLAINED DIVERGENCE');
      expect(byId['5059204779'].cause).toBe(TRAVERSAL_BOUNDARY_CAUSE);
      expect(byId['3475724402'].classification).toBe('EXPLAINED DIVERGENCE');
      expect(byId['3475724402'].cause).toBe(TRAVERSAL_BOUNDARY_CAUSE);
      expect(byId['3475740390'].classification).toBe('EXPLAINED DIVERGENCE');
      expect(byId['3475740390'].cause).toBe(TRAVERSAL_BOUNDARY_CAUSE);

      // 2026-09-26 correction (defect 3): applying the honestly-derived boundary-pair bound to
      // 3475734189 (recount finds only a single 16s, 0m pause range -> boundaryPairBound=2 ->
      // maxBoundaryM=147) against its own real divergence (181.5 m) finds the divergence EXCEEDS
      // what that bounded number of boundary pairs could plausibly produce -- this is now honestly
      // UNEXPLAINED, not blessed by an unconditional fallback. Reported, not engineered away: this
      // recount's own detectors find nothing at the scale needed to account for production's
      // additional 181.5 m exclusion on this activity, a genuine gap in what this simpler,
      // independently-derived detector can explain.
      expect(byId['3475734189'].classification).toBe('UNEXPLAINED');
      expect(byId['3475734189'].cause).toContain('boundary-pair bound');

      // Reachability: the named-activity population is not vacuously all-one-classification.
      const classifications = new Set(results.map((r) => r.classification));
      expect(classifications.has('EXPLAINED DIVERGENCE')).toBe(true);
      expect(classifications.has('UNEXPLAINED')).toBe(true);
    });
  });

  describe('archive-wide sweep: every data/streams/*.json activity, FULL AGREEMENT / EXPLAINED DIVERGENCE / UNEXPLAINED', () => {
    it('sweeps the real archive and reports the honest FULL AGREEMENT / EXPLAINED DIVERGENCE / UNEXPLAINED split (2026-09-26 correction, defect 3: UNEXPLAINED is no longer required to be 0 -- a magnitude-bounded gate on the traversal-boundary cause honestly finds some divergences too large for a bounded number of boundary pairs to explain, and that is reported, not tuned away)', () => {
      const filenames = fs.readdirSync(STREAMS_DIR).filter(isStreamFile).sort();
      expect(filenames.length).toBeGreaterThan(0); // reachability: not vacuous

      let fullAgreement = 0;
      let explainedDivergence = 0;
      let unexplained = 0;
      const unexplainedRows = [];
      const causeCounts = {};

      for (const filename of filenames) {
        const id = idFromFilename(filename);
        const raw = fs.readFileSync(path.join(STREAMS_DIR, filename), 'utf-8');
        let doc;
        try {
          doc = JSON.parse(raw);
        } catch {
          unexplained += 1;
          unexplainedRows.push({ id, note: 'parse error', dM: Infinity });
          continue;
        }
        if (!Array.isArray(doc.t) || !Array.isArray(doc.d)) {
          unexplained += 1;
          unexplainedRows.push({ id, note: 't/d not arrays', dM: Infinity });
          continue;
        }

        const result = classifyActivity(id, doc.t, doc.d);
        if (result.classification === 'FULL AGREEMENT') {
          fullAgreement += 1;
        } else if (result.classification === 'EXPLAINED DIVERGENCE') {
          explainedDivergence += 1;
          causeCounts[result.cause] = (causeCounts[result.cause] ?? 0) + 1;
        } else {
          unexplained += 1;
          unexplainedRows.push({
            id,
            note: result.cause ?? 'no cause',
            dM: result.comparison?.diffs.coveredM ?? Infinity,
          });
        }
      }

      // Worst offenders (2026-09-26 correction, defect 3): the brief requires reporting the count
      // AND the worst offenders when an honest bound leaves UNEXPLAINED > 0, never tuning the bound
      // to erase them.
      const worstOffenders = [...unexplainedRows].sort((a, b) => b.dM - a.dM).slice(0, 10);

      console.log(
        `Archive-wide reconciliation (${filenames.length} streams): FULL AGREEMENT=${fullAgreement}, ` +
          `EXPLAINED DIVERGENCE=${explainedDivergence}, UNEXPLAINED=${unexplained}`
      );
      console.log('EXPLAINED DIVERGENCE cause breakdown:', JSON.stringify(causeCounts));
      console.log(
        `UNEXPLAINED worst offenders (by |coveredM diff|, top ${worstOffenders.length} of ${unexplained}):`,
        JSON.stringify(worstOffenders)
      );

      // Reachability: neither bucket is vacuously empty on the real archive, and the
      // magnitude-bounded gate genuinely fires (UNEXPLAINED > 0) rather than being unreachable.
      expect(fullAgreement).toBeGreaterThan(0);
      expect(explainedDivergence).toBeGreaterThan(0);
      expect(unexplained).toBeGreaterThan(0);
    });
  });
});
