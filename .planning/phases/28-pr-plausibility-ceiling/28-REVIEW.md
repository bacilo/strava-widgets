---
phase: 28-pr-plausibility-ceiling
reviewed: 2026-09-16T09:57:38Z
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
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-09-16T09:57:38Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

I reviewed the diff from `13b3f060^..HEAD` for the listed files. I checked the findings against the shipped `data/stats/best-efforts.json` (generatedAt 2026-09-10T23:08:32Z) rather than against fixtures alone.

The core derivation holds up. `deriveCeiling` uses a nearest-rank percentile with upward rounding. The ceiling is derived once in Pass 2 and never re-derived. `diffCeilingState` and `loadCeilingState` never throw, and the client-side `parseDemotion` rejects malformed input. No effort that shipped with a demotion is still ranked.

Both known checkpoint concerns are confirmed, and both are worse than first stated:

1. **The ceiling check skips every owner-excluded effort.** This is an unexamined side effect, not a design decision. In the shipped document, **13** efforts are faster than their distance's ceiling yet carry `demotion: null`, and all 13 are owner-excluded. The pinned D-04 case (4556693525 at 400m, 8.85 m/s) is one of them. The regression test avoids the problem by pointing at a missing exclusions file, and the recount script prints `guardIsCeiling=false` but still reports PASS.
2. **The demotion note blames the ceiling for demotions made by any guard.** At 400m the note would say 36 efforts were demoted by the plausibility ceiling. The shipped data has 8 ceiling, 18 world-record and 10 max-speed demotions, and one of the 36 is also owner-excluded.

Two further problems:
- The calibration script still assumes the pre-D-08 document shape, so re-running it now produces a different 400m population and ceiling than production.
- The new badge colour fails WCAG AA contrast in the dark theme.

## Critical Issues

### CR-01: The ceiling never checks owner-excluded efforts, so over-ceiling efforts ship with `demotion: null`, including the pinned D-04 case

**File:** `src/analytics/compute-best-efforts.ts:286-298` (Pass 1 `continue`), `:360-381` (Pass 3 only walks `byDistance`)

**Issue:**
- **Cause.** In Pass 1, an excluded effort hits `continue` before it can be added to `byDistance`. Pass 3 applies `ceilingDemotion` only to entries in `byDistance`, so an excluded effort is never compared with the ceiling. Keeping excluded efforts out of the *population* is correct (PR-02). Skipping the *check* for them is not.
- **Inconsistent with the other guards.** `computeActivityEfforts` runs the world-record and max-speed guards on excluded efforts too. So whether an excluded effort gets a `demotion` depends on which guard it would have failed. The shipped data already has one excluded 400m effort that carries an absolute-guard demotion.
- **The field's documented contract is broken.** `best-effort.types.ts:112-121` says `null` is "the correct PERMANENT value for an effort no guard rejected". D-10 exists so that Phase 29's review queue can tell "you excluded this" apart from "a guard rejected this".

Concrete failures, measured on the shipped `best-efforts.json`:
- **13 efforts have `speed > ceilings[d].ceilingMps` and `demotion === null`, all with `excludedFromRecords: true`.**
  - 400m (11 activities): 3475711469, 3475711630, 3475715178, 3475726256, 3475727228, 3475732221, 3475735603, 14122328106, 4556693525, 5059204779, 5588316886.
  - 1k (2 activities): 3475725513, 4556693525.
- **The pinned case is false in production.** 4556693525's 400m effort (8.85 m/s against a 5.1098 ceiling) has `demotion: null`. The detail view shows only "Excluded — bad measurement" and no Demoted badge. The 28-05 must-have ("Activity 4556693525's 400m effort is demoted with `guard: 'ceiling'`") does not hold for the real archive.
- **The pinned test cannot detect this.** The `4556693525` test (`compute-best-efforts.test.ts:759-773`) sets `exclusionsPath` to a missing file precisely because the real exclusion "would silently remove it from `byDistance` before the ceiling ever saw it". The test documents the trap and routes around it, but production still falls into it. The test also asserts that the activity's 1k effort is untouched. In reality that 1k effort is 4.82 m/s, which exceeds the 4.7513 1k ceiling, so it too is a silently skipped over-ceiling effort.
- **The recount cannot detect it either.** `compute-pr-ceiling-recount.mjs` computes `pinnedFixture.guardIsCeiling`, but `evaluateReport` never uses it (see WR-05). The recount therefore prints `guardIsCeiling=false` and still reports PASS.

Rankings are **not** corrupted: excluded efforts never rank, and un-excluding one and recomputing does demote it. What is wrong is the data contract, the pinned must-have, and the input that the Phase 29 queue will read.

**Fix:** Keep the population filter as it is, but apply the ceiling check to every effort that no absolute guard has already demoted, whether or not it is excluded:
```ts
// PASS 3, after the per-distance survivors loop:
for (const activity of Object.values(activities)) {
  for (const effort of activity.efforts) {
    if (!effort.excludedFromRecords || effort.demotion !== null) continue;
    const derivation = ceilings[effort.distance];
    const demotion = ceilingDemotion(TARGET_METERS[effort.distance] / effort.durationSec, derivation);
    if (demotion) {
      effort.demotion = demotion;
      rejected.push({ activityId: activity.activityId, distance: effort.distance, reason: demotion.reason });
    }
  }
}
```
Then add a fixture case where a *real* exclusion entry for 4556693525 is present and assert `demotion.guard === 'ceiling'`. Also make the recount's verdict fail when `pinnedFixture.guardIsCeiling` is false.

### CR-02: The Records demotion note and empty state say "demoted by the plausibility ceiling" but count demotions from all three guards

**File:** `src/dashboard/views/records-logic.ts:159-178` (`countDemotedAtDistance`), `:210-214` (`resolvePrTableEmptyState`), `:222-235` (`resolvePrTableDemotionNote`); caller `src/dashboard/views/records.ts:683`

**Issue:** `countDemotedAtDistance` counts every effort where `demotion != null`, whether the guard was world-record, max-speed or ceiling, and whether or not the owner excluded it. Both copy functions then attribute the whole count to "the plausibility ceiling".

- **Measured on shipped data.** The 400m table reads "36 400m efforts were demoted by the plausibility ceiling". The true split is ceiling 8, world-record 18, max-speed 10. The 1k table says 11, but only 7 are ceiling demotions. The 1 Mile table says 5, but only 3 are. One of the 400m demotions is also owner-excluded, which D-10 says should not be merged into the machine's count.
- **Latent false heading.** The empty-state heading "No {label} efforts passed the plausibility ceiling" appears whenever `demotedCount > 0`. That includes fail-open distances such as marathon (`ceilingMps: null`), where no ceiling exists, so the heading would be false there too.
- **Undermines a house rule.** This is user-facing copy that states a wrong number for a named mechanism, which is exactly what the Phase 27 D-09 register exists to prevent.

**Fix:** Pick one of these:
- Count only `effort.demotion?.guard === 'ceiling'`, and add a separate, guard-neutral sentence for the absolute guards.
- Keep the all-guard count but use guard-neutral copy:
```ts
return `${demotedCount} ${label} ${effortWord} ${verb} demoted by a plausibility guard (world-record, max-speed or personal ceiling). See the activity detail view for the reason.`;
```
Either way, skip `excludedFromRecords` efforts in the count, and gate the "passed the plausibility ceiling" heading on the ceiling-guard count being greater than zero.

## Warnings

### WR-01: The demotion note shows an all-time count under the "This year" scope

**File:** `src/dashboard/views/records.ts:591-597`, `:683`

**Issue:**
- **The bug.** `resolvePrTableDemotionNote` is appended whenever a table is non-empty, whatever the scope. `countDemotedAtDistance` walks the whole archive with no year filter.
- **Visible result.** Under "This year", a 2026 400m table carries "36 400m efforts were demoted…", and most of those efforts are from other years.
- **Inconsistent with the empty state.** `resolvePrTableEmptyState` deliberately ignores `demotedCount` for `this-year` (its doc comment explains why), but the non-empty path does not follow the same rule.

**Fix:** Pass `currentScope` into the note decision. Either return `null` for `this-year`, or count only efforts whose activity `startDate` falls in `year`.

### WR-02: The `.badge--demoted` text fails WCAG AA contrast in the dark theme

**File:** `src/dashboard/styles.css:385-388` (token at `:112`)

**Issue:**
- **Measured contrast.** In the dark theme, `--accent-strong` is `#c2410c`. As 14px text on the card surface `#242444` it reaches **2.87:1**, and on `#1a1a2e` it reaches 3.29:1. Both are below the 4.5:1 that AA requires for normal text. The light theme passes at 5.50:1.
- **Wrong use of the token.** The token's own comment (`styles.css:26-27`) says it is a contrast-safe *fill* for "pagination + segmented control only, never used elsewhere". Using it as a text colour breaks that stated contract.
- **Why the test missed it.** The test in `styles.test.ts` only checks that the rule differs from `.badge--severe`.

**Fix:** Add a dark-theme override with a lighter tone, for example:
```css
:root[data-theme="dark"] .badge--demoted {
  color: #fb923c;
  border-color: #fb923c;
}
```
`#fb923c` is about 6.4:1 on `#242444`. Alternatively, introduce a dedicated token and add a contrast assertion.

### WR-03: The calibration script still assumes efforts were deleted, so regenerating it disagrees with production

**File:** `scripts/compute-pr-ceiling-calibration.mjs:57-66`, `:68-97`

**Issue:**
- **The stale assumption.** `buildFilteredPopulations` still states that "the shipped `efforts` array is already post-`isPlausible`". Since D-08 that is false: the array now keeps world-record, max-speed and ceiling demotions.
- **Measured result.** Running the pure functions on today's shipped document gives a 400m population of **1852** (production has **1825**), a p90 of 4.0282 (production 3.9920), a max of **1000 m/s**, and an applied 400m ceiling of **5.1561** (production **5.1098**). At 1k the applied ceiling is 4.7584 (production 4.7513).
- **Consequence today.** Regenerating `28-CEILING-CALIBRATION.md` would silently change its published tables.
- **Consequence later.** `CEILING_K` currently comes out unchanged only because 5k, 10k and half have no absolute-guard demotions yet. A single world-record GPS glitch at 5k or 10k would push `max/p90` towards arbitrarily large values, and a recalibration would then choose an absurd `K`.

**Fix:** Build the population exactly as Pass 1 does: skip any effort with `effort.demotion?.guard === 'world-record' || === 'max-speed'`, and keep ceiling-demoted efforts. Update the doc comment to match. Add a test that feeds in a demoted effort and asserts it is not counted.

### WR-04: The diff and calibration scripts drop a whole activity for a distance-scoped exclusion

**File:** `scripts/compute-pr-ceiling-diff.mjs:127`; `scripts/compute-pr-ceiling-calibration.mjs:75`

**Issue:**
- **Wrong filter.** Both scripts skip an activity when `activity.excludedFromRecords` is true. That flag is set to `exclusions.has(id)` (`compute-best-efforts.ts:317`), which is true even for an entry scoped to specific distances (e.g. `distances: ['1k']`).
- **Pipeline behaves differently.** The pipeline excludes only the named distances (see the `partial-excluded` test at `compute-best-efforts.test.ts:1001-1050`).
- **Effect.** With a distance-scoped exclusion, `reconstructOldDocument` would leave that activity's 5k effort out of the OLD ranking, while the NEW ranking includes it. The diff would then report an "entered" row, or a "gained" flip, and attribute it to the ceiling change. The calibration population would also be undercounted.
- **Current exposure.** This is latent: all 12 current entries use `distances: null`. The curation UI can write distance-scoped entries, however.

**Fix:** Delete the activity-level `continue` in both scripts and rely only on `effort.excludedFromRecords`, which the pipeline already sets per distance.

### WR-05: The recount script's verdict ignores its own pinned-fixture check and never re-applies the ceiling

**File:** `scripts/compute-pr-ceiling-recount.mjs:174-201`, `:301-350`

**Issue:**
- **The pinned check never affects the verdict.** `pinnedFixture.guardIsCeiling` and `durationMatches45_2` are computed and printed, but `evaluateReport` never adds a problem when either is false. Against the real archive, the recount prints `guardIsCeiling=false` and ends with "PASS: … no disagreements found".
- **It never recomputes the demotions.** Every check reads `effort.demotion` as written by the classifier under test. Nothing compares each effort's `TARGET_METERS/durationSec` with `doc.ceilings[d].ceilingMps`. The recount therefore cannot find over-ceiling efforts that are missing a demotion, which is exactly CR-01. This undercuts the "classifier-independent" claim (D-15).

**Fix:** In `evaluateReport`, add a problem when `pinnedFixture.present && !pinnedFixture.guardIsCeiling`. Also add a check that walks every effort and flags `speed > doc.ceilings[d].ceilingMps && effort.demotion == null`. The distance meters can be computed locally (400, 1000, 1609.344, …), which keeps the no-import rule intact.

### WR-06: The committed ceiling-state file is rewritten on any population change, including local runs, contrary to the comments

**File:** `src/analytics/compute-best-efforts.ts:517-528`; `src/analytics/best-effort-ceiling-state.ts:263-275`; `.github/workflows/daily-refresh.yml:220-230`

**Issue:**
- **Which change triggers a write.** `diffCeilingState` emits a `population-changed` row whenever `populationN` changes, and `computeBestEfforts` then rewrites `data/best-effort-ceiling.json`. `p90` and `ceilingMps` also move with most new runs, because the p90 value is an observed data point.
- **The comments say otherwise.** Both the workflow comment and the code comment say the file is rewritten "only when a ceiling actually moves". In practice, every nightly run that syncs a new run rewrites it.
- **CI impact is small.** CI commits the file together with the activities.
- **Local runs dirty the file.** Every local `npm run compute-all-stats` also rewrites this tracked file, often from a local archive or exclusion state that differs from CI's. The working tree is then dirty on a file that CI also commits every night, which produces the non-fast-forward and merge conflicts this repo already struggles with. Committing that local copy also records a baseline CI never produced.

**Fix:**
- Correct both comments to say the file is rewritten "whenever population, p90 or ceiling changes".
- Consider writing the state file only when an explicit opt-in is set (e.g. `options.writeCeilingState`, or `process.env.CI`), so local runs report movement without touching the tracked file.

## Info

### IN-01: Several doc comments and console strings are stale after D-08

**File:** multiple
**Issue:**
- `best-effort.types.ts:216-223` still says `effortsDemoted` is "Set to 0 by this plan".
- `best-effort.types.ts:143` still says `efforts` holds "Only computed-and-plausible distances". It now also holds demoted efforts.
- `best-effort.types.ts:238` names the file `data/best-effort-ceiling-state.json`, but the real path is `data/best-effort-ceiling.json`.
- `compute-best-efforts.ts:531` prints "Rejected efforts (dropped, not fatal)", but nothing is dropped any more.
- `compute-best-efforts.ts:505` refers to `ceilingMovementRows`, a name that does not exist.
- `compute-pr-ceiling-diff.mjs:18-22, 553-558` still says `ceilingStatePath` is "silently ignored" until 28-06 lands.

**Fix:** Update each comment and string to match the current behaviour.

### IN-02: The demoted badge's explanation uses the word "excluded"

**File:** `src/dashboard/views/detail-best-efforts-logic.ts:271-272`
**Issue:** The screen-reader explanation says the effort "is excluded from the ranked PR list". It often sits next to the owner's "Excluded — …" badge, whose own explanation insists that exclusion is the owner's intent. Screen-reader users therefore hear "excluded" with two different meanings, which D-10 set out to avoid.
**Fix:** Use "is left out of the ranked PR list because a plausibility guard rejected it".

### IN-03: `recountDemoted` guards its input inconsistently

**File:** `scripts/compute-pr-ceiling-recount.mjs:143`, `:165`
**Issue:** Lines 101-108 null-guard `bestEffortsDoc`, but lines 143 and 165 then dereference `bestEffortsDoc.rejected` and `bestEffortsDoc.totals` directly. `recountDemoted(null)` throws.
**Fix:** Use `bestEffortsDoc?.rejected` and `bestEffortsDoc?.totals`.

### IN-04: The diff script leaves its temp directory behind

**File:** `scripts/compute-pr-ceiling-diff.mjs:559`
**Issue:** `mkdtempSync` creates a directory that receives a full per-activity shard tree (about 1,860 files) and is never removed.
**Fix:** Wrap the run in `try/finally { rmSync(tempDir, { recursive: true, force: true }) }`.

### IN-05: `records-logic.ts` now depends on the DOM-building `list.ts` through `detail-best-efforts-logic.ts`

**File:** `src/dashboard/views/records-logic.ts:20`; `src/dashboard/views/detail-best-efforts-logic.ts:13`
**Issue:** The pure logic module now imports `LOW_CONFIDENCE_BADGE_TEXT` from `list.ts`. `list.ts` imports the router and row-navigation, so `records-logic` now depends on those too. Nothing touches `document` when the module loads, so tests still pass, but the purity boundary is getting weaker.
**Fix:** Move `LOW_CONFIDENCE_BADGE_TEXT` into a small constants module that both files import.

---

_Reviewed: 2026-09-16T09:57:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
