---
phase: 20
slug: row-click-interaction-pattern
status: pending
nyquist_compliant: false
round: 4
round2_staged: 2026-08-13
round2_recorded: 2026-08-13
round3_staged: 2026-08-13
round3_recorded: 2026-08-17
round4_staged: 2026-08-17
created: 2026-08-13
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `20-CONTEXT.md` and the plan 19-05/19-17 precedent for this milestone.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (installed) |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npx vitest run src/dashboard/row-semantics.test.ts src/dashboard/styles.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~1 second (960 tests passing as of this plan's gate run) |

**Hard constraint (verified across Phases 16-19, not assumed).** `vitest.config.ts` sets
`environment: 'node'`, and `package.json` devDependencies contain `vitest` and **nothing else
test-related** — no `jsdom`, no `happy-dom`, no `@testing-library/*`, no `puppeteer`, no
`playwright`. **There is no CSSOM and no rendering engine available to any automated test in
this repository.** Every claim this phase makes is therefore provable by exactly one of two
mechanisms:

- **(a) a text assertion** over the literal characters of the view-file source or
  `src/dashboard/styles.css` (what `row-semantics.test.ts` and `styles.test.ts`'s Phase 20
  block already do), or
- **(b) the human browser checkpoint** (this file's Manual-Only Verifications table below,
  filled in by plan 20-05 Task 2).

There is no third option. This phase authorizes **no new test dependency**, so this plan
proposes none as an escape hatch.

**What this phase's automated suite covers, named explicitly:**
- The URL-shape functions (`activityDetailPath`, `activityDetailHref`) and their template
  literal, mutation-proven in `row-navigation.test.ts`.
- The stylesheet rule text for the D-06 bare `a` treatment, the D-09 row-anchor hover, and the
  D-10 navigable-row cursor/hover scoping, mutation-proven in `styles.test.ts`.
- The source structure of `list.ts`, `overview.ts`, `records.ts`, `trends.ts` and
  `detail-sections.ts` — CTA removal counts, `attachRowNavigation`/`activityDetailHref` call
  counts (including load-bearing zero-counts), the Records column-header removals, and the
  absence of `tabindex`, `role="link"`, `keydown` listeners or `location.hash` assignment —
  proven in `row-semantics.test.ts`.

**What this phase's automated suite does NOT cover, named explicitly:**
- Whether a click on a row actually navigates to the correct activity's detail view.
- Whether Tab reaches a row's activation control, in what order, and how many Tab presses it
  takes.
- What a screen reader announces for a row's `aria-label`.
- What cursor a browser paints over a row, or whether a hover highlight actually renders.
- Whether the inherited global `:focus-visible` ring is fully visible on a full-width row, or
  clipped/occluded by a container, a neighbouring row, or the sticky nav.

This project has shipped rendering defects behind a fully green automated gate **three times**
already — Phase 16's black page behind 15/15 checks, Phase 17's two rendering defects behind
592/592 tests and 20/20 `verify-dashboard`, Phase 19's GAP 1 (a dead CSS token invisible to all
four gate commands, discovered only at the 19-05 checkpoint). A green suite here is a
precondition for opening the checkpoint, never a substitute for it.

---

## Gate Results (this plan, Task 1)

Run from a clean working tree on `master` at `1f6a72d`, in-repo (not a worktree — gitignored
`data/` fixtures present):

| Command | Exit code | Count |
|---------|-----------|-------|
| `npm test` | 0 | 960/960 tests passed, 48/48 files passed |
| `npx tsc --noEmit -p tsconfig.json` | 0 | clean, zero diagnostics |
| `npm run build-widgets` | 0 | build complete; `css-syntax-error` occurrences in the build log: **0** |
| `npm run verify-dashboard` | 0 | 37/37 checks passed, 0 failures |

No stale-data recovery step (`npm run build` / `compute-all-stats`) was needed — `data/` was
already present and `verify-dashboard` passed on the first attempt.

**Staged build:** `/tmp/gh-pages/strava-widgets` is a symlink to the absolute path
`/Users/pedf/workspace/strava-widgets/dist/widgets`, confirmed resolving
(`/tmp/gh-pages/strava-widgets/index.html` exists). Served from `/tmp/gh-pages` via
`python3 -m http.server 8099`. Confirmed live: `GET http://localhost:8099/strava-widgets/index.html` → `200`.

---

## Manual-Only Verifications

**This table is the human checkpoint's agenda.** Everything listed here is unprovable by any
automated test in this repository — see Test Infrastructure above for exactly what the
automated suite does and does not cover. Each row below needs its own independent, named
observation; a blanket statement covering several rows is recorded as what it is, not
manufactured into per-row detail that was never observed. Rows 1-4, 7, 9 and 10 are
theme-sensitive and require both the light and dark theme to be checked before either can be
recorded as sufficient evidence — a row observed in only one theme where the claim is
theme-sensitive is insufficient evidence for that row.

| Behavior | Requirement | Why Manual | Test Instructions | Observation |
|----------|-------------|------------|--------------------|--------------|
| 1. Overview Recent PRs rows are single tab stops that activate on Enter | UX-01, UX-03 | Tab-stop count and activation are rendered-interaction facts; no text assertion can count keyboard stops or observe an Enter-triggered navigation. | At `http://localhost:8099/strava-widgets/#/`, click the page background, then Tab forward past the nav into the Recent PRs card. Each PR row must take **exactly one** Tab press to reach — not three (name, meta, badge). Press Enter on one; confirm the detail view for that activity opens. Both themes. | Developer's verbatim response, given as a single blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — tab-stop count and Enter-activation were not individually described. This row is theme-sensitive; which theme(s) were checked was not separately reported. VERDICT: PASS (blanket approval; theme coverage not confirmed — see Evidence Quality note below). |
| 2. Overview Recent Activities rows behave identically and carry no button | UX-01, UX-02, UX-03 | Tab-stop count and Enter-activation are rendered-interaction facts; the absence of a "View Activity" button in the rendered card is a visual/DOM fact this suite's source-structure guard proves only for source text, not for what actually paints. | Same page, Recent Activities card. One Tab stop per row, Enter navigates, and there is **no "View Activity" button** anywhere in the card. Both themes. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — tab-stop count, Enter-activation and the absent button were not individually described. This row is theme-sensitive; which theme(s) were checked was not separately reported. VERDICT: PASS (blanket approval; theme coverage not confirmed — see Evidence Quality note below). |
| 3. Activities desktop table is unregressed | ACT-01, UX-01 | This is the reference interaction model Phase 19's criterion 4 protected; a regression here is the phase's biggest risk, and click-lands-once-not-twice is a rendered navigation fact no text assertion can see. | At `#/list` on a wide window, click a row anywhere outside the Activity link — it navigates. Tab into the table: the Activity-cell link is the row's tab stop and Enter activates it. Clicking the Activity link itself navigates **once**, not twice (no flicker through an intermediate view). Both themes. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — the once-not-twice navigation and tab-stop behaviour were not individually described. This row is theme-sensitive; which theme(s) were checked was not separately reported. VERDICT: PASS (blanket approval; theme coverage not confirmed — see Evidence Quality note below). |
| 4. Activities mobile card view is one link with no CTA | UX-02, UX-03 | Card-layout breakpoint behavior, tab-stop count, and the absence of a rendered CTA are all rendered facts. | At `#/list`, narrow the window until the card view replaces the table. Each card is one tab stop, Enter navigates, and the "View Activity" button that used to sit inside each card is gone. Both themes. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — the mobile card breakpoint, tab-stop count and absent CTA were not individually described. This row is theme-sensitive; which theme(s) were checked was not separately reported. VERDICT: PASS (blanket approval; theme coverage not confirmed — see Evidence Quality note below). |
| 5. Records PR tables navigate on row click, with six columns | REC-08, UX-01, UX-02 | Column count is visible only in the rendered header; click-lands-on-correct-activity and pointer/hover before-vs-after are rendered facts. | At `#/records`, confirm each PR table header reads Rank, Time, Pace, Age-Grade, Date, Flags — **six columns, no Activity column and no "View Activity" button**. Click a row anywhere outside the date link: it navigates to that activity. Tab reaches the Date link; Enter activates it. These rows previously showed a pointer cursor and a hover highlight while having no click handler at all — this is the before/after worth looking at. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — the six-column header, row-click navigation and the pointer/hover before-vs-after were not individually described. This row is not theme-sensitive. VERDICT: PASS (blanket approval). |
| 6. Records PR-progression tables, three columns, same behaviour | REC-08, UX-02 | Same reasoning as row 5, applied to the progression table's `<details>`-nested rows. | At `#/records`, expand a PR-evolution card's `<details>`. Header reads Date, Time, Improvement — **three columns, no Run column**. Row click navigates; the Date link is the tab stop; Enter activates. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — the three-column header and row-click navigation were not individually described. This row is not theme-sensitive. VERDICT: PASS (blanket approval). |
| 7. Non-activity tables no longer advertise a click | UX-03 (D-10) | Cursor shape and hover paint are rendered facts no text assertion can see. | Hover the rows of the Riegel race-predictions table at `#/records`, the gear/shoe table and the other table at `#/trends`, and the best-efforts table on any activity detail view. For all four: **no pointer cursor and no hover highlight**. Both themes. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — the absence of pointer cursor and hover highlight across the four named tables was not individually described. This row is theme-sensitive; which theme(s) were checked was not separately reported. VERDICT: PASS (blanket approval; theme coverage not confirmed — see Evidence Quality note below). |
| 8. Space does not activate a focused row, and that is correct | UX-03 (D-02) | Whether a key press scrolls the page versus navigates is a rendered browser-behavior fact. | Focus an Overview row with Tab, press **Space**. Expected: the page scrolls and **no navigation happens**. This is deliberate — an `<a href>` takes Enter, Space is the page-scroll key, and hijacking it on a full-width row surprises keyboard users. Record this as PASS when Space scrolls without navigating. Do **not** file it as a defect. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — whether Space scrolled without navigating was not individually described. This row is not theme-sensitive. VERDICT: PASS (blanket approval). |
| 9. The shared link treatment did not make anything look wrong | UX-03 (D-06) | This phase added the first bare `a` rule the stylesheet has ever had, changing two anchors that were previously rendering browser-default blue; whether the resulting colour is legible is a perceptual/computed-style question. | Check the nav brand ("Training Dashboard", top left, every screen) and the "‹ Newer" / "Older ›" links on an activity detail view. Both must read in the normal text colour, legible against the page in **both themes**, not browser-default blue and not invisible. Also confirm the Records Date links and the Activities Activity links are visibly links. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — the nav brand colour, the "‹ Newer"/"Older ›" links, and the Records/Activities link legibility were not individually described. This row is theme-sensitive; which theme(s) were checked was not separately reported. VERDICT: PASS (blanket approval; theme coverage not confirmed — see Evidence Quality note below). |
| 10. The inherited focus ring on a full-width row | UX-03 (D-11) | This repository cannot render-test, which is exactly why no row-specific ring variant was built speculatively; whether the ring is clipped or occluded is a rendered-layout question. | Tab through Overview rows and Activities cards in both themes. The 4px ring must be fully visible — not clipped by a container, not overlapping the neighbouring row, not occluded by the sticky nav when the focused row scrolls under it. If it reads badly, record the developer's words verbatim; that becomes gap-closure work with rendered evidence behind it, matching Phase 19's process. Do not patch it here. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — whether the ring was clipped, overlapping, or occluded by the sticky nav was not individually described. This row is theme-sensitive; which theme(s) were checked was not separately reported. VERDICT: PASS (blanket approval; theme coverage not confirmed — see Evidence Quality note below). |
| 11. Clicks land on the *correct* activity | UX-01, criterion 4 | No check in this repository can compare a clicked row against the view that opened. | Pick three rows on three different screens (one Overview Recent PR, one Records PR table row, one Activities row). For each, note the row's visible date and distance before clicking, then confirm the detail view that opens shows the **same** activity. Record the three activity ids or dates observed. | Developer's verbatim response, given as the same blanket statement covering rows 1-11 together: "all approved except 12. What's (see file)?" No per-row detail was reported for this row specifically — no activity ids or dates were recorded by the developer for the three rows this instruction asks for. This row is not theme-sensitive. VERDICT: PASS (blanket approval). |
| 12. Calendar day cells are untouched | UX-01 (no-regression) | These are already-compliant real `<button>` elements this phase deliberately did not modify; confirming nothing leaked into them requires exercising them in a real browser. | At `#/calendar`, click a day with a single run — it navigates to that activity; click a day with multiple runs — the picker opens. | This row received its own individual verdict, not the rows 1-11 blanket. The developer first asked, in the same message that approved rows 1-11, "What's (see file)?" — a request to clarify what row 12 covers before judging it, since the checkpoint had not stated it. After the orchestrator described row 12's content (calendar day cells, deliberately untouched by this phase, single-run navigates / multi-run opens the picker), the developer responded, verbatim: "approved row 12". This row is not theme-sensitive. VERDICT: PASS (individual verdict). |

---

## Checkpoint Outcome (this plan, Task 2)

The developer's browser session against `http://localhost:8099/strava-widgets/` (confirmed live
and `/strava-widgets/` in the URL bar per Task 1's staging) produced two messages, verbatim and
complete:

1. "all approved except 12. What's (see file)?" — a blanket approval covering rows 1-11 together,
   plus a question asking what row 12 covers (this checkpoint's `<how-to-verify>` agenda did not
   itself state row 12's content to the developer up front).
2. "approved row 12" — sent after row 12's content (calendar day cells, deliberately untouched by
   this phase) was described back to the developer, an individual verdict distinct from the
   rows 1-11 blanket.

All twelve rows carry a PASS verdict; no row reported a defect, so no `## Gap-Closure Record`
entry exists — nothing here is a shipped defect. Per the house rule established at 19-09's
precedent, the rows 1-11 blanket approval is recorded as what it is — one statement quoted
verbatim against each of the eleven rows it covers — and is **not** expanded into per-row detail
(tab-stop counts, cursor observations, colour checks) that the developer never actually reported.

## Evidence Quality

`nyquist_compliant` is **not** set `true` for this checkpoint, despite all twelve rows carrying a
PASS verdict, for one reason: seven rows (1, 2, 3, 4, 7, 9, 10) are theme-sensitive per this
file's own house rule ("a row observed in only one theme, where the row's claim is
theme-sensitive, is FAIL for insufficient evidence"), and the developer's blanket approval never
stated which theme(s), if any, were checked before approving. This is thinner than even a
single-theme observation — it is *no stated theme coverage at all* for those seven rows. That is
an evidence gap, not a discovered defect: nothing the developer said contradicts any row's claim,
and no row is being recorded as failing. Applying the house rule honestly means the checkpoint
cannot claim full Nyquist compliance on the evidence actually gathered, so `status: partial` and
`nyquist_compliant: false` are the values that match what happened, distinct from a `status:
blocked` reading that would imply a shipped defect exists. The five non-theme-sensitive rows
(5, 6, 8, 11, 12) are not affected by this gap — their claims do not depend on which theme was
active. Closing this gap requires only a follow-up confirmation of which theme(s) rows 1-4, 7, 9
and 10 were checked in — not a code change, and not a re-run of the gate. This plan does not
attempt that follow-up itself, per its own scope (`files_modified` names only this file); it is
recorded here for the next planning round to pick up.

Per this same reasoning, `.planning/REQUIREMENTS.md` is left untouched by this plan. This plan's
frontmatter `files_modified` names only this file, and marking any requirement complete on a
`status: partial` / `nyquist_compliant: false` checkpoint would repeat the exact mistake plan
19-15 reverted (an autonomous plan ticking a requirement ahead of a rendered checkpoint's own
sign-off). REC-08's two mapped rows (5, 6) are in fact fully evidenced (neither is
theme-sensitive), but ticking REC-08 alone while UX-01/02/03 stay open is deferred to the
gap-closure follow-up above, alongside the theme-coverage question, rather than actioned
piecemeal here.

---

## Gap-Closure Record

None — no row reported a defect. See the Evidence Quality note above for the theme-coverage
evidence gap on rows 1, 2, 3, 4, 7, 9 and 10 (an insufficient-evidence gap, not a defect).

---

## Round 2 — Re-run Verifications (gap closure)

Round 1's rows 1-11 rest on one blanket developer statement with no per-row detail and no stated
theme coverage for the seven theme-sensitive rows (1, 2, 3, 4, 7, 9, 10) — an evidence gap, not a
discovered defect, per the Evidence Quality note above. Separately, two BLOCKER defects were
confirmed in source *after* Round 1 passed: CR-01 (mobile return-from-detail focus restoration
was dead, fixed in plan 20-06) and CR-02 (status-badge text was dropped from three surfaces'
accessible names, fixed in plan 20-07). Round 1's own twelve-row agenda — tab-stop counts and
Enter-activation — was never positioned to catch either one. This round re-runs the original
twelve rows on named, per-row, both-theme evidence, and adds five new rows that exercise exactly
the two defects Round 1 could not see. Round 1's record above is preserved unedited.

Each row below needs its own independent, named observation; a blanket statement covering several
rows is not accepted as evidence in Round 2, and any row left individually undescribed is recorded
as failing for insufficient evidence rather than manufactured into detail that was never observed.
Rows R1, R2, R3, R4, R7, R9 and R10 are theme-sensitive and require both the light and the dark
theme to be named before either can count as sufficient evidence for that row.

| Behavior | Requirement | Why Manual | Test Instructions | Observation |
|----------|-------------|------------|--------------------|--------------|
| R1. Overview Recent PRs rows are single tab stops that activate on Enter | UX-01, UX-03 | Tab-stop count and activation are rendered-interaction facts; no text assertion can count keyboard stops or observe an Enter-triggered navigation. | At `http://localhost:8099/strava-widgets/#/`, click the page background, then Tab forward past the nav into the Recent PRs card. Each PR row must take **exactly one** Tab press to reach — not three (name, meta, badge). Press Enter on one; confirm the detail view for that activity opens. Both themes. A row carrying a visible `N PR` badge is the interesting one to look at, since plan 20-07 changed those rows. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Tab-stop count, Enter-activation and which theme(s) were checked for the Overview Recent PRs rows were never individually described. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that asked (among other things) for both themes to be named on the seven theme-sensitive rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". This row is theme-sensitive and no theme was named for it specifically, so neither the tab-stop/Enter claim nor theme coverage is discharged by this round. |
| R2. Overview Recent Activities rows behave identically and carry no button | UX-01, UX-02, UX-03 | Tab-stop count and Enter-activation are rendered-interaction facts; the absence of a "View Activity" button in the rendered card is a visual/DOM fact this suite's source-structure guard proves only for source text, not for what actually paints. | Same page, Recent Activities card. One Tab stop per row, Enter navigates, and there is **no "View Activity" button** anywhere in the card. Both themes. A row carrying a visible status badge (`No streams`, `No HR`, `Low confidence`, `Excluded from records`) is the interesting one to look at, since plans 20-06 and 20-07 changed those rows. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Tab-stop count, Enter-activation, the absent "View Activity" button, and which theme(s) were checked for the Overview Recent Activities row were never individually described. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that asked (among other things) for both themes to be named on the seven theme-sensitive rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". This row is theme-sensitive and no theme was named for it specifically, so neither the interaction claim nor theme coverage is discharged by this round. |
| R3. Activities desktop table is unregressed | ACT-01, UX-01 | This is the reference interaction model Phase 19's criterion 4 protected; a regression here is the phase's biggest risk, and click-lands-once-not-twice is a rendered navigation fact no text assertion can see. | At `#/list` on a wide window, click a row anywhere outside the Activity link — it navigates. Tab into the table: the Activity-cell link is the row's tab stop and Enter activates it. Clicking the Activity link itself navigates **once**, not twice (no flicker through an intermediate view). Both themes. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Whether clicking outside the Activity link navigates, whether the Activity-cell link is the row's tab stop, whether Enter activates it, whether the click lands once and not twice, and which theme(s) were checked were never individually described for the Activities desktop table. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that asked (among other things) for both themes to be named on the seven theme-sensitive rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". This row is theme-sensitive and no theme was named for it specifically, so neither the non-regression claim nor theme coverage is discharged by this round. |
| R4. Activities mobile card view is one link with no CTA | UX-02, UX-03 | Card-layout breakpoint behavior, tab-stop count, and the absence of a rendered CTA are all rendered facts. | At `#/list`, narrow the window until the card view replaces the table. Each card is one tab stop, Enter navigates, and the "View Activity" button that used to sit inside each card is gone. Both themes. A card carrying a visible status badge is the interesting one to look at, since plans 20-06 and 20-07 changed those rows. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. The card-layout breakpoint, the one-tab-stop-per-card claim, the absent "View Activity" CTA, and which theme(s) were checked were never individually described for the Activities mobile card view. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that asked (among other things) for both themes to be named on the seven theme-sensitive rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". This row is theme-sensitive and no theme was named for it specifically, so neither the interaction claim nor theme coverage is discharged by this round. |
| R5. Records PR tables navigate on row click, with six columns | REC-08, UX-01, UX-02 | Column count is visible only in the rendered header; click-lands-on-correct-activity and pointer/hover before-vs-after are rendered facts. | At `#/records`, confirm each PR table header reads Rank, Time, Pace, Age-Grade, Date, Flags — **six columns, no Activity column and no "View Activity" button**. Click a row anywhere outside the date link: it navigates to that activity. Tab reaches the Date link; Enter activates it. These rows previously showed a pointer cursor and a hover highlight while having no click handler at all — this is the before/after worth looking at. | R2-VERDICT: PASS. Not theme-sensitive. The developer read back the PR table header verbatim: "Rank  Time  Pace  Age-Grade  Date  Flags" — six columns, matching the six-column header this row's instructions require exactly. This is an individual, row-specific observation distinct from the blanket approval covering the other twelve not-evidenced rows this round. |
| R6. Records PR-progression tables, three columns, same behaviour | REC-08, UX-02 | Same reasoning as row 5, applied to the progression table's `<details>`-nested rows. | At `#/records`, expand a PR-evolution card's `<details>`. Header reads Date, Time, Improvement — **three columns, no Run column**. Row click navigates; the Date link is the tab stop; Enter activates. | R2-VERDICT: PASS. Not theme-sensitive. The developer read back the PR-progression table header verbatim: "Date  Time  Improvement" — three columns, matching the three-column header this row's instructions require exactly. This is an individual, row-specific observation distinct from the blanket approval covering the other not-evidenced rows this round. |
| R7. Non-activity tables no longer advertise a click | UX-03 (D-10) | Cursor shape and hover paint are rendered facts no text assertion can see. | Hover the rows of the Riegel race-predictions table at `#/records`, the gear/shoe table and the other table at `#/trends`, and the best-efforts table on any activity detail view. For all four: **no pointer cursor and no hover highlight**. Both themes. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Whether the four named non-activity tables (Riegel predictions, gear/shoe, the Trends table, best-efforts) show no pointer cursor and no hover highlight, and which theme(s) were checked, were never individually described. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that asked (among other things) for both themes to be named on the seven theme-sensitive rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". This row is theme-sensitive and no theme was named for it specifically, so neither the cursor/hover claim nor theme coverage is discharged by this round. |
| R8. Space does not activate a focused row, and that is correct | UX-03 (D-02) | Whether a key press scrolls the page versus navigates is a rendered browser-behavior fact. | Focus an Overview row with Tab, press **Space**. Expected: the page scrolls and **no navigation happens**. This is deliberate — an `<a href>` takes Enter, Space is the page-scroll key, and hijacking it on a full-width row surprises keyboard users. Record this as PASS when Space scrolls without navigating. Do **not** file it as a defect. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Whether Space scrolls the page without navigating on a focused Overview row was never individually described. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up asking for row-specific content on other rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". None of that is an individual observation of this row's specific behavior, so it is not discharged by this round. |
| R9. The shared link treatment did not make anything look wrong | UX-03 (D-06) | This phase added the first bare `a` rule the stylesheet has ever had, changing two anchors that were previously rendering browser-default blue; whether the resulting colour is legible is a perceptual/computed-style question. | Check the nav brand ("Training Dashboard", top left, every screen) and the "‹ Newer" / "Older ›" links on an activity detail view. Both must read in the normal text colour, legible against the page in **both themes**, not browser-default blue and not invisible. Also confirm the Records Date links and the Activities Activity links are visibly links. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Whether the nav brand, the "‹ Newer"/"Older ›" links, and the Records/Activities links read legibly in the normal text colour, and which theme(s) were checked, were never individually described. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that asked (among other things) for both themes to be named on the seven theme-sensitive rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". This row is theme-sensitive and no theme was named for it specifically, so neither the legibility claim nor theme coverage is discharged by this round. |
| R10. The inherited focus ring on a full-width row | UX-03 (D-11) | This repository cannot render-test, which is exactly why no row-specific ring variant was built speculatively; whether the ring is clipped or occluded is a rendered-layout question. | Tab through Overview rows and Activities cards in both themes. The 4px ring must be fully visible — not clipped by a container, not overlapping the neighbouring row, not occluded by the sticky nav when the focused row scrolls under it. If it reads badly, record the developer's words verbatim; that becomes gap-closure work with rendered evidence behind it, matching Phase 19's process. Do not patch it here. | R2-VERDICT: PASS (partial theme coverage — a genuine open gap, not a manufactured pass). This row is theme-sensitive per the house rule (R1, R2, R3, R4, R7, R9, R10 require both themes named). The developer's own word for the focus ring was "fine", with no clipping, overlap or nav-occlusion reported — a real, row-specific observation distinct from the blanket approval covering the other rows this round. However, the developer did not name which theme(s) this was checked in, so theme coverage for this row is incomplete: the substance verdict is recorded PASS, but the missing theme pair is flagged as an open coverage gap rather than treated as full Nyquist-compliant evidence for this row. |
| R11. Clicks land on the *correct* activity | UX-01, criterion 4 | No check in this repository can compare a clicked row against the view that opened. | Pick three rows on three different screens (one Overview Recent PR, one Records PR table row, one Activities row). For each, note the row's visible date and distance before clicking, then confirm the detail view that opens shows the **same** activity. Record the three activity ids or dates observed. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. This row's instructions ask for the three activity ids or dates observed across the three named screens; no such detail was reported. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that specifically asked which three activities were checked for this row, the developer answered "1. Yes 3. yes 6. confirm" — none of which names the three activities; finally "all good". This row is not discharged by this round. |
| R12. Calendar day cells are untouched | UX-01 (no-regression) | These are already-compliant real `<button>` elements this phase deliberately did not modify; confirming nothing leaked into them requires exercising them in a real browser. | At `#/calendar`, click a day with a single run — it navigates to that activity; click a day with multiple runs — the picker opens. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Whether a single-run calendar day navigates and a multi-run day opens the picker was never individually described this round (distinct from Round 1, where this row received its own individually-recorded verdict). The developer's response covering this row this round was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up asking for row-specific content on other rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". None of that is an individual observation of this row's specific behavior this round, so it is not discharged by this round. |
| R13. Return-from-detail focus lands on the restored row, below 720px | UX-01, UX-03 (CR-01, D-08) | Which element holds keyboard focus after a hash navigation is a rendered-interaction fact; the repository's automated proof is a stub-element unit test that cannot observe a browser. | Narrow the window until `#/list` shows the card layout instead of the table. Click a card to open the activity detail view, then use the browser Back button to return to `#/list`. The row you came from is highlighted — confirm that as well — and then, **without clicking anything**, press Tab once. Focus must move to the control immediately after that row, which means focus was already on the row itself when the page restored. Equivalently, press Enter immediately on returning: it must re-open the same activity. Before plan 20-06 this was broken — focus stayed on the page heading, so the first Tab went to the top of the page. Not theme-sensitive: the claim is where focus lands, not what it looks like, so one theme is sufficient evidence for this row. | R2-VERDICT: PASS. Not theme-sensitive — the claim is where focus lands, not what it looks like. This is CR-01's re-test (plan 20-06) and the single most important row this round. The developer's first attempt at this row reported the single Tab landing "on the search box" after Back — the pre-fix failure signature. Investigation of the `#/list` DOM order (`h1` -> count line -> toolbar[search, filters] -> table -> sort -> cards -> pagination) showed the search box is the first focusable control after the `<h1>`, so that first observation was consistent with focus never having left the page heading at all — indistinguishable, on its own, from CR-01 still being broken. The cause was identified as a procedure artifact, not a code defect: the developer had used the browser's Back BUTTON with the mouse to return to `#/list`, which moves focus into browser chrome, so the subsequent Tab restarted at the top of the document regardless of whether the fix was present. On re-test using keyboard back (Cmd+[) at a confirmed card-layout width, the developer reported: (a) the returned row WAS visibly highlighted, and (b) a single Tab press moved focus to "next card down". Both observations together confirm focus was restored to the row itself, which is exactly what CR-01's fix claims to do. Recorded here with the false-alarm history intact, because the mouse-Back procedure produces a convincing false FAIL and is worth carrying forward for anyone re-running this agenda. |
| R14. The same, above 720px (non-regression) | UX-01 (D-08) | Same reasoning as R13, applied to the desktop table row/Activity-cell anchor shape. | Widen the window until the `#/list` table renders. Click a row's Activity link, then Back. The row is highlighted; press Enter immediately — it must re-open the same activity, which means focus is on that row's Activity-cell link. This branch worked before plan 20-06 and must still work. Not theme-sensitive. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Whether keyboard focus lands on the desktop table's Activity-cell link after Back, above the 720px breakpoint, was never individually described. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up asking for row-specific content on other rows, the developer answered "1. Yes 3. yes 6. confirm"; finally "all good". Unlike R13, no individual re-test or DOM-order investigation was reported for this row's desktop-breakpoint claim, so it is not discharged by this round. |
| R15. VoiceOver announces a card row's badge text, Activities mobile card | UX-03 (CR-02) | This repository has no way to compute an accessible name; the automated proof covers only the composed string. | This is a macOS machine — turn VoiceOver on with Cmd+F5. At `#/list`, narrow to the card layout and find a card that visibly shows a status badge (`No streams`, `No HR`, `Low confidence`, `Excluded from records` or `N PR`). Navigate to that row with VO (Ctrl+Option+Right, or Tab). The announcement must include the badge's text after the name/date/distance, and end with "link". Report the announcement in your own words, including the badge text you heard. Turn VoiceOver off with Cmd+F5 when done. Not theme-sensitive. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Which badge text VoiceOver announced for a card row on the Activities mobile card was never individually reported. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that specifically asked which badge text was heard for R15/R16/R17, the developer answered "1. Yes 3. yes 6. confirm" — none of which names any badge text; finally "all good". This matters more than the other not-evidenced rows: CR-02's failure mode (plan 20-07) was badge text being silently dropped from the accessible name, so an undescribed "yes" is indistinguishable from the defect still being present. CR-02 therefore remains unobserved in a real screen reader this round, even though its automated string-composition coverage is green. See the Round 2 Checkpoint Outcome narrative below. |
| R16. VoiceOver announces a row's badge text, Overview Recent Activities | UX-03 (CR-02) | Same reasoning as R15, applied to the surface that shares `renderActivityRow` with it. | Same VoiceOver procedure at `http://localhost:8099/strava-widgets/#/`, in the Recent Activities card, on a row that visibly shows a status badge. Same expected announcement shape. This surface shares `renderActivityRow` with R15, so a difference between R15 and R16 is itself a finding worth recording. Not theme-sensitive. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Which badge text VoiceOver announced for a row on Overview Recent Activities was never individually reported. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that specifically asked which badge text was heard for R15/R16/R17, the developer answered "1. Yes 3. yes 6. confirm" — none of which names any badge text; finally "all good". As with R15, an undescribed "yes" cannot be distinguished from CR-02's silently-dropped-badge failure mode, so this row remains unobserved in a real screen reader this round. See the Round 2 Checkpoint Outcome narrative below. |
| R17. VoiceOver announces the PR count, Overview Recent PRs | UX-03 (CR-02) | Same reasoning as R15/R16, applied to the Recent PRs card's own composed label. | Same VoiceOver procedure, in the Recent PRs card. Every row there carries a PR-count badge, so any row exercises it. The announcement must include the "N PR" text and end with "link". Not theme-sensitive. | R2-VERDICT: FAIL — insufficient evidence, NOT EVIDENCED THIS ROUND. Whether VoiceOver announced the "N PR" text for a Recent PRs row was never individually reported. The developer's response covering this row was part of a blanket approval, not a per-row observation: initially "all pass"; after a condensed six-question follow-up that specifically asked which badge text was heard for R15/R16/R17, the developer answered "1. Yes 3. yes 6. confirm" — none of which names the PR-count text; finally "all good". As with R15 and R16, an undescribed "yes" cannot be distinguished from CR-02's silently-dropped-badge failure mode, so this row remains unobserved in a real screen reader this round. See the Round 2 Checkpoint Outcome narrative below. |

Each of the seventeen rows above needs its own independent verdict recorded in its own
Observation cell. A blanket statement covering several rows at once is not accepted as evidence
in this round, and any row left individually undescribed is recorded as failing for insufficient
evidence rather than having detail manufactured for it that was never actually observed. Rows R1,
R2, R3, R4, R7, R9 and R10 additionally require both the light and the dark theme to be named
before either can count toward a passing verdict for that row.

---

## Checkpoint Outcome (Round 2)

The developer's browser/VoiceOver session against `http://localhost:8099/strava-widgets/`
(confirmed live and `/strava-widgets/` in the URL bar, staged by Task 1) produced genuine
individual evidence for four of the seventeen rows and a blanket approval for the remaining
thirteen, in this sequence:

1. **R5 and R6** — each with the rendered table header read back verbatim: "Rank  Time  Pace
   Age-Grade  Date  Flags" (six columns) for R5, "Date  Time  Improvement" (three columns) for
   R6. Individual, row-specific evidence for both.
2. **R13** — this round's single most important row (CR-01, plan 20-06). The developer's first
   attempt reported the Tab landing "on the search box" after Back, the pre-fix failure
   signature. Investigation traced this to a procedure artifact — mouse Back moves focus into
   browser chrome, defeating the probe regardless of the fix — rather than a regression. Re-test
   with keyboard back (`Cmd+[`) confirmed both the row highlight and a single Tab moving focus to
   the next card down, together confirming focus was restored to the row. See the false-alarm
   history recorded in R13's own Observation cell and repeated in the Evidence Quality section
   below.
3. **R10** — the focus ring was reported "fine", with no clipping, overlap or nav-occlusion. Real,
   row-specific substance, but no theme was named, leaving an open coverage gap on this
   theme-sensitive row.
4. **The remaining thirteen rows** received only a blanket "all pass". A condensed six-question
   follow-up then asked specifically for the content "all pass" could not supply: which badge
   text was heard for R15/R16/R17, which three activities were checked for R11, and both themes
   named for the seven theme-sensitive rows (R1, R2, R3, R4, R7, R9, R10). The developer's reply,
   verbatim, was "1. Yes 3. yes 6. confirm" — a partial answer to a subset of the six questions,
   naming no badge text, no activity ids, and no theme. The session closed with "all good".

Per this plan's own house rule ("If the developer answers several rows with one statement, do not
spread that statement across those rows and call it per-row evidence... any row left individually
undescribed is recorded R2-VERDICT: FAIL"), rows R1, R2, R3, R4, R7, R8, R9, R11, R12, R14, R15,
R16 and R17 are recorded `R2-VERDICT: FAIL` for insufficient evidence — not because a defect was
found (none was, and none is claimed for any of them), but because "all pass" / "1. Yes 3. yes 6.
confirm" / "all good" is not an individual observation of any specific row's Test Instructions.

**No code defect was found this round.** R13's re-test passed on genuine evidence, all four
automated gates recorded green in Task 1 (`npm test` 991/991 across 49 files, `tsc --noEmit`
clean, `build-widgets` 0 `css-syntax-error` occurrences, `verify-dashboard` 37/37), and nothing
the developer reported contradicts any row's claim. What remains outstanding after this round is
**evidence, not implementation** — thirteen rows still need their own individually-described
observation before SC4 can be discharged in full.

**R15/R16/R17 and CR-02, specifically.** These three rows exist to observe CR-02 (plan 20-07) in a
real screen reader — the automated proof covers only the composed accessible-name string, not
what VoiceOver actually announces. CR-02's failure mode was the badge text being *silently
dropped* from the accessible name: a row that lacked the fix still announced cleanly, just without
the badge, so an undescribed "yes" carries no diagnostic value and is indistinguishable from the
defect still being present. CR-02 therefore remains **unobserved in a real screen reader** after
this round, despite its source-level, string-composition coverage being green.

## Evidence Quality (Round 2)

`nyquist_compliant` is **not** set `true`, and `status` is **not** `passed`, for this round. Four
rows carry genuine, individually-described evidence (R5, R6, R13 in full; R10 on substance but
with an open theme-coverage gap); thirteen rows (R1, R2, R3, R4, R7, R8, R9, R11, R12, R14, R15,
R16, R17) carry no individual observation and are recorded `R2-VERDICT: FAIL` for insufficient
evidence, per this plan's own house rule. This is an evidence gap, not a discovered defect —
nothing reported contradicts any row's claim, no shipped defect was found, and R13's re-test (the
row this round most needed to re-confirm, covering CR-01) passed cleanly, with its false-alarm
history recorded below. `status: partial` and `nyquist_compliant: false` are the values that match
what was actually observed this round, distinct from a `status: blocked` reading that would imply
a shipped defect exists.

**R13's false-alarm history (worth carrying forward).** The developer's first attempt at R13
reported the single Tab landing "on the search box" after Back — the exact pre-fix failure
signature for CR-01. Investigation of the `#/list` DOM order (`h1` -> count line ->
toolbar[search, filters] -> table -> sort -> cards -> pagination) confirmed the search box is the
first focusable control after the `<h1>`, so that first observation was consistent with focus
never having left the page heading at all. The cause turned out to be a procedure artifact, not a
regression: the developer had used the browser's Back **button** with the mouse, which moves focus
into browser chrome before the page restores, so the subsequent Tab restarts at the top of the
document regardless of whether CR-01's fix is present. Re-testing with keyboard back (`Cmd+[`) at
a confirmed card-layout width produced the correct result: the returned row was visibly
highlighted, and a single Tab moved focus to the next card down — both together confirming focus
was already on the row itself. **This is a genuinely useful trap for anyone re-running this
agenda**: the mouse-Back procedure produces a convincing false FAIL for R13/R14-shaped
focus-restoration claims, independent of whether the underlying fix works.

Per this same reasoning, `.planning/REQUIREMENTS.md` is updated by this plan only where the Round 2
row-to-requirement map's every mapped row passed. REC-08's two mapped rows (R5, R6) are both
individually evidenced and PASS, so REC-08 is ticked. UX-01, UX-02 and UX-03 each have at least
one mapped row recorded `R2-VERDICT: FAIL` for insufficient evidence this round, so all three stay
open — see each requirement's own entry in `REQUIREMENTS.md` for which of its mapped rows still
need an individual re-verification.

## Gap-Closure Record (Round 2)

Thirteen rows are recorded `R2-VERDICT: FAIL` for insufficient evidence this round. None is a
shipped defect — no suggested fix or root-cause theory is offered for any of them, per house rule,
because none is a failing behavior report; each is an evidence gap. Listed here per Task 2's own
acceptance criteria, with the requirement(s) each blocks and the verbatim exchange offered in
place of an individual observation:

| Row | Requirement(s) blocked | What was offered instead of an individual observation |
|-----|------------------------|----------------------------------------------------------|
| R1 | UX-01, UX-03 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R2 | UX-01, UX-02, UX-03 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R3 | ACT-01, UX-01 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R4 | UX-02, UX-03 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R7 | UX-03 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R8 | UX-03 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R9 | UX-03 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R11 | UX-01, criterion 4 | "all pass" -> "1. Yes 3. yes 6. confirm" (no activity ids named) -> "all good" |
| R12 | UX-01 (no-regression) | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R14 | UX-01 | "all pass" -> "1. Yes 3. yes 6. confirm" -> "all good" |
| R15 | UX-03 (CR-02) | "all pass" -> "1. Yes 3. yes 6. confirm" (no badge text named) -> "all good" |
| R16 | UX-03 (CR-02) | "all pass" -> "1. Yes 3. yes 6. confirm" (no badge text named) -> "all good" |
| R17 | UX-03 (CR-02) | "all pass" -> "1. Yes 3. yes 6. confirm" (no badge text named) -> "all good" |

Additionally, **R10** (UX-03, D-11) carries a genuine individual observation ("fine", no
clipping/overlap/nav-occlusion reported) but no theme was named, leaving its theme-coverage
requirement (both light and dark, per house rule) open. This is recorded as a coverage gap on an
otherwise-substantive PASS row, not as a FAIL — see R10's own Observation cell.

---

## Round 3 - Re-run Verifications (gap closure)

Round 2's recorded verdicts left thirteen of seventeen rows insufficiently evidenced. The
developer's blanket "all pass" was followed, after a condensed six-question follow-up asking for
exactly the missing per-row detail, by a partial answer ("1. Yes 3. yes 6. confirm") naming no
theme, no badge text and no activity id, then closed with "all good" — the same shape of answer
that undischarged Round 1. Of the four rows that did carry genuine individual evidence, three
(R5, R6, R13) are carried forward below as passes and are **not re-asked** this round; the fourth
(R10) had real substance recorded ("fine", no clipping, no overlap, no nav occlusion) but no
theme pair was ever named, so this round asks R10 for the theme pair only. Separately, after
Round 2 ran, a BLOCKER was found and fixed: plan 20-09 discovered the Records PR-table row-click
listener did not honour the browser's link contract for a modified click, a non-primary-button
click, or a drag-selection — a defect Round 2's own agenda was never positioned to catch, since
none of its rows exercised those gestures. This round adds four rows (R18-R21) to observe that
fix for the first time. Rounds 1 and 2 are preserved unedited above; nothing in this section
alters them.

**Carried forward from Round 2 (not re-asked):**

- **R5** (Records PR tables, six columns, row click) - PASS, on the developer's verbatim
  Round 2 header read-back "Rank  Time  Pace  Age-Grade  Date  Flags". Not theme-sensitive. See
  R5's Round 2 Observation cell above.
- **R6** (Records PR-progression tables, three columns) - PASS, on the developer's verbatim
  Round 2 header read-back "Date  Time  Improvement". Not theme-sensitive. See R6's Round 2
  Observation cell above.
- **R13** (return-from-detail focus below 720px, CR-01) - PASS, on the developer's genuine
  keyboard-back re-test in Round 2: the returned row was visibly highlighted and a single Tab
  moved focus to the next card down, after an initial mouse-Back false alarm was diagnosed as a
  procedure artifact. See R13's Round 2 Observation cell above.

| Behavior | Requirement | Why Manual | Test Instructions | Observation |
|----------|-------------|------------|--------------------|--------------|
| R1. Overview Recent PRs rows are single tab stops that activate on Enter | UX-01, UX-03 | Tab-stop count and activation are rendered-interaction facts; no text assertion can count keyboard stops or observe an Enter-triggered navigation. | At `http://localhost:8099/strava-widgets/#/`, click the page background, then Tab forward past the nav into the Recent PRs card. Each PR row must take **exactly one** Tab press to reach — not three (name, meta, badge). Press Enter on one; confirm the detail view for that activity opens. Both themes. A row carrying a visible `N PR` badge is the interesting one to look at, since plan 20-07 changed those rows. This is a re-check after plan 20-09 changed the row-click listener. **Required detail:** The visible name or date of the PR row you pressed Enter on, and both theme names. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). Eight consecutive Tab presses from the page background produced eight distinct activity rows, one tab stop each, no intermediate stops for name/meta/badge: "Lunch Run, Sep 18, 2022, 21.3 km, 3 PR", "Morning Run, Feb 20, 2022, 28.1 km, 2 PR", "Morning Run, Apr 3, 2021, 12.4 km, 1 PR", "Morning Run, Jan 10, 2021, 20.0 km, 1 PR", "Morning Run, Jan 2, 2021, 10.1 km, 1 PR", then flowing into Recent Activities rows. Enter on the focused PR row "Lunch Run, Sep 18, 2022, 21.3 km, 3 PR" opened #/activity/7827165619, whose detail view showed Lunch Run, Sep 18 2022, 21.3 km and exactly three PR markers (5K, 10K, Half Marathon), matching the 3 PR badge. Both themes: dark theme for the eight-stop sequence and the Enter activation; light theme re-confirmed by real Tab presses landing on "Morning Run, Feb 20, 2022, 28.1 km, 2 PR" during the R10 focus-ring capture. |
| R2. Overview Recent Activities rows behave identically and carry no button | UX-01, UX-02, UX-03 | Tab-stop count and Enter-activation are rendered-interaction facts; the absence of a "View Activity" button in the rendered card is a visual/DOM fact this suite's source-structure guard proves only for source text, not for what actually paints. | Same page, Recent Activities card. One Tab stop per row, Enter navigates, and there is **no "View Activity" button** anywhere in the card. Both themes. Pick a row that visibly carries a status badge (`No streams`, `No HR`, `Low confidence`, `Excluded from records`), since plans 20-06 and 20-07 changed those rows. **Required detail:** The badge text you saw, quoted exactly (one of `No streams`, `No HR`, `Low confidence`, `Excluded from records`), and both theme names. | R3-VERDICT: BLOCKED — observed by agent (browser automation against the staged build). The badge half of this row is not exercisable on the current dataset: all ten Overview Recent Activities rows carry well-formed accessible names (e.g. "Herlev Running, Aug 11, 2026, 10.0 km") and ZERO of them carry any status badge, so no badge text could be quoted. The remaining halves were confirmed: one tab stop per row (rows 6-8 of the eight-stop Tab sequence above were Recent Activities rows), and the string "View Activity" appears nowhere in the rendered markup, in both light and dark themes. Recorded BLOCKED rather than PASS because the row's own Required detail — a quoted badge text — could not be produced. |
| R3. Activities desktop table is unregressed | ACT-01, UX-01 | This is the reference interaction model Phase 19's criterion 4 protected; a regression here is the phase's biggest risk, and click-lands-once-not-twice is a rendered navigation fact no text assertion can see. | At `#/list` on a wide window, click a row anywhere outside the Activity link — it navigates. Tab into the table: the Activity-cell link is the row's tab stop and Enter activates it. Clicking the Activity link itself navigates **once**, not twice (no flicker through an intermediate view). Both themes. After clicking outside the Activity link, use browser Back and confirm the URL returned to `#/list`. **Required detail:** The activity name of the row you clicked, whether the detail view appeared once with no flicker through an intermediate view, and both theme names. | R3-VERDICT: PASS — observed by developer. Developer performed the desktop-table checks on a widened window and reported: the row clicked was "Herlev Running"; the detail view appeared once with no flicker through an intermediate view; and both themes were covered, named as light and dark. |
| R4. Activities mobile card view is one link with no CTA | UX-02, UX-03 | Card-layout breakpoint behavior, tab-stop count, and the absence of a rendered CTA are all rendered facts. | At `#/list`, narrow the window until the card view replaces the table. Each card is one tab stop, Enter navigates, and the "View Activity" button that used to sit inside each card is gone. Both themes. A card carrying a visible status badge is the interesting one to look at, since plans 20-06 and 20-07 changed those rows. **Required detail:** Confirmation that the card layout (not the table) was showing, the name on the card you activated, and both theme names. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). At a 406px viewport the card layout was confirmed active — the `<table>` element is present in the DOM but has zero width and height, while 50 `a.activity-row` cards render. Each card is a single tab stop; Tab reached the card "Herlev Running, Aug 7, 2026, 10.1 km" and Enter opened #/activity/i174109950, whose detail view showed Herlev Running, Aug 7 2026, 10.1 km. The string "View Activity" appears nowhere in the rendered markup. Confirmed in both light and dark themes. |
| R7. Non-activity tables no longer advertise a click | UX-03 (D-10) | Cursor shape and hover paint are rendered facts no text assertion can see. | Hover the rows of the Riegel race-predictions table at `#/records`, the gear/shoe table and the other table at `#/trends`, and the best-efforts table on any activity detail view. For all four: **no pointer cursor and no hover highlight**. Both themes. Cover all four named tables. **Required detail:** All four table names written out, with pointer-cursor and hover-highlight stated for each, and both theme names. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). All four named non-activity tables carry `cursor: auto` and zero rows bearing `activity-table__row--navigable`: (1) the Riegel Race Predictions table at #/records (headers "From \ To \| 400m \| 1K \| ..."), (2) the gear/shoe table at #/trends?tab=gear (headers "Shoe \| Distance \| Runs \| Avg Pace \| Avg HR \| Date Range \| Coverage %"), (3) the other #/trends table (headers "Date \| Distance", 65 rows), and (4) the "Best Efforts This Run" table on an activity detail view (plus the Splits table on the same view, also auto). Hover highlight was settled structurally rather than by sampling: the ONLY `:hover` rules touching rows in the entire stylesheet (270 rules total) are `.activity-row:hover` and `.activity-table__row--navigable:hover`, both resolving to `background: color-mix(in srgb,var(--surface) 92%,var(--text))`. Non-navigable rows have no hover rule at all. Re-verified in both light and dark themes; the selectors are class-scoped, so the result is theme-independent by construction. |
| R8. Space does not activate a focused row, and that is correct | UX-03 (D-02) | Whether a key press scrolls the page versus navigates is a rendered browser-behavior fact. | Focus an Overview row with Tab, press **Space**. Expected: the page scrolls and **no navigation happens**. This is deliberate — an `<a href>` takes Enter, Space is the page-scroll key, and hijacking it on a full-width row surprises keyboard users. Record this as PASS when Space scrolls without navigating. Do **not** file it as a defect. **Required detail:** Which row was focused when you pressed Space, and what the page did (scrolled or not, navigated or not). | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). With the Overview row "Lunch Run, Sep 18, 2022, 21.3 km, 3 PR" focused via real Tab presses, a real Space key press produced NO navigation — the hash stayed at #/ — which is this row's substantive claim and the behaviour D-02 deliberately specifies. A keydown listener confirmed the Space event reached the focused `A.activity-row` with `defaultPrevented: false`, proving nothing in the application hijacks or cancels the key. The page did not visibly scroll under synthetic input, and the page was NOT at its scroll limit at the time (scrollY 200 of a 1739px maximum); native scroll is a known non-reproducible effect of synthetic key dispatch, so the scroll half is recorded as an instrumentation limitation rather than as application behaviour. |
| R9. The shared link treatment did not make anything look wrong | UX-03 (D-06) | This phase added the first bare `a` rule the stylesheet has ever had, changing two anchors that were previously rendering browser-default blue; whether the resulting colour is legible is a perceptual/computed-style question. | Check the nav brand ("Training Dashboard", top left, every screen) and the "‹ Newer" / "Older ›" links on an activity detail view. Both must read in the normal text colour, legible against the page in **both themes**, not browser-default blue and not invisible. Also confirm the Records Date links and the Activities Activity links are visibly links. **Required detail:** How the nav brand and the "‹ Newer" / "Older ›" links read in each theme, described in your own words, and both theme names. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). Measured by computed style on an activity detail view rather than by perception. Light theme: the nav brand "Training Dashboard" and both pager links "‹ Newer" and "Older ›" all compute to rgb(51, 51, 51) against a rgb(255, 255, 255) page — identical to the body text colour, contrast ratio 12.63:1. Dark theme: all three compute to rgb(224, 224, 224) against rgb(26, 26, 46) — again identical to body text, contrast ratio 12.92:1. None is browser-default blue (rgb(0, 0, 238)) in either theme. Both themes named: light and dark. |
| R10. The inherited focus ring on a full-width row | UX-03 (D-11) | This repository cannot render-test, which is exactly why no row-specific ring variant was built speculatively; whether the ring is clipped or occluded is a rendered-layout question. | **Theme coverage only.** Round 2 already recorded the substance ("fine" - no clipping, no overlap, no nav occlusion) and that verdict stands; this round closes only the missing theme pair. Tab through Overview rows and Activities cards, noting both themes. **Required detail:** Both theme names, with one sentence on how the ring read in each. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). Round 2's substance verdict stands; this round closed the missing theme pair. The ring is drawn by `:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); position: relative; z-index: 1 }` — box-shadow, not outline. Reached by real Tab presses on the Overview row "Morning Run, Feb 20, 2022, 28.1 km, 2 PR" with `:focus-visible` matching. Dark theme: computed `rgb(26, 26, 46) 0px 0px 0px 2px, rgb(255, 107, 53) 0px 0px 0px 4px` — a crisp orange halo complete on all four sides. Light theme: `rgb(255, 255, 255) 0px 0px 0px 2px, rgb(252, 76, 2) 0px 0px 0px 4px` — same clean halo. Screenshot captures in both themes show no clipping and no overlap; no ancestor in the row's parent chain has a non-visible overflow, and `z-index: 1` keeps the ring above the nav. Both themes named: light and dark. |
| R11. Clicks land on the *correct* activity | UX-01, criterion 4 | No check in this repository can compare a clicked row against the view that opened. | Pick three rows on three different screens (one Overview Recent PR, one Records PR table row, one Activities row). For each, note the row's visible date and distance before clicking, then confirm the detail view that opens shows the **same** activity. Record the three activity ids or dates observed. Cover the three named screens. **Required detail:** Three activity ids or dates, one per screen, each paired with what the detail view that opened showed. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). Three rows on three different screens, each verified against the detail view that opened. (1) Overview Recent PRs: "Lunch Run, Sep 18, 2022, 21.3 km, 3 PR" → #/activity/7827165619 → detail showed Lunch Run, Sep 18 2022, 21.3 km with three PR markers. (2) Records PR table (400m, Rank #1, 0:45, 1:53/km, 99.1%, Jan 2 2021) → #/activity/4556693525, which matches that row's own Date-cell anchor href exactly. (3) Activities: "Herlev Running, Aug 7, 2026, 10.1 km" → #/activity/i174109950 → detail showed Herlev Running, Aug 7 2026, 10.1 km. |
| R12. Calendar day cells are untouched | UX-01 (no-regression) | These are already-compliant real `<button>` elements this phase deliberately did not modify; confirming nothing leaked into them requires exercising them in a real browser. | At `#/calendar`, click a day with a single run — it navigates to that activity; click a day with multiple runs — the picker opens. **Required detail:** The calendar date of the single-run day you clicked and the calendar date of the multi-run day. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). Calendar day cells are real `<button>` elements. Single-run day: a real click on "August 2, 2026, 16.4 km, 1 run" navigated to #/activity/i174110044, whose detail showed Herlev Running, Aug 2 2026, 16.4 km. Multi-run day: a real click on "May 25, 2026, 11.0 km, 2 runs" (reached by paging back to 2026-05) did NOT navigate — the hash stayed at #/calendar?month=2026-05 — and opened a picker panel headed "2 runs on May 25, 2026". The picker is a panel rather than a `role="dialog"` element. |
| R14. The same, above 720px (non-regression) | UX-01 (D-08) | Same reasoning as R13, applied to the desktop table row/Activity-cell anchor shape. | Widen the window until the `#/list` table renders. Click a row's Activity link, then Back. The row is highlighted; press Enter immediately — it must re-open the same activity, which means focus is on that row's Activity-cell link. This branch worked before plan 20-06 and must still work. Not theme-sensitive. Repeat R13's false-alarm warning: use **keyboard** back (`Cmd+[`), not the mouse Back button, which moves focus into browser chrome and produces a convincing false FAIL regardless of the fix. **Required detail:** The name of the activity that re-opened when you pressed Enter. | R3-VERDICT: PASS — observed by developer. Developer performed the keyboard-back re-test on a widened window using `Cmd+[` (not the mouse Back button, per R13's documented false-alarm trap) and reported that the activity which re-opened on Enter was "Herlev Running" — confirming focus returned to that row's Activity-cell link. |
| R15. VoiceOver announces a card row's badge text, Activities mobile card | UX-03 (CR-02) | This repository has no way to compute an accessible name; the automated proof covers only the composed string. | This is a macOS machine — turn VoiceOver on with Cmd+F5. At `#/list`, narrow to the card layout and find a card that visibly shows a status badge (`No streams`, `No HR`, `Low confidence`, `Excluded from records` or `N PR`). Navigate to that row with VO (Ctrl+Option+Right, or Tab). The announcement must include the badge's text after the name/date/distance, and end with "link". Report the announcement in your own words, including the badge text you heard. Turn VoiceOver off with Cmd+F5 when done. Not theme-sensitive. This row is asked first this round, and an undescribed "yes" cannot be accepted because CR-02's failure mode was the badge text being silently dropped. **Required detail:** The announced string quoted back verbatim between quotation marks, including the badge text and the trailing "link". | R3-VERDICT: PASS — observed by developer, corroborated by agent. The developer ran VoiceOver on the Activities mobile card layout and, when re-asked for the specific missing detail, named the badge heard as "no streams". The developer declined to transcribe the full announced string, so the agent then read the composed accessible name directly off the rendered card in the staged build: `aria-label="Morning Run, May 25, 2026, 7.0 km, No streams (no-original)"` on an `<a href="#/activity/18702664326">`. A second badge-carrying card reads "Morning Run, Apr 20, 2026, 10.0 km, No HR, Low confidence". CR-02's failure mode was the badge text being silently dropped from the accessible name; the badge text is demonstrably present, so that failure mode is excluded. Recorded discrepancy, not a defect: the shipped badge string is "No streams (no-original)", more specific than the bare "No streams" this round's agenda anticipated. The trailing "link" was not independently confirmed by the developer; the element is a real `<a href>`, so link role follows from the markup rather than from a heard announcement. |
| R16. VoiceOver announces a row's badge text, Overview Recent Activities | UX-03 (CR-02) | Same reasoning as R15, applied to the surface that shares `renderActivityRow` with it. | Same VoiceOver procedure at `http://localhost:8099/strava-widgets/#/`, in the Recent Activities card, on a row that visibly shows a status badge. Same expected announcement shape. This surface shares `renderActivityRow` with R15, so a difference between R15 and R16 is itself a finding worth recording. Not theme-sensitive. **Required detail:** The announced string quoted back verbatim, including the badge text. | R3-VERDICT: BLOCKED — observed by developer, corroborated by agent. The developer reported having no badge-carrying row in Overview Recent Activities. The agent confirmed this independently against the staged build: all ten Recent Activities rows carry well-formed accessible names (e.g. "Herlev Running, Aug 11, 2026, 10.0 km") and zero carry any status badge; the only badges anywhere on the Overview page are the "3 PR" / "2 PR" / "1 PR" badges in the Recent PRs card. The badge-inclusion claim is therefore not exercisable on the current dataset. Explicitly NOT passed off R15's evidence despite the shared `renderActivityRow` code path. |
| R17. VoiceOver announces the PR count, Overview Recent PRs | UX-03 (CR-02) | Same reasoning as R15/R16, applied to the Recent PRs card's own composed label. | Same VoiceOver procedure, in the Recent PRs card. Every row there carries a PR-count badge, so any row exercises it. The announcement must include the "N PR" text and end with "link". Not theme-sensitive. **Required detail:** The announced string quoted back verbatim, and it must include the `N PR` text. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). The developer declined the VoiceOver procedure as low value for a personal-use dashboard with no screen-reader users, and chose agent inspection instead. The agent read the composed accessible name directly off the rendered Overview Recent PRs rows in the staged build: `aria-label="Lunch Run, Sep 18, 2022, 21.3 km, 3 PR"` on an `<a href="#/activity/7827165619">`, with the next two rows reading "Morning Run, Feb 20, 2022, 28.1 km, 2 PR" and "Morning Run, Apr 3, 2021, 12.4 km, 1 PR". The required `N PR` text is present in the accessible name; link role follows from the `<a href>` markup. |
| R18. Cmd/Ctrl+click on a row-only cell opens a background tab and leaves the current tab alone | UX-01, UX-03 (D-12) | Whether a modified click opens a tab or rewrites the current hash is a rendered browser-behaviour fact; the repository's automated proof is a pure predicate that never touches a browser. | At `#/records`, Cmd+click (Ctrl+click on a non-Mac keyboard) one of the five **anchor-less** cells (Rank, Time, Pace, Age-Grade or Flags) - **not** the Date cell, which has its own real anchor. A new background tab must open on that activity, and the tab you clicked in must still be showing `#/records`. Before plan 20-09 this navigated in the current tab and lost your place. **Required detail:** Which of the five cells you clicked, the URL of the new tab (it must end `#/activity/<id>`), and confirmation that the original tab did not navigate. | R3-VERDICT: FAIL — observed by agent (browser automation against the staged build). Recorded against this row's stated expectation, which the observed behaviour does not meet. What passed: a real Cmd+click on the anchor-less Pace cell ("1:53/km") of the 400m PR table's Rank #1 row left the page on #/records — the current tab was NOT hijacked. That is the BLOCKER behaviour plan 20-09 set out to fix, and it is fixed. A plain unmodified click on the same cell still navigated to #/activity/4556693525, confirming the guards only reduce the set of navigating clicks and never widen it. What failed: no new background tab opened. The row expects "A new background tab must open on that activity". Nothing opened. Instrumentation limit stated honestly: the agent's tooling can only enumerate tabs inside its own tab group, and a control Cmd+click on the Date cell's real anchor likewise surfaced no new tab in that group, so "a tab opened elsewhere" cannot be excluded by observation alone for the Date-cell control case. For the anchor-less cell the outcome is not in doubt: `shouldNavigateOnRowClick` returns false whenever any of metaKey/ctrlKey/shiftKey/altKey is set, and those five cells contain no anchor for the browser to act on, so there is nothing for a modified click to open. The developer's disposition, recorded at the checkpoint: record this as FAIL against the stated expectation and let the next planning round own it. |
| R19. Shift+click opens a new window, Alt+click does not navigate in place | UX-01, UX-03 (D-12) | Same reasoning as R18: what a modified click does to browser tab/window state is a rendered fact no text assertion can see. | Same table, same **anchor-less** cells (Rank, Time, Pace, Age-Grade, Flags) - **not** the Date cell. Shift+click one - a new window must open on that activity. Then Alt+click one - whatever the browser chooses to do, the current window must **not** navigate to the activity. **Required detail:** Which cell you used for each, that a new window appeared for Shift+click, and what the original window was still showing after each of the two clicks. | R3-VERDICT: FAIL — observed by agent (browser automation against the staged build). Same shape as R18, recorded against the stated expectation. What passed: the Alt+click half. A real Alt+click on the anchor-less Pace cell left the current window on #/records — it did not navigate in place, which is exactly what this row requires. What failed: the Shift+click half. The row expects "a new window must open on that activity". A real Shift+click on the same anchor-less cell left the page on #/records and opened no window, for the same structural reason as R18 — the shiftKey guard refuses navigation and the cell carries no anchor. Selection state was cleared between each modified click so the drag-select guard could not confound the result. The developer's disposition, recorded at the checkpoint: FAIL against the stated expectation, deferred to the next planning round. |
| R20. Middle-click, per the recorded D-12 decision | UX-03 (D-12) | `auxclick` behaviour cannot be observed by any test in this repository. | Middle-click one of the five **anchor-less** cells (Rank, Time, Pace, Age-Grade, Flags) - **not** the Date cell. Per D-12 the expected outcome is that **nothing happens** - no navigation, no new tab - because a `<td>` is not a link and this phase deliberately did not synthesise an `auxclick` handler. Then middle-click the **Date** cell's link in the same row: the browser's own middle-click must open it in a new tab. This row is where you can disagree with D-12; if you think middle-click should work on the whole row, say so and it becomes the next round's work rather than a patch made now. **Required detail:** Both outcomes reported separately - what happened on the anchor-less cell, and what happened on the Date cell - plus whether you accept D-12 as recorded. | R3-VERDICT: NOT EXERCISABLE — observed by developer. The middle-click observation could not be performed: the developer is on a trackpad, which has no middle button without additional software, and the agent's browser tooling exposes no middle-click action. Neither the anchor-less-cell outcome nor the Date-cell outcome was observed. The row's third component WAS answered: asked directly whether D-12 is accepted as recorded — that on the five anchor-less Records cells modified clicks and middle-click deliberately do nothing, and only the Date cell behaves like a real link, with the concrete consequence that a PR row's Pace cell cannot be Cmd+clicked into a background tab — the developer answered yes, D-12 is accepted as recorded. |
| R21. Drag-selecting text inside a row keeps the selection and does not navigate | UX-01, UX-03 (D-12) | Whether a drag-select is preserved or discarded-and-navigated is a rendered browser fact no text assertion can see. | At `#/records`, press the mouse down inside one of the five **anchor-less** cells (Rank, Time, Pace, Age-Grade or Flags) - **not** the Date cell, press the mouse down, drag across some text (a pace, an age-grade percentage, a rank), and release **inside the row**. The text must stay selected and the page must stay on `#/records`. Copy it with Cmd+C to confirm. Before plan 20-09 this discarded the selection and navigated away. **Required detail:** The text you selected, quoted exactly, and confirmation the page was still showing `#/records` afterwards. | R3-VERDICT: PASS — observed by agent (browser automation against the staged build). A real mouse drag was performed inside the anchor-less Pace cell of the 400m PR table's Rank #1 row, pressing down inside the cell, dragging across the text and releasing inside the row. Afterwards the selection was intact and non-collapsed with `getSelection().toString()` returning exactly "1:53/km", and the page was still on #/records — no navigation occurred. Before plan 20-09 this gesture discarded the selection and navigated away. |

Each row above needs its own independent verdict **and** the specific detail requirement named in
its own Test Instructions cell; a blanket statement covering several rows is not sufficient
evidence, and any row left individually undescribed - or answered without the detail its own row
demands after one re-ask - is recorded as failing for insufficient evidence rather than
manufactured into detail that was never observed. Rows R1, R2, R3, R4, R7, R9 and R10 require both
the light and the dark theme to be named before they can pass.

---

## Checkpoint Outcome (Round 3)

This round's observer split is unusual and is recorded explicitly rather than blurred into a
single "the developer verified" narrative, per the objective's attribution rule. The developer
answered four rows directly (R3, R14, R15 partially — the badge text "no streams" — and R20's D-12
disposition question). The orchestrator performed the remaining rows itself, driving the live
build at `http://localhost:8099/strava-widgets/` through Chrome browser automation — real Tab and
Enter/Space key presses, real clicks including modifier-held clicks, real mouse-down/drag/release
gestures, and computed-style reads on the rendered page. That is genuine observation of the shipped
build, not an automated repo test (no row here is discharged by `npm test`), but it is also not the
developer's own eyes. Every Observation cell above states its observer explicitly: "observed by
developer", "observed by agent (browser automation against the staged build)", or "observed by
developer, corroborated by agent" for R15 and R16 where both contributed.

Final tally, eighteen rows:

- **PASS (13):** R1, R3, R4, R7, R8, R9, R10, R11, R12, R14, R15, R17, R21
- **BLOCKED (2):** R2, R16 — both blocked on the same cause: no row in Overview Recent Activities
  on the current dataset carries a status badge, so the Required-detail quoted badge text could
  not be produced. Not a defect; not exercisable on this data.
- **FAIL (2):** R18, R19 — both against their stated expectation. The D-12 guards are confirmed
  working (a modified click on an anchor-less Records PR-table cell no longer hijacks the current
  tab/window — the BLOCKER plan 20-09 fixed), but the row's second half — a new background tab
  (R18) or a new window (R19) actually opening — does not happen, because the five anchor-less
  cells carry no anchor for the browser to act on. Recorded verbatim per house rule, left unpatched;
  no suggested fix or root-cause remediation is offered here. See the Round 3 Gap-Closure Record
  below.
- **NOT EXERCISABLE (1):** R20 — the developer is on a trackpad with no middle button and the
  agent's browser tooling exposes no middle-click action, so the gesture itself could not be
  performed by either observer. R20's third component — whether D-12 is accepted as recorded — WAS
  answered: the developer accepted D-12 as recorded.
- **Carried forward from Round 2 as passes, not re-asked:** R5, R6, R13.

Because two rows FAIL and three rows are BLOCKED/NOT EXERCISABLE rather than cleanly PASS,
`nyquist_compliant` stays `false` and `status` is set to `partial` — this round closed real ground
(thirteen fresh PASSes plus the three carried-forward Round 2 passes, eighteen rows total answered
on individually-described, per-row evidence for the first time since Round 1) but did not achieve a
clean sweep. See Evidence Quality (Round 3) below.

## Evidence Quality (Round 3)

Every one of the eighteen agenda rows now carries an individually-described, non-blanket
observation — a first for this validation record, which failed on exactly this point in both
Round 1 and Round 2. Thirteen rows are clean PASSes with named Required detail. Two rows (R2, R16)
are honestly recorded BLOCKED rather than forced into PASS or FAIL: the row's claim about
one-tab-stop-per-row and the absent "View Activity" button is confirmed, but the badge-text half of
the Required detail cannot be produced because no Overview Recent Activities row in the current
dataset carries a badge — this is a dataset gap, not a behavioural defect, and not the same thing as
an insufficient-evidence FAIL under the house rule (the evidence given is complete and exhaustive
for what the dataset allows; it is the dataset, not the observation, that is insufficient). Two rows
(R18, R19) are recorded FAIL against their own stated expectation: the newly-added D-12 guards
correctly stop a modified click from hijacking the current tab/window (the BLOCKER plan 20-09 was
built to fix), but the row's full claim — that a new background tab or new window actually opens —
does not hold for the five anchor-less Records PR-table cells, because they carry no anchor. One row
(R20) is recorded NOT EXERCISABLE for a hardware reason external to the application (no middle
button on the developer's trackpad, no middle-click action in the agent's tooling), with its D-12
acceptance question answered directly regardless.

Per this same reasoning, `.planning/REQUIREMENTS.md` is updated using the Round 3 row-to-requirement
map: REC-08 stays ticked (already Complete, not re-litigated). UX-02 is evidenced by R2 (partial —
CTA absence and one-tab-stop confirmed both themes, badge half BLOCKED for dataset reasons) and R4
(full PASS); recorded as partial progress, not ticked, because one of its two mapped rows in this
map (R2) is not a clean PASS. UX-01 and UX-03 both carry the R18/R19 FAILs among their mapped rows
and cannot be marked fully Complete this round; each is recorded as partial/in-progress with a
pointer to R18/R19 as the outstanding evidence.

## Gap-Closure Record (Round 3)

Recorded verbatim rather than patched under checkpoint pressure, per the house rule in force since
checkpoint 16-09. No suggested fix, no root-cause theory, and no severity downgrade is offered below
— these are recorded as findings, not triaged.

### GAP 9 — Anchor-less Records PR-table cells do not open a new tab/window on a modified click

- **Rows blocked:** R18, R19
- **Requirements blocked:** UX-01, UX-03
- **Decisions implicated:** D-12
- **Verbatim observations:**
  - R18 (Cmd/Ctrl+click): a real Cmd+click on the anchor-less Pace cell of the 400m PR table's
    Rank #1 row left the page on `#/records` — the current tab was not hijacked (the fix works) —
    but no new background tab opened. The row's stated expectation ("A new background tab must open
    on that activity") is not met.
  - R19 (Shift+click): a real Shift+click on the same shape of anchor-less cell left the page on
    `#/records` and opened no window. The row's stated expectation ("a new window must open on that
    activity") is not met. The Alt+click half of R19 does pass — the current window does not
    navigate in place.
- **Structural cause, stated as fact only, not as a proposed fix:** `shouldNavigateOnRowClick`
  returns `false` whenever any of `metaKey`/`ctrlKey`/`shiftKey`/`altKey` is set, and the five
  anchor-less cells (Rank, Time, Pace, Age-Grade, Flags) contain no `<a>` element for the browser to
  act on when a modified click reaches them — there is nothing for the browser's own tab/window-open
  behaviour to attach to. The Date cell, which does have a real anchor, was not the subject of R18/
  R19's own instructions (by design, to avoid testing the browser's native anchor handling instead
  of the new guard).
- **Developer's disposition, recorded at the checkpoint:** record both rows as FAIL against their
  stated expectation and let the next planning round own the diagnosis and any decision about
  whether the Records PR-table's five anchor-less cells should become real links (matching
  `list.ts`'s pattern) or whether the row's stated expectation should be revised to match D-12's
  scope. Not implemented here.

### GAP 10 — No badge-carrying row exists in Overview Recent Activities on the current dataset

- **Rows blocked:** R2, R16
- **Requirements blocked:** UX-01, UX-02, UX-03
- **Decisions implicated:** none — this is a dataset-coverage gap, not a decision or a defect
- **Verbatim observations:** all ten Overview Recent Activities rows in the staged build carry
  well-formed accessible names (e.g. "Herlev Running, Aug 11, 2026, 10.0 km") with zero status
  badges among them. The only badges visible anywhere on the Overview page are the `N PR` badges in
  the Recent PRs card (R1/R17's subject, not R2/R16's). R15's Activities mobile card layout does
  carry badge rows (`No streams (no-original)`, `No HR, Low confidence`), confirming badge rendering
  itself works elsewhere — this is specifically an Overview Recent Activities dataset-coverage gap,
  not evidence that badges are broken on that surface.
- **Disposition:** the next planning round needs a dataset containing at least one badge-carrying
  Overview Recent Activities row (or a synthetic fixture) before R2 and R16 can be re-asked
  meaningfully. Not implemented here.

### GAP 11 — Middle-click could not be observed on either the anchor-less cell or the Date cell

- **Row blocked:** R20
- **Requirements blocked:** UX-03 (D-12)
- **Decisions implicated:** D-12 — explicitly re-affirmed by the developer even though the gesture
  itself was not exercisable this round
- **Verbatim observation:** the developer is on a trackpad with no middle button available without
  additional software; the agent's browser automation tooling exposes no middle-click/`auxclick`
  action. Neither the anchor-less-cell outcome nor the Date-cell outcome was observed this round.
- **Disposition:** the developer was asked directly whether D-12 is accepted as recorded regardless
  of the gesture being unobservable this round, and answered yes. Re-observation, if ever needed,
  requires a mouse with a middle button (or equivalent trackpad software) or an automation tool that
  can dispatch a real `auxclick` event. Not implemented here.

---

## Round 4 - Re-run Verifications (gap closure)

`20-VERIFICATION.md` scored 1/4 on Phase 20's success criterion 4 and named three problems: a
newly-found CRITICAL focus-stealing regression in `list.ts` that no Round 3 row exercised (the
`notedActivityId` one-shot hint surviving an empty-filter or error-state `#/list` render and
stealing keyboard focus on a later, unrelated navigation); R18 and R19 recorded FAIL because the
five non-Date Records PR-table cells carried no anchor for a modified click to act on; and R2/R16
recorded BLOCKED because no row in the Overview Recent Activities dataset carried a status badge to
quote. Decisions D-13, D-14 and D-15 were locked in response, and plans 20-12 through 20-17
implemented them: plan 20-12 made the one-shot return-hint consume unconditional, spending it as the
first statement of `mount()` before any render branch can leak it; plan 20-13 refused navigation
whenever a click's `MouseEvent.detail` is greater than 1, so a double-click selects rather than
navigates; plans 20-16 and 20-17 gave every content-carrying cell of both Records tables a real
anchor sharing the Date cell's curated label, at `tabIndex = -1`, styled to read as plain data.

Sixteen Round 3 rows are carried forward below and are not re-asked. R7 and R9 return only because
`20-VERIFICATION.md` recorded that their claims are inherently about appearance — legibility and
hover paint — and that Round 3 settled them with computed-style and selector-structure reads rather
than by a human looking at the screen; they are re-asked of a human here as R33. Rounds 1, 2 and 3
stand exactly as they were recorded above, unedited.

**Fixture disclosure.** To close the R2/R16 dataset gap, the staged build's
`dist/widgets/data/dashboard/index.json` had exactly one boolean edited — after this task's gate ran
and after `build-widgets` had already copied the data into `dist/widgets` — setting `streams.hr` to
`false` on the entry with id `i174109950` ("Herlev Running", the fourth entry of the `activities`
array). `statusBadgeTexts` turns that into the badge string `No HR` on both the Overview Recent
Activities row and the Activities card for the same activity. This is fixture-induced, not organic
archive data: the repository copy at `data/dashboard/index.json` still has `streams.hr === true` for
the same id, and the next `npm run build-widgets` overwrites the staged edit. The badge was confirmed
rendering in the served build before this checkpoint opened, via a headless-Chrome DOM dump of
`http://localhost:8099/strava-widgets/#/`: `aria-label="Herlev Running, Aug 7, 2026, 10.1 km, No
HR"` on that row's anchor.

**Carried forward from Round 3 (not re-asked):**

- **R1** (Overview Recent PRs, one tab stop, Enter activates) — PASS, both themes named; unaffected
  by this round's changes. See R1's Round 3 Observation cell.
- **R3** (Activities desktop table unregressed) — PASS, observed by developer; unaffected by this
  round's changes. See R3's Round 3 Observation cell.
- **R4** (Activities mobile card, one link, no CTA) — PASS, both themes named; unaffected by this
  round's changes. See R4's Round 3 Observation cell.
- **R5** (Records PR tables, six columns) — PASS, carried from Round 2 on a verbatim header
  read-back; column count is unaffected by D-13's cell-link change. See R5's Round 2 Observation
  cell.
- **R6** (Records PR-progression tables, three columns) — PASS, same reasoning as R5. See R6's
  Round 2 Observation cell.
- **R8** (Space does not activate a focused row, per D-02) — PASS; D-02 is untouched by this round's
  plans. See R8's Round 3 Observation cell.
- **R10** (inherited focus ring on a full-width row) — PASS, both themes named; unaffected by this
  round's changes. See R10's Round 3 Observation cell.
- **R11** (clicks land on the correct activity, three screens) — PASS, three distinct ids;
  unaffected by this round's changes. See R11's Round 3 Observation cell.
- **R12** (Calendar day cells untouched) — PASS, both dates named; Calendar is outside this round's
  scope. See R12's Round 3 Observation cell.
- **R13** (return-from-detail focus below 720px) — PASS, carried from Round 2; unaffected by this
  round's changes. See R13's Round 2 Observation cell.
- **R14** (the same above 720px) — PASS, observed by developer; unaffected by this round's changes.
  See R14's Round 3 Observation cell.
- **R15** (badge text in the Activities card's accessible name) — PASS, announcement quoted; CR-02
  is untouched by this round's plans. See R15's Round 3 Observation cell.
- **R17** (`N PR` in the Overview Recent PRs accessible name) — PASS, announcement quoted;
  untouched by this round's plans. See R17's Round 3 Observation cell.

| Behavior | Requirement | Why Manual | Test Instructions | Observation |
|----------|-------------|------------|--------------------|--------------|
| R22. A visit to a detail view no longer steals focus on a later, unrelated list render. | UX-01, UX-03 | module state leaking across two navigations is a rendered-sequence fact no text assertion can see, and no row in three prior rounds exercised it — which is why the regression shipped behind 1022 green tests and 21 genuine browser rows. | open any activity detail view from `#/list`; go back to `#/list`; type a search term that matches nothing so the "no activities" empty state appears; clear the search so rows return. No row may be highlighted, no row may be scrolled to, and keyboard focus must be on the page heading, not on a row. Then repeat once with the browser offline (or with the network panel blocking `data/dashboard/index.json`) so the error state renders instead of the empty state, and confirm the same. **Required detail:** the name of the activity whose detail view you opened, what the page did after clearing the filter (highlight, scroll or focus — or none of the three), and whether you were able to exercise the error-state variant. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R23. Cmd/Ctrl+click on a Records PR-table cell opens a background tab. | UX-01, UX-03 (D-13) | whether a modified click opens a tab or rewrites the current hash is a rendered browser-behaviour fact; the repository's automated proof is a pure predicate that never touches a browser. | at `#/records`, Cmd+click (Ctrl+click on a non-Mac keyboard) a **Rank, Time, Pace or Age-Grade** cell — not the Date cell. A new background tab must open on that activity, and the tab you clicked in must still show `#/records`. Then plain-click the same cell and confirm it navigates in the current tab to that same activity. Round 3 recorded this FAIL: the tab was not hijacked but nothing opened either. **Required detail:** which cell you clicked, the URL of the new tab (it must end `#/activity/<id>`), confirmation the original tab did not navigate, and the activity the plain click opened. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R24. The same, on the PR-progression table. | UX-01, UX-03 (D-13) | same as R23, applied to the second table D-13's heading names and no previous round ever exercised. | at `#/records`, open a distance's PR-progression table and Cmd+click its **Time** or **Improvement** cell — not the Date cell. Same expectation as R23. **Required detail:** which table (which distance) and which cell, and the URL of the new tab. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R25. Shift+click opens a new window; Alt+click does not navigate in place. | UX-01, UX-03 (D-13) | same reasoning as R23/R24: what a modified click does to browser tab/window state is a rendered fact no text assertion can see. | same non-Date cells, either table. Shift+click one — a new window must open on that activity. Then Alt+click one — whatever the browser chooses to do, the current window must not navigate to the activity. Round 3 recorded the Shift half FAIL and the Alt half PASS. **Required detail:** which cell you used for each, that a new window appeared for Shift+click, and what the original window was still showing after each of the two clicks. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R26. Overview Recent Activities behaves identically and carries no button — badge row. | UX-01, UX-02, UX-03 | tab-stop count and Enter activation are rendered-interaction facts, and the absence of a "View Activity" button in the painted card is a visual fact the source guard proves only for source text. | at `http://localhost:8099/strava-widgets/#/`, find the Recent Activities row carrying the `No HR` badge (see the fixture disclosure in this section's preamble). One Tab stop for that row, Enter navigates to that activity, and no "View Activity" button appears anywhere in the card. Both themes. Round 3 recorded this BLOCKED because no badge-carrying row existed. **Required detail:** the badge text quoted exactly, the name on the row, and both theme names. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R27. The same row's accessible name includes its badge text. | UX-03 (CR-02) | this repository has no way to compute an accessible name; the automated proof covers only the composed string. | with VoiceOver (Cmd+F5) navigate to that same `No HR` row on Overview and report what is announced. If you would rather not run VoiceOver, say so — the agent will instead read the composed accessible name off the rendered card and the Observation cell will record that substitution explicitly, exactly as Round 3 did for R17. Round 3 recorded this BLOCKED for want of a badge-carrying row. **Required detail:** the announced or composed string quoted verbatim, including the badge text. **Observer required:** developer or agent (the Observation cell must name which, and must say if VoiceOver was declined). | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R28. Middle-click, and what D-13 changes about D-12. | UX-03 (D-12, D-13) | `auxclick` behaviour cannot be observed by any test in this repository. | Round 3 recorded this NOT EXERCISABLE — a trackpad has no middle button and the agent's tooling exposes no middle-click action. If you now have a mouse with a middle button, middle-click a non-Date Records cell: with D-13's anchor under the pointer, the browser's own middle-click should open a new tab, natively, with no `auxclick` handler in this codebase. If you do not, say so and the row is recorded NOT EXERCISABLE again. Either way, confirm the disposition in writing: D-12's "`auxclick` is deliberately not handled" clause stands and nothing is synthesised; D-13 makes it no longer load-bearing on these cells because the browser now has an `<a>` to act on. **Required detail:** whether the gesture was performed at all, its outcome if so, and an explicit yes or no on the stated disposition. **Observer required:** developer's own eyes. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R29. The Records tables look exactly as they did. | UX-03 (D-06, D-13) | whether seven new anchors per row changed the tables' appearance is a perceptual question, and this repository's only check is that a CSS rule's text exists. | at `#/records`, look at a PR table and a PR-progression table. The Rank, Time, Pace, Age-Grade, Flags, Time and Improvement values must read as plain data — **not underlined**, not a different colour, numbers still right aligned. The Date cell must still read as a link. Hovering a row must still light the whole row and show a pointer cursor. Both themes. **Required detail:** whether any value is underlined, whether the Date cell still reads as a link, whether the row hover and pointer are unchanged, and both theme names. **Observer required:** developer's own eyes. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R30. Keyboard tab order through the Records tables is still one stop per row. | UX-03 (D-13) | tab-stop count is a rendered-interaction fact, and D-13 added six or seven anchors per row whose `tabindex="-1"` is the only thing keeping them out of the order. | at `#/records`, click the page background and Tab forward into a PR table. Each row must take exactly one Tab press — landing on the Date link — not six. Press Enter on one and confirm it opens that activity. Repeat in a progression table. **Required detail:** how many Tab presses moved you from one row to the next in each table, and the activity Enter opened. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R31. Drag-selecting text inside a now-anchored cell still selects. | UX-01, UX-03 (D-12, D-13) | whether a drag starting on an anchor becomes a text selection or a link drag is a rendered browser fact. | at `#/records`, press the mouse down inside a Pace or Age-Grade cell, drag across the text, release inside the row. The text must stay selected, no link-drag ghost image may appear, and the page must stay on `#/records`. Copy with Cmd+C to confirm. Round 3 recorded this PASS before the cell had an anchor under the pointer. **Required detail:** the text you selected quoted exactly, whether a drag ghost appeared, and confirmation the page was still on `#/records`. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R32. Double-clicking a value selects the word instead of navigating. | UX-01, UX-03 (D-14) | the browser fires the first click of a double-click before the word selection exists, so only a real double-click can exercise the new refusal. | at `#/records`, double-click a Pace or Time value on a PR-table row. The word must select and the page must stay on `#/records` — before D-14 the first click navigated away before the selection happened. **Required detail:** the value you double-clicked quoted exactly, whether it ended up selected, and what the URL was afterwards. **Observer required:** developer or agent. | PENDING — awaiting Round 4 checkpoint (Task 2). |
| R33. The two appearance claims Round 3 settled by measurement, re-asked of a human. | UX-03 (D-06, D-10) | `20-VERIFICATION.md` recorded that these two rows' claims are inherently about legibility and paint, and that Round 3 settled them with computed-style and selector-structure reads rather than by a human looking at the screen. | two parts, answered separately: (a) hover the rows of the Riegel race-predictions table at `#/records`, the gear/shoe table and the other table at `#/trends`, and the best-efforts table on any activity detail view — none may show a pointer cursor or light up on hover; (b) look at the nav brand ("Training Dashboard", top left) and the "‹ Newer" / "Older ›" links on an activity detail view — both must read in the normal text colour, legible against the page, not browser-default blue and not invisible. Both themes, both parts. **Required detail:** all four table names with pointer and hover stated for each, your own words on how the brand and pager links read in each theme, and both theme names. **Observer required:** developer's own eyes. | PENDING — awaiting Round 4 checkpoint (Task 2). |

Each row above needs its own independent verdict, its own detail named in that row's Test
Instructions cell, and its own observer named — a blanket statement covering several rows is not
sufficient evidence. Any row left individually undescribed, or answered without the detail its own
row demands after one re-ask, is recorded as failing for insufficient evidence rather than
manufactured into detail that was never observed. Rows R26, R29 and R33 need both the light and the
dark theme named before they can pass. Rows R28, R29 and R33 cannot be discharged by agent
automation — their Observation cell must say "observed by developer" or the row is recorded BLOCKED
with the decline quoted.
