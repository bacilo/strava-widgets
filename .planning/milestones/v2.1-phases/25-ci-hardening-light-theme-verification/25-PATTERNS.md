# Phase 25: CI Hardening & Light-Theme Verification - Pattern Map

**Mapped:** 2026-09-03
**Files analyzed:** 10 (8 modified, 2 new)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.github/workflows/daily-refresh.yml` | config (CI orchestration) | batch | itself (existing steps being collapsed) | n/a — deletion target, see § daily-refresh.yml |
| `src/index.ts` (`computeAllStatsCommand`) | CLI command / controller | batch | `src/dashboard/view-registry.ts` (exported ordered config array consumed by a thin imperative wrapper) | role-match (best available; no CLI-command analog exists) |
| **NEW** step-table test file (suggested `src/index-compute-all-stats.test.ts`) | test (unit, data-only) | transform | `src/dashboard/view-registry.test.ts` | exact (shape: assert order/uniqueness/flags on an exported array, no side effects invoked) |
| `scripts/verify-dashboard-publish.mjs` | service (HTTP smoke test) | request-response | itself — existing `training-load.json` / `gear-aggregate.json` blocks (lines ~329-409) | exact |
| `src/analytics/gear-aggregate-logic.ts` (`:147`, `:207`) | service (pure transform) | transform | itself — same file, same function family | exact |
| `src/analytics/dashboard-index.types.ts` (`:72`) | model (type contract) | — | itself | exact |
| `scripts/lib/curation-guard.mjs` (`:83`) | utility (build guard) | file-I/O | itself — the sibling `readFileSync` try/catch at the same file's content-scan block | exact |
| `src/analytics/gear-aggregate-logic.test.ts` | test (unit) | transform | itself — existing `makeRow` fixture builder | exact |
| `scripts/lib/curation-guard.test.mjs` | test (unit, fixture-planting) | file-I/O | itself — WR-14 case (c) `mode-000 regular file` block | exact |
| **NEW** `src/dashboard/theme-bootstrap-parity.test.ts` | test (unit, behavioural, `node:vm` sandbox) | transform | `src/dashboard/styles.test.ts` (closest "read a non-TS artifact from disk, extract a region, assert" template) + `src/dashboard/theme.test.ts` (the six-combination test matrix to mirror) | role-match (styles.test.ts) / exact (theme.test.ts matrix) |

---

## Pattern Assignments

### 1. NEW: CI-01 step-table test file (highest marginal value — no analog inside `src/index.ts` itself)

**Problem:** `computeAllStatsCommand` has zero test coverage and calls `process.exit()` — it cannot be imported and tested as-is. The fix (per RESEARCH Pattern 1) is to extract an exported, pure ordered array of `{ name, mandatory, run }` from the function body, then test *that constant* in isolation.

**Closest analog for "unit-testing an exported pure data structure / table-driven config that an imperative wrapper consumes":** `src/dashboard/view-registry.ts` + `src/dashboard/view-registry.test.ts`. This is the one other place in the repo where an ordered array of config objects (`VIEWS`, one entry per route) is the *single source of truth* that a thin imperative layer (`getView()`, `main.ts`'s router) consumes — structurally identical to what D-01 wants `COMPUTE_ALL_STATS_STEPS` to be for the workflow/CLI.

**Imitate:**
- The **shape of the exported array itself** (`src/dashboard/view-registry.ts:32-39`):
```typescript
export const VIEWS: readonly DashboardView[] = [
  createOverviewView({ indexClient }),
  createListView({ indexClient }),
  createCalendarView({ indexClient }),
  createRecordsView({ indexClient }),
  createTrendsView({ indexClient }),
  createDetailView({ detailClient, indexClient, gearClient, athleteConfigClient }),
];
```
For `COMPUTE_ALL_STATS_STEPS`, the array entries are `{ name: string, mandatory: boolean, run: () => Promise<void> }` per RESEARCH Pattern 1 — same "one flat array, one entry per unit" convention the file's own header comment calls out (`view-registry.ts:2-3`: "Mirrors `scripts/build-widgets.mjs`'s `widgets` array: one flat array, one entry per unit, one place to add the next one").

- The **test file's data-only assertion style** (`src/dashboard/view-registry.test.ts:1-30`), verbatim:
```typescript
/**
 * Data-only assertions on the view registry (D-03). No `mount()` is ever
 * invoked and no DOM is touched — `vitest.config.ts` runs in a `node`
 * environment with no jsdom, so this file may only assert on registry
 * DATA (route/title/navEntry), matching `compute-best-efforts.test.ts`'s
 * precedent for this repo's test phrasing style.
 */

import { describe, expect, it } from 'vitest';

import { ALL_ROUTES, NAV_ORDER, ROUTES, STUB_PHASE } from './view.types.js';
import { VIEWS, getView } from './view-registry.js';

describe('VIEWS', () => {
  it('covers exactly the routes in ALL_ROUTES, no more and no fewer', () => {
    expect(VIEWS.map((v) => v.route).sort()).toEqual([...ALL_ROUTES].sort());
  });

  it('contains no duplicate route values', () => {
    const routes = VIEWS.map((v) => v.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('every entry has a non-empty title and a mount function', () => {
    for (const view of VIEWS) {
      expect(typeof view.title).toBe('string');
      expect(view.title.length).toBeGreaterThan(0);
      expect(typeof view.mount).toBe('function');
    }
  });
});
```
This maps directly onto D-01's needs: replace "covers exactly the routes in ALL_ROUTES" with "covers exactly the 8 documented step names, in the documented order" (`expect(COMPUTE_ALL_STATS_STEPS.map(s => s.name)).toEqual([...])` — order matters here, unlike `VIEWS`' sorted-compare, so drop the `.sort()`), replace "no duplicate route values" with "no duplicate step names," and replace "non-empty title and a mount function" with "matches D-03's mandatory/tolerated split" (`mandatory: true` for exactly `compute-stats`/`compute-advanced-stats`, `false` for the other six) plus "`run` is a function" (never invoked, same as `view.mount` is asserted `typeof === 'function'` but never called).

- **Do not invoke `run()`.** Exactly as `view-registry.test.ts`'s own docblock states ("No `mount()` is ever invoked"), the new test must only assert metadata (name, order, `mandatory`) on the array — never call `run`, which would trigger the real compute pipeline. This is explicitly flagged in RESEARCH Pitfall 4's "How to avoid."

**Change:** `view-registry.ts` has no CI/flag concept — that part (D-02's `--ci` boolean) has no analog anywhere in the repo (RESEARCH Pattern 2 confirms zero prior `--flag` parsing in `src/index.ts`). Write that part fresh: `process.argv.includes('--ci')`, tested as a second small `describe('--ci flag', ...)` block in the same new file, asserting the flag changes tolerated-step disposition only (not `mandatory` steps). No existing analog to copy for this half — RESEARCH.md's own Pattern 2 code sketch is the reference, not repo code.

---

### 2. NEW: `src/dashboard/theme-bootstrap-parity.test.ts` (D-06)

**Problem:** D-06 needs a behavioural pin proving `index.html`'s inline `<script>` bootstrap (lines 36-54) resolves theme identically to `theme.ts`'s `resolveEffectiveTheme`. No DOM/jsdom exists in this repo (`vitest.config.ts` → `environment: 'node'`).

**Two things to imitate, from two different files — RESEARCH.md itself asked which is the better template; both are needed, for different halves:**

**(a) "Locate the file, extract a region, assert behaviourally" — `src/dashboard/styles.test.ts:1-31`, quoted verbatim:**
```typescript
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { NAVIGABLE_ROW_CLASS } from './row-navigation.js';

/*
 * Regression guard for WR-04 (theme toggle invisible in light mode) and for
 * design-token parity with src/widgets/shared/theme-manager.ts. There is no
 * DOM/CSSOM in this test run (vitest environment is 'node'), so we assert on
 * the stylesheet TEXT read from disk rather than on computed styles.
 */

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
```
This is the strongest existing precedent in the repo for "read a static, non-`.ts` source artifact from disk with `readFileSync(new URL(..., import.meta.url), 'utf8')` and treat it as text/structure to extract from" — `styles.test.ts` treats CSS as text/AST via `esbuild.transformSync`, never a DOM; the new test does the analogous thing for `index.html`'s inline `<script>` block, extracting its text via regex (not `esbuild`) and running it via `node:vm` instead of parsing CSS.

**Imitate:**
- The `readFileSync(new URL('./<sibling-file>', import.meta.url), 'utf8')` idiom (relative sibling-file read, not a `path.resolve(process.cwd(), ...)` — this only works because `theme-bootstrap-parity.test.ts` lives in `src/dashboard/`, the same directory as `index.html`).
- The docblock convention explaining *why* no DOM: "There is no DOM/CSSOM in this test run (vitest environment is 'node')."
- `declarationsFor`-style helper-function extraction (`styles.test.ts:55-60`, structure only): a small named helper that takes a regex, matches, and `throw`s loudly if the target is not found — for the new file this becomes an `extractInlineBootstrap(html)` helper that throws `'inline theme bootstrap script not found in index.html'` if the `<script>` regex fails to match (exactly RESEARCH Pattern 6's own suggested shape).

**(b) The six-combination test matrix to reuse verbatim — `src/dashboard/theme.test.ts:139-163`:**
```typescript
describe('resolveEffectiveTheme', () => {
  it("explicit 'light' wins over system dark preference", () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light');
  });

  it("explicit 'light' matches system light preference", () => {
    expect(resolveEffectiveTheme('light', false)).toBe('light');
  });

  it("explicit 'dark' with system light preference stays dark", () => {
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
  });

  it("explicit 'dark' with system dark preference stays dark", () => {
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
  });

  it("'auto' with system preferring dark resolves to 'dark'", () => {
    expect(resolveEffectiveTheme('auto', true)).toBe('dark');
  });

  it("'auto' with system preferring light resolves to 'light'", () => {
    expect(resolveEffectiveTheme('auto', false)).toBe('light');
  });
});
```
**Note (correcting CONTEXT.md's framing, per RESEARCH Pattern 5):** this is six individually-named `it()` blocks, **not** an `it.each` table — the repo has no `it.each` usage in theme-related files. Reuse this exact set of six `(mode, prefersDark) → effective` combinations as the parity matrix, importing `resolveEffectiveTheme` from the real `theme.ts` and comparing it against `runBootstrap({ storedValue: mode, prefersDark })`'s returned `data-theme` value for each of the six.

**Import block to imitate** (`theme.test.ts:1-15`, adapted): import `resolveEffectiveTheme` from `./theme.js` for the real-module side of the parity comparison, `describe/expect/it` from `vitest`.

**What's new (no analog — this is the genuinely novel part RESEARCH.md flags):** the `node:vm` sandbox execution itself. No file in this repo uses `node:vm` today. Build `runBootstrap({ storedValue, prefersDark, throwOnGet })` exactly per RESEARCH Pattern 6 Option A's code sketch — `vm.createContext(sandbox)` + `vm.runInContext(extractInlineBootstrap(html), sandbox)`, sandbox providing fake `localStorage`/`window.matchMedia`/`document.documentElement.setAttribute`. This has no repo precedent; copy RESEARCH.md's own sketch verbatim as the starting point, not a repo file.

**Supplementary structural check to add alongside** (Option B, cheap and worth keeping per RESEARCH.md's own recommendation): assert the `<script>` block's byte offset precedes the `<link rel="stylesheet">` byte offset in the raw `html` string — a plain `indexOf` comparison, same idiom as `curation-guard.test.mjs`'s own `source.indexOf(...)` ordering assertions (see § 4 below) applied to `index.html` instead of `build-widgets.mjs`.

---

### 3. `scripts/lib/curation-guard.test.mjs` — WR-19's mode-000-**directory** fixture

**Analog:** the file's own WR-14 case (c), `curation-guard.test.mjs:227-242`, quoted verbatim (this is the fixture to clone, swapping file-shaped setup for directory-shaped setup):
```javascript
it('(c) mode-000 regular file: reported via the read try/catch, citing EACCES (WR-14) — exercises the catch, not the isFile gate', () => {
  if (process.getuid?.() === 0 || process.platform === 'win32') {
    // root defeats mode bits; win32 has no POSIX chmod semantics — skip.
    return;
  }
  const target = path.join(tmpDir, 'wr14-secret.js');
  writeFileSync(target, 'x');
  chmodSync(target, 0o000);

  const violations = findCurationArtifacts(tmpDir);
  expect(
    violations.some(
      (v) => v.path === target && v.reason.includes('could not be read for scanning') && v.reason.includes('EACCES')
    )
  ).toBe(true);
});
```
**Imitate exactly:**
- The root/win32 skip guard as the first line of the test body.
- `chmodSync(<target>, 0o000)` immediately after creating the target.
- The assertion shape: `violations.some((v) => v.path === target && v.reason.includes(<phrase>) && v.reason.includes('EACCES'))`.

**Change:** `target` becomes a **directory** (`mkdirSync(target)`, not `writeFileSync`), and the reason-substring to assert changes from `'could not be read for scanning'` to whatever wording the `readdirSync` try/catch fix uses — RESEARCH's Pitfall 6/Code-Examples section gives the exact fix shape to mirror (`scripts/lib/curation-guard.mjs`'s existing `readFileSync` try/catch, quoted in § "Shared Patterns" below), so the reason string should read something like `'could not be listed (...) — an unreadable directory cannot be certified free of the "__curate" marker'` (RESEARCH Pitfall 6's own suggested phrasing).

**The real chmod-restore hazard — cleanup helper to imitate, this file's `afterEach` (lines 37-49), quoted verbatim:**
```javascript
afterEach(async () => {
  // WR-14 case (c) plants a mode-000 fixture. Recursive removal can itself
  // fail on some platforms unless the mode is restored first.
  const mode000Path = path.join(tmpDir, 'wr14-secret.js');
  if (existsSync(mode000Path)) {
    try {
      chmodSync(mode000Path, 0o600);
    } catch {
      // best-effort; fall through to rm below regardless
    }
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```
**This is the exact hazard the WR-19 fixture must also close, in its own describe block's `afterEach`.** The mode-000-**directory** case needs the analogous restore — `chmodSync(mode000DirPath, 0o700)` (directories need execute bit `+x` to be listable/removable, not `0o600`) — before `fs.rm(tmpDir, { recursive: true, force: true })`, exactly as this file's own existing comment already flags ("Recursive removal can itself fail... unless the mode is restored first"). Note the new fixture likely belongs in its own `describe('WR-14 — non-regular and unreadable entries...')` block (lines 181-275) alongside cases (a)-(e), or a new sibling `describe`, each with its own matching `beforeEach`/`afterEach` pair — do not add the directory fixture to the top `describe('findCurationArtifacts', ...)` block's `afterEach`, which only restores the file-shaped `wr14-secret.js` path.

**Fixture-planting helper to reuse verbatim (both describe blocks share this):**
```javascript
async function writeFile(relativePath, contents) {
  const fullPath = path.join(tmpDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, contents, 'utf8');
}
```
(present identically at both `:51-55` and `:200-204`) — the directory fixture does not need this helper (it uses `mkdirSync` + `chmodSync` directly, mirroring case (c)'s `writeFileSync` + `chmodSync` pairing), but any companion files inside the mode-000 directory (to prove `EACCES` fires on listing, not on content) should use it.

---

### 4. `scripts/lib/curation-guard.mjs` (`:83`) — WR-19 fix shape

**Analog:** the sibling `readFileSync` try/catch in the same file, `curation-guard.mjs:156-165`, quoted verbatim:
```javascript
let content;
try {
  content = readFileSync(entryPath, 'latin1');
} catch (error) {
  violations.push({
    path: entryPath,
    reason: `could not be read for scanning (${error.code ?? error.message}) — an unscannable file cannot be certified free of the "${CURATE_MARKER}" marker`,
  });
  continue;
}
```
**Imitate exactly:** the `let x; try { x = ... } catch (error) { violations.push({ path, reason: \`...(${error.code ?? error.message})...\` }); continue; }` shape. Apply the identical pattern to the unguarded `readdirSync(dir, { withFileTypes: true })` call at `walk(dir)`'s top (`curation-guard.mjs:83`):
```javascript
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    violations.push({
      path: dir,
      reason: `could not be listed (${error.code ?? error.message}) — an unreadable directory cannot be certified free of the "${CURATE_MARKER}" marker`,
    });
    return;
  }
  for (const entry of entries) { /* ... unchanged ... */ }
}
```
**Critical — do not change the fail-closed posture (RESEARCH Pitfall 6):** the catch must `violations.push(...)` and `return` (or `continue` at the loop level, matching the file-read site), never silently swallow-and-continue-as-clean. A test asserting only "does not throw" is insufficient; it must assert "returns a non-empty violations array naming the unreadable directory," exactly as `curation-guard.mjs`'s own docblock (lines 43-47) already states for the file case: "reported as violations rather than read."

---

### 5. `src/analytics/gear-aggregate-logic.test.ts` — the fixture builder that must change (D-12/D-13)

**Analog:** the file's own `makeRow` builder, `gear-aggregate-logic.test.ts:7-29`, quoted verbatim:
```typescript
/** Minimal fixture row builder — only the fields the aggregate reads matter for these tests. */
function makeRow(overrides: Partial<DashboardIndexRow> & { id: string }): DashboardIndexRow {
  return {
    startDate: '2024-06-01T09:00:00Z',
    startDateLocal: '2024-06-01T09:00:00Z',
    name: 'Test Run',
    distanceM: 10000,
    movingTimeSec: 3000,
    paceSecPerKm: 300,
    elevationGainM: null,
    avgHr: null,
    maxHr: null,
    avgCadenceRpm: null,
    location: null,
    sportType: 'Run',
    streams: { available: false, hr: false, cadence: false, elevation: false },
    lowConfidence: false,
    excludedFromRecords: false,
    prCount: 0,
    gearName: null,
    ...overrides,
  };
}
```
**Why no existing case can construct the crashing shape:** `gearName: null` is a hard-coded default field, and `overrides: Partial<DashboardIndexRow> & { id: string }` types every override key as `DashboardIndexRow`'s own field type — today `gearName: string | null` — so an override can only ever supply `string | null`, never *omit* the key entirely from the merged object (the object literal always has a `gearName` own-property because the default sets it, and `overrides` can only overwrite it with another valid value, never delete it). There is no way, using this builder as written, to produce a row whose `gearName` key is absent, which is exactly the shape that reaches `slugify(undefined)` per RESEARCH Pattern 4.

**What the builder needs to allow (once D-13 makes `gearName` optional on `DashboardIndexRow`):**
1. **No signature change is required** — `Partial<DashboardIndexRow>` already permits `gearName?: string | null | undefined` once the type itself is `gearName?: string | null`. The builder's `...overrides` spread already allows a caller to pass `gearName: undefined` explicitly and have it override the default via spread semantics (`{ gearName: null, ...{ gearName: undefined } }` → `{ gearName: undefined }` — spread does overwrite with `undefined` when the key is explicitly present in the source object, unlike `??`).
2. **The new test cases** (D-12) should call `makeRow({ id: 'x', gearName: undefined })` for the "key present but undefined" shape, and, to test the true "absent key" shape a parsed `index.json` row can produce, construct the row via `const { gearName, ...rest } = makeRow({ id: 'y' }); buildGearAggregate([rest as DashboardIndexRow])` (destructure-omit, not settable through `makeRow`'s spread contract) — or add a `delete row.gearName` step / a dedicated `makeRowWithoutGearName` helper if the planner prefers not to fight TypeScript's structural typing in-line. Either approach exercises the exact "absent key" runtime shape the requirement names, distinct from "key present, value `null`" (already covered) and "key present, value `undefined`" (new, easy).
3. **New cases to add**, following the existing `it('...', () => { ... })` phrasing style seen at `:50-66` and `:104-112`: an absent-key case, an `undefined`-value case, an empty-string (`gearName: ''`) case, and (per D-12's predicate) a malformed non-string case (e.g. `gearName: 123 as any`) — all asserting `buildGearAggregate([...])` does not throw and the row lands in the `isUnknown` bucket (reusing the existing `unknown?.label === UNKNOWN_GEAR_LABEL` assertion idiom from `:61-65`).

**Second call site to cover in the same file:** `buildGearCoverage`'s `hasGear = row.gearName !== null` (`gear-aggregate-logic.ts:207`) has an existing test block (`describe('buildGearCoverage', ...)`, `:127-172`) using the same `makeRow` builder — extend it with an absent/empty/non-string case analogous to the coverage test at `:159-171`, asserting the row is *not* counted in `runsWithGear` (same predicate widening, D-12 note: "consistency, even though ROADMAP criterion 1 only names the crash").

---

### 6. `daily-refresh.yml` — the exact step shape being deleted (and what the replacement must preserve)

**Analog:** the file's own tolerated-step pattern, `daily-refresh.yml:117-124`, quoted verbatim (one representative pair of the six being collapsed):
```yaml
      # data/dashboard/ is gitignored (regenerated every run), like data/stats/ —
      # deliberately absent from the commit step's file_pattern below.
      - name: Compute dashboard index
        id: dashboard-index
        continue-on-error: true
        run: node dist/index.js compute-dashboard-index

      - name: Warn on dashboard-index failure
        if: steps.dashboard-index.outcome == 'failure'
        run: echo "::warning::Dashboard index computation failed, the dashboard will serve a stale index"
```
And the mandatory pair that stays untouched (`daily-refresh.yml:91-92`):
```yaml
      - name: Process statistics
        run: node dist/index.js compute-stats && node dist/index.js compute-advanced-stats
```
**What is being deleted:** six `{ compute step + id + continue-on-error: true } / { paired "Warn on X failure" step gated on steps.X.outcome == 'failure' }` pairs (geocode, best-efforts, dashboard-index, age-grading, gear-aggregate, training-load) — twelve YAML steps total, each with its own inline comment explaining why its output is gitignored/absent from the commit `file_pattern`.

**What the single replacement step must preserve (per D-01's "Accepted cost" and D-03):**
1. **The mandatory-vs-tolerated split** — `compute-stats`/`compute-advanced-stats` still fail the job outright (no `continue-on-error` at the workflow level for those two logical steps, mirrored inside the command as fail-fast defaults); the other six warn-and-continue only when `--ci` is passed.
2. **The `::warning::` annotation text per failed step** — each deleted "Warn on X failure" step's message (e.g. `"Dashboard index computation failed, the dashboard will serve a stale index"`) is domain knowledge that must not be lost; fold each one into `computeAllStatsCommand`'s own per-step catch block so `--ci` mode still emits `::warning::<same message>` to stdout (GitHub Actions parses `::warning::` from any step's log, not only a dedicated step).
3. **The explanatory comments about gitignored outputs** — these existed because a human reading the workflow needed that context at the step level; since the step disappears, move the substance of each comment into `computeAllStatsCommand`'s own inline comments (the function already has this convention — see the "Chain ordering below is load-bearing" block at `src/index.ts:330-340`).
4. **The single replacement step's shape** becomes:
```yaml
      - name: Compute all statistics
        run: node dist/index.js compute-all-stats --ci
```
   replacing the "Process statistics" step (line 91-92) AND all twelve of the six-pair steps (lines 94-167) with this one step — matching D-01's literal instruction ("eight separate compute steps collapse into one").

---

## Shared Patterns

### A. `verify-dashboard-publish.mjs`'s three-part assertion helper trio — apply to all six CI-02 additions

**Source:** `scripts/verify-dashboard-publish.mjs:168-189`, quoted verbatim:
```javascript
async function expect200(baseUrl, path, { nonEmpty = true } = {}) {
  const { status, body } = await get(`${baseUrl}${path}`);
  if (status !== 200) {
    fail(`GET ${path} expected 200, got ${status}`);
    return null;
  }
  if (nonEmpty && body.length === 0) {
    fail(`GET ${path} returned 200 but an empty body`);
    return null;
  }
  ok(`GET ${path} -> 200`);
  return body;
}

async function expect404(baseUrl, path, reason) {
  const { status } = await get(`${baseUrl}${path}`);
  if (status !== 404) {
    fail(`GET ${path} expected 404 (${reason}), got ${status}`);
    return;
  }
  ok(`GET ${path} -> 404 (expected, ${reason})`);
}
```
**Apply to:** all six new CI-02 assertion blocks (`weekly-distance.json`, `monthly-stats.json`, `yearly-stats.json`, `year-over-year.json`, `best-efforts.json`, per-activity shard sample). Each follows the existing `training-load.json` template at `:329-356` — `expect200` → `if (body) { JSON.parse; if (<bad shape>) fail(...) else ok(...) }` — do not build new HTTP/fetch machinery.

### B. Runtime-derived sample selection — apply to the shard sample (D-10)

**Source:** `scripts/verify-dashboard-publish.mjs:203-205`, quoted verbatim:
```javascript
const newestRow = indexDoc.activities[0];
const newestWithStream = indexDoc.activities.find((row) => row.streams?.available === true);
const newestWithoutStream = indexDoc.activities.find((row) => row.streams?.available === false);
```
**Apply to:** picking one or more activity ids for the `best-efforts/{id}.json` shard check — same idiom, e.g. `const shardSampleIds = [newestRow.id, ...]`, derived from `indexDoc.activities` already parsed in `main()` (`:194`), never a pinned literal id.

### C. Fixture-planting + cleanup discipline — apply to WR-19's new fixture

**Source:** `scripts/lib/curation-guard.test.mjs`'s `beforeEach`/`afterEach` pair (`:33-49`) — `mkdtemp` a throwaway tree per test, chmod-restore any mode-000 target before `fs.rm(..., { recursive: true })`. Apply verbatim to the new directory fixture's own `afterEach`.

### D. try/catch → violation-object, never swallow — apply to WR-19's guard fix

**Source:** `curation-guard.mjs:156-165` (quoted in full in § 4 above). Apply to the `readdirSync` call at `:83`. The shape (`let x; try {...} catch (error) { violations.push({path, reason: \`...(${error.code ?? error.message})...\`}); continue/return; }`) generalizes across both the file-read and directory-list sites in this one file — keep the two error messages parallel in wording ("could not be read for scanning" vs "could not be listed") so a future reader recognizes them as the same defensive pattern applied twice.

---

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| D-02's `--ci` flag parsing | CLI arg handling | request-response | Zero existing `--flag`-style parsing anywhere in `src/index.ts` (confirmed by RESEARCH Pattern 2) — only positional `process.argv[2]`/`[3]` usage exists. Use `process.argv.includes('--ci')` per RESEARCH's own sketch; no repo file to copy from. |
| `node:vm` sandbox execution (D-06) | test infrastructure | transform | No file in this repo uses `node:vm` today (confirmed by RESEARCH Pattern 6). Copy RESEARCH.md's own `runBootstrap()` code sketch as the starting point instead of a repo analog. |

---

## Metadata

**Analog search scope:** `src/dashboard/` (view-registry, theme, styles + their tests), `src/analytics/` (gear-aggregate-logic + test, dashboard-index.types), `src/index.ts`, `scripts/` (verify-dashboard-publish.mjs, curation-guard.mjs + test, build-widgets.mjs), `.github/workflows/daily-refresh.yml`.
**Files scanned (read in full or targeted ranges):** 15.
**Pattern extraction date:** 2026-09-03
