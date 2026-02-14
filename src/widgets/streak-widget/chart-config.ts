/**
 * Chart.js configuration for radar charts in streak widget
 * Tree-shaken imports for minimal bundle size
 */

import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TimeOfDayPattern } from '../../types/analytics.types.js';

// Register only components needed for radar charts
Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export interface RadarChartConfig {
  accentColor?: string;
  fillOpacity?: number;
}

/**
 * Create a time-of-day radar chart
 * Displays 4 data points (morning, afternoon, evening, night)
 */
export function createTimeOfDayRadarChart(
  canvas: HTMLCanvasElement,
  data: TimeOfDayPattern[],
  config: RadarChartConfig = {}
): Chart {
  const accentColor = config.accentColor || '#fc4c02'; // Strava orange
  const fillOpacity = config.fillOpacity || 0.2;

  // Extract labels and values
  const labels = data.map((d) => d.period);
  const values = data.map((d) => d.runCount);
  const kmValues = data.map((d) => d.totalKm);
  const percentages = data.map((d) => d.percentage);

  return new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: 'Runs by Time of Day',
          data: values,
          backgroundColor: `rgba(252, 76, 2, ${fillOpacity})`,
          borderColor: accentColor,
          borderWidth: 2,
          pointBackgroundColor: accentColor,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: accentColor,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.5,
      scales: {
        r: {
          beginAtZero: true, // CRITICAL: avoid pitfall 4 from research
          ticks: {
            stepSize: Math.ceil(Math.max(...values) / 5), // 5 tick marks
          },
          grid: {
            circular: true,
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const index = context.dataIndex;
              const runs = values[index];
              const km = kmValues[index].toFixed(1);
              const pct = percentages[index].toFixed(1);
              return [
                `Runs: ${runs}`,
                `Distance: ${km} km`,
                `Percentage: ${pct}%`,
              ];
            },
          },
        },
        legend: {
          display: false, // Hide legend for cleaner look
        },
      },
    },
  });
}
