import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('normalizeConfig returns SWDE defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig accepts the authorised API source and trims text fields', () => {
  const config = normalizeConfig({
    source_type: 'api',
    meter_id: '  1234  ',
    meter_label: '  Compteur cave  ',
    api_url: ' https://example.test/reading ',
    api_token: ' token ',
  });

  assert.equal(config.source_type, 'api');
  assert.equal(config.meter_id, '1234');
  assert.equal(config.meter_label, 'Compteur cave');
  assert.equal(config.api_url, 'https://example.test/reading');
  assert.equal(config.api_token, 'token');
});

test('normalizeConfig safely coerces and bounds numeric form values', () => {
  const config = normalizeConfig({
    poll_frequency: '10',
    manual_total_m3: '42.5',
    manual_period_m3: '1.2',
    manual_period_days: '0',
  });

  assert.equal(config.poll_frequency, 300);
  assert.equal(config.manual_total_m3, 42.5);
  assert.equal(config.manual_period_m3, 1.2);
  assert.equal(config.manual_period_days, 1);
});

test('normalizeConfig rejects invalid source selections and negative readings', () => {
  const config = normalizeConfig({
    source_type: 'portal',
    manual_total_m3: '-4',
    manual_period_m3: 'not-a-number',
    manual_period_days: '-12',
    poll_frequency: 'not-a-number',
  });

  assert.equal(config.source_type, 'manual');
  assert.equal(config.manual_total_m3, DEFAULT_CONFIG.manual_total_m3);
  assert.equal(config.manual_period_m3, DEFAULT_CONFIG.manual_period_m3);
  assert.equal(config.manual_period_days, DEFAULT_CONFIG.manual_period_days);
  assert.equal(config.poll_frequency, DEFAULT_CONFIG.poll_frequency);
});
