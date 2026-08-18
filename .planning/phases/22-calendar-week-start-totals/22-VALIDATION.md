---
phase: 22
slug: calendar-week-start-totals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
planned: 2026-08-18
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `22-RESEARCH.md` § Validation Architecture.
> Task IDs assigned by the planner 2026-08-18 (plans `22-01` … `22-05`).

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
| **Quick run command** | `npx vitest run src/dashboard/views/calendar-logic.test.ts src/dashboard/views/calendar-preferences.test.ts src/dashboard/views/calendar.test.ts` |
| **Full suite command** | `npm test` (→ `vitest run`) |
| **Estimated runtime** | ~5 s quick · ~30 s full suite |

**Phase gate commands (all must exit 0 before the human checkpoint):**
`npm test` · `npm run build` (tsc) · `npm run build-widgets` · `npm run verify-dashboard`

Plans use `npx tsc --noEmit -p tsconfig.json` in per-task gates (same type-check, no emit).
Because `tsconfig.json` has `include: ["src/**/*"]`, the type-check covers all 49 test files —
this is what makes D-08's required `weekStart` parameter enforceable rather than advisory.

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/dashboard/views/calendar-logic.test.ts
  src/dashboard/views/calendar-preferences.test.ts src/dashboard/views/calendar.test.ts`
- **After every plan wave:** `npm test` — confirms no regression in `trends-logic.test.ts` /
  `records-logic.test.ts`, which read the same Monday-fixed `weekStartISO` convention this
  phase deliberately does **not** touch (D-15)
- **Before `/gsd-verify-work`:** full suite green + clean `tsc` + clean widget build + clean
  `verify-dashboard`, **then** the mandatory browser checkpoint (plan `22-05`)
- **Max feedback latency:** ~5 seconds (quick run)

**Sampling continuity:** no plan has three consecutive tasks without an `<automated>` verify.
Every task in `22-01` … `22-04` carries one; `22-05`'s Task 1 and Task 3 carry one each, and
its Task 2 is the blocking human checkpoint by design.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-02-T1 | 22-02 | 2 | CAL-01 | T-22-WK-01 | `parseWeekStart` allow-lists only `'sunday'` / `'monday'`; anything else (null, `''`, `'MONDAY'`, `'3'`, object) silently falls back to `'monday'` with no console noise and no key rewrite (D-07) | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 22-02-T1 | 22-02 | 2 | CAL-01 | T-22-WK-02 | Throwing `storage.getItem` / `setItem` (Safari private mode, disabled cookies, quota) is caught; read falls back to the default, write failure is swallowed — mirrors `theme.ts` | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 22-01-T1, 22-01-T2 | 22-01 | 1 | CAL-02 | — | `buildMonthGrid` leading padding correct for **both** `'sunday'` and `'monday'`; every pre-existing expectation re-pinned to pass `'sunday'` **explicitly** (D-03/D-08 — no default parameter) | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ exists, needs W0 edits | ⬜ pending |
| 22-01-T2 | 22-01 | 1 | CAL-02 | — | Week-total derivation sums only the non-null in-month `DayCell`s per row (D-13); correct under both week starts; a zero-run week yields zeros (the `–` is a render decision, D-12); partial week flagged via `isPartial` for the accessible name (D-14) | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ❌ W0 (new cases in existing file) | ⬜ pending |
| 22-03-T1 | 22-03 | 3 | CAL-02 | — | `formatWeekDuration` is pinned to archive-derived seconds→string pairs (round-to-nearest-minute, load-bearing for the checkpoint read-back), and `weekTotalAccessibleName` to the four D-12/D-14 sentence shapes | unit | `npx vitest run src/dashboard/views/calendar.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 22-04-T2 | 22-04 | 4 | CAL-01 | — | Source-structure guard: `setWeekStart`'s body contains none of `focus` / `mount(` / `navigateTo` / `await` (D-04), and the `.segmented` markup matches the two shipped instances (D-01). **Guards source shape only — does NOT discharge CAL-03's visual claim** | unit (source guard) | `npx vitest run src/dashboard/views/calendar.test.ts` | ❌ W0 (added to the 22-03 file) | ⬜ pending |
| 22-05-T2 (R2, R5, R7, R8) | 22-05 | 5 | CAL-01 | T-22-WK-01 | Control renders, toggles, keeps focus on the pressed option, clears an open picker, the choice **survives a real browser reload**, and a devtools-tampered `'MONDAY'` renders Monday-first without being repaired | manual-only | — (no jsdom; a real reload and a real focus observation cannot be exercised in a Node-environment Vitest run) | N/A | ⬜ pending |
| 22-05-T2 (R3, R4, R6, R11) | 22-05 | 5 | CAL-02 | — | Total cell **actually renders** at the end of each week row with correct on-screen numbers for the October 2025 boundary weeks under both week starts; a rest week shows only `–`; eight columns survive a narrow viewport | manual-only | — (DOM rendering) | N/A | ⬜ pending |
| 22-05-T2 (R9, R10) | 22-05 | 5 | CAL-03 | — | Segmented control visually inherits Phase 19's button baseline, shared hover and two-tone focus ring in **both** themes, and `.calendar-header`'s `align-items: baseline` holds across five mixed-height controls | manual-only | — (visual claim; house rule forbids discharging by unit test) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Optional source-structure guard — taken.** Plan `22-04` Task 2 implements it in
`src/dashboard/views/calendar.test.ts` following the `row-semantics.test.ts` precedent. It
guards *structure*, not appearance; it does not discharge CAL-03's visual claim.

---

## Wave 0 Requirements

- [ ] `src/dashboard/views/calendar-preferences.test.ts` — **new file** (plan `22-02`, Task 1).
      Covers CAL-01's pure persistence functions: `parseWeekStart` / `readStoredWeekStart` /
      `writeWeekStart`, default-to-Monday, tamper tolerance, throwing-storage tolerance.
      Injectable `storage` per D-05, so no DOM is needed.
- [ ] `src/dashboard/views/calendar-logic.test.ts` — **edits to existing file** (plan `22-01`,
      Tasks 1 and 2). Every existing Sunday-first `buildMonthGrid` expectation re-pinned to pass
      `'sunday'` explicitly and to say so in its title (D-03); new Monday-start cases over the same
      fixture months; new week-total derivation cases (full week, partial/boundary week, rest week,
      multi-run day, NaN coercion, month-total reconciliation — under both week starts).
- [ ] `src/dashboard/views/calendar.test.ts` — **new file** (plan `22-03`, Task 1; extended by plan
      `22-04`, Task 2). Covers the exported pure view helpers and the source-structure guards.
- [ ] Framework install: **none.** Vitest is already configured and in use in this exact directory.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Checkpoint Row |
|----------|-------------|------------|----------------|
| Week-start choice persists across a real page reload | CAL-01 | `vitest.config.ts` is `environment: 'node'` with no jsdom; a genuine `localStorage`-across-reload round trip has no automated harness in this repo | R7 |
| First-load default is Monday and the deployed calendar re-flows | CAL-01 (D-03) | Expected behaviour change, not a regression — must be consciously observed, not silently absorbed | R2 |
| Focus stays on the pressed option; an open picker is cleared | CAL-01 (D-04, DISC-7) | No DOM, no focus observation possible in Node | R5 |
| A tampered stored value falls back and is not repaired | CAL-01 (T-22-WK-01, D-07) | Unit-simulated already; observed in a real browser here | R8 |
| Grid re-flows and week totals recompute correctly across the boundary | CAL-02 (D-16) | Rendering claim; house rule forbids discharging by unit test | R3, R4 |
| A rest week shows only the en-dash | CAL-02 (D-12) | Rendering claim | R6 |
| 8-column grid on a phone | CAL-02 (D-10) | Visual claim; RESEARCH flags the mobile strategy as its one MEDIUM-confidence recommendation (A4) | R11 |
| `.calendar-header` baseline alignment across five controls | CAL-03 (D-02) | Visual claim; `align-items: baseline` across mixed control heights is the flagged snag | R9 |
| Segmented control inherits Phase 19 styling | CAL-03 | Visual claim | R10 |

### D-16 Discriminator — October 2025 (read back, do not merely confirm presence)

Computed against the live committed `data/dashboard/index.json` (1,868 activities,
`generatedAt: 2026-08-12`) and independently recomputed during planning. Qualifies because
exactly one activity falls on a Sunday: **Oct 19, 2025, 24.0 km, raw moving time 2h 31m 37s**
— a single-variable boundary case. Oct 1, 2025 is a Wednesday, so leading padding is 3 under
Sunday-start and 2 under Monday-start.

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

**Time format is load-bearing.** These times use round-to-nearest-minute
(`Math.round(sec / 60)`), which plan `22-03` locks into `formatWeekDuration` and pins by unit
test. Truncating instead shifts five of the ten rows by one minute and would produce a false
FAIL at the checkpoint. Exact seconds: 20500 → 5h 42m · 28378 → 7h 53m · 19594 → 5h 27m ·
36831 → 10h 14m · 19911 → 5h 32m · 28691 → 7h 58m · 27734 → 7h 42m.

**Known rounding artifact — not a bug:** Monday-start rows display-sum to 357.2 km against
the month total's displayed 357.3 km, from independent `toFixed(1)` per row. Unrounded
metres reconcile exactly (357.349 km) under both week starts. Do not report this as a
computation error at the checkpoint.

### D-12 rest-week month — June 2025 (also read from the live archive during planning)

Under Monday-start, June 2025 has a full zero-run week covering **June 16–22** (7 days, no
runs), and its first row is **June 1 alone** (1 day, no runs). Both cells must render the
en-dash `–` with no time line and no `×N` line. Checkpoint row R6.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`calendar-preferences.test.ts`, `calendar.test.ts`,
      re-pinned `calendar-logic.test.ts`)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 10s
- [x] Human checkpoint reads back the October 2025 values above, both week starts (plan `22-05`,
      rows R3 and R4)
- [ ] `nyquist_compliant: true` set in frontmatter — set by plan `22-05` Task 3, only if all
      eleven checkpoint rows PASS

**Approval:** planned 2026-08-18; checkpoint pending (plan `22-05`).
