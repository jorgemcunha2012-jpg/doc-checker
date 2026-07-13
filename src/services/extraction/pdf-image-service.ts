type PdfImageRenderOptions = {
  scale?: number;
  quality?: number;
};

export async function renderPdfToJpegDataUrls(
  buffer: Buffer,
  maxPages = 12,
  options: PdfImageRenderOptions = {},
) {
  const canvasModule = await import("@napi-rs/canvas");
  const scale = options.scale ?? 1.5;
  const quality = options.quality ?? 82;
  const pdfGlobals = globalThis as Record<string, unknown>;
  pdfGlobals.DOMMatrix ??= canvasModule.DOMMatrix;
  pdfGlobals.ImageData ??= canvasModule.ImageData;
  pdfGlobals.Path2D ??= canvasModule.Path2D;

  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false });
  const document = await loadingTask.promise;
  const images: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, maxPages); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context as never, viewport }).promise;
      images.push(`data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", quality).toString("base64")}`);
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return images;
}
