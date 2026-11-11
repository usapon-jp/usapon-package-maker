/** Add physical resolution to canvas PNGs (which otherwise advertise 96dpi). */
export async function pngWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) throw new Error("PNG画像の形式を確認できませんでした。");
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4);
  const pixelsPerMetre = Math.round(dpi / 0.0254);
  view.setUint32(8, pixelsPerMetre); view.setUint32(12, pixelsPerMetre); chunk[16] = 1;
  let crc = 0xffffffff;
  for (const value of chunk.slice(4, 17)) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts: Uint8Array<ArrayBuffer>[] = [bytes.slice(0, 8)];
  const input = new DataView(bytes.buffer);
  let inserted = false;
  for (let offset = 8; offset < bytes.length;) {
    const size = input.getUint32(offset) + 12;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type !== "pHYs") parts.push(bytes.slice(offset, offset + size));
    if (type === "IHDR") { parts.push(chunk); inserted = true; }
    offset += size;
  }
  if (!inserted) throw new Error("PNG画像の解像度を設定できませんでした。");
  return new Blob(parts, { type: "image/png" });
}
