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
 * Builds a Map from activityId -> stored exclusion reason, skipping any entry whose activityId
 * is not a string, whose reason is not a string, or whose activityId is `__proto__` (T-29-12: a
 * Map key of `__proto__` is itself safe, but the entry is still meaningless and is skipped to
 * match deriveFlaggedActivities's own activities-loop discipline).
 *
 * @param {unknown} exclusionsDoc
 * @returns {Map<string, string>}
 */
function buildExclusionsMap(exclusionsDoc) {
  const map = new Map();
  const exclusions =
    exclusionsDoc && Array.isArray(exclusionsDoc.exclusions) ? exclusionsDoc.exclusions : [];
  for (const entry of exclusions) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.activityId !== 'string' ||
      entry.activityId === '__proto__' ||
      typeof entry.reason !== 'string'
    ) {
      continue;
    }
    map.set(entry.activityId, entry.reason);
  }
  return map;
}

/**
 * Builds a Map from String(id) -> activity name, over `indexDoc.activities` when that is an
 * array. Tolerant of `indexDoc` being undefined, null, or shaped wrongly.
 *
 * @param {unknown} indexDoc
 * @returns {Map<string, string>}
 */
function buildNameMap(indexDoc) {
  const map = new Map();
  const activities =
    indexDoc && Array.isArray(indexDoc.activities) ? indexDoc.activities : [];
  for (const row of activities) {
    if (row === null || typeof row !== 'object' || row.id === undefined || row.id === null) {
      continue;
    }
    if (typeof row.name !== 'string') continue;
    map.set(String(row.id), row.name);
  }
  return map;
}

/**
 * Derives the ordered, one-row-per-activity flagged set (D-01 through D-05, D-11, D-12, PD-01).
 * Never throws — a missing, null or malformed input document degrades to an empty array. Mirrors
 * recountDemoted's defensive shape: default `activities` to `{}` when absent or not an object,
 * default `efforts` to `[]` when not an array, and treat any `demotion` that is not a non-null
 * object as absent (T-29-13).
 *
 * @param {unknown} bestEffortsDoc
 * @param {unknown} exclusionsDoc
 * @param {unknown} [indexDoc]
 * @returns {QueueRow[]}
 */
export function deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};

  const exclusionsMap = buildExclusionsMap(exclusionsDoc);
  const nameMap = buildNameMap(indexDoc);

  const rows = [];

  for (const activityId of Object.keys(activities)) {
    if (activityId === '__proto__') continue;

    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];

    /** @type {FlaggedEffortLine[]} */
    const flaggedEfforts = [];
    for (const effortEntry of efforts) {
      if (effortEntry === null || typeof effortEntry !== 'object') continue;
      const demotion = effortEntry.demotion;
      if (demotion === null || typeof demotion !== 'object') continue;
      flaggedEfforts.push({
        distance: effortEntry.distance,
        guard: demotion.guard,
        reason: demotion.reason,
        durationSec: effortEntry.durationSec,
        paceSecPerKm: effortEntry.paceSecPerKm,
      });
    }

    if (flaggedEfforts.length === 0) continue;

    const startDate = activity && typeof activity.startDate === 'string' ? activity.startDate : '';
    const excluded = exclusionsMap.has(activityId);
    const exclusionReason = excluded ? exclusionsMap.get(activityId) : null;
    const name = nameMap.has(activityId) ? nameMap.get(activityId) : null;
    const label = name !== null ? name : `Activity ${activityId}`;

    rows.push({
      activityId,
      startDate,
      name,
      label,
      detailUrl: `/strava-widgets/#/activity/${activityId}`,
      flaggedEfforts,
      excluded,
      exclusionReason,
      prefillReason: buildPrefillReason(flaggedEfforts),
    });
  }

  rows.sort((a, b) => {
    const excludedDelta = Number(a.excluded) - Number(b.excluded);
    if (excludedDelta !== 0) return excludedDelta;
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1;
    return a.activityId < b.activityId ? -1 : a.activityId > b.activityId ? 1 : 0;
  });

  return rows;
}

/**
 * Joins a set of flagged effort lines into the reason-field prefill (D-11): each reason prefixed
 * with its distance, newline-separated, no adjectives added, no run-on concatenation. Skips
 * efforts with a non-string reason. An empty input returns '' — the server still rejects an empty
 * reason, so an empty prefill degrades to "developer must type one", never to a silent write.
 *
 * @param {FlaggedEffortLine[]} flaggedEfforts
 * @returns {string}
 */
export function buildPrefillReason(flaggedEfforts) {
  const list = Array.isArray(flaggedEfforts) ? flaggedEfforts : [];
  return list
    .filter((e) => e && typeof e.reason === 'string')
    .map((e) => `${e.distance}: ${e.reason}`)
    .join('\n');
}

/**
 * Summarizes a derived row set into the queue header's counts.
 *
 * @param {QueueRow[]} rows
 * @returns {{ flaggedCount: number, excludedCount: number }}
 */
export function summarizeQueue(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    flaggedCount: list.length,
    excludedCount: list.filter((r) => r && r.excluded).length,
  };
}
