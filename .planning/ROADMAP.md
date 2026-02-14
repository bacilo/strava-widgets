# Roadmap: Strava Analytics & Visualization Platform

## Overview

This roadmap delivers a personal Strava analytics platform in 4 phases, progressing from data acquisition foundations through widget generation. Phase 1 establishes secure OAuth and incremental data syncing. Phase 2 validates the full pipeline (fetch -> process -> generate -> deploy) with basic statistics and the first embeddable widget. Phase 3 adds differentiating analytics (streaks, trends, year-over-year comparisons) with multiple widget types. Phase 4 wraps up with automation via GitHub Actions for daily data refresh and deployment.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Secure Strava OAuth and incremental activity sync *(completed 2026-02-14)*
- [x] **Phase 2: Core Analytics & First Widget** - Basic stats computation and embeddable weekly chart *(completed 2026-02-14)*
- [x] **Phase 3: Advanced Analytics & Widget Library** - Streaks, trends, and multiple widget types *(completed 2026-02-14)*
- [ ] **Phase 4: Automation & Deployment** - GitHub Actions pipeline for daily refresh and widget publishing

## Phase Details

### Phase 1: Data Foundation
**Goal**: Developer can authenticate with Strava and incrementally fetch run activities to local storage with rate limit compliance
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-08
**Success Criteria** (what must be TRUE):
  1. Developer can complete OAuth flow and obtain access/refresh tokens stored securely in GitHub Secrets
  2. System automatically refreshes expired access tokens without manual intervention
  3. Developer can trigger incremental sync that fetches only new activities since last sync
  4. System respects Strava API rate limits (100 req/15min, 1000/day) with backoff and never exceeds limits
  5. Activity data persists as JSON files in local storage with sync state tracking
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Project setup, config, OAuth auth, and storage foundation
- [x] 01-02-PLAN.md — Rate-limited API client, sync orchestrator, and CLI entry point

### Phase 2: Core Analytics & First Widget
**Goal**: User can see weekly running distance visualized in an embeddable widget on their personal website
**Depends on**: Phase 1
**Requirements**: STAT-01, STAT-03, STAT-04, STAT-05, STAT-06, WIDG-01, WIDG-02, WIDG-07
**Success Criteria** (what must be TRUE):
  1. System computes basic statistics from activity data (distance totals, pace averages, elevation, run counts)
  2. User can see weekly km totals displayed as a bar chart
  3. Widget renders as self-contained JavaScript bundle embeddable via script tag
  4. Widget loads pre-generated static JSON data without runtime API calls
  5. Widget displays correctly when embedded in a test HTML page
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — Statistics computation pipeline (types, date utils, aggregation engine, CLI command)
- [x] 02-02-PLAN.md — Embeddable weekly bar chart widget (Chart.js, Vite IIFE bundle, Shadow DOM, test page)

### Phase 3: Advanced Analytics & Widget Library
**Goal**: User can visualize running patterns (streaks, trends, year-over-year comparisons) through multiple embeddable widget types
**Depends on**: Phase 2
**Requirements**: STAT-02, STAT-07, STAT-08, STAT-09, STAT-10, WIDG-03, WIDG-04, WIDG-05, WIDG-06
**Success Criteria** (what must be TRUE):
  1. User can see year-over-year comparison of total km, total runs, and total hours
  2. User can see current running streak and longest streak in days
  3. User can see weekly consistency patterns and time-of-day running patterns
  4. User can see seasonal trends comparing volume across years
  5. Multiple widget types (stats card, comparison chart, patterns widget) are embeddable with consistent styling
  6. Widgets accept configuration parameters for colors and date ranges
  7. Widgets render correctly in both Jekyll and Astro page contexts
**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — TDD streak calculation algorithms (daily streaks, weekly consistency)
- [x] 03-02-PLAN.md — Advanced stats computation (year-over-year, time-of-day, seasonal trends, JSON output)
- [x] 03-03-PLAN.md — Widget infrastructure, stats card, and comparison chart widgets
- [x] 03-04-PLAN.md — Streak/patterns widget, comprehensive test page, Jekyll/Astro verification

### Phase 4: Automation & Deployment
**Goal**: System automatically refreshes data daily and publishes updated widgets to GitHub Pages without manual intervention
**Depends on**: Phase 3
**Requirements**: DATA-07
**Success Criteria** (what must be TRUE):
  1. GitHub Actions workflow runs daily at scheduled time to fetch new activities
  2. Workflow processes updated statistics and regenerates all widgets automatically
  3. Generated widgets are committed to repository and deployed to GitHub Pages
  4. Workflow handles errors gracefully with notifications on failure
  5. User can manually trigger workflow for immediate refresh when needed
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4
(Decimal phases execute between their surrounding integers if inserted later)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 2/2 | ✓ Complete | 2026-02-14 |
| 2. Core Analytics & First Widget | 2/2 | ✓ Complete | 2026-02-14 |
| 3. Advanced Analytics & Widget Library | 4/4 | ✓ Complete | 2026-02-14 |
| 4. Automation & Deployment | 0/1 | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-14*
