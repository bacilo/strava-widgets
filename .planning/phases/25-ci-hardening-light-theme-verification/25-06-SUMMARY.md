---
phase: 25-ci-hardening-light-theme-verification
plan: 06
subsystem: testing
tags: [vitest, ci, verify-dashboard-publish, gh-workflow, worktree-environment]

# Dependency graph
requires:
  - phase: 25-ci-hardening-light-theme-verification (waves 1-2)
    provides: FIX-02 (25-01), CI-01's step table (25-02), CI-02's six by-name assertions (25-03), WR-19's directory guard (25-04), D-06's theme-bootstrap parity pin (25-05) — the integration gate this plan proves
provides:
  - "A green five-command gate (npm test x3, tsc --noEmit, build, build-widgets, verify-dashboard) run on the wave-1/2-merged tree, with a fully reconciled test tally (62 files / 1596 tests, +2 files / +36 tests over the 60/1560 pre-planning baseline, no unexplained delta)"
  - "The D-11 RED observation log for 25-01/25-03/25-04 transcribed verbatim into 25-VALIDATION.md"
  - "Every automatable row in 25-VALIDATION.md's Per-Task Verification Map resolved, except the manual VER-01 row (25-07) and the live-workflow-run half of the CI-01/D-03 row (recorded blocked, not fabricated)"
affects: [25-07 (VER-01 human checkpoint and phase disposition), gsd-execute-phase orchestrator (owns the post-merge gh workflow dispatch this plan could not perform)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regenerate gitignored data/stats + data/dashboard locally via npm run build + node dist/index.js compute-all-stats before running the integration gate in a fresh worktree, per the 25-03 precedent, rather than symlinking the main checkout's copies (symlinks defeat the directory-shaped .gitignore patterns and show as untracked)"

key-files:
  created:
    - .planning/phases/25-ci-hardening-light-theme-verification/25-06-SUMMARY.md
  modified:
    - .planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md

key-decisions:
  - "Task 2 (dispatch a real gh workflow run) was NOT executed. This worktree-isolated parallel executor found that completing it would require pushing this worktree's branch to origin/master ahead of the orchestrator's own wave-3 merge-back, and that daily-refresh.yml's Deploy/Commit steps carry no branch guard, so any workflow_dispatch — even against a non-master ref — triggers a real production Pages deploy and a real data commit to origin. Recorded as a blocked gap in 25-VALIDATION.md rather than attempted under pressure or faked, per the house rule since plan 16-09."

requirements-completed: []  # Per this plan's own <output> instruction: automated evidence alone is not sufficient: VER-01 is a human checkpoint (plan 25-07's scope), and this plan additionally could not complete Task 2's live-run evidence — plan 25-07 (or a follow-up) sets disposition.

# Metrics
duration: ~20min
completed: 2026-09-04
---

# Phase 25 Plan 06: Wave-1 Integration Gate & D-11 Evidence Consolidation Summary

**Ran the five-command gate three times on the wave-1/2-merged tree (62 files / 1596 tests, zero unexplained delta over the 60/1560 baseline, verify-dashboard 56/56), transcribed the D-11 RED evidence from three prior plans into `25-VALIDATION.md`, and recorded — rather than attempted or faked — a real architectural blocker on Task 2's live `gh workflow run` dispatch.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-04T06:16:00Z (approx, first `npm test` run)
- **Completed:** 2026-09-04T06:24:40Z
- **Tasks:** 2 (Task 1 complete; Task 2 blocked and documented, not completed)
- **Files modified:** 1 (`25-VALIDATION.md`)

## Accomplishments

- All five gate commands (`npm test`, `npx tsc --noEmit`, `npm run build`, `npm run build-widgets`, `npm run verify-dashboard`) exit 0 on the merged tree.
- Three consecutive `npm test` runs are byte-identical in tally: `62 passed (62)` files / `1596 passed (1596)` tests, ~6.65-6.89s each — matching the orchestrator context's stated main-checkout tally exactly.
- Tally fully reconciled against the 60/1560 pre-planning baseline: +2 files (`compute-all-stats-steps.test.ts`, `theme-bootstrap-parity.test.ts`) and +36 tests, attributed 8 (25-01) + 10 (25-02) + 1 (25-04) + 17 (25-05) = 36, with zero unexplained residue.
- `npm run verify-dashboard` reports `56 check(s) passed, 0 failure(s).` — up from the 40/40 recorded at the end of Phase 24, as the plan's acceptance criteria required.
- The D-11 RED observation log (25-01's 8 gear-aggregate cases, 25-03's six CI-02 assertions, 25-04's WR-19 fixture) is transcribed verbatim, not paraphrased, into a new `## D-11 RED Observation Log` section.
- Every Per-Task Verification Map row now has a non-⬜ status except the manual VER-01 row (25-07's scope) and the live-run half of the CI-01/D-03 row (recorded blocked — see Deviations).

## Task Commits

1. **Task 1: Run the five-command gate on the integrated tree and reconcile the test tally** - `cf9beed5` (docs)
2. **Task 2: Trigger a real nightly run and prove the collapsed step's log carries what the eight step names did** - `2e23720b` (docs) — **NOT completed as specified; recorded as a blocked gap instead.** See Deviations below.

**Plan metadata:** committed as part of this worktree's history; the orchestrator applies the final metadata commit after merge (per this plan's worktree-mode instructions, STATE.md/ROADMAP.md are explicitly out of scope for this agent).

## Files Created/Modified

- `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md` - Per-Task Verification Map statuses resolved (all automatable rows green); new `## D-11 RED Observation Log` section (verbatim transcription from 25-01/25-03/25-04); new `## Wave 1 Integration Gate` section (five commands, exit codes, three `npm test` tallies, tally reconciliation table); new `## CI-01 live run evidence — blocked` section documenting why Task 2 was not executed; Wave 0 Requirements checkboxes ticked (all four items confirmed landed); Validation Sign-Off checklist partially ticked (leaving `nyquist_compliant` and the D-05-disclosure item for plan 25-07, per this plan's own instruction).

## Decisions Made

- **Regenerated `data/stats`/`data/dashboard` locally rather than symlinking them from the main checkout.** First attempt symlinked both directories plus `node_modules` from `/Users/pedf/workspace/strava-widgets` into this worktree to work around the documented worktree-environment gap (empty `node_modules`, absent gitignored data trees). This got the suite running but left `git status --porcelain data` non-empty (`?? data/dashboard`, `?? data/stats`) — a symlink to a directory does NOT match a trailing-slash `.gitignore` pattern the way a real directory does, which would have failed this plan's own acceptance criterion that the gate touch no archive file. Removed the symlinks and instead ran `npm run build` + `node dist/index.js compute-all-stats` to regenerate both trees for real (mirroring 25-03-SUMMARY.md's identical precedent), which produces real gitignored directories that DO match the pattern. `node_modules` itself stayed partially symlinked (only the one missing package, `chartjs-plugin-zoom`, symlinked in at `node_modules/chartjs-plugin-zoom` — the top-level `node_modules/` directory already existed in the worktree with Vite's own caches, so a first attempt to symlink the whole directory nested inside itself instead of replacing it, corrected once diagnosed). `node_modules/` is wholesale gitignored regardless of symlink vs. real content, so this did not affect the data-cleanliness criterion.
- **Task 2 was not attempted.** See Deviations below — this is the plan's single significant deviation and is documented at length in `25-VALIDATION.md`'s new "CI-01 live run evidence — blocked" section rather than only here, since it is load-bearing evidence for the phase, not just an execution note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Symlinked data/node_modules workaround initially broke the "no archive file touched" acceptance criterion**
- **Found during:** Task 1, post-gate `git status --porcelain data` check
- **Issue:** Symlinking `data/stats` and `data/dashboard` from the main checkout let the test suite run, but the symlinks themselves showed as untracked (`?? data/stats`, `?? data/dashboard`) because a symlink does not match the directory-trailing-slash `.gitignore` patterns `data/stats/`/`data/dashboard/` the same way a real directory does.
- **Fix:** Removed both symlinks; ran `npm run build` + `node dist/index.js compute-all-stats` to regenerate both trees for real from the local archive (identical to 25-03-SUMMARY.md's own "Local data regeneration" precedent). Reverted the incidental `data/geo/geo-metadata.json` `generatedAt` timestamp churn this run caused, via `git checkout --`, before staging — same as 25-03's own handling of the identical side effect.
- **Files modified:** none tracked (data/stats, data/dashboard are gitignored; geo-metadata.json reverted, not committed)
- **Verification:** `git status --porcelain data` empty after the fix; three subsequent `npm test` runs plus `verify-dashboard` all green against the regenerated tree.
- **Committed in:** n/a (working-tree setup step, not a committed change)

### Not Auto-fixed — Recorded as a Blocked Gap

**Task 2 (dispatch a real `gh workflow run "Daily Widget Refresh"` and record the collapsed compute step's log) was examined and deliberately not executed.**
- **Found during:** Task 2, before any push or dispatch attempt
- **Issue:** Task 2's own instructions require pushing the wave-1 work to `origin/master` first. This worktree is isolated (`worktree-agent-a78f7a54399d5e4ff`), branched from a commit (`92caadfb`) that `origin/master` has since advanced two auto-commits past, and this worktree's own commits (including this plan's Task 1) have not yet been merged into the orchestrator's local `master`, let alone pushed to `origin/master`. Separately, `daily-refresh.yml`'s `Deploy widgets to GitHub Pages` and `Commit updated data and stats` steps carry no `github.ref` branch guard (confirmed via `grep -n "if:\|github.ref" .github/workflows/daily-refresh.yml`), so a `workflow_dispatch` run against ANY ref — including a worktree branch pushed under a different name — still deploys to the live production site and commits data to `origin`. There is no safe, side-effect-free way to gather this evidence from inside an unmerged parallel worktree.
- **Action taken:** Not fixed, not attempted, not faked. Documented at length in `25-VALIDATION.md`'s new `## CI-01 live run evidence — blocked` section, with the reasoning and a recommended resolution (orchestrator or a follow-up single-context execution dispatches the workflow after this wave's worktree branches are merged back to `master` and `origin/master` is confirmed to carry `compute-all-stats --ci`).
- **Files modified:** `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md` (documentation of the blocker only; no production side effects)
- **Verification:** `git merge-base --is-ancestor 304afca9f0f18b863583cbfe0f0cdd32fde01311 origin/master` returns false (confirms the divergence claim); `grep -n "if:\|github.ref" .github/workflows/daily-refresh.yml` returns only the two unrelated `Warn on *` conditionals (confirms the no-branch-guard claim).
- **Committed in:** `2e23720b`

---

**Total deviations:** 1 auto-fixed (Rule 1, worktree-environment workaround correction), 1 recorded-not-fixed (a real architectural/production-impact blocker, not a code defect).
**Impact on plan:** Task 1's automated evidence is complete, green, and reconciled with no unexplained gaps. Task 2's live-run evidence is genuinely outstanding and is surfaced as a gap for the phase rather than hidden — this is a finding about the wave-3 parallel-worktree execution architecture colliding with a plan written for serial execution on an already-pushed tree, not a defect in any of waves 1-2's code.

## Issues Encountered

The worktree's own `node_modules/` and gitignored `data/stats`/`data/dashboard` trees were empty on entry, consistent with the orchestrator's own prompt context describing this as a known worktree-environment gap. Resolved via local regeneration (see Decisions Made above) rather than treated as an unfixable environment issue, since this plan's entire purpose requires a genuinely green gate, unlike prior plans in this phase where the same gap was correctly left as an out-of-scope, logged-not-fixed item (their own tasks did not depend on a fully green whole-suite run).

## User Setup Required

None from this plan directly. The blocked Task 2 will require a `gh workflow run "Daily Widget Refresh"` dispatch by whoever performs the recommended follow-up (orchestrator or a non-worktree execution) after this wave merges — no new external service configuration, since `gh` is already authenticated in this environment (confirmed: `gh auth status` shows an active `bacilo` account with `repo`+`workflow` scopes).

## Next Phase Readiness

- The automated half of ROADMAP criterion 5 (items 1-3: green `verify-dashboard-publish.mjs` run, reconciled test tally) is discharged and documented in `25-VALIDATION.md`.
- Item 4 (real nightly workflow execution, D-01's live-log proof) is genuinely outstanding — recorded as a blocked gap, not silently dropped. Whoever runs the recommended follow-up should re-read `25-VALIDATION.md`'s "CI-01 live run evidence — blocked" section before dispatching, since it also documents the pre-dispatch check (`git show origin/master:.github/workflows/daily-refresh.yml | grep -c "compute-all-stats --ci"` must return 1 BEFORE dispatching) that Task 2's own acceptance criteria required.
- Per this plan's own `<output>` instruction, `requirements-completed` is empty — VER-01 stays with plan 25-07's human checkpoint, and this plan's own incomplete Task 2 is an additional reason no requirement or ROADMAP gate should close here.
- No blockers for plan 25-07 itself (the VER-01 human checkpoint round) — it does not depend on Task 2's live-workflow-run evidence, only on this plan's automated gate (which is complete) and the D-04-amended manual verification rows.

---
*Phase: 25-ci-hardening-light-theme-verification*
*Completed: 2026-09-04*
