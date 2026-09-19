---
phase: 30-elevation-quality-signal
plan: 03
subsystem: analytics
tags: [typescript, publish-gate, client-parse, quality-signals, elevation]

# Dependency graph
requires:
  - phase: 30-elevation-quality-signal
    provides: "30-01's ElevationSignal type, the three detectors, elevationSignal(stream, metadata) assembly, and the already-landed startLatlng/endLatlng metadata slice on compute-dashboard-index.ts"
provides:
  - "parseElevationSignal(raw) — a total, all-or-nothing tolerant client parse of the sixth signal, wired into parseActivityQualitySignals"
  - "Real parsing of the shard's elevationVerticalRateSamples/elevationLoopRadiusM/elevationStartEndDistM evidence fields (previously stubbed defaults)"
  - "QUALITY_SUB_KEYS extended to six members ('elevation' added) on both the index-row publish check and the shard-sample publish check"
  - "A regenerated local data/dashboard/index.json and data/stats/pace-quality/*.json shards with every row carrying quality.elevation"
affects: [30-05, 30-06, 30-07, 30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parseElevationSignal is all-or-nothing (mirrors parseDecimationSignal's tier-gate, one level deeper): tier plus all three nested sub-objects must each independently validate or the whole signal falls back to the shared not-computable literal — a malformed closureDrift.state invalidates the WHOLE elevation signal, not just that nested field"
    - "VALID_ELEVATION_TIERS is a deliberately separate ReadonlySet from VALID_TIERS (no 'minor' member, D-07/T-30-10)"
    - "finiteNumberOrNull (stricter than the existing nullableNumber) rejects NaN/Infinity/strings for every elevation numeric field, never coercing to 0 (T-26-02)"

key-files:
  created: []
  modified:
    - src/dashboard/data/pace-quality-client.ts
    - src/dashboard/data/pace-quality-client.test.ts
    - scripts/verify-dashboard-publish.mjs

key-decisions:
  - "Task 1 required no code change and no commit: 30-01's own Rule-3 deviation had already landed startLatlng/endLatlng on compute-dashboard-index.ts's qualityMetadata literal (grep-verified: both lines present, git diff since base adds no readJson/readFile/import). This plan's Task 1 work was regeneration + verification only."
  - "elevation numeric fields use a new finiteNumberOrNull helper, not the existing nullableNumber — nullableNumber's typeof-only check would let NaN (typeof 'number') survive the parse, violating T-26-02's never-coerce-to-a-plausible-value rule the plan's acceptance criteria explicitly test for."
  - "Elevation shard evidence fields (elevationVerticalRateSamples etc.) follow the same entry-level drop-and-continue tolerance already established for impossibleSamples/gapIntervals, not a new pattern."
  - "The baseline '~207' drift-not-computable figure in the plan's <interfaces> block undercounts by exactly the 25 stream-less activities (207 = stream-computable-but-position-unknown; +25 stream-less = 232 total closureDrift.state==='not-computable' rows) — reconciled below with a direct decomposition, not treated as unexplained archive drift."

patterns-established:
  - "A publish-gate demonstration mutates only a /tmp copy of the built dist/widgets/data/dashboard/index.json, swapped in and back out of dist/ for the duration of one verify-dashboard run — data/ and the git tree are never touched, confirmed by git status --porcelain data/ both before and after."

requirements-completed: [ELEV-01, ELEV-02]

# Metrics
duration: ~45min
completed: 2026-09-18
---

# Phase 30 Plan 03: Elevation on the Published Index, Tolerant Client Parse, Extended Publish Gate Summary

**Regenerated the local dashboard index with `quality.elevation` on all 1,890 rows (severe 60, sub-ground 11, loop-gated drift 21, vertical-rate 39), landed a total tolerant `parseElevationSignal` client parse that degrades stale/malformed shards to an explicit not-computable reading, and extended `verify-dashboard-publish.mjs`'s `QUALITY_SUB_KEYS` to six — demonstrated catching a single-row deletion (exit 1) and clean on the restored build (66/66, exit 0).**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-18T16:05:00+02:00 (approx.)
- **Completed:** 2026-09-18T16:20:00+02:00 (approx.)
- **Tasks:** 3 (Task 1 required no commit — see Decisions Made)
- **Files modified:** 3 (Task 2: 2 files; Task 3: 1 file)

## Accomplishments

- Confirmed Task 1's deliverable was already shipped by plan 30-01's Rule-3 deviation (`startLatlng: activity.start_latlng` / `endLatlng: activity.end_latlng` on `qualityMetadata`, zero new file reads) and regenerated the local index against it, sanity-checking all six required counts against the `30-CONTEXT.md` baselines
- `parseElevationSignal` — a total, all-or-nothing tolerant parse mirroring `parseDecimationSignal`'s tier-gate one level deeper: `tier` and all three nested sub-signals (`subGround`, `closureDrift`, `verticalRate`) must each independently validate, or the whole elevation object falls back to the shared not-computable literal
- `VALID_ELEVATION_TIERS` — a deliberately separate three-member `ReadonlySet` (`severe`/`none`/`not-computable`, no `'minor'`) from the existing four-member `VALID_TIERS`
- `finiteNumberOrNull` — a new, stricter numeric helper (rejects `NaN`/`Infinity`/strings, never coerces to `0`) used for every elevation numeric field, addressing T-26-02
- Real parsing of the shard's `elevationVerticalRateSamples`/`elevationVerticalRateSamplesTruncated`/`elevationLoopRadiusM`/`elevationStartEndDistM` evidence fields, replacing 30-01's placeholder stub defaults, with the same entry-level drop-and-continue tolerance `impossibleSamples`/`gapIntervals` already use
- `QUALITY_SUB_KEYS` extended from five to six members (`'elevation'` added); both "five named sub-keys" message strings updated to "six" on the index-row check and the shard-sample check
- Demonstrated (not merely asserted) the publish gate catching a partial elevation rollout: a `/tmp` copy of the built `index.json` with `quality.elevation` deleted from activity `i184264408` fails `npm run verify-dashboard` with exit 1, naming the activity; the restored build passes 66/66, exit 0
- Whole tree green: `npx tsc --noEmit` exits 0; `npm test` 82/82 files, 2458/2458 tests (up from the 30-01 baseline of 2448 by 10 — the new elevation-parse test cases)

## Task Commits

1. **Task 1: Pass the loop test's position through the existing metadata slice and regenerate** — no commit (code already landed by plan 30-01; this task's work was verification-only against the existing tree — see Decisions Made)
2. **Task 2: Tolerant client parse for the sixth signal** - `4336e199` (feat)
3. **Task 3: Fail the publish gate on a partial elevation rollout** - `5ea1af3c` (feat)

## Files Created/Modified

- `src/dashboard/data/pace-quality-client.ts` — `parseElevationSignal`, `parseElevationTier`, `parseSubGroundSignal`, `parseClosureDriftSignal`, `parseVerticalRateSignal`, `parseElevationVerticalRateSampleEntry`, `finiteNumberOrNull`, `VALID_ELEVATION_TIERS`, `VALID_CLOSURE_DRIFT_STATES`; wired into `parseActivityQualitySignals` (replacing the 30-01 stub) and `parsePaceQualityShard` (real evidence-field parsing, replacing the 30-01 stub defaults)
- `src/dashboard/data/pace-quality-client.test.ts` — `validShard`'s `elevation` fixture upgraded from the not-computable stub to a well-formed severe example; seven new test cases (round-trip, absent-elevation stale-artifact case, rejected `'minor'` tier, five numeric fields each tested against string/NaN/±Infinity via `it.each`, malformed `closureDrift.state`, dropped malformed evidence-sample entry)
- `scripts/verify-dashboard-publish.mjs` — `QUALITY_SUB_KEYS` six members; both "five named sub-keys" → "six named sub-keys" message strings (index-row check and shard-sample check)

## Decisions Made

- Task 1 required no code change: plan 30-01's Task 3 (restoring a green tree after `elevation` became a required key) had already added `startLatlng: activity.start_latlng` / `endLatlng: activity.end_latlng` to `compute-dashboard-index.ts`'s `qualityMetadata` literal as an explicitly-anticipated Rule-3 deviation. Verified against this plan's own acceptance criteria: `grep -c "startLatlng: activity.start_latlng"` = 1, `grep -c "endLatlng: activity.end_latlng"` = 1, `git diff <base> -- compute-dashboard-index.ts` adds no `readJson`/`readFile`/new `import`, `DASHBOARD_INDEX_SCHEMA_VERSION` unchanged at 1. This plan's Task 1 work was therefore: build, regenerate, and verify the six required counts plus the anySevere invariant — no commit was made since no git-tracked file changed.
- `finiteNumberOrNull` was introduced as a new helper distinct from the existing `nullableNumber`, because `nullableNumber`'s `typeof raw === 'number'` check alone would let `NaN` (which is `typeof 'number'`) survive into the parsed shape — violating the plan's explicit "a string, `NaN` or `Infinity` becomes `null`, never `0`" requirement (T-26-02). This is scoped to elevation only; the four pre-existing signals' numeric parsing is unchanged (out of this plan's declared scope).
- `parseElevationSignal` is deliberately all-or-nothing at the whole-signal level (not per-sub-field graceful degradation): if `tier`, `subGround`, `closureDrift`, or `verticalRate` individually fails to validate, the ENTIRE elevation object returns `null` and the caller's `??` fallback (the whole-signal not-computable literal) applies. This directly satisfies the plan's acceptance criterion that a malformed `closureDrift.state` is "rejected to the fallback" (the whole fallback, not a partially-trusted shape) and mirrors `parseDecimationSignal`'s own tier-gate pattern one level deeper.

## Deviations from Plan

None — plan executed exactly as written, once Task 1's already-shipped-by-30-01 status is accounted for (see Decisions Made above; not a deviation from *this* plan's own instructions, since the plan's read_first section explicitly named the 30-01 summary as prior context to build on).

## Regenerated Index: Six Required Counts

All measured from a fresh `npm run build && npm run compute-dashboard-index` against this worktree's copy of `data/`, streams digest unchanged before/after (`70d729664e0d7f12fbccd22d24f5c144aef1c5c8855fb8c1370cda0283e33346` both times; `git status --porcelain data/streams/` empty both times).

| Count | Measured | Baseline (30-CONTEXT.md, dated same day) | Delta |
|---|---|---|---|
| Total rows | 1,890 | 1,890 | 0 |
| Rows with `quality.elevation` present | 1,890 (100%) | (implied: all) | 0 — no partial rollout |
| Severe-elevation (`tier === 'severe'`) | 60 | "near 60" | 0 |
| Sub-ground flagged | 11 | 11 | 0 |
| Loop-gated drift flagged (`closureDrift.state === 'flagged'`) | 21 | 21 | 0 |
| Vertical-rate flagged | 39 | 39 | 0 |
| `closureDrift.state === 'not-computable'` (total) | 232 | 207 | **explained below, not archive drift** |

**Reconciling the 232-vs-207 delta:** the plan's `<interfaces>` baseline (207) counts only the cohort with a *computable stream but unknown start/end position* — activities where `computePaceQualitySignals` ran but the drift sub-signal alone could not. The plain `closureDrift.state === 'not-computable'` count also includes the 25 whole-signal not-computable (stream-less) activities, since a stream-less activity's `closureDrift` is `not-computable` too (D-07: whole-signal not-computable applies only to that stream-less cohort). Decomposed directly off the regenerated index:

```
driftNC (total, closureDrift.state === 'not-computable'):        232
  of which stream-computable but position-unknown (207):         207
  of which whole-signal not-computable / stream-less (25):        25
```

207 + 25 = 232 exactly. `207` matches the `<interfaces>` baseline to the digit once the stream-less cohort is excluded, and `232 - 1,658 (positioned) = 232` also matches `1,890 - 1,658` from `30-CONTEXT.md`'s own measurement table directly. Recorded here as a baseline-interpretation clarification, not a code defect or archive drift.

`totals.qualityAnySevere` in the regenerated index: **299** (unchanged from the pre-phase baseline — see recount below).

## Recount Script Verbatim

```
$ node scripts/compute-pace-quality-recount.mjs --expect 299
D-03 independent recount: reading data/dashboard/index.json off disk (no classifier import)...

Total rows (activity-count denominator): 1890
Rows with a computable stream (notComputableReason === null): 1865
Not-computable count: 25
Per-signal severe counts (own arithmetic, tier === 'severe'):
  decimation:        154
  gapProfile:        127
  impossibleSamples: 31
Recomputed composite (own arithmetic, union of the three tiers): 299
  vs. totals.qualityAnySevere:        299
  vs. count of row.quality.anySevere:  299
--expect 299: MATCH

PASS: recount agrees with the shipped totals; no disagreements found.
```

D-06 confirmed: the elevation tally never moved `qualityAnySevere` — per-signal severe counts (decimation 154 / gapProfile 127 / impossibleSamples 31) are byte-identical to the pre-phase archive figures quoted in `30-CONTEXT.md`.

## Deliberate-Deletion Verify Run Verbatim

Setup: copied the freshly built `dist/widgets/data/dashboard/index.json` to `/tmp/gsd-30-03-verify-demo/`, deleted `quality.elevation` from exactly one row (activity `i184264408`, the first row in `activities[]`) in that copy only, swapped the mutated copy into `dist/widgets/data/dashboard/index.json` for the duration of one run, then restored the original.

**Mutated run — exit 1:**
```
✓ GET /data/dashboard/index.json -> 200
✓ /data/dashboard/index.json parses with schemaVersion 1 and a non-empty activities array
✓ /data/dashboard/index.json at least one row has "gearName" and no row leaks a raw gear id
✗ /data/dashboard/index.json activity i184264408 is missing "quality" or one of its six named sub-keys — a partial rollout, not a total one (T-27-14)
✓ /data/dashboard/index.json no row's quality.deviceEra.rawDeviceName contains "<", ">" or '"' (scanned all 1890 rows)
... [62 more passing checks unchanged] ...

65 check(s) passed, 1 failure(s).
```
`echo $?` after this run: `1`.

**Restored run — exit 0:**
```
... [65 passing checks] ...
✓ GET /data/streams/18702664326.json -> 404 (expected, stream-unavailable activity)
✓ GET /assets/index-CQsnTPZG.js -> 200
✓ GET /assets/index-CQkdBpPg.css -> 200

66 check(s) passed, 0 failure(s).
```
`echo $?` after this run: `0`.

`diff /tmp/gsd-30-03-verify-demo/index.json.backup dist/widgets/data/dashboard/index.json` after restore: no output (byte-identical). `git status --porcelain data/` before and after the whole demonstration: empty both times.

## Three Pinned Activity IDs (for plans 30-05, 30-06, 30-08)

All three read back from both the regenerated `data/dashboard/index.json` row and the corresponding `data/stats/pace-quality/{id}.json` shard — the two agree exactly.

**Severe-elevation exemplar — `4556693525`** (the milestone's worked example, sub-ground):
```json
{
  "tier": "severe",
  "subGround": { "flagged": true, "minAltM": -282 },
  "closureDrift": { "state": "clear", "deltaM": -5.600000000000023, "startEndDistM": 0 },
  "verticalRate": { "flagged": false, "worstRateMps": 3.3000000000000114, "violatingSamples": 0 }
}
```
Shard evidence: `elevationVerticalRateSamples: []`, `elevationLoopRadiusM: 100`, `elevationStartEndDistM: 0`.

**Healthy exemplar — `17257505831`**:
```json
{
  "tier": "none",
  "subGround": { "flagged": false, "minAltM": 7.800000000000011 },
  "closureDrift": { "state": "clear", "deltaM": 2.3999999999999773, "startEndDistM": 0 },
  "verticalRate": { "flagged": false, "worstRateMps": 1.3999999999999773, "violatingSamples": 0 }
}
```

**Drift-not-computable exemplar — `i184264408`** (the same activity used in the publish-gate deletion demo above, position unknown, tier still `'none'` because the other two modes ran clean):
```json
{
  "tier": "none",
  "subGround": { "flagged": false, "minAltM": -1 },
  "closureDrift": { "state": "not-computable", "deltaM": null, "startEndDistM": null },
  "verticalRate": { "flagged": false, "worstRateMps": 1.200000000000001, "violatingSamples": 0 }
}
```
Shard evidence: `elevationVerticalRateSamples: []`, `elevationLoopRadiusM: 100`, `elevationStartEndDistM: null`.

Also verified against the two other D-14 pinned reals while regenerating (both `tier: 'severe'`, matching `30-CONTEXT.md`'s measured values exactly): `4745489664` (drift −197.6 m, flagged) and `3149636661` (vertical-rate spike 80.4 m/s at sample index 22, `violatingSamples: 3`, drift −172.6 m also flagged).

## Issues Encountered

`npm test` initially showed `scripts/verify-dashboard-publish-stats.test.mjs` failing with `ENOENT` on `dist/widgets/data/stats/best-efforts.json` — this worktree had not yet run `npm run build-widgets` at that point in the session (Task 2's tests don't need `dist/`). Resolved by Task 3's own `npm run build-widgets` step; a full re-run afterward showed 82/82 files, 2458/2458 tests green. Not a code defect — an ordering artifact of when `dist/` first existed in this bare worktree, consistent with the environment notes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Every published index row and shard now carries a fully-parsed `quality.elevation`, both server-side (already true since 30-01) and client-side (this plan's Task 2) — plans 30-05/30-06 can read real elevation data through `pace-quality-client.ts` without further wiring.
- The publish gate (`verify-dashboard-publish.mjs`) will fail any future build that ships elevation on some rows but not others, on both the index-row and shard-sample checks.
- Three pinned exemplar IDs and their exact shard values are recorded above for plan 30-08's checkpoint to read back against.
- No blockers for downstream plans.

---
*Phase: 30-elevation-quality-signal*
*Completed: 2026-09-18*

## Self-Check: PASSED

Both files listed under Files Created/Modified (beyond the test file) verified present on disk.
Both task commit hashes (`4336e199`, `5ea1af3c`) verified present in `git log --oneline --all`.
`data/dashboard/index.json` and `data/stats/pace-quality/*.json` regenerated locally (gitignored,
not committed, per the plan's own convention).
