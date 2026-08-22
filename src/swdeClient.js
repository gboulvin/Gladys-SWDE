// -----------------------------------------------------------------------------
// SWDE data source adapter.
//
// The public SWDE customer portal exposes consumption history after login but
// does not document a public automation API. This adapter therefore never
// handles a SWDE password and never drives the portal. It supports either
// explicit manual values or a user-authorised JSON endpoint (for example a
// contracted easyCONSO endpoint, an approved SWDE export proxy, or another
// documented data service).
// -----------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10_000;

function asNonNegativeNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Invalid non-negative number for ${fieldName}`);
  }
  return number;
}

function firstDefined(object, keys) {
  return keys.map((key) => object[key]).find((value) => value !== undefined && value !== null);
}

function normalizeReading(payload, source) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The data source must return a JSON object');
  }

  const data =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : payload;

  const totalM3 = asNonNegativeNumber(
    firstDefined(data, ['total_m3', 'totalM3', 'index_m3', 'indexM3']),
    'total_m3',
  );
  const periodM3 = asNonNegativeNumber(
    firstDefined(data, ['period_m3', 'periodM3', 'consumption_m3', 'consumptionM3']),
    'period_m3',
  );
  const periodDays = asNonNegativeNumber(
    firstDefined(data, ['period_days', 'periodDays', 'days']),
    'period_days',
  );

  if (totalM3 === undefined && periodM3 === undefined) {
    throw new Error('The data source must provide total_m3 or period_m3');
  }

  return {
    total_m3: totalM3,
    period_m3: periodM3,
    period_days: periodDays && periodDays > 0 ? periodDays : undefined,
    reading_at: typeof data.reading_at === 'string' ? data.reading_at : undefined,
    source,
  };
}

function validateApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('API URL must be a valid absolute URL');
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('API URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('API URL must not contain credentials');
  }
  return url;
}

/**
 * Read one normalized water-meter reading from the configured source.
 */
export async function getWaterReading(config) {
  if (config.source_type === 'manual') {
    return normalizeReading(
      {
        total_m3: config.manual_total_m3,
        period_m3: config.manual_period_m3,
        period_days: config.manual_period_days,
      },
      'manual',
    );
  }

  if (!config.api_url) {
    throw new Error('API URL is required when the API source is selected');
  }

  const url = validateApiUrl(config.api_url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = { Accept: 'application/json' };

  if (config.api_token) {
    headers.Authorization = `Bearer ${config.api_token}`;
  }

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Data source responded with HTTP ${response.status}`);
    }
    return normalizeReading(await response.json(), 'api');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Data source timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`, {
        cause: error,
      });
    }
    throw new Error('Unable to fetch water data from the configured API source', { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export { normalizeReading, validateApiUrl };
