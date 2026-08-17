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

const ARTWORK_EXPORT_DPI = 300;

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
 * svg2pdf.js cannot reliably paint SVG <pattern> definitions.  Render the
 * artwork layer with the browser's SVG engine first, then embed that one
 * layer as a print-resolution PNG. Dielines, labels, and text remain vector.
 */
async function rasterizeArtworkForPdf(svg: SVGSVGElement) {
  const artwork = svg.querySelector<SVGGElement>('[data-layer="artwork"]');
  if (!artwork) return;

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
  const pixelsPerMm = ARTWORK_EXPORT_DPI / 25.4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * pixelsPerMm);
  canvas.height = Math.ceil(height * pixelsPerMm);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF用の画像を作成できませんでした。");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const raster = document.createElementNS("http://www.w3.org/2000/svg", "image");
  raster.setAttribute("x", "0");
  raster.setAttribute("y", "0");
  raster.setAttribute("width", `${width}`);
  raster.setAttribute("height", `${height}`);
  raster.setAttribute("preserveAspectRatio", "none");
  raster.setAttribute("href", canvas.toDataURL("image/png"));
  raster.setAttribute("data-rasterized-artwork", "true");
  const paper = svg.querySelector(':scope > rect');
  svg.insertBefore(raster, paper?.nextSibling ?? svg.firstChild);
  artwork.remove();
}

async function cloneForPdf(source: SVGSVGElement, font: opentype.Font) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  await rasterizeArtworkForPdf(clone);
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
    const dieline = await cloneForPdf(page.svg, font);
    await pdf.svg(dieline, {
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
    });
  }

  if (options.calibrationSvg) {
    const calibration = await cloneForPdf(options.calibrationSvg, font);
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

export function downloadPdfBlob(blob: Blob, fileName = "usapon-package-a4.pdf") {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
}
