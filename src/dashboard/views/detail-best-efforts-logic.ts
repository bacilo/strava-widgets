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
import { LOW_CONFIDENCE_BADGE_TEXT } from './list.js';

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
 * THE single definition of "is this effort excluded right now" (WR-17,
 * GAP-24-05 item 3). Both `buildPrBadgeLabels` and
 * `buildBestEffortsPanelRows` call this rather than repeating the ternary
 * verbatim — WR-17 found two copies of the same four-line ternary whose
 * sameness was asserted only by comment, and copy-paste is exactly the
 * mechanism by which they diverge (the original WR-05 defect was one of
 * these two sites reading a different source).
 *
 * `liveExclusions === null` means UNKNOWN — the live document could not be
 * fetched or did not parse — and falls back to `effort.excludedFromRecords`;
 * it must never be treated as NOT-EXCLUDED, which would silently clear a
 * real badge (D-07's Save-vs-Recompute staleness window). Otherwise, the
 * answer is delegated to `isExcluded`, keyed on `activityId` and `distance`.
 */
export function resolveExcluded(
  liveExclusions: ExclusionIndex | null,
  activityId: string,
  distance: TargetDistanceKey,
  effort: { excludedFromRecords: boolean }
): boolean {
  return liveExclusions !== null
    ? isExcluded(liveExclusions, activityId, distance)
    : effort.excludedFromRecords;
}

/**
 * Builds one `PR — {Display}` label per distance this activity set a PR at,
 * in `TARGET_ORDER`. An effort excluded from records never produces a
 * badge, even if `wasPRAtTheTime` is also true — an excluded effort did not
 * set a record (T-18-HONEST-06). Returns `[]` for a `null` entry or one
 * with no PR-setting, non-excluded efforts.
 *
 * `liveExclusions` is a REQUIRED second parameter (WR-05, GAP-24-04) — no
 * default, no optional marker. This is the same forgotten-call-site
 * discipline plan 24-09 chose for `buildBestEffortsPanelRows`: a default
 * would have let a future call site silently reopen the staleness window
 * this parameter closes. Each distance's excluded status is derived via
 * `resolveExcluded`, the single shared helper `buildBestEffortsPanelRows`
 * also calls, so there is one definition rather than two copies. `curation-seam.test.ts`'s WR-17
 * pins assert that `detail.ts` hands both functions the same
 * `liveExclusions` binding. `liveExclusions === null` means UNKNOWN — the
 * document could not be fetched or did not parse — and falls back to the
 * precomputed `effort.excludedFromRecords`; it must never be treated as
 * NOT-EXCLUDED, which would silently clear a real badge.
 *
 * This function is called from the same `Promise.all` and the same paint
 * as `buildBestEffortsPanelRows` (`detail.ts`'s `mountBestEffortsAndBadges`)
 * — the two must never be given different exclusion state, or the header
 * badges and the Best Efforts panel can disagree about whether a run holds
 * a PR (Round 2's R15 evidence, reproduced by this module's WR-05 test
 * cases).
 */
export function buildPrBadgeLabels(
  entry: ActivityBestEfforts | null,
  liveExclusions: ExclusionIndex | null
): string[] {
  if (entry === null) return [];

  const byDistance = new Map(entry.efforts.map((effort) => [effort.distance, effort]));

  const labels: string[] = [];
  for (const distance of TARGET_ORDER) {
    const effort = byDistance.get(distance);
    if (!effort) continue;
    if (!effort.wasPRAtTheTime) continue;
    const excluded = resolveExcluded(liveExclusions, entry.activityId, distance, effort);
    if (excluded) continue;
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
  /**
   * True when a plausibility guard (world-record, max-speed or ceiling —
   * Phase 28 D-08) demoted this effort — a MACHINE judgment, entirely
   * separate from `excluded` (the owner's stated intent, D-10). Never
   * routed through `resolveExcluded`: D-11 ships no write surface, so there
   * is no live-vs-precomputed demotion state to resolve. Read via `!= null`
   * (T-28-02-A), so a stale shard shipped before this field existed
   * degrades to `false` rather than throwing.
   */
  demoted: boolean;
  /** The demoting guard's reason string, or `null` when `demoted` is false or the reason itself is absent. */
  demotionReason: string | null;
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
 * `data/best-effort-exclusions.json` (GAP-24-01): each row's `excluded` is
 * derived via `resolveExcluded`, the single shared helper `buildPrBadgeLabels`
 * also calls, so a `distances`-scoped entry badges only the distances it
 * names (D-05's read tolerance). `liveExclusions === null`
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
 * honest reading of two documents that have not yet converged, not a bug —
 * it concerns the Records screen, a genuinely separate document, not the
 * header badges rendered in the same paint (see below).
 *
 * `isPr` (WR-05, GAP-24-04) is suppressed for a live-excluded row —
 * computed as `wasPRAtTheTime && !excluded`, using the SAME locally-bound
 * `excluded` value the row pushes — because `buildPrFlagsCell`
 * (`detail-sections.ts:339-353`) renders `isPr` and `excluded` into the
 * same `<td>`, and Round 2's R15 recorded that cell rendering literally
 * `PRExcluded — {reason}`. This suppression is a BADGE-STATE claim only:
 * `wasPRAtTheTime` and `excludedFromRecords` remain the sole source of
 * truth for Records-screen rankings, promoted next-best efforts,
 * `compute-dashboard-index`'s counts and the Activities-list badge at
 * `list.ts:266`, none of which this module feeds.
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

    const excluded = resolveExcluded(liveExclusions, entry.activityId, distance, effort);

    rows.push({
      distance,
      display: DISTANCE_DISPLAY_NAMES[distance],
      durationSec: effort.durationSec,
      paceSecPerKm: effort.paceSecPerKm,
      isPr: effort.wasPRAtTheTime && !excluded,
      lowConfidence: effort.lowConfidence,
      excluded,
      agePercent: ageGradeEntry ? ageGradeEntry.agePercent : null,
      ageDerived: distance === '1k',
      demoted: effort.demotion != null,
      demotionReason: effort.demotion?.reason ?? null,
    });
  }
  return rows;
}

/**
 * One flag badge the Best Efforts panel's PR-flags cell renders (D-09).
 * Pure data: plan 28-04 renders each spec through `list.ts`'s
 * `appendAccessibleBadge`, one badge per spec, each with its own
 * `aria-describedby` derived from `descriptionIdSuffix` — mirroring
 * `list.ts`'s `QualityBadgeSpec` shape (`{ signal, visibleText, explanation,
 * descriptionIdSuffix }`) under a differently-named discriminant (`kind`)
 * since this cell's specs are keyed by flag kind, not quality signal.
 */
export interface PrFlagBadgeSpec {
  kind: 'pr' | 'demoted' | 'low-confidence' | 'excluded';
  visibleText: string;
  explanation: string;
  descriptionIdSuffix: string;
}

/**
 * Decides every PR-flags-cell badge's visible text as a pure, DOM-free
 * function (D-09) — closing the hazard `detail-sections.ts:339-353`'s
 * `buildPrFlagsCell` named: that function used to build a bare
 * `<span class="badge">` per condition INSIDE a DOM builder, and Phase 24
 * Round 2's R15 recorded two adjacent conditions rendering as one run-on
 * claim, `PRExcluded — {reason}`, to both flowed text and a screen reader.
 * Moving the strings here makes them assertable in this repo's
 * `node`-environment vitest (no DOM library exists to read a rendered
 * span), and giving every spec its own `explanation` plus a distinct
 * `descriptionIdSuffix` is what lets plan 28-04 render each through
 * `appendAccessibleBadge` with its own `aria-describedby`, so the two
 * claims stay separable by assistive technology, not only by pixels.
 *
 * Emission order: `pr`, `demoted`, `low-confidence`, `excluded` — a row can
 * carry more than one flag at once (e.g. demoted AND excluded), and each
 * becomes its own spec rather than concatenating strings into one cell.
 *
 * `exclusionReason` is a REQUIRED second parameter with no default
 * (WR-05's discipline, matching `buildPrBadgeLabels`) — a forgotten call
 * site must fail to compile, not silently render `Excluded from records`
 * for every excluded row regardless of its actual reason.
 */
export function prFlagBadgeSpecs(
  row: BestEffortPanelRow,
  exclusionReason: string | null
): PrFlagBadgeSpec[] {
  const specs: PrFlagBadgeSpec[] = [];

  if (row.isPr) {
    specs.push({
      kind: 'pr',
      visibleText: 'PR',
      explanation: 'this run set a personal record at this distance at the time it was run',
      descriptionIdSuffix: 'pr',
    });
  }

  if (row.demoted) {
    specs.push({
      kind: 'demoted',
      visibleText: row.demotionReason ? `Demoted — ${row.demotionReason}` : 'Demoted from ranking',
      explanation:
        'this effort is left out of the ranked PR list because a plausibility guard rejected it; it stays visible here with its reason',
      descriptionIdSuffix: 'demoted',
    });
  }

  if (row.lowConfidence) {
    specs.push({
      kind: 'low-confidence',
      visibleText: LOW_CONFIDENCE_BADGE_TEXT,
      explanation: 'GPS-reconstructed distance; treat this time with caution',
      descriptionIdSuffix: 'low-confidence',
    });
  }

  if (row.excluded) {
    specs.push({
      kind: 'excluded',
      visibleText: exclusionReason ? `Excluded — ${exclusionReason}` : 'Excluded from records',
      explanation: 'the owner excluded this effort from records; this is a stated intent, not a machine judgment',
      descriptionIdSuffix: 'excluded',
    });
  }

  return specs;
}
