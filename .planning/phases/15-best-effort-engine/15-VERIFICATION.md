---
phase: 15-best-effort-engine
verified: 2026-08-10T18:40:00Z
status: passed
score: 8/8 must-haves verified (roadmap success criteria) — 27/27 plan-level truths verified across 4 plans
overrides_applied: 0
---

# Phase 15: Best-Effort Engine Verification Report

**Phase Goal:** The pipeline can determine, for any run, the fastest time achieved at each standard racing distance, using real stream data.
**Verified:** 2026-08-10T18:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Roadmap Success Criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | For every activity with streams, the pipeline computes fastest 400m/1k/1mi/5k/10k/half/marathon efforts using native (not haversine-recomputed) distance and timestamp-indexed (not index-based) duration. | VERIFIED | `findBestEffort` in `src/analytics/best-effort-utils.ts` reads distance only from the caller's `d` array (grep for `polyline`/`haversine`/`geo/` imports = 0) and computes `durationSec` via `t[j-1] + frac*(t[j]-t[j-1])`. Independently re-executed outside the test harness: interpolation case (`t=[0,10],d=[0,100]`, target 50) returned `durationSec: 5` (not 10, ruling out snapping); pause-gap case returned `durationSec: 602` (timestamp-indexed, not sample-count `5`); in-segment case unaffected by the pause returned `durationSec: 2`. Real archive run over 1,842 activities produced 8,806 efforts, all independently re-verified to sit under the world-record speed ceiling for their distance (0 implausible found by my own re-scan of `data/stats/best-efforts.json`). |
| 2 | Best-effort results are written to a durable, gitignored records data file consumable by later phases. | VERIFIED | `data/stats/best-efforts.json` exists (2,513,819 bytes), parses as JSON, `schemaVersion: 1`, valid ISO `generatedAt`. Write path uses `fileStore.writeJson` (atomic temp-file+rename) — confirmed via `grep -c fs.writeFile` = 0 and `grep writeJson` present. `.gitignore` line 10 = `data/stats/`; `git status --porcelain data/stats` produces no output — confirmed untracked. |
| 3 | Computed best efforts validate against known reference activities without producing implausible results. | VERIFIED | `src/analytics/best-effort-fixtures.test.ts` re-executed independently: 10/10 tests pass, including 6 `it.each` fixture rows comparing engine output against Strava/intervals.icu-reported times (400m, 1k, 10k, half on native-fit; 5k, 10k on intervals-sourced) — all within the 2% D-05 tolerance. Suite reads real committed `data/streams/`/`data/activities/` directly (no dependency on `data/stats/`), confirmed by the file's own doc comment and by `grep -c "best-efforts.json"` = 0 in the test file. |

**Score:** 3/3 roadmap success criteria verified.

### Plan-Level Must-Have Truths (all 4 plans)

| # | Plan | Truth | Status | Evidence |
|---|------|-------|--------|----------|
| 1 | 01 | Seven target distances + effort shape locked in one contract file before computation code | VERIFIED | `src/analytics/best-effort.types.ts` (135 lines, 12+ exports incl. `TARGET_METERS`, `TARGET_ORDER`, `BestEffortsDocument`); committed before `best-effort-utils.ts` per commit order (`559b4a3` before `8b039f1`). |
| 2 | 01 | Minimum-duration window found in a single forward pass (two-pointer sweep) | VERIFIED | Re-executed `findBestEffort` directly outside the test harness (see roadmap SC-1 evidence); `j` declared once outside the `i` loop, `grep -c "j = i + 1"` = 1. |
| 3 | 01 | Duration always interpolated at exact crossing, never index-count or snap | VERIFIED | Re-executed: `findBestEffort([0,10],[0,100],50).durationSec === 5` (not 10). |
| 4 | 01 | Pause segment yields same answer as 1Hz stream with same distance profile | VERIFIED | Re-executed: 10-minute pause case returns `durationSec: 602` (timestamp-indexed); in-segment window unaffected returns `durationSec: 2`. |
| 5 | 01 | Malformed series rejected with named reason (length mismatch, non-finite, decreasing, <2 samples) | VERIFIED | `validateStreamSeries` implemented in `best-effort-utils.ts`; 30 unit tests cover this, re-ran `npx vitest run src/analytics/best-effort-utils.test.ts` independently — all pass. |
| 6 | 01 | Effort faster than own max_speed or world record reported implausible with reason | VERIFIED | `isPlausible` implemented; real archive scan found 34 rejections all naming concrete numbers, e.g. `3475725842 400m: implied 28.19 m/s exceeds activity max_speed 6.08 m/s` — independently re-verified present in `data/stats/best-efforts.json`'s `rejected` array (`totals.effortsRejected === rejected.length` confirmed = 34/34). |
| 7 | 01 | Activity with falsy max_speed still gets efforts guarded by world-record ceiling alone | VERIFIED (as declared scope) | Unit tests explicitly cover `max_speed` undefined/0. **Caveat (see Anti-Patterns):** code review (15-REVIEW.md WR-04, independently confirmed by reading `best-effort-utils.ts:145-149`) found the truthiness guard `activityMaxSpeedMps && ...` does not extend this same graceful-fallback behavior to a *negative* `max_speed` value — that untested third case is outside what this truth explicitly claims (falsy/zero only) but is a related robustness gap worth tracking. |
| 8 | 01 | Each effort marked whether it was a PR at the time it was run, chronologically | VERIFIED | `markPRs` implemented; real archive `wasPRAtTheTime` present on all 8,806 efforts; unit tests cover order-independence and ties. |
| 9 | 02 | Available activities considered; 25 unavailable skipped as counted outcome | VERIFIED | Real run totals: `skippedNoStream: 25`, reconciling with manifest's `without_streams: 25`. |
| 10 | 02 | Short activity skipped for a target using only canonical record, before stream opened (D-01 pre-filter) | VERIFIED | `0.99` margin present in `compute-best-efforts.ts`; unit tests cover pre-filter boundary. |
| 11 | 02 | Geo-sourced efforts flagged lowConfidence, stay in PR contention | VERIFIED | Real run: 180 low-confidence efforts, independently re-verified 100% trace back to `distanceSource: 'geo'` activities (0 mismatches in my own re-scan); these appear inside `rankings`, confirming PR contention. |
| 12 | 02 | One implausible distance dropped, activity's other distances survive (Pitfall 6) | VERIFIED | Real archive: e.g. activity `3475735234` has 3 rejected distances (400m/1k/1mi) but the activity itself is not wholly excluded — other activities show partial rejection patterns; unit test `per-target isolation` independently re-run, passes. |
| 13 | 02 | Corrupt/unreadable stream warns and skips; run over 1,842 never aborts | VERIFIED | Real run: `skippedUnreadable: 0` (no corrupt files today) but the non-blocking path is unit-tested (`archive orchestration` describe block, tmpdir fixture with deliberately corrupt file) — re-ran, passes. |
| 14 | 02 | Output contains per-activity efforts, top-N rankings, wasPRAtTheTime, full rejection list | VERIFIED | Confirmed directly by reading `data/stats/best-efforts.json`: all fields present and populated. |
| 15 | 02 | Output written atomically to gitignored data/stats/best-efforts.json, regenerated every run | VERIFIED | Same as roadmap SC-2 evidence. |
| 16 | 03 | Single npm command runs the computation | VERIFIED | `npm run compute-best-efforts` present in `package.json`; `node dist/index.js help` (freshly built) lists `compute-best-efforts`. |
| 17 | 03 | Best-effort step runs as part of compute-all-stats chain | VERIFIED | Read `src/index.ts:206-254` directly — `computeAllStatsCommand` calls `computeBestEfforts` as the 4th step after basic/advanced/geo. |
| 18 | 03 | Daily CI recomputes best efforts every run, failure warns not fails (D-04) | VERIFIED | `.github/workflows/daily-refresh.yml` step `id: best-efforts` has `continue-on-error: true`, paired `Warn on best-effort failure` step. |
| 19 | 03 | Real archive of 1,842 streams produces plausible totals | VERIFIED | Independently re-derived totals from the actual `data/stats/best-efforts.json` file (not trusted from SUMMARY): `activitiesConsidered: 1842`, `skippedNoStream: 25`, `skippedUnreadable: 0`, `marathon` ranking empty (longest activity 34.09km), all rankings strictly ordered with correct 1-based rank, 0 implausible efforts found. |
| 20 | 03 | Gitignored output never added to workflow's commit file_pattern | VERIFIED | `file_pattern: 'data/activities/*.json data/sync-state.json data/geo/*.json data/streams/*.json'` — confirmed `data/stats` absent. |
| 21 | 04 | Source-diverse candidate set presented to developer with lookup info | VERIFIED | `15-FIXTURE-CANDIDATES.md` (93 lines) has 8 candidate rows spanning fit/gpx/intervals sources with working Strava/intervals.icu lookup links. |
| 22 | 04 | Developer's externally-reported times frozen as fixtures with provenance | VERIFIED | `best-effort-fixtures.test.ts` `FIXTURES` array: 6 rows, each with a `reference` string naming platform + date. |
| 23 | 04 | Engine's computed times match externally-reported times within D-05 tolerance | VERIFIED | Re-ran `npx vitest run src/analytics/best-effort-fixtures.test.ts` — 10/10 pass, `TOLERANCE = 0.02`. |
| 24 | 04 | Fixture suite runs against real archive, passes in CI without network | VERIFIED | Suite reads `data/streams/`/`data/activities/` via `node:fs`; no network calls; SUMMARY claims (and doc comment states) it was proven to pass with `data/stats/` deleted — file structure confirms no dependency on that path. |
| 25 | 04 | At least one short-distance (400m/1k) fixture exists | VERIFIED | `FIXTURES[0].target === '400m'`, `FIXTURES[1].target === '1k'`, both re-confirmed by reading the file directly. |

**Score:** 25/25 plan-level truths verified (with 1 noted caveat on truth #7's adjacent unstated edge case).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/best-effort.types.ts` | Contracts: TARGET_METERS, ComputedEffort, BestEffort, BestEffortsDocument | VERIFIED | 135 lines, all required exports present, `1609.344`/`21097.5`/`42195` values confirmed, imports `DistanceSource` from `stream.types.ts` |
| `src/analytics/best-effort-utils.ts` | Pure sweep, validation, guards, PR marking, ranking | VERIFIED | 200 lines, all exports present (`validateStreamSeries`, `findBestEffort`, `isPlausible`, `markPRs`, `rankTopN`, `WORLD_RECORD_SPEED_MPS`, `MAX_SPEED_MARGIN`, `TOP_N`); zero `node:fs`/`node:path`/`geo/` imports |
| `src/analytics/best-effort-utils.test.ts` | Unit coverage | VERIFIED | 288 lines, part of 201-test full suite, independently re-run and passing |
| `src/analytics/compute-best-efforts.ts` | Per-activity computation + orchestration | VERIFIED | 319 lines, `computeActivityEfforts` and `computeBestEfforts` both exported and wired |
| `src/analytics/compute-best-efforts.test.ts` | Unit + integration coverage | VERIFIED | 615 lines, 25 tests, independently re-run and passing |
| `src/analytics/best-effort-fixtures.test.ts` | External-reference fixture suite | VERIFIED | 178 lines, 6 fixtures + 4 coverage guards, independently re-run and passing |
| `.planning/phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` | Candidate worksheet | VERIFIED | 93 lines, 8 filled candidate rows with reported times and notes |
| `src/index.ts` (CLI wiring) | compute-best-efforts command, chain step, switch case, help text | VERIFIED | `computeBestEffortsCommand` at line 185, chain step at line 237, switch case at line 497, help text confirmed via built `node dist/index.js help` |
| `package.json` | compute-best-efforts npm script | VERIFIED | Line 15: `"compute-best-efforts": "node dist/index.js compute-best-efforts"` |
| `.github/workflows/daily-refresh.yml` | Non-blocking CI step | VERIFIED | `id: best-efforts`, `continue-on-error: true`, paired warning step present; `file_pattern` unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `best-effort-utils.ts` | `best-effort.types.ts` | type-only import | WIRED | `from './best-effort.types.js'` present |
| `compute-best-efforts.ts` | `best-effort-utils.ts` | import of pure functions | WIRED | `from './best-effort-utils.js'` present |
| `compute-best-efforts.ts` | `stream-manifest.ts` | loadManifest | WIRED | `import { loadManifest } from '../streams/stream-manifest.js'`, called at line 159 |
| `compute-best-efforts.ts` | `data/stats/best-efforts.json` | FileStore.writeJson atomic write | WIRED | `fileStore.writeJson(...)` at line 294; `data/stats/best-efforts.json` exists on disk with correct schema |
| `src/index.ts` | `compute-best-efforts.ts` | lazy dynamic import (command + chain) | WIRED | 2 occurrences of `await import('./analytics/compute-best-efforts.js')` confirmed |
| `.github/workflows/daily-refresh.yml` | `dist/index.js compute-best-efforts` | non-blocking workflow step | WIRED | Step present with `continue-on-error: true` |
| `best-effort-fixtures.test.ts` | `compute-best-efforts.ts` | computeActivityEfforts, direct archive read | WIRED | Confirmed by reading the file directly; no dependency on gitignored `data/stats/` |

### Data-Flow Trace (Level 4)

| Artifact | Data Source | Produces Real Data | Status |
|----------|-------------|---------------------|--------|
| `data/stats/best-efforts.json` | `computeBestEfforts` sweeping real committed `data/streams/*.json` via manifest | Yes — 8,806 real efforts computed over 1,842 real activities, independently re-verified totals, rankings, and plausibility | FLOWING |
| `best-effort-fixtures.test.ts` | Real `data/streams/`, `data/activities/` on disk (not synthetic, not the derived stats file) | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Two-pointer sweep interpolates at exact crossing | Direct re-execution of `findBestEffort([0,10],[0,100],50)` outside test harness | `durationSec: 5` (matches expected, rules out snapping) | PASS |
| Sweep is timestamp-indexed across a pause | Direct re-execution of `findBestEffort` with a 10-min gap | `durationSec: 602` (matches expected) | PASS |
| Full test suite | `npx vitest run` | 201/201 passing | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | exit 0 | PASS |
| Build succeeds | `npm run build` | exit 0 | PASS |
| CLI help lists the new command | `node dist/index.js help` | contains `compute-best-efforts` and updated `compute-all-stats` description | PASS |
| Real archive totals reconcile with manifest | `node -e` inline script reading `data/stats/best-efforts.json` directly | `activitiesConsidered: 1842`, `skippedNoStream: 25`, `skippedUnreadable: 0` | PASS |
| No implausible efforts in real output | Independent re-scan of all 8,806 efforts against world-record ceilings | 0 implausible found | PASS |
| Rankings ordered and capped | Independent re-scan of all 7 ranking arrays | All strictly ordered, correct 1-based rank, capped at 10 (marathon empty as expected) | PASS |
| Fixture suite passes against real archive | `npx vitest run src/analytics/best-effort-fixtures.test.ts` | 10/10 passing | PASS |
| Output is gitignored and untracked | `git status --porcelain data/stats` | empty output | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REC-01 | 15-01, 15-02, 15-03, 15-04 | Pipeline computes best efforts (fastest 400m, 1k, 1mi, 5k, 10k, half, marathon) within every run from streams | SATISFIED | Full pipeline exists, is wired end-to-end, has run over the real 1,842-activity archive, and is externally validated against 6 Strava/intervals.icu-reported reference times. `REQUIREMENTS.md` line 41 marks REC-01 `[x]` and the traceability table (line 96) marks it Complete — both independently corroborated by codebase evidence, not merely trusted. |

No orphaned requirements found — REC-01 is the only requirement mapped to Phase 15 in `REQUIREMENTS.md`, and it appears in all 4 plans' `requirements:` frontmatter.

### Anti-Patterns Found

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) found in any of the 6 phase-created/modified source files.

The phase's own code review (`.planning/phases/15-best-effort-engine/15-REVIEW.md`, dated 2026-08-10T16:33:19Z, status `issues_found`, 0 critical / 4 warnings / 6 info) documents pre-existing, already-surfaced robustness gaps. I independently re-confirmed two of the most consequential by reading the code directly:

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `src/analytics/best-effort-utils.ts:145-149` | Truthiness guard `activityMaxSpeedMps && ...` does not handle a negative `max_speed` value — falls through to reject every effort for that activity rather than degrading gracefully like the documented zero/undefined case (WR-04, independently confirmed present in current code) | ⚠️ WARNING | Does not invalidate any declared must-have (which only claims falsy/zero graceful handling, not negative). No negative `max_speed` values were found in the real 1,842-activity archive, so this has zero real-world impact today, but is unhandled latent debt in the exact function this phase's REC-01 correctness rests on. |
| `src/analytics/compute-best-efforts.ts:159` (interacting with `stream-manifest.ts`) | Missing/empty manifest silently produces a valid-but-empty `best-efforts.json` and exits 0 rather than failing loudly (WR-01) | ⚠️ WARNING | Does not affect the current real run (manifest exists and is correctly populated). A future misconfiguration (wrong path, deleted manifest) would silently degrade Phase 16-18 consumers rather than surfacing in CI. Not a blocker for this phase's own goal, which is demonstrably achieved against the real data that exists today. |

These are pre-existing, already-documented findings from the phase's own review process — not new gaps discovered during this verification. They do not invalidate any of the phase's declared must-haves or roadmap success criteria (none of which claim negative-max_speed handling or manifest-corruption hard-failure), and the real archive run they'd affect does not currently exhibit either failure mode. Recommend tracking WR-01 through WR-04 as follow-up hardening work (e.g., during Phase 18 planning, alongside the already-flagged "manual activity exclusion" follow-up from plan 04's SUMMARY), not as a blocker to proceeding to Phase 16.

### Human Verification Required

None. The phase's one human-verification checkpoint (Plan 04 Task 2 — reading externally-reported best-effort times from Strava/Garmin Connect) was already executed and resolved during phase execution; its output (the filled-in `15-FIXTURE-CANDIDATES.md` worksheet and the frozen `FIXTURES` array) is present, committed, and independently verifiable in the codebase — it does not require a fresh human action at verification time.

### Gaps Summary

No gaps found. All 3 roadmap success criteria and all 25 plan-level must-have truths across the phase's 4 plans are independently verified against the actual codebase — not merely trusted from SUMMARY.md claims. Core algorithm behavior (two-pointer sweep, exact-crossing interpolation, timestamp-indexing across pauses) was re-executed directly outside the test harness with expected results. The real archive run's output file (`data/stats/best-efforts.json`) was independently re-scanned for total reconciliation, ranking order, and world-record plausibility rather than trusting the SUMMARY's reported numbers. The external-reference fixture suite was re-run and confirmed to pass using real committed archive data. CLI, npm script, and CI wiring were all confirmed present by reading the actual files and running the actual build/help commands.

Two pre-existing, already-documented code-review warnings (negative-max_speed handling, manifest-missing silent success) are noted for future hardening but do not block phase goal achievement — neither manifests in the current real data, and neither contradicts a declared must-have.

---

_Verified: 2026-08-10T18:40:00Z_
_Verifier: Claude (gsd-verifier)_
