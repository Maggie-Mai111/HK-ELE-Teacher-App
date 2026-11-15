import assert from "node:assert/strict";
import test from "node:test";

import { recognizeBrowserImage } from "../src/services/ocr/browserOcr.js";

test("browser OCR detects page layout, bounds image size and releases cancelled workers", async () => {
  const saved = new Map(
    ["Image", "document", "window"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const sizes: number[][] = [];
  const calls: string[] = [];
  let dimensions = [844, 740];
  let abortDuringLayout: AbortController | undefined;
  const text = "Schools going green.\nWind energy can be used later. £250,000";
  const worker = {
    async setParameters(parameters: { tessedit_pageseg_mode: string }) {
      calls.push(`layout:${parameters.tessedit_pageseg_mode}`);
      abortDuringLayout?.abort();
    },
    async recognize() {
      calls.push("recognize");
      return { data: { text } };
    },
    async terminate() {
      calls.push("terminate");
    },
  };
  try {
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: class {
        width = dimensions[0];
        height = dimensions[1];
        src = "";
        async decode() {}
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { Tesseract: { createWorker: async () => worker } },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        baseURI: "https://example.test/HK-ELE-Teacher-App/",
        head: { appendChild: (script: { onload(): void }) => script.onload() },
        createElement(tag: string) {
          if (tag === "script") return {};
          assert.equal(tag, "canvas");
          const canvas = {
            width: 0,
            height: 0,
            getContext: () => ({ fillRect() {}, drawImage() {} }),
            toDataURL: () => {
              sizes.push([canvas.width, canvas.height]);
              return "data:image/png;base64,fixture";
            },
          };
          return canvas;
        },
      },
    });
    assert.equal(await recognizeBrowserImage("blob:small-page"), text);
    assert.deepEqual(sizes.pop(), [1688, 1480]);
    assert.deepEqual(calls.splice(0), ["layout:3", "recognize", "terminate"]);
    dimensions = [6000, 4000];
    await recognizeBrowserImage("blob:large-page");
    assert.deepEqual(sizes.pop(), [2800, 1867]);
    assert.deepEqual(calls.splice(0), ["layout:3", "recognize", "terminate"]);
    abortDuringLayout = new AbortController();
    await assert.rejects(
      recognizeBrowserImage("blob:cancel-page", { signal: abortDuringLayout.signal }),
      { name: "AbortError" },
    );
    assert.deepEqual(calls, ["layout:3", "terminate"]);
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
