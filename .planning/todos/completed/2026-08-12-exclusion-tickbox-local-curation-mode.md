---
created: 2026-08-12T11:20:00.000Z
title: Exclusion tickbox via local curation mode
area: dashboard
approach: B (local curation mode) — chosen by the user 2026-08-12
files:
  - src/dashboard/views/detail.ts
  - src/dashboard/views/detail-sections.ts
  - src/analytics/best-effort-exclusions.ts
  - data/best-effort-exclusions.json
  - package.json
---

## Problem

Excluding an activity from PR calculations works (Phase 16, plan 16-01) but requires hand-editing `data/best-effort-exclusions.json`: find the activity ID, write the JSON entry, re-run `compute-all-stats`, push. The user wants a tickbox on the activity — "perhaps in the line of the PRs" — so no file editing is involved.

The user's requirement, verbatim in intent: manually (not automatically) select runs to exclude from PR calculations, while totals (distance, time, shoes) stay unaffected because the impact there is minimal. The typical case is a run where a brief bad GPS measurement produces an unrealistic short-distance split.

## Constraint that shapes the design

The dashboard is a **static site on GitHub Pages with no server**. A browser cannot write `data/best-effort-exclusions.json` back to the repo.

Compounding this: `wasPRAtTheTime` is decided by a **chronological walk at build time** (`compute-best-efforts.ts:259`), and `best-efforts.json` ships pre-computed `rankings`. A browser can filter a ranking list instantly, but recomputing the historical "was this a PR when you ran it" flag client-side means reimplementing build-time logic — creating two authorities for what counts as a PR, which can silently disagree.

## Options considered (2026-08-12)

- **A — Tickbox + copy/paste or download JSON.** Works on the live public site; localStorage greys the effort out immediately and the page emits the exact JSON entry or a full regenerated file to download. Still involves a file step.
- **B — Local curation mode. ← CHOSEN.** `npm run curate` serves the dashboard locally with a local-only write endpoint. The tickbox genuinely writes the exclusions file and can trigger the recompute. A real tickbox, no copy/paste, and the build remains the single source of truth for PRs. Only active locally; the public site gains no write path.
- **C — Client-side re-ranking.** Instant promotion of the next-best effort with no rebuild. Rejected: duplicates the chronological PR logic in the browser, so the live site can disagree with the build about the user's PRs, and that drift is invisible until it misleads.

## Solution sketch (approach B)

1. `npm run curate` — a small local-only server (Node, no new deps if possible) that serves `dist/widgets/` and exposes a write endpoint bound to localhost only. Must be impossible to enable in the published bundle.
2. Detail view gains an "exclude from records" control, near the PR badges / Best Efforts This Run panel. Per-distance checkboxes matter as much as whole-run: a GPS spike usually corrupts only `400m`/`1k` while the same run's `5k`/`10k` are honest and should stay in contention. `isExcluded` already supports this via a `Set` of `TARGET_ORDER` keys, with `'all'` for the null case.
3. Ticking writes/updates the `{activityId, distances, reason}` entry. A reason field is required — the detail view already surfaces it via `buildExclusionReasonIndex`, and an unexplained exclusion is how a curated archive quietly becomes untrustworthy.
4. Offer to run the recompute (`compute-best-efforts` → `compute-dashboard-index`; ordering matters) so the promotion of the next-best effort is visible immediately.
5. The control must be inert/absent in the published site — verified by an assertion in `scripts/verify-dashboard-publish.mjs`, following the `assertNoPrivateArtifacts` precedent.

## Notes

- Scope: new feature with a write path and UI — a phase, not a bolt-on. v2.0 is shipped, tagged and archived; this belongs in the next milestone.
- `data/best-effort-exclusions.json` was added to the CI workflow's push `paths` filter on 2026-08-12, so hand-edits (and anything this feature writes) now trigger a rebuild and deploy.
- Prior art to follow: `data/private/` (gitignored, guarded, never published) for how this repo keeps a local-only concern out of the public artifact.

## Closed 2026-09-01

This todo is Phase 24 (Local Curation Mode). CUR-01 ticked Complete in `REQUIREMENTS.md` after
plan 24-10's Round 2 browser checkpoint (`24-VALIDATION.md`, R15-R23 all 9 rows PASS, GAP-24-01
closed): the `Excluded — {reason}` badge now renders correctly at Save, before any Recompute
(ROW R15, forward direction), and clears correctly at untick, before any Recompute (ROW R19,
mirror direction, closed on a human-hand row).

**Approach B (local curation mode) is what shipped**: `npm run curate` serves the built
`dist/widgets` under `/strava-widgets` on `127.0.0.1:4173` with a localhost-only write path
(Origin/Host gated, D-12), a real tickbox with a required reason (D-08), and instant local
persistence to `data/best-effort-exclusions.json` with an optional streamed Recompute (D-07).
The write path is provably absent from the published bundle — a build-time guard
(`assertNoCurationArtifacts`, D-10/D-11) and a publish-time HTTP guard both fail against a
planted `__curate` artifact and pass clean, and Round 1's R12/R14 plus Round 2's R21/R22/R23
confirmed this against a real static server and real cross-origin requests.

Options **A** (copy/paste or download JSON) and **C** (client-side re-ranking) remain rejected as
recorded in this todo's "Options considered" section. Option C in particular was rejected because
recomputing the historical "was this a PR when you ran it" flag in the browser would create two
authorities for what counts as a PR — the build-time `compute-best-efforts.ts` chronological walk
and a client-side approximation of it — which could silently disagree; approach B keeps the build
the single source of truth and merely toggles which activities feed it.

This todo's solution-sketch step 2 ("Per-distance checkboxes matter as much as whole-run") was
**superseded by D-04** (`24-CONTEXT.md`, 2026-08-27): exclusion shipped as whole-activity, not
per-distance, because `compute-best-efforts.ts:215-219` drops an excluded effort from
`byDistance` entirely, so there is never a same-activity runner-up a coarser exclusion could
wrongly suppress. Per-distance selectability is recorded as a Deferred Idea in `24-CONTEXT.md`
and remains supported by `buildExclusionIndex` on read (D-05), so a future phase could surface it
without a schema migration.
