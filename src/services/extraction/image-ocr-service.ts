import path from "node:path";
import { createWorker } from "tesseract.js";

export async function extractImageOcrText(buffer: Buffer) {
  const worker = await createWorker("por", 1, {
    cachePath: "/tmp",
    workerPath: path.join(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js"),
  });

  try {
    const result = await worker.recognize(buffer);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}
