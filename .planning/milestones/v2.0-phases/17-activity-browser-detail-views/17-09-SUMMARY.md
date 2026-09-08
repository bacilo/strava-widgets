---
phase: 17-activity-browser-detail-views
plan: 09
subsystem: ui
tags: [typescript, dom, dashboard, url-state, filters, accessibility]

# Dependency graph
requires:
  - phase: 17-activity-browser-detail-views
    provides: "17-08: paginated/sortable list.ts with an empty .list-toolbar seam; 17-02: list-logic.ts pure filter/chip/preset module; 17-01: styles.css filter-bar/chip/empty-state class contract"
provides:
  - "src/dashboard/views/list.ts: search box, collapsible range-filter panel (date/distance/pace/duration with date and distance presets), removable filter chips, Clear all, and a named zero-match empty state — all URL-driven"
affects: [17-15-browser-checkpoint, activity-browser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared debounce timer held on the view-factory instance (not module-level), cleared in unmount() — same discipline as the mountedContainer stale-render guard, extended to a second piece of per-instance mutable state"
    - "Panel open/closed is a plain in-memory boolean on the factory instance, deliberately outside ListState/the URL — toggled by direct DOM class manipulation in the click handler rather than a full navigateTo re-render, so it survives re-mounts within a session without becoming shareable/bookmarkable state"
    - "Each filter field builds its own buildNext(): ListState closure reading its own input element(s) and always resets page to 1; the same closure is wired to 'input' (debounced), 'change' (immediate), and Enter-key (immediate) so no update path can diverge from another"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts

key-decisions:
  - "Extended list-logic.ts's parseNonNegativeNumber tolerance pattern into a local parseOptionalNonNegativeNumber() helper in list.ts for the distance/duration number inputs — the plan only mandated this tolerance explicitly for pace (via parsePaceInput), but leaving a bare Number(raw) conversion in place would let a non-numeric string produce a silently-permissive NaN range filter (matchesRange's < / > comparisons are always false against NaN), which is the same T-17-URL-02 defect class the URL-parsing layer already guards against. Applied as Rule 2 (missing critical validation), not a plan deviation requiring a checkpoint."
  - "Changed the search input's aria-label from the literal placeholder text to 'Search activities' (distinct from the placeholder 'Search activities by name…') so the plan's own acceptance grep (`grep -c 'Search activities by name'` must equal exactly 1) isn't tripped by the accessible name duplicating the placeholder substring on a second line — the visible placeholder text remains the pinned copy from 17-UI-SPEC verbatim."
  - "Task 1 left the chip-row container as an empty <div class=\"chip-row\"> (matching the plan's own description of the Task 1/Task 2 split) and Task 2 replaced that empty-container line with a call to buildChipsRow(state, applyImmediate) — no other Task 1 code needed to change."

patterns-established:
  - "Debounce contract: text/numeric filter inputs apply on a 200ms debounce via 'input', and immediately via 'change' and Enter — implemented identically across all five filter surfaces (search, date, distance, pace, duration) using the same two factory-level applyImmediate/applyDebounced functions."

requirements-completed: [BROWSE-03, BROWSE-04, BROWSE-06]

# Metrics
duration: ~12min
completed: 2026-08-11
---

# Phase 17 Plan 09: Activity List Filter Bar — Search, Range Filters, Chips, Empty State Summary

**Filled `list.ts`'s `.list-toolbar` seam with a full filter bar: debounced search, a collapsible date/distance/pace/duration range panel with date and distance presets read from `list-logic.ts`, removable filter chips with `Clear all`, and a named zero-match empty state — every value round-tripping through the hash query string.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-11T17:49:11+02:00
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added an always-visible `<input type="search" class="list-search">` (placeholder "Search activities by name…", `aria-label="Search activities"`) writing to the `q` filter, debounced 200ms on `input` and applied immediately on `change`/Enter
- Added a `.filter-toggle` button reading `Filters` / `Filters ({n} active)` (driven by `activeFilterCount`) with `aria-expanded`/`aria-controls`, toggling a `.filter-panel` via direct DOM class manipulation — the open/closed boolean lives on the view-factory instance, never persisted, never in the URL (17-UI-SPEC § 2)
- Built the collapsible panel with four range fields — date (native date inputs + "This year"/"Last 12 months" presets via `datePresetRange`), distance (km inputs + `DISTANCE_PRESETS`-driven preset chips, no hardcoded bounds), pace (`m:ss` text inputs via `parsePaceInput`/`formatPaceInput`, unparseable values clear only that bound), duration (minute inputs) — pace and duration deliberately have no preset chips (D-10)
- Built the chips row exclusively from `buildFilterChips`/`removeChip` — each chip's visible text is `textContent`-only, each remove `<button>` carries an explicit `aria-label="Remove {label} filter"` and an inline-SVG × icon; `Clear all` appears once 2+ chips are active
- Added the zero-match empty state (D-12) — "No activities match your filters" / "Try widening your date range or distance, or clear a filter below." + `Clear all` — rendered in place of both the table wrapper and the card list, present even at exactly one active filter; pagination hidden entirely in this state
- Shared debounce timer held on the factory instance and cleared in `unmount()`, extending the existing `mountedContainer` stale-render discipline to a second piece of mutable per-instance state (T-17-VW-05)
- Updated the file header comment to describe the shipped paginated/sortable/filterable/text-searchable contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Search box, collapsible range-filter panel, and preset chips** - `4ac3bc2` (feat)
2. **Task 2: Removable chips, Clear all, live count, and the zero-match empty state** - `8e546cf` (feat)

**Plan metadata:** committed alongside this SUMMARY (worktree final commit)

## Files Created/Modified
- `src/dashboard/views/list.ts` - Extended from 629 to 1,116 lines: `buildToolbar`/`buildDateField`/`buildDistanceField`/`buildPaceField`/`buildDurationField`/`buildFilterPanel`/`buildChipsRow`/`buildRemoveIconSvg`/`buildEmptyState` (new), `applyImmediate`/`applyDebounced` plus `panelOpen`/`debounceTimerId` instance state added to `createListView`'s closure, `mount()` branches on `filtered.length === 0` to render the empty state instead of the table/cards/pagination, `unmount()` clears the debounce timer

## Decisions Made
- See `key-decisions` in frontmatter: local `parseOptionalNonNegativeNumber` tolerance helper for distance/duration inputs (Rule 2), the search `aria-label` wording fix to satisfy the plan's own exact-count grep assertion, and the empty-chip-row-then-fill split matching the plan's Task 1/Task 2 boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added NaN-safe parsing for distance and duration min/max inputs**
- **Found during:** Task 1 (distance range field) / carried into duration range field
- **Issue:** A bare `Number(minInput.value)` conversion on the distance/duration number inputs would produce `NaN` for any garbage input (e.g. a pasted non-numeric string bypassing the `type="number"` UI constraint via some input methods). `matchesRange`'s `value < min` / `value > max` comparisons are always `false` against `NaN`, so the filter would silently become a no-op — permissive rather than blocking, the same defect class `parseNonNegativeNumber` already guards against at the URL-parsing layer.
- **Fix:** Added a local `parseOptionalNonNegativeNumber(raw)` helper (empty string → `null`; `Number.isFinite` + `>= 0` required, otherwise `null`) and used it for both distance and duration min/max fields, mirroring the tolerance the plan already mandated explicitly for the pace fields via `parsePaceInput`.
- **Files modified:** src/dashboard/views/list.ts
- **Verification:** `npx tsc --noEmit` clean; `npm test -- --run src/dashboard` 350/350 green; manual trace of the NaN-permissive-filter scenario confirmed closed.
- **Committed in:** 4ac3bc2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical validation)
**Impact on plan:** Necessary for filter correctness under hostile/malformed numeric input. No scope creep — the plan's own threat register (T-17-URL-02) already established this exact tolerance pattern for the URL-parsing layer; this extends the same discipline to the DOM input layer that feeds it.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `list.ts` now fully implements BROWSE-03/BROWSE-04/BROWSE-06 on top of 17-08's BROWSE-01/BROWSE-02 — the activity browser (search, sort, filter, paginate, all URL-driven) is feature-complete pending plan 17-15's real-browser checkpoint.
- Full automated suite green: `npm test -- --run src/dashboard` (350/350 tests), `npx tsc --noEmit` clean, `npm run build-widgets` succeeds, `npm run verify-dashboard` 20/20 checks passed (dashboard index/stats artifacts regenerated locally via `npm run compute-all-stats` + `npm run compute-dashboard-index`, pure local recomputation, no network — the resulting incidental `data/geo/geo-metadata.json` timestamp bump was reverted before committing, per the plan's own out-of-scope note).
- DOM interaction behavior (search debounce timing, panel toggle, chip add/remove, preset clicks, empty-state rendering) is not automatable without jsdom in this repo (17-RESEARCH.md Pitfall 4) and is carried into plan 17-15's browser checkpoint, as the plan's own `<verification>` section anticipates: "applying a date filter plus a distance filter plus a text search shows three chips and a count matching the visible rows; removing each chip restores rows; a filter combination with no matches shows the named empty state with a working Clear all, not a blank table."
- No blockers for 17-10 through 17-14 (detail-view plans) — this plan touched only `list.ts`/`list.js` and did not change any exported symbol's signature that other views depend on (`formatDurationHms`, `noteViewedActivity`, `formatActivityDate`, `formatPace`, `renderActivityRow` are all unchanged).

## Self-Check: PASSED

- FOUND: src/dashboard/views/list.ts
- FOUND: commit 4ac3bc2 (Task 1)
- FOUND: commit 8e546cf (Task 2)

---
*Phase: 17-activity-browser-detail-views*
*Completed: 2026-08-11*
