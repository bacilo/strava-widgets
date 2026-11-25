# Phase 37: Review-Queue Priority & CUR-04 - Context

**Gathered:** 2026-11-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The local `npm run curate` review queue (Phase 29, `/__curate/queue`) gains two things:

1. **CUR-06 — priority.** It also lists activities whose best effort the unreliable-segment guard
   moved and activities carrying a transported-class pause, ordered transported-first then by
   contaminated metres, with count AND order equal to an independent recount.
2. **CUR-04 — "reviewed and kept".** A row can be marked reviewed-and-kept with a required reason,
   persisted in its own committed, never-published file, through the existing curate server's
   write machinery. It leaves the default view, is reachable under a "Reviewed" filter, and is
   reversible. Both publish guards are shown red under a planted leak of the new route/file and
   green on the served build.

Not in scope: per-effort override (CUR-05, deferred), any change to ranking, to
`best-effort-exclusions.json`'s meaning, or to the public dashboard.

</domain>

<decisions>
## Implementation Decisions

### Measured during this discussion (throwaway probe, 2026-11-25 — references, NEVER expected values)

The scoping-probe-figures-get-pinned failure has happened on this milestone. Every figure below is
a reference to reconcile against, not an expected value.

| Population (live archive, 1,955 index rows) | Activities |
|---|---|
| Today's queue (Phase 29 D-01: any non-null `demotion`) | 371 — of which 365 carry `demotion.guard === 'unreliable-segment'` (Phase 36 D-06) |
| Guard-moved, still ranks (`contaminated != null`), not already in the queue | 194 (451 with `contaminated` in total) |
| Transported (`quality.pauseClassification.transportedCount > 0`) | 5 — all already in the queue: 3647739864, 3475711630, 3475712118, 3475727699, 3475740611 |
| Union | 565 |

Two findings recorded so they are not re-derived:

1. **No numeric metres field exists for the contaminated window.** `contaminated` is
   `{ guard, reason, durationSec, paceSecPerKm, startOffsetSec, endOffsetSec }`; the
   `unreliable-segment` demotion is `{ guard, reason }`. Segment metres appear only inside the
   reason string, which is length-bounded with a trailing "+N more" (Phase 36 D-07), so summing
   them from text is impossible in general. `quality.unreliableSegments.totalMetres` on the index
   row is activity-wide (includes segments no effort window touches). → D-06.
2. **Many moves are tiny** — e.g. 3475116929 400m: contaminated 287.2 s/km vs clean 287.5 s/km.
   The queue will carry a long tail of rows that need a judgement but little attention; this is
   why "reviewed and kept" and the priority order matter, and why the fingerprint must not churn
   on metre drift (D-12).

### Reviewed file and publish guards

- **D-01:** **The reviewed file is never published.** Curate-only state; no public surface reads
  it. Any copy under `dist/widgets` is a leak. This is what CUR-04's "red under a planted leak"
  rows test. Contrast: `best-effort-exclusions.json` is deliberately public and stays so.
- **D-02:** **Location: `data/curation/reviewed.json`, committed.** A new directory that is in
  neither of `build-widgets.mjs`'s `dataDirs`/`dataFiles` lists, so nothing copies it. Rejected:
  `data/private/` — `.gitignore:22` ignores `data/private/*.json`, so a committed file there needs a
  negation line that is easy to get wrong.
- **D-03:** **Guard 1 (build layer, `scripts/lib/curation-guard.mjs` / `build-widgets.mjs`) catches
  the leak by PATH, not content.** Add an explicit existence check for the file's would-be
  published path(s) in `dist/widgets` (the shape of the existing `data/private` existence check,
  `build-widgets.mjs:177`). The `.json` content-scan exemption stays untouched — it is load-bearing
  for keeping the public exclusions file un-flaggable. The check must be watched red on a planted
  copy before it passes. Research decides whether to also forbid the whole `data/curation/` tree.
- **D-04:** **Guard 2 (HTTP layer, `scripts/verify-dashboard-publish.mjs`) asserts 404** on every
  new `/__curate/reviewed...` route AND on `/data/curation/reviewed.json` over the served build,
  as literal paths beside the existing `expect404` list (never widened into a prefix match against
  `/data/` — the existing comment at ~line 468 forbids that). Red under a planted leak, green on the
  served build.
- **D-05:** **Entry shape: `{ activityId, reason, reviewedAt, fingerprint }`** in a
  `{ schemaVersion, note, reviewed: [...] }` document. `reason` required, non-empty after trim;
  `reviewedAt` ISO date; `fingerprint` per D-12. Malformed entries are skipped AND counted, mirroring
  `countMalformedExclusions` (Phase 29 D-09) — never silently dropped.

### Queue membership and priority (CUR-06)

- **D-06:** **"Moved by the unreliable-segment guard" = either kind.** An activity qualifies if any
  effort has `contaminated != null` (ranks on the clean window) OR
  `demotion.guard === 'unreliable-segment'` (no clean window). Plus transported-class activities.
  Phase 29 D-01's "any non-null demotion" membership is kept, so the queue is the union.
  Amends Phase 29 D-04 ("demotions only") to admit the two CUR-06 populations.
- **D-07:** **"Contaminated metres" = metres of the unreliable segments that intersect the
  activity's contaminated effort windows, each segment counted once per activity** even when
  several distances' windows hit it. It is what actually touched a PR. It must come from a numeric
  source — an additive field computed from the detector's `UnreliableSegment` output (e.g. on
  `contaminated` and on the unreliable-segment `demotion`), or an equivalent the researcher
  proposes — **never parsed from the reason string** (finding 1). Additive field ⇒ no
  `BEST_EFFORTS_SCHEMA_VERSION` bump (Phase 26 D-14 / Phase 36 D-05 precedent); the browser client
  (`best-efforts-client.ts`) must parse it fail-closed. Rejected: activity-wide
  `unreliableSegments.totalMetres` (ranks harmless jumps on long runs above a PR that sat on a
  50 m jump); "how far the pace moved" (departs from CUR-06's wording).
- **D-08:** **Order (default view):**
  1. transported-class activities, by contaminated metres desc;
  2. guard-moved activities (D-06), by contaminated metres desc;
  3. remaining Phase 29 rows (world-record / max-speed / ceiling demotions only) — no metres key.
  Ties at every level: newest-first, then activityId — stable across reloads. A transported
  activity with no contaminated effort has metres 0 and sorts last within tier 1. Replaces Phase 29
  D-05 ("not-yet-excluded first, newest-first") for the default view; excluded and reviewed rows are
  no longer in the default view (D-15), so they need no tier there. Within the Excluded / Reviewed /
  All views the same comparator applies.
- **D-09:** **The independent recount checks count AND order.** A committed, zero-import script
  (the `compute-unreliable-segment-recount.mjs` / 32 D-15 / 34 D-18 pattern, fails closed) re-derives
  the membership set and each row's tier and metres from raw `best-efforts.json`, the dashboard
  index and the committed streams, without importing the queue's derive function or the detector.
  It must be shown failing against a deliberately broken derive (wrong tier or wrong metres) before
  it passes. A count-only check passes on a wrong sort — the internal-agreement trap.

### Review stickiness

- **D-10:** **Resurface on change.** A reviewed row stays out of the default view only while its
  current fingerprint equals the stored one. On mismatch it returns to "To review" marked "changed
  since review", showing the old reason and date. "Reviewed" means "reviewed this evidence".
- **D-11:** **Excluded and reviewed-and-kept are mutually exclusive.** "Kept" contradicts
  "excluded". The UI does not offer review on an excluded row without un-excluding first (and vice
  versa), the server rejects a write that would create both, and a test asserts no activityId
  appears in both files.
- **D-12:** **Fingerprint = which flags, not how much:** the set of (distance, guard) pairs over the
  activity's flagged efforts (demotion guards and `contaminated`), plus a transported yes/no. It
  resurfaces when a new distance or guard is flagged or transported appears. Metre drift from
  re-derivation or recalibration does NOT resurface rows. Canonical, order-independent
  serialisation so the stored value is stable. No new threshold constant.
  Amended 2026-11-25 after code review CR-01 (developer-approved): tokens are (distance, kind, guard) so a demoted↔ranked-on-clean-window flip resurfaces a reviewed row.
- **D-13:** **Orphans are kept and shown.** A reviewed entry whose activity is no longer in the
  flagged set is never auto-deleted (curate must not rewrite committed state it was not asked to);
  the Reviewed view lists it as "no longer flagged" with a count, removable by hand via the normal
  un-review action.
- **D-14:** **Un-review deletes the entry** (DELETE on the route), mirroring exclusion
  removal. Git history is the audit trail since the file is committed by hand. No tombstones.

### Queue view and transport

- **D-15:** **Four views: To review (default) / Reviewed / Excluded / All.** To review = not
  excluded and (not reviewed or fingerprint changed). Reviewed includes orphans. Excluded holds
  today's excluded-but-listed rows. All = the full flagged set, so Phase 29 D-02's "listed set
  equals the flagged set" still holds under All. The summary line shows a count per view.
  Amends Phase 29 D-02/D-05 for the default view only.
- **D-16:** **Sibling route sharing the existing machinery:** `PUT`/`DELETE
  /__curate/reviewed/:activityId`, plus a `GET` for the queue to read the file (it is not mirrored
  into `dist/widgets`, unlike exclusions — this amends Phase 29 D-08's "derive from already-mirrored
  JSON" for this one input). Same server, same Origin/Host gate, same `MAX_BODY_BYTES` /
  `MAX_REASON_CHARS`, same activity-id validator, same atomic write path as
  `/__curate/exclusions/:id` — so it is not a second write surface. Rejected: one route with a
  `state` body writing to two files (one handler owning a ranking-critical file and a cosmetic one).
- **D-17:** **Reason is blank and required** for reviewed-and-kept — the developer's judgement, not a
  copy of the flags (the fingerprint already records those). Exclude keeps its Phase 29 D-11
  prefill unchanged.
- **D-18:** **One row at a time.** No bulk action; each review carries its own reason.

### Evidence and process (carried conventions, restated for the planner)

- **D-19:** Checkpoint rows assert values derived independently of the code under test (D-09's
  recount for order/count; a planted copy for each guard). Each discriminator gets the standing
  reachability check in both directions (can fail, can pass) before it is relied on.
- **D-20:** The browser checkpoint for the filters / resurface behaviour runs on the primary
  checkout against a freshly built `dist/widgets` (staged-build cache trap; build-widgets mtime
  skip — verify the served digest).

### Claude's Discretion

- Exact field name and placement of the D-07 numeric metres (on `contaminated`, on the demotion,
  or a per-activity aggregate) — bound by D-07: numeric, detector-derived, additive, fail-closed in
  the browser client, recountable by D-09.
- Whether guard 1 forbids just the file path or the whole `data/curation/` tree (D-03).
- Copy for "changed since review" and "no longer flagged" (house register: measured facts, not
  adjectives).
- Fingerprint serialisation format (D-12).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — CUR-04, CUR-06 (lines ~118-119); CUR-05 deferred (~127)
- `.planning/ROADMAP.md` § Phase 37 — goal and the three success criteria

### Prior decisions this phase builds on or amends
- `.planning/milestones/v2.2-phases/29-curation-review-queue/29-CONTEXT.md` — queue D-01..D-12
  (membership, excluded-stays-listed, one row per activity, order, page/route, derive-in-browser,
  inline exclude, prefill). D-02/D-04/D-05/D-08 amended above.
- `.planning/milestones/v2.1-phases/24-local-curation-mode/24-CONTEXT.md` — curate server, D-12
  127.0.0.1 bind + Origin/Host gate, D-10/D-11 curation guard and planted-fixture proof
- `.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-CONTEXT.md` —
  D-05 `contaminated` shape, D-06 `unreliable-segment` demotion, D-07 bounded reason
- `.planning/phases/34-pause-classification-forgotten-stop/34-CONTEXT.md` — D-02 four classes,
  D-17 index-row `pauseClassification` summary exists for Phase 37
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CONTEXT.md` — detector output
  (`UnreliableSegment`) and the independent-recount pattern (D-15)

### Code
- `scripts/curate-server.mjs` — routes, origin gate, body caps, exclusions write path (~558-625)
- `scripts/curate-queue/derive-flagged.mjs` — membership + sort to extend (zero-import `.mjs` contract)
- `scripts/curate-queue/index.ts`, `scripts/curate-queue/format.mjs` — queue UI
- `scripts/lib/curation-guard.mjs` — guard 1; `.json` exemption rationale in its docblock
- `scripts/build-widgets.mjs` — `dataDirs`/`dataFiles`, private-artifact check (~136-180)
- `scripts/verify-dashboard-publish.mjs` — guard 2, `expect404` list (~468-490)
- `src/analytics/compute-best-efforts.ts`, `src/dashboard/data/best-efforts-client.ts` — where the
  D-07 numeric field is produced and parsed
- `src/analytics/pace-quality.ts` — `pauseClassification.transportedCount`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildExclusionsMap` / `countMalformedExclusions` (derive-flagged.mjs): template for the
  reviewed-file parser and its malformed count.
- Exclusions PUT/DELETE handler in `curate-server.mjs`: id validation, body cap, reason cap,
  atomic write — reuse for D-16.
- `expect404` in `verify-dashboard-publish.mjs`; the private-artifact existence check in
  `build-widgets.mjs` — templates for D-03/D-04.
- `compute-unreliable-segment-recount.mjs` — zero-import recount template for D-09.

### Established Patterns
- `derive-flagged.mjs` must stay `.mjs` with zero imports and zero console calls (bundled into the
  browser by esbuild and run in Node tests; a `.test.ts` sibling would never be collected).
- Additive JSON fields do not bump schema versions; browser clients allowlist and fail closed
  (`VALID_DEMOTION_GUARDS` returns null for unknown values — a new field must be parsed the same way).
- Every guard is proven red on a planted fixture before it is trusted.

### Integration Points
- Queue reads `best-efforts.json`, `best-effort-exclusions.json`, `dashboard/index.json` from the
  mirrored `dist/widgets/data`; reviewed.json arrives via the new GET route instead.
- The transported signal is on the index row (`quality.pauseClassification.transportedCount`) —
  no shard fetch.

</code_context>

<specifics>
## Specific Ideas

- The five transported activities today (3647739864, 3475711630, 3475712118, 3475727699,
  3475740611) are natural fixtures for tier 1 — reference only, not pinned.
- 3475116929 400m (287.2 vs 287.5 s/km) is the archetype of the long low-priority tail.

</specifics>

<deferred>
## Deferred Ideas

- Bulk review with a shared reason — rejected for now (D-18); revisit if the tail proves tedious.
- CUR-05 per-effort override — already deferred in REQUIREMENTS.md.

### Reviewed Todos (not folded)
The 10 keyword matches from `todo.match-phase 37` were reviewed; none concern the curation queue
(pace-chart y-axis, Pauses-row mechanism breakdown, shard read/render caps, validateStreamSeries
null safety, PAUSE-03 generator hardening, exports fail-open hardening, the four Garmin-missing
runs, reverse reconcile, 36.1 WR-04, 36.1 WR-06). Not folded.

</deferred>

---

*Phase: 37-review-queue-priority-cur-04*
*Context gathered: 2026-11-25*
