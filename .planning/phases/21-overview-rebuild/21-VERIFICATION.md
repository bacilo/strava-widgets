---
phase: 21-overview-rebuild
verified: 2026-08-18T10:08:21Z
status: gaps_found
score: 5/6 success criteria verified
overrides_applied: 0
gaps:
  - truth: "User can switch the records section between at least all-time and current-year views, styled with the Phase 19 control treatment (Success Criterion 3 / OVR-03)"
    status: partial
    reason: "The scope control itself is fully verified — it renders between the PR Tables heading and the first table, reads 'All time' / 'This year', defaults correctly, is legible in both themes, governs only the PR tables (Superlatives/evolution/predictions stay all-time), does not persist across navigation, and produces a correctly-worded per-distance empty state (R6, R8, R9, R10 all PASS in 21-VALIDATION.md). But the control's core function — actually re-ranking and displaying current-year rows — was never observed against real rendered output. With 'This year' selected, all seven distance tables render an empty state, because the live archive has zero best-effort ranking entries dated in the current year (2026) for any distance (confirmed directly against data/stats/best-efforts.json: most recent ranked years are 2025 for 400m only, 2022 for several others). R7, the row that would have read back a real rank and date, is recorded BLOCKED, not PASS. Per the phase's own gating rule, a requirement ticks only when every mapped row passes; OVR-03 is correctly left unticked in REQUIREMENTS.md."
    artifacts:
      - path: "src/dashboard/views/records-logic.ts"
        issue: "filterRankingsToYear (the year filter + re-rank) is well-covered by 7 targeted unit tests — subset filtering, 1..N re-rank (never source ranks), UTC year-boundary correctness (getUTCFullYear, not local getFullYear), purity (no mutation of input), empty-result handling, and unparseable-date tolerance — and was independently confirmed correct by 21-REVIEW.md's code review. This gives strong reason to believe the logic is right, but per this project's own house rules ('Never cite an automated result as evidence for a manual row' — in force since checkpoint 16-09) a unit-test pass cannot discharge the mandatory human-observable render that Success Criterion 3/6 requires."
    missing:
      - "A staged-build fixture (mirroring the D-16 precedent already used for FIX-01's streaks.json) injecting at least one 2026-dated entry into one distance's rankings in dist/widgets/data/stats/best-efforts.json (staged build only, never the repository copy), so 'This year' renders at least one real row whose rank and date can be read back and checked against expectation."
      - "A Round 2 checkpoint re-asking R7 against that fixture, with the same one-row-at-a-time, named-observer, value-not-presence discipline Round 1 used for R12/R13."
---

# Phase 21: Overview Rebuild Verification Report

**Phase Goal:** Overview — the weakest of the five screens — reaches the same standard as Activities and Records: structured, linked PR/activity rows, a records scope toggle, this-year figures in Headline Stats, and a Current Streak tile that renders its "ended" state.
**Verified:** 2026-08-18T10:08:21Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Independent Judgement Summary

This is an unusually well-executed phase: all 1122 tests pass (independently re-run, not just trusted from SUMMARY.md), `tsc --noEmit` is clean, no debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) exist in any of the six touched files, the Phase 20 row-click/link pattern is intact, and the Phase 19/Phase 20 frozen CSS values are unchanged. Four of five success criteria are fully discharged on both code evidence and a real human browser checkpoint. The fifth (Success Criterion 3, OVR-03) is genuinely NOT satisfied: the developer's own Round 1 checkpoint recorded R7 (the year-scope re-rank read-back) as BLOCKED, and I independently confirmed the root cause is real — the archive has no current-year PR ranking entries for any of the seven distances, so the "This year" scope has never rendered a populated table in front of a human. REQUIREMENTS.md already reflects this honestly (OVR-03 unticked). **ROADMAP.md line 71 does not** — it marks Phase 21 `[x] ... (completed 2026-08-18)`, which is not truthful while OVR-03 is open. See the recommendation below.

## Goal Achievement

### Observable Truths (mapped to ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------|------------|----------|
| 1 | Recent PRs rows: name, date, distance, PR badge, deliberate hierarchy, link to activity | ✓ VERIFIED | `renderActivityRow` (`list.ts:378-409`) builds a two-line `.activity-row__header`/`.activity-row__meta` DOM inside a real `<a href="activityDetailHref(row.id)">`; `row.name` via `textContent` only. Round 1 R1 PASS (two-line hierarchy, name 'Lunch Run', badge '3 PR', both themes), R5 PASS (single Tab stop, focus ring, correct `#/activity/...` navigation). |
| 2 | Recent Activities rows follow the same structure and linking as Recent PRs | ✓ VERIFIED | Both Overview cards delegate to the same `renderActivityRow` with distinct `RowSurface` values (`overview.ts`, confirmed by grep); `renderRecentPrRow`/`recentPrBadgeText`/`recentPrRowAriaLabel` retired. Round 1 R2 PASS (identical shape/badge placement vs. Recent PRs), R3 PASS (Activities mobile card at <720px shares the same two-line shape). |
| 3 | User can switch the records section between all-time and current-year views, styled with Phase 19 control treatment | ✗ FAILED | Control renders/toggles/scopes-correctly/doesn't-persist/empty-states-correctly (R6, R8, R9, R10 all PASS) — but the re-rank itself was never observed against real data: all 7 distance tables show empty states under "This year" (R7 BLOCKED). Confirmed independently: `data/stats/best-efforts.json` has zero 2026-dated entries in any distance's `rankings`. See Gap below. |
| 4 | Headline Stats shows distance-this-year and hours-this-year alongside all-time figures | ✓ VERIFIED | `selectThisYearStats`/`thisYearTileValues` (`overview.ts:68-101`) read real `yearly-stats.json` data matched by `periodLabel === String(currentUTCYear)`, degrading to em-dash only when absent — not a hardcoded value. Round 1 R11 PASS: 8 tiles total, real archive figures ("775.1 km / Distance This Year", "78 / Hours This Year"), both themes. |
| 5 | Current Streak tile's `ended {date}` sub-label renders when a streak has ended, verified against a genuinely-ended-streak fixture | ✓ VERIFIED | Two-layer fix confirmed in code: `streak-utils.ts` now emits `currentStreakEnd` unconditionally; `records-logic.ts` (`selectCurrentStreak`) and `overview.ts` (`currentStreakSublabel`) both read `currentStreakEnd`, not `currentStreakStart`. A discriminator test (both fields carrying different dates) proves the *value*, not just presence. Round 1 R12/R13 PASS against a disclosed staged-build fixture with `currentStreakStart` deliberately left at its real (wrong) value as the discriminator — both tiles correctly rendered `ended Aug 3, 2026`, not the wrong-fix value `ended Aug 10, 2026`. Criterion 5's own wording explicitly sanctions fixture-based verification ("verified against a fixture with a genuinely ended streak"), unlike Criterion 3. |
| 6 | Human checkpoint conducted: visual/interactive parity with Activities/Records, scope toggle exercised, ended-streak fixture confirmed | ⚠️ PARTIAL | The checkpoint itself was conducted correctly per house rules (13 individually-verdicted rows, named observers, both themes where required, fixture disclosed). But this criterion explicitly bundles "toggle the records scope" — which was only half-exercised (toggle mechanics yes, re-ranked output no, per Truth 3 above). |

**Score:** 5/6 (Truth 3 FAILED; Truth 6 is entangled with Truth 3's gap and cannot be called fully clean while Truth 3 is open).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/streak-utils.ts` | `currentStreakEnd` field, emitted unconditionally | ✓ VERIFIED | Present, matches `21-01-PLAN.md` must-have; wired into `streaks.json` write path. |
| `src/dashboard/views/list.ts` | Shared `renderActivityRow(row, surface)` with `RowSurface` scheme | ✓ VERIFIED | Present at `:378`; used by both Overview cards and the Activities mobile card; ids proven distinct by `rowIdPrefix`. |
| `src/dashboard/styles.css` | Phase 21 banner block, two-line row layout, D-08 values frozen | ✓ VERIFIED | Base `.activity-row` rule at line ~338 retains `background: var(--surface)`, `border-radius: 8px`, `padding: var(--space-md)`; Phase 21 block (`:1590+`) adds only `gap` — confirmed by direct read, matches code review finding #5. |
| `src/dashboard/views/overview.ts` | Both cards delegate to shared renderer; two new stat tiles; streak sub-label | ✓ VERIFIED | `renderActivityRow` called from both `buildRecentPrsCard`/`buildRecentActivitiesCard`; `buildStatCard(value, label, sublabel?)` gained third param; `thisYearTileValues` appended at grid end. |
| `src/dashboard/views/records-logic.ts` | `filterRankingsToYear` pure filter + re-rank | ✓ VERIFIED (exists, substantive, wired, unit-correct) — ⚠️ NOT observed rendering real data | Function exists, is pure, is correctly wired into `records.ts:661`'s `renderTables`, and is thoroughly unit-tested (7 cases including UTC boundary). Never observed producing a populated table in the browser — see Truth 3 gap. |
| `src/dashboard/views/records.ts` | `.segmented` scope control, `ended {date}` sub-label | ✓ VERIFIED | Control present above PR tables using the Phase 19 `.segmented` pattern; sub-label at Superlatives grid reads `currentStreakEnd` correctly. |
| `.planning/phases/21-overview-rebuild/21-VALIDATION.md` | 13-row checkpoint agenda, one verdict/detail/observer per row | ✓ VERIFIED | Present, matches the house-rule format; 12 PASS, 1 BLOCKED, 0 FAIL. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `overview.ts` cards | `list.ts renderActivityRow` | direct function call, distinct `RowSurface` | WIRED | Confirmed by grep; no duplicated element ids across the two simultaneously-rendered Overview cards. |
| `list.ts renderActivityRow` | `styles.css` Phase 21 block | class names `.activity-row__header`/`.activity-row__badges` | WIRED | Class names match between renderer and stylesheet block; `styles.test.ts` cascade-aware assertions pin this. |
| `records.ts renderTables` | `records-logic.ts filterRankingsToYear` | direct call, gated on `currentScope === 'this-year'` | WIRED (logic correct, never observed with real data) | Call site at `records.ts:661`; correct year resolved once via `getUTCFullYear()` (D-11 clock rule). Data-flow is real (`bestEfforts.rankings[distance]`, not a stub), but the archive has no rows for the branch to display — see gap. |
| `overview.ts mount()` | `yearly-stats.json` fetch | `fetchStatsJson`, individually try/catch-guarded | WIRED, FLOWING | Confirmed real data flow: Round 1 observed archive-derived values ("775.1 km"), not placeholders; missing-file path degrades to em-dash without breaking the rest of the card. |
| `streak-utils.ts currentStreakEnd` | `records-logic.ts selectCurrentStreak` / `overview.ts currentStreakSublabel` | direct field read, `typeof === 'string' && length > 0` guard | WIRED | Both readers independently implement the same guard; discriminator test proves the correct field is read, not `currentStreakStart`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| Headline Stats year tiles | `thisYear` / `yearValues` | `yearly-stats.json` via `fetchStatsJson`, matched by `periodLabel` | Yes — real archive totals observed in checkpoint (775.1 km / 78 hrs) | ✓ FLOWING |
| Records PR tables (all-time scope) | `allTimeEntries` | `bestEfforts.rankings[distance]` | Yes | ✓ FLOWING |
| Records PR tables (this-year scope) | `entries` (post-`filterRankingsToYear`) | Same source, filtered | Logic correct and wired, but the source data for 2026 is genuinely empty across every distance | ⚠️ NO CURRENT DATA TO FLOW (not a defect in the code; the archive itself has nothing for the branch to show) |
| Current Streak sub-label (both tiles) | `currentStreakEnd` | `streaks.json` (staged-fixture-augmented for the checkpoint; will be real once a streak genuinely ends) | Yes, correctly reads the real field once present | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| OVR-01 | 21-02, 21-03, 21-04, 21-07 | Recent PRs rows structured, linked | ✓ SATISFIED | R1, R4, R5 all PASS (21-VALIDATION.md); code confirms shared renderer, link, hierarchy. |
| OVR-02 | 21-02, 21-03, 21-04, 21-07 | Recent Activities rows same structure | ✓ SATISFIED | R2, R3 all PASS; source-identity confirmed (same renderer call). |
| OVR-03 | 21-05, 21-07 | Records scope toggle, all-time/current-year | ✗ NOT SATISFIED | R7 BLOCKED — see gap. Correctly unticked in REQUIREMENTS.md. |
| OVR-04 | 21-06, 21-07 | This-year figures in Headline Stats | ✓ SATISFIED | R11 PASS; real data-flow confirmed independently. |
| FIX-01 | 21-01, 21-06, 21-07 | Ended-streak sub-label, both tiles | ✓ SATISFIED | R12, R13 PASS against a disclosed, discriminator-proven staged fixture; two-layer bug fix confirmed in code (streak-utils.ts + records-logic.ts). |

No orphaned requirements — REQUIREMENTS.md's Phase 21 mapping (`OVR-01..04`, `FIX-01`) exactly matches the union of `requirements:` fields declared across all seven plans.

### Anti-Patterns Found

None. Scanned all six phase-touched files (`streak-utils.ts`, `list.ts`, `overview.ts`, `records.ts`, `records-logic.ts`, `styles.css`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and stub-shaped patterns (`return null`/`return {}`/empty-array-with-no-query/`() => {}` handlers) — zero matches. Two Info-level (non-blocking) findings carried from `21-REVIEW.md`:
- IN-01: `isRecord`/`hasOwn` tolerant-parse helpers duplicated verbatim between `overview.ts` and `records-logic.ts` — a documented, deliberate choice matching existing per-view-module convention.
- IN-02: `buildStatCard`'s `sublabel` parameter uses a truthy check rather than `typeof`/length check — safe for every current caller, optional hardening only.

### Regression Check (Phase 19 / Phase 20 guarantees)

| Guarantee | Source | Status | Evidence |
|-----------|--------|--------|----------|
| Row is a real `<a>` with curated `href`/`aria-label` (Phase 20 D-08/D-04) | 20-CONTEXT.md | ✓ INTACT | `renderActivityRow` still creates `document.createElement('a')`, sets `href = activityDetailHref(row.id)`, `aria-label` via `activityRowAriaLabel`. |
| `row.name` reaches DOM only via `textContent` (T-16-VW-01) | 16-UI-SPEC.md | ✓ INTACT | Confirmed at `list.ts:395`. |
| D-08 frozen bordered-card values (`background`, `border-radius: 8px`, `padding: var(--space-md)`, `.activity-list` gap) | 20-CONTEXT.md D-08 | ✓ INTACT | Base `.activity-row` rule unchanged; Phase 21 block adds only a new `gap` property not previously named — confirmed by direct grep, matches 21-REVIEW.md's independent finding. |
| No `prefers-color-scheme`, theming attribute-driven only | 16-UI-SPEC.md 16-D04 | ✓ INTACT | No new occurrences introduced (styles.test.ts asserts this and passes). |
| `.segmented` control pattern (Phase 19 D-01/D-02) | 19-CONTEXT.md | ✓ INTACT | OVR-03's control reuses the existing `role="group"` / `.segmented__option--active` pattern verbatim, no new control component. |

No regressions found in either prior phase's guarantees.

### Behavioral Spot-Checks

Skipped — no runnable server/headless browser in this repository (`vitest` runs in `environment: 'node'`, no jsdom); this is a documented, load-bearing constraint of the project (21-CONTEXT.md, 21-VALIDATION.md). `npm test` (1122/1122), `npx tsc --noEmit` (clean) were independently re-run as a floor, not a substitute.

### Probe Execution

No probes declared for this phase (no `scripts/*/tests/probe-*.sh` referenced by any plan or SUMMARY). Skipped.

### Human Verification Required

None additional beyond what Round 1 already produced. The remaining gap (Truth 3 / OVR-03) requires a **new staged fixture** (not yet built) before a Round 2 human checkpoint row can be meaningfully asked — so this is reported as a gap requiring a gap-closure plan, not an open human-verification item against the current build.

## Recommendation on ROADMAP.md line 71

**ROADMAP.md line 71 currently reads:** `- [x] **Phase 21: Overview Rebuild** - ... (completed 2026-08-18)`

This is **not truthful** as of this verification. OVR-03 is one of the phase's five declared requirements and one of its six success criteria; it is explicitly unticked in REQUIREMENTS.md ("Round 1 gap 2026-08-18 — still open") and its own row-to-requirement map shows R7 BLOCKED, not PASS. The checkbox was set automatically when 21-07's progress was recorded, before this verification ran, and does not reflect the requirement's actual state.

**Recommendation: revert ROADMAP.md line 71 to `[ ]`** and update its trailing summary to reflect the open OVR-03 gap (mirroring how Phase 19's and Phase 20's lines document their own open-round history), until a gap-closure round produces a real, human-observed re-rank of current-year data.

## Gaps Summary

Phase 21 is very close to done — four of five requirements and 12 of 13 checkpoint rows are cleanly verified on both code evidence and real browser observation, with no regressions to Phase 19/20 guarantees and no anti-patterns in any touched file. The single gap is narrow and well-understood: `filterRankingsToYear`'s logic is correct (confirmed by 7 targeted unit tests, independent code review, and direct reading of the call site), but the project's own house rules do not allow a unit test to stand in for the mandatory human-observable render, and the live archive has zero current-year PR ranking entries in any of the seven distances to render. This is a genuine dataset limitation, not a code defect — and it is closable the same way FIX-01's identical problem was closed: a disclosed staged-build fixture (one 2026-dated entry in one distance's `best-efforts.json` rankings, in `dist/` only) that lets a human read back at least one real re-ranked row, followed by a Round 2 checkpoint re-asking R7. Until that happens, OVR-03 is honestly NOT satisfied, and the phase goal — "reaches the same standard as Activities and Records" — is not yet fully true for the one criterion that most directly names Records.

---

_Verified: 2026-08-18T10:08:21Z_
_Verifier: Claude (gsd-verifier)_
