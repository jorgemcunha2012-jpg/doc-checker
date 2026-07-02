import type { ExtractedFieldValue } from "./validation";

export type DevelopmentUnit = {
  id: string;
  developmentId: string;
  tower: string;
  unit: string;
  privateArea: string;
  typology?: string;
  registration?: string;
  confidence: number;
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
  ];
}
