# Phase 20: Row-Click Interaction Pattern - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 20-row-click-interaction-pattern
**Areas discussed:** Row semantic & keyboard model, Records CTA removal & the empty column, Overview rows vs the Phase 21 boundary, Row hover/cursor/focus-ring placement

All four offered gray areas were selected for discussion.

---

## Row semantic & keyboard model

### Q1 — What semantic does a clickable activity row get?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — div rows become `<a>`, table rows keep anchor-in-cell | Overview's `.activity-row` divs re-rendered as real anchors; Records/Activities `<tr>`s keep `list.ts`'s proven anchor-in-cell + row-click guard. Preserves table semantics. | ✓ |
| Uniform row-level semantic on everything | `tabindex="0"` + `role="link"` + Enter/Space keydown on every row including `<tr>`s. Most literal reading of criterion 3, but breaks the table's row/cell a11y structure. | |
| Propagate `list.ts` as-is everywhere | Anchor-in-cell for keyboard, row click for mouse, including for Overview's divs. Most literal "propagated, not reinvented", but the row would not be the affordance on Overview. | |

**User's choice:** Hybrid (the recommended option).
**Notes:** Presented with the finding that `role="link"` on a `<tr>` removes it from the table's accessibility tree, which is why `list.ts` has the shape it does.

### Q2 — Should Space also activate row anchors?

| Option | Description | Selected |
|--------|-------------|----------|
| Enter only — native link behavior | No keydown handler; Space stays the page-scroll key. Criterion 3's "Enter/Space" discharged by native link semantics, recorded explicitly. | ✓ |
| Add a Space keydown handler | Literal compliance with criterion 3's wording, at the cost of a handler on every row and behavior diverging from what "link" announces. | |
| Make rows `<button>`-like | Both keys native, but loses `href` — no cmd-click, no middle-click, no URL preview. | |

**User's choice:** Enter only.
**Notes:** Recorded as an explicit decision (D-02) so a later agent does not treat it as an oversight and "fix" it.

### Q3 — Where does the shared row-click behavior live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract a shared helper module | A DOM-touching module beside `router.ts`/`nav.ts`; `list.ts` and `records.ts` both call it. Single definition of the pattern the phase exists to unify. | ✓ |
| `records.ts` imports the helper from `list.ts` | No new file; `overview.ts` already imports from `list.ts`. Cost: `list.ts` becomes a de-facto shared module at 1,182 lines. | |
| Copy the handler into `records.ts` | Six duplicated lines, zero coupling, `list.ts` untouched. Cost: two definitions that drift. | |

**User's choice:** Shared helper module.
**Notes:** Noted that the codebase's `*-logic.ts` convention is for pure logic, so a DOM helper is not a `-logic` file. Also noted that Phase 19's criterion 4 froze `list.ts`'s interaction model, not the file.

### Q4 — What does a whole-row link announce to a screen reader?

| Option | Description | Selected |
|--------|-------------|----------|
| Curated `aria-label` matching `list.ts`'s table anchor | `{name}, {date}, {distance} km` — same announcement as the same activity in the Activities table. | ✓ |
| Full row content as the accessible name | Nothing visible withheld, but a long announcement that diverges from the table row's. | |
| Curated `aria-label` plus the badges | Keeps PR/status badges in the announcement, at the cost of a second announcement shape. | |

**User's choice:** Curated `aria-label` matching the existing shape.

### Continue check

**Selected:** Next area. Guard breadth (text-selection drags, modifier-clicks) carried as Claude's discretion, defaulting to what `list.ts` already ships.

---

## Records CTA removal & the empty column

### Q1 — What replaces the "View Activity" column in the two Records tables?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop the column; the Date cell becomes the anchor | PR table loses `Activity`, progression table loses `Run`; each row's Date cell holds the anchor. Mirrors `list.ts`'s anchor-in-cell on the only descriptive column either row type has. | ✓ |
| Drop the column; the Time cell becomes the anchor | Anchor on the headline value, but a duration reads oddly as link text. | |
| Join the activity name in and anchor that | Genuinely better rows, at the cost of a new data dependency and a row-type change — Phase 21-shaped work. | |

**User's choice:** Drop the column; Date cell anchors.
**Notes:** Two findings presented first — (1) neither `PrTableRow` nor `ProgressionRow` carries an activity name, only `activityId`; (2) both Records tables already inherit Phase 19's `cursor: pointer` and hover despite having no click handler, likely the real source of the "View Activity doesn't navigate" confusion in `19-VALIDATION.md`.

### Q2 — Does Phase 20 pick up the shared link styling Phase 19 deferred?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add a minimal shared link treatment | Bare `a` rule using existing tokens, color and decoration only. Without it the phase ships browser-default blue links onto Records and Overview. | ✓ |
| Scope it to the anchors this phase creates | Smaller blast radius, but the deferral just moves to the next phase that adds a link. | |
| Defer again to a later polish pass | Keeps Phase 20 strictly to interaction, but the checkpoint would be looking at default blue underlined links. | |

**User's choice:** Minimal shared link treatment.
**Notes:** Confirmed `styles.css` has zero rules for a bare `a`; the only `text-decoration: none` declarations are on `.app-nav__link` and `.cta`. Also confirmed `.cta` survives the phase (five retry buttons, two back CTAs), so Phase 19's D-06 hover fix stays exercised.

### Continue check

**Selected:** Next area. Excluded/low-confidence row behavior and column-width fallout carried as Claude's discretion.

---

## Overview rows vs the Phase 21 boundary

### Q1 — How is the shared `renderActivityRow` changed?

| Option | Description | Selected |
|--------|-------------|----------|
| Change it in place — both surfaces get the whole-row link | One edit makes Overview's Recent Activities and the Activities mobile cards row-as-affordance. UX-02 names the mobile card. | ✓ |
| Parameterize it — `renderActivityRow(row, { asLink })` | Preserves the mobile view byte-for-byte, at the cost of two live interaction models for the same visual row. | |
| Fork — Overview gets its own renderer | Clean separation, at the cost of a duplicated renderer and the mobile card keeping its redundant CTA. | |

**User's choice:** Change in place.
**Notes:** Presented with the constraint that `renderActivityRow` is the single shared seam between Overview and Activities, and that Phase 19's "unchanged" was that phase's own constraint on a styling phase.

### Q2 — Where is the Phase 20 / Phase 21 seam?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 20 owns the semantic, Phase 21 owns the contents | Row becomes an `<a>` with its exact three children preserved; Phase 21 restructures inside the link. Follows Phase 19's D-14 precedent. | ✓ |
| Do the hierarchy rebuild now too | One pass over the same function, but pulls OVR-01/OVR-02 into a phase scoped to UX-01/02/03. | |
| Minimal structural tidy only where linking forces it | Fuzzy seam that a downstream agent would have to adjudicate alone. | |

**User's choice:** Phase 20 semantic / Phase 21 contents.

### Continue check

**Selected:** Next area. Mechanical fallout (`.activity-row` must keep `display: flex` once it is an anchor; new link color must not fight `.activity-row__name`/`__meta`) carried as Claude's discretion.

---

## Row hover, cursor & focus-ring placement

### Q1 — What hover treatment do the new row anchors get?

| Option | Description | Selected |
|--------|-------------|----------|
| The same `color-mix` hover the table rows already have | Reuses Phase 19's shared formula verbatim; identical feel across screens, correct in both themes, no new value. | ✓ |
| Link-convention hover (underline / color shift) | Treats it as a link rather than a row, but the same activity would hover two different ways by screen. | |
| No hover — cursor and focus ring only | `.activity-row` is a bordered card, so with no hover it reads as static next to responsive table rows. | |

**User's choice:** Shared `color-mix` hover.
**Notes:** Preceded by a clipping check — `.activity-table-wrapper` has no `overflow` (it is `display: none` at the mobile breakpoint only), and the only two `overflow-x: auto` containers were already padded by Phase 19's D-10, so Phase 19's GAP 2 should not repeat.

### Q2 — Does Phase 20 scope the false affordance on non-activity tables?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — scope pointer/hover to actually-clickable rows | Marker applied by the shared helper, so only navigable rows advertise themselves. Removes a live false affordance. | ✓ |
| Yes, but by opting the four tables out | Smaller diff, but opt-out is the wrong default — the next non-clickable table inherits the lie again. | |
| No — leave it, log it as a finding | Keeps the phase strictly to activity rows, but ships four tables that lie about being clickable. | |

**User's choice:** Scope pointer/hover to actually-clickable rows.
**Notes:** Four affected tables identified: Riegel race predictions (`records.ts:608`), gear/shoe (`trends.ts:1022`), a trends table (`trends.ts:531`), and the detail best-efforts table (`detail-sections.ts:395`).

### Continue check

**Selected:** Wrap up the area. Focus ring inherited unchanged per Phase 19's D-12, with the human checkpoint as arbiter — no pre-emptive variant in a repo that cannot render-test.

---

## Final check

**Question:** Which gray areas remain unclear?
**Selected:** "I'm ready for context" — declining a further round on verification strategy and the human-checkpoint agenda, leaving both to the researcher and planner under the project's existing house rules.

**Notes:** Flagged before writing that this phase is almost entirely DOM code while vitest runs in the `node` environment with no jsdom and no headless browser, so the human checkpoint carries more weight than it did in Phase 19. Recorded in CONTEXT.md's `code_context` as an explicit instruction for the planner to state what is assertable rather than leave it implicit.

---

## Claude's Discretion

- Whether the `<tr>` click handler guards against text-selection drags and cmd/ctrl/shift/middle-clicks (default: match `list.ts`'s existing `closest('a')`-only guard).
- Name, path and signature of the shared row-navigation helper.
- Exact color and `text-decoration` values for the link rule.
- Mechanism for scoping the pointer/hover (marker class vs. `:has()`/descendant selector).
- Whether excluded and low-confidence rows navigate identically (default: yes).
- Column-width and layout fallout from dropping a column in each Records table.
- `describe`-block grouping for new assertions and rule placement within `styles.css`.

## Deferred Ideas

- Joining activity names into the Records row types (rejected for this phase; genuinely better rows, Phase 21-shaped work).
- Overview's row hierarchy — Phase 21 (OVR-01, OVR-02, FIX-01).
- A row-specific focus-ring variant — only if the human checkpoint finds the full-width ring reads badly.
- A fuller link system (visited states, external-link affordance, in-prose links).
- Phase 19's GAP 8 (Leaflet map tiles painting over the nav) — unrelated, disposition still with the user.

## Reviewed Todos (not folded)

- "Exclusion tickbox via local curation mode" — matched at score 0.4 on the keyword "detail" only; it is CUR-01, already scoped to Phase 24. Reviewed and deliberately not folded.
