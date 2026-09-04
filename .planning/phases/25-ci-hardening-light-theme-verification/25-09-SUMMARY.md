---
phase: 25-ci-hardening-light-theme-verification
plan: 09
subsystem: verification-planning
tags: [checkpoint-row-discipline, gap-closure, reachability-proof, first-paint, ci-workflow]

# Dependency graph
requires:
  - phase: 25-ci-hardening-light-theme-verification
    provides: "GAP-25-01 capture-mechanism reachability proof (plan 25-08) — Candidate C (throttled, 1000ms) selected, measured 3/3 wins + bidirectional negative control"
  - phase: 25-ci-hardening-light-theme-verification
    provides: "Round 1 Checkpoint (R1-R6, plan 25-07) — R1/R3/R4/R5 PASS, R2/R6 BLOCKED, GAP-25-01/GAP-25-02 opened"
provides:
  - "Round 2 Checkpoint (R6a, R6b, R6c, R7) drafted in 25-VALIDATION.md — governing rules, row-to-requirement map, four fully drafted rows, all verdicts pending"
  - "ROW_BASELINE_SHA anti-tamper reference for plans 25-10/25-11 to diff against"
affects: [25-10, 25-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One row per requirement (GAP-25-02's split), drafted before any row runs, so a missing item withholds only its own requirement"
    - "Bidirectional reachability proof (CAN FAIL / CAN PASS) written into every row before it is scored"

key-files:
  created: []
  modified:
    - .planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md

key-decisions:
  - "R7 replaces R2 rather than reusing it, grounded in plan 25-08's measured Candidate C mechanism rather than an assumed one"
  - "R6 split into R6a (FIX-02)/R6b (CI-02)/R6c (CI-01) per GAP-25-02's recommendation, drafted before any of the three is run"
  - "Disclosed the negative control's intact-copy +8ms-after-first-paint reading honestly in R7's reachability proof rather than treating the bidirectional proof as flawless"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-09-04
---

# Phase 25 Plan 09: Draft Round 2 Checkpoint Rows (R6a, R6b, R6c, R7) Summary

**Drafted all four Round 2 checkpoint rows — the GAP-25-02 R6 split (R6a/FIX-02, R6b/CI-02, R6c/CI-01) and the GAP-25-01 replacement first-paint row R7/VER-01 — each with a stated discriminator, an enumerated evidence requirement, and a bidirectional CAN FAIL/CAN PASS reachability proof, with every Verdict cell reading `pending`.**

## Rows drafted

| Row | Requirement | Discriminator (one line) |
|---|---|---|
| R7 | VER-01 | Captured raster frame's background colour, provably at-or-before that navigation's own `first-paint`: `rgb(26, 26, 46)` = PASS, `rgb(255, 255, 255)` = FAIL, unreachable timing = BLOCKED (not PASS) |
| R6a | FIX-02 | All five gate commands exit 0 on the pushed commit AND all eight D-12 gear-aggregate regression cases (four shapes × two functions) present and passing, enumerated by name |
| R6b | CI-02 | `verify-dashboard` exits 0 with `56 check(s) passed, 0 failure(s).` (or higher/0-failure) AND each of the six D-09/D-10 documents individually present among the passing checks |
| R6c | CI-01 | All four GAP-25-02 clauses together: pushed-workflow grep returns 1, a dispatched run's conclusion is `success`, the collapsed step's log carries all eight `COMPUTE_ALL_STATS_STEPS` names in order, and the dispatch is non-worktree/developer-authorised |

All four rows are new text in `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md`, under `## Round 2 Checkpoint (R6a, R6b, R6c, R7)`, positioned after the Round 1 section and before `## Validation Sign-Off`. None was run.

## Reachability proofs

**R7 (VER-01):**
- CAN FAIL — plan 25-08 Part B's negative control: stripped-bootstrap copy sampled `rgb(255, 255, 255)` at `8247.048 ms`, first-paint `8256 ms` (`beats_first_paint: true`), under the identical throttled mechanism and dark OS. A broken pre-paint bootstrap is demonstrably detectable.
- CAN PASS — plan 25-08 Part A's three production runs (C-1 +10.3 ms, C-2 +8.3 ms, C-3 +5.2 ms, all `beats_first_paint: true`, correct `rgb(26, 26, 45)` colour) plus Part B's intact copy sampling `rgb(26, 26, 45)`. This is the exact clause R2 could not satisfy.
- Disclosed honestly rather than smoothed over: the negative control's own *intact* copy landed `8 ms` **after** first paint (`beats_first_paint: false`), so the PASS direction rests on the three production runs, not on that specific control number. Stated explicitly in the row as a residual risk, not buried.

**R6a (FIX-02):**
- CAN FAIL — the D-11 RED Observation Log's eight verbatim vitest failures against the unwidened predicate (`TypeError` at `gear-aggregate-logic.ts:43:6`, `label.toLowerCase is not a function`, four `expected 1 to be +0` assertions).
- CAN PASS — the identical five-command gate already green on the wave-1/2 merged tree, three consecutive identical 62-file/1596-test tallies.

**R6b (CI-02):**
- CAN FAIL — the D-11 log's six break/restore cycles, each quoting a failure line naming its own document.
- CAN PASS — the same `verify-dashboard` command already returning `56 check(s) passed, 0 failure(s).` on the merged tree.

**R6c (CI-01):**
- CAN FAIL — concretely true right now: `git show origin/master:.github/workflows/daily-refresh.yml | grep -c "compute-all-stats --ci"` returns `0` (re-confirmed against `origin/master` @ `b155fe82bb0e75be599c09dbb783cdea0fb43b71` during this plan's execution), so a dispatch today would run the old eight-step workflow.
- CAN PASS — local `master`'s `daily-refresh.yml:96-97` already carries the collapsed step, `gh 2.86.0` authenticated, `workflow_dispatch` configured.

## Disclosures carried

- D-04's amendment disclosure (original literal-`null` wording unreachable per `main.ts:29`; amended to `null`-or-`'auto'`) — cross-referenced by section name from the Round 1 section, not restated.
- D-05's dark-OS deviation disclosure (first-paint observed on dark OS, not light, so white is an unambiguous failure) — cross-referenced by section name.
- New slowed-load disclosure for R7 (R7-specific, same weight as D-04/D-05): `Network.emulateNetworkConditions` with `latency: 1000ms, downloadThroughput/uploadThroughput: 6400 B/s`, argued to be unable to manufacture a pass because it touches only network timing, never `Emulation.setEmulatedMedia` or `data-theme`.

## Not run

Every Verdict cell in the Round 2 section reads `pending`. No row was run, no evidence was gathered against a live system, and no requirement's checkbox state changed. `requirements-completed` for this plan is empty by design — drafting a row ticks nothing. Plan 25-10 runs R7; plan 25-11 runs R6a/R6b/R6c.

## Row baseline commit

`ROW_BASELINE_SHA: bf9d1a139fae3563e431981709f3fb0883a9d7ee`

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-04 (continuation of the same session as plan 25-08)
- **Completed:** 2026-09-04
- **Tasks:** 3 (preamble, R7, R6a/R6b/R6c)
- **Files modified:** 1 (`25-VALIDATION.md`, three atomic commits)

## Task Commits

1. **Task 1: Round 2 preamble** — `d56a7406` (docs) — governing rules, row-to-requirement map, R5 staleness caveat, disclosure obligations
2. **Task 2: Draft R7** — `39ed787e` (docs) — replacement first-paint row against 25-08's measured mechanism
3. **Task 3: Draft R6a/R6b/R6c** — `bf9d1a13` (docs) — the GAP-25-02 split, one row per requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Row-heading format corrected to satisfy the plan's own literal automated verify**
- **Found during:** Task 2, immediately after first drafting R7
- **Issue:** Initial draft used a `### R7 — ...` Markdown heading for the row label. The plan's own `<verify><automated>` command for Task 2 is `grep -c "^\*\*R7 "` (bold-paragraph style, matching Round 1's convention of `**R2 — First-paint flash ...**` rather than a header), which would have returned 0 against a `###` heading.
- **Fix:** Changed R7's (and, proactively, R6a/R6b/R6c's) row-label lines to bold-paragraph style (`**R7 — ... .**`), matching Round 1's own convention and satisfying the plan's literal grep checks.
- **Files modified:** `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md`
- **Verification:** `grep -c "^\*\*R7 "` returns 1; `grep -c "^\*\*R6a \|^\*\*R6b \|^\*\*R6c "` returns 3.
- **Committed in:** `39ed787e` (R7), `bf9d1a13` (R6a/R6b/R6c)

**2. [Rule 3 - Blocking] Combined-edit rewritten as three sequential edits for atomic per-task commits**
- **Found during:** After drafting all three tasks' content in a single Edit pass
- **Issue:** All three tasks' content was initially written in one combined Edit against the same anchor point, which would have produced one commit for all three tasks rather than the required atomic per-task commits.
- **Fix:** Reverted the file with `git checkout --` (this file only, no other working-tree state touched) and re-applied the same content in three sequential Edits, one per task, each verified and committed individually before the next was written.
- **Files modified:** `.planning/phases/25-ci-hardening-light-theme-verification/25-VALIDATION.md`
- **Verification:** `git log --oneline -3` shows three distinct commits, one per task, each with its own `git diff --stat` insertion count.
- **Committed in:** `d56a7406`, `39ed787e`, `bf9d1a13`

---

**Total deviations:** 2 auto-fixed (both Rule 3, blocking/process hygiene — no code touched, no scope creep)

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None. This plan is documentation-only; no external service configuration required.

## Next Phase Readiness

- R7 is ready to run in plan 25-10 against `https://bacilo.github.io/strava-widgets/` using `scripts/first-paint-capture.mjs --mechanism throttled --throttle-ms 1000`.
- R6a, R6b and R6c are ready to run in plan 25-11 on the tree pushed to `origin/master`; R6c explicitly requires an authorisation checkpoint before dispatching `gh workflow run`, since both the push and the dispatch have production side effects (live Pages deploy, data auto-commit).
- `ROW_BASELINE_SHA: bf9d1a139fae3563e431981709f3fb0883a9d7ee` is the anti-tamper reference plans 25-10/25-11 should diff their copy of the Round 2 rows against, to prove no row text was edited after its outcome was seen.
- No blockers. `origin/master` still returns `0` for the `compute-all-stats --ci` grep at this plan's execution time (`b155fe82bb0e75be599c09dbb783cdea0fb43b71`), confirming R6c's CAN FAIL paragraph is grounded in a currently-true state, not a stale citation.

---
*Phase: 25-ci-hardening-light-theme-verification*
*Completed: 2026-09-04*
