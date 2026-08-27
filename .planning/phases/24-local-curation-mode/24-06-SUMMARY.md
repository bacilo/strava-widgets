---
phase: 24-local-curation-mode
plan: 06
subsystem: infra
tags: [node-http, node-child-process, vitest, curation-write-path]

# Dependency graph
requires:
  - phase: 24-local-curation-mode (plan 04)
    provides: "scripts/curate-server.mjs's static-serving half — CURATE_HOST/CURATE_PORT/MOUNT_PREFIX/CURATE_PREFIX, isCurateRoute, the isCurateRoute-first branch this plan's routes slot into"
  - phase: 24-local-curation-mode (plan 01)
    provides: "scripts/lib/copy-data-tree.mjs — copyJsonTree, RECOMPUTE_DATA_DIRS, imported for the recompute re-mirror step"
provides:
  - "scripts/curate-server.mjs — PUT/DELETE /__curate/exclusions/:activityId and POST /__curate/recompute, gated on isTrustedOrigin, writing data/best-effort-exclusions.json atomically and mirroring it into dist/widgets/data/"
  - "applyUpsert/applyRemove/isValidCurateActivityId/normalizeReason/isTrustedOrigin/writeAtomic/mirrorExclusions — pure, independently unit-tested exports"
  - "scripts/curate-server.test.mjs — 36 unit cases (21 new) covering the D-05 JSON contract, the untick-deletes-never-empty-array rule, server-side validation, and the D-12 Origin/Host matrix"
affects: [24-07, 24-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure mutation functions (applyUpsert/applyRemove) that never touch the filesystem, called by thin I/O wrapper functions (readExclusionsFile/persistExclusions) — the same split curation-guard.mjs (plan 24-01) established for D-11 testability"
    - "writeAtomic: sibling temp file + renameSync, a new pattern for this repo (every existing writeFileSync call site writes directly) — introduced because the mirrored file is read concurrently by the browser's own fetch"
    - "Streamed child_process.spawn output piped directly into an HTTP response as chunked text, with a fixed completion/failure marker line the client can recognise"

key-files:
  created: []
  modified:
    - scripts/curate-server.mjs
    - scripts/curate-server.test.mjs

key-decisions:
  - "No new decisions beyond what 24-CONTEXT.md/24-RESEARCH.md already locked (D-05, D-06, D-07, D-09, D-12) — this plan implemented the documented design and code examples (Architecture Patterns 3 and 4) as specified."
  - "mirrorExclusions() distinguishes the destination DIRECTORY (dist/widgets/data, created with mkdirSync if absent) from the PUBLISH ROOT (dist/widgets itself, which throws rather than being silently created if missing) — this reconciles the plan action text's two clauses ('create the destination directory if absent' vs 'fail... if the publish directory does not exist') without contradiction."

patterns-established:
  - "The isCurateRoute-first branch in serveCurateRoute is now async, with createServer's call site wrapping it in .catch() so an unhandled rejection in a write/recompute handler still produces a clean 500 rather than crashing the process — the shape any future /__curate/* route addition (plan 24-07/24-08's overlay-side work) should follow if it needs a new server route."

requirements-completed: [CUR-01]

# Metrics
duration: ~40min
completed: 2026-08-27
---

# Phase 24 Plan 06: Curate Server (write half — exclusions PUT/DELETE, recompute) Summary

**Added the write half of the curate server: `PUT`/`DELETE /__curate/exclusions/:activityId` and `POST /__curate/recompute`, both gated on an Origin/Host check, writing `data/best-effort-exclusions.json` via a sibling-temp-file-plus-rename atomic write and mirroring it into `dist/widgets/data/` synchronously — with the D-05 JSON contract, the untick-deletes-never-`distances:[]` rule, and the D-12 Origin matrix each observed failing when deliberately broken.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-27
- **Tasks:** 3/3
- **Files modified:** 2 (`scripts/curate-server.mjs`, `scripts/curate-server.test.mjs`)

## Accomplishments

- `applyUpsert(fileDoc, activityId, reason)` — pure, non-mutating; writes exactly `{ activityId, distances: null, reason }`; replaces an existing entry AT THE SAME INDEX (D-06, one reason per activity); preserves `schemaVersion`/`note` unchanged
- `applyRemove(fileDoc, activityId)` — pure, non-mutating; filters the entry OUT entirely, documented at the function with the exact failure it prevents (`buildExclusionIndex` silently skipping an entry whose `distances` is `[]`)
- `writeAtomic(path, contents)` — sibling temp file (`${path}.tmp-${process.pid}`) + `renameSync`, a new atomic-write pattern for this repo
- `mirrorExclusions()` — copies the working-tree exclusions file into the served `dist/widgets/data/` copy immediately after every successful write (D-07's instant mirror); creates the destination directory if absent, throws if `dist/widgets` itself is unbuilt
- `isTrustedOrigin(req, expectedHost)` — pure D-12 gate: rejects on Host mismatch; if Origin is present, its own host must also match; never throws on a malformed Origin
- `isValidCurateActivityId(id)` — mirrors `src/dashboard/router.ts`'s `/^i?\d{1,20}$/` server-side plus the `records-logic.ts` `__proto__` rejection; the write target path is always the hardcoded `EXCLUSIONS_PATH` constant, never derived from this id
- `normalizeReason(raw)` — D-08's server-side half: trims, enforces 1..`MAX_REASON_CHARS` (2000)
- `readJsonBody` — caps request bodies at `MAX_BODY_BYTES` (10 KB), destroying the request and responding 413 over the limit; `JSON.parse` errors respond 400
- `PUT`/`DELETE /__curate/exclusions/:activityId` — gate → validate id → (PUT only) read+cap+parse body → normalize reason → `applyUpsert`/`applyRemove` → `writeAtomic` → `mirrorExclusions` → `200 {"ok":true}`
- `POST /__curate/recompute` — gate → `existsSync('dist/index.js')` precondition (412 with an actionable `npm run build` message if missing) → `compute-best-efforts` then `compute-dashboard-index` via `child_process.spawn`, stdout/stderr streamed into the response as chunked text, the second step gated on the first's exit code 0 → on success, `copyJsonTree` over both `RECOMPUTE_DATA_DIRS` entries plus `mirrorExclusions()` → a recognisable `__CURATE_RECOMPUTE_DONE__`/`__CURATE_RECOMPUTE_FAILED__` marker line
- No code path in `scripts/curate-server.mjs` invokes `git` (D-09); `src/analytics/best-effort-exclusions.ts` was not modified and its `T-16-EX-01`/`T-16-EX-02` tests stay green
- `scripts/curate-server.test.mjs` grew from 15 to 36 cases: `applyUpsert` (5), `applyRemove` (4, including the named never-`distances:[]` test and a duplicate-entries case), `isValidCurateActivityId` (2), `normalizeReason` (2), `isTrustedOrigin` (6, the full D-12 matrix plus a port-only mismatch), source discipline (2)

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure exclusion mutations honouring D-05's exact JSON contract, plus the atomic write and instant mirror (D-07)** - `3cc70ba` (feat)
2. **Task 2: Route the write and recompute endpoints behind an Origin/Host gate and input validation (D-12, D-07)** - `1581887` (feat)
3. **Task 3: Extend the unit suite — D-05 shape, the never-empty-array rule, validation and the Origin matrix, each observed failing** - `b1a0ba9` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `scripts/curate-server.mjs` — added `EXCLUSIONS_PATH`/`PUBLISH_EXCLUSIONS_PATH`/`MAX_BODY_BYTES`/`MAX_REASON_CHARS` constants; `applyUpsert`, `applyRemove`, `writeAtomic`, `mirrorExclusions`, `readExclusionsFile`, `persistExclusions`, `isTrustedOrigin`, `isValidCurateActivityId`, `normalizeReason`, `readJsonBody`, `handleExclusionWrite`, `runComputeStep`, `handleRecompute`; wired `PUT`/`DELETE /__curate/exclusions/:activityId` and `POST /__curate/recompute` into `serveCurateRoute` (now `async`); `createServer`'s curate-route call site now `.catch()`s the async handler
- `scripts/curate-server.test.mjs` — 21 new cases across 6 new `describe` blocks (`applyUpsert`, `applyRemove`, `isValidCurateActivityId`, `normalizeReason`, `isTrustedOrigin`, `source discipline`), plus a shared `fixtureDoc()` helper mirroring the live archive shape

## Decisions Made

Followed `24-CONTEXT.md`/`24-RESEARCH.md` exactly — D-05 (exact JSON contract, never `distances: []`), D-06 (edit-in-place, one reason per activity), D-07 (instant mirror + separate deliberate recompute), D-09 (no git anywhere in this file), D-12 (Origin/Host gate before any body read). One clarifying implementation decision, not a scope change:

- **`mirrorExclusions()`'s two-directory distinction.** The plan's action text has two clauses that read as tension at first glance — "create the destination directory if absent" and "fail... with a clear 500 if the publish directory does not exist rather than writing a half state." Resolved by reading them as two different directories: the DESTINATION directory (`dist/widgets/data`, the immediate parent of `PUBLISH_EXCLUSIONS_PATH`) is created with `mkdirSync(..., {recursive:true})` if absent — a normal, safe operation once `dist/widgets` exists — while the PUBLISH ROOT (`dist/widgets` itself, i.e. an entirely unbuilt tree) causes `mirrorExclusions()` to throw, which the route handlers catch and turn into a 500. This satisfies both clauses without contradiction.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria are met as specified (see verification commands below).

## D-11 observed failing

Per the plan's mandatory discharge, two guards were each temporarily neutered, observed red, then restored to a byte-identical diff (`diff` against a pre-edit backup copy returned no difference before each restore) and re-run green.

### Experiment 1 — `applyRemove` weakened to set `distances: []` instead of filtering the entry out

**RED run** (`npx vitest run scripts/curate-server.test.mjs`):

```
 Test Files  1 failed (1)
      Tests  3 failed | 33 passed (36)

 FAIL  scripts/curate-server.test.mjs > applyRemove (D-05, the untick rule) > the entry is gone and the array is one shorter
 AssertionError: expected 2 to be 1 // Object.is equality

 FAIL  scripts/curate-server.test.mjs > applyRemove (D-05, the untick rule) > never leaves distances: [] — buildExclusionIndex silently skips such an entry, so the file would read as excluded while excluding nothing
 AssertionError: expected '{"schemaVersion":1,"note":"Hand-maint…' not to contain '"distances":[]'
 Expected: "distances":[]"
 Received: "{"schemaVersion":1,...,"exclusions":[{"activityId":"3475726256","distances":[],"reason":"Recorded with an inaccurate GPS device..."},{"activityId":"3475725513","distances":null,...}]}"

 FAIL  scripts/curate-server.test.mjs > applyRemove (D-05, the untick rule) > removing when duplicate entries exist for the same activity removes ALL of them
 AssertionError: expected { activityId: '3475726256', … } to be undefined
```

The named test — "never leaves distances: [] — buildExclusionIndex silently skips such an entry, so the file would read as excluded while excluding nothing" — is among the three failures, exactly as D-11 requires.

**GREEN run** (guard restored, byte-identical diff against the pre-edit backup): `36 tests | 36 passed`.

### Experiment 2 — `isTrustedOrigin` weakened to `return true` unconditionally

**RED run** (`npx vitest run scripts/curate-server.test.mjs`):

```
 Test Files  1 failed (1)
      Tests  4 failed | 32 passed (36)

 FAIL  scripts/curate-server.test.mjs > isTrustedOrigin (D-12) > rejects a matching Host with a cross-origin Origin
 AssertionError: expected true to be false // Object.is equality

 FAIL  scripts/curate-server.test.mjs > isTrustedOrigin (D-12) > rejects a mismatched Host even with a matching Origin
 AssertionError: expected true to be false // Object.is equality

 FAIL  scripts/curate-server.test.mjs > isTrustedOrigin (D-12) > rejects a malformed Origin header rather than throwing
 AssertionError: expected true to be false // Object.is equality

 FAIL  scripts/curate-server.test.mjs > isTrustedOrigin (D-12) > rejects a Host/Origin pair differing only by port
 AssertionError: expected true to be false // Object.is equality
```

All four "rejects" rows of the six-row Origin matrix went red under the neutered guard (the two "accepts" rows stayed green, as expected — a `return true` stub trivially satisfies them). This is direct evidence the guard, if silently disabled, would open every write endpoint to any tab in the developer's browser — exactly the threat D-12/T-24-CUR-03 exists to close.

**GREEN run** (guard restored, byte-identical diff against the pre-edit backup): `36 tests | 36 passed`.

## Issues Encountered

- **Worktree had no `node_modules` and no `dist/index.js`.** `npm ci --prefer-offline` installed from the committed lockfile (199 packages, no lockfile changes). `dist/index.js` (the `tsc` output the recompute step checks for via `existsSync`) was NOT built in this worktree — not needed for any of this plan's verification, since `POST /__curate/recompute`'s 412-precondition path and the `compute-best-efforts`-before-`compute-dashboard-index` ordering were both verified via source-text assertions and the module's exported pure functions, not a live end-to-end server run. `dist/widgets` was already present from a prior wave's build and was left untouched (no tracked changes; `git status --porcelain data/ dist/` returned empty throughout).
- **The plan's own Task 2 `<verify>` snippet uses `require('fs')` inside an ESM `--input-type=module` context**, which throws `ReferenceError: require is not defined` as written. Adapted the verification command to `import { readFileSync } from 'node:fs'` (identical assertions, same result) rather than reproducing the plan's literal command verbatim. Not a source-code deviation — only the ad-hoc shell verification command run during this session was adjusted; nothing in `scripts/curate-server.mjs` or its test file uses `require`.
- **Pre-existing worktree environment gap (not caused by this plan, not re-logged per instruction):** `npm test` (no path filter) reports 5 failing test files (`trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`, and one sibling) — all `ENOENT` on gitignored generated `data/stats/*.json` this worktree checkout never produced. None of the 5 touch any file this plan modifies. 1393/1398 individual assertions passed (5 skipped, matching the pre-existing gap), including this plan's own 36 cases.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `scripts/curate-server.mjs` now exports the full write-path surface (`applyUpsert`, `applyRemove`, `isTrustedOrigin`, `isValidCurateActivityId`, `normalizeReason`, `writeAtomic`, `EXCLUSIONS_PATH`, `PUBLISH_EXCLUSIONS_PATH`) plan 24-07's overlay UI work needs to call these routes from the browser.
- `serveCurateRoute` is now `async`, and `createServer`'s call site wraps it in `.catch()` — any future new `/__curate/*` route (plan 24-07's overlay bundling changes, or plan 24-08's checks) can follow the same `async function handleX(req, res, ...)` shape already established by `handleExclusionWrite`/`handleRecompute`.
- Blocker/concern for the orchestrator: this worktree's `dist/index.js` was never built (only `dist/widgets` was, from a prior wave). Any later plan that needs to actually exercise `POST /__curate/recompute` end-to-end (rather than via its pure/source-text verification, as this plan did) will need `npm run build` first. Not a defect of this plan — the 412 precondition path exists precisely to handle that state gracefully at runtime.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-08-27*

## Self-Check: PASSED

All modified files verified present (`scripts/curate-server.mjs`, `scripts/curate-server.test.mjs`,
`.planning/phases/24-local-curation-mode/24-06-SUMMARY.md`) and all three task commit hashes
(`3cc70ba`, `1581887`, `b1a0ba9`) confirmed present in `git log`.
