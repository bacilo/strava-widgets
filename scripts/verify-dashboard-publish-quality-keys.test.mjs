/**
 * Phase 37.2 (audit W1): the publish gate must check every quality key the
 * emitter writes. Three layers:
 *  1. drift (always runs): the shared lists equal the emitter's runtime output,
 *     in both directions;
 *  2. built-dist anchor (skipIf no dist): real rows/shards carry exactly the
 *     emitted key sets;
 *  3. planted removal (skipIf no dist): deleting any emitted key from a
 *     mkdtemp shadow copy makes the gate exit non-zero naming that key.
 * The key universe is ALWAYS taken from the emitter's runtime output, never
 * from the gate's own list. No test writes into the real dist/widgets.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { QUALITY_SUB_KEYS, PACE_QUALITY_SHARD_KEYS } from './lib/quality-keys.mjs';
import { computePaceQualitySignals, buildPaceQualityShard } from '../src/analytics/pace-quality.js';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const VERIFIER = path.resolve(REPO_ROOT, 'scripts/verify-dashboard-publish.mjs');
const REAL_WIDGETS = path.resolve(REPO_ROOT, 'dist/widgets');
const REAL_INDEX_HTML = path.resolve(REAL_WIDGETS, 'index.html');
const REAL_DATA = path.resolve(REAL_WIDGETS, 'data');
const REAL_DASHBOARD = path.resolve(REAL_DATA, 'dashboard');
const REAL_STATS = path.resolve(REAL_DATA, 'stats');
const REAL_PQ = path.resolve(REAL_STATS, 'pace-quality');

function runVerifier(cwd) {
  try {
    const stdout = execFileSync('node', [VERIFIER], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { status: 0, output: stdout };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    return { status: typeof error.status === 'number' ? error.status : 1, output };
  }
}

function symlinkEntry(realPath, shadowPath) {
  const isDir = statSync(realPath).isDirectory();
  symlinkSync(realPath, shadowPath, isDir ? 'dir' : 'file');
}

function parseTally(output) {
  const match = output.match(/\n(\d+) check\(s\) passed, (\d+) failure\(s\)\./);
  return match ? { checks: Number(match[1]), failures: Number(match[2]) } : null;
}

function diffKeySets(listed, emitted) {
  const l = new Set(listed);
  const e = new Set(emitted);
  return {
    missingFromList: [...e].filter((k) => !l.has(k)).sort(),
    notEmitted: [...l].filter((k) => !e.has(k)).sort(),
  };
}

// ---- emitter fixtures (runtime output is the independent key universe) ----
const METADATA = {
  deviceName: 'x',
  sourceProvider: 'intervals',
  elapsedTimeSec: 300,
  movingTimeSec: 300,
  startLatlng: [],
  endLatlng: [],
};
const T = Array.from({ length: 300 }, (_, i) => i);
const STREAM = { t: T, d: T.map((t) => t * 3) };
const BAD_STREAM = { t: [1], d: [1] };

const computableSignals = computePaceQualitySignals(STREAM, METADATA);
const nullSignals = computePaceQualitySignals(null, METADATA);
const computableShard = buildPaceQualityShard('a1', STREAM, METADATA);
const nullShard = buildPaceQualityShard('a2', null, METADATA);
const badShard = buildPaceQualityShard('a3', BAD_STREAM, METADATA);

const keysOf = (o) => Object.keys(o).sort();
const EMITTED_SIGNAL_KEYS = keysOf(computableSignals);
const EMITTED_SHARD_KEYS = keysOf(computableShard);

describe('quality-keys drift: gate lists vs emitter output', () => {
  it('diffKeySets is order-insensitive and reports both directions sorted', () => {
    expect(diffKeySets(['b', 'a'], ['a', 'b'])).toEqual({ missingFromList: [], notEmitted: [] });
    expect(diffKeySets(['z', 'a'], ['a', 'm', 'b'])).toEqual({
      missingFromList: ['b', 'm'],
      notEmitted: ['z'],
    });
  });

  it('exercises the computable, null-stream and unusable-stream branches', () => {
    expect(computableSignals.notComputableReason).toBeNull();
    expect(typeof nullSignals.notComputableReason).toBe('string');
    expect(nullSignals.notComputableReason.length).toBeGreaterThan(0);
    expect(typeof badShard.notComputableReason).toBe('string');
    expect(badShard.notComputableReason.length).toBeGreaterThan(0);
    expect(typeof nullShard.notComputableReason).toBe('string');
  });

  it('QUALITY_SUB_KEYS equals the signal key set on both branches', () => {
    expect(diffKeySets(QUALITY_SUB_KEYS, keysOf(computableSignals))).toEqual({
      missingFromList: [],
      notEmitted: [],
    });
    expect(diffKeySets(QUALITY_SUB_KEYS, keysOf(nullSignals))).toEqual({
      missingFromList: [],
      notEmitted: [],
    });
  });

  it('PACE_QUALITY_SHARD_KEYS equals the shard key set on all three branches', () => {
    for (const shard of [computableShard, nullShard, badShard]) {
      expect(diffKeySets(PACE_QUALITY_SHARD_KEYS, keysOf(shard))).toEqual({
        missingFromList: [],
        notEmitted: [],
      });
    }
  });

  it('planted drift direction 1: a listed key the emitter does not produce is caught', () => {
    expect(diffKeySets([...QUALITY_SUB_KEYS, 'plantedKey'], EMITTED_SIGNAL_KEYS).notEmitted).toEqual([
      'plantedKey',
    ]);
    expect(
      diffKeySets([...PACE_QUALITY_SHARD_KEYS, 'plantedKey'], EMITTED_SHARD_KEYS).notEmitted
    ).toEqual(['plantedKey']);
  });

  it('planted drift direction 2: an emitted key the list omits is caught', () => {
    const [firstSignal, ...restSignals] = QUALITY_SUB_KEYS;
    expect(diffKeySets(restSignals, EMITTED_SIGNAL_KEYS).missingFromList).toEqual([firstSignal]);
    const [firstShard, ...restShard] = PACE_QUALITY_SHARD_KEYS;
    expect(diffKeySets(restShard, EMITTED_SHARD_KEYS).missingFromList).toEqual([firstShard]);
  });
});

const HAS_DIST = existsSync(REAL_INDEX_HTML);

function readRealIndex() {
  return JSON.parse(readFileSync(path.join(REAL_DASHBOARD, 'index.json'), 'utf8'));
}

// The gate's own sampling formula, derived at runtime (no pinned id).
function sampledShardIds(indexDoc) {
  const ids = indexDoc.activities.map((row) => row.id);
  const n = ids.length;
  return [...new Set([ids[Math.min(1, n - 1)], ids[Math.floor(n / 3)], ids[Math.max(0, n - 2)]])];
}

describe.skipIf(!HAS_DIST)('quality-keys drift: gate lists vs built dist', () => {
  it('every index row quality key set equals the emitted signal key set', () => {
    const indexDoc = readRealIndex();
    for (const row of indexDoc.activities) {
      const diff = diffKeySets(keysOf(row.quality ?? {}), EMITTED_SIGNAL_KEYS);
      if (diff.missingFromList.length || diff.notEmitted.length) {
        throw new Error(`row ${row.id} quality drift: ${JSON.stringify(diff)}`);
      }
    }
    expect(indexDoc.activities.length).toBeGreaterThan(0);
  });

  it('each gate-sampled shard top-level and signals key sets equal the emitted sets', () => {
    const ids = sampledShardIds(readRealIndex());
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const shard = JSON.parse(readFileSync(path.join(REAL_PQ, `${id}.json`), 'utf8'));
      expect(diffKeySets(keysOf(shard), EMITTED_SHARD_KEYS), `shard ${id} top-level`).toEqual({
        missingFromList: [],
        notEmitted: [],
      });
      expect(diffKeySets(keysOf(shard.signals), EMITTED_SIGNAL_KEYS), `shard ${id} signals`).toEqual({
        missingFromList: [],
        notEmitted: [],
      });
    }
  });
});

describe.skipIf(!HAS_DIST)('quality-keys planted removal', () => {
  let tmpRoot;
  let shadowIndexPath;
  let shadowShardPath;
  let cleanIndex;
  let cleanShard;
  let rowId;
  let shardId;

  beforeAll(() => {
    cleanIndex = readRealIndex();
    shardId = sampledShardIds(cleanIndex)[0];
    rowId = cleanIndex.activities[0].id;
    cleanShard = JSON.parse(readFileSync(path.join(REAL_PQ, `${shardId}.json`), 'utf8'));

    tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'verify-dashboard-quality-keys-'));
    const shadowWidgets = path.join(tmpRoot, 'dist', 'widgets');
    mkdirSync(shadowWidgets, { recursive: true });
    for (const e of readdirSync(REAL_WIDGETS)) {
      if (e === 'data') continue;
      symlinkEntry(path.join(REAL_WIDGETS, e), path.join(shadowWidgets, e));
    }
    const shadowData = path.join(shadowWidgets, 'data');
    mkdirSync(shadowData);
    for (const e of readdirSync(REAL_DATA)) {
      if (e === 'dashboard' || e === 'stats') continue;
      symlinkEntry(path.join(REAL_DATA, e), path.join(shadowData, e));
    }
    const shadowDash = path.join(shadowData, 'dashboard');
    mkdirSync(shadowDash);
    for (const e of readdirSync(REAL_DASHBOARD)) {
      if (e === 'index.json') continue;
      symlinkEntry(path.join(REAL_DASHBOARD, e), path.join(shadowDash, e));
    }
    shadowIndexPath = path.join(shadowDash, 'index.json');
    writeFileSync(shadowIndexPath, JSON.stringify(cleanIndex), 'utf8');

    const shadowStats = path.join(shadowData, 'stats');
    mkdirSync(shadowStats);
    for (const e of readdirSync(REAL_STATS)) {
      if (e === 'pace-quality') continue;
      symlinkEntry(path.join(REAL_STATS, e), path.join(shadowStats, e));
    }
    const shadowPq = path.join(shadowStats, 'pace-quality');
    mkdirSync(shadowPq);
    for (const e of readdirSync(REAL_PQ)) {
      if (e === `${shardId}.json`) continue;
      symlinkEntry(path.join(REAL_PQ, e), path.join(shadowPq, e));
    }
    shadowShardPath = path.join(shadowPq, `${shardId}.json`);
    writeFileSync(shadowShardPath, JSON.stringify(cleanShard), 'utf8');
  });

  afterAll(() => {
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  });

  function withMutation(targetPath, cleanObj, mutate, assertPlanted) {
    const mutated = structuredClone(cleanObj);
    mutate(mutated);
    assertPlanted(cleanObj, mutated);
    writeFileSync(targetPath, JSON.stringify(mutated), 'utf8');
    try {
      return runVerifier(tmpRoot);
    } finally {
      writeFileSync(targetPath, JSON.stringify(cleanObj), 'utf8');
    }
  }

  it('clean shadow tree exits 0', () => {
    const { status, output } = runVerifier(tmpRoot);
    expect(status, output).toBe(0);
    expect(parseTally(output)?.failures).toBe(0);
  });

  it.each(EMITTED_SIGNAL_KEYS)('row quality without %s fails and names it', (key) => {
    const { status, output } = withMutation(
      shadowIndexPath,
      cleanIndex,
      (m) => {
        delete m.activities[0].quality[key];
      },
      (c, m) => {
        expect(key in c.activities[0].quality).toBe(true);
        expect(key in m.activities[0].quality).toBe(false);
      }
    );
    expect(status, output).not.toBe(0);
    expect(output).toContain(`activity ${rowId} "quality" is missing sub-key "${key}"`);
  });

  it.each(EMITTED_SIGNAL_KEYS)('shard signals without %s fails and names it', (key) => {
    const { status, output } = withMutation(
      shadowShardPath,
      cleanShard,
      (m) => {
        delete m.signals[key];
      },
      (c, m) => {
        expect(key in c.signals).toBe(true);
        expect(key in m.signals).toBe(false);
      }
    );
    expect(status, output).not.toBe(0);
    expect(output).toContain(
      `/data/stats/pace-quality/${shardId}.json "signals" is missing sub-key "${key}"`
    );
  });

  it.each(EMITTED_SHARD_KEYS)('shard top-level without %s fails and names it', (key) => {
    const { status, output } = withMutation(
      shadowShardPath,
      cleanShard,
      (m) => {
        delete m[key];
      },
      (c, m) => {
        expect(key in c).toBe(true);
        expect(key in m).toBe(false);
      }
    );
    expect(status, output).not.toBe(0);
    expect(output).toContain(
      `/data/stats/pace-quality/${shardId}.json is missing top-level key "${key}"`
    );
  });
});
