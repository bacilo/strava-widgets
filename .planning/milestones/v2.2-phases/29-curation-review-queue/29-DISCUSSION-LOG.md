# Phase 29: Curation Review Queue - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 29-Curation Review Queue
**Areas discussed:** What counts as flagged, Where the queue lives, Row content & exclude flow, Guard coverage for new routes

---

## What counts as flagged

### Which demotions populate the queue

| Option | Description | Selected |
|--------|-------------|----------|
| All three guards | Any non-null `demotion` — 65 efforts, 47 activities; Phase 28's D-08 built one shared path | ✓ |
| Ceiling guard only | `guard === 'ceiling'` — 31 efforts; matches ROADMAP wording literally | |
| All three, grouped by guard | Same 47 activities, readable one guard at a time | |

**User's choice:** All three guards (recommended option)
**Notes:** Measured live before asking — ceiling 31, world-record 19, max-speed 15; 400m 47, 1k 13, 1mi 5. The ROADMAP's "ceiling-flagged" wording becomes a superset; CONTEXT flags this for the planner so the checkpoint and the recount assert the same population.

### Already-excluded flagged activities

| Option | Description | Selected |
|--------|-------------|----------|
| Listed, marked excluded | All 47 stay listed; excluded rows show their stored reason | ✓ |
| Hidden once excluded | 35 rows, shrinking as you work; Criterion 1 becomes a subtraction | |
| Split into two sections | "Needs review" above "Already excluded" | |

**User's choice:** Listed, marked excluded
**Notes:** All 12 current exclusions are already inside the 47-activity flagged set, so this is live behaviour, not a hypothetical.

### Row unit

| Option | Description | Selected |
|--------|-------------|----------|
| One row per activity | 47 rows, flagged efforts nested inside | ✓ |
| One row per flagged effort | 65 rows; one activity could render three Exclude buttons | |

**User's choice:** One row per activity

### Phase 27 severe-signal activities as a second source

| Option | Description | Selected |
|--------|-------------|----------|
| No, demotions only | Keeps to CUR-01 and Criterion 1's flagged set | ✓ |
| Yes, as a second source | Widens to a different population — scope creep | |

**User's choice:** No, demotions only
**Notes:** Recorded as a deferred idea.

### Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Not-yet-excluded first, then newest | Next decision on top, stable across reloads | ✓ |
| Most flags first | Worst recordings on top; new flags land unpredictably | |
| Newest first, no grouping | Plain date order, excluded rows interleaved | |

**User's choice:** Not-yet-excluded first, then newest first

---

## Where the queue lives

### Location of the queue view

| Option | Description | Selected |
|--------|-------------|----------|
| Own page at `/__curate/queue` | Served by curate-server outside the mount, esbuild-bundled like the overlay; no published routing change | ✓ |
| Overlay view inside the dashboard | Overlay takes over the view container on a hash route — against "not a second renderer" | |
| Overlay panel on the Records screen | Needs a new mount event from published `records.ts` | |

**User's choice:** Own page at `/__curate/queue` (recommended option, shown with an ASCII preview)
**Notes:** Keeps `curation-seam.test.ts`'s zero-`__curate`-in-view-code pins intact.

### The one navigation action

| Option | Description | Selected |
|--------|-------------|----------|
| Overlay-injected nav link | Overlay adds "Review queue" to the dashboard nav; no change to published `nav.ts` | ✓ |
| Bookmark / typed URL only | Nothing to inject; no click for the checkpoint to exercise | |
| curate prints the URL on startup | Additive to either option above | |

**User's choice:** Overlay-injected nav link
**Notes:** The startup-log URL was folded in as an additive detail rather than an alternative.

### Data source

| Option | Description | Selected |
|--------|-------------|----------|
| Client reads the mirrored JSON | `best-efforts.json` + exclusions from `/strava-widgets/`; no new server read route | ✓ |
| Server route `/__curate/queue.json` | Computed in Node; a second read path and one more guarded route | |

**User's choice:** Client reads the mirrored JSON

### Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Link the built dashboard CSS | Phase 19 baseline and theme apply; OD-3's no-styling-of-its-own still holds | ✓ |
| Unstyled browser defaults | Zero coupling; looks nothing like the dashboard | |

**User's choice:** Link the built dashboard CSS

---

## Row content & exclude flow

### Where the exclude action happens

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in the queue row | Reuses `saveExclusion` and the same PUT route; Criterion 2 exercises "the queue's exclude action" | ✓ |
| Link-through to the activity page | No new UI, but the queue carries no action | |
| Both | Inline exclude plus a link for context | |

**User's choice:** Inline in the queue row
**Notes:** A link to the activity detail page is still on every row (D-12), so the practical difference from "Both" is small.

### Reason field prefill

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-filled from the flags, editable | Built from the demotion reasons, already in the house register; still required | ✓ |
| Empty, as in the detail panel | Consistent with Phase 24; 35 reasons typed by hand | |

**User's choice:** Pre-filled from the flags, editable

### Row fields

| Option | Description | Selected |
|--------|-------------|----------|
| Date, name, link, flagged efforts | Everything needed to decide, from data already loaded | ✓ |
| Minimal: date, link, guard names | Forces opening each activity to see why | |
| Add device family & quality tier | Helps spot a bad-device cohort; a third data source | |

**User's choice:** Date, name, link, flagged efforts
**Notes:** Device family / quality tier recorded as a deferred idea.

### Recompute

| Option | Description | Selected |
|--------|-------------|----------|
| Recompute button on the queue page | Same POST route and streamed output; exclude several, recompute once | ✓ |
| No recompute on the queue | Stays on the detail panel only | |

**User's choice:** Recompute button on the queue page

### The ceiling feedback loop

| Option | Description | Selected |
|--------|-------------|----------|
| Show the count and a note | Header counts plus a plain warning that the flagged set may change | ✓ |
| Show a before/after delta | Most informative; needs state held across the reload | |
| Say nothing | A row appearing or vanishing goes unexplained | |

**User's choice:** Show the count and a note

### Undoing an exclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, edit and remove in place | Pre-ticked row, Save edits, Remove confirms then DELETEs — the detail panel's behaviour | ✓ |
| No, exclude only | CUR-01 names one action; a mis-click needs a detour | |

**User's choice:** Yes, edit and remove in place

### Proving Criterion 1's exact match

| Option | Description | Selected |
|--------|-------------|----------|
| Header count + recount script | On-screen number compared against `compute-pr-ceiling-recount.mjs`'s independent arithmetic | ✓ |
| Header count + full ID list in a test | Stronger, but a pinned ID list goes stale as the archive grows nightly | |
| Count only | Internal agreement — the trap earlier checkpoints were caught by | |

**User's choice:** Header count + recount script

---

## Guard coverage for new routes

### HTTP-layer guard

| Option | Description | Selected |
|--------|-------------|----------|
| Add each new path explicitly | Literal 404 assertions beside the existing three | ✓ |
| Assert on the `/__curate` prefix | Covers future routes; the file argues against widening into a prefix | |

**User's choice:** Add each new path explicitly

### Build-time scan

| Option | Description | Selected |
|--------|-------------|----------|
| Existing marker is enough, proved with a planted leak | Queue page/bundle carry the literal `__curate`; prove red then green | ✓ |
| Add a queue-specific marker | A marker catching no unique failure — a speculative exemption | |

**User's choice:** Yes, but prove it with a planted leak

### Where the planted-leak proof lives

| Option | Description | Selected |
|--------|-------------|----------|
| Automated in both guards' test suites | Fixture-based, reruns in CI, cannot silently rot | ✓ |
| Manual step during the browser checkpoint | Real end-to-end, but proves red once and needs hands | |
| Both | Automated fixtures plus one recorded manual run | |

**User's choice:** Automated in both guards' test suites

### Folded todo IN-17 / IN-18

| Option | Description | Selected |
|--------|-------------|----------|
| Both | Duplicate-violation fix in the guard, plus the brittle literal pin converted to regex | ✓ |
| IN-17 only | Guard bug only | |
| Neither, keep deferred | Leave in pending todos | |

**User's choice:** Both

---

## Claude's Discretion

Recorded in CONTEXT.md § Claude's Discretion: how the queue page's HTML shell is produced and
served and the exact bundle route spelling; whether the write transport is shared by import or by an
extracted module; where the pure flagged-set derivation lives and how its tests are shaped; the exact
prefill sentence when an activity carries several flagged efforts; row markup, heading structure and
screen-reader treatment of the nested per-effort lines; empty and degenerate states (zero flagged,
unbuilt `dist/widgets`, malformed `best-efforts.json`).

## Deferred Ideas

- Severe pace-quality signals as a second queue source (D-04).
- Dismiss/acknowledge action so the queue drains (CUR-04, already deferred in REQUIREMENTS.md).
- Per-effort override (CUR-05, out of v2.2).
- A before/after delta across Recompute (D-14).
- Device family and quality tier on each row (D-12).
- A demoted-cohort filter on the published Activities list (inherited from `28-CONTEXT.md`).

### Reviewed todos (not folded)

- Garmin export adapter when export arrives (STREAM-04, score 0.2) — externally blocked, unrelated
  to curation, matched on the keyword "json" alone.
