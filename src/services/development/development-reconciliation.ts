import type { DevelopmentExtraction } from "@/domain/development";

export function reconcileDevelopmentExtractions(
  ocr: DevelopmentExtraction | null,
  vision: DevelopmentExtraction | null,
): DevelopmentExtraction | null {
  if (!ocr && !vision) return null;
  if (!ocr) return addQuality(vision!, [], ["A confirmação independente por OCR não ficou disponível."]);
  if (!vision) return addQuality(ocr, [], ["A confirmação independente por visão não ficou disponível."]);

  const reviewRequired = new Set<string>();
  const warnings = new Set<string>();
  for (const issue of ocr.quality?.reviewRequired ?? []) reviewRequired.add(`OCR: ${issue}`);
  for (const issue of vision.quality?.reviewRequired ?? []) reviewRequired.add(`Visão IA: ${issue}`);
  for (const warning of ocr.quality?.warnings ?? []) warnings.add(`OCR: ${warning}`);
  for (const warning of vision.quality?.warnings ?? []) warnings.add(`Visão IA: ${warning}`);
  const byKey = new Map<string, typeof ocr.units[number]>();
  const visionByKey = new Map(vision.units.map((unit) => [unitKey(unit), unit]));

  for (const unit of ocr.units) {
    const key = unitKey(unit);
    const counterpart = visionByKey.get(key);
    if (!counterpart) {
      reviewRequired.add(`${unitLabel(unit)} não foi confirmado pela visão da IA.`);
      byKey.set(key, { ...unit, confidence: Math.min(unit.confidence, 69) });
      continue;
    }
    if (!sameUnitData(unit, counterpart)) {
      reviewRequired.add(`${unitLabel(unit)} tem divergência entre OCR e visão da IA.`);
      byKey.set(key, { ...unit, confidence: Math.min(unit.confidence, counterpart.confidence, 69) });
    } else {
      byKey.set(key, { ...unit, confidence: Math.min(99, Math.max(unit.confidence, counterpart.confidence) + 5) });
    }
  }

  for (const unit of vision.units) {
    const key = unitKey(unit);
    if (!byKey.has(key)) {
      reviewRequired.add(`${unitLabel(unit)} foi encontrada apenas pela visão da IA.`);
      byKey.set(key, { ...unit, confidence: Math.min(unit.confidence, 69) });
    }
  }

  if (!sameText(ocr.name, vision.name) && ocr.name !== "Empreendimento sem nome" && vision.name !== "Empreendimento sem nome") {
    reviewRequired.add("O nome do empreendimento divergiu entre as duas leituras.");
  }
  if (ocr.units.length !== vision.units.length) {
    warnings.add(`As leituras encontraram quantidades diferentes de unidades (${ocr.units.length} e ${vision.units.length}).`);
  }

  return {
    name: vision.name !== "Empreendimento sem nome" ? vision.name : ocr.name,
    city: vision.city ?? ocr.city,
    registration: vision.registration ?? ocr.registration,
    units: [...byKey.values()].sort((left, right) => left.tower.localeCompare(right.tower, "pt-BR", { numeric: true }) || left.unit.localeCompare(right.unit, "pt-BR", { numeric: true })),
    quality: {
      reviewRequired: [...reviewRequired],
      warnings: [...warnings],
      sourcesCompared: ["OCR", "Visão IA"],
    },
  };
}

function addQuality(extraction: DevelopmentExtraction, reviewRequired: string[], warnings: string[]) {
  return {
    ...extraction,
    quality: {
      reviewRequired: [...new Set([...(extraction.quality?.reviewRequired ?? []), ...reviewRequired])],
      warnings: [...new Set([...(extraction.quality?.warnings ?? []), ...warnings])],
      sourcesCompared: extraction.quality?.sourcesCompared,
    },
  };
}

function unitKey(unit: { tower: string; unit: string }) {
  const candidate = unit as typeof unit & { typology?: string; privateArea?: string; totalArea?: string; idealFraction?: string };
  // A type is the identity of a registry record. Areas are compared as data,
  // so an area mismatch must be reported as a divergence, not as two missing types.
  if (candidate.typology?.trim()) return normalize(candidate.typology);
  return `${normalize(unit.tower)}::${normalize(unit.unit)}`;
}

function sameUnitData(left: unitForType, right: unitForType) {
  return [left.privateArea, left.totalArea, left.idealFraction, left.typology].every((value, index) =>
    sameText(String(value ?? ""), String([right.privateArea, right.totalArea, right.idealFraction, right.typology][index] ?? "")),
  );
}

type unitForType = { tower: string; unit: string; privateArea: string; totalArea?: string; idealFraction?: string; typology?: string; confidence: number };

function unitLabel(unit: { tower: string; unit: string; typology?: string; privateArea?: string }) {
  return unit.typology?.trim() ? `${unit.typology} · área ${unit.privateArea ?? "não informada"}` : `Torre ${unit.tower} · apartamento ${unit.unit}`;
}

function sameText(left: string, right: string) {
  return normalize(left) === normalize(right);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
