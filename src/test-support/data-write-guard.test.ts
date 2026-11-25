import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { diffDataTree, snapshotDataTree } from './data-write-guard.js';

function git(cwd: string, args: string[]) {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
}

describe('data-write-guard (temp git repo only)', () => {
  let repo: string;

  const write = (rel: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), body);
  };
  const snap = () => snapshotDataTree({ cwd: repo });

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'write-guard-'));
    git(repo, ['init', '-q']);
    write('data/clean.json', 'clean');
    write('data/dirty.json', 'dirty-0');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-q', '-m', 'init']);
    // The CI shape: data/ is already dirty before the test file runs.
    write('data/dirty.json', 'dirty-1');
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('CAN-PASS: a pre-existing dirty file with no further change diffs to []', () => {
    const before = snap();
    expect(Object.keys(before.hashes)).toEqual(['data/dirty.json']);
    expect(diffDataTree(before, snap())).toEqual([]);
  });

  it('CAN-FAIL: modifying a clean tracked file is reported', () => {
    const before = snap();
    write('data/clean.json', 'changed');
    expect(diffDataTree(before, snap())).toEqual(['data/clean.json']);
  });

  it('CAN-FAIL: a second write to an already-dirty file is reported', () => {
    const before = snap();
    write('data/dirty.json', 'dirty-2');
    expect(before.status).toBe(snap().status); // status string alone cannot see it
    expect(diffDataTree(before, snap())).toEqual(['data/dirty.json']);
  });

  it('CAN-FAIL: a new untracked file is reported', () => {
    const before = snap();
    write('data/new/created.json', 'x');
    expect(diffDataTree(before, snap())).toEqual(['data/new/created.json']);
  });

  it('CAN-FAIL: deleting an already-dirty file is reported', () => {
    const before = snap();
    fs.rmSync(path.join(repo, 'data/dirty.json'));
    expect(diffDataTree(before, snap())).toEqual(['data/dirty.json']);
  });
});
