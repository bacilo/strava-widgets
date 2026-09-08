---
phase: 24-local-curation-mode
plan: 12
subsystem: curate-server
tags: [security, dos, csrf, dns-rebinding, tdd, gap-closure]
dependency-graph:
  requires: ["24-10"]
  provides: ["safeResolve-malformed-encoding-rejection", "createServer-listener-symmetry", "static-route-origin-host-gate"]
  affects: ["scripts/curate-server.mjs", "scripts/curate-server.test.mjs"]
tech-stack:
  added: []
  patterns: ["try/catch around decodeURIComponent", "extracted 500-responder shared across listener branches", "isTrustedOrigin gate reused on a third route", "real-socket describe.skipIf liveness suite over an ephemeral port"]
key-files:
  created: []
  modified:
    - scripts/curate-server.mjs
    - scripts/curate-server.test.mjs
decisions:
  - "Extended D-12's Origin/Host gate to the static route, not just the two write routes — DNS rebinding is a Host-header attack that is route-agnostic, and 24-VERIFICATION.md recorded this key link as NOT GATED (position_on_scope in the plan)."
  - "/__curate/health and /__curate/overlay.js remain deliberately ungated GETs — local-only, non-secret, no write, and not in 24-VERIFICATION.md's missing list. Recorded as an accepted residual (T-24-12-07) rather than silently widened."
metrics:
  duration: "~55min"
  completed: "2026-09-02"
---

# Phase 24 Plan 12: Static-route liveness fix and Origin/Host gate extension Summary

Closed GAP-24-03 (CR-01): a malformed percent-escape (`GET /%`) previously crashed the whole
curate server process via an unguarded `decodeURIComponent` throw escaping an http request
listener as an uncaught exception, and the static route carried no D-12 Origin/Host gate at all
— the one route `24-VERIFICATION.md` recorded as NOT GATED.

## What Was Built

`safeResolve` now wraps its `decodeURIComponent` call in try/catch, returning `null` on a
malformed percent-escape exactly like it already does for a path traversal. `createServer`'s
listener body is now try/catch-wrapped around both branches, routing to a new extracted
`respond500(res, error)` helper shared by the curate branch's existing `.catch()` and the new
catch — so no future synchronous throw anywhere in the listener can terminate the process.
`serveStaticRoute` now calls `isTrustedOrigin(req, EXPECTED_HOST)` as its first statement,
returning `403` with a body naming the expected origin (`http://127.0.0.1:4173`, built from
`CURATE_HOST`/`CURATE_PORT`, never hardcoded) on a cross-origin or mismatched-Host request. All
four changes are pinned by tests observed RED before the fix and GREEN after (D-11).

`createServer` also gained an `export` (comment-only, no behaviour change) so the new real-socket
liveness suite can exercise the shipped listener over an ephemeral port rather than asserting
about source text.

## D-11: RED Evidence (Task 1, against the unfixed source)

`npx vitest run scripts/curate-server.test.mjs` exited non-zero: **7 failed / 38 passed (45
total)**, plus one Unhandled Error (an uncaught `URIError` from the live server itself). Verbatim
output:

```
 RUN  v4.0.18 /Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-adc353115e8f3e511

 ❯ scripts/curate-server.test.mjs (45 tests | 7 failed) 15046ms
     ...
     × rejects /strava-widgets/% (a malformed percent-escape), exactly like a traversal 5ms
     × rejects /strava-widgets/%zz (a malformed percent-escape), exactly like a traversal 0ms
     × rejects /strava-widgets/%e0%a4%a (a malformed percent-escape), exactly like a traversal 0ms
     ...
     × case 1: GET /% with a matching Host responds 4xx and does not kill the process 5005ms
     ✓ case 2: immediately after, GET /strava-widgets/ still responds 200 with the overlay tag — the liveness proof 9ms
     × case 3: GET /strava-widgets/ with a cross-origin Origin responds 403 4ms
     × case 4: GET /strava-widgets/ with a mismatched Host responds 403 3ms
     ✓ case 5 (control): GET /strava-widgets/ with a matching Host and no Origin responds 200 — an ordinary navigation is not broken by the new gate (D-02/OD-4) 1ms
     ...
     × createServer's listener body wraps both branches identically — it contains both 'try' and 'respond500' 4ms

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  scripts/curate-server.test.mjs > static route liveness & Origin/Host gate (D-11, D-12, GAP-24-03)
Error: Hook timed out in 10000ms.
 ❯ scripts/curate-server.test.mjs:352:13
    352|     afterAll(() => {
       |             ^
    353|       return new Promise((settle) => {
    354|         server.close(() => settle());

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  scripts/curate-server.test.mjs > safeResolve > rejects /strava-widgets/% (a malformed percent-escape), exactly like a traversal
URIError: URI malformed
 ❯ safeResolve scripts/curate-server.mjs:128:19
    128|   const decoded = decodeURIComponent(urlPath.split('?')[0]);
       |                   ^
 ❯ scripts/curate-server.test.mjs:139:23

[... same URIError shape repeats for %zz and %e0%a4%a, lines 143 and 147 ...]

 FAIL  scripts/curate-server.test.mjs > static route liveness & Origin/Host gate (D-11, D-12, GAP-24-03) > case 1: GET /% with a matching Host responds 4xx and does not kill the process
Error: Test timed out in 5000ms.
 ❯ scripts/curate-server.test.mjs:384:7
    385|       const { status } = await request('/%');
    386|       expect(status).toBeGreaterThanOrEqual(400);

 FAIL  scripts/curate-server.test.mjs > static route liveness & Origin/Host gate (D-11, D-12, GAP-24-03) > case 3: GET /strava-widgets/ with a cross-origin Origin responds 403
AssertionError: expected 200 to be 403 // Object.is equality
- 403
+ 200
 ❯ scripts/curate-server.test.mjs:398:22

 FAIL  scripts/curate-server.test.mjs > static route liveness & Origin/Host gate (D-11, D-12, GAP-24-03) > case 4: GET /strava-widgets/ with a mismatched Host responds 403
AssertionError: expected 200 to be 403 // Object.is equality
- 403
+ 200
 ❯ scripts/curate-server.test.mjs:403:22

 FAIL  scripts/curate-server.test.mjs > listener symmetry (D-11, GAP-24-03) > createServer's listener body wraps both branches identically — it contains both 'try' and 'respond500'
AssertionError: expected 'function createServer() {\n  return h…' to contain 'try'
- try
+ function createServer() {
+   return http.createServer((req, res) => {
+     if (isCurateRoute(req.url ?? '/')) {
+       serveCurateRoute(req, res).catch((error) => {
+         if (!res.headersSent) {
+           res.writeHead(500, { 'Content-Type': 'text/plain' });
+         }
+         res.end(`Internal Server Error: ${error.message}`);
+       });
+       return;
+     }
+     serveStaticRoute(req, res);
+   });
 ❯ scripts/curate-server.test.mjs:444:18

⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯

Vitest caught 1 unhandled error during the test run.

⎯⎯⎯⎯⎯ Uncaught Exception ⎯⎯⎯⎯⎯
URIError: URI malformed
 ❯ safeResolve scripts/curate-server.mjs:128:19
 ❯ serveStaticRoute scripts/curate-server.mjs:611:20
 ❯ Server.<anonymous> scripts/curate-server.mjs:650:5
 ❯ Server.emit node:events:508:28
 ❯ parserOnIncoming node:_http_server:1212:12
 ❯ HTTPParser.parserOnHeadersComplete node:_http_common:123:17

The latest test that might've caused the error is "case 1: GET /% with a matching Host responds 4xx and does not kill the process".

 Test Files  1 failed (1)
      Tests  7 failed | 38 passed (45)
     Errors  1 error
```

Both acceptable RED shapes from the plan's expected list occurred simultaneously: the three
`safeResolve` malformed cases failed with a thrown `URIError`, and the liveness block's case 1
timed out (rather than asserting a wrong status) because the server's request handler crashed
mid-request with no response ever written — the exact failure mode CR-01 describes, just
manifesting as a hung client request instead of a killed vitest worker, because Vitest's own
process-isolation catches the otherwise-fatal uncaught exception rather than letting it exit
the worker. That IS the bug: an uncaught `URIError` inside a live http server's request
listener, exactly as `24-REVIEW.md`'s CR-01 reproduced independently as `UNCAUGHT -> URIError
URI malformed`. The listener-symmetry case failed outright and unambiguously: `respond500` did
not exist anywhere in the file and the listener body had no `try` (confirmed via
`grep -c 'respond500' scripts/curate-server.mjs` → `0` at RED time).

The liveness suite ran (not skipped) in this environment because `dist/widgets/index.html` was
built locally via `npm run build-widgets` before Task 1's RED run — that build output is
gitignored and not part of this plan's committed diff (`git diff --name-only` against the wave
base lists only the two `scripts/curate-server.*` files).

## D-11: GREEN Evidence (Task 2 fix, Task 3 re-confirmation)

After Task 2's fix, the full suite is green:

```
 RUN  v4.0.18 /Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-adc353115e8f3e511

 ✓ scripts/curate-server.test.mjs (45 tests) 20ms

 Test Files  1 passed (1)
      Tests  45 passed (45)
   Start at  11:22:13
   Duration  156ms (transform 27ms, setup 0ms, import 54ms, tests 20ms, environment 0ms)
```

Task 1's RED line for the listener-symmetry case:
```
 × createServer's listener body wraps both branches identically — it contains both 'try' and 'respond500' 4ms
AssertionError: expected 'function createServer() {\n  return h…' to contain 'try'
```

Task 3's re-run in isolation confirms the GREEN transition:
```
$ npx vitest run scripts/curate-server.test.mjs -t 'listener symmetry'
 ✓ scripts/curate-server.test.mjs (45 tests | 44 skipped) 1ms
 Test Files  1 passed (1)
      Tests  1 passed | 44 skipped (45)
```

Point checks confirming the fix's exact contract:
- `node -e "...safeResolve('/strava-widgets/%')..."` → `null`
- `node -e "...safeResolve('/strava-widgets/%zz')..."` → `null`
- `node -e "...safeResolve('/strava-widgets/').endsWith('dist/widgets/index.html')..."` → `true` (happy path unchanged)
- `grep -c "function respond500" scripts/curate-server.mjs` → `1`
- `grep -n "isTrustedOrigin(req, EXPECTED_HOST)" scripts/curate-server.mjs` → exactly 3 lines (`handleExclusionWrite`, `handleRecompute`, `serveStaticRoute`)
- `awk '/^function serveStaticRoute/,/^}/' scripts/curate-server.mjs | grep -c "isTrustedOrigin"` → `1`

## Task 3: Live Smoke Against the Real `npm run curate` Process

Nine steps, run in order against a real background `npm run curate` process (PID 40211, child
node process 40230), not just the in-process test harness:

| # | Command | Expected | Observed |
|---|---------|----------|----------|
| 1 | `npm run curate` (background), wait for banner | banner line present | `curate server running at http://127.0.0.1:4173/strava-widgets/` |
| 2 | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/strava-widgets/` | `200` | **`200`** |
| 3 | `curl -s -o /dev/null -w '%{http_code}' --path-as-is 'http://127.0.0.1:4173/%'` | 4xx | **`403`** |
| 4 | Repeat step 2 (liveness proof) | `200` | **`200`** — process confirmed still running (`ps -p 40211`, `pgrep -f curate-server.mjs` → PID 40230 present) |
| 5 | `curl ... -H 'Origin: http://evil.example' http://127.0.0.1:4173/strava-widgets/` | `403` | **`403`** |
| 6 | `curl ... -H 'Host: evil.example' http://127.0.0.1:4173/strava-widgets/` | `403` | **`403`** |
| 7 | `curl -X PUT ... -H 'Origin: http://evil.example' http://127.0.0.1:4173/__curate/exclusions/4556693525` | `403` | **`403`** |
| 7 | `curl -X PUT ... -H 'Host: evil.example' http://127.0.0.1:4173/__curate/exclusions/4556693525` | `403` | **`403`** |
| 8 | `git status --porcelain data/best-effort-exclusions.json` | empty | **empty** — no mutation |
| 9 | Stop background process, confirm port free | port free | `kill 40211`; `pgrep -f curate-server.mjs` → not found; `lsof -i :4173` → `port 4173 is free` |

Steps 2 and 4 both `200` — the developer-facing tool (D-02/OD-4) is unbroken by the new gate.
Step 3 confirms the malformed-path fix over a real socket, immediately followed by step 4's
`200`, which is the liveness proof: before the fix the process would have been dead by this
point. Steps 5-7 confirm the gate now covers the static route as well as both pre-existing write
routes, directly comparable to `24-VALIDATION.md`'s prior R14/R23 write-route proofs. Step 8
confirms nothing in this smoke mutated the archive.

## Position on Scope (restated, per the plan's `<output>` requirement)

The static route was deliberately gated with `isTrustedOrigin` (T2d), because DNS rebinding is a
Host-header attack that is route-agnostic — a rebound hostname reaches the static route exactly
as easily as a write route — and `24-VERIFICATION.md` recorded this exact key link
(`any browser tab → curate-server.mjs static route → safeResolve`) as **NOT GATED**, phrasing its
failed truth 5 as "D-12's Origin/Host gate protects the curate server ... from any other browser
tab, including hostile pages." A liveness-only fix would have left that key link unwired.

`/__curate/health` and `/__curate/overlay.js` were deliberately left ungated GETs. They serve a
local-only, non-secret script to a local-only server and carry no write; gating them is not in
`24-VERIFICATION.md`'s `missing` list. This is recorded as an accepted residual in the threat
model (T-24-12-07) rather than silently widened scope.

## Deviations from Plan

### Auto-fixed / handled inline

**1. [Setup, not a code deviation] Built `dist/widgets` locally so the liveness suite would run rather than skip.**
- **Found during:** Task 1
- **Issue:** `dist/widgets/index.html` did not exist in this fresh worktree checkout (only
  `dist/widgets/test.html`, the one file `.gitignore` tracks), so the `describe.skipIf` liveness
  block would have been skipped, and Task 3's live smoke (which requires `assertBuilt()` to pass)
  would have been impossible to run.
- **Fix:** ran `npm run build-widgets` (a build step, not a code change) before Task 1's RED
  capture. Output is gitignored (`dist/widgets/*` except `test.html`) and does not appear in
  `git diff --name-only`.
- **Files modified:** none (build output only, gitignored).
- **Commit:** N/A (no tracked-file change).

**2. [Scope boundary, logged not fixed] `npm test` has 7 pre-existing failing files unrelated to this plan.**
- **Found during:** Task 2 verification (`npm test`)
- **Issue:** `records-logic.test.ts` and four `trends-*-logic.test.ts` siblings fail with `ENOENT`
  on gitignored `data/stats/*.json` (never produced in this worktree); a separate
  `verify-dashboard-publish-guard.test.mjs` (4 assertions) fails because its own `main()`
  invocation FATALs on the still-missing `dist/widgets/data/dashboard/index.json`
  (`compute-dashboard-index` output, which needs `dist/index.js` from `npm run build` plus real
  archive data). Neither class is caused by, or touches, `scripts/curate-server.mjs` or
  `scripts/curate-server.test.mjs`.
- **Fix:** not fixed — out of scope per the Scope Boundary rule. Logged in
  `.planning/phases/24-local-curation-mode/deferred-items.md` under a new `## 24-12:` heading,
  matching the same recurring class already logged for plans 24-01 and 24-02.
- **Files modified:** `.planning/phases/24-local-curation-mode/deferred-items.md`.
- **Commit:** `d62789f`.

No Rule 1-4 code deviations were needed — the plan's action items mapped directly onto the
existing source with no unplanned bugs, missing functionality, blockers, or architectural
questions encountered.

## Threat Flags

None. All threat-relevant surface touched by this plan (`T-24-12-01` through `T-24-12-08`) is
already enumerated in the plan's own `<threat_model>` and disposed there.

## Self-Check

- `scripts/curate-server.mjs` — FOUND
- `scripts/curate-server.test.mjs` — FOUND
- `.planning/phases/24-local-curation-mode/deferred-items.md` — FOUND
- Commit `782de8d` (T1, RED) — FOUND
- Commit `65c4467` (T2, fix) — FOUND
- Commit `d62789f` (T3/docs, deferred-items) — FOUND
- `npx vitest run scripts/curate-server.test.mjs` — 45/45 pass, exit 0 — CONFIRMED
- `grep -n "isTrustedOrigin(req, EXPECTED_HOST)" scripts/curate-server.mjs` — 3 lines — CONFIRMED
- `git diff --name-only` (wave base `fff3b38` to `HEAD`, scripts/ only) — exactly
  `scripts/curate-server.mjs`, `scripts/curate-server.test.mjs` — CONFIRMED

## Self-Check: PASSED
