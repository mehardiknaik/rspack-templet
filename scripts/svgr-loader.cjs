/**
 * Rspack loader: turns an SVG file into a React component source (JSX).
 * Chain it after `builtin:swc-loader` so the JSX is compiled for the browser targets.
 *
 * Usage: `import Icon from './icon.svg?react'`
 */
const path = require('path');
const { transform } = require('@svgr/core');
const svgo = require('@svgr/plugin-svgo');
const jsx = require('@svgr/plugin-jsx');

module.exports = function svgrLoader(contents) {
  const callback = this.async();
  const options = this.getOptions() || {};

  transform(contents, options, {
    caller: { name: 'svgr-loader', defaultPlugins: [svgo, jsx] },
    filePath: path.normalize(this.resourcePath)
  }).then(
    (code) => callback(null, code),
    (error) => callback(error)
  );
};
