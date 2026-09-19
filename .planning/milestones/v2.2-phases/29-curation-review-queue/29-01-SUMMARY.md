---
phase: 29-curation-review-queue
plan: 01
subsystem: testing
tags: [vitest, curation-guard, fixture-testing, node-fs]

# Dependency graph
requires:
  - phase: 24-local-curation-mode
    provides: findCurationArtifacts and the planted-fixture harness in curation-guard.test.mjs
provides:
  - "IN-17 fixed: findCurationArtifacts now yields exactly one violation per leaked path (name-match branches continue instead of falling through to the content scan)"
  - "D-19 build-time proof: planted queue-page and queue-bundle fixtures observed caught by the existing __curate content scan, and a clean control observed returning []"
affects: [29-curation-review-queue (later plans building the actual queue page/server routes will rely on this guard being one-violation-per-path)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Name-match branches in a scanner must continue past their push, or a path that matches both a name check and a content check double-counts"
    - "A guard's content-scan mechanism is discriminated by scratch-deleting the mechanism and observing the planted case fail, then reverting immediately, never committed"

key-files:
  created: []
  modified:
    - scripts/lib/curation-guard.mjs
    - scripts/lib/curation-guard.test.mjs

key-decisions:
  - "Task ordering followed the plan's RED (Task 1) -> GREEN (Task 2) -> extend (Task 3) sequence exactly; no fix was made until the IN-17 pin was observed red."

patterns-established:
  - "One-path-one-violation invariant: a file-entry name match now always continue()s past its violation push, never falling through to the !entry.isFile() gate or the content scan for the same entry."

requirements-completed: [CUR-03]

# Metrics
duration: ~5min (task execution only; RED observed within seconds, GREEN confirmed within seconds)
completed: 2026-09-18
---

# Phase 29 Plan 01: Fix IN-17 and Prove the Build-Time Half of CUR-03 Summary

**Fixed `findCurationArtifacts`'s double-violation defect (IN-17) and added planted queue-page/queue-bundle fixtures proving the existing `__curate` content scan already catches Phase 29's review-queue leaks — no new marker.**

## Performance

- **Duration:** ~5 min of task execution (three atomic commits within a 2-minute span)
- **Tasks:** 3/3 completed
- **Files modified:** 2 (`scripts/lib/curation-guard.mjs`, `scripts/lib/curation-guard.test.mjs`)

## Accomplishments

- Pinned the pre-existing IN-17 defect with three new test cases, observed genuinely RED first (`expected 2 to be 1` for the file-name-match + content-match double count, `expected 5 to be 7` for the tree-wide no-duplicate-path invariant).
- Fixed `findCurationArtifacts` by adding `continue` after each of the two file-name-match violation pushes (`CURATE_DIR_NAME`, `.curate-dist`), so a matched name no longer also falls through to the content scan for the same path. Directory-branch behavior (push violation AND still descend via `walk()`) is unchanged — a nested violation inside a `__curate` directory is still reported at its own distinct path.
- Added D-19's four planted fixtures proving the build-time half of CUR-03: a queue-page-shaped file, a queue-bundle-shaped file, the same bundle nested under a `__curate` directory (proving IN-17's fix did not suppress the nested finding), and a clean control returning exactly `[]`.
- Ran the required scratch-deletion discrimination check for Task 3: removing the `content.includes(CURATE_MARKER)` branch in a scratch copy made cases (a) and (b) fail, confirming the content scan — not name-matching or coincidence — is what catches these two fixtures. The scratch edit was reverted immediately from a `cp`-based backup and never committed (`git diff --stat` empty after revert, confirmed before continuing).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin IN-17 with a test observed RED** - `ce656477` (test)
2. **Task 2: Fix IN-17 — one path, one violation** - `ca05b905` (fix)
3. **Task 3: D-19 planted queue-page and queue-bundle fixtures** - `bac5f71f` (test)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode — this executor does not write STATE.md/ROADMAP.md).

## Files Created/Modified

- `scripts/lib/curation-guard.mjs` - Added `continue` after each file-name-match violation push in `findCurationArtifacts`'s file-entry branch (IN-17 fix); updated the `.curate-dist` block comment to record the one-path-one-violation invariant.
- `scripts/lib/curation-guard.test.mjs` - Added `describe('IN-17 — one path produces exactly one violation', ...)` (3 cases) and `describe('D-19 — the review queue leaks are caught by the existing scan (no new marker)', ...)` (4 cases).

## Task 1 RED Output (verbatim, key lines)

```
FAIL scripts/lib/curation-guard.test.mjs > IN-17 — one path produces exactly one violation > (a) a file named .curate-dist whose contents also carry the marker produces exactly one violation for that path
AssertionError: expected 2 to be 1 // Object.is equality

FAIL scripts/lib/curation-guard.test.mjs > IN-17 — one path produces exactly one violation > (b) a file named __curate whose contents also carry the marker produces exactly one violation for that path
AssertionError: expected 2 to be 1 // Object.is equality

FAIL scripts/lib/curation-guard.test.mjs > IN-17 — one path produces exactly one violation > (c) no path is reported twice across a mixed tree carrying (a), (b), a clean index.html, a marker-carrying assets/x.js, and a nested __curate/overlay.js
AssertionError: expected 5 to be 7 // Object.is equality

Test Files  1 failed (1)
     Tests  3 failed | 22 passed | 1 skipped (26)
```

After Task 2's fix, the same three cases pass GREEN and all pre-existing cases (25 passed + 1 skipped, since `dist/widgets` did not yet exist at that point in the session) remained green.

## Task 3 Discrimination Check (scratch-edit, reverted, never committed)

Deleted the `if (content.includes(CURATE_MARKER)) { ... }` block in a scratch copy of `curation-guard.mjs` (backed up first via `cp` to `/tmp`). Re-ran the suite:

```
Test Files  1 failed (1)
     Tests  9 failed | 21 passed (30)
```

The two D-19 cases the check was designed to discriminate both failed as expected:
- `(a) a planted queue page (...) is caught, exactly once` — FAILED (no violation without the content scan)
- `(b) a planted queue bundle (...) is caught, exactly once` — FAILED (no violation without the content scan)

(Six other pre-existing content-scan-dependent cases also failed, expected since they share the same mechanism — not evidence of a broken discriminator, evidence the mechanism is genuinely load-bearing for all of them.)

The scratch edit was reverted immediately via `cp` from the pre-edit backup. `git diff --stat scripts/lib/curation-guard.mjs` was confirmed empty afterward, and the full suite re-run confirmed 30/30 GREEN before continuing.

## Decisions Made

None beyond the plan's own D-18/D-19/IN-17 decisions, which were followed exactly as written. No architectural changes, no new markers or exemptions added (`UNSCANNED_EXTENSIONS` unchanged at `['.json']`, `CURATE_MARKER` unchanged).

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria were met without needing Rule 1/2/3 auto-fixes:

- Task 1: `curation-guard.test.mjs` contains the string `IN-17`; `npx vitest run` exited non-zero; failure output named the new cases with received counts of `2`/`5` where `1`/`7` was expected; no file other than the test file was modified.
- Task 2: `npx vitest run scripts/lib/curation-guard.test.mjs` exits 0 with every pre-existing case still passing; `grep -n "continue"` shows a `continue` inside both file-name-match branches; `grep -c "UNSCANNED_EXTENSIONS"` unchanged at 4 occurrences, array unchanged at `['.json']`; `npm run build-widgets` exits 0 and the real tree still certifies clean.
- Task 3: suite reports 30 tests (up 4 from 26 before this task) and exits 0; `grep -c "queue.html"` is 3 (≥1); `grep -c "queue.js"` is 6 (≥2); `git diff --stat scripts/lib/curation-guard.mjs` showed no change in this task; the discrimination check was performed and recorded above, with the scratch edit reverted and never committed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The build-time half of CUR-03 (D-18/D-19) is closed by this plan: the existing `__curate` content scan is now proven, not merely asserted, to catch a queue-page-shaped and a queue-bundle-shaped leak, and IN-17's double-violation defect (which would otherwise have inflated the count when the real queue page/bundle ship in later Phase 29 plans) is fixed first.
- `findCurationArtifacts` is otherwise unchanged in every other respect the plan required: `UNSCANNED_EXTENSIONS`, `CURATE_MARKER`, the directory-branch descend-and-report behavior, and all pre-existing WR-14/WR-19 non-regular-entry cases.
- No blockers for the plans that build the actual `/__curate/queue` page/route/bundle (D-06/D-07/D-08 etc.) — this plan only closed the guard-correctness prerequisite (IN-17) and its proof (D-19), per the plan's own scope boundary. The HTTP half of CUR-03 (D-17, `verify-dashboard-publish.mjs`'s new `expect404` lines) is explicitly out of this plan's scope and remains for a later plan in this phase.

## Self-Check: PASSED

- FOUND: `scripts/lib/curation-guard.mjs`
- FOUND: `scripts/lib/curation-guard.test.mjs`
- FOUND: `.planning/phases/29-curation-review-queue/29-01-SUMMARY.md`
- FOUND commit: `ce656477` (Task 1)
- FOUND commit: `ca05b905` (Task 2)
- FOUND commit: `bac5f71f` (Task 3)
