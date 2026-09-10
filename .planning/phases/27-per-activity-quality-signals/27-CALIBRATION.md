# Phase 27 QUAL-05 Calibration Report

The measured composite severe rate — the true union across all three per-activity quality tiering signals (`decimation`, `gapProfile`, `impossibleSamples`) — over the full live committed archive, produced entirely by `npm run compute-pace-quality-calibration`. Every figure below is computed by THIS run; nothing is transcribed from `27-RESEARCH.md`, `27-CONTEXT.md` or `26-RESIDUAL.md` except the threshold justifications in section 2, which are quoted and attributed.

**Generated:** 2026-09-10T13:56:52.553Z

## 1. Denominators (computed live)

- Activity count: **1890** — `readdirSync('data/activities').filter(f => f.endsWith('.json'))` entries that read and JSON-parsed successfully.
- Stream-file count: **1866** — `readdirSync('data/streams').filter(f => f.endsWith('.json'))` entries.
- Stream-less count: **24** — `1890 - 1866 = 24` (arithmetic difference).

Every per-signal and composite rate below is reported against BOTH denominators: the **activity-count denominator** (1890, all activities including the 24 stream-less ones, which report `notComputableReason` and are never counted in the severe numerator) and the **stream-count denominator** (1866, only activities with a computable stream).

This run supersedes ROADMAP Criterion 4's cited "1,864-activity archive" / "≈90 activities" and CONTEXT D-06's cited "1,890/1,866" — this run measured 1890 activity files and 1866 stream files live; do not treat 1,864, 1,866 or 1,890 as expected values anywhere else in this report.

## 2. Thresholds in Force

Quoted verbatim from `27-02-SUMMARY.md`'s "Decisions Made" section. No override applied in this baseline run.

**Decimation (D-04, reused verbatim from Phase 26's cohort rule):**
> `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION = 0.15`, `DECIMATION_SEVERE_MIN_SAMPLES = 50` — the exact same pair that defines `26-RESIDUAL.md`'s 154-activity severe-decimation cohort. Not this phase's to retune; D-04 locks it.

**Gap profile (`GAP_PROFILE_SEVERE_FRACTION = 0.2`):**
> (1) WHAT IT MEASURES: `(recordingGapSec + pauseSec) / spanSec`. (2) MECHANISM: once a fifth or more of a stream's own recorded span carries no measured pace, a pace distribution/splits table/average-pace figure stops truthfully describing the whole run. (3) MEASURED (live archive): >15% -> 197 (10.6%); >20% -> 127 (6.8%, CHOSEN); >25% -> 88 (4.7%). (4) NOT CHOSEN TO LAND UNDER 5%: 20% is the mechanism cut, not the closest-to-5% cut — 25% would clear ~5% alone and was not chosen for that reason.

**Impossible-sample floor and cut (`IMPOSSIBLE_SAMPLE_SEVERE_COUNT = 10`, physical floor `WORLD_RECORD_100M_SPEED_MPS`):**
> (1) FLOOR: Usain Bolt's 100m world record speed (9.58s, 2009) — exceeding it once is a fact about the recording, never the runner. (2) FORM: raw count, not a fraction — a discrete event, not a proportional descriptor. (3) MECHANISM: one impossible sample is unremarkable; ten independent readings is not what an occasionally-noisy channel produces. (4) MEASURED: >=5 -> 71 (3.8%); >=10 -> 31 (1.7%, CHOSEN); >=20 -> 10 (0.5%). (5) MEASURED OVERLAP with the severe-decimation cohort at the chosen cut: 4/31 (12.9%), far below the raw >=1 population's 90% — because >=10 already excludes the single-glitch population driving that 90% figure. (6) NOT CHOSEN TO LAND UNDER 5%: >=10 is the mechanism point in (3); >=5 (3.8%) would still individually clear ~5% and was not chosen for producing a smaller number.

## 3. Per-Signal Severe Cohorts

| Signal | Severe count | % of activity count | % of stream count | Minor count |
|---|---|---|---|---|
| Decimation (D-04) | 154 | 8.1% | 8.3% | 56 |
| Gap profile | 127 | 6.7% | 6.8% | 337 |
| Impossible samples | 31 | 1.6% | 1.7% | 631 |

Device era and elapsed-vs-moving are untiered facts (D-13/D-14) and contribute NOTHING to the composite below — reported here only as distributions for context.

**Device family census (untiered):**

| Family | Count | % of activity count |
|---|---|---|
| garmin-fenix-6-pro | 908 | 48.0% |
| no-device-name | 663 | 35.1% |
| suunto-9 | 205 | 10.8% |
| intervals-icu | 78 | 4.1% |
| strava-app-gpx | 35 | 1.9% |
| garmin-vivoactive-4 | 1 | 0.1% |

**Elapsed-vs-moving ratio quantile summary (untiered, non-null ratios only):**

- n = 1890; p10 = 1.00; p50 = 1.02; p90 = 1.18; max = 30.97

## 4. THE COMPOSITE — the actual union

**299** activities carry `anySevere === true` — computed as the size of the `Set` of activity ids for which `hasAnySevereSignal` is `true` (see `reduceCompositeUnion` in this script), NOT the sum of the three marginals above (154 + 127 + 31 = 312) and NOT an inclusion-exclusion estimate.

- Against the activity-count denominator: 15.8% (299 of 1890).
- Against the stream-count denominator: 16.0% (299 of 1866).

**Three-way overlap breakdown:**

- Exactly one signal severe: 286; exactly two: 13; all three: 0.
- Pairwise intersections: decimation ∩ gapProfile = 8; decimation ∩ impossibleSamples = 4 (12.9% of the impossible-sample-severe cohort); gapProfile ∩ impossibleSamples = 1.

**Sanity gate:** max(marginals) = 154 <= composite = 299 <= sum(marginals) = 312 -> **PASS**

## 5. The D-02 Disposition Paragraph

**FINDING, not a defect.** The measured composite severe rate is 299 of 1890 activities (15.8% of the activity-count denominator, 16.0% of the 1866-stream denominator) — materially above ROADMAP Criterion 4's "~5%" ceiling. D-04's locked severe-decimation cohort alone is 154 activities (8.1% of the activity-count denominator), already above ~5% before the other two signals contribute anything, and accounts for the bulk of the composite. D-02 forbids retuning any threshold backward from the ~5% target, and D-04 forbids narrowing the decimation rule below Phase 26's cohort definition. No threshold was moved in this run to change this number. The disposition on what Criterion 4 should mean given this measured rate is the developer's, recorded at this plan's checkpoint (Task 3).

## 6. The D-04 Boundary Cross-Check

Ran `npm run compute-pace-residual` live and compared the regenerated `26-RESIDUAL.md` against the version committed as of Phase 26's close (read from disk before regeneration).

- Committed (pre-regeneration) severe-decimation cohort size: **154**; residual list size: **14**.
- Regenerated (live) severe-decimation cohort size: **154**; residual list size: **14**.
- 14-activity residual list match by id: **MATCH** (committed: [4556693525, 5059204779, 3925007542, 3647739864, 4548213751, 5520899318, 5566805363, 4531479183, 5465833080, 5246078056, 4569639779, 4667351283, 3789623232, 4332544744]; regenerated: [4556693525, 5059204779, 3925007542, 3647739864, 4548213751, 5520899318, 5566805363, 4531479183, 5465833080, 5246078056, 4569639779, 4667351283, 3789623232, 4332544744]).
- Severe-decimation cohort size has NOT drifted from the committed figure.

## 7. Regeneration

Regenerate this report against the live committed archive with:

```
npm run compute-pace-quality-calibration
```

Regenerate with the Threshold Sensitivity section appended:

```
npm run compute-pace-quality-calibration -- --sweep
```
