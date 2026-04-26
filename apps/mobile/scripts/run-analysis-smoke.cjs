const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, '.tmp-analysis-smoke');
const tscBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const smokeEntry = path.join(root, 'src', 'analysis', 'contractAnalysis.smoke.ts');
const compiledEntry = path.join(outputDir, 'analysis', 'contractAnalysis.smoke.js');

const run = (command, args) => {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
};

fs.rmSync(outputDir, { recursive: true, force: true });

try {
  run(tscBin, [
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
    smokeEntry,
  ]);

  run(process.execPath, [compiledEntry]);
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
