/**
 * Partition guard for the logic/archive vitest split (Phase 36.1, L-02).
 * A guard never observed failing is not evidence: every rule is exercised
 * with a planted violation, and each planted input is asserted to differ
 * from the clean input.
 */
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkPartition, listFiles } from './lib/test-partition.mjs';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);

const CLEAN = {
  all: ['a.test.ts', 'b.archive.test.ts'],
  logic: ['a.test.ts'],
  archive: ['b.archive.test.ts'],
};

function planted(patch) {
  const input = { ...CLEAN, ...patch };
  expect(input).not.toEqual(CLEAN);
  return checkPartition(input);
}

describe('checkPartition (planted cases)', () => {
  it('returns [] for a clean partition', () => {
    expect(checkPartition(CLEAN)).toEqual([]);
  });

  it('flags a file in neither set (in-neither)', () => {
    const v = planted({ all: [...CLEAN.all, 'c.test.ts'] });
    expect(v.map((x) => x.rule)).toContain('in-neither');
    expect(v.find((x) => x.rule === 'in-neither').file).toBe('c.test.ts');
  });

  it('flags a file in both sets (overlap)', () => {
    const v = planted({ logic: ['a.test.ts', 'b.archive.test.ts'] });
    expect(v.map((x) => x.rule)).toContain('overlap');
  });

  it('flags a file outside the base set (not-in-base)', () => {
    const v = planted({ logic: ['a.test.ts', 'z.test.ts'] });
    expect(v.map((x) => x.rule)).toContain('not-in-base');
  });

  it('flags an empty archive set (archive-empty)', () => {
    const v = planted({ all: ['a.test.ts'], archive: [] });
    expect(v.map((x) => x.rule)).toContain('archive-empty');
  });

  it('flags suffix violations in both directions (suffix)', () => {
    const v1 = planted({
      all: ['a.test.ts', 'b.archive.test.ts', 'c.test.ts'],
      archive: ['b.archive.test.ts', 'c.test.ts'],
    });
    expect(v1.some((x) => x.rule === 'suffix' && x.file === 'c.test.ts')).toBe(true);
    const v2 = planted({
      all: ['a.test.ts', 'b.archive.test.ts', 'd.archive.test.mjs'],
      logic: ['a.test.ts', 'd.archive.test.mjs'],
    });
    expect(v2.some((x) => x.rule === 'suffix' && x.file === 'd.archive.test.mjs')).toBe(true);
  });
});

describe('live partition', () => {
  it('base = logic + archive, disjoint, archive non-empty', () => {
    const all = listFiles(null, REPO_ROOT);
    const logic = listFiles('vitest.logic.config.ts', REPO_ROOT);
    const archive = listFiles('vitest.archive.config.ts', REPO_ROOT);
    expect(
      checkPartition({ all, logic, archive }),
      `sizes: base=${all.length} logic=${logic.length} archive=${archive.length}`,
    ).toEqual([]);
    expect(archive.length).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
