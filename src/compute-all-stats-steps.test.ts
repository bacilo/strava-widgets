/**
 * Data-only assertions on the compute-all-stats step table (D-01/D-02/D-03),
 * plus walker-disposition assertions for the --ci flag driven by locally
 * constructed fake step arrays. This file imports ONLY from
 * `./compute-all-stats-steps.js` — never from `./index.js`, which calls
 * `main()` and `process.exit` at module load, matching
 * `view-registry.test.ts`'s convention of explaining in a docblock why the
 * test is data-only. `run` on any member of `COMPUTE_ALL_STATS_STEPS` is
 * NEVER invoked — invoking it would trigger the real compute pipeline.
 */

import { describe, expect, it } from 'vitest';

import { COMPUTE_ALL_STATS_STEPS, runComputeAllStatsSteps, type ComputeStep } from './compute-all-stats-steps.js';

const EXPECTED_ORDER = [
  'compute-stats',
  'compute-advanced-stats',
  'compute-geo-stats',
  'compute-best-efforts',
  'compute-age-grading',
  'compute-dashboard-index',
  'compute-gear-aggregate',
  'compute-training-load',
];

const EXPECTED_MANDATORY = new Set(['compute-stats', 'compute-advanced-stats']);

const EXPECTED_TOLERATED_WARNINGS: Record<string, string> = {
  'compute-geo-stats': 'Geocoding failed, widgets will use cached geo data',
  'compute-best-efforts': 'Best-effort computation failed, records data will be stale',
  'compute-dashboard-index': 'Dashboard index computation failed, the dashboard will serve a stale index',
  'compute-age-grading': 'Age-grading computation failed, age-grade data will be stale',
  'compute-gear-aggregate': 'Gear aggregate computation failed, gear data will be stale',
  'compute-training-load': 'Training load computation failed, training load data will be stale',
};

describe('COMPUTE_ALL_STATS_STEPS', () => {
  it('declares the eight step names in the documented order — no .sort(), order is the thing under test', () => {
    expect(COMPUTE_ALL_STATS_STEPS.map((s) => s.name)).toEqual(EXPECTED_ORDER);
  });

  it('contains no duplicate step names', () => {
    const names = COMPUTE_ALL_STATS_STEPS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("D-03's split: exactly compute-stats and compute-advanced-stats are mandatory", () => {
    for (const step of COMPUTE_ALL_STATS_STEPS) {
      expect(step.mandatory).toBe(EXPECTED_MANDATORY.has(step.name));
    }
  });

  it('every tolerated step has a non-empty warning string; both mandatory steps have warning === null', () => {
    for (const step of COMPUTE_ALL_STATS_STEPS) {
      if (step.mandatory) {
        expect(step.warning).toBeNull();
      } else {
        expect(typeof step.warning).toBe('string');
        expect((step.warning as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('every entry has typeof step.run === "function" — asserted, never called', () => {
    for (const step of COMPUTE_ALL_STATS_STEPS) {
      expect(typeof step.run).toBe('function');
    }
  });

  it('the six tolerated warning strings match the verbatim messages the deleted daily-refresh.yml "Warn on X failure" steps carried', () => {
    for (const step of COMPUTE_ALL_STATS_STEPS) {
      const expected = EXPECTED_TOLERATED_WARNINGS[step.name];
      if (expected) {
        expect(step.warning).toBe(expected);
      }
    }
  });
});

describe('runComputeAllStatsSteps', () => {
  function fakeStep(overrides: Partial<ComputeStep> & { name: string }, ran: string[]): ComputeStep {
    const { name, mandatory = false, warning = null, run } = overrides;
    return {
      name,
      mandatory,
      warning,
      run:
        run ??
        (async () => {
          ran.push(name);
        }),
    };
  }

  it('continueOnError: false (the default hand-run posture, D-02) — a rejecting tolerated step rejects the walk, and steps after it do not run', async () => {
    const ran: string[] = [];
    const steps: ComputeStep[] = [
      fakeStep({ name: 'a' }, ran),
      fakeStep(
        {
          name: 'b',
          warning: 'b failed',
          run: async () => {
            ran.push('b');
            throw new Error('b broke');
          },
        },
        ran
      ),
      fakeStep({ name: 'c' }, ran),
    ];

    await expect(runComputeAllStatsSteps(steps, { continueOnError: false })).rejects.toThrow('b broke');
    expect(ran).toEqual(['a', 'b']);
  });

  it('continueOnError: true — a rejecting tolerated step does not reject; subsequent steps still run; the returned array names it; the log carries ::warning::<warning text>', async () => {
    const ran: string[] = [];
    const logged: string[] = [];
    const steps: ComputeStep[] = [
      fakeStep({ name: 'a' }, ran),
      fakeStep(
        {
          name: 'b',
          warning: 'b tolerated failure message',
          run: async () => {
            ran.push('b');
            throw new Error('b broke');
          },
        },
        ran
      ),
      fakeStep({ name: 'c' }, ran),
    ];

    const degraded = await runComputeAllStatsSteps(steps, {
      continueOnError: true,
      log: (line) => logged.push(line),
    });

    expect(ran).toEqual(['a', 'b', 'c']);
    expect(degraded).toEqual([{ name: 'b', message: 'b broke' }]);
    expect(logged).toContain('::warning::b tolerated failure message');
  });

  it('continueOnError: true — a rejecting mandatory step still rejects and halts the walk; the flag must not soften mandatory steps', async () => {
    const ran: string[] = [];
    const steps: ComputeStep[] = [
      fakeStep({ name: 'a' }, ran),
      fakeStep(
        {
          name: 'b',
          mandatory: true,
          warning: null,
          run: async () => {
            ran.push('b');
            throw new Error('b broke');
          },
        },
        ran
      ),
      fakeStep({ name: 'c' }, ran),
    ];

    await expect(runComputeAllStatsSteps(steps, { continueOnError: true })).rejects.toThrow('b broke');
    expect(ran).toEqual(['a', 'b']);
  });

  it('all-green case: returns an empty array and emits no ::warning:: line', async () => {
    const ran: string[] = [];
    const logged: string[] = [];
    const steps: ComputeStep[] = [fakeStep({ name: 'a' }, ran), fakeStep({ name: 'b' }, ran), fakeStep({ name: 'c' }, ran)];

    const degraded = await runComputeAllStatsSteps(steps, {
      continueOnError: true,
      log: (line) => logged.push(line),
    });

    expect(degraded).toEqual([]);
    expect(logged).toEqual([]);
  });
});
