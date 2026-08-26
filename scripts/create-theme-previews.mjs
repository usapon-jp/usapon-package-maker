import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const sourceDir = path.resolve(process.argv[2] ?? "public/assets/stamps");
const outputDir = path.resolve(process.argv[3] ?? "public/assets/theme-previews");
const files = [
  "autumn-rabbit-sweet-potato-car.png",
  "autumn-rabbit-acorn-hug.png",
  "autumn-rabbit-sweet-potato.png",
  "autumn-rabbit-chestnut.png",
  "autumn-rabbit-sleeping-sweet-potato-no-text.png",
];
const canvasWidth = 320;
const canvasHeight = 276;

function blendChannel(base, overlay, alpha) {
  return Math.round(base * (1 - alpha) + overlay * alpha);
}

function createPreview(source) {
  const scale = Math.min(canvasWidth / source.width, canvasHeight / source.height, 1);
  const drawWidth = Math.max(1, Math.round(source.width * scale));
  const drawHeight = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.floor((canvasWidth - drawWidth) / 2);
  const offsetY = Math.floor((canvasHeight - drawHeight) / 2);
  const output = new PNG({ width: canvasWidth, height: canvasHeight, colorType: 6 });

  for (let y = 0; y < drawHeight; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
    for (let x = 0; x < drawWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const outputIndex = ((offsetY + y) * canvasWidth + offsetX + x) * 4;
      output.data.set(source.data.subarray(sourceIndex, sourceIndex + 4), outputIndex);
    }
  }

  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const index = (y * canvasWidth + x) * 4;
      if (output.data[index + 3] === 0) continue;
      const diagonal = ((x + y * 2) % 96 + 96) % 96;
      if (diagonal > 15) continue;
      output.data[index] = blendChannel(output.data[index], 255, 0.3);
      output.data[index + 1] = blendChannel(output.data[index + 1], 250, 0.3);
      output.data[index + 2] = blendChannel(output.data[index + 2], 238, 0.3);
    }
  }

  return output;
}

fs.mkdirSync(outputDir, { recursive: true });
for (const fileName of files) {
  const sourcePath = path.join(sourceDir, fileName);
  if (!fs.existsSync(sourcePath)) throw new Error(`Source asset not found: ${sourcePath}`);
  const source = PNG.sync.read(fs.readFileSync(sourcePath));
  const preview = createPreview(source);
  fs.writeFileSync(path.join(outputDir, fileName), PNG.sync.write(preview, { colorType: 6 }));
}

console.log(`Created ${files.length} protected previews in ${outputDir}`);
