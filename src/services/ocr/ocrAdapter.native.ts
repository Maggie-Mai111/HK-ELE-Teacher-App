import { extractTextFromImage, isSupported } from "expo-text-extractor";

import { linesToEditableText, type OcrAdapter } from "./OcrContract";

export const ocrAdapter: OcrAdapter = {
  provider: "Android ML Kit / Apple Vision",
  processedOnDevice: true,
  isSupported: () => isSupported,
  async recognizeImage(uri) {
    const lines = await extractTextFromImage(uri);
    return {
      text: linesToEditableText(lines),
      lineCount: lines.filter((line) => line.trim()).length,
      provider: this.provider,
      processedOnDevice: this.processedOnDevice,
    };
  },
};
