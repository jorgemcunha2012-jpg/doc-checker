import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("page");
      const fileName = form.get("fileName");
      if (!(file instanceof File) || typeof fileName !== "string" || file.type !== "image/jpeg" || file.size <= 0 || file.size > MAX_SIZE) {
        return NextResponse.json({ error: "A página renderizada é inválida ou excede 20 MB." }, { status: 400 });
      }
      const storagePath = `${user.organizationId}/development-extractions/rendered-pages/${randomUUID()}-${safeFileName(fileName)}`;
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.storage.from("process-documents").upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) return NextResponse.json({ error: `Não foi possível armazenar a página renderizada: ${error.message}` }, { status: 500 });
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

    const storagePath = `${user.organizationId}/development-extractions/rendered-pages/${randomUUID()}-${safeFileName(fileName)}`;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from("process-documents")
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error) {
      return NextResponse.json({ error: `Não foi possível preparar o upload: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      storagePath,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: "Não foi possível preparar o upload da matrícula." }, { status: 500 });
  }
}

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}
