export interface OcrRecognitionResult {
  text: string;
  lineCount: number;
  provider: string;
  processedOnDevice: boolean;
}

export interface OcrAdapter {
  readonly provider: string;
  readonly processedOnDevice: boolean;
  isSupported(): boolean;
  recognizeImage(uri: string): Promise<OcrRecognitionResult>;
}

export function linesToEditableText(lines: readonly string[]): string {
  return lines
    .map((line) => line.replace(/\r\n?/g, "\n").trim())
    .filter(Boolean)
    .join("\n");
}

export async function recognizeToEditableText(
  adapter: OcrAdapter,
  uri: string,
): Promise<OcrRecognitionResult> {
  if (!adapter.isSupported()) {
    throw new Error("On-device OCR is not supported in this build.");
  }
  if (!uri.trim()) throw new Error("The selected image has no local URI.");
  const result = await adapter.recognizeImage(uri);
  if (!result.text.trim()) throw new Error("No text was recognized. Try a clearer image.");
  return result;
}
