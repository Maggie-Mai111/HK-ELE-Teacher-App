import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { ResolvedOccurrence } from "../domain/hkele";
import { grammaticalRelationDisplay } from "../services/grammaticalRelationService";
import { textWordAction } from "../services/textReaderService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

export function TextWordSheet({
  item,
  onClose,
  onOpenFamily,
  onRetry,
}: {
  item: ResolvedOccurrence | null;
  onClose: () => void;
  onOpenFamily: (key: string, surface: string, context: string) => void;
  onRetry: () => void;
}) {
  if (!item) return null;
  const action = textWordAction(item);
  const owners = item.owners.filter((owner) => !owner.blocked && !owner.display_blocked);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Close word information"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text accessibilityRole="header" aria-level={2} style={styles.word}>
            {item.surface}
          </Text>
          {action === "choices" ? (
            <>
              <Text style={styles.note}>Choose a word family</Text>
              {owners.map((owner) => (
                <ActionButton
                  key={owner.baseword_key}
                  kind="secondary"
                  label={owner.display_family}
                  onPress={() => {
                    onClose();
                    onOpenFamily(owner.baseword_key, item.surface, item.context);
                  }}
                />
              ))}
            </>
          ) : action === "grammar" && item.grammaticalRelation ? (
            <>
              <Text style={styles.label}>Full form</Text>
              <Text style={styles.note}>
                {grammaticalRelationDisplay(item.grammaticalRelation)}
              </Text>
            </>
          ) : action === "offline" ? (
            <>
              <Text style={styles.note}>Connect to look up this word.</Text>
              <ActionButton
                label="Check text again"
                onPress={() => {
                  onClose();
                  onRetry();
                }}
              />
            </>
          ) : (
            <Text style={styles.note}>
              {item.status === "BLOCKED"
                ? "Check the spelling or use in this sentence."
                : item.status === "UNSUPPORTED"
                  ? "Try the English spelling of this word."
                  : "No entry found in the wordlist."}
            </Text>
          )}
          <ActionButton kind="secondary" label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
  },
  word: { fontSize: 24, fontWeight: "800", color: colors.ink },
  label: { fontSize: 15, fontWeight: "700", color: colors.muted },
  note: { fontSize: 17, lineHeight: 25, color: colors.ink },
});
