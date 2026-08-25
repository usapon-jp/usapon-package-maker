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

/**
 * svg2pdf.js cannot reliably paint SVG <pattern> definitions. Render the
 * artwork layer with the browser's SVG engine first and return its canvas.
 * The canvas is added directly to jsPDF instead of being embedded back into
 * SVG, which avoids recursive SVG image processing on memory-limited phones.
 */
async function rasterizeArtworkForPdf(svg: SVGSVGElement) {
  const artworkLayers = [...svg.querySelectorAll<SVGGElement>('[data-layer="artwork"]')];
  if (artworkLayers.length === 0) return null;

  const { width, height } = svgViewBoxSize(svg);
  const renderSource = svg.cloneNode(true) as SVGSVGElement;
  renderSource.querySelectorAll('[data-layer]').forEach((layer) => {
    if (layer.getAttribute("data-layer") !== "artwork") layer.setAttribute("display", "none");
  });
  // The first rect is the white A4 paper. Keeping the PNG transparent outside
  // the box avoids covering the vector line work with an opaque bitmap.
  renderSource.querySelector(':scope > rect')?.remove();
  renderSource.setAttribute("width", `${width}`);
  renderSource.setAttribute("height", `${height}`);

  const image = await loadSvgImage(new XMLSerializer().serializeToString(renderSource));
  const targetPixelsPerMm = ARTWORK_EXPORT_DPI / 25.4;
  const pixelLimitScale = Math.sqrt(MAX_ARTWORK_RASTER_PIXELS / (width * height));
  const pixelsPerMm = Math.min(targetPixelsPerMm, pixelLimitScale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * pixelsPerMm);
  canvas.height = Math.ceil(height * pixelsPerMm);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF用の画像を作成できませんでした。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  artworkLayers.forEach((artwork) => artwork.remove());
  svg.querySelector(':scope > rect')?.remove();
  return canvas;
}

async function prepareDielineForPdf(source: SVGSVGElement, font: opentype.Font) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const artworkCanvas = await rasterizeArtworkForPdf(clone);
  replaceTextWithPaths(clone, font);
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
