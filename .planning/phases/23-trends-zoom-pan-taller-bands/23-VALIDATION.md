---
phase: 23
slug: trends-zoom-pan-taller-bands
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-19
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `23-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~2s quick / full suite per existing baseline |

**Hard constraint on what automation can observe here:** there is **no jsdom, no headless
browser, and no canvas polyfill anywhere in this repo** (confirmed by direct read of
`vitest.config.ts`, and by the absence of any `trends.test.ts` / `trends-charts.test.ts` —
only pure `*-logic.ts` modules have `.test.ts` siblings today). Chart.js cannot construct a
chart without a 2D rendering context. Every rendering, gesture, and canvas-lifecycle claim in
this phase is therefore **browser-checkpoint-only** and cannot be discharged by any automated
command. Plans must be written so the automatable logic is extracted into a pure module.

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts`
- **After every plan wave:** `npm test`
- **Before `/gsd-verify-work`:** `npm test` + `tsc` + `npm run build-widgets` all green,
  **and** the browser checkpoint rows below observed
- **Max feedback latency:** < 5 seconds (quick run, pure logic only)

---

## Per-Task Verification Map

> Task IDs assigned by the planner on 2026-08-19. Plan 23-07 Task 1 sets each Status once
> the command has actually been run in that session; plan 23-07 Task 2's rows R1-R20 carry every
> manual claim.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01/T3 | 23-01 | 1 | TRN-01 | — | N/A | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "computeDefaultWindow"` | ✅ | ✅ green |
| 23-01/T3 | 23-01 | 1 | TRN-01 | — | N/A | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "computeLimits"` | ✅ | ✅ green |
| 23-01/T3 | 23-01 | 1 | TRN-02 | — | N/A | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "panDeltaPx|zoomFactor"` | ✅ | ✅ green |
| 23-01/T3 | 23-01 | 1 | TRN-02 | — | N/A | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "formatRangeLabel"` | ✅ | ✅ green |
| 23-01/T3 | 23-01 | 1 | TRN-04 | — | N/A | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "restoreOrDefault"` | ✅ | ✅ green |
| 23-02/T2 | 23-02 | 1 | TRN-03 | — | N/A | unit (rule scanner, by VALUE) | `npx vitest run src/dashboard/styles.test.ts -t "chart-band__canvas-wrap--tall"` | ✅ | ✅ green |
| 23-02/T2 | 23-02 | 1 | TRN-03 | — | N/A | unit (regression guard) | `npx vitest run src/dashboard/styles.test.ts -t "IN-06"` | ✅ `styles.test.ts:1928` | ✅ green |
| 23-01/T1 | 23-01 | 1 | — | T-23-SC (Tampering) | Pinned, audited `chartjs-plugin-zoom` + `hammerjs` versions | build | `npm audit` at install time | ✅ | ✅ green |
| 23-03/T1,T2 | 23-03 | 2 | TRN-03 | T-23-DETAIL | Shared `.chart-band__canvas-wrap` rule untouched | source assertion + gate | `npx tsc --noEmit && npm test && npm run build-widgets` | ✅ | ✅ green |
| 23-04/T1,T2,T3 | 23-04 | 2 | TRN-01, TRN-02 | T-23-A11Y | Every button handler calls the settle updater directly (Pitfall 3) | source assertion + gate | `npx tsc --noEmit && npm test && npm run build-widgets` | ✅ | ✅ green |
| 23-05/T1,T2,T3 | 23-05 | 3 | TRN-01, TRN-02, TRN-04 | T-23-CANVAS, T-23-LAZY | Plugin per-instance only, never `Chart.register`; no persistence | source assertion + gate | `npx tsc --noEmit && npm test && npm run verify-dashboard` | ✅ | ✅ green |
| 23-06/T1,T2,T3 | 23-06 | 4 | TRN-01, TRN-04 | T-23-REGRESS | `sliceLoadWindow` retired; every other export intact | source assertion + gate | `npx tsc --noEmit && npm test && npm run build-widgets` | ✅ | ✅ green |
| 23-07/T1 | 23-07 | 5 | TRN-01..04 | T-23-LAZY, T-23-STALE | Entry chunk carries no Hammer; served build provably fresh | build-artifact assertion | `npm test && npx tsc --noEmit && npm run build-widgets && npm run verify-dashboard` | ✅ | ✅ green |
| 23-07/T2 | 23-07 | 5 | TRN-01..04 | T-23-EVIDENCE | 20 non-waivable browser rows, each with its own stated proof | manual-only (blocking checkpoint) | — none; see Manual-Only Verifications below | N/A | ⬜ pending |

*Status column above reflects this session's actual run (2026-08-19, plan 23-07 Task 1): `npm test` 54/54 files, 1313/1313 tests, all 5 `trends-zoom-logic.test.ts` `-t` filters and both `styles.test.ts` filters passed within that run; `npm audit` re-confirmed no advisory names `chartjs-plugin-zoom` or `hammerjs`; `npx tsc --noEmit` clean; `npm run build-widgets` succeeded; `npm run verify-dashboard` 37/37. Only the 23-07/T2 row (the browser checkpoint) remains pending — it is this plan's Task 2.*

---

## Expected read-back values (Round 1)

> Computed 2026-08-19 in this session, BEFORE any browser was opened, per D-25's advance-computation
> discipline. Recomputed against the live archive as it stands right now (worktree base commit
> `97384a3`, `data/stats/*.json` copied in from the main checkout for this session only, gitignored,
> not committed). The archive's last entries match the 2026-08-19 snapshot the plan's own text
> anticipated exactly — **no drift, no discrepancy to record**: last weekly bucket `weekStartISO:
> "2026-08-10T00:00:00.000Z"`, last monthly `periodStart: "2026-08-01T00:00:00.000Z"`, last yearly
> `periodStart: "2026-01-01T00:00:00.000Z"`, last training-load day `date: "2026-08-11"`.
>
> Computed with a standalone Node script re-implementing `trends-zoom-logic.ts`'s exact formulas
> (`computeArchiveBounds`, `computeFullRange`, `computeDefaultWindow`, `loadWindowRange`,
> `formatRangeLabel`, the D-12 zoom-factor/pan-fraction arithmetic) against the real archive JSON —
> not assumed from the plan text. Every value below matches the plan's own pre-stated expectation
> exactly.

| Tab / state | Expected canvas `aria-label` (verbatim) | Expected first x-axis tick | Expected last x-axis tick |
|---|---|---|---|
| Volume weekly, default (D-06 opening window) | `Weekly distance chart, Aug 2025 to Aug 2026` | Aug 2025 | Aug 2026 |
| Volume monthly, default (D-06 opening window) | `Monthly distance chart, Aug 2021 to Aug 2026` | Aug 2021 | Aug 2026 |
| Volume yearly, default (= full range, D-06) | `Yearly distance chart, Jul 2010 to Jul 2026` | Jul 2010 | Jul 2026 |
| Volume weekly, after one `+` (zoom in ×1.5 from default) | `Weekly distance chart, Oct 2025 to Jun 2026` | Oct 2025 | Jun 2026 |
| Volume weekly, after one `←` (pan earlier 25% of visible span from default) | `Weekly distance chart, May 2025 to May 2026` | May 2025 | May 2026 |
| Volume weekly, at full zoom-out (Reset-to-everything / `−` clamp) | `Weekly distance chart, Aug 2011 to Aug 2026` | Aug 2011 | Aug 2026 |
| Training Load, 12mo default | `Training load chart: CTL, ATL, and TSB over time, Aug 2025 to Aug 2026` | Aug 2025 | Aug 2026 |

**Aria-label base strings** (from `src/dashboard/views/trends-charts.ts`'s existing `VOLUME_ARIA_LABELS`
mechanism, extended by `withRangeSuffix`): `Weekly distance chart`, `Monthly distance chart`,
`Yearly distance chart`, `Training load chart: CTL, ATL, and TSB over time`.

---

## Lazy chunk boundary proof (T-23-LAZY, Round 1)

> Proven against the built artifact, not assumed from the static import graph.

- Entry script (read from `dist/widgets/index.html`'s module `<script>` tag):
  **`assets/index-D2l-GZfl.js`**
- `grep -c "Hammer" "dist/widgets/assets/index-D2l-GZfl.js"` → **`0`**
- Newest `dist/widgets/assets/trends-charts-*.js` chunk by modification time:
  **`assets/trends-charts-BFx4OoZH.js`**
- `grep -c "Hammer" "dist/widgets/assets/trends-charts-BFx4OoZH.js"` → **`1`**
- **Caveat (stated per the plan's own instruction):** minifiers preserve legal-comment banners and
  property names, so `Hammer` is a reliable marker; a `0` on the entry chunk together with a
  non-zero count on the trends chunk is the proof that `trends.ts`'s static import graph never pays
  for Hammer or the zoom plugin — the entry chunk is genuinely lighter, not just apparently so.

---

## Staged build (Round 1)

- Built via `npm run build-widgets` in this session (worktree base `97384a3`).
- Served via `python3 -m http.server 8099` from `/tmp/strava-serve`, with `/tmp/strava-serve/strava-widgets`
  symlinked to this worktree's `dist/widgets`, so the URL path shape matches production
  (`/strava-widgets/...`) exactly.
- **Note:** a STALE `python3 -m http.server` process from an unrelated prior session was found
  already bound to port 8099 (cwd `/private/tmp/gh-pages`, unrelated content) before this plan's own
  server was started. It was killed and a fresh server was started serving this session's own build,
  per T-23-STALE's own mitigation — this is exactly the failure mode R1 exists to catch, caught here
  before the checkpoint even started.
- Confirmed reachable: `curl -sI http://127.0.0.1:8099/strava-widgets/` → `HTTP/1.0 200 OK`.
- Confirmed fresh: `curl -s http://127.0.0.1:8099/strava-widgets/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'`
  → `assets/index-D2l-GZfl.js`, matching the entry filename recorded above verbatim.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/dashboard/views/trends-zoom-logic.ts` — new pure module holding D-06 default-window
      computation, D-09 limits computation, D-12 zoom-factor / pan-pixel-delta math, D-13
      range→label formatting, and D-22 restore-or-default state shape. **This extraction is
      what makes any of this phase automatable at all** — logic left inline in `trends.ts`
      is unreachable by this repo's test setup.
- [ ] `src/dashboard/views/trends-zoom-logic.test.ts` — unit-test sibling, following the
      existing `*-logic.test.ts` pattern exactly.
- [ ] New case(s) in the existing `src/dashboard/styles.test.ts` asserting the
      `.chart-band__canvas-wrap--tall` rule **by value, not existence** — per that file's own
      `WR-03` precedent (`styles.test.ts:2029` comments on why existence-only assertions are
      insufficient).
- [ ] No framework install needed — Vitest is present and configured. The gap is test *files*,
      not test *infrastructure*.

---

## Manual-Only Verifications

> Every row below is **non-waivable** and must be observed in a real browser served under
> `/strava-widgets`. Per STATE.md's Phase 22 record, checkpoint rows in this project have
> repeatedly been passed on substituted evidence; each row therefore states the exact
> observation that constitutes proof. Developer or orchestrator authority does **not** stand
> in for the stated observation.
>
> **Row agenda:** `23-07-PLAN.md` Task 2 expands this table into 20 numbered rows
> (R1-R20), each carrying the expected read-back value computed in advance per D-25, plus a
> build-freshness prerequisite (R1) and an explicit row-to-requirement gating map. Run the
> checkpoint from that agenda, not from this table alone.

| Behavior | Requirement | Why Manual | Test Instructions (what counts as proof) |
|----------|-------------|------------|------------------------------------------|
| Wheel/pinch zoom actually changes the rendered x-range | TRN-01 | Chart.js needs a real 2D context; `environment: 'node'` has none | On the Volume tab at weekly granularity, ⌘/Ctrl + scroll up. Quote the x-axis first and last tick label **before and after**, and confirm they differ. |
| Bare wheel still scrolls the page (D-14) | TRN-01 | Requires real wheel-event delivery | With the cursor **over** a chart plot area, scroll without the modifier. State that the page scrolled and the chart x-range did **not** change (quote the unchanged first/last tick). |
| Default opening window is not the full archive (D-06) | TRN-01 | Rendering-dependent | On first load of the Volume tab at weekly, quote the first and last x-axis tick labels. They must span ≈12 months, not the full ~15-year archive. |
| Drag-to-pan works and cursor signals it (D-15) | TRN-02 | Pointer gesture + cursor style | Drag left across the plot area. Quote first/last tick before and after. State the observed cursor during drag (`grab` → `grabbing`). |
| All four buttons operate with **no pointing device at all** (D-11) | TRN-02 | Keyboard focus/activation is DOM behavior | Tab to each of `←` `→` `−` `+` and activate with Enter/Space. For **each of the four**, quote its `aria-label` and the x-range change it produced. |
| Buttons disable at their clamps (D-11) | TRN-02 | Rendered state | Press `−` until fully zoomed out; state that `−` is now disabled and quote its `disabled`/`aria-disabled` state. Pan to the archive start; state that `←` is disabled. |
| Reset appears only when zoomed, and restores the D-06 window (D-11) | TRN-02 | Rendered state | Confirm Reset is **absent** on first load. Zoom once; confirm it appears. Press it; quote the resulting first/last tick and confirm they match the D-06 default window, **not** full zoom-out. |
| `aria-label` names the visible range on settle (D-13) | TRN-02 | Live DOM attribute | After a **gesture** zoom and separately after a **button** zoom, quote the canvas `aria-label` verbatim both times. Both must name the new range — the button case is the one research flagged as silently broken if `onZoomComplete` alone is relied on. |
| Modifier hint is visible in the band header (D-17) | TRN-02 | Rendered text | Quote the hint text as rendered. |
| Bands render taller than 140px, viewport-relative (D-19) | TRN-03 | Layout/ResizeObserver behavior | Report the computed pixel height of `.chart-band__canvas-wrap--tall` at **two different window heights**, and confirm the values differ and both sit inside the chosen clamp bounds. |
| Cadence & HR's two stacked bands both get full height; tab scrolls (D-20) | TRN-03 | Layout | On the Cadence & HR tab, report the computed height of **both** bands and confirm they are equal, and that the tab scrolls. |
| Small-screen floor holds at real phone widths (D-21) | TRN-03 | Breakpoint behavior at specific widths | At **each** of 390px, 393px and 412px (state the emulation method), report the computed band height and confirm no horizontal overflow. Naming a width other than the required one does not discharge the row — this is the exact substitution that reopened CAL-02 in Phase 22. |
| No "Canvas is already in use" under rapid tab cycling with zoom state present (TRN-04, success criterion 4) | TRN-04 | Console + canvas lifecycle | Zoom on ≥2 tabs, then cycle all five Trends tabs rapidly ≥3 full passes, toggling granularity in between. Paste the console output (must be empty of errors) and state the count of `<canvas>` elements in the DOM afterward (must equal the expected count, with no stranded duplicates). |
| Zoom state survives a tab switch, resets on unmount (D-22) | TRN-04 | State round-trip through destroy-and-rebuild | Zoom the Volume tab, switch away and back; quote first/last tick and confirm the zoom is preserved. Then fully remount the view; confirm it returned to the D-06 default. |
| Thin-HR-coverage shading still draws correctly at every zoom level (18-D15) | TRN-04 | Rendering | On Cadence & HR, zoom into a known thin-coverage span and state that the shading still renders over the correct region. |
| LTTB decimation resolves to daily granularity at deep zoom on Training Load (D-03b) | TRN-01 | Open question research could not settle | Zoom deeply on Training Load; state whether the series resolves to finer granularity or stays decimated. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the `trends-zoom-logic.ts` extraction above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Every Manual-Only row above observed with its **stated** proof, not a substitute
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
