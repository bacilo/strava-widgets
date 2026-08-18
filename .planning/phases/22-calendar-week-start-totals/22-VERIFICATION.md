---
phase: 22-calendar-week-start-totals
verified: 2026-08-18T16:10:00Z
status: gaps_found
score: 4/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Each week row shows a computed total, correct for the selected week start, at every viewport width the app is expected to render at"
    status: failed
    reason: "Round 1 checkpoint row R11 (CAL-02, D-10) was recorded FAIL by the developer: at ~380px viewport width the day-cell values slightly overflow their cells. The developer was explicitly offered a documented-PASS framing and chose FAIL instead. The documented fallback (a `.splits-scroll`-style horizontal-scroll wrapper, DISC-6b) was deliberately not implemented this session. REQUIREMENTS.md itself keeps CAL-02 unticked / Pending for exactly this reason."
    artifacts:
      - path: "src/dashboard/styles.css"
        issue: "The 380px compaction block (lines ~849-863) only shrinks `.calendar-week-total__distance`; `.calendar-day__distance` (20px) and the week-total's `__time`/`__count` lines are untouched, and the grid has no `min-width: 0` guard on the seven day columns (code review IN-05) — matching the observed overflow"
    missing:
      - "A fix for the ~380px day-cell overflow — either the documented DISC-6b horizontal-scroll fallback, or a deeper compaction of `.calendar-day` typography at that breakpoint — followed by a re-run of R11 with rendered evidence"
  - truth: "A throwing/inaccessible localStorage does not crash the Calendar mount (Plan 22-02 must-have truth, T-22-WK-02: 'a throwing getItem ... returns the default instead of crashing the calendar mount ... a throwing setItem ... is swallowed')"
    status: failed
    reason: "Confirmed independently by execution: `calendar.ts:424` reads `const storage = deps.storage ?? globalThis.localStorage;` outside any try/catch. In a browser configuration where site data is blocked (Firefox 'Block cookies and site data', Chrome blocked-origin storage, a storage-partitioned iframe), the `localStorage` GETTER itself throws `SecurityError` before `readStoredWeekStart`'s try/catch is ever entered. `readStoredWeekStart`/`writeWeekStart` only wrap `storage.getItem`/`storage.setItem` (verified at calendar-preferences.ts:46-52, 60-67), not the property access that resolves `storage` in the first place. `mount()` runs inside a try/catch in `main.ts:53-77` whose catch renders a generic 'Something went wrong' panel — so this SecurityError takes down the entire Calendar view, not just the week-start preference. Documented as CR-01 (Critical) in 22-REVIEW.md and not fixed in this phase; not exercised by any of the eleven checkpoint rows (R8 tampers the VALUE, not the storage handle's accessibility)."
    artifacts:
      - path: "src/dashboard/views/calendar.ts"
        issue: "Line 424: `globalThis.localStorage` dereferenced with no try/catch around the property access itself"
      - path: "src/dashboard/views/calendar-preferences.ts"
        issue: "Header comment (T-22-WK-02) claims disabled-cookies coverage that the module's functions cannot provide, because the throwing operation happens at the call site before either function is invoked"
    missing:
      - "A guarded storage resolver (e.g. `resolveWeekStartStorage()` wrapping the `globalThis.localStorage` property access in try/catch, per 22-REVIEW.md CR-01's suggested fix) plus a regression test with a getter-throwing storage stand-in"
human_verification: []
---

# Phase 22: Calendar Week-Start & Totals — Verification Report

**Phase Goal:** User can choose whether the training-log week starts Sunday or Monday; the choice persists and correctly drives which days each week-total sums, on calendar controls styled to match the rest of the dashboard.
**Verified:** 2026-08-18T16:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

**Note on ROADMAP.md:** line 72 already marks Phase 22 `[x]` completed (written by plan-progress tracking before this verification ran). That mark is not accurate: the phase's own `REQUIREMENTS.md` keeps CAL-02 `Pending`, and this verification independently confirms a second, unrelated gap (CR-01) the checkpoint never exercised. The phase is not fully done.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can toggle Sunday/Monday via a control and the choice persists across a real reload (CAL-01) | ✓ VERIFIED | Round 1 rows R2 (Monday default after clearing storage), R5 (focus stays put, open picker clears), R7 (Sunday selection survives hard reload), R8 (tampered value renders correctly, not repaired) all recorded PASS in `22-VALIDATION.md`. Source confirms `readStoredWeekStart`/`writeWeekStart` wired into `mount()` and the `.segmented` click handlers. |
| 2 | A throwing/inaccessible `localStorage` does not crash the Calendar mount (T-22-WK-02, Plan 22-02 must-have) | ✗ FAILED | `calendar.ts:424` dereferences `globalThis.localStorage` outside any try/catch. Confirmed independently: `mount()` runs inside `main.ts`'s try/catch (lines 53-77), whose catch renders "Something went wrong" — a `SecurityError` from the storage getter (blocked cookies/site data) collapses the whole Calendar view. Matches 22-REVIEW.md CR-01 exactly; not fixed, not exercised by the checkpoint. |
| 3 | `buildMonthGrid`'s hard-coded Sunday-first math is generalized to a required `weekStart` parameter and covered by unit tests for both week-start values (CAL-02 grid math) | ✓ VERIFIED | `buildMonthGrid(rows, month, weekStart: WeekStart)` — required, no default (`calendar-logic.ts:190-194`). `npm test` 1203/1203 passing, `npx tsc --noEmit` clean. `calendar-logic.test.ts` re-pins every pre-existing Sunday case explicitly and adds Monday-start padding cases plus `weekTotals` derivation cases (full/partial/rest/multi-run/NaN/reconciliation) per the plan. |
| 4 | Each week row shows a computed total, correct for the selected week start, at every viewport the app is expected to render at (CAL-02 full) | ✗ FAILED | R3, R4, R6 (October/June 2025 boundary and rest-week totals) all PASS — the math and rendering are correct at normal widths. But R11 (D-10, ~380px viewport) is recorded **FAIL**: day-cell values slightly overflow. The developer explicitly rejected a documented-PASS framing and chose FAIL. `REQUIREMENTS.md` itself keeps CAL-02 `Pending` for this reason — this is not a verifier interpretation, it is the phase's own recorded outcome. |
| 5 | The week-start control and other Calendar inputs use Phase 19's shared styling (CAL-03) | ✓ VERIFIED | R9 (header baseline holds across five controls, both themes) and R10 (hover, two-tone focus ring, WCAG AA contrast, both themes) both PASS. `git status --porcelain src/dashboard/styles.css` was empty after plan 22-04 (no new `.segmented` CSS) — confirms styling comes purely from Phase 19's existing button baseline, as designed. |
| 6 | The mandatory human browser checkpoint (SC5) ran with genuine per-row evidence, not a blanket approval | ⚠️ VERIFIED with caveat | 11/11 rows individually answered with quoted rendered values (not "looks fine"), 10 PASS / 1 FAIL. However, house rule 1 ("never cite an automated result as evidence for a manual row") was waived for R6, R7, R8 and R10 at the developer's explicit request — those four were observed by an agent via Chrome browser automation, not the developer's own eyes. This weakens the evidence for two ticked requirements: CAL-01's R7/R8 and CAL-03's R10. The observations are specific and numeric (quoted DOM state, computed contrast ratios, box-shadow values) rather than vague, which partially offsets the weaker observer, but it is a real, disclosed deviation from the plan's own house rules and is noted here per the task's explicit instruction to assess it. |

**Score:** 4/6 truths verified (2 FAILED — see Gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/views/calendar-logic.ts` | `WeekStart` union, required `weekStart` param, `totalTimeSec`, `WeekTotal`, `weekTotals` | ✓ VERIFIED | All present; `buildMonthGrid(rows, month, weekStart: WeekStart)` has no default. `WEEK_START_OFFSET` lookup confirmed at line 106. |
| `src/dashboard/views/calendar-logic.test.ts` | Sunday re-pins, Monday cases, week-total derivation cases | ✓ VERIFIED | `calendar-preferences.test.ts` (22 tests) and full suite (1203/1203) pass; existing regression confirmed clean. |
| `src/dashboard/views/calendar-preferences.ts` | `parseWeekStart`/`readStoredWeekStart`/`writeWeekStart`, allow-list, try/catch on both paths | ⚠️ ORPHANED CLAIM | Functions exist and behave correctly for `getItem`/`setItem` failures, but the module's own header comment claims "disabled cookies" coverage (T-22-WK-02) that is false at the call site — see Gap 2 (CR-01). |
| `src/dashboard/styles.css` | 8-track `.calendar-grid`, `.calendar-week-total*` rules, no new `.segmented` CSS | ✓ VERIFIED (with test-quality caveat) | Rules present and confirmed correct by direct read (`grid-template-columns: repeat(7, 1fr) auto`, `.calendar-week-total*`). Code review WR-02/WR-03 (confirmed independently by reading the CSS) found the `styles.test.ts` assertions for these rules are false-green — they don't pair with `assertNoAtRuleOverride`, so a real 380px override (20px→14px on `.calendar-week-total__distance`) is invisible to the test suite. This is a test-quality gap, not a runtime behavior gap; the CSS itself does what's intended. |
| `src/dashboard/views/calendar.ts` | week-start-aware weekday row, `Total` header, non-focusable total cell, `.segmented` control, `setWeekStart` | ✓ VERIFIED | `weekdayLabels`, `formatWeekDuration`, `weekTotalAccessibleName`, `buildWeekTotalCell`, `renderGrid`, `setWeekStart` all present and wired; `tabindex` count is exactly 2 (no new focus stop); `innerHTML` absent. Unguarded `globalThis.localStorage` access is the one confirmed defect (Gap 2). |
| `.planning/phases/22-calendar-week-start-totals/22-VALIDATION.md` | Round 1 section, 11 rows, verdicts | ✓ VERIFIED | Present, 11 `R22-VERDICT` tokens, `Checkpoint Outcome` records 10 PASS / 1 FAIL. |
| `.planning/REQUIREMENTS.md` | CAL-01/02/03 ticked only where their row maps passed | ✓ VERIFIED | CAL-01 `[x]` Complete, CAL-03 `[x]` Complete, CAL-02 `[ ]` Pending — matches the row-map gating exactly. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `readStoredWeekStart(storage)` | `buildMonthGrid`'s third argument | mount-scoped `weekStart` variable | ✓ WIRED | `calendar.ts:426`: `let weekStart = readStoredWeekStart(storage)`; passed into `buildMonthGrid(indexClient.getRows(), month, weekStart)`. |
| `grid.weekTotals[i]` | 8th cell of week row `i` | `buildWeekTotalCell` appended per row | ✓ WIRED | `calendar.ts:341`: `children.push(buildWeekTotalCell(grid.weekTotals[i], week, month))` inside the per-week loop. |
| a click on either segmented option | repainted `.calendar-grid` | `setWeekStart` → `writeWeekStart` + `buildMonthGrid` + `renderGrid` | ✓ WIRED | Confirmed by source read and by R3/R4's discriminator PASS (the grid genuinely re-groups, not just repaints). |
| `setWeekStart` | `localStorage` | `writeWeekStart(storage, next)` | ✓ WIRED | Confirmed by R7 (persistence survives reload). |
| `globalThis.localStorage` (property access) | `readStoredWeekStart`'s try/catch | direct assignment at `calendar.ts:424` | ✗ NOT_WIRED | The property access itself is outside the try/catch that only wraps `getItem`/`setItem` inside `calendar-preferences.ts`. This is Gap 2 / CR-01. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npm test` | 1203/1203 passed, 51 files | ✓ PASS |
| Type-check clean | `npx tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| `buildMonthGrid` totality claim ("never throws") | `buildMonthGrid([], {year:2024,month:3}, "MONDAY")` executed directly against the shipped module | `RangeError: Invalid array length` at `calendar-logic.ts:219` | ✗ FAIL — confirms 22-REVIEW.md WR-01 independently. Not reachable via the app's real path (parseWeekStart always returns a valid union member), so classified as a code-quality Info/Warning finding rather than a phase-blocking gap, but it directly contradicts the module's own JSDoc ("Total function: never throws") and `calendar-preferences.ts`'s T-22-WK-01 claim that a tampered value "can never reach the grid math" (it reaches the math fine — it throws inside it). |
| No debt markers in phase-modified files | `grep -nE "TBD\|FIXME\|XXX"` across the four modified files | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| CAL-01 | 22-01, 22-02, 22-03, 22-04, 22-05 | User can choose Sunday/Monday week start; choice persists | ✓ SATISFIED (with robustness caveat) | R2, R5, R7, R8 PASS. Ticked Complete in REQUIREMENTS.md. Caveat: Gap 2 (CR-01) means persistence/rendering is not robust against a throwing `localStorage` getter — an edge case the checkpoint did not exercise. |
| CAL-02 | 22-01, 22-02, 22-03, 22-05 | Week totals computed and shown, respecting selected week start | ✗ BLOCKED | R11 FAIL. REQUIREMENTS.md itself keeps this `Pending` — the phase's own gating logic, independently confirmed correct by this verification. |
| CAL-03 | 22-02, 22-04, 22-05 | Calendar controls use shared Phase 19 styling | ✓ SATISFIED | R9, R10 PASS; no new `.segmented` CSS added (`git status --porcelain src/dashboard/styles.css` empty after 22-04). Ticked Complete in REQUIREMENTS.md. |

No orphaned requirements: `REQUIREMENTS.md`'s Phase 22 status table lists exactly CAL-01/CAL-02/CAL-03, and all three appear in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/views/calendar.ts` | 424 | Unguarded `globalThis.localStorage` property access outside try/catch | 🛑 Blocker (Gap 2) | SecurityError under blocked-cookies browser config crashes the entire Calendar view via `main.ts`'s generic error panel |
| `src/dashboard/views/calendar-logic.ts` | 106, 175, 219 | `WEEK_START_OFFSET[weekStart]` has no fallback for an off-union value; propagates to `NaN` → `RangeError` | ℹ️ Info (not independently blocking; unreachable via the app's real call path, but contradicts the module's own "never throws" documentation) | Confirmed by direct execution against the shipped module |
| `src/dashboard/styles.test.ts` | ~1751-1817 | Phase 22's CSS test block asserts `.calendar-week-total__distance: font-size: 20px` with no `assertNoAtRuleOverride` pairing, while the same phase's own 380px media query overrides it to 14px | ℹ️ Info (test-quality gap, not a runtime defect — the CSS itself is correct) | A future regression to the 380px override would go undetected by this suite |
| `src/dashboard/views/calendar.test.ts` | ~280-314 | Exact whole-file-substring counts for `.focus()` (must be 2) and `tabindex` (must be 2) already distort source comments (e.g. "focus-index attribute" instead of `tabindex`) to keep the counters green, and block an unrelated pre-existing focus-loss fix (IN-12) | ℹ️ Info (guard-quality issue, not a phase-goal blocker) | Documented in 22-REVIEW.md WR-04; independently confirmed present in source |

No `TBD`/`FIXME`/`XXX` debt markers found in any of the four phase-modified files.

### Human Verification Required

None required beyond what already ran. Both gaps are code-level and code-review-confirmed, not matters of visual/interaction judgment requiring a fresh human pass — they need a fix followed by a targeted re-check (R11 re-run for Gap 1; a new checkpoint row or unit test with a throwing-getter storage stand-in for Gap 2), which is gap-closure work, not open verification.

### Gaps Summary

Two concrete, independently-confirmed gaps prevent the phase goal from being fully achieved:

1. **CAL-02 is not achieved end to end.** The week-total computation and boundary re-grouping are demonstrably correct (R3/R4's discriminator pair passed cleanly — the grid genuinely re-groups, not just repaints), but at a ~380px viewport the day-cell values overflow their cells, and the developer explicitly recorded this as FAIL rather than accept a documented-PASS framing. This is exactly the outcome `REQUIREMENTS.md` itself already records (`CAL-02` stays `Pending`) — this verification independently confirms that gating is correct rather than overly conservative.

2. **A confirmed, unaddressed Critical code-review defect (CR-01) undermines CAL-01's robustness claim.** `calendar.ts:424` dereferences `globalThis.localStorage` outside any try/catch. `calendar-preferences.ts`'s own header comment claims T-22-WK-02 covers "disabled cookies," but the throwing operation in that exact scenario is the property getter, not `getItem`/`setItem` — so the claim is false as shipped. I independently executed this reasoning against the source: `mount()` is called inside `main.ts`'s try/catch, whose catch renders a generic "Something went wrong" panel, so a `SecurityError` here takes down the whole Calendar view, not just the week-start preference. None of the eleven checkpoint rows exercised this path (R8 tampers the stored *value*, not the storage handle's *accessibility*), so it went unobserved by the human checkpoint despite being flagged by the code review that ran afterward.

Both gaps are real, current, and not addressed by any later phase in the roadmap (Phases 23-25 cover Trends zoom/pan, local curation, and CI hardening — none touch Calendar storage robustness or narrow-viewport grid layout). ROADMAP.md's `[x]` mark on line 72 for Phase 22 is not supported by these findings and should not be treated as authoritative until both gaps are closed or explicitly overridden.

Everything else the phase set out to do is genuinely done: the pure grid-math generalization (`buildMonthGrid`'s required `weekStart`, unit-tested both ways), the persistence read/write/allow-list path for the happy path, the `.segmented` control's Phase 19 styling inheritance, and the render wiring (weekday row, `Total` header, per-week total cells) are all real, substantive, and wired — confirmed by direct source reading, not just by trusting the SUMMARY.md narrative.

---

_Verified: 2026-08-18T16:10:00Z_
_Verifier: Claude (gsd-verifier)_
