---
phase: 23
slug: trends-zoom-pan-taller-bands
status: partial
nyquist_compliant: false
wave_0_complete: true
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
| 23-01/T3 | 23-01 | 1 | TRN-02 | — | N/A | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "zoomStepRange and panStepRange"` | ✅ | ✅ green |
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
| 23-07/T2 | 23-07 | 5 | TRN-01..04 | T-23-EVIDENCE | 20 non-waivable browser rows, each with its own stated proof | manual-only (blocking checkpoint) | — none; see Manual-Only Verifications below | N/A | ✅ green (Round 1 closed 2026-08-26, see below) |
| 23-08/T1 | 23-08 | 6 | TRN-02 | — | `zoomStepRange`/`panStepRange` pinned to the design-intent date strings (Finding 1 fix) | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "zoomStepRange and panStepRange"` | ✅ | ✅ green (12 passed) |
| 23-08/T2 | 23-08 | 6 | TRN-02, TRN-04 | — | `buildZoomPluginOptionsShape` nests `onZoomComplete`/`onPanComplete` inside `zoom`/`pan` (Finding 10 fix) | unit | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "buildZoomPluginOptionsShape"` | ✅ | ✅ green (4 passed) |
| 23-08/T3 | 23-08 | 6 | TRN-02, TRN-04 | — | Source-text guard pinning `chartjs-plugin-zoom@2.2.0`'s own `.zoom.`/`.pan.`-qualified lookup paths | unit (source-text guard) | `npx vitest run src/dashboard/views/trends-zoom-logic.test.ts -t "chartjs-plugin-zoom option lookup contract"` | ✅ | ✅ green (2 passed) |
| 23-09/T1 | 23-09 | 6 | TRN-03 | — | `.year-heatmap-scroll` containment wrapper pinned by value (3 declarations + 634px arithmetic) | unit (rule scanner, by VALUE) | `npx vitest run src/dashboard/styles.test.ts -t "year-heatmap-scroll"` | ✅ | ✅ green (6 passed, covers both T1's and T2's assertions in one describe block) |
| 23-09/T2 | 23-09 | 6 | TRN-03 | — | `buildYearHeatmapSection`'s `gridWrap` actually carries the new class (consumer guard) | unit (consumer guard) | `npx vitest run src/dashboard/styles.test.ts -t "year-heatmap-scroll"` | ✅ | ✅ green (same 6/6 run as T1 — the consumer-guard assertion lives in the same describe block) |
| 23-10/T1 | 23-10 | 6 | TRN-01 | — | `tickGranularityForStep`/`formatTimeAxisTick`/`stepMsFromTicks` implement the never-duplicate-a-label invariant (Finding 7 fix) | unit (TDD) | `npx vitest run src/dashboard/views/trends-tick-format.test.ts` | ✅ | ✅ green (16 passed) |
| 23-10/T2 | 23-10 | 6 | TRN-01 | — | All five Trends x-axis tick callbacks route through `formatAdaptiveTimeTick`/`stepMsFromTicks` | source assertion + gate | `npx tsc --noEmit && npm test && npm run build-widgets` | ✅ | ✅ green (this session's step (b) run) |
| 23-10/T3 | 23-10 | 6 | TRN-04 | — | `observeCanvasResize` attached at all seven chart mounts with matching `destroy()` teardown (Finding 8 fix) | source assertion + gate | `npx tsc --noEmit && npm test && npm run build-widgets && npm run verify-dashboard` | ✅ | ✅ green (this session's step (b) run) |
| 23-11/T2 | 23-11 | 7 | TRN-01..04 | T-23-EVIDENCE-R2, T-23-PRESSURE | 22 non-waivable browser rows (R21-R42), each with its own stated proof | manual-only (blocking checkpoint) | — none; see Round 2 checkpoint record below | N/A | ⬜ pending |

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

- [x] `src/dashboard/views/trends-zoom-logic.ts` — new pure module holding D-06 default-window
      computation, D-09 limits computation, D-12 zoom-factor / pan-pixel-delta math, D-13
      range→label formatting, and D-22 restore-or-default state shape. **This extraction is
      what makes any of this phase automatable at all** — logic left inline in `trends.ts`
      is unreachable by this repo's test setup.
- [x] `src/dashboard/views/trends-zoom-logic.test.ts` — unit-test sibling, following the
      existing `*-logic.test.ts` pattern exactly.
- [x] New case(s) in the existing `src/dashboard/styles.test.ts` asserting the
      `.chart-band__canvas-wrap--tall` rule **by value, not existence** — per that file's own
      `WR-03` precedent (`styles.test.ts:2029` comments on why existence-only assertions are
      insufficient).
- [x] No framework install needed — Vitest is present and configured. The gap is test *files*,
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
| Thin-HR-coverage shading still draws correctly at every zoom level (18-D15) | TRN-04 | Rendering | On **Training Load** (the shading plugin is attached there, `trends-charts.ts` `createThinCoverageShadingPlugin`; this table previously said Cadence & HR — the 23-07 row agenda is authoritative), zoom into a known thin-coverage span and state that the shading still renders over the correct region. |
| LTTB decimation resolves to daily granularity at deep zoom on Training Load (D-03b) | TRN-01 | Open question research could not settle | Zoom deeply on Training Load; state whether the series resolves to finer granularity or stays decimated. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the `trends-zoom-logic.ts` extraction above)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [ ] Every Manual-Only row above observed with its **stated** proof, not a substitute
      — **NOT met.** Round 1 closed with 5 BLOCKED rows (R2, R6, R11, R13, R15).
- [ ] `nyquist_compliant: true` set in frontmatter — **NOT met** (2 FAIL, 5 BLOCKED).

**Approval:** Round 1 recorded 2026-08-25 — **partial**. 13 PASS / 2 FAIL / 5 BLOCKED.
All four TRN requirements stay Pending; see the Round 1 requirement-gating table below.

---## Round 1 — checkpoint record (COMPLETE)

> Round 1 opened 2026-08-20 (evidence log, verdicts pending), was partially closed 2026-08-25
> with 5 rows BLOCKED, and was **fully closed 2026-08-26** — every row now carries a verdict
> backed by its own stated observation. Verdict vocabulary: PASS / FAIL / BLOCKED /
> NOT EXERCISABLE (Phase 20). **No row remains BLOCKED.**
>
> **Build freshness.** The 2026-08-20 staged tree was a symlink into the 23-07 worktree and was
> destroyed when that worktree merged. On 2026-08-25 the gate was re-run green in full
> (`npm test` 54 files / 1313 tests; `npx tsc --noEmit` exit 0; `npm run build-widgets` after
> `rm -rf dist/widgets`; `npm run verify-dashboard` 37 checks, 0 failures), the entry asset
> reproduced **identically** as `assets/index-D2l-GZfl.js`, and the lazy chunk boundary was
> re-proved (entry `Hammer` = 0; `assets/trends-charts-BFx4OoZH.js` `Hammer` = 1, and after the
> clean rebuild that is the ONLY `trends-charts-*.js` chunk on disk). Re-staged from the main
> checkout (not a worktree) at `http://127.0.0.1:8099/strava-widgets/`.
>
> **Archive unchanged** since Task 1's recomputation — last weekly `2026-08-10`, monthly
> `2026-08-01`, yearly `2026-01-01`; last commit touching `data/stats/` is `fe53914`
> (2026-08-09). The "Expected read-back values (Round 1)" table above still stands.
>
> **Source key.** `machine-observed` = read out of the real browser at
> `http://127.0.0.1:8099/strava-widgets/` via instrumented DOM/canvas reads. `developer-gesture,
> machine-read` = the developer performed the physical gesture and the resulting values were read
> back off the live canvas — the strongest evidence class available for a gesture row, since the
> gesture is genuinely human and the readback is not a human summary.
>
> **How the five 2026-08-25 BLOCKED rows were closed.** R13(b) and R15 were closed under Chrome
> DevTools device emulation in **Responsive** mode (a device *preset* was rejected first because it
> produced an internally inconsistent viewport — `matchMedia('(max-width: 430px)')` true at
> `innerWidth` 682, and `100dvh` 326 against `innerHeight` 571). Under emulation
> `window.innerWidth`/`innerHeight` read STALE; `document.documentElement.clientWidth`/`clientHeight`
> and `100dvh` are authoritative and were cross-checked against `matchMedia` at every width before
> any value was recorded. R2, R6 and R11 were closed by the developer performing the real gesture
> while the canvas was instrumented — 84 trusted `wheel` events all carrying `metaKey: true` for
> R2/R11, and a measured single drag of +576px over 119 `pointermove` events for R6.
>
> **A test-design error, corrected and recorded.** R6 was first attempted as a leftward drag, per
> the row's own wording, and moved nothing across 582px. That is CORRECT behaviour, not a defect:
> at the D-06 default window the chart already ends at the newest data, so the later-dates
> direction is clamped — `Pan to later dates` reads `disabled: true` there, exactly as R9(a)
> independently recorded. Re-run rightward (the unclamped direction), the pan worked. Recorded so
> the false-negative is auditable and so the row's wording can be fixed in a later round.

| Row | Verdict | Source | Evidence as the row demanded it |
|-----|---------|--------|----------------------------------|
| R1 | **PASS** | machine-observed | Served page loaded `assets/index-D2l-GZfl.js` — read back live two ways: the module `<script src>` and the `performance` resource entry, both `http://127.0.0.1:8099/strava-widgets/assets/index-D2l-GZfl.js`. Matches the freshly built entry verbatim. |
| R2 | **PASS** | developer-gesture, machine-read | Volume weekly. **Before:** first tick `13 Aug 2025`, last tick `13 Aug 2026`. Developer held ⌘ and scrolled over the plot area — **84 wheel events, every one `isTrusted: true` with `metaKey: true`** (verified on a capture-phase listener). **After:** first tick **`11 Aug 2011`**, last tick `13 Aug 2026`. The ticks differ, which is what the row requires. (Direction note: macOS natural scrolling delivers `deltaY: +1` for "scroll up", and the plugin maps `deltaY >= 0` to zoom-out, so the range widened to the full archive.) |
| R3 | **PASS** | machine-observed | Bare wheel over plot area: page scrolled `scrollY 0 → 300`; chart range unchanged, label `Weekly distance chart, Dec 2025 to Mar 2026` before and after. |
| R4 | **PASS** | machine-observed | Fresh Volume weekly: `Weekly distance chart, Aug 2025 to Aug 2026` — matches the expected table; contains no 2011. Ticks `13 Aug 2025` … `13 Aug 2026`. |
| R5 | **PASS** | machine-observed | Monthly `Monthly distance chart, Aug 2021 to Aug 2026`; Yearly `Yearly distance chart, Jul 2010 to Jul 2026`. Both match the expected table. |
| R6 | **PASS** | developer-gesture, machine-read | Cursor **at rest `grab`**; **during drag `grabbing`**, captured on `pointerdown` and on six consecutive `pointermove` samples via `getComputedStyle`, returning to `grab` after release — not eyeballed. Drag measured at **+576px over 119 `pointermove` events** on a 1018px plot (57% of width). **Before:** first `13 Aug 2025`, last `13 Aug 2026`. **After:** first **`22 Nov 2024`**, last **`22 Nov 2025`** — panned ≈9 months earlier. See the test-design note above for the clamped-direction false negative. |
| R7 | **PASS** | machine-observed | Four individual real Enter/Space activations. `←`: `Aug 2025 to Aug 2026` → `Apr 2025 to Apr 2026`. `→`: → `Aug 2025 to Aug 2026`. `+`: → `Nov 2025 to May 2026`. `−` (×14): → `Aug 2011 to Aug 2026`. Tab-order trail reached `Pan to earlier dates`, `Zoom out`, `Zoom in`; `→` correctly skipped while disabled. |
| R8 | **FAIL** | machine-observed | Direction is **not** inverted and the `←`/`→` round-trip returned exactly to the default. But the magnitude misses the expected table: after `←` observed `Apr 2025 to Apr 2026` against the expected `May 2025 to May 2026`. See Finding 1. |
| R9 | **PASS** | machine-observed | (a) Fresh weekly: `→` disabled (`Pan to later dates` `disabled: true`), `←` enabled. (b) At the clamp: `Weekly distance chart, Aug 2011 to Aug 2026` (matches the full-zoom-out expected row); `−`, `←`, `→` all disabled, `+` enabled; ticks `11 Aug 2011` … `13 Aug 2026`. |
| R10 | **PASS** | machine-observed | (a) Reset absent on fresh load (present in DOM but zero-size, `getBoundingClientRect()` `{x:0,y:0}`). (b) Appears after `+`. (c) Reset → `Weekly distance chart, Aug 2025 to Aug 2026` — the **DEFAULT**, not the `Aug 2011 to Aug 2026` full zoom-out. Note: (b) holds for the **button** path the row specifies; after a *gesture* zoom Reset never appears at all — see R11 and Finding 10. |
| R11 | **FAIL** | developer-gesture, machine-read | Button half **passes**: the `aria-label` updates after `+`, `−`, `←`, `→` (quoted in R7). Gesture half **fails**: after the developer's real ⌘+wheel the canvas rendered ticks `11 Aug 2011` … `13 Aug 2026` while its `aria-label` still read **`Weekly distance chart, Aug 2025 to Aug 2026`**, and the control cluster still showed only `← → − +` with **no Reset**. Reproduced on the pan path too (R6: ticks moved to `22 Nov 2024`…`22 Nov 2025`, label unchanged). Root cause isolated — see **Finding 10**. This is precisely the defect the plan predicted would be "silently broken if `onZoomComplete` alone were relied on". |
| R12 | **PASS** | machine-observed | Hint rendered verbatim as `⌘ + scroll to zoom · drag or pinch to pan`, in the **"Distance"** band header. |
| R13 | **PASS** | machine-observed | (a) `window.innerHeight` **600** exactly, computed height **204px** = 34% of 600, at width 1200, method window resize. (b) Closed 2026-08-26 under DevTools **Responsive** emulation at **1200 × 1400**: `clientHeight` **1400**, `100dvh` **1400** (agreeing, so the viewport is internally consistent), `clientWidth` **1200** with `matchMedia('(max-width: 430px)')` **false** so the phone override is genuinely out of play. 34dvh would be **476px**, above the ceiling; computed `.chart-band__canvas-wrap--tall` height read **exactly `420px`**. The floor side tracks the viewport and the ceiling side binds — both ends of the clamp exercised. |
| R14 | **PASS** | machine-observed | Both Cadence & HR bands reported individually: **200px** and **200px** (at `innerHeight` 552); tab scrolls. |
| R15 | **FAIL** | machine-observed | All four widths observed individually under DevTools **Responsive** emulation (layout width read from `clientWidth`, cross-checked against `matchMedia` at each). The D-21 band floor **holds everywhere**: **390px → 240px**, **393px → 240px**, **412px → 240px**, **430px → 240px**, each = 30dvh of 800, inside `clamp(160px, 30dvh, 260px)`; the chart canvas itself reflows correctly at every width (260/263/282/300 px wide inside its 294/297/316/334 px column). The boundary is exact: at 430px `(max-width: 430px)` is true and `(min-width: 431px)` false. **But the row's non-waivable "confirm there is no horizontal overflow" clause fails at all four widths** — `document.documentElement.scrollWidth` is **682** against `clientWidth` 390/393/412/430 every time. Cause is the year heatmap: `.year-heatmap` `scrollWidth` **634** inside a container of 294/297/316/334. See Finding 9. |
| R16 | **FAIL** | both | Button zoom (machine-observed): both canvases `Jul 2023 to Sep 2024` — identical, lockstep holds. Wheel zoom over one band (developer-observed): "zooms in/out only the chart we're on", and after a deliberate ≥1s pause the other band "doesn't seem to catch up". Root cause now identified — see **Finding 10**: `settle()` never runs on the gesture path at all, and `settle()` is the only thing that propagates a range to the sibling member. |
| R17 | **PASS** | machine-observed | (a) Volume `Yearly distance chart, Jul 2016 to Jul 2020`; Training Load `Training load chart: CTL, ATL, and TSB over time, Nov 2025 to May 2026`. (b) After 3 full 5-tab passes both read identically — zoom survived. (c) weekly→monthly→weekly → `Weekly distance chart, Aug 2025 to Aug 2026`, the weekly default, Reset hidden (D-23 holds). (d) Zero app-origin console errors; specifically no "Canvas is already in use". (e) `tabpanel-volume:1, tabpanel-yoy:1, tabpanel-cadence-hr:2, tabpanel-training-load:1, tabpanel-gear:1`; `.chart-zoom-controls` count = **1**. |
| R18 | **PASS** | machine-observed | At `Training load chart: CTL, ATL, and TSB over time, Feb 2026 to Feb 2026` (≈11 days, "roughly a two-week span"), the series **does resolve to near-daily detail**: two adjacent tooltip readings gave `1,770,336,000,000` (2026-02-06) and `1,770,422,400,000` (2026-02-07) — a difference of exactly **86,400,000 ms = 1 day** — with individual point markers rendered. Supersedes the 2026-08-20 impression that it "stays smooth and simplified"; CTL/ATL/TSB are exponentially-weighted moving averages and are inherently smooth. See Finding 3 (WITHDRAWN). |
| R19 | **PASS** | machine-observed | Shading covers the **same dates** at both zoom levels. Zoomed out, `Training load chart: CTL, ATL, and TSB over time, Aug 2011 to Aug 2026`: widest shaded rect spans canvas-buffer x 144.14 → 717.26; anchoring x=144 ↔ data start 2011-08-16 and x=1674.64 ↔ data end 2026-08-11 (3.5764 days/px) gives **2011-08-16 → 2017-03-27**. Zoomed in, `… Apr 2016 to Mar 2018`: the same edge is at x=903.67; anchoring on the chart's own tooltip readout `1,489,622,400,000` (2017-03-16) at x=880 with 2.14 px/day gives **2017-03-27**. Both levels drew all **42** spans. |
| R20 | **PASS** | machine-observed | Zoomed to `Dec 2025 to Mar 2026` → navigated `#/records` → back to `#/trends` → `Weekly distance chart, Aug 2025 to Aug 2026`, the weekly default (D-22 reset on full remount). |

**Tally:** 16 PASS · 4 FAIL · 0 BLOCKED · 0 NOT EXERCISABLE.
(FAIL: R8, R11, R15, R16.)

### Requirement gating (strictly on the row map)

| Requirement | Mapped rows | Result | Blocking rows |
|-------------|-------------|--------|---------------|
| TRN-01 | R2, R3, R4, R5, R18 | **TICKED** | none — all five PASSED |
| TRN-02 | R6, R7, R8, R9, R10, R11, R12 | **Pending** | R8 (FAIL), R11 (FAIL) |
| TRN-03 | R13, R14, R15 | **Pending** | R15 (FAIL) |
| TRN-04 | R16, R17, R19, R20 | **Pending** | R16 (FAIL) |

TRN-01 is the first requirement in this phase to have every mapped row PASS, and is ticked.
The other three stay Pending on four located, reproducible defects — not on missing evidence.
`status: partial`, `nyquist_compliant: false` (a clean sweep is required for `true`).

### Findings (recorded, NOT patched — house rule 4)

**Finding 10 — NEW, ROOT CAUSE: the settle callbacks are nested one level too high, so no
gesture ever settles.** `buildZoomOptions()` in `chart-zoom.ts` returns `onZoomComplete` and
`onPanComplete` as **top-level siblings** of the `zoom` and `pan` option objects. chartjs-plugin-zoom
reads them from **inside** those objects — `state.options.zoom.onZoomComplete`
(`chartjs-plugin-zoom.esm.js` lines 388, 616, 674, 767) and `state.options.pan.onPanComplete`
(line 800). The plugin therefore never sees either callback and `settle()` is never invoked on any
gesture. Confirmed by direct observation, not inference: a real ⌘+wheel moved the rendered ticks to
`11 Aug 2011` … `13 Aug 2026` while the `aria-label` stayed `Weekly distance chart, Aug 2025 to
Aug 2026` and Reset never appeared; a real +576px drag moved the ticks to `22 Nov 2024` …
`22 Nov 2025` with the same frozen label. The wheel listener itself is correctly wired — a
synthetic `WheelEvent` with `metaKey` came back `defaultPrevented: true` (the plugin's own
`preventDefault()`, reached only after its modifier check passes), while `ctrlKey` and bare wheels
came back `false`, so `modifierKey: 'meta'` resolves and matches correctly.
**Impact:** a screen-reader user is told the chart shows a 12-month window while it renders 15
years, and Reset — the only escape from a gesture zoom — never appears. **Blocks TRN-02 via R11
and TRN-04 via R16.** This is the single highest-value fix in the phase; it is a nesting change,
and it subsumes Finding 4.

**Finding 1 — `+`/`−` step is a factor of 2, not the designed 1.5.** `chart-zoom.ts:401`
calls `chart.zoom(ZOOM_FACTOR)` with `ZOOM_FACTOR = 1.5`, but chartjs-plugin-zoom's
`linearZoomDelta` computes `newRange = range * (zoom - 1)` and *removes* that much:
`12 months × 0.5 = 6` removed, leaving 6. The design intent, and what `trends-zoom-logic.ts` is
unit-tested on, is `span / 1.5` = 8 months. Observed `Nov 2025 to May 2026` (6 months) against the
table's `Oct 2025 to Jun 2026` (8 months). Corroborated on Training Load: the full-zoom-out ladder
stepped 180 → 90 → 45 → 22 → 11 months, and the 12mo default halved to 6mo on the first `+`. The
pure module's arithmetic is tested; the runtime bypasses it by delegating to the plugin, so the
suite stays green while shipped behaviour differs. **Blocks TRN-02 via R8.**

**Finding 2 — WITHDRAWN.** An apparent stale aria-label after drag-pan was attributed to synthetic
pointer input failing to produce a gesture-end. **Note (2026-08-26): the original observation was
right and this withdrawal was wrong.** Finding 10 shows the label genuinely never updates after a
pan, on real human input. Retained as an audit trail of a retraction that should not have been made.

**Finding 3 — WITHDRAWN 2026-08-25.** Previously "decimation does not resolve at deep zoom", on the
impression that the Training Load series "stays smooth and simplified" at a ~2-week zoom. Direct
measurement contradicts it: adjacent tooltip points are exactly 86,400,000 ms apart, and point
markers are rendered. With ~11 points visible, far under `samples: 500`, Chart.js decimates nothing.
The smooth appearance is intrinsic to CTL/ATL/TSB being exponentially-weighted moving averages.
**No longer blocks TRN-01**; R18 is PASS.

**Finding 4 — SUPERSEDED BY FINDING 10.** "D-02 lockstep breaks on the gesture path" is confirmed as
a symptom, and its open question ("why does the button path sync while a gesture does not?") is now
answered: `settle()` propagates the range to the sibling member, and Finding 10 shows `settle()` is
never called on the gesture path at all. The button path syncs because its handlers call `settle()`
directly. Fixing Finding 10 should close R16; re-test rather than assuming.

**Finding 5 — OUT OF SCOPE for Phase 23: `avgCadenceRpm` ingestion stopped in Feb 2026.**
`avgCadenceRpm` is last populated `2026-02-02`; of the 59 activities after that date only 1 carries
cadence, while 57 of the same 59 carry `avgHr` (last `2026-08-11`). Cadence was healthy through late
2025 (~90–94 rpm). The chart renders the data faithfully — an ingestion defect, not a rendering one,
predating the August intervals.icu cutover. No Phase 23 row covers it; must NOT gate any TRN
requirement. Track separately.

**Finding 6 — OUT OF SCOPE for Phase 23: Training Load tooltip title renders a raw epoch.** Observed
at the 12mo default as `1,769,990,400,000` (2026-02-02) and at deep zoom as `1,489,622,400,000`
(2017-03-16). No `title` callback is defined for any tooltip in `trends-charts.ts`, so Chart.js falls
back to the raw x value, and the x scale is `type: 'linear'` with `parsing: false`. **Pre-existing,
not a Phase 23 regression** — `git show 61ee687:src/dashboard/views/trends-charts.ts` (last
pre-Phase-23 commit, `feat(18-15)`) already has both and no `title:` callback anywhere. Must NOT gate
any TRN requirement.

**Finding 7 — OUT OF SCOPE for Phase 23: x-axis tick labels do not adapt below month granularity.**
At an ≈11-day Training Load window all eight rendered ticks read `Feb 2026` — captured at
canvas-buffer x 144, 420.8, 648.4, 876, 1103.6, 1331.3, 1558.9, 1979.5. Same root-cause family as
Finding 6, but zoom is what exposes it. Worth a gap-closure item even though it gates nothing.

**Finding 8 — chart canvas does not re-fit when the viewport narrows.** After resizing from 1200px to
a 500px-wide viewport, the band wrapper correctly shrank to 370px but the canvas stayed at its
previous **770 × 206 CSS px** (buffer 1540 × 412), giving `scrollWidth` **835** vs `clientWidth`
**500**. A fresh load at the same 500px viewport sizes the canvas correctly at **370 × 223**, so this
is a resize-handling bug, not a narrow-width layout bug. Distinct from Finding 9, which survives a
reload. Gates nothing directly; recorded for gap closure.

**Finding 9 — the year heatmap overflows horizontally at every phone width.** Now upgraded from an
incidental observation to **the cause of R15's FAIL**. On fresh loads, `.year-heatmap` measures
`scrollWidth` **634** regardless of viewport — 634 at 390, 393, 412, 430 and 500px alike — against
containers of 294/297/316/334/404. It is a fixed-width grid (~53 weeks × ~12px) that never reflows,
so `document.documentElement.scrollWidth` is pinned at **682** and the page overflows at every real
phone width. Plausibly the same family as Phase 22's still-open CAL-02. **Blocks TRN-03 via R15.**

### R19 targets (retained for reference)

42 thin-coverage spans exist; most are 2–4 days wide, which is why they read as narrow and subtle.

| Span | Length |
|------|--------|
| 2011-08-16 → 2017-03-27 | 2051 days (the whole pre-HR-monitor era) — the one R19 used |
| 2020-02-25 → 2020-05-19 | 85 days |

---

## Round 2 — build, staging and expected values

> Run 2026-08-26 in this session, in the main checkout on branch `master` (no worktree — this
> plan's checkpoint must run against the real checkout, per its own execution instructions).
> Plans 23-08, 23-09 and 23-10 are all merged into `master` at this session's `HEAD`.

### (a) Port cleared before trusting anything

A process WAS already bound to port 8099: `python3 -m http.server 8099 --bind 127.0.0.1`
(pid 11541), cwd `/private/tmp/strava-serve`, whose `strava-widgets` entry was a symlink to
`/Users/pedf/workspace/strava-widgets/dist/widgets` — i.e. THIS session's own main checkout, not
an unrelated session and not a worktree. This is consistent with Round 1's own 2026-08-25
re-staging (`23-VALIDATION.md`'s Round 1 record: "Re-staged from the main checkout … at
`http://127.0.0.1:8099/strava-widgets/`"), left running since then. Because it pointed at
`dist/widgets` by symlink rather than a copy, it was already serving stale bytes relative to this
round's three merged fix plans until a fresh build landed under it. Killed (`kill 11541`) before
any gate command ran; `lsof -i :8099` confirmed the port free immediately after.

### (b) Clean rebuild and full gate

- `rm -rf dist/widgets` — removed.
- `npm test` → **55/55 test files, 1348/1348 tests, exit 0.**
- `npx tsc --noEmit` → **exit 0.**
- `npm run build-widgets` → **exit 0** (all ten widgets, four standalone pages, and the dashboard
  SPA built cleanly; private-artifact scan: 5587 published JSON files scanned, none contain
  identity/health fields).
- `npm run verify-dashboard` → **37/37 checks passed, 0 failures, exit 0** — matches Round 1's
  37-check baseline exactly (no check added or removed by 23-08/09/10).

### (c) Proof the build is NEW

Read from `dist/widgets/index.html`'s module `<script src>` and stylesheet `<link>`:

- Entry script: **`assets/index-D01ardNQ.js`**
- Stylesheet: **`assets/index-Duibt5wO.css`**

Both differ from Round 1's entry `assets/index-D2l-GZfl.js`, which reproduced byte-identically
across two separate Round 1 rebuilds. **This round's hash is new**, confirming the 23-08/09/10
fixes are actually present in the built artifact — an unchanged hash would have meant otherwise,
per this task's own stop-and-investigate instruction, which did not trigger.

### (d) Lazy chunk boundary re-proof (T-23-LAZY)

- `grep -c "Hammer" dist/widgets/assets/index-D01ardNQ.js` → **`0`**
- Newest `dist/widgets/assets/trends-charts-*.js` chunk (the only one on disk after the clean
  rebuild): **`assets/trends-charts-CfzuCWdi.js`**
- `grep -c "Hammer" dist/widgets/assets/trends-charts-CfzuCWdi.js` → **`1`**
- **Minifier caveat (restated per Round 1):** minifiers preserve legal-comment banners and
  property names, so `Hammer` remains a reliable marker; `0` on the entry chunk together with a
  non-zero count on the trends chunk proves `trends.ts`'s static import graph still never pays for
  Hammer or the zoom plugin — 23-08's fix to `chart-zoom.ts`'s option-building did not add a new
  static import of either, and 23-10's `trends-tick-format.ts` (confirmed pure, no imports at all)
  cannot have dragged either dependency across the boundary either.

### (e) Expected read-back values (Round 2)

**Archive-unchanged re-check (before any browser was opened, D-25):** last weekly bucket
`weekStartISO: "2026-08-10T00:00:00.000Z"`, last monthly `periodStart: "2026-08-01T00:00:00.000Z"`,
last yearly `periodStart: "2026-01-01T00:00:00.000Z"`, last training-load day `date: "2026-08-11"`,
last commit touching `data/stats/` = `fe5391476c8b1dc3cac7298ba1010502484c4f77` (`fe53914`
short). **All four match Round 1's recorded values exactly — no drift.**

Recomputed with a standalone Node script (not carried forward from Round 1) that re-implements,
verbatim, `trends-zoom-logic.ts`'s current `computeArchiveBounds`, `computeFullRange`,
`computeDefaultWindow`, `computeLimits`, `zoomStepRange`, `panStepRange`, `formatRangeLabel`, and
`trends-tick-format.ts`'s current `tickGranularityForStep`/`formatTimeAxisTick`, against the real
`data/stats/*.json` archive read directly off disk. The approximate step between adjacent
Chart.js autoticks is taken as `span / 8`, the same assumption `23-10-SUMMARY.md`'s own
invalidation table used (verified by reproducing its stated ~46/~30/~685/~228-day steps exactly
before trusting the assumption for rows it did not cover). **Exact literal tick-label counts and
positions still require live-browser confirmation** — Chart.js's real autotick placement is not
reproducible outside a browser; the granularity (day/month/year) is what this script computes
with certainty, and is what determines the tick STRING shape below.

| Tab / state | Expected canvas `aria-label` (verbatim) | Expected first x-axis tick | Expected last x-axis tick | Changed since Round 1? |
|---|---|---|---|---|
| Volume weekly, default (D-06 opening window) | `Weekly distance chart, Aug 2025 to Aug 2026` | **Aug 2025** | **Aug 2026** | **Yes** — Round 1 observed day-precision (`13 Aug 2025` … `13 Aug 2026`, R4); the 46-day approx. tick step now exceeds the 32-day day/month threshold, so ticks render month-precision |
| Volume monthly, default (D-06 opening window) | `Monthly distance chart, Aug 2021 to Aug 2026` | Aug 2021 | Aug 2026 | No — Round 1's `Aug 2021` / `Aug 2026` already matched month-precision (~228-day step, unchanged bucket) |
| Volume yearly, default (= full range, D-06) | `Yearly distance chart, Jul 2010 to Jul 2026` | **2010** | **2026** | Table cell only — see note below. The ~685-day approx. step is year-precision both before and after 23-10, so the RENDERED ticks are unchanged; flagging that Round 1's own table cell (`Jul 2010`/`Jul 2026`, with month) does not match either the old or the new code's actual bare-year output. Pre-existing table inaccuracy per `23-10-SUMMARY.md`'s own flag — not caused by this round's plans, not fixed here |
| Volume weekly, after one `+` (zoom in ÷1.5 from default) | `Weekly distance chart, Oct 2025 to Jun 2026` | 13 Oct 2025 | 13 Jun 2026 | No — 243-day span, ~30-day approx. step stays below the 32-day threshold, day-precision both before and after 23-10 |
| Volume weekly, after one `−` (zoom out ×1.5 from default) | `Weekly distance chart, Feb 2025 to Aug 2026` | **Feb 2025** | **Aug 2026** | New row this round (Round 1's table had no dedicated `−` row; R28(d) needs it). 548-day span, ~68-day approx. step, month-precision |
| Volume weekly, after one `←` (pan earlier 25% of visible span from default) | `Weekly distance chart, May 2025 to May 2026` | **May 2025** | **May 2026** | **Yes** — same day→month change as the default row (identical 365-day span, ~46-day step) |
| Volume weekly, at full zoom-out (Reset-to-everything / `−` clamp) | `Weekly distance chart, Aug 2011 to Aug 2026` | **2011** | **2026** | **Yes** — Round 1 observed day-precision (`11 Aug 2011` … `13 Aug 2026`, R9(b)); the ~685-day approx. step is now above the 366-day month/year threshold, dropping the month entirely |
| Training Load, 12mo default | `Training load chart: CTL, ATL, and TSB over time, Aug 2025 to Aug 2026` | Aug 2025 | Aug 2026 | No — 365-day span, ~46-day step, month-precision both before (fixed `formatMonthYearTick`) and after (step-derived) |
| Training Load, at an ≈11-day window | *(depends on the live zoom gesture's exact endpoints — no fixed aria-label to precompute)* | *(distinct dates, day-precision)* | *(distinct dates, day-precision)* | **Granularity guaranteed changed** — an ≈11-day span's ~1.4-day approx. step is far below the 32-day threshold, so day-precision applies; Round 1 (R18 note, Finding 7) observed all eight ticks read the identical `Feb 2026` under the old fixed-format code. R41(a) requires quoting every rendered tick and confirming they are now distinct `D MMM YYYY` strings, not a single computed pair |

**Aria-label base strings** (unchanged from Round 1, `VOLUME_ARIA_LABELS` + `withRangeSuffix`):
`Weekly distance chart`, `Monthly distance chart`, `Yearly distance chart`, `Training load chart:
CTL, ATL, and TSB over time`.

**Cross-check against `23-10-SUMMARY.md`'s own invalidation table:** that table named exactly
three invalidated rows (weekly default, weekly after `←`, weekly full zoom-out) and four
unaffected rows (weekly after `+`, monthly default, yearly default, Training Load 12mo default),
plus one pre-existing yearly-row table inaccuracy it explicitly flagged as unrelated. This
recomputation reproduces all of that exactly, and additionally publishes the weekly-after-`−` row
23-10's table did not need to cover (its scope was tick granularity, not the ÷1.5/×1.5 zoom-step
values 23-08 fixed) and the ≈11-day Training Load row Finding 7's own re-ask (R41(a)) requires. No
disagreement to reconcile.

**Zoom-out (`−`) step count to full zoom, for R29(b):** recomputed at **7 presses** from the
weekly default to the full-range clamp (`2011-08-11T12:00 … 2026-08-13T12:00`), down from Round
1's 14 (the halving-bug count) — expected, since the step is now ÷1.5/×1.5 per press instead of
÷2/×2.

### (f) Per-Task Verification Map extended

Done above, in the existing `## Per-Task Verification Map` table: rows `23-08/T1`, `23-08/T2`,
`23-08/T3`, `23-09/T1`, `23-09/T2`, `23-10/T1`, `23-10/T2`, `23-10/T3` and `23-11/T2` added, each
Status set from this session's actual run (all green except `23-11/T2`, pending — this plan's own
Task 2). The stale `23-01/T3` row, previously filtered on the now-retired pixel-space pan handler
alongside `zoomFactor`, is re-keyed to `-t "zoomStepRange and panStepRange"`, matching the
describe block 23-08 actually renamed it to. `23-07/T2`'s Status is updated from `⬜ pending` to
`✅ green`, reflecting Round 1's closure recorded below (it was still pending at the point this
map was first drafted, 2026-08-19). The retired pixel-space pan handler's identifier no longer
appears anywhere in this file (confirmed by direct repo-wide grep of this document during Task 1).

### (g) Staged build

- Served `dist/widgets` from the MAIN CHECKOUT (not a worktree) via `python3 -m http.server 8099
  --bind 127.0.0.1 --directory /tmp/strava-serve`, with `/tmp/strava-serve/strava-widgets`
  symlinked to `/Users/pedf/workspace/strava-widgets/dist/widgets`, matching production's URL
  path shape: `http://127.0.0.1:8099/strava-widgets/`.
- `curl -sI http://127.0.0.1:8099/strava-widgets/` → **`HTTP/1.0 200 OK`**.
- `curl -s http://127.0.0.1:8099/strava-widgets/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'` →
  **`assets/index-D01ardNQ.js`** — matches step (c)'s built entry filename verbatim.

`git status --porcelain src/` is empty; no source file was modified by this task.

---
