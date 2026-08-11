---
status: partial
phase: 16-dashboard-shell-data-contract
source: [16-VERIFICATION.md, 16-15-SUMMARY.md, 16-16-SUMMARY.md]
started: 2026-08-11T12:15:00Z
updated: 2026-08-11T12:15:00Z
---

## Current Test

[awaiting human testing]

## Context

All 43 must-haves and all 3 ROADMAP success criteria for Phase 16 are VERIFIED,
including independent re-verification against the live origin
`https://bacilo.github.io/strava-widgets/`.

The four items below are **environment-limited, not suspected defects**. They are
recorded rather than silently upgraded to verified because this phase produced two
false passes (16-09 asserting a local server as "deployed", and the exit gate
reporting 15/15 on a build that rendered a black page). None of them blocks the
phase goal as directly observed.

Items 1 and 2 are cheap to discharge opportunistically. Item 3 is a one-minute
check. Item 4 becomes testable only if the archive ever gains a late-evening
intervals.icu activity.

## Tests

### 1. Light-mode toggle legibility on a light-OS machine
expected: On a machine whose OS appearance is set to **light**, open the dashboard,
switch the theme toggle to light mode, and confirm the sun icon is clearly visible
against the near-white `#f5f5f7` nav bar.
context: Only a dark-OS machine was available during verification. There, light mode
measured 3.12:1 contrast — legible, and clearing the 3:1 WCAG threshold for UI
components. Plan 16-11 pinned `color-scheme` to `data-theme` rather than the OS, so
a light-OS machine should compute identically; this confirms that inference.
result: [pending]

### 2. No white flash on first paint in dark mode
expected: With the theme set to dark (or auto on a dark OS), hard-refresh the page
and watch the very first frame. It should paint dark immediately, with no white or
light flash before the stylesheet applies.
context: The structural guarantee was confirmed in the deployed HTML — an inline
theme bootstrap runs synchronously in `<head>` and sets `data-theme` before the
stylesheet link. Only the literal first rendered frame is unobserved.
result: [pending]

### 3. Auto theme follows a live OS appearance change
expected: Set the dashboard theme to `auto`, then change the OS appearance between
light and dark while the page is open. The page theme should follow immediately,
with no reload.
context: Not reachable from page script — the OS appearance cannot be changed from
the browser context, so this could not be automated.
result: [pending]

### 4. Late-evening intervals.icu activity shows the correct date
expected: If an intervals.icu activity ever starts after ~22:00 local, confirm its
displayed date in list, overview and detail matches its true local calendar date.
context: Currently unfalsifiable — zero of the 56 intervals.icu activities start at
or after 21:00 (all are morning runs, latest start 07:19). At the UTC+2 test
timezone, no existing row can distinguish the fixed formatter from the broken one,
because a 2-hour offset only shifts a date within 2 hours of midnight. All 100
rendered rows matched their raw `startDateLocal` with 0 mismatches, and the edge
case is covered by `src/dashboard/views/list.test.ts`, which plan 16-12 confirmed
load-bearing by reverting the fix and observing 2 reproducing failures under forced
timezones (UTC, America/New_York, Europe/Copenhagen, Pacific/Auckland).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
