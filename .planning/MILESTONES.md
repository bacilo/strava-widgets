# Milestones

## v2.1 Interface Polish (Shipped: 2026-09-05)

**Phases completed:** 7 phases (19-25), 103 plans, 250 tasks | 29,955 LOC TypeScript in src/ (non-test) | 1,617 tests across 63 files | 24 days
**Git range:** feat(19-01) `a3f5870f` → `20c9eda4` (750 commits, +15,884 / -683 lines across src/scripts/CI)

**Key accomplishments:**

- Design system pass across all five screens: a bare `input, select, textarea` selector gives all 13 control-creation sites one box treatment and a bare `button {}` baseline gives all 31 button sites a shared floor — including the stylesheet's first-ever `:disabled` rule — under a two-tone `box-shadow` focus ring (`--bg` inner halo, `--accent` outer ring) that stays visible against the `--accent-strong` active fills the old accent-only `outline` disappeared into
- Row-click interaction pattern: every activity row on every screen is a real `<a>` with one keyboard stop on the Date cell, the redundant "View Activity" CTAs deleted, and a shared `shouldNavigateOnRowClick` predicate consulted from both the row listener and each cell anchor so modifier-click, middle-click, drag-select and double-click all behave the way the browser's own link contract says they should
- Overview rebuilt onto the shared renderer: Recent PRs and Recent Activities now render through the same `renderActivityRow` as the Activities list (made multi-surface-safe via an `idPrefix`), plus an all-time/this-year records scope control, distance and hours this year in Headline Stats, and the Current Streak `ended {date}` sub-label — a two-layer fix, since `streak-utils.ts` only ever populated `currentStreakStart` while a streak was live
- Calendar week start is selectable Sunday/Monday and drives which days each week total sums, with per-week totals at the end of every row; `buildMonthGrid`'s hard-coded Sunday-first padding became a required `WeekStart` parameter, and the compaction breakpoint ultimately widened from 380px to 640px so the totals stay legible at real phone widths rather than only below 380px
- Trends charts zoom and pan by gesture and by keyboard-reachable on-screen controls on taller bands, without disturbing the five-tab structure, the granularity toggle or the canvas lifecycle
- Local curation mode: `npm run curate` serves the dashboard from a localhost-only Node server with an inline whole-activity PR-exclusion tickbox, and the write path is proven absent from the published bundle by two independent layers — a build-time content scan (`curation-guard.mjs`) and an HTTP-layer assertion (`verify-dashboard-publish.mjs`)
- CI hardening: the nightly workflow's eight hand-maintained compute steps collapsed onto a single `COMPUTE_ALL_STATS_STEPS` source of truth (proven by a live dispatched run), the publish verifier now asserts six stats documents by name instead of trusting a directory copy, a `gear-aggregate-logic.ts` crash on an absent `gearName` key degrades into the Unknown bucket, and v2.0's three deferred Phase 16 theme/first-paint items were finally discharged against production

**Requirements:** 25/25 satisfied. Every phase closed on a human browser checkpoint, by design — the milestone charter recorded that automated gates had missed rendering defects in this project three times.

**Known deferred items at close: 5** (see STATE.md § Deferred Items → v2.1 close). Two are inherited v2.0 Phase 16 artifacts, one is a confirmed `audit-open` false positive (a quick task whose SUMMARY exists but carries no `status:` field), and two are genuine todos — the Garmin export adapter (STREAM-04, externally blocked) and IN-17/IN-18 curation-guard cosmetics. Open code-review findings per phase are recorded in PROJECT.md rather than duplicated here.

**Closing correction:** `22-VERIFICATION.md` was stale at the start of this close — dated 2026-08-19T09:30:00Z, `gaps_found` 5/8, it was the report that *triggered* Phase 22's Round 4 gap-closure work and was never re-run afterward. Re-verified 2026-09-05 to `passed` 8/8, each closure re-derived from source and mutation-tested rather than accepted from the Round 4 summaries; the prior report's central premise (a 380px-scoped overflow fix) was found factually false, the breakpoint being 640px with all three named rules overridden inside it. `REQUIREMENTS.md` had also contradicted itself, recording CAL-01/CAL-02 as re-ticked `[x]` while the phase-map rows still read "Pending" — reconciled before archiving, which would otherwise have frozen both as Pending permanently.

**No milestone audit was run for v2.1** (unlike v1.1 and v2.0). The close proceeded on the phase-level evidence instead: all seven phases at `status: passed`, 25/25 requirements ticked, and the Phase 22 re-verification above.

---

## v1.0 MVP (Shipped: 2026-02-14)

**Phases completed:** 4 phases, 9 plans | 3,844 LOC TypeScript | 1 day

**Key accomplishments:**

- Strava OAuth authentication + incremental activity sync with rate limiting (1,808 activities)
- Statistics computation engine: weekly/monthly/yearly aggregations, pace, elevation
- Embeddable widget system: Shadow DOM isolation, Vite IIFE bundles, Chart.js visualizations
- Advanced analytics: streaks, year-over-year comparisons, time-of-day patterns, seasonal trends
- Widget library: stats card, comparison chart, streak/patterns widget — all configurable
- GitHub Actions CI/CD pipeline: daily cron refresh + GitHub Pages deployment

---

## v1.1 Geographic & Widget Customization (Shipped: 2026-02-16)

**Phases completed:** 5 phases (5-9), 10 plans | 6,702 LOC TypeScript (project total) | 3 days
**Git range:** feat(05-01) → docs(v1.1) (43 commits, +13,948 / -301 lines)

**Key accomplishments:**

- Offline reverse geocoding pipeline: 23 countries, 57 cities from 1,658/1,808 activities (92% GPS coverage)
- Geographic statistics with distance aggregation (20,138 km), ranked country/city exports, CSV export
- All 5 widgets migrated to Custom Elements with HTML attribute configuration, dark/light theming, responsive sizing
- Sortable, paginated geographic table widget with locale-aware sorting and ARIA accessibility
- Non-blocking geocoding in CI/CD pipeline with comprehensive README and widget landing page

---

## v1.2 Maps & Geo Fix (Shipped: 2026-02-18)

**Phases completed:** 4 phases (10-13), 11 plans | 9,148 LOC TypeScript (project total) | 2 days
**Git range:** feat(10-01) → fix: recover polylines (49 commits, +118,693 / -1,074 lines)

**Key accomplishments:**

- GeoNames geocoding migration: accurate city names via 166K-city dataset, fixing suburb-instead-of-city problem across 23 countries
- Multi-city route tracking: polyline decoding detects all cities a run passes through (86% of 1,808 activities are multi-city)
- Interactive route map widgets: single-run map, multi-run overlay, and route browser with list selection and auto-fit
- Heatmap widget: all 1,808 runs overlaid with date filtering, color scheme options, and pre-decoded points for zero UI blocking
- Pin map widget: city/country toggle with quintile-based color encoding, cluster markers, and activity popups
- Standalone full-page map views: heatmap, pin map, and route browser with Leaflet Shadow DOM CSS injection and navigation

---

## v2.0 Training Dashboard (Shipped: 2026-08-12)

**Phases completed:** 5 phases (14-18), 56 plans | 26,430 LOC TypeScript in src/ (non-test) | 884 tests | 3 days
**Git range:** feat(14-01) → docs: evolve PROJECT.md (432 commits, +30,711 lines across src/scripts/CI)

**Key accomplishments:**

- Stream ingestion foundation: committed per-activity time-series (time, distance, HR, cadence, elevation) for the full 1,868-activity archive, with a per-channel availability manifest and an explicit unavailable flag rather than silent gaps
- Best-effort engine: fastest 400m/1k/1mi/5k/10k/half/marathon computed within every run from raw streams, with a hand-maintained exclusion list that withholds untrusted GPS readings from PR ranking while keeping them in totals
- Dashboard SPA shell: hash routing over six views, document-level theming, and a lazy data contract — a compact index manifest up front, per-activity detail and streams fetched only on open
- Activity browser and detail views: filter/sort the full archive; per-run pace/HR/cadence charts, route maps, splits and HR zones
- Records and trends: seven PR tables with honesty badges, a PR-evolution grid, Riegel race predictions with a self-suppressing fitted exponent, WMA age-grading, and a five-tab trends page (volume/consistency, year-over-year, cadence & HR, CTL/ATL/TSB training load, per-shoe gear)
- Privacy architecture for a public repo: identity inputs (birthDate, sex, restingHr) isolated in a gitignored `data/private/`, with a two-layer publish guard — a build-time artifact scanner and negative-reachability assertions in the publish verifier

**Milestone audit:** `tech_debt` — 29/29 requirements satisfied, 0 blockers, 41/43 integration checks wired, 6/6 E2E flows. Known deferred items at close: 11 (see STATE.md Deferred Items and `.planning/v2.0-MILESTONE-AUDIT.md`). The notable one is Phase 16's three unverified theme/first-paint UAT items, which phases 17 and 18's human checkpoints did not discharge despite running on the same shell.

**Pipeline note:** data ingestion migrated off the Strava API to intervals.icu during this milestone.

---
