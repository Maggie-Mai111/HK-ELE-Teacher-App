import data from "../config/wordViews.json";
export type WordView = "all" | "familiar";
let current: WordView = "all";
const listeners = new Set<() => void>();
export const getWordView = () => current;
export function setWordView(value: WordView) { if(value!==current){current=value;listeners.forEach(fn=>fn());} }
export const subscribeWordView = (fn:()=>void) => {listeners.add(fn);return ()=>{listeners.delete(fn);};};
export const viewCounts = (view:WordView=current) => data.counts[view];
const records=data.families as Record<string,unknown[]>;
const words=data.members as Record<string,string[]>;
export const familiarForm=(key:string,form:string)=>Boolean(words[key]?.includes(form.normalize("NFKC").trim().toLowerCase()));
export const viewAllowsForm=(key:string,form:string)=>current==="all"||familiarForm(key,form);
export const familiarFamily=(key:string)=>Boolean(records[key]);
export function projectWordView<T extends {baseword_key:string;[key:string]:unknown}>(item:T,view:WordView=current):T {
 if(view==="all")return item;
 const row=records[item.baseword_key];const values=Object.fromEntries(data.fields.map((field,i)=>[field,row?.[i]??null]));
 const evidence=item.matched_form_evidence as Record<string,unknown>|null|undefined;
 return {...item,...values,candidate_member:row?.[4]??0,reference_member:row?.[5]??0,word_list_member:row?.[4]??0,set_membership:row?.[6]??"Full database",word_view:view,
  ...(evidence?{matched_form_evidence:{...evidence,coverage_member:familiarForm(item.baseword_key,String(evidence.normalized_form??evidence.form??""))?1:0}}:{})};
}
