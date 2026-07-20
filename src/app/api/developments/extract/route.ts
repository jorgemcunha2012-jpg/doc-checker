import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";
import { extractDevelopmentFromImagesWithOcr } from "@/services/development/development-ocr-service";
import { extractDevelopmentFromOcrText } from "@/services/development/development-ocr-parser";
import { KimiProvider } from "@/services/extraction/kimi-provider";
import { reconcileDevelopmentExtractions } from "@/services/development/development-reconciliation";

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_IMAGES = 40;
const EXTRACTION_TIMEOUT_MS = 150_000;
export const maxDuration = 300;

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireUser>> | null = null;
  const attemptId = crypto.randomUUID();
  const startedAt = Date.now();
  let sourceDocumentName = "Arquivo não identificado";
  let pageNumbers: number[] = [];
  try {
    user = await requireUser();
    const payload = await readPdfPayload(request, user.organizationId);
    sourceDocumentName = payload?.sourceDocumentName ?? sourceDocumentName;
    pageNumbers = payload?.pageNumbers ?? [];
    if (!payload || !payload.sourceDocumentName.toLowerCase().endsWith(".pdf") || payload.size > MAX_SIZE) {
      await auditExtraction(user, "DEVELOPMENT_EXTRACTION_FAILED", attemptId, startedAt, sourceDocumentName, pageNumbers, {
        stage: "VALIDATION",
        reason: "Arquivo ausente, inválido ou maior que 20 MB.",
      });
      return NextResponse.json({ error: "Envie uma matrícula em PDF de até 20 MB." }, { status: 400 });
    }
    if (!payload.images?.length) {
      await auditExtraction(user, "DEVELOPMENT_EXTRACTION_FAILED", attemptId, startedAt, sourceDocumentName, pageNumbers, {
        stage: "RENDERING",
        reason: "Nenhuma página renderizada foi recebida do navegador.",
      });
      return NextResponse.json({
        error: "Renderize a matrícula pelo navegador antes de extrair. Atualize a página e tente novamente.",
      }, { status: 422 });
    }
    await auditExtraction(user, "DEVELOPMENT_EXTRACTION_STARTED", attemptId, startedAt, sourceDocumentName, pageNumbers, {
      stage: "EXTRACTION",
      imageCount: payload.images.length,
    });
    let ocrError: string | undefined;
    let visionError: string | undefined;
    const [ocrExtraction, visionExtraction] = await Promise.all([
      withTimeout(
        extractDevelopmentFromImagesWithOcr(payload.images, payload.pageNumbers),
        EXTRACTION_TIMEOUT_MS,
        "O OCR da matrícula demorou demais.",
      ).catch((error) => {
        console.warn("[ConferIA] OCR da matrícula falhou", error);
        ocrError = error instanceof Error ? error.message : "Falha desconhecida no OCR.";
        return null;
      }),
      withTimeout(
        new KimiProvider().extractDevelopment(payload.images, payload.pageNumbers),
        EXTRACTION_TIMEOUT_MS,
        "A visão da IA demorou demais.",
      ).catch((error) => {
        console.warn("[ConferIA] Visão da IA da matrícula falhou", error);
        visionError = error instanceof Error ? error.message : "Falha desconhecida na visão da IA.";
        return null;
      }),
    ]);
    const deterministicExtraction = payload.text ? extractDevelopmentFromOcrText(payload.text) : null;
    const textExtraction = deterministicExtraction && deterministicExtraction.units.length > (ocrExtraction?.units.length ?? 0)
      ? deterministicExtraction
      : ocrExtraction;
    const extraction = reconcileDevelopmentExtractions(textExtraction, visionExtraction);
    console.info("[ConferIA] Leituras independentes da matrícula concluídas", {
      durationMs: Date.now() - startedAt,
      ocrUnits: textExtraction?.units.length ?? 0,
      visionUnits: visionExtraction?.units.length ?? 0,
      reviewRequired: extraction?.quality?.reviewRequired.length ?? 0,
    });
    if (!extraction?.units.length) {
      await auditExtraction(user, "DEVELOPMENT_EXTRACTION_FAILED", attemptId, startedAt, sourceDocumentName, pageNumbers, {
        stage: "RECONCILIATION",
        reason: [ocrError, visionError].filter(Boolean).join(" | ") || "As leituras não encontraram tipos com área privativa suficiente.",
        ocrUnits: textExtraction?.units.length ?? 0,
        visionUnits: visionExtraction?.units.length ?? 0,
        detectedTypologies: extraction?.quality?.detectedTypologies ?? [],
      });
      const typologies = extraction?.quality?.detectedTypologies ?? [];
      return NextResponse.json({
        error: typologies.length
          ? `A matrícula foi lida, mas não apresenta área privativa associada aos tipos ${typologies.join(", ")}. Torre e apartamento são opcionais; tipo e área privativa são obrigatórios para criar a base do empreendimento. Envie as páginas do memorial com as áreas dos tipos ou use o cadastro manual.`
          : "A matrícula não apresentou tipos de unidade com área privativa legível. Torre e apartamento são opcionais; tipo e área privativa são obrigatórios para criar a base do empreendimento. Verifique se foram enviadas as páginas do memorial descritivo ou use o cadastro manual.",
        details: {
          detectedTypologies: typologies,
          ocrUnits: ocrExtraction?.units.length ?? 0,
          visionUnits: visionExtraction?.units.length ?? 0,
          reviewRequired: extraction?.quality?.reviewRequired ?? [],
        },
      }, { status: 422 });
    }
    await auditExtraction(user, "DEVELOPMENT_EXTRACTION_FINISHED", attemptId, startedAt, sourceDocumentName, pageNumbers, {
      stage: "RECONCILIATION",
      ocrUnits: textExtraction?.units.length ?? 0,
      visionUnits: visionExtraction?.units.length ?? 0,
      extractedUnits: extraction.units.length,
      reviewRequired: extraction.quality?.reviewRequired.length ?? 0,
    });
    return NextResponse.json({ extraction, sourceDocumentName: payload.sourceDocumentName });
  } catch (error) {
    if (user) {
      await auditExtraction(user, "DEVELOPMENT_EXTRACTION_FAILED", attemptId, startedAt, sourceDocumentName, pageNumbers, {
        stage: "UNEXPECTED",
        reason: error instanceof Error ? error.message : "Falha inesperada na extração.",
      });
    }
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao extrair o cadastro." }, { status: 500 });
  }
}

async function auditExtraction(
  user: Awaited<ReturnType<typeof requireUser>>,
  eventType: "DEVELOPMENT_EXTRACTION_STARTED" | "DEVELOPMENT_EXTRACTION_FINISHED" | "DEVELOPMENT_EXTRACTION_FAILED",
  attemptId: string,
  startedAt: number,
  sourceDocumentName: string,
  pageNumbers: number[],
  metadata: Record<string, unknown>,
) {
  await audit(user, eventType, "development_extraction", attemptId, {
    sourceDocumentName,
    pageNumbers,
    pageCount: pageNumbers.length,
    durationMs: Date.now() - startedAt,
    ...metadata,
  });
}

async function readPdfPayload(request: Request, organizationId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json() as { storagePath?: string; sourceDocumentName?: string; images?: string[]; imagePaths?: string[]; pageNumbers?: number[]; text?: string };
    if (Array.isArray(body.images)) {
      const images = body.images.filter((image) => typeof image === "string" && image.startsWith("data:image/")).slice(0, MAX_IMAGES);
      if (!body.sourceDocumentName || !images.length) return null;
      return {
        images,
        pageNumbers: normalizePageNumbers(body.pageNumbers, images.length),
        sourceDocumentName: body.sourceDocumentName,
        text: typeof body.text === "string" ? body.text.slice(0, 500_000) : undefined,
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
        pageNumbers: normalizePageNumbers(body.pageNumbers, downloads.length),
        sourceDocumentName: body.sourceDocumentName,
        text: typeof body.text === "string" ? body.text.slice(0, 500_000) : undefined,
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
      pageNumbers: [],
      sourceDocumentName: body.sourceDocumentName,
      size: data.size,
    };
  }

  const form = await request.formData();
  const file = form.get("document");
  if (!(file instanceof File)) return null;
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    pageNumbers: [],
    sourceDocumentName: file.name,
    size: file.size,
  };
}

function normalizePageNumbers(pageNumbers: unknown, length: number) {
  if (!Array.isArray(pageNumbers) || pageNumbers.length !== length || !pageNumbers.every((page) => Number.isInteger(page) && page > 0)) {
    return Array.from({ length }, (_, index) => index + 1);
  }
  return pageNumbers as number[];
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
