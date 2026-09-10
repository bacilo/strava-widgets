# Phase 27: Per-Activity Quality Signals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-10
**Phase:** 27-Per-Activity Quality Signals
**Areas discussed:** Severity model & calibration, Badge density on the list, Device-era taxonomy, Sort/filter scope

**Areas offered and all selected.** Two further areas were named in the preamble but not given a
slot — shard depth and the 26-RESIDUAL cross-check — and both were folded into the four selected
areas during discussion rather than left open.

---

## Severity model & calibration

### Q1 — What is the severity tier attached to?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-signal tiers; top tier = any | Each signal carries its own none/minor/severe tier; Criterion 4's count is activities carrying at least ONE severe signal. Keeps QUAL-02 true at tier level. | ✓ |
| Per-signal tiers, per-signal budget | Each signal's severe tier independently under ~5%. Five signals each at 4.9% could still badge ~20% of rows. | |
| One activity-level tier | Five signals roll up into one calibrated tier. Collides with QUAL-02, which exists because decimation and device era correlate. | |

**User's choice:** Per-signal tiers; composite "any severe" is the calibrated number.
**Notes:** → D-01.

### Q2 — If defensible thresholds produce a composite severe rate above ~5%, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Thresholds first, rate is the finding | Thresholds derived from mechanism; the measured rate is reported, not solved for. QUAL-05 calls a high top tier a calibration failure, so the disagreement stays visible. | ✓ |
| Rate first, thresholds solve for it | Tune thresholds until the composite hits ~5%. Guarantees Criterion 4 passes, but thresholds become a quota rather than a claim about the data. | |
| Thresholds first, one bounded retune allowed | One documented retune pass with before/after thresholds and rates recorded. | |

**User's choice:** Thresholds first, rate is the reported finding.
**Notes:** → D-02. The framing that drove it: Criterion 4's "move a threshold and observe the rate
move" proves the knob is connected but says nothing about which direction it was first turned.

### Q3 — How independent must the recount be from the code that produced the flags?

| Option | Description | Selected |
|--------|-------------|----------|
| Recount from index JSON only | Verifier reads `data/dashboard/index.json` and counts with its own arithmetic; must NOT import the classifier. Bounded, honest claim: what shipped matches what was reported. | ✓ |
| Recount by re-deriving from streams | Re-runs classification and compares. Catches a stale index, but necessarily imports the same classifier so it agrees with itself on thresholds. | |
| Both, at different tiers | Index-only as the fast vitest gate; full re-derivation as an on-demand script. | |

**User's choice:** Index-JSON-only recount.
**Notes:** → D-03. Grounded in Phase 23's CR-01 lesson and this project's three shipped rendering
defects behind a green gate.

### Q4 — How does 26-RESIDUAL.md feed the decimation signal?

| Option | Description | Selected |
|--------|-------------|----------|
| Cohort = threshold, residual = cross-check | Reuse Phase 26's cohort rule (>15% zero-advance, ≥50 samples) verbatim as the severe threshold; the 14-activity residual is the boundary cross-check the roadmap requires. | ✓ |
| Residual becomes its own sixth signal | Distinct fact, but the roadmap names five and QUAL-01 enumerates them. | |
| Residual is decimation's top tier | Makes the top tier tiny, but conflates how the device recorded with whether our derivation coped. | |

**User's choice:** Cohort as threshold, residual as cross-check.
**Notes:** → D-04. Re-derivation is via `npm run compute-pace-residual`, catching drift since 2026-09-09.

---

## Badge density on the list

### Q1 — Which quality signals badge on an activity-list row?

| Option | Description | Selected |
|--------|-------------|----------|
| Severe-tier only, one badge each | Under ~5% of rows carry any quality badge, so a list badge stays a real signal on a row already carrying low-confidence, pace-disputed, PR and gear badges. Minor tier still ships in the index and badges on detail. | ✓ |
| Severe on list, all five on detail | Same list behaviour; detail badges all five unconditionally including healthy ones. | |
| One rolled-up list badge | Quietest row, but a badge that doesn't name its condition violates QUAL-04 on the surface where pace sorting ranks activities. | |

**User's choice:** Severe-tier only, one named badge each.
**Notes:** → D-07. Option 2's detail-view half was then asked separately as Q2 and adopted.

### Q2 — On the detail view, are healthy (none-tier) signals disclosed too?

| Option | Description | Selected |
|--------|-------------|----------|
| All five, always, tier-styled | Extends Phase 26's D-08 always-on coverage caption reasoning to the signals beside it; gives the checkpoint fixed numbers to read back; makes a compute step that stopped emitting a field visible. | ✓ |
| Only fired signals badge | Quieter and consistent with the existing low-confidence badge, but re-introduces the silence-as-good-news reading D-08 rejected one section earlier on the same page. | |
| All five, but collapsed by default | Middle ground, but adds an interaction the checkpoint must exercise — and gestures need a human here. | |

**User's choice:** All five, always, tier-styled.
**Notes:** → D-08.

### Q3 — Where does the "why it matters" half live?

| Option | Description | Selected |
|--------|-------------|----------|
| Value visible, why in sr-only + title | Visible text = condition + measured value (Criterion 3); `explanation` slot = why, via aria-describedby and title. Reuses `appendAccessibleBadge` unchanged. | ✓ |
| Both visible on detail, value-only on list | Strongest on QUAL-04, but the quality section becomes five paragraphs and the shared block stops being the single builder. | |
| Value visible, why in a footnote legend | Follows Phase 26's D-09 legend pattern and avoids repeating across 1,890 pages, but detaches the explanation from the badge for a screen reader. | |

**User's choice:** Value visible, why in the accessible description and title.
**Notes:** → D-09.

### Q4 — Which of renderActivityRow's three surfaces get severe-tier badges?

| Option | Description | Selected |
|--------|-------------|----------|
| All three, no exceptions | Recent PRs is the strongest case, not the weakest — a PR from a decimated or impossible-sample stream is where a caveat matters most. One code path. | ✓ |
| Activities list only | Calmer Overview, but the same activity is flagged on one screen and clean on another. | |
| Activities + Recent PRs, not Recent Activities | Introduces exactly the per-surface conditional Phase 26's D-11 warned against. | |

**User's choice:** All three surfaces.
**Notes:** → D-10.

---

## Device-era taxonomy

### Q1 — How granular is the device-era category?

| Option | Description | Selected |
|--------|-------------|----------|
| Family, matching the pinned fixtures | The set `pace-fixtures.ts` already pins by name. ERA-01's evidence is family-level, so this is the granularity the requirement's own proof operates at. | ✓ |
| Vendor-coarse (garmin / suunto / phone / intervals) | Fewer categories, but erases the distinction ERA-01 exists to preserve — and this athlete has four watches. | |
| Family + date era | Captures the real correlation (all 154 severe stair-step are 2020–2021 Suunto 9), but re-merges the two mechanisms QUAL-02 keeps separate. | |

**User's choice:** Family-level, matching the pinned fixtures.
**Notes:** → D-11.

### Q2 — How is an unrecognized device_name handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Third explicit category, raw string kept | `unrecognized-device` carrying the actual string, distinct from the 716 `no-device-name`. Never fabricates a family; a growing count signals the lookup table needs an entry. | ✓ |
| Open taxonomy — the string IS the family | No unrecognized state can exist, but the category set varies with the archive and ERA-01's branching has nothing stable to key on. | |
| Fold unrecognized into no-device-name | Matches ERA-02's literal wording, but discards a real string and makes the 716 figure unverifiable. | |

**User's choice:** Third explicit category keeping the raw string.
**Notes:** → D-12. Raised because ERA-02 names only the absent case, while Criterion 5's failure demo
is precisely about defaults quietly absorbing a category.

### Q3 — Does device era carry a severity tier at all?

| Option | Description | Selected |
|--------|-------------|----------|
| No tier — it's a labelled fact | Always on detail, never on a list row, contributes nothing to the composite rate. Keeps Criterion 4's number about data defects rather than which watch the athlete owned. | ✓ |
| Tier by known signal-shape risk | Surfaces the correlation, but an activity could be flagged severe purely for its watch even with a clean stream — the merge QUAL-02 forbids. | |
| No tier, but no-device-name is minor | Defensible, but 716 is 38% of the archive; a minor tier firing on 38% of rows carries little information. | |

**User's choice:** No tier — a labelled fact.
**Notes:** → D-13.

### Q4 — Does elapsed-vs-moving divergence tier as severe?

| Option | Description | Selected |
|--------|-------------|----------|
| Untiered fact, like device era | PROJECT.md's own non-goal: a visible signal, not an authoritative recomputation — and nothing in the data distinguishes a rest from a forgotten stop, so there is no defensible severe threshold. | ✓ |
| Tiered — divergence is worth flagging | Composite rate would then include activities that are simply long rests, and the badge could not honestly say why it matters. | |
| Tiered only when it corroborates another signal | More diagnostic, but a tier that depends on another signal is no longer independently disclosed. | |

**User's choice:** Untiered fact.
**Notes:** → D-14. Asked as the same fact-vs-defect axis Q3 had just settled. **Consequence
(D-05):** only three signals tier — decimation, impossible-sample count, gap profile — so the
composite rate Criterion 4 measures is computed over those three alone.

---

## Sort/filter scope

### Q1 — Does the phase ship sort/filter controls, or only fields plus badges?

| Option | Description | Selected |
|--------|-------------|----------|
| Filter only — no new sort key | Sorting 1,890 rows by a three-value tier is near-meaningless; filtering to the severe cohort is the action with a use, and the one Phase 29's queue will want. | ✓ |
| Fields and badges only — no controls | Narrowest reading of QUAL-03; lowest risk to the URL-state tests, but the checkpoint could only reach the flagged cohort by scrolling. | |
| Both sort and filter | Fullest reading, but new null-value sort semantics and a wider blast radius across the URL round-trip. | |

**User's choice:** Filter only, no new sort key.
**Notes:** → D-15.

### Q2 — What does the filter actually offer?

| Option | Description | Selected |
|--------|-------------|----------|
| One toggle: any severe signal | One URL param, one predicate, and it makes the calibrated number directly reachable in the browser — giving the checkpoint something to count against the dry-run report. | ✓ |
| Per-signal, three checkboxes | Truest to QUAL-02 and better for investigating one mechanism, at the cost of three params and AND/OR semantics to define and test. | |
| Any-severe toggle plus a device-family select | Family is the untiered signal with obvious filter value, but widens FilterState with a categorical dimension it has no precedent for. | |

**User's choice:** One any-severe toggle.
**Notes:** → D-16. The two rejected options are recorded as deferred ideas for Phase 29.

### Q3 — What does the shard carry that the index row doesn't?

| Option | Description | Selected |
|--------|-------------|----------|
| The evidence behind each scalar | Classified gap intervals, impossible-sample indices with implied speeds, zero-advance run profile, resolved adaptive window, resolved family with raw device_name. Makes Criterion 2's single fetch mean something. | ✓ |
| Thresholds and provenance only | Small files, but mostly identical across activities and it is metadata about the check, not QUAL-03's per-sample findings. | |
| Full per-sample arrays | Maximally inspectable, but approaches stream size across 1,890 activities for an array the detail view won't render. | |

**User's choice:** The evidence behind each scalar.
**Notes:** → D-17. Raised because the five scalars are already on the index row, so a shard fetched
for nothing would be a fetch to delete rather than to assert.

### Q4 — How is "zero fetches on list, exactly one on open" proven?

| Option | Description | Selected |
|--------|-------------|----------|
| Human network panel + an instrumented counter | Panel against a production-shaped build with a verified served digest is the only thing that catches a stale bundle; the counter test catches regressions in CI between checkpoints. | ✓ |
| Human network panel only | Cannot agree with itself, but holds only at the moment of observation. | |
| Instrumented counter test only | Cheap and always-on, but tests the module in isolation, not the assembled page. | |

**User's choice:** Both.
**Notes:** → D-18. Checkpoint hazards recorded alongside it: `127.0.0.1` alone is not sufficient
(stale staged `index.html`/`index.json`), `build-widgets` silently no-ops on locally-edited `dist`
files so the served digest is what counts, and the viewport clamps to 500..941.

---

## Claude's Discretion

No area was delegated wholesale — all sixteen questions were answered explicitly. Four areas remain
open by design and are recorded in CONTEXT.md's "Claude's Discretion" section: thresholds for
impossible-sample count and gap profile; where the compute step lives given two signals are
metadata-only; how the threshold-moves-rate demonstration is wired; and tier styling against
Phase 19's design system.

## Deferred Ideas

- Sorting the activity list by quality tier (considered under Q1 of Sort/filter scope).
- Per-signal filter checkboxes and a device-family filter select (considered under Q2) — natural
  candidates for Phase 29's review queue.
- A sixth "unfixed residual" signal (considered under Q4 of Severity) — the roadmap names five.

## Finding surfaced during discussion

The archive counts in ROADMAP.md, REQUIREMENTS.md and PROJECT.md are stale. Measured 2026-09-10:
**1,890 activities, 1,866 streams**, and 1,890 rows in `data/dashboard/index.json` at
`schemaVersion: 1`. The documents all say "1,864", and none of them separates the activity
denominator from the stream denominator — a distinction that matters because the three tiering
signals are stream-derived and 24 activities have no stream. Carried into CONTEXT.md as D-06.
