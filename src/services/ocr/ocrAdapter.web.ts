import type { OcrAdapter } from "./OcrContract";

export const ocrAdapter: OcrAdapter = {
  provider: "Native OCR unavailable on Web",
  processedOnDevice: true,
  isSupported: () => false,
  async recognizeImage() {
    throw new Error(
      "On-device OCR is available only in the Android and iOS development or release builds.",
    );
  },
};
