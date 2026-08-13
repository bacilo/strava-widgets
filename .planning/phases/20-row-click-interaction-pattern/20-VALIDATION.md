---
phase: 20
slug: row-click-interaction-pattern
status: pending
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
| 1. Overview Recent PRs rows are single tab stops that activate on Enter | UX-01, UX-03 | Tab-stop count and activation are rendered-interaction facts; no text assertion can count keyboard stops or observe an Enter-triggered navigation. | At `http://localhost:8099/strava-widgets/#/`, click the page background, then Tab forward past the nav into the Recent PRs card. Each PR row must take **exactly one** Tab press to reach — not three (name, meta, badge). Press Enter on one; confirm the detail view for that activity opens. Both themes. | PENDING — awaiting Task 2 human browser checkpoint. |
| 2. Overview Recent Activities rows behave identically and carry no button | UX-01, UX-02, UX-03 | Tab-stop count and Enter-activation are rendered-interaction facts; the absence of a "View Activity" button in the rendered card is a visual/DOM fact this suite's source-structure guard proves only for source text, not for what actually paints. | Same page, Recent Activities card. One Tab stop per row, Enter navigates, and there is **no "View Activity" button** anywhere in the card. Both themes. | PENDING — awaiting Task 2 human browser checkpoint. |
| 3. Activities desktop table is unregressed | ACT-01, UX-01 | This is the reference interaction model Phase 19's criterion 4 protected; a regression here is the phase's biggest risk, and click-lands-once-not-twice is a rendered navigation fact no text assertion can see. | At `#/list` on a wide window, click a row anywhere outside the Activity link — it navigates. Tab into the table: the Activity-cell link is the row's tab stop and Enter activates it. Clicking the Activity link itself navigates **once**, not twice (no flicker through an intermediate view). Both themes. | PENDING — awaiting Task 2 human browser checkpoint. |
| 4. Activities mobile card view is one link with no CTA | UX-02, UX-03 | Card-layout breakpoint behavior, tab-stop count, and the absence of a rendered CTA are all rendered facts. | At `#/list`, narrow the window until the card view replaces the table. Each card is one tab stop, Enter navigates, and the "View Activity" button that used to sit inside each card is gone. Both themes. | PENDING — awaiting Task 2 human browser checkpoint. |
| 5. Records PR tables navigate on row click, with six columns | REC-08, UX-01, UX-02 | Column count is visible only in the rendered header; click-lands-on-correct-activity and pointer/hover before-vs-after are rendered facts. | At `#/records`, confirm each PR table header reads Rank, Time, Pace, Age-Grade, Date, Flags — **six columns, no Activity column and no "View Activity" button**. Click a row anywhere outside the date link: it navigates to that activity. Tab reaches the Date link; Enter activates it. These rows previously showed a pointer cursor and a hover highlight while having no click handler at all — this is the before/after worth looking at. | PENDING — awaiting Task 2 human browser checkpoint. |
| 6. Records PR-progression tables, three columns, same behaviour | REC-08, UX-02 | Same reasoning as row 5, applied to the progression table's `<details>`-nested rows. | At `#/records`, expand a PR-evolution card's `<details>`. Header reads Date, Time, Improvement — **three columns, no Run column**. Row click navigates; the Date link is the tab stop; Enter activates. | PENDING — awaiting Task 2 human browser checkpoint. |
| 7. Non-activity tables no longer advertise a click | UX-03 (D-10) | Cursor shape and hover paint are rendered facts no text assertion can see. | Hover the rows of the Riegel race-predictions table at `#/records`, the gear/shoe table and the other table at `#/trends`, and the best-efforts table on any activity detail view. For all four: **no pointer cursor and no hover highlight**. Both themes. | PENDING — awaiting Task 2 human browser checkpoint. |
| 8. Space does not activate a focused row, and that is correct | UX-03 (D-02) | Whether a key press scrolls the page versus navigates is a rendered browser-behavior fact. | Focus an Overview row with Tab, press **Space**. Expected: the page scrolls and **no navigation happens**. This is deliberate — an `<a href>` takes Enter, Space is the page-scroll key, and hijacking it on a full-width row surprises keyboard users. Record this as PASS when Space scrolls without navigating. Do **not** file it as a defect. | PENDING — awaiting Task 2 human browser checkpoint. |
| 9. The shared link treatment did not make anything look wrong | UX-03 (D-06) | This phase added the first bare `a` rule the stylesheet has ever had, changing two anchors that were previously rendering browser-default blue; whether the resulting colour is legible is a perceptual/computed-style question. | Check the nav brand ("Training Dashboard", top left, every screen) and the "‹ Newer" / "Older ›" links on an activity detail view. Both must read in the normal text colour, legible against the page in **both themes**, not browser-default blue and not invisible. Also confirm the Records Date links and the Activities Activity links are visibly links. | PENDING — awaiting Task 2 human browser checkpoint. |
| 10. The inherited focus ring on a full-width row | UX-03 (D-11) | This repository cannot render-test, which is exactly why no row-specific ring variant was built speculatively; whether the ring is clipped or occluded is a rendered-layout question. | Tab through Overview rows and Activities cards in both themes. The 4px ring must be fully visible — not clipped by a container, not overlapping the neighbouring row, not occluded by the sticky nav when the focused row scrolls under it. If it reads badly, record the developer's words verbatim; that becomes gap-closure work with rendered evidence behind it, matching Phase 19's process. Do not patch it here. | PENDING — awaiting Task 2 human browser checkpoint. |
| 11. Clicks land on the *correct* activity | UX-01, criterion 4 | No check in this repository can compare a clicked row against the view that opened. | Pick three rows on three different screens (one Overview Recent PR, one Records PR table row, one Activities row). For each, note the row's visible date and distance before clicking, then confirm the detail view that opens shows the **same** activity. Record the three activity ids or dates observed. | PENDING — awaiting Task 2 human browser checkpoint. |
| 12. Calendar day cells are untouched | UX-01 (no-regression) | These are already-compliant real `<button>` elements this phase deliberately did not modify; confirming nothing leaked into them requires exercising them in a real browser. | At `#/calendar`, click a day with a single run — it navigates to that activity; click a day with multiple runs — the picker opens. | PENDING — awaiting Task 2 human browser checkpoint. |

---

## Gap-Closure Record

None yet — populated by Task 2 only if any row fails.
