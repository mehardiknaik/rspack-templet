import path from 'path';
import JavaScriptObfuscator, { ObfuscatorOptions } from 'javascript-obfuscator';
import type { Compiler, RspackPluginInstance } from '@rspack/core';

/**
 * Obfuscates emitted JS chunk files, skipping files that match any of the `excludes` globs.
 */
class ObfuscatorRspackPlugin implements RspackPluginInstance {
  private static readonly allowedExtensions = ['.js', '.mjs'];
  private static readonly baseIdentifiersPrefix = 'a';

  constructor(
    private readonly options: ObfuscatorOptions = {},
    private readonly excludes: string[] = []
  ) {}

  apply(compiler: Compiler) {
    const pluginName = 'ObfuscatorRspackPlugin';
    const { Compilation, sources } = compiler.rspack;

    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: pluginName, stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING },
        () => {
          let identifiersPrefixCounter = 0;

          for (const chunk of compilation.chunks) {
            for (const fileName of chunk.files) {
              const lower = fileName.toLowerCase();
              const isJs = ObfuscatorRspackPlugin.allowedExtensions.some((ext) => lower.endsWith(ext));
              if (!isJs || this.shouldExclude(fileName)) continue;

              const asset = compilation.getAsset(fileName);
              if (!asset) continue;

              const result = JavaScriptObfuscator.obfuscate(asset.source.source().toString(), {
                identifiersPrefix: `${ObfuscatorRspackPlugin.baseIdentifiersPrefix}${identifiersPrefixCounter}`,
                inputFileName: fileName,
                ...this.options
              });

              compilation.updateAsset(fileName, new sources.RawSource(result.getObfuscatedCode()));
              identifiersPrefixCounter++;
            }
          }
        }
      );
    });
  }

  private shouldExclude(filePath: string) {
    return this.excludes.some((pattern) => path.matchesGlob(filePath, pattern));
  }
}

export default ObfuscatorRspackPlugin;
