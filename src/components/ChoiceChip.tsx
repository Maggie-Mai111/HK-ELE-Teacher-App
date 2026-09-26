import { Pressable, StyleSheet, Text } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function ChoiceChip({ label, selected, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  selectedLabel: { color: colors.primary },
});
