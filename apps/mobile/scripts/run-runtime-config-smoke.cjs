const assert = require('node:assert/strict');

const {
  DEFAULT_EXTRA,
  buildExpoConfig,
  resolveRuntimeExtra,
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
    callback();
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
  },
);

withEnv(
  {
    EXPO_PUBLIC_API_BASE_URL: 'http://192.168.0.5:3000/api/v1/',
    EXPO_PUBLIC_API_TRANSPORT: 'local',
    EXPO_PUBLIC_MAX_UPLOAD_FILE_MB: '24',
    EXPO_PUBLIC_ENABLE_FILE_CACHE: 'true',
  },
  () => {
    const extra = resolveRuntimeExtra();

    assert.equal(extra.API_BASE_URL, 'http://192.168.0.5:3000/api/v1/');
    assert.equal(extra.API_TRANSPORT, 'local');
    assert.equal(extra.MAX_UPLOAD_FILE_MB, 24);
    assert.equal(extra.ENABLE_FILE_CACHE, true);
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

console.log('runtime config smoke passed');
