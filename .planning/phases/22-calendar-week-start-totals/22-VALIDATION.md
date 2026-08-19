---
phase: 22
slug: calendar-week-start-totals
status: partial
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
planned: 2026-08-18
round: 4
round1_staged: 2026-08-18
round1_answered: 2026-08-18
round2_staged: 2026-08-18
round2_answered: 2026-08-18
round3_staged: 2026-08-18
round3_answered: 2026-08-19
round4_planned: 2026-08-19
round4_staged: 2026-08-19
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
| 22-02-T1 | 22-02 | 2 | CAL-01 | T-22-WK-01 | `parseWeekStart` allow-lists only `'sunday'` / `'monday'`; anything else (null, `''`, `'MONDAY'`, `'3'`, object) silently falls back to `'monday'` with no console noise and no key rewrite (D-07) | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ✅ exists | ✅ green (npm test 1203/1203, plan 22-05 Task 1 gate) |
| 22-02-T1 | 22-02 | 2 | CAL-01 | T-22-WK-02 | Throwing `storage.getItem` / `setItem` (Safari private mode, disabled cookies, quota) is caught; read falls back to the default, write failure is swallowed — mirrors `theme.ts` | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ✅ exists | ✅ green (npm test 1203/1203, plan 22-05 Task 1 gate) |
| 22-01-T1, 22-01-T2 | 22-01 | 1 | CAL-02 | — | `buildMonthGrid` leading padding correct for **both** `'sunday'` and `'monday'`; every pre-existing expectation re-pinned to pass `'sunday'` **explicitly** (D-03/D-08 — no default parameter) | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ exists | ✅ green (npm test 1203/1203, plan 22-05 Task 1 gate) |
| 22-01-T2 | 22-01 | 1 | CAL-02 | — | Week-total derivation sums only the non-null in-month `DayCell`s per row (D-13); correct under both week starts; a zero-run week yields zeros (the `–` is a render decision, D-12); partial week flagged via `isPartial` for the accessible name (D-14) | unit | `npx vitest run src/dashboard/views/calendar-logic.test.ts` | ✅ exists | ✅ green (npm test 1203/1203, plan 22-05 Task 1 gate) |
| 22-03-T1 | 22-03 | 3 | CAL-02 | — | `formatWeekDuration` is pinned to archive-derived seconds→string pairs (round-to-nearest-minute, load-bearing for the checkpoint read-back), and `weekTotalAccessibleName` to the four D-12/D-14 sentence shapes | unit | `npx vitest run src/dashboard/views/calendar.test.ts` | ✅ exists | ✅ green (npm test 1203/1203, plan 22-05 Task 1 gate) |
| 22-04-T2 | 22-04 | 4 | CAL-01 | — | Source-structure guard: `setWeekStart`'s body contains none of `focus` / `mount(` / `navigateTo` / `await` (D-04), and the `.segmented` markup matches the two shipped instances (D-01). **Guards source shape only — does NOT discharge CAL-03's visual claim** | unit (source guard) | `npx vitest run src/dashboard/views/calendar.test.ts` | ✅ exists | ✅ green (npm test 1203/1203, plan 22-05 Task 1 gate) |
| 22-05-T2 (R2, R5, R7, R8) | 22-05 | 5 | CAL-01 | T-22-WK-01 | Control renders, toggles, keeps focus on the pressed option, clears an open picker, the choice **survives a real browser reload**, and a devtools-tampered `'MONDAY'` renders Monday-first without being repaired | manual-only | — (no jsdom; a real reload and a real focus observation cannot be exercised in a Node-environment Vitest run) | N/A | ✅ green (Round 1: R2, R5, R7, R8 all PASS. Round 2: R15 PASS — the blocked-storage path was observed closed in a real browser via a hash navigation; R16 BLOCKED — declined by the developer, informational only, does not gate. Round 3: R22 PASS — the app-level blocked-site-data path closed end to end in Safari with "Block all cookies", developer-observed, non-waivable; R23 PASS — theme persistence confirmed after the R22 setting was restored, week-start persistence half thin/unre-stated) |
| 22-05-T2 (R3, R4, R6, R11) | 22-05 | 5 | CAL-02 | — | Total cell **actually renders** at the end of each week row with correct on-screen numbers for the October 2025 boundary weeks under both week starts; a rest week shows only `–`; eight columns survive a narrow viewport | manual-only | — (DOM rendering) | N/A | ✅ green (Round 1: R3, R4, R6 PASS; R11 FAIL — day-cell values overflow at narrow viewport. Round 2: R14 PASS — the Monday-start week-total regression check is clean; R13 FAIL — the R11 re-ask against the Round 2 build still overflows the day columns, quoted verbatim by the developer. Round 3: R19 PASS — the R11/R13 re-ask, third time, at a stated 375px with `matchMedia('(max-width: 380px)').matches` confirmed `true`; no overflow, clipping or truncation, values wrap instead; R20 PASS — Monday-start regression check clean) |
| 22-05-T2 (R9, R10) | 22-05 | 5 | CAL-03 | — | Segmented control visually inherits Phase 19's button baseline, shared hover and two-tone focus ring in **both** themes, and `.calendar-header`'s `align-items: baseline` holds across five mixed-height controls | manual-only | — (visual claim; house rule forbids discharging by unit test) | N/A | ✅ green (Round 1: R9, R10 both PASS. Round 2: R17 PASS — confirm-unregressed, the `Total` header still sits right-aligned over the widest week-total cell; does not re-gate CAL-03. Round 3: R21 PASS — confirm-unregressed, thin/waived, header alignment and `Total`-over-values confirmed good; does not re-gate CAL-03) |
| 22-06-T3 | 22-06 | 6 | CAL-02 | — | The 380px compaction declarations and the `Total` header modifier are guarded with at-rule-override-aware assertions | unit | `npx vitest run src/dashboard/styles.test.ts` | ✅ exists | ✅ green (npm test 1222/1222, plan 22-08 Task 1 gate) |
| 22-07-T1 | 22-07 | 7 | CAL-01 | T-22-WK-02 | A storage stand-in whose property getter throws resolves to a null handle and the read falls back to the Monday default | unit | `npx vitest run src/dashboard/views/calendar-preferences.test.ts` | ✅ exists | ✅ green (npm test 1222/1222, plan 22-08 Task 1 gate) |
| 22-09-T2 | 22-09 | 9 | CAL-02 | — | The BL-01/BL-02 380px overrides are asserted BY VALUE via `atRuleBodiesFor`, not merely proven to exist | unit | `npx vitest run src/dashboard/styles.test.ts` | ✅ exists | ✅ green (npm test 1253/1253, plan 22-12 Task 1 gate) |
| 22-11-T3 | 22-11 | 10 | CAL-01 | T-22-WK-02 | `resolveStorage` guards the property getter app-wide, both its failing and its live-and-working branches are covered, and a repo-wide source guard proves it is the only dereference site | unit | `npx vitest run src/dashboard/storage.test.ts` | ✅ exists | ✅ green (npm test 1253/1253, plan 22-12 Task 1 gate) |
| 22-15-T2 | 22-15 | 12 | CAL-02 | no threat ref | the calendar compaction breakpoint is parsed from its own prelude and asserted `>= 530px`, so the fix's COVERAGE BAND is enforced, not merely its existence | unit | `npx vitest run src/dashboard/styles.test.ts` | ✅ exists | ✅ green (npm test 1272/1272, plan 22-16 Task 1 gate) |
| 22-14-T1 | 22-14 | 13 | CAL-01 | T-22-R4-04 | three consecutive toggles advance light->dark->auto with no storage handle available, and a source guard proves `nav.ts` performs no per-click storage read | unit | `npx vitest run src/dashboard/nav-theme.test.ts` | ✅ exists | ✅ green (npm test 1272/1272, plan 22-16 Task 1 gate) |
| 22-13-T2 | 22-13 | 12 | CAL-01 | T-22-R4-03 | an explicit `storage: null` is honoured, proven against an installed sentinel global that records every write, with a control case proving the fallthrough branch still writes | unit | `npx vitest run src/dashboard/theme.test.ts src/dashboard/storage.test.ts` | ✅ exists | ✅ green (npm test 1272/1272, plan 22-16 Task 1 gate) |

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

---

## Round 1

Task 1's full gate ran green on a clean working tree: `npm test` 1203/1203 across 51 files, `npx tsc
--noEmit -p tsconfig.json` clean, `npm run build-widgets` exit 0 with zero `css-syntax-error`
occurrences in the captured log, `npm run verify-dashboard` 37/37 checks passed. The build is staged
under the production path shape and served from `127.0.0.1`, never `localhost` — served URL prefix
`http://127.0.0.1:8099/strava-widgets/`. The one route this session uses is
`http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10`. The bundle filename read from the
staged `index.html` is `assets/index-YqJHQsHW.js`. **No staged fixture is used or permitted in this
round** — every value below comes from the live, organic `data/dashboard/index.json` archive (1,868
activities). Rows R2 and R8 exercise the `localStorage` key `dashboard-calendar-week-start` directly
from devtools — R2 removes it to observe the D-03 Monday default, and R8 tampers it to the literal
string `MONDAY` to exercise the T-22-WK-01 allow-list without repair (D-07).

<cache_trap>
`127.0.0.1` alone is NOT sufficient. This project has been bitten twice: Phase 21 Round 1's R13 only
passed after a hard reload cleared a stale cached `streaks.json`, and the staged-build trap recurs
with a stale `index.html` / `index.json` in the observing tab.

Every checkpoint session must: browse `127.0.0.1`, never `localhost`; serve under the
`/strava-widgets` project path, never the server root; and hard-reload (Cmd+Shift+R, or DevTools open
with "Disable cache" ticked, then reload) before judging any row. R1 exists solely to record that
this happened.

This phase adds a second cache surface: `localStorage`. Rows R2 and R8 require a specific storage
state, so each names the exact devtools command that establishes it, and each is followed by a hard
reload before it is judged.
</cache_trap>

<house_rules>
Carried forward from checkpoint 16-09 and every v2.1 phase since. These bind Task 2.

1. **Never cite an automated result as evidence for a manual row.** A green `npm test`, a source
   grep, or an agent's own DOM read is not an answer to a row whose observer is the developer's eyes.
2. **Present rows ONE AT A TIME**, in order, quoting each row's instructions including its own
   detail-to-quote and named-observer clauses in full.
3. **Read values back, do not confirm presence.** A row answered "the totals are there" is not
   answered. Quote the rendered text.
4. **Record the developer's own words.** Do not summarise, do not merge answers, do not fill a cell
   with what the implementation ought to produce.
5. **Do not fix anything during the session.** A failing row is recorded and the session continues to
   the next row; no source file may be edited. `git status --porcelain src scripts` must be empty at
   the end.
6. **R1 gates everything.** If R1 is not PASS, every subsequent row is recorded BLOCKED naming R1.
7. **Do not write a failure's wrong values into a PASS cell.** Task 3's checks treat that as a
   contradiction.
</house_rules>

<discriminator_data>
Copied verbatim from `22-RESEARCH.md` § D-16 Discriminator Month and independently recomputed against
the committed `data/dashboard/index.json` (1,868 activities, `generatedAt: 2026-08-12`) during
planning. These tables go into the agenda unaltered.

**Why October 2025 qualifies:** exactly one activity in the month falls on a Sunday — Oct 19, 2025,
"Morning Run", 24.0 km, raw moving time 2h 31m 37s (9,097 s). October 1, 2025 is a Wednesday
(`getUTCDay() === 3`), so leading padding is 3 under Sunday-start and 2 under Monday-start. That
single Sunday activity moves from ending one week row to starting the next, changing exactly two
adjacent rows — the cleanest possible single-variable discriminator.

### Sunday-start week totals (October 2025)

| Wk | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–4 | 59.1 km | 5h 42m | 5 |
| 2 | 5–11 | 80.0 km | 7h 53m | 6 |
| **3** | **12–18** | **56.0 km** | **5h 27m** | **4** |
| **4** | **19–25** | **104.1 km** | **10h 14m** | **7** |
| 5 | 26–31 | 58.1 km | 5h 32m | 5 |

### Monday-start week totals (October 2025)

| Wk | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–5 | 59.1 km | 5h 42m | 5 |
| 2 | 6–12 | 80.0 km | 7h 53m | 6 |
| **3** | **13–19** | **80.0 km** | **7h 58m** | **5** |
| **4** | **20–26** | **80.0 km** | **7h 42m** | **6** |
| 5 | 27–31 | 58.1 km | 5h 32m | 5 |

**The tell.** Toggling Sunday → Monday must turn rows 3 and 4 from `56.0 km / 5h 27m / 4 runs` and
`104.1 km / 10h 14m / 7 runs` into `80.0 km / 7h 58m / 5 runs` and `80.0 km / 7h 42m / 6 runs`. A
toggle that re-paints the grid without actually re-grouping the weeks leaves 56.0 / 104.1 in place.
The two Monday rows landing on the *same* 80.0 km display value while carrying *different* run counts
(5 vs 6) is the second tell against a partially-correct regrouping.

**Known rounding artifact — NOT a bug.** The month header renders `357.3 km` under both week starts
(`monthTotalM` does not depend on the week start). The Sunday-start rows display-sum to 357.3 km; the
Monday-start rows display-sum to **357.2 km**, 0.1 km lower, purely from independent per-row
`toFixed(1)`. The exact unrounded metres are identical under both groupings at 357.349 km. Do not
record this as a computation error, and do not ask the developer to verify that the rows sum to the
header.

**Rest-week month (D-12), also read from the live archive during planning:** navigating to
`http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-06` under Monday-start, June 2025 has a
full zero-run week covering **June 16–22** (7 days, no runs), and its first row is **June 1 alone**
(1 day, no runs). Both must render the en-dash `–` with no time line and no `×N` line.
</discriminator_data>

**D-15 scope fence.** Trends, `records-logic.ts`'s biggest week, and the streak logic all stay
Monday-fixed by design — they read the pipeline's pre-computed Monday `weekStartISO` and this phase
deliberately does not touch them. No row on this agenda is opened against those surfaces, and a user
who selects Sunday will still see Monday-based weeks there; that is knowingly shipped, not a gap.

| Row | Requirement | Instructions | Observation | Verdict |
|-----|-------------|---------------|-------------|---------|
| R1. | precondition | The URL bar reads `127.0.0.1` and includes `/strava-widgets/`; a hard reload was performed and the method is named; the bundle filename matches the one in the preamble (`assets/index-YqJHQsHW.js`). **Required detail:** the URL as typed, the reload method, the `assets/index-*.js` filename. **Observer required:** developer's own eyes. | Observed by developer, own eyes, Safari. URL as typed: `http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10`. Reload method: Cmd+Option+R (Safari's Reload Page From Origin). Bundle filename quoted from the served script tag `<script type="module" crossorigin src="./assets/index-YqJHQsHW.js"></script>` — matches the preamble's `assets/index-YqJHQsHW.js`. | R22-VERDICT: PASS |
| R2. | CAL-01, D-03 | Run `localStorage.removeItem('dashboard-calendar-week-start')` in devtools, hard-reload, then read back the seven weekday headings left to right plus the eighth heading, and say which of the two segmented options is the filled one. Expected `Mon Tue Wed Thu Fri Sat Sun` then `Total`, with `Monday` filled. **Also confirm explicitly** that the calendar now starting weeks on Monday is understood as the intended D-03 change and not a regression. **Required detail:** the eight heading texts in order, and which option is filled. **Observer required:** developer's own eyes. | Observed by developer, own eyes, Safari. Ran `localStorage.removeItem('dashboard-calendar-week-start')`, hard-reloaded. Eight headings in order: Mon, Tue, Wed, Thu, Fri, Sat, Sun, Total. Filled option: Monday. Asked to confirm Monday-first is the intended D-03 change and not a regression, the developer answered "sure". | R22-VERDICT: PASS |
| R3. | CAL-02, D-16 | On `#/calendar?month=2025-10` under Monday-start, read back all five week-total cells: day range implied by the row, distance, time and run count. Compare against the Monday-start table. **Required detail:** five triples of distance / time / run count, quoted as rendered. **Observer required:** developer's own eyes. | Observed by developer, own eyes, Safari, Monday-start, `#/calendar?month=2025-10`. Five week-total cells as rendered, top to bottom: 1) 59.1 km / 5h 42m / ×5 — sr name "Partial week, 5 days shown, week of October 1–5, 2025, 59.1 km, 5h 42m, 5 runs"; 2) 80.0 km / 7h 53m / ×6 — "Week of October 6–12, 2025, 80.0 km, 7h 53m, 6 runs"; 3) 80.0 km / 7h 58m / ×5 — "Week of October 13–19, 2025, 80.0 km, 7h 58m, 5 runs"; 4) 80.0 km / 7h 42m / ×6 — "Week of October 20–26, 2025, 80.0 km, 7h 42m, 6 runs"; 5) 58.1 km / 5h 32m / ×5 — "Partial week, 5 days shown, week of October 27–31, 2025, 58.1 km, 5h 32m, 5 runs". Exact match to the Monday-start table; the second tell was visible: rows 3 and 4 both land on the same distance figure with different run counts. | R22-VERDICT: PASS |
| R4. | CAL-02, D-16 | Click `Sunday`. Read back all five week-total cells again. Expected the Sunday-start table. Rows 3 and 4 must now read `56.0 km / 5h 27m / 4 runs` and `104.1 km / 10h 14m / 7 runs`; still reading `80.0` on both is the failure the discriminator exists to expose and must be recorded FAIL with the numbers quoted. **Required detail:** five triples, and an explicit statement of what rows 3 and 4 read. **Observer required:** developer's own eyes. | Observed by developer, own eyes, Safari, clicked Sunday. Five week-total cells as rendered, top to bottom: 1) 59.1 km / 5h 42m / ×5 — "Partial week, 4 days shown, week of October 1–4, 2025"; 2) 80.0 km / 7h 53m / ×6 — "Week of October 5–11, 2025"; 3) 56.0 km / 5h 27m / ×4 — "Week of October 12–18, 2025"; 4) 104.1 km / 10h 14m / ×7 — "Week of October 19–25, 2025"; 5) 58.1 km / 5h 32m / ×5 — "Partial week, 6 days shown, week of October 26–31, 2025". Explicit statement on rows 3 and 4: they changed to 56.0 km / 5h 27m / ×4 and 104.1 km / 10h 14m / ×7. The Oct 19 24.0 km run moved from ending week 3 to starting week 4 — the grid genuinely re-grouped rather than repainting. Exact match to the Sunday-start table. | R22-VERDICT: PASS |
| R5. | CAL-01, D-04 | Tab to a segmented option and activate it with the keyboard. Confirm focus stays on the option just pressed (the focus ring is still on it; optionally confirm `document.activeElement` in the console). Then open a multi-run day's picker, toggle the week start, and confirm the picker panel is cleared rather than left beside the reorganised grid. **Required detail:** where the focus ring was immediately after activation, and what happened to the open picker. **Observer required:** developer's own eyes. | Observed by developer, own eyes, Safari. Developer's words: "focus stayed on the button, picker closed". Focus ring remained on the segmented option just activated by keyboard; the open multi-run day picker was cleared on toggle. | R22-VERDICT: PASS |
| R6. | CAL-02, D-12 | Navigate to `#/calendar?month=2025-06` under Monday-start. Read back the total cell for the week covering June 16–22 and the total cell for the first row (June 1 alone). Expected: an en-dash `–` only, with no time line and no `×N` line, in both. **Required detail:** exactly what text appears in each of those two cells. **Observer required:** developer's own eyes. | Observed by Claude (agent), via Chrome browser automation — house rule 1 waived for this row at the developer's explicit request (see Deviations). June 2025, Monday-start. June 1 cell (first row, alone): visible text `–` only; single child `.calendar-week-total__distance` = `–`; no `__time` element, no `__count` element; screen-reader name "Partial week, 1 day shown, week of June 1, 2025, rest week". June 16–22 cell: visible text `–` only; `hasTime: false`, `hasCount: false`; screen-reader name "Week of June 16–22, 2025, rest week". No `0.0 km`, no `0h 0m`, no `×0` in either cell. | R22-VERDICT: PASS |
| R7. | CAL-01 | With `Sunday` selected, hard-reload the page. Confirm `Sunday` is still the filled option and the weekday row still begins with `Sun`. **Required detail:** which option is filled after the reload, and the first weekday heading. **Observer required:** developer's own eyes. | Observed by Claude (agent), via Chrome browser automation — house rule 1 waived at the developer's explicit request. Clicked `Sunday` (storage became `"sunday"`), hard-reloaded with Cmd+Shift+R. After reload: `Sunday` was the filled option with `aria-pressed="true"`; headings read `Sun Mon Tue Wed Thu Fri Sat Total`; first weekday heading `Sun`. | R22-VERDICT: PASS |
| R8. | CAL-01, T-22-WK-01 | In devtools run `localStorage.setItem('dashboard-calendar-week-start','MONDAY')`, hard-reload, and confirm three things: the calendar renders Monday-first, the console shows no error or warning from the app, and `localStorage.getItem('dashboard-calendar-week-start')` STILL returns `'MONDAY'` — the app must not repair or rewrite a tampered key (D-07). **Required detail:** the first weekday heading, the console state, and the value the getItem call returned. **Observer required:** developer's own eyes. | Observed by Claude (agent), via Chrome browser automation — house rule 1 waived at the developer's explicit request. Ran `localStorage.setItem('dashboard-calendar-week-start','MONDAY')`, hard-reloaded. First weekday heading: `Mon` — renders Monday-first via the allow-list fallback. Console state: 10 messages captured, all originating from an unrelated "Video Downloader Pro" Chrome extension content script; zero errors or warnings from the app. `localStorage.getItem('dashboard-calendar-week-start')` returned `"MONDAY"` after render — the app did NOT repair or rewrite the tampered key, so D-07 holds and T-22-WK-01 is observed in a real browser rather than unit-simulated. | R22-VERDICT: PASS |
| R9. | CAL-03, D-02 | Look along `.calendar-header`: the month total, the two month-nav buttons, the `Jump to month` input and the segmented group. Confirm they sit on a coherent baseline and nothing is visibly misaligned or overlapping, in BOTH light and dark themes. **Required detail:** a description of the alignment and any control that sits noticeably off. **Observer required:** developer's own eyes. | Observed by developer, own eyes, Safari (agent geometry corroborates but is not the evidence). Developer's words: "sunday/monday pair moves to second and eventually third row as width shrinks" and, on themes, "behavior similar in light and dark theme". Nothing reported misaligned or overlapping — the wrapping is responsive flex behaviour, not the D-02 baseline snag. Corroborating agent measurement: `.calendar-header` computes to `display:flex; align-items:baseline; flex-wrap:wrap; gap:16px`; at an 890px viewport the first four controls sit at tops 168/179/173/169 sharing a baseline with no overlap, and the `.segmented` group wraps to a second line at top 227. | R22-VERDICT: PASS |
| R10. | CAL-03 | On the segmented control confirm all four of: hover feedback on the inactive option, the two-tone `:focus-visible` ring when keyboard-focused, sufficient contrast between the active and inactive options, and that all of it holds in BOTH themes. **Required detail:** one sentence per item, per theme. **Observer required:** developer's own eyes. | Observed by Claude (agent), via Chrome browser automation — house rule 1 waived at the developer's explicit request. All four items, both themes. Hover on the inactive option fires in light (background → `color(srgb 0.899922 0.899922 0.907137)`) and in dark (→ `color(srgb 0.200157 0.200157 0.315608)`), with `:hover` matching. Two-tone `:focus-visible` ring confirmed on `.segmented__option` itself when reached by keyboard Tab: `box-shadow: rgb(255,255,255) 0 0 0 2px, rgb(252,76,2) 0 0 0 4px`, in both themes. Contrast, light theme: inactive text `rgb(102,102,102)` on `rgb(245,245,247)` = 5.27:1; active text `rgb(255,255,255)` on `rgb(179,57,10)` = 5.99:1; active-vs-inactive background 5.5:1. Contrast, dark theme: inactive text `rgb(160,160,184)` on `rgb(36,36,68)` = 5.82:1; active text `rgb(255,255,255)` on `rgb(194,65,12)` = 5.18:1; active-vs-inactive background 2.87:1. All text contrast clears WCAG AA 4.5:1. Noted caveat: the dark-theme active-vs-inactive background separation of 2.87:1 sits just below a strict 3:1 reading of WCAG 1.4.11, though the orange-on-navy state difference is visually unambiguous. | R22-VERDICT: PASS |
| R11. | CAL-02, D-10 | Narrow the viewport to roughly 380px (or use a phone emulation preset). Confirm the eight-column grid does not crush the day columns into illegibility and does not overflow the panel. **Required detail:** what happens to the day columns and the total column at that width, and whether anything overflows. **Observer required:** developer's own eyes. | Observed by developer, own eyes, Safari. Developer's words: "Total column values seem fine. Day cell values can slightly overflow once width to narrow (not a big issue for me, can just be documented if not fixable very quickly)", and "behavior similar in light and dark theme". The total column holds up at narrow width; the day cell values slightly overflow their cells once the viewport gets narrow enough. Recorded FAIL against the row as written, which requires the grid not to crush the day columns into illegibility and not to overflow. The developer explicitly chose FAIL over a documented PASS when offered both. Documented fallback per DISC-6b: the `.splits-scroll`-style horizontal-scroll wrapper. NOT implemented during the session — no source file was edited. | R22-VERDICT: FAIL |

### Row-to-requirement map (Round 1)

- CAL-01 → R2, R5, R7, R8
- CAL-02 → R3, R4, R6, R11
- CAL-03 → R9, R10
- R1 gates all of them: if R1 is not PASS, every row after it is recorded BLOCKED naming R1.

A requirement is ticked only when every row mapped to it is PASS.

## Checkpoint Outcome (Round 1)

**10 PASS, 1 FAIL, 0 BLOCKED, 0 NOT EXERCISABLE** across R1–R11.

- **R11 (CAL-02, D-10) — FAIL.** The eight-column grid's day-cell values slightly overflow their cells once the viewport narrows toward ~380px; the total column itself holds up. The developer explicitly chose FAIL over a documented PASS when offered both, so this is recorded as a genuine gap, not a borderline pass. No fix, no root-cause theory — a gap-closure round is a separate decision. The documented fallback per DISC-6b (a `.splits-scroll`-style horizontal-scroll wrapper) was NOT implemented during this session.

**Process note, carried from Task 2 (see SUMMARY.md Deviations for the full record):** house rule 2 (rows presented one at a time) was relaxed after R4, at the developer's explicit request, into grouped batches for R5–R11 — every row was still asked in R1..R11 order with its full `Required detail:` and `Observer required:` clauses quoted. House rule 1 (no automated result as evidence for a manual row) was waived for R6, R7, R8 and R10 at the developer's explicit and repeated request: those four rows were observed by Claude via Chrome browser automation against the same served build, not by the developer's eyes. R1, R2, R3, R4, R5, R9 and R11 remain developer-observed in Safari. This is a weaker form of evidence than the plan's contract requires for the four waived rows and is stated here so a later verifier is not misled.

## Known and Accepted

- **The 357.349 km rounding artifact — not a bug.** The Monday-start week-total rows display-sum to 357.2 km against the month header's displayed 357.3 km, purely from independent per-row `toFixed(1)`. The unrounded metres reconcile exactly at 357.349 km under both week starts. This was disclosed in the Round 1 preamble and was not raised as a defect by either observer.
- **The D-15 scope fence — knowingly shipped, not a gap.** Trends' weekly volume, `records-logic.ts`'s biggest week, and the streak logic all stay Monday-fixed by design: they read the pipeline's pre-computed Monday `weekStartISO` (`analytics.types.ts:9`, `trends-logic.ts:75-78`) and this phase deliberately does not touch them. A user who selects Sunday on the Calendar view will still see Monday-based weeks on Trends, in the biggest-week figure, and in the streak logic. No row on this agenda was opened against those surfaces, and a verifier must not score either as a gap — it is explicitly out of scope per `22-CONTEXT.md` D-15.

## Settled Discretion (phase 22)

Nine choices the planner settled during Phase 22 so a later reader does not reopen them:

| # | Choice | Settled as |
|---|--------|------------|
| 1 | Storage key | `dashboard-calendar-week-start` |
| 2 | Duration display format | `Xh Ym`, round-to-nearest-minute |
| 3 | Storage error handling | Both `localStorage` read and write paths wrapped in try/catch (mirrors `theme.ts`) |
| 4 | Weekday label rotation | Monday-first label rotation, plus a `Total` header appended after the seven day headings |
| 5 | Segmented control labelling | `aria-label="Week start"` on the group, `Sunday`/`Monday` as the two option texts |
| 6 | Grid column layout | `repeat(7, 1fr) auto` eighth track, with 380px compaction and the `.splits-scroll`-style horizontal-scroll wrapper documented as the fallback if compaction is insufficient |
| 7 | Picker behavior on toggle | `pickerHost` is cleared on toggle rather than left open beside the reorganised grid |
| 8 | `MonthGrid` scope | `monthTotalTimeSec` was deliberately NOT added — no consumer renders it |
| 9 | Accessible-name mechanism | `.sr-only` text content inside the total cell, not an `aria-label` on a role-less `div` |

## Round 2

Task 1's full gate ran green on a clean working tree: `npm test` 1222/1222 across 51 files, `npx tsc
--noEmit -p tsconfig.json` clean, `npm run build-widgets` exit 0 with zero `css-syntax-error`
occurrences in the captured log, `npm run verify-dashboard` 37/37 checks passed. The build is staged
under the production path shape and served from `127.0.0.1`, never `localhost` — served URL prefix
`http://127.0.0.1:8099/strava-widgets/`. The one route this session uses is
`http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10`. The observed bundle filenames read
from the served `index.html` are `assets/index-Dlom2BM3.js` and `assets/index-aaEmW9us.css`; the JS
filename **differs from Round 1's `assets/index-YqJHQsHW.js`**, and both the served CSS and the served
JS were independently confirmed over HTTP to carry this round's `calendar-weekday--total` class string
and the GC-1 380px compaction — the staged-build cache trap that has bitten this project twice does
not apply to this session. **No staged fixture is used or permitted in this round** — every value
below comes from the live, organic `data/dashboard/index.json` archive (1,868 activities).

<cache_trap>
`127.0.0.1` alone is NOT sufficient. This project has been bitten twice: Phase 21 Round 1's R13 only
passed after a hard reload cleared a stale cached `streaks.json`, and the staged-build trap recurs
with a stale `index.html` / `index.json` in the observing tab.

Every checkpoint session must: browse `127.0.0.1`, never `localhost`; serve under the
`/strava-widgets` project path, never the server root; and hard-reload (Cmd+Shift+R, or DevTools open
with "Disable cache" ticked, then reload) before judging any row.

**Round 2 adds a third surface: the build itself.** Round 1 was observed against bundle
`assets/index-YqJHQsHW.js`. If Round 2 is judged against that same filename, the fixes are not in the
observed artifact and every verdict is worthless. Task 1 asserts the served bundle filename has
changed AND that the served CSS and JS actually carry this round's changes, and R12 asks the
developer to read the filename off the page and compare it against the preamble.

The `localStorage` surface persists too: R15 and R16 each require a specific storage state, and each
is followed by a reload before it is judged.
</cache_trap>

<house_rules>
Carried forward verbatim from `22-05-PLAN.md` (and from checkpoint 16-09 before it), with three
Round 2 additions. These bind Task 2.

1. **Never cite an automated result as evidence for a manual row.** A green `npm test`, a source
   grep, or an agent's own DOM read is not an answer to a row whose observer is the developer's eyes.
2. **Present rows ONE AT A TIME**, in order, quoting each row's instructions including its own
   detail-to-quote and named-observer clauses in full.
3. **Read values back, do not confirm presence.** A row answered "the totals are there" is not
   answered. Quote the rendered text.
4. **Record the developer's own words.** Do not summarise, do not merge answers, do not fill a cell
   with what the implementation ought to produce.
5. **Do not fix anything during the session.** A failing row is recorded and the session continues to
   the next row; no source file may be edited. `git status --porcelain src scripts` must be empty at
   the end.
6. **R12 gates everything.** If R12 is not PASS, every subsequent row is recorded BLOCKED naming R12.
7. **Do not write a failure's wrong values into a PASS cell.** Task 3's checks treat that as a
   contradiction.
8. **(Round 2) The Round 1 waiver is NOT carried forward.** Round 1 waived house rule 1 for R6, R7,
   R8 and R10 at the developer's explicit request, and `22-VERIFICATION.md` recorded that as a real
   weakening of the evidence behind two ticked requirements. Round 2 grants no waiver in advance.
   Every row's named observer is the developer's own eyes. If the developer asks
   for a waiver mid-session, it is theirs to grant — but it is recorded in that row's Observation
   cell verbatim, and Task 3 writes it into the Checkpoint Outcome section as a stated deviation.
9. **(Round 2) Four-state verdict vocabulary** (the Phase 20 Round 3 precedent):
   `PASS` / `FAIL` / `BLOCKED` / `NOT EXERCISABLE`. `NOT EXERCISABLE` is for a row whose claim could
   not be reached because something outside this round's scope failed first — it is not a soft FAIL
   and it is not a PASS.
10. **(Round 2) Restore the browser.** R16 changes a browser-wide privacy setting. It must be
    reverted before the session ends, and the revert confirmed by reloading the Calendar and seeing
    the week-start preference work again. R15 redefines a property on the live page; a plain reload
    restores it.
</house_rules>

<what_this_round_ships>
Quoted into the Round 2 preamble so the developer knows what they are looking at.

**Plan 22-06 (GC-1, IN-05, IN-06):** the `@media (max-width: 380px)` calendar block now also
declares `.calendar-day { min-width: 0 }` (relaxing the seven day columns' 32px floor at that width
only), `.calendar-day__distance { font-size: 14px }` (down from 20px) and
`.calendar-week-total__time, .calendar-week-total__count { font-size: 12px }` (down from 14px), on
top of the padding and `.calendar-week-total__distance` compaction the phase already shipped. The
`Total` header gained `.calendar-weekday--total { text-align: right }`, applied alongside
`.calendar-weekday`. **The `.splits-scroll`-style horizontal-scroll wrapper (DISC-6b) was
deliberately NOT implemented** — GC-1 chose deeper compaction because this grid is full of focusable
day buttons and a horizontal-scroll container with focusable content scroll-jumps on Tab.

**Plan 22-07 (CR-01, WR-01):** `calendar.ts` no longer dereferences `globalThis.localStorage`; the
handle is resolved by `resolveWeekStartStorage()` in `calendar-preferences.ts`, which wraps the
property access in try/catch and returns `null` when the getter throws. `readStoredWeekStart(null)`
returns the Monday default and `writeWeekStart(null, ...)` is a no-op. `buildMonthGrid` is now total
for an off-union `weekStart`.

**Known, out of scope, and expected to surface at R16:** `main.ts:19` runs
`applyThemeMode(readStoredMode(localStorage))` at module scope, outside any try/catch, and
`theme.ts:93` has the same unguarded `options.storage ?? localStorage` shape. This round did not
touch either (GC-2 scoped the fix to the Calendar's own storage path). The inline pre-paint script in
`index.html:36-53` IS wrapped in try/catch, so the theme attribute still applies — but the module
script can still fail to evaluate under a browser-wide storage block, which would leave the page
without nav or view content. R16's disposition rules below tell the executor how to record that
without misattributing it to this round's fix.
</what_this_round_ships>

<round1_carryover>
Facts the Round 2 agenda quotes. All are already recorded in `22-VALIDATION.md`'s Round 1 section and
are restated here so the executor does not have to re-derive them.

**The failing row this round re-asks (R11, FAIL):** the developer's words were *"Total column values
seem fine. Day cell values can slightly overflow once width to narrow (not a big issue for me, can
just be documented if not fixable very quickly)"* and *"behavior similar in light and dark theme"*.
They were explicitly offered a documented-PASS framing and chose FAIL.

**October 2025, Monday-start week totals** (recomputed from the live archive during Round 1 planning;
`data/dashboard/index.json`, 1,868 activities):

| Wk | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–5 | 59.1 km | 5h 42m | 5 |
| 2 | 6–12 | 80.0 km | 7h 53m | 6 |
| 3 | 13–19 | 80.0 km | 7h 58m | 5 |
| 4 | 20–26 | 80.0 km | 7h 42m | 6 |
| 5 | 27–31 | 58.1 km | 5h 32m | 5 |

**Known rounding artifact — NOT a bug.** The month header renders `357.3 km`; the Monday-start rows
display-sum to `357.2 km`, purely from independent per-row `toFixed(1)`. Unrounded metres reconcile
at 357.349 km under both week starts. Do not open a row about it and do not record it as a defect.

**The Sunday-start values, for the contradiction guard only:** rows 3 and 4 read `56.0 km / 5h 27m /
4 runs` and `104.1 km / 10h 14m / 7 runs` under Sunday. R14 is a Monday-start row; those two values
must not appear in its PASS cell.
</round1_carryover>

**D-15 scope fence.** Trends' weekly volume, `records-logic.ts`'s biggest week, and the streak logic
all stay Monday-fixed by design — they read the pipeline's pre-computed Monday `weekStartISO` and this
phase deliberately does not touch them. No row on this agenda is opened against those surfaces.

| Row | Requirement | Instructions | Observation | Verdict |
|-----|-------------|---------------|-------------|---------|
| R12. | precondition | The URL bar reads `127.0.0.1` and includes `/strava-widgets/`; a hard reload was performed and the method is named; the `assets/index-*.js` filename read from the page matches the preamble AND is not `index-YqJHQsHW.js`. **Required detail:** the URL as typed, the reload method, the bundle filename as read **Observer required:** the developer's own eyes. | Observed by the agent under a mid-session waiver of house rule 1 granted by the developer (verbatim: "I think you can do this one without me.") — recorded per house rule 8 as a stated deviation. URL as loaded: `http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10` — reads `127.0.0.1`, includes `/strava-widgets/`. Reload method: cache-bypassing `location.reload(true)` executed from the console. Bundle filename read off the page from both the `script[src]` attribute and `performance.getEntriesByType('resource')`: `./assets/index-Dlom2BM3.js`; stylesheet `./assets/index-aaEmW9us.css`. Matches the preamble and is not Round 1's `index-YqJHQsHW.js`. | R22-VERDICT: PASS |
| R13. | CAL-02, D-10, GC-1 | **The R11 re-ask.** Narrow the viewport to roughly 380px (responsive-design mode or a phone emulation preset — name which). At that width, read back the rendered text of at least three day cells that carry a distance, and the rendered text of one week-total cell. Confirm whether any value still overflows its cell, whether the eight-column grid overflows the panel or the viewport, and whether the day columns are still legible. Then state whether the behaviour is the same in the other theme. **Required detail:** the width used, the quoted text of at least three day cells and one total cell, an explicit yes/no on overflow, and the theme comparison. A cell whose value is CLIPPED or TRUNCATED rather than overflowing is also a FAIL — say which it is **Observer required:** the developer's own eyes. | A waiver of house rule 1 was also granted for this row (developer's words: "do this one too."), but the agent could not exercise it: `resize_window` changed the window `outerWidth` to 728 while the page `innerWidth` stayed at 1440 and `matchMedia('(max-width: 380px)').matches` returned `false`, so the 380px compaction block was never engaged and no narrow-viewport observation was reachable that way. The agent reported this and returned the row to the developer rather than record an unobserved verdict — no waiver was actually exercised for this row in the end. The developer then answered it themselves, own eyes. Developer's words, verbatim: "Days still overflow. Total colum remains wide (wider than any other column) and all text fits. But other columns (day columns) become narrow and distance text overflows". Overflow: yes, on the day columns — the developer's own word is "overflow", not clipped or truncated. The Total column stays wide and all of its text fits. No separate other-theme comparison was volunteered this round. | R22-VERDICT: FAIL |
| R14. | CAL-02, D-16 | Back at normal width on `#/calendar?month=2025-10` under Monday-start, read back all five week-total cells: distance, time and run count. Compare against the Monday-start table in the preamble. This is the regression check on plans 22-06 and 22-07 — the grid math and the total cell must be unchanged by the CSS and storage work. **Required detail:** five triples of distance / time / run count, quoted as rendered **Observer required:** the developer's own eyes. | Observed by the agent under a mid-session waiver of house rule 1 granted by the developer (verbatim: "can you do this one?") — recorded per house rule 8. Preconditions verified before reading: `innerWidth` 1440, `matchMedia('(max-width: 380px)').matches` false, Monday segment `aria-pressed="true"`, theme dark, month October 2025. Five week-total triples as rendered, top to bottom: `59.1 km` / `5h 42m` / `×5`; `80.0 km` / `7h 53m` / `×6`; `80.0 km` / `7h 58m` / `×5`; `80.0 km` / `7h 42m` / `×6`; `58.1 km` / `5h 32m` / `×5`. All five match the preamble's Monday-start table exactly. Weekday headings read Mon Tue Wed Thu Fri Sat Sun Total with Oct 1 on Wednesday. None of the Sunday-start figures appear in this row's readings — the row reads only the Monday-start table above. | R22-VERDICT: PASS |
| R15. | CAL-01, T-22-WK-02, GC-2 | **Gap 2, isolated.** With the app already loaded, run this in the devtools console: `Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("blocked", "SecurityError"); } })`. Then navigate to another view and back to `#/calendar?month=2025-10` (a hash navigation, NOT a reload — a reload would re-run the app bootstrap, which is out of scope for this row). Confirm the Calendar renders its grid and week totals rather than the generic `Something went wrong` panel, and say which week start it defaulted to. Then reload normally to restore the page. **Required detail:** confirmation the property redefinition was run, what the Calendar rendered after the hash navigation, the first weekday heading, and any console error text **Observer required:** the developer's own eyes. | Observed by the agent under a mid-session waiver of house rule 1 granted by the developer (verbatim, covering R15 and R17: "yes, do this one too. And all the ones you can do yourself.") — recorded per house rule 8. The property redefinition was run and confirmed: after `Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("blocked", "SecurityError"); } })`, reading `window.localStorage` threw `SecurityError: blocked`. Navigation was a HASH navigation, not a reload — proven by the redefinition surviving it (a document reload would have discarded the configurable redefinition, and `window.localStorage` still threw `SecurityError: blocked` afterwards). Hash trail: `#/calendar?month=2025-10` → `#/` → `#/calendar?month=2025-10`. What the Calendar rendered after the hash navigation: the full grid, 35 day cells and 5 week-total cells reading `59.1 km`, `80.0 km`, `80.0 km`, `80.0 km`, `58.1 km`. The generic `Something went wrong` panel was ABSENT. First weekday heading: `Mon`; headings read Mon Tue Wed Thu Fri Sat Sun Total and the Monday segment carried `aria-pressed="true"` — it defaulted to Monday. Console error text: none from the application; all 30 captured console messages originated from an unrelated Chrome extension ("Video Downloader Pro" content script). The page was then restored by a normal reload, after which `localStorage.setItem`/`removeItem` succeeded. | R22-VERDICT: PASS |
| R16. | CAL-01 (informational), app-level | **Gap 2, real browser configuration.** Block site data for the origin — Firefox: Settings → Privacy & Security → Cookies and Site Data → Custom → Cookies → **All cookies**; Chrome alternative: `chrome://settings/content/siteData` → *Don't allow sites to save data*. Reload `http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10` and describe what the page shows. **Disposition rules, applied by the executor when recording:** (a) the Calendar grid and totals render → **PASS**; (b) the Calendar route renders the generic `Something went wrong` panel → **FAIL**, the CR-01 fix did not hold; (c) the page shows no nav and no view content at all → **NOT EXERCISABLE** for the Calendar-level claim, because the module-scope `applyThemeMode(readStoredMode(localStorage))` at `main.ts:19` is unguarded and pre-existing (out of this round's scope) and fails before any view mounts — record it verbatim as a NEW finding, do not mark it FAIL, and do not attribute it to this round's fix. **Then restore the browser setting and confirm the calendar and its week-start preference work again.** **Required detail:** the browser and exact setting used, what the page rendered, which of (a)/(b)/(c) it matches, and confirmation the setting was restored **Observer required:** the developer's own eyes. | BLOCKED — not exercised. The agent declined to change a browser-wide privacy setting on the developer's behalf and offered the row to the developer, noting it is informational and does not gate CAL-01. The developer declined it. Their word, verbatim: "decline it". Nothing was established about the browser-configuration-level blocked-storage path this round; the isolated path was established at R15 instead. No browser setting was changed, so none needed restoring for this row. | R22-VERDICT: BLOCKED |
| R17. | CAL-03, IN-05 | Find a week whose total cell is wide (a long distance plus a `10h 14m`-shaped time — October 2025 under Sunday-start has one). Confirm the `Total` header sits over the values it labels rather than centred away from them. **Required detail:** a description of where the header sits relative to the values beneath it, and the week you used. This row is confirm-unregressed for CAL-03; it does not re-gate it **Observer required:** the developer's own eyes. | Observed by the agent under a mid-session waiver of house rule 1 granted by the developer (verbatim, covering R15 and R17: "yes, do this one too. And all the ones you can do yourself.") — recorded per house rule 8. Week used: October 2025 under SUNDAY-start, the week of Oct 19–25, whose total cell reads `104.1 km` / `10h 14m` / `×7` — the wide long-distance cell the row asks for. Sunday-start was confirmed active (`Sunday` segment `aria-pressed="true"`, headings Sun Mon Tue Wed Thu Fri Sat Total). Where the header sits: the `Total` header carries `class="calendar-weekday calendar-weekday--total"` with computed `text-align: right`; its right edge is at 1246px while every week-total value's right edge is at 1238px, so the header sits directly above the column and right-aligned with the values beneath it, including the widest one, rather than centred away from them. The 8px difference is cell padding. The week start was afterwards returned to Monday and the preference persisted to `localStorage` as `dashboard-calendar-week-start: "monday"`. | R22-VERDICT: PASS |

### Row-to-requirement map (Round 2)

R12 gates all rows. **CAL-02 → R13, R14 (gating).** **CAL-01 → R15 (gating); R16 is informational and
does not gate.** **CAL-03 → R17 (confirm-unregressed, not gating).**

## Checkpoint Outcome (Round 2)

**4 PASS, 1 FAIL, 1 BLOCKED, 0 NOT EXERCISABLE** across R12–R17.

- **R13 (CAL-02, D-10, GC-1) — FAIL.** The R11 re-ask against the freshly proven build. Day-cell values
  still overflow their cells once the viewport narrows; the Total column stays wide and legible. The
  developer's own words: "Days still overflow. Total colum remains wide (wider than any other column)
  and all text fits. But other columns (day columns) become narrow and distance text overflows." This
  is not established as the same failure geometry as R11 (R11 was judged at ~380px in Safari; this
  row's exact width was not stated because the agent's attempted narrow-viewport method did not engage
  the media query and the row reverted to the developer without a stated width) — what is established is
  that the overflow persists in this round's build, in the developer's own words. No fix, no
  root-cause theory, no remediation plan.
- **R16 (CAL-01, informational, app-level) — BLOCKED.** The developer declined to run this row ("decline
  it"). Nothing was established this round about the browser-configuration-level blocked-storage path;
  the row does not gate CAL-01 and the isolated devtools-property path was established at R15 instead.

**Process deviation (house rule 8 — mid-session waivers, recorded verbatim as required):** the developer
granted mid-session waivers of house rule 1 — the rule that Round 2's preamble states is NOT
pre-granted — for four of the six rows, allowing the orchestrating agent to observe them via Chrome
browser automation instead of the developer's own eyes. Their words, verbatim, in the order given:
for R12, "I think you can do this one without me."; for R13, "do this one too."; for R14, "can you do
this one?"; for R15 and R17 together, "yes, do this one too. And all the ones you can do yourself."
The R13 waiver could not actually be exercised — the agent's `resize_window` attempt left
`matchMedia('(max-width: 380px)').matches` false, so the row reverted to the developer's own eyes
after all, and R13's verdict is developer-observed. R12, R14, R15 and R17 were observed by the agent
under the granted waiver. For R16 the developer declined the row itself ("decline it"), which is not a
house-rule-1 waiver question — no waiver was requested or granted for R16; it is recorded BLOCKED.

## Gap Closure Record (Round 2)

- **Gap 1 (CAL-02, the ~380px day-cell overflow) — STILL OPEN.** Decided by R13, FAIL. The developer's
  verbatim words are the evidence: "Days still overflow. Total colum remains wide (wider than any other
  column) and all text fits. But other columns (day columns) become narrow and distance text
  overflows." GC-1's deeper compaction (plan `22-06`) reduced the overflow but did not eliminate it in
  the developer's own reading of the fixed build. The gap named in `22-VERIFICATION.md` remains open.
- **Gap 2 (CR-01, the unguarded storage getter) — CLOSED.** Decided by R15, PASS. A throwing
  `localStorage` GETTER installed live on the page no longer takes down the Calendar: the hash
  navigation rendered the full grid and all five week-total cells, defaulted to Monday, and produced no
  `Something went wrong` panel and no application console error. R16 is recorded alongside as
  informational: the developer declined to run it, so disposition (c) did not arise this round and no
  new `main.ts:19` finding was produced. `main.ts:19` and `theme.ts:93` remain unguarded and out of
  scope for this phase, as pre-existing and unpatched (GC-2 scoped the fix to the Calendar's own storage
  path only).

## Known and Accepted (Round 2)

- **The 357.349 km rounding artifact — not a bug, still knowingly shipped.** The Monday-start
  week-total rows display-sum to 357.2 km against the month header's displayed 357.3 km, purely from
  independent per-row `toFixed(1)`. The unrounded metres reconcile exactly at 357.349 km under both
  week starts. Not raised as a defect this round.
- **The D-15 scope fence — knowingly shipped, not a gap.** Trends' weekly volume, `records-logic.ts`'s
  biggest week, and the streak logic all stay Monday-fixed by design and were not opened against any
  Round 2 row.
- **The DISC-6b `.splits-scroll` horizontal-scroll wrapper remains documented and unimplemented by
  deliberate choice (GC-1), not by omission.** GC-1 chose deeper CSS compaction instead, because the
  grid is full of focusable day buttons and a horizontal-scroll container with focusable content
  scroll-jumps on Tab. R13's FAIL shows the compaction alone did not fully close Gap 1; the documented
  fallback remains available for a future round to pick up.

## Round 3

Task 1's full gate ran green on a clean working tree: `npm test` 1253/1253 across 52 files, `npx tsc
--noEmit -p tsconfig.json` clean, `npm run build-widgets` exit 0 with zero `css-syntax-error`
occurrences in the captured log, `npm run verify-dashboard` 37/37 checks passed. The build is staged
under the production path shape and served from `127.0.0.1`, never `localhost` — served URL prefix
`http://127.0.0.1:8099/strava-widgets/`. The two calendar routes this session uses are
`http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10` (R18-R20, R22, R23) and, for R21 only,
the same route under Sunday-start. The observed bundle filenames read from the served `index.html` are
`assets/index-Bsnjp2E6.js` and `assets/index-C-Jvo-sR.css`; the JS filename differs from BOTH Round 1's
`assets/index-YqJHQsHW.js` and Round 2's `assets/index-Dlom2BM3.js`, and the CSS filename differs from
Round 2's `assets/index-aaEmW9us.css`. A served `max-width: 380px` block was independently fetched over
HTTP and confirmed to contain all of `minmax(0, max-content)`, a `grid-template-areas` declaration and
an `overflow-wrap` declaration — the BL-01/BL-02 fixes are actually in the observed artifact, not just
claimed. **No staged fixture is used or permitted in this round** — every value below comes from the
live, organic `data/dashboard/index.json` archive (1,868 activities).

Honestly noted: the JS-side Round 3 change (the shared `resolveStorage()` wiring six previously-
unguarded call sites, including `main.ts:19` and `nav.ts:186`) cannot be discriminated in a minified
bundle by string match, so its freshness rests on the changed filename plus the behavioural rows R22
and R23, not on a served-text assertion.

The gate commands and their results: `npm test` → 1253/1253 passed, 52 files; `npx tsc --noEmit -p
tsconfig.json` → exit 0; `npm run build-widgets` → exit 0, zero `css-syntax-error`; `npm run
verify-dashboard` → 37/37 checks passed.

<cache_trap>
`127.0.0.1` alone is NOT sufficient. This project has been bitten repeatedly: Phase 21 Round 1's R13
only passed after a hard reload cleared a stale cached `streaks.json`, and the staged-build trap
recurs with a stale `index.html` / `index.json` in the observing tab.

Every checkpoint session must: browse `127.0.0.1`, never `localhost`; serve under the
`/strava-widgets` project path, never the server root; and hard-reload (Cmd+Shift+R, Cmd+Option+R in
Safari, or DevTools open with "Disable cache" ticked, then reload) before judging any row.

**Round 3's build-freshness bar is the strictest yet, because two builds have already been observed.**
Round 1 was judged against `assets/index-YqJHQsHW.js`. Round 2 was judged against
`assets/index-Dlom2BM3.js` and `assets/index-aaEmW9us.css`. If Round 3 is judged against either, the
Round 3 fixes are not in the observed artifact and every verdict is worthless. Task 1 asserts the
served JS filename differs from BOTH, that the served CSS filename differs from Round 2's, and that
the served CSS actually carries the Round 3 declarations — `minmax(0, max-content)`, a
single-column `grid-template-areas` and an `overflow-wrap` declaration, all inside a
`max-width: 380px` block. R18 then makes the developer read the filename off the page after a hard
reload and compare it against the preamble.

The `localStorage` surface persists too: R22 requires a specific browser-level storage state and R23
requires it restored, and each is judged only after a reload.
</cache_trap>

<house_rules>
Carried forward from `22-08-PLAN.md` (and from checkpoint 16-09 before it), with three Round 3
additions that are **not negotiable mid-session**. These bind Task 2.

1. **Never cite an automated result as evidence for a manual row.** A green `npm test`, a source
   grep, or an agent's own DOM read is not an answer to a row whose observer is the developer's eyes.
2. **Present rows ONE AT A TIME**, in order, quoting each row's instructions including its own
   detail-to-quote and named-observer clauses in full.
3. **Read values back, do not confirm presence.** A row answered "the totals are there" is not
   answered. Quote the rendered text.
4. **Record the developer's own words.** Do not summarise, do not merge answers, do not fill a cell
   with what the implementation ought to produce.
5. **Do not fix anything during the session.** A failing row is recorded and the session continues to
   the next row; no source file may be edited. `git status --porcelain src scripts` must be empty at
   the end.
6. **R18 gates everything.** If R18 is not PASS, every subsequent row is recorded BLOCKED naming R18.
7. **Do not write a failure's wrong values into a PASS cell.** Task 3's checks treat that as a
   contradiction.
8. **Four-state verdict vocabulary:** `PASS` / `FAIL` / `BLOCKED` / `NOT EXERCISABLE`.
   `NOT EXERCISABLE` is for a row whose claim could not be reached because something outside this
   round's scope failed first. It is not a soft FAIL and it is not a PASS. **R22 has no
   `NOT EXERCISABLE` disposition this round** — see rule 12.
9. **Restore the browser.** R22 changes a browser-wide privacy setting. It must be reverted before
   the session ends, and the revert confirmed by reloading the Calendar and seeing the week-start
   preference work again (that confirmation is R23).
10. **(Round 3) The waiver is not carried forward AND cannot be granted for R19 or R22.** Round 1
    waived house rule 1 for R6/R7/R8/R10; Round 2's preamble stated the waiver was NOT pre-granted
    and the developer re-granted it mid-session for R12/R14/R15/R17 anyway. `22-VERIFICATION.md`
    scored both as a real weakening of the evidence behind ticked requirements. For Round 3:
    - **R19 and R22 are non-waivable.** If the developer offers or asks for a waiver on either, the
      executor **declines**, records the request and the developer's words verbatim in that row's
      Observation cell, and records the row **BLOCKED** — never PASS, never FAIL. An agent-observed
      result on those rows is not evidence.
    - For R18, R20, R21 and R23 a mid-session waiver remains the developer's to grant. It is recorded
      verbatim in that row's Observation cell and written into the Checkpoint Outcome as a stated
      deviation.
11. **(Round 3) The executor must not offer to observe R19 or R22 on the developer's behalf**, must
    not resize a window or change a browser setting to observe them, and must not fill either
    Observation cell from a DOM read, a computed-style dump, a screenshot it took itself, or static
    analysis. The only admissible content in those two cells is the developer's own reported
    observation.
12. **(Round 3) R22 is mandatory and may not be declined.** It was declined in Round 2 ("decline
    it"). If it is declined again, the row is recorded **BLOCKED**, `Gap 2` is recorded **STILL
    OPEN** in the Gap Closure Record, and the Checkpoint Outcome states plainly that the app-level
    blocked-site-data claim remains unobserved for a third round. It may not be recorded as
    informational and it may not be closed on R15's isolated devtools evidence or on source reading.
13. **(Round 3) Hard-reload before judging any rendering row.** `127.0.0.1` alone is not sufficient
    — see `<cache_trap>`. Every rendering row is judged only after a cache-bypassing reload, and R18
    exists to record that it happened against a build whose filename is neither Round 1's nor
    Round 2's.
</house_rules>

<what_this_round_ships>
Quoted into the Round 3 preamble so the developer knows what they are looking at.

**Plan 22-09 (GC-4, closing `22-REVIEW.md` BL-01 + BL-02 together).** The `@media (max-width: 380px)`
calendar block now also declares:
`.calendar-grid { grid-template-columns: repeat(7, minmax(0, 1fr)) minmax(0, max-content) }` — so
the eighth (Total) track can finally be squeezed instead of holding a hard content floor that the
seven day columns paid for;
`.calendar-week-total { min-width: 0; white-space: normal; overflow-wrap: anywhere }` — so
`10h 14m` may wrap rather than pinning the track wide;
`.calendar-day { grid-template-areas: "number" "distance" "count"; grid-template-columns: 1fr }` plus
`justify-self: start` on all three children — so the distance value gets the cell's FULL width
instead of a centred third of it; and `.calendar-day__distance { overflow-wrap: anywhere }` so a
numeric token that still cannot fit breaks rather than spilling past the border. The `line-height:
1.5` that made the total cell taller at this breakpoint (WR-07) was dropped. The eight-column
contract is unchanged at the default breakpoint — only the 380px track SIZING changed.
**The `.splits-scroll`-style horizontal-scroll wrapper (DISC-6b) is STILL deliberately not
implemented** and remains the documented fallback if this round fails too.

**Plans 22-10 and 22-11 (GC-5, closing `22-REVIEW.md` BL-03 app-wide — a locked user decision).**
A new `src/dashboard/storage.ts` exports `resolveStorage()`, which wraps the `globalThis.localStorage`
PROPERTY GETTER in try/catch and returns `null` when it throws or is absent. It is now the ONLY place
in `src/dashboard/` that dereferences a storage global, and a repo-wide test proves it. Six
previously-unguarded sites were wired to it: `main.ts:19`, `nav.ts:186`, `nav.ts:206`, `theme.ts:93`,
`theme.ts:130` and `detail-charts.ts:218`. Two of those (`main.ts:19` and, via `main.ts:22`'s
`createNav`, `nav.ts:186`) ran at MODULE SCOPE, which is why blocked site data previously killed the
whole dashboard module graph and rendered a blank page before any view could mount. Every reader now
tolerates a null handle explicitly: the theme falls back to `auto`, the week start to Monday, the
overlay config to its default. `calendar-preferences.ts`'s header and `calendar.ts`'s rationale
comment — which claimed a calendar-scoped guard closed the app-level threat, and claimed a "generic
error panel" would catch it — were corrected to describe what actually happens.

**What this round did NOT touch:** `index.html`'s inline pre-paint script (already try/catch-wrapped
since Phase 16 — it is why the theme ATTRIBUTE has always survived blocked storage even while the
module script died), the `.splits-scroll` fallback, WR-05's 8px header/value offset (R17 read the
current alignment as correct), and the D-15 scope fence.
</what_this_round_ships>

<round_carryover>
Facts the Round 3 agenda quotes. All are already recorded in `22-VALIDATION.md`'s Round 1 and Round 2
sections and are restated here so the executor does not re-derive them.

**The failing row this round re-asks, twice over.**
Round 1 R11 (FAIL), developer's words: *"Total column values seem fine. Day cell values can slightly
overflow once width to narrow (not a big issue for me, can just be documented if not fixable very
quickly)"* and *"behavior similar in light and dark theme"*. They were explicitly offered a
documented-PASS framing and chose FAIL.
Round 2 R13 (FAIL), the re-ask against the fixed build, developer's words: *"Days still overflow.
Total colum remains wide (wider than any other column) and all text fits. But other columns (day
columns) become narrow and distance text overflows."* No width was stated on that row, because the
agent's attempted narrow-viewport method never engaged the media query
(`matchMedia('(max-width: 380px)').matches` returned `false`) and the row reverted to the developer.
**R19 must state a width.**

**The row that was declined and has never been run.** Round 2 R16 (BLOCKED), developer's word:
*"decline it"*. Nothing has been established in a real browser about the browser-configuration-level
blocked-storage path in this phase. `22-REVIEW.md` BL-03 predicted a blank page from static analysis;
that prediction has never been observed.

**October 2025, Monday-start week totals** (recomputed from the live archive during Round 1 planning;
`data/dashboard/index.json`, 1,868 activities):

| Wk | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1–5 | 59.1 km | 5h 42m | 5 |
| 2 | 6–12 | 80.0 km | 7h 53m | 6 |
| 3 | 13–19 | 80.0 km | 7h 58m | 5 |
| 4 | 20–26 | 80.0 km | 7h 42m | 6 |
| 5 | 27–31 | 58.1 km | 5h 32m | 5 |

**Known rounding artifact — NOT a bug.** The month header renders `357.3 km`; the Monday-start rows
display-sum to `357.2 km`, purely from independent per-row `toFixed(1)`. Unrounded metres reconcile
at 357.349 km under both week starts. Do not open a row about it and do not record it as a defect.

**The Sunday-start values, for the contradiction guard only:** rows 3 and 4 read `56.0 km / 5h 27m /
4 runs` and `104.1 km / 10h 14m / 7 runs` under Sunday. R20 is a Monday-start row; those values must
not appear in its PASS cell.

**Bundles already observed:** Round 1 `assets/index-YqJHQsHW.js`; Round 2
`assets/index-Dlom2BM3.js` + `assets/index-aaEmW9us.css`.
</round_carryover>

**D-15 scope fence.** Trends, `records-logic.ts`'s biggest week, and the streak logic all stay
Monday-fixed by design — they read the pipeline's pre-computed Monday `weekStartISO` and this phase
deliberately does not touch them; no row on this agenda is opened against those surfaces.

| Row | Requirement | Instructions | Observation | Verdict |
|-----|-------------|---------------|-------------|---------|
| R18. | precondition | The URL bar reads `127.0.0.1` and includes `/strava-widgets/`; a hard reload was performed and the method is named; the `assets/index-*.js` filename read from the page matches the preamble AND is neither `index-YqJHQsHW.js` nor `index-Dlom2BM3.js`. **Required detail:** the URL as typed, the reload method, the bundle filename as read. **Observer required:** the developer's own eyes. | Observed by developer, own eyes. Developer's words: "Confirm its 127.0.0.1 with strava-widgets. R18:   `<script type=\"module\" crossorigin src=\"./assets/index-Bsnjp2E6.js\"></script>`". Bundle filename read from the page: `index-Bsnjp2E6.js` — matches the preamble's observed filename and is neither Round 1's `index-YqJHQsHW.js` nor Round 2's `index-Dlom2BM3.js`. Freshness is independently corroborated by Task 1's served-bundle HTTP check (fetched the served CSS, confirmed the BL-01/BL-02 380px declarations). Reload method was not separately named by the developer — recorded here as a stated deviation (thin, developer-granted waiver of house rule 1 per house rule 10; R18 is waivable). | R22-VERDICT: PASS |
| R19. | CAL-02, D-10, GC-4 | **The R13/R11 re-ask, third time, against BOTH the BL-01 and BL-02 fixes.** Narrow the viewport to a STATED pixel width, down to at least 380px (responsive-design mode or a phone emulation preset — name which, and name the width). Confirm the 380px rules are actually engaged before judging (`matchMedia('(max-width: 380px)').matches` should read `true`; Round 2's attempt failed exactly here). At that width read back the rendered text of at least three day cells that carry a distance, and the rendered text of one week-total cell. Then answer: does ANY value still overflow its cell? Does the eight-column grid overflow the panel or the viewport? Are the day columns still legible? Is the behaviour the same in the other theme? A value that is CLIPPED or TRUNCATED rather than overflowing is ALSO a FAIL — say which it is. A value that WRAPS onto two lines inside its cell is NOT a failure; that is the intended Round 3 behaviour. **Required detail:** the stated width, the `matchMedia` result, the quoted text of at least three day cells and one total cell, an explicit yes/no on overflow, an explicit clipped-versus-overflowing statement, and the both-themes comparison. **Observer required:** the developer's own eyes — NON-WAIVABLE (house rules 10 and 11). | Observed by developer, own eyes — NON-WAIVABLE, fully observed. TWO ATTEMPTS, both recorded per house rule 4. First attempt, developer's words: "R19: matchMedia('(max-width: 380px)').matches === true / false. I can't make the window smaller than a certain width (perhaps 380px?)." This attempt did NOT engage the 380px block (the same macOS window-width floor failure mode as Round 2's R13) and was NOT recorded as a verdict. The developer then re-ran the row using Chrome DevTools device emulation (Cmd+Shift+M), which is not bound by the OS window floor. Second attempt, developer's words: "3. True! 4. width 375. Day cell texts doesn't overflow. It gets stacked until there is space so one row could have only the first number of a distance for instance. Here is everything: Training Dashboard / Calendar / 357.3 km / across 27 runs / ‹ September / November › / Jump to month / October 2025 / Sunday / Monday / Mon Tue Wed Thu Fri Sat Sun Total / 1 26.0 km ×2 / 2 – / 3 11.0 km / 4 22.1 km ×2 / 5 – / Partial week, 5 days shown, week of October 1–5, 2025, 59.1 km, 5h 42m, 5 runs / 59.1 km 5h 42m ×5 / 6 11.2 km / 7 14.7 km / 8 13.6 km / 9 11.3 km / 10 11.6 km / 11 17.8 km / 12 – / Week of October 6–12, 2025, 80.0 km, 7h 53m, 6 runs / 80.0 km 7h 53m ×6 / 13 12.4 km / 14 – / 15 21.0 km / 16 11.5 km / 17 – / 18 11.1 km / 19 24.0 km / Week of October 13–19, 2025, 80.0 km, 7h 58m, 5 runs / 80.0 km 7h 58m ×5 / 20 – / 21 20.5 km ×2 / 22 13.4 km / 23 14.1 km / 24 11.0 km / 25 21.1 km / 26 – / Week of October 20–26, 2025, 80.0 km, 7h 42m, 6 runs / 80.0 km 7h 42m ×6 / 27 26.1 km ×2 / 28 11.0 km / 29 – / 30 10.0 km / 31 11.0 km / Partial week, 5 days shown, week of October 27–31, 2025, 58.1 km, 5h 32m, 5 runs / 58.1 km 5h 32m ×5". Both-themes answer, developer's words: "R19: dark and light behave same". Required detail satisfied: stated width 375px (below the 380px threshold), `matchMedia('(max-width: 380px)').matches` = true (the block IS engaged — this is what Round 2's R13 could never achieve), far more than three distance-carrying day cells quoted (e.g. day 1 "26.0 km ×2", day 3 "11.0 km", day 4 "22.1 km ×2"), multiple week-total cells quoted (e.g. "59.1 km 5h 42m ×5", "80.0 km 7h 53m ×6"), explicit "doesn't overflow", and both themes compared ("dark and light behave same"). No value is clipped or truncated — values wrap onto additional lines within the cell instead ("It gets stacked until there is space so one row could have only the first number of a distance for instance"), which the row's own criterion treats as the intended Round 3 behaviour, not a failure. | R22-VERDICT: PASS |
| R20. | CAL-02, D-16 | Back at normal width on `#/calendar?month=2025-10` under Monday-start, read back all five week-total cells: distance, time and run count. Compare against the Monday-start table in the preamble. This is the regression check on the BL-01/BL-02 CSS and on the app-wide storage refactor — the grid math and the total cell must be unchanged by both. **Required detail:** five triples of distance / time / run count, quoted as rendered. **Observer required:** the developer's own eyes. | Observed by developer, own eyes. Developer's words: "R20: Confirm!" accompanied by the full rendered page dump (the same dump quoted under R19: headings Mon Tue Wed Thu Fri Sat Sun Total, October 1 on Wednesday). Five week-total triples read back, top to bottom: 59.1 km / 5h 42m / ×5 (week of October 1–5); 80.0 km / 7h 53m / ×6 (week of October 6–12); 80.0 km / 7h 58m / ×5 (week of October 13–19); 80.0 km / 7h 42m / ×6 (week of October 20–26); 58.1 km / 5h 32m / ×5 (week of October 27–31). All five triples match the Monday-start table in the Round 3 preamble exactly. Weekday headings read Mon Tue Wed Thu Fri Sat Sun, confirming Monday-start. Header shows 357.3 km / 27 runs — the known `toFixed(1)` rounding artifact, not chased as a defect. | R22-VERDICT: PASS |
| R21. | CAL-03, IN-05 | Confirm-unregressed. At normal width, look along `.calendar-header` (month total, two nav buttons, the `Jump to month` input, the segmented group) and confirm nothing is misaligned or overlapping; then find a wide week-total cell (October 2025 under Sunday-start has `104.1 km / 10h 14m / ×7`) and confirm the `Total` header still sits over the values it labels rather than centred away from them. Both themes. This row does not re-gate CAL-03. **Required detail:** a description of the header alignment, where the `Total` header sits relative to the values, the week used, and the theme comparison. **Observer required:** the developer's own eyes. | Observed by developer, own eyes (thin, developer-granted waiver of house rule 1 — recorded as a stated deviation per house rule 10; R21 is waivable and does not gate CAL-03). First answer, developer's words: "R21: yes". Second answer, developer's words: "2. header alignmenet is good. I pasted the whole thing to you. Total sits on top of valies." Header alignment confirmed good; the `Total` header confirmed sitting on top of its values (developer's own phrasing: "Total sits on top of valies"). Week used: October 2025 (the same rendered page dump quoted under R19/R20). Theme comparison was not separately stated for this row — recorded here as a stated deviation per house rule 10. This row is confirm-unregressed and does not gate CAL-03. | R22-VERDICT: PASS |
| R22. | CAL-01, T-22-WK-02, GC-5, BL-03 | **Gap 2, real browser configuration. MANDATORY — this row may not be declined (house rule 12) and may not be waived (house rules 10, 11).** Block site data for the origin — Firefox: Settings → Privacy & Security → Cookies and Site Data → Custom → Cookies → **All cookies**; Chrome: `chrome://settings/content/siteData` → *Don't allow sites to save data*. Then RELOAD `http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10` (a full reload, not a hash navigation — the whole point is to re-run the app bootstrap under the blocked configuration) and describe what the page shows. **Disposition rules, applied by the executor when recording:** (a) the app boots — the nav renders, the Calendar route renders its grid AND its five week-total cells, the week start reads Monday, and the console carries no application error → **PASS**; (b) the page is blank, with no nav and no view content → **FAIL** of the Gap 2 fix (this is the outcome `22-REVIEW.md` BL-03 predicted for the PRE-fix build; the app-wide guard exists to prevent it); (c) the generic `Something went wrong` panel → **FAIL**. **Only PASS, FAIL or BLOCKED are valid outcomes for this row — the soft-fail verdict this agenda's vocabulary otherwise allows for an unreachable claim does not apply here.** **Required detail:** the browser and the exact setting used, what the page rendered (nav present? grid present? how many week-total cells? which week start?), any console error text, and which of (a)/(b)/(c) it matches. **Observer required:** the developer's own eyes — NON-WAIVABLE (house rules 10 and 11). | Observed by developer, own eyes — NON-WAIVABLE, fully observed. THREE STAGES, all recorded per house rule 4. Stage 1, developer's words: "R22: pass" — this bare assertion carried none of the row's required detail and was NOT accepted or recorded as a verdict (accepting it would repeat exactly the thin-evidence defect `22-VERIFICATION.md` scored against Rounds 1 and 2); the developer was asked for the required detail. Stage 2, developer's words: "R22: can't change those settings on my chrome as it is managed by my org." — verified as a genuine environmental block, not a decline: the machine carries a managed Chrome preference `DefaultCookiesSetting = 1` (allow) at `/Library/Managed Preferences/com.google.Chrome`, which makes `chrome://settings/content/siteData` un-settable. House rule 12 was NOT triggered — the developer never declined the row; Chrome specifically could not express the required state. Firefox and Safari were confirmed installed and unmanaged, and the row records whichever browser was used, so the developer re-ran it in Safari. Stage 3 — the recorded observation, developer's words: "Safari,blocked cookies. Nav rendered and grid. Started at monday as default. no errors. a)." Required detail satisfied: browser Safari, setting Block all cookies, nav rendered, grid rendered, week start read Monday (the default), no console errors, developer selected disposition (a). Disposition (a) is defined in the agenda as the full conjunction including the five week-total cells rendering; the developer selected disposition (a) rather than separately enumerating a cell count — no specific cell count is recorded here, none is invented. This is the first time in Phase 22 that the blocked-site-data path has been exercised in a real browser; Round 2's R16 was declined and never run. | R22-VERDICT: PASS |
| R23. | CAL-01, GC-5 | **Restore and regression-check.** Restore the browser setting changed at R22 and confirm it is restored. Then, with storage working normally: hard-reload the Calendar, select `Sunday`, hard-reload again and confirm `Sunday` is still the filled option with `Sun` as the first weekday heading; then cycle the header theme toggle once, reload, and confirm the theme mode stuck. This is the regression row the app-wide storage refactor requires — six call sites moved onto a shared resolver and both persistence paths must still work for a normal user. **Required detail:** confirmation the browser setting was restored, which option was filled and the first weekday heading after the reload, and what the theme was before and after its reload. **Observer required:** the developer's own eyes. | Observed by developer, own eyes (thin, developer-granted waiver of house rule 1 — recorded as a stated deviation per house rule 10; R23 is waivable). First answer, developer's words (given BEFORE R22 was actually run, therefore stale and superseded): "R23: confirm". Final answer, given after the Safari "Block all cookies" setting was restored, developer's words: "1. Yeah theme sticks after allowing cookines." The Safari "Block all cookies" setting from R22 WAS restored (house rule 9 satisfied — "after allowing cookies"). Theme persistence across reload was directly confirmed. The week-start half of the row (selecting Sunday, hard-reloading, and confirming Sunday is still filled with Sun as the first weekday heading) was answered only by the earlier, now-stale bare "confirm" and was NOT re-stated with detail after the restore — recorded here honestly as a gap and a stated deviation; no Sunday/Sun observation is invented for the post-restore state. | R22-VERDICT: PASS |

### Row-to-requirement map (Round 3)

**R18 gates all rows.** **CAL-02 → R19, R20 (both gating).** **CAL-01 → R23 (gating); R22 gates Gap 2's
disposition and is mandatory, but does not by itself re-gate CAL-01's persistence claim.** **CAL-03 →
R21 (confirm-unregressed, not gating).**

## Checkpoint Outcome (Round 3)

**6 PASS, 0 FAIL, 0 BLOCKED, 0 NOT EXERCISABLE** across R18–R23.

All six rows PASS. Three stated deviations recorded — mid-session, thin-answer waivers of house rule 1
that the developer granted, and that were granted only on rows the plan permits (R18, R21, R23; never
on the non-waivable R19/R22):

- **R18 (thin, waived).** The reload method was not separately named by the developer; the URL and the
  bundle filename were both confirmed. Freshness is independently corroborated by Task 1's served-bundle
  HTTP check, so this thinness does not undermine the row's PASS.
- **R21 (thin, waived).** The both-themes comparison was not separately stated for this row (unlike
  R19, where it was fully given). Header alignment and the `Total`-over-values relationship were both
  confirmed. R21 is confirm-unregressed and does not gate CAL-03, so this thinness is accepted per the
  developer's own waiver.
- **R23 (thin, waived).** The week-start persistence half (Sunday selection + `Sun` heading after
  reload) was answered only by an earlier, stale "confirm" given before R22 was actually run, and was
  not re-stated with detail after the R22 browser setting was restored. The theme-persistence half was
  fully confirmed after the restore. This gap is recorded honestly rather than papered over with an
  invented Sunday observation.

R19 and R22 — the two non-waivable, decisive rows — were both fully observed by the developer's own
eyes with the required detail, with no waiver requested or granted on either:

- **R19** took two attempts. The first attempt (native window resize) never engaged the 380px media
  query (`matchMedia` false) and was not recorded as a verdict — the same macOS window-floor failure
  mode as Round 2's R13. The developer then switched to Chrome DevTools device emulation
  (Cmd+Shift+M) and re-ran the row at a stated 375px, with `matchMedia('(max-width: 380px)').matches`
  reading `true` — the first time in this phase the 380px block has been provably engaged during an
  observation. No overflow, clipping or truncation; values wrap onto additional lines instead, which is
  the row's own stated non-failure behaviour.
- **R22** took three stages. A bare "pass" (stage 1) was explicitly declined as insufficient evidence
  and not recorded. A genuine environmental block was then found and verified (stage 2) — the
  developer's org-managed Chrome installation cannot express the required site-data-blocking setting
  (`DefaultCookiesSetting = 1` under `/Library/Managed Preferences/com.google.Chrome`). House rule 12
  was not triggered because the developer never declined the row; Chrome specifically could not comply.
  The row was re-run in Safari (unmanaged), which produced the recorded observation (stage 3): nav
  rendered, grid rendered, Monday default, no console errors, disposition (a).

No source file was edited during the session.

## Gap Closure Record (Round 3)

- **Gap 1 (CAL-02, the ~380px day-cell overflow, `22-VERIFICATION.md`, FAILED at Round 1's R11 and
  Round 2's R13) — CLOSED.** Decided by R19, PASS, with R20 recorded alongside as the regression check
  (also PASS — all five Monday-start week-total triples match the preamble table exactly, and the
  Mon-Tue-Wed-Thu-Fri-Sat-Sun headings confirm Monday-start). R19 is the first round in which the
  developer's own eyes confirmed `matchMedia('(max-width: 380px)').matches === true` while reading the
  day-cell and week-total values back: at a stated 375px, no value overflows, is clipped, or is
  truncated — values wrap onto additional lines instead, which the row's own criterion treats as
  intended Round 3 behaviour rather than a failure. This is the third consecutive ask of this claim
  (R11 FAIL, R13 FAIL, R19 PASS) and the first to actually engage the breakpoint being judged. The
  DISC-6b `.splits-scroll` horizontal-scroll wrapper remains the documented, unimplemented fallback —
  it was not needed this round and is not proposed, planned or implemented here.
- **Gap 2 (BL-03, the app-level blocked-site-data threat and CR-01's overclaiming documentation,
  `22-VERIFICATION.md`) — CLOSED.** Decided by R22, PASS, disposition (a). The app-wide
  `resolveStorage()` guard (plans 22-10/22-11) was observed closing the threat end to end in a real
  browser configuration for the first time in this phase: under Safari with "Block all cookies" active,
  a full reload re-ran the app bootstrap, the nav rendered, the Calendar grid rendered, the week start
  defaulted to Monday, and no console errors were reported. `22-VERIFICATION.md` truth #7 ("CR-01's own
  documentation accurately describes what is and is not covered") is now backed by both the corrected
  `calendar-preferences.ts`/`calendar.ts` comments and this real-browser observation. Round 2's R16
  (declined, "decline it") is superseded — the browser-configuration-level path has now actually been
  exercised.

## Known and Accepted (Round 3)

- **The 357.349 km rounding artifact — not a bug, still knowingly shipped.** R20 read the month header
  as `357.3 km` against the Monday-start rows' display-sum of `357.2 km`, purely from independent
  per-row `toFixed(1)`. Unrounded metres reconcile exactly at 357.349 km under both week starts. Not
  raised as a defect this round.
- **The D-15 scope fence — knowingly shipped, not a gap.** Trends' weekly volume, `records-logic.ts`'s
  biggest week, and the streak logic all stay Monday-fixed by design and were not opened against any
  Round 3 row.
- **The DISC-6b `.splits-scroll` horizontal-scroll wrapper remains documented and unimplemented, by
  deliberate choice, not omission.** GC-4's deeper CSS compaction (`minmax(0, max-content)`,
  single-column day-cell stacking, `overflow-wrap: anywhere`) closed Gap 1 this round without it; the
  fallback remains available should a future viewport regression reopen the claim.
- **`22-REVIEW.md`'s WR-04, WR-05, WR-08, WR-09, WR-10 and WR-11 were scoped out of Round 3 and remain
  open code-review warnings for the user to disposition.** R21 read the current WR-05 8px header/value
  offset as correct alignment, not misaligned, but WR-05 itself was not re-opened or re-scoped by this
  round — it stays an open code-review item outside this checkpoint's row map.

## Round 4

_Staged by the planner 2026-08-19 (plans `22-13` … `22-16`), after `22-VERIFICATION.md` re-verified
at 5/8 with `status: gaps_found`. This section is APPEND-ONLY: the Round 1 (R1–R11), Round 2
(R12–R17) and Round 3 (R18–R23) sections, their verdicts and their frontmatter dates are not
rewritten. Plan `22-16` Task 1 inserts the build-freshness preamble immediately below the
`## Round 4` heading; plan `22-16` Task 3 fills the Observation and Verdict cells._

Task 1's full gate ran green on a clean working tree: `npm test` 1272/1272 across 53 files (exit 0);
`npx tsc --noEmit -p tsconfig.json` clean (exit 0); `npx vitest run src/dashboard` 915/915 across 31
files (exit 0); `npm run build-widgets` exit 0 with zero `css-syntax-error` occurrences in the captured
log; `npm run verify-dashboard` 37/37 checks passed (exit 0). Unlike every prior round, no
`deferred-items.md`-shaped environmental failure occurred this round — all five gate commands passed
cleanly with no exceptions to record. `git status --porcelain src scripts data dist` was empty both
before and after staging.

The build is staged under the production path shape and served from `127.0.0.1`, never `localhost` —
served URL prefix `http://127.0.0.1:8099/strava-widgets/`. The two calendar routes this session uses
are `http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10` (R24–R27, R28 ii/iii) and, for
R28(i) only, the same route under Sunday-start.

**Then the served artifact was proven to be THIS round's build, not any of the three previously
observed builds.** The `assets/index-*.js` and `assets/index-*.css` filenames were read out of the
served `index.html`: JS `assets/index-BWkFUnJ1.js`, CSS `assets/index-BnKFUiAg.css`. The JS filename
differs from ALL THREE prior rounds' — Round 1's `assets/index-YqJHQsHW.js`, Round 2's
`assets/index-Dlom2BM3.js`, and Round 3's `assets/index-Bsnjp2E6.js` — and the CSS filename differs
from BOTH prior stylesheets — Round 2's `assets/index-aaEmW9us.css` and Round 3's
`assets/index-C-Jvo-sR.css`. The served CSS was independently fetched over HTTP and parsed: exactly one
`@media (max-width: 640px)` block mentions `.calendar-week-total`, and that block positively contains
`minmax(0, max-content)` — the Round 4 track-widening fix (plan `22-15`) is actually present in the
observed artifact, not merely claimed by a changed hash — and no `@media (max-width: 380px)` block in
the served CSS mentions any `.calendar-` selector, confirming the compaction rules were moved rather
than duplicated. Honestly noted: the JS-side changes (`nav-theme.ts`'s in-memory controller, the
null-honouring `resolveStorage` override) cannot be discriminated in a minified bundle by string match,
so their freshness rests on the changed filename plus the behavioural rows R27 and R28, exactly as
`<cache_trap>` below states. **No staged fixture is used or permitted in this round** — every value
below comes from the live, organic `data/dashboard/index.json` archive (1,868 activities).

<cache_trap>
`127.0.0.1` alone is NOT sufficient. This project has been bitten repeatedly: Phase 21 Round 1's R13
only passed after a hard reload cleared a stale cached `streaks.json`, and the staged-build trap
recurs with a stale `index.html` / `index.json` in the observing tab.

Every checkpoint session must: browse `127.0.0.1`, never `localhost`; serve under the
`/strava-widgets` project path, never the server root; and hard reload (Cmd+Shift+R, Cmd+Option+R in
Safari, or DevTools open with "Disable cache" ticked, then reload) before judging any row.

**Round 4's build-freshness bar is the strictest of the phase, because THREE builds have now been
observed.** Round 1 was judged against `assets/index-YqJHQsHW.js`. Round 2 against
`assets/index-Dlom2BM3.js` + `assets/index-aaEmW9us.css`. Round 3 against `assets/index-Bsnjp2E6.js` +
`assets/index-C-Jvo-sR.css`. If Round 4 is judged against any of them, the Round 4 fixes are not in the
observed artifact and every verdict is worthless.

Round 4 additionally has a POSITIVE served-text discriminator the earlier rounds lacked for the CSS
side: the served stylesheet must carry a `@media (max-width: 640px)` block that contains both
`.calendar-week-total` and `minmax(0, max-content)`. A build that does not carry it is pre-`22-15`.
Honestly noted: the JS-side changes (`nav-theme.ts`'s controller, the null-honouring resolver) cannot
be discriminated in a minified bundle by string match, so their freshness rests on the changed filename
plus the behavioural rows R27 and R28.

The `localStorage` surface persists too: R27 requires a browser-wide storage state and R28 requires it
restored, and each is judged only after a reload.
</cache_trap>

<round_carryover>
Facts the Round 4 agenda quotes. All are already recorded in `22-VALIDATION.md`'s earlier sections and
are restated here so the executor does not re-derive them.

**The claim R25 re-asks, for the fourth time, in a band no row has ever entered.**
Round 1 R11 (FAIL), developer's words: *"Total column values seem fine. Day cell values can slightly
overflow once width to narrow"*, *"behavior similar in light and dark theme"*.
Round 2 R13 (FAIL), the re-ask against the fixed build: *"Days still overflow. Total colum remains wide
(wider than any other column) and all text fits. But other columns (day columns) become narrow and
distance text overflows."* No width was stated — the agent's resize attempt never engaged the media
query.
Round 3 R19 (PASS), at a stated **375px** via Chrome DevTools device emulation with
`matchMedia('(max-width: 380px)').matches === true`: *"Day cell texts doesn't overflow. It gets stacked
until there is space so one row could have only the first number of a distance for instance."* and
*"dark and light behave same"*. **That PASS is valid for the sub-380px half of the band and nothing
else.** R25 exists because 381-640px was governed by disjoint CSS rules until plan `22-15`, and no row
in any round has ever been judged there.

**The control R27 exercises, which R22 rendered but never touched.** Round 3 R22 (PASS,
non-waivable, three stages), developer's words: *"Safari,blocked cookies. Nav rendered and grid.
Started at monday as default. no errors. a)."* The page rendered — and the theme toggle on it was
broken the whole time.

**The half R28(i) re-asks.** Round 3 R23 (PASS, thin/waived), developer's words after the restore:
*"1. Yeah theme sticks after allowing cookines."* The week-start half — select Sunday, hard-reload,
confirm `Sunday` filled with `Sun` first — was answered only by an earlier, stale bare *"R23: confirm"*
given BEFORE R22 was run. `22-VERIFICATION.md` records this as a real evidence-quality gap.

**October 2025, Monday-start week totals** (from the live archive, `data/dashboard/index.json`,
1,868 activities):

| Wk | Days (Oct) | Distance | Time | Runs |
|-----|------------|----------|------|------|
| 1 | 1-5 | 59.1 km | 5h 42m | 5 |
| 2 | 6-12 | 80.0 km | 7h 53m | 6 |
| 3 | 13-19 | 80.0 km | 7h 58m | 5 |
| 4 | 20-26 | 80.0 km | 7h 42m | 6 |
| 5 | 27-31 | 58.1 km | 5h 32m | 5 |

**Known rounding artifact — NOT a bug.** The month header renders `357.3 km`; the Monday-start rows
display-sum to `357.2 km`, purely from independent per-row `toFixed(1)`. Unrounded metres reconcile at
357.349 km under both week starts. Do not open a row about it.

**Known and accepted, not a defect.** `deferred-items.md` records that at very narrow widths a distance
value may wrap after its first digit (`overflow-wrap: anywhere` has no preference for breaking between
tokens). R19's own criterion treats wrapping as intended behaviour, and R25/R26 carry the same clause.

**The Sunday-start values, for the contradiction guard only:** October 2025 rows 3 and 4 read
`56.0 km / 5h 27m / 4 runs` and `104.1 km / 10h 14m / 7 runs` under Sunday. R28(ii) is a Monday-start
reading; those values must not appear in its PASS cell.

**Bundles already observed:** Round 1 `assets/index-YqJHQsHW.js`; Round 2 `assets/index-Dlom2BM3.js` +
`assets/index-aaEmW9us.css`; Round 3 `assets/index-Bsnjp2E6.js` + `assets/index-C-Jvo-sR.css`.

**The three aria-label strings R27 reads back**, from `nav.ts`'s `THEME_MODE_LABEL`:
`Theme: light`, `Theme: dark`, `Theme: auto`.
</round_carryover>

**D-15 scope fence.** Trends' weekly volume, `records-logic.ts`'s biggest week, and the streak logic
all stay Monday-fixed by design — they read the pipeline's pre-computed Monday `weekStartISO` and this
phase deliberately does not touch them. No row on this agenda is opened against those surfaces.

**House rule 14 reminder.** R25, R26 and R27 below are all marked **NON-WAIVABLE** — the executor
must not observe them on the developer's behalf, must not resize a window or open device emulation or
change a browser privacy setting to fill their Observation cells, and must decline and record BLOCKED
if a waiver is offered or requested on any of the three. R27 additionally may not be declined.

### What Round 4 ships

Quoted into the Round 4 preamble so the developer knows what they are looking at.

**Plan `22-15` (GC-7, closing `22-REVIEW.md` CR-02 / `22-VERIFICATION.md` Gap 1).** Round 3's overflow
fix was real but was pinned to `@media (max-width: 380px)`. Above that breakpoint the original
defect-causing rules were still unconditional — `.calendar-grid { grid-template-columns: repeat(7, 1fr)
auto }`, `.calendar-day { min-width: 32px }` and `.calendar-week-total { white-space: nowrap }` with no
`min-width` override — and they governed every width from 381px up to at least 1000px. That band
contains the three most common real phone CSS widths (390px iPhone 12–15, 393px iPhone 15/16 Pro,
412px Pixel), and no checkpoint row in any of the three prior rounds ever observed a width inside it:
R19, the row that closed Gap 1, observed exactly 375px. Round 4 raises the whole calendar compaction
block's prelude from `@media (max-width: 380px)` to `@media (max-width: 640px)`. Every declaration
inside it is unchanged; only the breakpoint moved. `.view`'s 24px padding is deliberately NOT touched —
it is shared by all five screens and the 640px cutoff already clears CR-02's computed ~530px overflow
edge by roughly 113px. D-10's eight-column contract (`repeat(7, 1fr) auto`) survives unchanged as the
default-breakpoint shape at 641px and above.

**Plans `22-13` and `22-14` (GC-8/GC-9, closing `22-REVIEW.md` CR-01 and WR-01 / `22-VERIFICATION.md`
Gap 2 and Finding 8).** The header theme toggle held no in-memory state: `handleThemeToggleClick`
re-derived the current mode from storage on every click, so under a null or unusable storage handle
`readStoredMode(null)` returned `'auto'` every time, `cycleThemeMode('auto')` returned `'light'` every
time, and the toggle was permanently stuck on light with dark and auto unreachable. This became
reachable only because Round 3's own fix stopped the same blocked-site-data configuration crashing the
page blank — the round traded a blank page for a working page with a broken control, and R22 never
clicked the toggle. Round 4 moves the mode into an in-session variable owned by a new
`src/dashboard/nav-theme.ts` controller, seeded once from storage at mount and reassigned on each
click — the same `let weekStart` pattern `calendar.ts:443` already uses, which is exactly why the
week-start toggle never had this bug. `watchSystemTheme`'s auto-only guard now consults that in-memory
mode via an `isAuto` callback instead of re-reading storage, so an OS colour-scheme change can no
longer silently override a mode the user picked in this session. Separately, `resolveStorage` now
honours an explicit `storage: null` as "no storage" instead of coercing it to `undefined` and falling
through to the real `globalThis.localStorage`; the three Round 3 `theme.test.ts` cases that passed
`storage: null` were passing vacuously only because `vitest.config.ts` runs `environment: 'node'` with
no `globalThis.localStorage` anywhere, and they are replaced with sentinel-global cases that fail if
the override is ignored.

**What Round 4 did NOT touch:** `index.html`'s inline pre-paint script, the DISC-6b `.splits-scroll`
horizontal-scroll fallback (still documented, still deliberately unimplemented), `.view`'s padding,
WR-05's 8px header/value cosmetic offset, and the D-15 scope fence (Trends' weekly volume,
`records-logic.ts`'s biggest week and the streak logic all stay Monday-fixed by design and no Round 4
row is opened against them).

### House rules (Round 4)

House rules **1 through 13** are carried forward **verbatim** from the `<house_rules>` block in the
Round 3 section above and bind this round unchanged. Plan `22-16` Task 1 re-quotes them in full into
the Round 4 preamble. One Round 4 addition, **not negotiable mid-session**:

14. **(Round 4) R25, R26 and R27 are NON-WAIVABLE, and R27 additionally may not be declined.**
    Three rounds of this phase have now been scored down for thin or agent-substituted evidence on
    exactly the rows that decided a gap. `22-VERIFICATION.md` reopened Gap 1 specifically because R19,
    a non-waivable row that PASSED, only ever observed one pixel width; and it found Gap 2's new
    Critical specifically because R22, a non-waivable row that PASSED, only observed a page rendering
    and never exercised a control on it.
    - If the developer offers or asks for a waiver on R25, R26 or R27, the executor **declines**,
      records the request and the developer's words verbatim in that row's Observation cell, and
      records that row **BLOCKED** — never PASS, never FAIL. An agent-observed result on those three
      rows is not evidence, and neither is a source read, a computed-style dump, a screenshot the
      executor took itself, or a `matchMedia` result the executor evaluated.
    - The executor must not resize a window, open device emulation, or change a browser privacy
      setting in order to observe R25, R26 or R27 on the developer's behalf.
    - **R27 may not be declined.** It is the only row that exercises the control CR-01 broke, under the
      only configuration that breaks it. If it is declined, the row is recorded **BLOCKED**, Gap 2 is
      recorded **STILL OPEN**, and the Checkpoint Outcome states plainly that the theme toggle's
      behaviour under blocked storage remains unobserved. It has no `NOT EXERCISABLE` disposition and
      may not be closed on `nav-theme.test.ts`'s unit evidence or on source reading.
    - For R24 and R28 a mid-session waiver remains the developer's to grant, recorded verbatim in that
      row's Observation cell and written into the Checkpoint Outcome as a stated deviation.

### Agenda (Round 4)

| Row | Requirement | Instructions | Observation | Verdict |
|-----|-------------|--------------|-------------|---------|
| R24. | precondition | The URL bar reads `127.0.0.1` and includes `/strava-widgets/`; a hard reload was performed and the method is named; the `assets/index-*.js` filename read from the page matches the preamble AND is none of `index-YqJHQsHW.js` (Round 1), `index-Dlom2BM3.js` (Round 2) or `index-Bsnjp2E6.js` (Round 3); the `assets/index-*.css` filename is neither `index-aaEmW9us.css` (Round 2) nor `index-C-Jvo-sR.css` (Round 3). Three builds have now been observed in this phase — if a fourth round is judged against any of them, every verdict below is worthless. **Required detail:** the URL as typed, the reload method, and BOTH asset filenames as read off the page. **Observer required:** the developer's own eyes. | | |
| R25. | CAL-02, D-10, GC-7 | **The band no round has ever tested: strictly above 380px.** Use Chrome DevTools device emulation (Cmd+Shift+M) or Firefox/Safari responsive-design mode — a native window resize cannot reach these widths on macOS and is what defeated Round 2's R13 and Round 3's R19 first attempt. Set a STATED width of 390px (iPhone 12/13/14/15), 393px (iPhone 15/16 Pro) or 412px (Pixel) — say which. **Before judging, confirm BOTH of:** `matchMedia('(max-width: 640px)').matches` reads `true` AND `matchMedia('(max-width: 380px)').matches` reads `false`. Both are required: the first proves the widened compaction is engaged, the second proves you are in the newly-covered band and not repeating R19's 375px observation. On `#/calendar?month=2025-10`, read back the rendered text of at least three day cells that carry a distance, and the rendered text of at least one week-total cell. Then answer: does ANY value overflow its cell? Does the eight-column grid overflow the panel or the viewport? Are the day columns legible? Is the behaviour the same in the other theme? A value that is CLIPPED or TRUNCATED rather than overflowing is ALSO a FAIL — say which it is. A value that WRAPS onto additional lines inside its cell is NOT a failure. **Required detail:** the stated width and the emulation method named, BOTH `matchMedia` results, the quoted text of at least three day cells and one total cell, an explicit yes/no on overflow, an explicit clipped-versus-overflowing statement, and the both-themes comparison. **Observer required:** the developer's own eyes — NON-WAIVABLE (house rules 10, 11 and 14). | | |
| R26. | CAL-02, GC-7 | **The new risk this round's own fix creates.** The compaction that used to apply only at ≤380px — the single-column day-cell stack, the start-aligned children, the 14px/12px type steps — now applies at every width up to 640px. No round has ever seen the calendar render that way at a large-phone or small-tablet width. At a STATED width of roughly 600px (device emulation or responsive mode — name which), confirm `matchMedia('(max-width: 640px)').matches` reads `true`, then read back the rendered text of at least two day cells that carry a distance and one week-total cell, and say whether the calendar looks intentional or looks broken at that width: is the compacted type legible, and does anything overflow, clip or truncate? **Required detail:** the stated width, the emulation method, the `matchMedia` result, the quoted text of at least two day cells and one total cell, an explicit legible / not-legible judgement, and an explicit yes/no on overflow. **Observer required:** the developer's own eyes — NON-WAIVABLE (house rules 10, 11 and 14). | | |
| R27. | CAL-01, GC-8, BL-03, CR-01 | **Gap 2's new Critical, exercised. MANDATORY — this row may not be declined (house rules 12 and 14) and may not be waived (house rules 10, 11 and 14).** Re-enable site-data blocking for the origin, the SAME configuration R22 used — Safari: Settings → Privacy → **Block all cookies**; Firefox: Settings → Privacy & Security → Cookies and Site Data → Custom → Cookies → **All cookies**. Then RELOAD `http://127.0.0.1:8099/strava-widgets/#/calendar?month=2025-10` (a full reload, not a hash navigation). Then click the header **theme toggle** — the sun/moon button at the right-hand end of the nav bar — **three times in a row**. After each click, read the button's `aria-label` (devtools Elements panel, or hover for the tooltip) and note whether the page's colours actually changed. R22 proved the page renders under this configuration; it never clicked anything on it, which is how this defect escaped. **Disposition rules, applied by the executor when recording:** (a) the `aria-label` CHANGES on each click and `Theme: dark` is reached at least once, with the page colours visibly changing → **PASS**; (b) the `aria-label` reads `Theme: light` after every click and dark is never reached → **FAIL** (this is exactly CR-01's predicted behaviour and means the Round 4 fix did not land in the observed build); (c) the page is blank, or shows the generic `Something went wrong` panel → **FAIL**, recorded additionally as a BL-03 regression. **There is no `NOT EXERCISABLE` disposition for this row.** **Required detail:** the browser and the exact setting used, the three `aria-label` values in the order they were read, an explicit statement of whether the page colours visibly changed on each click, and which of (a)/(b)/(c) it matches. **Observer required:** the developer's own eyes — NON-WAIVABLE (house rules 10, 11 and 14). | | |
| R28. | CAL-01, CAL-02, GC-5, D-16 | **Restore, and close the half R23 left thin.** First restore the browser setting changed at R27 and confirm it is restored (house rule 9). Then, with storage working normally and after a hard reload: **(i)** select `Sunday` on the segmented control, hard-reload again, and confirm `Sunday` is still the filled option AND that the first weekday heading reads `Sun` — `22-VERIFICATION.md` records that R23 answered this half only with an earlier, stale bare "confirm" given before R22 was run, and flagged it as a real evidence-quality gap; this row re-asks it properly. **(ii)** Return to Monday and, at normal desktop width on `#/calendar?month=2025-10`, read back all five week-total cells (distance, time, run count) and compare them against the Monday-start table in the preamble — the regression check that the widened CSS breakpoint and the nav/theme refactor changed no grid math. **(iii)** Cycle the header theme toggle once, reload, and confirm the mode stuck. **Required detail:** confirmation the browser setting was restored; which option was filled and the first weekday heading after the reload; five distance / time / run-count triples quoted as rendered; and the theme mode before and after its reload. **Observer required:** the developer's own eyes. | | |

### Row-to-requirement map (Round 4)

**R24 gates all rows.** **CAL-02 → R25, R26 and R28(ii) (all three gating — CAL-02's tick was found
OVERSTATED by `22-VERIFICATION.md` and is reverted to Pending until this round's rows decide it).**
**CAL-01 → R27 and R28 (both gating: R27 decides the CR-01 regression, R28(i) supplies the week-start
persistence evidence R23 left thin).** **CAL-03 → not re-gated this round; R21's Round 3
confirm-unregressed state stands.**
