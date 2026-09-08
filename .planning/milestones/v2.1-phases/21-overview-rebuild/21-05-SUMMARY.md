---
phase: 21-overview-rebuild
plan: 05
subsystem: ui
tags: [typescript, vitest, records-view, year-scope, segmented-control, aria]

# Dependency graph
requires:
  - phase: 21-overview-rebuild (plan 01)
    provides: stable records.ts / records-logic.ts module boundary this plan extends (no direct field dependency — 21-01's currentStreakEnd fix lives in the Superlatives path, untouched by this plan)
provides:
  - "`RecordScope` type and pure `filterRankingsToYear` filter + 1..N re-rank in records-logic.ts"
  - "A `.segmented[role=group]` All time / This year toggle above the seven per-distance PR tables in records.ts, using only existing `.segmented` CSS"
  - "A distance- and scope-aware `buildPrTableEmptyState`, closing a latent hardcoded-marathon-copy defect (21-RESEARCH.md Pitfall 3)"
affects: [21-07-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "View-local, non-persisted UI state via a plain closure local re-initialised on every section-builder call (`let scope: RecordScope = 'all-time'` inside `buildPrTablesSection`, freshly created on every `#/records` arrival) — satisfies a 'never persists, always resets' requirement (D-04) by construction rather than an explicit reset step"
    - "Scoped re-render via `container.replaceChildren(...)` on a stable, purpose-built container div, leaving the owning section, its heading and sibling sections untouched — mirrors detail-charts.ts's `rebuildBands()` idiom"

key-files:
  created: []
  modified:
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts
    - src/dashboard/views/records.ts
    - src/dashboard/row-semantics.test.ts

key-decisions:
  - "D-01/D-02/D-03/D-04 all implemented exactly as specified: the scope control lives only inside records-pr-tables, exactly two scopes via the existing .segmented control, only the PR tables re-render, and scope is a transient closure local with no storage key and no URL parameter"
  - "buildPrTableEmptyState's hardcoded 'No marathon efforts yet' copy (a latent defect predating this plan, 21-RESEARCH.md Pitfall 3) was fixed in this phase per the plan's own explicit disposition, not deferred, since year-scoping was going to make many more distances hit that code path"
  - "row-semantics.test.ts's rowSemanticViolations role-write allowlist was widened (Rule 3 - blocking issue) to permit segmented.setAttribute('role', 'group'), following the guard's own documented widening protocol; only the isAllowedRoleWrite function and its comment were touched, not the UX-01/D-03 or CR-02 describe blocks plan 21-04 separately re-points"

requirements-completed: [OVR-03]

# Metrics
duration: ~35min
completed: 2026-08-18
---

# Phase 21 Plan 05: Records year-scope toggle Summary

**A two-option All time / This year `.segmented` control above the Records PR tables, backed by a pure `filterRankingsToYear` filter-and-re-rank in `records-logic.ts`, closing OVR-03.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 4 (3 declared + 1 deviation)

## Accomplishments
- `filterRankingsToYear(entries, year)` is a pure, clock-free, UTC-correct filter that subsets a distance's all-time PR ranking to one year and reassigns `rank` 1..N — never re-sorting, never mutating, dropping unparseable dates rather than throwing or miscounting them.
- A `.segmented[role=group]` All time / This year toggle now sits inside `section#records-pr-tables`, built from the exact same markup shape as `detail-charts.ts`'s existing x-axis control, using zero new CSS.
- Toggling calls a local `renderTables(scope)` that `replaceChildren()`s only a dedicated tables container — `section#records-pr-tables`, its `h2` (the jump-nav's anchor), and the other three Records sections (Superlatives, PR Evolution, Race Predictions) are never touched, preserving D-03 and the existing jump-list/IntersectionObserver wiring untouched.
- `buildPrTableEmptyState` closed a real, pre-existing defect: it rendered `'No marathon efforts yet'` for every empty distance, not just marathon. It now takes `distance`, `scope` and `year`, and names the correct distance and (in year scope) the correct year.
- `scope` is a plain closure local re-initialised to `'all-time'` on every `buildPrTablesSection` call — since `load()` rebuilds this section fresh on every `#/records` arrival, D-04 (no persisted scope) holds by construction with no reset step to remember.

## Task Commits

Each task was committed atomically:

1. **Task 1: The pure year filter and re-rank** - `240061f` (feat)
2. **Task 2: A per-distance, scope-aware empty state** - `abb1f73` (fix)
3. **Task 3: The .segmented scope control and the scoped re-render** - `34353e4` (feat)

**Plan metadata:** committed separately per worktree-mode convention (SUMMARY.md only; STATE.md/ROADMAP.md updates deferred to orchestrator)

## Files Created/Modified
- `src/dashboard/views/records-logic.ts` - Added `RecordScope` type and `filterRankingsToYear`, placed next to `buildPrTableRows`/`isEmptyRanking`
- `src/dashboard/views/records-logic.test.ts` - Added `describe('filterRankingsToYear — OVR-03 year scope (D-01/D-02)')`: subset + source order, 1..N re-rank, empty-year result, undefined-input guard, UTC year-boundary correctness (1 Jan / 31 Dec, both archive date spellings), non-mutation, unparseable-date drop
- `src/dashboard/views/records.ts` - `buildPrTableEmptyState` parameterized by distance/scope/year; `buildPrTableSection` forwards them; `buildPrTablesSection` restructured with the `.segmented` control, `renderTables`/`setScope` closures, and a stable `tablesContainer` replace target
- `src/dashboard/row-semantics.test.ts` - `isAllowedRoleWrite` widened to permit `segmented.setAttribute('role', 'group')`, with the allowlist comment updated to name the new call site (deviation, see below)

## Decisions Made
- The year is resolved once per `buildPrTablesSection` call via `new Date().getUTCFullYear()` (D-11's clock rule) and passed down to both the filter and the empty state; `filterRankingsToYear` itself never reads a clock, keeping it pure and testable.
- No sort was added anywhere in `filterRankingsToYear` — source order (already rank-ascending from the build-time generator) is preserved; re-sorting would be a second, divergent ranking policy.
- The empty-state signature change (`buildPrTableEmptyState(distance, scope, year)`) and its call site in `buildPrTableSection` were introduced in Task 2 with a type-correct `'all-time'`/current-year placeholder at the (then-unrestructured) `buildPrTablesSection` call site, so Task 2's own gate (`tsc`, `npm test`) was green in isolation before Task 3 replaced that loop wholesale with the real scope-toggle-driven `renderTables`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened row-semantics.test.ts's role-write allowlist for the new `.segmented[role=group]` control**
- **Found during:** Task 3 (The `.segmented` scope control and the scoped re-render)
- **Issue:** `src/dashboard/row-semantics.test.ts`'s `rowSemanticViolations` guard (D-01/WR-01, a Phase 20 regression guard proving no `<tr>` ever gets a fake `role`/`tabindex`) blanket-rejects ANY new `role` attribute write in `records.ts` unless its receiver/value pair is explicitly named on a two-entry allowlist. The plan's own `<interfaces>` mandated copying `detail-charts.ts`'s `.segmented[role=group]` markup near-verbatim; `segmented.setAttribute('role', 'group')` tripped the guard (`records.ts: [ "segmented.setAttribute('role', 'group')" ]`), failing both `npm test` and the plan's own per-wave gate.
- **Fix:** Widened `isAllowedRoleWrite` to also permit `receiver === 'segmented' && value.toLowerCase() === 'group'`, and extended the function's own comment to name the new call site (`records.ts`'s OVR-03 scope toggle inside `buildPrTablesSection`) — following the guard's own documented widening protocol verbatim ("Widening either rule requires naming the new call site in the comment above it"). `group` is the correct native ARIA role for a set of mutually-exclusive toggle buttons and is never confusable with a `<tr>` row role, which is what the guard exists to block. Only the `isAllowedRoleWrite` function and its comment block were touched — the `UX-01/D-03` and `CR-02` describe blocks that plan 21-04 separately re-points for its own Overview retirement work were left untouched, to minimize any merge surface with that parallel plan.
- **Files modified:** `src/dashboard/row-semantics.test.ts` (outside this plan's declared `files_modified`)
- **Verification:** `npx vitest run src/dashboard/row-semantics.test.ts` — 65/65 passing (was 63/65 before the fix); full `npm test` — 1097/1097 passing; `npx tsc --noEmit -p tsconfig.json` and `npm run build-widgets` both clean
- **Committed in:** `34353e4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (blocking issue in a file outside this plan's declared scope, fixed via the file's own documented widening process)
**Impact on plan:** Necessary for the plan's own mandated markup (D-02) to pass the existing accessibility-regression suite. No scope creep — the fix is a two-clause allowlist widening plus a comment, nothing structural.

## Issues Encountered
- The fresh git worktree this plan executed in did not carry gitignored, locally-generated `data/stats/` and `data/dashboard/` directories (a worktree-isolation artifact, not a code issue, matching the note already recorded in plan 21-01's summary). Copied both directories from the main checkout (`cp -R`, local generated JSON only, no network or git operation) before running the test suite, per the environment note.

## Next Phase Readiness
- OVR-03 is closed: `filterRankingsToYear`'s subset/re-rank correctness, the `.segmented` control's source shape, and the scope-aware empty state are all asserted by automated tests and `npm run build-widgets`.
- NOT asserted by this plan (no jsdom/headless browser in this repo): that the control actually renders, that clicking it re-ranks the seven tables live, that the other three Records sections visibly stay all-time, and that the scope visibly resets on re-arrival at `#/records`. These are plan 21-07's checkpoint rows R6-R10, per this plan's own `<verification>` block.

## Self-Check: PASSED

- FOUND: src/dashboard/views/records-logic.ts (filterRankingsToYear, RecordScope)
- FOUND: src/dashboard/views/records-logic.test.ts (filterRankingsToYear — OVR-03 year scope describe block)
- FOUND: src/dashboard/views/records.ts (buildPrTablesSection segmented control)
- FOUND: src/dashboard/row-semantics.test.ts (isAllowedRoleWrite widened)
- FOUND: 240061f (Task 1 commit)
- FOUND: abb1f73 (Task 2 commit)
- FOUND: 34353e4 (Task 3 commit)
