declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  export default function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
}
