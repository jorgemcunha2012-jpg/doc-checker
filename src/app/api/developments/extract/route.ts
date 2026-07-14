import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { extractDevelopmentFromImagesWithOcr } from "@/services/development/development-ocr-service";
import { KimiProvider } from "@/services/extraction/kimi-provider";

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_IMAGES = 12;
const EXTRACTION_TIMEOUT_MS = 150_000;
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = await readPdfPayload(request, user.organizationId);
    if (!payload || !payload.sourceDocumentName.toLowerCase().endsWith(".pdf") || payload.size > MAX_SIZE) {
      return NextResponse.json({ error: "Envie uma matrícula em PDF de até 20 MB." }, { status: 400 });
    }
    if (!payload.images?.length) {
      return NextResponse.json({
        error: "Renderize a matrícula pelo navegador antes de extrair. Atualize a página e tente novamente.",
      }, { status: 422 });
    }
    const ocrExtraction = await withTimeout(
      extractDevelopmentFromImagesWithOcr(payload.images),
      EXTRACTION_TIMEOUT_MS,
      "O OCR da matrícula demorou demais.",
    ).catch((error) => {
      console.warn("[ConferIA] OCR da matrícula falhou", error);
      return null;
    });
    if (ocrExtraction?.units.length) {
      return NextResponse.json({ extraction: ocrExtraction, sourceDocumentName: payload.sourceDocumentName });
    }

    const extraction = await withTimeout(
      new KimiProvider().extractDevelopment(payload.images),
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
    const body = await request.json() as { storagePath?: string; sourceDocumentName?: string; images?: string[]; imagePaths?: string[] };
    if (Array.isArray(body.images)) {
      const images = body.images.filter((image) => typeof image === "string" && image.startsWith("data:image/")).slice(0, MAX_IMAGES);
      if (!body.sourceDocumentName || !images.length) return null;
      return {
        images,
        sourceDocumentName: body.sourceDocumentName,
        size: images.reduce((total, image) => total + image.length, 0),
      };
    }
    if (Array.isArray(body.imagePaths)) {
      const paths = body.imagePaths
        .filter((path) => typeof path === "string" && path.startsWith(`${organizationId}/development-extractions/rendered-pages/`))
        .slice(0, MAX_IMAGES);
      if (!body.sourceDocumentName || !paths.length) return null;
      const supabase = createSupabaseAdminClient();
      const downloads = await Promise.all(paths.map(async (path) => {
        const { data, error } = await supabase.storage.from("process-documents").download(path);
        if (error || !data) throw new Error(`Não foi possível baixar página renderizada: ${error?.message ?? path}`);
        const buffer = Buffer.from(await data.arrayBuffer());
        return `data:${data.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
      }));
      return {
        images: downloads,
        sourceDocumentName: body.sourceDocumentName,
        size: downloads.reduce((total, image) => total + image.length, 0),
      };
    }
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
      size: data.size,
    };
  }

  const form = await request.formData();
  const file = form.get("document");
  if (!(file instanceof File)) return null;
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    sourceDocumentName: file.name,
    size: file.size,
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
