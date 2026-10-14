interface BrowserOcrWorker {
  recognize(image: string): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}
interface BrowserOcrEngine {
  createWorker(
    language: string,
    mode: number,
    options: {
      workerPath: string;
      corePath: string;
      langPath: string;
      logger: (message: { status: string; progress: number }) => void;
    },
  ): Promise<BrowserOcrWorker>;
}
let enginePromise: Promise<BrowserOcrEngine> | null = null;
export function localImageUri(uri: string): boolean {
  return uri.startsWith("blob:") || /^data:image\/(?:png|jpe?g|webp|gif|bmp);/i.test(uri);
}
function asset(name: string): string {
  return new URL(`./ocr/${name}`, document.baseURI).toString();
}
function loadEngine(): Promise<BrowserOcrEngine> {
  if (enginePromise) return enginePromise;
  enginePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = asset("tesseract.min.js");
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error("Photo recognition could not load. Reconnect or paste text instead."));
    }, 30_000);
    script.onload = () => {
      clearTimeout(timer);
      const engine = (window as unknown as { Tesseract?: BrowserOcrEngine }).Tesseract;
      if (engine) resolve(engine);
      else reject(new Error("Photo recognition is unavailable. Paste text instead."));
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error("Photo recognition could not load. Reconnect or paste text instead."));
    };
    document.head.appendChild(script);
  });
  void enginePromise.catch(() => {
    enginePromise = null;
  });
  return enginePromise;
}
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Photo recognition cancelled.", "AbortError");
}
function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Photo recognition cancelled.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
async function sizedImage(uri: string, signal?: AbortSignal): Promise<string> {
  const image = new Image();
  image.src = uri;
  await abortable(image.decode(), signal);
  cancelled(signal);
  if (!image.width || !image.height)
    throw new Error("This image could not be read. Choose a JPG or PNG photo.");
  const scale = Math.min(1, 2200 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo recognition is unavailable in this browser.");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
export async function recognizeBrowserImage(
  uri: string,
  options?: { signal?: AbortSignal; onProgress?: (message: string) => void },
): Promise<string> {
  if (!localImageUri(uri)) throw new Error("Choose an image from this device.");
  const signal = options?.signal;
  cancelled(signal);
  options?.onProgress?.("Preparing photo…");
  const prepared = await sizedImage(uri, signal);
  const engine = await abortable(loadEngine(), signal);
  cancelled(signal);
  let worker: BrowserOcrWorker | null = null;
  try {
    const creatingWorker = engine.createWorker("eng", 1, {
      workerPath: asset("worker.min.js"),
      corePath: asset("core/"),
      langPath: asset("lang/"),
      logger: ({ status, progress }) => {
        if (!signal?.aborted)
          options?.onProgress?.(
            status === "recognizing text"
              ? `Recognizing text… ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
              : "Loading photo recognition…",
          );
      },
    });
    // A cancelled initialization may finish later; release its worker too.
    void creatingWorker.then(
      (created) => {
        if (signal?.aborted) void created.terminate().catch(() => {});
      },
      () => {},
    );
    worker = await abortable(creatingWorker, signal);
    cancelled(signal);
    const result = await abortable(worker.recognize(prepared), signal);
    cancelled(signal);
    return result.data.text;
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}
