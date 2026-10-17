// -----------------------------------------------------------------------------
// Device registry.
//
// Each device lives in its own file and exposes the same shape:
//   - key                                : short identifier (used in logs)
//   - deviceExternalId(gladys, config)   : the device external_id (for dispatch)
//   - buildDevice(gladys, config)        : the discovery payload sent to Gladys
//   - onPoll(gladys, config)             : periodic read (`should_poll: true`)
//   - transport(gladys, config)          : effective channel, shown as a badge
//   - actions                            : manifest action handlers, by key
//   - sceneTriggers                      : manifest `scene_triggers` it fires
// -----------------------------------------------------------------------------

import { DEVICE_POLL_FREQUENCIES } from '@gladysassistant/integration-sdk';
import { waterMeter } from './waterMeter.js';

export const DEVICE_BLUEPRINTS = [waterMeter];

// Every scene trigger key the devices fire: each one must be declared in the
// manifest `scene_triggers` field, or the core answers 404 (see the tests).
export const SCENE_TRIGGER_KEYS = DEVICE_BLUEPRINTS.flatMap((bp) => bp.sceneTriggers ?? []);

export function buildDiscoveredDevices(gladys, config) {
  return DEVICE_BLUEPRINTS.map((blueprint) => blueprint.buildDevice(gladys, config));
}

export function findBlueprintByDevice(gladys, device, config) {
  return DEVICE_BLUEPRINTS.find(
    (blueprint) => blueprint.deviceExternalId(gladys, config) === device.external_id,
  );
}

// Gladys' poll ticks drift by a few milliseconds: a read due within the next
// half-minute runs now, so a 3600 s interval does not slip to 3660 s.
const POLL_TOLERANCE_MS = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES / 2;

/**
 * Create the `onPoll` dispatcher: route the poll to the owner blueprint at the
 * refresh interval the user chose (`poll_frequency`, in seconds). Gladys polls
 * once a minute; the polls in between are skipped. Resolves `true` when the
 * device was read. A read that throws is retried at the next poll.
 */
export function createPoller() {
  const lastReads = new Map();
  return async function pollDevice(gladys, device, config) {
    const blueprint = findBlueprintByDevice(gladys, device, config);
    if (!blueprint || typeof blueprint.onPoll !== 'function') {
      return false;
    }
    const now = Date.now();
    const lastRead = lastReads.get(device.external_id);
    if (
      lastRead !== undefined &&
      now - lastRead < config.poll_frequency * 1000 - POLL_TOLERANCE_MS
    ) {
      return false;
    }
    await blueprint.onPoll(gladys, config);
    lastReads.set(device.external_id, now);
    return true;
  };
}

/**
 * Build the `publishTransports` payload: one entry per blueprint reporting its
 * effective transport. An entry without `degraded` clears a previous one.
 */
export function buildTransportEntries(gladys, config) {
  return DEVICE_BLUEPRINTS.filter((bp) => typeof bp.transport === 'function').map((bp) => {
    const reported = bp.transport(gladys, config);
    const entry = typeof reported === 'string' ? { transport: reported } : reported;
    return { external_id: bp.deviceExternalId(gladys, config), ...entry };
  });
}
