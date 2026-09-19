# Phase 29: Curation Review Queue - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Local curation mode (`npm run curate`, 127.0.0.1 only) gains a **review queue**: a list of the
activities whose best efforts Phase 28 demoted, reachable in one navigation action, with the
existing whole-activity exclusion action available on each row. The queue writes through
`curate-server.mjs`'s existing `PUT`/`DELETE /__curate/exclusions/:activityId` path — its
trusted-origin check, activity-id validation and atomic write — and introduces **no second write
surface**. Both publish guards (`scripts/lib/curation-guard.mjs`'s build-time content scan and
`scripts/verify-dashboard-publish.mjs`'s HTTP-layer 404 assertions) are extended to cover the new
routes and are demonstrated failing in both directions.

The queue is a **developer tool served outside the published mount**, exactly like the overlay: it
is never an input to any Vite config, `tsconfig.json`'s `include`, or `build-widgets.mjs`'s copy
lists, and nothing about it may appear in `dist/widgets` (Phase 24's D-01 structural-absence rule,
inherited unchanged).

Out of scope: a dismiss/acknowledge action (CUR-04, deliberately deferred — the queue is **not
drainable** by design; an activity reviewed and judged fine remains listed), per-effort override
(CUR-05 — exclusion stays whole-activity), elevation quality (Phase 30), and any change to the
Phase 28 ceiling derivation or to what `demotion` contains.

Requirements: CUR-01, CUR-02, CUR-03 (3 total).

</domain>

<decisions>
## Implementation Decisions

### What populates the queue (CUR-01, Criterion 1)

- **D-01:** **Any effort with a non-null `demotion` puts its activity in the queue — all three
  guards, not ceiling alone.** Measured from the live archive on 2026-09-17: **65 demoted efforts
  across 47 activities** — `ceiling` 31, `world-record` 19, `max-speed` 15; by distance 400m 47,
  1k 13, 1mi 5. Phase 28's D-08 deliberately routed all three rejections through **one** shared
  `EffortDemotion` path precisely so downstream consumers need not care which guard fired, and a
  world-record or max-speed flag (implied speeds of 14.75–24.44 m/s) is at least as strong a reason
  to exclude as a ceiling flag.
  **ROADMAP wording note for the planner:** Criterion 1 says "ceiling-flagged effort". Under this
  decision the flagged set is *every demotion*, which is a **superset** of the ceiling cohort
  (47 activities vs the ceiling-only subset). The criterion is satisfied a fortiori, but the plan
  must state the population it asserts against explicitly and use the same population in the
  checkpoint and the recount — the two numbers must never be quietly swapped for each other.
  Rejected: ceiling-only (matches the roadmap's literal wording, but leaves the archive's most
  flagrantly broken efforts — the 34 that Phase 28 converted from *deleted* to *demoted* — with no
  queue entry, which re-creates the "flagrantly broken efforts are the ones nobody can see"
  condition that made this milestone necessary).

- **D-02:** **Already-excluded activities stay listed, marked excluded, showing their stored
  reason.** All **12** current exclusions are already inside the 47-activity flagged set, so this
  is not a hypothetical. The listed set therefore equals the flagged set exactly, which is what
  Criterion 1 asks for — no second derivation ("flagged minus excluded") to keep in sync — and the
  queue doubles as visible confirmation that an exclusion landed.
  Rejected: hiding excluded rows (the queue would shrink as you work, which is pleasant but is
  CUR-04's deferred drainability arriving through the back door, and it makes Criterion 1's exact
  match a subtraction), and a two-section split (same totals, but a second list to build and
  assert).

- **D-03:** **One row per activity, with that activity's flagged efforts nested inside it.**
  Exclusion is whole-activity (CUR-01; CUR-05 deferred), so the unit shown must be the unit acted
  on. 47 rows, not 65.
  Rejected: one row per effort (an activity with three flags would render three rows carrying the
  same Exclude button, where acting on one silently changes the other two).

- **D-04:** **Demotions only — Phase 27 severe-signal activities do not enter the queue.** A severe
  pace-quality signal says the *stream* is noisy; it does not claim a PR is wrong. That cohort is
  already reachable via Phase 27's D-16 severe-signal filter on the Activities list. Noted as a
  deferred idea.

- **D-05:** **Order: not-yet-excluded first, then newest-first within each group.** The next
  decision is always at the top, and the ordering is stable across reloads and across a nightly
  sync.
  Rejected: most-flags-first (puts the worst recordings on top, but a newly synced flag lands
  unpredictably), and plain date order (excluded rows interleave with pending ones).

### Where the queue lives (CUR-01, CUR-03)

- **D-06:** **Its own page served by `curate-server.mjs` at `/__curate/queue`, outside the
  `/strava-widgets` mount**, with its client bundled by the existing `buildOverlay()`-style esbuild
  step into the gitignored `.curate-dist/`. It lands inside the `/__curate` namespace both guards
  already exist to police, and it requires **zero change to published routing or views** —
  `src/dashboard/router.ts`, `nav.ts`, `detail.ts` and `detail-sections.ts` are untouched, so
  `curation-seam.test.ts`'s "`__curate` appears zero times in detail.ts/detail-sections.ts" pins
  keep holding.
  Rejected: an overlay-rendered view inside the dashboard on a hash route (feels native, but the
  published router does not know that route, so the overlay would have to intercept routing and
  render a whole view — directly against Phase 24's "the overlay APPENDS controls; it is not a
  second renderer" rule), and an overlay panel on the Records screen (needs a new mount event
  emitted from published `records.ts`, putting curation-shaped code in the publish graph).

- **D-07:** **The entry point is a "Review queue" link the overlay injects into the dashboard nav.**
  The overlay already loads on every curate-served page, so the link exists exactly when curate is
  running and never otherwise — one click from anywhere in the dashboard, satisfying CUR-01's
  "without hunting" and giving the browser checkpoint a real navigation action to exercise.
  `npm run curate`'s startup log should print the queue URL alongside the dashboard URL.
  Rejected: bookmark-only (no click to exercise, and arguably not "reachable without hunting").

- **D-08:** **The queue page derives its list in the browser from the already-mirrored JSON** —
  `/strava-widgets/data/stats/best-efforts.json` (its `activities[].efforts[].demotion`) and
  `/strava-widgets/data/best-effort-exclusions.json`, the same copies `mirrorExclusions()` and
  `RECOMPUTE_DATA_DIRS` keep current and the same ones the dashboard itself reads. **No new server
  read route.** The `/__curate` namespace stays about writing, the queue can never disagree with
  what the dashboard displays, and the "which activities are flagged" derivation is a pure,
  unit-testable function over parsed JSON.
  Rejected: a server-computed `/__curate/queue.json` (easy to test in Node, but a second read path
  to keep in sync with the mirror and one more route both guards must cover).

- **D-09:** **The page links the dashboard's built stylesheet from `/strava-widgets/`** and ships no
  styling of its own — Phase 24's OD-3 discipline carried across the page boundary, so Phase 19's
  bare-element baseline and the theme apply for free. DOM built with `createElement` +
  `textContent` only, no HTML-string assignment, matching `exclusion-panel.ts`'s idiom.
  Rejected: browser defaults (zero coupling, but the tool looks nothing like the thing it curates
  and ignores the theme).

### Row content and the exclude flow (CUR-01, CUR-02, Criterion 2)

- **D-10:** **The exclude action is inline in the queue row**, reusing the overlay's existing
  `saveExclusion` / `removeExclusion` transport — the same `PUT`/`DELETE
  /__curate/exclusions/:activityId` fetches, the same two-step commit (tick → required reason →
  Save), and the same `location.reload()` afterwards. Criterion 2 exercises "the queue's exclude
  action", so the action must exist *in the queue*. No parallel write surface is introduced; the
  transport module is imported, never reimplemented (the duplicate-derivation failure shape Phase
  24's `resolveExcluded` lesson is about).
  Rejected: link-through-only to the detail panel (no new UI at all, but the queue would then carry
  no action, a weak reading of CUR-01 and of Criterion 2). A link to the activity detail page is
  still present on every row for context (D-12).

- **D-11:** **The reason field is pre-filled from that activity's demotion reasons and remains
  editable and required.** The demotion strings already read in Phase 27's D-09 register — a named
  condition with its measured value (`implied 14.75 m/s exceeds world-record pace 9.30 m/s`) — so
  the prefill is house-style by construction, and 35 pending rows do not each need a sentence typed
  from scratch. The developer can overwrite it; an empty reason is still rejected by the server.
  Rejected: an empty field matching the detail panel exactly (consistent, but it taxes the bulk
  review this queue exists to enable).

- **D-12:** **A row shows: date + activity name linked to `/strava-widgets/#/activity/<id>`, one
  line per flagged effort (distance, guard, the demotion reason string, duration/pace), and the
  exclusion state with its stored reason when excluded.** Every field comes from data the page
  already loads.
  Rejected: minimal rows (would force opening each activity to learn why it was flagged), and
  adding Phase 27 device family + quality tiers (genuinely useful for spotting a bad-device cohort,
  but it pulls `index.json` in as a third data source for information that does not drive the
  exclude decision).

- **D-13:** **A single Recompute control at the top of the queue**, reusing the existing `POST
  /__curate/recompute` and its streamed output. Phase 24's D-07 separation holds: exclude several
  activities, then recompute once, rather than paying the full archive walk per Save.
  Rejected: no recompute on the queue (would send the developer to an activity page mid-review).

- **D-14:** **The header states the counts — flagged activities and how many are already excluded —
  and the Recompute control warns that the flagged set may change afterwards.** The ceiling is
  derived from the *already-filtered* population (Phase 28, PR-02), so excluding an activity and
  recomputing genuinely moves the ceiling and can add or remove rows. The header count is also the
  number the browser checkpoint reads (see D-15).
  Rejected: a computed before/after delta across recompute (most informative, but it means holding
  the previous set across a `location.reload()` — new persisted state in a developer tool), and
  saying nothing (a row appearing or vanishing would have no on-screen explanation).

- **D-15:** **An excluded row is editable and removable in place** — it loads pre-ticked with its
  stored reason, Save edits the entry at the same index (the existing one-entry-per-activity
  contract), and "Remove exclusion" confirms before `DELETE`, exactly as the detail panel behaves.
  Same routes, no new ones. CUR-01 names exclusion as *the* action; undo is the same action's
  inverse on the same path, not a second capability.

- **D-16:** **Criterion 1's "matches exactly" is proved against
  `scripts/compute-pr-ceiling-recount.mjs`, not against the page's own claim.** The header count is
  read in the browser and compared to the count that recount derives with its own arithmetic,
  importing none of the ceiling/compute/util/types modules. This is the extent-vs-independent-value
  discipline this project's checkpoints have repeatedly needed: a page agreeing with the module that
  produced its data agrees with itself by construction. If `compute-pr-ceiling-recount.mjs` does not
  already emit an all-guards **activity** count (it counts demoted *efforts*), adding that output is
  in scope for this phase.
  Rejected: pinning the exact 47 IDs in a test (stronger than a count, but the archive grows via
  nightly CI sync, so a pinned list goes stale and becomes a CI failure about nothing), and a count
  with no independent cross-check.

### Guard coverage (CUR-03, Criterion 3)

- **D-17:** **`verify-dashboard-publish.mjs` gets an explicit 404 assertion per new path** —
  `/__curate/queue` and its bundle route — listed alongside the existing three literal paths. The
  file's own comment forbids widening those literals into a prefix match, and an explicit list makes
  an unasserted route visibly missing.
  Rejected: a single `/__curate` prefix assertion (covers future routes for free, but a prefix check
  can pass for the wrong reason, and the file already argues against exactly this).

- **D-18:** **The build-time scan needs no new marker — the existing `__curate` content scan already
  catches the queue page and its bundle** (both contain the literal string, and neither is `.json`,
  the single exemption). Criterion 3 is satisfied by *proving* it rather than asserting it: plant
  the built queue page/bundle inside a `dist/widgets`-shaped fixture, show `findCurationArtifacts`
  returns a violation for it, then show a clean build returns none.
  Rejected: adding a queue-specific marker string (a marker that catches no failure the existing one
  misses is the speculative-exemption shape Phase 24's review pushed back on).

- **D-19:** **Both directions are proved by automated fixtures in the guards' existing test
  suites** — `scripts/lib/curation-guard.test.mjs` for the build-time scan (planted queue-page
  fixture → violation; clean tree → none) and `scripts/verify-dashboard-publish-guard.test.mjs` for
  the HTTP layer (a file served at the new path → the assertion fails; absent → passes). CI reruns
  them, so the discrimination cannot silently rot.
  Rejected: a manual plant-and-delete during the browser checkpoint only (real end-to-end evidence,
  but it proves the guard red exactly once and needs the developer's hands every time).

### Folded Todos

- **IN-17 / IN-18 curation-guard cosmetics** (`.planning/todos/pending/2026-09-02-in17-in18-curation-guard-cosmetics.md`,
  score 0.6) — folded in full, as `27-CONTEXT.md` anticipated and `28-CONTEXT.md` re-routed here.
  Both sit in files this phase touches anyway:
  - **IN-17** (`scripts/lib/curation-guard.mjs:105-141`) — a non-regular entry whose name also
    matches `__curate`/`.curate-dist` yields **two** violation entries for one path. Fix so one path
    produces one violation; the planted-leak fixtures of D-19 exercise this code directly.
  - **IN-18** (`src/dashboard/curation-seam.test.ts:152-178`) — the WR-17 literal-string pin is
    more format-brittle than its companion regex pin; a reflowed multi-line call would fail only the
    literal check. Convert it to the regex shape.

### Claude's Discretion

Deliberately not decided here — research and planning choose, within the decisions above:

- **How the queue page's HTML shell is produced and served** (a static file read from
  `scripts/curate-queue/`, or a response built in `curate-server.mjs` the way `index.html` is
  patched today) and the exact route spelling for its bundle — subject to D-17's explicit 404 list
  and D-06's "outside the publish graph" rule.
- **Whether the overlay's transport module is shared with the queue client by import or by a small
  extracted module** — D-10 requires reuse, not a particular file layout.
- **Where the pure flagged-set derivation lives** (`scripts/curate-queue/*.ts` versus an existing
  analytics home) and how its unit tests are shaped — bounded by D-08's "no ceiling-logic import in
  the independent recount" separation, which applies to the *recount*, not to the queue client.
- **The precise prefill sentence** when an activity carries several flagged efforts (all reasons
  joined, or the worst one named) — bounded by D-11's register requirement.
- **Row markup and heading structure** against Phase 19's baseline, including how the nested
  per-effort lines are marked up for a screen reader.
- **Empty/degenerate states** — a flagged set of zero, an unbuilt `dist/widgets`, a missing or
  malformed `best-efforts.json`. The existing precedent is never-throw, degrade-to-empty
  (`loadExclusionReason`'s discipline at `detail.ts:463`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's requirements and criteria
- `.planning/ROADMAP.md` § Phase 29: Curation Review Queue — goal, the three success criteria, the
  UI hint and the browser-checkpoint note ("directly extends the Phase 24 local curation UI, which
  this project's own convention ends on a human browser checkpoint every time").
- `.planning/REQUIREMENTS.md` § Curation review queue (CUR) — CUR-01 (including its *accepted*
  non-drainability limitation), CUR-02, CUR-03; and CUR-04/CUR-05 under deferred, which bound what
  this phase must NOT build.

### The flagged population this queue consumes
- `.planning/phases/28-pr-plausibility-ceiling/28-CONTEXT.md` — especially **D-08** (one shared
  demotion path for ceiling/world-record/max-speed), **D-10** (`demotion` is a separate field from
  `excludedFromRecords`; that separation is what this queue acts on), **D-11** (the override/re-admit
  action was deferred *to this phase*), and **D-15** (the classifier-independent recount discipline).
- `.planning/phases/28-pr-plausibility-ceiling/28-VERIFICATION.md` and `28-DIFF.md` — the
  independently-derived flagged/demoted figures Criterion 1 must match.
- `src/analytics/best-effort.types.ts:90` — `EffortDemotion` (`guard`, `reason`) and its home on
  `ComputedEffort`; the queue reads exactly this.
- `scripts/compute-pr-ceiling-recount.mjs` — the classifier-independent recount and its explicit
  bound-on-claim docblock; D-16's cross-check runs against this script.

### The curation machinery being reused (never reimplemented)
- `scripts/curate-server.mjs` — `CURATE_HOST`/`CURATE_PORT`/`CURATE_PREFIX`/`MOUNT_PREFIX`,
  `isTrustedOrigin`, the activity-id validator, the atomic-write exclusion routes, `handleRecompute`,
  `buildOverlay`, `mirrorExclusions`, and the D-09 "no code path here may invoke git" rule.
- `scripts/curate-overlay/index.ts` — the mount seam, the root-absolute `/__curate/...` fetch
  transport, `describeFailure`, and the reload-after-write contract.
- `scripts/curate-overlay/exclusion-panel.ts` — the two-step commit UI, the pre-ticked/edit-in-place
  behaviour, the confirm-before-remove rule, and OD-3's zero-styling / no-HTML-strings discipline.
- `scripts/lib/copy-data-tree.mjs` — `RECOMPUTE_DATA_DIRS` (`data/stats`, `data/dashboard`), which
  is why D-08's mirrored JSON is current after a recompute.

### The guards
- `scripts/lib/curation-guard.mjs` — `findCurationArtifacts`, `CURATE_MARKER`, the fails-closed
  `UNSCANNED_EXTENSIONS` inversion (CR-02) and the `.json` exemption's load-bearing reason; also the
  site of folded todo **IN-17**.
- `scripts/verify-dashboard-publish.mjs:399-409` — the three literal `/__curate/...` 404 assertions
  and the explicit warning against widening them into a prefix match (D-17 extends this list).
- `scripts/lib/curation-guard.test.mjs`, `scripts/verify-dashboard-publish-guard.test.mjs` — where
  D-19's planted-leak fixtures go.
- `src/dashboard/curation-seam.test.ts` — the "`__curate` appears zero times in published view code"
  pins D-06 preserves; also the site of folded todo **IN-18**.

### Prior-phase conventions this phase inherits
- `.planning/phases/24-local-curation-mode/24-CONTEXT.md` — D-01 structural absence from the publish
  pipeline, D-02 mount/prefix split, D-05/D-06 the exclusions-file JSON contract (one entry per
  activity, `distances: null`), D-07 recompute-is-a-separate-press, D-12 the 127.0.0.1 bind and
  Origin/Host gate, OD-1 reload-after-write, OD-3 zero styling.
- `.planning/phases/27-per-activity-quality-signals/27-CONTEXT.md` — D-09's reason-string register,
  D-15/D-16's severe-signal filter (why D-04 keeps that cohort out), D-03's recount independence.
- `.planning/todos/pending/2026-09-02-in17-in18-curation-guard-cosmetics.md` — the folded todo.

</canonical_refs>

<code_context>
## Existing Code Insights

### Measured state of the archive (2026-09-17, live `data/stats/best-efforts.json`)
- **65 demoted efforts across 47 activities** — `ceiling` 31, `world-record` 19, `max-speed` 15.
- By distance: **400m 47, 1k 13, 1mi 5**. No demotions at 5k, 10k, half or marathon.
- `data/best-effort-exclusions.json` holds **12** entries, and **all 12 are inside the 47** — so the
  queue opens with 35 pending and 12 already-excluded rows.
- The archive grows nightly via CI sync, so all of these counts are measurements, not constants:
  they must be re-derived at plan time and never hardcoded into an assertion (the recount script's
  own docblock makes exactly this point about the 662-cohort figure).

### Reusable Assets
- `saveExclusion` / `removeExclusion` / `runRecompute` in `scripts/curate-overlay/index.ts` — the
  whole write transport, including root-absolute paths and `describeFailure`'s status→sentence map.
- `mountCurationControls` in `exclusion-panel.ts` — the tick → reason → Save control, its
  pre-ticked/edit-in-place load and its confirm-before-remove; the queue row's control is this
  pattern per row.
- `buildOverlay()` in `curate-server.mjs` — the esbuild IIFE step (`target: 'es2020'`, out into
  `.curate-dist/`) the queue client's bundle mirrors.
- `isTrustedOrigin` + the activity-id validator + `writeExclusionDoc`'s atomic write — CUR-02's
  "existing machinery" in the literal sense; reuse, do not re-create.
- `findCurationArtifacts` — a pure function returning violations with no `process.exit`, which is
  what makes D-19's planted-fixture test possible at all.

### Established Patterns
- **`/__curate/*` lives outside `MOUNT_PREFIX`** — write and tooling routes are never assets of the
  published site; the queue page inherits this placement (D-06).
- **Curate does working-tree writes only and never runs `git`** — `data/best-effort-exclusions.json`
  sits in the nightly workflow's push-paths filter, so a commit would trigger a rebuild and deploy.
- **Reload after every write**, rather than the tool re-rendering state itself (OD-1).
- **No HTML-string assignment; `createElement` + `textContent` only** — `detail-sections.ts`'s idiom,
  carried into every curate surface.
- **Recounts import none of the modules that produced the numbers they check** (Phase 27 D-03,
  Phase 28 D-15) — the rule D-16 leans on.
- **A guard must be demonstrated red before it is trusted green** — the project-wide discrimination
  convention, and Criterion 3 states it explicitly for both guards.

### Integration Points
- `serveCurateRoute` in `curate-server.mjs:584` — where the new `GET` routes for the queue page and
  its bundle attach, beside `/__curate/health` and `/__curate/overlay.js`.
- The overlay's module-scope listener block in `curate-overlay/index.ts` — where D-07's nav link
  injection attaches. The dashboard nav root is `#app-nav-root` (`src/dashboard/main.ts:32`); the
  injection must not require published `nav.ts` to change.
- `/strava-widgets/data/stats/best-efforts.json` and `/strava-widgets/data/best-effort-exclusions.json`
  — the queue client's two reads (D-08), both already mirrored and both already served.
- `scripts/verify-dashboard-publish.mjs:399-409` — the literal 404 list D-17 extends.
- `main()`'s startup log in `curate-server.mjs` — where the queue URL is printed (D-07).

</code_context>

<specifics>
## Specific Ideas

- The queue header reads as a count of the flagged population with the excluded share called out
  (e.g. "47 flagged · 12 already excluded"), because that leading number is the value the browser
  checkpoint compares against `compute-pr-ceiling-recount.mjs` (D-16).
- Each flagged-effort line should read the way the demotion strings already do — a named condition
  with its measured value (`400m · ceiling · implied 8.85 m/s exceeds 6.55 m/s`), never an adjective
  like "implausible" or "suspicious" (Phase 27 D-09, and `28-CONTEXT.md`'s register note).
- The Recompute note should say plainly that the ceiling is derived from the filtered population, so
  excluding and recomputing can change which activities are listed — the honest version of the
  feedback loop, not a prediction of it.

</specifics>

<deferred>
## Deferred Ideas

- **Severe pace-quality signals as a second queue source** — considered under D-04. A different
  population with a different claim (noisy stream vs wrong PR); Phase 27's D-16 filter already
  reaches it from the Activities list.
- **A dismiss/acknowledge action so a reviewed-and-accepted activity leaves the queue** — CUR-04,
  already deferred in `REQUIREMENTS.md` and reaffirmed here; CUR-01's non-drainability is an
  accepted limitation of this phase.
- **Per-effort override (reject one bogus distance, keep the activity's other records)** — CUR-05,
  deliberately out of v2.2; exclusion stays whole-activity.
- **A before/after delta across Recompute** (which activities entered or left the queue) —
  considered under D-14; needs state persisted across the reload.
- **Device family and quality tier on each queue row** — considered under D-12; genuinely useful for
  spotting a bad-device cohort, and a natural follow-up if bulk review turns out to cluster by
  device.
- **A demoted-cohort filter on the Activities list** — inherited deferral from `28-CONTEXT.md`,
  which named Phase 29 as its natural home. This phase satisfies the underlying need with a
  dedicated local-only queue instead; putting the same filter on the *published* Activities list
  remains a separate, publishable idea.

### Reviewed Todos (not folded)

- **Garmin export adapter when export arrives**
  (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`, score 0.2,
  STREAM-04) — externally blocked on the export arriving and unrelated to curation; matched on the
  keyword "json" alone.

</deferred>

---

*Phase: 29-Curation Review Queue*
*Context gathered: 2026-09-17*
