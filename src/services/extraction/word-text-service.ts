import mammoth from "mammoth";

export async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.replace(/\n{3,}/g, "\n\n").trim();
}
