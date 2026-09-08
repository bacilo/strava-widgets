# Phase 25: CI Hardening & Light-Theme Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 25-ci-hardening-light-theme-verification
**Areas discussed:** Ordering source of truth, Light-OS checkpoint protocol, Verifier assertion depth, Unknown-bucket hardening scope

---

## Todo Cross-Reference

| Option | Description | Selected |
|--------|-------------|----------|
| WR-19 curation-guard EACCES | Unreadable directory throws uncaught EACCES out of `curation-guard.mjs` instead of a reported violation; fails closed, cost is operator experience. Fix shape already specified in the todo. | ✓ |
| Garmin export adapter | Matched on generic keywords only; blocked on the export arriving; listed Out of Scope in REQUIREMENTS.md. | |

**User's choice:** "you decide what's reasonable"
**Notes:** Folded WR-19 (thematically CI hardening, same guard file family this phase touches, fix shape pre-specified). Left the Garmin adapter pending and recorded the reasoning so a future phase does not re-litigate it.

---

## Ordering source of truth (CI-01)

### Q1 — Where should the single ordering live, and what happens to per-step tolerance?

| Option | Description | Selected |
|--------|-------------|----------|
| One step, tolerance moves into code | Workflow collapses 8 compute steps into one `compute-all-stats` call; the command encodes mandatory vs tolerated and emits `::warning::` lines. One ordering, no mirror. Cost: 8 Actions UI boxes become 1. | ✓ |
| Shared manifest, generated workflow | One declared ordering expanded into YAML by codegen, committed, with a staleness gate. Keeps per-step boxes. Cost: new machinery; YAML no longer hand-editable. | |
| Keep both, add a parity test | Code stays authoritative, workflow keeps its 8 steps, a test fails on divergence. Cheapest. Cost: still two orderings, one merely checked — arguably does not satisfy criterion 2's wording. | |

**User's choice:** One step, tolerance moves into code
**Notes:** Accepted the loss of per-step Actions UI granularity as a real cost, on the basis that `::warning::` annotations still surface in the run summary.

### Q2 — Should tolerance be default behaviour or opt-in for CI?

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-in flag for CI | Fail-fast by default for hand-runs; the workflow passes an explicit flag for warn-and-continue. Drift in a boolean is cheaper than drift in an ordering. | ✓ |
| Tolerant everywhere | One behaviour, nothing to diverge. Cost: a hand-run could degrade into a warning you scroll past. | |
| Fail-fast everywhere | Simplest semantics. Cost: real regression in nightly resilience — a geocoding blip would block the deploy. | |

**User's choice:** Opt-in flag for CI

### Q3 — Continue or move on?

**User's choice:** Next area — accepting Claude's stated defaults (mandatory/tolerated split preserved exactly as today; end-of-run failure summary).

---

## Light-OS checkpoint protocol (VER-01)

### Q1 — How to control for the persisted `dashboard-theme` preference?

| Option | Description | Selected |
|--------|-------------|----------|
| Cleared site data, quote the absence | Clear site data / fresh profile per round; quote `localStorage.getItem('dashboard-theme') === null` at the instant of observation. Makes the row falsifiable. | ✓ |
| Set mode to 'auto' explicitly, then reload | Faster, same resolution path. Weaker: uses the in-page control the requirement says cannot satisfy this item. | |
| Both — cleared for the flash row, 'auto' for the follow rows | Fewer steps overall; two preconditions to keep straight in the write-up. | |

**User's choice:** Cleared site data, quote the absence
**Notes:** Raised because `theme.ts` reads the persisted mode before falling back to `prefers-color-scheme` — a browser whose toggle has ever been touched would ignore the OS setting, and a masked row is indistinguishable from a passing one.

### Q2 — How to make the first-paint flash row observable?

| Option | Description | Selected |
|--------|-------------|----------|
| Run the flash row while the OS is dark | White first frame = failure, `#1a1a2e` = pass. Piggybacks on a state the live-follow row already reaches. Deviates from criterion 4's literal wording; disclosed. | ✓ |
| Assert the mechanism, not the appearance | Stay on light OS; prove the bootstrap ran pre-paint via trace evidence. Proves mechanism, not what a human sees. | |
| Both — dark-OS observation plus mechanism assertion | Most thorough; extra capture step per round. | |

**User's choice:** Run the flash row while the OS is dark
**Notes:** Raised after checking `styles.css` — light `--bg` is `#ffffff`, so on a light OS a white first paint is the correct final state and the row cannot discriminate. Same defect class as Phase 24's R19/R26, caught at discussion time rather than after failed rounds.

### Q3 — Fold a pin on the inline theme bootstrap, or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold it in — pin the inline copy | Test asserting behavioural parity with `theme.ts`, allow-list intact, script positioned before the stylesheet link. Same fix shape as Phase 24's WR-17. | ✓ |
| Defer to a follow-up todo | Keeps the phase boundary exactly as ROADMAP.md drew it; the pin is genuinely new work. | |
| Fold in a minimal version only | Pin just the T-16-TH-01 allow-list — the half with a threat model attached. | |

**User's choice:** Fold it in — pin the inline copy
**Notes:** Raised on discovering that nothing in the repo reads `src/dashboard/index.html` except `build-widgets.mjs`, despite its comment declaring the duplication deliberate and the allow-list load-bearing.

### Q4 — Who performs the OS appearance change?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — human does the switch, agent instruments | Mirrors Phase 24 R34: human gesture, automated evidence capture. | ✓ |
| Fully human-hand | Strongest against a later challenge; costs the most time, yields the least quotable evidence. | |
| Agent-driven via osascript, you confirm | Fastest and reproducible; weakest against criterion 5's "human checkpoint" wording. | |

**User's choice:** Hybrid — human does the switch, agent instruments

### Q5 — What should the round run against?

| Option | Description | Selected |
|--------|-------------|----------|
| Live production URL | `https://bacilo.github.io/strava-widgets/`, now serving current code after the 2026-09-03 push. Literally what criterion 5 asks for. Requires hard-reload discipline. | ✓ |
| Local production-shaped build | `127.0.0.1:4173/strava-widgets/`. Avoids CDN cache; diverges from criterion 5, and prior phases recorded that 127.0.0.1 alone is not sufficient protection. | |
| Both — local first, then production | Rehearse the protocol, then record against production. Two passes of developer time. | |

**User's choice:** Live production URL

### Q6 — Continue or move on?

**User's choice:** Next area

---

## Verifier assertion depth (CI-02)

### Q1 — How deep should the six new by-name assertions go?

| Option | Description | Selected |
|--------|-------------|----------|
| 200 + parses + one structural invariant | Each document returns 200, parses, and satisfies one cheap invariant a truncated/empty file would fail. | ✓ |
| Match the existing deep precedent | Assert like `training-load.json` does today (schemaVersion, >1000 days, finite numbers). Catches semantic regressions too; six more assertion sets with pinned magic numbers to maintain. | |
| Reachability only | 200 by name, nothing more. Exactly criterion 3's wording; an empty-but-present file would pass. | |

**User's choice:** 200 + parses + one structural invariant

### Q2 — How should the per-activity shard sample be chosen?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive at runtime, following the existing convention | Mirrors `newestRow` / `newestWithStream` / `newestWithoutStream` at lines 430-455. No ids to rot; cross-checks index↔shard agreement. | ✓ |
| Derived sample plus one pinned canary | Adds a stable quotable row across rounds; one more line to maintain. | |
| Pinned ids only | Most reproducible and easiest to quote; goes against the file's own convention and rots as the archive grows. | |

**User's choice:** Derive at runtime, following the existing convention

### Q3 — Should the "observed RED" precedent apply to the new assertions?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — each new assertion observed red once | Delete/truncate each document in a scratch `dist/widgets`, confirm non-zero exit naming it, restore, confirm green. | ✓ |
| Yes, but one representative class only | One document plus one shard; faster, leaves five verified by construction. | |
| No — green run is sufficient | Cheapest; departs from a precedent adopted after GAP-24-02. | |

**User's choice:** Yes — each new assertion observed red once

### Q4 — Continue or move on?

**User's choice:** Next area

---

## Unknown-bucket hardening scope (FIX-02)

### Q1 — What should the Unknown-bucket test accept?

| Option | Description | Selected |
|--------|-------------|----------|
| Anything that isn't a non-empty string | `typeof label !== 'string' \|\| label === ''`. Covers null, absent key, malformed shapes, and the empty string that today lands in the `'shoe'` fallback. | ✓ |
| Loosen to a nullish check | `label == null` — exactly what the requirement names. Minimal diff; leaves non-string and empty-string shapes. | |
| Explicit null-or-undefined | Same coverage, spelled out; style choice. | |

**User's choice:** Anything that isn't a non-empty string

### Q2 — Stop at the call site, or address why the type let it happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Make the type honest, bounded triage | `gearName` becomes optional so `tsc` enumerates every consumer with the same assumption; fix gear-aggregate plus trivially adjacent sites, overflow to a todo. | ✓ |
| Normalize once at the read boundary | `compute-gear-aggregate.ts` normalizes rows as it reads `index.json`; one derivation owns the rule. Doesn't help other consumers reading the index their own way. | |
| Call site only | Exactly criterion 1; leaves the type lying about the runtime shape. | |

**User's choice:** Make the type honest, bounded triage

### Q3 — Continue or wrap up?

**User's choice:** Ready for context

---

## Claude's Discretion

- Todo folding — user answered "you decide what's reasonable"; WR-19 folded, Garmin adapter left pending.
- The mandatory/tolerated split for D-03 and the end-of-run failure summary were offered as defaults and accepted via "Next area".
- Flag spelling for the CI tolerance opt-in, the specific structural invariant per document, and the shard sample size are left to the planner.

## Deferred Ideas

- IN-17 and IN-18 (wave-9 review, Info-level, cosmetic) stay in `.planning/todos/pending/` rather than riding along with WR-19.
- Overflow from D-13's `tsc` triage becomes a todo if it exceeds a handful of sites.
- Garmin export adapter (STREAM-04) — reviewed, not folded; blocked on the export arriving and listed Out of Scope.
