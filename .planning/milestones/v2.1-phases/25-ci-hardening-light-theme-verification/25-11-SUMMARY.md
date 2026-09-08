---
phase: 25-ci-hardening-light-theme-verification
plan: 11
subsystem: ci
tags: [github-actions, workflow-dispatch, checkpoint-verification, gap-closure]

# Dependency graph
requires:
  - phase: 25-ci-hardening-light-theme-verification (plan 25-09)
    provides: "R6a/R6b/R6c drafted, unrun, ROW_BASELINE_SHA bf9d1a139fae3563e431981709f3fb0883a9d7ee"
  - phase: 25-ci-hardening-light-theme-verification (plan 25-10)
    provides: "R7 PASS, GAP-25-01 CLOSED"
provides:
  - "CI-01's first-ever live-run evidence for this phase (dispatched run 33903407761, conclusion success)"
  - "R6a, R6b, R6c scored PASS with quoted evidence"
  - "GAP-25-02 CLOSED"
  - "Local master merged with and pushed to origin/master (67ed20f1), bringing production up to date with Phase 25"
affects: [25-12]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md

key-decisions:
  - "Merged origin/master (not rebase) before pushing — three nightly CI auto-commits, zero conflicts, all auto-generated data"
  - "Developer authorised the push and dispatch (option 'Authorise the push and dispatch') after both production side effects were stated up front; recorded verbatim in R6c's evidence"
  - "R6a and R6b evidence gathered FRESH on the pushed commit rather than citing Wave 1 numbers, per the row's own requirement"

patterns-established: []

requirements-completed: []  # Round 2 disposition is plan 25-12's job under the all-rows-PASS rule

# Metrics
duration: ~20min
completed: 2026-09-04
---

# Phase 25 Plan 11: GAP-25-02 gap-closure — CI-01 live-run evidence and R6a/R6b/R6c scoring Summary

**Merged and pushed Phase 25 to origin/master, dispatched the Daily Widget Refresh workflow for the first time this phase, and scored R6a/R6b/R6c all PASS — closing GAP-25-02 and producing CI-01's only-ever live-run evidence (run 33903407761, conclusion success, all eight COMPUTE_ALL_STATS_STEPS names present in the collapsed step's log in declared order).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-04T17:55:00Z (approx, first Read calls)
- **Completed:** 2026-09-04T18:10:00Z (approx)
- **Tasks:** 3/3 completed
- **Files modified:** 1 (`25-VALIDATION.md`)

## Accomplishments

- Merged `origin/master` into `master` (merge, not rebase) — 69 ahead/3 behind before, 70 ahead/0 behind after, merge commit `70e00840`, zero conflicts (all eleven changed files were auto-generated data).
- Ran the five-command gate fresh on the merged tree: all exit 0; three consecutive `npm test` runs all tallied 62 files/1596 tests, zero delta from the Wave 1 Integration Gate baseline.
- Enumerated and confirmed all eight FIX-02 regression cases by name (R6a) and all six CI-02 documents plus three runtime-sampled shards by name (R6b), both fresh on the pushed commit.
- Obtained the developer's explicit, verbatim-recorded authorisation for the push and dispatch (Task 2 checkpoint, pre-authorised per the orchestrator's exchange).
- Pushed `master` to `origin/master` (`67ed20f1`) — plain fast-forward, no rejection.
- Verified the PUSHED copy of `daily-refresh.yml` carries `compute-all-stats --ci` (grep count 0 → 1).
- Dispatched `gh workflow run "Daily Widget Refresh"`; the dispatched run (`33903407761`, event `workflow_dispatch`) queued behind the push-triggered run (`33903395875`, event `push`) per the `cancel-in-progress: false` concurrency group, then completed with conclusion `success`.
- Extracted the collapsed "Compute all statistics" step's log and confirmed all eight `COMPUTE_ALL_STATS_STEPS` names (enumerated from `src/compute-all-stats-steps.ts`, not read off the log) appear as their own `"> NAME"` line, in declared order, from one invocation, followed by "All statistics generated successfully!" — no `DEGRADED STEPS` summary.
- Scored R6a PASS, R6b PASS, R6c PASS.
- Closed GAP-25-02 with a dated closure note citing the run id, conclusion, and the eight matched step names.

## Task Commits

1. **Task 1: Merge origin/master, run the five-command gate, record R6a/R6b's raw evidence** — `641eefbe` (docs) — merge commit `70e00840` (separate, automatic)
2. **Task 2: Obtain and record developer authorisation** — `67ed20f1` (docs)
3. **Task 3: Push, dispatch, capture live-run evidence, score R6a/R6b/R6c, close GAP-25-02** — `c59e8387` (docs)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified

- `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md` — R6a/R6b/R6c evidence blocks and PASS verdicts, GAP-25-02 CLOSED note, authorisation record

## Authorisation

Recorded verbatim in R6c's evidence block (`25-VALIDATION.md`), timestamp `2026-09-04T17:57:56Z`:

Not-a-parallel-worktree evidence: `git rev-parse --show-toplevel` printed `/Users/pedf/workspace/strava-widgets` — the main checkout, not a `.claude/worktrees/` path.

The orchestrator's question, as presented to the developer:

> Wave 8 (plan 25-11) requires pushing to origin/master, which starts a live production run that deploys to your GitHub Pages site and commits data back to origin. Authorize?
>
> - The push includes src/**, scripts/** and .github/workflows/**, which match the workflow's own push trigger paths. Pushing alone starts a production run — before any dispatch.
> - The commit-and-deploy steps carry no github.ref guard (grep -n "if:|github.ref" returns only the two "Warn on ..." conditionals). So any run — push-triggered or dispatched — deploys to the live GitHub Pages site and commits data back to origin.

The developer's selection, verbatim, from a three-option choice ("hold — stop the phase here", "merge origin/master only, then stop", and this option):

> **Authorize the push and dispatch**
> 25-11 merges origin/master (merge, not rebase), pushes, dispatches the workflow, and gathers R6c's live-run evidence. This deploys to the live Pages site and writes data commits back to origin. It is the only route that closes GAP-25-02 and lets 25-12 set the Round 2 disposition.

Granularity: the developer selected this option by its label alone, with no further wording. This authorises the push and the dispatch only (plan 19-09 precedent) — nothing beyond those two actions was taken.

## Push and pushed-copy verification

- Divergence before merge: 69 ahead / 3 behind `origin/master`.
- `git merge origin/master` (no `--rebase`): `'ort'` strategy, zero conflicts, eleven files changed, all auto-generated data (`data/activities/*`, `data/geo/*`, `data/streams/*`, `data/sync-state.json`).
- Merge commit: `70e00840`. Divergence after: 70 ahead / 0 behind.
- `git push origin master`: `b155fe82..67ed20f1  master -> master` — plain fast-forward, no rejection, no retry needed.
- Pushed-copy grep (GAP-25-02 clause 1): `git show origin/master:.github/workflows/daily-refresh.yml | grep -c "compute-all-stats --ci"` → **before push: `0`** (re-confirmed against `origin/master` @ `b155fe82`), **after push: `1`** (against `origin/master` @ `67ed20f1`).

## Dispatched run

- **Push-triggered run (context):** id `33903395875`, event `push`, conclusion `success`.
- **Dispatched run:** id `33903407761`, event `workflow_dispatch`, conclusion **`success`**, job `refresh-and-deploy` in `2m25s`.
- Collapsed "Compute all statistics" step's log excerpt:
  ```
  2026-09-04T18:02:46.7512079Z Computing all statistics from synced activities...
  2026-09-04T18:02:46.7516206Z > compute-stats
  2026-09-04T18:02:47.0934269Z > compute-advanced-stats
  2026-09-04T18:02:47.4180062Z > compute-geo-stats
  2026-09-04T18:02:47.8421196Z > compute-best-efforts
  2026-09-04T18:02:49.6108789Z > compute-age-grading
  2026-09-04T18:02:49.6255939Z > compute-dashboard-index
  2026-09-04T18:02:49.9455852Z > compute-gear-aggregate
  2026-09-04T18:02:49.9604786Z > compute-training-load
  2026-09-04T18:02:51.0484198Z All statistics generated successfully!
  ```
  All eight names match `COMPUTE_ALL_STATS_STEPS` (`src/compute-all-stats-steps.ts:68-166`), in declared order, from one invocation. No `DEGRADED STEPS` summary appeared (absence not treated as failure, per D-03).

**Observation, recorded not patched (house rule since plan 16-09):** the dispatched run's own `Commit updated data and stats` step failed non-fast-forward — its checked-out ref (`67ed20f1`, resolved at `workflow_dispatch` trigger time) was stale by the time its commit step ran (~2m30s later), because the push-triggered run's own data auto-commit (`7916affb`) had already landed on `origin/master` at `18:00:53Z`. `concurrency: group: widget-refresh, cancel-in-progress: false` serialises the two runs' job execution (the dispatched job did not start until the push run finished at `18:01:07Z`) but does not re-resolve the dispatched run's already-checked-out ref against that intervening commit. The workflow's own tolerant design absorbed it: `::warning::Data commit failed, deploying anyway — sync state not persisted` fired, `Deploy widgets to GitHub Pages` still ran, and the run's overall conclusion is still `success`. Not a defect in any code this phase touched; a pre-existing two-runs interaction the row's own carried-forward hazard note already flagged without fully anticipating this specific ref-resolution timing. Disposition left to the user.

## Row verdicts

- **R6a (FIX-02): PASS.** All five gate commands exit 0 on the pushed commit; three consecutive `npm test` runs all 62 files/1596 tests (zero delta from Wave 1 baseline); all eight named FIX-02 regression cases confirmed passing individually via `--reporter=verbose`.
- **R6b (CI-02): PASS.** `npm run verify-dashboard` → `56 check(s) passed, 0 failure(s).`; all six named documents (weekly-distance, monthly-stats, yearly-stats, year-over-year, best-efforts.json) plus the three runtime-sampled shards (`i182749188`, `6255623192`, `3475743849`) confirmed among the passing checks.
- **R6c (CI-01): PASS.** All four GAP-25-02 clauses satisfied together: pushed copy carries the collapsed step; dispatched run `33903407761` concluded `success`; its collapsed step's log carries all eight `COMPUTE_ALL_STATS_STEPS` names in order plus the success line; dispatch performed from the main checkout with explicit, verbatim-recorded developer authorisation.

## GAP-25-02 disposition

**CLOSED, 2026-09-04 (plan 25-11, Task 3).** R6a, R6b and R6c all PASSED. The split drafted in plan 25-09 is now run: R6a and R6b reconfirmed their already-green evidence fresh on the merged-and-pushed commit, and R6c produced CI-01's live-run evidence for the first time this phase. All four of GAP-25-02's numbered clauses are satisfied. VER-01's, FIX-02's, CI-01's and CI-02's tick disposition is plan 25-12's job under the all-rows-PASS rule; `REQUIREMENTS.md` and `ROADMAP.md` are untouched by this plan.

## Decisions Made

- Merge over rebase for the origin/master divergence (Phase 16 precedent, project memory on CI auto-commit push races).
- Authorisation granularity held strictly to "push and dispatch" only, per plan 19-09 precedent — no broader interpretation of the developer's selection.
- The observed git-race in the dispatched run's data-commit step was recorded as a finding, not patched, per the house rule since plan 16-09.

## Deviations from Plan

None — plan executed exactly as written. Task 2's authorisation was pre-granted via the orchestrator's exchange (per this plan's explicit instruction) rather than re-asked; recorded verbatim as directed.

## Row Baseline Integrity

`git diff bf9d1a139fae3563e431981709f3fb0883a9d7ee -- .planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md` shows exactly four `-` lines across the whole plan's work: R7's verdict cell (already changed by plan 25-10, prior to this plan) plus R6a's, R6b's and R6c's own verdict-line replacements (`pending` → `PASS`, with a short parenthetical citation, matching R7's own established style). Zero `-`/`+` lines fall inside any row's DISCRIMINATOR, INDEPENDENTLY-DERIVED EXTENT, CAN FAIL or CAN PASS paragraphs. `git diff --stat .planning/REQUIREMENTS.md .planning/ROADMAP.md` returns 0 lines.

## Known Stubs

None.

## Threat Flags

None. This plan's threat model already covered the trust boundary crossed (T-25-36 through T-25-40); no new surface was introduced.

## Self-Check: PASSED

- Commit `641eefbe`: FOUND in `git log --oneline --all`
- Commit `67ed20f1`: FOUND in `git log --oneline --all`
- Commit `c59e8387`: FOUND in `git log --oneline --all`
- Merge commit `70e00840`: FOUND in `git log --oneline --all`
- `origin/master` @ `67ed20f1` (post-push, pre-dispatch-commit-race): confirmed via `git fetch` + `git log origin/master`
- Dispatched run `33903407761`: FOUND via `gh run view 33903407761` (conclusion `success`)
- Push-triggered run `33903395875`: FOUND via `gh run list` (conclusion `success`)
- `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md`: FOUND, contains R6a/R6b/R6c PASS verdicts and GAP-25-02 CLOSED note
