# Requirements: Strava Analytics & Visualization Platform — v2.0 Training Dashboard

**Defined:** 2026-08-10
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## v2.0 Requirements

Requirements for the Training Dashboard milestone. Each maps to roadmap phases.

### Stream Ingestion

- [x] **STREAM-01**: User can run a local backfill command that parses FIT/GPX originals from `export_data/` (via `data/provenance.json`) into committed per-activity stream files (time, distance, pace, HR, cadence, elevation)
- [x] **STREAM-02**: Daily pipeline fetches streams from intervals.icu for new activities and persists them in the same canonical format (with cadence unit normalization verified against FIT convention)
- [x] **STREAM-03**: Activities without recoverable streams (no original recording, treadmill/manual) are flagged so downstream features render degraded states instead of failing

### Dashboard Shell

- [x] **DASH-01**: User can open a dashboard SPA on GitHub Pages with hash-based routing between views (list, calendar, detail, records, trends)
- [x] **DASH-02**: Dashboard loads a compact activity index manifest up front and fetches per-activity detail data lazily on demand
- [x] **DASH-03**: Dashboard supports dark/light theming consistent with the existing widget system

### Activity Browser

- [x] **BROWSE-01**: User can browse a paginated list of all activities (1,867+)
- [x] **BROWSE-02**: User can sort the list by date, distance, pace, duration, and heart rate
- [x] **BROWSE-03**: User can filter by date range and by distance/pace/duration ranges
- [x] **BROWSE-04**: User can text-search activities by name
- [x] **BROWSE-05**: User can view a calendar/month-grid training log
- [x] **BROWSE-06**: Active filters show as removable chips with a result count, and missing-data states (no HR/cadence) render cleanly

### Activity Detail

- [x] **DETAIL-01**: User can view a stats header per activity (distance, time, pace, elevation, avg/max HR, cadence, gear)
- [x] **DETAIL-02**: User can view the activity's route map on the detail page (reusing existing map infrastructure)
- [x] **DETAIL-03**: User can view pace, HR, cadence, and elevation charts over distance/time from streams
- [x] **DETAIL-04**: User can view an auto-computed per-km splits table
- [x] **DETAIL-05**: User can view a pace-distribution/zone breakdown per activity

### Records & PRs

- [x] **REC-01**: Pipeline computes best efforts (fastest 400m, 1k, 1mi, 5k, 10k, half, marathon) within every run from streams
- [x] **REC-02**: User can view all-time PR lists per distance
- [x] **REC-03**: User can view how each distance PR evolved over the years
- [x] **REC-04**: Runs that set a new PR show a "PR" badge in list and detail views
- [x] **REC-05**: User can view weekly/monthly/yearly totals, biggest week/month, and streak records in the dashboard (reusing v1.0 aggregation logic)
- [x] **REC-06**: User can view age-graded performance percentages on PRs (WMA tables)
- [x] **REC-07**: User can view Riegel-based race-time predictions derived from PRs

### Trends

- [x] **TREND-01**: User can view weekly/monthly volume trend charts over the full archive
- [x] **TREND-02**: User can view year-over-year comparisons
- [x] **TREND-03**: User can view cadence and HR average trends over months
- [x] **TREND-04**: User can view a TRIMP-based training load chart (CTL/ATL/TSB "Fitness & Freshness") covering the full archive
- [x] **TREND-05**: User can view pace/HR trend breakdowns per shoe (gear-aware trends)

## Future Requirements

Deferred to a later milestone. Tracked but not in current roadmap.

### Stream Ingestion

- **STREAM-04**: Garmin bulk-export adapter for `consolidate-exports` (pending todo — waiting on Garmin export delivery)

### Activity Detail

- **DETAIL-06**: Native device-recorded laps table with splits/laps toggle (requires FIT lap-marker recovery)

### Records

- **REC-08**: Personal route-segment detection (frequently-run sections from GPS overlap) with per-segment time history

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Community segments & leaderboards | Social/multi-athlete feature; personal best-efforts engine covers the need |
| Garmin-style Training Status / VO2max / readiness scores | Black-box proprietary algorithms, unvalidatable; transparent TRIMP + Riegel instead |
| Historical weather backfill | Paid API + high backfill cost for low personal value |
| Social features (kudos, comments, feed) | Single-athlete tool, per PROJECT.md |
| Real-time sync / live activity view | Static hosting; daily batch is sufficient, per PROJECT.md |
| AI training plans/recommendations | Explicitly excluded in PROJECT.md |
| Re-fetching historical streams from intervals.icu | Local FIT/GPX export is the authoritative backfill source; intervals.icu only for new activities |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STREAM-01 | Phase 14 | Complete |
| STREAM-02 | Phase 14 | Complete |
| STREAM-03 | Phase 14 | Complete |
| REC-01 | Phase 15 | Complete |
| DASH-01 | Phase 16 | Complete |
| DASH-02 | Phase 16 | Complete |
| DASH-03 | Phase 16 | Complete |
| BROWSE-01 | Phase 17 | Complete |
| BROWSE-02 | Phase 17 | Complete |
| BROWSE-03 | Phase 17 | Complete |
| BROWSE-04 | Phase 17 | Complete |
| BROWSE-05 | Phase 17 | Complete |
| BROWSE-06 | Phase 17 | Complete |
| DETAIL-01 | Phase 17 | Complete |
| DETAIL-02 | Phase 17 | Complete |
| DETAIL-03 | Phase 17 | Complete |
| DETAIL-04 | Phase 17 | Complete |
| DETAIL-05 | Phase 17 | Complete |
| REC-02 | Phase 18 | Complete |
| REC-03 | Phase 18 | Complete |
| REC-04 | Phase 18 | Complete |
| REC-05 | Phase 18 | Complete |
| REC-06 | Phase 18 | Complete |
| REC-07 | Phase 18 | Complete |
| TREND-01 | Phase 18 | Complete |
| TREND-02 | Phase 18 | Complete |
| TREND-03 | Phase 18 | Complete |
| TREND-04 | Phase 18 | Complete |
| TREND-05 | Phase 18 | Complete |

**Coverage:**
- v2.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-10*
*Last updated: 2026-08-11 — Phase 17 plan 17-15's real-browser checkpoint marked BROWSE-01..06/DETAIL-01/DETAIL-05 complete; DETAIL-02 and DETAIL-03/DETAIL-04 were reverted from a premature "Complete" mark back to open pending 2 named gaps (GAP 1: route-map basemap tiles; GAP 2: chart-band x-axis misalignment), then marked Complete after both gaps were root-caused, fixed (commits `edef601`, `1e652ef`), and human-confirmed resolved — see 17-VALIDATION.md Gap-Closure Record*
