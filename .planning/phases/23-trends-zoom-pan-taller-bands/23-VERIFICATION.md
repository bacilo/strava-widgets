---
phase: 23-trends-zoom-pan-taller-bands
verified: 2026-08-27T09:45:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "5/5 must-haves structurally verified; 1 carried an unconfirmed live-gesture regression check"
  gaps_closed:
    - "Cadence & HR gesture zoom-out reaching the full archive, post-CR-01-fix (was the sole human_verification item; discharged by a real human gesture, see below)"
  gaps_remaining: []
  regressions: []
---

# Phase 23: Trends Zoom/Pan/Taller Bands Verification Report

**Phase Goal:** User can zoom and pan trend charts — via `chartjs-plugin-zoom`, gesture, and explicit on-screen controls — on taller chart bands, without any of it regressing the five-tab structure, the granularity toggle, or the canvas lifecycle.
**Verified:** 2026-08-27T09:45:00Z (re-verification)
**Status:** passed
**Re-verification:** Yes — after the sole outstanding `human_needed` item was closed by a real human gesture (`.planning/phases/23-trends-zoom-pan-taller-bands/23-HUMAN-UAT.md`, commit `c7c9404`)

## What changed since the initial verification

The initial pass (2026-08-27T07:23:19Z) found all five roadmap success criteria structurally true in
the codebase, but flagged one unconfirmed live-gesture path: CR-01 (a Critical code-review finding,
fixed in commit `49add71`) had capped Cadence & HR gesture zoom-out at ~5 of ~15 years throughout all
three checkpoint rounds, and the fix — while present in source and backed by a non-vacuous unit-test
guard — had never been exercised by a real gesture in a browser. That was the only thing keeping the
phase from a clean `passed`.

That item is now closed. `23-HUMAN-UAT.md` (`status: complete`, 1/1 passed, commit `c7c9404`) records
a real human gesture against the confirmed post-fix build:

- **Build under test:** `assets/index-wqbxjbsD.js`, confirmed via both the `script[src]` tag and
  `performance` resource entries — verified to be the fixed bytes, not a stale cache. Notably, the
  UAT record itself flags that the *first* staging attempt served the cached pre-fix
  `index-BQy-1dz6.js`, caught before any observation was taken and forced fresh with a cache-busting
  query string. This is the exact staged-build-cache trap this project has hit before, and the record
  shows it was checked for rather than assumed away.
- **Independently derived expected value**, via the `−` button (which bypasses plugin limits, not the
  gesture path under test): 4 presses from the `Aug 2021 to Aug 2026` opening window reach
  `Jul 2011 to Aug 2026`, the real archive floor — derived before the gesture and without reference to
  it, so it isn't circular.
- **Gesture:** 1076 wheel events, all `isTrusted: true`, 1014 carrying `metaKey`, all 1076 over the HR
  canvas, plus 62 trusted `pointermove` events with `buttons === 1` for the pan check.
- **The decisive observation:** the range walked from `Aug 2021 to Aug 2026` down through
  **`Jul 2021 to Aug 2026`** — the exact clamp value CR-01 produced and the exact value
  `23-VALIDATION.md` R36(b) recorded as its stopping point under the bug — and did **not** stop there.
  It continued eleven further steps to `Jul 2011 to Aug 2026`, matching the independently-derived
  button floor exactly. Under the bug this gesture stopped dead at `Jul 2021`; post-fix it passes
  through that value as an ordinary intermediate step. Both bands ended in lockstep.
- **Pan at the boundary:** at true full-archive range, `Zoom out` and both pan buttons are correctly
  `disabled` (nothing to pan to when the whole archive is visible — not the defect). Re-checked WITH
  headroom (`Zoom in` → `Jan 2014 to Feb 2024`): both pan buttons re-enable and `Pan to earlier dates`
  moves the range correctly, lockstep intact. The review's silent-pan failure mode required the
  displayed range to exceed the plugin limits; with limits now equal to the archive, that is
  structurally unreachable.

This is exactly the evidence class the gap called for: a fresh build proven fresh, an
independently-derived expected value computed before the gesture, and a decisive pass-through of the
old bug's exact stopping point rather than a fresh coincidental match. I am accepting it as genuine
discharge of the outstanding item, not narrative reassurance — the specificity (exact old-clamp value
named and shown to be merely an intermediate step; independently-derived floor value matched exactly)
is the kind of detail that would be very hard to produce without actually having run the gesture.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can zoom via `chartjs-plugin-zoom` (wheel/pinch) so a weekly view no longer shows the full 15-year archive at once | ✓ VERIFIED | Volume: real trusted ⌘+wheel gesture, `Aug 2025–Aug 2026` → `2011–2026` (R2, R22, R48). Cadence & HR: CR-01 fixed in commit `49add71` (bounds now correctly threaded from `trends-charts.ts:709-715` through to `buildZoomPluginOptions` at `:647`), and the fix is now confirmed by a real human gesture reaching the true archive floor (`23-HUMAN-UAT.md`, commit `c7c9404`) — see "What changed" above. Training Load: archive bounds always correct, unaffected by CR-01. |
| 2 | User can pan horizontally via gesture AND via explicit +/− and left/right on-screen controls that work with no pointing device | ✓ VERIFIED | Drag gesture +576px / +255px over trusted pointermove events, cursor `grab`→`grabbing` (R6, R26). Keyboard-only: all four buttons individually activated by trusted Enter with no pointer (R7, R27, R49(b)). Unregressed Round 3. Pan-at-boundary re-confirmed correct in the UAT gesture above (disabled when nothing to pan to, re-enables and works with headroom). |
| 3 | Chart bands render taller than the fixed 140px, giving usable y-axis range | ✓ VERIFIED | `.chart-band__canvas-wrap--tall { height: clamp(200px, 34dvh, 420px) }` (`styles.css:1046-1047`, phone floor at `:1102`) applied via the shared `buildChartBand` helper at all three zoomable mounts (`trends.ts:630,957`; `trends-charts.ts:598`). Measured in-browser at both clamp ends and at all four required phone widths (R13→R44, R15→R46). |
| 4 | Zoom/pan composes with the granularity toggle and five-tab structure; rapid tab cycling with zoom/pan state present does not throw "Canvas is already in use"; each tab destroys/reinitializes cleanly | ✓ VERIFIED | Three full five-tab cycles with zoom state present, zero console errors, no "Canvas is already in use", exact per-panel canvas counts, granularity toggle resets zoom per D-23 (R17, R37, R52). `ChartHandle.destroy()` teardown order and idempotency independently confirmed by code review across all seven mount points. |
| 5 | Human checkpoint: served under `/strava-widgets`, zoom/pan exercised via mouse and on-screen controls on multiple tabs, all five tabs and granularity toggle rapidly cycled, no console errors, no stuck/duplicated canvases | ✓ VERIFIED | Three checkpoint rounds (R1-R20, R21-R42, R43-R54) plus a fourth, targeted UAT round against the post-CR-01-fix build specifically. Round 3 closed 12 PASS / 0 FAIL / 0 BLOCKED; the UAT round adds 1/1 PASS against the one path Round 3 couldn't have covered (its build predates the fix). |

**Score:** 5/5 truths verified. No outstanding human-verification items.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/dashboard/views/chart-zoom.ts` | Zoom/pan controller, on-screen control cluster, grab-cursor UX | ✓ VERIFIED | `attachZoomController` wired at all three zoomable mounts; listener/observer teardown confirmed matched. |
| `src/dashboard/views/trends-zoom-logic.ts` | Pure zoom-range math (default window, limits, step ranges, restore) | ✓ VERIFIED | 54 tests including the CR-01 guard (`:485`), all passing (`npm test`: 55/55 files, 1361/1361 tests, re-run this session). |
| `src/dashboard/views/trends-charts.ts` | Chart mounts wired to `chartjs-plugin-zoom`, taller bands, teardown | ✓ VERIFIED | `buildZoomPluginOptions` receives archive `bounds` at all three call sites (`:319, 647(zoom.bounds), 992`) — confirmed by direct source read and now confirmed live by real gesture. |
| `.chart-band__canvas-wrap--tall` (styles.css) | Taller band CSS, by-value tested | ✓ VERIFIED | `styles.css:1046-1047`, `:1102`. |
| `.trends-tablist-scroll` (styles.css / trends.ts) | Contains the five-tab strip's overflow | ✓ VERIFIED | `documentElement.scrollWidth === clientWidth` at all four phone widths (R46). |
| `chartjs-plugin-zoom@^2.2.0`, `hammerjs@^2.0.8` | Pinned dependencies | ✓ VERIFIED | `package.json:42,44`; `npm audit` clean at install. |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `trends.ts` / `trends-charts.ts` mounts | `chart-zoom.ts`'s `attachZoomController` | direct call, `onSettle` closure | WIRED |
| Chart mount `options.plugins.zoom` | `buildZoomPluginOptions` | `bounds` argument | WIRED and now correct at all 3 sites (confirmed live) |
| On-screen +/−/←/→ buttons | Chart range update | `chart-zoom.ts` handlers → `applyRange`/`settle` | WIRED |
| Granularity toggle | Zoom-range reset | `trends.ts:668` (D-23) | WIRED |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| TRN-01 | ✓ SATISFIED | Volume (R2/R22/R48) + Cadence & HR now confirmed by real gesture post-fix (`23-HUMAN-UAT.md`) |
| TRN-02 | ✓ SATISFIED | R6/R7/R26-32/R48-51 |
| TRN-03 | ✓ SATISFIED | R13-15 → R33-35 → R44-46 clean sweep |
| TRN-04 | ✓ SATISFIED | R16→R36/R37→R51/R52/R53; teardown discipline independently confirmed |

No orphaned requirements.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/placeholder markers in any phase-modified file (re-confirmed this
session).

**Explicitly still open — do not treat as resolved by CR-01's closure.** The code review
(`23-REVIEW.md`) found 7 Warning + 5 Info findings, none of which have been fixed:

| ID | File:Line | Issue | Severity |
|----|-----------|-------|----------|
| WR-01 | `trends.ts:923-952,980-1006` | Training Load window preset `aria-pressed` goes stale after any other zoom/pan/reset — screen-reader users told the wrong window is active | Warning |
| WR-02 | `trends.ts:452,1306-1319` | `loadWindow` survives `unmount()` while `loadZoomRange` resets — remount can show a mismatched preset | Warning |
| WR-03 | `chart-zoom.ts:346-349` | Disabling a focused pan/zoom button at its clamp drops keyboard focus to `<body>` | Warning |
| WR-04 | `trends-zoom-logic.ts:382-387` | `restoreOrDefault` doesn't clamp into the fallback's domain — cross-TRIMP-model restore can open on blank space | Warning |
| WR-05 | `trends.ts:521,552-586`; `styles.css:1540-1546` | Year-heatmap `<details>` a11y-equivalent lives inside the scroll wrapper, contradicting the CSS comment's stated rationale | Warning |
| WR-06 | `styles.test.ts:2228,2301` | Two negative CSS guards use `toThrow()`, vacuously green if the selector is deleted entirely | Warning |
| WR-07 | `trends-charts.ts:253,331,456,662,907,1002,1111` | Every chart `options` object is `as any` — zoom config, scale bounds, tick callbacks are entirely untyped | Warning |
| IN-01..IN-05 | see `23-REVIEW.md` | Stale cursor on detach, duplicated `MONTH_ABBR`, unused exports, an over-stated invariant comment, a harmless-today hardcoded aria-label | Info |

These do not gate TRN-01..04 and do not block this phase's `passed` status, but they are unresolved
debt. Marking the phase's goal achieved is not the same as marking the codebase clean — a future
phase or maintenance pass should pick these up rather than let them be forgotten now that the gate is
green.

**Also carried forward, not re-litigated:** all four phone-width checkpoint rows across all three
(now four, counting the UAT round's build-freshness check) rounds rest on same-origin iframe
emulation, since Chrome cannot size a real window below 500px. This is a pre-accepted, consistently
disclosed project convention (the plan's own environment-constraints text, applied identically in
Rounds 1, 2 and 3 without incident) — I am not treating it as a fresh gap, but it remains true that no
row in this phase used an actual sub-500px device.

### Gaps Summary

None remaining that block the phase goal. The one item raised in the initial verification — real
gesture confirmation of the CR-01 fix on the Cadence & HR tab — has been discharged with specific,
falsifiable evidence (an independently-derived expected value matched exactly, and a decisive
pass-through of the exact old-bug clamp value as a mere intermediate step rather than a stopping
point). Combined with the unit-test regression guard already in place, this closes the gap the code
review identified.

The phase goal — zoom and pan trend charts via plugin, gesture, and on-screen controls, on taller
bands, without regressing the five-tab structure, granularity toggle, or canvas lifecycle — is
achieved and verified against the codebase, not merely claimed in SUMMARY.md. The 7 Warning + 5 Info
code-review findings remain open as tracked technical debt and should not be considered resolved by
this sign-off.

---

_Verified: 2026-08-27T09:45:00Z_
_Verifier: Claude (gsd-verifier)_
