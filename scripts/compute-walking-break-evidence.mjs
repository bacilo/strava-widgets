/**
 * D-12's walking-break evidence generator (34-02) — presents research's three proposed
 * walking-break windows to the developer with measured evidence computed on each candidate's
 * OWN committed stream, and a CAN FAIL / CAN PASS reachability proof in both directions, per
 * `EVIDENCE_MIN_SEC_GRID` minimum-duration candidate.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming `unreliable-segments`, `pace-derivation` or `pause-classification` (in `src/analytics/`,
 * compiled under `dist/analytics/`), in any spelling. Phase 34's classifier (`pause-classification`,
 * not yet built when this plan runs) will eventually judge these same walking-break windows against
 * a calibrated near-zero threshold and minimum duration — a discriminator built from this evidence
 * generator's own window arithmetic would agree with itself by construction, and plan 34-10's
 * checkpoint rows need an INDEPENDENT second opinion to quote (D-18). This generator's window
 * arithmetic (`minWindowSpeed`, `localCreepWindows`) is that independent source.
 *
 * `LOCAL_GAP_THRESHOLD_SEC = 10` is a LOCAL DUPLICATE of `RECORDING_GAP_ABS_THRESHOLD_SEC`
 * (`src/analytics/pace-derivation.ts`), NOT imported from there — the same
 * `compute-unreliable-segment-recount.mjs` discipline: duplicating this tiny constant is the price
 * of staying genuinely independent of the code this evidence will eventually be quoted against.
 *
 * SCOPE: this script presents evidence and records the developer's confirmation (via
 * `parseControlFile`, read by the checkpoint task and by plan 34-04's calibration anchor check).
 * It does NOT choose a near-zero threshold or minimum duration — those are calibrated in plan
 * 34-04/34-06 under the project's pre-declared-shapes / HALT-on-none discipline. Research's own
 * speed/duration figures (34-RESEARCH.md § D-12) are quoted here only as REFERENCES to reconcile
 * against, never as expected values in any assertion.
 *
 * Shape follows `compute-unreliable-segment-recount.mjs`: pure exported functions, a guarded
 * `main()` behind the self-execution check, so `compute-walking-break-evidence.test.mjs` can
 * import the pure functions without triggering a real file read as an import-time side effect.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STREAMS_DIR = join(__dirname, '..', 'data', 'streams');
// The phase directory name is built from parts, never as one contiguous literal, so the
// zero-import string-scan guard (which fails closed on ANY of the three forbidden module name
// substrings anywhere in this file's comment-stripped source, including this path) does not
// mistake this phase's own directory name for a forbidden import specifier.
const PHASE_DIR_NAME = ['34-pause', 'classification-forgotten-stop'].join('-');
const OUTPUT_PATH = join(
  __dirname,
  '..',
  '.planning',
  'phases',
  PHASE_DIR_NAME,
  '34-WALKING-BREAK-EVIDENCE.md'
);

/**
 * A local duplicate of `RECORDING_GAP_ABS_THRESHOLD_SEC` (`src/analytics/pace-derivation.ts:55`),
 * NOT imported from there — see the module docblock's zero-import discipline.
 */
const LOCAL_GAP_THRESHOLD_SEC = 10;

/**
 * Research's three proposed walking-break windows (34-RESEARCH.md § D-12), copied verbatim as
 * research proposals — NOT locked, NOT expected values. The developer confirms at least one via
 * the Task 3 checkpoint before any plan pins it as a fixture (D-12).
 */
export const CANDIDATES = Object.freeze(
  [
    { id: '6286234101', startSec: 5289, endSec: 5696 },
    { id: '3475733231', startSec: 1827, endSec: 2229 },
    { id: '3475715143', startSec: 1590, endSec: 1992 },
  ].map((c) => Object.freeze(c))
);

/**
 * The candidate minimum durations the future calibration (D-06/D-07/D-13) might produce. A fixed
 * grid, not a tuned value — every candidate's reachability is reported at every grid point.
 */
export const EVIDENCE_MIN_SEC_GRID = Object.freeze([10, 20, 30, 60, 120, 300]);

/**
 * Research's own reference figures (34-RESEARCH.md § D-12), used ONLY to render the "Research
 * reconciliation" section beside the measured values — never as an expected value anywhere in this
 * module's own logic.
 */
const RESEARCH_REFERENCE = Object.freeze({
  '6286234101': Object.freeze({ speed: 1.264, durationSec: 407, restSpeed: 2.753 }),
  '3475733231': Object.freeze({ speed: 1.512, durationSec: 402, restSpeed: 2.462 }),
  '3475715143': Object.freeze({ speed: 1.797, durationSec: 402, restSpeed: 2.435 }),
});

/**
 * This generator's own stream validation — never imports `validateStreamSeries`
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
 * The minimum aggregate speed over every sub-window `[t[i], t[j]]` with `startSec <= t[i]`,
 * `t[j] <= endSec`, `j` the smallest index with `t[j] - t[i] >= minSec`, and no local-gap pair
 * (`dt > LOCAL_GAP_THRESHOLD_SEC`) inside the window, of `(d[j] - d[i]) / (t[j] - t[i])`. This is
 * the near-zero threshold ABOVE which a forgotten-stop-style discriminator using `minSec` would
 * flag this candidate — the CAN FAIL / CAN PASS reachability figure. Returns `null` when no such
 * window exists (window shorter than `minSec`, or every candidate start is cut off by a gap or the
 * stream's end before reaching `minSec`). Never throws.
 */
export function minWindowSpeed(t, d, startSec, endSec, minSec) {
  const streamCheck = checkStream(t, d);
  if (!streamCheck.ok) return null;
  if (
    typeof startSec !== 'number' ||
    typeof endSec !== 'number' ||
    typeof minSec !== 'number' ||
    !Number.isFinite(startSec) ||
    !Number.isFinite(endSec) ||
    !Number.isFinite(minSec) ||
    minSec <= 0 ||
    endSec <= startSec
  ) {
    return null;
  }

  const n = t.length;
  let minSpeed = null;

  for (let i = 0; i < n; i++) {
    if (t[i] < startSec) continue;
    if (t[i] > endSec) break;

    let j = i;
    let blocked = false;
    while (t[j] - t[i] < minSec) {
      if (j >= n - 1) {
        blocked = true;
        break;
      }
      if (t[j + 1] - t[j] > LOCAL_GAP_THRESHOLD_SEC) {
        blocked = true;
        break;
      }
      j += 1;
    }
    if (blocked) continue;
    if (t[j] - t[i] < minSec) continue;
    if (t[j] > endSec) continue;

    const duration = t[j] - t[i];
    const speed = (d[j] - d[i]) / duration;
    if (minSpeed === null || speed < minSpeed) minSpeed = speed;
  }

  return minSpeed;
}

/**
 * Maximal unions of `minWindowSpeed`-style sub-windows (duration >= `minSec`, no local gap inside)
 * whose own aggregate speed is `<= maxMps`, over the WHOLE stream (not scoped to one candidate).
 * Plan 34-10 uses this via `--scan` as an independent second source for checkpoint expected values.
 * Never crosses a local gap — a qualifying window itself never crosses one (by construction), and
 * merging only unions windows that already share sample indices, so a merged stretch cannot either.
 * Never throws; returns `[]` on invalid input or when nothing qualifies.
 */
export function localCreepWindows(t, d, maxMps, minSec) {
  const streamCheck = checkStream(t, d);
  if (!streamCheck.ok) return [];
  if (
    typeof maxMps !== 'number' ||
    !Number.isFinite(maxMps) ||
    maxMps < 0 ||
    typeof minSec !== 'number' ||
    !Number.isFinite(minSec) ||
    minSec <= 0
  ) {
    return [];
  }

  const n = t.length;
  const qualifying = [];

  for (let i = 0; i < n; i++) {
    let j = i;
    let blocked = false;
    while (t[j] - t[i] < minSec) {
      if (j >= n - 1) {
        blocked = true;
        break;
      }
      if (t[j + 1] - t[j] > LOCAL_GAP_THRESHOLD_SEC) {
        blocked = true;
        break;
      }
      j += 1;
    }
    if (blocked) continue;

    const duration = t[j] - t[i];
    if (duration <= 0) continue;
    const speed = (d[j] - d[i]) / duration;
    if (speed <= maxMps) {
      qualifying.push({ startIndex: i, endIndex: j });
    }
  }

  if (qualifying.length === 0) return [];

  qualifying.sort((a, b) => a.startIndex - b.startIndex);
  const merged = [];
  let current = { ...qualifying[0] };
  for (let k = 1; k < qualifying.length; k++) {
    const w = qualifying[k];
    if (w.startIndex <= current.endIndex) {
      if (w.endIndex > current.endIndex) current.endIndex = w.endIndex;
    } else {
      merged.push(current);
      current = { ...w };
    }
  }
  merged.push(current);

  return merged.map((m) => ({
    startSec: t[m.startIndex],
    endSec: t[m.endIndex],
    seconds: t[m.endIndex] - t[m.startIndex],
    metres: d[m.endIndex] - d[m.startIndex],
  }));
}

/**
 * Per-candidate window facts: `maxZeroAdvanceRunSec` (the longest contiguous zero-advance stretch
 * inside the window, in seconds — this closes research's unverified flat check for 3475715143),
 * `internalGapCount` (pairs with `dt > LOCAL_GAP_THRESHOLD_SEC` inside the window), `durationSec`,
 * `metres`, `aggregateSpeed` (`metres / durationSec`), `restOfActivitySpeed` (summed d-advance over
 * summed dt of all non-gap pairs OUTSIDE the window), and `hrMin`/`hrMax` (`null` when the `hr`
 * channel is absent from `stream`). Never throws; returns `{ id, ok: false, reason }` on invalid
 * input or when the candidate's own `startSec`/`endSec` are not exact samples in `stream.t`.
 */
export function windowEvidence(stream, candidate) {
  const id = candidate && typeof candidate.id === 'string' ? candidate.id : null;
  if (stream === null || typeof stream !== 'object') {
    return { id, ok: false, reason: 'stream must be an object' };
  }
  const { t, d, hr } = stream;
  const streamCheck = checkStream(t, d);
  if (!streamCheck.ok) {
    return { id, ok: false, reason: streamCheck.reason };
  }
  if (!candidate || typeof candidate.startSec !== 'number' || typeof candidate.endSec !== 'number') {
    return { id, ok: false, reason: 'candidate must have numeric startSec/endSec' };
  }

  const startIdx = t.indexOf(candidate.startSec);
  const endIdx = t.indexOf(candidate.endSec);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { id, ok: false, reason: 'candidate window bounds are not exact samples in stream.t' };
  }

  const durationSec = t[endIdx] - t[startIdx];
  const metres = d[endIdx] - d[startIdx];
  const aggregateSpeed = durationSec > 0 ? metres / durationSec : null;

  let internalGapCount = 0;
  let maxZeroAdvanceRunSec = 0;
  let zeroRunStartSec = null;
  for (let i = startIdx; i < endIdx; i++) {
    const dt = t[i + 1] - t[i];
    const dd = d[i + 1] - d[i];
    if (dt > LOCAL_GAP_THRESHOLD_SEC) internalGapCount += 1;
    if (dd === 0) {
      if (zeroRunStartSec === null) zeroRunStartSec = t[i];
      const runSec = t[i + 1] - zeroRunStartSec;
      if (runSec > maxZeroAdvanceRunSec) maxZeroAdvanceRunSec = runSec;
    } else {
      zeroRunStartSec = null;
    }
  }

  let restSeconds = 0;
  let restMetres = 0;
  const n = t.length;
  for (let i = 0; i < n - 1; i++) {
    if (i >= startIdx && i < endIdx) continue;
    const dt = t[i + 1] - t[i];
    if (dt > LOCAL_GAP_THRESHOLD_SEC) continue;
    restSeconds += dt;
    restMetres += d[i + 1] - d[i];
  }
  const restOfActivitySpeed = restSeconds > 0 ? restMetres / restSeconds : null;

  let hrMin = null;
  let hrMax = null;
  if (Array.isArray(hr)) {
    for (let i = startIdx; i <= endIdx; i++) {
      const v = hr[i];
      if (typeof v === 'number' && Number.isFinite(v)) {
        if (hrMin === null || v < hrMin) hrMin = v;
        if (hrMax === null || v > hrMax) hrMax = v;
      }
    }
  }

  return {
    id,
    ok: true,
    startSec: candidate.startSec,
    endSec: candidate.endSec,
    durationSec,
    metres,
    aggregateSpeed,
    restOfActivitySpeed,
    hrMin,
    hrMax,
    internalGapCount,
    maxZeroAdvanceRunSec,
  };
}

function fmtNum(v, digits) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : 'n/a';
}

/**
 * Renders a deterministic Markdown document — no wall-clock time, no `git rev-parse HEAD`, calling
 * this twice with the same `rows` produces byte-identical output. `rows` is the assembled evidence
 * per candidate: the `windowEvidence` fields plus `researchSpeed` (nullable reference) and
 * `reachability: { minSec, minWindowSpeed }[]` (one entry per `EVIDENCE_MIN_SEC_GRID` value).
 */
export function renderEvidenceMarkdown(rows) {
  const lines = [];
  lines.push('# Walking-Break Evidence (Phase 34 plan 02, D-12)');
  lines.push('');
  lines.push(
    "Research-proposed walking-break candidates (34-RESEARCH.md § D-12), with evidence computed " +
      "on each candidate's own committed stream by a zero-import evidence generator (its own " +
      // Deliberately spaced, not hyphenated, so this descriptive sentence itself does not contain
      // any of the three forbidden module-name substrings the zero-import guard scans for.
      'source never imports the unreliable segments detector, pace derivation, or pause ' +
      'classification modules). These are PROPOSALS ONLY — ' +
      'the developer confirms at least one via `34-WALKING-BREAK-CONTROL.md` before any plan pins ' +
      "it as a fixture. Research's own figures are quoted below as references to reconcile against, " +
      'never as expected values.'
  );
  lines.push('');

  lines.push('## Candidates');
  lines.push('');
  lines.push(
    '| Candidate | Window (t) | Duration (s) | Metres | Aggregate (m/s) | Rest-of-activity (m/s) | HR range | Internal gaps | Longest zero-advance run (s) |'
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const hrRange = row.hrMin !== null && row.hrMax !== null ? `${row.hrMin}-${row.hrMax}` : 'n/a';
    lines.push(
      `| ${row.id} | t=${row.startSec}-${row.endSec} | ${row.durationSec} | ${fmtNum(row.metres, 1)} | ${fmtNum(row.aggregateSpeed, 3)} | ${fmtNum(row.restOfActivitySpeed, 3)} | ${hrRange} | ${row.internalGapCount} | ${row.maxZeroAdvanceRunSec} |`
    );
  }
  lines.push('');

  lines.push('## Reachability (CAN FAIL / CAN PASS)');
  lines.push('');
  lines.push('| Candidate | minSec | minWindowSpeed (m/s) | Verdict |');
  lines.push('|---|---|---|---|');
  for (const row of rows) {
    for (const r of row.reachability || []) {
      let verdict;
      if (r.minWindowSpeed === null || r.minWindowSpeed === 0) {
        verdict = `UNPASSABLE at minSec=${r.minSec} — the window contains a standstill or is too short for this minSec`;
      } else {
        verdict =
          `CAN FAIL: flagged at any near-zero threshold >= ${fmtNum(r.minWindowSpeed, 3)} m/s. ` +
          `CAN PASS: not flagged at any threshold < ${fmtNum(r.minWindowSpeed, 3)} m/s.`;
      }
      lines.push(`| ${row.id} | ${r.minSec} | ${fmtNum(r.minWindowSpeed, 3)} | ${verdict} |`);
    }
  }
  lines.push('');

  lines.push('## Research reconciliation');
  lines.push('');
  lines.push('| Candidate | Research speed (m/s, reference only) | Measured aggregate speed (m/s) | Difference |');
  lines.push('|---|---|---|---|');
  for (const row of rows) {
    const researchSpeed = typeof row.researchSpeed === 'number' ? row.researchSpeed : null;
    const diff =
      researchSpeed !== null && typeof row.aggregateSpeed === 'number'
        ? (row.aggregateSpeed - researchSpeed).toFixed(3)
        : 'n/a';
    lines.push(
      `| ${row.id} | ${researchSpeed !== null ? researchSpeed.toFixed(3) : 'n/a'} | ${fmtNum(row.aggregateSpeed, 3)} | ${diff} |`
    );
  }
  lines.push('');

  lines.push('## Inputs');
  lines.push('');
  lines.push('Streams read: ' + rows.map((r) => `data/streams/${r.id}.json`).join(', '));
  lines.push('');
  lines.push('Regenerate with: `npm run compute-walking-break-evidence`');
  lines.push('');

  return lines.join('\n');
}

/**
 * Parses `34-WALKING-BREAK-CONTROL.md`'s `CONFIRMED_CONTROL: <id> t=<startSec>-<endSec>` lines.
 * Returns `[]` for text with no such line. Throws a readable error on a malformed
 * `CONFIRMED_CONTROL:` line (fail closed — plan 34-04's calibration anchor check must never
 * silently treat a malformed control as "none confirmed").
 */
export function parseControlFile(text) {
  if (typeof text !== 'string') {
    throw new Error('parseControlFile: text must be a string');
  }
  const results = [];
  const pattern = /^CONFIRMED_CONTROL:\s*(\S+)\s+t=(\d+)-(\d+)\s*$/;
  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('CONFIRMED_CONTROL:')) continue;
    const match = line.match(pattern);
    if (!match) {
      throw new Error(`parseControlFile: malformed CONFIRMED_CONTROL line: ${JSON.stringify(rawLine)}`);
    }
    const [, id, startStr, endStr] = match;
    results.push({ id, startSec: Number(startStr), endSec: Number(endStr) });
  }
  return results;
}

function readStreamDoc(id) {
  const streamPath = join(STREAMS_DIR, `${id}.json`);
  const raw = readFileSync(streamPath, 'utf8');
  return JSON.parse(raw);
}

function buildEvidenceRows(ids) {
  const rows = [];
  for (const candidate of CANDIDATES) {
    if (ids && !ids.includes(candidate.id)) continue;
    const doc = readStreamDoc(candidate.id);
    const evidence = windowEvidence(doc, candidate);
    if (!evidence.ok) {
      throw new Error(`FAILED: could not compute evidence for ${candidate.id}: ${evidence.reason}`);
    }
    const reachability = EVIDENCE_MIN_SEC_GRID.map((minSec) => ({
      minSec,
      minWindowSpeed: minWindowSpeed(doc.t, doc.d, candidate.startSec, candidate.endSec, minSec),
    }));
    const reference = RESEARCH_REFERENCE[candidate.id];
    rows.push({
      ...evidence,
      researchSpeed: reference ? reference.speed : null,
      researchDurationSec: reference ? reference.durationSec : null,
      researchRestSpeed: reference ? reference.restSpeed : null,
      reachability,
    });
  }
  return rows;
}

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx === -1 ? undefined : args[idx + 1];
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--scan')) {
    const id = parseArg(args, '--scan');
    const maxMps = Number(parseArg(args, '--max-mps'));
    const minSec = Number(parseArg(args, '--min-sec'));
    if (!id || !Number.isFinite(maxMps) || !Number.isFinite(minSec)) {
      console.error('Usage: --scan <id> --max-mps <x> --min-sec <y>');
      process.exitCode = 1;
      return;
    }
    let doc;
    try {
      doc = readStreamDoc(id);
    } catch (err) {
      console.error(`FAILED: could not read/parse stream ${id}: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    const windows = localCreepWindows(doc.t, doc.d, maxMps, minSec);
    console.log(JSON.stringify(windows));
    return;
  }

  let rows;
  try {
    rows = buildEvidenceRows();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const markdown = renderEvidenceMarkdown(rows);

  if (args.includes('--write')) {
    writeFileSync(OUTPUT_PATH, markdown);
    console.log(`Wrote ${OUTPUT_PATH}`);
  } else {
    console.log(markdown);
  }
}

// Self-execution guard, mirroring compute-unreliable-segment-recount.mjs: main() runs only under
// direct invocation, so compute-walking-break-evidence.test.mjs can import the pure functions
// above without triggering a real file read/write as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
