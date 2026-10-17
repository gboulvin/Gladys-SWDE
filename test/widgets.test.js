import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { resetMeterStates, waterMeter } from '../src/devices/waterMeter.js';
import { WATER_CONSUMPTION_WIDGET, WIDGETS, refreshWidgets } from '../src/widgets.js';
import { normalizeConfig } from '../src/config.js';

const config = normalizeConfig({
  manual_total_m3: 245.7,
  manual_period_m3: 9,
  manual_period_days: 30,
  daily_alert_liters: 250,
});
const widget = WIDGETS[WATER_CONSUMPTION_WIDGET];

const getContent = (gladys, { cfg = config, language = 'en', settings = {} } = {}) =>
  widget.get(gladys, { settings, language, units: 'metric', config: cfg });

beforeEach(() => resetMeterStates());

test('the content is rendered exactly as sent, before and after a read, in every language', async () => {
  const gladys = createFakeGladys();
  for (const language of ['en', 'fr', 'de', 'es']) {
    assert.deepEqual(validateWidgetContent(await getContent(gladys, { language })), []);
  }
  await waterMeter.onPoll(gladys, config);
  for (const language of ['en', 'fr', 'de', 'es']) {
    assert.deepEqual(validateWidgetContent(await getContent(gladys, { language })), []);
  }
});

test('a failed read and the alert state show in the status rows', async () => {
  const gladys = createFakeGladys();
  await waterMeter.onPoll(gladys, config);
  let status = (await getContent(gladys)).components.find((c) => c.type === 'status');
  assert.ok(
    status.items.some((item) => item.color === 'warning'),
    'above threshold',
  );

  const broken = normalizeConfig({ source_type: 'api' });
  await assert.rejects(waterMeter.onPoll(gladys, broken));
  const content = await getContent(gladys, { cfg: broken });
  assert.deepEqual(validateWidgetContent(content), []);
  status = content.components.find((c) => c.type === 'status');
  assert.ok(
    status.items.some((item) => item.color === 'danger'),
    'read failure',
  );
});

test('the chart period follows the widget setting', async () => {
  const gladys = createFakeGladys();
  const chartOf = async (settings) =>
    (await getContent(gladys, { settings })).components.find((c) => c.type === 'chart');
  assert.equal((await chartOf({})).interval, 'last-three-months');
  assert.equal((await chartOf({ period: 'month' })).interval, 'last-month');
  assert.equal((await chartOf({ period: 'year' })).interval, 'last-year');
});

test('the live tiles and the chart reference features the integration publishes', async () => {
  const gladys = createFakeGladys();
  const featureIds = new Set(
    buildDiscoveredDevices(gladys, config).flatMap((device) =>
      device.features.map((feature) => feature.external_id),
    ),
  );
  const components = (await getContent(gladys)).components;
  const references = [
    ...components.filter((c) => c.device_feature).map((c) => c.device_feature),
    ...components.flatMap((c) => c.device_features ?? []),
  ];
  assert.equal(references.length, 4);
  for (const id of references) {
    assert.ok(featureIds.has(id), `unknown feature ${id}`);
  }
});

test('every button action of the content is handled and answers a short toast', async () => {
  const gladys = createFakeGladys();
  const buttons = (await getContent(gladys)).components.filter(
    (c) => c.type === 'button' && c.action,
  );
  assert.ok(buttons.length > 0);
  for (const { action } of buttons) {
    const message = await widget.action(gladys, {
      actionKey: action.key,
      params: action.params ?? {},
      settings: {},
      config,
    });
    for (const language of ['en', 'fr', 'de', 'es']) {
      assert.ok(message[language].length <= 200);
    }
  }
  assert.equal(gladys.fake.states.length, 3, 'the refresh button read the meter');
});

test('an unknown widget action fails, so the user sees the error', async () => {
  await assert.rejects(
    widget.action(createFakeGladys(), { actionKey: 'unknown', params: {}, settings: {}, config }),
    /Unknown widget action/,
  );
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
