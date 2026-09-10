import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import { TARGET_ORDER, type CeilingDerivation, type TargetDistanceKey } from './best-effort.types.js';
import {
  buildCeilingStateFile,
  diffCeilingState,
  formatCeilingMovement,
  loadCeilingState,
} from './best-effort-ceiling-state.js';

/** Builds a full `Record<TargetDistanceKey, CeilingDerivation>` where every distance shares the same shape, for tests that only care about one distance. */
function ceilingsWith(overrides: Partial<Record<TargetDistanceKey, CeilingDerivation>>): Record<TargetDistanceKey, CeilingDerivation> {
  const result = {} as Record<TargetDistanceKey, CeilingDerivation>;
  for (const distance of TARGET_ORDER) {
    result[distance] =
      overrides[distance] ??
      ({
        distance,
        populationN: 0,
        p90Mps: null,
        multiplier: 1.28,
        ceilingMps: null,
        failOpenReason: 'population 0 below minimum 100 — no personal ceiling derived; world-record and max_speed guards still apply',
      } satisfies CeilingDerivation);
  }
  return result;
}

function derivation(distance: TargetDistanceKey, overrides: Partial<CeilingDerivation> = {}): CeilingDerivation {
  return {
    distance,
    populationN: 1831,
    p90Mps: 4.0033,
    multiplier: 1.28,
    ceilingMps: 5.084,
    failOpenReason: null,
    ...overrides,
  };
}

describe('buildCeilingStateFile', () => {
  it('iterates TARGET_ORDER so Object.keys(file.ceilings) deep-equals TARGET_ORDER', () => {
    const ceilings = ceilingsWith({ '400m': derivation('400m') });
    const file = buildCeilingStateFile(ceilings, '2026-09-11T00:00:00.000Z');
    expect(Object.keys(file.ceilings)).toEqual(TARGET_ORDER);
  });

  it('projects only the three persisted fields per distance, sets schemaVersion 1 and the given generatedAt', () => {
    const ceilings = ceilingsWith({ '400m': derivation('400m') });
    const file = buildCeilingStateFile(ceilings, '2026-09-11T00:00:00.000Z');
    expect(file.schemaVersion).toBe(1);
    expect(file.generatedAt).toBe('2026-09-11T00:00:00.000Z');
    expect(file.ceilings['400m']).toEqual({ ceilingMps: 5.084, p90Mps: 4.0033, populationN: 1831 });
    expect(typeof file.note).toBe('string');
    expect(file.note.length).toBeGreaterThan(0);
  });
});

describe('loadCeilingState', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'best-effort-ceiling-state-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('a valid round trip: buildCeilingStateFile output written then loaded back is equal', async () => {
    const ceilings = ceilingsWith({ '400m': derivation('400m'), '1k': derivation('1k', { ceilingMps: 4.7513 }) });
    const built = buildCeilingStateFile(ceilings, '2026-09-11T00:00:00.000Z');
    await fileStore.writeJson('ceiling.json', built);

    const loaded = await loadCeilingState(fileStore, 'ceiling.json');
    expect(loaded).toEqual(built);
  });

  it('a missing file returns null with a warning rather than throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCeilingState(fileStore, 'does-not-exist.json');
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('a file containing invalid JSON returns null rather than throwing', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'bad.json'), '{ not valid json', 'utf-8');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCeilingState(fileStore, 'bad.json');
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('a file with the wrong schemaVersion returns null', async () => {
    await fileStore.writeJson('wrong-version.json', {
      schemaVersion: 2,
      note: 'test',
      generatedAt: '2026-09-11T00:00:00.000Z',
      ceilings: {},
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCeilingState(fileStore, 'wrong-version.json');
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('a file with ONE malformed distance entry returns the other six', async () => {
    const ceilings = ceilingsWith({
      '400m': derivation('400m'),
      '1k': derivation('1k'),
      '1mi': derivation('1mi'),
      '5k': derivation('5k'),
      '10k': derivation('10k'),
      half: derivation('half'),
      marathon: derivation('marathon'),
    });
    const built = buildCeilingStateFile(ceilings, '2026-09-11T00:00:00.000Z');
    // Corrupt exactly one distance entry after building — ceilingMps as a string.
    const corrupted = {
      ...built,
      ceilings: { ...built.ceilings, marathon: { ceilingMps: 'not-a-number', p90Mps: null, populationN: 0 } },
    };
    await fileStore.writeJson('one-bad.json', corrupted);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCeilingState(fileStore, 'one-bad.json');
    warnSpy.mockRestore();

    expect(result).not.toBeNull();
    expect(Object.keys(result!.ceilings)).toEqual(TARGET_ORDER.filter((d) => d !== 'marathon'));
    expect(result!.ceilings.marathon).toBeUndefined();
    expect(result!.ceilings['400m']).toEqual({ ceilingMps: 5.084, p90Mps: 4.0033, populationN: 1831 });
  });

  it('a distance entry that is not an object at all is skipped, surviving distances load', async () => {
    const built = buildCeilingStateFile(ceilingsWith({ '400m': derivation('400m') }), '2026-09-11T00:00:00.000Z');
    const corrupted = { ...built, ceilings: { ...built.ceilings, half: 'not-an-object' } };
    await fileStore.writeJson('bad-shape.json', corrupted);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCeilingState(fileStore, 'bad-shape.json');
    warnSpy.mockRestore();

    expect(result).not.toBeNull();
    expect(result!.ceilings.half).toBeUndefined();
    expect(result!.ceilings['400m']).toBeDefined();
  });

  it('a missing ceilings object returns null', async () => {
    await fileStore.writeJson('no-ceilings.json', {
      schemaVersion: 1,
      note: 'test',
      generatedAt: '2026-09-11T00:00:00.000Z',
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCeilingState(fileStore, 'no-ceilings.json');
    warnSpy.mockRestore();
    expect(result).toBeNull();
  });
});

describe('diffCeilingState', () => {
  it('previous === null yields exactly one first-run row (not seven)', () => {
    const current = ceilingsWith({ '400m': derivation('400m') });
    const rows = diffCeilingState(null, current);
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('first-run');
    expect(rows[0].distance).toBeNull();
  });

  it('an identical pair produces an empty array', () => {
    const ceilings = ceilingsWith({ '400m': derivation('400m'), '1k': derivation('1k') });
    const built = buildCeilingStateFile(ceilings, '2026-09-11T00:00:00.000Z');
    const rows = diffCeilingState(built, ceilings);
    expect(rows).toEqual([]);
  });

  it("kind 'ceiling-moved': a changed ceilingMps/p90Mps/populationN produces one row naming both values", () => {
    const previousCeilings = ceilingsWith({ '400m': derivation('400m') });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    const current = ceilingsWith({
      '400m': derivation('400m', { ceilingMps: 5.101, p90Mps: 4.0165, populationN: 1834 }),
    });
    const rows = diffCeilingState(built, current);
    expect(rows.length).toBe(1);
    expect(rows[0].distance).toBe('400m');
    expect(rows[0].kind).toBe('ceiling-moved');
    expect(rows[0].previousCeilingMps).toBe(5.084);
    expect(rows[0].currentCeilingMps).toBe(5.101);
  });

  it("kind 'became-fail-open': a non-null previous ceiling and a null current ceiling", () => {
    const previousCeilings = ceilingsWith({ half: derivation('half', { populationN: 104 }) });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    const current = ceilingsWith({
      half: derivation('half', { ceilingMps: null, p90Mps: null, populationN: 40, failOpenReason: 'population 40 below minimum 100' }),
    });
    const rows = diffCeilingState(built, current);
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('became-fail-open');
    expect(rows[0].previousCeilingMps).not.toBeNull();
    expect(rows[0].currentCeilingMps).toBeNull();
  });

  it("kind 'became-derivable': a null previous ceiling and a non-null current ceiling", () => {
    const previousCeilings = ceilingsWith({
      half: derivation('half', { ceilingMps: null, p90Mps: null, populationN: 40, failOpenReason: 'below minimum' }),
    });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    const current = ceilingsWith({ half: derivation('half', { populationN: 104 }) });
    const rows = diffCeilingState(built, current);
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('became-derivable');
    expect(rows[0].previousCeilingMps).toBeNull();
    expect(rows[0].currentCeilingMps).not.toBeNull();
  });

  it("kind 'population-changed': populationN differs but ceilingMps does not", () => {
    const previousCeilings = ceilingsWith({ '5k': derivation('5k', { ceilingMps: 4.3458, p90Mps: 3.3951, populationN: 1779 }) });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    const current = ceilingsWith({ '5k': derivation('5k', { ceilingMps: 4.3458, p90Mps: 3.3951, populationN: 1786 }) });
    const rows = diffCeilingState(built, current);
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('population-changed');
    expect(rows[0].previousPopulationN).toBe(1779);
    expect(rows[0].currentPopulationN).toBe(1786);
  });

  it('a per-distance first-run row is produced when the previous file loaded but is missing that one distance entirely', () => {
    const previousCeilings = ceilingsWith({ '400m': derivation('400m') });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    delete (built.ceilings as Record<string, unknown>)['1k'];
    const current = ceilingsWith({ '400m': derivation('400m'), '1k': derivation('1k') });
    const rows = diffCeilingState(built, current);
    expect(rows.length).toBe(1);
    expect(rows[0].distance).toBe('1k');
    expect(rows[0].kind).toBe('first-run');
    expect(rows[0].previousCeilingMps).toBeNull();
  });

  it('uses exact equality, not an epsilon: grep-verified separately, but also functionally a 0.00001 difference is reported', () => {
    const previousCeilings = ceilingsWith({ '400m': derivation('400m', { ceilingMps: 5.0842 }) });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    const current = ceilingsWith({ '400m': derivation('400m', { ceilingMps: 5.08420001 }) });
    const rows = diffCeilingState(built, current);
    expect(rows.length).toBe(1);
  });
});

describe('formatCeilingMovement', () => {
  it('emits one line per row', () => {
    const rows = diffCeilingState(null, ceilingsWith({ '400m': derivation('400m') }));
    const lines = formatCeilingMovement(rows);
    expect(lines.length).toBe(rows.length);
  });

  it('a ceiling-moved line contains both the old and new numeric values', () => {
    const previousCeilings = ceilingsWith({ '400m': derivation('400m') });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    const current = ceilingsWith({
      '400m': derivation('400m', { ceilingMps: 5.101, p90Mps: 4.0165, populationN: 1834 }),
    });
    const rows = diffCeilingState(built, current);
    const lines = formatCeilingMovement(rows);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('400m');
    expect(lines[0]).toContain('5.0840');
    expect(lines[0]).toContain('5.1010');
    expect(lines[0]).toContain('1831');
    expect(lines[0]).toContain('1834');
  });

  it('a population-changed line contains both the old and new population values', () => {
    const previousCeilings = ceilingsWith({ '5k': derivation('5k', { ceilingMps: 4.3458, p90Mps: 3.3951, populationN: 1779 }) });
    const built = buildCeilingStateFile(previousCeilings, '2026-09-10T00:00:00.000Z');
    const current = ceilingsWith({ '5k': derivation('5k', { ceilingMps: 4.3458, p90Mps: 3.3951, populationN: 1786 }) });
    const rows = diffCeilingState(built, current);
    const lines = formatCeilingMovement(rows);
    expect(lines[0]).toContain('1779');
    expect(lines[0]).toContain('1786');
  });

  it('the aggregate first-run line names no distance and does not throw on null fields', () => {
    const rows = diffCeilingState(null, ceilingsWith({ '400m': derivation('400m') }));
    const lines = formatCeilingMovement(rows);
    expect(lines[0]).toContain('first run');
  });
});
