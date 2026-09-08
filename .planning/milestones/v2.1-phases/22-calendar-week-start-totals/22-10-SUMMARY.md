---
phase: 22-calendar-week-start-totals
plan: 10
subsystem: ui
tags: [storage-guard, calendar, defense-in-depth, gap-closure, round-3]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals (plan 22-08)
    provides: Round 2 gap-closure checkpoint that closed the calendar-scoped half of Gap 2 (CR-01) and left the app-wide half (BL-03) open
provides:
  - "src/dashboard/storage.ts — the single app-wide `resolveStorage(override?)` handle resolver, exported alongside `WebStorage`"
  - "`resolveWeekStartStorage` reduced to a one-line delegation to `resolveStorage`, removing the parallel try/catch"
  - "WR-01 closed: a live-and-working branch test for both `resolveStorage` and `resolveWeekStartStorage`, each reading a value back through the resolved handle"
  - "WR-02 closed: a comment-stripped source-text regression guard in `calendar.test.ts` proving `calendar.ts` never dereferences a storage global directly"
  - "Two corrected security-note comments (`calendar-preferences.ts` header, `calendar.ts` rationale) that state the real blank-page failure mode instead of a nonexistent 'generic error panel'"
affects: [22-11, 22-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared narrow handle-resolver module (`storage.ts`) with an automated narrowness guard (no getItem/setItem/STORAGE_KEY/JSON.parse/console in its own source) preventing scope creep into a full preference facility"
    - "Type alias delegation for module reconciliation: `export type WeekStartStorage = WebStorage;` keeps a consumer-facing name stable while removing a duplicated structural declaration"
    - "Comment-stripped source-text regression guards (WR-02 style) reusing the `styles.test.ts` cssNoComments / `row-semantics.test.ts` stripComments precedent"

key-files:
  created:
    - src/dashboard/storage.ts
    - src/dashboard/storage.test.ts
    - .planning/phases/22-calendar-week-start-totals/deferred-items.md
  modified:
    - src/dashboard/views/calendar-preferences.ts
    - src/dashboard/views/calendar-preferences.test.ts
    - src/dashboard/views/calendar.ts
    - src/dashboard/views/calendar.test.ts

key-decisions:
  - "storage.ts lives at src/dashboard/ root (not views/), matching GC-5a — its consumers span the bootstrap, nav chrome, theme engine and two views"
  - "WeekStartStorage becomes a type alias of WebStorage rather than being deleted, preserving calendar.ts's and calendar-preferences.test.ts's existing imports with zero churn (GC-5c)"
  - "resolveWeekStartStorage survives as a one-line delegation rather than being deleted or left as a parallel implementation (GC-5e)"
  - "The two overclaiming comments now name the app-wide failure mode (blank page, main.ts's error panel unreachable) instead of the false 'generic error panel' claim, and defer the closure claim itself to plan 22-11"

patterns-established:
  - "App-wide storage guard pattern: a narrow, single-purpose handle resolver in src/dashboard/storage.ts that every per-key persistence module (calendar-preferences.ts today, theme.ts/nav.ts/main.ts/detail-charts.ts in plan 22-11) delegates to, rather than each dereferencing globalThis.localStorage independently"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-08-18
---

# Phase 22 Plan 10: App-wide storage handle resolver (BL-03) Summary

**Shared `resolveStorage()` handle resolver in `src/dashboard/storage.ts`, wired to the Calendar via a one-line `resolveWeekStartStorage` delegation, closing WR-01/WR-02 and correcting two comments that falsely claimed a calendar-scoped guard closed an app-wide blocked-site-data crash.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-18T20:28:22Z
- **Tasks:** 3
- **Files modified:** 6 (2 created source + 1 created test-support doc + 3 modified)

## Accomplishments
- Introduced `src/dashboard/storage.ts` (`WebStorage`, `resolveStorage`) as the single app-wide storage-global dereference site, fenced to a narrow handle resolver by an automated source-narrowness check (no `getItem`/`setItem`/`STORAGE_KEY`/`JSON.parse`/`console.` anywhere in its own live code)
- Reconciled `calendar-preferences.ts`'s `resolveWeekStartStorage` to delegate to `resolveStorage` in one line, removing the parallel try/catch around `globalThis.localStorage` that Round 2 shipped
- Closed WR-01 (the untested live-and-working branch) with new test cases in both `storage.test.ts` and `calendar-preferences.test.ts`, each reading a value back through the resolved handle — mutating either resolver to `return null;` now fails a test
- Closed WR-02 with a comment-stripped source-text regression guard in `calendar.test.ts` proving `calendar.ts` never dereferences `globalThis.(localStorage|sessionStorage)` or a bare `localStorage`/`sessionStorage` identifier, and does resolve through `resolveWeekStartStorage(`
- Corrected both overclaiming BL-03 comments (`calendar-preferences.ts` header's T-22-WK-02 note, `calendar.ts`'s rationale comment) to state the real failure mode — a BLANK page under blocked site data, with `main.ts`'s error panel unreachable because it wraps `view.mount()` inside `onMatch`, which never runs if module evaluation itself fails — and to name plan 22-11 as the remaining dependency for the app-wide closure claim

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the shared storage.ts handle resolver and prove BOTH its failing and its working branches** - `17a8904` (feat)
2. **Task 2: Reconcile resolveWeekStartStorage with the shared helper and close WR-01 on the calendar path** - `fe07dc9` (refactor)
3. **Task 3: Correct the two overclaiming comments (BL-03) and add the WR-02 regression guard** - `6955203` (docs)

_All three tasks used TDD (Tasks 1-2) or a direct comment/test-guard edit (Task 3); test files were written or extended and run RED before each corresponding implementation change._

## Files Created/Modified
- `src/dashboard/storage.ts` - the shared `WebStorage` interface and `resolveStorage` handle resolver; the single app-wide storage-global dereference site
- `src/dashboard/storage.test.ts` - identity/override, getter-throwing, absent-global, live-and-working (WR-01), console-silence, and source-narrowness coverage
- `src/dashboard/views/calendar-preferences.ts` - `WeekStartStorage` is now `= WebStorage`; `resolveWeekStartStorage` delegates in one line; header corrected to name `main.ts`/`nav.ts` as the module-scope crash sites and defer the app-wide closure claim to plan 22-11
- `src/dashboard/views/calendar-preferences.test.ts` - added the WR-01 live case and a `resolveWeekStartStorage`/`resolveStorage` agreement case; dropped the unused `beforeEach` import
- `src/dashboard/views/calendar.ts` - rationale comment above `resolveWeekStartStorage(deps.storage)` rewritten to state the real blank-page failure mode and cite BL-03; no executable line changed
- `src/dashboard/views/calendar.test.ts` - added the WR-02 comment-stripped source-structure regression guard
- `.planning/phases/22-calendar-week-start-totals/deferred-items.md` - new file logging an out-of-scope, pre-existing `npm test` gap (see Issues Encountered)

## Decisions Made
- `storage.ts` sits at `src/dashboard/` root, beside `theme.ts`/`nav.ts`/`router.ts`, per GC-5a — its consumers span the bootstrap, nav chrome, theme engine and two views, so putting it under `views/` would make the bootstrap import upward out of a view directory.
- Kept `resolveWeekStartStorage` as a named, one-line delegating entry point rather than deleting it and having `calendar.ts` import `resolveStorage` directly — preserves D-06 (the week-start persistence contract stays calendar-scoped) and avoids churning `calendar.ts`'s import list and plan 22-07's recorded `key_links` pattern.
- Left `calendar.ts`'s only executable line unchanged (`resolveWeekStartStorage(deps.storage)` at line 433/440) — only the comment above it was rewritten, keeping this plan's diff to comments and tests plus the one new shared module.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<action>` and `<behavior>` sections were implemented as specified, and every automated `<verify>` script in the plan passed verbatim (reproduced and re-run individually for each task; see Issues Encountered for the one adjacent finding).

## Issues Encountered

**Pre-existing, out-of-scope `npm test` failure (not a deviation, not fixed):** Task 3's chained verify command includes a full `npm test` run. 5 test files (`records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) fail at import time with `ENOENT` on `data/stats/*.json` — a gitignored, pipeline-generated directory absent from this fresh worktree checkout, unrelated to any file this plan touches. Logged to `deferred-items.md` per the executor's scope-boundary rule rather than fixed (generating it requires running the full stats pipeline, well outside this plan's `files_modified`). Verification substitute: the three files this plan touches (`storage.test.ts`, `calendar-preferences.test.ts`, `calendar.test.ts`) pass in full — 74 tests, 0 failures — `npx tsc --noEmit -p tsconfig.json` exits 0, and the remaining 47 test files not dependent on `data/stats/` all pass (1143 tests, 0 regressed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/dashboard/storage.ts` and `resolveStorage` are ready for plan 22-11 to wire `main.ts`, `nav.ts`, `theme.ts` and `detail-charts.ts` to the same resolver — the only remaining step before the app-wide BL-03 closure claim becomes true.
- No visual or browser claim is discharged by this plan (per its own `<verification>` section) — that is plan 22-12's Round 3 row R22, which may not be declined or waived.
- No requirement is ticked by this plan, matching its stated success criterion.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: src/dashboard/storage.ts
- FOUND: src/dashboard/storage.test.ts
- FOUND: .planning/phases/22-calendar-week-start-totals/deferred-items.md
- FOUND commit: 17a8904 (Task 1)
- FOUND commit: fe07dc9 (Task 2)
- FOUND commit: 6955203 (Task 3)
