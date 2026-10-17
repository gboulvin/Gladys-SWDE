// -----------------------------------------------------------------------------
// Scene actions (SDK v0.14+, Gladys 5.1+).
//
// Each action declared in the manifest `scene_actions` field is handled here,
// keyed by that same `key`; index.js registers it with `gladys.onSceneAction`.
// The handler resolves the declared `outputs` (scalars only) so the following
// actions of the scene can use them; throwing fails this action only.
//
// Scene TRIGGERS (`new_reading`, `high_consumption`) are fired by the water
// meter itself, see src/devices/waterMeter.js.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { waterMeter } from './devices/waterMeter.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTIONS = {
  async refresh_reading(gladys, { config }) {
    logger.info('Scene action refresh_reading');
    // No scene event from here: a scene bound to `new_reading` that refreshes
    // the meter would otherwise loop through the integration.
    const reading = await waterMeter.onPoll(gladys, config, { emitSceneEvents: false });
    return {
      total_m3: reading.total_m3 ?? null,
      period_m3: reading.period_m3 ?? null,
      daily_average_liters: reading.daily_average_liters ?? null,
      above_threshold:
        config.daily_alert_liters > 0 &&
        reading.daily_average_liters !== undefined &&
        reading.daily_average_liters > config.daily_alert_liters,
    };
  },
};
