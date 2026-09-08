# Phase 21: Overview Rebuild - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 21-overview-rebuild
**Areas discussed:** Records scope toggle (OVR-03), Row hierarchy and the shared renderer (OVR-01/02), This-year figures in Headline Stats (OVR-04), The ended-streak fix (FIX-01)

**Area selection:** all four presented gray areas were selected.

---

## Records scope toggle (OVR-03)

### Q1 — Where does the all-time / current-year scope toggle actually go?

| Option | Description | Selected |
|--------|-------------|----------|
| Records screen PR tables | Scope control above the PR tables filters every distance's ranking to the current year and re-ranks. Pure client-side filter over already-loaded `best-efforts.json`. Adds Records work to a phase named "Overview Rebuild". | ✓ |
| Overview's Recent PRs card | Keeps the phase strictly on Overview, but the card shows the 5 most recent PR-carrying activities — filtering those to "this year" changes little. | |
| Both surfaces | Toggle on both. Doubles surface area and checkpoint rows; the Overview half keeps its weak-payoff problem. | |

**User's choice:** Records screen PR tables
**Notes:** Scouting established that `PRRankingEntry` already carries `startDate` and `records.ts` already loads the whole `best-efforts.json`, so no pipeline work either way. → **D-01**

### Q2 — What scopes does the control offer?

| Option | Description | Selected |
|--------|-------------|----------|
| All time / This year | Exactly the two the requirement names; maps onto the existing `.segmented` pattern. | ✓ |
| All time / This year / Last year | Three options; safe since Phase 19's CR-02 middle-option radius fix is in, but more to verify. | |
| All time plus a year dropdown | Most flexible, but sparse early years (2011 had 2 runs) produce near-empty tables across seven distances. | |

**User's choice:** All time / This year → **D-02**

### Q3 — What does the toggle affect on the Records screen?

| Option | Description | Selected |
|--------|-------------|----------|
| PR tables only | Superlatives, evolution charts and Riegel predictions stay all-time — those three have no honest year-scoped form. | ✓ |
| Whole Records screen | Most consistent reading of "the records section", but produces near-empty evolution charts and a single-year Riegel matrix. | |
| PR tables and Superlatives | Streak tiles have no year-scoped meaning, leaving an inconsistency beside the tile FIX-01 is fixing. | |

**User's choice:** PR tables only → **D-03**

### Q4 — Does the chosen scope persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Resets to all-time | View-local state; no storage, no year-rollover question. Keeps persistence a deliberate Phase 22 (CAL-01) decision. | ✓ |
| Persists via localStorage | Survives reload; matches what CAL-01 will need. Introduces a stored key with no precedent plus a rollover question. | |
| Persists in the URL hash | Shareable/bookmarkable, but `navigateTo` has no query-param contract today. | |

**User's choice:** Resets to all-time each visit → **D-04**

---

## Row hierarchy and the shared renderer (OVR-01/02)

### Q1 — How do the two Overview rows relate after the rebuild?

| Option | Description | Selected |
|--------|-------------|----------|
| One shared row renderer | "Same structure" becomes structurally true; collapses the duplicated aria-label builders. Cost: the shared renderer is also the Activities mobile card. | ✓ |
| Two renderers, one shared layout contract | Confines mobile-card risk to one renderer; "same structure" enforced by CSS convention plus a test. | |
| Fork Overview's rows off the shared renderer | Zero risk to Activities, but reverses Phase 20's D-07 and leaves the mobile card as the last three-stacked-divs surface. | |

**User's choice:** One shared row renderer → **D-05**

### Q2 — What's the deliberate hierarchy inside the row?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-line: name + right-aligned badges, meta beneath | One clear primary element; badges never wrap into metrics; degrades to narrow widths without a media query. | ✓ |
| Single line, aligned columns | Scannable like a table, but needs a mobile breakpoint and name truncation. | |
| Name/date left, distance as a display figure right | Gives each row a bold number, but distance outranks the run's name and duration/pace lose their home. | |

**User's choice:** Two-line, with this preview:

```
┌─ .activity-row ───────────────────────────────┐
│ Morning Run in Herlev          [No HR] [2 PR] │
│ 12 Aug 2026 · 10.4 km · 52:31 · 5:03 /km      │
└───────────────────────────────────────────────┘
```

→ **D-06**

### Q3 — With one shared renderer, what does a Recent PRs row show?

| Option | Description | Selected |
|--------|-------------|----------|
| Full row, badges do the differentiating | One code path, one aria-label builder; `statusBadgeTexts` already emits the PR badge. | ✓ |
| Shared renderer with a field-subset option | Preserves the PR card's lightness, but a branch inside the shared renderer is the seam that drifts. | |
| Full row, PR badge visually promoted | Strongest signal, but new tokens/CSS plus a two-theme contrast check. | |

**User's choice:** Full row, badges do the differentiating → **D-07**

### Q4 — Do two-line rows keep the bordered-card treatment?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the bordered card | Nothing about the container changes, so the focus-ring clearance and hover formula both stay intact. | ✓ |
| Flatten to a divided list | Tighter vertically, but a visual-language change on a screen Phase 19 left alone; removes the surface the hover mixes against. | |
| Keep the card, trim the list lengths | Shows less data to solve a layout problem. | |

**User's choice:** Keep the bordered card → **D-08**

---

## This-year figures in Headline Stats (OVR-04)

### Q1 — How do the this-year figures sit alongside the all-time ones?

| Option | Description | Selected |
|--------|-------------|----------|
| Two more tiles in the same grid (6 → 8) | Zero new structure; `.stat-grid` auto-fit absorbs them; every existing tile keeps its position. | ✓ |
| This-year value as a sub-label under the all-time tile | Borrows `buildSuperlativeTile`'s proven sublabel slot, but two of six tiles get a third line and the year number is subordinate. | |
| Two labelled groups: This Year / All Time | Clearest reading, but new in-card sub-headings and 18-UI-SPEC § 17 forbids a fifth type role. | |

**User's choice:** Two more tiles in the same grid → **D-09**

### Q2 — How is "this year" resolved against `yearly-stats.json`?

| Option | Description | Selected |
|--------|-------------|----------|
| Browser's current year, em-dash if absent | "This Year" always means the year the reader is in; degrades honestly on 1 January. | ✓ |
| Last entry in the file | Never shows an em-dash, but in early January labels the previous year's totals "This Year". | |
| Current year, with the year in the tile label | Self-describing, but dynamic label text that reads less naturally beside "Total Distance". | |

**User's choice:** Browser's current UTC year, em-dash if absent → **D-11**

### Q3 — Where do the two new tiles sit in the reading order?

| Option | Description | Selected |
|--------|-------------|----------|
| Appended at the end | Existing tiles keep their positions exactly. Cost: year tiles land beside the streak tiles. | ✓ |
| Paired with their all-time counterparts | Comparison is right there, but reorders familiar tiles and pairs break across grid rows. | |
| Year tiles first | Currently-relevant numbers lead, but the biggest change to a stable card. | |

**User's choice:** Appended at the end → **D-09**

---

## The ended-streak fix (FIX-01)

**Context surfaced before questioning:** the defect is two-layered — `streak-utils.ts:118` nulls the
field, *and* `records-logic.ts:276` would render the streak's start date labelled "ended" even once
that is fixed. Also flagged: `finalCurrentStreak` is forced to `0` when a streak breaks, so the tile
reads "0 days" under the new sub-label.

### Q1 — What does `ended {date}` name?

| Option | Description | Selected |
|--------|-------------|----------|
| The streak's last run day | A day something actually happened; consistent with Longest Streak's `endISO` in the same grid. | ✓ |
| The day the streak broke | More literally "when it ended", but names a day nothing happened. | |
| A range, matching Longest Streak | Most information, but the requirement specifies `ended {date}`. | |

**User's choice:** The streak's last run day → **D-13**

### Q2 — Where does that date come from?

| Option | Description | Selected |
|--------|-------------|----------|
| New explicit field in `streaks.json` | Named for what it is, unit-testable, reusable; sanctioned by REQUIREMENTS' FIX-01 exemption. Cost: absent until a compute run regenerates the file. | ✓ |
| Derive in the view from `all-time-totals.json` | Works on today's committed data with no analytics change, but encodes an unstated invariant in untestable view code. | |
| Both — field with a view fallback | Most robust across the rebuild boundary, but two code paths for one value. | |

**User's choice:** New explicit field in `streaks.json` → **D-13**

### Q3 — What does the tile's big number read when the streak has ended?

| Option | Description | Selected |
|--------|-------------|----------|
| `0 days` — unchanged | The current streak genuinely is zero; T-18-HONEST-05/02 exist to keep that real zero rendering. | ✓ |
| The ended streak's length | More informative, but needs a second new field and makes "Current Streak" show a non-current number. | |
| `0 days` with the length in the sub-label | Keeps the honest zero, but still needs the extra field and departs from the `ended {date}` wording. | |

**User's choice:** `0 days` — unchanged → **D-14**

### Q4 — Does Overview's Current Streak tile get the sub-label too?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — both tiles | Overview would otherwise show a bare "0 days" on the screen this phase exists to fix. `buildStatCard` gains the optional sublabel `buildSuperlativeTile` already has. | ✓ |
| Records tile only | Literal reading of FIX-01 and SC5; smallest change, but leaves Overview unexplained. | |
| Both, and unify the two tile builders | Cleanest end state, but touches all four Superlatives tiles beyond the one FIX-01 names. | |

**User's choice:** Yes — both tiles → **D-15**

### Q5 — How do we produce an ended streak for the browser checkpoint?

| Option | Description | Selected |
|--------|-------------|----------|
| Staged-build fixture edit | The plan 20-18 precedent; limitation already understood and recorded. Requires serving via `127.0.0.1`, not `localhost:8099`. | ✓ |
| Committed fixture dataset | Durable and re-verifiable, but new serving path plus a publish-verifier question for one checkpoint row. | |
| DevTools override at checkpoint time | Zero repo footprint, but nothing reproducible afterwards. | |

**User's choice:** Staged-build fixture edit → **D-16**

---

## Claude's Discretion

Delegated in the per-area close-out prompts, and recorded in CONTEXT.md's Claude's Discretion
section:

- Rank re-numbering within the year scope (default: re-rank 1..N) and the empty-year table state
  (default: reuse `buildPrTableEmptyState`).
- Exact placement and labelling of the scope control relative to `.records-jump` and the section
  heading; whether it is a `.segmented` group or another Phase 19-styled control.
- The fate of the now-redundant `recentPrRowAriaLabel` / `recentPrBadgeText` exports and their tests.
- Flex/grid mechanics of the two-line row, badge wrap behaviour at narrow widths, new sub-element
  class names (existing class contracts frozen).
- Number formatting for the two new tiles and the `totalMovingTimeMin` → hours conversion.
- The name and placement of the new `StreakResult` field, and how the shared renderer composes its
  accessible name.
- Test `describe` grouping and placement of new rules in `styles.css`.

## Deferred Ideas

Full list in CONTEXT.md `<deferred>`. Raised or carried forward during this discussion:

- Joining activity names into the Records row types (carried from Phase 20's D-05).
- Unifying `buildStatCard` and `buildSuperlativeTile`.
- A promoted/accent PR badge variant.
- Year scope beyond two options, or scoping Superlatives / evolution charts.
- Persisted view preferences (deliberately left to Phase 22's CAL-01).
- Showing the ended streak's length.
- A committed ended-streak fixture dataset with a documented serving path.
- The PR-progression Improvement column sign bug (`records.ts:650-651`) — in a file this phase edits,
  but in a table D-03 leaves out of scope.
- GAP 8 from Phase 19 (Leaflet panes over the nav).

### Reviewed Todos (not folded)
- "Exclusion tickbox via local curation mode" (score 0.6, keyword-only match) — CUR-01, Phase 24.
- "Garmin export adapter when export arrives" (score 0.2) — STREAM-04, blocked on the export.
