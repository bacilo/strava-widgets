---
phase: 15-best-effort-engine
reviewed: 2026-08-10T16:33:19Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - .github/workflows/daily-refresh.yml
  - src/analytics/best-effort-fixtures.test.ts
  - src/analytics/best-effort-utils.test.ts
  - src/analytics/best-effort-utils.ts
  - src/analytics/best-effort.types.ts
  - src/analytics/compute-best-efforts.test.ts
  - src/analytics/compute-best-efforts.ts
  - src/index.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-10T16:33:19Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the best-effort engine (two-pointer sweep, validation, plausibility guards, PR marking, ranking), its orchestrator, types, three test suites, the CLI wiring in `src/index.ts`, and the new workflow step in `daily-refresh.yml`.

The core algorithm is correct. I traced the two-pointer sweep's invariants (the minimal-`j` invariant holds under non-decreasing `d`; `j` never regresses; `d[j-1] - d[i] < target` is guaranteed at interpolation time because `j >= i + 1` is enforced and `j` is minimal; the `segMeters > 0` guard branch is unreachable at a genuine crossing but harmless). The interpolation, pause handling (elapsed-time semantics), rounding, and zero-duration guard are all sound. All 83 tests pass, and I verified the external claims made in comments: `data/stats/` is in fact gitignored, `data/streams/` is in fact committed, the fixture data files (`3475726256`, `3475725513`, `7827165619`, `i174284902`) exist with the fields the fixture suite reads, and the `compute-best-efforts` npm script advertised in `printHelp` exists in `package.json`.

Four warnings remain, all in the robustness/edge-case category: a silent-success failure mode when the manifest is missing, a whole-distance data-loss behavior when only the single fastest window is implausible, missing shape validation on activity records, and a truthiness bug in the max-speed guard that inverts its behavior for negative values. No blockers.

## Warnings

### WR-01: Missing or empty manifest produces a silent "success" with an empty best-efforts.json

**File:** `src/analytics/compute-best-efforts.ts:159` (interacting with `src/streams/stream-manifest.ts:42-54` and `src/index.ts:185-204`)
**Issue:** `loadManifest` returns `emptyManifest()` when the manifest file is absent — a behavior designed for the *write* path (first backfill run), not this read-only compute path. If `data/streams/manifest.json` is missing, misnamed, or the configured path is wrong, `computeBestEfforts` writes a valid-but-empty `best-efforts.json`, logs "Activities considered: 0", and `computeBestEffortsCommand` prints "Best efforts generated successfully!" and exits 0. In CI the `continue-on-error` warning step never fires because the step succeeded, so downstream record widgets (Phases 16-18) would silently render from an empty document. There is no code path in which this command fails loudly on a mis-scoped input.
**Fix:** In `computeBestEfforts`, treat an empty manifest as an error (or at minimum a hard warning with non-zero exit) in the compute path:
```typescript
const manifest = await loadManifest(fileStore, streamsManifestPath);
if (Object.keys(manifest.activities).length === 0) {
  throw new Error(
    `Stream manifest at ${streamsManifestPath} is missing or empty — ` +
    `refusing to overwrite best-efforts.json with an empty document. ` +
    `Run backfill-streams first.`
  );
}
```

### WR-02: A single implausible fastest window erases the entire distance for that activity, including genuine efforts

**File:** `src/analytics/compute-best-efforts.ts:84-96` (with `src/analytics/best-effort-utils.ts:140-164`)
**Issue:** Only the single minimum-duration window is checked for plausibility. When that window is a GPS spike (e.g., a short teleport making the fastest 400m window imply 80 m/s), the whole distance is dropped for that activity even though a genuine, plausible 400m window exists elsewhere in the same series. The test at `compute-best-efforts.test.ts:501-538` codifies this: the implausible 400m is fully rejected, not replaced by the next-best plausible window. The archive demonstrably contains GPS spikes — activity `3475726256` (a Run) has `max_speed` 24.1 m/s — so real PRs will be silently lost for spike-affected activities, with only a rejection row as the trace. This appears to be accepted design (D-04 records the rejection), but it is a data-loss behavior for genuine efforts, and the fix is bounded.
**Fix:** On rejection, fall back to the best *plausible* window rather than dropping the distance. One approach: `findBestEffort` variant returning candidates in ascending duration order, take the first that passes `isPlausible`; or excise samples implying > world-record segment speed before the sweep. Keep the rejection row for the discarded window either way.

### WR-03: No shape validation on activity records — malformed `distance` or `start_date` degrades silently instead of counting as unreadable

**File:** `src/analytics/compute-best-efforts.ts:181-194` and `src/analytics/compute-best-efforts.ts:75-77`
**Issue:** `fileStore.readJson<StravaActivity>` performs no runtime validation. Two concrete failure modes for a truncated or hand-edited activity file (the exact threat T-15-02 names):
- `activity.distance` missing/non-numeric: `undefined >= TARGET_METERS[key] * 0.99` is `false` for every key, so `eligibleTargets` is empty and the activity yields zero efforts with no warning, no rejection row, and no `skippedUnreadable` increment — indistinguishable from a legitimately short run.
- `activity.start_date` missing: `startDate: undefined` flows into `markPRs` (`Date.parse(undefined)` → `NaN`, corrupting the chronological sort for that distance) and `JSON.stringify` drops the property entirely from the output document, breaking the `ActivityBestEfforts.startDate: string` contract that Phase 18's PR-evolution consumers rely on.
**Fix:** Validate before computing, routing failures into the existing `skippedUnreadable` path:
```typescript
if (!Number.isFinite(activity.distance) || typeof activity.start_date !== 'string') {
  console.warn(`  ${id}: activity record missing numeric distance or start_date; skipping`);
  skippedUnreadable++;
  continue;
}
```

### WR-04: Truthiness check in `isPlausible` inverts the guard for negative `max_speed` — every effort rejected

**File:** `src/analytics/best-effort-utils.ts:145-149`
**Issue:** The guard `activityMaxSpeedMps && Number.isFinite(activityMaxSpeedMps)` correctly falls through for `0` and `undefined` (Pitfall 5), but a negative value is truthy and finite, so `impliedSpeedMps > activityMaxSpeedMps * MAX_SPEED_MARGIN` is true for *every* positive implied speed — a single corrupt `max_speed: -1` in an activity record silently rejects all seven distances for that activity. The whole purpose of this branch is robustness against malformed `max_speed` data, yet it only handles two of the three malformed shapes.
**Fix:**
```typescript
if (
  activityMaxSpeedMps !== undefined &&
  Number.isFinite(activityMaxSpeedMps) &&
  activityMaxSpeedMps > 0 &&
  impliedSpeedMps > activityMaxSpeedMps * MAX_SPEED_MARGIN
) {
```

## Info

### IN-01: Unreachable ENOENT hint in `computeBestEffortsCommand`

**File:** `src/index.ts:198-201`
**Issue:** The branch `error.code === 'ENOENT' && error.message.includes('streams')` can never fire: `FileStore.readJson` wraps filesystem errors in a plain `new Error(...)` that has no `code` property (`file-store.ts:55-58`), `loadManifest` swallows the missing-manifest case entirely, and per-activity read failures are caught inside `computeBestEfforts`. The "run backfill-streams" hint is dead code copied from the sibling commands (which share the same latent flaw).
**Fix:** Match on the message instead (`error.message.includes('File not found')`), or remove the hint. Better: resolve via WR-01 so the missing-manifest case throws a self-explanatory error.

### IN-02: Fixture rows' `source`/`distanceSource` metadata is asserted-on but never verified against the actual stream files

**File:** `src/analytics/best-effort-fixtures.test.ts:108-130, 168-171`
**Issue:** The coverage guard "spans at least two distinct stream sources" trusts the hand-typed `fx.source` field, and `computeEffortsForActivity` passes the hand-typed `fx.distanceSource` into the engine rather than reading `stream.distanceSource` from the file it just parsed. A mislabeled fixture row would satisfy the guard vacuously and could feed the wrong `lowConfidence` provenance into the computation. This weakens the suite's stated role as external ground truth.
**Fix:** After parsing the stream, assert `stream.source === fx.source` and `stream.distanceSource === fx.distanceSource` (or drop the fixture fields and read both from the file).

### IN-03: Manifest `distanceSource` used without cross-checking the stream file's own `distanceSource`

**File:** `src/analytics/compute-best-efforts.ts:191`
**Issue:** `entry.distanceSource` (manifest) drives the `lowConfidence` flag, but the stream file carries its own `distanceSource` field. If the two ever diverge (stale manifest after a re-derive), the flag is silently wrong. One-line consistency check would catch drift.
**Fix:** `if (stream.distanceSource !== entry.distanceSource) console.warn(...)` (or prefer the stream file's value, since it is the artifact actually being computed over).

### IN-04: `ActivityEffortInput.startDate` is required but unused by `computeActivityEfforts`

**File:** `src/analytics/compute-best-efforts.ts:42-50, 65-66`
**Issue:** `startDate` is not destructured and plays no role in the pure function; both callers are forced to supply it anyway. Either it belongs in the result (it does not) or it should be dropped from the input contract.
**Fix:** Remove `startDate` from `ActivityEffortInput`; `computeBestEfforts` already reads `activity.start_date` directly where it is needed.

### IN-05: Workflow warning message says "records data will be stale" but the failure mode is absent data, not stale data

**File:** `.github/workflows/daily-refresh.yml:81-83`
**Issue:** `data/stats/` is gitignored and regenerated every run, so when `compute-best-efforts` fails there is no cached prior output to fall back on — `best-efforts.json` simply does not exist for that run. "Stale" understates the impact once Phase 16+ widgets consume the file; the geocoding warning above it ("use cached geo data") is accurate because geo data IS committed, which makes the parallel phrasing here misleading.
**Fix:** `echo "::warning::Best-effort computation failed, best-efforts.json absent this run — records widgets will have no data"`.

### IN-06: Eligibility pre-filter uses only the summary `distance`, ignoring the stream's actual span

**File:** `src/analytics/compute-best-efforts.ts:75-77`
**Issue:** An activity whose summary `distance` under-reports the stream span by more than the 1% margin (plausible for `geo`-reconstructed distances) is excluded from a target its stream genuinely covers — e.g., summary 4,900m with a stream spanning 5,010m never gets a 5k effort. The inverse direction is already safe (`findBestEffort` returns `undefined` when the stream falls short).
**Fix:** Gate on `Math.max(activityDistanceM, d[d.length - 1] - d[0]) >= TARGET_METERS[key] * 0.99`.

---

_Reviewed: 2026-08-10T16:33:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
