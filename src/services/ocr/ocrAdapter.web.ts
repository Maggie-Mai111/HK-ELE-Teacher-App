import type { OcrAdapter } from "./OcrContract";
import { recognizeBrowserImage } from "./browserOcr";

export const ocrAdapter: OcrAdapter = {
  provider: "On-device English photo recognition",
  processedOnDevice: true,
  isSupported: () => typeof document !== "undefined" && typeof Worker !== "undefined",
  async recognizeImage(uri, options) {
    let originalText: string | undefined;
    const text = await recognizeBrowserImage(uri, {...options, onOriginalText: value => { originalText = value; }});
    return {
      text,
      originalText: originalText ?? text,
      lineCount: text.split(/\r?\n/).filter((line) => line.trim()).length,
      provider: this.provider,
      processedOnDevice: true,
    };
  },
};
