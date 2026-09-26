import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

export function AppMenu({ onOpenAbout }: { onOpenAbout: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<View>(null);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const wrapper = wrapperRef.current as unknown as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (!wrapper?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside, true);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside, true);
    };
  }, [open]);
  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <Pressable
        accessibilityLabel={open ? "Close menu" : "Open menu"}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Menu</Text>
      </Pressable>
      {open ? (
        <View accessibilityLabel="Application menu" style={styles.menu}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              onOpenAbout();
            }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuTitle}>About &amp; data version</Text>
            <Text style={styles.menuNote}>Version, sources, licence and privacy</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  buttonText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  menu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 240,
    padding: spacing.xs,
    position: "absolute",
    right: 0,
    top: 48,
    zIndex: 20,
  },
  menuItem: { borderRadius: 9, gap: 2, minHeight: 48, padding: spacing.sm },
  menuNote: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  menuTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  wrapper: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    zIndex: 20,
  },
});
