const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');

execFileSync(process.execPath, [expoCli, 'config', '--type', 'public'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
