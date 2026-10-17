// -----------------------------------------------------------------------------
// Device type: SWDE WATER METER
//
// One polled device with three read-only volume sensors (index, period
// consumption, daily average). Each successful read also feeds two scene
// triggers declared in the manifest `scene_triggers` field:
//   - `new_reading`: the meter index changed since the previous read;
//   - `high_consumption`: the daily average crossed the configured threshold.
// The last reading is kept in memory for the dashboard widget (src/widgets.js).
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
  DEVICE_TRANSPORTS,
} from '@gladysassistant/integration-sdk';
import { getWaterReading, sourceTransport } from '../swdeClient.js';

const DEVICE_TYPE = 'swde-water-meter';
const logger = createLogger({ name: DEVICE_TYPE });

// Feature keys are part of the external ids: never rename them.
const FEATURE = {
  TOTAL_M3: 'total-m3',
  PERIOD_M3: 'period-m3',
  DAILY_AVERAGE_LITERS: 'daily-average-liters',
};

// Scene trigger keys, as declared in the manifest. Keys are forever.
export const NEW_READING_TRIGGER = 'new_reading';
export const HIGH_CONSUMPTION_TRIGGER = 'high_consumption';

// Re-send an unchanged value now and then, so a stable meter stays recently
// dated in Gladys without flooding the state history.
const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

// Runtime state of the last read, per meter external id (the widget and the
// scene triggers read it). Lost on restart on purpose: the first read after a
// restart sets the baseline instead of firing `new_reading` again.
const meterStates = new Map();

function deviceIds(gladys, config) {
  return gladys.externalIds(DEVICE_TYPE, config.meter_id);
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function stateOf(gladys, config) {
  const key = deviceIds(gladys, config).device;
  if (!meterStates.has(key)) {
    meterStates.set(key, {
      reading: undefined,
      readAt: undefined,
      error: undefined,
      previousTotal: undefined,
      alertActive: false,
    });
  }
  return meterStates.get(key);
}

/**
 * Reading enriched with the computed daily average (litres per day), or
 * undefined when the period or its length is unknown.
 */
export function withDailyAverage(reading) {
  const daily =
    reading.period_m3 !== undefined && reading.period_days
      ? round((reading.period_m3 * 1000) / reading.period_days, 1)
      : undefined;
  return { ...reading, daily_average_liters: daily };
}

async function fireSceneTriggers(gladys, config, ids, state, reading) {
  // `new_reading`: a change of the index, never the first read (baseline).
  if (
    reading.total_m3 !== undefined &&
    state.previousTotal !== undefined &&
    reading.total_m3 !== state.previousTotal
  ) {
    await gladys.publishSceneEvent(NEW_READING_TRIGGER, {
      device: ids.device,
      total_m3: reading.total_m3,
      delta_m3: round(reading.total_m3 - state.previousTotal, 3),
      period_m3: reading.period_m3 ?? null,
      daily_average_liters: reading.daily_average_liters ?? null,
    });
  }
  if (reading.total_m3 !== undefined) {
    state.previousTotal = reading.total_m3;
  }

  // `high_consumption`: one event per upward crossing of the threshold.
  const threshold = config.daily_alert_liters;
  const above =
    threshold > 0 &&
    reading.daily_average_liters !== undefined &&
    reading.daily_average_liters > threshold;
  if (above && !state.alertActive) {
    await gladys.publishSceneEvent(HIGH_CONSUMPTION_TRIGGER, {
      device: ids.device,
      daily_average_liters: reading.daily_average_liters,
      threshold_liters: threshold,
    });
  }
  state.alertActive = above;
}

export const waterMeter = {
  key: DEVICE_TYPE,

  // Scene triggers this device fires (checked against the manifest by the tests).
  sceneTriggers: [NEW_READING_TRIGGER, HIGH_CONSUMPTION_TRIGGER],

  deviceExternalId(gladys, config) {
    return deviceIds(gladys, config).device;
  },

  featureExternalIds(gladys, config) {
    const ids = deviceIds(gladys, config);
    return {
      total: ids.feature(FEATURE.TOTAL_M3),
      period: ids.feature(FEATURE.PERIOD_M3),
      daily: ids.feature(FEATURE.DAILY_AVERAGE_LITERS),
    };
  },

  buildDevice(gladys, config) {
    const ids = deviceIds(gladys, config);
    const volumeFeature = (name, key, unit) => ({
      name,
      external_id: ids.feature(key),
      category: DEVICE_FEATURE_CATEGORIES.VOLUME_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
      unit,
      min: 0,
      max: 1_000_000,
      read_only: true,
      has_feedback: false,
      keep_history: true,
    });
    return {
      name: config.meter_label,
      external_id: ids.device,
      // Gladys polls at most once a minute and only accepts its own values:
      // the configured interval is applied by the poller (createPoller).
      should_poll: true,
      poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
      features: [
        volumeFeature('Index du compteur', FEATURE.TOTAL_M3, DEVICE_FEATURE_UNITS.CUBIC_METER),
        volumeFeature(
          'Consommation de la période',
          FEATURE.PERIOD_M3,
          DEVICE_FEATURE_UNITS.CUBIC_METER,
        ),
        volumeFeature(
          'Moyenne quotidienne',
          FEATURE.DAILY_AVERAGE_LITERS,
          DEVICE_FEATURE_UNITS.LITER,
        ),
      ],
    };
  },

  /**
   * Effective channel of the meter, shown as a badge in Gladys.
   */
  transport(gladys, config) {
    // The connection status of the Configuration screen carries the reason.
    if (stateOf(gladys, config).error) {
      return DEVICE_TRANSPORTS.UNREACHABLE;
    }
    return sourceTransport(config);
  },

  /**
   * Last known reading and its context, for the dashboard widget.
   */
  snapshot(gladys, config) {
    const { reading, readAt, error, alertActive } = stateOf(gladys, config);
    return { reading, readAt, error, alertActive };
  },

  actions: {
    async test_data_source(_gladys, { config }) {
      const reading = withDailyAverage(await getWaterReading(config));
      const parts = (labels) => {
        const values = [];
        if (reading.total_m3 !== undefined) values.push(`${labels[0]} ${reading.total_m3} m³`);
        if (reading.period_m3 !== undefined) values.push(`${labels[1]} ${reading.period_m3} m³`);
        if (reading.daily_average_liters !== undefined) {
          values.push(`${labels[2]} ${reading.daily_average_liters} L/j`);
        }
        return values.join(', ');
      };
      return {
        en: `Water data source OK (${parts(['index', 'period', 'daily'])}).`,
        fr: `Source de données eau opérationnelle (${parts(['index', 'période', 'moyenne'])}).`,
        de: `Wasserdatenquelle OK (${parts(['Zählerstand', 'Zeitraum', 'Tagesmittel'])}).`,
        es: `Fuente de datos de agua operativa (${parts(['índice', 'periodo', 'media'])}).`,
      };
    },
  },

  /**
   * Read the configured source and publish the changed states.
   * @param {object} gladys
   * @param {object} config
   * @param {{ emitSceneEvents?: boolean }} [options] `false` from a scene
   *   action: an event fired as a consequence of a received action could loop
   *   through a scene. The triggers then catch up at the next poll.
   * @returns {Promise<object>} the reading, with its daily average
   */
  async onPoll(gladys, config, { emitSceneEvents = true } = {}) {
    const ids = deviceIds(gladys, config);
    const state = stateOf(gladys, config);
    logger.info(`Reading water consumption from the ${config.source_type} source...`);

    let reading;
    try {
      reading = withDailyAverage(await getWaterReading(config));
    } catch (error) {
      state.error = error.message;
      throw error;
    }

    const states = [];
    if (reading.total_m3 !== undefined) {
      states.push({
        device_feature_external_id: ids.feature(FEATURE.TOTAL_M3),
        state: reading.total_m3,
      });
    }
    if (reading.period_m3 !== undefined) {
      states.push({
        device_feature_external_id: ids.feature(FEATURE.PERIOD_M3),
        state: reading.period_m3,
      });
    }
    if (reading.daily_average_liters !== undefined) {
      states.push({
        device_feature_external_id: ids.feature(FEATURE.DAILY_AVERAGE_LITERS),
        state: reading.daily_average_liters,
      });
    }
    await gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });

    state.reading = reading;
    state.readAt = new Date().toISOString();
    state.error = undefined;
    if (emitSceneEvents) {
      await fireSceneTriggers(gladys, config, ids, state, reading);
    }
    await gladys.setConnectionStatus(true);
    return reading;
  },
};

/**
 * Forget the runtime state of every meter (tests, or a meter id change).
 */
export function resetMeterStates() {
  meterStates.clear();
}

export { FEATURE };
