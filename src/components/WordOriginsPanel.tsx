import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";
import { lookupWordOrigins } from "../services/wordOrigins";
import type { WordOrigins } from "../services/wordOriginsContract";
import type { HkeleRepository } from "../domain/hkele";
import { colors, spacing } from "../theme/tokens";

export function WordOriginsPanel({
  familyKey,
  word,
  normalizedForm,
  repository,
}: {
  familyKey: string;
  word: string;
  normalizedForm: string;
  repository: HkeleRepository;
}) {
  const key = `${familyKey}\t${normalizedForm}`;
  const [loaded, setLoaded] = useState<{ key: string; record: WordOrigins | null } | null>(null);
  useEffect(() => {
    let active = true;
    void (async () =>
      lookupWordOrigins(familyKey, normalizedForm, (await repository.getDataVersion?.()) ?? ""))()
      .then((record) => {
        if (active) setLoaded({ key, record });
      })
      .catch(() => {
        if (active) setLoaded({ key, record: null });
      });
    return () => {
      active = false;
    };
  }, [familyKey, normalizedForm, repository, key]);
  const record = loaded?.key === key ? loaded.record : null;
  if (!record) return null;
  return (
    <ProgressiveDisclosure key={key} title="Word origins">
      <Text style={styles.intro}>Explore the earlier forms behind {word}.</Text>
      {record.origins.map((origin) => (
        <View key={origin.slot} style={styles.item}>
          <Text style={styles.language}>{origin.language || "Origin form"}</Text>
          <Text selectable style={styles.form}>
            {origin.form}
          </Text>
          <Text selectable style={styles.meaning}>
            {origin.meaning || "—"}
          </Text>
        </View>
      ))}
    </ProgressiveDisclosure>
  );
}
const styles = StyleSheet.create({
  intro: { color: colors.ink, fontSize: 19, lineHeight: 28 },
  item: { backgroundColor: colors.canvas, borderRadius: 10, padding: spacing.md, gap: spacing.xs },
  language: { color: colors.primary, fontSize: 17, fontWeight: "700" },
  form: { color: colors.ink, fontSize: 21, lineHeight: 29, fontWeight: "700" },
  meaning: { color: colors.ink, fontSize: 19, lineHeight: 28 },
});
