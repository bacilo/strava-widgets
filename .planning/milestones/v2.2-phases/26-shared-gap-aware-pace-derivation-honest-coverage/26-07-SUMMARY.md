---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 07
subsystem: analytics
tags: [pace-derivation, dashboard-index, pace-disagreement, ci-compute, vitest]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "derivePaceWithCoverage / classifyGaps / the D-16 single entry point (26-02)"
provides:
  - "detectPaceDisagreement(metadataPaceSecPerKm, stream, options?) — pure, client-safe metadata-vs-stream pace cross-check"
  - "streamPaceSecPerKm(stream) — span-based stream-derived pace"
  - "PaceDisagreement type and the required additive paceDisagreement: PaceDisagreement | null field on DashboardIndexRow"
  - "compute-dashboard-index.ts's gated per-activity stream read that fills paceDisagreement"
affects: [26-08, 26-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive index field, schema version unchanged — second application of the gearName/D-14 precedent"
    - "Gated OPTIONAL stream read inside try/catch, degrading to null on failure, following the existing best-efforts/cities/gear pattern"

key-files:
  created: []
  modified:
    - src/analytics/pace-derivation.ts
    - src/analytics/dashboard-index.types.ts
    - src/analytics/compute-dashboard-index.ts
    - src/analytics/pace-derivation.test.ts
    - src/analytics/compute-dashboard-index.test.ts
    - src/analytics/gear-aggregate-logic.test.ts
    - src/dashboard/data/index-client.test.ts
    - src/dashboard/views/calendar-logic.test.ts
    - src/dashboard/views/list-logic.test.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/views/overview.test.ts
    - src/dashboard/views/trends-cadence-hr-logic.test.ts
    - src/dashboard/views/trends-logic.test.ts
    - src/dashboard/views/trends-volume-logic.test.ts

key-decisions:
  - "streamPaceSecPerKm is span-based ((t[n-1]-t[0]) / ((d[n-1]-d[0])/1000)), deliberately NOT the windowed/gap-clipped derivePaceWithCoverage series — this reproduces the roadmap's and UI-SPEC's cited 5:51/km for 5059204779 exactly, which is the string the browser checkpoint reads back verbatim"
  - "The archive-wide over-fire sweep's denominator is the full activity count (1,890 committed activity records), not the smaller subset with a matching stream file (1,865) — matching the writer's own per-activity loop and research's stated '1 of 1,890' figure. An earlier draft of the sweep test undercounted to 1,865 by skipping activities with no stream file entirely instead of counting them as scanned-but-unflaggable; caught immediately by running the test against the real archive before trusting it (see Deviations)."

requirements-completed: [PACE-07]

# Metrics
duration: ~25min
completed: 2026-09-08
---

# Phase 26 Plan 07: Metadata-vs-Stream Pace Disagreement Cross-Check Summary

**`detectPaceDisagreement` cross-check flags activity 5059204779's impossible 1:53/km metadata pace against its own stream-derived 5:51/km, published as a new required-but-additive `paceDisagreement` field on the dashboard index row — schema version unchanged, `paceSecPerKm` untouched.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 14 (3 production, 2 direct test files, 9 fixture-builder test files touched only to add a required-field default)

## Accomplishments

- `detectPaceDisagreement` and `streamPaceSecPerKm` added to the pure, client-safe `pace-derivation.ts` module — total functions, never throw, return `null` (never a partially-filled object or a zero) on any array-shaped or invalid input.
- `PaceDisagreement` type and a **required** `paceDisagreement: PaceDisagreement | null` field added to `DashboardIndexRow`, following the `gearName`/D-14 additive precedent exactly: `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`, and the field's `null` means "checked and not flagged," never "not checked."
- `compute-dashboard-index.ts` wired to compute the flag, gated on the existing `paceSecPerKm < 200 sec/km` threshold so the archive sweep reads a stream file only when the metadata pace is already implausibly fast — one stream read archive-wide against the real archive, not 1,865. Degrades to `null` on any stream read/parse failure (T-26-01), following the existing best-efforts/cities/gear OPTIONAL-read pattern.
- Ran the full archive against the real, committed data: `npm run build && npm run compute-dashboard-index` reports **"Pace disagreements flagged: 1"** out of 1,890 activities indexed, and the published `data/dashboard/index.json` carries `{"streamPaceSecPerKm":350.6,"metadataPaceSecPerKm":112.6,"ratio":3.11}` for activity `5059204779`, with `paceSecPerKm` unchanged at `112.6` and `schemaVersion` unchanged at `1` — verified directly by reading the written JSON, not inferred.
- The singleton flag, the over-fire guard, and the cross-check's own necessity are all pinned by tests that fail in both directions: the archive-wide sweep test (scanned 1,890, flagged exactly 1, `5059204779`), the exact-value pin (350.6 / 112.6), and negative case 7 (`metadataThresholdSecPerKm: 0` returns `null` on the same stream that returns non-`null` at the default threshold, in the same test).
- Totality cases for `detectPaceDisagreement` (malformed stream, `null` metadata pace, zero-distance stream) added alongside `classifyGaps`' existing totality block in `pace-derivation.test.ts`, keeping all of this module's never-throwing guarantees together.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add detectPaceDisagreement to the shared module and the additive index field** - `290258c4` (feat)
2. **Task 2: Pin the singleton flag, the over-fire guard, and negative case 7** - `3139c6fb` (test)

**Plan metadata:** commit pending (this SUMMARY, executed by the orchestrator after wave merge in worktree mode)

## Files Created/Modified

- `src/analytics/pace-derivation.ts` (496 -> 595 lines) — added `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM` (200), `PACE_DISAGREEMENT_RATIO` (2), `streamPaceSecPerKm`, `PaceDisagreementResult`, `detectPaceDisagreement`. Still pure (no `fs`/`fetch`/DOM).
- `src/analytics/dashboard-index.types.ts` — added `PaceDisagreement` interface and the required `paceDisagreement: PaceDisagreement | null` field on `DashboardIndexRow`; extended the schema-version doc comment to name the second additive field alongside `gearName`.
- `src/analytics/compute-dashboard-index.ts` — added `streamsDir?: string` option (default `data/streams`), imported `detectPaceDisagreement`/threshold, gated per-activity stream read in a `try`/`catch` degrading to `null`, added `paceDisagreement` to the row literal and a `paceDisagreementCount` line to the run summary.
- `src/analytics/pace-derivation.test.ts` — added a `detectPaceDisagreement — totality` describe block (malformed stream, null metadata pace, zero-distance stream), all asserted non-throwing and `null`-returning.
- `src/analytics/compute-dashboard-index.test.ts` — added `'paceDisagreement'` to `EXPECTED_ROW_KEYS`; added a `describe('pace disagreement', ...)` block: the archive-wide sweep, the exact-value pin, and negative case 7.
- `src/analytics/gear-aggregate-logic.test.ts`, `src/dashboard/data/index-client.test.ts`, `src/dashboard/views/{calendar-logic,list-logic,list,overview,trends-cadence-hr-logic,trends-logic,trends-volume-logic}.test.ts` — each gained one `paceDisagreement: null,` line in its `DashboardIndexRow` fixture builder, required by `tsc` once the field became required (Rule 1, see Deviations).

## Measured Figures (re-derived at execution time, 2026-09-08)

| Metric | Value |
|---|---|
| Activity 5059204779 metadata pace | `1216 / (10804/1000)` = 112.55 -> rounds to **112.6 sec/km** |
| Activity 5059204779 stream-derived pace (span-based) | `3788 / (10804/1000)` = 350.61 -> rounds to **350.6 sec/km** (5:51/km) |
| Ratio | 350.6 / 112.6 = **3.11** |
| Archive-wide scan (all committed activity records) | **1,890** |
| Archive-wide flagged count | **1** (`5059204779` only) |
| Over-fire rate | 1 / 1,890 = 0.053%, well under the 0.5% ceiling |

All figures match 26-02-SUMMARY's dependency interfaces and the plan's own planning-time measurements exactly.

## Decisions Made

- `streamPaceSecPerKm` is deliberately span-based (`(t[n-1]-t[0]) / ((d[n-1]-d[0])/1000)`), not derived from `derivePaceWithCoverage`'s windowed/gap-clipped series — a windowed average answers "how fast when moving," while this check needs "what pace does the whole recorded stream actually imply" to reproduce the roadmap's and UI-SPEC's cited 5:51/km figure exactly.
- The archive-wide sweep's `scanned` denominator counts every committed activity record (1,890), not just the subset with a matching stream file (1,865) — matching the real writer's per-activity loop, where a missing stream degrades to "not flagged" rather than being excluded from the count.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed the archive-wide sweep test's `scanned` denominator**
- **Found during:** Task 2, running the sweep test against the real archive before trusting it.
- **Issue:** The first draft of the archive-wide sweep `continue`d past any activity with no matching stream file, undercounting `scanned` to 1,865 instead of the full 1,890 activity count. This failed the plan's own `scanned >= 1890` acceptance criterion and did not match research's stated "1 of 1,890" denominator or the real writer's behavior (which counts every activity and only skips the stream read, not the activity itself).
- **Fix:** Every activity file now increments `scanned`; the stream read is attempted per activity and degrades to `stream = null` (never flaggable) on a missing/unreadable file, mirroring `compute-dashboard-index.ts`'s own OPTIONAL-read degrade pattern exactly.
- **Files modified:** `src/analytics/compute-dashboard-index.test.ts`
- **Verification:** Re-ran against the real archive: `scanned 1890 activities, flagged 1 (5059204779)`. `npx vitest run src/analytics/compute-dashboard-index.test.ts src/analytics/pace-derivation.test.ts` passes 61/61.
- **Committed in:** `3139c6fb` (Task 2's commit)

**2. [Rule 3 - Blocking] Added `paceDisagreement: null` to nine pre-existing `DashboardIndexRow` test fixture builders**
- **Found during:** Task 1, running `tsc --noEmit` after making the field required.
- **Issue:** Making `paceDisagreement` required on `DashboardIndexRow` (per the plan's own explicit WR-06 instruction, mirroring `gearName`) broke `tsc` compilation for every pre-existing test file across the dashboard suite that builds a full `DashboardIndexRow` fixture object — `gear-aggregate-logic.test.ts`, `index-client.test.ts`, and six `dashboard/views/*.test.ts` files.
- **Fix:** Added one `paceDisagreement: null,` line to each fixture builder's base object, in the same position/style as the existing `gearName: null,` line each of them already carries.
- **Files modified:** `src/analytics/gear-aggregate-logic.test.ts`, `src/dashboard/data/index-client.test.ts`, `src/dashboard/views/calendar-logic.test.ts`, `src/dashboard/views/list-logic.test.ts`, `src/dashboard/views/list.test.ts`, `src/dashboard/views/overview.test.ts`, `src/dashboard/views/trends-cadence-hr-logic.test.ts`, `src/dashboard/views/trends-logic.test.ts`, `src/dashboard/views/trends-volume-logic.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0. None of these files' own test assertions changed — only the fixture default.
- **Committed in:** `290258c4` (Task 1's commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** Both fixes were required for the plan's own stated acceptance criteria and for the codebase to compile under the plan's explicit required-field instruction. No scope creep — neither fix touches any file outside this plan's declared `files_modified` plus the mechanically-necessary fixture-builder updates the required-field decision forced.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `paceDisagreement` is live in `data/dashboard/index.json` (verified against a real `npm run compute-dashboard-index` run against the committed archive) — plan 26-08 can read it directly to render badges, and plan 26-10's browser checkpoint can read `streamPaceSecPerKm`/`metadataPaceSecPerKm` back on screen for activity 5059204779.
- `detectPaceDisagreement` and `streamPaceSecPerKm` are exported from `pace-derivation.ts` for any consumer needing the same cross-check logic.
- Pre-existing unrelated worktree-artifact test failures persist unchanged (7 test files: `verify-dashboard-publish-stats.test.mjs`, `records-logic.test.ts`, `trends-cadence-hr-logic.test.ts`'s live-data suite — distinct from the fixture file of the same name edited here, which is fine — `trends-gear-logic.test.ts`, `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`, `trends-zoom-logic.test.ts`; all `ENOENT` on gitignored `data/stats/*.json` / `data/dashboard/index.json` compute artifacts or the missing `chartjs-plugin-zoom` dist file, none touched by this plan). `npm run test` shows 1530 passing / 0 new failures beyond those 7 pre-existing ones — up from 26-02's reported 1524, consistent with this plan's own added tests.

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*
