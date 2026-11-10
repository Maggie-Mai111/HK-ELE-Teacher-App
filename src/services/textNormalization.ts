import rules from "../config/textNormalization.json";
import type { SurfaceSearchResult } from "../domain/hkele";
export function isWordListForm(owner: SurfaceSearchResult["owners"][number] | undefined | null): boolean {
  return (owner?.candidate_member === true || owner?.candidate_member === 1) && owner?.matched_form_evidence?.coverage_member === 1;
}
const RULES=rules as Record<string,{forms:string[];owners:string[];ambiguous:boolean}>;
export async function normalizedAnalysis(surface:string, lookup:(form:string)=>Promise<SurfaceSearchResult>) {
  const key=surface.normalize("NFKC").toLowerCase().replace(/[’‘ʼ＇]/g,"'");
  const rule=RULES[key];
  const targets=rule ? rule.forms : [surface];
  const output=[];
  for(let i=0;i<targets.length;i++){
    const result=await lookup(targets[i]!);
    const owners=(rule ? [...result.owners,...(result.alternatives??[])] : result.owners).filter(o=>!o.blocked && (rule || !o.match_classes.includes("FAMILY_LABEL_ONLY")) && !o.match_classes.includes("CONDITIONAL_LOOKUP_ONLY"));
    const chosen=rule ? owners.find(o=>o.baseword_key===rule.owners[i]) : owners.length===1 ? owners[0] : null;
    output.push({form:targets[i]!,familyKey:chosen?.baseword_key??null,wordListMember:chosen?isWordListForm(chosen):false});
  }
  return {applied:Boolean(rule),ambiguous:Boolean(rule?.ambiguous),tokens:output};
}
export function normalizedCounts(items:Array<{normalizedAnalysis?:{tokens:Array<{familyKey:string|null;wordListMember:boolean}>}}> ){
 let tokens=0,matched=0,wordList=0;const families=new Set();
 for(const item of items){const analysis=item.normalizedAnalysis;if(!analysis)continue;for(const token of analysis.tokens){tokens++;if(token.familyKey){matched++;families.add(token.familyKey);if(token.wordListMember)wordList++;}}}
 return {tokens,matched,wordList,families:families.size};
}

export function analysisSurface(text:string,start:number,end:number){
 for(const word of Object.keys(RULES).filter(w=>w.includes("-"))){
  for(const match of text.matchAll(new RegExp("\\b"+word+"\\b","gi"))){
   const offset=match.index!;
   if(start>=offset && end<=offset+word.length)return start===offset ? match[0] : null;
  }
 }
 return text.slice(start,end);
}