import type { ChecklistField, DocumentSource, ExtractedField, ProviderExtractionOutput } from "@/domain/validation";

type MatchDefinition = {
  fieldId: string;
  section: string;
  confidence: number;
  patterns: RegExp[];
};

const sourceDefinitions: Partial<Record<DocumentSource, MatchDefinition[]>> = {
  MINUTA: [
    money("financial.financing", "Composição dos recursos", 100, [/B\.4\.1[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.downPayment", "Composição dos recursos", 100, [/B\.4\.2[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.fgts", "Composição dos recursos", 100, [/B\.4\.3[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.subsidy", "Composição dos recursos", 100, [/B\.4\.5[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.totalValue", "Valor do contrato", 98, [
      /valor destinado[^.\n\r]*?\s+é\s*(R\$\s*\d[\d.,]*)/i,
      /valor (?:total|do imóvel|da venda)[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
    ]),
    text("property.unit", "Descrição do imóvel", 92, [
      /\b(?:unidade|apartamento|apto)\s*(?:n[ºo.]*)?\s*([A-Z0-9-]{1,12})\b/i,
    ]),
    text("property.tower", "Descrição do imóvel", 92, [
      /\b(?:torre|bloco)\s*(?:n[ºo.]*)?\s*([A-Z0-9-]{1,12})\b/i,
    ]),
    text("property.registration", "Descrição do imóvel", 90, [
      /\bmatr[ií]cula\s*(?:n[ºo.]*)?\s*([A-Z0-9./-]{2,30})\b/i,
    ]),
  ],
  DADOS_RESERVA: [
    text("buyer.name", "Dados da reserva", 92, [
      /(?:nome\s+do\s+cliente|cliente)\s*:?\s*([^\n\r]+)/i,
    ]),
    text("buyer.cpf", "Dados da reserva", 94, [
      /(?:cpf\s*\/\s*cnpj|cpf)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
    ]),
    text("buyer.rg", "Dados da reserva", 90, [/\brg\s*:?\s*([A-Z0-9.-]{5,30})/i]),
    text("buyer.maritalStatus", "Dados da reserva", 90, [/estado\s+civil\s*:?\s*([^\n\r]+)/i]),
    text("buyer.email", "Dados da reserva", 96, [/e-?mail\s*:?\s*([^\s\n\r]+@[^\s\n\r]+)/i]),
    text("buyer.phone", "Dados da reserva", 94, [/(?:telefone|celular)\s*:?\s*([+()\d\s.-]{8,24})/i]),
    text("property.development", "Dados da reserva", 92, [/unidade\s*:?\s*([^/\n\r]+?)(?:\s*\/\s*torre|\s*\/\s*\d|\n|\r)/i]),
    text("property.tower", "Dados da reserva", 94, [/\/\s*torre\s*([A-Z0-9-]{1,12})/i]),
    text("property.unit", "Dados da reserva", 94, [/\/\s*torre\s*[A-Z0-9-]{1,12}\s*\/\s*([A-Z0-9-]{1,12})/i]),
    text("property.registration", "Dados da reserva", 88, [/matr[ií]cula\s*:?\s*([A-Z0-9./-]+)/i]),
    money("financial.totalValue", "Print de pagamento", 94, [
      /valor\s+do\s+contrato[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /valor\s+total[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.financing", "Print de pagamento", 94, [
      /financiamento[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /financiamento\s+\d+\s+(R\$\s*\d[\d.,]*)/i,
      /valor\s+financiado[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.fgts", "Print de pagamento", 92, [
      /\bFGTS\b[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /\bFGTS\b\s+\d+\s+(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.subsidy", "Print de pagamento", 92, [
      /subs[ií]dio[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /subs[ií]dio\s+\d+\s+(R\$\s*\d[\d.,]*)/i,
      /desconto[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
    ]),
  ],
  SIOPI: [
    text("buyer.cpf", "Espelho SIOPI", 94, [/\bCPF\b[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i]),
    text("buyer.name", "Espelho SIOPI", 90, [/(?:cliente|proponente|comprador)[^\n\r:]*:\s*([^\n\r]+)/i]),
    money("financial.financing", "Espelho SIOPI", 94, [/valor (?:do )?financiamento[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.totalValue", "Espelho SIOPI", 94, [/valor (?:total|do imóvel|da venda)[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
  ],
  ITBI: [
    text("buyer.cpf", "ITBI", 94, [/\bCPF\b[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i]),
    text("seller.cnpj", "ITBI", 94, [/\bCNPJ\b[^\d]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i]),
    money("financial.financing", "ITBI", 92, [/valor financiado[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.totalValue", "ITBI", 92, [/valor (?:total|declarado|do imóvel)[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
  ],
  MATRICULA: [
    text("property.registration", "Matrícula", 94, [/\bmatr[ií]cula\s*(?:n[ºo.]*)?\s*([A-Z0-9./-]{2,30})\b/i]),
    text("property.privateArea", "Matrícula", 90, [/área privativa[^\d]*(\d+[\d.,]*\s*m[²2]?)/i]),
    text("property.totalArea", "Matrícula", 88, [/área total[^\d]*(\d+[\d.,]*\s*m[²2]?)/i]),
    text("property.idealFraction", "Matrícula", 88, [/fração ideal[^\d]*(\d+[\d.,]*)/i]),
  ],
};

export function extractDeterministicFields(
  text: string,
  checklist: ChecklistField[],
  source: DocumentSource,
): ProviderExtractionOutput {
  const allowed = new Set(checklist.map((field) => field.id));
  const definitions = sourceDefinitions[source] ?? [];
  const fields = checklist.map((field): ExtractedField => {
    if (!allowed.has(field.id)) return empty(field.id);
    const definition = definitions.find((item) => item.fieldId === field.id);
    if (source === "DADOS_RESERVA" && field.id === "buyer.address") {
      const address = reservationAddress(text);
      if (address) {
        return {
          fieldId: field.id,
          value: address.value,
          confidence: 88,
          sourceLocation: {
            section: "Dados da reserva",
            rawText: address.rawText,
          },
        };
      }
    }
    const match = definition ? firstMatch(text, definition.patterns) : null;
    if (!definition || !match) return empty(field.id);
    return {
      fieldId: field.id,
      value: cleanValue(match.value),
      confidence: definition.confidence,
      sourceLocation: {
        section: definition.section,
        rawText: match.rawText.slice(0, 500),
      },
    };
  });

  return { fields };
}

function reservationAddress(text: string) {
  const street = labelValue(text, ["ENDEREÇO", "ENDERECO"]);
  const number = labelValue(text, ["NÚMERO", "NUMERO"]);
  const complement = labelValue(text, ["COMPLEMENTO"]);
  const district = labelValue(text, ["BAIRRO"]);
  const city = labelValue(text, ["CIDADE"]);
  const state = labelValue(text, ["ESTADO"]);
  const parts = [
    street,
    number && number !== "-" ? number : "",
    complement && complement !== "-" ? complement : "",
    district && district !== "-" ? district : "",
    city && city !== "-" ? city : "",
    state && state !== "-" ? state : "",
  ].filter(Boolean);
  if (!street || parts.length < 2) return null;
  return {
    value: parts.join(", "),
    rawText: [
      `ENDEREÇO ${street}`,
      number ? `NÚMERO ${number}` : "",
      complement ? `COMPLEMENTO ${complement}` : "",
      district ? `BAIRRO ${district}` : "",
      city ? `CIDADE ${city}` : "",
      state ? `ESTADO ${state}` : "",
    ].filter(Boolean).join(" | ").slice(0, 500),
  };
}

function labelValue(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeLabel(lines[index]);
    const label = labels.find((item) => normalized === normalizeLabel(item) || normalized.startsWith(`${normalizeLabel(item)} `));
    if (!label) continue;
    const sameLine = lines[index].replace(new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*`, "i"), "").trim();
    if (sameLine && normalizeLabel(sameLine) !== normalizeLabel(label)) return cleanValue(sameLine);
    const next = lines[index + 1]?.trim();
    if (next) return cleanValue(next);
  }
  return "";
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9/ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = match?.[1]?.trim();
    if (value) return { value, rawText: match[0] };
  }
  return null;
}

function cleanValue(value: string) {
  return value.replace(/\s+/g, " ").replace(/[.;,]\s*$/, "").trim();
}

function money(fieldId: string, section: string, confidence: number, patterns: RegExp[]): MatchDefinition {
  return { fieldId, section, confidence, patterns };
}

function text(fieldId: string, section: string, confidence: number, patterns: RegExp[]): MatchDefinition {
  return { fieldId, section, confidence, patterns };
}

function empty(fieldId: string): ExtractedField {
  return { fieldId, value: null, confidence: 0 };
}
