---
status: partial
phase: 23-trends-zoom-pan-taller-bands
source: [23-VERIFICATION.md]
started: 2026-08-27T07:30:00Z
updated: 2026-08-27T07:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cadence & HR gesture zoom-out reaches the full archive (post-CR-01 fix)

On the Cadence & HR tab, against the post-fix build (`assets/index-wqbxjbsD.js`, commit `49add71`),
hold the zoom modifier (⌘ on macOS) and scroll outward over either band until it stops. Confirm the
range reaches the full archive (~2011 to ~2026), not a ~5-year clamp around the opening window
(`Jul 2021 to Aug 2026`). Then attempt a drag-to-pan at that fully-zoomed-out boundary and confirm
the canvas still moves rather than silently no-opping.

expected: Gesture zoom-out reaches the same full-archive limits the Volume and Training Load tabs
already reach by gesture (confirmed in R2 / R22 / R48), and drag-to-pan is not a silent no-op once
there.

why_human: `chartjs-plugin-zoom` gesture behaviour cannot be exercised without a real pointer/wheel
event in a live browser; this repo has no jsdom, no headless browser, no CSSOM and no canvas
polyfill (`23-VALIDATION.md`'s own stated hard constraint). The orchestrator's automation harness
was confirmed this session to scroll the page WITHOUT emitting a `wheel` event at all, so it cannot
substitute here.

why_this_gap_exists: CR-01 — found by the post-checkpoint code review, fixed in `49add71` — capped
this exact path at ~5 years of a ~15-year archive throughout all three checkpoint rounds. The
recorded gesture evidence for this tab (R36(b)'s 111 trusted ⌘+wheel events stopping at exactly
`Jul 2021 to Aug 2026`; R51(b)'s Round 3 gesture) was taken against the buggy build, and both rows
only asserted the two bands agreed WITH EACH OTHER — never that the full archive was reachable. No
round, before or after the fix, has gestured outward past the default on this tab. The fix carries
a non-vacuous regression guard (`src/dashboard/views/trends-zoom-logic.test.ts`, verified to fail
with the bug reintroduced), but a unit guard cannot discharge a gesture claim.

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
