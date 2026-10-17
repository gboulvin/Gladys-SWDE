// -----------------------------------------------------------------------------
// SWDE integration configuration.
//
// Config values come from the Gladys Configuration screen. Credentials are
// optional because the official SWDE consumer portal does not document a public
// API; users can either configure an authorised JSON endpoint or enter their
// latest meter values manually.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  source_type: 'manual', // 'manual' | 'api'
  meter_id: 'principal',
  meter_label: 'Compteur SWDE',
  // Seconds between two reads. Gladys polls at most once a minute: slower
  // intervals are applied by skipping polls (see createPoller).
  poll_frequency: 3600,
  api_url: '',
  api_token: '',
  manual_total_m3: 0,
  manual_period_m3: 0,
  manual_period_days: 30,
  // Daily average (litres) above which the `high_consumption` scene trigger
  // fires. 0 disables the alert.
  daily_alert_liters: 0,
  // Reserved key (NOT in config_schema): the manifest declares both 'local'
  // and 'cloud' transports, so Gladys sends the "Prefer the local connection"
  // toggle here. The channel actually follows the configured data source.
  GLADYS_PREFER_LOCAL: true,
};

export const MIN_POLL_FREQUENCY = 300;
export const MAX_POLL_FREQUENCY = 86_400;

function finiteNonNegativeNumber(value, fallback) {
  const number = Number(value);
  return value !== '' && value !== null && Number.isFinite(number) && number >= 0
    ? number
    : fallback;
}

/**
 * Normalize the configuration received from Gladys.
 * @param {Record<string, unknown>} raw
 */
export function normalizeConfig(raw = {}) {
  const sourceType = raw.source_type === 'api' ? 'api' : 'manual';
  const meterId = String(raw.meter_id ?? DEFAULT_CONFIG.meter_id).trim();
  const meterLabel = String(raw.meter_label ?? DEFAULT_CONFIG.meter_label).trim();
  const pollFrequency = finiteNonNegativeNumber(raw.poll_frequency, DEFAULT_CONFIG.poll_frequency);

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    source_type: sourceType,
    meter_id: meterId || DEFAULT_CONFIG.meter_id,
    meter_label: meterLabel || DEFAULT_CONFIG.meter_label,
    poll_frequency: Math.min(
      Math.max(Math.round(pollFrequency), MIN_POLL_FREQUENCY),
      MAX_POLL_FREQUENCY,
    ),
    api_url: String(raw.api_url ?? DEFAULT_CONFIG.api_url).trim(),
    api_token: String(raw.api_token ?? DEFAULT_CONFIG.api_token).trim(),
    manual_total_m3: finiteNonNegativeNumber(raw.manual_total_m3, DEFAULT_CONFIG.manual_total_m3),
    manual_period_m3: finiteNonNegativeNumber(
      raw.manual_period_m3,
      DEFAULT_CONFIG.manual_period_m3,
    ),
    manual_period_days: Math.max(
      1,
      Math.round(
        finiteNonNegativeNumber(raw.manual_period_days, DEFAULT_CONFIG.manual_period_days),
      ),
    ),
    daily_alert_liters: finiteNonNegativeNumber(
      raw.daily_alert_liters,
      DEFAULT_CONFIG.daily_alert_liters,
    ),
    // The preference is a boolean; anything but an explicit false means true.
    GLADYS_PREFER_LOCAL: raw.GLADYS_PREFER_LOCAL !== false,
  };
}
