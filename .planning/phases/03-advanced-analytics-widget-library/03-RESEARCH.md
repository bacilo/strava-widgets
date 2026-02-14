# Phase 3: Advanced Analytics & Widget Library - Research

**Researched:** 2026-02-14
**Domain:** Advanced data analytics (streaks, year-over-year comparisons, time-of-day patterns, seasonal trends), multi-widget architecture, embeddable widget library patterns
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 extends Phase 2's single-widget foundation into a comprehensive analytics and widget library system. The phase introduces **complex time-series analytics** (consecutive day streaks, weekly consistency, time-of-day patterns, seasonal year-over-year trends) and **multiple embeddable widget types** with a unified configuration API. The technical challenge is computing multi-dimensional statistics efficiently, visualizing patterns with Chart.js's advanced chart types, and building a cohesive widget library that maintains Phase 2's constraints (Shadow DOM isolation, IIFE bundling, static JSON architecture).

The analytics layer introduces **streak calculation algorithms** requiring careful consecutive-day logic and UTC normalization. Year-over-year comparisons need **grouped datasets in Chart.js** (2023 vs 2024 bars side-by-side). Time-of-day patterns map well to **radar or polar charts** showing morning/afternoon/evening distributions. Seasonal trends require **multi-year line charts** with month-based x-axis grouping. The widget library must support **multiple entry points** in Vite (stats-card.js, streak-widget.js, comparison-chart.js) while sharing Chart.js dependencies efficiently.

**Primary recommendation:** Build on Phase 2's architecture. Use Chart.js grouped bar charts for year-over-year comparisons, radar charts for time-of-day patterns, and line charts for seasonal trends. Compute streaks with native UTC date logic (don't pull in date libraries unless complexity proves necessary). Configure Vite with multiple entry points generating separate IIFE bundles. Use **CSS custom properties** for widget theming (colors, sizes) passed through Shadow DOM. Ensure all widgets share a consistent initialization API pattern. Avoid hand-rolling streak algorithms (subtle edge cases), avoid pulling in heavy date libraries for simple calculations, and avoid coupling widgets tightly (each should work standalone).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.x | Multi-chart visualization | Established in Phase 2; supports bar, line, radar/polar charts; tree-shakeable; same 14-48KB budget |
| Vite | 6.x | Multi-widget bundling | Established in Phase 2; supports multiple entry points; IIFE format per widget |
| TypeScript | 5.x | Type safety | Established in Phase 2; critical for complex analytics logic validation |
| Node.js | 18+ | Analytics computation | Established in Phase 2; native date/time APIs sufficient for streak calculations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 3.x | Date utilities (optional) | Only if streak logic becomes unwieldy with native Date; provides eachDayOfInterval, differenceInDays |
| date-streaks | 2.x | Streak calculation (optional) | Alternative to custom implementation; 1.4KB library with currentStreak, longestStreak, withinCurrentStreak |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js radar chart | Custom SVG/Canvas polar viz | Radar chart built-in to Chart.js; custom implementation adds complexity for minimal visual gain |
| Chart.js grouped bars | Overlaid bars or separate charts | Grouped bars directly support year-over-year comparison; overlaid bars harder to distinguish; separate charts lose comparison context |
| Native Date calculations | Luxon/Day.js/Moment | Native UTC methods sufficient for streaks; libraries add 15-70KB; only justified if complex timezone conversions needed (not in scope) |
| Vite multi-entry IIFE | Single bundle with conditional init | Separate bundles allow users to embed only widgets they need; single bundle wastes bandwidth if user only wants stats card |

**Installation:**
```bash
# No new dependencies required if using native Date
# Analytics and widget dependencies already installed in Phase 2

# Optional: date utility libraries if native Date proves insufficient
npm install date-fns           # 13KB gzipped
npm install date-streaks        # 1.4KB, minimal streak helper
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── analytics/                  # Statistical computation (Phase 2 + Phase 3)
│   ├── compute-stats.ts           # Phase 2: weekly rollups, all-time totals
│   ├── compute-advanced-stats.ts  # Phase 3: streaks, yoy, time-of-day, seasonal
│   └── utils/
│       ├── date-utils.ts          # Phase 2: week boundaries, UTC normalization
│       ├── streak-utils.ts        # Phase 3: consecutive day logic
│       └── aggregators.ts         # Phase 2 + Phase 3: all aggregation functions
├── widgets/                    # Multiple embeddable widgets
│   ├── stats-card/                # WIDG-03: Summary card widget
│   │   ├── index.ts                  # Entry point
│   │   ├── render.ts                 # DOM construction
│   │   └── styles.css                # Widget-scoped styles
│   ├── streak-widget/             # WIDG-04: Streak/patterns widget
│   │   ├── index.ts
│   │   ├── chart-config.ts           # Radar chart for time-of-day
│   │   └── styles.css
│   ├── comparison-chart/          # Year-over-year widget
│   │   ├── index.ts
│   │   ├── chart-config.ts           # Grouped bar chart
│   │   └── styles.css
│   └── shared/                    # Shared widget utilities
│       ├── widget-base.ts            # Base class for all widgets
│       ├── config-parser.ts          # Parse color/size/dateRange params
│       └── shadow-dom-helper.ts      # Shadow DOM initialization
└── types/                      # Shared types
    ├── analytics.types.ts         # Phase 2 + Phase 3 stats interfaces
    └── widget-config.types.ts     # Widget configuration interfaces

data/
└── stats/                      # Generated static JSON (Phase 2 + Phase 3)
    ├── weekly-distance.json       # Phase 2
    ├── all-time-totals.json       # Phase 2
    ├── streaks.json               # Phase 3: current/longest streaks
    ├── year-over-year.json        # Phase 3: annual comparisons
    ├── time-of-day.json           # Phase 3: morning/afternoon/evening
    └── seasonal-trends.json       # Phase 3: monthly volume by year

dist/
└── widgets/                    # Multiple IIFE bundles
    ├── stats-card.js
    ├── streak-widget.js
    └── comparison-chart.js
```

### Pattern 1: Consecutive Day Streak Calculation
**What:** Determine current streak (consecutive days with runs) and longest streak in dataset
**When to use:** STAT-07 requirement; weekly consistency also uses similar logic with 7-day windows

**Example:**
```typescript
// Source: Research synthesis from date-streaks library patterns + native Date
interface StreakResult {
  currentStreak: number;      // Days
  longestStreak: number;      // Days
  withinCurrentStreak: boolean; // Today or yesterday has activity
  currentStreakStart: string;  // ISO date
  longestStreakStart: string;  // ISO date
  longestStreakEnd: string;    // ISO date
}

function calculateDailyStreaks(activityDates: Date[]): StreakResult {
  if (activityDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, withinCurrentStreak: false,
             currentStreakStart: '', longestStreakStart: '', longestStreakEnd: '' };
  }

  // Normalize all dates to UTC midnight for day-level comparison
  const normalizedDates = activityDates
    .map(d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())))
    .sort((a, b) => a.getTime() - b.getTime()); // Ascending order

  // Deduplicate: multiple activities on same day = one day
  const uniqueDays = Array.from(
    new Set(normalizedDates.map(d => d.toISOString().split('T')[0]))
  ).map(isoDate => new Date(isoDate));

  let currentStreak = 1;
  let longestStreak = 1;
  let currentStreakStartIdx = 0;
  let longestStreakStartIdx = 0;
  let longestStreakEndIdx = 0;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prevDay = uniqueDays[i - 1];
    const currDay = uniqueDays[i];

    // Check if consecutive (exactly 1 day apart)
    const diffMs = currDay.getTime() - prevDay.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      // Consecutive day - extend current streak
      currentStreak++;
    } else {
      // Gap detected - reset current streak
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        longestStreakStartIdx = currentStreakStartIdx;
        longestStreakEndIdx = i - 1;
      }
      currentStreak = 1;
      currentStreakStartIdx = i;
    }
  }

  // Final check for longest streak
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
    longestStreakStartIdx = currentStreakStartIdx;
    longestStreakEndIdx = uniqueDays.length - 1;
  }

  // Check if within current streak (today or yesterday has activity)
  const today = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  ));
  const lastActivityDay = uniqueDays[uniqueDays.length - 1];
  const daysSinceLastActivity = (today.getTime() - lastActivityDay.getTime()) / (1000 * 60 * 60 * 24);
  const withinCurrentStreak = daysSinceLastActivity <= 1; // Today or yesterday

  return {
    currentStreak: withinCurrentStreak ? currentStreak : 0,
    longestStreak,
    withinCurrentStreak,
    currentStreakStart: uniqueDays[currentStreakStartIdx].toISOString().split('T')[0],
    longestStreakStart: uniqueDays[longestStreakStartIdx].toISOString().split('T')[0],
    longestStreakEnd: uniqueDays[longestStreakEndIdx].toISOString().split('T')[0]
  };
}
```

### Pattern 2: Year-over-Year Comparison with Grouped Bar Chart
**What:** Display 2024 vs 2025 total km/runs/hours side-by-side for each month
**When to use:** STAT-02 requirement; seasonal trends also use similar multi-year grouping

**Example:**
```typescript
// Source: https://www.chartjs.org/docs/latest/charts/bar.html (grouped bars)
interface YearOverYearData {
  month: string;        // "Jan", "Feb", ...
  years: {
    [year: string]: {  // "2023", "2024", "2025"
      totalKm: number;
      totalRuns: number;
      totalHours: number;
    };
  };
}

function createYearOverYearChart(
  canvasId: string,
  data: YearOverYearData[],
  years: string[]
) {
  const colors = [
    'rgba(54, 162, 235, 0.8)',   // Blue for first year
    'rgba(255, 99, 132, 0.8)',   // Red for second year
    'rgba(75, 192, 192, 0.8)'    // Green for third year
  ];

  const datasets = years.map((year, idx) => ({
    label: year,
    data: data.map(month => month.years[year]?.totalKm || 0),
    backgroundColor: colors[idx % colors.length],
    borderColor: colors[idx % colors.length].replace('0.8', '1'),
    borderWidth: 1
  }));

  return new Chart(canvasId, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        title: {
          display: true,
          text: 'Year-over-Year Running Volume'
        },
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        x: {
          // grouped: true is default for bar charts with multiple datasets
          title: {
            display: true,
            text: 'Month'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Distance (km)'
          }
        }
      }
    }
  });
}
```

### Pattern 3: Time-of-Day Patterns with Radar Chart
**What:** Visualize distribution of runs across time periods (morning/afternoon/evening/night)
**When to use:** STAT-09 requirement; shows when user typically runs

**Example:**
```typescript
// Source: https://www.chartjs.org/docs/latest/charts/radar.html
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface TimeOfDayPattern {
  period: string;      // "Morning", "Afternoon", "Evening", "Night"
  runCount: number;    // Number of runs in this period
  totalKm: number;     // Total distance in this period
  percentage: number;  // % of total runs
}

function groupByTimeOfDay(activities: StravaActivity[]): TimeOfDayPattern[] {
  const timeBuckets = {
    'Morning (6am-12pm)': { runCount: 0, totalKm: 0 },
    'Afternoon (12pm-6pm)': { runCount: 0, totalKm: 0 },
    'Evening (6pm-10pm)': { runCount: 0, totalKm: 0 },
    'Night (10pm-6am)': { runCount: 0, totalKm: 0 }
  };

  for (const activity of activities) {
    const activityDate = new Date(activity.start_date);
    const hour = activityDate.getUTCHours(); // Use UTC to avoid timezone shifts

    let bucket: keyof typeof timeBuckets;
    if (hour >= 6 && hour < 12) bucket = 'Morning (6am-12pm)';
    else if (hour >= 12 && hour < 18) bucket = 'Afternoon (12pm-6pm)';
    else if (hour >= 18 && hour < 22) bucket = 'Evening (6pm-10pm)';
    else bucket = 'Night (10pm-6am)';

    timeBuckets[bucket].runCount++;
    timeBuckets[bucket].totalKm += activity.distance / 1000;
  }

  const totalRuns = activities.length;
  return Object.entries(timeBuckets).map(([period, stats]) => ({
    period,
    runCount: stats.runCount,
    totalKm: stats.totalKm,
    percentage: totalRuns > 0 ? (stats.runCount / totalRuns) * 100 : 0
  }));
}

function createTimeOfDayRadarChart(canvasId: string, data: TimeOfDayPattern[]) {
  return new Chart(canvasId, {
    type: 'radar',
    data: {
      labels: data.map(d => d.period),
      datasets: [{
        label: 'Runs by Time of Day',
        data: data.map(d => d.runCount),
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.5,
      scales: {
        r: {
          beginAtZero: true,
          angleLines: {
            display: true
          },
          grid: {
            circular: true
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const dataPoint = data[context.dataIndex];
              return [
                `Runs: ${dataPoint.runCount}`,
                `Distance: ${dataPoint.totalKm.toFixed(1)} km`,
                `% of Total: ${dataPoint.percentage.toFixed(1)}%`
              ];
            }
          }
        }
      }
    }
  });
}
```

### Pattern 4: Multi-Widget Vite Configuration
**What:** Generate separate IIFE bundles for each widget type while sharing dependencies efficiently
**When to use:** Widget library with 3+ widget types (stats-card, streak-widget, comparison-chart)

**Example:**
```typescript
// vite.config.ts
// Source: https://raulmelo.me/en/blog/build-javascript-library-with-multiple-entry-points-using-vite-3
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      // Multiple entry points - Vite will generate separate bundles
      entry: {
        'stats-card': resolve(__dirname, 'src/widgets/stats-card/index.ts'),
        'streak-widget': resolve(__dirname, 'src/widgets/streak-widget/index.ts'),
        'comparison-chart': resolve(__dirname, 'src/widgets/comparison-chart/index.ts')
      },
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        // Each widget gets its own IIFE bundle
        entryFileNames: 'widgets/[name].js',
        assetFileNames: 'widgets/[name].[ext]',
        inlineDynamicImports: true // Required for IIFE
      }
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true
      }
    }
  }
});
```

**Output:**
```
dist/
└── widgets/
    ├── stats-card.js          # Self-contained IIFE
    ├── streak-widget.js       # Self-contained IIFE
    └── comparison-chart.js    # Self-contained IIFE
```

**Tradeoff:** Each bundle includes Chart.js independently (~14-20KB per widget). Alternative approach: shared vendor bundle, but violates "single script tag" embedding constraint.

### Pattern 5: CSS Custom Properties for Widget Theming
**What:** Allow users to customize widget colors, sizes without editing JavaScript
**When to use:** WIDG-05 requirement; all widgets should accept theming configuration

**Example:**
```typescript
// Source: https://gomakethings.com/styling-the-shadow-dom-with-css-variables-in-web-components/
// Widget initialization with config
class StatsCardWidget {
  private shadowRoot: ShadowRoot;

  constructor(containerId: string, config: WidgetConfig) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.shadowRoot = container.attachShadow({ mode: 'open' });

    // Inject styles with CSS custom properties
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          /* CSS variables - can be overridden from parent */
          --card-bg-color: ${config.colors?.background || '#ffffff'};
          --card-text-color: ${config.colors?.text || '#333333'};
          --card-accent-color: ${config.colors?.accent || '#3498db'};
          --card-width: ${config.size?.width || '400px'};
          --card-padding: ${config.size?.padding || '20px'};
        }

        .stats-card {
          background: var(--card-bg-color);
          color: var(--card-text-color);
          width: var(--card-width);
          padding: var(--card-padding);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .stat-value {
          color: var(--card-accent-color);
          font-size: 2em;
          font-weight: bold;
        }
      </style>
      <div class="stats-card">
        <div class="stat-item">
          <div class="stat-label">Total Distance</div>
          <div class="stat-value" id="total-distance">--</div>
        </div>
      </div>
    `;

    this.loadData(config.dataUrl, config.dateRange);
  }
}

// User embedding with custom theme
window.StatsCard.init('stats-container', {
  dataUrl: '/data/stats/all-time-totals.json',
  colors: {
    background: '#1e1e1e',   // Dark theme
    text: '#ffffff',
    accent: '#00ff00'        // Green accent
  },
  size: {
    width: '500px',
    padding: '30px'
  },
  dateRange: {
    start: '2024-01-01',
    end: '2024-12-31'
  }
});
```

**Key insight:** CSS custom properties (variables) pierce the Shadow DOM boundary. This is the **recommended** approach per 2026 best practices. Alternatives like `::part()` selectors are more granular but require more API surface area and documentation.

### Pattern 6: Seasonal Trends Multi-Year Line Chart
**What:** Display monthly volume trends across multiple years for comparison
**When to use:** STAT-10 requirement; helps identify seasonal patterns

**Example:**
```typescript
// Source: https://www.chartjs.org/docs/latest/charts/line.html
interface MonthlyVolume {
  year: number;
  month: number;  // 1-12
  totalKm: number;
  totalRuns: number;
}

function createSeasonalTrendsChart(
  canvasId: string,
  data: MonthlyVolume[]
) {
  // Group by year
  const yearGroups = data.reduce((acc, d) => {
    if (!acc[d.year]) acc[d.year] = [];
    acc[d.year].push(d);
    return acc;
  }, {} as Record<number, MonthlyVolume[]>);

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const colors = [
    'rgba(54, 162, 235, 1)',   // Blue
    'rgba(255, 99, 132, 1)',   // Red
    'rgba(75, 192, 192, 1)'    // Green
  ];

  const datasets = Object.entries(yearGroups).map(([year, months], idx) => {
    // Ensure all 12 months present (fill gaps with 0)
    const monthlyData = Array(12).fill(0);
    months.forEach(m => {
      monthlyData[m.month - 1] = m.totalKm;
    });

    return {
      label: year,
      data: monthlyData,
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length].replace('1)', '0.1)'),
      borderWidth: 2,
      tension: 0.3, // Smooth curves
      fill: false
    };
  });

  return new Chart(canvasId, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        title: {
          display: true,
          text: 'Seasonal Running Trends (Year-over-Year)'
        },
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Month'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Distance (km)'
          }
        }
      }
    }
  });
}
```

### Anti-Patterns to Avoid

- **Averaging pace values directly:** Pace is non-linear (min/km = 1/speed). Always calculate as `total_time / total_distance`, never `average(individual_paces)`. This compounds Phase 2's Pitfall 6.
- **Using local timezone methods for streaks:** `getDay()`, `getDate()` will produce different streak results depending on server/user timezone. Always use `getUTCDay()`, `getUTCDate()` for day-level comparisons.
- **Ignoring "same day, multiple runs" in streak logic:** Multiple activities on 2024-01-15 should count as ONE day in streak calculation. Must deduplicate dates before computing consecutive days.
- **Tight coupling between widgets:** Each widget should be independently embeddable. Avoid shared global state or assumptions about other widgets existing on page.
- **Inconsistent widget initialization APIs:** If StatsCard uses `.init(id, config)`, all widgets should follow same pattern. Inconsistent APIs confuse users.
- **Overusing CSS Shadow Parts:** Don't expose `::part()` for every element. CSS custom properties provide sufficient theming for 90% of use cases with less API surface.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streak calculation algorithm | Manual date iteration, gap detection | Native Date with UTC normalization OR date-streaks library (1.4KB) | Edge cases: leap years, month boundaries, DST transitions, timezone shifts; off-by-one errors common; "within current streak" logic (yesterday counts) is subtle |
| ISO 8601 week number calculation | Manual day-of-week math | Native `Intl.DateTimeFormat` with `week: 'numeric'` OR getWeekStart from Phase 2 | ISO 8601 rules: week 1 contains first Thursday, weeks start Monday; January dates can be week 52/53 of previous year; manual calculation is 30+ lines with edge cases |
| Multi-year data grouping | Nested loops and reduce | Array.reduce with Map for grouping | Year-month-day hierarchies get complex quickly; Map-based grouping is readable and performant; lodash/groupBy adds 70KB for trivial benefit |
| Radar chart rendering | Custom SVG path generation | Chart.js RadarController | Angular grid, point positioning, responsive resize, tooltips, accessibility; custom radar chart is 200+ lines and misses subtle layout issues |
| Date range filtering | Manual date comparison loops | Array.filter with Date comparison | Timezone-safe comparisons need UTC normalization; inclusive vs exclusive end dates; one-liners with .filter are clearer and less error-prone |

**Key insight:** Streak calculations have deceptive complexity. The "within current streak" logic (user still in streak if they ran yesterday, even if not today) requires end-of-day awareness. The date-streaks library codifies this: "the streak isn't broken until the end of the day." Building this from scratch leads to edge cases like: What if it's 1am local time but yesterday UTC? What if user crosses date line? UTC normalization + library or well-tested custom implementation is critical.

## Common Pitfalls

### Pitfall 1: Off-by-One Errors in Consecutive Day Calculation
**What goes wrong:** Streak calculation counts same day twice, or misses valid consecutive days due to 23-hour vs 25-hour gaps (DST)
**Why it happens:** Comparing raw timestamps instead of calendar days; DST transitions make "24 hours apart" ≠ "consecutive days"
**How to avoid:** Normalize all dates to UTC midnight BEFORE computing differences; compare calendar days, not millisecond deltas
**Warning signs:** Streaks differ by 1 from manual count; streaks break during DST transitions; test data has unexpected gaps

**Prevention pattern:**
```typescript
// WRONG - comparing timestamps
const diffMs = date2.getTime() - date1.getTime();
const diffDays = diffMs / (1000 * 60 * 60 * 24); // BAD - DST breaks this
if (diffDays === 1) { /* consecutive */ }

// CORRECT - comparing calendar days
const day1 = new Date(Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate()));
const day2 = new Date(Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate()));
const diffMs = day2.getTime() - day1.getTime();
const diffDays = diffMs / (1000 * 60 * 60 * 24); // GOOD - normalized to UTC midnight
if (diffDays === 1) { /* consecutive */ }
```

### Pitfall 2: Year-over-Year Chart with Misaligned Months
**What goes wrong:** 2024 data shows 12 bars, 2025 data shows 2 bars (current year incomplete), bars don't align
**Why it happens:** Dataset lengths differ; Chart.js grouped bars expect same-length arrays
**How to avoid:** Pre-fill all 12 months for each year with 0 values; map data to fixed month array
**Warning signs:** Chart x-axis labels inconsistent; bars for different years don't align side-by-side; console errors about dataset length mismatch

**Prevention pattern:**
```typescript
// WRONG - varying array lengths
const data2024 = [50, 45, 60, ...]; // 12 months
const data2025 = [55, 48]; // Only 2 months so far
datasets: [
  { label: '2024', data: data2024 }, // 12 items
  { label: '2025', data: data2025 }  // 2 items - MISALIGNED
]

// CORRECT - fixed 12-month arrays
const monthlyData2024 = Array(12).fill(0); // Initialize all months to 0
const monthlyData2025 = Array(12).fill(0);
// Then populate with actual data
activities2024.forEach(a => {
  monthlyData2024[a.month - 1] += a.distance;
});
datasets: [
  { label: '2024', data: monthlyData2024 }, // Always 12 items
  { label: '2025', data: monthlyData2025 }  // Always 12 items
]
```

### Pitfall 3: Time-of-Day Grouping with Local Timezone
**What goes wrong:** User in US sees different time-of-day distribution than same user viewing from Europe
**Why it happens:** `getHours()` returns local time; same activity appears in "Morning" vs "Evening" depending on viewer timezone
**How to avoid:** Use `getUTCHours()` for time-of-day bucketing; or if local time intended, store activity timezone and convert consistently
**Warning signs:** Time-of-day patterns differ between dev (local) and production (server); patterns don't match user's perception

**Prevention pattern:**
```typescript
// WRONG - local timezone dependent
const hour = new Date(activity.start_date).getHours(); // BAD - local time
if (hour >= 6 && hour < 12) { /* morning */ }

// CORRECT - UTC normalized
const hour = new Date(activity.start_date).getUTCHours(); // GOOD - consistent
if (hour >= 6 && hour < 12) { /* morning */ }

// ALTERNATIVE - if activity timezone stored
// Parse activity.start_date_local with timezone offset, then bucket
// Only do this if user explicitly wants "local time of run" patterns
```

### Pitfall 4: Chart.js Radar Chart Scale Not Starting at Zero
**What goes wrong:** Radar chart y-axis doesn't start at 0, making small differences look exaggerated
**Why it happens:** Chart.js auto-scales axes to data range by default; radar charts don't default to `beginAtZero: true`
**How to avoid:** Explicitly set `scales.r.beginAtZero: true` for radar charts
**Warning signs:** Radar chart shows dramatic differences between periods, but actual values are close (e.g., 10 vs 12 runs looks like 2x difference)

**Prevention pattern:**
```typescript
// Add to radar chart options
options: {
  scales: {
    r: {
      beginAtZero: true, // CRITICAL for radar charts
      // ...
    }
  }
}
```

### Pitfall 5: Multi-Entry Vite Build with Shared Dependencies Bloat
**What goes wrong:** Each widget bundle is 100KB+ because Chart.js included multiple times
**Why it happens:** Vite IIFE format can't code-split; each entry point bundles all dependencies
**How to avoid:** Accept this tradeoff (single script tag requirement) OR use tree-shaking to minimize Chart.js per widget (only import needed controllers)
**Warning signs:** Total bundle size for 3 widgets is 300KB+ instead of expected ~150KB

**Mitigation pattern:**
```typescript
// Per widget, only import needed Chart.js components
// stats-card.ts - only needs simple text display, no chart
import { /* no Chart.js */ } from 'chart.js';

// streak-widget.ts - only needs radar chart
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';

// comparison-chart.ts - only needs bar chart
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';
```

**Result:** Stats card ~5KB, streak widget ~20KB, comparison chart ~18KB = ~43KB total instead of 90KB+ with full Chart.js in each.

### Pitfall 6: Weekly Consistency Streak with Partial Weeks
**What goes wrong:** User has 4 runs in first week of January (week starts Monday, but year starts Wednesday) - does this count toward "N runs per week" consistency?
**Why it happens:** ISO week boundaries don't align with month boundaries; first/last week of year may be partial
**How to avoid:** Define consistency rules explicitly: "at least N runs in a complete 7-day period" vs "at least N runs in calendar week regardless of length"
**Warning signs:** Consistency streak breaks unexpectedly at year boundaries; first/last weeks of year skipped or counted differently

**Prevention pattern:**
```typescript
// OPTION 1: Strict 7-day windows only
// Only count weeks with full 7 days of data available

// OPTION 2: Proportional threshold
// First week of Jan has 3 days (Wed-Fri) → require N * (3/7) runs
// Last week of Dec has 2 days (Mon-Tue) → require N * (2/7) runs

// OPTION 3: Document the rule clearly
// "Weekly consistency: at least N runs in any ISO week (Monday-Sunday).
// Partial weeks at year boundaries count if they meet threshold."
```

**Recommendation:** Option 3 (simple rule, clearly documented) is best for user-facing stats. Option 1 (strict 7-day windows) adds implementation complexity with minimal UX benefit.

## Code Examples

Verified patterns from official sources:

### Chart.js Custom Tooltip for Duration Formatting
```typescript
// Source: https://www.chartjs.org/docs/latest/configuration/tooltip.html
// Format time duration (seconds) as "Xh Ym" in tooltip
options: {
  plugins: {
    tooltip: {
      callbacks: {
        label: function(context) {
          const totalSeconds = context.parsed.y;
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);

          let label = context.dataset.label || '';
          if (hours > 0) {
            label += `: ${hours}h ${minutes}m`;
          } else {
            label += `: ${minutes}m`;
          }
          return label;
        }
      }
    }
  }
}
```

### ISO 8601 Week Number Calculation (from Phase 2 patterns)
```typescript
// Source: https://www.epoch-calendar.com/support/getting_iso_week.html
// ISO 8601: Week 1 is first week containing Thursday; weeks start Monday
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday=7, Monday=1
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}
```

### Pace Calculation and Formatting
```typescript
// Source: https://medium.com/@hugovndrhorst/basic-javascript-pace-calculator-31cd6be356e7
// Calculate pace (min/km) from total time and distance
function calculatePace(totalSeconds: number, totalKm: number): string {
  if (totalKm === 0) return '--:--';

  const paceSeconds = totalSeconds / totalKm; // sec/km
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Usage: total_time / total_distance, NOT average(activity.average_speed)
const totalMinutes = activities.reduce((sum, a) => sum + a.moving_time / 60, 0);
const totalKm = activities.reduce((sum, a) => sum + a.distance / 1000, 0);
const avgPaceString = calculatePace(totalMinutes * 60, totalKm); // "5:23"
```

### Widget Configuration Type Interface
```typescript
// Standardized config interface for all widgets
interface WidgetConfig {
  dataUrl: string;                  // Required: URL to JSON data
  colors?: {
    background?: string;             // CSS color
    text?: string;
    accent?: string;
    chartColors?: string[];          // Array for multi-dataset charts
  };
  size?: {
    width?: string;                  // CSS unit (px, %, vw)
    height?: string;
    padding?: string;
  };
  dateRange?: {
    start?: string;                  // ISO date string
    end?: string;
  };
  options?: {
    showLegend?: boolean;
    showTitle?: boolean;
    customTitle?: string;
  };
}

// Usage across all widgets
window.StatsCard.init('container-id', config);
window.StreakWidget.init('container-id', config);
window.ComparisonChart.init('container-id', config);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual streak calculation | date-streaks library or optimized native Date | 2020+ | 1.4KB library handles edge cases; native Date sufficient with UTC normalization |
| Moment.js for date manipulation | date-fns, Day.js, or native Intl/Date | 2020+ (Moment deprecated) | date-fns 13KB vs Moment 70KB; native Date + Intl API sufficient for most use cases |
| Single widget per page | Multi-widget libraries with shared deps | Ongoing trend | Vite multi-entry IIFE; each widget standalone but shared Chart.js tree-shaken |
| Inline styles for theming | CSS custom properties through Shadow DOM | 2020+ (widespread adoption) | CSS variables pierce Shadow DOM; cleaner API than style attributes or ::part selectors |
| Bar charts only for comparisons | Grouped bars, radar, polar, line for patterns | Chart.js v3+ (2021) | Radar charts excellent for cyclic data (time-of-day); grouped bars for year-over-year; line charts for trends |

**Deprecated/outdated:**
- **Moment.js:** Officially deprecated; use date-fns (modular) or native Date/Intl API
- **Chart.js v2 API:** Multi-axis and grouped dataset syntax changed in v3
- **jQuery-based widgets:** 2026 standard is vanilla JS + Shadow DOM; jQuery adds 30KB for no benefit
- **CSS-in-JS for Shadow DOM:** Constructable StyleSheets or `<style>` in template preferred over styled-components

## Open Questions

1. **Streak calculation: native vs library**
   - What we know: Native Date with UTC normalization can handle consecutive days; date-streaks is 1.4KB with tested edge cases
   - What's unclear: Will custom implementation be maintainable as requirements expand (e.g., weekly consistency with variable thresholds)?
   - Recommendation: Start with native Date implementation (full control, no deps); if complexity grows beyond 50 lines or edge cases multiply, migrate to date-streaks

2. **Weekly consistency threshold configuration**
   - What we know: STAT-08 requires "weeks with at least N runs" but N is unspecified
   - What's unclear: Should N be hardcoded (e.g., 3 runs/week) or user-configurable? Should it vary by user's typical volume?
   - Recommendation: MEDIUM confidence - default to N=3 (reasonable for recreational runner), make configurable via widget config for flexibility

3. **Seasonal trends: fixed year range or dynamic**
   - What we know: STAT-10 requires "volume by month, compared across years"
   - What's unclear: Should chart always show last 3 years, or auto-adjust to available data (1 year = no comparison, 5+ years = too crowded)?
   - Recommendation: Show up to 3 most recent years with data; if <2 years available, show notice "More data needed for year-over-year comparison"

4. **Widget library distribution strategy**
   - What we know: Each widget is separate IIFE bundle; user embeds only what they need
   - What's unclear: Should there also be an "all-in-one" bundle for users who want multiple widgets? Does bundle duplication (Chart.js in each) justify CDN/shared vendor approach?
   - Recommendation: Start with separate bundles (simplest); monitor user feedback; if 80%+ users embed multiple widgets, add convenience "all-widgets.js" bundle in later phase

5. **Time-of-day patterns: UTC vs local time**
   - What we know: Strava activities include start_date (UTC) and start_date_local (activity timezone)
   - What's unclear: Should time-of-day analysis use UTC (consistent across all users) or local time of activity (when user actually ran)? If local, does Strava API provide timezone reliably?
   - Recommendation: MEDIUM confidence - use UTC for simplicity and consistency (Phase 2 established UTC-first approach); document clearly "Time of day based on UTC, not local run time"

## Sources

### Primary (HIGH confidence)
- [Chart.js Official Documentation - Bar Charts](https://www.chartjs.org/docs/latest/charts/bar.html) - Grouped bar configuration verified
- [Chart.js Official Documentation - Radar Charts](https://www.chartjs.org/docs/latest/charts/radar.html) - Radar chart API verified
- [Chart.js Official Documentation - Line Charts](https://www.chartjs.org/docs/latest/charts/line.html) - Multi-dataset line charts verified
- [Chart.js Official Documentation - Tooltip Callbacks](https://www.chartjs.org/docs/latest/configuration/tooltip.html) - Custom tooltip formatting verified
- [Chart.js Official Documentation - Responsive](https://www.chartjs.org/docs/latest/configuration/responsive.html) - Container requirements and responsive behavior verified (from Phase 2)
- [MDN: Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) - Shadow DOM API and CSS custom properties verified
- [Vite: Building for Production](https://vite.dev/guide/build) - Library mode configuration verified (from Phase 2)

### Secondary (MEDIUM confidence)
- [Build JavaScript library with multiple entry points using Vite3 - Raul Melo](https://raulmelo.me/en/blog/build-javascript-library-with-multiple-entry-points-using-vite-3) - Multi-entry IIFE pattern
- [date-streaks GitHub Repository](https://github.com/jonsamp/date-streaks) - Streak calculation API and edge cases
- [streaker-js GitHub Repository](https://github.com/iancanderson/streaker-js) - Daily/weekly/monthly streak logic
- [Go Make Things: Styling Shadow DOM with CSS Variables](https://gomakethings.com/styling-the-shadow-dom-with-css-variables-in-web-components/) - CSS custom properties best practices
- [Getting ISO-8601 Week Number in JavaScript - Epoch Calendar](https://www.epoch-calendar.com/support/getting_iso_week.html) - ISO week calculation algorithm
- [JavaScript Pace Calculator - Hugo van der Horst (Medium)](https://medium.com/@hugovndrhorst/basic-javascript-pace-calculator-31cd6be356e7) - Pace calculation pattern
- [JavaScript ISO 8601 Week Number - w3resource](https://www.w3resource.com/javascript-exercises/javascript-date-exercise-24.php) - Week number calculation examples
- [JavaScript Date Tutorial: Get the Timezone Right - Full Stack Foundations](https://www.fullstackfoundations.com/blog/javascript-dates) - UTC vs local timezone pitfalls
- [JavaScript Dates and UTC - Jake Trent](https://jaketrent.com/post/javascript-dates-utc/) - UTC normalization patterns

### Tertiary (LOW confidence - flagged for validation)
- [Frontend Design Patterns That Actually Work in 2026 - Netguru](https://www.netguru.com/blog/frontend-design-patterns) - Component-driven development trends
- [CSS Custom Properties Complete Guide for 2026 - DevToolbox](https://devtoolbox.dedyn.io/blog/css-variables-complete-guide) - CSS variables best practices (2026 update)
- [Data Visualization with Period-Over-Period Charts - Domo](https://www.domo.com/learn/charts/period-over-period-charts) - Year-over-year visualization patterns
- [Web Component Best Practices - Cian Frani](https://cianfrani.dev/posts/web-component-best-practices/) - Shadow DOM theming guidance
- [Astro Islands Architecture](https://docs.astro.build/en/concepts/islands/) - Static site widget embedding (Jekyll/Astro compatibility context)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Builds directly on Phase 2 (Chart.js, Vite, TypeScript, Node.js); no new core dependencies required
- Architecture: MEDIUM-HIGH - Multi-entry Vite config verified from secondary sources; CSS custom properties verified from MDN; streak logic synthesized from library patterns + native Date
- Pitfalls: MEDIUM - Streak edge cases identified from date-streaks library docs; timezone issues carry forward from Phase 2; year-over-year alignment pattern synthesized from Chart.js docs
- Code examples: HIGH - Chart.js patterns from official docs; date calculations from verified sources; widget config pattern synthesized from established patterns
- Analytics algorithms: MEDIUM - Streak calculation logic synthesized from date-streaks + streaker-js patterns; time-of-day/seasonal grouping straightforward but UTC vs local time decision needs validation

**Research date:** 2026-02-14
**Valid until:** ~30 days (stable ecosystem; Chart.js v4 stable; Vite v6 stable; no major breaking changes expected)

**Open validation items:**
1. Verify date-streaks library edge cases match native Date implementation for project needs
2. Confirm Chart.js radar chart visual clarity for 4 time-of-day buckets (not too sparse)
3. Test multi-entry Vite build produces expected bundle sizes (~20KB per widget with tree-shaking)
4. Validate year-over-year grouped bars readability with 3+ years of data (not too crowded)
5. Confirm CSS custom properties provide sufficient theming flexibility (vs needing ::part selectors)
6. Test widgets render correctly in Jekyll and Astro (static site generator compatibility)
