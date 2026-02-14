/**
 * Build script for multiple widget IIFE bundles
 * Programmatically builds each widget entry point separately
 */

import { build, InlineConfig } from 'vite';
import { resolve } from 'path';

interface WidgetConfig {
  name: string;
  entry: string;
  globalName: string;
}

const widgets: WidgetConfig[] = [
  {
    name: 'stats-card',
    entry: resolve(__dirname, '../src/widgets/stats-card/index.ts'),
    globalName: 'StatsCard'
  },
  {
    name: 'comparison-chart',
    entry: resolve(__dirname, '../src/widgets/comparison-chart/index.ts'),
    globalName: 'ComparisonChart'
  }
];

async function buildWidget(widget: WidgetConfig): Promise<void> {
  console.log(`Building ${widget.name}...`);

  const config: InlineConfig = {
    build: {
      lib: {
        entry: widget.entry,
        name: widget.globalName,
        fileName: widget.name,
        formats: ['iife']
      },
      outDir: 'dist/widgets',
      emptyDir: false, // Don't clear dist/widgets between builds
      rollupOptions: {
        external: [],
        output: {
          inlineDynamicImports: true,
          globals: {}
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
    logLevel: 'warn'
  };

  await build(config);
  console.log(`✓ Built ${widget.name}.iife.js`);
}

async function buildAllWidgets(): Promise<void> {
  console.log('Building widget library...\n');

  for (const widget of widgets) {
    await buildWidget(widget);
  }

  console.log('\nWidget library build complete!');
  console.log('Output: dist/widgets/');
}

buildAllWidgets().catch(error => {
  console.error('Widget build failed:', error);
  process.exit(1);
});
