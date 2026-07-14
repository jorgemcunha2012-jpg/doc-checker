import type { ExtractedFieldValue } from "./validation";

export type DevelopmentUnit = {
  id: string;
  developmentId: string;
  tower: string;
  unit: string;
  privateArea: string;
  totalArea?: string;
  idealFraction?: string;
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
  sourceDocumentName: string;
  units: DevelopmentUnit[];
  createdAt: string;
};

export type DevelopmentExtraction = {
  name: string;
  city?: string;
  registration?: string;
  units: Array<Omit<DevelopmentUnit, "id" | "developmentId">>;
  quality?: DevelopmentExtractionQuality;
};

export type DevelopmentExtractionQuality = {
  reviewRequired: string[];
  warnings: string[];
  sourcesCompared?: string[];
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
  development: Pick<Development, "name" | "registration">,
  unit: DevelopmentUnit,
): ExtractedFieldValue[] {
  const source = "CADASTRO_EMPREENDIMENTO" as const;
  const confidence = unit.confidence;
  return [
    { fieldId: "property.development", source, value: development.name, confidence },
    { fieldId: "property.registration", source, value: unit.registration ?? development.registration ?? null, confidence },
    { fieldId: "property.unit", source, value: unit.unit, confidence },
    { fieldId: "property.tower", source, value: unit.tower, confidence },
    { fieldId: "property.privateArea", source, value: unit.privateArea, confidence },
    { fieldId: "property.totalArea", source, value: unit.totalArea ?? null, confidence },
    { fieldId: "property.idealFraction", source, value: unit.idealFraction ?? null, confidence },
  ];
}

export function reviewDevelopmentExtraction(extraction: DevelopmentExtraction): DevelopmentExtractionReview {
  const towers = new Set(extraction.units.map((unit) => unit.tower.trim()).filter(Boolean));
  const types = new Set(extraction.units.map(unitTypeSignature));
  const incompleteUnits = extraction.units.filter((unit) =>
    !unit.tower.trim() || !unit.unit.trim() || !unit.privateArea.trim(),
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

export function unitTypeSignature(unit: Pick<DevelopmentUnit, "privateArea" | "totalArea" | "idealFraction" | "typology">) {
  return [
    unit.typology?.trim() || "Tipo não informado",
    unit.privateArea.trim() || "-",
    unit.totalArea?.trim() || "-",
    unit.idealFraction?.trim() || "-",
  ].join("::");
}
