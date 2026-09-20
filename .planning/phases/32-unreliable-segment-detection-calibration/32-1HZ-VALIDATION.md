# 1 Hz FIT Cross-Check of Detected Unreliable Segments (D-12)

As of: 2026-09-20

LOCAL-ONLY, VALIDATION ONLY. Derives no constant; the calibration artifact (`32-CALIBRATION.md`) and the shipped detector constants are unaffected by anything in this file. Regenerate with `npm run validate-unreliable-segments-1hz -- --as-of <date>` on a machine with a local, gitignored `export_data/strava/` bulk export.

## Method

Sample: every segment the shipped detector (`detectUnreliableSegments`, `DEFAULT_DETECTOR_PARAMS`) finds on the four named scoping activities (3475724402, 3475734189, 3475740390, 4556693525), plus every segment on the first 20 flagged activities (by numeric activity id, ascending) that have a `.fit.gz` original in `activities.csv`. FIT record timestamps are aligned to the committed stream's relative seconds via `data/activities/{id}.json`'s `start_date`. Over each segment's `[startSec, endSec]` window, the 1 Hz sample count, metres/seconds spanned, and the fastest single 1 Hz consecutive-pair speed are measured directly from the FIT original — never from the committed, decimated stream.

## Per-activity alignment

| Activity | FIT original | 1 Hz samples (w/ distance) | Alignment residual (median abs m) | Segments |
|---|---|---|---|---|
| 3475724402 | activities/3711971403.fit.gz | 3655 | 0.03 | 16 |
| 3475734189 | activities/3711981809.fit.gz | 2388 | 0.03 | 1 |
| 3475740390 | activities/3711988502.fit.gz | 909 | 0.02 | 5 |
| 4556693525 | activities/4868274524.fit.gz | 3352 | 0.00 | 3 |
| 3475710182 | activities/3711956054.fit.gz | 1735 | 0.02 | 4 |
| 3475711030 | activities/3711957052.fit.gz | 864 | 0.02 | 1 |
| 3475711335 | activities/3711957340.fit.gz | 870 | 0.02 | 1 |
| 3475711346 | activities/3711957277.fit.gz | 2084 | 0.03 | 2 |
| 3475711373 | activities/3711957417.fit.gz | 864 | 0.02 | 3 |
| 3475711383 | activities/3711957326.fit.gz | 1743 | 0.03 | 1 |
| 3475711403 | activities/3711957448.fit.gz | 856 | 0.02 | 3 |
| 3475711429 | activities/3711957475.fit.gz | 1115 | 0.02 | 7 |
| 3475711446 | activities/3711957436.fit.gz | 1736 | 0.03 | 1 |
| 3475711450 | activities/3711957397.fit.gz | 2171 | 0.02 | 8 |
| 3475711469 | activities/3711957515.fit.gz | 854 | 0.03 | 2 |
| 3475711501 | activities/3711957499.fit.gz | 2065 | 0.03 | 2 |
| 3475711630 | activities/3711957609.fit.gz | 2008 | 0.02 | 4 |
| 3475711677 | activities/3711957707.fit.gz | 1129 | 0.03 | 1 |
| 3475711768 | activities/3711957829.fit.gz | 853 | 0.03 | 7 |
| 3475711822 | activities/3711957902.fit.gz | 872 | 0.02 | 1 |
| 3475711886 | activities/3711957925.fit.gz | 1336 | 0.02 | 6 |
| 3475711902 | activities/3711957969.fit.gz | 865 | 0.03 | 1 |
| 3475711917 | activities/3711957947.fit.gz | 882 | 0.03 | 2 |
| 3475711993 | activities/3711958015.fit.gz | 874 | 0.03 | 1 |

## Per-segment 1 Hz measurement

| Activity | Mechanism | startSec | endSec | Committed m | Committed s | Committed speed (m/s) | 1 Hz samples in window | 1 Hz m | 1 Hz s | Max 1 Hz pair speed (m/s) | Burst exists at 1 Hz |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3475724402 | gap-adjacent | 1030 | 1048 | 52.4 | 18.0 | 2.91 | 4 | 52.4 | 18.0 | 18.96 | yes |
| 3475724402 | gap-adjacent | 1064 | 1135 | 288.6 | 71.0 | 4.06 | 16 | 288.6 | 71.0 | 29.28 | yes |
| 3475724402 | gap-adjacent | 1461 | 1515 | 124.6 | 54.0 | 2.31 | 8 | 124.5 | 54.0 | 29.39 | yes |
| 3475724402 | gap-adjacent | 1589 | 1611 | 52.2 | 22.0 | 2.37 | 4 | 52.2 | 22.0 | 17.52 | yes |
| 3475724402 | gap-adjacent | 1729 | 1760 | 88.4 | 31.0 | 2.85 | 6 | 88.3 | 31.0 | 29.44 | yes |
| 3475724402 | gap-adjacent | 2102 | 2125 | 53.4 | 23.0 | 2.32 | 4 | 53.4 | 23.0 | 14.46 | yes |
| 3475724402 | gap-adjacent | 2139 | 2169 | 90.1 | 30.0 | 3.00 | 6 | 90.1 | 30.0 | 26.67 | yes |
| 3475724402 | gap-adjacent | 2179 | 2236 | 157.5 | 57.0 | 2.76 | 8 | 157.5 | 57.0 | 29.50 | yes |
| 3475724402 | gap-adjacent | 2491 | 2525 | 81.7 | 34.0 | 2.40 | 5 | 81.7 | 34.0 | 29.30 | yes |
| 3475724402 | gap-adjacent | 2957 | 3067 | 305.4 | 110.0 | 2.78 | 14 | 305.4 | 110.0 | 29.47 | yes |
| 3475724402 | gap-adjacent | 3438 | 3456 | 49.2 | 18.0 | 2.73 | 4 | 49.2 | 18.0 | 16.11 | yes |
| 3475724402 | gap-adjacent | 3486 | 3547 | 157.8 | 61.0 | 2.59 | 9 | 157.8 | 61.0 | 29.43 | yes |
| 3475724402 | gap-adjacent | 3975 | 4028 | 154.4 | 53.0 | 2.91 | 9 | 154.4 | 53.0 | 29.41 | yes |
| 3475724402 | gap-adjacent | 4056 | 4121 | 201.7 | 65.0 | 3.10 | 11 | 201.6 | 65.0 | 29.44 | yes |
| 3475724402 | gap-adjacent | 4133 | 4212 | 219.0 | 79.0 | 2.77 | 14 | 219.0 | 79.0 | 29.44 | yes |
| 3475724402 | gap-adjacent | 4238 | 4263 | 72.3 | 25.0 | 2.89 | 5 | 72.3 | 25.0 | 18.28 | yes |
| 3475734189 | hidden-pause | 1352 | 1360 | 181.5 | 8.0 | 22.69 | 9 | 181.6 | 8.0 | 29.70 | yes |
| 3475740390 | isolated-jump | 2347 | 2350 | 30.1 | 3.0 | 10.03 | 2 | 30.1 | 3.0 | 10.04 | yes |
| 3475740390 | isolated-jump | 2508 | 2513 | 52.4 | 5.0 | 10.48 | 2 | 52.4 | 5.0 | 10.48 | yes |
| 3475740390 | isolated-jump | 2536 | 2538 | 28.6 | 2.0 | 14.30 | 2 | 28.6 | 2.0 | 14.28 | yes |
| 3475740390 | isolated-jump | 2580 | 2583 | 30.4 | 3.0 | 10.13 | 2 | 30.4 | 3.0 | 10.13 | yes |
| 3475740390 | isolated-jump | 2587 | 2589 | 24.7 | 2.0 | 12.35 | 2 | 24.7 | 2.0 | 12.36 | yes |
| 4556693525 | hidden-pause | 253 | 275 | 225.0 | 22.0 | 10.23 | 23 | 225.0 | 22.0 | 36.00 | yes |
| 4556693525 | isolated-jump | 287 | 293 | 65.0 | 6.0 | 10.83 | 7 | 65.0 | 6.0 | 16.00 | yes |
| 4556693525 | isolated-jump | 1850 | 1854 | 61.0 | 4.0 | 15.25 | 5 | 61.0 | 4.0 | 27.00 | yes |
| 3475710182 | isolated-jump | 153 | 154 | 10.5 | 1.0 | 10.50 | 2 | 10.4 | 1.0 | 10.44 | yes |
| 3475710182 | isolated-jump | 207 | 208 | 11.5 | 1.0 | 11.50 | 2 | 11.5 | 1.0 | 11.48 | yes |
| 3475710182 | isolated-jump | 214 | 215 | 12.3 | 1.0 | 12.30 | 2 | 12.3 | 1.0 | 12.33 | yes |
| 3475710182 | isolated-jump | 510 | 511 | 12.5 | 1.0 | 12.50 | 2 | 12.5 | 1.0 | 12.52 | yes |
| 3475711030 | isolated-jump | 0 | 2 | 38.2 | 2.0 | 19.10 | 2 | 38.2 | 2.0 | 19.09 | yes |
| 3475711335 | isolated-jump | 0 | 1 | 16.8 | 1.0 | 16.80 | 2 | 16.8 | 1.0 | 16.79 | yes |
| 3475711346 | gap-adjacent | 114 | 378 | 740.0 | 264.0 | 2.80 | 4 | 740.1 | 264.0 | 13.15 | yes |
| 3475711346 | isolated-jump | 2065 | 2066 | 14.4 | 1.0 | 14.40 | 2 | 14.4 | 1.0 | 14.35 | yes |
| 3475711373 | isolated-jump | 34 | 38 | 38.6 | 4.0 | 9.65 | 3 | 38.6 | 4.0 | 9.70 | yes |
| 3475711373 | isolated-jump | 2508 | 2509 | 12.2 | 1.0 | 12.20 | 2 | 12.2 | 1.0 | 12.15 | yes |
| 3475711373 | isolated-jump | 3165 | 3167 | 18.9 | 2.0 | 9.45 | 2 | 19.0 | 2.0 | 9.49 | yes |
| 3475711383 | isolated-jump | 0 | 1 | 10.7 | 1.0 | 10.70 | 2 | 10.7 | 1.0 | 10.65 | yes |
| 3475711403 | isolated-jump | 2678 | 2682 | 37.9 | 4.0 | 9.48 | 2 | 37.9 | 4.0 | 9.49 | yes |
| 3475711403 | isolated-jump | 2685 | 2688 | 28.0 | 3.0 | 9.33 | 2 | 28.0 | 3.0 | 9.33 | yes |
| 3475711403 | isolated-jump | 2715 | 2717 | 20.2 | 2.0 | 10.10 | 2 | 20.2 | 2.0 | 10.09 | yes |
| 3475711429 | isolated-jump | 2882 | 2883 | 11.0 | 1.0 | 11.00 | 2 | 11.0 | 1.0 | 10.97 | yes |
| 3475711429 | isolated-jump | 2976 | 2977 | 11.6 | 1.0 | 11.60 | 2 | 11.6 | 1.0 | 11.61 | yes |
| 3475711429 | isolated-jump | 3573 | 3574 | 10.4 | 1.0 | 10.40 | 2 | 10.4 | 1.0 | 10.41 | yes |
| 3475711429 | isolated-jump | 3590 | 3592 | 18.4 | 2.0 | 9.20 | 2 | 18.4 | 2.0 | 9.22 | yes |
| 3475711429 | isolated-jump | 3758 | 3760 | 19.7 | 2.0 | 9.85 | 2 | 19.7 | 2.0 | 9.84 | yes |
| 3475711429 | isolated-jump | 3770 | 3772 | 23.3 | 2.0 | 11.65 | 2 | 23.3 | 2.0 | 11.63 | yes |
| 3475711429 | isolated-jump | 3779 | 3781 | 22.5 | 2.0 | 11.25 | 2 | 22.5 | 2.0 | 11.25 | yes |
| 3475711446 | isolated-jump | 2614 | 2615 | 11.8 | 1.0 | 11.80 | 2 | 11.8 | 1.0 | 11.80 | yes |
| 3475711450 | isolated-jump | 204 | 206 | 22.4 | 2.0 | 11.20 | 2 | 22.4 | 2.0 | 11.19 | yes |
| 3475711450 | isolated-jump | 226 | 227 | 11.7 | 1.0 | 11.70 | 2 | 11.7 | 1.0 | 11.72 | yes |
| 3475711450 | isolated-jump | 264 | 266 | 20.5 | 2.0 | 10.25 | 2 | 20.5 | 2.0 | 10.25 | yes |
| 3475711450 | isolated-jump | 315 | 317 | 21.9 | 2.0 | 10.95 | 2 | 21.9 | 2.0 | 10.96 | yes |
| 3475711450 | isolated-jump | 322 | 324 | 22.1 | 2.0 | 11.05 | 2 | 22.1 | 2.0 | 11.03 | yes |
| 3475711450 | isolated-jump | 526 | 527 | 10.6 | 1.0 | 10.60 | 2 | 10.6 | 1.0 | 10.57 | yes |
| 3475711450 | isolated-jump | 707 | 709 | 29.9 | 2.0 | 14.95 | 2 | 29.9 | 2.0 | 14.97 | yes |
| 3475711450 | gap-adjacent | 2080 | 2108 | 127.5 | 28.0 | 4.55 | 4 | 127.5 | 28.0 | 21.78 | yes |
| 3475711469 | hidden-pause | 1689 | 1705 | 274.6 | 16.0 | 17.16 | 4 | 274.6 | 16.0 | 30.75 | yes |
| 3475711469 | isolated-jump | 3133 | 3135 | 21.5 | 2.0 | 10.75 | 2 | 21.5 | 2.0 | 10.74 | yes |
| 3475711501 | isolated-jump | 2471 | 2472 | 13.8 | 1.0 | 13.80 | 2 | 13.9 | 1.0 | 13.89 | yes |
| 3475711501 | isolated-jump | 4419 | 4422 | 32.4 | 3.0 | 10.80 | 4 | 32.4 | 3.0 | 11.01 | yes |
| 3475711630 | isolated-jump | 3106 | 3108 | 24.3 | 2.0 | 12.15 | 2 | 24.3 | 2.0 | 12.13 | yes |
| 3475711630 | isolated-jump | 3710 | 3719 | 76.9 | 9.0 | 8.54 | 3 | 76.9 | 9.0 | 13.38 | yes |
| 3475711630 | gap-adjacent | 6925 | 6940 | 137.0 | 15.0 | 9.13 | 3 | 137.0 | 15.0 | 11.01 | yes |
| 3475711630 | gap-adjacent | 6948 | 6966 | 179.8 | 18.0 | 9.99 | 3 | 179.8 | 18.0 | 24.75 | yes |
| 3475711677 | isolated-jump | 0 | 1 | 21.4 | 1.0 | 21.40 | 2 | 21.4 | 1.0 | 21.35 | yes |
| 3475711768 | isolated-jump | 2172 | 2174 | 33.8 | 2.0 | 16.90 | 2 | 33.8 | 2.0 | 16.88 | yes |
| 3475711768 | isolated-jump | 2235 | 2236 | 11.4 | 1.0 | 11.40 | 2 | 11.4 | 1.0 | 11.37 | yes |
| 3475711768 | isolated-jump | 2793 | 2795 | 25.7 | 2.0 | 12.85 | 2 | 25.7 | 2.0 | 12.85 | yes |
| 3475711768 | isolated-jump | 2799 | 2801 | 32.1 | 2.0 | 16.05 | 2 | 32.1 | 2.0 | 16.05 | yes |
| 3475711768 | isolated-jump | 2805 | 2807 | 27.1 | 2.0 | 13.55 | 2 | 27.1 | 2.0 | 13.55 | yes |
| 3475711768 | isolated-jump | 3244 | 3247 | 28.4 | 3.0 | 9.47 | 2 | 28.5 | 3.0 | 9.49 | yes |
| 3475711768 | isolated-jump | 3257 | 3259 | 17.8 | 2.0 | 8.90 | 2 | 17.8 | 2.0 | 8.89 | yes |
| 3475711822 | isolated-jump | 0 | 1 | 12.9 | 1.0 | 12.90 | 2 | 12.8 | 1.0 | 12.85 | yes |
| 3475711886 | isolated-jump | 8 | 10 | 29.6 | 2.0 | 14.80 | 2 | 29.5 | 2.0 | 14.76 | yes |
| 3475711886 | isolated-jump | 156 | 157 | 11.3 | 1.0 | 11.30 | 2 | 11.3 | 1.0 | 11.29 | yes |
| 3475711886 | isolated-jump | 606 | 608 | 18.5 | 2.0 | 9.25 | 2 | 18.5 | 2.0 | 9.26 | yes |
| 3475711886 | isolated-jump | 649 | 651 | 17.9 | 2.0 | 8.95 | 2 | 17.9 | 2.0 | 8.96 | yes |
| 3475711886 | isolated-jump | 655 | 657 | 25.0 | 2.0 | 12.50 | 2 | 25.0 | 2.0 | 12.51 | yes |
| 3475711886 | isolated-jump | 2339 | 2341 | 17.9 | 2.0 | 8.95 | 2 | 17.9 | 2.0 | 8.93 | yes |
| 3475711902 | isolated-jump | 11 | 13 | 25.6 | 2.0 | 12.80 | 2 | 25.7 | 2.0 | 12.84 | yes |
| 3475711917 | isolated-jump | 2721 | 2723 | 33.4 | 2.0 | 16.70 | 2 | 33.5 | 2.0 | 16.73 | yes |
| 3475711917 | isolated-jump | 2726 | 2728 | 17.8 | 2.0 | 8.90 | 2 | 17.8 | 2.0 | 8.89 | yes |
| 3475711993 | isolated-jump | 9 | 11 | 20.3 | 2.0 | 10.15 | 2 | 20.2 | 2.0 | 10.12 | yes |

## Summary

83 segments sampled across 24 activities (0 activities skipped — see above). 83 of 83 segments carry a 1 Hz consecutive-pair speed above the shipped 7.35 m/s limit inside their own window ("burst exists at 1 Hz"); 0 do not (decimation's run-level folding produced a fast aggregate that no single 1 Hz consecutive pair reproduces); 0 had fewer than two 1 Hz distance samples inside the window (decimation removed the very samples that would let 1 Hz corroborate or refute the segment — the FIT recording auto-pauses, so a window can straddle a real recording gap).

This is a validation-only cross-check: it neither derives nor moves any shipped constant (`UNRELIABLE_SPEED_LIMIT_MPS`, `UNRELIABLE_EXCESS_FLOOR_M`, `HIDDEN_PAUSE_MIN_METRES`), and a segment not confirmed at 1 Hz is not thereby un-flagged — D-11 already established that decimation-tracking is measured and reported, never used to exempt a stream or a segment.

## First evidence for STREAM-05

STREAM-05 (deferred at the v2.2 close, carried into v2.3 — see `.planning/PROJECT.md` § Active and `.planning/STATE.md`) asks whether re-deriving streams from the 1 Hz FIT originals, rather than the currently-committed decimated `t`/`d` arrays, would help. This report is the FIRST measured evidence bearing on that question for the unreliable-segment detector specifically.

On this sample, all 83 of 83 segments the shipped detector flags on the decimated stream are corroborated by an actual 1 Hz consecutive-pair speed above the shipped limit inside the same window — this sample found NO case of decimated run-level folding manufacturing a fast-looking aggregate that a 1 Hz reading would not corroborate, and no case where decimation removed the very samples that would let 1 Hz judge the segment at all. That is evidence AGAINST re-deriving from 1 Hz improving *burst-existence* discrimination for this detector, at least at this sample size — it does not bear on the separate, still-open over-measurement-vs-jump discriminator (D-12's own text: "a reliable over-measurement-vs-jump discriminator would need lat/lng or the 1 Hz speed channel"), which this report does not attempt to resolve, since none of the sampled segments carry the ambiguous signature (sustained speed with reported GPS-geometry contradiction) that motivated the question. A STREAM-05 re-derivation revisit is not required to close this phase; a larger or differently targeted sample (e.g. deliberately including a segment with that ambiguous signature, if the archive's FIT originals hold one) could still move this finding.
