---
phase: 24-local-curation-mode
plan: 16
subsystem: testing
tags: [vitest, typescript, refactor, source-structure-guard, exclusion-logic]

# Dependency graph
requires:
  - phase: 24-local-curation-mode
    provides: "24-13's buildPrBadgeLabels(entry, liveExclusions) REQUIRED second parameter and buildBestEffortsPanelRows's isPr = wasPRAtTheTime && !excluded, both fed from detail.ts's single Promise.all (GAP-24-04/WR-05 fix)"
provides:
  - "resolveExcluded — the single exported definition of 'is this effort excluded right now', called by both buildPrBadgeLabels and buildBestEffortsPanelRows instead of two verbatim ternary copies"
  - "A 12-combination non-divergence table proving the header PR set and panel isPr set agree in every reachable (wasPRAtTheTime x excludedFromRecords x liveExclusions) state"
  - "Source-structure pins in curation-seam.test.ts on both call sites inside mountBestEffortsAndBadges, asserting they share the SAME final-argument (liveExclusions) and first-argument (bestEffortsEntry) identifiers"
  - "Observed, quoted proof that tsc --noEmit cannot catch the WR-17 divergence mutation, closing GAP-24-05 item 3"
affects: [24-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared derivation helper (resolveExcluded) replacing two verbatim ternary copies, to remove the copy-paste divergence mechanism WR-17 identified"
    - "Source-structure regression pins using anchored identifier-class regex capture (not substring matching) so a literal null/undefined/new Map() at a call site fails the match outright"

key-files:
  created: []
  modified:
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
    - src/dashboard/curation-seam.test.ts
    - .planning/phases/24-local-curation-mode/deferred-items.md

key-decisions:
  - "resolveExcluded is typed with a structural { excludedFromRecords: boolean } effort parameter rather than the full BestEffort type, per the plan's interface spec, so it stays callable from a test with a minimal literal"
  - "The 12-combination table intentionally asserts cross-call-site AGREEMENT (buildPrBadgeLabels's derived set vs. buildBestEffortsPanelRows's derived set, and each against resolveExcluded's own answer) rather than an independently-hardcoded expected value per combination — this is what the <behavior> spec itself defines, and it is why the table did not fail under Task 1(e)'s resolveExcluded-body mutation (see Deviations)"

patterns-established:
  - "Pattern: when two call sites must never diverge, pin their SHARED identifier (not just their arity) via anchored regex capture-group comparison, so a future edit that swaps in a literal or a different variable at only one site fails the guard outright"

requirements-completed: [CUR-01]

# Metrics
duration: ~35min
completed: 2026-09-02
---

# Phase 24 Plan 16: Extract resolveExcluded and pin the WR-17 call-site divergence Summary

**One exported `resolveExcluded` helper replaces two verbatim exclusion ternaries in `detail-best-efforts-logic.ts`, backed by a 12-combination non-divergence table and source-structure pins in `curation-seam.test.ts` proving `buildPrBadgeLabels` and `buildBestEffortsPanelRows` share the same `liveExclusions` binding — closing WR-17 / GAP-24-05 item 3.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-02T13:45:42Z
- **Tasks:** 2 completed
- **Files modified:** 3 (plus deferred-items.md, a standing project-convention log, not part of `files_modified`)

## Accomplishments

- Extracted `export function resolveExcluded(liveExclusions, activityId, distance, effort)` as the sole definition of exclusion state; both `buildPrBadgeLabels` and `buildBestEffortsPanelRows` now call it instead of repeating the four-line ternary. `isExcluded(` now occurs exactly once in the file (inside `resolveExcluded`'s own body); `resolveExcluded(` occurs exactly 3 times (1 declaration + 2 call sites).
- Added 6 `resolveExcluded` unit cases and a 12-combination behavioural table (`wasPRAtTheTime x excludedFromRecords x liveExclusions` state) to `detail-best-efforts-logic.test.ts`, proving the header PR set (parsed back from `buildPrBadgeLabels`'s labels) equals the panel `isPr` set (from `buildBestEffortsPanelRows`) in every reachable state, and that each row's own `excluded` field equals `resolveExcluded`'s answer rather than a re-derivation. All 44 tests pass (26 pre-existing + 18 new), including the pre-existing `R19 mirror-image` case, with **no edit to any existing expectation**.
- Added a `WR-17 — both derivations are pinned to the same liveExclusions binding` describe block to `curation-seam.test.ts` (5 new tests, 84 total): exactly-one-call-site pin on `buildPrBadgeLabels(bestEffortsEntry, liveExclusions)`, the literal three-argument `buildBestEffortsPanelRows` form, an anchored-regex identifier-equality pin proving both calls inside `mountBestEffortsAndBadges` receive the SAME final argument (and first argument), a single-definition pin on `detail-best-efforts-logic.ts`, and a required-parameter (non-optional, non-defaulted) pin.
- Per D-11, both mutations were observed RED before being wired in / accepted as passing, then reverted with `cmp` byte-identity confirmation — see below.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract resolveExcluded as the single definition, and pin non-divergence behaviourally** - `945ec20` (refactor)
2. **Task 2: Pin both call sites and their shared liveExclusions binding, observed red against the WR-17 divergence mutation** - `06440ec` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update, applied by the orchestrator after merge — this plan ran in worktree isolation, so STATE.md/ROADMAP.md are not touched here)

## Files Created/Modified

- `src/dashboard/views/detail-best-efforts-logic.ts` — added `resolveExcluded`; both `buildPrBadgeLabels` and `buildBestEffortsPanelRows` call it; both docblocks amended to cite the shared helper instead of the shape-sameness claim WR-17 rejected
- `src/dashboard/views/detail-best-efforts-logic.test.ts` — new `WR-17` describe block: 6 `resolveExcluded` unit cases + 12-combination non-divergence table (18 new tests, additive only)
- `src/dashboard/curation-seam.test.ts` — new `WR-17` describe block: 5 source-structure pins on both call sites and their shared binding (additive only)
- `.planning/phases/24-local-curation-mode/deferred-items.md` — logged this plan's confirmation of the pre-existing worktree `data/stats`/`chartjs-plugin-zoom` ENOENT gap, matching the pattern every prior Phase 24 plan recorded

## Decisions Made

- The 12-combination table asserts cross-call-site agreement (and agreement with `resolveExcluded`'s own answer), not an independently-hardcoded expected value per combination — this is exactly what the plan's `<behavior>` block specifies, and explains why this table stayed green under Task 1(e)'s resolveExcluded-body mutation (documented under Deviations, not a defect).
- `resolveExcluded`'s `effort` parameter kept structurally typed (`{ excludedFromRecords: boolean }`) rather than the full `BestEffort` interface, per the plan's stated interface, so it stays callable from a test with a minimal literal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docblock illustrative snippets initially left two stray `isExcluded(`/`resolveExcluded(` textual occurrences, failing the plan's own grep-count acceptance criteria**
- **Found during:** Task 1, verification step (running the acceptance-criteria greps immediately after the edit)
- **Issue:** The first draft of both docblocks (for `buildPrBadgeLabels` and `buildBestEffortsPanelRows`) illustrated the derivation with an inline `resolveExcluded(liveExclusions, entry.activityId, distance, effort)` call-syntax snippet, and `resolveExcluded`'s own docblock illustrated its body with an inline `isExcluded(liveExclusions, activityId, distance)` snippet. Since the acceptance criteria count raw textual occurrences of `isExcluded(` and `resolveExcluded(` in the file (not parsed AST), these illustrative comments pushed the counts to 2 and 5 respectively instead of the required 1 and 3.
- **Fix:** Reworded all three illustrative comments to describe the delegation in prose ("derived via `resolveExcluded`", "delegated to `isExcluded`, keyed on...") without reproducing the call syntax with a trailing paren.
- **Files modified:** `src/dashboard/views/detail-best-efforts-logic.ts`
- **Verification:** `grep -c 'isExcluded('` returns 1; `grep -c 'resolveExcluded('` returns 3
- **Committed in:** `945ec20` (Task 1 commit)

**2. [Deferred item, not a defect] Task 1(e)'s wrong-body mutation did not fail the 12-combination table, contrary to the plan action's parenthetical prediction ("expect ... several of the 12 table rows")**
- **Found during:** Task 1, step (e) (the D-11 RED observation)
- **Analysis:** The table (per the `<behavior>` spec's own literal definition) compares `buildPrBadgeLabels`'s derived distance set against `buildBestEffortsPanelRows`'s derived distance set, and separately checks `rows[0].excluded === resolveExcluded(...)` — i.e. it is a CROSS-CALL-SITE agreement guard, not an independently-derived correctness guard on `resolveExcluded`'s own logic. A resolveExcluded-body mutation (`return effort.excludedFromRecords` unconditionally, ignoring `liveExclusions`) is applied symmetrically inside BOTH `buildPrBadgeLabels` and `buildBestEffortsPanelRows` (they call the same function), so both derivations compute the identical WRONG answer and the table's own cross-checks are satisfied trivially — by design, this table cannot distinguish "correct" from "consistently wrong." This is not a flaw in the guard: it is precisely the boundary the plan draws between Task 1's per-function correctness tests (the 6 direct `resolveExcluded` unit cases, which DO fail under this mutation — see verbatim output below) and Task 2's cross-file divergence guard (which targets exactly this class of symmetric-vs-asymmetric bug and does fail, per Task 2's own D-11 observation).
- **Action:** No code change — this is a documented finding, not a bug. Recorded here per the plan's instruction to record the mutation, failure output and revert verbatim.
- **Files affected:** none (observation only)

---

**Total deviations:** 1 auto-fixed (Rule 1, cosmetic grep-count mismatch), 1 documented finding (not a defect)
**Impact on plan:** No scope creep. Both deviations were caught and resolved/documented during the plan's own verification steps, before commit.

## D-11 RED Observations (verbatim, as required by `<output>`)

### Task 1(e) — resolveExcluded wrong-body mutation

Mutation applied to `src/dashboard/views/detail-best-efforts-logic.ts` (temporary, reverted before commit):

```ts
export function resolveExcluded(...): boolean {
  // WR-17 D-11 mutation (temporary, task 1(e)): deliberately wrong body,
  // ignores liveExclusions unconditionally. Reverted before commit.
  return effort.excludedFromRecords;
}
```

`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` result: **11 of 44 tests failed**, 33 passed:

- 3 pre-existing `GAP-24-01` cases failed (live-index-wins, loaded-and-empty-overrides-stale-true, distance-scoped read tolerance) — these test real exclusion behaviour and correctly caught the mutation.
- 6 pre-existing `WR-05` cases failed (post-Save suppression, distance-scoped suppression, `R19 mirror-image`, the `PRExcluded` R15-contradiction reproduction, `isPr` suppression, `isPr` NOT-over-suppressed) — same reason.
- 2 of the 6 new `resolveExcluded` direct unit cases failed: `'a loaded-and-empty live index overrides a stale-true precomputed flag'` (expected `false`, received `true`) and `"an 'all' live entry excludes regardless of a false precomputed flag"` (expected `true`, received `false`).
- The remaining 4 new `resolveExcluded` unit cases and all 12 non-divergence table rows stayed green — expected, per the cross-call-site-agreement design explained under Deviations above.

Mutation reverted via `cp` from a scratchpad backup taken before the edit; `cmp` confirmed byte-identical to the pre-mutation file; `npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` re-run green at 44/44 immediately after, including a passing `R19 mirror-image` test.

### Task 2(f) — detail.ts WR-17 divergence mutation

Mutation applied to `src/dashboard/views/detail.ts` (temporary, reverted before commit): `buildPrBadgeLabels(bestEffortsEntry, liveExclusions)` changed to `buildPrBadgeLabels(bestEffortsEntry, null)`; the panel call left untouched.

1. **`npx tsc --noEmit` → exit 0.** This confirms WR-17's central claim: the type checker is blind to a `buildPrBadgeLabels(entry, null)` call site sitting next to a correctly-wired `buildBestEffortsPanelRows(entry, ageGrading, liveExclusions)` call — both are individually well-typed, so nothing in the type system can flag the divergence.

2. **`npx vitest run src/dashboard/curation-seam.test.ts` → non-zero exit, 2 of 84 tests failed:**

   ```
   FAIL src/dashboard/curation-seam.test.ts > WR-17 — both derivations are pinned to the same liveExclusions binding > detail.ts contains exactly one buildPrBadgeLabels( call site, in the literal two-argument form
   AssertionError: expected '\n\nimport type { DashboardView, Vie…' to contain 'buildPrBadgeLabels(bestEffortsEntry, …'
   - Expected: buildPrBadgeLabels(bestEffortsEntry, liveExclusions)

   FAIL src/dashboard/curation-seam.test.ts > WR-17 — both derivations are pinned to the same liveExclusions binding > both call sites inside mountBestEffortsAndBadges receive the SAME final-argument identifier
   AssertionError: buildPrBadgeLabels's final argument ('null') must equal buildBestEffortsPanelRows's final argument ('liveExclusions'): expected 'null' to be 'liveExclusions'
   Expected: "liveExclusions"
   Received: "null"
   ```

3. **`npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts` → still exit 0, 44/44 pass.** This matters because it demonstrates WHY the seam pins in `curation-seam.test.ts` are needed in addition to Task 1's behavioural table: the mutation lives entirely inside `detail.ts`'s call-site wiring, which `detail-best-efforts-logic.ts` and its test file never read — a purely-behavioural guard over the shared `resolveExcluded` function cannot see a call-site wiring regression in a completely different file. Only a source-structure guard reading `detail.ts` itself (as `curation-seam.test.ts` does) can catch it.

Mutation reverted via `cp` from a scratchpad backup taken before the edit; `cmp` confirmed byte-identical; `git status --porcelain src/dashboard/views/detail.ts` produced no output; `find` confirmed no `detail.ts.orig` file anywhere in the repo. `npx vitest run src/dashboard/curation-seam.test.ts` (84/84), `npx tsc --noEmit` (exit 0), `npm test` (0 assertion failures, 1400/1400 executed tests pass — same pre-existing 6-file ENOENT gap as every prior Phase 24 plan), and `npm run build` (exit 0) all re-ran clean after the revert.

## Confirmation: no existing expectation was edited

`git diff` (Task 1 commit) against `src/dashboard/views/detail-best-efforts-logic.test.ts` shows only two deleted lines, both import-statement lines (widening the import to add `resolveExcluded` and `DISTANCE_DISPLAY_NAMES`) — zero deleted `expect(` lines. Every pre-existing `GAP-24-01`, `WR-05` (including `R19 mirror-image`), `buildPrBadgeLabels` and `buildBestEffortsPanelRows` test case is unchanged and green.

## Issues Encountered

None beyond the two items recorded under Deviations above, both resolved/documented during verification.

## Threat Model Coverage

All six `mitigate`-disposition threats from the plan's threat register are addressed:

- **T-24-16-01** (call-site divergence): closed by `curation-seam.test.ts`'s identifier-equality pin, observed RED against the exact mutation.
- **T-24-16-02** (ternary drift): closed — `resolveExcluded(` = 3, `isExcluded(` = 1, `liveExclusions !== null` = 1.
- **T-24-16-04** (false PR claim on an excluded run): closed by the 12-combination table.
- **T-24-16-05** (null-as-not-excluded): closed — `resolveExcluded`'s null branch preserved verbatim, pinned by 2 direct unit cases plus the required (non-optional) parameter guard.
- **T-24-16-06** (mutation left in working tree): closed — both mutations reverted with `cmp` byte-identity and `git status --porcelain` confirmation.
- **T-24-16-SC** (package installs): no packages installed; `git diff --stat` across both commits lists no `package.json`/`package-lock.json` changes.

T-24-16-03 (accept disposition, SOURCE TEXT SHAPE limitation) required no code change — the file's existing docblock disclaimer stands, and this SUMMARY records (per the plan's `<output>` requirement) that `detail-best-efforts-logic.test.ts` stayed green under Task 2's `detail.ts` mutation, making the structural-vs-behavioural split explicit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-17 / GAP-24-05 item 3 is closed on the same evidentiary standard as GAP-24-04 (WR-05): behavioural proof (Task 1's table) plus source-structure proof (Task 2's pins), both observed RED before being trusted, per D-11.
- This plan's scope was exactly item 3 of the amended GAP-24-05. Plans 24-15 (item 1, browser-row coverage) and 24-17 (the closing Wave 10 checkpoint that disposes CUR-01 and the Phase 24 gate) are the remaining items in this gap-closure round — 24-17 is `autonomous: false` and depends on both 24-15 and 24-16 landing first.
- No blockers. `npm test`, `npx tsc --noEmit` and `npm run build` all exit 0 on this plan's final state; the only non-green signal is the pre-existing, out-of-scope 6-file worktree ENOENT gap (documented in `deferred-items.md`, expected to resolve on merge into the main checkout where `data/stats/*.json` and `node_modules/chartjs-plugin-zoom` already exist).

---
*Phase: 24-local-curation-mode*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: `.planning/phases/24-local-curation-mode/24-16-SUMMARY.md`
- FOUND: commit `945ec20` (Task 1)
- FOUND: commit `06440ec` (Task 2)
- FOUND: commit `cc08072` (this SUMMARY, verified post-hoc by re-checking `git log` after amendment below)
