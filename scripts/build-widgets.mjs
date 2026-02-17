/**
 * Build script for multiple widget IIFE bundles
 * Programmatically builds each widget entry point separately
 */

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const widgets = [
  {
    name: 'stats-card',
    entry: resolve(__dirname, '../src/widgets/stats-card/index.ts'),
    globalName: 'StatsCard',
    isMapWidget: false
  },
  {
    name: 'comparison-chart',
    entry: resolve(__dirname, '../src/widgets/comparison-chart/index.ts'),
    globalName: 'ComparisonChart',
    isMapWidget: false
  },
  {
    name: 'streak-widget',
    entry: resolve(__dirname, '../src/widgets/streak-widget/index.ts'),
    globalName: 'StreakWidget',
    isMapWidget: false
  },
  {
    name: 'geo-stats-widget',
    entry: resolve(__dirname, '../src/widgets/geo-stats-widget/index.ts'),
    globalName: 'GeoStatsWidget',
    isMapWidget: false
  },
  {
    name: 'geo-table-widget',
    entry: resolve(__dirname, '../src/widgets/geo-table-widget/index.ts'),
    globalName: 'GeoTableWidget',
    isMapWidget: false
  },
  {
    name: 'map-test',
    entry: resolve(__dirname, '../src/widgets/map-test-widget/index.ts'),
    globalName: 'MapTestWidget',
    isMapWidget: true
  }
];

async function buildWidget(widget, index) {
  console.log(`Building ${widget.name}...`);

  // Use a unique temporary output directory for each widget
  const tempOutDir = `dist/widgets-temp-${index}`;

  const config = {
    build: {
      lib: {
        entry: widget.entry,
        name: widget.globalName,
        fileName: widget.name,
        formats: ['iife']
      },
      outDir: tempOutDir,
      emptyDir: true,
      rollupOptions: {
        external: widget.isMapWidget ? ['leaflet'] : [],
        output: {
          inlineDynamicImports: true,
          globals: widget.isMapWidget ? { 'leaflet': 'L' } : {}
        }
      },
      target: 'es2020',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false // Keep console.error for widget debugging
        }
      }
    },
    plugins: widget.isMapWidget ? [cssInjectedByJsPlugin()] : [],
    logLevel: 'warn'
  };

  await build(config);

  // Copy the built file to the final widgets directory
  mkdirSync('dist/widgets', { recursive: true });
  const files = readdirSync(tempOutDir);
  const jsFile = files.find(f => f.endsWith('.js'));
  if (jsFile) {
    copyFileSync(
      resolve(tempOutDir, jsFile),
      resolve('dist/widgets', jsFile)
    );
  }

  console.log(`✓ Built ${widget.name}.iife.js`);
}

function copyDataFiles() {
  const dataDirs = [
    { src: 'data/stats', dest: 'dist/widgets/data/stats' },
    { src: 'data/geo', dest: 'dist/widgets/data/geo' },
    { src: 'data/routes', dest: 'dist/widgets/data/routes' }
  ];

  for (const { src, dest } of dataDirs) {
    if (!existsSync(src)) continue;
    mkdirSync(dest, { recursive: true });
    for (const file of readdirSync(src)) {
      if (file.endsWith('.json')) {
        copyFileSync(resolve(src, file), resolve(dest, file));
      }
    }
    console.log(`✓ Copied ${src}/*.json → ${dest}/`);
  }
}

async function buildAllWidgets() {
  console.log('Building widget library...\n');

  for (let i = 0; i < widgets.length; i++) {
    await buildWidget(widgets[i], i);
  }

  // Copy data JSON files into dist/widgets so they're deployed to GitHub Pages
  copyDataFiles();

  console.log('\nWidget library build complete!');
  console.log('Output: dist/widgets/');
}

buildAllWidgets().catch(error => {
  console.error('Widget build failed:', error);
  process.exit(1);
});
