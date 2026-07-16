import { NextResponse } from "next/server";
import { after } from "next/server";
import { defaultOrganization } from "@/domain/tenant";
import { uploadDocumentSources, type DocumentSource, type UploadedDocument, type ValidationType } from "@/domain/validation";
import { createValidationProcessAndStart } from "@/services/process/process-validation";
import type { UploadedDocumentPayload } from "@/services/extraction/types";
import { requireUser, AuthError } from "@/lib/auth";
import { developmentUnitValues } from "@/domain/development";
import { getDevelopmentUnit } from "@/services/development/development-repository";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = 60 * 1024 * 1024;
const MAX_FILES = 20;
export const maxDuration = 300;
const ACCEPTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
]);

export async function POST(request: Request) {
  let currentUser;
  try {
    currentUser = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Envie os documentos em multipart/form-data." }, { status: 400 });
  }

  const formData = await request.formData();
  const validationType = formData.get("validationType");

  if (validationType !== "MINUTA" && validationType !== "ITBI" && validationType !== "RECONCILIATION") {
    return NextResponse.json({ error: "Tipo de validação inválido." }, { status: 400 });
  }

  const files = formData.getAll("documents").filter((item): item is File => item instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "Envie ao menos um documento." }, { status: 400 });
  }

  if (files.length > MAX_FILES || files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_SIZE_BYTES) {
    return NextResponse.json({ error: "Envie no máximo 20 arquivos e 60 MB por conferência." }, { status: 400 });
  }

  const acceptedFiles = await Promise.all(files.map(isAcceptedFile));
  const invalidFile = files.find((_, index) => !acceptedFiles[index]);

  if (invalidFile) {
    return NextResponse.json({ error: `Arquivo inválido ou muito grande: ${invalidFile.name}` }, { status: 400 });
  }

  const documentSources = parseDocumentSources(formData.get("documentSources"), files.length);
  if (validationType === "RECONCILIATION" && !documentSources) {
    return NextResponse.json({ error: "Informe uma fonte válida para cada documento." }, { status: 400 });
  }

  const documents = await Promise.all(
    files.map((file, index) => toUploadedDocumentPayload(file, validationType, documentSources?.[index], currentUser.organizationId)),
  );
  const documentValidation =
    validationType === "RECONCILIATION" ? validateReconciliationSources(documents, formData.get("developmentUnitId")) : validateComparisonSides(documents);

  if (documentValidation) {
    return NextResponse.json({ error: documentValidation }, { status: 400 });
  }

  const developmentUnitId = formData.get("developmentUnitId");
  const selectedDevelopment = typeof developmentUnitId === "string" && developmentUnitId
    ? await getDevelopmentUnit(currentUser.organizationId, developmentUnitId)
    : null;
  if (developmentUnitId && !selectedDevelopment) {
    return NextResponse.json({ error: "A unidade selecionada não foi encontrada." }, { status: 400 });
  }
  const referenceValues = selectedDevelopment
    ? developmentUnitValues(selectedDevelopment.development, selectedDevelopment.unit)
    : [];
  const validationProcess = await createValidationProcessAndStart(
    validationType,
    documents,
    currentUser,
    (task) => after(task),
    referenceValues,
  );

  return NextResponse.json({
    processId: validationProcess.id,
    status: validationProcess.status,
    process: validationProcess,
  }, { status: 202 });
}

async function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase();
  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) return false;
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const signatures = {
    pdf: bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46,
    png: bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
    jpeg: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    zip: bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2]),
    rtf: isRtfHeader(bytes),
    tiff:
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a),
  };
  const validContent =
    (name.endsWith(".pdf") && signatures.pdf) ||
    (name.endsWith(".png") && signatures.png) ||
    ((name.endsWith(".jpg") || name.endsWith(".jpeg")) && signatures.jpeg) ||
    (name.endsWith(".docx") && signatures.zip) ||
    (name.endsWith(".rtf") && signatures.rtf) ||
    ((name.endsWith(".tif") || name.endsWith(".tiff")) && signatures.tiff);

  return validContent;
}

function isRtfHeader(bytes: Uint8Array) {
  // RTF files may include a UTF-8 BOM or whitespace before the control word.
  const withoutBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.slice(3) : bytes;
  const header = new TextDecoder("latin1").decode(withoutBom);
  return /^\uFEFF?\s*\{\\rtf/i.test(header);
}

function validateComparisonSides(documents: UploadedDocumentPayload[]) {
  const hasSource = documents.some((document) => document.type === "PRINT" || document.type === "IMAGE" || document.type === "TIFF");
  const hasTarget = documents.some((document) => document.type === "PDF" || document.type === "WORD" || document.type === "CONTRACT" || document.type === "ITBI_GUIDE" || document.type === "COMPLEMENTARY");

  if (!hasSource || !hasTarget) {
    return "Envie ao menos uma imagem/print do dado do cliente e um documento de destino para comparação.";
  }

  return null;
}

async function toUploadedDocumentPayload(
  file: File,
  validationType: ValidationType,
  source?: DocumentSource,
  organizationId = defaultOrganization.id,
): Promise<UploadedDocumentPayload> {
  const arrayBuffer = await file.arrayBuffer();
  const metadata: UploadedDocument = {
    id: crypto.randomUUID(),
    organizationId,
    name: file.name,
    type: resolveDocumentType(file, validationType),
    mimeType: canonicalMimeType(file),
    sizeBytes: file.size,
    source,
  };

  return {
    ...metadata,
    buffer: Buffer.from(arrayBuffer),
  };
}

function canonicalMimeType(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".rtf")) return "application/rtf";
  if (name.endsWith(".tif") || name.endsWith(".tiff")) return "image/tiff";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return ACCEPTED_MIME_TYPES.has(file.type) ? file.type : "application/octet-stream";
}

function parseDocumentSources(value: FormDataEntryValue | null, expectedLength: number) {
  if (typeof value !== "string") return null;
  try {
    const sources = JSON.parse(value) as unknown;
    if (
      !Array.isArray(sources) ||
      sources.length !== expectedLength ||
      !sources.every(
        (source): source is DocumentSource =>
          typeof source === "string" && uploadDocumentSources.some((candidate) => candidate === source),
      )
    ) {
      return null;
    }
    return sources;
  } catch {
    return null;
  }
}

function validateReconciliationSources(documents: UploadedDocumentPayload[], developmentUnitId: FormDataEntryValue | null) {
  const sources = new Set(documents.map((document) => document.source).filter(Boolean));
  const sourceCount = sources.size + (typeof developmentUnitId === "string" && developmentUnitId ? 1 : 0);
  return sourceCount < 2 ? "Envie documentos de pelo menos duas fontes ou selecione uma unidade do cadastro mestre." : null;
}

function resolveDocumentType(file: File, validationType: ValidationType): UploadedDocument["type"] {
  const name = file.name.toLowerCase();

  if (validationType === "ITBI" && /itbi|dti|guia/.test(name)) {
    return "ITBI_GUIDE";
  }

  if (file.type.includes("image")) {
    return /tiff?$/i.test(name) || file.type === "image/tiff" ? "TIFF" : "IMAGE";
  }

  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
    return "WORD";
  }

  if (file.type === "application/rtf" || file.type === "text/rtf" || name.endsWith(".rtf")) {
    return "WORD";
  }

  if (file.type.includes("pdf") || name.endsWith(".pdf")) {
    return validationType === "MINUTA" ? "CONTRACT" : "PDF";
  }

  return validationType === "ITBI" ? "COMPLEMENTARY" : "CONTRACT";
}
