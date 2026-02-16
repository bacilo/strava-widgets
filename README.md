# Strava Analytics Widgets

Embeddable web components for visualizing Strava running data on personal websites. Transform your activity data into interactive, customizable widgets powered by Custom Elements and Shadow DOM.

## Features

- **Stats Card**: Display all-time running totals with year-over-year comparisons, showing distance, time, elevation gain, and run counts
- **Comparison Chart**: Interactive bar charts visualizing seasonal trends and time period comparisons using Chart.js
- **Streak Widget**: Track consecutive run days, time-of-day activity patterns with radar charts, and monthly heatmaps
- **Geographic Statistics**: Country and city rankings based on distance covered, with CSV export functionality
- **Geographic Table**: Sortable, paginated tables showing detailed geographic data with interactive column sorting

## Quick Start

Add a stats card widget to your website with just a few lines of HTML:

```html
<!-- Load the widget script -->
<script src="https://bacilo.github.io/strava-widgets/stats-card.iife.js"></script>

<!-- Embed the widget -->
<strava-stats-card
  data-url="https://bacilo.github.io/strava-widgets/data/stats/all-time-totals.json"
  data-title="My Running Stats">
</strava-stats-card>
```

## Widgets

### Stats Card

Display comprehensive all-time running statistics with optional year-over-year comparisons.

- **Tag**: `<strava-stats-card>`
- **Required**: `data-url` (path to all-time-totals.json)
- **Optional**: `data-secondary-url` (year-over-year.json), `data-title`, `data-show-yoy`

```html
<script src="https://bacilo.github.io/strava-widgets/stats-card.iife.js"></script>

<strava-stats-card
  data-url="https://bacilo.github.io/strava-widgets/data/stats/all-time-totals.json"
  data-secondary-url="https://bacilo.github.io/strava-widgets/data/stats/year-over-year.json"
  data-title="Running Statistics"
  data-show-yoy="true">
</strava-stats-card>
```

### Comparison Chart

Interactive bar chart comparing running statistics across different time periods.

- **Tag**: `<strava-comparison-chart>`
- **Required**: `data-url` (year-over-year.json)
- **Optional**: `data-secondary-url` (seasonal-trends.json), `data-title`, `data-chart-colors`, `data-show-legend`

```html
<script src="https://bacilo.github.io/strava-widgets/comparison-chart.iife.js"></script>

<strava-comparison-chart
  data-url="https://bacilo.github.io/strava-widgets/data/stats/year-over-year.json"
  data-secondary-url="https://bacilo.github.io/strava-widgets/data/stats/seasonal-trends.json"
  data-title="Year-Over-Year Comparison"
  data-show-legend="true">
</strava-comparison-chart>
```

### Streak Widget

Visualize running streaks, consecutive run days, and activity patterns.

- **Tag**: `<strava-streak-widget>`
- **Required**: `data-url` (streaks.json)
- **Optional**: `data-secondary-url` (time-of-day.json), `data-title`, `data-show-chart`

```html
<script src="https://bacilo.github.io/strava-widgets/streak-widget.iife.js"></script>

<strava-streak-widget
  data-url="https://bacilo.github.io/strava-widgets/data/stats/streaks.json"
  data-secondary-url="https://bacilo.github.io/strava-widgets/data/stats/time-of-day.json"
  data-title="Running Streaks & Patterns"
  data-show-chart="true">
</strava-streak-widget>
```

### Geographic Statistics

Country and city running rankings with distance data and CSV export.

- **Tag**: `<strava-geo-stats>`
- **Required**: `data-url` (countries.json)
- **Optional**: `data-secondary-url` (cities.json), `data-metadata-url` (geo-metadata.json), `data-title`, `data-show-export`, `data-max-rows`

```html
<script src="https://bacilo.github.io/strava-widgets/geo-stats-widget.iife.js"></script>

<strava-geo-stats
  data-url="https://bacilo.github.io/strava-widgets/data/geo/countries.json"
  data-secondary-url="https://bacilo.github.io/strava-widgets/data/geo/cities.json"
  data-metadata-url="https://bacilo.github.io/strava-widgets/data/geo/geo-metadata.json"
  data-title="Where I've Run"
  data-show-export="true">
</strava-geo-stats>
```

### Geographic Table

Sortable, paginated tables showing detailed geographic statistics.

- **Tag**: `<strava-geo-table>`
- **Required**: `data-url` (countries.json or cities.json)
- **Optional**: `data-dataset` ("countries" or "cities"), `data-title`, `data-rows-per-page`, `data-default-sort`, `data-default-sort-direction`

```html
<script src="https://bacilo.github.io/strava-widgets/geo-table-widget.iife.js"></script>

<strava-geo-table
  data-url="https://bacilo.github.io/strava-widgets/data/geo/countries.json"
  data-dataset="countries"
  data-title="Countries I've Run In"
  data-rows-per-page="20"
  data-default-sort="distance"
  data-default-sort-direction="desc">
</strava-geo-table>
```

## Common Attributes

All widgets inherit from `WidgetBase` and support these common attributes:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-url` | string | (required) | URL to primary data JSON file |
| `data-secondary-url` | string | - | URL to secondary data JSON file |
| `data-title` | string | - | Custom widget title |
| `data-show-title` | boolean | true | Show or hide the title |
| `data-theme` | "light" \| "dark" | auto | Color theme (auto-detects from system) |
| `data-width` | string | "100%" | Widget width |
| `data-max-width` | string | - | Maximum width constraint |
| `data-padding` | string | - | Custom padding (CSS value) |
| `data-bg` | string | - | Background color |
| `data-text-color` | string | - | Text color |
| `data-accent` | string | - | Accent color for highlights |

## CLI Commands

The project includes a command-line interface for managing Strava data synchronization and statistics computation.

| Command | Description |
|---------|-------------|
| `npm run auth` | Authenticate with Strava OAuth flow |
| `npm run sync` | Fetch new activities from Strava API |
| `npm start status` | Show current sync status and activity counts |
| `npm run compute-stats` | Compute basic statistics (totals, averages) |
| `npm run compute-advanced-stats` | Compute advanced statistics (year-over-year, streaks, time-of-day) |
| `npm run compute-geo-stats` | Compute geographic statistics from GPS data |
| `npm run compute-all-stats` | Compute all statistics (basic + advanced + geo) |
| `npm run build-widgets` | Build all widget IIFE bundles for embedding |
| `npm test` | Run test suite |

## Setup

To set up your own instance of the Strava Analytics Widgets:

1. Clone the repository:
   ```bash
   git clone https://github.com/bacilo/strava-widgets.git
   cd strava-widgets
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Strava API credentials:
   ```
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   ```

4. Authenticate with Strava:
   ```bash
   npm run auth
   # Follow the OAuth flow and paste the authorization code
   ```

5. Sync your activities:
   ```bash
   npm run sync
   ```

6. Compute all statistics:
   ```bash
   npm run compute-all-stats
   ```

7. Build widget bundles:
   ```bash
   npm run build-widgets
   ```

8. Open the test page to preview widgets:
   ```bash
   open dist/widgets/test.html
   ```

## CI/CD

The project includes an automated GitHub Actions workflow that runs daily at 5:00 AM UTC:

- Fetches new activities from the Strava API
- Computes all statistics including geographic data
- Geocodes GPS coordinates to countries and cities using offline-geocode-city
- Builds widget IIFE bundles with Vite
- Deploys to GitHub Pages at [bacilo.github.io/strava-widgets](https://bacilo.github.io/strava-widgets)

The pipeline includes non-blocking geocoding so widget deployment continues even if geocoding fails. View the live widgets at:

- **Widget test page**: [bacilo.github.io/strava-widgets/test.html](https://bacilo.github.io/strava-widgets/test.html)
- **Widget index**: [bacilo.github.io/strava-widgets/index.html](https://bacilo.github.io/strava-widgets/index.html)

## Data Attribution

**Strava Attribution (Required):**

When displaying widgets that use Strava data, you must include:

- "Powered by Strava" text with a link to [https://www.strava.com](https://www.strava.com)
- Compliance with Strava Brand Guidelines: [https://developers.strava.com/guidelines/](https://developers.strava.com/guidelines/)
- Review the Strava API Agreement: [https://www.strava.com/legal/api](https://www.strava.com/legal/api)

Example attribution:

```html
<p>Powered by <a href="https://www.strava.com">Strava</a></p>
```

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 22
- **Visualization**: Chart.js (bar charts, radar charts)
- **Build Tool**: Vite (IIFE bundles)
- **Architecture**: Web Components, Shadow DOM, Custom Elements API
- **Geocoding**: offline-geocode-city (zero API calls, 217 KB)
- **CI/CD**: GitHub Actions
- **Deployment**: GitHub Pages

## License

MIT
