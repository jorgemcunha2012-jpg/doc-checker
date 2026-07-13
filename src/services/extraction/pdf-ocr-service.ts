import path from "node:path";
import { createWorker } from "tesseract.js";
import { renderPdfToJpegDataUrls } from "./pdf-image-service";

export async function extractPdfOcrText(buffer: Buffer, options: { maxPages?: number } = {}) {
  const images = await renderPdfToJpegDataUrls(buffer, options.maxPages ?? 12, {
    quality: 88,
    scale: 2.2,
  });
  const worker = await createWorker("por", 1, {
    cachePath: "/tmp",
    workerPath: path.join(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js"),
  });
  const pages: string[] = [];

  try {
    for (let index = 0; index < images.length; index += 1) {
      const imageBuffer = Buffer.from(images[index].split(",")[1] ?? "", "base64");
      const result = await worker.recognize(imageBuffer);
      pages.push(`[PÁGINA ${index + 1} - OCR]\n${result.data.text}`);
    }
  } finally {
    await worker.terminate();
  }

  return pages.join("\n\n").trim();
}
