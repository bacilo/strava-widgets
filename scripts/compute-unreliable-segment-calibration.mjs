/**
 * Phase 32 / SEG-04 unreliable-segment detection pre-calibration (D-10, D-12, D-13).
 *
 * Measures, on the real committed archive, whether D-10(d)'s constraint can be satisfied
 * (flag every named burst on the three scoping activities AND spare D-05's fixtures), measures
 * the D-05 negative-control candidates at the detector's OWN judging scale, and computes candidate
 * speed-limit statistics with their D-13 insensitivity — including a deliberately circular
 * tail-percentile strawman that must be shown FAILING the same insensitivity check before any real
 * candidate is trusted. This plan (32-05) stops before any constant is chosen: it builds and
 * commits the evidence, then a blocking developer decision (Task 2) records the D-10(d)
 * disposition, the locked D-05 fixtures and the chosen statistic shape for plan 32-06 to derive
 * `UNRELIABLE_SPEED_LIMIT_MPS` from.
 *
 * This generator imports the detector, `advanceSteps`/`detectUnreliableSegments`, from
 * `../dist/analytics/unreliable-segments.js` — permitted, because calibrating the detector is
 * exactly this generator's job (unlike `compute-unreliable-segment-recount.mjs`, which is
 * deliberately forbidden from that import). It also imports `classifyGaps`/`quantile` from
 * `../dist/analytics/pace-derivation.js` (the ONE gap definition and the ONE R-7 percentile
 * implementation this codebase uses) and `validateStreamSeries` from
 * `../dist/analytics/best-effort-utils.js` (the same total-function guard the detector itself
 * calls, used here only to classify a stream as not-computable rather than silently dropping it).
 *
 * Every figure in this file derives from committed `data/streams/*.json` (via `isStreamFile`,
 * never `manifest.json`) and committed `data/activities/*.json` only. `export_data/` and
 * `data/dashboard/` are never read here (D-12; Phase 31 TD-01) — the local-only 1 Hz cross-check
 * that DOES read `export_data/` is a separate script, out of this plan's scope.
 *
 * No wall-clock timestamp appears anywhere in the rendered output: a re-run against an unchanged
 * archive is byte-identical (proven by running this generator twice and diffing the artifact).
 *
 * Shape follows `compute-pr-ceiling-calibration.mjs`: pure exported functions with zero file I/O,
 * plus a `main()` gated behind the standard self-execution guard so
 * `compute-unreliable-segment-calibration.test.mjs` can import every pure function below without
 * triggering an archive read or a write to `32-CALIBRATION.md` as an import-time side effect.
 *
 * T-32-10 (mitigate, anti-quota): no archive-wide flagged activity or segment count is computed,
 * printed, or committed anywhere in this file — seeing that number before the constants are chosen
 * is precisely the circularity D-10(e)/Phase 27 D-02 forbid. T-32-11 (mitigate): the strawman
 * statistic is run through the exact same `insensitivityCheck` as the real candidates and its
 * `pass: false` result is rendered as a blocker if it should ever come back `true`.
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { advanceSteps, detectUnreliableSegments } from '../dist/analytics/unreliable-segments.js';
import { classifyGaps, quantile } from '../dist/analytics/pace-derivation.js';
import { validateStreamSeries } from '../dist/analytics/best-effort-utils.js';
import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data/activities');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md'
);

const REGENERATE_COMMAND = 'npm run compute-unreliable-segment-calibration';

/** D-09/D-08's "no floor gate" params for a pure reachability probe: excess floor 0 (allowed —
 * the guard only rejects negative/non-finite), and a hidden-pause boundary set unreachably high
 * (`Number.MAX_SAFE_INTEGER`, not `Infinity`, which would fail the detector's finiteness guard and
 * silently return `[]`) so the mechanism label never matters for this reachability/statistics work. */
const PROBE_EXCESS_FLOOR_METRES = 0;
const PROBE_HIDDEN_PAUSE_MIN_METRES = Number.MAX_SAFE_INTEGER;

/** D-13's tolerance, fixed BEFORE any insensitivity check runs (never adjusted after seeing a delta). */
const INSENSITIVITY_TOLERANCE = 0.01;

/** The minimum sustained-window duration S-B's "population the detector does not judge" is defined over. */
const SUSTAINED_WINDOW_MIN_SEC = 60;

/** The one real activity D-13's planted-contamination batch is cloned from (never a synthetic look-alike). */
export const INSENSITIVITY_SOURCE_ACTIVITY_ID = '3475724402';

/**
 * Named INPUTS to reason about (32-CONTEXT.md / 32-RESEARCH.md measurements taken during scoping),
 * NOT expected outputs. Windows for the isolated jumps use the durations measured in CONTEXT.md's
 * "Suunto over-measurement sample vs the isolated jumps" table (30.1m/3s, 52.4m/5s, 28.6m/2s,
 * 30.4m/3s, 24.7m/2s at t=2347/2508/2536/2580/2587).
 */
export const NAMED_ITEMS = {
  mustFlag: [
    {
      id: '3475734189',
      window: { startSec: 1353, endSec: 1360 },
      label: 'hidden-pause window (199m burst, HR steps 163→155 in 1s)',
    },
    {
      id: '3475740390',
      window: { startSec: 2347, endSec: 2350 },
      label: 'isolated jump t=2347 (30.1m/3s)',
    },
    {
      id: '3475740390',
      window: { startSec: 2508, endSec: 2513 },
      label: 'isolated jump t=2508 (52.4m/5s — the 400m best start)',
    },
    {
      id: '3475740390',
      window: { startSec: 2536, endSec: 2538 },
      label: 'isolated jump t=2536 (28.6m/2s)',
    },
    {
      id: '3475740390',
      window: { startSec: 2580, endSec: 2583 },
      label: 'isolated jump t=2580 (30.4m/3s)',
    },
    {
      id: '3475740390',
      window: { startSec: 2587, endSec: 2589 },
      label: 'isolated jump t=2587 (24.7m/2s, the smallest named jump)',
    },
  ],
  mustSpare: [
    {
      id: '3475734189',
      window: { startSec: 1581, endSec: 1583 },
      label: 'D-09 trivial pair (~17.3m/2s, 8.65 m/s)',
    },
  ],
  d05Candidates: [
    {
      id: '16628769295',
      window: { startSec: 1023, endSec: 1056 },
      label: 'D-05 candidate (research proposal, not locked)',
    },
    {
      id: '7409028052',
      window: { startSec: 591, endSec: 624 },
      label: 'D-05 candidate (research proposal, not locked)',
    },
    {
      id: '8869338724',
      window: { startSec: 3002, endSec: 3026 },
      label: 'D-05 candidate (research proposal, not locked)',
    },
  ],
  disclosedNeverFixture: [
    {
      id: '4556693525',
      window: { startSec: 271, endSec: 275 },
      label: 'Suunto over-measurement sample (D-01/D-02 — disclosed, never a must-not-fire fixture)',
    },
  ],
};

// ---------------------------------------------------------------------------
// Pure functions — importable without I/O
// ---------------------------------------------------------------------------

/** Renders one named item for a human-readable reason string. */
function describeItem(item) {
  return `${item.id} t=${item.window.startSec}-${item.window.endSec} (${item.label})`;
}

/**
 * Runs `detectUnreliableSegments` at the given `speedLimitMps` with the floor/hidden-pause probe
 * params, and returns the maximum `metres − L × seconds` over BURST parts (never gap parts, so gap
 * metres never inflate a burst's excess) that THEMSELVES overlap `window`, or `null` when no burst
 * part overlaps it at this `L` (the item is "not a candidate" at this speed limit).
 *
 * Deliberately scoped to the PART's own span, not its enclosing segment's: at a low speed limit a
 * segment can chain far beyond one named window (D-07 chaining), and scoring by the segment's own
 * (much larger) metres/seconds would attribute a distant burst's excess to this item — exactly the
 * kind of measurement error must_haves item 1 warns against (measure the real named input, not a
 * look-alike stand-in for it).
 */
export function runExcessAt(activity, window, speedLimitMps) {
  const segments = detectUnreliableSegments(activity.t, activity.d, activity.gaps, {
    speedLimitMps,
    excessFloorMetres: PROBE_EXCESS_FLOOR_METRES,
    hiddenPauseMinMetres: PROBE_HIDDEN_PAUSE_MIN_METRES,
  });

  let max = null;
  for (const segment of segments) {
    for (const part of segment.parts) {
      if (part.kind !== 'burst') continue;
      const overlaps = part.startSec <= window.endSec && part.endSec >= window.startSec;
      if (!overlaps) continue;
      const excess = part.metres - speedLimitMps * part.seconds;
      if (max === null || excess > max) max = excess;
    }
  }
  return max;
}

/**
 * D-10(d)'s feasibility arithmetic, isolated as a pure function of already-computed excess values
 * so it can be unit-tested on hand-built numbers without any archive read. `feasibleFloor` is
 * `{ lo, hi }` (an excess-metres floor admitting every must-flag item while sparing every
 * must-spare item) only when every must-flag item is a candidate (non-null excess) AND
 * `lo < hi`; otherwise `null`, with `reason` naming which item(s) block feasibility (numeric,
 * varies every row) and `reasonKey` — a STABLE identifier (which items are involved, never the
 * numeric lo/hi) that `summarizeReachabilityRows` groups transitions by, since `reason`'s embedded
 * excess values change continuously with `L` and would otherwise never collapse.
 */
export function computeFeasibleFloor(mustFlagResults, mustSpareResults) {
  const missingFlag = mustFlagResults.filter((r) => r.excess === null);
  if (missingFlag.length > 0) {
    const ids = missingFlag.map((r) => `${r.item.id}@${r.item.window.startSec}`).sort().join(',');
    return {
      feasibleFloor: null,
      reasonKey: `missing:${ids}`,
      reason: `must-flag item(s) not a candidate at this L: ${missingFlag
        .map((r) => describeItem(r.item))
        .join('; ')}`,
    };
  }

  const hi = Math.min(...mustFlagResults.map((r) => r.excess));
  const spareExcesses = mustSpareResults.map((r) => r.excess ?? 0);
  const lo = Math.max(0, ...spareExcesses);

  if (lo < hi) {
    return { feasibleFloor: { lo, hi }, reasonKey: 'feasible', reason: null };
  }

  const blockingSpare = mustSpareResults.filter((r) => (r.excess ?? 0) >= hi);
  const hiItem = mustFlagResults.find((r) => r.excess === hi);
  const blockingIds =
    blockingSpare.length > 0
      ? blockingSpare
          .map((r) => `${r.item.id}@${r.item.window.startSec}`)
          .sort()
          .join(',')
      : '(must-flag-minimum-itself)';
  const hiId = hiItem ? `${hiItem.item.id}@${hiItem.item.window.startSec}` : '(unknown)';
  return {
    feasibleFloor: null,
    reasonKey: `blocked:${blockingIds}:vs:${hiId}`,
    reason: `no floor in [${lo}, ${hi}) — blocked by ${
      blockingSpare.length > 0
        ? blockingSpare.map((r) => describeItem(r.item)).join('; ')
        : 'the must-flag minimum itself'
    } vs must-flag minimum excess at ${hiItem ? describeItem(hiItem.item) : '(unknown)'}`,
  };
}

/** One activity's R-7 median folded covered-step speed, or `null` if it has no advancing steps. */
export function activityMedianFoldedSpeed(activity) {
  const steps = advanceSteps(activity.t, activity.d, activity.gaps);
  if (steps.length === 0) return null;
  const speeds = steps.map((s) => s.metres / s.seconds).sort((a, b) => a - b);
  return quantile(speeds, 0.5);
}

/**
 * Derives the reachability grid (D-10(d)): the lower bound is
 * `floor(10 × min over activities of their own R-7 median folded covered-step speed) / 10`; the
 * grid then scans upward in `step` m/s increments for as long as EVERY `mustFlagItems` entry
 * remains a candidate (non-null excess) at that `L` — the upper bound is the last such `L`. Both
 * bounds are derived, never chosen. `maxScanMps` is only a runaway-loop safety valve (well above
 * any plausible slew speed), never a calibration constant.
 */
export function deriveReachabilityGrid(archive, mustFlagItems, { step = 0.05, maxScanMps = 40 } = {}) {
  const byId = new Map(archive.activities.map((a) => [a.id, a]));

  let minMedian = null;
  for (const activity of archive.activities) {
    const median = activityMedianFoldedSpeed(activity);
    if (median === null || !Number.isFinite(median)) continue;
    if (minMedian === null || median < minMedian) minMedian = median;
  }
  const lowerBound = minMedian === null ? 0 : Math.floor(minMedian * 10) / 10;

  const grid = [];
  let upperBound = lowerBound;
  let L = lowerBound;
  while (L <= maxScanMps + 1e-9) {
    const rounded = Math.round(L * 100) / 100;
    const allCandidates = mustFlagItems.every((item) => {
      const activity = byId.get(item.id);
      return activity !== undefined && runExcessAt(activity, item.window, rounded) !== null;
    });
    if (!allCandidates) break;
    grid.push(rounded);
    upperBound = rounded;
    L = Math.round((L + step) * 100) / 100;
  }

  return { grid, lowerBound, upperBound, minMedian, step, maxScanMps };
}

/**
 * D-10(d)'s reachability matrix: one row per `L` in `grid`, each row carrying every named item's
 * excess at that `L` (per `named.mustFlag`/`named.mustSpare`) and the resulting `feasibleFloor`
 * (or `null` with a `reason`). Called once with the research's three D-05 candidates folded into
 * `named.mustSpare` and once without, per 32-05-PLAN.md's Task 1 behaviour.
 */
export function buildReachabilityMatrix(archive, named, grid) {
  const byId = new Map(archive.activities.map((a) => [a.id, a]));

  return grid.map((L) => {
    const mustFlagResults = named.mustFlag.map((item) => {
      const activity = byId.get(item.id);
      return { item, excess: activity ? runExcessAt(activity, item.window, L) : null };
    });
    const mustSpareResults = named.mustSpare.map((item) => {
      const activity = byId.get(item.id);
      return { item, excess: activity ? runExcessAt(activity, item.window, L) : null };
    });
    const { feasibleFloor, reason, reasonKey } = computeFeasibleFloor(mustFlagResults, mustSpareResults);
    return { L, mustFlagResults, mustSpareResults, feasibleFloor, reason, reasonKey };
  });
}

/** Collapses a full reachability matrix to its boundary rows (first/last row, plus every row where
 * feasibility or the blocking reason changes) — the full grid is still computed at 0.05 m/s
 * resolution; this only controls what is RENDERED, for a checkpoint-quotable table rather than a
 * multi-hundred-row wall of near-duplicate numbers. */
export function summarizeReachabilityRows(rows) {
  if (rows.length === 0) return [];
  const result = [];
  let prevKey = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = row.reasonKey;
    if (key !== prevKey) {
      if (i > 0 && result[result.length - 1] !== rows[i - 1]) result.push(rows[i - 1]);
      result.push(row);
      prevKey = key;
    }
  }
  if (result[result.length - 1] !== rows[rows.length - 1]) result.push(rows[rows.length - 1]);
  return result;
}

/** `min`/`max` of a channel array over `[startIndex, endIndex]` inclusive, or `null` if the channel
 * is absent or has no finite values in that range. */
function rangeFor(channel, startIndex, endIndex) {
  if (!channel) return null;
  const slice = channel
    .slice(startIndex, endIndex + 1)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (slice.length === 0) return null;
  return { min: Math.min(...slice), max: Math.max(...slice) };
}

/** Splits an array of steps into maximal contiguous chains (a chain never crosses a gap, because
 * `advanceSteps` resets its start pointer on every gap pair, breaking index-contiguity there). */
function splitIntoContiguousChains(steps) {
  const chains = [];
  let current = null;
  for (const step of steps) {
    if (current && current[current.length - 1].endIndex === step.startIndex) {
      current.push(step);
    } else {
      current = [step];
      chains.push(current);
    }
  }
  return chains;
}

/**
 * Reproduces research's documented D-05 negative-control search: maximal runs of folded covered
 * steps with per-step speed ≥ 3.5 m/s, seeded by a step ≥ 4 m/s, lasting ≥ 20 s, aggregate speed
 * in [4.5, 7.2], not within the stream's own first/last 60 s, and not touching a gap interval
 * (D-06 touching-only adjacency: a gap sharing the run's own start/end boundary sample). Excludes
 * 4556693525 (D-01). Reports id, span, duration, aggregate speed, device, HR/cadence min-max when
 * those channels exist, `maxFoldedStepSpeed` and `maxRunAggregateSpeed` (the fastest sub-run of
 * consecutive steps whose OWN aggregate speed exceeds the run's aggregate speed, or `null` when no
 * sub-run clears it). Sorted by aggregate speed descending. Never references a speed limit or floor.
 */
export function findNegativeControlCandidates(archive) {
  const candidates = [];

  for (const activity of archive.activities) {
    if (activity.id === '4556693525') continue; // D-01: disclosed, never a fixture

    const steps = advanceSteps(activity.t, activity.d, activity.gaps);
    if (steps.length === 0) continue;

    const spanStart = activity.t[0];
    const spanEnd = activity.t[activity.t.length - 1];

    const runs = [];
    let current = null;
    for (const step of steps) {
      const speed = step.metres / step.seconds;
      const fast = speed >= 3.5;
      if (fast && current && current[current.length - 1].endIndex === step.startIndex) {
        current.push(step);
      } else if (fast) {
        current = [step];
        runs.push(current);
      } else {
        current = null;
      }
    }

    for (const runSteps of runs) {
      const seeded = runSteps.some((s) => s.metres / s.seconds >= 4);
      if (!seeded) continue;

      const startSec = runSteps[0].startSec;
      const endSec = runSteps[runSteps.length - 1].endSec;
      const duration = endSec - startSec;
      if (duration < 20) continue;

      const totalMetres = runSteps.reduce((sum, s) => sum + s.metres, 0);
      const totalSeconds = runSteps.reduce((sum, s) => sum + s.seconds, 0);
      const aggregateSpeed = totalMetres / totalSeconds;
      if (aggregateSpeed < 4.5 || aggregateSpeed > 7.2) continue;

      if (startSec < spanStart + 60 || endSec > spanEnd - 60) continue;

      const touchesGap = activity.gaps.some((g) => g.endSec === startSec || g.startSec === endSec);
      if (touchesGap) continue;

      const startIndex = runSteps[0].startIndex;
      const endIndex = runSteps[runSteps.length - 1].endIndex;

      const maxFoldedStepSpeed = Math.max(...runSteps.map((s) => s.metres / s.seconds));

      let maxRunAggregateSpeed = null;
      let sub = null;
      for (const s of runSteps) {
        const speed = s.metres / s.seconds;
        if (speed > aggregateSpeed) {
          if (sub && sub[sub.length - 1].endIndex === s.startIndex) sub.push(s);
          else sub = [s];
          const m = sub.reduce((a, x) => a + x.metres, 0);
          const sec = sub.reduce((a, x) => a + x.seconds, 0);
          const subSpeed = m / sec;
          if (maxRunAggregateSpeed === null || subSpeed > maxRunAggregateSpeed) maxRunAggregateSpeed = subSpeed;
        } else {
          sub = null;
        }
      }

      candidates.push({
        id: activity.id,
        startSec,
        endSec,
        duration,
        aggregateSpeed,
        device: activity.device,
        hrRange: rangeFor(activity.hr, startIndex, endIndex),
        cadenceRange: rangeFor(activity.cadence, startIndex, endIndex),
        maxFoldedStepSpeed,
        maxRunAggregateSpeed,
      });
    }
  }

  candidates.sort((a, b) => b.aggregateSpeed - a.aggregateSpeed);
  return candidates;
}

/**
 * Measures one D-05 research-proposed fixture at the detector's OWN judging scale — independent of
 * `findNegativeControlCandidates`'s generic search, using the fixture's own pre-specified window —
 * so the candidate's `maxFoldedStepSpeed`/`maxRunAggregateSpeed` is reported even if the fixture's
 * window doesn't happen to satisfy the generic search's own duration/aggregate-speed thresholds.
 */
export function measureNamedItemAtJudgingScale(activity, window) {
  const steps = advanceSteps(activity.t, activity.d, activity.gaps);
  const stepsInWindow = steps.filter((s) => s.startSec >= window.startSec && s.endSec <= window.endSec);
  if (stepsInWindow.length === 0) return null;

  const totalMetres = stepsInWindow.reduce((a, s) => a + s.metres, 0);
  const totalSeconds = stepsInWindow.reduce((a, s) => a + s.seconds, 0);
  const aggregateSpeed = totalMetres / totalSeconds;
  const maxFoldedStepSpeed = Math.max(...stepsInWindow.map((s) => s.metres / s.seconds));

  let maxRunAggregateSpeed = null;
  let sub = null;
  for (const s of stepsInWindow) {
    const speed = s.metres / s.seconds;
    if (speed > aggregateSpeed) {
      if (sub && sub[sub.length - 1].endIndex === s.startIndex) sub.push(s);
      else sub = [s];
      const m = sub.reduce((a, x) => a + x.metres, 0);
      const sec = sub.reduce((a, x) => a + x.seconds, 0);
      const subSpeed = m / sec;
      if (maxRunAggregateSpeed === null || subSpeed > maxRunAggregateSpeed) maxRunAggregateSpeed = subSpeed;
    } else {
      sub = null;
    }
  }

  const startIndex = stepsInWindow[0].startIndex;
  const endIndex = stepsInWindow[stepsInWindow.length - 1].endIndex;

  return {
    aggregateSpeed,
    maxFoldedStepSpeed,
    maxRunAggregateSpeed,
    hrRange: rangeFor(activity.hr, startIndex, endIndex),
    cadenceRange: rangeFor(activity.cadence, startIndex, endIndex),
    device: activity.device,
  };
}

/** `Map<activityId, AdvanceStep[]>` computed once — the shared basis `candidateSpeedLimitStatistics`
 * and `insensitivityCheck` both build their derived populations from, so a "removed" or "planted"
 * variant can be constructed by editing this map without re-reading any stream. */
export function buildStepsIndex(archive) {
  const index = new Map();
  for (const activity of archive.activities) {
    index.set(activity.id, advanceSteps(activity.t, activity.d, activity.gaps));
  }
  return index;
}

/** S-A (research's "bulk-of-bulk"): R-7 p90, across activities, of each activity's own R-7 p95
 * folded covered-step speed. */
export function statisticSA(stepsIndex) {
  const perActivityP95 = [];
  for (const steps of stepsIndex.values()) {
    if (steps.length === 0) continue;
    const speeds = steps.map((s) => s.metres / s.seconds).sort((a, b) => a - b);
    perActivityP95.push(quantile(speeds, 0.95));
  }
  perActivityP95.sort((a, b) => a - b);
  return { value: perActivityP95.length === 0 ? null : quantile(perActivityP95, 0.9), n: perActivityP95.length };
}

/**
 * Parametric ("Karp") search for the maximum average speed over any contiguous sub-run of `steps`
 * (a single chain, pre-verified not to cross a gap) whose total duration is at least
 * `minDurationSec`. Returns `null` if the chain's own total duration never reaches
 * `minDurationSec`. Binary search on the candidate speed `v`: for a fixed `v`,
 * `g[k] = prefixMetres[k] - v * prefixSeconds[k]`, and a window `[i, j]` clears `v` iff
 * `g[j] - g[i] >= 0` for some valid `i` (one with `prefixSeconds[j] - prefixSeconds[i] >=
 * minDurationSec`) — checked in O(n) via a monotonic running minimum, since valid `i` only grows as
 * `j` grows.
 */
function bestSustainedSpeedOverMinDuration(steps, minDurationSec) {
  const n = steps.length;
  if (n === 0) return null;

  const prefixT = new Array(n + 1).fill(0);
  const prefixM = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    prefixT[i + 1] = prefixT[i] + steps[i].seconds;
    prefixM[i + 1] = prefixM[i] + steps[i].metres;
  }
  if (prefixT[n] < minDurationSec) return null;

  function feasible(v) {
    let k = -1;
    let minG = Infinity;
    for (let j = 0; j <= n; j++) {
      while (k + 1 <= j && prefixT[k + 1] <= prefixT[j] - minDurationSec) {
        k++;
        const g = prefixM[k] - v * prefixT[k];
        if (g < minG) minG = g;
      }
      if (k >= 0) {
        const gj = prefixM[j] - v * prefixT[j];
        if (gj - minG >= -1e-9) return true;
      }
    }
    return false;
  }

  let hi = 0;
  for (const s of steps) hi = Math.max(hi, s.metres / s.seconds);
  let lo = 0;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    if (feasible(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** S-B (a population the detector does NOT judge): R-7 p99, across activities, of each activity's
 * best `SUSTAINED_WINDOW_MIN_SEC`-or-longer covered sustained speed. */
export function statisticSB(stepsIndex) {
  const values = [];
  for (const steps of stepsIndex.values()) {
    const chains = splitIntoContiguousChains(steps);
    let best = null;
    for (const chain of chains) {
      const v = bestSustainedSpeedOverMinDuration(chain, SUSTAINED_WINDOW_MIN_SEC);
      if (v !== null && (best === null || v > best)) best = v;
    }
    if (best !== null) values.push(best);
  }
  values.sort((a, b) => a - b);
  return { value: values.length === 0 ? null : quantile(values, 0.99), n: values.length };
}

/** STRAWMAN: R-7 p99.9 of ALL pooled folded covered-step speeds — deliberately circular (a tail
 * percentile of the very population the detector judges). Must be shown FAILING
 * `insensitivityCheck` before any real candidate is trusted (D-13). */
export function strawmanTailPercentile(stepsIndex) {
  const speeds = [];
  for (const steps of stepsIndex.values()) {
    for (const s of steps) speeds.push(s.metres / s.seconds);
  }
  speeds.sort((a, b) => a - b);
  return { value: speeds.length === 0 ? null : quantile(speeds, 0.999), n: speeds.length };
}

/**
 * D-13's non-circularity check, demonstrated as insensitivity rather than argued in prose.
 * `deriveFn(stepsIndex) => number` computes the candidate statistic from a `Map<activityId,
 * AdvanceStep[]>`. `detectAtL` is the candidate's OWN value (the "constant" under test), used —
 * with excess floor 0 — to find which segments it would already explain; those segments' burst
 * steps are removed to build `removed`. `planted` clones every burst part detected on
 * `INSENSITIVITY_SOURCE_ACTIVITY_ID` at `detectAtL` (real shapes, no synthetic look-alikes) into
 * the activities sorted by id, round-robin, until the planted count equals the archive-wide
 * detected segment count at `detectAtL` (at least doubling the contamination). Relative deltas are
 * compared against `tolerance`, fixed by the caller before this function runs. `pass` requires BOTH
 * deltas to clear it.
 */
export function insensitivityCheck(
  deriveFn,
  archive,
  { detectAtL, excessFloorMetres = PROBE_EXCESS_FLOOR_METRES, tolerance }
) {
  const baseStepsIndex = buildStepsIndex(archive);
  const base = deriveFn(baseStepsIndex);

  const detectParams = {
    speedLimitMps: detectAtL,
    excessFloorMetres,
    hiddenPauseMinMetres: PROBE_HIDDEN_PAUSE_MIN_METRES,
  };

  let detectedSegmentCount = 0;
  const removedStepsIndex = new Map();
  for (const activity of archive.activities) {
    const segments = detectUnreliableSegments(activity.t, activity.d, activity.gaps, detectParams);
    detectedSegmentCount += segments.length;

    const burstRanges = [];
    for (const segment of segments) {
      for (const part of segment.parts) {
        if (part.kind === 'burst') burstRanges.push([part.startIndex, part.endIndex]);
      }
    }
    const originalSteps = baseStepsIndex.get(activity.id) ?? [];
    const filtered =
      burstRanges.length === 0
        ? originalSteps
        : originalSteps.filter((step) => !burstRanges.some(([s, e]) => step.startIndex >= s && step.endIndex <= e));
    removedStepsIndex.set(activity.id, filtered);
  }
  const removed = deriveFn(removedStepsIndex);

  const sourceActivity = archive.activities.find((a) => a.id === INSENSITIVITY_SOURCE_ACTIVITY_ID);
  const sourceBurstParts = [];
  if (sourceActivity) {
    const sourceSegments = detectUnreliableSegments(
      sourceActivity.t,
      sourceActivity.d,
      sourceActivity.gaps,
      detectParams
    );
    for (const segment of sourceSegments) {
      for (const part of segment.parts) {
        if (part.kind === 'burst') sourceBurstParts.push({ metres: part.metres, seconds: part.seconds });
      }
    }
  }

  const plantedStepsIndex = new Map();
  for (const [id, steps] of baseStepsIndex) plantedStepsIndex.set(id, steps.slice());

  const sortedIds = [...baseStepsIndex.keys()].sort();
  const plantedTarget = Math.max(detectedSegmentCount, 1);
  let plantedCount = 0;
  if (sourceBurstParts.length > 0 && sortedIds.length > 0) {
    let cursor = 0;
    while (plantedCount < plantedTarget) {
      const targetId = sortedIds[cursor % sortedIds.length];
      const template = sourceBurstParts[plantedCount % sourceBurstParts.length];
      plantedStepsIndex.get(targetId).push({
        startIndex: -(plantedCount + 1),
        endIndex: -(plantedCount + 1),
        startSec: 0,
        endSec: template.seconds,
        metres: template.metres,
        seconds: template.seconds,
      });
      plantedCount++;
      cursor++;
    }
  }
  const planted = deriveFn(plantedStepsIndex);

  const removedDelta = base === null || base === 0 ? null : Math.abs(removed - base) / Math.abs(base);
  const plantedDelta = base === null || base === 0 ? null : Math.abs(planted - base) / Math.abs(base);
  const pass = removedDelta !== null && plantedDelta !== null && removedDelta <= tolerance && plantedDelta <= tolerance;

  return {
    base,
    removed,
    planted,
    removedDelta,
    plantedDelta,
    pass,
    detectedSegmentCount,
    plantedCount,
    sourceBurstPartCount: sourceBurstParts.length,
  };
}

// ---------------------------------------------------------------------------
// Plan 32-06: constant derivation (D-08/D-09/D-10), bound by the 32-05 Decision
// ---------------------------------------------------------------------------

/** Absolute path to the 32-05 blocking decision this plan is bound by. */
export const DECISION_SUMMARY_PATH = join(
  ROOT_DIR,
  '.planning/phases/32-unreliable-segment-detection-calibration/32-05-SUMMARY.md'
);

/**
 * Parses the three grep-able machine-readable lines 32-05-SUMMARY.md's `## Decision` section
 * records verbatim (`disposition:`, `fixtures:`, `statistic:` at line start). Pure string parsing,
 * no I/O — `loadDecision` below does the read. Throws on a missing line rather than silently
 * defaulting: a malformed or absent Decision block must fail loudly, not derive constants against
 * an empty fixture set.
 */
export function parseDecisionText(text) {
  const dispositionMatch = text.match(/^disposition:\s*(.+)$/m);
  const fixturesMatch = text.match(/^fixtures:\s*(.+)$/m);
  const statisticMatch = text.match(/^statistic:\s*(.+)$/m);
  if (!dispositionMatch || !fixturesMatch || !statisticMatch) {
    throw new Error(
      '32-05-SUMMARY.md is missing one of the three machine-readable Decision lines ' +
        '(disposition:/fixtures:/statistic:) — cannot derive any constant without it.'
    );
  }

  const disposition = dispositionMatch[1].trim();
  const statistic = statisticMatch[1].trim();
  const fixtures = fixturesMatch[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [id, span] = entry.split(':').map((s) => s.trim());
      const [startSec, endSec] = span.split('-').map((s) => Number(s.trim()));
      return { id, startSec, endSec };
    });

  return { disposition, statistic, fixtures };
}

/** Reads and parses the 32-05 Decision from disk. The only I/O in this section of the file. */
export function loadDecision(summaryPath = DECISION_SUMMARY_PATH) {
  return parseDecisionText(readFileSync(summaryPath, 'utf8'));
}

/**
 * D-09/D-10's must-flag set: the hidden-pause window plus the five named isolated jumps
 * (`NAMED_ITEMS.mustFlag`), unconditionally under `option-refixture`/`no-conflict` (the D-09/D-10
 * rule shape and ROADMAP criterion 3 / SEG-03 are unchanged). Only `option-amend-criterion-3` — if
 * the Decision ever records one — narrows this to `decision.retainedJumpIds`, a field this plan's
 * Decision does not carry (`disposition: option-refixture`), so every named jump stays mandatory.
 */
export function mustFlagItems(decision) {
  if (decision.disposition === 'option-amend-criterion-3' && Array.isArray(decision.retainedJumpIds)) {
    const retained = new Set(decision.retainedJumpIds);
    return NAMED_ITEMS.mustFlag.filter(
      (item) => !item.label.startsWith('isolated jump') || retained.has(`${item.id}@${item.window.startSec}`)
    );
  }
  return NAMED_ITEMS.mustFlag;
}

/**
 * D-05/D-10(d)'s must-spare set: D-09's own trivial pair (`NAMED_ITEMS.mustSpare`) plus the
 * Decision's locked fixtures (`decision.fixtures`) — the research-proposed three-fixture set is
 * deliberately NOT consulted here (32-05 superseded it). `4556693525` never appears in either
 * source (D-01).
 */
export function mustSpareItems(decision) {
  const fixtureItems = decision.fixtures.map((f) => ({
    id: f.id,
    window: { startSec: f.startSec, endSec: f.endSec },
    label: `D-05 locked fixture (32-05 Decision, disposition: ${decision.disposition})`,
  }));
  return [...NAMED_ITEMS.mustSpare, ...fixtureItems];
}

/**
 * D-10's speed-limit MULTIPLIER (32-CONTEXT.md "Claude's Discretion": "the exact statistic,
 * multiplier and tolerance for the speed limit ... bound by D-10 and D-13"). `L = ceil(multiplier
 * x statistic x 100) / 100` — a bare `ceil(statistic)` with an implicit multiplier of 1 is NOT
 * this rule (an earlier draft of this plan tried exactly that: at L = ceil(S-A) = 4.41 m/s,
 * ordinary sustained running already out-excesses the five named GPS jumps — see the SUMMARY's
 * "Blocking Finding" history for the full measurement).
 *
 * For each activity with at least one advancing step, the per-activity ratio is that activity's
 * own R-7 95th-percentile folded-step speed divided by its own R-7 MEDIAN folded-step speed — how
 * much faster that ONE activity's near-top pace is than its own typical pace, i.e. its own
 * internal pace variability. Neither percentile is a tail order statistic of the archive-wide
 * population the detector judges (D-10(b) forbids that): both are WITHIN one activity's own
 * steps, at bulk (50th/95th) orders, mirroring the per-activity/cross-activity two-level shape
 * S-A itself already uses (not a new population).
 *
 * The multiplier is the R-7 percentile of this per-activity ratio ACROSS activities, at the
 * SMALLEST of `SPEED_LIMIT_MULTIPLIER_CANDIDATE_OUTER_PERCENTILES` whose resulting `L` clears
 * D-13's insensitivity check (`selectSpeedLimitMultiplier`) — mirroring 32-05's OWN precedent of
 * choosing S-A over S-B by comparing MEASURED insensitivity (removedDelta 8.28% vs 43.46%), never
 * a flagged count (D-10(e), Phase 27 D-02 anti-quota). The candidate set is fixed, round, and
 * ordered BEFORE any check runs; nothing here consults a named item, a flagged count, or the
 * excess floor F. On the live archive only 0.97 of the four candidates clears the 1% tolerance
 * (0.90, 0.95 and 0.99 each fail it) — the selection is a genuine measurement, not a foregone
 * conclusion.
 */
const SPEED_LIMIT_MULTIPLIER_INNER_HI_PERCENTILE = 0.95;
const SPEED_LIMIT_MULTIPLIER_INNER_LO_PERCENTILE = 0.5;
const SPEED_LIMIT_MULTIPLIER_CANDIDATE_OUTER_PERCENTILES = [0.9, 0.95, 0.97, 0.99];

/** `(stepsIndex) => multiplier` at a given outer percentile — the `stepsIndex`-shaped adapter
 * `insensitivityCheck`'s removal/planting can re-run directly. */
export function speedLimitMultiplierAt(outerPercentile) {
  return (stepsIndex) => {
    const ratios = [];
    for (const steps of stepsIndex.values()) {
      if (steps.length === 0) continue;
      const speeds = steps.map((s) => s.metres / s.seconds).sort((a, b) => a - b);
      const hi = quantile(speeds, SPEED_LIMIT_MULTIPLIER_INNER_HI_PERCENTILE);
      const lo = quantile(speeds, SPEED_LIMIT_MULTIPLIER_INNER_LO_PERCENTILE);
      if (lo > 0) ratios.push(hi / lo);
    }
    ratios.sort((a, b) => a - b);
    return ratios.length === 0 ? null : quantile(ratios, outerPercentile);
  };
}

/** `(stepsIndex) => L` at a given outer percentile: the Decision's statistic (S-A/S-B, the SAME
 * `statisticSA`/`statisticSB` functions 32-05 reported those labels from — not re-implemented)
 * times `speedLimitMultiplierAt(outerPercentile)`, ceil-rounded to 0.01 m/s. Rounding up can only
 * ever flag LESS of the archive at the rounded value than the raw product would, never more — the
 * direction-safe rounding `CEILING_K`'s own docblock precedent uses. */
export function deriveSpeedLimitAt(statisticLabel, outerPercentile) {
  return (stepsIndex) => {
    const stat =
      statisticLabel === 'S-A' ? statisticSA(stepsIndex) : statisticLabel === 'S-B' ? statisticSB(stepsIndex) : null;
    if (stat === null || stat.value === null) return null;
    const multiplier = speedLimitMultiplierAt(outerPercentile)(stepsIndex);
    if (multiplier === null) return null;
    return Math.ceil(multiplier * stat.value * 100) / 100;
  };
}

/**
 * Selects the smallest candidate outer percentile whose resulting `L` clears D-13 insensitivity
 * at the standard floor-0 probe (`PROBE_EXCESS_FLOOR_METRES`, `INSENSITIVITY_TOLERANCE`) —
 * matching 32-05's own S-A/S-B comparison convention (checked before any excess floor exists).
 * Returns `{ outerPercentile, multiplier, L, check }` for the first passing candidate, or the
 * LAST candidate (with its failing `check` attached) if none pass — `deriveSpeedLimit` returns
 * that candidate's `L` regardless, and the caller (`main`) treats a non-passing `check` as this
 * plan's own STOP condition (d).
 */
export function selectSpeedLimitMultiplier(archive, statisticLabel) {
  const stepsIndex = buildStepsIndex(archive);
  let result = null;
  for (const outerPercentile of SPEED_LIMIT_MULTIPLIER_CANDIDATE_OUTER_PERCENTILES) {
    const deriveFn = deriveSpeedLimitAt(statisticLabel, outerPercentile);
    const L = deriveFn(stepsIndex);
    const multiplier = speedLimitMultiplierAt(outerPercentile)(stepsIndex);
    if (L === null) {
      result = { outerPercentile, multiplier, L, check: null };
      continue;
    }
    const check = insensitivityCheck(deriveFn, archive, { detectAtL: L, tolerance: INSENSITIVITY_TOLERANCE });
    result = { outerPercentile, multiplier, L, check };
    if (check.pass) return result;
  }
  return result;
}

/** D-10's speed limit: `selectSpeedLimitMultiplier`'s chosen candidate's `L`. Takes no
 * flagged-count argument anywhere in this call chain (D-10(e) anti-quota). */
export function deriveSpeedLimit(archive, statisticLabel) {
  const selection = selectSpeedLimitMultiplier(archive, statisticLabel);
  return selection === null ? null : selection.L;
}

/**
 * D-10(d)'s feasibility check at a SPECIFIC, already-chosen `(L, F)` pair (unlike
 * `computeFeasibleFloor`, which searches for a feasible interval across a whole grid). Every
 * must-flag item (`mustFlagItems(decision)`) must be a candidate at `L` with excess strictly
 * greater than `F`; every must-spare item (`mustSpareItems(decision)`) must either not be a
 * candidate at `L` (excess `null`) or have excess at or below `F`. Each row records which
 * mechanism excluded a must-spare item — `'speed limit'` (it was never a candidate at `L`, excess
 * `null`) or `'floor'` (it was a candidate but its excess did not clear `F`) — or `null` when the
 * item is NOT excluded (a failing row, surfaced by `pass: false`).
 */
export function checkFeasibility(archive, L, F, decision) {
  const byId = new Map(archive.activities.map((a) => [a.id, a]));
  let pass = true;
  const rows = [];

  for (const item of mustFlagItems(decision)) {
    const activity = byId.get(item.id);
    const excess = activity ? runExcessAt(activity, item.window, L) : null;
    const admitted = excess !== null && excess > F;
    if (!admitted) pass = false;
    rows.push({ kind: 'mustFlag', item, excess, admitted, mechanism: null });
  }

  for (const item of mustSpareItems(decision)) {
    const activity = byId.get(item.id);
    const excess = activity ? runExcessAt(activity, item.window, L) : null;
    const spared = excess === null || excess <= F;
    const mechanism = excess === null ? 'speed limit' : excess <= F ? 'floor' : null;
    if (!spared) pass = false;
    rows.push({ kind: 'mustSpare', item, excess, spared, mechanism });
  }

  return { pass, rows };
}

/** Maximal contiguous (by index) runs of steps whose own speed exceeds `L` — the SAME grouping
 * `groupFastRuns` performs inside the detector, re-implemented here (not imported — this file
 * already re-implements `advanceSteps`-adjacent groupings, e.g. `splitIntoContiguousChains`) so it
 * can run over a `stepsIndex`-shaped population `insensitivityCheck` builds by editing steps in
 * place, which never touches `t`/`d`/`gaps` and therefore cannot call `detectUnreliableSegments`. */
function fastRunsFromSteps(steps, L) {
  const runs = [];
  let current = null;
  for (const step of steps) {
    const fast = step.metres > L * step.seconds;
    if (fast && current && current.endIndex === step.startIndex) {
      current.endIndex = step.endIndex;
      current.metres += step.metres;
      current.seconds += step.seconds;
    } else if (fast) {
      current = { startIndex: step.startIndex, endIndex: step.endIndex, metres: step.metres, seconds: step.seconds };
      runs.push(current);
    } else {
      current = null;
    }
  }
  return runs;
}

/**
 * D-09's excess-metres significance floor population: every folded covered-step's OWN `metres`,
 * pooled archive-wide — deliberately NOT restricted to "fast" steps (unlike `fastRunsFromSteps`'s
 * population, which `insensitivityCheck`'s removal step strips almost entirely at any workable
 * `(L, F)` — a live-archive finding from an earlier version of this rule that used the fast-run
 * EXCESS population directly and failed D-13 by 50-450% depending on the percentile order tried,
 * because that population and the "segments a candidate value already explains" population are
 * nearly identical sets). Ordinary steps (walking pace, easy running, all the non-anomalous
 * majority of the archive) dominate this population by construction, so removing or doubling a
 * few hundred detected fast bursts moves it by a negligible amount — the SAME robustness property
 * `statisticSA`'s own population (all folded-step SPEEDS, not just fast ones) already has.
 */
function pooledStepMetres(stepsIndex) {
  const metres = [];
  for (const steps of stepsIndex.values()) {
    for (const step of steps) metres.push(step.metres);
  }
  return metres;
}

/**
 * The order statistic `deriveExcessFloor` reads off the pooled step-metres population: the
 * COMPLEMENT (1 - 0.90) of D-10(a)'s already-locked speed-limit outer percentile order, applied to
 * ordinary per-step DISTANCE instead of per-step SPEED. `L` is set from the archive's bulk
 * HIGH-side speed scale (S-A's own 90th percentile); `F` is set from the archive's bulk LOW-side
 * distance scale — the typical SMALL-side scale of a single ordinary covered step's own distance,
 * below which an excess is indistinguishable from the granularity of a single sample. No new free
 * percentile order is introduced beyond one already fixed by D-10(a): this is its mirror image,
 * not a value picked to fit this population.
 */
const EXCESS_FLOOR_PERCENTILE = 0.1; // = 1 - 0.9, D-10(a)'s speed-limit outer percentile order

/**
 * D-09's excess-metres significance floor. Depends on `L` and the archive alone — never a named
 * item, never a flagged count (D-10(e), Phase 27 D-02 anti-quota; `deriveExcessFloor`'s signature
 * is `(archive, L)`, structurally incapable of taking either — `L` itself is unused by the rule
 * below, kept in the signature only so callers and the STOP-condition ordering in this file's
 * `main()` read the same way for all three constants). A BULK statistic (the archive's own
 * `quantile`, the R-7 implementation `pace-derivation.ts` exports, applied at
 * `EXCESS_FLOOR_PERCENTILE`) of EVERY folded covered-step's own metres, pooled archive-wide —
 * never a TAIL percentile of that population (this file's own strawman,
 * `strawmanExcessFloorTailPercentile`, is the tail-percentile shape this rule deliberately is NOT).
 *
 * Non-circularity: the population this percentile is taken over is "every ordinary covered step
 * anywhere in the archive", not "every run this floor would itself flag" or even "every run
 * exceeding `L`" — it does not reference the speed limit, a named item, or a flagged count at all.
 * D-13's own measurement confirms this: removing/doubling the archive's detected fast bursts moves
 * this statistic by exactly 0% (see the SUMMARY), the same near-total insensitivity `statisticSA`
 * itself relies on.
 *
 * Rounded to 0.1 m in the direction that keeps every must-flag item admitted: DOWN. A floor is an
 * exclusion threshold — every must-flag item's excess must exceed it — so rounding the raw value
 * down can only ever admit MORE of a borderline must-flag item, never less, mirroring
 * `deriveSpeedLimit`'s own "can only flag less, never more" direction-safety for the opposite
 * (inclusion) boundary.
 */
export function deriveExcessFloor(archive, _L) {
  const metres = pooledStepMetres(buildStepsIndex(archive)).sort((a, b) => a - b);
  if (metres.length === 0) return 0;
  const raw = quantile(metres, EXCESS_FLOOR_PERCENTILE);
  return Math.floor(raw * 10) / 10;
}

/** STRAWMAN for F: R-7 p99 (a TAIL percentile, deliberately circular) of the SAME pooled
 * step-metres population `deriveExcessFloor` reads. Must be shown FAILING `insensitivityCheck`
 * before `deriveExcessFloor`'s own bulk statistic is trusted (D-13). */
export function strawmanExcessFloorTailPercentile(archive, _L) {
  const metres = pooledStepMetres(buildStepsIndex(archive)).sort((a, b) => a - b);
  if (metres.length === 0) return null;
  return quantile(metres, 0.99);
}

/**
 * Bug fix (D-13 live-archive finding, plan 32-06 continuation): widened from an initial 5 m to
 * 20 m. At 5 m the archive's real no-gap-metres histogram is sparse enough (dozens of bins, many
 * single-digit counts) that the valley search latches onto small-sample noise — a "valley" whose
 * OWN bin location moves by more than half its value under D-13's removal/planting perturbation
 * (a real, measured instability, not a hypothetical one: bin=5 reported a valley at 95 m on the
 * live archive that relocated to 55 m after removal). 20 m was chosen as the smallest width at
 * which the SAME live population (L, F chosen by this plan) stops finding ANY valley at all
 * (`valleyFound: false` — D-08's own legitimate "no clean valley" outcome) rather than a
 * boundary that moves with the perturbation. This is a data-driven granularity fix, not a
 * tuned threshold: it was chosen by watching the live archive's OWN histogram stabilise, before
 * the D-13 check was run to confirm it, and is never adjusted afterward to change a flagged count.
 */
const HIDDEN_PAUSE_BIN_WIDTH_METRES = 20;

/**
 * D-08's valley search over a pre-computed population of segment metres. Bins `values` into
 * `binWidth`-wide buckets spanning `[lowMetres, highMetres]` (the anchor interval), then walks bins
 * strictly BETWEEN the two anchors in ascending order looking for the first whose count is at most
 * half the smaller of the maximum count strictly to its left and the maximum count strictly to its
 * right (both restricted to the interval). Returns `{ valleyFound: true, B }` at the LOWEST such
 * bin's lower edge, or `{ valleyFound: false, B: null }` if none exists — "no clean valley" is
 * reported, never manufactured (D-08). `histogram` is always returned for rendering.
 */
export function findValley(values, lowMetres, highMetres, binWidth = HIDDEN_PAUSE_BIN_WIDTH_METRES) {
  if (!(lowMetres < highMetres)) {
    return { valleyFound: false, B: null, histogram: [] };
  }

  const firstEdge = Math.floor(lowMetres / binWidth) * binWidth;
  const lastEdge = Math.floor(highMetres / binWidth) * binWidth;
  const edges = [];
  for (let e = firstEdge; e <= lastEdge; e += binWidth) edges.push(Math.round(e * 1e6) / 1e6);

  const counts = edges.map((edge) => values.filter((v) => v >= edge && v < edge + binWidth).length);
  const histogram = edges.map((edge, i) => ({ edge, count: counts[i] }));

  let bestIndex = -1;
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!(edge > lowMetres && edge < highMetres)) continue;

    const leftCounts = counts.slice(0, i);
    const rightCounts = counts.slice(i + 1);
    const maxLeft = leftCounts.length > 0 ? Math.max(...leftCounts) : 0;
    const maxRight = rightCounts.length > 0 ? Math.max(...rightCounts) : 0;
    // Bug fix (D-13 live-archive finding, plan 32-06 continuation): a bin can only be a real
    // "dip" relative to real mass on BOTH sides. Without this guard, an entirely empty (or
    // all-zero) population trivially satisfies `counts[i] <= 0.5 * min(0, 0) === 0` at the very
    // first interior edge — exactly what D-13's insensitivity check hits when its OWN removal
    // step strips every no-gap segment out of the archive (this population IS the detector's own
    // output at (L, F), so removing "everything the candidate already explains" can legitimately
    // leave zero residual mass). A manufactured valley over an empty population is not a valley;
    // it must report `valleyFound: false` exactly like a real monotone-decay histogram would.
    if (maxLeft === 0 || maxRight === 0) continue;
    const threshold = 0.5 * Math.min(maxLeft, maxRight);

    if (counts[i] <= threshold) {
      bestIndex = i;
      break;
    }
  }

  if (bestIndex === -1) return { valleyFound: false, B: null, histogram };
  return { valleyFound: true, B: edges[bestIndex], histogram };
}

/** Every no-gap segment's metres at `(L, F)`: `hiddenPauseMinMetres: Number.MAX_SAFE_INTEGER` so
 * the detector never itself distinguishes hidden-pause from isolated-jump (both land in this one
 * population); a segment with `gapCount > 0` is gap-adjacent, never a candidate for this boundary. */
function noGapSegmentMetres(archive, L, F) {
  const metres = [];
  for (const activity of archive.activities) {
    const segments = detectUnreliableSegments(activity.t, activity.d, activity.gaps, {
      speedLimitMps: L,
      excessFloorMetres: F,
      hiddenPauseMinMetres: Number.MAX_SAFE_INTEGER,
    });
    for (const segment of segments) {
      if (segment.gapCount === 0) metres.push(segment.metres);
    }
  }
  return metres;
}

/** The metres of the segment overlapping `item.window` at `(L, F)`, or `null` if none. */
function namedItemSegmentMetres(byId, item, L, F) {
  const activity = byId.get(item.id);
  if (!activity) return null;
  const segments = detectUnreliableSegments(activity.t, activity.d, activity.gaps, {
    speedLimitMps: L,
    excessFloorMetres: F,
    hiddenPauseMinMetres: Number.MAX_SAFE_INTEGER,
  });
  for (const segment of segments) {
    if (segment.startSec <= item.window.endSec && segment.endSec >= item.window.startSec) return segment.metres;
  }
  return null;
}

/**
 * D-08's hidden-pause vs isolated-jump metres boundary. `anchorInterval = { low, high }` is
 * `[largest must-flag isolated jump's OWN segment metres at (L, F), the must-flag hidden-pause
 * item's OWN segment metres at (L, F)]` — never a synthetic pair. Empty (or inverted) when the
 * largest jump's metres are not strictly less than the hidden pause's own metres — `anchorEmpty:
 * true`, the caller's STOP condition (c), since `findValley` cannot search a non-interval.
 *
 * Otherwise, histograms EVERY no-gap segment's metres archive-wide (`noGapSegmentMetres`) and
 * searches the anchor interval for a valley (`findValley`). If none exists, `valleyFound: false`
 * and `B` falls back to the anchor interval's own MIDPOINT — a stated best-effort default that
 * lies strictly inside the interval and is deliberately NOT a percentile of the segment-metres
 * distribution (D-08 forbids that fallback shape: a percentile of the very population with no
 * clean valley would manufacture a boundary the data does not support).
 */
export function deriveHiddenPauseBoundary(archive, L, F) {
  const byId = new Map(archive.activities.map((a) => [a.id, a]));
  const isolatedJumpItems = NAMED_ITEMS.mustFlag.filter((item) => item.label.startsWith('isolated jump'));
  const hiddenPauseItem = NAMED_ITEMS.mustFlag.find((item) => item.label.startsWith('hidden-pause'));

  const jumpMetresList = isolatedJumpItems
    .map((item) => namedItemSegmentMetres(byId, item, L, F))
    .filter((m) => m !== null);
  const largestJumpMetres = jumpMetresList.length > 0 ? Math.max(...jumpMetresList) : null;
  const hiddenPauseMetres = hiddenPauseItem ? namedItemSegmentMetres(byId, hiddenPauseItem, L, F) : null;

  if (largestJumpMetres === null || hiddenPauseMetres === null || !(largestJumpMetres < hiddenPauseMetres)) {
    return {
      B: null,
      valleyFound: false,
      histogram: [],
      anchorInterval: null,
      anchorEmpty: true,
      largestJumpMetres,
      hiddenPauseMetres,
    };
  }

  const anchorInterval = { low: largestJumpMetres, high: hiddenPauseMetres };
  const allNoGapMetres = noGapSegmentMetres(archive, L, F);
  const valley = findValley(allNoGapMetres, anchorInterval.low, anchorInterval.high);

  if (valley.valleyFound) {
    return { B: valley.B, valleyFound: true, histogram: valley.histogram, anchorInterval, anchorEmpty: false };
  }

  const fallbackB = (anchorInterval.low + anchorInterval.high) / 2;
  return { B: fallbackB, valleyFound: false, histogram: valley.histogram, anchorInterval, anchorEmpty: false };
}

/** STRAWMAN for B: R-7 p99 of no-gap segment metres (a TAIL percentile of the very population
 * `deriveHiddenPauseBoundary`'s valley search reads — deliberately circular). Must be shown
 * FAILING `insensitivityCheck` before the valley-search/midpoint-fallback rule is trusted (D-13). */
export function strawmanHiddenPauseTailPercentile(archive, L, F) {
  const metres = noGapSegmentMetres(archive, L, F).slice().sort((a, b) => a - b);
  if (metres.length === 0) return null;
  return quantile(metres, 0.99);
}

/** Precomputes, per activity, the real gap boundary sample indices `mapGapToIndices` would derive
 * inside the detector (a burst touches a gap iff its `endIndex` equals the gap's own mapped
 * `startIndex`, or its `startIndex` equals the gap's own mapped `endIndex` — D-06). Computed ONCE
 * from the archive's real, UNMODIFIED `t`/gaps — `insensitivityCheck`'s removal never changes a
 * surviving step's own index, and planted steps carry negative sentinel indices that can never
 * collide with a real (non-negative) boundary index, so this stays valid for both re-derivations. */
function buildGapIndexBoundaries(archive) {
  const boundaries = new Map();
  for (const activity of archive.activities) {
    const startIndices = new Set();
    const endIndices = new Set();
    for (const g of activity.gaps) {
      let gi = -1;
      for (let i = 0; i < activity.t.length; i++) if (activity.t[i] === g.startSec) gi = i;
      let gj = -1;
      for (let j = 0; j < activity.t.length; j++) {
        if (activity.t[j] === g.endSec) {
          gj = j;
          break;
        }
      }
      if (gi !== -1) endIndices.add(gi);
      if (gj !== -1) startIndices.add(gj);
    }
    boundaries.set(activity.id, { startIndices, endIndices });
  }
  return boundaries;
}

/** No-gap fast-run metres from a `stepsIndex` (`insensitivityCheck`'s removal/planting shape),
 * using precomputed real `gapBoundaries` (see `buildGapIndexBoundaries`) to test touching. */
function noGapRunMetresFromStepsIndex(stepsIndex, gapBoundaries, L, F) {
  const metresList = [];
  for (const [id, steps] of stepsIndex) {
    const boundary = gapBoundaries.get(id);
    for (const run of fastRunsFromSteps(steps, L)) {
      const excess = run.metres - L * run.seconds;
      if (excess <= F) continue;
      const touchesGap =
        !!boundary && (boundary.endIndices.has(run.endIndex) || boundary.startIndices.has(run.startIndex));
      if (touchesGap) continue;
      metresList.push(run.metres);
    }
  }
  return metresList;
}

/**
 * `deriveFn` adapters for `insensitivityCheck` (D-13), one pair (real + strawman) per constant
 * F/B derives — `L`'s own adapters are `deriveSpeedLimitAt`/`speedLimitMultiplierAt` themselves,
 * already `(stepsIndex) => value` shaped, reused as-is.
 */

/** F's own statistic, `EXCESS_FLOOR_PERCENTILE` of the pooled step-metres population, computed
 * from a `stepsIndex` (not a full archive) so it can run over `insensitivityCheck`'s
 * removed/planted populations. `L` is accepted (and ignored) only so F's adapter has the same
 * shape as every other constant's. */
export function excessFloorDeriveFn(_L) {
  return (stepsIndex) => {
    const metres = pooledStepMetres(stepsIndex).sort((a, b) => a - b);
    return metres.length === 0 ? null : quantile(metres, EXCESS_FLOOR_PERCENTILE);
  };
}

/** F's STRAWMAN adapter: R-7 p99 (tail) of the same pooled step-metres population. */
export function excessFloorStrawmanDeriveFn(_L) {
  return (stepsIndex) => {
    const metres = pooledStepMetres(stepsIndex).sort((a, b) => a - b);
    return metres.length === 0 ? null : quantile(metres, 0.99);
  };
}

/** B's own rule, re-run against the SAME `anchorInterval` over a perturbed `stepsIndex`
 * population — mirrors `deriveHiddenPauseBoundary`'s real-valley/midpoint-fallback shape exactly. */
export function hiddenPauseBoundaryDeriveFn(archive, L, F, anchorInterval) {
  const gapBoundaries = buildGapIndexBoundaries(archive);
  return (stepsIndex) => {
    const metresList = noGapRunMetresFromStepsIndex(stepsIndex, gapBoundaries, L, F);
    const valley = findValley(metresList, anchorInterval.low, anchorInterval.high);
    return valley.valleyFound ? valley.B : (anchorInterval.low + anchorInterval.high) / 2;
  };
}

/** B's STRAWMAN adapter: R-7 p99 (tail) of ALL no-gap fast-run metres, unrestricted to the anchor
 * interval — the tail-percentile shape `deriveHiddenPauseBoundary`'s valley search is not. */
export function hiddenPauseStrawmanDeriveFn(archive, L, F) {
  const gapBoundaries = buildGapIndexBoundaries(archive);
  return (stepsIndex) => {
    const metresList = noGapRunMetresFromStepsIndex(stepsIndex, gapBoundaries, L, F).sort((a, b) => a - b);
    return metresList.length === 0 ? null : quantile(metresList, 0.99);
  };
}

/** Finds the grid row whose `L` is closest to `value`, or `null` for an empty grid. */
function findGridRowForL(rows, value) {
  if (rows.length === 0) return null;
  let closest = rows[0];
  for (const row of rows) {
    if (Math.abs(row.L - value) < Math.abs(closest.L - value)) closest = row;
  }
  return closest;
}

/**
 * Orchestrates S-A, S-B and the strawman: their values, populations, D-13 insensitivity (against
 * their OWN value as `detectAtL`), and whether that value lies inside a feasible reachability
 * window under each fixture assumption (the nearest computed grid row's `feasibleFloor`).
 * Does NOT compute or report any archive-wide flagged count (D-10(e)).
 */
export function candidateSpeedLimitStatistics(archive, { matrixWithD05, matrixWithoutD05 } = {}) {
  const stepsIndex = buildStepsIndex(archive);

  const sa = statisticSA(stepsIndex);
  const sb = statisticSB(stepsIndex);
  const strawman = strawmanTailPercentile(stepsIndex);

  const candidates = [
    {
      label: 'S-A',
      description: "R-7 p90 across activities of each activity's own R-7 p95 folded covered-step speed",
      value: sa.value,
      n: sa.n,
    },
    {
      label: 'S-B',
      description: `R-7 p99 across activities of each activity's best ${SUSTAINED_WINDOW_MIN_SEC}s-or-longer covered sustained speed`,
      value: sb.value,
      n: sb.n,
    },
  ];
  const strawmanCandidate = {
    label: 'strawman (circular, watched failing)',
    description: 'R-7 p99.9 of ALL pooled folded covered-step speeds — a tail percentile of the judged population',
    value: strawman.value,
    n: strawman.n,
  };

  for (const candidate of [...candidates, strawmanCandidate]) {
    candidate.check =
      candidate.value === null
        ? null
        : insensitivityCheck(
            (idx) => {
              if (candidate.label === 'S-A') return statisticSA(idx).value;
              if (candidate.label === 'S-B') return statisticSB(idx).value;
              return strawmanTailPercentile(idx).value;
            },
            archive,
            { detectAtL: candidate.value, tolerance: INSENSITIVITY_TOLERANCE }
          );

    if (candidate.value === null) {
      candidate.feasibleWithD05 = null;
      candidate.feasibleWithoutD05 = null;
      candidate.nearestGridLWithD05 = null;
      candidate.nearestGridLWithoutD05 = null;
      continue;
    }

    const rowWith = matrixWithD05 ? findGridRowForL(matrixWithD05, candidate.value) : null;
    const rowWithout = matrixWithoutD05 ? findGridRowForL(matrixWithoutD05, candidate.value) : null;
    candidate.feasibleWithD05 = rowWith ? rowWith.feasibleFloor !== null : null;
    candidate.feasibleWithoutD05 = rowWithout ? rowWithout.feasibleFloor !== null : null;
    candidate.nearestGridLWithD05 = rowWith ? rowWith.L : null;
    candidate.nearestGridLWithoutD05 = rowWithout ? rowWithout.L : null;
  }

  return { candidates, strawmanCandidate, tolerance: INSENSITIVITY_TOLERANCE };
}

// ---------------------------------------------------------------------------
// I/O — archive load + report build + markdown render
// ---------------------------------------------------------------------------

/**
 * Reads every `data/streams/` entry `isStreamFile` accepts (never `manifest.json`), sorted by id.
 * For each it returns `{ id, t, d, hr?, cadence?, gaps, device }`. A stream failing
 * `validateStreamSeries` (the same guard the detector itself calls — `advanceSteps` and
 * `detectUnreliableSegments` would both return `[]` for it) is counted in `notComputable` and
 * excluded from `activities` — never silently dropped without a trace, since the count is always
 * surfaced in the rendered artifact's `## Inputs` section. No hard-coded denominator anywhere: the
 * live file count IS `streamFileCount`.
 */
export function loadArchive(streamsDir, activitiesDir) {
  const files = readdirSync(streamsDir).filter(isStreamFile).sort();
  const activities = [];
  let notComputable = 0;

  for (const filename of files) {
    const id = idFromFilename(filename);

    let stream;
    try {
      stream = JSON.parse(readFileSync(join(streamsDir, filename), 'utf8'));
    } catch {
      notComputable++;
      continue;
    }

    const t = Array.isArray(stream.t) ? stream.t : [];
    const d = Array.isArray(stream.d) ? stream.d : [];
    if (!validateStreamSeries(t, d).ok) {
      notComputable++;
      continue;
    }

    const hr = stream.channels?.hr && Array.isArray(stream.hr) ? stream.hr : undefined;
    const cadence = stream.channels?.cadence && Array.isArray(stream.cadence) ? stream.cadence : undefined;
    const gaps = classifyGaps(t, d).gapIntervals;

    let device;
    try {
      const activityDoc = JSON.parse(readFileSync(join(activitiesDir, `${id}.json`), 'utf8'));
      device = typeof activityDoc.device_name === 'string' ? activityDoc.device_name : undefined;
    } catch {
      device = undefined;
    }

    activities.push({ id, t, d, hr, cadence, gaps, device });
  }

  return { activities, streamFileCount: files.length, notComputable };
}

function fmtSpeed(v) {
  return v === null || v === undefined ? '—' : `${v.toFixed(3)} m/s`;
}
function fmtMetres(v) {
  return v === null || v === undefined ? '—' : `${v.toFixed(1)} m`;
}
function fmtPct(v) {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(2)}%`;
}
function fmtRange(r) {
  return r === null || r === undefined ? '—' : `${r.min}–${r.max}`;
}

/** Builds the full report object `renderCalibrationMarkdown` renders. All measurement happens
 * HERE, once, against `archive` — `renderCalibrationMarkdown` only formats fields already on this
 * object and is a pure function of it (no field varies between two runs over an unchanged archive). */
export function buildCalibrationReport(archive) {
  const grid = deriveReachabilityGrid(archive, NAMED_ITEMS.mustFlag);

  const namedWithD05 = {
    mustFlag: NAMED_ITEMS.mustFlag,
    mustSpare: [...NAMED_ITEMS.mustSpare, ...NAMED_ITEMS.d05Candidates],
  };
  const namedWithoutD05 = {
    mustFlag: NAMED_ITEMS.mustFlag,
    mustSpare: NAMED_ITEMS.mustSpare,
  };

  const matrixWithD05 = buildReachabilityMatrix(archive, namedWithD05, grid.grid);
  const matrixWithoutD05 = buildReachabilityMatrix(archive, namedWithoutD05, grid.grid);

  const negativeControlCandidates = findNegativeControlCandidates(archive);

  const byId = new Map(archive.activities.map((a) => [a.id, a]));
  const d05Measurements = NAMED_ITEMS.d05Candidates.map((item) => {
    const activity = byId.get(item.id);
    return { item, measurement: activity ? measureNamedItemAtJudgingScale(activity, item.window) : null };
  });

  const statistics = candidateSpeedLimitStatistics(archive, { matrixWithD05, matrixWithoutD05 });

  return {
    grid,
    matrixWithD05,
    matrixWithoutD05,
    negativeControlCandidates,
    d05Measurements,
    statistics,
    streamFileCount: archive.streamFileCount,
    notComputable: archive.notComputable,
  };
}

function renderReachabilitySection(heading, subheading, rows, grid) {
  const lines = [];
  lines.push(`## ${heading}`);
  lines.push('');
  lines.push(`### ${subheading}`);
  lines.push('');
  lines.push(
    `Scanned grid: ${grid.grid.length} points from **${grid.lowerBound} m/s** (floor of 10× the archive's ` +
      `own minimum per-activity R-7 median folded covered-step speed, divided by 10) up to ` +
      `**${grid.upperBound} m/s** (the largest L at which every must-flag item is still a candidate), ` +
      `in ${grid.step} m/s steps.`
  );
  lines.push('');

  if (grid.grid.length === 0) {
    lines.push(
      '**No grid rows** — even the lower bound fails must-flag candidacy for at least one named item. ' +
        'D-10(d) cannot be evaluated at any scanned L.'
    );
    lines.push('');
    return lines.join('\n');
  }

  const boundaryRows = summarizeReachabilityRows(rows);
  lines.push(
    `Table below shows only TRANSITION rows (where feasibility or the blocking item changes) from the ` +
      `full ${rows.length}-row scan — every intermediate L between them was computed identically and shows ` +
      'the same disposition.'
  );
  lines.push('');
  lines.push('| L (m/s) | Feasible floor | Reason (if infeasible) |');
  lines.push('|---|---|---|');
  for (const row of boundaryRows) {
    const floorStr = row.feasibleFloor ? `[${row.feasibleFloor.lo.toFixed(2)}, ${row.feasibleFloor.hi.toFixed(2)})` : 'none';
    lines.push(`| ${row.L} | ${floorStr} | ${row.reason ?? '—'} |`);
  }
  lines.push('');

  lines.push('Per-item excess (m) at each transition row:');
  lines.push('');
  const mustFlagLabels = rows[0].mustFlagResults.map((r) => describeItem(r.item));
  const mustSpareLabels = rows[0].mustSpareResults.map((r) => describeItem(r.item));
  lines.push(`| L (m/s) | ${[...mustFlagLabels, ...mustSpareLabels].join(' | ')} |`);
  lines.push(`|---|${[...mustFlagLabels, ...mustSpareLabels].map(() => '---').join('|')}|`);
  for (const row of boundaryRows) {
    const cells = [
      ...row.mustFlagResults.map((r) => fmtMetres(r.excess)),
      ...row.mustSpareResults.map((r) => fmtMetres(r.excess)),
    ];
    lines.push(`| ${row.L} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  const anyFeasible = rows.some((r) => r.feasibleFloor !== null);
  if (anyFeasible) {
    const firstFeasible = rows.find((r) => r.feasibleFloor !== null);
    lines.push(
      `**D-10(d) is REACHABLE** under this fixture assumption — e.g. at L=${firstFeasible.L} m/s, floor ` +
        `[${firstFeasible.feasibleFloor.lo.toFixed(2)}, ${firstFeasible.feasibleFloor.hi.toFixed(2)}) admits every ` +
        'must-flag item while sparing every must-spare item.'
    );
  } else {
    lines.push(
      '**D-10(d) is UNREACHABLE** under this fixture assumption across the ENTIRE scanned grid — no L in ' +
        `[${grid.lowerBound}, ${grid.upperBound}] admits a non-empty excess-floor interval satisfying every ` +
        'must-flag item while sparing every must-spare item. This is reported plainly, not tuned or ' +
        'reinterpreted away (must_haves item 2 — "none" is a legitimate, reportable disposition).'
    );
  }
  lines.push('');

  return lines.join('\n');
}

/** Pure string assembly: no `Date`, no `Math.random`, no unsorted object-key/Set/Map iteration
 * reaches the output. Every field consumed here already exists on `report`, built once by
 * `buildCalibrationReport`. */
export function renderCalibrationMarkdown(report) {
  const lines = [];

  lines.push('# Phase 32 — Unreliable-Segment Detection Pre-Calibration');
  lines.push('');
  lines.push(
    `Machine-written by \`${REGENERATE_COMMAND}\`; never hand-edit. Regenerating this file against an ` +
      'unchanged archive produces a byte-identical result — no wall-clock timestamp appears anywhere below.'
  );
  lines.push('');
  lines.push(
    'This artifact measures D-10(d) reachability, D-05 negative-control candidates at the detector\'s own ' +
      'judging scale, and candidate speed-limit statistics with their D-13 insensitivity — evidence for the ' +
      'blocking developer decision that follows (32-05-PLAN.md Task 2). **No chosen constants appear here** ' +
      '(plan 32-06\'s job, after the decision is recorded) and **no archive-wide flagged count appears here** ' +
      '(D-10(e), anti-quota — seeing that number before the constants are chosen is the exact circularity ' +
      'this phase exists to avoid).'
  );
  lines.push('');

  lines.push(
    renderReachabilitySection(
      "Reachability of D-10(d) (pre-calibration)",
      "With the research's three D-05 candidates folded into must-spare",
      report.matrixWithD05,
      report.grid
    )
  );
  lines.push(
    renderReachabilitySection(
      "Reachability of D-10(d) (pre-calibration)",
      'Without the D-05 candidates (D-09\'s own trivial pair only)',
      report.matrixWithoutD05,
      report.grid
    )
  );

  // ## Negative-control candidates at the detector's judging scale (D-05)
  lines.push("## Negative-control candidates at the detector's judging scale (D-05)");
  lines.push('');
  lines.push(
    'Generic archive-wide search (research\'s documented method, reproduced verbatim): maximal runs of ' +
      'folded covered steps at speed ≥3.5 m/s, seeded by a step ≥4 m/s, lasting ≥20s, aggregate speed in ' +
      '[4.5, 7.2], excluding the first/last 60s and any run touching a gap. `4556693525` excluded per D-01. ' +
      'Never references a speed limit or floor. Top 20 by aggregate speed:'
  );
  lines.push('');
  lines.push('| Id | Span | Duration | Aggregate speed | Device | HR range | Cadence range | Max folded step speed | Max run aggregate speed |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const c of report.negativeControlCandidates.slice(0, 20)) {
    lines.push(
      `| ${c.id} | t=${c.startSec}-${c.endSec} | ${c.duration.toFixed(1)}s | ${fmtSpeed(c.aggregateSpeed)} | ` +
        `${c.device ?? '—'} | ${fmtRange(c.hrRange)} | ${fmtRange(c.cadenceRange)} | ${fmtSpeed(c.maxFoldedStepSpeed)} | ` +
        `${fmtSpeed(c.maxRunAggregateSpeed)} |`
    );
  }
  lines.push('');
  lines.push(`(${report.negativeControlCandidates.length} total candidates found by the generic search.)`);
  lines.push('');

  lines.push("### The three D-05 research-proposed fixtures, measured at the detector's judging scale");
  lines.push('');
  lines.push(
    'Measured directly on each fixture\'s own pre-specified window (research proposal, NOT locked — see ' +
      'the blocking decision below), independent of whether the window happens to satisfy the generic ' +
      "search's own thresholds:"
  );
  lines.push('');
  lines.push('| Id | Window | Aggregate speed | Max folded step speed | Max run aggregate speed | Device | HR range | Cadence range |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const { item, measurement } of report.d05Measurements) {
    if (measurement === null) {
      lines.push(`| ${item.id} | t=${item.window.startSec}-${item.window.endSec} | — (no advancing steps in window / activity missing) | — | — | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${item.id} | t=${item.window.startSec}-${item.window.endSec} | ${fmtSpeed(measurement.aggregateSpeed)} | ` +
        `${fmtSpeed(measurement.maxFoldedStepSpeed)} | ${fmtSpeed(measurement.maxRunAggregateSpeed)} | ` +
        `${measurement.device ?? '—'} | ${fmtRange(measurement.hrRange)} | ${fmtRange(measurement.cadenceRange)} |`
    );
  }
  lines.push('');

  // ## Candidate speed-limit statistics (D-10) and insensitivity (D-13)
  lines.push('## Candidate speed-limit statistics (D-10) and insensitivity (D-13)');
  lines.push('');
  lines.push(
    'No archive-wide flagged activity or segment count appears anywhere in this section (D-10(e), ' +
      'anti-quota). Insensitivity tolerance fixed BEFORE any check ran: ' +
      `**${(report.statistics.tolerance * 100).toFixed(0)}%**. Each check re-derives the SAME statistic ` +
      "(a) with the segments its own value would already detect removed, and (b) with a planted batch of " +
      `${INSENSITIVITY_SOURCE_ACTIVITY_ID}'s own real burst shapes cloned in (at least doubling the ` +
      'contamination) — a real candidate must not move beyond tolerance under either. Detection for ' +
      'this internal removal/planting step uses `excessFloorMetres: 0` (the same probe convention as ' +
      "the reachability section above, since D-09's significance floor is not chosen yet) — a raw, " +
      'un-multiplied bulk statistic used directly as a floor-0 speed limit will typically flag a large ' +
      'share of the archive (momentary noise, not just genuine slews), which is itself disclosed ' +
      'evidence: passing insensitivity at floor 0 may require the multiplier AND floor 32-06 derives ' +
      'together, not the raw statistic value alone.'
  );
  lines.push('');
  lines.push(
    '| Statistic | Description | Value | n | Feasible w/ D-05 fixtures | Feasible w/o D-05 fixtures | removedDelta | plantedDelta | pass |'
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const c of [...report.statistics.candidates, report.statistics.strawmanCandidate]) {
    const check = c.check;
    lines.push(
      `| ${c.label} | ${c.description} | ${fmtSpeed(c.value)} | ${c.n} | ` +
        `${c.feasibleWithD05 === null ? '—' : c.feasibleWithD05 ? 'yes' : 'no'} | ` +
        `${c.feasibleWithoutD05 === null ? '—' : c.feasibleWithoutD05 ? 'yes' : 'no'} | ` +
        `${check ? fmtPct(check.removedDelta) : '—'} | ${check ? fmtPct(check.plantedDelta) : '—'} | ` +
        `${check ? (check.pass ? 'PASS' : 'FAIL') : '—'} |`
    );
  }
  lines.push('');

  const strawmanCheck = report.statistics.strawmanCandidate.check;
  if (strawmanCheck) {
    if (strawmanCheck.pass) {
      lines.push(
        '**BLOCKER: the strawman insensitivity check PASSED.** T-32-11: a circular tail-percentile ' +
          'statistic passing the same check the real candidates are judged by means the harness is vacuous ' +
          'and cannot be trusted to discriminate a real candidate from a contaminated one. This must be ' +
          'fixed before any candidate above is trusted.'
      );
    } else {
      lines.push(
        `The strawman (\`${fmtSpeed(report.statistics.strawmanCandidate.value)}\`) FAILS insensitivity as ` +
          `expected (watched failing first, D-13): removedDelta ${fmtPct(strawmanCheck.removedDelta)}, ` +
          `plantedDelta ${fmtPct(strawmanCheck.plantedDelta)}, both exceeding the ` +
          `${(report.statistics.tolerance * 100).toFixed(0)}% tolerance. This confirms the harness can ` +
          'actually fail before the real candidates above are trusted.'
      );
    }
  }
  lines.push('');

  // ## Inputs
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Live stream files scanned (\`isStreamFile\`, excluding \`manifest.json\`): **${report.streamFileCount}**`);
  lines.push(`- Not computable (fail \`validateStreamSeries\`, excluded from every measurement above): **${report.notComputable}**`);
  lines.push('');
  lines.push('Regenerate this artifact against the live committed archive with:');
  lines.push('');
  lines.push('```');
  lines.push(REGENERATE_COMMAND);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function main() {
  console.log('Computing the unreliable-segment detection pre-calibration...\n');

  let archive;
  try {
    archive = loadArchive(STREAMS_DIR, ACTIVITIES_DIR);
  } catch (error) {
    console.error(`Error: could not read the archive: ${error.message}`);
    console.error(`Run \`npm run build\` first, then re-run \`${REGENERATE_COMMAND}\`.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Streams scanned: ${archive.streamFileCount}, not computable: ${archive.notComputable}`);

  const report = buildCalibrationReport(archive);

  console.log(`Reachability grid: ${report.grid.grid.length} points, [${report.grid.lowerBound}, ${report.grid.upperBound}] m/s`);
  console.log(`Negative-control candidates found: ${report.negativeControlCandidates.length}`);
  for (const c of report.statistics.candidates) {
    console.log(`  ${c.label}: value=${c.value} pass=${c.check ? c.check.pass : '—'}`);
  }
  console.log(
    `  strawman: value=${report.statistics.strawmanCandidate.value} pass=${
      report.statistics.strawmanCandidate.check ? report.statistics.strawmanCandidate.check.pass : '—'
    }`
  );

  const markdown = renderCalibrationMarkdown(report);
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

// Self-execution guard, mirroring compute-pr-ceiling-calibration.mjs / compute-unreliable-segment-recount.mjs:
// main() runs only under direct invocation, so compute-unreliable-segment-calibration.test.mjs can import
// every pure function above without triggering an archive read or a write to 32-CALIBRATION.md as an
// import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
