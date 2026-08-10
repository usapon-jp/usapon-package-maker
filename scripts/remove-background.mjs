import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PNG } from "pngjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const sourcePath = resolve(projectDirectory, "public/assets/usapon-rabbits.png");
const outputPath = resolve(projectDirectory, "public/assets/usapon-rabbits-transparent.png");
const image = PNG.sync.read(readFileSync(sourcePath));
const { data, width, height } = image;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0;
let tail = 0;

function isBackground(index) {
  const pixel = index * 4;
  return data[pixel + 3] === 0 || (data[pixel] >= 238 && data[pixel + 1] >= 238 && data[pixel + 2] >= 238);
}

function enqueue(index) {
  if (index < 0 || index >= visited.length || visited[index] || !isBackground(index)) return;
  visited[index] = 1;
  queue[tail] = index;
  tail += 1;
}

for (let x = 0; x < width; x += 1) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (head < tail) {
  const index = queue[head];
  head += 1;
  const pixel = index * 4;
  const minimumChannel = Math.min(data[pixel], data[pixel + 1], data[pixel + 2]);
  data[pixel + 3] = minimumChannel >= 248 ? 0 : Math.round(data[pixel + 3] * ((248 - minimumChannel) / 10));
  const x = index % width;
  if (x > 0) enqueue(index - 1);
  if (x < width - 1) enqueue(index + 1);
  if (index >= width) enqueue(index - width);
  if (index < width * (height - 1)) enqueue(index + width);
}

writeFileSync(outputPath, PNG.sync.write(image));
console.log(`Created ${outputPath}`);
