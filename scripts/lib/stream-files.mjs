/**
 * Shared `data/streams/` filename helpers, extracted from
 * compute-pace-quality-calibration.mjs (Phase 27 G-01) so both
 * compute-pace-residual.mjs and compute-pace-quality-calibration.mjs can
 * import a single owner without either taking a static `import` edge into
 * the other's module-scope `execSync`/`REGENERATE_COMMAND` machinery —
 * mirroring scripts/lib/copy-data-tree.mjs's own extraction rationale
 * (extracted from build-widgets.mjs so it is importable by both
 * build-widgets.mjs and the curate server without triggering that file's
 * self-executing side effect). This module has NO top-level side effects:
 * imports, function declarations and constant declarations only.
 *
 * History: `isStreamFile` was invented in Phase 27 (G-01's fix, the
 * manifest.json miscount) but never promoted to a shared location, so
 * compute-pace-residual.mjs's own archive sweep kept the original naive
 * `f.endsWith('.json')` glob and reopened the same bug independently
 * (27 G-03 / 31-CONTEXT.md D-11) — this module closes both by giving the
 * filter exactly one owner.
 */

/** Strips the trailing `.json` from a `data/activities|streams` filename. */
export function idFromFilename(filename) {
  return filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename;
}

/**
 * True for a `data/streams/` entry that is a genuine per-activity stream
 * file — false for `manifest.json`, the stream-AVAILABILITY INDEX written
 * by backfill-streams and the daily intervals.icu sync, which is not itself
 * a per-activity stream and must never be counted as one (gap G-01,
 * `27-VALIDATION.md`: the original naive `f.endsWith('.json')` glob counted
 * it, inflating the stream-file count by one and understating the
 * stream-less count by one; the same bug reopened independently in
 * compute-pace-residual.mjs as 27 G-03). Named exclusion of the known
 * filename is preferred over a heuristic (e.g. "id doesn't parse as
 * numeric/i-prefixed") because it is exact and does not risk excluding a
 * legitimately-shaped future stream filename.
 */
export function isStreamFile(filename) {
  return filename.endsWith('.json') && filename !== 'manifest.json';
}
