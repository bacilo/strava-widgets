---
phase: 24-local-curation-mode
plan: 09
subsystem: ui
tags: [dashboard, best-efforts, exclusions, gap-closure, tdd]

# Dependency graph
requires:
  - phase: 24-local-curation-mode
    provides: "24-02's D-03 attach seam (data-activity-id, dashboard:best-efforts-mounted), 24-06/24-07's curate write path, 24-08's Round 1 checkpoint that recorded R5 FAIL (badge not live-derived)"
provides:
  - "buildBestEffortsPanelRows deriving BestEffortPanelRow.excluded from a live ExclusionIndex, falling back to the precomputed excludedFromRecords flag when the live document is unknown"
  - "detail.ts's loadLiveExclusionState — a single fetch of data/best-effort-exclusions.json returning both the reason string and the parsed live ExclusionIndex"
  - "GAP-24-01 closed in code: the Excluded — {reason} badge is correct on the next paint after a curate Save or untick, with no Recompute and no rebuild"
affects: ["24-10 (Round 2 browser checkpoint that verifies this fix renders correctly)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-derived badge state: read the mutable curation-intent document at render time (records-logic.ts's buildPrTableRows precedent), keep the precomputed field authoritative for computed stats only"
    - "One fetch, two derived views: buildExclusionReasonIndex (activity-wide reason) and buildExclusionIndex (per-distance flag) both parse the same already-fetched body, avoiding a second network round-trip"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/views/detail.ts
    - src/dashboard/curation-seam.test.ts

key-decisions:
  - "liveExclusions is a REQUIRED third parameter (no default), so a forgotten call site produces a tsc error rather than silently reverting to the stale pre-fix behaviour (D-11)"
  - "index: null means UNKNOWN (fetch/parse failure) and falls back to the precomputed excludedFromRecords flag; an EMPTY array yields an EMPTY (non-null) index so an untick clears the badge immediately"

patterns-established:
  - "Both new guards (unit derivation tests, curation-seam.test.ts source-structure guard) were observed failing against a planted regression before being counted as evidence (D-11)"

requirements-completed: []  # CUR-01 stays open — the plan's own <output> states GAP-24-01 is claimed FIXED IN CODE but NOT yet verified in a browser; 24-10's Round 2 checkpoint settles it.

duration: ~20min
completed: 2026-09-01
---

# Phase 24 Plan 09: Live-derived best-efforts exclusion badge (GAP-24-01) Summary

**`buildBestEffortsPanelRows` now reads its `excluded` flag from the live `data/best-effort-exclusions.json` document at render time via a single shared fetch in `detail.ts`, closing the post-Save/pre-Recompute staleness window Round 1's R5 recorded as FAIL — claimed fixed in code, not yet browser-verified.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 (2 TDD commits + 1 verification-only task, no net diff)
- **Files modified:** 4

## Accomplishments
- `BestEffortPanelRow.excluded` derives from a live `ExclusionIndex` (via `isExcluded`) when one was loaded, and falls back to the precomputed `effort.excludedFromRecords` only when the live document is `null` (unknown) — never treating unknown as not-excluded.
- `detail.ts` replaced `loadExclusionReason` with `loadLiveExclusionState`, a single `fetch('data/best-effort-exclusions.json')` that returns both `{ reason, index }`, keeping D-03(b)'s guard/dispatch ordering and the `exclusionReason` local name (so `curation-seam.test.ts:86`'s literal stays byte-identical) untouched.
- Both new guards (6 new unit tests in `detail-best-efforts-logic.test.ts`, 5 new source-structure assertions in `curation-seam.test.ts`) were observed RED before implementation and RED again against two planted regressions in Task 3, per D-11.
- Full five-command gate re-run against a fresh build; both publish guards (curation-artifact scan, `__curate`/write-path 404s) are green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive BestEffortPanelRow.excluded from a live ExclusionIndex, with an honest unknown fallback** - `7b678ea` (feat)
2. **Task 2: One fetch returns both the reason and the live index; wire it through detail.ts** - `17b161f` (feat)
3. **Task 3: Observe both new guards RED against a planted regression, run the full gate, record build identity** - no commit (plant/restore cycle left `git diff --stat` empty; verification-only, no net file change)

**Plan metadata:** committed with this SUMMARY (worktree mode — orchestrator applies STATE.md/ROADMAP.md centrally after merge)

## Files Created/Modified
- `src/dashboard/views/detail-best-efforts-logic.ts` - `buildBestEffortsPanelRows` gains a required third `liveExclusions: ExclusionIndex | null` parameter; `excluded` is `isExcluded(liveExclusions, entry.activityId, distance)` when non-null, else `effort.excludedFromRecords`. Docblock states the disagreement-window and UNKNOWN-not-NOT-EXCLUDED semantics explicitly. `buildPrBadgeLabels` untouched.
- `src/dashboard/views/detail-best-efforts-logic.test.ts` - all 9 existing two-argument `buildBestEffortsPanelRows` call sites updated to pass `null` as the third argument (14 pre-existing assertions preserved); new `describe('GAP-24-01 …')` block adds 6 tests (20 total, up from 14).
- `src/dashboard/views/detail.ts` - `loadExclusionReason` replaced by `loadLiveExclusionState(activityId)`, one fetch returning `{ reason: string | null; index: ExclusionIndex | null }`; `mountBestEffortsAndBadges` binds `liveExclusionState` after the stale-render guard and passes `liveExclusions` as `buildBestEffortsPanelRows`'s third argument.
- `src/dashboard/curation-seam.test.ts` - new `describe('GAP-24-01 …')` block adds 5 purely-additive source-structure guards (no existing assertion deleted); 79 total `it` blocks (up from a measured 74 including nested top-level `it`s before this task — see Deviations for the count discrepancy vs. the plan's stated "11 present").

## Decisions Made
- `liveExclusions`/the third `buildBestEffortsPanelRows` parameter is required, not defaulted, so a missed call site fails `tsc` loudly (`Expected 3 arguments, but got 2`) instead of silently reverting to stale behaviour — confirmed as exactly one, expected error after Task 1 and closed by Task 2.
- `loadLiveExclusionState`'s degradation contract collapses every failure mode (fetch reject, non-ok response, JSON parse throw, non-object body, non-array `exclusions`) to `{ reason: null, index: null }` in one guarded path, mirroring `buildExclusionReasonIndex`'s tolerance discipline rather than duplicating it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `compute-dashboard-index` to unblock `verify-dashboard` from a FATAL pre-check exit**
- **Found during:** Task 3, step (d) (full gate run)
- **Issue:** This worktree checkout has no `data/dashboard/index.json` (gitignored, never generated here) and no `data/stats/*.json` at all. `npm run verify-dashboard` FATAL-exits before running any of its checks when `data/dashboard/index.json` is absent — a stronger failure mode than the ENOENT-per-test-file gap already logged in `deferred-items.md`, and one that would have produced zero verification signal on this plan's own publish-guard checks.
- **Fix:** Ran `node dist/index.js compute-dashboard-index` (the exact remediation `verify-dashboard-publish.mjs`'s own error message names) and re-ran `npm run build-widgets` to copy the freshly generated `data/dashboard/index.json` into `dist/widgets/`. This generates only a gitignored artifact — nothing is committed, and `data/stats/*.json` (also gitignored, absent, and out of this plan's scope) was deliberately left alone per the plan's own instruction not to fix that gap.
- **Files modified:** none tracked (only gitignored `data/dashboard/index.json` and `dist/widgets/` output)
- **Verification:** `npm run verify-dashboard` moved from a 1-line FATAL exit to running its full 36-check suite (31 pass / 5 fail — see Issues Encountered)
- **Committed in:** N/A — no tracked files changed by this action

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** Necessary to get real signal on the publish guards this plan's own threat model requires re-asserting; did not touch any file this plan's `files_modified` scope names, and did not paper over the still-open `data/stats/*.json` gap.

## Issues Encountered

**`npm test` — pre-existing worktree environment gap, not a regression.** `npm test` exits with 6 failed test files / 53 passed / 1 skipped (60 total), all 6 failures `ENOENT`-level import errors on gitignored artifacts absent from this worktree (`data/stats/gear-aggregate.json`, `data/stats/training-load.json`, `data/stats/year-over-year.json`, `node_modules/chartjs-plugin-zoom/...`, plus two more of the same class), exactly the gap already logged in `.planning/phases/24-local-curation-mode/deferred-items.md` for plans 24-01/24-02. **0 assertion failures**: 1363/1363 executed tests pass. None of the 6 failing files import `detail-best-efforts-logic.ts`, `detail.ts`, or `curation-seam.test.ts`.

**`npm run verify-dashboard` — same environment gap, different symptom.** After the Rule 3 fix above (generating `data/dashboard/index.json` so the check suite could run at all), the full run reports **31 check(s) passed, 5 failure(s)**, exit code 1. All 5 failures are `GET /data/stats/{all-time-totals,streaks,training-load,age-grading,gear-aggregate}.json expected 200, got 404` — `data/stats/` is entirely absent in this worktree (gitignored, never computed here), unrelated to this plan's dashboard render-path changes. Every GAP-24-01-relevant check passes: `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.`, `✓ GET /__curate/health -> 404`, `✓ GET /__curate/overlay.js -> 404`, `✓ GET /__curate/exclusions/3475726256 -> 404`, `✓ GET /data/best-effort-exclusions.json -> 200`, `✓ /data/best-effort-exclusions.json parses with an "exclusions" array`, `✓ GET /assets/index-UHckEgvm.js -> 200`, `✓ GET /assets/index-B573RjUr.css -> 200`.

**Vitest `it`-block count discrepancy.** The plan's acceptance criteria state "11 present before this task" for `curation-seam.test.ts`; `grep -c "  it("` on the pre-task file actually matched a false positive (a `haystack.split(needle)` line inside a helper function, not an `it(` call). The true pre-task count, confirmed by listing every `it(` line, was 10. Post-task the file has 15 `it` blocks (10 + 5 new) — still strictly more than either count, so the acceptance criterion ("strictly more `it` blocks... than the 11 present before this task") is satisfied either way; documented here for accuracy since the plan's stated baseline was off by one.

## RED-observation transcripts

**Task 1 — new unit tests, observed RED before implementation** (`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts`, 3 of 20 failing, 17 passing):
```
AssertionError: expected false to be true // Object.is equality
❯ src/dashboard/views/detail-best-efforts-logic.test.ts:205:52
  (test: "a live index that marks the activity excluded wins over a false precomputed flag...")
```
Two more of the same shape failed for the R11 mirror-image (empty-index) and D-05 distance-scoped cases; the null-fallback and activityId-keying cases passed trivially pre-implementation since they matched the old unconditional-read behaviour by coincidence.

**Task 2 — new curation-seam.test.ts guards, observed RED before implementation** (`npx vitest run src/dashboard/curation-seam.test.ts`, 2 of 79 failing):
```
AssertionError: expected '\n\nimport type { DashboardView, View…' to contain 'buildExclusionIndex'
❯ (test: "detail.ts imports buildExclusionIndex from ../../analytics/best-effort-exclusions.js")
```
and the paired three-argument-call-site regex assertion also failed.

**Task 3(a) — plant regression 1** (restored `excluded: effort.excludedFromRecords,` unconditionally in `detail-best-efforts-logic.ts`): `npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts src/dashboard/curation-seam.test.ts` exited **1**, 4 of 99 failing — 3 in `detail-best-efforts-logic.test.ts` (same three GAP-24-01 assertions as above) and 1 in `curation-seam.test.ts` (`"detail-best-efforts-logic.ts contains liveExclusions and isExcluded(..." — countOccurrences(..., 'excluded: effort.excludedFromRecords') was 1, not 0`), confirming the tripwire fires from either file.

**Task 3(b) — plant regression 2** (dropped the third argument at `detail.ts`'s `buildBestEffortsPanelRows(` call site): `npx vitest run src/dashboard/curation-seam.test.ts` exited **1**, 1 of 79 failing:
```
AssertionError (test: "detail.ts contains exactly one buildBestEffortsPanelRows( call site, in three-argument form")
expect(detailStripped).toMatch(/buildBestEffortsPanelRows\([^)]*,[^)]*,[^)]*\)/)
```

**Task 3(c) — restoration confirmed exact:** `git diff --stat` after restoring both files returned no output — zero net change from either plant, confirmed for `src/dashboard/views/detail-best-efforts-logic.ts` and `src/dashboard/views/detail.ts`.

## Five-command gate (Task 3d)

| # | Command | Exit code | Notable output |
|---|---------|-----------|-----------------|
| 1 | `npm test` | 1 (6 pre-existing ENOENT file-level failures, 0 assertion failures) | `Test Files 6 failed \| 53 passed \| 1 skipped (60)` / `Tests 1363 passed \| 5 skipped (1368)` |
| 2 | `npx tsc --noEmit` | 0 | (no output — clean) |
| 3 | `npm run build` | 0 | `tsc` clean, produces `dist/index.js` |
| 4 | `npm run build-widgets` | 0 | `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.` |
| 5 | `npm run verify-dashboard` | 1 (5 pre-existing data/stats/* 404s, unrelated to this plan) | `31 check(s) passed, 5 failure(s).` — all GAP-24-01-relevant checks green (see Issues Encountered) |
| — | `git status --porcelain data/best-effort-exclusions.json` | empty | confirmed — this plan wrote no exclusion |

## New build identity (Task 3e)

- `dist/widgets/assets/index-UHckEgvm.js` — **differs** from Round 1's `index-xwaleiOf.js`, as expected (this plan changes the dashboard bundle).
- `dist/widgets/assets/index-B573RjUr.css` — **unchanged** from Round 1, as expected (OD-3: zero shipped CSS from this plan).

Plan 24-10 must re-derive its own hashes against its own fresh build rather than inherit these.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

GAP-24-01's mechanism is closed IN CODE: the panel row's `excluded` flag reads the live exclusions document at render time. **This is NOT yet verified in a browser** — plan 24-10's Round 2 human checkpoint is the only thing that settles whether the badge actually appears/disappears correctly on the next paint after a Save/untick, per this plan's own `<output>` requirement. `data/best-effort-exclusions.json` was not written by this plan (confirmed empty `git status --porcelain`), and the new build identity (`index-UHckEgvm.js` / `index-B573RjUr.css`) is on record for 24-10 to compare against (though 24-10 must rebuild fresh rather than reuse these hashes).

CUR-01 stays open in `REQUIREMENTS.md` pending that browser verification — `requirements-completed` is intentionally empty in this SUMMARY's frontmatter.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: `.planning/phases/24-local-curation-mode/24-09-SUMMARY.md`
- FOUND: `src/dashboard/views/detail-best-efforts-logic.ts`
- FOUND: `src/dashboard/views/detail.ts`
- FOUND commit: `7b678ea` (Task 1)
- FOUND commit: `17b161f` (Task 2)
- FOUND commit: `8b231f3` (this SUMMARY)
