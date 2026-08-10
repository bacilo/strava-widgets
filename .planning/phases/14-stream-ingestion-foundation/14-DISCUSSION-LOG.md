# Phase 14: Stream Ingestion Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 14-Stream Ingestion Foundation
**Areas discussed:** Committed stream resolution, Missing/partial stream handling

---

## Area Selection

User selected "Whatever you think needs clarifying" — delegated area selection to Claude. Claude chose the two areas where user preference changes the outcome (resolution, missing/partial handling) and kept schema shape + CLI ergonomics as Claude-discretion items.

## Todo Cross-Reference

| Option | Description | Selected |
|--------|-------------|----------|
| Keep deferred | Leave "Garmin export adapter when export arrives" as STREAM-04 future requirement — export hasn't arrived, adapter should be written against real structure | ✓ |
| Fold into Phase 14 | Include the Garmin adapter work in this phase's scope | |

**User's choice:** Keep deferred (Recommended)

---

## Committed Stream Resolution

### Q1: Fidelity of committed data/streams/<id>.json (best efforts computed from them in CI)

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort-grade | Light decimation (~1-3s intervals, ~1,300-2,500 pts/activity), strip nulls, round precision; ~15-35MB est.; charts decimate client-side | ✓ |
| Chart-grade + local best efforts | ~500-point streams; best efforts computed locally at backfill and committed; splits Phase 15 computation across local/CI | |
| Adaptive per-activity | Full fidelity for short runs, heavier decimation for long ones | |

**User's choice:** Best-effort-grade (Recommended)

### Q2: Repo-size guardrail before one-time commit of ~1,850 files

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate + report | Size report (total MB, largest files, git object estimate); warn over ~50MB budget; never auto-commits | ✓ |
| Report only | Print summary, no threshold | |
| Auto-tighten to fit | Increase decimation automatically until under budget | |

**User's choice:** Hard gate + report (Recommended)

---

## Missing/Partial Stream Handling

### Q3: Availability granularity (~306 GPX activities have pace/elevation but no HR/cadence)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-channel | Each stream file declares its channels; dashboard renders exactly what exists | ✓ |
| Binary has/hasn't | One flag; GPX runs either lose real pace data or promise missing channels | |

**User's choice:** Per-channel (Recommended)

### Q4: Where the stream-unavailable flag lives (STREAM-03, ~24-31 activities)

| Option | Description | Selected |
|--------|-------------|----------|
| Central manifest | Committed data/streams/manifest.json with availability + channels + reason codes | ✓ |
| Stub files per activity | Tiny {available: false} files; uniform fetch path but noise + list views can't see availability cheaply | |
| Both | Manifest + stubs; redundant | |

**User's choice:** Central manifest (Recommended)

---

## Claude's Discretion

- Exact JSON schema shape (parallel arrays + schemaVersion; lock before backfill runs)
- Backfill CLI ergonomics (idempotent, consolidate-exports pattern, progress + validation report)
- Cadence unit probe methodology against live intervals.icu payload
- GPX extension-absence reconfirmation / regex reader hardening

## Deferred Ideas

- Garmin export adapter (STREAM-04) — reviewed via todo cross-reference, kept deferred until the export delivery lands in export_data/garmin/
