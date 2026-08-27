---
phase: 24-local-curation-mode
plan: 01
subsystem: infra
tags: [vitest, esbuild, node-builtins, build-pipeline, curation-guard]

# Dependency graph
requires: []
provides:
  - "scripts/lib/copy-data-tree.mjs — side-effect-free copyJsonTree + RECOMPUTE_DATA_DIRS, importable by both build-widgets.mjs and a future curate server"
  - "scripts/lib/curation-guard.mjs — pure findCurationArtifacts(publishDir), never calls process.exit, scans the whole publish tree for __curate/.curate-dist artifacts"
  - "build-widgets.mjs wired with assertNoCurationArtifacts(), called after buildDashboard() (OD-2), hard-fails the build on any curation-artifact leak"
  - "vitest.config.ts collects scripts/**/*.test.mjs, unblocking script-level guard tests for the rest of Phase 24"
  - ".curate-dist/ gitignored with a documented D-01 rationale"
affects: [24-02, 24-03, 24-04, 24-05, 24-06, 24-07, 24-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure violations-array scanner + process.exit(1) wrapper at the call site (mirrors assertNoPrivateArtifacts, but split so the scanner is independently unit-testable per D-11)"
    - "Mechanical extraction of a shared utility (copyJsonTree) into scripts/lib/ with zero top-level side effects, avoiding an import of the self-executing build-widgets.mjs"

key-files:
  created:
    - scripts/lib/copy-data-tree.mjs
    - scripts/lib/curation-guard.mjs
    - scripts/lib/curation-guard.test.mjs
  modified:
    - vitest.config.ts
    - .gitignore
    - scripts/build-widgets.mjs

key-decisions:
  - "assertNoCurationArtifacts() is called at the END of buildAllWidgets(), after await buildDashboard(), not inside copyDataFiles() where D-10's literal wording would place it (OD-2) — copyDataFiles() runs before the JS/HTML side of dist/widgets exists, so a guard called there would pass trivially against the most likely leak vector"
  - "findCurationArtifacts never calls process.exit; the exiting wrapper (assertNoCurationArtifacts) lives in build-widgets.mjs — this split is what makes D-11's planted-fixture proof possible without subprocess spawning"
  - "SCANNED_EXTENSIONS deliberately excludes .json so the guard can never catch dist/widgets/data/best-effort-exclusions.json, which is public and already asserted 200-and-parses elsewhere"

patterns-established:
  - "scripts/lib/*.mjs modules with zero top-level side effects, tested via scripts/**/*.test.mjs (now collected by vitest) using the mkdtemp/fs.rm tmp-dir fixture idiom already established in src/analytics/best-effort-exclusions.test.ts"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-08-27
---

# Phase 24 Plan 01: Build-Tier Foundations Summary

**Extracted a side-effect-free `copyJsonTree` module and shipped a pure, whole-tree `findCurationArtifacts` scanner wired into `build-widgets.mjs` as a hard-failing guard called after `buildDashboard()` — with the guard's pure/wrapper split proven red against five planted regressions.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-27
- **Tasks:** 3/3
- **Files modified:** 6 (3 created, 3 modified) + 1 phase-scoped deferred-items.md doc

## Accomplishments

- `vitest.config.ts`'s `include` glob now reaches `scripts/**/*.test.mjs`, unblocking every script-level test the rest of Phase 24 needs
- `scripts/lib/copy-data-tree.mjs`: `copyJsonTree` extracted verbatim (byte-identical logic, mtime-skip optimization intact) plus a new `RECOMPUTE_DATA_DIRS` export (`data/stats` + `data/dashboard`) for the future curate server's recompute step — importable with zero side effects, unlike `build-widgets.mjs` itself
- `scripts/lib/curation-guard.mjs`: `findCurationArtifacts(publishDir)` — a pure whole-tree scanner (never `process.exit`s) detecting a `__curate` dir/file, a `.curate-dist` dir, or `SCANNED_EXTENSIONS` (`.js`/`.html`/`.css`/`.map`) content containing the literal `__curate` marker
- `build-widgets.mjs` wired with `assertNoCurationArtifacts()`, placed immediately after `assertNoPrivateArtifacts` and called as the last statement of `buildAllWidgets()`, after `await buildDashboard()` — OD-2's dated, load-bearing amendment to D-10(a)'s literal call-site wording
- `.curate-dist/` gitignored with a comment naming D-01's structural-absence rationale
- D-11 discharged: the guard was observed failing against 4 of 5 planted-regression shapes when neutered (a 5th, the `.json`-non-catch guarantee, is a separate always-`[]` assertion by construction, not a "should fail" case) — see below

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the vitest glob, gitignore .curate-dist/, extract the data-copy walk** - `8c61b2b` (feat)
2. **Task 2: Ship the curation guard as a pure function, call it at the END of buildAllWidgets** - `5bba986` (feat)
3. **Task 3: Prove the guard red — planted-fixture regression test (D-11)** - `49b9e33` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `vitest.config.ts` - `include` widened to `['src/**/*.test.ts', 'scripts/**/*.test.mjs']`
- `.gitignore` - new `.curate-dist/` entry with D-01 rationale comment
- `scripts/lib/copy-data-tree.mjs` (new) - `copyJsonTree`, `RECOMPUTE_DATA_DIRS`
- `scripts/lib/curation-guard.mjs` (new) - `CURATE_DIR_NAME`, `CURATE_MARKER`, `SCANNED_EXTENSIONS`, `findCurationArtifacts`
- `scripts/lib/curation-guard.test.mjs` (new) - 11 vitest cases: clean tree, non-existent dir, 4 planted-regression shapes, the `.json` non-catch guarantee, `SCANNED_EXTENSIONS` shape check, and 3 source-structure assertions over `build-widgets.mjs`'s OD-2 call-site ordering
- `scripts/build-widgets.mjs` - local `copyJsonTree` deleted (now imported from `./lib/copy-data-tree.mjs`); new `assertNoCurationArtifacts()` wrapper added beside `assertNoPrivateArtifacts`; call added at the end of `buildAllWidgets()`
- `.planning/phases/24-local-curation-mode/deferred-items.md` (new) - logs a pre-existing worktree-environment test gap (see Issues Encountered)

## D-11 observed failing

Per the plan's mandatory discharge: `findCurationArtifacts` was temporarily neutered (made to `return []` unconditionally, before its `existsSync` check), the test file was run, the failure output captured verbatim below, then the guard was restored to a byte-identical diff (`git diff scripts/lib/curation-guard.mjs` returned empty before the Task 3 commit) and re-run green.

**RED run** (neutered guard — `npx vitest run scripts/lib/curation-guard.test.mjs`):

```
 Test Files  1 failed (1)
      Tests  4 failed | 7 passed (11)

 FAIL  scripts/lib/curation-guard.test.mjs > findCurationArtifacts > planted __curate directory: non-empty, a violation path contains "__curate"
 AssertionError: expected 0 to be greater than 0

 FAIL  scripts/lib/curation-guard.test.mjs > findCurationArtifacts > planted marker in a .js file: non-empty (the case a data-only scan would miss)
 AssertionError: expected 0 to be greater than 0

 FAIL  scripts/lib/curation-guard.test.mjs > findCurationArtifacts > planted marker in index.html: non-empty
 AssertionError: expected 0 to be greater than 0

 FAIL  scripts/lib/curation-guard.test.mjs > findCurationArtifacts > planted .curate-dist directory inside the tree: non-empty
 AssertionError: expected 0 to be greater than 0
```

The 7 passing cases under the neutered guard were exactly the ones a `return []` stub trivially satisfies (clean tree → `[]`, non-existent dir → `[]`, the `.json` non-catch guarantee → `[]`, the `SCANNED_EXTENSIONS` shape check, and the 3 source-structure assertions over `build-widgets.mjs`, which don't call `findCurationArtifacts` at all) — confirming the 4 failures are precisely the planted-regression cases the neuter defeats, not noise.

**GREEN run** (guard restored — `npx vitest run scripts/lib/curation-guard.test.mjs`):

```
 ✓ scripts/lib/curation-guard.test.mjs (11 tests) 10ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

## Decisions Made

- Followed OD-2 (already recorded in `24-CONTEXT.md`/`24-RESEARCH.md`) exactly: guard call-site is the end of `buildAllWidgets()`, not inside `copyDataFiles()`.
- No new decisions were made this plan beyond what `24-CONTEXT.md`/`24-RESEARCH.md`/`24-PATTERNS.md` already locked — Wave 1 executed the documented design as specified.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria are met as specified (see verification commands below), with one environment-caused exception documented under Issues Encountered (not a plan deviation, since it isn't caused by this plan's changes).

## Issues Encountered

- **Pre-existing worktree environment gap, not caused by this plan:** `npm test` in this parallel-execution worktree reports 6 failing test files (`src/dashboard/views/trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`, `trends-zoom-logic.test.ts`, and 3 siblings) due to (a) this worktree's own `node_modules/` being empty — three test files build an explicit relative `new URL('../../../node_modules/...')` path that resolves inside the worktree itself rather than via Node's directory-walk-up resolution — and (b) `data/stats/*.json` being gitignored generated build output never produced in this checkout. None of the 6 failing files touch any file this plan modifies (`vitest.config.ts`, `.gitignore`, `scripts/lib/copy-data-tree.mjs`, `scripts/build-widgets.mjs`); the widened `include` glob still collects the same 55 pre-existing `src/` test files (0 dropped) plus this plan's own new `scripts/lib/curation-guard.test.mjs` (56 total, 50 passing, 1229/1229 individual assertions passing). Logged verbatim in `.planning/phases/24-local-curation-mode/deferred-items.md` per the Scope Boundary rule; not fixed, since fixing it (installing packages / generating data) is outside this task's scope and outside Rule 1-3 auto-fix boundaries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/lib/copy-data-tree.mjs` and `scripts/lib/curation-guard.mjs` are ready for `scripts/curate-server.mjs` (a later Phase 24 plan) to import directly — both are side-effect-free and importable without triggering `build-widgets.mjs`'s self-executing build.
- The widened vitest glob is in place for every subsequent Phase 24 plan's `scripts/**/*.test.mjs` tests.
- `.curate-dist/` is gitignored ahead of the esbuild overlay bundle a later plan will emit there.
- Blocker/concern for the orchestrator: the pre-existing worktree `node_modules`/generated-data gap described above affects `npm test`'s exit code in this and likely sibling wave worktrees; it is environment infrastructure, not phase-24 code, and should be triaged separately from this plan's correctness.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-08-27*
