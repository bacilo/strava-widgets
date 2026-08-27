# Phase 24 — Deferred Items

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
