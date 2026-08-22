import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEVICE_BLUEPRINTS } from '../src/devices/index.js';
import { DEFAULT_CONFIG } from '../src/config.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

test('the SWDE manifest action has a registered handler', () => {
  const handled = new Set(
    DEVICE_BLUEPRINTS.flatMap((blueprint) => Object.keys(blueprint.actions ?? {})),
  );
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    ['test_data_source'],
  );
  assert.ok(handled.has('test_data_source'));
});

test('catalog categories require Gladys >= 4.86.0', () => {
  assert.deepEqual(manifest.categories, ['environment']);
  assert.match(manifest.gladys_version, />=4\.86\.0/);
});

test('config-schema defaults match DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(
        DEFAULT_CONFIG[field.key],
        field.default,
        `DEFAULT_CONFIG.${field.key} must match the manifest default`,
      );
    }
  }
});

test('section fields are presentational and documentation links are HTTPS', () => {
  const sections = manifest.config_schema.filter((field) => field.type === 'section');
  assert.ok(sections.length >= 3);
  for (const section of sections) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.ok(section.label.en);
    assert.equal(DEFAULT_CONFIG[section.key], undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('the optional API token uses Gladys protected secret storage', () => {
  const apiToken = manifest.config_schema.find((field) => field.key === 'api_token');
  assert.equal(apiToken.type, 'secret');
  assert.equal(apiToken.default, undefined);
});
