/**
 * Phase 29 plan 04 — the pure derivation the review queue's list comes from (D-08). Given the two
 * mirrored curation documents (plus the dashboard index for names, PD-01), returns the ordered,
 * one-row-per-activity flagged set with everything D-12 needs to render and everything D-11 needs
 * to prefill.
 *
 * MUST be `.mjs` with JSDoc types, NOT `.ts`: this file is bundled into the browser by esbuild and
 * imported by Node in tests, and `vitest.config.ts`'s `include` is
 * `['src/**\/*.test.ts', 'scripts/**\/*.test.mjs']` — a `.test.ts` sibling would never be
 * collected (RESEARCH.md Pitfall 1, this project has twice shipped a guard that stayed green
 * while proving nothing). MUST have zero `import` statements and zero `console` calls — it runs
 * in the browser, unbundled by any module loader beyond esbuild's own IIFE step.
 *
 * D-01: population is any effort with a non-null object `demotion` — all three guards
 * (world-record/max-speed/ceiling), never a ceiling-only subset. D-02: an already-excluded
 * flagged activity stays listed, marked excluded, carrying its stored reason — the listed set
 * equals the flagged set exactly. D-03: one row per activity, its flagged efforts nested inside.
 * D-05: not-yet-excluded first, then newest-first within each group, stable across reloads.
 */

/**
 * @typedef {Object} FlaggedEffortLine
 * @property {string} distance
 * @property {string} guard
 * @property {string} reason
 * @property {number} durationSec
 * @property {number} paceSecPerKm
 */

/**
 * @typedef {Object} QueueRow
 * @property {string} activityId
 * @property {string} startDate
 * @property {string|null} name
 * @property {string} label
 * @property {string} detailUrl
 * @property {FlaggedEffortLine[]} flaggedEfforts
 * @property {boolean} excluded
 * @property {string|null} exclusionReason
 * @property {string} prefillReason
 */

/**
 * Derives the ordered, one-row-per-activity flagged set (D-01 through D-05, D-11, D-12, PD-01).
 * Never throws — a missing, null or malformed input document degrades to an empty array.
 *
 * @param {unknown} bestEffortsDoc
 * @param {unknown} exclusionsDoc
 * @param {unknown} [indexDoc]
 * @returns {QueueRow[]}
 */
export function deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc) {
  return [];
}

/**
 * Joins a set of flagged effort lines into the reason-field prefill (D-11): each reason prefixed
 * with its distance, newline-separated, no adjectives added, no run-on concatenation.
 *
 * @param {FlaggedEffortLine[]} flaggedEfforts
 * @returns {string}
 */
export function buildPrefillReason(flaggedEfforts) {
  return '';
}

/**
 * Summarizes a derived row set into the queue header's counts.
 *
 * @param {QueueRow[]} rows
 * @returns {{ flaggedCount: number, excludedCount: number }}
 */
export function summarizeQueue(rows) {
  return { flaggedCount: 0, excludedCount: 0 };
}
