# Deferred Items — Phase 17

Logged by the 17-15 plan executor per the Scope Boundary rule (out-of-scope discoveries are
logged, not fixed, during a task whose file scope does not include them).

## 1. Uncommitted working-tree changes discovered during 17-15 Task 3 (2026-08-11)

While completing 17-15 Task 3 (recording the Task 2 browser-checkpoint result in
`17-VALIDATION.md`), the working tree was found to already contain **uncommitted** changes to:

- `src/dashboard/views/detail-charts.ts` — adds a `Y_AXIS_WIDTH_PX = 72` constant and an
  `afterFit` callback pinning every chart band's y-axis gutter to the same width.
- `src/dashboard/views/detail-map.ts` — adds a `tileerror` listener on the basemap layer that
  appends a one-time `.route-map__caveat` notice when tiles fail to load.

These read as in-progress fixes for exactly the two gaps named in this plan's checkpoint result
(GAP 1 — basemap tiles not rendering; GAP 2 — chart band x-axis misalignment). The executor did
not write them, cannot confirm their provenance or whether they resolve the gaps correctly, and
17-15-PLAN.md Task 3 explicitly forbids patching a failed checkpoint group in place ("do NOT patch
it here... under checkpoint pressure" — the 16-09 precedent). Per that instruction and the
Scope Boundary rule (17-15 Task 3's `<files>` is `17-VALIDATION.md` only), these changes were left
**uncommitted and untouched** — not staged, not reverted. They should be picked up explicitly by
whatever gap-closure plan follows (`/gsd-plan-phase 17 --gaps`), which can verify them against the
two named gaps rather than trust that they are complete or correct.

## 2. Stale tracked build artifact: `dist/widgets/test.html`

Running `npm run build-widgets` (17-15 Task 1's required verify command) no longer regenerates
`dist/widgets/test.html`, which shows as a working-tree deletion (`git status`) because the file
was committed to git before `dist/*` / `dist/widgets/*` were added to `.gitignore` (original commit
`de603b0`, Phase 12). This is a pre-existing repo-hygiene issue (a stale tracked file inside an
otherwise-gitignored build output directory), not something caused by this plan's work. Left
uncommitted — a future cleanup pass (or the next full rebuild + commit) should `git rm` it once
confirmed unused, rather than doing so incidentally inside an unrelated plan's commit.
