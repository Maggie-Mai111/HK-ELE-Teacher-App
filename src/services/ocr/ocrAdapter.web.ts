import type { OcrAdapter } from "./OcrContract";
import { recognizeBrowserImage } from "./browserOcr";

export const ocrAdapter: OcrAdapter = {
  provider: "On-device English photo recognition",
  processedOnDevice: true,
  isSupported: () => typeof document !== "undefined" && typeof Worker !== "undefined",
  async recognizeImage(uri, options) {
    const text = await recognizeBrowserImage(uri, options);
    return {
      text,
      lineCount: text.split(/\r?\n/).filter((line) => line.trim()).length,
      provider: this.provider,
      processedOnDevice: true,
    };
  },
};
