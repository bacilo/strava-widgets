# Strava Analytics & Visualization Platform

## What This Is

A personal Strava data pipeline and visualization platform that fetches run data via the Strava API, computes custom statistics (aggregations, streaks, geographic breakdowns), and produces embeddable widgets for a Jekyll+Astro personal website at bacilo.github.io. Lives in its own repo, separate from the website.

## Core Value

Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Strava OAuth authentication and token management
- [ ] Fetch and store run activity data from Strava API
- [ ] Weekly km aggregation and chart widget
- [ ] Year-over-year totals (km, runs, hours — this year vs last vs all time)
- [ ] Custom time-period aggregations (monthly, yearly, arbitrary ranges)
- [ ] Streak and pattern detection (consecutive run days, time-of-day, seasonal trends)
- [ ] Geographic statistics (countries, cities, unique routes, distance by location)
- [ ] Embeddable widget system for static site consumption
- [ ] Data refresh pipeline (daily rebuild, with path toward live updates)

### Out of Scope

- Website redesign — this project outputs widgets, doesn't modify bacilo.github.io itself
- Social features — this is a personal dashboard, not multi-user
- Non-running activities — focus on runs only for v1
- Mobile app — web widgets only

## Context

- Personal website runs Jekyll + Astro on GitHub Pages (bacilo.github.io)
- Strava API access partially set up (developer app started, OAuth flow not complete)
- Static site means widgets either render client-side from JSON data or are pre-built at build time
- GitHub Pages has no server-side execution — any "live" data needs a serverless function or external API
- Long-term vision includes: world map coloring countries run in, city lists, run route animations, street view playback — all requiring solid geographic data foundation

## Constraints

- **Hosting**: GitHub Pages for the website — no server-side rendering, static assets only
- **API**: Strava API rate limits (100 requests per 15 minutes, 1000 per day) — must cache/store data locally
- **Auth**: Strava OAuth requires a refresh token flow — can't expose tokens client-side
- **Embedding**: Widgets must work within Jekyll+Astro pages without heavy build dependencies

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate repo from website | Keeps data pipeline independent, cleaner separation of concerns | — Pending |
| Runs only for v1 | Simplifies data model, user primarily interested in running | — Pending |
| Daily rebuild acceptable | Simpler architecture than live API, can upgrade later | — Pending |

---
*Last updated: 2026-02-13 after initialization*
