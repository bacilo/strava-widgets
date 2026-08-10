import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import type { StreamChannels } from './stream.types.js';
import {
  emptyManifest,
  loadManifest,
  saveManifest,
  upsertAvailable,
  upsertUnavailable,
} from './stream-manifest.js';

const MANIFEST_PATH = 'manifest.json';

const CHANNELS: StreamChannels = { time: true, distance: true, hr: true, cadence: false, elevation: true };

describe('stream-manifest', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-manifest-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loadManifest returns an empty manifest when the file does not exist', async () => {
    const manifest = await loadManifest(fileStore, MANIFEST_PATH);
    expect(manifest.activities).toEqual({});
  });

  it('loadManifest returns the parsed manifest when the file exists', async () => {
    const manifest = emptyManifest();
    upsertAvailable(manifest, '1', {
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 500,
      channels: CHANNELS,
    });
    await saveManifest(fileStore, MANIFEST_PATH, manifest);

    const loaded = await loadManifest(fileStore, MANIFEST_PATH);
    expect(loaded.activities['1']).toMatchObject({ available: true, source: 'fit' });
  });

  it('upsertAvailable records source, distanceSource, sampleCount and channels for an id', () => {
    const manifest = emptyManifest();
    upsertAvailable(manifest, '42', {
      source: 'gpx',
      distanceSource: 'geo',
      sampleCount: 900,
      channels: CHANNELS,
    });
    expect(manifest.activities['42']).toEqual({
      available: true,
      source: 'gpx',
      distanceSource: 'geo',
      sampleCount: 900,
      channels: CHANNELS,
    });
  });

  it('upsertUnavailable records available:false plus a reason code for an id', () => {
    const manifest = emptyManifest();
    upsertUnavailable(manifest, '99', 'manual');
    expect(manifest.activities['99']).toEqual({ available: false, reason: 'manual' });
  });

  it('an upsert overwrites an existing entry for the same id rather than appending a duplicate', () => {
    const manifest = emptyManifest();
    upsertUnavailable(manifest, '5', 'no-original');
    upsertAvailable(manifest, '5', {
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 1000,
      channels: CHANNELS,
    });
    expect(Object.keys(manifest.activities)).toEqual(['5']);
    expect(manifest.activities['5']).toMatchObject({ available: true, source: 'fit' });
  });

  it('saveManifest writes activity ids in sorted order, so the serialized output is byte-stable across runs', async () => {
    const manifest = emptyManifest();
    upsertUnavailable(manifest, '300', 'manual');
    upsertUnavailable(manifest, '100', 'manual');
    upsertUnavailable(manifest, '200', 'manual');
    await saveManifest(fileStore, MANIFEST_PATH, manifest);

    const parsed = JSON.parse(await fs.readFile(path.join(tmpDir, MANIFEST_PATH), 'utf-8'));
    expect(Object.keys(parsed.activities)).toEqual(['100', '200', '300']);
  });

  it('saveManifest recomputes totals from the entries', async () => {
    const manifest = emptyManifest();
    upsertAvailable(manifest, '1', {
      source: 'fit',
      distanceSource: 'native',
      sampleCount: 500,
      channels: CHANNELS,
    });
    upsertUnavailable(manifest, '2', 'manual');
    upsertUnavailable(manifest, '3', 'manual');
    upsertUnavailable(manifest, '4', 'no-original');
    await saveManifest(fileStore, MANIFEST_PATH, manifest);

    const parsed = JSON.parse(await fs.readFile(path.join(tmpDir, MANIFEST_PATH), 'utf-8'));
    expect(parsed.totals).toEqual({
      activities: 4,
      with_streams: 1,
      without_streams: 3,
      by_reason: { manual: 2, 'no-original': 1 },
    });
  });

  it('saveManifest preserves the previous generated_at when nothing about the entries changed', async () => {
    const manifest = emptyManifest();
    upsertUnavailable(manifest, '1', 'manual');

    await saveManifest(fileStore, MANIFEST_PATH, manifest);
    const first = await fs.readFile(path.join(tmpDir, MANIFEST_PATH), 'utf-8');

    const manifestAgain = emptyManifest();
    upsertUnavailable(manifestAgain, '1', 'manual');
    await saveManifest(fileStore, MANIFEST_PATH, manifestAgain);
    const second = await fs.readFile(path.join(tmpDir, MANIFEST_PATH), 'utf-8');

    expect(second).toEqual(first);
  });

  it('saveManifest updates generated_at when any entry changed', async () => {
    // Fake timers avoid millisecond-resolution flakiness between the two
    // saveManifest calls — real wall-clock ISO strings can collide when
    // both writes land in the same millisecond on a fast test run.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const manifest = emptyManifest();
      upsertUnavailable(manifest, '1', 'manual');
      await saveManifest(fileStore, MANIFEST_PATH, manifest);
      const first = JSON.parse(await fs.readFile(path.join(tmpDir, MANIFEST_PATH), 'utf-8'));

      vi.setSystemTime(new Date('2026-01-01T00:01:00.000Z'));
      const manifestChanged = emptyManifest();
      upsertUnavailable(manifestChanged, '1', 'manual');
      upsertUnavailable(manifestChanged, '2', 'no-original');
      await saveManifest(fileStore, MANIFEST_PATH, manifestChanged);
      const second = JSON.parse(await fs.readFile(path.join(tmpDir, MANIFEST_PATH), 'utf-8'));

      expect(second.generated_at).not.toBe(first.generated_at);
    } finally {
      vi.useRealTimers();
    }
  });
});
