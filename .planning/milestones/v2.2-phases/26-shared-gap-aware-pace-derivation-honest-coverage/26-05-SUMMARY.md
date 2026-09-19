---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 05
subsystem: analytics
tags: [pace-derivation, vitest, audit, ci-guard, single-source]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "pace-derivation.ts collapsed to the single stream-pace implementation (26-02/26-04), the cross-plan integration repair that fixed the last known second locus (26-INTEGRATION-FIX.md, f32dddd8)"
provides:
  - "src/analytics/pace-single-source.test.ts — a permanent, CI-running audit proving zero stream-derived per-sample pace arithmetic exists outside pace-derivation.ts, non-vacuously (false-positive sites named and present-but-unflagged), with the derivation's test-only override surface confined to pace-derivation.ts/*.test.ts"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure scanner + separate never-throwing recursive readdirSync walk (curation-guard.mjs's shape), taking a file list as an argument rather than reading disk inside the scanner — makes a planted-violation test permanent and in-suite rather than a one-off"
    - "Comment-stripping is necessary but not sufficient for a self-immune audit: the audit's own docblock is stripped by stripComments, but its own BANNED_LITERALS array and synthetic test fixtures hold the same strings as STRING LITERALS (test data), which stripComments cannot and must not touch — the audit allow-lists its own file path alongside pace-derivation.ts"
    - "Call-site vs. type-annotation disambiguation for a literal-string scan: windowSec:/pauseRule: are valid TS type-annotation grammar (windowSec: number) as well as valid object-literal call-site keys (windowSec: 40) — a bare substring scan cannot tell them apart, so the scanner excludes matches followed by number/string/boolean (TS's own type-keyword grammar), the one ambiguous real case in this codebase (detail-charts-logic.ts's derivePaceSeries wrapper)"

key-files:
  created:
    - src/analytics/pace-single-source.test.ts
  modified: []

key-decisions:
  - "Extended the audit beyond the plan's literal two-literal BANNED_LITERALS spec to also confine gapIntervals.some(/.find( call sites (GAP_MEMBERSHIP_LITERALS) to pace-derivation.ts/*.test.ts, because the real cross-plan violation this phase produced (26-INTEGRATION-FIX.md, commit f32dddd8, detail-zones.ts's maskedPaceSeries) contained NO dt/dd division at all — it was a duplicated gap-interval MEMBERSHIP TEST, not duplicated arithmetic. The plan's own two banned literals would have passed that exact historical violation clean. See 'Blind Spot Analysis' below."
  - "The audit's own file (pace-single-source.test.ts) is allow-listed by path in findStreamPaceViolations, in addition to pace-derivation.ts, because the audit's own BANNED_LITERALS array and its permanent planted-violation test fixtures necessarily hold the banned strings as string literals (test data), which comment-stripping alone cannot exempt."
  - "Both plan tasks landed in a single commit (707754d5): Task 2's action ('add a test... to the test file' plus a one-off real-tree probe) is additive to the same single file Task 1 creates, with no natural task boundary to split a commit at — noted here rather than force-split for its own sake."

requirements-completed: [PACE-01]

# Metrics
duration: ~55min
completed: 2026-09-08
---

# Phase 26 Plan 05: PACE-01 Single-Source Audit, Demonstrated Catching a Reintroduced Second Implementation

**`src/analytics/pace-single-source.test.ts` runs in the existing CI chain, proves zero stream-derived per-sample pace arithmetic exists outside `pace-derivation.ts`, and is demonstrated catching both a synthetic planted violation and a reconstruction of the exact real historical violation this phase produced.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2/2 completed
- **Files created:** 1 (`src/analytics/pace-single-source.test.ts`, 371 lines)

## Accomplishments

- `findStreamPaceViolations` scans every `.ts` file under `src/` (189 files) for the two banned per-sample stream-pace literals (`dt / (dd / 1000)`, `elapsed / (metres / 1000)`), confining both to `pace-derivation.ts`. `readSourceTree` does the recursive fail-closed walk (`curation-guard.mjs`'s never-throwing shape), reporting unreadable paths as violations rather than throwing.
- Non-vacuity is asserted directly, not assumed: the scan reaches >100 files (189 confirmed by an in-test `console.log`), the four metadata/aggregate false-positive sites (`compute-dashboard-index.ts`, `detail.ts`, `route-utils.ts`, `gear-aggregate-logic.ts`) are confirmed present in the scanned list AND confirmed not flagged, and `pace-derivation.ts` is confirmed to still contain the arithmetic.
- Override containment confines `clipAtGaps` / `windowSec:` / `pauseRule:` call-site arguments to `pace-derivation.ts`/`*.test.ts`, with a deliberate, narrow exclusion for TypeScript's own type-annotation grammar (`windowSec: number`) — without it, `detail-charts-logic.ts`'s legitimate `derivePaceSeries(t, d, windowSec: number = ...)` wrapper (plan 26-04, preserving a pre-existing call shape) would false-positive.
- Criterion 4's demonstrated-catching mandate is proven two ways: a permanent in-suite synthetic-file-list test (fails in both directions — planted literal present vs. removed), and a one-off run against the real source tree (below).
- **Strengthened beyond the plan's literal spec**: added `GAP_MEMBERSHIP_LITERALS` confining `gapIntervals.some(`/`gapIntervals.find(` call sites the same way, because the real violation this phase produced (see Blind Spot Analysis) would NOT have been caught by the two banned arithmetic literals alone. This closure was itself demonstrated catching a reconstruction of the real historical violation shape (see below).

## Task Commits

Both tasks landed in a single commit — Task 2's action is additive to the same single file Task 1 creates, with no clean task boundary to split a commit at:

1. **Tasks 1 & 2: Write the audit, demonstrate it catching a reintroduced implementation** - `707754d5` (test)

**Plan metadata:** commit pending (this SUMMARY, executed by the orchestrator after wave merge in worktree mode)

## Files Created

- `src/analytics/pace-single-source.test.ts` (371 lines) — the audit: `findStreamPaceViolations`, `readSourceTree`, `findConfinedCallSites` (generalized over `OVERRIDE_LITERALS` and `GAP_MEMBERSHIP_LITERALS`), 8 tests in the main audit `describe` block, 2 tests in the permanent planted-violation `describe` block.

## Blind Spot Analysis (required reading before trusting this audit)

The plan's own `<interfaces>` section specified exactly two banned literals — `dt / (dd / 1000)` and `elapsed / (metres / 1000)` — as "the two literal expressions that constituted the two divergent stream-derived implementations before this phase, confirmed by grep at research time." Both are now confined to `pace-derivation.ts`, proven non-vacuously.

**But this phase produced a THIRD real violation after that research was done**, and it took a different shape. Per `26-INTEGRATION-FIX.md` and commit `f32dddd8`: `detail-zones.ts`'s `computePaceDistribution` carried a local `maskedPaceSeries` workaround —

```ts
const inGap = gapIntervals.some((g) => segStart >= g.startSec && segStart < g.endSec);
```

— which reconstructed `paceHistogramSamples`'s own gap-interval membership test. **This contains no division, no `dt`, no `dd`, no `elapsed`, no `metres`.** A scanner limited to the plan's two literal `BANNED_LITERALS` would have scanned this exact historical code and returned zero violations — passed it clean while PACE-01 was actually violated, exactly as the objective's warning describes.

**Verified, not assumed**: I reconstructed this exact code shape as a probe file (`src/dashboard/views/pace-single-source-historical-probe.ts`, containing the literal `gapIntervals.some((g) => segStart >= g.startSec && segStart < g.endSec)` expression) and confirmed:
- Against `BANNED_LITERALS` alone (`findStreamPaceViolations`): **zero violations** — the blind spot is real and would have shipped clean.
- Against the strengthened audit (`GAP_MEMBERSHIP_LITERALS`, added in this plan): **RED**, naming the exact probe path (verbatim output below).

**Scope of the closure**: `GAP_MEMBERSHIP_LITERALS` closes the ONE blind spot this plan has direct historical evidence of (`gapIntervals.some(`/`.find(` reconstruction). It is not a claim that every conceivable second-locus shape is caught — a hand-rolled `for` loop doing the same membership test with no method call, for example, would still pass both scans. A literal-string / comment-stripped scan is fundamentally a syntactic proxy, not a semantic one; it catches shapes it has literals for, and this plan's honest position is that the two closures now in place (arithmetic literals + gap-membership call sites) cover every second-locus shape this phase has actually produced, not every shape that could theoretically exist.

## Demonstrated-Failing Cases (verbatim, per Task 2's acceptance criteria)

### Case A — synthetic second implementation (arithmetic literal)

Planted `src/dashboard/views/pace-single-source-probe.ts`:
```ts
export function computeLeakyProbePace(dt: number, dd: number): number {
  return dt / (dd / 1000);
}
```

Ran `npx vitest run src/analytics/pace-single-source.test.ts`. Verbatim failure output:
```
FAIL src/analytics/pace-single-source.test.ts > PACE-01 Criterion 4 / D-18 — single-source stream-pace audit > zero stream-derived per-sample pace arithmetic exists outside pace-derivation.ts
AssertionError: violations found:
src/dashboard/views/pace-single-source-probe.ts: contains "dt / (dd / 1000)" (1x): expected [ { …(3) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "count": 1,
+     "needle": "dt / (dd / 1000)",
+     "path": "src/dashboard/views/pace-single-source-probe.ts",
+   },
+ ]
```
Revert: `rm src/dashboard/views/pace-single-source-probe.ts`. Re-ran the audit — green (72/72). Confirmed `git status --porcelain src` produced no output afterward (the pre-existing untracked `pace-single-source.test.ts` itself was the only entry shown, expected since it was not yet committed at that point in the session).

### Case B — the real historical shape (gap-membership reconstruction, no division)

Planted `src/dashboard/views/pace-single-source-historical-probe.ts` reconstructing the exact `f32dddd8` `maskedPaceSeries` predicate (shown above). Ran the audit. Verbatim failure output:
```
FAIL src/analytics/pace-single-source.test.ts > PACE-01 Criterion 4 / D-18 — single-source stream-pace audit > gap-membership containment: gapIntervals.some(/.find( call sites appear only in pace-derivation.ts or *.test.ts files — this is the check that would have caught the real f32dddd8 detail-zones.ts violation, which contained no dt/dd division at all
AssertionError: gap-membership re-implementation found outside pace-derivation.ts/*.test.ts: [{"path":"src/dashboard/views/pace-single-source-historical-probe.ts","literal":"gapIntervals.some("}]: expected [ { …(2) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "literal": "gapIntervals.some(",
+     "path": "src/dashboard/views/pace-single-source-historical-probe.ts",
+   },
+ ]
```
Revert: `rm src/dashboard/views/pace-single-source-historical-probe.ts`. Re-ran the audit — green (73/73). Confirmed `git status --porcelain src` produced no output beyond the not-yet-committed audit file itself.

### Permanent in-suite proof

`describe('PACE-01 Criterion 4 — the audit is demonstrated catching a reintroduced second implementation (planted, permanent)', ...)` in the committed file exercises `findStreamPaceViolations` against a synthetic in-memory file list (no disk I/O), asserting both the planted-literal-present case names the exact path/literal and the literal-removed case returns no violation. `npx vitest run src/analytics/pace-single-source.test.ts -t "planted"` — 2 passing tests, exit 0.

## Verification

- `npx vitest run src/analytics/pace-single-source.test.ts` — 73/73 passing, exit 0.
- `npm run test` — 69 files, 1868 tests passing, 0 failing, exit 0 (after regenerating gitignored `data/stats/*.json`/`data/dashboard/index.json`/`dist/widgets` compute artifacts absent in this fresh worktree via `npm run compute-all-stats`, `npm run compute-advanced-stats`, `npm run build-widgets` — none of these are plan-scope files; only the audit file was committed).
- `npx tsc --noEmit` — exit 0.
- `git status --porcelain src` — empty after every probe revert; empty except the new file before commit.

## Decisions Made

- See `key-decisions` in frontmatter: the gap-membership containment strengthening, the audit's self-allow-listing, and the single-commit note.
- Node's `readdirSync(dirUrl, { withFileTypes: true })` without an explicit `encoding: 'utf8'` infers `Dirent<NonSharedBuffer>[]` under this repo's `@types/node`/TS config, breaking `entry.name.endsWith(...)`. Fixed by passing `encoding: 'utf8'` explicitly and typing `entries` as `Dirent<string>[]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree `node_modules` was unpopulated**
- **Found during:** running `npm run test` to verify Task 1's acceptance criteria.
- **Issue:** the worktree's own `node_modules/` contained only Vite/Vitest cache directories (no installed packages), causing `trends-zoom-logic.test.ts` to fail with `ENOENT` on `chartjs-plugin-zoom` (resolved via an explicit relative-URL path construction, not Node's climbing module resolution, so it could not reach the main repo's populated `node_modules`).
- **Fix:** symlinked the worktree's `node_modules` to the main repo's already-installed, already-vetted `node_modules` (no new package install; `package-lock.json` untouched; no supply-chain surface added).
- **Files modified:** none tracked — a local filesystem symlink outside git, not a source change.
- **Verification:** re-ran `npm run test`; the previously-ENOENT file passed.

**2. [Rule 3 - Blocking] Missing gitignored compute artifacts**
- **Found during:** the same `npm run test` run.
- **Issue:** `data/stats/*.json`, `data/dashboard/index.json`, and `dist/widgets/data/stats/*.json` were absent in this fresh worktree (gitignored, generated), causing 7 unrelated test files to fail on `ENOENT` reading them — the exact category flagged in advance in this plan's dispatch instructions.
- **Fix:** ran `npm run compute-all-stats`, `npm run compute-advanced-stats`, and `npm run build-widgets` to regenerate them locally.
- **Files modified:** none tracked (all gitignored generated artifacts); one incidental tracked-file side effect (`data/geo/geo-metadata.json`'s `generatedAt` timestamp) was reverted via `git checkout -- data/geo/geo-metadata.json` before staging, since it is not part of this plan's scope.
- **Verification:** `npm run test` — 69/69 files, 1868/1868 tests, exit 0.

**3. [Rule 3 - Blocking] TypeScript type inference on `readdirSync`**
- **Found during:** `npm run build` (`tsc`).
- **Issue:** `readdirSync(dirUrl, { withFileTypes: true })` inferred `Dirent<NonSharedBuffer>[]`, breaking `.endsWith()` calls on `entry.name`.
- **Fix:** added `encoding: 'utf8'` to the call and typed `entries` as `import('node:fs').Dirent<string>[]`.
- **Files modified:** `src/analytics/pace-single-source.test.ts` (folded into the single Task 1/2 commit, discovered before that commit).
- **Verification:** `npx tsc --noEmit` — exit 0.

---

**Total deviations:** 3 auto-fixed (Rule 3, all environment/blocking, none touching plan-scope files beyond the audit file itself)
**Impact on plan:** No scope creep on tracked files. `data/geo/geo-metadata.json` was reverted before staging. The `node_modules` symlink and generated compute artifacts are untracked/gitignored and require no follow-up.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. This plan adds a read-only test-time scanner over the existing source tree.

## Issues Encountered

- The audit's own docblock quoting the banned literals is comment-stripped correctly, but its `BANNED_LITERALS` array and permanent planted-fixture test hold the same strings as executable string literals (test data) — comment-stripping cannot and must not remove those. Resolved by allow-listing the audit's own file path, documented in both the file's header and this SUMMARY's `key-decisions`.
- The plan's literal-specified `BANNED_LITERALS`/`OVERRIDE_LITERALS` scope, taken alone, would NOT have caught this phase's actual real cross-plan violation (`f32dddd8`). This is documented fully in "Blind Spot Analysis" above rather than silently narrowed, per this plan's explicit dispatch instruction, and closed within this plan's own file scope via `GAP_MEMBERSHIP_LITERALS`.

## User Setup Required

None.

## Next Phase Readiness

- `src/analytics/pace-single-source.test.ts` runs in the existing `npm run test` chain on every future change — no separate script to remember to run.
- This audit is confined to STREAM-derived pace (per its own header) and gap-interval membership reconstruction. It does not and should not flag `PACE-07`'s metadata-disagreement subject matter.
- If a future plan needs to guard against a DIFFERENT second-locus shape (e.g., a hand-rolled loop with no method-call literal to key on), that is a new, undemonstrated blind spot this plan's audit does not close — flagged honestly here rather than claimed covered.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/analytics/pace-single-source.test.ts
- FOUND: 707754d5 (test: add PACE-01 single-source audit with false-positive/override guards)
