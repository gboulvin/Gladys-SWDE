// -----------------------------------------------------------------------------
// SWDE integration configuration.
//
// Config values come from the Gladys Configuration screen. Credentials are
// optional because the official SWDE consumer portal does not document a public
// API; users can either configure an authorised JSON endpoint or enter their
// latest meter values manually.
// -----------------------------------------------------------------------------

export const DEFAULT_CONFIG = {
  source_type: 'manual', // 'manual' | 'api'
  meter_id: 'principal',
  meter_label: 'Compteur SWDE',
  poll_frequency: 3600,
  api_url: '',
  api_token: '',
  manual_total_m3: 0,
  manual_period_m3: 0,
  manual_period_days: 30,
};

function finiteNonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
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
    poll_frequency: Math.min(Math.max(Math.round(pollFrequency), 300), 86_400),
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
  };
}
