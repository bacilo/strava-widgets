---
phase: 21
slug: overview-rebuild
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-18
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

**Browser-cache trap:** serve and load via `127.0.0.1`, not `localhost:8099` — staged checkpoints
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
