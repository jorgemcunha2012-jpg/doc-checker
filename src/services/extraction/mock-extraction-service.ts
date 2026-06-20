import type { ExtractionRequest, ExtractionResult, DocumentExtractionService } from "./types";

const minutaSource = {
  "buyer.name": "Maria Fernanda Alves",
  "buyer.cpf": "123.456.789-00",
  "buyer.rg": "45.678.912-3",
  "buyer.maritalStatus": "Casada",
  "buyer.address": "Rua das Palmeiras, 120 - São Paulo/SP",
  "property.development": "Residencial Aurora",
  "property.registration": "88.451",
  "property.unit": "1204",
  "property.tower": "B",
  "property.idealFraction": "0,004812",
  "property.areas": "Privativa 68,20 m² | Total 102,44 m²",
  "financial.downPayment": "R$ 80.000,00",
  "financial.financing": "R$ 320.000,00",
  "financial.fgts": "R$ 25.000,00",
  "financial.subsidy": "R$ 0,00",
  "financial.totalValue": "R$ 425.000,00",
  "clauses.required": "Presente",
  "signatures.present": "Revisar assinatura do cônjuge",
};

const minutaTarget = {
  ...minutaSource,
  "buyer.address": "Rua das Palmeiras, 120 - São Paulo - SP",
  "financial.financing": "R$ 315.000,00",
  "signatures.present": "",
};

const itbiSource = {
  "buyer.name": "Carlos Eduardo Lima",
  "buyer.cpf": "987.654.321-11",
  "buyer.address": "Av. Brasil, 455 - Curitiba/PR",
  "buyer.email": "carlos.lima@email.com",
  "buyer.phone": "(41) 99999-0101",
  "seller.legalName": "Aurora Incorporações SPE Ltda.",
  "seller.cnpj": "12.345.678/0001-90",
  "seller.address": "Rua XV de Novembro, 900 - Curitiba/PR",
  "property.registration": "54.778",
  "property.iptu": "021.445.0099-1",
  "property.address": "Av. Brasil, 455 - Unidade 604",
  "property.privateArea": "57,80 m²",
  "property.commonArea": "21,50 m²",
  "property.totalArea": "79,30 m²",
  "property.landArea": "1.245,00 m²",
  "property.idealFraction": "0,003129",
  "financial.declaredTotal": "R$ 390.000,00",
  "financial.financedValue": "R$ 280.000,00",
  "financial.nonFinancedValue": "R$ 110.000,00",
  "documents.identity": "Anexado",
  "documents.cpf": "Anexado",
  "documents.addressProof": "Anexado",
  "documents.maritalStatusProof": "Não localizado",
};

const itbiTarget = {
  ...itbiSource,
  "buyer.phone": "",
  "property.totalArea": "78,90 m²",
  "financial.nonFinancedValue": "R$ 100.000,00",
  "documents.maritalStatusProof": "",
};

export class MockExtractionService implements DocumentExtractionService {
  provider = "MOCK" as const;

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    await new Promise((resolve) => setTimeout(resolve, 450));

    if (request.validationType === "ITBI") {
      return {
        provider: this.provider,
        sourceData: itbiSource,
        targetData: itbiTarget,
        confidence: 0.91,
      };
    }

    return {
      provider: this.provider,
      sourceData: minutaSource,
      targetData: minutaTarget,
      confidence: 0.93,
    };
  }
}
