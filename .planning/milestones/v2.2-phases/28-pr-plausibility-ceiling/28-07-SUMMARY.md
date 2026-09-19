---
phase: 28-pr-plausibility-ceiling
plan: 07
subsystem: analytics
tags: [best-efforts, pr-ceiling, diff, retroactive-promotion, markdown-artifact, idempotence]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    plan: "05"
    provides: "The three-pass computeBestEfforts restructure, the shared demotion path (EffortDemotion.guard of world-record/max-speed/ceiling), and doc.ceilings/totals.effortsDemoted — the exact fields this diff reads to reconstruct OLD semantics"
provides:
  - "scripts/compute-pr-ceiling-diff.mjs: reconstructOldDocument/extractNewState/diffPrState/renderDiffMarkdown/buildDiffReport, pure and file-I/O-free except main()'s single computeBestEfforts sweep"
  - ".planning/phases/28-pr-plausibility-ceiling/28-DIFF.md — the committed, regenerable, purely-generated before/after PR diff PR-04 requires, proven idempotent by a second run"
  - "npm run compute-pr-ceiling-diff"
affects: [28-08-cohort-recount, 28-09-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One computeBestEfforts sweep into throwaway os.tmpdir() statsDir + ceilingStatePath, never data/stats or the committed ceiling state — mirrors compute-pace-residual.mjs's read-only-sweep discipline but for a mutating function"
    - "OLD semantics reconstructed FROM the NEW document by population-membership filtering (drop world-record/max-speed/excluded, retain ceiling), then re-run through the SAME markPRs/rankTopN pure functions the shipped pipeline uses — never a second archive sweep, never a re-implementation of the marking logic"
    - "prFlags map value widened from a bare boolean to {wasPRAtTheTime, durationSec, startDate, demotionGuard} — see Deviations"

key-files:
  created:
    - scripts/compute-pr-ceiling-diff.mjs
    - scripts/compute-pr-ceiling-diff.test.mjs
    - .planning/phases/28-pr-plausibility-ceiling/28-DIFF.md
  modified:
    - package.json

key-decisions:
  - "prFlags map values carry {wasPRAtTheTime, durationSec, startDate, demotionGuard} instead of a bare boolean (Rule 1 deviation — see below)"
  - "demotedCount (per-distance and totalDemoted) counts ceiling-only demotions, not all three guards, because world-record/max-speed demotions are identical in OLD and NEW by construction and can never produce a flag flip — the reconciliation figure that matters for plan 28-08 is the NEW mechanism's own count"
  - "flagFlips' demoted field always reads the NEW document's demotion.guard for that (activityId, distance) pair, never a reconstructed OLD-side concept — OLD is a population-membership view over the same underlying efforts, not a second demotion record"

requirements-completed: [PR-04]

# Metrics
duration: ~50min
completed: 2026-09-11
---

# Phase 28 Plan 07: Archive-wide Before/After PR Diff Summary

**A regenerable `28-DIFF.md` computes OLD and NEW PR semantics from one live `computeBestEfforts` sweep (never `data/stats` or the committed ceiling state), diffs every top-10 ranking row and every `wasPRAtTheTime` flip in both directions per D-12, and is proven byte-identical on a second run: the live archive shows 18 ceiling demotions, 14 flag flips (3 retroactive promotions), and 48 ranking rows moved, matching plan 28-05's cross-checked 8/7/3/0/0/0/0 per-distance counts exactly.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 4 (`compute-pr-ceiling-diff.mjs` created, `compute-pr-ceiling-diff.test.mjs` created, `28-DIFF.md` created, `package.json` modified)

## Accomplishments

- `reconstructOldDocument(newDoc)` derives the OLD ranked population and PR flags per distance by filtering the NEW document's efforts (drop `world-record`/`max-speed`-guarded and excluded efforts, retain `ceiling`-demoted ones), then feeding the retained population through the exact same `markPRs`/`rankTopN` pure functions the shipped pipeline uses — no second archive sweep, no re-implementation of the marking mechanism.
- `extractNewState(newDoc)` reads the shipped document's rankings and per-effort flags straight off, in the same `{ rankings, prFlags }` vocabulary as the reconstruction, so both sides of the diff compare like-for-like.
- `diffPrState(oldState, newState)` computes, per distance: `rankingRows` (removed/entered/moved-up/moved-down, sorted by newRank/oldRank/activityId), `flagFlips` (lost/gained, sorted by activityId), `flagsBefore/After/Flipped`, `demotedCount`, and `netZeroButMoved`; plus archive-wide `totalDemoted`/`totalFlagFlips`/`totalRetroactivePromotions`/`totalRankingRowsMoved`.
- `main()` runs `computeBestEfforts` exactly once against the real archive with a throwaway `os.tmpdir()`-rooted `statsDir` AND `ceilingStatePath` — the dry run cannot overwrite `data/stats/best-efforts.json` or rewrite the committed ceiling state (T-28-07-A). `ceilingStatePath` is forward-compatible: plan 28-06, executing concurrently in a sibling worktree, is what adds that field to `ComputeBestEffortsOptions`; at this plan's base it is silently ignored, and becomes load-bearing without any edit here once 28-06 merges.
- `renderDiffMarkdown` renders `28-DIFF.md`'s eight required sections (title + 7 `## ` headings): How before/after were computed, Summary, Records that changed hands, PR-at-the-time flag flips, Retroactive promotions, Reconciliation, Inputs. No sign-off text anywhere (D-14) — verified by a case-insensitive grep for "signed off|approved by|reviewer:" returning 0.
- Live-archive run: 1,865 activities considered, **18** ceiling demotions (8 at 400m, 7 at 1k, 3 at 1mi, 0 elsewhere) — matching plan 28-05's live cross-check exactly — 14 `wasPRAtTheTime` flag flips (11 lost, 3 gained/retroactive-promotion), and 48 ranking rows moved across 400m/1k/1mi. No distance in this specific live run happened to land exactly at `flagsBefore === flagsAfter` (the D-12/1mi "net-zero" signature was measured under an illustrative K=1.35 in 28-CONTEXT.md, not the shipped K=1.28) — this is a reported, measured fact of the current archive, not a code defect; the mechanism and field are proven correct by the unit test's constructed fixture instead (see below).
- Idempotence proven for real, by an actual second run (not assumed): `npm run compute-pr-ceiling-diff` run twice produced zero non-timestamp diff lines. Re-ran a third time after adding the test file to confirm the artifact's generator, not just its one-time output, is idempotent — same result.

## Task Commits

Each task was committed atomically:

1. **Task 1: Compute OLD and NEW semantics side by side and diff them per D-12** - `b32acce7` (feat)
2. **Task 2: Render 28-DIFF.md and prove it regenerates byte-identically on a second run** - `3a71eaeb` (feat)
3. **Task 3: Unit-test the diff, including the net-zero-count retroactive promotion** - `777a990a` (test)

_No separate plan-metadata commit — SUMMARY.md is committed by the orchestrator's worktree merge flow (STATE.md/ROADMAP.md excluded per worktree isolation)._

## Files Created/Modified

- `scripts/compute-pr-ceiling-diff.mjs` - `reconstructOldDocument`, `extractNewState`, `diffPrState`, `buildDiffReport`, `renderDiffMarkdown`, and a self-execution-guarded `main()` that runs one `computeBestEfforts` sweep into throwaway temp paths
- `scripts/compute-pr-ceiling-diff.test.mjs` - 6 describe blocks / 12 tests: membership assertions, the load-bearing net-zero retroactive-promotion case plus its negative control, ranking-movement, no-change control, determinism (repeat-call and insertion-order independence), and `renderDiffMarkdown` idempotence/no-sign-off checks
- `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` - the committed diff artifact, sha256 `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6` at commit `3a71eaeb`/`777a990a` (generated `2026-09-10T22:41:21.649Z`)
- `package.json` - added `"compute-pr-ceiling-diff": "npm run build && node scripts/compute-pr-ceiling-diff.mjs"` (exactly one added line, per acceptance criterion)

## Decisions Made

- **`prFlags`'s value widened from a bare boolean to an object** carrying `{ wasPRAtTheTime, durationSec, startDate, demotionGuard }` — see Deviations below; this was necessary, not optional, because the plan's own Task 1 output spec requires `flagFlips` rows to carry "the effort's duration and whether that effort itself was demoted," which a boolean-only map cannot supply.
- **`demotedCount`/`totalDemoted` count ceiling-only demotions.** World-record/max-speed demotions are, by the reconstruction rule, dropped from BOTH old and new populations identically, so they can never produce a flag flip or a ranking-row change — counting them here would inflate the figure with numbers this diff cannot possibly explain movement for. The reconciliation section states this plainly: this report's own 18 vs. the document's combined 52 (34 pre-existing absolute-guard + 18 new ceiling).
- **A flip's `demoted` field always reads the NEW document's `demotion.guard`.** The OLD side is a population-membership reconstruction over the same underlying effort objects, not an independent demotion record, so there is exactly one place to ask "was this effort itself demoted."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `prFlags`'s value widened from a bare boolean to an object carrying duration and demotion-guard**
- **Found during:** Task 1, while drafting `diffPrState`'s `flagFlips` row shape
- **Issue:** The plan's `<interfaces>` text states `reconstructOldDocument`/`extractNewState` return `{ rankings, prFlags }` where "`prFlags` is a map keyed by `activityId + '|' + distance` to a boolean." But the SAME plan's Task 1 action text requires each `flagFlips` row to carry "the effort's duration and whether that effort itself was demoted." A literal boolean-only map structurally cannot supply either field to `diffPrState`, whose only inputs are `oldState` and `newState` — there is no third parameter for a details lookup.
- **Fix:** Kept the field named `prFlags`, keyed identically, but widened each value to `{ wasPRAtTheTime, durationSec, startDate, demotionGuard }`. `diffPrState` reads `.wasPRAtTheTime` for the flip comparison (preserving the boolean semantics the plan describes) and `.durationSec`/`.demotionGuard` for the row fields the plan's own acceptance criteria require. This is the minimal change that satisfies both the plan's stated vocabulary AND its stated required output — a literal reading of "boolean" would have made Task 3's own acceptance criteria (asserting `demoted`/duration on a flip row) impossible to implement.
- **Files modified:** `scripts/compute-pr-ceiling-diff.mjs` (`reconstructOldDocument`, `extractNewState`, `diffPrState`)
- **Verification:** Task 3's fixture explicitly asserts `lost[0].demoted === true` and `gained[0].demoted === false` on the constructed net-zero case; the live archive run's rendered flag-flip tables show correct duration and demoted-status per row, cross-checked against `28-05-SUMMARY.md`'s per-distance demoted counts.
- **Committed in:** `b32acce7` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed literal-case mismatch in the "not a git-history comparison" acceptance phrase**
- **Found during:** Task 2, verifying the acceptance criterion "`## How before and after were computed` contains the phrase `not a git-history comparison`"
- **Issue:** The first draft wrote "This is **NOT** a git-history comparison" (uppercase NOT for emphasis), which does not contain the literal lowercase substring the acceptance criterion names.
- **Fix:** Changed to lowercase "This is not a git-history comparison" — same meaning, satisfies a literal substring check regardless of how a later automated gate greps for it.
- **Files modified:** `scripts/compute-pr-ceiling-diff.mjs` (`renderDiffMarkdown`)
- **Verification:** `grep -c "not a git-history comparison" 28-DIFF.md` returns 1.
- **Committed in:** `3a71eaeb` (Task 2 commit)

**3. [Rule 1 - Bug] Reworded a test file's own doc comment to avoid tripping its target acceptance grep**
- **Found during:** Task 3, running the acceptance criterion `grep -c "data/streams\|data/activities\|data/stats" scripts/compute-pr-ceiling-diff.test.mjs` (must return 0)
- **Issue:** The test file's header comment explained, in prose, that "No fixture in this file reads `data/streams`, `data/activities` or `data/stats`" — the literal path strings in that explanatory sentence matched the very grep meant to prove no fixture reads the real archive, even though no fixture actually does.
- **Fix:** Reworded the comment to describe the same guarantee ("no fixture reads any committed archive directory under the repo's top-level `data` folder") without using the literal path substrings.
- **Files modified:** `scripts/compute-pr-ceiling-diff.test.mjs`
- **Verification:** The grep now returns 0; all 12 tests still pass with identical assertions (no test behavior changed, only a comment).
- **Committed in:** `777a990a` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed, all Rule 1 (bugs in the plan-text-to-code or plan-text-to-test-comment translation, not in any shipped derivation logic). None weakened an acceptance criterion; all three make the artifact/test say exactly what the plan's own acceptance criteria require.
**Impact on plan:** No scope creep. The reconstruction rule, the diff shape, and the artifact's sections are exactly what D-12/D-13/D-14 specify.

## Issues Encountered

- The plan's own D-12 illustrative numbers (measured under K=1.35 in `28-CONTEXT.md`: 20 demoted, 10 flag flips, 1mi net-zero at 14) do not reproduce under the shipped K=1.28 — the plan explicitly disclaims this ("these numbers were measured under an ILLUSTRATIVE multiplier... Re-measure; do not carry them forward as expected values"). The live run at K=1.28 measures 18 demoted / 14 flag flips / 3 retroactive promotions, with no distance landing at an exact net-zero-count in this specific archive snapshot. The mechanism itself (and the `netZeroButMoved` field) is proven correct by Task 3's constructed fixture, which deliberately reproduces the net-zero shape the live archive did not happen to produce today.
- `npm test` in this fresh worktree shows 7 failing test files, all pre-disclosed by the orchestrator's wave note as archive/build-dependent gaps absent from a fresh git worktree (`dist/widgets/data/stats/best-efforts.json`, `data/stats/best-efforts.json`, `data/dashboard/index.json`, `data/stats/gear-aggregate.json`, `data/stats/training-load.json`, `data/stats/year-over-year.json`, and `node_modules/chartjs-plugin-zoom`'s dist file — none of which this plan's scope touches or creates). `npx tsc --noEmit` is clean and `npx vitest run scripts/compute-pr-ceiling-diff.test.mjs` passes 12/12.

## Live-archive verification (plan's own `<output>` requirement)

Ran `npm run compute-pr-ceiling-diff` against the real committed archive (1,865 activities considered).

**Archive-wide totals:**
- Total demoted (ceiling-only, this report's own count): **18**
- Total `wasPRAtTheTime` flag flips: **14**
- Total retroactive promotions (gained): **3**
- Total ranking rows moved: **48**

**Per-distance breakdown** (demoted / flagsBefore / flagsAfter / flagsFlipped / netZeroButMoved):
- 400m: 8 / 11 / 6 / 5 / false
- 1k: 7 / 11 / 9 / 6 / false
- 1mi: 3 / 14 / 13 / 3 / false
- 5k: 0 / 21 / 21 / 0 / false
- 10k: 0 / 16 / 16 / 0 / false
- half: 0 / 6 / 6 / 0 / false
- marathon: 0 / 0 / 0 / 0 / false

No distance shows `netZeroButMoved: true` in this specific live run — reported above, not smoothed over (see Issues Encountered).

**Idempotence proof, verbatim:** `npm run compute-pr-ceiling-diff` run twice, `diff`ed with the `**Generated:**` line stripped from both: zero lines of output, followed by the script's own printed line `IDEMPOTENT: 0 non-timestamp diff lines on the second run`. Re-verified a third time after Task 3 added the test file (same result), confirming the GENERATOR is idempotent, not just one output happened to match another.

**`data/stats/best-efforts.json` / `data/best-effort-ceiling.json` unmodified:** `data/stats/best-efforts.json` does not exist anywhere in this worktree (gitignored, never created here — this plan's own `main()` never writes it, using a throwaway `os.tmpdir()` path instead) and `git status --short data/` / `git status --porcelain data/best-effort-ceiling.json` are both empty after every run.

**Cross-check against plan 28-05:** this plan's 18 ceiling demotions (8+7+3+0+0+0+0) match `28-05-SUMMARY.md`'s live-archive console tail exactly, and the artifact's Reconciliation section states the document's combined `totals.effortsDemoted` (52 = 34 pre-existing absolute-guard + 18 new ceiling) for plan 28-08's independent recount to check against.

## Known Stubs

None — every export is fully implemented against its stated contract; the reconstruction, diff, and render functions are all live, tested against synthetic fixtures AND the real archive.

## Threat Flags

None. All five threats named in this plan's `<threat_model>` are exactly the surfaces this plan's own code touches: T-28-07-A (dry-run mutation) is closed by the throwaway `os.tmpdir()` paths, asserted by the plan's own grep criteria; T-28-07-B (archive-derived strings in markdown) is closed by `safeActivityId`'s `VALID_ACTIVITY_ID` regex and `safeCell`'s newline/pipe stripping; T-28-07-C (one unreadable file aborting the sweep) relies on `computeBestEfforts`'s pre-existing per-activity try/catch plus this script's own `main()` try/catch around the `computeBestEfforts` call; T-28-07-D (an unreproducible diff) is closed by the proven two-run (in practice, three-run) idempotence and D-14's sign-off-free artifact; T-28-07-SC (package installs) does not apply — zero packages installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `28-DIFF.md` is committed and regenerable; plan 28-08's classifier-independent recount can read this plan's stated demoted total (18, ceiling-only; 52 combined with the document's own absolute-guard count) to reconcile against, per the Reconciliation section's explicit naming of `scripts/compute-pr-ceiling-recount.mjs`.
- `ceilingStatePath` is passed forward-compatibly into `computeBestEfforts` — once plan 28-06 (running concurrently) lands `ComputeBestEffortsOptions.ceilingStatePath`, this script's dry run automatically isolates it correctly with no further edit required here.
- Plan 28-09's human browser checkpoint / developer sign-off can bind its approval to `28-DIFF.md`'s content hash (sha256 `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6` at this plan's commits) per D-14 — the artifact itself carries no sign-off block by design.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-11*

## Self-Check: PASSED

All created/modified files verified present on disk (`scripts/compute-pr-ceiling-diff.mjs`,
`scripts/compute-pr-ceiling-diff.test.mjs`, `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md`,
this summary, `package.json`). All three task commits (`b32acce7`, `3a71eaeb`, `777a990a`) confirmed
present in `git log --oneline --all`. No missing items.
