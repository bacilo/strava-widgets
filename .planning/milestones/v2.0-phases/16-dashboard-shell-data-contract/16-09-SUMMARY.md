---
phase: 16-dashboard-shell-data-contract
plan: 09
subsystem: testing
tags: [http-smoke-test, node-http, manual-verification, checkpoint]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 08)
    provides: dist/widgets publish directory with the SPA at site root and the full dashboard data contract copied in
provides:
  - "scripts/verify-dashboard-publish.mjs — dependency-free HTTP smoke check over the built publish directory (15/15 checks green)"
  - "npm run verify-dashboard script"
  - "Human verification of the four browser-runtime behaviours this repo has no automated tooling for — PARTIAL: navigation (DASH-01) and degraded/error states confirmed; deep-link detail rendering (DASH-02) and theme-toggle visibility (DASH-03) both surfaced real defects, recorded below as gap-closure work"
affects: [16-gap-closure, 17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node:http-based static file server for local smoke-testing the Vite publish directory, no headless-browser dependency (D-01)"

key-files:
  created:
    - scripts/verify-dashboard-publish.mjs
  modified:
    - package.json

key-decisions:
  - "Checkpoint outcome recorded as PARTIAL, not approved — two of four human-verification steps (DASH-02 deep link rendering, DASH-03 toggle visibility) reported real defects. Per resume instructions, no src/ files were touched to fix them; they are logged verbatim below for gap-closure planning rather than silently patched mid-checkpoint."
  - "requirements-completed intentionally excludes DASH-02 and DASH-03 despite being in this plan's frontmatter requirements list — the human checkpoint that discharges them did not pass. Only DASH-01 (navigation) is marked complete."

patterns-established: []

requirements-completed: [DASH-01]

# Metrics
duration: ~30min (Task 1 authored 2026-08-10T21:16:02+02:00; checkpoint response and closeout completed 2026-08-11)
completed: 2026-08-11
---

# Phase 16 Plan 09: Publish-Directory HTTP Smoke Check and End-to-End Human Verification Summary

**A dependency-free `node:http` smoke script proves every runtime URL the dashboard SPA can request resolves from the built publish directory (15/15 checks green), but the human browser checkpoint it enables came back PARTIAL — the deep-linked activity detail view fails to render in a real browser despite the same files serving correctly over plain HTTP, and the theme toggle is invisible (though still clickable) in light mode.**

## Performance

- **Duration:** ~30 min across two sessions (Task 1 automation on 2026-08-10, human checkpoint response and closeout on 2026-08-11)
- **Started:** 2026-08-10T21:16:02+02:00
- **Completed:** 2026-08-11T08:04:05Z
- **Tasks:** 2/2 (Task 1 complete; Task 2 executed with the checkpoint reaching a PARTIAL, not fully-approved, outcome)
- **Files modified:** 2 (`scripts/verify-dashboard-publish.mjs` created, `package.json` modified)

## Accomplishments

- `scripts/verify-dashboard-publish.mjs` — an ESM Node script using only `node:http`/`node:fs`/`node:path`, no new dependency — starts an ephemeral-port static server rooted at `dist/widgets`, samples real activity ids from the generated index, and asserts 200s for every URL the SPA constructs at runtime plus the expected 404 for a stream-unavailable activity's stream file. Path traversal is rejected via `path.resolve` containment checks.
- `npm run verify-dashboard` added to `package.json` immediately after `build-widgets`; ran 15/15 checks green against a freshly built `dist/widgets` before the checkpoint was presented.
- All pre-checkpoint automated gates confirmed green: `npm run build-widgets` exit 0, `npm run verify-dashboard` 15/15, `npm test` 334/334, `npx tsc --noEmit` clean.
- Human checkpoint presented and answered. Two of four checks passed outright; two surfaced real defects now recorded for gap-closure planning (see below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Script an HTTP smoke check over the built publish directory** — `11e717f` (feat)
2. **Task 2: Human verification of navigation, deep linking, the proving slice, and theming** — no commit (checkpoint-only task, changes no file; `git status --porcelain` was clean at checkpoint time as required by acceptance criteria)

**Plan metadata:** committed as part of this SUMMARY's docs commit.

## Files Created/Modified

- `scripts/verify-dashboard-publish.mjs` — dependency-free HTTP smoke check server + assertions over `dist/widgets`
- `package.json` — added `"verify-dashboard": "node scripts/verify-dashboard-publish.mjs"` to the `scripts` block only; `dependencies`/`devDependencies` untouched

## Decisions Made

See `key-decisions` in frontmatter. In short: this checkpoint's outcome is recorded honestly as PARTIAL rather than approved, no source files were modified to chase a fix under checkpoint pressure, and `requirements-completed` reflects only the requirement (DASH-01) that the human actually confirmed — DASH-02 and DASH-03 remain open until gap-closure work lands and is re-verified.

## Human Checkpoint Outcome — PARTIAL (not approved)

**Verbatim developer response:**

> "1. looks good 2. url updates but says 'couldn't load this activity' 3. confirm 4. looks good but can't see the dark/light toggle when on light mode. If i click the area it still toggles"

**Per-step interpretation:**

| Step | Behavior checked | Requirement | Result |
|------|-------------------|-------------|--------|
| 1 | Navigation without reloads or 404s across all five views | DASH-01 | **PASS** |
| 2 | Proving slice + deep linking (`#/activity/<id>`, cold load renders that activity) | DASH-02 | **FAIL** — see Gap 1 |
| 3 | Degraded and error states (bad id, malformed id, no-stream badge) | (supporting DASH-02) | **PASS** ("confirm") |
| 4 | Theming: light/dark/auto cycling, accent discipline, no-flash first paint, widget-family parity | DASH-03 | **PARTIAL** — see Gap 2 |

Do not re-flag DASH-01 navigation or the error/degraded-state checks (step 3) in gap-closure planning — both were explicitly confirmed working by the developer against the locally served build.

## Follow-ups / Gaps (for gap-closure planning)

### GAP 1 — DASH-02 — severity: blocking

**Symptom (verbatim from developer):** "url updates but says 'couldn't load this activity'"

**Detail:** On Activities, clicking "View Activity" correctly updates the URL hash to `#/activity/<id>` (the hash router itself works), but the detail view renders the "Couldn't load this activity" / "Check your connection and try again." error panel instead of the activity's stats header, distance/time/pace/elevation/HR/cadence numbers, and stream summary.

**Why this is surprising given the automated gate:** `npm run verify-dashboard` (15/15) fetched `/data/activities/<id>.json` and `/data/streams/<id>.json` over plain HTTP against the exact same built `dist/widgets` directory and got 200s with parseable JSON for both. The failure is therefore very likely client-side — e.g., `detail-client.ts`'s fetch URL construction resolving against the wrong base when navigated to from a `#/activity/<id>` hash (as opposed to the script's server-root-relative GETs), or an error being thrown/caught before the successful fetch completes. This needs browser-side investigation (Network tab request URL/status, console errors) that the HTTP smoke script cannot perform.

**Scope of investigation for gap-closure:** `src/dashboard/data/detail-client.ts`, the detail view's fetch invocation, and how the hash router passes the activity id into that fetch path.

### GAP 2 — DASH-03 — severity: cosmetic

**Symptom (verbatim from developer):** "looks good but can't see the dark/light toggle when on light mode. If i click the area it still toggles"

**Detail:** Theme cycling (light → dark → auto), accent-color discipline, and no-flash-on-first-paint were all confirmed working. However, in light mode the theme toggle control itself is not visually distinguishable (icon/contrast issue) — it is functionally present and clickable (clicking its area still toggles the theme correctly), it just cannot be seen.

**Scope of investigation for gap-closure:** the theme toggle's icon/contrast styling for the light-mode design-token values, likely in the global stylesheet or nav component from plan 02/06.

## Deviations from Plan

None — Task 1 was executed exactly as written and passed its full acceptance criteria before the checkpoint was presented. Task 2 is a checkpoint task; its "deviation" is the checkpoint outcome itself (PARTIAL rather than approved), which per the plan's own action text ("If the developer reports a defect instead of approving, record it verbatim in the plan summary's Follow-ups section") is the expected handling path, not an unplanned deviation. No source files were modified in response to the reported gaps, per explicit resume instructions — this plan closes with the gaps documented for separate gap-closure planning.

## Issues Encountered

None beyond the two reported checkpoint gaps documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The HTTP smoke check (`scripts/verify-dashboard-publish.mjs`, `npm run verify-dashboard`) is a durable, repeatable regression gate for the publish directory and should stay in the pre-checkpoint verification sequence for any future dashboard-shell plan.
- Phase 16 is **not** clear to close: DASH-02 (deep-linked activity detail rendering) and DASH-03 (theme toggle visibility) both have open, human-confirmed gaps. Gap-closure work is required before this phase's success criteria can be considered met — do not advance to Phase 17 on the assumption that the shell's proving slice or theming are fully verified.
- GAP 1 is blocking (the core "open a bookmarked activity link" behavior that DASH-02 exists to prove does not work in a real browser) and should be prioritized ahead of GAP 2 (cosmetic).
- Recommend the next planning pass investigate GAP 1 starting from `src/dashboard/data/detail-client.ts` and how it's invoked from the hash-router-driven detail view, using the Network tab evidence the developer already has access to locally.

---
*Phase: 16-dashboard-shell-data-contract*
*Completed: 2026-08-11*
