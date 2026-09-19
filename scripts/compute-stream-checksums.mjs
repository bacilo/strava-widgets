/**
 * D-17 `data/streams/` immutability manifest — generator and the sha256 gate `npm test` runs
 * every night against the committed archive.
 *
 * The manifest lives at `data/stream-checksums.json`, a SIBLING of `data/streams/` and
 * deliberately NOT inside it. `data/streams/manifest.json` is an unrelated stream-AVAILABILITY
 * index (generated_at, totals) that the backfill and the nightly intervals.icu sync both rewrite
 * on every run; it is not itself a per-activity stream. Hashing that index, or writing this
 * checksum manifest next to it inside `data/streams/`, would fail every single night — the exact
 * Phase 27 G-01/G-03 glob defect (a naive `f.endsWith('.json')` filter counting `manifest.json`
 * as a stream). This module imports `isStreamFile` from `./lib/stream-files.mjs` — the one owner
 * of that filter — and never re-implements a bare `.endsWith('.json')` glob.
 *
 * Exported pure functions: `hashFile`, `listStreamFilenames`, `buildManifest`,
 * `appendToManifest`, `checkManifest`. `main()` sits behind the self-execution guard below so
 * `compute-stream-checksums.test.mjs` can import the pure functions without a real file read (or
 * write) happening as an import-time side effect.
 *
 * Append-only, never overwrite (T-32-03): `appendToManifest` adds only filenames absent from the
 * existing manifest. If any EXISTING entry's live digest no longer matches — changed OR deleted —
 * it refuses outright (`ok: false`, every offending file named) and writes nothing. New stream
 * files the nightly sync legitimately appends are always tolerated, both here and by
 * `checkManifest`, which iterates only the manifest's own keys and is therefore blind to
 * unlisted new files by construction (T-32-02).
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { isStreamFile } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const MANIFEST_PATH = join(ROOT_DIR, 'data/stream-checksums.json');

/** Lowercase hex sha256 of a file's raw bytes. */
export function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Every genuine stream filename in `dir`, sorted ascending. Never includes `manifest.json` —
 * `isStreamFile` is the one owner of that exclusion (see module docblock).
 */
export function listStreamFilenames(dir) {
  return readdirSync(dir).filter(isStreamFile).sort();
}

/**
 * A fresh manifest over exactly `filenames` (re-sorted here so caller order never matters).
 * Deliberately no timestamp field: re-running over an unchanged tree must produce byte-identical
 * JSON (idempotence, Pitfall 13's standing discipline).
 */
export function buildManifest(dir, filenames) {
  const files = {};
  for (const filename of [...filenames].sort()) {
    files[filename] = hashFile(join(dir, filename));
  }
  return { schemaVersion: 1, algorithm: 'sha256', files };
}

/**
 * Adds only filenames absent from `existing.files`. If any EXISTING key's live digest differs —
 * or the file no longer exists at all — this refuses and writes nothing, naming every offending
 * file. On success, returns the merged manifest (existing digests untouched, byte-for-byte) plus
 * the list of newly-added filenames.
 */
export function appendToManifest(existing, dir, liveFilenames) {
  const existingFiles = existing && existing.files ? existing.files : {};
  const mismatches = [];
  for (const [file, expected] of Object.entries(existingFiles)) {
    let actual = null;
    try {
      actual = hashFile(join(dir, file));
    } catch {
      // File no longer exists (or is unreadable) — reported as a mismatch (actual: null) rather
      // than thrown, so the caller sees every offending file at once, and this never overwrites.
    }
    if (actual !== expected) {
      mismatches.push({ file, expected, actual });
    }
  }
  if (mismatches.length > 0) {
    return { ok: false, mismatches };
  }

  const files = { ...existingFiles };
  const added = [];
  for (const file of liveFilenames) {
    if (!(file in files)) {
      files[file] = hashFile(join(dir, file));
      added.push(file);
    }
  }
  const sortedFiles = {};
  for (const key of Object.keys(files).sort()) {
    sortedFiles[key] = files[key];
  }
  return {
    ok: true,
    manifest: { schemaVersion: 1, algorithm: 'sha256', files: sortedFiles },
    added: added.sort(),
  };
}

/**
 * Iterates ONLY `manifest.files` keys — an unlisted new file in `dir` is structurally invisible
 * to it (tolerated by construction, T-32-02). Never throws: an unreadable/missing file becomes a
 * `missing` entry, and a manifest with no `files` object returns `ok: false` with a `reason`.
 */
export function checkManifest(manifest, dir) {
  if (!manifest || typeof manifest.files !== 'object' || manifest.files === null) {
    return { ok: false, mismatches: [], missing: [], reason: 'manifest has no files object' };
  }
  const mismatches = [];
  const missing = [];
  for (const [file, expected] of Object.entries(manifest.files)) {
    let actual;
    try {
      actual = hashFile(join(dir, file));
    } catch {
      missing.push(file);
      continue;
    }
    if (actual !== expected) {
      mismatches.push({ file, expected, actual });
    }
  }
  return { ok: mismatches.length === 0 && missing.length === 0, mismatches, missing };
}

function main() {
  const liveFilenames = listStreamFilenames(STREAMS_DIR);

  if (!existsSync(MANIFEST_PATH)) {
    const manifest = buildManifest(STREAMS_DIR, liveFilenames);
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`added ${liveFilenames.length}`);
    return;
  }

  const existing = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const result = appendToManifest(existing, STREAMS_DIR, liveFilenames);
  if (!result.ok) {
    console.error('FAIL: existing manifest entries do not match the live stream files:');
    for (const { file, expected, actual } of result.mismatches) {
      console.error(`  ${file}: expected ${expected}, actual ${actual}`);
    }
    process.exitCode = 1;
    return;
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(result.manifest, null, 2) + '\n');
  console.log(`added ${result.added.length}`);
}

// Self-execution guard, mirroring compute-pr-ceiling-recount.mjs: main() runs only under direct
// invocation, so compute-stream-checksums.test.mjs can import the pure functions above without
// triggering a real file read/write as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
