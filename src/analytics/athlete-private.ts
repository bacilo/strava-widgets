/**
 * Loader and validator for the hand-maintained, gitignored
 * `data/private/athlete-private.json` (`birthDate`, `sex`, `restingHr`).
 *
 * **Build-time-only.** This repo is PUBLIC (`github.com/bacilo/strava-widgets`)
 * publishing to GitHub Pages; identity/health fields must never reach the
 * browser or the published artifact. This module imports nothing sourced
 * under `src/dashboard/`, and nothing under `src/dashboard/` may import it
 * (T-18-PII-01 — see `18-01-PLAN.md`'s `<locked_deviation>` for why this
 * lives at a different path than `data/config/athlete.json`, CONTEXT.md
 * D-12's literal wording notwithstanding).
 *
 * `parseAthletePrivateConfig` mirrors the total, never-throws, own-property-
 * only validation idiom of `parseAthleteConfig`
 * (`src/dashboard/views/detail-zones.ts`) and `parseGearDocument`.
 * `loadAthletePrivateConfig` mirrors the warn-and-degrade pattern from
 * `compute-dashboard-index.ts` — any failure (missing file, malformed JSON,
 * failed validation) logs one `console.warn` naming the path and the
 * consequence, then resolves to `null`. Never throws, never fabricates a
 * value (D-13).
 */

export const ATHLETE_PRIVATE_SCHEMA_VERSION = 1;

export type AthleteSex = 'male' | 'female';

export interface AthletePrivateConfig {
  schemaVersion: number;
  birthDate: string;
  sex: AthleteSex;
  restingHr: number | null;
}

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_BIRTH_DATE = 'YYYY-MM-DD';
const MIN_RESTING_HR = 20;
const MAX_RESTING_HR = 120;

/** Own-property read only — guards against prototype-pollution reachability (T-18-PROTO-01). */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * `true` only when `value` is a real, parseable UTC calendar date matching
 * `YYYY-MM-DD` — rejects both the literal placeholder and strings that match
 * the pattern but don't parse to a real date (e.g. `2020-13-40`).
 */
function isRealIsoDate(value: string): boolean {
  if (value === PLACEHOLDER_BIRTH_DATE) return false;
  if (!BIRTH_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Reject dates that "roll over" (e.g. 2020-02-30 -> 2020-03-01): confirm
  // the round-tripped ISO date string still starts with the input.
  return parsed.toISOString().startsWith(value);
}

/**
 * Total, never-throwing, all-or-nothing gate over the parsed JSON body of
 * `data/private/athlete-private.json`. Any single validation failure on a
 * REQUIRED field returns `null` so the whole config is omitted (D-13)
 * rather than half-rendered. `restingHr` is the one OPTIONAL, tolerant
 * field — Edwards TRIMP and age-grading do not need it (D-14), so an
 * absent, placeholder, or out-of-range value degrades to `null` rather than
 * rejecting the whole config.
 */
export function parseAthletePrivateConfig(raw: unknown): AthletePrivateConfig | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (!hasOwn(obj, 'schemaVersion')) return null;
  const schemaVersion = obj.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) return null;

  if (!hasOwn(obj, 'birthDate')) return null;
  const birthDate = obj.birthDate;
  if (typeof birthDate !== 'string' || !isRealIsoDate(birthDate)) return null;

  if (!hasOwn(obj, 'sex')) return null;
  const sex = obj.sex;
  if (sex !== 'male' && sex !== 'female') return null;

  let restingHr: number | null = null;
  if (hasOwn(obj, 'restingHr')) {
    const rawRestingHr = obj.restingHr;
    if (
      typeof rawRestingHr === 'number' &&
      Number.isFinite(rawRestingHr) &&
      rawRestingHr >= MIN_RESTING_HR &&
      rawRestingHr <= MAX_RESTING_HR
    ) {
      restingHr = rawRestingHr;
    }
  }

  return { schemaVersion, birthDate, sex, restingHr };
}

/**
 * Reads and parses `filePath` via `fileStore`, returning a validated
 * `AthletePrivateConfig`. On ANY failure (ENOENT, malformed JSON, failed
 * validation) logs one `console.warn` naming the path and the consequence,
 * then resolves to `null`. Never throws — mirrors the warn-and-degrade
 * pattern in `compute-dashboard-index.ts` (lines 90-114) and
 * `loadExclusions` in `best-effort-exclusions.ts`.
 */
export async function loadAthletePrivateConfig(
  fileStore: { readJson<T>(p: string): Promise<T> },
  filePath = 'data/private/athlete-private.json'
): Promise<AthletePrivateConfig | null> {
  try {
    const raw = await fileStore.readJson<unknown>(filePath);
    const config = parseAthletePrivateConfig(raw);
    if (config === null) {
      console.warn(
        `${filePath} did not pass validation; age-grading and training-load features that depend on it will be omitted.`
      );
      return null;
    }
    return config;
  } catch (error) {
    console.warn(
      `Could not read ${filePath} (${(error as Error).message}); age-grading and training-load features that depend on it will be omitted.`
    );
    return null;
  }
}
