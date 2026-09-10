import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getAccessibleProcessScope } from "@/lib/process-access";
import type { HumanReview } from "@/domain/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { saveHumanReview } from "@/services/process/process-repository";
import { logOperationalError } from "@/lib/security/operational-logger";
import { jsonBodyErrorResponse, readJsonBody, reviewSchema } from "@/lib/security/json-body";

export async function PUT(request: Request, context: { params: Promise<{ processId: string }> }) {
  try {
    const user = await requireUser();
    const { processId } = await context.params;
    const { fieldId, justification } = await readJsonBody(request, reviewSchema);
    const process = await getAccessibleProcessScope(user, processId);
    if (!process) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
    const supabase = createSupabaseAdminClient();
    const { data: validationResult, error: validationResultError } = await supabase
      .from("validation_results")
      .select("field_id")
      .eq("process_id", processId)
      .eq("field_id", fieldId)
      .maybeSingle();
    if (validationResultError) throw validationResultError;
    if (!validationResult) {
      return NextResponse.json({ error: "Campo de conferência não encontrado." }, { status: 404 });
    }
    const review: HumanReview = {
      status: "APPROVED",
      justification: typeof justification === "string" ? justification.trim() : "",
      reviewerId: user.id,
      reviewerName: user.name,
      reviewedAt: new Date().toISOString(),
    };
    await saveHumanReview(processId, fieldId, review, user);
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const bodyError = jsonBodyErrorResponse(error);
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });
    logOperationalError("PROCESS_REVIEW_UNEXPECTED", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ processId: string }> }) {
  try {
    const user = await requireUser();
    const { processId } = await context.params;
    const fieldId = new URL(request.url).searchParams.get("fieldId");
    if (!fieldId) return NextResponse.json({ error: "Campo obrigatório." }, { status: 400 });
    const process = await getAccessibleProcessScope(user, processId);
    if (!process) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
    await saveHumanReview(processId, fieldId, undefined, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
