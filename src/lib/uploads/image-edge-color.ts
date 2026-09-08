function hex(value: number) {
  return Math.round(value).toString(16).padStart(2, "0");
}

export function dominantOpaqueEdgeColor(data: Uint8ClampedArray, width: number, height: number) {
  if (width < 1 || height < 1) return null;
  const edge = Math.max(1, Math.round(Math.min(width, height) * 0.12));
  const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= edge && x < width - edge && y >= edge && y < height - edge) continue;
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 220) continue;
      const key = `${data[offset] >> 4}-${data[offset + 1] >> 4}-${data[offset + 2] >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
      bucket.count += 1;
      bucket.red += data[offset];
      bucket.green += data[offset + 1];
      bucket.blue += data[offset + 2];
      buckets.set(key, bucket);
    }
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return null;
  return `#${hex(dominant.red / dominant.count)}${hex(dominant.green / dominant.count)}${hex(dominant.blue / dominant.count)}`;
}

export async function readImageEdgeColor(dataUrl: string) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("画像の色を読み取れませんでした。");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const color = dominantOpaqueEdgeColor(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  if (!color) throw new Error("画像の周囲に背景として使える色がありませんでした。");
  return color;
}
