/**
 * The single ordered declaration of the compute-all-stats chain (D-01):
 * both `computeAllStatsCommand` (src/index.ts) and `daily-refresh.yml`'s
 * single `compute-all-stats --ci` invocation consume this table instead of
 * each hand-maintaining their own copy of the chain. Mirrors
 * `src/dashboard/view-registry.ts`'s "one flat array, one entry per unit,
 * one place to add the next one" convention.
 *
 * Chain ordering below is load-bearing — each step consumes a previous
 * step's output, except `compute-training-load`, which is independent of
 * the others and runs last for the same reason `compute-best-efforts` used
 * to run last (nothing downstream of it in this chain depends on it):
 *   1. compute-stats            — no dependency; the foundational pass over
 *      synced activities.
 *   2. compute-advanced-stats   — reads the same activities archive as (1);
 *      kept second because it was always run immediately after basic stats.
 *   3. compute-geo-stats        — independent; reads activities + GPS data.
 *   4. compute-best-efforts     — depends on committed streams, not on the
 *      other stats outputs.
 *   5. compute-age-grading      — reads best-efforts.json (step 4).
 *   6. compute-dashboard-index  — reads best-efforts.json + gear.json; is
 *      the prerequisite for step 7.
 *   7. compute-gear-aggregate   — reads data/dashboard/index.json (step 6).
 *   8. compute-training-load    — reads the stream manifest; independent of
 *      every other step, which is why it runs last.
 *
 * Drift resolution (D-01) — the pre-existing drift is closed here:
 * `daily-refresh.yml` used to run
 * `compute-dashboard-index` before `compute-age-grading`, while this code's
 * chain has always run `compute-age-grading` first. The code order wins —
 * this file's own numbered dependency chain above is the declaration D-01
 * makes authoritative — and the change is behaviour-neutral: neither step
 * depends on the other's output (both only need `best-efforts.json`), so
 * swapping their relative order changes nothing either one reads or writes.
 *
 * Gitignored outputs (carried forward from the deleted YAML comments):
 * `data/stats/` and `data/dashboard/` are both gitignored and regenerated
 * on every run, so they are deliberately absent from the nightly workflow's
 * data-commit step's `file_pattern`.
 *
 * Why only `compute-geo-stats` is tolerated (WR-01):
 * `mandatory` only has an effect under `--ci`; without it every step already
 * rethrows and halts the walk (`continueOnError: false`, D-02). So the only
 * question this flag answers is "under `--ci`, can the pipeline still ship a
 * correct site if this step failed?".
 *
 * For every step except `compute-geo-stats` the answer is no, and it is not
 * a judgement call: `data/stats/` and `data/dashboard/` are gitignored, so a
 * CI runner starts with them empty and a failed step leaves its document
 * *missing*, not stale. `scripts/verify-dashboard-publish.mjs` — a blocking
 * gate in the same job, with no escape hatch by design — then hard-requires
 * every one of those documents over HTTP:
 *   compute-stats            -> all-time-totals, streaks, weekly-distance,
 *                               monthly-stats, yearly-stats
 *   compute-advanced-stats   -> year-over-year.json
 *   compute-best-efforts     -> best-efforts.json + the shard sample
 *   compute-age-grading      -> age-grading.json (written even on the
 *                               disabled path, so CI's expected
 *                               `enabled: false` is not a failure)
 *   compute-dashboard-index  -> data/dashboard/index.json
 *   compute-gear-aggregate   -> gear-aggregate.json
 *   compute-training-load    -> training-load.json
 * Tolerating those steps therefore bought nothing: the run ended in a red
 * verify step and no deploy either way — and, because `Deploy widgets` and
 * `Commit updated data` both sit after the gate with no `if: always()`, not
 * even the freshly fetched activities were persisted. The only thing
 * tolerance changed was *where* the failure was reported: at a generic HTTP
 * 404 several steps later instead of at the step that actually broke.
 * Promoting them is outcome-neutral and strictly more legible.
 *
 * `compute-geo-stats` is genuinely different and stays tolerated: it writes
 * `data/geo/`, which IS committed, so a failure leaves the previous run's
 * real data in place, the verifier requires nothing fresh from it, and the
 * site publishes correctly with slightly stale geocoding. That is a real
 * degrade path, which is why it keeps its warning string.
 *
 * `compute-age-grading` reports `enabled: false` in CI by design, because
 * `data/private/athlete-private.json` must not exist there (it holds
 * birthDate/sex, gitignored on purpose). That is the expected and correct
 * CI state, not a failure — do not "fix" it by committing the private file.
 * The step still exits successfully; see `compute-age-grading`'s own
 * disabled-path contract.
 */

import { config } from './config/strava.config.js';

/** One entry in the compute-all-stats chain (D-01/D-02/D-03). */
export interface ComputeStep {
  /** The CLI subcommand name, e.g. `'compute-geo-stats'`. */
  name: string;
  /** D-03's split: mandatory steps abort the whole run on failure. */
  mandatory: boolean;
  /**
   * The `::warning::` message body emitted when this step is tolerated
   * (`--ci`) and fails. `null` for mandatory steps — they abort, so they
   * never warn.
   */
  warning: string | null;
  /** The step's work. Always a dynamic import so importing this module
   *  never pulls in any compute code. */
  run: () => Promise<void>;
}

export const COMPUTE_ALL_STATS_STEPS: readonly ComputeStep[] = [
  {
    name: 'compute-stats',
    mandatory: true,
    warning: null,
    run: async () => {
      const { computeAllStats } = await import('./analytics/compute-stats.js');
      await computeAllStats({
        activitiesDir: config.activitiesDir,
        statsDir: 'data/stats',
      });
    },
  },
  {
    name: 'compute-advanced-stats',
    mandatory: true,
    warning: null,
    run: async () => {
      const { computeAdvancedStats } = await import('./analytics/compute-advanced-stats.js');
      await computeAdvancedStats({
        activitiesDir: config.activitiesDir,
        statsDir: 'data/stats',
      });
    },
  },
  {
    name: 'compute-geo-stats',
    mandatory: false,
    warning: 'Geocoding failed, widgets will use cached geo data',
    run: async () => {
      const { computeGeoStats } = await import('./geo/compute-geo-stats.js');
      await computeGeoStats({
        activitiesDir: config.activitiesDir,
        geoDir: 'data/geo',
      });
    },
  },
  {
    name: 'compute-best-efforts',
    mandatory: true,
    warning: null,
    run: async () => {
      const { computeBestEfforts } = await import('./analytics/compute-best-efforts.js');
      await computeBestEfforts({
        activitiesDir: config.activitiesDir,
        streamsDir: config.streamsDir,
        streamsManifestPath: config.streamsManifestPath,
        statsDir: 'data/stats',
      });
    },
  },
  {
    name: 'compute-age-grading',
    mandatory: true,
    warning: null,
    run: async () => {
      const { computeAgeGrading } = await import('./analytics/compute-age-grading.js');
      await computeAgeGrading({
        statsDir: 'data/stats',
        wmaDir: 'data/wma',
      });
    },
  },
  {
    name: 'compute-dashboard-index',
    mandatory: true,
    warning: null,
    run: async () => {
      const { computeDashboardIndex } = await import('./analytics/compute-dashboard-index.js');
      await computeDashboardIndex({
        activitiesDir: config.activitiesDir,
        streamsManifestPath: config.streamsManifestPath,
        statsDir: 'data/stats',
        geoDir: 'data/geo',
        outDir: 'data/dashboard',
      });
    },
  },
  {
    name: 'compute-gear-aggregate',
    mandatory: true,
    warning: null,
    run: async () => {
      const { computeGearAggregate } = await import('./analytics/compute-gear-aggregate.js');
      await computeGearAggregate({
        indexPath: 'data/dashboard/index.json',
        outDir: 'data/stats',
      });
    },
  },
  {
    name: 'compute-training-load',
    mandatory: true,
    warning: null,
    run: async () => {
      const { computeTrainingLoad } = await import('./analytics/compute-training-load.js');
      await computeTrainingLoad({
        activitiesDir: config.activitiesDir,
        streamsDir: config.streamsDir,
        streamsManifestPath: config.streamsManifestPath,
        statsDir: 'data/stats',
      });
    },
  },
];

/** A tolerated step that failed while `continueOnError` was true. */
export interface DegradedStep {
  name: string;
  message: string;
}

/**
 * Walks `steps` in array order, awaiting each `run()` (D-01/D-02/D-03 in
 * executable form).
 *
 * - A MANDATORY step's rejection always rethrows immediately, regardless of
 *   `continueOnError` — mandatory steps stay fail-fast no matter what.
 * - A TOLERATED step's rejection with `continueOnError: false` (the
 *   default, hand-run posture) also rethrows immediately — fail-fast is the
 *   default so a hand-run aborts loudly (D-02).
 * - A TOLERATED step's rejection with `continueOnError: true` emits
 *   `::warning::<step.warning>` via `log` (GitHub Actions parses
 *   `::warning::` from any step's log output), records a `DegradedStep`,
 *   and continues to the next step.
 *
 * `log` defaults to `console.log` but exists so callers (and tests) can
 * capture emitted lines without spying on `console`.
 */
export async function runComputeAllStatsSteps(
  steps: readonly ComputeStep[],
  options: { continueOnError: boolean; log?: (line: string) => void }
): Promise<DegradedStep[]> {
  const log = options.log ?? console.log;
  const degraded: DegradedStep[] = [];

  for (const step of steps) {
    try {
      await step.run();
    } catch (error: any) {
      if (step.mandatory || !options.continueOnError) {
        throw error;
      }
      const message = error?.message ?? String(error);
      log(`::warning::${step.warning}`);
      degraded.push({ name: step.name, message });
    }
  }

  return degraded;
}
