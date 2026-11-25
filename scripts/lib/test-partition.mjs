/**
 * Fail-closed partition check for the vitest suite split (Phase 36.1, L-02).
 * Pure: checkPartition takes arrays of repo-relative POSIX paths and returns
 * a violations array. A file the guard cannot place is a violation.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const ARCHIVE_SUFFIX_RE = /\.archive\.test\.(ts|mjs)$/;

export function checkPartition({ all, logic, archive }) {
  const violations = [];
  const logicSet = new Set(logic);
  const archiveSet = new Set(archive);
  const allSet = new Set(all);

  if (archive.length === 0) {
    violations.push({ rule: 'archive-empty', detail: 'archive set matches 0 files' });
  }
  for (const file of all) {
    if (!logicSet.has(file) && !archiveSet.has(file)) {
      violations.push({ rule: 'in-neither', file, detail: 'in base set but in neither logic nor archive' });
    }
  }
  for (const file of logic) {
    if (archiveSet.has(file)) {
      violations.push({ rule: 'overlap', file, detail: 'in both logic and archive' });
    }
    if (!allSet.has(file)) {
      violations.push({ rule: 'not-in-base', file, detail: 'logic file not in base set' });
    }
    if (ARCHIVE_SUFFIX_RE.test(file)) {
      violations.push({ rule: 'suffix', file, detail: 'logic file has the archive suffix' });
    }
  }
  for (const file of archive) {
    if (!allSet.has(file)) {
      violations.push({ rule: 'not-in-base', file, detail: 'archive file not in base set' });
    }
    if (!ARCHIVE_SUFFIX_RE.test(file)) {
      violations.push({ rule: 'suffix', file, detail: 'archive file lacks the archive suffix' });
    }
  }
  return violations;
}

export function listFiles(configPath, repoRoot) {
  const out = execFileSync(
    'npx',
    ['vitest', 'list', '--filesOnly', '--json', ...(configPath ? ['--config', configPath] : [])],
    { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  );
  const start = out.indexOf('[');
  const parsed = JSON.parse(out.slice(start));
  return parsed
    .map((e) => path.relative(repoRoot, e.file).split(path.sep).join('/'))
    .sort();
}
