---
phase: 22-calendar-week-start-totals
verified: 2026-09-05T05:59:04Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/8
  previous_verified: 2026-08-19T09:30:00Z
  note: >-
    The 2026-08-19T09:30:00Z report is SUPERSEDED by this one. That report is
    what triggered Round 4 (plans 22-13..22-16). Round 4 then ran later the same
    day and was never re-verified, so the prior file described a pre-Round-4
    world for two and a half weeks. Every claim below was re-derived from the
    CURRENT source; no Round 4 SUMMARY claim was accepted at face value, and
    three of the closures were additionally falsified by deliberate source
    mutation (see Mutation Falsification).
  gaps_closed:
    - >-
      GAP 1 (SC3 / CAL-02, the 381px+ coverage band) — CLOSED ON GENUINE
      EVIDENCE. Direct read of src/dashboard/styles.css:904 confirms the
      calendar compaction block is now `@media (max-width: 640px)`, not
      `@media (max-width: 380px)`. The three rules the prior report named as
      unconditional at 381px+ are all overridden inside that block:
      `.calendar-day { min-width: 0 }` (styles.css:915), `.calendar-grid
      { grid-template-columns: repeat(7, minmax(0, 1fr)) minmax(0, max-content) }`
      (:911), `.calendar-week-total { min-width: 0; white-space: normal;
      overflow-wrap: anywhere }` (:934-937). 390/393/412px now sit INSIDE the
      relaxed band. Corroborated by R25 (fully observed, non-waivable, 393px,
      both matchMedia discriminators confirmed) and by a mutation check:
      reverting :904 to 380px turns styles.test.ts red (6 failures).
    - >-
      GAP 2 (CR-01, theme toggle stranded on light under blocked storage) —
      CLOSED ON GENUINE EVIDENCE. src/dashboard/nav-theme.ts holds the mode in
      a closure variable (`let currentMode`, :30) reassigned by `toggle()`
      (:41); nav.ts:193-198 seeds it ONCE from
      `readStoredMode(resolveStorage())` and nav.ts:217-219's
      handleThemeToggleClick calls only `themeController.toggle()` — no
      per-click storage read remains. Proven hermetically by
      nav-theme.test.ts (11 tests): GC-8d deletes globalThis.localStorage,
      asserts `'localStorage' in globalThis === false`, and asserts three
      toggles apply exactly ['light','dark','auto'], NOT ['light','light',
      'light']. Mutation check: removing the controller's memory turns 5 of
      those 11 red.
    - >-
      WR-01 (theme.ts's `storage: null` override silently upgraded to the real
      global) — CLOSED ON GENUINE EVIDENCE. storage.ts:61-62 now reads
      `if (override !== undefined) return override;` — presence, not
      truthiness. theme.ts:115 and :168 pass `options.storage` UNTOUCHED; the
      `?? undefined` coercion the prior report named is gone from both sites.
    - >-
      The vacuous-null-override TEST defect (prior truth 8) — CLOSED ON GENUINE
      EVIDENCE. theme.test.ts now installs a recording `sentinelStorage` as
      globalThis.localStorage before each null-override case (GC-9b, GC-9c) and
      carries a GC-9d CONTROL that omits `storage` entirely and asserts the
      sentinel IS written — so the null cases discriminate rather than pass
      vacuously. Mutation check: reverting storage.ts to `if (override)` turns
      3 tests red across theme.test.ts + storage.test.ts. vitest.config.ts is
      still `environment: 'node'` with no setupFile, but that no longer matters
      — these tests supply their own global.
  gaps_remaining: []
  regressions: []
  developer_authority_residue:
    - >-
      R26 (~600px sub-band of the widened compaction) is recorded PASS on the
      developer's explicit authority. The reading at ~600px was NEVER captured;
      the developer's "Compaction Intentional" judgement was given at 393px
      (R25's width). This shortfall is retained verbatim in 22-VALIDATION.md's
      R26 Observation cell and is NOT withdrawn here. It is not load-bearing
      for truth 3 — see "Developer-Authority Residue" below for why.
    - >-
      R27 (three theme-toggle clicks under real blocked site data) is recorded
      PASS on the developer's explicit authority. The three individual
      `aria-label` values in click order, the specific browser/setting, and the
      per-click colour-change statement were NEVER supplied; only "Theme dark
      is reached". Retained verbatim in 22-VALIDATION.md's R27 Observation cell
      and NOT withdrawn here. It is not load-bearing for truth 7 — see below.
warnings:
  - >-
    REQUIREMENTS.md is internally inconsistent about Phase 22. Lines 33-34
    record CAL-01 and CAL-02 as "Re-ticked 2026-08-19 (Round 4 final
    disposition, plan 22-16)" with `- [x]` checkboxes, but the phase map rows at
    lines 88-89 still read "Pending". The map rows are stale relative to the
    re-tick narrative in the same file. Documentation defect only — no code
    impact — but it should be reconciled before milestone audit.
---

# Phase 22: Calendar Week-Start & Totals — Verification Report

**Phase Goal:** User can choose whether the training-log week starts Sunday or Monday; the choice persists and correctly drives which days each week-total sums, on calendar controls styled to match the rest of the dashboard.
**Verified:** 2026-09-05T05:59:04Z
**Status:** passed
**Re-verification:** Yes — supersedes the report dated 2026-08-19T09:30:00Z (`gaps_found`, 5/8), which described the phase as it stood BEFORE Round 4 (plans 22-13..22-16) ran.

## Why this re-verification exists

The prior report is the document that OPENED Round 4. Round 4 executed later the same day, recorded both gaps closed, and verification was never re-run. The stale file therefore held open two gaps that the current source demonstrably closes. This report re-derives all eight must-haves from the CURRENT source, ignores Round 4's SUMMARY narrative entirely, and additionally attacks three of the four closures with deliberate source mutations to prove the guarding tests are not vacuous.

Two Round 4 checkpoint rows (R26, R27) were recorded PASS on the developer's explicit authority with named evidentiary shortfalls. Those shortfalls are restated here verbatim and are **not laundered into observed evidence**. They are also not load-bearing: every truth below is closed on source, unit-test, mutation, or fully-observed-checkpoint evidence that stands independently of those two rows. That distinction is spelled out in "Developer-Authority Residue".

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — User can switch the calendar's week start between Sunday and Monday via a control, and the choice persists across reloads | VERIFIED | Source unchanged in substance by Round 4: `calendar.ts:443` `let weekStart = readStoredWeekStart(storage)`; `setWeekStart` (:551-570) writes via `writeWeekStart(storage, next)` (:561) then rebuilds `buildMonthGrid(...)` (:569); both segmented options are wired (:573-574). `calendar-preferences.ts:69-70` delegates the handle to `storage.ts`'s `resolveStorage`. 31 unit tests in `calendar-preferences.test.ts` pass. Checkpoint: R7 (Round 1, fully observed — Sunday selection survived a real hard reload); R28(ii) (Round 4, fully observed — weekday headings read back `Mon Tue Wed Thu Fri Sat Sun` on the Round 4 build). R28(i)/(iii) are thin/developer-waived (R28 is a waivable row); the tick does not rest on them. |
| 2 | SC2 — `buildMonthGrid`'s hard-coded Sunday-first math is generalized to a required `weekStart` parameter and covered by unit tests for both week-start values | VERIFIED | `calendar-logic.ts:214-217` — `buildMonthGrid(rows, month, weekStart: WeekStart)`, parameter required. `WEEK_START_OFFSET` is a total `Record<WeekStart, number>` (:106) consumed by `weekStartOffset` (:182) and `leadingPaddingFor` (:191-192). `calendar-logic.test.ts` 58/58 pass. `npx tsc --noEmit` exit 0. |
| 3 | SC3 / CAL-02 — Each week row shows a computed total, correct for the selected week start, legible with no overflow at every viewport the app is expected to render at | VERIFIED (with a named, non-load-bearing residue at ~600px) | **The prior report's structural premise is now false.** `styles.css:904` is `@media (max-width: 640px)`, not 380px. Inside it: `.calendar-day { min-width: 0 }` (:915) and a single-column stack (:916-921), `.calendar-grid { repeat(7, minmax(0, 1fr)) minmax(0, max-content) }` (:911), `.calendar-week-total { min-width: 0; white-space: normal; overflow-wrap: anywhere }` (:934-937), plus 14px/12px type steps. Every one of the three "unconditional at 381px+" rules the prior report named is overridden across the whole 0-640px band, so 390/393/412px are covered. Above 640px the default eight-track shape returns, whose content-derived floor is ~530px (styles.css:855-861 arithmetic) — i.e. ~110px of headroom at 640px, and that band is what every desktop-width row (R20, R28(ii)) has repeatedly observed clean. Checkpoint: **R25 is fully observed and non-waivable** — a stated 393px via Chrome DevTools emulation with BOTH discriminators confirmed (`matchMedia('(max-width: 640px)').matches === true` AND `matchMedia('(max-width: 380px)').matches === false`, the second proving it is not a repeat of R19's 375px), the full rendered table quoted (31 day cells, 5 week-total cells), explicit "Overflow: no. Light and dark". Guarded by 152 passing assertions in `styles.test.ts`, including an inverted-on-purpose case asserting the `.calendar-grid` track list IS overridden at ≤640px. Mutation check: reverting :904 to 380px turns 6 of those red. |
| 4 | SC4 / CAL-03 — The week-start control and other Calendar inputs use Phase 19's shared styling | VERIFIED | Unchanged since Round 2; R9/R10 (Round 1, fully observed, both themes, focus ring and WCAG AA contrast), R17 (Round 2 confirm-unregressed), R21 (Round 3 confirm-unregressed). No Round 4 change touched the control styling. WR-05's 8px header/value cosmetic offset remains open and non-blocking, unchanged. |
| 5 | SC5 — The mandatory human browser checkpoint confirms the grid re-flows and week totals recompute correctly | VERIFIED | 28 rows across four rounds with per-row quoted evidence. SC5's own literal content was discharged in Round 1 (R2-R8, boundary-straddling weeks under both week starts) and regression-confirmed in Round 3 (R20) and Round 4 (R28(ii), an exact five-triple match to the preamble Monday-start table on a build proven fresh by R24's dual asset-filename discriminator `index-BWkFUnJ1.js` / `index-BnKFUiAg.css`, none of the three prior rounds' builds). **The two structural holes the prior report named are both now addressed**: no row above 380px (closed by R24/R25) and no toggle click under blocked storage (attempted by R27). Round 4's house rule 14 machinery held — R26 and R27 were recorded BLOCKED by the executor against orchestrator pressure before the developer's final explicit disposition, and the shortfalls survive verbatim in the file. That is the checkpoint behaving correctly, not failing. |
| 6 | T-22-WK-02 — a throwing/inaccessible `localStorage` GETTER does not crash the Calendar mount | VERIFIED | `storage.ts:61-67` wraps the property access in try/catch and returns `null` from the catch; `calendar-preferences.ts:69-70` delegates to it. `storage.test.ts` 12/12 pass, including throwing-getter sentinel installs. R15 (Round 2, live throwing getter) and R22 (Round 3, Safari "Block all cookies", full reload — nav rendered, grid rendered, Monday default, no console errors) both fully observed. |
| 7 | BL-03 / GC-5 / CR-01 — the app-level blocked-site-data threat is closed end to end AND this phase's own fix introduced no newly-reachable Critical | VERIFIED (with a named, non-load-bearing residue on R27's detail) | The module-scope half was already closed (`main.ts:19` `applyThemeMode(readStoredMode(resolveStorage()))`, R22 PASS). **The regression half — CR-01 — is now genuinely fixed in source.** `nav-theme.ts` is a real in-memory controller: `let currentMode = deps.initialMode` (:30), `toggle()` reassigns `currentMode = cycleThemeMode(currentMode)` (:41) and never touches storage. `nav.ts:193-198` seeds it exactly once; `nav.ts:217-219` handleThemeToggleClick calls only `themeController.toggle()`. The system-theme watcher no longer re-derives auto-ness from storage either — `watchSystemTheme(..., { isAuto: () => themeController.isAuto() })` (nav.ts:222-227) against theme.ts's new `isAuto` seam (:169-175), which is the second half of the same defect. `nav-theme.test.ts` proves the behaviour hermetically with NO storage handle at all and again under a THROWING globalThis.localStorage sentinel, plus five source guards on nav.ts forbidding reintroduction of a per-click read. |
| 8 | `theme.ts`'s `storage: null` opt-out is genuinely honoured, and its tests are real proofs of that path rather than vacuous passes of the absent-global path | VERIFIED | `storage.ts:61` discriminates on presence (`override !== undefined`), not truthiness; the WR-01 rationale is documented at :54-59. `theme.ts:115` and `:168` pass `options.storage` untouched — the `?? undefined` coercion is gone from both. `theme.test.ts` installs a recording sentinel as the real global for GC-9b/GC-9c and carries a GC-9d CONTROL (same sentinel, `storage` omitted) asserting the write DOES happen — so the null cases discriminate. Mutation-falsified below. |

**Score:** 8/8 truths verified

### Mutation Falsification

Every closure that rests on a passing test was attacked by deliberately reintroducing the defect the test claims to guard, then restoring the file. A test that stays green under its own defect is worthless; all three went red.

| Mutation applied | File | Suite run | Result |
|---|---|---|---|
| `if (override !== undefined) return override;` → `if (override) return override;` (reintroduces WR-01's truthiness check) | `src/dashboard/storage.ts:62` | `theme.test.ts` + `storage.test.ts` | **3 failed / 44 passed** — guard is real |
| `currentMode = cycleThemeMode(currentMode)` → `cycleThemeMode(deps.initialMode)` (removes the controller's memory, reintroducing CR-01's constant-cycle shape) | `src/dashboard/nav-theme.ts:41` | `nav-theme.test.ts` | **5 failed / 6 passed** — guard is real |
| `@media (max-width: 640px)` → `@media (max-width: 380px)` (reverts the compaction breakpoint to the Round 3 value the prior report failed) | `src/dashboard/styles.css:904` | `styles.test.ts` | **6 failed / 146 passed** — guard is real |

Working tree confirmed clean (`git status --porcelain` empty) after all three restores.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/styles.css` | Calendar compaction covering the real phone-width band, not gated at 380px | VERIFIED | `:904` is `@media (max-width: 640px)`. The `.calendar-` compaction block is the only 640px block that mentions a calendar selector (the other, `:465`, is the nav collapse). Exactly two `@media (max-width: 380px)` blocks remain and neither is calendar-related (`.chart-band__canvas-wrap`, `.pr-evolution-card__canvas-wrap`) — asserted structurally by `styles.test.ts`'s IN-06/GC-7 case, which brace-walks each block body and rejects any `.calendar-` inside. |
| `src/dashboard/nav-theme.ts` | In-memory theme-mode controller (CR-01 fix) | VERIFIED | 53 lines, real closure state, `mode()`/`isAuto()`/`toggle()`/`syncSystemTheme()`. Not a stub; no storage access at all (by design — seeding is the caller's job, enforced by GC-8i). |
| `src/dashboard/nav.ts` | Controller wired; no per-click storage read | VERIFIED | Seeded once at `:194`; `handleThemeToggleClick` (:217-219) is a one-line delegation; `readStoredMode(` appears exactly once in comment-stripped source and `cycleThemeMode` zero times, both asserted by GC-8j. |
| `src/dashboard/theme.ts` | Explicit `storage: null` honoured; `isAuto` seam for the in-memory caller | VERIFIED | `:115`, `:168` pass `options.storage` untouched. `isAuto` seam at `:169-175` with the omit-preserves-old-behaviour contract documented at `:150-156`. |
| `src/dashboard/storage.ts` | Presence-discriminating three-way resolver, sole storage-global dereference site | VERIFIED | `:61-67`. 68 lines, narrow, no `getItem`/`setItem`/key logic — D-06 fence intact. |
| `src/dashboard/views/calendar-logic.ts` | Required `weekStart`, total offset lookup, week totals | VERIFIED | Unchanged; reconfirmed by source read. |
| `src/dashboard/views/calendar-preferences.ts` | Delegates handle to shared resolver | VERIFIED | One-line delegation at `:69-70`. |
| `src/dashboard/main.ts` | Module-scope theme read guarded | VERIFIED | Guarded via `resolveStorage()`; rationale comment retained. |
| `src/dashboard/nav-theme.test.ts` | Proves three clicks reach dark and auto with no storage handle | VERIFIED | 11 tests. GC-8d is hermetic (deletes the global, asserts absence, asserts `['light','dark','auto']` and explicitly `not.toEqual(['light','light','light'])`). GC-8i repeats it under a THROWING global. Five source guards on nav.ts. Mutation-falsified above. |
| `src/dashboard/theme.test.ts` | Non-vacuous `storage: null` cases | VERIFIED | Sentinel install + GC-9d discriminating control. Mutation-falsified above. |
| `22-VALIDATION.md` | Four rounds, append-only, shortfalls retained | VERIFIED | 28 rows. R26/R27's evidentiary shortfalls are retained verbatim in their Observation cells alongside the developer-authority PASS verdicts — the file does not pretend the readings were taken. |
| `.planning/REQUIREMENTS.md` | CAL-01/02/03 ticks matching the row map | PARTIAL (documentation only) | Lines 33-34 record the Round 4 re-tick honestly, including the named shortfalls. Lines 88-89's map rows still read "Pending" and were not updated with the re-tick. See `warnings` in frontmatter. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| a click on the header theme toggle, under a null/unusable storage handle | a mode change reaching dark and auto | `nav-theme.ts`'s in-memory `currentMode` | **WIRED** (was NOT_WIRED) | `nav.ts:194` seeds → `:218` toggles → `nav-theme.ts:41` reassigns → `deps.apply`/`deps.render`. Proven with the global deleted and with it throwing. |
| a system colour-scheme change, under a null handle, while the user picked an explicit mode | suppressed (not overridden) | `watchSystemTheme({ isAuto })` | **WIRED** | `nav.ts:226` supplies `isAuto`; `theme.ts:172` prefers it over `readStoredMode(storage) === 'auto'`. This closes the second half of CR-01 the prior report did not separately name. |
| `theme.ts`'s `ApplyThemeOptions.storage: null` | an honoured "do not persist" instruction | `resolveStorage(options.storage)` | **WIRED** (was NOT_WIRED) | Presence check at `storage.ts:62`; no coercion at either call site. |
| `.calendar-day` (7 tracks) + `.calendar-week-total` (8th track) | a squeezed, non-overflowing grid at 390/393/412px | ≤640px relaxation rules | **WIRED** (was PARTIAL — ≤380px only) | `minmax(0, ...)` tracks + `min-width: 0` + `white-space: normal` + `overflow-wrap: anywhere` now govern the whole 0-640px band. |
| a click on either segmented Sunday/Monday option | repainted `.calendar-grid` | `setWeekStart` → `writeWeekStart` + `buildMonthGrid` + `renderGrid` | WIRED | Unchanged; `calendar.ts:551-574`. |
| `main.ts`'s module-scope theme read | app bootstrap survives blocked storage | `resolveStorage()` | WIRED | Unchanged; R22 PASS. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `calendar.ts`'s week-total cells | `grid.weekTotals[i]` | `buildMonthGrid` → `weekTotals` over in-month cells | Yes — R28(ii) read back all five Monday-start triples (59.1 km/5h 42m/×5, 80.0 km/7h 53m/×6, 80.0 km/7h 58m/×5, 80.0 km/7h 42m/×6, 58.1 km/5h 32m/×5), an exact match to the independently-derived preamble table, on the Round 4 build | FLOWING |
| `nav.ts`'s theme toggle state | `themeController.mode()` | in-memory closure, seeded once from storage | Yes — the click handler now has memory; the derivation is a state machine, not the constant `'auto' → 'light'` it was | FLOWING (was HOLLOW) |
| `calendar.ts`'s grid shape | `weekStart` | `readStoredWeekStart(storage)`, reassigned by `setWeekStart` | Yes — R28(ii) headings, R7 persistence | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-check clean | `npx tsc --noEmit` | exit 0, no output | PASS |
| Compile build | `npm run build` (tsc) | exit 0 | PASS |
| Full artefact build incl. dashboard SPA | `npm run build-widgets` | exit 0 — widgets, standalone pages, dashboard SPA built; private-artifact scan clean (5639 files); curation-artifact scan clean | PASS |
| Full test suite | `npx vitest run` | exit 0 — **63 files, 1617/1617 tests passed**, 8.30s | PASS |
| Phase-22 test surface | `npx vitest run` on `nav-theme` + `theme` + `storage` + `styles` + `calendar-logic` + `calendar-preferences` | exit 0 — **6 files, 299/299 passed** (styles 152, calendar-logic 58, calendar-preferences 31, theme 35, storage 12, nav-theme 11) | PASS |
| Compaction breakpoint is genuinely 640px | direct read `styles.css:904` + brace-walked block body | `@media (max-width: 640px)`; block contains `.calendar-day { min-width: 0 }`, `repeat(7, minmax(0,1fr)) minmax(0,max-content)`, `white-space: normal`, `overflow-wrap: anywhere` | CONFIRMS CLOSURE |
| No calendar rule survives in a 380px block | `grep -c '@media (max-width: 380px)'` + body inspection | exactly 2 blocks, both canvas-wrap, neither `.calendar-` | CONFIRMS CLOSURE |
| `storage: null` reaches the null path | direct read `storage.ts:62`, `theme.ts:115`, `theme.ts:168` | `override !== undefined`; no `?? undefined` at either call site | CONFIRMS CLOSURE |
| Theme toggle holds in-memory state | direct read `nav-theme.ts:30/41`, `nav.ts:194/217-219` | closure variable, seeded once, reassigned per toggle | CONFIRMS CLOSURE |
| vitest environment still `node` with no setupFile | direct read `vitest.config.ts` | `environment: 'node'`, `globals: true`, `fileParallelism: false`, no `setupFiles` key | CONFIRMED — but no longer a vacuity risk; the null-override tests now install their own sentinel global and are mutation-proven discriminating |
| No debt markers in phase-touched files | `grep -nE 'TBD\|FIXME\|XXX\|HACK\|PLACEHOLDER\|TODO'` across styles.css, nav.ts, nav-theme.ts, theme.ts, storage.ts, main.ts, calendar.ts, calendar-logic.ts, calendar-preferences.ts | no matches | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | `find scripts -path '*/tests/probe-*.sh'` | no matches; no PLAN or SUMMARY in this phase declares a probe path | SKIPPED (no probes defined for this phase) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| CAL-01 | 22-01..22-05, 22-07, 22-08, 22-10..22-14, 22-16 | User can choose Sunday/Monday week start; the choice persists | SATISFIED | Truths 1, 6, 7. Week-start read/write path unchanged in substance since Round 1's fully-observed R7; regression-checked by R20 and R28(ii); the CR-01 regression that reverted the Round 3 tick is now fixed in source and mutation-proven in tests. REQUIREMENTS.md's re-tick at line 33 is supportable. |
| CAL-02 | 22-01, 22-02, 22-03, 22-05, 22-06, 22-08, 22-09, 22-12, 22-15, 22-16 | Week totals computed and shown, respecting selected week start, legible at every viewport | SATISFIED | Truth 3. The reason this was BLOCKED in the prior report — the 380px gate — no longer exists in source. R25 is the first fully-observed, doubly-discriminated reading in the previously-untested band. |
| CAL-03 | 22-02, 22-04, 22-05, 22-06 | Calendar controls use shared Phase 19 styling | SATISFIED | Truth 4. Unchanged. |

No orphaned requirements: REQUIREMENTS.md's Phase 22 map lists exactly CAL-01/02/03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 88-89 | Stale status text — map rows read "Pending" while the same file's requirement lines 33-34 read "Re-ticked 2026-08-19" | Info (documentation) | Two parts of one file contradict each other about CAL-01/CAL-02. No code impact. Reconcile before milestone audit. |

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) exist in any phase-touched source file. No empty-return or hardcoded-empty-data stubs found in the changed modules.

## Developer-Authority Residue

Two Round 4 checkpoint rows carry a PASS verdict that rests on the developer's explicit authority rather than on the evidence the row itself specified. Both are restated here rather than absorbed, and neither is load-bearing for any truth marked VERIFIED above.

**R26 — the ~600px sub-band.** Never rendered and read at its own required width. The developer's "Compaction Intentional" judgement was given at 393px. What this row was created to probe is a NEW question the widened breakpoint introduced (does the single-column stack look intentional at large-phone/small-tablet width), not the CAL-02 overflow defect. Truth 3 does not depend on it: at ~600px the SAME declarations R25 observed working at 393px apply, with strictly MORE width per track (~55px vs ~31px per day track by the styles.css:855-861 arithmetic) and identical 14px/12px type steps — more space with the same rules cannot introduce overflow or reduce legibility. Overflow is additionally impossible by construction there (`minmax(0, ...)` tracks with `min-width: 0` and `overflow-wrap: anywhere` have no content floor to overflow against). The residual, genuinely unobserved risk is **aesthetic only** — that a stacked day cell at tablet width looks sparse — which is not what CAL-02 or SC3 assert.

**R27 — three theme-toggle clicks under real blocked site data.** The three `aria-label` values in click order, the browser/setting, and the per-click colour statement were never supplied; only "Theme dark is reached". Truth 7 does not depend on the missing detail, for two independent reasons. First, the row's own FAIL disposition (b) is "`Theme: light` after every click and dark is never reached" — the developer's statement, thin as it is, directly falsifies exactly that predicted defect shape in a real browser under the real configuration. Second, the behaviour is independently proven at unit level in a way the prior report could not have credited, because the code did not exist then: `nav-theme.test.ts` GC-8d deletes `globalThis.localStorage`, asserts its absence, and asserts three toggles apply `['light','dark','auto']`; GC-8i repeats it with a THROWING global installed; and removing the controller's memory turns 5 of those 11 tests red. The unobserved residue is the narrow possibility that the label jumped to dark on click 1 and stayed — a failure mode nothing predicts and the unit tests contradict.

**Why this report is `passed` and not `human_needed`.** Both items were formally dispositioned: the executor recorded them BLOCKED under house rule 14 against orchestrator pressure, and the developer was asked twice and explicitly declined further verification. Routing them back as open human-verification items would reopen a decision the developer has already made, on questions that are not load-bearing for any truth. If you would prefer the residue recorded formally rather than narratively, paste this into the frontmatter and re-run verification:

```yaml
overrides:
  - must_have: "R26 — a rendered reading of the calendar at a stated ~600px width"
    reason: "Aesthetic-only residue of the widened compaction; overflow is impossible by construction at that width and legibility follows a fortiori from R25's observed 393px reading with the same rules and more space per track"
    accepted_by: "pedf"
    accepted_at: "2026-08-19T13:00:00Z"
  - must_have: "R27 — three aria-label values in click order, browser/setting named, per-click colour statement"
    reason: "Developer confirmed 'Theme dark is reached' under blocked storage, which falsifies the row's own FAIL disposition (b); mutation-proven unit coverage in nav-theme.test.ts establishes the cycle hermetically with no storage handle"
    accepted_by: "pedf"
    accepted_at: "2026-08-19T13:00:00Z"
```

## Gaps Summary

None. Both gaps the 2026-08-19T09:30:00Z report held open are closed in the current source, and each closure was verified by direct source read rather than by SUMMARY narrative, then attacked by mutation:

- **GAP 1's structural premise no longer exists.** The prior report's entire argument was that the overflow fix lived inside `@media (max-width: 380px)` while the defect-causing rules were unconditional above it. `styles.css:904` is now 640px and all three of those rules are overridden across the whole band. The 390/393/412px widths it named as untested are now both covered in CSS and observed in the browser (R25, with the `matchMedia('(max-width: 380px)').matches === false` discriminator that proves it is not a rerun of R19's 375px).
- **GAP 2's defect no longer exists.** `handleThemeToggleClick` no longer reads storage; a real in-memory controller owns the mode, the system-theme watcher was given an `isAuto` seam so it cannot override an in-session choice either, and both halves are guarded by tests that go red when the defect is reintroduced.
- **WR-01, the vacuous-null-override test defect the prior report flagged as truth 8, is also genuinely closed** — not by changing the vitest environment (still `node`, still no setupFile) but by making the tests supply their own sentinel global and carrying a discriminating control case. That is the stronger fix.

The one open item is a documentation inconsistency inside REQUIREMENTS.md (map rows 88-89 vs requirement lines 33-34), recorded as a warning rather than a gap because it has no code impact.

---

_Verified: 2026-09-05T05:59:04Z_
_Verifier: Claude (gsd-verifier) — supersedes 2026-08-19T09:30:00Z_
