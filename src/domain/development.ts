import type { ExtractedFieldValue } from "./validation";

export type DevelopmentUnit = {
  id: string;
  developmentId: string;
  tower: string;
  unit: string;
  privateArea: string;
  commonArea?: string;
  totalArea?: string;
  idealFraction?: string;
  iptuRegistration?: string;
  typology?: string;
  registration?: string;
  confidence: number;
  evidence?: {
    pages?: number[];
    rawText?: string;
  };
};

export type Development = {
  id: string;
  organizationId: string;
  name: string;
  city?: string;
  registration?: string;
  sellerLegalName?: string;
  sellerCnpj?: string;
  sourceDocumentName: string;
  units: DevelopmentUnit[];
  createdAt: string;
};

export type DevelopmentExtraction = {
  name: string;
  city?: string;
  registration?: string;
  sellerLegalName?: string;
  sellerCnpj?: string;
  units: Array<Omit<DevelopmentUnit, "id" | "developmentId">>;
  quality?: DevelopmentExtractionQuality;
};

export type DevelopmentExtractionQuality = {
  reviewRequired: string[];
  warnings: string[];
  sourcesCompared?: string[];
  detectedTypologies?: string[];
};

export type DevelopmentExtractionReview = {
  towerCount: number;
  unitCount: number;
  typeCount: number;
  incompleteUnits: number;
  lowConfidenceUnits: number;
  canSave: boolean;
};

export function developmentUnitValues(
  development: Pick<Development, "name" | "registration" | "sellerLegalName" | "sellerCnpj">,
  unit: DevelopmentUnit,
): ExtractedFieldValue[] {
  const source = "CADASTRO_EMPREENDIMENTO" as const;
  const confidence = unit.confidence;
  const values: ExtractedFieldValue[] = [
    { fieldId: "property.development", source, value: development.name, confidence },
    { fieldId: "property.registration", source, value: unit.registration ?? development.registration ?? null, confidence },
    { fieldId: "property.privateArea", source, value: unit.privateArea, confidence },
    { fieldId: "property.commonArea", source, value: unit.commonArea ?? null, confidence },
    { fieldId: "property.totalArea", source, value: unit.totalArea ?? null, confidence },
    { fieldId: "property.idealFraction", source, value: unit.idealFraction ?? null, confidence },
    { fieldId: "property.iptu", source, value: unit.iptuRegistration ?? null, confidence },
  ];
  if (development.sellerLegalName?.trim()) values.splice(2, 0, { fieldId: "seller.legalName", source, value: development.sellerLegalName, confidence });
  if (development.sellerCnpj?.trim()) values.splice(3, 0, { fieldId: "seller.cnpj", source, value: development.sellerCnpj, confidence });
  if (unit.unit.trim()) values.splice(2, 0, { fieldId: "property.unit", source, value: unit.unit, confidence });
  if (unit.tower.trim()) values.splice(unit.unit.trim() ? 3 : 2, 0, { fieldId: "property.tower", source, value: unit.tower, confidence });
  return values;
}

export function reviewDevelopmentExtraction(extraction: DevelopmentExtraction): DevelopmentExtractionReview {
  const towers = new Set(extraction.units.map((unit) => unit.tower.trim()).filter(Boolean));
  const types = new Set(extraction.units.map(unitTypeSignature).filter((signature) => !signature.startsWith("Tipo não informado::")));
  const incompleteUnits = extraction.units.filter((unit) =>
    !unit.privateArea.trim() || !unit.typology?.trim(),
  ).length;
  const lowConfidenceUnits = extraction.units.filter((unit) => unit.confidence < 80).length;

  return {
    towerCount: towers.size,
    unitCount: extraction.units.length,
    typeCount: types.size,
    incompleteUnits,
    lowConfidenceUnits,
    // Saving the reviewed screen is the explicit human confirmation. Quality
    // findings remain visible and auditable, but should not trap the reviewer.
    canSave: Boolean(extraction.name.trim()) && extraction.units.length > 0 && incompleteUnits === 0,
  };
}

export function unitTypeSignature(unit: Pick<DevelopmentUnit, "privateArea" | "commonArea" | "totalArea" | "idealFraction" | "typology">) {
  return [
    unit.typology?.trim() || "Tipo não informado",
    unit.privateArea.trim() || "-",
    unit.commonArea?.trim() || "-",
    unit.totalArea?.trim() || "-",
    unit.idealFraction?.trim() || "-",
  ].join("::");
}
