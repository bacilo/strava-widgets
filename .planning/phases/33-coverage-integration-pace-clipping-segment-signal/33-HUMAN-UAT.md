---
status: complete
phase: 33-coverage-integration-pace-clipping-segment-signal
source: [33-VERIFICATION.md]
started: 2026-09-22T08:18:08Z
updated: 2026-09-22T09:54:55Z
---

## Current Test

[complete]

## Tests

Served build: http://127.0.0.1:4180/ (hard-reload first; view-source must reference `assets/index-B3Etra57.js`).
The developer walked R1–R4 and R14 on 2026-09-22; the rows below were dispositioned from the orchestrator's
served-build read-back (33-VALIDATION.md "Orchestrator pre-read") and need a human's eyes on the rendered page.

### 1. R5 — split marker (PACE-09)
expected: `#/activity/3475740390`, splits table, split 8 carries the **unreliable** marker
result: pass — developer 2026-09-22: "1. yes."

### 2. R6–R9 — coverage captions (COV-03)
expected: 3475724402 `82% of elapsed time covered · 1% recording gaps · 0% paused · 17% unreliable`; 3475734189 `99% … · 0% recording gaps · 1% paused · 0% unreliable`; 3475740390 `98% … · 2% recording gaps · 0% paused · 0% unreliable`; 10146303423 `100% … · 0% · 0% · 0% unreliable` (fourth term present)
result: pass — developer 2026-09-22: "item 2: confirmed all readings."

### 3. R10–R13 — list badge and ninth detail row (SEG-06)
expected: `#/list` shows the unreliable-segments badge on 3475734189 (`1 unreliable segment, 182 m over 0:08 (hidden pause)`) and 3475740390 (`5 unreliable segments, 166 m over 0:15 (isolated jump)`), and NOT on 3475724402 or 10146303423; each detail view's "Unreliable segments" row reads the same string (3475724402: `16 unreliable segments, 2149 m over 12:31 (gap adjacent)`; 10146303423: `No unreliable segments detected`)
result: pass — developer 2026-09-22: "item 3: first two corrrect. The Possido one reads: \"36 samples faster than the 100 m world record\". fourth one has: \"No HRLow confidence\"". Orchestrator note: those are the pre-existing impossible-samples and no-HR / low-confidence badges, not the unreliable-segments badge — its absence on 3475724402 and 10146303423 is the assertion, so this is a pass.

### 4. R15 — double disclosure agrees (SEG-06/COV-03)
expected: on each of the three named activities, the "Coverage gaps" row's itemised "N unreliable segments" equals the "Unreliable segments" row's count (1 / 5 / 16)
result: pass — developer 2026-09-22: "possidi - 16, islands brygge - 1 and bairro dos loios -5"

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
