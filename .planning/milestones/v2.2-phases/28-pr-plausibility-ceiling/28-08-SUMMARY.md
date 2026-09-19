---
phase: 28-pr-plausibility-ceiling
plan: 08
subsystem: analytics
tags: [best-efforts, pr-ceiling, verification, classifier-independent-recount, impossible-samples, reconciliation]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    plan: "05"
    provides: "The three-pass computeBestEfforts restructure, the shared demotion path (EffortDemotion.guard of world-record/max-speed/ceiling), and doc.ceilings/totals.effortsDemoted — the exact fields this recount reads"
  - phase: 28-pr-plausibility-ceiling
    plan: "07"
    provides: "28-DIFF.md's Reconciliation section, stating the ceiling-only demoted total (18) this plan's recount was asked to reproduce"
  - phase: 27-per-activity-quality-signals
    plan: "05"
    provides: "data/dashboard/index.json's per-row quality.impossibleSamples.count field, the PR-05 cohort mechanism reused read-only here"
provides:
  - "scripts/compute-pr-ceiling-recount.mjs: readShippedJson/recountDemoted/recountImpossibleSampleCohort/computeCohortOverlap/evaluateReport/parseExpectFlags, zero imports of the ceiling module, compute step, best-effort utils or best-effort types"
  - "scripts/compute-pr-ceiling-recount.test.mjs: 10 describe blocks / 24 tests, including a zero-import guard demonstrated working via a self-test"
  - "npm run compute-pr-ceiling-recount"
  - "A recorded, real Criterion-5 reconciliation finding: 28-DIFF.md's stated demoted total (18, ceiling-only) does not equal this recount's ownDemotedTotal (52, all-guard) by construction — see Reconciliation Finding below"
affects: [28-09-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Classifier-independent recount (D-15, mirroring Phase 27's D-03): opens only the two SHIPPED JSON documents with readFileSync + JSON.parse, counts with its own arithmetic, and carries a comment-stripped grep guard proving zero imports of the code it checks"
    - "Two never-conflated PR-05 populations reported with an explicit two-sentence caution printed in the CLI output itself, not only in a source comment: the impossible-sample cohort (stream-level, per-sample) vs. the demoted-effort population (effort-level, seven target distances), plus their overlap in both directions as a reported finding, never a threshold"
    - "--expect-demoted / --expect-cohort are additive-only: they can only ADD a mismatch problem, never suppress one of the five structural findings (ranked-but-demoted, reason-less demotion, totals disagreement, unrecognised guard, unreadable input)"

key-files:
  created:
    - scripts/compute-pr-ceiling-recount.mjs
    - scripts/compute-pr-ceiling-recount.test.mjs
  modified:
    - package.json

key-decisions:
  - "ownDemotedTotal counts ALL THREE guards (world-record/max-speed/ceiling) from the raw activities[*].efforts[*].demotion field, exactly as Task 1 specifies — this makes it structurally equal to doc.totals.effortsDemoted (both 52), never to 28-DIFF.md's ceiling-only figure (18). Not changed to force agreement; see Reconciliation Finding."
  - "archiveDenominator for the PR-05 cohort is data/dashboard/index.json's full row count (1,890, including the 25 rows with no committed stream), not the 1,865-activity best-efforts population — the plan specifies 'the live row count, recomputed at run time,' and the index document's own row array is what that means for this document."
  - "The reconciliation run's failure was recorded as a finding and NOT patched to force a match, per the plan's explicit instruction and the orchestrator's anti-circularity directive: a verifier that changes itself to agree with the number it is checking has stopped verifying anything."

requirements-completed: []

# Metrics
duration: ~45min
completed: 2026-09-11
---

# Phase 28 Plan 08: Classifier-Independent PR-Ceiling Recount Summary

**A standalone recount script opens the SHIPPED `data/stats/best-efforts.json` and `data/dashboard/index.json` with zero imports of the ceiling/compute/utils/types modules, reproduces `doc.totals.effortsDemoted` (52) and the historically-cited 662-activity impossible-sample cohort exactly from its own arithmetic, and — performing the real Criterion-5 reconciliation rather than assuming it would pass — surfaces a genuine ambiguity: `28-DIFF.md`'s stated "18" is ceiling-only while this recount's `ownDemotedTotal` is all-guard by the plan's own specification, so the two numbers can never literally match even though the recount's own per-guard breakdown (`ceiling: 18`) independently corroborates the diff's figure exactly.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 3 (`compute-pr-ceiling-recount.mjs` created, `compute-pr-ceiling-recount.test.mjs` created, `package.json` modified)

## Accomplishments

- `readShippedJson(path)` reads either shipped document, never throwing — `{ ok: false, reason }` naming the path and underlying error on any failure, `{ ok: true, doc }` otherwise, copying `compute-pace-quality-recount.mjs`'s (Phase 27, D-03) precedent shape verbatim.
- `recountDemoted(bestEffortsDoc)` recomputes `ownDemotedTotal` from the raw `activities[*].efforts[*].demotion` field (never from `totals.effortsDemoted`), with a per-guard breakdown (`world-record`/`max-speed`/`ceiling` plus an `unrecognisedGuards` list), a per-distance breakdown keyed off `Object.keys(doc.rankings).sort()`, the `rankedButDemotedIds` and `demotedWithoutReason` cross-checks (both empty on the live archive), both totals-disagreement booleans reported with both numbers named separately, and the pinned-fixture line for `4556693525`.
- `recountImpossibleSampleCohort(indexDoc)` reports the PR-05 cohort against a live-recomputed denominator (never a literal): `archiveDenominator` 1,890, `cohortCount` 662 (35.0%), `rowsMissingQuality` 0 — reproducing the historically-cited 662 figure exactly, but derived fresh from today's document rather than asserted.
- `computeCohortOverlap` reports the two populations' overlap in both directions as findings, never thresholds: 35 cohort activities also carry a demoted effort, 627 do not (an impossible sample mid-run that never landed in a swept window), and 1 demoted activity sits outside the cohort (the ceiling catching window-level implausibility the per-sample floor does not) — a 5.3% bite rate.
- The zero-import guard (`grep -vE '^\s*(//|\*|/\*)' ... | grep -cE "best-effort-ceiling|compute-best-efforts|best-effort-utils|best-effort\.types"`) returns 0, and the test file's own stripper is demonstrated working via a self-test fixture before being trusted against the real source.
- `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` — 10 describe blocks, 24 tests, all pass.
- The real Criterion-5 reconciliation was performed (not assumed) — see Reconciliation Finding below.

## Task Commits

Each task was committed atomically:

1. **Task 1: The classifier-independent recount of demoted efforts** - `93b810d6` (feat)
2. **Task 2: The impossible-sample cohort dry-run count and its overlap with the demoted set** - `a0e7080f` (feat)
3. **Task 3: Test the recount, guard the zero-import discipline, and reconcile against the diff** - `b76f815a` (test)

_No separate plan-metadata commit — SUMMARY.md is committed by the orchestrator's worktree merge flow (STATE.md/ROADMAP.md excluded per worktree isolation)._

## Files Created/Modified

- `scripts/compute-pr-ceiling-recount.mjs` - `readShippedJson`, `recountDemoted`, `recountImpossibleSampleCohort`, `computeCohortOverlap`, `evaluateReport`, `parseExpectFlags`, and a self-execution-guarded `main()` printing the full labelled block
- `scripts/compute-pr-ceiling-recount.test.mjs` - 10 describe blocks / 24 tests: the zero-import guard (with its own stripper self-test), `recountDemoted` fixtures (multi-guard split, totals-disagreement-but-own-number-still-reported, ranked-but-demoted, reason-less demotion, unrecognised guard, pinned-fixture-absent), `recountImpossibleSampleCohort` (document-derived denominator, missing-quality counted separately), `computeCohortOverlap` (1/1/1 three-way case), `evaluateReport` (clean pass plus one named-problem case per structural finding, `--expect-demoted`, `--expect-cohort`), `parseExpectFlags`, `readShippedJson`, and an import-time-side-effect guard
- `package.json` - added `"compute-pr-ceiling-recount": "node scripts/compute-pr-ceiling-recount.mjs"` (no `npm run build` chained, deliberately — this script imports nothing from `dist/`)

## Reconciliation Finding (Criterion 5) — a real mismatch, recorded rather than forced

`28-DIFF.md`'s Reconciliation section states: *"This report counts **18** total ceiling-demoted efforts across all distances... This is the figure plan 28-08's classifier-independent recount... must reproduce."*

Running the reconciliation for real:

```
$ node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 18
```

**Exit code: 1** (MISMATCH). Verbatim relevant stdout:

```
Recomputed demoted total (own arithmetic, activities[*].efforts[*].demotion): 52
  Per-guard breakdown (own arithmetic):
    world-record: 19
    max-speed:    15
    ceiling:      18
    unrecognised guards: 0
  Per-distance breakdown (own arithmetic):
    10k: 0
    1k: 11
    1mi: 5
    400m: 36
    5k: 0
    half: 0
    marathon: 0
  Cross-check vs. doc.totals.effortsDemoted: own=52 totals=52 disagrees=false
  Cross-check ownRejectedNonErrorRows vs. ownDemotedTotal: rejected=52 demoted=52 disagrees=false
  rankedButDemotedIds (0): (none)
  demotedWithoutReason (0): (none)
  Pinned fixture 4556693525@400m: durationSec=45.2 guard=null durationMatches45_2=true guardIsCeiling=false
  --expect-demoted 18: MISMATCH
...
FAIL:
  - recomputed ownDemotedTotal (52) does not equal --expect-demoted 18
```

**Root cause, not a script bug:** Task 1's own specification for `ownDemotedTotal` is explicit — "its own count of `activities[*].efforts[*]` whose `demotion` is a non-null object with a string `guard`" — with no guard-type filter. That counts **all three** guards (`world-record` 19 + `max-speed` 15 + `ceiling` 18 = 52), which is by construction the exact same population as `doc.totals.effortsDemoted` (also 52 — confirmed via a separate `--expect-demoted 52` run, which passes). `28-DIFF.md`'s "18," by contrast, is explicitly **ceiling-only** by 28-07's own stated design (world-record/max-speed demotions are dropped identically from both the OLD and NEW reconstructions and can never produce a flag flip, so 28-07 deliberately excludes them from its own count).

So the two numbers measure different populations by design, and `ownDemotedTotal` — as Task 1 specifies it — can never equal 18 while any pre-existing absolute-guard demotions exist (they always will: the world-record and max-speed guards are unconditional). This is **not** a defect in either 28-07's diff or this recount; it is a genuine ambiguity in what "the reconciling number" means for Criterion 5: the all-guard total shipped in `totals.effortsDemoted`, or the ceiling-only mechanism count 28-08 was newly added to validate.

**What the independent recount DOES corroborate, exactly:** its own `byGuard.ceiling` breakdown — computed from the raw per-effort field, with no read of any total — is **18**, matching `28-DIFF.md`'s stated figure precisely. A second run with `--expect-demoted 52` (the all-guard total) also passes cleanly, confirming the shipped `totals.effortsDemoted` field is internally consistent with the raw per-effort data. So the ceiling mechanism's own count independently reconciles; only the CLI's single `--expect-demoted` flag, compared against the deliberately all-guard `ownDemotedTotal` per Task 1's spec, cannot be the vehicle for checking the ceiling-only figure. This is flagged for the developer's attention at plan 28-09's checkpoint: Criterion 5 should either target `byGuard.ceiling` specifically, or 28-DIFF.md's Reconciliation section should be read against `totals.effortsDemoted` (52) rather than its own ceiling-only count (18) — both are true statements about the same document, but only one can be "the" number `--expect-demoted` checks.

Per the plan's explicit instruction ("do not adjust either side to make them agree; a mismatch... is a real finding") and the orchestrator's anti-circularity directive, no code was changed to force this to pass.

## Decisions Made

- **`ownDemotedTotal` stays all-guard, not ceiling-filtered**, exactly as Task 1 specifies — see Reconciliation Finding. Filtering it to ceiling-only to make `--expect-demoted 18` pass would have made the recount agree with the diff by construction rather than by independent measurement, which is the exact failure mode D-15 exists to prevent.
- **`archiveDenominator` for the cohort is `data/dashboard/index.json`'s full row count (1,890)**, not the 1,865-activity best-efforts population. The plan says "the live row count, recomputed at run time" for the document that carries the cohort field; the index document's own `activities.length` is that count today (it includes the 25 activities without a committed stream, absent from `best-efforts.json`).
- **`--expect-demoted` / `--expect-cohort` are strictly additive.** They can only add a mismatch problem to `evaluateReport`'s output; they can never suppress one of the five structural findings (ranked-but-demoted, reason-less demotion, either totals disagreement, unrecognised guard, unreadable input) — per T-28-08-C.

## Deviations from Plan

None — plan executed exactly as written. The Reconciliation Finding above is not a deviation from the plan; it is the plan's own designed outcome-path ("If it fails, record the two numbers and stop... a mismatch... belongs in the summary as one") triggered by the tool actually performing its job.

## Issues Encountered

- The reconciliation run's exit code is genuinely 1 (`FAIL`), not 0, because of the guard-scope ambiguity documented above. This is disclosed rather than smoothed over. `node scripts/compute-pr-ceiling-recount.mjs` with no flags (its default, unconditional-pass form) exits 0, as does `--expect-demoted 52` and `--expect-cohort 662`.
- `npm test` in this fresh worktree shows 6 failing test files, all pre-disclosed by the orchestrator's wave note as archive/build-dependent gaps absent from a fresh git worktree (`dist/widgets/...`, `data/stats/weekly-distance.json`, `gear-aggregate.json`, `training-load.json`, `year-over-year.json`, and `node_modules/chartjs-plugin-zoom`'s dist file) — none of which this plan's scope touches or creates. `npx tsc --noEmit` is clean and `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` passes 24/24. 2,119 of 2,130 total tests pass; the 11 skipped and 6 failing files are unrelated to this plan.
- `data/stats/best-efforts.json` and `data/dashboard/index.json` do not exist in a fresh worktree (both gitignored); they were generated locally via `npm run build && node dist/index.js compute-best-efforts && node dist/index.js compute-dashboard-index` before running the recount, per the orchestrator's disclosed worktree setup note. Neither file is committed by this plan — `git status --short data/ .planning/` shows no change attributable to running the recount script itself (confirmed after every invocation).

## Requirements

**No requirement ticked in this plan.** PR-04 ("reviewed by a human before ship") and PR-05 ("the guard must be demonstrated rejecting [the pinned fixture]") both require evidence this autonomous, non-checkpoint plan cannot itself produce — PR-04's human review and PR-05's guard-rejection demonstration are, per this phase's own established pattern (28-01 through 28-07 all left `REQUIREMENTS.md`'s PR-01..PR-05 checkboxes `[ ]` Pending despite several of those plans' own frontmatter naming the same IDs), deferred to plan 28-09's phase-closing checkpoint. `requirements-completed: []` is deliberate, not an omission — this plan's contribution feeds that checkpoint's evidence rather than substituting for it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/compute-pr-ceiling-recount.mjs` and its test are committed and regenerable: `npm run compute-pr-ceiling-recount` runs against the live archive with no `npm run build` dependency.
- Plan 28-09's checkpoint should be given the Reconciliation Finding above verbatim: `28-DIFF.md`'s "18" and this recount's `ownDemotedTotal` (52) measure genuinely different populations by design (ceiling-only vs. all-guard), while the recount's `byGuard.ceiling` (18) and a `--expect-demoted 52` run both independently corroborate every number already shipped. The developer should decide which is "the" Criterion-5 reconciling figure going forward, or accept both as correct-but-different.
- The PR-05 cohort (662/1,890, 35.0%) and its overlap with the demoted set (35 cohort activities also demoted, 627 not, 1 demoted activity outside the cohort, 5.3% bite rate) are now reported archive-wide with a live denominator rather than resting on the phase's cited-from-research 662/1,865 figure — available for 28-09's checkpoint to cite directly.
- The pinned fixture `4556693525`'s 400m effort (`durationSec: 45.2`, matching D-04's corrected figure) currently carries `demotion: null` in the shipped document — it is excluded from records via the pre-existing manual exclusion list (`excludedFromRecords: true`), not via the ceiling guard. This recount reports the fact without gating on it, per the plan's own instruction that plan 28-05's unit test is the gate for that fixture's guard behavior — but it is worth 28-09's attention alongside the Reconciliation Finding, since PR-05's requirement text (still citing the stale pre-correction 44.0s/9.09 m/s figure in `REQUIREMENTS.md`) expects "the guard must be demonstrated rejecting it," and the shipped document currently shows this specific activity being kept out of rankings by exclusion rather than by guard rejection.

## Known Stubs

None — every export is fully implemented against its stated contract; `recountDemoted`, `recountImpossibleSampleCohort`, `computeCohortOverlap`, `evaluateReport` and `parseExpectFlags` are all live, tested against synthetic fixtures AND the real shipped documents.

## Threat Flags

None. All four threats named in this plan's `<threat_model>` are exactly the surfaces this plan's own code touches: T-28-08-A (unreadable/truncated document) is closed by `readShippedJson`'s `{ ok: false, reason }` shape and `main()`'s `readErrors` handling; T-28-08-B (the verifier being made to agree with the classifier) is closed by the zero-import guard, demonstrated working via a self-test rather than assumed; T-28-08-C (`--expect` manufacturing a pass) is closed by `evaluateReport`'s additive-only problem list; T-28-08-D (schema drift silently absorbed) is closed by `unrecognisedGuards`, `rowsMissingQuality` and `demotedWithoutReason` all being named findings; T-28-08-SC (package installs) does not apply — zero packages installed.

## Self-Check: PASSED

All created/modified files verified present on disk (`scripts/compute-pr-ceiling-recount.mjs`,
`scripts/compute-pr-ceiling-recount.test.mjs`, `package.json`, this summary). All three task
commits (`93b810d6`, `a0e7080f`, `b76f815a`) confirmed present in `git log --oneline --all`. No
missing items.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-11*
