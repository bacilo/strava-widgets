---
phase: 16-dashboard-shell-data-contract
plan: 15
subsystem: frontend
tags: [uat, human-verification, routing, theming, gap-closure, live-origin]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 14)
    provides: the deployed GitHub Pages origin these checks run against
  - phase: 16-dashboard-shell-data-contract (plan 11)
    provides: the theme-toggle visibility fix under verification here
provides:
  - Recorded verdicts for the two chrome-level human checks (SC1 navigation, SC3 theme-toggle visibility) against https://bacilo.github.io/strava-widgets/
  - Measured contrast ratios for the toggle and hamburger controls in light mode, replacing a subjective "is it legible" judgement with a number
affects: [phase 16 verification, phase 17 nav/list work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cold-load hash routing can be verified without N page reloads by mounting the SPA in same-origin iframes, one per hash — each iframe is a genuine fresh document boot"
    - "Control legibility is measurable: compute WCAG contrast from getComputedStyle colour vs the nearest non-transparent ancestor background, rather than eyeballing a screenshot"

key-files:
  created: []
  modified: []
---

# Plan 16-15: Live-origin chrome verification

## Status

**Complete** — both checkpoint tasks discharged, with two sub-criteria explicitly
recorded as NOT independently observed (see Limitations).

## What was verified

All checks ran against the live origin `https://bacilo.github.io/strava-widgets/`
in Chrome on macOS, with the OS appearance set to **dark**. No check ran against
`localhost` or `dist/widgets/` — this is the failure mode that produced 16-09's
false pass and it was deliberately avoided.

Note: these checks were performed against the site **after** the black-page defect
(root-absolute asset URLs, fixed in `0b59d8c`) was found and redeployed. The first
deploy of this phase did not render at all.

### Task 1 — navigation (SC1, DASH-01)

| Criterion | Result |
|---|---|
| Five nav entries, correct order, no detail entry | PASS — Overview, Activities, Calendar, Records, Trends (plus the "Training Dashboard" brand link to `#/`) |
| Nav entries navigate to their stated hash | PASS — `#/`, `#/list`, `#/calendar`, `#/records`, `#/trends` |
| No full page reload on nav | PASS — no document-type request observed; SPA re-render only |
| Hard refresh on each of the five hashes renders that view | PASS — verified by cold document load per hash (same-origin iframe boot), each resolved to its own view and title |
| `#/nonsense` falls back to Overview | PASS — rendered Overview and normalised the hash to `#/` |
| Calendar names Phase 17 | PASS — "This view lands in Phase 17." |
| Records and Trends name Phase 18 | PASS — both read "This view lands in Phase 18." |
| Below 640px the nav collapses behind a hamburger | PASS — verified at a 406px viewport: `aria-expanded` false→true on click, all five entries listed, `aria-expanded` back to false on selection |
| Address bar showed `bacilo.github.io`, not `localhost` | PASS — every assertion issued against the public origin |

Cold-load titles observed: `Overview —`, `Activities —`, `Calendar —`, `Records —`,
`Trends — Strava Analytics`. The Activities cold load rendered 1868 activities /
100 rows.

### Task 2 — theme toggle visibility (SC3, DASH-03)

Cycling the control produced, in order, `auto → light → dark → auto`:

| Mode | data-theme | Visible icons | Icon colour | Accessible name |
|---|---|---|---|---|
| auto (OS dark) | dark | 1 | `rgb(255,107,53)` = `#ff6b35` | "Theme: auto" |
| light | light | 1 | `rgb(252,76,2)` = `#fc4c02` | "Theme: light" |
| dark | dark | 1 | `rgb(255,107,53)` = `#ff6b35` | "Theme: dark" |
| auto | dark | 1 | `#ff6b35` | "Theme: auto" |

| Criterion | Result |
|---|---|
| Exactly one theme icon visible at a time | PASS — one visible `<svg>` at every step; the inactive icon computes `display: none` |
| Visible icon renders in the accent colour | PASS — exact token match in both themes |
| Toggle legible in light mode against `#f5f5f7` | PASS — measured contrast **3.12:1** against the `rgb(245,245,247)` nav surface |
| Hamburger legible in light mode below 640px | PASS — measured **11.60:1** |
| Accessible name matches current mode | PASS — see table |
| Cycling changes the page theme | PASS |
| Choice survives a reload | PASS — set `light`, reloaded, came back `data-theme=light`, `aria-label="Theme: light"`, `localStorage.dashboard-theme="light"` |

The mechanism behind the original defect is confirmed fixed on the live origin:
with the **OS in dark mode**, selecting light mode yields a computed
`color-scheme: light` on `:root`. Before plan 16-11, `color-scheme` tracked the OS,
so the toggle's `currentColor` icon resolved against a UA `ButtonText` derived from
the *system* appearance — which is exactly how it became invisible.

## Limitations — criteria NOT independently observed

Recorded explicitly rather than claimed, because this phase has twice shipped a
false pass:

1. **"On BOTH a light-OS and a dark-OS machine."** Only a **dark-OS** machine was
   available. The light-mode pass above was performed under a dark OS appearance.
   The OS-dependence that motivated this criterion was structurally removed by
   16-11 (`color-scheme` is now pinned to `data-theme`, not the OS), so a light-OS
   machine should compute identically — but that is inference from the mechanism,
   not a second observation.
2. **"A dark-mode reload paints dark on the first frame with no white flash."** The
   structural guarantee is present and was inspected in the deployed HTML: the
   inline theme bootstrap runs synchronously in `<head>`, before the stylesheet
   link, and sets `data-theme` prior to first paint. Observing the actual first
   frame requires a human eye and was not done.
3. **"In `auto`, changing the OS appearance changes the page theme with no reload."**
   Not testable from page script — the OS appearance cannot be changed from the
   browser context. Untested.

## Contrast note (non-blocking)

The light-mode toggle at **3.12:1** clears the WCAG 2.1 AA threshold for
non-text UI components (3:1), but only just. It is unambiguously legible — a
screenshot confirms a clearly visible orange sun icon — and it is a large
improvement on the invisible original. Accent orange on a near-white surface is
inherently contrast-limited. Worth revisiting if the accent is ever used for
smaller controls; not a defect against this plan's criteria.

## Self-Check: PASSED

All acceptance criteria met except the three recorded above as not observed, none
of which failed — they were untestable in this environment.
