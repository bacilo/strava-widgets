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

---
## Round 1 — checkpoint record (COMPLETE)

> Round 1 opened 2026-08-20 (evidence log, verdicts pending) and was closed 2026-08-25.
> Verdict vocabulary: PASS / FAIL / BLOCKED / NOT EXERCISABLE (Phase 20).
>
> **Build freshness at close.** The 2026-08-20 staged tree was a symlink into the 23-07
> worktree and was destroyed when that worktree merged. On 2026-08-25 the gate was re-run
> green in full (`npm test` 54 files / 1313 tests; `npx tsc --noEmit` exit 0;
> `npm run build-widgets` after `rm -rf dist/widgets`; `npm run verify-dashboard` 37 checks,
> 0 failures), the entry asset reproduced **identically** as `assets/index-D2l-GZfl.js`, the
> lazy chunk boundary re-proved (entry `Hammer` = 0; `assets/trends-charts-BFx4OoZH.js`
> `Hammer` = 1, and after the clean rebuild that is the ONLY `trends-charts-*.js` chunk on
> disk, so a stale sibling cannot be served). Re-staged from the main checkout (not a
> worktree) at `http://127.0.0.1:8099/strava-widgets/`.
>
> **Archive unchanged** since Task 1's recomputation — last weekly `2026-08-10`, monthly
> `2026-08-01`, yearly `2026-01-01`; last commit touching `data/stats/` is `fe53914`
> (2026-08-09). The "Expected read-back values (Round 1)" table above therefore still
> stands and every quoted `aria-label` remains comparable.
>
> **Source key.** `machine-observed` = read out of the real browser at
> `http://127.0.0.1:8099/strava-widgets/` via instrumented DOM/canvas reads and real
> clicks/key presses. `developer-observed` = the developer's own words.
>
> **Why four rows are BLOCKED and not PASS.** R2, R6 and R11's gesture half are
> gesture-path rows. Synthetic pointer and wheel input dispatched through browser
> automation does **not** drive `chartjs-plugin-zoom` — a `cmd`-modified and a
> `ctrl`-modified wheel both scrolled the page instead of zooming, and a synthetic
> drag left the range untouched (`Weekly distance chart, Aug 2025 to Aug 2026`
> before and after). This is the same mechanism the withdrawn Finding 2 identified.
> The developer's 2026-08-20 words for these rows are on record, but they are
> summaries ("it zooms in and out", "labels follow the ticks") and the rows demand
> **quoted** tick labels / `aria-label`s. Recording PASS on a summary is precisely
> the substitution house rule 1 forbids and precisely what reopened CAL-02 in
> Phase 22, so they are BLOCKED. R13(b) and R15 are BLOCKED on a hardware/browser
> limit proven below, by explicit developer decision on 2026-08-25.

| Row | Verdict | Source | Evidence as the row demanded it |
|-----|---------|--------|----------------------------------|
| R1 | **PASS** | machine-observed | Served page loaded `assets/index-D2l-GZfl.js` — read back live from the browser two ways: the module `<script src>` and the `performance` resource entry, both `http://127.0.0.1:8099/strava-widgets/assets/index-D2l-GZfl.js`. Matches the freshly built entry filename verbatim. |
| R2 | **BLOCKED** | developer-observed | Developer 2026-08-20: "If I do Command+Scroll then it zooms in and out". The row requires the first and last x-axis tick **quoted before and after**; those were never quoted. Re-attempt 2026-08-25 failed: `cmd`+wheel and `ctrl`+wheel over the plot area both scrolled the page, ticks unchanged `13 Aug 2025` … `13 Aug 2026`, `aria-label` unchanged `Weekly distance chart, Aug 2025 to Aug 2026`. |
| R3 | **PASS** | machine-observed | Bare wheel over plot area: page scrolled `scrollY 0 → 300`; chart range unchanged, label `Weekly distance chart, Dec 2025 to Mar 2026` before and after. |
| R4 | **PASS** | machine-observed | Fresh Volume weekly: `Weekly distance chart, Aug 2025 to Aug 2026` — matches the expected table; contains no 2011. Ticks `13 Aug 2025` … `13 Aug 2026` (re-confirmed 2026-08-25). |
| R5 | **PASS** | machine-observed | Monthly `Monthly distance chart, Aug 2021 to Aug 2026`; Yearly `Yearly distance chart, Jul 2010 to Jul 2026`. Both match the expected table. |
| R6 | **BLOCKED** | developer-observed | Cursor at rest re-confirmed 2026-08-25 as computed `grab`. Developer 2026-08-20: drag pans, "labels follow the ticks", "becomes a closed fist as we drag". The row requires first/last tick **quoted before and after**; never quoted, and a synthetic drag (900,590)→(600,590) did not pan (`Weekly distance chart, Aug 2025 to Aug 2026` unchanged, cursor `grab`). |
| R7 | **PASS** | machine-observed | Four individual real Enter/Space activations. `←`: `Aug 2025 to Aug 2026` → `Apr 2025 to Apr 2026`. `→`: → `Aug 2025 to Aug 2026`. `+`: → `Nov 2025 to May 2026`. `−` (×14): → `Aug 2011 to Aug 2026`. Tab-order trail reached `Pan to earlier dates`, `Zoom out`, `Zoom in`; `→` correctly skipped while disabled. |
| R8 | **FAIL** | machine-observed | Direction is **not** inverted and the `←`/`→` round-trip returned exactly to the default. But the magnitude misses the expected table: after `←` observed `Apr 2025 to Apr 2026` against the expected `May 2025 to May 2026`. See Finding 1. |
| R9 | **PASS** | machine-observed | (a) Fresh weekly: `→` disabled, `←` enabled. (b) At the clamp: `Weekly distance chart, Aug 2011 to Aug 2026` (matches the full-zoom-out expected row); `−`, `←`, `→` all disabled, `+` enabled; ticks `11 Aug 2011` … `13 Aug 2026`. |
| R10 | **PASS** | machine-observed | (a) Reset absent on fresh load (present in DOM but zero-size, `getBoundingClientRect()` `{x:0,y:0}`). (b) Appears after `+`. (c) Reset → `Weekly distance chart, Aug 2025 to Aug 2026` — the **DEFAULT**, not the `Aug 2011 to Aug 2026` full zoom-out. |
| R11 | **BLOCKED** | both | Button half (machine-observed): `aria-label` updates after `+`, `−`, `←` and `→` — quoted in R7. Gesture half: developer's 2026-08-20 words are "labels follow the ticks", not a verbatim `aria-label` quote, and a gesture zoom could not be reproduced on 2026-08-25 (see R2). The row is explicit that quoting only one of the two cases does not discharge it. |
| R12 | **PASS** | machine-observed | Hint rendered verbatim as `⌘ + scroll to zoom · drag or pinch to pan`, in the **"Distance"** band header. Independently re-observed on screen 2026-08-25. |
| R13 | **BLOCKED** | machine-observed | (a) OBSERVED: `window.innerHeight` = **600** exactly, computed `.chart-band__canvas-wrap--tall` height = **204px** = 34% of 600, at width 1200 (>430, phone override not in play), method window resize. (b) **NOT OBSERVED — proven unreachable.** `screen.availHeight` = 1084; a resize request of 1200×2000 was clamped to `innerHeight` = **941** (band then 319.938px = 34% of 941, still below the ceiling). The 420px ceiling only binds at `innerHeight` ≥ 1235.3. Browser zoom-out could reach it but page-zoom shortcuts are not deliverable through this tooling. Per house rule 1, a shorter window is **not** substituted. |
| R14 | **PASS** | machine-observed | Both Cadence & HR bands reported individually: **200px** and **200px** (at `innerHeight` 552); tab scrolls. |
| R15 | **BLOCKED** | machine-observed | **NOT OBSERVED — proven unreachable.** Chrome clamps its own window to a 500px minimum width: a resize request of 390×800 produced `window.innerWidth` = **500**. All four required widths (390, 393, 412, 430) sit below that floor and need DevTools device emulation, which is not drivable from this tooling. Naming a nearby width instead is the exact substitution that reopened CAL-02, so nothing is substituted here. See Finding 9 for what *was* seen at 500px — it does **not** discharge this row. |
| R16 | **FAIL** | both | Button zoom (machine-observed): both canvases `Jul 2023 to Sep 2024` — identical, lockstep holds. Wheel zoom over one band (developer-observed): "zooms in/out only the chart we're on", and after a deliberate ≥1s pause the other band "doesn't seem to catch up". See Finding 4. |
| R17 | **PASS** | machine-observed | (a) Volume `Yearly distance chart, Jul 2016 to Jul 2020`; Training Load `Training load chart: CTL, ATL, and TSB over time, Nov 2025 to May 2026`. (b) After 3 full 5-tab passes both read identically — zoom survived. (c) weekly→monthly→weekly → `Weekly distance chart, Aug 2025 to Aug 2026`, the weekly default, Reset hidden (D-23 holds). (d) Zero app-origin console errors; specifically no "Canvas is already in use". (e) `tabpanel-volume:1, tabpanel-yoy:1, tabpanel-cadence-hr:2, tabpanel-training-load:1, tabpanel-gear:1`; `.chart-zoom-controls` count = **1**. |
| R18 | **PASS** | machine-observed | At `Training load chart: CTL, ATL, and TSB over time, Feb 2026 to Feb 2026` (five `+` presses from the 12mo default ⇒ ≈11 days, "roughly a two-week span"), the series **does resolve to near-daily detail**: two adjacent tooltip readings gave `1,770,336,000,000` (2026-02-06) and `1,770,422,400,000` (2026-02-07) — a difference of exactly **86,400,000 ms = 1 day** — with individual point markers rendered on the series. This **supersedes** the 2026-08-20 impression that it "stays smooth and simplified"; CTL/ATL/TSB are exponentially-weighted moving averages and are inherently smooth, so smoothness is not evidence of decimation. See Finding 3 (WITHDRAWN). |
| R19 | **PASS** | machine-observed | Shading covers the **same dates** at both zoom levels. Zoomed out, `Training load chart: CTL, ATL, and TSB over time, Aug 2011 to Aug 2026`: widest shaded rect spans canvas-buffer x 144.14 → 717.26; anchoring x=144 ↔ data start 2011-08-16 and x=1674.64 ↔ data end 2026-08-11 (3.5764 days/px) gives **2011-08-16 → 2017-03-27**. Zoomed in, `Training load chart: CTL, ATL, and TSB over time, Apr 2016 to Mar 2018`: the same span's right edge is at x=903.67; anchoring on the chart's own tooltip readout `1,489,622,400,000` (2017-03-16) at x=880 with 2.14 px/day gives **2017-03-27**. Both zoom levels also drew all **42** spans. |
| R20 | **PASS** | machine-observed | Zoomed to `Dec 2025 to Mar 2026` → navigated `#/records` → back to `#/trends` → `Weekly distance chart, Aug 2025 to Aug 2026`, the weekly default (D-22 reset on full remount). |

**Tally:** 13 PASS · 2 FAIL · 5 BLOCKED · 0 NOT EXERCISABLE.
(BLOCKED: R2, R6, R11, R13, R15. FAIL: R8, R16.)

### Requirement gating (strictly on the row map)

| Requirement | Mapped rows | Result | Blocking rows |
|-------------|-------------|--------|---------------|
| TRN-01 | R2, R3, R4, R5, R18 | **Pending** | R2 (BLOCKED) |
| TRN-02 | R6, R7, R8, R9, R10, R11, R12 | **Pending** | R6 (BLOCKED), R8 (FAIL), R11 (BLOCKED) |
| TRN-03 | R13, R14, R15 | **Pending** | R13 (BLOCKED), R15 (BLOCKED) |
| TRN-04 | R16, R17, R19, R20 | **Pending** | R16 (FAIL) |

No TRN requirement has every mapped row PASSED, so none is ticked.
`status: partial`, `nyquist_compliant: false`.

### Findings (recorded, NOT patched — house rule 4)

**Finding 1 — `+`/`−` step is a factor of 2, not the designed 1.5.** `chart-zoom.ts:401`
calls `chart.zoom(ZOOM_FACTOR)` with `ZOOM_FACTOR = 1.5`, but chartjs-plugin-zoom's
`linearZoomDelta` computes `newRange = range * (zoom - 1)` and *removes* that much:
`12 months × 0.5 = 6` removed, leaving 6. The design intent, and what
`trends-zoom-logic.ts` is unit-tested on, is `span / 1.5` = 8 months. Observed
`Nov 2025 to May 2026` (6 months) against the table's `Oct 2025 to Jun 2026` (8 months).
Corroborated again 2026-08-25 on Training Load: the full-zoom-out ladder stepped
180 → 90 → 45 → 22 → 11 months, and the 12mo default halved to 6mo on the first `+`.
The pure module's arithmetic is tested; the runtime bypasses it by delegating to the
plugin, so the suite stays green while shipped behaviour differs. **Blocks TRN-01 and
TRN-02 via R8** (and is the reason R8 is FAIL rather than PASS).

**Finding 2 — WITHDRAWN.** An apparent stale aria-label after drag-pan was an artifact of
synthetic pointer input failing to produce a gesture-end (`onPanComplete`). The
developer's real hand-drag showed labels tracking the ticks correctly. Recorded here so
the retraction is auditable. *(Re-confirmed 2026-08-25: synthetic drag and synthetic
modifier-wheel produce no gesture at all — see the note above the verdict table.)*

**Finding 3 — WITHDRAWN 2026-08-25.** Previously recorded as "decimation does not resolve
at deep zoom", on the developer's impression that at a ~2-week zoom the Training Load
series "stays smooth and simplified, just stretched and wider". Direct measurement
contradicts it: at an ≈11-day window, adjacent tooltip points are exactly 86,400,000 ms
(one day) apart — `1,770,336,000,000` (2026-02-06) then `1,770,422,400,000` (2026-02-07) —
and individual point markers are rendered. `DECIMATION_CONFIG` is
`{ enabled: true, algorithm: 'lttb', samples: 500 }`; with ~11 points visible, far under
the 500 threshold, Chart.js does no decimation at all, which is exactly what was measured.
The smooth appearance is intrinsic: CTL, ATL and TSB are exponentially-weighted moving
averages and carry no daily jitter to reveal. **No longer blocks TRN-01**; R18 is PASS.

**Finding 4 — D-02 lockstep breaks on the gesture path.** Wheel-zooming over one band of the
Cadence & HR pair moves only the hovered chart; the sibling does not follow, and does not
catch up after a ≥1s pause. The button path syncs both correctly. Established: the plugin
*does* fire `onZoomComplete` for wheel, via a 250ms-debounced handler
(`addDebouncedHandler(chart, 'onZoomComplete', onZoomComplete, 250)`), so a never-firing
callback is ruled out and waiting longer does not help. `settle(source)` propagates by
writing `options.scales.x.min/max` + `update('none')` onto the non-source member — a
different mechanism from how the source chart's own range was set (the zoom plugin's
internal state), and the non-source chart's plugin state is never updated. Open question
for gap closure: why the button path (always sourced from `members[0]`) syncs while a
gesture sourced from `members[1]` does not. **Blocks TRN-04 via R16.**

**Finding 5 — OUT OF SCOPE for Phase 23: `avgCadenceRpm` ingestion stopped in Feb 2026.**
Surfaced while looking at the Cadence & HR tab. `avgCadenceRpm` is last populated
`2026-02-02`; of the 59 activities after that date only 1 carries cadence, while 57 of the
same 59 carry `avgHr` (last `2026-08-11`). Cadence was healthy through late 2025 (~90–94 rpm
on every November run). The chart renders the data faithfully — this is an ingestion defect,
not a rendering or zoom defect, and predates the August intervals.icu cutover. No Phase 23
row covers it; it must NOT gate any TRN requirement. Track separately.

**Finding 6 — NEW, OUT OF SCOPE for Phase 23: Training Load tooltip title renders a raw
epoch.** The tooltip title shows the millisecond timestamp instead of a date — observed at
the 12mo default as `1,769,990,400,000` (2026-02-02) and at deep zoom as
`1,489,622,400,000` (2017-03-16). Cause: no `title` callback is defined for any tooltip in
`trends-charts.ts`, so Chart.js falls back to the raw x value, and Training Load's x scale
is `type: 'linear'` with `parsing: false`. **Pre-existing, not a Phase 23 regression** —
`git show 61ee687:src/dashboard/views/trends-charts.ts` (last pre-Phase-23 commit touching
the file, `feat(18-15)`) already has `type: 'linear'` + `parsing: false` and no `title:`
callback anywhere. No Phase 23 row covers tooltips; must NOT gate any TRN requirement.

**Finding 7 — NEW, OUT OF SCOPE for Phase 23: x-axis tick labels do not adapt below month
granularity.** At an ≈11-day Training Load window, all eight rendered x-axis ticks read
`Feb 2026` — captured verbatim at canvas-buffer x 144, 420.8, 648.4, 876, 1103.6, 1331.3,
1558.9, 1979.5. The axis becomes unreadable at the zoom depths this phase newly makes
reachable. Same root-cause family as Finding 6 (linear scale, no time-unit formatting).
No Phase 23 row covers tick formatting; must NOT gate any TRN requirement, but it is worth
a gap-closure item because zoom is what exposes it.

**Finding 8 — NEW: chart canvas does not re-fit when the viewport narrows.** After resizing
the window from 1200px to a 500px-wide viewport, the band wrapper correctly shrank to 370px
but the canvas stayed at its previous **770 × 206 CSS px** (buffer 1540 × 412), producing
horizontal overflow: `document.documentElement.scrollWidth` **835** vs `clientWidth` **500**.
A fresh load at the same 500px viewport sizes the canvas correctly at **370 × 223**, so this
is a resize-handling bug, not a narrow-width layout bug. Not covered by any row (R15's widths
are 390–430, not 500), so it does not discharge or fail R15 — recorded for gap closure.

**Finding 9 — NEW: horizontal overflow at a 500px viewport persists on a fresh load.** On a
fresh load at `innerWidth` 500, `document.documentElement.scrollWidth` is **682** vs
`clientWidth` **500**. The offender is the year heatmap: `.year-heatmap` measures
`scrollWidth` **634** against `clientWidth` **404**. This is on the Volume tab and is
plausibly the same family as Phase 22's still-open CAL-02 overflow band. 500px is **not** one
of R15's four required widths, so this does **not** discharge R15 — it is a separate,
recorded observation.

### R19 targets (retained for reference)

42 thin-coverage spans exist; most are 2–4 days wide, which is why they read as narrow and
subtle. The two worth using for a dates-covered comparison:

| Span | Length |
|------|--------|
| 2011-08-16 → 2017-03-27 | 2051 days (the whole pre-HR-monitor era) — this is the one R19 used |
| 2020-02-25 → 2020-05-19 | 85 days |
