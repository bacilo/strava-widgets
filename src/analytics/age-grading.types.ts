/**
 * Contract for `data/stats/age-grading.json` (REC-06, D-09, D-20).
 *
 * LOAD-BEARING: this document is a **published public artifact** — it is
 * fetched directly by the dashboard SPA and therefore reaches GitHub Pages
 * verbatim. Per D-20 ("keeping identity inputs out of the served artifact")
 * and D-12/Pitfall-1's athlete-config public/private split, this document
 * carries ONLY derived percentages. `birthDate`, `sex`, `restingHr`, and the
 * athlete's age in years must NEVER appear as fields here — even though age
 * is a required input to compute `agePercent`, publishing it would re-expose
 * the birth year the private-config split (plan 18-01) exists to protect.
 * A future edit that adds an identity field to this file defeats that split
 * silently (the same class of defect Phase 16's black-page postmortem warns
 * about: a shape that looks fine locally but leaks something in production).
 */

import type { TargetDistanceKey } from './best-effort.types.js';

/** Bump only via an explicit, coordinated recomputation of `data/stats/age-grading.json`. */
export const AGE_GRADING_SCHEMA_VERSION = 1;

/** One age-graded percentage for one effort. */
export interface AgeGradeEntry {
  agePercent: number;
  /** True only for `1k` (interpolated between 800m and 1mi track factors, D-09). */
  derived: boolean;
}

/** The full output document written to `data/stats/age-grading.json`. */
export interface AgeGradingDocument {
  schemaVersion: number;
  generatedAt: string;
  note: string;
  /** False when `birthDate`/`sex` are absent or invalid in the athlete config (D-13) — the whole feature hides behind an actionable notice rather than a fabricated value. */
  enabled: boolean;
  /** Names the missing/invalid config file and field when `enabled` is false; null when enabled. */
  disabledReason: string | null;
  editions: { road: string; track: string };
  /** Age-grade entries for each ranked PR, aligned by index with `best-efforts.json`'s `rankings`. */
  rankings: Partial<Record<TargetDistanceKey, (AgeGradeEntry & { rank: number; activityId: string })[]>>;
  /** Age-grade entries per activity, for the detail-view best-efforts panel (D-08/D-10). */
  activities: Record<string, Partial<Record<TargetDistanceKey, AgeGradeEntry>>>;
}
