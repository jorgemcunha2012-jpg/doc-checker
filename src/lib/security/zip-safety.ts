const MAX_ZIP_ENTRIES = 500;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;

export function assertSafeZipArchive(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error("Arquivo compactado inválido.");
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("Arquivo ZIP64 não é aceito para processamento.");
  }
  if (entryCount > MAX_ZIP_ENTRIES) throw new Error("Arquivo compactado excede o limite de 500 entradas.");

  let offset = centralDirectoryOffset;
  let uncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Diretório do arquivo compactado inválido.");
    }
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    if (uncompressedSize === 0xffffffff) throw new Error("Arquivo ZIP64 não é aceito para processamento.");
    uncompressedBytes += uncompressedSize;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error("Arquivo compactado excede o limite de 50 MB após descompactação.");
    }
    offset += 46 + filenameLength + extraLength + commentLength;
  }
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}
