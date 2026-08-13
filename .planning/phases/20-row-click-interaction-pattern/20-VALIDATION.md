---
phase: 20
slug: row-click-interaction-pattern
status: partial
nyquist_compliant: false
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
