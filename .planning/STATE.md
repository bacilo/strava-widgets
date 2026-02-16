# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Compute and visualize running statistics that Strava doesn't readily offer, embeddable anywhere on a personal website.
**Current focus:** Milestone v1.2 — Maps & Geo Fix

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-16 — Milestone v1.2 started

## Performance Metrics

**Velocity:**
- Total plans completed: 19 (9 v1.0 + 10 v1.1)
- Total execution time: ~4 days
- v1.0: 9 plans, 3,844 LOC, 1 day
- v1.1: 10 plans, +2,858 LOC, 3 days

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (19 decisions tracked).

### Key Finding: Geocoding Library Issue

The `offline-geocode-city` library uses UN/LOCODE (trade/transport locations) data, which systematically returns nearby suburbs instead of actual major cities. Examples: Paris → Gif-sur-Yvette, Manhattan → Secaucus, Berlin → Stahnsdorf, London → Totteridge. Must be replaced with GeoNames-based solution.

Route polyline data (`map.summary_polyline`) is already stored in activity JSON files — no Strava re-fetch needed for maps.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-16 (v1.2 milestone initialization)
Stopped at: Defining requirements for v1.2
Resume file: None

---
*Last updated: 2026-02-16 after v1.2 milestone started*
