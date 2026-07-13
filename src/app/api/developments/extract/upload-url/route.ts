import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json() as { fileName?: string; fileSize?: number; mimeType?: string };
    const fileName = body.fileName?.trim();
    const fileSize = Number(body.fileSize ?? 0);
    const mimeType = body.mimeType || "application/pdf";

    if (!fileName?.toLowerCase().endsWith(".pdf") || mimeType !== "application/pdf" || fileSize <= 0 || fileSize > MAX_SIZE) {
      return NextResponse.json({ error: "Envie uma matrícula em PDF de até 20 MB." }, { status: 400 });
    }

    const storagePath = `${user.organizationId}/development-extractions/${randomUUID()}-${safeFileName(fileName)}`;
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
