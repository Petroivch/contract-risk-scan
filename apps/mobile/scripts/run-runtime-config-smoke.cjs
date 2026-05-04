const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_EXTRA,
  buildExpoConfig,
  resolveRuntimeExtra,
  validateRuntimeExtra,
} = require('../app.config.shared.cjs');

const withEnv = (patch, callback) => {
  const previous = {};

  for (const key of Object.keys(patch)) {
    previous[key] = process.env[key];

    if (patch[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = patch[key];
    }
  }

  try {
    return callback();
  } finally {
    for (const key of Object.keys(patch)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
};

withEnv(
  {
    API_BASE_URL: undefined,
    EXPO_PUBLIC_API_BASE_URL: undefined,
    API_TRANSPORT: undefined,
    EXPO_PUBLIC_API_TRANSPORT: undefined,
    MAX_UPLOAD_FILE_MB: undefined,
    EXPO_PUBLIC_MAX_UPLOAD_FILE_MB: undefined,
    ENABLE_FILE_CACHE: undefined,
    EXPO_PUBLIC_ENABLE_FILE_CACHE: undefined,
  },
  () => {
    const extra = resolveRuntimeExtra();

    assert.equal(extra.API_TRANSPORT, 'http');
    assert.equal(extra.API_BASE_URL, '');
    assert.equal(extra.MAX_UPLOAD_FILE_MB, DEFAULT_EXTRA.MAX_UPLOAD_FILE_MB);
    assert.equal(extra.ENABLE_FILE_CACHE, false);
    assert.throws(
      () => validateRuntimeExtra(extra),
      /API_TRANSPORT=http requires API_BASE_URL/,
    );
    assert.throws(
      () => buildExpoConfig(),
      /API_TRANSPORT=http requires API_BASE_URL/,
    );
  },
);

withEnv(
  {
    EXPO_PUBLIC_API_BASE_URL: 'http://192.168.0.5:3000/api/v1/',
    EXPO_PUBLIC_API_TRANSPORT: 'http',
    EXPO_PUBLIC_MAX_UPLOAD_FILE_MB: '24',
    EXPO_PUBLIC_ENABLE_FILE_CACHE: 'true',
  },
  () => {
    const extra = resolveRuntimeExtra();

    assert.equal(extra.API_BASE_URL, 'http://192.168.0.5:3000/api/v1/');
    assert.equal(extra.API_TRANSPORT, 'http');
    assert.equal(extra.MAX_UPLOAD_FILE_MB, 24);
    assert.equal(extra.ENABLE_FILE_CACHE, true);
    assert.doesNotThrow(() => validateRuntimeExtra(extra));
  },
);

withEnv(
  {
    API_BASE_URL: undefined,
    EXPO_PUBLIC_API_BASE_URL: undefined,
    API_TRANSPORT: 'local',
    EXPO_PUBLIC_API_TRANSPORT: undefined,
  },
  () => {
    const extra = buildExpoConfig().extra;

    assert.equal(extra.API_BASE_URL, '');
    assert.equal(extra.API_TRANSPORT, 'local');
    assert.doesNotThrow(() => validateRuntimeExtra(extra));
  },
);

withEnv(
  {
    API_BASE_URL: 'http://10.0.2.2:3000/api/v1/',
    EXPO_PUBLIC_API_BASE_URL: 'http://192.168.0.5:3000/api/v1/',
    API_TRANSPORT: 'http',
    EXPO_PUBLIC_API_TRANSPORT: 'local',
  },
  () => {
    const extra = buildExpoConfig().extra;

    assert.equal(extra.API_BASE_URL, 'http://10.0.2.2:3000/api/v1/');
    assert.equal(extra.API_TRANSPORT, 'http');
  },
);

const readJsonRuntimeConfig = (content, sourceLabel) => {
  const parsed = JSON.parse(content);
  const extra = parsed.expo?.extra ?? parsed.extra ?? parsed;

  assert.ok(
    extra && typeof extra === 'object',
    `${sourceLabel} does not contain runtime extra config`,
  );
  validateRuntimeExtra(extra);
};

const collectRuntimeConfigFiles = () => {
  const buildRoot = path.join(__dirname, '..', 'android', 'app', 'build');
  const output = [];
  const visit = (dir) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name === 'app.config') {
        output.push(fullPath);
      }
    }
  };

  visit(buildRoot);
  return output;
};

const collectApkPaths = () => {
  const apkPaths = [];
  const explicitPath = process.env.CONTRACT_RISK_APK_PATH?.trim();
  if (explicitPath) {
    apkPaths.push(path.resolve(explicitPath));
  }

  const apkRoot = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk');
  const visit = (dir) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.apk')) {
        apkPaths.push(fullPath);
      }
    }
  };

  visit(apkRoot);
  return Array.from(new Set(apkPaths));
};

const inspectApkRuntimeConfig = async (apkPath) => {
  let JSZip;
  try {
    JSZip = require('jszip');
  } catch (error) {
    throw new Error(
      `APK runtime config inspection requires the jszip package when APK files are present. Run npm install in apps/mobile or remove stale APK outputs. Original error: ${error.message}`,
    );
  }

  const archive = await JSZip.loadAsync(fs.readFileSync(apkPath));
  const appConfigEntry = archive.file('assets/app.config');

  assert.ok(appConfigEntry, `${apkPath} is missing assets/app.config`);
  readJsonRuntimeConfig(await appConfigEntry.async('string'), apkPath);
};

const inspectBuiltRuntimeOutput = async () => {
  for (const configPath of collectRuntimeConfigFiles()) {
    readJsonRuntimeConfig(fs.readFileSync(configPath, 'utf8'), configPath);
  }

  const apkPaths = collectApkPaths();
  if (process.env.CONTRACT_RISK_REQUIRE_APK_CONFIG === '1') {
    assert.ok(apkPaths.length > 0, 'No APK found for assets/app.config smoke inspection');
  }

  for (const apkPath of apkPaths) {
    await inspectApkRuntimeConfig(apkPath);
  }
};

inspectBuiltRuntimeOutput()
  .then(() => {
    console.log('runtime config smoke passed');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
