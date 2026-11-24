/**
 * PR-09's third, genuinely independent reconciliation leg (D-13, 36-RESEARCH.md § D-13).
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming any of the following, by any spelling (`dist/analytics/...` or its `src/` equivalent):
 *   - `compute-best-efforts.js` — the orchestration under test (the "search" itself)
 *   - `best-effort-ceiling.js` and `best-effort-ceiling-state.js` — the ceiling derivation/state
 *   - `best-effort-utils.js` — `findBestEffort`, the two-pointer sweep the search reuses
 *   - `best-effort.types.js` — the shared vocabulary module (`TARGET_METERS`, `EffortDemotionGuard`,
 *     etc.) — reusing its constants would make this leg share vocabulary with the code it checks
 *   - `unreliable-segments.js` — `detectUnreliableSegments`, the detector itself
 *   - `pace-derivation.js` — named explicitly, with its own stated reason: `classifyGapsWithSegments`
 *     in this module is the SOLE call site of `detectUnreliableSegments` (36-RESEARCH.md § D-13's
 *     own mid-paragraph reversal: "this needs a sharper reading"). Importing
 *     `classifyGapsWithSegments` "just to get the segments alongside coverage" is importing the
 *     detector by any reasonable reading of this bar — it would make this leg a re-derivation of
 *     the detector, not an independent algorithm, defeating D-13's entire purpose.
 * Also barred, because neither is independent of the search either:
 *   - `scripts/compute-ceiling-recalibration.mjs` (the OLD-state reconstruction plan 36-11's diff
 *     imports — sharing it here would make legs 2 and 3 share a dependency, leaving only leg 1
 *     genuinely separate from the other two)
 *   - `scripts/compute-clean-window-diff.mjs` (PR-09 leg 1, the diff this leg reconciles against —
 *     a leg that imports the artifact it is meant to independently check is not independent)
 *
 * THE REASON, stated once rather than per-module: the diff (leg 1) and the walked guard count
 * inside that same artifact (leg 2) both read the SAME generated document, produced by the SAME
 * classifier under test — so if the search is wrong, they agree with each other AND with the
 * defect. This is Pitfall 11's "18 = 18" exactly. This project has twice shipped a Critical past a
 * guard that only checked the changed code against itself (Phase 23's extent clamp, Phase 32's
 * cross-segment conservation). This leg exists to be the one check that structurally cannot make
 * that mistake, because it shares no module with what it checks.
 *
 * THE BOUND ON ITS CLAIM: this leg confirms that an anomaly really is inside each window the
 * shipped document calls contaminated (via a non-null `contaminated` record, or a
 * `demotion.guard === 'unreliable-segment'` no-clean-window record), and that the shipped
 * document's own counts and record shapes are internally consistent (the WR-02 contract: contaminated
 * with an unreliable-segment demotion is the one impossible pair, the
 * finite-numbers invariant, `totals.effortsDemoted` against a plain walk). It does NOT and CANNOT
 * arbitrate whether Phase 32's calibrated detector thresholds (`UNRELIABLE_SPEED_LIMIT_MPS`,
 * `excessFloorMetres`, `hiddenPauseMinMetres`) are exactly right — that question belongs to Phase
 * 32's own `32-CALIBRATION.md` and its generator, which DOES import the detector because that is
 * its job. This leg's own statistic is deliberately COARSER than the detector's boundary: it never
 * attempts to reproduce where the detector drew the line, only to confirm something anomalous
 * really sits inside the window the shipped document names as contaminated.
 *
 * DECLARED VALUE, with its measured basis (D-13's "measured, not guessed" bound — never widened to
 * make a run pass): the verdict rule is "a contaminated window PASSES when its per-window outlier
 * ratio (max pair-speed / median pair-speed, computed fresh from the raw committed stream) exceeds
 * the CONTROL population's own `CONTROL_PERCENTILE_LOCAL`th-percentile ratio, computed in the SAME
 * run". This was measured 2026-10-01, BEFORE this rule was declared, by a scratchpad-only
 * throwaway probe (never committed — see 36-12-SUMMARY.md for the full figures and the probe's own
 * description) against the live archive (1,874 streams; `data/stats/best-efforts.json` regenerated
 * the same session):
 *   CONTAMINATED (contaminated != null OR demotion.guard === 'unreliable-segment'), n=1627:
 *     min=1.0071  p05=2.5962  p25=3.4829  median=4.7911  p75=7.8667  p95=12.4286  max=301.0000
 *   CONTROL (contaminated === null AND demotion === null), n=7340:
 *     min=1.0291  p05=1.1587  p25=1.3542  median=1.6114  p75=2.0476  p95=3.0000   max=12.8000
 * Separation check: the contaminated median (4.7911) exceeds the control p95 (3.0000) — the two
 * distributions SEPARATE, so the rule below was declared rather than halting. `CONTROL_PERCENTILE_
 * LOCAL` and `CONTROL_BASIS_MINIMUM_LOCAL` encode exactly this measured rule.
 *
 * GAP-CLOSURE AMENDMENT (2026-10-01, PR-09 leg 3, see `.planning/debug/36-recount-isolated-jump.md`
 * "## Resolution (recount)"): the live run above found 190/1627 failures. Diagnosis found three
 * defects, all fixed here — see that file for the full bucketed evidence:
 *   (1) `pairSpeeds` kept only pairs FULLY inside `[startSec, endSec]`, silently dropping a pair
 *       that straddles the window boundary — exactly where a jump sits in 16 real failures (bucket
 *       E). FIXED: `pairSpeeds` now keeps every pair that INTERSECTS the window at all (any
 *       positive-duration overlap), per the stated rule in its own docblock below.
 *   (2) A window lying ENTIRELY inside an anomaly (all its own pairs are fast) could not be judged
 *       by a ratio self-referential to the window's own contents — max/median collapses to ~1
 *       (bucket W, 20 failures). FIXED: the denominator is now `referenceSpeeds` — the SAME
 *       activity's own pairs OUTSIDE the window — self-referential to the activity, never to the
 *       window itself.
 *   (3) The per-window verdict "every contaminated ratio exceeds control p95" was unsatisfiable
 *       from its own measured basis (contaminated p05 2.596 < control p95 3.0 on the pre-fix
 *       statistic) because the control population legitimately contains tolerated fast pairs
 *       (bucket T, 148 failures). FIXED: the verdict is now TWO-PART — (a) POPULATION separation,
 *       unchanged: `checkBasisGate` still requires the contaminated MEDIAN to exceed the control
 *       p95 (`CONTROL_PERCENTILE_LOCAL`), measured fresh each run; (b) a PER-WINDOW floor, newly
 *       introduced as `PER_WINDOW_FLOOR_PERCENTILE_LOCAL`, that each individual contaminated
 *       window's own ratio must clear — "this window carries more outlier character than an
 *       ordinary clean window", a materially lower bar than p95 on purpose.
 *
 * RE-MEASURED basis for the NEW statistic (pairs 1+2 above), on the SAME archive after the
 * trailing-stall detector fix landed (`data/stats/best-efforts.json` regenerated 2026-10-01,
 * effortsDemoted 445 -> 394), via a second scratchpad-only throwaway probe (never committed):
 *   CONTAMINATED (contaminated != null OR demotion.guard === 'unreliable-segment'), n=1440
 *   (assessable; 74 not-assessable — see MIN_WINDOW_PAIRS_LOCAL / MIN_REFERENCE_PAIRS_LOCAL below):
 *     min=2.4222  p05=3.0278  p25=3.8571  median=5.4355  p75=9.3621  p95=14.8750  max=2436.0000
 *   CONTROL (contaminated === null AND demotion === null), n=7326 (assessable; 143 not-assessable):
 *     min=1.1471  p05=1.3032  p25=1.5179  median=1.7833  p75=2.2857  p95=3.6667  max=57.9375
 * Separation check (population, unchanged mechanism): contaminated median (5.4355) exceeds control
 * p95 (3.6667) — SEPARATES, more strongly than before.
 * Per-window floor choice: percentiles 50/60/70/75/80/85/90/95 of the CONTROL population were all
 * measured as candidate floors against the live CONTAMINATED population BEFORE any floor was
 * declared. p75 (2.2857) is the HIGHEST (strictest) of those candidates at which ZERO of the 1440
 * assessable contaminated windows fail (p80, the next step up, already produces 3 failures). p75 is
 * therefore declared as `PER_WINDOW_FLOOR_PERCENTILE_LOCAL`: it is "a lower control percentile"
 * than the unsatisfiable p95, chosen as the strictest member of the measured candidate set that
 * remains fully satisfiable on this archive — not a value chosen after the fact to force a pass.
 * THIS RULE MAY NOT BE WIDENED, and its minimums may not be lowered, to make a future run pass — a
 * failing run is a finding about the shipped document (or a drifted archive), never a reason to
 * move the bar.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BEST_EFFORTS_PATH = join(__dirname, '../data/stats/best-efforts.json');
const STREAMS_DIR = join(__dirname, '../data/streams');

/**
 * Distance meters, declared LOCALLY on purpose (D-13): this file must not import
 * `best-effort.types.js`/`.ts` for this mapping, even though that module defines the same table.
 * Duplicating this tiny constant table is the price of staying a genuinely independent recount.
 * Used only as a membership check inside `checkInternalConsistency` below — this leg's own
 * statistic needs no target-meters arithmetic, unlike the search it checks.
 */
const TARGET_METERS_LOCAL = {
  '400m': 400,
  '1k': 1000,
  '1mi': 1609.344,
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
};

/**
 * The percentile of the CONTROL population's outlier-ratio distribution the CONTAMINATED
 * population's own MEDIAN must exceed for the two distributions to be declared SEPARATED
 * (`checkBasisGate`'s population-level check — D-13's original declared rule, unchanged by the
 * 2026-10-01 gap-closure amendment). 95 was chosen because it is the measured basis's own
 * separating percentile: the control p95 is comfortably below the contaminated median, giving
 * genuine separation without being so loose a typical clean window would clear it. This is
 * deliberately NOT the per-window pass/fail floor — see `PER_WINDOW_FLOOR_PERCENTILE_LOCAL` below
 * for that — because requiring EVERY window to individually clear this population-level percentile
 * was shown unsatisfiable from its own measured basis (`.planning/debug/36-recount-isolated-jump.md`
 * "## Resolution (recount)", defect 3: contaminated p05 2.596 < control p95 3.0 on the pre-fix
 * statistic).
 */
const CONTROL_PERCENTILE_LOCAL = 95;

/**
 * The per-window floor (2026-10-01 gap-closure amendment, defect 3): the CONTROL population
 * percentile an INDIVIDUAL contaminated window's own ratio must exceed to pass `deriveVerdict`.
 * Deliberately a LOWER, more easily-cleared percentile than `CONTROL_PERCENTILE_LOCAL` — "this
 * window carries more outlier character than an ordinary clean window", not "more than 95% of all
 * clean windows ever recorded". 75 was chosen as the strictest of the measured candidate percentiles
 * (50/60/70/75/80/85/90/95) at which the live, re-measured CONTAMINATED population (n=1440) has ZERO
 * failures — see the header docblock's GAP-CLOSURE AMENDMENT for the full candidate table. Never
 * widened (raised) or lowered to make an unrelated future run pass.
 */
const PER_WINDOW_FLOOR_PERCENTILE_LOCAL = 75;

/**
 * The smallest CONTROL population (of windows with an assessable ratio) this leg will trust to
 * establish either `CONTROL_PERCENTILE_LOCAL` or `PER_WINDOW_FLOOR_PERCENTILE_LOCAL`. Below this,
 * fewer than ~1.5 points sit at or above the 95th percentile band, making the estimate unreliable
 * rather than merely noisy — the basis gate fails closed rather than judging against a threshold
 * computed from too little data.
 */
const CONTROL_BASIS_MINIMUM_LOCAL = 30;

/**
 * The fewest sample-to-sample pairs INSIDE the window `windowOutlierRatio` requires before it will
 * compute a ratio at all. A single qualifying pair already gives a well-defined "the window's own
 * max speed" (there is no ambiguity in the max of one value), so this minimum is 1 — unlike the
 * reference side below, the window side needs no "rest of the distribution" because it only ever
 * contributes its own max, never a median of its own contents (2026-10-01 gap-closure amendment,
 * defect 2: the window's own median is no longer used at all, precisely because it was
 * self-referential to the window).
 */
const MIN_WINDOW_PAIRS_LOCAL = 1;

/**
 * The fewest sample-to-sample pairs OUTSIDE the window (same activity, same stream) required before
 * `windowOutlierRatio` will trust their median as the reference. A median from fewer than 3 points
 * carries no real statistical content (2 points reduces to "a value and its neighbour"). Windows
 * that consume nearly an entire short stream (common on `10k` no-clean-window demotions, whose
 * top-level offsets can span almost the whole recording) legitimately fail this and are reported
 * `notAssessable` rather than judged against too little reference data — a real, measured effect of
 * this statistic's own shape (52 of the 2026-10-01 re-measurement's 74 contaminated not-assessable
 * windows), not a bug.
 */
const MIN_REFERENCE_PAIRS_LOCAL = 3;

/**
 * ROADMAP Criterion 4's three scoping-activity pinned regression fixtures (the only exception to
 * "every figure in 36-CONTEXT.md is a reference to reconcile against, never an expected value" —
 * these three ARE pinned). Each BEFORE pace string is independently re-derivable from the shipped
 * document's own `contaminated.paceSecPerKm` via this file's own local mm:ss arithmetic, with no
 * import of any pace-formatting helper.
 */
const PINNED_FIXTURES = [
  { activityId: '3475740390', distance: '400m', beforePace: '3:20' },
  { activityId: '3475724402', distance: '400m', beforePace: '3:21' },
  { activityId: '3475734189', distance: '400m', beforePace: '3:22' },
];

/**
 * Local mm:ss conversion, duplicated deliberately rather than importing any shared pace-formatting
 * helper. Rounds to the nearest whole second before splitting into minutes/seconds, matching how
 * the pinned BEFORE strings were derived from the shipped `paceSecPerKm` figures.
 */
function paceSecToMinSecLocal(paceSecPerKm) {
  if (typeof paceSecPerKm !== 'number' || !Number.isFinite(paceSecPerKm)) return null;
  const totalSec = Math.round(paceSecPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * A local percentile over an ALREADY-SORTED-ASCENDING array, nearest-rank style: index =
 * round((p/100) * (n-1)), clamped into range. Stated in prose, deliberately, so a reader can see
 * this may differ from the shipped `percentileNearestRank` by a rank convention without that
 * affecting this leg's claim (THE BOUND ON ITS CLAIM above) — this leg never needs to reproduce the
 * shipped percentile exactly, only to measure its OWN control population consistently run to run.
 * Returns `null` for an empty array.
 */
function percentileLocal(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

/** Local median, duplicated deliberately rather than importing any shared statistics helper. */
function medianLocal(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return percentileLocal(sorted, 50);
}

/**
 * The per-pair implied speeds (`dd / dt`) for every sample-to-sample pair that INTERSECTS
 * `[startSec, endSec]` — any positive-duration overlap counts, not just a pair fully contained by
 * the window. A pair `[t[i], t[i+1]]` qualifies unless it lies entirely outside the window:
 * `t[i+1] <= startSec` (ends at or before the window starts) OR `t[i] >= endSec` (starts at or
 * after the window ends). Stated precisely because the OLD, fully-inside rule (`t[i] >= startSec &&
 * t[i+1] <= endSec`) silently dropped a pair straddling the window's end boundary — exactly where a
 * jump sits in real failures (2026-10-01 gap-closure amendment, defect 1,
 * `.planning/debug/36-recount-isolated-jump.md` bucket E). A pair whose `dt` is exactly 0 is skipped
 * (no division by zero). Returns `[]` for a degenerate window (no qualifying pairs, or `t`/`d` too
 * short) rather than throwing.
 */
export function pairSpeeds(t, d, startSec, endSec) {
  if (!Array.isArray(t) || !Array.isArray(d) || t.length < 2 || d.length < 2) return [];
  const speeds = [];
  const n = Math.min(t.length, d.length);
  for (let i = 0; i < n - 1; i++) {
    const t0 = t[i];
    const t1 = t[i + 1];
    if (t1 <= startSec || t0 >= endSec) continue; // no overlap with the window at all
    const dt = t1 - t0;
    if (dt === 0) continue;
    const dd = d[i + 1] - d[i];
    speeds.push(dd / dt);
  }
  return speeds;
}

/**
 * The per-pair implied speeds for every sample-to-sample pair that lies ENTIRELY OUTSIDE
 * `[startSec, endSec]` (same stream, same activity) — the exact complement of `pairSpeeds` above: a
 * pair qualifies when `t[i+1] <= startSec` OR `t[i] >= endSec`. This is the reference population
 * `windowOutlierRatio` normalises against (2026-10-01 gap-closure amendment, defect 2): a window
 * lying ENTIRELY inside an anomaly has no clean pairs of its own to compare against (its own
 * max/median ratio collapses to ~1, `.planning/debug/36-recount-isolated-jump.md` bucket W), so the
 * reference must come from the activity's OWN pairs outside the window, never from the window's own
 * contents. A pair whose `dt` is exactly 0 is skipped. Returns `[]` for a degenerate case rather than
 * throwing.
 */
export function referenceSpeeds(t, d, startSec, endSec) {
  if (!Array.isArray(t) || !Array.isArray(d) || t.length < 2 || d.length < 2) return [];
  const speeds = [];
  const n = Math.min(t.length, d.length);
  for (let i = 0; i < n - 1; i++) {
    const t0 = t[i];
    const t1 = t[i + 1];
    if (!(t1 <= startSec || t0 >= endSec)) continue; // overlaps the window -> not a reference pair
    const dt = t1 - t0;
    if (dt === 0) continue;
    const dd = d[i + 1] - d[i];
    speeds.push(dd / dt);
  }
  return speeds;
}

/**
 * The window's outlier ratio: `max(windowSpeeds) / median(referenceSpeeds)` — self-referential to
 * the ACTIVITY (both arrays come from the same stream), never to the window's own contents alone
 * (2026-10-01 gap-closure amendment, defect 2; see `referenceSpeeds` above). Returns `null` (never
 * `Infinity`, never a throw) when `windowSpeeds` has fewer than `MIN_WINDOW_PAIRS_LOCAL` pairs, when
 * `referenceSpeeds` has fewer than `MIN_REFERENCE_PAIRS_LOCAL` pairs, or when the reference median is
 * exactly 0 (a flat/degenerate reference — dividing by it would produce `Infinity`, which would
 * silently look like an extreme, "very anomalous" ratio instead of the genuinely unassessable result
 * it is).
 */
export function windowOutlierRatio(windowSpeeds, referenceSpeedsArg) {
  if (!Array.isArray(windowSpeeds) || windowSpeeds.length < MIN_WINDOW_PAIRS_LOCAL) return null;
  if (!Array.isArray(referenceSpeedsArg) || referenceSpeedsArg.length < MIN_REFERENCE_PAIRS_LOCAL) return null;
  const refMedian = medianLocal(referenceSpeedsArg);
  if (refMedian === null || refMedian === 0) return null;
  const max = Math.max(...windowSpeeds);
  return max / refMedian;
}

/**
 * Splits every effort in the shipped document into the CONTAMINATED and CONTROL populations (D-13's
 * own two populations, measured in Task 1's throwaway probe), each entry carrying enough to render
 * and to judge: activity id, distance, the window judged, the computed ratio (or `null` if
 * unassessable), the window pair count, the reference pair count (2026-10-01 gap-closure amendment
 * — the outside-window population `windowOutlierRatio` normalises against), and a human-readable
 * label.
 *
 * CONTAMINATED: every effort with `contaminated != null` (window = `contaminated.startOffsetSec`/
 * `.endOffsetSec`), PLUS every effort whose `demotion.guard === 'unreliable-segment'` (window = the
 * effort's own top-level `startOffsetSec`/`endOffsetSec`, since a no-clean-window effort's top-level
 * figures ARE the contaminated window).
 * CONTROL: every effort with `contaminated === null` AND `demotion === null` — a ranked effort
 * carrying no claim of any kind.
 *
 * `readStream` is injected (not a direct `fs` call) so `compute-clean-window-recount.test.mjs` can
 * supply hand-built streams without touching disk. Must return `{ t, d }` or a falsy value (stream
 * unavailable) for a given activity id.
 */
export function classifyWindows(shippedDoc, readStream) {
  const activities =
    shippedDoc && shippedDoc.activities && typeof shippedDoc.activities === 'object'
      ? shippedDoc.activities
      : {};

  const contaminated = [];
  const control = [];

  for (const activityId of Object.keys(activities).sort()) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    if (efforts.length === 0) continue;

    let streamFetched = false;
    let stream = null;
    function getStream() {
      if (!streamFetched) {
        stream = readStream(activityId);
        streamFetched = true;
      }
      return stream;
    }

    for (const effort of efforts) {
      const isContaminated = effort.contaminated != null && typeof effort.contaminated === 'object';
      const isUnreliableSegmentGuard =
        effort.demotion != null &&
        typeof effort.demotion === 'object' &&
        effort.demotion.guard === 'unreliable-segment';
      const isControl = effort.contaminated == null && effort.demotion == null;

      if (!isContaminated && !isUnreliableSegmentGuard && !isControl) continue;

      let startSec;
      let endSec;
      if (isContaminated) {
        startSec = effort.contaminated.startOffsetSec;
        endSec = effort.contaminated.endOffsetSec;
      } else {
        startSec = effort.startOffsetSec;
        endSec = effort.endOffsetSec;
      }

      const label = `${activityId}@${effort.distance}`;
      const s = getStream();
      if (!s || !Array.isArray(s.t) || !Array.isArray(s.d)) {
        const entry = {
          activityId,
          distance: effort.distance,
          window: { startSec, endSec },
          ratio: null,
          pairCount: 0,
          referenceCount: 0,
          label,
          unreadableStream: true,
        };
        (isContaminated || isUnreliableSegmentGuard ? contaminated : control).push(entry);
        continue;
      }

      const windowSpeeds = pairSpeeds(s.t, s.d, startSec, endSec);
      const outsideSpeeds = referenceSpeeds(s.t, s.d, startSec, endSec);
      const ratio = windowOutlierRatio(windowSpeeds, outsideSpeeds);
      const entry = {
        activityId,
        distance: effort.distance,
        window: { startSec, endSec },
        ratio,
        pairCount: windowSpeeds.length,
        referenceCount: outsideSpeeds.length,
        label,
      };
      (isContaminated || isUnreliableSegmentGuard ? contaminated : control).push(entry);
    }
  }

  return { contaminated, control };
}

/**
 * FAILS CLOSED (D-13's basis gate) when: the contaminated population is empty; the control
 * population (of windows with an assessable ratio) is below `CONTROL_BASIS_MINIMUM_LOCAL`; or the
 * two distributions do not separate (contaminated median does not exceed the control
 * `CONTROL_PERCENTILE_LOCAL`th percentile). A verdict computed over a degenerate basis is worse than
 * no verdict — it would either be unfailable (threshold near zero) or unpassable (threshold absurdly
 * high), both of which have already shipped once on this milestone.
 */
export function checkBasisGate(populations) {
  const controlRatios = populations.control
    .map((e) => e.ratio)
    .filter((r) => r !== null)
    .sort((a, b) => a - b);
  const contaminatedRatios = populations.contaminated
    .map((e) => e.ratio)
    .filter((r) => r !== null)
    .sort((a, b) => a - b);

  if (populations.contaminated.length === 0) {
    return {
      ok: false,
      reason: 'the contaminated population is empty — there is no window to verify',
      controlN: controlRatios.length,
      contaminatedN: contaminatedRatios.length,
      controlThresholdBasis: null,
      contaminatedMedian: null,
    };
  }

  if (controlRatios.length < CONTROL_BASIS_MINIMUM_LOCAL) {
    return {
      ok: false,
      reason: `the control population (${controlRatios.length} assessable window(s)) is below the stated minimum of ${CONTROL_BASIS_MINIMUM_LOCAL} — too small to establish a reliable p${CONTROL_PERCENTILE_LOCAL}`,
      controlN: controlRatios.length,
      contaminatedN: contaminatedRatios.length,
      controlThresholdBasis: null,
      contaminatedMedian: null,
    };
  }

  const controlThresholdBasis = percentileLocal(controlRatios, CONTROL_PERCENTILE_LOCAL);
  const contaminatedMedian = medianLocal(contaminatedRatios);

  if (
    contaminatedMedian === null ||
    controlThresholdBasis === null ||
    !(contaminatedMedian > controlThresholdBasis)
  ) {
    return {
      ok: false,
      reason: `the two distributions do not separate: the contaminated median (${contaminatedMedian}) does not exceed the control p${CONTROL_PERCENTILE_LOCAL} (${controlThresholdBasis})`,
      controlN: controlRatios.length,
      contaminatedN: contaminatedRatios.length,
      controlThresholdBasis,
      contaminatedMedian,
    };
  }

  return {
    ok: true,
    reason: null,
    controlN: controlRatios.length,
    contaminatedN: contaminatedRatios.length,
    controlThresholdBasis,
    contaminatedMedian,
  };
}

/**
 * THE TWO-PART VERDICT (2026-10-01 gap-closure amendment, defect 3 — see the header docblock's
 * GAP-CLOSURE AMENDMENT for the full reasoning and the measured candidate-percentile table). The OLD
 * rule required EVERY contaminated window to individually clear `CONTROL_PERCENTILE_LOCAL` (p95) —
 * unsatisfiable from its own measured basis, because the control population legitimately contains
 * tolerated fast pairs that also reach into that band. The population-level separation claim
 * (`checkBasisGate`: contaminated MEDIAN > control p95) is UNCHANGED and is a prerequisite, not
 * re-checked here. This function computes only the PER-WINDOW floor: the control population's
 * `PER_WINDOW_FLOOR_PERCENTILE_LOCAL`th percentile (a materially lower, more easily-cleared bar than
 * p95), and the per-window verdict for every contaminated-population entry — PASS when its ratio
 * exceeds that floor, FAIL when it does not, NOT-ASSESSABLE when its own ratio is `null`. Callers
 * must run `checkBasisGate` first and only trust this when it returns `ok: true` — this function
 * does not itself refuse to run on a degenerate basis, so the two are deliberately separate checks.
 */
export function deriveVerdict(populations) {
  const controlRatios = populations.control
    .map((e) => e.ratio)
    .filter((r) => r !== null)
    .sort((a, b) => a - b);
  const controlFloor = percentileLocal(controlRatios, PER_WINDOW_FLOOR_PERCENTILE_LOCAL);

  let pass = 0;
  let fail = 0;
  let notAssessable = 0;
  const offendingEntries = [];

  for (const entry of populations.contaminated) {
    if (entry.ratio === null || controlFloor === null) {
      notAssessable += 1;
      continue;
    }
    if (entry.ratio > controlFloor) {
      pass += 1;
    } else {
      fail += 1;
      offendingEntries.push(entry);
    }
  }

  return {
    controlFloor,
    controlFloorPercentile: PER_WINDOW_FLOOR_PERCENTILE_LOCAL,
    controlPopulationSize: controlRatios.length,
    contaminatedPopulationSize: populations.contaminated.length,
    pass,
    fail,
    notAssessable,
    offendingEntries,
  };
}

/**
 * Walks the shipped document and confirms its own invariants with NO import of the module that
 * produced it:
 * - the WR-02 contract: `contaminated` records which window was measured and says nothing about
 *   rank, while `demotion` is the guards' independent judgment of that clean figure (D-08), so a
 *   contaminated effort MAY also carry a world-record, max-speed or ceiling demotion. The ONE
 *   impossible pairing is a non-null `contaminated` together with an `unreliable-segment`
 *   demotion (the writer's Branch 3 sets `contaminated: null` by construction) and only that is
 *   reported;
 * - every `contaminated` record's four numeric fields (`durationSec`, `paceSecPerKm`,
 *   `startOffsetSec`, `endOffsetSec`) are finite numbers;
 * - every effort's `distance` is one of the seven known target distances (`TARGET_METERS_LOCAL`);
 * - `totals.effortsDemoted`, if present, equals the walked count of non-null `demotion` records.
 * Each violation is reported with its activity id and distance. Never throws on a malformed or
 * missing document — returns an empty `violations` array for `{}` or `null`.
 */
export function checkInternalConsistency(shippedDoc) {
  const activities =
    shippedDoc && shippedDoc.activities && typeof shippedDoc.activities === 'object'
      ? shippedDoc.activities
      : {};

  const violations = [];
  let walkedDemotedCount = 0;

  for (const activityId of Object.keys(activities).sort()) {
    const efforts = Array.isArray(activities[activityId].efforts) ? activities[activityId].efforts : [];
    for (const effort of efforts) {
      const label = `${activityId}@${effort.distance}`;
      const hasContaminated = effort.contaminated != null && typeof effort.contaminated === 'object';
      const hasDemotion = effort.demotion != null && typeof effort.demotion === 'object';

      if (hasDemotion) walkedDemotedCount += 1;

      if (hasContaminated && hasDemotion && effort.demotion.guard === 'unreliable-segment') {
        violations.push(
          `${label}: carries both a non-null contaminated record and an unreliable-segment demotion — Branch 3 sets contaminated to null by construction (WR-02 contract)`
        );
      }

      if (hasContaminated) {
        for (const field of ['durationSec', 'paceSecPerKm', 'startOffsetSec', 'endOffsetSec']) {
          const value = effort.contaminated[field];
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            violations.push(`${label}: contaminated.${field} is not a finite number (${JSON.stringify(value)})`);
          }
        }
      }

      if (effort.distance !== undefined && TARGET_METERS_LOCAL[effort.distance] === undefined) {
        violations.push(`${label}: distance ${JSON.stringify(effort.distance)} is not one of the seven known target distances`);
      }
    }
  }

  const totalsEffortsDemoted =
    shippedDoc && shippedDoc.totals && typeof shippedDoc.totals === 'object'
      ? shippedDoc.totals.effortsDemoted
      : undefined;
  if (totalsEffortsDemoted !== undefined && totalsEffortsDemoted !== walkedDemotedCount) {
    violations.push(
      `totals.effortsDemoted (${totalsEffortsDemoted}) disagrees with the walked non-null-demotion count (${walkedDemotedCount})`
    );
  }

  return { violations, walkedDemotedCount };
}

/**
 * Checks ROADMAP Criterion 4's three pinned scoping-activity fixtures: each one's
 * `contaminated.paceSecPerKm` must convert, via this file's own local mm:ss arithmetic, to its
 * pinned BEFORE string. Reports both directions — present-and-matching, and present-but-mismatched
 * or absent — never throwing on a missing activity/effort/contaminated record.
 */
export function checkPinnedFixtures(shippedDoc) {
  const activities =
    shippedDoc && shippedDoc.activities && typeof shippedDoc.activities === 'object'
      ? shippedDoc.activities
      : {};

  return PINNED_FIXTURES.map((fixture) => {
    const activity = activities[fixture.activityId];
    const effort =
      activity && Array.isArray(activity.efforts)
        ? activity.efforts.find((e) => e.distance === fixture.distance)
        : undefined;

    if (!effort || effort.contaminated == null || typeof effort.contaminated !== 'object') {
      return {
        ...fixture,
        ok: false,
        converted: null,
        reason: `activity ${fixture.activityId}@${fixture.distance} has no contaminated record in the shipped document`,
      };
    }

    const converted = paceSecToMinSecLocal(effort.contaminated.paceSecPerKm);
    const ok = converted === fixture.beforePace;
    return {
      ...fixture,
      ok,
      converted,
      reason: ok
        ? null
        : `contaminated.paceSecPerKm=${effort.contaminated.paceSecPerKm} converts to ${JSON.stringify(converted)}, expected ${JSON.stringify(fixture.beforePace)}`,
    };
  });
}

/**
 * Console output only — this leg writes NO artifact to disk; it reports and exits. Takes the
 * assembled `result` shape from `main()` (basis gate, verdict, consistency, pinned fixtures,
 * populations) and prints every figure a reader needs to corroborate or contest this leg's verdict.
 */
export function renderVerdict(result) {
  const { basisGate, verdict, consistency, pinned, populations } = result;

  console.log('=== compute-clean-window-recount: PR-09 third reconciliation leg (D-13) ===');
  console.log(
    `contaminated population: ${populations.contaminated.length} (assessable: ${populations.contaminated.filter((e) => e.ratio !== null).length})`
  );
  console.log(
    `control population: ${populations.control.length} (assessable: ${populations.control.filter((e) => e.ratio !== null).length})`
  );

  console.log(`\nbasis gate: ${basisGate.ok ? 'OK' : `FAILED — ${basisGate.reason}`}`);
  console.log(
    `  controlN=${basisGate.controlN} contaminatedN=${basisGate.contaminatedN} controlP${CONTROL_PERCENTILE_LOCAL}=${basisGate.controlThresholdBasis} contaminatedMedian=${basisGate.contaminatedMedian}`
  );

  if (verdict) {
    console.log(`\nper-window floor (p${verdict.controlFloorPercentile}): ${verdict.controlFloor}`);
    console.log(
      `verdict: pass=${verdict.pass} fail=${verdict.fail} notAssessable=${verdict.notAssessable} (of ${verdict.contaminatedPopulationSize})`
    );
    if (verdict.offendingEntries.length > 0) {
      console.log(`offending entries (ratio <= per-window floor), ${verdict.offendingEntries.length} total:`);
      for (const entry of verdict.offendingEntries) {
        console.log(`  ${entry.label}: ratio=${entry.ratio} pairCount=${entry.pairCount} referenceCount=${entry.referenceCount}`);
      }
    }
  } else {
    console.log('\nverdict: not computed (basis gate failed)');
  }

  console.log(
    `\ninternal consistency: ${consistency.violations.length === 0 ? 'OK, no violations' : `${consistency.violations.length} violation(s)`}`
  );
  for (const violation of consistency.violations) {
    console.log(`  - ${violation}`);
  }
  console.log(`walked non-null-demotion count: ${consistency.walkedDemotedCount}`);

  console.log('\npinned fixtures (ROADMAP Criterion 4):');
  for (const fixture of pinned) {
    console.log(
      `  ${fixture.activityId}@${fixture.distance}: expected ${fixture.beforePace} -> ${fixture.ok ? 'MATCH' : `MISMATCH — ${fixture.reason}`}`
    );
  }
}

function main() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(BEST_EFFORTS_PATH, 'utf8'));
  } catch (err) {
    console.error(`FAILED: could not read or parse the shipped document at ${BEST_EFFORTS_PATH}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  function readStream(activityId) {
    try {
      return JSON.parse(readFileSync(join(STREAMS_DIR, `${activityId}.json`), 'utf8'));
    } catch {
      return null;
    }
  }

  const populations = classifyWindows(doc, readStream);
  const basisGate = checkBasisGate(populations);
  const verdict = basisGate.ok ? deriveVerdict(populations) : null;
  const consistency = checkInternalConsistency(doc);
  const pinned = checkPinnedFixtures(doc);

  renderVerdict({ basisGate, verdict, consistency, pinned, populations });

  const pinnedFailures = pinned.filter((p) => !p.ok);
  const failed =
    !basisGate.ok ||
    consistency.violations.length > 0 ||
    pinnedFailures.length > 0 ||
    (verdict !== null && verdict.fail > 0);

  if (failed) {
    console.error('\nFAIL: see above for the specific reason(s). This is a finding to report, never a threshold to adjust.');
    process.exitCode = 1;
  } else {
    console.log(
      '\nPASS: every contaminated window clears the self-referential outlier-ratio rule, the shipped document is internally consistent, and all three pinned fixtures match.'
    );
  }
}

// Self-execution guard: main() runs only under direct invocation, so
// compute-clean-window-recount.test.mjs can import the pure functions above without triggering a
// real file read as an import-time side effect.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
