---
phase: 27-per-activity-quality-signals
plan: 07
subsystem: ui
tags: [typescript, vitest, dashboard, badges, accessibility, quality-signals]

requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-01/27-02's ActivityQualitySignals type tree (QualityTier, DecimationSignal, GapProfileSignal, ImpossibleSampleSignal), and 27-04's required row.quality field on every published DashboardIndexRow"
provides:
  - "qualityBadgeSpecs(row) — the pure, unit-testable per-row quality-badge decision (decimation/gapProfile/impossibleSamples, severe-tier only, fixed render order)"
  - "appendQualityBadges — the parallel, row-field-driven DOM dispatch path, called once from appendStatusBadges so all four RowSurface values reach it with no per-surface conditional"
  - "qualityBadgeDescriptionId — the per-signal description-id shape, distinct from low-confidence/pace-disputed"
  - "appendAccessibleBadge's optional fifth extraClassName parameter (default-preserving) and the .badge--severe token-based modifier class in styles.css"
affects: [27-08, 27-09]

tech-stack:
  added: []
  patterns:
    - "Two parallel badge dispatch paths in one function (appendStatusBadges): the pre-existing fixed-text string-equality chain, untouched, plus a new row-field-driven path (appendQualityBadges) for badges whose visible text varies per row — the structural split Criterion 3 requires"
    - "A single composeRowAriaLabel call carrying a concatenated badge-text array (not two separate calls), preserving a pre-existing cross-file invariant (`composeRowAriaLabel(` occurs exactly twice in list.ts) that four other test files assert independently"
    - "appendAccessibleBadge's optional trailing parameter, default-preserving, so a shared DOM builder gains a styling hook without touching any of its three existing call sites"

key-files:
  created: []
  modified:
    - src/dashboard/views/list.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/styles.css
    - .planning/phases/27-per-activity-quality-signals/deferred-items.md

key-decisions:
  - "The 27-CONTEXT.md D-09 worked example says 'elapsed time in recording gaps'; the shipped gapProfile badge text instead reads '{N}% of recorded time in gaps or pauses' — naming BOTH categories (gapFraction = (recordingGapSec + pauseSec) / spanSec) and calling the denominator 'recorded time' rather than 'elapsed time', because spanSec is the stream's own recorded span, not the metadata elapsed_time. Documented inline in qualityBadgeSpecs's gapProfile branch per the plan's explicit instruction."
  - "activityRowAriaLabel folds quality badge text into the SAME composeRowAriaLabel call as the existing status-badge fold (one array, one call), not a second composeRowAriaLabel invocation — a first attempt using two calls broke a pre-existing invariant test in four other files (row-semantics.test.ts, curation-seam.test.ts, pace-single-source.test.ts, detail-sections.test.ts) asserting composeRowAriaLabel( occurs exactly twice in list.ts; corrected before committing Task 2."
  - "appendAccessibleBadge gained an OPTIONAL fifth extraClassName parameter (default omitted -> plain .badge, byte-identical to before) rather than a fourth badge-DOM builder, so appendLowConfidenceBadge/appendPaceDisputedBadge/detail.ts's stat-card call site needed zero changes."
  - ".badge--severe reuses the existing theme-aware --destructive custom property (already declared per data-theme value) rather than introducing a new hex literal or custom property, so the severe-tier visual distinction inherits both themes automatically via the data-theme attribute."

requirements-completed: [QUAL-02, QUAL-04]

duration: ~12min
completed: 2026-09-10
---

# Phase 27 Plan 07: Quality Badge Dispatch Restructure Summary

**Split `list.ts`'s badge dispatch into two parallel paths — the pre-existing fixed-text string-equality chain (untouched) plus a new row-field-driven path carrying per-row-variable visible text — and added three severe-tier quality badges (decimation, gap profile, impossible samples) through the new path, reaching all four row surfaces via the single existing `appendStatusBadges` call site.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 3 declared (`list.ts`, `list.test.ts`, `styles.css`) + 1 process file (`deferred-items.md`)

## Accomplishments

- `qualityBadgeSpecs(row)` is a pure, unit-testable function returning one `QualityBadgeSpec` per severe-tier signal (decimation, gapProfile, impossibleSamples, in that fixed render order), each carrying visible text that names the condition AND its measured value read directly off the row's own evidence fields (e.g. `"12% of recorded time in gaps or pauses"`, `"7 samples faster than the 100 m world record"`) — never a fixed adjective, never recomputed. Minor/none/not-computable rows and a severe tier whose evidence field is `null` all correctly produce zero specs for that signal.
- Device era and elapsed-vs-moving are deliberately excluded from every returned spec (D-13, D-14) — no spec type exists for them, and the exclusion is documented inline as a decision, not an oversight.
- `appendQualityBadges` dispatches all fired specs through the shared `appendAccessibleBadge` DOM block, called exactly once from `appendStatusBadges` (verified: `appendQualityBadges(` occurs exactly 2 times in `list.ts` — one definition, one call site), so all four `RowSurface` values (`activity-card`, `activity-table`, `overview-prs`, `overview-activities`) reach the new badges through the ONE existing dispatch, with zero per-surface conditionals (verified by grep).
- The two pre-existing badges (`Low confidence`, `Pace disputed`) are provably byte-identical: `git diff` against the plan's start commit shows zero changed lines inside `statusBadgeTexts`'s body, the existing `if (text === …)` chain, `appendLowConfidenceBadge`, `appendPaceDisputedBadge`, `paceDisputedExplanation`, and `rowPaceDisagreement`.
- `activityRowAriaLabel` folds the new quality badge text onto the SAME `composeRowAriaLabel` call the existing status-badge fold already uses, preserving a pre-existing cross-file invariant (`composeRowAriaLabel(` occurs exactly twice in `list.ts`) that four unrelated test files (`row-semantics.test.ts`, `curation-seam.test.ts`, `pace-single-source.test.ts`, `detail-sections.test.ts`) independently assert — a first-draft implementation using two separate calls broke that invariant and was corrected before committing.
- `.badge--severe` visually distinguishes the three new badges using the existing theme-aware `--destructive` token in both themes, with no new hex literal or custom property. `appendAccessibleBadge` gained an OPTIONAL fifth `extraClassName` parameter (default omitted, byte-identical prior output) so none of its three existing call sites (`appendLowConfidenceBadge`, `appendPaceDisputedBadge`, `detail.ts`'s stat-card badge) needed any change.
- Verified against the BUILT `dist/widgets` asset, not the source file: `npm run build-widgets` exits 0 with zero `css-syntax-error` occurrences in its captured output, and the emitted stylesheet (`dist/widgets/assets/index-*.css`, mtime newer than the source edit) contains `badge--severe{color:var(--destructive);border-color:var(--destructive)}`.
- 88 tests in `list.test.ts` pass (up from a 70-test baseline: +18 new — 9 `quality badge text`, 2 `qualityBadgeDescriptionId`, 7 `existing badges unregressed`). `npx tsc --noEmit` exits 0 throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: qualityBadgeSpecs — the pure, per-row badge decision** - `45d6235b` (feat)
2. **Task 2: The parallel row-field-driven dispatch, with the two existing badges untouched** - `2db8679d` (feat)
3. **Task 3: Severe-tier badge styling** - `55cc535b` (feat)

_Note: no plan-metadata commit yet in this worktree — orchestrator handles the final merge-time docs commit across all wave worktrees._

## Files Created/Modified

- `src/dashboard/views/list.ts` — Added `QualityBadgeSpec`, `qualityBadgeDescriptionId`, `qualityBadgeSpecs` (Task 1); `appendQualityBadges` plus its one call site inside `appendStatusBadges`, and `activityRowAriaLabel`'s single-call fold (Task 2); `appendAccessibleBadge`'s optional fifth parameter and `appendQualityBadges`'s `'badge--severe'` pass-through (Task 3).
- `src/dashboard/views/list.test.ts` — `quality badge text` describe block (9 tests, literal string substring required by `27-VALIDATION.md`'s QUAL-04 `-t` filter); `qualityBadgeDescriptionId` describe block (2 tests); `existing badges unregressed` describe block (7 tests, literal substring for T-27-23's regression guard).
- `src/dashboard/styles.css` — `.badge--severe` modifier class, token-based, added directly after the existing `.badge` rule.
- `.planning/phases/27-per-activity-quality-signals/deferred-items.md` — Logs a newly-EXPOSED (not caused) manifestation of the pre-existing `data/dashboard/index.json` worktree-provisioning gap, surfaced by Task 3's mandated `npm run build-widgets` run (see Issues Encountered).

## Decisions Made

See `key-decisions` in the frontmatter. In addition:

- **Fixed render order enforced by construction, not convention:** `qualityBadgeSpecs` checks decimation, then gapProfile, then impossibleSamples in that literal order in the function body — a row severe on all three always returns specs in that order, tested explicitly.
- **`countInsideZeroAdvanceRun` and other non-severity fields are read but never surfaced in badge text** — the badge text uses only the fields the plan's `<action>` names per signal (`zeroAdvanceFraction`, `gapFraction`, `count`), keeping the visible text exactly as specified rather than adding supplementary numbers that would drift from the plan's worked examples.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, caught during Task 2's own verification before commit] `activityRowAriaLabel`'s two-call-site draft broke a cross-file invariant**

- **Found during:** Task 2, running the mandated `npm run test` acceptance check before committing.
- **Issue:** The first implementation of `activityRowAriaLabel` called `composeRowAriaLabel` twice (once for the existing status-badge fold, once more for the new quality-badge fold). Four unrelated test files (`src/dashboard/row-semantics.test.ts`, `src/dashboard/curation-seam.test.ts`, `src/analytics/pace-single-source.test.ts`, `src/dashboard/views/detail-sections.test.ts`) each independently assert `countOccurrences(listStripped, 'composeRowAriaLabel(') === 2` (its definition plus its single call site) as a standing invariant — this broke that invariant, failing 4 tests across those 4 files.
- **Fix:** Concatenated both badge-text arrays (`statusBadgeTexts(row)` and `qualityBadgeSpecs(row).map(s => s.visibleText)`) into one array and passed it to a SINGLE `composeRowAriaLabel` call, preserving the exact same visible ordering while keeping the call-site count at 2.
- **Files modified:** `src/dashboard/views/list.ts` (within Task 2's own commit, no separate commit needed — corrected before the task was committed).
- **Verification:** `npm run test` went from 4 failing tests (in the 4 files above) to those 4 files passing, with the full targeted suite (`list.test.ts` + `overview.test.ts`) staying at 106/106.
- **Committed in:** `2db8679d` (Task 2's commit — the fix was applied before that commit, so no separate commit exists for it).

---

**Total deviations:** 1 auto-fixed (Rule 1 — caught and corrected pre-commit, never shipped in a broken state)
**Impact on plan:** Zero scope creep. The correction is a same-task implementation refinement, not new functionality.

## Issues Encountered

Task 3's mandated `npm run build-widgets` verification step created `dist/widgets/index.html` in this worktree for the first time, which un-skips `scripts/verify-dashboard-publish-guard.test.mjs`'s `describe.skipIf(!existsSync(INDEX_HTML))` block (previously 0 tests ran on a fresh worktree, not a failure). That block then invokes the real `scripts/verify-dashboard-publish.mjs` as a subprocess, which correctly FATALs with `Missing: dist/widgets/data/dashboard/index.json` — the exact same root cause already documented in `deferred-items.md` by plans 27-01/27-04 (the CI compute pipeline, `compute-dashboard-index`, never ran in this worktree, so `data/dashboard/index.json` does not exist to be copied into `dist/widgets/`). 4 of that file's 5 tests fail on this FATAL message. Not a regression from this plan's code changes — logged in `deferred-items.md` rather than fixed, per the same out-of-scope policy 27-01/27-04 already established (running the full compute pipeline is outside this plan's scope and outside the deviation rules' auto-fix boundary).

This plan's own verification targets are fully green:
```
npx tsc --noEmit                                                              # 0 errors
npx vitest run src/dashboard/views/list.test.ts -t "quality badge text"       # 9/9 passed
npx vitest run src/dashboard/views/list.test.ts -t "existing badges unregressed"  # 7/7 passed
npx vitest run src/dashboard/views/list.test.ts src/dashboard/views/overview.test.ts \
  src/dashboard/views/detail-sections.test.ts                                 # 201/201 passed
npm run build-widgets                                                        # exit 0, 0 css-syntax-error
grep -o "badge--severe[^}]*}" dist/widgets/assets/index-*.css
# badge--severe{color:var(--destructive);border-color:var(--destructive)}
```

`npm run test` (full suite): 1818 passed, 0 failed in files this plan touches; 10 failed FILES total, all pre-existing worktree-provisioning artifacts (missing `data/stats/*.json`, `data/dashboard/index.json`, empty `node_modules/chartjs-plugin-zoom`) — 9 documented by 27-01/27-04, 1 newly exposed (not caused) by this plan's Task 3 build step and freshly documented above.

## Sanity Check Against the Live Archive

Spot-checked `qualityBadgeSpecs`'s expected output against real severe rows read from the main
checkout's `data/dashboard/index.json` (read-only, this worktree lacks the gitignored `data/`
tree per the parallel-execution note):

- `i183546832`: `gapProfile.gapFraction = 0.2655...` → `round(26.55) = 27%` → `"27% of recorded time in gaps or pauses"`
- `5566805363`: `decimation.zeroAdvanceFraction = 0.2033...` → `round(20.33) = 20%` → `"20% of samples with no distance advance"`
- `8869338724`: `impossibleSamples.count = 11` → `"11 samples faster than the 100 m world record"`

All three match the exact templates specified in the plan and shipped in `qualityBadgeSpecs`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

`list.ts` now exposes `qualityBadgeSpecs` (pure decision), `appendQualityBadges` (DOM dispatch),
and `qualityBadgeDescriptionId` (id shape) as the structural prerequisite Criterion 3 needs: a
badge whose visible text varies per row can now exist and reaches all four row surfaces through
one dispatch. `appendAccessibleBadge`'s optional `extraClassName` parameter and `.badge--severe`
are both reusable by future badge additions without a new DOM builder.

Plan 27-08 (the forthcoming filter toggle) can build on this dispatch shape without needing to
touch `appendStatusBadges`'s existing string-equality chain — it was explicitly left
composable and NOT pre-implemented here, per this plan's own scope boundary. `qualityBadgeSpecs`
takes `Pick<DashboardIndexRow, 'quality'>` and is already the natural predicate source for a
future "has severe quality issue" filter, since `row.quality.anySevere` and the per-signal tiers
it reads are the same fields a filter would key on.

No blockers for 27-08 or 27-09.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`src/dashboard/views/list.ts`,
`src/dashboard/views/list.test.ts`, `src/dashboard/styles.css`, `deferred-items.md`,
`27-07-SUMMARY.md`); all 3 task commits (`45d6235b`, `2db8679d`, `55cc535b`) confirmed present
in `git log`.
