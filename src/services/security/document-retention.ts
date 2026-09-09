import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { documentRetentionCutoff, documentRetentionReason } from "./document-retention-policy";
import { errorCode } from "@/lib/security/operational-logger";

const RETENTION_BATCH_SIZE = 100;

type RetentionDocument = {
  id: string;
  organization_id: string;
  storage_path: string;
  purge_attempts: number;
};

export type RetentionResult = {
  cutoff: string;
  selected: number;
  purged: number;
  failed: number;
};

export async function purgeExpiredProcessDocuments(now = new Date()): Promise<RetentionResult> {
  const supabase = createSupabaseAdminClient();
  const cutoff = documentRetentionCutoff(now);
  const { data, error } = await supabase
    .from("process_documents")
    .select("id, organization_id, storage_path, purge_attempts")
    .not("storage_path", "is", null)
    .is("purged_at", null)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(RETENTION_BATCH_SIZE);

  if (error) throw new Error("Falha ao consultar retenção.");
  const documents = (data ?? []).filter(
    (document): document is RetentionDocument => Boolean(document.storage_path),
  );
  if (!documents.length) return { cutoff, selected: 0, purged: 0, failed: 0 };

  const paths = documents.map((document) => document.storage_path);
  const { error: storageError } = await supabase.storage.from("process-documents").remove(paths);
  if (storageError) {
    await recordRetentionFailure(documents, errorCode(storageError));
    return { cutoff, selected: documents.length, purged: 0, failed: documents.length };
  }

  const purgedAt = now.toISOString();
  const { error: updateError } = await supabase
    .from("process_documents")
    .update({
      storage_path: null,
      purged_at: purgedAt,
      purge_reason: documentRetentionReason(),
      purge_error: null,
    })
    .in("id", documents.map((document) => document.id));
  if (updateError) throw new Error("Arquivos removidos, mas os metadados não foram atualizados.");

  await recordRetentionEvents(documents, "DOCUMENTS_PURGED", {
    count: documents.length,
    retentionDays: 40,
    purgedAt,
  });
  return { cutoff, selected: documents.length, purged: documents.length, failed: 0 };
}

async function recordRetentionFailure(documents: RetentionDocument[], failureCode: string) {
  const supabase = createSupabaseAdminClient();
  await Promise.all(documents.map((document) => supabase
    .from("process_documents")
    .update({
      purge_attempts: document.purge_attempts + 1,
      purge_error: failureCode,
    })
    .eq("id", document.id)));
  await recordRetentionEvents(documents, "DOCUMENT_RETENTION_FAILED", {
    count: documents.length,
    reason: failureCode,
  });
}

async function recordRetentionEvents(
  documents: RetentionDocument[],
  eventType: string,
  metadata: Record<string, unknown>,
) {
  const organizations = [...new Set(documents.map((document) => document.organization_id))];
  const { error } = await createSupabaseAdminClient().from("audit_events").insert(
    organizations.map((organizationId) => ({
      organization_id: organizationId,
      actor_id: null,
      event_type: eventType,
      entity_type: "document_retention",
      entity_id: null,
      metadata,
    })),
  );
  if (error) console.error(JSON.stringify({ event: "DOCUMENT_RETENTION_AUDIT_FAILED", errorCode: errorCode(error) }));
}
