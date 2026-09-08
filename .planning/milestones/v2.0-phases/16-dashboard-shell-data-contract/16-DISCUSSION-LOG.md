# Phase 16: Dashboard Shell & Data Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 16-dashboard-shell-data-contract
**Areas discussed:** Framework & architecture, Navigation & shell layout, Activity index manifest, Theming & visual identity

---

## Todo Cross-Reference

| Todo | Match score | Decision |
|------|------------|----------|
| Garmin export adapter when export arrives | 0.4 | ✓ Folded into phase |
| Manual exclusion of activities from best-effort/PR calculations | 0.4 | ✓ Folded into phase |

---

## Framework & architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Vanilla TS | Zero new deps, consistent with all existing widgets/pages | ✓ |
| Preact | ~4KB React-compatible layer, JSX + hooks | |
| Lit | Web-components framework, closest to existing custom-element style | |
| You decide | Leave to research + planning | |

**User's choice:** Vanilla TS

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, param routes | #/view/:id and query params from day one | ✓ |
| Simple view switching | Hash only selects the view | |

**User's choice:** Param routes from day one

| Option | Description | Selected |
|--------|-------------|----------|
| View registry | Self-contained view modules registering route/title/nav/mount | ✓ |
| Simple switch router | Central switch over known views | |
| You decide | | |

**User's choice:** View registry

| Option | Description | Selected |
|--------|-------------|----------|
| Plain light DOM | Global stylesheet + CSS custom properties | ✓ |
| Shadow DOM elements | Consistency with widget code | |
| You decide | | |

**User's choice:** Plain light DOM

---

## Navigation & shell layout

| Option | Description | Selected |
|--------|-------------|----------|
| Top nav bar | Horizontal nav, hamburger/scrollable on mobile | ✓ |
| Sidebar | Vertical rail, scales with more functions | |
| You decide | | |

**User's choice:** Top nav bar

| Option | Description | Selected |
|--------|-------------|----------|
| Overview home | Headline stats + recent activities from data/stats | ✓ |
| Activity list | #/ redirects to list | |
| You decide | | |

**User's choice:** Overview home landing

| Option | Description | Selected |
|--------|-------------|----------|
| One proving slice | Stubs + one real index→detail lazy-fetch path | ✓ |
| Pure placeholders | All five routes stubbed, contract proven by tests only | |
| You decide | | |

**User's choice:** One proving slice

| Option | Description | Selected |
|--------|-------------|----------|
| Site root | Dashboard becomes index.html of the Pages site | ✓ |
| /dashboard/ subpath | Root stays untouched | |

**User's choice:** Site root

---

## Activity index manifest

| Option | Description | Selected |
|--------|-------------|----------|
| Browse-complete | All Phase 17 sort/filter fields + badges (~300-500KB raw) | ✓ |
| Minimal | id/date/name/distance/time/pace only | |
| You decide | | |

**User's choice:** Browse-complete index fields

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse committed files | Fetch existing activity + stream JSONs directly | ✓ |
| Derived detail bundles | New dashboard-shaped per-activity files | |
| You decide | | |

**User's choice:** Reuse committed files (Phase 14 schema is the contract)

| Option | Description | Selected |
|--------|-------------|----------|
| Copy into dist in CI | Self-contained same-origin site (~150MB gh-pages) | ✓ |
| Fetch from raw.githubusercontent | No copy, but cross-origin + cache latency | |
| You decide | | |

**User's choice:** Copy into dist in CI

---

## Theming & visual identity

| Option | Description | Selected |
|--------|-------------|----------|
| Same palette | Reuse widget color tokens as global CSS custom properties | ✓ |
| Fresh dashboard look | New palette/typography for a data-dense app | |
| You decide | Decide during /gsd:ui-phase | |

**User's choice:** Same palette as widgets

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle + auto default | System pref default, header toggle persisted in localStorage | ✓ |
| Auto only | Purely follows system preference | |
| You decide | | |

**User's choice:** Toggle + auto default

---

## Claude's Discretion

- Exact index manifest schema (names, nesting, single vs year-chunked), metadata conventions
- Router implementation and view-module interface shape
- Build wiring (extend vite.config.pages.ts vs sibling config)
- CI copy mechanics; overview stat cards; responsive breakpoints; proving-slice depth

## Deferred Ideas

None — both matched todos were folded into phase scope rather than deferred.
