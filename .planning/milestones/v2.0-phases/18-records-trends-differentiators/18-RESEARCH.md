# Phase 18: Records, Trends & Differentiators - Research

**Researched:** 2026-08-11
**Domain:** Sports-science derived metrics (age-grading, TRIMP, CTL/ATL/TSB, Riegel) rendered as Chart.js 4.5 small-multiples/time-series over a vanilla-TS dashboard, on top of an already-locked data pipeline.
**Confidence:** MEDIUM-HIGH — the rendering mechanics and existing-codebase conventions are HIGH confidence (read directly from source); the sports-science formulas are MEDIUM confidence (WebSearch cross-verified against 3+ independent sources with a worked numeric example, but not fetched from a single canonical WMA PDF); the WMA factor-table *values* themselves are NOT bundled by this research and remain the single largest open item for planning.

## Summary

This phase has no framework or stack decisions left to make — CONTEXT.md's D-01..D-22 already lock page composition, tab structure, chart forms, and the build-time/client-side split. What planning actually needs is domain-formula precision (age-grading, TRIMP, CTL/ATL, Riegel) and Chart.js 4.5 rendering mechanics for chart types the codebase hasn't built yet (stepped small-multiples, a 53×7 heatmap, a two-model toggle chart), plus a verification strategy for the specific defect class that has escaped two prior phase gates at 100% green (chart renders but is visually wrong).

The domain formulas converge cleanly across independent sources: **age-grade % = (Open Standard ÷ Actual Time) ÷ Age Factor × 100**, with age factor ≤1.0 peaking at 25-35; **Edwards TRIMP** is `Σ(minutes-in-zone × zone-weight 1-5)`; **Banister TRIMP** is `Σ(Δt_min × HRr × 0.64·e^(1.92·HRr))` for men (`0.86·e^(1.67·HRr)` for women), summed per-sample over the HR stream, not computed from a single average; **CTL/ATL** are exponentially-weighted moving averages with 42-day/7-day time constants (`today = yesterday + (load - yesterday) × (1 - e^(-1/τ))`, more precise than the `/τ` linear approximation); **TSB** is *yesterday's* CTL minus *yesterday's* ATL, not today's; **Riegel** is `T2 = T1 × (D2/D1)^b`, with `b` fitted by ordinary least-squares on `(ln D, ln T)` pairs — a ~10-line regression, no library needed. None of this requires a new npm dependency; everything is arithmetic over data already on disk.

The one load-bearing risk this research surfaces that CONTEXT.md does not address: **D-12 adds `birthDate` and `sex` to `data/config/athlete.json`, but `scripts/build-widgets.mjs`'s `copyDataFiles` already wholesale-copies every `*.json` in `data/config/` to the public `dist/widgets/data/config/` directory.** D-20 states the goal ("keeping identity inputs out of the served artifact") but the existing copy mechanism does not achieve it for the raw config file itself — only for the *derived* stats payload. Planning must resolve this before D-12 ships (see Common Pitfalls #1 and Security Domain).

**Primary recommendation:** Treat this phase as "formula implementation + established-pattern chart reuse," not "chart R&D." `detail-charts.ts`/`detail-charts-logic.ts` (Phase 17) already solve canvas-reuse, shared-gutter alignment, duration-axis ticks, theme-token resolution, and destroy-on-rebuild for exactly this codebase — copy those patterns rather than re-deriving them. Budget real planning effort on: (1) the athlete-config public-artifact split, (2) a continuous daily date-spine helper for CTL/ATL (nothing in the codebase does this yet), (3) sourcing/committing the actual WMA factor-table values (this research found the *source* and *format*, not machine-readable numbers — see Open Questions), and (4) a browser-checkpoint script detailed enough to catch what Phase 16/17's automated gates missed twice.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REC-02 | User can view all-time PR lists per distance | `rankings` field in `data/stats/best-efforts.json` (confirmed live shape below); D-05 locks 7 top-10 tables |
| REC-03 | User can view how each distance PR evolved over the years | `wasPRAtTheTime` flag, confirmed 79 PR-setting efforts live (6-21/distance, marathon 0); Chart.js `stepped` line mechanics below |
| REC-04 | Runs that set a new PR show a "PR" badge in list and detail views | List/overview badges already ship; detail-side badge pattern documented from `list.ts`/`overview.ts` |
| REC-05 | Weekly/monthly/yearly totals, biggest week/month, streak records | `data/stats/{weekly-distance,monthly-stats,yearly-stats,streaks}.json` shapes confirmed live, presentation-only |
| REC-06 | Age-graded performance percentages on PRs (WMA tables) | Age-grade formula, factor-table source/format, 1k interpolation approach — Architecture Patterns § Age-Grading |
| REC-07 | Riegel-based race-time predictions derived from PRs | Formula + least-squares fit + 3-distinct-activity guard — Code Examples § Riegel |
| TREND-01 | Weekly/monthly volume trend charts over the full archive | `weekly-distance.json`/`monthly-stats.json` confirmed presentation-only; heatmap options below |
| TREND-02 | Year-over-year comparisons | `year-over-year.json` shape confirmed (month × year), presentation-only |
| TREND-03 | Cadence and HR average trends over months | Derivable client-side from the in-memory dashboard index (`avgHr`, `avgCadenceRpm` fields confirmed present) |
| TREND-04 | TRIMP-based training load chart (CTL/ATL/TSB) | Edwards/Banister formulas, CTL/ATL recursion, daily date-spine requirement — Architecture Patterns § Training Load |
| TREND-05 | Pace/HR trend breakdowns per shoe | Gear coverage confirmed live (1,160/1,868, 62%; sharply degrading in 2026 to 19%); D-17/D-18 lock the aggregate shape |

</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page composition and routing**
- **D-01:** Superlatives (biggest week/month, streaks) on Records; rolling totals (this week/month/year) on Trends header strip. Both read the same `data/stats/` files.
- **D-02:** Records scrolls with a sticky in-page jump list. Trends is tabbed via `#/trends?tab=volume` (17-D07 query-string state); each tab's charts build lazily on open (pairs with 17-D25).
- **D-03:** Trends has five tabs, each owning its own controls: Volume / Year-over-year / Cadence & HR / Training load / Gear. No shared global date-range control.
- **D-04:** The GitHub-style 53×7 year consistency heatmap lives in the Volume tab, beside the volume charts.

**PR lists and evolution**
- **D-05:** Seven top-10 tables (400m, 1k, 1mi, 5k, 10k, half, marathon), all visible, no expand-on-click. `rankings.marathon` is empty (zero entries) — must render a proper empty state.
- **D-06:** PR evolution is a small-multiples grid of seven compact step charts (x=date, y=time, stepping down each record). Progression table (date, new time, improvement, run link) expands underneath on click. Data is `wasPRAtTheTime` — 6-21 steps per distance, ~78-79 total. Seven live Chart.js instances on one page alongside D-05's tables.
- **D-07:** Low-confidence and excluded efforts are badged in place, never hidden. No hide-by-default toggle.
- **D-08:** Detail view gets both a header badge (named per-distance, "PR — 5k") and a best-efforts panel listing every effort the run produced across all seven distances, PR rows highlighted.

**Age-grading and race predictions**
- **D-09:** Age-grade all seven distances. 5k/10k/half/marathon use WMA road factors; 400m and mile use WMA track factors; 1k has no WMA standard and is interpolated between 800m and mile track factors, visibly labelled derived. Bundle factor tables as committed JSON under `data/`.
- **D-10:** Age-grade is a column in the top-10 tables (property of a specific effort). Riegel gets its own anchored "Race Predictions" section (model output).
- **D-11:** Riegel is a matrix at standard 1.06, with a self-suppressing fitted exponent alongside that names the distances it was fitted over and suppresses itself entirely when the fitting set spans fewer than 3 distinct activities. Not optional — see data findings on why (all three road PRs are splits of one run).

**Athlete configuration**
- **D-12:** One extended `data/config/athlete.json` — add `birthDate`, `sex`, `restingHr` alongside existing `maxHr`/`hrZones`. Each consumer validates only fields it needs.
- **D-13:** Missing/placeholder config hides the feature behind an actionable notice (names the file/field), never a fabricated value. Phase passes with config unfilled.

**Training load (TREND-04)**
- **D-14:** Both TRIMP models, Edwards default (transparent, only needs the 5 bpm zone boundaries). Banister available via toggle. Both computed per-activity from the HR **stream**, not `avgHr`.
- **D-15:** No-HR runs (~180, 10%) contribute nothing; CTL/ATL simply decay across those days. Chart shades/annotates thin-HR-coverage spans. Nothing deleted, nothing invented.
- **D-16:** Standard CTL/ATL exponential time constants (42-day/7-day), TSB as their difference, over the full archive span. Displayed window is Claude's discretion.

**Gear-aware trends (TREND-05)**
- **D-17:** Resolved gear *name* in the dashboard index (never raw id) plus a precomputed per-shoe aggregate for Trends charts.
- **D-18:** Explicit "Unknown" bucket with stated coverage — absence shown, never filled.
- **D-19:** Gear names are currently all empty strings in `data/config/gear.json` — code must build/run/chart correctly against blank names, falling back gracefully. Not a phase blocker.

**Build-time vs client-side computation**
- **D-20:** Build steps (new `compute-*` CLI subcommands, gitignored JSON to `data/stats/`, wired into `compute-all-stats`) for: training load (needs the ~142MB of stream files — never a browser job), age-grading (needs `birthDate`/`sex` — precompute so only percentages reach the published payload), gear aggregate.
- **D-21:** Client-side for everything derivable from already-fetched data: Riegel matrix, volume rollups, biggest-week/month superlatives, monthly cadence/HR means over the in-memory index.
- **D-22:** Any new committed or generated data file must be added to `copyDataFiles` in `scripts/build-widgets.mjs`, or it 404s in production.

### Claude's Discretion
- Exact schema/field/file names for new `data/stats/` outputs and committed WMA factor tables — follow existing `schemaVersion`/`generatedAt`/`note` conventions.
- Which subset D-11's fitted exponent regresses over (rank-1 PRs only, best-per-distance-per-year, or full top-10), provided the 3-distinct-activity guard holds and the subset is named in the UI.
- Displayed default window for the training-load chart; visual treatment of thin-HR-coverage spans (shading vs annotation vs both).
- Records section order and superlative tile set; Trends tab order beyond Volume first.
- Pace-vs-time y-axis treatment on D-06's step charts; whether small multiples share a y-scale (they cannot meaningfully — 44s to 87min).
- Empty/loading states for both new pages; whether Trends adopts the detail view's hover-crosshair conventions (17-D26).
- Module decomposition: pure-logic/DOM split (mirror `list-logic.ts`/`calendar-logic.ts`/`detail-charts-logic.ts`).
- Whether tabbed Trends unmounts/disposes Chart.js instances on tab switch or keeps them alive.

### Deferred Ideas (OUT OF SCOPE)
- Teaching the intervals.icu adapter to carry `gear_id` (the 2026 gear-coverage drop is a pipeline gap, not presentation — fixing the source belongs to whatever phase next touches ingestion).
- Filtering/grouping the activity browser by shoe (D-17 makes this cheap but the browser UI is not in scope).
- Personal route-segment detection (REC-08, Future set).
- Native device-recorded laps table (DETAIL-06, blocked on FIT lap-marker recovery).
- Pace/speed colour coding along route polylines.
- Manual exclusion UI — already shipped as data (`data/best-effort-exclusions.json`); D-07 only surfaces `reason` strings, no override UI.
- Garmin export adapter — `export_data/` still has no `garmin/` subdirectory.

</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PR rankings/evolution display | Browser / Client | — | Presentation over an already-computed `best-efforts.json`; D-21, pure rendering |
| Age-grading percentage computation | Build (Node CLI) | — | D-20: needs `birthDate`/`sex` (identity input); precomputed so only the % reaches the published artifact |
| WMA factor-table storage | Database / Storage (committed JSON) | Build | Static reference data, versioned like `data/best-effort-exclusions.json`; read by the build-time compute step |
| Riegel matrix + fitted exponent | Browser / Client | — | D-21: pure arithmetic over already-fetched `best-efforts.json`, no personal inputs, cheap to recompute per page load |
| TRIMP per-activity computation | Build (Node CLI) | — | D-20: requires the full HR stream archive (~142MB) — never a browser job |
| CTL/ATL/TSB series | Build (Node CLI) | — | D-20: derived from per-activity TRIMP + a continuous daily spine over 14 years; too much data for the browser to reduce per page load |
| Training-load chart rendering | Browser / Client | — | Chart.js renders the precomputed series; only the plotting is client-side |
| Volume/YoY/cadence-HR trend rollups | Browser / Client (mostly) / Build (volume, YoY) | — | Weekly/monthly/yearly/YoY already exist as build output (Phase 12/13 legacy); cadence/HR monthly means computed client-side over the in-memory index (D-21) |
| Year consistency heatmap | Browser / Client | — | Pure presentation over already-published daily/weekly data; no new build output needed if driven off `weekly-distance.json` or the index |
| Gear name resolution | Build (index) + Browser (aggregate fetch) | — | D-17: gear *name* resolved once at build time into the index; the per-shoe aggregate is also build-time (avoids re-reducing 1,867 rows per tab open) |
| Athlete config validation | Browser / Client | Build | Client validates fields it needs per-consumer (D-12); build step also reads the file directly for TRIMP/age-grading — see Common Pitfalls #1 for the public-artifact risk this creates |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `chart.js` | 4.5.1 (installed, confirmed via `npm view chart.js version`) [VERIFIED: npm registry + already in package.json] | All new charts (PR evolution, volume, YoY, cadence/HR trend, training load) | Already the project's only charting library (16-D01..D04 precedent); tree-shaken component registration is the established pattern in `src/widget/chart-config.ts` and `src/dashboard/views/detail-charts.ts` |

No other core runtime dependency is required. Age-grading, TRIMP, CTL/ATL, and Riegel are all plain arithmetic over data already on disk — none of them need a math/stats library. The codebase does not use `chartjs-adapter-date-fns` or Chart.js's `TimeScale` anywhere (confirmed via `grep -rn "TimeScale\|chartjs-adapter"` returning zero hits); `detail-charts.ts` instead uses a `'linear'` x-scale with a custom tick-format callback. Follow that precedent for D-06's date-based step charts rather than introducing a date-adapter dependency.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chartjs-chart-matrix` | 3.0.5 [ASSUMED — package name/plausibility from WebSearch/training data, not from an official Chart.js docs page; existence + version confirmed via `npm view`, see Package Legitimacy Audit] | Renders the D-04 GitHub-style 53×7 heatmap as an actual Chart.js `matrix` chart type (colored cells on a grid) | Only if the planner wants the heatmap to share Chart.js's tooltip/theming/hover machinery with the rest of the dashboard. See Architecture Patterns § Heatmap for the plain-CSS-grid alternative, which needs zero new dependencies. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chartjs-chart-matrix` for the heatmap | Plain CSS grid (`display: grid`, 371 `<div>` cells, `background-color` from a distance→color scale function) | CSS grid needs zero new dependencies, matches the "vanilla TS, no heavy dependency" project ethos, and is trivially unit-testable (the color-scale function is pure). It loses Chart.js's built-in tooltip/hover/zoom and needs hand-rolled hover-tooltip wiring if hover detail is wanted. Given the phase's `depth: quick` config setting and the project's consistent avoidance of any charting dependency beyond Chart.js itself, **CSS grid is the better default recommendation** — reserve `chartjs-chart-matrix` for if the planner specifically wants Chart.js-native tooltip/zoom behavior on the heatmap. |
| Chart.js `TimeScale` (date-based x-axis) for D-06 step charts | `'linear'` x-scale over epoch-ms or day-index values with a custom tick `callback` | No `chartjs-adapter-date-fns`/`chartjs-adapter-luxon` dependency needed; matches the zero-precedent-for-TimeScale fact confirmed above and `detail-charts.ts`'s existing tick-callback pattern for x-axis formatting. |
| A stats/regression npm package for Riegel's least-squares fit | Hand-rolled ~10-line OLS over `(ln D, ln T)` pairs | The regression is one line of closed-form algebra (see Code Examples); a dependency is unjustified over-engineering for this. |
| An external age-grading calculation library (if one exists on npm) | Committed JSON factor tables + a small pure lookup/interpolation function | No mature, actively-maintained npm package for WMA age-grading was found during this research (see Open Questions) — the domain answer is "bundle the data, write ~30 lines of lookup code," not "find a library." |

**Installation:**
```bash
# Only if the planner selects the Chart.js-native heatmap over the CSS-grid alternative:
npm install chartjs-chart-matrix
```

**Version verification:** `npm view chart.js version` → `4.5.1` (matches `package.json`'s `^4.5.1`, already installed, no action needed). `npm view chartjs-chart-matrix version` → `3.0.5`, `npm view chartjs-chart-matrix peerDependencies` → `{ "chart.js": ">=3.0.0" }` (compatible with the installed 4.5.1). Both checked live against the npm registry on 2026-08-11.

## Package Legitimacy Audit

Only one candidate new package surfaced during this research, and it is optional (Claude's Discretion territory — see Alternatives Considered above; CSS grid is the recommended default).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `chartjs-chart-matrix` | npm | actively published, latest version time-stamped 2026-07-05 | 113,361/week (`api.npmjs.org/downloads/point/last-week`) | `github.com/kurkle/chartjs-chart-matrix` (kurkle is a Chart.js core-team maintainer) | `[OK]` (`slopcheck install chartjs-chart-matrix` — clean) | Approved, conditional on planner choosing the Chart.js-native heatmap path over CSS grid |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

No other new npm packages are recommended by this research. `slopcheck` was run successfully (`pip install slopcheck --break-system-packages` succeeded; `slopcheck install chartjs-chart-matrix` completed and returned `[OK]`) — the graceful-degradation clause does not apply here.

**Process note:** `slopcheck install` performs a real `npm install` as a side effect of checking. This research reverted the resulting `package.json`/`package-lock.json` changes after recording the verdict (`git checkout -- package.json package-lock.json`), since installing a dependency is an execution-phase decision, not a research one. If the planner selects this package, the actual `npm install chartjs-chart-matrix` should happen as a plan task.

## Architecture Patterns

### System Architecture Diagram

```
                     BUILD TIME (Node CLI, `compute-all-stats` chain)
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  data/streams/*.json ──┐                                                  │
│  (1,687 HR streams)    │                                                  │
│                        ▼                                                  │
│           compute-training-load.ts (NEW)                                  │
│           - per-activity Edwards + Banister TRIMP (from HR stream)        │
│           - walks a continuous daily date spine (first→last activity)     │
│           - recursive CTL/ATL decay, TSB = yesterday's CTL − yesterday's ATL │
│                        │                                                  │
│                        ▼                                                  │
│           data/stats/training-load.json (gitignored, generated)           │
│                                                                            │
│  data/config/athlete.json ──┐   (birthDate, sex — D-12, D-20)             │
│  data/best-efforts.json ────┤                                             │
│  data/wma-*.json (NEW,      │                                             │
│    committed factor tables) │                                             │
│                              ▼                                            │
│           compute-age-grading.ts (NEW)                                    │
│           - looks up/interpolates WMA factor per distance/age/sex         │
│           - emits ONLY the resulting percentage per PR entry              │
│                        │                                                  │
│                        ▼                                                  │
│           data/stats/age-grading.json (gitignored, generated)             │
│                                                                            │
│  data/activities/*.json ──┐                                               │
│  data/config/gear.json ───┤                                               │
│                            ▼                                              │
│           compute-dashboard-index.ts (EXTENDED, D-17)                     │
│           - resolves gear_id → name into each index row                   │
│                        │                                                  │
│           compute-gear-aggregate.ts (NEW, D-17)                           │
│           - per-shoe distance/runs/avg pace/avg HR/date range             │
│                        │                                                  │
│                        ▼                                                  │
│           data/stats/gear-aggregate.json (gitignored, generated)          │
│                                                                            │
│  scripts/build-widgets.mjs copyDataFiles ──► dist/widgets/data/...        │
│  (D-22: EVERY new file above must be added here or it 404s in prod)       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼  (published JSON, fetched by the SPA)
                     CLIENT (Browser, vanilla TS, light DOM)
┌──────────────────────────────────────────────────────────────────────────┐
│  #/records (D-02: single scroll + sticky jump list)                       │
│    ├─ 7× top-10 tables (data/stats/best-efforts.json → rankings)          │
│    │    + age-grade column (data/stats/age-grading.json, D-10)            │
│    ├─ 7× PR-evolution step charts (wasPRAtTheTime efforts, D-06)          │
│    ├─ Race Predictions section (Riegel matrix, CLIENT-COMPUTED, D-21)     │
│    └─ Superlatives (streaks.json, weekly/monthly-stats.json max(), D-01)  │
│                                                                            │
│  #/trends?tab=volume|yoy|cadence-hr|training-load|gear (D-02, D-03)       │
│    ├─ Volume tab: weekly/monthly charts + year heatmap (D-04)             │
│    ├─ YoY tab: year-over-year.json, presentation only                    │
│    ├─ Cadence/HR tab: CLIENT-COMPUTED monthly means over index (D-21)    │
│    ├─ Training-load tab: training-load.json → CTL/ATL/TSB chart,          │
│    │    thin-HR-coverage shading (D-15), Edwards/Banister toggle (D-14)   │
│    └─ Gear tab: gear-aggregate.json, Unknown bucket (D-18)                │
│                                                                            │
│  #/activity/:id detail view (D-08 additions)                              │
│    ├─ Named PR badges in stats header                                     │
│    └─ Best-efforts panel (every effort this run produced, PR highlighted) │
└──────────────────────────────────────────────────────────────────────────┘
```

A reader can trace REC-06 end-to-end: `data/config/athlete.json` (birthDate/sex) + committed WMA tables → `compute-age-grading.ts` → `data/stats/age-grading.json` → fetched by the Records page → rendered as a column in the top-10 tables. Every arrow crossing the build/client boundary is a published JSON file that `copyDataFiles` must carry (D-22) and `verify-dashboard-publish.mjs` should assert reaches production (see Validation Architecture).

### Recommended Project Structure

Mirrors the established `src/analytics/compute-*.ts` + `src/dashboard/views/*-logic.ts` + `*.test.ts` split (17-precedent named explicitly in CONTEXT.md's Claude's Discretion):

```
src/analytics/
├── compute-training-load.ts       # NEW build step: TRIMP + CTL/ATL/TSB
├── training-load.types.ts         # NEW: TrainingLoadDocument, DailyLoadPoint
├── compute-age-grading.ts         # NEW build step: WMA lookup/interpolation
├── age-grading.types.ts           # NEW: AgeGradingDocument, per-PR-entry %
├── compute-gear-aggregate.ts      # NEW build step: per-shoe rollups (D-17)
├── gear-aggregate.types.ts        # NEW
├── wma-factors.ts                 # NEW: pure lookup/interpolation over the committed tables
├── riegel.ts                      # NEW: pure T2=T1*(D2/D1)^b + OLS fit (client-safe, no Node-only imports)
└── trimp.ts                       # NEW: pure Edwards/Banister formulas over a {t[], hr[]} stream

data/
├── wma/                           # NEW, committed, hand-sourced (schemaVersion/note convention)
│   ├── road-factors.json          # 5k/10k/half/marathon, male+female, by age
│   ├── track-factors.json         # 400m/mile (+ 800m, needed for 1k interpolation)
│   └── README or `note` field documenting edition/year and source

src/dashboard/views/
├── records.ts                     # replaces records.stub.ts
├── records-logic.ts                # pure: table sort/empty-state, Riegel matrix build, superlative selection
├── records-logic.test.ts
├── records-charts.ts               # Chart.js: 7 stepped small multiples (lazy chunk boundary, mirrors detail-charts.ts)
├── trends.ts                       # replaces trends.stub.ts, tab dispatch
├── trends-volume-logic.ts          # pure: weekly/monthly transforms, heatmap cell-color scale
├── trends-training-load-logic.ts   # pure: HR-coverage-gap detection for shading spans
├── trends-charts.ts                # Chart.js: volume/YoY/cadence-HR/training-load bands
└── trends-gear-logic.ts            # pure: Unknown-bucket grouping, coverage percentage
```

### Pattern 1: Stepped small-multiples with a shared duration y-axis formatter

**What:** Seven independent Chart.js `line` instances, each `stepped: 'after'` (record holds at the old value until the moment it falls — this is what "step down" visually means; confirm 'after' not 'before' against the small progression table, but 'after' is the standard convention for step-function record charts).
**When to use:** D-06's PR-evolution grid.
**Example:**
```typescript
// Pattern synthesized from Chart.js 4.5 official docs (stepped line) +
// this repo's existing detail-charts.ts duration-tick-callback convention.
// Source: https://www.chartjs.org/docs/latest/charts/line.html (stepped property)
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip } from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

new Chart(canvas, {
  type: 'line',
  data: {
    datasets: [{
      data: prEvolutionPoints, // [{x: epochMs, y: durationSec}, ...] ascending by date
      stepped: 'after',
      pointRadius: 3,
      borderWidth: 2,
      fill: false,
    }],
  },
  options: {
    parsing: false,
    scales: {
      x: { type: 'linear', ticks: { callback: (v) => new Date(Number(v)).getUTCFullYear() } },
      y: {
        type: 'linear',
        reverse: true, // faster (smaller) time visually higher — Claude's Discretion per CONTEXT.md, but conventional for "record improves" charts
        ticks: { callback: (v) => formatDuration(Number(v)) },
      },
    },
    plugins: { tooltip: { callbacks: { label: (ctx) => formatDuration(Number(ctx.parsed.y)) } } },
  },
});
```
Chart.js's `stepped` property, values `false | true | 'before' | 'after' | 'middle'`, is confirmed current in the official docs [CITED: chartjs.org/docs/latest/charts/line.html]. There is no native "duration scale" in Chart.js — every source found uses the same `ticks.callback` pattern shown above, which is also exactly what `detail-charts.ts`'s `formatXTick`/`formatPaceValue` already do in this codebase (reuse those functions' shape rather than reinventing).

### Pattern 2: Managing ~15 chart instances across one page/tabbed view

**Facts, not a decree (this is explicitly Claude's Discretion in CONTEXT.md):**
- `detail-charts.ts` already solves canvas reuse for 4 simultaneous bands: it keeps a `destroy()` handle returned from `mountChartBands`, and its internal `rebuildBands()` calls `chart.destroy()` on every existing band before creating new ones (see the file's `rebuildBands` function). Reuse this exact handle-return-and-destroy shape for both Records' 7-chart grid and each Trends tab.
- The "Canvas is already in use" error (`Chart with ID 'N' must be destroyed before the canvas can be reused`) [CITED: multiple GitHub issues, e.g. chartjs/Chart.js-adjacent reactchartjs/react-chartjs-2#675/#665/#1037] happens specifically when a `new Chart(canvas, ...)` is called on a canvas element that still has a live Chart.js instance attached — either destroy the prior instance first, or ensure the DOM node itself is recreated (not reused) between mounts.
- **Records' 7-chart grid (D-06):** since D-02 makes Records a single scrolling page (not tabbed), all 7 evolution charts mount once on page load and are never rebuilt unless the page itself remounts. Destroy-on-unmount (matching the view registry's `unmount?()` hook, `view.types.ts`) is sufficient; no tab-switch churn to handle.
- **Trends' 5 tabs (D-03):** each tab's charts build lazily on first open (per D-02/17-D25 pairing). Two real options: (a) destroy every tab's charts on tab switch and rebuild on return — simplest, matches `detail-charts.ts`'s existing `rebuildBands` idiom, costs a rebuild (cheap — Chart.js instantiation is fast, and the data is already fetched/cached) each time the user revisits a tab; (b) keep all previously-opened tabs' Chart.js instances alive (just hidden via `display:none` on their container) — avoids rebuild cost and preserves any in-chart hover/zoom state, but every hidden `<canvas>` stays a live Chart.js instance consuming memory, and Chart.js instances behind a `display:none` ancestor can mis-measure their `chartArea` on first paint (call `chart.resize()` when un-hiding). Given the phase's "quick" depth and this repo's precedent (`detail-charts.ts` always destroys-and-rebuilds on any state change, never keeps a hidden chart alive), **(a) is the lower-risk default** — flag as recommended, not mandated, since CONTEXT.md leaves it open.

### Pattern 3: Year consistency heatmap (D-04) — GitHub-style 53×7 grid

**What:** Chart.js has no native heatmap chart type; the two real options are the `chartjs-chart-matrix` plugin (Supporting Stack table above) or a plain CSS grid.
**Recommendation:** CSS grid — 371 (53×7) `<div>` cells in a `display: grid` container, `background-color` computed by a pure function `distanceToColor(km: number, maxKm: number): string` reusing the existing orange accent scale already established for the calendar view's day-cell tinting (`.planning/phases/17.../17-CONTEXT.md` D-14: "cell tinted by distance using the existing orange accent scale"). This is directly analogous to 17-D14's calendar day-cell tinting, just at year-grid granularity instead of month-grid — reuse that color-scale function rather than writing a second one.
**When to use:** Default choice, per Alternatives Considered above — avoids a new dependency and is trivially unit-testable (the color-scale function and the day-to-grid-cell placement math are both pure).
**Example:**
```typescript
// Pure, unit-testable — placement math only, no DOM.
// GitHub's own layout convention: columns = weeks, rows = Sun(0)..Sat(6).
function buildYearGrid(dailyTotals: Map<string /* YYYY-MM-DD */, number>, year: number) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const startCol = 0; // week index of Jan 1, offset so weeks align to the actual calendar
  const cells: { week: number; dow: number; dateISO: string; km: number }[] = [];
  const cursor = new Date(jan1);
  let week = 0;
  while (cursor.getUTCFullYear() === year) {
    const dow = cursor.getUTCDay(); // 0=Sun..6=Sat, matches GitHub's own convention
    const iso = cursor.toISOString().slice(0, 10);
    cells.push({ week, dow, dateISO: iso, km: dailyTotals.get(iso) ?? 0 });
    if (dow === 6) week++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}
```
The daily totals this needs are NOT currently published anywhere — `weekly-distance.json` is weekly-granularity. Planning must decide whether to derive daily totals client-side from the in-memory dashboard index (D-21-style, cheap: one pass over 1,867 rows grouping by `startDateLocal.slice(0,10)`) or add a new build-time daily-totals file. Client-side derivation is recommended (matches D-21's "everything derivable from what's already fetched" principle) and needs no new compute step.

### Anti-Patterns to Avoid
- **Fetching or computing HR-stream data client-side for TRIMP/CTL/ATL:** ~142MB of stream files across the archive (D-20 is explicit and correct — this must be a build step, never attempted in the browser).
- **Publishing raw `birthDate`/`sex` to the served artifact:** see Common Pitfalls #1 — the existing `copyDataFiles` wholesale-copies `data/config/*.json`.
- **A `TimeScale`/date-adapter dependency for step charts:** unnecessary; `'linear'` + tick callback is the established, dependency-free pattern already proven in this codebase.
- **Re-deriving best-effort or PR data:** 15-D06 locks `best-efforts.json` as read-only input; Phase 18 never recomputes it.
- **A single shared Trends date-range control:** explicitly rejected by D-03 — every tab handles its own window.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub-style year heatmap rendering | A generic charting/heatmap engine | Plain CSS grid + the existing distance→color scale function (17-D14 precedent) OR `chartjs-chart-matrix` if Chart.js-native tooltips are wanted | 371 cells is trivial DOM; no library needed for the common case |
| Duration (seconds→m:ss/h:mm:ss) axis formatting | A custom Chart.js scale type | `ticks.callback` on a standard `'linear'` scale | Chart.js has no native duration scale (confirmed across 5+ independent sources); `callback` is the universal, documented pattern |
| Least-squares exponent fit for Riegel | A stats/regression npm dependency | ~10-line closed-form OLS over `(ln D, ln T)` — see Code Examples | Simple linear regression on 2 variables has a closed-form solution; a dependency is unjustified |
| WMA age-grading calculation | Reimplementing the WMA committee's statistical model | Committed factor-table JSON + a lookup/interpolation function | The factor values themselves are the product of decades of masters-athletics statistical work; only the *lookup* is code |

**Key insight:** Every "don't hand-roll" risk in this phase is about *data* (WMA tables, whether to write a new compute step) not *algorithms* — the algorithms themselves (TRIMP sums, CTL/ATL recursion, Riegel regression) are short enough that hand-rolling them correctly, with unit tests, is the right call and matches this codebase's existing style (`best-effort-utils.ts`, `streak-utils.ts` are all hand-rolled pure functions, not library calls).

## Common Pitfalls

### Pitfall 1: `data/config/athlete.json`'s new PII fields get published wholesale (HIGH severity, must be resolved during planning, not discretionary)
**What goes wrong:** D-12 adds `birthDate` and `sex` to `data/config/athlete.json`. `scripts/build-widgets.mjs`'s `copyDataFiles` (confirmed by direct read) copies **every** `*.json` file in `data/config/` to `dist/widgets/data/config/` — this is the *entire directory*, wholesale, with no per-field filtering. Unless changed, an exact `birthDate` becomes public, plaintext, permanently-archived (GitHub Pages history) data on a personal website.
**Why it happens:** D-20 states the correct *goal* ("Precomputing means only the resulting percentages reach the published payload, keeping identity inputs out of the served artifact") but that goal is only true of the *derived stats output* (`age-grading.json`). It says nothing about the *raw config input file itself*, which is a separate artifact already on the wholesale-copy list from Phase 17.
**How to avoid:** Split into two files: keep `data/config/athlete.json` as the existing, already-public shape (`maxHr`, `hrZones` — needed client-side for the DETAIL-05 zone panel) and add a new file, e.g. `data/config/athlete-private.json` (`birthDate`, `sex`, `restingHr`), that the **build-time compute steps read directly from the local filesystem but that is explicitly excluded from `copyDataFiles`'s directory list** (either by moving it out of `data/config/` into an un-copied directory, or by changing `copyDataFiles` from a directory-wildcard copy to a per-file allow-list). `verify-dashboard-publish.mjs` should assert the private file returns 404 in production, mirroring its existing pattern of asserting a stream-unavailable activity 404s (an explicit "this must NOT be reachable" check, not just "this must be reachable").
**Warning signs:** Any test/checkpoint that only checks "the athlete config loads correctly" without also checking "the raw birthDate never appears in an HTTP response" will pass while shipping the leak — this is exactly the class of defect Phase 16's black-page postmortem warns about (asserting a shape without asserting the *absence* of a shape).

### Pitfall 2: TRIMP computed from decimated, non-uniform HR streams as if uniformly sampled
**What goes wrong:** `stream.types.ts` confirms committed streams are decimated (variable sample intervals), not fixed-Hz. A TRIMP implementation that does `sum(hr[i]) / n * duration` or otherwise assumes uniform sampling will silently misweight activities with irregular decimation.
**Why it happens:** Most TRIMP formula writeups (including the sources found in this research) are phrased for continuous/uniform data; none discuss decimated streams because that's specific to this project's storage format.
**How to avoid:** Integrate by actual elapsed time between consecutive samples, exactly as `detail-charts-logic.ts`'s `derivePaceSeries` already does for pace (real `Δt` from the `t` array, never a fixed sample count). For each sample `i` (except the last), compute `Δt_min = (t[i+1] - t[i]) / 60`, weight that duration by the zone (Edwards) or exponential HRr term (Banister) evaluated at `hr[i]` (or the average of `hr[i]`/`hr[i+1]`), and sum.
**Warning signs:** TRIMP values that don't scale sensibly with activity duration, or that differ wildly between two runs of similar length/intensity but different decimation density.

### Pitfall 3: CTL/ATL computed only over days with activities, not a continuous spine
**What goes wrong:** If the CTL/ATL recursion only steps forward on days that have a logged run, the decay term (`(load - yesterday) * (1 - e^(-1/τ))`) never applies across rest days or gaps, producing a CTL series that doesn't decay during breaks — defeating the entire point of a fitness/freshness chart.
**Why it happens:** It's natural to iterate "per activity" (matching every other build step in this codebase, which is activity-indexed) rather than "per calendar day," and the codebase has no existing daily-date-spine helper (`date-utils.ts` only has week/month/year start functions, confirmed by direct read) to model this off of.
**How to avoid:** Walk every calendar day (UTC midnight, matching `streak-utils.ts`'s `normalizeToUTCMidnight` convention) from the first to the last activity date (or the archive's full span per D-16), summing that day's TRIMP (0 if no activity) and applying the decay recursion every day regardless of whether it had training.
**Warning signs:** A CTL/ATL/TSB chart that looks like a staircase with no downward slope during multi-week gaps (e.g. the ~180 no-HR-run gaps D-15 explicitly calls out, or any injury/travel break in the 14-year archive).

### Pitfall 4: TSB using today's CTL/ATL instead of yesterday's
**What goes wrong:** TSB computed as `CTL[today] - ATL[today]` (rather than `CTL[yesterday] - ATL[yesterday]`) folds today's own training stress into the "form" reading for today, which inverts the metric's intended meaning (form going *into* today's session, before it happens).
**Why it happens:** It's the more obvious off-by-one to write; several web sources state the formula loosely as "TSB = CTL − ATL" without specifying which day's values.
**How to avoid:** Confirmed via 3+ independent sources (TrainerRoad, RaceLabs, Steven Lord's formula writeup): `TSB[today] = CTL[yesterday] - ATL[yesterday]`. Store both and be explicit about the day offset in the compute step and its output schema (e.g., document that the emitted `tsb` field for date D is derived from D-1's CTL/ATL).
**Warning signs:** A TSB series with no daily lag relative to CTL/ATL — visually, TSB should feel like it "trails" a spike in training rather than moving in lockstep with it.

### Pitfall 5: Age-grade formula direction inverted
**What goes wrong:** Because the formula involves both a division by actual time AND a division by the age factor, an implementation error easily produces a formula that's internally consistent-looking but numerically wrong (e.g., multiplying by the age factor instead of dividing, which inverts the age-reward direction and makes younger-relative-to-peak athletes score higher on the same time — instead of older ones).
**Why it happens:** Multiple algebraically-equivalent phrasings exist across sources ("age-graded time = actual × factor, then standard/that" vs "(standard/actual)/factor") and it's easy to drop a term when translating prose to code.
**How to avoid:** Use the single canonical form confirmed by this research and its worked example: `ageGradePercent = (openStandardSec / actualSec) / ageFactor * 100`, where `ageFactor` is ≤1.0 and *decreases* as age moves away from the 25-35 peak. Verify against the worked example found: 5K open standard 769s, age-50 male factor 0.8775, actual 1500s → `(769/1500)/0.8775*100 ≈ 58.4%`.
**Warning signs:** A 25-year-old's age-grade never differing meaningfully from an 80-year-old's on comparable relative performances, or age-grade percentages dropping (rather than holding steady/rising) for masters athletes who genuinely perform at their age-adjusted best.

### Pitfall 6: Riegel exponent fit treated as automatically informative
**What goes wrong:** Already demonstrated live in this archive (see below) — fitting `b` blindly across whatever PRs exist produces numbers that are artifacts of *how* the data was collected (splits within one run → near-constant pace → meaningless exponent near 1.0), not genuine fatigue-curve information.
**Why it happens:** The regression itself has no way to know that three of its inputs come from the same 21km run rather than three independent race efforts.
**How to avoid:** D-11's 3-distinct-activity guard is not optional — implement and enforce it. This research's live rebuild reconfirms the exact numbers CONTEXT.md cited: 5k (19:39.3), 10k (39:43.9), half (1:26:51.3) PRs are all activity `7827165619`; a naive fit across all 6 PRs would use only 4 distinct source activities (400m/1k/mile are each their own activity, but 5k/10k/half collapse to one) — comfortably clears the ≥3-distinct-activity bar today, but the guard must be evaluated by **distinct `activityId`**, not by count of PR rows, or a future archive state (e.g. if a new activity produces splits at 3 more distances) could silently violate the intent.
**Warning signs:** A fitted `b` far from the textbook 1.06 range that isn't accompanied by the "which distances / how many distinct activities" disclosure D-11 requires.

## Code Examples

Verified/synthesized patterns for this phase's core formulas — all hand-rollable, no dependency required.

### Edwards TRIMP over a decimated stream
```typescript
// Source: fellrnr.com/wiki/TRIMP + trainingimpulse.com/edwards-trimp (zone weights 1-5),
// adapted to this repo's decimated {t[], hr[]} stream shape per Pitfall 2 above.
import type { HrZoneBoundary } from '../dashboard/views/detail-zones.js'; // existing 5-zone config shape

function zoneForHr(hr: number, zones: HrZoneBoundary[]): number {
  for (const z of zones) {
    if (hr >= z.minBpm && (z.maxBpm === null || hr <= z.maxBpm)) return z.zone;
  }
  return 1; // below zone 1's floor — treat as zone 1, never throw
}

export function edwardsTrimp(t: number[], hr: number[], zones: HrZoneBoundary[]): number {
  let total = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const deltaMin = (t[i + 1] - t[i]) / 60;
    if (!(deltaMin > 0)) continue;
    const zone = zoneForHr(hr[i], zones);
    total += deltaMin * zone;
  }
  return total;
}
```

### Banister exponential TRIMP over a decimated stream
```typescript
// Source: fellrnr.com/wiki/TRIMP + trainingimpulse.com/banisters-trimp-0
// (Y = 0.64*e^(1.92x) male, Y = 0.86*e^(1.67x) female, x = HR-reserve fraction).
export function banisterTrimp(
  t: number[],
  hr: number[],
  restingHr: number,
  maxHr: number,
  sex: 'male' | 'female'
): number {
  const [a, b] = sex === 'male' ? [0.64, 1.92] : [0.86, 1.67];
  const hrReserve = maxHr - restingHr;
  if (!(hrReserve > 0)) return 0;

  let total = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const deltaMin = (t[i + 1] - t[i]) / 60;
    if (!(deltaMin > 0)) continue;
    const hrr = Math.max(0, Math.min(1, (hr[i] - restingHr) / hrReserve));
    total += deltaMin * hrr * a * Math.exp(b * hrr);
  }
  return total;
}
```

### CTL/ATL/TSB over a continuous daily spine
```typescript
// Source: TrainerRoad/RaceLabs/Steven Lord CTL/ATL/TSB writeups, cross-verified.
// Precise exponential form (preferred over the /τ linear approximation).
export interface DailyLoadPoint {
  dateISO: string; // YYYY-MM-DD, UTC
  trimp: number;   // 0 on rest days — see Pitfall 3
  ctl: number;
  atl: number;
  tsb: number;     // derived from the PRIOR day's ctl/atl — see Pitfall 4
}

const CTL_TAU_DAYS = 42;
const ATL_TAU_DAYS = 7;

function decay(prev: number, todayLoad: number, tauDays: number): number {
  const alpha = 1 - Math.exp(-1 / tauDays);
  return prev + (todayLoad - prev) * alpha;
}

export function computeCtlAtlTsb(dailyTrimpByDate: Map<string, number>, firstISO: string, lastISO: string): DailyLoadPoint[] {
  const points: DailyLoadPoint[] = [];
  let ctl = 0;
  let atl = 0;
  const cursor = new Date(firstISO + 'T00:00:00Z');
  const end = new Date(lastISO + 'T00:00:00Z');

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    const todayLoad = dailyTrimpByDate.get(iso) ?? 0;
    const tsb = ctl - atl; // yesterday's ctl/atl, captured BEFORE today's update — Pitfall 4
    ctl = decay(ctl, todayLoad, CTL_TAU_DAYS);
    atl = decay(atl, todayLoad, ATL_TAU_DAYS);
    points.push({ dateISO: iso, trimp: todayLoad, ctl, atl, tsb });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}
```

### Riegel prediction + guarded least-squares fit
```typescript
// Source: Riegel (1977), b≈1.06 textbook value; least-squares fit is
// standard log-log OLS (mathworld.wolfram.com/LeastSquaresFittingLogarithmic.html).
export const RIEGEL_STANDARD_B = 1.06;

export function riegelPredict(t1Sec: number, d1M: number, d2M: number, b: number = RIEGEL_STANDARD_B): number {
  return t1Sec * Math.pow(d2M / d1M, b);
}

/** Returns null (self-suppresses per D-11) when fewer than 3 distinct activities back the fit. */
export function fitRiegelExponent(
  points: { distanceM: number; durationSec: number; activityId: string }[]
): { b: number; distances: string[] } | null {
  const distinctActivities = new Set(points.map((p) => p.activityId));
  if (distinctActivities.size < 3) return null;

  const n = points.length;
  const xs = points.map((p) => Math.log(p.distanceM));
  const ys = points.map((p) => Math.log(p.durationSec));
  const xMean = xs.reduce((a, v) => a + v, 0) / n;
  const yMean = ys.reduce((a, v) => a + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  if (!(den > 0)) return null;
  const b = num / den; // slope of ln(T) vs ln(D) IS the Riegel exponent
  return { b, distances: points.map((p) => `${p.distanceM}m`) };
}
```

### Age-grade percentage (canonical direction — see Pitfall 5)
```typescript
// Source: cross-verified across icalculator.com, marathonhandbook.com, and a
// worked numeric example (5K standard 769s, age-50-male factor 0.8775,
// actual 1500s -> 58.4%) found during this research. [MEDIUM confidence —
// not fetched from a single official WMA PDF; see Open Questions.]
export function ageGradePercent(openStandardSec: number, actualSec: number, ageFactor: number): number {
  if (!(actualSec > 0) || !(ageFactor > 0)) return 0;
  return (openStandardSec / actualSec / ageFactor) * 100;
}

/**
 * D-09: 1k has no WMA standard. Log-linear interpolation between the 800m
 * and mile track factors, matching the interpolation TECHNIQUE the
 * Alan Jones road-standards project itself uses for gap distances
 * (S6 = S5*(1-u) + S10*u, github.com/AlanLyttonJones/Age-Grade-Tables).
 */
export function interpolate1kFactor(factor800: number, factorMile: number): number {
  const d800 = 800;
  const dMile = 1609.344;
  const d1k = 1000;
  const u = (Math.log(d1k) - Math.log(d800)) / (Math.log(dMile) - Math.log(d800));
  return factor800 * (1 - u) + factorMile * u;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| WMA road-running standards (1989 WAVA, 2004/2006, 2010, 2015) | 2020 and 2025 road standards (Alan Jones project) | 2020, then 2025 revision | This phase should bundle the most recent road tables available (2025 or 2020, whichever has a stable machine-readable export at plan time) rather than an older edition — the numeric factors have materially changed across revisions per the source repo's own versioned-directory structure |
| WMA track & field standards (2006/2010) | 2023 track & field factors | 2023 | Same principle for the 400m/mile/800m track factors this phase's 1k interpolation depends on |

**Deprecated/outdated:** The pre-2020 road tables and pre-2023 track tables are both superseded; do not bundle an old edition just because it was the first search result — confirm the edition/year explicitly in the committed JSON's `note` field (matching this project's existing `schemaVersion`/`note` convention), so a future re-bundle is a deliberate, documented action rather than a silent drift.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact numeric WMA factor-table values (this research found the *source*, *format*, and *formula direction*, but did not extract and verify actual per-age/per-distance numbers into committed JSON) | Architecture Patterns § Age-Grading, Code Examples | If the planner or executor sources factor values from an unverified secondary calculator site rather than the primary Alan Jones (road, CC0) / WMA (track, official PDF) sources, age-grade percentages could be silently wrong for years before anyone notices — REC-06 has no independent way to self-check |
| A2 | `chartjs-chart-matrix` package name/API shape (existence, version, and peer-dependency compatibility ARE verified live against the npm registry; its actual usage API for building a matrix dataset was NOT fetched from its own README/docs in this session) | Standard Stack, Package Legitimacy Audit | Low risk — this is presented as an optional alternative to the recommended CSS-grid default, so a wrong API assumption only matters if the planner actively chooses this path |
| A3 | Age-grade formula direction: `(Standard/Actual)/AgeFactor*100`, confirmed via 3+ independent WebSearch sources plus a worked numeric example that checks out arithmetically, but not fetched from a single official WMA specification document | Common Pitfalls #5, Code Examples | If wrong, every age-graded percentage on the Records page is systematically incorrect (see Pitfall 5's failure signature for how to detect it) |
| A4 | Edwards TRIMP zone-weight boundaries (50-59%/60-69%/etc. of HRmax, weights 1-5) match what this project's committed `hrZones` (explicit bpm boundaries, not %HRmax-derived) should map onto 1:1 | Code Examples § Edwards TRIMP | The project's `athlete.json` zones are already explicit bpm boundaries (D-30 from Phase 17), not %HRmax bands — this research assumes the existing 5-zone config IS the Edwards zone table by construction (same zone count, same "zone 1 = easiest" ordering), which needs explicit confirmation since the *numeric boundaries* an athlete sets for training-zone purposes may not be textbook-Edwards-%HRmax-derived |
| A5 | `'after'` (not `'before'`) is the correct `stepped` value for "record holds until it falls" visual semantics | Architecture Patterns § Pattern 1 | Cosmetic only — swapping to `'before'` shifts exactly where the step occurs relative to the record-setting date by one visual segment; easy to eyeball-correct during the manual browser checkpoint |

## Open Questions

1. **What are the actual WMA factor-table numeric values, and which committed source is authoritative?**
   - What we know: The Alan Jones road-standards project (`github.com/AlanLyttonJones/Age-Grade-Tables`, CC0-1.0, confirmed license) publishes 2020 and 2025 road tables as `.xlsx` files covering 5K/10K/half/marathon by age and sex. Howard Grubb's site (`howardgrubb.co.uk/athletics/wmatnf23.html`) offers a 2023 WMA track & field Excel export covering the events needed for 400m/mile/800m.
   - What's unclear: Neither file was actually downloaded and parsed into JSON during this research session (Excel binary parsing wasn't attempted). The exact column layout, age granularity (single-year vs 5-year bands — the search found "originally ages 30+, expanded to ages 8-19," implying single-year rows), and whether the 800m factor needed for 1k interpolation is present in the same file as the mile factor all need confirmation before a compute step can be written against them.
   - Recommendation: Wave 0 or an early plan task should download both Excel files, convert to the committed JSON shape this research recommends (`data/wma/road-factors.json`, `data/wma/track-factors.json`), and spot-check 2-3 known reference values (e.g. the worked example: 5K standard 769s / age-50-male factor 0.8775) against the parsed data before trusting it archive-wide.

2. **Does the Alan Jones road-standard "Open Standard" reference time match the WMA track "Open Standard" convention closely enough to treat road and track age factors as directly comparable within one age-grade formula?**
   - What we know: Both use the same overall formula shape (Standard/Actual/Factor).
   - What's unclear: Road and track standards are independently derived projects (Alan Jones's road project explicitly separate from WMA's own track & field committee); their peak-age reference times could in principle be calibrated slightly differently.
   - Recommendation: Not blocking — D-09 already accepts this (road uses road factors, track uses track factors, 1k is explicitly labelled derived/interpolated). Just don't attempt to build a single continuous factor curve across the road/track boundary; keep them as two separate lookup tables as D-09 already specifies.

3. **Should the Edwards TRIMP zone weights be derived from the athlete's committed bpm zone boundaries (as this research assumes, A4) or recomputed from %HRmax against `maxHr`?**
   - What we know: D-14 says Edwards TRIMP's "only input is the five bpm boundaries already in `athlete.json`."
   - What's unclear: D-14's own wording settles this — use the explicit bpm boundaries directly, not a %HRmax recomputation. This question is effectively answered by D-14 itself; included here only to flag that A4 should be treated as confirmed by D-14's text, not as an independent research gap.
   - Recommendation: No further research needed — implement per D-14's explicit statement.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build-time compute steps | ✓ | v25.2.1 | — |
| npm | Package install, scripts | ✓ | 11.7.0 | — |
| TypeScript | `npm run build` (tsc) | ✓ | 5.9.3 | — |
| `chart.js` | All new charts | ✓ (already installed) | 4.5.1 | — |
| `chartjs-chart-matrix` | Optional Chart.js-native heatmap (see Alternatives Considered) | ✗ (not installed; verified installable) | 3.0.5 on registry | CSS grid (recommended default, needs no install) |
| Headless browser (Playwright/Puppeteer) | Would enable automated canvas-rendering assertions | ✗ (not in `devDependencies` — confirmed by direct `package.json` read: only `terser`, `typescript`, `vite`, `vite-plugin-css-injected-by-js`, `vitest`) | — | Manual browser checkpoint (the same fallback Phase 16 and 17 already use — no regression, but also no improvement on this front unless the planner explicitly chooses to add one) |
| `jsdom`/`happy-dom` | Would enable DOM-level unit tests for chart-mounting code | ✗ (confirmed absent; `vitest.config.ts` sets `environment: 'node'`) | — | Pure-function unit tests only (the established Phase 17 pattern); DOM/canvas verified manually |

**Missing dependencies with no fallback:** none — every gap has a working fallback already proven in Phase 17.

**Missing dependencies with fallback:** `chartjs-chart-matrix` (→ CSS grid), headless browser (→ manual checkpoint), `jsdom` (→ pure-function tests + manual checkpoint). None of these block the phase; they only bound what automated verification can prove (see Validation Architecture).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (installed, confirmed via Phase 17's validation record) |
| Config file | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']` |
| Quick run command | `npm test -- --run src/analytics` (new compute-step logic) and `npm test -- --run src/dashboard` (new view logic) |
| Full suite command | `npm test` (`vitest run`, currently 592/592 passing per 17-VALIDATION.md, sub-second) |

**Critical constraint, carried forward from Phase 17 unchanged:** no `jsdom`/`happy-dom`, `environment: 'node'` means `document`/`window`/canvas rendering are untestable in this repo's test suite. Every automated test this phase adds MUST target pure functions (TRIMP formulas, CTL/ATL recursion, Riegel fit, age-grade lookup/interpolation, heatmap cell-placement math, table sort/empty-state logic) with zero DOM dependency — exactly the `*-logic.ts` pattern already established.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REC-02 | `rankings.marathon` empty-array renders a proper empty state, not a crash | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ❌ Wave 0 |
| REC-03 | PR-evolution step-chart data derivation from `wasPRAtTheTime` efforts (ascending by date, one series per distance) | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ❌ Wave 0 |
| REC-04 | Detail-view PR badge + best-efforts panel rendering | manual (canvas/DOM, per Test Infrastructure constraint) | real-browser checkpoint | n/a — no jsdom |
| REC-05 | Superlative selection (`max()` over weekly/monthly-stats), streak surfacing | unit | `vitest run src/dashboard/views/records-logic.test.ts` | ❌ Wave 0 |
| REC-06 | Age-grade lookup/interpolation formula correctness (esp. 1k interpolation, factor-direction per Pitfall 5) | unit | `vitest run src/analytics/wma-factors.test.ts` | ❌ Wave 0 |
| REC-07 | Riegel matrix + fitted-exponent guard (3-distinct-activity self-suppression) | unit | `vitest run src/analytics/riegel.test.ts` | ❌ Wave 0 |
| TREND-01 | Volume chart data transforms; year-heatmap cell placement/color-scale | unit | `vitest run src/dashboard/views/trends-volume-logic.test.ts` | ❌ Wave 0 |
| TREND-02 | Year-over-year presentation (mostly pass-through of existing `year-over-year.json`) | unit | `vitest run src/dashboard/views/trends-yoy-logic.test.ts` | ❌ Wave 0 (may be thin — verify shape, not much transform logic) |
| TREND-03 | Client-side monthly cadence/HR mean computation over the in-memory index | unit | `vitest run src/dashboard/views/trends-cadence-hr-logic.test.ts` | ❌ Wave 0 |
| TREND-04 | Edwards/Banister TRIMP formulas; CTL/ATL/TSB recursion (esp. continuous-spine + TSB day-offset per Pitfalls 3/4) | unit | `vitest run src/analytics/trimp.test.ts` + `vitest run src/analytics/training-load.test.ts` | ❌ Wave 0 |
| TREND-05 | Gear aggregate grouping, Unknown-bucket coverage math | unit | `vitest run src/dashboard/views/trends-gear-logic.test.ts` | ❌ Wave 0 |
| all | New data files (`training-load.json`, `age-grading.json`, `gear-aggregate.json`, `data/wma/*.json`) reachable in production; `athlete-private.json` (if the Pitfall 1 split is adopted) explicitly NOT reachable | integration (HTTP) | `npm run build-widgets && npm run verify-dashboard` (EXTEND `verify-dashboard-publish.mjs`) | extends existing file |

### Sampling Rate
- **Per task commit:** `npm test -- --run src/analytics` and/or `src/dashboard` (whichever the task touches)
- **Per wave merge:** `npm test` **plus** `npm run build-widgets && npm run verify-dashboard`
- **Phase gate:** Full suite green, `verify-dashboard` green (extended per Pitfall 1's negative-reachability check), AND a real-browser manual checkpoint covering every item in Wave 0 Gaps' "DOM/canvas" column below — before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/analytics/trimp.test.ts` — Edwards + Banister formula correctness over synthetic decimated streams (covers TREND-04, Pitfall 2)
- [ ] `src/analytics/training-load.test.ts` — CTL/ATL/TSB recursion, continuous daily spine over a gap, TSB day-offset (covers TREND-04, Pitfalls 3/4)
- [ ] `src/analytics/riegel.test.ts` — prediction formula + guarded fit, including the exact live-archive scenario (single-activity-splits producing a near-1.0 exponent that must be excluded by the distinct-activity count, not row count) (covers REC-07, Pitfall 6)
- [ ] `src/analytics/wma-factors.test.ts` — lookup + 1k log-linear interpolation, formula-direction regression test pinned to the worked numeric example (covers REC-06, Pitfall 5)
- [ ] `src/dashboard/views/records-logic.test.ts`, `trends-*-logic.test.ts` — table/chart data-transform pure functions (covers REC-02/03/05, TREND-01/02/03/05)
- [ ] Extend `scripts/verify-dashboard-publish.mjs`: assert every new `data/stats/*.json` and `data/wma/*.json` file returns 200 with the expected top-level shape (`schemaVersion`, non-empty payload); assert `data/config/athlete-private.json` (or whatever the Pitfall 1 resolution names it) returns 404 — the FIRST negative-reachability assertion in this script, a new class of check this phase specifically needs
- [ ] A written real-browser checkpoint script (mirroring `17-15-PLAN.md`'s walkthrough) that explicitly enumerates: all 7 PR-evolution charts render with a visible step and correct axis direction; the heatmap grid renders 53×7 with no overlapping cells; the training-load chart's thin-HR-coverage shading is visually distinguishable from zero-load; switching Trends tabs does not throw "Canvas is already in use"; the Edwards/Banister toggle actually changes the rendered series (not just a label)

*Nothing else identified as a gap beyond what's listed — the existing Wave 0 files from Phase 17 (`list-logic.test.ts`, `calendar-logic.test.ts`, `detail-splits.test.ts`, `detail-zones.test.ts`, `gear-client.test.ts`, `athlete-config-client.test.ts`) already cover their requirements and need no Phase 18 changes except `athlete-config-client.test.ts` gaining cases for the new `birthDate`/`sex`/`restingHr` fields (D-12).*

## Security Domain

`security_enforcement` is absent from `.planning/config.json`'s `workflow` block — per the stated default, treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-user static site, no login (unchanged from Phases 16-17) |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No access control boundaries — everything published is, by design, public |
| V5 Input Validation | Yes | Trends' `?tab=` query param must be allow-listed against the 5 known tab values (mirrors 17-D07/`list-logic.ts`'s sort-key allow-listing pattern — `parseHash`/query parsing already has this convention); any new `localStorage` persistence (e.g. Edwards/Banister toggle preference, chart y-scale share preference) must validate on READ, not just write, per `detail-charts-logic.ts`'s `parseOverlayConfig` precedent |
| V6 Cryptography | No | Not applicable — no crypto in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Public artifact carries PII (`birthDate`, `sex`) beyond what the feature actually needs to serve client-side | Information Disclosure | See Common Pitfalls #1 — split the config file so only derived percentages, never raw identity fields, reach `dist/widgets/`; add a negative (404-expected) check to `verify-dashboard-publish.mjs` |
| Unvalidated `?tab=` value used to key a lookup/dispatch table for mounting a Trends tab | Tampering (minor — client-only, no server-side effect, but can crash the SPA or mount an unintended view) | Allow-list against the 5 known tab keys, default to `volume` on any unrecognized value — same pattern as `list-logic.ts`'s sort-key/page-clamp validation |
| Athlete free-text or gear names rendered via `innerHTML` | Tampering / XSS | Continue the established `textContent`-only convention (T-16-VW-01) for any new rendering of `name`/gear labels; gear names are currently empty strings (D-19) but will contain real athlete-typed text once filled in, so this must not regress even though today's data is blank |
| Chart.js tooltip callbacks interpolating raw string data into DOM | Tampering / XSS | Chart.js's own tooltip renderer does not use `innerHTML` for label text by default; no deviation from Chart.js's built-in escaping is needed as long as no custom HTML tooltip plugin is introduced (none is recommended by this research) |
| `localStorage`-persisted TRIMP-model toggle (if implemented) read back without validation | Tampering (local, low severity — user's own browser storage) | Allow-list the stored value against `'edwards' \| 'banister'` on every read, exactly as `parseOverlayConfig` does for the existing overlay config — never trust a raw `JSON.parse` result |

## Sources

### Primary (HIGH confidence)
- Direct repository reads: `src/analytics/best-effort.types.ts`, `src/analytics/dashboard-index.types.ts`, `src/streams/stream.types.ts`, `src/analytics/compute-dashboard-index.ts`, `src/analytics/compute-best-efforts.ts`, `src/analytics/streak-utils.ts`, `src/analytics/date-utils.ts`, `src/dashboard/views/detail-charts.ts`, `src/dashboard/views/detail-charts-logic.ts`, `src/dashboard/data/gear-client.ts`, `src/dashboard/data/athlete-config-client.ts`, `src/dashboard/view.types.ts`, `scripts/build-widgets.mjs`, `scripts/verify-dashboard-publish.mjs`, `vitest.config.ts`, `package.json`
- Live rebuild + inspection of `data/stats/best-efforts.json`, `data/stats/{weekly-distance,monthly-stats,yearly-stats,year-over-year,streaks,all-time-totals}.json`, `data/streams/manifest.json`, `data/config/{athlete,gear}.json`, `data/dashboard/index.json`, `data/activities/*.json` (all schemas and row counts confirmed against the current archive, 2026-08-11)
- `npm view chart.js version`, `npm view chartjs-chart-matrix version/peerDependencies`, `api.npmjs.org/downloads/point/last-week/chartjs-chart-matrix`, `slopcheck install chartjs-chart-matrix` — all run live in this session
- [chartjs.org/docs/latest/charts/line.html](https://www.chartjs.org/docs/latest/charts/line.html) — `stepped` property values, confirmed current

### Secondary (MEDIUM confidence)
- [github.com/AlanLyttonJones/Age-Grade-Tables](https://github.com/AlanLyttonJones/Age-Grade-Tables) — CC0 road age-grading standards, 2020/2025 editions, Excel format
- [howardgrubb.co.uk/athletics/wmatnf23.html](https://howardgrubb.co.uk/athletics/wmatnf23.html) — WMA 2023 track & field factors, Excel export
- [fellrnr.com/wiki/TRIMP](https://fellrnr.com/wiki/TRIMP) — Edwards and Banister TRIMP formulas, per-sample computation note
- Multiple independently-authored age-grade calculator/explainer pages (icalculator.com, marathonhandbook.com, runbundle.com, miniwebtool.com) — cross-verified formula direction and a worked numeric example (5K standard 769s, age-50-male factor 0.8775, actual 1500s → 58.4%)
- Multiple independently-authored TSS/CTL/ATL/TSB explainer pages (TrainerRoad, RaceLabs, Roadman Cycling, Steven Lord's formula writeup, Paincave) — cross-verified both the linear-approximation and precise-exponential CTL/ATL forms, and the "yesterday's CTL/ATL" TSB convention
- GitHub issues (reactchartjs/react-chartjs-2 #675, #665, #1037) — "Canvas is already in use" error mechanics and the destroy-before-reuse fix

### Tertiary (LOW confidence)
- None of the load-bearing formula claims rest solely on a single unverified source — every numeric-formula claim in this document has 2+ independent corroborating sources plus, where possible, a worked numeric check. The one genuinely LOW-confidence item is the *exact WMA factor-table values* themselves (Open Questions #1), which this research did not extract into machine-readable form.

## Metadata

**Confidence breakdown:**
- Standard stack / rendering mechanics: HIGH — read directly from this repo's own source and official Chart.js docs; no new required dependency
- Domain formulas (age-grade, TRIMP, CTL/ATL, Riegel): MEDIUM — cross-verified across 3+ independent sources each with worked-example arithmetic checks, but not fetched from a single canonical primary specification document in every case
- WMA factor-table numeric values: LOW — source and format located, values not extracted; flagged as Open Question #1, the single highest-priority follow-up for planning/Wave 0
- Pitfalls: HIGH for the codebase-mechanical ones (Pitfall 1 public-artifact leak, Pitfall 2 decimated-stream integration, Pitfall 3 daily-spine requirement — all derived from direct source reads), MEDIUM for the formula-direction ones (Pitfalls 4/5 — cross-verified but not from a single primary source)

**Research date:** 2026-08-11
**Valid until:** 30 days for the codebase-mechanical findings (stable, low churn); no fixed expiry for the sports-science formulas (well-established, decades-old domain) but the WMA factor-table *edition* should be re-checked if planning is delayed past a WMA table revision announcement
