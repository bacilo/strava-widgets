# Phase 26 Cross-Plan Integration Repair

Dispatched by the execute-phase orchestrator between waves. Not a GSD plan —
no `PLAN.md` exists for this work. This document is the record of the
repair, per the orchestrator's instruction.

## The Defect

`paceHistogramSamples` in `src/analytics/pace-derivation.ts` builds the
Δt-weighted `{ paceSecPerKm, timeSec }` samples every pace histogram/residual
consumer reads. Before this fix, it weighted sample `i` by
`dt = t[i+1] - t[i]` and skipped only when `paceSeries[i]` was `null`.

`derivePaceSeriesGapAware` deliberately leaves the LAST sample before a gap
non-null — a shrunk-but-valid trailing window, so the chart line stays
continuous right up to the gap edge instead of showing a dropout. But that
sample's own FORWARD segment `[t[i], t[i+1]]` *is* the gap itself
(`classifyGaps` classifies it `recording-gap` or `pause`, never `covered`).
Because the pre-gap sample's pace value is non-null, the old
`dt <= 0 || pace === null` skip never caught it — the gap's entire duration
got weighted into the histogram at the pre-gap sample's pace, a silent
re-inclusion of time `classifyGaps` had already excluded.

## How It Escaped Both Plans' Self-Checks

Two plans in Phase 26 touched this function's consumers, and each had a
locally-true, globally-false picture:

- **Plan 26-04** (`detail-zones.ts`, chart/histogram consumer) discovered
  the defect while pinning the exact bucket-sum-equals-`coveredSec` identity
  in its own tests. It could not fix `paceHistogramSamples` itself because,
  at that point in the wave schedule, `pace-derivation.ts` was owned by a
  concurrently-executing sibling plan (26-07) — editing a file another
  in-flight plan owns risks a merge collision the orchestrator's worktree
  model is designed to avoid. Plan 26-04's own self-check correctly verified
  its LOCAL mask (`maskedPaceSeries` in `detail-zones.ts`) restored the
  identity for its own call site — that check passed, honestly, because it
  never looked outside `detail-zones.ts`.
- **Plan 26-09** (`compute-pace-residual.mjs`, the residual-sweep script)
  called `paceHistogramSamples` directly, unmasked, and its own doc comment
  asserted the function "already excludes gap/pause/null indices" — a false
  belief inherited from reading the function's SIGNATURE and pre-fix doc
  comment, not from independently re-deriving the exclusion. Its own
  self-check reproduced 26-RESEARCH.md's pre-computed figures (13 residual,
  max 2.42%) almost exactly, which read as confirmation rather than as a
  signal that both the plan's implementation and the research session's
  own measurement shared the same blind spot.

Neither plan's self-check could see the other plan's file, and no plan
owned `paceHistogramSamples` itself with a mandate to make the invariant
hold for every caller — each self-check verified its own call site was
internally consistent, not that the shared primitive's contract actually
held. That is precisely the class of defect cross-plan integration repair
exists to catch.

## Before/After Measurements (reproduced independently, not taken on faith)

Reproduced via `npm run build && npm run compute-pace-residual` against the
same 154-activity severe stair-step cohort and 0.5%-of-covered-time
threshold the script has always used:

| | Unmasked (leaky, as committed before this repair) | Masked (correct, after this repair) |
|---|---|---|
| Residual count | 13 | **14** |
| Max residual | 2.42% (`4556693525`) | **2.44%** (`4556693525`) |
| Criterion 1 violations | 0 | 0 (unaffected — 153 strictly improved, 1 tied at zero, 0 regressed, both before and after) |

The activity that appears only under the corrected (masked) accounting is
`5246078056`: 0.485% unmasked (just under the 0.5% threshold, so
previously excluded from the residual list) vs 0.564% masked/corrected
(just over the threshold, so now included). Its baseline (unfixed
per-sample) fast mass is 10.18%, confirmed against the regenerated
`26-RESIDUAL.md`.

Full regenerated residual table, sorted descending by after-%:

```
4556693525  2.44%  (baseline 22.39%, window 20.00s) — also the PACE-04 worked example
5059204779  1.17%  (baseline 100.00%, window 150.00s)
3925007542  0.63%  (baseline 19.96%, window 20.00s)
3647739864  0.62%  (baseline 61.36%, window 221.00s)
4548213751  0.59%  (baseline 17.40%, window 20.00s)
5520899318  0.57%  (baseline 15.85%, window 20.00s)
5566805363  0.57%  (baseline 12.48%, window 20.00s)
4531479183  0.57%  (baseline 15.14%, window 20.00s)
5465833080  0.57%  (baseline 16.97%, window 20.00s)
5246078056  0.56%  (baseline 10.18%, window 20.00s)  <- new under corrected accounting
4569639779  0.55%  (baseline 11.90%, window 20.00s)
4667351283  0.54%  (baseline 21.74%, window 20.00s)
3789623232  0.51%  (baseline 9.42%,  window 20.00s)
4332544744  0.51%  (baseline 28.43%, window 20.00s)
```

## Files Changed

- `src/analytics/pace-derivation.ts` — `paceHistogramSamples` now takes
  `gapIntervals: readonly GapInterval[]` as a REQUIRED third argument (not
  an optional flag defaulting to the leaky behaviour), and excludes any
  segment whose start (`t[i]`) falls inside a gap interval. Doc comment
  rewritten to state the exact-coverage invariant plainly, replacing the
  false claim that null-skipping alone is sufficient.
- `src/analytics/pace-derivation.test.ts` — added
  `describe('paceHistogramSamples — exact coverage invariant ...')` with two
  tests: (1) summed `timeSec` across `paceHistogramSamples` output equals
  `coverage.coveredSec` exactly (400s) and never `spanSec` (700s), on
  `syntheticRecordingGapStream()` (a fixture with a known 300s gap); (2) the
  pre-gap sample's own 300s forward segment is specifically excluded.
  Updated the pre-existing `fastMassAndCoverage` test helper's call site to
  pass `gapIntervals`.

  **Mutation check performed and reverted** (not committed as source):
  temporarily reverted `paceHistogramSamples`'s body to the old 2-arg-shaped
  leaky logic (kept the 3-arg signature so the test file still compiled,
  ignored the `gapIntervals` argument, dropped the `inGap` exclusion), ran
  the new tests, and observed both fail:
  `AssertionError: expected 700 to be 400` (received the full span, not
  `coveredSec`) and `AssertionError: expected true to be false` (the 300s
  gap segment was included). Reverted the file back to the fixed version
  immediately after (verified via `cp` from a pre-mutation backup plus
  `git diff --stat` showing only the intended fix's diff), then re-ran the
  suite and confirmed all 27 tests in the file pass.
- `src/dashboard/views/detail-zones.ts` — removed the local
  `maskedPaceSeries` workaround from `computePaceDistribution`; it now
  passes `derived.coverage.gapIntervals` straight through to
  `paceHistogramSamples`. Rewrote the surrounding doc comment to document
  the shared invariant (now owned by `pace-derivation.ts`) rather than a
  local patch. The pre-existing bucket-sum-equals-`coveredSec` identity
  tests in `detail-zones.test.ts` (36 tests) pass unchanged — no assertion
  in that file was edited or weakened.
- `scripts/compute-pace-residual.mjs` — `adaptiveFastMass` now passes
  `result.coverage.gapIntervals` to `paceHistogramSamples`. Deleted the
  false doc-comment claim that `paceHistogramSamples` "already excludes
  gap/pause/null indices" and replaced it with an accurate description of
  why `gapIntervals` must be passed explicitly.
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md`
  — regenerated via `npm run compute-pace-residual` against the corrected
  code: 14 residual activities (was 13), max 2.44% (was 2.42%). Criterion 1
  reconciliation unchanged (153 strictly improved, 1 tied at zero, 0
  regressed, zero violations).
- `.planning/ROADMAP.md` — Phase 26 Criterion 1's residual figure corrected
  from "13 of the 154, all marginal (0.5-2.4%)" to "14 of the 154, all
  marginal (0.51-2.44%)", with a parenthetical recording that this is a
  correction of a measurement error (gap time was previously attributed to
  the pre-gap sample's pace) — not a relaxation of the criterion — and
  noting `5246078056`'s move across the 0.5% threshold and that Criterion
  1's strictly-lower-than-baseline result is unaffected. `STATE.md`,
  ROADMAP progress checkboxes/counters, and `REQUIREMENTS.md` were
  deliberately left untouched, per the dispatching instruction.

## Verification (reproduced, not assumed)

- `npm run build` — exits 0.
- `npx vitest run` (full suite) — 67 files, **1711 passed, 0 failed**
  (baseline before this repair: 1709 passed, 0 failed; the +2 are the new
  `paceHistogramSamples` invariant tests — no regressions).
- `grep -rn "paceHistogramSamples" src scripts` — every call site
  (`pace-derivation.ts`'s own definition, `pace-derivation.test.ts`,
  `detail-zones.ts`, `compute-pace-residual.mjs`) passes `gapIntervals`
  straight through to the shared function; none reconstructs the gap
  exclusion locally.
- `26-RESIDUAL.md`'s stated max (2.44%) matches what the regeneration
  script actually computed and wrote (verified by reading the regenerated
  file, not by trusting the console output alone).
