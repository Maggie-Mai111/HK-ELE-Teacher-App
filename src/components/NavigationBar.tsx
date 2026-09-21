import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

export type AppRoute = "browse" | "check" | "list" | "data";

interface NavigationBarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

const items: ReadonlyArray<{ route: AppRoute; label: string }> = [
  { route: "browse", label: "Browse" },
  { route: "check", label: "Check text" },
  { route: "list", label: "Teaching list" },
  { route: "data", label: "Data" },
];

export function NavigationBar({ activeRoute, onNavigate }: NavigationBarProps) {
  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {items.map((item) => {
        const selected = item.route === activeRoute;
        return (
          <Pressable
            key={item.route}
            accessibilityLabel={`Open ${item.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onNavigate(item.route)}
            style={({ pressed }) => [
              styles.item,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{item.label}</Text>
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
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: { opacity: 0.72 },
  selected: { backgroundColor: colors.primarySoft },
  selectedLabel: { color: colors.primary },
});
