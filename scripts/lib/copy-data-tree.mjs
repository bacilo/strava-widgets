/**
 * Side-effect-free data-copy walk, extracted from build-widgets.mjs (Phase 24)
 * so it is importable by both build-widgets.mjs and the curate server without
 * triggering build-widgets.mjs's self-executing buildAllWidgets().catch(...)
 * (that file's last line runs a full 11-widget Vite build as an import side
 * effect — see 24-RESEARCH.md Pitfall 3). This module has NO top-level side
 * effects: imports, function declarations and constant declarations only.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs';
import { createHash } from 'node:crypto';
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

    // Efficiency guard: skip the copy when the destination's CONTENT is
    // already up to date, so local rebuilds don't recopy ~150MB every time.
    // Measured on the primary checkout: 7,580 files / 186 MB, a full SHA-1
    // pass over that tree takes ~1.4s vs ~1.7s for an unconditional copy —
    // the guard this replaces saved under two seconds. mtime is never used
    // as a skip condition: a locally edited dist/widgets/data/ file can be
    // given any mtime, so a doctored file with a newer mtime used to
    // survive a build-widgets run that still reported success. Comparing
    // size first keeps the common (unchanged) case at stat cost; only a
    // same-size pair falls through to a full-content digest.
    let shouldCopy = true;
    if (existsSync(destPath)) {
      const srcSize = statSync(srcPath).size;
      const destSize = statSync(destPath).size;
      if (srcSize === destSize) {
        const srcDigest = createHash('sha1').update(readFileSync(srcPath)).digest('hex');
        const destDigest = createHash('sha1').update(readFileSync(destPath)).digest('hex');
        if (srcDigest === destDigest) {
          shouldCopy = false;
        } else {
          // Same size, different content: a doctored or stale destination
          // that the old mtime-only rule could have missed. Name the
          // destination so the next checkpoint plan can quote it.
          console.log(`replaced stale ${destPath}`);
        }
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
