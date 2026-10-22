import { StyleSheet, Text, View } from "react-native";
import {
  evidenceTokenValues,
  subjectTokens,
  type EvidenceTokenKind,
} from "../services/evidenceTokens";

export function EvidenceTokens({ value, kind }: { value: unknown; kind: EvidenceTokenKind }) {
  const values = evidenceTokenValues(value, kind);
  if (!values.length) return <Text style={styles.missing}>—</Text>;
  return (
    <View style={styles.tags}>
      {values.map((text, index) => {
        const tone =
          kind === "subject"
            ? (subjectTokens.find(([label]) => label === text)?.[1] ?? "subject")
            : kind;
        return (
          <Text selectable key={`${text}-${index}`} style={[styles.token, styles[tone]]}>
            {text}
          </Text>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5, maxWidth: "100%" },
  token: {
    maxWidth: "100%",
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderRadius: 6,
    overflow: "hidden",
  },
  missing: { fontSize: 16, color: "#466353" },
  english: { backgroundColor: "#E9F1FF", color: "#274B80", borderColor: "#C8DAF1" },
  health: { backgroundColor: "#FAEAF0", color: "#813B59", borderColor: "#EAC7D5" },
  math: { backgroundColor: "#FFF3D9", color: "#725417", borderColor: "#E9D5A2" },
  science: { backgroundColor: "#E3F3EC", color: "#235E45", borderColor: "#BADBCB" },
  social: { backgroundColor: "#EEEAFA", color: "#58457C", borderColor: "#D3C9EB" },
  root: { backgroundColor: "#EAF0F6", color: "#344F6B", borderColor: "#CBD6E3", fontWeight: "700" },
  meaning: { backgroundColor: "#FFF4E7", color: "#71502F", borderColor: "#E9D6BE" },
  subject: { backgroundColor: "#EDF3F0", color: "#365647", borderColor: "#CBDAD2" },
});
