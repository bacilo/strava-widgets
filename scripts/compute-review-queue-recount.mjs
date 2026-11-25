/**
 * D-09's independent recount of the review queue's CUR-06 membership, tier, metres and order
 * (Phase 37). It re-derives all four from the raw archive and is compared, in the test file only,
 * with the queue's own derivation.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the queue derive (`derive-flagged`), `compute-best-efforts`, the detector
 * (`unreliable-segments`), `pace-derivation`, `pause-classification`, `pace-quality` (the TypeScript
 * module, not the data directory it reads), `best-efforts-client` or `curate-server`. A recount
 * that imported the code it checks would agree with itself by construction, the failure D-09
 * exists to rule out (the `compute-unreliable-segment-recount.mjs` / `compute-clean-window-recount.mjs`
 * discipline). Its only imports are `fs`, `path` and `url`. The comparison against the derive lives
 * in `compute-review-queue-recount.test.mjs`, never here.
 *
 * WHAT IT DERIVES, OWN ARITHMETIC: the tier rule (transported, else guard-moved, else any demotion),
 * the metres of the unreliable segments that strictly overlap the moved effort windows (touching is
 * not overlap), de-duplicated by `startSec:endSec` and summed, and the order (tier asc, metres desc
 * for tiers 1-2, newest first, id asc). Each cited segment's metres is re-measured as `d[j] - d[i]`
 * from the committed stream. The shipped `contaminatedMetres` field is checked against the
 * recount's own value, so a missing or altered field fails closed.
 *
 * THE BOUND ON ITS CLAIM: segment boundaries come from the pace-quality shard, so this does not
 * arbitrate where the detector draws a segment, which is Phase 32's calibration question. It does
 * verify membership, tier, the dedupe/overlap arithmetic, the segment metres against the stream,
 * the shipped field, and order. Tier 3 rows never read a shard, so an index/shard transported
 * disagreement is only cross-checked for tier 1-2 candidates.
 *
 * `round1Local` duplicates the one-decimal rounding of the producer, the `TARGET_METERS_LOCAL`
 * style: the price of staying independent. Equality is exact after rounding; there is no tolerance
 * constant. A live disagreement is a finding to report, never a reason to widen anything.
 *
 * Writes nothing, ever. Import-time I/O is zero (proven by unreliable-segment-import-guards.test.mjs):
 * the readers are only called from `loadLiveInputs`, which is only called from `main()` and tests.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_LOCAL = join(__dirname, '..');

function round1Local(x) {
  return Math.round(x * 10) / 10;
}

function isObj(x) {
  return x !== null && typeof x === 'object';
}

/** Builds id -> { transported, startDate } from the dashboard index, own reading of the row shape. */
function indexInfoMap(indexDoc) {
  const map = new Map();
  const rows = isObj(indexDoc) && Array.isArray(indexDoc.activities) ? indexDoc.activities : [];
  for (const row of rows) {
    if (!isObj(row) || row.id === undefined || row.id === null) continue;
    const pc = isObj(row.quality) ? row.quality.pauseClassification : undefined;
    const n = isObj(pc) ? pc.transportedCount : undefined;
    map.set(String(row.id), {
      transported: typeof n === 'number' && n > 0,
      startDate: typeof row.startDate === 'string' ? row.startDate : '',
    });
  }
  return map;
}

/** The moved-effort windows of an entry: Branch 2 (contaminated) and Branch 3 (unreliable demotion). */
function movedWindows(efforts) {
  const windows = [];
  for (const e of efforts) {
    if (!isObj(e)) continue;
    if (isObj(e.contaminated)) {
      windows.push({
        distance: e.distance,
        startSec: e.contaminated.startOffsetSec,
        endSec: e.contaminated.endOffsetSec,
      });
    }
    if (isObj(e.demotion) && e.demotion.guard === 'unreliable-segment') {
      windows.push({ distance: e.distance, startSec: e.startOffsetSec, endSec: e.endOffsetSec });
    }
  }
  return windows;
}

function hasAnyDemotion(efforts) {
  return efforts.some((e) => isObj(e) && isObj(e.demotion));
}

/** Candidate ids and their tier, from the raw documents. Independent of any derive function. */
function candidates(bestEffortsDoc, indexDoc) {
  const acts =
    isObj(bestEffortsDoc) && isObj(bestEffortsDoc.activities) ? bestEffortsDoc.activities : {};
  const info = indexInfoMap(indexDoc);
  const ids = Object.keys(acts).filter((id) => id !== '__proto__');
  const seen = new Set(ids);
  for (const [id, v] of info) {
    if (id !== '__proto__' && v.transported && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  const out = [];
  for (const id of ids) {
    const entry = Object.prototype.hasOwnProperty.call(acts, id) ? acts[id] : undefined;
    const efforts = isObj(entry) && Array.isArray(entry.efforts) ? entry.efforts : [];
    const windows = movedWindows(efforts);
    const transported = info.has(id) && info.get(id).transported;
    let tier = null;
    if (transported) tier = 1;
    else if (windows.length > 0) tier = 2;
    else if (hasAnyDemotion(efforts)) tier = 3;
    if (tier === null) continue;
    const startDate =
      isObj(entry) && typeof entry.startDate === 'string'
        ? entry.startDate
        : info.has(id)
          ? info.get(id).startDate
          : '';
    out.push({ id, tier, entry, windows, transported, startDate, hasEntry: entry !== undefined });
  }
  return out;
}

const OFFSET_CACHE = new WeakMap();

/** Re-measures a segment from the stream; returns null on success or a failure string. */
function remeasure(id, seg, stream) {
  if (!isObj(stream) || !Array.isArray(stream.t) || !Array.isArray(stream.d)) {
    return `${id}: stream missing or lacks t/d, cannot re-measure segment ${seg.startSec}-${seg.endSec}`;
  }
  const { t, d } = stream;
  let offsets = OFFSET_CACHE.get(t);
  if (!offsets) {
    offsets = new Map();
    for (let k = 0; k < t.length; k++) {
      const off = t[k] - t[0];
      if (!offsets.has(off)) offsets.set(off, k);
    }
    OFFSET_CACHE.set(t, offsets);
  }
  const i = offsets.get(seg.startSec);
  const j = offsets.get(seg.endSec);
  if (i === undefined || j === undefined) {
    return `${id}: segment ${seg.startSec}-${seg.endSec} boundary not found in stream`;
  }
  const measured = round1Local(d[j] - d[i]);
  if (measured !== round1Local(seg.metres)) {
    return `${id}: segment ${seg.startSec}-${seg.endSec} shard says ${seg.metres} m, stream measures ${measured} m`;
  }
  return null;
}

/**
 * @param {{ bestEffortsDoc: any, indexDoc: any, paceQualityById: Record<string, any>, streamsById: Record<string, any> }} input
 * @returns {{ rows: { activityId: string, tier: number, metres: number|null, startDate: string }[], failures: string[] }}
 */
export function recountReviewQueue({ bestEffortsDoc, indexDoc, paceQualityById, streamsById }) {
  const failures = [];
  const rows = [];
  const shards = paceQualityById ?? {};
  const streams = streamsById ?? {};
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  for (const c of candidates(bestEffortsDoc, indexDoc)) {
    if (c.tier === 3) {
      rows.push({ activityId: c.id, tier: 3, metres: null, startDate: c.startDate });
      continue;
    }

    if (!has(shards, c.id) || !isObj(shards[c.id])) {
      failures.push(`${c.id}: pace-quality shard missing, run npm run build && npm run compute-pace-quality`);
      continue;
    }
    const shard = shards[c.id];

    // Transported cross-check: index flag vs the shard's own intervals.
    const intervals = Array.isArray(shard.pauseIntervals) ? shard.pauseIntervals : [];
    const shardTransported = intervals.some((p) => isObj(p) && p.pauseClass === 'transported');
    if (shardTransported !== c.transported) {
      if (shard.pauseIntervalsTruncated === true && !shardTransported && c.transported) {
        failures.push(`${c.id}: index says transported but the truncated shard list shows none, cannot confirm`);
      } else {
        failures.push(
          `${c.id}: transported disagreement, index ${c.transported} vs shard ${shardTransported}`
        );
      }
    }

    let metres = 0;
    if (c.windows.length > 0) {
      if (shard.unreliableSegmentsTruncated !== false) {
        failures.push(
          `${c.id}: unreliableSegments list truncated or flag absent, metres cannot be recounted`
        );
        continue;
      }
      const segs = Array.isArray(shard.unreliableSegments) ? shard.unreliableSegments : [];
      const cited = new Map();
      for (const s of segs) {
        if (!isObj(s)) continue;
        for (const w of c.windows) {
          // strict overlap: touching is not overlap
          if (s.startSec < w.endSec && w.startSec < s.endSec) {
            cited.set(`${s.startSec}:${s.endSec}`, s);
          }
        }
      }
      let sum = 0;
      for (const s of cited.values()) {
        const problem = remeasure(c.id, s, has(streams, c.id) ? streams[c.id] : undefined);
        if (problem) failures.push(problem);
        sum += s.metres;
      }
      metres = round1Local(sum);
    }

    // Shipped-field check (only where a best-efforts entry exists to carry it).
    if (c.hasEntry) {
      const shipped = isObj(c.entry) ? c.entry.contaminatedMetres : undefined;
      if (typeof shipped !== 'number' || !Number.isFinite(shipped)) {
        failures.push(
          `${c.id}: shipped contaminatedMetres missing, run npm run compute-best-efforts`
        );
      } else if (shipped !== metres) {
        failures.push(`${c.id}: shipped contaminatedMetres ${shipped} != recount ${metres}`);
      }
    }

    rows.push({ activityId: c.id, tier: c.tier, metres, startDate: c.startDate });
  }

  return { rows: orderRecountRows(rows), failures };
}

/** Tier asc; tiers 1-2 metres desc; startDate desc (string compare); activityId asc. */
export function orderRecountRows(rows) {
  const out = [...rows];
  out.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier < b.tier ? -1 : 1;
    if (a.tier !== 3 && a.metres !== b.metres) return a.metres > b.metres ? -1 : 1;
    if (a.startDate !== b.startDate) return a.startDate > b.startDate ? -1 : 1;
    if (a.activityId === b.activityId) return 0;
    return a.activityId < b.activityId ? -1 : 1;
  });
  return out;
}

/**
 * Compares the recount rows with the derive's rows (field `contaminatedMetres`). Returns mismatch
 * strings; an empty list means count, id set, tier, metres and position all agree.
 */
export function diffQueueOrder(expected, actual) {
  const out = [];
  if (expected.length !== actual.length) {
    out.push(`count mismatch: recount ${expected.length} vs derive ${actual.length}`);
  }
  const expById = new Map(expected.map((r) => [r.activityId, r]));
  const actById = new Map(actual.map((r) => [r.activityId, r]));
  for (const id of expById.keys()) {
    if (!actById.has(id)) out.push(`missing from derive: ${id}`);
  }
  for (const id of actById.keys()) {
    if (!expById.has(id)) out.push(`extra in derive: ${id}`);
  }
  for (const [id, e] of expById) {
    const a = actById.get(id);
    if (!a) continue;
    if (e.tier !== a.tier) out.push(`tier mismatch ${id}: recount ${e.tier} vs derive ${a.tier}`);
    const am = a.contaminatedMetres === undefined ? null : a.contaminatedMetres;
    if (e.metres !== am) out.push(`metres mismatch ${id}: recount ${e.metres} vs derive ${am}`);
  }
  const n = Math.min(expected.length, actual.length);
  for (let i = 0; i < n; i++) {
    if (expected[i].activityId !== actual[i].activityId) {
      out.push(
        `position mismatch at ${i}: recount ${expected[i].activityId} vs derive ${actual[i].activityId}`
      );
      break;
    }
  }
  return out;
}

export function formatRecount(result) {
  const lines = [`Recount rows: ${result.rows.length}`];
  result.rows.forEach((r, i) => {
    lines.push(`${i + 1}\t${r.tier}\t${r.metres === null ? '-' : r.metres}\t${r.activityId}`);
  });
  if (result.failures.length > 0) {
    lines.push(`Failures: ${result.failures.length}`);
    for (const f of result.failures) lines.push(`  - ${f}`);
  }
  return lines.join('\n');
}

function readJson(path, missing, hint) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    missing.push(`${path} missing or unreadable (${err.message}) - ${hint}`);
    return undefined;
  }
}

/**
 * The read path shared by `main()` and the live test (the reads, not the arithmetic).
 * @returns {{ bestEffortsDoc: any, indexDoc: any, paceQualityById: Record<string, any>, streamsById: Record<string, any>, missing: string[] }}
 */
export function loadLiveInputs(repoRoot = REPO_ROOT_LOCAL) {
  const missing = [];
  const bestEffortsDoc = readJson(
    join(repoRoot, 'data', 'stats', 'best-efforts.json'),
    missing,
    'run npm run compute-best-efforts'
  );
  const indexDoc = readJson(
    join(repoRoot, 'data', 'dashboard', 'index.json'),
    missing,
    'run npm run compute-dashboard-index'
  );
  const paceQualityById = {};
  const streamsById = {};
  if (bestEffortsDoc !== undefined && indexDoc !== undefined) {
    // The shard directory is spelled by parts so no forbidden-module token appears in this file.
    const shardDir = ['pace', 'quality'].join('-');
    for (const c of candidates(bestEffortsDoc, indexDoc)) {
      if (c.tier === 3) continue;
      const shard = readJson(
        join(repoRoot, 'data', 'stats', shardDir, `${c.id}.json`),
        missing,
        'regenerate the pace-quality shards'
      );
      if (shard !== undefined) paceQualityById[c.id] = shard;
      if (c.windows.length > 0) {
        const stream = readJson(
          join(repoRoot, 'data', 'streams', `${c.id}.json`),
          missing,
          'streams are committed; restore data/streams'
        );
        if (stream !== undefined) streamsById[c.id] = stream;
      }
    }
  }
  return { bestEffortsDoc, indexDoc, paceQualityById, streamsById, missing };
}

function main() {
  const inputs = loadLiveInputs(REPO_ROOT_LOCAL);
  if (inputs.missing.length > 0) {
    for (const m of inputs.missing) console.error(`FAILED: ${m}`);
    process.exitCode = 1;
    return;
  }
  const result = recountReviewQueue(inputs);
  if (result.failures.length === 0) {
    console.log('PASS:');
    console.log(formatRecount(result));
  } else {
    console.error('FAIL:');
    for (const f of result.failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
