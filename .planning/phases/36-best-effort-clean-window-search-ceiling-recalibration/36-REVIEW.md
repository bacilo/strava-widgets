---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
reviewed: 2026-11-24T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - scripts/compute-ceiling-recalibration.mjs
  - scripts/compute-ceiling-recalibration.test.mjs
  - scripts/compute-clean-window-diff.mjs
  - scripts/compute-clean-window-diff.test.mjs
  - scripts/compute-clean-window-recount.mjs
  - scripts/compute-clean-window-recount.test.mjs
  - scripts/curate-queue/derive-flagged.test.mjs
  - scripts/unreliable-segment-import-guards.test.mjs
  - src/analytics/best-effort-fixtures.test.ts
  - src/analytics/best-effort-utils.test.ts
  - src/analytics/best-effort-utils.ts
  - src/analytics/best-effort.types.ts
  - src/analytics/ceiling-state-write-gate.test.ts
  - src/analytics/clean-window-archive.test.ts
  - src/analytics/compute-age-grading.test.ts
  - src/analytics/compute-best-efforts.test.ts
  - src/analytics/compute-best-efforts.ts
  - src/analytics/compute-dashboard-index.test.ts
  - src/analytics/effort-guard-homes.test.ts
  - src/analytics/pace-single-source.test.ts
  - src/compute-all-stats-steps.test.ts
  - src/compute-all-stats-steps.ts
  - src/dashboard/data/best-efforts-client.test.ts
  - src/dashboard/data/best-efforts-client.ts
  - src/dashboard/styles.css
  - src/dashboard/views/detail-best-efforts-logic.test.ts
  - src/dashboard/views/detail-best-efforts-logic.ts
  - src/dashboard/views/detail-sections.test.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/views/records-logic.test.ts
  - src/dashboard/views/records-logic.ts
  - src/dashboard/views/records.test.ts
  - src/dashboard/views/records.ts
  - src/index.ts
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-11-24
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

I reviewed the diff `ebe0245c..HEAD` across the 35 scoped files. This covers the clean-window search in `compute-best-efforts.ts`, the bounded `findBestEffort`, the `--write-ceiling-state` gate, the dashboard surfaces (client parse, detail badge, Records notes) and the three PR-09 generator and recount scripts.

The core search is sound. I traced `complementSubIntervals`' `+ 1` boundary, `segmentsIntersectingWindow`'s half-open pair overlap and the bounded sweep's `lo`/`hi` limits by hand. They agree with the detector's pass-3 convention, and a Branch-2 clean window cannot reach a segment pair. The ceiling write gate is tested in both directions inside `mkdtemp` directories, and no test writes to a tracked file. The import guard intercepts `fs` through a module mock rather than `vi.spyOn`, so named imports are observed.

The defects are in the **signed PR-09 artifact generator** and in the **contract that a contaminated effort ranks**:

- **Generator.** `compute-clean-window-diff.mjs` rebuilds the pre-phase state without applying the pre-phase ceiling. The "old" top-10s, the "Reinstated: 0 ceiling" figure and the moved-but-ranked population in `36-DIFF.md` therefore describe a ranking that never shipped.
- **Ranking contract.** Several components assume "contaminated ⇒ ranked, demotion null": the shipped detail-view badge, the Records note and the recount's "two-homes" invariant. The writer (`compute-best-efforts.ts`) does not guarantee this. For owner-excluded efforts the badge is wrong on today's data: 39 efforts.

**On the excluded-effort divergence the checkpoint recorded:** the Records-screen behaviour is correct and disclosed. `countContaminatedAtDistance` and `countDemotedAtDistance` both skip `excludedFromRecords === true`, with the reason in their docblocks (D-10), and an owner-excluded effort does not rank, so it cannot "rank on a clean window". The defect is on the `36-DIFF.md` side. `classifyEffortChanges` never reads `excludedFromRecords`, yet labels its buckets "still ranked" and "ranked before, not ranked after". Its own `buildRankChanges` *does* filter exclusions, and the artifact never mentions exclusion. The divergence is an undisclosed labelling defect in the diff (WR-01), not a defect in the screen.

## Critical Issues

### CR-01: The diff's OLD state never applies the pre-phase ceiling. Its "old" rankings, its "0 ceiling reinstatements" and its moved-but-ranked population describe a state that never shipped

**File:** `scripts/compute-clean-window-diff.mjs:186-249, 285-331, 918-940`. The reconstruction it imports is in `scripts/compute-ceiling-recalibration.mjs:183-230`.

**Issue:**
- **The reconstruction never assigns a ceiling demotion.** `reconstructOldEfforts` only recomputes the absolute guards and is documented to never emit `'ceiling'`.
- **`main()` derives the old ceiling but never uses it.** It computes `oldCeilings = deriveCeilings(oldPopulations)` (line 923) but only uses it for the ceiling *table*. It never runs `ceilingDemotion` over `oldEfforts`.
- **Production did apply the ceiling before ranking.** It ranked only ceiling survivors (`compute-best-efforts.ts`, Pass 3: `rankTopN(survivors)`).

Three consequences follow, none of them disclosed in `36-DIFF.md`:

1. **The "Old" columns of `## Rank Changes` list efforts that were never ranked.** The pre-phase committed 400m ceiling is 5.1098 m/s, so any 400m effort under 400/5.1098 = 78.28 s was ceiling-demoted. Eight of the ten "old" 400m rows (66.3, 66.4, 66.9, 68.9, 71.0, 77.9, 78.2, 78.2 s) are below that. The 1mi rows 287.0, 339.0, 342.9 and 347.6 s are below 1609.344/4.6281 = 347.7 s.
2. **`splitReinstatements` can never return a ceiling row.** The `ceiling` bucket is structurally unreachable on real input. Its only test (`compute-clean-window-diff.test.mjs:227-236`) feeds a synthetic `oldGuard: 'ceiling'` row, so the test passes against a population the real pipeline cannot produce. I re-ran it against the current `data/stats/best-efforts.json` and the committed pre-phase `data/best-effort-ceiling.json` at `ebe0245c`. **15** non-excluded efforts pass the old absolute guards, exceeded the old ceiling, and now rank (400m 7, 1k 5, 1mi 3). Those are ceiling reinstatements. The diff files them under "Moved but still ranked", and the artifact states "Reinstated: 31 (31 absolute-guard, 0 ceiling)".
3. **`36-VALIDATION.md:265` records that the developer signed on these figures** ("reinstated 31 = 31 absolute-guard + 0 ceiling"). PR-09's sign-off is bound to a document that misstates the before-state.

Legs 1 and 2 share this generator, and leg 3 (the recount) does not reconstruct the OLD state at all. None of the three legs could catch this.

**Fix:** Apply the old ceiling to the reconstruction before classifying or ranking, using the shipped constructor rather than a second rule:
```js
import { ceilingDemotion } from '../dist/analytics/best-effort-ceiling.js';
// in main(), after oldCeilings = deriveCeilings(oldPopulations):
for (const old of oldEfforts) {
  if (old.demotion !== null) continue;            // absolute guards take precedence
  const d = ceilingDemotion(old.impliedSpeedMps, oldCeilings[old.distance]);
  if (d) old.demotion = d;                        // covers excluded efforts too (CR-01 sweep parity)
}
```
`buildPopulations({ useOld: true })` currently throws on a `'ceiling'` guard. Run it **before** this pass, or relax that assertion. Then add a test on a real activity/distance pair from the 15 above that asserts `splitReinstatements(...).ceiling.length > 0`. Regenerate `36-DIFF.md` and reopen the PR-09 sign-off.

## Warnings

### WR-01: `classifyEffortChanges` ignores `excludedFromRecords`, so the diff's "still ranked" and "newly demoted" counts include efforts that never rank

**File:** `scripts/compute-clean-window-diff.mjs:186-249` (contrast `:291`)

**Issue:** The docblock defines MOVED-BUT-RANKED as "the effort ranks both before and after" and NEWLY DEMOTED as "ranked before, not ranked after". An owner-excluded effort ranks in neither state. The classifier still puts it in both buckets, because it only compares `demotion` values. On current data, 39 contaminated efforts are owner-excluded and 15 demoted efforts are owner-excluded.

The same file's `buildRankChanges` does skip `old.excludedFromRecords` (line 291), so the artifact is internally inconsistent. `36-DIFF.md` never mentions exclusion. This is the source of the Records-screen vs diff divergence the checkpoint recorded. The Records screen is the correct side (see Summary).

**Fix:** Add an `excluded` kind, checked first, or skip excluded efforts with a stated count. Render that count in the headline ("N owner-excluded efforts omitted from the four populations") so the artifact and the Records screen reconcile on a disclosed difference.

### WR-02: "Contaminated ⇒ ranked, demotion null" is asserted in three components but not guaranteed by the writer

**File:** `src/analytics/compute-best-efforts.ts:470-498, 798-806`; `scripts/compute-clean-window-recount.mjs:542-560`; `src/dashboard/views/detail-best-efforts-logic.ts:259-277`

**Issue:** There are two ways an effort ends up with both `contaminated` and `demotion` set:
- In Branch 2, `computeActivityEfforts` sets `demotion: demotionFromPlausibility(...)` when the **clean** figure fails `isPlausible`, together with `contaminated: contaminationRecord(...)`.
- Pass 3's ceiling loop sets `effort.demotion = ceilingDemotion(...)` on any `byDistance` survivor, including Branch-2 efforts, and never clears `contaminated`.

Three components contradict this:
- `checkInternalConsistency` (recount) reports `contaminated + demotion` as a "two-homes rule" violation, so a legitimate document would fail leg 3.
- `prFlagBadgeSpecs`' docblock states `demotion` "is `null` for every moved (contaminated-but-ranked) effort".
- `ComputedEffort.contaminated`'s docblock states "it ranks normally".

The overlap is 0 on today's archive. Any Branch-2 clean window faster than the new ceiling triggers it, and the ceiling moves nightly. The memory note "guards must assert vs an independent value" applies here: the recount enforces an invariant the producer never promised.

**Fix:** Pick one contract and enforce it at the writer:
- either document "contaminated describes which window was measured; demotion is independent" and drop the recount's two-homes check for non-`unreliable-segment` guards (keep it only for `guard === 'unreliable-segment' && contaminated != null`),
- or make it impossible by construction, with a `compute-best-efforts.test.ts` case where a Branch-2 clean figure exceeds the ceiling.

Then fix WR-03 and WR-04 to match.

### WR-03: The detail-view badge says "Ranked on clean window" on efforts that do not rank (39 owner-excluded efforts today)

**File:** `src/dashboard/views/detail-best-efforts-logic.ts:299-309`

**Issue:** The `contaminated` spec fires on `row.contaminated` alone. Its visible text is `Ranked on clean window — …` and its sr-only explanation is "the ranked time excludes an unreliable segment". The badge appears whether or not the row is excluded or demoted.

On current data, 39 contaminated efforts carry `excludedFromRecords: true`. Each of them renders "Ranked on clean window" next to "Excluded from records" in the same cell, which is a direct contradiction. Any WR-02 contaminated+demoted effort would render "Ranked…" beside "Demoted…".

`detail-best-efforts-logic.test.ts:320` and `:479-492` assert the contaminated, demoted and excluded flags together and the badge order, so the tests certify the contradictory copy instead of catching it.

**Fix:** Make the visible text state the machine observation without claiming rank, e.g. `Measured on clean window — {reason}`. Alternatively, condition the word on `!row.excluded && !row.demoted`. Add a test asserting that an excluded or demoted contaminated row's badge text does not contain "Ranked".

### WR-04: The Records contamination note counts demoted efforts as "rank on a clean window"

**File:** `src/dashboard/views/records-logic.ts:388-405, 418-430`

**Issue:** `countContaminatedAtDistance` skips owner-excluded efforts but not `effort.demotion != null`. A contaminated effort carrying a ceiling or absolute-guard demotion (WR-02) is counted twice. `countDemotedAtDistance` counts it as demoted, and `resolvePrTableContaminationNote` says it "rank[s] on a clean window". The docblock itself says the two counts "describe two different populations" and must never overlap. It is 0 today, and reachable by the code as written.

**Fix:**
```ts
if (effort.excludedFromRecords === true) continue;
if (effort.demotion != null) continue; // a demoted effort does not rank (D-16 disjointness)
if (effort.contaminated != null) count++;
```
Add a test with a contaminated + ceiling-demoted effort asserting the count excludes it.

## Info

### IN-01: The recount's per-window floor (control p75) was chosen against the population it judges

**File:** `scripts/compute-clean-window-recount.mjs:91-105, 141-153`

**Issue:** The first run failed (190/1627), and the floor moved from p95 to the strictest percentile with zero failures on the live contaminated set. The docblock says it is "not a value chosen after the fact to force a pass", but selecting by outcome is exactly that. At p75, 25% of genuinely clean windows also clear the bar, so a mislabelled window has a 1-in-4 chance of passing on ratio alone. This was disclosed to the developer (`36-VALIDATION.md:265`), so it is recorded here as a strength-of-evidence note rather than a defect.

**Fix:** State the floor's false-pass rate on the control population in the verdict output, and treat leg 3 as corroboration rather than proof of per-window correctness.

### IN-02: The "leaked mock cannot poison later tests" claim only holds on the success path

**File:** `src/analytics/pace-single-source.test.ts:1271-1278`

**Issue:** `vi.doUnmock('./unreliable-segments.js')` and `vi.resetModules()` are inside the `try`, after the assertions. Any failing `expect` above them skips the unmock, and the stubbed detector leaks into later tests in the file, turning one red test into a cascade of misleading ones.

**Fix:** Move `vi.doUnmock(...)` and `vi.resetModules()` into the `finally` next to `rmSync`.

### IN-03: The test's local `paceMinSec` helper mis-formats near minute boundaries

**File:** `src/analytics/pace-single-source.test.ts:1263-1264`

**Issue:** `Math.floor(p/60)` combined with `Math.round(p) % 60` renders 239.6 s/km as `3:00` instead of `4:00`. It only passes because the pinned value (3:20) is away from a boundary. The recount's `paceSecToMinSecLocal` already does this correctly by rounding first.

**Fix:** `const s = Math.round(p); return \`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}\`;`

### IN-04: OLD plausibility is re-evaluated on a rounded duration

**File:** `scripts/compute-ceiling-recalibration.mjs:203-213`

**Issue:** `contaminated.durationSec` is `round1`'d, but the pre-phase pipeline evaluated `isPlausible` on the unrounded sweep result. An effort within 0.05 s of a world-record or max-speed threshold can be reconstructed with the wrong old demotion. This is a boundary case, but it feeds the signed artifact.

**Fix:** Either persist the unrounded raw duration in the reconstruction input, or document the ±0.05 s bound in the artifact's provenance section.

### IN-05: `contaminatedDurationSec` and `contaminatedPaceSecPerKm` are dead row fields

**File:** `src/dashboard/views/detail-best-efforts-logic.ts:136-141, 224-225`

**Issue:** Both fields are populated but read nowhere outside tests. The original time reaches the reader only through the reason string, in seconds, and the original pace is never shown, despite the badge explanation saying "the original time … [is] named here".

**Fix:** Either render the formatted original time and pace in the badge, or remove the two fields.

### IN-06: The Records note's "the segment is named" over-promises for windows with more than two segments

**File:** `src/dashboard/views/records-logic.ts:429`; `src/analytics/compute-best-efforts.ts:211, 245-255`

**Issue:** `CONTAMINATION_REASON_SEGMENT_CAP = 2` collapses the rest into "+N more". One real 10k window intersects 20 segments (`3475712117`), so "the segment[s] … are named on each activity's detail view" is not true for those efforts.

**Fix:** Reword the note to "the original time and the intersecting segments (up to two named) are shown on each activity's detail view".

---

_Reviewed: 2026-11-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
