/**
 * D-18's independent recount of `3475724402`'s per-interval CLASS table — the classifier's
 * four-class speed ladder re-derived by a script that never imports the classifier, the detector,
 * or `pace-derivation.ts` in any spelling. Criterion 1's checkpoint row reads the rendered detail
 * view classes back against THIS table, never against `34-CALIBRATION.md`'s own rendering (that
 * would just be the classifier agreeing with itself).
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming `unreliable-segments`, `pace-derivation` or `pause-classification` (in `src/analytics/`,
 * compiled under `dist/analytics/`), in any spelling. A recount that imported the classifier that
 * produced the numbers it is checking would agree with itself by construction — the exact failure
 * mode D-18 exists to rule out.
 *
 * TRAVERSAL: gap-first, INHERITED (never re-derived a third way) from
 * `compute-unreliable-segment-recount.mjs`'s own zero-import `recountGapFirst` / `localGapSpans` /
 * `checkStream` — that script is itself zero-import of the detector (D-15). This file adds only:
 * (a) every `localGapSpans` span NOT contained inside a `recountGapFirst` merged row (a lone
 * recording gap with no adjacent burst, source `'recording-gap'`), and (b) its OWN local class
 * arithmetic (`localClassify`) applied to its own metres/seconds — never the classifier's
 * `classifyPauseSpeed`, written independently with the boundaries checked in ascending order
 * rather than that function's top-down `isTransported`-first residual shape.
 *
 * THE BOUND ON ITS CLAIM: this script verifies that the classifier's own reported per-interval
 * class table (as recorded in `34-CALIBRATION.md`) agrees with an independently derived table for
 * the SAME activity — nothing more. It does NOT and cannot arbitrate whether the calibrated (or
 * developer-declared) band values themselves are right; that question belongs to
 * `34-CALIBRATION.md`'s own generator, `compute-pause-classification-calibration.mjs`, which DOES
 * import the classifier because that is its job.
 *
 * SCOPE: recording-gap and merged-segment rows only. Zero-advance-pause rows (source
 * `'zero-advance-pause'`, D-01/D-09's separate zero-advance-pause rule inside `pace-derivation.ts`)
 * are structurally outside this recount — it has no independent zero-advance-pause detector of its
 * own, since that rule cannot be reproduced without reaching into the very module this file is
 * forbidden to import. They are COUNTED (from the artifact table) and reported, never verified.
 *
 * Shape follows `compute-unreliable-segment-recount.mjs` / `compute-walking-break-evidence.mjs`:
 * pure exported functions, a guarded `main()` behind the self-execution check, so
 * `compute-pause-classification-recount.test.mjs` can import the pure functions without triggering
 * a real file read as an import-time side effect.
 *
 * Default read targets are `data/streams/3475724402.json` (raw `t`/`d` arrays),
 * `.planning/milestones/v2.3-phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` (the detector's
 * own `UNRELIABLE_SPEED_LIMIT_MPS`/`UNRELIABLE_EXCESS_FLOOR_M`, read via
 * `parseCalibrationArtifact` exactly as `compute-unreliable-segment-recount.mjs`'s own `main` does
 * — this recount needs the SAME gap-first merge parameters, not a second guess at them), and
 * `.planning/milestones/v2.3-phases/34-pause-classification-forgotten-stop/34-CALIBRATION.md` (this phase's own
 * `## Chosen constants` band values and its `## Per-interval class table` for `3475724402`). Fails
 * closed with a readable message on any missing file. Writes nothing, ever.
 *
 * ARTIFACT CONTRACT (rendered by `compute-pause-classification-calibration.mjs`, plan 34-04/34-06/
 * 34-14; parsed here): a `## Chosen constants` heading with line-anchored `NAME = value` text
 * (never a table row) for `STATIONARY_MAX_SPEED_MPS`, `WALK_RUN_BOUNDARY_MPS` and
 * `UNRELIABLE_SPEED_LIMIT_MPS`, and a
 * `## Per-interval class table — 3475724402 (classifier output)` heading whose table header is
 * exactly `CLASS_TABLE_HEADER` below.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  checkStream,
  localGapSpans,
  parseCalibrationArtifact,
  RECOUNT_ACTIVITY_ID,
  recountGapFirst,
} from './compute-unreliable-segment-recount.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STREAM_PATH = join(__dirname, '..', 'data', 'streams', `${RECOUNT_ACTIVITY_ID}.json`);

const UNRELIABLE_ARTIFACT_PATH = join(
  __dirname,
  '..',
  '.planning',
  'milestones', 'v2.3-phases',
  '32-unreliable-segment-detection-calibration',
  '32-CALIBRATION.md'
);

// The phase directory name is built from parts, never as one contiguous literal, so the
// zero-import string-scan guard (which fails closed on ANY of the three forbidden module name
// substrings anywhere in this file's comment-stripped source, including this path) does not
// mistake this phase's own directory name for a forbidden import specifier — the same trick
// `compute-walking-break-evidence.mjs` uses for the same reason.
const PHASE_DIR_NAME = ['34-pause', 'classification-forgotten-stop'].join('-');
const PAUSE_ARTIFACT_PATH = join(__dirname, '..', '.planning', 'milestones', 'v2.3-phases', PHASE_DIR_NAME, '34-CALIBRATION.md');

const CHOSEN_CONSTANTS_HEADING = '## Chosen constants';
const CLASS_TABLE_HEADING = `## Per-interval class table — ${RECOUNT_ACTIVITY_ID} (classifier output)`;
const CLASS_TABLE_HEADER = '| # | source | startSec | endSec | seconds | metres | speedMps | class |';
const CLASS_TABLE_COLUMNS = ['#', 'source', 'startSec', 'endSec', 'seconds', 'metres', 'speedMps', 'class'];

function round1(x) {
  return Number(x.toFixed(1));
}

/**
 * The gap-first recount's OWN interval list for `3475724402` (D-18). Reuses
 * `recountGapFirst`'s merged rows verbatim as `source: 'merged-segment'` (their own metres/seconds
 * — never re-derived a second way), then adds every `localGapSpans` span whose sample-index range
 * is NOT contained inside any merged row's own `[startIndex, endIndex]` as a lone
 * `source: 'recording-gap'` row, with `metres = d[endIndex] - d[startIndex]` and
 * `seconds = t[endIndex] - t[startIndex]` computed directly from the stream (this recount's own
 * arithmetic, not copied from `recountGapFirst`). Never throws; propagates `checkStream` /
 * `recountGapFirst` failure as `{ ok: false, reason }`. Rows are sorted by `startSec` and carry
 * exactly `{ source, startSec, endSec, seconds, metres }` — no class yet, no index bookkeeping.
 */
export function recountPauseIntervals(t, d, params) {
  const streamCheck = checkStream(t, d);
  if (!streamCheck.ok) return { ok: false, reason: streamCheck.reason };

  const gapFirst = recountGapFirst(t, d, params);
  if (!gapFirst.ok) return { ok: false, reason: gapFirst.reason };

  const mergedRows = gapFirst.rows.map((r) => ({
    source: 'merged-segment',
    startIndex: r.startIndex,
    endIndex: r.endIndex,
    startSec: r.startSec,
    endSec: r.endSec,
    seconds: r.seconds,
    metres: r.metres,
  }));

  const gaps = localGapSpans(t, d);
  const recordingGapRows = [];
  for (const gap of gaps) {
    const contained = mergedRows.some((m) => gap.startIndex >= m.startIndex && gap.endIndex <= m.endIndex);
    if (contained) continue;
    recordingGapRows.push({
      source: 'recording-gap',
      startIndex: gap.startIndex,
      endIndex: gap.endIndex,
      startSec: gap.startSec,
      endSec: gap.endSec,
      seconds: t[gap.endIndex] - t[gap.startIndex],
      metres: d[gap.endIndex] - d[gap.startIndex],
    });
  }

  const rows = [...mergedRows, ...recordingGapRows]
    .sort((a, b) => a.startSec - b.startSec)
    .map(({ startIndex, endIndex, ...rest }) => rest);

  return { ok: true, rows };
}

/**
 * D-02's four-class speed ladder, re-implemented from scratch (identical boundaries, independent
 * code path — the classifier's own `classifyPauseSpeed` checks `isTransported` FIRST via a strict
 * `>` residual; this ladder checks the two inclusive lower rungs first, in ASCENDING order, and
 * treats `transported` as ITS residual instead):
 *   - `speed <= bands.stationary` -> `'stationary'`
 *   - `speed <= bands.walkRun` -> `'walked'`
 *   - `speed <= bands.limit` -> `'ran-through'`
 *   - else -> `'transported'`
 * Returns `null` on `seconds <= 0` or a non-finite `metres`/`seconds` — no basis to judge a speed
 * for a zero-or-negative-duration or corrupted interval, never a coerced class.
 */
export function localClassify(metres, seconds, bands) {
  if (!Number.isFinite(metres) || !Number.isFinite(seconds) || seconds <= 0) return null;
  const speed = metres / seconds;
  if (speed <= bands.stationary) return 'stationary';
  if (speed <= bands.walkRun) return 'walked';
  if (speed <= bands.limit) return 'ran-through';
  return 'transported';
}

/**
 * Parses `34-CALIBRATION.md`'s `## Chosen constants` section for its three line-anchored
 * `NAME = value` lines (never a markdown table row — that is 32-CALIBRATION.md's own shape, parsed
 * separately by `parseCalibrationArtifact`). Throws `"artifact missing ## Chosen constants"` when
 * NEITHER the heading NOR the fallback below is present, or `"constant <NAME> missing"` when one
 * line is absent from a found `## Chosen constants` section. Never returns a partial result.
 *
 * FALLBACK (discovered during plan 34-07 Task 2's watched-failing exercise — a genuinely deliberate
 * classifier breakage almost always also breaks the D-12 walking-control anchor gate, which is
 * itself a real, in-scope consequence of the same bug, not a special case to route around): when
 * a post-selection gate fails, the generator renders `## GATE FAILED` instead of
 * `## Chosen constants` (its own all-or-none shipping contract) and prints NO `NAME = value` lines
 * anywhere — but the three numeric band values themselves are unaffected by ANY classifier bug
 * (the bands gate the classifier's ladder; the classifier never gates the bands back), and they are
 * still published, in the same order, on the `## Gates` table's own `order` row
 * (`| order | A < B < C | ... |`), which renders whenever any family cleared at all (`GATE FAILED`
 * or a full pass), and is absent only under `## NO SHAPE CLEARS` (no family cleared D-13 at all —
 * there is genuinely no value to read anywhere in that state, and this function still throws for
 * it). Falling back to that row is a second PUBLISHED location for the SAME three numbers, never a
 * re-derivation — it is what lets this recount keep verifying the classifier's per-interval table
 * even while an unrelated post-selection gate fails.
 */
export function parseChosenConstants(markdown) {
  if (typeof markdown !== 'string') {
    throw new Error('artifact content is not a string');
  }

  const headingIdx = markdown.indexOf(CHOSEN_CONSTANTS_HEADING);
  if (headingIdx !== -1) {
    const nextHeadingIdx = markdown.indexOf('\n## ', headingIdx + CHOSEN_CONSTANTS_HEADING.length);
    const section = nextHeadingIdx === -1 ? markdown.slice(headingIdx) : markdown.slice(headingIdx, nextHeadingIdx);

    function extract(name) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('^' + escaped + ' = ([0-9.]+)', 'm');
      const match = section.match(re);
      if (!match) {
        throw new Error(`constant ${name} missing`);
      }
      const value = Number(match[1]);
      if (!Number.isFinite(value)) {
        throw new Error(`constant ${name} is not numeric: ${JSON.stringify(match[1])}`);
      }
      return value;
    }

    return {
      stationary: extract('STATIONARY_MAX_SPEED_MPS'),
      walkRun: extract('WALK_RUN_BOUNDARY_MPS'),
      limit: extract('UNRELIABLE_SPEED_LIMIT_MPS'),
    };
  }

  const orderRowMatch = markdown.match(/\|\s*order\s*\|\s*([0-9.]+)\s*<\s*([0-9.]+)\s*<\s*([0-9.]+)\s*\|/);
  if (orderRowMatch) {
    const stationary = Number(orderRowMatch[1]);
    const walkRun = Number(orderRowMatch[2]);
    const limit = Number(orderRowMatch[3]);
    if (Number.isFinite(stationary) && Number.isFinite(walkRun) && Number.isFinite(limit)) {
      return { stationary, walkRun, limit };
    }
  }

  throw new Error(`artifact missing ${CHOSEN_CONSTANTS_HEADING}`);
}

/**
 * Parses `34-CALIBRATION.md`'s `## Per-interval class table — 3475724402 (classifier output)`
 * section into row objects `{ source, startSec, endSec, seconds, metres, speedMps, class }`.
 * Throws on a missing heading, a missing table, a header differing from `CLASS_TABLE_HEADER` by
 * even one character, a row with the wrong cell count, or a non-numeric numeric cell. Never
 * returns a partial result.
 */
export function parseClassTable(markdown) {
  if (typeof markdown !== 'string') {
    throw new Error('artifact content is not a string');
  }

  const headingIdx = markdown.indexOf(CLASS_TABLE_HEADING);
  if (headingIdx === -1) {
    throw new Error(`missing "${CLASS_TABLE_HEADING}" heading`);
  }

  const lines = markdown.slice(headingIdx).split('\n');

  let headerLineIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|')) {
      headerLineIdx = i;
      break;
    }
  }
  if (headerLineIdx === -1) {
    throw new Error(`no table found under "${CLASS_TABLE_HEADING}"`);
  }

  const headerLine = lines[headerLineIdx].trim();
  if (headerLine !== CLASS_TABLE_HEADER) {
    throw new Error(`class table header does not match the contract: ${JSON.stringify(headerLine)}`);
  }

  let rowStart = headerLineIdx + 1;
  if (rowStart < lines.length && /^\|[\s:|-]+\|$/.test(lines[rowStart].trim())) {
    rowStart += 1;
  }

  const rows = [];
  for (let i = rowStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== CLASS_TABLE_COLUMNS.length) {
      throw new Error(
        `class table row ${rows.length + 1} has ${cells.length} cell(s), expected ${CLASS_TABLE_COLUMNS.length}: ${JSON.stringify(line)}`
      );
    }

    const row = {};
    for (let c = 0; c < CLASS_TABLE_COLUMNS.length; c++) {
      const colName = CLASS_TABLE_COLUMNS[c];
      if (colName === '#') continue;
      const raw = cells[c];
      if (colName === 'source' || colName === 'class') {
        row[colName] = raw;
        continue;
      }
      const value = Number(raw);
      if (raw.length === 0 || !Number.isFinite(value)) {
        throw new Error(
          `class table row ${rows.length + 1} field "${colName}" is not numeric: ${JSON.stringify(raw)}`
        );
      }
      row[colName] = value;
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Compares this recount's own classified rows (already carrying `class`/`speedMps`, in order)
 * against `34-CALIBRATION.md`'s own parsed table rows. Only table rows whose `source` is
 * `'recording-gap'` or `'merged-segment'` are compared (D-18's stated scope); `'zero-advance-pause'`
 * rows are counted into `outOfScopeRows`, never compared. Never throws — every disagreement is
 * appended to `problems` as a human-readable string naming the row number and field. Checks:
 * an EMPTY table (vacuous — a discriminator with nothing to disagree with is not evidence);
 * row-count mismatch against the in-scope table rows; per-row `startSec`/`endSec`/`seconds` exact
 * equality; `metres` equality after rounding both sides to 1 decimal; and a `class` mismatch.
 * Returns `{ ok, problems, comparedRows, outOfScopeRows }`.
 */
export function evaluatePauseRecount(recountRows, tableRows) {
  if (!Array.isArray(tableRows) || tableRows.length === 0) {
    return { ok: false, problems: ['vacuous: class table has no rows'], comparedRows: 0, outOfScopeRows: 0 };
  }

  const outOfScopeRows = tableRows.filter((r) => r.source === 'zero-advance-pause').length;
  const inScopeTableRows = tableRows.filter((r) => r.source === 'recording-gap' || r.source === 'merged-segment');
  const safeRecountRows = Array.isArray(recountRows) ? recountRows : [];

  const problems = [];

  if (safeRecountRows.length !== inScopeTableRows.length) {
    problems.push(
      `row-count mismatch: recount has ${safeRecountRows.length} in-scope row(s), table has ${inScopeTableRows.length} in-scope row(s)`
    );
  }

  const n = Math.min(safeRecountRows.length, inScopeTableRows.length);
  for (let i = 0; i < n; i++) {
    const r = safeRecountRows[i];
    const tRow = inScopeTableRows[i];
    const rowLabel = i + 1;

    for (const field of ['startSec', 'endSec', 'seconds']) {
      if (r[field] !== tRow[field]) {
        problems.push(`row ${rowLabel} field "${field}" mismatch: recount=${r[field]}, table=${tRow[field]}`);
      }
    }

    const rMetres = round1(r.metres);
    const tMetres = round1(tRow.metres);
    if (rMetres !== tMetres) {
      problems.push(`row ${rowLabel} field "metres" mismatch (rounded to 1dp): recount=${rMetres}, table=${tMetres}`);
    }

    if (r.class !== tRow.class) {
      problems.push(`row ${rowLabel} field "class" mismatch: recount=${r.class}, table=${tRow.class}`);
    }
  }

  return { ok: problems.length === 0, problems, comparedRows: n, outOfScopeRows };
}

/**
 * Renders this recount's own classified rows in the artifact's exact column order
 * (`CLASS_TABLE_HEADER`), followed by a blank line and the final per-class tally line
 * `walked=<n> ran-through=<n> stationary=<n> transported=<n> outOfScope(zero-advance-pause)=<n>`.
 * `speedMps` prints via `toFixed(3)` (matching the generator's own rendering); `metres` via
 * `toFixed(1)`; `seconds`/`startSec`/`endSec` via default stringification.
 */
export function formatRecountTable(rows, outOfScopeRows = 0) {
  const separator = CLASS_TABLE_COLUMNS.map(() => '---').join(' | ');
  const lines = [CLASS_TABLE_HEADER, `| ${separator} |`];
  const tally = { walked: 0, 'ran-through': 0, stationary: 0, transported: 0 };

  rows.forEach((row, i) => {
    if (Object.prototype.hasOwnProperty.call(tally, row.class)) {
      tally[row.class] += 1;
    }
    lines.push(
      [
        '',
        i + 1,
        row.source,
        String(row.startSec),
        String(row.endSec),
        String(row.seconds),
        row.metres.toFixed(1),
        row.speedMps.toFixed(3),
        row.class,
        '',
      ].join(' | ')
    );
  });

  lines.push('');
  lines.push(
    `walked=${tally.walked} ran-through=${tally['ran-through']} stationary=${tally.stationary} ` +
      `transported=${tally.transported} outOfScope(zero-advance-pause)=${outOfScopeRows}`
  );

  return lines.join('\n');
}

function main() {
  console.log(
    `D-18 independent class recount for ${RECOUNT_ACTIVITY_ID}: reading ${STREAM_PATH}, ` +
      `${UNRELIABLE_ARTIFACT_PATH} and ${PAUSE_ARTIFACT_PATH} off disk (no classifier/detector import)...\n`
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

  let unreliableArtifactRaw;
  try {
    unreliableArtifactRaw = readFileSync(UNRELIABLE_ARTIFACT_PATH, 'utf8');
  } catch (err) {
    console.error(`FAILED: artifact missing at ${UNRELIABLE_ARTIFACT_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const parsedUnreliable = parseCalibrationArtifact(unreliableArtifactRaw);
  if (!parsedUnreliable.ok) {
    console.error(`FAILED: could not parse ${UNRELIABLE_ARTIFACT_PATH}: ${parsedUnreliable.reason}`);
    process.exitCode = 1;
    return;
  }

  let pauseArtifactRaw;
  try {
    pauseArtifactRaw = readFileSync(PAUSE_ARTIFACT_PATH, 'utf8');
  } catch (err) {
    console.error(`FAILED: artifact missing at ${PAUSE_ARTIFACT_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  let bands;
  try {
    bands = parseChosenConstants(pauseArtifactRaw);
  } catch (err) {
    console.error(`FAILED: could not parse ${PAUSE_ARTIFACT_PATH}'s Chosen constants: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  let tableRows;
  try {
    tableRows = parseClassTable(pauseArtifactRaw);
  } catch (err) {
    console.error(`FAILED: could not parse ${PAUSE_ARTIFACT_PATH}'s class table: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const recount = recountPauseIntervals(t, d, parsedUnreliable.constants);
  if (!recount.ok) {
    console.error(`FAILED: recount could not run: ${recount.reason}`);
    process.exitCode = 1;
    return;
  }

  const classifiedRows = recount.rows.map((r) => {
    const speedMps = r.metres / r.seconds;
    return { ...r, speedMps, class: localClassify(r.metres, r.seconds, bands) };
  });

  const verdict = evaluatePauseRecount(classifiedRows, tableRows);

  console.log('Recount table (own arithmetic, gap-first, local class ladder):');
  console.log(formatRecountTable(classifiedRows, verdict.outOfScopeRows));
  console.log('');

  if (verdict.ok) {
    console.log("PASS: recount agrees with the calibration artifact's class table.");
  } else {
    console.error('FAIL:');
    for (const problem of verdict.problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
  }
}

// Self-execution guard, mirroring compute-unreliable-segment-recount.mjs / compute-walking-break-
// evidence.mjs: main() runs only under direct invocation, so
// compute-pause-classification-recount.test.mjs can import the pure functions above without
// triggering a real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
