import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

import { APP_VERSION } from "../../config/release";
import {
  checkUpdateManifest,
  installVerifiedUpdate,
  shouldRestoreInterruptedActive,
  type DataUpdateManager,
  type DataUpdateManifest,
  type StagedUpdateStore,
  type UpdateStoreStatus,
  type UpdateTransport,
} from "./updateContract";

const root = new Directory(Paths.document, "hkele-data");

interface StoredState {
  activeVersion: string | null;
  previousVersion: string | null;
}

function directory(name: "active" | "previous" | "staging"): Directory {
  return new Directory(root, name);
}

function stateFile(): File {
  return new File(root, "UPDATE_STATE.json");
}

async function readState(): Promise<StoredState> {
  const file = stateFile();
  if (!file.exists) return { activeVersion: null, previousVersion: null };
  try {
    return (await file.json()) as StoredState;
  } catch {
    return { activeVersion: null, previousVersion: null };
  }
}

function writeState(state: StoredState): void {
  root.create({ intermediates: true, idempotent: true });
  const file = stateFile();
  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(state));
}

async function recoverInterruptedCommit(): Promise<void> {
  root.create({ intermediates: true, idempotent: true });
  const active = directory("active");
  const previous = directory("previous");
  const staging = directory("staging");
  const state = await readState();
  if (shouldRestoreInterruptedActive(active.exists, previous.exists, state.activeVersion)) {
    await previous.move(active);
  }
  if (staging.exists) staging.delete();
}

class ExpoStagedUpdateStore implements StagedUpdateStore {
  private pending: DataUpdateManifest | null = null;

  async begin(manifest: DataUpdateManifest): Promise<void> {
    await recoverInterruptedCommit();
    const staging = directory("staging");
    if (staging.exists) staging.delete();
    staging.create({ intermediates: true });
    this.pending = manifest;
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    if (!this.pending) throw new Error("No staged data update is active.");
    const file = new File(directory("staging"), ...path.split("/"));
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    file.create({ intermediates: true, overwrite: true });
    file.write(bytes);
  }

  async commit(manifest: DataUpdateManifest): Promise<void> {
    if (!this.pending || this.pending.dataVersion !== manifest.dataVersion) {
      throw new Error("The staged update identity changed before commit.");
    }
    const oldState = await readState();
    const active = directory("active");
    const previous = directory("previous");
    const staging = directory("staging");
    const stagedManifest = new File(staging, "INSTALLED_UPDATE.json");
    stagedManifest.create({ overwrite: true });
    stagedManifest.write(JSON.stringify(manifest));
    if (previous.exists) previous.delete();
    if (active.exists) await active.move(previous);
    try {
      await staging.move(directory("active"));
      writeState({
        activeVersion: manifest.dataVersion,
        previousVersion: oldState.activeVersion,
      });
      this.pending = null;
    } catch (reason) {
      const failedActive = directory("active");
      if (failedActive.exists) failedActive.delete();
      const rollback = directory("previous");
      if (rollback.exists) await rollback.move(directory("active"));
      writeState(oldState);
      throw reason;
    }
  }

  async abort(): Promise<void> {
    const staging = directory("staging");
    if (staging.exists) staging.delete();
    this.pending = null;
  }
}

const transport: UpdateTransport = {
  async readManifest(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Update manifest unavailable (${response.status}).`);
    return response.json();
  },
  async readFile(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Update file unavailable (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  },
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = Uint8Array.from(bytes);
  const value = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, input.buffer));
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function status(): Promise<UpdateStoreStatus> {
  await recoverInterruptedCommit();
  const state = await readState();
  return {
    activeVersion: state.activeVersion,
    previousVersion: state.previousVersion,
    hasRollback: directory("active").exists,
  };
}

export const dataUpdateManager: DataUpdateManager = {
  supported: true,
  getStatus: status,
  check: (manifestUrl) => checkUpdateManifest(manifestUrl, APP_VERSION, transport),
  async install(manifestUrl, onProgress) {
    const preview = await checkUpdateManifest(manifestUrl, APP_VERSION, transport);
    await installVerifiedUpdate(
      preview,
      transport,
      new ExpoStagedUpdateStore(),
      sha256Hex,
      onProgress,
    );
    return status();
  },
  async rollback() {
    await recoverInterruptedCommit();
    const active = directory("active");
    const previous = directory("previous");
    if (!active.exists) throw new Error("No installed data update is available to roll back.");
    const currentState = await readState();
    if (!previous.exists) {
      await active.move(previous);
      writeState({
        activeVersion: null,
        previousVersion: currentState.activeVersion,
      });
      return status();
    }
    const retired = new Directory(root, "retired");
    if (retired.exists) retired.delete();
    if (active.exists) await active.move(retired);
    try {
      await previous.move(directory("active"));
      const retiredAfterMove = new Directory(root, "retired");
      if (retiredAfterMove.exists) await retiredAfterMove.move(directory("previous"));
      writeState({
        activeVersion: currentState.previousVersion,
        previousVersion: currentState.activeVersion,
      });
      return status();
    } catch (reason) {
      const failedActive = directory("active");
      if (failedActive.exists) failedActive.delete();
      const retiredAfterFailure = new Directory(root, "retired");
      if (retiredAfterFailure.exists) await retiredAfterFailure.move(directory("active"));
      writeState(currentState);
      throw reason;
    }
  },
};
