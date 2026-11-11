import { pngWithDpi } from "./png-density";
import { jsPDF } from "jspdf";
import opentype from "opentype.js";
import "svg2pdf.js";

import type { A4FitResult } from "../../domain/paper/a4";

let fontPromise: Promise<opentype.Font> | null = null;

export const PDF_POINTS_PER_MM = 72 / 25.4;

export function mmToPdfPoints(valueMm: number) {
  return valueMm * PDF_POINTS_PER_MM;
}

function loadJapaneseFont(): Promise<opentype.Font> {
  if (!fontPromise) {
    fontPromise = fetch(`${import.meta.env.BASE_URL}fonts/NotoSansJP-Regular.otf`)
      .then((response) => {
        if (!response.ok) throw new Error("日本語フォントを読み込めませんでした。");
        return response.arrayBuffer();
      })
      .then((buffer) => opentype.parse(buffer));
  }
  return fontPromise;
}

function numericAttribute(element: Element, name: string, fallback: number): number {
  const value = Number.parseFloat(element.getAttribute(name) ?? "");
  return Number.isFinite(value) ? value : fallback;
}

function replaceTextWithPaths(svg: SVGSVGElement, font: opentype.Font) {
  svg.querySelectorAll("text").forEach((textElement) => {
    const content = textElement.getAttribute("data-export-text") ?? textElement.textContent ?? "";
    if (!content) {
      textElement.remove();
      return;
    }
    const fontSize = numericAttribute(textElement, "font-size", 4);
    const x = numericAttribute(textElement, "x", 0);
    const y = numericAttribute(textElement, "y", 0);
    const anchor = textElement.getAttribute("text-anchor") ?? "start";
    const dominantBaseline = textElement.getAttribute("dominant-baseline");
    const width = font.getAdvanceWidth(content, fontSize);
    const startX = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    const baselineY = dominantBaseline === "middle" ? y + fontSize * 0.35 : y;
    const pathData = font.getPath(content, startX, baselineY, fontSize).toPathData(3);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", textElement.getAttribute("fill") ?? "#222222");
    const transform = textElement.getAttribute("transform");
    if (transform) path.setAttribute("transform", transform);
    path.setAttribute("data-text-as-path", content);
    textElement.replaceWith(path);
  });
}

const ARTWORK_EXPORT_DPI = 200;
const MAX_ARTWORK_RASTER_PIXELS = 3_000_000;

function svgViewBoxSize(svg: SVGSVGElement) {
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width > 0 && viewBox.height > 0) return { width: viewBox.width, height: viewBox.height };
  return {
    width: numericAttribute(svg, "width", 210),
    height: numericAttribute(svg, "height", 297),
  };
}

function loadSvgImage(svgMarkup: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("模様をPDF用の画像に変換できませんでした。"));
    };
    image.src = url;
  });
}

/** Embed blob/remote images before serializing SVG: an SVG loaded as an image
 * cannot fetch those resources. Reject failed loads instead of saving missing art. */
export async function embedPdfImages(svg: SVGSVGElement) {
  const cache = new Map<string, Promise<string>>();
  await Promise.all([...svg.querySelectorAll("image")].map(async (element) => {
    const href = element.getAttribute("href") ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (!href || href.startsWith("data:")) return;
    if (!cache.has(href)) cache.set(href, (async () => {
      const response = await fetch(href);
      if (!response.ok) throw new Error("PDFに使う画像を読み込めませんでした。画像を入れ直してください。");
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("PDF用の画像を埋め込めませんでした。"));
        reader.readAsDataURL(blob);
      });
    })());
    element.setAttribute("href", await cache.get(href)!);
    element.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
  }));
}

// Render the complete design in its original stacking order. Frames, patterns,
// PNG stamps and text then match the browser; cut/fold lines remain vectors.
async function rasterizeArtworkForPdf(svg: SVGSVGElement) {
  const { width, height } = svgViewBoxSize(svg);
  const renderSource = svg.cloneNode(true) as SVGSVGElement;
  const vectorSelector = '[data-layer="cut"], [data-layer="fold"], [data-layer="foldover"], [data-letter-sheet-center-cut]';
  renderSource.querySelectorAll(`${vectorSelector}, [data-layer="text"]`).forEach((layer) => layer.remove());
  renderSource.setAttribute("width", `${width}`);
  renderSource.setAttribute("height", `${height}`);
  await embedPdfImages(renderSource);
  const image = await loadSvgImage(new XMLSerializer().serializeToString(renderSource));
  const pixelsPerMm = Math.min(ARTWORK_EXPORT_DPI / 25.4, Math.sqrt(MAX_ARTWORK_RASTER_PIXELS / (width * height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * pixelsPerMm);
  canvas.height = Math.ceil(height * pixelsPerMm);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF用の画像を作成できませんでした。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const retainVectors = (parent: Element) => {
    [...parent.children].forEach((child) => {
      if (child.tagName.toLowerCase() === "defs" || child.matches(`${vectorSelector}, [data-layer="text"]`)) return;
      if (child.querySelector(`${vectorSelector}, [data-layer="text"]`)) retainVectors(child);
      else child.remove();
    });
  };
  retainVectors(svg);
  return canvas;
}

async function prepareDielineForPdf(source: SVGSVGElement, font: opentype.Font) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  replaceTextWithPaths(clone, font);
  const artworkCanvas = await rasterizeArtworkForPdf(clone);
  return { vectorSvg: clone, artworkCanvas };
}

function cloneVectorForPdf(source: SVGSVGElement, font: opentype.Font) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  replaceTextWithPaths(clone, font);
  return clone;
}

export async function exportA4Pdf(options: {
  pages: Array<{ svg: SVGSVGElement; fit: A4FitResult }>;
  calibrationSvg?: SVGSVGElement | null;
}) {
  if (options.pages.length === 0) {
    throw new Error("PDFへ出力する展開図がありません。");
  }
  if (options.pages.some(({ fit }) => fit.status === "overflow")) {
    throw new Error("A4に収まらない展開図は縮小せず、PDF出力を停止します。");
  }
  const font = await loadJapaneseFont();
  const firstFit = options.pages[0].fit;
  const orientation = firstFit.orientation === "landscape" ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: [mmToPdfPoints(firstFit.pageWidthMm), mmToPdfPoints(firstFit.pageHeightMm)],
    compress: true,
    putOnlyUsedFonts: true,
  });

  for (const [index, page] of options.pages.entries()) {
    const pageWidthPt = mmToPdfPoints(page.fit.pageWidthMm);
    const pageHeightPt = mmToPdfPoints(page.fit.pageHeightMm);
    if (index > 0) {
      pdf.addPage([pageWidthPt, pageHeightPt], page.fit.orientation === "landscape" ? "landscape" : "portrait");
    }
    const { vectorSvg, artworkCanvas } = await prepareDielineForPdf(page.svg, font);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidthPt, pageHeightPt, "F");
    if (artworkCanvas) {
      pdf.addImage(artworkCanvas, "JPEG", 0, 0, pageWidthPt, pageHeightPt, undefined, "FAST");
    }
    await pdf.svg(vectorSvg, {
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
    });
  }

  if (options.calibrationSvg) {
    const calibration = cloneVectorForPdf(options.calibrationSvg, font);
    const calibrationWidthPt = mmToPdfPoints(210);
    const calibrationHeightPt = mmToPdfPoints(297);
    pdf.addPage([calibrationWidthPt, calibrationHeightPt], "portrait");
    await pdf.svg(calibration, { x: 0, y: 0, width: calibrationWidthPt, height: calibrationHeightPt });
  }

  const blob = pdf.output("blob");
  return {
    blob,
    byteLength: blob.size,
    pageCount: options.pages.length + (options.calibrationSvg ? 1 : 0),
  };
}

/** Card and A4 PNG use the same SVG and font outlines as the PDF. */
export async function exportSvgPng(source: SVGSVGElement, dpi = 300): Promise<Blob> {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  replaceTextWithPaths(clone, await loadJapaneseFont());
  await embedPdfImages(clone);
  const { width, height } = svgViewBoxSize(clone);
  clone.setAttribute("width", String(width)); clone.setAttribute("height", String(height));
  const image = await loadSvgImage(new XMLSerializer().serializeToString(clone));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpi / 25.4); canvas.height = Math.round(height * dpi / 25.4);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像保存用のキャンバスを作成できませんでした。");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG画像を作成できませんでした。")), "image/png"));
  return pngWithDpi(png, dpi);
}
