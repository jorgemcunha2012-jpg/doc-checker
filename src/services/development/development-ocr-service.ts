import { createWorker } from "tesseract.js";
import type { DevelopmentExtraction } from "@/domain/development";
import { renderPdfToJpegDataUrls } from "@/services/extraction/pdf-image-service";
import { extractDevelopmentFromOcrText } from "./development-ocr-parser";

export async function extractDevelopmentWithOcr(
  buffer: Buffer,
  maxPages = 12,
): Promise<DevelopmentExtraction> {
  const images = await renderPdfToJpegDataUrls(buffer, maxPages, {
    quality: 88,
    scale: 2.2,
  });
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
