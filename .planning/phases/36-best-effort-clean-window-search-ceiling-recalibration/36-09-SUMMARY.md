---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 09
subsystem: ui
tags: [records-view, best-effort, unreliable-segment, source-text-audit, review-queue, vitest]

# Dependency graph
requires:
  - phase: 36-03
    provides: "EffortContamination/ComputedEffort.contaminated, the widened EffortDemotionGuard union, VALID_DEMOTION_GUARDS's fourth member, and the deliberately-unclosed third guard home in records-logic.ts's switch"
provides:
  - "The Records screen's per-distance PR table discloses the ~1,200 moved-but-ranked efforts via a walked, document-derived count kept as its own note, never merged with the demotion sentence"
  - "The 'unreliable-segment' guard is named (not bucketed into 'other') in DemotionCounts and the shared demotion sentence, closing the third of the guard value's three required homes"
  - "A permanent source-text lockstep audit (src/analytics/effort-guard-homes.test.ts) over all three homes, proven red against each home removed individually and against a comment-only occurrence in each"
  - "D-17 evidence: the untouched Phase 29 review queue is shown by test to admit the new guard verbatim, with no allowlist and no change to any file under scripts/curate-queue/ other than its own test"
affects: [37]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A guard value's three required homes audited by extracting each home's own declaration region (balanced-brace or terminator-delimited) rather than scanning a whole file, with comments stripped before any region is located"
    - "Planted-removal audits proven red in BOTH directions (real-direction pass, three independent per-home planted failures, plus a comment-only-occurrence non-satisfaction) rather than checked only in the passing direction"
    - "Two independent Records-screen notes about two independent populations, rendered side by side with an explicit comment forbidding their merge"

key-files:
  created:
    - src/analytics/effort-guard-homes.test.ts
  modified:
    - src/dashboard/views/records-logic.ts
    - src/dashboard/views/records-logic.test.ts
    - src/dashboard/views/records.ts
    - src/dashboard/views/records.test.ts
    - scripts/curate-queue/derive-flagged.test.mjs

key-decisions:
  - "D-06/D-16/D-17 implemented as specified in 36-CONTEXT.md; no new architectural decisions required during execution"
  - "resolvePrTableContaminationNote's wording states the population precisely ('rank on a clean window after an unreliable segment was excluded from the original window') to keep the two Records notes readable as clearly separate claims when both render together"

patterns-established:
  - "missingHomes(sources, guard): a pure function over three source-text strings, usable against both real (fs-read) and planted (in-memory string-replaced) inputs, returning the list of homes missing a guard value — the shape a future 'guard has N required homes' audit in this codebase should reuse"

requirements-completed: [PR-07, PR-08]

# Metrics
duration: 15min
completed: 2026-09-28
---

# Phase 36 Plan 09: Records Disclosure, Guard Naming & Lockstep Audit Summary

**The Records screen now discloses the ~1,200 efforts that moved onto a clean window but still rank, via a walked-document count kept separate from the existing demotion sentence; the `'unreliable-segment'` guard is named in the third of its three required homes; a permanent source-text audit proves all three homes move in lockstep; and a test proves the untouched Phase 29 review queue admits the new guard verbatim.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-28T14:00Z (approx.; worktree setup and context reading preceded the first commit)
- **Completed:** 2026-09-28T14:13Z
- **Tasks:** 3 completed
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- **Task 1 — the third guard home closed.** `DemotionCounts` gained a required `unreliableSegment: number` field (placed before `other`, matching the sentence's part order). `countDemotedAtDistance`'s switch gained a named `case 'unreliable-segment':` between `'max-speed'` and `default`, leaving the `default`/`other` fallback untouched so a genuinely future guard still degrades safely. `describeDemotionCounts` gained a matching clause, inserted before the `other` clause so `other` still reads last, preserving the Phase 31 D-07 invariant that the displayed total can never exceed the sum of the parts a reader sees. `countDemotedAtDistance`'s docblock now names all three homes by file and names plan 36-09's lockstep audit as the enforcement mechanism. All 20 pre-existing `DemotionCounts` object literals across `records-logic.test.ts` were mechanically updated (via a scoped, verified regex pass — confirmed each `other:` occurrence in the file was exactly a `DemotionCounts` literal before touching it) to carry the new required field, with zero existing expected values changed.
- **Task 2 — D-16's disclosure.** `countContaminatedAtDistance` walks `Object.keys(activities)` with a plain `for` loop (never `.filter`/`.reduce`), mirroring `compute-best-efforts.ts:450-462`'s `effortsDemoted` precedent exactly, skipping owner-excluded efforts (D-10) and reading `effort.contaminated` only through `!= null` (T-28-02-A style, so a stale shard degrades to 0 rather than throwing). `resolvePrTableContaminationNote` mirrors `resolvePrTableDemotionNote`'s two `null` rules (zero count, `this-year` scope) exactly. `records.ts`'s `renderTables` computes `contaminatedCount` beside the existing `demotionCounts`; `buildPrTableSection` appends the contamination note beside the existing demotion note (both may render together — a comment states why they are never merged: two independent claims about two independent populations). A mixed-document test proves the count is exactly 1 across five effort shapes (contaminated-and-ranked, contaminated-and-excluded, contaminated-at-a-different-distance, demoted-but-not-contaminated, plain) and that `countDemotedAtDistance`'s total on the *same* document is unaffected — the two populations are independent, proven not asserted.
- **Task 3 — the lockstep audit and D-17's queue evidence.** `src/analytics/effort-guard-homes.test.ts` (new, 79 tests total in the file including inherited `row-semantics.test.ts` describes pulled in by the `stripComments` import — 22 tests belong to this file itself) extracts each home's own declaration region (the `EffortDemotionGuard` union to its terminating `;`; the `VALID_DEMOTION_GUARDS` Set literal to its terminating `;`; the per-guard `switch` block via balanced-brace matching) with comments stripped from each full source *before* any region is located. The guard list is parsed from the union's own source text (never hardcoded), pinned at length 4 today. Real direction: all three homes agree for every parsed guard. Planted direction: three separate in-memory string-replacement removals — one per home — each independently caught as exactly that home's name, proving a scanner checking only one home would still pass two of the three plants. A fourth planted group proves a guard value present only inside a comment next to each home's real declaration does not satisfy the audit. No plant ever touches disk; `git status --porcelain` on the three real source files is empty after the run. `derive-flagged.test.mjs` gained three D-17 evidence tests extending the existing D-01 describe: a lone `'unreliable-segment'` demotion produces one row with guard and reason passed through verbatim (with an explicit note that a filtered derivation would drop the row entirely, which the row-count assertion — not just the guard-string assertion — would catch); a four-guard document on one activity yields four flagged efforts (not the pre-Phase-36 three); and `buildPrefillReason` carries the new guard's line.

## Task Commits

Each task was committed atomically:

1. **Task 1: Name the new guard in the switch and the shared sentence** - `0ddfdd29` (feat)
2. **Task 2: D-16 — a walked contamination count with its own Records note** - `fee9ecec` (feat)
3. **Task 3: The three-homes lockstep audit watched RED, and D-17's queue evidence** - `4e4706d0` (test)

**Plan metadata:** this SUMMARY commit is the metadata commit; per the worktree-agent instructions, this agent does not update STATE.md/ROADMAP.md — the orchestrator does so centrally after all wave 3 worktree agents complete.

## Files Created/Modified

- `src/dashboard/views/records-logic.ts` — `DemotionCounts.unreliableSegment`, the switch's new case, `describeDemotionCounts`'s new clause, `countContaminatedAtDistance`, `resolvePrTableContaminationNote`
- `src/dashboard/views/records-logic.test.ts` — new tests for the guard case, the sentence order, the D-16 count and note, plus mechanical `unreliableSegment: 0` additions to every pre-existing `DemotionCounts` literal
- `src/dashboard/views/records.ts` — `renderTables` computes `contaminatedCount`; `buildPrTableSection` appends the contamination note beside the demotion note
- `src/dashboard/views/records.test.ts` — source-wiring assertions proving the new note/count call sites were added, not substituted
- `src/analytics/effort-guard-homes.test.ts` (new) — the three-homes lockstep audit, real and planted directions
- `scripts/curate-queue/derive-flagged.test.mjs` — three D-17 evidence tests extending the existing D-01 describe block

## Verification Evidence

- `npx tsc --noEmit` exits 0 at every task boundary and at plan completion.
- `npm test` (after `npm run build` and `npm run build-widgets` to populate this bare worktree's gitignored `dist/`) — **102/102 files, 3,796/3,796 tests pass** (this plan's own contribution: 67 tests in `records-logic.test.ts`, up from 58 pre-plan; 71 in `records.test.ts`, up from 69; a new 22-test `effort-guard-homes.test.ts`, whose reported 79 includes inherited `row-semantics.test.ts` describes pulled in by the shared `stripComments` import — the same inheritance `records.test.ts` already exhibits; 41 in `derive-flagged.test.mjs`, up from 38).
- `npx vitest run src/dashboard/views/records-logic.test.ts -t "countContaminatedAtDistance" --reporter=verbose` — **5 matched, 5 passed** (plan required at least 5, not 0).
- `git diff --stat fd25f373...HEAD -- . ':!.planning'` touches exactly the six `files_modified` files: `scripts/curate-queue/derive-flagged.test.mjs`, `src/analytics/effort-guard-homes.test.ts`, `src/dashboard/views/records-logic.test.ts`, `src/dashboard/views/records-logic.ts`, `src/dashboard/views/records.test.ts`, `src/dashboard/views/records.ts`.
- `git status --porcelain data/ src/analytics/best-effort.types.ts src/dashboard/data/best-efforts-client.ts` — empty (the audit's plants never touched disk).
- The Task 1 source-check script (case ordering, default branch preserved, clause ordering) and the Task 2 source-check script (`for` walk with no `.filter`/`.reduce`, `hasOwn`, `excludedFromRecords === true`, `contaminated != null`, both note functions exported, existing demotion-note call preserved) both passed as specified in the plan's `<verify>` blocks.
- Task 3's own verification script (`VALID_DEMOTION_GUARDS`/`EffortDemotionGuard`/`demotion.guard`/`unreliable-segment` present, `.replace` count ≥ 3, no `writeFileSync`, `derive-flagged.test.mjs` carries `unreliable-segment`/`D-17`/`buildPrefillReason`) passed.

### Per-home planted-removal observations (acceptance criterion: name all three)

- **`types` plant** (guard string removed from the `EffortDemotionGuard` union only): `missingHomes(...)` returned `['types']`. The client and records-logic homes, left untouched, both still carried the guard.
- **`client` plant** (guard string removed from `VALID_DEMOTION_GUARDS` only): `missingHomes(...)` returned `['client']`.
- **`recordsLogic` plant** (the `case 'unreliable-segment':` block removed from the switch only): `missingHomes(...)` returned `['recordsLogic']`.
- **Comment-only plants** (guard string re-inserted only inside a comment next to each home's real, guard-removed declaration): all three returned the same single-element array as their corresponding removal-only plant above — proving the comment text never satisfies the audit.

## Decisions Made

None beyond what 36-CONTEXT.md's D-06/D-16/D-17 already locked, implemented as specified. `resolvePrTableContaminationNote`'s exact wording was Claude's Discretion per D-16/D-07 (measured numbers, house register) and is documented in the frontmatter's `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built `dist/` and `dist/widgets/` to unblock the full unfiltered test suite in this bare worktree**
- **Found during:** post-Task-3 `npm test` run (the plan's own `<verification>` block requires "`npm test` is green unfiltered")
- **Issue:** This worktree has no `node_modules` (symlinked per setup) and no `dist/`/`dist/widgets/` (gitignored build output). One test file, `scripts/verify-dashboard-publish-stats.test.mjs`, failed with `ENOENT` reading `dist/widgets/data/stats/best-efforts.json` — the same environment prerequisite plan 36-03's SUMMARY already documented as its own deviation #1.
- **Fix:** Ran `npm run build` and `npm run build-widgets`. Neither writes anything git-tracked.
- **Files modified:** none (gitignored build artifacts only)
- **Verification:** `git status --short` shows no `dist/` entries before or after; `npm test` went from 100/102 files passing (1 failed suite, 1 skipped) to 102/102 files / 3,796/3,796 tests passing.
- **Committed in:** not committed (gitignored build output, not part of any task commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking, a mechanical consequence of this worktree's bare state, already documented as a recurring pattern by plan 36-03 in the same phase).
**Impact on plan:** No production code change. The build step is a worktree-environment prerequisite for running the full suite, not a code change; the plan's own three task-level `<verify>` blocks (which target specific test files rather than `npm test`) all passed without it.

## Issues Encountered

None beyond the one deviation above, resolved without any design change.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. All STRIDE dispositions from the plan's own threat register (T-36-47 through T-36-53) are satisfied by the implementation as specified: the lockstep audit mitigates T-36-47 (proven by three independent planted removals, not just the passing direction); comment-stripping mitigates T-36-48 (proven by the comment-only planted group); the walked, own-note contamination count mitigates T-36-49/T-36-50 (source-checked to be a plain `for` walk, and `records.test.ts` proves the call sites exist without substituting the demotion note); the two-notes-never-merged design and the independent-populations test mitigate T-36-51; the D-17 evidence tests mitigate T-36-52; the `!= null` read plus the stale-shard test mitigate T-36-53 (denial of service). No new network endpoint, auth path, file-access pattern, or schema-boundary change was introduced beyond what the threat model already scoped — this plan added no package and no network route.

## Next Phase Readiness

- The `'unreliable-segment'` guard value's three required homes are now all closed and proven to move in lockstep by a permanent, CI-running audit — a fifth guard added to the union in a future phase is audited automatically by `effort-guard-homes.test.ts` with no companion edit needed in that file.
- The Records screen's disclosure of the phase's largest ranking effect (the ~1,200 moved-but-ranked efforts) is live and tested; nothing further is needed from this plan's scope for that population to be visible to a reader.
- D-17's evidence is recorded: the Phase 29 review queue admits the new guard through its existing guard-agnostic path with zero change to any file under `scripts/curate-queue/` other than its own test file, as the phase's own scoping required. Phase 37's queue-reordering-by-guard work (explicitly deferred per 36-CONTEXT.md) has a clean, tested foundation to build on.
- No blockers for the phase's remaining plans or for Phase 37.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: src/dashboard/views/records-logic.ts
- FOUND: src/dashboard/views/records-logic.test.ts
- FOUND: src/dashboard/views/records.ts
- FOUND: src/dashboard/views/records.test.ts
- FOUND: src/analytics/effort-guard-homes.test.ts
- FOUND: scripts/curate-queue/derive-flagged.test.mjs
- FOUND: commit 0ddfdd29
- FOUND: commit fee9ecec
- FOUND: commit 4e4706d0

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*
