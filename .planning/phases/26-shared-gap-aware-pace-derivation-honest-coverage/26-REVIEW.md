---
phase: 26
status: issues_found
critical: 1
warning: 1
info: 0
reviewed: 2026-09-09
verified_by_orchestrator: 2026-09-09
critical_downgraded: []
correction: "CR-01 downgrade RETRACTED 2026-09-09 — see Correction section"
depth: standard
---

# Phase 26 Code Review — Shared Gap-Aware Pace Derivation & Honest Coverage

**Reviewed:** 2026-09-09
**Depth:** standard
**Files Reviewed:** 29 (per `<files_to_review>`)
**Status:** issues_found

## Summary

The phase collapses two divergent stream-derived pace implementations onto `src/analytics/pace-derivation.ts`,
adds an always-on coverage caption, per-split gap markers, and a "Pace disputed" badge. The module design is
careful: strict-priority gap classification avoids double-counting (26-RESEARCH.md Pitfall 3 is correctly
closed), the D-16 single-entry-point contract (`derivePaceWithCoverage`) is honoured everywhere it is called,
`detectPaceDisagreement`/`streamPaceSecPerKm` are total and never throw, and the `paceDisagreement` index field
is genuinely additive (schema version unchanged, matching the `gearName` precedent). The cross-plan
integration repair documented in `26-INTEGRATION-FIX.md` (requiring `gapIntervals` as a mandatory third
argument to `paceHistogramSamples`) is applied consistently at every call site I could find
(`detail-zones.ts`, `compute-pace-residual.mjs`, `pace-derivation.test.ts`).

Despite that repair, the "exact coverage" guarantee the whole phase is built around (COV-01's
`coveredSec` sum, D-08's "always-on" caption, D-16's "caption can never drift from the histogram")
is not actually airtight: it depends on every `covered`-classified sample producing a non-null pace,
which is not guaranteed. I found one concrete, reachable path where that dependency breaks visibly —
the always-on coverage caption is not actually always-on — and a second, narrower path where the
histogram's own bucket total can silently fall short of the coverage caption's claimed percentage.
Both are traced to the same root cause: `computePaceDistribution`/`buildBreakdownSection` derive their
rendering decision from whether the *smoothed pace series* produced any bucketable output, not from
whether `PaceCoverage` (which is computed independently by `classifyGaps` and does not depend on the
windowed series at all) has anything to report.

`F-26-01` (Moving Time tile discloses no corruption despite `Pace disputed` doing so for the same root
`moving_time` defect) was already logged by the Round 1 browser checkpoint and is not repeated here.

## Critical Issues

### CR-01: The "always-on" D-08/COV-02 coverage caption is not actually always-on — it is gated behind a non-empty pace histogram

**File:** `src/dashboard/views/detail-sections.ts:481` and `:486`
**Issue:** `buildBreakdownSection(buckets, coverage, zoneTimes)` only appends the `Pace Distribution`
heading — and therefore the coverage caption built from `coverageCaptionText(coverage)` at line 492,
which sits *inside* that same `if (buckets.length > 0)` block — when `computePaceDistribution` returned
at least one bucket. `PaceCoverage` (the `coverage` argument) is computed by `classifyGaps` completely
independently of the windowed pace series and can be well-defined and non-trivial (`coveredSec > 0`)
even when the histogram itself is empty. 26-CONTEXT.md's D-08 states the caption is "**Always-on, not
threshold-conditional**: … a healthy run visibly says so instead of the reader having to read silence
as good news" — this implementation makes the caption's presence conditional on an unrelated
computation (whether the smoothed series happened to resolve to any non-null value anywhere).

**Concrete failure scenario:** Take any stream whose distance never advances at all — e.g. the phase's
own `syntheticStandstillStream()` fixture in `src/analytics/pace-fixtures.ts` (dense 2s sampling,
`d` constant for the whole stream), or any real archive activity with a broken/flat distance channel.
`classifyGaps` computes `advanceIntervals(t, d) === []` (no sample ever advances `d`), so per
`pace-derivation.ts:212-215` the scale-relative pause threshold resolves to `Infinity`; nothing is ever
classified `pause`, and with dense 2s sampling nothing is `recording-gap` either, so **every** segment
is classified `covered` — `coverage.coveredSec === coverage.spanSec` (100% covered, confirmed directly
by the phase's own permanent test at `pace-derivation.test.ts:443-453`, which only asserts the pace
series is all-`null` and does not go on to check `computePaceDistribution`/`buildBreakdownSection`).
Meanwhile `derivePaceSeriesGapAware` resolves every sample's window to `metres <= 0` (there is no
distance anywhere to divide by), so `paceSeries` is all-`null` (same test, confirmed) and
`computePaceDistribution` therefore returns `buckets = []` (`src/dashboard/views/detail-zones.ts:99-119`
never populates `bucketTimeSec` when `paceHistogramSamples` returns no samples). Calling
`buildBreakdownSection([], coverage /* 100% covered */, zoneTimes)` then skips the entire
`if (buckets.length > 0)` block — **no "Pace Distribution" heading, no coverage caption, nothing** —
for an activity the code itself considers "100% of elapsed time covered." A reader gets zero disclosure
exactly where the phase's own reasoning ("a healthy run visibly says so") most wants one, and there is
no test anywhere in `detail-sections.test.ts` or `detail-zones.test.ts` exercising this combination (I
grepped both files for `standstill`/`buckets.length === 0` and found no coverage).
**Fix:** Decouple the caption from the bucket-presence guard — render the `Pace Distribution` heading
and caption whenever `coverage !== null && coverage.spanSec > 0`, independently of `buckets.length`,
and only gate the histogram *rows themselves* on `buckets.length > 0` (falling back to a short "no
distinct pace buckets to show" note when covered time exists but produced no bucketable series):

```ts
export function buildBreakdownSection(
  buckets: readonly PaceBucket[],
  coverage: PaceCoverage | null,
  zoneTimes: readonly ZoneTime[] | null
): HTMLElement | null {
  const hasCoverage = coverage !== null && coverage.spanSec > 0;
  if (buckets.length === 0 && !hasCoverage && zoneTimes === null) return null;

  const section = document.createElement('section');
  section.className = 'card detail-section';

  if (buckets.length > 0 || hasCoverage) {
    const heading = document.createElement('h2');
    heading.className = 'text-heading';
    heading.textContent = 'Pace Distribution';
    section.appendChild(heading);

    const captionText = hasCoverage ? coverageCaptionText(coverage!) : null;
    if (captionText !== null) {
      const caption = document.createElement('p');
      caption.className = 'text-label';
      caption.textContent = captionText;
      section.appendChild(caption);
    }

    if (buckets.length > 0) {
      section.appendChild(buildPaceDistributionRows(buckets));
    }
  }
  // ...zoneTimes block unchanged
```

## Warnings

### WR-01: `paceHistogramSamples`'s documented "exact coverage" invariant can be silently violated by an isolated zero-advance `covered` segment flanked by gaps

**File:** `src/analytics/pace-derivation.ts:469-511` (doc comment and implementation), interacting with
`derivePaceSeriesGapAware` at `:363-418`
**Issue:** The doc comment on `paceHistogramSamples` (rewritten during the 2026-09-08 cross-plan
integration repair) states as an "INVARIANT": *"the sum of every returned `timeSec` equals
`coverage.coveredSec` EXACTLY."* This holds for every case the phase's own tests exercise (the
`syntheticRecordingGapStream` fixture, the real archive worked example), but it is not actually
guaranteed by the implementation for every stream shape, because a segment that `classifyGaps` labels
`covered` can still resolve to a `null` smoothed pace, and `paceHistogramSamples` silently drops any
`null`-paced segment (`pace-derivation.ts:502`) without itemising the dropped seconds anywhere.

**Concrete failure scenario:** Construct (or encounter in a messy real device stream) a sample `i`
where: (a) segment `[t[i-1], t[i]]` is a `recording-gap` (large `dt`), (b) segment `[t[i], t[i+1]]` has
`d[i+1] === d[i]` (zero net advance) but is short enough on its own (its maximal flat run is just this
one segment) that it does **not** exceed the pause threshold, so `classifyGaps` labels it `covered`,
and (c) segment `[t[i+1], t[i+2]]` is itself a `recording-gap` or `pause`. In `derivePaceSeriesGapAware`
the window for sample `i` is clamped by the gap-boundary logic at `:393-398`: the preceding gap's
`endSec === t[i]` clamps `windowStart` forward to `t[i]`, and the following gap's `startSec === t[i+1]`
clamps `windowEnd` backward to `t[i+1]` — regardless of the configured `windowSec`, the window collapses
to exactly `[t[i], t[i+1]]`. `elapsed = t[i+1] - t[i] > 0` (passes the elapsed guard), but
`metres = d[i+1] - d[i] = 0`, so `!(metres > 0)` is true and `result[i] = null` (`:409-412`). Back in
`paceHistogramSamples`, this segment's own forward span is *not* inside any `gapIntervals` entry (it is
genuinely `covered`), so the `inGap` exclusion does not fire — but `pace === null` still causes the
`continue` at line 502, so the segment is dropped from every bucket. `coverage.coveredSec` (computed
independently by `classifyGaps`, unaffected by this) still includes this segment's `dt`. The result:
`sum(bucket.timeSec) === coverage.coveredSec - dt`, a shortfall that is never itemised as
`recordingGapSec` or `pauseSec` and never surfaced to the reader — the coverage caption's stated
"covered" percentage can therefore be a small overstatement of what the histogram bars actually sum to,
with no test in `pace-derivation.test.ts` (`describe('paceHistogramSamples — exact coverage invariant
…')`, `pace-derivation.test.ts:482-511`) covering an interior `covered` segment sandwiched this tightly
between two gaps — every existing invariant test uses a fixture with exactly one gap and otherwise
uninterrupted dense covered running either side.
**Fix:** Either (a) exclude a `covered` segment with `dt <= 0`/zero net advance from `coveredSec`
itself in `classifyGaps` when its own resolved window cannot produce a pace (requires threading window
info into classification, a larger change), or — more locally — (b) have `paceHistogramSamples` (or its
caller) itemise segments it drops for reasons *other* than `gapIntervals` membership (i.e. a `null`
pace on a segment `classifyGaps` called `covered`) into a distinct accounted category, so
`coveredSec === sum(bucket.timeSec) + itemisedNullSec` remains an exact, checkable identity rather than
an invariant that is only true for the fixtures currently in the suite. At minimum, add a permanent
regression test constructing exactly this three-segment (`recording-gap` / zero-advance `covered` /
`recording-gap`) fixture and asserting whether `sum(timeSec) === coverage.coveredSec` still holds, so
future readers know whether this is accepted residual imprecision or a defect to fix.

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


---

# Orchestrator verification (execute-phase, 2026-09-09)

The reviewer's findings were re-tested against the live tree rather than accepted on description.
One was confirmed as code behaviour but **downgraded from Critical to Info** on reachability
grounds. Recorded here rather than by silently editing the reviewer's own section — both readings
are preserved so a later reader can judge for themselves.

## CR-01 — DOWNGRADED to Info (reachability fails in the direction that would matter)

**Confirmed as described, at the code level.** `buildBreakdownSection` (`detail-sections.ts:481`)
wraps *both* the `Pace Distribution` heading and the coverage caption in `if (buckets.length > 0)`.
Probed directly with the phase's own `syntheticStandstillStream()` fixture:
`derivePaceWithCoverage` returns `coverage {spanSec:100, coveredSec:100, recordingGapSec:0,
pauseSec:0}` — 100% covered — while `paceSeries` is 51 entries **all null**, so
`computePaceDistribution` yields `buckets.length === 0` and no caption renders.

**But the finding does not hold at Critical, for two independent reasons.**

*First — the direction that would actually violate COV-02 is unreachable.* COV-02's text is
"coverage is visible to the reader **wherever a derived distribution is shown**". The damaging case
is therefore a distribution rendered *without* a caption, which requires `buckets.length > 0` while
`coverage === null`. At the sole production call site (`detail.ts:747`) `coverage` comes from
`derived.coverage`, and `derivePaceWithCoverage` always returns a coverage object — never null,
confirmed by probe. The `coverage !== null` ternary at `detail-sections.ts:487` is defensive dead
code there. So whenever a distribution is shown, the caption is shown. COV-02 holds.

*Second — the reachable case renders no distribution at all, so no caption is owed.* Scanning all
1,865 committed streams for zero net distance advance returns **exactly one** activity:
`11865310195` (6 samples, `d` all zero, 0 advancing samples) — the same degenerate near-empty
manual-entry stream `26-RESIDUAL.md` already excludes via its 50-sample floor. Its index row
carries `"hr": false`, so `computeHrZoneTimes` yields `null`, and
`buckets.length === 0 && zoneTimes === null` makes `buildBreakdownSection` return `null` outright.
No card, no `Pace Distribution` heading, no histogram — and therefore nothing the caption could sit
under. An absent card for an activity with no distance and no pace is the honest outcome, not a
silent omission.

**Residual value of the finding (why Info, not dismissed):** the D-08 comment block at
`detail-sections.ts:462-466` describes the caption as "always-on", which reads more absolutely than
the code delivers. Should a future change give a zero-bucket activity HR zones, the section would
render with zone content and no pace heading — coherent, but the comment would then be actively
misleading. Worth a comment correction or a pinned test; not worth blocking phase close.

## WR-01 — retained as Warning, not re-tested to conclusion

The claim is that `paceHistogramSamples`'s documented "sum of `timeSec` equals `coverage.coveredSec`
EXACTLY" invariant can be violated by an isolated zero-net-advance `covered` segment tightly flanked
by two gaps, whose averaging window clamps to itself, yielding `metres = 0` -> null pace, dropped
from the histogram without being itemised. If correct, the caption can overstate what the bars sum
to — which bears directly on COV-01/COV-02's exactness claim and deserves a real answer.

Not adjudicated here: constructing the flanking-gap geometry is more than a spot-check, and this is
an advisory gate. Carried forward as open review debt rather than closed on assertion.

## F-26-01 — correctly not re-reported

The reviewer was instructed that the `Moving Time` disclosure gap was already logged by the Round 1
browser checkpoint and did not duplicate it. It remains open in `26-VALIDATION.md`.


---

# CORRECTION — CR-01 downgrade retracted (2026-09-09)

**The Info downgrade above is wrong and is retracted. CR-01 stands as Critical.**

The reachability argument rested on a factual error. I probed reachability with the phase's
`syntheticStandstillStream()` fixture, measured it at 100% covered, and then carried that
"benign, nothing to disclose" character over to the real archive activity the scan found. Those are
not the same stream, and the real one is not benign.

`11865310195` has `t = [0, 1, 2, 14, 17, 18]`. The `2 -> 14` segment is a 12-second recording gap
in an 18-second span:

| Quantity | Value |
|----------|-------|
| spanSec | 18 |
| coveredSec | 6 (**33%**) |
| recordingGapSec | 12 (**67%**) |

So this is not "an activity with no distance and no pace" whose absent card is the honest outcome.
It is the archive's most gap-dominated stream by proportion, and `buildBreakdownSection` returns
`null` for it — no heading, no caption, no disclosure of the 67% recording gap the code has already
correctly computed. D-08's stated purpose is that an activity visibly states its own health rather
than the reader inferring it from silence; this activity's health is exactly what the silence hides.

**What survives from the retracted analysis, and what does not.**

Still correct: the inverse direction (a distribution rendered *with* buckets but *without* a
caption) is genuinely unreachable, because `derivePaceWithCoverage` never returns a null coverage
and `detail.ts:747` is the sole call site. The `coverage !== null` ternary is dead code there.

No longer load-bearing: that observation only rules out one of two failure directions. I treated it
as though it disposed of the finding. It does not — the other direction is the one that fires, and
it fires on real committed data today.

Also wrong in the retracted section: leaning on `26-RESIDUAL.md`'s 50-sample floor as evidence the
activity is negligible. That floor scopes which activities enter the *fast-mass residual cohort*; it
says nothing about whether the detail view owes a reader disclosure, and I used it as if it did.

**Disposition:** CR-01 is confirmed Critical and is the blocking gap in `26-VERIFICATION.md`
(`status: gaps_found`). The fix and the missing regression test are specified in that report's
`gaps:` array.
