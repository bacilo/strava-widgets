# Phase 29: Curation Review Queue - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 14 (5 new, 9 modified)
**Analogs found:** 14 / 14

**No UI-SPEC.md exists for this phase.** Per the orchestrator's instruction, the queue page/client
pattern assignments below are made concrete enough (imports, DOM idiom, class names, styling
discipline) to stand in for a design contract — sourced from Phase 24's curate overlay, which is
the only prior art for a curate-served surface in this codebase.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/curate-queue/index.ts` (NEW) | component (page controller) | request-response + event-driven | `scripts/curate-overlay/index.ts` + `scripts/curate-overlay/exclusion-panel.ts` | exact (same subsystem, same author intent) |
| `scripts/curate-queue/derive-flagged.mjs` (NEW) | utility (pure transform) | transform | `scripts/compute-pr-ceiling-recount.mjs`'s `recountDemoted` | exact (same input shape, same null-safety idiom) |
| `scripts/curate-queue/derive-flagged.test.mjs` (NEW) | test | — | `scripts/compute-pr-ceiling-recount.test.mjs` (behavioral unit style) | role-match |
| `scripts/curate-queue.test.mjs` (NEW) | test (source-structure guard) | — | `scripts/curate-overlay.test.mjs` | exact |
| `scripts/curate-server.mjs` (MODIFIED — 2 new GET routes, `buildQueueBundle`, startup log) | route/server dispatcher | request-response | itself — extend `serveCurateRoute`, mirror `injectOverlayTag`/`buildOverlay` | exact (self-extension) |
| `scripts/curate-overlay/index.ts` (MODIFIED — nav-link injection) | component | event-driven (DOMContentLoaded) | itself — mirrors its own existing `document.addEventListener` module-scope pattern | exact |
| `scripts/lib/curation-guard.mjs` (MODIFIED — IN-17 fix) | utility (guard/scanner) | transform | itself — `findCurationArtifacts`'s directory/file name-check block | exact (self-fix) |
| `scripts/lib/curation-guard.test.mjs` (MODIFIED — D-19 fixtures) | test | — | itself — existing planted-fixture `it(...)` blocks | exact |
| `scripts/compute-pr-ceiling-recount.mjs` (MODIFIED — new `recountDemotedActivities`) | utility (CLI/recount) | batch/transform | itself — `recountDemoted` | exact (self-extension) |
| `scripts/compute-pr-ceiling-recount.test.mjs` (MODIFIED) | test | — | itself — existing `recountDemoted` test blocks | exact |
| `scripts/verify-dashboard-publish.mjs` (MODIFIED — 2 new `expect404` lines) | CLI/verification script | request-response (HTTP probe) | itself — existing literal `/__curate/...` `expect404` list | exact |
| `scripts/verify-dashboard-publish-guard.test.mjs` (MODIFIED — D-19 fixtures) | test (subprocess/integration) | — | itself — existing Case B/C/D planted-fixture blocks | exact |
| `src/dashboard/curation-seam.test.ts` (MODIFIED — IN-18 fix) | test | — | itself — the regex-shape pin already used two describe-blocks below the literal pin | exact |
| Queue HTML shell (generation approach, Claude's discretion) | route/server (HTML patch) | request-response | `scripts/curate-server.mjs`'s `injectOverlayTag` | exact (pattern to mirror, not a file to copy verbatim) |

## Pattern Assignments

### `scripts/curate-queue/index.ts` (NEW) — component, request-response + event-driven

**Analogs:** `scripts/curate-overlay/index.ts` (transport + module docblock convention) and
`scripts/curate-overlay/exclusion-panel.ts` (per-row two-step-commit control, DOM-building idiom).
D-10 requires the transport be imported, never reimplemented, so this file's `saveExclusion` /
`removeExclusion` / `runRecompute` calls must be literal imports from the built overlay module —
not new fetches.

**Imports pattern to copy** (`scripts/curate-overlay/exclusion-panel.ts:22`):
```typescript
import { removeExclusion, runRecompute, saveExclusion } from './index.js';
```
For the queue client, the equivalent import is from the overlay's own module
(`scripts/curate-overlay/index.ts` exports `saveExclusion`/`removeExclusion`/`runRecompute` at
lines 89, 106, 123) — reachable via a relative import (`'../curate-overlay/index.js'`) since
esbuild resolves the sibling `.ts` directly, per RESEARCH's Recommended Project Structure.

**Never-throw / degrade pattern to copy** (`scripts/curate-overlay/exclusion-panel.ts:43-70`,
`loadExclusionState`):
```typescript
async function loadExclusionState(activityId: string): Promise<ExclusionState> {
  const notExcluded: ExclusionState = { excluded: false, reason: '' };
  if (activityId === '__proto__') {
    return notExcluded;
  }
  try {
    const response = await fetch('/strava-widgets/data/best-effort-exclusions.json');
    if (!response.ok) {
      return notExcluded;
    }
    const body = (await response.json()) as ExclusionsFile;
    const exclusions = Array.isArray(body.exclusions) ? body.exclusions : [];
    for (const entry of exclusions) {
      if (
        entry !== null &&
        typeof entry === 'object' &&
        (entry as { activityId?: unknown }).activityId === activityId &&
        typeof (entry as { reason?: unknown }).reason === 'string'
      ) {
        return { excluded: true, reason: (entry as { reason: string }).reason };
      }
    }
    return notExcluded;
  } catch (error) {
    console.error(error);
    return notExcluded;
  }
}
```
This is the exact shape to reuse for both of the queue's own reads (`best-efforts.json` and
`best-effort-exclusions.json`, D-08) — malformed shape or a failed fetch degrades to an empty
result set, never throws, matching `loadExclusionReason`'s discipline the CONTEXT and RESEARCH
both cite.

**Per-row two-step-commit control to copy** (`scripts/curate-overlay/exclusion-panel.ts:78-208`,
`mountCurationControls`): the checkbox → reveal textarea+Save → confirm-before-remove →
`location.reload()`-on-success shape is the row control D-10/D-15 describe. Copy this function's
structure per queue row (one `mountCurationControls`-shaped call per activity), with the pre-fill
difference (D-11: textarea starts non-empty with the joined demotion reason instead of empty).
Key excerpt — the "not excluded" reveal / confirm-before-destructive-untick idiom (lines 117-154):
```typescript
function applyVisibility(excluded: boolean): void {
  reasonLabel.hidden = !excluded;
  textarea.hidden = !excluded;
  saveButton.hidden = !excluded;
  removeButton.hidden = !excluded;
}
...
checkbox.addEventListener('change', () => {
  if (!checkbox.checked && currentlyExcluded) {
    const confirmed = window.confirm(
      'Removing this exclusion deletes it and changes PR history. Continue?'
    );
    if (!confirmed) {
      checkbox.checked = true;
      return;
    }
    void doRemove();
    return;
  }
  applyVisibility(checkbox.checked);
});
```

**Zero-styling / no-HTML-strings discipline** (docblock, `exclusion-panel.ts:1-20`): only the
wrapping container may receive a `className`; every interactive element (`input`/`textarea`/
`button`) gets none. DOM is `document.createElement` + `textContent` + `appendChild` only — never
`innerHTML`. The queue client must follow this exactly (D-09, and the Security Domain's XSS note in
RESEARCH.md — activity name and demotion reason text are untrusted-for-HTML values).

**Date/pace/duration formatters — write local copies, do not import `src/dashboard/*`** (Pattern 3
in RESEARCH.md, confirmed no `scripts/` file imports from `src/` today). Copy the *behavior*, not
the import, from `src/dashboard/views/list.ts`:
```typescript
// src/dashboard/views/list.ts:100-106 — formatPace
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null) return '—';
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}
```
```typescript
// src/dashboard/views/list.ts:128-138 — formatEffortDuration (use this one for effort rows,
// not formatDurationHms — it omits the leading "0:" hour component, correct for sub-hour PRs)
export function formatEffortDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```
```typescript
// src/dashboard/views/list.ts:65-71 — formatActivityDate (UTC-component reads, not
// browser-local — copy the getUTC* idiom exactly, it is deliberate, see WR-02 in that file)
export function formatActivityDate(isoLocal: string): string {
  if (typeof isoLocal !== 'string') return '—';
  const normalized = isoLocal.endsWith('Z') ? isoLocal : `${isoLocal}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
```
`MONTH_NAMES` is a local const in `list.ts`; copy the 12-entry array too, or inline
`toLocaleString('en-US', { month: 'short', ... })` equivalent — RESEARCH.md's Pattern 3 explicitly
recommends duplicating rather than importing.

**Detail-link href — one-line local helper, not an import of `row-navigation.ts`**
(`src/dashboard/row-navigation.ts:78-85` is the analog to read, not to import — its
`activityDetailHref` returns a bare `#/activity/<id>` hash, correct only for same-page dashboard
links; the queue is served from a different path (`/__curate/queue`), so D-12 requires the full
`/strava-widgets/#/activity/<id>` form):
```typescript
// src/dashboard/row-navigation.ts:78-85 (READ for the pattern, do not import)
export function activityDetailPath(activityId: string): string {
  return `/activity/${activityId}`;
}
export function activityDetailHref(activityId: string): string {
  return '#' + activityDetailPath(activityId);
}
```
```typescript
// New, local to scripts/curate-queue/ (RESEARCH.md Pattern 3's own example)
function activityDetailUrl(activityId: string): string {
  return `/strava-widgets/#/activity/${activityId}`;
}
```

**Nav-link injection (D-07)** — belongs in `scripts/curate-overlay/index.ts`, not the queue client
itself, since D-07 says the overlay injects the link (the overlay already loads on every curate
page). Add near the top of the existing module, following the file's own existing module-scope
listener convention (compare the existing `document.addEventListener('dashboard:best-efforts-mounted', ...)`
block at `scripts/curate-overlay/index.ts:41-61`):
```typescript
// New sibling listener, added near the top of scripts/curate-overlay/index.ts,
// verified-safe ordering per RESEARCH.md Architecture Pattern 2 (main.ts's
// createNav() runs synchronously before DOMContentLoaded fires)
document.addEventListener('DOMContentLoaded', () => {
  const linksList = document.querySelector('#app-nav-root .app-nav__links');
  if (!linksList) return; // never-throw, mirrors loadExclusionState's discipline
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'app-nav__link';
  link.href = '/__curate/queue';
  link.textContent = 'Review queue';
  li.appendChild(link);
  linksList.appendChild(li);
});
```
Confirmed against the real nav markup, `src/dashboard/nav.ts:152-161`:
```typescript
const linksEl = document.createElement('ul');
linksEl.className = 'app-nav__links';
...
const li = document.createElement('li');
...
link.className = 'app-nav__link';
```
The selector and class names above (`#app-nav-root`, `.app-nav__links`, `.app-nav__link`) are
copied verbatim from this real markup, not invented.

---

### `scripts/curate-queue/derive-flagged.mjs` (NEW) — utility, transform

**Analog:** `scripts/compute-pr-ceiling-recount.mjs`'s `recountDemoted` (lines 128-241) — same
input document shape (`bestEffortsDoc.activities: Record<string, ActivityBestEfforts>`), same
null-safety idiom, same "activityId is an object key, not an array field" access pattern.

**Critical: write this as `.mjs` + JSDoc, NOT `.ts`.** `vitest.config.ts`'s `include` glob is
`['src/**/*.test.ts', 'scripts/**/*.test.mjs']` — a `scripts/curate-queue/derive-flagged.test.ts`
file matches neither glob and is silently never collected (RESEARCH.md Pitfall 1, HIGH confidence,
verified this session by reading `vitest.config.ts` directly). `scripts/curate-overlay/*.ts` is
only ever tested via a sibling `.mjs` that reads it as raw text (`scripts/curate-overlay.test.mjs`)
— never imported and executed — which is precisely the trap to avoid here, where the derivation
function's *behavior* (not just its source text) must be asserted.

**Null-safety pattern to copy** (`scripts/compute-pr-ceiling-recount.mjs:128-153`):
```javascript
export function recountDemoted(bestEffortsDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};
  ...
  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    for (const effort of efforts) {
      const demotion = effort.demotion;
      if (!demotion || typeof demotion !== 'object' || typeof demotion.guard !== 'string') continue;
      ...
    }
  }
```
`deriveFlaggedActivities(bestEffortsDoc, exclusionsDoc)` should mirror this exact defensive shape:
default `activities` to `{}`, default `efforts` to `[]`, treat a non-object/malformed `demotion` as
absent (never throw), and read `exclusionsDoc.exclusions` with the same `Array.isArray` guard used
in `loadExclusionState` above.

**Data contract this function reads** (`src/analytics/best-effort.types.ts:90-167`):
```typescript
export interface EffortDemotion {
  guard: EffortDemotionGuard; // 'world-record' | 'max-speed' | 'ceiling'
  reason: string;
}
export interface ComputedEffort {
  distance: TargetDistanceKey;
  durationSec: number;
  paceSecPerKm: number;
  demotion: EffortDemotion | null; // D-01: any non-null value qualifies, all three guards
}
export interface ActivityBestEfforts {
  activityId: string;
  startDate: string;
  efforts: BestEffort[]; // BestEffort extends ComputedEffort
  excludedFromRecords: boolean;
}
```
Note (Open Question 1 in RESEARCH.md): `ActivityBestEfforts` has no `name` field — D-12's "activity
name" requirement needs a third fetch of `data/dashboard/index.json`, which is a planner-level
decision to surface explicitly, not a pattern-mapping concern, but the analog file for that shape is
`data/dashboard/index.json`'s own `activities[]` rows (has `name`, `id`/`activityId`, confirmed by
RESEARCH.md's live-archive read).

**Ordering (D-05: not-yet-excluded first, then newest-first within each group)** — no existing
analog produces exactly this two-key sort in this codebase; write it as a plain `.sort()` comparator
following the same "pure function, given two already-parsed documents, returns an array" shape as
`recountDemoted`'s return value.

---

### `scripts/curate-queue/derive-flagged.test.mjs` (NEW) — test

**Analog:** `scripts/compute-pr-ceiling-recount.test.mjs` — a real behavioral unit-test file (not a
source-text guard) exercising a pure function against constructed fixture documents. Follow its
`describe`/`it` structure and its practice of asserting against small, hand-built
`bestEffortsDoc`-shaped objects plus (separately) a check against the live archive counts, always
re-derived, never hardcoded (per RESEARCH.md's Metadata note on the 47/65/12 figures).

**Canary-first discipline (RESEARCH.md Pitfall 1):** the first task that creates this file must
include a trivial canary assertion and verify `npx vitest run scripts/curate-queue/derive-flagged.test.mjs`
reports "1 test file" collected, BEFORE adding real assertions — this project has twice shipped a
guard that stayed green while proving nothing (R3-CR-01, WR-06).

---

### `scripts/curate-queue.test.mjs` (NEW) — test, source-structure guard

**Analog:** `scripts/curate-overlay.test.mjs` (full file, 157 lines) — this is the exact pattern to
mirror for a DOM-building `.ts` client that vitest's `environment: 'node'` cannot execute.

**Comment-stripping helper to copy** (`scripts/curate-overlay.test.mjs:19-27`):
```javascript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

const INDEX_RAW = readFileSync(new URL('./curate-overlay/index.ts', import.meta.url), 'utf8');
```

**Assertions to mirror for the queue client** (`scripts/curate-overlay.test.mjs:38-138`), adapted:
- "imports `saveExclusion`/`removeExclusion`/`runRecompute` rather than reimplementing them" (mirror
  the `D-03/OD-1 — not a second renderer` describe block's forbidden-string list approach, lines
  38-49, but check for a **required** import string instead of a forbidden one)
- "zero CSS shipped" (`OD-3` block, lines 105-117) — same three forbidden strings: `.css`,
  `"createElement('style')"`, `'innerHTML'`
- "root-absolute curate paths" (`D-02` block, lines 119-128) — same `fetch('__curate` /
  `` fetch(`__curate `` negative checks
- "calls `location.reload()`" (line 46-48)

---

### `scripts/curate-server.mjs` (MODIFIED) — route/server, request-response

**Analog:** itself. Extend `serveCurateRoute` (lines 583-618) with two new `GET` branches, following
the exact shape of the existing `/__curate/health` and `/__curate/overlay.js` branches:
```javascript
// scripts/curate-server.mjs:583-601 (existing shape to mirror)
async function serveCurateRoute(req, res) {
  const urlPath = (req.url ?? '/').split('?')[0];

  if (req.method === 'GET' && urlPath === `${CURATE_PREFIX}/health`) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'GET' && urlPath === `${CURATE_PREFIX}/overlay.js`) {
    if (!existsSync(OVERLAY_OUTFILE)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(readFileSync(OVERLAY_OUTFILE));
    return;
  }
  ...
```
Add `GET ${CURATE_PREFIX}/queue` and `GET ${CURATE_PREFIX}/queue.js` branches in the same
if-return style, matching the two-route pattern the RESEARCH.md Code Examples section already
drafted.

**HTML-patch-at-request-time pattern to copy** (`injectOverlayTag`, lines 183-193):
```javascript
export function injectOverlayTag(html) {
  const scriptTag = `<script src="${CURATE_PREFIX}/overlay.js"></script>`;
  if (html.includes(scriptTag)) {
    return html;
  }
  const lastBodyClose = html.lastIndexOf('</body>');
  if (lastBodyClose === -1) {
    return html;
  }
  return html.slice(0, lastBodyClose) + scriptTag + html.slice(lastBodyClose);
}
```
A new sibling pure function (e.g. `extractStylesheetHref(html)`) must use this exact idempotent,
never-throw shape — regex-match the real `<link rel="stylesheet">` href out of the live
`dist/widgets/index.html` at request time, never a hardcoded path (RESEARCH.md Pitfall 2: the CSS
filename is content-hashed, e.g. `assets/index-CQkdBpPg.css`, and changes on every build).

**Esbuild bundling pattern to copy** (`buildOverlay`, lines 207-216):
```javascript
export async function buildOverlay() {
  await esbuild.build({
    entryPoints: [OVERLAY_ENTRY],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: OVERLAY_OUTFILE,
    logLevel: 'info',
  });
}
```
A new `buildQueueBundle()` mirrors this exactly with `OVERLAY_ENTRY`/`OVERLAY_OUTFILE` swapped for
new `QUEUE_ENTRY`/`QUEUE_OUTFILE` constants (declared alongside the existing ones at lines 62-63),
and `main()` (line 709-711) calls both:
```javascript
export async function main() {
  assertBuilt();
  await buildOverlay();
  // + await buildQueueBundle();  (new)
```

**Origin gate — apply to the new GET routes too.** `serveCurateRoute` itself does NOT call
`isTrustedOrigin` per-branch today (the write routes do, inside `handleExclusionWrite` at line 440
and `handleRecompute`); RESEARCH.md's Security Domain table flags this explicitly: "must not be
skipped 'because it's just a GET'" — the two new GET routes need the same gate the static route
already applies (`serveStaticRoute`, lines 636-643):
```javascript
export function isTrustedOrigin(req, expectedHost) {
  if (req.headers.host !== expectedHost) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
```

**Startup log pattern to extend** (lines 729-732):
```javascript
server.listen(CURATE_PORT, CURATE_HOST, () => {
  console.log(`curate server running at http://${CURATE_HOST}:${CURATE_PORT}${MOUNT_PREFIX}/`);
  console.log('Save writes the working tree only — curate never touches git (D-09).');
});
```
D-07 requires the queue URL be printed alongside the dashboard URL — add one more `console.log`
line here with `http://${CURATE_HOST}:${CURATE_PORT}${CURATE_PREFIX}/queue`.

---

### `scripts/lib/curation-guard.mjs` (MODIFIED — IN-17 fix)

**Analog:** itself — the double-violation site is `findCurationArtifacts`'s file-name-check block,
lines 124-144:
```javascript
if (entry.name === CURATE_DIR_NAME) {
  violations.push({
    path: entryPath,
    reason: `a file named "${CURATE_DIR_NAME}" must never exist under the published bundle`,
  });
}

if (entry.name === '.curate-dist') {
  violations.push({
    path: entryPath,
    reason: 'a file named ".curate-dist" (the curate overlay\'s esbuild output) must never exist under the published bundle',
  });
}
```
Neither `if` has a `continue`/`return`, so execution falls through to the content-scan block below
(lines 162-190) for the SAME entry. A file literally named `.curate-dist` whose extension
(`scanExtension` finds `lastIndexOf('.')` at index 0, so the "extension" is the whole filename) is
not in `UNSCANNED_EXTENSIONS`, so the content scan runs too — if that file's content also contains
the `__curate` marker (true for any esbuild bundle importing from `curate-overlay/`), TWO violation
entries are produced for ONE path: the name-match violation and the content-match violation. This
is exactly the shape D-19's new queue-bundle-shaped fixture will trigger (RESEARCH.md Pitfall 3),
so IN-17 must land — a one-path-one-violation invariant — before or alongside that fixture, per the
folded-todo note in `29-CONTEXT.md`.

---

### `scripts/lib/curation-guard.test.mjs` (MODIFIED — D-19 fixtures)

**Analog:** itself — the existing planted-fixture pattern, e.g. lines 101-108 (`.curate-dist`
directory case) and lines 84-91 (marker-in-`.js`-file case):
```javascript
it('planted .curate-dist directory inside the tree: non-empty', async () => {
  await writeFile('index.html', '<!doctype html>');
  await writeFile('.curate-dist/overlay.js', 'console.log("overlay");');

  const violations = findCurationArtifacts(tmpDir);
  expect(violations.length).toBeGreaterThan(0);
  expect(violations.some((v) => v.path.includes('.curate-dist'))).toBe(true);
});
```
New cases needed per D-19: plant a `queue.html`-shaped file and a `queue.js`-shaped bundle (content
containing the literal `__curate` marker, mirroring the existing `.js`-file case at lines 84-91)
inside the `beforeEach`-created `tmpDir`, assert `findCurationArtifacts` returns a violation for
each, then a clean-tree case returning `[]` (already covered generically by the existing "clean
tree" test at lines 57-68, but D-18 wants this proven specifically for the queue artifacts, not just
asserted by omission). Also add an explicit `violations.length === 1`-style assertion for whichever
IN-17 fixture is chosen, to pin the fix.

---

### `scripts/compute-pr-ceiling-recount.mjs` (MODIFIED — new `recountDemotedActivities`)

**Analog:** itself — `recountDemoted` (lines 128-241) is the direct template; a new function must
be added that deduplicates by `activityId` instead of counting per-effort:
```javascript
// scripts/compute-pr-ceiling-recount.mjs:128-153 (existing, effort-level — do not modify)
export function recountDemoted(bestEffortsDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};
  ...
  for (const activityId of Object.keys(activities)) {
    const activity = activities[activityId];
    const efforts = activity && Array.isArray(activity.efforts) ? activity.efforts : [];
    for (const effort of efforts) {
      const demotion = effort.demotion;
      if (!demotion || typeof demotion !== 'object' || typeof demotion.guard !== 'string') continue;
      ownDemotedTotal += 1;
      ...
```
New sibling function (D-16 requirement — the recount currently has no activity-level count; RESEARCH.md
verified `byDistance['400m']` reads 47 today only by archive-state coincidence, not by structural
guarantee):
```javascript
export function recountDemotedActivities(bestEffortsDoc) {
  const activities =
    bestEffortsDoc && bestEffortsDoc.activities && typeof bestEffortsDoc.activities === 'object'
      ? bestEffortsDoc.activities
      : {};
  let flaggedCount = 0;
  for (const activityId of Object.keys(activities)) {
    const efforts = Array.isArray(activities[activityId].efforts) ? activities[activityId].efforts : [];
    if (efforts.some((e) => e.demotion && typeof e.demotion === 'object')) flaggedCount += 1;
  }
  return { flaggedActivityCount: flaggedCount };
}
```
Wire it into `main()`'s console output (mirror lines 628-636's existing `console.log` calls for
`recountDemoted`'s output) and `evaluateReport`'s pass/fail checks (mirror the existing
`--expect-demoted`/`--expect-cohort` flag pattern at lines 458-460, 536-550) as a new
`--expect-flagged-activities` flag, per D-16's explicit instruction.

---

### `scripts/compute-pr-ceiling-recount.test.mjs` (MODIFIED)

**Analog:** itself — existing `recountDemoted` test blocks (behavioral, hand-built fixture docs).
Add a parallel `describe('recountDemotedActivities', ...)` block using the same fixture-construction
style, asserting deduplication (an activity with multiple demoted efforts counts once) and the
same null-safety cases (`null`, `{}`, missing `activities`) `recountDemoted`'s own tests already
cover.

---

### `scripts/verify-dashboard-publish.mjs` (MODIFIED — 2 new `expect404` lines)

**Analog:** itself — `expect404` helper (lines 229-236) and the existing three-line literal list
(lines 403-409):
```javascript
async function expect404(baseUrl, path, reason) {
  const { status } = await get(`${baseUrl}${path}`);
  if (status !== 404) {
    fail(`GET ${path} expected 404 (${reason}), got ${status}`);
    return;
  }
  ok(`GET ${path} -> 404 (expected, ${reason})`);
}
```
```javascript
// scripts/verify-dashboard-publish.mjs:394-409 — the comment this file's own convention forbids
// widening (never a prefix match); D-17 extends this exact list, does not replace its shape
await expect404(baseUrl, '/__curate/health', 'the curate health probe must never be published');
await expect404(baseUrl, '/__curate/overlay.js', 'the curate overlay bundle must never be published');
await expect404(baseUrl, '/__curate/exclusions/3475726256', 'the curate write endpoint must never be published');
// NEW (D-17):
await expect404(baseUrl, '/__curate/queue', 'the curate review queue page must never be published');
await expect404(baseUrl, '/__curate/queue.js', 'the curate review queue bundle must never be published');
```

---

### `scripts/verify-dashboard-publish-guard.test.mjs` (MODIFIED — D-19 fixtures)

**Analog:** itself (full file, 120 lines) — Cases B/C/D (lines 72-115) are the exact template for a
new "Case E (planted queue page)" and "Case F (planted queue bundle)":
```javascript
it('Case B (planted overlay bundle): the real, shipped verifier exits non-zero and names the overlay path', () => {
  mkdirSync(CURATE_DIR, { recursive: true });
  writeFileSync(resolve(CURATE_DIR, 'overlay.js'), 'console.log("__curate overlay leaked");', 'utf8');

  let result;
  try {
    result = runVerifier();
  } finally {
    cleanupCurateDir();
  }

  expect(result.status).not.toBe(0);
  expect(result.output).toContain('GET /__curate/overlay.js expected 404');
});
```
New cases plant `queue` and `queue.js` under `CURATE_DIR` (`dist/widgets/__curate`) the same way,
and assert on `'GET /__curate/queue expected 404'` / `'GET /__curate/queue.js expected 404'`. Case A
(clean, lines 61-70) must also be extended to assert the two new `✓ GET ... -> 404` success lines
appear in the same clean run, alongside the existing three.

---

### `src/dashboard/curation-seam.test.ts` (MODIFIED — IN-18 fix)

**Analog:** itself — the file already contains BOTH the brittle literal pin (to fix) and the correct
regex-shape pin (to convert toward), a few lines apart:
```typescript
// src/dashboard/curation-seam.test.ts:153-160 — WR-17's brittle literal pin (IN-18 target)
it('detail.ts contains exactly one buildPrBadgeLabels( call site, in the literal two-argument form', () => {
  expect(countOccurrences(detailStripped, 'buildPrBadgeLabels(')).toBe(1);
  expect(detailStripped).toContain('buildPrBadgeLabels(bestEffortsEntry, liveExclusions)');
});

it('detail.ts pins buildBestEffortsPanelRows to the literal three-argument form, not merely to three arguments', () => {
  expect(detailStripped).toContain('buildBestEffortsPanelRows(bestEffortsEntry, ageGrading, liveExclusions)');
});
```
```typescript
// src/dashboard/curation-seam.test.ts:162-190 — the companion regex-shape pin (the target shape)
const badgeMatch = fnBody.match(
  /buildPrBadgeLabels\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)/
);
const panelMatch = fnBody.match(
  /buildBestEffortsPanelRows\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)/
);
```
IN-18 converts the two `toContain` literal-string assertions (lines 153-160) into the same
regex-match-and-compare shape already used at lines 162-190 — a reflowed multi-line call would
currently fail only the literal check while the regex check (which already exists two blocks
below, asserting the two calls share matching argument identifiers) would still pass, which is the
inconsistency this todo fixes.

---

## Shared Patterns

### Origin/Host trust gate (V4 Access Control)
**Source:** `scripts/curate-server.mjs:346-355` (`isTrustedOrigin`)
**Apply to:** the two new `GET` routes in `serveCurateRoute` — every curate route, including a
"harmless" `GET`, must apply this gate (DNS-rebinding is Host-header-based and route-agnostic; the
existing static route was retrofitted with this exact gate for the same reason, see the GAP-24-03
comment at lines 620-634).
```javascript
export function isTrustedOrigin(req, expectedHost) {
  if (req.headers.host !== expectedHost) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
```

### Never-throw / degrade-to-empty on malformed JSON
**Source:** `scripts/curate-overlay/exclusion-panel.ts:43-70` (`loadExclusionState`)
**Apply to:** the queue client's two reads of `best-efforts.json` / `best-effort-exclusions.json`,
and `derive-flagged.mjs`'s handling of a missing/malformed document — never throw, degrade to an
empty flagged set, matching `loadExclusionReason`'s discipline at `detail.ts:463` (cited in both
CONTEXT.md and RESEARCH.md as the house precedent for empty/degenerate states).

### Atomic write / mirror (unchanged — reused only)
**Source:** `scripts/curate-server.mjs:293-297` (`writeAtomic`), `308-...` (`mirrorExclusions`)
**Apply to:** nothing new writes through this phase — CUR-02 requires the queue's Save/Remove to go
through the EXISTING `PUT`/`DELETE /__curate/exclusions/:id` handlers unmodified. This pattern is
listed only so the planner recognizes it must NOT be touched or duplicated.

### Reload-after-write (OD-1)
**Source:** `scripts/curate-overlay/index.ts:89-99, 106-114` (`saveExclusion`, `removeExclusion`)
**Apply to:** the queue client inherits this for free by importing these functions rather than
reimplementing — no new reload logic needed, no state to preserve across the reload (D-14 rejected
a before/after delta for exactly this reason).

### Zero styling / no HTML-string assignment (OD-3)
**Source:** `scripts/curate-overlay/exclusion-panel.ts:1-20` (docblock), enforced by
`scripts/curate-overlay.test.mjs:105-117` (`OD-3 — zero CSS shipped` describe block)
**Apply to:** `scripts/curate-queue/index.ts` and its test guard — `createElement` + `textContent`
only; the queue page links the dashboard's built stylesheet (extracted at request time, see
`injectOverlayTag`'s pattern) rather than shipping any of its own.

### Content-scan / structural-absence guard (build-time half of CUR-03)
**Source:** `scripts/lib/curation-guard.mjs:76-196` (`findCurationArtifacts`)
**Apply to:** no code change needed for coverage (D-18 — the existing scan already catches the
queue page/bundle by content and by `.curate-dist` name-match); only the IN-17 fix and the D-19
fixture additions touch this file.

### Literal-path 404 assertions, never a prefix match (HTTP half of CUR-03)
**Source:** `scripts/verify-dashboard-publish.mjs:394-409` (comment + existing three-line list)
**Apply to:** the two new `expect404` lines (D-17) — the file's own docblock forbids widening these
into a prefix or wildcard match; this repo has already argued against that shape once in writing.

## No Analog Found

None. Every file in this phase's scope has at least a role-match analog inside the exact subsystem
(Phase 24's curate machinery) or the exact sibling script (compute-pr-ceiling-recount.mjs,
verify-dashboard-publish.mjs, curation-guard.mjs) it extends — this phase is, per RESEARCH.md's own
framing, "composition, not invention."

## Metadata

**Analog search scope:** `scripts/curate-server.mjs`, `scripts/curate-overlay/`,
`scripts/lib/curation-guard.mjs`, `scripts/compute-pr-ceiling-recount.mjs`,
`scripts/verify-dashboard-publish.mjs`, their sibling `*.test.mjs` files,
`src/dashboard/curation-seam.test.ts`, `src/dashboard/main.ts`, `src/dashboard/nav.ts`,
`src/dashboard/views/list.ts`, `src/dashboard/row-navigation.ts`,
`src/analytics/best-effort.types.ts`, `scripts/lib/copy-data-tree.mjs`.
**Files scanned:** 17 read directly this session (line-numbered excerpts above are from live reads,
not carried over from RESEARCH.md's own citations, though they corroborate each other).
**Pattern extraction date:** 2026-09-17
