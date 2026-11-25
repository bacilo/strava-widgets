import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Snapshot-relative no-write guard.
 *
 * Never assert that `git status -- data` is empty: CI legitimately dirties
 * tracked data/geo files before the test step runs. Instead, snapshot the
 * dirty set AND a content hash of every listed path before a test file runs,
 * and diff against a second snapshot afterwards. Hashing catches a second
 * write to a path that was already dirty, which a status string cannot see.
 */

export type DataTreeSnapshot = { status: string; hashes: Record<string, string> };

export function snapshotDataTree(opts: { cwd?: string; pathspec?: string } = {}): DataTreeSnapshot {
  const cwd = opts.cwd ?? process.cwd();
  const pathspec = opts.pathspec ?? 'data';
  const status = execFileSync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', pathspec],
    { cwd, encoding: 'utf-8' }
  );

  const hashes: Record<string, string> = {};
  const fields = status.split('\0').filter(f => f.length > 0);
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i];
    const code = entry.slice(0, 2);
    const file = entry.slice(3);
    // A rename/copy entry is followed by a second field holding the origin path.
    if (code.includes('R') || code.includes('C')) i++;
    const full = path.join(cwd, file);
    try {
      hashes[file] = createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    } catch {
      hashes[file] = '<absent>';
    }
  }
  return { status, hashes };
}

export function diffDataTree(before: DataTreeSnapshot, after: DataTreeSnapshot): string[] {
  const paths = new Set([...Object.keys(before.hashes), ...Object.keys(after.hashes)]);
  const changed: string[] = [];
  for (const p of paths) {
    if (before.hashes[p] !== after.hashes[p]) changed.push(p);
  }
  return changed.sort();
}
