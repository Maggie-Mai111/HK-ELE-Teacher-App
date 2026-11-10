import type {TokenOccurrence} from "../domain/contracts";
import type {HkeleRepository,BrowseRequest,BrowseScope,FamilyRecord} from "../domain/hkele";
import { familiarFamily,familiarForm,projectWordView,viewCounts,type WordView } from "../services/wordView";
import {inCoverageFamily} from "../services/coverageLists";
export class WordViewRepository implements HkeleRepository {
 constructor(private readonly base:HkeleRepository,private readonly view:WordView,private readonly retainedForm?:string){}
 getDataMode(){return this.base.getDataMode();}
 getDataVersion(){return this.base.getDataVersion?.()??Promise.resolve("");}
 async aiFilterFamilies(scope:BrowseScope="full"){
  const rows=(await this.base.aiFilterFamilies!("full")).filter(f=>familiarFamily(f.baseword_key)).map(f=>projectWordView(f,this.view));
  return scope==="full"?rows:rows.filter(f=>inCoverageFamily(f,scope==="core95"?"95":"90"));
 }
 aiFilterCpbFamilyKeys(scope?:BrowseScope){return this.base.aiFilterCpbFamilyKeys!(scope);}
 async browse(request:BrowseRequest){
  const rows=await this.aiFilterFamilies(request.scope);const field=request.sort==="az"?"display_family":request.sort==="hk"?"current_hk_frequency_rank":"overall_frequency_order";
  rows.sort((a,b)=>{const x=a[field],y=b[field];return x==null?y==null?a.baseword_key.localeCompare(b.baseword_key):1:y==null?-1:typeof x==="string"?x.localeCompare(String(y),"en"):Number(x)-Number(y)||a.baseword_key.localeCompare(b.baseword_key);});
  const total=request.scope==="full"?viewCounts(this.view).full:rows.length;const from=(request.page-1)*request.pageSize;
  return {...request,totalItems:total,availableItems:total,families:rows.slice(from,from+request.pageSize),sourceMode:this.getDataMode()};
 }
 async getFamily(key:string){const d=await this.base.getFamily(key);return {...d,family:projectWordView(d.family,this.view),forms:d.forms.filter(f=>familiarForm(key,f.normalized_form)||f.normalized_form===this.retainedForm?.normalize("NFKC").trim().toLowerCase())};}
 getWordFormFrequencies(key:string){return this.base.getWordFormFrequencies!(key);}
 async searchSurface(word:string){
  const result=await this.base.searchSurface(word);const owners=result.owners.filter(o=>o.match_classes.includes("FAMILY_LABEL_ONLY")?familiarFamily(o.baseword_key):familiarForm(o.baseword_key,String(o.matched_form_evidence?.normalized_form??o.matched_form_evidence?.form??word))).map(o=>projectWordView(o,this.view));
  return {...result,owners,alternatives:result.alternatives.map(o=>projectWordView(o,this.view)),best_owner_count:owners.length,status:owners.length>1?"AMBIGUOUS" as const:owners.length?"RESOLVED" as const:result.expression?"REGISTERED_EXPRESSION" as const:"UNMATCHED" as const};
 }
 async resolveOccurrences(text:string,tokens:TokenOccurrence[]){return(await this.base.resolveOccurrences(text,tokens)).map(item=>({...item,owners:item.owners.map(o=>projectWordView(o,this.view)),alternatives:item.alternatives.map(o=>projectWordView(o,this.view)),...(item.normalizedAnalysis?{normalizedAnalysis:{...item.normalizedAnalysis,tokens:item.normalizedAnalysis.tokens.map(t=>({...t,wordListMember:t.familyKey?familiarForm(t.familyKey,t.form)&&Boolean((projectWordView({baseword_key:t.familyKey} as FamilyRecord,this.view)).candidate_member):false}))}}:{})}));}
}
