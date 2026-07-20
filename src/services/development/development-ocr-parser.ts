import type { DevelopmentExtraction } from "@/domain/development";

export function extractDevelopmentFromOcrText(text: string): DevelopmentExtraction {
  const normalized = normalizeOcrText(text);
  const name = extractName(normalized);
  const city = extractCity(normalized);
  const registration = normalized.match(/mat(?:ricula|\.)?\s*[:.]?\s*([0-9][0-9. -]{2,})/)?.[1]?.replace(/\D/g, "") || undefined;
  const sellerCnpj = normalized.match(/\bcnpj\b[^\d]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i)?.[1];
  const sellerLegalName = extractSellerLegalName(normalized);
  const units = extractUnits(normalized);
  const detectedTypologies = extractTypologies(normalized);
  const quality = validateUnits(units, detectedTypologies);

  return {
    name: name || "Empreendimento sem nome",
    city,
    registration,
    sellerLegalName,
    sellerCnpj,
    units,
    quality: { ...quality, detectedTypologies },
  };
}

function extractUnits(text: string): DevelopmentExtraction["units"] {
  const tableUnits = extractTabularUnits(text);
  if (tableUnits.length) return tableUnits;
  const units = new Map<string, DevelopmentExtraction["units"][number]>();
  const areaPattern = /(?:com\s+uma\s+)?area\s+privativa(?:\s+(?:principal|coberta\s+padrao|coberta|total|util))?\s*(?:de|:)?\s*([0-9][0-9.]*[,.][0-9]{2,6})\s*m?/g;
  let previousEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = areaPattern.exec(text)) !== null) {
    const context = text.slice(previousEnd, match.index);
    const after = text.slice(match.index, match.index + 360);
    const privateArea = normalizeDecimal(match[1]) ?? "";
    const commonArea = normalizeDecimal(after.match(/(?:area\s+(?:de\s+uso\s+)?comum|area\s+comum\s+real)\s*(?:de|:)?\s*([0-9][0-9.]*[,.][0-9]{2,6})\s*m?/)?.[1]);
    const totalArea = normalizeDecimal(after.match(/(?:area\s+total\s+real|area\s+real\s+total)\s+de\s+([0-9][0-9.]*[,.][0-9]{3,6})\s*m?/)?.[1]);
    const idealFraction = normalizeDecimal(after.match(/fracao ideal de\s+([0-9][,.][0-9]{6,12})/)?.[1]);
    const iptuRegistration = after.match(/(?:inscricao\s+(?:imobiliaria|municipal)|inscricao\s+do\s+imovel|iptu)\s*[:.]?\s*([a-z0-9./-]{3,30})/i)?.[1] ||
      context.match(/(?:inscricao\s+(?:imobiliaria|municipal)|inscricao\s+do\s+imovel|iptu)\s*[:.]?\s*([a-z0-9./-]{3,30})/i)?.[1];
    const typology = extractTypology(context);
    const key = `${typology ?? "tipo"}::${privateArea}::${totalArea ?? ""}::${idealFraction ?? ""}`;
    units.set(key, {
      tower: "",
      unit: "",
      privateArea,
      ...(commonArea ? { commonArea } : {}),
      totalArea,
      idealFraction,
      ...(iptuRegistration ? { iptuRegistration } : {}),
      typology,
      confidence: idealFraction ? 88 : 82,
      evidence: {
        pages: extractPages(context),
        rawText: compactEvidence(`${context.slice(-220)} ${after.slice(0, 180)}`),
      },
    });
    previousEnd = match.index + match[0].length;
  }

  return [...units.values()].sort((left, right) =>
    left.tower.localeCompare(right.tower, "pt-BR", { numeric: true }) ||
    left.unit.localeCompare(right.unit, "pt-BR", { numeric: true }),
  );
}

// Handles exported spreadsheets/registries printed to PDF, where the column
// labels appear once and each row contains tower, unit, type and areas.
function extractTabularUnits(text: string): DevelopmentExtraction["units"] {
  const units = new Map<string, DevelopmentExtraction["units"][number]>();
  const rowPattern = /\b(\d{1,3})\s+(\d{3,5})\s+([a-z](?:-[a-z]+)?)\s+(\d{1,4}[.,]\d{2,6})\s+(\d{1,4}[.,]\d{3,8})\s+(\d[.,]\d{5,14})\b/gi;
  for (const match of text.matchAll(rowPattern)) {
    const tower = match[1];
    const unit = match[2];
    const typology = `Tipo ${match[3].toUpperCase()}`;
    const privateArea = normalizeDecimal(match[4]) ?? "";
    const totalArea = normalizeDecimal(match[5]);
    const idealFraction = normalizeDecimal(match[6]);
    const key = `${tower}::${unit}::${typology}::${privateArea}`;
    units.set(key, {
      tower,
      unit,
      typology,
      privateArea,
      totalArea,
      idealFraction,
      confidence: 96,
      evidence: {
        pages: pageAtIndex(text, match.index ?? 0),
        rawText: compactEvidence(match[0]),
      },
    });
  }
  return [...units.values()];
}

function pageAtIndex(text: string, index: number) {
  const prefix = text.slice(0, index);
  const pages = [...prefix.matchAll(/\[?P[AÁ]GINA\s+(\d+)\]?/gi)].map((match) => Number(match[1])).filter((page) => page > 0);
  return pages.length ? [pages.at(-1)!] : undefined;
}

function validateUnits(units: DevelopmentExtraction["units"], detectedTypologies: string[]): NonNullable<DevelopmentExtraction["quality"]> {
  const reviewRequired = new Set<string>();
  const warnings = new Set<string>();
  for (const unit of units) {
    const privateArea = parseDecimal(unit.privateArea);
    const totalArea = parseDecimal(unit.totalArea);
    const fraction = parseDecimal(unit.idealFraction);
    const label = `${unit.typology ?? "Unidade"} · torre ${unit.tower} · apartamento ${unit.unit}`;
    if (!unit.evidence?.rawText) reviewRequired.add(`${label} não possui trecho de evidência.`);
    if (privateArea === null || privateArea <= 0) reviewRequired.add(`${label} possui área privativa inválida.`);
    if (totalArea !== null && privateArea !== null && totalArea < privateArea) reviewRequired.add(`${label} possui área total menor que a área privativa.`);
    if (fraction !== null && (fraction <= 0 || fraction >= 1)) reviewRequired.add(`${label} possui fração ideal fora do intervalo esperado.`);
    if (!unit.totalArea || !unit.idealFraction) warnings.add(`${label} não possui todas as áreas/fração ideal legíveis.`);
  }
  if (!units.length) {
    reviewRequired.add(detectedTypologies.length
      ? `Tipos identificados (${detectedTypologies.join(", ")}), mas nenhuma área privativa foi associada a eles.`
      : "Nenhum tipo de unidade com área privativa foi identificado com evidência suficiente.");
  }
  return { reviewRequired: [...reviewRequired], warnings: [...warnings] };
}

function extractPages(value: string) {
  return [...value.matchAll(/\[PAGINA\s+(\d+)\]/g)].map((match) => Number(match[1])).filter((page) => page > 0);
}

function compactEvidence(value: string) {
  return value.replace(/\[PAGINA\s+\d+\]/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function extractName(text: string) {
  const named = text.match(/denominado\s+(condominio\s+[^,.\n]+)/);
  if (named) return toDisplayName(named[1]);
  const empreendimento = text.match(/empreendimento\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,4})(?=,?\s+(?:que\s+sera|a\s+ser\s+construido|objeto|residencial)|[,\.])/);
  return empreendimento ? toDisplayName(empreendimento[1]) : undefined;
}

function extractSellerLegalName(text: string) {
  const labeled = text.match(/(?:proprietario|proprietaria|incorporadora|construtora|transmitente|razao social|denominacao)[^:\n\r]{0,50}:\s*([^\n\r]+)/i);
  return labeled?.[1]?.replace(/\s+/g, " ").trim() || undefined;
}

function extractCity(text: string) {
  const match = text.match(/municipio de\s+([a-z\s-]+?)(?:-ce|,|\.)/);
  return match ? toDisplayName(match[1]) : undefined;
}

function extractTypology(context: string) {
  const matches = [...context.matchAll(/tipo\s+([a-z0-9-]{1,12})/g)];
  const raw = matches.at(-1)?.[1]?.replace(/[^a-z0-9-]/g, "");
  return raw ? `Tipo ${raw.toUpperCase()}` : undefined;
}

function extractTypologies(text: string) {
  return [...new Set([...text.matchAll(/\btipo\s+([a-z0-9-]{1,12})/g)]
    .map((match) => match[1]?.replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean)
    .map((value) => `Tipo ${value.toUpperCase()}`))];
}

function normalizeOcrText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "o")
    .replace(/[|()[\]{}]/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[;:]/g, (char) => char)
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeDecimal(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.includes(",") ? trimmed.replace(/\./g, "") : trimmed.replace(".", ",");
}

function parseDecimal(value?: string) {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDisplayName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
