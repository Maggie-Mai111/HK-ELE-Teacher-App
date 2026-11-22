import { StyleSheet, Text, View } from "react-native";
import type { ResolvedOccurrence } from "../domain/hkele";
import { COVERAGE_LISTS, passageCoverage, type CoverageTarget } from "../services/coverageLists";
import { colors, spacing } from "../theme/tokens";
import { ChoiceChip } from "./ChoiceChip";
import { ActionButton } from "./ActionButton";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

export function PassageCoverage({results,target,onTarget,onOutside}: {
  results:ResolvedOccurrence[]; target:CoverageTarget; onTarget:(value:CoverageTarget)=>void; onOutside:()=>void;
}) {
  const counts=passageCoverage(results,target);
  return <View style={styles.box}>
    <Text style={styles.title}>Words in this list</Text>
    <View style={styles.actions}>{(["90","95"] as const).map(value=><ChoiceChip key={value} label={COVERAGE_LISTS[value].label} selected={target===value} onPress={()=>onTarget(value)} />)}</View>
    <View accessibilityLiveRegion="polite">
      {counts.percent === null ? <Text style={styles.text}>No words to count.</Text> : <>
        <Text style={styles.value}>{Number(counts.percent.toFixed(1))}%</Text>
        <Text style={styles.text}>{counts.included} of {counts.total} {counts.total === 1 ? "word is" : "words are"} on the {target}% list.</Text>
      </>}
    </View>
    {counts.outside > 0 ? <ActionButton kind="secondary" label="Review words outside the list" onPress={onOutside} /> : null}
    <ProgressiveDisclosure title="How is this counted?">
      <Text style={styles.text}>Every word counts each time it appears, even if it has no match. Switching between all and familiar forms can change how many match, while the total stays the same.</Text>
      <Text style={styles.text}>The list names come from the study’s Hong Kong texts. The result above shows how many words on the list appear in your passage.</Text>
    </ProgressiveDisclosure>
  </View>;
}
const styles=StyleSheet.create({box:{gap:spacing.sm,padding:spacing.md,backgroundColor:colors.primarySoft,borderRadius:15},title:{fontSize:19,fontWeight:"800",color:colors.ink},value:{fontSize:30,fontWeight:"800",color:colors.ink},text:{fontSize:17,lineHeight:25,color:colors.ink},actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm}});
