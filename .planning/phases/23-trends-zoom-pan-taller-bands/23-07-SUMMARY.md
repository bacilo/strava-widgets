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
  - "23-VALIDATION.md Round 1: a closed 20-row checkpoint record, 16 PASS / 4 FAIL / 0 BLOCKED, each row carrying its own stated evidence"
  - "REQUIREMENTS.md gated strictly on the row-to-requirement map — TRN-01 ticked; TRN-02/03/04 Pending with their blocking rows named"
  - "Ten recorded findings (two withdrawn, one superseded), none patched, per house rule 4; Finding 10 is the single root cause behind R11 and R16"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas draw-call interception for checkpoint evidence: patching a chart canvas's own 2D context (fillRect / fillText) captures the plugin's real output and the rendered axis ticks, turning a 'does it look right' row into quoted pixel and date values"
    - "Tooltip-as-oracle: reading the chart's own tooltip title back off the canvas gives an exact pixel-to-date anchor without needing a handle on the Chart.js instance"

status: complete
completed: 2026-08-26
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

**Tally: 16 PASS · 4 FAIL · 0 BLOCKED · 0 NOT EXERCISABLE.** No row is left unobserved.

| Verdict | Rows |
|---------|------|
| PASS | R1, R2, R3, R4, R5, R6, R7, R9, R10, R12, R13, R14, R17, R18, R19, R20 |
| FAIL | R8, R11, R15, R16 |

Round 1 ran in two sittings. On 2026-08-25 five rows were left BLOCKED; all five were closed on
2026-08-26 — three by the developer performing the real gesture on an instrumented canvas, two
under Chrome DevTools Responsive emulation.

### The headline: Finding 10, a root cause behind two failures

`buildZoomOptions()` in `chart-zoom.ts` returns `onZoomComplete` and `onPanComplete` as **top-level
siblings** of the `zoom` and `pan` option objects. chartjs-plugin-zoom reads them from **inside**
those objects — `state.options.zoom.onZoomComplete` (plugin lines 388/616/674/767) and
`state.options.pan.onPanComplete` (line 800). The plugin never sees either, so `settle()` never runs
on any gesture.

Observed directly, on real human input: a ⌘+wheel moved the rendered ticks to `11 Aug 2011` …
`13 Aug 2026` while the `aria-label` stayed `Weekly distance chart, Aug 2025 to Aug 2026` and Reset
never appeared; a +576px drag moved the ticks to `22 Nov 2024` … `22 Nov 2025` with the same frozen
label. The wheel listener itself is correctly wired — a synthetic `WheelEvent` with `metaKey` came
back `defaultPrevented: true` (the plugin's own `preventDefault()`, reached only past its modifier
check) while `ctrlKey` and bare wheels came back `false`.

This is exactly the defect the plan predicted would be "silently broken if `onZoomComplete` alone
were relied on, and no automated check in this repository can see it". It blocks TRN-02 via R11 and
TRN-04 via R16, it subsumes Finding 4, and it is a nesting change to fix.

### Rows closed on 2026-08-26

- **R2 PASS** — 84 wheel events, every one `isTrusted` with `metaKey: true`; ticks
  `13 Aug 2025`/`13 Aug 2026` → `11 Aug 2011`/`13 Aug 2026`.
- **R6 PASS** — drag measured at **+576px over 119 `pointermove` events**; ticks →
  `22 Nov 2024`/`22 Nov 2025`; cursor `grab` at rest → `grabbing` on six consecutive move samples.
  A first attempt dragging *left* moved nothing across 582px — correct behaviour, because the D-06
  default already ends at the newest data and `Pan to later dates` reads `disabled: true` there.
  The row's own wording ("drag left") points at the clamped direction and should be fixed.
- **R11 FAIL** — the gesture half never updates the label or reveals Reset (Finding 10).
- **R13 PASS** — closed at **1200 × 1400** under Responsive emulation: `clientHeight` 1400 and
  `100dvh` 1400 agreeing, `matchMedia('(max-width: 430px)')` false, computed height exactly
  **`420px`** where 34dvh would be 476px. Both ends of the clamp now exercised.
- **R15 FAIL** — the D-21 floor **holds** at all four widths (390/393/412/430 → 240px each, canvas
  reflowing correctly), but the no-horizontal-overflow clause fails at every one:
  `documentElement.scrollWidth` pinned at **682**, caused by `.year-heatmap`'s fixed **634px** grid.

A device *preset* was rejected before any of this was recorded: it produced an internally
inconsistent viewport (`matchMedia('(max-width: 430px)')` true at `innerWidth` 682; `100dvh` 326
against `innerHeight` 571). Under emulation `window.innerWidth`/`innerHeight` read stale, so
`clientWidth`/`clientHeight` and `100dvh` were used and cross-checked against `matchMedia` at every
width before anything was written down.

## REQUIREMENTS.md gating decision

Gated strictly on the plan's row map.

| Requirement | Mapped rows | Result | Blocking rows |
|-------------|-------------|--------|---------------|
| TRN-01 | R2, R3, R4, R5, R18 | **TICKED** | none — all five PASSED |
| TRN-02 | R6, R7, R8, R9, R10, R11, R12 | Pending | R8 (FAIL), R11 (FAIL) |
| TRN-03 | R13, R14, R15 | Pending | R15 (FAIL) |
| TRN-04 | R16, R17, R19, R20 | Pending | R16 (FAIL) |

**TRN-01 is ticked** — the first requirement in this phase to have every mapped row PASS. The other
three stay Pending on four located, reproducible defects rather than on missing evidence.
`23-VALIDATION.md` frontmatter: `status: partial`, `nyquist_compliant: false`.

## Findings (recorded, NOT patched)

| # | Finding | Gates |
|---|---------|-------|
| 10 | **ROOT CAUSE** — `onZoomComplete`/`onPanComplete` nested one level too high in `buildZoomOptions()`, so the plugin never sees them and `settle()` never runs on a gesture. Highest-value fix in the phase. | TRN-02 via R11, TRN-04 via R16 |
| 1 | `+`/`−` step is a factor of 2, not the designed 1.5 — `chart-zoom.ts:401` hands `ZOOM_FACTOR = 1.5` to the plugin, whose `linearZoomDelta` removes `range * (zoom - 1)`. The pure module is unit-tested on `span / 1.5`; the runtime bypasses it. | TRN-02 via R8 |
| 2 | **WITHDRAWN — and the withdrawal was wrong.** The original stale-aria-label-after-pan observation was correct; Finding 10 proves it on real input. Kept as an audit trail. | — |
| 3 | **WITHDRAWN** — "decimation does not resolve at deep zoom" is contradicted by measured 1-day point spacing. | — |
| 4 | **SUPERSEDED BY 10** — D-02 lockstep breaking on the gesture path is a symptom; its open question is answered, since `settle()` is what propagates to the sibling and it never runs. | via R16 |
| 5 | **OUT OF SCOPE** — `avgCadenceRpm` ingestion stopped 2026-02-02; an ingestion defect. | none |
| 6 | **OUT OF SCOPE** — Training Load tooltip title renders a raw epoch. **Pre-existing from Phase 18**, verified against `61ee687`. | none |
| 7 | **OUT OF SCOPE** — x-axis ticks do not adapt below month granularity; at ≈11 days all eight read `Feb 2026`. Zoom is what exposes it. | none |
| 8 | Chart canvas does not re-fit when the viewport narrows (wrapper 370px, canvas stayed 770px, `scrollWidth` 835 vs 500). Fresh load is fine — a resize-handling bug, distinct from Finding 9. | none |
| 9 | **Upgraded to a row-level cause.** `.year-heatmap` renders a fixed **634px** grid at every viewport (390/393/412/430/500 alike) and never reflows, pinning `documentElement.scrollWidth` at 682. | TRN-03 via R15 |

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
  the row's own stated observation being present and quoted. On 2026-08-25 five rows were recorded
  BLOCKED rather than PASS because only summaries existed for them; on 2026-08-26 the developer
  supplied the physical gestures and the DevTools viewports, and all five were closed on their own
  stated evidence.
- **A test-design false negative is recorded rather than hidden.** R6's first attempt followed the
  row's literal wording ("drag left") and moved nothing, because that is the clamped direction at
  the D-06 default window. The row wording, not the feature, is at fault; flagged for a later round.
- **Finding 2's withdrawal is itself retracted.** The 2026-08-20 observation it dismissed was
  correct, as Finding 10 now proves on real human input.

## Next

Phase 23 cannot complete: TRN-01 ticks, but TRN-02, TRN-03 and TRN-04 stay Pending on four
located defects. Every row is now observed, so the gap round has no evidence-gathering left to do —
only fixes and a re-test.

Route to gap closure — `/gsd-plan-phase 23 --gaps`. In priority order:

1. **Finding 10** (nesting of `onZoomComplete`/`onPanComplete`) — one change, expected to close
   both R11 and R16, i.e. TRN-02's and TRN-04's remaining blockers. Re-test rather than assume.
2. **Finding 1** (zoom step ×2 instead of ÷1.5) — closes R8, TRN-02's other blocker.
3. **Finding 9** (year heatmap's fixed 634px grid) — closes R15, TRN-03's only blocker.
4. Non-gating but cheap and exposed by this phase: Findings 6, 7 and 8.

Also worth fixing in the plan itself: R6's wording says "drag left", which is the clamped direction
at the default window and produces a false negative.
