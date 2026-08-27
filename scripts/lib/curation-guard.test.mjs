/**
 * Planted-fixture regression proof for scripts/lib/curation-guard.mjs
 * (Phase 24, D-11). Phase 19's R3-CR-01 and Phase 23's WR-06 both recorded
 * guards that stayed green when the thing they guarded was deleted — a
 * guard that has never been observed failing is not evidence in this repo.
 * These fixtures plant a fake curate artifact in five distinct shapes
 * inside a throwaway mkdtemp tree (never the real dist/widgets) and assert
 * findCurationArtifacts flags each one, plus a clean-tree and
 * non-existent-directory case that must both return [].
 *
 * Also asserts, as source text over the real scripts/build-widgets.mjs,
 * that OD-2's call-site ordering holds: assertNoCurationArtifacts() is
 * called after buildDashboard() and after copyDataFiles(), never before.
 */

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CURATE_DIR_NAME, CURATE_MARKER, SCANNED_EXTENSIONS, findCurationArtifacts } from './curation-guard.mjs';

describe('findCurationArtifacts', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curation-guard-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFile(relativePath, contents) {
    const fullPath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, contents, 'utf8');
  }

  it('clean tree: returns exactly []', async () => {
    await writeFile('index.html', '<!doctype html><html><body><h1>App</h1></body></html>');
    await writeFile('assets/index-abc.js', 'console.log("app");');
    await writeFile('assets/index-abc.css', 'body { color: black; }');
    await writeFile(
      'data/best-effort-exclusions.json',
      JSON.stringify({ schemaVersion: 1, exclusions: [{ activityId: 'a1', distances: null, reason: 'bad device' }] })
    );

    const violations = findCurationArtifacts(tmpDir);
    expect(violations).toEqual([]);
  });

  it('non-existent directory: returns []', () => {
    const violations = findCurationArtifacts(path.join(tmpDir, 'does-not-exist'));
    expect(violations).toEqual([]);
  });

  it(`planted ${CURATE_DIR_NAME} directory: non-empty, a violation path contains "${CURATE_DIR_NAME}"`, async () => {
    await writeFile('index.html', '<!doctype html>');
    await writeFile(`${CURATE_DIR_NAME}/overlay.js`, 'console.log("overlay");');

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.path.includes(CURATE_DIR_NAME))).toBe(true);
  });

  it('planted marker in a .js file: non-empty (the case a data-only scan would miss)', async () => {
    await writeFile('index.html', '<!doctype html>');
    await writeFile('assets/index-abc.js', `console.log("app"); /* ${CURATE_MARKER} leaked */`);

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.path.endsWith('index-abc.js'))).toBe(true);
  });

  it('planted marker in index.html: non-empty', async () => {
    await writeFile('index.html', `<!doctype html><script src="/${CURATE_MARKER}/overlay.js"></script>`);

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.path.endsWith('index.html'))).toBe(true);
  });

  it('planted .curate-dist directory inside the tree: non-empty', async () => {
    await writeFile('index.html', '<!doctype html>');
    await writeFile('.curate-dist/overlay.js', 'console.log("overlay");');

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.path.includes('.curate-dist'))).toBe(true);
  });

  it('never catches the published exclusions data file, which must keep returning 200', async () => {
    // .json is not in SCANNED_EXTENSIONS — a reason string that literally
    // contains the marker must still yield [], because this file is
    // PUBLIC, already published, and already asserted 200-and-parses at
    // verify-dashboard-publish.mjs. Only the WRITE path is private.
    await writeFile(
      'data/best-effort-exclusions.json',
      JSON.stringify({
        schemaVersion: 1,
        exclusions: [{ activityId: 'a1', distances: null, reason: `written via ${CURATE_MARKER} overlay` }],
      })
    );

    const violations = findCurationArtifacts(tmpDir);
    expect(violations).toEqual([]);
  });

  it('SCANNED_EXTENSIONS does not include .json', () => {
    expect(SCANNED_EXTENSIONS).not.toContain('.json');
  });
});

describe('build-widgets.mjs source-structure: OD-2 call-site ordering', () => {
  const source = readFileSync(new URL('../build-widgets.mjs', import.meta.url), 'utf8');

  it('contains assertNoCurationArtifacts and a process.exit(1) inside that wrapper', () => {
    expect(source).toContain('function assertNoCurationArtifacts()');
    const wrapperStart = source.indexOf('function assertNoCurationArtifacts()');
    const wrapperEnd = source.indexOf('\n}\n', wrapperStart);
    const wrapperBody = source.slice(wrapperStart, wrapperEnd);
    expect(wrapperBody).toContain('process.exit(1)');
  });

  it('calls assertNoCurationArtifacts() after await buildDashboard() after copyDataFiles();', () => {
    const callIdx = source.lastIndexOf('assertNoCurationArtifacts()');
    const buildDashboardIdx = source.indexOf('await buildDashboard()');
    const copyDataFilesCallIdx = source.indexOf('copyDataFiles();');

    expect(callIdx).toBeGreaterThan(0);
    expect(buildDashboardIdx).toBeGreaterThan(0);
    expect(copyDataFilesCallIdx).toBeGreaterThan(0);
    expect(callIdx).toBeGreaterThan(buildDashboardIdx);
    expect(buildDashboardIdx).toBeGreaterThan(copyDataFilesCallIdx);
  });

  it('assertNoCurationArtifacts is NOT called from inside copyDataFiles()', () => {
    const funcStart = source.indexOf('function copyDataFiles()');
    const funcEnd = source.indexOf('\n}\n', funcStart);
    const funcBody = source.slice(funcStart, funcEnd);
    expect(funcBody).not.toContain('assertNoCurationArtifacts()');
  });
});
