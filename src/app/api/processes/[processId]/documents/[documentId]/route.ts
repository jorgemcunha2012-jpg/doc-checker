import { NextResponse } from "next/server";
import { AuthError, canAccessProcessDocument, requireUser } from "@/lib/auth";
import { getAccessibleProcessScope } from "@/lib/process-access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function GET(_request: Request, context: { params: Promise<{ processId: string; documentId: string }> }) {
  try {
    const user = await requireUser();
    const { processId, documentId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const process = await getAccessibleProcessScope(user, processId);
    if (!process) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

    const { data: document } = await supabase
      .from("process_documents")
      .select("storage_path, purged_at, organization_id")
      .eq("id", documentId)
      .eq("process_id", processId)
      .maybeSingle();
    if (document && !canAccessProcessDocument(user, process, document.organization_id)) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
    if (!document?.storage_path) {
      return NextResponse.json({
        error: document?.purged_at
          ? "Arquivo original removido após o período de retenção de 40 dias."
          : "O arquivo original não está disponível.",
      }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from("process-documents")
      .createSignedUrl(document.storage_path, 60);
    if (error || !data?.signedUrl) throw error ?? new Error("URL temporária não gerada.");
    await audit(user, "DOCUMENT_VIEWED", "process_document", documentId, { processId });
    const response = NextResponse.redirect(data.signedUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 500 });
  }
}
