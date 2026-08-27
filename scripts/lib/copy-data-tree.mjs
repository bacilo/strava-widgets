/**
 * Side-effect-free data-copy walk, extracted from build-widgets.mjs (Phase 24)
 * so it is importable by both build-widgets.mjs and the curate server without
 * triggering build-widgets.mjs's self-executing buildAllWidgets().catch(...)
 * (that file's last line runs a full 11-widget Vite build as an import side
 * effect — see 24-RESEARCH.md Pitfall 3). This module has NO top-level side
 * effects: imports, function declarations and constant declarations only.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Copies every `.json` file from `srcDir` into `destDir`, recursing into
 * subdirectories (e.g. `data/stats/best-efforts/{id}.json`, added 18-13) so
 * a per-activity shard directory nested one level inside an already-listed
 * `dataDirs` entry is published exactly like its flat siblings, with no
 * separate `dataDirs` entry required. Returns `{ copied, skipped }` totals
 * across the whole subtree.
 */
export function copyJsonTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  let copied = 0;
  let skipped = 0;

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = resolve(srcDir, entry.name);
    const destPath = resolve(destDir, entry.name);

    if (entry.isDirectory()) {
      const nested = copyJsonTree(srcPath, destPath);
      copied += nested.copied;
      skipped += nested.skipped;
      continue;
    }

    if (!entry.name.endsWith('.json')) continue;

    // Efficiency guard: skip the copy when the destination is already
    // up to date, so local rebuilds don't recopy ~150MB every time. CI
    // always runs on a fresh checkout, so it always does the full copy.
    let shouldCopy = true;
    if (existsSync(destPath)) {
      const srcMtime = statSync(srcPath).mtimeMs;
      const destMtime = statSync(destPath).mtimeMs;
      if (destMtime >= srcMtime) {
        shouldCopy = false;
      }
    }
    if (shouldCopy) {
      copyFileSync(srcPath, destPath);
      copied++;
    } else {
      skipped++;
    }
  }

  return { copied, skipped };
}

/**
 * The subset of build-widgets.mjs's dataDirs that the curate server's
 * "Recompute records" step (D-07) re-mirrors after running
 * compute-best-efforts -> compute-dashboard-index: data/stats and
 * data/dashboard are the only two directories that chain regenerates.
 */
export const RECOMPUTE_DATA_DIRS = [
  { src: 'data/stats', dest: 'dist/widgets/data/stats' },
  { src: 'data/dashboard', dest: 'dist/widgets/data/dashboard' },
];
