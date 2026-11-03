/** Local user-selected text only: no lookup, family substitution or metadata export. */
export interface CopyItem {
  selectedForms?: readonly string[];
  selected_forms?: readonly string[];
  notes?: string;
  connections?: string;
  customOrder?: number;
  order?: number;
  teachingFocus?: string;
  teaching_focus?: string;
}
export function selectedWordsText(items: readonly CopyItem[], withNotes = false) {
  let count = 0, skipped = 0;
  const blocks: string[] = [];
  const ordered = [...items].sort((a,b) => (a.customOrder ?? a.order ?? 0)-(b.customOrder ?? b.order ?? 0));
  for (const item of ordered) {
    const forms=(item.selectedForms ?? item.selected_forms ?? []).filter((s):s is string => typeof s === "string" && Boolean(s.trim())).map(s=>s.trim());
    if (!forms.length) {skipped++;continue;}
    count+=forms.length;
    if (!withNotes) {blocks.push(...forms);continue;}
    const lines=[forms.join(", ")];
    const focus=item.teachingFocus ?? item.teaching_focus;
    if(focus === "focus" || focus === "mention")lines.push("Teaching focus: "+(focus === "focus" ? "Teach in depth" : "Briefly introduce"));
    if(typeof item.notes === "string" && item.notes.trim())lines.push("Note: "+item.notes.trim().replace(/\r\n/g,"\n"));
    if(typeof item.connections === "string" && item.connections.trim())lines.push("Related/example: "+item.connections.trim().replace(/\r\n/g,"\n"));
    blocks.push(lines.join("\n"));
  }
  return {text:blocks.join(withNotes ? "\n\n" : "\n"),count,skipped};
}
export async function copyPlainText(text: string, writer?: (text: string) => Promise<void>): Promise<boolean> {
  if(!text)return false;
  const write=writer ?? (typeof navigator !== "undefined" && navigator.clipboard?.writeText
    ? (value:string) => navigator.clipboard.writeText(value) : undefined);
  if(!write)return false;
  try {await write(text);return true;}catch{return false;}
}
