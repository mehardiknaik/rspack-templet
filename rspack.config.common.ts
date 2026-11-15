import { rspack, Configuration, SwcLoaderOptions } from '@rspack/core';
import ConfigRspackPlugin from './scripts/ConfigRspackPlugin';
import fs from 'fs';
import path from 'path';
import pkg from './package.json';
import './scripts/loadEnv';

/**
 * Expose env vars (from .env, .env.defaults and the shell) as `process.env.KEY` at build time.
 * NODE_ENV is left to Rspack's `mode`.
 */
const envDefinitions = Object.fromEntries(
  Object.entries(process.env)
    .filter(([key]) => key !== 'NODE_ENV' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
);

/**
 * Browser targets. Keeps the output runnable on Chrome 49.
 */
export const BROWSER_TARGETS = ['chrome >= 49', 'firefox >= 52', 'safari >= 10', 'edge >= 14'];

/**
 * App source: transpile + core-js polyfills on usage + shared helpers from `@swc/helpers`.
 * In dev: React Fast Refresh + React dev-mode JSX (component file/line in warnings).
 */
export const srcSwcOptions = (syntax: 'typescript' | 'ecmascript', isDev = false): SwcLoaderOptions => ({
  jsc: {
    parser: syntax === 'typescript' ? { syntax: 'typescript', tsx: true } : { syntax: 'ecmascript', jsx: true },
    transform: {
      react: { runtime: 'automatic', development: isDev, refresh: isDev }
    },
    externalHelpers: true
  },
  env: {
    targets: BROWSER_TARGETS,
    mode: 'usage',
    coreJs: '3.49'
  },
  // App files are ES modules: polyfills are injected as `import`, never `require`.
  isModule: true
});

/** Prefixes + down-levels CSS for BROWSER_TARGETS. Runs after Sass (loaders run right to left). */
export const cssLoaders = [
  { loader: 'builtin:lightningcss-loader', options: { targets: BROWSER_TARGETS } },
  { loader: path.resolve(__dirname, 'scripts/sass-loader.cjs') }
];

/** Files that invalidate the persistent cache when changed. */
const cacheBuildDependencies = [
  __filename,
  path.resolve(__dirname, 'rspack.config.dev.ts'),
  path.resolve(__dirname, 'rspack.config.prod.ts'),
  path.resolve(__dirname, 'package-lock.json'),
  ...fs.readdirSync(path.resolve(__dirname, 'scripts')).map((file) => path.resolve(__dirname, 'scripts', file)),
  ...['.env', '.env.defaults', '.env.example']
    .map((file) => path.resolve(__dirname, file))
    .filter((file) => fs.existsSync(file))
];

const createCommonConfig = ({ isDev }: { isDev: boolean }): Configuration => ({
  entry: { app: './src/index.tsx' },
  target: ['web', 'es5'],
  // Persistent cache: survives restarts (node_modules/.cache/rspack), separate per mode.
  cache: {
    type: 'persistent',
    buildDependencies: cacheBuildDependencies
  },
  experiments: {
    // Rust file watcher: faster change detection than the Node one.
    nativeWatcher: true
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/i,
        include: path.resolve(__dirname, 'src'),
        loader: 'builtin:swc-loader',
        options: srcSwcOptions('typescript', isDev),
        type: 'javascript/auto'
      },
      {
        test: /\.(js|jsx|mjs|cjs)$/i,
        include: path.resolve(__dirname, 'src'),
        loader: 'builtin:swc-loader',
        options: srcSwcOptions('ecmascript', isDev),
        type: 'javascript/auto'
      },
      {
        // Down-level third-party code too (no polyfill injection).
        test: /\.(js|mjs|cjs)$/i,
        include: /[\\/]node_modules[\\/]/,
        exclude: /[\\/]node_modules[\\/]core-js[\\/]/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: { parser: { syntax: 'ecmascript' } },
          env: { targets: BROWSER_TARGETS },
          isModule: 'unknown'
        } satisfies SwcLoaderOptions
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 10000,
      cacheGroups: {
        common: {
          chunks: 'all',
          minChunks: 2,
          priority: -10,
          reuseExistingChunk: true,
          enforce: true
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true,
          name(module) {
            const match = module?.context?.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);

            const packageName = match?.[1]?.replace('@', '');

            return `npm.${packageName}`;
          }
        }
      }
    }
  },

  plugins: [
    new rspack.HtmlRspackPlugin({
      template: './src/index.html',
      inject: true,
      templateParameters: {
        __BUILD_DATE__: new Date().toISOString(),
        title: pkg.name
      },
      meta: {
        // Basic SEO
        siteName: pkg.name,
        title: pkg.name,
        description: pkg.description,

        // Mobile and browser
        viewport: 'width=device-width, initial-scale=1.0',
        'theme-color': '#00D09C',
        'color-scheme': 'light',
        'application-name': pkg.name,

        // Icons
        favicon: 'react.svg',

        // Additional metadata
        language: 'en',
        charset: 'UTF-8'
      },
      minify: true
    }),
    new rspack.ProvidePlugin({
      React: 'react'
    }),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: 'public' }]
    }),
    new rspack.DefinePlugin(envDefinitions),
    new rspack.ProgressPlugin(),
    // Warn (don't fail) on circular imports in app code.
    new rspack.CircularDependencyRspackPlugin({
      failOnError: false,
      exclude: /node_modules/
    }),
    new ConfigRspackPlugin({
      input: './src/config.ts',
      outputFileName: 'config.js'
    })
  ]
});

export default createCommonConfig;
