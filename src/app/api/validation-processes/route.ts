import { NextResponse } from "next/server";
import { defaultOrganization } from "@/domain/tenant";
import type { UploadedDocument, ValidationType } from "@/domain/validation";
import { createValidationProcessAndWait } from "@/services/process/process-validation";
import type { UploadedDocumentPayload } from "@/services/extraction/types";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Envie os documentos em multipart/form-data." }, { status: 400 });
  }

  const formData = await request.formData();
  const validationType = formData.get("validationType");

  if (validationType !== "MINUTA" && validationType !== "ITBI") {
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

  const documents = await Promise.all(files.map((file) => toUploadedDocumentPayload(file, validationType)));
  const documentValidation = validateComparisonSides(documents);

  if (documentValidation) {
    return NextResponse.json({ error: documentValidation }, { status: 400 });
  }

  const validationProcess = await createValidationProcessAndWait(validationType, documents);

  return NextResponse.json({
    processId: validationProcess.id,
    status: validationProcess.status,
    process: validationProcess,
  });
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

async function toUploadedDocumentPayload(file: File, validationType: ValidationType): Promise<UploadedDocumentPayload> {
  const arrayBuffer = await file.arrayBuffer();
  const metadata: UploadedDocument = {
    id: crypto.randomUUID(),
    organizationId: defaultOrganization.id,
    name: file.name,
    type: resolveDocumentType(file, validationType),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };

  return {
    ...metadata,
    buffer: Buffer.from(arrayBuffer),
  };
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
