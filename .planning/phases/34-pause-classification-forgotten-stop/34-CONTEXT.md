# Phase 34: Pause Classification & Forgotten-Stop - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Every gap-bearing interval — a recording gap, or a merged unreliable segment that contains gap
time — is classified by the implied speed across the whole interval (its own merged metres ÷ its
own merged seconds) into one of four classes: stationary, walked, ran-through, transported. Timer-
running standstills — creeping near-zero stretches inside covered time plus the existing
zero-advance `pause` intervals — are flagged per activity as a possible forgotten stop. Both are
disclosed on the detail view in a new Pauses section with a summary row in Quality Signals, and
v2.2's "9 activities" transport figure is re-measured on merged segments with dated provenance.

**Requirements:** PAUSE-01, PAUSE-02, PAUSE-03, STOP-01, STOP-02, STOP-03 — plus Phase 34's own
half of SEG-05b if the classifier reads the detector's merged segments (it does; see D-01).

**Not in this phase:** stream-derived running pace and the disputed-pace threshold (Phase 35),
best-effort partitioning and the ceiling diff (Phase 36), review-queue ordering by pause class and
CUR-04 (Phase 37), a "stopped time removed" pace (STOP-04, out of milestone). Nothing is corrected:
no moving time, pace, split, total or best effort changes, no stream file is rewritten, and Phase
33's pace-chart clipping is not touched.

</domain>

<decisions>
## Implementation Decisions

### What gets classified

Measured during this discussion (throwaway probe, `classifyGaps` over 1,788 committed streams,
interval metres ÷ interval seconds — references, never expected values):

| Interval kind | Count | Implied speed |
|---|---|---|
| Recording gap ≥30 s | 2,168 | 2,054 < 0.3 m/s; 99 at 0.3–1.5; 15 above 1.5; none above 7.35 |
| Recording gap <30 s | ~2,630 | mostly < 0.3 m/s; a long tail through 1.5–5.5 m/s |
| Unreliable, no gap (isolated-jump / hidden-pause) | ~1,230 | almost all > 7.35 m/s — by construction |
| `pause` (zero-advance) | 663 | all stationary — by construction |
| 3475724402's 18 merged intervals | 18 | 2.31–4.06 m/s (developer's easy running ≈ 3.4 m/s) |

- **D-01:** **Only gap-bearing intervals are classified.** Recording gaps and gap-adjacent merged
  unreliable segments get a class from their own merged metres ÷ merged seconds. Isolated-jump and
  hidden-pause segments carry no off-clock time and sit above 7.35 m/s *by the detector's
  definition*, so a speed class would call every GPS jump "transported" — they are
  **not-classifiable** and keep only their Phase 32 mechanism label. Zero-advance `pause` intervals
  are stationary by definition (distance does not move) and are listed as such without a speed
  test. The classifier reads the detector's merged segments (via `pace-derivation.ts`'s existing
  import), never re-deriving them — Phase 34's half of SEG-05b, proven load-bearing the Phase 33
  D-15 way (stub the call, watch the classes change). Rejected: classifying every interval
  (≈1,230 jumps labelled transported); classifying raw gaps only (contradicts PAUSE-01 and
  criterion 1, and reproduces v2.2's gap-interval-alone undercount).
- **D-02:** **Four classes, not three: stationary / walked / ran-through / transported.**
  3475724402's merged segments sit at 2.3–4.1 m/s — continued running through signal loss, which
  none of PAUSE-01's three classes describe. Needs a **dated in-place amendment** to REQUIREMENTS
  PAUSE-01 (and ROADMAP Phase 34's goal/criterion 1 wording) adding `ran-through`, in the Phase 32
  D-03 pattern, so the verifier does not score the fourth class as a deviation. Rejected: stretching
  "walked" to mean "on foot" (a 4.06 m/s segment labelled walked); an "ambiguous" residual (would
  likely be the commonest label on the phase's own named activity).
- **D-03:** **No duration floor.** Every gap-bearing interval is classified however short; each
  carries its measured metres and seconds so the reader sees its scale. No new constant.
- **D-04:** **PAUSE-03 records both figures side by side.** (a) v2.2's exact rule (>100 m across a
  ≥30 s interval) re-run on merged segments, directly comparable to the old "9 activities, all at
  ≤14 km/h"; (b) the transported-class count under D-05's bands. Both in a regenerable artifact with
  dated provenance and a live denominator, plus a dated pointer line beside the old figure in
  `.planning/milestones/v2.2-REQUIREMENTS.md:165` ("in place of the old one" = superseded with a
  forward reference, not a silent overwrite of the archive).

### Speed bands

- **D-05:** **ran-through → transported = `UNRELIABLE_SPEED_LIMIT_MPS` (7.35), imported, not
  copied.** "Faster than this athlete physically runs" already has one calibrated definition; a
  second transport constant would have ~2 gap-bearing intervals above 7.35 to calibrate on. The
  single-source audit should see an import, not a literal.
- **D-06:** **walked → ran-through = the walk/run valley in the athlete's own covered-time speed
  distribution.** Covered time contains no gaps or unreliable segments, so the population is
  disjoint from what it judges (non-circular by construction); 32 D-13's insensitivity check still
  applies (re-derive with classified intervals' neighbourhoods removed / planted synthetics added,
  1% tolerance fixed before measuring, watched failing first on a deliberately circular strawman).
  Candidate statistic shapes are **pre-declared in the plan text before any measurement**, each
  with a written non-circularity argument; D-13 arbitrates in first-clearing order.
- **D-07:** **stationary → walked = the same drift constant STOP-02 measures.** One measurement of
  GPS drift-while-stationary defines "not moving" for both a stationary pause class and a
  forgotten stop — one artifact, one constant, no two definitions that can disagree.
- **D-08:** **No defensible value → HALT.** If the walk/run valley or the drift floor fails D-13
  under every pre-declared shape, the plan commits a NO-VALUE artifact and stops for the developer
  (the 33-08 / 33-14 / 33 D-16 pattern). Nothing is widened, loosened or hand-picked on executor
  judgement. The class distribution archive-wide is a reported finding and may never select or
  re-order a shape (Phase 27 D-02 anti-quota).

### Forgotten stops

Measured during this discussion (crude, pair-level, uncalibrated): near-zero stretches inside
covered time are rare — <0.3 m/s ≥30 s in 35 activities (5 at ≥120 s); <0.8 m/s ≥30 s in 76 (8 at
≥120 s). Zero-advance `pause` intervals number 663 (36 ≥30 s).

- **D-09:** **The flag covers timer-running standstills from two sources, itemised by source:**
  creeping near-zero stretches inside covered time (drift keeps `d` advancing slightly, so the
  zero-advance pause rule misses them) **and** the existing zero-advance `pause` intervals. Total
  seconds, longest stretch and count are reported per source and combined. Recording gaps are
  excluded (auto-pause or signal loss — the timer was not running). Needs a **dated wording
  amendment** to STOP-01 (and ROADMAP criterion 4) from "inside recorded (covered) time" to
  "inside recorded, timer-running time", since `pause` intervals are not covered time. Still flag
  only: nothing is removed from moving time, pace or best efforts, and covered-creep stretches are
  NOT clipped from the pace chart.
- **D-10:** **Blind-spot streams are `not-computable` with a stated reason.** Where a standstill is
  structurally invisible — distance-triggered recording (e.g. 3475740390, ~10 m/sample) writes no
  samples while stationary, so a stop becomes a recording gap — the flag is not-computable rather
  than "none". Research determines how to recognise such streams from `t`/`d` alone (no device-
  family relabelling — 32 D-03's t/d-purity reasoning). A clean result must always mean "looked and
  found none".
- **D-11:** **Untiered fact, like `deviceEra` / `elapsedVsMoving`.** Total seconds, longest stretch,
  count — no none/minor/severe cut, so no extra constant, never a list-row badge, and structurally
  outside `hasAnySevereSignal` (STOP-03). Still add the never-widen guard assertion (the 33 D-06 /
  30 D-06 precedent: temporarily widen, watch the guard fail, revert) so a future edit cannot
  quietly pull it in.
- **D-12:** **Walking-break negative control: research proposes, developer confirms.** Research
  finds 2–3 real activities with sustained covered walking (~1.2–1.8 m/s) and presents them; the
  developer confirms at least one genuinely was a walking break before it is pinned. The
  discriminator gets a stated CAN FAIL / CAN PASS reachability proof in both directions (a walk
  that the chosen threshold would actually flag if it were set too high). Real IDs only.
- **D-13:** The near-zero threshold and minimum duration are calibrated under the same D-06/D-08
  rules (pre-declared shapes, D-13 insensitivity, HALT on failure). If drift is measured not to
  matter, the artifact records it as a measured non-issue (STOP-02's own wording).

### Detail-view disclosure

- **D-14:** **A new Pauses section plus a one-line summary row in Quality Signals.** The section
  lists one row per interval: position (elapsed time and km), class, duration, distance.
  Forgotten-stop creep stretches appear in the same list, marked as such. The Quality Signals row
  summarises counts per class and the forgotten-stop totals. The list is fed from the lazy quality
  shard (after first paint); the summary from the index row.
- **D-15:** **List membership = everything off the clock, jumps excluded.** Recording gaps,
  gap-adjacent merged segments and zero-advance pauses, each with its class; covered-creep stops
  marked. Isolated-jump and hidden-pause segments stay in the Unreliable Segments row (D-01 —
  not-classifiable). Capped at 100 entries like `impossibleSamples` / the unreliable-segment list.
- **D-16:** **No pace-chart change.** Phase 33's clipping stays exactly as closed on its
  checkpoint; no class tinting.
- **D-17:** **Detail view only — no list-row badge, no filter.** A transported pause surfaces
  outside the detail view only via Phase 37's review-queue ordering. The index-row summary key
  exists so Phase 37 can read it without a shard fetch — additive, `DASHBOARD_INDEX_SCHEMA_VERSION`
  stays `1`.

### Evidence and process (carried conventions, restated for the planner)

- **D-18:** **Checkpoint rows assert independently-derived values.** Criterion 1's per-segment
  class table for 3475724402 is produced by a committed script that never imports the classifier
  or the detector (gap-first recount, the 32 D-15 / `compute-unreliable-segment-recount.mjs`
  pattern, fails closed, shown failing against a deliberately broken classifier first), and the
  browser row reads the rendered classes back against it. The probe's 2.31–4.06 m/s figures and the
  scoping "~1.9 m/s" are references only.

### Family G re-declared after HALT-1 (added 2026-09-22)

- **D-19 (2026-09-22):** **Family G is re-declared; the planted perturbation becomes proportional;
  HALT-1's vacuous planted rows are fixed. Everything else in D-06/D-07/D-08/D-12/D-13 stands.**
  - *What happened.* Plan 34-06's first real-archive run (record: `34-06-HALT-1.md`, artifact at
    commit `00c02bda`) HALTED under D-08. The circular strawman failed as required, then every
    pre-declared Family G shape (G1/G2/G3) failed D-13 insensitivity at the fixed 1% tolerance.
    Families M and W never ran (upstream HALT). Nothing shipped.
  - *Why the misses were secondary.* All three G bases came out at walking/jogging speeds, not
    stationary-drift speeds. Each would have classified at least one of the three
    developer-confirmed walking breaks (`34-WALKING-BREAK-CONTROL.md`) as stationary, so the D-12
    anchor gate would have failed even at a wider tolerance. Likely causes: cadence 0 is often a
    sensor dropout while running (G1/G2's own caveat), and G3's population mixes deceleration and
    acceleration pairs.
  - *Developer decision (2026-09-22).* Option 1 of the HALT-1 write-up: re-plan Family G with NEW
    pre-declared shapes that measure stationary GPS drift directly. Option 3 (widen the 1%
    tolerance) is **REJECTED**; the tolerance stays 1%, fixed. Option 2 (investigate G3 first) was
    not chosen. G1/G2/G3 are retired, and plan 34-12 re-declares Family G as "standstill episodes"
    (drift across chained zero-advance pauses), pooled (G4) and per activity (G5).
  - *Planted rule change (developer-authorised, 2026-09-22).* The D-13 planted perturbation used
    to plant exactly |J| items (the number of judged gap-bearing intervals archive-wide) into every
    population. It now plants `ceil(INSENSITIVITY_TOLERANCE × N)` items, where N is the shape's own
    base population size in its own unit. The rule is **uniform across G, M and W**. The
    justification rests on counting alone, not on any measured value. Under the old rule, once the
    plants outnumber a population's real items, any quantile's rank lands inside the plants. So a
    population much smaller than |J| can never pass, whatever its statistic. An unpassable check
    proves nothing about circularity, and speed-free-identified standstills are far fewer than
    |J| on this archive. The fraction equals the tolerance, so the check asks "does a 1% leak of
    judged-like items move the statistic by more than 1%?" No new free number is introduced. M and
    W's planted rule changed too. Neither family has ever been measured, so the direction of the
    change for them is unknown and was not chosen by looking. The removed perturbation, the 1%
    tolerance, strawman-first, first-clearing arbitration, the D-12 anchor gate, D-07's single
    shared constant and HALT-on-failure are all unchanged.
  - *HALT-1's vacuous planted rows.* Plants were placed at span `[0, seconds]` and pushed only into
    covered pairs, folded steps and advance intervals. So they never entered G3's
    position-filtered population or strawman G's J population: both planted rows had a planted
    count equal to their base count and tested nothing. The fix is that every plant enters the
    population its shape reads, unconditionally, and a test asserts `planted items = base items +
    plants entered` for every shape and strawman. The test is watched RED against the HALT-1
    code on a synthetic fixture that actually contains pauses.
  - *Contamination guard.* HALT-1's measured values, including G3's removed-view median, are known
    and must never be pinned as an expected value, success criterion or fixture target anywhere.
    The re-declared shapes are argued from first principles. Plan 34-12 states where its population
    overlaps G3's and why it is not "G3 with the neighbourhood removed".

### Stationary constant declared after HALT-2 (added 2026-09-22)

- **D-20 (2026-09-22):** **Drift-while-stationary is a MEASURED NON-ISSUE on this archive, and
  `STATIONARY_MAX_SPEED_MPS` is DEVELOPER-DECLARED at 0.5 m/s. This narrows D-08 for this ONE
  constant only. Families M and W stay fully calibrated under D-06/D-08/D-13.**
  - *What happened.* Plan 34-06's second run (record: `34-06-HALT-2.md`, artifact at commit
    `a740a65b`) HALTED again. Plan 34-12's fixes worked: proportional planting was non-vacuous on
    every row (`planted items = base items + plants`, verified on the result object). But the
    re-declared Family G population was almost empty. Archive-wide there are 684 standstill
    episodes, of which only 6 are chained (0.877%) and 678 are single unbridged zero-advance
    pauses. G4 and G5 both measured base 0.029873 m/s over n=6 and failed both axes (removed
    89.75%, dropping 2 of 6; planted 3902% / 1562% at the mandatory minimum of 1 plant). D-10 and
    join both PASS. M and W never ran.
  - *The D-12 anchor was not the blocker.* The three developer-confirmed walking breaks run at
    1.26–1.80 m/s, which is 42–60x the measured value. The blocker was D-13 insensitivity on a
    population of 6.
  - *The finding.* This archive's devices do not accrue meaningful distance while stationary.
    Across 684 standstills, 678 record exactly zero advance and the 6 that accrue anything
    accrued 2.70 m in total. STOP-02's own text anticipates this outcome: "otherwise drift is
    recorded as a measured non-issue". That disposition, with the figures above and the G4/G5
    rows kept as the evidence that produced it, is what satisfies STOP-02's "the artifact measures
    how much drift exists". A shipped calibrated cut is not required for it.
  - *Structural caveat, recorded so the finding is not overstated.* A single-pause standstill has
    zero advance BY CONSTRUCTION: the pause rule only marks zero-advance runs. So "678 of 684
    record exactly zero" is partly definitional. The measured, non-definitional part is that
    drift almost never breaks a standstill into a chain (6 of 684), and that the chained six
    accrued 2.70 m in total. The declared constant below does not rest on the definitional part.
  - *Developer decision (2026-09-22).* `STATIONARY_MAX_SPEED_MPS` is declared, not calibrated:

DECLARED STATIONARY_MAX_SPEED_MPS = 0.5

    That is 0.5 m/s, 1.8 km/h. It is chosen on physical grounds: far above the measured drift
    (~0.03 m/s) and far below the slowest developer-confirmed walking control (1.264 m/s). It is
    NOT derived from any measured Phase 34 figure, and it must never be presented as calibrated.
    Every artifact, docblock and summary naming it says "developer-declared (D-20)".
  - *What this narrows.*
    - **D-08**, for this constant only. D-08's "no defensible value → HALT" assumed a measurable
      population. Here the population is measured to be degenerate, so a declaration is the honest
      outcome rather than a third re-declaration. This narrowing does not extend to any other
      constant, this phase or later.
    - **D-07**, in provenance only. The same 0.5 m/s still serves both the stationary/walked class
      boundary and STOP-02's near-zero threshold, so there is still exactly ONE constant with one
      definition. Only its origin changes, from derived to declared.
  - *What is unchanged.* Family M (minimum duration) and Family W (walk/run boundary) are still
    calibrated under D-06, D-08 and D-13 with the pre-declared shapes, the fixed 1% tolerance,
    strawman-first and first-clearing arbitration. Either may still HALT, and a HALT there is still
    a developer decision. The D-12 anchor gate and the walking-break control tests still run
    against the declared value, unchanged. So does the D-10 rule, the order gate and join
    exhaustiveness.
  - *No independent literal.* The declared value lives in exactly one place per layer, and the
    layers are bound by tests: 34-CONTEXT.md's `DECLARED STATIONARY_MAX_SPEED_MPS` line above, the
    generator's declared constant, the artifact's `## Chosen constants` line (with its provenance
    line beside it), and production's literal in `pause-classification.ts`. Production still
    parses the artifact, as 33-14's ship-from-artifact precedent requires. Plan 34-13 adds the
    test that the value cannot drift silently between those layers.
  - *Evidence retained.* Family G still measures and renders G4/G5 and strawman G, now as evidence
    for the non-issue finding rather than as arbitration. Nothing is deleted to make the
    declaration look cleaner.

### Walk/run boundary declared, and the forest-run flag accepted, after HALT-3 (added 2026-09-22)

- **D-21 (2026-09-22):** **`WALK_RUN_BOUNDARY_MPS` is DEVELOPER-DECLARED at 2.2 m/s, on the same
  footing as D-20's 0.5; and the forgotten-stop flag on the third walking control is ACCEPTED as
  honest.** This narrows D-06 and D-08 for this ONE constant only. Family M stays fully
  calibrated.
  - *What happened.* Plan 34-06's third run (record: `34-06-HALT-3.md`, artifact at commit
    `bc77e8e0`) cleared every family for the first time, then failed a post-selection gate.
    Family M selected M1 at 40.0 s (removed 0.0000%, planted 0.0000%, n=1873, plants=26276), with
    M2 at 30.0 s also passing. Family W selected W1 at 6.95 m/s, with W2 at 6.85 m/s, both at
    0.0000% on each axis over n=2,612,365 folded steps. All three strawmen FAILED correctly and no
    row was vacuous. Family G rendered evidence-only per D-20, and the d20-basis, order,
    d12-anchor-i, d12-anchor-iii, d10-rule and join gates all PASSED.
  - *The gate that failed.* **d12-anchor-ii**: the first confirmed walking control's
    rest-of-activity speed, 2.8257 m/s, must exceed the shipped boundary, and 6.95 m/s does not
    let it. The all-or-none exit contract shipped nothing.
  - *Why the valley rule found 6.95.* W1's population is UNIMODAL. A single hump peaks at
    3.0–3.1 m/s over 2.6M seconds and there is no dip anywhere near the confirmed walks
    (1.26–1.80 m/s), where the histogram instead rises smoothly. The global-minimum-qualifying-bin
    rule therefore landed in a sparse tail bin, 6.90–7.00 m/s holding 309 of 2.6M seconds, close
    to the 7.35 m/s ceiling. The artifact's own per-interval table for 3475724402 corroborates it:
    all 18 rows classified `walked` and none `ran-through`, contradicting D-02's expectation.
  - *The finding.* D-06's premise — that this athlete's covered-time speed distribution contains a
    walk/run valley — does not hold for this archive. Walking and running form one continuous
    hump. There is no valley to calibrate, so no shape over this population can produce one. The
    measured evidence stays rendered in the artifact: the histogram finding, W1's and W2's rows,
    and the 3475724402 table that showed the consequence.
  - *Developer decision (2026-09-22).* `WALK_RUN_BOUNDARY_MPS` is declared, not calibrated:

DECLARED WALK_RUN_BOUNDARY_MPS = 2.2

    That is 2.2 m/s, 7:35/km. It sits between the developer-confirmed walking controls
    (1.26–1.80 m/s) and the measured running hump (3.0–3.1 m/s). It is NOT derived from any
    measured Phase 34 figure, and must never be presented as calibrated. Every artifact, docblock
    and summary naming it says "developer-declared (D-21)".
  - *What this narrows.* **D-06**, whose "walk/run valley in the athlete's own covered-time speed
    distribution" premise is measured not to hold here, and **D-08**, for this constant only,
    exactly as D-20 did for the stationary bound. The narrowing extends to no other constant, this
    phase or later. **Family M stays fully calibrated** under D-06/D-08/D-13: M1 at 40 s is
    expected to re-select on the fourth run, but it must still be SELECTED by arbitration and may
    never be hardcoded.
  - *Disclosed consequence, not a gate.* At 2.2 m/s every one of 3475724402's merged intervals
    (2.307–4.065 m/s) classifies `ran-through` rather than splitting. D-02 expected a split, and
    ROADMAP criterion 1 already states the criterion is per-segment agreement with the independent
    table and never a pinned class, so nothing fails. It is recorded here so the fourth run's
    findings are read with it in mind.
  - *Basis gate.* Like D-20's, the declaration is checked against live evidence on every future
    run, by two structural comparisons that introduce no new number: the declared boundary must be
    strictly greater than every confirmed control's own window aggregate speed, and strictly less
    than the modal bin of the covered-time histogram the W shapes already build. A failure HALTs
    for a developer revisit and is never retuned.

  **Second decision: the forest-run flag is accepted as honest.**
  - *What was measured.* At the candidate params (0.5 m/s, 40 s), `classifyForgottenStop` was run
    against all three confirmed controls. 6286234101 and 3475733231 do not flag. 3475715143 flags
    a 42 s stretch at t=1708–1750 measuring exactly 0.5 m/s, at the declared bound itself.
  - *Decision.* The developer declined to lower 0.5 to avoid it. The flag marks timer-running
    STANDSTILLS, and a genuine standstill inside a walking break is flagged honestly. What must
    not happen is a walking break flagged FOR ITS WALKING PACE.
  - *Consequence.* STOP-02 and ROADMAP criterion 4's "walking breaks are shown not to be flagged"
    get dated in-place amendments recording this reading and the measured evidence for all three
    controls. The control test asserts the property, not the number: no control is flagged for
    walking pace, meaning every flagged stretch on a control sits at or below the stationary
    bound; control 3's standstill is an accepted, disclosed flag whose measured seconds and speed
    are reported as findings, never pinned as expected values. D-12's own gate on the first
    control is NOT weakened.

### Covered-creep merge semantics, after the 34-11 checkpoint (added 2026-09-23)

- **D-22 (2026-09-23):** **A covered-creep stretch is the MAXIMAL UNION of overlapping qualifying
  windows, reported once, with the union's own seconds and metres. The union's own aggregate speed
  is a disclosed property, not a guarantee.**
  - *What happened.* Plan 34-11's browser checkpoint passed all nine rows but exposed a STOP-01
    defect. On 6286234101 production emitted two OVERLAPPING covered-creep stretches — 5866–5915
    (49 s, 21.7 m) and 5877–5922 (45 s, 19.7 m) — overlapping on [5877, 5915], so 38 s was counted
    twice. The index row read `count 3, totalSec 171, longestSec 77` where the union truth is
    `count 2, totalSec 133, longestSec 77`, and the detail view rendered both rows to the reader.
    STOP-01's amended text is specifically about per-source count, total seconds and longest
    stretch, so the shipped numbers were wrong.
  - *How it survived.* Every in-repo test agreed with itself; the independent zero-import scan
    (`compute-walking-break-evidence.mjs --scan`) disagreed. This is the project's
    "guards must assert against an independent value" lesson, repeated.
  - *Why the two tools disagreed.* They encode different rules, and neither was written down as
    the requirement. `localCreepWindows` (the scan) unions qualifying windows by index overlap and
    never re-checks the union. `findCreepStretches` (production, after plan 34-06's own
    merge-boundary fix) refuses to merge when the union's aggregate would exceed the bound — and
    then emitted the unmerged window anyway, overlapping the previous one. The first fix addressed
    stretches whose union exceeded the bound; it did not address stretches that overlap at
    different start offsets, and its chosen resolution created the double count.
  - *Decision: union semantics (the scan's), stated once and for all.*
    - Two qualifying windows that SHARE at least one sample index (overlapping, or one contained
      in the other) merge into a single stretch spanning `[min start, max end]`.
    - Sharing only the boundary sample counts as overlap and merges: one window ending at sample
      k and the next starting at sample k are one stretch.
    - Two qualifying windows that share NO sample index stay separate, however close in time.
      Adjacency alone never merges, because the samples between them are not covered by any
      qualifying window and the time would otherwise be reported as standstill without evidence.
    - Each reported stretch carries the union's own `seconds` and `metres`, so per-source count,
      total seconds and longest stretch are a partition of time with no double counting — which is
      what STOP-01 asks for.
    - Every CONSTITUENT window satisfies `metres / seconds <= stationaryMaxMps`. The UNION's own
      aggregate may exceed it, because a union of individually-bounded windows is not itself
      bounded. On 6286234101 the union runs at roughly 0.64 m/s against a 0.5 m/s bound.
  - *What this retires.* Plan 34-06's stronger claim — that every RETURNED stretch's own
    metres/seconds stays within `maxSpeedMps` — is retired, along with the "definitional tripwire"
    reading of the walking-break control test and the same clause in STOP-02 and ROADMAP criterion
    4 (both amended 2026-09-23). The honest property is the constituent one above, and the union's
    aggregate speed is disclosed rather than asserted.
  - *What is unchanged.* The flag still marks timer-running standstills and still never corrects
    anything (D-09, D-11). The independent primary assertion from D-21 still holds and still
    binds: every flagged stretch on a confirmed walking control sits strictly BELOW that control's
    own window aggregate speed, parsed rather than pinned — 0.64 m/s against 1.264 m/s on this
    activity. The D-12 anchor gate is untouched: both of 6286234101's creep windows lie outside
    the gated control window, before and after this fix.
  - *Scope of the oracle.* The scan is an independent oracle, not a second implementation of the
    same rule: it scans the whole stream under its own local-gap rule, while production is
    restricted to covered runs. The two are expected to agree on activities where coverage does
    not intervene, and any archive-wide disagreement is a finding to explain in the plan's summary,
    never something to tune away.
  - *Disclosure gap fixed at the same time.* The Quality Signals Pauses summary row omitted
    `pauseClassification.notClassifiableCount`, so 3475740390 read "5 intervals: 0 stationary, 5
    walked, 0 ran through, 0 transported" beside an undisclosed 5 not-classifiable isolated-jump
    segments. The Pauses SECTION correctly omits the jumps (D-01, human-verified at the
    checkpoint); the summary row must SAY they are not-classifiable rather than leaving them out,
    since "not-classifiable" is not "none" (D-01, and D-10's own reasoning for not-computable).

### Claude's Discretion

- Field names and shapes for the index summary key and the shard's per-interval list (additive
  only).
- The artifact filename(s) and generator/recount script names, following `32-CALIBRATION.md` /
  `33-CALIBRATION.md` and `compute-*-calibration.mjs` / `compute-*-recount.mjs`. Whether the band
  calibration, drift calibration and PAUSE-03 re-measurement share one artifact or three.
- The Pauses section's exact copy, column order, empty state, and whether the class label carries a
  short explanation.
- How the not-computable blind-spot rule (D-10) is expressed, subject to t/d purity.
- Where the classifier module lives (its own leaf vs inside `pace-quality.ts`), subject to the
  single-source audit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` § Phase 34 — goal and four success criteria. **Criterion 1 / goal gain
  `ran-through` (D-02) and criterion 4's "covered time" is widened (D-09); read with those
  amendments once made.**
- `.planning/REQUIREMENTS.md` — PAUSE-01..03, STOP-01..03, STOP-04 (Out of Scope), the standing
  conventions paragraph, and SEG-05b's row (Phase 34 records its half, D-01).
- `.planning/PROJECT.md` § Current Milestone: v2.3 — the three named activities' scoping facts and
  "Forgotten stops are flagged, never corrected".
- `.planning/milestones/v2.2-REQUIREMENTS.md:165` — the "9 activities … all at ≤14 km/h" figure
  PAUSE-03 supersedes (D-04).

### Decisions this phase inherits
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CONTEXT.md` — D-03 (no fourth
  mechanism), D-04 (one downstream treatment, withhold never correct), D-10 (structural constraints
  on constants), D-13 (insensitivity, watched failing first), D-15 (independent recount), D-16
  (figures of record over a live denominator).
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` —
  `UNRELIABLE_SPEED_LIMIT_MPS = 7.35` derivation (D-05 reuses it) and the non-circularity shape.
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CONTEXT.md` — D-01
  (merged segment = one `unreliable` interval), D-06 (never-widen composite guard), D-08 (row
  scalars + shard list, capped 100), D-13 (checkpoint rows vs independent extent), D-15 (SEG-05b
  per-phase, load-bearing proof), D-16 (non-self-referential population; HALT on no shape).
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-CALIBRATION.md` and
  `33-COVERAGE-IDENTITY.md` — artifact shape; 33-08's failed-percentile table as the negative
  example D-06/D-08 guard against.
- `.planning/research/FEATURES.md` (§ GAP classification requires the merged segment),
  `.planning/research/PITFALLS.md` (4, 5, 11, 12, 13), `.planning/research/ARCHITECTURE.md`.
- `.planning/RETROSPECTIVE.md` — vacuous checks, unsatisfiable rows, recounts.

### Code this phase reads or changes
- `src/analytics/pace-derivation.ts` — `classifyGaps` / `classifyGapsWithSegments` (returns merged
  `gapIntervals` and raw `segments`), `GapKind`, `GapInterval`, `PAUSE_GAP_P90_MULTIPLIER`,
  `RECORDING_GAP_ABS_THRESHOLD_SEC`, `advanceIntervals`, `quantile` (R-7 — reuse, no third
  percentile).
- `src/analytics/unreliable-segments.ts` — `UNRELIABLE_SPEED_LIMIT_MPS`, `UnreliableSegment`,
  mechanism labels (D-01 uses them to separate gap-bearing from not-classifiable).
- `src/analytics/pace-quality.ts` — `ActivityQualitySignals`, `elapsedVsMovingSignal` / `deviceEra`
  (the untiered-fact template for D-11), `hasAnySevereSignal` (never widened), `PaceQualityShard`,
  `buildPaceQualityShard`, `projectUnreliableSegments` (cap-100 projection template).
- `src/dashboard/views/detail-sections.ts` — `qualitySignalsSectionPlan` (row list; add the summary
  row with the CR-01 missing-key fallback pattern), `elapsedVsMovingRow`, `buildSplitsSection`
  (section-builder template for the new Pauses section).
- `src/dashboard/views/detail.ts` — section mounting order and shard arrival.
- `src/analytics/dashboard-index.types.ts`, `src/analytics/compute-dashboard-index.ts`,
  `src/dashboard/data/pace-quality-client.ts` — index key and shard read/write ends.
- `src/analytics/pace-single-source.test.ts` — audit; D-05's import-not-literal.
- `scripts/compute-unreliable-segment-recount.mjs`, `scripts/compute-unreliable-segment-calibration.mjs`,
  `scripts/compute-unreliable-segment-severity-calibration.mjs` (+ `.test.mjs`) — generator and
  recount patterns; `scripts/compute-stream-checksums.mjs` — `data/streams/` immutability gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyGapsWithSegments` already returns merged `gapIntervals` with kind and real
  `startSec`/`endSec` plus the detector's segments with mechanism — the classifier needs only
  metres per interval and a mechanism lookup, no new detection.
- `elapsedVsMovingSignal` / `deviceEra` — untiered-fact signal shape and row renderers (D-11).
- `projectUnreliableSegments` — the capped shard projection to mirror for the pause list (D-15).
- `quantile` (R-7) — the percentile definition for any band statistic.

### Established Patterns
- `pause` GapKind = zero-advance run longer than 5× the activity's p90 advance interval; `recording
  gap` = `dt > 10 s`. Covered time excludes both. Creep stops therefore live only in covered time.
- Missing-key fallback (CR-01) in `qualitySignalsSectionPlan` for stale `index.json` — needed for
  the new summary key.
- Every calibration generator has a `.test.mjs`, is run twice for idempotence, and its prose is
  generated.
- Guards are watched failing on a planted violation before they may pass.

### Integration Points
- The index row summary (Phase 37 reads it for queue priority) and the shard list (detail view).
- `npm test` is the nightly deploy gate: nothing may read gitignored or owner-editable live files.
- `data/streams/` stays byte-identical (checksum gate).

</code_context>

<specifics>
## Specific Ideas

- Named fixtures: **3475724402** (criterion 1 — 18 merged intervals, expected to split between
  walked and ran-through per D-06's valley, never pinned to one class; the 98 s gap near t=2963 is
  the ran-through case criterion 1 names); **3475740390** (distance-triggered — D-10's not-computable
  case for the stop flag); the developer-confirmed walking-break activity (D-12).
- Three documents need recorded, dated amendments: REQUIREMENTS PAUSE-01 + ROADMAP Phase 34 goal/
  criterion 1 (`ran-through`, D-02); REQUIREMENTS STOP-01 + ROADMAP criterion 4 (timer-running
  scope, D-09); `milestones/v2.2-REQUIREMENTS.md:165` forward pointer (D-04). ROADMAP/STATE
  mutations via `gsd-sdk query` handlers where one exists.
- The discussion's probe numbers are references to reconcile against, never expected values —
  audit every figure a plan quotes (scoping-probe-figures-get-pinned lesson).
- Planner: list the D-NN ids in each plan's frontmatter `must_haves.decisions`.
- Merge origin at least once during the phase and regenerate artifacts after the merge.
- Closes on a human browser checkpoint against a digest-verified served build; hard-reload after
  every fixture edit.

</specifics>

<deferred>
## Deferred Ideas

- Tinting clipped pace-chart bands by pause class — a visual idea for a later phase (D-16).
- A list-row badge or filter for transported pauses — not in this milestone beyond Phase 37's
  queue ordering (D-17).
- A tiered forgotten-stop signal — revisit only if the untiered fact proves unreadable (D-11).
- "Stopped time removed" pace — STOP-04, already Out of Scope pending STOP-02's calibration.

### Reviewed Todos (not folded)
- "Pace chart y-axis compressed by pre-pause run-in samples (3475734189, 68–93 min/km at
  t=208–219)" (`.planning/todos/pending/2026-09-22-pace-chart-y-axis-compressed-by-pre-pause-run-in-samples.md`)
  — matched at 0.6 on keywords; a chart-scaling concern no PAUSE/STOP requirement covers. Kept
  deferred by the developer. Note: D-09's covered-creep stops are the same shape of sample, so
  Phase 34's stop list may help locate such run-ins, but it does not change the chart.
- "Garmin export adapter when export arrives" — score 0.2 on "provenance" only; unrelated and still
  externally blocked (STREAM-04).

</deferred>

---

*Phase: 34-Pause Classification & Forgotten-Stop*
*Context gathered: 2026-09-22*
