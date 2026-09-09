import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logOperationalError } from "@/lib/security/operational-logger";
import { inspectUpload } from "@/lib/security/upload-validation";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/security/rate-limit";

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const uploadLimit = consumeRateLimit(requestRateLimitKey(request, "development-upload"), 40, 15 * 60 * 1000);
    if (!uploadLimit.allowed) {
      return NextResponse.json({ error: "Muitas tentativas de upload. Aguarde alguns minutos antes de tentar novamente." }, { status: 429 });
    }
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("page");
      const fileName = form.get("fileName");
      if (!(file instanceof File) || typeof fileName !== "string" || !inspectUpload(file.name, "image/jpeg", file.size, new Uint8Array(await file.slice(0, 64).arrayBuffer()), MAX_SIZE).ok) {
        return NextResponse.json({ error: "A página renderizada é inválida ou excede 20 MB." }, { status: 400 });
      }
      const storagePath = `quarantine/${user.organizationId}/development-extractions/rendered-pages/${randomUUID()}.jpg`;
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.storage.from("process-documents").upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) {
        logOperationalError("DEVELOPMENT_PAGE_UPLOAD_FAILED", error, { userId: user.id });
        return NextResponse.json({ error: "Não foi possível armazenar a página renderizada." }, { status: 500 });
      }
      return NextResponse.json({ storagePath });
    }
    const body = await request.json() as { fileName?: string; fileSize?: number; mimeType?: string };
    const fileName = body.fileName?.trim();
    const fileSize = Number(body.fileSize ?? 0);
    const mimeType = body.mimeType || "application/pdf";

    if (mimeType === "application/pdf") {
      return NextResponse.json({
        error: "Atualize a página e envie a matrícula novamente. A versão atual renderiza o PDF no navegador antes da extração.",
      }, { status: 410 });
    }
    if (!fileName || mimeType !== "image/jpeg" || fileSize <= 0 || fileSize > MAX_SIZE) {
      return NextResponse.json({ error: "Não foi possível preparar a página renderizada da matrícula." }, { status: 400 });
    }

    const storagePath = `quarantine/${user.organizationId}/development-extractions/rendered-pages/${randomUUID()}.jpg`;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from("process-documents")
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error) {
      logOperationalError("DEVELOPMENT_UPLOAD_URL_FAILED", error, { userId: user.id });
      return NextResponse.json({ error: "Não foi possível preparar o upload da página renderizada." }, { status: 500 });
    }

    return NextResponse.json({
      storagePath,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    logOperationalError("DEVELOPMENT_UPLOAD_UNEXPECTED", error);
    return NextResponse.json({ error: "Não foi possível preparar o upload da matrícula." }, { status: 500 });
  }
}
