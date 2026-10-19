import { Platform, StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { hkFrequencyDisplay, inHkRange } from "../services/frequencyService";
import { textReaderSegments } from "../services/textReaderService";
import { colors, spacing } from "../theme/tokens";

interface Props {
  text: string;
  results: ResolvedOccurrence[];
  cpbEnabled: boolean;
  hkEnabled: boolean;
  customRange: { start: number; end: number } | null;
  onWordPress: (item: ResolvedOccurrence) => void;
}

export function HighlightedText({
  text,
  results,
  cpbEnabled,
  hkEnabled,
  customRange,
  onWordPress,
}: Props) {
  const segments = textReaderSegments(text, results);
  return (
    <View style={styles.box}>
      <Text selectable style={styles.text}>
        {segments.map((segment) => {
          const item = segment.occurrence;
          if (!item) return segment.text;
          const cpb = cpbEnabled ? matchCpb100(item.surface) : null;
          const owner =
            item.status === "RESOLVED" &&
            item.owners.length === 1 &&
            !item.owners[0]?.blocked &&
            !item.owners[0]?.display_blocked
              ? item.owners[0]
              : null;
          const rank = owner?.current_hk_frequency_rank ?? null;
          const hk = hkEnabled && owner ? hkFrequencyDisplay(rank) : null;
          const custom = customRange ? inHkRange(rank, customRange.start, customRange.end) : false;
          const labels = [
            cpb ? `CPB 100 rank ${cpb.rank}` : null,
            hk?.label,
            custom ? `HK ranks ${customRange?.start} to ${customRange?.end}` : null,
          ].filter(Boolean);
          const keyboard =
            Platform.OS === "web"
              ? {
                  onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onWordPress(item);
                    }
                  },
                }
              : {};
          return (
            <Text
              key={segment.key}
              accessibilityRole="link"
              tabIndex={0}
              accessibilityLabel={`${item.surface}${labels.length ? `: ${labels.join(", ")}` : ""}`}
              onPress={() => onWordPress(item)}
              {...keyboard}
              style={[
                styles.token,
                cpb && styles.cpb,
                hk?.band === "top-1k" && styles.hkTop,
                hk?.band === "next-1k" && styles.hkNext,
                hk?.band === "later" && styles.hkLater,
                custom && styles.custom,
              ]}
            >
              {segment.text}
            </Text>
          );
        })}
      </Text>
      {cpbEnabled || hkEnabled || customRange ? (
        <View accessibilityLabel="Highlight legend" style={styles.legend}>
          {cpbEnabled ? <Text style={[styles.legendItem, styles.cpb]}>★ CPB 100</Text> : null}
          {hkEnabled ? (
            <>
              <Text style={[styles.legendItem, styles.hkTop]}>● HK Top 1k</Text>
              <Text style={[styles.legendItem, styles.hkNext]}>◆ HK Next 1k</Text>
              <Text style={[styles.legendItem, styles.hkLater]}>▨ HK rank 2,001+</Text>
            </>
          ) : null}
          {customRange ? (
            <Text style={[styles.legendItem, styles.custom]}>
              ◎ HK {customRange.start}–{customRange.end}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  text: { color: colors.ink, fontSize: 18, lineHeight: 32 },
  token: { borderRadius: 3, overflow: "hidden" },
  cpb: { backgroundColor: colors.cpbSoft, color: colors.cpb, textDecorationLine: "underline" },
  hkTop: { backgroundColor: colors.hkTopSoft, color: colors.hkTop },
  hkNext: { backgroundColor: colors.hkNextSoft, color: colors.hkNext },
  hkLater: { backgroundColor: colors.hkLaterSoft, color: colors.hkLater },
  custom: {
    backgroundColor: colors.customSoft,
    color: colors.custom,
    textDecorationLine: "underline",
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingTop: spacing.sm },
  legendItem: {
    borderRadius: 7,
    fontSize: 14,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
