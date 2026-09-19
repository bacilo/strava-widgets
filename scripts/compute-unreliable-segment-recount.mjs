/**
 * D-15's independent gap-first recount for `3475724402` — the standalone verifier SEG-02
 * requires: each merged unreliable segment's distance and time is asserted against a table
 * derived independently of the detector.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming `unreliable-segments` (its source lives under `src/analytics/`, its compiled output
 * under `dist/analytics/`), in any spelling. A recount that imported the detector that produced
 * the numbers it is checking would agree with itself by construction — the exact failure mode
 * D-15 exists to rule out, mirroring `compute-pr-ceiling-recount.mjs`'s D-15 discipline for the
 * PR ceiling and `compute-pace-quality-recount.mjs`'s D-03 discipline for pace quality.
 *
 * TRAVERSAL, DELIBERATELY MIRRORED: the detector (Phase 32 plan 02) is run-first — it finds
 * advancing/fast runs, then checks gap adjacency. This recount is gap-first — for each gap it
 * walks backward from the gap's start sample and forward from its end sample, accumulating
 * consecutive fast steps on each side. Two artifacts built the same way can share the same blind
 * spot (Pitfall 11); a structurally different traversal order is what makes this recount a real
 * second opinion rather than a mirror of the first mistake.
 *
 * `LOCAL_GAP_THRESHOLD_SEC = 10` is a LOCAL DUPLICATE of `RECORDING_GAP_ABS_THRESHOLD_SEC`
 * (`src/analytics/pace-derivation.ts`), in the `TARGET_METERS_LOCAL` style established by
 * `compute-pr-ceiling-recount.mjs`: duplicating this tiny constant is the price of staying a
 * genuinely independent recount rather than sharing vocabulary with the code it checks. The rule
 * covers only RECORDING gaps, which is sufficient for `3475724402` because every one of its gaps
 * is a recording gap — plan 32-08's cross-check asserts that precondition against
 * `classifyGaps` directly, so this recount never silently assumes it without that check existing
 * elsewhere.
 *
 * THE BOUND ON ITS CLAIM: this script verifies that the detector's own reported per-segment table
 * (as recorded in the calibration artifact, `32-CALIBRATION.md`) agrees with an independently
 * derived table for the SAME activity — nothing more. It does NOT and cannot arbitrate whether the
 * calibrated speed limit or excess floor themselves are the right numbers; that question belongs
 * to `compute-unreliable-segment-calibration.mjs`, which DOES import the detector because that is
 * its job.
 *
 * Shape follows `compute-pr-ceiling-recount.mjs` / `compute-elevation-recount.mjs`: pure exported
 * functions, a guarded `main()` behind the self-execution check, so
 * `compute-unreliable-segment-recount.test.mjs` can import the pure functions without triggering
 * a real file read as an import-time side effect.
 *
 * Default read targets are `data/streams/3475724402.json` (raw `t`/`d` arrays) and
 * `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` (the
 * committed calibration artifact, written by plan 32-07 — until that plan lands, `main()` fails
 * closed with a readable "artifact missing" message rather than throwing). Writes nothing, ever.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The one activity this recount is scoped to (D-15, SEG-02). */
export const RECOUNT_ACTIVITY_ID = '3475724402';

const STREAM_PATH = join(__dirname, '..', 'data', 'streams', `${RECOUNT_ACTIVITY_ID}.json`);
const ARTIFACT_PATH = join(
  __dirname,
  '..',
  '.planning',
  'phases',
  '32-unreliable-segment-detection-calibration',
  '32-CALIBRATION.md'
);

/**
 * A local duplicate of `RECORDING_GAP_ABS_THRESHOLD_SEC` (`src/analytics/pace-derivation.ts:41`),
 * NOT imported from there (D-15's zero-import discipline forbids reaching into the detector's own
 * neighbourhood for this too — the discipline is about staying independent of the code under
 * test, and this threshold is load-bearing to that independence). This rule covers only RECORDING
 * gaps; it is sufficient for `3475724402` because every one of its gaps is a recording gap, a
 * precondition plan 32-08's cross-check asserts directly against `classifyGaps` rather than this
 * script silently assuming it.
 */
const LOCAL_GAP_THRESHOLD_SEC = 10;

/** The contract's exact per-segment table header (shared with plans 32-06/32-07). */
const CONTRACT_HEADER =
  '| # | startIndex | endIndex | startSec | endSec | seconds | metres | gapSeconds | gapMetres | burstSeconds | burstMetres | gaps | bursts | mechanism |';
const CONTRACT_COLUMNS = [
  '#',
  'startIndex',
  'endIndex',
  'startSec',
  'endSec',
  'seconds',
  'metres',
  'gapSeconds',
  'gapMetres',
  'burstSeconds',
  'burstMetres',
  'gaps',
  'bursts',
  'mechanism',
];
const NUMERIC_COLUMNS = CONTRACT_COLUMNS.filter((c) => c !== '#' && c !== 'mechanism');
const CHOSEN_CONSTANTS_HEADING = '## Chosen constants';
const PER_SEGMENT_TABLE_HEADING = `## Per-segment table — ${RECOUNT_ACTIVITY_ID} (detector output)`;

function round1(x) {
  return Number(x.toFixed(1));
}

/**
 * The recount's own stream validation (D-15) — never imports `validateStreamSeries`
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
 * Returns spans for maximal runs of consecutive pairs with `t[i+1] - t[i] > LOCAL_GAP_THRESHOLD_SEC`,
 * as `[{ startIndex, endIndex, startSec, endSec }]`. Assumes `checkStream(t, d).ok` already holds.
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
 * Forward-folds the covered pairs of one segment (`[segStart, segEnd]` sample indices, no gap
 * inside) into steps: a step's end is the end index of an advancing pair (metres > 0 AND
 * seconds > 0); any immediately preceding zero-advance or zero-duration pairs are folded into
 * that step, extending its start backward. Pending zero pairs at the very end of the segment that
 * never reach a following advancing pair (because the segment ends at a gap or the stream's end)
 * are dropped — never emitted as a step. This reproduces the detector's stated forward-folding
 * rule (see the plan's ARTIFACT CONTRACT interfaces) using this recount's own arithmetic.
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
 * Computes every maximal run of contiguous fast steps within one segment, each labelled
 * `isBurst` when its aggregate excess (`metres - speedLimitMps * seconds`) exceeds
 * `excessFloorMetres`. A run that is fast but does not clear the floor is not a burst and never
 * touches a gap for this recount's purposes.
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
 * The gap-first recount (D-15, D-07, D-06). For each gap, walks backward from the gap's own
 * `startIndex` and forward from its `endIndex` over covered pairs (pairs outside every gap),
 * folding zero-advance/zero-duration pairs into the neighbouring advancing pair exactly as the
 * detector's own forward-folding rule requires. A burst touches a gap only if it ends exactly on
 * the gap's start sample or starts exactly on its end sample (D-06: touching only, no tolerance).
 * Contiguous burst-gap-burst-gap chains (D-07) are merged into one segment; a burst shared by two
 * adjacent gaps (it is simultaneously one gap's trailing burst and the next gap's leading burst)
 * is counted once, never twice. A gap with no kept burst on either side emits no row. Clean
 * samples are never swallowed — a chain breaks the moment a fast run fails to clear the excess
 * floor or a non-fast step sits between two gaps.
 *
 * Returns `{ ok: false, reason }` on bad input or non-finite/non-positive parameters, never
 * throwing. Otherwise returns `{ ok: true, rows }`, rows sorted by `startIndex`, each carrying
 * exactly the artifact table's fields with `mechanism: 'gap-adjacent'`.
 */
export function recountGapFirst(t, d, params) {
  const streamCheck = checkStream(t, d);
  if (!streamCheck.ok) return { ok: false, reason: streamCheck.reason };

  const speedLimitMps = params ? params.speedLimitMps : undefined;
  const excessFloorMetres = params ? params.excessFloorMetres : undefined;
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

  const gaps = localGapSpans(t, d);
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

  const rows = [];
  const consumed = new Array(gaps.length).fill(false);

  for (let g = 0; g < gaps.length; g++) {
    if (consumed[g]) continue;

    const beforeBurst = lastBurstEndingAt(segRuns[g], gaps[g].startIndex);
    const afterBurst = firstBurstStartingAt(segRuns[g + 1], gaps[g].endIndex);

    if (!beforeBurst && !afterBurst) continue;

    const chainGapIndices = [g];
    const chainBursts = [];
    if (beforeBurst) chainBursts.push(beforeBurst);

    let cursorBurst = afterBurst;
    let cursorGap = g;
    while (cursorBurst) {
      chainBursts.push(cursorBurst);
      const nextGapIdx = cursorGap + 1;
      if (nextGapIdx < gaps.length && cursorBurst.endIndex === gaps[nextGapIdx].startIndex) {
        // This same burst is also nextGapIdx's before-burst — already pushed once above, never
        // pushed again (the dedupe D-15 requires).
        chainGapIndices.push(nextGapIdx);
        consumed[nextGapIdx] = true;
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
    // Every gap in chainGapIndices is part of this segment even when the final burst is a
    // CONNECTOR fully absorbed between two chained gaps (its endIndex equals the last gap's own
    // startIndex, not beyond it) — the segment must still extend through that last gap's own
    // endIndex. Only a genuine standalone trailing burst (whose endIndex reaches past the last
    // gap entirely) pushes the segment's end beyond the last gap.
    const endIndex =
      lastBurst && lastBurst.endIndex > lastGap.endIndex ? lastBurst.endIndex : lastGap.endIndex;

    let gapSeconds = 0;
    let gapMetres = 0;
    for (const gi of chainGapIndices) {
      gapSeconds += t[gaps[gi].endIndex] - t[gaps[gi].startIndex];
      gapMetres += d[gaps[gi].endIndex] - d[gaps[gi].startIndex];
    }

    let burstSeconds = 0;
    let burstMetres = 0;
    for (const b of chainBursts) {
      burstSeconds += b.seconds;
      burstMetres += b.metres;
    }

    rows.push({
      startIndex,
      endIndex,
      startSec: t[startIndex],
      endSec: t[endIndex],
      seconds: t[endIndex] - t[startIndex],
      metres: d[endIndex] - d[startIndex],
      gapSeconds,
      gapMetres,
      burstSeconds,
      burstMetres,
      gaps: chainGapIndices.length,
      bursts: chainBursts.length,
      mechanism: 'gap-adjacent',
    });
  }

  rows.sort((a, b) => a.startIndex - b.startIndex);
  return { ok: true, rows };
}

/**
 * Compares this recount's own rows against the detector's rows as recorded in the calibration
 * artifact. Never throws — every disagreement is appended to `problems` as a human-readable
 * string naming the row number and field. Checks: row-count mismatch; per-row
 * startIndex/endIndex/gaps/bursts exact equality; per-row seconds/metres/gapSeconds/gapMetres/
 * burstSeconds/burstMetres equality after rounding both sides to 1 decimal; any detector row
 * whose mechanism is not `'gap-adjacent'`; and an empty `detectorRows` array (vacuous — a
 * discriminator that can never fail is not evidence).
 */
export function evaluateRecount(recountRows, detectorRows) {
  const problems = [];

  if (!Array.isArray(detectorRows) || detectorRows.length === 0) {
    return { pass: false, problems: ['vacuous: detector table has no rows'] };
  }

  const safeRecountRows = Array.isArray(recountRows) ? recountRows : [];

  if (safeRecountRows.length !== detectorRows.length) {
    problems.push(
      `row-count mismatch: recount has ${safeRecountRows.length} row(s), detector has ${detectorRows.length} row(s)`
    );
  }

  const n = Math.min(safeRecountRows.length, detectorRows.length);
  for (let i = 0; i < n; i++) {
    const r = safeRecountRows[i];
    const dRow = detectorRows[i];
    const rowLabel = i + 1;

    for (const field of ['startIndex', 'endIndex', 'gaps', 'bursts']) {
      if (r[field] !== dRow[field]) {
        problems.push(
          `row ${rowLabel} field "${field}" mismatch: recount=${r[field]}, detector=${dRow[field]}`
        );
      }
    }

    for (const field of [
      'seconds',
      'metres',
      'gapSeconds',
      'gapMetres',
      'burstSeconds',
      'burstMetres',
    ]) {
      const rv = round1(r[field]);
      const dv = round1(dRow[field]);
      if (rv !== dv) {
        problems.push(
          `row ${rowLabel} field "${field}" mismatch (rounded to 1dp): recount=${rv}, detector=${dv}`
        );
      }
    }

    if (dRow.mechanism !== 'gap-adjacent') {
      problems.push(
        `row ${rowLabel}: burst labelled ${JSON.stringify(dRow.mechanism)} isolated/hidden-pause on ${RECOUNT_ACTIVITY_ID}`
      );
    }
  }

  return { pass: problems.length === 0, problems };
}

/**
 * Renders this recount's own rows in the ARTIFACT CONTRACT's exact column order. Indices and
 * counts print via default stringification (they are always integers); seconds-family values
 * print via `String()`; metres-family values print via `toFixed(1)`.
 */
export function formatTable(rows) {
  const separator = CONTRACT_COLUMNS.map(() => '---').join(' | ');
  const lines = [CONTRACT_HEADER, `| ${separator} |`];
  rows.forEach((row, i) => {
    lines.push(
      [
        '',
        i + 1,
        row.startIndex,
        row.endIndex,
        String(row.startSec),
        String(row.endSec),
        String(row.seconds),
        row.metres.toFixed(1),
        String(row.gapSeconds),
        row.gapMetres.toFixed(1),
        String(row.burstSeconds),
        row.burstMetres.toFixed(1),
        row.gaps,
        row.bursts,
        row.mechanism,
        '',
      ].join(' | ')
    );
  });
  return lines.join('\n');
}

/**
 * Parses the ARTIFACT CONTRACT out of the calibration artifact's markdown text (written by plan
 * 32-07 — see the plan's ARTIFACT CONTRACT interfaces for the exact shape). Fails closed on:
 * a missing `## Chosen constants` heading, a missing or non-numeric UNRELIABLE_SPEED_LIMIT_MPS or
 * UNRELIABLE_EXCESS_FLOOR_M row, a missing per-segment table heading, a header row differing from
 * the contract, or any row with the wrong cell count or a non-numeric numeric cell. Never throws.
 */
export function parseCalibrationArtifact(markdown) {
  if (typeof markdown !== 'string') {
    return { ok: false, reason: 'artifact content is not a string' };
  }

  const constantsHeadingIdx = markdown.indexOf(CHOSEN_CONSTANTS_HEADING);
  if (constantsHeadingIdx === -1) {
    return { ok: false, reason: `missing "${CHOSEN_CONSTANTS_HEADING}" heading` };
  }

  const tableHeadingIdx = markdown.indexOf(PER_SEGMENT_TABLE_HEADING);
  if (tableHeadingIdx === -1) {
    return { ok: false, reason: `missing "${PER_SEGMENT_TABLE_HEADING}" heading` };
  }

  const constantsSection =
    tableHeadingIdx > constantsHeadingIdx
      ? markdown.slice(constantsHeadingIdx, tableHeadingIdx)
      : markdown.slice(constantsHeadingIdx);

  function extractConstant(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\|\\s*`' + escaped + '`\\s*\\|\\s*([^|]+?)\\s*\\|');
    const match = constantsSection.match(re);
    if (!match) return { found: false };
    const raw = match[1].trim();
    const value = Number(raw);
    if (raw.length === 0 || !Number.isFinite(value)) return { found: true, valid: false, raw };
    return { found: true, valid: true, value };
  }

  const speedLimitResult = extractConstant('UNRELIABLE_SPEED_LIMIT_MPS');
  if (!speedLimitResult.found) {
    return {
      ok: false,
      reason: `missing UNRELIABLE_SPEED_LIMIT_MPS row in "${CHOSEN_CONSTANTS_HEADING}"`,
    };
  }
  if (!speedLimitResult.valid) {
    return {
      ok: false,
      reason: `UNRELIABLE_SPEED_LIMIT_MPS value is not numeric: ${JSON.stringify(speedLimitResult.raw)}`,
    };
  }

  const excessFloorResult = extractConstant('UNRELIABLE_EXCESS_FLOOR_M');
  if (!excessFloorResult.found) {
    return {
      ok: false,
      reason: `missing UNRELIABLE_EXCESS_FLOOR_M row in "${CHOSEN_CONSTANTS_HEADING}"`,
    };
  }
  if (!excessFloorResult.valid) {
    return {
      ok: false,
      reason: `UNRELIABLE_EXCESS_FLOOR_M value is not numeric: ${JSON.stringify(excessFloorResult.raw)}`,
    };
  }

  const tableSection = markdown.slice(tableHeadingIdx);
  const lines = tableSection.split('\n');

  let headerLineIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|')) {
      headerLineIdx = i;
      break;
    }
  }
  if (headerLineIdx === -1) {
    return { ok: false, reason: `no table found under "${PER_SEGMENT_TABLE_HEADING}"` };
  }

  const headerLine = lines[headerLineIdx].trim();
  if (headerLine !== CONTRACT_HEADER) {
    return {
      ok: false,
      reason: `per-segment table header does not match the contract: ${JSON.stringify(headerLine)}`,
    };
  }

  let rowStart = headerLineIdx + 1;
  if (rowStart < lines.length && /^\|[\s:|-]+\|$/.test(lines[rowStart].trim())) {
    rowStart += 1;
  }

  const detectorRows = [];
  for (let i = rowStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length !== CONTRACT_COLUMNS.length) {
      return {
        ok: false,
        reason: `per-segment table row ${detectorRows.length + 1} has ${cells.length} cell(s), expected ${CONTRACT_COLUMNS.length}: ${JSON.stringify(line)}`,
      };
    }

    const row = {};
    for (let c = 0; c < CONTRACT_COLUMNS.length; c++) {
      const colName = CONTRACT_COLUMNS[c];
      if (colName === '#') continue;
      const raw = cells[c];
      if (colName === 'mechanism') {
        row.mechanism = raw;
        continue;
      }
      const value = Number(raw);
      if (raw.length === 0 || !Number.isFinite(value)) {
        return {
          ok: false,
          reason: `per-segment table row ${detectorRows.length + 1} field "${colName}" is not numeric: ${JSON.stringify(raw)}`,
        };
      }
      row[colName] = value;
    }
    detectorRows.push(row);
  }

  return {
    ok: true,
    constants: {
      speedLimitMps: speedLimitResult.value,
      excessFloorMetres: excessFloorResult.value,
    },
    detectorRows,
  };
}

function main() {
  console.log(
    `D-15 independent gap-first recount for ${RECOUNT_ACTIVITY_ID}: reading ${STREAM_PATH} and ${ARTIFACT_PATH} off disk (no detector import)...\n`
  );

  let streamRaw;
  try {
    streamRaw = readFileSync(STREAM_PATH, 'utf8');
  } catch (err) {
    console.error(`FAILED: could not read stream file ${STREAM_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  let streamDoc;
  try {
    streamDoc = JSON.parse(streamRaw);
  } catch (err) {
    console.error(`FAILED: could not parse stream file ${STREAM_PATH} as JSON: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const t = Array.isArray(streamDoc.t) ? streamDoc.t : null;
  const d = Array.isArray(streamDoc.d) ? streamDoc.d : null;
  if (!t || !d) {
    console.error(`FAILED: stream document ${STREAM_PATH} is missing "t" or "d" arrays`);
    process.exitCode = 1;
    return;
  }

  let artifactRaw;
  try {
    artifactRaw = readFileSync(ARTIFACT_PATH, 'utf8');
  } catch (err) {
    console.error(`FAILED: artifact missing at ${ARTIFACT_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const parsed = parseCalibrationArtifact(artifactRaw);
  if (!parsed.ok) {
    console.error(`FAILED: could not parse calibration artifact ${ARTIFACT_PATH}: ${parsed.reason}`);
    process.exitCode = 1;
    return;
  }

  const recount = recountGapFirst(t, d, parsed.constants);
  if (!recount.ok) {
    console.error(`FAILED: recount could not run: ${recount.reason}`);
    process.exitCode = 1;
    return;
  }

  console.log('Recount table (own arithmetic, gap-first):');
  console.log(formatTable(recount.rows));
  console.log('');

  const verdict = evaluateRecount(recount.rows, parsed.detectorRows);
  if (verdict.pass) {
    console.log("PASS: recount agrees with the calibration artifact's detector table.");
  } else {
    console.error('FAIL:');
    for (const problem of verdict.problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring compute-pr-ceiling-recount.mjs / compute-elevation-recount.mjs:
// main() runs only under direct invocation, so compute-unreliable-segment-recount.test.mjs can
// import the pure functions above without triggering a real file read as an import-time side
// effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
