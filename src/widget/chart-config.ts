/**
 * Chart.js configuration for weekly bar chart widget
 * Uses tree-shaken imports (only required components, not chart.js/auto)
 */

import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  ChartConfiguration
} from 'chart.js';

import { WeeklyStats } from '../types/analytics.types.js';

// Register only the components we need (tree-shaking)
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip
);

/**
 * Format ISO date string to "Week of M/D" format
 */
function formatWeekLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `Week of ${month}/${day}`;
}

/**
 * Create weekly bar chart
 * @param canvas Canvas element to render chart on
 * @param data Array of weekly stats (will display last 12 weeks)
 * @returns Chart instance
 */
export function createWeeklyBarChart(
  canvas: HTMLCanvasElement,
  data: WeeklyStats[]
): Chart {
  // Limit to last 12 weeks
  const recentData = data.length > 12 ? data.slice(-12) : data;

  const labels = recentData.map(week => formatWeekLabel(week.weekStartISO));
  const distances = recentData.map(week => week.totalKm);

  const config: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Weekly Distance (km)',
          data: distances,
          backgroundColor: 'rgba(252, 76, 2, 0.8)', // Strava orange
          borderColor: 'rgba(252, 76, 2, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Distance (km)'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Weekly Running Distance'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              if (value === null || value === undefined) {
                return 'Distance: 0.0 km';
              }
              return `Distance: ${value.toFixed(1)} km`;
            }
          }
        }
      }
    }
  };

  return new Chart(canvas, config);
}
