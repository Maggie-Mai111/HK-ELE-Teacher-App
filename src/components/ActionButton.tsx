import { Pressable, StyleSheet, Text } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "danger";
  accessibilityLabel?: string;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  kind = "primary",
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        kind === "primary" && styles.primary,
        kind === "secondary" && styles.secondary,
        kind === "danger" && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          kind === "primary" ? styles.primaryLabel : styles.secondaryLabel,
          kind === "danger" && styles.dangerLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  dangerLabel: { color: colors.danger },
  disabled: { opacity: 0.46 },
  label: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.72 },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  primaryLabel: { color: colors.surface },
  secondary: { backgroundColor: colors.surface, borderColor: colors.primary },
  secondaryLabel: { color: colors.primary },
});
