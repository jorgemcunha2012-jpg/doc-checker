import { NextResponse } from "next/server";
import type { DevelopmentExtraction } from "@/domain/development";
import { AuthError, requireUser } from "@/lib/auth";
import { audit } from "@/services/process/process-repository";
import { createDevelopment, listDevelopments } from "@/services/development/development-repository";

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

function handleError(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "Não foi possível acessar os empreendimentos." }, { status: 500 });
}
