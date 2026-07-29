import { NextResponse } from "next/server";
import { purgeExpiredProcessDocuments } from "@/services/security/document-retention";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Rotina de retenção não configurada." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await purgeExpiredProcessDocuments());
  } catch (error) {
    console.error("[ConferIA] Falha na retenção documental", error);
    return NextResponse.json({ error: "Falha ao executar retenção documental." }, { status: 500 });
  }
}
