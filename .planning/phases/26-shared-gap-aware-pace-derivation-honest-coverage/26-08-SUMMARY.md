---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 08
subsystem: ui
tags: [pace-disagreement, badge, accessibility, dashboard-index, vitest]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "detectPaceDisagreement / streamPaceSecPerKm and the required paceDisagreement: PaceDisagreement | null field on DashboardIndexRow (26-07)"
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "detail-sections.ts's buildSplitsSection/buildBreakdownSection shape and the D-09 gap legend precedent (26-06)"
provides:
  - "appendAccessibleBadge(container, visibleText, explanation, descriptionId) — the single accessible badge+description DOM-building block, extracted from appendLowConfidenceBadge (signature unchanged) and shared by the new pace-disputed badges"
  - "PACE_DISPUTED_BADGE_TEXT, paceDisputedDescriptionId, paceDisputedExplanation, appendPaceDisputedBadge — the row-surface pace-disputed badge, reached via statusBadgeTexts/appendStatusBadges on all four RowSurface values"
  - "detail.ts's Pace stat-card badge, appended as a third child of buildStatCard('...', 'Pace') only when the row is flagged, built from the same appendAccessibleBadge block"
  - "buildSplitsSection's new isRebasedAverage flag (D-13): rebases the vs. Avg baseline to the stream-derived pace for a flagged activity only, and renders the disclosure caption from the same in-scope average"
affects: [26-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared accessible-badge DOM builder: appendLowConfidenceBadge and appendPaceDisputedBadge both delegate to one exported appendAccessibleBadge block instead of duplicating the .badge + .sr-only + aria-describedby DOM construction a third time"
    - "Call-site rebase, not logic-layer rebase: D-13's baseline swap happens where detail.ts decides which average to pass into buildSplitsSection, not inside buildPaceBarCell itself, which keeps diffing against whatever baseline it is handed"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/views/detail.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - src/dashboard/views/list-logic.test.ts
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "Extracted appendAccessibleBadge as a new EXPORTED shared helper (not inlined) so detail.ts's Pace stat-card badge — whose visible text carries the stream-derived figure and so cannot reuse appendPaceDisputedBadge's fixed 'Pace disputed' text — builds from the same DOM-construction block rather than a fourth hand-rolled badge builder, satisfying the plan's explicit 'do not write a fourth badge builder' instruction while leaving appendLowConfidenceBadge's public signature untouched."
  - "D-13's rebase disclosure travels into buildSplitsSection as a boolean isRebasedAverage flag, not a pre-built string. The caption sentence is constructed inside detail-sections.ts from the SAME activityAvgPaceSecPerKm argument already in scope there — this was necessary to satisfy the acceptance criterion that the 'not the disputed metadata average' copy string live in detail-sections.ts (the plan's own <interfaces> section named an 'equivalent explicit flag' as an acceptable alternative to a pre-built string argument)."

requirements-completed: [PACE-07]

# Metrics
duration: ~35min
completed: 2026-09-08
---

# Phase 26 Plan 08: Put PACE-07's Disagreement on Screen Summary

**"Pace disputed" badge reaches all four row surfaces plus the detail Pace stat card through one shared accessible-badge pipeline, and the splits `vs. Avg` baseline rebases to the stream-derived pace for the one flagged activity in the archive — disclosure, never suppression, pinned by a bidirectional sort/filter test.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 8 (3 production, 5 test)

## Accomplishments

- `appendAccessibleBadge` extracted as the single DOM-building block behind every accessible `.badge` + `.sr-only` description pair in the dashboard; `appendLowConfidenceBadge`'s public signature and behaviour are unchanged, it now just delegates internally.
- `PACE_DISPUTED_BADGE_TEXT` ('Pace disputed'), `paceDisputedDescriptionId`, `paceDisputedExplanation`, and `appendPaceDisputedBadge` added to `list.ts`. `statusBadgeTexts` pushes the text when `row.paceDisagreement !== null` (adjacent to the Low confidence push); `appendStatusBadges` — the single dispatch both `renderActivityRow` and the desktop `buildTableRow` invoke — gained one new branch, reaching all four `RowSurface` values (`activity-card`, `activity-table`, `overview-prs`, `overview-activities`) from that one change.
- `detail.ts` reads `indexClient.getRow(detail.id)?.paceDisagreement ?? null` (T-26-01: degrades to no badge on a missing key). The metadata `paceSecPerKm` computation and the Pace stat card's big `.text-display` value are byte-unchanged (D-10) — the badge is a third child appended only when flagged, carrying `Pace disputed — stream-derived {pace}`.
- D-13: `buildSplitsSection` gained an `isRebasedAverage: boolean = false` fourth parameter. `detail.ts` passes the stream-derived pace as the `activityAvgPaceSecPerKm` argument (instead of the disputed metadata pace) and sets the flag `true` only on the flagged branch; `buildPaceBarCell` itself is unchanged. When the flag is set, `buildSplitsSection` appends a `<p class="text-label">` disclosure note built from that same in-scope average value.
- `styles.css` gained exactly one rule: `.stat-grid > div > .badge { margin-top: var(--space-xs); }` — no new token, no new colour, no new colour-scoped class. Mutation-verified during execution: removing the rule fails the new `styles.test.ts` assertion loudly (`No rule found whose selector list contains: .stat-grid > div > .badge`).
- D-12's no-suppression rule pinned in `list-logic.test.ts` against `compareRows`/`sortRows`/`filterRows`'s RETURNED VALUES (not source-text alone): a flagged row and an identical unflagged row tie in sort value and share the same filter verdict; a flagged row still ranks by its own `paceSecPerKm` in a mixed-fixture sort (fastest-first, unsuppressed); a flagged row inside an active pace range passes `filterRows` while an out-of-range row still fails it (bidirectional, non-vacuous). A corroborating source scan confirms `list-logic.ts` has zero references to `paceDisagreement`.
- D-13 wiring pinned in `detail-sections.test.ts` via comment-stripped source scans of `detail.ts` (the `rebasedAveragePaceSecPerKm` ternary and its `buildSplitsSection` call site) and `detail-sections.ts` (the `isRebasedAverage` flag and its caption-note construction), plus a direct assertion the caption copy is present verbatim.
- Verified against the real, freshly-regenerated `data/dashboard/index.json` (`npm run build && npm run compute-dashboard-index`, then `npm run compute-all-stats`): activity `5059204779` is still the sole flagged row, `paceDisagreement: {"streamPaceSecPerKm":350.6,"metadataPaceSecPerKm":112.6,"ratio":3.11}`, `paceSecPerKm` unchanged at `112.6`. Sorting the real archive by pace ascending (`sortRows` against the compiled `dist/dashboard/views/list-logic.js`) confirms it ranks **#1 of 1890** — exactly the "ranks fastest unmarked" problem this plan's objective describes, now marked.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the Pace disputed badge to the single-source row badge pipeline** - `3f65760d` (feat)
2. **Task 2: Add the detail stat-card badge, rebase the splits baseline, and add the disclosure note** - `b7af4394` (feat)
3. **Task 3: Pin D-12's no-suppression rule, the D-13 rebase wiring, and the stylesheet constraint** - `18b4c353` (test)

**Plan metadata:** commit pending (this SUMMARY, executed by the orchestrator after wave merge in worktree mode)

## Files Created/Modified

- `src/dashboard/views/list.ts` — extracted `appendAccessibleBadge`; refactored `appendLowConfidenceBadge` to call it (signature unchanged); added `PACE_DISPUTED_BADGE_TEXT`, `paceDisputedDescriptionId`, `paceDisputedExplanation`, `appendPaceDisputedBadge`; extended `statusBadgeTexts` and `appendStatusBadges`.
- `src/dashboard/views/list.test.ts` — assertions that `statusBadgeTexts` includes/omits `'Pace disputed'` correctly, badge ordering with Low confidence, and `paceDisputedDescriptionId`'s distinctness from `lowConfidenceDescriptionId`.
- `src/dashboard/views/detail.ts` — reads `disagreement` from the index row; appends the stat-card badge via `appendAccessibleBadge`; computes `rebasedAveragePaceSecPerKm` and passes `disagreement !== null` into `buildSplitsSection`.
- `src/dashboard/views/detail-sections.ts` — `buildSplitsSection` gained the `isRebasedAverage` parameter and the D-13 caption-note append.
- `src/dashboard/views/detail-sections.test.ts` — new D-13 wiring source-scan assertions; updated the pre-existing `splitGapAnnotations` call-site test to a proximity check after Task 2's multi-line call-site reformat invalidated its single-line literal match.
- `src/dashboard/views/list-logic.test.ts` — new D-12 describe block (behavioural + source-scan).
- `src/dashboard/styles.css` — one rule, `.stat-grid > div > .badge { margin-top: var(--space-xs); }`.
- `src/dashboard/styles.test.ts` — asserts the new rule exists and that no `.pace-warning`/`.gap-badge` class was introduced.

## Exact Badge Strings for Activity 5059204779 (for plan 26-10's checkpoint)

Pre-computed from the real, committed `paceDisagreement` values (`streamPaceSecPerKm: 350.6`, `metadataPaceSecPerKm: 112.6`) via the shipped `formatPace` — read back against these literal strings, not judged on plausibility:

| Location | Exact string |
|---|---|
| Detail view, Pace stat card, big value (unchanged, D-10) | `1:53/km` |
| Detail view, Pace stat card, badge | `Pace disputed — stream-derived 5:51/km` |
| Row surfaces (all four), visible badge text | `Pace disputed` |
| Row badge `title` / `.sr-only` explanation | `Metadata pace disagrees with the stream-derived pace: 5:51/km measured vs. 1:53/km shown` |
| Detail view, splits table, D-13 caption note | `Splits above are compared against the stream-derived average (5:51/km), not the disputed metadata average.` |
| Activities list, pace-ascending sort rank | `#1 of 1890` (real archive, verified via `sortRows` against the compiled `dist/dashboard/views/list-logic.js`) |
| Overview → Recent Activities / Recent PRs | **Not applicable at execution time** — `prCount: 0` (never qualifies for Recent PRs) and `startDate: 2021-03-25` (far outside any "recent" window), so 26-10's row 5 should record stated non-applicability, not a silent skip |

## Decisions Made

- `appendAccessibleBadge` was exported as a new shared helper (rather than inlining a near-duplicate builder into `detail.ts`) because the detail stat-card badge's visible text carries the stream-derived figure and cannot reuse `appendPaceDisputedBadge`'s fixed `'Pace disputed'` text — this is the plan's own "reuse the helper... if its signature fits" instruction applied literally: the existing higher-level helper's signature did NOT fit, so the shared lower-level block was exported instead of writing a fourth badge builder.
- D-13's disclosure sentence is built inside `detail-sections.ts` from the SAME `activityAvgPaceSecPerKm` argument already in scope there (via a boolean `isRebasedAverage` flag), rather than passed in as a pre-built string from `detail.ts`. This was required to satisfy the acceptance criterion that the caption copy string live in `detail-sections.ts` (`grep -c "not the disputed metadata average" src/dashboard/views/detail-sections.ts` must output `1`) and matches the plan's own alternative wording ("...or an equivalent explicit flag").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale single-line literal-match test invalidated by Task 2's own multi-line call-site reformat**
- **Found during:** Task 2, running `detail-sections.test.ts` after adding the `rebasedAveragePaceSecPerKm`/`isRebasedAverage` arguments to the `buildSplitsSection` call site in `detail.ts`.
- **Issue:** Plan 26-06's pre-existing test asserted the exact single-line string `buildSplitsSection(splits, paceSecPerKm, splitGapAnnotations(splits, derived.coverage.gapIntervals))`. Task 2's own required change (D-13) reformats that call across multiple lines to add two new arguments, which broke the literal match even though the underlying wiring (splits, `splitGapAnnotations` call) is unchanged.
- **Fix:** Replaced the single-line literal assertion with a proximity check — locate the `buildSplitsSection(` call site once, then assert the `splitGapAnnotations(splits, derived.coverage.gapIntervals)` substring appears within it, regardless of line breaks.
- **Files modified:** `src/dashboard/views/detail-sections.test.ts`
- **Verification:** `npx vitest run src/dashboard/views/detail-sections.test.ts` — 88/88 passing.
- **Committed in:** `b7af4394` (Task 2's commit)

**2. [Rule 1 - Bug] Reverted an unrelated `data/geo/geo-metadata.json` timestamp mutation**
- **Found during:** Task 2, after running `npm run compute-all-stats` to regenerate missing gitignored stats artifacts for the full test suite.
- **Issue:** `compute-all-stats` touches `data/geo/geo-metadata.json`'s `generatedAt` timestamp as a side effect, unrelated to this plan's scope.
- **Fix:** `git checkout -- data/geo/geo-metadata.json` before staging Task 2's commit.
- **Files modified:** none shipped (reverted before commit)
- **Verification:** `git status --short` showed only this plan's intended files before each commit.
- **Committed in:** not committed (reverted)

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both fixes were necessary consequences of correctly executing the plan's own instructions (D-13's multi-argument call site; regenerating compute artifacts to run the full suite) — no scope creep, no file touched outside this plan's declared `files_modified` plus the one incidental revert.

## Issues Encountered

- **Worktree base mismatch at startup:** the worktree's initial HEAD (a lineage of `chore: update activities and stats [skip ci]` commits) did not contain phase 26's plan/summary files at all — `git merge-base HEAD <expected-base>` returned a different commit than the expected base. Resolved per the plan's own `<worktree_branch_check>` protocol: `git reset --hard 932b7e4e0ed4b035fd376ca47111c8a874e6f019` before starting any task work, confirmed via `git ls-tree` that the phase 26 directory was then present.
- **`chartjs-plugin-zoom` test failure is a worktree-isolation artifact, not a regression:** `trends-zoom-logic.test.ts` resolves `chartjs-plugin-zoom`'s dist file via a path relative to the test file's own location (`new URL('../../../node_modules/...', import.meta.url)`), which requires a LOCAL `node_modules/chartjs-plugin-zoom` inside the worktree. This worktree has no local `node_modules` at all (0 entries besides Vite cache dirs) — every other `import`/`require` in this session resolved via Node's up-tree module resolution to the main repo's `node_modules` (174 packages, including a fully-built `chartjs-plugin-zoom`), which the URL-relative path in that one test cannot reach. Not a `npm install` candidate (the package IS present via Node's normal resolution; this is a fixed relative path assuming worktree-local `node_modules`), out of this plan's scope, and unrelated to any file this plan touches. `npm run test`: 67/68 files passing, 1756/1756 individual tests passing, the 1 failing FILE being this pre-existing artifact (matching the class of failure 26-06/26-07's own SUMMARYs documented for fresh worktrees).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All four `RowSurface` values, the detail Pace stat card, and the splits `vs. Avg` baseline now carry the pace-disputed disclosure — plan 26-10's browser checkpoint rows 3, 4, 5, 6 (D-11/D-13, PACE-07) can read back the exact strings tabulated above against activity `5059204779`.
- Row 5 (Overview Recent Activities / Recent PRs) is confirmed NOT APPLICABLE at this execution's data state (`prCount: 0`, `startDate: 2021-03-25`) — 26-10 should record this as stated non-applicability per the plan's own instruction, not attempt to force a fixture.
- `npx tsc --noEmit` exits 0, `npm run build-widgets` exits 0, `npm run verify-dashboard` exits 0 (56/56 checks), `grep -c "paceDisagreement" src/dashboard/views/list-logic.ts` outputs `0`.
- `npm run test`: 1756/1756 tests passing; the single failing FILE (`trends-zoom-logic.test.ts`) is the pre-existing worktree-isolation artifact documented above, unrelated to this plan.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*
