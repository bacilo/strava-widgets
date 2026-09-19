# Phase 30 ELEV-02 Calibration Report

The archive-wide dry run ELEV-02 requires — every figure below is computed live by `npm run compute-elevation-calibration` against the full committed archive. Nothing here is transcribed from `30-CONTEXT.md` or `30-RESEARCH.md`; both are prior scouting measurements this run independently re-derives.

**Generated:** 2026-09-19T11:36:55.437Z

## Live denominators

- Activities: **1899** — `readdirSync('data/activities')` entries that read and JSON-parsed successfully.
- Streams present: **1874** — `readdirSync('data/streams')` entries excluding `manifest.json`.
- Streams carrying `alt`: **1874** of 1874 present streams — this is the population the three elevation detectors actually run over; every per-mode rate below divides by this number unless a different denominator is named on the same line.
- Activities with a normalizable start/end position: **1658 of 1899 (87.3%)** — computed across ALL activities, independent of stream or `alt` availability (position is activity metadata, not stream data).

## Thresholds in force

Read from the shipped `dist/analytics/pace-quality.js` module at import time — never retyped in this script.

| Mode | Threshold (as shipped) | Mechanism |
|---|---|---|
| Sub-ground | stream minimum altitude below -50 m | flags when the stream's own minimum altitude reading sits below ground level by more than this |
| Closure drift (loop-gated) | `|alt[end]-alt[start]|` over 60 m | flags a loop (start/end within the derived radius) whose altitude fails to close |
| Vertical rate | `|Δalt|/Δt` over 5 m/s | flags any single sample-to-sample pair whose implied climb/descent rate is physically implausible |

## Loop radius

`LOOP_RADIUS_M = 100` (30-RESEARCH.md § D-03). The measured start/end haversine-distance distribution over the 1658 positioned activities:

- Exactly 0 m: **1048**
- Strictly between 0 m and 100 m: **0** (a non-zero count here would mean the radius sits inside an ambiguous region, not an empty gap)
- At or above 100 m: **610**
- Minimum non-zero distance observed: 552.44 m

Every one of the 1658 positioned activities sits at either exactly 0 m or at ≥ 552.44 m — nothing falls in the open interval between them. Every value in that empty interval is **equivalent**: any radius chosen strictly between 0 m and the minimum non-zero distance produces an identical loop/non-loop partition on this archive, so the boundary is not sensitive to the exact number chosen. 100 m is used for headroom against future archive growth, not because this archive's own boundary is close to it.

## Per-mode cohorts

### Sub-ground

Flagged: **11 of 1874 (0.6%)**.

Worst three (lowest measured altitude):

- `4556693525` — -282.0 m
- `7382336793` — -189.0 m
- `5493309448` — -125.4 m

### Closure drift (loop-gated)

Flagged: **21 of 1874 (1.1%)** of the alt-carrying population; **21 of 1658 (1.3%)** of the drift-COMPUTABLE population (alt-carrying streams whose activity has a normalizable start/end position — see § Drift not-computable below for the excluded remainder).

Worst three (largest absolute signed delta):

- `4745489664` — -197.6 m (loop, 0.0 m apart)
- `3149636661` — -172.6 m (loop, 0.0 m apart)
- `5493309448` — +164.2 m (loop, 0.0 m apart)

### Vertical rate

Flagged: **39 of 1874 (2.1%)**.

Worst three (highest measured rate):

- `3149636661` — 80.4 m/s
- `5059198439` — 19.4 m/s
- `3925007542` — 18.6 m/s

## Overlap matrix (loop-gated)

| | sub-ground | closure drift | vertical rate |
|---|---|---|---|
| sub-ground | 11 | 6 | 3 |
| closure drift | 6 | 21 | 3 |
| vertical rate | 3 | 3 | 39 |

All three modes: **1**.
Union (the actual flagged cohort, loop-gated): **60 of 1874 (3.2%)**.

**Inclusion-exclusion check:** 11 + 21 + 39 − 6 − 3 − 3 + 1 = 60 — direct union = 60 — **PASS**.

## Union by device family

| Device | Count | % of union |
|---|---|---|
| Suunto 9 | 46 | 46 of 60 (76.7%) |
| Garmin fēnix 6 Pro | 11 | 11 of 60 (18.3%) |
| (no device name) | 2 | 2 of 60 (3.3%) |
| Garmin vívoactive 4 | 1 | 1 of 60 (1.7%) |

## Drift not-computable

**216 of 1874 (11.5%)** of the alt-carrying population has no normalizable start/end position and so drift is not-computable for that activity (sub-ground and vertical rate still run — D-02). This is the archive-wide cohort, not merely the fraction of the raw-34 diagnostic cohort that happens to lack position.

No position is UNKNOWN (drift genuinely could not be tested); point-to-point (§ Loop-gate exclusions below) is EXCLUDED BY DESIGN (the endpoints are real, just too far apart to call a loop) — the two are not the same disposition and are never merged in this report.

## Loop-gate exclusions (excluded by design)

Point-to-point (raw-flagged, but start/end farther apart than the loop radius):

- `3475715995` — 1410.0 m apart
- `3475724049` — 1410.0 m apart
- `3475724298` — 2828.7 m apart
- `3475736537` — 1111.9 m apart
- `3475742446` — 4122.9 m apart
- `3475743040` — 2059.9 m apart
- `3744595598` — 1111.9 m apart
- `3925007542` — 626.6 m apart
- `3963359864` — 626.6 m apart
- `4391829317` — 5441.4 m apart
- `5551478413` — 4229.8 m apart
- `5747186018` — 9583.8 m apart

No position (raw-flagged, but start/end position unavailable):

- `4598855187`

## Correction of the raw-difference count (D-04)

The raw, un-loop-gated closure-drift cohort (`|alt[end]-alt[start]| > 60` m, no loop test) is **34**. The requirement's original figure was a raw-difference measurement taken without the loop condition — this is that same raw cohort, re-derived live, not the loop-gated one the shipped detector flags.

| Cohort | Count |
|---|---|
| Raw drift (no loop gate) | 34 |
| → loop-gated, flagged | 21 |
| → excluded, point-to-point | 12 |
| → excluded, no position | 1 |

21 + 12 + 1 = 34 — reconciles exactly with the raw count above.

## Mode independence (Criterion 2)

**Raw-definition union (sub-ground ∪ raw drift ∪ vertical rate, no loop gate on drift): 71** — this is the requirement's originally-measured "71-activity" cohort, re-derived live rather than copied. It is LARGER than the loop-gated union (60, § Overlap matrix above) because the raw drift cohort itself is larger (34 vs. 21) before the 12 point-to-point and 1 no-position exclusions apply (§ Correction of the raw-difference count).

Loop-gating changes which activities overlap, not just how many drift: sub-ground ∩ drift is 6 loop-gated vs. 7 raw; sub-ground ∩ rate is 3 (drift loop-gating does not touch this pair, since it involves neither mode's drift definition directly — raw comparison: 3); drift ∩ rate is 3 loop-gated vs. 5 raw.

The loop-gated overlaps are lower than or equal to the raw ones — loop-gating removes false "drift" members that were coincidentally also flagged by another mode, so the remaining drift cohort is a cleaner, more independent signal than the raw one the requirement originally measured.

Of the 21 loop-gated drift-flagged activities, **13** are flagged by no other mode — a check bounded only by the sub-ground or vertical-rate thresholds alone would not have caught these, because their minimum altitude and their per-sample rate both stay clear of those thresholds; only the loop-gated closure test catches them. This is the discriminator proof that a floor bound alone could not have caught the drift cohort.

## Carry-forward fill and vertical rate (D-08)

Carry-forward altitude fill (`derive-stream.ts`'s `carryForward()`, applied to `alt` the same way it fills `d`) manufactures apparent vertical-rate violations; it never masks them. Masking would require an existing large single-sample jump to be smoothed away by the fill — but carry-forward fill only ever repeats a prior value or preserves an already-present jump verbatim, with no averaging step that could suppress a genuine spike. The risk runs in exactly one direction (false positives from a filled-then-jump pattern), never the other (a real spike hidden by filling).

Operationalization: a violating sample-pair is "carry-forward correlated" when the sample immediately before the jump was itself preceded by at least one more byte-identical reading (i.e. the flat value repeats at least twice before the jump, `precedingIdenticalRun >= 2`).

Measured: **39 of 72 (54.2%)** of all vertical-rate-violating sample pairs archive-wide are carry-forward correlated by this operationalization.

Worst-case trace (`3149636661`, 80.4 m/s, live-derived from the committed stream):

```
t=78  alt=191.6
t=80  alt=191.6
t=82  alt=30.8   <- the violating jump (80.4 m/s)
```

This is a reported finding, not a defect: the detector stays per-sample per D-08/D-09 — no threshold is changed on account of it.

## Stream integrity (D-16)

- Before-sweep digest (1874 files): `74b1230198ed82bd2a40612a9e88a7127ef3741574b71c438704ade1686a3e00`
- After-sweep digest (1874 files): `74b1230198ed82bd2a40612a9e88a7127ef3741574b71c438704ade1686a3e00`
- Digests **match** — `data/streams/` is byte-unchanged by this sweep.

## Regeneration

Regenerate this report against the live committed archive with:

```
npm run compute-elevation-calibration
```