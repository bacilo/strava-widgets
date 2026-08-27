---
phase: 24-local-curation-mode
plan: 05
subsystem: build-verify
tags: [http-guard, vitest, subprocess-test, absence-proof, d-11]

# Dependency graph
requires:
  - "24-01: vitest.config.ts include glob widened to scripts/**/*.test.mjs; scripts/lib/curation-guard.mjs (build-time half of D-10)"
provides:
  - "scripts/verify-dashboard-publish.mjs — three new expect404 assertions: /__curate/health, /__curate/overlay.js, /__curate/exclusions/{id}, all asserted 404 at the production /strava-widgets/__curate/... URL shape"
  - "scripts/verify-dashboard-publish-guard.test.mjs — subprocess proof (execFileSync against the real shipped script) that the HTTP guard is observed failing against three distinct planted curate artifacts"
affects: [24-06, 24-07, 24-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subprocess planted-fixture regression test: execFileSync('node', [real script]) against the real dist/widgets, asserting non-zero exit + matched failure line, cleaned up in try/finally + afterEach"

key-files:
  created:
    - scripts/verify-dashboard-publish-guard.test.mjs
  modified:
    - scripts/verify-dashboard-publish.mjs

key-decisions:
  - "Used activity id 3475726256 (a real archive activity, also referenced in STATE.md's exclusion-tickbox todo) for the write-endpoint expect404 path, matching the plan's instruction to use a representative real id"
  - "describe.skipIf(!existsSync('dist/widgets/index.html')) gates the whole new test file so a fresh checkout without a build does not break npm test — mirrors the shipped script's own FATAL-if-missing convention"

requirements-completed: [CUR-01]

# Metrics
duration: ~40min
completed: 2026-08-27
---

# Phase 24 Plan 05: HTTP Absence Guard (D-10b) + Planted-Fixture Proof (D-11) Summary

**Shipped three literal `/__curate/*` expect404 assertions in the real, shipped `verify-dashboard-publish.mjs`, then proved them with a subprocess test that plants three distinct fake curate artifacts into the real `dist/widgets` and observes the shipped script exit non-zero for each — including a temporary comment-out/restore experiment confirming the test is bound to those specific assertions, not an incidental failure.**

## Performance

- **Duration:** ~40 min (including worktree recovery — see Issues Encountered)
- **Completed:** 2026-08-27
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `scripts/verify-dashboard-publish.mjs` gained three `expect404` calls beside the existing `/data/private/` guards, asserting `/__curate/health`, `/__curate/overlay.js`, and `/__curate/exclusions/3475726256` all 404 at the real production `/strava-widgets/__curate/...` URL shape (D-10(b))
- The existing `/data/best-effort-exclusions.json` 200-and-parses assertion (lines 294-301) is byte-identical — `git diff` shows additions only, no modification of the pre-existing hunk
- `scripts/verify-dashboard-publish-guard.test.mjs` (new) runs the real, shipped script via `execFileSync('node', ['scripts/verify-dashboard-publish.mjs'])` — the strongest available evidence for D-11 since it exercises production code byte-for-byte, not a mock
- Case A (clean run) asserts all three `✓ GET /__curate/... -> 404` lines AND the public exclusions parses line appear together in one clean run
- Cases B/C/D each plant a distinct fake artifact (overlay bundle, health probe, write-endpoint file) into the real `dist/widgets`, assert the real script exits non-zero, and assert the matched `GET ... expected 404` failure line — then clean up in a `finally` and an `afterEach`
- D-11 fully discharged with the mandatory two-direction proof: the three new `expect404` calls were temporarily commented out, the test file re-run (cases B/C/D went RED — see below), then restored to a byte-identical diff (`git diff scripts/verify-dashboard-publish.mjs` returned empty) and re-run green

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the three `/__curate` expect404 assertions beside the `/data/private/` guards (D-10b)** - `aee96b6` (feat)
2. **Task 2: Prove the HTTP guard red — subprocess planted-fixture regression test (D-11)** - `308249a` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `scripts/verify-dashboard-publish.mjs` — three new `expect404` calls + an explanatory comment block (D-10(b) provenance, prefix-mount rationale, non-widening warning), inserted between the `/data/private/` guards and the exclusions `expect200` block
- `scripts/verify-dashboard-publish-guard.test.mjs` (new) — 5 vitest cases: clean-run dual assertion (Case A), three planted-fixture non-zero-exit cases (B/C/D), and a post-suite fixture-survival check

## D-11 observed failing

Per the plan's mandatory discharge, cases B, C and D were each run directly against the real shipped script (`node scripts/verify-dashboard-publish.mjs`) with a single fake artifact planted at a time, capturing the exact exit code and the matched failure line:

**Case B — planted `dist/widgets/__curate/overlay.js`:**
```
EXIT CODE: 1
✗ GET /__curate/overlay.js expected 404 (the curate overlay bundle must never be published), got 200
```

**Case C — planted `dist/widgets/__curate/health`:**
```
EXIT CODE: 1
✗ GET /__curate/health expected 404 (the curate health probe must never be published), got 200
```

**Case D — planted `dist/widgets/__curate/exclusions/3475726256`:**
```
EXIT CODE: 1
✗ GET /__curate/exclusions/3475726256 expected 404 (the curate write endpoint must never be published), got 200
```

Each planted artifact was removed immediately after capture; `test -e dist/widgets/__curate` returned false after every run.

**The commented-out-assertions experiment (proving the test is bound to those specific calls, not an incidental failure):**

The three new `expect404(baseUrl, '/__curate/...', ...)` lines in `scripts/verify-dashboard-publish.mjs` were temporarily replaced with a comment. Re-running `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` against the neutered script produced:

```
FAIL  ... > Case A (clean): ...
AssertionError: expected '✓ GET / -> 200\n✓ GET / includes "dat…' to contain '✓ GET /__curate/health -> 404'
  (37 checks passed instead of 40 — the three /__curate lines are simply absent)

FAIL  ... > Case B (planted overlay bundle): the real, shipped verifier exits non-zero and names the overlay path
AssertionError: expected +0 not to be +0 // Object.is equality

FAIL  ... > Case C (planted health file): the real, shipped verifier exits non-zero and names the health path
AssertionError: expected +0 not to be +0 // Object.is equality

FAIL  ... > Case D (planted write-endpoint file): the real, shipped verifier exits non-zero and names the write-endpoint path
AssertionError: expected +0 not to be +0 // Object.is equality

Test Files  1 failed (1)
     Tests  4 failed | 1 passed (5)
```

All three planted-fixture cases (B/C/D) went RED — with the assertions removed, the verifier now happily returns 200 for every planted `/__curate/*` file and exits 0, so `expect(result.status).not.toBe(0)` fails. This is direct proof the test is exercising exactly the three new assertions, not some coincidental unrelated failure.

The three lines were then restored verbatim (`git diff scripts/verify-dashboard-publish.mjs` against the working tree returned empty output — byte-identical to the committed Task 1 state), and the suite was re-run:

```
✓ scripts/verify-dashboard-publish-guard.test.mjs (5 tests) 330ms
Test Files  1 passed (1)
     Tests  5 passed (5)
```

## Decisions Made

- No new decisions beyond what `24-CONTEXT.md`/`24-RESEARCH.md`/`24-PATTERNS.md` already locked (D-10, D-11, D-02's prefix-mount reasoning). Wave 2 executed the documented design as specified.
- Used the real archive activity id `3475726256` for the write-endpoint path, per the plan's instruction to use "a real archive activity id so the path is representative of a genuine write URL" — this id is also referenced in `STATE.md`'s original exclusion-tickbox todo as one of the developer's two example excluded activities.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria are met as specified.

## Issues Encountered

- **Worktree base drift (setup-time, not a plan deviation):** at agent startup, this worktree's `HEAD` was found on a stale base far behind the expected `df71d2b74df07c8940807f4da6a794e889d45258` (the Phase 24 Wave 1 tracking commit) — the working tree had accumulated CI auto-commit history (`chore: update activities and stats [skip ci]`) layered on a pre-Phase-24 checkout, missing `.planning/phases/24-local-curation-mode/` entirely. The branch was confirmed on the correct `worktree-agent-*` namespace (not a protected ref) with a clean working tree, so per the `<worktree_branch_check>` protocol a `git reset --hard` to the expected base was performed before any plan work began. This is orthogonal to plan 24-05's own changes.
- **This worktree's `node_modules/` and `dist/` did not exist at agent start** (a more severe instance of the "known worktree environment gap" the prompt pre-documented as `node_modules/ empty`). Node's module resolution walks up parent directories and found the sibling main-repo `node_modules/` at `/Users/pedf/workspace/strava-widgets/node_modules`, so `npm run <script>` and `npx vitest` both worked without a fresh `npm install`. However, `dist/widgets` and `dist/index.js` (backend CLI) were not built, and `data/dashboard/index.json`/`data/stats/*.json` did not exist, so `npm run verify-dashboard` FATAL-exited on first attempt. Ran `npm run build-widgets` → `npm run build` → `npm run compute-dashboard-index` → `npm run compute-all-stats` → `npm run build-widgets` (again, to copy the freshly generated data into `dist/widgets`) to reach a state where `npm run verify-dashboard` could actually execute and where `scripts/verify-dashboard-publish-guard.test.mjs`'s `describe.skipIf` gate would engage (`dist/widgets/index.html` now exists). This is standard project setup (all packages already declared in `package.json`, no new dependency), not a Rule 3 package-legitimacy concern.
  - Side effect: `data/geo/geo-metadata.json`'s `generatedAt` timestamp field was updated by the `compute-all-stats` run (an unrelated, gitignored-adjacent build artifact this plan does not modify or claim). Left unstaged and uncommitted per the Scope Boundary rule — out of scope for this plan's `files_modified`.
  - Per the parallel-execution instructions, this is the same pre-documented worktree-environment gap already logged twice in `deferred-items.md`; not re-logged here.
- **`npm test` full-suite result:** 1397/1397 individual test assertions pass; one file-level failure (`src/dashboard/views/trends-zoom-logic.test.ts`, `ENOENT` on a hard-coded `../../../node_modules/chartjs-plugin-zoom/...` relative path that resolves differently at this worktree's nesting depth) is the pre-documented, pre-existing worktree environment gap — unrelated to any file this plan touches. `scripts/lib/curation-guard.test.mjs` (11), `scripts/verify-dashboard-publish-guard.test.mjs` (5, this plan's new file), and `src/dashboard/curation-seam.test.ts` (74, from a sibling wave-2 plan) all pass cleanly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The two-layer D-10 absence guard is now complete end-to-end: the build-time half (`assertNoCurationArtifacts`, shipped in plan 24-01) and the HTTP half (this plan) both exist, both scoped to never catch the public `/data/best-effort-exclusions.json` file, and both independently proven to fail against a real planted regression (D-11 discharged twice — once per layer).
- `scripts/curate-server.mjs` (a later Phase 24 plan) can rely on `/__curate/*` staying structurally unreachable in any published build without further verifier changes.
- Blocker/concern for the orchestrator: this worktree required a `dist/widgets` + `dist/index.js` + `data/dashboard`/`data/stats` build chain (5 sequential `npm run` commands) before `verify-dashboard`/`verify-dashboard-publish-guard.test.mjs` could execute at all — more severe than the "node_modules empty" framing in the pre-flight note (node_modules and dist/ were entirely absent). If sibling wave-2 plans also depend on a built `dist/widgets`, they likely hit the same setup cost independently in their own worktrees.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-08-27*
