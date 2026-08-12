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

async function readPng(file: File): Promise<{ dataUrl: string; aspectRatio: number }> {
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
  return { dataUrl, aspectRatio: image.naturalWidth / image.naturalHeight };
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
  const { dataUrl, aspectRatio } = await readPng(file);
  return { id, assetRef, fileName, sourceType, dataUrl, aspectRatio, blob: file };
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
