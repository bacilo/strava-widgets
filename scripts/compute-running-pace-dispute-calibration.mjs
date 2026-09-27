/**
 * Phase 35 plan 06 (RPACE-03, D-02/D-05/D-06/D-07): the HALT-capable calibration generator for the
 * running-pace dispute threshold that replaces the retired span-based `streamPaceSecPerKm` rule
 * (D-01). This file implements 35-06-PLAN.md's `<interfaces>` block LITERALLY — that text is THE
 * PRE-DECLARATION, written before any measurement. If the implementation and that text ever
 * disagree, the text wins and this file is the bug.
 *
 * This generator legitimately imports the compiled `deriveRunningPace` (`../dist/analytics/
 * pace-derivation.js`) — arbitration over the shipped function is this script's purpose, the
 * opposite of `compute-running-pace-recount.mjs`'s deliberately zero-import contract. It reads
 * `data/streams/*.json` (raw `t`/`d`) and `data/activities/*.json` (`moving_time`, `distance`)
 * directly, computing `metadataPaceSecPerKm = moving_time / (distance / 1000)` from scratch — the
 * SAME shape `compute-dashboard-index.ts`'s own `paceSecPerKm` already uses, re-derived here rather
 * than imported.
 *
 * BUILD-ONLY (D-05: no peeking). `main()` is gated behind the standard self-execution guard at the
 * bottom, so `compute-running-pace-dispute-calibration.test.mjs` can import every pure function
 * without triggering an archive read or a write to `35-CALIBRATION.md` as an import-time side
 * effect. This plan never invokes `main()` against the real archive — that is plan 35-07's job.
 *
 * No wall-clock timestamp or generated-at field appears anywhere in the rendered output — a re-run
 * against an unchanged archive is byte-identical. Provenance is content-addressed to
 * `data/streams`' own git tree (`gitId('rev-parse HEAD:data/streams')`), never a bare `rev-parse
 * HEAD`, never a wall-clock read, never a source-file hash.
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { deriveRunningPace, quantile } from '../dist/analytics/pace-derivation.js';
import { isStreamFile, idFromFilename } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const ACTIVITIES_DIR = join(ROOT_DIR, 'data/activities');
const OUTPUT_PATH = join(
  ROOT_DIR,
  '.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md'
);
const REGENERATE_COMMAND = 'npm run compute-running-pace-dispute-calibration';

// ---------------------------------------------------------------------------
// Fixed constants — pre-declared before any measurement (D-05)
// ---------------------------------------------------------------------------

/** D-13's tolerance, fixed before any check runs. Never widened, on any axis, for any reason. */
export const INSENSITIVITY_TOLERANCE = 0.01;

/** The four named 35-CONTEXT.md scoping activities, reported individually every run. */
export const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390', '5059204779'];

/**
 * S0's strawman target — the very activity ROADMAP criterion 3 requires to be badged. S0 reads its
 * cut directly off this activity's own delta, which is precisely why S0 is a strawman rather than a
 * candidate: it cannot fail to badge the activity it is built from.
 */
export const STRAWMAN_TARGET_ACTIVITY_ID = '3475724402';

// ---------------------------------------------------------------------------
// Per-activity statistics (D-06, D-07)
// ---------------------------------------------------------------------------

/**
 * `delta = runningPaceSecPerKm - metadataPaceSecPerKm` (sec/km; positive means the running pace is
 * slower). `ratio = runningPaceSecPerKm / metadataPaceSecPerKm` (positive, dimensionless). Direction
 * is SLOWER-ONLY (D-06): only `delta > 0` / `ratio > 1` can badge. Both statistics assume the
 * record already cleared the eligibility base filter (`computable === true`, `metadataPaceSecPerKm
 * > 0`) — callers never invoke these on a record that has not.
 */
export const STATISTICS = Object.freeze({
  delta: (record) => record.runningPaceSecPerKm - record.metadataPaceSecPerKm,
  ratio: (record) => record.runningPaceSecPerKm / record.metadataPaceSecPerKm,
});

/**
 * Builds a synthetic record whose statistic (`delta` or `ratio`) evaluates to exactly `value` —
 * used ONLY by Axis B's proportional planting, never by real archive loading. `id` is a caller-
 * supplied sentinel, never colliding with a real numeric activity id.
 */
export function buildSyntheticStatisticRecord(statisticName, value, id) {
  if (statisticName === 'ratio') {
    return { id, computable: true, metadataPaceSecPerKm: 1, runningPaceSecPerKm: value };
  }
  // delta: metadataPaceSecPerKm=1 makes runningPaceSecPerKm - metadataPaceSecPerKm === value - 1 + 1...
  // stated directly: runningPaceSecPerKm = 1 + value so delta === value exactly.
  return { id, computable: true, metadataPaceSecPerKm: 1, runningPaceSecPerKm: 1 + value };
}

/** `Number.isFinite`-gated relative movement, `null` on any non-finite or zero-base input — the ONE
 * movement computation every axis (A/B/C) shares, never re-derived per axis. */
function relativeMovement(baseCut, otherCut) {
  if (!Number.isFinite(baseCut) || baseCut === 0 || !Number.isFinite(otherCut)) return null;
  return Math.abs(otherCut - baseCut) / Math.abs(baseCut);
}

// ---------------------------------------------------------------------------
// Populations E, C, B (D-02) and their disjointness (D-05's non-circularity argument)
// ---------------------------------------------------------------------------

/** The base eligibility every one of E/C/B additionally requires: a computable stream with a
 * positive metadata pace. Neither condition is a free parameter. */
function eligibleBase(record) {
  return (
    record.computable === true &&
    record.metadataPaceSecPerKm !== null &&
    record.metadataPaceSecPerKm > 0
  );
}

/**
 * E, the eligible population (D-02's zero-free-parameter eligibility gate): `excludedM > 0` — the
 * mechanism filter that separates distance-covered-off-the-clock disagreements from pure
 * `moving_time` divergence (`elapsedVsMoving`'s territory).
 * C, the tight control: `excludedM === 0 AND excludedSec === 0` — nothing withheld in either unit.
 * B, the broad control: `excludedM === 0`; seconds may have been withheld.
 *
 * C and B are each DISJOINT from E by construction (`excludedM === 0` versus `excludedM > 0`) — see
 * `assertPopulationsDisjoint` below, which encodes that as a runtime assertion, never a comment.
 */
export function buildPopulations(records) {
  const E = records.filter((r) => eligibleBase(r) && r.excludedM > 0);
  const C = records.filter((r) => eligibleBase(r) && r.excludedM === 0 && r.excludedSec === 0);
  const B = records.filter((r) => eligibleBase(r) && r.excludedM === 0);
  return { E, C, B };
}

/**
 * Asserts C and B are each disjoint from E — the non-circularity argument (D-05) encoded as a
 * runtime abort, not a comment. Throws (never returns a boolean) with a NAMED reason on violation,
 * so a violated assertion aborts the run rather than proceeding with a contaminated population.
 * Deliberately takes the three already-built arrays (never re-derives them from raw records) so a
 * test can drive it directly with a synthetic, deliberately-overlapping triple.
 */
export function assertPopulationsDisjoint(E, C, B) {
  const eIds = new Set(E.map((r) => r.id));

  const overlapWithC = C.filter((r) => eIds.has(r.id)).map((r) => r.id);
  if (overlapWithC.length > 0) {
    throw new Error(
      `D-05 disjointness violated: population C shares ${overlapWithC.length} activity id(s) with ` +
        `population E (${overlapWithC.join(', ')}) -- C requires excludedM === 0 while E requires ` +
        'excludedM > 0, so no activity may legitimately belong to both. Aborting rather than ' +
        'proceeding with a contaminated population.'
    );
  }

  const overlapWithB = B.filter((r) => eIds.has(r.id)).map((r) => r.id);
  if (overlapWithB.length > 0) {
    throw new Error(
      `D-05 disjointness violated: population B shares ${overlapWithB.length} activity id(s) with ` +
        `population E (${overlapWithB.join(', ')}) -- B requires excludedM === 0 while E requires ` +
        'excludedM > 0, so no activity may legitimately belong to both. Aborting rather than ' +
        'proceeding with a contaminated population.'
    );
  }
}

// ---------------------------------------------------------------------------
// Cut functions (one per shape, D-05's pre-declared table)
// ---------------------------------------------------------------------------

/** A quantile-cut factory: `quantile(sortedAsc(statistic over population), q)`, reusing the ONE R-7
 * `quantile` implementation (`pace-derivation.ts`) — never a second percentile definition. */
function quantileCut(statisticName, q) {
  const statFn = STATISTICS[statisticName];
  return (population) => {
    const values = population.map(statFn).sort((a, b) => a - b);
    return quantile(values, q);
  };
}

/**
 * The fraction of `population` (by count, minimum 2 members) that S0's own gap statistic reads —
 * LOCAL to `strawmanCutS0`, never the shared `INSENSITIVITY_TOLERANCE` (that constant is a
 * pass/fail threshold on MOVEMENT; this is a WINDOW SIZE over which a gap is measured, a different
 * quantity). 35-07-HALT-1.md diagnosed the original (whole-population) minimum-gap statistic as
 * structurally insensitive to Axis C (trims the population's own top 1%) on a dense archive: the
 * statistic's own minimum gap sat in the crowded MIDDLE, a region Axis C's tail trim never touches.
 * Restricting the gap search to the top `S0_TAIL_WINDOW_FRACTION` of the sorted deltas puts the
 * statistic in the exact zone the trim perturbs — fixed at 5%, comfortably wider than the axis's
 * own ~1% trim count, so the trimmed members always fall inside (or immediately reshape) the
 * window being read.
 */
const S0_TAIL_WINDOW_FRACTION = 0.05;

/**
 * The minimum gap between adjacent sorted values, restricted to the top `windowFraction` of
 * `sortedAscValues` (minimum 2 values) — never the whole array, and never filtered to exclude a
 * gap of exactly zero. `null` only when the window cannot contain two values at all (a population
 * of fewer than two records).
 *
 * Deliberately does NOT skip a zero gap (a tie), unlike the originally pre-declared 35-06
 * statistic's "smallest POSITIVE gap": Axis B's plant mechanism (`plantMaxStatistic`) only ever
 * adds MORE COPIES of a value the population already contains (its own observed max) — it never
 * introduces a new distinct value. A statistic that skips ties can therefore never move under
 * Axis B's plant, in ANY window, because a duplicate of an existing value produces a gap of
 * exactly zero, which a positive-only filter discards in favor of whatever nonzero gap already
 * existed — silently reproducing the exact insensitivity this gap-closure exists to fix, just one
 * level down. Counting the zero gap directly (this function) makes the statistic move to it.
 */
function minGapInTailWindow(sortedAscValues, windowFraction) {
  const windowSize = Math.max(2, Math.ceil(windowFraction * sortedAscValues.length));
  const windowStart = Math.max(0, sortedAscValues.length - windowSize);
  const window = sortedAscValues.slice(windowStart);
  if (window.length < 2) return null;

  let minGap = Infinity;
  for (let i = 1; i < window.length; i++) {
    const gap = window[i] - window[i - 1];
    if (gap < minGap) minGap = gap;
  }
  return minGap;
}

/**
 * S0's cut (STRAWMAN, must FAIL): `delta(3475724402) minus the minimum gap between adjacent delta
 * ranks in the top `S0_TAIL_WINDOW_FRACTION` of E`. Deliberately circular — the cut sits just below
 * the target's own delta, so the target cannot fail to badge under it. Returns `null` when the
 * target is absent from `population` (e.g. after Axis A's badged-contribution removal, or a
 * synthetic population that never included it) or when the population has fewer than two records
 * (no gap is derivable at all) — never a computed zero standing in for "not derivable". A
 * genuinely tied tail window (every member equal) legitimately measures a gap of zero, which is
 * NOT the same case and is handled by `minGapInTailWindow` returning `0`, not `null`.
 *
 * GAP-CLOSURE (35-07, post 35-07-HALT-1.md): the tail-window restriction and the tie-inclusive gap
 * are the ONLY changes from the originally pre-declared 35-06 statistic (which read a
 * "smallest POSITIVE gap" anywhere in E). The statistic family (a minimum-gap distance below the
 * target's own delta), the target activity, the direction, and every other shape/axis/tolerance are
 * untouched.
 */
export function strawmanCutS0(population) {
  const target = population.find((r) => r.id === STRAWMAN_TARGET_ACTIVITY_ID);
  if (!target) return null;

  const targetDelta = STATISTICS.delta(target);
  const sortedDeltas = population.map(STATISTICS.delta).sort((a, b) => a - b);

  const gap = minGapInTailWindow(sortedDeltas, S0_TAIL_WINDOW_FRACTION);

  if (gap === null) return targetDelta;
  return targetDelta - gap;
}

// ---------------------------------------------------------------------------
// THE SEVEN PRE-DECLARED SHAPES, in first-clearing order (D-05's table, verbatim)
// ---------------------------------------------------------------------------

const CONTROL_C_NON_CIRCULARITY =
  'C is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of C ' +
  'provably has zero distance withheld off the clock and zero time withheld -- precisely the ' +
  'mechanism the badge detects. A cut derived from C cannot be circular with respect to E.';

const CONTROL_B_NON_CIRCULARITY =
  'B is disjoint from E by construction (excludedM === 0 vs excludedM > 0): every member of B ' +
  'provably has zero distance withheld off the clock, though seconds may have been withheld -- B ' +
  "excludes only the distance mechanism, a broader but still non-circular control than C.";

export const SHAPES = Object.freeze([
  Object.freeze({
    id: 'S0',
    basePopulation: 'E',
    statistic: 'delta',
    cut: strawmanCutS0,
    isStrawman: true,
    meaning:
      'S0 is a deliberately circular STRAWMAN: its cut is delta(3475724402) minus the minimum gap ' +
      'between adjacent delta ranks in the top 5% (tail window) of E, so 3475724402 cannot fail to ' +
      'badge under it. (Gap-closure, 35-07: originally read the smallest POSITIVE gap anywhere in ' +
      'E; 35-07-HALT-1.md measured that whole-population statistic as structurally insensitive to ' +
      "Axis C's tail trim on a dense archive, so the search was restricted to the tail window the " +
      'trim actually perturbs, and the positive-only filter was dropped so a duplicate planted at ' +
      "the population's own max -- Axis B's mechanism -- registers as the zero-gap it actually is.)",
    nonCircularity:
      'NONE -- S0 reads its cut off the very activity ROADMAP criterion 3 requires to be badged, so ' +
      'it is evidence of nothing. If S0 clears the D-13 insensitivity axes the round is invalid: the ' +
      'generator renders NO SHAPE CLEARS with strawmanCleared: true and never proceeds to C1.',
    caveats:
      'Must FAIL. A strawman that clears the insensitivity axes invalidates the entire calibration ' +
      "round (32 D-13's binding precedent) -- it is never a fallback candidate.",
  }),
  Object.freeze({
    id: 'C1',
    basePopulation: 'C',
    statistic: 'delta',
    cut: quantileCut('delta', 0.95),
    meaning:
      'The 95th percentile of the absolute sec/km disagreement (delta = runningPaceSecPerKm - ' +
      'metadataPaceSecPerKm) over C, the tight control population.',
    nonCircularity: CONTROL_C_NON_CIRCULARITY,
    caveats:
      'Ranks first: q95 precedes q99 in the arbitration order because a q99 over a control is ' +
      "strictly more tail-sensitive, and D-13's own axes punish that -- the more robust reading is " +
      'offered the chance first. The delta sibling precedes its ratio twin (D-07) because an ' +
      'absolute sec/km figure is directly readable in the disclosure sentence and in the same unit ' +
      'as every pace figure on the page.',
  }),
  Object.freeze({
    id: 'C3',
    basePopulation: 'C',
    statistic: 'ratio',
    cut: quantileCut('ratio', 0.95),
    meaning:
      'The 95th percentile of the pace ratio (ratio = runningPaceSecPerKm / metadataPaceSecPerKm) ' +
      'over C, the tight control population.',
    nonCircularity: CONTROL_C_NON_CIRCULARITY,
    caveats:
      "Ranks after C1: a ratio is scale-free but is not directly readable against every other pace " +
      'figure on the page the way an absolute sec/km delta is (D-07).',
  }),
  Object.freeze({
    id: 'C2',
    basePopulation: 'C',
    statistic: 'delta',
    cut: quantileCut('delta', 0.99),
    meaning: 'The 99th percentile of delta over C, the tight control population.',
    nonCircularity: CONTROL_C_NON_CIRCULARITY,
    caveats:
      'Ranks after C1/C3: q99 over a control is strictly more tail-sensitive than q95, which D-13\'s ' +
      'own insensitivity axes punish -- the more robust q95 reading is offered the chance first.',
  }),
  Object.freeze({
    id: 'C4',
    basePopulation: 'C',
    statistic: 'ratio',
    cut: quantileCut('ratio', 0.99),
    meaning: 'The 99th percentile of ratio over C, the tight control population.',
    nonCircularity: CONTROL_C_NON_CIRCULARITY,
    caveats: 'Ranks last among the C-based shapes: both a q99 order (vs q95) and a ratio (vs delta).',
  }),
  Object.freeze({
    id: 'B1',
    basePopulation: 'B',
    statistic: 'delta',
    cut: quantileCut('delta', 0.95),
    meaning: 'The 95th percentile of delta over B, the broad control population.',
    nonCircularity: CONTROL_B_NON_CIRCULARITY,
    caveats:
      'Ranks after every C-based shape: control C provably excludes BOTH disagreement mechanisms ' +
      '(distance and time), while B excludes only the distance one -- C is offered the chance to ' +
      'clear first.',
  }),
  Object.freeze({
    id: 'B2',
    basePopulation: 'B',
    statistic: 'ratio',
    cut: quantileCut('ratio', 0.95),
    meaning: 'The 95th percentile of ratio over B, the broad control population.',
    nonCircularity: CONTROL_B_NON_CIRCULARITY,
    caveats: 'Ranks last: a ratio (D-07) over the broader, less circularity-proof control (D-05).',
  }),
]);

/** Considered and REJECTED on argument before measurement — never measured, never a candidate row. */
export const REJECTED_SHAPES = Object.freeze([
  'A percentile over the FULL computable population (not gated by excludedM > 0): this is exactly ' +
    "the contaminated 35-CONTEXT.md probe population D-05 forbids targeting, and it does not " +
    "separate mechanism (b) (pure moving_time divergence, zero distance withheld -- elapsedVsMoving's " +
    "territory) from mechanism (a) (distance covered off the clock -- this milestone's target). " +
    "D-02's eligibility gate exists precisely to make that separation a mechanism filter, not a " +
    'magnitude filter.',
  'A symmetric two-sided cut (badging both directions): rejected on D-06\'s own binding resolution -- ' +
    'the milestone\'s claim is distance covered off the clock reported as speed, a slower-only ' +
    'mechanism; the measured count on the faster side is reported as a finding below, never badged.',
]);

// ---------------------------------------------------------------------------
// Axis A — judged-contribution removal
// ---------------------------------------------------------------------------

/**
 * Axis A: re-derive the cut with the badged population's own contribution removed from the shape's
 * base population. For every C- and B-based shape this is STRUCTURALLY ZERO, because C and B are
 * both disjoint from E (the badged population's source) by construction -- rendered as the literal
 * status string `structural (0 by construction)`, which never counts as a pass (`shapeClears` never
 * reads `axisA`). For S0 (base population E) this axis genuinely bites: removing the badged
 * contribution removes 3475724402 itself, which S0's own cut function needs BY NAME -- so the
 * re-derived cut is typically undefined (`null`), a genuine, non-vacuous FAIL.
 */
export function axisAForShape(shape, basePopulation, baseCut) {
  if (shape.basePopulation !== 'E') {
    return {
      status: 'structural (0 by construction)',
      badgedCount: null,
      baseCut,
      removedCut: null,
      movement: null,
    };
  }

  const statFn = STATISTICS[shape.statistic];
  const badgedIds = new Set(
    basePopulation.filter((r) => Number.isFinite(baseCut) && statFn(r) > baseCut).map((r) => r.id)
  );
  const remainder = basePopulation.filter((r) => !badgedIds.has(r.id));
  const removedCut = shape.cut(remainder);
  const movement = relativeMovement(baseCut, removedCut);
  const status = movement !== null && movement <= INSENSITIVITY_TOLERANCE ? 'cleared' : 'failed';

  return { status, badgedCount: badgedIds.size, baseCut, removedCut, movement };
}

// ---------------------------------------------------------------------------
// Axis B — proportional planting
// ---------------------------------------------------------------------------

/**
 * The REAL planter: appends `count` synthetic members, each carrying `basePopulation`'s own
 * observed maximum statistic value (the most adversarial placement for a high quantile), to a copy
 * of `basePopulation`. `plantsEntered` is a SELF-REPORTED counter incremented once per successful
 * push -- kept independent of `population.length` so `evaluateAxisBFromPlanted`'s own accounting
 * check (`plantedItems === baseItems + plantsEntered`) is a genuine assertion, not a tautology: a
 * broken planter that increments the counter without pushing to `population` (or pushes to some
 * OTHER array) is exactly what that check is watching for.
 */
export function plantMaxStatistic(basePopulation, statisticName, count) {
  const statFn = STATISTICS[statisticName];
  const values = basePopulation.map(statFn);
  const maxValue = values.length === 0 ? 0 : Math.max(...values);

  const population = [...basePopulation];
  let plantsEntered = 0;
  for (let i = 0; i < count; i++) {
    population.push(buildSyntheticStatisticRecord(statisticName, maxValue, `planted-${statisticName}-${i}`));
    plantsEntered++;
  }

  return { population, plantsEntered, maxValue };
}

/**
 * Axis B's accounting + movement, taking an ALREADY-BUILT plant result (`{ population,
 * plantsEntered }`) -- never rebuilding it -- so a test can drive this with either the real
 * planter's output or a deliberately broken one (a `plantsEntered` count that does not match the
 * actual growth of `population`). `plantedItems === baseItems + plantsEntered` is the plan's own
 * plant-entry accounting, checked here BEFORE any movement verdict: an accounting failure is
 * `invalid (plant accounting failed)`, never `cleared`, regardless of what the movement happens to
 * measure (a broken planter that changes nothing produces a movement of exactly 0, the shape of a
 * perfect, meaningless clear -- exactly the vacuity 34 D-19 was written to fix).
 */
export function evaluateAxisBFromPlanted(shape, basePopulation, baseCut, plantResult) {
  const baseItems = basePopulation.length;
  const plantedItems = plantResult.population.length;
  const plantsEntered = plantResult.plantsEntered;
  const accountingOk = plantedItems === baseItems + plantsEntered;

  const plantedCut = shape.cut(plantResult.population);
  const movement = relativeMovement(baseCut, plantedCut);

  let status;
  if (!accountingOk) {
    status = 'invalid (plant accounting failed)';
  } else {
    status = movement !== null && movement <= INSENSITIVITY_TOLERANCE ? 'cleared' : 'failed';
  }

  return { baseItems, plantedItems, plantsEntered, accountingOk, baseCut, plantedCut, movement, status };
}

/** Axis B end-to-end for one shape: plant count is `Math.ceil(INSENSITIVITY_TOLERANCE * N)`, N the
 * shape's own base population size. */
export function axisBForShape(shape, basePopulation, baseCut) {
  const N = basePopulation.length;
  const plantCount = Math.ceil(INSENSITIVITY_TOLERANCE * N);
  const plantResult = plantMaxStatistic(basePopulation, shape.statistic, plantCount);
  return { plantCount, ...evaluateAxisBFromPlanted(shape, basePopulation, baseCut, plantResult) };
}

// ---------------------------------------------------------------------------
// Axis C — base-tail removal (the mirror of Axis B)
// ---------------------------------------------------------------------------

/**
 * The REAL trimmer: sorts `basePopulation` by the shape's OWN statistic, drops the `membersRemoved`
 * largest, and returns the remaining `{ trimmedPopulation, removedStatisticValues }` -- the dropped
 * members' own statistic values, for the artifact's audit row. Never re-sorts by a different
 * statistic and never reuses Axis B's planted collection.
 */
export function trimBaseTail(basePopulation, statisticName, membersRemoved) {
  const statFn = STATISTICS[statisticName];
  const sorted = [...basePopulation].sort((a, b) => statFn(a) - statFn(b));
  const keepCount = Math.max(0, sorted.length - membersRemoved);
  const trimmedPopulation = sorted.slice(0, keepCount);
  const removedStatisticValues = sorted.slice(keepCount).map(statFn);
  return { trimmedPopulation, removedStatisticValues };
}

/**
 * Axis C's accounting + movement, taking an ALREADY-TRIMMED population -- never re-trimming -- so a
 * test can drive this with either the real trimmer's output or a deliberately broken one (a
 * `trimmedPopulation` that does not actually differ from `basePopulation`, simulating a trimmer that
 * removed members from a list the shape's cut function does not read).
 *
 * Removal accounting: `trimmedItems === baseItems - membersRemoved`, counted in the collection
 * ACTUALLY passed as `trimmedPopulation` (the collection the shape's own cut function will read) --
 * never in a sibling list. A violation is `invalid (removal accounting failed)`, never `cleared`,
 * regardless of what the movement happens to measure (a broken trimmer that removes nothing
 * produces a movement of exactly 0 -- the shape of a perfect, meaningless clear). `membersRemoved
 * === 0` is `invalid (no member removed)` -- a zero movement counts as a clear ONLY when at least
 * one member was actually removed from the read population.
 */
export function evaluateAxisCFromTrimmed(shape, basePopulation, baseCut, trimmedPopulation, membersRemoved) {
  const baseItems = basePopulation.length;
  const trimmedItems = trimmedPopulation.length;
  const accountingOk = trimmedItems === baseItems - membersRemoved;

  const trimmedIds = new Set(trimmedPopulation.map((r) => r.id));
  const removedStatisticValues = basePopulation
    .filter((r) => !trimmedIds.has(r.id))
    .map(STATISTICS[shape.statistic]);

  const trimmedCut = shape.cut(trimmedPopulation);
  const movement = relativeMovement(baseCut, trimmedCut);

  let status;
  if (!accountingOk) {
    status = 'invalid (removal accounting failed)';
  } else if (membersRemoved === 0) {
    status = 'invalid (no member removed)';
  } else {
    status = movement !== null && movement <= INSENSITIVITY_TOLERANCE ? 'cleared' : 'failed';
  }

  return {
    baseItems,
    membersRemoved,
    trimmedItems,
    removedStatisticValues,
    baseCut,
    trimmedCut,
    movement,
    status,
  };
}

/** Axis C end-to-end for one shape: `membersRemoved = Math.ceil(INSENSITIVITY_TOLERANCE * N)`, N the
 * shape's own base population size -- the same expression Axis B's plant count uses, referencing
 * the same constant. */
export function axisCForShape(shape, basePopulation, baseCut) {
  const N = basePopulation.length;
  const membersRemoved = Math.ceil(INSENSITIVITY_TOLERANCE * N);
  const { trimmedPopulation } = trimBaseTail(basePopulation, shape.statistic, membersRemoved);
  return evaluateAxisCFromTrimmed(shape, basePopulation, baseCut, trimmedPopulation, membersRemoved);
}

// ---------------------------------------------------------------------------
// The clearing predicate — ONE named function, never re-implemented at a call site
// ---------------------------------------------------------------------------

/**
 * A shape CLEARS only when Axis B AND Axis C both report `cleared`. Axis A is rendered with its own
 * status and NEVER counted — this function does not read `axisA` at all, so no call site can
 * accidentally admit a `structural` or `invalid` status as a pass.
 */
export function shapeClears(axes) {
  return axes.axisB.status === 'cleared' && axes.axisC.status === 'cleared';
}

/** Evaluates all three axes for one shape against an already-built population set, and applies
 * `shapeClears`. */
export function evaluateShapeAxes(shape, populations) {
  const basePopulation = populations[shape.basePopulation];
  const baseCut = shape.cut(basePopulation);

  const axisA = axisAForShape(shape, basePopulation, baseCut);
  const axisB = axisBForShape(shape, basePopulation, baseCut);
  const axisC = axisCForShape(shape, basePopulation, baseCut);
  const cleared = shapeClears({ axisB, axisC });

  return {
    id: shape.id,
    statistic: shape.statistic,
    basePopulationKey: shape.basePopulation,
    basePopulationSize: basePopulation.length,
    cutValue: baseCut,
    axisA,
    axisB,
    axisC,
    cleared,
  };
}

// ---------------------------------------------------------------------------
// Arbitration and the basis gate
// ---------------------------------------------------------------------------

/** `PACE_DISAGREEMENT_RUNNING_DELTA_SEC_PER_KM` for a delta-family shape, or
 * `PACE_DISAGREEMENT_RUNNING_RATIO` for a ratio-family shape (D-07). */
export function constantNameForStatistic(statisticName) {
  return statisticName === 'delta'
    ? 'PACE_DISAGREEMENT_RUNNING_DELTA_SEC_PER_KM'
    : 'PACE_DISAGREEMENT_RUNNING_RATIO';
}

/**
 * The basis gate, applied AFTER arbitration, to the already-selected shape ONLY: the cleared
 * shape's cut must badge `STRAWMAN_TARGET_ACTIVITY_ID` under the eligibility gate (`excludedM > 0`)
 * and the slower-only direction (`statistic(target) > cut`). A different shape is NEVER substituted
 * to satisfy this gate — substitution would make the gate a selector, which the anti-quota rule
 * forbids (Phase 27 D-02).
 */
export function applyBasisGate(chosenRow, records) {
  const target = records.find((r) => r.id === STRAWMAN_TARGET_ACTIVITY_ID);
  if (!target) {
    return {
      pass: false,
      targetFound: false,
      eligible: false,
      targetValue: null,
      cut: chosenRow.cutValue,
      statistic: chosenRow.statistic,
      reason: `basis-gate target activity ${STRAWMAN_TARGET_ACTIVITY_ID} not found in this archive`,
    };
  }

  const eligible = eligibleBase(target) && target.excludedM > 0;
  const statFn = STATISTICS[chosenRow.statistic];
  const targetValue = eligible ? statFn(target) : null;
  const badged =
    eligible && targetValue !== null && Number.isFinite(chosenRow.cutValue) && targetValue > chosenRow.cutValue;

  return {
    pass: badged,
    targetFound: true,
    eligible,
    targetValue,
    cut: chosenRow.cutValue,
    statistic: chosenRow.statistic,
    reason: badged
      ? null
      : eligible
        ? 'target value does not exceed the chosen cut under the slower-only direction'
        : `target activity failed the eligibility gate (excludedM must be > 0; got ${target.excludedM})`,
  };
}

/**
 * Archive-wide findings, reported and NEVER used to select (Phase 27 D-02 anti-quota): the newly-
 * disputed count under the chosen cut, the faster-side count at the mirror cut (D-06), the
 * gate-excluded population size with its own delta summary (D-02), the non-computable count with
 * reasons, and the badged/not-badged status of the four named activities. Computed ONLY when a
 * constant actually shipped — otherwise the counts that depend on a cut are `null`, never a
 * fabricated zero.
 */
export function buildFindings(records, populations, chosenRow, constantShipped) {
  let newlyDisputedCount = null;
  let fasterSideCount = null;

  if (constantShipped) {
    const statFn = STATISTICS[chosenRow.statistic];
    newlyDisputedCount = populations.E.filter((r) => statFn(r) > chosenRow.cutValue).length;

    const mirrorThreshold =
      chosenRow.statistic === 'delta'
        ? -chosenRow.cutValue
        : chosenRow.cutValue !== 0
          ? 1 / chosenRow.cutValue
          : null;
    fasterSideCount =
      mirrorThreshold === null ? null : populations.E.filter((r) => statFn(r) < mirrorThreshold).length;
  }

  const gateExcludedDeltas = populations.B.map(STATISTICS.delta).sort((a, b) => a - b);
  const gateExcludedDeltaSummary =
    gateExcludedDeltas.length === 0
      ? null
      : {
          n: gateExcludedDeltas.length,
          q50: quantile(gateExcludedDeltas, 0.5),
          min: gateExcludedDeltas[0],
          max: gateExcludedDeltas[gateExcludedDeltas.length - 1],
        };

  const notComputable = { total: 0, reasons: {} };
  for (const r of records) {
    if (r.computable === false) {
      notComputable.total++;
      const reason = r.notComputableReason ?? 'unknown';
      notComputable.reasons[reason] = (notComputable.reasons[reason] ?? 0) + 1;
    }
  }

  const namedActivities = NAMED_ACTIVITY_IDS.map((id) => {
    const record = records.find((r) => r.id === id);
    if (!record) return { id, found: false };

    const eligible = eligibleBase(record) && record.excludedM > 0;
    const delta = record.computable ? STATISTICS.delta(record) : null;
    const ratio = record.computable ? STATISTICS.ratio(record) : null;

    let status = 'not evaluated (no constant selected)';
    if (constantShipped) {
      if (!eligible) {
        status = 'not badged (fails eligibility gate)';
      } else {
        const statFn = STATISTICS[chosenRow.statistic];
        status = statFn(record) > chosenRow.cutValue ? 'badged' : 'not badged';
      }
    }

    return {
      id,
      found: true,
      eligible,
      computable: record.computable,
      excludedM: record.excludedM,
      excludedSec: record.excludedSec,
      delta,
      ratio,
      status,
    };
  });

  return {
    newlyDisputedCount,
    fasterSideCount,
    gateExcludedCount: populations.B.length,
    gateExcludedDeltaSummary,
    notComputable,
    namedActivities,
  };
}

/**
 * Runs the full D-05 pipeline over an already-loaded `records` array: builds E/C/B, asserts
 * disjointness, evaluates S0 then C1..B2 in first-clearing order, applies the basis gate to
 * whichever shape (if any) is selected, and computes the archive-wide findings. Three mutually
 * exclusive terminal states: `constantShipped` (a shape cleared AND the basis gate passed),
 * `noShapeClears` (the strawman cleared, or no real shape cleared), `gateFailed` (a shape cleared
 * but the basis gate did not).
 */
export function runCalibration(records) {
  const { E, C, B } = buildPopulations(records);
  assertPopulationsDisjoint(E, C, B);
  const populations = { E, C, B };

  const evaluated = SHAPES.map((shape) => evaluateShapeAxes(shape, populations));

  const s0Row = evaluated[0];
  const strawmanCleared = s0Row.cleared === true;

  let selectedId = null;
  if (!strawmanCleared) {
    const cleared = evaluated.slice(1).find((r) => r.cleared);
    selectedId = cleared ? cleared.id : null;
  }
  const chosenRow = selectedId !== null ? evaluated.find((r) => r.id === selectedId) : null;
  const noShapeClears = strawmanCleared || selectedId === null;

  let gate = null;
  let gateFailed = false;
  if (!noShapeClears) {
    gate = applyBasisGate(chosenRow, records);
    gateFailed = !gate.pass;
  }

  const constantShipped = !noShapeClears && !gateFailed;
  const findings = buildFindings(records, populations, chosenRow, constantShipped);

  return {
    populations,
    evaluated,
    strawmanCleared,
    selectedId,
    chosenRow,
    noShapeClears,
    gate,
    gateFailed,
    constantShipped,
    findings,
  };
}

/** Exit-code decision, mirroring the sibling calibration generators' own `decideOutcome`: 1 on a
 * passing strawman or a HALT, 0 when a constant genuinely shipped. */
export function decideOutcome(result) {
  if (result.strawmanCleared) return { exitCode: 1, reason: 'strawman-s0-passed' };
  if (result.noShapeClears) return { exitCode: 1, reason: 'no-shape-clears' };
  if (result.gateFailed) return { exitCode: 1, reason: 'gate-failed' };
  return { exitCode: 0, reason: null };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtNum(v, decimals = 4) {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : Number(v).toFixed(decimals);
}

function fmtPct(v, decimals = 4) {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(decimals)}%`;
}

function renderAxisA(axis) {
  const detail =
    axis.status === 'structural (0 by construction)'
      ? 'not applicable -- base population is disjoint from the badged population by construction'
      : `badgedCount=${axis.badgedCount} baseCut=${fmtNum(axis.baseCut)} removedCut=${fmtNum(axis.removedCut)} movement=${fmtPct(axis.movement)}`;
  return `| Axis A — judged-contribution removal | ${detail} | ${axis.status} |`;
}

function renderAxisB(axis) {
  const detail =
    `baseItems=${axis.baseItems} plantsEntered=${axis.plantsEntered} plantedItems=${axis.plantedItems} ` +
    `baseCut=${fmtNum(axis.baseCut)} plantedCut=${fmtNum(axis.plantedCut)} movement=${fmtPct(axis.movement)}`;
  return `| Axis B — proportional planting | ${detail} | ${axis.status} |`;
}

function renderAxisC(axis) {
  const detail =
    `membersRemoved=${axis.membersRemoved} baseItems=${axis.baseItems} trimmedItems=${axis.trimmedItems} ` +
    `baseCut=${fmtNum(axis.baseCut)} trimmedCut=${fmtNum(axis.trimmedCut)} movement=${fmtPct(axis.movement)}`;
  return `| Axis C — base-tail removal | ${detail} | ${axis.status} |`;
}

function renderShapeAxisTable(row) {
  const lines = [];
  lines.push(`Base population: ${row.basePopulationKey} (N=${row.basePopulationSize}), statistic: ${row.statistic}, cut=${fmtNum(row.cutValue)}`);
  lines.push('');
  lines.push('| Axis | Detail | Status |');
  lines.push('|---|---|---|');
  lines.push(renderAxisA(row.axisA));
  lines.push(renderAxisB(row.axisB));
  lines.push(renderAxisC(row.axisC));
  lines.push('');
  lines.push(`shapeClears: ${row.cleared}`);
  return lines.join('\n');
}

function renderPreDeclaredShape(shape) {
  return [
    `#### ${shape.id}`,
    '',
    `**Meaning:** ${shape.meaning}`,
    '',
    `**Non-circularity:** ${shape.nonCircularity}`,
    '',
    `**Caveats:** ${shape.caveats}`,
    '',
  ].join('\n');
}

/**
 * Rendered into the `## Non-circularity` section verbatim (D-05's contamination guard): the planner
 * has seen 35-CONTEXT.md's probe percentiles over the full computable population, but none of the
 * declared shapes reads that population, and no probe figure appears anywhere in this generator or
 * its tests.
 */
const CONTAMINATION_STATEMENT =
  "The planner has seen 35-CONTEXT.md's probe percentiles over the full computable population. NONE " +
  'of the declared shapes reads that population: C and B are both defined by excludedM === 0, a ' +
  'subset the probe never isolated or reported, and both are disjoint from E by construction. The ' +
  "probe's own candidate cuts are cuts applied to the full population -- precisely the shape none of " +
  'these declarations takes. No probe figure appears as a target, expected value or fixture anywhere ' +
  'in this generator or its tests.';

function renderFindings(findings) {
  const lines = [];
  lines.push(
    `Newly-disputed count under the chosen cut (population E): ` +
      `${findings.newlyDisputedCount === null ? 'not computed (no constant shipped)' : findings.newlyDisputedCount}`
  );
  lines.push(
    `Faster-side count at the mirror cut (D-06 finding, never badged): ` +
      `${findings.fasterSideCount === null ? 'not computed (no constant shipped)' : findings.fasterSideCount}`
  );
  const gateExcludedSummary = findings.gateExcludedDeltaSummary
    ? `, own delta summary: q50=${fmtNum(findings.gateExcludedDeltaSummary.q50, 2)} ` +
      `min=${fmtNum(findings.gateExcludedDeltaSummary.min, 2)} max=${fmtNum(findings.gateExcludedDeltaSummary.max, 2)}`
    : ' (empty)';
  lines.push(
    `Gate-excluded population (excludedM === 0, D-02's eligibility gate excludes this set): ` +
      `n=${findings.gateExcludedCount}${gateExcludedSummary}`
  );
  lines.push(
    `Non-computable (deriveRunningPace): ${findings.notComputable.total} ` +
      `(${JSON.stringify(findings.notComputable.reasons)})`
  );
  lines.push('');
  lines.push('| Named activity | found | eligible | delta | ratio | status |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of findings.namedActivities) {
    if (!row.found) {
      lines.push(`| ${row.id} | no | — | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${row.id} | yes | ${row.eligible} | ${fmtNum(row.delta, 2)} | ${fmtNum(row.ratio, 4)} | ${row.status} |`
    );
  }
  return lines.join('\n');
}

/**
 * Renders the full calibration artifact. `result.noShapeClears === true` renders `## NO SHAPE
 * CLEARS`; `result.gateFailed === true` renders `## GATE FAILED`; otherwise `## Chosen constants`.
 * Deterministic — no wall-clock timestamp, no bare `rev-parse HEAD` commit id, no source-file hash:
 * a re-render of the same `result` is byte-identical.
 */
export function renderCalibrationMarkdown(result) {
  const lines = [];

  lines.push('# Phase 35 Plan 6: running-pace dispute threshold calibration (RPACE-03)');
  lines.push('');
  lines.push(
    `Regenerate with \`${REGENERATE_COMMAND} -- --write\`. This artifact carries no wall-clock ` +
      "timestamp or generated-at field -- provenance is content-addressed to data/streams' own git " +
      'tree. A re-run against an unchanged archive is byte-identical.'
  );
  lines.push('');

  lines.push('## Statistic and scope');
  lines.push('');
  lines.push(
    'Populations E/C/B, the two per-activity statistics (delta, ratio) and the slower-only direction ' +
      "(D-06) are declared verbatim from 35-06-PLAN.md's pre-declaration (D-02, D-05, D-06, D-07), " +
      'before any archive measurement. delta = runningPaceSecPerKm - metadataPaceSecPerKm (positive ' +
      'means the running pace is slower); ratio = runningPaceSecPerKm / metadataPaceSecPerKm. ' +
      "Percentiles use the repo's ONE R-7 `quantile` definition, imported from " +
      '`dist/analytics/pace-derivation.js` -- never re-declared locally.'
  );
  lines.push('');

  lines.push('## Pre-declared shapes');
  lines.push('');
  for (const shape of SHAPES) {
    lines.push(renderPreDeclaredShape(shape));
  }

  lines.push('## Rejected on argument');
  lines.push('');
  for (const entry of REJECTED_SHAPES) lines.push(`- ${entry}`);
  lines.push('');

  lines.push('## Non-circularity');
  lines.push('');
  lines.push(CONTAMINATION_STATEMENT);
  lines.push('');
  for (const shape of SHAPES) {
    lines.push(`- **${shape.id}:** ${shape.nonCircularity}`);
  }
  lines.push('');

  lines.push('## Strawmen watched failing');
  lines.push('');
  const s0Row = result.evaluated[0];
  lines.push(renderShapeAxisTable(s0Row));
  lines.push('');
  lines.push(
    result.strawmanCleared
      ? '**BLOCKER: the strawman S0 PASSED the insensitivity tolerance (Axis B and Axis C both cleared).**'
      : `**FAILED (expected)** — S0's Axis B status is \`${s0Row.axisB.status}\`, Axis C status is ` +
          `\`${s0Row.axisC.status}\`.`
  );
  lines.push('');

  lines.push('## Shape arbitration');
  lines.push('');
  for (const row of result.evaluated) {
    lines.push(`### ${row.id}`);
    lines.push('');
    lines.push(renderShapeAxisTable(row));
    lines.push('');
  }
  lines.push(
    result.strawmanCleared
      ? 'Selected: NO SHAPE CLEARS (strawman S0 passed -- round invalid, no real shape was ever ' +
          'considered for selection)'
      : `Selected: ${result.selectedId ?? 'NO SHAPE CLEARS'}`
  );
  lines.push('');

  if (result.constantShipped) {
    lines.push('## Chosen constants');
    lines.push('');
    const name = constantNameForStatistic(result.chosenRow.statistic);
    lines.push(`${name} = ${fmtNum(result.chosenRow.cutValue, 4)}`);
    lines.push(
      `${name} provenance: calibrated (shape ${result.chosenRow.id}, base population ` +
        `${result.chosenRow.basePopulationKey}, N=${result.chosenRow.basePopulationSize})`
    );
    lines.push('');
  } else if (result.noShapeClears) {
    lines.push('## NO SHAPE CLEARS');
    lines.push('');
    lines.push(
      result.strawmanCleared
        ? 'The strawman S0 cleared the D-13 insensitivity axes (strawmanCleared: true). The round is ' +
            'invalid by construction -- S0 reads its cut directly off the one activity it is built to ' +
            'badge -- so no real shape (C1, C3, C2, C4, B1, B2) was ever evaluated for selection. ' +
            'Nothing is widened or loosened.'
        : 'No pre-declared shape (C1, C3, C2, C4, B1, B2) cleared both Axis B and Axis C at the fixed ' +
            '1% tolerance. No constant is named. Nothing is widened or loosened.'
    );
    lines.push('');
  } else {
    lines.push('## GATE FAILED');
    lines.push('');
    lines.push(
      `Shape ${result.chosenRow.id} cleared D-13 insensitivity, but the post-selection basis gate ` +
        `failed: ${result.gate.reason}. No constant is shipped. A different shape is NOT substituted ` +
        '-- substitution would make the gate a selector, which the anti-quota rule forbids.'
    );
    lines.push('');
  }

  lines.push('## Gates');
  lines.push('');
  if (result.gate) {
    lines.push('| Gate | Measured | Status |');
    lines.push('|---|---|---|');
    lines.push(
      `| Basis gate (${STRAWMAN_TARGET_ACTIVITY_ID} badged under eligibility + slower-only direction) ` +
        `| eligible=${result.gate.eligible} targetValue=${fmtNum(result.gate.targetValue)} ` +
        `cut=${fmtNum(result.gate.cut)} | ${result.gate.pass ? 'PASS' : 'FAIL'}` +
        `${result.gate.reason ? ` (${result.gate.reason})` : ''} |`
    );
  } else {
    lines.push('Basis gate: not evaluated -- no shape cleared to gate (see `## NO SHAPE CLEARS` above).');
  }
  lines.push('');
  lines.push(renderFindings(result.findings));
  lines.push('');

  lines.push('## Inputs');
  lines.push('');
  const archive = result.archive ?? {};
  const provenance = result.provenance ?? {};
  lines.push(
    `- Streams scanned: ${archive.streamFileCount ?? 'unknown'}, parse errors: ` +
      `${archive.parseErrorCount ?? 'unknown'}, missing metadata: ${archive.missingMetadataCount ?? 'unknown'}`
  );
  lines.push(`- data/streams git tree (git rev-parse HEAD:data/streams): \`${provenance.streamsTree ?? 'unknown'}\``);
  lines.push(`- Newest activity start date: ${provenance.newestActivityStartDate ?? 'unknown'}`);
  lines.push(`- Regenerate: \`${REGENERATE_COMMAND}\``);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main() — gated behind the self-execution guard
// ---------------------------------------------------------------------------

/** Content-addressed provenance: names the run's actual input (the committed stream archive's git
 * tree), never `rev-parse HEAD` alone, never a wall-clock read, never a source hash. */
function gitId(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown (git failed)';
  }
}

/**
 * Loads every `data/streams/*.json` file (via `isStreamFile`, never `manifest.json`), running each
 * through the shipped `deriveRunningPace` and pairing it with `data/activities/{id}.json`'s own
 * `moving_time`/`distance` to compute `metadataPaceSecPerKm` from scratch. A stream that fails to
 * parse is counted (`parseErrorCount`) and skipped; a missing or unparseable activity metadata file
 * yields `metadataPaceSecPerKm: null` and is counted (`missingMetadataCount`) — never coerced to a
 * fabricated pace.
 */
export function loadRecords(streamsDir, activitiesDir) {
  const files = readdirSync(streamsDir).filter(isStreamFile).sort();
  const records = [];
  let parseErrorCount = 0;
  let missingMetadataCount = 0;

  for (const filename of files) {
    const id = idFromFilename(filename);

    let stream;
    try {
      stream = JSON.parse(readFileSync(join(streamsDir, filename), 'utf8'));
    } catch {
      parseErrorCount++;
      continue;
    }

    const rp = deriveRunningPace(stream);

    let metadataPaceSecPerKm = null;
    try {
      const activityDoc = JSON.parse(readFileSync(join(activitiesDir, `${id}.json`), 'utf8'));
      const distanceM = activityDoc.distance;
      const movingTimeSec = activityDoc.moving_time;
      metadataPaceSecPerKm =
        distanceM > 0 && movingTimeSec > 0 ? movingTimeSec / (distanceM / 1000) : null;
    } catch {
      missingMetadataCount++;
    }

    records.push({
      id,
      computable: rp.computable,
      notComputableReason: rp.notComputableReason,
      runningPaceSecPerKm: rp.runningPaceSecPerKm,
      coveredM: rp.coveredM,
      coveredSec: rp.coveredSec,
      excludedM: rp.excludedM,
      excludedSec: rp.excludedSec,
      metadataPaceSecPerKm,
    });
  }

  return { records, streamFileCount: files.length, parseErrorCount, missingMetadataCount };
}

function newestActivityStartDate(activitiesDir) {
  let newest = null;
  let files;
  try {
    files = readdirSync(activitiesDir);
  } catch {
    return null;
  }
  for (const filename of files) {
    if (!filename.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(activitiesDir, filename), 'utf8'));
      if (typeof doc.start_date === 'string' && (newest === null || doc.start_date > newest)) {
        newest = doc.start_date;
      }
    } catch {
      // skip malformed activity docs — not this script's concern
    }
  }
  return newest;
}

function main() {
  console.log('Computing the running-pace dispute calibration (plan 35-06, D-02/D-05/D-06/D-07)...\n');
  const writeMode = process.argv.includes('--write');

  let archive;
  try {
    archive = loadRecords(STREAMS_DIR, ACTIVITIES_DIR);
  } catch (error) {
    console.error(`Error: could not read the archive: ${error.message}`);
    console.error('Run `npm run build` first, then re-run `npm run compute-running-pace-dispute-calibration`.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `Streams scanned: ${archive.streamFileCount}, parse errors: ${archive.parseErrorCount}, ` +
      `missing metadata: ${archive.missingMetadataCount}`
  );

  const result = runCalibration(archive.records);
  result.archive = archive;
  result.provenance = {
    streamsTree: gitId('rev-parse HEAD:data/streams'),
    newestActivityStartDate: newestActivityStartDate(ACTIVITIES_DIR),
  };

  console.log(`Strawman S0: cleared=${result.strawmanCleared}`);
  for (const row of result.evaluated) {
    console.log(`  ${row.id}: cutValue=${row.cutValue} cleared=${row.cleared}`);
  }
  console.log(`Selected: ${result.selectedId ?? 'none'}`);
  console.log(`Constant shipped: ${result.constantShipped}`);

  const markdown = renderCalibrationMarkdown(result);

  if (writeMode) {
    writeFileSync(OUTPUT_PATH, markdown, 'utf8');
    console.log(`\nWrote ${OUTPUT_PATH}`);
  } else {
    console.log(`\n${markdown}`);
    console.log(`\n(dry run -- pass --write to write ${OUTPUT_PATH})`);
  }

  const outcome = decideOutcome(result);
  process.exitCode = outcome.exitCode;
  if (outcome.exitCode !== 0) {
    console.error(`\nExit ${outcome.exitCode}: ${outcome.reason}. See the artifact for full detail.`);
  }
}

// Self-execution guard: main() runs only under direct invocation, so
// compute-running-pace-dispute-calibration.test.mjs can import every pure function above without
// triggering an archive read or a write to 35-CALIBRATION.md as an import-time side effect. This
// plan never runs main() against the real archive (D-05: no peeking) — that is plan 35-07's job.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
