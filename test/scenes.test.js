import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  HIGH_CONSUMPTION_TRIGGER,
  NEW_READING_TRIGGER,
  resetMeterStates,
  waterMeter,
} from '../src/devices/waterMeter.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { normalizeConfig } from '../src/config.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

const reading = (total, period = 9, extra = {}) =>
  normalizeConfig({
    manual_total_m3: total,
    manual_period_m3: period,
    manual_period_days: 30,
    ...extra,
  });

beforeEach(() => resetMeterStates());

function assertDeclaredData(event) {
  const trigger = declarationOf('scene_triggers', event.key);
  const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
  for (const [key, value] of Object.entries(event.data)) {
    assert.ok(declared.includes(key), `data.${key} is not declared, the core would drop it`);
    assert.ok(value === null || typeof value !== 'object', `data.${key} must be a primitive`);
  }
}

test('new_reading fires when the index changes, never on the first read', async () => {
  const gladys = createFakeGladys();
  await waterMeter.onPoll(gladys, reading(100));
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first read is the baseline');

  await waterMeter.onPoll(gladys, reading(100));
  assert.equal(gladys.fake.sceneEvents.length, 0, 'an unchanged index fires nothing');

  await waterMeter.onPoll(gladys, reading(101.25));
  const [event] = gladys.fake.sceneEvents;
  assert.equal(event.key, NEW_READING_TRIGGER);
  assert.equal(event.data.total_m3, 101.25);
  assert.equal(event.data.delta_m3, 1.25);
  assert.equal(event.data.device, waterMeter.deviceExternalId(gladys, reading(0)));
  assertDeclaredData(event);
});

test('high_consumption fires once per crossing of the threshold', async () => {
  const gladys = createFakeGladys();
  const alert = { daily_alert_liters: 250 };
  const highEvents = () =>
    gladys.fake.sceneEvents.filter((event) => event.key === HIGH_CONSUMPTION_TRIGGER);

  await waterMeter.onPoll(gladys, reading(100, 6, alert)); // 200 L/day
  assert.equal(highEvents().length, 0);
  await waterMeter.onPoll(gladys, reading(100, 9, alert)); // 300 L/day
  await waterMeter.onPoll(gladys, reading(100, 12, alert)); // still above
  assert.equal(highEvents().length, 1);
  assert.equal(highEvents()[0].data.daily_average_liters, 300);
  assert.equal(highEvents()[0].data.threshold_liters, 250);
  assertDeclaredData(highEvents()[0]);

  await waterMeter.onPoll(gladys, reading(100, 3, alert)); // back below
  await waterMeter.onPoll(gladys, reading(100, 9, alert)); // above again
  assert.equal(highEvents().length, 2);
});

test('a zero threshold disables the alert', async () => {
  const gladys = createFakeGladys();
  await waterMeter.onPoll(gladys, reading(100, 90));
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('refresh_reading returns the declared outputs and fires no scene event', async () => {
  const gladys = createFakeGladys();
  await waterMeter.onPoll(gladys, reading(100));
  const outputs = await SCENE_ACTIONS.refresh_reading(gladys, {
    fields: {},
    config: reading(105, 9, { daily_alert_liters: 250 }),
  });

  assert.deepEqual(outputs, {
    total_m3: 105,
    period_m3: 9,
    daily_average_liters: 300,
    above_threshold: true,
  });
  assert.equal(gladys.fake.sceneEvents.length, 0, 'no event from a received action');
  const declared = keysOf(declarationOf('scene_actions', 'refresh_reading').outputs);
  assert.deepEqual(Object.keys(outputs).sort(), [...declared].sort());
});

test('refresh_reading fails the action when the source cannot be read', async () => {
  await assert.rejects(
    SCENE_ACTIONS.refresh_reading(createFakeGladys(), {
      fields: {},
      config: normalizeConfig({ source_type: 'api' }),
    }),
    /API URL is required/,
  );
});
