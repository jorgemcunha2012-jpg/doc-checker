import path from "node:path";
import { createWorker } from "tesseract.js";
import type { DevelopmentExtraction } from "@/domain/development";
import { extractDevelopmentFromOcrText } from "./development-ocr-parser";

export async function extractDevelopmentFromImagesWithOcr(
  images: string[],
  pageNumbers = images.map((_, index) => index + 1),
): Promise<DevelopmentExtraction> {
  const pages: string[] = [];
  const worker = await createWorker("por", 1, {
    cachePath: "/tmp",
    workerPath: path.join(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js"),
  });

  try {
    for (const image of images) {
      const imageBuffer = Buffer.from(image.split(",")[1] ?? "", "base64");
      const result = await worker.recognize(imageBuffer);
      pages.push(`[PAGINA ${pageNumbers[pages.length] ?? pages.length + 1}]\n${result.data.text}`);
    }
  } finally {
    await worker.terminate();
  }

  return extractDevelopmentFromOcrText(pages.join("\n\n"));
}
