---
status: complete
phase: 23-trends-zoom-pan-taller-bands
source: [23-VERIFICATION.md]
started: 2026-08-27T07:30:00Z
updated: 2026-08-27T07:55:00Z
---

## Current Test

[none — all items complete]

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

result: **PASS** — closed 2026-08-27 by a real human gesture, method (i).

Build under test: `assets/index-wqbxjbsD.js` (post-fix, commit `49add71`), confirmed via both the
`script[src]` tag and `performance` resource entries. **Cache note:** the first staging attempt
served the CACHED pre-fix `index-BQy-1dz6.js`; caught on the `performance` entries and forced fresh
with a cache-busting query string before any observation was taken. Serving `127.0.0.1` alone was
not sufficient — the same trap this project has hit before.

Expected value derived independently BEFORE the gesture, via the `-` button (which bypasses plugin
limits): 4 presses from the `Aug 2021 to Aug 2026` opening window reach `Jul 2011 to Aug 2026`,
after which `Zoom out` disables. That is the real archive floor.

Gesture: **1076 wheel events, all `isTrusted: true`, 1014 carrying `metaKey`, all 1076 over the HR
canvas**, plus 62 trusted `pointermove` events with `buttons === 1` (the drag).

**The decisive observation:** the range walked from `Aug 2021 to Aug 2026` down through
`Jul 2021 to Aug 2026` — the exact clamp CR-01 produced and the exact value R36(b) recorded as its
stopping point — and did NOT stop there. It continued eleven further steps: `Dec 2020`, `May 2020`,
`Aug 2019`, `Nov 2018`, `Jan 2018`, `Jan 2017`, `Jan 2016`, `Oct 2014`, `Jul 2013`, `Jan 2012`, and
finally **`Jul 2011 to Aug 2026`** — matching the button-derived archive floor exactly. Under the
bug the gesture stopped dead at `Jul 2021`; post-fix it passes through that value as an ordinary
intermediate step. Both bands ended in lockstep at `Jul 2011 to Aug 2026`.

Pan at the boundary: at true full-archive range, `Zoom out`, `Pan to earlier dates` and `Pan to
later dates` are all correctly `disabled` — nothing to pan to when the whole archive is visible, so
a no-op there is right, not the defect. Re-checked WITH headroom: one `Zoom in` gives
`Jan 2014 to Feb 2024`, both pan buttons re-enable, and `Pan to earlier dates` moves the range to
`Jul 2011 to Aug 2021` with lockstep intact. The review's silent-pan failure mode required the
displayed range to EXCEED the plugin limits; with limits now equal to the archive that is
structurally unreachable.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. CR-01 is confirmed closed in a live browser by a real human gesture.
