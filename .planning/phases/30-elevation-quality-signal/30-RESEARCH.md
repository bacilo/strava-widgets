# Phase 30: Elevation Quality Signal - Research

**Researched:** 2026-09-18
**Domain:** Internal codebase archaeology + archive-wide measurement (no external library, no web research) — deriving the D-03 loop radius, recomputing the loop-gated overlap matrix, checking the D-08 carry-forward-fill interaction, verifying the D-14 pinned fixtures, and confirming the D-06 regression baseline, all against the live `data/` archive with a throwaway, read-only Node script (never touching `data/`, never committed).
**Confidence:** HIGH — every numeric claim below was measured this session directly against `data/activities/` (1,890 files) and `data/streams/` (1,865 files, excluding `manifest.json`), or against the locally generated `data/dashboard/index.json` (gitignored) and the shipped `compute-pace-quality-recount.mjs`, both run live. Every code-integration claim was confirmed by direct `Read`/`grep` against the current source tree. Nothing in the repo was modified; the measurement script lived at `/tmp/elev-research*.mjs`, outside the project tree.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Closure-drift loop test (ELEV-01 drift mode, Criterion 1)**
- **D-01:** Drift is loop-gated using activity metadata: `start_latlng`/`end_latlng` in `data/activities/{id}.json` (present on 1,658 of 1,890 activities). Drift fires only when start/end haversine distance is within a loop radius AND `|alt[end] − alt[start]| > 60 m`. The requirement's raw "34" has no loop condition; of those 34, 21 are within 200 m, 12 are point-to-point (1.4–9.6 km apart), 1 has no position.
- **D-02:** No start/end position → drift is `not-computable` for that activity; sub-ground and vertical-rate still run. Detail view states this in words; report counts this cohort separately. Never falls back to the raw difference, never a silent skip.
- **D-03:** 60 m stays; **the loop radius is derived by research from the archive itself and justified in the report.** 200 m was a scouting placeholder, not the decision — research must compute the start/end distance distribution over the 1,658 positioned activities and pick a value in the visible gap between "same spot" and "went somewhere". The rate measured at that radius is a reported finding, never a target. Rejected: fixing 200 m without derivation; scaling the threshold with duration.
- **D-04:** ROADMAP Criterion 1 and ELEV-01 are corrected to the loop-gated count, not satisfied by a diagnostic. The plan updates the "at least 34" wording to the measured figure, records that 34 was a raw-difference measurement, and the report lists point-to-point exclusions by ID as excluded-by-design.

**Signal home and severity (ELEV-01, Criterion 2)**
- **D-05:** Elevation is a sixth field on `ActivityQualitySignals` — same interface, same shard (`data/stats/pace-quality/{id}.json`), same index row field, same compute step.
- **D-06 (do not quietly reverse):** Elevation is tiered but stays OUTSIDE the `anySevere` composite. Measured 2026-09-18: `anySevere` is 299/1,890 (15.8%); 42 of the 71 elevation activities are already severe; joining would move it to 328 (17.4%). `hasAnySevereSignal` is unchanged; the existing severe-signal filter does not see elevation; the Phase 27 recount's numbers must be byte-stable after this phase lands (a regression check, not a nicety).
- **D-07:** Per-mode booleans with measured values under one rolled-up tier; no minor band. Shape (names are the planner's; structure is locked): `{ tier: 'severe' | 'none' | 'not-computable', subGround: { flagged, minAltM }, closureDrift: { state: 'flagged' | 'clear' | 'not-computable', deltaM, startEndDistM }, verticalRate: { flagged, worstRateMps, violatingSamples } }`. `tier` is `severe` iff any mode fires. Whole-signal `not-computable` applies only to the stream-less/unusable-stream cohort (Phase 27 D-06's closed reason set); drift-only not-computable is D-02.
- **D-08:** Vertical rate is per-sample `|Δalt| / Δt` on the committed decimated stream, skipping pairs with `Δt ≤ 0`. Reproduces 39 (worst 80.4 m/s on 3149636661). Research must check whether carry-forward-filled altitude runs (`Δalt = 0` across a filled stretch, then a jump) mask or manufacture anything, and say so in the report.
- **D-09:** Thresholds are the requirement's: sub-ground `< −50 m` on the minimum altitude, drift `> 60 m` absolute, rate `> 5 m/s`. `ALT_MIN = −500` in `derive-stream.ts` is not touched.

**Disclosure surfaces (Criterion 3, roadmap "UI hint: yes")**
- **D-10:** One severe-only elevation badge per row on all three `renderActivityRow` surfaces, naming the fired mode(s) with the worst value (e.g. `altitude −282 m below ground`, `altitude drift 198 m · spike 80 m/s`). Reuses `appendAccessibleBadge` unchanged; no per-surface branching.
- **D-11:** Detail view's quality section shows three always-on mode lines, healthy or not, tier-styled: `lowest altitude 12 m`, `start/end altitude differ by 4 m (loop, 38 m apart)`, `max vertical rate 1.2 m/s`. Drift line's not-computable state reads in words.
- **D-12:** Detail view's Elevation Gain stat card is badged when the activity is elevation-flagged; nothing else is caveated. Reuses the stat-card badge precedent at `detail.ts:640-644` (`paceDisagreement`).
- **D-13:** No new list filter or URL param this phase.

**Validation report and proof (ELEV-02, Criteria 1–3)**
- **D-14:** Fixtures: three synthetic per-mode streams (one clean baseline mutated per mode) plus pinned real exemplars: `4556693525` (already `worked-example`, −282 m, Lisbon), add `4745489664` (−198 m drift on a loop) and `3149636661` (80.4 m/s spike; also drifts — fine as a real, not the isolation fixture). `pace-fixtures.test.ts` re-verifies pinned `expected` values against the live archive.
- **D-15:** `30-CALIBRATION.md`, same convention as `27-CALIBRATION.md`, written by `scripts/compute-elevation-calibration.mjs` behind an npm script, reading `data/` read-only, pure functions importable by its `.test.mjs`. Sections: live denominators; thresholds in force including the derived loop radius and justification; per-mode cohorts with worst-case IDs; the 3×3 overlap matrix (raw AND loop-gated); the union with device-family breakdown; the drift not-computable cohort; the loop-gate exclusions by ID; Criterion 2's independence evidence. A companion `compute-elevation-recount.mjs` reads only the shipped index and must not import the classifier.
- **D-16:** Streams proved byte-unchanged by a digest before/after in the calibration script plus a code audit; a test asserts the new module and both scripts have no `fs` write target under `data/` (the T-27-09 pattern).
- **D-17:** Phase ends on its own lightweight human browser checkpoint. Checkpoint hazards carried from Phase 27 D-18: hard-reload after every fixture edit, verify the served digest not the build log, viewport clamps to 500..941, every row must assert reachable extent against an independently derived value.

### Claude's Discretion
- Exact field names, badge wording, sr-only "why it matters" sentences per mode.
- Whether the three synthetic fixtures share one baseline builder or three small ones.
- The report's markdown layout beyond D-15's named sections; the recount script's structure (mirror `compute-pace-quality-recount.mjs`).
- Whether drift reports signed `deltaM` (recommended: signed, badge shows the absolute value).
- Plan/wave breakdown, including whether the D-04 requirement-text correction is its own task or folded into the calibration plan — it must land before the checkpoint plan drafts its rows.

### Deferred Ideas (OUT OF SCOPE)
- Elevation-flagged list filter / URL param (Phase 29-style second toggle) — a new list capability.
- Marker on the detail altitude chart at the offending sample/range — a new chart annotation surface.
- Caveats on aggregate elevation totals (yearly/overview) — correction-by-disclaimer, rejected.
- DEM correction / grade-adjusted pace — explicitly out of scope for the milestone.
- Garmin export adapter (STREAM-04) — externally blocked, unrelated.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ELEV-01 | Implausible altitude detected/flagged archive-wide by three independent mechanisms; measured cohort corrected from "71 (raw)" to the loop-gated figures below | Raw 11/34/39/71 reproduced exactly against the live archive; loop-gated drift = 21 (radius derivation below); loop-gated union = **60** with a recomputed overlap matrix and device-family breakdown (Summary). D-04's requirement-text correction is fully specified: "34" → "21", plus the 12 point-to-point exclusions and 1-of-34 no-position case, PLUS the archive-wide (not just the raw-34) drift not-computable cohort of 207. |
| ELEV-02 | Validated against the whole archive, per-mode flag rates reported, flag-only | `compute-pace-quality-calibration.mjs`/`compute-pace-quality-recount.mjs` give an exact, line-numbered skeleton to mirror for `compute-elevation-calibration.mjs`/`compute-elevation-recount.mjs`, including the `git status --porcelain data/` / T-27-09 no-write-under-`data/` pattern D-16 extends. `computePaceQualitySignals`/`buildPaceQualityShard`/`hasAnySevereSignal`/`notComputableSignals` read in full — exact extension points for the sixth field named. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Three altitude detectors (sub-ground, loop-gated drift, vertical rate) | API / Backend (CI compute step — the nightly `compute-all-stats` chain, this project's only "backend") | — | Same mapping as Phase 27: computed once in `compute-dashboard-index.ts`'s existing per-activity loop, written to `data/`, read many times by the client. No new compute step is warranted — the stream is already read for the other five signals. |
| Sixth index scalar field + shard extension | Database/Storage | API/Backend (writer) | `elevation` lands on the existing `quality` object on `DashboardIndexRow` and the existing `PaceQualityShard` — no new file, no new fetch (D-05). |
| Badge rendering (list + detail) | Browser / Client | — | `list.ts` (`qualityBadgeSpecs`), `detail-sections.ts` (`buildQualitySignalsSection`), `detail.ts` (Elevation Gain stat card) — static SPA render path, no server tier. |
| Calibration dry-run + independent recount | API / Backend (offline script) | Database/Storage | `scripts/compute-elevation-calibration.mjs` (imports the classifier, writes `30-CALIBRATION.md` only) and `scripts/compute-elevation-recount.mjs` (reads shipped `index.json` only, D-15). |

**Note on this project's tiers:** static SPA on GitHub Pages + a GitHub Actions nightly compute pipeline; no live "API/Backend" server exists — identical to Phase 26/27's own established mapping.

## Summary

This phase is pure extension of an already-shipped six-file system (`pace-quality.ts`, `pace-fixtures.ts`, `compute-dashboard-index.ts`, `list.ts`, `detail.ts`, `detail-sections.ts`) plus two new scripts mirroring two already-shipped ones (`compute-pace-quality-calibration.mjs`, `compute-pace-quality-recount.mjs`). Every extension point named in CONTEXT.md's `<code_context>` was confirmed present, with exact line ranges, during this session. No new library, no new fetch, no new shard file, no new UI surface — the entire integration is additive fields and additive rows inside structures Phase 27 already built for exactly this purpose (its own CONTEXT.md names Phase 30 as the next consumer three times).

**Primary recommendation:** Extend `ActivityQualitySignals` with a seventh key, `elevation: ElevationSignal` (D-07's shape), computed inside `computePaceQualitySignals`/`buildPaceQualityShard` from the SAME `stream`/`metadata` those functions already receive — `metadata` needs exactly two new fields, `startLatlng: unknown` and `endLatlng: unknown`, read from `activity.start_latlng`/`activity.end_latlng` in `compute-dashboard-index.ts` (both already typed `number[]|undefined` on `StravaActivity` — zero new file reads, matching D-01's own claim). `hasAnySevereSignal`'s `Pick<...>` signature is deliberately NOT widened to include `elevation` (D-06) — a second, sibling boolean (e.g. `hasElevationConcern`) can exist on the signal tree without ever entering the `anySevere` union. `qualityBadgeSpecs` in `list.ts` gets a fourth `if` block reading `quality.elevation`, following the exact same pattern its three existing blocks already use. `buildQualitySignalsSection` in `detail-sections.ts` gets three more always-on rows (not one) — see Architecture Patterns.

### D-03: the loop radius — a much stronger finding than "a visible gap"

The measured start/end haversine distance distribution over the 1,658 positioned activities is **not merely gapped, it is bimodal with a literal zero-width dead zone**:

```
count with distance < 500 m:  1,048  (all EXACTLY 0.0 m — not "near zero", bit-identical start/end coordinates)
count with distance >= 500 m:   610  (minimum value in this group: 552.44 m)
```

Every one of the 1,658 positioned activities has a start/end distance of either **exactly 0 m** or **≥ 552.44 m** — nothing whatsoever falls in `(0, 552.44)`. This means any radius from just above 0 m up to 552 m produces an **identical** loop/non-loop partition; the 200 m scouting placeholder happened to land inside this gap by chance, but so would 50 m or 500 m.

**Recommendation: `LOOP_RADIUS_M = 100`.** Justification for the report: 100 m is comfortably inside the archive's own empty gap (0 m to 552.4 m), reads naturally as "returned to the same place" (the actual measured values are either bit-identical or multiple hundreds of metres apart — there is no ambiguous middle case in this archive to be sensitive to), and is a round number a reader does not need the underlying histogram to trust. Any other value in `(0, 552.4)` is provably equivalent on this archive; 100 m is recommended over, e.g., 500 m only for headroom against future archive growth introducing a genuine near-boundary case.

**Loop-gated drift count at this (or any) radius in the gap: 21** (all 21 have `dist === 0`; none of the 610 "went somewhere" activities also clears the 60 m drift threshold in a way the radius choice would affect — this was not checked exhaustively for the full 610, but the raw-34 cohort's own 12 point-to-point members prove at least some outside-radius activities DO drift >60 m and are correctly excluded).

### D-04: the requirement-text correction, fully specified

| Cohort | Count | IDs (worst few, or full list where short) |
|---|---|---|
| Raw drift (no loop gate, `\|alt[end]−alt[start]\| > 60`) | 34 | worst: `4745489664` (−197.6 m), `3149636661` (−172.6 m), `5493309448` (+164.2 m) |
| → loop-gated, flagged (within 100 m AND `>60m`) | **21** | `3149636661, 3586323092, 3990602140, 4008757628, 4445647560, 4538002815, 4548213751, 4607194853, 4612766385, 4617866193, 4630590685, 4635602773, 4745489664, 5059193031, 5059211392, 5127688480, 5315761428, 5382683663, 5427439252, 5493309448, 8861201499` |
| → excluded, point-to-point (dist ≥ 552 m, from 626 m to 5,825 m) | 12 | `3475743040, 3475724298, 3925007542, 5551478413, 5747186018, 3963359864, 3475724049, 4391829317, 3475715995, 3475742446, 3475736537, 3744595598` |
| → excluded, no position at all | 1 | `4598855187` |

**These four numbers (21/12/1, summing to 34) exactly reproduce CONTEXT.md's own scouting measurement** — this research independently re-derives them at a different (but archive-equivalent) radius, confirming they are not an artifact of the 200 m placeholder specifically.

**New finding beyond CONTEXT.md's scope:** D-02 requires drift `not-computable` for "no start/end position" **archive-wide**, not merely within the raw-34 cohort. Measured: of the full 1,865 alt-carrying streams, **207 have no computable start/end position** (missing key, or `start_latlng`/`end_latlng` present as Strava's own empty-array `[]` "no GPS" convention — 150 activities archive-wide carry `start_latlng: []`). The drift-computable population is therefore 1,865 − 207 = 1,658, split into 1,048 loops (21 flagged, 1,027 clear) + 610 point-to-point (excluded by design, not not-computable — D-01's mechanism only excludes them from the loop test, it does not mark them unknown). **The calibration report's "drift not-computable cohort" section (D-15) must report 207, not 1** — the "1" is only the count within the pre-existing raw-34 diagnostic; the real not-computable population is far larger and belongs in its own denominator line, following D-06's exact same "24/25 stream-less activities" denominator-reconciliation precedent Phase 27 already established.

### Raw-definition reproduction (must reproduce BEFORE loop-gating — the reachability-probe-must-use-named-input lesson)

Reproduced exactly against the live archive, confirming CONTEXT.md's scouting numbers still hold on 2026-09-18:

```
sub-ground (< -50 m):      11   worst: 4556693525 (-282 m), 7382336793 (-189 m), 5493309448 (-125.4 m)
raw drift (no loop, >60m): 34   worst: 4745489664 (-197.6 m), 3149636661 (-172.6 m), 5493309448 (+164.2 m)
vertical rate (>5 m/s):    39   worst: 3149636661 (80.4 m/s), 5059198439 (19.4), 3925007542 (18.6)
union (raw):                71
overlaps (raw): sub∩drift 7, sub∩rate 3, drift∩rate 5
device breakdown (raw union): Suunto 9 50, Garmin fēnix 6 Pro 12, no device name 8, Garmin vívoactive 4 1
```

Every figure matches CONTEXT.md's `<code_context>` table exactly — the archive has not drifted since 2026-09-18's scouting session (same day).

### Loop-gated overlap matrix and union (the D-15 calibration report's real numbers)

```
sub-ground:           11
drift (loop-gated):   21
vertical rate:        39
UNION:                60   (not 71 — the union shrinks because loop-gating removes 13 of the
                             raw-34 drift activities, some of which were driving raw overlaps)

sub ∩ drift:           6   [3586323092, 4008757628, 4612766385, 5127688480, 5427439252, 5493309448]
sub ∩ rate:            3   [4454640041, 4598855187, 5493309448]   (UNCHANGED from raw — drift
                                                                    loop-gating does not touch this pair)
drift ∩ rate:          3   [3149636661, 4538002815, 5493309448]   (down from raw's 5 — two of the
                                                                    raw overlap's activities were
                                                                    point-to-point and are now excluded)
all three:             1   [5493309448]

device breakdown (loop-gated union, 60 total): Suunto 9 46, Garmin fēnix 6 Pro 11,
                                                no device name 2, Garmin vívoactive 4 1
```

Inclusion-exclusion check: 11 + 21 + 39 − 6 − 3 − 3 + 1 = 60. ✓ Matches the directly-counted union.

**Criterion 2's independence evidence gets STRONGER after loop-gating, not weaker:** sub∩drift drops from 7/11 (64% of sub-ground activities also drift) to 6/11 (55%), and drift∩rate drops from 5/34 (15%) to 3/21 (14%) — loop-gating removes false "drift" members that were coincidentally also flagged by another mode, so the remaining drift cohort is a cleaner, more independent signal than the raw one the requirement originally measured.

**5493309448 fires all three modes** — sub-ground −125.4 m, loop-gated drift +164.2 m (loop, dist 0 m), and appears in the vertical-rate cohort too. This is a legitimate candidate for a fourth "fires everything" illustrative mention in the report, though CONTEXT.md does not require one.

### D-08: carry-forward-filled altitude manufactures vertical-rate spikes — confirmed, load-bearing

`derive-stream.ts`'s `carryForward()` (called on `altRaw` at line 176: `altFilled = altPresent ? carryForward(altRaw) : undefined`) repeats the last valid altitude reading across any gap in the source data — identical to how `d` (distance) is filled, and the exact mechanism Phase 27's `syntheticDecimationAliasedStream`/impossible-sample overlap already exploits for distance. **This measurably manufactures vertical-rate violations for altitude the same way:**

- Archive-wide: of **72** total violating sample-pairs across the 39 flagged activities, **19 (26%)** are immediately preceded by a run of ≥2 samples with byte-identical altitude (i.e., a carry-forward-filled flat stretch, then a single-tick jump).
- **Directly confirmed on the pinned worst-case fixture, `3149636661`** (the archive's single worst vertical-rate reading, 80.4 m/s): the raw sample sequence around the offending pair is

  ```
  t=69..80 (samples 15-21): alt = 191.8, 191.8, 191.8, 191.8, 191.8, 191.6, 191.6   (flat/near-flat for 12s)
  t=82     (sample 22):     alt = 30.8                                              (single 2s tick, -160.8 m)
  ```

  A flat altitude reading held for six consecutive samples (12 seconds), then a single 2-second tick carrying the entire 160.8 m descent, reading as 80.4 m/s. This is structurally identical to Phase 27's decimation-aliasing finding for the distance channel: the device (or the FIT/barometric decoder) evidently updates its altitude reading at a coarser interval than its time/position channel, and `derive-stream.ts`'s carry-forward fill repeats the stale value rather than interpolating — so a genuine, gradual altitude change collapses into one recorded tick and reads as a physically implausible instantaneous rate.

**Finding, stated per D-08's requirement: carry-forward fill MANUFACTURES apparent vertical-rate violations; it does not mask them.** Masking would require an existing large single-sample jump to be smoothed away by the fill — but carry-forward fill only ever repeats a prior value or preserves an already-present jump verbatim; it has no averaging step that could suppress a genuine spike. The risk runs in exactly one direction (false positives from filled-then-jump patterns), never the other (a real spike hidden by filling). This must be disclosed in the report per D-08, following the exact same "accept the overlap, disclose it" disposition Phase 27 chose for the impossible-sample/decimation coupling (its Common Pitfall 3) rather than engineering it away — D-09 already locks the raw, unsmoothed `|Δalt|/Δt` mechanism, so excluding filled stretches is not on the table without reopening a locked decision; disclosure (e.g., naming `worstRateMps` alongside a note when the offending pair follows a flat run, mirroring `countInsideZeroAdvanceRun`'s pattern) is the available lever.

### D-14: pinned fixture properties — exact values for `PINNED_FIXTURES.expected`

| Activity | minAltM | driftDeltaM (alt[end]−alt[start]) | startEndDistM | worstRateMps | sampleCount | Notes |
|---|---|---|---|---|---|---|
| `4556693525` | **−282.0** | −5.6 (does not drift) | 0 (is a loop) | 3.3 (idx 808, does not fire) | 1,682 | Already pinned as `worked-example`; sub-ground only. Its own drift and rate are both clean — confirms the sub-ground fixture does not accidentally also trip the other two modes, useful isolation evidence for Criterion 2. |
| `4745489664` | +4.2 (not sub-ground) | **−197.6** | **0** (confirmed loop) | 2.3 (does not fire) | 1,712 | Drift-only fixture — confirmed isolated from the other two modes. |
| `3149636661` | 19.8 (not sub-ground) | −172.6 (also drifts, loop dist 0) | 0 | **80.4** (idx 21→22) | 969 | CONTEXT.md's own text ("also drifts — fine as a real, not the isolation fixture") is independently confirmed: this activity fires BOTH drift and rate, so it must not be used as a synthetic-style single-mode isolation case. |

All three values match CONTEXT.md's cited figures exactly (−282 m, −198 m, 80.4 m/s) — this is a re-verification, not a correction. The two new `startEndDistM: 0` values are new information CONTEXT.md's own text anticipated but had not yet measured ("confirm its start/end distance").

**`pace-fixtures.test.ts` extension point:** `assertExpectedProperties` (lines ~199–252) is an exhaustive `switch` keyed on `expected` object property names, ending in `throw new Error('unhandled expected key ...')` for any key it doesn't recognize (line 252) — a deliberate total-switch guard. New pinned rows using `minAltM`, `driftDeltaM`, `startEndDistM`, `worstRateMps` as `expected` keys **will throw this error until the switch is extended with matching cases** that call the new elevation-detector functions against `loadPinnedStream(name)`. This is not optional wiring — it is the mechanism that makes "expected value drifted from reality" a loud test failure rather than a silently-stale fixture.

### D-06 regression baseline — verified live, not merely cited

Ran the actual generated (gitignored, locally present) `data/dashboard/index.json` and the shipped recount script:

```
$ node scripts/compute-pace-quality-recount.mjs --expect 299
Total rows: 1890
Rows with a computable stream: 1865
Not-computable count: 25              <- one more than CONTEXT.md's Phase-27-era "24" (expected
                                           archive drift, same pattern 27-RESEARCH.md's A1 names)
Per-signal severe counts: decimation 154, gapProfile 127, impossibleSamples 31
Recomputed composite (own arithmetic): 299
  vs. totals.qualityAnySevere:        299
  vs. count of row.quality.anySevere:  299
--expect 299: MATCH
PASS
```

**This is the exact byte-stable baseline the plan must assert survives Phase 30 unchanged.** `compute-pace-quality-recount.mjs`'s `TIERING_SIGNAL_KEYS = ['decimation', 'gapProfile', 'impossibleSamples']` (line 47) and `REQUIRED_QUALITY_SUBKEYS` (lines 50-56, currently five keys) do NOT include `elevation` and must NOT be extended to include it (D-06) — adding `elevation` to `REQUIRED_QUALITY_SUBKEYS` only (so the recount still validates the field's *presence*, without adding it to `TIERING_SIGNAL_KEYS`) is a safe, D-06-compliant extension; adding it to `TIERING_SIGNAL_KEYS` would silently join it to the composite and is exactly the "quietly reverse D-06" failure mode CONTEXT.md warns against by name.

## Standard Stack

### Core
No new runtime dependency — identical situation to Phase 27. Every primitive needed (haversine, per-sample rate arithmetic, `validateStreamSeries`, `appendAccessibleBadge`) already exists in this codebase.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| — | — | — | No new dependency; matches `.planning/research/SUMMARY.md`'s milestone-wide rejection of `simple-statistics`/`d3-array` and Phase 26/27's own "no new library" precedent |

### Supporting
Not applicable.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled haversine (already exists verbatim in `derive-stream.ts:42-50`, private/unexported) | A geo/distance npm package | Rejected — the exact function this phase needs already exists in the codebase; the only work is exporting it (or a copy) for use in `compute-dashboard-index.ts`/`pace-quality.ts`, not sourcing a new implementation |

**Installation:** none required.

**Version verification:** not applicable — no package to verify.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages — the haversine function already exists in the codebase (`derive-stream.ts`) and every other primitive (per-sample rate, min/max, `validateStreamSeries`) is either already exported or a same-shape small pure function following `pace-quality.ts`'s existing style. `slopcheck` was not run because there is nothing to run it against. If a future planning pass introduces any `package.json` dependency, the Package Legitimacy Gate protocol must be re-run before it ships.

## Architecture Patterns

### System Architecture Diagram

```
data/activities/{id}.json  (device_name, source_provider, elapsed_time, moving_time,
                             start_latlng, end_latlng  <- TWO NEW FIELDS THIS MODULE READS,
                                                            both already typed on StravaActivity,
                                                            zero new file reads)
data/streams/{id}.json     (t[], d[], alt[]?  — committed, byte-identical; alt already
                             carry-forward filled by derive-stream.ts, D-08's own subject)
        │                          │
        ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  compute-dashboard-index.ts  (EXTENDED — existing per-activity loop,      │
│                                same stream read already used for the      │
│                                other five signals, D-05's "no new fetch") │
│                                                                            │
│  qualityMetadata gains startLatlng/endLatlng (both `unknown`, narrowed    │
│  inside the elevation module per this file's existing convention)        │
│                                                                            │
│  computePaceQualitySignals(stream, metadata) now also computes:          │
│    - subGroundSignal(alt)                        <- min(alt) < -50       │
│    - closureDriftSignal(alt, startLatlng, endLatlng, loopRadiusM=100)    │
│                                                    <- loop-gated |Δalt|>60│
│    - verticalRateSignal(t, alt)                  <- per-sample |Δalt|/Δt │
│                                                                            │
│  elevation.tier = 'severe' iff ANY of the three fires; NEVER folds into  │
│  hasAnySevereSignal's Pick<> (D-06) — a SIBLING boolean only             │
│                                                                            │
│  Writes elevation onto the SAME quality object (7th key), SAME shard     │
└──────────────────────────────────────────────────────────────────────────┘
        │                                              │
        ▼                                              ▼
data/dashboard/index.json                    data/stats/pace-quality/{id}.json
(quality.elevation, 7th key,                  (elevation evidence: per-mode raw values,
 schemaVersion stays 1)                        offending sample index for vertical rate)
        │                                              ▲
        ▼                                              │ SAME fetch already wired
┌────────────────────────┐                    (Phase 27's paceQualityClient.load,
│ list.ts                │                     no new client, no new fetch — D-05)
│ qualityBadgeSpecs()     │                    ┌─────────┴──────────┐
│ +4th `if` block         │                    │ detail.ts /         │
│ (elevation, D-10)        │                    │ detail-sections.ts  │
└────────────────────────┘                    │ - 3 NEW always-on   │
                                                │   mode lines (D-11) │
                                                │ - Elevation Gain    │
                                                │   stat card badge   │
                                                │   (D-12, mirrors    │
                                                │   detail.ts:682     │
                                                │   pattern exactly)  │
                                                └─────────────────────┘

Offline, CI-adjacent (D-15's independent recount — NOT a browser path):
data/dashboard/index.json
        │  read directly, NO import of pace-quality.ts
        ▼
scripts/compute-elevation-recount.mjs  (NEW, mirrors compute-pace-quality-recount.mjs's
        │                               readShippedIndex/recount/evaluate/main shape)
        ▼
stdout — elevation cohort counts, elevation.tier presence check, does NOT touch
         anySevere/TIERING_SIGNAL_KEYS (D-06's own boundary)

scripts/compute-elevation-calibration.mjs  (NEW, mirrors compute-pace-quality-calibration.mjs:
        │                                   readdirSync(activities)+readdirSync(streams) sweep,
        │                                   per-file try/catch, imports pace-quality.ts DIRECTLY
        │                                   — this is the one script allowed to)
        ▼
.planning/phases/30-elevation-quality-signal/30-CALIBRATION.md
        (sha256 digest of data/streams/ BEFORE and AFTER the sweep, D-16)
```

### Recommended Project Structure

```
src/analytics/
├── pace-quality.ts              # EXTENDED — ElevationSignal type, subGroundSignal/
│                                 #   closureDriftSignal/verticalRateSignal functions,
│                                 #   elevation added to ActivityQualitySignals (7th key),
│                                 #   ActivityQualityMetadata gains startLatlng/endLatlng
├── pace-quality.test.ts         # EXTENDED — unit tests per mode, including the three
│                                 #   "demonstrated failing when its own fixture is removed"
│                                 #   cases (Criterion 2), and a test asserting
│                                 #   hasAnySevereSignal's Pick<> type does NOT include
│                                 #   'elevation' (a compile-time proof D-06 holds)
├── pace-fixtures.ts             # EXTENDED — three synthetic per-mode elevation fixtures,
│                                 #   two new PINNED_FIXTURES rows (4745489664, 3149636661)
├── pace-fixtures.test.ts        # EXTENDED — assertExpectedProperties switch gains
│                                 #   minAltM/driftDeltaM/startEndDistM/worstRateMps cases
├── compute-dashboard-index.ts   # EXTENDED — reads start_latlng/end_latlng into
│                                 #   qualityMetadata (zero new file reads)
└── dashboard-index.types.ts     # UNCHANGED — quality: ActivityQualitySignals already
                                  #   covers elevation once pace-quality.ts's interface grows

src/dashboard/
├── data/
│   └── pace-quality-client.ts   # EXTENDED — parse function gains elevation fields
└── views/
    ├── list.ts                  # EXTENDED — qualityBadgeSpecs() 4th `if` block (elevation)
    ├── detail.ts                # EXTENDED — Elevation Gain stat card badge (mirrors
    │                             #   the existing Pace-stat-card pattern at lines 678-691
    │                             #   exactly — same appendAccessibleBadge call shape)
    └── detail-sections.ts       # EXTENDED — 3 new always-on rows in
                                  #   qualitySignalsSectionPlan/buildQualitySignalsSection
                                  #   (8 total rows, not 5); notAvailableRows() also grows
                                  #   by 3

scripts/
├── compute-elevation-calibration.mjs  # NEW (D-15) — imports pace-quality.ts directly;
│                                       #   writes ONLY 30-CALIBRATION.md; sha256 digest
│                                       #   of data/streams/ before/after (D-16)
├── compute-elevation-calibration.test.mjs
├── compute-elevation-recount.mjs      # NEW (D-15) — reads data/dashboard/index.json
│                                       #   ONLY, zero import of pace-quality.ts
└── compute-elevation-recount.test.mjs
```

### Pattern 1: Extending `ActivityQualitySignals` without disturbing `anySevere`

**What:** `hasAnySevereSignal` takes `Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'>` — a `Pick<>`, not the full interface. Adding `elevation: ElevationSignal` to `ActivityQualitySignals` costs this function nothing; its parameter type is unaffected by construction, and TypeScript will not silently widen it.

**Confirmed source (this session):** `src/analytics/pace-quality.ts:848-856`.

**When to use:** This is the exact mechanism that makes D-06 ("elevation stays OUTSIDE `anySevere`") a structural guarantee rather than a discipline to remember — a future reader adding `elevation` to `hasAnySevereSignal`'s `Pick<>` is a one-line, reviewable diff, not an accidental default. The plan should add a test literally asserting the `Pick<>` key list is unchanged (e.g., a type-level test or a runtime assertion over `Object.keys` of a constructed `ActivityQualitySignals` fed through the function), following the same "prevent structurally rather than by convention" spirit `deviceFamilyDisplayName`'s exhaustive switch already uses (`detail-sections.ts` lines ~865-873).

### Pattern 2: The three-row detail-section extension, following `decimationRow`/`gapProfileRow`/`impossibleSamplesRow` exactly

**What:** Each existing tiering-signal row is a small pure function `(signal, notComputableReason, shard) => QualitySignalRow`, called from `qualitySignalsSectionPlan`'s fixed-order array, with a matching entry in `notAvailableRows()`'s five-row fallback.

**Confirmed source (this session):** `src/dashboard/views/detail-sections.ts` lines 921-1010 (the three row-builder functions), 1139-1160 (`qualitySignalsSectionPlan`), 1069-1097 (`notAvailableRows`).

**When to use:** D-11 requires THREE new rows (sub-ground, closure drift, vertical rate), not one collapsed "Elevation" row — write `subGroundRow`, `closureDriftRow`, `verticalRateRow` following the exact same shape (label, valueText, tier, explanation, evidenceText), append them to `qualitySignalsSectionPlan`'s returned array (order per D-11's own listing: lowest altitude, start/end differ, max vertical rate) and to `notAvailableRows()`'s fallback array. The section becomes 8 rows total, not 5 — `buildQualitySignalsSection`'s rendering loop needs no change at all, since it iterates `plan.rows` generically.

### Pattern 3: The Elevation Gain stat-card badge, mirroring the Pace stat-card exactly

**What:** `detail.ts`'s Pace stat card conditionally appends an `appendAccessibleBadge` call directly inline (not through a helper) when `disagreement !== null`, immediately before `statGrid.appendChild(paceStatCard)`.

**Confirmed source (this session):** `src/dashboard/views/detail.ts` lines 669-691 (the Pace stat-card badge, `paceStatCard` built then conditionally badged then appended; the Elevation Gain stat card is built two lines below at line 691 with no badge).

**When to use:** Build the Elevation Gain stat card as its own variable (rather than the current inline `statGrid.appendChild(buildStatCard(...))`), conditionally call `appendAccessibleBadge(elevationStatCard, visibleText, explanation, descriptionId)` when `quality?.elevation.tier === 'severe'`, then append it — same three-line shape as the Pace card. `quality` here is `indexClient.getRow(detail.id)?.quality` (already fetched, no new Promise.all member per D-05).

### Pattern 4: The shard-mirror discipline (no new shard file)

**What:** `PaceQualityShard`'s D-17 evidence fields already carry per-signal raw evidence (`gapIntervals`, `impossibleSamples`, `zeroAdvanceRunProfile`). Elevation's evidence (the offending vertical-rate sample index/value, the resolved loop radius and measured distance) is a small addition to this SAME shard shape, not a new file.

**Confirmed source (this session):** `src/analytics/pace-quality.ts` lines 927-944 (`PaceQualityShard` interface), 1013-1098 (`buildPaceQualityShard`).

**When to use:** Add `elevation: ElevationEvidence` (or fold fields into the existing shape) to `PaceQualityShard`; `pace-quality-client.ts`'s parse function needs matching fields added to its own tolerant parser (it already has a `VALID_TIERS`/`VALID_DEVICE_FAMILIES` pattern to extend, not replace).

### Anti-Patterns to Avoid

- **Widening `hasAnySevereSignal`'s `Pick<>` to include `elevation`** — the single most consequential mistake this phase could make; D-06 is explicit that this must not happen, and Pattern 1 above shows exactly why it is structurally easy to avoid.
- **Adding `elevation` to `compute-elevation-recount.mjs`'s (or a shared) `TIERING_SIGNAL_KEYS` array** — same failure as above, in the recount script rather than the classifier; the recount script must have its OWN, separate elevation-cohort counting logic that never touches `anySevere`'s three-key list.
- **Treating the raw-34 drift cohort's "1 no-position" as the complete not-computable population** — it is not; the archive-wide not-computable population (207) is roughly 200× larger and is the number D-15's report section must actually name (see D-04 above).
- **Excluding filled-then-jump vertical-rate violations to "fix" the D-08 correlation** — D-09 already locks the raw, unsmoothed mechanism; Phase 27's own precedent for an analogous coupling (impossible-sample/decimation, its Common Pitfall 3) was disclose, not engineer away, and CONTEXT.md's D-08 action text asks research to "check ... and say so in the report", not to propose a fix.
- **Picking a loop radius by re-deriving "the 200 m placeholder was fine"** — D-03 explicitly forbids fixing 200 m without derivation; this research's finding that the entire `(0, 552m)` range is archive-equivalent should be stated in the report rather than silently converging back on 200 m by coincidence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Haversine distance for the loop test | A second haversine implementation | `derive-stream.ts`'s existing private `haversineMeters` (lines 42-50) — export it, or copy its exact formula/constant (`EARTH_RADIUS_M = 6371000`) | A second implementation with a different Earth-radius constant would silently produce a different loop-radius boundary than the one this research measured; exporting or copying verbatim is required, not merely convenient |
| A percentile/quantile function (if the report wants percentiles of the start/end-distance distribution) | A new implementation | `quantile()` (`pace-derivation.ts`, exported) — same R-7 implementation every other phase reuses | Consistency with Phase 26/27/28's own reuse mandate; this research's own histogram used simple sorted-array indexing, which is fine for a report table but `quantile()` should be used if the calibration script needs a formal percentile |
| An accessible badge with visible text + explanation | A new badge DOM builder | `appendAccessibleBadge` (`list.ts`) | D-10 names this explicitly, and Pattern 1/Pattern 3 above show it already covers both the list-badge and stat-card-badge shapes this phase needs |
| A "read the shipped index, count fields, print a report" recount script | A new ad-hoc script shape | `scripts/compute-pace-quality-recount.mjs`'s exact shape (`readShippedIndex`/`recountComposite`/`evaluateReport`/guarded `main()`) | Direct, already-tested precedent for exactly this kind of D-03-style independent verification; this phase's recount script should be structurally near-identical, differing only in which fields it counts |
| A "sweep the archive, build a markdown report" calibration script | A new ad-hoc script shape | `scripts/compute-pace-quality-calibration.mjs`'s exact shape (per-file try/catch sweep over `data/activities/` then `data/streams/`, pure exported functions, guarded `main()`, single declared write target) | Same reuse mandate; this phase's calibration script additionally needs the D-16 sha256-digest-of-`data/streams/` step, which is new relative to Phase 27's script and must be added, not found pre-built |

**Key insight:** identical to Phase 27's own conclusion — every primitive this phase needs already exists in a directly-reusable shape. The genuinely new work is three small pure detector functions (~15-30 lines each, matching the codebase's existing `countImpossibleSamples`-style shape) plus the D-16 stream-digest step, which is the one piece of net-new machinery this phase requires beyond what Phase 27 already built.

## Common Pitfalls

### Pitfall 1: Loop-gating changes which activities overlap, not just how many drift
**What goes wrong:** A plan that reuses CONTEXT.md's raw overlap figures (sub∩drift 7, drift∩rate 5, union 71) for the `30-CALIBRATION.md` report would be reporting numbers the shipped detector cannot itself produce, since the shipped drift mode is loop-gated (D-01), not raw.
**Why it happens:** CONTEXT.md's own measurement table is explicitly labelled "raw definitions, for research to measure loop-gated" — easy to skim past that framing under time pressure.
**How to avoid:** Use this research's loop-gated figures (union 60; sub∩drift 6, sub∩rate 3, drift∩rate 3, all-three 1; device breakdown Suunto 9 46 / fēnix 6 Pro 11 / no device 2 / vívoactive 4 1) as the numbers the calibration script must reproduce and the report must state. The raw figures belong in the report ONLY as the "34 raw, corrected to 21" narrative (D-04), not as the overlap matrix.
**Warning signs:** A calibration script whose printed union is 71 rather than 60 — that means the drift detector it imported is not loop-gated, a real implementation bug, not a report-writing slip.

### Pitfall 2: The `expected` switch in `pace-fixtures.test.ts` throws on unrecognized keys — a silent placeholder is not possible
**What goes wrong:** Adding a new `PINNED_FIXTURES` row with `expected: { minAltM: ... }` before extending `assertExpectedProperties`'s switch produces a hard test failure (`unhandled expected key "minAltM"`), not a silently-skipped assertion.
**Why it happens:** This is by design (a defensive total-switch), but a plan that adds fixture rows and test-switch cases in separate tasks/waves without sequencing them correctly will see red tests between those tasks.
**How to avoid:** Add the fixture rows and the switch cases in the SAME task, or sequence the switch-case task strictly before the fixture-row task within one wave.
**Warning signs:** `pace-fixtures.test.ts` failing with "unhandled expected key" naming one of `minAltM`/`driftDeltaM`/`startEndDistM`/`worstRateMps`.

### Pitfall 3: `3149636661` cannot serve as a single-mode isolation fixture
**What goes wrong:** Using `3149636661` (the vertical-rate exemplar) as "the fixture whose removal proves the rate detector flags nothing" would be invalid — this activity ALSO drifts (loop-gated, −172.6 m), so removing it also perturbs the drift cohort, contaminating Criterion 2's "each detector fails when its own fixture is removed" proof.
**Why it happens:** It is the single worst vertical-rate example in the archive, making it tempting to reach for as *the* rate fixture.
**How to avoid:** Use `3149636661` only as a pinned REAL exemplar reported in the calibration document's per-mode cohort tables (D-14 explicitly sanctions this: "fine as a real, not as the isolation fixture"). The Criterion-2 "remove one fixture, that mode alone stops firing" proof must use the three SYNTHETIC per-mode fixtures (D-14's first sentence), each hand-constructed to fire exactly one mode.
**Warning signs:** A test named something like "removing 3149636661 makes the vertical-rate detector flag nothing" that also silently changes the drift cohort's count.

### Pitfall 4: `start_latlng`/`end_latlng` can be an empty array, not merely absent
**What goes wrong:** A naive `activity.start_latlng == null` check misses the 150-activity population (measured this session) that carries `start_latlng: []` — Strava's own convention for "no GPS," not a missing key. `positionInfo`-style logic must check `Array.isArray(x) && x.length === 2`, matching the existing convention `derive-stream.ts`'s own lat/lng handling and this research's measurement script both use.
**Why it happens:** `[]` is truthy and not `null`/`undefined`, so a shallow presence check passes it through, then array-index access (`s[0]`, `s[1]`) silently reads `undefined`, which propagates as `NaN` through the haversine formula rather than throwing — a silent corruption, not a crash.
**How to avoid:** Guard with an explicit length check (`Array.isArray(s) && s.length === 2 && Array.isArray(e) && e.length === 2`) before computing distance, exactly as this research's script and `StravaActivity`'s own `start_latlng?: number[]` optionality both anticipate.
**Warning signs:** A NaN or `Infinity` appearing in a distance computation, or a loop-gated drift count that is suspiciously different from this research's measured 21.

### Pitfall 5: `hasAnySevereSignal`'s exhaustive switch pattern elsewhere in this codebase is a model, not a mandate here
**What goes wrong:** `deviceFamilyDisplayName` (`detail-sections.ts`) uses a `switch` with NO `default` so TypeScript catches a missing case at compile time. A plan might reach for the same pattern for `elevation.tier` dispatch and accidentally couple it to the SAME four-member `QualityTier` union used for `decimation`/`gapProfile`/`impossibleSamples` — which is fine (D-07's `tier: 'severe' | 'none' | 'not-computable'` is a THREE-member subset, deliberately excluding `'minor'`, per "no minor band").
**Why it happens:** Copy-pasting `decimationRow`'s shape without noticing D-07 explicitly narrows the tier union for elevation (no minor band exists).
**How to avoid:** `ElevationSignal.tier` should be its own type (`'severe' | 'none' | 'not-computable'`), not a reuse of the four-member `QualityTier` — reusing `QualityTier` verbatim would let a future call site assign `'minor'` to it, silently reintroducing a band D-07 explicitly rejected.
**Warning signs:** `tsc` accepting `elevation: { tier: 'minor', ... }` anywhere in the codebase.

## Code Examples

### The exact `Pick<>` guarantee that keeps elevation out of `anySevere` (D-06)
```typescript
// Source: src/analytics/pace-quality.ts:848-856 (unchanged by this phase)
export function hasAnySevereSignal(
  signals: Pick<ActivityQualitySignals, 'decimation' | 'gapProfile' | 'impossibleSamples'>
): boolean {
  return (
    signals.decimation.tier === 'severe' ||
    signals.gapProfile.tier === 'severe' ||
    signals.impossibleSamples.tier === 'severe'
  );
}
// Adding `elevation: ElevationSignal` to ActivityQualitySignals does not widen this
// function's parameter type — Pick<> is explicit about which keys it reads.
```

### The exact stat-card badge shape to copy for Elevation Gain (D-12)
```typescript
// Source: src/dashboard/views/detail.ts:678-691 (Pace card, the precedent; Elevation
// Gain currently has no badge — this is what to add, same shape)
const paceStatCard = buildStatCard(formatPace(paceSecPerKm), 'Pace');
if (disagreement !== null) {
  appendAccessibleBadge(
    paceStatCard,
    `Pace disputed — stream-derived ${formatPace(disagreement.streamPaceSecPerKm)}`,
    paceDisputedExplanation(disagreement),
    paceDisputedDescriptionId('detail-pace-stat')
  );
}
statGrid.appendChild(paceStatCard);
// NEW, mirroring the above exactly:
// const elevationStatCard = buildStatCard(formatOrDash(...), 'Elevation Gain');
// if (quality?.elevation.tier === 'severe') {
//   appendAccessibleBadge(elevationStatCard, visibleText, explanation, descriptionId);
// }
// statGrid.appendChild(elevationStatCard);
```

### The measured carry-forward-fill manufacture, reproducible against the live archive
```
Source: data/streams/3149636661.json, samples 15-22 (t in seconds, alt in metres)
t=69  alt=191.8
t=70  alt=191.8
t=71  alt=191.8
t=75  alt=191.8
t=76  alt=191.8
t=78  alt=191.6   <- carry-forward-filled flat stretch (6 consecutive near-identical readings)
t=80  alt=191.6
t=82  alt=30.8    <- single 2-second tick carries the entire 160.8 m change -> 80.4 m/s
```

### Device-family breakdown query pattern (reused from Phase 27's own measurement style)
```javascript
// Reproducible: for each id in the elevation union set, look up
// data/activities/{id}.json's device_name (or '(no device name)' when absent/blank),
// tally into a Record<string, number>. Loop-gated union (60 activities) breaks down as:
// Suunto 9: 46, Garmin fēnix 6 Pro: 11, (no device name): 2, Garmin vívoactive 4: 1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Requirement's raw start/end altitude difference as the drift criterion | Loop-gated (haversine-distance-qualified) drift, radius derived from the archive's own bimodal distance distribution | This phase | ELEV-01's "34" becomes "21"; ROADMAP/REQUIREMENTS text corrected per D-04 |
| `ActivityQualitySignals` as a five-signal, three-tiering-signal tree | Six-signal tree, elevation tiered but excluded from the tiering composite | This phase | `anySevere`'s definition (Phase 27 D-01) is EXTENDED in scope of what it ignores, not redefined — a new precedent for "a tiered signal that never joins the composite," distinct from Phase 27's `deviceEra`/`elapsedVsMoving` (which are untiered facts, not excluded tiering signals) |
| `PaceQualityShard`'s five-signal evidence | Six-signal evidence, same file | This phase | No new fetch, no new shard path — D-05's explicit design goal |

**Deprecated/outdated:** None — additive extension of an actively-used contract, identical in spirit to Phase 27's own extension of Phase 26.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `LOOP_RADIUS_M = 100` is this research's RECOMMENDATION, not a locked decision (D-03 delegates the exact value to research but the planner/user retains final sign-off per the phase's own discretion list) — any value in `(0, 552.4)` is provably archive-equivalent, so 100 is a stylistic choice within a mathematically flat region, not a load-bearing measurement | Summary, D-03 | LOW — even if a different value in the same range is chosen, every downstream count in this document (21 flagged, 12 point-to-point, 1 no-position, 207 not-computable, union 60) is UNCHANGED, since all of them were verified stable across 100/150/175/200/225/250/300 m during this session |
| A2 | The "19 of 72 (26%)" carry-forward-fill/vertical-rate correlation used a specific operationalization (≥2 consecutive byte-identical `alt` values immediately preceding the offending pair's start sample) that is this research's own construction, not an existing codebase function — a different operationalization (e.g., ≥3 samples, or checking BOTH samples of the offending pair rather than only the preceding run) could shift this count | D-08 | LOW — the qualitative finding (carry-forward fill manufactures, does not mask, vertical-rate violations) is independently confirmed by the exact worst-case fixture's raw sample trace (3149636661, samples 15-22), which needs no statistical operationalization to see directly |
| A3 | The 207 drift-not-computable figure counts "no start/end position" against the 1,865 alt-carrying streams (the natural denominator for a signal computed alongside the other two altitude modes); Phase 27's own precedent (D-06) uses "activities with a computable stream" as one axis and "all activities" as another — the calibration report should state which of several plausible denominators (1,890 all activities / 1,865 alt-streams / 1,658 positioned) each percentage in the drift section uses, per D-06's own "state which denominator" rule, which this research did not fully resolve into report prose | D-04 | MEDIUM — a report that states "207 not-computable" without naming its denominator invites the same kind of stale-percentage confusion Phase 27's D-06 was written to prevent; the planner should require the calibration script to print the denominator alongside every percentage, mirroring `compute-pace-quality-recount.mjs`'s own explicit denominator lines |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should the calibration report's overlap-matrix section show BOTH raw and loop-gated matrices, or loop-gated only?**
   - What we know: D-15 says "the 3×3 overlap matrix (measured raw: ...) — recompute loop-gated," which reads as "recompute" (replace), but D-04's narrative purpose (documenting that 34 was a raw measurement) benefits from showing both side by side.
   - What's unclear: whether "recompute loop-gated" means the report's PRIMARY matrix should be loop-gated with the raw figures appearing only in prose (D-04's narrative), or whether both full matrices should appear as tables.
   - Recommendation: show the loop-gated matrix as the primary, numbered table (since it reflects what the shipped detector actually flags), and the raw-34 breakdown (21/12/1) as a labelled sub-table under the D-04 narrative section — this satisfies both D-15's "recompute" instruction and D-04's "records that 34 was a raw-difference measurement" instruction without duplicating a full second 3×3 matrix.

## Environment Availability

Not applicable in the external-dependency sense — no new runtime/CLI/service dependency, identical to Phase 27.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test, measurement scripts | ✓ | 25.2.1 (session), 22 (project target) | — |
| TypeScript | `tsc --noEmit` gate | ✓ | 5.9.3 (per Phase 27 research; unchanged) | — |
| vitest | Unit/audit tests | ✓ | 4.0.18 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` (existing — `fileParallelism: false`, keep this setting) |
| Quick run command | `npx vitest run src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts` |
| Full suite command | `npm run test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ELEV-01 | Three elevation modes detected archive-wide; sub-ground/drift/rate cohorts reproduce this research's measured counts (11/21/39, union 60) | unit + integration (real archive) | `npx vitest run src/analytics/pace-quality.test.ts -t "elevation"` | ❌ Wave 0 (extend existing file) |
| ELEV-01 | Loop-gated drift excludes point-to-point and no-position cases correctly | unit, synthetic fixtures + the two new pinned reals | `npx vitest run src/analytics/pace-quality.test.ts -t "closure drift"` | ❌ Wave 0 |
| ELEV-01 | `elevation` never joins `anySevere` (D-06 structural guarantee) | unit (type-level or runtime Pick<> key assertion) | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes elevation"` | ❌ Wave 0 |
| ELEV-02 | Mode independence — each synthetic fixture fires exactly one mode; removing it flags nothing for that mode | unit, three synthetic fixtures | `npx vitest run src/analytics/pace-quality.test.ts -t "mode independence"` | ❌ Wave 0 |
| ELEV-02 | Dry-run composite reported; recount reproduces it without importing the classifier | integration (script, real archive) | `node scripts/compute-elevation-recount.mjs` | ❌ Wave 0 |
| ELEV-02 | Streams byte-unchanged after the calibration sweep | integration (digest before/after) | `node scripts/compute-elevation-calibration.mjs` (exits non-zero on digest mismatch) | ❌ Wave 0 |
| ELEV-02 | Phase 27's `anySevere` composite stays byte-stable (299/1,890) after this phase lands | regression | `node scripts/compute-pace-quality-recount.mjs --expect 299` | ✅ exists — re-run as a regression gate, not extended |
| ELEV-02 | Pinned fixture properties re-verify against the live archive | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ✅ exists — extend `assertExpectedProperties`'s switch (Pitfall 2) |
| ELEV-02 | No `fs` write target under `data/` from the new module/scripts (D-16) | unit (source scan) or integration (`git status --porcelain data/`) | `git status --porcelain data/` (empty) after both new scripts run, mirroring T-27-09 | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts`
- **Per wave merge:** `npm run test` (full suite, `fileParallelism: false`) + `node scripts/compute-pace-quality-recount.mjs --expect 299` (D-06 regression gate)
- **Phase gate:** Full suite green + `tsc --noEmit` + `npm run build-widgets` + `git status --porcelain data/` empty after both new scripts run, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/analytics/pace-quality.ts` — `ElevationSignal` type, `subGroundSignal`/`closureDriftSignal`/`verticalRateSignal` functions, `ElevationSignal` field on `ActivityQualitySignals`, `startLatlng`/`endLatlng` on `ActivityQualityMetadata`
- [ ] `src/analytics/pace-fixtures.ts` — three synthetic per-mode fixtures, two new `PINNED_FIXTURES` rows
- [ ] `src/analytics/pace-fixtures.test.ts` — extend `assertExpectedProperties`'s switch (sequenced with the fixture-row addition, Pitfall 2)
- [ ] `src/analytics/compute-dashboard-index.ts` — pass `start_latlng`/`end_latlng` into `qualityMetadata`
- [ ] `src/dashboard/data/pace-quality-client.ts` — parse elevation fields
- [ ] `src/dashboard/views/list.ts` — `qualityBadgeSpecs` 4th `if` block
- [ ] `src/dashboard/views/detail.ts` — Elevation Gain stat card badge
- [ ] `src/dashboard/views/detail-sections.ts` — 3 new always-on rows + `notAvailableRows()` extension
- [ ] `scripts/compute-elevation-calibration.mjs` + `.test.mjs` — new, mirrors `compute-pace-quality-calibration.mjs`, adds D-16's digest step
- [ ] `scripts/compute-elevation-recount.mjs` + `.test.mjs` — new, mirrors `compute-pace-quality-recount.mjs`, never imports the classifier
- [ ] `package.json` — two new scripts (`compute-elevation-calibration`, `compute-elevation-recount`)
- [ ] `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md` text correction ("34" → measured loop-gated figure, per D-04) — its own task, sequenced before the checkpoint plan drafts its rows
- [ ] A lightweight human browser checkpoint (D-17)

**Framework install:** none needed.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled by default), matching Phase 26/27. This phase's attack surface is narrower than Phase 27's: no new untrusted-string field reaches the DOM (elevation values are all numbers derived from the committed stream; no raw device-name-style string is introduced).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session surface touched |
| V4 Access Control | No | No access-control surface touched |
| V5 Input Validation | Yes | `start_latlng`/`end_latlng` are externally-derived numeric arrays (Strava/intervals.icu metadata) that must be defensively checked for the `[]`-vs-absent distinction (Pitfall 4) before any arithmetic; `validateStreamSeries`'s total/never-throwing contract extends to the three new pure detector functions on any array-shaped input, per this codebase's established discipline |
| V6 Cryptography | Yes (adjacent) | D-16's sha256 digest of `data/streams/` before/after the calibration sweep — uses Node's built-in `crypto.createHash('sha256')`, no new dependency; this is an integrity check, not a security boundary, but is the one place this phase touches cryptographic primitives |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed/adversarial `data/activities/{id}.json` (`start_latlng`/`end_latlng` as non-array, wrong-length array, or non-finite numbers) causing an uncaught exception in the new distance/detector functions | Denial of Service (client-side or CI-step crash) | Every new function must be total — bounds-check array length and finiteness before arithmetic (Pitfall 4), returning a not-computable/null result rather than throwing, matching `validateStreamSeries`'s existing discipline |
| A future reader silently widening `hasAnySevereSignal`'s `Pick<>` or the recount script's `TIERING_SIGNAL_KEYS` to include `elevation` | Tampering (silent policy reversal) | D-06's structural guarantee (Pattern 1) plus a dedicated test asserting the `Pick<>` key set is unchanged |

## Sources

### Primary (HIGH confidence — read/measured directly against the live repository this session)
- `src/analytics/pace-quality.ts` (read in full, 1,099 lines), `pace-fixtures.ts` (read in full, 481 lines), `dashboard-index.types.ts`, `compute-dashboard-index.ts` (read in full, 441 lines), `derive-stream.ts` (read in full), `stream.types.ts` (read in full) — confirmed every extension point, line numbers cited above
- `src/dashboard/views/list.ts` (targeted sections, `qualityBadgeSpecs`/`appendStatusBadges`/`appendAccessibleBadge`/`renderActivityRow`), `detail.ts` (targeted, `mountBestEffortsAndBadges`/Promise.all/stat-card badge), `detail-sections.ts` (targeted, rows 840-1227 read in full) — function signatures and exact line ranges confirmed by `grep -n` + `Read`
- `scripts/compute-pace-quality-recount.mjs` (read in full, 283 lines), `compute-pace-quality-calibration.mjs` (structure confirmed via `grep -n` over all 947 lines, doc-comment header read in full) — exact skeleton to mirror
- `data/streams/*.json` (1,865 files), `data/activities/*.json` (1,890 files), `data/dashboard/index.json` (gitignored, locally generated) — read via throwaway Node scripts at `/tmp/elev-research*.mjs`, never touching `src/`, `data/`, or `scripts/`; `node scripts/compute-pace-quality-recount.mjs --expect 299` run live against the local generated index
- `.planning/phases/27-per-activity-quality-signals/27-CONTEXT.md`, `27-RESEARCH.md` (both read in full) — the shape and conventions this phase's report/scripts must mirror
- `.planning/phases/30-elevation-quality-signal/30-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 30, `.planning/STATE.md` — read in full for requirement text, success criteria, and decision history

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md` — grepped for the non-goals section rather than read in full; the exact wording of other non-goal bullets beyond the one quoted was not independently re-verified this session (Phase 27's own research already did so)

### Tertiary (LOW confidence)
- None — this phase's research required no external web sources; the whole task was internal code reading and archive measurement.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every reused primitive confirmed present and unchanged by direct source read
- Architecture (shard/index extension, stat-card badge, detail-section rows): HIGH — every named integration point confirmed present in actual committed source with exact line numbers
- D-03 loop radius derivation: HIGH — the bimodal, zero-width-gap finding was directly measured and cross-checked at seven candidate radii (100-500m), all identical
- D-08 carry-forward-fill finding: HIGH for the archive-wide correlation (19/72) and the worst-case fixture's raw trace; MEDIUM for the specific "≥2 samples" operationalization choice (A2) — the qualitative conclusion (manufactures, does not mask) does not depend on that choice
- D-14 pinned fixture values: HIGH — all three activities' minAlt/deltaRaw/worstRate/dist/sampleCount measured directly against the live committed stream files, matching CONTEXT.md's cited figures exactly
- D-06 regression baseline (299/1,890): HIGH — verified live by running the actual shipped recount script against the actual locally generated index, not merely read from a prior document

**Research date:** 2026-09-18
**Valid until:** Recommend re-verifying all archive-wide counts (11/21/39/60, 154/127/31/299) at implementation time if more than ~1-2 weeks elapse — this archive grows via nightly CI sync, confirmed drifting by single-digit counts within the same milestone in both Phase 26's and Phase 27's own research (e.g., 24→25 stream-less activities between Phase 27 and this session).
