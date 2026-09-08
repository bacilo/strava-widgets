# Phase 15: Best-Effort Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 15-best-effort-engine
**Areas discussed:** Low-confidence (GPX) efforts, Implausibility guard policy, Validation approach, Records file shape

---

## Area Selection

User was offered the four areas above via multiSelect and answered "Whatever you think requires clarifications" — delegating selection to Claude. All four were discussed, one question each, with recommended defaults.

---

## Low-confidence (GPX) efforts

| Option | Description | Selected |
|--------|-------------|----------|
| Compute all, flag confidence (Recommended) | Compute every distance for geo-sourced streams but mark each effort lowConfidence: true; PRs include them; UI can badge/filter | ✓ |
| Exclude short, flag long | Skip 400m/1k/1mi for geo-distance streams, compute 5k+ with flag | |
| Exclude from PRs entirely | Per-activity efforts only; geo-sourced efforts never enter PR contention | |

**User's choice:** Compute all, flag confidence

---

## Implausibility guard policy

| Option | Description | Selected |
|--------|-------------|----------|
| Drop effort + report (Recommended) | Discard failing effort, other distances survive, rejections listed in console summary, never fails CI | ✓ |
| Keep but quarantine | Write failing efforts with rejected: true + reason, excluded from PRs | |
| Fail the build | Any implausible effort halts the compute step | |

**User's choice:** Drop effort + report

---

## Validation approach

| Option | Description | Selected |
|--------|-------------|----------|
| Spot-check vs Strava/Garmin (Recommended) | ~5–10 mixed-source fixture activities incl. a race, expected values manually read from Strava/Garmin Connect, ~1–2% tolerance | ✓ |
| Known races as fixtures | User names races with official chip times as ground truth | |
| Plausibility-only validation | No external reference; sanity guards + distribution checks only | |

**User's choice:** Spot-check vs Strava/Garmin

---

## Records file shape

| Option | Description | Selected |
|--------|-------------|----------|
| Efforts + PR rankings (Recommended) | One best-efforts.json: per-activity efforts + top-N ranking per distance + was-PR-at-the-time marker | ✓ |
| Per-activity efforts only | PR rankings deferred to Phase 18 | |
| You decide | Claude picks during planning | |

**User's choice:** Efforts + PR rankings

---

## Claude's Discretion

- Exact JSON schema field names/nesting, top-N size, metadata conventions
- World-record pace table values and max_speed comparison margin
- Which specific activities become validation fixtures (candidates presented to user for Strava-value lookup)
- Wiring into compute-all-stats chain vs sibling command

## Deferred Ideas

- Garmin export adapter (pending todo, STREAM-04) — reviewed via todo matching (score 0.2), kept deferred; unrelated to this phase.
