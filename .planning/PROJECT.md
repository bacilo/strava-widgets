# Strava Analytics & Visualization Platform

## What This Is

A personal Strava data pipeline and visualization platform that fetches run data via the Strava API, computes custom statistics (aggregations, streaks, trends, patterns), and produces embeddable widgets deployed to GitHub Pages. Widgets embed on a Jekyll+Astro personal website at bacilo.github.io via script tags. Lives in its own repo (strava-widgets), with a daily GitHub Actions pipeline for automated refresh.

## Core Value

Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.

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

### Active

- [ ] Geographic statistics (countries, cities, unique routes, distance by location)

### Out of Scope

- Website redesign — this project outputs widgets, doesn't modify bacilo.github.io itself
- Social features — this is a personal dashboard, not multi-user
- Non-running activities — focus on runs only for now
- Mobile app — web widgets only
- Real-time Strava sync via webhooks — daily rebuild is sufficient
- AI training recommendations — massive scope, liability, sports science needed

## Context

Shipped v1.0 with 3,844 LOC TypeScript/JS across 9 plans in 1 day.
Tech stack: TypeScript, Node.js 22, Chart.js, Vite (IIFE bundles), Shadow DOM, GitHub Actions.
1,808 run activities synced from Strava. 3 widget types deployed to GitHub Pages.
Repository: github.com/bacilo/strava-widgets (public).

## Constraints

- **Hosting**: GitHub Pages — no server-side rendering, static assets only
- **API**: Strava API rate limits (100 requests per 15 minutes, 1000 per day) — data cached locally
- **Auth**: Strava OAuth refresh token flow — tokens stored in GitHub Secrets + committed tokens.json
- **Embedding**: Widgets must work within Jekyll+Astro pages as self-contained IIFE bundles

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

---
*Last updated: 2026-02-14 after v1.0 milestone*
