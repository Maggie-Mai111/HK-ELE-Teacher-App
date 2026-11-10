import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "../components/ActionButton";
import { AppCard } from "../components/AppCard";
import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import { DataUpdatePanel } from "../components/DataUpdatePanel";
import { offlineManager } from "../services/offline/offlineManager";
import type {
  OfflineManifest,
  OfflineProgress,
  OfflineStatus,
} from "../services/offline/offlineContract";
import { colors, spacing } from "../theme/tokens";
import { reopenAction, sessionWorkDescription, type SessionWork } from "../services/reopenSession";

const mb = (n: number) => `${(n / 1_000_000).toFixed(1)} MB`;
export function OfflineScreen({
  active,
  canReopen,
  sessionWork,
  onBackToText,
}: {
  active: boolean;
  canReopen: boolean;
  sessionWork: SessionWork;
  onBackToText: () => void;
}) {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [preview, setPreview] = useState<OfflineManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OfflineProgress | null>(null);
  const [message, setMessage] = useState("");
  const [reopen, setReopen] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const sessionDescription = sessionWorkDescription(sessionWork);
  const requestReopen = () => {
    const action = reopenAction(sessionWork, canReopen, busy);
    if (action === "confirm") setConfirmReopen(true);
    if (action === "reopen") offlineManager.reopen();
  };
  useEffect(() => {
    if (!active) setConfirmReopen(false);
  }, [active]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (active)
      void offlineManager
        .getStatus()
        .then(setStatus)
        .catch(() =>
          setMessage("We couldn't check your offline download. Reopen HK-ELE and try again."),
        );
  }, [active]);
  useEffect(() => () => controller.current?.abort(), []);
  const check = async () => {
    setBusy(true);
    setMessage("");
    setProgress(null);
    try {
      const next = await offlineManager.check();
      setPreview(next);
      const current = await offlineManager.getStatus();
      setStatus(current);
      setMessage(
        current.ready && current.releaseId === next.releaseId
          ? "Your offline download is up to date."
          : current.activeVersion
            ? "A newer offline download is available."
            : "Ready to download. Keep HK-ELE open until it finishes.",
      );
    } catch {
      setMessage("Connect to the internet, reopen HK-ELE and try again.");
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    setBusy(true);
    setMessage("");
    setProgress(null);
    const request = new AbortController();
    controller.current = request;
    try {
      setStatus(await offlineManager.install(setProgress, request.signal));
      setReopen(true);
      setMessage(
        "Download complete. Finish any edits, then reopen HK-ELE to use it offline.",
      );
    } catch {
      setProgress(null);
      setMessage(
        request.signal.aborted
          ? "Download cancelled. Your offline wordlist, selected words and notes have been kept."
          : "Download unsuccessful. Check your connection and free space, then try again. Your offline wordlist, selected words and notes have been kept.",
      );
      setStatus(await offlineManager.getStatus().catch(() => null));
    } finally {
      setBusy(false);
      controller.current = null;
    }
  };
  const rollback = async () => {
    setBusy(true);
    setMessage("");
    try {
      await offlineManager.rollback();
      setStatus(await offlineManager.getStatus());
      setReopen(true);
      setMessage("Previous download restored. Finish any edits, then reopen HK-ELE.");
    } catch {
      setMessage("The previous download could not be restored. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
        Offline use
      </Text>
      <Text style={styles.intro}>
        Download once while online, then check texts and plan lessons without an internet
        connection.
      </Text>
      {Platform.OS !== "web" ? (
        <DataUpdatePanel />
      ) : (
        <>
          <AppCard
            title={
              status?.ready
                ? "Ready for offline use"
                : status?.activeVersion
                  ? "Download needs attention"
                  : "Prepare this device"
            }
          >
            <Text style={styles.note}>
              {status?.ready
                ? "Full database, text checking and English photo recognition are saved on this device."
                : "Save the full wordlist and English photo recognition together. Keep this window open during the download."}
            </Text>
            {status?.activeVersion ? (
              <Text style={styles.value}>
                Wordlist saved · {mb(status.bytes)}
              </Text>
            ) : null}
            {preview ? (
              <Text style={styles.value}>
                Download: {mb(preview.byteCount)} ·{" "}
                {preview.counts.totalFamilies.toLocaleString("en")} word families
              </Text>
            ) : null}
            {status && !status.supported ? (
              <Text style={styles.note}>
                Open HK-ELE in a recent Safari, Chrome or Edge browser to prepare offline use. You
                can keep using HK-ELE online here.
              </Text>
            ) : (
              <View style={styles.actions}>
                <ActionButton
                  disabled={busy || !status}
                  label={status?.ready ? "Check for updates" : "Prepare download"}
                  onPress={() => void check()}
                />
                {preview ? (
                  <ActionButton
                    kind="secondary"
                    disabled={busy}
                    label={status?.ready ? "Download again / update" : "Download for offline use"}
                    onPress={() => void download()}
                  />
                ) : null}
                {busy && controller.current ? (
                  <ActionButton
                    kind="secondary"
                    label="Cancel download"
                    onPress={() => controller.current?.abort()}
                  />
                ) : null}
                {reopen ? (
                  <ActionButton
                    disabled={!canReopen || busy}
                    label="Reopen HK-ELE"
                    onPress={requestReopen}
                  />
                ) : null}
              </View>
            )}
            {progress ? (
              <Text accessibilityLiveRegion="polite" style={styles.value}>
                {Math.floor((progress.bytes / Math.max(1, progress.totalBytes)) * 100)}% ·{" "}
                {mb(progress.bytes)} of {mb(progress.totalBytes)}
              </Text>
            ) : null}
            {busy ? (
              <ActivityIndicator
                accessibilityLabel="Preparing offline use"
                color={colors.primary}
              />
            ) : null}
            {message ? (
              <Text accessibilityLiveRegion="polite" style={styles.note}>
                {message}
              </Text>
            ) : null}
            {reopen && sessionDescription ? (
              <Text style={styles.note}>
                Reopening will clear your {sessionDescription}. Copy anything you need first. Your
                saved words and notes will stay.
              </Text>
            ) : null}
            {reopen && !canReopen ? (
              <Text style={styles.note}>
                Your word changes still need to be saved. Check your selected words before
                reopening.
              </Text>
            ) : null}
            {status?.ready && !status.persistent ? (
              <Text style={styles.small}>
                Keep enough free space on your device. If its browser removes the download, you can
                download it again here.
              </Text>
            ) : null}
          </AppCard>
          <ProgressiveDisclosure title="Add HK-ELE to your phone">
            <Text style={styles.note}>
              iPhone or iPad: open HK-ELE in Safari, use Share, then Add to Home Screen. Android:
              open the browser menu and choose Install app or Add to Home screen.
            </Text>
            <Text style={styles.note}>
              Open HK-ELE from its home-screen icon and download for offline use there too.
            </Text>
          </ProgressiveDisclosure>
          <ProgressiveDisclosure title="What works without internet?">
            <Text style={styles.note}>
              Find words in the full database, check a passage, tap its words, mark words to
              explain, scan printed English, and keep and copy selected words.
            </Text>
            <Text style={styles.note}>
              AI search, Google Forms and new wordlist downloads need an internet connection.
              Your passage is not saved when you close HK-ELE. Selected words and notes stay on
              this device.
            </Text>
          </ProgressiveDisclosure>
          {status?.previousVersion ? (
            <ProgressiveDisclosure title="Restore a previous download">
              <Text style={styles.note}>
                Restore the previous download. Your selected words and notes stay as they are.
              </Text>
              <ActionButton
                disabled={busy}
                kind="secondary"
                label="Restore previous download"
                onPress={() => void rollback()}
              />
            </ProgressiveDisclosure>
          ) : null}
        </>
      )}
      <Modal
        transparent
        animationType="fade"
        visible={active && confirmReopen}
        onRequestClose={() => setConfirmReopen(false)}
      >
        <View style={styles.backdrop}>
          <View accessibilityLabel="Reopen HK-ELE?" style={styles.confirmation}>
            <Text accessibilityRole="header" aria-level={2} style={styles.dialogTitle}>
              Reopen HK-ELE?
            </Text>
            <Text style={styles.note}>
              This will clear your {sessionDescription}. Go back to finish your work or copy
              anything you need first. Your saved words and notes will stay.
            </Text>
            <ActionButton
              label="Back to my text"
              onPress={() => {
                setConfirmReopen(false);
                onBackToText();
              }}
            />
            <ActionButton
              kind="danger"
              disabled={!canReopen || busy}
              label="Reopen HK-ELE"
              onPress={() => {
                if (reopenAction(sessionWork, canReopen, busy) !== "blocked")
                  offlineManager.reopen();
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  confirmation: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dialogTitle: { fontSize: 23, lineHeight: 29, fontWeight: "800", color: colors.ink },
  content: { padding: spacing.lg, gap: spacing.md },
  heading: { fontSize: 32, fontWeight: "800", color: colors.ink },
  intro: { fontSize: 20, lineHeight: 27, color: colors.muted },
  note: { fontSize: 18, lineHeight: 27, color: colors.ink },
  small: { fontSize: 16, lineHeight: 24, color: colors.muted },
  value: { fontSize: 17, lineHeight: 26, fontWeight: "700", color: colors.primary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
