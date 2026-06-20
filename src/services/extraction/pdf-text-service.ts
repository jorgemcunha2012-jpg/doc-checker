import { PDFParse } from "pdf-parse";

export const MIN_PDF_TEXT_CHARACTERS = 250;

export async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return parsed.text.trim();
  } finally {
    await parser.destroy();
  }
}

export function hasEnoughPdfText(text: string) {
  return text.replace(/\s+/g, "").length >= MIN_PDF_TEXT_CHARACTERS;
}

export async function renderPdfPagesToImages(buffer: Buffer, firstPages = 3) {
  const parser = new PDFParse({ data: buffer });

  try {
    const screenshots = await parser.getScreenshot({
      first: firstPages,
      desiredWidth: 1400,
      imageBuffer: true,
      imageDataUrl: false,
    });

    return screenshots.pages.map((page) => Buffer.from(page.data));
  } finally {
    await parser.destroy();
  }
}
