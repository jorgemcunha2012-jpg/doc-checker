import type { ChecklistField, DocumentSource, ExtractedField, ProviderExtractionOutput } from "@/domain/validation";

type MatchDefinition = {
  fieldId: string;
  section: string;
  confidence: number;
  patterns: RegExp[];
};

const sourceDefinitions: Partial<Record<DocumentSource, MatchDefinition[]>> = {
  MINUTA: [
    text("contract.number", "Ressalvas / identificação do processo", 94, [
      /(?:n[úu]mero\s+do\s+(?:contrato|processo)|n[ºo.]?\s*do\s+(?:contrato|processo))\s*[:#-]?\s*([A-Z0-9./-]{3,40})/i,
      /\bprocesso\s*(?:n[úu]mero|n[ºo.]?)?\s*[:#-]\s*([A-Z0-9./-]{3,40})/i,
      /\bcontrato\s*(?:n[úu]mero|n[ºo.]?)?\s*[:#-]\s*([A-Z0-9./-]{3,40})/i,
    ]),
    text("contract.agencyCode", "Identificação do contrato", 90, [/(?:ag[eê]ncia|c[oó]digo\s+da\s+ag[eê]ncia)[^:\n\r]*:\s*([A-Z0-9./-]+)/i]),
    text("contract.financingModality", "Identificação do contrato", 90, [/modalidade\s+de\s+financiamento[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("contract.housingProgram", "Identificação do contrato", 90, [/programa\s+habitacional[^:\n\r]*:\s*([^\n\r]+)/i]),
    money("financial.financing", "Composição dos recursos", 100, [/B\.4\.1[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.downPayment", "Composição dos recursos", 100, [/B\.4\.2[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.fgts", "Composição dos recursos", 100, [/B\.4\.3[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.subsidy", "Composição dos recursos", 100, [/B\.4\.5[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.totalValue", "Valor do contrato", 98, [
      /valor destinado[^.\n\r]*?\s+é\s*(R\$\s*\d[\d.,]*)/i,
      /valor (?:total|do imóvel|da venda)[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.appraisalValue", "Valores da operação", 92, [/valor\s+da\s+avalia[cç][aã]o[^:\n\r]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.housingEntry", "Valores da operação", 90, [/entrada\s+moradia[^:\n\r]*:\s*(R\$\s*\d[\d.,]*)/i]),
    text("property.unit", "Descrição do imóvel", 92, [
      /\b(?:unidade|apartamento|apto)\s*(?:n[ºo.]*)?\s*([A-Z0-9-]{1,12})\b/i,
    ]),
    text("property.tower", "Descrição do imóvel", 92, [
      /\b(?:torre|bloco)\s*(?:n[ºo.]*)?\s*([A-Z0-9-]{1,12})\b/i,
    ]),
    text("property.registration", "Descrição do imóvel", 90, [
      /\bmatr[ií]cula\s*(?:n[ºo.]*)?\s*([A-Z0-9./-]{2,30})\b/i,
    ]),
    text("property.registryOffice", "Descrição do imóvel", 88, [/(?:cart[oó]rio|of[ií]cio)\s+(?:de\s+)?registro\s+de\s+im[oó]veis?[^:\n\r]*:?\s*([^\n\r]+)/i]),
    text("property.type", "Descrição do imóvel", 88, [/(?:tipo\s+do\s+im[oó]vel|tipo\s+da\s+unidade)[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("property.floor", "Descrição do imóvel", 88, [/(?:pavimento|andar)[^:\n\r:]*:\s*([A-Z0-9-]+)/i]),
    text("property.terrainArea", "Descrição do imóvel", 86, [/área\s+do\s+terreno[^\d]*(\d+[\d.,]*\s*m[²2]?)/i]),
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
    text("buyer.name", "ITBI", 94, [
      /Texto1\s*:\s*([A-ZÀ-Ú\s]+?)(?=\d{11}\b)/i,
      /NomeRazão Social_4\s*:\s*([^\n\r]+)/i,
      /Nome\/Razão Social_4\s*:\s*([^\n\r]+)/i,
    ]),
    text("buyer.cpf", "ITBI", 94, [
      /Texto1\s*:\s*[A-ZÀ-Ú\s]+?(\d{11})\b/i,
      /Texto12\s*:\s*(\d{11})\b/i,
      /\bCPF\b[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
    ]),
    text("buyer.email", "ITBI", 92, [/Email_4\s*:\s*([^\s\n\r]+@[^\s\n\r]+)/i]),
    text("buyer.address", "ITBI", 90, [/Endereço\s*:\s*([^\n\r]+)/i]),
    text("seller.legalName", "ITBI", 94, [
      /Texto2\s*:\s*([^\n\r]+)/i,
      /NomeRazão Social\s*:\s*([^\n\r]+)/i,
    ]),
    text("seller.cnpj", "ITBI", 94, [
      /Texto3\s*:\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
      /Texto11\s*:\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
      /\bCNPJ\b[^\d]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
    ]),
    text("seller.email", "ITBI", 90, [/(?:Email|E-mail)[^:\n\r]*:\s*([^\s\n\r]+@[^\s\n\r]+)/i]),
    text("seller.phone", "ITBI", 88, [/(?:Telefone|Celular)[^:\n\r]*:\s*([+()\d\s.-]{8,24})/i]),
    text("transaction.instrumentDate", "ITBI", 88, [/(?:data\s+do\s+instrumento|data\s+da\s+transa[cç][aã]o)[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("transaction.nature", "ITBI", 88, [/natureza\s+da\s+transa[cç][aã]o[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("transaction.transferredPercentage", "ITBI", 88, [/(?:%\s*transmitido|percentual\s+transmitido)[^:\n\r]*:\s*([\d.,]+\s*%?)/i]),
    text("property.iptu", "ITBI", 94, [/Texto6\s*:\s*([A-Z0-9./-]+)/i]),
    text("property.type", "ITBI", 88, [/(?:tipo\s+do\s+im[oó]vel|tipo)[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("property.address", "ITBI", 90, [/Endereço_2\s*:\s*([^\n\r]+)/i]),
    text("property.unit", "ITBI", 90, [/Complemento\s*:\s*[^\n\r]*?(?:APT|APTO|APARTAMENTO)\s*([A-Z0-9-]+)/i]),
    text("property.tower", "ITBI", 90, [/Complemento\s*:\s*[^\n\r]*?TORRE\s*([A-Z0-9-]+)/i]),
    text("property.privateArea", "ITBI", 92, [/Área privativa m²\s*:\s*([^\n\r]+)/i]),
    text("property.commonArea", "ITBI", 92, [/Área comum m²\s*:\s*([^\n\r]+)/i]),
    text("property.totalArea", "ITBI", 92, [/Área total m²\s*:\s*([^\n\r]+)/i]),
    text("property.landArea", "ITBI", 90, [/Área do terreno m²\s*:\s*([^\n\r]+)/i]),
    text("property.idealFraction", "ITBI", 92, [/Fração ideal\s*:\s*([^\n\r]+)/i]),
    money("financial.financing", "ITBI", 92, [
      /Valor financiado SFH\s*:\s*(\d[\d.,]*)/i,
      /VALOR FINANCIADO\s*R\$\s*(\d[\d.,]*)/i,
      /valor financiado[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.nonFinancedValue", "ITBI", 90, [/Valor não financiado\s*:\s*(\d[\d.,]*)/i]),
    money("financial.totalValue", "ITBI", 92, [
      /VALOR TOTAL DECLARADO\s*:\s*(\d[\d.,]*)/i,
      /valor (?:total|declarado|do imóvel)[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /COMPRA E VENDA R\$\s*(\d[\d.,]*)/i,
    ]),
  ],
  MATRICULA: [
    text("seller.cnpj", "Matrícula", 94, [
      /\bCNPJ\b[^\d]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
    ]),
    text("seller.legalName", "Matrícula", 88, [
      /(?:propriet[aá]ri[ao]|incorporadora|construtora|transmitente)[^:\n\r]{0,50}:\s*([^\n\r]+)/i,
      /(?:raz[aã]o\s+social|denomina[cç][aã]o)[^:\n\r:]*:\s*([^\n\r]+)/i,
    ]),
    text("property.registration", "Matrícula", 94, [/\bmatr[ií]cula\s*(?:n[ºo.]*)?\s*([A-Z0-9./-]{2,30})\b/i]),
    text("property.privateArea", "Matrícula", 90, [/área privativa[^\d]*(\d+[\d.,]*\s*m[²2]?)/i]),
    text("property.totalArea", "Matrícula", 88, [/área total[^\d]*(\d+[\d.,]*\s*m[²2]?)/i]),
    text("property.idealFraction", "Matrícula", 88, [/fração ideal[^\d]*(\d+[\d.,]*)/i]),
  ],
  FRACOES: [
    text("property.iptu", "Frações do empreendimento", 92, [
      /(?:inscri[cç][aã]o\s+(?:imobili[aá]ria|municipal)|IPTU)[^:\n\r]*:?\s*([A-Z0-9./-]{3,30})/i,
    ]),
    text("property.privateArea", "Frações do empreendimento", 90, [/área privativa[^\d]*(\d+[\d.,]*\s*m[²2]?)/i]),
    text("property.totalArea", "Frações do empreendimento", 88, [/área total[^\d]*(\d+[\d.,]*\s*m[²2]?)/i]),
    text("property.idealFraction", "Frações do empreendimento", 88, [/fração ideal[^\d]*(\d+[\d.,]*)/i]),
  ],
  IPTU: [
    text("property.iptu", "Documento IPTU", 96, [
      /(?:inscri[cç][aã]o\s+(?:imobili[aá]ria|municipal)|inscri[cç][aã]o\s+do\s+im[oó]vel|IPTU)[^:\n\r]*:?\s*([A-Z0-9./-]{3,30})/i,
    ]),
    text("property.address", "Documento IPTU", 88, [/endere[cç]o[^:\n\r]*:?\s*([^\n\r]+)/i]),
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
