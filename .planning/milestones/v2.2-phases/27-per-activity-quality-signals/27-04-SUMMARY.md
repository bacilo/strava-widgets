---
phase: 27-per-activity-quality-signals
plan: 04
subsystem: analytics
tags: [typescript, dashboard-index, ci-compute, publish-verification, quality-signals]

requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-01/27-02's full ActivityQualitySignals type tree, computePaceQualitySignals, buildPaceQualityShard, NOT_COMPUTABLE_NO_STREAM"
provides:
  - "The REQUIRED `quality: ActivityQualitySignals` field on DashboardIndexRow (WR-06 precedent), plus qualityAnySevere/qualityNotComputable on DashboardIndexTotals; DASHBOARD_INDEX_SCHEMA_VERSION unchanged at 1"
  - "compute-dashboard-index.ts's per-activity loop computing quality signals unconditionally (stream-read reused with paceDisagreement's gated read when both fire on the same activity) and writing one data/stats/pace-quality/{id}.json shard per row via buildPaceQualityShard"
  - "verify-dashboard-publish.mjs's full-population quality-field presence/shape check, a device-name XSS defence-in-depth scan, and a pace-quality shard sample — both demonstrated failing and restored"
affects: [27-05, 27-07, 27-08, 27-09, 27-10]

tech-stack:
  added: []
  patterns:
    - "Shard carried alongside its row in the SAME per-activity pass (pendingRows -> shardsById map), never re-read from disk in the second-pass write loop — one stream read per activity per run, matching PACE-07's own single-read discipline"
    - "Stream-read reuse across two independently-gated consumers (paceDisagreement's threshold-gated read, quality's unconditional read) via a shared streamReadAttempted flag, rather than two independent fetches of the same file"

key-files:
  created: []
  modified:
    - src/analytics/dashboard-index.types.ts
    - src/analytics/compute-dashboard-index.ts
    - src/analytics/compute-dashboard-index.test.ts
    - scripts/verify-dashboard-publish.mjs
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
  - "Shard-build strategy: carried alongside the row in pendingRows (built in the SAME first-pass loop iteration, from the SAME stream read the row's own `quality` field used), NOT re-read in the second-pass shard-write loop — chosen over a second-loop re-read specifically to keep the archive sweep at one stream read per activity per run, matching PACE-07's own reuse discipline the plan's `<action>` called out"
  - "Stream-read reuse: paceDisagreement's existing threshold-gated read is captured in `streamForActivity`/`streamReadAttempted`; the quality block only issues its own read when that flag is false, so an activity whose pace also triggers PACE-07 is never fetched from streamsDir twice"
  - "Quality-pass wall time is tracked as two separate counters (signal-compute-and-shard-build, shard-write I/O) rather than one end-to-end timer around the whole function, so the added cost is isolated from pre-existing loop work (best-efforts/geo/gear reads) that was already there before this plan"

requirements-completed: [QUAL-01, QUAL-03]

duration: ~50min
completed: 2026-09-10
---

# Phase 27 Plan 04: Publish the Five Quality Signals on the Dashboard Index Summary

**Landed the REQUIRED `quality` field on every published dashboard-index row, wired the CI compute loop to compute all five signals and write one `data/stats/pace-quality/{id}.json` evidence shard per activity (stream-less included) with exactly one stream read per activity per run, and extended the publish verifier with two full-population checks — both proven to fail when the thing they check is absent.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 4 declared (`dashboard-index.types.ts`, `compute-dashboard-index.ts`, `compute-dashboard-index.test.ts`, `verify-dashboard-publish.mjs`) + 9 fixture files fixed as a Rule 3 blocking-issue deviation (see below)

## Accomplishments

- `DashboardIndexRow.quality: ActivityQualitySignals` is REQUIRED (not optional), following the `gearName`/`paceDisagreement` WR-06 precedent verbatim; `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`, confirmed unchanged before/after via `git diff`.
- `compute-dashboard-index.ts` computes all five signals for every activity (unconditional stream read, unlike PACE-07's threshold-gated one) and writes a shard for every row, including stream-less ones — verified against the live archive: 1,890 rows, 1,890 shards, `schemaVersion: 1`, 0 rows missing `quality`.
- `totals.qualityAnySevere` (299) and `totals.qualityNotComputable` (25) both reproduce exactly from an independent recount over the written `index.json` (see "Live Archive Verification" below).
- `verify-dashboard-publish.mjs` gained a full-population `quality` presence/shape check (not a sample — a partial rollout is exactly the failure WR-06 exists to prevent), a `deviceEra.rawDeviceName` XSS defence-in-depth scan over every row, and a `pace-quality` shard sample at different offsets than the `best-efforts` sample. Both new checks were demonstrated failing and restored (verbatim output below).
- 6 new tests added under a `quality signals` describe block in `compute-dashboard-index.test.ts`; full targeted file passes 42/42, `npx tsc --noEmit` exits 0 repo-wide.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the required `quality` field to the index contract** - `eb9834bb` (feat)
2. **Task 2: Compute the signals in the CI loop and write the per-activity shard** - `3a2f8bb1` (feat)
3. **Task 3: Publish-time spot-check for the new field and the shard directory** - `458e0e51` (feat)

_Note: no plan-metadata commit yet in this worktree — orchestrator handles the final merge-time docs commit across all wave worktrees._

## Files Created/Modified

- `src/analytics/dashboard-index.types.ts` — Added `quality: ActivityQualitySignals` (required) to `DashboardIndexRow`, `qualityAnySevere`/`qualityNotComputable` to `DashboardIndexTotals`, type-only import from `pace-quality.js`.
- `src/analytics/compute-dashboard-index.ts` — Per-activity loop now builds `ActivityQualityMetadata`, reuses or performs one stream read, computes `quality` via `computePaceQualitySignals`, builds the `PaceQualityShard` via `buildPaceQualityShard` (carried alongside the row, not re-read), and a second-pass loop writes `data/stats/pace-quality/{id}.json` for every row. Totals and a three-line console summary extended.
- `src/analytics/compute-dashboard-index.test.ts` — `EXPECTED_ROW_KEYS` gained `'quality'`; `streamsDir` added to `baseOptions()`; new `writeStream` helper; new `quality signals (QUAL-01, QUAL-03, D-17)` describe block (6 tests) covering: full signal presence on a streamed activity, stream-less not-computable state, schema-version stability, an independently-recomputed `qualityAnySevere` total, shard/row consistency for every row, and a malformed-stream-JSON degrade path.
- `scripts/verify-dashboard-publish.mjs` — Module-level `QUALITY_SUB_KEYS` constant; a full-population `quality` presence+shape check plus a `rawDeviceName` `<`/`>`/`"` scan inside the existing `gearName` guard block; a `pace-quality` shard sample block mirroring the `best-efforts` one at different array offsets.
- 9 fixture files (see Deviations) — added a `quality: <clean default>` entry to each file's local `DashboardIndexRow` fixture builder.

## Decisions Made

See `key-decisions` in the frontmatter. In addition:

- **Quality-pass timing granularity:** logged as `compute + shard build` vs `shard write` (two separate `Date.now()` accumulators) rather than one end-to-end timer, so a future regression in either the CPU-bound signal computation or the I/O-bound shard write is individually visible, not blended into one number that could hide which half regressed.
- **Test fixture default:** every fixture `quality` default across the 9 downstream files uses an identical "clean" literal (`tier: 'none'` on all three tiering signals, `deviceEra.family: 'no-device-name'`, `anySevere: false`, `notComputableReason: null`) — chosen because it is the semantic equivalent of the existing `gearName: null` / `paceDisagreement: null` defaults those same fixtures already use: "nothing flagged, checked and clean."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue directly caused by this task] Making `quality` required broke `npx tsc --noEmit` in 9 files outside this plan's declared `files_modified`**

- **Found during:** Task 1, immediately after adding the required field and running the mandated `npx tsc --noEmit` acceptance check.
- **Issue:** `DashboardIndexRow.quality` being REQUIRED (per WR-06, exactly as the plan instructs) broke compilation in every test file that builds a `DashboardIndexRow` fixture with a local `makeRow`/`baseRow` helper — the same fixture shape that already had to absorb `gearName` and `paceDisagreement` when those fields were added in prior phases. Files affected: `src/analytics/gear-aggregate-logic.test.ts`, `src/dashboard/data/index-client.test.ts`, `src/dashboard/views/calendar-logic.test.ts`, `src/dashboard/views/list-logic.test.ts`, `src/dashboard/views/list.test.ts`, `src/dashboard/views/overview.test.ts`, `src/dashboard/views/trends-cadence-hr-logic.test.ts`, `src/dashboard/views/trends-logic.test.ts`, `src/dashboard/views/trends-volume-logic.test.ts`.
- **Fix:** Added a `quality: <clean default>` entry to each file's fixture builder (a module-level `CLEAN_QUALITY` constant in the two files that already had `import type { ActivityQualitySignals }` conveniently available to reuse, or an equivalent literal), following the exact pattern already established for `gearName`/`paceDisagreement` in the same builders. None of these files are owned by the parallel 27-03 worktree agent (`scripts/compute-pace-quality-calibration.mjs`, `package.json`, `27-CALIBRATION.md`), so no conflict risk.
- **Files modified:** the 9 files listed above.
- **Verification:** `npx tsc --noEmit` went from 9 broken files to exactly 0 after this fix (with Task 2 not yet applied — `compute-dashboard-index.ts` was still expected-red at that point, matching the plan's own acceptance criterion "fails ONLY inside compute-dashboard-index.ts").
- **Committed in:** `eb9834bb` (part of Task 1's commit, documented inline in the commit message).

**2. [Acceptance-criterion wording tension, not a defect — recorded per the 27-02 precedent]**

Task 2's acceptance criterion `grep -c "readJson" src/analytics/compute-dashboard-index.ts shows no more stream-read call sites than one per activity per run` is satisfied in *behavior* (exactly one of the two `CanonicalStream` `readJson` call sites executes per activity, gated by a shared `streamReadAttempted` boolean — verified by reading the code path, not by re-reading the same file twice), but the literal `grep -c "readJson"` count is 7 (4 pre-existing OPTIONAL-read sites for manifest/best-efforts/cities/gear, unchanged, plus 2 `CanonicalStream` sites: the pre-existing `paceDisagreement` one and this plan's new `quality` one, which are mutually exclusive at runtime via the shared flag). A purely literal file-wide grep count cannot distinguish "two call sites, mutually exclusive at runtime" from "two call sites, both firing" — the intent (one stream read per activity per run) is what the code actually guarantees and what the shard-carry-forward design exists to protect. Not engineered around by removing either call site's own encapsulation.

## Live Archive Verification

Run against the live committed archive at execution time (`npm run build && npm run compute-dashboard-index`):

```
- Activities indexed: 1890
- With streams: 1865
- Without streams: 25
- Quality: any severe signal: 299
- Quality: not computable: 25
- Quality pass wall time: 4791ms (signal compute + shard build 1456ms, shard write 3335ms)
```

Independent checks after the run:
```
ls data/stats/pace-quality/*.json | wc -l          # 1890 (equals row count)
node -e "const d=require('./data/dashboard/index.json');
  console.log(d.schemaVersion, d.activities.filter(r=>!r.quality).length)"
# 1 0   (schemaVersion 1, zero rows missing quality)
```

Independently recomputed `totals.qualityAnySevere`/`totals.qualityNotComputable` from the
written `index.json` (not the script's own claim):
```
recomputed anySevere: 299   totals.qualityAnySevere: 299   match: true
recomputed notComputable: 25   totals.qualityNotComputable: 25
```
299/1890 = 15.8% of the archive carries at least one severe tiering signal.

**Comparison to `27-CALIBRATION.md` section 4:** not possible in this worktree — plan 27-03
(which produces `27-CALIBRATION.md`) is executing concurrently in a sibling worktree and its
output is not visible here until merge. The 299/1890 (15.8%) figure above is this plan's own
independently-reproducible number; reconciling it against 27-03's calibration report is a
post-merge step for the orchestrator or a follow-up plan, not something resolvable from inside
an isolated worktree.

## Task 3 Demonstrated-Failing Runs (recorded verbatim per acceptance criteria)

**(a) Deleting one row's `quality` field:**
```
$ node -e "... delete doc.activities[5].quality ..." (victim row id: i182570742)
$ npm run verify-dashboard
✗ /data/dashboard/index.json activity i182570742 is missing "quality" or one of its five
  named sub-keys — a partial rollout, not a total one (T-27-14)
EXIT CODE: 1
```
Restored from a pre-run backup; re-ran green:
```
✓ /data/dashboard/index.json every row (1890) has a "quality" object with all five named sub-keys
```

**(b) Deleting one sampled `pace-quality` shard:**
```
$ mv dist/widgets/data/stats/pace-quality/i184111348.json /tmp/...
$ npm run verify-dashboard
✗ GET /data/stats/pace-quality/i184111348.json expected 200, got 404
EXIT CODE: 1
```
Restored; re-ran green:
```
✓ GET /data/stats/pace-quality/i184111348.json -> 200
✓ /data/stats/pace-quality/i184111348.json parses with activityId "i184111348" and a "signals" object carrying all five named sub-keys
```

Full `npm run verify-dashboard` result on the clean restored tree: **39 checks passed, 10
failures** — all 10 are pre-existing, unrelated to this plan (missing `data/stats/best-efforts.json`,
`training-load.json`, `age-grading.json`, `gear-aggregate.json`, `weekly-distance.json`,
`monthly-stats.json`, `yearly-stats.json`, `year-over-year.json`, `all-time-totals.json`,
`streaks.json` — none of these compute steps were run in this worktree; this plan only runs
`compute-dashboard-index`). Same worktree-provisioning root cause already documented in
`deferred-items.md` by plan 27-01/27-02.

## Issues Encountered

`npm run test` (full suite): 64/70 test files pass, 1824/1824 individual tests pass. The 6
failing FILES are the same documented worktree-provisioning artifacts from `deferred-items.md`
(gitignored derived `data/stats/*.json` never generated by the missing compute steps above,
plus the known empty-`node_modules/chartjs-plugin-zoom` worktree artifact) — no new entries
added, per the session's explicit instruction not to duplicate the same documented cause.
Notably `data/dashboard/index.json` and `data/stats/pace-quality/` now exist in this worktree
(this plan's own live-archive run produced them), so `trends-cadence-hr-logic.test.ts` and
`scripts/compute-pace-residual.test.mjs` — both listed as failing in the 27-01 baseline — pass
here; the remaining 6 failures are the ones this plan's own `compute-dashboard-index` run does
not produce (best-efforts, gear-aggregate, training-load, year-over-year, plus the chartjs-zoom
worktree artifact).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Every published `data/dashboard/index.json` row now carries `quality` with all five named
Phase 27 signals, and every activity (stream-less included) has a
`data/stats/pace-quality/{id}.json` evidence shard. `DASHBOARD_INDEX_SCHEMA_VERSION` is
unchanged at `1`. The publish gate discriminates in both directions on both new artifacts.
Waves 4-5 (list-filter UI, detail-view evidence panel — 27-07/27-08/27-09) can now read
`row.quality.*` directly off the index and fetch the per-activity shard for drill-down evidence
without any further storage-layer work. No blockers for downstream plans.

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*

## Self-Check: PASSED
