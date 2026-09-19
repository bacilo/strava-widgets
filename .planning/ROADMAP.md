# Roadmap: Strava Analytics Platform

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-14)
- ✅ **v1.1 Geographic & Widget Customization** — Phases 5-9 (shipped 2026-02-16)
- ✅ **v1.2 Maps & Geo Fix** — Phases 10-13 (shipped 2026-02-18)
- ✅ **v2.0 Training Dashboard** — Phases 14-18 (shipped 2026-08-12)
- ✅ **v2.1 Interface Polish** — Phases 19-25 (shipped 2026-09-05)
- ✅ **v2.2 Pace Data Quality** — Phases 26-31 (shipped 2026-09-19)

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

<details>
<summary>✅ v2.0 Training Dashboard (Phases 14-18) — SHIPPED 2026-08-12</summary>

- [x] Phase 14: Stream Ingestion Foundation (5/5 plans) — completed 2026-08-10
- [x] Phase 15: Best-Effort Engine (4/4 plans) — completed 2026-08-10
- [x] Phase 16: Dashboard Shell & Data Contract (16/16 plans) — completed 2026-08-11
- [x] Phase 17: Activity Browser & Detail Views (15/15 plans) — completed 2026-08-11
- [x] Phase 18: Records, Trends & Differentiators (16/16 plans) — completed 2026-08-12

Full phase details: [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md) · Audit: [`v2.0-MILESTONE-AUDIT.md`](v2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v2.1 Interface Polish (Phases 19-25) — SHIPPED 2026-09-05</summary>

- [x] Phase 19: Design System & Control Styling (17/17 plans) — completed 2026-08-13
- [x] Phase 20: Row-Click Interaction Pattern (20/20 plans) — completed 2026-08-18
- [x] Phase 21: Overview Rebuild (8/8 plans) — completed 2026-08-18
- [x] Phase 22: Calendar Week-Start & Totals (16/16 plans) — completed 2026-08-19, re-verified 2026-09-05
- [x] Phase 23: Trends Zoom, Pan & Taller Bands (13/13 plans) — completed 2026-08-27
- [x] Phase 24: Local Curation Mode (17/17 plans) — completed 2026-09-02
- [x] Phase 25: CI Hardening & Light-Theme Verification (12/12 plans) — completed 2026-09-04

Full phase details: [`milestones/v2.1-ROADMAP.md`](milestones/v2.1-ROADMAP.md)

Every phase closed on a mandatory human browser checkpoint against a production-shaped URL, by
design — this project had shipped rendering defects behind a fully green automated gate three
times before this milestone, and there is no jsdom or headless browser in the repo.

</details>

<details>
<summary>✅ v2.2 Pace Data Quality (Phases 26-31) — SHIPPED 2026-09-19</summary>

- [x] Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage (16/16 plans) — completed 2026-09-10
- [x] Phase 27: Per-Activity Quality Signals (12/12 plans) — completed 2026-09-10
- [x] Phase 28: PR Plausibility Ceiling (15/15 plans) — completed 2026-09-17
- [x] Phase 29: Curation Review Queue (8/8 plans) — completed 2026-09-18
- [x] Phase 30: Elevation Quality Signal (8/8 plans) — completed 2026-09-18
- [x] Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation (10/10 plans, added 2026-09-19 from the close-out audit) — completed 2026-09-19

Full phase details: [`milestones/v2.2-ROADMAP.md`](milestones/v2.2-ROADMAP.md) · Requirements: [`milestones/v2.2-REQUIREMENTS.md`](milestones/v2.2-REQUIREMENTS.md) · Audit: [`milestones/v2.2-MILESTONE-AUDIT.md`](milestones/v2.2-MILESTONE-AUDIT.md) (`passed`, 33/33)

Every phase with a rendered surface (26-30) closed on a human browser checkpoint against a
digest-verified served build, and every phase shipped a classifier-independent recount of its own
headline number — because this milestone's defects were caught by re-deriving a figure outside the
code that produced it, never by a test going red.

</details>

## Progress

**Execution Order:** Phases execute in numeric order: 1 → … → 31. All six milestones shipped; the next milestone continues numbering at Phase 32.

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
| 14. Stream Ingestion Foundation | v2.0 | 5/5 | Complete    | 2026-08-10 |
| 15. Best-Effort Engine | v2.0 | 4/4 | Complete    | 2026-08-10 |
| 16. Dashboard Shell & Data Contract | v2.0 | 16/16 | Complete    | 2026-08-11 |
| 17. Activity Browser & Detail Views | v2.0 | 15/15 | Complete    | 2026-08-11 |
| 18. Records, Trends & Differentiators | v2.0 | 16/16 | Complete    | 2026-08-12 |
| 19. Design System & Control Styling | v2.1 | 17/17 | Complete    | 2026-08-13 |
| 20. Row-Click Interaction Pattern | v2.1 | 20/20 | Complete    | 2026-08-18 |
| 21. Overview Rebuild | v2.1 | 8/8 | Complete    | 2026-08-18 |
| 22. Calendar Week-Start & Totals | v2.1 | 16/16 | Complete    | 2026-08-19 |
| 23. Trends Zoom, Pan & Taller Bands | v2.1 | 13/13 | Complete    | 2026-08-27 |
| 24. Local Curation Mode | v2.1 | 17/17 | Complete    | 2026-09-02 |
| 25. CI Hardening & Light-Theme Verification | v2.1 | 12/12 | Complete    | 2026-09-04 |
| 26. Shared Gap-Aware Pace Derivation & Honest Coverage | v2.2 | 16/16 | Complete    | 2026-09-10 |
| 27. Per-Activity Quality Signals | v2.2 | 12/12 | Complete    | 2026-09-10 |
| 28. PR Plausibility Ceiling | v2.2 | 15/15 | Complete    | 2026-09-17 |
| 29. Curation Review Queue | v2.2 | 8/8 | Complete    | 2026-09-18 |
| 30. Elevation Quality Signal | v2.2 | 8/8 | Complete    | 2026-09-18 |
| 31. Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation | v2.2 | 10/10 | Complete    | 2026-09-19 |

*Last updated: 2026-09-19 — **v2.2 Pace Data Quality shipped**: 6 phases (26-31), 69 plans, 168 tasks, 33/33 requirements, 11 days. Full phase details archived to `milestones/v2.2-ROADMAP.md`; requirements to `milestones/v2.2-REQUIREMENTS.md`; all three audits (interim 2026-09-17, close-out 2026-09-18 `tech_debt`, final 2026-09-19 `passed`) to `milestones/`. Phase 31 was added from the close-out audit and closed the milestone's five silent-and-passing findings at the source before completion. v1.0-v2.1 remain collapsed above.*

*Previously: 2026-09-08 — **v2.2 Pace Data Quality** roadmap created: 5 phases (26-30), 27/27 requirements mapped, scoped from a live investigation of all 1,864 committed streams. Phase order followed the research-converged sequence (shared derivation → quality signals → PR ceiling → review queue → elevation), with two hard constraints carried from PROJECT.md: the PR ceiling demotes-and-flags only, never deletes, and its archive-wide before/after diff is a required reviewed deliverable.*

*Previously: 2026-09-05 — **v2.1 Interface Polish shipped**: 7 phases (19-25), 103 plans, 25/25 requirements. Full phase details archived to `milestones/v2.1-ROADMAP.md`; requirements to `milestones/v2.1-REQUIREMENTS.md`.*
