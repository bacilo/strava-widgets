# Phase 24: Local Curation Mode - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 12 (7 new source/config, 4 new test, 1 new dir + 8 modified)
**Analogs found:** 10 / 12 (2 have no direct analog — see § No Analog Found)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/curate-server.mjs` | server / controller | request-response + file-I/O | `scripts/verify-dashboard-publish.mjs` | exact (static-serve half); role-match (write half, no analog) |
| `scripts/lib/curation-guard.mjs` | utility | transform (scan → violations list) | `assertNoPrivateArtifacts` in `scripts/build-widgets.mjs` (~171-206) | exact shape, extraction required |
| `scripts/lib/copy-data-tree.mjs` | utility | file-I/O (batch copy) | `copyJsonTree`/`dataDirs` in `scripts/build-widgets.mjs` (~138-254) | exact, extraction required |
| `scripts/curate-overlay/index.ts` (+ sibling modules, e.g. `exclusion-panel.ts`) | component (browser, no framework) | event-driven + request-response | `src/dashboard/views/detail-sections.ts` (DOM-building idiom) + `src/dashboard/views/detail.ts`'s `loadExclusionReason` (fetch idiom) | role-match (DOM building); exact (fetch idiom) |
| `scripts/lib/curation-guard.test.mjs` | test (unit, planted-fixture) | transform | `src/analytics/best-effort-exclusions.test.ts` (tmp-dir fixture pattern, ~74-95) | role-match |
| `scripts/verify-dashboard-publish-guard.test.mjs` | test (integration, subprocess) | request-response | none exact — see § No Analog Found | no analog |
| `src/dashboard/curation-seam.test.ts` | test (source-structure) | transform (text scan) | `src/dashboard/row-semantics.test.ts` / `row-navigation.test.ts` | exact |
| `scripts/build-widgets.mjs` (MODIFIED) | build script | batch | itself — see Pattern Assignments below for the exact insertion point | n/a (modification, not new) |
| `scripts/verify-dashboard-publish.mjs` (MODIFIED) | server / controller | request-response | itself — `expect404` calls at ~291-293 are the template for the new ones | n/a (modification, not new) |
| `src/dashboard/views/detail-sections.ts` (MODIFIED) | component | transform (DOM building) | itself — `list.ts:527`'s `tr.dataset.activityId` is the naming precedent for the new statement | exact |
| `src/dashboard/views/detail.ts` (MODIFIED) | component | event-driven | itself — the `requestToken`/`mountedContainer` guard already present at line 501 is the anchor point | exact |
| `vitest.config.ts` / `package.json` / `.gitignore` (MODIFIED) | config | n/a | itself | n/a (one-line edits, see Shared Patterns) |

## Pattern Assignments

### `scripts/curate-server.mjs` (server, request-response + file-I/O)

**Analog:** `scripts/verify-dashboard-publish.mjs` (full file read, 477 lines)

**FATAL missing-build block to copy verbatim** (lines 37-45):
```js
if (!existsSync(INDEX_HTML) || !existsSync(INDEX_JSON)) {
  console.error(
    'FATAL: dist/widgets is not fully built.\n' +
      `  Missing: ${!existsSync(INDEX_HTML) ? INDEX_HTML : INDEX_JSON}\n` +
      '  Run `npm run build-widgets` first (and `npm run compute-dashboard-index` ' +
      'if data/dashboard/index.json does not exist locally).'
  );
  process.exit(1);
}
```
Adjust the instruction text to name `npm run curate` per CONTEXT.md's discretion note.

**Prefix-mount + path-traversal-safe resolver to copy near-verbatim** (lines 49-80):
```js
const CONTENT_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

// The publish directory is mounted under a non-root prefix on purpose. GitHub
// Pages serves this repo as a *project* page at /strava-widgets/, never at a
// domain root. Serving dist/widgets at '/' here is what let the absolute-asset
// bug ship green at 15/15 ... Mounting under a prefix makes the local gate the
// same shape as production, so any absolute '/...' URL now fails here first.
const MOUNT_PREFIX = '/strava-widgets';

function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  if (decoded !== MOUNT_PREFIX && !decoded.startsWith(MOUNT_PREFIX + '/')) {
    return null;
  }
  const withinMount = decoded.slice(MOUNT_PREFIX.length);
  const relative =
    withinMount === '' || withinMount === '/' ? 'index.html' : withinMount.replace(/^\/+/, '');
  const resolved = resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + '/')) {
    // Path traversal outside dist/widgets — reject (T-16-VF-01).
    return null;
  }
  return resolved;
}
```
D-02 requires `/__curate/*` to be routed OUTSIDE this prefix mount — branch on `req.url` before calling `safeResolve` (`/__curate/...` handled by a separate branch; everything else falls through to `safeResolve`+static serve, exactly the existing `createServer` shape at lines 116-133).

**Request handler skeleton to extend** (lines 116-133):
```js
function createServer() {
  return http.createServer((req, res) => {
    const filePath = safeResolve(req.url ?? '/');
    if (filePath === null) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFileSync(filePath));
  });
}
```
For `curate-server.mjs`: when `filePath` resolves to `index.html`, string-patch the read buffer to inject `<script src="/__curate/overlay.js"></script>` before `</body>` rather than streaming it unmodified — this is a response-body patch, not a disk write (RESEARCH.md Architecture Pattern 1).

**Bind pattern (D-12) — the ONLY change from the analog's ephemeral-port form** (line 137, existing):
```js
server.listen(0, '127.0.0.1', () => { ... });
```
`curate-server.mjs` must use a **fixed** port (RESEARCH.md Open Question 3 recommends this) and MUST keep `'127.0.0.1'` literal — never `'0.0.0.0'`. `verify-dashboard-publish.mjs` already proves the binding call shape; only the port argument changes.

**`expect404` helper — the exact template D-10(b)'s new assertions reuse (in `verify-dashboard-publish.mjs`, not `curate-server.mjs`)** (lines 182-189):
```js
async function expect404(baseUrl, path, reason) {
  const { status } = await get(`${baseUrl}${path}`);
  if (status !== 404) {
    fail(`GET ${path} expected 404 (${reason}), got ${status}`);
    return;
  }
  ok(`GET ${path} -> 404 (expected, ${reason})`);
}
```

**Write handler — no analog in this repo** (server-side JSON mutation + atomic write). Use RESEARCH.md's Architecture Pattern 3 code block directly (`upsertExclusion`/`removeExclusion`/`writeAtomic`, lines 260-297 of 24-RESEARCH.md) — this repo has no existing atomic-write (`writeFileSync` + `renameSync`) precedent; every existing `writeFileSync` call site (`src/exports/consolidate.ts:220,261`, `scripts/convert-wma-tables.mjs:376-377`, `scripts/ci-setup-tokens.mjs:47`, `scripts/compute-route-data.mjs:83`, `scripts/refetch-missing-polylines.mjs:66,178`) writes directly with no temp-file/rename step. This is a genuinely new pattern for the repo — flagged for the planner, not something to "find" elsewhere.

**Origin/Host validation (D-12) — no analog in this repo.** Use RESEARCH.md's Architecture Pattern 4 code block directly (`isTrustedOrigin`, lines 305-323 of 24-RESEARCH.md). Extract as a pure, exported function so it is independently unit-testable per the Validation table's `isTrustedOrigin` unit-test row.

---

### `scripts/lib/curation-guard.mjs` (utility, transform)

**Analog:** `assertNoPrivateArtifacts` in `scripts/build-widgets.mjs` (lines 166-206)

```js
function assertNoPrivateArtifacts() {
  const publishDataDir = 'dist/widgets/data';
  if (!existsSync(publishDataDir)) return;

  if (existsSync(resolve(publishDataDir, 'private'))) {
    console.error(`✗ Private-artifact guard failed: ${publishDataDir}/private exists and must never be published.`);
    process.exit(1);
  }

  const forbiddenSubstrings = ['"birthDate"', '"restingHr"', '"sex"'];
  let scanned = 0;

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      scanned++;
      const content = readFileSync(entryPath, 'utf8');
      for (const needle of forbiddenSubstrings) {
        if (content.includes(needle)) {
          console.error(`✗ Private-artifact guard failed: ${entryPath} contains ${needle} — ...`);
          process.exit(1);
        }
      }
    }
  }

  walk(publishDataDir);
  console.log(`✓ Private-artifact scan: ${scanned} published JSON file${scanned === 1 ? '' : 's'} scanned, none contain identity/health fields.`);
}
```

**Critical deviation required (D-11's testability requirement):** the analog `process.exit(1)`s inline and scans only `dist/widgets/data`. `curation-guard.mjs`'s exported function must instead:
1. **Return** a violations array/list rather than call `process.exit` — the caller (`build-widgets.mjs`) does the exiting, exactly as CONTEXT.md's `<known_new_and_modified_files>` block specifies ("must RETURN violations rather than exit, with the exiting wrapper left at the call site").
2. **Scan the whole `dist/widgets` tree** (`.html`/`.js`/`.css`, not just `dist/widgets/data`) — RESEARCH.md Pitfall 1 explains why: a curation-artifact leak's real vector is the JS/HTML side (an accidental Vite/esbuild input, or a stray `copyFileSync`), which only exists after `buildDashboard()`/`buildPages()` run, not at `copyDataFiles()`'s call site where `assertNoPrivateArtifacts` fires today.

**Call-site correction — where `build-widgets.mjs` must call the new guard** (end of `buildAllWidgets()`, lines 334-353):
```js
async function buildAllWidgets() {
  console.log('Building widget library...\n');

  for (let i = 0; i < widgets.length; i++) {
    await buildWidget(widgets[i], i);
  }

  copyDataFiles();          // <-- assertNoPrivateArtifacts() fires INSIDE here (existing)

  await buildPages();
  await buildDashboard();   // <-- dist/widgets/index.html + assets are now fully populated

  // NEW: assertNoCurationArtifacts() must be called HERE — after buildDashboard(),
  // not inside copyDataFiles() — so it can see the whole dist/widgets tree.
  // This is the amendment to D-10's literal "same place as assertNoPrivateArtifacts"
  // wording, decided this session (24-CONTEXT.md known_new_and_modified_files note).

  console.log('\nWidget library build complete!');
  console.log('Output: dist/widgets/ (widgets, pages, and the dashboard SPA)');
}
```
`process.exit(1)` discipline: mirror `assertNoPrivateArtifacts`'s own console.error + `process.exit(1)` at the `build-widgets.mjs` call site (not inside the extracted pure function).

---

### `scripts/lib/copy-data-tree.mjs` (utility, file-I/O batch)

**Analog:** `copyJsonTree` + `dataDirs` in `scripts/build-widgets.mjs` (lines 138-254)

```js
function copyJsonTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  let copied = 0;
  let skipped = 0;

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = resolve(srcDir, entry.name);
    const destPath = resolve(destDir, entry.name);

    if (entry.isDirectory()) {
      const nested = copyJsonTree(srcPath, destPath);
      copied += nested.copied;
      skipped += nested.skipped;
      continue;
    }

    if (!entry.name.endsWith('.json')) continue;

    let shouldCopy = true;
    if (existsSync(destPath)) {
      const srcMtime = statSync(srcPath).mtimeMs;
      const destMtime = statSync(destPath).mtimeMs;
      if (destMtime >= srcMtime) shouldCopy = false;
    }
    if (shouldCopy) {
      copyFileSync(srcPath, destPath);
      copied++;
    } else {
      skipped++;
    }
  }

  return { copied, skipped };
}
```
Extract this function (no top-level side effects — it is already pure aside from the mtime-based skip optimization) plus the `dataDirs` constant's two entries the recompute step needs (`data/stats` → `dist/widgets/data/stats`, `data/dashboard` → `dist/widgets/data/dashboard`) into the new module. Both `build-widgets.mjs` and `curate-server.mjs` import from here. **Do not import `build-widgets.mjs` itself** — its last line is a self-executing `buildAllWidgets().catch(...)` (line 355) that would trigger a full 11-widget Vite rebuild as an import side effect (RESEARCH.md Pitfall 3 / Anti-Patterns).

---

### `scripts/verify-dashboard-publish.mjs` (MODIFIED — new `expect404` assertions)

**Analog:** the file's own existing private-artifact guards (lines 290-293), which the new guards sit beside:
```js
// Private athlete config must never be reachable over HTTP (T-18-PII-01).
await expect404(baseUrl, '/data/private/athlete-private.json', 'private athlete config must never be published');
await expect404(baseUrl, '/data/private/', 'private config directory must never be published');
```
New calls to add, same shape, same section:
```js
await expect404(baseUrl, '/__curate/health', 'curate-only endpoint must never be published');
await expect404(baseUrl, '/__curate/overlay.js', 'curate overlay bundle must never be published');
await expect404(baseUrl, '/__curate/exclusions/<some-id>', 'curate write endpoint must never be published');
```

**Non-regression constraint (CRITICAL — verified by direct read, lines 294-301):**
```js
const exclusionsBody = await expect200(baseUrl, '/data/best-effort-exclusions.json');
if (exclusionsBody) {
  const parsedExclusions = JSON.parse(exclusionsBody);
  if (!Array.isArray(parsedExclusions.exclusions)) {
    fail('/data/best-effort-exclusions.json parsed but "exclusions" is not an array');
  } else {
    ok('/data/best-effort-exclusions.json parses with an "exclusions" array');
  }
}
```
This assertion targets the **data** path (`/data/best-effort-exclusions.json`, served under the `/strava-widgets` prefix mount from `dist/widgets/data/`). The new guards target the **`/__curate/*`** namespace exclusively (per D-02, served OUTSIDE the mount prefix). Because `safeResolve`'s `MOUNT_PREFIX` check (`/strava-widgets`) is the only routing boundary in this server, and `/__curate/*` never starts with `/strava-widgets`, there is no substring or path overlap between `/data/best-effort-exclusions.json` and any `/__curate/...` path — the new `expect404` calls cannot accidentally catch the existing 200-and-parses assertion as long as they are written as literal `/__curate/...` paths (not a wildcard/prefix match against `/data/`).

---

### `src/dashboard/views/detail-sections.ts` (MODIFIED — `data-activity-id`)

**Analog / naming precedent:** `src/dashboard/views/list.ts:527`
```ts
tr.dataset.activityId = row.id;
// → renders as data-activity-id="<id>" on the <tr>
```

**Exact insertion point** — `buildBestEffortsSection` (lines 366-439, full function read):
```ts
export function buildBestEffortsSection(
  rows: readonly BestEffortPanelRow[],
  exclusionReason: string | null
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'card detail-section';
  // NEW: section.dataset.activityId = activityId;  (requires adding an
  // activityId param to this function's signature — its only caller is
  // mountBestEffortsAndBadges in detail.ts, which already has `detail.id`
  // in scope)

  const heading = document.createElement('h2');
  ...
```
Apply the identical `.dataset.activityId = ...` idiom already used at `list.ts:527` — same property name, same resulting attribute (`data-activity-id`), no new convention introduced. This section is returned unconditionally even in the empty-state early-return branch (lines 391-403), so the attribute must be set BEFORE that branch, not after, or an activity with zero qualifying efforts would ship a `<section>` with no attach seam.

---

### `src/dashboard/views/detail.ts` (MODIFIED — CustomEvent dispatch)

**Analog:** the file's own `requestToken`/`mountedContainer` guard idiom, already used seven times in this file (grep-verified at lines 305, 369, 376, 401, 420, 427, 501, 520, 633, 709, 722).

**Exact insertion point** — `mountBestEffortsAndBadges` (lines 488-514, full function read):
```ts
async function mountBestEffortsAndBadges(
  container: HTMLElement,
  badgesContainer: HTMLElement,
  panelContainer: HTMLElement,
  detail: ActivityDetail,
  myToken: number
): Promise<void> {
  const [bestEffortsEntry, ageGrading, exclusionReason] = await Promise.all([
    bestEffortsClient.load(detail.id),
    ageGradingClient.load(),
    loadExclusionReason(detail.id),
  ]);

  if (myToken !== requestToken || mountedContainer !== container) {
    return;                                    // <-- the guard D-03 requires firing AFTER
  }

  for (const label of buildPrBadgeLabels(bestEffortsEntry)) {
    appendBadge(badgesContainer, label);
  }

  const rows = buildBestEffortsPanelRows(bestEffortsEntry, ageGrading);
  panelContainer.replaceChildren(buildBestEffortsSection(rows, exclusionReason));
  // NEW: dispatch dashboard:best-efforts-mounted with { activityId: detail.id } HERE,
  // as the LAST statement in this function — after panelContainer.replaceChildren(...)
  // places the section in the DOM, never before. Placing it earlier (e.g. right after
  // the requestToken guard) would fire the event before buildBestEffortsSection's
  // <section data-activity-id="..."> actually exists in the container the overlay
  // queries against.
}
```
The literal statement to add: `container.dispatchEvent(new CustomEvent('dashboard:best-efforts-mounted', { detail: { activityId: detail.id } }))` (or dispatch on `panelContainer`/`document` — planner's discretion per CONTEXT.md, but must be a bubbling-reachable target the overlay can attach a listener to before the section exists, since the overlay's own script tag loads asynchronously after `index.html`).

**`loadExclusionReason`'s fetch idiom — the closest existing analog for the overlay's own fetch calls** (lines 463-472, full function read):
```ts
async function loadExclusionReason(activityId: string): Promise<string | null> {
  try {
    const response = await fetch('data/best-effort-exclusions.json');
    if (!response.ok) return null;
    const body = await response.json();
    return buildExclusionReasonIndex(body).get(activityId) ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
```
Note: this fetches a **relative** URL (`data/best-effort-exclusions.json`) — the overlay's own writes must target the fully-qualified `/__curate/exclusions/:id` path (outside the mount prefix, D-02), not a relative path, since the overlay script is injected into a page served under `/strava-widgets/`.

---

### `src/dashboard/curation-seam.test.ts` (test, source-structure)

**Analog:** `src/dashboard/row-semantics.test.ts` (full header + structure read, 120+ lines) and `src/dashboard/row-navigation.test.ts`

**Header-comment convention to copy verbatim in spirit** (row-semantics.test.ts, lines 1-38):
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Source-structure regression guard for Phase 24's D-03 attach seam
 * (`.planning/phases/24-local-curation-mode/`)...
 *
 * It proves NOTHING about rendering, event dispatch, or DOM attachment.
 * Vitest runs in this repository with `environment: 'node'` — this project
 * has no DOM-simulation library dependency and no headless browser anywhere
 * in it — so nothing here can construct a live DOM, dispatch a CustomEvent,
 * or observe an event listener firing. The only proof of those is the
 * mandatory human browser checkpoint (criterion 4). A green run of this file
 * is coverage of SOURCE TEXT SHAPE only.
 */
```

**File-reading idiom to copy verbatim** (row-semantics.test.ts, lines 40-56):
```ts
const VIEWS_DIR = new URL('./views/', import.meta.url);

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, VIEWS_DIR), 'utf8');
}

const detailSectionsSource = readSource('detail-sections.ts');
const detailSource = readSource('detail.ts');
```

**Comment-stripping utility to reuse (import, not reimplement)** (row-semantics.test.ts, lines 68-71):
```ts
export function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}
```
This is `export`ed from `row-semantics.test.ts` already — import it rather than redefining, following the "don't hand-roll a second copy" principle RESEARCH.md's Don't-Hand-Roll table applies elsewhere in this phase.

**What to assert (source-structure, not DOM):**
1. `detailSectionsSource` contains `.dataset.activityId =` (or `setAttribute('data-activity-id'` — scan both spellings, mirroring `row-semantics.test.ts`'s own "spelling-agnostic" lesson from WR-02, 20-REVIEW.md) inside `buildBestEffortsSection`'s body.
2. `detailSource` contains the literal string `'dashboard:best-efforts-mounted'` inside a `dispatchEvent`/`new CustomEvent(` call.
3. **Ordering assertion** — use a text-offset comparison (`detailSource.indexOf('dashboard:best-efforts-mounted')` must be greater than `detailSource.indexOf(...)` for the specific `requestToken !== ...` guard clause inside `mountBestEffortsAndBadges`, and greater than the `panelContainer.replaceChildren(buildBestEffortsSection(...))` call) — mirroring `row-semantics.test.ts`'s own "must appear after X" style (referenced in RESEARCH.md Pitfall 2).

---

### Overlay control markup (curate-only, esbuild-bundled)

**Analog for styling — no new CSS needed.** `src/dashboard/styles.css` lines 1618-1628 and 1684-1689 (Phase 19's bare-element baseline), confirmed to explicitly anticipate this exact phase:
```css
input,
select,
textarea {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-control);
  min-height: 32px;
  font: inherit;
}
```
```css
button {
  font: inherit;
  min-height: 32px;
  cursor: pointer;
  border-radius: var(--radius-control);
}
```
The `input[type="checkbox"]` exclusion rule (lines 1636-1645) carries this literal comment: *"kept purely as cheap, forward-compatible exclusions for future checkbox/radio sites (**e.g. Phase 24's curation UI**)"* — confirming bare `<input type="checkbox">`/`<textarea>`/`<button>` elements, with NO custom class, inherit the full box/hover/focus-ring/disabled treatment automatically. **Build the overlay's tickbox/textarea/Save/Remove controls as plain `document.createElement('input'|'textarea'|'button')` with no class names.** The overlay bundle ships zero CSS.

**Analog for DOM-building idiom (structure, not styling):** `detail-sections.ts`'s `buildPrFlagsCell`/`buildBestEffortsSection` (lines 339-439) — plain `document.createElement` + `.textContent`/`.className` + `.appendChild`, no template strings, no innerHTML. Follow this idiom in the overlay for consistency, even though the overlay is a separate bundle with no import relationship to this file.

**Analog for the write-then-reload idiom:** RESEARCH.md's Architecture Pattern 2 code example (`saveExclusion`, lines 240-253 of 24-RESEARCH.md) — no existing repo file does a `fetch` + `location.reload()` round trip; this is a genuinely new client-side pattern the overlay introduces, reasoned from D-03/D-07 (see RESEARCH.md Assumption A1, flagged MEDIUM confidence — confirm this reading before locking the plan's task list, per RESEARCH.md Open Question 1).

---

## Shared Patterns

### Node-built-ins-only server style
**Source:** `scripts/verify-dashboard-publish.mjs` (whole file) and `scripts/build-widgets.mjs` (whole file)
**Apply to:** `scripts/curate-server.mjs`, `scripts/lib/curation-guard.mjs`, `scripts/lib/copy-data-tree.mjs`
No new dependency; `node:http`, `node:fs`, `node:path`, `node:child_process` only (plus the already-installed `esbuild` devDependency for the overlay bundle step).

### The two-layer absence guard (D-10)
**Source:** `assertNoPrivateArtifacts` (`build-widgets.mjs` ~166-206) + its `expect404` HTTP counterpart (`verify-dashboard-publish.mjs` 290-293)
**Apply to:** `scripts/lib/curation-guard.mjs` (build-time layer) and the new `verify-dashboard-publish.mjs` assertions (HTTP layer)
Both layers use `process.exit(1)` discipline (never a warning) at their respective call sites — the extracted `curation-guard.mjs` function itself must NOT call `process.exit`; only `build-widgets.mjs`'s wrapper does, per the D-11 testability requirement.

### `dataset.activityId` naming convention
**Source:** `src/dashboard/views/list.ts:527`
**Apply to:** `src/dashboard/views/detail-sections.ts`'s new `<section>` attribute
Same property (`.dataset.activityId`), same resulting HTML attribute (`data-activity-id`) — no new naming convention introduced.

### Source-structure test precedent (no-DOM-environment discipline)
**Source:** `src/dashboard/row-semantics.test.ts`, `src/dashboard/row-navigation.test.ts`
**Apply to:** `src/dashboard/curation-seam.test.ts`
Every new test file that touches `detail.ts`/`detail-sections.ts` MUST follow this precedent — `vitest.config.ts` is `environment: 'node'`, no jsdom/happy-dom/linkedom dependency exists anywhere in `package.json`. Do not plan a test that constructs a live DOM or dispatches an event.

### Fixture-based unit test with `os.tmpdir()`
**Source:** `src/analytics/best-effort-exclusions.test.ts` (lines 74-95, `loadExclusions` describe block)
**Apply to:** `scripts/lib/curation-guard.test.mjs`'s planted-fixture regression test (D-11)
```ts
let tmpDir: string;
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curation-guard-'));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```
Use this exact `mkdtemp`/`rm` idiom to plant a fake `dist/widgets` tree (with and without a curate artifact) rather than mutating the real `dist/widgets` directory.

### Vitest include-glob widening
**Source:** `vitest.config.ts` (whole file, 9 lines)
**Apply to:** the Wave 0 config change
```ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],   // -> widen to also match 'scripts/**/*.test.mjs'
  },
});
```

### `npm run` script naming convention
**Source:** `package.json` lines 24-25 (`build-widgets`, `verify-dashboard`)
**Apply to:** the new `curate` script
```json
"build-widgets": "node scripts/build-widgets.mjs",
"verify-dashboard": "node scripts/verify-dashboard-publish.mjs",
```
New entry follows the identical `"curate": "node scripts/curate-server.mjs"` shape — no build step, no flags, matching this repo's `.mjs`-direct-invocation convention (as opposed to the `dist/index.js`-via-tsc scripts above them).

### `.gitignore` entry convention for generated/private directories
**Source:** `.gitignore` (whole file, 27 lines) — e.g. lines 3-7 (`dist/widgets/*` with a documented exception) and lines 18-23 (`data/private/*.json` with a documented example-file exception)
**Apply to:** the new `.curate-dist/` entry
Every existing entry that excludes a generated directory carries an explanatory comment naming WHY (e.g. line 12-14's `data/dashboard/` comment: "regenerated compute-step output, same convention as data/stats/ (D-12)"). The new `.curate-dist/` line should follow the same one-line-comment convention, referencing D-01's structural-absence requirement.

## No Analog Found

Files/patterns with no close match in the codebase (planner should use RESEARCH.md's Code Examples instead):

| File / Pattern | Role | Data Flow | Reason |
|---|---|---|---|
| Write endpoint's atomic JSON write (`writeAtomic` — write-to-temp + `renameSync`) | utility (inside `curate-server.mjs`) | file-I/O | Every existing `writeFileSync` call site in this repo (`consolidate.ts`, `convert-wma-tables.mjs`, `ci-setup-tokens.mjs`, `compute-route-data.mjs`, `refetch-missing-polylines.mjs`) writes directly with no temp-file/rename step — none is concurrently read by a live server the way `data/best-effort-exclusions.json` will be. Use RESEARCH.md Architecture Pattern 3's `writeAtomic` code block directly. |
| Origin/Host CSRF check (`isTrustedOrigin`) | utility (inside `curate-server.mjs`) | request-response | No existing server in this repo validates request headers — `verify-dashboard-publish.mjs`'s server is read-only and short-lived, never receives a write. Use RESEARCH.md Architecture Pattern 4's code block directly. |
| `scripts/verify-dashboard-publish-guard.test.mjs` (subprocess-spawning integration test) | test | request-response | No existing test in this repo shells out to a script via `child_process`/`execFileSync` (grep-verified: only `scripts/convert-wma-tables.mjs` itself references `child_process`, no test file does). Follow RESEARCH.md Pitfall 5, Option 1's recommended shape (plant a fake `dist/widgets/__curate/overlay.js`, `execFileSync('node', ['scripts/verify-dashboard-publish.mjs'])`, assert non-zero exit, delete in `finally`, `it.skipIf(!existsSync('dist/widgets/index.html'))`). |
| Client-side `fetch` + `location.reload()` round trip (overlay's save/remove flow) | component (browser) | request-response | No existing dashboard view performs a write-then-reload cycle — every existing `fetch` in `detail.ts`/`records.ts`/etc. is read-only. Use RESEARCH.md Architecture Pattern 2's `saveExclusion` code block directly, and confirm the reload-vs-patch reading (RESEARCH.md A1) before locking task scope. |

## Metadata

**Analog search scope:** `scripts/`, `src/dashboard/views/`, `src/dashboard/*.test.ts`, `src/analytics/`, `src/dashboard/styles.css`, `vitest.config.ts`, `package.json`, `.gitignore`
**Files scanned:** `verify-dashboard-publish.mjs` (full, 477 lines), `build-widgets.mjs` (full, 358 lines), `detail.ts` (targeted, ~440-750), `detail-sections.ts` (full, 439 lines), `list.ts` (targeted, ~515-535), `records-logic.ts` (targeted, ~60-100), `best-effort-exclusions.ts` (full, 102 lines), `best-effort.types.ts` (targeted, ~90-140), `row-semantics.test.ts` (targeted, 1-120), `best-effort-exclusions.test.ts` (targeted, imports + fixture blocks), `styles.css` (targeted, 1595-1745), `vitest.config.ts` (full), `package.json` (full), `.gitignore` (full), `data/best-effort-exclusions.json` (full)
**Pattern extraction date:** 2026-08-27
