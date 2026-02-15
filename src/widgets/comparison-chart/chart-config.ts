/**
 * Chart.js configuration for comparison chart widget
 * Uses tree-shaken imports for bar and line charts
 */

import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartConfiguration
} from 'chart.js';

import { YearOverYearMonth, SeasonalTrendMonth } from '../../types/analytics.types.js';

// Register components for both bar and line charts
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Default chart colors for multi-year data
 */
const DEFAULT_YEAR_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgba(59, 130, 246, 1)' },  // Blue
  { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgba(239, 68, 68, 1)' },    // Red
  { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgba(34, 197, 94, 1)' }     // Green
];

/**
 * Create year-over-year grouped bar chart
 * Shows monthly distance comparison across up to 3 most recent years
 */
export function createYearOverYearChart(
  canvas: HTMLCanvasElement,
  data: YearOverYearMonth[],
  config?: { theme?: 'light' | 'dark'; chartColors?: string[]; showLegend?: boolean; customTitle?: string }
): Chart {
  // Extract unique years and sort descending (most recent first)
  const allYears = new Set<string>();
  data.forEach(month => {
    Object.keys(month.years).forEach(year => allYears.add(year));
  });
  const years = Array.from(allYears).sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 3);

  // Month labels
  const labels = data.map(m => m.monthLabel);

  // Create datasets for each year
  const datasets = years.map((year, index) => {
    const colorIndex = index % DEFAULT_YEAR_COLORS.length;
    const color = DEFAULT_YEAR_COLORS[colorIndex];

    return {
      label: year,
      data: data.map(m => m.years[year]?.totalKm || 0),
      backgroundColor: color.bg,
      borderColor: color.border,
      borderWidth: 1
    };
  });

  // Theme-based colors
  const isDark = config?.theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const tickColor = isDark ? '#999' : '#666';
  const titleColor = isDark ? '#ccc' : '#333';

  const chartConfig: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: gridColor
          },
          ticks: {
            color: tickColor
          },
          title: {
            display: true,
            text: 'Distance (km)',
            color: titleColor
          }
        },
        x: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: tickColor
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: config?.customTitle || 'Year-over-Year Monthly Comparison',
          color: titleColor
        },
        legend: {
          display: config?.showLegend !== false,
          labels: {
            color: titleColor
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              if (value === null || value === undefined) {
                return `${context.dataset.label}: 0.0 km`;
              }
              return `${context.dataset.label}: ${value.toFixed(1)} km`;
            }
          }
        }
      }
    }
  };

  return new Chart(canvas, chartConfig);
}

/**
 * Create seasonal trends line chart
 * Shows multi-year monthly distance trends with smooth curves
 */
export function createSeasonalTrendsChart(
  canvas: HTMLCanvasElement,
  data: SeasonalTrendMonth[],
  config?: { theme?: 'light' | 'dark'; chartColors?: string[]; showLegend?: boolean }
): Chart {
  // Extract unique years and sort descending
  const allYears = new Set<number>();
  data.forEach(month => allYears.add(month.year));
  const years = Array.from(allYears).sort((a, b) => b - a).slice(0, 3);

  // Month labels (Jan-Dec)
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Create datasets for each year
  const datasets = years.map((year, index) => {
    const colorIndex = index % DEFAULT_YEAR_COLORS.length;
    const color = DEFAULT_YEAR_COLORS[colorIndex];

    // Get data for each month of this year
    const monthlyData = monthLabels.map((_, monthIndex) => {
      const monthData = data.find(m => m.year === year && m.month === monthIndex + 1);
      return monthData?.totalKm || 0;
    });

    return {
      label: year.toString(),
      data: monthlyData,
      borderColor: color.border,
      backgroundColor: color.bg,
      borderWidth: 2,
      fill: false,
      tension: 0.3  // Smooth curves
    };
  });

  // Theme-based colors
  const isDark = config?.theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const tickColor = isDark ? '#999' : '#666';
  const titleColor = isDark ? '#ccc' : '#333';

  const chartConfig: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: gridColor
          },
          ticks: {
            color: tickColor
          },
          title: {
            display: true,
            text: 'Distance (km)',
            color: titleColor
          }
        },
        x: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: tickColor
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Seasonal Trends',
          color: titleColor
        },
        legend: {
          display: config?.showLegend !== false,
          labels: {
            color: titleColor
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              if (value === null || value === undefined) {
                return `${context.dataset.label}: 0.0 km`;
              }
              return `${context.dataset.label}: ${value.toFixed(1)} km`;
            }
          }
        }
      }
    }
  };

  return new Chart(canvas, chartConfig);
}
