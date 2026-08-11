---
phase: 16-dashboard-shell-data-contract
plan: 16
subsystem: frontend
tags: [uat, human-verification, data-contract, lazy-loading, timezone, gap-closure, live-origin]

# Dependency graph
requires:
  - phase: 16-dashboard-shell-data-contract (plan 14)
    provides: the deployed GitHub Pages origin these checks run against
  - phase: 16-dashboard-shell-data-contract (plan 10)
    provides: the widened isValidActivityId gate under verification here
  - phase: 16-dashboard-shell-data-contract (plan 12)
    provides: the no-Z timestamp normalisation under verification here
provides:
  - Recorded verdicts for the two data-contract human checks (SC2 lazy detail, P07 i-prefixed ids, WR-02 dates) against the live origin
  - Network-level proof of the DASH-02 lazy-loading contract — request counts observed, not inferred
affects: [phase 16 verification, phase 17 detail-view work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The lazy-load contract is verifiable as a request count, not a vibe: clear the network log on the list view, assert zero data/activities|data/streams entries, click one row, assert exactly two"
    - "Date-rendering correctness can be checked in bulk by diffing each rendered row's displayed date against the date portion of its raw start_date_local, across every row on screen"

key-files:
  created: []
  modified: []
---

# Plan 16-16: Live-origin data-contract verification

## Status

**Complete** — both checkpoint tasks discharged. One sub-criterion is
unfalsifiable against the real archive and is recorded as such (see Limitations).

## What was verified

All checks ran against `https://bacilo.github.io/strava-widgets/` in Chrome on
macOS, browser timezone **Europe/Copenhagen (UTC+2)** — a genuinely non-UTC zone,
which is the condition this plan requires. Nothing was asserted against
`dist/widgets/`.

### Task 1 — lazy detail fetch for an intervals.icu activity (SC2, P07)

The first row of the Activities list is `i174601247` — an `i`-prefixed
intervals.icu id, i.e. exactly the shape that `isValidActivityId` used to reject
before any fetch was issued.

| Criterion | Result |
|---|---|
| No `data/activities/` or `data/streams/` request before opening an activity | PASS — on a cold load of `#/list`, network shows **exactly one** data request: `data/dashboard/index.json`. Zero detail or stream requests. |
| Clicking View Activity renders the stats header, not the error state | PASS — rendered "Herlev Running / Aug 11, 2026 / 10.0 km / 0:58:09 / 5:49/km / 10 m / 142 avg HR / 168 max HR" |
| The detail view issues exactly two requests on open | PASS — **exactly two**, both HTTP 200: `data/activities/i174601247.json` and `data/streams/i174601247.json` |
| Cold load of the deep link `#/activity/i<digits>` renders the same view | PASS — full reload on `#/activity/i174601247` rendered the populated header; no "Couldn't load this activity" state |

This is the DASH-02 defect closed end to end on the live origin: the id survives
validation, both files are fetched lazily and only on open, and the view renders.

### Task 2 — timezone-correct dates (WR-02)

Environment: `Intl.DateTimeFormat().resolvedOptions().timeZone` =
`Europe/Copenhagen`, `getTimezoneOffset()` = −120 (UTC+2). All 56 intervals.icu
rows in the index carry **no-Z** `startDateLocal` values (e.g.
`2026-08-11T07:19:01`) — the exact input shape that caused the defect.

| Criterion | Result |
|---|---|
| Displayed date matches the activity's local wall-clock date, in the list | PASS — all **100** rendered rows compared against the date portion of their raw `startDateLocal`; **0 mismatches**, including all **56** no-Z intervals.icu rows |
| Same date in overview | PASS — overview showed `Aug 11, 2026` for the newest activity, matching list and detail |
| Same date in detail | PASS — detail showed `Aug 11, 2026` for `i174601247`, raw `2026-08-11T07:19:01` |
| Early-morning intervals.icu activity | PASS — earliest in the archive are 06:10, 06:47, 06:55 local; all render their correct calendar date |

## Limitations — one criterion unfalsifiable against real data

**"a late-evening ... intervals.icu activity."** There is no such activity in the
archive. Filtering all 56 intervals.icu rows for a start hour ≥ 21:00 returns
**zero** — this athlete's intervals.icu-era activities are all morning runs, the
latest starting at 07:19. The criterion cannot be discharged with real data.

Worth being precise about what this does and does not leave open. In UTC+2, a
2-hour offset can only shift a displayed date when the local start time is within
2 hours of midnight — i.e. before ~02:00 or after ~22:00. The archive contains no
intervals.icu activity in either window, so **no real row in this dataset can
distinguish the fixed formatter from the broken one at this offset.** The 0/100
match above is a genuine invariant check but is not adversarial for the edge case.

The edge case is instead covered by unit tests: plan 16-12 added
`src/dashboard/views/list.test.ts`, verified identical output under `UTC`,
`America/New_York`, `Europe/Copenhagen` and `Pacific/Auckland`, and confirmed the
suite is load-bearing by reverting the fix and observing 2 failures that reproduce
the documented defect. That is stronger evidence for the edge case than the live
site can currently provide.

## Self-Check: PASSED

Both checkpoint tasks discharged against the live origin. The one criterion that
could not be tested is recorded above with the reason and the compensating
coverage; it did not fail.
