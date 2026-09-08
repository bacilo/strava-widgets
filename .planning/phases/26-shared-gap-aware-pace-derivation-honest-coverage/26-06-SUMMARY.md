---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 06
subsystem: ui
tags: [detail-view, coverage-disclosure, gap-marking, vitest, dom-builder]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "derivePaceWithCoverage/PaceCoverage/GapInterval (26-02, cross-plan integration repair) and detail.ts's single per-render derivation call feeding the histogram (26-04)"
provides:
  - "coverageCaptionText(coverage) — the D-08/COV-02 always-on Pace Distribution caption, sourced from the same PaceCoverage the histogram consumes"
  - "splitGapAnnotations(splits, gapIntervals) — the D-09/PACE-05 per-split gap-overlap accumulator consumed by buildSplitsSection's inline marker and legend"
  - "Verified checkpoint activity 10198771331 (km 11, 11:29 legend) for plan 26-10's split-marker browser row"
affects: [26-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dominant-kind selection for mixed-category split overlaps: when a split's window crosses both a recording-gap and a pause segment, the larger accumulated duration names the single category the marker/legend copy states (ties favour recording-gap); the underlying SplitGapAnnotation still carries both counts separately"
    - "Source-text wiring guard (stripComments + countOccurrences, curation-seam.test.ts's idiom) proves a pure helper is called exactly once from the expected function, without any DOM-simulation library"

key-files:
  created:
    - src/dashboard/views/detail-sections.test.ts
  modified:
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail.ts
    - .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-VALIDATION.md

key-decisions:
  - "Mixed-kind split overlaps (a window crossing both a recording-gap and a pause segment) are named by whichever category contributes more seconds — a tie favours recording-gap — since the UI-SPEC's copy contract states exactly one category per marker/legend line, but the underlying SplitGapAnnotation always retains both counts separately so no information is discarded, only the DISPLAYED label is chosen."
  - "Selected real activity 10198771331 (the planning-time candidate, already pinned as pace-fixtures.ts's gap-crossing-split) for plan 26-10's row 2 checkpoint: it flags exactly km 11 with a 689s (11:29) total overlap (688s recording-gap + 1s pause boundary noise), verified directly against derivePaceWithCoverage + computeSplits + splitGapAnnotations rather than assumed from the plan's own interfaces table."

requirements-completed: [COV-02, PACE-05]

# Metrics
duration: ~55min
completed: 2026-09-08
---

# Phase 26 Plan 06: Coverage Caption and Split Gap Marking Summary

**An always-on `{covered}%/{recordingGap}%/{pause}%` caption under Pace Distribution and an inline `⚠` marker plus per-split legend line on any gap-crossing split, both sourced from the one shared `derivePaceWithCoverage` result the histogram already consumes.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 extended, 1 created)

## Accomplishments

- `coverageCaptionText(coverage: PaceCoverage): string | null` renders D-08's always-on caption — all three named segments (covered/recording gaps/paused), independently `Math.round`ed, joined by a middle-dot, never forced to sum to 100 — returning `null` only on a non-positive span so `buildBreakdownSection` appends nothing rather than a nonsensical line.
- `splitGapAnnotations(splits, gapIntervals): SplitGapAnnotation[]` intersects each split's own `[startTimeSec, endTimeSec]` window against the shared derivation's `gapIntervals`, accumulating overlapping seconds per `kind` and emitting an entry only when the split's total overlap is positive — consuming gap classification from `pace-derivation.ts` rather than recomputing it, per PACE-01's single-derivation guarantee.
- `buildBreakdownSection` takes `coverage: PaceCoverage | null` as its new second argument and appends the caption immediately after the `Pace Distribution` heading, before the histogram bars.
- `buildSplitsSection` takes an optional third `gapAnnotations` argument (default `[]`, so every existing call site not yet updated stays behaviourally unchanged); a flagged split's Pace cell gains an `aria-hidden` `⚠` marker span plus an `aria-label` naming the amount and category, and a `<ul class="text-label">` legend is appended after `.splits-scroll` listing one line per flagged split — present only when at least one split is flagged. No eighth column, no new CSS class, no change to any split's own pace arithmetic.
- `detail.ts` now computes `derivePaceWithCoverage` once and feeds all three downstream consumers from that single result: the histogram buckets (unchanged from plan 26-04), the coverage caption, and `splitGapAnnotations(splits, derived.coverage.gapIntervals)` passed into `buildSplitsSection`.
- Verified real activity `10198771331` (fēnix 6 Pro FIT, span 5225s, distance 11169m — the planning-time candidate, already pinned in `pace-fixtures.ts` as `gap-crossing-split`) flags exactly **km 11**, with a 689s total overlap (688s recording-gap + 1s pause boundary) — legend `"Km 11: includes 11:29 of recording gap"`, marker cell `"18:38/km ⚠"` — resolving plan 26-10's previously-open checkpoint row with an automated assertion rather than a vacuous placeholder.
- Pre-computed the pinned worked example (`4556693525`) caption for plan 26-10's human checkpoint to read back: `"99% of elapsed time covered · 1% recording gaps · 0% paused"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the coverage caption and split gap marking as pure helpers plus DOM wiring** - `97e01155` (feat)
2. **Task 2: Create detail-sections.test.ts, stage negative case 4, and select the checkpoint activity** - `ec01c2ca` (test) — includes the `26-VALIDATION.md` row updates

**Plan metadata:** commit pending (this SUMMARY, executed by the orchestrator after wave merge in worktree mode)

## Files Created/Modified

- `src/dashboard/views/detail-sections.ts` — added `coverageCaptionText`, `SplitGapAnnotation`, `splitGapAnnotations`, and the private `dominantGapKindLabel` helper near the top of the file (logic, not markup); extended `buildBreakdownSection`'s signature with a `coverage` second argument; extended `buildSplitsSection`'s signature with an optional `gapAnnotations` third argument and its inline marker/legend rendering.
- `src/dashboard/views/detail.ts` — imports `splitGapAnnotations`; reordered the `derivePaceWithCoverage` call ahead of `buildSplitsSection` so its `coverage.gapIntervals` can feed the splits annotation call; `buildBreakdownSection` now receives `derived.coverage` as its second argument. `computeSplits(detail.stream)` and the `paceSecPerKm` argument are byte-unchanged (D-17, plan 26-08's own scope).
- `src/dashboard/views/detail-sections.test.ts` (new, 84 tests) — direct unit tests for both pure helpers (coverage caption at 0%/non-forced-sum/null-span/pinned-worked-example; split annotation km/kind attribution, partial overlap, mixed-kind accumulation, ordering, the real `10198771331` activity), the two-directional negative case 4, and source-wiring guards (`stripComments`/`countOccurrences`, no DOM builder invoked, matching `curation-seam.test.ts`'s idiom for the node-environment vitest project convention).
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-VALIDATION.md` — filled in Task ID/File Exists/Status for the PACE-05 and COV-02 rows this plan closes; corrected the split-marker Manual-Only Verifications row's stale "8-column" wording to 7 columns and replaced its unresolved activity placeholder with the selected id, flagged km, and exact legend string; added the pre-computed worked-example caption to the coverage-caption row.

## Decisions Made

- **Mixed-kind split overlaps** (a window crossing both a recording-gap and a pause segment — the real `10198771331` km 11 case, with 688s recording-gap + 1s pause) are named by whichever category contributes more seconds (ties favour `recording-gap`), since the UI-SPEC's copy contract states exactly one category per marker `aria-label`/legend line. The underlying `SplitGapAnnotation` always retains `recordingGapSec` and `pauseSec` separately — only the single DISPLAYED label is chosen, no data is discarded.
- Selected `10198771331` (the planning-time candidate named in this plan's own `<interfaces>` and already pinned in `pace-fixtures.ts`) as plan 26-10's checkpoint activity, rather than one of the two backups, since it produced exactly one flagged split on the first try and its gap fraction (688/5225 = 13.2% of span) makes it a legible discriminator.

## Deviations from Plan

None — plan executed exactly as written. The one design choice not explicit in the plan text (mixed-kind dominant-label selection) is documented above as a Decision, since the plan's copy contract left it unstated and this was the only real activity fixture encountered where both categories were simultaneously non-zero.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced. Both helpers are pure and fully wired into `detail.ts`'s render path.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. Both new elements render entirely from data already returned by `derivePaceWithCoverage` and `computeSplits`, matching this plan's own threat register (T-26-01/T-26-02/T-26-12/T-26-13, all disposition `mitigate`, all satisfied: neither helper throws on malformed input, percentages are never coerced or force-summed, the caption reads from the one shared derivation result, and the `⚠` glyph is always `aria-hidden` and paired with a text equivalent).

## Issues Encountered

None. A scratch probe test file (`src/analytics/_probe.test.ts`) was used during execution to independently re-derive the checkpoint activity's flagged km/duration and the worked example's caption percentages before writing the permanent test assertions and the `26-VALIDATION.md` row — it was deleted before committing and is not part of the shipped diff.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 26-10's split-marker checkpoint row (D-09/PACE-05) is no longer vacuous: activity `10198771331`, km 11, marker text `"18:38/km ⚠"`, legend line `"Km 11: includes 11:29 of recording gap"` are all pinned by an automated, permanent assertion in `detail-sections.test.ts`, not merely stated in prose.
- Plan 26-10's coverage-caption checkpoint row (D-08/COV-02) has a pre-computed expectation for the pinned worked example (`4556693525`): `"99% of elapsed time covered · 1% recording gaps · 0% paused"`.
- `buildSplitsSection`'s `gapAnnotations` parameter defaults to `[]`, so any other call site in the codebase that has not yet been updated to pass real annotations renders identically to before this plan — no silent behavioural change outside `detail.ts`'s own updated call site.
- Plan 26-08 (D-13 rebase of the `vs. Avg` baseline) is unblocked: this plan left `computeSplits(detail.stream)` and the `activityAvgPaceSecPerKm`/`paceSecPerKm` argument to `buildSplitsSection` byte-unchanged, exactly as its own scope boundary required.
- Pre-existing unrelated test failures persist unchanged in this fresh worktree (missing gitignored `data/dashboard/index.json`/`data/stats/*.json` compute artifacts): `scripts/compute-pace-residual.test.mjs`, `scripts/verify-dashboard-publish-stats.test.mjs`, `scripts/verify-dashboard-publish-guard.test.mjs` (4 sub-tests), `records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`, `trends-zoom-logic.test.ts` — none touch this plan's files. `npx tsc --noEmit` exits 0, `npm run build-widgets` exits 0, and `grep -c "pace-warning\|gap-badge" src/dashboard/styles.css` is `0`.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*
