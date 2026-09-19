---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 05
subsystem: analytics
tags: [best-efforts, pr-plausibility-ceiling, tdd, house-register, string-format]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    provides: "ceilingDemotion, deriveCeiling, the house-register reason string, CEILING_K/CEILING_MIN_POPULATION"
provides:
  - "Margin-bearing, three-decimal demotion reason template in ceilingDemotion"
  - "A thin-margin regression test built from the real 3475730418@1mi figures, closing the observed 4.63-vs-4.63 self-contradiction"
  - "Updated house-register docblock worked example (live 1mi case, not an invented one)"
affects: [31-08 (data/stats/best-efforts.json regeneration), 28-DIFF.md regeneration, PR-04 re-sign]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Reason-string house register extended with an explicit margin clause; RED-then-GREEN across the same file (best-effort-ceiling.test.ts) before touching production code"]

key-files:
  created: []
  modified:
    - src/analytics/best-effort-ceiling.ts
    - src/analytics/best-effort-ceiling.test.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts

key-decisions:
  - "D-10 implemented exactly as specified: margin = impliedSpeedMps - derivation.ceilingMps, computed after the existing guard clauses (always positive by construction since ceilingDemotion already requires implied to strictly exceed ceiling)"
  - "detail-best-efforts-logic.test.ts fixture strings updated for consistency only, with an explicit comment that they are pass-through inputs, not parsed by the badge builder"

patterns-established:
  - "Thin-margin regression test constructs a CeilingDerivation object directly from real archive figures (data/best-effort-ceiling.json's 1mi entry) rather than deriving it through deriveCeiling, so the test pins the exact observed numbers without depending on population reconstruction"

requirements-completed: [TD-04]

# Metrics
duration: ~13min (agent wall-clock across the two task commits)
completed: 2026-09-19
---

# Phase 31 Plan 05: Margin-Bearing Ceiling Demotion Reason Summary

**`ceilingDemotion`'s reason string now states its own margin at three decimals, closing the shipped self-contradiction where 2-dp rounding could make an implied speed and a ceiling read as equal in the same sentence that says one exceeds the other.**

## Performance

- **Duration:** ~13 min (commit-to-commit: `afd4f000` at 13:10:39 to `320f072c` at 13:15:46, plus setup/verification time either side)
- **Started:** 2026-09-19T13:03:19+02:00 (worktree base commit)
- **Completed:** 2026-09-19T13:15:46+02:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `ceilingDemotion` renders implied speed, ceiling, margin and p90 at three decimals and the multiplier at two, with an explicit `by {margin} m/s` clause between the ceiling value and the opening parenthesis
- A house-register regression test demonstrated RED against the pre-fix code (Task 1), then GREEN after the fix (Task 2), reproducing and closing the exact `3475730418@1mi` "4.63 exceeds 4.63" defect recorded in `28-VALIDATION.md` § PR-04 Sign-off (Round 3)
- The house-register docblock's worked example replaced a generic figure with the live case and states the defect the margin closes
- Every enumerated consumer assertion (`compute-best-efforts.test.ts`, `derive-flagged.test.mjs`) confirmed unaffected by a full green `npm test`; no code change was needed in either

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the house-register assertions to demand the margin, and watch them fail** - `afd4f000` (test)
2. **Task 2: Render the margin at three decimals and bring every consumer assertion with it** - `320f072c` (feat)

_TDD plan: RED (Task 1) then GREEN (Task 2), both in `src/analytics/best-effort-ceiling.test.ts`._

## RED Output (Task 1, verbatim — TD-04's demonstrated-failing evidence)

```
✓ src/analytics/best-effort-ceiling.test.ts (20 tests | 3 failed) 9ms
...
 × the reason string matches the house register: implied speed, exceeds personal ceiling, ceiling value, an explicit margin clause, and a parenthetical with multiplier/p90/population (D-10)
   AssertionError: expected 'implied 230.40 m/s exceeds personal c…' to match /…/s exceeds personal ceiling \d+\.\d{3} m\/…
   - Expected: /^implied \d+\.\d{3} m\/s exceeds personal ceiling \d+\.\d{3} m\/s by \d+\.\d{3} m\/s \(\d+\.\d{2} x p90 \d+\.\d{3} m\/s over \d+ filtered \S+ efforts\)$/
   + Received: "implied 230.40 m/s exceeds personal ceiling 230.40 m/s (1.28 x p90 180.00 m/s over 200 filtered 10k efforts)"

 × D-10 house register / thin margin: the live 1mi case (implied 4.630 vs ceiling 4.6281) renders distinct implied and ceiling substrings with a non-zero margin, the exact defect this margin closes
   AssertionError: expected 'implied 4.63 m/s exceeds personal cei…' to contain 'implied 4.630 m/s'
   Expected: "implied 4.630 m/s"
   Received: "implied 4.63 m/s exceeds personal ceiling 4.63 m/s (1.28 x p90 3.62 m/s over 1851 filtered 1mi efforts)"

 × realistic-shape case: a 400m population whose p90 matches the live-measured value demotes an 8.85 m/s effort with the exact reason string
   AssertionError: expected 'implied 8.85 m/s exceeds personal cei…' to be 'implied 8.850 m/s exceeds personal ce…'
   Expected: "implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740 m/s (1.28 x p90 3.992 m/s over 1825 filtered 400m efforts)"
   Received: "implied 8.85 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90 3.99 m/s over 1825 filtered 400m efforts)"

 Test Files  1 failed (1)
      Tests  3 failed | 17 passed (20)
```

Exactly the three reason-string tests failed, for exactly the reason expected (2dp, no margin clause); the other 17 pre-existing tests were unaffected. `git status --porcelain` at that point listed only `src/analytics/best-effort-ceiling.test.ts`.

## Recomputed Exact String (Task 1, arithmetic recorded before writing)

Fixture: `n = 1825`, `p90Mps ≈ 3.992` (index `ceil(0.9*1825)-1 = 1642`, offset zero at that index), `multiplier = CEILING_K = 1.28`, `impliedSpeedMps = 8.85`.

- `ceilingMps = Math.ceil(1.28 * 3.992 * 1e4) / 1e4 = Math.ceil(51097.6) / 1e4 = 51098 / 1e4 = 5.1098` → `toFixed(3)` → `"5.110"`
- `margin = 8.85 - 5.10976... ` — using the un-rounded product `1.28 * 3.992 = 5.10976`: `8.85 - 5.10976 = 3.74024` → `toFixed(3)` → `"3.740"`
- `implied` → `8.85.toFixed(3)` → `"8.850"`
- `p90` → `3.992.toFixed(3)` → `"3.992"`

Final string: `implied 8.850 m/s exceeds personal ceiling 5.110 m/s by 3.740 m/s (1.28 x p90 3.992 m/s over 1825 filtered 400m efforts)` — matches the interface table's stated value and the test's exact-string assertion.

## New Docblock Worked Example (Task 2)

Replaced the previous generic 400m example with the live case, and names the 2dp defect it closes:

> For example, at the live 1mi ceiling of 4.628 m/s derived from 1,851 filtered efforts with p90 3.616 m/s and multiplier 1.28: `implied 4.630 m/s exceeds personal ceiling 4.628 m/s by 0.002 m/s (1.28 x p90 3.616 m/s over 1851 filtered 1mi efforts)`.

The docblock also states directly: "The margin is stated explicitly because at two decimals the sentence could read as self-contradictory — the live `3475730418@1mi` case renders 'implied 4.63 m/s exceeds personal ceiling 4.63 m/s' at 2dp, even though a real 0.002 m/s margin exists."

## `-t "house register"` Match Count (Task 2)

`npx vitest run src/analytics/best-effort-ceiling.test.ts -t "house register"` → **2 passed, 0 failed** (both `best-effort-ceiling.test.ts` tests whose names include "house register" — the regex test and the thin-margin test).

## Full Verification (Task 2)

- `npx vitest run src/analytics/best-effort-ceiling.test.ts` → **20 passed, 0 failed** (all green, including the thin-margin test that was RED in Task 1).
- `grep -o "toFixed(2)" src/analytics/best-effort-ceiling.ts | wc -l` → **1**; `grep -o "toFixed(3)" src/analytics/best-effort-ceiling.ts | wc -l` → **4**. (Note: the plan's literal `grep -c` command undercounts to 1 for both, because all four `toFixed(3)` calls share one source line and `grep -c` counts matching *lines*, not occurrences; the true occurrence count via `grep -o | wc -l` is exactly 4 and 1 as required.)
- `npm test` → **84 files passed, 2551 tests passed, 0 failed** (after `npm run build` to populate `dist/` — see Deviations). `compute-best-efforts.test.ts`'s two `/exceeds personal ceiling/` assertions and `scripts/curate-queue/derive-flagged.test.mjs` untouched and green, as RESEARCH predicted.
- `npx tsc --noEmit` → exit 0, no errors.
- `git status --porcelain data/` → empty. No regeneration happened in this plan.

## Files Created/Modified
- `src/analytics/best-effort-ceiling.ts` — `ceilingDemotion` now computes and renders the margin at three decimals (D-10); house-register docblock's worked example replaced with the live `3475730418@1mi` case
- `src/analytics/best-effort-ceiling.test.ts` — regex test widened to pin the full new shape including the margin clause; exact-string test recomputed for the 400m fixture; new thin-margin test added, built from the real 1mi figures
- `src/dashboard/views/detail-best-efforts-logic.test.ts` — `demotionReason` fixture strings (lines ~331-332, ~340-341) updated to the new format for consistency, with a comment noting they are pass-through inputs only

## Decisions Made
Followed D-10 and the plan's `<action>` blocks exactly: margin computed post-guard-clause, three decimals on implied/ceiling/margin/p90, two on the multiplier, `by {margin} m/s` inserted before the parenthetical. No deviation from the specified template or arithmetic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `npm run build` (tsc) and `npm run build-widgets` to satisfy the plan's own `npm test` acceptance criterion in a bare worktree**
- **Found during:** Task 2 verification (`npm test`)
- **Issue:** The worktree lacks the gitignored `dist/` build output entirely (confirmed via `.gitignore`: `dist/*`, `dist/widgets/*`). Six test files failed with `Cannot find module '../dist/...'` or `ENOENT` on `dist/widgets/data/stats/best-efforts.json` — not a regression from this plan's changes (none of the six files are in this plan's `files_modified` list, and none touch the reason-string format), but a worktree-environment gap the plan's own acceptance criterion ("`npm test` exits 0") requires resolving to demonstrate.
- **Fix:** Ran `npm run build` (`tsc`, pure TypeScript compile, no data mutation) which fixed 5 of 6; ran `npm run build-widgets` (copies existing `data/*.json` into `dist/widgets/data/`, does not regenerate any data file) which fixed the sixth (`verify-dashboard-publish-stats.test.mjs`, which reads `dist/widgets/data/stats/best-efforts.json`). Confirmed `git status --porcelain data/` stayed empty throughout — `dist/` is fully gitignored, so neither command produced any tracked change. Consistent with the project's recorded lesson ("Worktree executors need node_modules + data/ ... fixture failures there are not regressions").
- **Files modified:** none tracked (dist/ is gitignored)
- **Verification:** `npm test` went from 6 failed / 77 passed files to 84/84 files, 2551/2551 tests, exit 0
- **Committed in:** not committed — no tracked files changed

**2. [Rule 1 - Bug, transient] One flaky timeout in a full-suite parallel run, unrelated to this plan**
- **Found during:** Task 2 verification (`npm test`, full run)
- **Issue:** A single test in `compute-best-efforts.test.ts` ("the production file's single deriveCeilings call site sits between the derive pass's own marker and the next pass's marker, with no enclosing loop") timed out at 5000ms once, under worktree filesystem contention from the full parallel suite.
- **Fix:** No code fix needed — re-ran `npx vitest run src/analytics/compute-best-efforts.test.ts` in isolation (46/46 passed in 3.9s, including the two `/exceeds personal ceiling/` assertions) and then re-ran the full `npm test` a second time (84/84 files, 2551/2551 tests, exit 0). Confirmed as environment flakiness, not a regression.
- **Files modified:** none
- **Verification:** Both re-runs green
- **Committed in:** n/a — no code change

---

**Total deviations:** 2 (1 blocking-environment auto-fix, 1 transient flake confirmed non-regression). No scope creep — neither touched a file outside the plan's declared `files_modified`.

## Issues Encountered
None beyond the two deviations above, both resolved without touching production code or committed data.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None.

## Threat Flags
None - this plan's changes stay entirely within the reason-string template `ceilingDemotion` already renders; no new network endpoint, auth path, file access pattern, or schema change was introduced. The three threats named in this plan's `<threat_model>` (T-31-04, T-31-18, T-31-19) are all mitigated per the acceptance criteria above (thin-margin test, full-suite green, docblock example updated).

## Next Phase Readiness
- TD-04 is fully landed in code and pinned by tests; the string format change is ready for the phase's regeneration pass (plan 31-08 and later) to propagate into `data/stats/best-efforts.json`, the Records note, the detail badge, and `28-DIFF.md`
- `data/` was deliberately left untouched by this plan — regenerating `data/stats/best-efforts.json` and re-signing PR-04 against the new sha256 (D-12) is explicitly out of scope here and belongs to a later wave
- No blockers for downstream plans in this phase

## Self-Check: PASSED

- FOUND: `src/analytics/best-effort-ceiling.ts`
- FOUND: `src/analytics/best-effort-ceiling.test.ts`
- FOUND: `src/dashboard/views/detail-best-efforts-logic.test.ts`
- FOUND commit `afd4f000` (test(31-05): widen house-register assertions to demand the margin (TD-04))
- FOUND commit `320f072c` (feat(31-05): state the ceiling demotion reason's margin at three decimals (TD-04, D-10))

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*
