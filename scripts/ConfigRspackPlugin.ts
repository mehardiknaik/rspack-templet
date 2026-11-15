import ts from 'typescript';
import fs from 'fs';
import type { Compiler, RspackPluginInstance } from '@rspack/core';

interface ConfigRspackPluginOptions {
  input: string;
  outputFileName?: string;
}

/**
 * Transpiles a runtime config file (TS) to a standalone ES5 `config.js`,
 * emits it as an asset and injects it as the first `<script>` in `<head>`.
 */
class ConfigRspackPlugin implements RspackPluginInstance {
  private input: string;
  private outputFileName: string;

  constructor(options: ConfigRspackPluginOptions) {
    this.input = options.input;
    this.outputFileName = options.outputFileName || 'config.js';
  }

  apply(compiler: Compiler) {
    const { Compilation, sources, HtmlRspackPlugin } = compiler.rspack;
    const pluginName = 'ConfigRspackPlugin';
    const isDev = compiler.options.mode === 'development';

    if (isDev) {
      compiler.hooks.afterCompile.tap(pluginName, (compilation) => {
        compilation.fileDependencies.add(this.input);
      });
    }

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
        },
        () => {
          const tsCode = fs.readFileSync(this.input, 'utf-8');
          const result = ts.transpileModule(tsCode, {
            compilerOptions: {
              module: ts.ModuleKind.None,
              target: ts.ScriptTarget.ES5
            }
          });

          compilation.emitAsset(this.outputFileName, new sources.RawSource(result.outputText));
        }
      );

      const htmlHooks = HtmlRspackPlugin.getCompilationHooks(compilation);

      htmlHooks.alterAssetTagGroups.tap(pluginName, (data) => {
        data.headTags.unshift({
          tagName: 'script',
          voidTag: false,
          attributes: { src: this.outputFileName }
        });
        return data;
      });

      // config.js is meant to be edited after deploy, so it must not carry an SRI hash
      // (SubresourceIntegrityPlugin would otherwise block the edited file).
      htmlHooks.beforeEmit.tap(pluginName, (data) => {
        const src = this.outputFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        data.html = data.html.replace(new RegExp(`<script\\b[^>]*\\bsrc="${src}"[^>]*>`), `<script src="${this.outputFileName}">`);
        return data;
      });
    });
  }
}

export default ConfigRspackPlugin;
