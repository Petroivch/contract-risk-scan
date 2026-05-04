const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const expoBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'expo.cmd' : 'expo',
);

execFileSync(expoBin, ['config', '--type', 'public'], {
  cwd: root,
  env: {
    ...process.env,
    API_TRANSPORT: process.env.API_TRANSPORT || 'local',
  },
  stdio: 'inherit',
  windowsHide: true,
});
