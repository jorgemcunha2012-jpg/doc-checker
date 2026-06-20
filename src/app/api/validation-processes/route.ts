import { NextResponse } from "next/server";
import { defaultOrganization } from "@/domain/tenant";
import type { UploadedDocument, ValidationType } from "@/domain/validation";
import { createValidationProcess } from "@/services/process/process-validation";
import type { UploadedDocumentPayload } from "@/services/extraction/types";

export async function POST(request: Request) {
  const formData = await request.formData();
  const validationType = formData.get("validationType");

  if (validationType !== "MINUTA" && validationType !== "ITBI") {
    return NextResponse.json({ error: "Tipo de validação inválido." }, { status: 400 });
  }

  const files = formData.getAll("documents").filter((item): item is File => item instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "Envie ao menos um documento." }, { status: 400 });
  }

  const documents = await Promise.all(files.map((file) => toUploadedDocumentPayload(file, validationType)));
  const process = createValidationProcess(validationType, documents);

  return NextResponse.json({ processId: process.id, status: process.status });
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
