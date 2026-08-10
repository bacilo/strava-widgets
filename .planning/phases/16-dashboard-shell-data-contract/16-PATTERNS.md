# Phase 16: Dashboard Shell & Data Contract - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 19 (new) + 4 (modified)
**Analogs found:** 17 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/dashboard/index.html` | route (Vite entry) | request-response | `src/pages/heatmap.html` | role-match |
| `src/dashboard/main.ts` | provider (bootstrap) | event-driven | `src/widgets/shared/widget-base.ts` (`connectedCallback`) | role-match |
| `src/dashboard/router.ts` | utility (pure router) | event-driven | *(none — new capability)* | no analog |
| `src/dashboard/router.test.ts` | test | — | `src/analytics/compute-best-efforts.test.ts` | role-match (test style) |
| `src/dashboard/view-registry.ts` | config/registry | — | `scripts/build-widgets.mjs` (`widgets` array) | exact (structural analog) |
| `src/dashboard/view-registry.test.ts` | test | — | `src/analytics/compute-best-efforts.test.ts` | role-match |
| `src/dashboard/views/overview.ts` | component (view) | request-response | `src/widgets/route-browser/index.ts` (`render()`) | role-match |
| `src/dashboard/views/list.ts` | component (view, list) | CRUD (read) | `src/widgets/route-browser/index.ts` (list rendering) | exact |
| `src/dashboard/views/detail.ts` | component (view, lazy fetch) | request-response | `src/widgets/shared/widget-base.ts` (`fetchDataAndRender`) | exact |
| `src/dashboard/views/calendar.stub.ts` | component (stub) | — | `src/widgets/shared/widget-base.ts` (`showError`) | partial |
| `src/dashboard/views/records.stub.ts` | component (stub) | — | same as above | partial |
| `src/dashboard/views/trends.stub.ts` | component (stub) | — | same as above | partial |
| `src/dashboard/data/index-client.ts` | service (data fetch + cache) | request-response | `src/widgets/shared/widget-base.ts` (`fetchData<T>`) | role-match |
| `src/dashboard/data/detail-client.ts` | service (lazy fetch, error/retry) | request-response | `src/widgets/shared/widget-base.ts` (`fetchDataAndRender` try/catch) | exact |
| `src/dashboard/theme.ts` | provider (theming) | event-driven | `src/widgets/shared/theme-manager.ts` | exact (semantics), document-scope adaptation |
| `src/dashboard/theme.test.ts` | test | — | `src/analytics/compute-best-efforts.test.ts` | role-match |
| `src/dashboard/nav.ts` | component (nav bar) | event-driven | `src/pages/heatmap.html` (inline `<nav>`) | partial (HTML → TS DOM build) |
| `src/dashboard/styles.css` | config (stylesheet) | — | `src/widget/styles.css` | exact (token/font source) |
| `src/analytics/compute-dashboard-index.ts` | service (compute step) | batch | `src/analytics/compute-best-efforts.ts` | exact |
| `src/analytics/dashboard-index.types.ts` | model (types) | — | `src/analytics/best-effort.types.ts` | exact |
| `src/analytics/compute-dashboard-index.test.ts` | test | — | `src/analytics/compute-best-efforts.test.ts` | exact |
| `src/index.ts` (modified — add CLI command) | controller (CLI) | request-response | `computeBestEffortsCommand` (lines 185-204) | exact |
| `scripts/build-widgets.mjs` (modified — `copyDataFiles`, new Vite entry) | config (build script) | file-I/O | `copyDataFiles()` (lines 134-152), `buildPages()` (lines 172-190) | exact |
| `.github/workflows/daily-refresh.yml` (modified — copy step) | config (CI pipeline) | batch | existing `Build widgets` / `Commit updated data` steps | exact |
| `.gitignore` (modified — remove `dist/widgets/index.html` exception) | config | — | existing exception lines 3-6 | exact |

## Pattern Assignments

### `src/dashboard/index.html` (route, request-response)

**Analog:** `src/pages/heatmap.html`

**Structure pattern** (whole file, 58 lines):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heatmap — Strava Analytics</title>
  <!-- external CDN libs here in the heatmap analog; dashboard needs NONE (D-01) -->
</head>
<body>
  <nav> ... </nav>
  <heatmap-widget ...></heatmap-widget>
  <script src="./heatmap-widget.iife.js"></script>
</body>
</html>
```
**Deviation required:** the dashboard entry must load its bundle as `<script type="module" src="./main.ts">` (Vite dev/prod convention) rather than a plain `<script src=...iife.js>` — the heatmap page's script tag is a *built widget output* reference, not a Vite entry pattern. Also: per RESEARCH.md Pitfall 4, the theme-bootstrap inline `<script>` (non-module, synchronous) must sit in `<head>` before any stylesheet `<link>` — no existing page in this repo has this requirement, so this piece has no analog (see "No Analog Found").

**Nav bar copy-from pattern** (`src/pages/heatmap.html` lines 22-45, CSS) — reuse the `nav a.active` accent-underline convention and Strava-orange (`#fc4c02`) hover, but rebuild as CSS custom properties (`--accent`) per D-13/UI-SPEC rather than the hardcoded hex in this legacy inline `<style>`.

---

### `src/dashboard/main.ts` / `views/detail.ts` / `data/detail-client.ts` (bootstrap + lazy fetch, request-response)

**Analog:** `src/widgets/shared/widget-base.ts`

**Fetch + error pattern** (lines 275-282, `fetchData<T>`):
```typescript
protected async fetchData<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
```
Copy this shape verbatim into `data/index-client.ts` (fetch-once, cache in module state) and `data/detail-client.ts` (fetch per activity id).

**Fetch-and-render-with-error-state pattern** (lines 286-311, `fetchDataAndRender`):
```typescript
protected async fetchDataAndRender(): Promise<void> {
  try {
    const url = this.getAttribute('data-url') || this.dataUrl;
    if (!url) throw new Error('No data URL provided');
    const data = await this.fetchData(url);
    // ...clear loading...
    this.render(data);
  } catch (error) {
    console.error('Widget: Failed to load data', error);
    this.showError();
  }
}
```
`views/detail.ts` should mirror this try/catch shape exactly, substituting the UI-SPEC's copy contract for `showError()`: heading `"Couldn't load this activity"`, body `"Check your connection and try again."`, plus a Retry button that re-invokes the same fetch (the widget's `showError()` has no retry — this is the one deviation, since embeddable widgets fail silently while the dashboard's proving slice (D-07) must offer Retry).

**Lifecycle pattern** (lines 130-153, `connectedCallback`) — mirror the ordering (inject styles → apply theme → apply layout → show loading → fetch) in `main.ts`'s bootstrap sequence: apply theme (synchronous, pre-paint per Pitfall 4) → init router → fetch index once → mount matched view.

---

### `src/dashboard/router.ts` / `router.test.ts` (utility, event-driven)

**No direct analog** — this repo has no existing router. Use RESEARCH.md's Pattern 1 code example verbatim as the base implementation (dual-trigger `DOMContentLoaded` + `hashchange`, confirmed against MDN):
```typescript
function resolveRoute(): void {
  const hash = location.hash.slice(1) || '/';
  const [pathPart, queryPart] = hash.split('?');
  const params = new URLSearchParams(queryPart ?? '');
  const match = matchRegisteredRoute(pathPart);
  mountView(match, params);
}
document.addEventListener('DOMContentLoaded', resolveRoute);
window.addEventListener('hashchange', resolveRoute);
```
**Test style analog:** `src/analytics/compute-best-efforts.test.ts` (lines 1-45) — `describe`/`it` blocks, pure-function input/output assertions, no mocking framework beyond vitest's built-ins. Follow this same flat `describe('resolveRoute — ...')` structure for `router.test.ts`, matching `vitest.config.ts`'s `environment: 'node'` (no jsdom — route *parsing* is pure string/URLSearchParams logic, testable without a DOM, consistent with this repo's zero-DOM-test precedent per RESEARCH.md's Validation Architecture note).

---

### `src/dashboard/view-registry.ts` (config/registry)

**Analog:** `scripts/build-widgets.mjs` — the `widgets` array (lines 15-79)

**Enumeration pattern:**
```javascript
const widgets = [
  { name: 'stats-card', entry: resolve(__dirname, '../src/widgets/stats-card/index.ts'), globalName: 'StatsCard', isMapWidget: false },
  { name: 'comparison-chart', entry: resolve(__dirname, '../src/widgets/comparison-chart/index.ts'), globalName: 'ComparisonChart', isMapWidget: false },
  // ... one object literal per widget, single source of enumeration
];
```
This is the exact "one array, one object per unit, drop-in extensibility" shape D-03 asks the view registry to mirror. Translate to TypeScript records per RESEARCH.md Pattern 2:
```typescript
export interface DashboardView {
  route: string;
  title: string;
  navEntry?: { label: string; order: number };
  mount: (container: HTMLElement, params: URLSearchParams, routeParams: Record<string,string>) => void | Promise<void>;
}
```

---

### `src/dashboard/views/list.ts` (component, CRUD-read)

**Analog:** `src/widgets/route-browser/index.ts` — list-item rendering (lines 122-146)

**Core list-rendering pattern:**
```typescript
for (const route of this.routes) {
  const item = document.createElement('div');
  item.className = 'route-list-item';
  item.setAttribute('data-id', route.id.toString());
  const distanceKm = (route.distance / 1000).toFixed(1);
  const formattedDate = new Date(route.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  item.innerHTML = `<div class="item-name">${route.name}</div><div class="item-meta">${distanceKm} km &bull; ${formattedDate}</div>`;
  item.addEventListener('click', () => this.selectRoute(route.id));
  listDiv.appendChild(item);
}
```
**Security deviation required (RESEARCH.md Pitfall 5 / Security Domain V5):** this analog uses `item.innerHTML = ...` with an unescaped `route.name`. The dashboard's `list.ts` MUST NOT copy this line as-is — `activity.name` is Strava free-text (user-editable), so use `textContent` or an explicit text node for the name field instead of template-string `innerHTML`. Keep the surrounding structural pattern (create element, set class, build meta line, attach click handler) but swap the name-insertion line for:
```typescript
const nameDiv = document.createElement('div');
nameDiv.className = 'item-name';
nameDiv.textContent = activity.name;
item.appendChild(nameDiv);
```

---

### `src/dashboard/theme.ts` / `theme.test.ts` (provider, event-driven)

**Analog:** `src/widgets/shared/theme-manager.ts` (whole file, 107 lines)

**Exact color tokens to lift** (lines 42-71):
```typescript
// Light: --bg #ffffff, --text #333333, --accent #fc4c02
// Dark:  --bg #1a1a2e,  --text #e0e0e0,  --accent #ff6b35
```

**Effective-theme resolution logic** (lines 26-35, `getEffectiveTheme`):
```typescript
getEffectiveTheme(): Theme {
  const themeAttr = this.host.getAttribute('data-theme') as ThemeMode | null;
  if (themeAttr === 'light') return 'light';
  if (themeAttr === 'dark') return 'dark';
  return this.mediaQuery.matches ? 'dark' : 'light';
}
```
Port this exact 3-branch logic to document scope, reading `localStorage.getItem('dashboard-theme')` instead of `host.getAttribute('data-theme')`, matching RESEARCH.md's Pattern 3 (`applyTheme`) and Security Domain's validation requirement (only accept exactly `'light' | 'dark' | 'auto'`, fall back to `'auto'` on anything else — the ThemeManager analog does NOT validate its attribute value, since a Shadow-DOM host attribute is developer-controlled; `localStorage` is not, so `theme.ts` needs one extra guard clause the analog lacks).

**Change-listener pattern** (lines 85-95, `listenForChanges`):
```typescript
listenForChanges(callback: () => void): void {
  this.changeListener = (e: MediaQueryListEvent) => {
    const themeAttr = this.host.getAttribute('data-theme');
    if (!themeAttr || themeAttr === 'auto') callback();
  };
  this.mediaQuery.addEventListener('change', this.changeListener);
}
```
Reuse verbatim (swap `host.getAttribute` for the `localStorage` read) for reacting to system theme changes when mode is `auto`.

**Test pattern:** `theme.test.ts` should mock `localStorage` and `window.matchMedia` and assert the 3-modes × 2-system-states matrix per RESEARCH.md's test map — no existing test in this repo mocks `matchMedia`, so use vitest's `vi.fn()` / `Object.defineProperty(window, 'matchMedia', ...)` idiom (standard vitest pattern, not copied from an existing repo file).

---

### `src/analytics/compute-dashboard-index.ts` / `dashboard-index.types.ts` (service + model, batch)

**Analog:** `src/analytics/compute-best-efforts.ts` (whole file) + `src/analytics/best-effort.types.ts` (whole file)

**Options-object + defaults pattern** (compute-best-efforts.ts lines 121-153):
```typescript
export interface ComputeBestEffortsOptions {
  activitiesDir?: string;
  streamsDir?: string;
  streamsManifestPath?: string;
  statsDir?: string;
}
export async function computeBestEfforts(options: ComputeBestEffortsOptions = {}): Promise<BestEffortsDocument> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const streamsDir = options.streamsDir || 'data/streams';
  const streamsManifestPath = options.streamsManifestPath || 'data/streams/manifest.json';
  const statsDir = options.statsDir || 'data/stats';
  const fileStore = new FileStore('.');
  // ...
}
```
Copy this defaulted-options-object shape exactly for `computeDashboardIndex(options: ComputeDashboardIndexOptions = {})`, adding `outDir = options.outDir || 'data/dashboard'` per RESEARCH.md's Code Examples section.

**Manifest read + per-activity loop with per-item try/catch** (compute-best-efforts.ts lines 159, 174-232):
```typescript
const manifest = await loadManifest(fileStore, streamsManifestPath);
for (const [id, entry] of Object.entries(manifest.activities)) {
  if (!entry.available) { skippedNoStream++; continue; }
  try {
    const activity = await fileStore.readJson<StravaActivity>(path.join(activitiesDir, `${id}.json`));
    // ... per-row transform ...
  } catch (error) {
    console.warn(`  ${id}: ${(error as Error).message}; skipping`);
    skippedUnreadable++;
    continue;
  }
}
```
Same shape for the index generator: iterate `data/activities/*.json`, cross-reference `data/streams/manifest.json` (stream-availability badge) and `data/stats/best-efforts.json` (low-confidence flag), one row per activity, non-fatal per-row error handling (a single malformed activity file must not abort the ~1,867-row build, mirroring `compute-best-efforts.ts`'s T-15-02 threat note).

**Atomic write + doc shape + console summary pattern** (lines 270-306):
```typescript
const doc: BestEffortsDocument = {
  schemaVersion: BEST_EFFORTS_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  note: 'Derived, gitignored, and regenerated by `node dist/index.js compute-best-efforts`. Consumers read this file rather than recomputing.',
  totals: { /* ... */ },
  // ...
};
await fileStore.writeJson(path.join(statsDir, 'best-efforts.json'), doc);
console.log(`\nGenerated best efforts:`);
console.log(`- Activities considered: ${doc.totals.activitiesConsidered}`);
```
Copy the `schemaVersion` constant + `generatedAt` ISO timestamp + `note` string + `totals` block convention for `DashboardIndexDocument`, writing to `data/dashboard/index.json` via the same `FileStore.writeJson` atomic temp-file-then-rename (`src/storage/file-store.ts` lines 17-40).

**Types file pattern** (`best-effort.types.ts` lines 15-16, 118-135):
```typescript
export const BEST_EFFORTS_SCHEMA_VERSION = 1;
// ...
export interface BestEffortsDocument {
  schemaVersion: 1;
  generatedAt: string;
  note: string;
  totals: { /* named counters */ };
  rankings: Record<TargetDistanceKey, PRRankingEntry[]>;
  rejected: RejectedEffort[];
  activities: Record<string, ActivityBestEfforts>;
}
```
`dashboard-index.types.ts` should declare `DASHBOARD_INDEX_SCHEMA_VERSION = 1`, a `DashboardIndexRow` interface (D-09's field list: id, date, name, distance, movingTime, pace, avgHr, maxHr, cadence, elevationGain, location, streamBadge, lowConfidence), and a `DashboardIndexDocument` wrapper with the same `schemaVersion`/`generatedAt`/`note`/`totals` envelope.

**Test pattern:** `compute-dashboard-index.test.ts` should follow `compute-best-efforts.test.ts`'s fixture style (lines 1-45) — synthetic activity/manifest/best-efforts fixtures built with small helper functions (`constantPaceSeries`-style builders), `beforeEach`/`afterEach` temp-dir setup via `fs.mkdtemp(os.tmpdir())` (lines 1-13 imports: `node:fs/promises`, `node:os`, `node:path`, `vitest`), asserting the written document shape.

---

### `src/index.ts` (CLI wiring, modified)

**Analog:** `computeBestEffortsCommand` (lines 185-204)

```typescript
async function computeBestEffortsCommand() {
  try {
    const { computeBestEfforts } = await import('./analytics/compute-best-efforts.js');
    console.log('Computing best efforts from committed streams...\n');
    await computeBestEfforts({
      activitiesDir: config.activitiesDir,
      streamsDir: config.streamsDir,
      streamsManifestPath: config.streamsManifestPath,
      statsDir: 'data/stats',
    });
    console.log('\nBest efforts generated successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('Compute best efforts error:', error.message);
    if (error.code === 'ENOENT' && error.message.includes('streams')) {
      console.error('\nStreams directory not found. Please run: npm run backfill-streams');
    }
    process.exit(1);
  }
}
```
Copy this exact shape for `computeDashboardIndexCommand()` — dynamic `import()`, config-getter args, actionable ENOENT hint, `process.exit(0|1)`. Register in the `case` block (around line 497-500, alongside `compute-best-efforts`) and in the help text (lines 456-474). Also add `"compute-dashboard-index": "node dist/index.js compute-dashboard-index"` to `package.json`'s `scripts` block, mirroring line 15's `"compute-best-efforts"` entry.

**Config getter pattern** (`src/config/strava.config.ts` lines 55-64) — if the index generator needs a new `config.dashboardIndexDir` style getter, follow this exact shape:
```typescript
get streamsDir(): string {
  return path.join(this.dataDir, 'streams');
}
```

---

### `scripts/build-widgets.mjs` (build script, modified)

**Analog (data copy):** `copyDataFiles()` (lines 134-152)
```javascript
function copyDataFiles() {
  const dataDirs = [
    { src: 'data/stats', dest: 'dist/widgets/data/stats' },
    { src: 'data/geo', dest: 'dist/widgets/data/geo' },
    { src: 'data/routes', dest: 'dist/widgets/data/routes' },
    { src: 'data/heatmap', dest: 'dist/widgets/data/heatmap' }
  ];
  for (const { src, dest } of dataDirs) {
    if (!existsSync(src)) continue;
    mkdirSync(dest, { recursive: true });
    for (const file of readdirSync(src)) {
      if (file.endsWith('.json')) copyFileSync(resolve(src, file), resolve(dest, file));
    }
    console.log(`✓ Copied ${src}/*.json → ${dest}/`);
  }
}
```
Extend the `dataDirs` array per D-11/RESEARCH.md Code Examples: add `data/activities` → `dist/widgets/data/activities`, `data/streams` → `dist/widgets/data/streams` (whole-directory copy captures `manifest.json` automatically), `data/dashboard` → `dist/widgets/data/dashboard`. Note: the existing loop is single-level (`readdirSync(src)`, no recursion) — this is already sufficient since all four new/existing data dirs are flat `.json` file lists, no subdirectories.

**Analog (new Vite page entry):** `buildPages()` (lines 172-190) — same `build({ root: 'src/pages', ... rollupOptions: { input: {...} } })` shape as `vite.config.pages.ts`. The dashboard SPA entry needs its own `build()` call (or an added `input` key) with `root: 'src/dashboard'`, `outDir: '../../dist/widgets'`, `emptyDir: false` (CRITICAL per existing comment), `rollupOptions.input: { index: resolve(__dirname, '../src/dashboard/index.html') }`. Per RESEARCH.md Pitfall 2, this collides with the currently hand-committed `dist/widgets/index.html` — the plan must relocate the widget-showcase content (candidate: new `widgets.html` sibling to heatmap/pinmap/routes) before this build entry can safely target `index.html`.

---

### `.github/workflows/daily-refresh.yml` (CI, modified)

**Analog:** existing `Compute best efforts` step (with `continue-on-error: true` + warning step) and `Commit updated data and stats` step

```yaml
- name: Compute best efforts
  id: best-efforts
  continue-on-error: true
  run: node dist/index.js compute-best-efforts

- name: Warn on best-effort failure
  if: steps.best-efforts.outcome == 'failure'
  run: echo "::warning::Best-effort computation failed, records data will be stale"
```
Add a `Compute dashboard index` step in this exact shape, positioned after `compute-best-efforts` (its consumer dependency) and before `Build widgets`, per RESEARCH.md Open Question 1's recommendation (separate step, not folded into `compute-all-stats`, matching the existing per-stage `continue-on-error` isolation convention).

**Commit-file-pattern note:** the existing `file_pattern: 'data/activities/*.json data/sync-state.json data/geo/*.json data/streams/*.json'` (already includes `data/activities` and `data/streams` — confirmed present) needs no change for D-11's copy step (that's `copyDataFiles()`'s job, not git-commit's); `data/dashboard/index.json` must NOT be added to this list since D-12 declares it gitignored (regenerated every run, like `data/stats/`).

---

## Shared Patterns

### Fetch-with-error-handling
**Source:** `src/widgets/shared/widget-base.ts` lines 275-311 (`fetchData<T>`, `fetchDataAndRender`)
**Apply to:** `data/index-client.ts`, `data/detail-client.ts`, `views/detail.ts`, `views/overview.ts` (any view fetching JSON)
```typescript
protected async fetchData<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
```

### Theme tokens and semantics
**Source:** `src/widgets/shared/theme-manager.ts` (whole file)
**Apply to:** `src/dashboard/theme.ts`, `src/dashboard/styles.css`
```
Light: --bg #ffffff, --text #333333, --accent #fc4c02
Dark:  --bg #1a1a2e,  --text #e0e0e0,  --accent #ff6b35
```
3-state resolution (`light`/`dark`/explicit-wins-over-`auto`) and the `auto`-only change-listener guard both port directly, document-scope instead of Shadow-DOM-host-scope.

### Compute-step CLI + gitignored-output convention
**Source:** `src/analytics/compute-best-efforts.ts` + `computeBestEffortsCommand` in `src/index.ts` (lines 185-204)
**Apply to:** `src/analytics/compute-dashboard-index.ts`, `src/index.ts` CLI registration, `package.json` scripts, `daily-refresh.yml`
Defaulted options object → `FileStore` read/write → `schemaVersion`/`generatedAt`/`note`/`totals` document envelope → atomic write → console summary → CLI wrapper with actionable ENOENT hint and `process.exit(0|1)`.

### DOM XSS avoidance for free-text/user-controlled values
**Source:** RESEARCH.md Pitfall 5 / Security Domain (no existing repo file gets this fully right — `route-browser/index.ts` line 139-142 is the actual anti-pattern to avoid, using `innerHTML` with unescaped `route.name`)
**Apply to:** `views/list.ts`, `views/detail.ts`, `views/overview.ts` — anywhere `activity.name` (Strava free text) or a route param is inserted into the DOM
```typescript
// DO NOT: item.innerHTML = `<div>${activity.name}</div>`;
// DO:
const nameDiv = document.createElement('div');
nameDiv.textContent = activity.name;
```
Also validate `id` against `/^\d+$/` before building any `data/activities/<id>.json` fetch URL (route param from `#/activity/:id` is user-controlled).

### Non-recursive flat-directory JSON copy
**Source:** `scripts/build-widgets.mjs` `copyDataFiles()` (lines 134-152)
**Apply to:** the D-11 extension of the same function (`data/activities`, `data/streams`, `data/dashboard` additions)

## No Analog Found

Files/concerns with no close match in the codebase (planner should use RESEARCH.md's Code Examples/Pattern sections instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/dashboard/router.ts` | utility | event-driven | No hash router exists anywhere in the codebase (D-01 explicitly avoided one until now) — use RESEARCH.md Pattern 1 verbatim as the base |
| Theme-bootstrap inline `<script>` in `index.html` `<head>` (pre-paint, synchronous, non-module) | config/script | — | No existing page does document-level pre-paint theme application; widgets solve this via Shadow DOM `connectedCallback` timing, which doesn't apply at document scope. Use RESEARCH.md Pattern 3 + Pitfall 4 guidance directly |

## Metadata

**Analog search scope:** `src/widgets/`, `src/widgets/shared/`, `src/pages/`, `src/analytics/`, `src/storage/`, `src/streams/`, `src/config/`, `src/index.ts`, `scripts/build-widgets.mjs`, `vite.config.pages.ts`, `.github/workflows/daily-refresh.yml`, `.gitignore`
**Files scanned:** ~15 read directly (full or targeted sections); directory listings across `src/`, `src/widgets/`, `src/analytics/`, `src/pages/`
**Pattern extraction date:** 2026-08-10
