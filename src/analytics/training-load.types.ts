/**
 * Published training-load document contract — `data/stats/training-load.json`
 * (TREND-04, D-14/D-15/D-16).
 *
 * This is a PUBLISHED PUBLIC ARTIFACT, served statically to any visitor of
 * the dashboard (mirroring `best-effort.types.ts`'s document conventions:
 * `schemaVersion`, `generatedAt`, `note`). It carries `runs`/`runsWithHr`
 * per day so the client can derive D-15's thin-HR-coverage spans itself
 * from published data, and it MUST NEVER carry `restingHr`, `sex`,
 * `birthDate`, or per-activity heart-rate values — those are private
 * athlete-identity inputs that feed the Banister computation at build time
 * but must not survive into what ships to the browser (T-18-PII-05).
 *
 * Per 18-UI-SPEC § 11's data-contract expectation: BOTH the Edwards and
 * Banister series live in this one document, so the client's model toggle
 * (D-14) is a pure re-render with no refetch.
 */

export const TRAINING_LOAD_SCHEMA_VERSION = 1;

export interface DailyLoadEntry {
  date: string;
  runs: number;
  runsWithHr: number;
  edwards: { trimp: number; ctl: number; atl: number; tsb: number };
  banister: { trimp: number; ctl: number; atl: number; tsb: number } | null;
}

export interface TrainingLoadDocument {
  schemaVersion: number;
  generatedAt: string;
  note: string;
  timeConstants: { ctlDays: number; atlDays: number };
  models: { edwards: boolean; banister: boolean };
  banisterDisabledReason: string | null;
  firstDate: string;
  lastDate: string;
  totals: {
    daysInSpine: number;
    activitiesConsidered: number;
    activitiesWithHr: number;
    activitiesWithoutHr: number;
    activitiesUnreadable: number;
  };
  days: DailyLoadEntry[];
}
