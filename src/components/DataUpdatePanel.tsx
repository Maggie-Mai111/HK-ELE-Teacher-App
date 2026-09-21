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
      setMessage("The data release is compatible. Review the details before installing.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
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
      setMessage("Verified data installed. Restart the App to load the new active version.");
    } catch (reason) {
      setMessage(
        `${reason instanceof Error ? reason.message : String(reason)} The previous active data remains available.`,
      );
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
      setMessage("Rollback completed. Restart the App to load the restored version.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppCard title="Verified offline data updates">
      <Text style={styles.note}>
        The App downloads one versioned data package only after you ask. It checks the package and
        every included file before replacing active data. A failed or incompatible update is refused
        and the previous version is kept.
      </Text>
      <View style={styles.actions}>
        <ActionButton
          disabled={!dataUpdateManager.supported || busy || !releaseConfiguration.updateManifestUrl}
          label="Check for update"
          onPress={() => void check()}
        />
        <ActionButton
          disabled={!preview || busy}
          kind="secondary"
          label="Install verified update"
          onPress={() => void install()}
        />
        <ActionButton
          disabled={!dataUpdateManager.supported || busy || !status.hasRollback}
          kind="secondary"
          label="Restore previous version"
          onPress={() => void rollback()}
        />
      </View>
      {!dataUpdateManager.supported ? (
        <Text style={styles.notice}>
          Offline update installation is available in Android and iOS builds. This Web build uses
          its packaged/static data and cannot replace native App storage.
        </Text>
      ) : null}
      {dataUpdateManager.supported && !releaseConfiguration.updateManifestUrl ? (
        <Text style={styles.notice}>
          Online data updates are not configured for this build. The bundled Candidate + Reference
          data remains available offline.
        </Text>
      ) : null}
      {preview ? (
        <View accessibilityRole="summary" style={styles.preview}>
          <Text style={styles.previewTitle}>Available verified data release</Text>
          <Text style={styles.value}>Version: {preview.manifest.dataVersion}</Text>
          <Text style={styles.value}>Released: {preview.manifest.releaseDate}</Text>
          <Text style={styles.value}>
            Download: one package · {preview.manifest.fileCount.toLocaleString("en")} verified files
            · {formatBytes(preview.manifest.byteCount)}
          </Text>
        </View>
      ) : null}
      {progress ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          Verified {progress.completedFiles.toLocaleString("en")} of{" "}
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
      <Text style={styles.privacy}>
        Update requests contain only ordinary network metadata. The App does not send classroom
        text, images, teaching-list notes or student answers.
      </Text>
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
  privacy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  status: { gap: spacing.xs },
  value: { color: colors.ink, fontSize: 14, lineHeight: 21 },
});
