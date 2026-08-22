import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { getWaterReading } from '../swdeClient.js';

const DEVICE_TYPE = 'swde-water-meter';
const logger = createLogger({ name: DEVICE_TYPE });

const FEATURE = {
  TOTAL_M3: 'total-m3',
  PERIOD_M3: 'period-m3',
  DAILY_AVERAGE_LITERS: 'daily-average-liters',
};

// The SWDE portal and authorised data endpoints may be polled more often than
// their values change. Keep the dashboard history meaningful by publishing only
// changed states during the lifetime of this integration container.
const lastPublishedStates = new Map();

function deviceIds(gladys, config) {
  return gladys.externalIds(DEVICE_TYPE, config.meter_id);
}

export const waterMeter = {
  key: DEVICE_TYPE,

  deviceExternalId(gladys, config) {
    return deviceIds(gladys, config).device;
  },

  buildDevice(gladys, config) {
    const ids = deviceIds(gladys, config);
    return {
      name: config.meter_label,
      external_id: ids.device,
      poll_frequency: config.poll_frequency,
      features: [
        {
          name: 'Index du compteur',
          external_id: ids.feature(FEATURE.TOTAL_M3),
          category: DEVICE_FEATURE_CATEGORIES.VOLUME_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.CUBIC_METER,
          min: 0,
          read_only: true,
          has_feedback: false,
          keep_history: true,
        },
        {
          name: 'Consommation de la période',
          external_id: ids.feature(FEATURE.PERIOD_M3),
          category: DEVICE_FEATURE_CATEGORIES.VOLUME_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.CUBIC_METER,
          min: 0,
          read_only: true,
          has_feedback: false,
          keep_history: true,
        },
        {
          name: 'Moyenne quotidienne',
          external_id: ids.feature(FEATURE.DAILY_AVERAGE_LITERS),
          category: DEVICE_FEATURE_CATEGORIES.VOLUME_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.LITER,
          min: 0,
          read_only: true,
          has_feedback: false,
          keep_history: true,
        },
      ],
    };
  },

  actions: {
    async test_data_source(_gladys, { config }) {
      const reading = await getWaterReading(config);
      const values = [];
      if (reading.total_m3 !== undefined) values.push(`index ${reading.total_m3} m³`);
      if (reading.period_m3 !== undefined) values.push(`période ${reading.period_m3} m³`);
      return {
        en: `Water data source OK (${values.join(', ')}).`,
        fr: `Source de données eau opérationnelle (${values.join(', ')}).`,
      };
    },
  },

  async onPoll(gladys, config) {
    const ids = deviceIds(gladys, config);
    logger.info(`Reading water consumption from ${config.source_type} source...`);

    const reading = await getWaterReading(config);
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
    if (reading.period_m3 !== undefined && reading.period_days) {
      states.push({
        device_feature_external_id: ids.feature(FEATURE.DAILY_AVERAGE_LITERS),
        state: (reading.period_m3 * 1000) / reading.period_days,
      });
    }

    const changedStates = states.filter((entry) => {
      const previous = lastPublishedStates.get(entry.device_feature_external_id);
      if (previous === entry.state) return false;
      lastPublishedStates.set(entry.device_feature_external_id, entry.state);
      return true;
    });

    if (changedStates.length > 0) {
      await gladys.publishStates(changedStates);
    }
    await gladys.setConnectionStatus(true);
    logger.info(`Published ${changedStates.length} changed SWDE water-consumption state(s)`);
  },
};

export { FEATURE };
