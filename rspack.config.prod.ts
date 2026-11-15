import path from 'path';
import { rspack, Configuration } from '@rspack/core';
import { merge } from 'rspack-merge';
import createCommonConfig, { BROWSER_TARGETS, cssLoaders, srcSwcOptions } from './rspack.config.common';
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import ObfuscatorRspackPlugin from './scripts/ObfuscatorRspackPlugin';
import pkg from './package.json';
import './scripts/loadEnv';

const SEPERATE_FOLDERS = process.env.SEPERATE_FOLDERS === 'true' ? true : false;
const OBFUSCATOR = process.env.OBFUSCATOR === 'true' ? true : false;

const config: Configuration = {
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[chunkhash].js',
    chunkFilename: `${SEPERATE_FOLDERS ? 'chunk/' : ''}[name].[chunkhash].js`,
    cssFilename: '[name].[chunkhash].css',
    cssChunkFilename: `${SEPERATE_FOLDERS ? 'css/' : ''}[name].[chunkhash].css`,
    hashDigestLength: 7,
    // Required by SubresourceIntegrityPlugin for lazy-loaded chunks.
    crossOriginLoading: 'anonymous',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: `${SEPERATE_FOLDERS ? 'fonts/' : ''}[name].[hash:5][ext]`
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
              { loader: 'builtin:swc-loader', options: srcSwcOptions('ecmascript') },
              { loader: path.resolve(__dirname, 'scripts/svgr-loader.cjs') }
            ]
          },
          // 5. Default fallback: emit as separate file
          {
            type: 'asset/resource',
            generator: {
              filename: `${SEPERATE_FOLDERS ? 'images/' : ''}[name].[hash:5][ext]`
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
          localIdentName: '[hash:5]',
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
  optimization: {
    minimize: true,
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        exclude: [/config\.js$/],
        extractComments: false,
        minimizerOptions: {
          ecma: 5,
          compress: {
            ecma: 5,
            passes: 2,
            drop_debugger: true,
            dead_code: true,
            unused: true,
            keep_fargs: false,
            hoist_props: true,
            collapse_vars: true,
            reduce_vars: true
          },
          mangle: true,
          format: {
            comments: false
          }
        }
      }),
      new rspack.LightningCssMinimizerRspackPlugin({
        minimizerOptions: {
          targets: BROWSER_TARGETS
        }
      })
    ],
    usedExports: true,
    sideEffects: true,
    providedExports: true,
    innerGraph: true,
    concatenateModules: true
  },

  plugins: [
    // Adds `integrity` hashes to <script>/<link> tags and lazy chunk loads.
    new rspack.SubresourceIntegrityPlugin({
      hashFuncNames: ['sha384']
    }),
    new rspack.DefinePlugin({
      __DEV__: JSON.stringify(false),
      __PROD__: JSON.stringify(true),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __VERSION__: JSON.stringify(pkg.version),
      __REACT_DEVTOOLS_GLOBAL_HOOK__: JSON.stringify(false)
    }),
    // Static bundle-analysis report (dist/rsdoctor-report.html), no local server.
    new RsdoctorRspackPlugin({
      disableClientServer: true,
      output: { mode: 'brief' },
      linter: { level: 'Ignore' }
    }),
    OBFUSCATOR &&
    new ObfuscatorRspackPlugin(
      {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.4,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.2,
        identifierNamesGenerator: 'hexadecimal',
        rotateStringArray: true,
        selfDefending: true,
        stringArray: true,
        stringArrayThreshold: 0.75,
        stringArrayEncoding: ['rc4']
      },
      ['npm.*.js', 'config.js']
    )
  ]
};

export default merge(createCommonConfig({ isDev: false }), config);
