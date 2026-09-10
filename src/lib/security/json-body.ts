import { z, type ZodType } from "zod";

export const MAX_JSON_BODY_BYTES = 1024 * 1024;

export class JsonBodyError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function readJsonBody<T>(request: Request, schema: ZodType<T>, maxBytes = MAX_JSON_BODY_BYTES): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new JsonBodyError("A solicitação excede o limite de 1 MB.");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new JsonBodyError("A solicitação excede o limite de 1 MB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new JsonBodyError("JSON inválido.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new JsonBodyError("Dados da solicitação inválidos.");
  return result.data;
}

export function jsonBodyErrorResponse(error: unknown) {
  return error instanceof JsonBodyError ? error.message : null;
}

export const userCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
}).strict();

export const userActionSchema = z.object({
  action: z.enum(["RESET_PASSWORD", "ACTIVATE", "DEACTIVATE"]),
}).strict();

export const passwordSchema = z.object({
  password: z.string().min(12).max(256),
}).strict();

export const reviewSchema = z.object({
  fieldId: z.string().trim().min(1).max(160),
  justification: z.string().trim().max(1000).optional(),
}).strict();

const shortText = z.string().trim().max(500);
const optionalShortText = shortText.optional();
const developmentUnitSchema = z.object({
  tower: shortText,
  unit: shortText,
  privateArea: shortText,
  commonArea: optionalShortText,
  totalArea: optionalShortText,
  idealFraction: optionalShortText,
  iptuRegistration: optionalShortText,
  typology: optionalShortText,
  registration: optionalShortText,
  confidence: z.number().finite().min(0).max(100),
  evidence: z.object({ pages: z.array(z.number().int().positive()).max(100).optional(), rawText: z.string().max(20_000).optional() }).strict().optional(),
}).strict();

const developmentExtractionSchema = z.object({
  name: shortText.min(1),
  city: optionalShortText,
  registration: optionalShortText,
  sellerLegalName: optionalShortText,
  sellerCnpj: optionalShortText,
  units: z.array(developmentUnitSchema).min(1).max(2_000),
  quality: z.object({
    reviewRequired: z.array(z.string().max(500)).max(2_000),
    warnings: z.array(z.string().max(500)).max(2_000),
    sourcesCompared: z.array(z.string().max(100)).max(20).optional(),
    detectedTypologies: z.array(z.string().max(500)).max(2_000).optional(),
  }).strict().optional(),
}).strict();

export const developmentCreateSchema = z.object({
  sourceDocumentName: z.string().trim().min(1).max(500),
  extraction: developmentExtractionSchema,
}).strict();

export const developmentUpdateSchema = developmentCreateSchema.extend({ id: z.string().uuid() }).strict();
export const developmentDeleteSchema = z.object({ id: z.string().uuid() }).strict();

export const renderedPageUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(500),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  mimeType: z.union([z.literal("image/jpeg"), z.literal("application/pdf")]),
}).strict();

export const validationReportSchema = z.object({
  processId: z.string().uuid(),
  filter: z.enum(["ALL", "DIVERGENCES", "PENDING", "CHECKED"]).default("ALL"),
}).strict();
