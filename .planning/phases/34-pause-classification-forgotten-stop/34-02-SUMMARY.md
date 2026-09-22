---
phase: 34-pause-classification-forgotten-stop
plan: 02
subsystem: testing
tags: [zero-import, negative-control, walking-break, stream-arithmetic, checkpoint]

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection
    provides: the LOCAL_GAP_THRESHOLD_SEC / zero-import string-scan header-docblock and FORBIDDEN_MODULE_NAMES + stripComments test-guard shape, copied from scripts/compute-unreliable-segment-recount.mjs
provides:
  - "scripts/compute-walking-break-evidence.mjs: a zero-import (never imports unreliable-segments, pace-derivation or pause-classification) window scanner exporting minWindowSpeed, localCreepWindows, windowEvidence, renderEvidenceMarkdown, parseControlFile, CANDIDATES, EVIDENCE_MIN_SEC_GRID"
  - "34-WALKING-BREAK-EVIDENCE.md: per-candidate window facts (duration, metres, aggregate/rest-of-activity speed, HR range, internal gaps, longest zero-advance run) and a CAN FAIL / CAN PASS reachability table at 6 grid minSec values, regenerates byte-identically"
  - "34-WALKING-BREAK-CONTROL.md: the developer's verbatim D-12 confirmation and three machine-parseable CONFIRMED_CONTROL lines (6286234101, 3475733231, 3475715143), all three research candidates confirmed"
affects: [34-04, 34-06, 34-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-import evidence generator as an independent second opinion for future checkpoint rows (D-18): its own comment-stripped source is string-scanned in tests to guarantee it never imports the modules it is meant to check independently of"
    - "CAN FAIL / CAN PASS reachability stated in both directions, computed on the control's own committed stream, never a look-alike (reachability-probe-must-use-named-input lesson)"

key-files:
  created:
    - scripts/compute-walking-break-evidence.mjs
    - scripts/compute-walking-break-evidence.test.mjs
    - .planning/phases/34-pause-classification-forgotten-stop/34-WALKING-BREAK-EVIDENCE.md
    - .planning/phases/34-pause-classification-forgotten-stop/34-WALKING-BREAK-CONTROL.md
  modified:
    - package.json

key-decisions:
  - "D-12 resolved: all three research-proposed candidates (6286234101, 3475733231, 3475715143) confirmed by the developer as genuine walking breaks, verbatim"
  - "Developer's policy note recorded verbatim as provenance, not expanded into a new requirement: GPS-covered walking should be kept (not eliminated) even where slow; time with the watch off should not be counted"

patterns-established:
  - "Pattern: developer confirmation for a negative control is quoted verbatim and mapped explicitly to each numbered research candidate, never paraphrased or blanket-expanded (mirrors the 19-09/26-13 blanket-reply-is-recorded-as-a-blanket-reply precedent)"

requirements-completed: []  # D-12/STOP-02 tick nothing in REQUIREMENTS.md per this plan's own frontmatter; STOP-02's disposition is set by a later plan (34-11)

duration: ~1h10m (includes a checkpoint pause awaiting the developer's reply)
completed: 2026-09-22
---

# Phase 34 Plan 02: Walking-Break Evidence and Developer-Confirmed Control Summary

**Zero-import stream-arithmetic evidence generator proves both directions of reachability for three research-proposed walking-break windows, and the developer confirms all three as genuine walking breaks (D-12), each recorded verbatim with a machine-parseable CONFIRMED_CONTROL line.**

## Performance

- **Duration:** ~1h10m (13:22:47–14:32:36 UTC+2, including a checkpoint pause for the developer's reply)
- **Started:** 2026-09-22T11:22:47Z
- **Completed:** 2026-09-22T12:32:36Z
- **Tasks:** 3 (Task 1 RED+GREEN, Task 2, Task 3 checkpoint)
- **Files modified:** 5 (2 created scripts, 1 npm script entry, 2 generated/authored planning artifacts)

## Accomplishments

- Built `scripts/compute-walking-break-evidence.mjs`, a zero-import (of `unreliable-segments`, `pace-derivation`, `pause-classification` in any spelling) window scanner with `minWindowSpeed`, `localCreepWindows`, `windowEvidence`, `renderEvidenceMarkdown` and `parseControlFile`, so plan 34-10's checkpoint rows have an independent second opinion (D-18)
- Generated `34-WALKING-BREAK-EVIDENCE.md` twice, byte-identical, with a per-candidate reachability table proving CAN FAIL / CAN PASS in both directions at 6 grid `minSec` values on each candidate's own committed stream, never a look-alike
- Closed research's unverified "flat check" for 3475715143: all three candidates show 0 internal gaps and 0 zero-advance stretches; none is UNPASSABLE at any grid `minSec`
- Obtained and recorded the developer's D-12 confirmation verbatim: all three candidates (6286234101, 3475733231, 3475715143) are genuine walking breaks, unblocking plans 34-06 onward for their STOP-02 negative control

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests for walking-break evidence generator** - `ab091b54` (test)
2. **Task 1 (GREEN): zero-import walking-break evidence generator** - `b684d767` (feat)
3. **Task 2: generate the evidence artifact, twice, byte-identical** - `72b32f76` (docs)
4. **Task 3: developer confirms walking-break controls (D-12)** - `d53898e0` (docs)

**Plan metadata:** (this commit) `docs(34-02): complete plan`

_Note: Task 1 is TDD (test → feat); no refactor commit was needed._

## Files Created/Modified

- `scripts/compute-walking-break-evidence.mjs` - zero-import window scanner (`minWindowSpeed`, `localCreepWindows`, `windowEvidence`, `renderEvidenceMarkdown`, `parseControlFile`), guarded `main()` with `--write`/`--scan` modes
- `scripts/compute-walking-break-evidence.test.mjs` - synthetic-fixture tests plus the FORBIDDEN_MODULE_NAMES + stripComments zero-import guard
- `package.json` - added `"compute-walking-break-evidence": "node scripts/compute-walking-break-evidence.mjs --write"`
- `.planning/phases/34-pause-classification-forgotten-stop/34-WALKING-BREAK-EVIDENCE.md` - generated Candidates table, Reachability table, Research reconciliation, Inputs section
- `.planning/phases/34-pause-classification-forgotten-stop/34-WALKING-BREAK-CONTROL.md` - developer's verbatim confirmation, per-candidate mapping, three CONFIRMED_CONTROL lines, empty Not-confirmed section

## Evidence detail (per Task 2's SUMMARY requirement, carried forward from the continuation)

| Candidate | Internal gaps | Longest zero-advance run | UNPASSABLE rows (minSec>=30) | Measured vs research aggregate speed |
|---|---|---|---|---|
| 6286234101 (t=5289-5696) | 0 | 0s | none | 1.264 vs 1.264, diff 0.000 |
| 3475733231 (t=1827-2229) | 0 | 0s | none | 1.512 vs 1.512, diff 0.000 |
| 3475715143 (t=1590-1992) | 0 | 0s | none | 1.797 vs 1.797, diff 0.000 |

All three candidates are therefore recommended as controls on the evidence alone (no gaps, no
standstill, no UNPASSABLE row at any grid `minSec`) — consistent with the developer confirming
all three in Task 3.

Two consecutive `npm run compute-walking-break-evidence` runs before commit produced identical
sha256 digests (verified by the plan's own automated Task 2 verify block); a third run after
commit left `git diff --exit-code` clean on the artifact.

## Decisions Made

- **D-12 resolved (this plan's core deliverable):** the developer confirmed all three research
  candidates — 6286234101 ("yes walking uphill, impossible to run"), 3475733231 ("walking,
  probably tired"), 3475715143 ("lots of walking because it was a thick forest and parts were
  hard to run") — as genuine walking breaks. Full verbatim reply and per-candidate mapping are in
  `34-WALKING-BREAK-CONTROL.md`.
- The developer's policy note ("as long as there is gps data you don't need to eliminate these
  points. if i turned off the watch then please don't count them" / "if there is data ... you can
  keep it") is recorded as provenance context on the control file, not expanded into a new
  requirement — it restates the existing D-15 "off the clock" scoping rather than adding one.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were completed and committed in a prior
session (verified present at continuation start: `ab091b54`, `b684d767`, `72b32f76`); this
session resumed at Task 3 with the developer's response already supplied, wrote
`34-WALKING-BREAK-CONTROL.md` per the plan's exact required format, and ran the plan's own
automated `parseControlFile` verify command before committing.

## Issues Encountered

None. The automated Task 3 verify (`parseControlFile` over the written control file) returned all
three candidates with window bounds matching `CANDIDATES` exactly on the first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three research candidates are now valid, developer-confirmed negative controls. Plans
  34-06 onward can use any (or all three) for their STOP-02 negative control without a further
  developer round.
- Plan 34-04's calibration can read `34-WALKING-BREAK-CONTROL.md` via `parseControlFile` and use
  the first confirmed control as its anchor check, per this plan's `key_links`.
- Plan 34-10's checkpoint rows can call `--scan` on `compute-walking-break-evidence.mjs` for
  independently-derived expected values (D-18), unaffected by anything pause-classification.ts
  computes.
- No blockers. STOP-02's own requirement-tick disposition remains plan 34-11's to set, per this
  plan's explicit scope boundary.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk; all 4 task commit hashes
(`ab091b54`, `b684d767`, `72b32f76`, `d53898e0`) confirmed present in `git log --oneline --all`.
