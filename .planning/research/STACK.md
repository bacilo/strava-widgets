# Stack Research: Pace Data-Quality Algorithms (v2.2)

**Domain:** Statistical/signal-processing techniques for gap-aware pace derivation, outlier detection, personal-percentile plausibility ceilings, and data-quality scoring — applied to already-committed, irregularly-sampled `(t, d)` running streams (≤3,000 samples/activity, 1,864 activities).
**Researched:** 2026-09-08
**Confidence:** HIGH — every recommendation below is grounded in the existing codebase's own patterns (`best-effort-utils.ts`, `detail-charts-logic.ts`, `detail-zones.ts`) plus verified npm registry/bundlephobia data for the two libraries seriously considered and rejected.

## Verdict, up front

**No new dependency is warranted for any of (a)–(d).** Every technique this milestone needs is a 15–40 line pure function over an array of at most a few thousand floats, run either once per activity (Node, CI time) or once per chart render (browser, ≤3,000 points). This is squarely inside the size/complexity envelope the project has hand-rolled repeatedly (`findBestEffort`'s two-pointer sweep, `derivePaceSeries`'s Δt-weighted window, `computePaceDistribution`'s segment walk, `parseAthleteConfig`'s total-validation gate). Two libraries were seriously evaluated and rejected — see "What NOT to Use" for the specific reasoning per library, not a blanket "prefer fewer deps."

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Plain TypeScript, no runtime dep | current (5.9.3, already installed) | All four algorithm categories | Every technique needed (gap-aware weighted averaging, rolling-window median/MAD, linear-interpolation quantile, weighted composite scoring) is textbook, well-documented, and small enough that hand-rolling costs less than researching/vetting/pinning a dependency, matches the codebase's existing module style (pure, DOM-free, exhaustively unit-tested), and keeps the IIFE widget bundles and the CI compute step at their current zero-runtime-dependency footprint for this concern. |

### Supporting Libraries

**None.** See per-question breakdown below for the algorithm sketch that replaces each library that might otherwise be reached for.

### Development Tools

No new dev tooling needed — `vitest` (already installed, `^4.0.18`) is sufficient for the property-style tests these functions need (e.g. "known outlier gets flagged", "quantile of a sorted array of 100 known values returns the textbook expected value", "MAD of a constant array is 0 and the filter doesn't divide by zero").

## Installation

```bash
# No installation required for this milestone's algorithmic core.
```

---

## (a) Robust smoothing/derivation of pace from a noisy, irregularly-sampled cumulative-distance series

**Verdict: hand-roll, and mostly already exists.** `derivePaceSeries` in `src/dashboard/views/detail-charts-logic.ts:97` already does the right thing for a *smoothed display* series: for each sample it takes the real elapsed-time window (`±windowSec/2`, clamped to stream extent), sums real distance and real elapsed time inside that window via `interpValueAtTime`'s binary-search interpolation, and divides — never assuming a fixed sample rate. This is a Δt-weighted moving average over an irregular grid, which is the correct primitive here (a plain windowed average over *sample index* rather than *elapsed time*, which is what naive rolling-average libraries assume, would silently misweight time exactly the way `RESEARCH.md Pitfall 1` warns about).

What v2.2 actually adds to this primitive is **gap-awareness**, not a new smoothing algorithm:
- A recording gap (>10s, per the milestone's own finding of 1,233 affected activities) or a pause gap (≥30s, 321 activities with >5min cumulative) inside a smoothing window should not be silently bridged — the window should stop at the gap boundary rather than averaging across it and manufacturing a pace value that spans a period with no real samples.
- Concretely: before computing `elapsed`/`metres` in the existing window-sum, walk the segments inside `[windowStart, windowEnd]` and check whether any consecutive-sample `Δt` exceeds the gap threshold; if so, clip the window to the gap boundary (or return `null` for that sample if the gap consumes the whole window). This is an `if` statement added to an existing loop, not a new mathematical technique.

`computePaceDistribution` in `src/dashboard/views/detail-zones.ts:61` is the one that needs to change algorithmically, not just gap-awarely: today it computes raw per-*segment* `dt / (dd/1000)` at native sample spacing (no windowing at all), which is exactly what produces the aliased phantom-fast-mode buckets the milestone's own investigation documents. The fix is to route the histogram through the *same* gap-aware, Δt-weighted derivation `detail-charts-logic.ts` already uses (or a shared extraction of it), rather than maintaining two divergent pace formulas — this is the milestone's stated FR-01.

No smoothing library (no exponential moving average package, no `ml-*` filtering library) is warranted: the window-sum-of-real-Δt/real-Δd approach already correctly handles irregular sampling, and it is 25 lines that are already written, tested, and battle-tested against this exact archive.

## (b) Outlier/spike detection on the time-series

**Verdict: Hampel filter (rolling median + MAD) is the right tool for the *impossible-sample* / stair-step-ratio signals — and it is a ~30-line hand-roll, not a library.** Savitzky-Golay and Kalman filtering are both overkill and, in one case, actively wrong for this data shape.

**Warranted — rolling median + MAD (Hampel-style), hand-rolled:**
The Hampel identifier is the standard robust-statistics technique for exactly this problem: flag a sample as an outlier when it deviates from its local **median** by more than `k × MAD` (median absolute deviation), where MAD is scaled by `1.4826` to be comparable to a standard deviation under normality. Using the median rather than the mean, and MAD rather than variance, is what makes the test robust — a single 17 m/s device glitch (the milestone's Suunto example) does not itself corrupt the threshold that would flag it, unlike a mean/stdev-based z-score. At `MAX_SAMPLES = 3000` per activity and a small window (a handful of samples wide, since these are per-activity impossible-*sample* checks, not multi-day series), a naive `O(n · w log w)` implementation (sort each window, take the middle element) runs in microseconds — no need for the `O(n log w)` sliding-window-median data structures (e.g. two-heap or order-statistics tree) that only matter at signal-processing scale (millions of samples, real-time constraints), neither of which applies here.

```typescript
// Sketch — ~30 lines, no imports beyond stream types.
function rollingMedian(values: number[], i: number, halfWindow: number): number {
  const lo = Math.max(0, i - halfWindow);
  const hi = Math.min(values.length, i + halfWindow + 1);
  const window = values.slice(lo, hi).sort((a, b) => a - b);
  const mid = Math.floor(window.length / 2);
  return window.length % 2 === 0 ? (window[mid - 1] + window[mid]) / 2 : window[mid];
}

const MAD_SCALE = 1.4826; // scales MAD to be comparable to stdev under normality

function hampelFlags(values: number[], halfWindow = 3, k = 3): boolean[] {
  return values.map((v, i) => {
    const med = rollingMedian(values, i, halfWindow);
    const deviations = values
      .slice(Math.max(0, i - halfWindow), Math.min(values.length, i + halfWindow + 1))
      .map((x) => Math.abs(x - med));
    const mad = rollingMedian(deviations, Math.floor(deviations.length / 2), deviations.length) * MAD_SCALE;
    return mad > 0 && Math.abs(v - med) > k * mad;
  });
}
```

This slots naturally alongside the existing `isPlausible` pattern in `best-effort-utils.ts` (which already does threshold-based implausibility checking against `activityMaxSpeedMps` and `WORLD_RECORD_SPEED_MPS`) — Hampel is a *local*, per-sample-neighborhood check, complementary to those two *global* per-activity/per-world ceilings, not a replacement for either.

**Not warranted — Savitzky-Golay:** S-G fits a local polynomial by least squares across a *fixed-width, evenly-spaced* window and is designed to smooth (and optionally differentiate) signals sampled on a uniform grid. This project's streams are explicitly, repeatedly, and by design **not** uniformly sampled (`detail-charts-logic.ts`'s own file header: "Committed streams are NOT uniformly sampled... pace smoothing and hover-time-to-distance conversion always weight by real Δt... never assume a fixed sample rate"). Using S-G here means either (1) resampling to a uniform grid first — itself a lossy, error-introducing step that undermines the very Δt-weighting discipline the codebase has built around, or (2) using an irregular-grid S-G variant, which is a research-paper technique, not a shelf-stable library, and is disproportionate machinery for detecting a few hundred impossible samples. Skip it.

**Not warranted — Kalman filtering:** Kalman filters solve *state estimation under a process model plus measurement noise* — they're built for real-time sensor fusion (e.g., GPS + accelerometer position tracking) where you need a running best-estimate of a hidden state as data streams in. This milestone has neither a state to estimate (pace isn't a hidden variable with dynamics; it's `Δd/Δt`, directly computable) nor a streaming/real-time constraint (all data is already committed and batch-processed). Standing up a Kalman filter means choosing a process-noise model, a measurement-noise model, and tuning both — genuine complexity with no corresponding benefit over "compute the Δt-weighted window average and flag deviations with Hampel," which needs no tuning beyond a window width and a `k`-sigma multiplier. Explicitly out.

## (c) Percentile/quantile estimation over a personal history for a "personal plausibility ceiling"

**Verdict: hand-roll a linear-interpolation quantile function (~15–20 lines), same method as `numpy`'s default, Excel's `PERCENTILE.INC`, and D3's `quantile` (all "R-7" in Hyndman & Fan's taxonomy).** This directly parallels `WORLD_RECORD_SPEED_MPS` in `best-effort-utils.ts`: instead of (or in addition to) a fixed world-record ceiling per `TargetDistanceKey`, compute e.g. the 99th percentile of that athlete's own historical best-effort speeds for the same distance, and use it as a tighter, personal, demonstrated-ability-based ceiling — exactly the milestone's stated goal ("a ceiling derived from demonstrated personal ability rather than the world record").

```typescript
// Sketch — ~15 lines. Same "R-7" method as numpy/Excel/D3's quantile().
function quantile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return NaN;
  if (sortedValues.length === 1) return sortedValues[0];
  const rank = p * (sortedValues.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedValues[lo];
  const frac = rank - lo;
  return sortedValues[lo] + frac * (sortedValues[hi] - sortedValues[lo]);
}
```

Fed by sorting each `TargetDistanceKey`'s array of historical implied speeds once (a one-time CI-time computation over ≤1,864 activities × 7 distances — trivially fast, no streaming/incremental structure needed), this composes cleanly with the existing `rankTopN`/`markPRs` chronological-sort patterns already in `best-effort-utils.ts`. The interpolation-method choice (R-7 linear vs. the seven other Hyndman–Fan variants) is a one-line decision the project should own and unit-test directly (e.g. "quantile of `[1,2,3,4,5]` at p=0.5 is 3, at p=0.9 is 4.6") rather than delegate to a dependency, exactly as it already owns `MAX_SPEED_MARGIN = 1.02` and the `WORLD_RECORD_SPEED_MPS` table's editorial choices (ratified-vs-pending marathon record, etc.) as commented, reviewable constants.

## (d) Data-quality scoring composition

**Verdict: hand-roll, and there is no meaningful library for this regardless of project constraints.** Composing per-activity signals (gap coverage %, stair-step/decimation ratio, impossible-sample count from (b), elapsed-vs-moving divergence, device era) into a quality badge is domain-specific weighted-scoring business logic, not a generic algorithm with an ecosystem around it — nobody ships an npm package for "how should *this* app's pace-quality badge be computed," because the weighting and thresholds are inherently product decisions (same category as `MAX_SPEED_MARGIN` or the 15/30-second gap thresholds this milestone itself defines).

Follow the codebase's existing convention of returning a **typed, multi-field result** rather than a single opaque number — the same shape as `PlausibilityResult` (`{ok, reason}`), `ZoneTime` (`{zone, timeSec, percent, ...}`), and `PaceBucket` (`{minSecPerKm, maxSecPerKm, label, timeSec}`). A quality result should expose the individual signals (`gapCoveragePercent`, `stairStepRatio`, `impossibleSampleCount`, `elapsedMovingDivergenceSec`, `deviceEra`) alongside any composite badge/tier, so the UI (and future debugging) can show *why* an activity was flagged rather than a single unexplained score — consistent with `isPlausible`'s pattern of returning a human-readable `reason` string, not just `false`.

```typescript
// Sketch — shape, not implementation. Each field computed by its own small,
// independently-testable function (gap coverage from the same gap-threshold
// walk as (a); stair-step ratio by counting repeated Δd values typical of
// MAX_SAMPLES decimation; impossible-sample count from (b)'s hampelFlags
// combined with the existing isPlausible ceiling).
interface StreamQualitySignals {
  gapCoveragePercent: number;
  stairStepRatio: number;
  impossibleSampleCount: number;
  elapsedMovingDivergenceSec: number;
  deviceEra: 'modern' | 'legacy' | 'unknown';
}
```

No dependency choice applies here at all — this is pure composition of the outputs of (a)–(c).

---

## Integration Points

| File | Change this milestone needs | Why here |
|------|------------------------------|----------|
| `src/dashboard/views/detail-charts-logic.ts` | Extend `derivePaceSeries` with gap-boundary clipping (recording-gap/pause-gap thresholds from FR context) inside its existing windowed-sum loop; no new exported shape, `PACE_SMOOTHING_WINDOW_SEC` stays. | Already has the correct Δt-weighted primitive (`interpValueAtTime` + real-window-sum); only needs to stop bridging gaps. |
| `src/dashboard/views/detail-zones.ts` | Replace `computePaceDistribution`'s raw per-segment `dt/(dd/1000)` with the same gap-aware, windowed derivation as `detail-charts-logic.ts` — likely via a shared extraction into one module both import, so the "two divergent formulas" the milestone opens against cannot recur. | This is the file whose current per-sample math the milestone's own worked example (activity 4556693525) shows manufacturing phantom 2:45/8:15/72:00 buckets. |
| `src/analytics/best-effort-utils.ts` | Add a personal-ceiling quantile function and a Hampel-based per-sample plausibility check, composed alongside (not replacing) `isPlausible`'s existing `activityMaxSpeedMps`/`WORLD_RECORD_SPEED_MPS` two-tier guard. Keep the "pure, no I/O" module contract stated in the file header — the quantile input (sorted historical speeds) is computed and passed in by the CI caller, not fetched here. | File already owns exactly this class of plausibility logic and its own reviewable constants; a personal ceiling is a third, tighter tier on the same guard, not a new module. |
| `src/streams/stream.types.ts` | **No change.** Quality signals are derived output, not stream input — they belong in a new computed artifact (e.g. `data/stats/stream-quality.json`), generated at CI time the same way `data/stats/best-efforts.json` already is, and never touch `data/streams/`. | Matches the milestone's explicit non-goal: `data/streams/` stays byte-identical; `STREAM_SCHEMA_VERSION` is locked and any change means re-deriving ~1,850 committed files. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `simple-statistics` (npm, current `7.12.0`, ~27KB min / ~10.2KB gzip as a whole package per Bundlephobia) | Ships as one bundled `dist/simple-statistics.mjs` file rather than per-function ESM modules, so pulling in `median`/`medianAbsoluteDeviation`/`quantile` doesn't tree-shake as cleanly as the raw numbers suggest, and it brings ~100 statistical functions this project needs none of. The 3–4 functions actually needed here are each under 20 lines, already match this codebase's typed/documented/unit-tested house style, and the interpolation-method and MAD-scaling choices are exactly the kind of reviewable constant this project already owns directly (`MAX_SPEED_MARGIN`, `WORLD_RECORD_SPEED_MPS`). | Hand-rolled `quantile()` and `hampelFlags()` per the sketches above. |
| `d3-array` (npm, current `3.2.4`, whole-package ~17KB min / ~5.9KB gzip per Bundlephobia; genuinely per-function ESM and properly tree-shakeable — importing only `quantile`/`quantileSorted` would pull well under 1KB in practice) | Technically the best-behaved candidate of the two (real per-file ESM, so it *would* tree-shake in Vite's IIFE build) — rejected anyway because `quantile`/`quantileSorted` is a 10-line function this project would still need to wrap, test, and document to its own conventions, and adding a runtime dependency for a function shorter than the wrapper around it doesn't pay for itself. Revisit only if this milestone's scope grows to need many more D3-array-style array primitives (e.g. `bisector`, `group`, `rollup`) across several modules — a single quantile call doesn't clear that bar. | Hand-rolled `quantile()` per the sketch above. |
| Any Kalman-filter package (e.g. `kalman-filter`, `ml-*` state-space libraries) | Solves a different problem (streaming state estimation under a process/measurement noise model) than this milestone has (batch outlier flagging on already-committed arrays). Requires modeling decisions (process noise, measurement noise) with no benefit over Hampel here. | Hampel filter (rolling median + MAD), hand-rolled. |
| Any Savitzky-Golay package (e.g. `ml-savitzky-golay`) | Assumes a uniform sampling grid; this project's streams are explicitly irregular by design and the whole codebase is built around Δt-weighting to avoid exactly the aliasing S-G would need a resample step to avoid re-introducing. | The existing Δt-weighted windowed-average primitive in `derivePaceSeries`. |
| `ml-matrix` or any linear-algebra library | Only relevant as a Kalman-filter dependency; not needed once Kalman is out of scope. | N/A |
| Any sliding-window-median data structure package (two-heap/order-statistics-tree implementations, e.g. for O(n log w) rolling median at scale) | Built for millions-of-samples/real-time constraints. This project's ceiling is 3,000 samples/activity, batch-processed; a naive sort-per-window is microseconds. | Naive `slice().sort()` per window, per the `rollingMedian` sketch above. |

## Version Compatibility

Not applicable — no new package versions are being introduced. The existing toolchain (`typescript@^5.9.3`, `vitest@^4.0.18`, Node 22, Vite `^7.3.1` for the IIFE/browser build) already supports everything above with zero configuration changes: these are plain functions over `number[]`, importable identically from a CI-time Node script and from a browser IIFE bundle.

## Sources

- `src/analytics/best-effort-utils.ts`, `src/dashboard/views/detail-charts-logic.ts`, `src/dashboard/views/detail-zones.ts`, `src/streams/stream.types.ts` — read directly; existing patterns for plausibility guards, Δt-weighted derivation, and pure-typed-result modules drove every recommendation above. HIGH confidence (primary source).
- `.planning/PROJECT.md` — milestone goal, non-goals, and the "zero dependencies" decision history (Native fetch, Native Custom Elements, offline geocoding, Leaflet externalized to keep bundles <50KB) that this research follows. HIGH confidence (primary source).
- npm registry (`npm view <pkg> version`, checked live) — confirmed current versions: `simple-statistics@7.12.0`, `d3-array@3.2.4`, `ml-matrix@6.15.0`; confirmed no npm package named `hampel` exists (registry lookup returned nothing), i.e. Hampel filtering has no shelf-stable JS library at all, reinforcing the hand-roll verdict. HIGH confidence.
- Bundlephobia (`bundlephobia.com/api/size`, fetched live) — `d3-array@3.2.4`: 16,992B min / 5,923B gzip (whole package; tree-shaken single-function import is smaller in a real bundler). `simple-statistics@7.12.0`: 27,264B min / 10,174B gzip. MEDIUM confidence (third-party size-analysis service, not an official source, but numbers are directly measured rather than estimated).
- WebSearch — Hampel filter / rolling-median-MAD algorithm description (SAS blog, Towards Data Science, Medium) cross-checked against each other and against the standard statistics literature description (median + `1.4826 × MAD`, k-sigma threshold); the algorithm itself is textbook and multiply-sourced. MEDIUM confidence on exposition sources, but the underlying technique is standard enough to treat as HIGH confidence on the math.

---
*Stack research for: pace data-quality algorithms, v2.2 Pace Data Quality milestone*
*Researched: 2026-09-08*
