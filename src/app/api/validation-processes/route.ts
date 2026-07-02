import { NextResponse } from "next/server";
import { after } from "next/server";
import { defaultOrganization } from "@/domain/tenant";
import { activeDocumentSources, type DocumentSource, type UploadedDocument, type ValidationType } from "@/domain/validation";
import { createValidationProcessAndStart } from "@/services/process/process-validation";
import type { UploadedDocumentPayload } from "@/services/extraction/types";
import { requireUser, AuthError } from "@/lib/auth";
import { developmentUnitValues } from "@/domain/development";
import { getDevelopmentUnit } from "@/services/development/development-repository";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);

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

  const invalidFile = files.find((file) => !isAcceptedFile(file));

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

function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase();
  const mimeType = file.type || "application/octet-stream";
  const acceptedExtension = name.endsWith(".pdf") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");

  return file.size <= MAX_FILE_SIZE_BYTES && (ACCEPTED_MIME_TYPES.has(mimeType) || acceptedExtension);
}

function validateComparisonSides(documents: UploadedDocumentPayload[]) {
  const hasSource = documents.some((document) => document.type === "PRINT" || document.type === "IMAGE");
  const hasTarget = documents.some((document) => document.type === "PDF" || document.type === "CONTRACT" || document.type === "ITBI_GUIDE" || document.type === "COMPLEMENTARY");

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
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    source,
  };

  return {
    ...metadata,
    buffer: Buffer.from(arrayBuffer),
  };
}

function parseDocumentSources(value: FormDataEntryValue | null, expectedLength: number) {
  if (typeof value !== "string") return null;
  try {
    const sources = JSON.parse(value) as unknown;
    if (
      !Array.isArray(sources) ||
      sources.length !== expectedLength ||
      !sources.every((source): source is DocumentSource => activeDocumentSources.includes(source as DocumentSource))
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
    return "IMAGE";
  }

  if (file.type.includes("pdf") || name.endsWith(".pdf")) {
    return validationType === "MINUTA" ? "CONTRACT" : "PDF";
  }

  return validationType === "ITBI" ? "COMPLEMENTARY" : "CONTRACT";
}
