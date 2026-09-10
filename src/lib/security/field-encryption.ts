import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type Envelope = { _conferiaEncrypted: "v1"; iv: string; tag: string; data: string };

export function encryptStoredJson<T>(value: T): T | Envelope {
  const key = encryptionKey();
  if (!key || value == null) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { _conferiaEncrypted: "v1", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptStoredJson<T>(value: T | Envelope | null | undefined): T | null | undefined {
  if (!isEnvelope(value)) return value as T | null | undefined;
  const key = encryptionKey();
  if (!key) throw new Error("Chave de criptografia de campos não configurada.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

function encryptionKey() {
  const value = process.env.CONFERIA_FIELD_ENCRYPTION_KEY;
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("CONFERIA_FIELD_ENCRYPTION_KEY deve conter 32 bytes em base64.");
  return key;
}

function isEnvelope(value: unknown): value is Envelope {
  return Boolean(value && typeof value === "object" && (value as { _conferiaEncrypted?: unknown })._conferiaEncrypted === "v1");
}
