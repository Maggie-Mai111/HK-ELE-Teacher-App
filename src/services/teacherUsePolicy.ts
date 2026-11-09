import policy from "../config/teacherUsePolicy.json";
import type { SurfaceSearchResult } from "../domain/hkele";
const POLICY=policy as Record<string,{secondary:string[]}>;
export interface MatchContext {text:string;start:number;end:number}
export function teacherUseKeys(surface:string,keys:readonly string[],ctx?:MatchContext):string[]{
  const key=surface.normalize("NFKC").toLowerCase();
  const rule=POLICY[key];
  if(!rule || keys.length<2)return [...keys];
  if(ctx){
    const before=ctx.text.slice(0,ctx.start),after=ctx.text.slice(ctx.end);
    const quoted=/["'“‘]\s*$/.test(before)&&/^\s*["'”’]/.test(after);
    const letter=key.length===1&&(/\b(?:letter|symbol|variable|option|grade|section|point)\s*$/i.test(before)||/^\s*[=+*/<>]/.test(after));
    const historical=/\b(?:archaic|obsolete|dialect|pronounced|spelled|spelt)\s*$/i.test(before);
    const nounHas=key==="has"&&(/\b(?:the|these|those|several|many|two|three)\s*$/i.test(before)||/^\s+(?:are|were)\b/i.test(after));
    const interjection=key==="wall"&&/(?:^|[.!?][\s"“]*)$/.test(before)&&/^\s*,/.test(after);
    if(quoted||letter||historical||nounHas||interjection)return [...keys];
  }else if(key.length===1&&surface!==surface.toLowerCase())return [...keys];
  const preferred=keys.filter(k=>!rule.secondary.includes(k));
  return preferred.length ? preferred : [...keys];
}
export function teacherUseResult(result:SurfaceSearchResult,ctx?:MatchContext):SurfaceSearchResult {
 if(result.status!=="RESOLVED"&&result.status!=="AMBIGUOUS")return result;
 const mark="SECONDARY_RECORDED_READING";
 const restored=result.alternatives.filter(o=>o.match_classes.includes(mark)).map(o=>({...o,match_classes:o.match_classes.filter(c=>c!==mark)}));
 const pool=[...result.owners,...restored];
 const preferred=new Set(teacherUseKeys(result.submittedQuery,pool.map(o=>o.baseword_key),ctx));
 const owners=pool.filter(o=>preferred.has(o.baseword_key));
 const moved=pool.filter(o=>!preferred.has(o.baseword_key)).map(o=>({...o,match_classes:[...o.match_classes,mark]}));
 const allowed=owners.filter(o=>!o.blocked);
 return {...result,owners,alternatives:[...result.alternatives.filter(o=>!o.match_classes.includes(mark)),...moved],bestOwnerCount:allowed.length,status:allowed.length>1?"AMBIGUOUS":allowed.length?"RESOLVED":"BLOCKED"};
}
