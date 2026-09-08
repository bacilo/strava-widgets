---
phase: 24-local-curation-mode
plan: 04
subsystem: infra
tags: [node-http, esbuild, static-server, curation-overlay, vitest]

# Dependency graph
requires:
  - phase: 24-local-curation-mode (plan 01)
    provides: scripts/lib/copy-data-tree.mjs, scripts/lib/curation-guard.mjs, widened vitest glob, .curate-dist/ gitignore
  - phase: 24-local-curation-mode (plan 02)
    provides: "data-activity-id on the Best Efforts <section> and the dashboard:best-efforts-mounted CustomEvent (D-03), both consumed by scripts/curate-overlay/index.ts's listener"
provides:
  - "scripts/curate-server.mjs — Node-built-ins-only static server with /strava-widgets prefix mount, in-flight overlay injection, /__curate/health and /__curate/overlay.js, fixed 127.0.0.1:4173 bind, FATAL missing-build check, esbuild-driven overlay bundling"
  - "scripts/curate-overlay/index.ts + exclusion-panel.ts — overlay entry point (one dashboard:best-efforts-mounted listener) and a placeholder mountCurationControls, both outside the publish pipeline's reach"
  - "npm run curate script"
  - "scripts/curate-server.test.mjs — 15 unit tests over the pure helpers, D-11 discharged for isCurateRoute"
affects: [24-05, 24-06, 24-07, 24-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Response-body patch (injectOverlayTag) applied only in the request handler, never written to disk — dist/widgets/index.html stays the real publish artifact"
    - "Self-execution guard (import.meta.url === pathToFileURL(process.argv[1]).href) so a server module stays importable by its own test file with zero side effects, following the lesson build-widgets.mjs teaches by counter-example"
    - "esbuild bundling call isolated to a single exported buildOverlay(), invoked only from main(), so the overlay source tree stays outside tsconfig.json's include and every Vite config's input graph"

key-files:
  created:
    - scripts/curate-server.mjs
    - scripts/curate-overlay/index.ts
    - scripts/curate-overlay/exclusion-panel.ts
    - scripts/curate-server.test.mjs
  modified:
    - package.json

key-decisions:
  - "No new decisions beyond what 24-CONTEXT.md/24-RESEARCH.md/24-PATTERNS.md already locked (D-01, D-02, D-12, OD-3, OD-4) — this plan implemented the documented design as specified."
  - "The D-11 substring weakening (urlPath.includes('curate')) turns RED for the negative-classification case (/__curatex/health, /strava-widgets/__curate/health) but NOT for the never-catch guarantee case (/strava-widgets/data/best-effort-exclusions.json), because that literal path contains no 'curate' substring. Both are documented verbatim below rather than only reporting the case that matched the plan's prediction — the red run is still real evidence that the widening breaks the guard, just via case 10 rather than case 9."

patterns-established:
  - "scripts/curate-server.mjs is the template a later plan (24-06) extends with write/recompute routes inside the existing isCurateRoute-first branch — the plan explicitly left a fallthrough 404 there for that purpose."

requirements-completed: [CUR-01]

# Metrics
duration: ~35min
completed: 2026-08-27
---

# Phase 24 Plan 04: Curate Server (static-serving half + overlay bundling) Summary

**`npm run curate` now serves the built `dist/widgets` under a fixed `127.0.0.1:4173/strava-widgets` mount with the curation overlay's `<script>` tag injected in-flight as a pure response-body patch, and bundles a placeholder overlay entry point from `scripts/curate-overlay/` with esbuild into gitignored `.curate-dist/` — structurally outside every publish-pipeline input.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-27
- **Tasks:** 3/3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `scripts/curate-server.mjs` exports `CURATE_HOST` (`127.0.0.1`), `CURATE_PORT` (`4173`), `MOUNT_PREFIX`, `CURATE_PREFIX`, `safeResolve`, `isCurateRoute`, `injectOverlayTag`, `buildOverlay`, `main` — importable with zero side effects (proven both by the self-execution guard and by `scripts/curate-server.test.mjs` importing it directly)
- FATAL missing-build check mirrors `verify-dashboard-publish.mjs`'s block shape, naming `npm run curate`'s own build instruction, guarded so it only fires under direct invocation
- `safeResolve` copies the shipped traversal-rejection shape verbatim (`resolved === ROOT || resolved.startsWith(ROOT + '/')`); `isCurateRoute` is a literal `/__curate` prefix test, never a substring/wildcard match, keeping `/strava-widgets/data/best-effort-exclusions.json` correctly classified as static
- `injectOverlayTag` is a pure, idempotent string function targeting the LAST `</body>`, never writing to disk
- `buildOverlay()` calls `esbuild.build({ entryPoints: [OVERLAY_ENTRY], bundle: true, format: 'iife', target: 'es2020', outfile: OVERLAY_OUTFILE })`, invoked once from `main()` before `server.listen`
- `scripts/curate-overlay/index.ts` registers exactly one `document.addEventListener('dashboard:best-efforts-mounted', ...)` listener at module scope, locating the section via `data-activity-id`, silently no-op'ing if the section is missing, clearing any pre-existing `.curate-controls` before delegating to `mountCurationControls`
- `scripts/curate-overlay/exclusion-panel.ts` ships the required placeholder — a single `<div class="curate-controls"><p>Curation controls load in plan 24-07.</p></div>` — built with `document.createElement`/`textContent`/`appendChild` only, zero CSS (OD-3)
- `package.json` gained `"curate": "node scripts/curate-server.mjs"` beside `verify-dashboard`, with no dependency/devDependency change
- `scripts/curate-server.test.mjs`: 15 vitest cases covering the host/port constants, `injectOverlayTag`'s four behaviors (insertion, idempotence, absent-`</body>`, LAST-`</body>` targeting past an embedded literal), `safeResolve`'s four traversal-rejection shapes plus mount-prefix resolution, and `isCurateRoute`'s never-catch guarantee plus positive/negative classification
- Manually verified end-to-end: `npm run curate` started, printed `http://127.0.0.1:4173/strava-widgets/`, `/__curate/health` returned `200 {"status":"ok"}`, `/strava-widgets/` returned HTML containing exactly one `__curate/overlay.js` reference, `/__curate/overlay.js` returned `200`, the public `/strava-widgets/data/best-effort-exclusions.json` returned `200`, a traversal attempt returned `403`, a missing static file returned `404` — server then stopped cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: The curate server's static-serving half** - `dce5853` (feat)
2. **Task 2: Bundle the overlay with esbuild, add the overlay entry and npm script** - `b52c5d4` (feat)
3. **Task 3: Unit-test the pure server helpers, D-11 discharge** - `37282ec` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `scripts/curate-server.mjs` (new) - the local-only HTTP server: constants, `assertBuilt`, `safeResolve`, `isCurateRoute`, `injectOverlayTag`, `buildOverlay`, request handler, `main`, self-execution guard
- `scripts/curate-overlay/index.ts` (new) - overlay entry point, the single `dashboard:best-efforts-mounted` listener
- `scripts/curate-overlay/exclusion-panel.ts` (new) - placeholder `mountCurationControls`, replaced in plan 24-07
- `scripts/curate-server.test.mjs` (new) - 15 vitest cases over the pure helpers
- `package.json` - `"curate": "node scripts/curate-server.mjs"` added

## Decisions Made

Followed `24-CONTEXT.md`/`24-RESEARCH.md`/`24-PATTERNS.md` exactly — D-01 (structural absence via `scripts/curate-overlay/` outside every publish-pipeline input), D-02 (prefix mount, `/__curate/*` outside it), D-12 (`127.0.0.1` literal), OD-3 (zero CSS), OD-4 (fixed port 4173, fail-fast on `EADDRINUSE`, no port-hunting). No new decisions were made this plan.

## Deviations from Plan

**1. [Rule 1 - Bug] Removed the literal string `0.0.0.0` from a comment, not just from code**

- **Found during:** Task 1, self-verification against the acceptance criteria ("the file contains no occurrence of `0.0.0.0`")
- **Issue:** The initial doc comment explaining D-12's host binding used the literal string `'0.0.0.0'` to name the forbidden alternative, which would have failed both the acceptance criterion's literal text-scan and Task 3's `source text contains no all-interfaces wildcard bind` test
- **Fix:** Reworded the comment to describe the forbidden bind ("the all-interfaces wildcard bind") without using the literal digits-and-dots string
- **Files modified:** `scripts/curate-server.mjs`
- **Verification:** `grep -c "0.0.0.0" scripts/curate-server.mjs` returns no match; Task 3's corresponding test passes
- **Committed in:** `dce5853` (Task 1 commit, not a separate fix — caught before the first commit)

**2. [Rule 1 - Bug] Removed the literal string `innerHTML` from a doc comment in `exclusion-panel.ts`**

- **Found during:** Task 2, self-verification against the acceptance criteria ("neither overlay source contains `innerHTML`")
- **Issue:** A doc comment describing the DOM-building idiom used the literal word "innerHTML" to name what NOT to use, which would have matched a literal `grep -rn "innerHTML"` scan of the directory
- **Fix:** Reworded to "no HTML-string assignment" without the literal token
- **Files modified:** `scripts/curate-overlay/exclusion-panel.ts`
- **Verification:** `grep -rn "innerHTML" scripts/curate-overlay/` returns no match
- **Committed in:** `b52c5d4` (Task 2 commit, not a separate fix — caught before the first commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both caught during self-verification before their respective task commits — neither shipped as a defect)
**Impact on plan:** Cosmetic wording-only fixes to doc comments; no behavioral change. No scope creep.

## Issues Encountered

- **Worktree had no `node_modules` at all (not just the "empty" gap noted in wave 1's summary).** `npm ci --prefer-offline` was run to install from the committed `package-lock.json` (199 packages, no lockfile changes) so `npx vitest`, `npx tsc`, and `npx esbuild` could run. This is environment setup, not a plan deviation — no dependency was added or changed in `package.json`/`package-lock.json`.
- **`dist/widgets` was not built in this worktree.** `npm run build-widgets` was run once to produce a real build to develop and manually verify the server against (1,869 activities, 1,845 streams, all widgets, the dashboard SPA). `dist/` is gitignored, so this produced no tracked changes.
- **D-11's discharge produced a partial-but-real red run, not the plan's predicted full pair.** The plan's action text says weakening `isCurateRoute` to `urlPath.includes('curate')` should turn both "case 9" (the never-catch guarantee for `/strava-widgets/data/best-effort-exclusions.json`) and "case 10's negative half" red. Only case 10's negative half actually went red — the exclusions-file path contains no literal substring `curate`, so that specific weakening cannot misclassify it. Documented verbatim below rather than silently reporting only the matching half.
- **Pre-existing worktree environment gap (not caused by this plan, not re-logged per instruction):** `npx vitest run` (no path filter) reports 5 failing test files (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) — all `ENOENT` on gitignored generated `data/stats/*.json` / `data/dashboard/index.json` that this worktree checkout never produced. None of the 5 touch any file this plan modifies. 53/58 files passed, 1372/1372 individual assertions passed, including this plan's own 15 new cases.

## D-11 observed failing

Per the plan's mandatory discharge: `isCurateRoute` was temporarily weakened from a literal `/__curate` prefix test to `urlPath.includes('curate')`, the test file was run, the failure output captured verbatim below, then the guard was restored to a byte-identical diff (`git diff scripts/curate-server.mjs` returned empty before the Task 3 commit) and re-run green.

**RED run** (weakened `isCurateRoute` — `npx vitest run scripts/curate-server.test.mjs`):

```
 ❯ scripts/curate-server.test.mjs (15 tests | 1 failed) 5ms
     ✓ CURATE_HOST is exactly 127.0.0.1 (D-12) 1ms
     ✓ the source text contains no all-interfaces wildcard bind 0ms
     ✓ CURATE_PORT is the number 4173 (OD-4) 0ms
     ✓ inserts the tag immediately before </body> 0ms
     ✓ is idempotent — applying it to its own output changes nothing 0ms
     ✓ returns input unchanged when </body> is absent 0ms
     ✓ targets the LAST </body> when the literal text appears earlier inside a script or comment 0ms
     ✓ rejects /strava-widgets/../../etc/passwd 0ms
     ✓ rejects /etc/passwd (outside the mount prefix entirely) 0ms
     ✓ rejects an encoded traversal sequence 0ms
     ✓ rejects / (outside the mount prefix) 0ms
     ✓ /strava-widgets/ and /strava-widgets both resolve to a path ending in dist/widgets/index.html 0ms
     ✓ the public exclusions data file is a static route, never a curate route 0ms
     ✓ is true for /__curate, /__curate/health, /__curate/overlay.js, /__curate/exclusions/123 0ms
     × is false for /__curatex/health and /strava-widgets/__curate/health 3ms

 FAIL  scripts/curate-server.test.mjs > isCurateRoute > is false for /__curatex/health and /strava-widgets/__curate/health
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ scripts/curate-server.test.mjs:119:48

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)
```

Note: "the public exclusions data file is a static route, never a curate route" stayed green under this specific weakening because `/strava-widgets/data/best-effort-exclusions.json` contains no literal substring `curate` — the widening as specified (`.includes('curate')`) cannot misclassify that exact path. The red failure that *did* occur is still direct evidence the widening breaks the guard: `/strava-widgets/__curate/health` and `/__curatex/health` are exactly the kind of adjacent paths T-24-OVERBROAD warns a substring/wildcard match would wrongly sweep in.

**GREEN run** (guard restored — `npx vitest run scripts/curate-server.test.mjs`):

```
 ✓ scripts/curate-server.test.mjs (15 tests) 2ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/curate-server.mjs`'s `isCurateRoute`-first branch has an explicit fallthrough 404 comment marking where plan 24-06 adds the write and recompute routes.
- `scripts/curate-overlay/exclusion-panel.ts`'s `mountCurationControls` is a stable, named placeholder plan 24-07 replaces in place — signature (`section: HTMLElement, activityId: string`) already matches what a real two-step-commit UI needs.
- `scripts/curate-server.test.mjs` establishes the house test style (`scripts/**/*.test.mjs` under vitest, no server-start on import) for plan 24-06's write-route tests.
- Blocker/concern for the orchestrator: this worktree had zero `node_modules` (not just empty) and no `dist/widgets` build; both were produced locally via `npm ci` and `npm run build-widgets` to develop and verify against, and both are gitignored so neither produced tracked changes. Later-wave worktrees in this phase likely have the same starting state and will need the same setup before their own verification can run.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-08-27*

## Self-Check: PASSED

All created files verified present (`scripts/curate-server.mjs`, `scripts/curate-overlay/index.ts`,
`scripts/curate-overlay/exclusion-panel.ts`, `scripts/curate-server.test.mjs`,
`.planning/phases/24-local-curation-mode/24-04-SUMMARY.md`) and all four commit hashes
(`dce5853`, `b52c5d4`, `37282ec`, `f4ec0d3`) confirmed present in `git log`.
