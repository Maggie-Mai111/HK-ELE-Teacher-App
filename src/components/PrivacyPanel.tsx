import { useEffect, useState } from "react";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

export function PrivacyPanel({
  visible,
  firstVisit,
  busy,
  error,
  onAgree,
  onWithdraw,
  onClose,
}: {
  visible: boolean;
  firstVisit: boolean;
  busy: boolean;
  error: string;
  onAgree: () => void;
  onWithdraw: () => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (visible) {
      setChecked(false);
      setDetailsOpen(false);
    }
  }, [visible, firstVisit]);
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={firstVisit || busy ? () => {} : onClose}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>HK-ELE · For teachers</Text>
          <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
            {firstVisit ? "Welcome to HK-ELE" : "Your data choices"}
          </Text>
          <Text style={styles.body}>Help us improve vocabulary teaching by sharing:</Text>
          <View style={styles.card}>
            <Text style={styles.item}>• Feedback about problems you report</Text>
            <Text style={styles.item}>• Your ratings of words for teaching and your class</Text>
          </View>
          <Text style={styles.body}>
            Your classroom texts, photos and teaching notes are not included in these records.
          </Text>
          <Text style={styles.note}>
            Feedback is shared only when you submit a Google Form. Click and feature-use records are
            not currently collected. We will ask again before enabling them.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            aria-expanded={detailsOpen}
            onPress={() => setDetailsOpen((value) => !value)}
            style={styles.detailsButton}
          >
            <Text style={styles.link}>
              {detailsOpen ? "Hide data information −" : "Read data information +"}
            </Text>
          </Pressable>
          {detailsOpen ? (
            <View style={styles.details}>
              <Text style={styles.note}>
                Your choice is saved on this device. Please leave student names and other
                identifying information out of your feedback.
              </Text>
              <Text style={styles.note}>
                Text checking and photo recognition happen on your device. Your teaching list and
                notes are saved here; export a copy to keep a backup. When you use AI word search,
                only your search request is sent to the AI service.
              </Text>
              <Text style={styles.note}>
                Review or withdraw your choice from Menu → Your data choices. Research participation
                requires a separate invitation and consent.
              </Text>
            </View>
          ) : null}
          {firstVisit ? (
            <>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="I have read the data information and agree to the uses described above"
                accessibilityState={{ checked, disabled: busy }}
                aria-checked={checked}
                disabled={busy}
                onPress={() => setChecked((value) => !value)}
                style={styles.choice}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  <Text aria-hidden style={styles.checkmark}>
                    {checked ? "✓" : ""}
                  </Text>
                </View>
                <Text style={styles.choiceText}>
                  I have read the data information and agree to the uses described above.
                </Text>
              </Pressable>
              <ActionButton
                disabled={!checked || busy}
                label={busy ? "Saving…" : "Agree and continue"}
                onPress={onAgree}
              />
              <Text style={styles.note}>Please confirm your choice to enter HK-ELE.</Text>
            </>
          ) : (
            <>
              <Text style={styles.accepted}>Your agreement is saved on this device.</Text>
              <ActionButton disabled={busy} label="Back to your work" onPress={onClose} />
              <ActionButton
                disabled={busy}
                kind="secondary"
                label={busy ? "Saving…" : "Withdraw agreement"}
                onPress={onWithdraw}
              />
              <Text style={styles.note}>Withdrawing returns you to the welcome screen.</Text>
            </>
          )}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingVertical: 32,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  brand: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  heading: { color: colors.ink, fontSize: 30, fontWeight: "800", lineHeight: 38 },
  body: { color: colors.ink, fontSize: 17, lineHeight: 26 },
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    gap: spacing.sm,
    padding: spacing.md,
  },
  item: { color: colors.ink, fontSize: 17, lineHeight: 25 },
  note: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  details: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  detailsButton: { minHeight: 44, justifyContent: "center" },
  link: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  choice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkmark: { color: "#fff", fontSize: 19, lineHeight: 21, fontWeight: "700" },
  choiceText: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 24 },
  accepted: { color: colors.primary, fontSize: 16, lineHeight: 24 },
  error: { color: colors.danger, fontSize: 16, lineHeight: 24 },
});
