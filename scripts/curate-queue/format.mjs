/**
 * Phase 29 plan 05 — local formatters for the review queue's browser client, duplicated (not
 * imported) from `src/dashboard/views/list.ts`'s `formatPace`, `formatEffortDuration` and
 * `formatActivityDate`, plus a new `activityDetailUrl` local to this module.
 *
 * MUST be `.mjs` with JSDoc types, NOT `.ts`: this file is bundled into the browser by esbuild and
 * imported by Node in tests, and `vitest.config.ts`'s `include` is
 * `['src/**\/*.test.ts', 'scripts/**\/*.test.mjs']` — a `.test.ts` sibling would never be
 * collected (RESEARCH.md Pitfall 1, this project has twice shipped a guard that stayed green
 * while proving nothing). MUST have zero `import` statements and zero `console` calls — no file
 * under `scripts/` imports from `src/` today, and that precedent is deliberate (Pattern 3 in this
 * phase's RESEARCH.md): a future reader must not "fix" this into an import of `src/dashboard/`.
 *
 * `activityDetailUrl` returns the FULL `/strava-widgets/#/activity/<id>` form (D-12), not the bare
 * `#/activity/<id>` hash `src/dashboard/row-navigation.ts`'s `activityDetailHref` returns — the
 * queue is served from `/__curate/queue`, a different path, so a bare hash would resolve against
 * the wrong document.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Formats a pace in seconds-per-km as `m:ss/km`, or an em dash for `null`/`NaN`. Duplicated
 * behavior from `src/dashboard/views/list.ts`'s `formatPace` (single-rounding-step discipline
 * preserved — see that file's docblock for why independent rounding of minutes/seconds is wrong).
 *
 * @param {number | null} secPerKm
 * @returns {string}
 */
export function formatPace(secPerKm) {
  if (secPerKm === null || Number.isNaN(secPerKm)) return '—';
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

/**
 * Formats a duration in seconds as `m:ss` under an hour, `h:mm:ss` at or above one hour, or an em
 * dash for a non-finite or negative value. Duplicated behavior from
 * `src/dashboard/views/list.ts`'s `formatEffortDuration` (correct for sub-hour PR/effort times;
 * unlike `formatDurationHms` it omits the leading `0:` hour component).
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatEffortDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats an activity start-date string as e.g. `Apr 25, 2020`, reading UTC components after
 * appending a trailing `Z` when absent — deliberate, not a bug (see
 * `src/dashboard/views/list.ts`'s `formatActivityDate` docblock, WR-02): this makes the intervals
 * .icu no-`Z` wall-clock rows read the same wall-clock components a browser's local-time parse
 * would otherwise shift by the viewer's own UTC offset. A non-string or unparseable value degrades
 * to an em dash, never throws.
 *
 * @param {unknown} isoLocal
 * @returns {string}
 */
export function formatActivityDate(isoLocal) {
  if (typeof isoLocal !== 'string') return '—';
  const normalized = isoLocal.endsWith('Z') ? isoLocal : `${isoLocal}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Builds the full, mount-prefixed activity detail URL (D-12) — `/strava-widgets/#/activity/<id>`,
 * not the bare `#/activity/<id>` hash `row-navigation.ts`'s `activityDetailHref` returns, because
 * the queue is served from `/__curate/queue`, a different path than the dashboard mount. The id is
 * percent-encoded via `encodeURIComponent`.
 *
 * @param {string} activityId
 * @returns {string}
 */
export function activityDetailUrl(activityId) {
  return `/strava-widgets/#/activity/${encodeURIComponent(activityId)}`;
}
