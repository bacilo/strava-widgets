# Requirements: Strava Analytics Platform

**Defined:** 2026-02-14
**Core Value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## v1 Requirements

### Data Pipeline

- [ ] **DATA-01**: User can authenticate with Strava via OAuth and obtain access/refresh tokens
- [ ] **DATA-02**: System automatically refreshes expired access tokens using stored refresh token
- [ ] **DATA-03**: System incrementally syncs new run activities from Strava API (paginated)
- [ ] **DATA-04**: System respects Strava API rate limits (100 req/15min, 1000/day) with backoff
- [ ] **DATA-05**: System stores activity data locally as JSON files for offline processing
- [ ] **DATA-06**: System tracks sync state (last synced activity timestamp) to avoid re-fetching
- [ ] **DATA-07**: GitHub Actions workflow runs daily to fetch new data, process stats, and generate widgets
- [ ] **DATA-08**: OAuth tokens are stored securely in GitHub Secrets (never in code or widget output)

### Statistics

- [ ] **STAT-01**: User can see total distance (km) per week as a bar chart
- [ ] **STAT-02**: User can see year-over-year comparison of total km, total runs, and total hours
- [ ] **STAT-03**: User can see all-time totals (total km, total runs, total hours, total elevation)
- [ ] **STAT-04**: User can see average pace per period (weekly, monthly, yearly)
- [ ] **STAT-05**: User can see elevation gain totals per period
- [ ] **STAT-06**: User can see run count per period (weekly, monthly, yearly)
- [ ] **STAT-07**: User can see current and longest running streak (consecutive days with a run)
- [ ] **STAT-08**: User can see weekly consistency streak (weeks with at least N runs)
- [ ] **STAT-09**: User can see time-of-day running patterns (morning vs afternoon vs evening)
- [ ] **STAT-10**: User can see seasonal trends (volume by month, compared across years)

### Widget System

- [ ] **WIDG-01**: System generates self-contained JavaScript widget bundles embeddable via `<script>` tag
- [ ] **WIDG-02**: User can embed a weekly km bar chart widget on any page of their Jekyll/Astro site
- [ ] **WIDG-03**: User can embed a stats summary card (totals, year-over-year) on their site
- [ ] **WIDG-04**: User can embed a streak/patterns widget on their site
- [ ] **WIDG-05**: Widgets accept configuration for colors, sizes, and date ranges to match site design
- [ ] **WIDG-06**: Widgets render correctly in both Jekyll and Astro page contexts
- [ ] **WIDG-07**: Widgets load data from pre-generated static JSON (no runtime API calls)

## v2 Requirements

### Geographic

- **GEO-01**: User can see a world map coloring countries they've run in
- **GEO-02**: User can see a list of all cities they've run in with run counts
- **GEO-03**: User can see all run routes overlaid on a single map
- **GEO-04**: User can see an animated replay of a specific run on a map

### Advanced Visualization

- **VIZ-01**: User can see a run animation on street view
- **VIZ-02**: User can define custom statistics via configuration
- **VIZ-03**: User can see monthly distance heatmap (calendar view)

### Multi-Sport

- **SPRT-01**: System supports cycling activities in addition to runs
- **SPRT-02**: System supports swimming activities

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time Strava sync via webhooks | Requires persistent server; daily rebuild is sufficient |
| Social/sharing features | Personal dashboard; public site = sharing |
| Heart rate zone analysis | Requires premium Strava data, HR monitor dependency |
| AI training recommendations | Massive scope, liability, sports science needed |
| Mobile app | Responsive widgets work on mobile browsers |
| Multi-user support | Personal use only, simplifies everything |
| Server-side hosting (Vercel etc.) | Fully hosted on GitHub (Actions + Pages + Secrets) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| DATA-04 | — | Pending |
| DATA-05 | — | Pending |
| DATA-06 | — | Pending |
| DATA-07 | — | Pending |
| DATA-08 | — | Pending |
| STAT-01 | — | Pending |
| STAT-02 | — | Pending |
| STAT-03 | — | Pending |
| STAT-04 | — | Pending |
| STAT-05 | — | Pending |
| STAT-06 | — | Pending |
| STAT-07 | — | Pending |
| STAT-08 | — | Pending |
| STAT-09 | — | Pending |
| STAT-10 | — | Pending |
| WIDG-01 | — | Pending |
| WIDG-02 | — | Pending |
| WIDG-03 | — | Pending |
| WIDG-04 | — | Pending |
| WIDG-05 | — | Pending |
| WIDG-06 | — | Pending |
| WIDG-07 | — | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 ⚠️

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
