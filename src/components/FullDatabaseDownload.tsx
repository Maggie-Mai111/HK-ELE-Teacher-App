import { useEffect, useState } from "react";
import type { HkeleRepository } from "../domain/hkele";
import { StyleSheet, Text, View } from "react-native";
import release from "../config/fullDatabaseWorkbook.json";
import { downloadFullDatabase } from "../services/fullDatabaseWorkbook";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

export function FullDatabaseDownload({ dataVersion, repository }: { dataVersion: string; repository?: HkeleRepository }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [activeVersion,setActiveVersion] = useState<string | null>(repository ? null : dataVersion);
  useEffect(() => {
    let active = true;
    void (repository?.getDataVersion?.() ?? Promise.resolve(dataVersion))
      .then(version => {if(active)setActiveVersion(version);}).catch(() => {if(active)setActiveVersion(null);});
    return () => {active=false;};
  },[repository,dataVersion]);
  if (activeVersion !== release.dataVersion) return null;
  const download = async () => {
    setBusy(true);
    setMessage("");
    try {
      await downloadFullDatabase(activeVersion);
      setMessage("Download started.");
    } catch {
      setMessage("We couldn't download the file. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.box}>
      <ActionButton
        kind="secondary"
        disabled={busy}
        label={busy ? "Preparing download…" : "Download full database (.xlsx)"}
        onPress={() => void download()}
      />
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  note: { fontSize: 18, lineHeight: 26, color: colors.muted },
});
