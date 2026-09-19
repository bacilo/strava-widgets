# Phase 32: Unreliable-Segment Detection & Calibration - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

One compute-only detector, `src/analytics/unreliable-segments.ts`, that identifies unreliable
segments from the committed `t`/`d` channels alone — judging maximal advancing *runs* by aggregate
implied speed, merging a burst with a gap it touches into one segment that conserves real distance
and real elapsed time, and recording which mechanism (gap-adjacent / hidden-pause / isolated-jump)
produced each segment — plus a committed, regenerable, idempotent calibration artifact of record,
and the single-source audit extended to the detector.

**Not in this phase:** wiring into `classifyGaps` / a fourth `GapKind` / coverage identity (Phase
33), the quality signal and badge (SEG-06, Phase 33), pause classification (34), running pace (35),
best-effort partitioning and the ceiling diff (36), queue priority (37). No rendered surface, so no
human browser checkpoint — the phase closes on its calibration artifact, its independent recount
and its guards being watched failing.

Requirements: SEG-01, SEG-02, SEG-03, SEG-04, and SEG-05**a** (see D-14 — SEG-05 is split).

</domain>

<decisions>
## Implementation Decisions

### The Suunto over-measurement sample vs the isolated jumps

Measured during this discussion on the committed streams (per-sample, uncalibrated): the five
isolated jumps on 3475740390 run at **10.0, 10.5, 14.3, 10.1 and 12.3 m/s** (30.1 m/3 s at t=2347,
52.4 m/5 s at t=2508, 28.6 m/2 s at t=2536, 30.4 m/3 s at t=2580, 24.7 m/2 s at t=2587). All five
sit BELOW the Suunto descent's 17 m/s. No speed rule can flag all five (ROADMAP criterion 3) and
spare a 17 m/s sample.

- **D-01:** **ROADMAP criterion 4 / SEG-04 wins over `research/PITFALLS.md` Pitfall 2.** If the
  run-level rule fires on the Suunto sample, it IS a segment. Pitfall 2's "the Suunto 17 m/s descent
  must stay *unflagged*" (and `research/SUMMARY.md`'s echo of it under Phase 32 "Delivers") is
  **superseded**, reason: the 10.0–14.3 m/s measurement above. Downstream agents must not pin the
  Suunto sample as a must-not-fire fixture.
- **D-02:** **The Suunto activity must first be identified and measured on the COMMITTED stream.**
  No planning document records its activity ID — it exists only as prose in
  `milestones/v2.2-REQUIREMENTS.md:161` ("17 m/s over one second on a descent where GPS geometry
  says 0 m … position exists in only 51.3% of that file's records"), observed in a 1 Hz FIT
  original. How it presents after decimation in `data/streams/` is unmeasured; it may be diluted.
  Research finds the ID and reports the committed-stream shape before anything is pinned to it.
  The artifact states the outcome (detected / not detected, with numbers) either way.
- **D-03:** **No fourth mechanism enum member.** From `t`/`d` alone an over-measurement and an
  isolated GPS jump are indistinguishable, so the detector labels what it can observe — a no-gap
  run is `isolated-jump` (or `hidden-pause` per D-08). The "own mechanism label" SEG-04 asks for is
  satisfied by a **disclosed note in the calibration artifact** naming the Suunto activity and
  stating plainly that the detector cannot tell over-measurement from a jump. This needs a
  **recorded wording amendment** to ROADMAP criterion 4 and SEG-04 ("flagged under its own
  mechanism label" → disclosed in the artifact, never corrected). Rejected: device-family
  relabelling (breaks SEG-01's t/d-only purity, generalises from a sample of one) and a pinned
  activity-ID relabel list (hand-curated state, a second place a label can come from).
- **D-04:** **One downstream treatment for every segment.** Clipping pace (Phase 33) and barring a
  best-effort window (Phase 36) *withhold a claim*; they do not alter distance, totals or splits,
  which is what v2.2's "flagged, never corrected" protects. An over-measurement segment is treated
  exactly like a jump. Recorded here so Phases 33 and 36 do not re-litigate it or add a
  per-mechanism branch.
- **D-05:** **The negative control is the archive's fastest corroborated-genuine running, not the
  Suunto.** Research finds the fastest advancing runs that are corroborated as real (sustained over
  many seconds, HR/cadence consistent, no gap touching) and pins **2–3 named activity IDs** as
  permanent must-not-fire fixtures. The headroom between them and the slowest known jump (10.0 m/s)
  is reported in the artifact. Real IDs only — no synthetic look-alikes (standing convention).

### Mechanism boundaries

Measured during this discussion on 3475724402 (per-sample >7 m/s grouping, uncalibrated — it
reproduces the scoping probe exactly: 30 bursts, 18 gaps >10 s, 1,694 m in 106 s, 707 s of gap
time): **all 30 bursts share their boundary sample with a gap (0 s away) — 17 trailing a gap, 13
leading into one.** The gaps themselves carry a further **680 m**. Inter-gap spacings run as short
as 16, 16, 24, 26, 32, 34, 34 s. These are references to reconcile against, NOT expected values
(ROADMAP criterion 1's own rule).

- **D-06:** **Adjacency = touching only.** A burst is gap-adjacent only if its run begins or ends on
  the gap's own boundary sample, with no clean samples between. No tolerance constant exists to
  calibrate or defend. SEG-04's "adjacency rule calibrated against the archive" is discharged by the
  artifact sweeping the archive for **near-misses** (a burst within N s of a gap but not touching)
  and reporting the count as a finding that could reopen this decision.
- **D-07:** **Clean samples are never swallowed.** Segments chain into one ONLY when contiguous
  (burst–gap–burst–gap with nothing clean between). Gap A's trailing burst and gap B's leading burst
  separated by even a few clean samples are two segments. Clean recorded time is never reclassified
  as unreliable, so the conservation check is exact and Phase 33's coverage identity inherits no
  judgement call. Both sides of every gap are inspected (Pitfall 4) — and the leading-side fixture
  is 3475724402's own 13 leading bursts, not a synthetic.
- **D-08:** **Hidden-pause vs isolated-jump is split by metres carried**, not speed. A jump is
  GPS-error scale (25–52 m measured); a hidden pause carries real travelled distance (199 m
  measured). The boundary is calibrated from the archive's distribution of no-gap-segment metres.
  **If that distribution shows no clean valley, the artifact says so** and the label is recorded as
  a best-effort description, not a verified cause. Rejected: speed regime (clean on the two named
  activities, but 3475724402's real slews span 8.6–27.9 m/s — slews do not reliably sit at the
  ~29.5 m/s cap).
- **D-09:** **A calibrated excess-metres significance floor.** A run is a segment only if it carries
  more than a measured minimum of distance beyond what the limit would allow in its elapsed time —
  so trivia like 3475734189's 8.5/8.8 m/s pair at t=1581–1583 (≈17 m in 2 s) does not clip pace and
  bar PR windows archive-wide. The floor is derived in the same artifact with its **own**
  non-circularity argument, and must still admit the smallest named jump (24.7 m in 2 s at t=2587
  on 3475740390).

### Calibration population and non-circularity

- **D-10:** **The speed-limit statistic is delegated to research and planning under hard
  constraints** (the Phase 28 D-01 shape). The constants that matter are *structural*:
  (a) set by the **bulk** of clean run-level speeds — a few hundred slews must be unable to move it;
  (b) never a tail percentile of the population it judges (Phase 28 measured that self-defeat);
  (c) never a round number or an intuition about human sprint speed;
  (d) flags every named burst on the three scoping activities and spares D-05's fixtures;
  (e) anti-quota — never moved to change a flagged count (Phase 27 D-02).
  Rejected: a multiple of the 400m personal ceiling (couples this detector to the ceiling Phase 36
  will itself move by excluding these segments — a cross-phase circularity); anchoring purely
  between named boundary cases (rests on a handful of activities, not the distribution — though the
  headroom each side is still reported per D-05).
- **D-11:** **One rule for every stream; disjointness from decimation is proven, not engineered.**
  No higher bar, run-length exemption or `not-computable` for severely-decimated streams. The
  artifact must SHOW the flagged population does not track Phase 27's decimation-severe cohort —
  overlap measured, reported and explained. If it tracks it, that is a calibration failure fixed in
  the rule itself, not by exempting streams. (The generic `validateStreamSeries` not-ok →
  empty/zeroed result contract still applies; this decision is about decimation only.)
- **D-12:** **1 Hz FIT originals: validation only, never derivation.** Every constant is derived
  from committed `t`/`d` so CI and anyone without `export_data/` can regenerate the artifact of
  record. A separate **local-only** script under `scripts/` cross-checks a sample of detected
  segments against the 1 Hz originals (does the burst exist at 1 Hz? how does decimation change its
  measured speed and metres?) and commits its findings with dated provenance. That output is also
  the first evidence for the deferred STREAM-05 question and should say so. Nothing under
  `export_data/` is wired into CI or `npm test`.
- **D-13:** **Non-circularity is demonstrated as insensitivity, not argued in prose.** The artifact
  re-derives each constant (a) with the detected segments removed and (b) with a planted batch of
  synthetic slews added, and shows the constant does not move beyond a stated tolerance. A
  re-derivation that DOES move is a failed calibration. The check is **watched failing first** on a
  deliberately circular statistic (e.g. a tail percentile) before it is trusted. Applies to the
  speed limit, D-08's metres boundary and D-09's floor alike.

### Figures of record and evidence

- **D-14:** **SEG-05 is split.** Phase 32 closes **SEG-05a** — the single-source audit extended to
  the detector and shown catching a planted second implementation (in-suite planted block AND a
  one-off planted probe file against the real tree, per `pace-single-source.test.ts`'s precedent).
  **SEG-05b** — each consumer actually reads the detector — stays open and is ticked per consuming
  phase (33, 34/35, 36). This needs a **recorded REQUIREMENTS.md amendment** (split row +
  traceability table) and the matching ROADMAP note; an unsplittable row is a planning defect
  (Phase 25's R6 lesson). Phase 32 must NOT tick an unsplit SEG-05.
- **D-15:** **The independent per-segment table is a committed script that never imports the
  detector.** A standalone `.mjs` under `scripts/` reads raw `t`/`d`, is structurally asserted not
  to import `unreliable-segments.ts` (the `compute-elevation-recount.mjs` precedent), uses a
  deliberately **different algorithm** (gap-first: walk outward from each gap, rather than
  run-first) and emits the table for 3475724402. It is shown FAILING against a deliberately-broken
  detector before passing, fails closed on malformed input, and is regenerable — not hand-typed,
  because a frozen table goes stale the moment the calibrated limit moves which bursts qualify.
- **D-16:** **Headline = per-mechanism, in three units.** Activities, segments, and metres+seconds,
  each broken down by mechanism, over a **live** stream denominator (never a hard-coded 1,873 — and
  mind the `manifest.json`-counted-as-a-stream defect from Phase 27 G-01). No single number is "the"
  figure. The artifact carries a **reconciliation table** against the scoping probe's 259/1,873 and
  121/1,873, and against 30/18/1,694 m/106 s/707 s on 3475724402, attributing every difference to a
  named source (calibrated cut vs 7 m/s, the floor, run-level vs per-sample grouping, archive
  growth).
- **D-17:** **A `data/streams/` immutability gate lands in this phase** — a deliverable beyond the
  five ROADMAP criteria, taken from `research/SUMMARY.md`'s Phase 32 constraint. A committed
  manifest of sha256 per existing stream file; the test fails if any listed file's digest changes
  and **tolerates new files** (the nightly sync legitimately appends). Watched failing on a planted
  one-byte edit, then restored and `git status --porcelain data/streams` confirmed clean. No such
  gate exists today — byte-identity has been a by-hand check since v2.0.

### Claude's Discretion

- The exact statistic, multiplier and tolerance for the speed limit, the metres boundary and the
  excess-metres floor — bound by D-10 and D-13.
- The detector's exported types and output shape (segment fields, mechanism union, how burst vs gap
  portions are itemised), provided each segment carries start/end time, metres, seconds, mechanism,
  and enough itemisation for D-15's table to compare burst and gap contributions per side. Shape it
  so Phase 33 can fold it into `classifyGaps`' strict-priority tree and Phase 36 can partition on
  it, but wire neither.
- What "second implementation" means to the extended audit (banned literals / structural patterns),
  bound by the audit's two documented historical blind spots.
- How the near-miss sweep's N is chosen for D-06's finding (it is a reporting window, not a rule).
- The manifest's location/format for D-17 and how new stream files get appended to it.
- Artifact filename and script names, following `27-CALIBRATION.md` / `28-CEILING-CALIBRATION.md` /
  `30-CALIBRATION.md` and `compute-*-calibration.mjs` / `compute-*-recount.mjs`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` § Phase 32 — goal and the five success criteria. **Criterion 4's "flagged
  under its own mechanism label" is amended by D-03; read it with that amendment.**
- `.planning/REQUIREMENTS.md` — SEG-01..SEG-05 text, the standing conventions paragraph every
  requirement inherits, and Out of Scope. **SEG-05 is split by D-14; SEG-04's label wording is
  amended by D-03.**
- `.planning/PROJECT.md` § Current Milestone: v2.3 — measured scoping facts for the three
  activities and the decisions taken at scoping; § Key Decisions (last ~12 rows) for the
  measured-not-chosen, anti-quota and recount conventions.

### Milestone research
- `.planning/research/SUMMARY.md` — Phase 32 rationale, the stream-checksum constraint (→ D-17),
  research flags. Its "Suunto 17 m/s unflagged" line is superseded by D-01.
- `.planning/research/PITFALLS.md` — Pitfalls 1 (decimation aliasing → D-11), 2 (**superseded in
  part by D-01/D-05**), 3 (diluted slews → run-level scoring), 4 (both sides of a gap → D-07), 5
  (circularity → D-13), 11 (recount shares the classifier's blind spot → D-15), 12 (look-alike
  fixtures), 13 (artifacts reverting on regeneration), 15 (stream byte-identity → D-17).
- `.planning/research/ARCHITECTURE.md` — where `unreliable-segments.ts` sits, its single intended
  importer, and the shape Phases 33/36 expect from it.
- `.planning/research/STACK.md` — no new dependencies; the two deliberately distinct percentile
  implementations and why a third is rejected.

### Precedents to mirror
- `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CONTEXT.md` — D-01 (formula
  delegated under a structural non-circularity property; the measured percentile self-defeat), D-05.
- `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` and
  `.planning/milestones/v2.2-phases/30-elevation-quality-signal/30-CALIBRATION.md` — the shape of a
  regenerable, idempotent calibration artifact of record.
- `.planning/milestones/v2.2-REQUIREMENTS.md` line 161 — the only recorded description of the
  Suunto over-measurement sample (no activity ID; see D-02).
- `.planning/RETROSPECTIVE.md` — v2.1/v2.2 lessons on vacuous checks and recounts.

### Code the phase sits beside
- `src/analytics/pace-derivation.ts` — `classifyGaps`, `computeFlatRunDurations` (the maximal-run
  idiom to mirror), `advanceIntervals`, `quantile`, `RECORDING_GAP_ABS_THRESHOLD_SEC = 10`, the
  strict-priority / exact-sum identity contract the detector's output must later fit.
- `src/analytics/pace-single-source.test.ts` — the audit to extend; read its docblock on the two
  historical blind spots and the planted-violation proof pattern.
- `src/analytics/best-effort-utils.ts` — `validateStreamSeries`, the entry guard every stream
  function uses.
- `src/analytics/pace-quality.ts` — decimation signal (for D-11's overlap measurement) and the
  per-sample impossible-sample signal the new detector must not duplicate.
- `scripts/compute-elevation-recount.mjs`, `scripts/compute-pr-ceiling-recount.mjs` — the
  never-imports-the-classifier, fails-closed recount pattern for D-15.
- `scripts/compute-pace-quality-calibration.mjs`, `scripts/compute-pr-ceiling-calibration.mjs` —
  calibration generator pattern (and their `.test.mjs` siblings).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeFlatRunDurations` (`pace-derivation.ts:151`): maximal-run grouping over segments — the
  direct template for "maximal advancing run scored by aggregate Σd/Σt".
- `quantile` (R-7, `pace-derivation.ts:100`) and `percentileNearestRank` (`best-effort-ceiling.ts`):
  the two existing percentile definitions; pick one and cite it, do not add a third.
- `validateStreamSeries`: non-`ok` input returns a zeroed result, never throws.
- Stream files: `data/streams/{id}.json` with top-level `t` and `d` arrays (verified this session on
  all three scoping activities: n=909 / 2,388 / 1,834; median dt 4 s / 1 s / 2 s).

### Established Patterns
- Constants carry a docblock stating the measurement they came from and the rule forbidding tuning
  toward a count (`CEILING_K`, `IMPOSSIBLE_SAMPLE_SEVERE_COUNT`, `PAUSE_GAP_P90_MULTIPLIER`).
- Every calibration generator has a `.test.mjs`, is run twice to prove idempotence, and its prose is
  generated — a hand-edit to the artifact without fixing the generator silently reverts.
- Recount scripts never import the classifier and fail closed.
- Guards are demonstrated red on a planted violation before they may pass.

### Integration Points
- None wired this phase. The detector is a leaf module; its only future importer is
  `pace-derivation.ts` (Phase 33). The audit test must make a second importer/implementation fail.
- `npm test` (vitest) is the nightly deploy gate — D-17's gate and the audit extension run there, so
  neither may read gitignored or owner-editable live files (Phase 31 TD-01 lesson).

</code_context>

<specifics>
## Specific Ideas

- The discussion's own probes are throwaway and per-sample; their numbers are **references to
  reconcile against**, never expected values. The roadmapper-pins-probe-figures failure has already
  happened once on this milestone — audit every figure a plan quotes.
- 3475724402 supplies its own leading-side fixture (13 of 30 bursts lead a gap). Do not build a
  synthetic one.
- Three documents need recorded amendments as part of this phase's work, each with dated
  provenance: ROADMAP criterion 4 wording (D-03), REQUIREMENTS SEG-04 wording (D-03), REQUIREMENTS
  SEG-05 split + traceability (D-14). ROADMAP/STATE mutations go through `gsd-sdk query` handlers
  where one exists.
- Planner note: list these D-NN ids in each plan's frontmatter `must_haves.decisions` so the
  decision-coverage gate can see them.
- Merge origin at least once during the phase (MERGE-01), and regenerate the artifact after the
  merge — the archive moves under calibration artifacts.

</specifics>

<deferred>
## Deferred Ideas

- Whether the near-miss sweep (D-06) justifies a tolerance-based adjacency rule — revisit only if
  the measured count is material.
- A reliable over-measurement-vs-jump discriminator (would need lat/lng or the 1 Hz speed channel) —
  belongs with the STREAM-05 re-derivation revisit; D-12's validation output is its first evidence.

### Reviewed Todos (not folded)
- "Garmin export adapter when export arrives" (`2026-08-10-garmin-export-adapter-when-export-arrives.md`)
  — matched at score 0.2 on the keyword "2026" only; unrelated to this phase and still externally
  blocked (STREAM-04).

</deferred>

---

*Phase: 32-Unreliable-Segment Detection & Calibration*
*Context gathered: 2026-09-19*
