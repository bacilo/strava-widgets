/**
 * Subprocess tests for scripts/exclusion-cli.mjs — the headless exclusion
 * editor behind the `exclude_activity_id` workflow_dispatch input and
 * `npm run exclude`.
 *
 * Exercises the REAL, shipped script via execFileSync, matching
 * verify-dashboard-publish-guard.test.mjs's convention: no refactor of the
 * script's internals, and the thing under test is the thing that runs in CI.
 *
 * Every case runs with `cwd` set to a throwaway fixture directory. The
 * script resolves both data/best-effort-exclusions.json and data/activities/
 * relative to cwd, so this is what keeps the REPO's real exclusions file out
 * of reach — a test that rewrote it would change published records.
 *
 * Both directions are asserted for each guard, per this repo's standing rule
 * that a guard never observed failing is not evidence: every rejection case
 * also asserts the file was left byte-identical, and the accept cases assert
 * the write actually landed.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const CLI = resolve(REPO_ROOT, 'scripts/exclusion-cli.mjs');

const SEED_DOC = {
  schemaVersion: 1,
  note: 'fixture',
  exclusions: [{ activityId: '3475726256', distances: null, reason: 'seeded' }],
};

let fixture;

/** Absolute path to the fixture's exclusions file. */
function exclusionsPath() {
  return resolve(fixture, 'data/best-effort-exclusions.json');
}

function readDoc() {
  return JSON.parse(readFileSync(exclusionsPath(), 'utf8'));
}

/** Runs the real CLI in the fixture. Returns {status, stdout, stderr}. */
function run(...args) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      cwd: fixture,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

beforeEach(() => {
  fixture = mkdtempSync(resolve(tmpdir(), 'exclusion-cli-'));
  mkdirSync(resolve(fixture, 'data/activities'), { recursive: true });
  writeFileSync(exclusionsPath(), `${JSON.stringify(SEED_DOC, null, 2)}\n`);
  // Two activities the archive knows about; ids cover both shapes the
  // dashboard's isValidActivityId accepts (bare digits and i-prefixed).
  writeFileSync(resolve(fixture, 'data/activities/3475726256.json'), '{}');
  writeFileSync(resolve(fixture, 'data/activities/i184264408.json'), '{}');
});

afterEach(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe('exclusion-cli — adding an exclusion', () => {
  it('appends an entry in the exact {activityId, distances: null, reason} shape', () => {
    const result = run('--id', 'i184264408', '--reason', '  Treadmill run.  ');

    expect(result.status).toBe(0);
    const added = readDoc().exclusions.find((e) => e.activityId === 'i184264408');
    // distances is the literal null, never [] — an empty array is silently
    // skipped by buildExclusionIndex, which would read as "excluded" while
    // excluding nothing.
    expect(added).toEqual({
      activityId: 'i184264408',
      distances: null,
      reason: 'Treadmill run.',
    });
  });

  it('carries schemaVersion and note through untouched', () => {
    run('--id', 'i184264408', '--reason', 'x');

    const doc = readDoc();
    expect(doc.schemaVersion).toBe(SEED_DOC.schemaVersion);
    expect(doc.note).toBe(SEED_DOC.note);
  });

  it('replaces in place on a second add, so the array never grows past one entry per activity', () => {
    run('--id', 'i184264408', '--reason', 'first');
    const afterFirst = readDoc().exclusions.length;

    const result = run('--id', 'i184264408', '--reason', 'second');

    expect(result.status).toBe(0);
    expect(readDoc().exclusions.length).toBe(afterFirst);
    expect(readDoc().exclusions.find((e) => e.activityId === 'i184264408').reason).toBe('second');
    expect(result.stdout).toContain('Updated exclusion reason');
  });
});

describe('exclusion-cli — removing an exclusion', () => {
  it('deletes the entry outright rather than emptying its distances', () => {
    const result = run('--id', '3475726256', '--remove');

    expect(result.status).toBe(0);
    expect(readDoc().exclusions.find((e) => e.activityId === '3475726256')).toBeUndefined();
    expect(readDoc().exclusions.length).toBe(0);
  });

  it('leaves the file byte-identical across an add-then-remove round trip', () => {
    const before = readFileSync(exclusionsPath(), 'utf8');

    run('--id', 'i184264408', '--reason', 'temporary');
    run('--id', 'i184264408', '--remove');

    expect(readFileSync(exclusionsPath(), 'utf8')).toBe(before);
  });

  it('refuses to remove an activity that is not excluded', () => {
    const before = readFileSync(exclusionsPath(), 'utf8');

    const result = run('--id', 'i184264408', '--remove');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not currently excluded');
    expect(readFileSync(exclusionsPath(), 'utf8')).toBe(before);
  });
});

describe('exclusion-cli — rejections, each leaving the file untouched', () => {
  const cases = [
    ['a malformed id', ['--id', 'abc123', '--reason', 'x'], 'not a valid activity id'],
    ['a path-traversal id', ['--id', '../../etc/passwd', '--reason', 'x'], 'not a valid activity id'],
    ['the __proto__ id', ['--id', '__proto__', '--reason', 'x'], 'not a valid activity id'],
    // The guard that matters most for a hand-typed dispatch form: an entry
    // for a nonexistent activity is inert and nothing downstream reports it.
    ['an id absent from the archive', ['--id', '9999999999', '--reason', 'x'], 'No activity 9999999999'],
    ['a missing reason', ['--id', 'i184264408'], '--reason is required'],
    ['a whitespace-only reason', ['--id', 'i184264408', '--reason', '   '], 'must be 1-2000 characters'],
    ['a reason over the length cap', ['--id', 'i184264408', '--reason', 'x'.repeat(2001)], 'must be 1-2000 characters'],
    ['no arguments at all', [], '--id is required'],
    ['an unrecognized flag', ['--id', 'i184264408', '--oops'], 'Unrecognized argument'],
    ['a value-less --reason', ['--id', 'i184264408', '--reason'], '--reason requires a value'],
  ];

  it.each(cases)('exits 1 on %s and writes nothing', (_label, args, expectedMessage) => {
    const before = readFileSync(exclusionsPath(), 'utf8');

    const result = run(...args);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expectedMessage);
    expect(readFileSync(exclusionsPath(), 'utf8')).toBe(before);
  });
});

describe('exclusion-cli — reason text is data, never code', () => {
  it('stores shell metacharacters literally', () => {
    const hostile = 'weird; $(touch /tmp/exclusion-cli-pwned) `id` "quotes" & <>';

    const result = run('--id', 'i184264408', '--reason', hostile);

    expect(result.status).toBe(0);
    expect(readDoc().exclusions.find((e) => e.activityId === 'i184264408').reason).toBe(hostile);
  });
});
