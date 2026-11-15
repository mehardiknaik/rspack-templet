/**
 * Rspack loader: compiles Sass/SCSS to CSS with `sass-embedded` (native Dart Sass, faster than the JS build).
 * The result is handled by Rspack's native CSS support (`type: 'css'` / `'css/module'`).
 */
const { pathToFileURL, fileURLToPath } = require('url');
const sass = require('sass-embedded');

module.exports = function sassLoader(contents) {
  const callback = this.async();
  const useSourceMap = Boolean(this.sourceMap);
  const syntax = this.resourcePath.endsWith('.sass') ? 'indented' : this.resourcePath.endsWith('.css') ? 'css' : 'scss';

  sass
    .compileStringAsync(contents, {
      syntax,
      url: pathToFileURL(this.resourcePath),
      sourceMap: useSourceMap,
      sourceMapIncludeSources: useSourceMap,
      importers: [new sass.NodePackageImporter()]
    })
    .then(
      (result) => {
        for (const url of result.loadedUrls) {
          if (url.protocol === 'file:') this.addDependency(fileURLToPath(url));
        }
        callback(null, result.css, result.sourceMap ? JSON.stringify(result.sourceMap) : undefined);
      },
      (error) => callback(error)
    );
};
