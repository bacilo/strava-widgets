---
phase: 20-row-click-interaction-pattern
plan: 17
subsystem: ui
tags: [accessibility, links, records, gap-closure, d-13]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "plan 20-15's receiver-keyed rowSemanticViolations D-01 guard, pre-widened to admit the named pair cellAnchor/-1 and the flagsAnchor badge receiver so this plan's shapes land without a guard fighting it; plan 20-16's .pr-table__cell-link CSS rule (color: inherit, text-decoration: none, display: block)"
provides:
  - "buildCellLink(activityId, ariaLabel) — the single factory building every non-Date-cell anchor in both Records tables, real <a href> + tabIndex = -1 + the curated Date-cell label reused verbatim"
  - "D-13 implemented on both tables: PR-table Rank/Time/Pace/Age-Grade/Flags and progression-table Time/Improvement each carry a real anchor to activityDetailHref(row.activityId)"
  - "A pinned D-13 source-structure guard block in row-semantics.test.ts (6 new assertions) asserting the anchor count, the single cellAnchor tabIndex write, the CSS class count, the URL-builder call count, D-01 non-regression, and the conditional Flags-cell append"
affects: [20-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shared cell-link factory (buildCellLink) reused across all non-keyboard-stop cells in a table, taking tabIndex = -1 so exactly one anchor per row stays a real keyboard stop"

key-files:
  created: []
  modified:
    - src/dashboard/views/records.ts
    - src/dashboard/row-semantics.test.ts

key-decisions:
  - "D-13 pre-authorised source-structure guard (task 2) scopes its tabIndex assertion to the named cellAnchor receiver specifically, not a literal whole-file .tabIndex = count — see Deviations."

patterns-established:
  - "One factory, seven call sites: a table's non-keyboard-stop content cells each get an identical real-anchor treatment from one function, rather than each cell hand-rolling its own anchor construction."

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-08-17
---

# Phase 20 Plan 17: D-13 — real anchors on every content-carrying Records cell Summary

**Every content-carrying cell of both Records PR tables (Rank/Time/Pace/Age-Grade/Flags and the progression table's Time/Improvement) now wraps its content in a real `<a href>` built by one shared `buildCellLink` factory, closing R18/R19 by giving the browser's own modifier-click, middle-click and drag handling a real anchor to act on, while the Date-cell anchor stays the row's single keyboard stop.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-17T20:34:00Z
- **Completed:** 2026-08-17T20:52:51Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 2 (`src/dashboard/views/records.ts`, `src/dashboard/row-semantics.test.ts`)

## Accomplishments

- **Task 1 — `buildCellLink` factory, applied to all seven non-Date cells.** Added a module-private `buildCellLink(activityId, ariaLabel): HTMLAnchorElement` immediately above `buildPrTable`, setting `className = 'pr-table__cell-link'` (plan 20-16's rule), `href = activityDetailHref(activityId)`, `aria-label` via `setAttribute`, and `cellAnchor.tabIndex = -1` — the file's only `tabIndex` write on a non-heading receiver. `buildPrTable` hoists `curatedLabel` once per row (the exact three-part template previously rebuilt inline on `dateAnchor`) and wraps `rankTd`, `timeTd`, `paceTd`, `ageTd` in cell links; the `<td>` keeps `className = 'pr-table__numeric'`, the class does not move to the anchor. `flagsTd`'s anchor is named `flagsAnchor` per plan 20-15's pre-widened guard, and is appended to `flagsTd` only when at least one badge (`appendLowConfidenceBadge` / `appendBadge`) actually fired — a flag-less row keeps a plain empty `<td>`, not an empty labelled link. `buildProgressionTable` gets the identical treatment for its Time and Improvement cells. `attachRowNavigation(tr, row.activityId)` stays at both call sites, in its existing position (IN-08's inconsistency is not resolved or pinned here). Both function docblocks were rewritten to drop the old "Date cell carries the anchor because PrTableRow has no activity-name field" framing (that was true of the label, not the href) and describe the new one-factory/one-keyboard-stop shape.
- **Task 2 — D-13 invariants pinned in `row-semantics.test.ts`.** Added a `D-13 - every content-carrying Records cell is a real link, with one keyboard stop per row` describe block with six assertions: `buildCellLink(` occurs exactly 8 times (1 definition + 7 call sites, named individually in the failure message); `cellAnchor.tabIndex = -1` occurs exactly once; `pr-table__cell-link` occurs exactly once; `activityDetailHref(` occurs exactly 3 times; `rowSemanticViolations(recordsStripped)` stays empty; and `flagsTd.appendChild(flagsAnchor)` is single and guarded by an `if (` between the `flagsAnchor` declaration and the append. Also corrected the pre-existing `UX-01 / D-03` block's `activityDetailHref(` count for `records.ts` from 2 to 3 (the direct, predictable consequence of D-13's own math). Plan 20-15's role rule, `isAllowedTabIndexReceiver`, self-tests, blind-spot proofs, and the shape-tolerant records non-regression guard are byte-identical — confirmed by re-running them (47/47 pass, up from 41/41).
- `npx tsc --noEmit -p tsconfig.json` is clean; `npx vitest run` reports 980/980 passing (up from the pre-plan 973/974 baseline in this worktree), with the same 5 pre-existing data-dependent test-file failures logged in `deferred-items.md` (plan 20-01's entry) and none new. `git diff --stat HEAD~2 HEAD -- src/` lists only the two expected files: `src/dashboard/views/records.ts` (+94/-31) and `src/dashboard/row-semantics.test.ts` (+70/-1).

## Task Commits

Each task was committed atomically:

1. **Task 1: One cell-link factory, applied to the five PR-table cells and the two progression-table cells** - `d433bcd` (feat)
2. **Task 2: Pin D-13's invariants in the source-structure guard** - `630bd6e` (test)

## Files Created/Modified

- `src/dashboard/views/records.ts` - Added `buildCellLink` factory; `buildPrTable` and `buildProgressionTable` each hoist a per-row `curatedLabel` and wrap their non-Date cells in cell links; `flagsAnchor` conditionally appended; both docblocks rewritten.
- `src/dashboard/row-semantics.test.ts` - New `D-13` describe block (6 assertions); corrected `activityDetailHref(` per-file count for `records.ts` (2 → 3). Test count: 41 → 47.

## Decisions Made

- D-13 implemented exactly as locked in `20-CONTEXT.md`: all five PR-table non-Date cells and both progression-table non-Date cells get a real anchor sharing the Date cell's curated label, `tabIndex = -1`, built by one factory. No narrowing, no widening, no re-opening of D-12's superseded activity-name-join blocker.

## Deviations from Plan

**1. [Rule 1 - Bug in the plan's own verify script] Task 1's ad-hoc `.tabIndex =` count and Task 2's action item 2 both assumed `records.ts` starts from zero `.tabIndex` writes.**
- **Found during:** Task 1's verify script (`npx vitest run` after the `records.ts` change reported the actual regex match count).
- **Issue:** `records.ts` already carries five pre-existing, deliberate `heading`/`h1` `.tabIndex = -1` focus-management writes (`row-semantics.test.ts`'s own `rowSemanticViolations` comment names them: `records.ts:248/465/602/679/797`, now at shifted line numbers after this plan's edits). A literal whole-file `/\.tabIndex\s*=/g` count in the comment-stripped file is 6 (5 headings + the new `cellAnchor`), not 1 as both the plan's Task 1 verify one-liner and Task 2's action item 2 ("`.tabIndex =` occurs exactly once in the whole file") state. Both assumptions are provably wrong against the file as it existed before this plan touched it — this is a planning-time miscount, not a regression this plan introduced.
- **Fix:** Confirmed via the authoritative, already-correct guard (`rowSemanticViolations` in `row-semantics.test.ts`, plan 20-15's receiver-keyed allowlist covering exactly `heading`/`h1`/`cellAnchor` with value `-1`) that the real invariant — no *new*, unallowlisted `tabindex`/`role` write exists anywhere in the four scanned files — holds. Task 2's new D-13 block scopes its tabIndex assertion to the `cellAnchor` receiver specifically (`cellAnchor\.tabIndex\s*=\s*-1` occurs exactly once), which is the invariant D-13 point 3 actually depends on (a second `cellAnchor` write would mean a second focusable cell per row) without flagging the unrelated, correct, pre-existing heading writes.
- **Files modified:** `src/dashboard/row-semantics.test.ts` (assertion wording only; the underlying `rowSemanticViolations` function, its allowlist, and all of plan 20-15's own tests are untouched).
- **Commit:** `630bd6e`

**2. [Rule 1 - Bug] Pre-existing `activityDetailHref(` per-file count assertion broke as a direct, predictable consequence of Task 1.**
- **Found during:** Task 1's full-suite verify run — 1 failing assertion (`UX-01 / D-03` block, `records.ts` expected 2, actual 3), none of the other 973 non-deferred tests affected.
- **Issue:** The `UX-01 / D-03` describe block (predates plan 20-15, untouched by it) asserted `activityDetailHref(` occurs exactly 2 times in `records.ts`. Adding `buildCellLink`'s own single `activityDetailHref(activityId)` construction (reused by all seven call sites) makes the true count 3, matching D-13's own arithmetic exactly and matching what Task 2's own new assertion (item 4) independently expects.
- **Fix:** Updated the existing assertion from 2 to 3 in Task 2's commit (the same commit that adds the new D-13 block asserting the identical count), with a comment cross-referencing the new block.
- **Files modified:** `src/dashboard/row-semantics.test.ts`.
- **Commit:** `630bd6e`

No other deviations — both tasks' remaining acceptance criteria were met without further auto-fixes.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. All six threats named in this plan's own `<threat_model>` (T-20G4-P17-01 through -06) map to files this plan already declared (`records.ts`, `row-semantics.test.ts`) and are mitigated exactly as the plan specified — no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced.

## Issues Encountered

The two deviations above (both plan-verify-script miscounts, not code defects) — see Deviations section for full detail and resolution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

D-13 is implemented exactly as locked, on both Records tables, with the invariant pinned in source rather than left to a reviewer's memory. `requirements-completed` is left empty in this plan's frontmatter, matching the established pattern (19-15/19-16/20-16 precedent): `REQUIREMENTS.md`'s own UX-01/UX-03 entries state they remain open, blocked on R18/R19 (D-12 modifier-click/window-open) needing rendered-browser re-verification, which this code-only plan does not itself perform. This plan lands the fix R18/R19 need; plan 20-18's Round 4 checkpoint is the next opportunity to re-exercise those two rows in a real browser and, if they now pass, flip UX-01/UX-03 to complete. The `known_open_question` this plan's `buildCellLink` JSDoc records — what a screen reader announces for a cell whose anchor's explicit `aria-label` differs from the cell's own visible text, in table-browse mode — is not decidable in this repository (no DOM, no accessibility tooling) and is explicitly named as an observation for plan 20-18's checkpoint, not resolved here.

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `src/dashboard/views/records.ts`
- FOUND: `src/dashboard/row-semantics.test.ts`
- FOUND: `.planning/phases/20-row-click-interaction-pattern/20-17-SUMMARY.md`
- FOUND commit: `d433bcd` (Task 1)
- FOUND commit: `630bd6e` (Task 2)
