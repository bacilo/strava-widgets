---
phase: 30-elevation-quality-signal
verified: 2026-09-18T20:35:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 30: Elevation Quality Signal Verification Report

**Phase Goal:** Implausible altitude is flagged archive-wide by three independent mechanisms (sub-ground-level, barometric closure drift, implausible vertical rate) spanning all device families — flag only, no correction.
**Verified:** 2026-09-18T20:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Three total detectors exist at −50 m / 60 m / 5 m/s with a derived `LOOP_RADIUS_M = 100` | ✓ VERIFIED | `grep -c "export function subGroundSignal\|export function closureDriftSignal\|export function verticalRateSignal" src/analytics/pace-quality.ts` = 3; `ElevationTier` is a clean three-member union (`'severe'\|'none'\|'not-computable'`), no `'minor'` |
| 2 | Elevation is the sixth signal and stays outside `anySevere` (D-06) | ✓ VERIFIED | `hasAnySevereSignal(signals: Pick<ActivityQualitySignals, 'decimation' \| 'gapProfile' \| 'impossibleSamples'>)` — unchanged; test `anySevere excludes elevation` passes; `node scripts/compute-pace-quality-recount.mjs --expect 299` prints PASS (composite unmoved) |
| 3 | Loop-gated drift fires only within 100 m radius AND >60 m altitude delta; distinguishable not-computable/excluded/clear/flagged states | ✓ VERIFIED | `closureDriftRow` renders four distinct phrasings; recounted `closureDrift.state==='flagged'` = 21 matches `30-CALIBRATION.md`/REQUIREMENTS.md |
| 4 | Every published index row carries `quality.elevation`; publish gate fails a partial rollout | ✓ VERIFIED | Live `data/dashboard/index.json`: 1890/1890 rows carry `quality.elevation`; `QUALITY_SUB_KEYS` in `verify-dashboard-publish.mjs` includes `'elevation'` (6 keys); `npm run verify-dashboard` 66/66 PASS |
| 5 | Client parse degrades stale/malformed elevation to not-computable, never throws, never fabricates 0 | ✓ VERIFIED | `parseElevationSignal` + `VALID_ELEVATION_TIERS` present, tested; CR-01 fix additionally guards the unparsed index-row path (`elevation !== undefined`, `quality?.elevation?.tier`, `NOT_COMPUTABLE_ELEVATION` fallback) |
| 6 | Archive-wide calibration report exists, derives the loop radius, proves `data/streams/` byte-unchanged | ✓ VERIFIED | `30-CALIBRATION.md` has 13 `## ` sections (≥12 required); digest before/after match (`0a7836d2...`); `git status --porcelain data/` empty |
| 7 | Independent recount reproduces cohorts from the shipped index alone, never imports the classifier | ✓ VERIFIED | `grep -c "pace-quality" scripts/compute-elevation-recount.mjs` = 0; live run: union 60, inclusion-exclusion MATCH, device breakdown matches REQUIREMENTS.md |
| 8 | Recount fails closed when elevation is absent from all rows (D-15's stated purpose) | ✓ VERIFIED | CR-02 fix confirmed in source: `evaluateReport` now pushes a problem on non-empty `missingElevationIds`; `main()` prints the count |
| 9 | One severe-only badge per row on all `renderActivityRow` surfaces, naming fired mode(s) with measured value | ✓ VERIFIED | `elevationBadgeContent` wired into `qualityBadgeSpecs`; live shard-matched example: activity 16028352681 → `spike 9 m/s`, `anySevere: false` (confirmed directly against `data/dashboard/index.json`) |
| 10 | Detail view shows three always-on elevation lines (healthy and flagged) plus Elevation Gain caveat only when flagged | ✓ VERIFIED | `subGroundRow`/`closureDriftRow`/`verticalRateRow` present; `qualitySignalsSectionPlan` returns 8 rows; `elevationStatCard` + `appendAccessibleBadge(elevationStatCard...)` wired in `detail.ts` |
| 11 | Round 1 browser checkpoint (R1–R8) performed and recorded, requirements ticked only after PASS | ✓ VERIFIED | `30-VALIDATION.md` records 8/8 PASS verdicts with quoted DOM evidence; independently spot-checked 3 of the cited activity IDs directly against the live index — all values match verbatim |
| 12 | ROADMAP/REQUIREMENTS corrected to the loop-gated count (D-04), citing `30-CALIBRATION.md` | ✓ VERIFIED | `grep -c "34 barometric-closure-drift" .planning/ROADMAP.md` = 0; both docs state "raw-difference" and cite `30-CALIBRATION.md`; ELEV-01/ELEV-02 ticked with full provenance |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/pace-quality.ts` | `ElevationSignal`, 3 detectors, sixth signal key | ✓ VERIFIED | All present; `hasAnySevereSignal` Pick<> unwidened |
| `src/analytics/pace-fixtures.ts` | 3 synthetic single-mode fixtures + 2 pinned reals | ✓ VERIFIED | `4745489664`, `3149636661` rows present; switch cases for `minAltM`/`driftDeltaM`/`startEndDistM`/`worstRateMps` present |
| `src/analytics/compute-dashboard-index.ts` | `startLatlng`/`endLatlng` on qualityMetadata | ✓ VERIFIED | 1890/1890 rows carry `quality.elevation` in live index |
| `src/dashboard/data/pace-quality-client.ts` | `parseElevationSignal` tolerant parse | ✓ VERIFIED | present, tested |
| `src/dashboard/views/list.ts` | fourth `qualityBadgeSpecs` block | ✓ VERIFIED | `elevationBadgeContent`, `descriptionIdSuffix: 'elevation'` present; CR-01 guard added |
| `src/dashboard/views/detail.ts` | Elevation Gain stat-card badge | ✓ VERIFIED | `elevationStatCard` wired, guarded (`quality?.elevation?.tier`) |
| `src/dashboard/views/detail-sections.ts` | 3 always-on rows + notAvailableRows extension | ✓ VERIFIED | 8-row plan confirmed; CR-01 guard (`NOT_COMPUTABLE_ELEVATION` fallback) added |
| `scripts/compute-elevation-calibration.mjs` | sweep + digest gate + markdown renderer | ✓ VERIFIED | live run produces matching digests, union 60 |
| `scripts/compute-elevation-recount.mjs` | independent shipped-index recount | ✓ VERIFIED | live run PASS, union 60, CR-02 fail-closed fix confirmed |
| `.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md` | archive-wide report | ✓ VERIFIED | 13 sections, digest match stated, idempotence claimed and consistent with regen script behavior |
| `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md` | corrected loop-gated figures | ✓ VERIFIED | both ticked, both cite `30-CALIBRATION.md` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `computePaceQualitySignals` | `elevationSignal(stream, metadata)` | 6th key on returned literal | WIRED | confirmed by type presence and passing tests |
| `closureDriftSignal` | haversine `EARTH_RADIUS_M = 6371000` | shared/copied formula | WIRED | `derive-stream.ts` `ALT_MIN`/`ALT_MAX` untouched (git log confirms unmodified since Phase 14) |
| `compute-dashboard-index.ts qualityMetadata` | `activity.start_latlng`/`end_latlng` | existing per-activity loop, no new read | WIRED | live index confirms 1658/1890 positioned rows compute drift state correctly |
| `data/dashboard/index.json` rows | `quality.elevation` | additive row field, schemaVersion unchanged | WIRED | 1890/1890 confirmed live |
| `list.ts qualityBadgeSpecs` | `row.quality.elevation` | fourth if block, CR-01 guarded | WIRED | live example (16028352681) badge text matches detector output exactly |
| `detail.ts Elevation Gain stat card` | `indexClient.getRow(detail.id)?.quality?.elevation` | `appendAccessibleBadge`, CR-01 guarded | WIRED | code confirmed, no new fetch (`paceQualityClient.load` still 1 call site) |
| `detail-sections.ts qualitySignalsSectionPlan` | `quality.elevation.subGround/closureDrift/verticalRate` | 3 row builders, CR-01 guarded | WIRED | 8-row plan confirmed by function presence and test count |
| `scripts/compute-elevation-recount.mjs` | `data/dashboard/index.json` | direct file read, own arithmetic | WIRED | live run reproduces union 60 with inclusion-exclusion MATCH, no classifier import |
| `30-VALIDATION.md checkpoint rows` | committed shard / calibration report / recount stdout | independently derived expected values | WIRED | 3 of the cited exemplar IDs (4556693525, 17257505831, 16028352681) spot-checked directly against live `data/dashboard/index.json` — all values matched the checkpoint's quoted evidence exactly |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `npm test` | 84 files / 2548 tests passed | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| D-06 composite unmoved | `node scripts/compute-pace-quality-recount.mjs --expect 299` | PASS, composite 299, per-signal decimation 154/gapProfile 127/impossibleSamples 31 | ✓ PASS |
| Independent elevation recount | `node scripts/compute-elevation-recount.mjs` | union 60, inclusion-exclusion MATCH, no disagreements | ✓ PASS |
| Publish gate | `npm run verify-dashboard` | 66/66 checks passed, 6 named sub-keys confirmed on sampled rows | ✓ PASS |
| Elevation-only exemplar reproduces on live data | `node -e` against `data/dashboard/index.json` | 16028352681: `verticalRate.flagged:true, worstRateMps:9`, `anySevere:false`; elevation-only count = 22; total rows 1890; `totals.qualityAnySevere` 299 | ✓ PASS |
| Severe/healthy exemplars reproduce on live data | `node -e` against `data/dashboard/index.json` | 4556693525 and 17257505831 values match `30-VALIDATION.md`'s quoted evidence exactly | ✓ PASS |
| CR-01 fix present | `grep` on `list.ts`/`detail.ts`/`detail-sections.ts` | all three guard sites present | ✓ PASS |
| CR-02 fix present | `grep` on `compute-elevation-recount.mjs` | `evaluateReport` fails closed on `missingElevationIds` | ✓ PASS |
| WR-01/WR-04 fixes present | `grep` on calibration script / detail-sections.ts | live counts used, `violatingSamples ?? 0` replaced with explicit "unavailable" branch | ✓ PASS |
| Elevation vitest suites green | `npx vitest run scripts/compute-elevation-calibration.test.mjs scripts/compute-elevation-recount.test.mjs src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts` | 4 files, 175 tests passed | ✓ PASS |
| No debt markers in phase-touched files | `grep -n "TBD\|FIXME\|XXX"` across 17 touched files | 0 matches | ✓ PASS |
| No `innerHTML` introduced | `grep -c innerHTML` on list.ts/detail.ts/detail-sections.ts | 0/0/0 | ✓ PASS |
| D-13 honored (no filter added) | `grep -c elevation src/dashboard/views/list-logic.ts` | 0 | ✓ PASS |
| D-12 honored (no other surface caveated) | `git diff --stat src/analytics/compute-stats.ts src/dashboard/views/overview.ts` | no diff | ✓ PASS |
| ALT_MIN untouched | `git log -- src/streams/derive-stream.ts` | last touched Phase 14 (`e8520e4f`), value still `-500` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ELEV-01 | 30-01, 30-03, 30-04, 30-05, 30-06 | Implausible altitude detected/flagged by mechanism, all device families | ✓ SATISFIED | Ticked with full checkpoint provenance; live data confirms 60-activity union across 4 device families (Suunto 9 46, fēnix 6 Pro 11, no device name 2, vívoactive 4 1) exactly matching REQUIREMENTS.md text |
| ELEV-02 | 30-02, 30-04, 30-07, 30-08 | Validated archive-wide, not just the scoping exemplar | ✓ SATISFIED | `30-CALIBRATION.md` (classifier-derived) and `compute-elevation-recount.mjs` (index-derived, no classifier import) independently agree on union 60; both live-reproduced during this verification |

No orphaned requirement IDs found for Phase 30 in REQUIREMENTS.md beyond ELEV-01/ELEV-02.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/views/list.ts:516` | badge text | double-negative "altitude −282 m below ground" (WR-02) | ℹ️ Info | Open by product decision — pinned by tests, blessed by the developer's approved Round 1 checkpoint (R2/R5). Does not contradict any must-have truth (D-10 requires condition+number, not specific phrasing). |
| `src/dashboard/views/detail-sections.ts:1170` | `closureDriftRow` | stream-less activities get "position unknown" wording instead of the whole-signal not-computable reason (WR-03) | ℹ️ Info | Open by product decision — pinned by tests, same checkpoint provenance. Still reads not-computable, never a healthy statement or a fabricated 0 (T-26-02 intact); does not contradict must-have truth 3. |
| various | — | IN-01..IN-07 (unused param, client-fabricated loop radius default, stale doc comments, unescaped markdown cell, minor definitional drift, unsafe object key, off-by-one diagnostic index) | ℹ️ Info | All cosmetic/low-risk, explicitly carried forward as open by the review; none touches a must-have truth or a security-relevant boundary. |

No unresolved TBD/FIXME/XXX markers found in any phase-touched file (checked explicitly per the debt-marker gate).

### Human Verification Required

None. The phase's own human-verify checkpoint (30-VALIDATION.md § Round 1 Checkpoint, R1–R8) was completed during phase execution, performed by the orchestrating agent in the developer's own Chrome session at the developer's explicit direction, with quoted DOM/network evidence and a developer sign-off ("approved", blanket). This verification independently reproduced three of the checkpoint's cited exemplar activities (4556693525, 17257505831, 16028352681) directly against the live `data/dashboard/index.json` and confirmed every quoted value matches exactly — the checkpoint evidence is not merely narrated, it is reproducible. Per the orchestrator's explicit guidance, this round is treated as satisfied and is not reopened as human_needed.

### Gaps Summary

No gaps. All 12 derived must-have truths verified against live command output and direct inspection of the shipped `data/dashboard/index.json`, not against SUMMARY.md narration. The two Critical findings from `30-REVIEW.md` (CR-01 unguarded index-row reads, CR-02 recount PASSing a total signal drop) were fixed in commits `437adf63` and `de954dd6` respectively, each verified present in the current tree with the full suite green (84 files / 2548 tests) and `npx tsc --noEmit` clean. Two Warnings (WR-02 badge phrasing, WR-03 drift-row misattribution for the stream-less cohort) remain open by explicit product decision, pinned by tests and the developer's own checkpoint sign-off; neither contradicts a must-have truth. Seven Info-level findings are cosmetic and carried forward. D-06's boundary (elevation excluded from `anySevere`) was independently re-confirmed live: the Phase 27 composite recount reports the unchanged value 299, and a specific elevation-only-flagged activity (16028352681, `vertic.rate.flagged: true`, `anySevere: false`) was reproduced directly from the shipped index. ELEV-01 and ELEV-02 are correctly ticked in REQUIREMENTS.md with full provenance, and the ROADMAP/REQUIREMENTS text corrections (D-04) are present and grep-confirmed.

---

_Verified: 2026-09-18T20:35:00Z_
_Verifier: Claude (gsd-verifier)_
