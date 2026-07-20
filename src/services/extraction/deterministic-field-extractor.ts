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
      /\b(?:contrato|processo)\b[\s\r\n]*(?:n(?:[º°o.]|[úu]mero|umero)?[\s\r\n]*)?[:#-]?[\s\r\n]*([0-9][A-Z0-9./-]{3,40})/i,
      /\bcontrato\s*(?:n[úu]mero|n[ºo.]?)?\s*[:#-]\s*([A-Z0-9./-]{3,40})/i,
    ]),
    text("contract.date", "Identificação do contrato", 98, [
      /\b(?:FORTALEZA|FORTALEZA\/CE)\s*,?\s*CE\s+(\d{1,2}\s+de\s+[A-ZÀ-Úa-zà-ú]+\s+de\s+\d{4})/i,
      /(?:data\s+(?:do\s+contrato|da\s+contrata[cç][aã]o|de\s+assinatura)|contrato\s+celebrado\s+em)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+de\s+[A-ZÀ-Úa-zà-ú]+\s+de\s+\d{4})/i,
    ]),
    text("contract.agencyCode", "Identificação do contrato", 90, [/(?:ag[eê]ncia|c[oó]digo\s+da\s+ag[eê]ncia)[^:\n\r]*:\s*([A-Z0-9./-]+)/i]),
    text("contract.financingModality", "Identificação do contrato", 90, [/modalidade\s+de\s+financiamento[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("contract.housingProgram", "Identificação do contrato", 90, [/programa\s+habitacional[^:\n\r]*:\s*([^\n\r]+)/i]),
    money("financial.financing", "Composição dos recursos", 100, [
      /B\.4\.1[^\n\r:]*:\s*\|?\s*(R\$\s*\d[\d.,]*)/i,
      /B\s*1\s*\.\s*3[^\n\r]*?financiamento[^\n\r]*?(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.downPayment", "Composição dos recursos", 100, [
      /B\.4\.2[^\n\r:]*:\s*\|?\s*(R\$\s*\d[\d.,]*)/i,
      /B\s*1\s*\.\s*1[^\n\r]*?recursos\s+pr[oó]prios[^\n\r]*?(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.fgts", "Composição dos recursos", 100, [
      /B\.4\.3[^\n\r:]*:\s*\|?\s*(R\$\s*\d[\d.,]*)/i,
      /B\s*1\s*\.\s*2[^\n\r]*?FGTS[^\n\r]*?(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.subsidy", "Composição dos recursos", 100, [/B\.4\.5[^\n\r:]*:\s*\|?\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.totalValue", "Valor do contrato", 98, [
      /valor destinado[^.\n\r]*?\s+é\s*(R\$\s*\d[\d.,]*)/i,
      /valor (?:total|do imóvel|da venda)[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /valor\s+de\s+aquisi[cç][aã]o[^.\n\r]*?objeto\s+deste\s+contrato\s+equivale\s+a\s*(R\$\s*\d[\d.,]*)/i,
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
    text("property.terrainArea", "Descrição do imóvel", 96, [
      /área\s+(?:total\s+)?do\s+terreno[^\d]*(\d+[\d.,]*\s*m[²2]?)/i,
      /\bterreno\b[^.\n\r]{0,100}?\b(?:possui|tem)\b\s*(\d+[\d.,]*\s*m[²2]?)/i,
      /\bterreno\b[^.\n\r]{0,120}?área\s+total\s+(?:de\s*)?(\d+[\d.,]*\s*m[²2]?)/i,
    ]),
    text("property.landArea", "Descrição do imóvel", 96, [
      /área\s+(?:total\s+)?do\s+terreno[^\d]*(\d+[\d.,]*\s*m[²2]?)/i,
      /\bterreno\b[^.\n\r]{0,100}?\b(?:possui|tem)\b\s*(\d+[\d.,]*\s*m[²2]?)/i,
      /\bterreno\b[^.\n\r]{0,120}?área\s+total\s+(?:de\s*)?(\d+[\d.,]*\s*m[²2]?)/i,
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
      /valor\s+do\s+contrato\s*\n\s*(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.downPayment", "Print de pagamento", 94, [
      /(?:entrada|recursos\s+pr[oó]prios)[^\n\r:]*:?\s*(R\$\s*\d[\d.,]*)/i,
      /(?:entrada|recursos\s+pr[oó]prios)\s+\d+\s+(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.financing", "Print de pagamento", 94, [
      /financiamento[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /financiamento\s+\d+\s+(R\$\s*\d[\d.,]*)/i,
      /valor\s+financiado[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /\bfinanciamento\b[^\n\r]{0,80}?(R\$\s*\d[\d.,]*)/i,
      /\bfinanciamento\b\s+\d+\s+(\d[\d.,]*)/i,
    ]),
    money("financial.fgts", "Print de pagamento", 92, [
      /\bFGTS\b[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /\bFGTS\b\s+\d+\s+(R\$\s*\d[\d.,]*)/i,
      /\bFGTS\b\s+\d+\s+(\d[\d.,]*)/i,
    ]),
    money("financial.subsidy", "Print de pagamento", 92, [
      /subs[ií]dio[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /subs[ií]dio\s+\d+\s+(R\$\s*\d[\d.,]*)/i,
      /desconto[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /(?:subs[ií]dio|desconto)\s+\d+\s+(\d[\d.,]*)/i,
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
      /\bNome\s*:\s*([^\n\r]+)/i,
      /Texto1\s*:\s*([A-ZÀ-Ú\s]+?)(?=\d{11}\b)/i,
      /NomeRazão Social_4\s*:\s*([^\n\r]+)/i,
      /Nome\/Razão Social_4\s*:\s*([^\n\r]+)/i,
    ]),
    text("buyer.cpf", "ITBI", 94, [
      /CPF\s*\/??\s*CNPJ\s*:\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
      /CPFCNPJ\s*:\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
      /Texto1\s*:\s*[A-ZÀ-Ú\s]+?(\d{11})\b/i,
      /Texto12\s*:\s*(\d{11})\b/i,
      /\bCPF\b[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
    ]),
    text("buyer.email", "ITBI", 92, [
      /Email_4\s*:\s*([^\s\n\r]+@[^\s\n\r]+)/i,
      /\bEmail\s*:\s*([^\s\n\r]+@[^\s\n\r]+)/i,
    ]),
    text("buyer.address", "ITBI", 90, [/Endereço\s*:\s*([^\n\r]+)/i]),
    text("seller.legalName", "ITBI", 94, [
      /Text1\s*:\s*([^\n\r]+)/i,
      /Texto2\s*:\s*([^\n\r]+)/i,
      /NomeRazão Social\s*:\s*([^\n\r]+)/i,
    ]),
    text("seller.cnpj", "ITBI", 94, [
      /Text2\s*:\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
      /Texto3\s*:\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
      /Texto11\s*:\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
      /\bCNPJ\b[^\d]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
    ]),
    text("seller.address", "ITBI", 90, [/Endereço_2\s*:\s*([^\n\r]+)/i]),
    text("seller.email", "ITBI", 90, [/(?:Email|E-mail)[^:\n\r]*:\s*([^\s\n\r]+@[^\s\n\r]+)/i]),
    text("seller.phone", "ITBI", 88, [/(?:Telefone|Celular)[^:\n\r]*:\s*([+()\d\s.-]{8,24})/i]),
    text("transaction.instrumentDate", "ITBI", 88, [/(?:data\s+do\s+instrumento|data\s+da\s+transa[cç][aã]o)[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("transaction.nature", "ITBI", 88, [
      /natureza\s+da\s+transa[cç][aã]o[^:\n\r]*:\s*([^\n\r]+)/i,
      /Compra\s+Venda\s+etc\s*:\s*([^\n\r]+)/i,
    ]),
    text("transaction.transferredPercentage", "ITBI", 88, [/(?:%\s*transmitido|percentual\s+transmitido)[^:\n\r]*:\s*([\d.,]+\s*%?)/i]),
    text("property.iptu", "ITBI", 94, [
      /Inscri[cç][aã]o\s+do\s+IPTU\s*:\s*([A-Z0-9./-]+)/i,
      /Texto6\s*:\s*([A-Z0-9./-]+)/i,
    ]),
    text("property.registration", "ITBI", 94, [
      /Matr[ií]cula\s*:\s*([A-Z0-9./-]+)/i,
      /Text4\s*:\s*([A-Z0-9./-]+)/i,
    ]),
    text("property.type", "ITBI", 88, [
      /Text6\s*:\s*([^\n\r]+)/i,
      /(?:tipo\s+do\s+im[oó]vel|tipo)[^:\n\r]*:\s*([^\n\r]+)/i,
    ]),
    text("property.address", "ITBI", 90, [
      /Text3\s*:\s*([^\n\r]+)/i,
      /Endereço_2\s*:\s*([^\n\r]+)/i,
    ]),
    text("property.unit", "ITBI", 90, [/Complemento\s*:\s*[^\n\r]*?(?:APT|APTO|APARTAMENTO|AP)\s*([A-Z0-9-]+)/i]),
    text("property.tower", "ITBI", 90, [
      /Complemento\s*:\s*[^\n\r]*?TORRE\s*([A-Z0-9-]+)/i,
      /Complemento\s*:\s*[^\n\r]*?\bT\s*([A-Z0-9-]+)\s*,/i,
    ]),
    text("property.privateArea", "ITBI", 92, [/Área privativa m²\s*:\s*([^\n\r]+)/i]),
    text("property.commonArea", "ITBI", 92, [/Área comum m²\s*:\s*([^\n\r]+)/i]),
    text("property.totalArea", "ITBI", 92, [/Área total m²\s*:\s*([^\n\r]+)/i]),
    text("property.landArea", "ITBI", 96, [
      /área\s+do\s+terreno(?:\s*\(?\s*m[²2]\s*\)?)?\s*:\s*(\d+[\d.,]*\s*m?[²2]?)/i,
      /área\s+terreno[^:\n\r]*[:\-]\s*([^\n\r]+)/i,
    ]),
    text("property.idealFraction", "ITBI", 92, [/Fração ideal\s*:\s*([^\n\r]+)/i]),
    money("financial.financing", "ITBI", 92, [
      /Valor financiado SFH\s*:\s*(\d[\d.,]*)/i,
      /VALOR FINANCIADO\s*R\$\s*(\d[\d.,]*)/i,
      /Valor financiado\s*:\s*(?:R\$\s*)?(\d[\d.,]*)/i,
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
  const resolvedSource = looksLikeDti(text) ? "ITBI" : source;
  const definitions = sourceDefinitions[resolvedSource] ?? [];
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

  const output = source === "DADOS_RESERVA"
    ? { fields: recoverReservationGridFields(recoverReservationOcrLabelTypos(fields, text), text) }
    : { fields };
  return resolvedSource === "ITBI" ? mergeDtiStructuredFields(output, text, checklist) : output;
}

function recoverReservationGridFields(fields: ExtractedField[], text: string) {
  const recovered = new Map<string, { value: string; rawText: string }>();
  const identity = text.match(/NOME\s+DO\s+CLIENTE[^\n\r]*[\n\r]+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s+(\d{8,14})\s+(\+?\d{10,15})/i);
  if (identity) {
    recovered.set("buyer.name", { value: identity[1].trim(), rawText: `NOME DO CLIENTE: ${identity[1].trim()}` });
    recovered.set("buyer.cpf", { value: identity[2], rawText: `CPF / CNPJ: ${identity[2]}` });
    recovered.set("buyer.rg", { value: identity[3], rawText: `RG: ${identity[3]}` });
    recovered.set("buyer.phone", { value: identity[4], rawText: `CELULAR: ${identity[4]}` });
  }
  const phone = text.match(/TELEFONE[^\n\r]*[\n\r]+\s*(\+?\d{10,15})/i)?.[1];
  if (phone) recovered.set("buyer.phone", { value: phone, rawText: `TELEFONE: ${phone}` });
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i)?.[0];
  if (email && !/[o0]{2}/i.test(email)) recovered.set("buyer.email", { value: email, rawText: `E-MAIL: ${email}` });

  return fields.map((field) => {
    const value = recovered.get(field.fieldId);
    const looksLikeGridHeader = /\b(?:CPF|CNPJ|RG|CELULAR|TELEFONE|E-?MAIL)\b/i.test(String(field.value ?? ""));
    if (!value || (field.value && !looksLikeGridHeader)) return field;
    return { ...field, value: value.value, confidence: 90, sourceLocation: { section: "Dados da reserva", rawText: value.rawText } };
  });
}

function recoverReservationOcrLabelTypos(fields: ExtractedField[], text: string) {
  const financing = fields.find((field) => field.fieldId === "financial.financing");
  if (!financing || financing.value) return fields;
  const match = text.match(/\bf(?:nandamento|nanciamento)\b\s+\d+\s+(\d[\d.,]*)/i);
  if (!match?.[1]) return fields;

  return fields.map((field) => field.fieldId === "financial.financing"
    ? {
        ...field,
        value: cleanValue(match[1]),
        // A label recovered from a damaged OCR line is a hint for visual recovery,
        // never enough evidence to approve a financial comparison by itself.
        confidence: 70,
        sourceLocation: { section: "Print de pagamento (OCR a confirmar)", rawText: match[0].slice(0, 500) },
      }
    : field);
}

function looksLikeDti(text: string) {
  const hasDtiHeader = /declara[cç][aã]o\s+de\s+transa[cç][aã]o\s+imobili[aá]ria|\bDTI\b/i.test(text);
  const hasDtiFields = /[áa]rea\s+do\s+terreno|valor\s+total\s+declarado|\[CAMPOS\s+DE\s+FORMULARIO\]/i.test(text);
  return hasDtiHeader && hasDtiFields;
}

function mergeDtiStructuredFields(output: ProviderExtractionOutput, text: string, checklist: ChecklistField[]) {
  const allowed = new Set(checklist.map((field) => field.id));
  const compact = text.replace(/\s+/g, " ").trim();
  const buyerBlock = between(compact, /DADOS\s+DO\s+ADQUIRENTE/i, /DADOS\s+DO\s+TRANSMITENTE/i);
  const sellerBlock = between(compact, /DADOS\s+DO\s+TRANSMITENTE/i, /NATUREZA\s+DA\s+TRANSA[CÇ][AÃ]O/i);
  const propertyBlock = between(compact, /DADOS\s+DO\s+IM[ÓO]VEL\s+OBJETO\s+DA\s+TRANSA[CÇ][AÃ]O/i, /DECLARA[CÇ][AÃ]O\s+DE\s+VALORES/i);
  const financialBlock = between(compact, /DECLARA[CÇ][AÃ]O\s+DE\s+VALORES/i, /RESPONS[ÁA]VEL\s+PELAS\s+INFORMA[CÇ][ÕO]ES/i) || compact;
  const values: Record<string, string | undefined> = {
    "buyer.name": betweenLabel(buyerBlock, /Nome(?:\s*\/\s*Raz[ãa]o\s+Social)?/i, /CPF\s*\/\s*CNPJ|CPF\s*\/\s*CPJ|CPFCNPJ|Endere[cç]o|Email/i),
    "buyer.cpf": firstDigits(betweenLabel(buyerBlock, /CPF\s*\/\s*CNPJ|CPF\s*\/\s*CPJ|CPFCNPJ/i, /Endere[cç]o|Email|Telefone/i), 11),
    "buyer.address": betweenLabel(buyerBlock, /Endere[cç]o/i, /Email|Telefone/i),
    "buyer.email": emailValue(buyerBlock),
    "buyer.phone": phoneValue(buyerBlock),
    "seller.legalName": betweenLabel(sellerBlock, /Nome(?:\s*\/\s*Raz[ãa]o\s+Social)?/i, /CPF\s*\/\s*CNPJ|CPF\s*\/\s*CPJ|CPFCNPJ|Endere[cç]o|Email/i),
    "seller.cnpj": firstDigits(betweenLabel(sellerBlock, /CPF\s*\/\s*CNPJ|CPF\s*\/\s*CPJ|CPFCNPJ/i, /Endere[cç]o|Email|Telefone/i), 14),
    "seller.address": betweenLabel(sellerBlock, /Endere[cç]o/i, /Email|Telefone/i),
    "seller.email": emailValue(sellerBlock),
    "seller.phone": phoneValue(sellerBlock),
    "transaction.nature": betweenLabel(compact, /NATUREZA\s+DA\s+TRANSA[CÇ][AÃ]O/i, /DATA\s+DO|INTERMEDIA[CÇ][AÃ]O|DADOS\s+DO\s+IM[ÓO]VEL/i),
    "property.iptu": betweenLabel(propertyBlock, /(?:Inscri[cç][ãa]o\s+do\s+IPTU|Inscr\.?\s+IPTU)/i, /Endere[cç]o|N[úu]mero|Complemento/i),
    "property.address": betweenLabel(propertyBlock, /Endere[cç]o/i, /Loteamento|N[úu]mero|Complemento|Quadra/i),
    "property.type": betweenLabel(propertyBlock, /Tipo(?:\s+de)?\s+Im[óo]vel/i, /N[ºo°]?\.?\s*Matr[íi]cula|Matr[íi]cula|[ÁA]rea/i),
    "property.registration": betweenLabel(propertyBlock, /(?:N[ºo]\s*)?Matr[íi]cula/i, /[ÁA]rea/i),
    "property.privateArea": areaAfterLabel(propertyBlock, /[ÁA]rea\s+Privativa/i),
    "property.commonArea": areaAfterLabel(propertyBlock, /[ÁA]rea\s+Comum/i),
    "property.totalArea": areaAfterLabel(propertyBlock, /[ÁA]rea\s+Total/i),
    "property.landArea": areaAfterLabel(propertyBlock, /[ÁA]rea\s+(?:do\s+)?Terreno/i),
    "property.unit": firstMatchValue(propertyBlock, /Complemento[^\n\r]*?(?:A\s*P|APTO?|APARTAMENTO)\s*([A-Z0-9-]+)/i),
    "property.tower": firstMatchValue(propertyBlock, /Complemento[^\n\r]*?\b(?:TORRE|T)\s*0*(\d{1,2})\b/i),
    "financial.financing": moneyAfterLabel(financialBlock, /Valor\s+financiado(?:\s*\(SFH\))?/i),
    "financial.nonFinancedValue": moneyAfterLabel(financialBlock, /Valor\s+n[ãa]o\s+financiado/i),
    "financial.totalValue": moneyAfterLabel(financialBlock, /Valor\s+TOTAL\s+DECLARADO/i),
  };

  const structuredFields = new Set([
    "buyer.name", "buyer.cpf", "buyer.address", "buyer.email", "buyer.phone",
    "seller.legalName", "seller.cnpj", "seller.address", "seller.email", "seller.phone",
    "transaction.nature", "property.iptu", "property.address", "property.type",
    "property.registration", "property.privateArea", "property.commonArea", "property.totalArea",
    "property.landArea", "property.unit", "property.tower", "financial.financing",
    "financial.nonFinancedValue", "financial.totalValue",
  ]);
  for (const field of checklist) {
    if (!allowed.has(field.id) || !values[field.id]) continue;
    const value = values[field.id]!.trim();
    if (!value) continue;
    const existing = output.fields.find((item) => item.fieldId === field.id);
    if (!existing || !existing.value || existing.confidence < 94 || field.fieldType === "area") {
      if (existing) {
        existing.value = value;
        existing.confidence = 96;
        existing.sourceLocation = { section: "DTI", rawText: value.slice(0, 500) };
      }
    }
  }
  for (const field of output.fields) {
    if (!structuredFields.has(field.fieldId) || values[field.fieldId]) continue;
    if (
      (field.fieldId.startsWith("seller.") && sellerBlock) ||
      (propertyBlock && ["property.type", "property.unit", "property.tower"].includes(field.fieldId)) ||
      (compact && field.fieldId === "transaction.nature" && /NATUREZA\s+DA\s+TRANSA[CÇ][AÃ]O/i.test(compact))
    ) {
      field.value = null;
      field.confidence = 0;
      field.sourceLocation = undefined;
    }
  }
  return output;
}

function between(value: string, start: RegExp, end: RegExp) {
  const startMatch = value.match(start);
  if (!startMatch || startMatch.index == null) return "";
  const from = startMatch.index + startMatch[0].length;
  const rest = value.slice(from);
  const endMatch = rest.match(end);
  return rest.slice(0, endMatch?.index ?? rest.length).trim();
}

function betweenLabel(value: string, label: RegExp, next: RegExp) {
  if (!value) return undefined;
  const labelMatch = value.match(label);
  if (!labelMatch || labelMatch.index == null) return undefined;
  const rest = value.slice(labelMatch.index + labelMatch[0].length).replace(/^\s*[:*\-]?\s*/, "");
  const nextMatch = rest.match(next);
  return cleanStructuredValue(rest.slice(0, nextMatch?.index ?? rest.length));
}

function firstMatchValue(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim();
}

function firstDigits(value: string | undefined, length: number) {
  if (!value) return undefined;
  const match = value.match(length === 11 ? /\d{3}\D?\d{3}\D?\d{3}\D?\d{2}/ : /\d{2}\D?\d{3}\D?\d{3}\D?\d{4}\D?\d{2}/);
  return match?.[0];
}

function emailValue(value: string) {
  return value.match(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i)?.[0];
}

function phoneValue(value: string) {
  const labeled = value.match(/(?:Telefone|Fone|Celular)\s*:?\s*(\+?\d[\d() .-]{7,}\d)/i)?.[1]?.trim();
  if (!labeled) return undefined;
  const digits = labeled.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 ? labeled : undefined;
}

function areaAfterLabel(value: string, label: RegExp) {
  const labelMatch = value.match(label);
  if (!labelMatch || labelMatch.index == null) return undefined;
  const rest = value.slice(labelMatch.index + labelMatch[0].length);
  const match = rest.match(/^[^\d]{0,20}(\d[\d\s.,]*?)(?=\s*m\s*[²2]?\b|\s+(?:FRA[CÇ][AÃ]O|[ÁA]REA|DECLARA[CÇ][AÃ]O|$))/i);
  return cleanStructuredNumber(match?.[1]);
}

function moneyAfterLabel(value: string, label: RegExp) {
  const labelMatch = value.match(label);
  if (!labelMatch || labelMatch.index == null) return undefined;
  const rest = value.slice(labelMatch.index + labelMatch[0].length);
  const match = rest.match(/^[^\d]{0,20}(\d[\d\s.,]*?)(?=\s+(?:VALOR|OBS|RESPONS|$))/i);
  return cleanStructuredNumber(match?.[1]);
}

function cleanStructuredNumber(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+/g, "").replace(/m[²2]?/gi, "").replace(/[^\d.,-]/g, "");
  return cleaned || undefined;
}

function cleanStructuredValue(value: string) {
  const cleaned = value
    .replace(/^\s*\([^)]*\)\s*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
  return cleaned || undefined;
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
