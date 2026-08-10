/**
 * Loader and matcher for the user-maintained
 * `data/best-effort-exclusions.json` file (Phase 16, folded todo
 * "Manual exclusion of activities from best-effort/PR calculations").
 *
 * `loadExclusions` never throws (T-16-EX-01): a missing, unparseable, or
 * structurally wrong exclusions file degrades to an empty index after a
 * single `console.warn`, so a hand-edit typo can never abort the nightly
 * archive-wide `compute-best-efforts` run.
 */

import type { BestEffortExclusionsFile, TargetDistanceKey } from './best-effort.types.js';
import { TARGET_ORDER } from './best-effort.types.js';
import type { FileStore } from '../storage/file-store.js';

/**
 * Keyed by activity id (string). `'all'` means every target distance is
 * excluded; a `Set` narrows the exclusion to specific distances.
 */
export type ExclusionIndex = Map<string, Set<TargetDistanceKey> | 'all'>;

const TARGET_ORDER_SET: ReadonlySet<string> = new Set(TARGET_ORDER);

/**
 * Builds an `ExclusionIndex` from the raw parsed `exclusions` array value.
 * Pure and total — never throws. Individually skips entries that are not a
 * non-null object or whose `activityId` is not a non-empty string
 * (T-16-EX-02: a single bad row cannot poison the whole index).
 */
export function buildExclusionIndex(entries: unknown): ExclusionIndex {
  const index: ExclusionIndex = new Map();

  if (!Array.isArray(entries)) return index;

  for (const raw of entries) {
    if (typeof raw !== 'object' || raw === null) continue;

    const entry = raw as { activityId?: unknown; distances?: unknown };
    if (typeof entry.activityId !== 'string' || entry.activityId.length === 0) continue;

    const activityId = entry.activityId;
    const existing = index.get(activityId);
    if (existing === 'all') continue; // already absorbs everything

    if (entry.distances === null || entry.distances === undefined) {
      index.set(activityId, 'all');
      continue;
    }

    if (!Array.isArray(entry.distances)) continue;

    const known = new Set<TargetDistanceKey>(
      entry.distances.filter(
        (d): d is TargetDistanceKey => typeof d === 'string' && TARGET_ORDER_SET.has(d)
      )
    );
    if (known.size === 0) continue;

    if (existing) {
      for (const d of known) existing.add(d);
    } else {
      index.set(activityId, known);
    }
  }

  return index;
}

/** Pure. `'all'` returns true for every distance. */
export function isExcluded(
  index: ExclusionIndex,
  activityId: string,
  distance: TargetDistanceKey
): boolean {
  const entry = index.get(activityId);
  if (!entry) return false;
  if (entry === 'all') return true;
  return entry.has(distance);
}

/**
 * Reads and parses `exclusionsPath` via `fileStore`, building an
 * `ExclusionIndex`. Any read or parse failure (missing file, invalid JSON,
 * missing `exclusions` array) resolves to an EMPTY index after a single
 * `console.warn` naming the path and the reason — never rejects.
 */
export async function loadExclusions(
  fileStore: FileStore,
  exclusionsPath: string
): Promise<ExclusionIndex> {
  try {
    const file = await fileStore.readJson<BestEffortExclusionsFile>(exclusionsPath);
    const index = buildExclusionIndex(file.exclusions);
    console.log(`Loaded ${index.size} best-effort exclusion${index.size === 1 ? '' : 's'} from ${exclusionsPath}`);
    return index;
  } catch (error) {
    console.warn(
      `Could not load exclusions from ${exclusionsPath}: ${(error as Error).message}; proceeding with zero exclusions`
    );
    return new Map();
  }
}
