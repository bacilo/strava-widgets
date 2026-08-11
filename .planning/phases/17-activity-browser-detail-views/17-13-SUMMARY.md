---
phase: 17-activity-browser-detail-views
plan: 13
subsystem: ui
tags: [typescript, dom-rendering, splits-table, distribution-bars, accessibility]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    plan: "17-01"
    provides: "CSS class contract for .detail-section, .splits-scroll, .splits-table*, .pace-bar*, .distribution*"
  - phase: 17-activity-browser-detail-views
    plan: "17-04"
    provides: "Split interface and computeSplits (per-km splits with interpolated boundaries, Δt-weighted averages, labelled final partial)"
  - phase: 17-activity-browser-detail-views
    plan: "17-05"
    provides: "PaceBucket/ZoneTime interfaces and computePaceDistribution/computeHrZoneTimes"
provides:
  - "buildSplitsSection — seven-column splits table DOM builder with sticky Km column, partial-row label, and vs.-Avg comparison bar"
  - "buildBreakdownSection — pace-distribution histogram (always-on) plus a conditionally-absent HR-zone panel DOM builder"
affects: [17-14-detail-view-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled accessible DOM bars (not Chart.js) for splits vs.-Avg and distribution rows — every bar carries an aria-label since the visual fill alone is meaningless to assistive tech"
    - "Fill width computed as a percentage of half the track, capped at 100% of that half, so an extreme pace outlier cannot overflow the comparison-bar cell"
    - "null-return contract (buildBreakdownSection returns HTMLElement | null) lets the caller omit an empty card entirely rather than rendering a placeholder shell"

key-files:
  created:
    - src/dashboard/views/detail-sections.ts
  modified:
    - src/dashboard/views/list.ts

key-decisions:
  - "Exported formatDurationHms from list.ts (was module-private) so detail-sections.ts imports the single dashboard duration formatter instead of forking a copy — the plan's own interfaces contract named it as already-exported, but it was not; treated as a Rule 3 blocking-issue fix, not an architectural change, since it's a one-word export addition with zero behavior change to the existing call site in list.ts's own renderActivityRow."
  - "Did not update detail.ts's own local formatDurationHms duplicate to import from list.ts — out of scope for this plan's declared files_modified (detail-sections.ts only); left as a known pre-existing duplicate for a future plan to consolidate."
  - "vs.-Avg bar fill: relative pace deviation (|split - avg| / avg) expressed as a percentage of half the track, capped at 100% of that half — a concrete, monotonic, boundable formula not fully pinned by the plan's prose contract."

requirements-completed: [DETAIL-04, DETAIL-05, BROWSE-06]

# Metrics
duration: 35min
completed: 2026-08-11
---

# Phase 17 Plan 13: Splits Table & Pace Distribution / HR Zone Breakdown Summary

**Two DOM section renderers for the activity detail page — a seven-column splits table with a sticky Km column and a labelled partial final row, plus an always-on pace-distribution histogram and a conditionally-absent HR-zone panel — both hand-rolled accessible bars, not Chart.js canvases.**

## Performance

- **Duration:** 35 min
- **Completed:** 2026-08-11T15:31:23Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `buildSplitsSection(splits, activityAvgPaceSecPerKm)` renders the pinned seven-column order (`Km | Pace | Elapsed | Avg HR | Avg Cadence | Elev Δ | vs. Avg`), with em dashes for channels the stream lacks, an italic `.splits-table__partial` label on the final partial km (`"7 (0.4 km, partial)"`, D-28), and a capped, direction-aware `.pace-bar` comparison column with an `aria-label` stating the signed seconds-per-km difference.
- `buildBreakdownSection(buckets, zoneTimes)` always renders the pace-distribution histogram when buckets exist (needs no configuration, D-29), and renders a five-zone HR breakdown ADDITIONALLY only when `zoneTimes` is non-null — returning `null` outright when both halves are absent, and rendering nothing at all for the zone half specifically when HR/config is missing (D-31: absence is a state, not a message).
- Confirmed via `npx tsc --noEmit`, `npm test -- --run src/dashboard` (312 tests green), and `npm run build-widgets && npm run verify-dashboard` (20/20 checks green, including a local regeneration of `data/stats/*` and `data/dashboard/index.json` via the project's existing gitignored compute scripts, to exercise the real publish path rather than skip verification).
- All zero-`innerHTML`, zero-fabricated-zone-boundary, and single-formatter-source acceptance-criteria greps pass exactly as specified.

## Task Commits

1. **Task 1: Seven-column splits table with a sticky Km column and a partial-row label** — `cc34da5` (feat)
2. **Task 2: Pace-distribution histogram and the conditionally-absent HR-zone panel** — `05b24e0` (feat)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/dashboard/views/detail-sections.ts` (325 lines) — `buildSplitsSection`, `buildBreakdownSection`, plus private helpers (`buildTextCell`, `formatElevDelta`, `buildKmCell`, `buildPaceBarCell`, `buildDistributionRow`, `buildPaceDistributionRows`, `buildHrZoneRows`)
- `src/dashboard/views/list.ts` — `formatDurationHms` changed from module-private to exported (one-line change; call site in `renderActivityRow` unaffected)

## Decisions Made

- The comparison-bar fill formula (relative pace deviation as a percentage of half the track, capped at 100% of that half) is a concrete instantiation of the plan's prose contract, which specified the visual behavior (extend left/right from a centred tick, capped so an outlier can't overflow) but not the exact denominator. Chose `|diff| / activityAvgPaceSecPerKm * 100`, i.e. the split's percentage deviation from average pace, since it is monotonic, dimensionless, and naturally bounded by the 100%-of-half cap for any real-world outlier.
- Kept both halves of `buildBreakdownSection` (pace histogram, HR zones) inside one function with two independent guard branches, mirroring the plan's own framing of the two D-29 halves as "independently gated," rather than splitting into two separately-exported functions — the single `<section>` wrapper (or `null`) is the contracted return shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Exported `formatDurationHms` from `list.ts`**
- **Found during:** Task 1, reading `list.ts` per the plan's own `<interfaces>` section, which states `export function formatDurationHms(totalSeconds: number): string;` is already available "from `src/dashboard/views/list.ts`."
- **Issue:** `list.ts` had a module-private `formatDurationHms` (used only by its own `renderActivityRow`); it was never exported. `detail-sections.ts` cannot satisfy its own acceptance criterion (`grep -c "from './list.js'"` == 1, single import) without a real, exported source for this formatter — duplicating it would fail the plan's own "no formatter fork" contract and diverge from the precedent already set for `formatPace`.
- **Fix:** Changed `function formatDurationHms` to `export function formatDurationHms` in `list.ts`. Zero behavior change — same implementation, same existing call site.
- **Files modified:** `src/dashboard/views/list.ts`
- **Verification:** `npx tsc --noEmit` clean; `npm test -- --run src/dashboard` still 312/312 green (no test asserts `formatDurationHms`'s export status either way, so this is a pure additive change).
- **Committed in:** `cc34da5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking interface fix, one-word export addition)
**Impact on plan:** Zero impact on shipped behavior; unblocks the exact import path the plan's own `<interfaces>` section documents as already existing.

## Issues Encountered

- Local worktree had no `data/stats/*.json` or `data/dashboard/index.json` (both gitignored, machine-local build artifacts). `npm run build-widgets && npm run verify-dashboard` initially failed on 2 of 20 checks for this reason, unrelated to this plan's own code. Regenerated locally via `npm run build`, `npm run compute-dashboard-index`, and `npm run compute-all-stats` (all pre-existing, unmodified project scripts) so the verification step actually exercised the real publish path instead of being skipped; re-ran `build-widgets`/`verify-dashboard` afterward for a clean 20/20. One incidental side effect (`data/geo/geo-metadata.json`'s `generatedAt` timestamp bump from `compute-all-stats`) was reverted with `git checkout --` before committing, since it is unrelated, gitignored-adjacent, and out of this plan's scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `buildSplitsSection` and `buildBreakdownSection` are ready for plan 17-14's `detail.ts` orchestrator to import and mount, in the section order `17-UI-SPEC.md § 4` pins (Splits, then Pace Distribution / HR Zones).
- `buildBreakdownSection`'s `HTMLElement | null` return type is intentional and must be handled by the caller (append only when non-null) — the type system enforces this at the 17-14 call site.
- No blockers. `formatPace`, `formatDurationHms`, `Split`, `PaceBucket`, and `ZoneTime` are all now cleanly re-usable from their single source modules with no forked formatters anywhere in the dashboard.

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/detail-sections.ts
- FOUND: src/dashboard/views/list.ts (modified)
- FOUND commit cc34da5 (Task 1)
- FOUND commit 05b24e0 (Task 2)
