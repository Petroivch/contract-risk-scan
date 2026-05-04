const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

const loadResource = (language) => {
  const filePath = path.join(root, 'src', 'i18n', 'resources', `${language}.ts`);
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const context = {
    exports: {},
    require,
    module: { exports: {} },
  };

  vm.runInNewContext(compiled, context, { filename: filePath });
  return context.exports[language];
};

const flattenKeys = (value, prefix = '') => {
  if (!value || typeof value !== 'object') {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

const getByPath = (value, keyPath) =>
  keyPath.split('.').reduce((current, key) => current?.[key], value);

const en = loadResource('en');
const it = loadResource('it');
const fr = loadResource('fr');
const enKeys = flattenKeys(en);

for (const [language, resource] of [
  ['it', it],
  ['fr', fr],
]) {
  const missing = enKeys.filter((key) => getByPath(resource, key) === undefined);
  assert.deepEqual(missing, [], `${language} is missing mobile translation keys`);

  const serialized = JSON.stringify(resource);
  assert.equal(
    /scanned pdf/i.test(serialized),
    false,
    `${language} contains untranslated "scanned PDF" text`,
  );
}

console.log('i18n smoke passed');
