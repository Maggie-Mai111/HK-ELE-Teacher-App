interface Box { x0: number; y0: number; x1: number; y1: number }
interface OcrWord { text: string; bbox: Box }
interface OcrLine { text: string; words: OcrWord[]; bbox: Box }
export interface OcrPageBlock { paragraphs: { lines: OcrLine[] }[] }

/** Remove repeated gutter numbers only when word geometry separates them from body text. */
export function removeOcrMarginNumbers(raw: string, blocks?: readonly OcrPageBlock[] | null): string {
  if (!blocks?.length) return raw;
  const lines = blocks.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines));
  const body = lines.map(line => ({
    line,
    words: line.words.filter(word => /[A-Za-z]{2}/.test(word.text)),
  })).filter(item => item.words.length >= 3);
  const candidates = lines.flatMap((line, index) => {
    const word = line.words[0];
    if (!word || !/^\d{1,3}[.)]?$/.test(word.text.trim())) return [];
    const value = Number.parseInt(word.text, 10);
    if (value <= 0 || value % 5 !== 0) return [];
    const height = Math.max(1, word.bbox.y1 - word.bbox.y0);
    const centre = (word.bbox.y0 + word.bbox.y1) / 2;
    const besideText = body.some(item => {
      const first = item.words[0]!;
      const textHeight = Math.max(1, item.line.bbox.y1 - item.line.bbox.y0);
      const textCentre = (item.line.bbox.y0 + item.line.bbox.y1) / 2;
      return Math.abs(centre - textCentre) <= Math.max(height, textHeight) * 0.7
        && first.bbox.x0 - word.bbox.x1 >= Math.max(height, textHeight) * 0.5;
    });
    return besideText ? [{index, line, word, height}] : [];
  });
  const remove = new Set(candidates.filter(candidate => {
    const gutter = candidates.filter(other =>
      Math.abs(other.word.bbox.x0 - candidate.word.bbox.x0) <= Math.max(other.height, candidate.height) * 0.5,
    );
    // Punctuated exercise numbers alone are insufficient evidence of line numbering.
    return gutter.length >= 2 && gutter.some(item => /^\d+$/.test(item.word.text.trim()));
  }).map(candidate => candidate.index));
  if (!remove.size) return raw;

  const output = raw.replace(/\r\n?/g, "\n").split("\n");
  let cursor = 0;
  for (const [index, line] of lines.entries()) {
    const source = line.text.trim();
    const position = output.findIndex((text, row) => row >= cursor && text.trim() === source);
    if (position < 0) continue;
    cursor = position + 1;
    if (!remove.has(index)) continue;
    const word = line.words[0]!.text.trim();
    if (source.startsWith(word)) output[position] = source.slice(word.length).trimStart();
  }
  return output.join("\n");
}
