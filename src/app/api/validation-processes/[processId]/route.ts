import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getValidationProcess } from "@/services/process/validation-process-store";

export async function GET(_request: Request, context: { params: Promise<{ processId: string }> }) {
  const { processId } = await context.params;
  if (isSupabaseConfigured()) {
    try {
      const user = await requireUser();
      const supabase = createSupabaseAdminClient();
      let query = supabase
        .from("validation_processes")
        .select("id, organization_id, user_id, validation_type, processing_status, result, error, started_at, updated_at, process_documents(id, name, document_type, source, mime_type, size_bytes)")
        .eq("id", processId)
        .eq("organization_id", user.organizationId);
      if (!isMasterAdmin(user)) query = query.eq("user_id", user.id);
      const { data, error } = await query.single();
      if (error || !data) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

      return NextResponse.json({
        id: data.id,
        organizationId: data.organization_id,
        userId: data.user_id,
        validationType: data.validation_type,
        status: data.processing_status,
        result: data.result,
        error: data.error,
        documents: (data.process_documents ?? []).map((document) => ({
          id: document.id,
          organizationId: data.organization_id,
          name: document.name,
          type: document.document_type,
          mimeType: document.mime_type,
          sizeBytes: document.size_bytes ?? undefined,
          source: document.source ?? undefined,
        })),
        createdAt: data.started_at,
        updatedAt: data.updated_at,
      });
    } catch (error) {
      if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
      console.error(error);
      return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }
  }

  const validationProcess = getValidationProcess(processId);

  if (!validationProcess) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  return NextResponse.json(validationProcess);
}
