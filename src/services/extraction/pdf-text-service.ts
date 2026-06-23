import path from "node:path";

export const MIN_PDF_TEXT_CHARACTERS = 250;

const standardFontDataUrl = `${path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")}${path.sep}`;

export async function extractPdfText(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ data: bytes, standardFontDataUrl, useWorkerFetch: false });
  const document = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    pages.push(pageText);
    page.cleanup();
  }

  await loadingTask.destroy();

  return pages.join("\n\n").trim();
}

export function hasEnoughPdfText(text: string) {
  return text.replace(/\s+/g, "").length >= MIN_PDF_TEXT_CHARACTERS;
}
