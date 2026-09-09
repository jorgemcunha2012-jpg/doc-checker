import assert from "node:assert/strict";
import test from "node:test";
import { inspectUpload } from "./upload-validation";

test("aceita arquivo cujo conteúdo corresponde à extensão", () => {
  assert.deepEqual(inspectUpload("reserva.png", "image/png", 4, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 100), { ok: true });
});

test("rejeita conteúdo renomeado para extensão permitida", () => {
  assert.equal(inspectUpload("reserva.pdf", "application/pdf", 4, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 100).ok, false);
});

test("aceita RTF com cabeçalho e tipo MIME compatível", () => {
  const bytes = new TextEncoder().encode("{\\rtf1\\ansi texto}");
  assert.deepEqual(inspectUpload("contrato.rtf", "application/rtf", bytes.length, bytes, 1000), { ok: true });
});
