# Phase 30: Elevation Quality Signal - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A compute-layer altitude detector with three independent mechanisms (sub-ground-level readings,
barometric closure drift, implausible vertical rate) run archive-wide over the committed streams,
its results carried as a sixth quality signal on Phase 27's per-activity signal set, disclosed via
the existing badge and detail-view machinery, and validated by a regenerable archive-wide report.
**Flag only**: no DEM lookup, no correction, no grade-adjusted pace, and `data/streams/` stays
byte-identical. No new list filter, no new chart annotation, no new runtime dependency.

</domain>

<decisions>
## Implementation Decisions

### Closure-drift loop test (ELEV-01 drift mode, Criterion 1)

- **D-01 (this changes a number in the requirement — the planner must not skip it):** **Drift is
  loop-gated using activity metadata.** The committed streams carry no per-sample position by
  design, so "despite returning to the same place" is tested against `start_latlng` /
  `end_latlng` in `data/activities/{id}.json` (present on 1,658 of 1,890 activities): the drift
  mode fires only when the start/end haversine distance is within a loop radius AND
  `|alt[end] − alt[start]| > 60 m`. Scouting measurement on 2026-09-18: the requirement's "34"
  was produced by the raw start/end altitude difference **without** the loop condition; of those
  34, 21 start and end within 200 m, 12 are point-to-point runs whose endpoints are 1.4–9.6 km
  apart (a real 60–90 m altitude change is plausible there), and 1 has no position at all.
  Rejected: the raw difference (reproduces 34 but knowingly flags 12 runs the requirement's own
  wording excludes), and flag-loop-gated-but-report-raw-as-the-criterion-count (makes the
  criterion assert a number the detector does not flag).

- **D-02:** **No start/end position → drift is `not-computable` for that activity; sub-ground
  and vertical-rate still run.** Applies Phase 27 D-06's never-coerce-to-a-plausible-zero rule
  (T-26-02) at per-mode granularity. The detail view says so in words ("start/end position
  unknown — drift not checked"); the report counts this cohort in its own section. Rejected:
  falling back to the raw difference (reintroduces the point-to-point false positive exactly where
  it cannot be checked) and silent skip (silence-as-good-news, rejected twice before on the same
  page).

- **D-03:** **60 m stays; the loop radius is derived by research from the archive itself and
  justified in the report, per Phase 27 D-02.** 60 m is the requirement's measured figure and
  sits well above barometric noise. The radius is not to be picked by feel: research computes the
  start/end distance distribution over the 1,658 positioned activities and chooses a value in the
  visible gap between "same spot" and "went somewhere" (the scouting measurement used 200 m as a
  placeholder; it is a placeholder, not the decision). The rate measured at that radius is a
  reported finding, never a target. Rejected: fixing 200 m here without derivation, and scaling
  the drift threshold with duration (departs from the requirement's flat figure and needs its own
  calibration).

- **D-04:** **ROADMAP Criterion 1 and ELEV-01 are corrected to the loop-gated count, not
  satisfied by a diagnostic.** Once research pins the radius and the calibration report measures
  the loop-gated cohort, the plan updates the "at least 34" wording (ROADMAP.md Phase 30
  Criterion 1 and REQUIREMENTS.md ELEV-01) to the measured figure, records that 34 was a
  raw-difference measurement, and the report lists the point-to-point exclusions by ID as
  excluded-by-design. This is the [[checkpoint-row-can-bless-the-defect]] lesson applied before
  the row is drafted rather than after.

### Signal home and severity (ELEV-01, Criterion 2)

- **D-05:** **Elevation is a sixth field on `ActivityQualitySignals`** — same interface in
  `src/analytics/pace-quality.ts`, same shard (`data/stats/pace-quality/{id}.json`), same index
  row field, same compute step. One place answers "is this activity trustworthy", and the detail
  view keeps Phase 27 D-18's "exactly one fetch on open". Rejected: a separate module with its
  own shard (second fetch, second compute step) and index-row scalars without shard evidence
  (loses the per-sample findings the detail view shows).

- **D-06 (the one to not quietly reverse):** **Elevation is tiered but stays OUTSIDE the
  `anySevere` composite.** `anySevere` is the pace-trust composite (Phase 27 D-01/D-05: exactly
  three tiering signals); bad altitude says nothing about pace because no grade-adjusted pace
  ships. Measured 2026-09-18 from the shipped index: `anySevere` is 299/1,890 (15.8%); 42 of the
  71 elevation activities are already severe; joining would move it to 328 (17.4%) and force
  revisits of `27-CALIBRATION.md`, `compute-pace-quality-recount.mjs` and the D-01 comments.
  Consequences the planner must carry: `hasAnySevereSignal` is unchanged; the existing "has any
  severe signal" filter does not see elevation; the Phase 27 recount's numbers must be byte-stable
  after this phase lands (that is a regression check, not a nicety). Rejected: joining the
  composite, and an untiered labelled fact (Criterion 1 already fixes a threshold per mode, so a
  tier boundary exists whether or not it is named).

- **D-07:** **Per-mode booleans with measured values under one rolled-up tier; no minor band.**
  Shape (names are the planner's; structure is locked):
  `{ tier: 'severe' | 'none' | 'not-computable', subGround: { flagged, minAltM },
  closureDrift: { state: 'flagged' | 'clear' | 'not-computable', deltaM, startEndDistM },
  verticalRate: { flagged, worstRateMps, violatingSamples } }`. `tier` is `severe` iff any mode
  fires; each threshold (−50 m, 60 m, 5 m/s) is already the mechanism's floor, so a minor band
  would be three new knobs the requirement never names. Modes stay individually visible so the
  overlap matrix, the per-mode badge text and Criterion 2's independence proof can read them.
  Whole-signal `not-computable` applies only to the 24 stream-less / unusable-stream activities
  (Phase 27 D-06's closed reason set); drift-only not-computable is D-02.

- **D-08:** **Vertical rate is per-sample `|Δalt| / Δt` on the committed decimated stream,
  skipping pairs with `Δt ≤ 0`.** This is exactly the measurement that reproduces 39 (worst
  80.4 m/s on 3149636661). Dividing by real Δt means recording and pause gaps dilute rather than
  spike, so no gap-classifier dependency is needed. Reports the worst rate and the count of
  violating sample pairs. Research must check whether carry-forward-filled altitude runs
  (`Δalt = 0` across a filled stretch, then a jump) mask or manufacture anything, and say so in
  the report. Rejected: excluding pairs across classified gaps (likely a no-op; confirm rather
  than assume) and a windowed rate (suppresses the single-sample spikes this mode exists to
  catch).

- **D-09:** **Thresholds are the requirement's: sub-ground `< −50 m` on the minimum altitude,
  drift `> 60 m` absolute, rate `> 5 m/s`.** Sub-ground is tested on the stream's minimum, not on
  a count of samples. `ALT_MIN = −500` in `derive-stream.ts` is not touched — it is the
  derivation's bound, and changing it would alter committed streams on the next re-derivation,
  which is the milestone's stated non-goal.

### Disclosure surfaces (Criterion 3, roadmap "UI hint: yes")

- **D-10:** **One severe-only elevation badge per row on all three `renderActivityRow`
  surfaces, naming the fired mode(s) with the worst value.** Visible text carries condition +
  measured value per Phase 27 D-09 (e.g. `altitude −282 m below ground`,
  `altitude drift 198 m · spike 80 m/s`); the accessible description carries why it matters.
  Reuses `appendAccessibleBadge` unchanged; no per-surface branching (Phase 27 D-10). One badge
  rather than one per mode because 12 activities fire two or more modes and rows already carry
  pace, PR and gear badges. Rejected: no row badge (contradicts the roadmap's badge-reuse note).

- **D-11:** **The detail view's quality section shows three always-on mode lines**, healthy or
  not, tier-styled, extending Phase 27 D-08: `lowest altitude 12 m`, `start/end altitude differ by
  4 m (loop, 38 m apart)`, `max vertical rate 1.2 m/s`. The drift line's not-computable state
  reads in words. This gives the browser checkpoint three numbers to read back against the
  committed shard. Rejected: a collapsed single line (silence-as-good-news) and a marker on the
  altitude chart (a new interactive surface — deferred).

- **D-12:** **The detail view's Elevation Gain stat card is badged when the activity is
  elevation-flagged; nothing else is caveated.** Reuses the stat-card badge precedent at
  `src/dashboard/views/detail.ts:640-644` (`paceDisagreement`). The per-split `elevDeltaM` column
  and the aggregate elevation totals (`compute-stats.ts`, overview) are untouched — flag only, no
  correction-by-disclaimer, and the quality section sits on the same page. Rejected: no caveat
  (the card would state a number the same page flags as implausible) and caveating splits +
  aggregates (a new surface that starts to look like correction).

- **D-13:** **No new list filter or URL param this phase.** Badge + detail disclosure only; the
  archive-wide "who is flagged" view is the report. Noted as deferred.

### Validation report and proof (ELEV-02, Criteria 1–3)

- **D-14:** **Fixtures: three synthetic per-mode streams plus pinned real exemplars.** Synthetics
  are `makeStream`-based in `src/analytics/pace-fixtures.ts`, one clean baseline (with `alt`)
  mutated per mode so each fires exactly one detector — that is what makes "remove its own
  fixture and the detector flags nothing" a real test. Pinned reals: `4556693525` is already the
  `worked-example` fixture (−282 m, Lisbon); add `4745489664` (−198 m drift on a loop) and
  `3149636661` (80.4 m/s spike; also drifts — fine as a real, not as the isolation fixture).
  Synthetics prove the mechanism; pinned reals prove it on this archive. `pace-fixtures.test.ts`
  re-verifies pinned `expected` values against the live archive, so the new rows must carry
  verified properties (min altitude, start/end delta, worst rate).

- **D-15:** **`30-CALIBRATION.md`, same convention as `27-CALIBRATION.md`**, written by
  `scripts/compute-elevation-calibration.mjs` behind an npm script, reading `data/` read-only,
  with pure functions importable by its `.test.mjs`. Sections: live denominators (1,890
  activities / 1,865 streams with `alt`; state which denominator each rate uses, per Phase 27
  D-06); thresholds in force including the derived loop radius and its justification; per-mode
  cohorts with worst-case IDs; the 3×3 overlap matrix (measured raw: sub∩drift 7, sub∩rate 3,
  drift∩rate 5 — recompute loop-gated); the union with device-family breakdown (measured raw:
  Suunto 9 50, fēnix 6 Pro 12, no device name 8, vívoactive 4 1); the drift not-computable
  cohort; the loop-gate exclusions by ID; and Criterion 2's independence evidence in prose. A
  companion `compute-elevation-recount.mjs` reads the shipped `data/dashboard/index.json` only
  and must not import the classifier (Phase 27 D-03). Rejected: extending `27-CALIBRATION.md`
  (couples regeneration to Phase 27's script and its residual subprocess).

- **D-16:** **Streams are proved byte-unchanged by a digest before/after in the calibration
  script plus a code audit.** The script rolls per-file sha256 over `data/streams/` into one
  digest before the sweep and after, prints both into the report, and exits non-zero if they
  differ; a test asserts the new analytics module and both scripts have no `fs` write target
  under `data/` (the T-27-09 pattern). Automated, re-runnable, and cannot agree with itself.
  Rejected: `git status` alone (blind on a dirty tree) and code audit alone (proves intent, not
  outcome).

- **D-17:** **The phase ends on its own lightweight human browser checkpoint.** One short round:
  a flagged row badge on each of the three surfaces; the three detail lines plus the Elevation
  Gain caveat on `4556693525` and on a healthy activity; numbers read back against the shard
  file and the report. Small because there is no new interaction, but not skipped — this project
  has shipped rendering defects behind green gates three times. Checkpoint hazards carried from
  Phase 27 D-18: hard-reload after every fixture edit, verify the served digest not the build
  log, viewport clamps to 500..941, and every row must assert reachable extent against an
  independently derived value, not internal agreement.

### Claude's Discretion

- Exact field names, badge wording and the sr-only "why it matters" sentences per mode.
- Whether the three synthetic fixtures share one baseline builder or three small ones.
- The report's markdown layout beyond the sections D-15 names; the recount script's structure
  (mirror `compute-pace-quality-recount.mjs`).
- Whether drift reports signed `deltaM` (recommended: signed, with the badge showing the
  absolute value).
- Plan/wave breakdown, including whether the requirement-text correction (D-04) is its own task
  or folded into the calibration plan — it must land before the checkpoint plan drafts its rows.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` § Phase 30 — goal, three success criteria (Criterion 1's "34" is
  corrected by D-04), UI hint, checkpoint note.
- `.planning/REQUIREMENTS.md` § ELEV-01, ELEV-02 — the three modes, measured cohorts, flag-only
  rule; § Out of scope rows on DEM correction, geometric spike rejection, new runtime deps.
- `.planning/PROJECT.md` § Current Milestone — non-goals: `data/streams/` byte-identical, flag
  never correct, no new compute step outside CI's view.

### Prior-phase decisions this phase extends
- `.planning/phases/27-per-activity-quality-signals/27-CONTEXT.md` — D-01/D-05 (three tiering
  signals form `anySevere`; D-06 here keeps that true), D-02 (mechanism-first thresholds), D-03
  (recount reads shipped index, never imports the classifier), D-06 (not-computable, denominators),
  D-07..D-10 (badge and detail disclosure rules), D-17 (shard evidence), D-18 (checkpoint hazards).
- `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md` — the report shape D-15
  copies; its numbers must be byte-stable after this phase (D-06).
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-CONTEXT.md` — fixture
  library conventions, T-26-02 never-coerce rule, Δt-integration rule.

### Code that is the contract
- `src/analytics/pace-quality.ts` — `ActivityQualitySignals`, `QualityTier`,
  `computePaceQualitySignals`, `buildPaceQualityShard`, `hasAnySevereSignal` (unchanged by D-06).
- `src/analytics/pace-fixtures.ts` — `makeStream` (takes `alt`), `PINNED_FIXTURES` schema with
  verified `expected` values, `worked-example` = 4556693525.
- `src/streams/derive-stream.ts` — `ALT_MIN`/`ALT_MAX`, carry-forward fill of `alt`; read-only
  reference for D-08/D-09, not modified.
- `src/streams/stream.types.ts` — `CanonicalStream.alt?: number[]`, `channels.elevation`.
- `scripts/compute-pace-quality-calibration.mjs` and `scripts/compute-pace-quality-recount.mjs`
  — the script conventions D-15 mirrors (per-file try/catch sweep, self-execution guard,
  single declared write target, importable pure functions).

### Memory lessons that bind the checkpoint plan
- `checkpoint-rows-must-assert-extent`, `checkpoint-row-can-bless-the-defect`,
  `reachability-probe-must-use-named-input`, `staged-build-browser-cache-trap`,
  `build-widgets-mtime-skip-silently-noops` (in the project memory index).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `makeStream({ t, d, alt })` in `src/analytics/pace-fixtures.ts` already accepts an `alt`
  array and sets `channels.elevation` — the synthetic per-mode fixtures need no new builder.
- `appendAccessibleBadge(container, visibleText, explanation, descriptionId)` in
  `src/dashboard/views/list.ts` — both slots D-10 needs; the stat-card reuse precedent is
  `detail.ts:640-644`.
- `PINNED_FIXTURES` / `loadPinnedStream` / `loadPinnedActivity` — adding two pinned reals is two
  table rows plus verified `expected` values.
- `compute-pace-quality-calibration.mjs` — the archive-sweep skeleton (enumerate
  `data/activities/*.json`, per-file try/catch, warn-and-continue, markdown renderer, sanity
  gate) and `compute-pace-quality-recount.mjs` — the shipped-index recount skeleton.
- `data/activities/{id}.json` already carries `start_latlng`, `end_latlng`, `device_name`,
  `total_elevation_gain`, `elev_high`, `elev_low` — D-01's loop test needs no new file read in
  `compute-dashboard-index.ts`, which already opens the activity file.

### Established Patterns
- **Additive index fields keep `schemaVersion` at 1**; producer type required, parsed type
  `Partial` — the new `elevation` field is required on the producer signal type and every reader
  handles absence.
- **Analytics modules are pure and client-safe** — the detector takes `(stream, metadata)` and
  returns a value; the haversine for D-01 is a 10-line pure function, no new dependency.
- **Never coerce insufficient data to a plausible zero** (T-26-02) — D-02 and D-07's
  not-computable states.
- **Mechanism-first thresholds, measured rate reported not tuned** (Phase 27 D-02) — D-03's
  loop radius derivation.
- **Every phase closes on a human browser checkpoint** (D-17), and checkpoint rows assert
  reachable extent against an independently derived value.

### Integration Points
- `src/analytics/pace-quality.ts` — new signal type + detector + wiring into
  `computePaceQualitySignals` / `buildPaceQualityShard` / `notComputableSignals`.
- `src/analytics/compute-dashboard-index.ts` — passes `start_latlng` / `end_latlng` through the
  metadata slice; lands the new scalar on the row.
- `src/dashboard/views/list.ts` / `list-logic.ts` — the badge on `renderActivityRow` (no filter
  change per D-13).
- `src/dashboard/views/detail-sections.ts` / `detail.ts` — quality section lines (D-11) and the
  Elevation Gain card badge (D-12).
- `package.json` — two new scripts (`compute-elevation-calibration`,
  `compute-elevation-recount`); `verify-dashboard-publish.mjs` if it asserts the row shape.

### Measurements taken during this discussion (2026-09-18, re-derivable)

| quantity | value | source |
|---|---|---|
| streams with `alt` | **1,865** of 1,865 real streams (1,866 files incl. `manifest.json`) | `data/streams/` |
| sub-ground (`min alt < −50`) | **11**; worst −282 m (4556693525), −189 m (7382336793), −125 m (5493309448) | per-stream min |
| raw closure drift (`|end − start| > 60`, no loop test) | **34**; worst −198 m (4745489664), −173 m (3149636661), +164 m (5493309448) | per-stream delta |
| of those 34: loop within 200 m / point-to-point >200 m / no position | **21 / 12 / 1** | `start_latlng`/`end_latlng` haversine |
| vertical rate (`|Δalt|/Δt > 5`, Δt > 0) | **39**; worst 80.4 m/s (3149636661), 19.4 (5059198439), 18.6 (3925007542) | per-sample |
| union (raw definitions) | **71**; overlaps sub∩drift 7, sub∩rate 3, drift∩rate 5 | set arithmetic |
| union by device family | Suunto 9 50 · fēnix 6 Pro 12 · no device name 8 · vívoactive 4 1 | `device_name` |
| activities with start+end latlng | **1,658** of 1,890 | `data/activities/` |
| shipped `anySevere` | **299** / 1,890 (15.8%); 42 of the 71 already severe | `data/dashboard/index.json` |

The raw-definition figures reproduce the requirement's 11/34/39/71 and 50/12/8/1 exactly; the
loop-gated drift count and union are for research to measure at the derived radius (D-03/D-04).

</code_context>

<specifics>
## Specific Ideas

- The drift detector must be able to say *why* it did not fire: "clear", "not a loop
  (endpoints N m apart)", or "position unknown" — the report's exclusion list and the detail
  line both need that distinction, not a bare `false`.
- `4556693525` is the milestone's worked example everywhere (pace histogram, worked-example
  fixture, now −282 m); the checkpoint reads its three elevation lines against
  `data/stats/pace-quality/4556693525.json`.
- Badge text keeps the Phase 27 form — condition + measured number, no adjectives — so the
  checkpoint quotes a number.

</specifics>

<deferred>
## Deferred Ideas

- **Elevation-flagged list filter / URL param** — a second toggle mirroring Phase 27 D-15/D-16;
  useful for browsing the flagged cohort, but a new list capability.
- **Marker on the detail altitude chart** at the offending sample or range — a new chart
  annotation surface warranting its own checkpoint.
- **Caveats on aggregate elevation totals** (yearly/overview) derived from flagged activities —
  rejected here as correction-by-disclaimer; revisit only if a future phase corrects altitude.
- **DEM correction / grade-adjusted pace** — explicitly out of scope for the milestone
  (REQUIREMENTS.md § Out of scope).

### Reviewed Todos (not folded)
- **Garmin export adapter when export arrives** (`2026-08-10`) — keyword match only (`garmin`,
  `data`); externally blocked on the export and unrelated to altitude flagging. Stays carried in
  STATE.md.

</deferred>

---

*Phase: 30-elevation-quality-signal*
*Context gathered: 2026-09-18*
