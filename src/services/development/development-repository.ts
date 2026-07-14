import type { Development, DevelopmentExtraction } from "@/domain/development";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const localDevelopments = new Map<string, Development>();

export async function listDevelopments(organizationId: string): Promise<Development[]> {
  if (!isSupabaseConfigured()) {
    return [...localDevelopments.values()].filter((item) => item.organizationId === organizationId);
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("developments")
    .select("id, organization_id, name, city, registration, source_document_name, created_at, development_units(id, tower, unit, private_area, total_area, ideal_fraction, typology, registration, confidence)")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    city: row.city ?? undefined,
    registration: row.registration ?? undefined,
    sourceDocumentName: row.source_document_name,
    createdAt: row.created_at,
    units: (row.development_units ?? []).map((unit) => ({
      id: unit.id,
      developmentId: row.id,
      tower: unit.tower === "TIPO" ? "" : unit.tower,
      unit: unit.tower === "TIPO" ? "" : unit.unit,
      privateArea: unit.private_area,
      totalArea: unit.total_area ?? undefined,
      idealFraction: unit.ideal_fraction ?? undefined,
      typology: unit.typology ?? undefined,
      registration: unit.registration ?? undefined,
      confidence: Number(unit.confidence),
    })).sort(compareUnits),
  }));
}

export async function getDevelopmentUnit(organizationId: string, unitId: string) {
  const developments = await listDevelopments(organizationId);
  for (const development of developments) {
    const unit = development.units.find((candidate) => candidate.id === unitId);
    if (unit) return { development, unit };
  }
  return null;
}

export async function createDevelopment(
  organizationId: string,
  sourceDocumentName: string,
  extraction: DevelopmentExtraction,
) {
  const developmentId = crypto.randomUUID();
  const development: Development = {
    id: developmentId,
    organizationId,
    name: extraction.name,
    city: extraction.city,
    registration: extraction.registration,
    sourceDocumentName,
    createdAt: new Date().toISOString(),
    units: extraction.units.map((unit) => ({
      ...unit,
      id: crypto.randomUUID(),
      developmentId,
    })),
  };

  if (!isSupabaseConfigured()) {
    localDevelopments.set(development.id, development);
    return development;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("developments").insert({
    id: development.id,
    organization_id: organizationId,
    name: development.name,
    city: development.city ?? null,
    registration: development.registration ?? null,
    source_document_name: sourceDocumentName,
  });
  if (error) throw new Error(error.message);
  const { error: unitsError } = await supabase.from("development_units").insert(
    development.units.map((unit) => ({
      id: unit.id,
      development_id: development.id,
      organization_id: organizationId,
      tower: unit.tower || "TIPO",
      unit: unit.unit || unit.typology || "TIPO",
      private_area: unit.privateArea,
      total_area: unit.totalArea ?? null,
      ideal_fraction: unit.idealFraction ?? null,
      typology: unit.typology ?? null,
      registration: unit.registration ?? null,
      confidence: unit.confidence,
    })),
  );
  if (unitsError) {
    await supabase.from("developments").delete().eq("id", development.id);
    throw new Error(unitsError.message);
  }
  return development;
}

function compareUnits(left: Development["units"][number], right: Development["units"][number]) {
  return left.tower.localeCompare(right.tower, "pt-BR", { numeric: true }) ||
    left.unit.localeCompare(right.unit, "pt-BR", { numeric: true });
}
