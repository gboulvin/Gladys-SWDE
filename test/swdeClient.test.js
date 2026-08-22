import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { getWaterReading, normalizeReading, validateApiUrl } from '../src/swdeClient.js';

test('manual source returns normalized meter values', async () => {
  const reading = await getWaterReading(
    normalizeConfig({
      manual_total_m3: 108.2,
      manual_period_m3: 2.7,
      manual_period_days: 9,
    }),
  );

  assert.deepEqual(reading, {
    total_m3: 108.2,
    period_m3: 2.7,
    period_days: 9,
    reading_at: undefined,
    source: 'manual',
  });
});

test('API source uses a bearer token and accepts a wrapped response', async () => {
  const originalFetch = globalThis.fetch;
  let receivedUrl;
  let receivedOptions;
  globalThis.fetch = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;
    return {
      ok: true,
      json: async () => ({
        data: { total_m3: 82.5, consumption_m3: 4.2, days: 14, reading_at: '2026-08-22T09:00:00Z' },
      }),
    };
  };

  try {
    const reading = await getWaterReading(
      normalizeConfig({
        source_type: 'api',
        api_url: 'https://provider.example.test/meter/42',
        api_token: 'secret-token',
      }),
    );

    assert.equal(receivedUrl.href, 'https://provider.example.test/meter/42');
    assert.equal(receivedOptions.headers.Authorization, 'Bearer secret-token');
    assert.deepEqual(reading, {
      total_m3: 82.5,
      period_m3: 4.2,
      period_days: 14,
      reading_at: '2026-08-22T09:00:00Z',
      source: 'api',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('API source requires a URL and rejects an invalid response', async () => {
  await assert.rejects(
    () => getWaterReading(normalizeConfig({ source_type: 'api' })),
    /API URL is required/,
  );
  assert.throws(() => normalizeReading({ value: 3 }, 'api'), /total_m3 or period_m3/);
  assert.throws(() => normalizeReading({ total_m3: -1 }, 'api'), /non-negative/);
});

test('only HTTP(S) URLs without embedded credentials are accepted', () => {
  assert.equal(validateApiUrl('https://example.test/api').hostname, 'example.test');
  assert.throws(() => validateApiUrl('file:///data/reading.json'), /HTTP or HTTPS/);
  assert.throws(
    () => validateApiUrl('https://user:pass@example.test/api'),
    /must not contain credentials/,
  );
});
