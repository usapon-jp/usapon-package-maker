import { jsPDF } from "jspdf";
import opentype from "opentype.js";
import "svg2pdf.js";

import type { A4FitResult } from "../../domain/paper/a4";

let fontPromise: Promise<opentype.Font> | null = null;

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

async function cloneForPdf(source: SVGSVGElement, font: opentype.Font) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  replaceTextWithPaths(clone, font);
  return clone;
}

export async function exportA4Pdf(options: {
  dielineSvg: SVGSVGElement;
  calibrationSvg?: SVGSVGElement | null;
  fit: A4FitResult;
  fileName?: string;
}) {
  if (options.fit.status === "overflow") {
    throw new Error("A4に収まらない展開図は縮小せず、PDF出力を停止します。");
  }
  const font = await loadJapaneseFont();
  const dieline = await cloneForPdf(options.dielineSvg, font);
  const orientation = options.fit.orientation === "landscape" ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
    hotfixes: ["px_scaling"],
  });

  await pdf.svg(dieline, {
    x: 0,
    y: 0,
    width: options.fit.pageWidthMm,
    height: options.fit.pageHeightMm,
  });

  if (options.calibrationSvg) {
    const calibration = await cloneForPdf(options.calibrationSvg, font);
    pdf.addPage("a4", "portrait");
    await pdf.svg(calibration, { x: 0, y: 0, width: 210, height: 297 });
  }

  const blob = pdf.output("blob");
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = options.fileName ?? "usapon-package-a4.pdf";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);

  return {
    byteLength: blob.size,
    pageCount: options.calibrationSvg ? 2 : 1,
  };
}
