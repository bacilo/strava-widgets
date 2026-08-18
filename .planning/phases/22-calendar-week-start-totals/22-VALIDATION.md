---
phase: 22
slug: calendar-week-start-totals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `22-RESEARCH.md` § Validation Architecture.

**House rule (PROJECT.md line 49):** automated gates have missed rendering defects three
times in this project. **Unit tests never discharge a visual claim.** Every criterion below
that touches rendering or interaction carries a mandatory human-observation row; only the
pure grid-math and pure-persistence derivations are unit-dischargeable end to end.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already project-wide; 20+ test files in `src/dashboard/views/`) |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']`. **No jsdom** — there is no DOM emulation in this repo. |
| **Quick run command** | `npx vitest run src/dashboard/views/calendar-logic.test.ts src/dashboard/views/calendar-preferences.test.ts` |
| **Full suite command** | `npm test` (→ `vitest run`) |
| **Estimated runtime** | ~5 s quick · ~30 s full suite |

**Phase gate commands (all must exit 0 before the human checkpoint):**
`npm test` · `npm run build` (tsc) · `npm run build-widgets` · `npm run verify-dashboard`

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/dashboard/views/calendar-logic.test.ts src/dashboard/views/calendar-preferences.test.ts`
- **After every plan wave:** `npm test` — confirms no regression in `trends-logic.test.ts` /
  `records-logic.test.ts`, which read the same Monday-fixed `weekStartISO` convention this
  phase deliberately does **not** touch (D-15)
- **Before `/gsd-verify-work`:** full suite green + clean `tsc` + clean widget build + clean
  `verify-dashboard`, **then** the mandatory browser checkpoint
- **Max feedback latency:** ~5 seconds (quick run)

---

## Per-Task Verification Map

Task IDs are assigned by the planner. This map is keyed by requirement until plans exist;
the planner must attach each row to a concrete task ID and the executor updates Status.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | CAL-01 | T-22-WK-01 | `parseWeekStart` allow-lists only `'sunday'` / `'monday'`; anything else (null, `''`, `'MONDAY'`, `'3'`, object) silently falls back to `'monday'` with no console noise and no key rewrite (D-07) | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ❌ W0 (new file) | ⬜ pending |
| TBD | TBD | 0 | CAL-01 | T-22-WK-02 | Throwing `storage.getItem` / `setItem` (Safari private mode, disabled cookies, quota) is caught; read falls back to the default, write failure is swallowed — mirrors `theme.ts` | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ❌ W0 (new file) | ⬜ pending |
| TBD | TBD | 0 | CAL-02 | — | `buildMonthGrid` leading padding correct for **both** `'sunday'` and `'monday'`; every pre-existing expectation re-pinned to pass `'sunday'` **explicitly** (D-03/D-08 — no default parameter) | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ exists, needs W0 edits | ⬜ pending |
| TBD | TBD | 0 | CAL-02 | — | Week-total derivation sums only the non-null in-month `DayCell`s per row (D-13); correct under both week starts; empty week yields the `–` case (D-12); partial week flagged for the accessible name (D-14) | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ❌ W0 (new cases in existing file) | ⬜ pending |
| TBD | TBD | — | CAL-01 | — | Control renders, toggles, and the choice **survives a real browser reload** | manual-only | — (no jsdom; a real reload cannot be exercised in a Node-environment Vitest run) | N/A | ⬜ pending |
| TBD | TBD | — | CAL-02 | — | Total cell **actually renders** at the end of each week row with correct on-screen numbers for a boundary week | manual-only | — (DOM rendering) | N/A | ⬜ pending |
| TBD | TBD | — | CAL-03 | — | Segmented control visually inherits Phase 19's button baseline, shared hover, `:disabled` treatment and two-tone focus ring, in **both** themes | manual-only | — (visual claim; house rule forbids discharging by unit test) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Optional source-structure guard (planner's call, not required):** a parse-level assertion
that the new `.segmented` markup structurally matches the two shipped instances, following
the `styles.test.ts` precedent from Phase 19. This guards *structure*, not appearance — it
does not discharge CAL-03's visual claim.

---

## Wave 0 Requirements

- [ ] `src/dashboard/views/calendar-preferences.test.ts` — **new file.** Covers CAL-01's pure
      persistence functions: `parseWeekStart` / `readStoredWeekStart` / `writeWeekStart`,
      default-to-Monday, tamper tolerance, throwing-storage tolerance. Injectable `storage`
      per D-05, so no DOM is needed.
- [ ] `src/dashboard/views/calendar-logic.test.ts` — **edits to existing file.** Every existing
      Sunday-first `buildMonthGrid` expectation re-pinned to pass `'sunday'` explicitly (D-03);
      new Monday-start cases over the same fixture months; new week-total derivation cases
      (full week, partial/boundary week, empty week — each under both week starts).
- [ ] Framework install: **none.** Vitest is already configured and in use in this exact directory.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Week-start choice persists across a real page reload | CAL-01 | `vitest.config.ts` is `environment: 'node'` with no jsdom; a genuine `localStorage`-across-reload round trip has no automated harness in this repo | Serve under `/strava-widgets`, set the toggle to Sunday, hard-reload, confirm Sunday is still selected and the grid is still Sunday-first |
| Grid re-flows and week totals recompute correctly across the boundary | CAL-02 | Rendering claim; house rule forbids discharging by unit test | Navigate to **October 2025** and read back the D-16 discriminator values below — read the numbers, do not merely confirm a total is present |
| Segmented control inherits Phase 19 styling | CAL-03 | Visual claim | Confirm hover, `:focus-visible` two-tone ring, active/inactive contrast, in both light and dark themes |
| `.calendar-header` baseline alignment across five controls | CAL-03 (D-02) | Visual claim; `align-items: baseline` across mixed control heights is the flagged snag | Confirm the month total, both nav buttons, the month input and the segmented group sit on a coherent baseline |
| 8-column grid on a phone | CAL-02 (D-10) | Visual claim; RESEARCH flags the mobile strategy as its one MEDIUM-confidence recommendation (A4) | Confirm at a narrow viewport that the 8th column does not crush the day columns or overflow the panel |
| First-load re-flow after ship | — (D-03 consequence) | Expected behaviour change, not a regression — must be consciously observed, not silently absorbed | Confirm the deployed calendar re-flows to Monday-first on first load with no stored preference, and that this is understood as intended |

### D-16 Discriminator — October 2025 (read back, do not merely confirm presence)

Computed against the live committed `data/dashboard/index.json` (1,868 activities,
`generatedAt: 2026-08-12`). Qualifies because exactly one activity falls on a Sunday:
**Oct 19, 2025, 24.0 km, 2h 31m** — a single-variable boundary case. Oct 1, 2025 is a
Wednesday, so leading padding is 3 under Sunday-start and 2 under Monday-start.

**Sunday-start:**

| Row | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–4 | 59.1 km | 5h 42m | 5 |
| 2 | 5–11 | 80.0 km | 7h 53m | 6 |
| **3** | **12–18** | **56.0 km** | **5h 27m** | **4** |
| **4** | **19–25** | **104.1 km** | **10h 14m** | **7** |
| 5 | 26–31 | 58.1 km | 5h 32m | 5 |

**Monday-start:**

| Row | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–5 | 59.1 km | 5h 42m | 5 |
| 2 | 6–12 | 80.0 km | 7h 53m | 6 |
| **3** | **13–19** | **80.0 km** | **7h 58m** | **5** |
| **4** | **20–26** | **80.0 km** | **7h 42m** | **6** |
| 5 | 27–31 | 58.1 km | 5h 32m | 5 |

**Why this is a real discriminator:** toggling Sunday→Monday must turn rows 3/4 from
`56.0 km / 4 runs` and `104.1 km / 7 runs` into `80.0 km / 5 runs` and `80.0 km / 6 runs`.
A toggle that re-paints the grid without actually re-grouping the weeks would leave
56.0/104.1 in place. The two Monday rows landing on the *same* 80.0 km display value while
carrying *different* run counts (5 vs 6) is the additional tell.

**Known rounding artifact — not a bug:** Monday-start rows display-sum to 357.2 km against
the month total's displayed 357.3 km, from independent `toFixed(1)` per row. Unrounded
metres reconcile exactly (357.349 km) under both week starts. Do not report this as a
computation error at the checkpoint.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`calendar-preferences.test.ts`, re-pinned `calendar-logic.test.ts`)
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 10s
- [ ] Human checkpoint reads back the October 2025 values above, both week starts
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
