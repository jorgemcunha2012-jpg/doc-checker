import path from "node:path";
import { createWorker } from "tesseract.js";

const DEFAULT_OCR_TIMEOUT_MS = 35_000;

export async function extractImageOcrText(buffer: Buffer, timeoutMs = DEFAULT_OCR_TIMEOUT_MS) {
  const worker = await withTimeout(
    createWorker("por", 1, {
      cachePath: "/tmp",
      workerPath: path.join(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js"),
    }),
    timeoutMs,
    "A inicialização do OCR local excedeu o tempo limite.",
  );

  try {
    const result = await withTimeout(
      worker.recognize(buffer),
      timeoutMs,
      "O OCR local excedeu o tempo limite.",
    );
    return result.data.text.trim();
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race<T>([
    promise,
    new Promise<T>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
