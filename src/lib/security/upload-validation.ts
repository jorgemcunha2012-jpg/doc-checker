export const ACCEPTED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type UploadInspection = { ok: true } | { ok: false; reason: string };

export function inspectUpload(
  fileName: string,
  mimeType: string,
  size: number,
  bytes: Uint8Array,
  maxSize: number,
): UploadInspection {
  const name = fileName.trim().toLowerCase();
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) return { ok: false, reason: "nome inválido" };
  if (size <= 0 || size > maxSize) return { ok: false, reason: "tamanho inválido" };

  const extension = name.slice(name.lastIndexOf("."));
  const signature = detectSignature(bytes);
  const expected = extensionToSignature(extension);
  if (!expected || signature !== expected) return { ok: false, reason: "conteúdo incompatível com a extensão" };
  if (mimeType && !mimeTypeAllowedForExtension(extension, mimeType)) return { ok: false, reason: "tipo MIME incompatível" };
  return { ok: true };
}

function detectSignature(bytes: Uint8Array) {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "zip";
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)) return "tiff";
  const header = new TextDecoder("latin1").decode(bytes).replace(/^\uFEFF/, "");
  if (/^\s*\{\\rtf/i.test(header)) return "rtf";
  return null;
}

function extensionToSignature(extension: string) {
  if (extension === ".pdf") return "pdf";
  if (extension === ".png") return "png";
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  if (extension === ".docx" || extension === ".xlsx") return "zip";
  if (extension === ".rtf") return "rtf";
  if (extension === ".tif" || extension === ".tiff") return "tiff";
  return null;
}

function mimeTypeAllowedForExtension(extension: string, mimeType: string) {
  if (!ACCEPTED_UPLOAD_MIME_TYPES.has(mimeType)) return false;
  if (extension === ".pdf") return mimeType === "application/pdf";
  if (extension === ".png") return mimeType === "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return mimeType === "image/jpeg";
  if (extension === ".docx") return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === ".xlsx") return mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === ".rtf") return mimeType === "application/rtf" || mimeType === "text/rtf";
  return extension === ".tif" || extension === ".tiff" ? mimeType === "image/tiff" : false;
}
