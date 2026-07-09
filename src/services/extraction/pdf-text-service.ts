export const MIN_PDF_TEXT_CHARACTERS = 250;

type PdfTextExtractionOptions = {
  headPages?: number;
  tailPages?: number;
};

export async function extractPdfText(
  buffer: Buffer,
  options: PdfTextExtractionOptions = {},
) {
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
  const pageNumbers = selectPageNumbers(
    document.numPages,
    options.headPages,
    options.tailPages,
  );

  for (const pageNumber of pageNumbers) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    const formText = await extractPageFormText(page);

    pages.push(`[PÁGINA ${pageNumber}]\n${[pageText, formText].filter(Boolean).join("\n\n")}`);
    page.cleanup();
  }

  await loadingTask.destroy();

  return pages.join("\n\n").trim();
}

export async function extractPageFormText(page: {
  getAnnotations: (options: { intent: "display" }) => Promise<unknown[]>;
}) {
  const annotations = await page.getAnnotations({ intent: "display" }).catch(() => []);
  const fields = annotations.flatMap((annotation) => {
    if (!annotation || typeof annotation !== "object") return [];
    const item = annotation as Record<string, unknown>;
    if (item.subtype !== "Widget") return [];
    const name = cleanFormText(item.fieldName);
    const value = cleanFormText(item.fieldValue);
    if (!name || !value || value === "Off") return [];
    return `${name}: ${value}`;
  });

  return fields.length ? `[CAMPOS DE FORMULARIO]\n${fields.join("\n")}` : "";
}

function cleanFormText(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";
}

export function hasEnoughPdfText(text: string) {
  return text.replace(/\s+/g, "").length >= MIN_PDF_TEXT_CHARACTERS;
}

function selectPageNumbers(
  totalPages: number,
  headPages?: number,
  tailPages?: number,
) {
  if (!headPages && !tailPages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const selected = new Set<number>();
  const headLimit = Math.min(totalPages, Math.max(0, headPages ?? 0));
  const tailStart = Math.max(1, totalPages - Math.max(0, tailPages ?? 0) + 1);

  for (let page = 1; page <= headLimit; page += 1) selected.add(page);
  for (let page = tailStart; page <= totalPages; page += 1) selected.add(page);

  return [...selected].sort((left, right) => left - right);
}
