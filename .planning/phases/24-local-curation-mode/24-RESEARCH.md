# Phase 24: Local Curation Mode - Research

**Researched:** 2026-08-27
**Domain:** Node built-in HTTP server + esbuild bundling for a localhost-only dev tool that augments an already-built static SPA; build-pipeline absence guards
**Confidence:** HIGH (mechanics verified directly against this repo's own source); MEDIUM on the two genuinely new design choices (re-render-via-reload, guard call-site correction) that are reasoned from the decisions rather than stated verbatim in CONTEXT.md

## Summary

Phase 24 has almost no new-technology risk — everything it needs (a static file server with a prefix mount, a build-time absence guard, an HTTP absence guard, esbuild bundling) already exists in this repo in a form that can be copied or lightly extended. `verify-dashboard-publish.mjs`'s static server (Node built-ins, `/strava-widgets` prefix mount, `safeResolve`, `expect404`) is the direct template for the curate server; `build-widgets.mjs`'s `assertNoPrivateArtifacts` is the direct template for the new curation guard. `esbuild` is already an installed devDependency at 0.27.3, so bundling the overlay needs no new package. **No new npm dependency is required anywhere in this phase.**

The real work is in getting four mechanics exactly right, none of which CONTEXT.md pins down at the code level: (1) where the guard is actually *called* in `build-widgets.mjs`'s pipeline (not where D-10's prose implies — see Pitfall 1, this is the single highest-value finding in this document), (2) how the overlay updates the already-rendered detail page after a successful write without becoming "a second renderer for one panel" (D-03 forbids this; the resolution is a full reload, which lets the existing, unmodified `detail.ts`/`detail-sections.ts` renderer repaint — see Architecture Pattern 2), (3) how `recompute`'s re-copy step avoids duplicating `build-widgets.mjs`'s `copyJsonTree` logic (extract it), and (4) how D-11's "must be proven to fail" requirement is satisfiable given this repo's vitest config only picks up `src/**/*.test.ts` and has **no DOM environment at all** — confirmed by three existing test files' own doc-comments (`row-navigation.test.ts`, `row-semantics.test.ts`, `view-registry.test.ts`), which is why D-03's `data-activity-id`/CustomEvent additions can only be proven present via the same "source-structure regression guard" pattern those files already use, not via a live DOM assertion.

**Primary recommendation:** Build `scripts/curate-server.mjs` (Node built-ins only) that (a) serves `dist/widgets` under `/strava-widgets` exactly like `verify-dashboard-publish.mjs`, injecting `<script src="/__curate/overlay.js"></script>` before `</body>` only when serving `index.html`; (b) serves the esbuild-bundled overlay at `/__curate/overlay.js` from a gitignored `.curate-dist/`, built from TypeScript source under `scripts/curate-overlay/` (deliberately outside both `src/` and any Vite config's input graph — see Architecture Pattern 1); (c) exposes `PUT /__curate/exclusions/:activityId` and `DELETE /__curate/exclusions/:activityId`, both gated by an Origin/Host check and both writing `data/best-effort-exclusions.json` then immediately mirroring it to `dist/widgets/data/best-effort-exclusions.json`; (d) exposes a streamed `POST /__curate/recompute` that spawns `compute-best-efforts` → `compute-dashboard-index` and re-copies `data/stats`/`data/dashboard`. Extract a shared `assertNoCurationArtifacts` guard into `scripts/lib/curation-guard.mjs`, call it at the **end** of `buildAllWidgets()` (after `buildDashboard()`, not inside `copyDataFiles()`), and unit-test it directly with a planted-fixture test — this is the mechanism that actually satisfies D-11.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Serve the built dashboard locally under `/strava-widgets` | Local dev server (Node built-ins, `scripts/curate-server.mjs`) | — | Mirrors production's prefix-mount shape (D-02); no framework needed, matches `verify-dashboard-publish.mjs` precedent |
| Inject the curation overlay script tag | Local dev server (response-body string patch on `index.html` only) | — | The only file that needs augmenting; every other static asset streams through unchanged |
| Curation UI (tickbox, reason textarea, Save/Remove) | Browser / Client (`.curate-dist/overlay.js`, a separate esbuild IIFE bundle) | — | Runs entirely in the browser tab; never part of the published dashboard bundle (D-01) |
| Attach point for the overlay to find the right panel | Browser / Client (published dashboard: `data-activity-id` attribute + `dashboard:best-efforts-mounted` CustomEvent) | — | Ships in the public bundle deliberately (D-03) — inert, carries no write path |
| Write `data/best-effort-exclusions.json` | Local dev server (`PUT`/`DELETE /__curate/exclusions/:id`, Node `fs` built-in) | — | Never touches git (D-09); never reachable outside `127.0.0.1` (D-12) |
| Mirror the write into the served build | Local dev server (same request handler, `fs.copyFileSync`) | — | Makes Save "instant" per D-07 without a rebuild |
| Recompute PR rankings | Local dev server (`child_process.spawn` → existing `node dist/index.js compute-best-efforts`/`compute-dashboard-index` CLI entry points) | Backend / Analytics (`src/analytics/compute-best-efforts.ts`, unchanged) | Curate never reimplements ranking logic — it only invokes the existing backend chain (D-07, avoids the two-authorities trap the folded todo's Option C rejected) |
| Prove the write path is absent from the publish bundle | Build tier (`build-widgets.mjs`, new `assertNoCurationArtifacts`) + local HTTP verifier (`verify-dashboard-publish.mjs`, new `expect404` calls) | — | Two-layer guard per D-10, mirroring `assertNoPrivateArtifacts` |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUR-01 | Toggle an activity's exclusion from PR calculations from the interface, localhost-only write path, reason required and surfaced in detail view, write path provably absent from published bundle. **Amended by this phase per D-04: whole-activity, not per-distance** — see "Editing REQUIREMENTS.md and ROADMAP.md" below. | Architecture Patterns 1-4; Code Examples (server, overlay, guard); Common Pitfalls 1-5; "The write target" section (D-05/D-08/D-09 mechanics) |

</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `npm run curate` serves the built `dist/widgets` and injects the overlay in-flight. The server streams `dist/widgets/index.html` with `<script src="/__curate/overlay.js"></script>` appended before `</body>`. The overlay is a separate esbuild bundle emitted to a gitignored directory (e.g. `.curate-dist/`) that is **never** an input to `vite.config.pages.ts` and **never** copied by `build-widgets.mjs`. Absence from the published bundle is therefore structural.
- **D-02:** Mount `dist/widgets` under `/strava-widgets`, with `/__curate/*` served outside the prefix. Matches `verify-dashboard-publish.mjs`'s deliberate prefix mount.
- **D-03:** The published dashboard gains an inert, documented attach seam — no write path. (a) `data-activity-id` on the `<section>` `buildBestEffortsSection` returns, (b) one `dashboard:best-efforts-mounted` CustomEvent carrying `{ activityId }`, dispatched from `mountBestEffortsAndBadges` **after** its `requestToken`/`mountedContainer` guard passes and the panel has been placed. Rejected: MutationObserver matching rows by label text; the overlay re-rendering the whole panel.
- **D-04:** Exclusion is whole-activity. CUR-01 and ROADMAP criterion 1 are amended in this phase to drop the per-distance clause. This is a requirements change the phase owns (edit `REQUIREMENTS.md` and `ROADMAP.md`, each with a dated note).
- **D-05:** Curate writes `distances: null` and nothing else; the read path (`buildExclusionIndex`) keeps its full tolerance for arrays/duplicates/malformed rows — do not remove that support. Unticking **deletes the entry**; must never leave `distances: []`.
- **D-06:** One reason per activity — `buildExclusionReasonIndex` is unchanged (`Map<string, string>`). The `Excluded — {reason}` badge (`detail-sections.ts:349`, via `buildPrFlagsCell`) already renders; this phase makes it reachable, not new.
- **D-07:** Save mirrors instantly (write `data/`, copy to `dist/widgets/data/`, overlay re-renders its own controls). A separate "Recompute records" control runs `compute-best-efforts` → `compute-dashboard-index` (ordering matters), streams progress, re-copies `data/stats` and `data/dashboard` into `dist/widgets`, and reloads.
- **D-08:** Two-step commit. Ticking reveals a required reason textarea and Save button; nothing is written until Save with non-empty text. An already-excluded activity loads pre-ticked with its stored reason. Unticking triggers a confirm before deleting the entry. Controls use Phase 19's shared treatment (input/textarea baseline D-01, button baseline D-05/D-06, focus ring D-09/D-10).
- **D-09:** Curate never touches git. Working-tree writes only.
- **D-10:** Two enforcement layers mirroring `assertNoPrivateArtifacts`. (a) Build-time hard-fail in `build-widgets.mjs`, beside `assertNoPrivateArtifacts` — `process.exit(1)`, never a warning. (b) HTTP assertions in `verify-dashboard-publish.mjs` using `expect404`: `/__curate/health`, `/__curate/overlay.js`, and the write endpoint all 404. `/data/best-effort-exclusions.json` must keep returning 200 — new guards must not catch it.
- **D-11:** The guard must be proven by a test that plants a regression and asserts the guard fails. Precedent: Phase 19's R3-CR-01 and Phase 23's WR-06 both recorded guards that stayed green when the thing they guarded was removed.
- **D-12:** Bind to `127.0.0.1` explicitly (never `0.0.0.0`), and reject cross-origin writes via Origin/Host header validation. Rejected: a startup session token (redundant with the Origin check).

### Claude's Discretion

- The attach seam's exact form (D-03) — resolved to `data-activity-id` + a mount event.
- The absence-proof's enforcement shape (D-10) — resolved to both layers.
- Git involvement (D-09) — resolved to none.
- Missing-build behaviour: `npm run curate` should fail fast with instructions when `dist/widgets` is not built, following `verify-dashboard-publish.mjs`'s existing FATAL block (lines 37-45) rather than silently rebuilding.
- Overlay bundling: esbuild, already a devDependency — no new dependency. The server itself should stay Node-built-ins-only.
- The Activities-list badge (`list.ts:266`) needs no change.
- Port choice for the curate server.

### Deferred Ideas (OUT OF SCOPE)

- Per-distance exclusion selectability — declined by D-04; the data model still supports it on read, so a future phase could add it without migration.
- Curation from the Records screen's PR tables — out of scope; the detail view is where the evidence lives.
- A curate view listing all current exclusions — `data/best-effort-exclusions.json` is two entries today and readable by hand.
- Records-screen curation controls, any change to what exclusion means for aggregates, the Phase 25 CI/theme items, Phase 19's open GAP 8.

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`node:http`, `node:fs`, `node:path`, `node:child_process`, `node:crypto`) | Node v25.2.1 (dev machine) `[VERIFIED: node --version]` | Curate server: static file serving, POST/PUT/DELETE body handling, spawning the recompute chain | Matches `verify-dashboard-publish.mjs` and `build-widgets.mjs`'s existing "no new dependency" style; D-01's explicit discretion note requires it |
| `esbuild` | `^0.27.3` installed (registry latest `0.28.2`) `[VERIFIED: npm view esbuild version + local node_modules/esbuild/package.json]` | Bundles the overlay TS into a single IIFE served at `/__curate/overlay.js` | Already a devDependency — zero new install. No version bump needed for this phase's needs (single-entry IIFE bundling is stable, long-supported esbuild functionality) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.0.18` (already installed) | Unit test for the extracted guard function (D-11) | Only if the guard is extracted into an importable module — see Architecture Pattern 4 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node built-in `http` server | Express/Fastify | Rejected — no new dependency is a locked constraint (D-01 discretion note), and the existing precedent (`verify-dashboard-publish.mjs`) already proves built-ins are sufficient for this exact shape (prefix mount, content-type table, 404 handling) |
| esbuild API (programmatic) | esbuild CLI via `child_process` | Both work; the programmatic API (`import * as esbuild from 'esbuild'; await esbuild.build({...})`) is simpler to invoke from `scripts/curate-server.mjs` at startup and returns errors as normal JS exceptions rather than parsing subprocess stderr — recommended |
| Full reload after Save (D-07's "the overlay re-renders") | A second panel-rendering function inside the overlay bundle | Rejected — D-03 explicitly forbids "the overlay re-rendering the whole panel" (the Phase 21 D-05 drift-seam argument). A reload lets the existing, unmodified `detail.ts`/`detail-sections.ts` renderer repaint from the now-updated file — see Architecture Pattern 2 |

**Installation:**
```bash
# No installation required — esbuild is already a devDependency (^0.27.3) and every
# other tool used (node:http, node:fs, node:path, node:child_process) is a Node built-in.
```

**Version verification:** `npm view esbuild version` returned `0.28.2` (registry latest); `node_modules/esbuild/package.json` shows `0.27.3` installed, matching `package.json`'s `^0.27.3` devDependency pin. No action needed — this phase does not require an esbuild upgrade.

## Package Legitimacy Audit

**No new external packages are installed by this phase.** Every tool this phase uses (`node:http`, `node:fs`, `node:path`, `node:child_process`, `node:crypto`, `esbuild`) is either a Node.js built-in module or an already-installed devDependency verified present in `node_modules/`. The Package Legitimacy Gate protocol (slopcheck, registry verification, postinstall-script check) is therefore not applicable — there is nothing new to audit. If a downstream planner or executor later decides a package IS needed (e.g., for a nicer diff/JSON-patch library), that decision must re-trigger this gate at that time and should be treated with suspicion given D-01's explicit "no new dependency" framing.

**Packages removed due to slopcheck [SLOP] verdict:** none (nothing new introduced)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Developer runs `npm run curate`
        │
        ▼
scripts/curate-server.mjs (Node built-ins, binds 127.0.0.1 only — D-12)
        │
        ├─ 1. FATAL-checks dist/widgets/index.html exists (mirrors verify-dashboard-publish.mjs
        │      lines 37-45) — instructs `npm run build-widgets` if missing, does not auto-rebuild
        │
        ├─ 2. esbuild.build({ entryPoints: ['scripts/curate-overlay/index.ts'], bundle: true,
        │      format: 'iife', outfile: '.curate-dist/overlay.js' }) — runs once at startup
        │
        └─ 3. http.createServer(...) — routes by req.url:

             GET  /strava-widgets/*        → safeResolve() into dist/widgets, stream file;
                                              if resolved file is index.html, inject
                                              <script src="/__curate/overlay.js"></script>
                                              before </body> in the response body (string
                                              patch, not a disk write)
             GET  /__curate/overlay.js     → serve .curate-dist/overlay.js (Content-Type: js)
             GET  /__curate/health         → 200 { status: "ok" }  (used by the overlay to
                                              confirm it's running under curate, not prod)
             PUT  /__curate/exclusions/:id → Origin/Host check → parse JSON body { reason } →
                                              upsert data/best-effort-exclusions.json →
                                              copy to dist/widgets/data/best-effort-exclusions.json
                                              → 200 { ok: true }
             DELETE /__curate/exclusions/:id → Origin/Host check → remove entry → same mirror
                                              → 200 { ok: true }
             POST /__curate/recompute      → Origin/Host check → spawn 'node dist/index.js
                                              compute-best-efforts' → on exit 0, spawn
                                              'node dist/index.js compute-dashboard-index' →
                                              on exit 0, re-copy data/stats + data/dashboard
                                              into dist/widgets/data/* → stream stdout chunks
                                              to the client as they arrive (chunked response,
                                              no library) → client reloads on completion

Browser tab (developer's machine only, http://127.0.0.1:<port>/strava-widgets/#/activity/<id>)
        │
        ├─ Loads dist/widgets/index.html (with the injected <script> tag) — the REAL,
        │  UNMODIFIED dashboard bundle. detail.ts renders exactly as it does in production.
        │
        ├─ mountBestEffortsAndBadges() resolves → buildBestEffortsSection(rows, reason,
        │  activityId) sets data-activity-id on the <section> → detail.ts dispatches
        │  `dashboard:best-efforts-mounted` with { activityId } (D-03)
        │
        ├─ .curate-dist/overlay.js (loaded via the injected tag) listens for that event,
        │  finds `section[data-activity-id="<id>"]`, and appends its own tickbox/textarea/
        │  Save/Remove controls (bare <input>/<textarea>/<button> elements — no custom CSS
        │  needed, see Pitfall 6) into that section
        │
        └─ On Save/Remove: fetch('/__curate/exclusions/<id>', { method: 'PUT'|'DELETE', ... })
           → on 200, location.reload() → the WHOLE page re-renders via the existing,
           unmodified renderer, which now reads the freshly-mirrored
           dist/widgets/data/best-effort-exclusions.json and shows the
           `Excluded — {reason}` badge for real (D-07 "the overlay re-renders" is
           satisfied by the reload, not by the overlay building panel HTML itself — D-03
           forbids that)
```

### Recommended Project Structure

```
scripts/
├── curate-server.mjs           # NEW — the Node-built-ins-only HTTP server (D-01, D-02, D-12)
├── curate-overlay/             # NEW — esbuild entry point source, TypeScript, deliberately
│   ├── index.ts                # outside src/ (tsc's rootDir) and outside every Vite config's
│   └── ...                     # input graph — see Pitfall 2 for why placement matters
├── lib/
│   └── curation-guard.mjs      # NEW — extracted, importable assertNoCurationArtifacts logic
│                                # (pure function, no process.exit) so D-11's test can call it
│                                # directly; build-widgets.mjs imports it and exits on violation
├── build-widgets.mjs           # MODIFIED — import + call assertNoCurationArtifacts at the END
│                                # of buildAllWidgets(), after buildDashboard() (Pitfall 1)
└── verify-dashboard-publish.mjs  # MODIFIED — new expect404 calls beside the /data/private/ ones

.curate-dist/                   # NEW, gitignored — esbuild output, never committed, never an
                                 # input to any build config (D-01's structural-absence guarantee)

src/dashboard/views/
├── detail.ts                   # MODIFIED — mountBestEffortsAndBadges dispatches the
│                                # CustomEvent after the panel is placed (D-03)
└── detail-sections.ts          # MODIFIED — buildBestEffortsSection gains an activityId
                                 # param, sets section.dataset.activityId (D-03)
```

### Pattern 1: The overlay lives outside every existing build's input graph

**What:** `scripts/curate-overlay/*.ts` — a TypeScript source tree that is bundled ONLY by an explicit `esbuild.build()` call inside `scripts/curate-server.mjs`, never referenced by `tsconfig.json`'s `include` (which is `["src/**/*"]`, `rootDir: "src"` `[VERIFIED: tsconfig.json]`), never an entry in `vite.config.ts`/`vite.config.pages.ts`, and never in `build-widgets.mjs`'s `widgets` array or `buildDashboard()`'s `rollupOptions.input`.

**When to use:** Any time a build output must be *structurally* impossible to reach the publish tree, not just conventionally excluded.

**Example:**
```js
// Source: scripts/curate-server.mjs (new), esbuild API pattern verified against
// the installed esbuild 0.27.3 package's documented `build()` signature
import * as esbuild from 'esbuild';

async function buildOverlay() {
  await esbuild.build({
    entryPoints: ['scripts/curate-overlay/index.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2020',        // matches every other build in this repo (build-widgets.mjs, vite.config.ts)
    outfile: '.curate-dist/overlay.js',
    logLevel: 'info',
  });
}
```

**Why not `src/curate-overlay/`:** it would be swept into `npm run build` (`tsc`, `rootDir: src`, `include: ["src/**/*"]`) and emitted into `dist/curate-overlay/*.js` — harmless (that's the backend's `dist/`, not `dist/widgets/`, and `dist/*` is gitignored except `dist/widgets/`), but it needlessly couples the overlay's TS to the backend's strict `tsconfig.json` compiler options for no benefit. Keeping it under `scripts/` sidesteps tsc, Vite, AND `build-widgets.mjs`'s widget loop simultaneously — the cleanest reading of D-01's "structural, not merely un-opted-in" absence guarantee.

### Pattern 2: Re-render via reload, not a second renderer

**What:** After a successful `PUT`/`DELETE /__curate/exclusions/:id`, the overlay calls `location.reload()` rather than rebuilding the "Best Efforts This Run" table itself.

**When to use:** Whenever D-07 ("the overlay re-renders") and D-03 ("Rejected: the overlay re-rendering the whole panel") appear to be in tension. They are not, once "re-render" is read as "cause a fresh render," not "build DOM."

**Why this is the correct reading, reasoned from the decisions (not stated verbatim — MEDIUM confidence, flag for planner/discuss confirmation):**
- D-07 requires the badge and reason to "appear at once" in the same session, without a full `compute-best-efforts` rebuild.
- D-03 explicitly rejects the overlay owning a second copy of panel-rendering logic, citing the same drift-seam argument Phase 21's D-05 used.
- The one mechanism that satisfies both: the write handler mirrors the file synchronously (`data/` → `dist/widgets/data/`), then the client does `location.reload()`. The hash route survives a reload (`#/activity/<id>` stays in the URL), so `detail.ts`'s own `loadAndRender` re-runs, `loadExclusionReason` re-fetches the now-updated `best-effort-exclusions.json`, and `buildPrFlagsCell` renders the real `Excluded — {reason}` badge — using code this phase never touches for rendering logic.
- This also naturally handles delete: the reload re-reads a file with the entry gone, and the badge disappears, with zero overlay-side DOM-diffing logic.

**Example:**
```ts
// Source: scripts/curate-overlay/exclusion-panel.ts (new)
async function saveExclusion(activityId: string, reason: string): Promise<void> {
  const response = await fetch(`/__curate/exclusions/${encodeURIComponent(activityId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    throw new Error(`Save failed: ${response.status}`);
  }
  location.reload();
}
```

### Pattern 3: The write endpoint's exclusion mutation, honoring D-05's exact JSON contract

**What:** Server-side upsert/delete against `BestEffortExclusionsFile` (`src/analytics/best-effort.types.ts:118` — the `BestEffortExclusionsFile` interface), matching `data/best-effort-exclusions.json`'s live shape exactly.

**Example:**
```js
// Source: scripts/curate-server.mjs (new) — reads/writes the SAME file
// data/best-effort-exclusions.json that best-effort-exclusions.ts's loadExclusions()
// reads (src/analytics/best-effort-exclusions.ts:87), so no schema drift is possible.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const EXCLUSIONS_PATH = 'data/best-effort-exclusions.json';
const PUBLISH_EXCLUSIONS_PATH = 'dist/widgets/data/best-effort-exclusions.json';

function upsertExclusion(activityId, reason) {
  const file = JSON.parse(readFileSync(EXCLUSIONS_PATH, 'utf8'));
  const existingIndex = file.exclusions.findIndex((e) => e.activityId === activityId);
  const entry = { activityId, distances: null, reason }; // D-05: always `distances: null`
  if (existingIndex === -1) {
    file.exclusions.push(entry);
  } else {
    file.exclusions[existingIndex] = entry; // D-08: Save on an already-excluded activity edits in place
  }
  writeAtomic(EXCLUSIONS_PATH, JSON.stringify(file, null, 2));
  copyFileSync(EXCLUSIONS_PATH, PUBLISH_EXCLUSIONS_PATH); // D-07: instant mirror
}

function removeExclusion(activityId) {
  const file = JSON.parse(readFileSync(EXCLUSIONS_PATH, 'utf8'));
  file.exclusions = file.exclusions.filter((e) => e.activityId !== activityId); // D-05: delete, never distances: []
  writeAtomic(EXCLUSIONS_PATH, JSON.stringify(file, null, 2));
  copyFileSync(EXCLUSIONS_PATH, PUBLISH_EXCLUSIONS_PATH);
}

// Atomic write: write to a sibling temp file then rename — avoids a reader (loadExclusions,
// or the browser's own fetch of the published copy) ever observing a half-written file.
// Node's fs.rename is atomic on the same filesystem, which a sibling temp file guarantees.
import { renameSync } from 'node:fs';
function writeAtomic(path, contents) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, contents, 'utf8');
  renameSync(tmp, path);
}
```

### Pattern 4: Origin/Host validation (D-12), Node built-ins only

**Example:**
```js
// Source: scripts/curate-server.mjs (new)
function isTrustedOrigin(req, expectedHost) {
  if (req.headers.host !== expectedHost) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true; // same-origin fetches from same-page JS often omit Origin
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

// In the request handler, before any write:
const expectedHost = `127.0.0.1:${port}`;
if (isWriteRoute(req) && !isTrustedOrigin(req, expectedHost)) {
  res.writeHead(403);
  res.end('Forbidden: cross-origin write rejected');
  return;
}
```

### Anti-Patterns to Avoid

- **A session token in addition to the Origin check:** explicitly rejected by D-12 as redundant — the overlay is served from the same origin the token would protect.
- **The overlay re-rendering `buildBestEffortsSection`'s output itself:** explicitly rejected by D-03 — use the reload pattern (Pattern 2) instead.
- **Matching the panel by visible text/table structure (a MutationObserver over `"400 m"` labels, etc.):** explicitly rejected by D-03 — couples curation to display strings and column order.
- **Running the full `compute-best-efforts` → `compute-dashboard-index` chain on every Save:** explicitly rejected by D-07 — it walks all ~1,868 activities' streams; that cost belongs only to the deliberate "Recompute records" press.
- **Importing `build-widgets.mjs` as a module to reuse its copy logic:** it is a self-executing script (`buildAllWidgets().catch(...)` runs at module load, line 355) — importing it from the curate server would trigger a full 11-widget Vite build. Extract the shared copy logic instead (see Pitfall 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file serving with a prefix mount, content-type resolution, path-traversal rejection | A new server from scratch | Copy `verify-dashboard-publish.mjs`'s `safeResolve`/`CONTENT_TYPES`/`createServer` pattern near-verbatim | Already solves path traversal (T-16-VF-01) and the exact GitHub-Pages-project-page prefix shape this repo needs; reinventing it risks reintroducing the root-mount bug from the Phase 16 postmortem |
| Recomputing "was this a PR" or re-ranking client-side | A browser-side ranking algorithm | The existing `compute-best-efforts`/`compute-dashboard-index` CLI chain, invoked via `child_process.spawn` | The folded todo's Option C was explicitly rejected for exactly this reason — a second ranking authority in the browser can silently disagree with the build's chronological-PR-walk logic |
| Recursively copying `data/stats`/`data/dashboard` JSON trees for the recompute step | A second, divergent copy function inside the curate server | Extract `build-widgets.mjs`'s existing `copyJsonTree` into `scripts/lib/copy-data-tree.mjs`, import it from both `build-widgets.mjs` and `scripts/curate-server.mjs` | Two independently-hand-maintained copy implementations is exactly the "two orderings of the same chain" anti-pattern CI-01 (Phase 25) already exists to close elsewhere in this repo — don't introduce a third instance of it here |
| Detecting whether the published bundle leaked the curation write path | A new bespoke scanning approach | `assertNoPrivateArtifacts`'s exact walk-and-scan shape (recursive `readdirSync`, substring scan, `process.exit(1)`) | Already proven, already reviewed, already the named precedent (D-10) |

**Key insight:** every piece of infrastructure this phase needs has a near-identical, already-shipped sibling in this same repository. The risk in this phase is not "which library" — it's "get the four mechanics exactly right" (guard call-site, re-render-via-reload, extracted copy logic, and a testable guard), which is why this document leads with those four pitfalls rather than a stack table.

## Common Pitfalls

### Pitfall 1: The curation guard's call site matters more than its shape (highest-value finding)

**What goes wrong:** D-10 says the new build-time guard should be "beside `assertNoPrivateArtifacts` and called from the same place." Read literally as "the same call site," that would mean calling `assertNoCurationArtifacts()` from inside `copyDataFiles()` — which is exactly where `assertNoPrivateArtifacts()` is called today (`build-widgets.mjs:270`, at the end of `copyDataFiles()`).

**Why it happens:** `buildAllWidgets()`'s actual pipeline order is: build the 11 widget IIFEs → `copyDataFiles()` (calls `assertNoPrivateArtifacts`) → `buildPages()` → `buildDashboard()` (`build-widgets.mjs:334-349`, verified by reading the function). `copyDataFiles()` runs **before** `buildPages()`/`buildDashboard()` execute. `assertNoPrivateArtifacts` only scans `dist/widgets/data` (the `publishDataDir` constant), which is fully populated by the time `copyDataFiles()` finishes — so calling it there is correct for that guard's job (data files only).

But a curation-artifact leak's most likely vector is NOT the data tree — the data tree is D-05's tiny hand-shaped file, nothing curate produces reaches it — the leak vector is the JS/HTML side: a future accidental import of overlay code into the dashboard's Vite entry graph, or an accidental `copyFileSync` of `.curate-dist/overlay.js` into `dist/widgets/`. Neither of those exists in `dist/widgets` until `buildDashboard()` (and `buildPages()`) finish. **A guard called at `copyDataFiles()`'s call site cannot see them — it would pass trivially (nothing to find yet) even against a real regression, which is precisely the "guard never observed failing because it fired before the artifact existed" failure mode D-11 was written to catch.**

**How to avoid:** Call `assertNoCurationArtifacts()` at the very end of `buildAllWidgets()`, after `await buildDashboard()` (`build-widgets.mjs:349`), not inside `copyDataFiles()`. It should scan the **entire** `dist/widgets` tree (all `.html`/`.js`/`.css`), not just `dist/widgets/data`. This satisfies D-10's intent (same guard shape, same `process.exit(1)` discipline, defined "beside" `assertNoPrivateArtifacts` in the file) while actually being capable of catching what it exists to catch.

**Warning signs:** If a D-11 planted-fixture test only plants the fake artifact under `dist/widgets/data/` and never under, say, `dist/widgets/assets/` or `dist/widgets/index.html`'s content, the test itself would not catch this ordering bug — write the fixture test against a full mock `dist/widgets` tree, not just the data subtree.

### Pitfall 2: This repo has NO DOM test environment — D-3's additions cannot be unit-tested by rendering

**What goes wrong:** Planning a `detail-sections.test.ts` or `detail.test.ts` that constructs a DOM and asserts `data-activity-id` is present, or that a `CustomEvent` fires, will not run — `vitest.config.ts` sets `environment: 'node'` with no jsdom/linkedom/happy-dom dependency anywhere in `package.json`. `[VERIFIED: vitest.config.ts, package.json dependency list, and three existing test files' own doc-comments]`.

**Why it happens:** This project made a deliberate choice (documented explicitly in `row-navigation.test.ts`'s header comment: *"Node-environment-only test file — this repo has no jsdom"*, and `row-semantics.test.ts`'s: *"this project has no DOM-simulation library dependency and no headless browser anywhere in it"*) to prove DOM-touching code via **source-structure text assertions** (`readFileSync` + regex/substring checks over the `.ts` source) plus the mandatory human browser checkpoint, never via a simulated DOM.

**How to avoid:** Follow the exact precedent `row-semantics.test.ts` and `row-navigation.test.ts` already set. Write a new `src/dashboard/curation-seam.test.ts` (or similarly named) that `readFileSync`s `detail.ts` and `detail-sections.ts` and asserts, as source text: `buildBestEffortsSection` is called with an activity-id argument; the returned `<section>` element sets `.dataset.activityId` (matching `list.ts:527`'s existing `tr.dataset.activityId = row.id` convention — same idiom, same file, an exact precedent already in this codebase); `mountBestEffortsAndBadges` contains the literal string `'dashboard:best-efforts-mounted'` in a `dispatchEvent`/`CustomEvent` call, positioned (via a text-offset check, mirroring `row-semantics.test.ts`'s "must appear after X" style) after the `requestToken`/`mountedContainer` guard clause. This is a green run that proves SOURCE TEXT SHAPE only — say so explicitly in the file's own header comment, exactly as the two precedent files do. Actual rendering/dispatch behavior is proven only by the human checkpoint (criterion 4).

### Pitfall 3: `build-widgets.mjs` cannot be imported as a library for the recompute re-copy step

**What goes wrong:** `scripts/build-widgets.mjs`'s last line is `buildAllWidgets().catch(error => {...})` — a top-level, unconditional self-invocation. `import`-ing this file from `scripts/curate-server.mjs` to reuse `copyJsonTree` would trigger a full rebuild of all 11 widget IIFE bundles (multiple `vite build()` calls) as a side effect of the import statement, every time the curate server starts or recomputes.

**How to avoid:** Extract `copyJsonTree` (and, if useful, the `dataDirs` list constant) into a new `scripts/lib/copy-data-tree.mjs` module with no top-level side effects — just exported functions/constants. Both `build-widgets.mjs` and `scripts/curate-server.mjs` import from there. This is a small, low-risk refactor of existing working code (mechanical extraction, no logic change) and directly enables both D-07's recompute re-copy and avoids a second, drift-prone copy implementation (see Don't Hand-Roll).

### Pitfall 4: `dist/index.js` (the backend CLI) is a separate build from `dist/widgets` (the publish tree) — the recompute chain can fail silently if it's stale or missing

**What goes wrong:** `compute-best-efforts`/`compute-dashboard-index` npm scripts run `node dist/index.js <command>` (`package.json:15-16`) — this is `tsc`'s output (`npm run build`), completely independent of `npm run build-widgets` (which produces `dist/widgets`). If a developer has never run `npm run build` (or its `dist/index.js` predates a source change), `child_process.spawn('node', ['dist/index.js', 'compute-best-efforts'])` will either fail with `Cannot find module` or silently run stale compiled logic.

**How to avoid:** Before offering the "Recompute records" action, check `existsSync('dist/index.js')` and surface a FATAL-style message (mirroring the missing-`dist/widgets` FATAL block, D-01's discretion note) instructing `npm run build` first, rather than a raw Node stack trace streamed to the overlay's progress panel. This is a real, previously-undocumented prerequisite the phase's plan should account for as an explicit check, not an assumption.

### Pitfall 5: `verify-dashboard-publish.mjs`'s server internals aren't currently reusable for a fixture-rooted D-11 test

**What goes wrong:** `ROOT` (line 18) is computed once at module scope from `process.cwd()`, and `createServer`/`main` are not exported — there is no way to point the existing verifier's server logic at a temporary fixture directory from a test file without either (a) mutating the real `dist/widgets` directory, or (b) refactoring the script to accept a root parameter.

**How to avoid — two options, pick the cheaper one first:**
1. **(Recommended, no refactor)** For the HTTP-level guard (`/__curate/health`, `/__curate/overlay.js`, the write endpoint all 404), write a `.test.ts` that plants a real fake file (e.g., `dist/widgets/__curate/overlay.js`) into the actual, already-built `dist/widgets` directory, spawns `node scripts/verify-dashboard-publish.mjs` via `child_process.execFileSync`, asserts a non-zero exit code, then deletes the fake file in a `finally`/`afterEach`. This exercises the real shipped script byte-for-byte — the strongest possible evidence for D-11 — and needs zero refactor. **Skip this test (`it.skipIf`) when `dist/widgets/index.html` doesn't exist locally**, mirroring the script's own FATAL-if-missing convention, so `npm test` doesn't break on a fresh checkout before the first `npm run build-widgets`.
2. **(Faster feedback, some refactor)** For the build-time guard specifically (`assertNoCurationArtifacts`, extracted per Pitfall 1/3), a plain unit test against a temp directory fixture is both fast and precise — no subprocess needed, since that function is pure once extracted.

### Pitfall 6: The overlay's controls need no new CSS at all — but only if built as bare elements

**What goes wrong:** Building the curate overlay's tickbox/textarea/Save/Remove controls with custom CSS classes (a `.curate-checkbox`, a `.curate-btn`) would either look inconsistent with the rest of the dashboard or require duplicating Phase 19's design tokens into a second stylesheet the overlay bundle would have to ship and inject itself.

**Why this is avoidable:** The overlay is injected into the SAME already-rendered `index.html` that already loads `src/dashboard/styles.css`, which Phase 19 gave bare-element baselines for exactly this purpose — `input, select, textarea { ... }` and `button { ... }` (19-CONTEXT.md D-01, D-05) are unscoped element selectors with **no class requirement**, explicitly written so that "any control added in Phases 20–25 (curation UI, week-start select, zoom controls) inherits the treatment for free" (19-CONTEXT.md D-01, verbatim, naming this exact phase). The two-tone focus ring (D-09/D-10) is likewise global and unscoped (`:focus-visible` with no selector scoping, D-12 of 19-CONTEXT.md).

**How to avoid the pitfall:** Build the overlay's controls as plain `document.createElement('input'|'textarea'|'button')` with no custom class names (or, if a wrapping `<div>`/`<label>` is needed for layout, give THAT a class and leave the interactive elements themselves bare). They will render with the correct border, padding, `min-height: 32px`, hover, focus-ring and disabled treatment automatically, with zero CSS shipped by the overlay bundle. This resolves the research-focus risk about Phase 19 reuse cleanly — it is not a risk once the injection point (same page, same already-loaded stylesheet) is understood.

## Code Examples

### The FATAL missing-build check (D-01 discretion, exact precedent)

```js
// Source: scripts/verify-dashboard-publish.mjs:35-45 (existing, verified) — copy this
// pattern verbatim at the top of scripts/curate-server.mjs, adjusted to name `npm run curate`.
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

### `dataset.activityId` naming precedent (already shipped, same convention D-03 should follow)

```ts
// Source: src/dashboard/views/list.ts:527 (existing, verified)
tr.dataset.activityId = row.id;
// → renders as data-activity-id="<id>" on the <tr>. D-03's `<section>` should follow the
// identical idiom: section.dataset.activityId = activityId;
```

### The `assertNoPrivateArtifacts` shape to mirror for `assertNoCurationArtifacts`

```js
// Source: scripts/build-widgets.mjs:171-206 (existing, verified) — the exact two-layer
// guard shape D-10 names as the precedent. assertNoCurationArtifacts should follow this
// walk-and-scan-and-process.exit(1) shape but scan the WHOLE dist/widgets tree (see
// Pitfall 1), not just dist/widgets/data.
function assertNoPrivateArtifacts() {
  const publishDataDir = 'dist/widgets/data';
  if (!existsSync(publishDataDir)) return;
  if (existsSync(resolve(publishDataDir, 'private'))) {
    console.error(`✗ Private-artifact guard failed: ${publishDataDir}/private exists and must never be published.`);
    process.exit(1);
  }
  // ... walk() recursively scans every .json file for forbidden substrings ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Hand-editing `data/best-effort-exclusions.json` directly | `npm run curate`'s localhost-only write path | This phase | No behavioral change to the read path (`buildExclusionIndex`/`isExcluded`/`loadExclusions` are all untouched — D-05); only the write mechanism changes |
| Per-distance exclusion selectability (original CUR-01 wording) | Whole-activity exclusion only | D-04, 2026-08-27, this phase | Requires editing `REQUIREMENTS.md` and `ROADMAP.md` — see below |

**Deprecated/outdated:**
- The original CUR-01 per-distance rationale (GPS spikes corrupt only short splits) is superseded by D-04's finding that `computeActivityEfforts` yields exactly one effort per target distance per activity and `compute-best-efforts.ts:215-219` drops it from `byDistance` entirely when excluded — so there is never a same-activity runner-up to promote, and per-distance selectivity buys nothing the engine needed. `[VERIFIED: compute-best-efforts.ts:213-227, read directly — the `continue` after `effortsExcluded++` on line 217-218 confirms the excluded effort never reaches `byDistance.get(effort.distance)!.push(...)`]`.

### Editing REQUIREMENTS.md and ROADMAP.md (D-04, phase-owned)

This phase must edit both files with a dated note pointing back at D-04. Suggested exact edits (planner should verify final wording against the live files at execution time, since other phases may have touched nearby lines):

**`REQUIREMENTS.md` line 51 (CUR-01):** append, after the existing sentence ending "...following the `assertNoPrivateArtifacts` precedent.": `**Amended 2026-08-27 (Phase 24 CONTEXT.md D-04):** exclusion is whole-activity, not per-distance — an excluded activity is withheld from PR calculations of every kind but still counts toward aggregates (distance, time, etc). The original per-distance clause is dropped: the engine emits exactly one effort per target distance per activity, so there is no same-activity runner-up a coarser exclusion could wrongly suppress.`

**`ROADMAP.md` Phase 24 criterion 1 (~line 430):** replace "toggle PR exclusion per distance — not just whole-run, since a GPS spike typically corrupts only the short splits while the same run's 5k/10k remain honest" with "toggle whole-activity PR exclusion, surfaced as an inline control on the activity detail view's 'Best Efforts This Run' panel (**amended 2026-08-27 per D-04** — the original per-distance clause is dropped, see `24-CONTEXT.md` D-04)". Criterion 4's "toggle a per-distance exclusion end-to-end" should similarly drop "per-distance."

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The reload-not-re-render resolution of the D-03/D-07 tension (Architecture Pattern 2) is the intended mechanism | Architecture Pattern 2 | If the planner intends a lighter-weight in-place DOM patch instead (e.g., the overlay directly rewriting only the flags `<td>` it can see, without touching `buildBestEffortsSection`), that's also consistent with D-03's letter (not "the whole panel") — flag for discuss/plan-check confirmation before locking the plan's task list around a full reload |
| A2 | `assertNoCurationArtifacts` should be called at the end of `buildAllWidgets()`, not inside `copyDataFiles()` (Pitfall 1) | Common Pitfalls, Pattern shape | This deviates from D-10's literal "called from the same place" phrasing. If the planner or a reviewer reads D-10 as requiring the identical call site, this needs to be resolved explicitly — the research finding is that the literal reading would make the guard functionally unable to see the JS/HTML side of a regression, which is the more likely leak vector |
| A3 | Origin/Host validation via `req.headers.origin`/`req.headers.host` (Pattern 4) is sufficient to satisfy D-12's "reject cross-origin writes" without a CSRF token | Architecture Pattern 4 | Standard practice for localhost dev servers, but not independently verified against a security standard/OWASP source in this session — flagged LOW confidence, see Security Domain |
| A4 | Recommended file/directory names (`scripts/curate-server.mjs`, `scripts/curate-overlay/`, `scripts/lib/curation-guard.mjs`, `.curate-dist/`) are naming suggestions only | Recommended Project Structure | These are not locked by CONTEXT.md (D-01 only fixes `.curate-dist/` as "e.g." for the output dir) — the planner may choose different names as long as the structural-absence properties hold |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Exact re-render mechanism after Save (see A1)**
   - What we know: D-07 says "the overlay re-renders"; D-03 forbids the overlay rebuilding the whole panel.
   - What's unclear: whether a full `location.reload()` (this research's recommendation) or a narrower, overlay-owned DOM patch of just the flags cell is intended.
   - Recommendation: lock this explicitly in planning/discuss before task-writing, since it changes what the overlay bundle needs to know about the panel's internal DOM shape (a reload needs to know nothing beyond the attach seam; a patch needs to know the flags `<td>` structure, coupling it more tightly to `detail-sections.ts`).

2. **Guard call-site correction (see A2)**
   - What we know: the literal call site D-10 names (same place as `assertNoPrivateArtifacts`, i.e. inside `copyDataFiles()`) runs before `buildPages()`/`buildDashboard()` populate the rest of `dist/widgets`.
   - What's unclear: whether this is a genuine oversight in D-10's phrasing (most likely, since D-10's own intent — proving absence from "the published bundle" — requires scanning the built dashboard, not just the data copy) or whether the developer specifically wants the check scoped to the data tree only.
   - Recommendation: treat this as settled in favor of "end of `buildAllWidgets()`, whole-tree scan" (this research's position) unless the discuss/plan-check step surfaces a reason to keep it narrower — the whole-tree scan is strictly more capable and costs nothing extra (one more recursive walk over an already-small tree).

3. **Port choice (explicitly Claude's Discretion in CONTEXT.md)**
   - What we know: no port is specified; `verify-dashboard-publish.mjs` uses `server.listen(0, '127.0.0.1')` (OS-assigned ephemeral port) since it's a short-lived test run.
   - What's unclear: whether curate should use a fixed, memorable port (so the developer can bookmark `http://127.0.0.1:5175/strava-widgets/`) or an ephemeral one (printed to the console each run).
   - Recommendation: a fixed port (e.g., 4173, matching Vite preview's conventional default, or any unused port) is more usable for a tool the developer returns to repeatedly across a curation session — recommend fixed over ephemeral, but this is genuinely discretionary.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Curate server, esbuild invocation | ✓ | v25.2.1 `[VERIFIED: node --version]` | — |
| esbuild (devDependency) | Overlay bundling | ✓ | 0.27.3 installed `[VERIFIED: node_modules/esbuild/package.json]` | — |
| `dist/widgets` (built publish tree) | Curate server's static-serve target | Not checked this session — build-dependent, not environment-dependent | — | `npm run build-widgets` (curate must FATAL-check this at startup, per D-01 discretion) |
| `dist/index.js` (compiled backend CLI) | Recompute chain (`compute-best-efforts`/`compute-dashboard-index`) | Not checked this session — build-dependent | — | `npm run build` (curate's recompute action should FATAL-check this, see Pitfall 4) |

**Missing dependencies with no fallback:** none — everything required is either already installed or produced by an existing, already-documented `npm run` script.

**Missing dependencies with fallback:** `dist/widgets` and `dist/index.js` are build outputs, not installable dependencies — both have a clear, single-command fallback (`npm run build-widgets` / `npm run build`) that this phase's server code should surface as an explicit, actionable error rather than a stack trace.

## Validation Architecture

`workflow.nyquist_validation: true` in `.planning/config.json` `[VERIFIED: read directly]` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest `^4.0.18`, `environment: 'node'`, **no DOM library** (`vitest.config.ts`: `include: ['src/**/*.test.ts']`) `[VERIFIED]` |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm test` (currently 55 test files under `src/**` at time of research, per `find` count) |

**Critical constraint carried into this phase's plan:** the vitest `include` glob is `src/**/*.test.ts` only. A D-11 test for the extracted `scripts/lib/curation-guard.mjs` function needs one of: (a) widen `include` to also match `scripts/**/*.test.mjs` (small, low-risk config change — recommended, since it keeps the test colocated with the code it tests, following this repo's universal "test next to source" convention), or (b) place the test under `src/` and import the sibling `scripts/` module via a relative path crossing the boundary (works, but is an unprecedented cross-directory import in this codebase — no existing file does this).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUR-01 (write mechanics) | `upsertExclusion`/`removeExclusion` produce the exact D-05 JSON shape (`distances: null`, entry deletion, never `distances: []`) | unit | `npx vitest run scripts/curate-server.test.mjs` (new, needs include-glob widening) or `src/`-colocated equivalent if the write functions are extracted similarly to the guard | ❌ Wave 0 |
| CUR-01 (D-03 attach seam) | `data-activity-id` present, `dashboard:best-efforts-mounted` dispatched after the guard, before/after ordering correct | source-structure (text) | `npx vitest run src/dashboard/curation-seam.test.ts` (new — follows `row-semantics.test.ts`/`row-navigation.test.ts` precedent exactly) | ❌ Wave 0 |
| CUR-01 (D-10/D-11 build-time guard) | `assertNoCurationArtifacts` (extracted, pure) returns violations when a fake curate artifact is planted in a fixture tree, and an empty list against a clean tree | unit, planted-fixture | `npx vitest run scripts/lib/curation-guard.test.mjs` (new, needs include-glob widening) | ❌ Wave 0 |
| CUR-01 (D-10/D-11 HTTP guard) | `verify-dashboard-publish.mjs` (the real, shipped script, via subprocess) exits non-zero when a fake `/__curate/*` file is planted in the real `dist/widgets`, and exits 0 when clean | integration, subprocess, planted-fixture | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` (new; `it.skipIf(!existsSync('dist/widgets/index.html'))`) | ❌ Wave 0 |
| CUR-01 (D-12 Origin/Host check) | Write endpoints reject a request with a mismatched Origin/Host, accept one with a matching Origin/Host | unit (if `isTrustedOrigin` extracted as a pure function) | `npx vitest run scripts/curate-server.test.mjs` | ❌ Wave 0 |
| CUR-01 (criterion 1, 2, 4) | End-to-end: toggle, reason required, lands in file, renders in detail view; production build has no reachable write endpoint | **manual-only** | N/A — human checkpoint, criterion 4 | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run <touched test files>` (fast — none of the above are slow; the subprocess guard test is the slowest at roughly the same cost as `verify-dashboard-publish.mjs`'s own ~1s runtime)
- **Per wave merge:** `npm test` (full 55+ file suite) + `npm run build-widgets` + `npm run verify-dashboard`
- **Phase gate:** Full suite green, `verify-dashboard-publish.mjs` green (including the two new guard checks), then the mandatory human browser checkpoint (criterion 4) — this project's own `REQUIREMENTS.md` Verification Note states automated tests cannot discharge UI/interaction requirements and every v2.1 phase ends with a human browser checkpoint; CUR-01's UI-facing half is no exception even though it is a "Carried Forward from v2.0" requirement, not a v2.1 UI-XX one.

### Wave 0 Gaps

- [ ] `vitest.config.ts` — widen `include` to `['src/**/*.test.ts', 'scripts/**/*.test.mjs']` (or equivalent), needed by every new script-level test above
- [ ] `scripts/lib/curation-guard.mjs` — extraction target, must exist before its test can be written
- [ ] `scripts/lib/copy-data-tree.mjs` — extraction target for the recompute re-copy step (Pitfall 3), shared by `build-widgets.mjs` and `scripts/curate-server.mjs`
- [ ] `src/dashboard/curation-seam.test.ts` — new source-structure test file, no framework install needed (follows existing precedent exactly)

*(No existing test infrastructure gaps beyond the ones listed — vitest itself is fully configured and sufficient; only the include glob needs widening.)*

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled per instructions.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No user accounts; single-developer localhost tool. Access control is physical-machine + port-binding, not credential-based (matches D-12's explicit rejection of a session token) |
| V3 Session Management | No | No sessions — every write request is independently Origin/Host-validated |
| V4 Access Control | Yes | `server.listen(port, '127.0.0.1')` (never `0.0.0.0`) is the primary control (D-12); Origin/Host header validation on every write route is the secondary control, closing the "another browser tab on the same machine" and DNS-rebinding gaps that binding alone leaves open (D-12's own stated rationale) |
| V5 Input Validation | Yes | `activityId` from the URL path must be validated against the existing `isValidActivityId` pattern (`src/dashboard/router.ts`, already imported by `detail.ts` — reuse it server-side too, don't write a second regex) before it's used to construct a file path or JSON key; `reason` must be validated non-empty-string server-side (never trust the client-side "required" enforcement alone, per D-08) |
| V6 Cryptography | No | No secrets, no tokens (D-12 explicitly rejects a session token), no encryption need |
| V12 File and Resources | Yes | `safeResolve`'s existing path-traversal rejection (`verify-dashboard-publish.mjs:64-80`, guards T-16-VF-01) must be reused/mirrored for the static-serve half of the curate server; the write endpoints write to a single, hardcoded path (`data/best-effort-exclusions.json`) never derived from user input, so no traversal surface exists there by construction |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| DNS rebinding / another origin on the same machine issuing a write | Spoofing / Tampering | Origin/Host header validation (Pattern 4) — this is D-12's own stated threat model, not a research addition |
| Path traversal via `req.url` reaching outside `dist/widgets` | Tampering / Information Disclosure | Reuse `safeResolve`'s existing `resolved.startsWith(ROOT + '/')` check verbatim |
| A malformed/oversized POST/PUT body crashing the server or writing garbage into `best-effort-exclusions.json` | Denial of Service / Tampering | Cap body size while reading (Node's raw `req.on('data', ...)` accumulation has no built-in limit — add an explicit byte-count guard, e.g. reject bodies over ~10KB, since a reason string is never legitimately large), and `JSON.parse` inside a try/catch that responds 400 rather than crashing the process |
| `__proto__`/prototype-pollution via a crafted `activityId` or `reason` JSON key | Tampering | `records-logic.ts:82`'s existing `activityId === '__proto__'` check is the precedent (`buildExclusionReasonIndex`) — mirror it in the write handler's activityId validation, and never use the parsed request body as a plain object key without this check |

## Sources

### Primary (HIGH confidence — direct repo inspection)
- `scripts/verify-dashboard-publish.mjs` (full file read) — static server, `MOUNT_PREFIX` shape, `expect404`/`expect200`, FATAL block, private-config guards, exclusions-file assertion
- `scripts/build-widgets.mjs` (full file read) — `assertNoPrivateArtifacts`, `dataDirs`/`dataFiles`, `copyJsonTree`, `copyDataFiles`, `buildAllWidgets` pipeline order
- `src/dashboard/views/detail.ts`, `src/dashboard/views/detail-sections.ts` — `mountBestEffortsAndBadges`, `loadExclusionReason`, `buildBestEffortsSection`, `buildPrFlagsCell`, exact call graph and guard placement
- `src/analytics/best-effort.types.ts`, `src/analytics/best-effort-exclusions.ts`, `src/analytics/compute-best-efforts.ts` (lines 190-245), `data/best-effort-exclusions.json` — exact schema, tolerance contract, exclusion-drop logic proving D-04's rationale
- `src/dashboard/views/records-logic.ts` (`buildExclusionReasonIndex`) — reason-index shape, `__proto__` guard precedent
- `src/dashboard/views/list.ts:527` — `dataset.activityId` naming precedent
- `vitest.config.ts`, `tsconfig.json`, `vite.config.ts`, `vite.config.pages.ts`, `package.json` (scripts, dependencies, devDependencies) — build/test infrastructure boundaries
- `.gitignore` — confirms `data/best-effort-exclusions.json` is tracked (not gitignored) while `data/dashboard/`, `data/stats/` are gitignored/regenerated
- `row-navigation.test.ts`, `row-semantics.test.ts`, `view-registry.test.ts` (doc comments) — confirms no DOM test environment, establishes the source-structure-test precedent
- `.planning/phases/24-local-curation-mode/24-CONTEXT.md`, `.planning/phases/19-design-system-control-styling/19-CONTEXT.md`, `.planning/phases/19-design-system-control-styling/19-UI-SPEC.md` — locked decisions, control-styling baseline
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/todos/pending/2026-08-12-exclusion-tickbox-local-curation-mode.md` — requirement text, roadmap criteria, project history, origin todo (Options A/B/C analysis)
- `npm view esbuild version` (0.28.2 registry latest), `node_modules/esbuild/package.json` (0.27.3 installed), `node --version` (v25.2.1) — direct tool verification

### Secondary (MEDIUM confidence)
- None — every claim in this document traces to a direct repository read or a documented, explicit reasoning chain from CONTEXT.md's own text (flagged as such in the Assumptions Log where the reasoning goes beyond CONTEXT.md's literal wording).

### Tertiary (LOW confidence)
- The Origin/Host validation pattern (Architecture Pattern 4, ASVS V4) is standard Node.js localhost-dev-server practice but was not cross-checked against an OWASP/ASVS source document in this research session — flagged in the Security Domain section and Assumptions Log (A3).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every tool version-verified directly against `node_modules`/`npm view`/`node --version`
- Architecture: HIGH for the server/guard/copy patterns (all mirror existing, working code read in full); MEDIUM for the reload-vs-patch resolution of the D-03/D-07 tension (reasoned, not stated verbatim — see A1) and the guard call-site correction (reasoned, not stated verbatim — see A2)
- Pitfalls: HIGH — all six are grounded in direct source reads (exact line numbers cited), not speculation
- Validation architecture: HIGH on the constraint (no DOM environment, `include` glob) — directly verified; MEDIUM on the specific new test file layout recommended, since it's a new pattern this phase introduces (extending vitest to `scripts/`) rather than a pre-existing one

**Research date:** 2026-08-27
**Valid until:** 30 days (stable, low-churn domain — Node built-ins and this repo's own existing scripts don't move quickly; re-verify esbuild version if this phase slips past a minor esbuild release)
