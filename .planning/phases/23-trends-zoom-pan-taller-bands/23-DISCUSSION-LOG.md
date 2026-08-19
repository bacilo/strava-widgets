# Phase 23: Trends Zoom, Pan & Taller Bands - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-19
**Phase:** 23-trends-zoom-pan-taller-bands
**Areas discussed:** Zoom scope, Default window vs zoom-out, Wheel & touch behaviour, Band height & who inherits, On-screen control design, Zoom state lifecycle, Overlap with Training Load's window, Zoom limits & axes

**Area selection:** the user selected **all eight** offered gray areas across two
multi-select prompts. Nothing was left to Claude by omission at the area level.

---

## Zoom scope — which charts

| Option | Description | Selected |
|--------|-------------|----------|
| Time-axis tabs only | Volume, Cadence & HR, Training Load — the three `'linear'` x scales. YoY (12-slot category) and Gear (~16 shoes) excluded on structural grounds. Smallest blast radius. | ✓ |
| All five tabs | Uniform behaviour; user never has to learn which charts respond. Needs `limits` tuned per axis type; adds checkpoint rows for behaviour nobody asked for. | |
| Volume tab only | Narrowest reading of TRN-01. Leaves the requirement visibly half-done on two tabs with the same compression problem. | |

**User's choice:** Time-axis tabs only (recommended) → **D-01**
**Notes:** Combined with the per-instance plugin registration below, the exclusion becomes
structural rather than a configuration choice.

---

## Cadence & HR's two stacked bands

| Option | Description | Selected |
|--------|-------------|----------|
| Locked in sync | Zoom/pan either band, both move. Same date range always. One control cluster for the pair. | ✓ |
| Independent | Simpler to wire, no cross-chart callback. But the bands can drift out of alignment while still looking aligned. | |

**User's choice:** Locked in sync (recommended) → **D-02**
**Notes:** Drove D-10's "one cluster serves the pair" and D-20's equal-height decision.

---

## Overlap with Training Load's window control

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both; window sets the zoom | The 3mo/12mo/All control becomes zoom presets over the full series. One mechanism, two drivers. Changes what `sliceLoadWindow` is for; interacts with LTTB decimation. | ✓ |
| Keep both, independent | Window keeps slicing the dataset; zoom operates inside the slice. Least churn, but switching window silently discards zoom and two paths reach one picture with different state. | |
| Drop the window control | Zoom replaces it. Cleanest conceptually, but removes a shipped feature and 18-D16's readable 12mo default. | |

**User's choice:** Keep both; window sets the zoom (recommended) → **D-03**
**Notes:** The decimation consequence was surfaced during the question and is recorded in
D-03(b) as a checkpoint item, not left implicit.

---

## Detail view — does it get zoom too

| Option | Description | Selected |
|--------|-------------|----------|
| Trends only | Phase boundary is `#/trends`. A single run's bands have no compression problem. Extract shared wiring so a later phase is cheap. | ✓ |
| Both surfaces | Consistency across every chart. Doubles the checkpoint surface and pulls the crosshair plugin and x-axis toggle into the story. | |

**User's choice:** Trends only (recommended) → **D-04**

---

## Default window vs zoom-out

| Option | Description | Selected |
|--------|-------------|----------|
| Granularity-aware default window | Weekly ≈ 12mo, monthly ≈ 5y, yearly = all — as initial *zoom state* over the full dataset, not a slice. Satisfies TRN-01's stated outcome, not only its stated means. | ✓ |
| Full archive, user zooms in | The literal reading. Zero risk of a default window hiding data, but the screen that prompted the complaint looks identical until the zoom is discovered. | |
| Windowed, Volume tab only | Narrower change, but leaves three tabs with three opening conventions. | |

**User's choice:** Granularity-aware default window (recommended) → **D-06**
**Notes:** This is one of two decisions that deliberately exceed the requirement's literal
wording; flagged in CONTEXT.md `<specifics>` so a verifier does not score it as drift.

---

## Zoom axes and y-rescale

| Option | Description | Selected |
|--------|-------------|----------|
| X only | Every complaint is horizontal compression. Gives "reset" one meaning, maps cleanly onto two control behaviours. | ✓ |
| Both axes | More powerful, but doubles the control set and makes y-comparability a live question on every view. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Y rescales to visible data | What makes zoom feel like it did something. Cost: two pans are not directly y-comparable. | ✓ |
| Keep the global y scale | Every view directly comparable, but zooming a quiet year leaves bars squashed at the bottom. | |

**User's choice:** X only + y rescales (both recommended) → **D-07**

---

## Zoom limits

| Option | Description | Selected |
|--------|-------------|----------|
| Clamp pan to data, floor the zoom | Pan stops at first/last data point; zoom-in has a minimum span; zoom-out capped at full range (which also defines the Reset target and the `−` disabled state). | ✓ |
| Clamp pan only | Prevents getting lost off the end; lets zoom-in go arbitrarily deep. One less tuned constant. | |
| No limits | Plugin defaults. Panning into blank space is the first thing a checkpoint would catch. | |

**User's choice:** Clamp pan to data, floor the zoom (recommended) → **D-09**

---

## Wheel & touch behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Modifier + wheel zooms | ⌘/Ctrl + wheel; bare wheel scrolls the page. Reason specific to this page: macOS trackpad two-finger scroll IS a wheel event, and up to three charts stack here. | ✓ |
| Bare wheel zooms | Most discoverable, but makes the page hostile to scroll past — the most-reported plugin complaint, worsened by taller bands. | |
| No wheel zoom at all | Page scroll never touched, but leaves TRN-01's stated means unimplemented. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Drag pans | Natural on a zoomed chart; no click-to-navigate conflict on Trends charts. | ✓ |
| Controls only | Removes any drag/select ambiguity, but the obvious gesture doing nothing reads as broken. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Take Hammer.js — pinch and touch pan | TRN-01 names pinch; Phase 22 proved real phone widths matter here. Lands in the already-lazy chunk. Cost: Hammer.js is effectively unmaintained. | ✓ |
| Skip it — on-screen controls cover touch | No new dependency; the pointer-free buttons work under a finger. But pinch is what anyone will instinctively try. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent hint in the band header | Modifier-gated zoom is otherwise undiscoverable. Fits the existing header and the project's actionable-notice habit. | ✓ |
| Hint on scroll attempt | The Google Maps overlay. More elegant, but a new interaction primitive and invisible to keyboard users. | |
| No hint | Least surface, but ships a capability nobody will trigger. | |

**User's choice:** all four recommended → **D-14, D-15, D-16, D-17**
**Notes:** The Hammer.js maintenance risk was stated in the option text and accepted; it is
recorded in D-16 as a research item rather than treated as settled.

---

## Band height & who inherits

| Option | Description | Selected |
|--------|-------------|----------|
| Trends-only modifier class | Base rule and the detail view byte-unchanged. The detail view is not "a page with room to spare". | ✓ |
| Bump the shared rule | Simplest CSS, one value everywhere — but changes the detail view as a side effect of a Trends requirement. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Viewport-relative with clamps, ~`clamp(180px, 34vh, 420px)` | Grows where there is room, never collapses below a readable floor. Matters more once charts are zoomable. | ✓ |
| Fixed ~280px | Predictable, trivially testable, matches every other height in the file — but identical on a laptop and a 4K monitor. | |
| Aspect-ratio driven | Most "correct" for a chart, but interacts with `maintainAspectRatio: false` and the ResizeObserver path with zero precedent here. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same height for both stacked bands; tab scrolls | The pair is meant to be read against each other; a scrolling tab is normal here. | ✓ |
| Shorter when stacked | Both fit one screen, but reintroduces the squashed y-axis TRN-03 exists to fix. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep a phone floor, retuned | A phone must never get a band taller than it is wide. Breakpoint must be justified against real phone widths. | ✓ |
| Drop it, rely on the clamp | One fewer media query, but relies on the exact assumption that failed in Phase 22. | |

**User's choice:** all four recommended → **D-18, D-19, D-20, D-21**
**Notes:** Phase 22's `max-width: 380px` failure (defect lived at 390/393/412px) was cited
in the option text and is recorded in D-21 as a binding constraint on the breakpoint choice.

---

## On-screen control design

| Option | Description | Selected |
|--------|-------------|----------|
| In each `.chart-band__header` | Already a flex/space-between row; absorbs a cluster with no new layout CSS. Controls sit on the thing they act on. | ✓ |
| One control row per tab | All controls for a tab in one place, but far from the second band on Cadence & HR and crowds Training Load's existing two toggles. | |

| Option | Description | Selected |
|--------|-------------|----------|
| `← → − +` plus a Reset that appears only when zoomed | Reset's presence doubles as the only visible zoom-state signal. Buttons disable at their clamps. | ✓ |
| Same, Reset always present | No layout shift, easier to write a checkpoint row for — but a dead control most of the time. | |
| No Reset | Smallest set satisfying TRN-02 literally, but the designed opening window becomes unreachable. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Zoom ~1.5×, pan ~25% of the visible range | Proportional — same meaning at every zoom level and granularity; maps onto the plugin's own API. | ✓ |
| Pan one period per press | Semantically crisp, but ~2% of a 12-month window — fifty presses to reach last year. | |
| Fixed zoom-span ladder | Very predictable, but fights free wheel/pinch zoom and needs different rungs per granularity. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Update the canvas `aria-label` to name the visible range | Extends the existing `VOLUME_ARIA_LABELS` mechanism; no new ARIA machinery, no per-tick firing. | ✓ |
| A polite live region | Better feedback, but needs debouncing against wheel/drag and has no precedent here. | |
| Neither | TRN-02 satisfied only mechanically — the result of pressing is unobservable to anyone not looking. | |

**User's choice:** all four recommended → **D-10, D-11, D-12, D-13**
**Notes:** Making the `<canvas>` focusable for arrow-key panning was not put to the user as
an option — it is recorded in D-13 as an explicitly rejected alternative with its reason
(no visible focus indication, and T-18-A11Y-03's precedent), so a later reviewer does not
read its absence as an oversight.

---

## Zoom state lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Granularity change resets to that granularity's default window | Each granularity has its own designed density; that is what the toggle is for. | ✓ |
| Preserve the date range across the switch | Granularity as a pure detail-level control — but collides with D-06 and can land on Yearly showing one bar. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Preserved within the mount, reset on unmount | 18-UI-SPEC § 8's within-tab-state contract verbatim; no new pattern. Makes tab cycling a real state round-trip for the TRN-04 checkpoint. | ✓ |
| Reset on every tab switch | Simplest possible state, but losing zoom on a glance at another tab reads as unfinished. | |

| Option | Description | Selected |
|--------|-------------|----------|
| No persistence across reloads | A reload gives the designed opening picture. A persisted window is a silent data filter you forget you set. Follows 21-D04. | ✓ |
| Persist per tab in localStorage | Return to the range you were studying — but needs a key, a validating parse, and a stale-range policy for a preference not asked for. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Per-instance `plugins: [...]` array | Follows T-18-CANVAS-01 over the library's convention. Makes D-01's exclusions structural; keeps stateful plugin registration off the global path. | ✓ |
| Module-wide `Chart.register(...)` | One line, matches the plugin's docs — but needs an opt-OUT list on YoY and Gear that a future chart could silently forget. | |

**User's choice:** all four recommended → **D-23, D-22, D-24, D-05**

---

## Claude's Discretion

Recorded in CONTEXT.md `<decisions>` § Claude's Discretion. Summary:

- Exact default-window spans per granularity (D-06) and exact `limits` constants (D-09).
- Exact zoom factor and pan fraction (D-12).
- Exact `clamp()` values (D-19) and the small-screen breakpoint (D-21) — both required to
  be justified against a real browser / real phone widths, not asserted.
- Which band's header carries the shared cluster on Cadence & HR (D-10).
- Button glyphs, `aria-label` wording, and hint copy — including how the hint reads on a
  touch device with no modifier key (D-17).
- Whether `sliceLoadWindow` survives as a pure helper or is retired (D-03).
- Where the shared zoom wiring is extracted to, and how much of it is pure enough to
  unit-test without a DOM (D-04).
- Whether Reset is a fifth button in the cluster or a distinct affordance.

## Deferred Ideas

Full list in CONTEXT.md `<deferred>`. Raised during this discussion:

- Zoom on the activity detail view's chart bands (D-04 keeps it out; the extraction
  requirement makes a later phase cheap).
- Zoom on the Records page's seven PR-evolution small multiples.
- Category-axis range selection for Year-over-Year and Gear — a different interaction, not
  the same feature.
- Persisting zoom across reloads (D-24 declines; revisit if a second persisted view
  preference appears alongside Phase 22's week start).
- Replacing or removing Hammer.js if a maintained alternative or a pointer-events touch
  path appears.
- Carried forward from Phase 22's deferred list: making weekly aggregates honour the
  Calendar week-start preference. 22's list noted it "would need to be reconciled with
  Phase 23's Trends work" — **it is not reconciled here.** 22-D15 stands unchanged.

### Reviewed Todos (not folded)
- **Exclusion tickbox via local curation mode** (score 0.6) — Phase 24's stated goal;
  matched on generic keywords and the `dashboard` area tag only.
- **Garmin export adapter when export arrives** (score 0.5) — deferred STREAM-04, blocked
  on the export arriving; unrelated to Trends.

## Process notes

- No SPEC.md exists for this phase, so requirements were not pre-locked; the discussion
  covered both the shape of the requirements and their implementation.
- No `.continue-here.md` and therefore no blocking anti-patterns to discharge.
- Advisor mode not active (no USER-PROFILE.md).
- The user accepted the recommended option on **all 24 decisions**. Several of those
  recommendations deliberately chose the smaller blast radius (D-01, D-04, D-07, D-18,
  D-24) — recorded in CONTEXT.md `<specifics>` so downstream agents read them as considered
  boundaries rather than as work left undone.
