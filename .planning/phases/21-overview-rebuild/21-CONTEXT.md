# Phase 21: Overview Rebuild - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Overview's two row lists get real structure and one shared renderer; Headline Stats gains
this-year figures; a records scope toggle lands; and the Current Streak tile's `ended {date}`
sub-label becomes reachable for the first time.

**The phase name understates its reach — read this before treating Records work as scope creep.**
Two of the five requirements resolve onto the **Records screen**, not Overview:

- **OVR-03** (scope toggle) — Overview has no records section, and the app's only PR tables are
  `records.ts:436`'s seven per-distance tables. Discussion resolved the toggle onto those
  (**D-01**).
- **FIX-01** (`ended {date}`) — the sub-label lives at `records.ts:298-299`, inside the
  Superlatives grid. Overview's own Current Streak is a plain `buildStatCard` with no sub-label
  slot at all; **D-13** brings it into scope as well.

Surfaces in scope:

- **Overview** (`overview.ts`) — `renderRecentPrRow` (`:118`) is retired in favour of one shared
  renderer; `buildRecentActivitiesCard` (`:195`) follows it; `buildHeadlineStatsCard` (`:143`)
  grows two tiles; `buildStatCard` (`:45`) gains an optional sub-label.
- **Activities mobile card** (`list.ts` `renderActivityRow`, `:325`) — carried along by the shared
  renderer, per Phase 20's D-07 seam. A second screen changes; this is intended, not incidental.
- **Records** (`records.ts`) — a scope control above the PR tables section, and the Current Streak
  tile's sub-label.
- **Analytics** (`streak-utils.ts`) — one new field on `StreakResult` / `streaks.json`. REQUIREMENTS
  freezes the analytics layer *except* for FIX-01/FIX-02 and CUR-01, so this is sanctioned.

**Not in scope:** the row *semantic* (Phase 20 owns it — every row named here is already a working
`<a href>` with a curated `aria-label`; build inside the link, do not rewrite it), calendar week
start (Phase 22), Trends zoom/pan (Phase 23), local curation mode (Phase 24), FIX-02, VER-01,
CI-01/CI-02.

</domain>

<decisions>
## Implementation Decisions

### Records scope toggle (OVR-03)

- **D-01: The toggle lands on the Records screen's PR tables, not on Overview.** OVR-03's "the
  records section" has no referent on Overview: `buildRecentPrsCard` (`overview.ts:167`) derives
  from `row.prCount` and slices the 5 most recent PR-carrying activities, so filtering it to "this
  year" is close to a no-op — recent PRs are already recent, and "all time" is already what it
  shows. The only surface in the app where *records* means a table worth scoping is
  `buildPrTablesSection` (`records.ts:567`). Recorded explicitly because a later agent reading only
  the phase name would reasonably conclude the opposite.
  - No new data and no pipeline work: `PRRankingEntry` already carries `startDate`, and
    `records.ts` already loads the whole `best-efforts.json` (2.8 MB) for the evolution section. A
    year scope is a client-side filter plus a re-rank over data already in memory.

- **D-02: Exactly two scopes — All time / This year.** The two the requirement names, no more. Maps
  cleanly onto the existing `.segmented` pattern (`detail-charts.ts:257-276`: a `role="group"` with
  `.segmented__option` / `.segmented__option--active` buttons), which is the Phase 19 control
  treatment the ROADMAP criterion asks for. A full year dropdown was declined: sparse early years
  (2011 has 2 runs) would produce near-empty or single-row tables across seven distances. A
  three-option group was declined as unearned surface — Phase 19's CR-02 middle-option radius fix is
  in, so it would be *safe*, just not justified.

- **D-03: The toggle scopes the PR tables only.** Superlatives, the PR-evolution charts and the
  Riegel predictions stay all-time. Those three have no honest year-scoped form: an evolution chart
  scoped to one year is a chart of one or two points, a Riegel matrix built from a single year's
  bests would mislead, and two of Superlatives' four tiles (Current Streak, Longest Streak) have no
  year-scoped meaning at all — which would land an inconsistency directly beside the tile FIX-01 is
  fixing in this same phase. The control sits with the section it visibly governs.

- **D-04: The scope does not persist — every arrival at `#/records` starts all-time.** View-local
  state only. No storage key, nothing to invalidate at year rollover (a persisted "this year"
  silently means a different year in January), and all-time is the honest default for a screen
  called Records. Deliberate second reason: **Phase 22's CAL-01 explicitly requires persistence for
  week-start.** Leaving this transient keeps the storage mechanism a considered Phase 22 decision
  rather than a precedent set here by accident. A URL-hash scope was also declined — `navigateTo`
  (`router.ts:171-177`) is the only sanctioned hash writer and has no query-param contract today.

### Row structure and the shared renderer (OVR-01, OVR-02)

- **D-05: One shared row renderer covers Recent PRs, Recent Activities and the Activities mobile
  card.** `renderRecentPrRow` (`overview.ts:118`) is retired into the shared path rather than
  restructured in parallel. OVR-02's "follow the same structure" then holds *structurally* instead
  of being maintained by hand, and it collapses today's duplicated accessible-name builders —
  `recentPrRowAriaLabel` (`overview.ts:101`) and `activityRowAriaLabel` (`list.ts:292`) differ only
  in which badge array they fold. This is Phase 20's D-07 reasoning applied one level up ("two live
  models for the same visual row is precisely the inconsistency this phase exists to remove").
  - **Consequence the planner must plan for, not discover:** the shared renderer *is* the Activities
    mobile card view. Three surfaces change from one edit, and the mobile card needs its own
    checkpoint rows.

- **D-06: Two-line hierarchy — name plus right-aligned badges, meta beneath.** The developer
  selected this shape:

  ```
  ┌─ .activity-row ───────────────────────────────┐
  │ Morning Run in Herlev          [No HR] [2 PR] │
  │ 12 Aug 2026 · 10.4 km · 52:31 · 5:03 /km      │
  └───────────────────────────────────────────────┘
  ```

  One unambiguous primary element per row; badges pushed right and never wrapping into the metrics;
  degrades to narrow widths without a media query — which matters *because* this renderer is the
  mobile card. Reuses `.activity-row__name` / `.activity-row__meta` and the existing type roles;
  18-UI-SPEC § 17 forbids inventing a fifth. Today's flat `flex-direction: row; flex-wrap: wrap`
  (`styles.css:338-346`) is what produces the "three stacked divs" complaint OVR-01 names.
  - A single-line aligned-column grid was declined (needs a mobile breakpoint and name truncation,
    both new behaviours with their own accessibility questions). A distance-as-display-figure layout
    was declined (distance would outrank the run's name, and duration/pace lose their home).

- **D-07: Recent PRs rows show the full field set; the badges do the differentiating.** A PR row
  renders name, date, distance, duration and pace, with the PR badge sitting among the status badges
  `statusBadgeTexts` (`list.ts:212`) already emits — it already emits `` `${row.prCount} PR` ``.
  OVR-01's four named fields are all present; duration and pace are additions, not omissions. The
  card's own heading says what the list is, so the badge is confirmation rather than the sole signal.
  - A field-subset option argument was declined explicitly: a branch inside the shared renderer is
    exactly the seam that drifts, and the accessible-name builder would have to branch with it.
  - A promoted/accent PR badge variant was declined for this phase: new tokens plus a two-theme
    contrast check is the class of work Phase 19's checkpoints repeatedly caught.

- **D-08: The bordered-card row treatment is unchanged.** Rows keep `styles.css:338-346` — surface
  fill, 1px border, 8px radius, `--space-md` padding, 8px `.activity-list` gap. Two-line rows are
  taller and ten of them make a long card; that is a look-at-it-in-the-browser judgement, not a
  pre-emptive one. Two supporting facts: the 8px gap is the clearance Phase 20's **D-11** cited for
  the 4px focus ring, and the `--surface` fill is what Phase 20's **D-09** hover formula
  (`color-mix(in srgb, var(--surface) 92%, var(--text))`) mixes against — flattening to a divided
  list would quietly undermine both. Trimming `RECENT_ACTIVITY_COUNT` (`overview.ts:19`) to solve a
  layout problem by showing less data was also declined.

### This-year figures in Headline Stats (OVR-04)

- **D-09: Two more tiles in the same `.stat-grid`, appended at the end.** The grid goes 6 → 8:
  Total Distance, Total Runs, Total Hours, Total Elevation, Current Streak, Longest Streak,
  Distance This Year, Hours This Year. `buildStatCard` is unchanged (beyond D-13's optional
  sub-label), `.stat-grid`'s auto-fit columns absorb the additions, and Phase 19's D-13 `--space-lg`
  gap already applies. Every existing tile keeps its position, so nothing the developer already
  knows moves. Pairing each year figure with its all-time counterpart, and leading with the year
  tiles, were both declined for that reason. A labelled two-group split ("This Year" / "All Time")
  was declined as new in-card structure needing sub-headings 18-UI-SPEC § 17 has no type role for.

- **D-10: Sourced from `yearly-stats.json` — no pipeline work.** The file is already published and
  already fetched by `trends.ts:1167` from the same `STATS_BASE_URL`, and each entry carries
  `totalKm` and `totalMovingTimeMin`. OVR-04 is one more `fetchStatsJson` call in `overview.ts`,
  individually try/catch-guarded like the existing two so a missing file degrades this card alone.

- **D-11: "This year" is the browser's current UTC year, em-dash when absent.** Resolve the current
  year from the client clock and match it against `periodLabel`; fall back to the existing em-dash
  placeholder when there is no entry. On 1 January the two tiles read `—` until the year's first run
  lands and the nightly rebuild writes the entry — honest rather than wrong, and it reuses the
  degradation path the card already has. Taking the file's last entry regardless of the clock was
  declined: in early January it would label the previous year's totals "This Year", which is the
  silently-wrong-number failure mode the T-18-HONEST rules exist to prevent.

### The ended-streak fix (FIX-01)

- **D-12: The defect is two-layered, and fixing only the layer the requirement names would ship a
  confidently wrong date.**
  1. `streak-utils.ts:118` sets `currentStreakStart: withinCurrentStreak ? currentStreakStart : null`
     — so the field the view reads is `null` precisely when the sub-label needs it. This is the root
     cause REQUIREMENTS and the ROADMAP both cite.
  2. **Not previously recorded:** `records-logic.ts:274-278` maps that same
     `currentStreakStart` onto `endedISO`. Even with layer 1 fixed, `records.ts:299` would render
     the streak's **start** date labelled `ended`. Both layers must be fixed together.

- **D-13: `ended {date}` names the streak's last run day, sourced from a new explicit field.**
  - **Which date.** The last day a run happened during that streak — a day something actually
    occurred, consistent with the Longest Streak tile's `endISO` sitting in the same grid. The
    break day (last run + 1) was declined as naming a day nothing happened; a full range was
    declined because the requirement and the existing code both specify `ended {date}`.
  - **Where it comes from.** `streak-utils` emits a new `currentStreakEnd` alongside the existing
    fields; `StreakResult` (`streak-utils.ts:11-18`) and `streaks.json` both gain it;
    `selectCurrentStreak` (`records-logic.ts:268`) reads it directly instead of misreading
    `currentStreakStart`. Named for what it is, unit-testable in `streak-utils`'s existing suite,
    and reusable. **The field is absent until a compute run regenerates `streaks.json`, so the view
    must degrade to no sub-label meanwhile** — plan for that, do not assume the field is present.
  - **What was declined and why it matters.** Deriving the date in the view from
    `all-time-totals.json`'s `lastActivityDate` would work today with no analytics change (when a
    streak is broken, the archive's last activity *is* that streak's final day, because
    `withinCurrentStreak` is false precisely when that date is more than a day ago) — but it encodes
    that invariant in view code where nothing states it, and it is untestable as a unit. That
    implicit-coupling shape is what produced this bug in the first place. A both-paths fallback was
    declined as two code paths for one value that can silently diverge.

- **D-14: The tile's big number stays `0 days`.** When a streak breaks, `finalCurrentStreak` is
  forced to `0` (`streak-utils.ts:112`), so the tile reads "0 days / ended 3 Aug 2026". The current
  streak genuinely *is* zero, and T-18-HONEST-05 / T-18-HONEST-02 exist specifically to keep that
  real zero rendering rather than being swallowed; the sub-label supplies the context the zero lacks,
  which is exactly the job FIX-01 gives it. Showing the ended streak's length instead was declined:
  it needs a second new field (the pre-reset length, which `streak-utils` currently discards) and it
  would make a tile labelled "Current Streak" display a number that is not the current streak.

- **D-15: Both Current Streak tiles get the sub-label — Records *and* Overview.** `records.ts:298`
  has the slot already. Overview's `buildStatCard` (`overview.ts:45`) has none, so it gains the
  optional third-line parameter `buildSuperlativeTile` (`records.ts:224`) already has. Without this,
  Overview would show a bare unexplained "0 days" on the very screen this phase exists to fix, while
  the Records tile beside it explains itself. Overview already fetches `streaks.json`, so there is
  no new data work. Collapsing `buildStatCard` and `buildSuperlativeTile` into one helper is the
  cleaner end state but was declined for this phase — it would touch all four Superlatives tiles
  beyond the one FIX-01 names, widening the checkpoint on a screen already changing for OVR-03.

- **D-16: The ended state is produced for the checkpoint by a staged-build fixture edit.** The live
  archive's streak is **active** (`streaks.json`: `withinCurrentStreak: true`, `currentStreak: 2`),
  so the `ended` branch cannot be observed against real data. Before the checkpoint, edit the staged
  build's `data/stats/streaks.json` — `withinCurrentStreak: false`, `currentStreak: 0`,
  `currentStreakEnd` set — observe both tiles, then let the next `npm run build-widgets` overwrite
  it. This is exactly the precedent plan 20-18 set to produce a badge-carrying row for R26, and its
  limitation (fixture-induced, not organic archive data) is already understood and recorded.
  - **Known trap, stated so the checkpoint does not silently verify the old value:** serve the
    staged build via **`127.0.0.1`, not `localhost:8099`** — localhost has served stale
    `index.html` / data files in this project's checkpoints before.
  - A committed fixture dataset plus a serving path was declined as real infrastructure for one
    checkpoint row, with a `verify-dashboard-publish.mjs` `assertNoPrivateArtifacts` question
    attached. A DevTools response override was declined as leaving nothing reproducible, which is
    weak for a project whose validation records cite bundle hashes.

### Claude's Discretion

- Rank re-numbering under the year scope (default: re-rank 1..N *within* the scope — a "This year's
  records" table showing ranks 4, 9, 17 would be incoherent) and how distances with no efforts this
  year render (default: reuse the existing `buildPrTableEmptyState`, `records.ts:324`).
- Exactly where the scope control sits relative to the `.records-jump` nav and the section heading,
  and whether it needs its own `aria-label` beyond the `.segmented` `role="group"` pattern.
- Whether the scope control is a `.segmented` group or another Phase 19-styled control, provided it
  uses existing tokens and introduces no new control component.
- The fate of the now-redundant `recentPrRowAriaLabel` / `recentPrBadgeText` exports
  (`overview.ts:83-105`) and their existing tests — retire, re-point, or keep as thin wrappers.
- The exact flex/grid mechanics of D-06's two-line row, badge wrap behaviour at narrow widths, and
  the class names for any new sub-elements (existing class contracts are frozen — `.activity-row`,
  `.activity-row__name`, `.activity-row__meta`, `.badge` keep their names).
- Number formatting for the two new tiles, matching the card's existing conventions
  (`toFixed(1)` km, `Math.round` hours) and converting `totalMovingTimeMin` to hours.
- The name and placement of the new `StreakResult` field, and how the shared row renderer's
  accessible name is composed now that one builder serves all three surfaces.
- How new assertions are grouped into `describe` blocks and where new rules land in `styles.css`
  (Phases 17/18/19/20 each appended a banner-commented section with a stated class contract).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone constraints
- `.planning/ROADMAP.md` § Phase 21 — the goal, the six success criteria. **Criterion 6 is the
  mandatory human browser checkpoint**, served under `/strava-widgets`.
- `.planning/REQUIREMENTS.md` — OVR-01, OVR-02, OVR-03, OVR-04, FIX-01. Also read the
  **Verification Note**: every requirement in v2.1 is visual or interactive, this project has
  shipped rendering defects behind a green automated gate three times, and **no success criterion
  here can be discharged by `npm test`** — there is no jsdom and no headless browser in this repo.
  Also read the Out of Scope entry freezing the analytics layer *except* for FIX-01/FIX-02 and
  CUR-01 — D-13's new field is covered by that exemption.

### Binding decisions from prior phases
- `.planning/phases/20-row-click-interaction-pattern/20-CONTEXT.md` — **D-08** (Phase 20 owns the
  row *semantic*, Phase 21 owns the row *contents*: every row here is already a working
  `<a class="activity-row">` — restructure inside the link, do not rewrite the interaction),
  **D-07** (`renderActivityRow` is the shared Overview/mobile-card seam, the highest-risk edit),
  **D-04** (curated `aria-label` shape `{name}, {date}, {distance} km`), **D-09** (the row hover
  formula D-08 above preserves), **D-11** (focus-ring clearance from the 8px `.activity-list` gap),
  **D-06** (the bare-`a` link rule), and the deferred-ideas entry naming the activity-name join as
  Phase 21-shaped work.
- `.planning/phases/19-design-system-control-styling/19-CONTEXT.md` — **D-14** (Overview got
  styling-only in Phase 19 *because* its structural problems were reserved for this phase),
  **D-13** (`--radius-panel` / `--radius-control` tokens, `.stat-grid` gap pulled to `--space-lg`),
  **D-01/D-02/D-03** (the control baseline the scope toggle inherits), **D-09/D-10/D-12** (the
  two-tone focus ring, kept global and unscoped).
- `.planning/phases/19-design-system-control-styling/19-UI-SPEC.md` — focus-ring contrast record
  and control contracts.
- `.planning/phases/18-records-trends-differentiators/18-UI-SPEC.md` — **§ 17 forbids a new spacing
  scale or a fifth type role** (binds D-06 and D-09); § 2 defines the PR tables D-01/D-03 scope.
- `.planning/phases/17-activity-browser-detail-views/17-UI-SPEC.md` — the `.activity-table`,
  `.activity-row` and `.cta` class contracts ("do not rename these classes downstream"); § 5
  Cross-Surface focus management governs post-navigation focus.
- `.planning/phases/16-dashboard-shell-data-contract/16-UI-SPEC.md` — 16-D04: `styles.css` is the
  single source of design tokens, linked from `index.html`, never imported from TypeScript.

### Files this phase changes
- `src/dashboard/views/overview.ts` — `buildStatCard` (`:45`, gains optional sub-label, D-15),
  `recentPrBadgeText` / `recentPrRowAriaLabel` (`:83-105`, likely retired by D-05),
  `renderRecentPrRow` (`:118`, retired into the shared renderer), `buildHeadlineStatsCard`
  (`:143`, two new tiles + streak sub-label), `buildRecentPrsCard` (`:167`),
  `buildRecentActivitiesCard` (`:195`), and the `mount` fetch trio (`:242-246`, gains
  `yearly-stats.json`).
- `src/dashboard/views/list.ts` — `renderActivityRow` (`:325`) becomes the shared two-line renderer;
  `activityRowAriaLabel` (`:292`), `statusBadgeTexts` (`:212`), `composeRowAriaLabel` (`:266`).
- `src/dashboard/views/records.ts` — `buildSuperlativeTile` / `buildSuperlativesSection`
  (`:224-306`, the FIX-01 sub-label at `:298-299`), `buildPrTablesSection` (`:567`) and
  `buildPrTableSection` (`:539`) for the D-01 scope control, `buildPrTableEmptyState` (`:324`).
- `src/dashboard/views/records-logic.ts` — `selectCurrentStreak` (`:268`, the D-12 layer-2 bug),
  `buildPrTableRows` (`:101`) and/or a new year-filter+re-rank function.
- `src/analytics/streak-utils.ts` — `StreakResult` (`:11-18`) and the return at `:114-121`
  (`currentStreakStart` nulled at `:118`).
- `src/dashboard/styles.css` — the D-06 row layout and the D-09 grid, in a Phase 21 banner-commented
  block with a stated class contract.
- Test suites: `styles.test.ts`, `row-semantics.test.ts`, `records-logic.test.ts`,
  `list-logic.test.ts`, and `streak-utils`'s suite (the only place D-13's new field is genuinely
  unit-provable).

### Read-only but affected
- `src/dashboard/views/trends.ts` (`:1167`) — the existing `yearly-stats.json` consumer; D-10 copies
  its fetch shape.
- `data/stats/streaks.json`, `data/stats/yearly-stats.json`, `data/stats/all-time-totals.json` —
  live data shapes; `streaks.json` gains D-13's field.
- `src/dashboard/router.ts` (`navigateTo`, `:171-177`) — the only sanctioned hash writer; D-04
  declines to give it a query-param contract.
- `src/dashboard/views/detail-charts.ts` (`:253-276`) — the `.segmented` reference pattern for D-02.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`statusBadgeTexts` (`list.ts:212`)** — already emits `` `${row.prCount} PR` ``, so D-07's "the
  badges do the differentiating" needs no new badge source.
- **`composeRowAriaLabel` (`list.ts:266`)** — the shared curated-label composer; the single builder
  D-05 collapses to should use it.
- **`.segmented` / `.segmented__option` (`detail-charts.ts:253-276`, `styles.css:900-915`)** — a
  working `role="group"` two-option control with an `--active` modifier and Phase 19's radius fix
  already applied. D-02's control.
- **`buildSuperlativeTile`'s optional `sublabel` (`records.ts:224-245`)** — the exact three-line
  tile shape D-15 gives `buildStatCard`.
- **`buildPrTableEmptyState` (`records.ts:324`)** — the named empty state for a distance with no
  rows; reused for empty year-scoped distances.
- **`fetchStatsJson` (`overview.ts:65`, `records.ts:100`)** — the individually-guarded stats fetch
  D-10 adds one more call to.
- **`declarationsFor()` / `selectorListDeclares()` / `cascadeWinningBodyDeclaring`
  (`styles.test.ts`)** — the CSS text-assertion helpers. Phase 20's **D-15** hardened these against
  three false-green mechanisms; use the hardened forms, not `selectorListDeclares` alone.

### Established Patterns
- **No DOM test environment.** vitest runs in the `node` environment; no jsdom, no headless browser.
  Verification is a text assertion or a human checkpoint — there is no third option. This phase is
  layout-heavy, so the checkpoint carries the weight. The planner should state explicitly what *is*
  assertable rather than leaving it implicit.
- **Pure logic lives in `*-logic.ts` modules with a sibling `.test.ts`; DOM-touching code stays in
  the view module.** The year filter + re-rank belongs in `records-logic.ts`; the row layout does
  not.
- **Athlete free text reaches the DOM only via `textContent`** (T-16-VW-01 / T-17-VW-01) — the
  shared renderer must keep this for `row.name`.
- **Honesty rules are load-bearing** (T-18-HONEST-02 / T-18-HONEST-05): a real `0` must render as
  `0`, never be swallowed by a falsy check. D-14 upholds this.
- **Theming is attribute-driven only** — `styles.test.ts` asserts `styles.css` contains no
  `prefers-color-scheme`. New rules theme via tokens under the `[data-theme]` blocks.
- **Phase-scoped banner-commented blocks in `styles.css`** with a stated class contract; class names
  are frozen downstream.

### Integration Points
- **`renderActivityRow` is the single seam across three surfaces** (Overview Recent Activities,
  Overview Recent PRs after D-05, Activities mobile card). One edit, three screens — the highest-risk
  change in the phase, and the one Phase 19's criterion 4 was protecting during a styling phase.
- **`records.ts` is touched by both OVR-03 and FIX-01**, on the same screen, in the same phase. The
  scope control and the Superlatives sub-label are independent changes to one view module.
- **`streaks.json` is read by both `overview.ts` and `records.ts`** — D-13's new field surfaces on
  both tiles from one producer change.
- **`best-efforts.json` is already fully loaded by `records.ts`** — the year scope needs no
  additional fetch and no additional payload.
- No pipeline, build-script or `copyDataFiles` changes: `yearly-stats.json` is already published,
  and D-13's field rides the existing `streaks.json` write.

</code_context>

<specifics>
## Specific Ideas

- **The phase name is misleading and the planner should not be surprised by it.** Two of five
  requirements resolve onto the Records screen (D-01, D-15). Recorded here so Records work is not
  flagged as scope creep by a later agent or a plan checker reading only "Overview Rebuild".
- **`records-logic.ts:274-278` is a second, previously-unrecorded bug** (D-12 layer 2). A plan that
  fixes only `streak-utils.ts:118` will render a wrong date with full confidence — the sub-label will
  appear, look correct, and pass a "does it render" checkpoint row while naming the streak's start.
  **The checkpoint row must assert the date's *value*, not just its presence.**
- **The live archive cannot exercise the `ended` branch** — the current streak is active. Without
  D-16's fixture the checkpoint would verify the `active` path and report FIX-01 satisfied. Success
  criterion 5 names the fixture requirement for exactly this reason.
- **Serve the checkpoint from `127.0.0.1`, not `localhost:8099`.** Stale `index.html` and data files
  have been served from localhost in this project's staged-build checkpoints before, which would make
  a fixture edit invisible and the verification false.
- **The Activities mobile card needs its own checkpoint rows.** It is not named in any success
  criterion, but D-05/D-06 change it. Phase 20's R26 had to manufacture a badge-carrying row to
  observe this surface at all — the same care applies here.
- **Records rows and Overview rows should be compared side by side at the checkpoint**, since the
  phase goal is stated as Overview "reaching the same standard as Activities and Records".

</specifics>

<deferred>
## Deferred Ideas

- **Joining activity names into the Records row types** — carried in from Phase 20's D-05/deferred
  list as "Phase 21-shaped work". Not folded: it is a `records-logic.ts` row-type change plus a new
  data dependency on the dashboard index, and none of OVR-01..04 or FIX-01 requires it. Still
  genuinely better rows; worth its own consideration.
- **Unifying `buildStatCard` and `buildSuperlativeTile` into one tile helper** — the cleaner end
  state, declined by D-15 because it widens the Records checkpoint beyond the one tile FIX-01 names.
- **A promoted/accent PR badge variant** — declined by D-07; needs new tokens and a two-theme
  contrast check.
- **Year scope beyond two options** (last year, a full year dropdown, scoping Superlatives or the
  evolution charts) — declined by D-02/D-03. If the two-option control proves useful in the browser,
  widening it is a later phase's call with rendered evidence behind it.
- **Persisted view preferences** — declined by D-04 so that Phase 22's CAL-01 owns the decision.
  A shared storage helper serving both would be a reasonable Phase 22 outcome.
- **Showing the ended streak's *length*** — declined by D-14; would need a second new field for the
  pre-reset count that `streak-utils` currently discards.
- **A committed ended-streak fixture dataset with a documented serving path** — declined by D-16 as
  infrastructure for one checkpoint row, but it is the durable answer if streak states keep needing
  verification in later phases.
- **The PR-progression Improvement column sign bug** (`records.ts:650-651` hard-codes a minus and
  applies `Math.abs()`, inverting the sign for a non-improving step) — surfaced by Phase 20's code
  review, byte-identical back to Phase 18's `d85e88a`, and recommended in PROJECT.md for separate
  tracking. It sits in a file this phase edits, but it is a computation defect in a table D-03
  explicitly leaves out of scope. Not folded.
- **GAP 8 from Phase 19** (Leaflet map panes paint over the nav) — still unpatched, disposition still
  with the developer. Unrelated; not folded.

### Reviewed Todos (not folded)
- **"Exclusion tickbox via local curation mode"**
  (`.planning/todos/pending/2026-08-12-exclusion-tickbox-local-curation-mode.md`) — surfaced by
  `todo.match-phase` at score 0.6 on keyword matches only ("via", "user", "views"). It is CUR-01 and
  is already scoped to **Phase 24 (Local Curation Mode)**. Reviewed and deliberately not folded —
  the same disposition Phase 20 recorded.
- **"Garmin export adapter when export arrives"**
  (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`) — score 0.2 on
  the keyword "user". It is STREAM-04, deferred out of v2.0 and still blocked on the export
  arriving. Reviewed and not folded.

</deferred>

---

*Phase: 21-overview-rebuild*
*Context gathered: 2026-08-18*
