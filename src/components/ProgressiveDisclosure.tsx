import type { PropsWithChildren } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface Props extends PropsWithChildren {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
}

export function ProgressiveDisclosure({ title, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.box}>
      <Pressable
        accessibilityLabel={`${open ? "Hide" : "Show"} ${title}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" aria-level={2} style={styles.title}>
            {title}
          </Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Text aria-hidden style={styles.chevron}>
          {open ? "Hide −" : "Show +"}
        </Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, padding: spacing.md, paddingTop: 0 },
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
  },
  chevron: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  pressed: { backgroundColor: colors.primarySoft },
  summary: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800", lineHeight: 26 },
  titleGroup: { flex: 1, gap: spacing.xs },
  trigger: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 48,
    padding: spacing.md,
  },
});
