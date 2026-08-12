import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialState } from "../src/app/app-state";
import { createDotPattern, createStamp, createUploadedArtwork } from "../src/app/artwork";
import type { TextItem, UploadedAsset } from "../src/app/app-types";
import { A4ExportSvg, A4PreviewSvg } from "../src/components/dieline/A4ExportSvg";
import { generateStraightTuckCarton } from "../src/domain/boxes/straight-tuck-carton";
import { generateTwoPieceGiftBox } from "../src/domain/boxes/two-piece-gift-box";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const geometry = generateStraightTuckCarton(initialState.box);
const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);
const asset: UploadedAsset = {
  id: "shared-asset",
  fileName: "shared.svg",
  sourceType: "svg",
  dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
  aspectRatio: 2,
};
const dots = {
  ...createDotPattern("dots-shared", 1),
  dotDiameterMm: 8,
  spacingMm: 24,
  offsetXmm: 3,
  offsetYmm: 7,
};
const image = {
  ...createUploadedArtwork(asset, geometry),
  widthMm: 42,
  offsetXmm: 55,
  offsetYmm: 66,
  rotationDeg: 270 as const,
};
const stamp = {
  ...createStamp({ ...asset, id: "shared-stamp" }, geometry, "共有スタンプ"),
  xMm: 44,
  yMm: 58,
  widthMm: 36,
  rotationDeg: 90 as const,
};
const text: TextItem = {
  id: "shared-text",
  kind: "text",
  pageId: "main",
  text: "ありがとう",
  xMm: 50,
  yMm: 60,
  fontSizeMm: 6,
  color: "#55443f",
};
const props = {
  pageId: "main",
  geometry,
  fit,
  backgroundColor: initialState.backgroundColors.main,
  artworkLayers: [dots, image],
  stamps: [stamp],
  texts: [text],
  lineColors: initialState.lineColors,
};

describe("A4 Web/PDF SVG source", () => {
  it("WebプレビューとPDF生成に同じmm基準SVGを使う", () => {
    const preview = renderToStaticMarkup(<A4PreviewSvg {...props} />);
    const pdfSource = renderToStaticMarkup(<A4ExportSvg {...props} />);

    expect(A4PreviewSvg).toBe(A4ExportSvg);
    expect(preview).toBe(pdfSource);
    expect(preview).toContain(`width="${fit.pageWidthMm}mm"`);
    expect(preview).toContain(`height="${fit.pageHeightMm}mm"`);
    expect(preview).toContain(`viewBox="0 0 ${fit.pageWidthMm} ${fit.pageHeightMm}"`);
    expect(preview).toContain('data-coordinate-unit="mm"');
  });

  it("柄サイズ・位置・リピート間隔をmm座標のままSVGへ出す", () => {
    const markup = renderToStaticMarkup(<A4ExportSvg {...props} />);

    expect(markup).toContain('x="3" y="7" width="24" height="48"');
    expect(markup).toContain('patternUnits="userSpaceOnUse"');
    expect(markup).toContain('patternContentUnits="userSpaceOnUse"');
    expect(markup).toContain('cx="6" cy="12" r="4"');
    expect(markup).toContain('cx="18" cy="36" r="4"');
    expect(markup).toContain('transform="translate(55 66) rotate(270)"');
    expect(markup).toContain('transform="translate(44 58) rotate(90)"');
    expect(markup).toContain('data-text-id="shared-text" x="50" y="60"');
    expect(markup).toContain('font-size="6"');
  });

  it("折り返し補助線だけをレビューとPDF元SVGから外せる", () => {
    const foldoverGeometry = generateTwoPieceGiftBox({
      ...initialState.box,
      type: "two-piece-gift-box-v1",
      widthMm: 100,
      heightMm: 75,
      depthMm: 40,
      foldoverMm: 25,
    }).pages[1].geometry;
    const foldoverFit = evaluateA4Fit(foldoverGeometry.bounds.widthMm, foldoverGeometry.bounds.heightMm);
    const foldoverProps = {
      ...props,
      pageId: "base",
      geometry: foldoverGeometry,
      fit: foldoverFit,
      artworkLayers: [],
      stamps: [],
      texts: [],
    };

    const withFoldover = renderToStaticMarkup(<A4PreviewSvg {...foldoverProps} includeFoldoverLines />);
    const withoutFoldoverPreview = renderToStaticMarkup(<A4PreviewSvg {...foldoverProps} includeFoldoverLines={false} />);
    const withoutFoldoverPdf = renderToStaticMarkup(<A4ExportSvg {...foldoverProps} includeFoldoverLines={false} />);

    expect(withFoldover).toContain('data-layer="foldover"');
    expect(withFoldover).toContain('stroke-width="0.4"');
    expect(withFoldover).toContain('stroke-dasharray="2 1.25"');
    expect(withoutFoldoverPreview).not.toContain('data-layer="foldover"');
    expect(withoutFoldoverPreview).toContain('data-layer="fold"');
    expect(withoutFoldoverPreview).toContain('data-layer="cut"');
    expect(withoutFoldoverPreview).toBe(withoutFoldoverPdf);
  });
});
