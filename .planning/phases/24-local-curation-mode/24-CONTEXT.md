# Phase 24: Local Curation Mode - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

`npm run curate` starts a localhost-only server that serves the **built** `dist/widgets`
under `/strava-widgets` and injects a curation overlay into the real dashboard. From the
activity detail view's "Best Efforts This Run" panel, the developer ticks a run out of PR
contention with a required reason; the write lands in `data/best-effort-exclusions.json`
and the reason renders in the detail view. `build-widgets.mjs` and
`verify-dashboard-publish.mjs` gain paired guards proving the curation write path is
absent from the published bundle.

Requirement: **CUR-01** — **amended by this phase**, see D-04.

Four things inside this boundary that a surface reading of the roadmap misses:

1. **`data/best-effort-exclusions.json` is already published and already asserted.**
   `build-widgets.mjs:163` copies it into `dist/widgets/data/`, `verify-dashboard-publish.mjs:294`
   already asserts it 200s and parses, and both `detail.ts:465` and `records.ts:56` fetch it at
   runtime. Nothing about the **data** is private. Only the **write path** is at issue, and
   criterion 3 must be read that narrowly or it will contradict three shipped call sites.

2. **CUR-01's per-distance clause is being dropped, not implemented.** See D-04. This is a
   deliberate, developer-made scope change with a requirements edit attached — not a planner
   simplification, and not something a downstream agent may re-litigate.

3. **Two files, not one.** Curate writes `data/best-effort-exclusions.json` (repo root) but
   serves `dist/widgets/data/best-effort-exclusions.json` (build output). They are different
   files joined only by `build-widgets.mjs`'s copy step. Nothing the developer writes is
   visible in the page they are looking at until something re-copies it — D-07 is what makes
   criterion 2 demonstrable in a single session.

4. **The Best Efforts panel mounts asynchronously and un-awaited.** `mountBestEffortsAndBadges`
   (`detail.ts:490`) is fired without `await` from `renderSuccess`, behind a `requestToken`
   guard. An overlay cannot assume the panel exists at any point after navigation — D-03 is
   what gives it a defined moment to attach.

**Not in this phase:** Records-screen curation controls (exclusion is set from the detail view
only), any change to what exclusion means for aggregates (it already means nothing — see
"Established Patterns"), the Phase 25 CI/theme items, and Phase 19's open GAP 8.

</domain>

<decisions>
## Implementation Decisions

### Where the curation UI lives

- **D-01: `npm run curate` serves the built `dist/widgets` and injects the overlay in-flight.**
  The server streams `dist/widgets/index.html` with `<script src="/__curate/overlay.js"></script>`
  appended before `</body>`. The overlay is a separate esbuild bundle emitted to a gitignored
  directory (e.g. `.curate-dist/`) that is **never** an input to `vite.config.pages.ts` and
  **never** copied by `build-widgets.mjs`. Absence from the published bundle is therefore
  structural — the overlay is not a build output of the publish pipeline at all — which is the
  same shape as Phase 23's D-05 (incapable, not merely un-opted-in) and `data/private/`'s
  gitignore-plus-guard precedent.
  - The developer curates in the exact panel they are reading, which was the original todo's
    instinct ("perhaps in the line of the PRs").
  - **Rejected: a separate curate-only screen.** Equally sound on absence, but it duplicates a
    browse surface the dashboard already has and moves curation away from the evidence.
  - **Rejected: shipping the control in the published bundle behind a runtime `/__curate/health`
    probe.** The curate UI code would then genuinely be in the published bundle, so criterion 3
    could only assert the endpoints are gone, not the UI. That is the opt-out shape Phase 23's
    D-05 rejected, and it is the weakest available reading of "provably absent".

- **D-02: Mount `dist/widgets` under `/strava-widgets`, with `/__curate/*` served outside the
  prefix.** Matches `verify-dashboard-publish.mjs`'s deliberate prefix mount and the comment
  that records why: GitHub Pages serves this repo as a *project* page, never at a domain root,
  and serving at `/` is precisely what let the absolute-asset bug ship green at 15/15. Curating
  against production's URL shape means the overlay cannot silently acquire a root-relative path
  dependency, and criterion 4's two halves run against the same shape.

- **D-03: The published dashboard gains an inert, documented attach seam — no write path.**
  Two additions, both semantically neutral and both unit-testable:
  (a) `data-activity-id` on the `<section>` that `buildBestEffortsSection` returns
      (`detail-sections.ts:365`), and
  (b) one `dashboard:best-efforts-mounted` CustomEvent carrying `{ activityId }`, dispatched
      from `mountBestEffortsAndBadges` **after** its `requestToken`/`mountedContainer` guard
      passes and the panel has been placed — never before, or the overlay attaches to a panel
      that is about to be discarded.
  The overlay listens for that event and augments the panel. **These additions ship in the
  published bundle and that is fine** — they carry no endpoint, no write, and no curate code;
  criterion 3 is untouched by them.
  - **Rejected: a MutationObserver matching rows by visible label text.** It would keep
    `dist/widgets` byte-identical, but it couples curation to display strings like `"400 m"` and
    to table column order, so a later copy change breaks curation silently.
  - **Rejected: the overlay re-rendering the whole panel.** Two renderers for one panel is the
    drift seam Phase 21's D-05 argued against, and it would pull dashboard modules into the
    overlay bundle.
  - **Note:** an earlier draft of this decision also called for `data-distance` on each `<tr>`.
    D-04 made that unnecessary — the section-level anchor is sufficient.

### What exclusion means

- **D-04: Exclusion is whole-activity. CUR-01 and ROADMAP criterion 1 are amended in this phase
  to drop the per-distance clause.** Developer decision, 2026-08-27, stated directly: *"When
  there is an exclusion from PRs it's for the whole activity. If an activity is excluded we
  should no longer use it to calculate PRs of any kind. It only counts towards aggregates like
  distance/time ran, etc."*
  - **This is a requirements change, and the phase owns it.** Planning must include editing
    `REQUIREMENTS.md`'s CUR-01 entry and `ROADMAP.md`'s Phase 24 success criterion 1, each with
    a dated note pointing back at this decision. Leaving the old text in place would leave the
    phase permanently unable to satisfy its own written criteria.
  - **Two facts established during discussion that de-fang the original rationale.** CUR-01
    justified per-distance selection by warning that a GPS spike corrupts short splits while the
    same run's 5k/10k stay honest, and the developer worried a second same-run effort could be
    promoted. Neither survives contact with the engine: `computeActivityEfforts` yields exactly
    **one** effort per target distance per activity, and `compute-best-efforts.ts:215-219` drops
    it from `byDistance` entirely when excluded — so there is no same-activity runner-up to
    promote, and the next-best always comes from a different run. The residual cost of
    whole-activity exclusion is only that an honest 10k on a spiked run also leaves contention.
  - **Rejected: whole-run-first with a per-distance reveal**, and **rejected: per-distance rows
    with a select-all.** Both honour CUR-01 as originally written; both were declined in favour
    of the simpler semantics.

- **D-05: Curate writes `distances: null` and nothing else; the read path keeps its full
  tolerance.** `buildExclusionIndex` (`best-effort-exclusions.ts:29`) continues to accept
  distance arrays, duplicate entries per activity, and malformed rows exactly as it does today
  — T-16-EX-01/T-16-EX-02 are unchanged, and the two existing live entries (which already use
  `distances: null`) keep working untouched. Curate is simply never a producer of the narrow
  form. **Do not remove distance-array support** to "simplify" — the engine's tolerance is a
  separate, tested contract from what curate writes.
  - Unticking **deletes the entry** from the `exclusions` array. It must never leave
    `distances: []`, which `buildExclusionIndex` silently skips — the entry would read as
    excluded in the file while excluding nothing.

- **D-06: One reason per activity — `buildExclusionReasonIndex` is unchanged.**
  `records-logic.ts:69` stays `Map<string, string>`, and `buildPrFlagsCell`
  (`detail-sections.ts:339`), `buildPrTableRows` and `records.ts:534` keep their current
  signatures. Whole-activity exclusion (D-04) makes one reason per activity exactly right, so
  this phase touches no rendering signature. Criterion 2 ("the reason is surfaced in the detail
  view") is **already satisfied by shipped code** — the per-row `Excluded — {reason}` badge at
  `detail-sections.ts:349` — and this phase's job is to make that badge reachable without a
  hand-edit, not to build it.

### The write loop

- **D-07: Save mirrors instantly; recompute is a separate, deliberate press.**
  On Save the server writes `data/best-effort-exclusions.json`, immediately copies it to
  `dist/widgets/data/best-effort-exclusions.json`, and the overlay re-renders — so the badge and
  reason appear at once, which is what makes criterion 2 demonstrable in one session without a
  rebuild. A separate **"Recompute records"** control runs `compute-best-efforts` →
  `compute-dashboard-index` (ordering matters), streams progress, re-copies `data/stats` and
  `data/dashboard` into `dist/widgets`, and reloads — at which point the next-best effort's
  promotion becomes visible.
  - **Rejected: running the full chain on every Save.** `compute-best-efforts` walks all 1,868
    activities' streams; curating five runs would pay that five times.
  - **Rejected: write-only with a manual rebuild.** Criterion 2 could not then be shown in the
    same session, which makes the human checkpoint clumsier for no gain.

- **D-08: The two-step commit.** Ticking reveals a required reason textarea and a Save button;
  **nothing is written until Save with non-empty text**. An already-excluded activity loads with
  the box ticked and its stored reason in the field, so editing the text and pressing Save
  updates the entry in place. Unticking triggers a confirm before deleting the entry — it
  silently changes PR history, so it earns the extra gesture.
  - **Rejected: a disabled tick that enables once a reason is typed.** A disabled control with
    no visible explanation is the pattern Phase 19's CR-03 already flagged, and editing an
    existing reason would need a second affordance.
  - Controls use Phase 19's shared treatment: `19-CONTEXT.md` D-01 (input/textarea baseline),
    D-05/D-06 (button baseline, scoped hover, disabled treatment), D-09/D-10 (two-tone focus
    ring). This is the roadmap's stated dependency on Phase 19 and the only reason it exists.

- **D-09: Curate never touches git.** Working-tree writes only. The developer reviews
  `git diff`, commits and pushes. Deliberate on two counts: `data/best-effort-exclusions.json`
  sits in the nightly workflow's push-paths filter, so a commit reaching origin triggers a full
  rebuild and deploy — a tickbox must not be able to cause that — and the curate server needs no
  git access or credentials, so it cannot author a commit the developer did not intend.

### Keeping the write path out of production

- **D-10: Two enforcement layers, mirroring `assertNoPrivateArtifacts`'s actual shape.**
  The named precedent is already two-layered and both layers are required here:
  (a) **Build-time hard-fail** in `build-widgets.mjs`, beside `assertNoPrivateArtifacts` and
      called from the same place: no curate bundle may exist anywhere under `dist/widgets`, and
      no published bundle may contain the `__curate` marker. `process.exit(1)`, never a warning
      — `dist/widgets` is what actually gets deployed from a public repo.
  (b) **HTTP assertions** in `verify-dashboard-publish.mjs` using the existing `expect404`
      helper (the same helper that already guards `/data/private/`): `/__curate/health`,
      `/__curate/overlay.js`, and the write endpoint all 404 over the served publish directory.
  **`/data/best-effort-exclusions.json` must keep returning 200** — the existing assertion at
  `verify-dashboard-publish.mjs:294` stays, and the new guards must not be written in a way that
  catches it.

- **D-11: The guard must be proven by a test that plants a regression.** Criterion 3 says the
  assertion "demonstrably fails against a build that regresses this", so a test seeds a fake
  curate artifact into the publish directory and asserts the guard fails. Phase 19's R3-CR-01
  and Phase 23's WR-06 both recorded guards that stayed green when the thing they guarded was
  removed; a guard that has never been observed failing is not evidence.

- **D-12: Bind to `127.0.0.1` explicitly and reject cross-origin writes.** `server.listen(PORT,
  '127.0.0.1')` — never `0.0.0.0` — and every write rejects unless `Origin`/`Host` matches the
  curate origin. Binding alone satisfies the literal "localhost-only" wording but leaves the
  endpoint reachable from any other tab in the developer's own browser; the header check closes
  drive-by CSRF and DNS rebinding in a few lines of Node built-ins.
  - **Rejected: adding a startup session token.** The overlay is served from the same origin the
    token would protect, so it largely duplicates the Origin check for more moving parts.

### Claude's Discretion

The developer answered "you decide" or delegated on these; downstream agents may settle them,
but must stay inside the decisions above:

- **The attach seam's exact form (D-03)** — resolved to `data-activity-id` + a mount event.
- **The absence-proof's enforcement shape (D-10)** — resolved to both layers.
- **Git involvement (D-09)** — resolved to none.
- **Missing-build behaviour:** `npm run curate` should fail fast with instructions when
  `dist/widgets` is not built, following `verify-dashboard-publish.mjs`'s existing FATAL block
  (lines 38-47) rather than silently rebuilding.
- **Overlay bundling:** esbuild, already a devDependency — no new dependency. The server itself
  should stay Node-built-ins-only, matching `verify-dashboard-publish.mjs` and
  `build-widgets.mjs`.
- **The Activities-list badge** (`list.ts:266`) needs no change: `excludedFromRecords` is set
  activity-level at `compute-best-efforts.ts:239`, which whole-activity semantics (D-04) make
  correct by construction. It was previously over-broad for partially-excluded runs; D-04
  removes that case.
- **Port choice** for the curate server.

### Folded Todos

- **"Exclusion tickbox via local curation mode"**
  (`.planning/todos/2026-08-12-exclusion-tickbox-local-curation-mode.md`, score 0.9) — folded in
  full; this phase is that todo. Its approach B (local curation mode) is what D-01 implements,
  and its options A (copy/paste JSON) and C (client-side re-ranking, rejected because it would
  create two authorities for what counts as a PR) remain rejected. **Its step 2 — per-distance
  checkboxes — is superseded by D-04.** Close the todo when the phase closes; the v2.0 audit
  already miscounted one stale todo of this exact kind.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's origin and requirements
- `.planning/todos/2026-08-12-exclusion-tickbox-local-curation-mode.md` — the full option
  analysis (A/B/C) behind local curation mode, the static-hosting constraint that rules out a
  browser write, and why client-side re-ranking was rejected. Read before proposing any
  alternative to D-01.
- `.planning/REQUIREMENTS.md` — CUR-01 (line 51). **Must be edited by this phase per D-04.**
- `.planning/ROADMAP.md` § "Phase 24: Local Curation Mode" (lines 423-436) — success criteria.
  **Criterion 1 must be edited by this phase per D-04.**

### Control styling (the Phase 19 dependency)
- `.planning/phases/19-design-system-control-styling/19-CONTEXT.md` — D-01 (input/select/textarea
  baseline), D-05/D-06 (button baseline, scoped shared hover, disabled treatment), D-09/D-10
  (two-tone focus ring). The curation controls use these; the roadmap's Phase 19 dependency
  exists for no other reason.
- `.planning/phases/19-design-system-control-styling/19-UI-SPEC.md` — the design contract those
  decisions were verified against.

### The panel being augmented
- `.planning/phases/18-records-trends-differentiators/18-UI-SPEC.md` §5 (the "Best Efforts This
  Run" panel), §6 (`Excluded — {reason}` badge, the low-confidence badge, the `1k` age-grade
  asterisk), §14 (extract-don't-duplicate), §15 (never omit a section — render the named empty
  state instead). The overlay must not violate these.

### Precedent for keeping a local-only concern out of the public artifact
- `scripts/build-widgets.mjs` — `assertNoPrivateArtifacts` (from line ~170) and the
  `dataDirs`/`dataFiles` copy lists, including the comment at line 133 explaining why
  `data/private/` must never join them. The two-layer guard D-10 mirrors.
- `scripts/verify-dashboard-publish.mjs` — the prefix-mount comment (~line 55) explaining why
  `/strava-widgets` and not `/`; the FATAL missing-build block (lines 38-47); the
  `expect404` guards for `/data/private/` (lines ~291-293); the existing
  `/data/best-effort-exclusions.json` 200-and-parses assertion (lines 294-301) that **must keep
  passing**.

### The exclusion data path
- `src/analytics/best-effort.types.ts` — `BestEffortExclusionsFile`, `BestEffortExclusionEntry`
  (line ~109), `TARGET_ORDER`, and the schema-version note (line 18: bump only via a coordinated
  migration).
- `src/analytics/best-effort-exclusions.ts` — `buildExclusionIndex` / `isExcluded` /
  `loadExclusions`, and the T-16-EX-01/T-16-EX-02 never-throws tolerance contract D-05 preserves.
- `src/analytics/compute-best-efforts.ts` — lines 215-219 (exclusion drops the effort from
  `byDistance`), line 237 (`excludedFromRecords` per effort), line 239 (activity-level flag),
  line 156 (the `exclusionsPath` default).
- `src/dashboard/views/detail.ts` — `loadExclusionReason` (line ~463) and
  `mountBestEffortsAndBadges` (line ~490), including its `requestToken` guard, which D-03's
  event must fire after.
- `src/dashboard/views/detail-sections.ts` — `buildPrFlagsCell` (line 339) and
  `buildBestEffortsSection` (line ~365), the attach target.
- `src/dashboard/views/records-logic.ts` — `buildExclusionReasonIndex` (line 69), unchanged by
  D-06 but read by both the detail and Records views.
- `data/best-effort-exclusions.json` — the two live hand-written entries, both `distances: null`.

### House rules this phase inherits
- `.planning/PROJECT.md` — the v2.1 milestone note that automated gates have missed rendering
  defects three times, which is why every v2.1 phase ends with a human browser checkpoint.
- `.planning/phases/23-trends-zoom-pan-taller-bands/23-CONTEXT.md` D-05 — the structural-exclusion
  precedent D-01 follows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`verify-dashboard-publish.mjs`'s static server** — a Node-built-ins-only HTTP server that
  already mounts `dist/widgets` under `/strava-widgets`, resolves content types, and fails fast
  on an unbuilt publish directory. The curate server is this plus an injection step, a POST
  handler and a recompute runner. No new dependency is needed.
- **`assertNoPrivateArtifacts` in `build-widgets.mjs`** — the exact two-layer guard shape D-10
  copies, including the walk-and-scan over published JSON and the `process.exit(1)` discipline.
- **`buildExclusionIndex`'s tolerance contract** — already handles every malformed shape curate
  could produce mid-write; the read path needs no hardening.
- **The shipped `Excluded — {reason}` badge** (`detail-sections.ts:349`) — criterion 2's
  rendering already exists and needs no new markup.
- **esbuild** — already a devDependency; the overlay bundle needs no new tooling.

### Established Patterns
- **Exclusions reach exactly one consumer.** `loadExclusions` is imported only by
  `compute-best-efforts.ts:31`. Weekly distance, monthly/yearly stats, training load and gear
  aggregates never see the file — so the developer's "totals must stay unaffected" requirement
  is already structurally true and needs no work, only a checkpoint row confirming it.
- **One effort per target distance per activity.** `computeActivityEfforts` produces a single
  best effort per distance, so exclusion removes an activity from a distance's contention
  entirely; the promoted next-best is always a different run.
- **Un-awaited async mounts behind a request token.** `mountBestEffortsAndBadges` and
  `mountHeavySections` both fire without `await` and re-check `requestToken`/`mountedContainer`
  after their single await point. Anything the overlay attaches must survive rapid navigation.
- **Prefix-mounted local serving.** Both the verifier and every v2.1 browser checkpoint serve
  under `/strava-widgets`, because root-mounted serving previously let an absolute-asset bug
  ship green.
- **Guards must be observed failing.** Phase 19's R3-CR-01 and Phase 23's WR-06 both recorded
  guards that stayed green when their target was deleted. D-11 exists because of that history.

### Integration Points
- `package.json` `scripts` — a new `curate` entry alongside `verify-dashboard`.
- `scripts/build-widgets.mjs` — a new curation-artifact guard called where
  `assertNoPrivateArtifacts` is called; the copy lists are otherwise untouched.
- `scripts/verify-dashboard-publish.mjs` — new `expect404` assertions in the same section as the
  `/data/private/` guards.
- `src/dashboard/views/detail-sections.ts` and `detail.ts` — D-03's two inert additions. These
  are the phase's **only** changes to published dashboard source.
- `.gitignore` — the overlay's build output directory.
- `data/best-effort-exclusions.json` — the write target; already in the nightly workflow's
  push-paths filter (added 2026-08-12), so a committed change triggers a rebuild and deploy.

</code_context>

<specifics>
## Specific Ideas

- The developer's original framing, from the folded todo: the tickbox belongs **"perhaps in the
  line of the PRs"** — i.e. in the panel where the evidence is, not on a separate admin screen.
  D-01's overlay was chosen over a standalone curate screen specifically to honour this.
- The developer's stated semantics, verbatim (2026-08-27): *"When there is an exclusion from PRs
  it's for the whole activity. If an activity is excluded we should no longer use it to
  calculate PRs of any kind. It only counts towards aggregates like distance/time ran, etc... but
  not for PRs. So if we exclude a 400 PR from an activity, there shouldn't be a second 400 m PR
  from the same activity emerging."* D-04 and D-05 implement this.
- The selected interaction shape for D-08:

  ```
  ☐ Exclude this run from PRs

  ☑ Exclude this run from PRs
     Reason (required)
     [ GPS device unreliable…            ]
     [ Save ]  [ Cancel ]

  already excluded:
  ☑ Exclude this run from PRs
     [ Recorded with an inaccurate GPS device… ]
     [ Save ]              ← edits in place
     [ Remove exclusion ]  → confirm → entry deleted
  ```

- The selected recompute shape for D-07: Save is instant (copy + re-render); a separate
  **"Recompute records"** press runs the chain with streamed progress and reloads.

</specifics>

<deferred>
## Deferred Ideas

- **Per-distance exclusion selectability** — the capability CUR-01 originally required, declined
  by D-04. The data model and `buildExclusionIndex` still support it on read, so a future phase
  could surface it without a migration. Recorded here so the removal is visible rather than lost.
- **Curation from the Records screen's PR tables** — the other surface where an untrustworthy PR
  is visible (`records.ts:534` already renders the `Excluded — {reason}` badge there). Out of
  scope: the detail view is where the evidence for an exclusion lives.
- **A curate view listing all current exclusions** — useful for auditing or bulk-undoing, but a
  second surface beyond what CUR-01 asks for. `data/best-effort-exclusions.json` is two entries
  today and readable by hand.

### Reviewed Todos (not folded)

- **"Garmin export adapter when export arrives"**
  (`.planning/todos/2026-08-10-garmin-export-adapter-when-export-arrives.md`, score 0.4) — not
  folded. It matched only on generic `data`/`json` keywords; it is STREAM-04, deferred out of
  v2.0 and blocked on the export arriving. Unrelated to curation.

</deferred>

---

*Phase: 24-Local Curation Mode*
*Context gathered: 2026-08-27*
