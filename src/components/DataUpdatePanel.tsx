import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { releaseConfiguration } from "../config/release";
import { dataUpdateManager } from "../services/dataUpdate/dataUpdateManager";
import type {
  UpdatePreview,
  UpdateProgress,
  UpdateStoreStatus,
} from "../services/dataUpdate/updateContract";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { AppCard } from "./AppCard";

const EMPTY_STATUS: UpdateStoreStatus = {
  activeVersion: null,
  previousVersion: null,
  hasRollback: false,
};

function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function DataUpdatePanel() {
  const [preview, setPreview] = useState<UpdatePreview | null>(null);
  const [status, setStatus] = useState<UpdateStoreStatus>(EMPTY_STATUS);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void dataUpdateManager.getStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const check = async () => {
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      if (!releaseConfiguration.updateManifestUrl) {
        throw new Error("Online data updates are not configured for this build.");
      }
      const next = await dataUpdateManager.check(releaseConfiguration.updateManifestUrl);
      setPreview(next);
      setMessage("A wordlist update is available.");
    } catch {
      setMessage("Unable to check wordlist updates. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!preview) return;
    setBusy(true);
    setMessage("");
    setProgress(null);
    try {
      const next = await dataUpdateManager.install(preview.manifestUrl, setProgress);
      setStatus(next);
      setPreview(null);
      setMessage("Wordlist updated. Reopen HK-ELE to use it.");
    } catch {
      setMessage("Update unsuccessful. Your current wordlist is still available.");
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    setBusy(true);
    setMessage("");
    try {
      const next = await dataUpdateManager.rollback();
      setStatus(next);
      setMessage("Previous wordlist restored. Reopen HK-ELE to use it.");
    } catch {
      setMessage("Unable to restore the previous wordlist. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!dataUpdateManager.supported || !releaseConfiguration.updateManifestUrl) return null;

  return (
    <AppCard title="Wordlist updates">
      <Text style={styles.note}>Check for a newer wordlist and download it to this device.</Text>
      <View style={styles.actions}>
        <ActionButton
          disabled={!dataUpdateManager.supported || busy || !releaseConfiguration.updateManifestUrl}
          label="Check for update"
          onPress={() => void check()}
        />
        <ActionButton
          disabled={!preview || busy}
          kind="secondary"
          label="Install update"
          onPress={() => void install()}
        />
        <ActionButton
          disabled={!dataUpdateManager.supported || busy || !status.hasRollback}
          kind="secondary"
          label="Restore previous version"
          onPress={() => void rollback()}
        />
      </View>
      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>New wordlist</Text>
          <Text style={styles.value}>Version: {preview.manifest.dataVersion}</Text>
          <Text style={styles.value}>Released: {preview.manifest.releaseDate}</Text>
          <Text style={styles.value}>Download: {formatBytes(preview.manifest.byteCount)}</Text>
        </View>
      ) : null}
      {progress ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          Downloaded {progress.completedFiles.toLocaleString("en")} of{" "}
          {progress.totalFiles.toLocaleString("en")} files ({formatBytes(progress.downloadedBytes)}
          ).
        </Text>
      ) : null}
      {busy ? <ActivityIndicator accessibilityLabel="Data update in progress" /> : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      <View style={styles.status}>
        <Text style={styles.label}>Installed update</Text>
        <Text selectable style={styles.value}>
          {status.activeVersion ?? "Bundled release"}
        </Text>
        <Text style={styles.label}>Rollback version</Text>
        <Text selectable style={styles.value}>
          {status.previousVersion ?? "None"}
        </Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  message: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  note: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: 9,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.sm,
  },
  preview: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  previewTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  privacy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  status: { gap: spacing.xs },
  value: { color: colors.ink, fontSize: 14, lineHeight: 21 },
});
