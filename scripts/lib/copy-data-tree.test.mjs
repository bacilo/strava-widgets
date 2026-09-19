/**
 * Planted-fixture regression proof for scripts/lib/copy-data-tree.mjs.
 * Plants a same-size, doctored/newer-mtime destination file inside a
 * throwaway mkdtemp tree (never the real dist/widgets/data or data/) and
 * asserts copyJsonTree replaces it and logs the replacement — the exact
 * "staged build browser cache trap" this project's own memory records:
 * build-widgets can silently no-op on a locally edited dist/ file and still
 * report success, so a checkpoint can be run against bytes nobody built.
 */

import fs from 'node:fs/promises';
import { statSync, utimesSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copyJsonTree } from './copy-data-tree.mjs';

describe('copyJsonTree', () => {
  let tmpDir;
  let srcDir;
  let destDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'copy-data-tree-'));
    srcDir = path.join(tmpDir, 'src');
    destDir = path.join(tmpDir, 'dest');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(destDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('stale: a same-size, different-content, newer-mtime destination is replaced and logged', async () => {
    const srcPath = path.join(srcDir, 'shard.json');
    const destPath = path.join(destDir, 'shard.json');

    // Substitute characters rather than add/remove them, so the byte length
    // is identical between source and doctored destination.
    const srcContent = '{"activityId":"1111111111","value":42}';
    const doctoredContent = '{"activityId":"9999999999","value":42}';
    expect(doctoredContent.length).toBe(srcContent.length);

    await fs.writeFile(srcPath, srcContent, 'utf8');
    await fs.writeFile(destPath, doctoredContent, 'utf8');

    // Assert the premise: same size, so the test isn't silently testing the
    // wrong condition.
    const srcSize = statSync(srcPath).size;
    const destSize = statSync(destPath).size;
    expect(destSize, 'test premise: source and doctored destination must be the same size').toBe(
      srcSize
    );

    // Force the destination's mtime strictly newer than the source's, so the
    // OLD mtime-skip rule's skip condition (destMtime >= srcMtime) is
    // provably satisfied.
    const now = Date.now() / 1000;
    utimesSync(srcPath, now - 10, now - 10);
    utimesSync(destPath, now, now);
    expect(
      statSync(destPath).mtimeMs,
      'test premise: doctored destination mtime must be strictly newer than source'
    ).toBeGreaterThan(statSync(srcPath).mtimeMs);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let result;
    let loggedDestPath;
    try {
      result = copyJsonTree(srcDir, destDir);
      // Read the spy's recorded calls BEFORE mockRestore(): in this vitest
      // version, mockRestore() also clears .mock.calls (restore = reset +
      // restore original implementation), so checking after restore always
      // reads an empty array.
      loggedDestPath = logSpy.mock.calls.some((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes(destPath))
      );
    } finally {
      logSpy.mockRestore();
    }

    const destBytesAfter = await fs.readFile(destPath, 'utf8');
    expect(destBytesAfter).toBe(srcContent);
    expect(result.copied).toBeGreaterThanOrEqual(1);
    expect(loggedDestPath, 'expected a log line naming the destination path').toBe(true);
  });

  it('skip: a byte-identical destination is skipped and counted', async () => {
    const srcPath = path.join(srcDir, 'shard.json');
    const destPath = path.join(destDir, 'shard.json');
    const content = '{"activityId":"1111111111","value":42}';

    await fs.writeFile(srcPath, content, 'utf8');
    await fs.writeFile(destPath, content, 'utf8');

    const result = copyJsonTree(srcDir, destDir);

    expect(result.skipped).toBeGreaterThanOrEqual(1);
    const destBytesAfter = await fs.readFile(destPath, 'utf8');
    expect(destBytesAfter).toBe(content);
  });

  it('different-size destination is copied', async () => {
    const srcPath = path.join(srcDir, 'shard.json');
    const destPath = path.join(destDir, 'shard.json');

    await fs.writeFile(srcPath, '{"value":42}', 'utf8');
    await fs.writeFile(destPath, '{"value":4}', 'utf8');
    // Force source strictly newer than destination so this case is decided
    // by size alone, independent of whichever staleness rule (old mtime or
    // new size-then-digest) is currently implemented.
    const now = Date.now() / 1000;
    utimesSync(destPath, now - 10, now - 10);
    utimesSync(srcPath, now, now);

    const result = copyJsonTree(srcDir, destDir);

    const destBytesAfter = await fs.readFile(destPath, 'utf8');
    expect(destBytesAfter).toBe('{"value":42}');
    expect(result.copied).toBeGreaterThanOrEqual(1);
  });

  it('missing destination is copied', async () => {
    const srcPath = path.join(srcDir, 'shard.json');
    const destPath = path.join(destDir, 'shard.json');

    await fs.writeFile(srcPath, '{"value":42}', 'utf8');

    const result = copyJsonTree(srcDir, destDir);

    const destBytesAfter = await fs.readFile(destPath, 'utf8');
    expect(destBytesAfter).toBe('{"value":42}');
    expect(result.copied).toBeGreaterThanOrEqual(1);
  });

  it('a non-.json sibling is ignored', async () => {
    await fs.writeFile(path.join(srcDir, 'notes.txt'), 'hello', 'utf8');

    const result = copyJsonTree(srcDir, destDir);

    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(0);
    await expect(fs.access(path.join(destDir, 'notes.txt'))).rejects.toThrow();
  });

  it('a nested subdirectory recurses and rolls its counts up into the parent totals', async () => {
    const nestedSrcDir = path.join(srcDir, 'nested');
    await fs.mkdir(nestedSrcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, 'top.json'), '{"a":1}', 'utf8');
    await fs.writeFile(path.join(nestedSrcDir, 'child.json'), '{"b":2}', 'utf8');

    const result = copyJsonTree(srcDir, destDir);

    expect(result.copied).toBe(2);
    const nestedDestBytes = await fs.readFile(path.join(destDir, 'nested', 'child.json'), 'utf8');
    expect(nestedDestBytes).toBe('{"b":2}');
  });
});
