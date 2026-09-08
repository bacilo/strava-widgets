---
phase: 16-dashboard-shell-data-contract
plan: 05
subsystem: dashboard-data
tags: [typescript, vitest, tdd, fetch-client, data-contract]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 03)
    provides: DashboardIndexDocument/DashboardIndexRow contract, isValidActivityId chokepoint from router.ts
  - phase: 14 (stream ingestion foundation)
    provides: CanonicalStream shape (data/streams/<id>.json)
provides:
  - createIndexClient / IndexClient — fetch-once, memoized access to data/dashboard/index.json with O(1) row lookup
  - createDetailClient / DetailClient / InvalidActivityIdError / ActivityDetail — lazy per-activity detail + stream fetching with id-validation chokepoint enforcement
affects: [16-06, 16-07, 16-08, 16-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-flight promise memoization (not result memoization) so concurrent callers before resolution still collapse to one network request"
    - "Reject-then-evict: a failed load clears its memoized promise/map entry before rethrowing, so Retry always issues a genuine new request"
    - "Sequential (not Promise.all) fetch ordering when a later fetch depends on the semantic validity of an earlier one (detail-client: activity before stream)"

key-files:
  created:
    - src/dashboard/data/index-client.ts
    - src/dashboard/data/index-client.test.ts
    - src/dashboard/data/detail-client.ts
    - src/dashboard/data/detail-client.test.ts
  modified: []

key-decisions:
  - "InvalidActivityIdError validation happens as the literal first statement inside loadDetail, before any string interpolation — matches T-16-DC-01's mitigation plan exactly and is asserted by dedicated zero-fetch-call tests per rejected id shape"
  - "detail-client fetches the activity file before the stream file sequentially, not via Promise.all, because a missing/broken activity should not leave an orphaned ~76KB stream request in flight"
  - "Both clients resolve fetchImpl lazily inside the call (options.fetchImpl ?? globalThis.fetch), never at module scope, so importing either module in vitest's node environment never touches a global"

patterns-established:
  - "Pattern: fakeFetch(responses) test helper duplicated locally per test file rather than extracted to a shared test-utils module (repo precedent: no test-utils directory exists, and the plan explicitly scoped extraction as out of scope)"

requirements-completed: [DASH-02]

duration: ~18min
completed: 2026-08-10
---

# Phase 16 Plan 05: Dashboard Data Clients (Index + Detail) Summary

**Two TDD-built fetch clients — a fetch-once memoized index client and a lazy per-activity detail client with a hard id-validation chokepoint — that together form the mechanical core of the D-07 proving slice.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2, each run as a full RED -> GREEN TDD cycle
- **Files modified:** 4 created (616 total lines: 216 implementation, 400 tests)

## Accomplishments

- Built `createIndexClient` (`src/dashboard/data/index-client.ts`): memoizes the in-flight fetch promise (not the resolved value) so overlapping view mounts during bootstrap still collapse to exactly one request for the ~300-500KB manifest; O(1) `getRow(id)` via an internal `Map` built once on load; failed loads clear the memoized promise so a subsequent call retries; a `schemaVersion` mismatch warns once via `console.warn` rather than throwing, so a stale published index still renders.
- Built `createDetailClient` (`src/dashboard/data/detail-client.ts`): `loadDetail(id)` calls the shared `isValidActivityId` chokepoint from `router.ts` as its literal first statement — before any URL string is built — rejecting five adversarial id shapes (`'abc'`, `'../../secrets'`, `'12%2F..'`, `''`, `'<script>'`) with `InvalidActivityIdError` and zero recorded fetch calls; fetches the activity file before the stream file sequentially so a broken activity never orphans a stream request; a missing stream file resolves `stream: null` instead of failing the whole load (STREAM-03 degraded state); per-id in-flight promise map gives correct 2-fetches-not-4 concurrent-same-id behavior and full cross-id isolation; rejected promises are evicted from the map so the UI-SPEC Retry action gets a genuine new request.
- Both clients reuse the exact widget error-message format (`Failed to fetch data: ${status} ${statusText}`) from `widget-base.ts`'s `fetchData<T>`, so dashboard and widget failures read identically.

## Task Commits

Each task was executed as a full TDD RED -> GREEN cycle, committed atomically:

1. **Task 1: Build the fetch-once index client** — `0bdce3d` (test, RED) -> `b1e19db` (feat, GREEN)
2. **Task 2: Build the lazy detail client with id validation and missing-stream tolerance** — `1130c81` (test, RED) -> `060362b` (feat, GREEN)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree execution — no plan-metadata commit made here).

_Note: Neither task needed a REFACTOR commit — both implementations were clean on first GREEN pass._

## Files Created/Modified

- `src/dashboard/data/index-client.ts` — `FetchLike`, `IndexClientOptions`, `IndexClient`, `createIndexClient` (fetch-once memoized index access, O(1) row lookup)
- `src/dashboard/data/index-client.test.ts` — 12 tests covering construction, fetch-once/caching (sequential + concurrent), retry-after-failure, row access, `reset()`, and schema-mismatch warning
- `src/dashboard/data/detail-client.ts` — `InvalidActivityIdError`, `ActivityDetail`, `DetailClientOptions`, `DetailClient`, `createDetailClient` (lazy per-id detail + stream fetching with id validation)
- `src/dashboard/data/detail-client.test.ts` — 15 tests covering construction, fetch order/shape, missing-stream tolerance, activity-fetch failure, five invalid-id rejection cases, per-id memoization, cross-id isolation, retry, and `clear()`

## Decisions Made

- Matched the plan's exact `FetchLike` type shape (`(url: string) => Promise<{ ok, status, statusText, json() }>`) so both test files can supply a minimal fake without constructing real `Response` objects — no `node-fetch` or `undici` dependency introduced.
- `detail-client.ts` imports `FetchLike` from `index-client.ts` rather than redeclaring it, per the plan's explicit instruction to "reuse its `FetchLike` type... rather than reinventing them."
- Kept `fakeFetch` duplicated locally in each `.test.ts` file (not extracted to a shared helper) per the plan's explicit scoping — this repo has no test-utils directory and adding one was called out as out of scope.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<behavior>` and `<acceptance_criteria>` blocks on the first implementation pass; no auto-fixes, no architectural questions, no scope additions.

## Verification Results

- `npx vitest run src/dashboard/data/index-client.test.ts --reporter=dot` — 12/12 passed
- `npx vitest run src/dashboard/data --reporter=dot` — 27/27 passed (both client test files)
- `npx vitest run src/dashboard --reporter=dot` — 81/81 passed (router, theme, index-client, detail-client together)
- `npm test` (full repo suite) — 296/296 passed, 16 test files
- `npx tsc --noEmit` — exits 0, no errors
- `grep -c 'globalThis.fetch\|window.fetch' src/dashboard/data/index-client.ts` — 1 (referenced only inside the function body, never at module top level)
- `grep -n "isValidActivityId" src/dashboard/data/detail-client.ts` — matches (chokepoint delegated, not duplicated)
- `grep -c '\^\\d' src/dashboard/data/detail-client.ts` — 0 (no local regex re-implementation)
- `grep -c 'innerHTML' src/dashboard/data/detail-client.ts` — 0

## Threat Model Coverage

- **T-16-DC-01** (Tampering — route param -> fetch URL): mitigated. `isValidActivityId` runs as the first statement in `loadDetail`, before any interpolation; five adversarial id shapes are tested and each asserts `calls.length === 0`.
- **T-16-DC-02** (DoS — repeated index fetches per navigation): mitigated. In-flight promise memoization in `index-client.ts`, verified by a concurrent-calls test.
- **T-16-DC-03** (DoS — poisoned failure cache blocking Retry): mitigated in both clients. Index client clears its memoized promise on rejection; detail client evicts the per-id map entry on rejection. Both are covered by "retry after failure" tests.
- **T-16-DC-04** (Information Disclosure — same-origin HTTPS static fetches): accepted per threat model, no code change needed here.
- **T-16-DC-05** (Tampering — parsed JSON handed to renderers unvalidated): transferred to plans 06/07's render boundary per threat model; out of scope for this plan (these clients return typed data, they do not render it).

## Issues Encountered

Worktree HEAD had not been fast-forwarded to the plan's declared base commit (`bb144213eaddfdcb540c52882d7e35fef42ceccc`) when the agent started — `git merge-base HEAD <base>` returned an older commit (`4967a8b`) instead. Resolved with `git reset --hard bb144213eaddfdcb540c52882d7e35fef42ceccc` per the worktree branch-check protocol, before any file changes were made. No impact on plan execution (same pattern noted in plan 03's summary).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plans 06/07 (stub views + view registry wiring) can now import `createIndexClient`/`createDetailClient` directly and wire the D-07 proving slice: a real index row -> a real lazy detail fetch on activity open.
- The Retry action specified in the UI-SPEC has a working data-layer contract to bind to on both clients (failed loads are always retryable).
- No blockers.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created files verified present on disk (`src/dashboard/data/index-client.ts`, `index-client.test.ts`, `detail-client.ts`, `detail-client.test.ts`); all task commits (`0bdce3d`, `b1e19db`, `1130c81`, `060362b`) verified present in git log.
