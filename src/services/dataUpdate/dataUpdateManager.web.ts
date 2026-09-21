import type { DataUpdateManager } from "./updateContract";

const unsupported = async () => {
  throw new Error(
    "Verified offline data installation is available only in Android and iOS builds.",
  );
};

export const dataUpdateManager: DataUpdateManager = {
  supported: false,
  async getStatus() {
    return { activeVersion: null, previousVersion: null, hasRollback: false };
  },
  check: unsupported,
  install: unsupported,
  rollback: unsupported,
};
