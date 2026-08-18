# Strava Analytics & Visualization Platform

## What This Is

A personal Strava data pipeline and visualization platform that fetches run data via the Strava API, computes custom statistics (aggregations, streaks, trends, patterns, geographic data), and produces embeddable Custom Element widgets and interactive map visualizations deployed to GitHub Pages. Ten widget types cover stats, comparisons, streaks, geographic tables, geographic statistics, route maps (single-run, multi-run overlay, route browser), heatmap, and pin map — all configurable via HTML attributes with dark/light theming and responsive sizing. Standalone full-page map views available alongside embeddable widgets. Lives in its own repo (strava-widgets), with a daily GitHub Actions pipeline for automated refresh including non-blocking geocoding.

## Core Value

Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## Current State

**In progress: v2.1 Interface Polish** — Phase 20 (row-click interaction pattern) complete 2026-08-18, 20 plans across five gap-closure rounds. Every activity row on every screen is now a real anchor: one keyboard stop per row landing on the Date link, modifier-clicks handled natively by the browser, and a shared `shouldNavigateOnRowClick` predicate consulted from both the row listener and each cell anchor so drag-select no longer navigates. UX-01/02/03 and REC-08 all closed. Two behaviours were put to the developer during the Round 5 browser checkpoint and accepted as shipped: the Date-cell anchor sits outside D-16's guard, and a double-click's first click still navigates. Phase 19 (design system & control styling) complete 2026-08-13, 17 plans across four gap-closure rounds. Phases 21-25 remain.

**Shipped: v2.0 Training Dashboard** (2026-08-12) — phases 14-18, 56 plans.

A full analytics dashboard lives at https://bacilo.github.io/strava-widgets/ as a static SPA over pre-computed JSON: hash routing across six views, committed per-activity streams for the whole archive, a self-computed best-effort engine, an activity browser with per-run pace/HR/cadence detail and route maps, and a Records + Trends layer covering PR tables and evolution, Riegel race predictions, WMA age-grading, volume/consistency/year-over-year, cadence & HR, CTL/ATL/TSB training load, and per-shoe gear analysis.

Milestone audit: `tech_debt` — 29/29 requirements satisfied, 0 blockers, 41/43 integration checks wired, 6/6 E2E flows. Deferred items are listed in STATE.md and `.planning/v2.0-MILESTONE-AUDIT.md`; the notable one is Phase 16's three unverified theme/first-paint UAT items.

<details>
<summary>v2.0 milestone goal and target features (archived)</summary>

**Goal:** A full analytics dashboard (static SPA on GitHub Pages) for browsing the complete running archive — activities with pace/cadence/HR detail, self-computed best-effort records, and weekly/monthly/yearly/all-time stats — built as a flexible foundation that many more functions can plug into over time.

**Target features:**
- Stream ingestion — parse time-series (pace, HR, cadence, elevation) from local Strava export FIT/GPX via provenance.json; intervals.icu streams for new activities going forward
- Activity browser — list/filter/sort the full archive; per-activity detail view with pace/HR/cadence charts and route map
- Best efforts — fastest 400m/1k/1mi/5k/10k/HM/marathon computed within each run from streams; PR lists per distance
- Records & trends — weekly/monthly/yearly/all-time aggregates and records
- Dashboard SPA shell — client-side routing over pre-computed JSON, designed for long-term extensibility

**Key context:** Flexibility was the explicit priority — not everything shipped. Static-only hosting constrains everything to pre-computed JSON.

</details>

## Current Milestone: v2.1 Interface Polish

**Goal:** Bring the whole dashboard up to the standard its best screens already set — consistent interaction, properly styled controls, and charts you can actually navigate.

**Target features:**
- Design system pass — style form controls (the stylesheet has zero `input` rules today), unify buttons and focus states, one spacing rhythm across all five screens
- Interaction consistency — every activity row clickable, redundant "view activity" CTAs removed, Overview and Records brought up to the Activities standard
- Overview rebuild — structured PR/activity rows, a current-year records tab, distance and hours this year in Headline Stats
- Calendar — selectable Sunday/Monday week start affecting week totals, totals at the end of each week row
- Trends — zoom and horizontal pan via `chartjs-plugin-zoom` with explicit +/− and arrow controls, taller chart bands
- Carried forward — exclusion tickbox via local curation mode, two code-review fixes, Phase 16's unverified theme items, two CI hardening items

**Key context:** Refinement, not new capability — the dashboard already does what it should and some screens are genuinely good. Scope came from a screen-by-screen walkthrough plus a source audit that traced complaints to root causes. Deliberately excludes a design-language refresh. Every requirement here is visual or interactive, and automated gates have missed rendering defects in this project three times, so each phase ends with a human browser checkpoint.

## Requirements

### Validated

- ✓ Strava OAuth authentication and token management — v1.0
- ✓ Fetch and store run activity data from Strava API — v1.0
- ✓ Weekly km aggregation and chart widget — v1.0
- ✓ Year-over-year totals (km, runs, hours) — v1.0
- ✓ Custom time-period aggregations (monthly, yearly) — v1.0
- ✓ Streak and pattern detection (consecutive run days, time-of-day, seasonal trends) — v1.0
- ✓ Embeddable widget system for static site consumption — v1.0
- ✓ Data refresh pipeline (daily automated rebuild via GitHub Actions) — v1.0
- ✓ Geographic data extraction from activities (countries, cities from GPS coordinates) — v1.1
- ✓ Geographic statistics (runs/distance per city and country, ranked lists, CSV export) — v1.1
- ✓ Geographic table widget with sortable columns and pagination — v1.1
- ✓ Widget customization via HTML data-attributes (title, labels, colors, size, theme) — v1.1
- ✓ Dark/light mode support with auto-detection — v1.1
- ✓ Responsive container-based widget sizing — v1.1
- ✓ All widgets migrated to Custom Elements — v1.1

- ✓ Accurate city-level geocoding via GeoNames (166K cities, replacing UN/LOCODE) — v1.2
- ✓ Multi-city tracking per run using decoded route polylines — v1.2
- ✓ Single-run route map widget with zoom/pan and auto-fit — v1.2
- ✓ Multi-run overlay widget showing latest N runs — v1.2
- ✓ Route browser widget with list selection and embedded map — v1.2
- ✓ Heatmap widget with date filtering and color scheme options — v1.2
- ✓ Pin map widget with city/country toggle and visual encoding — v1.2
- ✓ Standalone full-page views for heatmap, pin map, and route browser — v1.2
- ✓ Leaflet map infrastructure with Shadow DOM CSS injection and CDN externalization — v1.2

- ✓ Committed per-activity stream data (time, distance, HR, cadence, elevation) via local backfill + daily sync, with per-channel availability manifest (STREAM-01/02/03) — v2.0
- ✓ Best-effort engine — fastest 400m..marathon computed within every run from streams (REC-01) — v2.0
- ✓ Dashboard SPA shell — hash routing, document-level theming, lazy data contract (DASH-01/02/03) — v2.0
- ✓ Activity browser and detail views — filter/sort the archive, per-run pace/HR/cadence charts, route maps, splits and zones (BROWSE-01..06, DETAIL-01..05) — v2.0
- ✓ Records, trends & differentiators — PR tables with honesty badges, PR-evolution charts, Riegel race predictions, WMA age-grading, volume/consistency/year-over-year, cadence & HR, CTL/ATL/TSB training load, per-shoe gear analysis (REC-02..07, TREND-01..05) — v2.0

- ✓ Design system & control styling — shared box treatment for every input/select/textarea, one button baseline with shared hover and disabled states, a two-tone focus ring visible on any fill, and one card/panel/grid rhythm across all five screens (UI-01, UI-02, UI-03, ACT-01) — v2.1, Phase 19

### Active

**v2.1 Interface Polish** — Phase 19 complete; phases 20-25 remain (row-click interaction, Overview rebuild, calendar week start, Trends zoom/pan, local curation mode, CI hardening).

- STREAM-04 (Garmin export adapter) deferred out of v2.0 — blocked on the export arriving.

### Out of Scope

- Website redesign — this project outputs widgets, doesn't modify bacilo.github.io itself
- Social features — this is a personal dashboard, not multi-user
- Non-running activities — focus on runs only for now
- Mobile app — web widgets only
- Real-time Strava sync via webhooks — daily rebuild is sufficient
- AI training recommendations — massive scope, liability, sports science needed
- Map styling themes (topographic, neon, minimal) — deferred to future milestone
- Animated run playback on maps — deferred to future milestone
- Street View playback along runs — deferred to future milestone
- Maps as post/page backgrounds — deferred to future milestone
- Street-level geocoding — city-level is sufficient, poor accuracy at finer granularity
- Unlimited theme customization — controlled CSS variable presets, prevents layout breakage
- Every-street completion (Wandrer clone) — massive complexity, OpenStreetMap integration

## Context

Shipped v1.0 + v1.1 + v1.2 + v2.0. v2.0 added ~30,700 lines across src/scripts/CI in 56 plans (phases 14-18); 26,430 LOC of non-test TypeScript in src/ and 884 unit tests overall.
Tech stack: TypeScript, Node.js 22, Chart.js, Leaflet 1.9.4, Vite (IIFE bundles + the dashboard SPA), Custom Elements, Shadow DOM, GitHub Actions, vitest.
1,868 run activities synced; per-activity streams committed for the full archive; data pipeline migrated off the Strava API to intervals.icu (Aug 2026). 10 Custom Element widgets + 3 standalone pages deployed to GitHub Pages.
Geographic coverage: 23 countries, 57 cities from 92% of activities (GeoNames offline geocoding, zero API calls).
Multi-city tracking: 86% of activities pass through multiple cities via polyline route sampling.
Repository: github.com/bacilo/strava-widgets (public).

**Future vision:** Map styling themes (topographic, neon, minimal), maps as post backgrounds, animated run playback, Street View playback along runs, choropleth country maps, region completion badges, pace/speed color coding on routes.

## Constraints

- **Hosting**: GitHub Pages — no server-side rendering, static assets only
- **API**: Strava API rate limits (100 requests per 15 minutes, 1000 per day) — data cached locally
- **Auth**: Strava OAuth refresh token flow — tokens stored in GitHub Secrets + committed tokens.json
- **Embedding**: Widgets must work within Jekyll+Astro pages as self-contained IIFE bundles
- **Geocoding**: Offline only (offline-geocoder with GeoNames cities1000) — no external API calls
- **Maps**: Leaflet externalized to CDN — widgets use global `L`, Shadow DOM CSS injection required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate repo from website | Keeps data pipeline independent, cleaner separation of concerns | ✓ Good |
| Runs only for v1 | Simplifies data model, user primarily interested in running | ✓ Good |
| Daily rebuild via GitHub Actions | Simpler architecture than live API, sufficient for personal use | ✓ Good |
| Native fetch (no HTTP libraries) | Node.js 18+ built-in, fewer dependencies | ✓ Good |
| Shadow DOM for widget isolation | Host page styles cannot affect widgets | ✓ Good |
| Vite IIFE bundles | Single-file embeddability, no module loader required | ✓ Good |
| Git-tracked activity data | CI needs committed data for incremental sync | ✓ Good |
| CI token bootstrap pattern | First run uses secret, subsequent runs use committed tokens | ✓ Good |
| TDD for streak logic | Complex edge cases benefit from test-first | ✓ Good |
| UTC everywhere for dates | Timezone safety, consistent across environments | ✓ Good |
| Offline geocoding (offline-geocode-city) | Zero API calls, no rate limits, no cost, 217KB library | ✓ Good |
| Git-tracked location cache | >90% cache hit rate across CI builds, 114 unique locations | ✓ Good |
| Coordinate rounding (4 decimal places) | ≈11m precision balances accuracy with cache efficiency | ✓ Good |
| Native Custom Elements API | Zero dependencies, full attribute lifecycle control | ✓ Good |
| ResizeObserver + requestAnimationFrame | Prevents "ResizeObserver loop" browser errors | ✓ Good |
| Constructible Stylesheets for tables | Shared CSS across widget instances, reduced memory | ✓ Good |
| Non-blocking geocoding in CI | Geo failures don't halt stats pipeline | ✓ Good |
| Distance ranking over activity count | More meaningful geographic statistics | ✓ Good |
| UTF-8 BOM for CSV export | Special characters display correctly in Excel | ✓ Good |
| GeoNames over UN/LOCODE | 166K cities vs 5K, fixes suburb-instead-of-city problem | ✓ Good |
| Versioned geocoding cache (v2) | Safe migration with metadata tracking, old data archived | ✓ Good |
| Pre-computed route data (JSON) | 72% payload reduction vs loading full activity data in widgets | ✓ Good |
| Leaflet externalized to CDN | Keeps widget bundles < 50KB, shared across all map widgets | ✓ Good |
| Vite ?inline CSS for Shadow DOM | Bypasses document.head injection, CSS penetrates encapsulation | ✓ Good |
| Pre-decoded heatmap points | Zero UI blocking for 1,808 routes, trades file size for performance | ✓ Good |
| Quintile color scale for pin map | Clear visual hierarchy with 5 teal-to-orange levels | ✓ Good |
| Vite multi-page build for standalone | Clean output paths, pages load existing IIFE bundles (no duplication) | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-18 — Phase 20 (row-click interaction pattern) complete: 20 plans, five gap-closure rounds, UX-01/UX-02/UX-03/REC-08 all verified, `20-VERIFICATION.md` 4/4 on a ten-row human browser checkpoint (`20-VALIDATION.md` Round 5, `status: passed`, `nyquist_compliant: true`). Two developer-accepted scope boundaries recorded rather than fixed: the Date-cell anchor is built outside `buildCellLink` so D-16's drag/click guard does not cover it, and a double-click's first click still navigates (`MouseEvent.detail` is 1 at fire time; a delay is forbidden by `row-navigation.test.ts`). One out-of-scope defect surfaced by this round's code review and recommended for separate tracking: the PR-progression Improvement column hard-codes a minus and applies `Math.abs()` at `records.ts:650-651`, inverting the sign for a non-improving step — latent, and byte-identical back to Phase 18's `d85e88a`, so it predates Phase 20.*

*Previously: 2026-08-13 — Phase 19 (design system & control styling) complete: 17 plans, four gap-closure rounds, UI-01/UI-02/UI-03/ACT-01 all verified on rendered browser evidence. One open decision carried forward: GAP 8 (Leaflet map panes paint over the nav; the sticky-layer ladder comment's totality claim is incomplete) — recorded, unpatched, disposition deferred to the user. Three latent test-helper warnings from `19-REVIEW-round4.md` are advisory and unreachable by existing tests.*

*Previously: 2026-08-12 — v2.0 Training Dashboard shipped and archived (phases 14-18, 56 plans, 29/29 requirements). Milestone audit returned `tech_debt`: no blockers, but Phase 16's three theme/first-paint UAT items remain genuinely unverified and two integration warnings (CI-vs-compute-all-stats ordering divergence; incomplete publish-verifier reachability coverage) are carried forward. See .planning/v2.0-MILESTONE-AUDIT.md and STATE.md Deferred Items.*
