import type { FieldType } from "@/domain/validation";

const monthMap: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  março: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

export function normalizeValue(value: string, fieldType: FieldType) {
  if (!value) {
    return "";
  }

  switch (fieldType) {
    case "cpf":
    case "cnpj":
    case "rg":
    case "telefone":
      return onlyDigits(value);
    case "valor_monetario":
      return normalizeMoney(value);
    case "area":
      return normalizeArea(value);
    case "identificador_imovel":
      return normalizePropertyIdentifier(value);
    case "data":
      return normalizeDate(value);
    case "email":
      return value.trim().toLowerCase();
    case "endereco":
      return normalizeAddress(value);
    case "texto":
    default:
      return normalizeText(value);
  }
}

function normalizePropertyIdentifier(value: string) {
  return normalizeText(value)
    .replace(/\b(TORRE|BLOCO|APARTAMENTO|APTO|UNIDADE)\b/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/^0+(?=\d)/, "");
}

function normalizeArea(value: string) {
  const match = value.replace(/\s/g, "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return normalizeText(value);
  const numeric = Number.parseFloat(match[0]);
  return Number.isFinite(numeric) ? numeric.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") : normalizeText(value);
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeMoney(value: string) {
  const cleaned = value
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numeric = Number.parseFloat(cleaned);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : normalizeText(value);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeAddress(value: string) {
  return normalizeText(value)
    .replace(/\bAVENIDA\b/g, "AV")
    .replace(/\bAV\b\.?/g, "AV")
    .replace(/\bRUA\b/g, "R")
    .replace(/\bR\b\.?/g, "R")
    .replace(/\bN[º°.]?\b/g, "NUMERO")
    .replace(/\bNO\b/g, "NUMERO")
    .replace(/\bAPARTAMENTO\b/g, "AP")
    .replace(/\bAPTO\b/g, "AP");
}

function normalizeDate(value: string) {
  const numeric = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (numeric) {
    const [, day, month, year] = numeric;
    return `${normalizeYear(year)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const textual = normalizeText(value).toLowerCase().match(/(\d{1,2}) de ([a-zç]+) de (\d{4})/i);
  if (textual) {
    const [, day, month, year] = textual;
    const normalizedMonth = monthMap[month] ?? "01";
    return `${year}-${normalizedMonth}-${day.padStart(2, "0")}`;
  }

  return normalizeText(value);
}

function normalizeYear(year: string) {
  return year.length === 2 ? `20${year}` : year;
}
