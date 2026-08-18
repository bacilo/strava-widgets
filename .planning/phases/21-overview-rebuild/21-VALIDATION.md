---
phase: 21
slug: overview-rebuild
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-18
round: 1
round1_staged: 2026-08-18
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
| OVR-01 | Shared renderer emits correct name/date/distance/badge text content and correct `aria-label` string | unit (text/string assertion) | `npx vitest run src/dashboard/views/list.test.ts src/dashboard/views/overview.test.ts` | ✅ | ⬜ pending |
| OVR-01 | Two-line hierarchy renders; badges do not wrap into meta; degrades at narrow widths without a media query | manual-only | — | N/A | ⬜ pending |
| OVR-02 | Recent Activities and Recent PRs invoke the *same* renderer (source-identity), same linking semantics | unit | `npx vitest run src/dashboard/views/row-semantics.test.ts` | ✅ (extend) | ⬜ pending |
| OVR-02 | Rows visually match across both cards and the Activities mobile card | manual-only | — | N/A | ⬜ pending |
| OVR-03 | Year filter + re-rank produces correct `PrTableRow[]` (correct subset, correct 1..N ranks) | unit | `npx vitest run src/dashboard/views/records-logic.test.ts` | ✅ (new describe) | ⬜ pending |
| OVR-03 | `.segmented` scope control renders, toggles, and re-renders correct table data | manual-only | — | N/A | ⬜ pending |
| OVR-04 | This-year tile values computed/formatted correctly from `yearly-stats.json`; em-dash degradation when absent | unit | `npx vitest run src/dashboard/views/overview.test.ts` | ✅ (new describe) | ⬜ pending |
| OVR-04 | Two new tiles appear in `.stat-grid`, correctly positioned, both themes | manual-only | — | N/A | ⬜ pending |
| FIX-01 | `calculateDailyStreaks` returns correct `currentStreakEnd` in every scenario (active, ended, empty) | unit | `npx vitest run src/analytics/streak-utils.test.ts` | ✅ (new assertions) | ⬜ pending |
| FIX-01 | `selectCurrentStreak` reads `currentStreakEnd` (not `currentStreakStart`) for `endedISO`; degrades when absent | unit | `npx vitest run src/dashboard/views/records-logic.test.ts` | ✅ (new describe) | ⬜ pending |
| FIX-01 | `ended {date}` sub-label renders the **correct** date on Records and Overview against a genuinely-ended-streak fixture | manual-only (fixture-gated) | — | N/A | ⬜ pending |

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
| R1. | Overview Recent PRs — the two-line hierarchy (D-06) | OVR-01 | On `#/`, look at the Recent PRs card. Each row should be two lines: the activity name on the first line with its badges pushed to the right edge of the row, and a second line reading date · distance · duration · pace. It should not read as three stacked blocks. Toggle the theme and look again. Required detail: the first row's name, the badge text you see on it, and the full second line, in both themes. Observer required: developer's own eyes. | |
| R2. | Overview Recent Activities — the same structure (D-05) | OVR-02 | On the same page, scroll to Recent Activities. Compare a row here against a Recent PRs row directly above it. Required detail: whether the two rows have the same two-line shape and the same badge placement, stated as a comparison, plus any difference you can see. Observer required: developer's own eyes. | |
| R3. | Activities mobile card — the third surface (D-05) | OVR-02 | Narrow the window below 720px and open `#/list` so the mobile card layout renders instead of the table. Compare a card against the Overview rows from R1/R2. Required detail: whether the card has the same two-line shape as the Overview rows, and the name and second line of one card. Observer required: developer's own eyes. | |
| R4. | Narrow-width degradation (D-06) | OVR-01 | With the window at roughly 360px wide, look at a row that carries at least one badge on Overview or `#/list`. Required detail: whether any badge has wrapped down onto the metrics line, and what the row looks like at that width. Observer required: developer's own eyes. | |
| R5. | The row is still a link (Phase 20 non-regression) | OVR-01 | Back at full width on `#/`, Tab to a Recent PRs row and confirm it takes exactly one Tab stop and shows a focus ring, then press Enter. Required detail: the number of Tab presses to move past the row, whether the focus ring was visible, and the `#/activity/...` URL you landed on. Observer required: developer's own eyes. | |
| R6. | The Records scope control (D-01, D-02) | OVR-03 | Open `#/records` and scroll to the PR Tables section. A two-option control should sit between the section heading and the first distance table, reading All time and This year, with All time selected. Toggle the theme. Required detail: the two option labels as written, which one is selected on arrival, and whether the control is legible in both themes. Observer required: developer's own eyes. | |
| R7. | The year scope re-ranks (D-01) | OVR-03 | Click This year. Pick one distance table that still has rows and read its top row. Required detail: the distance you picked, the rank shown in its first row, and the date in that row. Observer required: developer's own eyes. | |
| R8. | The scope governs only the PR tables (D-03) | OVR-03 | With This year still selected, scroll through Superlatives, PR Evolution and Race Predictions. Required detail: whether each of those three changed when you toggled, named individually. Observer required: developer's own eyes. | |
| R9. | The scope does not persist (D-04) | OVR-03 | With This year selected, navigate to `#/list`, then back to `#/records`. Required detail: which scope is selected on arrival. Observer required: developer's own eyes. | |
| R10. | The empty state names its own distance | OVR-03 | With This year selected, find a distance table showing an empty state (if none is empty this year, say so and the row is BLOCKED). Required detail: the empty state's heading text, quoted exactly. Observer required: developer's own eyes. | |
| R11. | This-year Headline Stats tiles (D-09, D-11) | OVR-04 | Back on `#/`, count the tiles in the Headline Stats card and read the last two. Toggle the theme. Required detail: the number of tiles, the last two tiles' labels and values, and whether both read correctly in both themes. Observer required: developer's own eyes. | |
| R12. | Records Current Streak sub-label (D-13, D-14, D-16) | FIX-01 | On `#/records`, find the Current Streak tile in the Superlatives grid. The staged fixture has set the streak to ended. Required detail: the tile's big number and its sub-label, both quoted exactly as rendered. A sub-label reading `ended Aug 10, 2026` is the wrong date and must be recorded FAIL. Observer required: developer's own eyes. | |
| R13. | Overview Current Streak sub-label (D-15) | FIX-01 | On `#/`, find the Current Streak tile in Headline Stats. Toggle the theme. Required detail: the tile's big number and its sub-label, both quoted exactly as rendered, in both themes. `ended Aug 10, 2026` is the wrong date and must be recorded FAIL. Observer required: developer's own eyes. | |

### Row-to-requirement map

- OVR-01 → R1, R4, R5
- OVR-02 → R2, R3
- OVR-03 → R6, R7, R8, R9, R10
- OVR-04 → R11
- FIX-01 → R12, R13

A requirement is ticked only when every row mapped to it is PASS.
