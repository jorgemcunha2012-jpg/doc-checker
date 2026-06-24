export const MIN_PDF_TEXT_CHARACTERS = 250;

export async function extractPdfText(buffer: Buffer) {
  const canvas = await import("@napi-rs/canvas");
  const pdfGlobals = globalThis as Record<string, unknown>;
  pdfGlobals.DOMMatrix ??= canvas.DOMMatrix;
  pdfGlobals.ImageData ??= canvas.ImageData;
  pdfGlobals.Path2D ??= canvas.Path2D;

  // Keep the fake worker in Next's server trace for deployments such as Vercel.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false });
  const document = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    pages.push(`[PÁGINA ${pageNumber}]\n${pageText}`);
    page.cleanup();
  }

  await loadingTask.destroy();

  return pages.join("\n\n").trim();
}

export function hasEnoughPdfText(text: string) {
  return text.replace(/\s+/g, "").length >= MIN_PDF_TEXT_CHARACTERS;
}
