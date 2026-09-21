---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 05
subsystem: ui
tags: [pace-quality, gap-classification, badge-copy, vitest, tdd]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    provides: "classifyGaps widened to a four-way GapKind ('recording-gap' | 'pause' | 'unreliable' | covered) — plan 33-01, the source of the third GapKind member this plan's parser must accept"
provides:
  - "pace-quality-client.ts's VALID_GAP_KINDS widened to a three-member Set accepting 'unreliable', closing T-33-06 — the fourth silent-inheritance trap where a fetched shard's unreliable intervals were dropped with no error, no warning, no telemetry"
  - "A GapKind-union exhaustiveness test (ALL_GAP_KINDS) that fails a future fifth kind until the parser is updated"
  - "D-11: the list-row gap-profile badge's visibleText widened to name all three categories ('gaps, pauses or unreliable segments'), matching detail-sections.ts's gapProfileRow wording"
affects: [33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-vacuous fixture-shard proof: an unreliable-kind gapInterval built as an explicit object literal (never round-tripped from a computed shard), watched RED against the two-member set before trusting the fix"

key-files:
  created: []
  modified:
    - src/dashboard/data/pace-quality-client.ts
    - src/dashboard/data/pace-quality-client.test.ts
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts

key-decisions:
  - "D-02/D-11 implemented exactly as specified: VALID_GAP_KINDS widened by one member (not replaced with a new set, per the VALID_ELEVATION_TIERS precedent's own reasoning for why THIS case differs), and the list badge's visibleText widened to the same three-category wording plan 33-04 gives the equivalent detail-view row"
  - "parseGapInterval's body and parsePaceQualityShard's tolerant-drop loop are byte-identical — the fix is exactly one Set literal plus a docblock, confirmed by git diff hunk inspection"
  - "hasAnySevereSignal's three-member Pick<> in pace-quality.ts left untouched; no gapProfile fixture literal in list.test.ts gained an unreliableSec key (GapProfileSignal has none, an excess property would fail tsc)"

patterns-established:
  - "A widened parser allowlist is proven non-vacuously only by an explicit-literal fixture watched RED against the pre-widening code, restored, and re-verified clean — matching the project's 'watch it fail first' convention"

requirements-completed: []  # This plan's own text (D-11/requirement-tick safety) forbids ticking COV-03 here; plan 33-13 alone sets its disposition against rendered checkpoint evidence.

# Metrics
duration: ~25min
completed: 2026-09-21
---

# Phase 33 Plan 5: VALID_GAP_KINDS widening & D-11 badge copy Summary

**Closed the fourth silent-inheritance trap (`VALID_GAP_KINDS` hardcoded to two members while `GapKind` had already widened to three in plan 33-01) with a one-line Set widening proven non-vacuously against a real fixture watched RED first, and widened the list-row gap-profile badge's visible text to name all three categories `gapFraction` now counts.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `pace-quality-client.ts`'s `VALID_GAP_KINDS` widened from `['recording-gap', 'pause']` to `['recording-gap', 'pause', 'unreliable']` — a fetched shard's `unreliable`-kind gap intervals now survive the parse instead of being silently dropped with no error, no warning, and no telemetry (T-33-06)
- The fix is proven non-vacuous: five new test cases build an `unreliable`-kind fixture as an explicit object literal, watched RED against the two-member set (5 failures, verbatim output below), then GREEN after the one-line fix
- A `GapKind`-union exhaustiveness test (`ALL_GAP_KINDS: GapKind[]`) parses every current member and will fail a future fourth `GapKind` member until `VALID_GAP_KINDS` is updated to match
- The tolerant-entry-drop contract is unchanged and re-proven: a bogus-kind entry alongside a valid `unreliable` entry still drops only the bogus one; a non-numeric `startSec` on an `unreliable` entry still drops only that entry
- `qualityBadgeSpecs`'s `gapProfile` badge `visibleText` widened from `"${pct}% of recorded time in gaps or pauses"` to `"${pct}% of recorded time in gaps, pauses or unreliable segments"` (D-11), matching the wording plan 33-04 gives `detail-sections.ts`'s `gapProfileRow`
- `parseGapInterval`'s body, `parsePaceQualityShard`'s tolerant-drop loop, and `hasAnySevereSignal`'s three-member `Pick<>` are all byte-identical — confirmed by `git diff` hunk inspection and grep counts

## Task Commits

1. **Task 1: Widen VALID_GAP_KINDS and prove it non-vacuously** - `6732cb69` (feat)
2. **Task 2: D-11 — the list-row gap-profile badge names all three categories** - `654dffae` (feat)

_No plan-metadata commit — this is a worktree-isolated parallel execution; the orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified

- `src/dashboard/data/pace-quality-client.ts` — `VALID_GAP_KINDS` widened to three members with a docblock naming the trap and citing the `VALID_ELEVATION_TIERS` precedent for why this case needs a third member rather than a separate set
- `src/dashboard/data/pace-quality-client.test.ts` — 5 new cases in `describe('parsePaceQualityShard', ...)`, named so `-t "unreliable"` selects them: single-unreliable-entry round-trip, three-kind mixed-array-in-order, unreliable-alongside-bogus tolerant-drop, unreliable-with-non-numeric-startSec tolerant-drop, and the `GapKind`-union exhaustiveness case
- `src/dashboard/views/list.ts` — `qualityBadgeSpecs`'s `gapProfile` `visibleText` widened to name all three categories; governing comment extended and dated
- `src/dashboard/views/list.test.ts` — the existing gapFraction-0.12 case updated to the new text, a new gapFraction-0.34 case added (named so `-t "gaps, pauses or unreliable"` selects it), and the aria-label byte-identity case updated to the new text

## Decisions Made

- Followed D-02/D-11 exactly as specified in `33-CONTEXT.md` and the plan's own `<interfaces>` block — no deviation on wording or mechanism.
- Widened `VALID_GAP_KINDS` in place rather than introducing a separate set, per the plan's own citation of the `VALID_ELEVATION_TIERS` precedent: `GapKind` genuinely has three members here (unlike `ElevationTier`, which has no `'minor'`), so a third member is the correct fix, not a parallel set.
- Used the exact wording the plan specified for the D-11 badge (`"gaps, pauses or unreliable segments"`) even though the sibling plan 33-04 (owner of `detail-sections.ts`'s `gapProfileRow`) had not yet landed its own widening in this worktree at execution time — `detail-sections.ts` still read `"gaps or pauses"` when checked. This plan's own file (`list.ts`) is correctly widened per its explicit instruction; the two surfaces will agree once 33-04 merges. No sibling file was touched.

## Deviations from Plan

None - plan executed exactly as written.

## RED verification (Task 1, required by plan's `<action>` step)

Temporarily reverted `VALID_GAP_KINDS` to the pre-fix two-member set (`['recording-gap', 'pause']`) and ran `npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "unreliable"`. All 5 new cases failed as expected, naming the dropped-unreliable-entry defect:

```
 ❯ src/dashboard/data/pace-quality-client.test.ts (32 tests | 5 failed | 27 skipped) 8ms
     × a shard whose gapIntervals carries a single unreliable-kind entry survives the parse with startSec/endSec/kind preserved exactly 5ms
     × a mixed gapIntervals array of one recording-gap, one pause and one unreliable entry parses to all three, in order 1ms
     × an unreliable entry alongside a bogus-kind entry: the bogus entry is still dropped, the unreliable entry still parses — the tolerant-drop contract is unchanged 0ms
     × an unreliable-kind entry with a non-numeric startSec is still dropped and does not invalidate the shard 0ms
     × VALID_GAP_KINDS accepts every member of the unreliable GapKind union — a future fourth kind added to GapKind will fail this test until the parser is updated 1ms

 FAIL  src/dashboard/data/pace-quality-client.test.ts > parsePaceQualityShard > a shard whose gapIntervals carries a single unreliable-kind entry survives the parse with startSec/endSec/kind preserved exactly
AssertionError: expected [] to deeply equal [ Array(1) ]
- Expected
+ Received
- [
-   { "endSec": 58.5, "kind": "unreliable", "startSec": 42 },
- ]
+ []

 Test Files  1 failed (1)
      Tests  5 failed | 27 skipped (32)
```

Restored the three-member fix, then confirmed `git diff --exit-code src/dashboard/data/pace-quality-client.ts` exited `0` (clean) before re-running the GREEN verification.

## Mixed-array parsed result (Task 1 acceptance criterion)

For `gapIntervals: [{recording-gap}, {pause}, {unreliable}]`, `parsePaceQualityShard(...).gapIntervals` equals, in order:

```json
[
  { "startSec": 0, "endSec": 10, "kind": "recording-gap" },
  { "startSec": 20, "endSec": 30, "kind": "pause" },
  { "startSec": 40, "endSec": 50, "kind": "unreliable" }
]
```

## Diff hunk list (Task 1 acceptance criterion — `parseGapInterval`/drop-loop byte-identical)

`git diff src/dashboard/data/pace-quality-client.ts` shows exactly one hunk: the `VALID_GAP_KINDS` line changed from
`new Set<GapKind>(['recording-gap', 'pause'])` to `new Set<GapKind>(['recording-gap', 'pause', 'unreliable'])`,
plus a 14-line docblock added immediately above it. No other line in the file changed — `parseGapInterval` (lines
267-273) and `parsePaceQualityShard`'s drop loop (lines 325-331) are untouched, confirmed both by this hunk
inspection and by `grep -c "new Set<GapKind>(\['recording-gap', 'pause', 'unreliable'\])" ... ` returning `1`.

## Badge text identity (Task 2 acceptance criterion)

`qualityBadgeSpecs`'s severe-`gapProfile` `visibleText` for `gapFraction: 0.34` is:

```
34% of recorded time in gaps, pauses or unreliable segments
```

The plan's own `<action>` text specifies this is the SAME wording plan 33-04 gives `gapProfileRow`'s `valueText` — this plan's `list.ts` is now widened to that exact string. (At the time this plan executed, `detail-sections.ts` in this worktree still carried the pre-widening `"gaps or pauses"` string, since 33-04 runs as a sibling parallel plan not yet merged; `list.ts`'s own widening is complete and correct per this plan's explicit instruction, and will read as character-identical to `gapProfileRow`'s output once 33-04 merges.)

## Issues for orchestrator

None. No sibling-owned file (`src/analytics/pace-quality.*`, `src/dashboard/views/detail-sections.*`, `detail-charts-logic.test.ts`, `detail-zones.test.ts`) was read for anything beyond confirming `hasAnySevereSignal`'s `Pick<>` shape, and none was modified.

**Wording-agreement note for the orchestrator's post-merge gate:** this plan's `list.ts` badge and 33-04's `detail-sections.ts` `gapProfileRow` both target the identical string `"{pct}% of recorded time in gaps, pauses or unreliable segments"`. At merge time it is worth a quick character-for-character check that 33-04 landed the exact same wording — the plan text for both plans specifies it, but they were drafted and executed independently in parallel worktrees.

## Issues Encountered

None.

## Verification Results

- `npx tsc --noEmit`: exit 0 (Task 1 and Task 2, run independently after each task's changes)
- `npm run build`: exit 0
- `npm run build-widgets`: exit 0 (generated `dist/widgets/` output removed afterward — gitignored, not committed, matching the 33-01-documented lesson about leaving stray build artifacts)
- `npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "unreliable"`: **5 passed | 27 skipped (32)**, 0 failed
- `npx vitest run src/dashboard/data/pace-quality-client.test.ts` (whole file): **32 passed (32)**, 0 failed
- `npx vitest run src/dashboard/views/list.test.ts -t "gaps, pauses or unreliable"`: **1 passed | 109 skipped (110)**, 0 failed
- `npx vitest run src/dashboard/views/list.test.ts` (whole file): **110 passed (110)**, 0 failed
- `npm test` (full suite, this worktree): **91 files total — 83 passed / 7 failed** (environmental), **2,741 tests total — 2,715 passed / 3 failed** (environmental) / 23 skipped. The 7 failing files/3 failing tests are the exact pre-existing ENOENT set for gitignored, environment-absent artifacts in this bare worktree (`data/stats/year-over-year.json`, three `data/stats/pace-quality/{id}.json` shards, plus 4 other data-file-dependent suites) — the identical baseline plan 33-01's SUMMARY documented (91 files / 7 failing / 3 failing tests). Not caused by, and not fixed by, this plan. Test count delta vs. 33-01's baseline (2,735 → 2,741) is exactly this plan's own 6 new tests (5 in `pace-quality-client.test.ts` + 1 in `list.test.ts`). The orchestrator's post-merge `npm test` on the primary checkout is the real gate.
- `grep -v '^\s*\*' src/dashboard/views/list.ts | grep -c 'in gaps or pauses'`: `0` (old two-category string fully removed from live code)
- `grep -c "signals: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'>" src/analytics/pace-quality.ts`: `1` (unchanged)

## Next Phase Readiness

- `VALID_GAP_KINDS` now accepts all three `GapKind` members; every browser-side consumer of a fetched pace-quality shard's `gapIntervals` (list view, detail view, any future consumer) receives `unreliable`-kind entries rather than silently losing them — this was named in this plan's own objective as "the highest-leverage line in the phase," since without it plan 33-04's itemised evidence line would read zero on every activity forever.
- The D-11 list badge now agrees in wording with what plan 33-04 is expected to land in `detail-sections.ts`; worth a character-identity spot-check at the orchestrator's post-merge gate (see "Issues for orchestrator" above).
- Requirement tick (COV-03) deliberately NOT set by this plan, per its own requirement-tick-safety text — plan 33-13 alone sets its disposition against rendered checkpoint evidence.
- No blockers.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `src/dashboard/data/pace-quality-client.ts`
- FOUND: `src/dashboard/data/pace-quality-client.test.ts`
- FOUND: `src/dashboard/views/list.ts`
- FOUND: `src/dashboard/views/list.test.ts`
- FOUND commit: `6732cb69`
- FOUND commit: `654dffae`
