/**
 * Tests for scripts/archive-failure-summary.mjs (Phase 36.1). Synthetic JSON
 * only; the missing-file case uses a path under a fresh temp dir.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { summarizeFailures } from './archive-failure-summary.mjs';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);

const report = (assertionResults) =>
  JSON.stringify({ testResults: [{ name: '/r/a.archive.test.ts', assertionResults }] });

describe('summarizeFailures', () => {
  it('lists only failed assertions as file > fullName', () => {
    const out = summarizeFailures(report([
      { status: 'failed', fullName: 'suite flags EXACTLY the count', title: 'x' },
      { status: 'passed', fullName: 'suite fine', title: 'y' },
    ]));
    expect(out).toBe('- /r/a.archive.test.ts > suite flags EXACTLY the count');
  });

  it('reports no failures on an all-pass report', () => {
    expect(summarizeFailures(report([{ status: 'passed', fullName: 'a' }])))
      .toBe('No failing assertions found in the JSON report');
  });

  it('never throws on invalid JSON', () => {
    expect(summarizeFailures('{not json')).toMatch(/^JSON report unavailable/);
  });

  it('never throws on a report without testResults', () => {
    expect(summarizeFailures('{}')).toMatch(/^JSON report unavailable/);
  });

  it('CLI exits 0 and says unavailable for a missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'afs-'));
    try {
      const out = execFileSync('node', [join(REPO_ROOT, 'scripts/archive-failure-summary.mjs'), join(dir, 'nope.json')], { encoding: 'utf8' });
      expect(out).toMatch(/^JSON report unavailable/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
