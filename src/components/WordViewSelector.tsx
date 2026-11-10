import {useSyncExternalStore} from "react";
import {View,Text} from "react-native";
import {ChoiceChip} from "./ChoiceChip";
import {ProgressiveDisclosure} from "./ProgressiveDisclosure";
import content from "../content/teacherHelp.json";
import {getWordView,setWordView,subscribeWordView} from "../services/wordView";
export function WordViewSelector(){
 const view=useSyncExternalStore(subscribeWordView,getWordView,getWordView),help=content.viewHelp;
 return <View style={{gap:8}}>
  <View accessibilityLabel="Vocabulary view" style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
   <ChoiceChip label="All words" selected={view==="all"} onPress={()=>setWordView("all")}/>
   <ChoiceChip label="Familiar words" selected={view==="familiar"} onPress={()=>setWordView("familiar")}/>
  </View>
  <Text style={{fontSize:16,lineHeight:23}}>{view==="familiar"?help.familiarHint:help.allHint}</Text>
  <ProgressiveDisclosure title={help.title}>
   {help.paragraphs.map(text=><Text key={text} style={{fontSize:17,lineHeight:25}}>{text}</Text>)}
  </ProgressiveDisclosure>
 </View>;
}
