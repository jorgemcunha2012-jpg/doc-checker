import type { AuthenticatedUser } from "@/lib/auth";
import type { HumanReview, ReconciliationRun, UploadedDocument, ValidationProcess } from "@/domain/validation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { UploadedDocumentPayload } from "@/services/extraction/types";

export async function persistProcess(process: ValidationProcess) {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseAdminClient();
  await supabase.from("validation_processes").upsert({
    id: process.id,
    organization_id: process.organizationId,
    user_id: process.userId,
    validation_type: process.validationType,
    processing_status: process.status,
    final_status: finalStatus(process),
    result: process.result ?? null,
    summary: process.result?.summary ?? null,
    error: process.error ?? null,
    started_at: process.createdAt,
    completed_at: process.status === "DONE" || process.status === "FAILED" ? process.updatedAt : null,
    updated_at: process.updatedAt,
  });
}

export async function persistDocuments(processId: string, documents: UploadedDocument[]) {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseAdminClient();
  await supabase.from("process_documents").upsert(
    documents.map((document) => ({
      id: document.id,
      process_id: processId,
      organization_id: document.organizationId,
      name: document.name,
      document_type: document.type,
      source: document.source ?? null,
      mime_type: document.mimeType,
      size_bytes: document.sizeBytes ?? null,
      storage_path: document.storagePath ?? null,
    })),
  );
}

export async function persistOriginalDocuments(processId: string, documents: UploadedDocumentPayload[]) {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseAdminClient();
  await Promise.all(documents.map(async (document) => {
    const storagePath = `${document.organizationId}/${processId}/${document.id}-${safeFileName(document.name)}`;
    const { error } = await supabase.storage.from("process-documents").upload(storagePath, document.buffer, {
      contentType: document.mimeType,
      upsert: false,
    });
    if (error) throw new Error(`Não foi possível armazenar ${document.name}: ${error.message}`);
    const { error: updateError } = await supabase
      .from("process_documents")
      .update({ storage_path: storagePath })
      .eq("id", document.id)
      .eq("process_id", processId);
    if (updateError) throw new Error(`Não foi possível vincular ${document.name}: ${updateError.message}`);
  }));
}

export async function persistResults(processId: string, run: ReconciliationRun) {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseAdminClient();
  await supabase.from("validation_results").upsert(
    run.results.map((result) => ({
      process_id: processId,
      organization_id: run.organizationId,
      field_id: result.field.id,
      field_label: result.field.label,
      field_category: result.field.category,
      automatic_status: result.status,
      observation: result.observation,
      values_by_source: result.valuesBySource,
    })),
    { onConflict: "process_id,field_id" },
  );
}

export async function saveHumanReview(
  processId: string,
  fieldId: string,
  review: HumanReview | undefined,
  actor: AuthenticatedUser,
) {
  const supabase = createSupabaseAdminClient();
  if (!review) {
    await supabase.from("human_reviews").delete().eq("process_id", processId).eq("field_id", fieldId);
  } else {
    await supabase.from("human_reviews").upsert(
      {
        process_id: processId,
        field_id: fieldId,
        organization_id: actor.organizationId,
        status: review.status,
        justification: review.justification,
        reviewer_id: actor.id,
        reviewer_name: actor.name,
        reviewed_at: review.reviewedAt,
      },
      { onConflict: "process_id,field_id" },
    );
  }
  await audit(actor, review ? "REVIEW_APPROVED" : "REVIEW_REVOKED", "validation_result", `${processId}:${fieldId}`, {
    justification: review?.justification,
  });
  await refreshFinalStatus(processId);
}

export async function audit(
  actor: Pick<AuthenticatedUser, "id" | "organizationId">,
  eventType: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  if (!isSupabaseConfigured()) return;
  await createSupabaseAdminClient().from("audit_events").insert({
    organization_id: actor.organizationId,
    actor_id: actor.id,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata,
  });
}

async function refreshFinalStatus(processId: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: results }, { data: reviews }] = await Promise.all([
    supabase.from("validation_results").select("field_id, automatic_status").eq("process_id", processId),
    supabase.from("human_reviews").select("field_id, status").eq("process_id", processId),
  ]);
  const approved = new Set((reviews ?? []).filter((review) => review.status === "APPROVED").map((review) => review.field_id));
  const pending = (results ?? []).some((result) => result.automatic_status !== "MATCH" && !approved.has(result.field_id));
  await supabase.from("validation_processes").update({
    final_status: pending ? "PENDING_REVIEW" : "FULLY_CHECKED",
    updated_at: new Date().toISOString(),
  }).eq("id", processId);
}

function finalStatus(process: ValidationProcess) {
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

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "documento";
}
