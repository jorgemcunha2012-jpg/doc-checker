import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, isOrganizationAdmin, requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listValidationProcesses } from "@/services/process/validation-process-store";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    if (!isSupabaseConfigured()) {
      const status = url.searchParams.get("status");
      const processes = listValidationProcesses()
        .filter((process) => isMasterAdmin(user) || process.organizationId === user.organizationId)
        .filter((process) => isOrganizationAdmin(user) || process.userId === user.id)
        .filter((process) => !status || localFinalStatus(process) === status)
        .slice(0, 100)
        .map((process) => ({
          id: process.id,
          user_id: process.userId,
          processing_status: process.status,
          final_status: localFinalStatus(process),
          result: process.result ?? null,
          summary: process.result?.summary ?? null,
          error: process.error ?? null,
          started_at: process.createdAt,
          completed_at: process.status === "DONE" || process.status === "FAILED" ? process.updatedAt : null,
          profiles: { name: user.name },
          process_documents: process.documents.map((document) => ({
            id: document.id,
            name: document.name,
            source: document.source,
            available: false,
          })),
        }));
      return NextResponse.json({ processes });
    }
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("validation_processes")
      .select("id, organization_id, user_id, processing_status, final_status, result, summary, error, started_at, updated_at, completed_at, profiles!validation_processes_user_id_fkey(name), process_documents(id, name, source, storage_path)")
      .order("started_at", { ascending: false })
      .limit(100);
    if (!isMasterAdmin(user)) query = query.eq("organization_id", user.organizationId);
    if (!isOrganizationAdmin(user)) query = query.eq("user_id", user.id);
    const status = url.searchParams.get("status");
    const analyst = url.searchParams.get("userId");
    if (status) query = query.eq("final_status", status);
    if (analyst && isOrganizationAdmin(user)) query = query.eq("user_id", analyst);
    const { data, error } = await query;
    if (error) throw error;
    const showTechnicalExtractionDetails = isMasterAdmin(user);
    const processes = data ?? [];
    const staleProcesses = processes.filter((process) =>
      process.processing_status !== "DONE" &&
      process.processing_status !== "FAILED" &&
      Date.now() - new Date(process.updated_at).getTime() >= 30 * 60 * 1000,
    );
    if (staleProcesses.length) {
      const now = new Date().toISOString();
      await Promise.all(staleProcesses.map(async (process) => {
        const elapsedMinutes = Math.floor((Date.now() - new Date(process.updated_at).getTime()) / 60000);
        const errorMessage = `Processo encerrado automaticamente: não houve atualização há ${elapsedMinutes} minutos. Etapa interrompida em ${process.processing_status}. O worker não concluiu a extração ou comparação.`;
        const { error: updateError } = await supabase
          .from("validation_processes")
          .update({ processing_status: "FAILED", final_status: "FAILED", error: errorMessage, completed_at: now, updated_at: now })
          .eq("id", process.id)
          .not("processing_status", "in", "(DONE,FAILED)");
        if (!updateError) {
          await supabase.from("audit_events").insert({
            organization_id: process.organization_id,
            actor_id: user.id,
            event_type: "PROCESS_FAILED",
            entity_type: "validation_process",
            entity_id: process.id,
            metadata: { reason: "STALE_PROCESS", previousStage: process.processing_status, error: errorMessage },
          });
        }
        process.processing_status = "FAILED";
        process.final_status = "FAILED";
        process.error = errorMessage;
        process.completed_at = now;
        process.updated_at = now;
      }));
    }
    return NextResponse.json({
      processes: processes.map((process) => ({
        ...process,
        result: showTechnicalExtractionDetails || !process.result
          ? process.result
          : { ...process.result, extractionQualityBySource: undefined },
        summary: showTechnicalExtractionDetails || !process.summary
          ? process.summary
          : { ...process.summary, extractionQualityBySource: undefined },
        process_documents: process.process_documents.map((document) => ({
          id: document.id,
          name: document.name,
          source: document.source,
          available: Boolean(document.storage_path),
        })),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

function localFinalStatus(process: ReturnType<typeof listValidationProcesses>[number]) {
  if (process.status === "FAILED") return "FAILED";
  if (process.status !== "DONE" || !process.result) return "IN_PROGRESS";
  if (process.result.validationType !== "RECONCILIATION") {
    return process.result.summary.divergences || process.result.summary.reviewRequired
      ? "PENDING_REVIEW"
      : "FULLY_CHECKED";
  }
  return process.result.results.some((result) => result.status !== "MATCH" && result.status !== "PRESENT")
    ? "PENDING_REVIEW"
    : "FULLY_CHECKED";
}
