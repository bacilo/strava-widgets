---
phase: 23-trends-zoom-pan-taller-bands
plan: 07
subsystem: validation
tags: [checkpoint, human-verify, validation, requirements-gating, chartjs-plugin-zoom, trends]

# Dependency graph
requires:
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 01
    provides: "trends-zoom-logic.ts — the constant tables the expected read-back values were recomputed from"
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 05
    provides: "zoom wired into Volume, the Cadence & HR pair, and Training Load"
  - phase: 23-trends-zoom-pan-taller-bands
    plan: 06
    provides: "D-23 granularity zoom reset and the Training Load preset-as-zoom-write path"
provides:
  - "23-VALIDATION.md Round 1: a closed 20-row checkpoint record with a verdict and the row's own stated evidence per row"
  - "REQUIREMENTS.md gated strictly on the row-to-requirement map — all four TRN requirements stay Pending with their blocking rows named"
  - "Nine recorded findings (two withdrawn), none patched, per house rule 4"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas draw-call interception for checkpoint evidence: patching a chart canvas's own 2D context (fillRect / fillText) captures the plugin's real output and the rendered axis ticks, turning a 'does it look right' row into quoted pixel and date values"
    - "Tooltip-as-oracle: reading the chart's own tooltip title back off the canvas gives an exact pixel-to-date anchor without needing a handle on the Chart.js instance"

status: complete
completed: 2026-08-25
---

# 23-07 — Full gate, chunk-graph proof, and the blocking Round 1 browser checkpoint

## What this plan did

Ran the full automated gate, proved the lazy chunk boundary against built artifacts, confirmed
the recomputed expected read-back values still hold, and then closed the blocking 20-row human
browser checkpoint that Round 1 had left open with `[pending]` verdicts since 2026-08-20.

No production code was changed. Per house rule 4 (standing since checkpoint 16-09), every defect
found is recorded verbatim and left unpatched.

## Task 1 — gate, chunk proof, staged build

Task 1's work was committed on 2026-08-19 (`7f3dbd6`). It was **re-run in full on 2026-08-25**
because the original staged tree was a symlink into the 23-07 worktree and was destroyed when
that worktree merged.

| Command | Result |
|---------|--------|
| `npm test` | `Test Files 54 passed (54)` · `Tests 1313 passed (1313)` · `Duration 1.05s` |
| `npx tsc --noEmit` | exit 0, no output |
| `npm run build-widgets` | `Widget library build complete!` after `rm -rf dist/widgets` (clean tree, no stale sibling chunks) |
| `npm run verify-dashboard` | `37 check(s) passed, 0 failure(s).` |

**Lazy chunk boundary (T-23-LAZY), proven against built artifacts:**

- Entry script read from `dist/widgets/index.html`: **`assets/index-D2l-GZfl.js`**
- `grep -c "Hammer" dist/widgets/assets/index-D2l-GZfl.js` → **`0`**
- Newest (and, after the clean rebuild, only) trends chunk: **`assets/trends-charts-BFx4OoZH.js`**
- `grep -c "Hammer" dist/widgets/assets/trends-charts-BFx4OoZH.js` → **`1`**
- Caveat as the plan required: minifiers preserve legal-comment banners and property names, so
  `Hammer` is a reliable marker; `0` on the entry chunk with non-zero on the trends chunk is the
  proof that `trends.ts`'s static import graph never pays for Hammer or the zoom plugin.

**Staged build (R1's target):** served from the main checkout (deliberately not a worktree this
time) at `http://127.0.0.1:8099/strava-widgets/`. Served entry asset **`assets/index-D2l-GZfl.js`**,
reproducing the 2026-08-19 filename byte-identically and matching the freshly built one.

**Expected read-back values:** no recomputation needed — the archive has not advanced since Task 1
computed them. Last weekly bucket `2026-08-10`, last monthly `2026-08-01`, last yearly `2026-01-01`;
the most recent commit touching `data/stats/` is `fe53914` (2026-08-09). The seven-row expected-value
table in `23-VALIDATION.md` therefore still stands unchanged, and every quoted `aria-label` in the
Round 1 record is comparable against it.

**Per-Task Verification Map:** zero remaining `TBD` entries; `wave_0_complete` flipped to `true`
(both `trends-zoom-logic.ts` and its `.test.ts` sibling exist, and `styles.test.ts` carries three
`chart-band__canvas-wrap--tall` assertions).

## Task 2 — Round 1 checkpoint, all 20 rows

**Tally: 13 PASS · 2 FAIL · 5 BLOCKED · 0 NOT EXERCISABLE.**

| Verdict | Rows |
|---------|------|
| PASS | R1, R3, R4, R5, R7, R9, R10, R12, R14, R17, R18, R19, R20 |
| FAIL | R8, R16 |
| BLOCKED | R2, R6, R11, R13, R15 |

Full per-row evidence is in `23-VALIDATION.md` § *Round 1 — checkpoint record*. Two rows were
newly observed in this session and are worth calling out:

- **R19 PASS** — the thin-HR-coverage shading covers the **same dates at both zoom levels**.
  Zoomed out (`… Aug 2011 to Aug 2026`) the widest shaded rect spans canvas-buffer x 144.14 →
  717.26, which against the data range (x=144 ↔ 2011-08-16, x=1674.64 ↔ 2026-08-11, 3.5764
  days/px) is **2011-08-16 → 2017-03-27**. Zoomed in (`… Apr 2016 to Mar 2018`) the same edge sits
  at x=903.67, which against the chart's own tooltip anchor (`1,489,622,400,000` = 2017-03-16 at
  x=880, 2.14 px/day) is **2017-03-27**. Both levels drew all 42 spans. Evidence was gathered by
  patching the canvas's 2D context to capture the shading plugin's own `fillRect` calls and the
  rendered axis ticks, rather than eyeballing pixels.
- **R18 PASS, and it withdrew Finding 3** — at an ≈11-day Training Load window
  (`… Feb 2026 to Feb 2026`) adjacent tooltip points read `1,770,336,000,000` (2026-02-06) and
  `1,770,422,400,000` (2026-02-07): exactly **86,400,000 ms = 1 day** apart, with individual point
  markers rendered. The series **does** resolve to near-daily detail. The earlier "stays visibly
  decimated" impression is explained by CTL/ATL/TSB being exponentially-weighted moving averages,
  which are inherently smooth; with ~11 points visible, far under `samples: 500`, Chart.js does no
  decimation at all.

### Why five rows are BLOCKED rather than PASS

- **R2, R6, R11 (gesture half).** Synthetic input does not drive `chartjs-plugin-zoom`: a
  `cmd`-modified wheel and a `ctrl`-modified wheel both scrolled the page instead of zooming, and a
  synthetic drag left `Weekly distance chart, Aug 2025 to Aug 2026` and the ticks
  `13 Aug 2025` … `13 Aug 2026` untouched. The developer's 2026-08-20 words for these rows are on
  record but are summaries ("it zooms in and out", "labels follow the ticks"); the rows demand
  **quoted** ticks / `aria-label`s. Recording PASS on a summary is the substitution house rule 1
  forbids and is what reopened CAL-02 in Phase 22.
- **R13(b), R15.** Blocked on a proven environment limit, by explicit developer decision. A resize
  request of 1200×2000 clamped to `innerHeight` **941** (`screen.availHeight` 1084), while the 420px
  ceiling only binds at `innerHeight` ≥ 1235.3. A resize request of 390×800 clamped to
  `innerWidth` **500**, above all four of R15's required widths. Both need DevTools device emulation
  or browser zoom-out, neither drivable from this tooling. Nothing was substituted.

## REQUIREMENTS.md gating decision

Gated strictly on the plan's row map. **No TRN requirement has every mapped row PASSED, so none is
ticked** — all four stay `- [ ]` / Pending with their blocking rows named in both the requirement
body and the traceability table.

| Requirement | Mapped rows | Result | Blocking rows |
|-------------|-------------|--------|---------------|
| TRN-01 | R2, R3, R4, R5, R18 | Pending | R2 (BLOCKED) |
| TRN-02 | R6, R7, R8, R9, R10, R11, R12 | Pending | R8 (FAIL), R6 (BLOCKED), R11 (BLOCKED) |
| TRN-03 | R13, R14, R15 | Pending | R13 (BLOCKED), R15 (BLOCKED) |
| TRN-04 | R16, R17, R19, R20 | Pending | R16 (FAIL) |

`23-VALIDATION.md` frontmatter set to `status: partial`, `nyquist_compliant: false`.

## Findings (recorded, NOT patched)

| # | Finding | Gates |
|---|---------|-------|
| 1 | `+`/`−` step is a factor of 2, not the designed 1.5 — `chart-zoom.ts:401` hands `ZOOM_FACTOR = 1.5` to the plugin, whose `linearZoomDelta` removes `range * (zoom - 1)`. The pure module is unit-tested on `span / 1.5`; the runtime bypasses it, so the suite stays green while shipped behaviour differs. | TRN-01, TRN-02 via R8 |
| 2 | **WITHDRAWN** — apparent stale aria-label after drag-pan was a synthetic-input artifact. | — |
| 3 | **WITHDRAWN 2026-08-25** — "decimation does not resolve at deep zoom" is contradicted by measured 1-day point spacing. | — (no longer gates TRN-01) |
| 4 | D-02 lockstep breaks on the gesture path — wheel-zooming one Cadence & HR band leaves its sibling behind, and it does not catch up after ≥1s. The button path syncs. `onZoomComplete` *does* fire (250ms-debounced), so a never-firing callback is ruled out; `settle(source)` writes `options.scales.x.min/max` + `update('none')` onto the non-source member without touching its plugin state. | TRN-04 via R16 |
| 5 | **OUT OF SCOPE** — `avgCadenceRpm` ingestion stopped 2026-02-02; an ingestion defect, not a rendering one. | none |
| 6 | **NEW, OUT OF SCOPE** — Training Load tooltip title renders a raw epoch (`1,769,990,400,000`) instead of a date. No `title` callback is defined anywhere in `trends-charts.ts` and the x scale is `type: 'linear'` + `parsing: false`. **Pre-existing, not a Phase 23 regression**: `61ee687` (last pre-Phase-23 commit, `feat(18-15)`) already had both and no `title:` callback. | none |
| 7 | **NEW, OUT OF SCOPE** — x-axis ticks do not adapt below month granularity; at an ≈11-day window all eight ticks read `Feb 2026`. Same root-cause family as #6, but zoom is what exposes it. | none |
| 8 | **NEW** — chart canvas does not re-fit when the viewport narrows: after resizing to a 500px viewport the wrapper shrank to 370px but the canvas stayed 770×206 CSS px, giving `scrollWidth` 835 vs `clientWidth` 500. A fresh load at 500px sizes it correctly (370×223), so it is a resize-handling bug. | none (R15's widths are 390–430) |
| 9 | **NEW** — at a 500px viewport on a **fresh** load the Trends view still overflows: `scrollWidth` 682 vs `clientWidth` 500, from `.year-heatmap` (634 vs 404). Plausibly the same family as Phase 22's still-open CAL-02. | none (does not discharge R15) |

## Deviations

- **Task 1 re-run rather than trusted.** Its commit predates the worktree merge that destroyed the
  staged tree, so R1's prerequisite could not have been honoured against the original staging. The
  entry asset reproduced identically, so no expected value changed.
- **A stale-pointer correction in `23-VALIDATION.md`'s Manual-Only table.** That table sent the
  thin-coverage shading row to Cadence & HR; the plugin is attached to **Training Load**
  (`createThinCoverageShadingPlugin`, `trends-charts.ts`). The 23-07 row agenda (which says Training
  Load) is authoritative and R19 was run there. The table now says so.
- **Verdicts were assigned by the orchestrator from recorded evidence, not by the developer
  row-by-row**, at the developer's explicit request to handle the checkpoint. Every PASS rests on
  the row's own stated observation being present and quoted; where only a summary existed and the
  observation could not be reproduced, the row was recorded BLOCKED rather than PASS.

## Next

Phase 23 cannot complete: two real defects (Findings 1 and 4) and five unobserved rows stand.
Route to gap closure — `/gsd-plan-phase 23 --gaps`. The gap round needs to fix the zoom-step
magnitude and the gesture-path lockstep, and to re-run R2, R6, R11, R13 and R15 under DevTools
device emulation.
