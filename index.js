// -----------------------------------------------------------------------------
// Entry point of the SWDE water-consumption integration.
//
// This file only wires the SDK to the device registry (src/devices/), the
// scene actions (src/scenes.js) and the dashboard widget (src/widgets.js):
// handlers are registered BEFORE connect().
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  buildTransportEntries,
  createPoller,
} from './src/devices/index.js';
import { waterMeter } from './src/devices/waterMeter.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();
let config = normalizeConfig();

const READ_FAILED_MESSAGE = {
  en: 'Unable to read the configured water data source. Check the URL, token and logs.',
  fr: 'Impossible de lire la source de données eau configurée. Vérifiez l’URL, le jeton et les journaux.',
  de: 'Die konfigurierte Wasserdatenquelle kann nicht gelesen werden. Prüfen Sie URL, Token und Protokolle.',
  es: 'No se puede leer la fuente de datos de agua configurada. Compruebe la URL, el token y los registros.',
};

async function publishDevices() {
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
}

async function publishDeviceTransports() {
  const entries = buildTransportEntries(gladys, config);
  if (entries.length > 0) {
    await gladys.publishTransports(entries);
  }
}

// Runs after every read, successful or not: the transport badge, the
// connection status and the widget follow its outcome.
async function afterRead(error) {
  if (error) {
    logger.error('Unable to refresh SWDE water-consumption data', error);
    await gladys.setConnectionStatus(false, READ_FAILED_MESSAGE).catch(() => {});
  }
  await publishDeviceTransports().catch((err) => logger.error('publishTransports failed', err));
  refreshWidgets(gladys);
}

async function refreshWaterMeter() {
  try {
    await waterMeter.onPoll(gladys, config);
    await afterRead();
  } catch (error) {
    await afterRead(error);
  }
}

// --- Discovery ---------------------------------------------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing SWDE water meter');
  await publishDevices();
});

// --- Polling: Gladys polls once a minute, the poller applies poll_frequency --
const pollDevice = createPoller();
gladys.onPoll(async (device) => {
  try {
    if (await pollDevice(gladys, device, config)) {
      await afterRead();
    }
  } catch (error) {
    await afterRead(error);
    throw error;
  }
});

// --- Manifest actions (Configuration screen buttons) -------------------------
for (const blueprint of DEVICE_BLUEPRINTS) {
  for (const [actionKey, handler] of Object.entries(blueprint.actions ?? {})) {
    gladys.onAction(actionKey, (fields) => handler(gladys, { fields, config }));
  }
}

// --- Scene actions -----------------------------------------------------------
for (const [actionKey, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(actionKey, async (fields) => {
    try {
      const outputs = await handler(gladys, { fields, config });
      await afterRead();
      return outputs;
    } catch (error) {
      await afterRead(error);
      throw error;
    }
  });
}

// --- Dashboard widgets -------------------------------------------------------
for (const [widgetKey, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(widgetKey, (request) => widget.get(gladys, { ...request, config }));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(widgetKey, async (actionKey, params, { settings }) => {
      try {
        const toast = await widget.action(gladys, { actionKey, params, settings, config });
        await publishDeviceTransports().catch(() => {});
        return toast;
      } catch (error) {
        await afterRead(error);
        throw error;
      }
    });
  }
}

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> applying SWDE configuration');
  config = normalizeConfig(newConfig);
  await publishDevices();
  await refreshWaterMeter();
});

// --- Connection lifecycle ----------------------------------------------------
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
        de: 'Die Initialisierung ist fehlgeschlagen; prüfen Sie die Protokolle der Integration.',
        es: 'La inicialización ha fallado; consulte los registros de la integración.',
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
