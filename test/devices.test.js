import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  findBlueprintByDevice,
} from '../src/devices/index.js';
import { normalizeConfig } from '../src/config.js';
import { waterMeter } from '../src/devices/waterMeter.js';
import { createFakeGladys } from './helpers/fakeGladys.js';

const config = normalizeConfig({
  meter_id: 'swde-001',
  meter_label: 'Compteur SWDE cuisine',
  manual_total_m3: 245.7,
  manual_period_m3: 9,
  manual_period_days: 30,
});

test('the SWDE registry contains a single pollable water meter', () => {
  assert.deepEqual(DEVICE_BLUEPRINTS, [waterMeter]);
  assert.equal(typeof waterMeter.deviceExternalId, 'function');
  assert.equal(typeof waterMeter.buildDevice, 'function');
  assert.equal(typeof waterMeter.onPoll, 'function');
});

test('the discovered water meter exposes historical volume indicators', () => {
  const gladys = createFakeGladys();
  const [device] = buildDiscoveredDevices(gladys, config);

  assert.equal(device.name, 'Compteur SWDE cuisine');
  assert.equal(device.poll_frequency, 3600);
  assert.equal(device.features.length, 3);
  for (const feature of device.features) {
    assert.equal(feature.category, DEVICE_FEATURE_CATEGORIES.VOLUME_SENSOR);
    assert.equal(feature.type, DEVICE_FEATURE_TYPES.SENSOR.DECIMAL);
    assert.equal(feature.read_only, true);
    assert.equal(feature.keep_history, true);
  }
  assert.equal(device.features[0].unit, DEVICE_FEATURE_UNITS.CUBIC_METER);
  assert.equal(device.features[1].unit, DEVICE_FEATURE_UNITS.CUBIC_METER);
  assert.equal(device.features[2].unit, DEVICE_FEATURE_UNITS.LITER);
});

test('meter identifiers produce stable, distinct Gladys external ids', () => {
  const gladys = createFakeGladys();
  const first = waterMeter.deviceExternalId(gladys, config);
  const second = waterMeter.deviceExternalId(gladys, normalizeConfig({ meter_id: 'swde-002' }));

  assert.equal(first, waterMeter.deviceExternalId(gladys, config));
  assert.notEqual(first, second);
});

test('findBlueprintByDevice routes the configured meter and rejects unknown devices', () => {
  const gladys = createFakeGladys();
  const externalId = waterMeter.deviceExternalId(gladys, config);

  assert.equal(findBlueprintByDevice(gladys, { external_id: externalId }, config), waterMeter);
  assert.equal(findBlueprintByDevice(gladys, { external_id: 'unknown' }, config), undefined);
});

test('manual polling publishes total, period and daily-average consumption', async () => {
  const gladys = createFakeGladys();
  await waterMeter.onPoll(gladys, config);

  assert.deepEqual(gladys.published, [
    { featureExternalId: 'swde-water-meter:swde-001:total-m3', state: 245.7 },
    { featureExternalId: 'swde-water-meter:swde-001:period-m3', state: 9 },
    { featureExternalId: 'swde-water-meter:swde-001:daily-average-liters', state: 300 },
  ]);
  assert.deepEqual(gladys.connectionStatuses, [{ connected: true, message: undefined }]);
});

test('the data-source action reports a bilingual success message', async () => {
  const message = await waterMeter.actions.test_data_source(createFakeGladys(), { config });

  assert.match(message.en, /245\.7/);
  assert.match(message.fr, /245\.7/);
});

test('unchanged readings do not create redundant dashboard history', async () => {
  const gladys = createFakeGladys();
  const unchangedConfig = normalizeConfig({
    meter_id: 'swde-history-check',
    manual_total_m3: 10,
    manual_period_m3: 1,
    manual_period_days: 2,
  });

  await waterMeter.onPoll(gladys, unchangedConfig);
  const afterFirstPoll = gladys.published.length;
  await waterMeter.onPoll(gladys, unchangedConfig);

  assert.equal(afterFirstPoll, 3);
  assert.equal(gladys.published.length, afterFirstPoll);
});
