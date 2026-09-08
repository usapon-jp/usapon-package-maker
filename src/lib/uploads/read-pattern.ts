import DOMPurify from "dompurify";

import type { AssetRef, ImageSourceType, UploadedAsset } from "../../app/app-types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svg))}`;
}

function parseLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sanitizeSvg(raw: string): { svg: string; aspectRatio: number } {
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed", "audio", "video"],
  });
  const documentNode = new DOMParser().parseFromString(clean, "image/svg+xml");
  const root = documentNode.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
    throw new Error("SVGの形式を読み取れませんでした。");
  }

  root.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) element.removeAttribute(attribute.name);
      if ((name === "href" || name === "xlink:href") && !value.startsWith("#") && !value.startsWith("data:image/")) {
        element.removeAttribute(attribute.name);
      }
      if (name === "style" && /url\((?!["']?#)/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const viewBoxWidth = viewBox?.length === 4 && viewBox.every(Number.isFinite) ? viewBox[2] : null;
  const viewBoxHeight = viewBox?.length === 4 && viewBox.every(Number.isFinite) ? viewBox[3] : null;
  const width = viewBoxWidth && viewBoxWidth > 0 ? viewBoxWidth : parseLength(root.getAttribute("width"));
  const height = viewBoxHeight && viewBoxHeight > 0 ? viewBoxHeight : parseLength(root.getAttribute("height"));
  const aspectRatio = width && height ? width / height : 1;

  return { svg: new XMLSerializer().serializeToString(root), aspectRatio };
}

async function readPng(file: File): Promise<{ dataUrl: string; aspectRatio: number; blob: Blob }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("PNGを読み取れませんでした。"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  await image.decode();
  const trimmed = await trimTransparentPng(image, dataUrl, file);
  return { dataUrl: trimmed.dataUrl, aspectRatio: trimmed.aspectRatio, blob: trimmed.blob };
}

async function trimTransparentPng(image: HTMLImageElement, dataUrl: string, source: Blob): Promise<{ dataUrl: string; aspectRatio: number; blob: Blob }> {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { dataUrl, aspectRatio: width / height, blob: source };
  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return { dataUrl, aspectRatio: width / height, blob: source };

  // 輪郭に触れる半透明ピクセルを守るため、ほんの少しだけ余白を残す。
  const padding = 2;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(width - 1, right + padding);
  bottom = Math.min(height - 1, bottom + padding);
  const croppedWidth = right - left + 1;
  const croppedHeight = bottom - top + 1;
  if (croppedWidth === width && croppedHeight === height) return { dataUrl, aspectRatio: width / height, blob: source };

  const cropped = document.createElement("canvas");
  cropped.width = croppedWidth;
  cropped.height = croppedHeight;
  cropped.getContext("2d")?.drawImage(canvas, left, top, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
  const croppedDataUrl = cropped.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    cropped.toBlob((result) => result ? resolve(result) : reject(new Error("画像の余白を整えられませんでした。")), "image/png");
  });
  return { dataUrl: croppedDataUrl, aspectRatio: croppedWidth / croppedHeight, blob };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み取れませんでした。"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function readStoredPatternBlob(
  blob: Blob,
  fileName: string,
  sourceType: ImageSourceType,
  id: string,
  assetRef: AssetRef = { kind: "user", assetId: id },
): Promise<UploadedAsset> {
  if (blob.size > MAX_FILE_BYTES) throw new Error("柄ファイルは10MB以下にしてください。");
  if (sourceType === "svg") {
    const { svg, aspectRatio } = sanitizeSvg(await blob.text());
    const cleanBlob = new Blob([svg], { type: "image/svg+xml" });
    return { id, assetRef, fileName, sourceType, dataUrl: svgDataUrl(svg), aspectRatio, blob: cleanBlob };
  }

  const file = new File([blob], fileName, { type: "image/png" });
  const { dataUrl, aspectRatio, blob: trimmedBlob } = await readPng(file);
  return { id, assetRef, fileName, sourceType, dataUrl, aspectRatio, blob: trimmedBlob };
}

export async function readPatternFile(file: File): Promise<UploadedAsset> {
  if (file.size > MAX_FILE_BYTES) throw new Error("柄ファイルは10MB以下にしてください。");
  const svgFile = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  const pngFile = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
  if (!svgFile && !pngFile) throw new Error("PNGまたはSVGファイルを選択してください。");

  if (svgFile) {
    return readStoredPatternBlob(file, file.name, "svg", crypto.randomUUID());
  }

  return readStoredPatternBlob(file, file.name, "png", crypto.randomUUID());
}
