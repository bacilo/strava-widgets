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
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST_WIDGETS = resolve(REPO_ROOT, 'dist/widgets');
const INDEX_HTML = resolve(DIST_WIDGETS, 'index.html');
const INDEX_JSON = resolve(DIST_WIDGETS, 'data/dashboard/index.json');
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

  it('Case A (clean): asserts the five /__curate/... -> 404 lines AND the public exclusions parses line in the same run', () => {
    const { output } = runVerifier();

    expect(output).toContain('✓ GET /__curate/health -> 404');
    expect(output).toContain('✓ GET /__curate/overlay.js -> 404');
    expect(output).toContain('✓ GET /__curate/exclusions/3475726256 -> 404');
    // Phase 29, D-17: the curation review queue's page and bundle routes.
    expect(output).toContain('✓ GET /__curate/queue -> 404');
    expect(output).toContain('✓ GET /__curate/queue.js -> 404');
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

  it('Case E (planted queue page): the real, shipped verifier exits non-zero and names the queue page path', () => {
    mkdirSync(CURATE_DIR, { recursive: true });
    writeFileSync(
      resolve(CURATE_DIR, 'queue'),
      '<!doctype html><script src="/__curate/queue.js"></script>',
      'utf8'
    );

    let result;
    try {
      result = runVerifier();
    } finally {
      cleanupCurateDir();
    }

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('GET /__curate/queue expected 404');
  });

  it('Case F (planted queue bundle): the real, shipped verifier exits non-zero and names the queue bundle path', () => {
    mkdirSync(CURATE_DIR, { recursive: true });
    writeFileSync(resolve(CURATE_DIR, 'queue.js'), 'console.log("__curate queue leaked");', 'utf8');

    let result;
    try {
      result = runVerifier();
    } finally {
      cleanupCurateDir();
    }

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('GET /__curate/queue.js expected 404');
  });

  it('post-suite: no planted fixture survives (dist/widgets/__curate does not exist)', () => {
    expect(existsSync(CURATE_DIR)).toBe(false);
  });
});

/**
 * T-30-11 / ELEV-02 / 30-03-T3: the publish gate's QUALITY_SUB_KEYS check must
 * fail a partial elevation rollout (one row missing quality.elevation), not
 * just pass a total one. The 30-03-SUMMARY.md record of this failing is a
 * one-off manual run; this is its automated, planted-fixture proof, mirroring
 * the Case B-F pattern above but mutating the real served index.json (the
 * same file both the script's local readFileSync and its HTTP-served fetch
 * resolve to, since the server root is dist/widgets) instead of __curate.
 *
 * The mutated copy is written and restored byte-for-byte in a finally, with
 * a sha256 digest asserted equal before/after so an aborted run can never
 * leave dist/widgets/data/dashboard/index.json corrupted for the next build.
 */
describe.skipIf(!existsSync(INDEX_HTML))('verify-dashboard-publish.mjs: T-30-11/ELEV-02 partial elevation rollout (30-03-T3)', () => {
  it('Case G (clean): a full elevation rollout on every row exits 0', () => {
    const result = runVerifier();

    expect(result.status).toBe(0);
  });

  it('Case G (planted partial rollout): deleting quality.elevation from exactly one row exits non-zero and names that row', () => {
    const originalBytes = readFileSync(INDEX_JSON, 'utf8');
    const originalDigest = createHash('sha256').update(originalBytes).digest('hex');

    const doc = JSON.parse(originalBytes);
    const targetRow = doc.activities[0];
    delete targetRow.quality.elevation;

    let result;
    try {
      writeFileSync(INDEX_JSON, JSON.stringify(doc), 'utf8');
      result = runVerifier();
    } finally {
      writeFileSync(INDEX_JSON, originalBytes, 'utf8');
    }

    const restoredDigest = createHash('sha256').update(readFileSync(INDEX_JSON, 'utf8')).digest('hex');
    expect(restoredDigest).toBe(originalDigest);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      `✗ /data/dashboard/index.json activity ${targetRow.id} is missing "quality" or one of its six named sub-keys — a partial rollout, not a total one (T-27-14)`
    );
  });
});
