---
phase: 23-trends-zoom-pan-taller-bands
verified: 2026-08-27T07:23:19Z
status: human_needed
score: 5/5 must-haves verified (with 1 unconfirmed post-fix live regression noted)
overrides_applied: 0
human_verification:
  - test: "On the Cadence & HR tab (current build, post-commit 49add71), hold the zoom modifier and scroll/pinch outward over either band until it stops. Confirm the range reaches the full archive (~2011 to ~2026), not a ~5-year clamp around the opening window. Then attempt a drag-to-pan at that fully-zoomed-out boundary and confirm the canvas moves."
    expected: "Gesture zoom-out reaches the same full-archive limits the Volume and Training Load tabs already reach by gesture (confirmed in R2/R22/R48), and drag-to-pan is not a silent no-op once there."
    why_human: "chartjs-plugin-zoom gesture behavior cannot be exercised without a real pointer/wheel event in a live browser; no jsdom/canvas polyfill exists in this repo (23-VALIDATION.md's own stated hard constraint). CR-01 (now fixed in commit 49add71) capped this exact path at ~5 years throughout all three checkpoint rounds; the fix has a passing unit-test guard but has never been exercised by a real outward gesture on this specific tab — the code review that found and fixed it says so explicitly."
---

# Phase 23: Trends Zoom/Pan/Taller Bands Verification Report

**Phase Goal:** User can zoom and pan trend charts — via `chartjs-plugin-zoom`, gesture, and explicit on-screen controls — on taller chart bands, without any of it regressing the five-tab structure, the granularity toggle, or the canvas lifecycle.
**Verified:** 2026-08-27T07:23:19Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can zoom via `chartjs-plugin-zoom` (wheel/pinch) so a weekly view no longer shows the full 15-year archive at once | ✓ VERIFIED (Volume/Training Load) — ⚠ one path unconfirmed post-fix (Cadence & HR) | Volume: real trusted ⌘+wheel gesture, ticks moved from `Aug 2025–Aug 2026` to `2011–2026` (Round 1 R2, Round 2 R22, Round 3 R48). **Cadence & HR: CR-01 (code review, resolved commit `49add71`) found `buildChannelBand` passed the opening window, not archive bounds, to the zoom plugin, capping gesture zoom-out at ~5 of ~15 years and making drag-to-pan silently no-op past that clamp. `23-VALIDATION.md` R36(b)'s "111 wheel events, ended at `Jul 2021 to Aug 2026`" is the recorded symptom of the bug, not evidence it works — the row passed because it only asserted the two bands agreed with each other, not that full range was reachable. Fixed in source (verified present, see below) and backed by a new regression unit test (`trends-zoom-logic.test.ts:485`, verified to fail with the bug reintroduced and pass with the fix), but no round ever gestured outward past default on this tab, before or after the fix — see Human Verification.** |
| 2 | User can pan horizontally via gesture AND via explicit +/− and left/right on-screen controls that work with no pointing device | ✓ VERIFIED | Drag gesture: +576px over 119 trusted pointermove events, cursor `grab`→`grabbing` (R6); Round 2 real +255px drag (R26). Keyboard-only: all four buttons individually activated by trusted Enter with no pointer, `aria-label` quoted before/after (R7, R27, R49(b)). Unregressed in Round 3 (R49/R50), including a specific check that 23-12's tablist wrapper added no new Tab stop. |
| 3 | Chart bands render taller than the fixed 140px, giving usable y-axis range | ✓ VERIFIED | `.chart-band__canvas-wrap--tall { height: clamp(200px, 34dvh, 420px) }` (`src/dashboard/styles.css:1046-1047`, phone floor `clamp(160px,30dvh,260px)` at :1102) applied via the single shared `buildChartBand` helper (`trends-charts.ts:532-557`) at all three zoomable mounts: Volume (`trends.ts:630`), Training Load (`trends.ts:957`), Cadence & HR (`trends-charts.ts:598`). Rendered and measured in-browser: 204px at 600px viewport, exactly 420px ceiling at 1200×1400 (R13, re-confirmed R44); both Cadence & HR bands equal at 272-306px (R14, R45); 240px floor at all four required phone widths 390/393/412/430 (R15→R46). |
| 4 | Zoom/pan composes with the granularity toggle and five-tab structure; rapid tab cycling with zoom/pan state present does not throw "Canvas is already in use"; each tab destroys/reinitializes cleanly | ✓ VERIFIED | Three full five-tab cycles with zoom state present, zero console errors, no "Canvas is already in use", exact per-panel canvas counts, granularity toggle resets zoom per D-23 in both directions (R17, re-confirmed R37 Round 2 and R52 Round 3 — the last with 76 captured console messages, all traced to a browser extension origin, zero app-origin). All `ChartHandle.destroy()` implementations call `controller?.destroy()` before `chart.destroy()` and are idempotent via a `destroyed` flag (code review, confirmed in `trends-charts.ts:260,347,463,733,914,1018,1118`). Reset-on-full-remount confirmed (R20, R40, R53). |
| 5 | Human checkpoint: served under `/strava-widgets`, zoom/pan exercised via mouse and on-screen controls on multiple tabs, all five tabs and granularity toggle rapidly cycled, no console errors, no stuck/duplicated canvases | ✓ VERIFIED (as designed) | Three full checkpoint rounds held (R1-R20, R21-R42, R43-R54). Round 3 closed a clean sweep: 12 PASS / 0 FAIL / 0 BLOCKED across R43-R54, served via a fresh build (`assets/index-BQy-1dz6.js` / `index-B573RjUr.css`, confirmed different from Round 2's bytes and confirmed live via both script/link tags and `performance.getEntriesByType('resource')`). **Caveat:** this checkpoint closed BEFORE the CR-01 fix (commit `49add71`, landed during the post-checkpoint code review) — see Truth 1. |

**Score:** 5/5 truths structurally verified in code; 1 of the 5 (Truth 1) carries an unconfirmed live-gesture regression check that must be run against the current build before the phase can be called fully closed with confidence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/views/chart-zoom.ts` | Zoom/pan controller, on-screen control cluster, grab-cursor UX | ✓ VERIFIED | `attachZoomController` wired at all three zoomable mounts (`trends-charts.ts:334, 731, 1018`); listener/observer teardown confirmed matched in code review (no leaks found). |
| `src/dashboard/views/trends-zoom-logic.ts` | Pure zoom-range math (default window, limits, step ranges, restore) | ✓ VERIFIED | 54 tests including the new CR-01 guard (`:485`), all passing. |
| `src/dashboard/views/trends-charts.ts` | Chart mounts wired to `chartjs-plugin-zoom`, taller bands, teardown | ✓ VERIFIED (post-fix) | `buildZoomPluginOptions` now receives archive `bounds` at all three call sites (`trends-charts.ts:319, 647→zoom.bounds, 992`) — confirmed by direct read of current source, not narrative. |
| `.chart-band__canvas-wrap--tall` (styles.css) | Taller band CSS, by-value tested | ✓ VERIFIED | `styles.css:1046-1047`, `:1102`; `styles.test.ts` by-value tests green. |
| `.trends-tablist-scroll` (styles.css / trends.ts) | Contains the five-tab strip's overflow so it no longer widens the document | ✓ VERIFIED | Confirmed rendered: `documentElement.scrollWidth === clientWidth` at all four phone widths (R46), closing the prior R35 defect. |
| `chartjs-plugin-zoom@^2.2.0`, `hammerjs@^2.0.8` | Pinned dependencies | ✓ VERIFIED | `package.json:42,44`; `npm audit` clean at install (23-01). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `trends.ts` (Volume/Training Load mounts), `trends-charts.ts` (Cadence & HR) | `chart-zoom.ts`'s `attachZoomController` | direct call, `onSettle` closure | WIRED | Confirmed at all three call sites; `settle()` propagates to both Cadence/HR bands (D-02 lockstep) per R36/R51. |
| Chart mount `options.plugins.zoom` | `buildZoomPluginOptions` (`trends-zoom-logic.ts`) | `bounds` argument | WIRED, now correct at all 3 sites | Volume/Training Load always passed archive bounds; Cadence & HR passed the opening window until commit `49add71`, now passes `zoom.bounds` (archive). Verified in current source at `trends-charts.ts:647,709-715`. |
| On-screen +/−/←/→ buttons | Chart range update | `chart-zoom.ts` button handlers → `applyRange`/`settle` | WIRED | Keyboard-only activation confirmed to move the chart and update `aria-label` (R7, R27, R49(b)). |
| Granularity toggle | Zoom-range reset | `trends.ts:668` clears `volumeZoomRange` on granularity change (D-23) | WIRED | Confirmed by both source read and R52/R53 rendered behavior. |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/placeholder markers found in any Phase 23-modified file (`styles.css`, `styles.test.ts`, `chart-zoom.ts`, `trends-charts.ts`, `trends-tick-format.ts(.test.ts)`, `trends-training-load-logic.ts(.test.ts)`, `trends-zoom-logic.ts(.test.ts)`, `trends.ts`). The one `placeholder` hit in `trends.ts:7` is a pre-existing historical doc-comment about a different, already-shipped plan (18-15) and is not phase-23 debt.

The code review (`23-REVIEW.md`) found 7 Warning + 5 Info issues that remain **open and unfixed** as of this verification. None break a stated success criterion, but they are real, named defects worth carrying forward rather than silently dropping:

| ID | File:Line | Issue | Severity |
|----|-----------|-------|----------|
| WR-01 | `trends.ts:923-952,980-1006` | Training Load window preset (`aria-pressed`) goes stale the moment the chart is zoomed/panned/reset by any other control — screen-reader users are told the wrong window is active | Warning |
| WR-02 | `trends.ts:452,1306-1319` | `loadWindow` survives `unmount()` while `loadZoomRange` resets — a remount can show a 12mo chart with `3mo` still marked pressed | Warning |
| WR-03 | `chart-zoom.ts:346-349` | Disabling a focused pan/zoom button at its clamp drops keyboard focus to `<body>` with no announcement | Warning |
| WR-04 | `trends-zoom-logic.ts:382-387` | `restoreOrDefault` doesn't clamp into the fallback's own domain — a saved range from one TRIMP model can open the other model's chart on blank space | Warning |
| WR-05 | `trends.ts:521,552-586`; `styles.css:1540-1546` | The `<details>` a11y-equivalent table for the year heatmap lives inside the `overflow-x:auto` scroll wrapper, contradicting the CSS comment's stated rationale for skipping `tabindex="0"` | Warning |
| WR-06 | `styles.test.ts:2228,2301` | Two negative CSS guards use `toThrow()`, which passes vacuously if the selector is deleted entirely — cannot detect the regression they're named for | Warning |
| WR-07 | `trends-charts.ts:253,331,456,662,907,1002,1111` | Every chart `options` object is `as any`, so `plugins.zoom`, scale min/max, and tick callbacks compile with zero type checking (this is why Finding 10's mis-nesting needed a browser round to surface) | Warning |
| IN-01..IN-05 | see `23-REVIEW.md` | Stale cursor on detach, duplicated `MONTH_ABBR`, unused exports, an over-stated invariant comment, a hardcoded aria-label that's currently harmless | Info |

None of these gate TRN-01..04 per the review's own analysis and per Round 3's clean sweep, but they are unresolved debt that should not be assumed fixed.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| TRN-01 | 23-01,04,05,06,07,10,11,13 | Zoom via `chartjs-plugin-zoom` | ✓ SATISFIED, with the Truth-1 caveat above | R2/R22/R48 (Volume, unambiguous); Cadence & HR gesture-to-full-archive path fixed in code but not re-confirmed live |
| TRN-02 | 23-01,02,04,05,07,08,11,13 | Pan via gesture + explicit controls, no pointer required | ✓ SATISFIED | R6/R7/R26-32/R48-51, all PASS, unregressed Round 3 |
| TRN-03 | 23-01,02,03,07,09,10,12,13 | Taller bands than 140px | ✓ SATISFIED | R13-15 → R33-35 → R44-46 clean sweep, closed for the first time in Round 3 |
| TRN-04 | 23-01,05,06,07,08,11,13 | Composes with granularity/five-tab, no canvas-lifecycle regression | ✓ SATISFIED | R16→R36/R37→R51/R52/R53, clean; teardown discipline independently confirmed by code review |

No orphaned requirements — REQUIREMENTS.md's 4 TRN entries all appear in at least one plan's `requirements:` frontmatter, and all 4 are marked Complete there.

### Gate State (independently re-run this session)

- `npx tsc --noEmit` → exit 0
- `npm test` → 55/55 files, 1361/1361 tests passing (includes the CR-01 regression guard at `trends-zoom-logic.test.ts:485`, confirmed passing)
- `npm run build`, `npm run build-widgets`, `npm run verify-dashboard` (37/37) — per `23-VALIDATION.md`'s and the code review's independently-recorded runs; not re-run in full here beyond tsc/test, which were re-run directly

### Human Verification Required

### 1. Cadence & HR gesture zoom-out, post-CR-01-fix

**Test:** On the Cadence & HR tab, using the current build (post-commit `49add71`), hold the zoom modifier (⌘ on Mac / Ctrl elsewhere) and scroll (or pinch) outward over either band repeatedly until the range stops changing. Then try a drag over the band.
**Expected:** The range reaches the full archive bounds (approximately 2011 to 2026 — the same span Volume and Training Load already reach by gesture), not a clamp around a 5-year window. Drag-to-pan produces visible movement at that boundary rather than silently doing nothing.
**Why human:** This is exactly the path CR-01 broke (opening-window bounds passed where archive bounds belong), and it is exactly the path no browser checkpoint round — before or after the fix — ever exercised. The fix is real and has a passing, non-vacuous unit-test guard, but chartjs-plugin-zoom's runtime gesture behavior cannot be confirmed without a live browser, and this repo has no canvas/jsdom polyfill to substitute for one.

### Gaps Summary

No artifact is missing, stubbed, or unwired. All four TRN requirements have genuine, mostly-live-gesture evidence behind them across three checkpoint rounds, and the code review's teardown/lifecycle audit corroborates the "no regression" claims independently of the checkpoint narrative. The phase goal is **substantially achieved**.

The one item keeping this from a clean `passed` is narrow but real: a Critical-severity defect (CR-01) sat undetected through all three checkpoint rounds specifically because no row ever gestured *outward* past the default on the Cadence & HR tab, and the fix that closes it — while sound, present in source, and covered by a test proven to catch the exact regression — has itself never been exercised by a real gesture. Given that this class of defect ("survived three checkpoints because of an untested direction") is precisely what this project's own REQUIREMENTS.md preamble names as the recurring failure mode for this milestone (Phase 16/17/18 rendering defects behind a green gate), it should not be waved through on unit-test evidence alone. One short human check closes it.

The 7 open Warning findings (WR-01 through WR-07) do not block this phase's goal but are real, unfixed defects that should be tracked forward rather than assumed resolved because SUMMARY.md and REQUIREMENTS.md mark the phase complete.

---

_Verified: 2026-08-27T07:23:19Z_
_Verifier: Claude (gsd-verifier)_
