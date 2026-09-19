---
phase: 28-pr-plausibility-ceiling
plan: 04
subsystem: ui
tags: [typescript, vitest, dashboard-rendering, accessibility, css, best-effort-panel, records-screen]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    plan: "02"
    provides: "BestEffortPanelRow.demoted/demotionReason, prFlagBadgeSpecs(row, exclusionReason), countDemotedAtDistance, resolvePrTableEmptyState, resolvePrTableDemotionNote"
provides:
  - "buildPrFlagsCell rewritten to render prFlagBadgeSpecs's specs through appendAccessibleBadge, one badge per spec, deciding nothing itself"
  - "Records screen's per-distance empty state and short-table demotion note, both sourced from records-logic.ts's pure functions"
  - ".badge--demoted CSS modifier, visually distinct from .badge--severe"
  - "Two new source-wiring guards (detail-sections.test.ts's buildPrFlagsCell wiring block, new records.test.ts) both demonstrated red then green"
affects: [28-05-three-pass-restructure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A DOM builder decides nothing: buildPrFlagsCell's entire body is a for-of over a pure spec list, mirroring list.ts's appendQualityBadges precedent"
    - "Source-wiring guards isolate one function's body from a comment-stripped source read (via a shared isolateFunctionBody-shaped helper) so a node-only test suite can still pin DOM-builder wiring without a DOM library"

key-files:
  created:
    - src/dashboard/views/records.test.ts
  modified:
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - src/dashboard/curation-seam.test.ts
    - src/dashboard/views/records.ts
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "D-09 respected literally: buildPrFlagsCell was FIXED, not extended — its final body contains zero if statements and zero badge-text literals, asserted by the guard itself against a comment-stripped source"
  - "The Records-screen sub-table note reuses the existing .text-label class (the same class the pre-existing 1k footnote already uses immediately below the table) rather than inventing a new caption class, per the plan's own instruction to reuse rather than invent"
  - ".badge--demoted reuses the existing --accent-strong custom property (already the active-state fill token elsewhere in the stylesheet) rather than a new hex value or custom property, keeping the modifier theme-aware for free"
  - "curation-seam.test.ts's D-06 assertion ('Excluded — ' badge string) was updated to check detail-best-efforts-logic.ts instead of detail-sections.ts, since this plan intentionally relocated that string into prFlagBadgeSpecs (28-02) — the test's OWN stated intent (the string 'stays reachable, made reachable by this phase, not rebuilt') is preserved, only its file changed"

patterns-established:
  - "isolateFunctionBody(source, declarationNeedle): finds a function's declaration and slices to the next function boundary (top-level or nested) in a comment-stripped source string — the shared primitive both this plan's new guards use"

requirements-completed: [PR-03]

# Metrics
duration: ~20min
completed: 2026-09-11
---

# Phase 28 Plan 04: Detail-View and Records-Screen Demotion Rendering Summary

**buildPrFlagsCell rebuilt as a pure spec-renderer over prFlagBadgeSpecs (zero `if`, zero badge-text literals), the Records screen's empty/short-table copy moved onto records-logic.ts's pure functions, and a new `.badge--demoted` CSS modifier — with two source-wiring guards each demonstrated red before being trusted green.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-10T23:44:00+02:00 (approx.)
- **Completed:** 2026-09-11T00:00:52+02:00
- **Tasks:** 3
- **Files modified:** 7 (6 in-scope, 1 auxiliary fix to an out-of-scope test file)

## Accomplishments

- `buildPrFlagsCell` (`detail-sections.ts`) now renders whatever `prFlagBadgeSpecs` (plan 28-02) returns via a single `for (const spec of ...)` loop, one `appendAccessibleBadge` call per spec, with a description id built from both `row.distance` and `spec.descriptionIdSuffix` — closing the Phase 24 Round 2 R15 hazard (`PRExcluded — {reason}` run-on claim) by construction rather than by convention.
- A new `buildPrFlagsCell wiring (source guard)` describe block in `detail-sections.test.ts` isolates the function's body from a comment-stripped source read and asserts: exactly one `prFlagBadgeSpecs(` call, exactly one `appendAccessibleBadge(` call and zero `appendBadge(` calls, zero occurrences of the four literal badge-text substrings, zero `if (` statements, and the two-part description id. Demonstrated red by temporarily reintroducing a bare `appendBadge(cell, 'PR')` line (two assertions fired: the `appendBadge(` count and the `PR'` literal-string check), then confirmed green after reverting.
- Records screen: `buildPrTableEmptyState` gained a fourth `demotedCount` parameter and now sources both its heading and body from `resolvePrTableEmptyState` (plan 28-02); `buildPrTableSection` appends a `p.text-label` short-table note from `resolvePrTableDemotionNote` when a non-empty table had efforts demoted; the render loop computes `demotedCount` via `countDemotedAtDistance(bestEfforts.activities, distance)` once per distance.
- New `records.test.ts` source-wiring guard (mirrors `detail-sections.test.ts`'s idiom, using a shared `isolateFunctionBody` helper that also handles the nested `renderTables` closure) asserts single call-sites for all three functions, zero `innerHTML` in the whole file, zero occurrences of the old inline copy literal, and the four-argument call shape. Demonstrated red by temporarily restoring the old inline body ternary (the "zero occurrences of `The archive has no`" assertion fired, expected 0 got 2), then confirmed green after reverting.
- `.badge--demoted` added to `styles.css` immediately after `.badge--severe`, reusing the existing `--accent-strong` custom property — visually distinct from both the plain `.badge` and the severity-tier `.badge--severe` without introducing any new hex value or custom property. `npm run build-widgets` confirmed to emit zero `css-syntax-error` warnings (the Phase 19 GAP 1 signature) against the added comment.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make buildPrFlagsCell spec-driven, and guard it with source-text assertions** - `733d49d3` (feat)
2. **Task 2: Records screen states why a table is empty or short** - `ba3da7f6` (feat)
3. **Task 3: A distinct demoted badge style, without reopening the Phase 19 stylesheet hazard** - `1fd8225f` (feat)

_No separate plan-metadata commit — SUMMARY.md is committed by the orchestrator's worktree merge flow (STATE.md/ROADMAP.md excluded per worktree isolation)._

## Files Created/Modified

- `src/dashboard/views/detail-sections.ts` - `buildPrFlagsCell` rewritten onto `prFlagBadgeSpecs` + `appendAccessibleBadge`; dropped the now-unused `appendBadge`/`appendLowConfidenceBadge` imports (no other function in the file used them)
- `src/dashboard/views/detail-sections.test.ts` - new `buildPrFlagsCell wiring (source guard)` describe block (5 assertions)
- `src/dashboard/curation-seam.test.ts` - (deviation) D-06's `'Excluded — '` assertion re-pointed at `detail-best-efforts-logic.ts`, its new home
- `src/dashboard/views/records.ts` - `buildPrTableEmptyState` (4th param, sourced from `resolvePrTableEmptyState`), `buildPrTableSection` (demotion note via `resolvePrTableDemotionNote`), render loop (`countDemotedAtDistance` call)
- `src/dashboard/views/records.test.ts` - new source-wiring guard file (5 cases, plus imported `stripComments` self-tests)
- `src/dashboard/styles.css` - `.badge--demoted` modifier
- `src/dashboard/styles.test.ts` - new describe block pinning `.badge--demoted`'s existence and its distinctness from `.badge--severe`

## Decisions Made

- Followed the plan's interfaces block verbatim for every consumed function signature (`prFlagBadgeSpecs`, `countDemotedAtDistance`, `resolvePrTableEmptyState`, `resolvePrTableDemotionNote`).
- Reused `.text-label` for the Records short-table demotion note (the same class the pre-existing 1k footnote already uses directly below the table) rather than inventing a `.text-caption` class the plan mentioned only as "the caption class this file already uses for sub-table notes" — `records.ts` had no distinct `.text-caption` class, and `.text-label` is the file's actual existing sub-table-note precedent.
- `.badge--demoted` reuses `--accent-strong` (already the active-state fill token elsewhere in the stylesheet) rather than `--destructive` (which `.badge--severe` already owns) or a new token, satisfying "visually distinguishable from both `.badge` and `.badge--severe`" with zero new custom properties.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `curation-seam.test.ts`'s D-06 assertion pinned the relocated `'Excluded — '` string to the wrong file**
- **Found during:** Task 1 (`npm test` after rewriting `buildPrFlagsCell`)
- **Issue:** `curation-seam.test.ts` asserted `detailSectionsStripped` (i.e. `detail-sections.ts`) still contains the literal `'Excluded — '` — true before this plan, but D-09 explicitly requires that literal to move into `prFlagBadgeSpecs` (`detail-best-efforts-logic.ts`, landed by plan 28-02) so it becomes assertable in this repo's node-only vitest. The test's own name states its intent ("made reachable by this phase, not rebuilt") — only its target file was stale.
- **Fix:** Re-pointed the assertion at `detailBestEffortsLogicStripped` (a variable the test file already computed for other cases), keeping the same string check.
- **Files modified:** `src/dashboard/curation-seam.test.ts`
- **Verification:** `npx vitest run src/dashboard/curation-seam.test.ts` — 84/84 green.
- **Committed in:** `733d49d3` (Task 1 commit)

**2. [Rule 3 - Blocking] `data/stats/*.json` did not exist in this fresh worktree**
- **Found during:** Task 2 (`records-logic.test.ts` reads several stats files directly via `fs`)
- **Issue:** Same gitignored/not-generated gap plan 28-02 documented in its own summary; a fresh worktree carries no `data/stats/` directory.
- **Fix:** Ran `npm run build && npm run compute-all-stats` (no network calls, all local-file-based) to generate the files the plan's own named verification commands require. This regenerated `data/geo/geo-metadata.json`'s `generatedAt` timestamp as a side effect; reverted with `git checkout -- data/geo/geo-metadata.json` before any commit, since that file is unrelated to this plan.
- **Files modified:** none tracked (generated files are gitignored)
- **Verification:** `records-logic.test.ts` and `records.test.ts` both green afterward.
- **Committed in:** n/a (no tracked files changed)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test-target fix, 1 Rule 3 blocking environment-setup fix, mirroring plan 28-02's own precedent exactly)
**Impact on plan:** No scope creep — the D-06 fix is the minimal correct response to this plan's own intentional string relocation, and the stats-generation step reproduces plan 28-02's already-documented workaround for a shared, non-plan-specific environment gap.

## Issues Encountered

- Two pre-existing, out-of-scope `npm test` failures were confirmed present and unrelated to this plan's changes: `src/dashboard/views/trends-zoom-logic.test.ts` requires `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js`, absent from this worktree's `node_modules` install (a gitignored install artifact); `scripts/verify-dashboard-publish-stats.test.mjs` required a built `dist/widgets/data/stats/best-efforts.json`, which Task 3's `npm run build-widgets` run happened to produce, resolving it as a side effect (not a fix this plan is responsible for maintaining).

## Known Stubs

None — every new call site is wired to its stated pure-function source; no hardcoded empty/placeholder values were introduced.

## Threat Flags

None — every threat named in this plan's `<threat_model>` (T-28-04-A tampering via rendered reason strings, T-28-04-B DoS via a stale shard missing `demotion`, T-28-04-C aria-id collision, T-28-04-D a write surface, T-28-04-SC package installs) is exactly the surface this plan's own code touches. No `button`, `input`, or event listener was introduced by any of the three tasks — every new element added by this plan is text, consistent with D-11.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `buildPrFlagsCell` and the Records screen's empty/short-table copy are now both spec-driven and guarded; plan 28-05's three-pass restructure can populate real `demotion` values (currently `null`/`0` per plan 28-02) without touching any rendering code in this plan's scope.
- Two source-wiring guards exist over render paths that had zero coverage before this plan, both demonstrated failing against a real reintroduced defect before being trusted to pass.

---
*Phase: 28-pr-plausibility-ceiling*
*Completed: 2026-09-11*

## Self-Check: PASSED

- FOUND: src/dashboard/views/records.test.ts
- FOUND: .planning/phases/28-pr-plausibility-ceiling/28-04-SUMMARY.md
- FOUND: 733d49d3 (Task 1 commit)
- FOUND: ba3da7f6 (Task 2 commit)
- FOUND: 1fd8225f (Task 3 commit)
