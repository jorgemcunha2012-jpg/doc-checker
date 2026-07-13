import type { DevelopmentExtraction } from "@/domain/development";

export function extractDevelopmentFromOcrText(text: string): DevelopmentExtraction {
  const normalized = normalizeOcrText(text);
  const name = extractName(normalized);
  const city = extractCity(normalized);
  const registration = normalized.match(/matricula:\s*([0-9. -]+)/)?.[1]?.replace(/\D/g, "") || undefined;
  const units = extractUnits(normalized);

  return {
    name: name || "Empreendimento sem nome",
    city,
    registration,
    units,
  };
}

function extractUnits(text: string): DevelopmentExtraction["units"] {
  const units = new Map<string, DevelopmentExtraction["units"][number]>();
  const areaPattern = /com uma area privativa principal de\s+([0-9]{1,3}[,.][0-9]{2})\s*m?/g;
  let previousEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = areaPattern.exec(text)) !== null) {
    const context = text.slice(previousEnd, match.index);
    const after = text.slice(match.index, match.index + 360);
    const privateArea = normalizeDecimal(match[1]) ?? "";
    const totalArea = normalizeDecimal(after.match(/area total real de\s+([0-9]{1,3}[,.][0-9]{3,6})\s*m?/)?.[1]);
    const idealFraction = normalizeDecimal(after.match(/fracao ideal de\s+([0-9][,.][0-9]{6,12})/)?.[1]);
    const typology = extractTypology(context);
    const pairs = extractTowerUnitPairs(context);

    for (const pair of pairs) {
      for (const tower of pair.towers) {
        for (const unit of pair.units) {
          const key = `${tower}::${unit}`;
          units.set(key, {
            tower,
            unit,
            privateArea,
            totalArea,
            idealFraction,
            typology,
            confidence: idealFraction ? 88 : 82,
          });
        }
      }
    }
    previousEnd = match.index + match[0].length;
  }

  return [...units.values()].sort((left, right) =>
    left.tower.localeCompare(right.tower, "pt-BR", { numeric: true }) ||
    left.unit.localeCompare(right.unit, "pt-BR", { numeric: true }),
  );
}

function extractTowerUnitPairs(context: string) {
  const pairs: Array<{ towers: string[]; units: string[] }> = [];
  const pattern = /torres?\s+(.{1,140}?)\s*,?\s*apartamentos?\s+de\s+n(?:o|os)?\s+(.{1,90}?)(?=;|,?\s*com uma area|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(context)) !== null) {
    const towers = parseNumberList(match[1], 2);
    const units = parseNumberList(match[2], 3);
    if (towers.length && units.length) pairs.push({ towers, units });
  }

  return pairs;
}

function parseNumberList(value: string, width: number) {
  const cleaned = value
    .replace(/\b[oO](?=\d)/g, "0")
    .replace(/[º°]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const numbers = new Set<string>();
  const rangePattern = /(\d{1,3})\s*(?:a|à|-)\s*(\d{1,3})/g;
  let range: RegExpExecArray | null;

  while ((range = rangePattern.exec(cleaned)) !== null) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start <= 60) {
      for (let item = start; item <= end; item += 1) numbers.add(pad(item, width));
    }
  }

  for (const item of cleaned.match(/\b\d{1,3}\b/g) ?? []) {
    numbers.add(pad(Number(item), width));
  }

  return [...numbers].sort((left, right) => Number(left) - Number(right));
}

function extractName(text: string) {
  const match = text.match(/denominado\s+(condominio\s+[^,.\n]+)/);
  return match ? toDisplayName(match[1]) : undefined;
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
  return value?.replace(".", ",").trim();
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0");
}

function toDisplayName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
