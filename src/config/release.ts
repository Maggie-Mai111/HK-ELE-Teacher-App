export const APP_VERSION = "0.4.0";

const channel = process.env.EXPO_PUBLIC_HKELE_RELEASE_CHANNEL?.trim() || "development";

export const releaseConfiguration = Object.freeze({
  channel,
  fullDataUrl: process.env.EXPO_PUBLIC_HKELE_DATA_URL?.trim() || null,
  updateManifestUrl: process.env.EXPO_PUBLIC_HKELE_UPDATE_MANIFEST_URL?.trim() || null,
  configuredEndpointStatus:
    process.env.EXPO_PUBLIC_HKELE_ENDPOINT_STATUS?.trim() || "LOCAL_OR_NOT_CONFIGURED",
  developerDataToolsEnabled:
    channel === "development" && process.env.EXPO_PUBLIC_HKELE_ENABLE_DATA_DEBUG === "true",
});
