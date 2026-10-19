import type { OfflineManager } from "./offlineContract";
const unavailable = async (): Promise<never> => {
  throw new Error("Use the installed PWA to prepare offline data.");
};
export const offlineManager: OfflineManager = {
  getStatus: async () => ({
    supported: false,
    ready: false,
    activeVersion: null,
    previousVersion: null,
    releaseId: null,
    bytes: 0,
    persistent: false,
  }),
  check: unavailable,
  install: unavailable,
  rollback: unavailable,
  reopen: () => undefined,
};
