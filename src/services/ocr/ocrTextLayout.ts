/** Formatting of OCR output only. Never run this over teachers' pasted/edited text. */
export function joinOcrWrappedLines(raw: string): string {
  const lines=raw.replace(/\r\n?/g,"\n").split("\n").map(line=>line.trim());
  const listItem=/^(?:[•●▪◦*–—-]\s+|(?:\d+|[A-Za-z])[.)]\s+)/;
  let output="",previous="";
  for(let i=0;i<lines.length;i++){
    const line=lines[i]!;
    if(!line){
      const next=lines.slice(i+1).find(Boolean)??"";
      // OCR can misread a physical line gap as a paragraph inside a sentence.
      // Keep true sentence/heading/list boundaries and offer the original view.
      const amountContinuation=/,$/.test(previous)&&/^(?:[£$€¥]\s*)?\d/.test(next)&&!listItem.test(next);
      if(/[A-Za-z0-9,\-]$/.test(previous)&&(/^[a-z]/.test(next)||amountContinuation))continue;
      if(output)output=output.trimEnd()+"\n\n";previous="";continue;
    }
    if(!output||output.endsWith("\n"))output+=line;
    else if(listItem.test(line)||/:$/.test(previous))output+="\n"+line;
    else output+=(/[-\u00ad]$/.test(previous)?"":" ")+line;
    previous=line;
  }
  return output.trim();
}
