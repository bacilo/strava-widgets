/**
 * Phase 37 CUR-04 / D-12 / CR-01: producer <-> validator contract.
 *
 * `fingerprintFor` / `deriveFlaggedActivities` (derive-flagged.mjs) PRODUCE the fingerprint the browser
 * PUTs to /__curate/reviewed/:id; `normalizeFingerprint` (curate-server.mjs) VALIDATES it
 * (closed charset [A-Za-z0-9:,|=-], 1..2000 chars). Each side has its own literal-based tests; this file
 * asserts the two REAL functions agree, so a vocabulary change on the producer cannot silently make a row
 * un-markable-as-reviewed (HTTP 400).
 *
 * Vocabulary, derived from source (not from the commit message):
 *   distances = TARGET_ORDER (imported, src/analytics/best-effort.types.ts):
 *     400m(4) 1k(2) 1mi(3) 5k(2) 10k(3) half(4) marathon(8)            => sum 26 chars, 7 distances
 *   demotion guards = EffortDemotionGuard union (same file; cross-checked below against the source text):
 *     world-record(12) max-speed(9) ceiling(7) unreliable-segment(18)  => sum 46 chars, 4 guards
 *   contamination guard = the single literal 'unreliable-segment' (EffortContamination.guard)
 *   kinds: demoted(7), contaminated(12)
 *   token = distance ':' kind ':' guard => len(d) + 1 + len(kind) + 1 + len(guard)
 *
 * REALISTIC worst case (what the pipeline can emit): an effort has ONE `demotion` object and ONE
 * `contaminated` object, one effort per distance, so per distance at most one demoted + one contaminated
 * token, longest guard (unreliable-segment, 18) on both:
 *     demoted:       d + 1 + 7  + 1 + 18 = d + 27
 *     contaminated:  d + 1 + 12 + 1 + 18 = d + 32
 *     per distance 2d + 59  => 2*26 + 7*59 = 52 + 413 = 465
 *     14 tokens => 13 commas;  suffix '|t=1' = 4   => 465 + 13 + 4 = 482
 *
 * LOOSE UPPER BOUND (every distance x every demotion guard x both kinds; the schema-permitted
 * superset, and the figure the CR-01 commit cites for the 2000 cap):
 *     demoted per d:      4(d+1+7+1) + 46  = 4d + 82
 *     contaminated per d: 4(d+1+12+1) + 46 = 4d + 102
 *     per distance 8d + 184 => 8*26 + 7*184 = 208 + 1288 = 1496
 *     56 tokens => 55 commas; suffix 4  => 1496 + 55 + 4 = 1555
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TARGET_ORDER } from '../../src/analytics/best-effort.types.ts';
import { normalizeFingerprint } from '../curate-server.mjs';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);

// Test-only seam so the recorded mutation run can point the PRODUCER at a scratch copy under os.tmpdir().
const derive = await import(
  process.env.FP_CONTRACT_DERIVE_PATH
    ? pathToFileURL(process.env.FP_CONTRACT_DERIVE_PATH).href
    : '../curate-queue/derive-flagged.mjs'
);
const { fingerprintFor, deriveFlaggedActivities } = derive;

const DEMOTION_GUARDS = ['world-record', 'max-speed', 'ceiling', 'unreliable-segment'];
const CONTAM_GUARD = 'unreliable-segment';
const LONGEST_GUARD = DEMOTION_GUARDS.reduce((a, b) => (b.length > a.length ? b : a));

function eff(distance, demotionGuard, contamGuard) {
  return {
    distance,
    demotion: demotionGuard ? { guard: demotionGuard, reason: 'r' } : null,
    contaminated: contamGuard ? { guard: contamGuard, reason: 'r' } : null,
  };
}

/** Extracts the literal regex source from the REAL validator, so mutations derive from it. */
function validatorSource() {
  return readFileSync(path.join(REPO_ROOT, 'scripts/curate-server.mjs'), 'utf8');
}
function validatorFrom(re) {
  return (raw) => (typeof raw === 'string' && re.test(raw) ? raw : null);
}
/** Returns the fingerprints a validator rejects (contract violations). */
function violations(fps, validate) {
  return fps.filter((fp) => validate(fp) !== fp);
}

describe('fingerprint contract: vocabulary is derived from source', () => {
  it('the guard list used here equals the EffortDemotionGuard union and every analytics guard literal is in it', () => {
    const types = readFileSync(path.join(REPO_ROOT, 'src/analytics/best-effort.types.ts'), 'utf8');
    const m = types.match(/export type EffortDemotionGuard\s*=\s*([^;]+);/);
    expect(m).not.toBeNull();
    const union = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect([...union].sort()).toEqual([...DEMOTION_GUARDS].sort());
    expect(TARGET_ORDER.length).toBe(7);
    expect(TARGET_ORDER.reduce((n, d) => n + d.length, 0)).toBe(26);
    expect(LONGEST_GUARD).toBe('unreliable-segment');
    expect(DEMOTION_GUARDS.reduce((n, g) => n + g.length, 0)).toBe(46);
    // No emitter outside the vocabulary: scan src/analytics non-test sources for `guard: '<literal>'`.
    const dir = path.join(REPO_ROOT, 'src/analytics');
    const found = new Set();
    for (const f of readdirSyncTs(dir)) {
      for (const g of readFileSync(f, 'utf8').matchAll(/\bguard:\s*'([^']+)'/g)) found.add(g[1]);
    }
    expect(found.size).toBeGreaterThan(0);
    for (const g of found) expect(DEMOTION_GUARDS).toContain(g);
  });
});

import { readdirSync } from 'node:fs';
function readdirSyncTs(dir) {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))
    .map((n) => path.join(dir, n));
}

describe('fingerprint contract: synthetic worst case is accepted by normalizeFingerprint', () => {
  // One effort per distance, demotion AND contaminated both on the longest guard, transported.
  const realistic = TARGET_ORDER.map((d) => eff(d, LONGEST_GUARD, CONTAM_GUARD));
  // Schema-permitted superset: every distance x every demotion guard x both kinds (duplicate-distance efforts).
  const loose = TARGET_ORDER.flatMap((d) => DEMOTION_GUARDS.map((g) => eff(d, g, CONTAM_GUARD)));

  it('realistic worst case is exactly 482 chars (hand-derived) and accepted unchanged', () => {
    const fp = fingerprintFor(realistic, true);
    expect(fp.split(',').length).toBe(14);
    expect(fp.length).toBe(482);
    expect(normalizeFingerprint(fp)).toBe(fp);
  });

  it('loose upper bound (all distances x all guards x both kinds) is exactly 1555 chars and accepted unchanged', () => {
    // contaminated kind only ever has ONE guard, so de-dup collapses the loose list to 28 demoted + 7
    // contaminated tokens; build the full 56-token superset explicitly to reach the 1555 bound.
    const full = TARGET_ORDER.flatMap((d) =>
      DEMOTION_GUARDS.flatMap((g) => [eff(d, g, null), eff(d, null, g)])
    );
    const fp = fingerprintFor(full, true);
    expect(fp.split(',').length).toBe(56);
    expect(fp.length).toBe(1555);
    expect(normalizeFingerprint(fp)).toBe(fp);
    // the (smaller) emittable-shape list must also pass
    const fp2 = fingerprintFor(loose, true);
    expect(fp2.length).toBeLessThan(1555);
    expect(normalizeFingerprint(fp2)).toBe(fp2);
  });

  it('headroom: the 2000 cap exceeds the loose bound, and the cap in the source is the one under test', () => {
    expect(validatorSource()).toMatch(/\{1,2000\}/);
    expect(normalizeFingerprint('a'.repeat(2000))).not.toBeNull();
    expect(normalizeFingerprint('a'.repeat(2001))).toBeNull();
  });
});

describe('fingerprint contract: every live row fingerprint is accepted', () => {
  const BE = path.join(REPO_ROOT, 'data/stats/best-efforts.json');
  const IDX = path.join(REPO_ROOT, 'data/dashboard/index.json');
  const present = existsSync(BE) && existsSync(IDX);

  it.skipIf(!present)('normalizeFingerprint(row.fingerprint) === row.fingerprint for every derived row (rows > 0)', () => {
    const be = JSON.parse(readFileSync(BE, 'utf8'));
    const idx = JSON.parse(readFileSync(IDX, 'utf8'));
    const rows = deriveFlaggedActivities(be, { exclusions: [] }, idx);
    expect(rows.length).toBeGreaterThan(0);
    const bad = rows.filter((r) => normalizeFingerprint(r.fingerprint) !== r.fingerprint);
    expect(bad.map((r) => `${r.activityId}:${r.fingerprint.length}`)).toEqual([]);
    const max = Math.max(...rows.map((r) => r.fingerprint.length));
    // eslint-disable-next-line no-console
    process.stdout.write(`[fingerprint-contract] live rows=${rows.length} maxFingerprintLength=${max}\n`);
  });
});

describe('fingerprint contract: negative controls (the check can fail)', () => {
  const src = validatorSource();
  const m = src.match(/return (\/\^\[A-Za-z0-9:,\|=-\]\{1,2000\}\$\/)\.test\(raw\)/);
  const realRe = m ? new RegExp(m[1].slice(1, -1)) : null;
  const worst = fingerprintFor(
    TARGET_ORDER.map((d) => eff(d, LONGEST_GUARD, CONTAM_GUARD)),
    true
  );

  it('the real validator regex was located in source and accepts the worst case (control baseline)', () => {
    expect(realRe).not.toBeNull();
    expect(violations([worst], validatorFrom(realRe))).toEqual([]);
  });

  it('a cap lowered below the computed worst case (481) is detected as a violation', () => {
    const lowered = new RegExp(realRe.source.replace('{1,2000}', '{1,481}'));
    expect(violations([worst], validatorFrom(lowered))).toEqual([worst]);
  });

  it('dropping "-" from the charset is detected (guard strings contain "-")', () => {
    const noDash = new RegExp(realRe.source.replace('=-]', '=]'));
    expect(violations([worst], validatorFrom(noDash))).toEqual([worst]);
  });

  it('a producer emitting a disallowed char (guard "bad guard!") is rejected by the real validator', () => {
    const fp = fingerprintFor([eff('5k', 'bad guard!', null)], false);
    expect(violations([fp], normalizeFingerprint)).toEqual([fp]);
  });
});
