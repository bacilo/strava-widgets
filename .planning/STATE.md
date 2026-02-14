# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Phase 2 complete - Core Analytics & First Widget (both plans complete)

## Current Position

Phase: 3 of 4 (Advanced Analytics & Widget Library)
Plan: 1 of 4 in current phase
Status: Phase 03 in progress
Last activity: 2026-02-14 — Completed 03-01 streak calculation algorithms (TDD, 18 passing tests, UTC date handling)

Progress: [██████░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 3.1 min
- Total execution time: 0.26 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Data Foundation | 2 | 4 min | 2 min |
| 02 Core Analytics & First Widget | 2 | 8 min | 4 min |
| 03 Advanced Analytics & Widget Library | 1 | 3.5 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 01-02 (1 min), 02-01 (3 min), 02-02 (5 min), 03-01 (3.5 min)
- Trend: Stable (average 3.1 min/plan)

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-14 (plan execution)
Stopped at: Completed 03-01-PLAN.md (streak calculation algorithms with TDD, 18 passing tests)
Resume file: None
