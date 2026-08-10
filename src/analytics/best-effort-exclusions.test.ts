import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import { TARGET_ORDER, type TargetDistanceKey } from './best-effort.types.js';
import { buildExclusionIndex, isExcluded, loadExclusions } from './best-effort-exclusions.js';

describe('buildExclusionIndex / isExcluded', () => {
  it('distances: null excludes every target distance for that activity', () => {
    const index = buildExclusionIndex([{ activityId: 'a1', distances: null, reason: 'bad device' }]);
    expect(isExcluded(index, 'a1', '400m')).toBe(true);
    expect(isExcluded(index, 'a1', 'marathon')).toBe(true);
  });

  it('a non-empty distances array narrows the exclusion to those distances only', () => {
    const index = buildExclusionIndex([{ activityId: 'a2', distances: ['1k'], reason: 'bad device' }]);
    expect(isExcluded(index, 'a2', '1k')).toBe(true);
    expect(isExcluded(index, 'a2', '5k')).toBe(false);
  });

  it('an activity absent from the list is never excluded', () => {
    const index = buildExclusionIndex([{ activityId: 'a2', distances: ['1k'], reason: 'bad device' }]);
    for (const key of TARGET_ORDER) {
      expect(isExcluded(index, 'absent', key)).toBe(false);
    }
  });

  it('null distances wins over a narrower duplicate entry for the same activityId (union semantics)', () => {
    const index = buildExclusionIndex([
      { activityId: 'a3', distances: ['1k'], reason: 'first entry' },
      { activityId: 'a3', distances: null, reason: 'second entry, all distances' },
    ]);
    expect(isExcluded(index, 'a3', '1k')).toBe(true);
    expect(isExcluded(index, 'a3', 'marathon')).toBe(true);
    expect(isExcluded(index, 'a3', '400m')).toBe(true);
  });

  it('unknown distance strings are dropped, surviving known distances still apply', () => {
    const index = buildExclusionIndex([
      { activityId: 'a4', distances: ['1k', 'not-a-real-distance'], reason: 'bad device' },
    ]);
    expect(isExcluded(index, 'a4', '1k')).toBe(true);
    expect(isExcluded(index, 'a4', '5k')).toBe(false);
  });

  it('an entry whose distances array is entirely unknown strings is skipped (empty filtered set)', () => {
    const index = buildExclusionIndex([
      { activityId: 'a5', distances: ['not-a-real-distance'], reason: 'bad device' },
    ]);
    for (const key of TARGET_ORDER) {
      expect(isExcluded(index, 'a5', key)).toBe(false);
    }
  });

  it('a non-object entry, a missing activityId, and a non-string activityId are all skipped, keeping valid siblings', () => {
    const index = buildExclusionIndex([
      null,
      42,
      'not-an-object',
      { distances: null, reason: 'missing activityId' },
      { activityId: 123, distances: null, reason: 'non-string activityId' },
      { activityId: 'valid', distances: null, reason: 'this one is fine' },
    ]);
    expect(isExcluded(index, 'valid', '400m')).toBe(true);
    // The non-string activityId entry must not have silently coerced to a
    // matching key under some other id — 'valid' is the only exclusion.
    expect(index.size).toBe(1);
  });
});

describe('loadExclusions', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'best-effort-exclusions-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('a nonexistent path resolves to an empty index, does not throw', async () => {
    const index = await loadExclusions(fileStore, 'does-not-exist.json');
    expect(index.size).toBe(0);
  });

  it('a file whose JSON parses but has no exclusions array resolves to an empty index, does not throw', async () => {
    await fileStore.writeJson('malformed.json', { schemaVersion: 1, note: 'no exclusions field' });
    const index = await loadExclusions(fileStore, 'malformed.json');
    expect(index.size).toBe(0);
  });

  it('a real exclusions file loads correctly into an index', async () => {
    await fileStore.writeJson('exclusions.json', {
      schemaVersion: 1,
      note: 'test',
      exclusions: [{ activityId: '3475726256', distances: null, reason: 'bad gps device' }],
    });
    const index = await loadExclusions(fileStore, 'exclusions.json');
    expect(isExcluded(index, '3475726256', '400m' as TargetDistanceKey)).toBe(true);
  });
});
