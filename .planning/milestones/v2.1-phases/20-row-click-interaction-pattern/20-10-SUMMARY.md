---
phase: 20-row-click-interaction-pattern
plan: 10
subsystem: testing
tags: [test-guard, false-green, gap-closure, css, source-guard]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "20-VERIFICATION.md and 20-REVIEW.md's two WARNING-severity guard-layer defects (D-01's case-blind tabindex/role scan, the four cascade-unaware CSS assertions), both diagnosed with executed-mutation proof"
provides:
  - "A spelling-agnostic D-01 source guard (rowSemanticViolations) covering list.ts, records.ts, overview.ts and row-navigation.ts across all four tabindex/role write spellings this codebase uses"
  - "Two new last-wins CSS helpers (bodiesForSelectorListToken, cascadeWinningBodyDeclaring) and the four Phase 20 stylesheet assertions migrated onto them"
  - "In-suite self-tests proving both defects' false-green mechanisms rather than asserting them in prose"
affects: [row-semantics.test.ts, styles.test.ts, future-D-01-widening, future-cascade-sensitive-CSS-assertions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spelling-agnostic case-insensitive regex scan with a narrow, comment-justified allowlist, replacing a literal-substring count guard"
    - "cascade-winner CSS assertion helper (last body that actually declares the property under test) as the correct tool for a selector declared more than once at the top level, distinct from last-rule-wins"

key-files:
  created: []
  modified:
    - src/dashboard/row-semantics.test.ts
    - src/dashboard/styles.test.ts

key-decisions:
  - "Kept declarationsFor first-wins rather than converting it to last-wins — converting would change the reading of roughly 40 pre-existing Phase 16-19 assertions in a plan with no rendered verification; documented the limitation in its JSDoc instead and pointed callers at bodyForSelectorListToken / cascadeWinningBodyDeclaring"
  - "Added cascadeWinningBodyDeclaring (not just bodyForSelectorListToken) specifically for '.activity-row' because it is declared twice at the top level and the property under test (display) is only on the earlier of the two bodies — bodyForSelectorListToken alone would have resolved to the wrong (later) body and failed"
  - "rowSemanticViolations kept at module scope, not exported, per the plan's IN-04 note that this file already has one unnecessary stray export"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-13
---

# Phase 20 Plan 10: Close D-01 and CSS Cascade Guard-Layer Defects Summary

**Replaced two guard-layer defects that could not fail — a case-blind D-01 tabindex/role scan and four first-rule-wins CSS assertions — with spelling-agnostic and cascade-correct versions, each carrying an in-suite self-test that proves the old form's blind spot rather than describing it in a comment; zero source files touched (`row-semantics.test.ts` 22->33 tests, `styles.test.ts` 68->74 tests).**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 of 2 complete
- **Files modified:** 2 (`src/dashboard/row-semantics.test.ts`, `src/dashboard/styles.test.ts`)

## Accomplishments

- **Task 1 — D-01 guard made spelling-agnostic.** Added `rowSemanticViolations(source)` at module scope: scans a comment-stripped source for four spellings of a `tabindex`/`role` write (camelCase property assignment, `setAttribute` in either quote style, for both `tabindex` and `role`), all case-insensitive, each assignment form anchored `=(?!=)` so a `===` comparison can never false-positive. Allowlist is two narrow rules, each naming its real call sites in a comment: a `tabindex` hit is allowed only when the receiver is `heading` or `h1` and the value is `-1` (the six enumerated programmatic focus targets across `list.ts`, `records.ts`, `overview.ts`); a `role` hit is allowed only when its value is not `link`. Replaced the D-01 describe block's two vacuous literal-count assertions with a single `rowSemanticViolations(...)` check across all four files (`overview.ts` newly covered), added eleven self-test cases, and one final test asserting the exact WR-02 blind-spot proof: `countOccurrences("tr.tabIndex = 0;", 'tabindex')` stays `0` (documenting the old guard's miss) next to `rowSemanticViolations("tr.tabIndex = 0;")` having length `1` (documenting its closure).
- **Task 2 — Four Phase 20 CSS assertions moved onto the cascade winner.** Gave `declarationsFor` an optional `source` parameter (documented as FIRST-rule-wins and unsuitable for a possibly-duplicated selector, left unconverted for the ~40 assertions that depend on its exact semantics). Added `bodiesForSelectorListToken` (every non-at-rule-scoped body for a selector, in source order) and `cascadeWinningBodyDeclaring` (the last body that actually declares a given property — the correct tool for `.activity-row`, which is declared twice at the top level with `display: flex` on the earlier rule and only `text-decoration: none` on the later one). Migrated `'.activity-row keeps display: flex'` onto `cascadeWinningBodyDeclaring` and the other three Phase 20 assertions (`.activity-row:hover`, `.activity-table__row--navigable`, `.activity-table__row--navigable:hover`) onto `bodyForSelectorListToken`. Added six self-tests against synthetic CSS proving the first-wins false green for both the `display` case and the `.activity-row`-shaped two-rule case where the later rule does not redeclare the property under test, plus the throw-on-absence behavior for both new helpers. Extended the helper audit comment with a paragraph naming this migration and why `declarationsFor` was documented rather than converted.
- Both scoped test suites verified green in isolation (`row-semantics.test.ts` and `styles.test.ts`), per the plan's explicit instruction not to run the full suite or `row-navigation.test.ts` — plan 20-09 runs in the same wave and deliberately leaves that file RED between its own Task 2 and Task 3.

## Task Commits

1. **Task 1: D-01 guard spelling-agnostic + blind-spot proof** — `2229fe9` (test) — `src/dashboard/row-semantics.test.ts`
2. **Task 2: Four Phase 20 CSS assertions onto the cascade winner** — `e68a2bd` (test) — `src/dashboard/styles.test.ts`

## Files Created/Modified

- `src/dashboard/row-semantics.test.ts` — added `rowSemanticViolations` helper (module scope, not exported), replaced D-01's two literal-count `it`s with one `rowSemanticViolations`-based assertion across four files, added an eleven-case `rowSemanticViolations - self-tests` describe block plus the WR-02 blind-spot proof, extended the file header comment with the allowlist and the widening rule. 22 -> 33 tests.
- `src/dashboard/styles.test.ts` — gave `declarationsFor` an optional `source` parameter and FIRST-rule-wins JSDoc, added `bodiesForSelectorListToken` and `cascadeWinningBodyDeclaring` immediately after `bodyForSelectorListToken`, migrated the four Phase 20 assertions, added a six-case self-test describe block, extended the helper audit comment block. 68 -> 74 tests.

## Decisions Made

- **`declarationsFor` stays first-wins, documented rather than converted.** Converting it to last-wins would change the reading of roughly 40 pre-existing Phase 16-19 assertions in a gap-closure plan that has no rendered verification to catch a regression any of them might introduce. Its JSDoc now states the limitation and points at the two last-wins helpers.
- **`cascadeWinningBodyDeclaring` added alongside `bodiesForSelectorListToken` rather than relying on `bodyForSelectorListToken` alone**, because `.activity-row`'s real shape (declared twice, only the earlier rule declaring `display`) means "last body" and "cascade winner for `display`" are different bodies — `bodyForSelectorListToken('.activity-row')` would resolve to the later, `text-decoration`-only body and fail the `display: flex` assertion.
- **`rowSemanticViolations` not exported.** The plan's own IN-04 finding already flags one unnecessary stray export in this file; the new helper stays module-scope-only per the plan's explicit instruction not to add a second.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' automated verification scripts (from each task's `<verify>` block) were run and passed, `npx tsc --noEmit -p tsconfig.json` exited 0 both times, and `git status --porcelain src/dashboard/views src/dashboard/styles.css src/dashboard/row-navigation.ts` was confirmed empty after each task — no source file was touched to make either guard pass.

## Issues Encountered

None.

## Known Stubs

None — this plan's entire diff is inside two test files; no UI, component or data-source code was touched.

## Threat Flags

None — both changes are text-guard-over-source-on-disk (`readFileSync`, no network, no execution of the read text), matching the threat model's stated trust boundary and disposition.

## Next Steps

Plan 20-09 (same wave) still leaves `row-navigation.test.ts` RED between its own Task 2 and Task 3, deliberately, per this plan's constraints. Plan 20-11's Task 1 is the combined green-gate check across all of wave 8-9's work, not performed here.

## Self-Check: PASSED

- FOUND: `src/dashboard/row-semantics.test.ts`
- FOUND: `src/dashboard/styles.test.ts`
- FOUND: `.planning/phases/20-row-click-interaction-pattern/20-10-SUMMARY.md`
- FOUND: commit `2229fe9` (Task 1)
- FOUND: commit `e68a2bd` (Task 2)
- FOUND: commit `4b09b3c` (SUMMARY)

---
*Phase: 20-row-click-interaction-pattern*
*Plan: 10*
*Completed: 2026-08-13*
