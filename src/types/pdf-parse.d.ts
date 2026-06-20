declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  export class PDFParse {
    constructor(options: { data: Buffer });
    getText(): Promise<PdfParseResult>;
    getScreenshot(options?: {
      first?: number;
      desiredWidth?: number;
      imageBuffer?: boolean;
      imageDataUrl?: boolean;
    }): Promise<{ pages: Array<{ data: Uint8Array }> }>;
    destroy(): Promise<void>;
  }
}
