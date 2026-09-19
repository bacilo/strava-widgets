---
phase: 27-per-activity-quality-signals
verified: 2026-09-10T18:10:00Z
status: passed
score: 7/7 must-haves verified (roadmap Criteria 1, 2, 3, 4a, 4b, 5 + requirements QUAL-01..05/ERA-01/ERA-02)
overrides_applied: 0
deferred: []
---

# Phase 27: Per-Activity Quality Signals Verification Report

**Phase Goal:** Every activity carries computed, individually-disclosed quality signals
(decimation ratio, impossible-sample count, gap profile, elapsed-vs-moving divergence, device
era) — precomputed in CI, badged on the activity list and detail view, severity-calibrated
against a measured archive-wide rate.

**Verified:** 2026-09-10T18:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

**Scoring note:** ROADMAP Criterion 4 was amended mid-phase (`split-the-criterion`, 2026-09-10,
recorded in `27-03-SUMMARY.md` and the ROADMAP text itself) into 4a (GATE) / 4b (REPORTED
FINDING). This report scores against the amended text, not the original "~5%" wording. The
measured 15.8% composite rate is treated as a reported finding under D-02, not a failure.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Criterion 1 — index row and shard both carry the 5 signals as separate fields | ✓ VERIFIED | Read `data/dashboard/index.json` and `data/stats/pace-quality/i183546832.json` directly: both carry `decimation`, `gapProfile`, `impossibleSamples`, `deviceEra`, `elapsedVsMoving` as independent sub-objects, plus `anySevere`/`notComputableReason`. Decimation (`tier: none`) and gapProfile (`tier: severe`) differ on the same row, confirming they do not collapse. |
| 2 | Criterion 2 — schema unchanged, shard fetched lazily | ✓ VERIFIED | `DASHBOARD_INDEX_SCHEMA_VERSION` traced via `git log -p` across the whole phase: stays `1` (unchanged since `28081b30`, pre-dating this phase). `pace-quality-client.ts` mirrors `best-efforts-client.ts`'s fetch-once/memoize/never-throw pattern exactly — zero fetches at construction, one per `load(id)` call. Round 1 R2/R3 (agent-performed browser rows, countersigned) observed 0 requests on `#/list`, then 1/1/2 across open/reopen/different-activity. |
| 3 | Criterion 3 — badges name the condition and the measured value | ✓ VERIFIED | `qualityBadgeSpecs` in `list.ts` and `qualitySignalsSectionPlan` in `detail-sections.ts` construct visible text with a rounded percentage/count inline (e.g. `${pct}% of recorded time in gaps or pauses`), confirmed by source read. R4/R5 checkpoint rows quote rendered text verbatim, cross-checked against the committed shard's own numeric fields, computed independently before the row ran — all figures matched. |
| 4a | Criterion 4a (GATE) — live denominator, classifier-independent recount, bidirectional threshold responsiveness | ✓ VERIFIED | `scripts/compute-pace-quality-recount.mjs` contains zero import/require of the classifier module (grep confirmed, `import` lines are only `fs`/`path`/`url`); ran it directly — reproduces 1890/1865/25 denominators and composite 299, matching `totals.qualityAnySevere` exactly. Its mutation test suite (`compute-pace-quality-recount.test.mjs`) demonstrates 3 mutation cases each failing on a clean-vs-mutated pair (flip a tier, delete `quality`, inject an invalid tier string) — genuinely discriminating, not self-agreeing. Threshold sensitivity table's 6 rows (3 signals × looser/stricter) are driven by real `computePaceQualitySignals(stream, metadata, overrides)` calls with literal override values in `compute-pace-quality-calibration.mjs`, not hardcoded outputs — re-ran `npm run compute-pace-quality-calibration -- --sweep` myself; it reproduced byte-identically except the timestamp. |
| 4b | Criterion 4b (REPORTED FINDING) — measured composite rate and per-signal breakdown reported | ✓ VERIFIED | Measured live: composite 299/1890 (15.8%), 299/1865 streamed (16.0%); per-signal severe cohorts decimation 154, gapProfile 127, impossibleSamples 31 — reproduced independently by (a) `compute-dashboard-index` stdout, (b) `data/dashboard/index.json` totals, (c) the recount script, (d) the calibration script re-run by this verifier. All four agree exactly. |
| 5 | Criterion 5 — device family (not file format) branches, no-device-name is explicit | ✓ VERIFIED | `resolveDeviceFamily` in `pace-quality.ts` read directly: three-outcome ladder never falls through to a fabricated name — every non-matching branch returns `rawDeviceName: null` with an explicit family (`no-device-name`, `intervals-icu`, or `unrecognized-device` with the raw string preserved). Live census matches G-02's claimed figures exactly (measured by this verifier): `garmin-fenix-6-pro` 908, `no-device-name` 663, `suunto-9` 205, `intervals-icu` 78, `strava-app-gpx` 35, `garmin-vivoactive-4` 1. R8 checkpoint confirms two different rendered family strings for same-format FIT files (fēnix 6 Pro vs. Suunto 9) and an explicit no-device-name statement for `18702664326`. |

**Score:** 6/6 roadmap truths verified (Criterion 4 counted as its two amended sub-clauses).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/pace-quality.ts` | 5-signal classifier, `hasAnySevereSignal`, `computePaceQualitySignals`, `buildPaceQualityShard` | ✓ VERIFIED | Present, exported, exercised by 2076-test suite; `resolveDeviceFamily` inspected directly, no fabrication path. |
| `scripts/compute-pace-quality-recount.mjs` | D-03 classifier-independent recount | ✓ VERIFIED | Zero classifier imports; run directly, reproduces 299/154/127/31/1890/1865/25 exactly; mutation tests genuinely discriminate. |
| `scripts/compute-pace-quality-calibration.mjs` | Archive-wide dry run + threshold sweep, `isStreamFile()` fix (G-01) | ✓ VERIFIED | Re-ran `--sweep` myself; regeneration idempotent (only the `Generated:` timestamp changed, all six sensitivity rows and both denominators unchanged). Restored the committed file afterward. |
| `src/dashboard/data/pace-quality-client.ts` | Lazy, memoized shard client mirroring `best-efforts-client.ts` | ✓ VERIFIED | Fetch-once/memoize/never-reject pattern confirmed by direct read. |
| `src/dashboard/views/list.ts` (`qualityBadgeSpecs`) | Severe-tier badges, guarded against absent `row.quality` | ✓ VERIFIED | Takes `Pick<ParsedDashboardIndexRow, 'quality'>`, returns `[]` on absence (G-04 fix confirmed in source, not just SUMMARY prose). |
| `src/dashboard/views/detail-sections.ts` | Always-on 5-row quality section, single-origin explanation probe | ✓ VERIFIED | `EXPLANATION_PROBE_QUALITY` exported and asserted non-empty at module load (G-05 fix confirmed in source). |
| `data/dashboard/index.json` + `data/stats/pace-quality/{id}.json` (1890 shards) | Shipped artifacts of record | ✓ VERIFIED | Inspected directly; shard count `ls data/stats/pace-quality/ | wc -l` = 1890, matching row count including not-computable rows. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `compute-dashboard-index.ts` | `pace-quality.ts` | `computePaceQualitySignals`/`buildPaceQualityShard` | WIRED | Confirmed by live rebuild: `compute-dashboard-index` stdout matches shipped index totals exactly. |
| `list-logic.ts` (`?severe=1` filter) | `row.quality.anySevere` | `rowIsAnySevere` | WIRED | Single URL param `severe`, presence-with-value-`'1'` semantics (D-16); no new `SortKey` added — `SORT_KEYS` unchanged at 5 entries. R6 checkpoint: filtered count 299, unfiltered 1890, both matching independent figures. |
| `detail.ts` | `pace-quality-client.ts` | `Promise.all([...])` with `paceQualityClient.load(detail.id)` | WIRED | One call site, confirmed by source read and R3's 1/1/2 fetch-count sequence. |
| `compute-pace-quality-recount.mjs` | `data/dashboard/index.json` | `readFileSync` only | WIRED, deliberately UNLINKED from classifier | Confirmed zero classifier import; this is the intended D-03 independence, not a defect. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| Activity-list severe badges | `row.quality` (per-row) | `data/dashboard/index.json`, computed by `compute-dashboard-index.ts` from real streams/metadata | Yes — verified 299 distinct severe rows with varying per-row percentages (27%, 55%, 42%, 38%, 22%, 31%, 23%, 26%, 31%, 62%, 61%, 71% observed across R6's filtered list, per-row values differ, not a fixed label) | ✓ FLOWING |
| Detail-view quality section | `paceQualityShard` | `pace-quality-client.ts` → `data/stats/pace-quality/{id}.json` | Yes — R4/R5 rows cross-checked rendered numbers against the committed shard file's own fields, computed independently before the row ran; matched exactly | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Independent recount reproduces shipped composite | `node scripts/compute-pace-quality-recount.mjs` | Composite 299, matches `totals.qualityAnySevere` and per-row flag count; exit 0 | ✓ PASS |
| Calibration regeneration is idempotent (G-01) | `npm run compute-pace-quality-calibration -- --sweep`, diff against committed file | Only `Generated:` timestamp line differs; both denominators (1865/25) and all 6 sensitivity rows unchanged | ✓ PASS |
| Full test suite green | `npm test` | 73/73 files, 2076/2076 tests passed | ✓ PASS |
| Type check clean | `npx tsc --noEmit` | 0 errors | ✓ PASS |
| Widget build succeeds | `npm run build-widgets` | Exit 0, no `css-syntax-error` | ✓ PASS |
| Publish-time verification | `npm run verify-dashboard` | 64/64 checks passed, including 3 `pace-quality/{id}.json` spot-checks | ✓ PASS |
| Phase 26 regression (residual script) unaffected | `node scripts/compute-pace-residual.mjs` | Cohort 154, residual 14, "153 strictly improved, 1 tied at zero, 0 regressed" | ✓ PASS |
| Device-family census reproduces G-02's cited figures | ad hoc script over `data/dashboard/index.json` | `garmin-fenix-6-pro` 908, `no-device-name` 663, `suunto-9` 205, `intervals-icu` 78, `strava-app-gpx` 35, `garmin-vivoactive-4` 1 | ✓ PASS (matches G-02 exactly) |

Note: repository working tree was restored to its committed state after each of the above regeneration runs (`git checkout --` on `27-CALIBRATION.md` and `26-RESIDUAL.md`); no artifact of record was left modified by this verification pass.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUAL-01 | 27-02, 27-04 | 5 signals computed in CI, never in-browser | ✓ SATISFIED | `pace-quality.ts` pure functions called only from `compute-dashboard-index.ts`; index row + shard both carry the fields, confirmed by direct inspection. |
| QUAL-02 | 27-02 | Signals disclosed individually, era/decimation stay separate | ✓ SATISFIED | Confirmed on live data: activity `i183546832` has `decimation.tier: none` and `gapProfile.tier: severe` simultaneously — independently varying fields. |
| QUAL-03 | 27-04, 27-06 | Index additive, shard lazy | ✓ SATISFIED | Schema version traced unchanged; client mirrors `best-efforts-client.ts`; R2/R3 confirm fetch counts. |
| QUAL-04 | 27-07, 27-09 | Badges explain, name value | ✓ SATISFIED | Source confirms inline numeric text; R4/R5 confirm rendered text matches shard data. |
| QUAL-05 | 27-02, 27-03, 27-11 | Calibrated against measured, independently re-derived rate | ✓ SATISFIED (with recorded tension) | Criterion 4a/4b both verified; QUAL-05's own "materially above ~5% is a calibration failure" language is left in deliberate, recorded tension with the measured 15.8% per D-02/split-the-criterion — this is documented, not an oversight, and is not treated as a gap per this task's explicit instruction. |
| ERA-01 | 27-01, 27-02 | Device family, not file format, drives branching | ✓ SATISFIED | fēnix 6 Pro / Suunto 9 (both FIT) resolve to different families in source and in R8. |
| ERA-02 | 27-01, 27-02 | No-device-name is its own explicit category | ✓ SATISFIED (cohort-size figure stale, behavior confirmed) | `resolveDeviceFamily`'s fallback ladder never fabricates a name (source-verified); R8 confirms rendered explicit statement. The cited "716 of 1,864" cohort size in ROADMAP/REQUIREMENTS is stale against the live 663/1890 — see G-02 disposition below. |

No orphaned requirements: all 7 IDs (QUAL-01..05, ERA-01, ERA-02) declared across plan frontmatter and all mapped to Phase 27 in `REQUIREMENTS.md`, all ticked Complete with cited evidence that this verification independently reproduced.

### Anti-Patterns Found

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file modified by this phase. No unguarded stub returns, no silently-swallowed empty states beyond the deliberate, documented `?? ''` unreachable-defense-in-depth pattern in `detail-sections.ts` (which is now backed by an eager module-load throw, not a bare fallback — confirmed in source).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/views/list.test.ts` | ~635-644 | Only `decimation`'s severe+null-evidence combination is directly tested; `gapProfile`/`impossibleSamples` severe+null are not | ⚠️ Warning (WR-02, open) | The production guard (`&& field !== null`) is correct by inspection for all three signals, but two of the three lack a demonstrated-failing/passing test pair. Non-blocking — code is correct, coverage is incomplete. |
| `src/dashboard/views/list.test.ts`, `src/dashboard/row-semantics.test.ts` | multiple | Duplicate `composeRowAriaLabel(` occurrence-count assertion across two test files (WR-03) | ℹ️ Info | Legitimate regression guard, just duplicated; no risk, optional cleanup. |

### Human Verification Required

None outstanding. The Round 1 browser checkpoint (R1–R8, all PASS) already discharged every item this phase's own validation strategy flagged as needing a human/browser reading (zero-fetch/one-fetch network panel reading, badge verbatim text, filtered-count reading, device-family strings). Provenance is agent-performed browser automation (Claude in Chrome), explicitly countersigned by the developer 2026-09-10 — a deliberate provenance choice ("Agent-performed, you countersign"), not a shortcut hidden from the record.

**Assessment of that provenance choice, as requested:** adequate for Criteria 2/3/5. Reasoning: every row's expected value was stated in writing, independently derived from the committed shard/index data, *before* the row was run (not fitted after the fact); the quoted observations are specific and falsifiable (exact percentages, exact interval counts, exact fetch-count sequences) rather than vague "looks right" assertions; and three of the eight rows (R1, R6, R7) have a second, fully independent verification path this verifier re-ran directly (served-bundle digest, `compute-pace-quality-recount.mjs`, and the calibration sweep respectively) that agrees with the browser-reported figures exactly. The one residual risk inherent to this provenance model — that "Claude in Chrome" could misread or fabricate a DOM observation with no independent human eyeball on the actual pixels — is not fully closeable by this verifier (no browser tool available in this session), but the cross-checked, pre-stated-expectation design of R4/R5/R6/R8 substantially narrows that risk relative to a bare "I looked, it's fine" claim. Recorded plainly rather than silently accepted.

### Gaps Summary

No blocking gaps. Two gaps remain open by design, both correctly non-blocking:

- **G-02 (documentation-only, WARNING):** ROADMAP Criterion 5 and REQUIREMENTS.md's ERA-02 cite a stale "716 of 1,864 (38%)" no-device-name cohort. Live measured: 663 of 1,890. This verifier independently reproduced the live census and it matches G-02's own reported figures exactly. The shortfall is explained by improved classification (activities that previously fell into the default now resolve to `intervals-icu`/`strava-app-gpx`/`garmin-vivoactive-4`) plus the deliberate removal of the colliding `unknown-device` taxonomy value in plan 27-01 — not a defect. ERA-02's behavioral requirement (explicit category, never a fabricated name) is independently confirmed by this verifier's source read of `resolveDeviceFamily`. **Disposition: documentation debt, not phase-blocking.** Recommend a follow-up edit to ROADMAP.md/REQUIREMENTS.md's cited figure; does not require a code-touching gap-closure plan.
- **G-03 (out of Phase 27 scope, WARNING):** `scripts/compute-pace-residual.mjs` (a Phase 26 artifact) carries the identical `manifest.json` miscount G-01 fixed in Phase 27's calibration script, inflating its reported "Archive size scanned" by one (1866 vs. the true 1865 per-activity stream count). This verifier re-ran the script directly: the severe cohort (154), residual (14), and the "153 strictly improved, 1 tied at zero, 0 regressed" Criterion-1 result are all unaffected — only the printed scanned-count is off by one. Editing a prior phase's committed artifact of record from inside Phase 27 would itself violate D-02/D-04's boundary discipline. **Disposition: correctly out of scope for Phase 27's own closure; tracked as Phase 26 documentation/tooling debt for a future gap-closure plan, using G-01's now-committed `isStreamFile()` helper as the reference fix.** Does not block Phase 27 or the Phase 26 regression gate this phase already passed against it.

One additional non-blocking item surfaced by this verifier's own review-cross-check (not a new discovery — WR-02 from `27-REVIEW.md`, left open by plan 27-12's scope, which only closed the Critical (G-04) and the WR-01/G-05 warning): `gapProfile`/`impossibleSamples` severe-tier-with-null-evidence combinations lack a direct test, though the guard code covering them is correct by inspection. Recommend closing opportunistically in a future touch of `list.test.ts`; does not gate this phase.

---

_Verified: 2026-09-10T18:10:00Z_
_Verifier: Claude (gsd-verifier)_
