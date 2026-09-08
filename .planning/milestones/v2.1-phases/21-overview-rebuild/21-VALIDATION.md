---
phase: 21
slug: overview-rebuild
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-18
round: 2
round1_staged: 2026-08-18
round1_answered: 2026-08-18
round2_staged: 2026-08-18
round2_answered: 2026-08-18
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `21-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']`, **no jsdom** |
| **Quick run command** | `npx vitest run <touched-test-file>` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~15 seconds (quick: ~2s) |

**Load-bearing constraint:** there is NO jsdom and NO headless browser in this repository.
Every requirement in milestone v2.1 is visual or interactive. **No Phase 21 success criterion
can be discharged by `npm test` alone** — the human browser checkpoint (Success Criterion 6) is
mandatory, not a formality. A fully green automated gate has masked real breakage three times
(Phase 16 black page, Phase 17 two rendering gaps, Phase 18 near-miss).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched-test-file>`
- **After every plan wave:** Run the established 4-command gate —
  `npm test` + `npx tsc --noEmit` + `npm run build-widgets`
- **Before `/gsd-verify-work`:** Full suite green AND served `127.0.0.1` `/strava-widgets`
  human browser checkpoint covering Success Criteria 1–6
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| OVR-01 | Shared renderer emits correct name/date/distance/badge text content and correct `aria-label` string | unit (text/string assertion) | `npx vitest run src/dashboard/views/list.test.ts src/dashboard/views/overview.test.ts` | ✅ | ✅ green (npm test 1122/1122, Task 1 gate) |
| OVR-01 | Two-line hierarchy renders; badges do not wrap into meta; degrades at narrow widths without a media query | manual-only | — | N/A | ✅ PASS (R1, R4, R5) |
| OVR-02 | Recent Activities and Recent PRs invoke the *same* renderer (source-identity), same linking semantics | unit | `npx vitest run src/dashboard/views/row-semantics.test.ts` | ✅ (extend) | ✅ green (npm test 1122/1122, Task 1 gate) |
| OVR-02 | Rows visually match across both cards and the Activities mobile card | manual-only | — | N/A | ✅ PASS (R2, R3) |
| OVR-03 | Year filter + re-rank produces correct `PrTableRow[]` (correct subset, correct 1..N ranks) | unit | `npx vitest run src/dashboard/views/records-logic.test.ts` | ✅ (new describe) | ✅ green (npm test 1122/1122, Task 1 gate) |
| OVR-03 | `.segmented` scope control renders, toggles, and re-renders correct table data | manual-only | — | N/A | ✅ PASS (R6, R8, R9, R10 Round 1; R14, R15 Round 2 — R15 supersedes Round 1's R7 BLOCKED via a staged best-efforts.json fixture) |
| OVR-04 | This-year tile values computed/formatted correctly from `yearly-stats.json`; em-dash degradation when absent | unit | `npx vitest run src/dashboard/views/overview.test.ts` | ✅ (new describe) | ✅ green (npm test 1122/1122, Task 1 gate) |
| OVR-04 | Two new tiles appear in `.stat-grid`, correctly positioned, both themes | manual-only | — | N/A | ✅ PASS (R11) |
| FIX-01 | `calculateDailyStreaks` returns correct `currentStreakEnd` in every scenario (active, ended, empty) | unit | `npx vitest run src/analytics/streak-utils.test.ts` | ✅ (new assertions) | ✅ green (npm test 1122/1122, Task 1 gate) |
| FIX-01 | `selectCurrentStreak` reads `currentStreakEnd` (not `currentStreakStart`) for `endedISO`; degrades when absent | unit | `npx vitest run src/dashboard/views/records-logic.test.ts` | ✅ (new describe) | ✅ green (npm test 1122/1122, Task 1 gate) |
| FIX-01 | `ended {date}` sub-label renders the **correct** date on Records and Overview against a genuinely-ended-streak fixture | manual-only (fixture-gated) | — | N/A | ✅ PASS (R12, R13) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Existing infrastructure covers all phase requirements.** Every test file this phase needs
already exists — `overview.test.ts`, `list.test.ts`, `list-logic.test.ts`,
`records-logic.test.ts`, `streak-utils.test.ts`, `row-semantics.test.ts`, `styles.test.ts`.
No new framework install, no new config, no new fixture directory.

One **checkpoint-preparation** task (not Wave 0 test infra) is required:

- [ ] Staged-build fixture edit to `dist/widgets/data/stats/streaks.json` (D-16) — must run
      AFTER `npm run build-widgets` and BEFORE the checkpoint opens, following plan 20-18's
      automated-verification-script pattern: assert the edit landed in `dist/`, assert `data/`
      is untouched, assert `git status --porcelain data` is clean.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-line row hierarchy; badges right-aligned and non-wrapping; narrow-width degradation | OVR-01 | No jsdom — layout is not assertable in `environment: 'node'` | Serve under `/strava-widgets` on `127.0.0.1`, open Overview, inspect Recent PRs and Recent Activities rows; narrow the viewport and confirm no badge wraps into the meta line and no media query is involved |
| Shared renderer parity across three surfaces | OVR-02 | Visual comparison | Same session: compare Overview Recent PRs, Overview Recent Activities, and the Activities screen mobile card |
| `.segmented` scope control interaction | OVR-03 | Requires real DOM events and re-render | On `#/records`, toggle All time ↔ This year; confirm all seven per-distance tables re-rank; confirm Superlatives, PR-evolution charts and Riegel predictions stay all-time (D-03); confirm scope resets to All time on re-arrival (D-04) |
| Two new Headline Stats tiles | OVR-04 | Visual placement + theming | Overview: confirm distance-this-year and hours-this-year tiles render in `.stat-grid` in both light and dark themes |
| `ended {date}` sub-label correctness | FIX-01 | Requires the staged-build fixture; no jsdom | After the D-16 fixture edit, load Records and Overview; confirm the Current Streak tile shows `ended {date}` with the streak's **end** date (not its start date) |

**Browser-cache trap:** serve and load via `127.0.0.1`, never `localhost` — staged checkpoints
have served stale `index.html` / `index.json` from `localhost` before.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly listed under Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — existing infra suffices)
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Round 1

Task 1's full gate ran green on a clean working tree: `npm test` 1122/1122 across 49 files, `npx tsc
--noEmit -p tsconfig.json` clean, `npm run build-widgets` exit 0 with zero `css-syntax-error`
occurrences in the captured log, `npm run verify-dashboard` 37/37 checks passed. The build is staged
under the production path shape and served from `127.0.0.1`, never `localhost` — served URL prefix
`http://127.0.0.1:8099/strava-widgets/`. Four routes are used this session: `#/` (Overview), `#/list`
(Activities), `#/records` (Records), and one activity detail, `#/activity/i174601247`. The bundle
filename read from the staged `index.html` is `assets/index-C0m8pdqN.js`.

**Fixture disclosure (D-16).** The live archive's streak is active, so the `ended` branch cannot be
observed against real data. Rows R12 and R13 are observed against a deliberate, disclosed edit to the
STAGED build only:

| Field | Repository `data/stats/streaks.json` | Staged `dist/widgets/data/stats/streaks.json` |
|-------|--------------------------------------|-----------------------------------------------|
| `withinCurrentStreak` | `true` | `false` |
| `currentStreak` | `2` | `0` |
| `currentStreakStart` | `2026-08-10T00:00:00.000Z` | `2026-08-10T00:00:00.000Z` (left as-is, deliberately) |
| `currentStreakEnd` | absent (no compute run yet) | `2026-08-03T00:00:00.000Z` |

`currentStreakStart` is left at its real value ON PURPOSE. It is the discriminator: the correct fix
renders **`ended Aug 3, 2026`**; the plausible wrong fix `21-RESEARCH.md` Pitfall 1 describes would
render **`ended Aug 10, 2026`**. Rows R12 and R13 are not answerable by "a sub-label appeared". The
next `npm run build-widgets` overwrites the staged copy. Nothing is committed, and the repository copy
of `streaks.json` was proven unmodified by a content assertion (a `git status` check is vacuous —
`data/stats/` is gitignored).

<house_rules>
Non-negotiable, established across checkpoints 16-09, 17-15, 19-05, 19-12, 19-17, 20-05, 20-11,
20-18 and 20-20:

- **One named verdict per row, and the row's own required detail with it.** A blanket statement
  covering several rows is not evidence.
- **Rows are presented ONE AT A TIME**, never as a numbered list of thirteen.
- **Every row names its observer**, using exactly one of: "observed by developer", "observed by
  agent (browser automation against the staged build)", or "observed by developer, corroborated by
  agent".
- **Rows marked "observer required: developer's own eyes" cannot be answered by agent automation.**
  If the developer declines, the row is recorded BLOCKED with the decline quoted.
- **A theme-sensitive row can only PASS if both the light and the dark theme are named.**
- **A failing row is recorded verbatim and left unpatched.** No suggested fix, no root-cause theory
  for a still-failing row. The next planning round owns diagnosis.
- **Never cite an automated result as evidence for a manual row.** `npm test` cannot observe a
  layout, a wrap, a re-rank, a theme or a rendered date.
- **Serve under `/strava-widgets`, never at the server root**, and browse **`127.0.0.1`, never
  `localhost`**.
- **The four-state verdict vocabulary is kept:** PASS, FAIL, BLOCKED, NOT EXERCISABLE. BLOCKED
  means the observation could not be produced for a dataset or environment reason; NOT EXERCISABLE
  means the gesture itself could not be performed. Neither is a defect verdict.
- **"I could not tell" and "I would rather not" are legitimate answers**, recorded as given.
</house_rules>

| Row | Behavior | Requirement | Instructions | Observation |
|-----|----------|--------------|---------------|-------------|
| R1. | Overview Recent PRs — the two-line hierarchy (D-06) | OVR-01 | On `#/`, look at the Recent PRs card. Each row should be two lines: the activity name on the first line with its badges pushed to the right edge of the row, and a second line reading date · distance · duration · pace. It should not read as three stacked blocks. Toggle the theme and look again. Required detail: the first row's name, the badge text you see on it, and the full second line, in both themes. Observer required: developer's own eyes. | Two-line hierarchy confirmed on the first Recent PRs row: name 'Lunch Run', badge '3 PR' on line 1, second line 'Sep 18, 2022 21.3 km 1:27:57 4:07/km'. Developer read the tile in both the light theme and the dark theme and reported both read correctly. R21-VERDICT: PASS — observed by developer. |
| R2. | Overview Recent Activities — the same structure (D-05) | OVR-02 | On the same page, scroll to Recent Activities. Compare a row here against a Recent PRs row directly above it. Required detail: whether the two rows have the same two-line shape and the same badge placement, stated as a comparison, plus any difference you can see. Observer required: developer's own eyes. | Compared a Recent Activities row against a Recent PRs row directly above it: same two-line shape and same badge placement, with no differences visible. R21-VERDICT: PASS — observed by developer. |
| R3. | Activities mobile card — the third surface (D-05) | OVR-02 | Narrow the window below 720px and open `#/list` so the mobile card layout renders instead of the table. Compare a card against the Overview rows from R1/R2. Required detail: whether the card has the same two-line shape as the Overview rows, and the name and second line of one card. Observer required: developer's own eyes. | Activities mobile card below 720px: card name 'Herlev Running', second line 'Aug 11, 2026 · 10.0 km · 0:58:09 · 5:49/km', the same two-line shape as the Overview rows. Confirmed by the developer from a 560px-viewport capture. R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R4. | Narrow-width degradation (D-06) | OVR-01 | With the window at roughly 360px wide, look at a row that carries at least one badge on Overview or `#/list`. Required detail: whether any badge has wrapped down onto the metrics line, and what the row looks like at that width. Observer required: developer's own eyes. | No badge wrapped down onto the metrics line; developer's words: 'no. badges appear on first line (activity name)'. IMPORTANT CAVEAT: this was observed at a ~521px viewport, NOT the ~360px this row specifies, because Chrome's minimum window width blocked the narrower viewport. The developer accepted it on that basis ('i think its fine'). R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R5. | The row is still a link (Phase 20 non-regression) | OVR-01 | Back at full width on `#/`, Tab to a Recent PRs row and confirm it takes exactly one Tab stop and shows a focus ring, then press Enter. Required detail: the number of Tab presses to move past the row, whether the focus ring was visible, and the `#/activity/...` URL you landed on. Observer required: developer's own eyes. | Three Shift+Tab presses crossed exactly three rows, proving one Tab press moves past the row — a single stop for the whole row. Focus ring clearly visible around the entire row ('Morning Run', 'Jan 2, 2021 · 10.1 km · 0:56:00 · 5:32/km', badge '1 PR'). Enter navigated to http://127.0.0.1:8099/strava-widgets/#/activity/4556693525. R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R6. | The Records scope control (D-01, D-02) | OVR-03 | Open `#/records` and scroll to the PR Tables section. A two-option control should sit between the section heading and the first distance table, reading All time and This year, with All time selected. Toggle the theme. Required detail: the two option labels as written, which one is selected on arrival, and whether the control is legible in both themes. Observer required: developer's own eyes. | The two-option control sits between the 'PR Tables' heading and the 400m table; labels read exactly 'All time' and 'This year', with 'All time' selected on arrival. Legible in both the light theme and the dark theme. R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R7. | The year scope re-ranks (D-01) | OVR-03 | Click This year. Pick one distance table that still has rows and read its top row. Required detail: the distance you picked, the rank shown in its first row, and the date in that row. Observer required: developer's own eyes. | Could not be exercised. With 'This year' selected, every one of the seven distance tables (400m, 1K, 1 Mile, 5K, 10K, Half Marathon, Marathon) renders an empty state, so no table has rows whose rank and date could be read back. The archive holds no best-effort entries for the current year. R21-VERDICT: BLOCKED — observed by developer, corroborated by agent (browser automation against the staged build). |
| R8. | The scope governs only the PR tables (D-03) | OVR-03 | With This year still selected, scroll through Superlatives, PR Evolution and Race Predictions. Required detail: whether each of those three changed when you toggled, named individually. Observer required: developer's own eyes. | With 'This year' active, each of the three sections was checked individually and none of them changed. Superlatives still reads 93.2 km Biggest Week, 369.4 km Biggest Month, 31 days Longest Streak, 0 days Current Streak. PR Evolution still shows historical progressions (5K 19:39 over 21 steps 2013-2022; 10K 39:44 over 16 steps 2016-2022; Half Marathon 1:26:51 over 6 steps 2017-2022). Race Predictions still shows all-time actuals (400m 0:45, 5K 19:39, 10K 39:44, Half Marathon 1:26:51). R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R9. | The scope does not persist (D-04) | OVR-03 | With This year selected, navigate to `#/list`, then back to `#/records`. Required detail: which scope is selected on arrival. Observer required: developer's own eyes. | Navigated from the records screen to the activities list and back; on re-arrival the scope control shows 'All time' selected, so the This year choice did not persist across navigation. R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R10. | The empty state names its own distance | OVR-03 | With This year selected, find a distance table showing an empty state (if none is empty this year, say so and the row is BLOCKED). Required detail: the empty state's heading text, quoted exactly. Observer required: developer's own eyes. | With 'This year' selected the 400m table renders an empty state whose heading reads exactly 'No 400m efforts in 2026', with body text 'The archive has no 400m effort recorded in 2026. Switch to All time to see every ranked effort.' Each of the other six tables names its own distance in the same way. R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R11. | This-year Headline Stats tiles (D-09, D-11) | OVR-04 | Back on `#/`, count the tiles in the Headline Stats card and read the last two. Toggle the theme. Required detail: the number of tiles, the last two tiles' labels and values, and whether both read correctly in both themes. Observer required: developer's own eyes. | Headline Stats renders 8 tiles. The last two read '775.1 km / Distance This Year' and '78 / Hours This Year', appended after the existing six with no reordering. Both read correctly in the light theme and in the dark theme. R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build). |
| R12. | Records Current Streak sub-label (D-13, D-14, D-16) | FIX-01 | On `#/records`, find the Current Streak tile in the Superlatives grid. The staged fixture has set the streak to ended. Required detail: the tile's big number and its sub-label, both quoted exactly as rendered. A sub-label reading `ended Aug 10, 2026` is the wrong date and must be recorded FAIL. Observer required: developer's own eyes. | The Current Streak tile in the Superlatives grid reads big number '0 days' with sub-label 'ended Aug 3, 2026' — the fixture's injected currentStreakEnd value, not the currentStreakStart discriminator that a wrong fix would have rendered. R21-VERDICT: PASS — observed by developer. |
| R13. | Overview Current Streak sub-label (D-15) | FIX-01 | On `#/`, find the Current Streak tile in Headline Stats. Toggle the theme. Required detail: the tile's big number and its sub-label, both quoted exactly as rendered, in both themes. `ended Aug 10, 2026` is the wrong date and must be recorded FAIL. Observer required: developer's own eyes. | The Current Streak tile in Headline Stats reads big number '0 days' with sub-label 'ended Aug 3, 2026', quoted identically in the light theme and in the dark theme. R21-VERDICT: PASS — observed by developer, corroborated by agent (browser automation against the staged build, after a hard reload cleared a stale cached streaks.json in the agent's tab). |

### Row-to-requirement map

- OVR-01 → R1, R4, R5
- OVR-02 → R2, R3
- OVR-03 → R6, R7, R8, R9, R10
- OVR-04 → R11
- FIX-01 → R12, R13

A requirement is ticked only when every row mapped to it is PASS.

## Checkpoint Outcome (Round 1)

12 PASS, 0 FAIL, 1 BLOCKED, 0 NOT EXERCISABLE.

- R7 (BLOCKED): the year-scope re-rank was never observed against real rendered rows, because
  every one of the seven distance tables renders an empty state under 'This year' — no table in
  the archive has current-year entries to read a rank and date back from.

## Evidence Quality (Round 1)

R1, R2 and R12 were observed by the developer's own eyes directly in their own browser. R3, R4,
R5, R6, R7, R8, R9, R10, R11 and R13 were observed by the developer from agent-driven browser
captures — the agent navigated, resized the viewport, clicked and pressed keys, and the developer
read the resulting screen and gave the verdict.

Both themes were genuinely named on R1, R6, R11 and R13, as required for a theme-sensitive row to
PASS.

Rows R12 and R13 rest on a deliberate STAGED-BUILD FIXTURE, not organic archive data. The edited
file is `dist/widgets/data/stats/streaks.json`. Three fields were changed: `withinCurrentStreak`
`true` → `false`, `currentStreak` `2` → `0`, and `currentStreakEnd` added as
`2026-08-03T00:00:00.000Z`. The discriminator `currentStreakStart` was deliberately left at its
real value, `2026-08-10T00:00:00.000Z` — a wrong fix would have rendered `ended Aug 10, 2026`
instead of the correct `ended Aug 3, 2026` that both rows report.

Three process deviations from the house rules are recorded honestly:

1. R4 was observed at a ~521px viewport, not the ~360px the row specifies, because Chrome's
   minimum window width blocked the narrower viewport; the developer accepted it on that basis.
   The row therefore does NOT establish badge-wrap behaviour at 360px, only at ~521px.
2. Rows R3–R11 were presented to the developer in grouped batches rather than strictly one at a
   time, contrary to the house rules, at the developer's explicit request to reduce session
   burden. Each row still received its own verdict, its own required detail and its own observer
   attribution — no blanket answer was accepted for multiple rows.
3. R12 and R13 were taken out of R1..R13 order (observed immediately after R2) at the developer's
   request, so the fixture-dependent rows were observed while the staged fixture was known-fresh.

During agent corroboration, the agent's own browser tab initially rendered a STALE cached
`streaks.json` — Current Streak showing '2 days' with no sub-label. A hard reload corrected it to
'0 days' / 'ended Aug 3, 2026', matching what the developer had already independently reported.
This is the D-16 `127.0.0.1` / cache trap manifesting in practice, and it is why the developer's
independent observation of R12/R13 is load-bearing rather than redundant with the agent's.

## Round 1 Gap-Closure Record

### R7 — BLOCKED, blocks OVR-03

Developer confirmation, verbatim: "confirmed, R7 blocked". R7 is mapped to OVR-03; because it is
not PASS, OVR-03 is not ticked in this round.

## Round 2

Round 2 exists because Round 1's R7 was recorded BLOCKED: with "This year" selected, every one of
the seven distance tables rendered an empty state, because the live archive holds zero best-effort
ranking entries dated 2026 in any distance. `filterRankingsToYear`
(`src/dashboard/views/records-logic.ts:176-191`) is pure, correctly wired at `records.ts:661`,
covered by 7 targeted unit tests, and independently confirmed correct by `21-REVIEW.md` — but this
project's house rule since checkpoint 16-09 is "Never cite an automated result as evidence for a
manual row", so a unit-test pass cannot discharge R7. Round 2 closes the gap the same way FIX-01's
identical problem closed in Round 1: a disclosed, discriminator-designed staged-build fixture, plus
a checkpoint that reads a VALUE back rather than confirming a presence.

Task 1's full gate ran green on a clean working tree: `npm test` 1122/1122 across 49 files, `npx tsc
--noEmit -p tsconfig.json` clean, `npm run build-widgets` exit 0 with zero `css-syntax-error`
occurrences in the captured log, `npm run verify-dashboard` 37/37 checks passed. The build is staged
under the production path shape and served from `127.0.0.1`, never `localhost` — served URL prefix
`http://127.0.0.1:8099/strava-widgets/`. The one route this session uses is
`http://127.0.0.1:8099/strava-widgets/#/records`. The bundle filename read from the staged
`index.html` is `assets/index-C0m8pdqN.js` (unchanged from Round 1 — no source file changed between
rounds).

**Fixture disclosure.** The archive cannot produce a current-year PR ranking row. Row R15 is
observed against a deliberate, disclosed edit to the STAGED build only —
`dist/widgets/data/stats/best-efforts.json`, never the repository copy at
`data/stats/best-efforts.json` (2.9 MB, gitignored pipeline output).

Exactly two fields change, both `startDate` values inside `rankings["400m"]`. No `rank`, no
`durationSec`, no `activityId`, no other distance, no other file:

| Array index | activityId | `rank` (unchanged) | `durationSec` | Repository `startDate` | Staged `startDate` |
|-------------|-----------|--------------------|---------------|------------------------|--------------------|
| 3 | `3475732221` | `4` | `54.6` | `2018-09-04T16:26:06Z` | `2026-03-14T09:12:00Z` |
| 8 | `14122328106` | `9` | `62.1` | `2025-04-09T00:02:51Z` | `2026-06-02T07:30:00Z` |

**The source ranks are left at 4 and 9 ON PURPOSE. They are the discriminator.** `rankings["400m"]`
is sorted ascending by `durationSec`, and `filterRankingsToYear` preserves that order, so the
filtered 2026 subset is `[54.6s, 62.1s]` and a correct 1..N re-rank renders:

| Under "This year", 400m | Rank cell | Time cell | Date cell |
|-------------------------|-----------|-----------|-----------|
| first row | `#1` | `0:55` | `Mar 14, 2026` |
| second row | `#2` | `1:02` | `Jun 2, 2026` |

An implementation that merely filtered and passed the SOURCE ranks through would render **`#4`** and
**`#9`** instead. R15 is therefore not answerable by "a row appeared" — `#4`/`#9` is a recordable
FAIL with the numbers quoted, exactly as `ended Aug 10, 2026` was for Round 1's R12/R13.

**Three honest limitations of this fixture, disclosed so nothing downstream over-reads it:**
1. `data/stats/age-grading.json` and the `activities` map inside `best-efforts.json` are NOT
   edited, so the 400m Age-Grade cell and the 400m PR-Evolution chart still reflect the real 2018
   and 2025 dates. Neither is part of R14's or R15's read-back.
2. Under the fixture the 400m table is no longer empty under "This year". Round 1's R10 used the
   400m empty state (`"No 400m efforts in 2026"`) as its example and PASSED against the
   un-fixtured build; that verdict stands on its own evidence and is NOT re-litigated here. The six
   other distances still render their empty states under the fixture.
3. `dist/widgets/*` is gitignored (`.gitignore:4`), so the fixture cannot be committed by accident —
   but Task 3 still restores the staged file explicitly, because "it can't be committed" is not the
   same as "it can't be mistaken for archive data by the next person who opens the staged build".

### Cache trap (Round 1's R13 incident)

Serving from `127.0.0.1` is NOT sufficient on its own: in Round 1 the observing tab rendered a
stale cached `streaks.json` and only corrected after a hard reload (Cmd+Shift+R). Round 2 therefore
makes the hard reload its own row (R14), which must be PASS before R15 may be judged.

The house rules established in Round 1 (16-09, 17-15, 19-05, 19-12, 19-17, 20-05, 20-11, 20-18,
20-20, 21-07) govern Round 2 unchanged — see the `<house_rules>` block above under Round 1. Not
repeated here to avoid a second copy of the document's evidence-vocabulary text.

| Row | Behavior | Requirement | Instructions | Observation |
|-----|----------|--------------|---------------|-------------|
| R14. | The fixture actually reached the tab (D-16, the Round 1 cache trap) | OVR-03 | On `http://127.0.0.1:8099/strava-widgets/#/records`, confirm the URL bar reads `127.0.0.1` and `/strava-widgets/`, then hard-reload the page (Cmd+Shift+R, or open DevTools with "Disable cache" ticked and reload). With **All time** selected, scroll to the 400m table and read the Date cells of the rows ranked `#4` and `#9`. Under the loaded fixture these read `Mar 14, 2026` and `Jun 2, 2026`. If either still reads `Sep 4, 2018` or `Apr 9, 2025`, the tab is serving a stale `best-efforts.json`; record FAIL and do not judge R15. Required detail: whether a hard reload was performed and by what method, and the Date cell text of the 400m All-time rows ranked `#4` and `#9`, quoted exactly. Observer required: developer's own eyes. | Hard reload performed via Command+Option+R (on mac) (Reload From Origin), on http://127.0.0.1:8099/strava-widgets/#/records with the URL bar confirmed to read 127.0.0.1 and /strava-widgets/. With All time selected, the developer read back the 400m table's rows ranked #4 and #9 as rendered: #4 / 0:55 / 2:17/km / 81.0% / Mar 14, 2026; #9 / 1:02 / 2:35/km / 74.1% / Jun 2, 2026. The developer explicitly identified this as "the first case" — the fixture dates, not the stale Sep/Apr archive dates. The fixture reached the tab. R21-VERDICT: PASS — observed by developer. |
| R15. | The year scope re-ranks — re-ask of Round 1's R7 (OVR-03, D-01, D-11) | OVR-03 | Only if R14 is PASS. Click **This year**. The 400m table now has rows. Read both of them. A correct 1..N re-rank over the filtered subset renders first row `#1` / `0:55` / `Mar 14, 2026` and second row `#2` / `1:02` / `Jun 2, 2026`. Ranks reading `#4` and `#9` mean the source ranks were passed straight through instead of being re-ranked within the scope — that is a FAIL, quoted. Required detail: the rank shown in the 400m table's first row and the date in that row, and the rank and date in its second row, all quoted exactly as rendered. Observer required: developer's own eyes. | With This year selected, the 400m table rendered exactly two rows, read back verbatim under the column header row Rank, Time, Pace, Age-Grade, Date, Flags: first row #1 / 0:55 / 2:17/km / 81.0% / Mar 14, 2026; second row #2 / 1:02 / 2:35/km / 74.1% / Jun 2, 2026. The discriminator held: the staged source ranks were left unchanged, and the rendered ranks re-rank to 1 and 2 over the filtered subset rather than passing source ranks through. This closes Round 1's R7 BLOCKED. R21-VERDICT: PASS — observed by developer. |

### Row-to-requirement map (Round 2)

OVR-03 → R6, R8, R9, R10 (Round 1, PASS) + R14, R15 (Round 2). R15 supersedes Round 1's R7, which
stays recorded BLOCKED and is not edited. OVR-03 ticks only when every one of those rows is PASS.

## Checkpoint Outcome (Round 2)

2 PASS, 0 FAIL, 0 BLOCKED, 0 NOT EXERCISABLE.

Both Round 2 rows passed. R14 confirmed the fixture actually reached the observing tab after a hard
reload, and R15 confirmed the 400m This-year table re-ranks the filtered subset to `#1`/`#2` rather
than passing the staged source ranks (`4`/`9`) straight through. With R6, R8, R9 and R10 already
PASS from Round 1, every row mapped to OVR-03 is now PASS, closing Round 1's R7 BLOCKED via
supersession rather than by editing R7's cell.

## Evidence Quality (Round 2)

Both R14 and R15 were observed by the developer's own eyes directly in their own browser; no agent
corroboration was used for either row this round.

R14 named the hard reload method explicitly: Command+Option+R (macOS "Reload From Origin"),
performed on `http://127.0.0.1:8099/strava-widgets/#/records` with the URL bar confirmed to read
`127.0.0.1` and `/strava-widgets/` before judging. This satisfies the Cache trap requirement that a
hard reload be its own row and be PASS before R15 is judged.

R15 rests on the same deliberate, disclosed STAGED-BUILD FIXTURE that R14 verified was live in the
tab, not on organic archive data. The edited file is
`dist/widgets/data/stats/best-efforts.json`. Exactly two `startDate` values inside
`rankings["400m"]` were changed: array index 3 (`activityId 3475732221`) from `2018-09-04T16:26:06Z`
to `2026-03-14T09:12:00Z`, and array index 8 (`activityId 14122328106`) from
`2025-04-09T00:02:51Z` to `2026-06-02T07:30:00Z`. Both entries' `rank` fields were deliberately
LEFT UNCHANGED at `4` and `9` — this untouched `rank: 4` / `rank: 9` pair is the discriminator: a
pass-through implementation would have rendered those source ranks, while the correct 1..N re-rank
that was actually observed rendered `#1` and `#2`.

Three honest limitations of this fixture, disclosed so nothing downstream over-reads it:

1. `data/stats/age-grading.json` and the `activities` map inside `best-efforts.json` were NOT
   edited, so the 400m Age-Grade cell and the 400m PR-Evolution chart still reflect the real 2018
   and 2025 dates. Neither was part of R14's or R15's read-back.
2. Under the fixture the 400m table is no longer empty under "This year". Round 1's R10 used the
   400m empty state (`"No 400m efforts in 2026"`) as its example and PASSED against the
   un-fixtured build; that verdict stands on its own evidence and was not re-litigated here. The
   six other distances still rendered their empty states under the fixture.
3. `dist/widgets/*` is gitignored (`.gitignore:4`), so the fixture could not be committed by
   accident — but Task 3 still restores the staged file explicitly from the repository copy,
   because "it can't be committed" is not the same as "it can't be mistaken for archive data by
   the next person who opens the staged build".
