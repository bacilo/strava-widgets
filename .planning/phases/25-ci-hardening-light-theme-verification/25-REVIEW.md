---
phase: 25-ci-hardening-light-theme-verification
reviewed: 2026-09-04T18:31:18Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - scripts/first-paint-capture.mjs
  - scripts/lib/curation-guard.mjs
  - scripts/lib/curation-guard.test.mjs
  - scripts/verify-dashboard-publish.mjs
  - src/analytics/dashboard-index.types.ts
  - src/analytics/gear-aggregate-logic.test.ts
  - src/analytics/gear-aggregate-logic.ts
  - src/compute-all-stats-steps.test.ts
  - src/compute-all-stats-steps.ts
  - src/dashboard/theme-bootstrap-parity.test.ts
  - src/index.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-09-04T18:31:18Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

`src/compute-all-stats-steps.ts` and its test file implement the D-01/D-02/D-03
walker correctly: mandatory-step rethrow, tolerated-step warn-and-continue
under `--ci`, and fail-fast-by-default without the flag are all present and
covered by targeted unit tests (verified by tracing `runComputeAllStatsSteps`
against `src/index.ts:computeAllStatsCommand` and `daily-refresh.yml`'s single
collapsed step — no step failure is silently swallowed anywhere in that
chain). `scripts/lib/curation-guard.mjs` is unusually well-hardened (WR-14/
WR-19 non-regular-file and EACCES handling, ordering of the `.json` exemption
after the `isFile()` gate) and its test suite plants real fixtures rather than
asserting on mocks; I did not find defects there. `gear-aggregate-logic.ts`'s
null/undefined/empty-string/non-string `gearName` handling is exercised by its
test file for every combination and held up under manual tracing (no
division-by-zero in the HR weighting, no `NaN`/`Infinity` pace for a
zero-distance row).

The one **critical** finding and three of the four warnings are in
`scripts/first-paint-capture.mjs`. This is disclosed as instrumentation, not
shipped product code, but the review brief specifically asked me to check
resource cleanup on error paths (Chrome child process, temp user-data-dir,
WebSocket) — I found two independently reproducible ways the harness crashes
via an *unhandled* exception/rejection (verified against this repo's own
Node v25.2.1) that bypass the script's `try/finally` entirely, leaking the
live Chrome process and/or the temp profile directory instead of hitting the
FATAL-message-and-cleanup path the script is designed around.

## Critical Issues

### CR-01: Unhandled promise rejection in the screencast frame handler crashes the harness and skips all cleanup (Chrome process + temp dir leak)

**File:** `scripts/first-paint-capture.mjs:303-314` (and the identical pattern at `396-417` for `runThrottled`)

**Issue:** `CdpClient._onMessage` (lines 200-218) dispatches CDP events to
listeners with `for (const fn of listeners) fn(msg.params)` — it does not
`await` the listener and does not attach a `.catch()`. Both `runScreencast`
and `runThrottled` register an `async` listener for `Page.screencastFrame`
that itself `await`s `client.send('Page.screencastFrameAck', ...)` (line 313
/ 416). `CdpClient.send` (lines 220-226) rejects its returned promise if
`this.ws.send(...)` throws synchronously — which happens whenever the socket
is no longer open (exactly the "renderer-process swap... detaches the CDP
session" scenario the file's own comment at lines 364-370 already documents
and explicitly guards against with a `try/catch` in `runScreenshotBurst`, but
does *not* guard against here).

When that rejection fires with nothing awaiting or catching it, it is an
**unhandled promise rejection**. Verified against this repo's actual Node
version that this terminates the process immediately rather than merely
logging a warning:
```
$ node -e "async function f(){throw new Error('boom')} f(); setTimeout(()=>console.log('still alive'),200)"
Error: boom
    at f ([eval]:2:28)
Node.js v25.2.1
```
Because this termination happens outside the promise chain of `main()`'s
`try { ... } finally { ... }` block, `main`'s `finally` (lines 567-589) never
runs: `chromeProcess.kill('SIGKILL')` is never called (a real, visible Chrome
window per the file's own docstring is left running) and `rmSync(userDataDir, ...)`
is never called (the mkdtemp'd profile directory under the OS temp dir is
left on disk). This is precisely the failure mode the review brief asked to
check for, and it reproduces on the same class of event (CDP session detach)
the author already anticipated and handled for the sibling mechanism.

**Fix:** Never let a listener's promise go unattended in `_onMessage`, and/or
guard the ack call itself:
```javascript
_onMessage(event) {
  ...
  } else if (msg.method) {
    const listeners = this.eventListeners.get(msg.method);
    if (listeners) {
      for (const fn of listeners) {
        Promise.resolve(fn(msg.params)).catch((err) => {
          console.error(`WARNING: CDP event listener for ${msg.method} failed: ${err.message}`);
        });
      }
    }
  }
}
```
and/or wrap the ack itself:
```javascript
client.on('Page.screencastFrame', async (params) => {
  ...
  try {
    await client.send('Page.screencastFrameAck', { sessionId: params.sessionId });
  } catch (err) {
    // session likely detached — stop trying to ack further frames, same
    // graceful-degradation shape runScreenshotBurst already uses.
  }
});
```

## Warnings

### WR-01: `CdpClient.send` has no timeout and the WebSocket has no `error`/`close` listener — a dead socket hangs the harness forever

**File:** `scripts/first-paint-capture.mjs:191-232, 464`

**Issue:** `CdpClient.send` stores `{ resolve, reject }` in `this.pending` and
only settles it from `_onMessage` when a matching response arrives. There is
no `setTimeout` rejecting stale entries, and no listener is ever registered
for the WebSocket's `error` or `close` events (confirmed: `grep` for
`addEventListener`/`.on(` in this file shows only a `message` listener
registered once, at line 197). If Chrome hangs, is killed externally, or the
socket drops without the specific synchronous-throw path CR-01 describes
(e.g. the connection closes cleanly server-side and the OS TCP stack doesn't
surface it as an immediate `send()` throw), every `await client.send(...)`
call currently in flight — including the ones inside `main`'s own `try`
block, e.g. `Runtime.evaluate` at line 491 — awaits a promise that will never
resolve or reject. `main()` never reaches its `finally` block in this case
either, so the same Chrome-process/temp-dir leak as CR-01 applies.

**Fix:** Add a per-call timeout in `send()`, and reject all pending calls on
socket close/error:
```javascript
ws.addEventListener('close', () => this._rejectAllPending(new Error('WebSocket closed')));
ws.addEventListener('error', (e) => this._rejectAllPending(new Error(`WebSocket error: ${e.message}`)));
```
plus a `Promise.race([...], timeoutPromise)` (or equivalent) in `send()`.

### WR-02: Spawning Chrome with no `error` listener crashes the process on `ENOENT` instead of hitting the script's own FATAL path

**File:** `scripts/first-paint-capture.mjs:236-249, 452-453`

**Issue:** `launchChrome` calls `spawn(CHROME_BIN, [...])` and returns the
child immediately; no `error` listener is attached to the returned
`ChildProcess`. `CHROME_BIN` is a hardcoded absolute path
(`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, line 41). If
that path is wrong (Chrome not installed, a Chrome update that changes the
bundle layout, a different machine), `spawn` emits an `error` event
asynchronously on the next tick. Verified this crashes the whole process
because no listener is registered:
```
$ node -e "const {spawn}=require('child_process'); spawn('/definitely/not/a/real/binary',['x']); setTimeout(()=>console.log('still alive after 200ms'),200)"
node:events:486
      throw er; // Unhandled 'error' event
Error: spawn /definitely/not/a/real/binary ENOENT
Node.js v25.2.1
```
This happens *after* `chromeProcess = await launchChrome(...)` has already
returned successfully (spawn errors surface asynchronously), so it occurs
outside of `main`'s synchronous call stack — the crash is a top-level
uncaught exception, not something `main`'s `try/catch/finally` intercepts.
The `mkdtempSync`'d `userDataDir` (already created before `launchChrome` is
called, line 444) is never removed, and the user sees a raw Node stack trace
instead of the intended `FATAL: could not discover a page target: ...`
message.

**Fix:**
```javascript
async function launchChrome(port, userDataDir) {
  const child = spawn(CHROME_BIN, [...], { stdio: 'ignore', detached: false });
  child.on('error', (err) => {
    console.error(`FATAL: failed to launch Chrome at ${CHROME_BIN}: ${err.message}`);
  });
  return child;
}
```
(and propagate/await that failure rather than only logging it, so `main`'s
existing cleanup path still runs).

### WR-03: `verify-dashboard-publish.mjs`'s ~35 unguarded `JSON.parse` calls abort the entire gate on the first malformed body, defeating the accumulate-and-report design the file otherwise uses

**File:** `scripts/verify-dashboard-publish.mjs` (e.g. lines 224, 251, 261, 322, 344, 365, 404, 428, 452, 484, 509, 592, and every other `JSON.parse(...Body)` call in the file)

**Issue:** The script's whole design is "accumulate every failure via `fail()`
and print one summary at the end" (`ok`/`fail` counters, `finally { server.close(); }`,
a final `${checks} check(s) passed, ${failures} failure(s)` line). Every
`JSON.parse` call in the file, however, is unguarded — including the ~175
lines of new by-name checks this phase added for
`training-load.json`/`age-grading.json`/`gear-aggregate.json`/
`weekly-distance.json`/`monthly-stats.json`/`yearly-stats.json`/
`year-over-year.json`/`best-efforts.json`/per-activity shards. The file's own
comment block at lines 336-341 states the explicit goal: "Each check below is
200 + JSON.parse + one structural invariant that a truncated or empty
document would fail." But a **truncated** file is exactly the input most
likely to make `JSON.parse` throw a `SyntaxError` rather than parse into
valid-but-wrong-shaped JSON. When that happens, the throw is not caught
anywhere locally; it propagates out of `main()` to the top-level
`main().catch((error) => { console.error('verify-dashboard-publish failed:', error); process.exit(1); })`
at the bottom of the file. The gate still correctly fails the build (exit
code 1 is preserved), but: (a) every check after the failure point never
runs, so a single truncated file can hide unrelated real regressions in that
run; (b) the diagnostic is a raw `SyntaxError` and stack trace instead of the
specific, actionable `fail('/path/to/file.json ...')` message the rest of the
file is built to produce; (c) the `${checks} check(s) passed, ${failures} failure(s)`
summary line is never printed.

**Fix:** Wrap each parse (or factor a `parseJsonBody(label, body)` helper
that calls `fail()` and returns `null` on a catch) so a malformed body is
just another `fail()` and the walk continues:
```javascript
function parseJsonOrFail(label, body) {
  try {
    return JSON.parse(body);
  } catch (error) {
    fail(`${label} returned 200 but is not valid JSON: ${error.message}`);
    return null;
  }
}
```

### WR-04: `computeAllStatsCommand` prints "All statistics generated successfully!" even when steps degraded, immediately before the DEGRADED STEPS block that contradicts it

**File:** `src/index.ts:314-322`

**Issue:**
```javascript
const degraded = await runComputeAllStatsSteps(announcedSteps, { continueOnError });

console.log('\nAll statistics generated successfully!');

if (degraded.length > 0) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`DEGRADED STEPS (${degraded.length}) — tolerated failures during this run:`);
  ...
}
```
The success banner is printed unconditionally, before checking whether any
tolerated step actually failed. This is new in this phase (confirmed via
`git show 3bdc6856` — the prior implementation had no degraded-step concept
at all, so "generated successfully" was always literally true when reached).
Under `--ci` with one or more tolerated failures, the log now reads "All
statistics generated successfully!" immediately followed by a block
enumerating failures — a real internal contradiction. This matters
operationally: a log-scraping alert or a truncated Slack/Actions-summary
excerpt that greps for "successfully" (or only shows the first few lines of
a step's output) would report green for a run that just told you, four lines
later, that up to six data pipelines are stale.

**Fix:** Condition the message on `degraded.length`:
```javascript
console.log(
  degraded.length > 0
    ? '\nAll statistics generated with some steps degraded (see below).'
    : '\nAll statistics generated successfully!'
);
```

## Info

### IN-01: Redundant dynamic `import('node:fs')` for a function already available from the static import

**File:** `scripts/first-paint-capture.mjs:36, 505`

**Issue:** `node:fs`'s `mkdtempSync, mkdirSync, writeFileSync, rmSync,
existsSync` are statically imported at the top of the file (line 36). Deep
inside `main()`, the script does
`const { readFileSync: readFileSyncFn } = await import('node:fs');` (line
505) to get one more named export from the same built-in module that is
already imported. There is no lazy-loading benefit for a Node built-in, and
the aliasing (`readFileSyncFn`) suggests this was worked around rather than
intended.

**Fix:** Add `readFileSync` to the existing static import and drop the
dynamic one:
```javascript
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
```

### IN-02: `navigatedAt` in `runScreenshotBurst` is written but never read

**File:** `scripts/first-paint-capture.mjs:357-360`

**Issue:** `const navigatedAt = { requestMs: null, respondedMs: null };` is
declared and populated from a `Page.frameNavigated` listener
(`navigatedAt.requestMs = Date.now()`), but `navigatedAt` is never read
anywhere else in the function or returned in `runScreenshotBurst`'s result
(`{ frames, captureErrors }`). It has no effect on the report's timing
calculations, which instead use each frame's own `responseMs`. This is dead
state left over from what looks like an intended (but not wired up)
navigation-relative timing calculation for this mechanism.

**Fix:** Either remove `navigatedAt` and its listener, or wire it into the
returned result if the navigation-relative timing was actually intended for
this mechanism.

---

_Reviewed: 2026-09-04T18:31:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
