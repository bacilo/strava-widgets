---
phase: 24-local-curation-mode
reviewed: 2026-09-01T20:37:28Z
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
  warning: 13
  info: 12
  total: 27
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
