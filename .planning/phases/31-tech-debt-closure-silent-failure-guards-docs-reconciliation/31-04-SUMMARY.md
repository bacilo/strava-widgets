---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
plan: 04
subsystem: testing
tags: [curation-queue, silent-failure-guard, vitest, esbuild, D-09, TD-03]

# Dependency graph
requires:
  - phase: 29-curation-review-queue
    provides: "derive-flagged.mjs's buildExclusionsMap, deriveFlaggedActivities, summarizeQueue and the curate-queue/index.ts renderQueue() header render site"
provides:
  - "countMalformedExclusions(exclusionsDoc) sibling export in scripts/curate-queue/derive-flagged.mjs"
  - "a rendered <p data-queue-malformed-note> line beside the queue's header counts, shown only when the malformed count is greater than zero"
affects: [31-03, TD-03-tick, docs-reconciliation-wave]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-export pattern for a derived count, keeping an existing function's return shape byte-identical (avoids touching every test that destructures deriveFlaggedActivities's QueueRow[])"
    - "Named-condition-plus-measured-value register (Phase 27 D-09) applied to a third site: 'N exclusion entries ignored (malformed)'"

key-files:
  created: []
  modified:
    - scripts/curate-queue/derive-flagged.mjs
    - scripts/curate-queue/derive-flagged.test.mjs
    - scripts/curate-queue/index.ts

key-decisions:
  - "TD-03 left unticked in REQUIREMENTS.md: this plan closes only the third of TD-03's three code sites (the queue); records-logic.ts's 'another guard' bucket and compute-pr-ceiling-recount.mjs's fail-closed check (plan 31-03) had not landed on this branch at execution time (both -t filters matched 0 tests, all skipped) — the plan's own output-section tick rule requires all three sites present and green before ticking."

requirements-completed: []  # TD-03 intentionally NOT ticked here — plan's own tick rule requires 31-03's two sites to have landed first (they had not, at execution time; see Verification Evidence below)

# Metrics
duration: ~20min
completed: 2026-09-19
---

# Phase 31 Plan 04: Curation Queue Malformed-Entry Count Summary

**Queue derivation gains a `countMalformedExclusions` sibling export and the queue page renders "N exclusion entries ignored (malformed)" beside its header counts, closing two previously-silent classes (empty reason, duplicate activityId) without touching `deriveFlaggedActivities`'s return shape.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments
- `buildExclusionsMap` (`scripts/curate-queue/derive-flagged.mjs`) now also rejects an empty/whitespace-only `reason` and detects a duplicate `activityId` (the collision counted once), returning `{ map, skippedCount }` internally.
- New sibling export `countMalformedExclusions(exclusionsDoc)` returns the skipped count as a plain number; `deriveFlaggedActivities` and `summarizeQueue`'s exported signatures/return shapes are byte-identical to before (confirmed via `git diff` on the signature line).
- 9 new tests, all named with "malformed", covering every behavior-block bullet: well-formed (0), non-string id, `__proto__` id, non-string reason, empty/whitespace reason, duplicate id collision, null/missing document, non-array `exclusions`, and the additive-rows proof (`deriveFlaggedActivities` returns identical rows with vs. without malformed entries present).
- `scripts/curate-queue/index.ts`'s `renderQueue()` imports `countMalformedExclusions` and calls it once with the same `exclusionsDoc` already passed to `deriveFlaggedActivities`; a sibling `<p data-queue-malformed-note>` renders `"${malformedCount} exclusion entries ignored (malformed)"` only when the count is `> 0`, with a comment explaining the deliberate no-render-at-zero choice. The existing `data-queue-summary` paragraph and its `textContent` assignment are untouched (`git diff` on that block shows no change).

## Task Commits

1. **Task 1: Count the malformed entries in derive-flagged.mjs without changing any existing return shape** - `8a7aeaec` (feat)
2. **Task 2: Render the ignored-entries line beside the queue header counts** - `7e8822a9` (feat)

_No plan-metadata commit follows per worktree-mode convention — the orchestrator commits STATE.md/ROADMAP.md after all wave agents complete; this SUMMARY.md is committed by this agent per the worktree protocol._

## Files Created/Modified
- `scripts/curate-queue/derive-flagged.mjs` - `buildExclusionsMap` extended (empty-reason + duplicate-id detection, `skippedCount`); new `countMalformedExclusions` export; zero-import/zero-console contract preserved
- `scripts/curate-queue/derive-flagged.test.mjs` - 9 new tests under `describe('countMalformedExclusions — malformed exclusion entries (D-09)', ...)`
- `scripts/curate-queue/index.ts` - `renderQueue()` imports and calls `countMalformedExclusions`; renders the new `data-queue-malformed-note` paragraph conditionally

## Decisions Made
- Kept the sibling-export approach exactly as RESEARCH.md/PATTERNS.md recommended (Open Question 2), rather than changing `deriveFlaggedActivities`'s return shape — avoids touching every existing test that destructures its `QueueRow[]` return.
- Rendered the malformed-entries line only when `count > 0` (Claude's Discretion per D-09's wording latitude), matching the plan's own stated rationale: an ordinary session (today's real 12-entry archive has 0 malformed) gains no noise.
- Left TD-03 unticked in REQUIREMENTS.md per the plan's own "TD-03 tick rule" (see Verification Evidence below) — 31-03's two sites had not landed on this branch at execution time.

## Verification Evidence (TD-03 tick-rule counts)

Per the plan's Output section, before ticking TD-03 the following three named-test counts must all be present and green:

| Site | Filter | Result |
|------|--------|--------|
| `src/dashboard/views/records-logic.test.ts -t "another guard"` (31-03) | 0 matched, 49 skipped | **NOT LANDED** on this branch |
| `scripts/compute-pr-ceiling-recount.test.mjs -t "malformed exclusion"` (31-03) | 0 matched, 59 skipped | **NOT LANDED** on this branch |
| `scripts/curate-queue/derive-flagged.test.mjs -t "malformed"` (this plan) | **9 matched, 0 failed** | Landed this plan |

Since 31-03's two sites have not landed, **TD-03 is left unticked in REQUIREMENTS.md**, as the plan's own tick rule instructs. This plan's own third of TD-03 is complete and evidenced above; the tick itself is deferred to whichever plan lands last among 31-03/31-04, per the rule.

## Recorded Evidence (per plan Output section)

- **Exact rendered string:** `"${malformedCount} exclusion entries ignored (malformed)"` — e.g. `"3 exclusion entries ignored (malformed)"` for a 3-malformed-entry document.
- **`-t "malformed"` match count in `derive-flagged.test.mjs`:** 9 passed, 0 failed (≥6 required by the plan).
- **Negative-control observation from the real archive:** the live `data/best-effort-exclusions.json` has **12 entries, 0 malformed** — confirmed via `node -e` calling `countMalformedExclusions` directly on the real file's parsed contents (worktree environment note: `npm run curate`'s browser smoke run needs `dist/widgets`, which per the worktree instructions is not copied into this bare worktree — the browser-level negative control is deferred to the orchestrator on the primary checkout; this CLI-level equivalent proves the same code path with the same input and the same expected output of 0).
- **Grep proving the bundle carries the new code:** built `scripts/curate-queue/index.ts` via `npx esbuild scripts/curate-queue/index.ts --bundle --format=iife --target=es2020 --outfile=/tmp/queue-check-31-04.js` (per the worktree's required queue-bundle build). `grep -c "data-queue-malformed-note" /tmp/queue-check-31-04.js` → 1; `grep -c "exclusion entries ignored" /tmp/queue-check-31-04.js` → 1; `grep -c "countMalformedExclusions" /tmp/queue-check-31-04.js` → 2.
- **`derive-flagged.test.mjs` full-file test count, before and after:** 25 tests before Task 1 → 34 tests after (9 added), all green.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs or missing critical functionality found; both tasks matched the plan's action items directly.

### Acceptance-Criteria Discrepancy (documented, not auto-fixed)

**1. [Not a Rule 1-3 fix — pre-existing, out-of-scope content] Task 1's acceptance criterion `grep -c "best-effort-exclusions" scripts/curate-queue/derive-flagged.test.mjs` returns 1, not 0 as literally stated**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria state this grep should return 0 ("No test in the file reads `data/best-effort-exclusions.json`"). The file already contained one reference — `EXCLUSIONS_PATH = path.resolve(REPO_ROOT, 'data/best-effort-exclusions.json')` at line 24 — predating this plan, used only by Phase 29's `describe.skipIf(...)('live archive cross-check', ...)` block (D-16, an independent-implementations cross-check against `compute-pr-ceiling-recount.mjs`, unrelated to this plan's malformed-count tests).
- **Disposition:** Not fixed. None of the 9 new tests added by this plan reference the real exclusions file (all use hand-built fixture documents, matching this file's established discipline) — the plan's underlying intent ("no NEW test reads the real file") is satisfied. Deleting or rewriting the pre-existing Phase 29 cross-check test to force the literal grep to 0 would be an out-of-scope, unrelated code change and a reduction in coverage, so it was left untouched. Recorded here rather than silently worked around.
- **Files affected:** none (no fix applied)

---

**Total deviations:** 0 auto-fixed; 1 documented acceptance-criteria discrepancy (pre-existing, out of scope).
**Impact on plan:** None on scope or correctness — both tasks' actual behavior-block requirements are fully met and verified.

## Issues Encountered

The bare worktree initially lacked `dist/` (compiled TypeScript output), causing `npm test` to fail on 6 test files with `Cannot find module '../dist/analytics/...'` errors (`compute-pace-residual.test.mjs`, `compute-pace-quality-calibration.test.mjs`, `compute-elevation-calibration.test.mjs`, `compute-pr-ceiling-calibration.test.mjs`, `compute-pr-ceiling-diff.test.mjs`, and 3 tests inside `compute-best-efforts.test.ts`) plus a `curate-server.test.mjs` timeout. This was unrelated to this plan's changes — the worktree's `data/` and `node_modules/` were set up per the worktree environment instructions, but `npm run build` (tsc compile) had not yet been run. Running `npm run build` resolved all of it; the re-run of `npm test` was 84/84 files, 2559/2559 tests passed, exit 0. This was infrastructure setup, not a deviation from the plan's task scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- This plan's third of TD-03 (the curation queue) is code-complete and fully tested; the requirement tick itself is correctly deferred to whichever plan closes last among 31-03 (records-logic + recount) and 31-04 (this plan), per the plan's own stated tick rule.
- No blockers for the docs-reconciliation wave (TD-05/TD-06) — this plan touches no generated `.planning/*.md` artifact.
- The browser-level negative control (`npm run curate` against the real archive, confirming no malformed line renders) is deferred to the orchestrator on the primary checkout, where `dist/widgets` already exists; the CLI-level equivalent (12 entries, 0 malformed, confirmed above) proves the same code path.

---
*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: scripts/curate-queue/derive-flagged.mjs
- FOUND: scripts/curate-queue/derive-flagged.test.mjs
- FOUND: scripts/curate-queue/index.ts
- FOUND: .planning/phases/31-tech-debt-closure-silent-failure-guards-docs-reconciliation/31-04-SUMMARY.md
- FOUND commit: 8a7aeaec
- FOUND commit: 7e8822a9
