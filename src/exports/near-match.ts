/**
 * The one shared near-match rule (Phase 37.1, ING-05).
 *
 * - The window is NEAR_MATCH_TOLERANCE_S seconds, inclusive: a start whose
 *   distance from a candidate is 1..tolerance is "near".
 * - deltaS is signed: `epoch - candidate.epoch` (new minus existing), the same
 *   convention as reconcile().
 * - The nearest candidate wins; on a tie the earlier candidate epoch wins
 *   (same as reconcile()), independent of candidate order.
 * - An exact match (offset 0) is NOT near; exact is the caller's own path.
 * - A non-finite epoch (query or candidate) never matches and never throws.
 * - "FIT-imported" means the archive record's `source_provider` is in
 *   FIT_IMPORT_PROVIDERS. `strava-export` is deliberately excluded.
 *
 * This is the only definition of the window in src/. near-match.test.ts
 * enforces two things. Every non-test .ts file under src/ is checked for a
 * redefinition of NEAR_MATCH_TOLERANCE_S. The five files that dedupe by start
 * epoch (fit-import, reconcile, intervals-sync, consolidate, index) are also
 * checked for a private window literal (120, 120_000, 120000, 120n, 0x78,
 * 2 * 60, 60 * 2). Other files are not scanned for literals. No fs or path
 * imports: the module is pure.
 */

export const NEAR_MATCH_TOLERANCE_S = 120;

export const FIT_IMPORT_PROVIDERS = ['garmin-export'] as const;

export function isFitImported(provider: unknown): boolean {
  return typeof provider === 'string' && (FIT_IMPORT_PROVIDERS as readonly string[]).includes(provider);
}

export interface NearCandidate {
  id: string;
  epoch: number;
}

export interface NearMatch extends NearCandidate {
  deltaS: number;
}

export function findNearMatch(
  epoch: number,
  candidates: readonly NearCandidate[],
  tolerance: number = NEAR_MATCH_TOLERANCE_S,
): NearMatch | undefined {
  if (!Number.isFinite(epoch)) return undefined;
  let best: NearMatch | undefined;
  for (const c of candidates) {
    if (!Number.isFinite(c.epoch)) continue;
    const deltaS = epoch - c.epoch;
    const abs = Math.abs(deltaS);
    if (abs < 1 || abs > tolerance) continue;
    // Ties go to the earlier candidate epoch, the same rule as reconcile(), so
    // the result never depends on candidate (directory) order.
    if (
      best === undefined ||
      abs < Math.abs(best.deltaS) ||
      (abs === Math.abs(best.deltaS) && c.epoch < best.epoch)
    ) {
      best = { id: c.id, epoch: c.epoch, deltaS };
    }
  }
  return best;
}
