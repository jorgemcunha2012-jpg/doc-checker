import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireUser } from "@/lib/auth";
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
        .filter((process) => process.organizationId === user.organizationId)
        .filter((process) => isMasterAdmin(user) || process.userId === user.id)
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
      .select("id, user_id, processing_status, final_status, result, summary, error, started_at, completed_at, profiles!validation_processes_user_id_fkey(name), process_documents(id, name, source, storage_path)")
      .eq("organization_id", user.organizationId)
      .order("started_at", { ascending: false })
      .limit(100);
    if (!isMasterAdmin(user)) query = query.eq("user_id", user.id);
    const status = url.searchParams.get("status");
    const analyst = url.searchParams.get("userId");
    if (status) query = query.eq("final_status", status);
    if (analyst && isMasterAdmin(user)) query = query.eq("user_id", analyst);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({
      processes: (data ?? []).map((process) => ({
        ...process,
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
  return process.result.results.some((result) => result.status !== "MATCH")
    ? "PENDING_REVIEW"
    : "FULLY_CHECKED";
}
