---
status: resolved
trigger: "compute-clean-window-recount (36-12, PR-09 leg 3) exits 1: pass=1437 fail=190 notAssessable=13 of 1640 contaminated windows fail ratio > control p95 (2.98). Detector over-flagging (A), recount blind (B), or search coordinates wrong (C)?"
created: 2026-10-01
updated: 2026-10-01
mode: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED. The 190 failures are mostly (B): the recount's max/median per-pair statistic plus its every-window-must-clear-control-p95 rule cannot see anomalies that the detector catches by excess metres. That rule was already shown to be unsatisfiable by the measured basis it was declared on. A small slice (6) is (A): quantized-distance lumps. Zero are (C).
next_action: none. Diagnose-only mode. Fix direction is in Resolution.

## Symptoms

expected: every window the shipped document calls contaminated (non-null `contaminated`, or `demotion.guard === 'unreliable-segment'`) has a recount outlier ratio > control p95
actual: 190 of 1627 assessable windows have ratio <= 2.9797 (13 not assessable)
errors: "FAIL: see above for the specific reason(s)" (exit 1)
reproduction: `npm run compute-clean-window-recount` on master @ 2513b8f1, with data/ and dist/ regenerated 2026-10-01 11:00
started: first live run of 36-12 (c32d7df3)

## Eliminated

- hypothesis: (C) the search attaches a `contaminated` record whose window or segment coordinates differ from what was tested
  evidence: For all 1640 windows the probe re-ran `findBestEffort` on the whole stream and `classifyGapsWithSegments` + `segmentsIntersectingWindow` from fresh dist (built 11:00, same as data/). The recomputed raw window's `t=A-B` string matches the shipped reason in 1201/1201 contaminated records. Every window intersects at least one recomputed segment (0 empty). `Math.round(startOffsetSec)` never shifts the start, because t is integer-valued. The shipped coordinates are exactly what was tested.
  timestamp: 2026-10-01

- hypothesis: 36-12 SUMMARY's "dilution in very large windows"
  evidence: max/median does not dilute with pair count. The failures are 400m=62, 1k=37 and so on, and 84 of them have fewer than 100 pairs. They are explained by jump magnitude (below), not by window size.
  timestamp: 2026-10-01

- hypothesis: recount reads a different stream (resampled, or data2)
  evidence: the recount and the search both read data/streams/{id}.json `t`/`d` directly. The failing examples are fit/native streams.
  timestamp: 2026-10-01

## Evidence

- timestamp: 2026-10-01
  checked: the population split (orchestrator said "every non-null contaminated record")
  found: the 1640 windows are 1201 `contaminated` records plus 439 `demotion.guard==='unreliable-segment'` windows (top-level offsets). Of the 190 failures, 176 are contaminated records and 14 are demotions.
  implication: the orchestrator's denominator description is wrong. This does not change the diagnosis.

- timestamp: 2026-10-01
  checked: a per-window bucketing probe (scratchpad probe.mjs / classify.mjs) over all 1627 assessable windows
  found: |
    bucket                                                   fail  pass
    T  jump pair counted, ratio 2.06-2.98                     148  1384   (B: statistic too coarse)
    W  whole window inside the anomaly, median pair > 7.35     20     5   (B: self-referential ratio ~1)
    E  jump is the interpolated final pair, dropped            16     0   (B: pairSpeeds inclusion rule)
    Q  quantized-lump stream, excess vanishes with stall       6    45   (A: detector over-flag)
    (E-partial: 0 fail / 3 pass)
  implication: 184/190 are (B) and 6/190 are (A). The 6 (A) cases fail only because the recount's median is also inflated by the same lumps.

- timestamp: 2026-10-01
  checked: the T bucket (148 fails). Fully-inside examples, raw pairs (* = segment pair)
  found: |
    6167705736@400m  884-888 3.50 | 888-891 26.1m=8.70* | 891-896 4.20   median 3.58  ratio 2.43
    6167705736@1mi   same jump                                            median 3.46  ratio 2.52
    6562732643@1k    74-77 8.80* 77-78 8.10* (34.5m/4s)                   median 3.78  ratio 2.33
    6633137201@5k    17-19 19.3m=9.65*                                    median 3.64  ratio 2.69
    6397061772@10k   207-210 25.7m=8.57*                                  median 3.30  ratio 2.60
    7145204122@half  6143-6147 36.8m=9.20*                                median 3.40  ratio 2.71
    Failing-T quantiles: max seg pair 8.28/8.72/9.15/10.2/15.5 m/s; median pair 2.87/3.24/3.5/3.7/5.5;
    detector excess (m - 7.35*s) p10 3.2, p50 4.8, p90 9.4 m. 137/148 are below 10 m and 112 sit in (2.6, 8.05) m.
    Passing-T: excess p50 14.9 m, max pair up to 176 m/s.
  implication: the recount sees the jump. It is the window max. But a ~9 m/s pair against a ~3.4 m/s median gives ratio ~2.6, below 2.98. The detector flags on excess metres above 7.35 m/s with a 3 m floor. The recount effectively needs max > ~3x median (~10 m/s). Every jump between those two bars fails by construction. These are not over-flags in the recount's evidence: the jump is 2.5x the neighbours. The (2.6, 8.05) m excess band is the band 32-CALIBRATION.md never anchored (D-09 trivial pair 17.3m/2s has excess 2.6 = must-not-flag, smallest must-flag 30.1m/3s has excess 8.05). Whether those 112 should be flagged is a Phase 32 question that this leg's own docblock disclaims.

- timestamp: 2026-10-01
  checked: whether failing jumps are "compensated" (net excess over +/-20 s < 3 m, which would mean a redistribution and not added distance)
  found: 26/148 failing-T (18%) vs 237/1384 passing-T (17%)
  implication: the failures are no more redistribution-like than the passes. Failure tracks jump magnitude, not detector false positives.

- timestamp: 2026-10-01
  checked: what fills the CONTROL tail (the 368 control windows >= p95 2.98)
  found: 360/368 contain a pair > 7.35 m/s (max-pair quantiles 5.1/10/12/16.5/32). 180/368 are on quantized streams (zero-advance fraction >= 0.2).
  implication: the control p95 is set by fast pairs the detector deliberately tolerates (excess <= 3 m, or a leading stall merged by advanceSteps) and by quantized lumps. Max/median cannot tell these apart from flagged jumps of the same magnitude, so the two populations overlap structurally.

- timestamp: 2026-10-01
  checked: the 36-12 measured basis in the recount docblock
  found: contaminated p05 = 2.5962 < control p95 = 3.0000. The separation check only compared the contaminated MEDIAN against control p95, but the verdict requires EVERY window to clear p95.
  implication: at least 5% failures (~80) were predicted at declaration time. The observed 11.7% is the same finding. The rule was unsatisfiable from its own basis (memory: checkpoint-rows-can-be-unsatisfiable).

- timestamp: 2026-10-01
  checked: the W bucket (20 fails, 18 at 400m, 17 of the 3475* activities)
  found: e.g. 3475713616@400m, window t=3178-3196.5 lies wholly inside a hidden-pause segment of 397.4m/18s. Pairs are 14.5, 25.85, 28.6, 28.45, 28.6, 15.3, 7.55, 26.4, 23.45 m/s. Median 25.85, ratio 1.11. 3475713251@400m has median 15.8 and ratio 1.81.
  implication: a real anomaly (a 400m covered at ~100 km/h). The self-referential ratio is ~1 because the anomaly IS the window.

- timestamp: 2026-10-01
  checked: the E bucket (16 fails, 14 isolated-jump, 2 gap-adjacent)
  found: e.g. 14495835554@1k, window ends 1850.6 with segment 1850-1851 (21.1m/1s). 13379430658@400m, window ends 641.7 with segment 639-642 (29.4m/3s = 9.8 m/s). 13343108965@1mi, window ends 577.8 with segment 574-578 (10.05 m/s). findBestEffort's window covers pairs startIndex..endIndex-1 including the partially used crossing pair, and segmentsIntersectingWindow is index-based, so it correctly sees the jump. pairSpeeds keeps only pairs with t[i+1] <= endSec, so it drops exactly that pair. 13 of 16 would pass if the clipped pair were counted.
  implication: a recount boundary-rule blind spot. The window really does consume part of the jump.

- timestamp: 2026-10-01
  checked: the Q bucket (6 fails: 4454640041@1k,@1mi; 4538002815@400m; 5140419739@1k,@1mi; 5201169488@1k)
  found: 2 s sampling with distance in lumps (45-48% zero pairs), e.g. 4454640041 34-36 11m | 36-38 18m* | 38-40 0 | 40-42 0 | 42-44 13m. The "jump" (18m/2s = 9 m/s, excess 3.3 m, just over the 3 m floor) is followed by a 4 s stall. 36-42 = 3 m/s. advanceSteps merges only LEADING zero-advance pairs into a step, never trailing ones. The recount median is inflated to 5.0 m/s (nearest-rank lands on the smallest nonzero lump), which is why these fail.
  implication: (A) over-flag, the quantized-distance-streams memory pattern. 25 activities / 51 windows have this shape, and 45 of them PASS the recount because its per-pair statistic is fooled by the lumps too. So the recount cannot detect (A) at all.

- timestamp: 2026-10-01
  checked: counterfactual recount variants (cf.mjs), each with the same p95 rule
  found: baseline 190/1627. Clipped final pair included: 169/1628. Leading-stall merge: 160/1636. Both: 146/1636 (control p95 2.912).
  implication: no implementation tweak of max/median makes the leg pass. The residual ~146 is the T-bucket magnitude overlap, so the verdict rule itself is the defect.

## Resolution

root_cause: |
  The disagreement comes from the recount (scripts/compute-clean-window-recount.mjs), not from the search or (mostly) the detector.
  (B, 184/190) The recount uses max/median of raw per-pair speeds, with a verdict that EVERY contaminated window must beat control p95 (2.98). That is a magnitude-relative rule. The detector's rule is excess metres above 7.35 m/s with a 3 m floor. Jumps of ~8.3-10 m/s (excess 3-10 m) in ~3.4 m/s runs get flagged by the detector and are visible to the recount as the window max, but they land at ratio 2.1-2.98 (148 windows). The control tail that sets p95 consists of tolerated fast pairs and quantized lumps of the same magnitude. The recount's own measured basis (contaminated p05 2.596 < control p95 3.0) predicted >=5% failures before the rule was declared. Two narrower recount blind spots add to this. Whole-window anomalies make the self-referential ratio ~1 (20 windows, hidden-pause 400m/1k on 3475* activities, median 12-29 m/s). pairSpeeds drops the interpolated final crossing pair, which is where the jump sits (16 windows).
  (A, 6/190) On quantized-distance streams, advanceSteps merges only leading stalls, so a catch-up lump followed by a stall is flagged as an isolated jump (excess ~3.3 m, just over the floor). 51 windows across 25 activities have this shape. 45 of them pass the recount, which shares the blind spot.
  (C, 0/190) Shipped window and segment coordinates reproduce exactly for all 1640.
fix: "(not applied — diagnose only). Recount: make the verdict rule satisfiable on its own basis. Either compare a population statistic (the already-passing median-vs-p95 separation) instead of requiring every window to clear p95, or switch to an excess-metres-style statistic (jump metres minus the window's median speed times its seconds) that matches what the detector measures. Count the partially used final pair. Treat median > a sanity speed as anomalous instead of unassessable. Detector (optional, Phase 32 scope): merge trailing zero-advance pairs too, or anchor the (2.6, 8.05) m excess band in 32-CALIBRATION.md."
verification: diagnosis only. Baseline probe reproduces 190/1627 exactly (the threshold matches 2.9797).
files_changed: []

## Impact on shipped artifacts (estimate)

- Fixing the recount only (the 184 B-cases): no change to data/stats/best-efforts.json or 36-DIFF.md. The leg is read-only.
- Fixing the detector's trailing-stall gap (the A-cases): at most 51 windows on 25 quantized-stream activities would lose their contamination. That is up to 34 `contaminated` records reverting to the unpartitioned, faster figure, and up to 17 `unreliable-segment` demotions being reinstated. These are upper bounds, because other segments in the same window may remain. 36-DIFF.md's "Newly demoted: 442" would drop by up to ~17, and its moved/rank-change rows for those activities would change. Phase 32 calibration fixtures would need re-running.
- Re-adjudicating the (2.6, 8.05) m excess band, a Phase 32 decision outside this leg's claim: up to 112 failing windows plus 303 passing windows sit in that band. Raising the floor would change far more of the document than the A-fix.

## Resolution (detector)

status: fixed (the A-cases only; the recount's own B/C findings above are unchanged and out of this fix's scope).

root_cause (detector): `advanceSteps` folds a LEADING zero-advance stall into the step it precedes for free — a quiet stretch before a run's first qualifying advance is already baked into that step's own `seconds` via the pending-start mechanic, diluting its average speed. A TRAILING zero-advance stall right after a fast run was invisible to the excess check: `advanceSteps` attributes that quiet time to whichever step comes next (an unrelated genuine advance), never back to the run that just ended. On quantized-distance streams (long zero-advance stretches at coarse sampling) this asymmetry alone false-flagged a catch-up lump immediately followed by a stall as `isolated-jump` (bucket Q above).

fix: `src/analytics/unreliable-segments.ts` — new private helper `extendThroughTrailingStall(t, d, gaps, endIndex)` extends a fast run's own `endIndex` forward through any immediately-following non-advancing, non-gap raw pair (stopping at the stream end or at the first pair `isGapPair` considers part of a caller gap, mirroring `advanceSteps`'s own gap-reset rule) before computing the run's excess metres. Same constants (`UNRELIABLE_SPEED_LIMIT_MPS` 7.35, `UNRELIABLE_EXCESS_FLOOR_M` 3), no new threshold — exactly the "merge trailing zero-advance pairs too" direction named above.

tests updated and why:
- `src/analytics/unreliable-segments.test.ts` — new describe block "trailing-stall dilution (Phase 36 gap closure, debug bucket Q)": (a) the real activity 4454640041 pattern (t=36-38, 18m/2s=9m/s, excess 3.3m, followed by a 4s stall) is no longer flagged — RED on the pre-fix detector, GREEN after; (a-synthetic) a mirrored synthetic fixture, same reason; (b) a symmetric LEADING-stall control, already correct pre-fix, locked so the fix's direction isn't mistaken for the only correct one; (c) a genuine isolated jump (30m/2s) followed by a stall that does NOT bring its diluted excess below the floor is STILL flagged — proves the fix does not blind the detector.
- Same file, D-05/D-09 negative-control reachability helper (`deriveWindowDiscriminators`, an independent re-derivation, never the detector's own private helper): updated to apply the same trailing-stall extension (written independently, `extendThroughTrailingStallIndependent`) when deriving its "lowered params must fire" bound. 3647739864's locked window (t=945-971) is now doubly protected — its run's raw speed (5.885 m/s) already sits below the default 7.35 m/s limit, and the extended run (through a further 10s trailing stall, metres unchanged at 153, seconds 26->36) sits even further below — so the probe's prior unextended `vMax` (5.885) no longer predicted a speed low enough for the real, now-fixed detector to actually fire; added `maxExtendedRunSpeed` (per-overlapping-step, extension-aware, independent of fastness-at-default-limit) as the correct bound to lower below. All 104 tests in the file pass.
- `src/analytics/compute-dashboard-index.test.ts` — the archive-wide pace-disagreement count pinned from `35-CALIBRATION.md` (125) was rendered against the pre-fix detector. Re-running the full archive sweep against both the pre-fix (git-committed `unreliable-segments.ts` as of `f5e72aa8`) and post-fix detector and diffing the flagged id sets showed exactly two activities (`14675028146`, `4598855187`) stop being flagged — both quantized-stream catch-up-lump-then-stall false positives, declassified by the same fix, moving their derived running pace back into agreement with metadata pace. Test updated to assert these two ids are no longer flagged and check the remaining count against `(parsed count - 2)`, still catching any further unexplained drift. `35-CALIBRATION.md` itself and the `PACE_DISAGREEMENT_RUNNING_RATIO` constant it calibrates are NOT regenerated — re-deriving that archive-wide ratio statistic is a separate, heavier recalibration decision, out of this gap-closure's scope.

verification: `npx tsc --noEmit` clean; `npm test` — 3917/3917 passing (107 files), zero failures, zero skips beyond the suite's own pre-existing conditional skips.

data regeneration (`npm run build && npm run compute-best-efforts`, primary checkout): `data/stats/best-efforts.json` (gitignored, not committed) — `effortsRejected`/`effortsDemoted` moved 445 -> 394 (-51, matching this section's own upper-bound estimate above exactly). Diffing the `rejected` array by `activityId@distance`: 53 records resolved (no longer rejected) across 51 distinct activities, 2 newly rejected (`3647739864@1k`, `4598855187@1mi` — both activities already counted among the 51, a second-order effect of the 10k/1mi ceiling shifting on the changed population, not a new detector false-negative). `git status --porcelain data/` is clean — the two TRACKED ceiling/exclusion files (`data/best-effort-ceiling.json`, `data/best-effort-exclusions.json`) were not written (the ceiling-moved write requires the opt-in `--write-ceiling-state` flag, not passed here); no tracked data left for the orchestrator to review.

commits:
- `f5e72aa8` test(36-gap): watch trailing-stall isolated-jump false-flag RED
- `6b0bd210` fix(36-gap): symmetric trailing-stall dilution for isolated-jump bursts
- `0188ba3e` test(36-gap): account for 2 activities reclassified by the detector fix
- `3d37437b` docs(36-gap): append detector Resolution to the debug record
files_changed: [src/analytics/unreliable-segments.ts, src/analytics/unreliable-segments.test.ts, src/analytics/compute-dashboard-index.test.ts, .planning/debug/36-recount-isolated-jump.md]

## Resolution (recount)

status: fixed (all three recount defects B1/B2/B3 named in the original Resolution above; the (A)
quantized-lump cases were already resolved by the detector fix recorded in "## Resolution
(detector)").

### Defect 1 — pairSpeeds dropped the crossing pair (bucket E, 16/190 live failures)

root_cause: `pairSpeeds(t, d, startSec, endSec)` kept a pair only when `t[i] >= startSec && t[i+1]
<= endSec` — fully inside the window. A pair straddling the window's END boundary (the jump itself,
in all 16 bucket-E failures) was silently excluded, leaving the window to see only its own clean
neighbours.

fix: `scripts/compute-clean-window-recount.mjs`'s `pairSpeeds` now keeps every pair that
INTERSECTS the window at all — excluded only when `t[i+1] <= startSec || t[i] >= endSec` (zero or
negative overlap). Real example, re-measured 2026-10-01 against the live archive:
`13343108965@1mi`, window ends at t=577.8s inside a pair spanning t=574-578s (40.2m/4s, 10.05
m/s). OLD: that pair dropped, self-referential ratio = 1.7083 (window median 3, undetected). NEW:
pair counted, ratio against the activity's own outside-window reference median (2.7667) = 3.6325
(detected).

### Defect 2 — a window entirely inside an anomaly judged itself clean (bucket W, 20/190 failures)

root_cause: the OLD ratio was `max(windowSpeeds) / median(windowSpeeds)` — fully self-referential
to the window. A window whose every pair IS the anomaly (e.g. a hidden-pause catch-up burst) has no
clean pair left inside it to contrast against, so the ratio collapses toward 1 regardless of how
extreme the burst is.

fix: added `referenceSpeeds(t, d, startSec, endSec)` — the exact complement of `pairSpeeds`, every
pair lying ENTIRELY OUTSIDE the window, same stream. `windowOutlierRatio` now computes
`max(windowSpeeds) / median(referenceSpeeds)`: self-referential to the ACTIVITY, never to the
window's own contents. Real example, re-measured 2026-10-01: `3475713616@400m`, window t=3178.0-
3196.5s (a hidden-pause catch-up burst, pairs 14.5-28.6 m/s throughout). OLD: self-referential
ratio = 1.1064 (window median 25.85, undetected). NEW: ratio against the activity's own
outside-window reference median (2.70) = 10.5926 (detected).

### Defect 3 — the per-window verdict was unsatisfiable from its own basis (bucket T, 148/190 failures)

root_cause: the OLD verdict required EVERY contaminated window to individually clear the CONTROL
population's own p95. The control population legitimately contains tolerated fast pairs (pairs the
detector's excess-floor/speed-limit rule deliberately does not flag) reaching into the same
magnitude band as many genuinely-flagged jumps, so a measurable fraction of true positives were
always going to land below that bar — the original docblock's own measured basis (contaminated p05
2.5962 < control p95 3.0000) predicted this before the first live run.

fix: `deriveVerdict` is now a TWO-PART verdict. `checkBasisGate`'s population-level separation
claim is UNCHANGED (contaminated MEDIAN must exceed control `CONTROL_PERCENTILE_LOCAL` = p95,
measured fresh each run). `deriveVerdict` now judges each INDIVIDUAL window against a new, lower
`PER_WINDOW_FLOOR_PERCENTILE_LOCAL` (= 75) — "this window carries more outlier character than an
ordinary clean window", not "more than 95% of all clean windows ever recorded".

### Measured basis for the NEW statistic (defects 1+2 combined), live archive, 2026-10-01

Both populations were re-measured with the fixed `pairSpeeds`/`referenceSpeeds`/`windowOutlierRatio`
on `data/stats/best-efforts.json` AFTER the trailing-stall detector fix (`effortsDemoted` 445 ->
394), via a scratchpad-only throwaway probe (never committed), BEFORE any per-window floor was
declared:

| Population | n (assessable) | not-assessable | min | p05 | p25 | median | p75 | p95 | max |
|---|---|---|---|---|---|---|---|---|---|
| CONTAMINATED (`contaminated != null` OR `demotion.guard === 'unreliable-segment'`) | 1440 | 74 | 2.4222 | 3.0278 | 3.8571 | 5.4355 | 9.3621 | 14.8750 | 2436.0000 |
| CONTROL (`contaminated === null` AND `demotion === null`) | 7326 | 143 | 1.1471 | 1.3032 | 1.5179 | 1.7833 | 2.2857 | 3.6667 | 57.9375 |

Separation check (population-level, unchanged mechanism): contaminated median (5.4355) exceeds
control p95 (3.6667) — SEPARATES, more strongly than the pre-fix statistic did (4.7911 vs 3.0000).

Per-window floor candidates measured BEFORE declaring (reachability direction (i) — passable by the
live, correct archive):

| control percentile | floor | contaminated windows failing (of 1440) |
|---|---|---|
| p50 | 1.7833 | 0 |
| p60 | 1.9385 | 0 |
| p70 | 2.1453 | 0 |
| p75 | 2.2857 | 0 |
| p80 | 2.4395 | 3 |
| p85 | 2.6044 | 13 |
| p90 | 2.8391 | 39 |
| p95 | 3.6667 | 291 |

p75 declared as `PER_WINDOW_FLOOR_PERCENTILE_LOCAL`: the strictest (highest) of the measured
candidates at which the live archive has ZERO failures, chosen from this table rather than picked
after the fact to force a pass (p80, the very next step up, already produces 3 failures).

`notAssessable` rose from 13 (pre-fix) to 74 (contaminated) because `MIN_REFERENCE_PAIRS_LOCAL = 3`
is a genuinely new requirement the old statistic never had: 52 of the 74 are windows spanning
nearly an entire short stream (mostly `10k` no-clean-window demotions whose top-level offsets cover
almost the whole recording, leaving <3 pairs outside), and 22 are quantized-distance streams whose
outside-window reference median is exactly 0. Both are honest "cannot judge" results, not silent
wrong answers.

### Reachability, both directions (defects 1+2+3 combined)

(i) PASSABLE by a correct archive: confirmed above — the live, post-detector-fix archive produces
ZERO per-window-floor failures at the declared p75.

(ii) STILL RED on both pre-existing planted defects (`scripts/compute-clean-window-recount.test.mjs`
section 1, tests (b) and (c), unchanged assertions — the symmetric fixture's numbers happen to be
identical under the new statistic, confirmed by re-running both tests against the fixed code) AND
on three NEW planted defects, one per fix, added in the same file:
- (d) a synthetic jump pair straddling a window's end boundary: OLD inline-reproduced rule gives a
  self-referential ratio of 1 (undetected); NEW `pairSpeeds`/`referenceSpeeds`/`windowOutlierRatio`
  give 10/3 = 3.3333 (detected).
- (e) a synthetic window entirely inside a burst: OLD inline-reproduced self-referential ratio = 1
  (undetected); NEW ratio = 28/3 = 9.3333 (detected).
- (f) a synthetic T-bucket-magnitude window (ratio 2.6, between a synthetic control p75 of 2.4128
  and p95 of 2.8026): confirmed to FAIL the OLD uniform-p95 rule (`basisGate.controlThresholdBasis
  > 2.6`) while PASSING the new two-part verdict (`verdict.controlFloor < 2.6`, `verdict.fail ===
  0`).

All 7 of these assertions were confirmed RED against the pre-fix `compute-clean-window-recount.mjs`
(by temporarily restoring the pre-fix file via `git checkout --` and re-running the test file, then
restoring the fix) before the fix commit landed — see verification below.

### Live run, 2026-10-01, after the fix

`npm run build && npm run compute-best-efforts` regenerated `data/stats/best-efforts.json` cleanly
(`git status --porcelain data/` empty before and after). `npm run compute-clean-window-recount`:

```
contaminated population: 1514 (assessable: 1440)
control population: 7469 (assessable: 7326)

basis gate: OK
  controlN=7326 contaminatedN=1440 controlP95=3.6666666666666665 contaminatedMedian=5.435483870968816

per-window floor (p75): 2.285714285714234
verdict: pass=1440 fail=0 notAssessable=74 (of 1514)

internal consistency: OK, no violations
walked non-null-demotion count: 394

pinned fixtures (ROADMAP Criterion 4):
  3475740390@400m: expected 3:20 -> MATCH
  3475724402@400m: expected 3:21 -> MATCH
  3475734189@400m: expected 3:22 -> MATCH

PASS: every contaminated window clears the self-referential outlier-ratio rule, the shipped document is internally consistent, and all three pinned fixtures match.
```

**Exit code: 0.**

The internal-consistency two-homes check that previously flagged `4598855187@1k` (recorded in the
original "## Resolution (detector)" section above) no longer fires: that activity's 1k effort now
carries `demotion.guard === 'ceiling'` with `contaminated === null` (confirmed by direct inspection
of the regenerated document) — the trailing-stall detector fix removed the contaminated record that
previously coexisted with the ceiling demotion. The tension does NOT persist post-detector-fix;
nothing was suppressed to make this true, it is simply no longer the shape the document has.

verification: `npx tsc --noEmit` clean; `npm test` — 107 files / 3921 tests pass (up from 3917
before this gap-closure, +4 net: the test file grew from 21 to 25 tests, and `unreliable-segment-
import-guards.test.mjs` is unchanged at 10). `npx vitest run scripts/compute-clean-window-
recount.test.mjs scripts/unreliable-segment-import-guards.test.mjs` — 35/35 pass.

commits:
- `712140bb` test(36-gap): watch recount RED on dropped crossing pair, self-referential blind window, and unsatisfiable p95-everywhere verdict
- `67af8d3d` fix(36-gap): intersecting pairSpeeds, activity-outside-window reference ratio, two-part verdict
- (this commit) docs(36-gap): append recount Resolution to the debug record
files_changed: [scripts/compute-clean-window-recount.mjs, scripts/compute-clean-window-recount.test.mjs, .planning/debug/36-recount-isolated-jump.md]
