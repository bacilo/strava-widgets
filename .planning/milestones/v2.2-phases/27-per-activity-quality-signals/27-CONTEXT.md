# Phase 27: Per-Activity Quality Signals - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Every activity carries five named quality signals — decimation/stair-step ratio,
physically-impossible-sample count, gap profile, elapsed-vs-moving divergence, and device era —
computed in the CI chain, persisted as compact scalars additively on the dashboard index row plus a
lazily-fetched `data/stats/pace-quality/{id}.json` shard, disclosed as individually-named badges on
the activity list and detail view, with severity thresholds calibrated against a measured,
independently re-derived archive-wide rate.

Nothing is corrected. This phase measures and discloses; `data/streams/` stays byte-identical, no
pace or PR value moves, and `moving_time` stays the shipped aggregate. The PR plausibility ceiling
(Phase 28), the curation review queue (Phase 29) and elevation quality (Phase 30) are out of scope
— Phase 27 builds the signals and the shard those phases read.

Requirements: QUAL-01..QUAL-05, ERA-01, ERA-02 (7 total; ERA-03 was delivered by Phase 26 and is
composed here, not rebuilt).

</domain>

<decisions>
## Implementation Decisions

### Severity model and calibration (QUAL-05, Criterion 4)

- **D-01:** **Per-signal tiers; the composite "any severe" is the calibrated number.** Each tiering
  signal carries its own `none` / `minor` / `severe` tier with its own thresholds. Criterion 4's
  "top-tier flag count" is the count of activities carrying **at least one** severe signal, and it is
  that composite that must land under ~5%. Keeps QUAL-02's disclose-individually rule true at the
  tier level, not merely at the raw-value level, and it is what lets each badge name its own
  condition per QUAL-04. Rejected: a per-signal 5% budget (five signals each at 4.9% could still put
  a severe badge on ~20% of rows), and a single rolled-up activity tier (collides head-on with
  QUAL-02, which exists precisely because decimation and device era correlate).

- **D-02 (this is the one to not quietly reverse):** **Thresholds are derived from mechanism first;
  the measured rate is a reported finding, never a target solved for.** Each threshold is justified
  from the signal's own mechanism and this archive's evidence. The dry run then measures the
  composite rate and reports it with its per-signal cohort breakdown. If it lands materially above
  ~5%, **that is a finding to surface, not a reason to retune** — QUAL-05 calls a high top tier a
  calibration failure, and this keeps that disagreement visible instead of dissolving it by moving a
  number. Criterion 4's "demonstrated failing by moving a threshold and observing the rate move"
  proves the knob is connected; it says nothing about which direction it was first turned, and D-02
  is what fixes that direction. A threshold tuned until it produced ~90 activities would no longer be
  a claim about the data — it would be a quota, and the badge text "12% of elapsed time in recording
  gaps" would stop implying 12% is actually bad.

- **D-03:** **The recount reads the shipped index JSON only and must not import the classifier.**
  The independent verifier required by Criterion 4 opens `data/dashboard/index.json` off disk and
  counts severe-tier fields with its own arithmetic. It is explicitly forbidden from importing the
  module that wrote those fields — otherwise it agrees with itself by construction, which is the
  exact failure mode Phase 23's CR-01 lesson and this project's three shipped-defects-behind-a-green-gate
  history exist to guard against. Its claim is bounded and honest: "what shipped matches what was
  reported." It catches the real regression (a compute step that silently stopped emitting a field).
  A full re-derivation from `data/streams/` was considered and rejected as the primary check: it must
  import the same classifier, so it cannot arbitrate the threshold question.

- **D-04:** **Phase 26's cohort definition is reused verbatim as the severe-decimation threshold; the
  residual is the boundary cross-check.** `26-RESIDUAL.md`'s already-justified cohort rule — more
  than 15% of consecutive samples with zero distance advance **and** at least 50 samples — becomes
  the severe tier for the decimation signal, so the 154 are exactly the severe-decimation set. No
  second, differently-drawn line is invented for a mechanism Phase 26 already drew one for. The
  14-activity residual is used **only** as the cross-check the roadmap requires of this phase
  ("cross-checked at that phase's boundary rather than merely asserted here"): re-derive it via
  `npm run compute-pace-residual` and assert the list still matches, catching drift since
  2026-09-09. Rejected: promoting the residual to a sixth signal (the roadmap names five, and QUAL-01
  enumerates them), and making it decimation's top tier (it conflates *how the device recorded* with
  *whether our own derivation coped* — two different mechanisms in one ladder).

- **D-05 (consequence of D-12 and D-13 — the planner must not miss this):** **Only three of the five
  signals tier**: decimation, impossible-sample count, and gap profile. Device era and
  elapsed-vs-moving divergence are untiered facts. The composite "any severe" rate Criterion 4
  measures is therefore computed over those **three** signals alone. All five remain separate index
  and shard fields, so Criterion 1 is unaffected.

- **D-06 (denominator, measured 2026-09-10 — Criterion 4's stated figures are stale):** The live
  archive is **1,890 activities and 1,866 streams**; `data/dashboard/index.json` carries 1,890 rows
  at `schemaVersion: 1`. Roadmap Criterion 4 and PROJECT.md both say "1,864-activity archive" with
  "≈90 activities" as the ~5% figure; 5% of 1,890 is ~94. **The plan must state which denominator
  each reported rate uses and reconcile the two populations**, because 24 activities have no stream
  at all and the three stream-derived tiering signals cannot be computed for them. Those 24 must
  report an explicit not-computable state — never a fabricated zero, never a silent `none` tier —
  following `pace-derivation.ts`'s own T-26-02 rule that "insufficient data" is a zeroed/neutral
  result and never a plausible-looking computed zero. The index already carries
  `streams.available: false` with a `reason`, which is the existing precedent for this state.

### Disclosure surfaces and badge text (QUAL-02, QUAL-03, QUAL-04, Criterion 3)

- **D-07:** **Severe-tier only on activity-list rows, one named badge per fired signal.** A row badges
  only signals at severe tier. Under D-01/D-05 that is under ~5% of rows carrying any quality badge
  at all, so a list badge stays a genuine signal rather than wallpaper on a row that already carries
  low-confidence, pace-disputed, PR and gear badges. Minor-tier values still ship in the index row
  (so the filter and the detail view can see them) and still surface on the detail view. Rejected: a
  single rolled-up "quality" badge — a badge that does not name its condition violates QUAL-04's
  "explain, not just mark" on the very surface where pace sorting ranks activities.

- **D-08:** **The detail view discloses all five signals, always, tier-styled** — including healthy
  ones ("no recording gaps", "device: Garmin fēnix 6 Pro", "2.4% of samples impossible"). This
  extends D-08-of-Phase-26's always-on coverage caption reasoning to the signals sitting beside it on
  the same page: a healthy activity visibly says so rather than making the reader interpret silence
  as good news. It also gives the browser checkpoint a fixed set of numbers to read back against the
  committed shard file, and makes a compute step that stopped emitting a field visible rather than
  silent. Rejected: badging only fired signals (re-introduces exactly the silence-as-good-news
  reading Phase 26 rejected one section earlier on the same page), and collapsing healthy ones behind
  a disclosure toggle (adds an interaction the checkpoint must then exercise, and gestures need a
  human in this project's checkpoint setup).

- **D-09:** **Visible text carries condition + measured value; the accessible description carries why
  it matters.** Visible: `12% of elapsed time in recording gaps` — exactly what Criterion 3 reads off
  the rendered page. The `explanation` slot carries the why (`pace during a gap is interpolated, not
  measured`), wired via `aria-describedby` and also surfaced as a hover/tap `title`. This reuses
  `appendAccessibleBadge(container, visibleText, explanation, descriptionId)` from `list.ts`
  **unchanged** — it already provides exactly these two slots — and keeps the browser checkpoint
  quoting a number rather than prose. Rejected: a footnote legend explaining all five mechanisms once
  (follows Phase 26's D-09 split-marker pattern and avoids repetition, but detaches the explanation
  from the badge for a screen reader).

- **D-10:** **All three `renderActivityRow` surfaces badge, with no per-surface branching** —
  Activities, Overview Recent Activities, and Overview Recent PRs. Recent PRs is the strongest case,
  not the weakest: a PR drawn from a severely decimated or impossible-sample stream is precisely the
  row where a quality caveat matters most, and Phase 28 will demote some of those efforts anyway.
  One code path, honouring Phase 26's D-11 warning that this renderer is multi-surface-safe via
  `idPrefix` and must not acquire surface-specific conditionals.

### Device era taxonomy (ERA-01, ERA-02, Criterion 5)

- **D-11:** **Family-level granularity, matching the set `pace-fixtures.ts` already pins by name** —
  `garmin-fenix-6-pro`, `suunto-9`, `strava-app-gpx`, `intervals-icu`, `no-device-name`, plus
  whatever else this archive's four watches actually require. ERA-01's own evidence is family-level
  (fēnix 6 Pro at 0% `speed`, Suunto 9 at 99.8%, same FIT format), so this is the granularity the
  requirement's proof operates at, and Phase 26's stratification composes rather than being re-cut.
  Rejected: vendor-coarse (erases the exact distinction ERA-01 exists to preserve, and this athlete
  has four watches), and family-crossed-with-date-era (captures the real correlation — all 154 severe
  stair-step activities are 2020–2021 Suunto 9 — but baking the date into the device category
  re-merges the two mechanisms QUAL-02 insists stay separate).

- **D-12:** **An unrecognized `device_name` is a third explicit category that keeps the raw string.**
  Three distinct outcomes, never two: a known family; `unrecognized-device` carrying the actual
  `device_name` verbatim so a badge shows what the archive said rather than a guess; and
  `no-device-name` for the 716. ERA-02 names only the last of these, and Criterion 5's failure demo
  ("demonstrated failing if that branch is deleted and a default silently takes over") is precisely
  about defaults quietly absorbing a category — so the unrecognized case needs the same protection.
  A growing count of `unrecognized-device` rows is itself a visible signal that the lookup table
  needs a new entry. Rejected: folding unrecognized into `no-device-name` (discards a real string the
  data carries and makes the 716 figure unverifiable, since the cohort would silently grow), and an
  open taxonomy where the normalized string *is* the family (no unrecognized state can exist by
  construction, but the category set then varies with the archive and ERA-01's branching has nothing
  stable to key on).

  **Note for the planner:** `device_name` is untrusted athlete/device free text and the index is a
  public artifact published to GitHub Pages. Rendering it must use `textContent`, never `innerHTML`,
  matching the rule already stated on the index's `name` field. Publishing it is already precedented
  — `resolveGearLabel(gearMap, activity.gear_id, activity.device_name)` in `gear-client.ts` can
  already put `device_name` into the published `gearName` field — but the `dashboard-index.types.ts`
  header's rule against copying athlete identifiers, upload ids, external ids, gear ids and privacy
  flags still binds everything else.

- **D-13:** **Device era carries no severity tier — it is a labelled fact.** It ships as a category
  field, is always disclosed on the detail view, and is never badged on a list row, so it contributes
  nothing to the composite rate. That keeps Criterion 4's number a measure of *data defects* rather
  than of *which watch the athlete owned*, and it directly honours QUAL-02: device era and decimation
  correlate, but decimation is the mechanism, so decimation is what carries the severity. Rejected:
  tiering families by known signal-shape risk (an activity would be flagged severe purely for the
  watch it was recorded on, even with a clean stream — the merge QUAL-02 forbids), and tiering
  `no-device-name` as minor (716 is 38% of the archive; a minor tier firing on 38% of rows carries
  almost no information).

- **D-14:** **Elapsed-vs-moving divergence carries no severity tier either.** Ships as a disclosed
  ratio, visible on every detail view, contributing nothing to the composite rate. PROJECT.md's own
  non-goals settle this: elapsed-vs-moving "becomes a visible signal, not an authoritative
  recomputation", and stopped-watch correction is out because *nothing in the stored data
  distinguishes a deliberate rest from a forgotten stop*. A signal whose high values cannot be
  separated into benign and broken has no defensible severe threshold, and a badge on it could not
  honestly state why it matters. Rejected: tiering it anyway, and tiering it only when it corroborates
  a severe gap profile (more diagnostic, but a signal whose tier depends on another signal is no
  longer independently disclosed, which strains QUAL-02).

### Sort, filter, and the shard (QUAL-03, Criterion 2)

- **D-15:** **One filter, no new sort key.** The phase ships a single filter with its own URL param
  and no addition to `SortKey`. Sorting 1,890 rows by a three-value tier produces a near-meaningless
  ordering, whereas filtering to the severe cohort is the action that actually has a use — and it is
  the same action Phase 29's review queue will want. This delivers QUAL-03's stated purpose ("so the
  activity list can badge, sort and filter by them") without widening the sort surface, its
  null-value semantics, and the `list-logic.ts` URL-state parse/serialize round-trip and its tests.
  Rejected: fields-and-badges only (the browser checkpoint would then have no way to reach the
  flagged cohort except by scrolling), and shipping both sort and filter.

- **D-16:** **The filter is one toggle: "has any severe signal".** A single checkbox filtering to
  activities carrying at least one severe signal — the same composite the calibration report
  measures. One new URL param, one predicate, and it makes the calibrated number **directly reachable
  in the browser**, which gives the checkpoint something to count against the dry-run report rather
  than trusting it. Rejected: three per-signal checkboxes (truest to QUAL-02's spirit and better for
  investigating one mechanism, but three URL params plus AND/OR combination semantics to define and
  test), and adding a device-family select (family is the one untiered signal with obvious filter
  value, but it widens `FilterState` with a categorical dimension it has no precedent for).

- **D-17:** **The shard carries the evidence behind each scalar.** `data/stats/pace-quality/{id}.json`
  holds the per-activity detail each badge's number summarizes: the classified gap intervals (start,
  end, kind, duration) straight from Phase 26's classifier, the impossible-sample indices with their
  implied speeds, the zero-advance run profile, the adaptive window width resolved for that activity,
  and the resolved device family with its raw `device_name`. The detail view's quality section renders
  this beneath the badges — **which is what makes Criterion 2's "exactly one fetch on open" mean
  something**, since the five scalars alone are already on the index row and a shard fetched for
  nothing would be a fetch to delete rather than to assert. It is also the evidence Phase 29's queue
  and Phase 30's elevation work will want. Rejected: thresholds-and-provenance only (mostly identical
  in every file, and it is metadata *about* the check rather than QUAL-03's "detailed per-sample
  findings"), and full per-sample arrays (approaches stream size across 1,890 activities for an array
  the detail view will not render).

- **D-18:** **"Zero fetches on list, exactly one on open" is proven by a human network panel reading
  *and* an instrumented counter — neither alone.** Primary evidence is the human browser checkpoint
  reading the network panel against a production-shaped build **with a verified served digest**; it is
  the only thing that catches a stale bundle, and it cannot agree with itself. Backed by a fetch
  counter on the shard client (mirroring `best-efforts-client.ts`) asserted in a vitest test, so a
  regression is caught in CI between checkpoints. The test proves the code path; the panel proves what
  actually shipped. Rejected: either one on its own — a counter test exercises the module in
  isolation rather than the assembled page, which is the class of green-gate-with-shipped-defect this
  project has hit three times.

  **Checkpoint hazards the planner must design around** (recorded from this project's own history):
  `127.0.0.1` alone is not sufficient — checkpoints have served stale `index.html` / `index.json`
  from a staged build, so hard-reload after every fixture edit; `build-widgets` silently no-ops on any
  locally-edited `dist` file, so verify the **served digest**, not the build log; and the browser
  viewport clamps to 500..941.

### Claude's Discretion

The developer did not delegate any area wholesale — all sixteen questions were answered explicitly,
and every recommendation offered was interrogated on its own terms rather than waved through. What
remains genuinely open, and is left to research and planning:

- **Thresholds for the two tiering signals D-04 does not settle** — impossible-sample count and gap
  profile. Decimation's severe threshold is fixed by D-04 (Phase 26's cohort rule, verbatim). The
  other two must be derived from mechanism per D-02, then measured, with the rate reported.
- **Where the compute step lives.** Two of the five signals are metadata-only (device era from
  `data/activities/{id}.json`'s `device_name`; elapsed-vs-moving from `elapsed_time` / `moving_time`)
  and three are stream-derived. Whether that is one new compute step reading both, or an extension of
  `compute-dashboard-index.ts` (which already reads activity metadata) plus a shard writer, is an
  architecture call for the planner — bound only by D-15-of-Phase-26's purity rule if any of it is
  imported by the browser.
- **How the "demonstrated failing by moving a threshold" mechanic is wired** (Criterion 4).
- **Tier styling** against Phase 19's design system, and where the detail view's quality section sits
  relative to the existing Pace Distribution heading and coverage caption.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` §"Quality signals (QUAL)" — QUAL-01..QUAL-05 in full, including
  QUAL-02's explicit warning that device era and decimation severity stay separate signals because
  they correlate but decimation is the mechanism, and QUAL-05's statement that a top tier materially
  above ~5% is a calibration failure rather than an acceptable outcome (the basis for D-02).
- `.planning/REQUIREMENTS.md` ERA-01, ERA-02 — device-family-not-file-format branching with its
  measured basis (fēnix 6 Pro 0.0% `speed`/`altitude` vs Suunto 9 99.8%, same FIT format), and
  no-device-name as its own explicit category at 716 of the archive.
- `.planning/REQUIREMENTS.md` ERA-03 — delivered by Phase 26, composed here. Its fixture library is
  imported, not rebuilt.
- `.planning/ROADMAP.md` §"Phase 27" — the five Success Criteria, each with its demonstrated-failing
  clause. **Criterion 4's archive figures are stale and are amended by D-06**: it says
  "1,864-activity archive" and "≈90 activities"; the live archive measured 2026-09-10 is 1,890
  activities / 1,866 streams, with 1,890 rows in `index.json`.
- `.planning/PROJECT.md` §"Current Milestone: v2.2" — the six explicit non-goals with their reasons.
  Most binding here: `data/streams/` stays byte-identical, genuine device over-measurement is flagged
  never corrected, device `moving_time` stays the shipped aggregate, and stopped-watch correction is
  out because the stored data cannot distinguish a rest from a forgotten stop (the direct basis
  for D-14).

### Phase 26's output, consumed rather than rebuilt
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-CONTEXT.md` — the twenty
  decisions this phase inherits. Most binding: D-11 (shared `renderActivityRow`, three surfaces,
  `idPrefix`), D-12 (disclosure not suppression), D-14 (additive index fields keep
  `DASHBOARD_INDEX_SCHEMA_VERSION` at 1 — and its explicit note that Phase 27 must not pre-break that
  assertion), D-15 (analytics purity seam), D-08 (always-on coverage caption, the reasoning D-08 here
  extends).
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` — the cohort
  definition D-04 reuses verbatim as the severe-decimation threshold (>15% zero-advance samples AND
  ≥50 samples), the 154-activity cohort, and the 14-activity residual list this phase re-derives at
  its boundary. Regenerate with `npm run compute-pace-residual` (`scripts/compute-pace-residual.mjs`).
- `src/analytics/pace-derivation.ts` — the gap classifier (`classifyGaps`, `GapKind`, `GapInterval`,
  `PaceCoverage`, `advanceIntervals`, `quantile`) the gap-profile signal composes. Read its header:
  it states the Δt-integration rule, the D-06 stream-span denominator, the totality contract (any
  array-shaped input returns a zeroed result rather than throwing, T-26-01), and T-26-02's ban on
  `?? 0` / `|| 0` coercion — "insufficient data" is never a plausible-looking computed zero. D-06
  above applies that same rule to the 24 stream-less activities.
- `src/analytics/pace-fixtures.ts` — `PINNED_FIXTURES`, `PACE_FIXTURE_NAMES` and the synthetic
  builders. The device-family taxonomy in D-11 is the pinned set's `deviceFamily` values;
  `impossible-speed-sample` and `syntheticDecimationAliasedStream` are the fixtures this phase's
  signals test against.

### Code contracts this phase must not break
- `src/analytics/dashboard-index.types.ts` — the index contract. Its header states both invariants
  (browse-complete; public artifact that never copies athlete identifiers, upload ids, external ids,
  gear ids or privacy flags), the `gearName` and `paceDisagreement` additive-field precedent
  D-06-of-Phase-26 cites by name, the required-vs-`ParsedDashboardIndexRow` split and the WR-06
  reasoning behind it, and the explicit sentence "Phase 27 asserts index additivity for its own
  signals against this same precedent."
- `src/dashboard/views/list.ts` — `appendAccessibleBadge` (the single accessible badge+description
  block D-09 reuses unchanged), `appendBadge`, `appendLowConfidenceBadge`, `appendPaceDisputedBadge`,
  `rowPaceDisagreement`. Its JSDoc explains why a fourth hand-rolled badge builder is not acceptable.
- `src/dashboard/views/list-logic.ts` — the closed `SortKey` union, `SORT_KEYS`, `FilterState`,
  `DEFAULT_DIR`, and the URL parse/serialize round-trip (T-17-URL-02) D-15/D-16 extend by exactly one
  param.
- `src/dashboard/data/best-efforts-client.ts` — the lazy per-activity shard client
  (`<statsDir>/best-efforts/{id}.json`) whose pattern Criterion 2 requires `pace-quality/{id}.json`
  to mirror, and whose shape D-18's fetch counter follows.
- `scripts/verify-dashboard-publish.mjs` — asserts `schemaVersion === 1`; D-06-of-Phase-26's
  additivity discipline is enforced here.
- `src/dashboard/data/gear-client.ts` — `resolveGearLabel(gearMap, gear_id, device_name)`, the
  existing precedent for `device_name` reaching the published index via `gearName` (D-12's note).

### Prior research
- `.planning/research/PITFALLS.md` — domain traps carried into this milestone.
- `.planning/research/SUMMARY.md` — the phase-ordering rationale, including why ERA-01/ERA-02 fold
  into Phase 27 rather than becoming a phase of their own.

### Downstream consumers (do not break)
- `.planning/ROADMAP.md` §"Phase 28" — depends on Phase 27 for sequencing, not for the signal fields
  themselves ("no functional coupling ... not a hard blocker"). Phase 28 will demote efforts on some
  of the activities this phase flags.
- `.planning/ROADMAP.md` §"Phase 29" — the curation review queue, which D-16's severe-cohort filter
  anticipates and D-17's shard evidence feeds.
- `.planning/ROADMAP.md` §"Phase 30" — elevation as a sixth quality signal, which will extend this
  phase's shard and index shape.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `classifyGaps` and friends in `src/analytics/pace-derivation.ts` — the gap-profile signal is a
  summary over the classifier's existing output, not new classification logic. `RECORDING_GAP_ABS_THRESHOLD_SEC = 10`
  and `PAUSE_GAP_P90_MULTIPLIER = 5` are already justified constants.
- `quantile()` in the same file — deliberately the same R-7 implementation Phase 28's ceiling will
  reuse; its JSDoc says not to substitute a nearest-rank variant. Any percentile this phase needs
  should call it rather than hand-roll.
- `appendAccessibleBadge(container, visibleText, explanation, descriptionId)` in `list.ts` — builds a
  visible `.badge` span plus an `sr-only` description wired via `aria-describedby`. D-09 uses both
  slots exactly as designed; no new badge builder is needed.
- `isPlausible` / `MAX_SPEED_MARGIN` in `src/analytics/best-effort-utils.ts` — existing
  physically-impossible-speed logic, though it operates on effort-implied speed against
  `activityMaxSpeedMps`, not per-sample. The impossible-sample-count signal is per-sample and needs
  its own rule; check whether the constants transfer before inventing new ones.
- `src/analytics/pace-fixtures.ts` — `syntheticImpossibleSpeedStream`, `syntheticDecimationAliasedStream`,
  `syntheticRecordingGapStream`, `syntheticMultiHourPauseStream`, plus the six pinned real-archive
  fixtures with their `deviceFamily` labels. Phase 26 built these specifically so Phases 27-30 import
  rather than rebuild.
- `data/stats/{name}/{id}.json` shard convention with `best-efforts/{id}.json` as the working
  example, and `best-efforts-client.ts` as its total, never-throwing client.

### Established patterns that constrain this phase
- **Additive index fields keep `schemaVersion` at 1** — stated twice in `dashboard-index.types.ts`
  (for `gearName`, then for `paceDisagreement`), asserted by `verify-dashboard-publish.mjs`, and
  named in that header as the precedent Phase 27 must satisfy.
- **Producer type required, parsed type `Partial`** — `DashboardIndexRow` vs
  `ParsedDashboardIndexRow`. New signal fields go on the producer type as **required** (the WR-06
  reasoning: an optional key lets the compute step silently stop emitting a field with no compile
  error), and every reader handles their absence. Phase 26's CR-02 was exactly this bug shipping.
- **Δt integration, never sample count** — `CanonicalStream.t` is decimated and irregularly spaced.
  Any per-time signal (the gap profile's percentages, elapsed-vs-moving) integrates real `Δt`.
- **Never coerce insufficient data to a plausible zero** (T-26-02) — the rule D-06 applies to the
  24 stream-less activities.
- **Analytics modules are pure and client-safe** — no `fs`, no `fetch`, no DOM, because the same
  module is imported by both the browser render path and the CI compute chain.
- **A shared row renderer serves three surfaces** — `renderActivityRow` with `idPrefix`; D-10 keeps
  it branch-free.
- **Every phase closes on a human browser checkpoint** — automated gates have missed rendering
  defects in this project three times, and there is no jsdom or headless browser in the repo.

### Integration points
- `src/analytics/compute-dashboard-index.ts` — already reads `data/activities/{id}.json`, so it
  already has `device_name`, `elapsed_time` and `moving_time`: the two metadata-only signals need no
  new file read. It is also where the new scalars land on the row.
- `src/dashboard/views/detail.ts` — the detail render path; `:631` already reads
  `indexClient.getRow(detail.id)?.paceDisagreement`, and `:640-644` is the worked example of reusing
  `appendAccessibleBadge` for a stat-card badge rather than minting a new builder.
- `src/dashboard/views/detail-sections.ts` — `buildBreakdownSection` and the `Pace Distribution`
  heading with Phase 26's always-on coverage caption beneath it; D-08's quality section lands in this
  neighbourhood.
- `src/dashboard/views/list.ts` / `list-logic.ts` — badge rendering, and the sort/filter/URL-state
  brain D-15/D-16 extend by one param.
- `package.json` scripts — `compute-all-stats` is the CI chain a new compute step joins;
  `compute-pace-residual` is the D-04 cross-check invocation.

### Measurements taken during this discussion (2026-09-10, re-derivable)

| quantity | value | source |
|---|---|---|
| activities in `data/activities/` | **1,890** | `ls data/activities/*.json \| wc -l` |
| streams in `data/streams/` | **1,866** | `ls data/streams/*.json \| wc -l` |
| rows in `data/dashboard/index.json` | **1,890**, `schemaVersion: 1` | parsed |
| activities with no stream | **24** | 1,890 − 1,866 |

The roadmap, REQUIREMENTS.md and PROJECT.md all say "1,864". They are stale by 26 activities, and
the activity-vs-stream distinction (1,890 vs 1,866) is a second denominator the roadmap never
separates. D-06 requires the plan to state which one each reported rate uses.

</code_context>

<specifics>
## Specific Ideas

- The badge wording Criterion 3 itself models — `12% of elapsed time in recording gaps` — is the
  target register for D-09's visible text: a named condition with its measured value, not an
  adjective. A badge reading "poor quality" would fail Criterion 3 on its face.
- The one sentence to carry into every calibration discussion, from D-02: a threshold tuned until it
  produced ~90 activities is a quota, not a claim about the data. Criterion 4's threshold-moves-rate
  demonstration proves the knob is wired; it does not license turning it to reach a number.
- Activity `4556693525` (the pinned Phase 26 worked example, 2.44% residual) and `5059204779`
  (the PACE-07 metadata-disagreement case, 1.17% residual, 150s window) both appear in
  `26-RESIDUAL.md` and both carry a `paceDisagreement` or coverage story already. They are the
  natural first candidates for the Criterion 3 browser read-back, since a reader can check the
  quality badges against numbers Phase 26 already put on the same page.
- ERA-01's proof case is a pair, not a single activity: fēnix 6 Pro `10041312551` (0% `speed`) and
  Suunto 9 `3480808722` (99.8% `speed`) — same FIT format, different family. Both are already pinned
  fixtures with verified sample counts (939 and 1,620).

</specifics>

<deferred>
## Deferred Ideas

- **Sorting the activity list by quality tier** — considered under D-15 and deliberately left out.
  Ordering 1,890 rows by a three-value tier is near-meaningless, and adding a `SortKey` brings
  null-value semantics plus the URL round-trip's test surface. Revisit only if the filter proves
  insufficient in use.
- **Per-signal filter checkboxes and a device-family filter select** — considered under D-16.
  Per-signal filtering is truest to QUAL-02 and better for investigating one mechanism; a family
  select is the one untiered signal with obvious filter value. Both were deferred to keep
  `FilterState` to one new boolean param this phase. Phase 29's review queue is the natural place to
  revisit, since it needs to slice the flagged cohort anyway.
- **A sixth "unfixed residual" signal** — considered and rejected under D-04. The roadmap names five
  and QUAL-01 enumerates them; a sixth is scope this phase's boundary does not grant. Phase 30 adds
  elevation as the next signal.

### Reviewed Todos (not folded)

Both keyword matches from `todo.match-phase 27` were reviewed and deliberately not folded — the same
two matched Phase 26 and were declined there for reasons that still hold verbatim:

- **Garmin export adapter when export arrives** (`2026-08-10-garmin-export-adapter-when-export-arrives.md`,
  score 0.6, STREAM-04) — externally blocked on the export arriving, and it is a stream *ingestion*
  change, which this milestone's "`data/streams/` stays byte-identical" non-goal explicitly forbids.
  It is already carried in STATE.md as a next-milestone item.
- **IN-17 / IN-18 curation-guard cosmetics** (`2026-09-02-in17-in18-curation-guard-cosmetics.md`,
  score 0.4) — `scripts/lib/curation-guard.mjs` polish. Belongs with Phase 29, which is the next
  phase to touch the curation guard and already carries a criterion asserting both publish guards
  discriminate in both directions.

</deferred>

---

*Phase: 27-Per-Activity Quality Signals*
*Context gathered: 2026-09-10*
