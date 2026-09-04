/**
 * Subprocess planted-fixture regression proof for the six CI-02 by-name
 * publish assertions added to scripts/verify-dashboard-publish.mjs (Phase 25
 * plan 25-03, decisions D-09/D-10/D-11):
 *   weekly-distance.json, monthly-stats.json, yearly-stats.json,
 *   year-over-year.json, best-efforts.json, and a runtime-derived sample of
 *   per-activity best-efforts/{id}.json shards.
 *
 * Those six blocks previously had NO committed regression guard — their only
 * evidence was a one-off, uncommitted scratch RED cycle transcribed into
 * 25-VALIDATION.md's D-11 log. Per this repo's own house rule (Phase 19
 * R3-CR-01, Phase 23 WR-06, and this file's sibling
 * verify-dashboard-publish-guard.test.mjs): "a guard that has never been
 * observed failing is not evidence in this repo." If any of the six blocks
 * were deleted or weakened, `npm test` would have stayed green.
 *
 * This exercises the REAL, shipped script byte-for-byte via
 * child_process.execFileSync('node', ['scripts/verify-dashboard-publish.mjs']),
 * exactly like verify-dashboard-publish-guard.test.mjs — no refactor of the
 * verifier's internals.
 *
 * SAFETY: the verifier resolves `ROOT = resolve(process.cwd(), 'dist/widgets')`
 * with no override, and dist/widgets is 185 MB (143 MB of it data/streams) —
 * too large to copy per case, and the real (gitignored) publish tree must
 * NEVER be mutated, not even transiently. So every case here builds a SHADOW
 * TREE in a fresh mkdtemp() directory: every top-level entry of the real
 * dist/widgets is symlinked in verbatim, except data/, whose entries are
 * symlinked in verbatim except stats/, whose entries are symlinked in
 * verbatim except the single document under test for that case — which gets
 * either a real (broken) file in its place, or, for the shard case, is
 * omitted entirely to produce a 404. The verifier's existsSync/statSync/
 * readFileSync calls all follow symlinks transparently, so a symlinked entry
 * behaves exactly like the real file to the script under test. The verifier
 * is then run with `cwd` pointed at the shadow tree's root (the mkdtemp
 * directory), never at REPO_ROOT — this is what makes it safe.
 *
 * Skipped entirely on a fresh checkout that has never run
 * `npm run build-widgets`, mirroring verify-dashboard-publish-guard.test.mjs's
 * own skip convention.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const VERIFIER = path.resolve(REPO_ROOT, 'scripts/verify-dashboard-publish.mjs');

const REAL_WIDGETS = path.resolve(REPO_ROOT, 'dist/widgets');
const REAL_INDEX_HTML = path.resolve(REAL_WIDGETS, 'index.html');
const REAL_DATA = path.resolve(REAL_WIDGETS, 'data');
const REAL_STATS = path.resolve(REAL_DATA, 'stats');
const REAL_BEST_EFFORTS_DIR = path.resolve(REAL_STATS, 'best-efforts');
const REAL_INDEX_JSON = path.resolve(REAL_DATA, 'dashboard/index.json');

function runVerifier(cwd) {
  try {
    const stdout = execFileSync('node', [VERIFIER], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { status: 0, output: stdout };
  } catch (error) {
    // A non-zero exit throws; the combined stdout+stderr the process wrote
    // before exiting is still what we need to assert against.
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    return { status: typeof error.status === 'number' ? error.status : 1, output };
  }
}

function symlinkEntry(realPath, shadowPath) {
  const isDir = statSync(realPath).isDirectory();
  symlinkSync(realPath, shadowPath, isDir ? 'dir' : 'file');
}

/**
 * Build a fresh shadow tree under a throwaway mkdtemp() directory. Returns
 * the mkdtemp root (the directory that should become `cwd` for the verifier,
 * since the verifier resolves ROOT as `<cwd>/dist/widgets`).
 *
 * - `brokenStatsFile: { name, content }` writes a REAL file with `content` at
 *   `data/stats/<name>` instead of symlinking the real one (the truncated/
 *   empty-document cases).
 * - `omitShardId` shadows `data/stats/best-efforts/` entry-by-entry, leaving
 *   out `<omitShardId>.json` entirely, producing a genuine 404 (the shard
 *   case).
 * At most one of the two is set per call.
 */
function buildShadowTree({ brokenStatsFile = null, omitShardId = null } = {}) {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'verify-dashboard-stats-'));
  const shadowWidgets = path.join(tmpRoot, 'dist', 'widgets');
  mkdirSync(shadowWidgets, { recursive: true });

  for (const entry of readdirSync(REAL_WIDGETS)) {
    if (entry === 'data') continue;
    symlinkEntry(path.join(REAL_WIDGETS, entry), path.join(shadowWidgets, entry));
  }

  const shadowData = path.join(shadowWidgets, 'data');
  mkdirSync(shadowData);
  for (const entry of readdirSync(REAL_DATA)) {
    if (entry === 'stats') continue;
    symlinkEntry(path.join(REAL_DATA, entry), path.join(shadowData, entry));
  }

  const shadowStats = path.join(shadowData, 'stats');
  mkdirSync(shadowStats);
  for (const entry of readdirSync(REAL_STATS)) {
    if (entry === 'best-efforts') {
      const shadowBestEfforts = path.join(shadowStats, 'best-efforts');
      if (omitShardId) {
        mkdirSync(shadowBestEfforts);
        for (const shardFile of readdirSync(REAL_BEST_EFFORTS_DIR)) {
          if (shardFile === `${omitShardId}.json`) continue; // omitted -> 404
          symlinkEntry(path.join(REAL_BEST_EFFORTS_DIR, shardFile), path.join(shadowBestEfforts, shardFile));
        }
      } else {
        symlinkEntry(REAL_BEST_EFFORTS_DIR, shadowBestEfforts);
      }
      continue;
    }
    if (brokenStatsFile && entry === brokenStatsFile.name) {
      writeFileSync(path.join(shadowStats, entry), brokenStatsFile.content, 'utf8');
      continue;
    }
    symlinkEntry(path.join(REAL_STATS, entry), path.join(shadowStats, entry));
  }

  return tmpRoot;
}

function withShadowTree(options, fn) {
  const tmpRoot = buildShadowTree(options);
  try {
    return fn(tmpRoot);
  } finally {
    // Only ever removes entries inside the mkdtemp tree. Symlinked entries
    // are unlinked (their target — the real dist/widgets — is untouched);
    // this is standard rm -rf / fs.rmSync semantics for symlinks.
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// D-10: the shard sample is derived AT RUNTIME the same way
// verify-dashboard-publish.mjs itself derives it (lines ~555-565) — no
// pinned id anywhere in this test file.
function deriveShardCandidateIds() {
  const indexDoc = JSON.parse(readFileSync(REAL_INDEX_JSON, 'utf8'));
  const shardCandidates = indexDoc.activities.filter((row) => row.streams?.available === true);
  return [
    ...new Set([
      shardCandidates[0].id,
      shardCandidates[Math.floor(shardCandidates.length / 2)].id,
      shardCandidates[shardCandidates.length - 1].id,
    ]),
  ];
}

function parseTally(output) {
  const match = output.match(/\n(\d+) check\(s\) passed, (\d+) failure\(s\)\./);
  return match ? { checks: Number(match[1]), failures: Number(match[2]) } : null;
}

describe.skipIf(!existsSync(REAL_INDEX_HTML))(
  'verify-dashboard-publish.mjs: CI-02 by-name stats assertions (D-09/D-10/D-11)',
  () => {
    const shardIds = deriveShardCandidateIds();
    const shardIdToBreak = shardIds[0];

    // Snapshot two real files/facts up front to prove non-mutation at the end.
    const realWeeklyDistanceBefore = readFileSync(path.join(REAL_STATS, 'weekly-distance.json'), 'utf8');
    const realShardPathToBreak = path.join(REAL_BEST_EFFORTS_DIR, `${shardIdToBreak}.json`);
    const realShardExistedBefore = existsSync(realShardPathToBreak);

    const cases = [
      {
        label: 'weekly-distance.json',
        brokenStatsFile: { name: 'weekly-distance.json', content: '[]' },
        expectedFailure: '✗ /data/stats/weekly-distance.json expected a non-empty array, got an array of length 0',
        expectedOk: '✓ /data/stats/weekly-distance.json parses with a non-empty array',
      },
      {
        label: 'monthly-stats.json',
        brokenStatsFile: { name: 'monthly-stats.json', content: '' },
        expectedFailure: '✗ GET /data/stats/monthly-stats.json returned 200 but an empty body',
        expectedOk: '✓ /data/stats/monthly-stats.json parses with a non-empty array',
      },
      {
        label: 'yearly-stats.json',
        brokenStatsFile: { name: 'yearly-stats.json', content: '[]' },
        expectedFailure: '✗ /data/stats/yearly-stats.json expected a non-empty array, got an array of length 0',
        expectedOk: '✓ /data/stats/yearly-stats.json parses with a non-empty array',
      },
      {
        label: 'year-over-year.json',
        brokenStatsFile: {
          name: 'year-over-year.json',
          content: JSON.stringify(
            JSON.parse(readFileSync(path.join(REAL_STATS, 'year-over-year.json'), 'utf8')).slice(0, 11)
          ),
        },
        expectedFailure:
          '✗ /data/stats/year-over-year.json expected an array of exactly 12 entries (one per calendar month, ' +
          'per compute-advanced-stats.ts:104), got an array of length 11',
        expectedOk: '✓ /data/stats/year-over-year.json parses with exactly 12 entries',
      },
      {
        label: 'best-efforts.json',
        brokenStatsFile: {
          name: 'best-efforts.json',
          content: '{"schemaVersion":1,"activities":{},"rankings":{}}',
        },
        expectedFailure:
          '✗ /data/stats/best-efforts.json "activities" expected a non-null object with at least one key, got an object with 0 keys',
        expectedOk: '✓ /data/stats/best-efforts.json parses with schemaVersion 1',
      },
      {
        label: `best-efforts/${shardIdToBreak}.json shard`,
        omitShardId: shardIdToBreak,
        expectedFailure: `✗ GET /data/stats/best-efforts/${shardIdToBreak}.json expected 200, got 404`,
        expectedOk: `✓ /data/stats/best-efforts/${shardIdToBreak}.json parses with activityId "${shardIdToBreak}"`,
      },
    ];

    for (const testCase of cases) {
      it(`BROKEN — ${testCase.label}: verifier exits non-zero and names the document`, () => {
        withShadowTree(
          { brokenStatsFile: testCase.brokenStatsFile ?? null, omitShardId: testCase.omitShardId ?? null },
          (tmpRoot) => {
            const result = runVerifier(tmpRoot);
            expect(result.status).not.toBe(0);
            expect(result.output).toContain(testCase.expectedFailure);
          }
        );
      });
    }

    it('CONTROL — the same shadow tree with nothing broken produces every document\'s own ok() line and no failure naming any of them', () => {
      withShadowTree({}, (tmpRoot) => {
        const result = runVerifier(tmpRoot);
        expect(result.status).toBe(0);

        for (const testCase of cases) {
          expect(result.output).toContain(testCase.expectedOk);
          expect(result.output).not.toContain(testCase.expectedFailure);
        }

        const shadowTally = parseTally(result.output);
        expect(shadowTally).not.toBeNull();
        expect(shadowTally.failures).toBe(0);

        // Cross-check the shadow tree's check count against a real run
        // (read-only, no mutation — the same invocation style
        // verify-dashboard-publish-guard.test.mjs already uses with
        // cwd: REPO_ROOT) to prove the shadow tree is not missing anything
        // the real tree would have checked.
        const realResult = runVerifier(REPO_ROOT);
        expect(realResult.status).toBe(0);
        const realTally = parseTally(realResult.output);
        expect(realTally).not.toBeNull();
        expect(shadowTally.checks).toBe(realTally.checks);
      });
    });

    it('never mutates the real dist/widgets tree', () => {
      const realWeeklyDistanceAfter = readFileSync(path.join(REAL_STATS, 'weekly-distance.json'), 'utf8');
      expect(realWeeklyDistanceAfter).toBe(realWeeklyDistanceBefore);
      expect(existsSync(realShardPathToBreak)).toBe(realShardExistedBefore);
    });
  }
);
