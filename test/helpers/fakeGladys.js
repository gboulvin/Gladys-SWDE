// Minimal in-memory stand-in for the Gladys SDK surface used by the SWDE
// integration. It records published states and connection statuses, allowing
// the device module to be tested without a running Gladys instance.

export function createFakeGladys() {
  const published = [];
  const connectionStatuses = [];

  return {
    published,
    connectionStatuses,

    externalIds(type, platformId) {
      const device = `${type}:${platformId}`;
      return {
        device,
        feature: (key) => `${device}:${key}`,
      };
    },

    async publishState(featureExternalId, state) {
      published.push({ featureExternalId, state });
    },

    async publishStates(states) {
      for (const state of states) {
        published.push({
          featureExternalId: state.device_feature_external_id,
          state: state.state,
        });
      }
    },

    async setConnectionStatus(connected, message) {
      connectionStatuses.push({ connected, message });
    },
  };
}
