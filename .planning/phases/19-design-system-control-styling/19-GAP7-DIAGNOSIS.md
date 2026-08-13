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

_pending Task 2_

## Confirmed Root Cause

_pending Task 3_
