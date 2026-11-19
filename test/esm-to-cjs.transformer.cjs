const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const normalized = sourceText.replace(
      /const\s+require\s*=\s*createRequire\(\s*import\.meta\.url\s*\)\s*;/g,
      '',
    );

    const { outputText } = ts.transpileModule(normalized, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2023,
        esModuleInterop: true,
        allowJs: true,
      },
    });

    return { code: outputText };
  },
};
