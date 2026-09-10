import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { assertSafeZipArchive } from "./zip-safety";

test("aceita arquivo compactado dentro dos limites", async () => {
  const zip = new JSZip();
  zip.file("word/document.xml", "conteúdo");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  assert.doesNotThrow(() => assertSafeZipArchive(buffer));
});

test("rejeita pacote com entradas demais", async () => {
  const zip = new JSZip();
  for (let index = 0; index < 501; index += 1) zip.file(`items/${index}.txt`, "x");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  assert.throws(() => assertSafeZipArchive(buffer), /500 entradas/);
});
