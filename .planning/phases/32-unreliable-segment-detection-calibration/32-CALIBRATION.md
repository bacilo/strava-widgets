# Phase 32 — Unreliable-Segment Detection Pre-Calibration

Machine-written by `npm run compute-unreliable-segment-calibration`; never hand-edit. Regenerating this file against an unchanged archive produces a byte-identical result — no wall-clock timestamp appears anywhere below.

This artifact measures D-10(d) reachability, D-05 negative-control candidates at the detector's own judging scale, and candidate speed-limit statistics with their D-13 insensitivity — evidence for the blocking developer decision that follows (32-05-PLAN.md Task 2). **No chosen constants appear here** (plan 32-06's job, after the decision is recorded) and **no archive-wide flagged count appears here** (D-10(e), anti-quota — seeing that number before the constants are chosen is the exact circularity this phase exists to avoid).

## Reachability of D-10(d) (pre-calibration evidence)

### With the research's three D-05 candidates folded into must-spare

Scanned grid: 179 points from **1.1 m/s** (floor of 10× the archive's own minimum per-activity R-7 median folded covered-step speed, divided by 10) up to **10 m/s** (the largest L at which every must-flag item is still a candidate), in 0.05 m/s steps.

Table below shows only TRANSITION rows (where feasibility or the blocking item changes) from the full 179-row scan — every intermediate L between them was computed identically and shows the same disposition.

| L (m/s) | Feasible floor | Reason (if infeasible) |
|---|---|---|
| 1.1 | none | no floor in [950.3000000000001, 639.6999999999994) — blocked by 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 1.3 | none | no floor in [860.1, 573.8999999999994) — blocked by 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 1.35 | none | no floor in [837.5500000000001, 157.89999999999998) — blocked by 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)); 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 1.6 | none | no floor in [383.0999999999999, 138.89999999999998) — blocked by 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)); 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 1.65 | none | no floor in [374.3499999999999, 52.95000000000055) — blocked by 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)); 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)); 8869338724 t=3002-3026 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 2.45 | none | no floor in [173, 33.899999999999814) — blocked by 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)); 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)); 8869338724 t=3002-3026 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 2.5 | none | no floor in [167.4000000000001, 33.19999999999982) — blocked by 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)); 8869338724 t=3002-3026 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 5.35 | none | no floor in [35.90000000000019, 14.049999999999457) — blocked by 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)); 8869338724 t=3002-3026 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 5.4 | none | no floor in [35.20000000000017, 13.899999999999451) — blocked by 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 8869338724 t=3002-3026 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 10 | none | no floor in [9.800000000000182, 0.0999999999994543) — blocked by 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)); 8869338724 t=3002-3026 (D-05 candidate (research proposal, not locked)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |

Per-item excess (m) at each transition row:

| L (m/s) | 3475734189 t=1353-1360 (hidden-pause window (199m burst, HR steps 163→155 in 1s)) | 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) | 3475740390 t=2508-2513 (isolated jump t=2508 (52.4m/5s — the 400m best start)) | 3475740390 t=2536-2538 (isolated jump t=2536 (28.6m/2s)) | 3475740390 t=2580-2583 (isolated jump t=2580 (30.4m/3s)) | 3475740390 t=2587-2589 (isolated jump t=2587 (24.7m/2s, the smallest named jump)) | 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)) | 16628769295 t=1023-1056 (D-05 candidate (research proposal, not locked)) | 7409028052 t=591-624 (D-05 candidate (research proposal, not locked)) | 8869338724 t=3002-3026 (D-05 candidate (research proposal, not locked)) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | 1291.3 m | 639.7 m | 1119.1 m | 1119.1 m | 1119.1 m | 1119.1 m | 528.8 m | 472.2 m | 950.3 m | 447.4 m |
| 1.3 | 1163.0 m | 573.9 m | 1004.4 m | 1004.4 m | 1004.4 m | 1004.4 m | 470.6 m | 435.6 m | 860.1 m | 243.6 m |
| 1.35 | 1131.0 m | 157.9 m | 979.0 m | 979.0 m | 979.0 m | 979.0 m | 456.1 m | 426.8 m | 837.6 m | 151.4 m |
| 1.6 | 637.8 m | 138.9 m | 852.0 m | 852.0 m | 852.0 m | 852.0 m | 170.9 m | 383.1 m | 278.5 m | 137.2 m |
| 1.65 | 619.3 m | 53.0 m | 826.6 m | 826.6 m | 826.6 m | 826.6 m | 105.5 m | 374.3 m | 272.0 m | 134.3 m |
| 2.45 | 188.9 m | 33.9 m | 99.4 m | 161.5 m | 161.5 m | 161.5 m | 51.7 m | 163.0 m | 173.0 m | 92.9 m |
| 2.5 | 186.0 m | 33.2 m | 66.4 m | 158.6 m | 158.6 m | 158.6 m | 22.5 m | 159.2 m | 167.4 m | 91.6 m |
| 5.35 | 138.7 m | 14.0 m | 28.4 m | 17.9 m | 32.0 m | 32.0 m | 8.1 m | 35.9 m | 14.6 m | 34.0 m |
| 5.4 | 138.3 m | 13.9 m | 28.0 m | 17.8 m | 31.5 m | 31.5 m | 7.9 m | 35.2 m | 13.8 m | 33.7 m |
| 10 | 103.9 m | 0.1 m | 2.4 m | 8.6 m | 0.4 m | 4.7 m | — | 9.4 m | — | 9.8 m |

**D-10(d) is UNREACHABLE** under this fixture assumption across the ENTIRE scanned grid — no L in [1.1, 10] admits a non-empty excess-floor interval satisfying every must-flag item while sparing every must-spare item. This is reported plainly, not tuned or reinterpreted away (must_haves item 2 — "none" is a legitimate, reportable disposition).

## Reachability of D-10(d) (pre-calibration evidence)

### Without the D-05 candidates (D-09's own trivial pair only)

Scanned grid: 179 points from **1.1 m/s** (floor of 10× the archive's own minimum per-activity R-7 median folded covered-step speed, divided by 10) up to **10 m/s** (the largest L at which every must-flag item is still a candidate), in 0.05 m/s steps.

Table below shows only TRANSITION rows (where feasibility or the blocking item changes) from the full 179-row scan — every intermediate L between them was computed identically and shows the same disposition.

| L (m/s) | Feasible floor | Reason (if infeasible) |
|---|---|---|
| 1.1 | [528.80, 639.70) | — |
| 1.3 | [470.60, 573.90) | — |
| 1.35 | none | no floor in [456.10000000000036, 157.89999999999998) — blocked by 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 2.45 | none | no floor in [51.69999999999999, 33.899999999999814) — blocked by 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)) vs must-flag minimum excess at 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) |
| 2.5 | [22.50, 33.20) | — |
| 10 | [0.00, 0.10) | — |

Per-item excess (m) at each transition row:

| L (m/s) | 3475734189 t=1353-1360 (hidden-pause window (199m burst, HR steps 163→155 in 1s)) | 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) | 3475740390 t=2508-2513 (isolated jump t=2508 (52.4m/5s — the 400m best start)) | 3475740390 t=2536-2538 (isolated jump t=2536 (28.6m/2s)) | 3475740390 t=2580-2583 (isolated jump t=2580 (30.4m/3s)) | 3475740390 t=2587-2589 (isolated jump t=2587 (24.7m/2s, the smallest named jump)) | 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)) |
|---|---|---|---|---|---|---|---|
| 1.1 | 1291.3 m | 639.7 m | 1119.1 m | 1119.1 m | 1119.1 m | 1119.1 m | 528.8 m |
| 1.3 | 1163.0 m | 573.9 m | 1004.4 m | 1004.4 m | 1004.4 m | 1004.4 m | 470.6 m |
| 1.35 | 1131.0 m | 157.9 m | 979.0 m | 979.0 m | 979.0 m | 979.0 m | 456.1 m |
| 2.45 | 188.9 m | 33.9 m | 99.4 m | 161.5 m | 161.5 m | 161.5 m | 51.7 m |
| 2.5 | 186.0 m | 33.2 m | 66.4 m | 158.6 m | 158.6 m | 158.6 m | 22.5 m |
| 10 | 103.9 m | 0.1 m | 2.4 m | 8.6 m | 0.4 m | 4.7 m | — |

**D-10(d) is REACHABLE** under this fixture assumption — e.g. at L=1.1 m/s, floor [528.80, 639.70) admits every must-flag item while sparing every must-spare item.

## Negative-control candidates at the detector's judging scale (D-05)

Generic archive-wide search (research's documented method, reproduced verbatim): maximal runs of folded covered steps at speed ≥3.5 m/s, seeded by a step ≥4 m/s, lasting ≥20s, aggregate speed in [4.5, 7.2], excluding the first/last 60s and any run touching a gap. `4556693525` excluded per D-01. Never references a speed limit or floor. Top 20 by aggregate speed:

| Id | Span | Duration | Aggregate speed | Device | HR range | Cadence range | Max folded step speed | Max run aggregate speed |
|---|---|---|---|---|---|---|---|---|
| 14092163965 | t=665-687 | 22.0s | 6.841 m/s | Garmin fēnix 6 Pro | 130–135 | 183–185 | 12.000 m/s | 12.000 m/s |
| 4598855187 | t=695-725 | 30.0s | 6.667 m/s | — | 152–155 | 180–180 | 6.667 m/s | — |
| 5588316886 | t=3266-3302 | 36.0s | 6.428 m/s | Strava App | — | — | 10.400 m/s | 9.175 m/s |
| 3475713929 | t=364-385 | 21.0s | 6.352 m/s | — | — | — | 14.800 m/s | 10.725 m/s |
| 4516895297 | t=2300-2320 | 20.0s | 6.350 m/s | Suunto 9 | 146–148 | 170–174 | 13.000 m/s | 13.000 m/s |
| 14316927437 | t=2958-2981 | 23.0s | 6.283 m/s | Garmin fēnix 6 Pro | 132–136 | 173–177 | 10.267 m/s | 10.267 m/s |
| 8869338724 | t=3002-3026 | 24.0s | 6.271 m/s | Garmin fēnix 6 Pro | 155–159 | 165–171 | 14.600 m/s | 12.450 m/s |
| 3475711630 | t=3705-3730 | 25.0s | 6.268 m/s | — | — | — | 13.400 m/s | 8.544 m/s |
| 3647739864 | t=4273-4313 | 40.0s | 6.200 m/s | Suunto 9 | 145–152 | 166–168 | 9.625 m/s | 9.625 m/s |
| 5059204779 | t=2225-2285 | 60.0s | 6.133 m/s | Suunto 9 | 147–153 | 178–180 | 6.133 m/s | — |
| 3475730936 | t=464-484 | 20.0s | 6.095 m/s | — | 159–163 | — | 11.700 m/s | 11.700 m/s |
| 6620607870 | t=691-717 | 26.0s | 6.092 m/s | Garmin fēnix 6 Pro | 153–155 | 184–188 | 11.400 m/s | 8.733 m/s |
| 16628769295 | t=1023-1056 | 33.0s | 6.052 m/s | Garmin fēnix 6 Pro | 155–161 | 181–185 | 14.700 m/s | 14.700 m/s |
| 8770751386 | t=3935-3958 | 23.0s | 5.943 m/s | Garmin fēnix 6 Pro | 138–142 | 174–177 | 8.567 m/s | 7.533 m/s |
| 3647739864 | t=945-971 | 26.0s | 5.885 m/s | Suunto 9 | 145–148 | 168–172 | 5.885 m/s | — |
| 3475715373 | t=4264-4288 | 24.0s | 5.858 m/s | — | 144–149 | — | 11.067 m/s | 10.783 m/s |
| 3475740191 | t=4343-4365 | 22.0s | 5.759 m/s | — | 171–182 | — | 9.350 m/s | 8.650 m/s |
| 4598855187 | t=437-539 | 102.0s | 5.745 m/s | — | 148–155 | 174–178 | 5.745 m/s | — |
| 7409028052 | t=586-624 | 38.0s | 5.703 m/s | Garmin fēnix 6 Pro | 142–148 | 179–185 | 8.700 m/s | 6.883 m/s |
| 3475711886 | t=2339-2367 | 28.0s | 5.696 m/s | — | — | — | 8.950 m/s | 8.950 m/s |

(374 total candidates found by the generic search.)

### The three D-05 research-proposed fixtures, measured at the detector's judging scale

Measured directly on each fixture's own pre-specified window (research proposal, NOT locked — see the blocking decision below), independent of whether the window happens to satisfy the generic search's own thresholds:

| Id | Window | Aggregate speed | Max folded step speed | Max run aggregate speed | Device | HR range | Cadence range |
|---|---|---|---|---|---|---|---|
| 16628769295 | t=1023-1056 | 6.052 m/s | 14.700 m/s | 14.700 m/s | Garmin fēnix 6 Pro | 155–161 | 181–185 |
| 7409028052 | t=591-624 | 6.030 m/s | 8.700 m/s | 6.883 m/s | Garmin fēnix 6 Pro | 144–148 | 179–185 |
| 8869338724 | t=3002-3026 | 6.271 m/s | 14.600 m/s | 12.450 m/s | Garmin fēnix 6 Pro | 155–159 | 165–171 |

## Candidate speed-limit statistics (D-10) and insensitivity (D-13)

No archive-wide flagged activity or segment count appears anywhere in this section (D-10(e), anti-quota). Insensitivity tolerance fixed BEFORE any check ran: **1%**. Each check re-derives the SAME statistic (a) with the segments its own value would already detect removed, and (b) with a planted batch of 3475724402's own real burst shapes cloned in (at least doubling the contamination) — a real candidate must not move beyond tolerance under either. Detection for this internal removal/planting step uses `excessFloorMetres: 0` (the same probe convention as the reachability section above, since D-09's significance floor is not chosen yet) — a raw, un-multiplied bulk statistic used directly as a floor-0 speed limit will typically flag a large share of the archive (momentary noise, not just genuine slews), which is itself disclosed evidence: passing insensitivity at floor 0 may require the multiplier AND floor 32-06 derives together, not the raw statistic value alone.

| Statistic | Description | Value | n | Feasible w/ D-05 fixtures | Feasible w/o D-05 fixtures | removedDelta | plantedDelta | pass |
|---|---|---|---|---|---|---|---|---|
| S-A | R-7 p90 across activities of each activity's own R-7 p95 folded covered-step speed | 4.404 m/s | 1873 | no | yes | 8.28% | 6.88% | FAIL |
| S-B | R-7 p99 across activities of each activity's best 60s-or-longer covered sustained speed | 8.157 m/s | 1873 | no | yes | 43.46% | 0.00% | FAIL |
| strawman (circular, watched failing) | R-7 p99.9 of ALL pooled folded covered-step speeds — a tail percentile of the judged population | 7.750 m/s | 2624615 | no | yes | 17.42% | 51.61% | FAIL |

The strawman (`7.750 m/s`) FAILS insensitivity as expected (watched failing first, D-13): removedDelta 17.42%, plantedDelta 51.61%, both exceeding the 1% tolerance. This confirms the harness can actually fail before the real candidates above are trusted.

## Chosen constants

Derived in order L, then F, then B, bound by the 32-05 Decision (disposition `option-refixture`, statistic `S-A`). No archive-wide flagged count was computed or consulted at any point in this derivation (D-10(e), anti-quota).

| Constant | Value | Statistic / rule | Live-derived value | Shipped value equal |
|---|---|---|---|---|
| `UNRELIABLE_SPEED_LIMIT_MPS` | 7.35 m/s | ceil(multiplier x S-A x 100) / 100, multiplier = smallest of {0.90, 0.95, 0.97, 0.99} outer percentile of per-activity (p95/p50 folded-step-speed) ratio that clears D-13 | 7.35 m/s | yes |
| `UNRELIABLE_EXCESS_FLOOR_M` | 3.0 m | R-7 p10 (the complement of D-10(a)'s own 90th-percentile order) of every folded covered step's own metres, pooled archive-wide, floor-rounded to 0.1 m | 3.0 m | yes |
| `HIDDEN_PAUSE_MIN_METRES` | 116.95 m | valley search over the anchor interval [52.4, 181.5) m; NO clean valley found — anchor-interval midpoint fallback | 116.95 m | yes |

## Non-circularity (D-13)

Tolerance fixed BEFORE any check ran: **1%**. `L` is checked at the standard floor-0 probe (matching 32-05's own S-A/S-B comparison, before any excess floor exists); `F` and `B` are checked at the JOINT `(L, F)` operating point — the detector's actual shipped params.

| Constant | Value | base | removed | planted | removedDelta | plantedDelta | pass |
|---|---|---|---|---|---|---|---|
| L (real) | 7.350 m/s | 7.350 m/s | 7.340 m/s | 7.410 m/s | 0.14% | 0.82% | true |
| L strawman (pooled p99.9 of folded step speeds) | 7.750 m/s | 7.750 m/s | 6.400 m/s | 11.750 m/s | 17.42% | 51.61% | false |
| F (real) | 3.000 m | 3.000 m | 3.000 m | 3.000 m | 0.00% | 0.00% | true |
| F strawman (p99 tail of pooled step metres) | 245.046 m | 245.046 m | 2.900 m | 190.364 m | 98.82% | 22.31% | false |
| B (real) | 116.950 m | 116.950 m | 116.950 m | 116.950 m | 0.00% | 0.00% | true |
| B strawman (p99 tail of no-gap segment metres) | 431.592 m | 431.592 m | — m | 347.866 m | 100.00% | 19.40% | false |

## Why not a tail percentile

Each constant's own tail-percentile strawman is watched FAILING the same 1% insensitivity check its real derivation passes — proof the harness can fail, not just a claim it would:

- **L's strawman** (`7.750 m/s`) FAILS: removedDelta 17.42%, plantedDelta 51.61%.
- **F's strawman** (`245.046 m`) FAILS: removedDelta 98.82%, plantedDelta 22.31%.
- **B's strawman** (`431.592 m`) FAILS: removedDelta 100.00%, plantedDelta 19.40%.

## Hidden-pause vs isolated-jump boundary (D-08)

Anchor interval (the largest named isolated-jump segment's own metres, the named hidden-pause segment's own metres): **[52.4, 181.5)** m.

Bin width: 20 m. Histogram over this interval:

| Bin lower edge (m) | Count |
|---|---|
| 40 | 166 |
| 60 | 84 |
| 80 | 30 |
| 100 | 20 |
| 120 | 13 |
| 140 | 17 |
| 160 | 8 |
| 180 | 7 |

**No clean valley exists in this interval** (D-08's own legitimate outcome — reported verbatim, not manufactured). B falls back to the anchor interval's own midpoint, 116.95 m. The `hidden-pause` label is therefore a best-effort description, not a verified cause, for any segment landing on this exact fallback value.

## Excess floor and the trivia case (D-09)

`UNRELIABLE_EXCESS_FLOOR_M` = 3.0 m — the R-7 10th percentile of every folded covered step's own metres, pooled archive-wide (D-09). The smallest must-flag excess at the chosen `(L, F)` is 8.05 m.

The D-09 trivial pair (`3475734189` t=1581-1583, ~17.3m/2s) is excluded by **floor** at the chosen constants (excess 2.60 m, margin 0.40 m below F). The floor is the operative mechanism here, not the speed limit — stated plainly, not engineered.

## D-10(d) check at the chosen constants

Decision (32-05-SUMMARY.md): disposition `option-refixture`, statistic `S-A`, fixtures 7409028052:586-624, 3647739864:945-971.

`checkFeasibility(archive, 7.35, 3.0, decision).pass` = **true**.

| Kind | Item | Excess (m) | Admitted / Spared | Mechanism |
|---|---|---|---|---|
| mustFlag | 3475734189 t=1353-1360 (hidden-pause window (199m burst, HR steps 163→155 in 1s)) | 122.7 m | admitted | — |
| mustFlag | 3475740390 t=2347-2350 (isolated jump t=2347 (30.1m/3s)) | 8.0 m | admitted | — |
| mustFlag | 3475740390 t=2508-2513 (isolated jump t=2508 (52.4m/5s — the 400m best start)) | 15.6 m | admitted | — |
| mustFlag | 3475740390 t=2536-2538 (isolated jump t=2536 (28.6m/2s)) | 13.9 m | admitted | — |
| mustFlag | 3475740390 t=2580-2583 (isolated jump t=2580 (30.4m/3s)) | 8.4 m | admitted | — |
| mustFlag | 3475740390 t=2587-2589 (isolated jump t=2587 (24.7m/2s, the smallest named jump)) | 10.0 m | admitted | — |
| mustSpare | 3475734189 t=1581-1583 (D-09 trivial pair (~17.3m/2s, 8.65 m/s)) | 2.6 m | spared | floor |
| mustSpare | 7409028052 t=586-624 (D-05 locked fixture (32-05 Decision, disposition: option-refixture)) | 1.5 m | spared | floor |
| mustSpare | 3647739864 t=945-971 (D-05 locked fixture (32-05 Decision, disposition: option-refixture)) | — | spared | speed limit |

## Inputs

- Live stream files scanned (`isStreamFile`, excluding `manifest.json`): **1874**
- Not computable (fail `validateStreamSeries`, excluded from every measurement above): **0**

Regenerate this artifact against the live committed archive with:

```
npm run compute-unreliable-segment-calibration
```
