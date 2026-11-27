# Phase 35: Stream-Derived Running Pace — Independent Recount (D-08)

## Scope and bound on claim

This artifact verifies that the shipped running pace's covered/excluded metres and seconds (produced by `deriveRunningPace`, `src/analytics/pace-derivation.ts`) agree with an independently derived pair, for the named activities and the archive it covers. It does NOT and cannot arbitrate the D-05 disagreement threshold itself — that question belongs to the calibration script, which legitimately DOES import the running-pace function because arbitration is its job. This recount has zero `import`/`require`/dynamic-`import()` statements naming `pace-derivation`, `unreliable-segments`, `pace-quality` or `best-effort`, in any spelling, and imports nothing from `src/` or `dist/` — a recount that imported the code producing the numbers it checks would agree with itself by construction.

## Local duplicated constants

LOCAL_GAP_THRESHOLD_SEC = 10 (local duplicate of RECORDING_GAP_ABS_THRESHOLD_SEC, src/analytics/pace-derivation.ts)
LOCAL_PAUSE_MULTIPLIER = 5 (local duplicate of PAUSE_GAP_P90_MULTIPLIER, src/analytics/pace-derivation.ts)
LOCAL_SPEED_LIMIT_MPS = 7.35 (local duplicate of UNRELIABLE_SPEED_LIMIT_MPS, src/analytics/unreliable-segments.ts; figure of record in 32-unreliable-segment-detection-calibration/32-CALIBRATION.md)

## Named activities

| Activity | Computable | Covered m | Covered s | Excluded m | Excluded s | Running pace |
|---|---|---|---|---|---|---|
| 3475724402 | yes | 11709.7 | 3578 | 1715 | 767 | 5:06/km (305.6) |
| 3475734189 | yes | 6830.3 | 2371 | 0 | 16 | 5:47/km (347.1) |
| 3475740390 | yes | 10515 | 3584 | 56.1 | 66 | 5:41/km (340.8) |
| 5059204779 | yes | 10638 | 3787 | 166 | 1 | 5:56/km (356) |

## Archive-wide reconciliation

Streams scanned: 1874
Computable: 1873
Archive-wide covered/excluded (computable activities only): coveredM=22497586.3, coveredSec=7753525, excludedM=40286.9, excludedSec=600704

## Skipped and non-computable

Parse error: 0
Invalid shape (checkStreamLocal failed): 0
No covered distance (recountCoveredM <= 0): 1

## Inputs

Streams tree (git rev-parse HEAD:data/streams): dfdc7b352f0a138645ad54fe91b881afdb9bbd5f
Newest activity start date: 2026-09-18T05:02:46Z
