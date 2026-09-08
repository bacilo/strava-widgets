---
phase: 17-activity-browser-detail-views
plan: 12
subsystem: ui
tags: [chart.js, dashboard, lazy-import, dom, canvas]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    plan: 01
    provides: "chart-band/segmented/overlay-picker CSS class contract and --chart-*/--accent-strong design tokens"
  - phase: 17-activity-browser-detail-views
    plan: 04
    provides: "detail-charts-logic.ts — availableChannels, buildChannelSeries, distanceFractionAtX, overlay tamper-guard (parseOverlayConfig/readStoredOverlayConfig/writeStoredOverlayConfig)"
provides:
  - "mountChartBands(container, options) — stacked pace/hr/cadence/elevation Chart.js bands on a shared x-axis with LTTB decimation"
  - "Per-band multi-check overlay shading capped at 2, undrawn auto-scaled overlay axis, true-value tooltips"
  - "Tamper-guarded overlay persistence via localStorage, distance/time x-axis toggle"
  - "Hover crosshair sync across bands + onHover(fraction) broadcast for the route-map marker (D-26, consumed by plan 17-14)"
affects: [17-13-detail-splits-view, 17-14-detail-view-orchestration, 17-15-browser-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy-chunk boundary via plain top-level static import inside a module nothing else imports statically (D-25) — Chart.js only reaches the bundle once plan 17-14 does `await import('./detail-charts.js')`"
    - "CSS-custom-property color resolution at mount time (getComputedStyle + resolveToken fallback) instead of a hardcoded isDark ternary, since this module has document access the copied comparison-chart widget lacks"
    - "Cap/allow-list enforcement funneled through parseOverlayConfig on the candidate config rather than hand-counted in the DOM (single implementation of the D-18 cap)"
    - "Local (per-chart-instance) Chart.js plugin registration via `plugins: [...]` in the chart config, not global Chart.register, for the hover crosshair"

key-files:
  created:
    - src/dashboard/views/detail-charts.ts
  modified: []

key-decisions:
  - "Rebuild all bands' Chart instances on any single overlay-checkbox change or x-axis-mode toggle, rather than patching one dataset in place — simpler to reason about correctness for DOM/canvas wiring that is not unit-testable, at the cost of destroying/recreating up to 4 Chart.js instances per interaction (acceptable for this manually-verified surface per 17-RESEARCH.md Pitfall 4)."
  - "Split the file into two atomic task commits despite both tasks targeting the same file: Task 1 committed a working stacked-bands-only version (verified against its own acceptance greps + npm test), then Task 2 layered overlay pickers/persistence/hover on top (verified against build-widgets + verify-dashboard) — avoids one oversized commit while keeping each commit independently buildable."
  - "Chart.js's own generic ChartOptions/scale typings don't accommodate a per-band dynamic overlay-scale-id count cleanly, so the per-band options/scales/datasets objects are built as loosely-typed (`any`) literals and handed to `new Chart(...)` as-is, rather than fighting the generic constraint system for a config that is inherently variable-shaped."

requirements-completed: [DETAIL-03]

# Metrics
duration: 50min
completed: 2026-08-11
---

# Phase 17 Plan 12: Detail Chart Bands (Stacked, Overlay-Shaded, Hover-Synced) Summary

**Chart.js-backed stacked pace/HR/cadence/elevation bands with per-band multi-check overlay shading, a distance/time toggle, tamper-guarded persistence, and a cross-band hover crosshair, all lazily loaded so no other route pays for Chart.js.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-11T17:24:00Z (approx, worktree base reset)
- **Completed:** 2026-08-11T15:37:06Z
- **Tasks:** 2 completed
- **Files modified:** 1 (new)

## Accomplishments
- `mountChartBands` renders up to four theme-resolved Chart.js line bands (pace/hr/cadence/elevation, D-17 fixed order) on one shared linear x-domain, with LTTB `Decimation` capping drawn points and x-axis tick labels shown only on the bottom-most visible band.
- Colour resolution reads `--chart-pace`/`--chart-hr`/`--chart-cadence`/`--chart-elevation`/`--border`/`--text`/`--text-secondary` live via `getComputedStyle`, an intentional deviation from the copied `comparison-chart` widget's hardcoded light/dark branch (documented inline).
- Each band offers an independent "Shade behind" checkbox row for the other available channels, hard-capped at `MAX_OVERLAYS_PER_BAND` (2) by feeding the candidate config through `parseOverlayConfig` — no second, hand-rolled cap check — with an inline "Up to 2" hint and tamper-guarded `localStorage` persistence (`readStoredOverlayConfig`/`writeStoredOverlayConfig`).
- Overlays render as 18%/10%-opacity area fills on a `display: false` auto-scaled axis (own true units, never normalized), with a tooltip label callback that reports the true value + unit per dataset (bpm/spm/m/m:ss-per-km).
- A locally-registered (per-chart, not global) crosshair plugin plus a shared hover broadcaster draws a synced vertical line and tooltip across every band and calls `options.onHover(distanceFractionAtX(...))` — ready for plan 17-14 to drive the route-map position marker.
- `Chart.js` is registered tree-shaken (`LineController`, `LineElement`, `PointElement`, `LinearScale`, `Tooltip`, `Filler`, `Decimation` — no `Legend`/`Title`) and lives entirely behind the module's own static import, which nothing else in the codebase imports statically — confirmed absent from the built dashboard entry chunk.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stacked bands, theme-resolved palette, and the x-axis toggle** - `d7ffe58` (feat)
2. **Task 2: Per-band overlay pickers, undrawn overlay axis, persistence, and hover broadcast** - `05b4684` (feat)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified
- `src/dashboard/views/detail-charts.ts` (624 lines) — `mountChartBands(container, options): ChartBandsHandle`, `MountChartBandsOptions`, `ChartBandsHandle`; theme/palette resolution, channel metadata/formatting, the crosshair plugin, and all band/overlay/hover DOM wiring.

## Decisions Made
- Rebuilding all bands on any single interaction (overlay toggle, axis-mode toggle) rather than patching Chart.js dataset/scale state in place — chosen for correctness-first simplicity in code that is DOM/canvas-only and verified manually, not unit-tested.
- Split the two plan tasks into two real, independently-verifiable commits despite both touching the same file: Task 1 shipped a working stacked-bands-only version first (own acceptance greps + `npm test` green), then Task 2 layered the overlay/persistence/hover surface on top (full acceptance greps + `build-widgets`/`verify-dashboard` green) — see key-decisions for detail.
- Used loosely-typed (`any`) per-band Chart.js `options`/`scales`/`datasets` objects rather than fighting Chart.js's generic type system for an inherently dynamic (variable overlay-scale-count) configuration shape — isolated behind inline `eslint-disable` comments with a rationale comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Missing local gitignored data fixtures (`data/dashboard/index.json`, `data/stats/*.json`) blocked `verify-dashboard`**
- **Found during:** Task 2 verification (`npm run build-widgets && npm run verify-dashboard`)
- **Issue:** `data/dashboard/` and `data/stats/` are gitignored, locally-generated artifacts (per `.gitignore` comments: "dashboard SPA now generates it," "convention as `data/stats/`"). This fresh worktree checkout had neither, so `verify-dashboard-publish.mjs` failed 2 of 20 checks (`GET /data/stats/all-time-totals.json` and `.../streaks.json` returned 404) — entirely unrelated to this plan's `detail-charts.ts` changes.
- **Fix:** Copied the pre-built `data/dashboard/index.json` and `data/stats/*.json` files from the main repository checkout into the worktree (read-only, gitignored artifacts — never staged or committed), then re-ran `build-widgets`.
- **Files modified:** None tracked by git (both directories are gitignored; `git status --short` confirms no new tracked/staged entries from this action).
- **Verification:** `npm run verify-dashboard` — 20/20 checks pass, exit 0.
- **Committed in:** N/A — no git-tracked files were touched by this fix.

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue, resolved by restoring locally-generated data fixtures, zero impact on shipped code)
**Impact on plan:** None on shipped `detail-charts.ts` — the gap was pre-existing worktree state, not caused by this plan's changes.

## Issues Encountered

The worktree's base commit (`8dc717e17d2caa74f8cad44b57e8a17e903a045d`) did not match this agent's initial `HEAD` — a `git reset --hard` to the expected base was required per the `<worktree_branch_check>` setup step before any file was read or written. Documented here for traceability; not a plan deviation.

## User Setup Required

None — no external service configuration required. Chart.js 4.5.1 is a pre-existing, already-installed dependency (no new package install).

## Next Phase Readiness

- `mountChartBands` fully implements the locked export surface (`ChartBandsHandle`, `MountChartBandsOptions`, `mountChartBands`) that plan 17-14 needs to dynamically import and wire into the activity detail page, including the `onHover(fraction)` callback plan 17-14 will connect to the route map's `setPositionByFraction`.
- Canvas rendering, overlay-cap behaviour, persistence-across-reload, the x-axis toggle, and crosshair sync are DOM/canvas-only and were NOT unit-tested (consistent with 17-RESEARCH.md Pitfall 4) — they are carried into plan 17-15's real-browser checkpoint, per the plan's own `<verification>` section.
- No blockers for downstream Wave 2+/3 plans. `npx tsc --noEmit`, `npm test` (554 project-wide tests), `npm run build-widgets`, and `npm run verify-dashboard` (20/20) are all green against the final state of this file.

## Known Stubs

None — `detail-charts.ts` is fully wired against `detail-charts-logic.ts`'s real exports; no hardcoded/mock data paths exist. The module is simply unmounted by anything yet (plan 17-14's job), which is the plan's own documented scope boundary, not a stub.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-17-LS-01/02, T-17-VW-01, T-17-STR-02, T-17-CHT-01/02, T-17-SC) — no new endpoints, auth paths, or schema changes were introduced. `localStorage` is the only trust boundary this module touches, and it is exercised exclusively through the already-audited `detail-charts-logic.ts` tamper-guard functions (`parseOverlayConfig`/`readStoredOverlayConfig`/`writeStoredOverlayConfig`) with zero second validation path (confirmed via the `grep -c 'innerHTML'` == 0 and the overlay-cap-via-`parseOverlayConfig`-only design).

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/detail-charts.ts
- FOUND commit d7ffe58
- FOUND commit 05b4684
