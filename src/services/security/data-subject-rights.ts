import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { decryptStoredJson } from "@/lib/security/field-encryption";
import { normalizeCpf } from "./data-subject-identifier";

const PROCESS_PAGE_SIZE = 250;

type ProcessRecord = {
  id: string;
  organization_id: string;
  user_id: string;
  validation_type: string;
  processing_status: string;
  final_status: string;
  result: unknown;
  summary: unknown;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  process_documents: Array<Record<string, unknown>> | null;
  human_reviews: Array<Record<string, unknown>> | null;
  validation_results: Array<Record<string, unknown>> | null;
};

export type DataSubjectExport = {
  requestedCpf: string;
  exportedAt: string;
  processes: Array<Omit<ProcessRecord, "result" | "summary" | "validation_results"> & {
    result: unknown;
    summary: unknown;
    validation_results: Array<Record<string, unknown>>;
  }>;
  auditEvents: Array<Record<string, unknown>>;
};

export async function exportDataSubjectByCpf(cpf: string): Promise<DataSubjectExport> {
  const requestedCpf = normalizeCpf(cpf);
  const processes = await matchingProcesses(requestedCpf);
  const processIds = processes.map((process) => process.id);
  const auditEvents = await relatedAuditEvents(processIds);
  return {
    requestedCpf,
    exportedAt: new Date().toISOString(),
    processes,
    auditEvents,
  };
}

export async function eraseDataSubjectByCpf(cpf: string) {
  const requestedCpf = normalizeCpf(cpf);
  const processes = await matchingProcesses(requestedCpf);
  const processIds = processes.map((process) => process.id);
  const storagePaths = processes.flatMap((process) => (process.process_documents ?? [])
    .map((document) => document.storage_path)
    .filter((path): path is string => typeof path === "string"));
  const supabase = createSupabaseAdminClient();

  if (storagePaths.length) {
    const { error } = await supabase.storage.from("process-documents").remove(storagePaths);
    if (error) throw new Error("Não foi possível remover todos os arquivos do titular.");
  }
  if (processIds.length) {
    const { error: auditError } = await supabase
      .from("audit_events")
      .delete()
      .or(auditEventFilter(processIds));
    if (auditError) throw new Error("Não foi possível remover os eventos relacionados ao titular.");
    const { error: deleteError } = await supabase.from("validation_processes").delete().in("id", processIds);
    if (deleteError) throw new Error("Não foi possível remover os processos do titular.");
  }

  return { requestedCpf, processCount: processIds.length, storageFileCount: storagePaths.length };
}

async function matchingProcesses(cpf: string) {
  const supabase = createSupabaseAdminClient();
  const matching: DataSubjectExport["processes"] = [];
  for (let from = 0; ; from += PROCESS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("validation_processes")
      .select("id, organization_id, user_id, validation_type, processing_status, final_status, result, summary, error, started_at, completed_at, updated_at, process_documents(id, name, document_type, source, mime_type, size_bytes, storage_path, created_at), human_reviews(id, field_id, status, justification, reviewer_id, reviewer_name, reviewed_at), validation_results(id, field_id, field_label, field_category, automatic_status, observation, values_by_source, created_at)")
      .order("started_at", { ascending: false })
      .range(from, from + PROCESS_PAGE_SIZE - 1);
    if (error) throw new Error("Não foi possível consultar os processos para o titular.");
    const records = (data ?? []) as ProcessRecord[];
    for (const record of records) {
      const result = decryptStoredJson(record.result);
      const validationResults = (record.validation_results ?? []).map((item) => ({
        ...item,
        values_by_source: decryptStoredJson(item.values_by_source),
      }));
      if (!containsCpf(result, cpf) && !containsCpf(validationResults, cpf)) continue;
      matching.push({ ...record, result, summary: decryptStoredJson(record.summary), validation_results: validationResults });
    }
    if (records.length < PROCESS_PAGE_SIZE) break;
  }
  return matching;
}

async function relatedAuditEvents(processIds: string[]) {
  if (!processIds.length) return [];
  const { data, error } = await createSupabaseAdminClient()
    .from("audit_events")
    .select("id, organization_id, actor_id, event_type, entity_type, entity_id, metadata, created_at")
    .or(auditEventFilter(processIds));
  if (error) throw new Error("Não foi possível consultar os eventos do titular.");
  return data ?? [];
}

function containsCpf(value: unknown, cpf: string): boolean {
  if (typeof value === "string") return value.replace(/\D/g, "").includes(cpf);
  if (Array.isArray(value)) return value.some((item) => containsCpf(item, cpf));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsCpf(item, cpf));
  return false;
}

function auditEventFilter(processIds: string[]) {
  return processIds.flatMap((id) => [`entity_id.eq.${id}`, `entity_id.like.${id}:*`]).join(",");
}
