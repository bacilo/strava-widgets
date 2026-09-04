# Phase 25 — Deferred Items

## 25-05: `npx vitest run src/dashboard` full-suite failures are the same recurring worktree environment gap (not caused by this plan)

**Logged:** 2026-09-04, plan 25-05, Task 1

`npx vitest run src/dashboard` in this plan's git worktree
(`.claude/worktrees/agent-aeffe44762ffeef91`) reports 6 failed test files / 29 passed / **0
assertion failures** (991/991 executed tests pass):

- `src/dashboard/views/records-logic.test.ts`
- `src/dashboard/views/trends-cadence-hr-logic.test.ts`
- `src/dashboard/views/trends-gear-logic.test.ts`
- `src/dashboard/views/trends-training-load-logic.test.ts`
- `src/dashboard/views/trends-yoy-logic.test.ts`
- `src/dashboard/views/trends-zoom-logic.test.ts` — `ENOENT` on
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` (a `new
  URL('../../../node_modules/...', import.meta.url)`-relative path read from the test file, not
  a bare `import`)

**Root cause (identical to the pattern documented across Phases 21/22/24's own
`deferred-items.md`):** this worktree's own `node_modules/` is effectively empty (only Vite's
`.vite`/`.vite-temp` caches). Node's module resolution walks up to the main repo's
`node_modules/` for bare `import` specifiers (which is why `vitest`/`tsc` themselves run fine),
but these 6 test files build explicit relative paths (`new URL('../../../node_modules/...',
import.meta.url)` or gitignored `data/stats/*.json` reads) that resolve inside the worktree
itself and find nothing there.

**Why out of scope for plan 25-05:** None of the 6 failing files import or reference
`src/dashboard/theme-bootstrap-parity.test.ts`, `src/dashboard/index.html`, or
`src/dashboard/theme.ts` — the only files this plan's two tasks touch (`index.html` only
temporarily, per Task 2, and restored byte-identical). The failure mode (missing gitignored
`node_modules` package under a relative path) is identical with or without this plan's changes,
and is reproducible on a clean worktree checkout regardless.

**Verified in-scope tests are clean:**
- `npx vitest run src/dashboard/theme-bootstrap-parity.test.ts` — 16/16 pass (this plan's new
  file).
- `npx tsc --noEmit` — exits 0.
- `npx vitest run src/dashboard`'s own tally: **0 assertion failures**, 991/991 executed tests
  pass; the 6 file-level failures are all pre-existing `ENOENT` import errors from a
  gitignored/absent `node_modules` package, not from this plan's changes.

**Disposition:** Not fixed. Logged per the Scope Boundary rule (only auto-fix issues directly
caused by the current task's changes) and consistent with the identical disposition recorded
across Phase 21/22/24's `deferred-items.md` entries for the same recurring worktree-environment
gap. Left for the orchestrator's merge-back into the main checkout, where `node_modules` is fully
installed and `npx vitest run src/dashboard` is expected to run fully green.
