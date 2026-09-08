---
phase: 20-row-click-interaction-pattern
plan: 14
subsystem: testing
tags: [test-guard, false-green, gap-closure, css, source-guard, at-rule]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "20-REVIEW.md's WR-02 (three Phase 20 CSS assertions still any-rule-wins) and WR-03 (cascadeWinningBodyDeclaring family blind to @media overrides), both diagnosed with executed-mutation proof; plan 20-10's four-of-seven partial WR-03 conversion this plan completes"
provides:
  - "All seven positive Phase 20 CSS assertions read the cascade winner (cascadeWinningBodyDeclaring), closing the any-rule-wins mechanism WR-02 named"
  - "assertNoAtRuleOverride(needle, property, source) — a companion helper that fails when an at-rule-scoped rule redeclares a guarded property, closing the @media blind spot WR-03 named, paired with all seven positive assertions"
  - "computeAtRuleRanges(source), a source-parameterized replacement for the module-level AT_RULE_RANGES constant, fixing a latent defect that made the at-rule range check inert for any synthetic source string"
  - "Two executed blind-spot proofs (WR-02, WR-03) against synthetic CSS strings, neither editing styles.css"
affects: [styles.test.ts, future-cascade-sensitive-CSS-assertions, future-at-rule-scoped-CSS-guards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "At-rule companion assertion pattern: a cascade-winner assertion (`cascadeWinningBodyDeclaring`/`bodyForSelectorListToken`) paired with `assertNoAtRuleOverride` for the same selector/property, so a top-level guard and its at-rule blind spot are closed by two calls in the same `it` rather than one call claiming both"
    - "Source-parameterized offset ranges: replacing a module-level constant computed once from the default source with a per-source memoized computation, so a helper that already accepts an optional `source` for self-tests behaves consistently for every value of that parameter, not just the default"

key-files:
  created: []
  modified:
    - src/dashboard/styles.test.ts

key-decisions:
  - "Declined the review's suggested rename to topLevelCascadeWinningBodyDeclaring (and equivalents for the two sibling helpers) — recorded the top-level-only exclusion in each helper's JSDoc instead, to avoid churning ~40 pre-existing Phase 16-19 call sites for a naming-only change"
  - "Fixed AT_RULE_RANGES/isAtRuleScoped's module-scoped-constant bug as an in-scope Rule 1 auto-fix, not deferred: writing the WR-03 blind-spot proof required a synthetic source containing an @media block, which exposed that the at-rule offset range was always computed from the real stylesheet regardless of which `source` a caller passed — silently making the check inert for every synthetic at-rule proof. Replaced with `computeAtRuleRanges(source)`, memoized per source string, threaded through every call site (`isAtRuleScoped`, `assertNotAtRuleScoped`, and the two callers of each)"
  - "The WR-03 proof's synthetic @media blocks each carry a leading `.placeholder` rule before the target selector — a single-rule @media block would have its sole rule swallowed into RULE_SCANNER's captured prelude-pseudo-rule body instead of producing a real head+body match, making the override unreachable by selector-token lookup regardless of the at-rule-range fix; this mirrors the real stylesheet's 720px block, which also holds more than one rule"
  - "Left the three negative selectorListDeclares assertions unconverted, per the plan's explicit scope boundary (D-15 does not name them, IN-10's vacuity-on-deletion stays open) — did not invent a fourth negative assertion to satisfy any count"

requirements-completed: [UX-03]

# Metrics
duration: ~50min
completed: 2026-08-17
---

# Phase 20 Plan 14: WR-02/WR-03 Gap-Closure Round 4 Summary

**Closed the two false-green mechanisms this phase's own guard layer introduced — three Phase 20 CSS assertions still any-rule-wins (WR-02) and the cascade-winner helper family's structural blindness to `@media` overrides (WR-03) — each with an executed proof against synthetic CSS, plus a latent source-parameter bug in the at-rule range check that the WR-03 proof itself surfaced and required fixing to pass.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 of 2 complete
- **Files modified:** 1 (`src/dashboard/styles.test.ts`, 68 -> 76 tests)

## Accomplishments

- **Task 1 — WR-02 closed.** Converted the two bare-`a` assertions (`color: inherit`, `text-decoration: underline`) and `.activity-row declares text-decoration: none` from `selectorListDeclares` (any-rule-wins) to `cascadeWinningBodyDeclaring` (cascade winner). Left the three negative `selectorListDeclares` assertions (the `a` accent-color negative, and D-10's two `.activity-table tbody tr[:hover]` negatives) untouched — out of scope per the plan. Added a `WR-02` blind-spot proof `it`: reproduces `selectorListDeclares`'s any-rule-wins scan inline against a synthetic two-rule `.activity-row` string (no `source` parameter exists on the real helper), shows it reports the stale first declaration as present, then shows `cascadeWinningBodyDeclaring` resolving to the actual override.
- **Task 2 — WR-03 closed, plus a bug the proof surfaced.** Added `assertNoAtRuleOverride(needle, property, source)`, reusing `RULE_SCANNER`, `splitTopLevelSelectors` and `isAtRuleScoped` rather than re-deriving the rule-scanning logic, and paired it with all seven positive Phase 20 assertions (`a`/color, `a`/text-decoration, `.activity-row`/display, `.activity-row`/text-decoration, `.activity-row:hover`/background, `.activity-table__row--navigable`/cursor, `.activity-table__row--navigable:hover`/background). Stated the top-level-only exclusion in the JSDoc of `cascadeWinningBodyDeclaring`, `bodyForSelectorListToken` and `bodiesForSelectorListToken`, and recorded the declined rename decision in each. While writing the WR-03 blind-spot proof against a synthetic `@media` string, discovered `AT_RULE_RANGES` was a module-level constant computed once from the real stylesheet — so the offset-range half of `isAtRuleScoped` was silently inert for any synthetic `source`, since a small synthetic string's offsets never fall inside a range computed from the much larger real file. Fixed by replacing the constant with `computeAtRuleRanges(source)` (memoized per source) and threading `source` through `isAtRuleScoped`, `assertNotAtRuleScoped`, and every internal caller (`bodyForSelectorListToken`, `bodiesForSelectorListToken`, `assertNoAtRuleOverride`) — a genuine Rule 1 fix, not a plan deviation requiring a new architecture. Also discovered (and worked around, not fixed — it is the shared scanner's documented, load-bearing shape) that a single-rule `@media` block swallows its sole rule into the prelude's captured body instead of producing an independent head+body match; the proof's synthetic blocks carry a leading placeholder rule so the target selector gets its own match, mirroring the real stylesheet's multi-rule 720px block. Added the `WR-03` blind-spot proof covering both of `20-REVIEW.md`'s mutations (`.activity-row`/`display`, `.activity-table__row--navigable`/`cursor`). Rewrote the helper-audit paragraph (`styles.test.ts` "Phase 20 cascade migration") to state the 20-10/20-14 four-of-seven split, the new companion, and IN-10's remaining open vacuity.
- `npx vitest run src/dashboard/styles.test.ts` (76/76) and `npx tsc --noEmit -p tsconfig.json` (zero diagnostics) both pass; `git status --porcelain src/dashboard/styles.css` is empty throughout — no stylesheet mutation. Full `npx vitest run` shows 5 unrelated pre-existing failures in this worktree (missing `data/stats/*.json` fixture files in `trends-*-logic.test.ts` and similar), out of scope for this plan and untouched by this diff.

## Task Commits

1. **Task 1: WR-02 — move the three remaining Phase 20 assertions onto the cascade winner** — `0d4396a` (test) — `src/dashboard/styles.test.ts`
2. **Task 2: WR-03 — at-rule companion assertion, applied to all seven, with an executed proof** — `0749f53` (feat) — `src/dashboard/styles.test.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `AT_RULE_RANGES`/`isAtRuleScoped` ignored the `source` parameter for its offset-range check**
- **Found during:** Task 2, while writing the WR-03 blind-spot proof
- **Issue:** `bodyForSelectorListToken`, `bodiesForSelectorListToken` and the new `assertNoAtRuleOverride` all accept an optional `source` parameter for synthetic self-tests, but `isAtRuleScoped`'s second check compared an offset computed against `source` to ranges in the module-level `AT_RULE_RANGES` constant, which was computed once from the real stylesheet at module load. Against a small synthetic string, that comparison could never legitimately match — the at-rule detection silently degraded to only its `head.trim().startsWith('@')` fast path, which (per the file's own R3-CR-01 finding) only ever fires on the at-rule prelude pseudo-match itself, never on a real nested selector. The WR-03 proof's first attempt (`assertNoAtRuleOverride` expected to throw against a synthetic `@media` override) failed silently green for exactly this reason.
- **Fix:** Replaced the constant with `computeAtRuleRanges(source): Array<[number, number]>`, memoized per distinct source string via a `Map`, and threaded `source` through `isAtRuleScoped`, `assertNotAtRuleScoped`, and both of their internal callers that already had a `source` in scope.
- **Files modified:** `src/dashboard/styles.test.ts`
- **Commit:** `0749f53`

Or: the negative Phase 20 assertions and `declarationsFor`'s first-wins semantics were left unchanged, exactly as the plan's interfaces table specifies.

## Self-Check: PASSED
