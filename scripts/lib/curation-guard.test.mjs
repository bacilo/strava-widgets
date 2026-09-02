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
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CURATE_DIR_NAME, CURATE_MARKER, UNSCANNED_EXTENSIONS, findCurationArtifacts } from './curation-guard.mjs';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DIST_WIDGETS = path.resolve(REPO_ROOT, 'dist/widgets');
const DIST_WIDGETS_INDEX_HTML = path.resolve(DIST_WIDGETS, 'index.html');

describe('findCurationArtifacts', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curation-guard-'));
  });

  afterEach(async () => {
    // WR-14 case (c) plants a mode-000 fixture. Recursive removal can itself
    // fail on some platforms unless the mode is restored first.
    const mode000Path = path.join(tmpDir, 'wr14-secret.js');
    if (existsSync(mode000Path)) {
      try {
        chmodSync(mode000Path, 0o600);
      } catch {
        // best-effort; fall through to rm below regardless
      }
    }
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

  it('dist/widgets publishes 22 .d.ts files today: a planted marker in a .d.ts file is flagged (D-11)', async () => {
    await writeFile('index.html', '<!doctype html>');
    await writeFile(
      'shared/curate-overlay.d.ts',
      `export declare const CURATE_PREFIX: "/${CURATE_MARKER}";\nexport declare function mountOverlay(): void;\n`
    );

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.path.endsWith('curate-overlay.d.ts'))).toBe(true);
  });

  it('a stray copy of scripts/curate-server.mjs, carrying every route literal, is flagged (D-11)', async () => {
    await writeFile('index.html', '<!doctype html>');
    await writeFile(
      'assets/curate-server.mjs',
      `import http from 'node:http';\nconst PREFIX = '/${CURATE_MARKER}';\nhttp.createServer((req, res) => { res.end(PREFIX); }).listen(0);\n`
    );

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.path.endsWith('curate-server.mjs'))).toBe(true);
  });

  it('an extensionless file (scanExtension returns null, the fail-open class) is flagged (D-11)', async () => {
    await writeFile('index.html', '<!doctype html>');
    await writeFile('assets/overlay', `esbuild output marker: ${CURATE_MARKER}`);

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.path.endsWith('assets/overlay'))).toBe(true);
  });

  it('a marker-free file literally named .curate-dist (the curate overlay\'s esbuild output) is flagged by name, not content (D-11)', async () => {
    await writeFile('index.html', '<!doctype html>');
    await writeFile('.curate-dist', 'console.log("esbuild output, no marker text in this body");');

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.reason.includes('.curate-dist'))).toBe(true);
  });

  it('never catches the published exclusions data file, which must keep returning 200', async () => {
    // .json IS in UNSCANNED_EXTENSIONS (the sole, load-bearing skip) — a
    // reason string that literally contains the marker must still yield
    // [], because this file is PUBLIC, already published, and already
    // asserted 200-and-parses at verify-dashboard-publish.mjs. Only the
    // WRITE path is private.
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

  it('UNSCANNED_EXTENSIONS contains only .json — every other extension fails CLOSED', () => {
    expect(UNSCANNED_EXTENSIONS).toContain('.json');
    expect(UNSCANNED_EXTENSIONS).not.toContain('.ts');
    expect(UNSCANNED_EXTENSIONS).not.toContain('.mjs');
    expect(UNSCANNED_EXTENSIONS).not.toContain('.js');
    expect(UNSCANNED_EXTENSIONS).not.toContain('.html');
    expect(UNSCANNED_EXTENSIONS).not.toContain('.css');
    expect(UNSCANNED_EXTENSIONS).not.toContain('.map');
  });
});

describe('WR-14 — non-regular and unreadable entries are reported, never thrown', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curation-guard-wr14-'));
  });

  afterEach(async () => {
    const mode000Path = path.join(tmpDir, 'wr14-secret.js');
    if (existsSync(mode000Path)) {
      try {
        chmodSync(mode000Path, 0o600);
      } catch {
        // best-effort; fall through to rm below regardless
      }
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFile(relativePath, contents) {
    const fullPath = path.join(tmpDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, contents, 'utf8');
  }

  it('(a) dangling symlink: reported "not a regular file", never thrown (WR-14, D-10)', () => {
    const target = path.join(tmpDir, 'wr14-dangling.js');
    symlinkSync('./definitely-not-here.js', target);

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.some((v) => v.path === target && v.reason.includes('not a regular file'))).toBe(true);
  });

  it('(b) symlink to a directory: reported, and the walk never descends through the link — the real directory is still traversed exactly once (WR-14, D-10)', async () => {
    const realDir = path.join(tmpDir, 'realdir');
    mkdirSync(realDir);
    await writeFile('realdir/inner.js', `marker ${CURATE_MARKER}`);
    const linkPath = path.join(tmpDir, 'wr14-dirlink.js');
    symlinkSync(realDir, linkPath);

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.some((v) => v.path === linkPath && v.reason.includes('not a regular file'))).toBe(true);
    const innerHits = violations.filter((v) => v.path === path.join(realDir, 'inner.js'));
    expect(innerHits.length).toBe(1);
  });

  it('(c) mode-000 regular file: reported via the read try/catch, citing EACCES (WR-14) — exercises the catch, not the isFile gate', () => {
    if (process.getuid?.() === 0 || process.platform === 'win32') {
      // root defeats mode bits; win32 has no POSIX chmod semantics — skip.
      return;
    }
    const target = path.join(tmpDir, 'wr14-secret.js');
    writeFileSync(target, 'x');
    chmodSync(target, 0o000);

    const violations = findCurationArtifacts(tmpDir);
    expect(
      violations.some(
        (v) => v.path === target && v.reason.includes('could not be read for scanning') && v.reason.includes('EACCES')
      )
    ).toBe(true);
  });

  it('(d) .json-named dangling symlink: the isFile gate runs BEFORE the UNSCANNED_EXTENSIONS skip, so the .json exemption cannot smuggle a symlink past the scan (WR-14, D-10)', () => {
    const target = path.join(tmpDir, 'wr14-dangling.json');
    symlinkSync('./nowhere.json', target);

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.some((v) => v.path === target && v.reason.includes('not a regular file'))).toBe(true);
  });

  it('(e) FIFO: reported within a bounded timeout, never blocks the build (WR-14, D-10) — POST-FIX ONLY, no pre-fix RED run was taken (see SUMMARY: a pre-fix readFileSync on a FIFO blocks forever, which is the defect itself)', () => {
    if (process.platform === 'win32') return;
    const target = path.join(tmpDir, 'wr14-fifo.js');
    try {
      execFileSync('mkfifo', [target]);
    } catch {
      // mkfifo unavailable in this environment — skip.
      return;
    }

    const violations = findCurationArtifacts(tmpDir);
    expect(violations.some((v) => v.path === target && v.reason.includes('not a regular file'))).toBe(true);
  }, 5000);

  it('(g) the .json content exemption still applies to a genuine, readable .json file (WR-14 non-regression)', async () => {
    await writeFile(
      'data/best-effort-exclusions.json',
      JSON.stringify({ schemaVersion: 1, exclusions: [{ activityId: 'a1', distances: null, reason: `written via ${CURATE_MARKER} overlay` }] })
    );

    const violations = findCurationArtifacts(tmpDir);
    expect(violations).toEqual([]);
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

// Guard-rail against a future exemption removal turning a legitimately
// published artifact class (e.g. the 22 .d.ts files dist/widgets publishes
// today) into a build-breaking false positive. Skipped cleanly on a fresh
// checkout that has never run `npm run build-widgets`, mirroring the
// skipIf convention verify-dashboard-publish-guard.test.mjs uses for the
// same reason.
describe.skipIf(!existsSync(DIST_WIDGETS_INDEX_HTML))('findCurationArtifacts: whole-tree regression against the real publish directory', () => {
  it('returns [] against the real dist/widgets tree, including its published .d.ts/.js/.map/.html/.css files', () => {
    const violations = findCurationArtifacts(DIST_WIDGETS);
    expect(violations).toEqual([]);
  });
});
