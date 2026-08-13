---
phase: 19-design-system-control-styling
plan: 13
gap: 7
status: diagnosis-in-progress
---

# GAP 7 Diagnosis — sticky top nav does not remain on screen while scrolling

## Fact under diagnosis

Round 3's checkpoint (`19-VALIDATION.md`, row 18) recorded the developer's own words, verbatim:
"If i scroll down the navbar disappears upwards."

The same Round 3 session ran an ad-hoc probe (Probe D) on Activities before row 18 was
judged, which returned, verbatim:

```
{parent: "HEADER#app-nav-root", navH: 77, parentH: 77, navPos: "sticky", parentPos: "static"}
```

`navH: 77` and `parentH: 77` — the nav's own rendered height and its parent's rendered
height are exactly equal.

No root cause has been established. Reading `styles.css` and `nav.ts` can enumerate what
*might* explain that equality, but this phase has now recorded a fourth false-green
mechanism (`19-12-SUMMARY.md`, "Lessons — running count updated"): CR-01, the sticky-layer
`z-index: 20` fix, was diagnosed and shipped entirely from reading `styles.css` and was
never checked against the rendered page — and when an unrelated probe (Probe D) finally
did look at the rendered page, it exposed that the very state CR-01's fix targets (a nav
that stays on screen and can be painted over) may never occur in the first place, because
the nav does not stay on screen at all. Source reading alone will not establish why; only
a probe run against the rendered, production-shaped build can.

## Candidate root causes

- **H1 — zero-travel containing block.** A sticky element is constrained to its own
  containing block, which is the content box of `#app-nav-root`. If that box is exactly
  as tall as the nav, the sticky element has zero travel distance and leaves the viewport
  with its parent. Confirmed by E1 `#app-nav-root` chain entry's `ch` (clientHeight) equal
  to `.app-nav` chain entry's `oh` (offsetHeight), together with E2 showing `after.navTop`
  equal to `after.parTop` and both approximately minus `after.sy`.
- **H2 — an ancestor establishes a clip or scroll container.** Any ancestor between
  `.app-nav` and the document root whose computed `overflow-x` (`oX`) or `overflow-y`
  (`oY`) is anything other than `visible` becomes the sticky element's scrollport.
  Confirmed by E1 reporting a non-`visible` `oX` or `oY` on any chain entry above
  `.app-nav`.
- **H3 — the page's scroll container is not the document.** If a wrapper element scrolls
  rather than the viewport, `window.scrollY` never changes and the nav never enters its
  stuck state. Confirmed by E2 `after.sy` remaining at or near 0 while the content
  visibly moved, or by E1 `scrollingIsDoc` reporting `false`.
- **H4 — an ancestor caps the travel by height or display.** An explicit non-`auto`
  `height` (`h`) on `#app-nav-root`, `body` or `html`, or a `display` (`disp`) value that
  removes or reshapes a box in the chain (`contents`, `flex`, `grid`), can reduce the
  sticky range independently of H1. Confirmed by E1 `h` or `disp` on a chain entry above
  `.app-nav`.
- **H5 — the element is not sticky at the tested viewport width.** Confirmed by E1
  reporting `pos` other than `sticky` on the `.app-nav` chain entry at the recorded `w`.

## Discrimination matrix

| Hypothesis | Confirming signature | Excluding signature |
| --- | --- | --- |
| H1 — zero-travel containing block | `#app-nav-root` entry `ch` equal to `.app-nav` entry `oh`; every other chain entry's `oX` and `oY` equal `visible`; E2 `after.navTop` equal to `after.parTop`, both approximately equal to `0 - after.sy` | `#app-nav-root` entry `ch` not equal to `.app-nav` entry `oh` |
| H2 — ancestor clip/scroll container | any chain entry above `.app-nav` (excluding `.app-nav` itself) has `oX` or `oY` not equal to `visible` | every chain entry's `oX` and `oY` equal `visible` |
| H3 — scroll container is not the document | E2 `after.sy` stays below 400 on a route confirmed tall enough to scroll, or E1 `scrollingIsDoc` equals `false` | E2 `after.sy` reaches at least 400 and E1 `scrollingIsDoc` equals `true` |
| H4 — ancestor caps travel by height/display | a chain entry above `.app-nav` has `h` that is not `auto` (a resolved pixel value), or `disp` equal to `contents` and `flex` and `grid` (any one of that set) | no chain entry above `.app-nav` has a non-`auto` `h`, and no chain entry's `disp` is in that set |
| H5 — not sticky at tested width | `.app-nav` chain entry's `pos` is not equal to `sticky`, recorded together with `w` | `.app-nav` chain entry's `pos` equals `sticky` at the recorded `w` |

**H1 versus H4 — the explicit split.** H1 is specifically the case where
`#app-nav-root`'s `ch` equals `.app-nav`'s `oh` and every chain overflow is `visible` — the
containing block is tight around the nav with nothing else in play. H4 is any travel cap
that originates above `#app-nav-root` itself (`body` or `html` carrying a fixed height, or
a `display` value reshaping a box higher up the chain) — a different box than the nav's
immediate containing block is the one doing the capping. The two are mutually exclusive
readings of the same symptom and the matrix above cites the specific field-and-entry pair
each one needs.

## Probe E1 — structural chain

Route: `http://localhost:8099/strava-widgets/#/list`

Paste this single expression into the console and press Enter, then copy the entire
printed value back verbatim, including every brace and quote:

```js
JSON.stringify((function () {
  var chain = [];
  var el = document.querySelector('.app-nav');
  while (el) {
    var cs = getComputedStyle(el);
    var cls = el.className && typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().replace(/\s+/g, '.')
      : '';
    chain.push({
      el: el.tagName + (el.id ? '#' + el.id : '') + cls,
      pos: cs.position,
      top: cs.top,
      oX: cs.overflowX,
      oY: cs.overflowY,
      disp: cs.display,
      h: cs.height,
      transform: cs.transform,
      filter: cs.filter,
      willChange: cs.willChange,
      contain: cs.contain,
      ch: el.clientHeight,
      sh: el.scrollHeight,
      oh: el.offsetHeight
    });
    el = el.parentElement;
  }
  return {
    w: window.innerWidth,
    scrollingIsDoc: document.scrollingElement === document.documentElement,
    docSH: document.documentElement.scrollHeight,
    docCH: document.documentElement.clientHeight,
    chain: chain
  };
})())
```

This walks from `.app-nav` up through every `parentElement` to `html`, recording for each
chain entry: the element as tag plus id plus class list (`el`), computed `position`
(`pos`), `top`, `overflow-x` (`oX`), `overflow-y` (`oY`), `display` (`disp`), `height`
(`h`), `transform`, `filter`, `will-change` (`willChange`), `contain`, plus
`clientHeight` (`ch`), `scrollHeight` (`sh`) and `offsetHeight` (`oh`). It also records
`innerWidth` (`w`), whether `document.scrollingElement` is `document.documentElement`
(`scrollingIsDoc`), and the document element's `scrollHeight` (`docSH`) and `clientHeight`
(`docCH`). The whole thing is a single `JSON.stringify` call so the console prints one
line.

E1 runs on `#/list` only.

## Probe E2 — scroll behaviour

Routes: `http://localhost:8099/strava-widgets/#/list` and, separately,
`http://localhost:8099/strava-widgets/#/records`.

Paste this single expression, press Enter, and wait roughly half a second for its own
`console.log` line to appear — copy that printed line back verbatim. The theme in use is
irrelevant to this probe; it measures geometry, not appearance.

```js
(async () => {
  const nav = document.querySelector('.app-nav');
  const par = nav.parentElement;
  const before = {
    sy: window.scrollY,
    navTop: nav.getBoundingClientRect().top,
    parTop: par.getBoundingClientRect().top
  };
  window.scrollTo(0, 600);
  await new Promise(function (r) { setTimeout(r, 400); });
  const after = {
    sy: document.scrollingElement.scrollTop,
    navTop: nav.getBoundingClientRect().top,
    parTop: par.getBoundingClientRect().top
  };
  console.log(JSON.stringify({ route: location.hash, before: before, after: after }));
})();
```

This records `scrollY`, `.app-nav`'s `getBoundingClientRect().top` and its
`parentElement`'s `getBoundingClientRect().top` before a programmatic `scrollTo(0, 600)`,
then re-reads all three (using `document.scrollingElement.scrollTop` in place of
`window.scrollY` for the after-reading) after a settle delay of roughly 400ms, and prints
both snapshots as one `JSON.stringify` line via its own `console.log` call — a single
paste handles both the before and after capture, with no second paste required. If your
console shows a `Promise {<pending>}` line above the printed JSON, ignore it; the JSON
line from `console.log` is the result to copy.

**Invalidation rule, in writing:** if `after.sy` is below 400, the route was too short to
scroll and the run proves nothing. It must be re-run on a taller route (or after
confirming more content exists below the fold) and logged as a failed capture, exactly as
Probe C's first attempt was logged in Round 3 rather than counted as evidence.

E2 runs on `#/list` and again on `#/records` — two separate recorded outputs, because GAP
7 was reported on Activities and row 18 covered both routes.

## Probe outputs (verbatim)

Session run in Chrome against the staged production-shaped build at
`http://localhost:8099/strava-widgets/` (URL confirmed to contain `/strava-widgets/`; server
still running, HTTP 200). Theme is irrelevant to this probe — it measures geometry, not
appearance — and neither run is a failed capture: both Probe E2 runs return `after.sy: 600`,
clearing the invalidation rule's 400 floor.

**Probe E1 — route `#/list`:**

```
{"w":1920,"scrollingIsDoc":true,"docSH":2472,"docCH":617,"chain":[{"el":"NAV.app-nav","pos":"sticky","top":"0px","oX":"visible","oY":"visible","disp":"flex","h":"44px","transform":"none","filter":"none","willChange":"auto","contain":"none","ch":76,"sh":76,"oh":77},{"el":"HEADER#app-nav-root","pos":"static","top":"auto","oX":"visible","oY":"visible","disp":"block","h":"77px","transform":"none","filter":"none","willChange":"auto","contain":"none","ch":77,"sh":77,"oh":77},{"el":"BODY","pos":"static","top":"auto","oX":"visible","oY":"visible","disp":"block","h":"2472.390625px","transform":"none","filter":"none","willChange":"auto","contain":"none","ch":2472,"sh":2472,"oh":2472},{"el":"HTML","pos":"static","top":"auto","oX":"visible","oY":"visible","disp":"block","h":"2472.390625px","transform":"none","filter":"none","willChange":"auto","contain":"none","ch":617,"sh":2472,"oh":2472}]}
```

**Probe E2 — route `#/list`:**

```
{"route":"#/list","before":{"sy":0,"navTop":0,"parTop":0},"after":{"sy":600,"navTop":-600,"parTop":-600}}
```

**Probe E2 — route `#/records`:**

```
{"route":"#/records","before":{"sy":0,"navTop":0,"parTop":0},"after":{"sy":600,"navTop":-600,"parTop":-600}}
```

## Confirmed Root Cause

Applying the Task 1 matrix mechanically to the Task 2 outputs, field by field:

- **H1 — CONFIRMED by: `#app-nav-root` entry `ch` = 77 equal to `.app-nav` entry `oh` = 77**,
  with every chain entry's `oX` and `oY` = `visible` (NAV, HEADER, BODY and HTML all report
  `"oX":"visible","oY":"visible"`), and E2 corroborating on both routes: `after.navTop` = -600
  equal to `after.parTop` = -600, both equal to `0 - after.sy` (`0 - 600 = -600`). The nav's
  own containing block (`#app-nav-root`, `clientHeight` 77) is exactly as tall as the nav's own
  `offsetHeight` (77) — zero travel distance — so the sticky element leaves the viewport in
  lock-step with its parent, which is exactly what both E2 runs show.
- **H2 — excluded by: `oX` = `visible`, `oY` = `visible` on every chain entry above `.app-nav`**
  (HEADER `"oX":"visible","oY":"visible"`; BODY `"oX":"visible","oY":"visible"`; HTML
  `"oX":"visible","oY":"visible"`). No ancestor establishes a clip or scroll container.
- **H3 — excluded by: `after.sy` = 600 (>= 400) on both routes and `scrollingIsDoc` = `true`**
  in E1. The document itself is the scroll container; `window`/`document.scrollingElement`
  reports real scroll movement on both `#/list` and `#/records`.
- **H4 — excluded by: `disp` = `"block"` on every chain entry above `.app-nav`** (HEADER, BODY
  and HTML all report `"disp":"block"`; none is `contents`, `flex` or `grid`), **and by HEADER
  `h` (77px) = HEADER `sh`/`oh` (77), BODY `h` (2472.390625px) ≈ BODY `sh`/`oh` (2472), and
  HTML `h` (2472.390625px) ≈ HTML `sh`/`oh` (2472)** — every ancestor's rendered height equals
  its own content-derived scroll/offset height rather than a smaller, externally-imposed value.
  Nothing above `#app-nav-root` is capping travel independently of H1.
- **H5 — excluded by: `pos` = `"sticky"` on the `.app-nav` chain entry at `w` = 1920.**
  The element is sticky at the tested viewport width; non-stickiness is not in play.

**Matrix wording defect, recorded honestly rather than papered over.** The Task 1 matrix's H4
excluding signature as literally written — "no chain entry above `.app-nav` has a non-`auto`
`h`" — is not satisfiable from E1's data by construction: `getComputedStyle().height` always
resolves to a used pixel value (e.g. `"77px"`, `"2472.390625px"`) and never returns the literal
string `auto`, regardless of whether the underlying CSS `height` property is `auto` or a fixed
length. Every chain entry in this probe carries a non-`auto`, pixel-valued `h`, so the literal
excluding signature as drafted would exclude H4 for every conceivable input and is not a real
discriminator. H4 is excluded here instead via the plan's explicit H1-versus-H4 split paragraph:
the question that actually separates the two hypotheses is not "is `h` the literal string
`auto`" but "does an ancestor's rendered height equal its own content size (`sh`/`oh`), or is it
smaller than its content — an imposed cap." HEADER's `h` (77px) equals its own `sh` (77) and
`oh` (77); BODY's `h` (2472.390625px) equals its own `sh` (2472) and `oh` (2472); HTML's `h`
(2472.390625px) equals its own `sh` (2472) and `oh` (2472) (HTML's smaller `ch` of 617 is the
*viewport* clientHeight — the scrolling element's visible window — not a CSS-imposed height cap,
and is expected on any page taller than the viewport). None of the three ancestors is shorter
than its own content, so none is imposing a cap distinct from H1's own zero-travel finding. This
wording defect should be corrected in any future round of this matrix — replace "non-`auto` `h`"
with "an ancestor `h` value smaller than that same entry's `sh`" so the excluding signature is
mechanically checkable against real `getComputedStyle` output instead of an unreachable literal.

**`records.ts`'s `updateJumpOffset` implication.** H1 is not implicated by, and does not
implicate, `updateJumpOffset`: that function reads `.app-nav`'s live
`getBoundingClientRect().height` (a rendered size, currently 44-77px depending on breakpoint) to
position the Records jump bar's `top` offset, and H1's defect is about the nav's containing
block having zero *travel distance*, not about the nav's rendered *height* — the height value
`updateJumpOffset` reads is unaffected by whether the nav's containing block permits it to stay
pinned during scroll. A fix for H1 (enlarging `#app-nav-root`'s effective travel distance) is
not expected to change `.app-nav`'s own rendered height, so `updateJumpOffset`'s live-height
read should continue to return the same values it does today; the next plan should still
re-verify this by eye on Records since the jump bar's own `top` offset assumes the nav is
correctly pinned when it computes that offset.
