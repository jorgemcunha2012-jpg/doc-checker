import type { Development, DevelopmentExtraction } from "@/domain/development";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const localDevelopments = new Map<string, Development>();
type DevelopmentRow = {
  id: string;
  organization_id: string;
  name: string;
  city: string | null;
  registration: string | null;
  seller_legal_name?: string | null;
  seller_cnpj?: string | null;
  source_document_name: string;
  created_at: string;
  development_units: Array<{
    id: string;
    tower: string;
    unit: string;
    private_area: string;
    total_area: string | null;
    ideal_fraction: string | null;
    iptu_registration?: string | null;
    typology: string | null;
    registration: string | null;
    confidence: number;
  }>;
};

export async function listDevelopments(organizationId: string): Promise<Development[]> {
  if (!isSupabaseConfigured()) {
    return [...localDevelopments.values()].filter((item) => item.organizationId === organizationId);
  }

  const supabase = createSupabaseAdminClient();
  let data: DevelopmentRow[] | null;
  let error: { message: string } | null;
  ({ data, error } = await supabase
    .from("developments")
    .select("id, organization_id, name, city, registration, seller_legal_name, seller_cnpj, source_document_name, created_at, development_units(id, tower, unit, private_area, total_area, ideal_fraction, iptu_registration, typology, registration, confidence)")
    .eq("organization_id", organizationId)
    .order("name"));
  if (error?.message.includes("seller_legal_name") || error?.message.includes("seller_cnpj") || error?.message.includes("iptu_registration")) {
    ({ data, error } = await supabase
      .from("developments")
      .select("id, organization_id, name, city, registration, source_document_name, created_at, development_units(id, tower, unit, private_area, total_area, ideal_fraction, typology, registration, confidence)")
      .eq("organization_id", organizationId)
      .order("name"));
  }
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    city: row.city ?? undefined,
    registration: row.registration ?? undefined,
    sellerLegalName: row.seller_legal_name ?? undefined,
    sellerCnpj: row.seller_cnpj ?? undefined,
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
      iptuRegistration: unit.iptu_registration ?? undefined,
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
    sellerLegalName: extraction.sellerLegalName,
    sellerCnpj: extraction.sellerCnpj,
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
  const developmentPayload = {
    id: development.id,
    organization_id: organizationId,
    name: development.name,
    city: development.city ?? null,
    registration: development.registration ?? null,
    seller_legal_name: development.sellerLegalName ?? null,
    seller_cnpj: development.sellerCnpj ?? null,
    source_document_name: sourceDocumentName,
  };
  let { error } = await supabase.from("developments").insert(developmentPayload);
  if (error?.message.includes("seller_legal_name") || error?.message.includes("seller_cnpj") || error?.message.includes("iptu_registration")) {
    const legacyPayload = Object.fromEntries(Object.entries(developmentPayload).filter(([key]) => key !== "seller_legal_name" && key !== "seller_cnpj"));
    ({ error } = await supabase.from("developments").insert(legacyPayload));
  }
  if (error) throw new Error(error.message);
  let { error: unitsError } = await supabase.from("development_units").insert(
    development.units.map((unit) => ({
      id: unit.id,
      development_id: development.id,
      organization_id: organizationId,
      tower: unit.tower || "TIPO",
      unit: unit.unit || unit.typology || "TIPO",
      private_area: unit.privateArea,
      total_area: unit.totalArea ?? null,
      ideal_fraction: unit.idealFraction ?? null,
      iptu_registration: unit.iptuRegistration ?? null,
      typology: unit.typology ?? null,
      registration: unit.registration ?? null,
      confidence: unit.confidence,
    })),
  );
  if (unitsError?.message.includes("iptu_registration")) {
    ({ error: unitsError } = await supabase.from("development_units").insert(
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
    ));
  }
  if (unitsError) {
    await supabase.from("developments").delete().eq("id", development.id);
    throw new Error(unitsError.message);
  }
  return development;
}

export async function deleteDevelopment(organizationId: string, developmentId: string) {
  if (!isSupabaseConfigured()) {
    const development = localDevelopments.get(developmentId);
    if (!development || development.organizationId !== organizationId) return false;
    localDevelopments.delete(developmentId);
    return true;
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("developments")
    .delete()
    .eq("id", developmentId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function updateDevelopment(
  organizationId: string,
  developmentId: string,
  sourceDocumentName: string,
  extraction: DevelopmentExtraction,
) {
  const current = (await listDevelopments(organizationId)).find((item) => item.id === developmentId);
  if (!current) return null;

  const updated: Development = {
    ...current,
    name: extraction.name,
    city: extraction.city,
    registration: extraction.registration,
    sellerLegalName: extraction.sellerLegalName,
    sellerCnpj: extraction.sellerCnpj,
    sourceDocumentName: sourceDocumentName || current.sourceDocumentName,
    units: extraction.units.map((unit) => ({
      ...unit,
      id: crypto.randomUUID(),
      developmentId,
    })),
  };

  if (!isSupabaseConfigured()) {
    localDevelopments.set(developmentId, updated);
    return updated;
  }

  const supabase = createSupabaseAdminClient();
  const developmentPayload = {
    name: updated.name,
    city: updated.city ?? null,
    registration: updated.registration ?? null,
    seller_legal_name: updated.sellerLegalName ?? null,
    seller_cnpj: updated.sellerCnpj ?? null,
    source_document_name: updated.sourceDocumentName,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase
    .from("developments")
    .update(developmentPayload)
    .eq("id", developmentId)
    .eq("organization_id", organizationId);
  if (error?.message.includes("seller_legal_name") || error?.message.includes("seller_cnpj")) {
    const legacyPayload = Object.fromEntries(Object.entries(developmentPayload).filter(([key]) => key !== "seller_legal_name" && key !== "seller_cnpj"));
    ({ error } = await supabase.from("developments").update(legacyPayload).eq("id", developmentId).eq("organization_id", organizationId));
  }
  if (error) throw new Error(error.message);

  const { error: deleteUnitsError } = await supabase
    .from("development_units")
    .delete()
    .eq("development_id", developmentId)
    .eq("organization_id", organizationId);
  if (deleteUnitsError) throw new Error(deleteUnitsError.message);

  let { error: unitsError } = await supabase.from("development_units").insert(updated.units.map((unit) => unitRow(unit)));
  if (unitsError?.message.includes("iptu_registration")) {
    ({ error: unitsError } = await supabase.from("development_units").insert(updated.units.map((unit) => unitRow(unit, true))));
  }
  if (unitsError) throw new Error(unitsError.message);
  return updated;

  function unitRow(unit: Development["units"][number], withoutIptu = false) {
    const row = {
      id: unit.id,
      development_id: developmentId,
      organization_id: organizationId,
      tower: unit.tower || "TIPO",
      unit: unit.unit || unit.typology || "TIPO",
      private_area: unit.privateArea,
      total_area: unit.totalArea ?? null,
      ideal_fraction: unit.idealFraction ?? null,
      iptu_registration: unit.iptuRegistration ?? null,
      typology: unit.typology ?? null,
      registration: unit.registration ?? null,
      confidence: unit.confidence,
    };
    if (withoutIptu) {
      const { iptu_registration, ...legacyRow } = row;
      void iptu_registration;
      return legacyRow;
    }
    return row;
  }
}

function compareUnits(left: Development["units"][number], right: Development["units"][number]) {
  return left.tower.localeCompare(right.tower, "pt-BR", { numeric: true }) ||
    left.unit.localeCompare(right.unit, "pt-BR", { numeric: true });
}
