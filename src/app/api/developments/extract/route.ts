import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { KimiProvider } from "@/services/extraction/kimi-provider";
import { renderPdfToJpegDataUrls } from "@/services/extraction/pdf-image-service";

const MAX_SIZE = 20 * 1024 * 1024;
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf") || file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Envie uma matrícula em PDF de até 20 MB." }, { status: 400 });
    }
    const images = await renderPdfToJpegDataUrls(Buffer.from(await file.arrayBuffer()));
    const extraction = await new KimiProvider().extractDevelopment(images);
    if (!extraction.units.length) {
      return NextResponse.json({ error: "A IA não encontrou combinações de torre, unidade e área privativa." }, { status: 422 });
    }
    return NextResponse.json({ extraction, sourceDocumentName: file.name });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao extrair o cadastro." }, { status: 500 });
  }
}
