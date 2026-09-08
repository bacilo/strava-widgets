---
phase: 25-ci-hardening-light-theme-verification
plan: 03
subsystem: testing
tags: [ci, verification, node-http, static-json, publish-gate]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    provides: the six stats documents this plan now asserts by name (weekly-distance, monthly-stats, yearly-stats, year-over-year, best-efforts, best-efforts shards)
provides:
  - By-name reachability plus structural-invariant assertions in verify-dashboard-publish.mjs for weekly-distance.json, monthly-stats.json, yearly-stats.json, year-over-year.json, best-efforts.json and a runtime-derived sample of per-activity best-efforts shards
  - A recorded RED observation (D-11) for each of the six new assertions, proving each names its own document on failure
affects: [ci-hardening, publish-verification, records-trends]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "expect200 -> JSON.parse -> fail()/ok() with the actual observed value interpolated — the file's pre-existing assertion idiom, applied to six new documents without any new HTTP machinery"
    - "Runtime-derived sample ids (never pinned literals) filtered to streams.available === true, cross-checked against the served document's own activityId field"

key-files:
  created: []
  modified:
    - scripts/verify-dashboard-publish.mjs

key-decisions:
  - "D-09: each of the six documents gets 200 + JSON.parse + one structural invariant an empty/truncated file fails — confirmed via six independent RED cycles, not just written and trusted"
  - "D-10: shard sample ids (first/middle/last of streams-available rows, de-duplicated) are computed at runtime from indexDoc.activities every run, never pinned"
  - "D-11: every assertion was observed failing and naming its own document before being trusted; the year-over-year cycle specifically proves the exact-12 invariant fires (11 vs 12), not a generic non-empty check"

requirements-completed: [CI-02]

# Metrics
duration: ~35min
completed: 2026-09-04
---

# Phase 25 Plan 03: CI-02 by-name publish assertions Summary

**Six new by-name-plus-structural-invariant assertions added to `verify-dashboard-publish.mjs` for the stats documents a whole-directory copy previously carried implicitly, each independently observed failing and naming its own document before being trusted (D-09/D-10/D-11).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-04T05:20:00Z (approx, worktree base reset)
- **Completed:** 2026-09-04T05:58:28Z
- **Tasks:** 2
- **Files modified:** 1 (`scripts/verify-dashboard-publish.mjs`); `dist/widgets` (gitignored build tree) mutated and restored six times for the RED cycle, no net change

## Accomplishments
- `verify-dashboard-publish.mjs` now asserts reachability BY NAME for `weekly-distance.json`, `monthly-stats.json`, `yearly-stats.json`, `year-over-year.json`, `best-efforts.json`, and a runtime-derived three-id sample of per-activity `best-efforts/{id}.json` shards — closing ROADMAP criterion 3 / CI-02.
- `verify-dashboard` check count rose from a re-measured baseline of **40/40** to **56/56** (16 net-new checks: 6 by-name assertion groups × up to 3 checks each, collapsed where a `fail` short-circuits the `else` chain).
- Every one of the six new assertions was observed RED once — non-zero exit, failure line naming its own document — then restored to green, satisfying D-11.

## Task Commits

1. **Task 1: Add the six by-name assertions with per-document structural invariants (D-09, D-10)** - `5341815` (feat)
2. **Task 2: Observe all six assertions RED, one document at a time (D-11)** - no commit (verification-only task; mutates and restores the gitignored `dist/widgets` build tree, no git-trackable change — see below)

**Plan metadata:** committed together with this SUMMARY.md

## Files Created/Modified
- `scripts/verify-dashboard-publish.mjs` - Added a new `--- 4c. CI-02 ---` section to `main()` with six assertion blocks, all using the existing `expect200`/`fail`/`ok` helper trio; no new HTTP/fetch machinery introduced.

## Decisions Made

- **year-over-year invariant restructured for grep-testability.** The plan's acceptance criteria required the literal substring `length === 12` to appear in the source (proving the fixed-length invariant, not a relaxed `> 0`). The natural inverse-guard phrasing (`length !== 12` as the failure condition) does not contain that substring. Rewrote as `const isExactlyTwelveMonths = Array.isArray(parsedYearOverYear) && parsedYearOverYear.length === 12;` with `if (!isExactlyTwelveMonths)` — same behavior, satisfies the literal check, and is arguably more readable (named boolean vs. a bare negated comparison).
- **Local data regeneration was required before any verification could run.** Neither `data/stats/` nor `data/dashboard/` existed in this fresh worktree (both are gitignored, generated-only). Ran `npm run build` (tsc) then `node dist/index.js compute-all-stats` to produce them locally before `build-widgets`/`verify-dashboard` could produce any output at all — a one-time setup cost of this worktree, not a plan deviation, since the plan's own `<interfaces>` section states the verified on-disk shapes were derived from "the real generated files."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reverted incidental `data/geo/geo-metadata.json` timestamp churn**
- **Found during:** Task 1 (post-build `git status` check before committing)
- **Issue:** Running `compute-all-stats` to bootstrap the missing local `data/stats`/`data/dashboard` trees also touched `data/geo/geo-metadata.json`'s `generatedAt` field (a side effect of the compute pipeline unrelated to this plan's scope).
- **Fix:** `git checkout -- data/geo/geo-metadata.json` before staging Task 1's commit, so only `scripts/verify-dashboard-publish.mjs` was committed.
- **Files modified:** none (reverted, not committed)
- **Verification:** `git status --short` showed only the intended file before `git add`.
- **Committed in:** n/a (explicitly excluded from the commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, scope-boundary revert of an incidental side effect)
**Impact on plan:** No scope creep; the revert kept the commit strictly to the plan's stated `files_modified`.

## Issues Encountered

None beyond the local-data-bootstrap setup step described above under Decisions Made.

## D-11 RED observation log

Six independent cycles, one per assertion. Each cycle broke exactly one document in the (gitignored, worktree-local) `dist/widgets` tree, ran `verify-dashboard`, recorded the failure, then restored from a snapshot taken outside the repo at `/tmp/25-03-restore/` and re-verified green before the next cycle.

Baseline before any cycle: `56 check(s) passed, 0 failure(s).` / `EXIT=0` (end of Task 1).

### 1. `weekly-distance.json` — overwrite with `[]`

- **Break applied:** `echo '[]' > dist/widgets/data/stats/weekly-distance.json`
- **EXIT line:** `EXIT=1`
- **Failure line:** `✗ /data/stats/weekly-distance.json expected a non-empty array, got an array of length 0`
- **Restore:** copied back from `/tmp/25-03-restore/weekly-distance.json`
- **Post-restore EXIT line:** `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

### 2. `monthly-stats.json` — truncate to zero bytes

- **Break applied:** `: > dist/widgets/data/stats/monthly-stats.json`
- **EXIT line:** `EXIT=1`
- **Failure line:** `✗ GET /data/stats/monthly-stats.json returned 200 but an empty body`
- **Restore:** copied back from `/tmp/25-03-restore/monthly-stats.json`
- **Post-restore EXIT line:** `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

### 3. `yearly-stats.json` — overwrite with `[]`

- **Break applied:** `echo '[]' > dist/widgets/data/stats/yearly-stats.json`
- **EXIT line:** `EXIT=1`
- **Failure line:** `✗ /data/stats/yearly-stats.json expected a non-empty array, got an array of length 0`
- **Restore:** copied back from `/tmp/25-03-restore/yearly-stats.json`
- **Post-restore EXIT line:** `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

### 4. `year-over-year.json` — first 11 entries only

- **Break applied:** parsed the 12-entry snapshot, wrote back only entries `[0..10]` (11 entries) to `dist/widgets/data/stats/year-over-year.json`
- **EXIT line:** `EXIT=1`
- **Failure line:** `✗ /data/stats/year-over-year.json expected an array of exactly 12 entries (one per calendar month, per compute-advanced-stats.ts:104), got an array of length 11`
- **Restore:** copied back from `/tmp/25-03-restore/year-over-year.json`
- **Post-restore EXIT line:** `EXIT=0` (`56 check(s) passed, 0 failure(s).`)
- **Note:** the failure line quotes the observed count (11) against the expected 12, proving the fixed-length invariant fired rather than a generic non-empty check — this is the cycle the plan specifically designed to prove the `=== 12` invariant earns its keep (a `length > 0` check would have accepted this truncation silently).

### 5. `best-efforts.json` — overwrite with a parses-fine-but-empty document

- **Break applied:** `echo '{"schemaVersion":1,"activities":{},"rankings":{}}' > dist/widgets/data/stats/best-efforts.json`
- **EXIT line:** `EXIT=1`
- **Failure line:** `✗ /data/stats/best-efforts.json "activities" expected a non-null object with at least one key, got an object with 0 keys`
- **Restore:** copied back from `/tmp/25-03-restore/best-efforts.json`
- **Post-restore EXIT line:** `EXIT=0` (`56 check(s) passed, 0 failure(s).`)

### 6. One sampled shard — delete the file

- **Sampled id used:** `i182358139` (the runtime-derived "first" of the three-id sample selected by the shard-candidate filter in this archive — the other two sampled ids in this run were `6250938684` and `3475743849`)
- **Break applied:** `rm dist/widgets/data/stats/best-efforts/i182358139.json`
- **EXIT line:** `EXIT=1`
- **Failure line:** `✗ GET /data/stats/best-efforts/i182358139.json expected 200, got 404`
- **Restore:** `npm run build-widgets` (regenerates `dist/widgets` wholesale from `data/stats`, which was never touched — the deleted file was a copy under the gitignored build tree)
- **Post-restore EXIT line:** `EXIT=0` (`56 check(s) passed, 0 failure(s).`)
- **Note:** this cycle proves both the 404 path and the index/shard correspondence D-10 claims — the failure names the specific shard path, not a generic stats path, and demonstrates the assertion would also fire if the index and the shard directory disagreed about what exists.

### Final restoration confirmation

After all six cycles: `npm run build-widgets` then `npm run verify-dashboard` exits 0 with the same `56 check(s) passed, 0 failure(s).` total as the end of Task 1. `git status --porcelain data` is empty and `git status --porcelain dist` is empty (both directories are gitignored and untouched at the source level — only the ephemeral `dist/widgets` build output was ever mutated, and it is fully regenerated/restored). `git status --porcelain` (whole repo) is clean apart from this plan's own commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CI-02 is closed: `verify-dashboard-publish.mjs` no longer relies on the whole-directory `data/stats` copy to implicitly carry these six documents — a dropped or renamed compute step will now 404 by name in this gate before it can reach production.
- No blockers for the remaining Phase 25 plans. This plan has no `depends_on` and nothing in Phase 25's other plans depends on it structurally, per the phase's wave-1 parallel design.
- The RED observation log above is intended to be transcribed into `25-VALIDATION.md` by plan 25-06, per this plan's own `<output>` instruction — this plan deliberately does not write to `25-VALIDATION.md` itself.

---
*Phase: 25-ci-hardening-light-theme-verification*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: scripts/verify-dashboard-publish.mjs
- FOUND: .planning/phases/25-ci-hardening-light-theme-verification/25-03-SUMMARY.md
- FOUND commit: 5341815 (Task 1)
- FOUND commit: 83db2bcc (SUMMARY.md)
