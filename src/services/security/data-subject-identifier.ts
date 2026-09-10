import { createHash } from "node:crypto";

export function normalizeCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) throw new Error("Informe um CPF válido com 11 dígitos.");
  return digits;
}

export function dataSubjectRequestFingerprint(cpf: string) {
  return createHash("sha256").update(normalizeCpf(cpf)).digest("hex");
}
