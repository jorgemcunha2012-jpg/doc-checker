import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
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
