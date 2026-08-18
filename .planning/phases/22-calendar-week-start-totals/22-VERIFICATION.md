---
phase: 22-calendar-week-start-totals
verified: 2026-08-18T21:40:00Z
status: gaps_found
score: 4/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "A throwing/inaccessible localStorage does not crash the Calendar mount (narrow, calendar-scoped claim) — closed by plan 22-07's resolveWeekStartStorage() and confirmed by Round 2 row R15 PASS (a throwing localStorage GETTER installed live on the page; hash navigation to Calendar rendered the full grid + 5 week-total cells, no error panel, no console error, defaulted to Monday)."
    - "buildMonthGrid's off-union weekStart totality (WR-01) — closed by plan 22-07's weekStartOffset(); confirmed total at calendar-logic.ts:182-184 and covered by calendar-logic.test.ts:328-351 for both 'MONDAY' as never and undefined as never."
  gaps_remaining:
    - "The ~380px day-cell/week-total overflow (CAL-02, originally R11 FAIL) — re-asked at Round 2 row R13 against the fixed, freshly-proven build and recorded FAIL again by the developer's own eyes. 22-06's deeper CSS compaction reduced but did not eliminate the overflow."
  regressions: []
  new_findings_this_round:
    - "CR-01's fix is locally sound (resolveWeekStartStorage correctly wraps the property getter) but does not close the threat model its own documentation claims to close: src/dashboard/main.ts:19 runs `applyThemeMode(readStoredMode(localStorage))` at module scope, unguarded, and throws during module evaluation under the exact blocked-site-data browser configuration calendar-preferences.ts's header comment names — so the whole dashboard bootstrap dies before any view (including Calendar) mounts, and there is no reachable 'generic error panel' as calendar.ts's own rationale comment (lines 429-432) claims. Identified independently in 22-REVIEW.md as BL-03 (Critical) and confirmed here by direct source read. R16, the row that would have exercised this exact real-browser path, was declined by the developer this round and remains unexercised."
gaps:
  - truth: "Each week row's total and day-cell values render legibly, with no overflow, at every viewport width the app is expected to render at, including ~380px (CAL-02 / SC3)"
    status: failed
    reason: "Round 2 row R13 — the R11 re-ask against the freshly-proven, gap-closure-fixed build — was recorded FAIL by the developer's own eyes, verbatim: \"Days still overflow. Total colum remains wide (wider than any other column) and all text fits. But other columns (day columns) become narrow and distance text overflows.\" 22-06's deeper type compaction (padding, .calendar-day__distance 20px->14px, .calendar-week-total__time/__count 14px->12px, .calendar-day min-width: 0) reduced but did not eliminate the overflow. 22-REVIEW.md root-causes it precisely as two independent, compounding causes (BL-01, BL-02), both confirmed present in the current source by direct read."
    artifacts:
      - path: "src/dashboard/styles.css"
        issue: "BL-01 (lines 741-745, 825-833, 878-902): .calendar-grid keeps `grid-template-columns: repeat(7, 1fr) auto` at every breakpoint including 380px; .calendar-day gets `min-width: 0` at 380px so the seven day tracks float to zero, but .calendar-week-total keeps `white-space: nowrap` with no min-width override at 380px, so the 8th (Total) track keeps a hard content-based floor and wins 100% of the negotiation — the day columns absorb the entire width shortfall. BL-02 (lines 764-778, 799-805, 888-890): .calendar-day is itself a 3-column inner grid (`grid-template-columns: 1fr 1fr 1fr`) with .calendar-day__distance pinned to the centered middle column and `justify-self: center`; the 380px block only touches font-size on this element, never the inner grid-template-columns, so the distance string is laid out in roughly a third of an already-collapsed cell and spills symmetrically past both cell borders when centered."
    missing:
      - "Cap the 8th (Total) track so it participates in the 380px squeeze instead of winning it unconditionally, e.g. `.calendar-grid { grid-template-columns: repeat(7, minmax(0,1fr)) minmax(0, max-content); }` plus `.calendar-week-total { min-width: 0; white-space: normal; }` at 380px (22-REVIEW.md BL-01's suggested fix)"
      - "Collapse .calendar-day's inner 3-column grid to a single-column stack at 380px (grid-template-areas: \"number\" \"distance\" \"count\"; grid-template-columns: 1fr; justify-self: start on all three children) so the distance value gets the cell's full width instead of a third of it (22-REVIEW.md BL-02's suggested fix)"
      - "Both fixes must land together — 22-REVIEW.md notes verifying either alone will reproduce another ambiguous R13-style result"
      - "styles.test.ts:1858 currently asserts `.calendar-grid`'s grid-template-columns is NEVER overridden at any breakpoint; this assertion locks the failing shape in place and must be updated alongside the BL-01 fix"
      - "styles.test.ts:1819-1847's five 380px compaction assertions (WR-03) only prove an override exists, never what value it carries — pair them with a value read so a future regression to these exact fixes is caught"
      - "A Round 3 checkpoint re-ask of R13/R11, with a stated viewport width, against a freshly re-proven build, observed by the developer's own eyes with no waiver"
  - truth: "CR-01's fix closes the browser-configuration blocked-site-data threat its own documentation claims to close, and the module's security-note comments describe the app's actual behavior (22-07-PLAN.md's own must-have: \"T-22-WK-02 is TRUE as documented\")"
    status: failed
    reason: "resolveWeekStartStorage() is itself correctly implemented and locally sound: the property getter access is inside a try/catch (calendar-preferences.ts:57-64), calendar.ts:433 is the only call site, and Round 2 row R15 (developer-observed) PASSED — a throwing localStorage GETTER installed live on the page, hash-navigated to the Calendar route, rendered the full grid and all five week-total cells with no error panel and no console error. But calendar-preferences.ts's header comment (lines 19-28) and calendar.ts's rationale comment (lines 429-432) claim this closes 'a browser configuration where site data is blocked (Firefox Block cookies and site data, Chrome blocked-origin storage, a storage-partitioned iframe)'. In that exact configuration, src/dashboard/main.ts:19 (`applyThemeMode(readStoredMode(localStorage))`) executes at module scope with no try/catch and throws during module evaluation, before any router or view — including Calendar — ever mounts. The page renders blank, with no nav and no view content, not the 'generic error panel' calendar.ts's own comment claims would be the fallback if this were left unguarded. theme.ts:93, theme.ts:130 and detail-charts.ts:218 share the identical unguarded `?? localStorage` shape. R16 — the row that would have exercised this exact real-browser-configuration path — was declined by the developer this round ('decline it') and remains unexercised; nothing was actually observed about it in a real browser this phase. Identified independently as BL-03 (Critical) in the fresh 22-REVIEW.md and confirmed here by direct read of main.ts:19."
    artifacts:
      - path: "src/dashboard/main.ts"
        issue: "Line 19: `applyThemeMode(readStoredMode(localStorage))` at module scope, unguarded — the actual failure point under the browser configuration CR-01's own comments claim to cover"
      - path: "src/dashboard/views/calendar-preferences.ts"
        issue: "Header comment (lines 19-28) claims resolveWeekStartStorage closes the blocked-site-data browser-configuration threat; it only closes that threat for code paths reached after main.ts's module scope has already evaluated successfully, which the same configuration prevents"
      - path: "src/dashboard/views/calendar.ts"
        issue: "Rationale comment at lines 429-432 asserts an unguarded access here 'would take the whole view down through main.ts's generic error panel' — no such reachable error panel exists in the real blocked-storage scenario; main.ts dies during module evaluation before onMatch or any view exists"
    missing:
      - "Either extend the storage-resolution guard app-wide (22-REVIEW.md BL-03 sketches a shared resolveStorage() used by main.ts:19, theme.ts:93/130, and detail-charts.ts:218) or, if that is ruled out of Phase 22's scope, correct calendar-preferences.ts's header comment and calendar.ts's rationale comment to state plainly that the Calendar's own read is guarded but the dashboard bootstrap is not, and that the blocked-site-data threat remains open at the app level"
      - "A developer-observed run of R16 (declined this round) in a real, browser-level blocked-storage configuration, to establish what the page actually shows — the code review's predicted blank-page outcome (disposition (c) in 22-VALIDATION.md's R16 instructions) has not been directly observed"
human_verification:
  - test: "Round 3 checkpoint: re-ask R11/R13 (narrow-viewport day-cell/Total overflow) against a build that includes both BL-01 and BL-02's CSS fixes, at a stated pixel width, developer's own eyes, no waiver."
    expected: "No day-cell value overflows or is clipped/truncated at any viewport down to at least 380px, in both themes."
    why_human: "This is a visual/rendering judgement the two previous rounds (R11, R13) both required the developer's own eyes for; grep/source-read can confirm the CSS shape but not that it visually resolves the overflow."
  - test: "R16: block site data for the origin in a real browser (Firefox Block cookies and site data / Chrome Don't allow sites to save data) and reload the app."
    expected: "One of the three documented dispositions: (a) Calendar grid and totals render — PASS; (b) generic 'Something went wrong' panel — FAIL; (c) blank page, no nav, no view content — NOT EXERCISABLE for the Calendar-level claim, record as a new main.ts:19 finding."
    why_human: "Requires changing a real browser-wide privacy setting and observing actual page behavior; declined by the developer in Round 2 ('decline it') and not exercised this phase. 22-REVIEW.md's BL-03 predicts outcome (c) from static analysis but this has not been directly observed."
---

# Phase 22: Calendar Week-Start & Totals Verification Report

**Phase Goal:** User can choose whether the training-log week starts Sunday or Monday; the choice persists and correctly drives which days each week-total sums, on calendar controls styled to match the rest of the dashboard.
**Verified:** 2026-08-18T21:40:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure round (plans 22-06, 22-07, 22-08), superseding the stale prior verification dated 2026-08-18T16:10:00Z.

## Reconciliation Summary

The prior `22-VERIFICATION.md` (score 4/6, `gaps_found`) named two gaps. This re-verification finds:

- **Gap 1 (CAL-02, ~380px day-cell overflow) — STILL OPEN.** Plan 22-06 deepened the 380px CSS compaction, but Round 2's re-ask (row R13, developer's own eyes) recorded **FAIL** again against the freshly-proven fixed build. `22-REVIEW.md` root-causes this in the current CSS (BL-01, BL-02) — confirmed by direct read of `styles.css` in this verification. This gap is carried forward, now with a precise two-part root cause and concrete fixes.
- **Gap 2 (CR-01, throwing `localStorage` crashing the Calendar mount) — the narrow, calendar-scoped claim is CLOSED.** Plan 22-07's `resolveWeekStartStorage()` wraps the property getter in try/catch; Round 2 row R15 (developer-observed) confirmed a throwing `localStorage` getter no longer takes down the Calendar view when it is exercised via hash navigation on an already-loaded app.
- **A new, related gap surfaces this round.** The fix's own documentation overclaims: `main.ts:19` remains unguarded and, under the exact real browser configuration CR-01's comments name, crashes the *entire dashboard bootstrap* before Calendar (or any view) mounts — worse than the "generic error panel" the source comments describe as the fallback. `22-REVIEW.md`'s BL-03 (Critical) identifies this independently; it is confirmed here by direct source read of `main.ts:19`. Round 2's R16 — the row that would have exercised this exact scenario in a real browser — was declined by the developer and never run.

Net: **one gap closes, one gap remains open, one new gap is discovered.** Status stays `gaps_found`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — User can toggle Sunday/Monday via a control and the choice persists across a real reload | ✓ VERIFIED | Round 1 rows R2 (Monday default after clearing storage), R5 (focus stays on pressed option, open picker clears), R7 (Sunday selection survives a real hard reload) all PASS. Source confirms `readStoredWeekStart`/`writeWeekStart` wired into `mount()` and the `.segmented` click handlers (`calendar.ts:426-433`, `setWeekStart`). |
| 2 | SC2 — `buildMonthGrid`'s hard-coded Sunday-first math is generalized to a required `weekStart` parameter and covered by unit tests for both week-start values | ✓ VERIFIED | `buildMonthGrid(rows, month, weekStart: WeekStart)` still required, no default (`calendar-logic.ts:190-194`). `weekStartOffset()` is now total for any input (`calendar-logic.ts:182-184`, WR-01 closed), covered by `calendar-logic.test.ts:328-351` for both `'MONDAY' as never` and `undefined as never` against a deep-equality check with the real Monday grid. `npm test`: 1222/1222 passing, 51 files; `npx tsc --noEmit` clean. |
| 3 | SC3 — Each week row shows a computed total, correct for the selected week start, legible at every viewport the app is expected to render at | ✗ FAILED | Round 2 row R13 — the R11 re-ask against the fixed build — recorded FAIL by the developer's own eyes: day-cell distance values still overflow their cells at narrow width; the Total column stays wide and fits. Root-caused in current source (styles.css) as two compounding causes — see Gaps. |
| 4 | SC4 — The week-start control and other Calendar inputs use Phase 19's shared styling | ✓ VERIFIED (minor cosmetic caveat) | Round 1 R9 (header baseline holds across five controls, both themes) and R10 (hover, two-tone focus ring, WCAG AA contrast) PASS. Round 2 R17 (developer-observed via agent waiver) confirms the new `.calendar-weekday--total` header sits right-aligned over the Total column's values, not centred away from them, on the widest week (`104.1 km / 10h 14m / ×7`). `22-REVIEW.md` WR-05 notes an unaddressed 8px/4px cosmetic offset between the header's flush-right edge and the values' padding-inset edge — non-blocking, R17 itself read this as correct alignment ("the 8px difference is cell padding"). |
| 5 | SC5 — The mandatory human browser checkpoint confirms the grid re-flows and week totals recompute correctly across both rounds | ✗ FAILED | 17 rows total across two rounds (11 Round 1 + 6 Round 2) with genuine per-row, quoted evidence — not a blanket approval. But the checkpoint's own result includes R13 FAIL (Round 2) confirming the narrow-viewport re-flow claim does not hold. Separately, evidence strength is weaker than the plan intended: Round 1 waived house rule 1 (developer's-own-eyes) for R6/R7/R8/R10; Round 2's preamble explicitly stated the waiver was NOT carried forward, but the developer re-granted it mid-session for R12, R14, R15 and R17 anyway — only R13 (the decisive FAIL) and R16 (declined) were fully developer-driven this round. This is a real, disclosed deviation from the checkpoint's own house rules in both rounds, and weakens (without invalidating) the PASS evidence behind the affected rows. |
| 6 | T-22-WK-02 (narrow) — a throwing/inaccessible `localStorage` GETTER does not crash the Calendar mount, once the app has already loaded | ✓ VERIFIED | `resolveWeekStartStorage()` wraps the `globalThis.localStorage` property access in try/catch and returns `null` on throw (`calendar-preferences.ts:57-64`); `calendar.ts:433` is the sole call site — confirmed by source read, no other `globalThis.localStorage`/bare `localStorage` reference remains in `calendar.ts`. Round 2 row R15 (developer-observed): a throwing getter installed live on the page, hash-navigated to Calendar, rendered the full grid + 5 week-total cells, defaulted to Monday, no error panel, no application console error. |
| 7 | CR-01's own documentation accurately describes what is and is not covered — the real browser-configuration blocked-site-data threat is actually closed end to end, as `calendar-preferences.ts`'s header and `calendar.ts`'s rationale comment claim | ✗ FAILED | `src/dashboard/main.ts:19` — `applyThemeMode(readStoredMode(localStorage))` — runs at module scope with no try/catch and throws during module evaluation under the exact configuration the header comment names (Firefox "Block cookies and site data", Chrome blocked-origin storage). This happens *before* any router or view, including Calendar, ever mounts — the page goes blank, not to the "generic error panel" `calendar.ts:429-432`'s comment claims would be the fallback. `theme.ts:93`, `theme.ts:130`, `detail-charts.ts:218` share the same unguarded shape. R16, which would have exercised this exact path in a real browser, was declined by the developer and never run this round. Identified independently as BL-03 (Critical) in `22-REVIEW.md`; confirmed here by direct read of `main.ts:19`. |

**Score:** 4/7 truths verified (3 FAILED — see Gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/views/calendar-logic.ts` | `WeekStart` union, required `weekStart` param, total `weekStartOffset`, `WeekTotal`, `weekTotals` | ✓ VERIFIED | All present; `weekStartOffset` is now total (`182-184`), closing WR-01. `MIN_WEEK_ROWS`/`WEEK_START_OFFSET` dead-code notes (22-REVIEW.md WR-10) are quality debt, not a runtime defect. |
| `src/dashboard/views/calendar-logic.test.ts` | Sunday re-pins, Monday cases, off-union totality cases | ✓ VERIFIED | `'MONDAY' as never` and `undefined as never` cases added (`328-351`), deep-equal the real Monday grid. Full suite 1222/1222 passing. |
| `src/dashboard/views/calendar-preferences.ts` | `resolveWeekStartStorage`, `parseWeekStart`/`readStoredWeekStart`/`writeWeekStart`, guarded getter access | ⚠️ SOUND BUT OVERCLAIMED | `resolveWeekStartStorage` is correctly implemented and is the sole storage-touching path for this key. Header comment (lines 19-28) overclaims closure of the app-level blocked-site-data threat — see Gap 2 (new). |
| `src/dashboard/styles.css` | Deepened 380px compaction, `.calendar-weekday--total` right-align | ✗ INSUFFICIENT | Rules present as described in 22-06-SUMMARY.md, but confirmed by direct read to still produce the R13 overflow — the 8-track grid and the day-cell's inner 3-column grid are the un-addressed root causes (BL-01, BL-02). |
| `src/dashboard/views/calendar.ts` | `resolveWeekStartStorage(deps.storage)` sole call site, `.calendar-weekday--total` applied to Total header | ✓ VERIFIED (wiring) | Confirmed no `globalThis.localStorage`/bare `localStorage` remains; `resolveWeekStartStorage(deps.storage)` at line 433. Comment at `429-432` is factually inaccurate about the failure mode it describes (BL-03) — see Gap 2 (new). |
| `src/dashboard/main.ts` | (pre-existing, not a Phase 22 artifact) | ✗ UNGUARDED (out of phase scope for the fix, but relevant to CR-01's claim) | Line 19: `applyThemeMode(readStoredMode(localStorage))`, module-scope, unguarded. Not modified by Phase 22, but Phase 22's own CR-01 documentation makes a claim this file's state falsifies. |
| `.planning/phases/22-calendar-week-start-totals/22-VALIDATION.md` | Round 1 (11 rows) + Round 2 (6 rows, R12-R17) sections, verdicts, Gap Closure Record | ✓ VERIFIED | Both rounds present; Round 2 records 4 PASS / 1 FAIL / 1 BLOCKED; Gap Closure Record explicitly states Gap 1 STILL OPEN, Gap 2 CLOSED (narrow scope). |
| `.planning/REQUIREMENTS.md` | CAL-01/02/03 ticked only where their row map passed | ✓ VERIFIED | CAL-01 `[x]` Complete (Round 1 + Round 2 R15), CAL-03 `[x]` Complete, CAL-02 `[ ]` Pending (R11 FAIL, R13 FAIL) — matches the row-map gating exactly, and matches this verification's independent conclusion. |
| `.planning/phases/22-calendar-week-start-totals/22-REVIEW.md` | Fresh code review post-gap-closure | ✓ VERIFIED | 3 critical / 11 warning findings; BL-01, BL-02, BL-03 independently reproduced against current source in this verification. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `readStoredWeekStart(storage)` | `buildMonthGrid`'s third argument | mount-scoped `weekStart` variable | ✓ WIRED | `calendar.ts:433-435`: `resolveWeekStartStorage(deps.storage)` → `readStoredWeekStart(storage)` → `buildMonthGrid(indexClient.getRows(), month, weekStart)`. |
| `globalThis.localStorage` (property access) | a try/catch | `resolveWeekStartStorage()` in `calendar-preferences.ts` | ✓ WIRED | Confirmed at `calendar-preferences.ts:57-64`; `calendar.ts` no longer dereferences the global directly (Gap 2 from prior verification is closed at this narrow scope). |
| a click on either segmented option | repainted `.calendar-grid` | `setWeekStart` → `writeWeekStart` + `buildMonthGrid` + `renderGrid` | ✓ WIRED | Confirmed by source read and by R14 (Round 2 regression check: all five Monday-start week totals read back exactly matching the preamble table, confirming no regression from 22-06/22-07). |
| a throwing `localStorage` GETTER | Calendar mount, mid-session | `resolveWeekStartStorage()`'s try/catch | ✓ WIRED | R15 PASS: hash-navigated to Calendar with the getter throwing, full grid + totals rendered. |
| a throwing `localStorage` GETTER, at page load | the dashboard bootstrap (`main.ts`) | *(no guard exists)* | ✗ NOT_WIRED | `main.ts:19` has no try/catch around `readStoredMode(localStorage)`; this is the new Gap 2 finding (BL-03) — the module-scope crash happens before Calendar's own (working) guard is ever reached. |
| `.calendar-day` (7 tracks) | 380px squeeze | `min-width: 0` (day) vs. no override (Total track) | ✗ NOT_WIRED | The 380px block relaxes the day tracks' floor to zero but leaves the Total track's `white-space: nowrap` content-based floor intact, so the day columns absorb 100% of the width shortfall — the direct cause of R13's FAIL (BL-01). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `calendar.ts`'s week-total cells | `grid.weekTotals[i]` | `buildMonthGrid` → `weekTotals` derived from in-month `rows` cells only | Yes — confirmed by R14 (five live Monday-start triples matching a table independently recomputed from the 1,868-activity organic archive) | ✓ FLOWING |
| `calendar.ts`'s day cells | `grid.weeks[i][j]` | `buildMonthGrid`'s per-day cell construction from `indexClient.getRows()` | Yes — confirmed by R13/R14 reading live rendered text, not stubbed values | ✓ FLOWING (rendering itself is broken at narrow width — a CSS/layout defect, not a data defect) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npm test` | 1222/1222 passed, 51 files | ✓ PASS |
| Type-check clean | `npx tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| No debt markers in phase-touched files | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across calendar.ts, calendar-logic.ts, calendar-preferences.ts, styles.css, main.ts | no matches | ✓ PASS |
| `.calendar-grid`'s 380px shape is still un-fixed (BL-01) | direct read of `styles.css:741-745`, `:825-833`, `:878-902` | `grid-template-columns: repeat(7, 1fr) auto` unchanged at 380px; `.calendar-week-total` has no `min-width`/`white-space` override at 380px | ✗ CONFIRMS GAP |
| `.calendar-day`'s inner grid is still un-collapsed (BL-02) | direct read of `styles.css:764-778`, `:888-890` | `grid-template-columns: 1fr 1fr 1fr` unchanged at 380px; only `font-size` overridden | ✗ CONFIRMS GAP |
| `main.ts:19` is still unguarded | direct read of `main.ts:1-25` | `applyThemeMode(readStoredMode(localStorage));` at module scope, no try/catch | ✗ CONFIRMS GAP |
| `resolveWeekStartStorage`'s live-and-working branch is untested (WR-01, code review) | `grep -n "when it is present and readable" calendar-preferences.test.ts` | no match | ⚠️ CONFIRMS test-quality warning (non-blocking) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| CAL-01 | 22-01, 22-02, 22-03, 22-04, 22-05, 22-07, 22-08 | User can choose Sunday/Monday week start; choice persists | ✓ SATISFIED (with two disclosed caveats) | R2, R5, R7 (Round 1) and R15 (Round 2) PASS for the calendar-scoped claim. REQUIREMENTS.md ticks Complete. Caveats: (1) R15's evidence came under a mid-session house-rule-1 waiver (agent-observed, not developer's own eyes); (2) the app-level blocked-site-data threat (main.ts:19) remains open — see the new Gap 2 above — though it sits outside CAL-01's literal scope (persistence once the app has loaded) rather than inside it. |
| CAL-02 | 22-01, 22-02, 22-03, 22-05, 22-06, 22-08 | Week totals computed and shown, respecting selected week start | ✗ BLOCKED | R11 (Round 1) FAIL, R13 (Round 2, re-ask against the fixed build) FAIL — both developer-observed, both citing the same class of narrow-viewport overflow. REQUIREMENTS.md correctly keeps this `Pending` after both rounds. |
| CAL-03 | 22-02, 22-04, 22-05, 22-06 | Calendar controls use shared Phase 19 styling | ✓ SATISFIED | R9, R10 (Round 1) and R17 (Round 2, confirm-unregressed) PASS. REQUIREMENTS.md ticks Complete. Minor unaddressed cosmetic caveat (WR-05, 8px header/value edge offset) does not affect the tick. |

No orphaned requirements: `REQUIREMENTS.md`'s Phase 22 status table lists exactly CAL-01/CAL-02/CAL-03, and all three appear in at least one plan's `requirements:` frontmatter across the full 8-plan set.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/dashboard/styles.css` | 741-745, 825-833, 878-902 | `.calendar-grid`'s 8-track shape and `.calendar-week-total`'s hard content floor are unchanged at 380px while `.calendar-day` floors to zero | 🛑 Blocker (Gap 1, carried forward) | Day-cell distance values overflow at narrow viewport — developer-confirmed FAIL twice (R11, R13) |
| `src/dashboard/views/calendar.ts` | 429-432 | Rationale comment describes a "generic error panel" fallback that is not reachable in the scenario it names | 🛑 Blocker (Gap 2, new — BL-03) | A future maintainer reading this comment (or `calendar-preferences.ts`'s header) will reasonably but incorrectly conclude blocked-site-data is a fully handled case for the dashboard |
| `src/dashboard/main.ts` | 19 | Unguarded `localStorage` property access at module scope | 🛑 Blocker (Gap 2, new — BL-03) | Under blocked site data, the entire dashboard module graph fails to evaluate; the page renders blank before Calendar's own (working) guard is ever reached |
| `src/dashboard/views/calendar-preferences.test.ts` | 133-191 | `resolveWeekStartStorage`'s live-and-working branch (`globalThis.localStorage` present, readable) is untested | ⚠️ Warning (WR-01, code review) | Mutating the function to `return null;` leaves the entire suite green, silently disabling week-start persistence for every real user |
| `src/dashboard/views/calendar.test.ts` | 238-336 | No regression guard against re-introducing `globalThis.localStorage` directly in `calendar.ts` | ⚠️ Warning (WR-02, code review) | Confirmed absent by grep: re-adding the unguarded access would pass every test in the repo |
| `src/dashboard/styles.test.ts` | 1819-1847, 1858 | 380px compaction assertions prove an override exists, never what value it carries; `.calendar-grid`'s grid-template-columns is asserted to NEVER change at any breakpoint | ⚠️ Warning (WR-03, code review) | Locks the currently-failing CSS shape in place; must be updated when Gap 1's fix lands |
| `src/dashboard/styles.css` | 755-762, 893-901 | `.calendar-weekday--total`'s right-align doesn't account for `.calendar-week-total`'s own padding (WR-05); the 380px `.calendar-week-total__distance` override raises `line-height` to 1.5 from the base 1.2, adding height at the narrowest breakpoint (WR-07) | ℹ️ Info (non-blocking cosmetic) | R17 read the resulting 8px offset as acceptable; no functional impact |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` debt markers found in any phase-touched file.

### Human Verification Required

See frontmatter `human_verification`. Two items:

1. **Round 3 re-ask of the narrow-viewport overflow (R11/R13)** against a build carrying both BL-01 and BL-02's CSS fixes, at a stated width, developer's own eyes, no waiver.
2. **R16** (real browser-level blocked-site-data configuration) — declined in Round 2, still unexercised. `22-REVIEW.md`'s BL-03 predicts a blank page from static analysis; this has not been directly observed.

Both are gap-closure verification work, not open-ended exploration — they gate the two gaps below.

### Gaps Summary

Two concrete gaps remain, one carried forward and one newly discovered by this round's code review and confirmed here by direct source read:

1. **CAL-02 is still not achieved (Gap 1, carried forward).** The Round 2 gap-closure round (plan 22-06) deepened the 380px CSS compaction, but the developer's own re-ask (row R13) recorded FAIL again against the freshly-proven fixed build — verbatim: "Days still overflow... other columns (day columns) become narrow and distance text overflows." This verification independently confirms, by direct read of the current `styles.css`, the precise two-part cause the code review names: (a) the 8-track grid's Total column keeps a hard, unyielding content-based floor while the day columns are the only track relaxed to zero at 380px, so the day columns absorb the entire width shortfall; and (b) each day cell's own inner 3-column grid pins the distance value to a centered third-width column that the 380px block never collapses. Both must be fixed together. `REQUIREMENTS.md` correctly keeps CAL-02 `Pending` after two rounds of checkpoint evidence.

2. **A new gap: CR-01's fix is real but its own documentation overclaims what it closes (Gap 2, new).** `resolveWeekStartStorage()` genuinely fixes the narrow, calendar-scoped claim from the prior verification — confirmed by source read and by Round 2's developer-observed R15 PASS. But `calendar-preferences.ts`'s header comment and `calendar.ts`'s rationale comment both claim this closes the browser-configuration blocked-site-data threat end to end. It does not: `main.ts:19` remains unguarded and, in that exact configuration, crashes the entire dashboard module graph before any view — including the now-correctly-guarded Calendar — ever mounts. The page goes blank, not to the "generic error panel" the source comments describe. This is out of Phase 22's stated fix scope (main.ts predates this phase and is shared with theme.ts/detail-charts.ts), but it is not out of scope for this phase's own documentation to describe accurately, and 22-07-PLAN.md's own must-have text ("T-22-WK-02 is TRUE as documented") is not actually satisfied. R16, the row designed to exercise this exact real-browser path, was declined by the developer this round and was never observed.

Both gaps are current and not addressed by any later phase in the roadmap (Phases 23-25 cover Trends zoom/pan, local curation, and CI hardening — none touch Calendar CSS layout or dashboard-wide storage guarding).

**Genuinely closed this round, confirmed independently:** the narrow-scope CR-01 fix (throwing getter no longer crashes an already-mounted Calendar — R15 PASS, source-confirmed), and `buildMonthGrid`'s off-union `weekStart` totality (WR-01 — source and test confirmed). Neither regressed; `npm test` is 1222/1222 and `tsc --noEmit` is clean. CAL-01 and CAL-03 remain correctly ticked Complete in `REQUIREMENTS.md`; CAL-02 remains correctly `Pending`.

**Evidence-quality note, disclosed but not independently blocking:** across both rounds, several PASS-recorded rows (Round 1: R6, R7, R8, R10; Round 2: R12, R14, R15, R17) were observed by an AI agent under a mid-session waiver the developer granted, rather than by the developer's own eyes as the checkpoint's own house rules require by default — Round 2's preamble explicitly stated the waiver would NOT be pre-granted, and it was re-granted anyway. This weakens, without invalidating, the strength of evidence behind those specific rows; the decisive FAIL (R13) and the declined row (R16) were both fully developer-driven.

---

_Verified: 2026-08-18T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
