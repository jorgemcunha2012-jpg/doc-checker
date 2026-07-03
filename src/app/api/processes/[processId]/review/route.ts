import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireUser } from "@/lib/auth";
import type { HumanReview } from "@/domain/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { saveHumanReview } from "@/services/process/process-repository";

export async function PUT(request: Request, context: { params: Promise<{ processId: string }> }) {
  try {
    const user = await requireUser();
    const { processId } = await context.params;
    const { fieldId, justification } = await request.json();
    if (typeof fieldId !== "string" || !fieldId.trim()) {
      return NextResponse.json({ error: "Campo obrigatório." }, { status: 400 });
    }
    if (typeof justification !== "string" || justification.trim().length < 5 || justification.trim().length > 1000) {
      return NextResponse.json({ error: "Informe uma justificativa entre 5 e 1.000 caracteres." }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    const { data: process } = await supabase.from("validation_processes").select("user_id, organization_id").eq("id", processId).single();
    if (!process || process.organization_id !== user.organizationId || (!isMasterAdmin(user) && process.user_id !== user.id)) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
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
      justification: justification.trim(),
      reviewerId: user.id,
      reviewerName: user.name,
      reviewedAt: new Date().toISOString(),
    };
    await saveHumanReview(processId, fieldId, review, user);
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ processId: string }> }) {
  try {
    const user = await requireUser();
    const { processId } = await context.params;
    const fieldId = new URL(request.url).searchParams.get("fieldId");
    if (!fieldId) return NextResponse.json({ error: "Campo obrigatório." }, { status: 400 });
    const { data: process } = await createSupabaseAdminClient().from("validation_processes").select("user_id, organization_id").eq("id", processId).single();
    if (!process || process.organization_id !== user.organizationId || (!isMasterAdmin(user) && process.user_id !== user.id)) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
    await saveHumanReview(processId, fieldId, undefined, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
