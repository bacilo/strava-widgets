/**
 * Loader, builder, differ and formatter for the committed
 * `data/best-effort-ceiling.json` state file (Phase 28 D-06/D-07).
 *
 * This module DOES touch `FileStore` (Node-side I/O), so — unlike the pure
 * `best-effort-ceiling.ts` — it is NOT reachable from the dashboard bundle
 * and must never be imported by anything under `src/dashboard/`.
 *
 * `loadCeilingState` mirrors `best-effort-exclusions.ts`'s `loadExclusions`
 * exactly (T-16-EX-01's discipline, carried into T-28-06-A): a missing file,
 * unparseable JSON, wrong `schemaVersion`, or missing `ceilings` object all
 * degrade to `null` — "no prior state; treat this run as the first" — after
 * a single `console.warn`. A single malformed per-distance entry is skipped
 * individually (mirroring `buildExclusionIndex`'s per-entry validation) so
 * the other six distances still load. No shape of hand-edited or truncated
 * file may abort a nightly, archive-wide `compute-best-efforts` run.
 */

import type {
  BestEffortCeilingStateFile,
  CeilingDerivation,
  TargetDistanceKey,
} from './best-effort.types.js';
import { TARGET_ORDER } from './best-effort.types.js';
import type { FileStore } from '../storage/file-store.js';

/** One target distance's persisted previous-run snapshot. */
type PersistedCeiling = BestEffortCeilingStateFile['ceilings'][TargetDistanceKey];

/**
 * The kind of movement one distance's ceiling underwent between the
 * previous committed state and the current run's derivation.
 *
 * `'first-run'` covers BOTH the single aggregate row emitted when there is
 * no previous state file at all (`diffCeilingState(null, current)`), AND a
 * per-distance row emitted when the previous file loaded but that one
 * distance's entry was individually skipped as malformed — both cases mean
 * "no usable previous value existed for this comparison."
 */
export type CeilingMovementKind =
  | 'first-run'
  | 'ceiling-moved'
  | 'became-fail-open'
  | 'became-derivable'
  | 'population-changed';

/**
 * One row of reported movement. `distance` is `null` ONLY for the single
 * aggregate row produced when the whole previous state is absent — every
 * other row (including a per-distance `'first-run'`) names a real distance.
 */
export interface CeilingMovementRow {
  distance: TargetDistanceKey | null;
  kind: CeilingMovementKind;
  previousCeilingMps: number | null;
  currentCeilingMps: number | null;
  previousP90Mps: number | null;
  currentP90Mps: number | null;
  previousPopulationN: number | null;
  currentPopulationN: number | null;
}

/**
 * Reads and validates `ceilingStatePath` via `fileStore`. Total and
 * never-throwing: ANY failure — missing file, unparseable JSON, wrong
 * `schemaVersion`, missing/malformed `ceilings` object — resolves to `null`
 * after a single `console.warn` naming the path and the reason, mirroring
 * `loadExclusions`'s catch-and-warn shape exactly.
 *
 * A per-distance entry that is not an object, or whose `ceilingMps`/`p90Mps`
 * is neither a finite number nor `null`, or whose `populationN` is not a
 * finite number, is skipped with its own `console.warn` while the rest of
 * the file is still used (T-28-06-A).
 */
export async function loadCeilingState(
  fileStore: FileStore,
  ceilingStatePath: string
): Promise<BestEffortCeilingStateFile | null> {
  try {
    const raw = await fileStore.readJson<unknown>(ceilingStatePath);

    if (typeof raw !== 'object' || raw === null) {
      throw new Error('parsed value is not an object');
    }

    const candidate = raw as {
      schemaVersion?: unknown;
      note?: unknown;
      generatedAt?: unknown;
      ceilings?: unknown;
    };

    if (candidate.schemaVersion !== 1) {
      throw new Error(`unsupported schemaVersion: ${JSON.stringify(candidate.schemaVersion)}`);
    }
    if (typeof candidate.generatedAt !== 'string') {
      throw new Error('missing or non-string generatedAt');
    }
    if (typeof candidate.ceilings !== 'object' || candidate.ceilings === null) {
      throw new Error('missing ceilings object');
    }

    const rawCeilings = candidate.ceilings as Record<string, unknown>;
    const ceilings = {} as BestEffortCeilingStateFile['ceilings'];
    let survivingCount = 0;

    for (const distance of TARGET_ORDER) {
      const rawEntry = rawCeilings[distance];
      if (typeof rawEntry !== 'object' || rawEntry === null) {
        console.warn(
          `loadCeilingState: ${ceilingStatePath} has a malformed entry for distance "${distance}" (not an object); skipping that distance only`
        );
        continue;
      }

      const entry = rawEntry as {
        ceilingMps?: unknown;
        p90Mps?: unknown;
        populationN?: unknown;
      };

      const isFiniteOrNull = (value: unknown): value is number | null =>
        value === null || (typeof value === 'number' && Number.isFinite(value));

      if (!isFiniteOrNull(entry.ceilingMps)) {
        console.warn(
          `loadCeilingState: ${ceilingStatePath} has a malformed ceilingMps for distance "${distance}"; skipping that distance only`
        );
        continue;
      }
      if (!isFiniteOrNull(entry.p90Mps)) {
        console.warn(
          `loadCeilingState: ${ceilingStatePath} has a malformed p90Mps for distance "${distance}"; skipping that distance only`
        );
        continue;
      }
      if (typeof entry.populationN !== 'number' || !Number.isFinite(entry.populationN)) {
        console.warn(
          `loadCeilingState: ${ceilingStatePath} has a malformed populationN for distance "${distance}"; skipping that distance only`
        );
        continue;
      }

      ceilings[distance] = {
        ceilingMps: entry.ceilingMps,
        p90Mps: entry.p90Mps,
        populationN: entry.populationN,
      };
      survivingCount++;
    }

    const result: BestEffortCeilingStateFile = {
      schemaVersion: 1,
      note: typeof candidate.note === 'string' ? candidate.note : '',
      generatedAt: candidate.generatedAt,
      ceilings,
    };

    console.log(
      `Loaded previous ceiling state (${survivingCount}/${TARGET_ORDER.length} distances) from ${ceilingStatePath}`
    );
    return result;
  } catch (error) {
    console.warn(
      `Could not load ceiling state from ${ceilingStatePath}: ${(error as Error).message}; treating this run as the first`
    );
    return null;
  }
}

/**
 * Projects the full `Record<TargetDistanceKey, CeilingDerivation>` down to
 * the three persisted fields per distance, iterating `TARGET_ORDER` so key
 * order is fixed and the committed file is diff-stable.
 */
export function buildCeilingStateFile(
  ceilings: Record<TargetDistanceKey, CeilingDerivation>,
  generatedAt: string
): BestEffortCeilingStateFile {
  const projected = {} as BestEffortCeilingStateFile['ceilings'];

  for (const distance of TARGET_ORDER) {
    const derivation = ceilings[distance];
    projected[distance] = {
      ceilingMps: derivation.ceilingMps,
      p90Mps: derivation.p90Mps,
      populationN: derivation.populationN,
    };
  }

  return {
    schemaVersion: 1,
    note:
      'Machine-written. Exists because data/stats/ is gitignored and starts empty on every CI ' +
      "runner, so this file is the only durable record of the previous run's derived personal " +
      'plausibility ceiling. Committed so a ceiling move is a blameable commit (Phase 28 D-06/D-07). ' +
      'Do not hand-edit; a malformed entry degrades that one distance to a warning, never an abort.',
    generatedAt,
    ceilings: projected,
  };
}

/**
 * Compares `previous` (as loaded by `loadCeilingState`, or `null` when no
 * prior state exists) against `current` (this run's fresh `deriveCeilings`
 * output) and returns one movement row per distance that actually changed.
 *
 * `previous === null` yields a SINGLE aggregate `'first-run'` row rather
 * than seven noisy per-distance rows — there is nothing distance-specific
 * to report when there was no file to compare against at all.
 *
 * When `previous` is non-null but one distance's entry was individually
 * skipped by `loadCeilingState` (a malformed single entry), that distance
 * gets its OWN per-distance `'first-run'` row, since a real comparison for
 * that one distance is not possible.
 *
 * Numeric comparison is EXACT equality (`!==`), never an epsilon: plan
 * 28-03's `deriveCeiling` is interpolation-free and rounds to four decimal
 * places, so an epsilon comparison here would hide exactly the drift this
 * file exists to catch.
 */
export function diffCeilingState(
  previous: BestEffortCeilingStateFile | null,
  current: Record<TargetDistanceKey, CeilingDerivation>
): CeilingMovementRow[] {
  if (previous === null) {
    return [
      {
        distance: null,
        kind: 'first-run',
        previousCeilingMps: null,
        currentCeilingMps: null,
        previousP90Mps: null,
        currentP90Mps: null,
        previousPopulationN: null,
        currentPopulationN: null,
      },
    ];
  }

  const rows: CeilingMovementRow[] = [];

  for (const distance of TARGET_ORDER) {
    const prev: PersistedCeiling | undefined = previous.ceilings[distance];
    const curr = current[distance];

    if (!prev) {
      rows.push({
        distance,
        kind: 'first-run',
        previousCeilingMps: null,
        currentCeilingMps: curr.ceilingMps,
        previousP90Mps: null,
        currentP90Mps: curr.p90Mps,
        previousPopulationN: null,
        currentPopulationN: curr.populationN,
      });
      continue;
    }

    const ceilingChanged = prev.ceilingMps !== curr.ceilingMps;
    const p90Changed = prev.p90Mps !== curr.p90Mps;
    const populationChanged = prev.populationN !== curr.populationN;

    if (!ceilingChanged && !p90Changed && !populationChanged) continue;

    let kind: CeilingMovementKind;
    if (prev.ceilingMps === null && curr.ceilingMps !== null) {
      kind = 'became-derivable';
    } else if (prev.ceilingMps !== null && curr.ceilingMps === null) {
      kind = 'became-fail-open';
    } else if (ceilingChanged) {
      kind = 'ceiling-moved';
    } else {
      kind = 'population-changed';
    }

    rows.push({
      distance,
      kind,
      previousCeilingMps: prev.ceilingMps,
      currentCeilingMps: curr.ceilingMps,
      previousP90Mps: prev.p90Mps,
      currentP90Mps: curr.p90Mps,
      previousPopulationN: prev.populationN,
      currentPopulationN: curr.populationN,
    });
  }

  return rows;
}

/** Renders a number for console output, or the literal `n/a` for `null`. */
function fmt(value: number | null, digits = 4): string {
  return value === null ? 'n/a' : value.toFixed(digits);
}

/**
 * Renders `rows` as console lines in the house register — a named condition
 * with its measured values, never an adjective (Phase 27 D-09). Returns a
 * string array so the caller decides how to print; this module has no side
 * effect here other than `loadCeilingState`'s own warnings.
 */
export function formatCeilingMovement(rows: CeilingMovementRow[]): string[] {
  return rows.map((row) => {
    if (row.distance === null) {
      return 'first run — no previous ceiling state recorded; every distance will report its movement starting next run';
    }

    switch (row.kind) {
      case 'ceiling-moved':
        return (
          `${row.distance} ceiling moved ${fmt(row.previousCeilingMps)} -> ${fmt(row.currentCeilingMps)} m/s ` +
          `(p90 ${fmt(row.previousP90Mps)} -> ${fmt(row.currentP90Mps)}, n ${row.previousPopulationN} -> ${row.currentPopulationN})`
        );
      case 'became-fail-open':
        return (
          `${row.distance} ceiling became fail-open: was ${fmt(row.previousCeilingMps)} m/s ` +
          `(p90 ${fmt(row.previousP90Mps)} over ${row.previousPopulationN}); now population ${row.currentPopulationN} yields no ceiling`
        );
      case 'became-derivable':
        return (
          `${row.distance} ceiling newly derivable: ${fmt(row.currentCeilingMps)} m/s ` +
          `(p90 ${fmt(row.currentP90Mps)} over ${row.currentPopulationN}); previously fail-open over ${row.previousPopulationN}`
        );
      case 'population-changed':
        return (
          `${row.distance} population changed ${row.previousPopulationN} -> ${row.currentPopulationN} ` +
          `(ceiling ${fmt(row.previousCeilingMps)} -> ${fmt(row.currentCeilingMps)} m/s)`
        );
      case 'first-run':
      default:
        return (
          `${row.distance} ceiling first recorded this run: ${fmt(row.currentCeilingMps)} m/s ` +
          `(p90 ${fmt(row.currentP90Mps)} over ${row.currentPopulationN}); no usable previous entry`
        );
    }
  });
}
