---
phase: 19-design-system-control-styling
plan: 01
subsystem: ui
tags: [css, design-tokens, custom-properties, dashboard]

# Dependency graph
requires: []
provides:
  - "--radius-control (4px) and --radius-panel (8px) theme-invariant CSS custom properties in :root"
  - "Normalized panel radius/padding rhythm across .error-state/.stub-panel, .empty-state, .calendar-picker, .config-notice"
  - "Corrected .stat-grid gap (--space-lg, was --space-xl)"
affects: [19-02, 19-04, "any future plan retrofitting new panels"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Theme-invariant token declared once in bare :root, never duplicated into [data-theme] blocks (matches --space-*/--zone-*/--load-* precedent)"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css

key-decisions:
  - "Followed 19-UI-SPEC's narrow back-substitution scope: only the four retrofitted panels + .config-notice + .stat-grid reference the new tokens; .card, .activity-row, .route-map, .chart-band, .filter-panel--open, .filter-toggle, .pagination__button, .calendar-day, .badge, .segmented keep their literal radius values untouched"
  - "Edited the shared .error-state/.stub-panel rule body in place rather than splitting it into two rules, accepting that .stub-panel also gets restyled as an unavoidable, acknowledged side effect"

patterns-established: []

requirements-completed: [UI-03]

# Metrics
duration: 15min
completed: 2026-08-12
---

# Phase 19 Plan 01: Radius Tokens & Panel Rhythm Normalization Summary

**Declared --radius-control (4px) / --radius-panel (8px) as theme-invariant :root tokens and normalized four panel outliers plus .stat-grid to a single 8px/--space-lg rhythm, entirely via CSS with zero markup or TypeScript change.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-12T18:57Z (approx, per worktree reset)
- **Completed:** 2026-08-12T19:00:34+02:00
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Two new theme-invariant radius tokens (`--radius-control: 4px`, `--radius-panel: 8px`) declared once in the bare `:root` block, adjacent to the spacing scale, with zero duplication into either `[data-theme]` block
- Four real panel outliers (`.error-state`/`.stub-panel`, `.empty-state`, `.calendar-picker`, `.config-notice`) now share `border-radius: var(--radius-panel)` and `padding: var(--space-lg)`, replacing a prior three-way radius split (8px/4px/none) and 48px/32px-wide padding outliers
- `.stat-grid`'s gap corrected from `--space-xl` (32px, the only such outlier in the file) to `--space-lg` (24px), matching the rest of the rhythm
- Overview (`overview.ts`) receives the corrected rhythm purely by cascade — confirmed it renders exactly two of the five retrofitted selectors (`.stat-grid` for Headline Stats, `.error-state` for the data-load failure state) and zero markup/TypeScript changes were needed or made

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare --radius-control and --radius-panel as theme-invariant :root tokens** - `a3f5870` (feat)
2. **Task 2: Normalize the four panel outliers and the one out-of-step grid gap** - `0e98e73` (fix)

_Note: This is a worktree-isolated parallel executor run; the plan-metadata commit (SUMMARY.md) is committed separately per worktree protocol, not as a `docs:` commit alongside STATE.md/ROADMAP.md, which the orchestrator owns centrally after merge._

## Files Created/Modified
- `src/dashboard/styles.css` - Added two `:root` radius tokens; edited five existing rules in place (`.stat-grid`, `.error-state`/`.stub-panel`, `.empty-state`, `.calendar-picker`, `.config-notice`) to reference the shared panel rhythm

## Decisions Made
- Token insertion point: immediately after `--space-3xl: 64px;` and before the `--font-stack` comment in the bare `:root` block, per 19-PATTERNS.md's "shape 2" (theme-invariant) precedent — matches `--space-*`, `--zone-1..5`, `--load-*`.
- Back-substitution scope kept narrow per 19-UI-SPEC: only the five edited rules reference the new tokens. `.card`, `.activity-row`, `.route-map`, `.chart-band`, `.filter-panel--open`, `.filter-toggle`, `.pagination__button`, `.calendar-day`, `.badge`, and `.segmented` all keep their pre-existing literal `border-radius: 8px`/`4px` values untouched — confirmed via `grep -c 'border-radius: 4px;'` returning exactly `5` (down from 6, only `.config-notice`'s literal removed).
- `.error-state`'s radius/padding edit was applied to the shared `.error-state, .stub-panel` rule body in place, since that selector list cannot be split into two independent rules without becoming a larger, unrequested structural change. This means `.stub-panel` also receives `border-radius: var(--radius-panel)` and `padding: var(--space-lg)` even though `.stub-panel` is named nowhere in CONTEXT.md, RESEARCH.md, or 19-UI-SPEC.md. **This is recorded here as a deliberate, acknowledged side effect, not a silent inheritance**, per Task 2's explicit instruction (PATTERNS.md Landmine 1). Plan 18-16 removed both `STUB_PHASE` entries from the codebase, so `.stub-panel` may already be dead CSS with no live consumer — the restyle is inert in practice but is documented for correctness regardless.

## D-14 cascade footprint (Overview's actual stake in this plan)

`overview.ts` was read (not modified) to confirm which of the five retrofitted selectors it actually renders:
- `.stat-grid` — used for the Headline Stats grid (line 111 pre-edit)
- `.error-state` — used for the "Couldn't load the overview" data-load failure state (line 214 pre-edit)
- `.empty-state`, `.calendar-picker`, `.config-notice`, `.stub-panel` — **not rendered anywhere in overview.ts**

So D-14's "Overview receives the corrected rhythm purely by cascade" claim resolves concretely to: the Headline Stats grid now uses a 24px gap instead of 32px, and the overview error state now has an 8px radius and 24px padding instead of no radius and 48px padding — both via cascade, with zero markup or TypeScript change to `overview.ts`.

## Deviations from Plan

None — plan executed exactly as written. The `.stub-panel` side effect described above was explicitly anticipated and called out by the plan itself (Task 2's action text and PATTERNS.md Landmine 1), so it is documented here as required, not treated as an unplanned deviation.

## Issues Encountered

None. All acceptance criteria (grep counts, the Node theme-invariant-shape assertion, the Node panel-normalization assertion, `git status --porcelain` on TS files, `npx tsc --noEmit`, and `npx vitest run src/dashboard/styles.test.ts`) passed on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`--radius-control` and `--radius-panel` now exist in `:root` and are ready for plan 19-02 (control baseline, references `--radius-control`) and plan 19-04 (segmented-control radii, also references `--radius-control`). No blockers. Rendering verification (that panels visually show the new radius/padding) is deferred to plan 19-05's human browser checkpoint per this plan's own `<verification>` section — there is no CSSOM or rendering engine in this repo to prove that automatically.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*
