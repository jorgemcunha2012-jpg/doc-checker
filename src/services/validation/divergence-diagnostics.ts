import type { FieldType } from "@/domain/validation";

export type DivergenceDiagnostic = {
  observation: string;
  sourceDiffTokens?: string[];
  targetDiffTokens?: string[];
};

export function buildDivergenceDiagnostic(
  fieldType: FieldType,
  sourceValue: string,
  targetValue: string,
  sourceNormalized: string,
  targetNormalized: string,
): DivergenceDiagnostic {
  switch (fieldType) {
    case "cpf":
      return buildDocumentDiagnostic("CPF", sourceValue, targetValue, sourceNormalized, targetNormalized);
    case "cnpj":
      return buildDocumentDiagnostic("CNPJ", sourceValue, targetValue, sourceNormalized, targetNormalized);
    case "rg":
      return buildDocumentDiagnostic("RG", sourceValue, targetValue, sourceNormalized, targetNormalized);
    case "valor_monetario":
      return buildMoneyDiagnostic(sourceValue, targetValue, sourceNormalized, targetNormalized);
    case "data":
      return buildDateDiagnostic(sourceValue, targetValue, sourceNormalized, targetNormalized);
    case "email":
      return buildEmailDiagnostic(sourceValue, targetValue, sourceNormalized, targetNormalized);
    case "telefone":
      return buildPhoneDiagnostic(sourceValue, targetValue, sourceNormalized, targetNormalized);
    case "endereco":
    case "texto":
    default:
      return buildTextDiagnostic(sourceValue, targetValue, sourceNormalized, targetNormalized, fieldType);
  }
}

function buildDocumentDiagnostic(label: string, sourceValue: string, targetValue: string, sourceNormalized: string, targetNormalized: string): DivergenceDiagnostic {
  const firstDifference = firstDifferentIndex(sourceNormalized, targetNormalized);

  if (firstDifference === -1) {
    return { observation: `${label} diverge no formato informado: imagem ${sourceValue}, documento ${targetValue}.` };
  }

  return {
    observation: `${label} diverge na posição ${firstDifference + 1}: imagem mostra ${compactTail(sourceValue)}, documento mostra ${compactTail(targetValue)}.`,
  };
}

function buildMoneyDiagnostic(sourceValue: string, targetValue: string, sourceNormalized: string, targetNormalized: string): DivergenceDiagnostic {
  const sourceNumber = Number(sourceNormalized);
  const targetNumber = Number(targetNormalized);

  if (!Number.isFinite(sourceNumber) || !Number.isFinite(targetNumber)) {
    return { observation: `Valor monetário diverge: imagem ${sourceValue}, documento ${targetValue}.` };
  }

  const difference = Math.abs(targetNumber - sourceNumber);
  const percentage = sourceNumber === 0 ? 0 : (difference / Math.abs(sourceNumber)) * 100;
  const direction = targetNumber > sourceNumber ? "maior no documento" : "menor no documento";

  return {
    observation: `Valor diverge em ${formatCurrency(difference)} (${formatPercent(percentage)} ${direction}): imagem ${sourceValue}, documento ${targetValue}.`,
  };
}

function buildDateDiagnostic(sourceValue: string, targetValue: string, sourceNormalized: string, targetNormalized: string): DivergenceDiagnostic {
  const sourceDate = parseIsoDate(sourceNormalized);
  const targetDate = parseIsoDate(targetNormalized);

  if (!sourceDate || !targetDate) {
    return { observation: `Data diverge: imagem ${sourceValue}, documento ${targetValue}.` };
  }

  const days = Math.abs(Math.round((targetDate.getTime() - sourceDate.getTime()) / 86_400_000));

  return {
    observation: `Data diverge em ${describeDateDistance(days)}: imagem ${sourceValue}, documento ${targetValue}.`,
  };
}

function buildEmailDiagnostic(sourceValue: string, targetValue: string, sourceNormalized: string, targetNormalized: string): DivergenceDiagnostic {
  const [sourceLocal, sourceDomain] = sourceNormalized.split("@");
  const [targetLocal, targetDomain] = targetNormalized.split("@");

  if (sourceDomain !== targetDomain) {
    return { observation: `Email diverge no domínio: imagem ${sourceDomain || "sem domínio"}, documento ${targetDomain || "sem domínio"}.` };
  }

  if (sourceLocal !== targetLocal) {
    return { observation: `Email diverge no usuário antes do @: imagem ${sourceLocal}, documento ${targetLocal}.` };
  }

  return { observation: `Email diverge no formato: imagem ${sourceValue}, documento ${targetValue}.` };
}

function buildPhoneDiagnostic(sourceValue: string, targetValue: string, sourceNormalized: string, targetNormalized: string): DivergenceDiagnostic {
  const sourceDdd = sourceNormalized.length >= 10 ? sourceNormalized.slice(0, 2) : "";
  const targetDdd = targetNormalized.length >= 10 ? targetNormalized.slice(0, 2) : "";

  if (sourceDdd && targetDdd && sourceDdd !== targetDdd) {
    return { observation: `Telefone diverge no DDD: imagem (${sourceDdd}), documento (${targetDdd}).` };
  }

  const firstDifference = firstDifferentIndex(sourceNormalized, targetNormalized);
  return {
    observation:
      firstDifference >= 0
        ? `Telefone diverge no dígito ${firstDifference + 1}: imagem ${sourceValue}, documento ${targetValue}.`
        : `Telefone diverge no formato: imagem ${sourceValue}, documento ${targetValue}.`,
  };
}

function buildTextDiagnostic(
  sourceValue: string,
  targetValue: string,
  sourceNormalized: string,
  targetNormalized: string,
  fieldType: FieldType,
): DivergenceDiagnostic {
  const sourceTokens = tokenize(sourceNormalized);
  const targetTokens = tokenize(targetNormalized);
  const sourceSet = new Set(sourceTokens);
  const targetSet = new Set(targetTokens);
  const sourceDiffTokens = sourceTokens.filter((token) => !targetSet.has(token));
  const targetDiffTokens = targetTokens.filter((token) => !sourceSet.has(token));
  const component = fieldType === "endereco" ? "componente do endereço" : "palavra";

  if (!sourceDiffTokens.length && !targetDiffTokens.length) {
    return {
      observation: `Texto diverge por ordem ou formatação dos termos: imagem "${sourceValue}", documento "${targetValue}".`,
    };
  }

  return {
    observation: `Diverge no ${component}: imagem indica "${sourceDiffTokens.join(" ") || sourceValue}", documento indica "${targetDiffTokens.join(" ") || targetValue}".`,
    sourceDiffTokens,
    targetDiffTokens,
  };
}

function tokenize(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

function firstDifferentIndex(left: string, right: string) {
  const max = Math.max(left.length, right.length);

  for (let index = 0; index < max; index += 1) {
    if (left[index] !== right[index]) {
      return index;
    }
  }

  return -1;
}

function compactTail(value: string) {
  const compact = value.trim();
  return compact.length > 9 ? `...${compact.slice(-9)}` : compact;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function describeDateDistance(days: number) {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return `${years} ${years === 1 ? "ano" : "anos"}`;
  }

  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }

  return `${days} ${days === 1 ? "dia" : "dias"}`;
}
