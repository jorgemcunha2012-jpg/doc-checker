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
    text("contract.agencyCode", "Identificação do contrato", 90, [/(?:c[oó]digo\s+(?:da\s+)?ag[eê]ncia|ag[eê]ncia\s*(?:c[oó]digo|n[ºo.]?))\s*[:#-]?\s*(\d{3,6})\b/i, /\bag[eê]ncia\s*:\s*(\d{3,6})\b/i]),
    text("contract.financingModality", "Identificação do contrato", 90, [/modalidade\s+de\s+financiamento[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("contract.housingProgram", "Identificação do contrato", 90, [/programa\s+habitacional[^:\n\r]*:\s*([^\n\r]+)/i]),
    money("financial.financing", "Composição dos recursos", 100, [
      /B\s*\.\s*4\s*\.\s*1[\s\S]{0,180}?(R\$\s*\d[\d.,]*)/i,
      /B\s*1\s*\.\s*3[^\n\r]*?financiamento[^\n\r]*?(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.downPayment", "Composição dos recursos", 100, [
      /B\s*\.\s*4\s*\.\s*2[\s\S]{0,180}?(R\$\s*\d[\d.,]*)/i,
      /B\s*1\s*\.\s*1[^\n\r]*?recursos\s+pr[oó]prios[^\n\r]*?(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.fgts", "Composição dos recursos", 100, [
      /B\s*\.\s*4\s*\.\s*3[\s\S]{0,180}?(R\$\s*\d[\d.,]*)/i,
      /B\s*1\s*\.\s*2[^\n\r]*?FGTS[^\n\r]*?(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.subsidy", "Composição dos recursos", 100, [/B\s*\.\s*4\s*\.\s*5[\s\S]{0,180}?(R\$\s*\d[\d.,]*)/i]),
    money("financial.totalValue", "Valor do contrato", 98, [
      /valor destinado[\s\S]{0,240}?\s+é\s*(R\$\s*\d[\d.,]*)/i,
      /valor (?:total|do imóvel|da venda)[^\n\r:]*:\s*(R\$\s*\d[\d.,]*)/i,
      /valor\s+de\s+aquisi[cç][aã]o[^.\n\r]*?objeto\s+deste\s+contrato\s+equivale\s+a\s*(R\$\s*\d[\d.,]*)/i,
    ]),
    money("financial.appraisalValue", "Valores da operação", 92, [/valor\s+da\s+avalia[cç][aã]o[^:\n\r]*:\s*(R\$\s*\d[\d.,]*)/i]),
    money("financial.housingEntry", "Valores da operação", 90, [/entrada\s+moradia[^:\n\r]*:\s*(R\$\s*\d[\d.,]*)/i]),
    text("property.unit", "Descrição do imóvel", 92, [
      /\b(?:futura\s+)?unidade\s+aut[oô]noma\s+(?:apartamento|apto)\s*(?:n[ºo.]*)?\s*([0-9]{1,6}[A-Z]?)\b/i,
      /\b(?:apartamento|apto)\s*(?:n[ºo.]*)?\s*([0-9]{1,6}[A-Z]?)\b/i,
      /\bunidade\s*(?:n[ºo.]*)?\s*([0-9]{1,6}[A-Z]?)\b/i,
    ]),
    text("property.tower", "Descrição do imóvel", 92, [
      /\b(?:apartamento|apto)\s*(?:n[ºo.]*)?\s*[0-9]{1,6}[A-Z]?\s+(?:da|do|na|no)\s+(?:torre|bloco)\s*(?:n[ºo.]*)?\s*([A-Z0-9-]{1,12})\b/i,
      /\b(?:torre|bloco)\s*(?:n[ºo.]*)?\s*([A-Z0-9-]{1,12})\b/i,
    ]),
    text("property.registration", "Descrição do imóvel", 90, [
      /\bmatr[ií]cula\s*(?:n[º°o.]*)?\s*([A-Z0-9./-]{2,30})\b/i,
    ]),
    text("property.registryOffice", "Descrição do imóvel", 88, [/(?:cart[oó]rio|of[ií]cio)\s+(?:de\s+)?registro\s+de\s+im[oó]veis?[^:\n\r]*:?\s*([^\n\r]+)/i]),
    text("property.type", "Descrição do imóvel", 88, [
      /(?:tipo\s+do\s+im[oó]vel|tipo\s+da\s+unidade)[^:\n\r]*:\s*([^\n\r]+)/i,
      /\b(?:\d{1,2}\s*[ºo]\s*)?pavimento\s*,?\s*(tipo\s+[A-Z0-9-]+)\b/i,
    ]),
    text("property.floor", "Descrição do imóvel", 88, [
      /(\d{1,2}\s*[ºo]\s*pavimento)\b/i,
      /(?:pavimento|andar)[^:\n\r:]*:\s*([A-Z0-9-]+)/i,
    ]),
    text("property.address", "Descrição do imóvel", 94, [
      /empreendimento\s+denominado\s+[^,\n\r]+,\s*([\s\S]{1,320}?)\s*,\s*com\s+[áa]rea\s+privativa/i,
    ]),
    text("property.privateArea", "Descrição do imóvel", 96, [
      /[áa]rea\s+privativa\s+(?:coberta\s+|total\s+)?(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i,
    ]),
    text("property.commonArea", "Descrição do imóvel", 96, [
      /[áa]rea\s+(?:de\s+)?uso\s+comum\s+(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i,
      /[áa]rea\s+comum\s+(?:total\s+)?(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i,
    ]),
    text("property.totalArea", "Descrição do imóvel", 96, [
      /[áa]rea\s+(?:real\s+)?total\s+(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i,
    ]),
    text("property.idealFraction", "Descrição do imóvel", 96, [
      /fra[cç][ãa]o\s+ideal\s+(?:de\s*)?(\d[\d.,]*)/i,
    ]),
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
      /(?:nome(?:\s+do\s+cliente)?|cliente|proponente|comprador|adquirente)\s*:?\s*([^\n\r]+)/i,
    ]),
    text("buyer.cpf", "Dados da reserva", 94, [
      /(?:cpf\s*\/?\s*cnpj|cpfc?npj|cpf)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
    ]),
    text("buyer.rg", "Dados da reserva", 90, [/\brg\s*:?\s*([A-Z0-9.-]{5,30})/i]),
    text("buyer.maritalStatus", "Dados da reserva", 90, [/estado\s+civil\s*:?\s*([^\n\r]+)/i]),
    text("buyer.email", "Dados da reserva", 96, [/(?:e-?mail|correio\s+eletr[oô]nico)\s*:?\s*([^\s\n\r]+@[^\s\n\r]+)/i]),
    text("buyer.phone", "Dados da reserva", 94, [/(?:telefone|celular|fone|whatsapp)\s*:?\s*([+()\d\s.-]{8,24})/i]),
    text("property.development", "Dados da reserva", 92, [/unidade\s*:?\s*([^/\n\r]+?)(?:\s*\/\s*torre|\s*\/\s*\d|\n|\r)/i]),
    text("property.tower", "Dados da reserva", 94, [/\/\s*torre\s*([A-Z0-9-]{1,12})/i]),
    text("property.unit", "Dados da reserva", 94, [/\/\s*torre\s*[A-Z0-9-]{1,12}\s*\/\s*([A-Z0-9-]{1,12})/i]),
    text("property.registration", "Dados da reserva", 88, [
      // A reservation screen can place the delivery date right after an empty
      // "Matrícula" label. A matrícula is numeric; a date must never become one.
      /matr[ií]cula\s*:?\s*((?!\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)\d{2,}(?:[./-]\d+)*)\b/i,
    ]),
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
      /\bfinanciamento\b[^\n\r]{0,40}?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
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
    text("buyer.address", "ITBI", 94, [
      /Endereço\s*:\s*(.+?)(?=\s+(?:Email|Telefone|Text\d+|Texto\d+|Endereço_?2|Inscri[cç][aã]o|$))/i,
    ]),
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
    text("seller.address", "ITBI", 94, [
      /Endereço_?2\s*:\s*(.+?)(?=\s+(?:Inscri[cç][aã]o|Text\d+|Texto\d+|[ÁA]rea|Complemento|Valor\s)|$)/i,
    ]),
    text("seller.email", "ITBI", 90, [/(?:Email|E-mail)[^:\n\r]*:\s*([^\s\n\r]+@[^\s\n\r]+)/i]),
    text("seller.phone", "ITBI", 88, [/(?:Telefone|Celular)[^:\n\r]*:\s*([+()\d\s.-]{8,24})/i]),
    text("transaction.instrumentDate", "ITBI", 88, [/(?:data\s+do\s+instrumento|data\s+da\s+transa[cç][aã]o)[^:\n\r]*:\s*([^\n\r]+)/i]),
    text("transaction.nature", "ITBI", 88, [
      /natureza\s+da\s+transa[cç][aã]o[^:\n\r]*:\s*([^\n\r]+)/i,
      /Compra\s+Venda\s+etc\s*:\s*(.+?)(?=\s+(?:Valor|Check\s*Box|Caucaia:|$))/i,
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
      /Text6\s*:\s*(.+?)(?=\s+(?:Text\d+|Texto\d+|[ÁA]rea|Complemento|Valor|$))/i,
      /(?:tipo\s+do\s+im[oó]vel|tipo)[^:\n\r]*:\s*([^\n\r]+)/i,
    ]),
    text("property.address", "ITBI", 90, [
      /Text3\s*:\s*(.+?)(?=\s+(?:Text\d+|Texto\d+|[ÁA]rea|Complemento|Valor|$))/i,
      /Endereço_2\s*:\s*([^\n\r]+)/i,
    ]),
    text("property.unit", "ITBI", 94, [
      /Complemento\s*:\s*[^\n\r]*?\b(?:APARTAMENTO|APTO?|A\s*P)\.?\s*(?:N[ºO.]*)?\s*(\d{1,6}[A-Z]?)\b/i,
    ]),
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
    : source === "MINUTA"
      ? { fields: recoverMinutaChecklistControls(recoverMinutaParticipants(recoverMinutaPropertyDescription(recoverMinutaCompositionTable(fields, text), text), text), text) }
      : source === "SIOPI"
        ? { fields: recoverSiopiFields(fields, text) }
      : { fields };
  return resolvedSource === "ITBI" ? mergeDtiStructuredFields(output, text, checklist) : output;
}

function recoverSiopiFields(fields: ExtractedField[], text: string) {
  const compact = text.replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  const recovered = new Map<string, { value: string; rawText: string; section: string }>();
  const add = (fieldId: string, value: string | undefined, rawText: string, section: string) => {
    if (value?.trim()) recovered.set(fieldId, { value: cleanValue(value), rawText: evidenceExcerpt(rawText, value), section });
  };
  const match = (pattern: RegExp) => compact.match(pattern);
  const value = (pattern: RegExp) => match(pattern)?.[1]?.trim();

  add("contract.number", value(/N[úu]mero\s+Contrato\s+para\s+Administra[cç][aã]o\s*:\s*([A-Z0-9./-]+)/i), compact, "Identificação da proposta");
  add("contract.agencyCode", value(/Unidade\s+Solicitante\s*:\s*(\d{3,6})\b/i) ?? value(/Unidade\s*\/\s*Respons[aá]vel\s*:\s*(\d{3,6})\b/i), compact, "Identificação da proposta");
  add("contract.financingModality", value(/Tipo\s+de\s+Financiamento\s*:\s*(.+?)(?=\s+(?:Correspondente(?:\s+Caixa\s+Aqui)?|C[oó]digo\s+da\s+Reserva|Seguradora)\s*:)/i), compact, "Dados da proposta");
  add("contract.housingProgram", value(/Item\s+de\s+Produto\s*:\s*\d+\s*-\s*([^:]+?)(?=\s+CPF\s+do\s+Proponente|\s+Data\s+de\s+Nascimento|$)/i), compact, "Identificação da proposta");

  const propertyStart = compact.search(/3\s*-\s*UNIDADE\s+HABITACIONAL/i);
  const propertyEnd = compact.search(/4\s*-\s*PESQUISA\s+DE\s+SUBS[IÍ]DIOS/i);
  const property = propertyStart >= 0 ? compact.slice(propertyStart, propertyEnd > propertyStart ? propertyEnd : propertyStart + 8000) : "";
  const propertyValue = (pattern: RegExp) => property.match(pattern)?.[1]?.trim();
  add("property.development", propertyValue(/Nome\s+do\s+Empreendimento\s*:\s*(.+?)(?=\s+Tipo\s+de\s+Unidade\s*:)/i), property, "Unidade habitacional");
  add("property.type", propertyValue(/Tipo\s+de\s+Unidade\s*:\s*([A-Z0-9-]+)/i), property, "Unidade habitacional");
  add("property.address", propertyValue(/Endere[cç]o\s+da\s+Unidade\s+Habitacional\s*:\s*(.+?)(?=\s+Vagas\s+de\s+Garagem\s*:)/i), property, "Unidade habitacional");
  add("property.unit", propertyValue(/(?:Apartamento|Apto?|AP)\s*(?:n[ºo.°]*)?\s*(\d{1,6}[A-Z]?)/i), property, "Descrição da unidade");
  add("property.tower", propertyValue(/(?:Torre|Bloco|BL\.?\s*T)\s*(?:n[ºo.°]*)?\s*([A-Z0-9-]{1,12})\b/i), property, "Descrição da unidade");
  add("property.registration", propertyValue(/matr[ií]cula\s*n[ºo.°]*\s*([A-Z0-9./-]{2,30})/i), property, "Descrição da unidade");
  add("property.privateArea", propertyValue(/[áa]rea\s+privativa\s+(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i), property, "Descrição da unidade");
  add("property.commonArea", propertyValue(/[áa]rea\s+(?:de\s+)?uso\s+comum\s+(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i), property, "Descrição da unidade");
  add("property.totalArea", propertyValue(/[áa]rea\s+total\s+(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i), property, "Descrição da unidade");
  add("property.idealFraction", propertyValue(/(?:coeficiente\s+de\s+proporcionalidade|fra[cç][aã]o\s+ideal)\s+(?:de\s*)?(\d[\d.,]*)/i), property, "Descrição da unidade");

  const financialStart = compact.search(/5\.3\s*-\s*Negocia[cç][aã]o\s+da\s+Proposta/i);
  const financialEnd = compact.search(/5\.5\s*-\s*Terreno/i);
  const financial = financialStart >= 0 ? compact.slice(financialStart, financialEnd > financialStart ? financialEnd : financialStart + 8000) : "";
  const money = (label: RegExp) => financial.match(new RegExp(`${label.source}\\s*:?\\s*(\\d[\\d.]*,\\d{2})`, label.flags))?.[1];
  add("financial.totalValue", money(/Valor\s+Compra\s+e\s+Venda\s+ou\s+Or[cç]amento\s+Proposto\s+pelo\s+Cliente/i), financial, "Valores da operação");
  add("financial.financing", money(/Valor\s+Financiamento\s+Negociado/i), financial, "Valores da operação");
  add("financial.financedValue", money(/Valor\s+Financiamento\s+Negociado/i), financial, "Valores da operação");
  add("financial.downPayment", money(/Valor\s+Recursos\s+Pr[oó]prios(?!\s+Aportados)/i), financial, "Valores da operação");
  add("financial.fgts", money(/Valor\s+Total\s+Utilizado\s+FGTS/i), financial, "Valores da operação");
  add("financial.subsidy", money(/Subs[ií]dio\s+Complemento\s+Capacidade\s+Financeira/i), financial, "Valores da operação");
  add("financial.appraisalValue", value(/Avalia[cç][aã]o\s+do\s+Im[oó]vel\s*:\s*(\d[\d.]*,\d{2})/i), compact, "Avaliação de risco");
  const housingEntry = compact.match(/Valores\s+de\s+Subven[cç][aã]o\s+Entrada\s*:\s*(\d[\d.]*,\d{2})/i)?.[1]
    ?? compact.match(/Valor\s+Subven[cç][aã]o\s+Entrada\s*(\d[\d.]*,\d{2})/i)?.[1];
  add("financial.housingEntry", housingEntry, compact, "Entrada Moradia");

  const baseFields = new Set(["buyer.name", "buyer.cpf", "buyer.rg", "buyer.nationality", "buyer.profession", "buyer.maritalStatus", "buyer.birthDate", "buyer.address", "buyer.email", "buyer.phone"]);
  const participants = recoverSiopiParticipants(compact);
  const mapped = fields.map((field) => {
    const found = recovered.get(field.fieldId);
    return found ? { ...field, value: found.value, confidence: 98, sourceLocation: { section: found.section, rawText: found.rawText } } : field;
  });
  return participants.length ? [...mapped.filter((field) => !baseFields.has(field.fieldId)), ...participants] : mapped;
}

function recoverSiopiParticipants(text: string) {
  const headers = /2\.1(?:\.1)?\s*-\s*Dados\s+do\s+Participante\s*-\s*(?:Proponente\/Comprador|Coobrigado\/Proponente)/gi;
  const matches = [...text.matchAll(headers)];
  if (!matches.length) return [] as ExtractedField[];
  const participantFields: ExtractedField[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = (matches[index].index ?? 0) + matches[index][0].length;
    const next = matches[index + 1]?.index ?? text.search(/3\s*-\s*UNIDADE\s+HABITACIONAL/i);
    const block = text.slice(start, next > start ? next : start + 5000);
    const field = (pattern: RegExp) => block.match(pattern)?.[1]?.trim();
    const participantId = `buyer_${index + 1}`;
    const add = (fieldId: string, value: string | undefined) => {
      if (value) participantFields.push(participantField(fieldId, cleanValue(value), participantId, evidenceExcerpt(block, value), "Participante SIOPI"));
    };
    add("buyer.name", field(/Nome\s*:\s*(.+?)(?=\s+Sexo\s*:)/i));
    add("buyer.cpf", field(/CPF\s*:\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i));
    add("buyer.rg", field(/Tipo\s+de\s+Identifica[cç][aã]o\s*:[\s\S]*?N[úu]mero\s*:\s*([A-Z0-9.-]{5,30})/i));
    add("buyer.nationality", field(/Nacionalidade\s*:\s*([^:]+?)(?=\s+Profiss[aã]o\s*:)/i));
    add("buyer.profession", field(/Profiss[aã]o\s*:\s*(.+?)(?=\s+Ocupa[cç][aã]o\s*:)/i));
    add("buyer.maritalStatus", field(/Estado\s+Civil\s*:\s*(.+?)(?=\s+Data\s+de\s+Nascimento\s*:)/i));
    add("buyer.birthDate", field(/Data\s+de\s+Nascimento\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i));
    add("buyer.email", field(/E-?mail\s*:\s*([^\s]+)/i));
    add("buyer.phone", field(/Telefone\s+Celular\s*:\s*([+()\d\s.-]{8,24})/i) ?? field(/Telefone\s+Residencial\s*:\s*([+()\d\s.-]{8,24})/i));
    const street = field(/Tipo\s+de\s+Logradouro\s*:\s*([^\s]+)\s+Logradouro\s*:\s*(.+?)(?=\s+N[úu]mero\s*:)/i);
    const number = field(/N[úu]mero\s*:\s*([^\s]+)(?=\s+Complemento\s*:)/i);
    const complement = field(/Complemento\s*:\s*(.+?)(?=\s+Bairro\s*:)/i);
    const neighborhood = field(/Bairro\s*:\s*(.+?)(?=\s+Munic[ií]pio\s*:)/i);
    const city = field(/Munic[ií]pio\s*:\s*(.+?)(?=\s+UF\s*:)/i);
    const state = field(/UF\s*:\s*([A-Z]{2})(?=\s+CEP\s*:)/i);
    const postalCode = field(/CEP\s*:\s*(\d{5}-?\d{3})/i);
    const address = [street, number, complement, neighborhood, city, state, postalCode].filter(Boolean).join(", ");
    const addressEvidence = block.match(/Endere[cç]o\s+Tipo\s+de\s+Logradouro[\s\S]{0,700}?\bCEP\s*:\s*\d{5}-?\d{3}/i)?.[0];
    if (address) participantFields.push(participantField("buyer.address", cleanValue(address), participantId, addressEvidence ?? evidenceExcerpt(block, address), "Participante SIOPI"));
  }
  return participantFields;
}

function recoverMinutaParticipants(fields: ExtractedField[], text: string) {
  const start = text.search(/ADQUIRENTE\s+E\s+DEVEDOR|DEVEDOR\(ES\)\s+FIDUCIANTE/i);
  const end = text.search(/(?:\n|^)\s*D\s*-\s*DESCRI[CÇ][AÃ]O\s+DO\s+IM[ÓO]VEL/i);
  if (start < 0) return fields;
  const block = text.slice(start, end > start ? end : start + 14_000);
  const matches = [...block.matchAll(/([A-ZÀ-Ú][A-ZÀ-Ú\s]{5,}),\s*nacionalidade\b([\s\S]*?)(?=\.\s*(?:e\s+)?[A-ZÀ-Ú][A-ZÀ-Ú\s]{5,},\s*nacionalidade\b|$)/gi)];
  if (!matches.length) return fields;

  const participantFields = new Set(["buyer.name", "buyer.cpf", "buyer.rg", "buyer.rgIssuer", "buyer.maritalStatus", "buyer.propertyRegime", "buyer.address", "buyer.email", "buyer.phone"]);
  const recovered: ExtractedField[] = [];
  matches.forEach((match, index) => {
    const name = match[1].replace(/^e\s+/i, "").replace(/\s+/g, " ").trim();
    // A qualificação de outros intervenientes pode aparecer depois do comprador.
    // Mantemos somente o bloco do adquirente para nunca usar o RG do procurador
    // ou representante da vendedora como se fosse o documento do comprador.
    const details = match[2].split(/\b(?:INCORPORADORA|CONSTRUTORA|CREDORA\s+FIDUCI[ÁA]RIA|ENTIDADE\s+ORGANIZADORA)\b/i)[0];
    const participantId = `buyer_${index + 1}`;
    const evidence = `${name}, nacionalidade${details}`.replace(/\s+/g, " ").slice(0, 500);
    recovered.push(participantField("buyer.name", name, participantId, evidence));

    const cpf = details.match(/\bCPF\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)?.[1];
    if (cpf) recovered.push(participantField("buyer.cpf", cpf, participantId, evidence));
    const rg = details.match(/\b(?:RG|CNH)\s*(?:n[ºo.]*)?\s*([A-Z0-9.-]{4,30})/i)?.[1];
    if (rg) recovered.push(participantField("buyer.rg", rg, participantId, evidence));
    const rgIssuer = details.match(/\b(?:SSP|DETRAN|PC|IFP|SDS|SESP|SEGUP)[/-]?[A-Z]{0,3}\b/i)?.[0];
    if (rgIssuer) recovered.push(participantField("buyer.rgIssuer", rgIssuer, participantId, evidence));
    const email = details.match(/e-?mail\s*:\s*([\w.+-]+@[\w.-]+\.[A-Z]{2,})/i)?.[1];
    if (email) recovered.push(participantField("buyer.email", email, participantId, evidence));
    const maritalStatus = details.match(/\b(solteir[oa](?:\(a\))?|casad[oa](?:\(a\))?|divorciad[oa](?:\(a\))?|vi[úu]v[oa](?:\(a\))?)\b/i)?.[1];
    if (maritalStatus) recovered.push(participantField("buyer.maritalStatus", maritalStatus, participantId, evidence));
    const propertyRegime = details.match(/\b(?:comunh[aã]o\s+(?:parcial|universal)\s+de\s+bens|separa[cç][aã]o\s+(?:total|convencional)\s+de\s+bens|participa[cç][aã]o\s+final\s+nos\s+aq[uü]estos)\b/i)?.[0];
    if (propertyRegime) recovered.push(participantField("buyer.propertyRegime", propertyRegime, participantId, evidence));
    const address = details.match(/residente\s+e\s+domiciliado\(a\)\s+em\s+([^\.\r\n]+)/i)?.[1]?.trim();
    if (address) recovered.push(participantField("buyer.address", address, participantId, evidence));
  });

  if (!recovered.length) return fields;
  return [...fields.filter((field) => !participantFields.has(field.fieldId)), ...recovered];
}

function participantField(fieldId: string, value: string, participantId: string, rawText: string, section = "Qualificação do(s) adquirente(s)"): ExtractedField {
  return {
    fieldId,
    value,
    participantId,
    confidence: 96,
    sourceLocation: { section, rawText },
  };
}

function recoverMinutaCompositionTable(fields: ExtractedField[], text: string) {
  const start = text.search(/B\s*\.\s*4\s*\.\s*1\b/i);
  if (start < 0) return fields;
  const remainder = text.slice(start);
  const end = remainder.search(/\bB\s*\.\s*5\b/i);
  const block = remainder.slice(0, end >= 0 ? end : remainder.length);
  const labels = [...block.matchAll(/B\s*\.\s*4\s*\.\s*([1-6])\b[\s\S]{0,260}?(?=B\s*\.\s*4\s*\.\s*[1-6]\b|R\$\s*\d|$)/gi)];
  const amounts = [...block.matchAll(/R\$\s*\d[\d.]*,\d{2}/g)].map((match) => match[0].replace(/\s+/g, " "));
  if (labels.length < 4 || amounts.length < labels.length) return fields;

  const fieldByItem: Record<string, string | undefined> = {
    "1": "financial.financing",
    "2": "financial.downPayment",
    "3": "financial.fgts",
    "5": "financial.subsidy",
    "6": "financial.housingEntry",
  };
  const recovered = new Map<string, { value: string; rawText: string }>();
  labels.forEach((label, index) => {
    const fieldId = fieldByItem[label[1]];
    const value = amounts[index];
    if (!fieldId || !value) return;
    recovered.set(fieldId, { value, rawText: `${label[0].replace(/\s+/g, " ")} ${value}` });
  });

  const total = block.match(/valor\s+destinado[\s\S]{0,260}?(?:[ée]|equivale\s+a)\s*(R\$\s*\d[\d.,]*)/i);
  if (total?.[1]) recovered.set("financial.totalValue", { value: cleanMoneyToken(total[1]), rawText: total[0].replace(/\s+/g, " ") });
  const tableBlock = block.slice(0, 2_000);
  const lastHeader = [...tableBlock.matchAll(/B\s*\.\s*4\s*\.\s*6\b/gi)].at(-1);
  const tableAmounts = lastHeader
    ? [...tableBlock.slice(lastHeader.index ?? 0).matchAll(/R\$\s*\d[\d.,]*/g)].map((match) => cleanMoneyToken(match[0]))
    : [];
  if (tableAmounts.length >= 6) {
    const [financing, downPayment, fgts, , subsidy, housingEntry] = tableAmounts;
    const itemEvidence = (item: number, value: string) => {
      const header = tableBlock.match(new RegExp(`B\\s*\\.\\s*4\\s*\\.\\s*${item}\\b[\\s\\S]{0,220}`, "i"))?.[0] ?? `B.4.${item}`;
      return `${header.replace(/\s+/g, " ")} ${value}`;
    };
    recovered.set("financial.financing", { value: financing, rawText: itemEvidence(1, financing) });
    recovered.set("financial.downPayment", { value: downPayment, rawText: itemEvidence(2, downPayment) });
    recovered.set("financial.fgts", { value: fgts, rawText: itemEvidence(3, fgts) });
    recovered.set("financial.subsidy", { value: subsidy, rawText: itemEvidence(5, subsidy) });
    recovered.set("financial.housingEntry", { value: housingEntry, rawText: itemEvidence(6, housingEntry) });
  }

  return fields.map((field) => {
    const value = recovered.get(field.fieldId);
    if (!value) return field;
    return {
      ...field,
      value: value.value,
      confidence: 100,
      sourceLocation: { section: "Composição dos recursos", rawText: value.rawText },
    };
  });
}

function recoverMinutaPropertyDescription(fields: ExtractedField[], text: string) {
  const description = minutaPropertyContext(text);
  if (!description) return fields;

  const unit = extractMinutaPropertyValue(description, [
    /\b(?:apartamento|apto|ap\.?|unidade)\s*(?:n[ºo.°]*)?\s*[:#-]?\s*([0-9]{1,6}[A-Z]?)\b/i,
    /\b(?:unidade|apartamento|apto)\s*(?:aut[oô]noma)?\s*[:#-]?\s*([0-9]{1,6}[A-Z]?)\b/i,
  ]);
  const tower = extractMinutaPropertyValue(description, [
    /\b(?:torre|bloco)\s*(?:n[ºo.°]*)?\s*[:#-]?\s*([A-Z0-9-]{1,12})\b/i,
    /\b(?:edif[ií]cio)\s*(?:n[ºo.°]*)?\s*[:#-]?\s*([A-Z0-9-]{1,12})\b/i,
  ]);
  const type = extractMinutaPropertyValue(description, [
    /\btipo\s+([A-ZÀ-Ú][A-ZÀ-Ú0-9 -]{0,24}?)(?=\s+(?:DO\s+EMPREENDIMENTO|COM\s+[ÁA]REA)|[,.])/i,
    /\b(?:tipo\s+da\s+unidade|tipo\s+do\s+im[oó]vel|tipologia|tipo)\s*[:#-]?\s*([A-Z][A-Z0-9-]{0,15})\b/i,
  ]);
  const floor = extractMinutaFloor(description);
  const registration = extractMinutaPropertyValue(description, [/matr[ií]cula\s*(?:n[º°o.]*)?\s*([A-Z0-9./-]{2,30})\b/i]);
  const privateArea = extractMinutaPropertyValue(description, [/[áa]rea\s+privativa\s+(?:coberta\s+|total\s+)?(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i]);
  const commonArea = extractMinutaPropertyValue(description, [/[áa]rea\s+comum\s+(?:total\s+)?(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i]);
  const totalArea = extractMinutaPropertyValue(description, [/[áa]rea\s+(?:real\s+)?total\s+(?:de\s*)?(\d[\d.,]*\s*m[²2]?)/i]);
  const values = new Map<string, string>();
  if (unit) values.set("property.unit", unit.toUpperCase());
  if (tower) values.set("property.tower", tower.toUpperCase());
  if (type) values.set("property.type", "Tipo " + type.toUpperCase());
  if (floor) values.set("property.floor", floor);
  if (registration) values.set("property.registration", registration);
  if (privateArea) values.set("property.privateArea", privateArea);
  if (commonArea) values.set("property.commonArea", commonArea);
  if (totalArea) values.set("property.totalArea", totalArea);

  return fields.map((field) => {
    const value = values.get(field.fieldId);
    if (!value) return field;
    return {
      ...field,
      value,
      confidence: 99,
      sourceLocation: {
        section: "Descrição do imóvel",
        rawText: evidenceExcerpt(description, value),
      },
    };
  });
}

function recoverMinutaChecklistControls(fields: ExtractedField[], text: string) {
  const controls: Array<{ fieldId: string; section: string; patterns: RegExp[] }> = [
    { fieldId: "property.mortgageRegistration", section: "Matrícula e hipoteca", patterns: [/R\.?(?:\s*[-ºn°]*)?\s*(\d+[A-Z0-9./-]*)\s*(?:da\s+)?hipoteca/i, /registro\s+(?:da\s+)?hipoteca\s*(?:n[ºo.°]*)?\s*([A-Z0-9./-]+)/i] },
    { fieldId: "clause.iptuExemption", section: "Ressalvas", patterns: [/dispensa(?:do|r)?\s+(?:de\s+)?IPTU/i] },
    { fieldId: "clause.itbiLaterPresentation", section: "Ressalvas", patterns: [/(?:apresenta[cç][aã]o|entrega)\s+posterior\s+(?:da\s+)?(?:guia\s+)?ITBI/i] },
    { fieldId: "clause.clientDossier", section: "Ressalvas", patterns: [/(?:dossi[êe]\s+(?:do\s+)?cliente|ag[êe]ncia\s+do\s+processo)/i] },
    { fieldId: "clause.firstAcquisition", section: "Ressalvas", patterns: [/(?:primeira|1ª|1a)\s+aquisi[cç][aã]o/i] },
    { fieldId: "clause.lastInstallment", section: "Ressalvas", patterns: [/(?:[úu]ltima|final)\s+parcela/i] },
    { fieldId: "clause.mortgageRelease", section: "Ressalvas", patterns: [/baixa\s+(?:da\s+)?hipoteca/i] },
    { fieldId: "certificate.sellerFederal", section: "Certidões", patterns: [/certid[aã]o\s+(?:fiscal\s+)?federal[\s\S]{0,90}(?:vendedora|transmitente)|(?:vendedora|transmitente)[\s\S]{0,90}certid[aã]o\s+(?:fiscal\s+)?federal/i] },
    { fieldId: "certificate.sellerLabor", section: "Certidões", patterns: [/certid[aã]o\s+trabalhista[\s\S]{0,90}(?:vendedora|transmitente)|(?:vendedora|transmitente)[\s\S]{0,90}certid[aã]o\s+trabalhista/i] },
    { fieldId: "certificate.buyerLabor", section: "Certidões", patterns: [/certid[aã]o\s+trabalhista[\s\S]{0,90}(?:comprador|adquirente)|(?:comprador|adquirente)[\s\S]{0,90}certid[aã]o\s+trabalhista/i] },
    { fieldId: "property.registrationOnus", section: "Matrícula", patterns: [/(?:matr[ií]cula[\s\S]{0,120}positiva\s+de\s+[ôo]nus|positiva\s+de\s+[ôo]nus[\s\S]{0,120}matr[ií]cula)/i] },
    { fieldId: "signature.afterIssueDate", section: "Página de assinaturas", patterns: [/assinaturas?[\s\S]{0,90}(?:posterior(?:es)?|ap[oó]s)[\s\S]{0,90}(?:emiss[aã]o|data\s+de\s+emiss[aã]o)/i] },
    { fieldId: "signature.manager", section: "Página de assinaturas", patterns: [/(?:assinatura|gerente)[\s\S]{0,80}gerente|gerente[\s\S]{0,80}(?:assinatura|CAIXA)/i] },
  ];
  const detected = new Map<string, { value: string; section: string; rawText: string }>();
  for (const control of controls) {
    const match = control.patterns.map((pattern) => text.match(pattern)).find(Boolean);
    if (!match) continue;
    const excerpt = evidenceExcerpt(text, match[0]);
    detected.set(control.fieldId, { value: match[0].replace(/\s+/g, " ").trim(), section: control.section, rawText: excerpt });
  }
  return fields.map((field) => {
    const value = detected.get(field.fieldId);
    return value ? { ...field, value: value.value, confidence: 96, sourceLocation: { section: value.section, rawText: value.rawText } } : field;
  });
}

function evidenceExcerpt(rawText: string, value: string) {
  const index = rawText.toLocaleLowerCase("pt-BR").indexOf(value.toLocaleLowerCase("pt-BR"));
  if (index < 0) return rawText.slice(0, 500);
  return rawText.slice(Math.max(0, index - 220), Math.min(rawText.length, index + value.length + 280));
}

function cleanMoneyToken(value: string) {
  return value.replace(/(\d{2})\.$/, "$1");
}

function minutaPropertyContext(text: string) {
  const compact = text.replace(/\u00a0/g, " ").replace(/\r/g, "");
  const anchors = [
    /(?:futura\s+)?unidade\s+aut[oô]noma/i,
    /(?:apartamento|apto|unidade)\s*(?:n[ºo.°]*)?\s*[:#-]?\s*\d{1,6}[A-Z]?/i,
    /(?:torre|bloco)\s*(?:n[ºo.°]*)?\s*[:#-]?\s*[A-Z0-9-]{1,12}/i,
    /(?:identifica[cç][aã]o|descri[cç][aã]o)\s+do\s+im[oó]vel/i,
  ];
  const candidates = anchors.flatMap((anchor) => [...compact.matchAll(new RegExp(anchor.source, anchor.flags.includes("g") ? anchor.flags : `${anchor.flags}g`))]
    .map((match) => compact.slice(Math.max(0, (match.index ?? 0) - 160), (match.index ?? 0) + 1400)));

  return candidates
    .map((candidate) => ({ candidate, score: minutaPropertyContextScore(candidate) }))
    .filter(({ score }) => score >= 2)
    .sort((left, right) => right.score - left.score)[0]?.candidate;
}

function minutaPropertyContextScore(value: string) {
  const hasUnit = /\b(?:apartamento|apto|ap\.?|unidade)\s*(?:n[ºo.°]*)?\s*[:#-]?\s*\d{1,6}[A-Z]?\b/i.test(value);
  const hasTower = /\b(?:torre|bloco|edif[ií]cio)\s*(?:n[ºo.°]*)?\s*[:#-]?\s*[A-Z0-9-]{1,12}\b/i.test(value);
  const hasFloor = /\b(?:\d{1,2}\s*[ºo]\s*)?(?:pavimento|andar)\b/i.test(value);
  const hasType = /\b(?:tipo|tipologia)\s*(?:do\s+im[oó]vel|da\s+unidade)?\s*[:#-]?\s*[A-Z]/i.test(value);
  return Number(hasUnit) + Number(hasTower) + Number(hasFloor) + Number(hasType);
}

function extractMinutaPropertyValue(value: string, patterns: RegExp[]) {
  return firstMatch(value, patterns)?.value?.trim();
}

function extractMinutaFloor(value: string) {
  const ordinal = value.match(/\b(\d{1,2})\s*[ºo]\s*(pavimento|andar)\b/i);
  if (ordinal) return `${ordinal[1]}º ${ordinal[2].toLowerCase() === "andar" ? "Andar" : "Pavimento"}`;

  const labeled = value.match(/\b(pavimento|andar)\s*[:#-]?\s*(\d{1,2})\b/i);
  if (!labeled) return undefined;
  return `${labeled[2]}º ${labeled[1].toLowerCase() === "andar" ? "Andar" : "Pavimento"}`;
}

function recoverReservationGridFields(fields: ExtractedField[], text: string) {
  const recovered = new Map<string, { value: string; rawText: string }>();
  const rejected = new Set<string>();
  // In compact portal screenshots, OCR commonly reads the @ before a known
  // mail domain as O or 0. Correct only this constrained, verifiable pattern.
  const layoutText = text.replace(/([A-Z0-9._%+-])[O0](?=(?:gmail|hotmail|outlook|yahoo)\.com(?:\.br)?\b)/gi, "$1@");
  // Algumas telas de reserva apresentam os rótulos em uma linha e os valores na
  // linha abaixo, em colunas independentes. Esse formato não forma uma grade
  // sequencial no OCR, então cada rótulo precisa ser resolvido isoladamente.
  const reservationValue = (label: RegExp) => {
    const match = text.match(new RegExp(`${label.source}\\s*:?\\s*(?:\\r?\\n\\s*)?([^\\r\\n]+)`, label.flags));
    return match?.[1]?.trim() || undefined;
  };
  const name = reservationValue(/(?:^|\n)\s*(?:NOME(?:\s+DO\s+CLIENTE)?|CLIENTE|PROPONENTE|COMPRADOR|ADQUIRENTE)/im);
  const cpf = reservationValue(/(?:^|\n)\s*(?:CPF\s*\/?\s*CNPJ|CPFC?NPJ|CPF)/im)?.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)?.[0];
  const rgCandidate = reservationValue(/(?:^|\n)\s*RG/im)?.match(/[A-Z0-9.-]{5,30}/i)?.[0];
  // Não aceite o próximo cabeçalho (por exemplo, "CELULAR") como RG quando o
  // OCR preserva toda a grade na mesma linha. RGs extraídos precisam carregar
  // ao menos quatro dígitos, mesmo quando trazem letras, pontos ou hífens.
  const rg = rgCandidate && /\d{4}/.test(rgCandidate) ? rgCandidate : undefined;
  const maritalStatus = reservationValue(/(?:^|\n)\s*ESTADO\s+CIVIL/im);
  const emailValue = reservationValue(/(?:^|\n)\s*(?:E-?MAIL|CORREIO\s+ELETR[OÔ]NICO)/im)?.match(/[\w.+-]+(?:@|&)[\w.-]+\.[A-Z]{2,}/i)?.[0]?.replace("&", "@");
  const phoneValue = reservationValue(/(?:^|\n)\s*(?:TELEFONE(?:\s*2)?|CELULAR|FONE|WHATSAPP)/im)?.match(/\+?\d[\d\s().-]{8,24}/)?.[0];
  const street = reservationValue(/(?:^|\n)\s*(?:ENDERE[CÇ]O|LOGRADOURO|END\.?)/im);
  const addressNumber = reservationValue(/(?:^|\n)\s*(?:N[ÚU]MERO|N[ºO]\.?)/im)?.match(/\d{1,8}[A-Z]?/i)?.[0];
  const neighborhood = reservationValue(/(?:^|\n)\s*BAIRRO/im);
  const city = reservationValue(/(?:^|\n)\s*CIDADE/im);
  const state = reservationValue(/(?:^|\n)\s*ESTADO(?!\s+CIVIL)\b/im);
  const postalCode = reservationValue(/(?:^|\n)\s*CEP/im)?.match(/\d{5}-?\d{3}/)?.[0];
  const reservationMoney = (label: RegExp) => reservationValue(label)?.match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/)?.[0];
  const totalValue = reservationMoney(/(?:^|\n)\s*(?:VALOR\s+DO\s+CONTRATO|VALOR\s+TOTAL)/im);
  const financingValue = reservationMoney(/(?:^|\n)\s*(?:VALOR\s+)?FINANCIAMENTO/im);
  const fgtsValue = reservationMoney(/(?:^|\n)\s*FGTS/im);
  const subsidyValue = reservationMoney(/(?:^|\n)\s*(?:SUBS[IÍ]DIO|DESCONTO)/im);
  const downPaymentValue = reservationMoney(/(?:^|\n)\s*(?:ENTRADA\s+TOTAL|RECURSOS\s+PR[ÓO]PRIOS)/im);

  if (name && !/^(?:NASCIMENTO|CPF|RG|ESTADO)\b/i.test(name)) {
    recovered.set("buyer.name", { value: name, rawText: `NOME: ${name}` });
  }
  if (cpf) recovered.set("buyer.cpf", { value: cpf, rawText: `CPF/CNPJ: ${cpf}` });
  if (rg) recovered.set("buyer.rg", { value: rg, rawText: `RG: ${rg}` });
  if (maritalStatus) recovered.set("buyer.maritalStatus", { value: maritalStatus, rawText: `ESTADO CIVIL: ${maritalStatus}` });
  if (emailValue) recovered.set("buyer.email", { value: emailValue, rawText: `E-MAIL: ${emailValue}` });
  if (phoneValue) recovered.set("buyer.phone", { value: phoneValue, rawText: `TELEFONE: ${phoneValue}` });
  if (totalValue) recovered.set("financial.totalValue", { value: totalValue, rawText: "VALOR DO CONTRATO: " + totalValue });
  if (financingValue) recovered.set("financial.financing", { value: financingValue, rawText: "FINANCIAMENTO: " + financingValue });
  if (fgtsValue) recovered.set("financial.fgts", { value: fgtsValue, rawText: "FGTS: " + fgtsValue });
  if (subsidyValue) recovered.set("financial.subsidy", { value: subsidyValue, rawText: "SUBSÍDIO: " + subsidyValue });
  if (downPaymentValue) recovered.set("financial.downPayment", { value: downPaymentValue, rawText: "RECURSOS PRÓPRIOS: " + downPaymentValue });
  const address = [street, addressNumber, neighborhood, city, state, postalCode].filter((part) => part && !/^-$/.test(part)).join(", ");
  if (address) recovered.set("buyer.address", { value: address, rawText: `ENDEREÇO: ${address}` });

  // OCR de telas responsivas costuma devolver primeiro todos os cabeçalhos e,
  // na linha seguinte, todos os valores. Recompomos essas colunas conhecidas
  // em vez de interpretar o cabeçalho como se fosse o valor do campo.
  const columnIdentity = text.match(
    /NOME:\s+NASCIMENTO:\s+CPF\s*\/?\s*CNPJ:\s+RG:\s*\r?\n\s*(.+?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s+([A-Z0-9.-]{5,30})/i,
  );
  const columnCivil = text.match(
    /ESTADO\s+CIVIL:\s+PROFISS[ÃA]O:\s+LOGRADOURO:\s+END:\s*\r?\n\s*(SOLTEIR[OA](?:\(A\))?|CASAD[OA](?:\(A\))?|DIVORCIAD[OA](?:\(A\))?|VI[ÚU]V[OA](?:\(A\))?)[^\r\n]*?\s+(?:RUA|AV(?:ENIDA)?\.?|ALAMEDA|TRAVESSA)\s+((?:RUA|AV(?:ENIDA)?\.?|ALAMEDA|TRAVESSA)\s+[^\r\n]+)/i,
  );
  const columnContact = text.match(
    /TELEFONE:\s+TELEFONE\s*2:\s+E-?MAIL:\s+[^\r\n]*\r?\n\s*([+()\d\s.-]{8,24})\s+[+()\d\s.-]{8,24}\s+([A-Z0-9._%+-]+(?:@|&)[A-Z0-9.-]+\.[A-Z]{2,})/i,
  );
  const columnLocation = text.match(
    /CIDADE\s+ESTADO\s+BAIRRO:\s+CEP:\s*\r?\n\s*([A-ZÀ-Úa-zà-ú\s]+?)\s+([A-ZÀ-Úa-zà-ú\s]+?)\s+([A-ZÀ-Úa-zà-ú\s]+?)\s+(\d{5}-?\d{3})/i,
  );
  const clientHeaderGrid = text.match(
    /NOME\s+DO\s+CLIENTE\s+CPF\s*\/?\s*CNPJ\s+RG\s+CELULAR\s*\r?\n\s*([^\r\n]+?)\s+(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s+([A-Z0-9.-]{5,30})\s+(\+?[\d(][\d\s().-]{8,24})/i,
  );
  const clientContactGrid = text.match(
    /TELEFONE\s+E-?MAIL\s+PROFISS[ÃA]O[\s\S]{0,80}?\r?\n\s*(\+?[\d(][\d\s().-]{8,24})\s+([\w.+-]+(?:@|&|Q)[\w.-]+\.[A-Z]{2,})/i,
  );
  const clientCivilGrid = text.match(
    /NASCIMENTO\s+ESTADO\s+CIVIL[\s\S]{0,80}?\r?\n\s*\d{1,2}[/-]\d{1,2}[/-]\d{4}\s+([^\r\n]+?)\s+(?:—|-)?\s*(?:RUA|AV(?:ENIDA)?\.?|ALAMEDA|TRAVESSA)\s+([^\r\n]+)/i,
  );
  // Compact reservation summaries render the labels in one row and all values
  // below it. OCR keeps that geometry but drops the normal "label: value" shape.
  const reservationSummaryUnit = layoutText.match(
    /UNIDADE\s*:[^\r\n]*\r?\n\s*([^/\r\n]+?)\s*\/\s*TORRE\s*([A-Z0-9-]{1,12})\s*\/\s*([A-Z0-9-]{1,12})\s*\/\s*MATR[IÍ]CULA\s*:\s*([^\s\r\n]*)/i,
  );
  const reservationSummaryContact = layoutText.match(
    /CLIENTE\s*:\s+TELEFONE\s*:\s+E-?MAIL\s*:\s*\r?\n\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+(\+?\d[\d\s().-]{8,24})\s+([A-Z0-9._%+-]+(?:\s+|@|&)[A-Z0-9.-]+\.(?:COM(?:\.BR)?|NET|ORG|BR))/i,
  );
  if (reservationSummaryUnit) {
    const development = reservationSummaryUnit[1].trim();
    const registration = reservationSummaryUnit[4].trim();
    recovered.set("property.development", { value: development, rawText: `UNIDADE: ${development}` });
    recovered.set("property.tower", { value: reservationSummaryUnit[2], rawText: `TORRE: ${reservationSummaryUnit[2]}` });
    recovered.set("property.unit", { value: reservationSummaryUnit[3], rawText: `UNIDADE: ${reservationSummaryUnit[3]}` });
    if (/^\d{2,}(?:[./-]\d+)*$/.test(registration) && !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(registration)) {
      recovered.set("property.registration", { value: registration, rawText: `MATRÍCULA: ${registration}` });
    }
  }
  if (reservationSummaryContact) {
    const email = normalizeReservationEmail(reservationSummaryContact[3]);
    recovered.set("buyer.name", { value: reservationSummaryContact[1].trim(), rawText: `CLIENTE: ${reservationSummaryContact[1].trim()}` });
    recovered.set("buyer.phone", { value: reservationSummaryContact[2].replace(/\s+/g, ""), rawText: `TELEFONE: ${reservationSummaryContact[2]}` });
    if (email) recovered.set("buyer.email", { value: email, rawText: `E-MAIL: ${email}` });
  }
  if (clientHeaderGrid) {
    recovered.set("buyer.name", { value: clientHeaderGrid[1].trim(), rawText: `NOME DO CLIENTE: ${clientHeaderGrid[1].trim()}` });
    recovered.set("buyer.cpf", { value: clientHeaderGrid[2], rawText: `CPF/CNPJ: ${clientHeaderGrid[2]}` });
    if (clientHeaderGrid[3] !== clientHeaderGrid[2]) {
      recovered.set("buyer.rg", { value: clientHeaderGrid[3], rawText: `RG: ${clientHeaderGrid[3]}` });
      rejected.delete("buyer.rg");
    } else {
      // Colunas deslocadas de Reserva às vezes repetem o CPF no lugar do RG.
      // O valor não é evidência de RG e deve permanecer ausente para revisão.
      recovered.delete("buyer.rg");
      rejected.add("buyer.rg");
    }
    recovered.set("buyer.phone", { value: clientHeaderGrid[4], rawText: `CELULAR: ${clientHeaderGrid[4]}` });
  }
  if (clientContactGrid) {
    recovered.set("buyer.phone", { value: clientContactGrid[1], rawText: `TELEFONE: ${clientContactGrid[1]}` });
    recovered.set("buyer.email", { value: clientContactGrid[2].replace(/[&Q]/i, "@"), rawText: `E-MAIL: ${clientContactGrid[2]}` });
  }
  if (clientCivilGrid) {
    recovered.set("buyer.maritalStatus", { value: clientCivilGrid[1].trim(), rawText: `ESTADO CIVIL: ${clientCivilGrid[1].trim()}` });
    recovered.set("buyer.address", { value: clientCivilGrid[2].trim(), rawText: `ENDEREÇO: ${clientCivilGrid[2].trim()}` });
  }
  if (columnIdentity) {
    recovered.set("buyer.name", { value: columnIdentity[1].trim(), rawText: "NOME: " + columnIdentity[1].trim() });
    recovered.set("buyer.cpf", { value: columnIdentity[3], rawText: "CPF/CNPJ: " + columnIdentity[3] });
    recovered.set("buyer.rg", { value: columnIdentity[4], rawText: "RG: " + columnIdentity[4] });
  }
  if (columnCivil) {
    recovered.set("buyer.maritalStatus", { value: columnCivil[1], rawText: "ESTADO CIVIL: " + columnCivil[1] });
  }
  if (columnContact) {
    const email = columnContact[2].replace("&", "@");
    recovered.set("buyer.phone", { value: columnContact[1].replace(/\s+/g, ""), rawText: "TELEFONE: " + columnContact[1] });
    recovered.set("buyer.email", { value: email, rawText: "E-MAIL: " + email });
  }
  if (columnLocation) {
    const streetFromColumns = columnCivil?.[2]?.trim() || street;
    const addressFromColumns = [streetFromColumns, columnLocation[3].trim(), columnLocation[1].trim(), columnLocation[2].trim(), columnLocation[4]]
      .filter(Boolean)
      .join(", ");
    recovered.set("buyer.address", { value: addressFromColumns, rawText: "ENDEREÇO: " + addressFromColumns });
  }

  const identity = text.match(/NOME\s+DO\s+CLIENTE[^\n\r]*[\n\r]+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s+(\d{8,14})\s+(\+?\d{10,15})/i);
  if (identity) {
    recovered.set("buyer.name", { value: identity[1].trim(), rawText: `NOME DO CLIENTE: ${identity[1].trim()}` });
    recovered.set("buyer.cpf", { value: identity[2], rawText: `CPF / CNPJ: ${identity[2]}` });
    recovered.set("buyer.rg", { value: identity[3], rawText: `RG: ${identity[3]}` });
    rejected.delete("buyer.rg");
    recovered.set("buyer.phone", { value: identity[4], rawText: `CELULAR: ${identity[4]}` });
  }
  const phone = text.match(/TELEFONE[^\n\r]*[\n\r]+\s*(\+?\d{10,15})/i)?.[1];
  if (phone) recovered.set("buyer.phone", { value: phone, rawText: `TELEFONE: ${phone}` });
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i)?.[0];
  if (email && !/[o0]{2}/i.test(email)) recovered.set("buyer.email", { value: email, rawText: `E-MAIL: ${email}` });

  return fields.map((field) => {
    const value = recovered.get(field.fieldId);
    if (rejected.has(field.fieldId)) {
      return { ...field, value: null, confidence: 0, sourceLocation: undefined };
    }
    if (value) return { ...field, value: value.value, confidence: 90, sourceLocation: { section: "Dados da reserva", rawText: value.rawText } };
    if (field.fieldId === "buyer.rg" && /^(?:RG|CELULAR|TELEFONE|E-?MAIL)$/i.test(field.value ?? "")) {
      return { ...field, value: null, confidence: 0, sourceLocation: undefined };
    }
    return field;
  });
}

function normalizeReservationEmail(value: string) {
  const compact = value.trim().replace("&", "@").replace(/\s+(?=[A-Z0-9.-]+\.(?:COM(?:\.BR)?|NET|ORG|BR)$)/i, "@");
  return /^[\w.+-]+@[\w.-]+\.[A-Z]{2,}$/i.test(compact) ? compact : null;
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
