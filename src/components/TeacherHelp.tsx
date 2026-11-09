import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import content from "../content/teacherHelp.json";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

export function TeacherHelp({
  mode,
  onClose,
  returnFocusLabel,
}: {
  mode: "guide" | "columns";
  onClose: () => void;
  returnFocusLabel: string;
}) {
  const [showColumns, setShowColumns] = useState(mode === "columns");
  const closeRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const timer = setTimeout(() => (closeRef.current as unknown as HTMLElement)?.focus?.(), 0);
    return () => {
      clearTimeout(timer);
      setTimeout(() => {
        const target = [...document.querySelectorAll<HTMLElement>('[role="button"]')].find(
          (node) => node.getAttribute("aria-label") === returnFocusLabel,
        );
        target?.focus({ preventScroll: true });
      }, 0);
    };
  }, [returnFocusLabel]);
  const definitions = (
    <View style={styles.items}>
      {content.columns.map(([title, body]) => (
        <View key={title} style={styles.item}>
          <Text style={styles.label}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss help"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          role="dialog"
          accessibilityLabel={mode === "guide" ? "Quick guide" : "About these columns"}
          accessibilityViewIsModal
          style={styles.sheet}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" aria-level={1} style={styles.title}>
              {mode === "guide" ? "Quick guide" : "About these columns"}
            </Text>
            <Pressable
              ref={closeRef}
              accessibilityRole="button"
              accessibilityLabel="Close help"
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {mode === "guide" ? (
              <>
                {content.steps.map((step) => (
                  <View key={step.title} style={styles.item}>
                    <Text style={styles.label}>{step.title}</Text>
                    <Text style={styles.body}>{step.body}</Text>
                  </View>
                ))}
                <View style={styles.example}>
                  <Text style={styles.label}>Try this example</Text>
                  <Text selectable style={styles.sentence}>
                    {content.example.sentence}
                  </Text>
                  <Text style={styles.body}>{content.example.body}</Text>
                </View>
                <ProgressiveDisclosure title="Other features">
                  {content.features.map(([title, body]) => (
                    <View key={title} style={styles.item}>
                      <Text style={styles.label}>{title}</Text>
                      <Text style={styles.body}>{body}</Text>
                    </View>
                  ))}
                </ProgressiveDisclosure>
                <ActionButton
                  kind="secondary"
                  label={showColumns ? "Hide column meanings" : "About these columns"}
                  onPress={() => setShowColumns(!showColumns)}
                />
              </>
            ) : null}
            {showColumns ? definitions : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: colors.surface,
    width: "100%",
    maxWidth: 760,
    maxHeight: "92%",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 23, lineHeight: 30, fontWeight: "800", flex: 1, color: colors.ink },
  close: { minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: "center" },
  closeLabel: { fontSize: 18, fontWeight: "700", color: colors.primary },
  content: { padding: spacing.md, gap: spacing.lg },
  items: { gap: spacing.md },
  item: { gap: spacing.xs },
  label: { fontSize: 19, fontWeight: "800", lineHeight: 27, color: colors.ink },
  body: { fontSize: 18, lineHeight: 28, color: colors.ink },
  sentence: { fontSize: 19, lineHeight: 28, fontWeight: "600", color: colors.primary },
  example: {
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: 12,
  },
});
