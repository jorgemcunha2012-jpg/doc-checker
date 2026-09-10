import { NextResponse } from "next/server";
import type { DevelopmentExtraction } from "@/domain/development";
import { AuthError, requireAdmin, requireUser } from "@/lib/auth";
import { audit } from "@/services/process/process-repository";
import { createDevelopment, deleteDevelopment, listDevelopments, updateDevelopment } from "@/services/development/development-repository";
import { developmentCreateSchema, developmentDeleteSchema, developmentUpdateSchema, jsonBodyErrorResponse, readJsonBody } from "@/lib/security/json-body";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ developments: await listDevelopments(user.organizationId) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody(request, developmentCreateSchema) as { sourceDocumentName: string; extraction: DevelopmentExtraction };
    const development = await createDevelopment(user.organizationId, body.sourceDocumentName, body.extraction);
    await audit(user, "DEVELOPMENT_CREATED", "development", development.id, {
      name: development.name,
      units: development.units.length,
      sourceDocumentName: development.sourceDocumentName,
    });
    return NextResponse.json({ development }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await readJsonBody(request, developmentDeleteSchema);
    const deleted = await deleteDevelopment(user.organizationId, body.id);
    if (!deleted) return NextResponse.json({ error: "Empreendimento não encontrado." }, { status: 404 });
    await audit(user, "DEVELOPMENT_DELETED", "development", body.id, {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody(request, developmentUpdateSchema) as { id: string; sourceDocumentName: string; extraction: DevelopmentExtraction };
    const development = await updateDevelopment(user.organizationId, body.id, body.sourceDocumentName ?? "", body.extraction);
    if (!development) return NextResponse.json({ error: "Empreendimento não encontrado." }, { status: 404 });
    await audit(user, "DEVELOPMENT_UPDATED", "development", development.id, {
      name: development.name,
      units: development.units.length,
      sourceDocumentName: development.sourceDocumentName,
    });
    return NextResponse.json({ development });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  const bodyError = jsonBodyErrorResponse(error);
  if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Não foi possível acessar os empreendimentos." }, { status: 500 });
}
