---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 02
subsystem: infra
tags: [vitest, node-crypto, build-tooling, copy-data-tree]

# Dependency graph
requires: []
provides:
  - "copyJsonTree replaces mtime-based skip with size-then-digest content comparison"
  - "scripts/lib/copy-data-tree.test.mjs — the module's first test, planted-fixture mkdtemp pattern"
affects: [build-widgets, curate-server, 31-tech-debt-closure]

# Tech tracking
tech-stack:
  added: []
  patterns: ["size-first-then-digest content comparison (Node crypto.createHash sha1), replacing mtime as a staleness signal"]

key-files:
  created: [scripts/lib/copy-data-tree.test.mjs]
  modified: [scripts/lib/copy-data-tree.mjs]

key-decisions:
  - "D-04: content comparison (size, then SHA-1 digest when sizes match) replaces the mtime skip in copyJsonTree; mtime is never used as a skip condition"
  - "D-05: a single console.log('replaced stale <destPath>') fires only in the same-size/different-digest branch, so staleness is visible without noise on ordinary rebuilds"
  - "D-06: the RED test proves the old mtime rule kept a same-size doctored, newer-mtime destination; the GREEN test proves the new rule replaces and logs it"
  - "Measured build-widgets cost in this worktree (not the primary checkout, per the no-write-to-primary-checkout constraint): fresh full build 41.9s wall (includes 11 widget Vite builds), rebuild with all-skip 31.3s wall; an isolated copy-only pass over the same 7,576-file/205MB tree took 2.8s warm-cache for the full size+digest comparison — consistent in order of magnitude with 31-CONTEXT.md D-04's ~1.4s/186MB figure (this project's dataset has since grown to 1,899 activities, and this implementation double-hashes source+destination per file rather than aggregating one directional digest)"

requirements-completed: [TD-02]

# Metrics
duration: 25min
completed: 2026-09-19
---

# Phase 31 Plan 02: Content-Honest copy-data-tree Summary

**Replaced `copyJsonTree`'s mtime skip with a size-then-digest content comparison, closing the "staged build browser cache trap" where a locally edited `dist/widgets/data/*.json` file could survive `build-widgets` and ship.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-19T13:06:00Z
- **Completed:** 2026-09-19T13:31:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `scripts/lib/copy-data-tree.test.mjs` is the module's first test — 6 tests covering stale-replace, byte-identical-skip, different-size-copy, missing-destination-copy, non-.json-ignore, and nested-subdirectory rollup.
- Demonstrated the exact TD-02 failure mode (D-06): a same-size, different-content, newer-mtime destination survived under the old mtime rule (RED), and is now replaced and logged under the new rule (GREEN).
- `copyJsonTree` now decides staleness by content (size first, then SHA-1 digest only when sizes match), never by mtime — a doctored `dist/widgets/data/` file can no longer survive a `build-widgets` run that reports success.
- Every same-size, different-digest replacement logs `replaced stale <destPath>`, naming exactly the file a later checkpoint would need to quote (D-05).
- Both call sites (`scripts/build-widgets.mjs:233`, `scripts/curate-server.mjs:691`) needed and received zero changes — confirmed via `git diff` empty on both files.
- `npm run build-widgets` verified end-to-end in this worktree: full widget build + full data copy succeeds, and a second run with an unchanged tree skips every file and prints no stale-replacement line.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the planted-fixture test and demonstrate the current rule failing** - `7cb7c793` (test)
2. **Task 2: Replace the mtime skip with size-then-digest and log the stale replacement** - `ccb62ea2` (feat, includes a test-bug fix discovered during GREEN verification)

**Plan metadata:** committed separately by this executor per worktree protocol (SUMMARY.md only; STATE.md/ROADMAP.md are the orchestrator's).

_TDD tasks: RED commit (`7cb7c793`) → GREEN commit (`ccb62ea2`); no separate REFACTOR commit needed._

## Files Created/Modified

- `scripts/lib/copy-data-tree.test.mjs` - New planted-fixture test suite (mkdtemp pattern from `scripts/lib/curation-guard.test.mjs`); never touches the real `dist/` or `data/` tree.
- `scripts/lib/copy-data-tree.mjs` - `copyJsonTree`'s efficiency guard rewritten from mtime comparison to size-then-digest; new imports `readFileSync` (from `fs`) and `createHash` (from `node:crypto`); header docblock's no-top-level-side-effects contract preserved verbatim.

## Decisions Made

- Digest algorithm: SHA-1 (per D-04's stated measurement basis and Claude's Discretion — a staleness check, not a security boundary).
- No mtime short-circuit before the digest: a doctored file can carry any mtime, so mtime is used nowhere in the new logic, not even as an optimization, matching RESEARCH Pattern 2's explicit warning.
- Log line wording: `replaced stale ${destPath}` — fires only in the same-size/different-digest branch; a different-size replacement or a missing-destination copy logs nothing extra, matching the plan's behavior spec exactly.
- `npm run build-widgets` was run in this worktree rather than the primary checkout named in the plan's Task 2 action, because the orchestrator's explicit constraint for this parallel worktree agent ("Primary checkout — do not edit there" / "Never write to the primary checkout") takes precedence over the plan's literal instruction. The worktree's `data/` tree is git-tracked in full except `data/stats` and `data/dashboard`, which were copied in per the worktree-environment setup step, so the measurement covers the complete real dataset (7,576 files / ~205 MB) rather than a synthetic subset.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a console.log spy assertion order bug discovered during Task 2 GREEN verification**
- **Found during:** Task 2 (running the test suite after implementing the size-then-digest logic)
- **Issue:** The Task 1 test read `logSpy.mock.calls` AFTER calling `logSpy.mockRestore()`. In vitest 4.0.18, `mockRestore()` also clears `.mock.calls` (restore = reset + restore original implementation), so the assertion always read an empty array regardless of whether `console.log` had actually been called — a false negative that would have kept the "stale" test red even with a correct implementation.
- **Fix:** Captured the `loggedDestPath` boolean from `logSpy.mock.calls` inside the `try` block, before the `finally` block's `mockRestore()` call.
- **Files modified:** `scripts/lib/copy-data-tree.test.mjs`
- **Verification:** Confirmed against a throwaway debug test (`vi.spyOn(console, 'log').mockImplementation(...)` then checking `.mock.calls.length` before vs. after `mockRestore()`) that isolated the bug to vitest's restore semantics, not the implementation; removed the debug file before committing.
- **Committed in:** `ccb62ea2` (part of Task 2 commit, noted in the commit body as `fix(test):`)

**2. [Rule 3 - Blocking, test-only] Forced explicit mtimes in the "different-size" test**
- **Found during:** Task 1 (writing the initial RED test)
- **Issue:** The "different-size destination is copied" test initially left mtimes uncontrolled; under the OLD mtime-only rule, whichever file happened to be written last (nondeterministic relative to wall-clock write order) could get a newer mtime and cause the old rule to skip regardless of size, making this test spuriously RED for a reason unrelated to TD-02's actual defect.
- **Fix:** Added explicit `utimesSync` calls forcing the source strictly newer than the destination, isolating the test to size alone so it passes identically under both the old and new implementation.
- **Files modified:** `scripts/lib/copy-data-tree.test.mjs`
- **Verification:** Confirmed the test passes both before (`7cb7c793`) and after (`ccb62ea2`) the implementation change, proving it tests the intended invariant only.
- **Committed in:** `7cb7c793` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 test bug, 1 test isolation fix). Both are test-only corrections required to make the plan's own acceptance criteria ("the run is RED, and the failing test is the 'stale' one" / "fully green") actually true and trustworthy. No production-code scope creep — `copyJsonTree`'s behavior matches the plan's `<action>` and `<behavior>` sections exactly.

## Issues Encountered

None beyond the two auto-fixed test issues above, both resolved within the task they were discovered in.

## Verbatim Evidence (D-06)

### Task 1 RED run (before Task 2's implementation)

```
✓ scripts/lib/copy-data-tree.test.mjs (6 tests | 1 failed) 20ms
     × stale: a same-size, different-content, newer-mtime destination is replaced and logged 7ms
     ✓ skip: a byte-identical destination is skipped and counted 2ms
     ✓ different-size destination is copied 2ms
     ✓ missing destination is copied 2ms
     ✓ a non-.json sibling is ignored 2ms
     ✓ a nested subdirectory recurses and rolls its counts up into the parent totals 3ms

 FAIL  scripts/lib/copy-data-tree.test.mjs > copyJsonTree > stale: a same-size, different-content, newer-mtime destination is replaced and logged
AssertionError: expected '{"activityId":"9999999999","value":42}' to be '{"activityId":"1111111111","value":42}' // Object.is equality

Expected: "{"activityId":"1111111111","value":42}"
Received: "{"activityId":"9999999999","value":42}"

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

This confirms the old mtime-only rule kept the doctored bytes in place: the "stale" test failed for exactly the reason TD-02 exists, while every other test (including "skip") already passed, proving the suite was not uniformly red.

### Final GREEN run (after Task 2's implementation)

```
 ✓ scripts/lib/copy-data-tree.test.mjs (6 tests) 22ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### `-t "skip"` filter match count

```
npx vitest run scripts/lib/copy-data-tree.test.mjs -t "skip"
 ✓ scripts/lib/copy-data-tree.test.mjs (6 tests | 5 skipped) 4ms
 Test Files  1 passed (1)
      Tests  1 passed | 5 skipped (6)
```

Observed match count: **1 passed** (expected ≥1 per `31-VALIDATION.md` row `31-02-T2`). Note: `31-VALIDATION.md`'s Status column is a shared cross-plan artifact updated by multiple parallel wave-1 worktree agents; this executor did not edit it directly to avoid a worktree merge conflict, and records the observed count here for the orchestrator's consolidation pass.

### `npm run build-widgets` totals and wall time

First run (fresh worktree, no prior `dist/widgets/data`):

```
✓ Copied data/stats/*.json → dist/widgets/data/stats/ (3786 copied, 0 skipped)
✓ Copied data/geo/*.json → dist/widgets/data/geo/ (8 copied, 0 skipped)
✓ Copied data/routes/*.json → dist/widgets/data/routes/ (2 copied, 0 skipped)
✓ Copied data/heatmap/*.json → dist/widgets/data/heatmap/ (1 copied, 0 skipped)
✓ Copied data/dashboard/*.json → dist/widgets/data/dashboard/ (1 copied, 0 skipped)
✓ Copied data/activities/*.json → dist/widgets/data/activities/ (1899 copied, 0 skipped)
✓ Copied data/streams/*.json → dist/widgets/data/streams/ (1875 copied, 0 skipped)
✓ Copied data/config/*.json → dist/widgets/data/config/ (2 copied, 0 skipped)
✓ Copied data/wma/*.json → dist/widgets/data/wma/ (2 copied, 0 skipped)
```
Total: 7,576 copied, 0 skipped. Wall time (full pipeline: 11 widget Vite builds + standalone pages + dashboard SPA + full data copy): **41.9s**.

Second run (unchanged tree, rebuild):

```
✓ Copied data/stats/*.json → dist/widgets/data/stats/ (0 copied, 3786 skipped)
✓ Copied data/geo/*.json → dist/widgets/data/geo/ (0 copied, 8 skipped)
✓ Copied data/routes/*.json → dist/widgets/data/routes/ (0 copied, 2 skipped)
✓ Copied data/heatmap/*.json → dist/widgets/data/heatmap/ (0 copied, 1 skipped)
✓ Copied data/dashboard/*.json → dist/widgets/data/dashboard/ (0 copied, 1 skipped)
✓ Copied data/activities/*.json → dist/widgets/data/activities/ (0 copied, 1899 skipped)
✓ Copied data/streams/*.json → dist/widgets/data/streams/ (0 copied, 1875 skipped)
✓ Copied data/config/*.json → dist/widgets/data/config/ (0 copied, 2 skipped)
✓ Copied data/wma/*.json → dist/widgets/data/wma/ (0 copied, 2 skipped)
```
Total: 0 copied, 7,576 skipped, no `replaced stale` line (clean tree, as expected). Wall time: **31.3s** (still dominated by the 11 Vite widget builds, not the copy step).

An isolated copy-only measurement (calling `copyJsonTree` directly over the same 9 real data directories, bypassing the Vite build) on a warm OS file cache took **2.8s** for the full size+digest comparison over all 7,576 files (all skipped) — consistent in order of magnitude with `31-CONTEXT.md` D-04's ~1.4s/186MB figure; the archive has grown to 1,899 activities since that measurement, and this implementation hashes both source and destination per file (double the I/O of D-04's single-directional aggregate digest).

## Verification Results

- `npx vitest run scripts/lib/copy-data-tree.test.mjs` — 6/6 passed.
- `npx vitest run scripts/lib/copy-data-tree.test.mjs -t "skip"` — 1 passed, 5 skipped, 0 failed.
- `grep -c "mtimeMs" scripts/lib/copy-data-tree.mjs` → 0.
- `grep -c "createHash" scripts/lib/copy-data-tree.mjs` → 3.
- `git diff scripts/build-widgets.mjs scripts/curate-server.mjs` → empty.
- `npx tsc --noEmit` → exit 0, no output.
- `npm test` (full suite, run in this worktree) → 2,424 passed, 76 skipped, 6 pre-existing failures unrelated to this plan (see Known Environment Gaps below).
- `git status --porcelain` after both commits → clean except intended files; no accidental deletions (`git diff --diff-filter=D --name-only HEAD~1 HEAD` empty for the Task 2 commit).

## Known Environment Gaps (not regressions)

`npm test` in this worktree reports 6 pre-existing failing test files, all unrelated to `copy-data-tree.mjs`:
`scripts/compute-elevation-calibration.test.mjs`, `scripts/compute-pace-quality-calibration.test.mjs`,
`scripts/compute-pace-residual.test.mjs`, `scripts/compute-pr-ceiling-calibration.test.mjs`,
`scripts/compute-pr-ceiling-diff.test.mjs`, `scripts/verify-dashboard-publish-stats.test.mjs`. Each fails on
a missing `dist/analytics/*.js` module (TypeScript build output not present in this bare worktree — no `npm run build`
step was performed, only the `node_modules` symlink and `data/` copy per the worktree-environment setup) or a missing
`dist/widgets/data/stats/best-efforts.json` (present only after `npm run build-widgets` runs, which this plan did run,
but the test in question reads a path expectation set up before that build ran). This matches this project's own
recorded lesson ("Worktree executors need node_modules + data/ ... fixture failures there are not regressions").
None of the 6 failing files import, test, or reference `copy-data-tree.mjs`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TD-02 is fully closed: `copyJsonTree` is content-honest, both call sites are unaffected, and the module has its first regression test.
- No blockers for the remaining Wave 1 plans (31-01, 31-03, 31-04, 31-05), which touch disjoint files.
- `31-VALIDATION.md` rows `31-02-T1` and `31-02-T2` are ready to flip to ✅ green; this executor recorded observed counts here rather than editing the shared file directly (see `-t "skip"` section above).

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: scripts/lib/copy-data-tree.test.mjs
- FOUND: scripts/lib/copy-data-tree.mjs
- FOUND: .planning/phases/31-tech-debt-closure-silent-failure-guards-docs-reconciliation/31-02-SUMMARY.md
- FOUND: commit 7cb7c793 (test)
- FOUND: commit ccb62ea2 (feat)
