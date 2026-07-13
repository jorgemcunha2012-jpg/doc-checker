import { createWorker } from "tesseract.js";
import type { DevelopmentExtraction } from "@/domain/development";
import { extractDevelopmentFromOcrText } from "./development-ocr-parser";

export async function extractDevelopmentFromImagesWithOcr(
  images: string[],
): Promise<DevelopmentExtraction> {
  const pages: string[] = [];
  const worker = await createWorker("por", 1, { cachePath: "/tmp" });

  try {
    for (const image of images) {
      const imageBuffer = Buffer.from(image.split(",")[1] ?? "", "base64");
      const result = await worker.recognize(imageBuffer);
      pages.push(result.data.text);
    }
  } finally {
    await worker.terminate();
  }

  return extractDevelopmentFromOcrText(pages.join("\n\n"));
}
