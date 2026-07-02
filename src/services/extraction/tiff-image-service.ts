import sharp from "sharp";

export async function convertTiffToPngPages(buffer: Buffer, maxPages = 12) {
  const metadata = await sharp(buffer, { pages: -1 }).metadata();
  const pageCount = Math.min(metadata.pages ?? 1, maxPages);
  return Promise.all(
    Array.from({ length: pageCount }, async (_, page) =>
      sharp(buffer, { page })
        .resize({ width: 1800, withoutEnlargement: true })
        .png({ compressionLevel: 8 })
        .toBuffer(),
    ),
  );
}
