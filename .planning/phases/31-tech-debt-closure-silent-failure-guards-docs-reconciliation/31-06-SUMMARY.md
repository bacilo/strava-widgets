---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 06
subsystem: infra
tags: [scripts, vitest, node, testing, generator]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: "isStreamFile, the manifest.json-excluding filter, invented in compute-pace-quality-calibration.mjs as the G-01 fix"
provides:
  - "scripts/lib/stream-files.mjs — the single owner of isStreamFile/idFromFilename"
  - "compute-pace-residual.mjs's sweepArchive() now excludes manifest.json from its archive-size denominator (27 G-03 closed)"
  - "listStreamFilenames(dirPath), a unit-testable seam for the manifest exclusion"
affects: [31-05, 31-07, 31-08, 31-09, 31-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared scripts/lib/*.mjs module with no top-level side effects, extracted so two generator scripts can import one filter without either taking a static import edge into the other's execSync/REGENERATE_COMMAND module-scope machinery (precedent: scripts/lib/copy-data-tree.mjs)"
    - "Testable seam extraction: a small pure listStreamFilenames(dirPath) helper pulled out of an otherwise-unexported sweep function, mirroring the project's existing readdirSync+filter try/catch degrade-not-throw convention"

key-files:
  created:
    - scripts/lib/stream-files.mjs
  modified:
    - scripts/compute-pace-quality-calibration.mjs
    - scripts/compute-pace-residual.mjs
    - scripts/compute-pace-residual.test.mjs

key-decisions:
  - "isStreamFile/idFromFilename lifted verbatim into scripts/lib/stream-files.mjs; compute-pace-quality-calibration.mjs re-exports both (rather than dropping the names) so its own guard test's `mod.isStreamFile`/`mod.idFromFilename` access is unaffected by the move"
  - "listStreamFilenames(dirPath) exported as the seam, not sweepArchive() itself — sweepArchive() reads and JSON-parses every stream at archive scale and is not unit-testable that way; the filename-selection step alone is"
  - "26-RESIDUAL.md, rewritten by the CLI cross-check run, reverted with git checkout -- rather than committed — that regeneration belongs to this phase's later docs-reconciliation wave (TD-05), not this plan"

patterns-established:
  - "scripts/lib/stream-files.mjs: the second scripts/lib/*.mjs extraction after copy-data-tree.mjs, following the same 'no top-level side effects, importable by both without cross-file execSync coupling' contract"

requirements-completed: []
# TD-05 tick rule (per this plan's own <output> spec): TD-05 spans 31-06, 31-07,
# 31-08, 31-09 and 31-10 and ticks only in 31-10, after the PR-04 Round 4
# verdict. Left unticked here deliberately.

# Metrics
duration: ~35min
completed: 2026-09-19
---

# Phase 31 Plan 06: Fix compute-pace-residual.mjs's manifest.json miscount (27 G-03) Summary

**`isStreamFile` now has exactly one owner in `scripts/lib/stream-files.mjs`; `compute-pace-residual.mjs`'s archive sweep excludes `manifest.json` via a unit-testable `listStreamFilenames` seam, closing the off-by-one that inflated `26-RESIDUAL.md`'s denominator by one stream file.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Extracted `isStreamFile`/`idFromFilename` from `compute-pace-quality-calibration.mjs` into a new `scripts/lib/stream-files.mjs`, with no top-level side effects, following the `copy-data-tree.mjs` extraction precedent named in `31-CONTEXT.md`/`31-RESEARCH.md` Pitfall 4.
- Both generators now import from the one shared module; `compute-pace-quality-calibration.mjs` re-exports the two functions so its own existing guard test is unaffected.
- `compute-pace-residual.mjs`'s `sweepArchive()` filter changed from the naive `f.endsWith('.json')` glob to `isStreamFile`, with a one-line comment naming 27 G-03.
- Gave the manifest exclusion a unit-testable seam: exported `listStreamFilenames(dirPath)`, which does the `readdirSync` + `isStreamFile` filter and degrades to an empty list (not a throw) for an unreadable/absent directory, matching `sweepArchive()`'s own degrade behaviour.
- Added tests (in a `describe` block named `listStreamFilenames — the manifest.json exclusion (regression for 27 G-03)`, matching `-t "manifest"`) that plant two per-activity JSON files, a `manifest.json`, and a `.txt` file in an `fs.mkdtemp` directory, assert the filtered listing excludes `manifest.json`, and assert the unfiltered `.endsWith('.json')` listing of the same directory returns exactly one more entry — the explicit before/after demonstrating the fix is load-bearing. A second test covers an absent directory, asserting an empty list without throwing.
- Ran the CLI cross-check on the primary worktree's committed `data/streams/` (the live archive is checked out into this worktree per its setup instructions, not a bare/gitignored-absent tree):
  - **Pre-fix count** (unfiltered `find data/streams -name '*.json'`, includes `manifest.json`): **1875**
  - **Post-fix count** (`find data/streams -name '*.json' ! -name manifest.json`): **1874**
  - **`node scripts/compute-pace-residual.mjs`'s `Archive size scanned:`** (post-fix, using the new `isStreamFile` filter): **1874**
  - The post-fix count and the CLI's reported archive size are equal, confirming the manifest exclusion is correctly wired end-to-end; the pre-fix number quantifies the exact off-by-one 27 G-03 named.
- `26-RESIDUAL.md` was rewritten by the CLI run above (it regenerates the file as a declared side effect of `main()`) and was reverted with `git checkout --` immediately after capturing the numbers, so this plan's diff stays inside its declared `files_modified`. That regeneration against the fixed generator, and the artifact's committed correction, is this phase's later docs-reconciliation wave's (TD-05) job, not this plan's.

## Task Commits

Each task was committed atomically:

1. **Task 1: Give isStreamFile one owner in scripts/lib and have both generators import it** - `e25a507c` (fix)
2. **Task 2: Make the manifest exclusion reachable by a unit test and confirm the live count** - `c3272695` (test)

_No separate plan-metadata commit is made in worktree mode; this SUMMARY.md is committed on its own by the harness after this file is written._

## Files Created/Modified

- `scripts/lib/stream-files.mjs` (created) - the single owner of `isStreamFile`/`idFromFilename`, no top-level side effects
- `scripts/compute-pace-quality-calibration.mjs` (modified) - local `isStreamFile`/`idFromFilename` definitions removed, re-exported from the shared module instead
- `scripts/compute-pace-residual.mjs` (modified) - imports `isStreamFile` from the shared module; `sweepArchive()`'s filter now uses it via the new exported `listStreamFilenames(dirPath)` seam
- `scripts/compute-pace-residual.test.mjs` (modified) - new `describe('listStreamFilenames — the manifest.json exclusion (regression for 27 G-03)', ...)` block: two planted-fixture tests (filter correctness + before/after count, and an absent-directory degrade case)

## Decisions Made

- Re-export (not re-declare) `isStreamFile`/`idFromFilename` from `compute-pace-quality-calibration.mjs` after the move, so the existing guard test at `compute-pace-quality-calibration.test.mjs` (which does `mod.isStreamFile(...)` via a dynamic import) keeps working unchanged — the plan's "this is a move, not a rewrite" constraint required behavior parity, and this is the minimal way to get it.
- Chose to extract `listStreamFilenames(dirPath)` (the filename-selection step only) rather than exporting `sweepArchive()` itself, per the plan's explicit guidance — `sweepArchive()` reads and JSON-parses every stream file at archive scale, which is not something a unit test should do, whereas the filename filter is a small pure(ish) I/O boundary function.
- Removed the now-redundant inline try/catch inside `sweepArchive()` for the directory-read step, since that behavior moved into `listStreamFilenames` verbatim (same warning message, same empty-array-on-failure return).

## Deviations from Plan

None - plan executed exactly as written. The worktree's `data/streams/` was pre-populated with the tracked archive (1875 files including manifest, per this project's own recorded lesson that `data/streams/` and `data/activities/` are tracked in git and present even in bare worktrees), so the CLI cross-check specified as "run on the primary checkout" was run directly in this worktree instead, per this plan's explicit environment instructions — no deviation from the plan's intent, since the numbers it needed were reachable here.

## Issues Encountered

None. `npm test` required a one-time `npm run build` (`tsc`) and `npm run build-widgets` in this worktree before the full suite was green — both are environment setup, not code changes, and are not part of this plan's `files_modified`. After that, `npm test` was 84/84 files, 2552/2552 tests passing; `npx tsc --noEmit` was clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/lib/stream-files.mjs` is available for any future consumer needing the manifest-excluding filter.
- TD-05's regeneration wave (31-08/31-09/31-10 per `31-RESEARCH.md`'s recommended wave order) can now regenerate `26-RESIDUAL.md` against the fixed generator and commit the corrected `Archive size scanned: 1874` denominator plus its downstream figures (e.g. PACE-06's "14 of the 154" residual count, itself unaffected by the manifest fix but sharing the same corrected archive-size context).
- TD-05 requirement stays unticked here per this plan's own tick-rule instruction; it ticks only in 31-10.

## Self-Check: PASSED

- FOUND: scripts/lib/stream-files.mjs
- FOUND: scripts/compute-pace-quality-calibration.mjs (modified)
- FOUND: scripts/compute-pace-residual.mjs (modified)
- FOUND: scripts/compute-pace-residual.test.mjs (modified)
- FOUND commit e25a507c (fix(31-06): give isStreamFile one owner in scripts/lib (27 G-03))
- FOUND commit c3272695 (test(31-06): make the manifest exclusion reachable by a unit test)
- CONFIRMED: `git status --porcelain .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` is empty (reverted, not committed)
- CONFIRMED: `npm test` exits 0, 84/84 files, 2552/2552 tests

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*
