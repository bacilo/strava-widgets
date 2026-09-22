# PAUSE-03 Re-Measurement — Transport Gaps on Merged Segments

Machine-written by `npm run compute-pause-transport-remeasurement`; never hand-edit. Regenerating this file against an unchanged archive produces a byte-identical result, including after this file is committed — provenance below is content-addressed, not a wall-clock timestamp and not a bare HEAD commit hash.

## Figure of record

Merged rule (v2.2's own rule re-run on merged gap-bearing intervals, PAUSE-03's corrected figure): **22 activities** (max 15.3 km/h). Old rule (v2.2's rule on the gap interval alone, re-run against today's archive): **13 activities** (max 13.8 km/h). Transported class (D-05, band-independent, no duration floor): **5 activities**, **6 intervals**.

## The v2.2 rule re-run

v2.2's exact rule (`.planning/milestones/v2.2-REQUIREMENTS.md:165`): an activity counts if ANY interval of duration `>= 30` s advances `> 100` m (`V22_MIN_INTERVAL_SEC`/`V22_MIN_ADVANCE_M`, quoted from the rule text, never tuned). Applied side by side to two interval sources:

| Rule | Source | Activities matching | Qualifying intervals | Max km/h |
|---|---|---|---|---|
| Old | pre-detector `recording-gap` intervals alone (`classifyGapsThreeWay`) | 13 | 23 | 13.8 |
| Merged | `recording-gap` OR `merged-segment` intervals (`collectPauseIntervals`) | 22 | 41 | 15.3 |

## Transported class (D-05)

Every gap-bearing interval (`collectPauseIntervals`, no duration floor, D-03) whose implied speed reads strictly above the imported `UNRELIABLE_SPEED_LIMIT_MPS` boundary (via `isTransported`, never a local literal) counts toward this figure. Band-independent — final whatever plan 34-06 calibrates for the walk/run and stationary/walk boundaries.

- Transported activities: **5**
- Transported intervals: **6**

## Newly caught / no longer caught

Newly caught by the merged rule (matched merged, not old) (9): `3475715271`, `3475724402`, `3475727699`, `3475730936`, `3475733984`, `3475740567`, `3475741488`, `3475743571`, `5059213289`

No longer caught (matched old, not merged): _none_.

## Reconciliation against v2.2's figure

v2.2's cited historical figure (`.planning/milestones/v2.2-REQUIREMENTS.md:165`, superseded by this artifact): "9 activities, all at <=14 km/h". No v2.2 script survives to diff against — three independent `git log --all -S` searches ("essentially absent", "advance >100", "teleport", 34-RESEARCH.md Pitfall 3) found the rule text first appearing in the v2.2 REQUIREMENTS.md-defining commit itself, with no accompanying script. This run's old-rule count is **13**, beside the historical **9** — not asserted equal. The most likely single factor is archive growth: the archive has grown materially since v2.2's own ad hoc scoping probe, and the old rule here is re-stated exactly as the PRE-detector `recording-gap` interval (never re-derived or hand-tuned toward either reference).

Research's own illustrative probe (this session only, reference, never an expected value): old-rule 12, merged-rule 26 activities, on an earlier archive snapshot. This run's own committed figures: old-rule **13**, merged-rule **22**.

The merged-rule count is at or above the old-rule count, consistent with the widening's own logic (a merged interval always contains its own gap).

Activity `3475724402` (the phase's own named criterion-1 fixture): merged rule INCLUDES it; old rule does not include it.

## Live denominator

Streams scanned: **1874**. Computable: **1874**. Not computable: **0**.

## Provenance

Measured for Phase 34 (PAUSE-03), plan 34-05.

- `data/streams` git tree: `dfdc7b352f0a138645ad54fe91b881afdb9bbd5f`
- Newest activity start date: 2026-09-18T05:02:46Z
- Regenerate: `npm run compute-pause-transport-remeasurement`
