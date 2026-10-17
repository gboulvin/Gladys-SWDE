import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  buildTransportEntries,
  createPoller,
  findBlueprintByDevice,
} from '../src/devices/index.js';
import { normalizeConfig } from '../src/config.js';
import { FEATURE, resetMeterStates, waterMeter } from '../src/devices/waterMeter.js';

const config = normalizeConfig({
  meter_id: 'swde-001',
  meter_label: 'Compteur SWDE cuisine',
  manual_total_m3: 245.7,
  manual_period_m3: 9,
  manual_period_days: 30,
});

beforeEach(() => resetMeterStates());

const stateOf = (gladys, key) =>
  gladys.fake.states.filter(
    (entry) =>
      entry.device_feature_external_id ===
      gladys.externalIds('swde-water-meter', 'swde-001').feature(key),
  );

test('the SWDE registry contains a single pollable water meter', () => {
  assert.deepEqual(DEVICE_BLUEPRINTS, [waterMeter]);
  assert.equal(typeof waterMeter.onPoll, 'function');
});

test('the discovered water meter is accepted by Gladys and polled every minute', async () => {
  const gladys = createFakeGladys();
  // The fake Gladys refuses the payloads the real one refuses.
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
  const [device] = gladys.fake.discoveredDevices;

  assert.equal(device.name, 'Compteur SWDE cuisine');
  assert.equal(device.should_poll, true);
  assert.equal(device.poll_frequency, DEVICE_POLL_FREQUENCIES.EVERY_MINUTES);
  assert.equal(device.features.length, 3);
  for (const feature of device.features) {
    assert.equal(feature.category, DEVICE_FEATURE_CATEGORIES.VOLUME_SENSOR);
    assert.equal(feature.type, DEVICE_FEATURE_TYPES.SENSOR.DECIMAL);
    assert.equal(feature.read_only, true);
    assert.equal(feature.keep_history, true);
  }
  assert.deepEqual(
    device.features.map((feature) => feature.unit),
    [
      DEVICE_FEATURE_UNITS.CUBIC_METER,
      DEVICE_FEATURE_UNITS.CUBIC_METER,
      DEVICE_FEATURE_UNITS.LITER,
    ],
  );
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
  const reading = await waterMeter.onPoll(gladys, config);

  assert.equal(reading.daily_average_liters, 300);
  assert.deepEqual(
    stateOf(gladys, FEATURE.TOTAL_M3).map((s) => s.state),
    [245.7],
  );
  assert.deepEqual(
    stateOf(gladys, FEATURE.PERIOD_M3).map((s) => s.state),
    [9],
  );
  assert.deepEqual(
    stateOf(gladys, FEATURE.DAILY_AVERAGE_LITERS).map((s) => s.state),
    [300],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('unchanged readings do not create redundant dashboard history', async () => {
  const gladys = createFakeGladys();
  await waterMeter.onPoll(gladys, config);
  const afterFirstPoll = gladys.fake.states.length;
  await waterMeter.onPoll(gladys, config);

  assert.equal(afterFirstPoll, 3);
  assert.equal(gladys.fake.states.length, afterFirstPoll);
});

test('the data-source action reports a message in every language', async () => {
  const message = await waterMeter.actions.test_data_source(createFakeGladys(), { config });

  for (const language of ['en', 'fr', 'de', 'es']) {
    assert.match(message[language], /245\.7/);
    assert.match(message[language], /300/);
  }
});

test('the poller reads at the configured interval, not at every Gladys poll', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const gladys = createFakeGladys();
  const pollDevice = createPoller();
  const device = { external_id: waterMeter.deviceExternalId(gladys, config) };

  assert.equal(await pollDevice(gladys, device, config), true);
  t.mock.timers.tick(60_000);
  assert.equal(await pollDevice(gladys, device, config), false);
  t.mock.timers.tick(config.poll_frequency * 1000);
  assert.equal(await pollDevice(gladys, device, config), true);
  assert.equal(await pollDevice(gladys, { external_id: 'unknown' }, config), false);
});

test('the transport badge follows the source, and a failed read is unreachable', async () => {
  const gladys = createFakeGladys();
  const [manual] = buildTransportEntries(gladys, config);
  assert.equal(manual.transport, 'local');

  const lan = normalizeConfig({ source_type: 'api', api_url: 'http://192.168.1.20/water.json' });
  assert.equal(buildTransportEntries(gladys, lan)[0].transport, 'local');

  const cloud = normalizeConfig({ source_type: 'api', api_url: 'https://api.example.org/water' });
  assert.equal(buildTransportEntries(gladys, cloud)[0].transport, 'cloud');

  const broken = normalizeConfig({ source_type: 'api', meter_id: 'broken' });
  await assert.rejects(waterMeter.onPoll(gladys, broken), /API URL is required/);
  const entries = buildTransportEntries(gladys, broken);
  assert.equal(entries[0].transport, 'unreachable');
  await gladys.publishTransports(entries);
  assert.equal(gladys.fake.transports.at(-1).transport, 'unreachable');
});
