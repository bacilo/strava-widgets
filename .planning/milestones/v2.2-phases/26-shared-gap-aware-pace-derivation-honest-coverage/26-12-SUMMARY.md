---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 12
subsystem: ui
tags: [vitest, dom-render-decision, coverage-caption, pace-derivation, gap-closure, cr-01, wr-01]

# Dependency graph
requires:
  - phase: 26-06
    provides: "detail-sections.ts's coverageCaptionText and the D-08/COV-02 coverage caption contract"
  - phase: 26-11
    provides: "unbucketedCoveredSec/paceHistogramAccounting exports and the archive-wide unbucketed-covered residue measurement (44/1865, 43 partial-shortfall)"
provides:
  - "breakdownSectionPlan — the pure render decision buildBreakdownSection now delegates to entirely, node-testable without a DOM builder"
  - "The D-08/COV-02 coverage caption decoupled from buckets.length — gated on coverage alone"
  - "An honest noteText itemising unbucketedCoveredSec, rendering both in place of absent bars and alongside bars that omit covered time"
  - "A permanent regression test suite (7 tests) pinning CR-01's fix on the real archive activity 11865310195"
affects: ["26-13"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "*-logic pure-decision extraction applied to a DOM builder for the first time in this file: breakdownSectionPlan owns every render decision, buildBreakdownSection is a pure emitter — matching detail-charts-logic.ts/detail-best-efforts-logic.ts/list-logic.ts's existing idiom"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts

key-decisions:
  - "The second noteText branch ('Bars below omit ... of covered time') was included, NOT deferred — plan 26-11's archive sweep measured figure (3) as 43 (not zero): 43 of 44 affected activities still render bars while the caption's percentage overstates what those bars sum to. Implementing only the bars-absent branch would have left 43 activities showing an overstating caption with no corrective note."
  - "hasCoverage is derived from captionText !== null (not a separate spanSec > 0 check) so 'has coverage worth captioning' has exactly one definition — coverageCaptionText's own null-on-non-positive-span contract — and so the ternary narrows coverage for the compiler without a non-null assertion"
  - "unbucketedCoveredSec is imported as a value from pace-derivation.ts rather than recomputed in the dashboard layer, honoring PACE-01's single-derivation rule and this plan's own key_link"

requirements-completed: [COV-02]

# Metrics
duration: ~35min
completed: 2026-09-09
---

# Phase 26 Plan 12: D-08 Always-On Coverage Caption (CR-01) Summary

**`breakdownSectionPlan` extracted as a pure, node-testable render decision; the D-08/COV-02 coverage caption now gates on `coverage` alone (never `buckets.length`), and an honest note — itemising `unbucketedCoveredSec` — renders both when bars are absent and alongside bars that understate covered time (43 of 44 archive-wide affected activities are the latter shape per plan 26-11's measurement).**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 2 (`src/dashboard/views/detail-sections.ts`, `src/dashboard/views/detail-sections.test.ts`)

## Accomplishments

- `breakdownSectionPlan(buckets, coverage, zoneTimes)` extracted as a pure function owning every render decision `buildBreakdownSection` used to make inline; `buildBreakdownSection` is now a pure emitter that reads only from the returned plan object (confirmed via the plan's own mutation-tested regex: `null` matches at HEAD-after-fix, 5 matches — `buckets.length`×2, `zoneTimes ===`, `coverage !==`, `zoneTimes !==` — at pre-fix HEAD, proving the check is non-vacuous).
- The `Pace Distribution` heading and its D-08/COV-02 coverage caption now render whenever `coverage` is captionable, independently of `buckets.length` — real archive activity `11865310195` (spanSec 18, coveredSec 6, empty histogram) now renders `'33% of elapsed time covered · 67% recording gaps · 0% paused'` instead of nothing, closing CR-01.
- A new `noteText` field, computed via `unbucketedCoveredSec` imported from `pace-derivation.ts` (never recomputed in the dashboard layer, per PACE-01/this plan's key_link), renders an honest itemised note in BOTH shapes plan 26-11's finding required: `'No pace buckets — {duration} of covered time produced no derivable pace.'` when bars are entirely absent, and `'Bars below omit {duration} of covered time that produced no derivable pace.'` when bars exist but omit some covered time.
- D-31 preserved exactly: the HR half gains no note, no placeholder, no "no HR data" copy — `grep -c "No HR data\|coming soon\|Not available"` returns `0`.
- `buildBreakdownSection`'s doc comment corrected: the false "always renders when there are buckets" framing removed (`grep -c` returns `0`), replaced with the actual three-way return contract and a note naming CR-01 and `11865310195` for a future reader.
- 7 new regression tests pin the fix: the real-activity hand-built fixture and the real committed stream (Task 1's RED pair), a null/zero-span "cannot fail" guard pair, the all-gap edge case (0:00 note), the no-regression direction (bars + caption + no note), and D-31 re-pinned at the fix site.

## Task Commits

Both tasks landed in one commit, per the plan's own instruction ("Do not commit at the end of this task... both tasks land in one commit"):

1. **Task 1 + Task 2: Extract breakdownSectionPlan, watch it fail on the faithfully-carried-over defect, then gate the caption on coverage and add the honest note** — `8026cb4b` (fix)

## Demonstrated Failing (Task 1, captured before Task 2's fix)

Running `npx vitest run src/dashboard/views/detail-sections.test.ts` against the tree with only Task 1's extraction and its two new regression tests staged (before Task 2's coverage-gating fix) produced exactly 2 failing tests, both inside the new `breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression)` describe block, both failing at `expect(plan).not.toBeNull()`. Every pre-existing test in the file (88 of them) still passed, including the re-anchored `coverageCaptionText` source guard. Verbatim vitest output:

```
 FAIL  src/dashboard/views/detail-sections.test.ts > breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression) > renders the pace heading and caption for real activity 11865310195 even though its histogram is empty, from a hand-built fixture
AssertionError: expected null not to be null
 ❯ src/dashboard/views/detail-sections.test.ts:222:22
    220|     const plan = breakdownSectionPlan([], coverage, null);
    221|
    222|     expect(plan).not.toBeNull();
    |                      ^
    223|     expect(plan!.captionText).toBe('33% of elapsed time covered · 67% …
    224|     expect(plan!.showPaceHeading).toBe(true);

 FAIL  src/dashboard/views/detail-sections.test.ts > breakdownSectionPlan — D-08 always-on coverage caption (CR-01 regression) > renders the same caption from the real committed stream 11865310195, not just a synthetic look-alike
AssertionError: expected null not to be null
 ❯ src/dashboard/views/detail-sections.test.ts:238:22
    236|
    237|     const plan = breakdownSectionPlan([], derived.coverage, null);
    238|     expect(plan).not.toBeNull();
    |                      ^
    239|     expect(plan!.captionText).toBe('33% of elapsed time covered · 67% …
    240|   });

 Test Files  1 failed (1)
      Tests  2 failed | 88 passed (90)
```

This is the defect failing for exactly the right reason — the extraction changed nothing (a faithful `buckets.length > 0` carry-over), so `breakdownSectionPlan([], coverage, null)` returns `null` for the identical reason `buildBreakdownSection` did at HEAD.

## Handling the wave-7 finding (upstream_finding_from_wave_7)

Plan 26-11's archive-wide sweep (`26-11-SUMMARY.md` § "Archive-wide unbucketed-covered residue") measured: 44 of 1,865 activities carry `unbucketedCoveredSec > 0`; **43 of those 44 are "partial shortfall"** — a histogram DOES render bars, but the caption's covered-percentage overstates what those bars sum to. Only one (`11865310195`) is the bars-entirely-absent case this plan's `<objective>` was originally framed around.

This plan's own `<interfaces>` and Task 2's `<action>` block had already been written with this finding folded in (the plan text explicitly says: "include this second branch only if plan 26-11's measured figure (3) is greater than zero... If 26-11 measured it as exactly zero across the archive, omit the branch"). Since the measured figure is 43 (not zero), **the second `noteText` branch was implemented, not omitted**: `breakdownSectionPlan` computes `unbucketedSec` unconditionally via `unbucketedCoveredSec(coverage, buckets.map((b) => b.timeSec))` and emits `'Bars below omit {duration} of covered time that produced no derivable pace.'` whenever `hasCoverage && buckets.length > 0 && unbucketedSec > 0` — covering all 43 partial-shortfall activities, not just the single bars-absent one. This is confirmed in code, not merely in the plan's prose: the "no-regression direction" test (`makeBucket` fixture whose `timeSec` sums exactly to `coveredSec`) asserts `noteText` is `null` only when `unbucketedSec` is exactly `0`, proving the `> 0` branch is reachable and would fire for any of the 43 activities.

**Disposition: implemented in scope, not deferred.** No follow-up plan is needed for this specific finding — it is fully addressed by this plan's Task 2.

## Files Created/Modified

- `src/dashboard/views/detail-sections.ts` — added `BreakdownSectionPlan` interface and `breakdownSectionPlan` export (the pure render decision); rewrote `buildBreakdownSection` to be a pure emitter over the returned plan (no `buckets.length`/`coverage`/`zoneTimes` conditional of its own); added a value import of `unbucketedCoveredSec` from `../../analytics/pace-derivation.js`; corrected the doc comment's return contract and removed the "always renders when there are buckets" framing
- `src/dashboard/views/detail-sections.test.ts` — imported `breakdownSectionPlan` and `PaceBucket`; added a `makeBucket` fixture builder; re-anchored the `coverageCaptionText` source-scan guard from `buildBreakdownSection` to `breakdownSectionPlan`; added a new describe block with 7 tests (2 from Task 1's RED pair, 5 boundary/no-regression cases from Task 2)

## Decisions Made

- The second `noteText` branch ("Bars below omit...") was included per plan 26-11's measured figure (3) = 43, not zero — see "Handling the wave-7 finding" above.
- `hasCoverage` is derived from `captionText !== null`, not a separately re-checked `spanSec > 0`, so "has coverage worth captioning" has exactly one definition (`coverageCaptionText`'s own contract) and the ternary narrows `coverage` for the compiler without a non-null assertion, per the plan's `<interfaces>` narrowing note.
- `unbucketedCoveredSec` is imported as a value from `pace-derivation.ts` rather than recomputed, per PACE-01's single-derivation rule and this plan's `key_links`.

## Deviations from Plan

None beyond the wave-7 finding disposition above, which the plan itself anticipated and instructed how to resolve conditionally on 26-11's measured figure. No Rule 1-4 deviations were needed — the plan's own instructions covered every situation encountered.

## Issues Encountered

- `npm run verify-dashboard` initially failed with 10/41 failures — all `data/stats/*.json` documents and `data/dashboard/index.json` were missing locally (gitignored, generated by `compute-all-stats`/`compute-dashboard-index`, not by this plan's source changes). Ran `npm run build`, `npm run compute-dashboard-index`, `npm run build-widgets`, then `npm run compute-all-stats` and `npm run build-widgets` again to regenerate them from already-committed `data/streams`/`data/activities`; `verify-dashboard` then passed 56/56. This regenerated `data/geo/geo-metadata.json`'s `generatedAt` timestamp as an unrelated side effect of running the gate commands — reverted via `git checkout -- data/geo/geo-metadata.json` before committing, since it is out of this plan's scope (Rule scope boundary: only auto-fix issues directly caused by the current task's changes).
- `npm run test` shows 1 pre-existing, unrelated failure (`trends-zoom-logic.test.ts`, missing `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` asset) — confirmed unrelated via `git diff --stat` (only `detail-sections.ts`/`.test.ts` touched) and consistent with the same class of pre-existing gap documented in `26-11-SUMMARY.md`'s "Next Phase Readiness" (which listed 7; after regenerating `data/stats`, only this one npm-install-asset gap remains — the `data/stats`-fixture-missing failures resolved themselves once the stats were regenerated for the verify-dashboard gate). Not fixed, out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `breakdownSectionPlan`'s always-on caption + honest note is ready for plan 26-13's human browser checkpoint to confirm on screen — Success Criterion 3's "always-on, not threshold-conditional" clause is now satisfied in code (D-08, COV-02).
- The regenerated local `data/dashboard/index.json` and `data/stats/*.json` (gitignored, not committed) remain in this worktree for plan 26-13's convenience if it needs a running `npm run curate`/dashboard server; they are NOT part of this plan's commit.
- One residual, unrelated test-infra gap for a future session: `trends-zoom-logic.test.ts` needs `node_modules/chartjs-plugin-zoom/dist/` present (currently absent from a clean `npm install` in this worktree) — pre-existing, out of scope.

## Self-Check

- `npx vitest run src/dashboard/views/detail-sections.test.ts` — 95/95 passing
- `npx vitest run src/dashboard/views/detail-sections.test.ts -t "always-on coverage caption"` — 7/7 passing
- `npx tsc --noEmit` — clean (exit 0)
- `npm run build-widgets` — exit 0
- `npm run verify-dashboard` — 56/56 checks passed, exit 0
- `npm run test` — 1841/1841 passing, 1 pre-existing unrelated failure (`trends-zoom-logic.test.ts`, missing node_modules asset)
- `grep -c "always renders when there are buckets" src/dashboard/views/detail-sections.ts` → `0`
- `grep -c "11865310195" src/dashboard/views/detail-sections.ts` → `3`; `grep -c "CR-01" src/dashboard/views/detail-sections.ts` → `5`
- `grep -c "No pace buckets — " src/dashboard/views/detail-sections.ts` → `1`
- `grep -c "No HR data\|coming soon\|Not available" src/dashboard/views/detail-sections.ts` → `0`
- Pure-emitter regex (post-fix) → `null` (no decision tokens in `buildBreakdownSection`'s own body); same regex against pre-fix HEAD → `["buckets.length","zoneTimes ===","buckets.length","coverage !==","zoneTimes !=="]` (non-vacuous, matches the plan's predicted 5-match measurement exactly)
- `git diff --stat src/dashboard/views/detail.ts src/dashboard/views/detail-zones.ts` → empty
- Commit `8026cb4b` confirmed via `git log --oneline -1`

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Plan: 12*
*Completed: 2026-09-09*
