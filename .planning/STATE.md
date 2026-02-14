# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 4 - Automation & Deployment (plan 1 of 1 complete)

## Current Position

Phase: 4 of 4 (Automation & Deployment)
Plan: 1 of 1 in current phase (PHASE COMPLETE)
Status: Phase 04 complete, project feature-complete
Last activity: 2026-02-14 — Completed 04-01 automation pipeline, CI/CD workflow, GitHub Pages deployment

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 4.0 min
- Total execution time: 0.60 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Data Foundation | 2 | 4 min | 2 min |
| 02 Core Analytics & First Widget | 2 | 8 min | 4 min |
| 03 Advanced Analytics & Widget Library | 4 | 20 min | 5 min |
| 04 Automation & Deployment | 1 | 8 min | 8 min |

**Recent Trend:**
- Last 5 plans: 03-02 (3 min), 03-03 (5.6 min), 03-04 (8 min), 04-01 (8 min)
- Trend: Stabilized at ~8min for complex plans with checkpoints

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 4 phases derived from natural requirement groupings (DATA → basic STAT/WIDG → advanced STAT/WIDG → automation)
- Coverage: All 25 v1 requirements mapped to phases with 100% coverage
- 01-01: Use native fetch instead of HTTP libraries (Node.js 18+ built-in)
- 01-01: Manual OAuth implementation instead of simple-oauth2 (simpler for two-call flow)
- 01-01: Manual atomic write pattern instead of write-file-atomic package (5 lines, same guarantee)
- 01-02: Two-run historical sync acceptable (timestamp edge case, converges to complete dataset)
- 01-02: 200ms minimum request spacing for rate limit safety buffer
- 01-02: Serialize all API requests to eliminate race conditions (maxConcurrent: 1)
- 02-01: Monday-start weeks (ISO 8601 standard) using UTC day-of-week calculations
- 02-01: Average pace computed as total_time/total_distance (not averaging individual paces)
- 02-01: Generated stats stored as static JSON files in data/stats/ (excluded from git)
- 02-01: All date utilities use UTC methods exclusively for timezone safety
- 02-02: Shadow DOM for style isolation (host page styles cannot affect widget)
- 02-02: Vite IIFE format for single-file embeddability (no module loader required)
- 02-02: Tree-shaken Chart.js imports reduce bundle size (bar chart components only)
- 02-02: Inlined CSS styles in TypeScript to avoid Vite CSS extraction complexity
- 02-02: Last 12 weeks displayed by default (slice recent data for readability)
- 03-01: Vitest for testing framework (lightweight, TypeScript native, fast)
- 03-01: TDD approach for streak logic (complex edge cases benefit from test-first)
- 03-01: MS_PER_DAY constant for millisecond calculations (86400000 → clarity)
- 03-01: withinCurrentStreak true only if last activity was today or yesterday UTC
- 03-01: Same-day activities deduplicated (multiple runs on one day = one streak day)
- 03-02: Pre-fill all 12 months with zeros for Chart.js axis alignment
- 03-02: Show 3 most recent years in year-over-year data (balances context vs readability)
- 03-02: Use UTC hours for time-of-day bucketing (consistent with date-utils)
- 03-02: 4 time buckets (Morning 6-12, Afternoon 12-18, Evening 18-22, Night 22-6) for radar charts
- 03-02: Write placeholder streaks.json now (establishes structure for Plan 03+)
- 03-03: Abstract WidgetBase class for all widgets (DRY principle, consistent Shadow DOM setup)
- 03-03: CSS custom properties for widget theming (runtime customization with style isolation)
- 03-03: Secondary data URL via config.options.secondaryDataUrl (flexible multi-source pattern)
- 03-03: Programmatic Vite build script instead of multi-entry config (avoids IIFE mode conflicts)
- 03-03: Grid layout for stats card (responsive without media queries)
- 03-04: Canvas must be in DOM before Chart.js instantiation (responsive mode needs dimensions)
- 03-04: skipAutoFetch for widgets with multi-source data fetching (prevents double render)
- 03-04: Radar chart with 4 time-of-day segments (Morning/Afternoon/Evening/Night)
- 03-04: Current streak shows dash when 0 (no active streak is expected behavior)
- 04-01: CI token bootstrap from STRAVA_REFRESH_TOKEN secret only on first run, subsequent runs use committed tokens.json
- 04-01: Git-tracked activity data (data/activities/, data/stats/) for incremental sync, exclude only data/tokens.json
- 04-01: continue-on-error on fetch step allows widget rebuild from cached data if Strava API fails
- 04-01: Node 22 LTS in CI for stability (not Node 24 current/unstable)
- 04-01: npm ci for deterministic CI builds from package-lock.json
- 04-01: [skip ci] in auto-commit message prevents recursive workflow triggers

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-14 (plan execution)
Stopped at: Completed 04-01-PLAN.md (automation pipeline, CI/CD, GitHub Pages) - PHASE 04 COMPLETE - PROJECT FEATURE-COMPLETE
Resume file: None
