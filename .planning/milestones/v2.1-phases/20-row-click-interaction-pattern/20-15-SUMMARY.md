---
phase: 20-row-click-interaction-pattern
plan: 15
subsystem: testing
tags: [vitest, source-guard, accessibility, d-01, d-13, d-15, wr-01, gap-closure]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "20-10's spelling-agnostic rowSemanticViolations D-01 guard and 20-11's Round 3 checkpoint findings, which 20-REVIEW.md's WR-01 executed proof built on"
provides:
  - "isAllowedRoleWrite(receiver, value) - a receiver-keyed role rule replacing the value-keyed isAllowedRoleValue, closing WR-01"
  - "widened role value patterns (backtick + bare-identifier alternation) on both role call-site scans"
  - "isAllowedTabIndexReceiver widened to admit the named pair cellAnchor/-1, pre-authorising D-13's cell-link factory"
  - "records.ts non-regression guard rewritten to tolerate flagsAnchor as well as flagsTd, with all four Date-cell exclusions kept exact-zero plus a fifth guarding dateAnchor under either badge spelling"
affects: [20-17]

# Tech tracking
tech-stack:
  added: []
  patterns: ["receiver-keyed allowlist (not value-keyed) for source-text accessibility guards - see D-01/WR-01"]

key-files:
  created: []
  modified: ["src/dashboard/row-semantics.test.ts"]

key-decisions:
  - "D-15 (WR-01 half): inverted the role rule from value-keyed (value !== 'link') to receiver-keyed (receiver === 'loading' && value === 'status'), because the harm D-01 guards against is any role on a <tr>, not specifically role=\"link\""
  - "D-13 pre-authorisation: widened isAllowedTabIndexReceiver to the exact named pair cellAnchor/-1 (not a wildcard anchor match), and the records guard to accept flagsAnchor as an alternate Flags-cell badge receiver, so plan 20-17 can land D-13's anchors without a guard fighting it"

patterns-established:
  - "Blind-spot proof it, plan 20-10's shape: a local replica of the OLD (defective) rule asserted to still report zero, paired with an assertion that the current guard reports one for the identical input - documents the defect existed without letting it silently regress"

requirements-completed: [UX-01, UX-03]

# Metrics
duration: ~20min
completed: 2026-08-17
---

# Phase 20 Plan 15: Close WR-01 (role allowlist) and pre-authorise D-13's guard shapes Summary

**Inverted the D-01 guard's role rule from value-keyed to receiver-keyed (closing WR-01's five proven misses) and narrowly pre-authorised the two source shapes D-13 will introduce in `records.ts`, so plan 20-17 can land without a guard fighting it.**

## Performance

- **Duration:** ~20min
- **Completed:** 2026-08-17
- **Tasks:** 2/2 completed
- **Files modified:** 1

## Accomplishments

- Closed WR-01: `isAllowedRoleValue` (keyed on the value not being `link`) replaced with `isAllowedRoleWrite(receiver, value)` (keyed on the receiver being `loading` with value `status`). All five of `20-REVIEW.md`'s executed misses (`role="presentation"`, `role="button"`, `tr.role = 'row'`, a backtick-quoted value, an identifier-valued write) are now caught; the two `link` controls and the one legitimate `loading`/`status` write still pass correctly.
- Widened both role value patterns (property-assignment and `setAttribute`) to accept backtick-quoted values and bare-identifier values via a regex alternation, so a non-literal role value is reported as a violation rather than silently skipped.
- Widened `isAllowedTabIndexReceiver` to admit the exact named pair `cellAnchor`/`-1`, pre-authorising D-13's single `cellAnchor.tabIndex = -1;` write that plan 20-17 will add to `records.ts`'s shared cell-link factory. Confirmed narrow: `row.tabIndex = -1` and a differently-named `anchor.tabIndex = -1` still violate.
- Rewrote the `records.ts` non-regression guard to accept either `flagsTd` or `flagsAnchor` as the Flags-cell badge receiver (D-13's second shape), while keeping all four Date-cell exclusions (`dateTd`/`dateAnchor`) at exact-zero and adding a fifth assertion that no badge-append call under either spelling ever targets `dateAnchor`.
- `src/dashboard/views/records.ts` was not touched — plan 20-17 owns it, confirmed by `git status --porcelain` staying empty for that file throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the role rule receiver-keyed and widen its value patterns, with executed proof** - `8c7e274` (test)
2. **Task 2: Pre-authorise D-13's two source shapes, narrowly and by name** - `f43abac` (test)

_Both tasks are TDD-adjacent test-file-only changes; each commit includes its own new self-tests plus the underlying implementation change, matching the plan's task boundaries rather than a separate RED/GREEN split (no `tdd="true"` frontmatter on these tasks)._

## Files Created/Modified

- `src/dashboard/row-semantics.test.ts` - `isAllowedRoleWrite` (receiver-keyed role rule), widened role value patterns, `cellAnchor`/`-1` added to the tabIndex allowlist, records non-regression guard made shape-tolerant for `flagsAnchor`, 11 new self-tests plus 2 blind-spot proof tests (WR-01, in addition to the pre-existing WR-02 one). Test count: 33 → 41.

## Decisions Made

- D-15 (WR-01 half, locked 2026-08-17 in `20-CONTEXT.md`): inverted the role allowlist to receiver-keyed rather than patching individual disallowed values, matching the shape the `tabindex` rule already used and closing the entire class of misses in one change rather than enumerating forbidden role strings.
- D-13 pre-authorisation scope: admitted exactly the two named receivers (`cellAnchor`, `flagsAnchor`) the plan's `d13_shapes_this_plan_pre_authorises` block specifies — no wildcard, suffix, or "any identifier ending in Anchor" pattern, verified by the plan's own automated check against a literal `\w+Anchor`-shaped regex appearing in the source.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met without needing Rule 1-4 auto-fixes.

## Issues Encountered

One self-inflicted false start during Task 1: the initial WR-01 blind-spot proof comment referenced the removed function's old name (`isAllowedRoleValue`) in prose, which collided with the task's own verify script assertion that the string must not appear anywhere in the file (the script does a literal substring/regex scan of the whole file, not just live code). Fixed by rewording the comment to describe the old predicate's logic without naming it, then re-ran the verify script to confirm. No test or type-check regression at any point; this was caught before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 20-17 (D-13: real anchors on all six Records PR-table cells) is unblocked to land its `cellAnchor.tabIndex = -1` and `flagsAnchor` badge-move shapes without this file's guards going red. `20-15`'s own scope was test-file-only by design (`files_modified: src/dashboard/row-semantics.test.ts`), so no `requirements.mark-complete` risk from touching product code. UX-01 and UX-03 requirement IDs are named in this plan's frontmatter; per this repository's established pattern (see `19-15`/`19-16`'s summaries), whether they should be ticked complete in `REQUIREMENTS.md` is left to the phase's own gating process rather than asserted here, since this plan's guard-hardening work is downstream of, not a first proof of, either requirement.

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.planning/phases/20-row-click-interaction-pattern/20-15-SUMMARY.md`
- FOUND: `src/dashboard/row-semantics.test.ts`
- FOUND commit: `8c7e274` (Task 1)
- FOUND commit: `f43abac` (Task 2)
