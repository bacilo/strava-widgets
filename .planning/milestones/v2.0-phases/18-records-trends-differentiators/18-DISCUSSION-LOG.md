# Phase 18: Records, Trends & Differentiators - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 18-records-trends-differentiators
**Areas discussed:** Records page composition, PR lists & evolution form, Age-grading & predictions, Athlete profile inputs, TRIMP / training load, Trends chart set & controls, Gear-aware trends, Build-time vs client-side compute

**Mode note:** All 8 offered gray areas were selected. Questions were grouped 2–3 per turn (independent questions batched, branching questions asked singly) rather than the default 4-single-turns-per-area, with the user's agreement offered up front.

**Side request handled during discussion:** the user asked whether Phase 17's work could be pushed and redeployed so they could use it while Phase 18 was being planned. Found 93 unpushed commits and a live site built from `64046a5` — the entire detail view, calendar, filters, pagination and both Phase 17 gap fixes were unpushed. Pushed `2db92b9..28646f5` to origin/master and dispatched the workflow (it triggers on schedule/dispatch only, not on push). Run `31515495557` succeeded (2m40s), Pages deployment `31515716247` succeeded.

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Agree — fold neither | Exclusion todo already shipped in Phase 16; Garmin export still hasn't arrived | ✓ |
| Fold the exclusion todo — override UI | Build a UI to manage PR exclusions on the Records page | |
| Fold the Garmin adapter todo | Plan the adapter as a ride-along in this phase | |

**User's choice:** Agree — fold neither.
**Notes:** Both remain in `.planning/todos/pending/`. The exclusion todo should be moved to `completed/` — flagged in Phase 17 too, still undone.

---

## Records page composition

### REC-05 placement

| Option | Description | Selected |
|--------|-------------|----------|
| Records — a record is a record | All record-shaped items on Records; Trends stays purely evolution | |
| Trends — they're volume aggregates | Records exclusively PR-driven; totals and streaks move to Trends | |
| Split — superlatives on Records, totals on Trends | Follows what each number is *for* rather than where it comes from | ✓ |

### Internal organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single scrolling page, anchored sections | One scroll with a sticky jump list, no extra routing | |
| Sub-tabs, URL-encoded | Both pages tabbed via hash query string per 17-D07 | |
| Scrolling Records, tabbed Trends | Asymmetric, matching the actual weight of each page | ✓ |

### Detail-view PR treatment (REC-04's only new part)

| Option | Description | Selected |
|--------|-------------|----------|
| Named badges per distance | 'PR — 5k' badges in the stats header instead of a count | |
| Best-efforts panel with PRs marked | All seven distances listed, PR rows highlighted | |
| Both — header badge plus panel | Badges for recognition, panel for depth | ✓ |

**Notes:** Established during this area that REC-04's list and overview badges already ship (`list.ts:130`, `overview.ts:95`), so only the detail side is new work.

---

## PR lists & evolution form

**Data presented before the questions:** rankings are top-10 per distance; 6–21 PR-setting efforts per distance (78 total); marathon has zero entries; no low-confidence effort reaches any top-10, though 180 exist archive-wide.

### PR list shape

| Option | Description | Selected |
|--------|-------------|----------|
| One row per distance, expandable to top-10 | Compact by default | |
| Full top-10 tables, all distances visible | Seven stacked tables, 70 rows, no interaction needed | ✓ |
| Distance selector, one table at a time | Short section regardless of distance count | |

### PR evolution form

| Option | Description | Selected |
|--------|-------------|----------|
| Step chart — PR time over the years | Shape only, needs a selector | |
| Progression table — one row per record broken | Precise numbers, no Chart.js | |
| Both — chart with the table beneath | Most complete, roughly double the work | ✓ |

### Low-confidence and excluded efforts

| Option | Description | Selected |
|--------|-------------|----------|
| Badge in place, never hidden | Markers and reasons shown inline | ✓ |
| Excluded hidden, low-confidence badged | Footnote names how many were withheld | |
| Both hidden, with a toggle | Clean by default, revealed on demand | |

### Evolution scope follow-up (asked after the above)

| Option | Description | Selected |
|--------|-------------|----------|
| One distance at a time, selector above | Bounded section, one live chart | |
| All distances on one chart | Cross-distance comparison, needs log scale | |
| Small-multiples grid, tables on demand | Seven compact charts, most scannable, most work | ✓ |

**Notes:** Flagged to the user that full tables plus a seven-chart grid makes the scrolling Records page long, promoting the sticky jump list from nicety to load-bearing. Accepted.

---

## Athlete profile inputs

### File shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend athlete.json, one file | birthDate, sex, restingHr alongside maxHr and hrZones | ✓ |
| Extend it, but split by concern | Nested physiology / demographics sections | |
| Separate profile file | data/config/profile.json for identity data | |

### Missing/placeholder behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the panel entirely (17-D31 precedent) | Silent hiding, no placeholder | |
| Hide it, but surface an actionable notice | Names the file and field to fill in, per commit c502537 | ✓ |
| Render with visible placeholder values | Show shape immediately, marked unverified | |

---

## Age-grading & predictions

**Data presented before the questions:** all three road PRs (5k/10k/half) come from one activity — `7827165619`, a 21.35 km run on 2022-09-18, so 5k and 10k are splits inside a half. Fitted exponent across them is 1.032, an artifact of near-constant pace. Short PRs are all 2019; cross-group exponents are 1.16–1.38 vs textbook 1.06. Also flagged the local `best-efforts.json` as stale (pre-exclusions).

### WMA coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Road distances only | 5k/10k/half/marathon, smallest table, no judgement calls | |
| Road + track, 1k omitted | Adds 400m and mile, two tables with different provenance | |
| All seven, interpolating 1k | Full coverage, one derived non-standard value | ✓ |

### Riegel basis

| Option | Description | Selected |
|--------|-------------|----------|
| Standard 1.06 from each PR, shown as a matrix | Disagreement becomes visible information | (folded into Claude's decision) |
| Standard 1.06 from your best recent PR only | One prediction row, requires choosing a seed | |
| Both standard and athlete-fitted exponent | Interesting but the current fit is degenerate | (folded into Claude's decision) |

**User's choice:** *"Not sure. Whatever you think is best. By default I feel like 'the more the merrier'."*
**Claude's decision:** matrix at 1.06 as primary, plus a secondary fitted exponent that displays its value, names the distances fitted over, and self-suppresses when the fitting set spans fewer than 3 distinct activities. Delivers "more" without the extra material being quietly wrong.

### Surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Columns in the top-10 PR tables | Age-grade inline everywhere | (partially) |
| Dedicated 'Race Predictions' section | Both derived numbers in one labelled home | (partially) |
| Age-grade as a column, predictions in their own section | Follows what each number actually is | ✓ (Claude's decision) |

**User's choice:** *"You decide."*
**Claude's decision:** age-grade is a property of a specific effort → inline column; Riegel is a model output → its own anchored section.

---

## TRIMP / training load

### Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Edwards zone-based — reuses your zones | Needs nothing new in athlete.json, fully transparent | (default) |
| Banister exponential — the standard | Needs restingHr and sex, sharper TSB swings | (toggle) |
| Both, Edwards as default | Tests whether the picture is robust to the model | ✓ |

### No-HR activities

| Option | Description | Selected |
|--------|-------------|----------|
| Skip, and mark the gap honestly | Load decays, thin-coverage spans shaded | ✓ (Claude's decision) |
| Estimate from duration and pace | Continuous series, mixes two units | |
| Start the chart where HR coverage begins | Clean but hides 2011–2016 | |

**User's choice:** *"Not sure. I don't want to delete activities but I want to make sure those absences are visible and not 'made up'. Do what you think is best."*
**Claude's decision:** option 1. It is the only one that neither invents values (option 2) nor removes activities from view (option 3). Recorded in CONTEXT.md as a **hard constraint** governing D-07, D-13, D-15 and D-18, not a local preference.

---

## Build-time vs client-side compute

| Option | Description | Selected |
|--------|-------------|----------|
| Streams to build, index-derivable to client | Minimum new pipeline surface | ✓ (Claude's decision, extended) |
| Everything precomputed to data/stats/ | Views become pure renderers, more CI steps | |
| Precompute anything reused across views | Judged case by case during planning | |

**User's choice:** *"Whatever you think makes most sense."*
**Claude's decision:** option 1, extended with one addition — age-grading also becomes a build step, because its inputs are `birthDate` and `sex`, and precomputing keeps identity inputs out of the served payload (the 16-D09 public-artifact discipline). Riegel stays client-side since it needs no personal data.

---

## Gear-aware trends

**Data presented before the questions:** gear coverage is zero before 2020, ~100% for 2021–2025, and 19% in 2026 — the intervals.icu pipeline carries no `gear_id`, so coverage degrades going forward. 1,160/1,868 total, 16 shoes, all names blank.

### Plumbing

| Option | Description | Selected |
|--------|-------------|----------|
| Resolved gear *name* in the index | Honors the no-ids rule, makes gear filterable | |
| Separate precomputed aggregate file | Index untouched, gear invisible to the browser | |
| Both — name in the index, aggregate for the charts | Settles the deferred 'gear as an index field' question | ✓ |

### Missing-gear eras

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit 'Unknown' bucket, coverage stated | Absence shown, 2026 erosion stays visible | ✓ |
| Scope the section to tracked runs only | Cleanest charts, hides the degradation | |
| Unknown bucket plus a flagged pipeline gap | As above, plus a recorded follow-up | (follow-up adopted separately) |

**Notes:** The user chose option 1; the intervals.icu gear gap was recorded as a deferred follow-up anyway, since it aligns with the chosen visibility principle without expanding scope.

---

## Trends chart set & controls

| Option | Description | Selected |
|--------|-------------|----------|
| Five tabs, per-tab controls | Each tab independently understandable | ✓ |
| Five tabs, one shared date range | Strong cross-referencing, every chart must handle any range | |
| Four tabs, year heatmap folded into Volume | Fewer, denser tabs, gear inside Cadence & HR | |

**Notes:** The chosen option left the year heatmap's placement unstated; Claude placed it in the Volume tab (D-04) beside the charts it visualizes.

---

## Claude's Discretion

Areas the user explicitly deferred:
- Riegel prediction basis — resolved as a 1.06 matrix plus a self-suppressing fitted exponent.
- Where age-grade and Riegel numbers surface — resolved as inline column vs dedicated section.
- No-HR activity handling — resolved as skip-and-shade, per the user's stated no-invention rule.
- Build-time vs client-side split — resolved as streams-and-identity to build, index-derivable to client.

Areas left open for planning (recorded in CONTEXT.md § Claude's Discretion): new file schemas and names, the fitted-exponent regression subset, training-load default window and thin-coverage visual treatment, section and tab ordering, step-chart y-axis treatment, empty/loading states, hover-crosshair adoption, pure-logic module decomposition, and Chart.js instance lifecycle across tab switches.

## Deferred Ideas

- Teaching the intervals.icu adapter to carry gear (the 2026 coverage gap is a pipeline problem, not a presentation one).
- Filtering or grouping the activity browser by shoe (D-17 makes it cheap; the UI is out of scope).
- Personal route-segment detection (REC-08, Future set).
- Native device-recorded laps table (DETAIL-06, blocked on FIT lap-marker recovery).
- Pace/speed colour coding along route polylines (PROJECT.md future vision).

## Developer follow-up actions (not phase-gating)

- Fill in the 16 shoe names in `data/config/gear.json`.
- Replace the placeholder `maxHr: 190` and zone boundaries in `data/config/athlete.json`, and add `birthDate`, `sex`, `restingHr` once D-12's schema lands.
- Move `.planning/todos/pending/2026-08-10-manual-exclusion-of-activities-from-best-efforts.md` to `completed/`.
