---
phase: 24-local-curation-mode
reviewed: 2026-09-01T20:37:28Z
updated: 2026-09-02T10:57:43Z
depth: standard
diff_base: 38a3c1b
files_reviewed: 20
files_reviewed_list:
  - vitest.config.ts
  - .gitignore
  - package.json
  - scripts/build-widgets.mjs
  - scripts/lib/copy-data-tree.mjs
  - scripts/lib/curation-guard.mjs
  - scripts/lib/curation-guard.test.mjs
  - scripts/curate-server.mjs
  - scripts/curate-server.test.mjs
  - scripts/curate-overlay/index.ts
  - scripts/curate-overlay/exclusion-panel.ts
  - scripts/curate-overlay.test.mjs
  - scripts/verify-dashboard-publish.mjs
  - scripts/verify-dashboard-publish-guard.test.mjs
  - src/dashboard/views/detail.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/views/detail-best-efforts-logic.ts
  - src/dashboard/views/detail-best-efforts-logic.test.ts
  - src/dashboard/curation-seam.test.ts
  - tsconfig.json (read as context for CR-02/WR-10, not changed by the phase)
findings:
  critical: 2
  warning: 18
  info: 16
  total: 36
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-09-01T20:37:28Z
**Depth:** standard
**Files Reviewed:** 20 (base `38a3c1b`..HEAD, all non-`.planning` source changes)
**Status:** issues_found

## Summary

Phase 24 ships a local write server, an injected browser overlay, a two-layer
build/HTTP absence guard, and a live-derivation change to the detail view's
exclusion badge. The parts the phase spent the most words defending — the
`127.0.0.1` bind, the Origin/Host gate, the `applyUpsert`/`applyRemove` purity,
the `distances: null` contract, the path-traversal rejection on the write route
— are genuinely correct, and I could not find a way to write outside
`data/best-effort-exclusions.json` or to get a cross-origin browser tab past
`isTrustedOrigin`. The activity-id validation, the never-`distances: []` untick
rule and `buildBestEffortsPanelRows`'s `null`-means-UNKNOWN fallback all hold
under adversarial reading.

The defects are in the places the phase did **not** write comments about.

Two are Critical. First, `safeResolve` calls `decodeURIComponent` outside any
try/catch on a code path (`serveStaticRoute`) that is itself called synchronously
from the request listener with no `.catch()` — a single `GET /%` kills the
curate server process. I reproduced the crash in this environment (Node exits on
an uncaught `URIError`); it is reachable from any page in the developer's browser
because the static route has no Host/Origin gate at all. Second, the
curation-artifact guard's `SCANNED_EXTENSIONS` list (`.js`/`.html`/`.css`/`.map`)
does not include `.ts`, and `dist/widgets` **today** publishes 22 `.d.ts` files —
so the phase's central claim (criterion 3, D-10, "provably absent") is not
actually proven for the file extensions the publish tree demonstrably contains.
Both D-10 layers miss that shape: the build guard does not read `.ts`, and the
HTTP guard only probes three hard-coded URL literals.

The warnings cluster around the write loop's failure paths, which are
consistently the least-exercised code in the phase: the 413 response is never
delivered to the client (verified), a failed recompute is reported with HTTP 200
and an in-band sentinel nobody checks, a mirror failure leaves the repo file
already mutated while the UI reports an error, and the overlay renders in the
EXCLUDED shape (live "Remove exclusion" button) before — and permanently after a
failed — `loadExclusionState`. None of `handleExclusionWrite`, `readJsonBody`,
`persistExclusions`, `mirrorExclusions` or `handleRecompute` is exported or
tested; `curate-server.test.mjs`'s 30 assertions all target pure string helpers.

One decision-level correctness gap: GAP-24-01 was closed for the panel rows but
not for the PR badges rendered ten lines above them in the same function, so
after a Save the detail view can simultaneously show `PR — 5K` in the header and
`Excluded — {reason}` in the panel. That disagreement is between two derivations
made from the same paint of the same view, which is not the Records-screen
disagreement window `detail-best-efforts-logic.ts:83-92` argues is honest.

---

## Critical Issues

### CR-01: A malformed percent-escape in any URL crashes the curate server process

**File:** `scripts/curate-server.mjs:128` (throw site), `scripts/curate-server.mjs:610-616` (uncaught caller), `scripts/curate-server.mjs:636-647` (no guard)

**Issue:** `safeResolve` begins with
`decodeURIComponent(urlPath.split('?')[0])`. `decodeURIComponent` throws
`URIError: URI malformed` on any invalid escape (`/%`, `/%zz`, `/%e0%a4%a`).
`serveStaticRoute` (line 611) calls it with no try/catch, and `createServer`
(line 646) calls `serveStaticRoute(req, res)` synchronously with no `.catch()`
— unlike the curate branch on line 638, which *is* wrapped. A synchronous throw
inside an http `request` listener becomes an uncaught exception and Node exits.

I reproduced this exact shape in this environment: the process terminated on
`GET /%` with `UNCAUGHT -> URIError URI malformed`.

Failure scenario: the developer has `npm run curate` running and a curated page
open. Any *other* tab — including a hostile page on the public internet — issues
`fetch('http://127.0.0.1:4173/%', { mode: 'no-cors' })`. The static route has no
Host check and no Origin check (only `handleExclusionWrite` and `handleRecompute`
call `isTrustedOrigin`), so the request reaches `safeResolve` and the curate
server dies. The developer's next Save fails with a network error and any
in-flight `writeAtomic` temp file is orphaned. The same URL typed into the
address bar has the same effect.

Note the asymmetry that makes this a real oversight rather than an inherited
one: `handleExclusionWrite:437-443` **does** wrap its `decodeURIComponent` in a
try/catch and returns 400. The static half was copied from
`verify-dashboard-publish.mjs:64` where the only client is the script itself;
the curate server's clients are arbitrary browser tabs.

**Fix:**
```js
export function safeResolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null; // malformed percent-escape — reject exactly like a traversal
  }
  if (decoded !== MOUNT_PREFIX && !decoded.startsWith(MOUNT_PREFIX + '/')) {
    return null;
  }
  ...
}
```
and defence-in-depth at the listener, so no future sync throw can kill the
process:
```js
function createServer() {
  return http.createServer((req, res) => {
    try {
      if (isCurateRoute(req.url ?? '/')) {
        serveCurateRoute(req, res).catch((error) => respond500(res, error));
        return;
      }
      serveStaticRoute(req, res);
    } catch (error) {
      respond500(res, error);
    }
  });
}
```
Add a `safeResolve('/strava-widgets/%')` -> `null` case to
`scripts/curate-server.test.mjs`'s `safeResolve` describe block; today that
suite has four rejection cases and none of them is malformed encoding.

**CLOSED 2026-09-02 by plan 24-12 — see 24-VALIDATION.md row R30.**

---

### CR-02: The D-10 absence guard does not scan `.ts`/`.d.ts`/`.mjs`/extensionless files, and `dist/widgets` already publishes 22 of them

**File:** `scripts/lib/curation-guard.mjs:37` (`SCANNED_EXTENSIONS`), `scripts/lib/curation-guard.mjs:89-98` (the skip), `scripts/verify-dashboard-publish.mjs:305-307` (the second layer, which also misses it)

**Issue:** `SCANNED_EXTENSIONS = ['.js', '.html', '.css', '.map']`. Line 90
(`if (ext === null || !SCANNED_EXTENSIONS.includes(ext)) continue;`) skips the
content scan for every other extension **and** for every file with no extension
at all. The docblock (lines 20-29) justifies the restriction solely in terms of
excluding `.json` so the public exclusions file keeps returning 200 — but the
list is an allowlist, so it silently excludes far more than `.json`.

This is not hypothetical. The current publish tree contains files the guard
cannot see:

```
$ find dist/widgets -type f ! -path "*/data/*" | sed 's/.*\.//' | sort -u
DS_Store css html js map ts
$ find dist/widgets -maxdepth 2 -name "*.ts" | wc -l
      22
```

`dist/widgets/**/*.d.ts` is a shipped, published artifact class today
(`dist/widgets/shared/widget-base.d.ts`, `dist/widgets/stats-card/index.d.ts`,
…). A leaked `scripts/curate-overlay/index.ts` or its emitted `.d.ts` would
contain the literal `const CURATE_PREFIX = '/__curate'` and would be **skipped
by line 90**, producing `violations === []` and a green
`✓ Curation-artifact scan` line in `build-widgets.mjs:222`.

Failure scenario, entirely within the phase's own stated risk model: a later
change widens `tsconfig.json`'s `include` past `["src/**/*"]`, or adds a
`**/*.ts` entry to a copy list, or someone drops the overlay source into
`dist/widgets` while debugging. The build guard passes. The HTTP guard
(`verify-dashboard-publish.mjs:305-307`) probes exactly three hard-coded URL
literals — `/__curate/health`, `/__curate/overlay.js`,
`/__curate/exclusions/3475726256` — and would 404 on all three because the
leaked file is at some other path. Both layers of the "two enforcement layers"
report green, and the curation write path's source ships to a public GitHub
Pages deploy. `24-CONTEXT.md` D-10 requires `process.exit(1)` "never a warning
— `dist/widgets` is what actually gets deployed from a public repo"; a guard
with a hole this shaped does not discharge that.

Secondary holes in the same function:
- Directory check only tests `entry.name === '__curate'` and `'.curate-dist'`
  (lines 64, 72); the file-name check (line 82) tests only `'__curate'`, so a
  **file** named `.curate-dist` or `curate-overlay.ts` is not flagged by name.
- `.mjs` is not scanned, so a copy of `scripts/curate-server.mjs` itself — which
  contains every route literal in the phase — would be missed.

**Fix:** invert the restriction from an allowlist of scanned extensions to a
narrow, explicitly-justified *skip* list, so unknown extensions fail closed:
```js
// Only these are exempt from the content scan, and each exemption is
// load-bearing: .json because dist/widgets/data/best-effort-exclusions.json is
// PUBLIC and must keep returning 200 (see the docblock). Everything else —
// including .ts/.d.ts, which this tree demonstrably publishes, and .mjs — is
// scanned, so an unanticipated extension fails CLOSED, not open.
export const UNSCANNED_EXTENSIONS = ['.json', '.png', '.jpg', '.svg', '.woff', '.woff2', '.ico'];
...
const ext = scanExtension(entry.name);
if (ext !== null && UNSCANNED_EXTENSIONS.includes(ext)) continue;
const content = readFileSync(entryPath, 'utf8');
```
(If reading arbitrary binaries is a concern, keep reading as `latin1` and
substring-match — the marker is ASCII.) Then, per D-11, add planted-fixture
cases to `scripts/lib/curation-guard.test.mjs` that are **observed failing**
before the fix and passing after: `assets/curate-overlay.d.ts` containing the
marker, `assets/curate-server.mjs` containing the marker, and an extensionless
`assets/overlay` containing the marker. The existing suite plants only `.js`,
`.html` and directory-name shapes, which is why this hole survived.

**CLOSED 2026-09-02 by plan 24-11 — see 24-VALIDATION.md row R28.**

---

## Warnings

### WR-01: A mirror failure leaves the repo file already mutated while the UI reports an error

**File:** `scripts/curate-server.mjs:312-315`, `scripts/curate-server.mjs:467-473` and `479-486`

**Issue:** `persistExclusions` writes the working-tree file first
(`writeAtomic`) and only then mirrors (`mirrorExclusions`). `mirrorExclusions`
explicitly throws when `dist/widgets` is missing (lines 299-303). The write
handler catches that throw and returns 500; the overlay's `saveExclusion`
(`scripts/curate-overlay/index.ts:95-98`) sees `!response.ok`, throws, does
**not** reload, and `doSave` prints the error into the status line.

Failure scenario: the developer runs `npm run curate`, then in another terminal
runs a clean/rebuild that removes `dist/widgets`, then ticks a box and presses
Save. The status line says "Internal Server Error: dist/widgets is not built…",
the page does not reload, and the badge does not appear — so the developer
believes nothing was written. But `data/best-effort-exclusions.json` **has** been
rewritten and now carries the entry. The next `git diff` shows a change the
developer was told did not happen. D-09 makes the developer the sole reviewer of
that diff, so a silent unexpected mutation there is exactly the class of surprise
D-09 exists to prevent. The same applies to the DELETE path, where the entry is
already gone.

**Fix:** validate the mirror precondition before mutating the source of truth,
so the failure is a pure 500 with no side effect:
```js
function persistExclusions(doc) {
  if (!existsSync(ROOT)) {
    throw new Error(`dist/widgets is not built (${ROOT} missing). Run \`npm run build-widgets\` first.`);
  }
  writeAtomic(EXCLUSIONS_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  mirrorExclusions();
}
```
and, in the handler, distinguish a pre-write rejection (nothing changed) from a
post-write mirror failure (the repo file *did* change) in the 500 body, so the
message never implies a no-op it cannot guarantee.

---

### WR-02: The 413 response is never delivered — `req.destroy()` precedes `res.writeHead`

**File:** `scripts/curate-server.mjs:399-403`; dead consumer at `scripts/curate-overlay/index.ts:74-76`

**Issue:** `readJsonBody` calls `req.destroy()` and *then* settles
`{ ok: false, status: 413 }`, which `handleExclusionWrite:453-457` turns into
`res.writeHead(413)` / `res.end('Payload Too Large')`. `req.destroy()` destroys
the underlying socket, so the response cannot be written to it.

I reproduced the exact sequence in this environment: the client received
`ECONNRESET`, never a 413.

Failure scenario: the developer pastes a >10KB reason (a log excerpt, a stack
trace). `fetch` rejects with a raw `TypeError: Failed to fetch`;
`describeFailure` is never called because `response` never exists;
`doSave`'s catch prints `TypeError: Failed to fetch` into the status line. The
carefully-written `413` branch of `describeFailure` ("That reason is too long for
the server to accept.") is unreachable dead code. The developer is left guessing
whether the server died — which, given CR-01, is a reasonable guess.

Note also that `MAX_REASON_CHARS` (2000) is enforced by `normalizeReason` with a
proper 400, so the only way to reach the 413 path is a body over 10KB — i.e. this
is precisely the "very long pasted reason" case.

**Fix:** stop consuming without killing the socket, respond, then destroy:
```js
if (received > MAX_BODY_BYTES) {
  done = true;
  req.pause();
  req.removeAllListeners('data');
  settle({ ok: false, status: 413, message: 'Payload Too Large' });
  return;
}
```
and in the caller, after `res.end(bodyResult.message)`, call
`req.destroy()` to drop the remainder. Add a test that starts the real server
and asserts a 413 status code arrives at the client — the existing suite cannot
catch this because `readJsonBody` is not exported.

---

### WR-03: A failed recompute is reported as HTTP 200 and the overlay never detects it

**File:** `scripts/curate-server.mjs:540-568`; `scripts/curate-overlay/index.ts:123-145`

**Issue:** `handleRecompute` writes `res.writeHead(200)` (line 540) *before*
spawning anything, then signals failure only by writing the in-band string
`__CURATE_RECOMPUTE_FAILED__` into the body (lines 546, 553, 564). The overlay's
`runRecompute` checks `response.ok` (true, it's a 200), then loops over chunks
checking **only** for `__CURATE_RECOMPUTE_DONE__` (line 140). `FAILED` is never
matched anywhere in the overlay or its tests.

Failure scenario: `compute-best-efforts` exits non-zero (a corrupt stream file, a
missing `data/private/athlete-private.json`, an OOM). The server writes the
failure sentinel, the reader loop consumes it, `onChunk` appends it to a `<pre>`,
`done` arrives, the loop breaks, `runRecompute` resolves **successfully**, and
`recomputeButton`'s `.catch` never fires — so `status.textContent` is left
reading `Recomputing…` forever. The page does not reload. The developer sees a
wall of compute output in a `<pre>` that they must read to the end to discover
the run failed, with a status line that still claims work is in progress. Worse,
if it half-succeeded (`compute-best-efforts` OK, `compute-dashboard-index`
failed), `data/stats` and `data/dashboard` in `dist/widgets` are now
inconsistent with each other and nothing says so.

Second defect in the same loop: `chunk.includes('__CURATE_RECOMPUTE_DONE__')` is
evaluated per decoded chunk. The sentinel is written by a single `res.end()` so
it usually arrives whole, but nothing guarantees it — a TCP segment boundary or a
`TextDecoder` multi-byte split anywhere in that 26-character marker silently
means "no reload after a successful recompute", and the developer concludes the
promotion did not happen.

**Fix:** accumulate rather than test per chunk, and treat `FAILED` as a failure:
```js
let seen = '';
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  seen += chunk;
  onChunk(chunk);
  if (seen.includes('__CURATE_RECOMPUTE_FAILED__')) {
    throw new Error('Recompute failed — see the output above.');
  }
  if (seen.includes('__CURATE_RECOMPUTE_DONE__')) {
    location.reload();
    return;
  }
}
throw new Error('Recompute ended without a completion marker.');
```
Better still: buffer the first step's exit code before `writeHead` is called, so
the pre-flight failures (`compute-best-efforts` cannot even start) become a real
5xx rather than a 200 with a sentinel.

---

### WR-04: The overlay renders in the EXCLUDED shape before (and permanently after a failed) state load

**File:** `scripts/curate-overlay/exclusion-panel.ts:117-135`

**Issue:** `mountCurationControls` builds `reasonLabel`, `textarea`,
`saveButton` and `removeButton` and appends them all with default
`hidden === false`. `applyVisibility(false)` is **not** called synchronously at
mount — the only calls are inside the `.then` of the async
`loadExclusionState(activityId)` (line 131) and the checkbox handler (line 153).
The `.catch` on line 133-135 logs and returns **without** calling
`applyVisibility`.

Failure scenarios:
1. Every mount, for a fraction of a second, shows the full excluded shape — an
   unticked checkbox next to a live "Remove exclusion" button and a
   "Reason (required)" textarea. `24-CONTEXT.md` D-08's ASCII contract for the
   not-excluded state is `☐ Exclude this run from PRs` and nothing else.
2. If the fetch of `/strava-widgets/data/best-effort-exclusions.json` rejects
   (server down after CR-01, or a transient failure), the controls stay in that
   shape **permanently**. The developer sees "Remove exclusion" on a run that is
   not excluded, clicks it, gets the confirm dialog whose text says "Removing
   this exclusion deletes it and changes PR history", confirms, and a real
   `DELETE /__curate/exclusions/{id}` is issued. That DELETE succeeds (200,
   `applyRemove` is a no-op for an absent id) and triggers `location.reload()`.
   The prompt described an action that could not happen; the reload makes it
   look like it did.

Note that `loadExclusionState` swallows *every* failure into
`{ excluded: false, reason: '' }` at line 66-69, so the `.catch` on line 133 can
only fire on a bug — but the missing synchronous `applyVisibility(false)` call
is a defect regardless of which path is taken.

**Fix:**
```js
  // Render in the NOT-EXCLUDED shape until the live state says otherwise, so
  // a slow or failed load can never present a live "Remove exclusion" control
  // for an activity that is not excluded.
  applyVisibility(false);

  let currentlyExcluded = false;

  loadExclusionState(activityId)
    .then((state) => { ... })
    .catch((error) => {
      console.error(error);
      applyVisibility(false);
      status.textContent = 'Could not read the current exclusion state.';
    });
```

---

### WR-05: The PR badges and the panel rows disagree within a single paint of the same view

**File:** `src/dashboard/views/detail-best-efforts-logic.ts:32-46` vs `119-122`; call sites at `src/dashboard/views/detail.ts:546` and `550`

**Issue:** GAP-24-01 was closed by making `BestEffortPanelRow.excluded` derive
from the live exclusions document (line 119-122). `buildPrBadgeLabels` was left
reading `effort.excludedFromRecords` only (line 42), and
`detail-best-efforts-logic.test.ts` now pins that as intended behaviour
("non-regression: buildPrBadgeLabels still takes exactly one argument and still
gates on effort.excludedFromRecords only"). Both are called from the same
function, from the same `Promise.all`, into the same paint:

```ts
// detail.ts
for (const label of buildPrBadgeLabels(bestEffortsEntry)) {   // precomputed
  appendBadge(badgesContainer, label);
}
const rows = buildBestEffortsPanelRows(bestEffortsEntry, ageGrading, liveExclusions); // live
```

Failure scenario, which is the phase's own primary flow: the developer excludes
a run that set a 5K PR, presses Save, the server mirrors, `location.reload()`
fires. On the very next paint the header renders the badge `PR — 5K` (from the
precomputed document, which still says `excludedFromRecords: false`) while the
Best Efforts row for 5K renders `Excluded — Recorded with an inaccurate GPS
device…`. The same screen asserts both "this run holds the 5K PR" and "this run
is excluded from PRs". The row-level `isPr` flag (line 117, also precomputed)
puts a `PR` badge in the same table cell as the `Excluded` badge
(`detail-sections.ts:342-350`), so the contradiction appears twice.

The docblock at lines 83-92 defends a disagreement between the panel and the
**Records screen**, which is a genuinely separate document and a genuinely
honest window. It does not address a disagreement between two derivations made
side by side from the same fetch. Before this phase there was no such window:
both readings came from the same precomputed document.

This is a decision-level gap, not a typo — flagging it so a later round can
either (a) pass `liveExclusions` to `buildPrBadgeLabels` and suppress badges the
live document excludes, or (b) record explicitly that the header badge is
knowingly stale until Recompute and add a checkpoint row asserting the observed
contradiction is accepted.

**Fix (option a):**
```ts
export function buildPrBadgeLabels(
  entry: ActivityBestEfforts | null,
  liveExclusions: ExclusionIndex | null
): string[] {
  ...
    const excluded = liveExclusions !== null
      ? isExcluded(liveExclusions, entry.activityId, distance)
      : effort.excludedFromRecords;
    if (excluded) continue;
}
```
Making the parameter required (no default) applies the same forgotten-call-site
discipline 24-09 chose for `buildBestEffortsPanelRows`. Row-level `isPr` needs
the same treatment or an explicit note.

**PARTIALLY CLOSED 2026-09-02 by plan 24-13 — see 24-VALIDATION.md row R24 (forward direction,
PASS). The mirror/untick direction (row R26) FAILS on a vacuous discriminator, not on the
implementation (R27 isolates it) — remains open as GAP-24-05.**

---

### WR-06: The file the browser actually fetches is written non-atomically, contradicting `writeAtomic`'s stated rationale

**File:** `scripts/curate-server.mjs:270-306` (`writeAtomic` docblock + `mirrorExclusions`), `scripts/curate-server.mjs:558-562` (recompute re-mirror)

**Issue:** `writeAtomic`'s docblock justifies the temp-file-plus-rename pattern
as necessary "because `data/best-effort-exclusions.json` (via its mirrored copy)
is read concurrently by the browser's own fetch: a half-written file must never
be observable." The mirrored copy — the one the browser actually reads — is then
produced by a plain `copyFileSync` (line 305), which opens the destination with
`O_TRUNC` and streams into it. The atomicity guarantee is applied to the file
nobody fetches and dropped on the file everybody fetches. `copyJsonTree` in the
recompute path (line 560) has the same property across `data/stats` and
`data/dashboard`.

Failure scenario: a second tab (or a `records.ts` fetch, or the overlay's own
`loadExclusionState`) requests `/strava-widgets/data/best-effort-exclusions.json`
while a Save is mirroring, and reads a truncated body. `response.json()` throws,
`loadLiveExclusionState` catches it and returns `{ reason: null, index: null }`,
and the panel silently falls back to the precomputed flag — the badge blinks to
a stale value with no error surfaced. The window is small (the copy is
synchronous and completes before the 200), but during a recompute the server
copies the whole `data/stats` tree while the developer's page is open and
polling nothing prevents a fetch landing mid-copy.

**Fix:** reuse the pattern the file already has:
```js
export function mirrorExclusions() {
  if (!existsSync(ROOT)) { throw new Error(...); }
  mkdirSync(dirname(PUBLISH_EXCLUSIONS_PATH), { recursive: true });
  writeAtomic(PUBLISH_EXCLUSIONS_PATH, readFileSync(EXCLUSIONS_PATH, 'utf8'));
}
```
and, in `copyJsonTree`, `copyFileSync` to `${destPath}.tmp` then `renameSync`
(or accept the risk explicitly and delete the misleading claim from
`writeAtomic`'s docblock, so the next reader is not told a guarantee that does
not hold).

---

### WR-07: No cache headers on the served data file, against a recorded staged-build cache trap in this repo

**File:** `scripts/curate-server.mjs:610-633`

**Issue:** `serveStaticRoute` sets only `Content-Type`. No `Cache-Control`, no
`ETag`, no `Last-Modified`. D-07/OD-1's entire promise is "Save mirrors
instantly … the overlay re-renders", discharged by `location.reload()` — which
relies on the browser refetching `data/best-effort-exclusions.json`,
`data/dashboard/index.json` and `data/stats/best-efforts/{id}.json` rather than
serving them from its HTTP cache.

Failure scenario: the developer Saves, the page reloads, and the browser serves a
cached copy of the exclusions file, so the badge does not appear — which is
indistinguishable from GAP-24-01's original symptom and would be re-diagnosed
from scratch. This repo has already lost time to exactly this
(`~/.claude/.../staged-build-browser-cache-trap.md`: "stale index.html/index.json
in checkpoints; 127.0.0.1 alone is NOT enough, hard-reload after every fixture
edit"). A curate server that mutates files under a long-lived page is precisely
the shape that memo describes.

**Fix:**
```js
res.writeHead(200, {
  'Content-Type': contentType,
  // Curate mutates files under a live page (D-07/OD-1). A cached data
  // document defeats the instant mirror and reads exactly like GAP-24-01.
  'Cache-Control': 'no-store, must-revalidate',
});
```
Apply it to the injected `index.html` response (line 625) too.

---

### WR-08: Recompute has no concurrency guard, no client-abort handling, and orphans the child process

**File:** `scripts/curate-server.mjs:511-522`, `524-568`

**Issue:** three related gaps in the streaming runner:
1. Nothing prevents two concurrent recomputes. "Recompute records" is never
   disabled (a deliberate choice per 24-07, see IN-09) and `handleRecompute`
   holds no in-flight flag. Two presses spawn two `compute-best-efforts`
   processes writing the same `data/stats/best-efforts/*.json` shards
   concurrently; interleaved writes can leave a corrupt shard, and both then race
   `copyJsonTree` into `dist/widgets`.
2. `runComputeStep` writes child output straight into `res` (lines 514-515) with
   no check that `res` is still writable. If the developer closes the tab or hits
   Escape mid-recompute, `res.write` on a destroyed response emits an `'error'`
   event that nothing listens for.
3. Neither `res.on('close')` nor `req.on('aborted')` kills the child. A closed
   tab leaves a full archive-wide `node dist/index.js compute-best-efforts` walk
   running to completion, still mutating `data/stats`, with nothing left to
   re-mirror it — so `dist/widgets` and `data/` end up silently out of sync.

**Fix:**
```js
let recomputeInFlight = false;

async function handleRecompute(req, res) {
  if (recomputeInFlight) {
    res.writeHead(409, { 'Content-Type': 'text/plain' });
    res.end('Conflict: a recompute is already running.');
    return;
  }
  recomputeInFlight = true;
  try { /* existing body */ } finally { recomputeInFlight = false; }
}

function runComputeStep(args, res) {
  return new Promise((settle) => {
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const onClose = () => child.kill('SIGTERM');
    res.on('close', onClose);
    const pipe = (chunk) => { if (!res.writableEnded && !res.destroyed) res.write(chunk); };
    child.stdout.on('data', pipe);
    child.stderr.on('data', pipe);
    child.on('close', (code) => { res.off('close', onClose); settle(code ?? 1); });
    child.on('error', (error) => { res.off('close', onClose); pipe(`\n${error.message}\n`); settle(1); });
  });
}
```

---

### WR-09: The entire HTTP write path is unexported and untested

**File:** `scripts/curate-server.mjs:390-425` (`readJsonBody`), `429-494` (`handleExclusionWrite`), `524-568` (`handleRecompute`), `308-315` (`readExclusionsFile`/`persistExclusions`), `573-608` (`serveCurateRoute`), `610-633` (`serveStaticRoute`); test file `scripts/curate-server.test.mjs`

**Issue:** all of the above are module-private. `curate-server.test.mjs`'s 30
assertions cover `injectOverlayTag`, `safeResolve`, `isCurateRoute`,
`applyUpsert`, `applyRemove`, `isValidCurateActivityId`, `normalizeReason`,
`isTrustedOrigin` and two source-text greps — every one of them a pure string or
object function. Nothing in the phase ever starts the server or issues a request.

This is why CR-01, WR-02 and WR-03 all survived to review: each is a defect of
*wiring* (a throw not caught by its caller, a settle ordering, a status code
never observed by a client), invisible to unit tests of the pure helpers. It is
also why `isTrustedOrigin`'s real behaviour is unverified — the tests exercise
the function with hand-built `{ headers }` literals, never with a header set a
browser or `curl` actually produces. Notably untested: a missing `Host` header
(HTTP/1.0), `Origin: null` (sandboxed iframe / `file://` / cross-site redirect,
which arrives as the *string* `"null"`, not `undefined`), and a `GET`/`POST` to
`/__curate/exclusions/{id}` (which returns 404, not the 405 the code at line 492
implies — see IN-02).

For a phase whose deliverable is a write server, an "npm test is green" signal
that touches none of the write path is exactly the never-red-guard pattern D-11
was written against.

**Fix:** add `scripts/curate-server.integration.test.mjs` that imports
`createServer` (export it), listens on port 0, and asserts over real sockets:
a cross-origin `PUT` -> 403; a `Host: evil.example` `PUT` -> 403; an
`Origin: null` `PUT` -> 403; a valid `PUT` -> 200 and the entry present in a
temp-dir exclusions file; a `PUT` with a >10KB body -> a 413 **received by the
client** (this fails today, per WR-02); `GET /strava-widgets/%` -> a 403/404 and
a still-alive server (this fails today, per CR-01). Parameterise
`EXCLUSIONS_PATH`/`ROOT` (or run with `cwd` set to a fixture tree) so no test
ever touches the real archive file.

---

### WR-10: The overlay's TypeScript is type-checked by nothing

**File:** `scripts/curate-overlay/index.ts`, `scripts/curate-overlay/exclusion-panel.ts`; `tsconfig.json` `include: ["src/**/*"]`; `scripts/curate-server.mjs:197-206`

**Issue:** the overlay is `.ts`, but `tsconfig.json`'s `include` is
`["src/**/*"]` (D-01 requires this — it is half the structural-absence
guarantee), there is no ESLint config and no separate typecheck script in
`package.json`, and `buildOverlay` invokes `esbuild.build` which **strips** types
without checking them. So no tool in this repo ever type-checks these two files.

I ran `tsc --noEmit --strict` against them manually and they are clean *today* —
but nothing keeps them that way. Failure scenario: a later edit renames a field
on `ExclusionState`, or passes a `string | null` where a `string` is expected.
`npm test` is green (the overlay tests are source-text greps),
`npm run build-widgets` is green (the overlay is not an input), `npm run curate`
bundles successfully, and the developer discovers the fault as a runtime
`TypeError` in the browser console mid-curation.

**Fix:** add a checked-but-not-emitting config that keeps D-01 intact —
`tsconfig.curate.json` with `include: ["scripts/curate-overlay/**/*"]`,
`noEmit: true`, `lib: ["ES2022", "DOM"]` — and a
`"typecheck:curate": "tsc -p tsconfig.curate.json"` script, invoked from
`buildOverlay` (or at least from CI). It must not be `tsconfig.json`'s `include`,
and `curate-overlay.test.mjs`'s D-01 assertion should be extended to allow
`tsconfig.curate.json` while still forbidding `curate-overlay` in the four
publish-pipeline configs.

---

### WR-11: `REPO_ROOT` from `URL.pathname` can silently skip the entire D-11 HTTP proof

**File:** `scripts/verify-dashboard-publish-guard.test.mjs:30`, `56`

**Issue:** `const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);`
A `file:` URL's `pathname` is percent-**encoded**. A checkout under
`/Users/pedf/my repo/strava-widgets` yields `/Users/pedf/my%20repo/...`, which
`resolve` treats as a literal directory name. `INDEX_HTML` then does not exist,
`describe.skipIf(!existsSync(INDEX_HTML))` skips, and vitest reports the whole
file as skipped — green.

Failure scenario: the four planted-fixture cases that constitute D-11's evidence
for the HTTP absence guard silently stop running, on a machine where the checkout
path contains a space or any non-ASCII character. That is the precise failure
mode `24-CONTEXT.md` cites twice (Phase 19 R3-CR-01, Phase 23 WR-06): a guard
that is green because it never ran. The same pattern also breaks on Windows,
where `pathname` is `/C:/…`.

The `skipIf` gate itself is a second, softer instance: it is correct today
because `daily-refresh.yml:170` runs `npm run build-widgets` before
`npm test:185`, but any reordering of those two steps turns the phase's
strongest evidence into a silent skip with no signal.

**Fix:**
```js
import { fileURLToPath } from 'node:url';
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
```
and make the skip loud — e.g. `it('D-11 proof did not silently skip', () => {
expect(existsSync(INDEX_HTML)).toBe(true); })` gated on `process.env.CI`, so CI
fails rather than skips when the build is missing.

---

### WR-12: `npm test` plants artifacts into the real, about-to-be-deployed `dist/widgets`

**File:** `scripts/verify-dashboard-publish-guard.test.mjs:33`, `73-115`; `vitest.config.ts:9`; `.github/workflows/daily-refresh.yml:170,185,188`

**Issue:** widening vitest's `include` to `scripts/**/*.test.mjs` brought a test
that writes `dist/widgets/__curate/{overlay.js,health,exclusions/3475726256}`
into the default `npm test` run — against the **real** publish directory, not a
temp tree. In CI that run sits *after* `npm run build-widgets` (line 170) and
therefore after `assertNoCurationArtifacts()` has already executed and passed.

Failure scenario: a vitest worker is killed (test timeout, OOM, a `SIGINT`), so
neither the per-test `finally` (lines 79, 90, 105) nor the `afterEach` (57-59)
runs, and `dist/widgets/__curate/overlay.js` survives. The build-time guard has
already gone green and will not run again. Only `npm run verify-dashboard`
(line 188) stands between that fixture and the deployed artifact — the second
layer catching a leak the test suite itself planted. If the ordering of those
two steps is ever changed, or if the `__curate` name is ever changed in one file
and not the other, a curate-shaped artifact ships from a public repo.

The comment at lines 18-21 shows the authors saw the risk and mitigated with
`finally` + `afterEach` + a post-suite existence check (line 117) — none of which
survives a killed worker.

**Fix:** run the verifier against a disposable copy rather than the live tree.
`mkdtemp`, hard-link or copy `dist/widgets` into it, plant there, and pass the
root to the verifier via an env var or argv the script already supports (adding
one is cheap and does not weaken the "real, shipped script" property the docblock
values — `execFileSync('node', [VERIFIER], { env: { ...process.env, PUBLISH_DIR:
tmp } })`). Failing that, at minimum re-run `assertNoCurationArtifacts()` (or
`findCurationArtifacts('dist/widgets')`) as the last assertion of the suite.

---

### WR-13: Startup failures surface as raw stack traces, not the fail-fast messages the phase specifies

**File:** `scripts/curate-server.mjs:652-676`, `681-683`

**Issue:** two paths bypass the careful FATAL messaging:
1. `main()` is `async` and is invoked at line 682 with no `.catch`. If
   `buildOverlay()` rejects — an esbuild syntax error in
   `scripts/curate-overlay/*.ts`, which WR-10 makes more likely, or a missing
   `.curate-dist` write permission — the result is an unhandled rejection: a raw
   esbuild trace and a nonzero exit with no instruction. `24-CONTEXT.md`'s
   Claude's-Discretion block requires `npm run curate` to "fail fast with
   instructions", which `assertBuilt` does properly and this does not.
2. `server.on('error')` (line 658) handles `EADDRINUSE` and `throw error` for
   anything else (line 669). Throwing from inside an `'error'` event handler is
   an uncaught exception, so `EACCES` or `EADDRNOTAVAIL` also produce a raw
   trace.

**Fix:**
```js
main().catch((error) => {
  console.error(
    'FATAL: could not start the curate server.\n' +
      `  ${error.message}\n` +
      '  If this is an esbuild error, fix scripts/curate-overlay/*.ts and re-run `npm run curate`.'
  );
  process.exit(1);
});
```
and replace `throw error` at line 669 with a `console.error` + `process.exit(1)`
carrying `error.code`.

---

## Info

### IN-01: Unused `MOUNT_PREFIX` constant, with the same literal duplicated in the sibling module

**File:** `scripts/curate-overlay/index.ts:34`; duplicate literal at `scripts/curate-overlay/exclusion-panel.ts:49`

`const MOUNT_PREFIX = '/strava-widgets';` is declared and never referenced —
confirmed by bundling: `grep -c MOUNT_PREFIX .curate-dist/overlay.js` returns 0
(esbuild tree-shook it). Meanwhile `exclusion-panel.ts:49` hard-codes
`fetch('/strava-widgets/data/best-effort-exclusions.json')`. Export the constant
from `index.ts` and build the URL from it, or delete it.

### IN-02: Unreachable 405 branch in `handleExclusionWrite`

**File:** `scripts/curate-server.mjs:492-493`

`handleExclusionWrite` is only reached from `serveCurateRoute:593-599`, whose
condition already requires `req.method === 'PUT' || req.method === 'DELETE'`.
The trailing `res.writeHead(405)` can never execute. A `GET /__curate/exclusions/1`
therefore returns 404 from the fallthrough at line 606. Either drop the method
test from the route match and let `handleExclusionWrite` own the 405, or delete
the dead branch.

### IN-03: Redundant `__proto__` guard in `isValidCurateActivityId`

**File:** `scripts/curate-server.mjs:361`

`id !== '__proto__'` can never change the result: `/^i?\d{1,20}$/` already
rejects `__proto__`. The docblock presents it as a real guard "matching
records-logic.ts:82". Harmless, but it implies a defence the regex is already
providing, and `curate-server.test.mjs:236` asserts a case that would pass with
the check removed. Keep it with a comment saying it is belt-and-braces, or drop it.

### IN-04: `CURATE_DIR_NAME` and `CURATE_MARKER` are the same string

**File:** `scripts/lib/curation-guard.mjs:35-36`

Both are `'__curate'`. Two exported names for one value invite a future edit that
changes one and not the other, at which point either the directory check or the
content check silently stops matching the real route prefix. Derive one from the
other (`export const CURATE_DIR_NAME = CURATE_MARKER;`) or collapse to one name.
Neither is imported from `scripts/curate-server.mjs`'s `CURATE_PREFIX`, so the
marker and the actual route are independently editable today.

### IN-05: Stale doc references to `loadExclusionReason`, renamed in 24-09

**File:** `scripts/curate-overlay/index.ts:85`; `scripts/curate-overlay/exclusion-panel.ts:40`

Both docblocks refer to "detail.ts's own `loadExclusionReason`" / "`loadExclusionReason`'s
never-rejects discipline at detail.ts:463". Plan 24-09 renamed that function to
`loadLiveExclusionState` and moved it to `detail.ts:480`. The line number is also
stale. Update to `loadLiveExclusionState` (and prefer naming the function without
a line number, which will drift again).

### IN-06: Circular import between the overlay's entry point and its panel module

**File:** `scripts/curate-overlay/index.ts:32` imports `./exclusion-panel.js`; `scripts/curate-overlay/exclusion-panel.ts:22` imports `./index.js`

`index.ts` is simultaneously the module with the top-level `addEventListener`
side effect (line 41) and the transport layer (`saveExclusion`,
`removeExclusion`, `runRecompute`). It works today only because the imported
bindings are hoisted function declarations. Extracting the three network
functions into `scripts/curate-overlay/transport.ts` would break the cycle and
leave `index.ts` as a pure entry point.

### IN-07: `writeAtomic`'s temp files are not gitignored

**File:** `scripts/curate-server.mjs:283-287`; `.gitignore`

`writeAtomic` creates `data/best-effort-exclusions.json.tmp-{pid}` in a tracked
directory. If the process dies between `writeFileSync` and `renameSync`, the
stray file is left untracked and shows up in the `git diff` review D-09 makes
the developer responsible for — and a `git add -A` would commit it. Add
`data/*.tmp-*` to `.gitignore`, or write the temp file into `os.tmpdir()`
(noting that would forfeit the same-filesystem rename guarantee the docblock
depends on — the gitignore is the better option).

### IN-08: The destructive-confirm copy is duplicated verbatim

**File:** `scripts/curate-overlay/exclusion-panel.ts:143-145` and `167-169`

`'Removing this exclusion deletes it and changes PR history. Continue?'` appears
twice. Two call sites for one D-08 contract; a wording change to one leaves the
other stale. Hoist to a module constant.

### IN-09: A test pins the absence of any in-flight control disabling, locking in double-submit

**File:** `scripts/curate-overlay.test.mjs:98-102`; `scripts/curate-overlay/exclusion-panel.ts:156-184`

`expect(PANEL_SOURCE.includes('disabled = true')).toBe(false)` makes it a test
failure to ever guard a control while a request is in flight. Neither Save,
Remove nor Recompute has any re-entrancy guard, so a double-click issues two
`PUT`s (idempotent, harmless) or two `POST /__curate/recompute`s (not harmless —
see WR-08.1). 24-07 recorded this as deliberate (D-08 rejected *unexplained*
disabled controls, per Phase 19's CR-03). Worth revisiting: a status-line-driven
in-flight flag (`if (inFlight) return;`) satisfies both constraints without ever
setting `disabled`.

### IN-10: Template literal with no interpolation

**File:** `scripts/build-widgets.mjs:222`

`` console.log(`✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.`) ``
— use a plain string, and consider interpolating the scanned file count so the
success line carries evidence the walk actually visited files (a zero-file walk
currently prints the same message as a full one).

### IN-11: A `DELETE` request body is never drained

**File:** `scripts/curate-server.mjs:479-490`

The `DELETE` branch never reads `req`, so a `DELETE` carrying a body leaves
unconsumed data on a keep-alive connection. The overlay never sends one, so this
is latent, but `req.resume()` before the write is one line.

### IN-12: `.DS_Store` is present in the published tree

**File:** `dist/widgets/.DS_Store` (observed during the CR-02 extension survey)

Pre-existing and outside this phase's diff, but it surfaced while enumerating
published extensions and it is a real artifact leaking to a public deploy.
`.gitignore` covers `.DS_Store` for git; `build-widgets.mjs`'s copy path does
not. Worth a separate todo.

---

## Verified-Correct (checked adversarially, no finding)

Recorded so a later round does not re-litigate ground already covered:

- **Path traversal on the write route** — `activityId` is validated against
  `/^i?\d{1,20}$/` (line 361) *and* the write target is the module constant
  `EXCLUSIONS_PATH`; `..%2f`, `../../etc/passwd`, `123/../456` and a trailing
  empty id all reject with 400. No traversal surface exists.
- **Static-route traversal** — `safeResolve` resolves then requires
  `resolved === ROOT || resolved.startsWith(ROOT + '/')`;
  `/strava-widgets/%2e%2e%2f%2e%2e%2fetc/passwd` rejects. (The malformed-escape
  case is CR-01, a crash, not an escape.)
- **The Origin/Host gate (D-12)** — `req.headers.host` must equal
  `127.0.0.1:4173` exactly, which defeats DNS rebinding (the browser sends the
  attacker's hostname). A cross-origin `fetch` sends `Origin`, which must then
  also match. `Origin: null` arrives as the string `"null"`, `new URL('null')`
  throws, and the `catch` returns `false` — fail-closed. `PUT`/`DELETE` are
  unreachable from an HTML form, and a cross-origin form `POST` to
  `/__curate/recompute` carries an `Origin` header. I found no bypass. (Untested
  over a real socket — see WR-09.)
- **Bind address** — `server.listen(CURATE_PORT, CURATE_HOST)` with
  `CURATE_HOST = '127.0.0.1'`; a source-text assertion forbids `0.0.0.0`.
- **`applyUpsert` / `applyRemove`** — non-mutating, `distances` is strictly
  `null`, in-place replacement at the same index, and removal filters the entry
  out rather than emptying `distances` (the D-05 trap). The read-modify-write in
  `persistExclusions` has no `await` between read and write, so concurrent
  in-process requests cannot lose an update.
- **`buildBestEffortsPanelRows`'s UNKNOWN semantics** — `liveExclusions === null`
  falls back to `effort.excludedFromRecords` (line 122) and is never coerced to
  `false`; the third parameter is required, so a forgotten call site is a `tsc`
  error. `loadLiveExclusionState` returns `index: null` on fetch rejection,
  `!response.ok`, a non-object body, and a non-array `exclusions` — all four
  degrade to the precomputed flag, never to a cleared badge. An **empty**
  `exclusions` array correctly yields an empty non-null index so an untick clears
  immediately.
- **`buildExclusionIndex` argument shape** — `detail.ts:493` passes
  `body.exclusions` (the array), matching `buildExclusionIndex(entries: unknown)`,
  while `buildExclusionReasonIndex(body)` takes the whole document. Both are
  correct for their signatures, from one fetch.
- **D-05 read tolerance** — `buildExclusionIndex` still accepts distance arrays,
  duplicates and malformed rows; curate only ever writes `distances: null`.
  Unchanged, as required.
- **Overlay bundling** — `npx esbuild scripts/curate-overlay/index.ts --bundle`
  succeeds; esbuild resolves the `./exclusion-panel.js` specifier to the `.ts`
  file. `npm run curate` will build.
- **`build-widgets.mjs`'s `statSync` import removal** — `statSync` moved out with
  `copyJsonTree` and has no remaining reference in the file. No `ReferenceError`.

---

_Reviewed: 2026-09-01T20:37:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Wave 7 Review (2026-09-02, plans 24-11/24-12/24-13)

**Reviewed:** 2026-09-02T10:57:43Z
**Depth:** standard
**Scope:** the eight files changed after the Wave 1-6 review above —
`scripts/lib/curation-guard.mjs`, `scripts/lib/curation-guard.test.mjs`,
`scripts/curate-server.mjs`, `scripts/curate-server.test.mjs`,
`src/dashboard/views/detail-best-efforts-logic.ts`,
`src/dashboard/views/detail-best-efforts-logic.test.ts`,
`src/dashboard/views/detail.ts`, `vitest.config.ts`.
**Evidence:** full suite re-run green (60 files / 1531 tests / 6.53s on Node
v25.2.1), plus five direct probes of `findCurationArtifacts` against planted
symlink/permission/`.json` fixtures and three `http` probes of the response
lifecycle. Findings continue the existing ID sequence (CR-03+, WR-14+, IN-13+).

### Status of the three targeted findings

**CR-01 — CLOSED.** `safeResolve` (`scripts/curate-server.mjs:132-151`) wraps
`decodeURIComponent` in try/catch and returns `null` on `URIError`, so a
malformed escape is rejected on the identical code path as a traversal. Both
`decodeURIComponent` call sites in the file are now guarded (lines 135 and 448
— no third site exists). The `createServer` listener (688-705) wraps the
synchronous static branch in try/catch and the async curate branch in
`.catch(respond500)`; because `serveCurateRoute` is an `async function`, a
*synchronous* throw inside it also becomes a rejection and is caught, so the
async coverage the fix claims is real rather than nominal. The real-socket
suite proves the liveness property in-process (`GET /%` → 4xx, then
`GET /strava-widgets/` → 200 with the overlay tag) rather than asserting about
source text. Residual: see IN-13.

**CR-02 — CLOSED as scoped.** The named regression is genuinely fixed:
`.ts`/`.d.ts`/`.mjs` and extensionless files are now content-scanned, proven by
three planted fixtures (`curation-guard.test.mjs:99`, `:111`, `:123`) and
re-confirmed by direct probe. The inversion is total — I traced every
`continue`/early-return in `walk()` and the only content-scan skip left is
`UNSCANNED_EXTENSIONS.includes(ext)`; directories are skipped for content but
still descended, and both name checks fire before the extension test. Two
adjacent defects the inversion did **not** address are raised below as WR-14
(unreadable/non-regular entries) and WR-15 (the `.json` exemption's breadth).

**WR-05 — CLOSED.** `buildPrBadgeLabels` now takes a required, non-defaulted
`liveExclusions` and computes `excluded` with the byte-identical ternary
`buildBestEffortsPanelRows` uses; `BestEffortPanelRow.isPr` is
`wasPRAtTheTime && !excluded` using the same locally-bound `excluded` the row
publishes. `detail.ts` has exactly one call site for each, both reading the one
`liveExclusions` binding from the one `Promise.all`, both after the
`requestToken`/`mountedContainer` guard, both in the same paint — so the two
derivations cannot disagree today. The `liveExclusions === null` fallback to
`effort.excludedFromRecords` is correct, not a re-introduction of the old bug:
`null` is reached only on fetch rejection, `!response.ok`, a non-object body, or
a non-array `exclusions`, and it fails toward *keeping* a badge suppressed
rather than clearing one. A loaded-but-empty index is a non-null `Map`, so an
untick still clears immediately. Also verified: `badgesContainer` is created
fresh per `renderSuccess`, so the additive `appendBadge` loop cannot duplicate
badges on re-navigation; and the dashboard is hash-routed, so the relative
`fetch('data/best-effort-exclusions.json')` resolves under
`/strava-widgets/` from every detail URL. What is *not* closed is the
durability of the fix — see WR-17.

### Warnings

#### WR-14: `findCurationArtifacts` throws on any non-regular or unreadable entry — the fail-closed inversion traded a blind spot for a build-abort class

**File:** `scripts/lib/curation-guard.mjs:116-130`

**Issue:** the walk has no `entry.isFile()` test. `readdirSync(…, {withFileTypes:true})`
uses `lstat` semantics, so `entry.isDirectory()` is **false** for a symlink that
points at a directory, and every non-directory entry — symlink, FIFO, socket,
device node, mode-000 file — falls through to an unguarded
`readFileSync(entryPath, 'latin1')`. I probed all four classes directly against
the shipped module:

```
A dangling symlink   -> THREW ENOENT: no such file or directory, open '.../broken.js'
B symlink to a dir   -> THREW EISDIR: illegal operation on a directory, read
C mode-000 file      -> THREW EACCES: permission denied, open '.../secret.js'
```

(a FIFO is worse than a throw: `readFileSync` on one blocks until a writer
appears, hanging the build with no output.) The throw escapes
`findCurationArtifacts`, escapes `assertNoCurationArtifacts()` — which has no
try/catch — and lands in `build-widgets.mjs:340`'s
`buildAllWidgets().catch(...)`, which prints `Widget build failed: EISDIR:
illegal operation on a directory, read` and exits 1. That fails *closed*, which
is why this is a Warning and not a Critical, but the operator-facing message
names neither the curation guard nor the offending path, so the developer is
handed the least actionable possible form of a build failure. The docblock's
claim that latin1 means "scanning arbitrary bytes can never throw" is true of
the *decode* and false of the *read*, which is the step that actually throws.

**Fix:**

```js
if (!entry.isFile()) {
  // Symlinks, FIFOs, sockets and device nodes are never legitimate publish
  // artifacts; report rather than read (readFileSync on a dir-symlink throws
  // EISDIR, on a FIFO it blocks forever).
  violations.push({ path: entryPath, reason: 'not a regular file — the published bundle must contain only regular files and directories' });
  continue;
}

let content;
try {
  content = readFileSync(entryPath, 'latin1');
} catch (error) {
  violations.push({ path: entryPath, reason: `could not be read for scanning (${error.code ?? error.message}) — an unscannable file cannot be certified free of the "${CURATE_MARKER}" marker` });
  continue;
}
```

#### WR-15: the `.json` exemption is extension-scoped, not path-scoped — it exempts 5,588 of the 5,727 published files, including the only directory curate actually writes into

**File:** `scripts/lib/curation-guard.mjs:44-49, 117`

**Issue:** the docblock justifies the exemption with exactly one file
(`dist/widgets/data/best-effort-exclusions.json`) but implements it as an
extension match. Measured against the real publish tree:

```
5588 .json      64 .js      44 .map      22 .ts      5 .html      2 .css      2 .DS_Store
total files: 5727
```

So the guard content-scans 139 files and skips 5,588 — **97.6% of the published
tree is exempt**, on the strength of a one-file rationale. The CR-02 inversion
moved scanned coverage from 115 files to 139; the dominant blind spot is
unchanged and is now explicitly blessed by a comment that reads as though the
guard is thorough. Verified by probe: a marker planted in `index.json` returns
`[]`.

```
E marker in index.json -> []
```

This matters concretely rather than theoretically, because
`dist/widgets/data/**` is the *only* part of the published tree curate itself
writes into — `mirrorExclusions()` (`curate-server.mjs:308-316`) and the
`copyJsonTree(dir.src, dir.dest)` loop in `handleRecompute` (569-571) both land
inside the exempt region. The one code path that could plausibly leak curate
state into `dist/widgets` is the one path the guard cannot see.

**Fix:** exempt the single known-public path instead of the extension, so any
*other* `.json` is scanned:

```js
// The ONE published file whose contents may legitimately carry the marker
// (a developer-written reason string). Everything else, including every
// other .json, is content-scanned.
export const UNSCANNED_RELATIVE_PATHS = ['data/best-effort-exclusions.json'];
// …in walk():
const rel = relative(publishDir, entryPath);
if (UNSCANNED_RELATIVE_PATHS.includes(rel)) continue;
```

#### WR-16: the new whole-tree regression suite repeats WR-11's `URL.pathname` bug and can silently skip itself

**File:** `scripts/lib/curation-guard.test.mjs:25-27, 207`

**Issue:** WR-11 above flagged `new URL(...).pathname` as a repo-root
derivation that can silently skip an entire D-11 proof. The new whole-tree
block added in this wave uses the identical construction:

```js
const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DIST_WIDGETS_INDEX_HTML = path.resolve(DIST_WIDGETS, 'index.html');
…
describe.skipIf(!existsSync(DIST_WIDGETS_INDEX_HTML))(…)
```

`URL.pathname` is percent-**encoded**: a checkout under a path containing a
space or any non-ASCII character yields `/Users/…/my%20repo/…`, `existsSync`
returns false, and `describe.skipIf` skips the suite reporting success. This is
the only assertion in the repo that would catch the new fail-closed scan
producing a false positive against real published artifacts, so its silent
disappearance is exactly the never-red-guard failure mode the file's own header
comment cites Phase 19 R3-CR-01 and Phase 23 WR-06 against. Note also that the
three script test files now derive the repo root three different ways —
`process.cwd()` (`curate-server.test.mjs:33`), `new URL('..').pathname`
(`verify-dashboard-publish-guard.test.mjs:30`) and `new URL('../..').pathname`
(here).

**Fix:**

```js
import { fileURLToPath } from 'node:url';
const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
```

and apply the same change at `verify-dashboard-publish-guard.test.mjs:30` so
all three files agree.

#### WR-17: the WR-05 mirror is enforced by a duplicated ternary and a comment — nothing structural or test-level stops the two derivations diverging again

**File:** `src/dashboard/views/detail-best-efforts-logic.ts:65-68` and `152-155`;
`src/dashboard/curation-seam.test.ts:127-135`

**Issue:** the fix is correct today but its correctness rests on two verbatim
copies of the same four lines staying verbatim:

```ts
const excluded =
  liveExclusions !== null
    ? isExcluded(liveExclusions, entry.activityId, distance)
    : effort.excludedFromRecords;
```

The docblock asserts the two "cannot diverge" *because* the shape is the same —
but copy-paste is the mechanism by which they diverge, and the original WR-05
defect was precisely one of these two sites reading a different source. The
test layer does not close the gap either. `curation-seam.test.ts` pins only
`buildBestEffortsPanelRows`'s arity, with a regex that accepts literally any
three arguments:

```js
expect(detailStripped).toMatch(/buildBestEffortsPanelRows\([^)]*,[^)]*,[^)]*\)/);
```

There is no equivalent pin for `buildPrBadgeLabels`'s call site, and nothing at
all asserts that the *same* value is handed to both. `tsc` cannot help: a future
`buildPrBadgeLabels(bestEffortsEntry, null)` alongside
`buildBestEffortsPanelRows(bestEffortsEntry, ageGrading, liveExclusions)` type-checks
cleanly and silently reinstates the exact header-vs-panel contradiction. Since
GAP-24-05 already records that no checkpoint row can observe this mirror
direction, the code and its unit tests are the *only* available evidence — and
they cover the fixed behaviour without covering the divergence mode.

**Fix:** make divergence structurally impossible rather than conventionally
discouraged — one exported helper both functions call:

```ts
/** The single definition of "is this effort excluded right now". */
export function resolveExcluded(
  liveExclusions: ExclusionIndex | null,
  activityId: string,
  distance: TargetDistanceKey,
  effort: { excludedFromRecords: boolean }
): boolean {
  return liveExclusions !== null
    ? isExcluded(liveExclusions, activityId, distance)
    : effort.excludedFromRecords;
}
```

and add one seam assertion pinning that `detail.ts` passes the same identifier
to both call sites, e.g.
`expect(detailStripped).toContain('buildPrBadgeLabels(bestEffortsEntry, liveExclusions)')`.

#### WR-18: `fileParallelism: false` is the right call, but it is guarded by nothing except a comment

**File:** `vitest.config.ts:9-15`

**Issue:** the diagnosis is correct and the mechanism is sufficient — vitest
runs test files one at a time, so `curation-guard.test.mjs`'s whole-tree read
can no longer overlap `verify-dashboard-publish-guard.test.mjs`'s plant/remove
window on the real `dist/widgets`. I confirmed the stated cost: the full suite
is 6.53s wall for 60 files / 1531 tests, matching the comment's "~6.6s". I also
checked the remaining shared-real-tree mutations and found only the one file
(`verify-dashboard-publish-guard.test.mjs`, which cleans up in both a `finally`
and an `afterEach`); serialization strictly *shrinks* the residue window that
WR-12 describes, rather than widening it. So the trade is defensible and I am
not asking for it to be reverted.

What is defective is its durability. The invariant lives entirely in a comment:
delete the line and every test still passes, on most runs, forever — until a
CI run interleaves the two files and produces an unreproducible failure whose
cause is a config line nobody deleted on purpose. This phase repeatedly pins
structural facts with tests instead (the "listener symmetry" suite at
`curate-server.test.mjs:437` and the "OD-2 call-site ordering" suite at
`curation-guard.test.mjs:170` both exist for exactly this reason); the config
change is the one structural fact in the wave left unpinned. Note too that the
underlying coupling is untouched: two test files still share one mutable real
directory, and serialization only makes the sharing safe by accident of
scheduling.

**Fix:** either pin it —

```js
// scripts/lib/curation-guard.test.mjs
it('vitest runs test files serially — this suite reads the real dist/widgets that verify-dashboard-publish-guard.test.mjs plants into', async () => {
  const config = readFileSync(new URL('../../vitest.config.ts', import.meta.url), 'utf8');
  expect(config).toMatch(/fileParallelism:\s*false/);
});
```

— or remove the coupling by moving the whole-tree regression `it(...)` into
`verify-dashboard-publish-guard.test.mjs`, where sequential execution within a
single file is guaranteed by vitest's own semantics and the config change
becomes unnecessary.

### Info

#### IN-13: `respond500` — the crash safety net can itself throw, and it echoes internal error text to the client

**File:** `scripts/curate-server.mjs:677-682`

**Issue:** `res.end(\`Internal Server Error: ${error.message}\`)` dereferences
`error` unconditionally. A rejection or throw carrying `null`/`undefined` makes
the handler throw a `TypeError`; from the synchronous branch that escapes the
listener as an uncaught exception, and from the `.catch(...)` branch it becomes
an unhandled rejection, fatal by default on Node 25 — i.e. the same process-kill
outcome CR-01 existed to prevent, reached through the fix itself. Likelihood is
low (it needs a non-object thrown value) which is why this is Info, not a
Warning. Separately, interpolating `error.message` puts filesystem paths and
internal failure text into the response body; for a localhost-only tool that is
acceptable, but the console is the better destination.

**Fix:**

```js
function respond500(res, error) {
  console.error('curate: request failed —', error);
  if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end(`Internal Server Error: ${error?.message ?? String(error)}`);
}
```

#### IN-14: the `UNSCANNED_EXTENSIONS` test passes for an empty list and for an expanded one

**File:** `scripts/lib/curation-guard.test.mjs:159-167`

**Issue:** the assertions are one `toContain('.json')` plus six `not.toContain`
checks for extensions nobody would add. They pass unchanged if a future edit
appends `.png`, `.svg`, `.woff2` or `.wasm` — which is precisely the collateral
widening the module's own docblock argues against, and the erosion path back
toward CR-02.

**Fix:** `expect(UNSCANNED_EXTENSIONS).toEqual(['.json']);` — one assertion that
pins both membership and length.

#### IN-15: `scanExtension`'s parameter is named for a path but is called with a bare name, and a file literally named `.json` is exempt

**File:** `scripts/lib/curation-guard.mjs:65-69, 116`

**Issue:** the helper declares `function scanExtension(entryPath)` and is called
`scanExtension(entry.name)`. The call is the correct one — passing the full path
would let a dotted *directory* name in the ancestry (`/tmp/build.v2/overlay`)
produce a bogus extension — but the parameter name documents the dangerous form
as the intended one. Related dotfile edge, confirmed by probe: a file named
exactly `.json` has `lastIndexOf('.') === 0`, yielding ext `.json`, so it is
skipped entirely.

```
D dotfile named ".json" containing the marker -> []
```

**Fix:** rename the parameter to `entryName`, and derive the extension only from
a name with a non-zero dot index (`const lastDot = name.lastIndexOf('.'); if (lastDot <= 0) return null;`).
WR-15's path-scoped exemption removes this edge entirely.

#### IN-16: the D-09 "never invoke git" test matches only a single-quoted literal

**File:** `scripts/curate-server.test.mjs:418-420`

**Issue:** `nonCommentLines.some((line) => line.includes("'git'"))` fails open
for `spawn("git", …)`, for a backtick literal, and for any computed argument.
D-09 (no code path may invoke `git`, because a commit reaching origin triggers
a full rebuild and deploy) is one of the phase's load-bearing constraints, and
its only automated guard is a single-quote string match. The comment-stripping
filter is also line-start-anchored, so a trailing `// 'git'` comment would
false-positive — the harmless direction, but it shows the matcher is textual
rather than structural.

**Fix:** assert on the spawn arguments instead of the quoting style, e.g.
`expect(nonCommentLines.some((l) => /spawn\(\s*['"\`]git/.test(l))).toBe(false)`
plus `expect(SOURCE).not.toMatch(/child_process[\s\S]{0,200}git/)`.

### Previously-raised findings still present in these files (no new IDs)

Re-confirmed as unfixed while reading the current source; listed so the wave-7
counts are not mistaken for a clean bill on the whole file:

- **WR-02** — `readJsonBody` still calls `req.destroy()` before the caller can
  write the 413 (`curate-server.mjs:409-413` → `464-466`).
- **WR-08** — `/__curate/recompute` still has no concurrency guard, no
  `req.on('close')` abort handling and no `child.kill()`; two presses still
  spawn two concurrent `compute-best-efforts` writers over the same outputs.
- **WR-12** — `fileParallelism: false` narrows but does not remove the
  shared-real-`dist/widgets` coupling; an interrupted run still leaves
  `dist/widgets/__curate` planted.
- **IN-02** (unreachable 405), **IN-11** (DELETE body never drained),
  **IN-12** (`.DS_Store` in the published tree — still 2 of them).

### Verified-Correct in Wave 7 (checked adversarially, no finding)

- **No bypass of the new static gate.** Every write route (`PUT`/`DELETE`
  exclusions, `POST` recompute) and now the static route call
  `isTrustedOrigin(req, EXPECTED_HOST)` first; the only ungated handlers are the
  two documented GETs (`/__curate/health`, `/__curate/overlay.js`), neither of
  which reads or writes state. `isCurateRoute` does *not* decode while
  `safeResolve` does, and I checked both directions: an encoded
  `/%5F%5Fcurate/...` misses the curate branch and is then rejected by
  `safeResolve` as outside the mount, and no `/strava-widgets/...` path can
  reach the curate branch.
- **Legitimate loads are not broken.** A normal navigation sends a matching
  `Host` and no `Origin` → allowed; a same-origin non-safe fetch sends
  `Origin: http://127.0.0.1:4173` → allowed; `Origin: null` and a malformed
  Origin both fail closed. Confirmed live by the suite's case 5 control (200)
  against cases 3 and 4 (403).
- **The exclusions read-modify-write cannot interleave.**
  `persistExclusions(applyUpsert(readExclusionsFile(), …))` is a single
  synchronous block placed after the handler's only `await`, so two concurrent
  PUTs cannot lose an update on Node's single-threaded loop — the atomic
  `renameSync` is belt to that braces.
- **Response-lifecycle robustness probed, not assumed.** On Node v25.2.1 a
  `res.write()` after a client abort and a `res.write()`/`res.end(chunk)` after
  the response has finished all return without crashing the process; I probed
  all three rather than inferring, and dropped a suspected crash class as a
  result.
- **latin1 is the right read encoding.** The real tree contains two `.DS_Store`
  binaries which the inverted scan now reads; they decode without throwing and
  the ASCII marker match is unaffected.
- **Symlink cycles cannot make `walk()` recurse forever** — `Dirent.isDirectory()`
  is false for symlinks, so the walker never follows one (it reads it instead;
  see WR-14).
- **`.curate-dist/` is gitignored**, so the overlay bundle cannot be committed to
  the public repo; the guard's file-name check for a stray copy inside
  `dist/widgets` is complementary, not redundant.
- **WR-05's fix has real test coverage of both directions** — including the R19
  mirror image (a loaded-and-empty index overriding a stale `true` precomputed
  flag) and an explicit over-suppression control, not just the happy path.

---

_Wave 7 reviewed: 2026-09-02T10:57:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
