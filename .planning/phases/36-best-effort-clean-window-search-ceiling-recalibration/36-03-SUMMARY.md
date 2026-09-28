---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 03
subsystem: analytics
tags: [best-effort, record-shape, typescript, vitest, browser-parser, clean-window-search]

# Dependency graph
requires:
  - phase: 36-02
    provides: "findBestEffort's zero-copy {startIndex, endIndex} bound and RawEffort.startIndex/.endIndex, the primitive plan 36-04's partition-and-search step consumes"
provides:
  - "EffortDemotionGuard widened to include 'unreliable-segment', with its docblock naming all three required homes and plan 36-09's lockstep audit"
  - "EffortContamination interface (six locked fields, guard narrowed to the single literal) and ComputedEffort.contaminated: EffortContamination | null as a required additive sibling to demotion"
  - "D-08's precedence prose (clean-window search resolves the input FIRST, not a fourth guard) recorded in ComputedEffort.demotion's docblock, including the measured 0-of-440 no-clean-window-and-independently-implausible finding"
  - "The whole tree carries the new required field through every construction site the compiler and the test runner named"
  - "A total, never-throwing parseContaminated in the browser client, and VALID_DEMOTION_GUARDS widened to its fourth member"
affects: [36-04, 36-05, 36-06, 36-07, 36-08, 36-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive document field with no BEST_EFFORTS_SCHEMA_VERSION bump, mirroring the totals.effortsDemoted/ceilings precedent"
    - "A guard value's three required homes (union → browser allowlist → records-view switch) named explicitly in each home's own comment, not just the union's"
    - "Browser-side total parser strengthens its own field's numeric checks (Number.isFinite) beyond the sibling field's checks, with the reason stated in a comment"

key-files:
  created: []
  modified:
    - src/analytics/best-effort.types.ts
    - src/analytics/compute-best-efforts.ts
    - src/analytics/compute-best-efforts.test.ts (read; no construction site found requiring a change)
    - src/analytics/compute-age-grading.test.ts (compiler-named, not in the plan's predicted file list)
    - src/analytics/compute-dashboard-index.test.ts
    - src/dashboard/data/best-efforts-client.ts
    - src/dashboard/data/best-efforts-client.test.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/views/records-logic.test.ts

key-decisions:
  - "D-05/D-06/D-08 (per 36-CONTEXT.md, implemented not re-litigated here): contaminated is a sibling field, never a fourth demotion guard on a ranked effort — recorded in the docblock as the compute-best-efforts.ts:304 byDistance mechanism, not a style preference"
  - "The plan's own files_modified list is a best-effort prediction, not the contract (its own words) — the actual compiler/test worklist additionally named compute-age-grading.test.ts, and additionally required a fixture fix in best-efforts-client.test.ts (validShard) one task earlier than that file's own Task 3 slot, documented below as a deviation"

patterns-established:
  - "A required (never optional) additive sibling field forces every construction site to be listed and fixed explicitly — the plan's own bet that a compile error is safer than a silent undefined"

requirements-completed: [PR-07]

# Metrics
duration: 13min
completed: 2026-09-28
---

# Phase 36 Plan 03: Contaminated Record Shape & Browser Admission Summary

**`ComputedEffort` gains a required `contaminated: EffortContamination | null` sibling field (six locked fields, guard narrowed to the literal `'unreliable-segment'`), `EffortDemotionGuard` widens to a fourth member with D-08's precedence prose recorded in the `demotion` docblock, the whole tree compiles and tests green with the new field carried through every construction site, and the browser's `best-efforts-client.ts` parses and admits both new surfaces totally and without throwing.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-09-28T15:52Z (first task commit; worktree setup preceded this)
- **Completed:** 2026-09-28T15:56Z
- **Tasks:** 3 completed
- **Files modified:** 9

## Accomplishments

- `EffortDemotionGuard` widened to `'world-record' | 'max-speed' | 'ceiling' | 'unreliable-segment'`, its docblock naming what the new member means and all three required homes (the union itself, `VALID_DEMOTION_GUARDS`, and `records-logic.ts`'s per-guard switch) plus plan 36-09's lockstep audit as the enforcement mechanism.
- New `EffortContamination` interface: `guard` narrowed to the single literal `'unreliable-segment'` (not the full union — only this one guard can produce the record), `reason: string`, and four numeric fields (`durationSec`, `paceSecPerKm`, `startOffsetSec`, `endOffsetSec`) describing the ORIGINAL unpartitioned window.
- `ComputedEffort.contaminated: EffortContamination | null` added as a required (never optional) additive sibling to `demotion`. Its docblock states the no-schema-bump rule, the at-most-one-per-distance consequence for the four existing `.find()` sites, and — as a mechanism, not an opinion — why a sibling field is the only safe shape: `compute-best-efforts.ts`'s Pass-1 accumulator skips any effort whose `demotion !== null` from `byDistance`, so a fourth-guard shape would drop a genuinely clean time out of the ceiling's population.
- `ComputedEffort.demotion`'s docblock extended with D-08's four-point precedence paragraph: the clean-window search resolves which duration reaches `isPlausible`/`ceilingDemotion` and runs conceptually before them; when a clean window exists those guards evaluate only the clean figure; when none exists `demotion` is set once directly; and the measured reachability is stated plainly — 0 of 440 no-clean-window occurrences (2026-09-28 sweep, 1,874 activities × 7 distances) independently fail an absolute guard, so that branch is defensive code with no real fixture and no synthetic look-alike was built for it (Pitfall 12).
- `compute-best-efforts.ts`'s single `efforts.push({...})` site gained exactly one line, `contaminated: null,`, with a one-line comment naming plan 36-04 as the plan that replaces the placeholder with the real search.
- Every construction site the compiler and the full test suite named received a mechanical `contaminated: null` addition on its BASE object (never an individual override), with zero existing test names or expected values changed and zero `toMatchObject` introduced.
- The browser's `best-efforts-client.ts` gained a total, never-throwing `parseContaminated` mirroring `parseDemotion`'s structure exactly, but with `Number.isFinite` checks on all four numeric fields — deliberately stronger than `parseEffort`'s own `typeof`-only checks, since these four numbers render beside a ranked figure and a `NaN` would read as a measurement. `VALID_DEMOTION_GUARDS` gained its fourth member with a comment naming it as the second of the guard's three required homes.
- 8 new tests added to `best-efforts-client.test.ts`: stale-shard-no-key degrade, three malformed-value-type degrades (string/array/`0`), wrong-guard degrade, whole-record NaN degrade, a well-formed six-field round-trip, and the admitted-guard case (a `demotion` carrying `guard: 'unreliable-segment'` parses through) proven alongside the existing `'not-a-real-guard'` unknown-guard case staying green — both directions demonstrated in the same file.

## Task Commits

Each task was committed atomically:

1. **Task 1: EffortContamination, ComputedEffort.contaminated, the widened guard union and D-08's precedence prose** - `25638025` (feat)
2. **Task 2: Carry the new required field through every construction site the compiler names** - `fda247be` (feat)
3. **Task 3: parseContaminated and the fourth VALID_DEMOTION_GUARDS member, with degrade-not-throw cases** - `d3fb27e1` (feat)

**Plan metadata:** this SUMMARY commit is the metadata commit; per the worktree-agent instructions, this agent does not update STATE.md/ROADMAP.md — the orchestrator does so centrally after merge.

## Files Created/Modified

- `src/analytics/best-effort.types.ts` — `EffortDemotionGuard` widened, `EffortContamination` declared, `ComputedEffort.contaminated` added, `ComputedEffort.demotion`'s docblock extended with D-08's precedence
- `src/analytics/compute-best-efforts.ts` — the single `efforts.push({...})` construction site gains the `contaminated: null` placeholder, commented as plan 36-04's worklist item
- `src/analytics/compute-age-grading.test.ts` — 4 inline effort literals (no shared factory in this file) gained `contaminated: null` beside each `demotion: null` — named by the compiler, NOT in the plan's own `files_modified` prediction
- `src/analytics/compute-dashboard-index.test.ts` — 3 inline effort literals gained `contaminated: null`
- `src/dashboard/views/records-logic.test.ts` — `fixtureEffort`'s shared BASE object gained `contaminated: null`
- `src/dashboard/views/detail-best-efforts-logic.test.ts` — `effort()`'s shared BASE object gained `contaminated: null`
- `src/dashboard/data/best-efforts-client.ts` — `parseContaminated` added, `VALID_DEMOTION_GUARDS` widened to 4 members, `parseEffort` wired to call `parseContaminated`
- `src/dashboard/data/best-efforts-client.test.ts` — shared `validShard` fixture gained `contaminated: null` (pulled forward from Task 3 into Task 2's commit — see Deviations); 8 new test cases added in Task 3

## Verification Evidence

- `npx tsc --noEmit` exits 0 at every task boundary.
- `npm test` — **101/101 files, 3,698/3,698 tests pass** (baseline: 101 files / 3,676 tests as of 2026-09-28; net +22 tests, of which 8 are this plan's new `best-efforts-client.test.ts` cases and the rest are pre-existing tests this worktree could not see until `dist/` and `dist/widgets/` were built — see Deviations).
- `npx vitest run src/dashboard/data/best-efforts-client.test.ts --reporter=verbose` — **23/23 tests pass** (up from 15 pre-change, +8, exceeding the plan's required +6 minimum).
- `git diff` for `src/analytics/best-effort.types.ts` contains no occurrence of `BEST_EFFORTS_SCHEMA_VERSION` (confirmed via `grep`, not just the automated Task 1 assertion) — the schema-version constant's own comment is referenced in prose but the identifier itself was deliberately not repeated, to keep this exact check true.
- `git status --porcelain data/` — empty at every checkpoint.
- `git diff -U0` (Task 2's cumulative check) contains zero `toMatchObject` occurrences.
- `parseContaminated`'s body contains no `throw`, does not reference `VALID_DEMOTION_GUARDS`, and pins `guard` to the single literal via `guard !== 'unreliable-segment'`.

## Decisions Made

None beyond what 36-CONTEXT.md/36-RESEARCH.md/36-PATTERNS.md already locked (D-05, D-06, D-08 implemented as specified). No new architectural decisions were required during execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built `dist/` and `dist/widgets/` to unblock the full test suite in this bare worktree**
- **Found during:** Task 2's verification (`npm test`)
- **Issue:** This worktree has no `node_modules` (symlinked per setup instructions) and no `dist/` (a gitignored build output). 16 of 101 test files failed with `Cannot find module '../dist/analytics/...'` — every `scripts/*.mjs` recount/calibration script imports compiled output from `dist/`, not `src/`. One further file, `scripts/verify-dashboard-publish-stats.test.mjs`, needed `dist/widgets/index.html` to exist to not skip-and-then-fail on a missing shadow-tree source.
- **Fix:** Ran `npm run build` (produces `dist/`) and `npm run build-widgets` (produces `dist/widgets/`, copying `data/` into it). Neither writes anything git-tracked — `dist/*` is gitignored except a single `dist/widgets/test.html`, confirmed via `git status --short` showing zero `dist/` entries before and after.
- **Files modified:** none (build artifacts only, gitignored)
- **Verification:** `git status --short` shows no `dist/` changes; `npm test` went from 16 failing files (unrelated to this plan's diff) to 101/101 passing.
- **Committed in:** not committed (gitignored build output, not part of any task commit)

**2. [Rule 3 - Blocking] Added `contaminated: null` to `best-efforts-client.test.ts`'s shared `validShard` fixture one task earlier than its own Task 3 slot**
- **Found during:** Task 2's verification (`npm test`)
- **Issue:** After Task 1 made `contaminated` a required field on `BestEffort`, three `toEqual(validShard)` assertions in `best-efforts-client.test.ts` (a file the plan's frontmatter lists under Task 3, not Task 2) started failing at runtime — `validShard` is an untyped object literal, so `tsc --noEmit` could not catch the mismatch; only `npm test` surfaced it. Task 2's own acceptance criteria require the full suite green at that task's boundary.
- **Fix:** Added `contaminated: null,` to the base `validShard.efforts[0]` object in the Task 2 commit. Task 3 (its rightful owner per the plan's file list) then added its own 8 new test cases on top of the same fixture, unaffected by this one-line pull-forward.
- **Files modified:** `src/dashboard/data/best-efforts-client.test.ts`
- **Verification:** `npm test` green after Task 2's commit; Task 3's own verification (23/23 in the file, +8 over the corrected 15-test pre-Task-3 baseline) passed afterward with no further changes needed to this fixture.
- **Committed in:** `fda247be` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues, both mechanical consequences of this worktree's bare state and of the plan's own required-field design, not scope creep).
**Impact on plan:** Neither deviation touches production behavior beyond what the plan specified. The `dist/`/`dist/widgets/` build is a worktree-environment prerequisite, not a code change. The `validShard` fixture fix is the same one-line mechanical addition Task 3 would have needed anyway, applied one commit earlier to keep Task 2's own green-suite acceptance criterion true.

## Issues Encountered

None beyond the two deviations above, both resolved without design changes.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. All threat-model dispositions from the plan's own STRIDE register (T-36-09 through T-36-13) are satisfied by the implementation as specified: `parseContaminated` is total and never throws (T-36-09); all four numeric fields use `Number.isFinite` with whole-record rejection (T-36-10); the allowlist admits the new guard with the can-fail unlisted-guard case still green (T-36-11); the sibling shape's rationale is recorded as the `byDistance` mechanism, not an opinion (T-36-12); no existing exact assertion was weakened — zero `toMatchObject` introduced (T-36-13). No new network endpoint, auth path, file-access pattern, or schema-boundary change was introduced beyond what the threat model already scoped.

## Next Phase Readiness

- The locked record shape (`EffortContamination`, `ComputedEffort.contaminated`, the four-member `EffortDemotionGuard` union, D-08's precedence prose) is exactly what plans 36-04 (segment-aware search), 36-08 (detail view) and 36-09 (records view) consume in the next wave — no renegotiation possible per this plan's own downstream contract note.
- `compute-best-efforts.ts`'s `contaminated: null` placeholder is explicitly commented as plan 36-04's worklist item — the next plan replaces exactly that one line with the real clean-window search wiring, nothing else in this file needs to change first.
- The browser's admission path (`parseContaminated`, the widened `VALID_DEMOTION_GUARDS`) is ready to receive real shard data from 36-04 onward with no further browser-side changes required for the shape itself.
- `records-logic.ts`'s per-guard switch (the THIRD of the guard's three required homes) is NOT yet updated — it still buckets `'unreliable-segment'` into `other`. This is explicitly out of this plan's scope (Task 1's docblock names it as plan 36-09's responsibility) and is not a gap: no shipped code path in this plan or its dependents constructs a `demotion.guard === 'unreliable-segment'` value yet (the placeholder in `compute-best-efforts.ts` is always `contaminated: null`, and no `demotion` construction site was touched), so nothing is silently mis-bucketed today.
- No blockers for 36-04.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: src/analytics/best-effort.types.ts
- FOUND: src/analytics/compute-best-efforts.ts
- FOUND: src/analytics/compute-age-grading.test.ts
- FOUND: src/analytics/compute-dashboard-index.test.ts
- FOUND: src/dashboard/data/best-efforts-client.ts
- FOUND: src/dashboard/data/best-efforts-client.test.ts
- FOUND: src/dashboard/views/detail-best-efforts-logic.test.ts
- FOUND: src/dashboard/views/records-logic.test.ts
- FOUND: commit 25638025
- FOUND: commit fda247be
- FOUND: commit d3fb27e1

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*
