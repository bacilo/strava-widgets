/**
 * Tests for the Phase 36 PR-09 BEFORE-STATE leg (36-16). Every document here is hand-built; no test
 * reads 36-DIFF.md, 36-CEILING-RECALIBRATION.md, data/stats/ or data/best-effort-ceiling.json, and no
 * test writes a file. The only file read is this leg's OWN source (for the zero-import guard).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  deriveBeforeAfterBuckets,
  parseDiffArtifact,
  parseRecalibrationBefore,
  compareCeilingsBefore,
  reconcileBeforeState,
  findForbiddenImports,
} from './compute-clean-window-before-state.mjs';

const SCRIPT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'compute-clean-window-before-state.mjs');

function effort(distance, { demotion = null, excluded = false, contaminated, durationSec = 100 } = {}) {
  const e = { distance, durationSec, demotion, excludedFromRecords: excluded };
  if (contaminated !== undefined) e.contaminated = contaminated;
  return e;
}

function doc(activities, { rankings = {}, ceilings = {} } = {}) {
  const out = { activities: {}, rankings, ceilings };
  for (const [id, efforts] of Object.entries(activities)) out.activities[id] = { efforts };
  return out;
}

const CEILING_DEMOTION = { guard: 'ceiling', reason: 'above ceiling' };
const MAXSPEED_DEMOTION = { guard: 'max-speed', reason: 'above max speed' };
const WR_DEMOTION = { guard: 'world-record', reason: 'above WR' };
const UNRELIABLE = { guard: 'unreliable-segment', reason: 'no clean window' };
const CONTAM = { reason: 'moved' };

describe('before-state leg — bucket derivation', () => {
  it('counts an OLD ceiling demotion that NEW ranks as one ceiling reinstatement', () => {
    const oldDoc = doc({ a1: [effort('400m', { demotion: CEILING_DEMOTION, durationSec: 60 })] });
    const newDoc = doc({ a1: [effort('400m', { contaminated: CONTAM, durationSec: 80 })] });
    const b = deriveBeforeAfterBuckets(oldDoc, newDoc);
    expect(b.reinstated.ceiling['400m']).toBe(1);
    expect(b.reinstated.absoluteGuard['400m']).toBe(0);
    expect(b.ceilingPairs['400m']).toEqual([
      { activityId: 'a1', distance: '400m', oldDurationSec: 60, newDurationSec: 80 },
    ]);
  });

  it('counts an owner-excluded pair as excluded, never as a reinstatement', () => {
    const oldDoc = doc({ a1: [effort('400m', { demotion: CEILING_DEMOTION, excluded: true })] });
    const newDoc = doc({ a1: [effort('400m', { contaminated: CONTAM, excluded: true })] });
    const b = deriveBeforeAfterBuckets(oldDoc, newDoc);
    expect(b.excluded['400m']).toBe(1);
    expect(b.reinstated.ceiling['400m']).toBe(0);
    expect(b.reinstated.absoluteGuard['400m']).toBe(0);
  });

  it('splits OLD max-speed and world-record reinstatements into the absolute-guard bucket', () => {
    const oldDoc = doc({
      a1: [effort('1k', { demotion: MAXSPEED_DEMOTION })],
      a2: [effort('1k', { demotion: WR_DEMOTION })],
    });
    const newDoc = doc({ a1: [effort('1k')], a2: [effort('1k')] });
    const b = deriveBeforeAfterBuckets(oldDoc, newDoc);
    expect(b.reinstated.absoluteGuard['1k']).toBe(2);
    expect(b.reinstated.ceiling['1k']).toBe(0);
  });

  it('counts a guard change between two demotions, newly demoted, moved-but-ranked and unchanged', () => {
    const oldDoc = doc({
      a1: [effort('400m', { demotion: CEILING_DEMOTION })],
      a2: [effort('400m')],
      a3: [effort('400m')],
      a4: [effort('400m')],
    });
    const newDoc = doc({
      a1: [effort('400m', { demotion: UNRELIABLE })],
      a2: [effort('400m', { demotion: UNRELIABLE })],
      a3: [effort('400m', { contaminated: CONTAM })],
      a4: [effort('400m', { contaminated: null })],
    });
    const b = deriveBeforeAfterBuckets(oldDoc, newDoc);
    expect(b.demotedGuardChanged['400m']).toBe(1);
    expect(b.newlyDemoted['400m']).toBe(1);
    expect(b.movedButRanked['400m']).toBe(1);
    expect(b.unchanged['400m']).toBe(1);
    expect(b.reinstated.ceiling['400m']).toBe(0);
  });

  it('counts a pair present on one side only in onlyInOld/onlyInNew and never classifies it', () => {
    const oldDoc = doc({ a1: [effort('400m', { demotion: CEILING_DEMOTION })], a2: [effort('1k')] });
    const newDoc = doc({ a2: [effort('1k')], a3: [effort('1k')] });
    const b = deriveBeforeAfterBuckets(oldDoc, newDoc);
    expect(b.onlyInOld).toBe(1);
    expect(b.onlyInNew).toBe(1);
    expect(b.reinstated.ceiling['400m']).toBe(0);
    expect(b.unchanged['1k']).toBe(1);
  });
});

const PRE_FIX_HEADLINE = [
  '## Headline',
  '',
  '- Moved but still ranked: 1097',
  '- Newly demoted: 391',
  '- Reinstated: 31 (31 absolute-guard, 0 ceiling)',
  '- Unchanged: 7472',
  '- Distances whose ceiling moved: 6 of 7',
  '',
  '## Ceiling Values',
  '',
  '| Distance | Ceiling before (m/s) | Ceiling after (m/s) | p90 before | p90 after | Population before -> after |',
  '|---|---|---|---|---|---|',
  '| 400m | 5.1098 | 5.0295 | 3.9920 | 3.9293 | 1834 -> 1858 |',
  '| marathon | — | — | — | — | 0 -> 0 |',
  '',
].join('\n');

function fullDiffText({ ceiling = 1, abs = 0, ranks = ['| 1 | a1 | a9 | 60.0 | 80.0 |'] } = {}) {
  return [
    '## Headline',
    '',
    '- Moved but still ranked: 0',
    '- Newly demoted: 0',
    `- Reinstated: ${ceiling + abs} (${abs} absolute-guard, ${ceiling} ceiling)`,
    '- Demoted before and after, guard changed: 0',
    '- Unchanged: 0',
    '- Owner-excluded, omitted from the five populations above: 0 (the Records screen skips these too)',
    '',
    '## Reinstated',
    '',
    '| Distance | Absolute-guard reinstatements | Ceiling reinstatements |',
    '|---|---|---|',
    `| 400m | ${abs} | ${ceiling} |`,
    ...['1k', '1mi', '5k', '10k', 'half', 'marathon'].map((d) => `| ${d} | 0 | 0 |`),
    '',
    '## Ceiling Values',
    '',
    '| Distance | Ceiling before (m/s) | Ceiling after (m/s) | p90 before | p90 after | Population before -> after |',
    '|---|---|---|---|---|---|',
    '| 400m | 5.1098 | 5.0295 | 3.9920 | 3.9293 | 3 -> 4 |',
    '| marathon | — | — | — | — | 0 -> 0 |',
    '',
    '## Rank Changes',
    '',
    '### 400m',
    '',
    '| Rank | Old activity ID | New activity ID | Old duration (s) | New duration (s) |',
    '|---|---|---|---|---|',
    ...ranks,
    '',
  ].join('\n');
}

function reconcilableFixture() {
  const oldDoc = doc(
    { a1: [effort('400m', { demotion: CEILING_DEMOTION, durationSec: 60 })] },
    {
      rankings: { '400m': [{ activityId: 'a1', durationSec: 60.04 }] },
      ceilings: {
        '400m': { ceilingMps: 5.1098, populationN: 3 },
        marathon: { ceilingMps: null, populationN: 0 },
      },
    }
  );
  const newDoc = doc({ a1: [effort('400m', { contaminated: CONTAM, durationSec: 80 })] });
  return { oldDoc, newDoc };
}

const RECAL_TEXT = [
  '| Distance | Ceiling before (m/s) | Ceiling after (m/s) | Delta | Movement | Population before -> after |',
  '|---|---|---|---|---|---|',
  '| 400m | 5.1098 | 5.0295 | -0.0803 | fell | 3 -> 4 |',
  '| marathon | — | — | — | never-derivable | 0 -> 0 |',
].join('\n');

describe('before-state leg — reconciliation against the diff headline', () => {
  it('parses the pre-fix headline: ceiling 0, absent fields are null, nothing throws', () => {
    const p = parseDiffArtifact(PRE_FIX_HEADLINE);
    expect(p.reinstatedTotal).toBe(31);
    expect(p.reinstatedAbsoluteGuard).toBe(31);
    expect(p.reinstatedCeiling).toBe(0);
    expect(p.movedButRanked).toBe(1097);
    expect(p.newlyDemoted).toBe(391);
    expect(p.unchanged).toBe(7472);
    expect(p.demotedGuardChanged).toBeNull();
    expect(p.ownerExcluded).toBeNull();
    expect(p.reinstatedTable).toBeNull();
    expect(p.ceilingBefore['400m']).toEqual({ ceiling: 5.1098, population: 1834 });
    expect(p.ceilingBefore.marathon).toEqual({ ceiling: null, population: 0 });
  });

  it('reports a disagreement when the headline claims 0 ceiling reinstatements against a derived 1', () => {
    const { oldDoc, newDoc } = reconcilableFixture();
    const derived = deriveBeforeAfterBuckets(oldDoc, newDoc);
    const parsed = parseDiffArtifact(fullDiffText({ ceiling: 0, abs: 0 }));
    parsed.recalibrationBefore = parseRecalibrationBefore(RECAL_TEXT);
    const r = reconcileBeforeState(derived, parsed, oldDoc);
    const row = r.rows.find((x) => x.check === 'ceiling reinstatements (total)');
    expect(row).toMatchObject({ derived: 1, artifact: 0, agrees: false });
    expect(r.ok).toBe(false);
  });

  it('agrees on every row when the artifact matches the derived state', () => {
    const { oldDoc, newDoc } = reconcilableFixture();
    const derived = deriveBeforeAfterBuckets(oldDoc, newDoc);
    const parsed = parseDiffArtifact(fullDiffText({ ceiling: 1, abs: 0 }));
    parsed.recalibrationBefore = parseRecalibrationBefore(RECAL_TEXT);
    const r = reconcileBeforeState(derived, parsed, oldDoc);
    expect(r.rows.filter((x) => !x.agrees)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('fails closed on every missing parsed field', () => {
    const { oldDoc, newDoc } = reconcilableFixture();
    const derived = deriveBeforeAfterBuckets(oldDoc, newDoc);
    const parsed = parseDiffArtifact(PRE_FIX_HEADLINE);
    parsed.recalibrationBefore = parseRecalibrationBefore(RECAL_TEXT);
    const r = reconcileBeforeState(derived, parsed, oldDoc);
    expect(r.ok).toBe(false);
    for (const check of ['demoted-guard-changed (total)', 'owner-excluded (total)']) {
      const row = r.rows.find((x) => x.check === check);
      expect(row.artifact).toBeNull();
      expect(row.agrees).toBe(false);
    }
  });

  it('flags an OLD rank row whose activity or duration differs from the pre-phase rankings', () => {
    const { oldDoc, newDoc } = reconcilableFixture();
    const derived = deriveBeforeAfterBuckets(oldDoc, newDoc);
    const parsed = parseDiffArtifact(
      fullDiffText({ ceiling: 1, abs: 0, ranks: ['| 1 | a1 | a9 | 66.3 | 80.0 |'] })
    );
    parsed.recalibrationBefore = parseRecalibrationBefore(RECAL_TEXT);
    const r = reconcileBeforeState(derived, parsed, oldDoc);
    const row = r.rows.find((x) => x.check.startsWith('old rank 400m #1'));
    expect(row.agrees).toBe(false);
  });

  it('compares ceilings at 4 dp: a match agrees, a 0.0001 difference disagrees', () => {
    const table = { '400m': { ceiling: 5.1098, population: 3 } };
    const agree = compareCeilingsBefore({ '400m': { ceilingMps: 5.1098, populationN: 3 } }, table, 'x');
    expect(agree.every((r) => r.agrees)).toBe(true);
    const off = compareCeilingsBefore({ '400m': { ceilingMps: 5.1099, populationN: 3 } }, table, 'x');
    expect(off.find((r) => r.check.includes('400m')).agrees).toBe(false);
  });
});

describe('before-state leg — zero-import guard', () => {
  it('returns no hits for the leg\'s own source', () => {
    expect(findForbiddenImports(readFileSync(SCRIPT_PATH, 'utf8'))).toEqual([]);
  });

  it('catches a planted static import of the diff generator', () => {
    const planted = "import { x } from './compute-clean-window-diff.mjs';\n";
    expect(findForbiddenImports(planted)).toHaveLength(1);
  });

  it('catches a planted dynamic import of the recalibration script', () => {
    const planted = "const m = await import('./compute-ceiling-recalibration.mjs');\n";
    expect(findForbiddenImports(planted)).toHaveLength(1);
  });

  it('does not flag a comment that merely names both files', () => {
    const text = [
      '// we never import compute-clean-window-diff.mjs or compute-ceiling-recalibration.mjs',
      "/* import { y } from './compute-clean-window-diff.mjs'; */",
      'const ok = 1;',
    ].join('\n');
    expect(findForbiddenImports(text)).toEqual([]);
  });
});
