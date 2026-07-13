import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { extractDevelopmentWithOcr } from "@/services/development/development-ocr-service";
import { KimiProvider } from "@/services/extraction/kimi-provider";
import { renderPdfToJpegDataUrls } from "@/services/extraction/pdf-image-service";

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_PAGES = 12;
const EXTRACTION_TIMEOUT_MS = 150_000;
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf") || file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Envie uma matrícula em PDF de até 20 MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const ocrExtraction = await withTimeout(
      extractDevelopmentWithOcr(buffer, MAX_PAGES),
      EXTRACTION_TIMEOUT_MS,
      "O OCR da matrícula demorou demais.",
    ).catch((error) => {
      console.warn("[ConferIA] OCR da matrícula falhou", error);
      return null;
    });
    if (ocrExtraction?.units.length) {
      return NextResponse.json({ extraction: ocrExtraction, sourceDocumentName: file.name });
    }

    const images = await renderPdfToJpegDataUrls(buffer, MAX_PAGES, {
      quality: 72,
      scale: 1.15,
    });
    const extraction = await withTimeout(
      new KimiProvider().extractDevelopment(images),
      EXTRACTION_TIMEOUT_MS,
      "A extração demorou demais. Tente uma matrícula menor ou cadastre manualmente os tipos encontrados.",
    );
    if (!extraction.units.length) {
      return NextResponse.json({ error: "A IA não encontrou combinações de torre, unidade e área privativa." }, { status: 422 });
    }
    return NextResponse.json({ extraction, sourceDocumentName: file.name });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao extrair o cadastro." }, { status: 500 });
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
