---
phase: 28-pr-plausibility-ceiling
reviewed: 2026-09-17T07:37:34Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - data/best-effort-ceiling.json
  - scripts/compute-pr-ceiling-calibration.mjs
  - scripts/compute-pr-ceiling-calibration.test.mjs
  - scripts/compute-pr-ceiling-diff.mjs
  - scripts/compute-pr-ceiling-diff.test.mjs
  - scripts/compute-pr-ceiling-recount.mjs
  - scripts/compute-pr-ceiling-recount.test.mjs
  - src/analytics/best-effort-ceiling-state.test.ts
  - src/analytics/best-effort-ceiling-state.ts
  - src/analytics/best-effort-ceiling.test.ts
  - src/analytics/best-effort-ceiling.ts
  - src/analytics/best-effort-utils.test.ts
  - src/analytics/best-effort-utils.ts
  - src/analytics/best-effort.types.ts
  - src/analytics/compute-age-grading.test.ts
  - src/analytics/compute-best-efforts.test.ts
  - src/analytics/compute-best-efforts.ts
  - src/analytics/compute-dashboard-index.test.ts
  - src/dashboard/curation-seam.test.ts
  - src/dashboard/data/best-efforts-client.test.ts
  - src/dashboard/data/best-efforts-client.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/detail-best-efforts-logic.test.ts
  - src/dashboard/views/detail-best-efforts-logic.ts
  - src/dashboard/views/detail-sections.test.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/views/records-logic.test.ts
  - src/dashboard/views/records-logic.ts
  - src/dashboard/views/records.test.ts
  - src/dashboard/views/records.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 28: Code Review Report (re-review after gap closure 28-10..28-15)

**Reviewed:** 2026-09-17T07:37:34Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

This re-review covers the same 32 files at HEAD `62f1b94e`. I checked each prior finding against the code and against the shipped `data/stats/best-efforts.json` (generatedAt 2026-09-16T12:01:32Z). I did not rely on the plan summaries.

**Checks run:**
- `npx tsc --noEmit`: clean.
- The seven Phase 28 test files: 357/357 pass.
- `node scripts/compute-pr-ceiling-recount.mjs` against the shipped document: PASS.
  - Demotions: 65 total (world-record 19, max-speed 15, ceiling 31).
  - `independentCeilingCount` is 31, and `overCeilingWithoutDemotion` is 0.
  - The pinned effort `4556693525@400m` shows `guard="ceiling"` and `durationSec=45.2`.

**Prior findings.** Both prior Critical findings are resolved in code and in shipped data. Five of the six prior Warnings are resolved and one (WR-06) is partially resolved. Of the prior Info items, four are resolved and one (IN-05) is still open.

**New findings.** There are no new Critical findings. Three new Warnings:
- **WR-07:** the calibration generator writes fixed prose that depends on the data. The committed artifact already contradicts its own table.
- **WR-08:** the calibration's "Demoted" column no longer agrees with the pipeline since the CR-01 fix.
- **WR-09:** the new CR-01 regression tests depend on the owner-editable exclusions file. That dependency makes `npm test` in the nightly workflow break after an ordinary curation edit.

The frontmatter counts include only the new findings (WR-07..WR-09, IN-06..IN-08). The still-open prior IN-05 and the partially resolved WR-06 are tracked in the disposition table below and are not counted again.

## Prior findings disposition

| ID | Disposition | Evidence |
|---|---|---|
| CR-01 | **Resolved** | `compute-best-efforts.ts:410-420` adds an extra pass over owner-excluded efforts. It calls the same `ceilingDemotion` function, skips any effort that already has a `demotion`, walks activities in sorted id order, and never touches `byDistance`. In shipped data, the recount's `overCeilingWithoutDemotion` is 0 and 13 excluded efforts now carry `guard: 'ceiling'` (11 at 400m, 2 at 1k). The pinned 4556693525 400m and 1k efforts are both ceiling-demoted. The regression test at `compute-best-efforts.test.ts:944` uses the real exclusion entry and has a negative control. |
| CR-02 | **Resolved** | `records-logic.ts:181-214` counts demotions per guard and skips efforts with `excludedFromRecords`. `describeDemotionCounts` (`:228-239`) names each guard. The empty-state heading says "ceiling" only when `counts.ceiling > 0` (`:281-284`). In shipped data, 400m gives total 35 = 8 ceiling + 17 world-record + 10 max-speed, which matches the pinned test string. |
| WR-01 | **Resolved** | `records-logic.ts:305` returns `null` for `this-year`, and `records.ts:592` passes `scope`. |
| WR-02 | **Resolved** | New `--demoted-text` token (`styles.css:36,106,126`), used by `.badge--demoted` at `:403-405`. I recomputed the contrast: `#fb923c` gives 7.54:1 on `#1a1a2e` and 6.58:1 on `#242444`, and `#b3390a` gives 5.99:1 on `#ffffff`. `styles.test.ts` now reads the token values from the stylesheet and asserts ≥ 4.5:1. |
| WR-03 | **Resolved** | `compute-pr-ceiling-calibration.mjs:97-100` drops world-record and max-speed demotions and keeps ceiling demotions. On the shipped document, the ceilings it applies equal production's at all seven distances (400m 5.1098, 1k 4.7513, 1mi 4.6323, 5k 4.3458, 10k 4.2236, half 4.4017, marathon null). See WR-08 for a separate mismatch in the same script's output. |
| WR-04 | **Resolved** | `compute-pr-ceiling-diff.mjs:134` and `compute-pr-ceiling-calibration.mjs:97` now filter on each effort's `excludedFromRecords` only. There is a new test for a distance-scoped exclusion in `compute-pr-ceiling-diff.test.mjs`. |
| WR-05 | **Resolved** | `compute-pr-ceiling-recount.mjs:474-485` turns a failing pinned-fixture check into a verdict problem. `recountCeilingSweep` (`:255-336`) recomputes `TARGET_METERS_LOCAL/durationSec` for every effort and compares it with `doc.ceilings`. `:489-491` fails the verdict if the sweep did not run. |
| WR-06 | **Partially resolved** | The comments are corrected at `daily-refresh.yml:228-231` and `compute-best-efforts.ts:561-566`. However, the first sentence of the same block (`compute-best-efforts.ts:556-557`) still says the file is written "only when the ceiling actually moved". No opt-in guard was added, so every local `compute-all-stats` still rewrites the tracked `data/best-effort-ceiling.json` whenever population or p90 moves. The hazard is now documented, not removed. |
| IN-01 | **Resolved** | `best-effort.types.ts:148-152, 225-233, 249`, `compute-best-efforts.ts:544, 576`, and the diff script header have all been updated. New stale text is reported under IN-06. |
| IN-02 | **Resolved** | `detail-best-efforts-logic.ts:266` now reads "is left out of the ranked PR list". |
| IN-03 | **Resolved** | `compute-pr-ceiling-recount.mjs:171, 193` use `?.`, and `recountDemoted(null)` is tested. A related gap remains in sibling functions (IN-08). |
| IN-04 | **Resolved** | `compute-pr-ceiling-diff.mjs:665-700` wraps the run in `try/finally { rmSync(tempDir, …) }`. The early `return` at `:675` still passes through `finally`. |
| IN-05 | **Still open** | `detail-best-efforts-logic.ts:13` still imports `LOW_CONFIDENCE_BADGE_TEXT` from `./list.js`, and `records-logic.ts:20` still imports from `detail-best-efforts-logic.ts`. No gap-closure plan targeted it. |

## Narrative Findings (AI reviewer)

## Warnings

### WR-07: The calibration generator hardcodes prose that depends on the data, and the committed artifact already contradicts its own table

**File:** `scripts/compute-pr-ceiling-calibration.mjs:579-590`, `:640-649`; generated output `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md:46`, `:76`

**Issue:** `renderCalibrationMarkdown` claims to be a pure function of `report`, but two paragraphs are fixed strings that make claims about the live data.

1. **The drift paragraph (`:579-590`) is false for today's data.**
   - It always prints "400m shows the largest drift: the live population and its top-10 differ materially…".
   - The reconciliation table just above it, in the committed artifact, shows 400m at −6 and 5k at **−7**, so 400m does not have the largest drift.
   - The drift is also nearly uniform (−5 to −7 at five distances, −1 at half). That pattern fits the 12 whole-activity (`distances: null`) exclusions. It does not fit something "material" at 400m.
2. **The D-03 paragraph (`:644-649`) asserts a fixed conclusion.** It always says "fewer of today's top 10 are demoted than the near-total emptying anticipated". It prints this even when `demotedTop10Count` is 10, in which case the sentence would contradict the number printed in the same paragraph.

**Why it matters:** this is the committed D-13 artifact. Editing the markdown by hand would be undone the next time it is regenerated, so the fix has to be in the generator. Idempotence tests cannot catch this, because a wrong sentence is still byte-stable.

**Fix:** Derive the claims from `report`, or drop them:
```js
const drifts = TARGET_ORDER.map((k) => [k, Math.abs(report.reconciliation[k].drift)]);
const maxAbs = Math.max(...drifts.map(([, d]) => d));
const largest = drifts.filter(([, d]) => d === maxAbs).map(([k]) => k);
lines.push(`Largest absolute drift: ${largest.join(', ')} (${maxAbs}). ...`);
// D-03 paragraph: branch on a400.demotedTop10Count === 10 / < 10 instead of asserting "fewer".
```
Also add a render test that feeds a report where 5k has the largest drift, and assert that the output does not say "400m shows the largest drift".

### WR-08: The calibration's "Demoted" column no longer matches what the pipeline demotes, and the claimed "31/31/31" reconciliation excludes it

**File:** `scripts/compute-pr-ceiling-calibration.mjs:270-296` (`applyCeiling`), `:617-635` (the "Resulting coverage and demotions" table)

**Issue:** `applyCeiling` counts demotions only inside `buildFilteredPopulations`, which is the population with excluded efforts removed. Since CR-01, the pipeline also applies the ceiling to owner-excluded efforts.

| Distance | Calibration "Demoted" column | Pipeline / `28-DIFF.md` ceiling demotions |
|---|---|---|
| 400m | 8 | 19 |
| 1k | 7 | 9 |
| 1mi | 3 | 3 |
| **Total** | **18** | **31** |

- **Unlabelled mismatch.** The artifact never says that its column leaves out owner-excluded efforts. A reader comparing it with `28-DIFF.md` sees two different "demoted at 400m" figures for the same ceiling.
- **Overstated reconciliation.** Plan 28-14's commit subject claims the counts were "reconciled 31/31/31". That holds for the diff, the recount's `byGuard.ceiling` and the sweep, but not for this artifact.

**Fix:** Pick one of these:
- Rename the column to "Demoted (non-excluded population)".
- Also count excluded efforts, for example by having `applyCeiling` take the full effort list, or by adding an "incl. owner-excluded" column computed with the same `speedMps > ceilingMps` test.

Either way, add a test that feeds an excluded, over-ceiling effort and asserts how it is counted.

### WR-09: The new CR-01 regression tests depend on the owner-editable exclusions file, and a routine curation edit breaks the blocking CI test gate

**File:** `src/analytics/compute-best-efforts.test.ts:944-1014`, `:1100-1135`, `:1137-1167`, `:1169-1197`; gate at `.github/workflows/daily-refresh.yml:199-200`

**Issue:** Four new tests pass `exclusionsPath` pointing at the real `data/best-effort-exclusions.json`. That file is written by `scripts/curate-server.mjs` and `scripts/exclusion-cli.mjs`.

- **Only one test checks its premise.** The test at `:944` confirms that the 4556693525 entry exists and covers all distances (`premiseOk`, `:957`).
- **The other three depend on the file's contents without checking them.**
  - `:1131-1134` expects `populationN` to be exactly `base400` / `base1k`.
  - `:1189` expects `effortsExcluded` to be exactly 3.
  - `:1195-1196` expects `effortsDemoted` and `effortsRejected` to be exactly 2.
  - All three silently assume that **both** 4556693525 and 3475711469 are excluded for all distances.
- **Nothing checks the negative-control entry.** No test checks that 3475711469 is present in the file at all.

**Consequence:**
- If the owner un-excludes 3475711469, or narrows either entry to specific distances, these tests fail with unexplained numeric mismatches.
- Because `npm test` is a blocking step before the Pages deploy, the next nightly run then fails to publish. A data-curation action should not be able to break the code's test gate.

**Fix:** In each of these tests, write a temporary exclusions file that copies the two relevant entries into `tmpDir`. Keep the one real-file premise test separately if a check on the real entry is wanted. For example:
```ts
const exclusionsPath = path.join(tmpDir, 'pinned-exclusions.json');
await fileStore.writeJson('pinned-exclusions.json', {
  schemaVersion: 1, note: 'test',
  exclusions: [
    { activityId: '4556693525', distances: null, reason: 'bad measurement' },
    { activityId: '3475711469', distances: null, reason: 'bad measurement' },
  ],
});
```
If the real file must stay in use, at least call the `premiseOk` assertion for both ids in every test that reads it.

## Info

### IN-06: Stale or self-contradicting comments introduced or left by the gap closure

**File:** multiple
**Issue:**
- `scripts/compute-pr-ceiling-calibration.mjs:83` says `rejected` is "now always empty — nothing is deleted post-D-08". This is false: the shipped `rejected` array has 65 rows, one per demoted effort.
- `src/analytics/compute-best-efforts.ts:556-557` opens with "only when the ceiling actually moved". Lines 561-564 of the same comment block then say that population or p90 changes also trigger a write (see WR-06).
- `src/analytics/compute-best-efforts.ts:107` says `computeActivityEfforts` "Computes all plausible efforts". Since D-08 it also keeps implausible efforts, each carrying its demotion.

**Fix:** Reword each comment to describe the current behaviour.

### IN-07: A change in p90 alone is reported as "population changed N -> N" and the p90 values are not shown

**File:** `src/analytics/best-effort-ceiling-state.ts:272-276`, `:326-330`
**Issue:** When `populationN` and `ceilingMps` are unchanged but `p90Mps` differs, `diffCeilingState` labels the row `population-changed`. This happens when one effort is swapped for another. `formatCeilingMovement` then prints "400m population changed 1825 -> 1825 (ceiling 5.1098 -> 5.1098 m/s)". That line omits the p90 values, which are the only thing that moved, and it names a population change that did not happen. The D-06 report is supposed to show movement "in words with numbers", but here the number that changed is missing.
**Fix:** Either add a `p90-moved` kind, or always include `p90 prev -> curr` in the `population-changed` line.

### IN-08: The recount still throws on a JSON `null` document in two sibling functions

**File:** `scripts/compute-pr-ceiling-recount.mjs:345`, `:389`
**Issue:** `readShippedJson` returns `{ ok: true, doc: null }` for a file whose content is `null`. Two functions then fail on that value:
- `recountImpossibleSampleCohort(null)` reads `indexDoc.activities` and throws a TypeError.
- `computeCohortOverlap` reads `activities[activityId].efforts` without checking for a null activity.

Either failure escapes `main()` as an uncaught exception. The T-28-08-A contract requires a named failure with a non-zero exit code instead. IN-03 fixed the same problem only in `recountDemoted` and `recountCeilingSweep`.
**Fix:** Use `Array.isArray(indexDoc?.activities)` and `activities[activityId]?.efforts`, and add null-input tests for both functions.

---

_Reviewed: 2026-09-17T07:37:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
