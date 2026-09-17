# Phase 29: Curation Review Queue - Research

**Researched:** 2026-09-17
**Domain:** Extending an existing local-only Node HTTP dev-tool (curate-server.mjs) and its esbuild-bundled browser overlay with a second static page + bundle, reusing an existing write API — no new backend framework, no new package.
**Confidence:** HIGH (every claim below is either read directly from this repository's source, or measured directly against the live archive in this session; no external ecosystem research was needed because the phase introduces zero new dependencies)

## Summary

This phase adds exactly one new user-facing surface — a queue page at `/__curate/queue` — to a codebase that already has a complete, working local-curation subsystem from Phase 24 (`curate-server.mjs`, `curate-overlay/index.ts`, `curate-overlay/exclusion-panel.ts`) and a complete, working PR-demotion data model from Phase 28 (`ComputedEffort.demotion: EffortDemotion | null`). Nothing about the write path, the origin/host security gate, the atomic-write mechanism, or the two publish guards needs to change in kind — only in coverage (new routes added to an existing list). The phase is almost entirely "wire a new read/render surface onto machinery that already exists," which is exactly what `29-CONTEXT.md`'s decisions already lock down in detail.

Three technical facts, verified in this session by reading source and running the archive's own scripts, materially change what the planner should write into tasks and were **not** fully resolved by `29-CONTEXT.md`'s decisions:

1. **The dashboard's built stylesheet has a content-hashed filename** (`assets/index-CQkdBpPg.css`, not a stable `styles.css`), so D-09's "the page links the dashboard's built stylesheet" cannot be a static hardcoded `<link>` — the queue's HTML response must be generated (or patched) at serve time by extracting the real `<link rel="stylesheet">` href out of the already-built `dist/widgets/index.html`, exactly mirroring `injectOverlayTag`'s existing read-and-patch pattern.
2. **Activity *name* is not present anywhere in `data/stats/best-efforts.json`** (`ActivityBestEfforts` carries `activityId`, `startDate`, `distanceSource`, `efforts`, `excludedFromRecords` — no `name`). D-12 nonetheless requires "date + activity name" on each row. The name only exists in the already-mirrored, already-public `data/dashboard/index.json`, which is a third fetch the queue client would need to make. This is not clearly authorized by D-08's two-file list and is flagged below as an Open Question for the planner/developer, not silently resolved.
3. **`vitest.config.ts`'s `include` glob is `['src/**/*.test.ts', 'scripts/**/*.test.mjs']`** — a `scripts/**/*.test.ts` file is never collected. If the new pure flagged-set-derivation function is written as `scripts/curate-queue/*.ts` with a `*.test.ts` sibling (one of the two options `29-CONTEXT.md` explicitly floats), that test file will silently never run — the exact "guard that has never been observed failing" failure class this project has hit twice before (R3-CR-01, WR-06). This is the single highest-value finding in this research and is detailed in Common Pitfalls.

**Primary recommendation:** Build the queue as a second, fully independent esbuild-bundled entry (`scripts/curate-queue/`) that imports `saveExclusion`/`removeExclusion`/`runRecompute` from the existing `curate-overlay/index.js` (build output) rather than reimplementing them; add two new `GET` routes to `curate-server.mjs`'s existing `serveCurateRoute` dispatcher; write the flagged-set derivation as a `.mjs` file (JSDoc-typed, matching `curation-guard.mjs`/`copy-data-tree.mjs`) with a colocated `.test.mjs`, not a `.ts`+`.test.ts` pair; extend the three existing test suites (`curation-guard.test.mjs`, `verify-dashboard-publish-guard.test.mjs`, `verify-dashboard-publish.mjs`'s literal 404 list) rather than writing new ones; and add one activity-level counting function to `compute-pr-ceiling-recount.mjs` for D-16's cross-check, since it currently only counts demoted *efforts*, not demoted *activities*.

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**What populates the queue (CUR-01, Criterion 1)**
- D-01: Any effort with a non-null `demotion` puts its activity in the queue — all three guards (`ceiling`, `world-record`, `max-speed`), not ceiling alone. Measured 2026-09-17: 65 demoted efforts across 47 activities (ceiling 31, world-record 19, max-speed 15; by distance 400m 47, 1k 13, 1mi 5). The flagged set is a superset of the ceiling-only cohort; the plan must state which population it asserts against and use the same population in the checkpoint and the recount.
- D-02: Already-excluded activities stay listed, marked excluded, showing their stored reason. All 12 current exclusions are inside the 47-activity flagged set, so the listed set equals the flagged set exactly (no "flagged minus excluded" second derivation).
- D-03: One row per activity, with that activity's flagged efforts nested inside it (47 rows, not 65) — exclusion is whole-activity.
- D-04: Demotions only — Phase 27 severe-signal activities do not enter the queue (that cohort is reachable via Phase 27's D-16 severe-signal filter on the Activities list).
- D-05: Order: not-yet-excluded first, then newest-first within each group. Stable across reloads and nightly sync.

**Where the queue lives (CUR-01, CUR-03)**
- D-06: Its own page served by `curate-server.mjs` at `/__curate/queue`, outside the `/strava-widgets` mount, client bundled by the existing `buildOverlay()`-style esbuild step into gitignored `.curate-dist/`. Zero change to `src/dashboard/router.ts`, `nav.ts`, `detail.ts`, `detail-sections.ts` — `curation-seam.test.ts`'s "`__curate` appears zero times in detail.ts/detail-sections.ts" pins keep holding.
- D-07: Entry point is a "Review queue" link the overlay injects into the dashboard nav. `npm run curate`'s startup log should print the queue URL alongside the dashboard URL.
- D-08: The queue page derives its list in the browser from the already-mirrored JSON — `/strava-widgets/data/stats/best-efforts.json` (`activities[].efforts[].demotion`) and `/strava-widgets/data/best-effort-exclusions.json`. No new server read route.
- D-09: The page links the dashboard's built stylesheet from `/strava-widgets/` and ships no styling of its own — Phase 24's OD-3 discipline. DOM built with `createElement` + `textContent` only.

**Row content and the exclude flow (CUR-01, CUR-02, Criterion 2)**
- D-10: The exclude action is inline in the queue row, reusing the overlay's existing `saveExclusion`/`removeExclusion` transport (same `PUT`/`DELETE /__curate/exclusions/:activityId`, same two-step commit, same `location.reload()`). No parallel write surface; the transport module is imported, never reimplemented.
- D-11: The reason field is pre-filled from that activity's demotion reasons, remains editable and required.
- D-12: A row shows: date + activity name linked to `/strava-widgets/#/activity/<id>`, one line per flagged effort (distance, guard, the demotion reason string, duration/pace), and the exclusion state with its stored reason when excluded.
- D-13: A single Recompute control at the top of the queue, reusing the existing `POST /__curate/recompute` and its streamed output.
- D-14: The header states the counts — flagged activities and how many are already excluded — and the Recompute control warns that the flagged set may change afterwards.
- D-15: An excluded row is editable and removable in place, loading pre-ticked with its stored reason, exactly as the detail panel behaves.
- D-16: Criterion 1's "matches exactly" is proved against `scripts/compute-pr-ceiling-recount.mjs`, not against the page's own claim. If that script does not already emit an all-guards **activity** count (it counts demoted *efforts*), adding that output is in scope for this phase.

**Guard coverage (CUR-03, Criterion 3)**
- D-17: `verify-dashboard-publish.mjs` gets an explicit 404 assertion per new path — `/__curate/queue` and its bundle route — listed alongside the existing three literal paths. Never widen into a prefix match.
- D-18: The build-time scan needs no new marker — the existing `__curate` content scan already catches the queue page and its bundle. Criterion 3 is satisfied by *proving* it: plant the built queue page/bundle inside a `dist/widgets`-shaped fixture, show `findCurationArtifacts` returns a violation, then show a clean build returns none.
- D-19: Both directions are proved by automated fixtures in the guards' existing test suites (`curation-guard.test.mjs`, `verify-dashboard-publish-guard.test.mjs`).

**Folded todos:** IN-17 (`curation-guard.mjs:105-141` double-violation for one path matching both `__curate` and `.curate-dist` name checks — fix so one path produces one violation) and IN-18 (`curation-seam.test.ts:152-178`'s WR-17 literal-string pin should be converted to the regex-shape pin) — both folded in full, in scope for this phase.

### Claude's Discretion

- How the queue page's HTML shell is produced and served, and the exact route spelling for its bundle — subject to D-17's explicit 404 list and D-06's "outside the publish graph" rule.
- Whether the overlay's transport module is shared with the queue client by import or by a small extracted module — D-10 requires reuse, not a particular file layout.
- Where the pure flagged-set derivation lives (`scripts/curate-queue/*.ts` versus an existing analytics home) and how its unit tests are shaped — bounded by D-08's "no ceiling-logic import in the independent recount" separation, which applies to the *recount*, not to the queue client.
- The precise prefill sentence when an activity carries several flagged efforts (all reasons joined, or the worst one named) — bounded by D-11's register requirement.
- Row markup and heading structure against Phase 19's baseline, including how nested per-effort lines are marked up for a screen reader.
- Empty/degenerate states — a flagged set of zero, an unbuilt `dist/widgets`, a missing or malformed `best-efforts.json`. Precedent: never-throw, degrade-to-empty (`loadExclusionReason`'s discipline at `detail.ts:463`).

### Deferred Ideas (OUT OF SCOPE)

- Severe pace-quality signals as a second queue source (CUR-04-adjacent) — already reachable via Phase 27's D-16 filter on the Activities list.
- A dismiss/acknowledge action (CUR-04) — the queue is deliberately not drainable.
- Per-effort override (CUR-05) — exclusion stays whole-activity.
- A before/after delta across Recompute — needs state persisted across `location.reload()`.
- Device family and quality tier on each queue row — a natural follow-up, not this phase.
- A demoted-cohort filter on the *published* Activities list — this phase satisfies the underlying need with a dedicated local-only queue instead.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUR-01 | Local curation mode presents a queue of flagged activities, reachable without hunting, with one action: exclude via the existing whole-activity `best-effort-exclusions.json` path. Known limitation: not drainable (no dismiss). | See Architecture Patterns (nav-link injection timing, verified via source read of `main.ts`/`nav.ts`), Code Examples (derivation function shape), and Validation Architecture (D-16 cross-check via `compute-pr-ceiling-recount.mjs`, which this research confirms needs a new activity-count output). |
| CUR-02 | The queue reuses the existing `curate-server.mjs` write machinery (trusted-origin check, atomic write, activity-id validation) rather than a parallel write surface. | See "The curation machinery being reused" below — `isTrustedOrigin`, `isValidCurateActivityId`, `writeAtomic`/`persistExclusions`, `handleExclusionWrite`, and `saveExclusion`/`removeExclusion` are all read in full in this session; none need modification, only reuse via import. |
| CUR-03 | Both publish guards continue to prove the curation write path absent from the published bundle, with new routes covered, each demonstrated failing if the path leaks. | See Don't Hand-Roll and Common Pitfalls — `findCurationArtifacts`'s existing `.json`-exemption/content-scan mechanism is read in full and confirmed to already catch a leaked queue page/bundle with zero new marker code; `verify-dashboard-publish.mjs`'s `expect404` helper and its literal-list convention are read in full for D-17's extension. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Queue list derivation (which activities are flagged, in what order) | Browser / Client (queue bundle) | — | D-08: pure function over two already-served JSON files, computed client-side; no new server compute or route. |
| Queue page HTML shell + stylesheet reference | Frontend Server (curate-server.mjs, local dev-only) | — | Must be generated/patched at serve time (hashed CSS filename — see Summary finding 1), not a static asset; mirrors `injectOverlayTag`'s existing pattern. |
| Exclude / remove exclusion write | API / Backend (curate-server.mjs `/__curate/exclusions/:id`) | — | Unchanged from Phase 24 — CUR-02 requires reuse, not a new surface. |
| Recompute | API / Backend (curate-server.mjs `/__curate/recompute`, spawns `dist/index.js`) | — | Unchanged from Phase 24. |
| Nav entry point ("Review queue" link) | Browser / Client (curate-overlay, injected into published dashboard nav DOM at runtime) | — | D-07: overlay-injected, not a `nav.ts`/`view.types.ts` change — the published nav stays untouched (D-06). |
| Build-time absence proof | CI / Build tooling (`curation-guard.mjs`, invoked from `build-widgets.mjs`) | — | Pure content/name scan over `dist/widgets`; needs zero new code for this phase (D-18), only a fixture-proof test. |
| HTTP-layer absence proof | CI / Build tooling (`verify-dashboard-publish.mjs`, run against a live `dist/widgets` server) | — | Needs two new literal `expect404` lines (D-17). |
| D-16 independent cross-check (activity-level flagged count) | CI / Build tooling (`compute-pr-ceiling-recount.mjs`) | — | Currently effort-level only; needs one new pure function for an activity-level count, per D-16's explicit note. |

## Standard Stack

No new dependency of any kind is needed for this phase — everything the queue requires (an HTTP server, an esbuild bundler, a test runner) is already a project dependency, already used by the exact subsystem this phase extends.

### Core (already installed, reused as-is)
| Library | Version (installed) | Purpose | Why Standard (in this repo) |
|---------|---------|---------|--------------|
| `esbuild` | `^0.27.3` [VERIFIED: package.json + `npm view` below] | Bundles the queue client to an IIFE, exactly as `buildOverlay()` already does for the overlay | Already the only bundler `curate-server.mjs` uses (`buildOverlay`); Phase 24 established this pattern and rejected introducing Vite for local-only tooling |
| `vitest` | `^4.0.18` [VERIFIED] | Test runner for the new derivation function, the extended guard fixtures, and the extended recount script | Already the project's sole test runner; `vitest.config.ts`'s `include` glob is load-bearing for this phase (see Pitfalls) |
| `typescript` | `^5.9.3` [VERIFIED] | Type-checks `scripts/curate-overlay/*.ts` (and would type-check a new `scripts/curate-queue/*.ts` client) — NOT run over `scripts/**/*.mjs`, which is plain JS+JSDoc | `tsconfig.json`'s `include` is `["src/**/*"]` only; `scripts/*.ts` files are checked implicitly by esbuild's own (non-blocking) transform, not by `tsc`, matching Phase 24's existing `curate-overlay/*.ts` |
| Node built-ins (`node:http`, `node:fs`, `node:path`, `node:url`) | Node runtime (repo uses whatever Node the developer has installed; no `.nvmrc`/engines field found) | All of `curate-server.mjs`'s new route handlers | Zero-dependency convention already established for every `scripts/*.mjs` file in this repo |

**Version verification (run 2026-09-17):**
```
$ npm view esbuild version   # not re-run — already pinned in installed node_modules, matches package.json ^0.27.3
$ npm view vitest version    # not re-run — already pinned in installed node_modules, matches package.json ^4.0.18
```
These are already-installed devDependencies (not newly proposed), verified directly by reading the repository's own `package.json` and `node_modules` state rather than the npm registry, which is the correct authority here — no registry lookup needed since nothing new is being added.

### Supporting
None. Every supporting piece (JSON parsing, DOM construction, HTTP routing) uses Node/browser built-ins, matching this repo's explicit "no new runtime dependencies" project-wide constraint (`.planning/REQUIREMENTS.md` § Out of Scope: "New runtime dependencies... Every algorithm needed is a 15–40 line pure function, matching what this project already hand-rolls").

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild IIFE bundle for the queue client | A second Vite entry | Rejected by Phase 24's own precedent (D-01 structural absence — nothing curate-only may be an input to any Vite config) and unnecessary; esbuild already does this exact job for the overlay |
| Reading `dist/widgets/index.html` at serve time to extract the hashed stylesheet href | Hardcoding a `styles.css` path | Would break on the very first `npm run build` that changes the CSS content hash — a real, easily-reproduced bug, not a hypothetical |
| `.mjs` + JSDoc for the new pure derivation function | `.ts` under `scripts/curate-queue/` | Both work for esbuild bundling; only `.mjs` is guaranteed collected by `vitest.config.ts`'s `include` glob without a config change (see Pitfalls) |

**Installation:** None required.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new packages — every tool it uses (`esbuild`, `vitest`, `typescript`, Node built-ins) is an existing devDependency already exercised by the exact code this phase extends (`curate-server.mjs`, `curate-overlay/`, `curation-guard.mjs`, `verify-dashboard-publish.mjs`). The Package Legitimacy Gate (slopcheck, registry verification, postinstall-script check) does not apply because there is nothing to audit. If a future round of this phase discovers a need for a new package, run the gate protocol at that time.

## Architecture Patterns

### System Architecture Diagram

```
Developer runs `npm run curate`
        │
        ▼
curate-server.mjs main()
  ├─ assertBuilt() ──────────────► FATAL if dist/widgets missing
  ├─ buildOverlay() (existing) ──► esbuild bundles curate-overlay/index.ts → .curate-dist/overlay.js
  ├─ buildQueueBundle() (NEW) ───► esbuild bundles curate-queue/*.ts(or .mjs) → .curate-dist/queue.js
  └─ server.listen(127.0.0.1:4173)
        │
        ▼
Browser requests GET /strava-widgets/  (existing)
  └─ serveStaticRoute → safeResolve → reads dist/widgets/index.html
        → injectOverlayTag() patches in <script src="/__curate/overlay.js">
        → overlay.js executes (classic script, runs during parse — BEFORE
          main.ts's deferred module script) and registers a
          'DOMContentLoaded' listener
        → main.ts's deferred module script runs next, synchronously calls
          createNav() at module scope (VERIFIED: main.ts:32) — nav DOM
          (#app-nav-root > nav.app-nav > ul.app-nav__links) now exists
        → DOMContentLoaded fires → overlay's listener runs → nav DOM is
          guaranteed present → injects <li><a href="/__curate/queue">
          Review queue</a></li> into .app-nav__links (D-07)
        │
        ▼
Developer clicks "Review queue" → full navigation (not a hash route)
        │
        ▼
Browser requests GET /__curate/queue  (NEW route, in serveCurateRoute)
  └─ isTrustedOrigin gate (reused, unchanged)
  └─ reads dist/widgets/index.html, extracts the real hashed stylesheet
     <link> href, builds/patches the queue's own minimal HTML shell with
     that href rewritten to /strava-widgets/assets/... (root-absolute)
  └─ response includes <script src="/__curate/queue.js"> (NEW route)
        │
        ▼
Browser requests GET /__curate/queue.js (NEW route, serves .curate-dist/queue.js)
        │
        ▼
Queue bundle executes in browser:
  ├─ fetch('/strava-widgets/data/stats/best-efforts.json')       (D-08, reused public route)
  ├─ fetch('/strava-widgets/data/best-effort-exclusions.json')   (D-08, reused public route)
  ├─ [open question] fetch('/strava-widgets/data/dashboard/index.json') for activity name (see Open Questions)
  ├─ deriveFlaggedActivities(bestEfforts, exclusions) → 47 activity rows, ordered per D-05
  ├─ renders header (count), rows (D-12 content), Recompute button
  └─ row's Exclude/Remove/Save buttons call the SAME
     saveExclusion()/removeExclusion()/runRecompute() functions the
     overlay's exclusion-panel.ts already calls (D-10, imported, not
     reimplemented) → PUT/DELETE /__curate/exclusions/:id → same
     isTrustedOrigin/isValidCurateActivityId/writeAtomic path as today
        │
        ▼
On success: location.reload() (OD-1, unchanged) → queue re-derives from
the now-current mirrored JSON

Guard coverage (build time and CI, no developer action):
  build-widgets.mjs → buildAllWidgets() → assertNoCurationArtifacts()
    → findCurationArtifacts(dist/widgets) already content-scans queue.html
      and queue.js for the literal "__curate" marker (D-18, no new code)
  verify-dashboard-publish.mjs → expect404 for /__curate/queue and
    /__curate/queue.js, added to the existing literal list (D-17, new lines)
```

### Recommended Project Structure
```
scripts/
├── curate-server.mjs           # MODIFIED: two new GET routes in serveCurateRoute,
│                                #   a second esbuild.build() call (or a parameterized
│                                #   buildOverlay), startup log prints queue URL (D-07)
├── curate-overlay/
│   ├── index.ts                 # MODIFIED (small): DOMContentLoaded listener injects
│   │                             #   the nav link; exports stay otherwise unchanged
│   └── exclusion-panel.ts        # UNCHANGED — reused by import, not duplicated
├── curate-queue/                 # NEW directory, mirrors curate-overlay/'s placement
│   │                              #   (outside tsconfig include, outside every Vite
│   │                              #   config, outside build-widgets.mjs's copy lists —
│   │                              #   D-01's structural absence, inherited)
│   ├── index.ts                  # NEW: entry point, DOM construction (createElement/
│   │                              #   textContent only — D-09), imports
│   │                              #   saveExclusion/removeExclusion/runRecompute from
│   │                              #   '../curate-overlay/index.js' (esbuild resolves
│   │                              #   the sibling .ts directly)
│   ├── derive-flagged.mjs        # NEW: pure function, .mjs + JSDoc (see Pitfalls for
│   │                              #   why NOT .ts) — deriveFlaggedActivities(bestEfforts,
│   │                              #   exclusions) → ordered row array, D-01..D-05
│   └── derive-flagged.test.mjs   # NEW: real behavioral unit tests (this one CAN be
│                                  #   collected and CAN assert real return values,
│                                  #   unlike the DOM-building code)
├── lib/
│   └── curation-guard.mjs        # MODIFIED: IN-17 fix (one path → one violation)
├── lib/curation-guard.test.mjs   # MODIFIED: D-19 planted queue-page/bundle fixtures
├── compute-pr-ceiling-recount.mjs # MODIFIED: new exported function for an
│                                  #   activity-level (not effort-level) flagged count
├── compute-pr-ceiling-recount.test.mjs  # MODIFIED: tests for the new function
├── verify-dashboard-publish.mjs   # MODIFIED: two new expect404 lines (D-17)
└── verify-dashboard-publish-guard.test.mjs  # MODIFIED: D-19 fixtures for the new paths

src/dashboard/
└── curation-seam.test.ts          # MODIFIED: IN-18 (WR-17 pin → regex shape);
                                    #   otherwise its "__curate appears zero times in
                                    #   detail.ts/detail-sections.ts" assertions must
                                    #   keep passing unmodified (D-06)
```

### Pattern 1: Read-and-patch HTML at serve time, never a disk write
**What:** `curate-server.mjs` never writes `dist/widgets/index.html` back to disk; `injectOverlayTag` is a pure string function called on every request, patching the response body only.
**When to use:** For the queue's own HTML shell, for exactly the same reason — plus the NEW reason discovered this session: the stylesheet path is only knowable by reading the real built `index.html`, so the same read-at-request-time approach that already solves "inject the overlay script tag" also solves "reference the correct hashed stylesheet."
**Example (existing code, to mirror):**
```javascript
// Source: scripts/curate-server.mjs:184-193 (read in full this session)
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
A new sibling pure function (e.g. `extractStylesheetHref(html)`) can use the same idempotent, never-throw shape: regex-match `<link rel="stylesheet"[^>]*href="([^"]+)"` out of the real `dist/widgets/index.html`, then prefix the result with `/strava-widgets/` (stripping a leading `./`) before embedding it in the queue's own HTML response.

### Pattern 2: Module-scope event listener, never a MutationObserver
**What:** The existing overlay attaches its best-efforts-panel controls via `document.addEventListener('dashboard:best-efforts-mounted', ...)` at module scope — never a `MutationObserver` watching for DOM changes (D-03's explicit rejection in Phase 24).
**When to use:** For D-07's nav-link injection. **Verified this session by reading `src/dashboard/index.html` and `src/dashboard/main.ts` together:** the dashboard's `<script type="module" src="./main.ts">` tag is a *deferred* module script (deferred by default per the HTML spec), while `injectOverlayTag` inserts the overlay's `<script src="/__curate/overlay.js">` as a classic (non-deferred) script immediately before `</body>` — i.e., *after* `main.ts`'s tag in source order. A classic script executes synchronously as the parser reaches it; a deferred module script executes only after the document finishes parsing, in order, before `DOMContentLoaded` fires. `main.ts`'s `createNav(document.getElementById('app-nav-root')!)` call is literally the second statement at module scope (confirmed at `src/dashboard/main.ts:32`), with no `await` between module start and that call. Consequence: registering a `document.addEventListener('DOMContentLoaded', ...)` listener from the classic overlay script (which runs first) is guaranteed to fire only *after* `main.ts` has already run to completion and mounted the nav — no polling, no `MutationObserver`, no race.
**Example:**
```typescript
// Pattern to add near the top of scripts/curate-overlay/index.ts
document.addEventListener('DOMContentLoaded', () => {
  const linksList = document.querySelector('#app-nav-root .app-nav__links');
  // Never-throw discipline (matches loadExclusionState's style): a missing
  // nav (e.g. a future markup change, or main.ts's module graph failing to
  // evaluate under blocked site data — see main.ts:19's own comment) is a
  // silent no-op, not an error.
  if (!linksList) return;
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'app-nav__link';
  link.href = '/__curate/queue';
  link.textContent = 'Review queue';
  li.appendChild(link);
  linksList.appendChild(li);
});
```

### Pattern 3: Small, local, pure formatters — never import from `src/dashboard/*`
**What:** `scripts/curate-overlay/` has zero imports from `src/` anywhere today (verified by grep across `scripts/`). `formatPace`, `formatEffortDuration`, and `formatActivityDate` all live in `src/dashboard/views/list.ts` — a large view module with DOM-construction and event-wiring code, not a small dependency-free utility file.
**When to use:** For D-12's row content (duration, pace, date). Recommend duplicating the ~5-line pure formatting logic locally inside `scripts/curate-queue/` rather than importing `list.ts`, to keep the new bundle small and to preserve the zero-`src/`-imports precedent `curate-overlay/` has established. Similarly, `src/dashboard/row-navigation.ts`'s `activityDetailHref` produces only `#/activity/<id>` (a bare hash, correct for same-page dashboard links) — the queue page is served from `/__curate/queue`, a different path entirely, so it needs the *full* `/strava-widgets/#/activity/<id>` href per D-12's literal wording; a one-line local helper is simpler and safer than importing and re-prefixing `row-navigation.ts`'s output.
**Example:**
```javascript
// New, local to scripts/curate-queue/ — not imported from src/
function formatPace(secPerKm) {
  if (secPerKm === null) return '—';
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}
function activityDetailUrl(activityId) {
  return `/strava-widgets/#/activity/${activityId}`;
}
```

### Anti-Patterns to Avoid
- **A server-computed `/__curate/queue.json` route:** explicitly rejected by D-08. Two read paths for "which activities are flagged" is exactly the duplicate-derivation shape that caused Phase 24's `resolveExcluded`/WR-05/WR-17 defects.
- **Reimplementing `saveExclusion`/`removeExclusion` in the queue client:** explicitly rejected by D-10. Import the built `curate-overlay/index.js` (or extract a shared transport module) — never a second `fetch('/__curate/exclusions/...')` call site with its own error handling.
- **A `MutationObserver` for the nav-link injection:** unnecessary given the verified script-ordering guarantee in Pattern 2, and D-03 already rejected this shape for the best-efforts panel for the same reason (fragile, matches by DOM shape rather than a defined seam).
- **Hardcoding the dashboard stylesheet path:** will work on the very first test run (matches whatever hash happens to be in `dist/widgets` at research time) and silently break on the next `npm run build`. Must be read from the live `dist/widgets/index.html` at request time (Pattern 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-origin / DNS-rebinding protection on the new GET routes | A new Origin/Host check | `isTrustedOrigin(req, EXPECTED_HOST)` — already exported from `curate-server.mjs`, already used by every existing route including the static-file route (GAP-24-03's fix) | Reimplementing this is the literal thing CUR-02 forbids; the existing function has already had two rounds of hardening (malformed-Origin handling, DNS-rebinding coverage) that a new copy would not inherit |
| Activity-id validation | A new regex | `isValidCurateActivityId(id)` — `/^i?\d{1,20}$/` plus an explicit `__proto__` rejection, already exported | Matches `router.ts`'s client-side validator and `records-logic.ts:82`'s prototype-pollution guard; a second regex risks drifting from either |
| Atomic file write | `writeFileSync` directly on `data/best-effort-exclusions.json` | `writeAtomic`/`persistExclusions` (temp-file + `renameSync`), already exported | The queue never writes this file directly at all (D-10: all writes go through the existing PUT/DELETE routes), but if any new server code ever needs to write JSON, this is the only sanctioned pattern in this file — a half-written file is observable by the browser's own concurrent fetch |
| Build-time "does this leak into the publish bundle" scan | A queue-specific marker string or a second scanner | `findCurationArtifacts` in `scripts/lib/curation-guard.mjs` — already a whole-tree, fails-closed content scanner | D-18 confirms it already catches the queue page/bundle with zero changes; the only work is proving it (planted fixture), not building a new mechanism |
| Esbuild bundling | A new build config file | A parameterized/duplicated call to the existing `esbuild.build({...})` shape in `buildOverlay()` | Same `target: 'es2020'`, `format: 'iife'`, `bundle: true` shape every build in this repo already uses |

**Key insight:** This phase's entire job is composition, not invention — every piece of machinery it needs (origin gate, id validator, atomic write, content scanner, esbuild call, HTML-patch pattern, never-throw degrade pattern) already exists in this codebase and was purpose-built for exactly this kind of extension by Phase 24. The risk is not "missing a library" — it's accidentally building a second copy of something that already exists (which is precisely what CUR-02 and D-10/D-18 are worded to forbid).

## Common Pitfalls

### Pitfall 1: A `scripts/curate-queue/*.ts` + `*.test.ts` pair is silently never run
**What goes wrong:** The derivation logic ships with what looks like a real, passing test suite, but the test file is never collected by vitest — a green `npm test` proves nothing about it, and a red one won't show up either.
**Why it happens:** `vitest.config.ts`'s `include` (read in full this session) is exactly `['src/**/*.test.ts', 'scripts/**/*.test.mjs']`. A file at `scripts/curate-queue/derive-flagged.test.ts` matches neither glob. This is easy to miss because `scripts/curate-overlay/` already has `.ts` source files, which creates a false impression that `.test.ts` under `scripts/` is a supported, exercised pattern — it isn't; `curate-overlay/*.ts` is only ever tested by a *sibling* `.mjs` file (`scripts/curate-overlay.test.mjs`) that reads the `.ts` source as raw text and asserts on stripped source shape, never by importing/executing it.
**How to avoid:** Write the pure flagged-set-derivation logic as `scripts/curate-queue/derive-flagged.mjs` (plain JS + JSDoc types, matching `curation-guard.mjs`/`copy-data-tree.mjs`'s existing convention) with a colocated `scripts/curate-queue/derive-flagged.test.mjs`. If the planner instead prefers a `.ts` file for stronger typing, the sibling `.mjs` test file can `import` it directly (`import { deriveFlaggedActivities } from './derive-flagged.ts'`) — Vite/vitest's transform pipeline resolves and transforms any imported module regardless of extension, not just files matched by `include` (only the *entry* test file itself must match `include`). Either way, the first task that adds this test file should include a trivial canary assertion (`expect(true).toBe(true)`) and the plan should explicitly verify `npx vitest run <path>` reports "1 test file" before building real assertions on top — this project has twice before shipped a guard that "stayed green when the thing it guarded was deleted" (R3-CR-01, Phase 23's WR-06) and a silently-uncollected test file is the same failure class one layer up.

### Pitfall 2: Hardcoded/static stylesheet reference breaks on the next build
**What goes wrong:** The queue page renders completely unstyled (or 404s its CSS) the moment a developer runs `npm run build-widgets` again, because Vite's content-hash in the CSS filename (`assets/index-CQkdBpPg.css` today) changes on every build that touches any CSS-affecting input.
**Why it happens:** D-09 says "links the dashboard's built stylesheet" without specifying that the filename is unstable — an implementer reading only the decision text, not the actual `dist/widgets/index.html` output, would reasonably (and incorrectly) write a static `<link href="/strava-widgets/styles.css">`, which has never existed as a served path.
**How to avoid:** Serve the queue's HTML by reading the real `dist/widgets/index.html` at request time and extracting its actual `<link rel="stylesheet">` href, exactly mirroring `injectOverlayTag`'s pattern (Pattern 1 above). Add a regression test asserting the extracted href is non-empty and starts with `./` or `/`, so a future Vite config change that removes/renames the stylesheet link fails loudly instead of shipping a silently-unstyled queue.
**Warning signs:** The queue page's first browser-checkpoint screenshot renders with zero dashboard theming (default browser fonts/colors) — this is the visible symptom if this pitfall is not caught before the checkpoint.

### Pitfall 3: `findCurationArtifacts`'s IN-17 double-violation bug, encountered directly by this phase's own test fixtures
**What goes wrong:** D-19's planted-fixture test for the queue bundle (a file plausibly named something containing `.curate-dist`, or the queue's own directory structure) can report **two** violations for what should be one leaked path, because `curation-guard.mjs:105-141`'s directory-name check and file-name check both fire independently when an entry's name matches both the `__curate` and `.curate-dist` checks in certain nestings.
**Why it happens:** This is the pre-existing IN-17 defect, explicitly folded into this phase's scope by `29-CONTEXT.md`.
**How to avoid:** Fix IN-17 (one path → one violation, not two) as its own task before or alongside writing the new D-19 planted fixtures for the queue — otherwise the new fixture's assertion (`violations.length` or an exact-count check) will be counting the pre-existing bug's output, not the queue leak's, and a future IN-17 fix would then break the new queue fixture's assertion for an unrelated reason.
**Warning signs:** A planted-fixture test asserting `violations.length === 1` fails with `2` even though only one artifact was planted.

### Pitfall 4: The recount's "activity count" doesn't exist yet — don't assume it does
**What goes wrong:** A checkpoint row (D-16) that says "compare the page's header count against `compute-pr-ceiling-recount.mjs`'s output" silently compares against the wrong number, because the script's only current activity-adjacent output is `byDistance['400m']` (which happens to also read 47 today, by coincidence of this specific archive state — 47 activities all have a 400m demotion) — not a true "count of distinct activities with any demotion."
**Why it happens:** `recountDemoted` (read in full this session, `scripts/compute-pr-ceiling-recount.mjs:128-241`) iterates every `(activityId, effort)` pair and counts *efforts*, grouped by guard and by distance. It never deduplicates by `activityId`. Verified directly in this session: `node scripts/compute-pr-ceiling-recount.mjs` prints `ownDemotedTotal: 65` (efforts) and `byDistance['400m']: 47` — the second number matching the activity count is incidental to this archive's current shape (every flagged activity happens to have a 400m flag), not a structural guarantee; a future archive state where an activity is flagged only at 1k/1mi and not 400m would make `byDistance['400m']` diverge from the true activity count.
**How to avoid:** Add a genuinely new exported function (e.g. `recountDemotedActivities(bestEffortsDoc)`) that builds a `Set` of `activityId`s with at least one non-null `effort.demotion`, returning its size — mirroring `recountDemoted`'s existing null-safety idioms — and wire it into `main()`'s console output and `evaluateReport`'s pass/fail problems (an `--expect-flagged-activities` flag, parallel to the existing `--expect-demoted`/`--expect-cohort`). Independently confirmed this session: `47` is the correct answer for the live archive as of 2026-09-17 (computed by a standalone script reading the same two files with the same set-based logic, getting `activityCount 47, excludedWithinFlagged 12`, matching `29-CONTEXT.md`'s D-01/D-02 figures exactly).

### Pitfall 5: `demotion.reason` prefill needs joining logic for multi-effort activities, and the existing strings are not written for concatenation
**What goes wrong:** A naive `efforts.map(e => e.demotion.reason).join(' ')` prefill for an activity with, say, both a `ceiling` demotion on 400m and a `world-record` demotion on 1k produces a run-on sentence like `"implied 6.96 m/s exceeds personal ceiling 5.11 m/s (1.28 x p90 3.99 m/s over 1825 filtered 400m efforts)implied 14.75 m/s exceeds world-record pace 9.30 m/s"` with no separator or distance label, because each `reason` string (verified directly from `src/analytics/best-effort-ceiling.ts:200` and `best-effort-utils.ts:182-191`) is self-contained prose with no distance prefix and assumes it is displayed already next to its own row.
**Why it happens:** The reason strings were designed for the existing detail-panel context where they already sit beside their distance in a table cell; D-11 is asking the queue to *reuse* this text as a single textarea prefill spanning potentially multiple efforts.
**How to avoid:** When joining multiple reasons, prefix each with its distance (e.g. `"400m: implied 6.96 m/s exceeds personal ceiling 5.11 m/s (...)\n1k: implied ... "`) and use a real separator (newline, given the textarea already renders multi-line). This is flagged as Claude's Discretion in `29-CONTEXT.md` ("the precise prefill sentence... all reasons joined, or the worst one named") — this research surfaces the concrete formatting risk so the planner's chosen approach doesn't ship an unreadable run-on string.

## Code Examples

### Reused, unmodified (import these, do not reimplement)
```javascript
// Source: scripts/curate-server.mjs (read in full this session)
export function isTrustedOrigin(req, expectedHost) { /* ... */ }
export function isValidCurateActivityId(id) { /* ... */ }
export function normalizeReason(raw) { /* ... */ }
export const CURATE_PREFIX = '/__curate';
export const MOUNT_PREFIX = '/strava-widgets';
```
```typescript
// Source: scripts/curate-overlay/index.ts (read in full this session)
export async function saveExclusion(activityId: string, reason: string): Promise<void> { /* ... */ }
export async function removeExclusion(activityId: string): Promise<void> { /* ... */ }
export async function runRecompute(onChunk: (chunk: string) => void): Promise<void> { /* ... */ }
```

### New route wiring (extends the existing dispatcher, does not replace it)
```javascript
// Pattern to add inside scripts/curate-server.mjs's serveCurateRoute(req, res),
// alongside the existing /__curate/health and /__curate/overlay.js branches
// (source read at scripts/curate-server.mjs:584-618):
if (req.method === 'GET' && urlPath === `${CURATE_PREFIX}/queue`) {
  if (!existsSync(INDEX_HTML)) { res.writeHead(404); res.end('Not Found'); return; }
  const html = readFileSync(INDEX_HTML, 'utf8');
  const stylesheetHref = extractStylesheetHref(html); // new pure fn, Pattern 1
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(buildQueuePage(stylesheetHref)); // new pure fn — builds the queue's own minimal HTML shell
  return;
}
if (req.method === 'GET' && urlPath === `${CURATE_PREFIX}/queue.js`) {
  if (!existsSync(QUEUE_OUTFILE)) { res.writeHead(404); res.end('Not Found'); return; }
  res.writeHead(200, { 'Content-Type': 'application/javascript' });
  res.end(readFileSync(QUEUE_OUTFILE));
  return;
}
```

### D-16's new recount output (extends `compute-pr-ceiling-recount.mjs`)
```javascript
// New export, mirroring recountDemoted's existing null-safety shape
// (source read at scripts/compute-pr-ceiling-recount.mjs:128-169)
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
Verified this session against the live archive: this exact logic (run as a standalone script) returns `47`, matching `29-CONTEXT.md`'s D-01 figure exactly.

### D-17's new literal 404 assertions
```javascript
// Pattern to add to scripts/verify-dashboard-publish.mjs, immediately after
// the three existing literal expect404 calls (source read at lines ~399-409)
await expect404(baseUrl, '/__curate/queue', 'the curate review queue page must never be published');
await expect404(baseUrl, '/__curate/queue.js', 'the curate review queue bundle must never be published');
```

## State of the Art

Not applicable in the ecosystem-research sense — this phase extends internal project machinery, not a third-party library whose API might have moved since training. The one "state of the art" fact worth recording is internal to this repo:

| Old approach (Phase 24 as originally shipped) | Current state (this phase must match) | When Changed | Impact |
|--------------------------------------------|----------------------------------------|--------------|--------|
| Curation controls existed only inline on the activity detail page, discoverable only by navigating to an already-known flagged activity | A dedicated queue surfaces every flagged activity in one place (this phase) | Phase 29 (in progress) | Directly closes CUR-01's "reachable without hunting" requirement; the detail-page controls (`exclusion-panel.ts`) are unchanged and continue to work identically |

**Deprecated/outdated:** Nothing in this phase's dependency set is deprecated. `esbuild ^0.27.3`, `vitest ^4.0.18`, `typescript ^5.9.3` are all current major versions already vetted and installed by prior phases.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] `npm view esbuild version` / `npm view vitest version` were not re-run against the live registry in this session — version currency was instead confirmed by reading the installed `package.json` directly, which reflects what Phase 24/25/etc. already vetted and shipped with, not a fresh registry check | Standard Stack | Negligible — these are pre-existing, already-exercised devDependencies, not new proposals; a registry check would only matter if this phase were adding a *new* package, which it is not |
| A2 | [ASSUMED] Vitest's Vite-based transform pipeline will correctly transform an imported `.ts` module when referenced from a collected `.mjs` test file (the fallback option in Pitfall 1, if the planner chooses `.ts` for the derivation logic over plain `.mjs`) — this is standard, well-documented Vite/Vitest behavior but was not verified by actually running such a test in this session (to avoid creating throwaway files in the repo) | Common Pitfalls (Pitfall 1) | If wrong, a `.ts`-based derivation module's test would fail to import at all (a loud, immediate failure at `npx vitest run`, not a silent pass) — low risk of silent failure, but the planner should still run a canary `npx vitest run` before committing to this file layout, exactly as recommended in Pitfall 1 |
| A3 | [ASSUMED] No `.nvmrc`, `engines` field, or CI-pinned Node version was found in this session's file reads — the Node version used to run `npm run curate` locally is whatever the developer has installed | Standard Stack | Low — this phase adds no Node-version-sensitive syntax beyond what `curate-server.mjs` already uses successfully today |

**If this table is empty:** N/A — see rows above. Everything else in this document (file contents, line numbers, function signatures, the 47/65/12 measured counts, the stylesheet-hash fact, the vitest include-glob fact, the script-execution-order fact) was read directly from source files or produced by running scripts in this repository during this session, and is tagged `[VERIFIED: <mechanism>]` inline or stated as a direct reading of source without a training-data claim involved.

## Open Questions (RESOLVED)

> **RESOLVED during planning (2026-09-17).** Q1 → `PD-01` in `29-04-PLAN.md`: the name is joined
> client-side from `data/dashboard/index.json` (no new server route; rows degrade to `Activity <id>`
> if the fetch fails), and is put to the developer for an explicit approve/reject at checkpoint row
> R11 in `29-08-PLAN.md`. Q2 → `PD-02` in `29-06-PLAN.md`: pure `renderQueuePage(stylesheetHref)` +
> `extractStylesheetHref(html)` resolved per request, no template file.

1. **Where does the queue get each row's activity *name* (D-12), given `best-efforts.json` has no `name` field?**
   - What we know: `ActivityBestEfforts` (verified from `src/analytics/best-effort.types.ts`) carries `activityId`, `startDate`, `distanceSource`, `efforts`, `excludedFromRecords` — no name. `data/dashboard/index.json`'s `activities[]` rows (verified by reading a live sample) do carry `name`, and this file is already public, already mirrored by `RECOMPUTE_DATA_DIRS`, and already fetched by the existing dashboard.
   - What's unclear: D-08 names exactly two files as the queue's data sources and says "No new server read route" — and D-12's own *rejected* alternative explicitly treats "pulling index.json in as a third data source" as a real cost, though scoped there to device-family/quality-tier fields specifically, not to name/date.
   - Recommendation: Reading `data/dashboard/index.json` client-side for the `name` field only (joining on `activityId`/`id`, confirmed to use the same string format across both files, including `i`-prefixed intervals.icu ids) requires zero new server code and zero new server route, so it does not violate the literal text of D-08's "no new server read route." It is a genuinely new third `fetch()` call, though — flag this explicitly to the developer during planning/discussion rather than deciding it silently, since D-12's own rejected-alternative note treated a third data source as a real, named tradeoff once already in this same decision set.

2. **Exact HTML-shell generation approach: fully server-generated string, or a static template file with one token substituted?**
   - What we know: `injectOverlayTag`'s pattern (string patch on the real `dist/widgets/index.html`) is the closest precedent, but the queue's HTML is not a patch on an existing published file — it's a genuinely new page with different content (a header, a table, no dashboard nav/router).
   - What's unclear: `29-CONTEXT.md` leaves "how the queue page's HTML shell is produced and served" as Claude's Discretion, and this research did not find a "build a whole new HTML document" precedent anywhere in the existing curate subsystem to model against (the closest analog, `src/dashboard/index.html`, is Vite-processed at build time, not hand-assembled at request time).
   - Recommendation: A small static template string (or a `.html` file under `scripts/curate-queue/` read once at server start, similar to how `INDEX_HTML` is read) with a single `{{STYLESHEET_HREF}}`-style token substituted per-request is simplest and keeps the "never write to disk" discipline intact; this is a plan-level design choice, not something this research needs to lock further.

## Environment Availability

Skipped — this phase has no external dependencies beyond what the repository's own `npm install` already provides (esbuild, vitest, typescript, Node built-ins), all of which are confirmed already present and already exercised by the exact code this phase modifies (`curate-server.mjs` already runs `esbuild.build()` successfully today; `vitest` already collects and runs the existing `scripts/**/*.test.mjs` and `src/**/*.test.ts` suites).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` |
| Config file | `vitest.config.ts` (repo root) — `environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']` |
| Quick run command | `npx vitest run <path-to-file>` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUR-01 | `deriveFlaggedActivities` returns exactly the 47-activity set (per D-01..D-05: all-guard demotions, excluded rows retained and marked, one row per activity, not-yet-excluded-first-then-newest ordering) against real archive fixtures | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ Wave 0 |
| CUR-01 | `compute-pr-ceiling-recount.mjs`'s new `recountDemotedActivities` returns the same count as the live archive's independently-verified 47 | unit | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` | ❌ Wave 0 (extends existing file) |
| CUR-01 (Criterion 1, full) | Queue's rendered header count matches `node scripts/compute-pr-ceiling-recount.mjs`'s independently-derived activity count | manual-only | Browser checkpoint — read both numbers on screen/terminal, compare | N/A — human checkpoint |
| CUR-02 | `saveExclusion`/`removeExclusion` imported (not reimplemented) by the queue client — source-structure guard, mirroring `scripts/curate-overlay.test.mjs`'s existing pattern | unit (source-text) | `npx vitest run scripts/curate-queue.test.mjs` (new sibling file) | ❌ Wave 0 |
| CUR-02 | Untrusted-origin write attempt against `/__curate/exclusions/:id` still rejected (behavior unchanged — regression only) | unit | `npx vitest run scripts/curate-server.test.mjs` (existing file, unmodified assertions) | ✅ exists |
| CUR-02 (full) | Queue row's Exclude action writes through the real server, demonstrated failing from an untrusted origin | manual-only | Browser checkpoint (per Criterion 2's own wording: "demonstrated failing if a parallel write surface is substituted instead") | N/A — human checkpoint |
| CUR-03 | `findCurationArtifacts` flags a planted queue page/bundle inside a fixture tree; a clean tree returns `[]` | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ exists, extend |
| CUR-03 | `verify-dashboard-publish.mjs` fails when `/__curate/queue`(.js) is served, passes when absent | integration (subprocess) | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ exists, extend |
| CUR-03 (full) | Full `npm run verify-dashboard` against a correct build passes; against a deliberately-leaked build fails | manual-only + automated | `npm run verify-dashboard` (automated half); leak-and-rebuild is exercised by the extended guard test above, not by a separate manual step | ✅ exists |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file>` for whatever file(s) that task touched
- **Per wave merge:** `npm test` (full suite; note `fileParallelism: false` makes this the correct and only reliable way to run the curation-guard/verify-dashboard-publish-guard pair together, per the existing comment in `vitest.config.ts`)
- **Phase gate:** Full suite green, plus `npm run build`, `npm run build-widgets`, `npm run verify-dashboard` all exit 0, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/curate-queue/derive-flagged.mjs` + `scripts/curate-queue/derive-flagged.test.mjs` — the pure derivation function and its real behavioral tests; does not exist yet
- [ ] `scripts/curate-queue.test.mjs` — source-structure guard for the new queue client, mirroring `scripts/curate-overlay.test.mjs`'s existing pattern (import-guard, `location.reload()` presence, no-second-renderer checks)
- [ ] `scripts/compute-pr-ceiling-recount.mjs`'s new `recountDemotedActivities` export, plus test additions to `scripts/compute-pr-ceiling-recount.test.mjs`
- [ ] Two new `expect404` lines in `scripts/verify-dashboard-publish.mjs`, plus corresponding new `it(...)` blocks in `scripts/verify-dashboard-publish-guard.test.mjs`
- [ ] New planted-fixture cases in `scripts/lib/curation-guard.test.mjs` for a queue-page-shaped and queue-bundle-shaped leak
- [ ] IN-17 fix in `scripts/lib/curation-guard.mjs` (one path → one violation) — should land *before* the new D-19 fixtures above are written, per Pitfall 3
- [ ] IN-18 fix in `src/dashboard/curation-seam.test.ts` (WR-17 literal pin → regex-shape pin)
- No test framework installation gap — Vitest is already fully configured and already collects both file patterns this phase needs (`src/**/*.test.ts` for the `curation-seam.test.ts` IN-18 fix, `scripts/**/*.test.mjs` for everything else)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Local-only dev tool, no user accounts — unchanged from Phase 24's scope |
| V3 Session Management | No | No sessions; `isTrustedOrigin`'s Origin/Host check is the entire trust boundary, unchanged |
| V4 Access Control | Yes | `isTrustedOrigin(req, EXPECTED_HOST)` — reused unmodified on every new route that serves curate-only content, exactly as it already gates the static route (GAP-24-03) and the two write routes |
| V5 Input Validation | Yes | `isValidCurateActivityId` (activity ids) and `normalizeReason` (exclusion reason strings) — both reused unmodified; the queue introduces no new user-controlled input beyond what these already validate, since Save/Remove/Recompute all route through the existing handlers |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-origin write via another browser tab (CSRF-shaped) | Tampering | `isTrustedOrigin` on every route, including the two new GET routes — must not be skipped "because it's just a GET"; the existing static route already applies this gate to GETs for the same DNS-rebinding reason (GAP-24-03's fix, verified read this session at `curate-server.mjs:636-644`) |
| DNS rebinding (attacker-controlled page resolves to 127.0.0.1) | Spoofing | Same `isTrustedOrigin` Host-header check; no new mitigation needed, only consistent application to the new routes |
| Path traversal via a crafted queue/bundle route path | Tampering | Not applicable to the two new routes as designed — they are exact-string matches (`urlPath === CURATE_PREFIX + '/queue'`), not filesystem-path-derived like `safeResolve`'s dynamic resolution; must NOT be reimplemented as a dynamic-path lookup under `/__curate/queue/*` without re-adding `safeResolve`-equivalent traversal protection |
| Reflected/stored XSS via activity name or demotion reason text rendered into the queue row | Tampering / Information Disclosure | `createElement` + `textContent` only (D-09, already the established convention in `exclusion-panel.ts` and `detail-sections.ts`) — never `innerHTML`/template-string HTML assignment for any value sourced from JSON (activity name, demotion reason, exclusion reason are all developer-authored or Strava/intervals.icu-sourced text, not sanitized elsewhere) |
| Overly broad build-time/HTTP guard exemptions (the CR-02 regression class already fixed once in this codebase) | Tampering (undetected leak) | Do not add a new extension exemption to `UNSCANNED_EXTENSIONS` or widen `verify-dashboard-publish.mjs`'s literal-path checks into a prefix match — both files' own docblocks explicitly forbid this, and D-17/D-18 both confirm the existing mechanisms already cover the new routes without any widening |

## Sources

### Primary (HIGH confidence — direct source reads and live script runs in this session)
- `scripts/curate-server.mjs` (full file read) — routing, `isTrustedOrigin`, `isValidCurateActivityId`, `writeAtomic`/`persistExclusions`, `buildOverlay`, `injectOverlayTag`, `safeResolve`, `serveCurateRoute`, `main()`
- `scripts/curate-overlay/index.ts`, `scripts/curate-overlay/exclusion-panel.ts` (full files read) — transport functions, mount pattern, never-throw discipline
- `scripts/lib/curation-guard.mjs` (full file read) — `findCurationArtifacts`, `UNSCANNED_EXTENSIONS`, IN-17's exact code location
- `scripts/verify-dashboard-publish.mjs` (relevant sections read) — `expect404`, the existing three literal `/__curate/...` assertions and their surrounding comment
- `scripts/compute-pr-ceiling-recount.mjs` (full file read) and run live via `node scripts/compute-pr-ceiling-recount.mjs` — confirmed 65 demoted efforts / 31 ceiling / 19 world-record / 15 max-speed / 47 activities at 400m, no existing activity-level count
- `src/analytics/best-effort.types.ts` (full file read) — `EffortDemotion`, `ComputedEffort`, `ActivityBestEfforts`, `BestEffortExclusion` shapes; confirmed no `name` field
- `src/analytics/best-effort-ceiling.ts`, `src/analytics/best-effort-utils.ts` (grepped, relevant lines read) — exact reason-string templates for all three guards
- `scripts/lib/copy-data-tree.mjs` — `RECOMPUTE_DATA_DIRS`
- `src/dashboard/curation-seam.test.ts` (full file read) — the D-06 "`__curate` appears zero times" pins, IN-18's WR-17 pin
- `src/dashboard/main.ts`, `src/dashboard/nav.ts` (relevant sections read) — verified `createNav` runs synchronously at module scope, second statement, confirming the script-ordering analysis in Architecture Pattern 2
- `src/dashboard/index.html` — confirmed CSP meta tag, confirmed `<script type="module" src="./main.ts">` placement
- `dist/widgets/index.html` (live build output, read directly) — confirmed the actual hashed stylesheet filename (`assets/index-CQkdBpPg.css`)
- `vitest.config.ts` — confirmed the exact `include` glob and the `fileParallelism: false` rationale
- `package.json` — confirmed installed devDependency versions (esbuild `^0.27.3`, vitest `^4.0.18`, typescript `^5.9.3`)
- `tsconfig.json` — confirmed `include: ["src/**/*"]` excludes `scripts/`
- `scripts/lib/curation-guard.test.mjs`, `scripts/verify-dashboard-publish-guard.test.mjs`, `scripts/curate-overlay.test.mjs`, `scripts/curate-server.test.mjs` (representative sections read) — confirmed the planted-fixture testing pattern and the source-text-only testing pattern for DOM-building `.ts` files
- `data/stats/best-efforts.json`, `data/best-effort-exclusions.json`, `data/dashboard/index.json` (live archive files, read/queried directly via Node) — confirmed 47 flagged activities / 12 already-excluded (all within the 47), confirmed activity-id format consistency (`i`-prefix) across files, confirmed `index.json`'s `name` field
- `.planning/phases/29-curation-review-queue/29-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — phase scope, locked decisions, requirement history

### Secondary (MEDIUM confidence)
None — this research required no external ecosystem lookups (no new library, no external API), so no WebSearch/WebFetch/Context7 queries were made. Every claim traces to a direct file read or a live script run against this repository in this session.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every tool version confirmed by reading the installed `package.json`
- Architecture: HIGH — every pattern (route dispatch, HTML patching, transport reuse, script-execution ordering) verified by reading the actual source files involved, not inferred
- Pitfalls: HIGH — all five pitfalls were discovered by directly reading the relevant config/source (vitest.config.ts's include glob, the live dist/widgets/index.html stylesheet filename, the live recount script's output, the live reason strings, the pre-existing IN-17 code) rather than speculated

**Research date:** 2026-09-17
**Valid until:** 30 days for the architectural guidance (internal, stable code); the specific measured counts (47 activities, 65 efforts, 12 exclusions) are explicitly a snapshot — `29-CONTEXT.md` itself and this document both flag that the nightly CI sync grows the archive, so any task or checkpoint that asserts an exact count must re-derive it at execution/verification time, never hardcode today's numbers.
