import { NextResponse } from "next/server";
import { purgeExpiredProcessDocuments } from "@/services/security/document-retention";
import { logOperationalError } from "@/lib/security/operational-logger";
import { timingSafeEqual } from "node:crypto";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Rotina de retenção não configurada." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const provided = Buffer.from(authorization.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await purgeExpiredProcessDocuments());
  } catch (error) {
    logOperationalError("DOCUMENT_RETENTION_UNEXPECTED", error);
    return NextResponse.json({ error: "Falha ao executar retenção documental." }, { status: 500 });
  }
}
