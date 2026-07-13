import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { extractDevelopmentWithOcr } from "@/services/development/development-ocr-service";
import { KimiProvider } from "@/services/extraction/kimi-provider";
import { renderPdfToJpegDataUrls } from "@/services/extraction/pdf-image-service";

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_PAGES = 12;
const EXTRACTION_TIMEOUT_MS = 150_000;
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const payload = await readPdfPayload(request, user.organizationId);
    if (!payload || !payload.sourceDocumentName.toLowerCase().endsWith(".pdf") || payload.buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: "Envie uma matrícula em PDF de até 20 MB." }, { status: 400 });
    }
    const buffer = payload.buffer;
    const ocrExtraction = await withTimeout(
      extractDevelopmentWithOcr(buffer, MAX_PAGES),
      EXTRACTION_TIMEOUT_MS,
      "O OCR da matrícula demorou demais.",
    ).catch((error) => {
      console.warn("[ConferIA] OCR da matrícula falhou", error);
      return null;
    });
    if (ocrExtraction?.units.length) {
      return NextResponse.json({ extraction: ocrExtraction, sourceDocumentName: payload.sourceDocumentName });
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
    return NextResponse.json({ extraction, sourceDocumentName: payload.sourceDocumentName });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao extrair o cadastro." }, { status: 500 });
  }
}

async function readPdfPayload(request: Request, organizationId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json() as { storagePath?: string; sourceDocumentName?: string };
    if (!body.storagePath || !body.sourceDocumentName || !body.storagePath.startsWith(`${organizationId}/development-extractions/`)) {
      return null;
    }
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.from("process-documents").download(body.storagePath);
    if (error || !data) {
      throw new Error(`Não foi possível baixar a matrícula enviada: ${error?.message ?? "arquivo não encontrado"}`);
    }
    return {
      buffer: Buffer.from(await data.arrayBuffer()),
      sourceDocumentName: body.sourceDocumentName,
    };
  }

  const form = await request.formData();
  const file = form.get("document");
  if (!(file instanceof File)) return null;
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    sourceDocumentName: file.name,
  };
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
