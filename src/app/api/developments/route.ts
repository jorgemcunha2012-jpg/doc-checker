import { NextResponse } from "next/server";
import type { DevelopmentExtraction } from "@/domain/development";
import { AuthError, requireAdmin, requireUser } from "@/lib/auth";
import { audit } from "@/services/process/process-repository";
import { createDevelopment, deleteDevelopment, listDevelopments, updateDevelopment } from "@/services/development/development-repository";

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
    const body = await request.json() as { sourceDocumentName?: string; extraction?: DevelopmentExtraction };
    if (!body.sourceDocumentName || !body.extraction?.name || !body.extraction.units?.length) {
      return NextResponse.json({ error: "Revise o nome e inclua ao menos uma unidade." }, { status: 400 });
    }
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
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "Empreendimento não informado." }, { status: 400 });
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
    const body = await request.json() as { id?: string; sourceDocumentName?: string; extraction?: DevelopmentExtraction };
    if (!body.id || !body.extraction?.name || !body.extraction.units?.length) {
      return NextResponse.json({ error: "Informe o empreendimento e ao menos uma unidade." }, { status: 400 });
    }
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
  console.error(error);
  return NextResponse.json({ error: "Não foi possível acessar os empreendimentos." }, { status: 500 });
}
