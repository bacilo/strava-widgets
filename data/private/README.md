# data/private/

This directory holds hand-maintained identity and health inputs — currently
just `athlete-private.json` (`birthDate`, `sex`, `restingHr`) — that feed
Phase 18's age-grading and TRIMP training-load computations.

**This repo is public.** Everything in this directory except the committed
example template is gitignored (`data/private/*.json`, with an explicit
negation for `athlete-private.example.json`). Nothing here is ever copied
into `dist/widgets/`; `scripts/build-widgets.mjs`'s `assertNoPrivateArtifacts`
guard fails the build if it ever finds these fields under the publish
directory.

## Setup

1. Copy the template: `cp data/private/athlete-private.example.json data/private/athlete-private.json`
2. Fill in real values for `birthDate` (`YYYY-MM-DD`), `sex` (`"male"` or
   `"female"`), and optionally `restingHr` (a resting bpm in `20..120`,
   omit or leave `null`/`0` if unknown).
3. Rebuild. Age-grading and the resting-HR-dependent parts of training load
   pick the file up automatically at build time.

## The phase passes with this file absent

`data/private/athlete-private.json` is read only by build-time compute
steps (never the browser, never `dist/widgets/`). If it is missing or fails
validation, the features that depend on it degrade to an actionable notice
rather than failing the build or fabricating a value — CI and local builds
both pass with it unfilled.
