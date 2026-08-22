import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  findBlueprintByDevice,
} from './src/devices/index.js';

const gladys = new GladysIntegration();
let config = normalizeConfig();

async function publishDevices() {
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
}

async function refreshWaterMeter() {
  const [waterMeter] = DEVICE_BLUEPRINTS;
  try {
    await waterMeter.onPoll(gladys, config);
  } catch (error) {
    logger.error('Unable to refresh SWDE water-consumption data', error);
    await gladys
      .setConnectionStatus(false, {
        en: 'Unable to read the configured water data source. Check the URL, token and logs.',
        fr: 'Impossible de lire la source de données eau configurée. Vérifiez l’URL, le jeton et les journaux.',
      })
      .catch(() => {});
  }
}

gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing SWDE water meter');
  await publishDevices();
});

gladys.onPoll(async (device) => {
  const blueprint = findBlueprintByDevice(gladys, device, config);
  if (!blueprint || typeof blueprint.onPoll !== 'function') {
    logger.debug(`onPoll ignored for ${device.external_id}`);
    return;
  }
  await blueprint.onPoll(gladys, config);
});

for (const blueprint of DEVICE_BLUEPRINTS) {
  for (const [actionKey, handler] of Object.entries(blueprint.actions ?? {})) {
    gladys.onAction(actionKey, (fields) => handler(gladys, { fields, config }));
  }
}

gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> applying SWDE configuration');
  config = normalizeConfig(newConfig);
  await publishDevices();
  await refreshWaterMeter();
});

gladys.on('connected', async () => {
  try {
    config = normalizeConfig(await gladys.getConfig());
    await publishDevices();
    await refreshWaterMeter();
  } catch (error) {
    logger.error('SWDE integration initialization failed', error);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed; check the integration logs.',
        fr: 'L’initialisation a échoué ; consultez les journaux de l’intégration.',
      })
      .catch(() => {});
  }
});

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

logger.info('Starting the SWDE water-consumption integration...');
gladys.connect().catch((error) => {
  logger.error('Initial connection failed', error);
  process.exit(1);
});
