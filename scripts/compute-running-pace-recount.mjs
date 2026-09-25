/**
 * D-08's independent recount of `deriveRunningPace`'s covered/excluded metres and seconds — a
 * standalone script that re-derives each activity's covered distance and covered time WITHOUT
 * importing any of the code that produces those numbers in production. Purpose: this project's
 * standing convention is that every headline figure is re-derived outside the code that produced
 * it, and it has twice shipped a green gate over broken code because a guard asserted internal
 * agreement instead. `deriveRunningPace`'s own structural conservation tests (35-03) are explicitly
 * NOT that evidence — this script is. Its output is also what plan 35-12 freezes as the browser
 * checkpoint's independently-derived Expected values.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming `pace-derivation`, `unreliable-segments`, `pace-quality` or `best-effort` (their source
 * lives under `src/analytics/`, their compiled output under `dist/analytics/`), in any spelling,
 * and it imports nothing at all from `src/` or `dist/`. In fact it imports ONLY Node builtins
 * (`fs`, `path`, `url`, `child_process`) — not even a sibling `scripts/*.mjs` recount, unlike
 * `compute-pause-classification-recount.mjs`'s reuse of `compute-unreliable-segment-recount.mjs`.
 * A recount that imported the code that produced the numbers it is checking would agree with itself
 * by construction — the exact failure mode this file exists to rule out.
 *
 * TRAVERSAL, DELIBERATELY DIFFERENT: production (`classifyPairKinds` inside
 * `src/analytics/pace-derivation.ts`) is a three-pass, strict-priority, pair-index shape — for each
 * pair, check recording-gap first, then pause, else covered — with `classifyGaps`' own pass 3
 * overwriting some `covered`/`pause` pairs to `unreliable` after the detector runs, and finally sums
 * the SURVIVING `covered` pairs forward into `coveredRuns`. This recount is interval-first and runs
 * in the OPPOSITE direction: it enumerates non-covered INTERVALS from the raw series (recording
 * gaps, then zero-advance pause runs, then over-speed runs), merges every one of those intervals
 * into a single non-overlapping excluded pair-index set, and derives covered metres and seconds as
 * the COMPLEMENT of that merged exclusion set against the stream's own span — the opposite direction
 * from production's covered-run accumulation. Two artifacts built the same way can share the same
 * blind spot; a structurally different traversal order is what makes this recount a real second
 * opinion rather than a mirror of the first mistake.
 *
 * LOCAL DUPLICATES (each a LOCAL duplicate, never imported, read live from source this session):
 *   - `LOCAL_GAP_THRESHOLD_SEC = 10`, a local duplicate of `RECORDING_GAP_ABS_THRESHOLD_SEC`
 *     (`src/analytics/pace-derivation.ts`).
 *   - `LOCAL_PAUSE_MULTIPLIER = 5`, a local duplicate of `PAUSE_GAP_P90_MULTIPLIER`
 *     (`src/analytics/pace-derivation.ts`).
 *   - `LOCAL_SPEED_LIMIT_MPS = 7.35`, a local duplicate of `UNRELIABLE_SPEED_LIMIT_MPS`
 *     (`src/analytics/unreliable-segments.ts`; the shipped figure of record is also recorded in
 *     `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`).
 *   - `localQuantileR7`, a local duplicate of the R-7 quantile SHAPE used by `quantile`
 *     (`src/analytics/pace-derivation.ts`), written independently (own variable names, own loop) so
 *     this recount does not share `quantile`'s vocabulary with the code under test.
 * Duplicating these tiny constants and the quantile shape is the price of staying a genuinely
 * independent recount rather than sharing vocabulary with the code it checks.
 *
 * THE BOUND ON ITS CLAIM: this script verifies that the shipped running pace's covered/excluded
 * metres and seconds agree with an independently derived pair, for the named activities and the
 * archive it covers. It does NOT and cannot arbitrate the D-05 disagreement threshold itself — that
 * question belongs to the calibration script, which legitimately DOES import the running-pace
 * function because arbitration is its job.
 *
 * Shape follows `compute-unreliable-segment-recount.mjs` / `compute-pause-classification-recount.mjs`:
 * pure exported functions, a guarded `main()` behind the self-execution check, so
 * `compute-running-pace-recount.test.mjs` can import the pure functions without triggering a real
 * file read as an import-time side effect.
 *
 * Default read targets are every `data/streams/*.json` file (raw `t`/`d` arrays; `manifest.json` is
 * skipped, never treated as a stream) and, for provenance only, every `data/activities/*.json`
 * file's own `start_date`. A file that does not parse, or whose `t`/`d` are not equal-length arrays
 * of at least two finite, non-decreasing numbers, is skipped and counted by reason — the sweep never
 * throws on a bad file.
 *
 * Write target: `.planning/phases/35-stream-derived-running-pace/35-RUNNING-PACE-RECOUNT.md`, only
 * when invoked with `--write`; a bare invocation prints to stdout and writes nothing. This plan
 * (35-04) BUILDS this script; plan 35-05 is the one that runs it and commits the artifact.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data', 'streams');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data', 'activities');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning',
  'phases',
  '35-stream-derived-running-pace',
  '35-RUNNING-PACE-RECOUNT.md'
);

/** The four named scoping activities (35-CONTEXT.md), reported individually every run. */
export const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390', '5059204779'];

/**
 * A LOCAL DUPLICATE of `RECORDING_GAP_ABS_THRESHOLD_SEC` (`src/analytics/pace-derivation.ts`, live
 * value read this session), NOT imported from there — duplicating this tiny constant is the price
 * of staying a genuinely independent recount.
 */
const LOCAL_GAP_THRESHOLD_SEC = 10;

/**
 * A LOCAL DUPLICATE of `PAUSE_GAP_P90_MULTIPLIER` (`src/analytics/pace-derivation.ts`, live value
 * read this session), NOT imported from there.
 */
const LOCAL_PAUSE_MULTIPLIER = 5;

/**
 * A LOCAL DUPLICATE of `UNRELIABLE_SPEED_LIMIT_MPS` (`src/analytics/unreliable-segments.ts`, live
 * value read this session; also the shipped figure of record in
 * `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`), NOT imported
 * from there.
 */
const LOCAL_SPEED_LIMIT_MPS = 7.35;

/**
 * The rendered artifact's own "Local duplicated constants" / "Scope and bound on claim" sections
 * legitimately NAME the modules this recount is forbidden to import, for a human reader's benefit —
 * exactly as this file's own header docblock does. Built by joining parts (never as one contiguous
 * string literal) so the zero-import string-scan guard, which fails closed on ANY of these
 * substrings anywhere in this file's comment-stripped source, does not mistake this file's own
 * prose-about-the-modules for a forbidden import specifier — the same trick
 * `compute-pause-classification-recount.mjs`'s `PHASE_DIR_NAME` uses for the same reason.
 */
const PACE_DERIVATION_MODULE_NAME = ['pace', 'derivation'].join('-');
const UNRELIABLE_SEGMENTS_MODULE_NAME = ['unreliable', 'segments'].join('-');
const PACE_QUALITY_MODULE_NAME = ['pace', 'quality'].join('-');
const BEST_EFFORT_MODULE_NAME = ['best', 'effort'].join('-');
const SRC_DIR_LABEL = ['src', ''].join('/');
const DIST_DIR_LABEL = ['dist', ''].join('/');

/**
 * True for a `data/streams/` entry that is a genuine per-activity stream file, never the archive's
 * own `manifest.json`. A local duplicate of the shape used by the other calibration/recount
 * scripts' own `isStreamFile`, written independently rather than imported (this file imports
 * nothing from `scripts/`, either).
 */
export function isStreamFile(filename) {
  return filename.endsWith('.json') && filename !== 'manifest.json';
}

export function idFromFilename(filename) {
  return filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename;
}

/**
 * This recount's own stream validation — never imports `validateStreamSeries`
 * (`src/analytics/best-effort-utils.ts`). Checks: both are arrays of equal length >= 2, every value
 * is a finite number, and `t`/`d` are non-decreasing. Never throws.
 */
export function checkStreamLocal(t, d) {
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
 * A LOCAL, independently-written R-7 quantile (linear interpolation between order statistics on an
 * already-ascending array), never sharing `quantile`'s own variable names or loop shape
 * (`src/analytics/pace-derivation.ts`). `NaN` on an empty input, the single value on a 1-element
 * input — the same edge-case contract as the code under test, arrived at independently because R-7
 * is a standard definition, not because this file reused its implementation.
 */
export function localQuantileR7(valuesAscending, q) {
  const count = valuesAscending.length;
  if (count === 0) return NaN;
  if (count === 1) return valuesAscending[0];

  const rank = (count - 1) * q;
  const lowerIdx = Math.floor(rank);
  const upperIdx = Math.ceil(rank);
  if (lowerIdx === upperIdx) return valuesAscending[lowerIdx];

  const weight = rank - lowerIdx;
  return valuesAscending[lowerIdx] + weight * (valuesAscending[upperIdx] - valuesAscending[lowerIdx]);
}

/**
 * This recount's own advance-interval sweep — the real-time gap between each pair of samples where
 * `d` actually advances, seeded with `lastAdvanceSec = t[0]` so the first advance is measured from
 * the stream's own start. Returns intervals sorted ascending, ready for `localQuantileR7`. Assumes
 * `checkStreamLocal(t, d).ok` already holds.
 */
export function localAdvanceIntervalsSec(t, d) {
  const n = t.length;
  const out = [];
  let lastAdvanceSec = t[0];
  for (let i = 1; i < n; i++) {
    if (d[i] > d[i - 1]) {
      out.push(t[i] - lastAdvanceSec);
      lastAdvanceSec = t[i];
    }
  }
  return out.sort((a, b) => a - b);
}

/**
 * (a) Recording-gap intervals: every maximal run of consecutive pairs with
 * `dt = t[i+1] - t[i] > LOCAL_GAP_THRESHOLD_SEC`, as `[{ startIndex, endIndex }]` pair-index ranges
 * (half-open: pairs `startIndex..endIndex-1`). Assumes `checkStreamLocal(t, d).ok` already holds.
 */
export function findRecordingGapRanges(t, d) {
  const ranges = [];
  const n = t.length;
  let i = 0;
  while (i < n - 1) {
    if (t[i + 1] - t[i] > LOCAL_GAP_THRESHOLD_SEC) {
      const startIndex = i;
      let endIndex = i + 1;
      while (endIndex < n - 1 && t[endIndex + 1] - t[endIndex] > LOCAL_GAP_THRESHOLD_SEC) {
        endIndex += 1;
      }
      ranges.push({ startIndex, endIndex });
      i = endIndex;
    } else {
      i += 1;
    }
  }
  return ranges;
}

/**
 * (b) Pause intervals: every maximal run of consecutive zero-advance pairs (`d[i+1] - d[i] <= 0`,
 * which — given `d` is non-decreasing — means exactly zero) whose own total duration exceeds
 * `LOCAL_PAUSE_MULTIPLIER * p90AdvanceSec`, as `[{ startIndex, endIndex }]` pair-index ranges. A
 * run is reported regardless of whether individual pairs inside it also happen to be a recording
 * gap — the merge step (`mergeExcludedRanges`) is what removes the resulting overlap, never a
 * per-pair priority check here (the deliberate structural difference from production's pass-1
 * priority order). When `p90AdvanceSec` is not finite (a stream with no advance interval at all),
 * no run is ever reported — there is no basis to judge "long relative to what".
 */
export function findPauseRanges(t, d, p90AdvanceSec) {
  const ranges = [];
  if (!Number.isFinite(p90AdvanceSec)) return ranges;

  const n = t.length;
  let i = 0;
  while (i < n - 1) {
    if (d[i + 1] - d[i] <= 0) {
      const startIndex = i;
      let endIndex = i + 1;
      while (endIndex < n - 1 && d[endIndex + 1] - d[endIndex] <= 0) {
        endIndex += 1;
      }
      const durationSec = t[endIndex] - t[startIndex];
      if (durationSec > LOCAL_PAUSE_MULTIPLIER * p90AdvanceSec) {
        ranges.push({ startIndex, endIndex });
      }
      i = endIndex;
    } else {
      i += 1;
    }
  }
  return ranges;
}

/**
 * (c) Over-speed intervals, in two parts, mirroring the detector's merge intent (a burst can
 * condemn a run of pairs, and a burst touching a recording gap is still a burst) WITHOUT reusing
 * its gap-first traversal:
 *   1. Every maximal run of consecutive strictly-advancing pairs (`d[i+1] - d[i] > 0`) whose
 *      AGGREGATE implied speed (`totalMetres / totalSeconds` over the whole run) exceeds
 *      `LOCAL_SPEED_LIMIT_MPS`.
 *   2. Additionally, the single pair immediately before a recording gap's start and the single pair
 *      immediately after its end, each checked on ITS OWN implied speed — catching an isolated
 *      gap-adjacent burst too short to dominate a longer run's own aggregate.
 * Returns `[{ startIndex, endIndex }]` pair-index ranges, not yet merged or deduplicated (the merge
 * step below is what removes any overlap between the two parts).
 */
export function findOverspeedRanges(t, d, recordingGapRanges) {
  const ranges = [];
  const n = t.length;

  let i = 0;
  while (i < n - 1) {
    if (d[i + 1] - d[i] > 0) {
      let j = i;
      while (j + 1 < n - 1 && d[j + 2] - d[j + 1] > 0) {
        j += 1;
      }
      const metres = d[j + 1] - d[i];
      const seconds = t[j + 1] - t[i];
      const impliedSpeedMps = seconds > 0 ? metres / seconds : Infinity;
      if (impliedSpeedMps > LOCAL_SPEED_LIMIT_MPS) {
        ranges.push({ startIndex: i, endIndex: j + 1 });
      }
      i = j + 1;
    } else {
      i += 1;
    }
  }

  function checkSinglePair(pairIndex) {
    if (pairIndex < 0 || pairIndex > n - 2) return;
    const metres = d[pairIndex + 1] - d[pairIndex];
    const seconds = t[pairIndex + 1] - t[pairIndex];
    if (seconds > 0 && metres / seconds > LOCAL_SPEED_LIMIT_MPS) {
      ranges.push({ startIndex: pairIndex, endIndex: pairIndex + 1 });
    }
  }

  for (const gap of recordingGapRanges) {
    checkSinglePair(gap.startIndex - 1);
    checkSinglePair(gap.endIndex);
  }

  return ranges;
}

/**
 * (d) Merges every excluded pair-index range from (a)+(b)+(c) into a set of non-overlapping,
 * sorted-ascending ranges. Touching or overlapping ranges are combined into one.
 */
export function mergeExcludedRanges(ranges) {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort(
    (a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex
  );
  const merged = [{ ...sorted[0] }];
  for (let k = 1; k < sorted.length; k++) {
    const cur = sorted[k];
    const last = merged[merged.length - 1];
    if (cur.startIndex <= last.endIndex) {
      last.endIndex = Math.max(last.endIndex, cur.endIndex);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * The full interval-first recount for one activity's `t`/`d` (D-08). Runs (a)-(e) of this file's
 * own docblock: recording-gap ranges, pause ranges (using this recount's own R-7 p90 of its own
 * advance-interval sweep), over-speed ranges, merges all three into one non-overlapping excluded
 * set, then derives covered metres/seconds as the COMPLEMENT of that set against the stream's own
 * span — the opposite direction from production's covered-run accumulation. Never throws; returns
 * `{ ok: false, reason }` on an invalid stream.
 */
export function recountRunningPace(t, d) {
  const streamCheck = checkStreamLocal(t, d);
  if (!streamCheck.ok) return { ok: false, reason: streamCheck.reason };

  const n = t.length;
  const spanSec = t[n - 1] - t[0];
  const totalM = d[n - 1] - d[0];

  const recordingGapRanges = findRecordingGapRanges(t, d);

  const advanceIntervalsSec = localAdvanceIntervalsSec(t, d);
  const p90AdvanceSec =
    advanceIntervalsSec.length === 0 ? Infinity : localQuantileR7(advanceIntervalsSec, 0.9);
  const pauseRanges = findPauseRanges(t, d, p90AdvanceSec);

  const overspeedRanges = findOverspeedRanges(t, d, recordingGapRanges);

  const merged = mergeExcludedRanges([...recordingGapRanges, ...pauseRanges, ...overspeedRanges]);

  let recountExcludedSec = 0;
  let recountExcludedM = 0;
  for (const range of merged) {
    recountExcludedSec += t[range.endIndex] - t[range.startIndex];
    recountExcludedM += d[range.endIndex] - d[range.startIndex];
  }

  const recountCoveredSec = spanSec - recountExcludedSec;
  const recountCoveredM = totalM - recountExcludedM;
  const recountRunningPaceSecPerKm =
    recountCoveredM > 0 ? recountCoveredSec / (recountCoveredM / 1000) : null;

  return {
    ok: true,
    spanSec,
    totalM,
    recountExcludedSec,
    recountExcludedM,
    recountCoveredSec,
    recountCoveredM,
    recountRunningPaceSecPerKm,
    excludedRangeCount: merged.length,
  };
}

/**
 * Sweeps every `data/streams/*.json` file, skipping (and counting by reason) any file that does not
 * parse or whose `t`/`d` fail `checkStreamLocal`. Never throws on a bad file. Returns per-activity
 * recount rows (for the named activities) plus archive-wide totals over every computable activity.
 */
export function sweepArchive(streamsDir) {
  let filenames;
  try {
    filenames = readdirSync(streamsDir).filter(isStreamFile).sort();
  } catch (error) {
    return { ok: false, reason: `could not read ${streamsDir}: ${error.message}` };
  }

  const skipped = { parseError: 0, invalidShape: 0, notComputableNoCoveredDistance: 0 };
  const namedRows = {};
  let computableCount = 0;
  let archiveSpanSec = 0;
  let archiveTotalM = 0;
  let archiveExcludedSec = 0;
  let archiveExcludedM = 0;

  for (const filename of filenames) {
    const id = idFromFilename(filename);
    let doc;
    try {
      doc = JSON.parse(readFileSync(join(streamsDir, filename), 'utf8'));
    } catch {
      skipped.parseError += 1;
      continue;
    }

    const t = Array.isArray(doc.t) ? doc.t : null;
    const d = Array.isArray(doc.d) ? doc.d : null;
    const recount = t && d ? recountRunningPace(t, d) : { ok: false, reason: 't/d not arrays' };
    if (!recount.ok) {
      skipped.invalidShape += 1;
      continue;
    }

    if (!(recount.recountCoveredM > 0)) {
      skipped.notComputableNoCoveredDistance += 1;
      if (NAMED_ACTIVITY_IDS.includes(id)) {
        namedRows[id] = { id, computable: false, reason: 'no covered distance', ...recount };
      }
      continue;
    }

    computableCount += 1;
    archiveSpanSec += recount.spanSec;
    archiveTotalM += recount.totalM;
    archiveExcludedSec += recount.recountExcludedSec;
    archiveExcludedM += recount.recountExcludedM;

    if (NAMED_ACTIVITY_IDS.includes(id)) {
      namedRows[id] = { id, computable: true, ...recount };
    }
  }

  return {
    ok: true,
    streamFileCount: filenames.length,
    skipped,
    computableCount,
    namedRows,
    archive: {
      spanSec: archiveSpanSec,
      totalM: archiveTotalM,
      excludedSec: archiveExcludedSec,
      excludedM: archiveExcludedM,
      coveredSec: archiveSpanSec - archiveExcludedSec,
      coveredM: archiveTotalM - archiveExcludedM,
    },
  };
}

function round1(x) {
  return Number(x.toFixed(1));
}

function formatPace(secPerKm) {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return 'n/a';
  const totalSec = Math.round(secPerKm);
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}/km (${round1(secPerKm)})`;
}

/**
 * Renders the full recount artifact from an already-computed `result` (the shape returned by
 * assembling `sweepArchive` plus `provenance`). DETERMINISTIC — no wall-clock timestamp, no bare
 * `rev-parse HEAD` commit id, no source-file hash: a re-render of the same `result` is
 * byte-identical, satisfying plan 35-05's byte-identical-regeneration requirement.
 */
export function renderRecountMarkdown(result) {
  const lines = [];

  lines.push('# Phase 35: Stream-Derived Running Pace — Independent Recount (D-08)');
  lines.push('');

  lines.push('## Scope and bound on claim');
  lines.push('');
  lines.push(
    'This artifact verifies that the shipped running pace\'s covered/excluded metres and seconds ' +
      `(produced by \`deriveRunningPace\`, \`${SRC_DIR_LABEL}analytics/${PACE_DERIVATION_MODULE_NAME}.ts\`) agree ` +
      'with an independently derived pair, for the named activities and the archive it covers. It ' +
      'does NOT and cannot arbitrate the D-05 disagreement threshold itself — that question belongs ' +
      'to the calibration script, which legitimately DOES import the running-pace function because ' +
      'arbitration is its job. This recount has zero `import`/`require`/dynamic-`import()` ' +
      `statements naming \`${PACE_DERIVATION_MODULE_NAME}\`, \`${UNRELIABLE_SEGMENTS_MODULE_NAME}\`, ` +
      `\`${PACE_QUALITY_MODULE_NAME}\` or \`${BEST_EFFORT_MODULE_NAME}\`, in any spelling, and imports ` +
      `nothing from \`${SRC_DIR_LABEL}\` or \`${DIST_DIR_LABEL}\` — a recount that imported the code producing the numbers it ` +
      'checks would agree with itself by construction.'
  );
  lines.push('');

  lines.push('## Local duplicated constants');
  lines.push('');
  lines.push(
    `LOCAL_GAP_THRESHOLD_SEC = ${LOCAL_GAP_THRESHOLD_SEC} (local duplicate of ` +
      `RECORDING_GAP_ABS_THRESHOLD_SEC, ${SRC_DIR_LABEL}analytics/${PACE_DERIVATION_MODULE_NAME}.ts)`
  );
  lines.push(
    `LOCAL_PAUSE_MULTIPLIER = ${LOCAL_PAUSE_MULTIPLIER} (local duplicate of PAUSE_GAP_P90_MULTIPLIER, ` +
      `${SRC_DIR_LABEL}analytics/${PACE_DERIVATION_MODULE_NAME}.ts)`
  );
  lines.push(
    `LOCAL_SPEED_LIMIT_MPS = ${LOCAL_SPEED_LIMIT_MPS} (local duplicate of UNRELIABLE_SPEED_LIMIT_MPS, ` +
      `${SRC_DIR_LABEL}analytics/${UNRELIABLE_SEGMENTS_MODULE_NAME}.ts; figure of record in ` +
      '32-unreliable-segment-detection-calibration/32-CALIBRATION.md)'
  );
  lines.push('');

  lines.push('## Named activities');
  lines.push('');
  lines.push('| Activity | Computable | Covered m | Covered s | Excluded m | Excluded s | Running pace |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const id of NAMED_ACTIVITY_IDS) {
    const row = result.namedRows[id];
    if (!row) {
      lines.push(`| ${id} | not found | - | - | - | - | - |`);
      continue;
    }
    if (!row.computable) {
      lines.push(`| ${id} | no (${row.reason}) | - | - | - | - | - |`);
      continue;
    }
    lines.push(
      `| ${id} | yes | ${round1(row.recountCoveredM)} | ${round1(row.recountCoveredSec)} | ` +
        `${round1(row.recountExcludedM)} | ${round1(row.recountExcludedSec)} | ` +
        `${formatPace(row.recountRunningPaceSecPerKm)} |`
    );
  }
  lines.push('');

  lines.push('## Archive-wide reconciliation');
  lines.push('');
  lines.push(`Streams scanned: ${result.streamFileCount}`);
  lines.push(`Computable: ${result.computableCount}`);
  lines.push(
    `Archive-wide covered/excluded (computable activities only): coveredM=${round1(
      result.archive.coveredM
    )}, coveredSec=${round1(result.archive.coveredSec)}, excludedM=${round1(
      result.archive.excludedM
    )}, excludedSec=${round1(result.archive.excludedSec)}`
  );
  lines.push('');

  lines.push('## Skipped and non-computable');
  lines.push('');
  lines.push(`Parse error: ${result.skipped.parseError}`);
  lines.push(`Invalid shape (checkStreamLocal failed): ${result.skipped.invalidShape}`);
  lines.push(
    `No covered distance (recountCoveredM <= 0): ${result.skipped.notComputableNoCoveredDistance}`
  );
  lines.push('');

  lines.push('## Inputs');
  lines.push('');
  lines.push(`Streams tree (git rev-parse HEAD:data/streams): ${result.provenance.streamsTree}`);
  lines.push(`Newest activity start date: ${result.provenance.newestActivityStartDate ?? 'unknown'}`);
  lines.push('');

  return lines.join('\n');
}

/** Content-addressed provenance: names the run's actual input (the committed stream archive's git
 * tree), never `rev-parse HEAD` alone, never a wall-clock read. */
function gitId(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown (git failed)';
  }
}

function newestActivityStartDate(activitiesDir) {
  let newest = null;
  let files;
  try {
    files = readdirSync(activitiesDir);
  } catch {
    return null;
  }
  for (const filename of files) {
    if (!filename.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(activitiesDir, filename), 'utf8'));
      if (typeof doc.start_date === 'string' && (newest === null || doc.start_date > newest)) {
        newest = doc.start_date;
      }
    } catch {
      // skip malformed activity docs — not this script's concern
    }
  }
  return newest;
}

function main() {
  console.log(`D-08 independent running-pace recount: reading ${STREAMS_DIR} off disk (no analytics import)...\n`);

  const swept = sweepArchive(STREAMS_DIR);
  if (!swept.ok) {
    console.error(`FAILED: ${swept.reason}`);
    process.exitCode = 1;
    return;
  }

  const result = {
    ...swept,
    provenance: {
      streamsTree: gitId('rev-parse HEAD:data/streams'),
      newestActivityStartDate: newestActivityStartDate(ACTIVITIES_DIR),
    },
  };

  const markdown = renderRecountMarkdown(result);
  console.log(markdown);

  const shouldWrite = process.argv.includes('--write');
  if (shouldWrite) {
    writeFileSync(OUTPUT_PATH, markdown, 'utf8');
    console.log(`\nWrote ${OUTPUT_PATH}`);
  }
}

// Self-execution guard, mirroring compute-unreliable-segment-recount.mjs /
// compute-pause-classification-recount.mjs: main() runs only under direct invocation, so
// compute-running-pace-recount.test.mjs can import the pure functions above without triggering a
// real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
