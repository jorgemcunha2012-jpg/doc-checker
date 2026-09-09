import type { ProviderExtractionOutput } from "@/domain/validation";

type TokenMap = Map<string, string>;

export function tokenizeSensitiveText(text: string) {
  const replacements: TokenMap = new Map();
  const counters = new Map<string, number>();
  const tokenFor = (kind: string, value: string) => {
    const normalized = value.trim();
    if (!normalized) return value;
    const existing = [...replacements.entries()].find(([, original]) => original === normalized)?.[0];
    if (existing) return existing;
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    const token = `[${kind}_${String(next).padStart(2, "0")}]`;
    replacements.set(token, normalized);
    return token;
  };

  let tokenized = text;
  tokenized = tokenized.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g, (value) => tokenFor("CNPJ", value));
  tokenized = tokenized.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g, (value) => tokenFor("CPF", value));
  tokenized = tokenized.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, (value) => tokenFor("EMAIL", value));
  tokenized = tokenized.replace(/(?<![\d.,])(?:\+?\d{2}\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s-]?\d{4}(?![\d.,])/g, (value) => tokenFor("TELEFONE", value));
  tokenized = tokenized.replace(/((?:RG|IDENTIDADE)\s*(?:N[.º°o]|NÚMERO)?\s*[:\-]?\s*)([A-Z0-9./-]{5,20})/gi, (_, label: string, value: string) => `${label}${tokenFor("RG", value)}`);

  // Label-aware replacement avoids masking financial values or property data
  // that happen to be on the same page as a buyer's personal information.
  tokenized = tokenized.replace(/((?:NOME\s+DO\s+CLIENTE|NOME\s+DO\s+COMPRADOR|CLIENTE|COMPRADOR|ADQUIRENTE)\s*[:\-]\s*)([^\n|;]{2,120})/gi, (_, label: string, value: string) => `${label}${tokenFor("PESSOA", value)}`);
  tokenized = tokenized.replace(/((?:ENDEREÇO|ENDERECO|DOMICÍLIO|DOMICILIO)\s*(?:RESIDENCIAL|DO\s+COMPRADOR|DO\s+CLIENTE)?\s*[:\-]\s*)([^\n|;]{5,220})/gi, (_, label: string, value: string) => `${label}${tokenFor("ENDERECO", value)}`);

  return { text: tokenized, replacements };
}

export function restoreTokenizedOutput(output: ProviderExtractionOutput, replacements: TokenMap): ProviderExtractionOutput {
  if (!replacements.size) return output;
  const restore = (value: string | null | undefined): string | null => {
    if (!value) return value ?? null;
    return [...replacements.entries()].reduce((result, [token, original]) => result.split(token).join(original), value);
  };
  return {
    fields: output.fields.map((field) => ({
      ...field,
      value: restore(field.value),
      sourceLocation: field.sourceLocation
        ? {
            ...field.sourceLocation,
            ...(field.sourceLocation.rawText ? { rawText: restore(field.sourceLocation.rawText) ?? undefined } : {}),
          }
        : field.sourceLocation,
    })),
  };
}
