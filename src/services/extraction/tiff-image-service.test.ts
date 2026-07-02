import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { convertTiffToPngPages } from "./tiff-image-service";

test("converte TIFF para página PNG utilizável pelo provider visual", async () => {
  const tiff = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: "#ffffff",
    },
  }).tiff().toBuffer();

  const pages = await convertTiffToPngPages(tiff);
  assert.equal(pages.length, 1);
  assert.deepEqual([...pages[0].subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
