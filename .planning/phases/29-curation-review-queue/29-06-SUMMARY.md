---
phase: 29-curation-review-queue
plan: 06
subsystem: curation
tags: [curation, review-queue, esbuild, http-server, tdd, origin-gate]

# Dependency graph
requires:
  - phase: 29-curation-review-queue plan 05
    provides: "scripts/curate-queue/index.ts (browser entry point) and scripts/curate-queue/format.mjs — the client this plan bundles and serves"
  - phase: 24-local-curation-mode
    provides: "scripts/curate-server.mjs's constants, isTrustedOrigin, buildOverlay/OVERLAY_ENTRY/OVERLAY_OUTFILE shape, and serveCurateRoute/main() structure this plan extends"
provides:
  - "scripts/curate-server.mjs — QUEUE_ENTRY/QUEUE_OUTFILE constants, buildQueueBundle() (mirrors buildOverlay() exactly), extractStylesheetHref (pure, resolves the real content-hashed dashboard stylesheet from dist/widgets/index.html), renderQueuePage (pure HTML shell, PD-02), two new exact-match origin-gated GET routes (/__curate/queue, /__curate/queue.js), and a startup log line printing the queue URL"
  - "scripts/curate-server.test.mjs — unit tests for extractStylesheetHref/renderQueuePage (13 cases) plus 7 new live-socket cases extending the existing liveness describe block (queue shell, queue bundle, origin gate both ways, traversal-404 control, same-origin control)"
affects:
  - "plan 29-07/29-08 (guards, browser checkpoint) — CUR-01/CUR-02's actual requirement tick depends on the queue being reachable end-to-end and confirmed on a real page, not on this plan alone"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second explicit esbuild call site (buildQueueBundle beside buildOverlay) rather than a shared parameterized helper — keeps the D-01 structural-absence story greppable per entry point, per plan instruction"
    - "PD-02: HTML shell as a pure exported string function beside injectOverlayTag, not a template file — mirrors the one precedent already in this subsystem"
    - "Gated-vs-ungated GET route split within the same /__curate namespace, commented at the point of the two new gated branches explaining why health/overlay.js stay ungated and queue/queue.js do not"

key-files:
  created: []
  modified:
    - scripts/curate-server.mjs
    - scripts/curate-server.test.mjs

key-decisions:
  - "Task 3's literal bundle-substring check ('/__curate/exclusions/') is unsatisfiable given curate-queue/index.ts's existing (out-of-scope) structure — same root cause 29-05-SUMMARY.md already documented for curate-overlay/index.ts: esbuild does not fold the CURATE_PREFIX template-literal variable into the surrounding string text, so the literal substring never appears in the bundle regardless of what this plan's own file contains. Implemented the same corrected check: CURATE_PREFIX constant text present, plus regex matches for the CURATE_PREFIX}/exclusions/ and CURATE_PREFIX}/recompute template-literal boundaries, plus the literal location.reload — proving the queue bundle really carries the imported, reused transport rather than a stub."
  - "Task 3's file-wide grep acceptance criterion for 'no hardcoded stylesheet hash' (grep -c \"toBe(47)|index-[A-Za-z0-9]*\\.css\") is unsatisfiable across the whole file as literally written, because Task 1's own <behavior> spec mandates literal fixtures like index-ABC.css and the plan's own Interfaces section quotes the real hash index-CQkdBpPg.css as a worked example for extractStylesheetHref's pure-function tests. The real guarantee the acceptance criterion protects — that the LIVE liveness assertion (case 6) never hardcodes a hash — holds: case 6 derives its expected href exclusively from extractStylesheetHref(readFileSync(INDEX_HTML, 'utf8')) at test-run time, with zero literal css filename anywhere in its body."

patterns-established: []

requirements-completed: []

# Metrics
duration: "~45min"
completed: 2026-09-18
---

# Phase 29 Plan 06: Server Wiring for the Review Queue Summary

Two new exact-match, origin-gated `GET` routes inside `/__curate` (`/queue`, `/queue.js`) serving a pure request-time-assembled HTML shell carrying the dashboard's real content-hashed stylesheet, backed by a second `buildOverlay`-mirroring esbuild step (`buildQueueBundle`) and a startup log line — all proven live over a real socket with the origin gate demonstrated discriminating in both directions.

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-18T11:47:00Z (approx, worktree branch check + node_modules/dist/data setup)
- **Completed:** 2026-09-18T12:32:00Z
- **Tasks:** 3
- **Files modified:** 2 (`scripts/curate-server.mjs`, `scripts/curate-server.test.mjs`)

## Accomplishments

- Task 1 (TDD) added `extractStylesheetHref` (pure, two-step attribute-order-tolerant parse of `dist/widgets/index.html`'s real `<link rel="stylesheet">` tag, normalized against `MOUNT_PREFIX`, never throws) and `renderQueuePage` (pure, exported HTML shell per PD-02, strict `script-src 'self'` CSP, no inline script/style) beside `injectOverlayTag`. Observed RED first (13 new assertions failing with `TypeError: ... is not a function`, 45 pre-existing assertions still passing); then GREEN (58/58).
- Task 2 wired the queue into `serveCurateRoute`: `QUEUE_ENTRY`/`QUEUE_OUTFILE` constants, `buildQueueBundle()` mirroring `buildOverlay()` exactly, two new exact-match `GET` branches (`/__curate/queue` reading `dist/widgets/index.html` at request time and responding with `renderQueuePage`; `/__curate/queue.js` serving the built bundle, 404 when absent) both gated first by `isTrustedOrigin`, a comment recording why these two GETs are gated while `health`/`overlay.js` stay ungated, `main()` now building both bundles at startup, and a new startup log line printing the queue URL.
- Task 3 extended the existing real-socket liveness describe block (reused server/request helper, no second server) with 7 new cases covering the queue shell (200, bundle script tag, live-derived stylesheet href match — never a hardcoded hash), the queue bundle (200, real imported transport present, not a stub), the origin gate in both directions for both routes (cross-origin `Origin` → 403, mismatched `Host` → 403), a same-origin control proving the new branches didn't disturb existing dispatch, and a traversal attempt pinned at 404. Proved both 403 assertions failable via a scratch edit (`isTrustedOrigin` call replaced with `if (false)` in the `/queue` branch — cases 7/8 failed 200-not-403 as predicted), reverted, confirmed green (`curate-server.mjs` byte-identical to its prior commit afterward).

## Task Commits

Each task was committed atomically:

1. **Task 1: extractStylesheetHref and renderQueuePage — pure functions, tested first (TDD)**
   - RED: `468be471` (test)
   - GREEN: `da6c92e2` (feat)
2. **Task 2: Two gated GET routes, the queue bundle build, and the startup log** - `7277a795` (feat)
3. **Task 3: Live-socket route tests, including the gate in both directions** - `e888eb90` (test)

No plan-metadata commit in this worktree — SUMMARY.md is committed separately per worktree-mode instructions (STATE.md/ROADMAP.md are excluded; the orchestrator owns those writes after merge).

_TDD task (Task 1) carries two commits (RED → GREEN); no REFACTOR commit was needed._

## Files Created/Modified

- `scripts/curate-server.mjs` - Added `QUEUE_ENTRY`/`QUEUE_OUTFILE` constants, `buildQueueBundle()`, `extractStylesheetHref()`, `renderQueuePage()`, two new gated `GET /__curate/queue` and `GET /__curate/queue.js` branches inside `serveCurateRoute`, a `buildQueueBundle()` call in `main()`, and a startup log line printing the queue URL.
- `scripts/curate-server.test.mjs` - 13 new unit-test assertions for `extractStylesheetHref`/`renderQueuePage` plus 7 new live-socket assertions extending the existing `static route liveness & Origin/Host gate` describe block (now also builds the queue bundle in `beforeAll`).

## Decisions Made

- **`extractStylesheetHref`'s two-step parse (find the `<link>` tag first, then pull `href` out of that same tag):** attribute order in the real built `index.html` is not guaranteed stable across builds, so a single combined regex risks silently breaking; two independent, narrowly-scoped matches tolerate both orderings and both quote styles per the plan's `<behavior>` spec.
- **`renderQueuePage`'s script tag placed inside `<body>`, at its end** (not after `</body>`): keeps the document structurally valid HTML rather than relying on browser auto-correction, while still satisfying every `<behavior>` assertion (bundle script tag present, no inline script body per the "no `src=`" exclusion in the CSP-compliance check).
- **Both new routes gated first, before any filesystem check** (matching the plan's stated order: origin gate → 412/404 → 200): a 412/404 response never leaks whether `dist/widgets` is built to a cross-origin or mismatched-Host caller.
- See `key-decisions` above (frontmatter) for the two plan-verify-script deviations (Rule 1), both already precedented by 29-05-SUMMARY.md's identical finding on `curate-overlay/index.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own verify script] Task 3's literal bundle-substring check is unsatisfiable given `curate-queue/index.ts`'s existing (out-of-scope) structure**
- **Found during:** Task 3 verification
- **Issue:** Task 3's action text asks for `GET /__curate/queue.js`'s body to contain the literal substring `/__curate/exclusions/` as proof the served bundle carries the real transport. `scripts/curate-queue/index.ts` (plan 29-05, not in this plan's `files_modified`) imports the transport from `curate-overlay/index.ts`, which builds its fetch URL as `` `${CURATE_PREFIX}/exclusions/...}` ``. esbuild does not fold the `CURATE_PREFIX` const into the surrounding template-literal text, so the literal substring `/__curate/exclusions/` never appears in the bundled output — confirmed by direct grep against the built `.curate-dist/queue.js` (`grep -c "/__curate/exclusions/"` → `0`), matching 29-05-SUMMARY.md's identical, independently-derived finding for the overlay bundle.
- **Fix:** Verified the same underlying guarantee with a corrected check: the literal text `CURATE_PREFIX = "/__curate"` is present, plus regex matches for the `CURATE_PREFIX}/exclusions/` and `CURATE_PREFIX}/recompute` template-literal boundaries (the exact form esbuild preserves), plus the literal `location.reload`. All four assertions pass against the real built bundle.
- **Files modified:** `scripts/curate-server.test.mjs` (test assertion only; no source-file change)
- **Verification:** `grep -c "CURATE_PREFIX = \"/__curate\""`, `grep -c "CURATE_PREFIX}/exclusions/"`, `grep -c "CURATE_PREFIX}/recompute"`, `grep -c "location.reload"` against `.curate-dist/queue.js` all return ≥1; the corresponding vitest case (`case 9`) passes.
- **Committed in:** `e888eb90` (Task 3's own commit)

**2. [Rule 1 - Bug in the plan's own verify script] Task 3's file-wide "no hardcoded hash" grep is unsatisfiable given Task 1's own mandated literal fixtures**
- **Found during:** Task 3 acceptance-criteria run
- **Issue:** Task 3's acceptance criteria requires `grep -c "toBe(47)\|index-[A-Za-z0-9]*\.css" scripts/curate-server.test.mjs` to return `0` for the whole file. Task 1's own `<behavior>` spec (and this plan's Interfaces section, which quotes the real build's hash `index-CQkdBpPg.css` as a worked example) mandates literal fixtures like `index-ABC.css` for `extractStylesheetHref`'s pure-function unit tests — 10 matches exist in the file, all inside Task 1's `extractStylesheetHref`/`renderQueuePage` describe blocks, none inside Task 3's liveness block.
- **Fix:** Confirmed the real guarantee the criterion protects — that the *live* liveness assertion (case 6) never hardcodes a hash — holds by inspecting case 6's body in isolation: it computes `expectedHref` exclusively via `extractStylesheetHref(readFileSync(INDEX_HTML, 'utf8'))` at test-run time and contains zero literal `.css` filenames.
- **Files modified:** None (verification-only; the test file's Task 1 fixtures are correct as written per the plan's own `<behavior>` spec)
- **Verification:** `sed -n '/case 6:/,/^    });/p' scripts/curate-server.test.mjs` shows no hardcoded hash; the case passes against the real build.
- **Committed in:** N/A (deviation is documentation-only; no commit required beyond this SUMMARY)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — plan-verify-script bugs, both precedented by 29-05-SUMMARY.md's identical structural finding)
**Impact on plan:** No scope creep; both are test-assertion-only corrections proving the same underlying guarantee the plan intended. No source-file behavior changed as a result of either deviation.

## Issues Encountered

- **Fresh-worktree `node_modules` absent.** Symlinked from the primary checkout (`/Users/pedf/workspace/strava-widgets/node_modules`), per this wave's standing instruction — read-only reference, gitignored, nothing written to the primary checkout.
- **Fresh-worktree `dist/widgets/`, `data/stats/`, `data/dashboard/` absent.** Copied read-only from the primary checkout (all three gitignored) so this plan's routes had a real built `dist/widgets/index.html` to read and the rest of the suite had its data fixtures.
- **Fresh-worktree `dist/` (tsc build output, e.g. `dist/index.js`, `dist/analytics/*.js`) also absent**, distinct from `dist/widgets/` above — 4 unrelated compute-script test files (`compute-pace-quality-calibration.test.mjs`, `compute-pace-residual.test.mjs`, `compute-pr-ceiling-calibration.test.mjs`, `compute-pr-ceiling-diff.test.mjs`) failed with `Cannot find module '../dist/analytics/...'` on the first `npm test` run. Copied the full `dist/` tree (also entirely gitignored per `.gitignore`'s `dist/*`) read-only from the primary checkout; re-ran `npm test` and all 81 files / 2409 tests passed, 0 failures. None of these four files are in this plan's `files_modified` scope and none were touched.
- Full `npm test` in this worktree: 81/81 files, 2409/2409 tests, 21 skipped (pre-existing, unrelated skips), 0 failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/__curate/queue` and `/__curate/queue.js` are both live, origin-gated, and serve the real queue client from plan 29-05 with the dashboard's real hashed stylesheet — ready for a browser checkpoint.
- CUR-01 and CUR-02 are **not** ticked by this plan (`requirements-completed: []`), consistent with this project's established convention (Phase 19/24/25 precedent, reaffirmed in 29-05-SUMMARY.md): a requirement ticks only after a real browser checkpoint confirms it, not at a plan that wires the server routes. `.planning/REQUIREMENTS.md` still correctly shows CUR-01/CUR-02/CUR-03 as `Pending`.
- No blockers for the next plan. The queue is fully reachable end-to-end (`npm run curate` → `http://127.0.0.1:4173/__curate/queue`) for a subsequent guards/browser-checkpoint plan.

---
*Phase: 29-curation-review-queue*
*Completed: 2026-09-18*
