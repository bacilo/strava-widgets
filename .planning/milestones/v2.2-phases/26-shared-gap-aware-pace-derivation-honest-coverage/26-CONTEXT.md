# Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning

<domain>
## Phase Boundary

One gap-aware pace derivation module in `src/analytics/` becomes the single source of every
stream-derived pace figure the dashboard shows (chart, histogram, splits marking), coverage is
accounted exactly and disclosed on screen, a stratified fixture library is built for Phases 27-30
to compose, the residue adaptive windowing does not fix is quantified and handed to flagging, and
a metadata-vs-stream cross-check stops one activity from displaying a physically implausible pace
as fact.

`data/streams/` stays byte-identical — no re-derivation, no correction, no DEM lookup. Quality
badges (Phase 27), the PR plausibility ceiling (Phase 28), the curation review queue (Phase 29)
and elevation detection (Phase 30) are out of scope here; this phase builds the derivation and the
fixtures they all reuse.

Requirements: PACE-01..PACE-07, COV-01, COV-02, ERA-03 (10 total, all mapped to this phase in
`.planning/REQUIREMENTS.md`).

</domain>

<decisions>
## Implementation Decisions

### Windowing mechanism (PACE-03)

- **D-01:** Ship **adaptive time-based window width** — keep `derivePaceSeries`' centred
  real-time window with interpolated `d` at the window edges, but compute the width per-activity
  from that activity's own distance-advance-interval distribution rather than from the constant
  `PACE_SMOOTHING_WINDOW_SEC`. Chosen (delegated — see Claude’s Discretion below) because it is the mechanism the
  roadmap's measured recovery figures were actually produced with — 5059204779 at 94.81% → 1.22%
  fast mass and 30% → 97% coverage under a ~150s window — so Success Criteria 1 and 5 inherit
  those numbers instead of requiring every measured figure in PACE-03/04/06 to be re-derived. It
  is also the smallest change to code whose shape is already correct.
- **D-02:** The width statistic and multiplier are **not fixed here** — research picks them, bound
  by two constraints: (a) the choice is validated against all four measured interval profiles
  (medians 2s / 16s / 24s / 60s; activities 4556693525 / 3647739864 / 4598855187 / 5059204779),
  and (b) a fixed-20s implementation is **demonstrated failing first**, reproducing the 94.81%
  fast-mass / 30% coverage distortion on the 60s-median case, before the adaptive one is trusted.
  Per PACE-03 the mechanism and its justification are recorded against this archive's own evidence.
- **D-03:** If research finds advance-boundary integration (or a hybrid with a time floor) clearly
  superior on the measured profiles, it may override D-01 — but only by re-deriving PACE-03/04/06's
  figures under the new mechanism and recording the comparison. Silently substituting a mechanism
  while keeping the inherited numbers is not acceptable.

### Gap taxonomy and thresholds (PACE-02, COV-01)

- **D-04:** **Two independent signals, the pause one scale-relative** (delegated — see Claude’s Discretion below):
  - `recording-gap` — a jump in `t` with no samples across it. Absolute threshold. This is
    PROJECT.md's 1,233-activity cohort (a gap >10s).
  - `pause` — a distance-flat run long **relative to that activity's own advance interval**, not
    an absolute seconds value. This is PROJECT.md's 321-activity cohort (>5 min of ≥30s gaps).

  Measured basis: the two signals are genuinely distinct in this archive. Activity 5059204779 has
  **samples every 2s and a maximum time gap of 7s** — no recording gap whatsoever — yet
  **3,671 of its 3,788 elapsed seconds (97%) sit inside distance-flat runs** of median 58s,
  because its watch emits distance once a minute. The pinned exemplar 4556693525 shows the mirror
  case: flat runs of median 2s totalling 964/3,394s = **28%**, which is exactly the coverage the
  shipped histogram loses.
- **D-05 (hard constraint, and the discriminator any classifier must survive):** an absolute
  distance-flat threshold would classify ~97% of 5059204779 as paused. That is the fixed-window
  trap of PACE-03 reappearing one layer up, inside the gap classifier. The pause rule **must be
  demonstrated failing** under an absolute threshold (showing that ~97% misclassification) before
  the scale-relative one is trusted, and 5059204779 must classify with approximately zero pause
  time under the shipped rule.

### Coverage accounting and its denominator (COV-01)

- **D-06:** The coverage denominator is the **stream's own span, `t[n-1] - t[0]`** — not the
  activity metadata's `elapsed_time`.

  **This amends Roadmap Success Criterion 3, which names a field that does not exist.** Committed
  stream files carry `schemaVersion, id, source, distanceSource, sampleCount, channels, t, d,
  hr?, cadence?, alt?` and no `elapsed_time`. Stream span is self-contained (no cross-file read of
  `data/activities/`), is what the derivation actually integrates over, and makes "sums exactly"
  an integer identity rather than an approximate reconciliation. The two do differ — 4556693525 is
  3,394 (stream) vs 3,393 (metadata) — so that discrepancy becomes its own reported number rather
  than being quietly absorbed into a tolerance. The planner should carry this amendment into the
  phase's validation rows.
- **D-07:** `covered + Σ(excluded by named category) === t[n-1] - t[0]` exactly, asserted by test
  and watched failing against the real defect (the `dd <= 0` skip in `computePaceDistribution`)
  before being trusted — per COV-01's own wording.

### What the reader sees

- **D-08 (COV-02):** Coverage is disclosed by an **always-on caption with the category breakdown**
  under the `Pace Distribution` heading in `buildBreakdownSection` — e.g.
  `94% of elapsed time covered · 4% recording gaps · 2% paused`. Always-on, not
  threshold-conditional: COV-01's named categories become visible rather than internal-only, a
  healthy run visibly says so instead of the reader having to read silence as good news, and the
  browser checkpoint always has a number to read back against a hand-sum of the committed stream
  file (Criterion 3 requires exactly that read-back).
- **D-09 (PACE-05):** A split whose window crosses a gap is marked by an **inline marker on the
  affected split's pace cell plus a short legend under the table naming the measured amount** —
  e.g. `⚠ this km includes 2:14 of recording gap`. Chosen over a ninth column (the splits table
  already carries eight and Phase 22 spent real effort keeping it legible at phone widths) and
  over row-level restyling (which collides with Phase 19's shared table treatment). It reuses the
  footnote-asterisk pattern `detail-sections.ts` already uses for the 1k age-grade row. Stating
  the measured gap duration, not a bare flag, is what makes the split read as "paused mid-km"
  rather than "bad kilometre". Split arithmetic itself is **not changed** (PACE-05).

### Metadata-vs-stream cross-check (PACE-07)

- **D-10:** **Badge it, keep the metadata value.** A flagged activity still displays its
  metadata-derived pace (5059204779's 1:53/km) alongside a visible badge naming the disagreement
  and the stream-derived figure (5:51/km). Nothing is recomputed and nothing is silently
  substituted — this keeps PROJECT.md's "device `moving_time` stays the shipped aggregate"
  non-goal intact while making the disagreement impossible to miss.
- **D-11:** The badge appears on **both the detail view's Pace stat card and the Activities list
  row**. Rationale: sorting the Activities list by pace currently ranks 5059204779 as the
  fastest run in the archive, so a disputed pace must never appear unmarked on the surface where
  it ranks #1. This touches the shared `renderActivityRow` that Phase 20 made multi-surface-safe —
  the `idPrefix` pattern and all three surfaces (Activities, Overview Recent Activities, Overview
  Recent PRs) must be considered, not just the Activities list.
- **D-12:** Flagged activities are **not** removed from pace sort/filter results. Disclosure, not
  suppression — hiding a real activity from a filtered list has no precedent in this archive.
- **D-13:** For a flagged activity **only**, the splits table's `+/-` column diffs each split
  against the **stream-derived average** rather than the disputed metadata average. Today every
  real kilometre on 5059204779 reads ~4 minutes slow because `detail-sections.ts:82` diffs against
  the bogus 1:53/km. The differing baseline is disclosed in the same caption area as D-09's legend.
- **D-14:** The flag is persisted as an **additive field on the dashboard index row**, leaving
  `DASHBOARD_INDEX_SCHEMA_VERSION` at `1` — the precedent is stated in
  `dashboard-index.types.ts:17` for the `gearName` addition. Phase 27 asserts index additivity for
  its own five signals; Phase 26's single field must satisfy the same discipline so that assertion
  is not pre-broken.

### Module shape and the single-source audit (PACE-01)

- **D-15:** New module at **`src/analytics/pace-derivation.ts`** — pure and client-safe (no `fs`,
  no `fetch`, no DOM), mirroring the discipline `trimp.ts` documents in its own header. It is
  imported by the dashboard render path *and* by the CI report script, so it cannot take a
  Node-only dependency.
- **D-16:** The primary entry point returns **the pace series and the coverage accounting
  together in one result**, so no caller can obtain derived pace without also holding the coverage
  and gap information. This is the structural reason COV-02's caption cannot drift out of sync
  with the histogram beside it, and it is the same "force both derivations through one exported
  function" lesson Phase 24 recorded (`resolveExcluded`).
- **D-17:** Presentation-derived pace stays **non-persisted** on the dashboard render path,
  preserving D-22's boundary from v2.0 — the smoothed series never feeds `computeSplits` and never
  becomes a stats value. What Phase 26 persists is the PACE-07 *flag* (D-14) and the PACE-06
  *report* (D-19), not a pace series.
- **D-18 (Criterion 4):** The single-source audit ships as a **vitest test**, not a standalone
  script — it then runs in the existing CI chain for free and cannot be forgotten. It greps `src/`
  for per-sample `dt / (dd / 1000)`-equivalent pace arithmetic and fails on any match outside
  `pace-derivation.ts`, and is **demonstrated catching a deliberately reintroduced second
  implementation** before being trusted clean. Note for the planner: the audit's scope is
  *stream-derived* pace (PACE-01's wording). The metadata-derived sites — `compute-dashboard-index.ts:202`
  and `detail.ts:610` — are a different computation (`moving_time / distance`) and belong to
  PACE-07's cross-check, not to this audit; the pattern must be written so it does not conflate them.

### Deliverable artifacts (PACE-06, ERA-03)

- **D-19:** The PACE-06 residual — the 13-of-154 activities still above 0.5% covered-time fast
  mass, by ID and percentage — is a **committed markdown deliverable in the phase directory**
  (`26-RESIDUAL.md`), following the `15-FIXTURE-CANDIDATES.md` precedent for a reviewed artifact
  whose provenance matters. It ships **with the script that regenerates it** (under `scripts/`),
  so Phase 27 can re-derive the list at its own boundary rather than trusting a transcribed
  number — which is exactly what the roadmap requires of it ("cross-checked at that phase's
  boundary rather than merely asserted here").
- **D-20:** The ERA-03 fixture library lives at **`src/analytics/pace-fixtures.ts`** as **named
  exports**, so Phases 27-30 `import` them rather than rebuilding. Synthetic fixtures (where the
  expected answer must be known, since no ground truth exists for real GPS data) are constructed
  there; pinned real-archive cases are read from `data/streams/` and `data/activities/` via
  `node:fs` following `best-effort-fixtures.test.ts`'s established pattern — never from the
  derived, gitignored `data/stats/`. A test asserts **each required fixture is present by name**
  (Criterion 6), covering fēnix 6 Pro / Suunto 9 / GPX / intervals.icu-only / no-device-name, plus
  a decimation-aliased stream, a recording gap, a multi-hour pause, an impossible-speed sample,
  and the pinned worked example 4556693525.

### Claude's Discretion

The developer explicitly delegated three areas; each is recorded above with the reasoning that
drove the default, so the planner inherits a decision rather than an open question:

- **Windowing mechanism** (D-01/D-02/D-03) — delegated, constrained to whatever survives the four
  measured interval profiles with a fixed-20s implementation demonstrated failing first.
- **Gap taxonomy** (D-04/D-05) — delegated; the recommendation (two signals, pause scale-relative)
  was taken, and D-05 records the non-negotiable discriminator.
- **Split gap marking** (D-09) — delegated; the recommendation (inline marker + legend stating the
  measured gap duration) was taken.

Beyond these, the four internal-engineering areas (coverage denominator, module shape and audit,
residual report form, fixture library home) were locked by the developer's explicit instruction to
default them and review the written artifact: D-06/D-07, D-15..D-18, D-19, D-20.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` §"Pace derivation (PACE)" and §"Honest coverage (COV)" — PACE-01..PACE-07,
  COV-01, COV-02 in full, including PACE-03's measured advance-interval table (the four profiles
  D-02 must validate against) and PACE-06's recorded correction about the fixed-window artifact.
- `.planning/REQUIREMENTS.md` ERA-03 — the stratified fixture library requirement D-20 implements.
- `.planning/ROADMAP.md` §"Phase 26" — the seven Success Criteria, including the demonstrated-failing
  clause attached to nearly every one. **Criterion 3 is amended by D-06** (it names a stream
  `elapsed_time` field that does not exist).
- `.planning/PROJECT.md` §"Current Milestone: v2.2" — the five explicit non-goals, each with its
  reason. Most binding here: `data/streams/` stays byte-identical, genuine device over-measurement
  is flagged not corrected, and device `moving_time` stays the shipped aggregate.

### Prior research
- `.planning/research/FEATURES.md` — PACE-03's basis that no industry smoothing standard exists to
  adopt (only Strava and Garmin publish anything, both vague; Garmin Connect's web chart has no
  smoothing at all).
- `.planning/research/PITFALLS.md` — domain traps carried into this milestone.
- `.planning/research/SUMMARY.md` — the phase-ordering rationale, including why ERA-03 folds into
  Phase 26 and ERA-01/02 into Phase 27 rather than becoming a phase of their own.

### Precedents this phase deliberately follows
- `.planning/milestones/v2.0-phases/15-best-effort-engine/15-FIXTURE-CANDIDATES.md` — the
  reviewed-deliverable-in-phase-dir precedent D-19 follows.
- `src/analytics/best-effort-fixtures.test.ts` — the external-reference fixture pattern D-20
  follows: reads the real committed archive via `node:fs`, never the derived gitignored
  `data/stats/`, and treats a changed expected value as a regression rather than a fix.
- `src/analytics/trimp.ts` (module header) — states the Δt-integration discipline and cites
  `derivePaceSeries` as its model; a fourth consumer of the same rule and the template for D-15's
  purity constraint.

### Downstream consumers (do not break)
- `.planning/ROADMAP.md` §"Phase 27" Criterion 2 — index additivity with
  `DASHBOARD_INDEX_SCHEMA_VERSION` unchanged; D-14 must not pre-break it.
- `.planning/ROADMAP.md` §"Phase 27" Criterion 1 and §"Phase 30" — both compose Phase 26's gap
  classifier and fixture library by name.

</canonical_refs>

<code_context>
## Existing Code Insights

### The two divergent derivations PACE-01 collapses
- `src/dashboard/views/detail-charts-logic.ts:97` `derivePaceSeries` — centred **real-elapsed-time**
  window, sums actual distance/time using interpolated `d` at the window edges (never a fixed
  sample count), returns `null` on zero metres or zero elapsed so a standstill never yields
  Infinity. **The shape is already right**; what is wrong is that its width is the constant
  `PACE_SMOOTHING_WINDOW_SEC`. This is the code D-01 keeps and makes adaptive.
- `src/dashboard/views/detail-zones.ts:76` `computePaceDistribution` — raw per-sample
  `dt / (dd / 1000)`, Δt-weighted into buckets, with `if (dt <= 0 || dd <= 0) continue`.
  **That skip is the located defect**: on the pinned exemplar it discards 964 of 3,394 elapsed
  seconds (28%), which is precisely the "covers 72% of elapsed time" figure PROJECT.md and COV-02
  both cite. It is also the assertion COV-01 must be watched failing against.

### Reusable assets
- `interpValueAtTime` (`detail-charts-logic.ts`) — binary-search interpolation at an arbitrary
  time. Already correct and already used for window edges; the adaptive window needs it unchanged.
- `validateStreamSeries` (`detail-zones.ts`) — the existing total, never-throwing guard on `t`/`d`.
- `computeSplits` (`detail-splits.ts`) — interpolated km-boundary crossings with
  `accumulateWeighted` for per-split HR/cadence. **Arithmetic is correct and PACE-05 does not
  change it**; the phase adds gap marking on top, and `startTimeSec`/`endTimeSec` are already on
  every split, so intersecting a split window with a gap interval needs no new plumbing.
- `data/stats/{name}/{id}.json` shard convention (e.g. `best-efforts/{id}.json`) — the lazy
  per-activity fetch pattern Phase 27 will extend; relevant here only so D-14's index field does
  not duplicate what belongs in a shard.

### Established patterns that constrain this phase
- **Purity seam**: `trimp.ts` and the analytics modules are pure and client-safe. D-15 inherits it.
- **Δt integration, never sample count**: stated in `trimp.ts`'s header as Pitfall 2 from
  18-RESEARCH.md, and honoured by `derivePaceSeries`, `computeHrZoneTimes` and
  `computePaceDistribution` alike. `CanonicalStream.t` is decimated and irregularly spaced.
- **Additive index fields keep `schemaVersion` at 1** — `dashboard-index.types.ts:17`.
- **Force both derivations through one exported function** — Phase 24's `resolveExcluded` lesson,
  which D-16 applies to pace + coverage.
- **A shared row renderer serves three surfaces** — Phase 20's `renderActivityRow` with `idPrefix`;
  D-11's list badge must respect it.

### Integration points
- `src/dashboard/views/detail.ts:679` — where `computePaceDistribution` is called and
  `buildBreakdownSection` assembled; D-08's caption lands here.
- `src/dashboard/views/detail-sections.ts:313` — the `Pace Distribution` heading;
  `detail-sections.ts:82` — the `+/-` diff D-13 rebases for flagged activities.
- `src/dashboard/views/detail.ts:610` and `src/analytics/compute-dashboard-index.ts:202` — the two
  metadata-derived pace sites (`moving_time / distance`). **These are PACE-07's subject, not
  PACE-01's** — D-18 warns the audit pattern must not conflate the two computations.
- `src/dashboard/views/list.ts:405,556` and `list-logic.ts:195,335` — where index pace is
  displayed, sorted and filtered; D-11's badge and D-12's no-suppression rule apply here.
- `src/streams/derive-stream.ts:26` `MAX_SAMPLES = 3000` with the `[1,2,3]` decimation ladder —
  the upstream cause of the aliasing. **Read-only context**: streams stay byte-identical, so the
  derivation must cope with what is committed rather than fix the source.

### Measurements taken during this discussion (re-derivable; not yet a committed artifact)

Profiled from the committed archive:

| activity | samples | max time gap | median advance interval | time in distance-flat runs |
|---|---|---|---|---|
| 5059204779 | every 2s (n=1,893) | **7s** — no recording gap | 60s | 3,671 / 3,788 = **97%** |
| 3647739864 | every 2s (n=2,406) | 15s | 16s | 4,522 / 4,830 = 94% |
| 4598855187 | every 3s (n=2,344) | 8s | 24s | 6,488 / 7,036 = 92% |
| 4556693525 | every 2s (n=1,682) | 18s | 2s | 964 / 3,394 = **28%** |

Two conclusions the planner should not have to rediscover: the 28% on the pinned exemplar **is**
the shipped histogram's missing coverage, and a distance-flat gap rule would exclude 97% of an
activity that has no recording gap at all (D-05).

Also confirmed: a 250-activity random sample has a median sample interval of 2-3s and an advance
p90 of 6s, but 70% of activities carry at least one time gap >10s and 2% carry one >30 min — so
the recording-gap signal is common while the extreme-interval profiles are a minority cohort.

</code_context>

<specifics>
## Specific Ideas

- Activity **5059204779** is the pinned PACE-07 case: `moving_time: 1216` against
  `distance: 10804` → `paceSecPerKm: 112.6`, displayed as **1:53/km** for a run whose own stream
  derives **5:51/km**. Splits: 7:05, 5:00, 6:00, 6:00, 6:00, 7:00, 5:00, 6:00, 6:00, 6:00 — the
  round numbers are 60s emission landing on minute multiples, **not** corruption.
- Activity **4556693525** is the pinned PACE-04 worked example: raw 2:30-3:30 cluster plus 8:15-8:30
  and 11:00 buckets, resolving to one distribution centred 5:00-6:15, against per-km splits of
  4:35, 4:18, 5:17, 5:22, 5:44, 5:24, 5:22, 6:12, 6:08, 6:53 (overall 5:35).
- **The correction that must not be re-litigated:** an earlier draft called 5059204779, 3647739864
  and 4598855187 "beyond derived-layer repair" at 94.81% / 59.77% / 42.57% fast mass. That was a
  fixed-20s measurement artifact. Under adaptive windowing they read 1.22% / 0.00% / 0.00% with
  coverage rising from 30/40/45% to 97/100/100%. Their streams were always sound. Any figure
  produced in this phase must state the window it was measured under.

</specifics>

<deferred>
## Deferred Ideas

- Nothing raised during discussion fell outside the phase boundary.

### Reviewed Todos (not folded)

Both keyword matches from `todo.match-phase 26` were reviewed and deliberately not folded:

- **Garmin export adapter when export arrives** (`2026-08-10-garmin-export-adapter-when-export-arrives.md`,
  STREAM-04) — externally blocked on the export arriving, and it is a stream *ingestion* change,
  which this milestone's "`data/streams/` stays byte-identical" non-goal explicitly forbids.
- **IN-17 / IN-18 curation-guard cosmetics** (`2026-09-02-in17-in18-curation-guard-cosmetics.md`) —
  `scripts/lib/curation-guard.mjs` polish. Belongs with Phase 29, which is the next phase to touch
  the curation guard and already carries a criterion asserting both publish guards discriminate in
  both directions.

</deferred>

---

*Phase: 26-Shared Gap-Aware Pace Derivation & Honest Coverage*
*Context gathered: 2026-09-08*
