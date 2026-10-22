export const AI_OFFLINE_MESSAGE =
  "AI search needs an internet connection. Reconnect and try again.";

// A positive browser signal is only a hint; the request can still fail.
export function isAiNetworkOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
