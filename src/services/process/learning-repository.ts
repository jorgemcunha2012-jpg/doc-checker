import type { AuthenticatedUser } from "@/lib/auth";
import type { FieldComparisonResult, LearnedEquivalenceRule } from "@/domain/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { buildApprovedEquivalenceRule } from "@/services/validation/supervised-learning-service";

type LearnedEquivalenceRow = {
  organization_id: string;
  field_id: string;
  field_type: LearnedEquivalenceRule["fieldType"];
  rule_kind: LearnedEquivalenceRule["ruleKind"];
  signature: string;
  normalized_values: string[];
  example_values: Record<string, string | null>;
  occurrence_count: number;
};

export async function loadLearnedEquivalences(organizationId: string): Promise<LearnedEquivalenceRule[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createSupabaseAdminClient()
    .from("learned_field_equivalences")
    .select("organization_id, field_id, field_type, rule_kind, signature, normalized_values, example_values, occurrence_count")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (error) {
    console.error("[ConferIA] Falha ao carregar aprendizado supervisionado", error.message);
    return [];
  }
  return (data as LearnedEquivalenceRow[] | null ?? []).map((row) => ({
    organizationId: row.organization_id,
    fieldId: row.field_id,
    fieldType: row.field_type,
    ruleKind: row.rule_kind,
    signature: row.signature,
    normalizedValues: row.normalized_values,
    exampleValues: row.example_values,
    occurrenceCount: row.occurrence_count,
  }));
}

export async function learnFromApprovedReview(
  processId: string,
  result: FieldComparisonResult,
  actor: AuthenticatedUser,
) {
  if (!isSupabaseConfigured()) return;
  const candidate = buildApprovedEquivalenceRule(result);
  if (!candidate) return;

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: selectError } = await supabase
    .from("learned_field_equivalences")
    .select("id, occurrence_count")
    .eq("organization_id", actor.organizationId)
    .eq("field_id", candidate.fieldId)
    .eq("signature", candidate.signature)
    .maybeSingle();
  if (selectError) throw new Error(`Falha ao consultar aprendizado: ${selectError.message}`);

  if (existing) {
    const { error } = await supabase
      .from("learned_field_equivalences")
      .update({
        occurrence_count: (existing.occurrence_count ?? 0) + 1,
        example_values: candidate.exampleValues,
        last_process_id: processId,
        last_reviewer_id: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Falha ao atualizar aprendizado: ${error.message}`);
  } else {
    const { error } = await supabase.from("learned_field_equivalences").insert({
      organization_id: actor.organizationId,
      field_id: candidate.fieldId,
      field_type: candidate.fieldType,
      rule_kind: candidate.ruleKind,
      signature: candidate.signature,
      normalized_values: candidate.normalizedValues,
      example_values: candidate.exampleValues,
      occurrence_count: 1,
      first_process_id: processId,
      last_process_id: processId,
      created_by: actor.id,
      last_reviewer_id: actor.id,
    });
    if (error) throw new Error(`Falha ao registrar aprendizado: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    organization_id: actor.organizationId,
    actor_id: actor.id,
    event_type: "LEARNING_RULE_RECORDED",
    entity_type: "learned_field_equivalence",
    entity_id: candidate.fieldId,
    metadata: {
      processId,
      ruleKind: candidate.ruleKind,
      signature: candidate.signature,
    },
  });
}
