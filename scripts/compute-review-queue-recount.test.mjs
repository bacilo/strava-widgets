/**
 * Phase 37 plan 05: tests for the D-09 independent review-queue recount.
 *
 * Every unit expectation comes from the hand-built fixture R below, with its derivation in a
 * comment. No CONTEXT.md probe figure is used and the live block pins no count: it compares two
 * implementations. The script itself imports only fs/path/url; this TEST may import the derive.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  diffQueueOrder,
  formatRecount,
  loadLiveInputs,
  orderRecountRows,
  recountReviewQueue,
} from './compute-review-queue-recount.mjs';
import { deriveFlaggedActivities } from './curate-queue/derive-flagged.mjs';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SCRIPT_PATH = path.resolve(REPO_ROOT, 'scripts/compute-review-queue-recount.mjs');

/**
 * Fixture R. Streams: t = 0..500, d = 3 * t (3 m/s), so a segment a..b measures 3 * (b - a) m.
 *
 *  RG (guard-moved, Branch 2): 400m contaminated window 100-230, 1k contaminated window 50-400.
 *     S1 120-140 = 60 m (inside both windows, counted ONCE), S2 300-320 = 60 m (1k only),
 *     S3 400-410 = 30 m (touches the 1k window end at 400: strict overlap excludes it).
 *     Recount metres = 60 + 60 = 120. Without dedupe it would be 180.
 *  RB (Branch 3): 400m demotion unreliable-segment, effort window 10-150, S 20-40 = 60 m.
 *  RT (transported): index transportedCount 1, shard has a transported interval, no moved effort.
 *     Tier 1, metres 0.
 *  RC (ceiling demotion only): tier 3, metres null.
 *  Order: tier 1 RT; tier 2 RG (120) before RB (60); tier 3 RC  =>  [RT, RG, RB, RC].
 */
function buildR() {
  const mkStream = () => {
    const t = [];
    const d = [];
    for (let k = 0; k <= 500; k++) {
      t.push(1000 + k);
      d.push(3 * k);
    }
    return { schemaVersion: 1, t, d };
  };
  const contaminated = (s, e) => ({
    guard: 'unreliable-segment',
    reason: 'r',
    durationSec: 10,
    paceSecPerKm: 300,
    startOffsetSec: s,
    endOffsetSec: e,
  });
  const shard = (segments, intervals = []) => ({
    unreliableSegments: segments,
    unreliableSegmentsTruncated: false,
    pauseIntervals: intervals,
    pauseIntervalsTruncated: false,
  });
  const seg = (startSec, endSec, metres) => ({
    startSec,
    endSec,
    metres,
    excessMetres: 1,
    seconds: endSec - startSec,
    mechanism: 'm',
  });
  const bestEffortsDoc = {
    schemaVersion: 1,
    activities: {
      RG: {
        activityId: 'RG',
        startDate: '2026-01-03T00:00:00Z',
        efforts: [
          { distance: 400, startOffsetSec: 100, endOffsetSec: 230, demotion: null, contaminated: contaminated(100, 230) },
          { distance: 1000, startOffsetSec: 50, endOffsetSec: 400, demotion: null, contaminated: contaminated(50, 400) },
        ],
        contaminatedMetres: 120,
      },
      RB: {
        activityId: 'RB',
        startDate: '2026-01-02T00:00:00Z',
        efforts: [
          {
            distance: 400,
            startOffsetSec: 10,
            endOffsetSec: 150,
            demotion: { guard: 'unreliable-segment', reason: 'r' },
            contaminated: null,
          },
        ],
        contaminatedMetres: 60,
      },
      RT: { activityId: 'RT', startDate: '2026-01-04T00:00:00Z', efforts: [], contaminatedMetres: 0 },
      RC: {
        activityId: 'RC',
        startDate: '2026-01-01T00:00:00Z',
        efforts: [
          { distance: 400, startOffsetSec: 1, endOffsetSec: 2, demotion: { guard: 'ceiling', reason: 'c' }, contaminated: null },
        ],
        contaminatedMetres: 0,
      },
    },
  };
  const pc = (n) => ({ pauseClassification: { transportedCount: n } });
  const indexDoc = {
    activities: [
      { id: 'RT', startDate: '2026-01-04T00:00:00Z', name: 'T', quality: pc(1) },
      { id: 'RG', startDate: '2026-01-03T00:00:00Z', name: 'G', quality: pc(0) },
      { id: 'RB', startDate: '2026-01-02T00:00:00Z', name: 'B', quality: pc(0) },
      { id: 'RC', startDate: '2026-01-01T00:00:00Z', name: 'C', quality: pc(0) },
    ],
  };
  return {
    bestEffortsDoc,
    indexDoc,
    paceQualityById: {
      RG: shard([seg(120, 140, 60), seg(300, 320, 60), seg(400, 410, 30)]),
      RB: shard([seg(20, 40, 60)]),
      RT: shard([], [{ source: 'x', pauseClass: 'transported', startSec: 1, endSec: 9, seconds: 8, metres: 0, startMetres: 0 }]),
    },
    streamsById: { RG: mkStream(), RB: mkStream() },
  };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const deriveRows = (R) => deriveFlaggedActivities(R.bestEffortsDoc, undefined, R.indexDoc);

describe('recountReviewQueue on fixture R', () => {
  it('yields no failures and the hand-derived order, tiers and metres', () => {
    const R = buildR();
    const out = recountReviewQueue(R);
    expect(out.failures).toEqual([]);
    expect(out.rows.map((r) => r.activityId)).toEqual(['RT', 'RG', 'RB', 'RC']);
    expect(out.rows.map((r) => r.tier)).toEqual([1, 2, 2, 3]);
    expect(out.rows.map((r) => r.metres)).toEqual([0, 120, 60, null]);
  });

  it('agrees with the real derive (diff is empty)', () => {
    const R = buildR();
    expect(diffQueueOrder(recountReviewQueue(R).rows, deriveRows(R))).toEqual([]);
  });

  it('a transported id with no best-efforts entry is still tier 1, date from the index', () => {
    const R = buildR();
    delete R.bestEffortsDoc.activities.RT;
    const out = recountReviewQueue(R);
    expect(out.failures).toEqual([]);
    const rt = out.rows.find((r) => r.activityId === 'RT');
    expect(rt).toEqual({ activityId: 'RT', tier: 1, metres: 0, startDate: '2026-01-04T00:00:00Z' });
  });

  it('formatRecount prints the count, ordered lines and failures', () => {
    const text = formatRecount(recountReviewQueue(buildR()));
    expect(text).toContain('Recount rows: 4');
    expect(text.split('\n')[1]).toBe('1\t1\t0\tRT');
    expect(text).toContain('4\t3\t-\tRC');
  });
});

describe('orderRecountRows tie-breaking (hand-derived)', () => {
  it('metres desc, then newer startDate, then id asc; tier 3 ignores metres', () => {
    const rows = [
      { activityId: 'b', tier: 2, metres: 10, startDate: '2026-01-01' },
      { activityId: 'a', tier: 2, metres: 10, startDate: '2026-01-01' },
      { activityId: 'c', tier: 2, metres: 10, startDate: '2026-02-01' },
      { activityId: 'd', tier: 2, metres: 11, startDate: '2025-01-01' },
      { activityId: 'z', tier: 3, metres: null, startDate: '2026-03-01' },
      { activityId: 'y', tier: 3, metres: null, startDate: '2026-04-01' },
    ];
    // tier 2: d (11 m) first; then 10 m: c (newest), then a before b (id asc); tier 3: y newer than z.
    expect(orderRecountRows(rows).map((r) => r.activityId)).toEqual(['d', 'c', 'a', 'b', 'y', 'z']);
  });
});

describe('MUTATION PROOFS: diffQueueOrder is non-empty against each broken derive (D-09, D-19)', () => {
  it('(a) swapped tiers of RG and RT', () => {
    const R = buildR();
    const good = deriveRows(R);
    const bad = clone(good);
    const g = bad.find((r) => r.activityId === 'RG');
    const t = bad.find((r) => r.activityId === 'RT');
    [g.tier, t.tier] = [t.tier, g.tier];
    expect(bad).not.toEqual(good);
    const diff = diffQueueOrder(recountReviewQueue(R).rows, bad);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.join('\n')).toContain('tier mismatch');
  });

  it('(b) no-dedupe metres 180 on RG', () => {
    const R = buildR();
    const good = deriveRows(R);
    const bad = clone(good);
    bad.find((r) => r.activityId === 'RG').contaminatedMetres = 180;
    expect(bad).not.toEqual(good);
    const diff = diffQueueOrder(recountReviewQueue(R).rows, bad);
    expect(diff.join('\n')).toContain('metres mismatch RG');
  });

  it('(c) swapped positions of RG and RB', () => {
    const R = buildR();
    const good = deriveRows(R);
    const bad = clone(good);
    const i = bad.findIndex((r) => r.activityId === 'RG');
    const j = bad.findIndex((r) => r.activityId === 'RB');
    [bad[i], bad[j]] = [bad[j], bad[i]];
    expect(bad).not.toEqual(good);
    const diff = diffQueueOrder(recountReviewQueue(R).rows, bad);
    expect(diff.join('\n')).toContain('position mismatch');
  });

  it('(d) dropped transported row RT', () => {
    const R = buildR();
    const good = deriveRows(R);
    const bad = good.filter((r) => r.activityId !== 'RT');
    expect(bad).not.toEqual(good);
    const diff = diffQueueOrder(recountReviewQueue(R).rows, bad).join('\n');
    expect(diff).toContain('count mismatch');
    expect(diff).toContain('missing from derive: RT');
  });

  it('(e) altered shipped contaminatedMetres is a recount failure naming RG; a deleted one says missing', () => {
    const R = buildR();
    const clean = clone(R.bestEffortsDoc);
    R.bestEffortsDoc.activities.RG.contaminatedMetres = 999;
    expect(R.bestEffortsDoc).not.toEqual(clean);
    const f1 = recountReviewQueue(R).failures.join('\n');
    expect(f1).toContain('RG');
    expect(f1).toContain('999');

    const R2 = buildR();
    delete R2.bestEffortsDoc.activities.RG.contaminatedMetres;
    const f2 = recountReviewQueue(R2).failures.join('\n');
    expect(f2).toContain('missing');
    expect(f2).toContain('npm run compute-best-efforts');
  });

  it('(f) control: every mutation above is distinguishable from the clean diff, which is empty', () => {
    const R = buildR();
    expect(diffQueueOrder(recountReviewQueue(R).rows, deriveRows(R))).toEqual([]);
  });
});

describe('fail-closed inputs', () => {
  it('a truncated unreliableSegments list for a guard-moved activity fails', () => {
    const R = buildR();
    const clean = clone(R.paceQualityById.RG);
    R.paceQualityById.RG.unreliableSegmentsTruncated = true;
    expect(R.paceQualityById.RG).not.toEqual(clean);
    expect(recountReviewQueue(R).failures.join('\n')).toContain('RG: unreliableSegments list truncated');
  });

  it('the index says transported but the shard has no transported interval', () => {
    const R = buildR();
    R.paceQualityById.RT.pauseIntervals = [];
    const out = recountReviewQueue(R);
    expect(out.failures.join('\n')).toContain('RT: transported disagreement');
  });

  it('the shard says transported but the index says 0', () => {
    const R = buildR();
    R.indexDoc.activities.find((a) => a.id === 'RB').quality.pauseClassification.transportedCount = 0;
    R.paceQualityById.RB.pauseIntervals = [{ pauseClass: 'transported' }];
    expect(recountReviewQueue(R).failures.join('\n')).toContain('RB: transported disagreement');
  });

  it('a stream whose distance makes S1 measure 61 m fails', () => {
    const R = buildR();
    const clean = clone(R.streamsById.RG.d);
    R.streamsById.RG.d[140] += 1; // offset 140 is index 140 (t starts at 1000, offset = k)
    expect(R.streamsById.RG.d).not.toEqual(clean);
    const f = recountReviewQueue(R).failures.join('\n');
    expect(f).toContain('RG: segment 120-140');
    expect(f).toContain('61');
  });

  it('a missing shard or stream is a failure, never a silent zero', () => {
    const R = buildR();
    delete R.paceQualityById.RG;
    expect(recountReviewQueue(R).failures.join('\n')).toContain('RG: pace-quality shard missing');
    const R2 = buildR();
    delete R2.streamsById.RB;
    expect(recountReviewQueue(R2).failures.join('\n')).toContain('RB: stream missing');
  });

  it('strict overlap: a segment touching a window end contributes nothing (S3 excluded)', () => {
    const R = buildR();
    // shift S3 to genuinely overlap the 1k window (390-410, 60 m): metres must now be 180.
    R.paceQualityById.RG.unreliableSegments[2] = {
      startSec: 390,
      endSec: 410,
      metres: 60,
      excessMetres: 1,
      seconds: 20,
      mechanism: 'm',
    };
    R.bestEffortsDoc.activities.RG.contaminatedMetres = 180;
    const out = recountReviewQueue(R);
    expect(out.failures).toEqual([]);
    expect(out.rows.find((r) => r.activityId === 'RG').metres).toBe(180);
  });
});

// ---------------------------------------------------------------------------------------------
// Zero-import scan. The script legitimately NAMES some forbidden modules inside error-message and
// path string literals (e.g. "run npm run compute-best-efforts"), so the scan inspects module
// SPECIFIERS (from/require/import()), after stripping comments, not every byte of the file.
// ---------------------------------------------------------------------------------------------

const FORBIDDEN = [
  'derive-flagged',
  'compute-best-efforts',
  'unreliable-segments',
  'pace-derivation',
  'pause-classification',
  'pace-quality',
  'best-efforts-client',
  'curate-server',
];

function stripComments(source) {
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.replace(/(?<!:)\/\/.*$/gm, '');
}

function specifiers(strippedSource) {
  const out = [];
  for (const m of strippedSource.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of strippedSource.matchAll(/\b(?:require|import)\s*\(\s*['"`]([^'"`]+)['"`]/g)) out.push(m[1]);
  for (const m of strippedSource.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) out.push(m[1]);
  return out;
}

describe('zero-import scan, watched RED before trusted', () => {
  it('the stripper removes comment-only mentions of every forbidden module (planted fixture)', () => {
    const fixture = [
      'const ok = 1;',
      `// mentions ${FORBIDDEN.join(', ')}`,
      `/* also ${FORBIDDEN.join(', ')} */`,
    ].join('\n');
    const stripped = stripComments(fixture);
    for (const f of FORBIDDEN) {
      expect(fixture).toContain(f);
      expect(stripped).not.toContain(f);
    }
  });

  it('a planted forbidden import IS reported by the specifier scan, for every forbidden name', () => {
    for (const f of FORBIDDEN) {
      const planted = `import { x } from '../dist/${f}.js';\nconst y = await import('./${f}.mjs');`;
      const hits = specifiers(stripComments(planted)).filter((s) => s.includes(f));
      expect(hits.length).toBe(2);
    }
  });

  it('the real source has no forbidden specifier and imports exactly fs, path, url', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);
    // the header docblock does name the forbidden modules, so the stripper is load-bearing here
    for (const f of FORBIDDEN) expect(raw).toContain(f);
    const specs = specifiers(stripped);
    for (const s of specs) {
      for (const f of FORBIDDEN) expect(s).not.toContain(f);
    }
    expect([...new Set(specs)].sort()).toEqual(['fs', 'path', 'url']);
    expect(stripped).not.toMatch(/\brequire\s*\(/);
    expect(stripped).not.toMatch(/\bimport\s*\(/);
  });
});

// ---------------------------------------------------------------------------------------------
// Live archive: two implementations compared, no count pinned.
// ---------------------------------------------------------------------------------------------

const LIVE_OK =
  existsSync(path.resolve(REPO_ROOT, 'data/stats/best-efforts.json')) &&
  existsSync(path.resolve(REPO_ROOT, 'data/dashboard/index.json')) &&
  existsSync(path.resolve(REPO_ROOT, 'data/stats/pace-quality'));

describe.skipIf(!LIVE_OK)('live archive: derive vs recount', () => {
  it('recount has no failures, agrees with the derive on count, ids, tier, metres and order, and can disagree', () => {
    const inputs = loadLiveInputs(REPO_ROOT);
    expect(inputs.missing).toEqual([]);
    const recount = recountReviewQueue(inputs);
    expect(recount.failures).toEqual([]);

    const exclPath = path.resolve(REPO_ROOT, 'data/best-effort-exclusions.json');
    const exclusions = existsSync(exclPath) ? JSON.parse(readFileSync(exclPath, 'utf8')) : undefined;
    const rows = deriveFlaggedActivities(inputs.bestEffortsDoc, exclusions, inputs.indexDoc);
    expect(diffQueueOrder(recount.rows, rows)).toEqual([]);

    const hist = {};
    for (const r of recount.rows) hist[r.tier] = (hist[r.tier] ?? 0) + 1;
    console.log(`live recount rows=${recount.rows.length} tiers=${JSON.stringify(hist)}`);

    // Reachability the other way: an in-memory swap of two tier-2 rows must be reported.
    const idx = rows.map((r, i) => (r.tier === 2 ? i : -1)).filter((i) => i >= 0);
    if (idx.length >= 2) {
      const bad = [...rows];
      [bad[idx[0]], bad[idx[1]]] = [bad[idx[1]], bad[idx[0]]];
      expect(bad.map((r) => r.activityId)).not.toEqual(rows.map((r) => r.activityId));
      expect(diffQueueOrder(recount.rows, bad)).not.toEqual([]);
    }
  });
});
