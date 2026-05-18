const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, '.tmp-analysis-smoke');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const smokeEntries = [
  path.join(root, 'src', 'services', 'analysis', 'contractAnalysis.smoke.ts'),
  path.join(root, 'src', 'services', 'analysis', 'fileTextExtraction.smoke.ts'),
  path.join(root, 'src', 'services', 'analysis', 'localContractAnalyzer.smoke.ts'),
];
const supportEntries = [
  path.join(root, 'src', 'services', 'analysis', 'contractAnalysis.ts'),
  path.join(root, 'src', 'services', 'analysis', 'fileTextExtraction.ts'),
  path.join(root, 'src', 'services', 'analysis', 'localContractAnalyzer.ts'),
  path.join(root, 'src', 'services', 'analysis', 'textNormalization.ts'),
  path.join(root, 'src', 'dto', 'api.dto.ts'),
  path.join(root, 'src', 'i18n', 'types.ts'),
  path.join(root, 'src', 'components', 'report', 'reportText.ts'),
];
const compiledEntries = smokeEntries.map((entryPath) =>
  path.join(outputDir, 'services', 'analysis', path.basename(entryPath, '.ts') + '.js'),
);

const run = (command, args) => {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
};

fs.rmSync(outputDir, { recursive: true, force: true });

try {
  run(process.execPath, [
    tscBin,
    '--outDir',
    outputDir,
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--target',
    'ES2020',
    '--jsx',
    'react',
    '--esModuleInterop',
    '--skipLibCheck',
    '--noEmit',
    'false',
    ...smokeEntries,
    ...supportEntries,
  ]);

  for (const compiledEntry of compiledEntries) {
    run(process.execPath, [compiledEntry]);
  }
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
