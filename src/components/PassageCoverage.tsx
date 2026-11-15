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
    <Text accessibilityLiveRegion="polite" style={styles.value}>{counts.percent===null?"—":`${Number(counts.percent.toFixed(1))}%`}</Text>
    <Text style={styles.text}>{counts.included} of {counts.total} word occurrences · this text</Text>
    {counts.outside>0?<ActionButton kind="secondary" label={`View words outside this list (${counts.outside})`} onPress={onOutside}/>:null}
    <ProgressiveDisclosure title="How is this counted?">
      <Text style={styles.text}>Each word counts every time it appears. Compounds and unmatched words stay in the total.</Text>
      <Text style={styles.text}>Only spellings in your selected list count towards its percentage. Highlighting does not change it.</Text>
      <Text style={styles.text}>The 90% and 95% names refer to the study’s Hong Kong texts. This percentage is for your text, not what students know.</Text>
    </ProgressiveDisclosure>
  </View>;
}
const styles=StyleSheet.create({box:{gap:spacing.sm,padding:spacing.md,backgroundColor:colors.primarySoft,borderRadius:15},title:{fontSize:19,fontWeight:"800",color:colors.ink},value:{fontSize:30,fontWeight:"800",color:colors.ink},text:{fontSize:17,lineHeight:25,color:colors.ink},actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm}});
