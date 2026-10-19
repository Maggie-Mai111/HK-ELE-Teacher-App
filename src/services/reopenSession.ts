export interface SessionWork {
  text: boolean;
  ocr: boolean;
  knowledge: boolean;
}
export const EMPTY_SESSION_WORK: SessionWork = { text: false, ocr: false, knowledge: false };

export function reopenAction(
  work: SessionWork,
  lessonSaved: boolean,
  busy: boolean,
): "blocked" | "confirm" | "reopen" {
  if (!lessonSaved || busy) return "blocked";
  return work.text || work.ocr || work.knowledge ? "confirm" : "reopen";
}
export function sessionWorkDescription(work: SessionWork): string {
  const labels = [
    work.text && "current text",
    work.ocr && "photo-recognition work",
    work.knowledge && "word-knowledge answers",
  ].filter(Boolean) as string[];
  if (labels.length < 2) return labels[0] ?? "";
  return labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
}
