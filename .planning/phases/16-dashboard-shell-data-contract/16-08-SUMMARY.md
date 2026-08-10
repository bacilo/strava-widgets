---
phase: 16-dashboard-shell-data-contract
plan: 08
subsystem: infra
tags: [vite, build-pipeline, github-actions, github-pages, static-publish]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 04)
    provides: compute-dashboard-index CLI subcommand producing data/dashboard/index.json (gitignored)
  - phase: 16-dashboard-shell-data-contract (plan 07)
    provides: src/dashboard/index.html SPA entry (theme bootstrap, ./main.ts module script)
provides:
  - "The dashboard SPA is the generated site root (dist/widgets/index.html), replacing the hand-committed widget-showcase file"
  - "src/pages/widgets.html — the relocated widget showcase / embed-code gallery, now a buildable Vite page entry"
  - "buildDashboard() in scripts/build-widgets.mjs — the fourth Vite build stage, root src/dashboard, emptyDir false"
  - "copyDataFiles() extended to publish data/dashboard, data/activities, data/streams into dist/widgets/data/"
  - "compute-dashboard-index CI stage in .github/workflows/daily-refresh.yml, isolated with continue-on-error"
affects: [17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fourth Vite build entry (buildDashboard) follows the exact buildPages() shape: root/outDir/emptyDir:false/rollupOptions.input/target/minify, called last in buildAllWidgets() so the SPA definitively wins the site-root index.html"
    - "mtime-based copy skip in copyDataFiles(): compares destStat.mtimeMs >= srcStat.mtimeMs before copyFileSync, so local rebuilds of the ~150MB activities+streams tree are near-instant while CI's fresh checkout still does a full copy"
    - "CI compute-stage isolation: continue-on-error: true + a matching '::warning::' step, same shape as compute-geo-stats/compute-best-efforts, applied to compute-dashboard-index"

key-files:
  created:
    - src/pages/widgets.html
  modified:
    - dist/widgets/index.html (untracked; now generated build output)
    - .gitignore
    - README.md
    - vite.config.pages.ts
    - scripts/build-widgets.mjs
    - .github/workflows/daily-refresh.yml

key-decisions:
  - "Moved the widget-showcase content verbatim into src/pages/widgets.html rather than deleting it, adding only a title change and a top nav bar (Dashboard/Heatmap/Pin Map/Routes) so the embed-code documentation is not lost when the dashboard takes over the site root"
  - "buildDashboard() runs after buildPages() (not before) in buildAllWidgets(), so the SPA is the last file written to dist/widgets/index.html — guarantees the pre-Phase-16 hand-committed showcase file is definitively replaced even if a stale copy lingers in a working tree"
  - "Extended copyDataFiles() with an mtime comparison guard (Rule 2-adjacent efficiency addition mandated by the plan itself, not a deviation) rather than a full always-copy, since a full local copy of data/streams (142MB/1,843 files) on every iteration was called out in the plan as a real cost"
  - "data/dashboard/ stays out of the CI commit step's file_pattern — it is gitignored and regenerated every run, and the existing in-file comment already documents why listing a gitignored path there breaks git add and skips deploy (the Feb-Aug 2026 CI freeze RESEARCH.md references)"

patterns-established:
  - "Any future N-th Vite page/app entry in scripts/build-widgets.mjs should copy buildDashboard()'s shape verbatim (root/outDir '../../dist/widgets'/emptyDir:false/rollupOptions.input/target 'es2020'/minify 'terser'/logLevel 'warn') and be called after buildPages() unless it has an explicit reason to run earlier"

requirements-completed: [DASH-01, DASH-02]

# Metrics
duration: ~35min
completed: 2026-08-10
---

# Phase 16 Plan 08: Dashboard Site Root, Build Wiring, and Data Contract Summary

**The dashboard SPA now builds to `dist/widgets/index.html` (the published site root) via a fourth Vite build stage, the old widget showcase survives at a buildable `widgets.html`, and the publish directory carries the full dashboard data contract (index manifest + 1,867 activity files + 1,843 stream files) with an isolated, non-blocking CI compute stage.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-10T19:12:02Z (recorded at SUMMARY-authoring time; task work began immediately after branch-base correction)
- **Completed:** 2026-08-10T19:12:02Z
- **Tasks:** 3/3
- **Files modified:** 7 (1 created, 6 modified; `dist/widgets/index.html` untracked as part of the rename)

## Accomplishments

- Relocated the 226-line hand-authored widget-showcase page from `dist/widgets/index.html` to `src/pages/widgets.html`, byte-for-byte apart from a retitled `<title>` and a new top nav bar linking back to the dashboard root and the three standalone map pages; git recorded the move as a rename
- Wired `widgets.html` into both `vite.config.pages.ts` and `buildPages()`'s Vite input map, and added a new `buildDashboard()` stage (root `src/dashboard`, `emptyDir: false`, `index` entry → `dist/widgets/index.html`) called last in `buildAllWidgets()` so the SPA definitively takes over the site root
- Extended `copyDataFiles()`'s `dataDirs` array with `data/dashboard`, `data/activities` (1,867 files), and `data/streams` (1,843 files incl. `manifest.json`), plus an mtime-based skip guard confirmed to make a second consecutive `npm run build-widgets` report all-skipped rather than recopying ~150MB
- Inserted a `Compute dashboard index` / `Warn on dashboard-index failure` step pair into `.github/workflows/daily-refresh.yml`, positioned between `Compute best efforts` and `Build widgets`, matching the existing `continue-on-error: true` isolation convention; left the commit step's `file_pattern` and the `peaceiris/actions-gh-pages@v4` step untouched
- Full local build verified end to end: `npm run build-widgets` produces 11 IIFE bundles, five HTML pages (`heatmap`, `pinmap`, `routes`, `widgets`, `index`), and a publish tree with `dist/widgets/data/{dashboard,activities,streams,stats,geo,routes,heatmap}`; `git ls-files dist/` now returns only `dist/widgets/test.html`; `npx tsc --noEmit` and `npm test` (334/334) both green

## Task Commits

Each task was committed atomically:

1. **Task 1: Relocate the widget showcase and free up the site root** — `12761ce` (feat)
2. **Task 2: Add the dashboard and gallery entries to the Vite build** — `54e2d82` (feat)
3. **Task 3: Publish the dashboard data families and add the CI compute stage** — `b4a65be` (feat)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree execution — no plan-metadata commit made here).

## Files Created/Modified

- `src/pages/widgets.html` — the relocated widget showcase; verbatim embed-code snippets, retitled `Widget Gallery — Strava Analytics`, new top nav (`./` / `./heatmap.html` / `./pinmap.html` / `./routes.html`)
- `dist/widgets/index.html` — untracked (`git rm --cached`), now generated by `buildDashboard()`
- `.gitignore` — removed the `!dist/widgets/index.html` exception with an explanatory comment; `!dist/widgets/test.html` preserved
- `README.md` — added `Training Dashboard` and `Widget Gallery` entries to the Standalone Pages list; no embed-snippet URLs touched
- `vite.config.pages.ts` — added `widgets` to `rollupOptions.input`
- `scripts/build-widgets.mjs` — added `widgets` to `buildPages()`'s input map; new `buildDashboard()` function; `buildAllWidgets()` calls it after `buildPages()`; `copyDataFiles()` extended with three new data families plus the mtime skip guard
- `.github/workflows/daily-refresh.yml` — new `Compute dashboard index` + `Warn on dashboard-index failure` step pair between `Compute best efforts` and `Build widgets`

## Decisions Made

See `key-decisions` in frontmatter. Notably: `buildDashboard()` runs last (after `buildPages()`) specifically to guarantee the SPA wins the site-root `index.html`, and the mtime-based copy skip was implemented exactly as the plan's action block specified (not an emergent deviation) to keep local iteration on a ~150MB data tree fast.

## Deviations from Plan

None — plan executed exactly as written. The plan's own action blocks already called for the mtime skip guard, the `buildDashboard()`-after-`buildPages()` ordering, and the CI step positioning; no unplanned auto-fixes were needed.

## Issues Encountered

- Local verification of Task 3's data-family checks initially failed the `data/stats` publish assertion because `data/stats/` (gitignored, regenerated) did not yet exist in this fresh worktree checkout — no prior plan/task in this wave had run `compute-all-stats` here. Ran `node dist/index.js compute-all-stats` (generates `data/stats/best-efforts.json` and related files) purely to populate local verification state; this is normal CI behavior (the "Process statistics" and "Compute best efforts" steps already precede "Build widgets" in the real pipeline) and is not a plan deviation. The regenerated `data/geo/geo-metadata.json` (a `generatedAt` timestamp bump, same content otherwise) was reverted with `git checkout -- data/geo/geo-metadata.json` before committing, since it was an artifact of local verification, not a task change.
- Worktree HEAD's merge-base check failed against the declared base commit at agent startup (same class of issue plans 03/05/07 already documented) — resolved with `git reset --hard 84174d1acfe8f8743da458c5d7c5fb4159401c08` per the worktree branch-check protocol before any file changes were made.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- D-08, D-11, and D-12 are closed: the dashboard SPA is the published site root, the widget showcase survives at `widgets.html`, and the publish directory is self-contained (index manifest + every activity/stream file the SPA can request).
- The nightly CI pipeline regenerates the dashboard index in an isolated, non-blocking stage before every build/deploy.
- Phase 17 (activity browser, filtering/sorting/search) can build directly on top of the now-fully-published data contract without any further publish-path changes.
- No blockers.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `src/pages/widgets.html`
- FOUND: `vite.config.pages.ts` (modified, contains `widgets` input entry)
- FOUND: `scripts/build-widgets.mjs` (modified, contains `buildDashboard`, extended `copyDataFiles`)
- FOUND: `.github/workflows/daily-refresh.yml` (modified, contains `compute-dashboard-index` step)
- FOUND: `.gitignore` (modified)
- FOUND: `README.md` (modified)
- FOUND commit: `12761ce` (feat, Task 1)
- FOUND commit: `54e2d82` (feat, Task 2)
- FOUND commit: `b4a65be` (feat, Task 3)
