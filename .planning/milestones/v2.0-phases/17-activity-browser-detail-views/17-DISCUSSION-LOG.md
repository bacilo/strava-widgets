# Phase 17: Activity Browser & Detail Views - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 17-activity-browser-detail-views
**Areas discussed:** List layout & sorting, Scale & pagination, Filter controls & URL state, Calendar view design, Chart layout & interaction, Route map on detail, Splits & zone breakdown, Gear label problem

All eight offered gray areas were selected for discussion.

---

## List layout & sorting

| Option | Description | Selected |
|--------|-------------|----------|
| Table desktop, cards mobile | Sortable `<table>` above ~700px, existing card rows below | ✓ |
| Keep card rows everywhere | Reuse `renderActivityRow` at all widths with a separate sort control | |
| Table at every width | One table with horizontal scroll on mobile | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sortable five + name + badges | Date, name, distance, time, pace, HR + existing badges | ✓ |
| Add elevation and location | Eight data columns | |
| User-toggleable columns | Column picker persisted in localStorage | |

| Option | Description | Selected |
|--------|-------------|----------|
| Click column headers | Click to sort, click again to flip, arrow + aria-sort | ✓ |
| Dropdown + direction toggle | Identical control at all widths | |
| Both, always visible | Headers and dropdown kept in sync | |

| Option | Description | Selected |
|--------|-------------|----------|
| Overview keeps cards | Shared card renderer stays; table builder is list-only | ✓ |
| Make overview a mini table | One renderer for both views | |
| You decide | Leave the split to planning | |

**User's choice:** All recommended options.
**Notes:** A mobile card fallback was preferred over horizontal scrolling; the shared card renderer therefore keeps two consumers (overview + list mobile mode).

---

## Scale & pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered pagination | Page controls; bounded DOM; BROWSE-01 says "paginated" | ✓ |
| Infinite scroll | IntersectionObserver append; hard scroll restoration | |
| Virtualized single scroll | Render only the visible window over 1,867 rows | |

| Option | Description | Selected |
|--------|-------------|----------|
| 50 per page | ~38 pages | ✓ |
| 100 per page | ~19 pages, matches Phase 16's placeholder count | |
| 25 with a size selector | Smaller default plus a picker | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full state in the URL | sort, dir, page, filters all in the hash query | ✓ |
| Sort and page only | Filters held in memory | |
| Nothing in the URL | All state in memory | |

| Option | Description | Selected |
|--------|-------------|----------|
| Restore page/sort + scroll to that row | Highlight the just-viewed row | ✓ |
| Restore page/sort, scroll to top | No row targeting | |
| You decide | Leave scroll restoration to planning | |

**User's choice:** All recommended options.
**Notes:** Full URL state was chosen partly because it makes the return-from-detail restoration fall out for free rather than needing session storage.

---

## Filter controls & URL state

| Option | Description | Selected |
|--------|-------------|----------|
| Search bar + collapsible panel | Search and chips always visible; ranges behind a Filters toggle | ✓ |
| Everything in a sticky toolbar | All filters permanently visible above the table | |
| Left sidebar panel | Persistent desktop filter rail, drawer on mobile | |

| Option | Description | Selected |
|--------|-------------|----------|
| Presets + numeric min/max | 5k/10k/HM+/marathon+, This year/Last 12 months, plus min/max inputs | ✓ |
| Numeric min/max only | Two inputs per filter, no presets | |
| Dual-thumb sliders | Drag handles bounded by the archive's real range | |

| Option | Description | Selected |
|--------|-------------|----------|
| AND + live debounced count | Filters narrow together; count updates as you type | ✓ |
| AND + count on Apply | Explicit Apply button commits the filter set | |
| You decide | Leave combination/debounce to planning | |

| Option | Description | Selected |
|--------|-------------|----------|
| Chip per filter + Clear all + real empty state | Removable named chips; zero-match state names active filters | ✓ |
| Chips only, no Clear all | Remove one at a time | |
| Single summary chip | One chip clears everything | |

**User's choice:** All recommended options.

---

## Calendar view design

| Option | Description | Selected |
|--------|-------------|----------|
| Month grid with prev/next + jump | One month at a time, month-total header, `?month=YYYY-MM` | ✓ (via free-text note) |
| Year heatmap grid | GitHub-style 53×7 squares colored by distance | (wanted, but deferred) |
| Continuously scrolling months | All months stacked, lazily rendered | |

| Option | Description | Selected |
|--------|-------------|----------|
| Distance number + intensity tint | km as text, cell tinted by distance | ✓ |
| Intensity color only | Distance on hover/tap | |
| Distance + pace | Two lines per cell | |

| Option | Description | Selected |
|--------|-------------|----------|
| Total + run-count marker, expand on click | Multi-run days open a per-run picker | ✓ |
| Stack both runs in the cell | Variable cell height | |
| Total only, click the longest run | Loses the fact there were two runs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar always shows everything | Independent of list filters | ✓ |
| Share one filter state | Filters apply across both views | |
| Independent but carry the date range | Partial coupling | |

**User's choice:** Month grid (stated as the priority), tinted distance cells, expand-on-click for multi-run days, no filter coupling.
**Notes:** Verbatim — *"I also like the Year heatmap grid but this one is the priority. Would be nice to have a heatmap over time somewhere as well."* Followed up with a placement question; the year heatmap was routed to Phase 18 (Trends) rather than added as a `#/calendar?mode=year` toggle, keeping Phase 17 to its 11 requirements. Options offered were: defer to Phase 18 (selected), toggle on the calendar view, or its own later phase.

---

## Chart layout & interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked charts, shared x-axis | Separate aligned bands per channel | ✓ (with a user-requested extension) |
| One chart, multiple y-axes | All channels overlaid on one canvas | (partially — as the overlay mechanism) |
| Tabbed single chart | Tabs to switch channel | |

| Option | Description | Selected |
|--------|-------------|----------|
| Distance with a time toggle | Default distance, toggle to elapsed time | ✓ |
| Distance only | No control | |
| Time only | Matches the raw recording | |

| Option | Description | Selected |
|--------|-------------|----------|
| Rolling-average smoothing + LTTB decimation | Presentation-only smoothing; raw values drive splits/stats | ✓ |
| Decimation only, no smoothing | Faithful but visually noisy at 1 Hz | |
| You decide | Leave windows/thresholds to planning | |

**User's choice:** Stacked bands, but explicitly extended with a per-band shaded-overlay mechanism.
**Notes:** Verbatim — *"I would like to be able to overlay them (so I can see the HR together with HR and cadence (one is the primary and the others would be shaded behind). Perhaps we could have them stacked in the way you suggest but then each of them would allow us to select (optional) one of the others to shade behind it? Like a multi-check kind of thing. Maybe not so hard to do and would be kind of nice."* This drove a follow-up round of four questions on overlay mechanics.

### Overlay mechanics (follow-up round)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-chart picker, independent | Each band carries its own channel selector | ✓ |
| One global overlay control | Applied to every band at once | |
| Legend-style toggles above the stack | One chip row applied everywhere | |

| Option | Description | Selected |
|--------|-------------|----------|
| Up to two, checkbox-style | Capped at two companions per band | ✓ |
| Exactly one at a time (radio) | Always legible, less expressive | |
| Unlimited checkboxes | Any combination | |

| Option | Description | Selected |
|--------|-------------|----------|
| Own hidden axis, low-opacity fill, real units in tooltip | No competing tick labels; primary stays full contrast | ✓ |
| Visible secondary axis on the right | Explicit scale, cramped with two overlays | |
| Normalized 0–100% shape | Tidy but invites misreading | |

| Option | Description | Selected |
|--------|-------------|----------|
| Remember in localStorage | Last overlay configuration restored across activities | ✓ |
| Put it in the URL query | Shareable but clutters detail links | |
| Reset per activity | Clean slate every time | |

---

## Route map on detail

| Option | Description | Selected |
|--------|-------------|----------|
| The activity's own detail JSON | `map.summary_polyline`, already fetched — zero extra bytes | ✓ |
| Fetch `data/routes/route-list.json` | 2.4 MB for one route; misses ~28 activities | |
| Generate per-activity route files | New pipeline output, ~1,840 more published files | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard-native module reusing `RouteRenderer` | Share rendering logic, not the widget lifecycle | ✓ |
| Embed the `<single-run-map>` element | Shadow DOM in a light-DOM view; owns its own fetch | |
| Fresh Leaflet code, no sharing | Duplicates decoding, bounds-fitting, theming | |

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy dynamic import on first detail open | List/calendar/overview never pay for Leaflet or Chart.js | ✓ |
| CDN script tag in the dashboard HTML | Matches standalone pages; costs every visit | |
| Bundle with the dashboard entry | Self-contained, inflates initial bundle | |

| Option | Description | Selected |
|--------|-------------|----------|
| Crosshair across charts + map position marker | Interpolated by cumulative distance along the simplified polyline | ✓ |
| Crosshair across charts only | Exact, but loses "where on the route did my HR spike" | |
| No syncing | Each chart tooltips independently | |

**User's choice:** All recommended options.
**Notes:** The map-marker limitation was stated up front when offered — committed streams carry no lat/lng by design (Phase 14), so route position is interpolated from cumulative distance along `summary_polyline` and is approximate. Accepted on that basis.

---

## Splits & zone breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Km, pace, avg HR, elev Δ, relative pace bar | Five columns | |
| Add cumulative time and cadence | Seven columns; needs a narrow-screen strategy | ✓ |
| Minimal: km, pace, HR | Three columns, no bar | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show the partial km, labelled with its real distance | Splits sum to the actual distance | ✓ |
| Show it but omit its pace | Avoids misreading, discards a real number | |
| Drop it entirely | Splits quietly don't add up | |

| Option | Description | Selected |
|--------|-------------|----------|
| Both: pace histogram always, HR zones when configured | Histogram needs no config; zones need HR + thresholds | ✓ |
| Pace distribution only | No sports-science assumptions at all | |
| HR zones only | Renders nothing for the 757 HR-less activities | |

| Option | Description | Selected |
|--------|-------------|----------|
| Committed athlete config file | Explicit, versioned; Phase 18 TRIMP reads the same values | ✓ |
| Derive from the archive's observed max HR | One strap spike sets zones for a decade | |
| Percentage of each activity's own max | Zones incomparable between runs | |

**User's choice:** Seven-column splits (the one non-recommended selection in the session), labelled partial km, both breakdowns, committed athlete config.
**Notes:** The seven-column choice was made after the trade-off was stated — it will not fit a phone, so a responsive column-collapse or contained horizontal-scroll strategy became a planning requirement (recorded in D-27).

---

## Gear label problem

| Option | Description | Selected |
|--------|-------------|----------|
| Max HR + explicit bpm boundaries | No formula baked into code; any zone convention expressible | ✓ |
| Max HR only, standard % bands | One number, hard-codes one convention | |
| Max HR + LTHR, threshold-based | Better if LTHR is known | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the zone panel, keep the pace histogram | No half-empty UI; phase passes without the config file | ✓ |
| Show the panel with a "configure zones" prompt | Permanent to-do box on HR-less activities | |
| Ship the config with real values in this phase | Makes the phase depend on personal numbers | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-written `data/gear.json` id→name map | 16 ids; Strava's My Gear page still readable in a browser | ✓ |
| Show the raw `gear_id` | Satisfies DETAIL-01 in name only | |
| Omit gear entirely this phase | Knowingly leaves a requirement partly unmet | |

| Option | Description | Selected |
|--------|-------------|----------|
| `device_name` fallback, else hide the tile | 1,808 activities carry a device name | ✓ |
| Always show the tile with an em dash | Consistent grid, no information on ~40% of activities | |
| Hide the tile, no device fallback | Discards committed `device_name` | |

**User's choice:** All recommended options.
**Notes:** The gear question was raised because scouting found 16 distinct `gear_id` values, no name mapping anywhere in the repo, 708 activities with no `gear_id` at all, and no API access to resolve names (Strava paywalled its API in June 2026).

---

## Claude's Discretion

- Detail-page section order and the exact stats-header tile set.
- Text-search matching semantics (substring vs token; whether `location` is searched too).
- Rolling-window size, decimation thresholds, pace-bucket widths.
- Prev/next activity navigation from a detail view; keyboard navigation for table and calendar.
- Filter-panel open/closed persistence and its exact breakpoint.
- Concrete schemas and filenames for `data/athlete.json` and `data/gear.json`.
- Which splits columns drop first on narrow screens.
- Module decomposition — how much filter/sort/paginate logic stays pure and separately unit-tested.

## Deferred Ideas

- Year-over-time consistency heatmap → Phase 18 (Trends). User wants it; month grid was the Phase 17 priority.
- Gear as an index field / gear filtering in the browser → Phase 18 gear-aware trends.
- Pace/speed color coding along the route polyline → already in PROJECT.md future vision.
- Native device-recorded laps table with a splits/laps toggle → already deferred as DETAIL-06 in REQUIREMENTS.md.

## Todos reviewed, not folded

- Manual exclusion of activities from best-effort/PR calculations — already implemented by Phase 16 plan 16-01; the todo file should move to `.planning/todos/completed/`.
- Garmin export adapter when export arrives — `export_data/` still holds only `strava/`; deferred again pending the real export to probe.
