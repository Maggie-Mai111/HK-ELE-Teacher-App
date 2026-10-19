import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

export type AppRoute = "home" | "browse" | "check" | "list" | "data" | "offline";

interface NavigationBarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  lessonWordCount?: number;
}

const items: ReadonlyArray<{ route: AppRoute; label: string }> = [
  { route: "home", label: "Home" },
  { route: "check", label: "Check a text" },
  { route: "browse", label: "Find words" },
  { route: "list", label: "Teaching list" },
];

export function NavigationBar({
  activeRoute,
  onNavigate,
  lessonWordCount = 0,
}: NavigationBarProps) {
  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {items.map((item) => {
        const selected = item.route === activeRoute;
        return (
          <Pressable
            key={item.route}
            accessibilityLabel={`Open ${item.label}${item.route === "list" && lessonWordCount > 0 ? `, ${lessonWordCount} selected ${lessonWordCount === 1 ? "word" : "words"}` : ""}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onNavigate(item.route)}
            style={({ pressed }) => [
              styles.item,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {item.label}
              {item.route === "list" && lessonWordCount > 0 ? ` (${lessonWordCount})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  item: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    flex: 1,
    maxWidth: 150,
    minWidth: 72,
    paddingHorizontal: spacing.xs,
  },
  label: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  pressed: { opacity: 0.72 },
  selected: { backgroundColor: colors.primarySoft },
  selectedLabel: { color: colors.primary },
});
