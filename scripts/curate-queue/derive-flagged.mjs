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
 * Phase 37 (CUR-06 / CUR-04) extends this contract. D-06: the population is the UNION of (a) any
 * effort with a non-null object `demotion` (all guards), (b) any effort with a non-null object
 * `contaminated`, and (c) any activity whose index row has
 * `quality.pauseClassification.transportedCount > 0`, including one with no best-efforts entry.
 * Phase 29 D-02/D-03 stand: an excluded activity stays listed, one row per activity.
 * D-08 REPLACES Phase 29 D-05: tier 1 transported, tier 2 guard-moved, tier 3 other demotions; tiers
 * 1-2 by contaminatedMetres desc, then startDate desc, then activityId asc (tier 3 skips metres).
 * D-07: contaminatedMetres is read fail-closed (finite, non-negative, else 0 plus metresMissing).
 * The Exclude prefill stays demotion-only (D-17 / Phase 29 D-11).
 *
 * Contract restated: zero `import` statements and zero `console` calls (a comment-stripping scan in
 * the test file proves it and is itself shown to fail on a planted violation).
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
 * @property {FlaggedEffortLine[]} contaminatedEfforts
 * @property {1|2|3} tier
 * @property {number|null} contaminatedMetres null on tier 3
 * @property {boolean} metresMissing
 * @property {boolean} transported
 * @property {string} fingerprint
 * @property {'none'|'reviewed'|'changed'} reviewState
 * @property {string|null} reviewReason
 * @property {string|null} reviewedAt
 * @property {string|null} reviewedFingerprint
 * @property {boolean} reviewConflict excluded AND present in the reviewed file (hand-edited)
 */

/**
 * Builds a Map from activityId -> stored exclusion reason, skipping any entry whose activityId
 * is not a string, whose reason is not a string or is empty/whitespace-only, whose activityId is
 * `__proto__` (T-29-12: a Map key of `__proto__` is itself safe, but the entry is still
 * meaningless and is skipped to match deriveFlaggedActivities's own activities-loop discipline),
 * or whose activityId duplicates one already added (the collision is counted once, not
 * per-occurrence, and the map keeps only the first entry's reason).
 *
 * Also returns `skippedCount` — how many entries were dropped for any of the five reasons above,
 * surfaced to callers via the sibling export `countMalformedExclusions` below (D-09: the queue
 * keeps skipping malformed entries, but now reports how many). This validation
 * is deliberately duplicated from `scripts/compute-pr-ceiling-recount.mjs`'s own malformed-
 * exclusion check rather than shared, because that script is forbidden from importing anything
 * (Phase 28 D-15 / D-08) and this file's own zero-import contract (see module docblock) forbids
 * the reverse import too.
 *
 * @param {unknown} exclusionsDoc
 * @returns {{ map: Map<string, string>, skippedCount: number }}
 */
function buildExclusionsMap(exclusionsDoc) {
  const map = new Map();
  const exclusions =
    exclusionsDoc && Array.isArray(exclusionsDoc.exclusions) ? exclusionsDoc.exclusions : [];
  let skippedCount = 0;
  for (const entry of exclusions) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.activityId !== 'string' ||
      entry.activityId === '__proto__' ||
      typeof entry.reason !== 'string' ||
      entry.reason.trim() === ''
    ) {
      skippedCount += 1;
      continue;
    }
    if (map.has(entry.activityId)) {
      skippedCount += 1;
      continue;
    }
    map.set(entry.activityId, entry.reason);
  }
  return { map, skippedCount };
}

/**
 * Counts exclusion entries `buildExclusionsMap` drops: a non-string activityId, a
 * `__proto__`-keyed activityId, a non-string reason, an empty or whitespace-only reason, or a
 * duplicate activityId (the collision counted once, not per additional occurrence). A missing or
 * null document, or one whose `exclusions` is not an array, counts 0 and never throws.
 *
 * Sibling export, not a change to `deriveFlaggedActivities`'s or `summarizeQueue`'s return
 * shapes — the queue's malformed-entries line (`scripts/curate-queue/index.ts`) calls this
 * alongside `deriveFlaggedActivities` with the same `exclusionsDoc`.
 *
 * @param {unknown} exclusionsDoc
 * @returns {number}
 */
export function countMalformedExclusions(exclusionsDoc) {
  return buildExclusionsMap(exclusionsDoc).skippedCount;
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
 * D-12 fingerprint: which flags, not how much. The sorted, de-duplicated set of
 * `<distance>:<guard>` tokens over demotions and contaminated efforts, joined by ',', then
 * '|t=1' or '|t=0'. Independent of effort order, metres, reasons and durations, so metre drift
 * never resurfaces a reviewed row. Non-object efforts and non-string distance/guard are skipped.
 *
 * @param {unknown[]} efforts
 * @param {boolean} transported
 * @returns {string}
 */
export function fingerprintFor(efforts, transported) {
  const tokens = new Set();
  const list = Array.isArray(efforts) ? efforts : [];
  for (const e of list) {
    if (e === null || typeof e !== 'object' || typeof e.distance !== 'string') continue;
    for (const flag of [e.demotion, e.contaminated]) {
      if (flag !== null && typeof flag === 'object' && typeof flag.guard === 'string') {
        tokens.add(`${e.distance}:${flag.guard}`);
      }
    }
  }
  return `${[...tokens].sort().join(',')}|t=${transported ? 1 : 0}`;
}

/**
 * D-05: builds Map activityId -> { reason, reviewedAt, fingerprint } over `reviewedDoc.reviewed`.
 * Skips AND counts: a non-object entry, a non-string or `__proto__` activityId, a non-string or
 * whitespace-only reason, a reviewedAt that is not a string or does not parse as a date, a
 * non-string fingerprint, and a duplicate activityId (counted once; the first entry wins).
 * Duplicated from the server's validation rather than shared: this file has zero imports.
 *
 * @param {unknown} reviewedDoc
 * @returns {{ map: Map<string, { reason: string, reviewedAt: string, fingerprint: string }>, skippedCount: number }}
 */
function buildReviewedMap(reviewedDoc) {
  const map = new Map();
  const reviewed = reviewedDoc && Array.isArray(reviewedDoc.reviewed) ? reviewedDoc.reviewed : [];
  let skippedCount = 0;
  for (const entry of reviewed) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.activityId !== 'string' ||
      entry.activityId === '__proto__' ||
      typeof entry.reason !== 'string' ||
      entry.reason.trim() === '' ||
      typeof entry.reviewedAt !== 'string' ||
      Number.isNaN(Date.parse(entry.reviewedAt)) ||
      typeof entry.fingerprint !== 'string'
    ) {
      skippedCount += 1;
      continue;
    }
    if (map.has(entry.activityId)) {
      skippedCount += 1;
      continue;
    }
    map.set(entry.activityId, {
      reason: entry.reason,
      reviewedAt: entry.reviewedAt,
      fingerprint: entry.fingerprint,
    });
  }
  return { map, skippedCount };
}

/**
 * Counts reviewed entries `buildReviewedMap` drops (D-05). A missing, null or wrongly shaped
 * document counts 0 and never throws.
 *
 * @param {unknown} reviewedDoc
 * @returns {number}
 */
export function countMalformedReviewed(reviewedDoc) {
  return buildReviewedMap(reviewedDoc).skippedCount;
}

/**
 * Builds a Map from String(id) -> { transported, startDate } over `indexDoc.activities`, in the
 * buildNameMap style. transported means `quality.pauseClassification.transportedCount` is a number
 * greater than 0. Rows that are not objects, or whose id is null/undefined, are skipped.
 *
 * @param {unknown} indexDoc
 * @returns {Map<string, { transported: boolean, startDate: string }>}
 */
function buildTransportedMap(indexDoc) {
  const map = new Map();
  const activities =
    indexDoc && Array.isArray(indexDoc.activities) ? indexDoc.activities : [];
  for (const row of activities) {
    if (row === null || typeof row !== 'object' || row.id === undefined || row.id === null) {
      continue;
    }
    const count =
      row.quality && row.quality.pauseClassification
        ? row.quality.pauseClassification.transportedCount
        : undefined;
    map.set(String(row.id), {
      transported: typeof count === 'number' && count > 0,
      startDate: typeof row.startDate === 'string' ? row.startDate : '',
    });
  }
  return map;
}

/**
 * Total, reload-stable comparator (D-08): tier ascending; within tiers 1-2 contaminatedMetres
 * descending; then startDate descending (string compare); then activityId ascending.
 *
 * @param {QueueRow} a
 * @param {QueueRow} b
 * @returns {number}
 */
export function compareQueueRows(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.tier < 3 && a.contaminatedMetres !== b.contaminatedMetres) {
    return b.contaminatedMetres - a.contaminatedMetres;
  }
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1;
  return a.activityId < b.activityId ? -1 : a.activityId > b.activityId ? 1 : 0;
}

/**
 * Derives the ordered, one-row-per-activity queue set (D-06 union, D-08 order). Never throws: a
 * missing, null or malformed input document degrades to an empty array. Defaults `activities` to
 * `{}`, `efforts` to `[]`, and treats any `demotion` / `contaminated` that is not a non-null object
 * as absent (T-29-13).
 *
 * @param {unknown} bestEffortsDoc
 * @param {unknown} exclusionsDoc
 * @param {unknown} [indexDoc]
 * @param {unknown} [reviewedDoc] D-10 review overlay; absent means every row is reviewState none
 * @returns {QueueRow[]}
 */
export function deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc, indexDoc, reviewedDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};

  const { map: exclusionsMap } = buildExclusionsMap(exclusionsDoc);
  const nameMap = buildNameMap(indexDoc);
  const transportedMap = buildTransportedMap(indexDoc);
  const { map: reviewedMap } = buildReviewedMap(reviewedDoc);

  // D-06: union of the best-efforts keys and transported ids that have no entry at all.
  const ids = Object.keys(activities).filter((id) => id !== '__proto__');
  const seen = new Set(ids);
  for (const [id, info] of transportedMap) {
    if (id === '__proto__' || !info.transported || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  const rows = [];

  for (const activityId of ids) {
    const hasEntry = Object.prototype.hasOwnProperty.call(activities, activityId);
    const activity = hasEntry ? activities[activityId] : undefined;
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    const indexInfo = transportedMap.get(activityId);
    const transported = indexInfo !== undefined && indexInfo.transported;

    /** @type {FlaggedEffortLine[]} */
    const flaggedEfforts = [];
    /** @type {FlaggedEffortLine[]} */
    const contaminatedEfforts = [];
    let guardMoved = false;
    for (const effortEntry of efforts) {
      if (effortEntry === null || typeof effortEntry !== 'object') continue;
      const demotion = effortEntry.demotion;
      if (demotion !== null && typeof demotion === 'object') {
        flaggedEfforts.push({
          distance: effortEntry.distance,
          guard: demotion.guard,
          reason: demotion.reason,
          durationSec: effortEntry.durationSec,
          paceSecPerKm: effortEntry.paceSecPerKm,
        });
        if (demotion.guard === 'unreliable-segment') guardMoved = true;
      }
      const contaminated = effortEntry.contaminated;
      if (contaminated !== null && typeof contaminated === 'object') {
        contaminatedEfforts.push({
          distance: effortEntry.distance,
          guard: contaminated.guard,
          reason: contaminated.reason,
          durationSec: contaminated.durationSec,
          paceSecPerKm: contaminated.paceSecPerKm,
        });
        guardMoved = true;
      }
    }

    // Fail closed: an unrecognised row falls out of the set rather than into a benign tier.
    let tier;
    if (transported) tier = 1;
    else if (guardMoved) tier = 2;
    else if (flaggedEfforts.length > 0) tier = 3;
    else continue;

    let contaminatedMetres = null;
    let metresMissing = false;
    if (tier < 3) {
      const raw = hasEntry && activity !== null && typeof activity === 'object'
        ? activity.contaminatedMetres
        : undefined;
      const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0;
      contaminatedMetres = valid ? raw : 0;
      metresMissing = hasEntry && !valid;
    }

    const startDate =
      activity && typeof activity.startDate === 'string'
        ? activity.startDate
        : indexInfo !== undefined
          ? indexInfo.startDate
          : '';
    const excluded = exclusionsMap.has(activityId);
    const exclusionReason = excluded ? exclusionsMap.get(activityId) : null;
    const name = nameMap.has(activityId) ? nameMap.get(activityId) : null;
    const label = name !== null ? name : `Activity ${activityId}`;

    const fingerprint = fingerprintFor(efforts, transported);
    const review = reviewedMap.get(activityId);
    // D-10: reviewed only while the stored fingerprint equals the current one.
    const reviewState =
      review === undefined ? 'none' : review.fingerprint === fingerprint ? 'reviewed' : 'changed';

    rows.push({
      activityId,
      startDate,
      name,
      label,
      detailUrl: `/strava-widgets/#/activity/${activityId}`,
      flaggedEfforts,
      contaminatedEfforts,
      excluded,
      exclusionReason,
      prefillReason: buildPrefillReason(flaggedEfforts),
      tier,
      contaminatedMetres,
      metresMissing,
      transported,
      fingerprint,
      reviewState,
      reviewReason: review !== undefined ? review.reason : null,
      reviewedAt: review !== undefined ? review.reviewedAt : null,
      reviewedFingerprint: review !== undefined ? review.fingerprint : null,
      // D-11: excluded wins; a hand-edited excluded+reviewed row is flagged, never shown as kept.
      reviewConflict: excluded && review !== undefined,
    });
  }

  rows.sort(compareQueueRows);

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

/** D-15 view ids, default first. */
export const QUEUE_VIEWS = ['to-review', 'reviewed', 'excluded', 'all'];

/**
 * D-15: filters rows for a view without re-sorting. An unknown view falls back to 'to-review', the
 * direction that adds attention. Excluded rows never appear under reviewed (D-11).
 *
 * @param {QueueRow[]} rows
 * @param {string} view
 * @returns {QueueRow[]}
 */
export function rowsForView(rows, view) {
  const list = Array.isArray(rows) ? rows : [];
  switch (view) {
    case 'reviewed':
      return list.filter((r) => !r.excluded && r.reviewState === 'reviewed');
    case 'excluded':
      return list.filter((r) => r.excluded);
    case 'all':
      return list.slice();
    default:
      return list.filter((r) => !r.excluded && r.reviewState !== 'reviewed');
  }
}

/**
 * D-13: reviewed entries whose activity is not in the derived set. Never dropped. Sorted by
 * reviewedAt descending, then activityId ascending.
 *
 * @param {QueueRow[]} rows
 * @param {unknown} reviewedDoc
 * @returns {{ activityId: string, reason: string, reviewedAt: string, fingerprint: string }[]}
 */
export function deriveOrphans(rows, reviewedDoc) {
  const present = new Set((Array.isArray(rows) ? rows : []).map((r) => r.activityId));
  const orphans = [];
  for (const [activityId, entry] of buildReviewedMap(reviewedDoc).map) {
    if (present.has(activityId)) continue;
    orphans.push({
      activityId,
      reason: entry.reason,
      reviewedAt: entry.reviewedAt,
      fingerprint: entry.fingerprint,
    });
  }
  orphans.sort((a, b) => {
    if (a.reviewedAt !== b.reviewedAt) return a.reviewedAt < b.reviewedAt ? 1 : -1;
    return a.activityId < b.activityId ? -1 : a.activityId > b.activityId ? 1 : 0;
  });
  return orphans;
}

/**
 * Per-view counts for the summary line. `reviewed` counts reviewed non-excluded rows plus orphans.
 *
 * @param {QueueRow[]} rows
 * @param {unknown[]} orphans
 */
export function summarizeViews(rows, orphans) {
  const list = Array.isArray(rows) ? rows : [];
  const orphanCount = Array.isArray(orphans) ? orphans.length : 0;
  const toReview = rowsForView(list, 'to-review');
  return {
    toReview: toReview.length,
    changed: toReview.filter((r) => r.reviewState === 'changed').length,
    reviewed: rowsForView(list, 'reviewed').length + orphanCount,
    excluded: rowsForView(list, 'excluded').length,
    all: list.length,
    orphans: orphanCount,
    metresMissing: list.filter((r) => r.metresMissing).length,
    conflicts: list.filter((r) => r.reviewConflict).length,
  };
}
