# Deferred Items — Phase 23

## Pre-existing: 5 test files fail on a fresh worktree due to missing `data/stats/*.json`

**Found during:** 23-02 Task 2, running full `npm test` per plan verification.

**Files:** `src/dashboard/views/records-logic.test.ts`,
`trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`,
`trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts` — all fail
with `ENOENT: no such file or directory, open 'data/stats/<file>.json'`.

**Root cause:** `data/stats/` is gitignored (`.gitignore:11`) and populated
only by running `npm run compute-all-stats` (part of the `process` pipeline
script) against the committed archive. This worktree was never run through
that pipeline, so the directory does not exist at all (`ls data/stats/*.json`
→ no matches). Confirmed this is an environment/data-generation gap, not a
regression — the failing tests read live JSON fixtures via `fs.readFileSync`
and have zero relationship to `styles.css` or `styles.test.ts`, the only two
files this plan (23-02) touches.

**Disposition:** Out of scope per the executor's SCOPE BOUNDARY rule (only
auto-fix issues directly caused by the current task's changes). Not fixed.
`src/dashboard/styles.test.ts` itself is fully green (135/135) and the
remaining 1185 tests across the other 48 test files all pass — only these 5
files fail to even load their live-data fixture. Someone running
`npm run compute-all-stats` (or an equivalent stats-generation step) before
`npm test` would resolve this; it is orthogonal to Phase 23's CSS/zoom-pan
work.
