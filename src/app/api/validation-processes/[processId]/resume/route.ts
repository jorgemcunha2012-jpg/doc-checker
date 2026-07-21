import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resumePersistedValidationProcess } from "@/services/process/process-validation";

export const maxDuration = 300;

const STALE_PROCESS_MS = 45_000;

export async function POST(_request: Request, context: { params: Promise<{ processId: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Retomada disponível apenas com persistência configurada." }, { status: 400 });

  try {
    const { processId } = await context.params;
    const user = await requireUser();
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("validation_processes")
      .select("id, user_id, processing_status, updated_at")
      .eq("id", processId)
      .eq("organization_id", user.organizationId);
    if (!isMasterAdmin(user)) query = query.eq("user_id", user.id);
    const { data: process, error } = await query.single();
    if (error || !process) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

    if (process.processing_status === "DONE" || process.processing_status === "FAILED") {
      return NextResponse.json({ resumed: false, reason: "Processo já encerrado." });
    }
    if (Date.now() - new Date(process.updated_at).getTime() < STALE_PROCESS_MS) {
      return NextResponse.json({ resumed: false, reason: "O processamento ainda está ativo." });
    }

    // A chamada é intencionalmente aguardada: ela é a via de recuperação quando o
    // callback assíncrono do provedor não chegou a iniciar no ambiente serverless.
    const resumed = await resumePersistedValidationProcess(processId);
    return NextResponse.json({ resumed: true, process: resumed });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[ConferIA] Falha ao retomar processo", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível retomar o processo." }, { status: 500 });
  }
}
