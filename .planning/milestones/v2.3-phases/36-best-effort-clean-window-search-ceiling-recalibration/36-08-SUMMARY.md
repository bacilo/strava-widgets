---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 08
subsystem: ui
tags: [detail-view, badge, accessibility, typescript, vitest, source-text-guard, css-tokens]

# Dependency graph
requires:
  - phase: 36-03
    provides: "EffortContamination interface and required ComputedEffort.contaminated field; the browser's total, never-throwing parseContaminated and the widened VALID_DEMOTION_GUARDS allowlist"
provides:
  - "BestEffortPanelRow's four contaminated fields (contaminated, contaminatedReason, contaminatedDurationSec, contaminatedPaceSecPerKm), populated via the T-28-02-A != null / ?. / ?? null discipline"
  - "PrFlagBadgeSpec.kind widened to include 'contaminated', with a new badge branch emitted second in the fixed order (pr, contaminated, demoted, low-confidence, excluded), justified in the source as machine measurement -> machine judgment -> owner intent"
  - "buildPrFlagsCell's kind-to-class lookup (BADGE_KIND_CLASS), its own dedicated .badge--contaminated CSS modifier and --contaminated-text token (contrast-checked in both themes), structurally mirroring .badge--demoted"
  - "A source-text wiring guard proving the union and the class lookup cannot silently drift apart, and that only one appendAccessibleBadge( call path exists"
affects: ["36-14"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kind-to-CSS-class lookup object (BADGE_KIND_CLASS) replacing a single-kind ternary, so a DOM builder that 'decides nothing itself' stays a pure lookup rather than growing a second conditional per new badge kind"
    - "Bidirectional source-text consistency guard: extracts a TypeScript union type and a JS object's keys via regex from stripped source, and asserts the two sets reconcile in both directions — union-not-in-lookup falls through by design, lookup-not-in-union is a hard failure"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - src/dashboard/styles.css

key-decisions:
  - "D-15 (per 36-CONTEXT.md, implemented not re-litigated here): the contaminated badge is emitted SECOND in the fixed order — after pr, before demoted/low-confidence/excluded — because it names WHICH window produced the displayed number before any judgment (demoted) or caveat (low-confidence) about that number, or the owner's own intent (excluded). Stated in the source docblock as a deliberate rule, not left implicit."
  - "--contaminated-text chosen as a teal/cyan hue (#0e7490 light / #38bdf8 dark), deliberately distinct in both hue and declared value from --demoted-text's orange (#b3390a / #fb923c), with WCAG AA contrast computed and recorded in the CSS comment for both --bg and --surface in both themes (light 5.36:1/4.93:1, dark 7.96:1/6.95:1)"
  - "D-06's no-clean-window case (contaminated: false, demoted: true, carrying the guard's own reason) was explicitly tested to confirm it travels through the existing demoted copy unchanged, with no contaminated spec — checked rather than assumed, per the plan's own instruction"

patterns-established:
  - "A badge kind's CSS modifier lives in a standalone lookup object, not inline in the DOM builder, so a future kind's wiring is one lookup entry plus a source-text guard rather than growing a ternary chain"

requirements-completed: []
# This plan's frontmatter states: "Requirement-tick safety: this plan ticks
# nothing and edits no planning document. Skip any end-of-plan
# `requirements mark-complete` call." No REQUIREMENTS.md rows are ticked by
# this SUMMARY; PR-07 remains tracked at the phase level via 36-03's own tick.

# Metrics
duration: ~6min (task commits only; worktree setup, build, and full-suite verification preceded/followed)
completed: 2026-09-28
---

# Phase 36 Plan 08: Detail-View Contaminated Badge Summary

**A moved effort's activity-detail panel row now carries its original figure, its reason, and a dedicated "Ranked on clean window" badge — visually and programmatically distinct from the demoted/excluded badges, positioned second in the fixed emission order by a stated rule, and reached through the one existing DOM badge path.**

## Performance

- **Duration:** ~6 min (task commits: 16:02:56Z → 16:08:38Z); worktree setup (symlink, `data/` copy, `npm run build`) and the full `npm test` verification pass took additional wall time outside the three task commits
- **Started:** 2026-09-28T16:02:56+02:00 (first task commit)
- **Completed:** 2026-09-28T16:08:38+02:00 (third task commit)
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments

- `BestEffortPanelRow` gained four fields (`contaminated`, `contaminatedReason`, `contaminatedDurationSec`, `contaminatedPaceSecPerKm`) mirroring the `demoted`/`demotionReason` pair, populated at the existing row-construction site via `!= null` / `?.` / `?? null` (T-28-02-A) so a stale shard with no `contaminated` key degrades to `false`/`null` rather than throwing. The field-group comment states the three-way distinction: `contaminated` (machine observation of which window was measured) vs. `demoted` (machine judgment/rejection) vs. `excluded` (owner's stated intent) — all three independently true-able on one row.
- `PrFlagBadgeSpec.kind` widened to `'pr' | 'contaminated' | 'demoted' | 'low-confidence' | 'excluded'`, with a new branch in `prFlagBadgeSpecs` emitting `kind: 'contaminated'` between the `pr` and `demoted` branches. `visibleText` is `Ranked on clean window — {reason}` (or the bare fallback with no trailing dash when `contaminatedReason` is `null`); `explanation` names that the ranked time excludes an unreliable segment and that the original time/segment are named here without leaving the view. The docblock states the emission-order rationale explicitly (machine measurement → machine judgment → owner intent) and restates D-15's two bounds: reachable without leaving the view (same-row badge), and never presented as if nothing changed (fires on `row.contaminated` alone, independent of `demotion`, which is `null` for every moved effort).
- `detail-sections.ts`'s `buildPrFlagsCell` replaced its single-kind ternary (`spec.kind === 'demoted' ? 'badge--demoted' : undefined`) with a `BADGE_KIND_CLASS` lookup mapping `'demoted'` and `'contaminated'` to their own modifier classes; every other kind falls through to a plain `.badge` by design. The function still emits exactly one `appendAccessibleBadge` call per spec and decides nothing else.
- `styles.css` gained a `--contaminated-text` token (declared in all three places `--demoted-text` is declared: the `:root` no-attribute-selector duplicate, `[data-theme="light"]`, and `[data-theme="dark"]`) with measured WCAG AA contrast recorded in each declaration's comment, and a `.badge--contaminated` rule immediately after `.badge--demoted`, structurally identical (same two properties, the new token substituted). `.badge`, `.badge--severe` and `.badge--demoted` are byte-for-byte unchanged.
- A new `contaminated badge wiring (source guard, Phase 36 D-15)` describe block in `detail-sections.test.ts` (this repo's vitest runs `environment: 'node'` with no DOM library, so a DOM builder's wiring can only be proven by source-text scan, following the file's own established `stripComments` idiom): confirms `badge--contaminated` is present in the TS source, `buildPrFlagsCell` still emits exactly one `appendAccessibleBadge(` call, the two CSS tokens declare different values (parsed and compared, not eyeballed), and — bidirectionally — that the `PrFlagBadgeSpec.kind` union and the `BADGE_KIND_CLASS` lookup cannot silently drift apart (every lookup key is a real union member; the exact lookup-vs-fallthrough split is pinned).
- 14 new tests added across the two test files: 4 for the panel-row fields (full population, `null` degrade, stale-shard-no-key degrade, and the contaminated+demoted+excluded triple-true case), 6 for the badge spec (reason-carrying and null-reason copy, the can-fail not-contaminated case, the exact five-kind emission order via `toEqual`, R15 descriptionIdSuffix separability, and the D-06 no-clean-window case explicitly checked to emit only the existing `demoted` badge), and 4 for the DOM wiring guard described above.

## Task Commits

Each task was committed atomically:

1. **Task 1: BestEffortPanelRow carries the contaminated figure and its reason** - `a4da2e8d` (feat)
2. **Task 2: The contaminated badge spec, at a stated position in the fixed emission order** - `30f3d0f6` (feat)
3. **Task 3: Give the new kind its own visual modifier, and guard the DOM wiring by source text** - `ed8cc4f1` (feat)

**Plan metadata:** per the worktree-agent instructions, this agent does not update STATE.md/ROADMAP.md — the orchestrator does so centrally after merge. This plan's own frontmatter also states it ticks no REQUIREMENTS.md rows.

_Note: no TDD tasks in this plan — all three are `type="auto"`, each with tests added as part of the same commit._

## Files Created/Modified

- `src/dashboard/views/detail-best-efforts-logic.ts` — `BestEffortPanelRow`'s four new fields + population site; `PrFlagBadgeSpec.kind` widened; the new `contaminated` branch in `prFlagBadgeSpecs`, positioned and documented per D-15
- `src/dashboard/views/detail-best-efforts-logic.test.ts` — `panelRow()` fixture extended; two new describe blocks (`contaminated panel row`, `contaminated badge`) with 10 new tests
- `src/dashboard/views/detail-sections.ts` — `BADGE_KIND_CLASS` lookup added, replacing the single-kind ternary in `buildPrFlagsCell`; docblock extended
- `src/dashboard/views/detail-sections.test.ts` — new `contaminated badge wiring` describe block, 4 source-text guard tests
- `src/dashboard/styles.css` — `--contaminated-text` token (all three declaration sites) and `.badge--contaminated` rule added; no existing rule/token changed

## Verification Evidence

- `npx tsc --noEmit` exits 0 at every task boundary.
- Task 1: `npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts -t "contaminated panel row"` — **4/4 matched and passed** (not 0 — filter confirmed non-vacuous). File total at this point: 61 tests (57 pre-existing + this task's 4).
- Task 2: `npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` unfiltered (per this task's own `<verify>` block, which does not use a `-t` filter) — **67/67 passed** (61 from Task 1's boundary + this task's 6 new `contaminated badge` cases).
- Task 3: `npx vitest run src/dashboard/views/detail-sections.test.ts -t "contaminated badge wiring"` — **4/4 matched and passed** (not 0).
- Task 3: `npx vitest run src/dashboard/views/detail-sections.test.ts` unfiltered — **201/201 passed**.
- Full suite: `npm test` — **101/101 test files, 3712/3712 tests pass** (baseline from 36-03's own SUMMARY: 3698 tests; net +14, exactly this plan's new test count: 4 + 6 + 4 = 14).
- `git diff --stat` against the plan's own base commit (`fd25f373`) touches exactly the five files named in `files_modified`, no more, no fewer.
- `git diff -- package.json` is empty — no dependency was added.
- Every task's `<verify>` python assertion block (field presence, `!= null` population, T-28-02-A naming, kind-union ordering, the order-assertion string, the badge-class/token presence, the two CSS tokens' declared-value inequality) passed.
- Post-commit deletion check (`git diff --diff-filter=D --name-only HEAD~1 HEAD`) was empty after every one of the three task commits — no unintended file deletions.

## What Was Verified by Assertion vs. Not Verified Visually

**Verified by assertion (this plan's own evidence):**
- Field population, `null`/stale-shard degrade, and the three-way-true case for the panel row (Task 1).
- The badge spec's copy, fallback, can-fail (not-contaminated → no badge) direction, exact five-kind emission order, R15 `descriptionIdSuffix` separability, and the D-06 no-clean-window pass-through (Task 2).
- That the DOM builder (`buildPrFlagsCell`) contains exactly one badge-emission call path, that `badge--contaminated` and `--contaminated-text` exist in source, that the two CSS tokens declare genuinely different values (parsed, not eyeballed), and that the TypeScript kind union and the JS class lookup cannot silently diverge in either direction (Task 3).

**NOT verified visually in this worktree, per the plan's own stated scope:** the rendered appearance of the badge (its actual on-screen colour, spacing, and legibility against both themes) was not checked in a browser. This repository's vitest suite runs `environment: 'node'` with no DOM-simulation library anywhere in the tree, so no test in this plan (or any sibling `detail-sections.test.ts` test) invokes `buildPrFlagsCell` and reads back a real DOM node — every claim above is a source-text guard, which proves wiring, not pixels. Per the plan's own Task 3 action item 4 and this repo's `ui_discipline` instructions, the rendered appearance is the responsibility of plan 36-14's mandatory human browser checkpoint against a digest-verified served build. This plan did not run that checkpoint and makes no claim to have seen the badge rendered.

**Additionally out of reach in this worktree specifically:** per this plan's `<dependency_context>`, nothing in the currently-merged tree constructs a non-null `contaminated` value or a `'unreliable-segment'` demotion yet — 36-04 (running in parallel) is the plan that wires the real clean-window search. This plan's tests are therefore built exclusively against fixtures of the declared `EffortContamination` shape (36-03's locked interface), not against real produced shard data. This is expected and by design, not a gap — 36-04's dependents (36-08, 36-09) cannot end-to-end test against real data in this wave.

## Decisions Made

None beyond D-15's own delegated bounds, implemented as specified in 36-CONTEXT.md (the emission position and its justification, and the presentation shape — badge text, explanation, dedicated CSS token — were this plan's own discretion within those bounds, recorded under key-decisions above). No architectural decisions (Rule 4) were required during execution.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<action>` steps were implemented as specified; all `<verify>` automated checks and `<acceptance_criteria>` passed without requiring a bug fix, missing-functionality addition, or blocking-issue workaround.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. This plan's own STRIDE register (T-36-41 through T-36-46) covers every new surface introduced: the four new panel-row fields (stale-shard degrade), the badge branch (independence from `demotion`), the fixed five-element order and distinct `descriptionIdSuffix`/explanation values (R15 regression), the dedicated CSS token (inequality asserted), the single-badge-path guard (no second, un-described path), and `textContent`/`title` assignment inherited unchanged from `appendAccessibleBadge` (no new markup-injection surface). No new network endpoint, auth path, file-access pattern, or schema-boundary change was introduced — this plan is presentation-layer only, consuming a record shape 36-03 already locked.

## Next Phase Readiness

- The detail view's presentation of a moved effort (D-15) is now complete and testable against fixtures; when 36-04 lands the real clean-window search and begins producing non-null `contaminated` records, this view will render them with no further code change needed on this plan's files.
- Plan 36-14's browser checkpoint is the next place this badge's actual rendered appearance (colour, legibility in both themes, spacing beside the pace figure) gets verified against a real served build — this plan explicitly defers that verification, as instructed.
- No blockers for 36-04, 36-09, or 36-14. This plan's files (`detail-best-efforts-logic.{ts,test.ts}`, `detail-sections.{ts,test.ts}`, `styles.css`) were the sole ownership boundary for this worktree per the parallel-execution instructions; `compute-best-efforts.ts` (36-04) and `records*.ts`/`effort-guard-homes.test.ts` (36-09) were not read or touched.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: src/dashboard/views/detail-best-efforts-logic.ts
- FOUND: src/dashboard/views/detail-best-efforts-logic.test.ts
- FOUND: src/dashboard/views/detail-sections.ts
- FOUND: src/dashboard/views/detail-sections.test.ts
- FOUND: src/dashboard/styles.css
- FOUND: commit a4da2e8d
- FOUND: commit 30f3d0f6
- FOUND: commit ed8cc4f1

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*
