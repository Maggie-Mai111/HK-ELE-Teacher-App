import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";
import { loadGzipJson } from "../data/gzipJson";
import manifest from "../../data/current-manifest.json";
import type { HkeleRepository } from "../domain/hkele";
import { recordedUseSummary } from "../services/lexicalUsePresentation";
interface Use { analysis_family: string | null; semantic_identity: string; channel: string; requires_context: number; condition: string }
function useSummary(row: Use): string {
  return recordedUseSummary(row.condition, row.channel);
}
export function LexicalUsesPanel({word, familyKey, repository}: {word: string; familyKey?: string; repository: HkeleRepository}) {
  const [loaded, setLoaded] = useState<{key: string; rows: Use[]} | null>(null);
  const key = word + "\t" + (familyKey ?? "");
  useEffect(() => {
    let active = true;
    void (async () => {
      if (await repository.getDataVersion?.() !== manifest.dataVersion) return [];
      const normalized = word.normalize("NFKC").trim().toLowerCase();
      let hash = 2166136261;
      for (const byte of new TextEncoder().encode(normalized)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
      const shard = await loadGzipJson<{dataVersion: string; uses: Record<string, Use[]>}>(`/HK-ELE-Teacher-App/hkele-data/lexical-uses/${String(hash % 128).padStart(3,"0")}.json.gz`);
      if (shard.dataVersion !== manifest.dataVersion) throw new Error("Mismatched use records");
      return [...new Map((shard.uses[normalized] ?? []).filter(r => (!familyKey || r.analysis_family === familyKey || r.analysis_family === null) && (r.requires_context || r.channel === "limited") && useSummary(r)).map(r => [r.channel + "\t" + useSummary(r),r])).values()];
    })().then(rows => {if (active) setLoaded({key,rows});}).catch(() => {if (active) setLoaded({key,rows:[]});});
    return () => {active = false;};
  },[word,familyKey,repository,key]);
  if (loaded?.key !== key || !loaded.rows.length) return null;
  return <ProgressiveDisclosure title="Recorded uses">{loaded.rows.map((row,i) => <View key={i} style={{gap:6}}><Text style={{fontSize:16,fontWeight:"700"}}>{row.channel === "limited" ? "Special use" : "Meaning and use"}</Text><Text selectable style={{fontSize:17,lineHeight:25}}>{useSummary(row)}</Text></View>)}</ProgressiveDisclosure>;
}
