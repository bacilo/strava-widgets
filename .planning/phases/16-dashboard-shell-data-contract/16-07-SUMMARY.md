---
phase: 16-dashboard-shell-data-contract
plan: 07
subsystem: ui
tags: [vanilla-ts, dom-construction, spa-shell, view-registry, tdd, lazy-fetch]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 03)
    provides: DashboardView/ViewMountContext types, ROUTES/ALL_ROUTES/NAV_ORDER tables, router.ts (isValidActivityId, createRouter, navigateTo)
  - phase: 16-dashboard-shell-data-contract (plan 05)
    provides: createIndexClient/IndexClient, createDetailClient/DetailClient/ActivityDetail/InvalidActivityIdError
  - phase: 16-dashboard-shell-data-contract (plan 06)
    provides: index.html SPA entry, createNav, applyThemeMode/readStoredMode, the three stub views
provides:
  - "src/dashboard/views/overview.ts — createOverviewView, the D-06 landing view: headline stats, recent PRs, recent activities"
  - "src/dashboard/views/list.ts — createListView + renderActivityRow (shared row renderer) + formatActivityDate (shared date formatter)"
  - "src/dashboard/views/detail.ts — createDetailView, the D-07 proving slice: lazy fetch, loading, stale-response guard, error, retry"
  - "src/dashboard/view-registry.ts — VIEWS/getView/clients, the single enumeration point (D-03)"
  - "src/dashboard/main.ts — the bootstrap wiring theme, nav, router, and the up-front index prefetch together"
affects: [17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closure-captured mountedContainer + monotonic requestToken pair as the stale-response guard: unmount() invalidates both, so an in-flight fetch that resolves after navigation away is a silent no-op rather than a wrong-activity paint (T-16-VW-04)"
    - "Individually try/catch-guarded parallel stats fetches (overview.ts) so a missing gitignored stats file degrades one stat card to an em dash instead of failing the whole view"
    - "Shared row renderer (renderActivityRow) exported from list.ts and imported into overview.ts — one row-rendering implementation serves two views"
    - "view-registry.ts constructs indexClient/detailClient exactly once at module scope and exports them as `clients`, so main.ts's prefetch and every view's mount share the same memoized fetch-once client instances"

key-files:
  created:
    - src/dashboard/views/overview.ts
    - src/dashboard/views/list.ts
    - src/dashboard/views/detail.ts
    - src/dashboard/view-registry.ts
    - src/dashboard/view-registry.test.ts
    - src/dashboard/main.ts
  modified: []

key-decisions:
  - "Detail view's average pace is computed as movingTimeSec / (distanceM/1000), matching the index generator's formula exactly (compute-dashboard-index.ts), rather than derived from StravaActivity.average_speed — keeps the single-activity stat consistent with the index row's own paceSecPerKm semantics"
  - "formatActivityDate reads UTC getters off `new Date(startDateLocal)` rather than any timezone-aware parsing, because Strava's start_date_local is Z-suffixed but semantically already local wall-clock time (compute-dashboard-index.ts's own precedent); UTC getters on a Z-suffixed string return the literal components with zero additional conversion"
  - "The invalid-route-id error state (detail.ts) reuses the exact UI-SPEC error copy (heading + body) but swaps the Retry button for a Browse Activities CTA, since retrying a malformed URL cannot succeed — one visual component, two exit affordances depending on failure cause"
  - "DashboardView.navEntry is left unset on overview/list/detail (as stub-view.ts already established) — NAV_ORDER alone drives nav construction in nav.ts; the field exists on the type for the D-05 contract test (getView(ROUTES.DETAIL).navEntry is undefined) but nothing in this codebase currently reads it off a view instance"
  - "Reworded three doc comments (overview.ts, list.ts, detail.ts) that incidentally quoted the plan's own verify-script literal substrings ('best-efforts.json', 'item.innerHTML = ...', 'Chart.js'/'Leaflet') in prose — same pattern as plan 06's precedent, no functional change"

patterns-established:
  - "Pattern: TDD-only for the data-only view-registry.test.ts (no mount() invocation, no DOM) per vitest's node environment; the three view files (overview/list/detail) are non-TDD auto tasks verified by tsc + literal-substring contract scripts, since they require a DOM the test environment doesn't provide"

requirements-completed: [DASH-01, DASH-02, DASH-03]

# Metrics
duration: ~40min
completed: 2026-08-10
---

# Phase 16 Plan 07: View Registry, Bootstrap, and the D-07 Proving Slice Summary

**Three real dashboard views (overview, activities list, activity detail) wired through a six-route view registry and a theme/nav/router bootstrap — closing the D-07 proving slice end to end: a real index row's `View Activity` link lazy-fetches that activity's committed detail and stream files and renders its stats header.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 completed (Task 3 as a full TDD RED → GREEN cycle)
- **Files modified:** 6 created (0 modified)

## Accomplishments

- Built `overview.ts` (`createOverviewView`): renders a Headline Stats card (total distance/runs/hours/elevation, current/longest streak) from `data/stats/all-time-totals.json` and `data/stats/streaks.json`, each individually try/catch-guarded so a missing gitignored stats file degrades that one card to an em dash rather than failing the view; a Recent PRs card (5 most recent rows with `prCount > 0`, or the exact "no records yet" copy); and a Recent Activities card (10 newest rows) reusing `list.ts`'s shared row renderer. Never fetches the 2.5MB best-efforts document — PR counts come from the already-resolved `row.prCount`.
- Built `list.ts` (`createListView` + exported `renderActivityRow`/`formatActivityDate`): renders the newest 100 of ~1,867 index rows with an explicit truncation notice and zero sort/filter/search/pagination controls (Phase 17 scope, T-16-VW-03). Every athlete-authored string (`row.name`) is written via `textContent`. Each row's `View Activity` anchor is a real `<a href="#/activity/<id>">` — middle-click, copy-link and bookmarking all work, proving D-02's bookmarkable-route contract in the same element that triggers D-07's lazy fetch.
- Built `detail.ts` (`createDetailView`): validates the route id via the shared `isValidActivityId` chokepoint before any fetch or DOM write — an invalid id renders the error state with a `Browse Activities` CTA (no Retry, since retrying a malformed URL cannot succeed) and logs the offending id to `console.warn` only, never the DOM (T-16-VW-02). A valid id shows a `role="status"` loading indicator, then `detailClient.loadDetail(id)`; a monotonic request token plus container-identity check discards a stale response if the view was unmounted or superseded by a newer navigation while the ~76KB stream was in flight (T-16-VW-04). Success renders the stats header (distance/time/pace/elevation/HR/cadence, em dash for any null field) plus a stream summary card (sample count, channel presence, distance source) that degrades to "No stream data for this activity." plus the index row's unavailability reason badge when `stream` is `null` (STREAM-03). Failure renders the exact UI-SPEC copy with a Retry that re-invokes the same load path.
- Built `view-registry.ts` (TDD): constructs `indexClient`/`detailClient` exactly once, exports them as `clients`, and enumerates all six routes into `VIEWS` with an O(1) `getView()` lookup backed by a `Map`. `view-registry.test.ts` asserts registry DATA only (route coverage, no duplicates, `getView` resolution for all six routes plus an unregistered miss, `getView(ROUTES.DETAIL).navEntry` undefined, and full `NAV_ORDER` → `getView` resolution) — no `mount()` call, matching the node-only vitest environment.
- Built `main.ts`: re-applies the theme at module scope, mounts the nav, kicks off `clients.indexClient.loadIndex()` without awaiting it (`.catch(() => {})` guards the unhandled-rejection case), and starts the router. `onMatch` unmounts the previous view, looks up the next one, sets `document.title`, updates the active nav route, and mounts inside a try/catch that renders a generic error panel on throw. `onNoMatch` warns and redirects to the overview route without ever writing the unmatched path into the DOM.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the overview and activities-list views on the index manifest** — `ab57548` (feat)
2. **Task 2: Build the detail view — the lazy-fetch proving slice with loading, error and retry** — `e708acf` (feat)
3. **Task 3: Assemble the view registry and the bootstrap** — `b77f84c` (test, RED) → `d5f54da` (feat, GREEN)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree execution — no plan-metadata commit made here).

_Note: Task 3 needed no REFACTOR commit — the implementation was clean on first GREEN pass (13/13 tests)._

## Files Created/Modified

- `src/dashboard/views/overview.ts` — `createOverviewView`; headline stats, recent PRs, recent activities cards
- `src/dashboard/views/list.ts` — `createListView`, `renderActivityRow` (exported, shared with overview), `formatActivityDate` (exported, shared with overview and detail); 100-row cap with truncation notice
- `src/dashboard/views/detail.ts` — `createDetailView`; id validation chokepoint, stale-response guard, stats header, stream summary, error/retry
- `src/dashboard/view-registry.ts` — `VIEWS`, `getView`, `clients` (indexClient + detailClient constructed once)
- `src/dashboard/view-registry.test.ts` — 13 tests covering route coverage, no-duplicates, `getView` resolution (6 routes + miss), detail `navEntry` undefined, `NAV_ORDER` resolution
- `src/dashboard/main.ts` — bootstrap: theme re-apply, nav mount, unawaited index prefetch, router start, view swap with unmount/mount and title/nav updates

## Decisions Made

See `key-decisions` in frontmatter. Notably: detail-view pace uses the same formula as the index generator rather than `average_speed`, for cross-view numeric consistency; `formatActivityDate` relies on Strava's Z-suffixed-but-local `start_date_local` convention (already established by `compute-dashboard-index.ts`) so UTC getters return literal components with no extra conversion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comments tripped the plan's literal verify-script substring checks**
- **Found during:** Task 1 verification (`overview.ts`, `list.ts` contract script) and Task 2 verification (`detail.ts` contract script)
- **Issue:** Explanatory prose comments quoted `best-efforts.json` (overview.ts), `item.innerHTML = ...` (list.ts), and `Chart.js`/`Leaflet` (detail.ts) purely as descriptive text. The plan's verify scripts are literal regex/`includes` checks against the whole file with no code/comment distinction, so these non-functional prose mentions caused false failures — same class of issue plan 06's summary documented.
- **Fix:** Reworded the four comments to convey the same information without the flagged literal substrings; no executable code changed.
- **Files modified:** `src/dashboard/views/overview.ts`, `src/dashboard/views/list.ts`, `src/dashboard/views/detail.ts`
- **Verification:** Re-ran all three contract scripts (`views contract OK`, `detail.ts contract OK`) plus `npx tsc --noEmit` and the full `npm test` suite (334/334 passing)
- **Committed in:** `ab57548` (overview.ts, list.ts), `e708acf` (detail.ts) — folded into each task's single commit since no separate commit had landed yet

---

**Total deviations:** 1 auto-fixed (Rule 1, cosmetic comment wording only, same pattern as plan 06's precedent)
**Impact on plan:** No scope creep, no behavioral change — purely aligning comment prose with the plan's literal string-matching verification scripts.

## Issues Encountered

Worktree HEAD had not been fast-forwarded to the plan's declared base commit (`00b098f442fb5feabb02e734d074f0b802d8db88`) when the agent started — `git merge-base HEAD <base>` returned an older commit (`4967a8b`, itself an ancestor of the intended base) instead. Resolved with `git reset --hard 00b098f442fb5feabb02e734d074f0b802d8db88` per the worktree branch-check protocol, before any file changes were made — same pattern noted in plans 03 and 05's summaries. No impact on plan execution.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The D-07 proving slice is closed end to end: a real index row's `View Activity` link lazy-fetches exactly that activity's two committed files and renders its stats header, with a clean degraded state for missing streams and a working Retry for genuine failures. Phase 17 can build the full browse/detail experience on top of this contract without renegotiating it.
- `getView`/`VIEWS`/`clients` are the stable extension points for Phase 17/18 views — one new view module, one line in `VIEWS`, one optional `NAV_ORDER` entry.
- No blockers.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `src/dashboard/views/overview.ts`
- FOUND: `src/dashboard/views/list.ts`
- FOUND: `src/dashboard/views/detail.ts`
- FOUND: `src/dashboard/view-registry.ts`
- FOUND: `src/dashboard/view-registry.test.ts`
- FOUND: `src/dashboard/main.ts`
- FOUND: `.planning/phases/16-dashboard-shell-data-contract/16-07-SUMMARY.md`
- FOUND commit: `ab57548` (feat, Task 1)
- FOUND commit: `e708acf` (feat, Task 2)
- FOUND commit: `b77f84c` (test, Task 3 RED)
- FOUND commit: `d5f54da` (feat, Task 3 GREEN)
