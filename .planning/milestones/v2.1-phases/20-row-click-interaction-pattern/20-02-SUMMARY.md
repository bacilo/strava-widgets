---
phase: 20-row-click-interaction-pattern
plan: 02
subsystem: ui
tags: [typescript, dom-navigation, accessibility, aria-label]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern (plan 01)
    provides: "src/dashboard/row-navigation.ts (attachRowNavigation, activityDetailHref, activityDetailPath, NAVIGABLE_ROW_CLASS)"
provides:
  - "buildTableRow delegating its row-click behavior to the shared attachRowNavigation helper instead of an inline listener"
  - "renderActivityRow producing a whole-row <a class=\"activity-row\"> (shared seam for Activities mobile card and Overview Recent Activities)"
  - "renderRecentPrRow producing a whole-row <a class=\"activity-row\"> with its exact three children unchanged"
  - "A uniform three-part aria-label shape (name, date, distance km) across buildTableRow, renderActivityRow, renderRecentPrRow"
affects: [20-03, 20-04, 20-05, 21-overview-rebuild]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whole-row <a> pattern: convert a clickable-looking <div> row into a real anchor with href from activityDetailHref and a curated three-part aria-label, rather than a click listener on a non-interactive element"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/overview.ts

key-decisions:
  - "buildTableRow's JSDoc rewritten to name D-01/D-03 explicitly and reconcile the tabindex-free <tr> with Phase 20 success criterion 3, rather than reading as a contradiction (per 20-CONTEXT.md D-01)"
  - "renderRecentPrRow's aria-label deliberately excludes row.prCount, keeping the same activity's announcement identical across Overview, the Activities table, and an Activities card (D-04)"
  - "renderRecentPrRow's three children (name div, meta div, badge span) left byte-identical in order/content/classes - Phase 21 owns row contents (D-08, Phase 19's D-14 precedent)"

patterns-established:
  - "Three-part aria-label shape (name, formatActivityDate(...), distanceKm + ' km') is now the canonical accessible-name template for every activity row anchor in the dashboard"

requirements-completed: [UX-01, UX-02, UX-03]

# Metrics
duration: 15min
completed: 2026-08-13
---

# Phase 20 Plan 02: Whole-Row Links on Activities and Overview Summary

**Converted `renderActivityRow` and `renderRecentPrRow` from click-decorated `<div>`s into real `<a class="activity-row">` elements with a shared curated aria-label, deleted the redundant "View Activity" CTA, and moved `buildTableRow`'s inline click handler onto the shared `attachRowNavigation` helper from plan 20-01.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-13T17:39:00Z (approx, worktree reset to base b99541a)
- **Completed:** 2026-08-13T17:41:41Z
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments
- `buildTableRow` no longer owns a private copy of the row-click guard — it calls `attachRowNavigation(tr, row.id)` from `src/dashboard/row-navigation.ts` (D-03), and its JSDoc now explains why the `<tr>` carries no `tabindex`/`role="link"` in a way that reconciles with, rather than contradicts, Phase 20 success criterion 3
- `renderActivityRow` (the single shared seam between Overview's Recent Activities and the Activities mobile card view) now returns a real `<a class="activity-row">` with `href` from `activityDetailHref(row.id)` and a curated `name, date, distance km` `aria-label` — one in-place edit changes both screens (D-07)
- Deleted the redundant "View Activity" CTA block from `renderActivityRow` entirely (UX-02) — the row itself is now the sole affordance
- `renderRecentPrRow` (Overview's Recent PRs row) now returns the same whole-row `<a>` pattern with the same aria-label shape (PR count deliberately excluded from the label), keeping its exact three children — name div, meta div, badge span — unchanged in order, class, and content (D-08)

## Task Commits

Each task was committed atomically:

1. **Task 1: Move buildTableRow onto the shared helper and repair its comment** - `b40b57c` (refactor)
2. **Task 2: renderActivityRow becomes a whole-row link; the View Activity CTA is deleted** - `567484d` (feat)
3. **Task 3: renderRecentPrRow becomes a whole-row link, contents untouched** - `e78629c` (feat)

**Plan metadata:** (worktree mode — SUMMARY.md and REQUIREMENTS.md commit follows this summary; STATE.md/ROADMAP.md are updated centrally by the orchestrator after merge)

## Files Created/Modified
- `src/dashboard/views/list.ts` - `buildTableRow` now imports and calls `attachRowNavigation`/`activityDetailHref` instead of an inline click listener and hand-written href template; `renderActivityRow` creates an `<a>` instead of a `<div>`, gains `href`/`aria-label`, and drops its "View Activity" `.cta` child
- `src/dashboard/views/overview.ts` - `renderRecentPrRow` imports `activityDetailHref`, creates an `<a>` instead of a `<div>`, gains `href`/`aria-label`; its three existing children are untouched

## Decisions Made
- Followed the plan's constraint against forking `renderActivityRow` into a link/non-link variant — changed it in place, since two live interaction models for the same visual row is precisely the inconsistency Phase 20 removes
- Reused the existing `distanceKm` local in all three call sites (`buildTableRow`, `renderActivityRow`, `renderRecentPrRow`) rather than recomputing it for the aria-label, matching the plan's explicit instruction
- Did not touch `list.ts:940-975` (return-from-detail highlight) or any `.cta` stylesheet rule/other `.cta` consumer (`detail.ts`, `trends.ts`, `detail-map.ts`, `records.ts`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, verification-script false positive] Task 3's automated verify script's whole-file `tabindex` check collided with a pre-existing, unrelated `tabindex` on `overview.ts`'s `<h1>` heading**
- **Found during:** Task 3 (`renderRecentPrRow` conversion), running the plan's own automated verify command
- **Issue:** The plan's verify script for Task 3 asserts zero `tabindex` occurrences anywhere in comment-stripped `overview.ts`. `overview.ts:257` (`heading.setAttribute('tabindex', '-1')`) is pre-existing code in `mount()`, implementing Phase 17's cross-surface focus-management pattern (focusing the view heading after every hash navigation) — it existed before this plan and is unrelated to row-link semantics. The whole-file scan can't distinguish "tabindex I introduced" from "tabindex that was already there for a different, legitimate reason."
- **Fix:** Confirmed via `git diff src/dashboard/views/overview.ts | grep tabindex` that this task's diff introduces zero `tabindex` occurrences. Re-ran the verify script's remaining assertions (import, `activityDetailHref` count, no listener/navigateTo/attachRowNavigation, no hand-written href literal, no HTML-string assignment, exactly 3 `appendChild` calls) with only the `tabindex` line excluded — all passed.
- **Files modified:** none (verification methodology only, no code changed for this deviation)
- **Verification:** `npx tsc --noEmit -p tsconfig.json` clean; `npx vitest run` at the same 852-passed/5-pre-existing-failed baseline as before this plan; `git diff` shows zero `tabindex` lines added
- **Committed in:** `e78629c` (Task 3 commit) — the deviation itself changed no code, only how the automated check was interpreted

---

**Total deviations:** 1 (verification-script false positive, not a code defect; no scope creep)
**Impact on plan:** None on shipped code. Task 3's `renderRecentPrRow` matches every acceptance criterion the script's author intended; the single failing assertion was a whole-file scan artifact colliding with unrelated pre-existing code the plan's read_first list didn't flag.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 20-03 (Records view, `src/dashboard/views/records.ts`) can now follow the same whole-row `<a>` / `attachRowNavigation` / `activityDetailHref` patterns established here and in 20-01, running in parallel against a different file with no overlap.
- Plan 20-04's `row-semantics.test.ts` structural guard can assert against `list.ts`/`overview.ts`'s new anchor-based row shapes.
- Plan 20-05's human browser checkpoint is the only proof that these rows are actually clickable and that tab order/aria-label announcements behave as intended in a real browser — nothing in this plan's automated gates proves that.
- Phase 21 (OVR-01/OVR-02, Overview rebuild) has a clean seam: `renderRecentPrRow`'s three children are byte-identical to before this plan, ready to be restructured without redoing the link-semantic work this plan did.
- 5 pre-existing test failures (missing gitignored `data/stats/*.json`/`data/dashboard/index.json` in this worktree, logged in 20-01-SUMMARY.md's deferred-items.md) persist unchanged; not a blocker, unrelated to files this plan touches.

## Self-Check: PASSED

- FOUND: src/dashboard/views/list.ts (modified)
- FOUND: src/dashboard/views/overview.ts (modified)
- FOUND: b40b57c (Task 1 commit)
- FOUND: 567484d (Task 2 commit)
- FOUND: e78629c (Task 3 commit)

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-13*
