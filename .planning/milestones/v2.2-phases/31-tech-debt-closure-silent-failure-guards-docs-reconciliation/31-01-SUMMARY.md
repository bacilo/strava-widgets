---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 01
subsystem: testing
tags: [vitest, test-fixtures, best-effort-engine, silent-failure-guards]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    provides: the CR-01 ceiling-demotion tests this plan decouples from the live exclusions file
provides:
  - "A committed test fixture (src/analytics/__fixtures__/best-effort-exclusions.fixture.json) that all CR-01 arithmetic assertions in compute-best-efforts.test.ts now run against instead of the live, owner-editable data/best-effort-exclusions.json"
  - "checkExclusionPremise(doc), a pure helper with an actionable failure message, backing the one remaining live-file premise test"
  - "A demonstrated-failing proof (fixture-copy mutation test) that the fixture cannot drift silently"
affects: [tech-debt-closure, curation-review-queue, pr-plausibility-ceiling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture-plus-one-live-premise-check: arithmetic tests read a committed fixture; exactly one test reads the live curation file and asserts only a named, actionable premise"
    - "Demonstrated-failing via tmpDir copy mutation: prove a guard would catch drift by mutating a COPY, never the real file or the committed fixture"

key-files:
  created:
    - src/analytics/__fixtures__/best-effort-exclusions.fixture.json
  modified:
    - src/analytics/compute-best-efforts.test.ts

key-decisions:
  - "D-01: fixture plus exactly one live premise check — arithmetic never depends on the live file's other contents"
  - "D-02: premise failure message names the entry, the live file, the fixture to re-pin, and this test file, with no skipIf/CI-only branch — a red nightly for a failed premise is intended"
  - "D-03: mutation must target a tmpDir COPY, never the committed fixture or the real file — demonstrated in both directions (unchanged copy still excludes at 1k; mutated copy does not)"

patterns-established:
  - "checkExclusionPremise(doc) pure helper pattern for actionable-failure-message premise checks reusable by future WR-09-style couplings"

requirements-completed: [TD-01]

# Metrics
duration: ~15min
completed: 2026-09-19
---

# Phase 31 Plan 01: CR-01 Test Decoupling from Live Exclusions File Summary

**A committed two-entry fixture now backs all four CR-01 ceiling-demotion regression tests; exactly one test still reads `data/best-effort-exclusions.json`, asserting only a named, actionable premise via a new `checkExclusionPremise` helper, with a mutation test proving the fixture can't drift silently.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-19T13:03:19+02:00 (base commit)
- **Completed:** 2026-09-19T13:16:34+02:00
- **Tasks:** 3 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `src/analytics/__fixtures__/best-effort-exclusions.fixture.json`, a committed, byte-verified copy of the two real exclusion entries (`4556693525`, `3475711469`, both `distances: null`, `reason: "bad measurement"`) that the CR-01 tests' arithmetic depends on.
- Repointed all four `exclusionsPath` sites in `compute-best-efforts.test.ts` from the live file onto the fixture; removed the three now-unused local `realExclusionsPath` declarations that would have gone dead.
- Extracted a pure `checkExclusionPremise(doc)` helper and reduced the live-file dependency to exactly one standalone premise-only test, with a second test proving the failure message is actionable (names the entry, the real file, the fixture, and this test file) rather than merely present.
- Added a fixture-copy mutation test (D-03) that writes the fixture's contents into two tmpDir copies — one unchanged, one with `4556693525`'s `distances` narrowed from `null` to `['400m']` — and shows the 1k effort's `excludedFromRecords` flips from `true` to `false`, proving the fixture is load-bearing rather than a silent second source of truth.
- Fixed three stale "400m only" comments/wording (the real file's `3475711469` entry is all-distance, `distances: null` — the old comment mischaracterized it, per `31-RESEARCH.md` correction #1), including one unrelated instance in an earlier, unconnected test to satisfy the plan's file-wide grep gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit the two-entry fixture and repoint every arithmetic assertion at it** - `17504ac2` (test)
2. **Task 2: Extract the premise check, make its failure message actionable, and pin the message** - `e25a5e79` (test)
3. **Task 3: Prove the fixture is not a silent second source of truth** - `0c640ace` (test)

_No feat/refactor commit was needed — this plan is test-file-only per its own `<objective>` ("No production code changes")._

## Files Created/Modified

- `src/analytics/__fixtures__/best-effort-exclusions.fixture.json` - New committed fixture; verbatim copy of the real file's two relevant entries, with a `note` field explaining its purpose and the re-pin process.
- `src/analytics/compute-best-efforts.test.ts` - Added `fixtureExclusionsPath` constant, `checkExclusionPremise` helper, 2 new tests (premise-only, premise-message), 1 new test (fixture-copy mutation); repointed 4 `exclusionsPath` sites; renamed 1 test off "REAL committed exclusion" wording; fixed 3 stale "400m only" comments.

## Verbatim Evidence (per plan `<output>` spec)

**Fixture's two entries** (verbatim from `data/best-effort-exclusions.json`, confirmed byte-equal via the `node -e` check in Task 1's acceptance criteria):
```json
{"activityId": "4556693525", "distances": null, "reason": "bad measurement"}
{"activityId": "3475711469", "distances": null, "reason": "bad measurement"}
```

**Byte-equality check output:** `MATCH` — both entries in the fixture are byte-identical (after key-order-independent JSON comparison) to the live file's entries for these two activity IDs.

**Premise failure message (verbatim):**
```
4556693525 is no longer excluded all-distance in data/best-effort-exclusions.json; if intentional, update src/analytics/__fixtures__/best-effort-exclusions.fixture.json and the premise in src/analytics/compute-best-efforts.test.ts
```

**`-t` match counts (all observed, not just expected):**
| Filter | Expected | Observed |
|---|---|---|
| `-t "REAL committed exclusion"` | exactly 1 | **1 passed, 0 failed** |
| `-t "premise"` | ≥2 | **2 passed, 0 failed** |
| `-t "fixture copy"` | ≥1 | **1 passed, 0 failed** |

**File test count before/after:**
| | Count |
|---|---|
| Before (base commit `5c1cc364`) | 46 |
| After (this plan) | 49 |

Full-file suite: `npx vitest run src/analytics/compute-best-efforts.test.ts` → **49/49 passed, 0 failed**.
`npx tsc --noEmit` → exits 0, no output.

**Premise-only test body contains no call to `computeBestEfforts`** — confirmed by reading the test (`"4556693525's REAL committed exclusion entry satisfies the CR-01 premise"`): it reads the real file, parses it, calls `checkExclusionPremise`, and asserts `result.ok` — nothing else.

## Decisions Made

- Declared `fixtureExclusionsPath` as a single shared `const` at the top of the `describe('4556693525', ...)` block (Claude's Discretion per D-01) rather than repeating the `fileURLToPath` idiom at each of the four call sites, satisfying the plan's own "one declaration plus four sites" acceptance shape (`grep -c "fixtureExclusionsPath"` → 5).
- Renamed the "excluded efforts never feed the ceiling derivation, with or without the real exclusions file" test to "...with or without the committed exclusions fixture" for accuracy, since after repointing it no longer reads the real file in either branch. Not required by the plan's acceptance criteria (which only names the line-944 test for renaming) but done to avoid a test title that would otherwise misdescribe its own mechanism.
- Fixed a third, textually-unrelated "400m only" comment at line 133 (an earlier `computeActivityEfforts` — pre-filter test, unconnected to the exclusions work) because the plan's own acceptance criterion (`grep -c "400m only"` → 0) is file-wide, not scoped to the exclusion tests.

## Deviations from Plan

None — plan executed exactly as written. The two comment/naming touch-ups above are within Task 1's own stated action ("Correct the stale in-file comment..." and the file-wide "400m only" acceptance gate) and Task 1's file scope, not out-of-scope additions.

## Issues Encountered

One self-correcting process note: while gathering a pre-change baseline test count for comparison, I mistakenly ran a bare `git stash push` inside the worktree, which is prohibited (shared stash stack risk across worktrees per project convention). I recovered immediately by capturing the stash's SHA (`git stash list --format='%H %gs'`), restoring with `git stash apply <sha>` (not `pop`), verifying `git status`/`git diff --stat` showed my changes fully intact, and then dropping only that named entry (`git stash drop stash@{0}`, confirmed to be my own SHA before dropping). No other worktree's state was touched; the "before" test count was subsequently obtained safely via `git show HEAD:<path> | grep -c` instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TD-01 is fully closed: no arithmetic assertion in `compute-best-efforts.test.ts` reads the live exclusions file; exactly one test does, asserting only its premise with an actionable message; a fixture-copy mutation is demonstrated to break an assertion.
- `data/best-effort-exclusions.json` was never modified by this plan (confirmed via `git status --short` before every commit).
- No blockers for the rest of Wave 1 (TD-02..TD-04, TD-06 in parallel plans) or Wave 2 (TD-05 regeneration).

## Self-Check: PASSED

- FOUND: `src/analytics/__fixtures__/best-effort-exclusions.fixture.json`
- FOUND: `src/analytics/compute-best-efforts.test.ts`
- FOUND: `.planning/phases/31-tech-debt-closure-silent-failure-guards-docs-reconciliation/31-01-SUMMARY.md`
- FOUND commit `17504ac2` (Task 1)
- FOUND commit `e25a5e79` (Task 2)
- FOUND commit `0c640ace` (Task 3)

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*
