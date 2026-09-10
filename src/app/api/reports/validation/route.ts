import { NextResponse } from "next/server";
import { renderValidationReport, type ReportFilter } from "@/services/report/validation-report";
import { AuthError, requireUser } from "@/lib/auth";
import { getAccessibleProcessScope } from "@/lib/process-access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { decryptStoredJson } from "@/lib/security/field-encryption";
import type { ValidationRun } from "@/domain/validation";
import { jsonBodyErrorResponse, readJsonBody, validationReportSchema } from "@/lib/security/json-body";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { processId, filter } = await readJsonBody(request, validationReportSchema);
    const scope = await getAccessibleProcessScope(user, processId);
    if (!scope) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    const { data, error } = await createSupabaseAdminClient()
      .from("validation_processes")
      .select("id, result")
      .eq("id", scope.id)
      .eq("organization_id", scope.organizationId)
      .eq("user_id", scope.userId)
      .single();
    if (error || !data) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    const run = decryptStoredJson<ValidationRun>(data.result);
    if (!run?.results?.length) return NextResponse.json({ error: "Resultado de validação indisponível." }, { status: 404 });
    const reportFilter: ReportFilter = filter ?? "ALL";
    const buffer = await renderValidationReport(run, reportFilter);
    const suffix = reportFilter === "ALL" ? "completo" : reportFilter.toLowerCase();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="conferia-${data.id}-${suffix}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const bodyError = jsonBodyErrorResponse(error);
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });
    throw error;
  }
}
