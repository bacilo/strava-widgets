# Phase 20: Row-Click Interaction Pattern - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Every row that represents an activity becomes **one navigable affordance** to that activity's
detail view, using a single shared pattern, keyboard-operable with real link semantics, with the
redundant "View Activity" call-to-action buttons removed.

The surfaces in scope:

- **Overview** — `renderRecentPrRow` (`overview.ts:78`, Recent PRs, currently has no link of any kind) and
  Recent Activities (which reuses `list.ts`'s `renderActivityRow`).
- **Records** — the PR tables (`records.ts:338`) and the PR-progression tables
  (`records.ts:474`), whose `<tr>`s have **no click handler at all** today.
- **Activities mobile cards** — `renderActivityRow`'s `.cta` at `list.ts:224-227`, which is a
  redundant CTA under UX-02 and is shared with Overview.

**Already compliant, no change:** Calendar day cells (`calendar.ts:154`) are real `<button>`s
that navigate to the activity on single-run days and open a picker on multi-run days.

**Not in scope:** restructuring Overview's row *contents* (Phase 21 / OVR-01, OVR-02), joining
activity names into the Records data shape, and any new screen or capability.

</domain>

<decisions>
## Implementation Decisions

### Row semantic and keyboard model

- **D-01: Hybrid semantic — `<div>` rows become real `<a>` elements; `<tr>` rows keep
  anchor-in-cell plus a row-click handler.** These are genuinely different problems. A
  `.activity-row` div can legitimately *become* an anchor, so it does: `<a class="activity-row"
  href="#/activity/{id}">`, the whole row is the link, Tab reaches it, activation is native. A
  `<tr>` cannot be wrapped in an anchor, and putting `role="link"` on one removes it from the
  table's accessibility tree and breaks screen-reader table navigation — so the `<tr>` case keeps
  exactly what `list.ts:333` `buildTableRow` already ships: an `<a>` inside one cell for the
  keyboard path, plus a `click` listener on the `<tr>` guarded by `closest('a')` so the mouse path
  never double-navigates.
  - Success criterion 3's "Tab reaches the row" is therefore satisfied **literally** on the div
    rows (Overview, mobile cards) and **via the row's single activation control** on table rows
    (Activities, Records). This reading is deliberate, not a shortcut — the alternative degrades
    real assistive-tech behavior to satisfy a wording.
  - Note for the planner: ROADMAP cites `list.ts:224` as "the reference". That line is the mobile
    card's `.cta` "View Activity" anchor — i.e. one of the CTAs this phase **removes**, not the row
    pattern. The actual reference pattern is `buildTableRow` at `list.ts:333-343`.

- **D-02: Enter-only activation. No Space keydown handler.** An `<a href>` activates on Enter;
  Space is the page-scroll key. A control announced as "link" is expected to take Enter, and
  hijacking Space on a focused full-width row surprises keyboard users. Criterion 3's "Enter/Space"
  is discharged by native link semantics. **Recorded explicitly so a later agent does not "fix"
  this as an oversight.** The human checkpoint must test Enter, not Space.

- **D-12: The row-click listener honours the browser's link contract; middle-click
  (`auxclick`) is explicitly out of scope.**
  1. **What the listener now refuses to do.** It returns without navigating when `event.button` is
     not `0`, when any of `metaKey` / `ctrlKey` / `shiftKey` / `altKey` is set, or when
     `window.getSelection()` returns a selection that is both non-collapsed and non-empty. The
     existing `closest('a')` guard stays first and unchanged.
  2. **Why this is load-bearing rather than cosmetic.** Plan 20-03 (`670e368`) removed the
     "View Activity" anchor column from both Records PR tables, so row-click is now the *sole*
     affordance on five of six PR-table cells (Rank, Time, Pace, Age-Grade, Flags — only Date
     carries an anchor, `records.ts:396-419`), while D-10's `.activity-table__row--navigable
     { cursor: pointer }` advertises them as link-shaped. Swallowing a Cmd+click into a same-tab
     hash change, or destroying a drag-selection, is the opposite of "propagating `list.ts`'s
     established pattern" — a real `<a href>`, the pattern being propagated, honours all of these
     natively.
  3. **Why `auxclick` is NOT handled, stated as a decision rather than left as a gap.** Browsers
     fire `auxclick`, not `click`, for the middle button, so a middle-click on a row-only cell does
     nothing — which is exactly what a middle-click does on any non-link element, so it is an absent
     affordance, not a hijacked gesture. Synthesising one would mean calling
     `window.open(activityDetailHref(activityId), '_blank')`, which *invents* behaviour instead of
     propagating `list.ts`'s (contradicting D-03 and UX-01), adds a popup-blocker and
     `noopener`-shaped surface for no requirement, and is unverifiable in this repository (no DOM
     and no browser in the test environment — see the Established Patterns note in `<code_context>`).
     The real fix is to give those five cells a real anchor, which needs the activity-name join D-05
     already deferred to Phase 21. Recorded here explicitly so a later agent does not read the
     absence as an oversight — the same reason D-02 exists.
  4. **How the decision is enforced.** `row-navigation.test.ts` asserts that comment-stripped
     `row-navigation.ts` contains zero occurrences of `auxclick`, so silently reversing this
     decision turns the suite red.
  5. **Where it is observed.** The listener's DOM plumbing is unprovable by any automated test in
     this repository; the rendered behaviour is checked by the Round 3 human checkpoint rows
     covering modifier-click, Shift/Alt-click, middle-click and drag-select on the Records PR table
     (plan 20-11).

- **D-03: The row-click behavior lives in one shared DOM helper module.** A small module beside
  `router.ts` / `nav.ts` (it is a navigation concern, and it touches the DOM so it is *not* a
  `*-logic.ts` module under this codebase's convention) exporting something like
  `attachRowNavigation(el, activityId)`. `list.ts`'s inline handler at `list.ts:336-343` is
  **refactored into** the helper — behavior preserved exactly — and `records.ts` calls the same
  helper. UX-01 says one pattern propagated; a single definition is what stops the guard logic
  drifting the first time one side is fixed.
  - Phase 19's criterion 4 froze `list.ts`'s row-click *interaction model*, not the file. Moving
    the identical handler behind a helper preserves the model. Any behavioral change to it is a
    deviation requiring a checkpoint call-out.

- **D-04: Row anchors carry a curated `aria-label` matching `list.ts:354-357`'s existing shape** —
  `{name}, {date}, {distance} km`. Without it, a whole-row link's accessible name becomes every
  descendant string concatenated (name + date + distance + duration + pace + every status badge),
  which is both verbose and *different* from what the same activity announces in the Activities
  table. Reusing the existing shape keeps one announcement across screens. Visible badges stay
  visible; they simply do not bloat the announcement.

### Records — CTA removal and what replaces it

- **D-05: Drop the CTA column entirely from both Records tables; the `Date` cell carries the
  anchor.** The PR table loses its `Activity` column (7 → 6 columns, `records.ts:338`); the
  progression table loses its `Run` column (4 → 3, `records.ts:474`). In each row the Date cell
  holds `<a href="#/activity/{id}">`, mirroring `list.ts`'s anchor-in-cell exactly. `Date` is the
  only descriptive column available: **neither `PrTableRow` (`records-logic.ts:47`) nor
  `ProgressionRow` (`records-logic.ts:188`) carries an activity name — only `activityId`.** The
  `<tr>` gains the D-03 helper so the whole row is the mouse affordance.
  - Joining the activity name in from the dashboard index was considered and rejected for this
    phase: it is a new data dependency and a row-type change, which is Phase 21-shaped work.

- **D-06: The shared link treatment Phase 19 deferred lands in this phase.** `styles.css` has
  **zero rules for a bare `a`** — the only `text-decoration: none` declarations are on
  `.app-nav__link` and `.cta`. So `list.ts`'s Activity-cell anchor renders as a **browser-default
  blue underlined link** today, and every anchor this phase adds would too, including in dark
  theme against `--bg #1a1a2e`. Phase 19's deferred-ideas list named this exactly. Phase 20 is the
  phase that multiplies anchors across the app, so it takes the fix: a bare `a` rule using
  **existing tokens only** — color and text-decoration handling, inheriting the D-09 focus ring.
  No new tokens, no link component, no hover/visited system beyond what the rows need.

### Overview and the Phase 21 seam

- **D-07: `renderActivityRow` is changed in place — both surfaces get the whole-row link.** It
  returns `<a class="activity-row">` with the `.cta` removed, so Overview's Recent Activities and
  the Activities **mobile card view** both become row-as-affordance in one edit. UX-02 says remove
  redundant CTAs "anywhere else the row itself is now the affordance", which names the mobile card.
  Not parameterized (`asLink`) and not forked — two live interaction models for the same visual row
  is precisely the inconsistency this phase exists to remove.

- **D-08: Phase 20 owns the row *semantic*; Phase 21 owns the row *contents*.** `renderRecentPrRow`
  (`overview.ts:78`) becomes an `<a class="activity-row">` keeping its **exact three children**
  (name div, meta div, PR badge) — no hierarchy change, no new classes. Phase 21's OVR-01/OVR-02
  then restructure what is inside the link without touching the interaction. This follows Phase
  19's **D-14** precedent verbatim ("Overview gets the shared treatment and nothing more… its known
  structural problems are Phase 21's rebuild, and doing them here would be duplicated work"), and
  hands Phase 21 a working link to build inside rather than a rewrite to redo.

### Row affordance — hover, cursor, focus ring

- **D-09: The new row anchors reuse Phase 19's shared hover formula verbatim** —
  `background: color-mix(in srgb, var(--surface) 92%, var(--text))`, the same declaration
  `.activity-table tbody tr:hover` already carries (Phase 19 D-06/D-08). A hovered Overview row and
  a hovered Records/Activities table row then feel identical, it is correct in both themes by
  construction, and no new value or token is introduced. The pointer cursor comes free from the
  anchor.

- **D-10: Scope `cursor: pointer` and the row hover to actually-clickable rows.** Today
  `.activity-table tbody tr { cursor: pointer }` (styles.css:526) applies to four tables whose rows
  are **not** activities and never will be clickable: the Riegel race-predictions table
  (`records.ts:608`), the gear/shoe table (`trends.ts:1022`), a trends table (`trends.ts:531`), and
  the detail view's best-efforts table (`detail-sections.ts:395`). All four currently show a
  pointer cursor and light up on hover while doing nothing. Move the pointer/hover onto a marker
  applied by the D-03 helper (or scope to rows containing the activity anchor) so only navigable
  rows advertise themselves. An opt-out class on the four innocent tables was rejected: opt-out is
  the wrong default, and the next non-clickable table would inherit the lie again.

- **D-11: Inherit Phase 19's D-09 focus ring unchanged; the human checkpoint arbitrates.** Phase
  19's **D-12** deliberately left `:focus-visible` global and unscoped so these rows inherit the
  two-tone ring with no opt-in work, and explicitly pre-authorized Phase 20 to refine ring placement
  on full-width rows *if it reads badly*. Do not pre-emptively add a row-specific variant — this
  repo cannot render-test, so a speculative variant is unverifiable. Two supporting facts: the
  `.activity-list` `gap: var(--space-sm)` (8px) leaves room for the 4px ring without overlapping a
  neighbour, and **no clipping container is in play** — `.activity-table-wrapper` has no `overflow`
  (it is `display: none` at the mobile breakpoint only), and the only two `overflow-x: auto`
  containers (`.records-jump`, `.splits-scroll`) were already padded by Phase 19's D-10. Phase 19's
  GAP 2 should not repeat here.

### Gap-closure round 4 (locked 2026-08-17, after `20-VERIFICATION.md` scored 1/4)

- **D-13: Every cell of both Records PR tables carries a real `<a href>`; D-12's "no real anchor
  on the remaining five cells" clause is superseded.**
  1. **What changes.** Rank, Time, Pace, Age-Grade and Flags each wrap their content in
     `<a href={activityDetailHref(row.activityId)}>`, matching the Date cell's existing
     construction (`records.ts:396-419`, and the progression table at `:512-521`).
  2. **Why D-12's stated blocker does not hold.** D-12 declined real anchors because "a real
     anchor needs the activity-name join D-05 already deferred to Phase 21". The Date cell
     disproves that: it already builds a working anchor from `row.activityId` alone, with a
     curated `aria-label` assembled only from fields `PrTableRow` carries
     (date, distance label, duration). The `href` was never blocked on D-05 — only a
     *name-first* label template was. The five new anchors reuse the Date cell's curated label
     verbatim rather than inventing a name.
  3. **Focus order is preserved at one stop per row.** The five new anchors take
     `tabIndex = -1`, so they are mouse/gesture targets only; the Date anchor remains the single
     keyboard stop. This keeps SC3's "consistent focus order" true and stops a screen reader
     announcing the same curated label six times per row.
  4. **What this closes.** `20-VALIDATION.md` R18 (Cmd/Ctrl+click opens a new background tab) and
     R19 (Shift+click opens a new window) become genuinely satisfiable on all six cells, because
     the browser's own gesture handling now has an `<a>` to act on. SC1's "using `list.ts`'s
     existing pattern" — a real `<a href>`, not a row-click substitute that merely fails safe —
     becomes literally true on the Records PR tables.
  5. **Middle-click follows for free.** With a real anchor under the pointer, middle-click is
     native browser behaviour. D-12's `auxclick` out-of-scope clause stays correct as written
     (we still synthesise nothing) but stops being load-bearing on these cells. R20 remains
     not-exercisable on the developer's hardware; that is an observation gap, not an
     implementation one.

- **D-14: The row-click listener refuses navigation on the first click of a double-click.**
  `RowClickContext` gains a `clickCount` field sourced from `event.detail`, and
  `shouldNavigateOnRowClick` gains a fifth refusal class — `clickCount > 1` — alongside the four
  D-12 already implements (`row-navigation.ts:103-117`). This closes `20-REVIEW.md`'s WR-05: a
  double-click intended as word-select no longer navigates away before the selection completes.
  Unit coverage extends `row-navigation.test.ts`'s existing 21 cases; the refusal order stays as
  documented, with `closest('a')` first.

- **D-15: The three guard-layer WARNINGs this phase's own work introduced are closed in this
  round.** All three are false-green mechanisms in the phase's own test guards, not product
  defects: `row-semantics.test.ts:140`'s `isAllowedRoleValue` keys on the value being `link`
  rather than on the receiver, so `role="presentation"` / `role="button"` on a `<tr>` passes
  undetected (WR-01); three of seven Phase 20 CSS assertions
  (`styles.test.ts:1263, 1267, 1292`) are still on any-rule-wins `selectorListDeclares` — the
  exact mechanism plan 20-10 was raised to close and only half-closed (WR-02); and
  `cascadeWinningBodyDeclaring` skips every at-rule-scoped rule, so a `@media` override of
  `.activity-row` leaves all four already-converted assertions green (WR-03). Each fix carries an
  in-suite proof of the blind spot it closes, matching 20-10's established shape.

### Claude's Discretion

- Whether the `<tr>` click handler additionally guards against text-selection drags and
  cmd/ctrl/shift/middle-clicks on the non-anchor part of a row. **Exercised, and now superseded by
  D-12**: `20-VERIFICATION.md` recorded the unguarded listener as a BLOCKER once plan 20-03 removed
  the Records PR table's CTA anchor, making row-click the sole affordance on five of six cells — the
  stated default here (match `list.ts`'s `closest('a')`-only guard) was the wrong call once that
  happened, and D-12 replaces it.
- The exact name, file path and signature of the D-03 helper module.
- Exact color and `text-decoration` values for the D-06 link rule, provided they use existing
  tokens and do not fight `.activity-row__name` / `.activity-row__meta`'s own colors.
- The mechanism for D-10's scoping (marker class applied by the helper vs. a `:has()`/descendant
  selector on the activity anchor).
- Whether excluded-from-records and low-confidence rows navigate identically to normal rows
  (default: yes, identical).
- Column-width and layout fallout from dropping a column in each Records table.
- How the new assertions are grouped into `describe` blocks, and the placement of new rules within
  `styles.css`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone constraints
- `.planning/ROADMAP.md` § Phase 20 — the goal, the four success criteria (criterion 4 is the
  mandatory human browser checkpoint), and the v2.1 verification note stating that **no phase's
  success criteria can be satisfied by `npm test` alone** — there is no jsdom and no headless
  browser in this repo.
- `.planning/REQUIREMENTS.md` — UX-01, UX-02, UX-03, REC-08. Also read OVR-01/OVR-02 (Phase 21)
  to respect the D-08 seam, and CUR-01 (Phase 24) which is explicitly *not* this phase.

### Binding decisions from prior phases
- `.planning/phases/19-design-system-control-styling/19-CONTEXT.md` — **D-12** (global unscoped
  `:focus-visible`, rows inherit the ring, Phase 20 may refine placement), **D-06/D-08** (the shared
  `color-mix` hover formula and the `.activity-table tbody tr:hover` retrofit), **D-14** (the
  Overview-restraint precedent D-08 follows), **D-05** (no `.btn` refactor), and the deferred-ideas
  entry on link styling that D-06 now picks up.
- `.planning/phases/19-design-system-control-styling/19-UI-SPEC.md` — the focus-ring contrast
  record and control contracts.
- `.planning/phases/17-activity-browser-detail-views/17-UI-SPEC.md` — defines the `.activity-table`,
  `.activity-row` and `.cta` class contracts this phase modifies; § 5 Cross-Surface focus management
  governs post-navigation focus.
- `.planning/phases/16-dashboard-shell-data-contract/16-UI-SPEC.md` — 16-D04: `styles.css` is the
  single source of design tokens and is linked from `index.html`, never imported from TypeScript.
- `.planning/phases/18-records-trends-differentiators/18-UI-SPEC.md` — § 17 forbids a new spacing
  scale or a fifth type role; § 3/§ 4b define the PR-evolution grid and Riegel table this phase
  touches only via D-10's scoping.

### Files this phase changes
- `src/dashboard/views/list.ts` — `renderActivityRow` (`:207-232`, the `.cta` at `:224-227` is
  removed) and `buildTableRow` (`:333-343`, its inline handler refactors into the D-03 helper).
- `src/dashboard/views/records.ts` — the PR table (`:338`, CTA at `:391-392`) and progression table
  (`:474`, CTA at `:505-506`); both gain the D-03 helper.
- `src/dashboard/views/overview.ts` — `renderRecentPrRow` (`:78`) becomes an anchor.
- `src/dashboard/styles.css` — D-06 link rule, D-09 hover on row anchors, D-10 pointer/hover
  scoping; `.activity-row` at `:335` must keep `display: flex` once it is an anchor.
- `src/dashboard/styles.test.ts` — the existing text-assertion guard; extend for D-06/D-09/D-10.
- New: the D-03 row-navigation helper module and its test, if the helper's testable surface is
  non-DOM.

### Files read-only but affected by D-10's scoping
- `src/dashboard/views/trends.ts` (`:531`, `:1022`), `src/dashboard/views/detail-sections.ts`
  (`:395`), `src/dashboard/views/records.ts` (`:608`) — the four tables that inherit
  `.activity-table`'s pointer/hover without being clickable.
- `src/dashboard/views/calendar.ts` (`:100-163`) — already-compliant day-cell buttons; the
  reference for "already a real semantic, do not touch".
- `src/dashboard/router.ts` (`navigateTo`, `:171-177`) — the only sanctioned way to change the
  hash; views must never assign `location.hash` directly.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`buildTableRow` (`list.ts:333-343`)** — the real reference pattern: `<tr>` click listener with
  a `closest('a')` guard, plus an `<a>` with a curated `aria-label` in the Activity cell. D-03
  extracts it; D-05 applies it to Records.
- **`navigateTo` (`router.ts:171-177`)** — already used by `buildTableRow` and `calendar.ts`; the
  helper calls this, never `location.hash =`.
- **Phase 19's `color-mix(in srgb, var(--surface) 92%, var(--text))` hover formula** — reused
  verbatim by D-09, already proven correct in both themes.
- **`:focus-visible` two-tone ring (D-09/D-12, Phase 19)** — global and unscoped precisely so these
  rows inherit it for free.
- **`appendStatusBadges` / `appendLowConfidenceBadge` (`list.ts:158-199`)** — produce only
  non-interactive `<span>`s (the low-confidence badge uses `title` + `aria-describedby` + an
  `.sr-only` span), so `closest('a')` remains a sufficient click guard and badges nest safely
  inside a whole-row anchor.
- **`declarationsFor()` / `selectorListDeclares()` (`styles.test.ts`)** — the helpers for any new
  CSS text assertions.

### Established Patterns
- **No DOM test environment.** vitest runs in the `node` environment; there is no jsdom and no
  headless browser anywhere in the repo. Verification is either a text assertion or a human
  checkpoint — there is no third option. This phase is unusually DOM-heavy, so the checkpoint
  carries more weight than it did in Phase 19. **The planner should decide explicitly what, if
  anything, is assertable about the D-03 helper, and say so rather than leaving it implicit.**
- **Pure logic is split into `*-logic.ts` modules** (`list-logic.ts`, `records-logic.ts`,
  `calendar-logic.ts`), each with a sibling `.test.ts`. DOM-touching code stays in the view module
  — which is why D-03's helper is not a `-logic` file.
- **Athlete free text is written with `textContent`, never an HTML-string assignment** (T-16-VW-01
  / T-17-VW-01). Every new row anchor must keep this.
- **Cross-view imports are established** — `overview.ts` already imports `renderActivityRow` and
  `formatActivityDate` from `list.ts`.
- **Theming is attribute-driven only**; `styles.test.ts` asserts the absence of
  `prefers-color-scheme` in `styles.css`. New rules theme via tokens under the `[data-theme]`
  blocks.
- **Phase-scoped commented blocks in `styles.css`** — Phases 17, 18 and 19 each appended a
  banner-commented section with a stated class contract.
- **Class contracts are treated as frozen downstream** (the Phase 17 block says "Do not rename
  these classes downstream") — so `.activity-row` keeps its name even as its element changes.

### Integration Points
- `renderActivityRow` is the **single shared seam between Overview and Activities**; one edit
  changes both screens (D-07). This is the highest-risk edit in the phase and is exactly what
  Phase 19's criterion 4 was protecting during a styling phase.
- `.activity-row` (`styles.css:335`) is `display: flex; flex-direction: row; flex-wrap: wrap` —
  anchors are `inline` by default, so the display must be preserved explicitly when the element
  changes.
- Both Records tables carry `class="activity-table pr-table"`, so they **already** inherit Phase
  19's pointer cursor and row hover despite having no click handler — Records rows currently look
  clickable and are not. This is the likely source of the "View Activity does not navigate"
  confusion recorded in `19-VALIDATION.md`, whose status later flipped to "works fine" with the
  cause unestablished.
- No data files, no pipeline changes, no build-script or `copyDataFiles` changes.

</code_context>

<specifics>
## Specific Ideas

- **The ROADMAP's cited reference is wrong and should not be followed literally.** Criterion 2 says
  redundant CTAs are removed "matching the reference at `list.ts:224`" — but `list.ts:224` *is* a
  "View Activity" CTA inside the mobile card renderer, one of the three being removed. The row
  pattern to propagate is `buildTableRow` at `list.ts:333`. Flagging so no agent implements the
  wrong thing from a confident-sounding line reference.
- **`buildTableRow`'s own comment contradicts success criterion 3** and must be updated, not left
  to rot: *"Keyboard users operate the Activity-cell anchor (already Tab+Enter operable) — no
  `tabindex` on the `<tr>` itself."* D-01 upholds that behavior deliberately; the comment should
  say so and cite the criterion it is reconciling, following Phase 19's hard-won discipline about
  comments that assert more than was observed.
- **`.cta` survives this phase and its Phase 19 hover fix stays exercised.** After the three "View
  Activity" instances go, `.cta` is still used by five retry buttons (`trends.ts:154`,
  `detail-map.ts:284`, `detail.ts:113`, `detail.ts:180`, `records.ts:130`) and two "back" CTAs
  (`detail.ts:188`, `detail.ts:654`). Do **not** delete the `.cta` rules or the
  `.cta:hover mixes from var(--accent)` assertion in `styles.test.ts:723`.
- **Records rows already lie about being clickable** — pointer cursor and hover with no handler.
  Worth calling out at the checkpoint as a before/after, since it is the most visible single
  improvement in the phase.
- **The human checkpoint should test Enter, not Space**, per D-02, and should cover keyboard-only
  tab order on Overview and Records plus mouse clicks landing on the *correct* activity across all
  screens (criterion 4). Given the phase's DOM weight and this project's three prior instances of
  rendering defects shipping behind a fully green automated gate, planning should treat the
  checkpoint as a first-class task, not an afterthought.

</specifics>

<deferred>
## Deferred Ideas

- **Joining activity names into the Records row types** — would let Records rows show and link the
  real activity name like Activities does, instead of anchoring the date. Rejected for this phase
  (D-05): a new data dependency plus a `records-logic.ts` row-type change is Phase 21-shaped work.
  Genuinely better rows; worth its own consideration later.
- **Overview's row hierarchy** (stacked-div PR rows, headline stats, Current Streak "ended" label)
  — already scoped as Phase 21 (OVR-01, OVR-02, FIX-01). D-08 keeps them there.
- **A row-specific focus-ring variant** — D-11 declines to build one speculatively. If the human
  checkpoint finds the full-width ring reads badly, that becomes gap-closure work with rendered
  evidence behind it, matching Phase 19's process.
- **A fuller link system** (visited states, external-link affordance, in-prose link styling) —
  D-06 deliberately takes only the minimum this phase's anchors need.
- **GAP 8 from Phase 19** (Leaflet map tiles paint over the nav, plus the totality defect in the
  ladder comment) — recorded in `19-VALIDATION.md`, left unpatched, disposition still with the
  user. Unrelated to row clicking; not folded here.
- **An `auxclick` handler, or a real anchor on the Records PR table's remaining five cells** —
  either would make middle-click work natively on Rank/Time/Pace/Age-Grade/Flags. D-12 declined
  both for this phase (synthesising `window.open` invents behaviour rather than propagating
  `list.ts`'s pattern; a real anchor needs the activity-name join D-05 already deferred to Phase
  21). **Half superseded by D-13 (round 4):** the real-anchor half is now in scope — the Date
  cell proved the `href` never needed D-05, only a name-first label did — so the five cells get
  real anchors and middle-click works natively. The `auxclick`-handler half stays declined, and
  stays declined for the same reason. The activity-*name* join remains deferred to Phase 21.

### Reviewed Todos (not folded)
- **"Exclusion tickbox via local curation mode"**
  (`.planning/todos/pending/2026-08-12-exclusion-tickbox-local-curation-mode.md`) — surfaced by
  `todo.match-phase` at score 0.4, matched only on the keyword "detail". It is CUR-01 and is
  already scoped to **Phase 24 (Local Curation Mode)**. Reviewed and deliberately not folded.

</deferred>

---

*Phase: 20-row-click-interaction-pattern*
*Context gathered: 2026-08-13*
