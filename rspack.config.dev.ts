import path from 'path';
import { rspack, Configuration } from '@rspack/core';
import createCommonConfig, { cssLoaders, srcSwcOptions } from './rspack.config.common';
import { merge } from 'rspack-merge';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh';
import pkg from './package.json';

const config: Configuration = {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: '[path][name].[hash:5][ext]'
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        oneOf: [
          // 1. Force inline as base64 data URI (?inline)
          {
            resourceQuery: /inline/,
            type: 'asset/inline'
          },
          // 2. Import raw source code as a string (?raw)
          {
            resourceQuery: /raw/,
            type: 'asset/source'
          },
          // 3. Force separate file URL, bypassing size limit (?url or ?no-inline)
          {
            resourceQuery: /(url|no-inline)/,
            type: 'asset/resource',
            generator: {
              filename: '[path][name].[hash:5][ext]'
            }
          },
          // 4. Import SVGs as React components (?react) - see scripts/svgr-loader.cjs
          {
            test: /\.svg$/i,
            resourceQuery: /react/,
            type: 'javascript/auto',
            use: [
              { loader: 'builtin:swc-loader', options: srcSwcOptions('ecmascript', true) },
              { loader: path.resolve(__dirname, 'scripts/svgr-loader.cjs') }
            ]
          },
          // 5. Default fallback: auto-inline if smaller than 4KB, otherwise emit file
          {
            type: 'asset',
            parser: {
              dataUrlCondition: {
                maxSize: 4 * 1024 // 4 KiB (matches Vite's default)
              }
            },
            generator: {
              filename: '[path][name].[hash:5][ext]'
            }
          }
        ]
      },
      {
        test: /\.module\.(css|s[ac]ss)$/,
        use: cssLoaders,
        type: 'css/module',
        parser: {
          namedExports: false
        },
        generator: {
          localIdentName: '[name]__[local]___[hash:5]',
          exportsConvention: 'camel-case'
        }
      },
      {
        test: /\.(css|s[ac]ss)$/,
        use: cssLoaders,
        exclude: /\.module\.(css|scss)$/,
        type: 'css'
      }
    ]
  },
  plugins: [
    new rspack.DefinePlugin({
      __DEV__: JSON.stringify(true),
      __PROD__: JSON.stringify(false),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __VERSION__: JSON.stringify(pkg.version)
    }),
    codeInspectorPlugin({
      bundler: 'rspack'
    }),
    // React Fast Refresh: edits keep component state.
    new ReactRefreshRspackPlugin()
  ],
  // Faster than 'eval-source-map'; keeps original lines (no column precision).
  devtool: 'eval-cheap-module-source-map',
  devServer: {
    historyApiFallback: true,
    port: 3000,
    open: true,
    hot: true
  }
};

export default merge(createCommonConfig({ isDev: true }), config);
