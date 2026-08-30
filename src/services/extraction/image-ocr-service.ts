import path from "node:path";
import sharp from "sharp";
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
    const prepared = await prepareImageForOcr(buffer);
    const result = await withTimeout(
      worker.recognize(prepared),
      timeoutMs,
      "O OCR local excedeu o tempo limite.",
    );
    return result.data.text.trim();
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

/**
 * Reservation portals are commonly captured as short, wide screenshots. Upscaling
 * their small UI text before Tesseract runs makes labels and values readable while
 * leaving normal document images untouched.
 */
async function prepareImageForOcr(buffer: Buffer) {
  const image = sharp(buffer, { failOn: "none" });
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const isCompactScreen = width > 0 && height > 0 && (height < 700 || width / height > 2.2) && width < 2_400;
  if (!isCompactScreen) return buffer;

  return image
    .resize({ width: 3_000, kernel: "lanczos3" })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
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
