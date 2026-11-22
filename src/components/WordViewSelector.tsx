import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { ChoiceChip } from "./ChoiceChip";
import content from "../content/teacherHelp.json";
import { getWordView, setWordView, subscribeWordView, wordViewLabels } from "../services/wordView";

export function WordViewSelector() {
  const view = useSyncExternalStore(subscribeWordView, getWordView, getWordView);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 17, fontWeight: "700" }}>Vocabulary set</Text>
      <View accessibilityLabel="Vocabulary set" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ChoiceChip label={wordViewLabels.all} selected={view === "all"} onPress={() => setWordView("all")} />
        <ChoiceChip label={wordViewLabels.familiar} selected={view === "familiar"} onPress={() => setWordView("familiar")} />
      </View>
      <Text style={{ fontSize: 16, lineHeight: 23 }}>{content.vocabularySetHint}</Text>
    </View>
  );
}
