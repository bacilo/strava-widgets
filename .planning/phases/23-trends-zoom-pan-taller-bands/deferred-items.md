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

**RESOLVED 2026-08-19 during plan 23-03 Task 2:** Plan 23-03's own verify
step for Task 2 required `npm run verify-dashboard`, which itself requires
`data/dashboard/index.json` and the `data/stats/*.json` fixtures above — so
this pre-existing environment gap became directly blocking, not just
pre-existing test noise. Ran `npm run build` (tsc, `dist/index.js` also did
not exist yet), then `npm run compute-dashboard-index` and
`npm run compute-all-stats`, both of which succeed entirely from the
committed archive (`data/activities/`, `data/streams/`) with no network
calls — `data/private/athlete-private.json` is absent (expected on a fresh
worktree; age-grading/Banister TRIMP degrade to disabled, non-fatal, matches
the athlete-private test's own documented ENOENT-tolerant behavior). All
five previously-failing test files now pass (54/54 files, 1317/1317 tests),
`npm run build-widgets` copies the new `data/stats/`/`data/dashboard/` into
`dist/widgets/`, and `npm run verify-dashboard` reports 37/37 checks
passing. `data/stats/` and `data/dashboard/` are both gitignored — nothing
from this generation step is committed. One side effect was caught and
reverted before committing: `npm run compute-all-stats` also touches
`data/geo/geo-metadata.json`'s `generatedAt` timestamp as a byproduct of a
shared code path; that file was restored via `git checkout --` before the
Task 2 commit, since it is unrelated to Phase 23. Left in place (not
reverted) for any later Phase 23 plan that also runs the full verification
gate: the generated `data/stats/`/`data/dashboard/` files themselves,
since they are gitignored and regenerating them is idempotent/free.
