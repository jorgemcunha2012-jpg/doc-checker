export const MIN_PDF_TEXT_CHARACTERS = 250;

export async function extractPdfText(buffer: Buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);

  return parsed.text.trim();
}

export function hasEnoughPdfText(text: string) {
  return text.replace(/\s+/g, "").length >= MIN_PDF_TEXT_CHARACTERS;
}
