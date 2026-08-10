# Roadmap: Strava Analytics Platform

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-14)
- ✅ **v1.1 Geographic & Widget Customization** — Phases 5-9 (shipped 2026-02-16)
- ✅ **v1.2 Maps & Geo Fix** — Phases 10-13 (shipped 2026-02-18)
- 🚧 **v2.0 Training Dashboard** — Phases 14-18 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-14</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-14
- [x] Phase 2: Analytics (2/2 plans) — completed 2026-02-14
- [x] Phase 3: Widgets (4/4 plans) — completed 2026-02-14
- [x] Phase 4: Pipeline (1/1 plan) — completed 2026-02-14

</details>

<details>
<summary>✅ v1.1 Geographic & Widget Customization (Phases 5-9) — SHIPPED 2026-02-16</summary>

- [x] Phase 5: Geocoding Infrastructure (1/1 plan) — completed 2026-02-15
- [x] Phase 6: Geographic Statistics (2/2 plans) — completed 2026-02-15
- [x] Phase 7: Widget Attribute System (3/3 plans) — completed 2026-02-15
- [x] Phase 8: Geographic Table Widget (2/2 plans) — completed 2026-02-15
- [x] Phase 9: CI/CD Integration (2/2 plans) — completed 2026-02-16

</details>

<details>
<summary>✅ v1.2 Maps & Geo Fix (Phases 10-13) — SHIPPED 2026-02-18</summary>

- [x] Phase 10: Geocoding Foundation & Map Infrastructure (4/4 plans) — completed 2026-02-17
- [x] Phase 11: Route Map Widgets (3/3 plans) — completed 2026-02-17
- [x] Phase 12: Heatmap & Pin Map Widgets (2/2 plans) — completed 2026-02-17
- [x] Phase 13: Standalone Pages (2/2 plans) — completed 2026-02-18

</details>

### 🚧 v2.0 Training Dashboard (Phases 14-18, in progress)

**Milestone Goal:** A full analytics dashboard (static SPA on GitHub Pages) for browsing the complete running archive — activities with pace/cadence/HR detail, self-computed best-effort records, and weekly/monthly/yearly/all-time stats — built as a flexible foundation that many more functions can plug into over time.

**Phase Numbering:**

- Integer phases (14, 15, 16...): Planned milestone work
- Decimal phases (14.1, 14.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 14: Stream Ingestion Foundation** - Backfill and daily-sync pipeline produces committed per-activity time-series data (or an explicit unavailable flag)
- [ ] **Phase 15: Best-Effort Engine** - Pipeline computes fastest 400m..marathon efforts within every run from streams
- [ ] **Phase 16: Dashboard Shell & Data Contract** - Navigable, themed SPA shell deployed to GitHub Pages with lazy-loaded data contract
- [ ] **Phase 17: Activity Browser & Detail Views** - Browse, filter, and drill into any archived activity with full pace/HR/cadence detail
- [ ] **Phase 18: Records, Trends & Differentiators** - PR lists, evolution, badges, aggregates, TRIMP training load, age-grading, Riegel predictions, gear-aware trends

## Phase Details

### Phase 14: Stream Ingestion Foundation

**Goal**: Every historical and newly-synced activity has committed time-series stream data (pace, HR, cadence, elevation), or an explicit flag when unavailable, ready for downstream computation.
**Depends on**: Nothing (v2.0 entry point; builds atop the existing v1.2 pipeline)
**Requirements**: STREAM-01, STREAM-02, STREAM-03
**Success Criteria** (what must be TRUE):

  1. Running the local backfill command produces committed per-activity stream files (time, distance, pace, HR, cadence, elevation) for export-covered historical activities.
  2. The daily pipeline persists intervals.icu streams for newly-synced activities in the same canonical format, with cadence values verified/normalized against FIT convention.
  3. Activities with no recoverable original recording (treadmill/manual entries) are marked with a stream-unavailable flag rather than causing pipeline failures.

**Plans**: 5 plans

Plans:
**Wave 1**

- [x] 14-01-PLAN.md — Lock the committed stream schema and build the shared derivation seam

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 14-02-PLAN.md — Extend FIT/GPX readers to multi-channel samples; build the availability manifest

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 14-03-PLAN.md — Backfill core over provenance-linked originals with reason-coded flags
- [x] 14-04-PLAN.md — Persist streams in the daily intervals.icu sync; commit data/streams/ from CI

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 14-05-PLAN.md — Live-API reconciliation, size gate, CLI wiring, and the real backfill run

### Phase 15: Best-Effort Engine

**Goal**: The pipeline can determine, for any run, the fastest time achieved at each standard racing distance, using real stream data.
**Depends on**: Phase 14
**Requirements**: REC-01
**Success Criteria** (what must be TRUE):

  1. For every activity with streams, the pipeline computes fastest 400m/1k/1mi/5k/10k/half/marathon efforts using native (not haversine-recomputed) distance and timestamp-indexed (not index-based) duration.
  2. Best-effort results are written to a durable, gitignored records data file consumable by later phases.
  3. Computed best efforts validate against known reference activities without producing implausible results.

**Plans**: TBD

Plans:

- [ ] 15-01: TBD

### Phase 16: Dashboard Shell & Data Contract

**Goal**: A navigable, themed single-page dashboard shell is deployed to GitHub Pages, loading only a compact index up front.
**Depends on**: Phase 14, Phase 15
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):

  1. User can open the dashboard on GitHub Pages and navigate between list/calendar/detail/records/trends views via hash-based routes without full page reloads or 404s.
  2. Dashboard loads a compact activity index manifest immediately and fetches per-activity detail data only when a specific activity is opened.
  3. Dashboard respects dark/light theme consistent with the existing widget system's theming.

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 16-01: TBD

### Phase 17: Activity Browser & Detail Views

**Goal**: User can browse, filter, and drill into any of the 1,867+ archived activities, viewing full pace/HR/cadence/elevation detail per run.
**Depends on**: Phase 16 (shell), Phase 14 (streams for detail charts)
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-05, BROWSE-06, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05
**Success Criteria** (what must be TRUE):

  1. User can browse a paginated, sortable list of all activities by date, distance, pace, duration, and heart rate.
  2. User can filter by date range and distance/pace/duration ranges, text-search by activity name, and see active filters as removable chips with a live result count.
  3. User can view a calendar/month-grid training log.
  4. User can open any activity and see a stats header (distance, time, pace, elevation, avg/max HR, cadence, gear), its route map, and pace/HR/cadence/elevation charts.
  5. User can view an auto-computed per-km splits table and a pace-distribution/zone breakdown per activity, with missing-data states (no HR/cadence) rendering cleanly instead of breaking.

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 17-01: TBD

### Phase 18: Records, Trends & Differentiators

**Goal**: User can see PRs, how they evolved, and full-archive volume/load/gear trends, plus derived racing insights.
**Depends on**: Phase 15 (best efforts), Phase 16 (shell), Phase 17 (list/detail views for PR badges)
**Requirements**: REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, TREND-01, TREND-02, TREND-03, TREND-04, TREND-05
**Success Criteria** (what must be TRUE):

  1. User can view all-time PR lists per distance, how each PR evolved over the years, and a "PR" badge on runs that set a new PR in both list and detail views.
  2. User can view weekly/monthly/yearly totals, biggest week/month, and streak records in the dashboard.
  3. User can view age-graded performance percentages and Riegel-based race-time predictions on PRs.
  4. User can view weekly/monthly volume trend charts, year-over-year comparisons, and cadence/HR average trends over months across the full archive.
  5. User can view a TRIMP-based training load chart (CTL/ATL/TSB "Fitness & Freshness") and pace/HR trend breakdowns per shoe.

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 18-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17 → 18

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-14 |
| 2. Analytics | v1.0 | 2/2 | Complete | 2026-02-14 |
| 3. Widgets | v1.0 | 4/4 | Complete | 2026-02-14 |
| 4. Pipeline | v1.0 | 1/1 | Complete | 2026-02-14 |
| 5. Geocoding Infrastructure | v1.1 | 1/1 | Complete | 2026-02-15 |
| 6. Geographic Statistics | v1.1 | 2/2 | Complete | 2026-02-15 |
| 7. Widget Attribute System | v1.1 | 3/3 | Complete | 2026-02-15 |
| 8. Geographic Table Widget | v1.1 | 2/2 | Complete | 2026-02-15 |
| 9. CI/CD Integration | v1.1 | 2/2 | Complete | 2026-02-16 |
| 10. Geocoding Foundation & Map Infrastructure | v1.2 | 4/4 | Complete | 2026-02-17 |
| 11. Route Map Widgets | v1.2 | 3/3 | Complete | 2026-02-17 |
| 12. Heatmap & Pin Map Widgets | v1.2 | 2/2 | Complete | 2026-02-17 |
| 13. Standalone Pages | v1.2 | 2/2 | Complete | 2026-02-18 |
| 14. Stream Ingestion Foundation | v2.0 | 4/5 | In Progress|  |
| 15. Best-Effort Engine | v2.0 | 0/TBD | Not started | - |
| 16. Dashboard Shell & Data Contract | v2.0 | 0/TBD | Not started | - |
| 17. Activity Browser & Detail Views | v2.0 | 0/TBD | Not started | - |
| 18. Records, Trends & Differentiators | v2.0 | 0/TBD | Not started | - |

---
*Last updated: 2026-08-10 — Phase 14 planned (5 plans, 4 waves)*
