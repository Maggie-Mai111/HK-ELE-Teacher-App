import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { TeachingListItem } from "../domain/teachingList";
import { copyPlainText, selectedWordsText } from "../services/selectedWordsCopy";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

export function CopySelectedWords({items,onReview}: {items: TeachingListItem[];onReview?:()=>void}) {
  const [message,setMessage]=useState("");
  const [manual,setManual]=useState("");
  const request=useRef(0);
  useEffect(()=>{request.current++;setMessage("");setManual("");},[items]);
  const count=selectedWordsText(items).count;
  const copy=async(withNotes:boolean)=>{
    const snapshot=selectedWordsText(items,withNotes),id=++request.current;
    if(!snapshot.count)return;
    const copied=await copyPlainText(snapshot.text);
    if(id!==request.current)return;
    setManual(copied ? "" : snapshot.text);
    const skipped=snapshot.skipped ? ` Choose a word for ${snapshot.skipped} saved ${snapshot.skipped===1 ? "entry" : "entries"}.` : "";
    setMessage((copied ? `Copied ${snapshot.count} ${snapshot.count===1 ? "word" : "words"}${withNotes ? " with notes" : ""}.` : "Select the text below, then copy.")+skipped);
  };
  return <View style={styles.box}>
    <View style={styles.actions}>
      <ActionButton label={`Copy words (${count})`} disabled={!count} onPress={()=>void copy(false)} />
      <ActionButton kind="secondary" label="Copy with notes" disabled={!count} onPress={()=>void copy(true)} />
      {onReview ? <ActionButton kind="secondary" label={`Review selected words (${count})`} onPress={onReview} /> : null}
    </View>
    {message ? <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text> : null}
    {manual ? <TextInput accessibilityLabel="Text to copy" multiline readOnly selectTextOnFocus value={manual} style={styles.manual} /> : null}
  </View>;
}
const styles=StyleSheet.create({
  box:{gap:spacing.sm,width:"100%"},actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  note:{color:colors.primary,fontSize: 17,lineHeight: 25},
  manual:{color:colors.ink,fontSize: 19,lineHeight: 28,minHeight:100,borderWidth:1,borderColor:colors.border,borderRadius:10,padding:spacing.sm,backgroundColor:colors.surface},
});
