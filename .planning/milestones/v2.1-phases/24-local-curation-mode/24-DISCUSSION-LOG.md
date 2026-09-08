# Phase 24: Local Curation Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 24-Local Curation Mode
**Areas discussed:** Where the tickbox lives, Reason & per-distance shape, Recompute & git after a write, What `npm run curate` serves

---

## Where the tickbox lives

### Q1 — Where does the per-distance exclusion control actually render?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate curate screen | Purpose-built curation UI in its own entry (`src/curate/`), built and served only by `npm run curate`, never an input to `vite.config.pages.ts`. Absence structural. Cost: a second browse surface to design. | |
| Overlay on the real dashboard | `npm run curate` serves the real built `dist/widgets` and injects `<script src="/__curate/overlay.js">` into index.html in-flight. Curate in the exact detail view you read; absence still structural. Cost: must hook into asynchronously-rendered DOM. | ✓ |
| In-bundle, runtime-gated | Control ships in the published bundle, renders only after a `GET /__curate/health` probe succeeds. Simplest. Cost: curate UI code IS published — weakest form of "provably absent". | |

**User's choice:** Overlay on the real dashboard
**Notes:** Honours the original todo's "perhaps in the line of the PRs" instinct while keeping the overlay bundle out of the publish pipeline entirely. → CONTEXT D-01.

### Q2 — How does the overlay find and attach to the async-rendered Best Efforts panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Inert hooks in production | `data-distance` on each `<tr>`, `data-activity-id` on the section, one `dashboard:best-efforts-mounted` CustomEvent after the async mount resolves. No write path; explicit, unit-testable seam. | ✓ (Claude) |
| MutationObserver, zero prod change | Overlay watches the detail container and matches rows by visible label text. `dist/widgets` byte-identical. Cost: couples to display strings and column order. | |
| Overlay re-renders the panel | Overlay imports `buildBestEffortsSection` and replaces the panel with a curate-flavoured version. Cost: two renderers for one panel (the Phase 21 D-05 drift seam). | |

**User's choice:** "you decide" — Claude's discretion
**Notes:** Claude took the inert-hooks option. The user first declined the question to clarify semantics (see the next area), and that clarification later removed the need for per-row `data-distance` — the section-level anchor plus the mount event suffices. → CONTEXT D-03.

### Q3 — How hard should the criterion-3 absence proof be?

| Option | Description | Selected |
|--------|-------------|----------|
| Both layers, like the PII guard | `assertNoPrivateArtifacts` is two layers today: a build-time hard-fail in `build-widgets.mjs` plus HTTP `expect404`s in the verifier. Curation gets both, plus a regression test that plants an artifact and asserts the guard fails. | ✓ (Claude) |
| Verifier only | Just the HTTP assertions plus a regression test. Simpler; failure surfaces at verify time rather than build time. | |
| You decide | — | |

**User's choice:** "You decide" — Claude's discretion
**Notes:** Claude took both layers, since the roadmap names `assertNoPrivateArtifacts` as the precedent and that precedent is itself two-layered. → CONTEXT D-10, D-11.

---

## Reason & per-distance shape

### Q1 — One reason per exclusion entry, or one per activity?

| Option | Description | Selected |
|--------|-------------|----------|
| One reason per exclusion entry | Make the reason index `Map<"activityId\|distance", reason>` so each excluded row shows its own reason. Truthful for a run with two unrelated problems. Cost: `buildExclusionReasonIndex`, `buildPrFlagsCell` and `buildPrTableRows` all change signature. | |
| One reason per activity | Keep today's `Map<activityId, reason>`. Curate writes one entry per activity, editing its `distances` array. Smallest change; `records-logic.ts`, `detail-sections.ts` and `records.ts` untouched. | ✓ |
| You decide | — | |

**User's choice:** One reason per activity
**Notes:** → CONTEXT D-06.

### Q2 — Whole-run collapse and the empty-entry trap

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit array always; delete when empty | Curate never writes `null`; unticking the last distance deletes the entry so `distances: []` can never exist. `null` stays supported on read. | |
| Collapse to null when all ticked | Ticking every visible distance writes `distances: null`. Terse, matches existing entries. Cost: `null` means every `TARGET_ORDER` distance, including ones the run never produced. | |
| You decide | — | |

**User's choice:** *No option selected — the user stopped to clarify semantics.*

**User's own words:**
> "just a quick note to be clear we are on the same page. When there is an exclusion from PRs it's for the whole activity. If an activity is excluded we should no longer use it to calucalte PRs of any kind. It only counts towards aggregates like distance/time ran, etc... but not for PRs. So if we exclude a 400 PR from an activity, there shouldn't be a second 400 m PR from the same activity emerging."

**Notes:** This conflicted with the locked requirement, so the conflict was surfaced rather than silently resolved. Two facts were established from the source before re-asking:
1. A second same-activity effort at one distance cannot emerge — `computeActivityEfforts` yields exactly one effort per target distance per run, and `compute-best-efforts.ts:215-219` drops it from `byDistance` entirely when excluded. The promoted next-best is always a different run.
2. Aggregates are already unaffected — `loadExclusions` is imported only by `compute-best-efforts.ts:31`; weekly distance, monthly/yearly stats, training load and gear never read the exclusions file.

Also surfaced: `compute-best-efforts.ts:239` already sets the activity-level `excludedFromRecords: exclusions.has(id)`, so a partially-excluded run already showed the blanket badge at `list.ts:266`.

### Q3 — Whole-activity vs per-distance (re-asked as a scope decision)

| Option | Description | Selected |
|--------|-------------|----------|
| Whole-activity only — amend CUR-01 | Exclusion means the run contributes no PRs at any distance. One tick per activity, writes `distances: null`. Requires editing CUR-01 in REQUIREMENTS.md and roadmap criterion 1 to drop the per-distance clause. | ✓ |
| Whole-run first, per-distance available | Honours CUR-01 as written: a prominent "exclude this run" tick plus a collapsed "only some distances" reveal for the GPS-spike case. | |
| Per-distance rows, with select-all | The roadmap's plain reading — a tick per distance row plus a select-all. Closest to the original todo. | |

**User's choice:** Whole-activity only — amend CUR-01
**Notes:** A deliberate, developer-made scope reduction with a requirements edit attached. The residual cost — an honest 10k on a spiked run also leaves contention — was visible in the option's own preview when chosen. → CONTEXT D-04, D-05.

### Q4 — How does the required-reason commit work?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-step: tick reveals field, Save commits | Ticking reveals a reason textarea and Save; nothing written until Save with non-empty text. Already-excluded runs load ticked and editable; unticking deletes behind a confirm. | ✓ |
| Tick disabled until reason typed | Reason field always visible; checkbox disabled until text is typed, then ticking writes immediately. Cost: the disabled-control pattern Phase 19's CR-03 flagged; editing needs a second affordance. | |
| You decide | — | |

**User's choice:** Two-step: tick reveals field, Save commits
**Notes:** → CONTEXT D-08.

---

## Recompute & git after a write

### Q1 — What happens after Save writes the exclusions file?

Context given: curate serves `dist/widgets` but writes `data/best-effort-exclusions.json` at the repo root — two different files joined only by `build-widgets.mjs:163`'s copy step.

| Option | Description | Selected |
|--------|-------------|----------|
| Instant copy, recompute on demand | Save mirrors the file into `dist/widgets/data/` and re-renders (badge appears at once); a separate "Recompute records" button runs the full chain with streamed progress, re-copies stats, reloads. | ✓ |
| Full chain on every Save | Every Save runs the whole chain to completion. Always consistent. Cost: `compute-best-efforts` walks all 1,868 activities per tick. | |
| Write only, recompute is yours | Curate writes the file and nothing else. Smallest server. Cost: criterion 2 can't be shown in the same session without a manual rebuild. | |

**User's choice:** Instant copy, recompute on demand
**Notes:** → CONTEXT D-07.

### Q2 — Does curate touch git?

| Option | Description | Selected |
|--------|-------------|----------|
| Never touches git | Working-tree writes only; the developer reviews `git diff`, commits and pushes. No credentials, no accidental deploy via the nightly push-paths filter. | ✓ (Claude) |
| Offers a commit, never pushes | A "Commit changes" button stages and commits with a generated message; never pushes. Cost: curate gains git write access; generated messages are worse. | |
| You decide | — | |

**User's choice:** "You decide" — Claude's discretion
**Notes:** Claude took "never touches git". → CONTEXT D-09.

---

## What `npm run curate` serves

### Q1 — Mount under `/strava-widgets` or at the root?

| Option | Description | Selected |
|--------|-------------|----------|
| Under /strava-widgets | Matches `verify-dashboard-publish.mjs`'s deliberate prefix mount — GitHub Pages serves this repo as a project page, and root-mounted serving is what let the absolute-asset bug ship green at 15/15. | ✓ |
| At the root | Simpler URLs. Cost: diverges from production and the verifier, so a path bug stays invisible locally. | |

**User's choice:** Under /strava-widgets
**Notes:** → CONTEXT D-02.

### Q2 — How much hardening on the local write endpoint?

| Option | Description | Selected |
|--------|-------------|----------|
| Bind + Origin check | Bind explicitly to `127.0.0.1` (never `0.0.0.0`) and reject writes whose `Origin`/`Host` isn't the curate origin. Closes drive-by CSRF from another tab and DNS rebinding. | ✓ |
| Bind only | Just `127.0.0.1` binding — the literal reading of "localhost-only". Cost: another tab in your own browser can still POST to it. | |
| Bind + Origin + session token | Adds a random startup token required on every write. Strongest, but the overlay is same-origin so it largely duplicates the Origin check. | |

**User's choice:** Bind + Origin check
**Notes:** → CONTEXT D-12.

---

## Claude's Discretion

Delegated by the user, resolved in CONTEXT.md:

- **The overlay's attach seam** (Q2, area 1) → `data-activity-id` on the section plus a `dashboard:best-efforts-mounted` event. CONTEXT D-03.
- **The absence-proof enforcement shape** (Q3, area 1) → both layers, mirroring `assertNoPrivateArtifacts`. CONTEXT D-10, D-11.
- **Git involvement** (Q2, area 3) → none. CONTEXT D-09.

Offered at the wrap-up and accepted as Claude's discretion without further discussion:

- Missing-build behaviour for `npm run curate` → fail fast with instructions, per `verify-dashboard-publish.mjs`'s FATAL block.
- Overlay bundling → esbuild (already a devDependency); the server stays Node-built-ins-only.
- The Activities-list "Excluded from records" badge → no change needed; whole-activity semantics make `list.ts:266` correct by construction.
- Port choice for the curate server.

## Deferred Ideas

- **Per-distance exclusion selectability** — the capability CUR-01 originally required, removed by the whole-activity decision. The data model and `buildExclusionIndex` still support it on read, so a future phase could surface it without a migration.
- **Curation from the Records screen's PR tables** — the other surface where an untrustworthy PR is visible. Out of scope: the detail view is where the evidence lives.
- **A curate view listing all current exclusions** — useful for auditing or bulk-undo, but a second surface beyond CUR-01. The file holds two entries today.
