/**
 * Pure, importable curation-artifact scanner for local curation mode
 * (Phase 24, D-10(a)/D-11). Mirrors build-widgets.mjs's assertNoPrivateArtifacts
 * walk-and-scan shape, but with three deliberate deviations:
 *
 *   1. This function RETURNS an array of violations. It NEVER calls
 *      process.exit, console.error, or throws on a violation — the
 *      exiting wrapper lives at the call site (build-widgets.mjs's
 *      assertNoCurationArtifacts). This is what makes D-11's
 *      planted-fixture test able to observe this module red: a pure
 *      function can be called directly against a fixture directory and
 *      its return value asserted, with no process-exit side effect to
 *      work around.
 *   2. It scans the WHOLE publishDir tree (e.g. the whole dist/widgets
 *      tree), not just a `data` subdirectory — a curation-artifact leak's
 *      most likely vector is the JS/HTML side (an accidental Vite/esbuild
 *      input, or a stray copy of the overlay bundle), which only exists
 *      after buildPages()/buildDashboard() run (OD-2's amendment to
 *      D-10(a)'s literal call-site wording).
 *   3. Content scanning applies to EVERY file unless its extension appears
 *      in UNSCANNED_EXTENSIONS — an unanticipated extension therefore
 *      fails CLOSED, rather than being silently skipped. `.json` is the
 *      single exemption, and it is load-bearing: it is what guarantees
 *      this guard can never catch
 *      dist/widgets/data/best-effort-exclusions.json, which is PUBLIC,
 *      already published (build-widgets.mjs's dataFiles list), already
 *      asserted 200-and-parses at verify-dashboard-publish.mjs's
 *      exclusions check, and fetched at runtime by detail.ts and
 *      records.ts — a developer-written reason string in it may
 *      legitimately contain the marker text. The previous allowlist form
 *      (`SCANNED_EXTENSIONS = ['.js', '.html', '.css', '.map']`) silently
 *      exempted every other extension, including `.ts`/`.d.ts`/`.mjs` and
 *      extensionless files, while dist/widgets publishes 22 `.d.ts` files
 *      today — the CR-02 regression this inverted shape prevents. The file
 *      is read as `latin1` (see the read site below), which makes the
 *      DECODE total — every byte sequence decodes without throwing or
 *      lossily replacing. That is NOT true of the READ itself: a
 *      "must be a regular file" gate now precedes the read (WR-14), because
 *      `readdirSync`'s `withFileTypes` uses `lstat` semantics, so a
 *      symlink — dangling, to a directory, or to anything else — a FIFO,
 *      a socket, or a device node all have `isDirectory() === false` and
 *      would otherwise reach an unguarded `readFileSync`. Non-regular
 *      entries are now REPORTED as violations rather than read. A
 *      regular file that still fails to open (e.g. mode-000, `EACCES`)
 *      is caught by a `try`/`catch` around the read and reported the
 *      same way, rather than letting the throw escape this pure
 *      function. The same applies one level up: an unreadable
 *      DIRECTORY (mode-000, `EACCES` on `readdirSync` itself) is also
 *      caught and REPORTED rather than read, instead of throwing out of
 *      this pure function (WR-19, the directory-shaped sibling of the
 *      file case above).
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

export const CURATE_DIR_NAME = '__curate';
export const CURATE_MARKER = '__curate';
// `.json` is the ONLY load-bearing exemption — see the docblock above.
// Every other extension is content-scanned; an unanticipated extension
// fails CLOSED. No speculative image/font exemptions are added: the
// published tree contains none today, and an exemption with no
// load-bearing reason is exactly the collateral hole CR-02 raised.
export const UNSCANNED_EXTENSIONS = ['.json'];

/**
 * Scans `publishDir` (e.g. 'dist/widgets') for evidence that curate's
 * local-only overlay or write path leaked into the published bundle.
 * Returns `[]` when `publishDir` does not exist (mirroring
 * assertNoPrivateArtifacts's early return) or when the tree is clean.
 * Never calls process.exit — pure, side-effect-free, directly testable.
 *
 * @param {string} publishDir
 * @returns {Array<{ path: string, reason: string }>}
 */
export function findCurationArtifacts(publishDir) {
  const violations = [];
  if (!existsSync(publishDir)) return violations;

  function scanExtension(entryPath) {
    const lastDot = entryPath.lastIndexOf('.');
    if (lastDot === -1) return null;
    return entryPath.slice(lastDot);
  }

  function walk(dir) {
    // WR-19: readdirSync itself can throw (e.g. a mode-000 directory,
    // EACCES) before any entry is ever produced. Mirror the read site's
    // shape below — report a violation naming the directory and stop
    // descending, rather than letting the throw escape this pure function.
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      violations.push({
        path: dir,
        reason: `could not be listed (${error.code ?? error.message}) — an unreadable directory cannot be certified free of the "${CURATE_MARKER}" marker`,
      });
      return;
    }

    for (const entry of entries) {
      const entryPath = resolve(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === CURATE_DIR_NAME) {
          violations.push({
            path: entryPath,
            reason: `a directory named "${CURATE_DIR_NAME}" must never exist under the published bundle`,
          });
          // Still descend — a nested violation inside it is worth reporting
          // too, and does no harm to also list.
        }
        if (entry.name === '.curate-dist') {
          violations.push({
            path: entryPath,
            reason: 'a ".curate-dist" directory (the curate overlay\'s esbuild output) must never exist under the published bundle',
          });
        }
        walk(entryPath);
        continue;
      }

      if (entry.name === CURATE_DIR_NAME) {
        violations.push({
          path: entryPath,
          reason: `a file named "${CURATE_DIR_NAME}" must never exist under the published bundle`,
        });
      }

      if (entry.name === '.curate-dist') {
        // A FILE (not directory) literally named ".curate-dist" is the
        // curate overlay's esbuild output. It carries no marker text in
        // its own body, so no content scan can catch it — this name check
        // is the only mechanism that flags it. Deliberately NOT extended
        // to name-match other curate-ish substrings (e.g. "curate-overlay"):
        // the inverted content scan below now covers those, and matching
        // arbitrary substrings in filenames would risk false positives on
        // legitimate published files.
        violations.push({
          path: entryPath,
          reason: 'a file named ".curate-dist" (the curate overlay\'s esbuild output) must never exist under the published bundle',
        });
      }

      // WR-14: readdirSync's withFileTypes uses lstat semantics, so a
      // symlink — dangling, to a directory, or to anything else — has
      // isDirectory() === false and falls through to here. A FIFO,
      // socket or device node does too. None of these are legitimate
      // publish artifacts; report rather than read. This gate must run
      // BEFORE the UNSCANNED_EXTENSIONS skip below (case (d) pins the
      // ordering) so a .json-named symlink cannot use the load-bearing
      // .json exemption to smuggle a non-regular entry past the scan.
      if (!entry.isFile()) {
        violations.push({
          path: entryPath,
          reason: 'not a regular file — the published bundle must contain only regular files and directories',
        });
        continue;
      }

      const ext = scanExtension(entry.name);
      if (ext !== null && UNSCANNED_EXTENSIONS.includes(ext)) continue;

      // Read as latin1, not utf8: content scanning now reaches arbitrary
      // byte content (.DS_Store, and any future binary), and latin1
      // decodes every byte sequence without throwing or lossily
      // replacing, while the marker is pure ASCII so substring matching
      // is unaffected.
      //
      // WR-14: the isFile() gate above rules out symlinks/FIFOs/sockets/
      // device nodes, but a REGULAR file can still fail to open (e.g. a
      // mode-000 file, EACCES). Report that as a violation too, rather
      // than letting the throw escape this pure function.
      let content;
      try {
        content = readFileSync(entryPath, 'latin1');
      } catch (error) {
        violations.push({
          path: entryPath,
          reason: `could not be read for scanning (${error.code ?? error.message}) — an unscannable file cannot be certified free of the "${CURATE_MARKER}" marker`,
        });
        continue;
      }
      if (content.includes(CURATE_MARKER)) {
        violations.push({
          path: entryPath,
          reason: `file contents contain the literal "${CURATE_MARKER}" marker — the curation write path must be structurally absent from the published bundle`,
        });
      }
    }
  }

  walk(publishDir);
  return violations;
}
