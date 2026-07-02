import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ processId: string; documentId: string }> }) {
  try {
    const user = await requireUser();
    const { processId, documentId } = await context.params;
    const supabase = createSupabaseAdminClient();
    let processQuery = supabase
      .from("validation_processes")
      .select("id")
      .eq("id", processId)
      .eq("organization_id", user.organizationId);
    if (!isMasterAdmin(user)) processQuery = processQuery.eq("user_id", user.id);
    const { data: process } = await processQuery.maybeSingle();
    if (!process) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

    const { data: document } = await supabase
      .from("process_documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("process_id", processId)
      .eq("organization_id", user.organizationId)
      .maybeSingle();
    if (!document?.storage_path) {
      return NextResponse.json({ error: "O arquivo original não está disponível." }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from("process-documents")
      .createSignedUrl(document.storage_path, 60);
    if (error || !data?.signedUrl) throw error ?? new Error("URL temporária não gerada.");
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 500 });
  }
}
