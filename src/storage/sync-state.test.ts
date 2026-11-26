import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from './file-store.js';
import { SyncStateManager } from './sync-state.js';

describe('SyncStateManager near_match_skips', () => {
  let tmpDir: string;
  let manager: SyncStateManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-state-'));
    manager = new SyncStateManager('sync-state.json', new FileStore(tmpDir));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads a legacy 4-field file with near_match_skips undefined', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'sync-state.json'),
      JSON.stringify({
        last_sync_timestamp: 1785560000,
        last_activity_id: 'i1999',
        total_activities: 7,
        last_sync_date: '2026-08-01T05:00:00.000Z',
      })
    );
    const s = await manager.load();
    expect(s.last_sync_timestamp).toBe(1785560000);
    expect(s.last_activity_id).toBe('i1999');
    expect(s.total_activities).toBe(7);
    expect(s.last_sync_date).toBe('2026-08-01T05:00:00.000Z');
    expect(s.near_match_skips).toBeUndefined();
  });

  it('updateAfterSync carries an existing near_match_skips map through unchanged', async () => {
    const skips = {
      i9: {
        existingId: '25000000009',
        deltaS: -30,
        startDate: '2026-08-02T06:00:00Z',
        firstSeen: '2026-08-02T07:00:00.000Z',
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, 'sync-state.json'),
      JSON.stringify({
        last_sync_timestamp: 1,
        last_activity_id: 'x',
        total_activities: 1,
        last_sync_date: '2026-08-01T05:00:00.000Z',
        near_match_skips: skips,
      })
    );
    await manager.updateAfterSync([{ id: 42, start_date: '2026-08-03T06:00:00Z' } as never]);
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'sync-state.json'), 'utf-8'));
    expect(onDisk.near_match_skips).toEqual(skips);
    expect(onDisk.last_activity_id).toBe('42');
  });
});
