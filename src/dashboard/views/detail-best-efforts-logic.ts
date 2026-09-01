/**
 * Detail-view PR badge and best-efforts panel derivation (REC-04, REC-06,
 * D-08). Pure, DOM-free: every function here takes already-fetched data and
 * returns plain values/rows — `detail.ts` renders them, this module never
 * touches `document`/`window`.
 */

import type { ActivityBestEfforts, TargetDistanceKey } from '../../analytics/best-effort.types.js';
import { TARGET_ORDER } from '../../analytics/best-effort.types.js';
import type { AgeGradingDocument } from '../../analytics/age-grading.types.js';
import type { ExclusionIndex } from '../../analytics/best-effort-exclusions.js';
import { isExcluded } from '../../analytics/best-effort-exclusions.js';

/** Display name per target distance, matching 18-UI-SPEC.md's naming exactly. */
export const DISTANCE_DISPLAY_NAMES: Record<TargetDistanceKey, string> = {
  '400m': '400m',
  '1k': '1K',
  '1mi': '1 Mile',
  '5k': '5K',
  '10k': '10K',
  half: 'Half Marathon',
  marathon: 'Marathon',
};

/**
 * Builds one `PR — {Display}` label per distance this activity set a PR at,
 * in `TARGET_ORDER`. An effort with `excludedFromRecords === true` never
 * produces a badge, even if `wasPRAtTheTime` is also true — an excluded
 * effort did not set a record (T-18-HONEST-06). Returns `[]` for a `null`
 * entry or one with no PR-setting, non-excluded efforts.
 */
export function buildPrBadgeLabels(entry: ActivityBestEfforts | null): string[] {
  if (entry === null) return [];

  const byDistance = new Map(entry.efforts.map((effort) => [effort.distance, effort]));

  const labels: string[] = [];
  for (const distance of TARGET_ORDER) {
    const effort = byDistance.get(distance);
    if (!effort) continue;
    if (!effort.wasPRAtTheTime) continue;
    if (effort.excludedFromRecords) continue;
    labels.push(`PR — ${DISTANCE_DISPLAY_NAMES[distance]}`);
  }
  return labels;
}

/** One row in the "Best Efforts This Run" panel. */
export interface BestEffortPanelRow {
  distance: TargetDistanceKey;
  display: string;
  durationSec: number;
  paceSecPerKm: number;
  isPr: boolean;
  lowConfidence: boolean;
  excluded: boolean;
  agePercent: number | null;
  ageDerived: boolean;
}

/**
 * Builds one panel row per effort this activity produced, in `TARGET_ORDER`
 * — NOT only the PR-setting ones (D-08: "every effort this run produced
 * across all seven distances"). `agePercent` joins from
 * `ageGrading.activities[entry.activityId][distance]`, and is `null` —
 * never `0` — when age-grading is disabled, the document is absent, or the
 * activity/distance has no grade (T-18-HONEST-06). `ageDerived` is `true`
 * only for `1k` (D-09's interpolated-factor distance), independent of
 * whether a grade was actually found. Returns `[]` when the activity
 * produced no efforts at all — the caller renders the named empty state
 * rather than omitting the section.
 *
 * `BestEffortPanelRow.excluded` is a BADGE-STATE claim about the
 * developer's live curation intent for the activity being viewed, read from
 * `data/best-effort-exclusions.json` (GAP-24-01): when `liveExclusions` is
 * not `null`, each row's `excluded` is `isExcluded(liveExclusions,
 * entry.activityId, distance)`, so a `distances`-scoped entry badges only
 * the distances it names (D-05's read tolerance). `liveExclusions === null`
 * means UNKNOWN — the document could not be fetched or did not parse — and
 * falls back to the precomputed `effort.excludedFromRecords`; it must never
 * be treated as NOT-EXCLUDED, which would silently clear a real badge.
 *
 * The precomputed `excludedFromRecords` field remains the ONLY source of
 * truth for COMPUTED STATS — Records-screen rankings, promoted next-best
 * efforts, `compute-dashboard-index`'s counts and the Activities-list badge
 * at `list.ts:266`. Nothing here recomputes a ranking in the browser.
 * Between a curate Save and the next `compute-best-efforts` run, the live
 * file and `best-efforts.json` can genuinely disagree: the panel row renders
 * `Excluded — {reason}` (this document) while the Records screen still
 * lists the effort at its old rank (the precomputed document), until
 * "Recompute records" closes the gap. That disagreement window is the
 * honest reading of two documents that have not yet converged, not a bug.
 */
export function buildBestEffortsPanelRows(
  entry: ActivityBestEfforts | null,
  ageGrading: AgeGradingDocument | null,
  liveExclusions: ExclusionIndex | null
): BestEffortPanelRow[] {
  if (entry === null || entry.efforts.length === 0) return [];

  const byDistance = new Map(entry.efforts.map((effort) => [effort.distance, effort]));
  const ageGradeForActivity =
    ageGrading && ageGrading.enabled ? ageGrading.activities[entry.activityId] : undefined;

  const rows: BestEffortPanelRow[] = [];
  for (const distance of TARGET_ORDER) {
    const effort = byDistance.get(distance);
    if (!effort) continue;

    const ageGradeEntry = ageGradeForActivity?.[distance];

    rows.push({
      distance,
      display: DISTANCE_DISPLAY_NAMES[distance],
      durationSec: effort.durationSec,
      paceSecPerKm: effort.paceSecPerKm,
      isPr: effort.wasPRAtTheTime,
      lowConfidence: effort.lowConfidence,
      excluded:
        liveExclusions !== null
          ? isExcluded(liveExclusions, entry.activityId, distance)
          : effort.excludedFromRecords,
      agePercent: ageGradeEntry ? ageGradeEntry.agePercent : null,
      ageDerived: distance === '1k',
    });
  }
  return rows;
}
