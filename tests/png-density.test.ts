import { expect, it } from "vitest";
import { pngWithDpi } from "../src/lib/pdf/png-density";
it("PNGに300dpiの物理解像度を1つだけ設定し、画像データを保つ", async () => {
  // A real 1×1 transparent PNG, including the normal zlib image data.
  const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5AAAAABJRU5ErkJggg=="), (char) => char.charCodeAt(0));
  const output = new Uint8Array(await (await pngWithDpi(await pngWithDpi(new Blob([bytes]), 96), 300)).arrayBuffer());
  const input = new DataView(output.buffer); let physCount = 0;
  for (let offset = 8; offset < output.length;) {
    const length = input.getUint32(offset); const type = String.fromCharCode(...output.slice(offset + 4, offset + 8));
    if (type === "pHYs") { physCount++; expect(input.getUint32(offset + 8)).toBe(11811); expect(input.getUint32(offset + 12)).toBe(11811); expect(output[offset + 16]).toBe(1); }
    if (type === "IDAT") expect([...output.slice(offset + 8, offset + 8 + length)]).toEqual([...bytes.slice(41, 52)]);
    offset += length + 12;
  }
  expect(physCount).toBe(1);
});
