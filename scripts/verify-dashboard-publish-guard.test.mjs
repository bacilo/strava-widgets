/**
 * Subprocess planted-fixture regression proof for the D-10(b)/D-11 HTTP
 * guard shipped in scripts/verify-dashboard-publish.mjs (Phase 24 plan
 * 24-05). Phase 19's R3-CR-01 and Phase 23's WR-06 both recorded guards
 * that stayed green when the thing they guarded was removed — a guard
 * that has never been observed failing is not evidence in this repo.
 *
 * This exercises the REAL, shipped script byte-for-byte via
 * child_process.execFileSync('node', ['scripts/verify-dashboard-publish.mjs']),
 * which is what makes it the strongest available evidence for D-11 — no
 * refactor of the verifier's internals is needed (24-RESEARCH.md Pitfall 5,
 * Option 1).
 *
 * Skipped entirely on a fresh checkout that has never run
 * `npm run build-widgets`, mirroring the script's own FATAL-if-missing
 * convention, so `npm test` does not break before the first build.
 *
 * Every planting case removes dist/widgets/__curate in a finally AND an
 * afterEach cleans it up too — dist/widgets is the REAL publish directory,
 * and an aborted run must never leave an artifact that would hard-fail the
 * developer's next `npm run build-widgets` via plan 24-01's build-time guard.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST_WIDGETS = resolve(REPO_ROOT, 'dist/widgets');
const INDEX_HTML = resolve(DIST_WIDGETS, 'index.html');
const CURATE_DIR = resolve(DIST_WIDGETS, '__curate');
const VERIFIER = resolve(REPO_ROOT, 'scripts/verify-dashboard-publish.mjs');

function runVerifier() {
  try {
    const stdout = execFileSync('node', [VERIFIER], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { status: 0, output: stdout };
  } catch (error) {
    // A non-zero exit throws; the combined stdout+stderr the process wrote
    // before exiting is still what we need to assert against.
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    return { status: typeof error.status === 'number' ? error.status : 1, output };
  }
}

function cleanupCurateDir() {
  rmSync(CURATE_DIR, { recursive: true, force: true });
}

describe.skipIf(!existsSync(INDEX_HTML))('verify-dashboard-publish.mjs: D-10(b)/D-11 planted-fixture proof', () => {
  afterEach(() => {
    cleanupCurateDir();
  });

  it('Case A (clean): asserts the three /__curate/... -> 404 lines AND the public exclusions parses line in the same run', () => {
    const { output } = runVerifier();

    expect(output).toContain('✓ GET /__curate/health -> 404');
    expect(output).toContain('✓ GET /__curate/overlay.js -> 404');
    expect(output).toContain('✓ GET /__curate/exclusions/3475726256 -> 404');
    // Non-regression row (T-24-NONREG-01): the public exclusions data file
    // must still 200-and-parse in the exact same clean run.
    expect(output).toContain('✓ /data/best-effort-exclusions.json parses with an "exclusions" array');
  });

  it('Case B (planted overlay bundle): the real, shipped verifier exits non-zero and names the overlay path', () => {
    mkdirSync(CURATE_DIR, { recursive: true });
    writeFileSync(resolve(CURATE_DIR, 'overlay.js'), 'console.log("__curate overlay leaked");', 'utf8');

    let result;
    try {
      result = runVerifier();
    } finally {
      cleanupCurateDir();
    }

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('GET /__curate/overlay.js expected 404');
  });

  it('Case C (planted health file): the real, shipped verifier exits non-zero and names the health path', () => {
    mkdirSync(CURATE_DIR, { recursive: true });
    writeFileSync(resolve(CURATE_DIR, 'health'), 'ok', 'utf8');

    let result;
    try {
      result = runVerifier();
    } finally {
      cleanupCurateDir();
    }

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('GET /__curate/health expected 404');
  });

  it('Case D (planted write-endpoint file): the real, shipped verifier exits non-zero and names the write-endpoint path', () => {
    mkdirSync(resolve(CURATE_DIR, 'exclusions'), { recursive: true });
    writeFileSync(resolve(CURATE_DIR, 'exclusions', '3475726256'), '{}', 'utf8');

    let result;
    try {
      result = runVerifier();
    } finally {
      cleanupCurateDir();
    }

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('GET /__curate/exclusions/3475726256 expected 404');
  });

  it('post-suite: no planted fixture survives (dist/widgets/__curate does not exist)', () => {
    expect(existsSync(CURATE_DIR)).toBe(false);
  });
});
