import { waterMeter } from './waterMeter.js';

export const DEVICE_BLUEPRINTS = [waterMeter];

export function buildDiscoveredDevices(gladys, config) {
  return DEVICE_BLUEPRINTS.map((blueprint) => blueprint.buildDevice(gladys, config));
}

export function findBlueprintByDevice(gladys, device, config) {
  return DEVICE_BLUEPRINTS.find(
    (blueprint) => blueprint.deviceExternalId(gladys, config) === device.external_id,
  );
}
