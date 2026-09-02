# Phase 24 — Deferred Items

## Pre-existing worktree environment gap (not caused by plan 24-01)

**Found during:** plan 24-01, Task 1 verification (`npm test`)

**Symptom:** 6 of 55 collected test files fail in this parallel-execution worktree:
- `src/dashboard/views/trends-training-load-logic.test.ts` — ENOENT on `data/stats/training-load.json`
- `src/dashboard/views/trends-yoy-logic.test.ts` — ENOENT on `data/stats/year-over-year.json`
- `src/dashboard/views/trends-zoom-logic.test.ts` — ENOENT on
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` (relative-path read from the
  test file, not a bare `import`)
- (plus 3 more sibling trends-* files with the same class of failure)

**Root cause:** this worktree's own `node_modules/` is empty (0 packages) — Node's module
resolution walks up to the main repo's `node_modules/` for bare `import` specifiers (which is why
`vite`/`vitest` themselves run fine), but these three test files build an explicit **relative**
`new URL('../../../node_modules/...', import.meta.url)` path, which resolves inside the worktree
itself and finds nothing there. Separately, `data/stats/*.json` is gitignored generated build
output (per `.gitignore`) and was never produced in this worktree checkout.

**Why out of scope for plan 24-01:** None of the 6 failing files import or reference
`vitest.config.ts`, `.gitignore`, `scripts/lib/copy-data-tree.mjs`, or `scripts/build-widgets.mjs`
— the four files this plan's Task 1 touches. The failures are reproducible on a clean worktree
checkout regardless of this plan's changes; the widened `include` glob still collects the
identical 55 test files (0 dropped, 0 added — no `scripts/**/*.test.mjs` file exists yet before
Task 3), and all 1218 previously-passing assertions in the other 49 files still pass.

**Disposition:** Not fixed. Logged per the Scope Boundary rule (only auto-fix issues directly
caused by the current task's changes). The orchestrator/user should confirm whether this is
expected parallel-worktree infrastructure behavior (each agent worktree does not get its own
`npm install` or a copy of generated `data/stats/`) or a setup bug to address at the harness
level, not inside this plan.
## 24-02: `npm test` full-suite failures are a worktree environment gap, not a regression

**Logged:** 2026-08-27, plan 24-02, Task 3

`npm test` reports 6 failed test files / 1292 passed tests when run inside this plan's git
worktree (`.claude/worktrees/agent-aadbcf18a1079fc0f`). All six failures are `ENOENT`-level
import errors, not assertion failures — the affected files read gitignored build artifacts
(`node_modules/chartjs-plugin-zoom/...`, `data/stats/*.json`) that a git worktree checkout does
not carry (both are listed in `.gitignore`: `node_modules/`, `data/stats/`). The main repo
checkout (`/Users/pedf/workspace/strava-widgets`) has both present. Node's module resolution
walks up to the main repo's `node_modules` for `vitest`/`tsc` themselves (which is why those ran
at all), but the six failing test files construct paths relative to `import.meta.url` or `cwd`,
which stay pinned to the worktree root.

Out of scope for this plan: none of the six failing files (`trends-training-load-logic.test.ts`,
`trends-yoy-logic.test.ts`, `trends-zoom-logic.test.ts`, and three siblings) were touched by
24-02's three tasks (`detail-sections.ts`, `detail.ts`, `curation-seam.test.ts`), and the failure
mode (missing gitignored artifact) is identical with or without this plan's changes.

**Verified in-scope tests are clean:**
- `npx vitest run src/dashboard/curation-seam.test.ts` — 74/74 pass (new file, this plan)
- `npx vitest run src/dashboard/row-semantics.test.ts src/dashboard/row-navigation.test.ts` —
  91/91 pass (the `stripComments` import site, confirmed unperturbed)
- `npx tsc --noEmit` — exits 0
- `npm test`'s own tally: **0 assertion failures**, 1292/1292 executed tests pass; the 6 file-level
  failures are all pre-existing ENOENT import errors from gitignored artifacts absent in this
  worktree checkout

**Disposition:** Not fixed (would require either committing gitignored build artifacts, which
`.gitignore`'s own comments explicitly reject, or running `npm install`/a full `compute-*` build
inside the worktree, which is outside this plan's file scope). Left for the orchestrator's
merge-back into the main checkout, where both artifacts already exist and `npm test` is expected
to run fully green.

## 24-12: `npm test` full-suite failures are the same recurring worktree environment gap

**Logged:** 2026-09-02, plan 24-12, Task 2

`npm test` reports 7 failed test files / 1373 passed / 4 assertion failures when run inside this
plan's git worktree (`.claude/worktrees/agent-adc353115e8f3e511`), even after running
`npm run build-widgets` locally to produce `dist/widgets/index.html` (needed for this plan's own
liveness suite, T1c). Two failure classes, both pre-existing and unrelated to
`scripts/curate-server.mjs`/`scripts/curate-server.test.mjs`:

- `src/dashboard/views/records-logic.test.ts` and four `trends-*-logic.test.ts` siblings —
  `ENOENT` on `data/stats/*.json` (gitignored generated build output, never produced in this
  worktree; same root cause as the 24-01/24-02 entries above).
- `scripts/verify-dashboard-publish-guard.test.mjs` (4 assertion failures) — its own
  `describe.skipIf(!existsSync(INDEX_HTML))` guard let the suite run once `build-widgets` produced
  `dist/widgets/index.html`, but the suite's own `main()` invocation (via its `run()` helper
  spawning the real CLI) then FATALs on the separate, still-missing
  `dist/widgets/data/dashboard/index.json` (`compute-dashboard-index` output, which needs
  `dist/index.js` from `npm run build` plus real archive data — out of this plan's scope and not
  run here).

**Verified in-scope tests are clean:** `npx vitest run scripts/curate-server.test.mjs` —
45/45 pass, including the new malformed-encoding, real-socket liveness/gate, and
listener-symmetry cases added by this plan. `git diff --name-only` for this plan's Task 2 commit
lists only `scripts/curate-server.mjs`.

**Disposition:** Not fixed, same reasoning as the 24-01/24-02 entries — requires either a full
`compute-*` pipeline run (real archive data, out of scope) or committing gitignored artifacts.
Left for the orchestrator's merge-back into the main checkout.
---

**24-13 confirmation:** Same 6-file ENOENT pattern reproduced verbatim in this plan's worktree
(`.claude/worktrees/agent-a4e81cd0a136ff64d`) — `data/stats/*.json` and
`node_modules/chartjs-plugin-zoom/...` still absent, none of the 6 failing files
(`trends-*-logic.test.ts`, `trends-zoom-logic.test.ts`) touched by this plan's 3 files
(`detail-best-efforts-logic.ts`, `detail-best-efforts-logic.test.ts`, `detail.ts`).
`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` — 26/26 pass.
`npm test`'s own tally: 0 assertion failures, 1369/1369 executed tests pass; only the 6
pre-existing file-level ENOENT failures. Not fixed, same disposition as 24-02's entry above.

## 24-15: same recurring worktree environment gap, plus the same `verify-dashboard-publish-guard.test.mjs` FATAL as 24-12's entry once a real build exists

**Logged:** 2026-09-02, plan 24-15, Task 2

Before Task 2's build-level proof, `npm test` in this worktree
(`.claude/worktrees/agent-a54c473f3ab653895`) reported the familiar 6-file ENOENT pattern with
**0 assertion failures** (`data/stats/*.json` and `node_modules/chartjs-plugin-zoom/...` absent;
`verify-dashboard-publish-guard.test.mjs`'s 5 tests self-skipped via its own
`describe.skipIf(!existsSync(INDEX_HTML))` guard, since `dist/widgets/index.html` did not yet
exist — only the gitignore-tracked `dist/widgets/test.html`).

Task 2's own action REQUIRES a real `npm run build-widgets` against the real `dist/widgets` tree
(the plan's stated deliverable is the operator-facing build message, not a unit assertion), so
Task 1's `dist/widgets/index.html` came into existence as a side effect of doing the task
correctly. That un-skips `verify-dashboard-publish-guard.test.mjs`'s suite, which then FATALs
identically to 24-12's entry above: its `main()` invocation needs
`dist/widgets/data/dashboard/index.json` (`compute-dashboard-index` output, itself needing
`dist/index.js` from `npm run build` plus real archive data — out of this plan's scope, never
produced in this worktree). Post-Task-2 `npm test`: 7 failed files, 4 assertion failures inside
`verify-dashboard-publish-guard.test.mjs`, 1390/1394 tests pass — the same two pre-existing
classes as 24-12, not caused by `scripts/lib/curation-guard.mjs`.

**Verified in-scope tests are clean:** `npx vitest run scripts/lib/curation-guard.test.mjs` —
21/22 pass, 1 skipped (the real-tree `describe.skipIf` regression case, which also self-skips
until a build exists; run separately against the Task-2 build and confirmed `[]`). `npx tsc
--noEmit` exits 0. `git status --porcelain` after Task 2 completes lists no tracked-file changes
(the build output is gitignored) — `git diff --name-only` for this plan's two commits lists only
`scripts/lib/curation-guard.mjs` and `scripts/lib/curation-guard.test.mjs`.

**Disposition:** Not fixed, same reasoning as every prior entry in this file — requires either a
full `compute-*` pipeline run (real archive data, out of scope) or committing gitignored
artifacts. Left for the orchestrator's merge-back into the main checkout, where
`data/stats/`/`data/dashboard/` already exist and `npm test` is expected to run fully green.

**24-16 confirmation (Task 1):** Identical 6-file ENOENT pattern reproduced verbatim in this
plan's worktree (`.claude/worktrees/agent-ad4055f04919a3029`) — `data/stats/*.json`
(`records-logic`, `trends-cadence-hr-logic`, `trends-gear-logic`, `trends-training-load-logic`,
`trends-yoy-logic`) and `node_modules/chartjs-plugin-zoom/...` (`trends-zoom-logic`) still absent,
none of the 6 failing files touched by this plan's 3 files (`detail-best-efforts-logic.ts`,
`detail-best-efforts-logic.test.ts`, `curation-seam.test.ts`).
`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` — 44/44 pass (18 new: 6
`resolveExcluded` unit cases + 12-combination table). `npx tsc --noEmit` — exits 0. `npm test`'s
own tally: 0 assertion failures, 1395/1395 executed tests pass; only the 6 pre-existing
file-level ENOENT failures. Not fixed, same disposition as 24-02's entry above.
