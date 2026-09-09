---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
verified: 2026-09-09T19:00:04Z
status: gaps_found
score: 6/7 success criteria verified (Criterion 1 partially defeated by an unfixed consumer; see gap)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "6/7 (Criterion 3 / D-08 / COV-02 the recorded gap)"
  gaps_closed:
    - "Criterion 3 / D-08 / COV-02 — coverage caption previously disappeared when buckets.length was 0 (activity 11865310195, 33% covered). breakdownSectionPlan now gates the caption on coverage alone and bars alone on bucket presence. Verified by reading detail-sections.ts:497-604 directly and by Round 2 human checkpoint (26-VALIDATION.md R2-1/R2-2, both PASS)."
    - "WR-01 (false 'sum EXACTLY equals coveredSec' invariant in paceHistogramSamples doc comment) — comment corrected, paceHistogramAccounting itemises the identity, archive-wide sweep finds 0 violations across 1,865 streams (44 activities with nonzero unbucketedCoveredSec). Verified by reading pace-derivation.ts:469-570 and pace-derivation.test.ts:521-560."
  gaps_remaining:
    - "CR-03 (new, found in round-2 review, not present in the previous VERIFICATION.md's gap list): the detail-page pace CHART band still derives pace under a hard-coded fixed 20s window while every other consumer (histogram, coverage caption, split gap markers) uses the adaptive window. This is a newly discovered defect, not a recurrence of the closed Criterion-3 gap."
  regressions: []
gaps:
  - truth: "Success Criterion 1 / 5 / phase goal statement: every named consumer of derived pace (chart, histogram, splits) exhibits the phantom-fast-mode reduction; the shipped adaptive approach recovers exemplar 5059204779 to the measured 1.22%/97% figures, not the 94.81%/30% fixed-20s reading the phase exists to eliminate."
    status: failed
    reason: >
      buildChannelSeries (src/dashboard/views/detail-charts-logic.ts:120) calls
      derivePaceSeries(stream.t, stream.d, PACE_SMOOTHING_WINDOW_SEC) where
      PACE_SMOOTHING_WINDOW_SEC = PACE_WINDOW_FLOOR_SEC = 20 (fixed), instead of the adaptive
      window (adaptiveWindowSec) that detail.ts:717 resolves and passes to
      derivePaceWithCoverage for the histogram, coverage caption, and split markers. Verified
      independently (not from the review's numbers alone) by running both window resolutions
      against the committed stream for activity 5059204779:
      chart(20s) fast-mass = 94.81% of covered time faster than 3:00/km, adaptive fast-mass =
      1.22% — reproducing, on screen, in the primary chart band, the exact 94.81%/30%
      "phantom fast mode" reading that Criterion 1 names as "the trap this criterion exists to
      avoid re-entering." Also independently verified the max per-sample divergence: 5059204779
      431.9 sec/km, 4598855187 29,656.7 sec/km, across 11 of 1,865 archive activities whose
      adaptive window differs from the 20s floor. The module's own header
      (detail-charts-logic.ts:5-9) states "the chart and detail-zones.ts's histogram both read
      the same gap-aware series so the two surfaces cannot disagree" — demonstrably false, and
      itself the exact false-invariant-doc-comment failure class COV-01 exists to forbid (the
      same class WR-01 was closed for in the prior round). On the pinned exemplar 5059204779 —
      the activity the phase's own Round 2 human checkpoint reads back and the one activity
      carrying the new "Pace disputed" badge — the Pace & Effort chart band and the Pace
      Distribution histogram directly below it disagree by two orders of magnitude in the same
      paint.
    artifacts:
      - path: "src/dashboard/views/detail-charts-logic.ts"
        issue: "buildChannelSeries (:120) hard-codes the 20s floor as the pace chart's window instead of resolving adaptiveWindowSec per activity; module header (:5-9) and PACE_SMOOTHING_WINDOW_SEC doc comment (:76-80) assert an invariant ('cannot disagree' / 'a floor, not the only value') the code does not hold at its one internal call site."
      - path: "src/analytics/pace-single-source.test.ts"
        issue: "OVERRIDE_LITERALS scans for the literal 'windowSec:' (with colon); detail-charts-logic.ts:98 passes the fixed value via ES2015 shorthand ({ windowSec, gapIntervals }), which is textually indistinguishable from the (t, d, windowSec) parameter declaration the audit's own docblock explicitly excuses. The audit does not catch a real, currently-shipping override of the adaptive resolution — undermining Criterion 4's 'provably' / 'demonstrated catching a ... second implementation' claim for this specific override shape."
    missing:
      - "buildChannelSeries's pace branch must resolve the same adaptive window as derivePaceWithCoverage (ideally by calling derivePaceWithCoverage directly, per the reviewer's suggested fix, or at minimum by importing and calling adaptiveWindowSec(stream.t, stream.d) instead of the fixed floor)."
      - "The two false contract-invariant comments (detail-charts-logic.ts:5-9 and :76-80) must be corrected to match what the code actually does, once fixed."
      - "The single-source override audit should be extended to catch the shorthand form (add 'windowSec,' / 'windowSec }' to OVERRIDE_LITERALS, or scan for derivePaceSeriesGapAware( call sites outside pace-derivation.ts) so a fixed-window override at a non-pace-derivation.ts call site cannot pass clean again."
      - "A regression test asserting that, for activity 5059204779, the chart's pace series and the histogram's pace series are the same array of values (or at minimum agree on fast-mass fraction within a stated tolerance)."
deferred:
  - truth: "CR-02: statusBadgeTexts / appendStatusBadges (list.ts:341, :380-381) use `row.paceDisagreement !== null`, which is true for `undefined`, so a pre-Phase-26 or partially-regenerated index.json makes every row show a false 'Pace disputed' badge and then throws a TypeError inside appendPaceDisputedBadge."
    addressed_in: "Not phase-scheduled; recommended as an immediate follow-up fix, not a later-phase deferral"
    evidence: >
      Confirmed present in the code exactly as the round-2 review describes. Confirmed LATENT
      against the live artifact: today's regenerated data/dashboard/index.json (1,890 rows)
      has 0 rows missing the paceDisagreement key, so the defect is not currently firing and
      does not violate the observable text of Success Criterion 7 (the archive-wide flag count
      reads exactly 1 of 1,890, correctly, for activity 5059204779, verified directly against
      data/dashboard/index.json). detail.ts:631 already reads the same field correctly with
      `?? null`, showing the fix is a two-line, well-understood change. Recorded as a WARNING
      rather than a phase-blocking gap because no stated Success Criterion's text covers
      robustness against a stale/partial index.json shape — but it is a genuine production
      hazard for this project's staged-build/browser-cache failure mode (a recorded lesson) and
      should not be left open past this phase's close.
---

# Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage Verification Report

**Phase Goal:** Every consumer of derived pace (chart, histogram, splits) reads from one gap-aware
module in `src/analytics/`, coverage is exact and visibly reported, a stratified fixture library
exists for every later phase to reuse, the residue adaptive windowing does not fix is identified
and quantified rather than smoothed into plausibility, and a metadata-vs-stream pace cross-check
catches the one activity whose metadata alone would otherwise display a physically implausible
pace as fact.

**Verified:** 2026-09-09T19:00:04Z
**Status:** gaps_found
**Re-verification:** Yes — this phase's previous VERIFICATION.md (Criterion 3 / D-08 / COV-02)
gap was closed by plans 26-11/26-12/26-13 and is confirmed closed below. A NEW gap (CR-03),
surfaced by the round-2 code review after that closure and independently reproduced here, is
what keeps this phase from `passed`. The previous report's frontmatter and its `gaps:` array are
stale and were not relied on for this verdict — this report reflects the codebase as it now
stands, evaluated fresh against ROADMAP.md's 7 Success Criteria and the goal statement itself.

## Goal Achievement

### Observable Truths (7 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Archive-wide phantom-fast-mode reduction, measured per-activity against baseline, strictly lower (or both zero) for 153/154 + 1 tie, 0 regressions; residual of 14 quantified and enumerated by ID | ⚠️ PARTIAL | The measurement itself (26-RESIDUAL.md, `compute-pace-residual.mjs`, driven by `derivePaceWithCoverage`) is sound and independently re-derivable — verified 154 cohort, 14 residual, 153 strictly improved / 1 tie / 0 regressed, matches the committed artifact. **But** the phase goal names "chart" as a consumer this criterion's trap applies to, and the chart band still reproduces the exact 94.81%/30% fixed-window reading on the pinned exemplar 5059204779 that this criterion calls "the trap this criterion exists to avoid re-entering." The measurement passes; the shipped UI re-enters the trap on one surface. See gap. |
| 2 | Gaps clip rather than manufacture pace; affected splits disclose it; both demonstrated failing when clipping/marking is removed | ✓ VERIFIED | `classifyGaps` / gap-boundary clipping in `pace-derivation.ts`; split gap marking confirmed live in 26-VALIDATION.md Row 2/R2 (`Km 11: includes 11:29 of recording gap`, exact string, human-read). Tests in `pace-derivation.test.ts` and `detail-sections.test.ts` cover clip removal. |
| 3 | Coverage sums exactly (covered + excluded = span, exact); pinned exemplar's on-screen coverage % matches an independent sum | ✓ VERIFIED | `breakdownSectionPlan` (detail-sections.ts:497-523) computes the caption from `coverage` alone; gated only on coverage, not bucket presence (the CR-01 fix). Round 2 human checkpoint R2-1/R2-3 (26-VALIDATION.md) both PASS with verbatim on-screen quotations matching independent hand/re-derived sums (`33%/67%/0%` for the previously-broken 11865310195, `99%/1%/0%` regression-check on the pinned exemplar). `4556693525` stream-span-vs-metadata-elapsed_time difference (3,394 vs 3,393s) reported rather than absorbed, per D-06. |
| 4 | Grep-based audit finds zero remaining per-sample `dt/dd` pace arithmetic outside `pace-derivation.ts`; audit demonstrated catching a reintroduced second implementation | ⚠️ PARTIAL | `pace-single-source.test.ts`'s planted-second-implementation test (describe block at :332, "the audit is demonstrated catching a reintroduced second implementation") does work for actual duplicated `dt/dd` arithmetic — confirmed by reading the test. **But** the separate "override containment" sub-test (`OVERRIDE_LITERALS = ['clipAtGaps', 'windowSec:', 'pauseRule:']`, literal-with-colon match) has a confirmed, currently-live blind spot: `detail-charts-logic.ts:98`'s ES2015 shorthand `{ windowSec, gapIntervals }` is textually indistinguishable from the excused `(t, d, windowSec)` parameter-declaration shape, so the audit does not catch the real fixed-window override described under Criterion 1/5. "Provably" zero overrides is not currently true. |
| 5 | Derivation adapts to each activity's own advance interval rather than a fixed window; validated against 4 interval profiles; 5059204779/3647739864/4598855187 recover to 1.22%/0.00%/0.00% and 97/100/100% coverage under the shipped adaptive approach | ⚠️ PARTIAL | `adaptiveWindowSec` (`max(20, 2.5 × p90(advance intervals))`) is real, tested, and correctly wired into `derivePaceWithCoverage` → histogram/coverage/splits. The stated recovery figures are correct **for that path**. Independently re-derived: `adaptiveWindowSec` for 5059204779 = 150s, for 4598855187 = 247.5s, matching the criterion's cited windows. **But** "the shipped adaptive approach" is not what the chart band ships — the chart passes the fixed 20s floor, so the recovery the criterion describes is not what a reader of the detail page's chart actually sees for these exemplars. |
| 6 | Fixture library stratified across ≥5 device/source categories, includes decimation-aliased/recording-gap/multi-hour-pause/impossible-speed/pinned-exemplar fixtures by name | ✓ VERIFIED | `src/analytics/pace-fixtures.ts`: `fenix-6-pro-fit`, `suunto-9` (implied by `deviceFamily`), `gpx-source`, `intervals-icu-only`, `no-device-name` device-stratified fixtures confirmed by name; `synthetic-decimation-aliased`, `synthetic-multi-hour-pause`, `synthetic-impossible-speed`, and a recording-gap fixture (`decimation-aliased` / dedicated gap fixture at :360-372) all confirmed present by name via grep. `pace-fixtures.test.ts` (34 tests) passes. |
| 7 | Metadata-vs-stream cross-check flags 5059204779 (read directly from index output); archive-wide flag count exactly 1 of 1,890; demonstrated failing when check removed | ✓ VERIFIED | Confirmed directly against the live `data/dashboard/index.json`: exactly 1 row flagged archive-wide, and it is `5059204779` with `{streamPaceSecPerKm: 350.6, metadataPaceSecPerKm: 112.6, ratio: 3.11}` — matching the criterion's cited 1:53/km-vs-5:51/km disagreement. 26-VALIDATION.md Row R3/R4/R6 (Round 1) confirm the badge, stat card, and rebased `vs. Avg` caption render correctly in the browser. CR-02 (see Deferred) is a robustness hazard against a stale index.json, not a failure of this criterion's stated, currently-observable behavior. |

**Score:** 4/7 fully VERIFIED, 3/7 PARTIAL (all three PARTIAL findings trace to the single CR-03
root cause: the chart band's fixed-window override). No criterion is a clean FAIL — the
measurement/derivation machinery Criteria 1, 4 and 5 depend on is real and correct where it is
actually used (histogram, coverage caption, splits, residual computation) — but Criteria 1, 4 and
5 each contain an explicit claim (chart named as a consumer / audit provably clean / "shipped
adaptive approach" recovers the exemplar) that the current code does not satisfy end-to-end.

### Deferred / Non-Blocking Findings

| # | Item | Disposition | Evidence |
|---|------|-------------|----------|
| 1 | CR-02 — `paceDisagreement !== null` vs `undefined` in `list.ts` | WARNING, not a Success-Criteria blocker | See `deferred:` frontmatter above. Confirmed present in code; confirmed latent against today's `index.json` (0/1890 rows missing the key). Recommend an immediate two-line follow-up fix (`?? null`), not gated on this phase's re-close. |
| 2 | WR-02 (paceDisagreement `null` collapses "checked, clean" and "unchecked" on stream-read failure) | Not verified against a Success Criterion; noted for follow-up | Confirmed by reading `compute-dashboard-index.ts:219-236` — catch branch assigns `null`, identical to the "checked and clean" value, contradicting the field's own doc comment. Does not affect the archive-wide flag count (0 stream-read failures observed against the live archive) so Criterion 7's stated evidence is unaffected. |
| 3 | WR-03 (archive-wide pace-disagreement sweep test may exceed vitest's 5s default timeout under load) | Not a code defect, a CI-flake risk | Not independently re-timed in this verification pass; accepted as-described from the review's own measurement (4.13s isolated, 5.007s observed under parallel load). |
| 4 | WR-04 (unbounded histogram bucket count, 343 rows on one activity) | Presentation defect, not an accounting defect | Confirmed the underlying `bucketed === coveredSec` identity is not broken by this; does not affect Criterion 3's exactness claim. |
| 5 | WR-05 (`compute-pace-residual.mjs` writes to a hard-coded phase directory with no `mkdir`) | Real hazard for Phase 27's stated regeneration promise, not a Phase 26 Success Criterion | Not independently re-run in this pass; accepted as-described. Relevant to Phase 27's dependency on `26-RESIDUAL.md` regeneration, should be tracked before this phase directory is archived under `.planning/milestones/`. |

None of items 2-5 map to a stated Success Criterion's text and none were independently exercised
beyond confirming the code shape the review describes; they are recorded here for follow-up
visibility, not as phase-blocking gaps.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/pace-derivation.ts` | Single shared gap-aware pace module | ✓ VERIFIED | `derivePaceWithCoverage`, `derivePaceSeriesGapAware`, `classifyGaps`, `adaptiveWindowSec`, `paceHistogramAccounting` all present, tested (32 tests), used by `detail.ts`, `detail-zones.ts`, `detail-charts-logic.ts` (partially, see gap), `compute-dashboard-index.ts`. |
| `src/analytics/pace-fixtures.ts` | Stratified fixture library | ✓ VERIFIED | See Criterion 6 above. 34 passing tests in `pace-fixtures.test.ts`. |
| `src/analytics/pace-single-source.test.ts` | Grep-based single-source audit | ⚠️ ORPHANED BLIND SPOT | Exists, runs (73 tests pass), catches the planted-second-implementation case, but does not catch the live `windowSec` shorthand override in `detail-charts-logic.ts:98` (Criterion 4 gap). |
| `scripts/compute-pace-residual.mjs` + `26-RESIDUAL.md` | PACE-06 residual deliverable | ✓ VERIFIED | Regenerated 2026-09-09T09:08:40Z, 154 cohort / 14 residual, matches REQUIREMENTS.md PACE-06 text (note: REQUIREMENTS.md cites "13 of 154"; the committed `26-RESIDUAL.md` and this verification both independently confirm **14 of 154** — the REQUIREMENTS.md figure is one activity stale relative to the corrected artifact per the phase's own documented `5246078056` correction. This is a documentation staleness note, not a fresh gap — 26-RESIDUAL.md's frontmatter already records the correction and its cause.) |
| `src/dashboard/views/detail-charts-logic.ts` | Chart band reads the shared adaptive derivation | ✗ STUB (partial) | Imports and calls the shared module correctly in structure, but `buildChannelSeries`'s pace branch (:120) passes a fixed 20s window instead of the adaptive resolution used everywhere else. See gap. |
| `src/dashboard/views/list.ts` | Badge rendering reads `paceDisagreement` defensively | ⚠️ LATENT DEFECT | CR-02, see Deferred. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `detail.ts` | `pace-derivation.ts` (`derivePaceWithCoverage`) | direct call, `:717` | ✓ WIRED | Coverage, histogram, splits all read this single call's result. |
| `detail-zones.ts` (histogram) | `pace-derivation.ts` | via `derivePaceWithCoverage` result passed through `detail.ts` | ✓ WIRED | Confirmed via `computePaceDistribution` consuming the shared coverage/pace result. |
| `detail-charts-logic.ts` (chart band) | `pace-derivation.ts` | `derivePaceSeries` wrapper → `derivePaceSeriesGapAware` | ⚠️ WIRED BUT WRONG ARGUMENT | Structurally wired (no duplicated arithmetic), but the `windowSec` argument is the fixed floor, not the adaptive resolution — the wiring reaches the shared module but not the shared *result*. |
| `list.ts` / `index-client.ts` | `index.json` `paceDisagreement` field | JSON fetch + cast | ⚠️ PARTIAL | Cast bypasses the codebase's own `ParsedDashboardIndexRow` type designed for this; `!== null` test mishandles `undefined`. Currently non-firing against the live artifact (CR-02, deferred). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| Detail page coverage caption | `coverage` (spanSec/coveredSec/recordingGapSec/pauseSec) | `derivePaceWithCoverage(stream)` | Yes — independently re-derived, matches on-screen values | ✓ FLOWING |
| Detail page pace histogram | `computePaceDistribution` buckets | `derivePaceWithCoverage` result | Yes | ✓ FLOWING |
| Detail page pace chart band | `paceValues` from `derivePaceSeries(t, d, 20)` | `pace-derivation.ts` shared function, but with a fixed argument that does not reflect the activity's own adaptive window | Data is real (not stubbed/empty) but is the WRONG real data — a different pace series than the one shown one section below it on the same page | ⚠️ DIVERGENT (real data, wrong window — a new failure category between STATIC and FLOWING: the source is genuinely computed, but two consumers of "the same" derivation receive materially different values for the same activity) |
| Activities list "Pace disputed" badge | `row.paceDisagreement` | `index.json` fetch, unvalidated cast | Real when present; `undefined` mishandled as truthy-flag when absent | ⚠️ HOLLOW on stale index (currently not firing) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Adaptive window differs from chart's fixed floor on the pinned exemplar | Node probe against `dist/analytics/pace-derivation.js` + `data/streams/5059204779.json`: computed `adaptiveWindowSec` = 150, compared 20s-window vs 150s-window series | `adaptiveWindow=150 vs floor=20, max diff 431.9 sec/km` | ✓ CONFIRMS GAP |
| Chart-window fast-mass fraction vs adaptive fast-mass fraction, activity 5059204779 | Same probe, Δt-weighted fraction of covered time < 180 sec/km | `chart(20s) 94.81% vs adaptive 1.22%` | ✓ CONFIRMS GAP (matches review's 94.80%/1.17% within the tolerance of a slightly different weighting method) |
| `index.json` `paceDisagreement` key coverage | `node -e` scan of `data/dashboard/index.json`, 1890 rows | `0 rows missing the key; exactly 1 row flagged, activity 5059204779` | ✓ CONFIRMS CR-02 IS LATENT, CRITERION 7 CURRENTLY SATISFIED |
| Full pace-module test suite | `npx vitest run` on `pace-derivation`, `pace-fixtures`, `pace-single-source`, `detail-charts-logic`, `detail-sections` test files | `268 tests passed, 5 files` | ✓ PASS (expected — none of these tests exercise the chart-vs-histogram cross-check that CR-03 requires) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention found in this repository; PLAN/SUMMARY files do not
reference shell probes. Verification instead used direct Node probes against the committed
`dist/` build and `data/` archive (see Behavioral Spot-Checks above), matching this project's
established review methodology (26-REVIEW.md's own probe style).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| PACE-01 | 26-01, 26-02, others | One shared module, no independent `dt/(dd/1000)` | ⚠️ LITERALLY SATISFIED, SPIRIT DEFEATED | Both files import the shared module (literal text satisfied); the chart passes a divergent window argument to it, defeating the goal statement's parenthetical that "the two surfaces cannot disagree." REQUIREMENTS.md ticks this Complete; this verification finds that tick optimistic given CR-03. |
| PACE-02 | 26-01 | No manufactured pace across gaps | ✓ SATISFIED | Criterion 2. |
| PACE-03 | 26-03 | Window choice justified from archive evidence | ✓ SATISFIED | `adaptiveWindowSec` formula and its doc comments in `pace-derivation.ts`. |
| PACE-04 | 26-04 | Histogram eliminates phantom fast mode archive-wide | ✓ SATISFIED (for the histogram specifically) | Not affected by CR-03 — histogram uses the adaptive path correctly. |
| PACE-05 | 26-05 | Split gap marking | ✓ SATISFIED | 26-VALIDATION.md Row 2/R2. |
| PACE-06 | 26-11 | Residue quantified, not smoothed | ✓ SATISFIED | 26-RESIDUAL.md, 14/154, independently re-derivable. |
| PACE-07 | 26-08 | Metadata-vs-stream cross-check surfaced | ✓ SATISFIED (currently) | Confirmed against live index.json; CR-02 is a latent robustness gap, deferred. |
| COV-01 | 26-01, 26-12 | Coverage sums exactly, asserted by test | ✓ SATISFIED | `paceHistogramAccounting`, archive-wide 0 violations across 1,865 streams. |
| COV-02 | 26-12, 26-13 | Coverage visible wherever distribution shown | ✓ SATISFIED | CR-01 fix confirmed by direct code read + Round 2 human checkpoint. |
| ERA-03 | 26-06 | Stratified fixtures by device era | ✓ SATISFIED | Criterion 6. |

No orphaned requirements: all 10 phase requirement IDs (PACE-01..07, COV-01, COV-02, ERA-03) are
claimed across the 13 plans' `requirements` frontmatter and all 10 appear, ticked Complete, in
REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/dashboard/views/detail-charts-logic.ts` | 5-9, 76-80 | False invariant doc comments ("cannot disagree", "a floor, not the only value") contradicted by the code's own sole call site | 🛑 Blocker | Same failure class as the just-closed WR-01; the module's contract claim is not true. |
| `src/dashboard/views/detail-charts-logic.ts` | 120 | Fixed-window argument where the rest of the codebase resolves adaptively | 🛑 Blocker | Drives Criteria 1/4/5 gaps. |
| `src/analytics/pace-single-source.test.ts` | 204 (`OVERRIDE_LITERALS`) | Audit literal-matches `windowSec:` (colon) but not the shorthand `{ windowSec }` form actually used at the one real override site | ⚠️ Warning | Undermines Criterion 4's "provably" claim for this specific shape; the reintroduced-second-implementation mechanism itself still works. |
| `src/dashboard/views/list.ts` | 341, 380-381 | `!== null` strict test against a field that can legitimately be `undefined` from an unvalidated JSON cast | ⚠️ Warning (currently latent) | CR-02, deferred — real hazard, not currently firing. |
| `src/analytics/compute-dashboard-index.ts` | 219-236 | Stream-read failure and "checked, clean" both write `paceDisagreement: null`, contradicting the field's own "null NEVER means not-checked" doc comment | ℹ️ Info | WR-02, not exercised by the live archive (0 read failures observed), deferred. |
| No `TBD`/`FIXME`/`XXX` markers found in files touched by this phase (checked via grep across the review's `files_reviewed_list`). | — | — | — | Debt-marker gate clean. |

### Human Verification Required

None new. This phase already completed its Round 1 + Round 2 human browser checkpoints
(26-VALIDATION.md), all rows PASS. The CR-03 defect described above was independently confirmed
by direct code reading and reproducible Node probes against the committed archive — it does not
require a human browser session to establish, only to *see* (the reviewer's own report already
describes what a human would see: the chart band and histogram visibly disagreeing on
5059204779's detail page). No further human verification is requested as part of this report;
closing CR-03 should include a human re-check of that one page once fixed, but that is a
gap-closure task, not an open verification question.

### Gaps Summary

Six of the phase's 13 plans (26-01 through 26-10, 26-11, 26-12, 26-13) delivered real, working,
independently-verified machinery: the shared gap-aware derivation module, exact coverage
accounting, gap-boundary clipping and split marking, a stratified fixture library, the PACE-06
residual quantification, and the metadata-vs-stream cross-check. The previously open gap
(Criterion 3 / D-08 / COV-02, coverage caption disappearing on low-coverage activities) is
confirmed closed by direct code reading and the Round 2 human checkpoint — not merely by SUMMARY
claims.

One new, single-root-cause gap remains, surfaced by the round-2 code review and independently
reproduced here rather than taken on trust: the detail page's pace **chart band** — one of the
three consumers the phase goal explicitly names ("chart, histogram, splits") — still derives pace
under the fixed 20s window the rest of the phase replaced. On the pinned exemplar 5059204779, this
means the phase's own headline "trap" (94.81% fast mass under a fixed window, misread as a device
defect) is still what a reader of the chart sees, one scroll position above the histogram that
correctly reads 1.22%. Two module-header comments assert this cannot happen; both are
demonstrably false against the code's actual behavior. The single-source audit built to prevent
exactly this class of override has a confirmed, currently-exploited blind spot (colon-literal
match vs. object-shorthand syntax).

This is not a second implementation and not a broken derivation — `pace-derivation.ts` itself is
correct and is genuinely the one place `dt/dd`-equivalent arithmetic lives. It is a wrong argument
passed to the right function at one call site, but it is exactly the call site that produces the
phase's most visually prominent surface, on exactly the activity the phase uses as its own worked
example. Recommended fix (from the review, concurred with): have `buildChannelSeries` resolve
`adaptiveWindowSec(stream.t, stream.d)` (or call `derivePaceWithCoverage` directly) instead of the
fixed floor, correct the two false contract comments, extend `OVERRIDE_LITERALS` (or add a
call-site scan) to close the shorthand blind spot, and add a regression test pinning that the
chart and histogram series agree for 5059204779.

CR-02 (badge rendering `undefined`-vs-`null` hazard) is real but currently latent against the live
archive and does not defeat any stated Success Criterion's observable text; recorded as a deferred
follow-up rather than a phase-blocking gap, with a recommendation to fix promptly given this
project's own recorded staged-build/cache lesson.

---

_Verified: 2026-09-09T19:00:04Z_
_Verifier: Claude (gsd-verifier)_
