import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialState } from "../src/app/app-state";
import { createDotPattern, createStamp, createStripePattern, createUploadedArtwork } from "../src/app/artwork";
import type { TextItem, UploadedAsset } from "../src/app/app-types";
import { A4ExportSvg } from "../src/components/dieline/A4ExportSvg";
import { DielineSvg } from "../src/components/dieline/DielineSvg";
import { generateStraightTuckCarton } from "../src/domain/boxes/straight-tuck-carton";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const geometry = generateStraightTuckCarton(initialState.box);
const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);
const asset: UploadedAsset = {
  id: "asset-1",
  fileName: "sample.svg",
  sourceType: "svg",
  dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
  aspectRatio: 2,
};

describe("背景・柄・スタンプのSVG描画", () => {
  it("背景色、柄設定、画像回転をA4出力SVGへ反映する", () => {
    const stripe = { ...createStripePattern("stripe-1", 1), color: "#c9b080", stripeWidthMm: 6, gapMm: 4, angleDeg: 135 as const, opacity: 0.5 };
    const dots = { ...createDotPattern("dots-1", 1), color: "#f2cc55", dotDiameterMm: 10, spacingMm: 26, offsetXmm: 3, offsetYmm: 7 };
    const image = { ...createUploadedArtwork(asset, geometry), rotationDeg: 270 as const, widthMm: 42, offsetXmm: 55, offsetYmm: 66 };
    const markup = renderToStaticMarkup(
      <A4ExportSvg
        geometry={geometry}
        fit={fit}
        backgroundColor="#faf7ef"
        artworkLayers={[stripe, dots, image]}
        stamps={[]}
        texts={[]}
        lineColors={initialState.lineColors}
      />,
    );

    expect(markup).toContain('fill="#faf7ef"');
    expect(markup).toContain('fill="#c9b080"');
    expect(markup).toContain('patternTransform="translate(0 0) rotate(135)"');
    expect(markup).toContain('opacity="0.5"');
    expect(markup).toContain('fill="#f2cc55"');
    expect(markup).toContain('r="5"');
    expect(markup).toContain('width="26" height="52"');
    expect(markup).toContain('<circle cx="6.5" cy="13" r="5" fill="#f2cc55"></circle>');
    expect(markup).toContain('<circle cx="19.5" cy="39" r="5" fill="#f2cc55"></circle>');
    expect(markup).toContain('transform="translate(55 66) rotate(270)"');
  });

  it("スタンプとテキストを箱形状でクリップし、固定の重なり順で描画する", () => {
    const stamp = { ...createStamp({ ...asset, id: "stamp-1" }, geometry, "Pofumofu friends"), xMm: 44, yMm: 58, widthMm: 36, rotationDeg: 90 as const, opacity: 0.7 };
    const text: TextItem = { id: "text-1", kind: "text", text: "ありがとう", xMm: 50, yMm: 60, fontSizeMm: 6, color: "#55443f" };
    const markup = renderToStaticMarkup(
      <A4ExportSvg
        geometry={geometry}
        fit={fit}
        backgroundColor={initialState.backgroundColor}
        artworkLayers={[createDotPattern("dots-1", 1)]}
        stamps={[stamp]}
        texts={[text]}
        lineColors={initialState.lineColors}
      />,
    );

    expect(markup).toContain('data-stamp-id="stamp-1"');
    expect(markup).toContain('transform="translate(44 58) rotate(90)"');
    expect(markup.match(/clip-path=/g)?.length).toBeGreaterThanOrEqual(3);

    const artworkIndex = markup.indexOf('data-layer="artwork"');
    const stampIndex = markup.indexOf('data-layer="stamp"');
    const textIndex = markup.indexOf('data-layer="text"');
    const glueIndex = markup.indexOf('data-layer="glue"');
    const foldIndex = markup.indexOf('data-layer="fold"');
    const cutIndex = markup.indexOf('data-layer="cut"');
    expect([artworkIndex, stampIndex, textIndex, glueIndex, foldIndex, cutIndex].every((index) => index >= 0)).toBe(true);
    expect(artworkIndex).toBeLessThan(stampIndex);
    expect(stampIndex).toBeLessThan(textIndex);
    expect(textIndex).toBeLessThan(glueIndex);
    expect(glueIndex).toBeLessThan(foldIndex);
    expect(foldIndex).toBeLessThan(cutIndex);
  });

  it("選択中スタンプの右上に回転ハンドルを表示し、PDFには含めない", () => {
    const stamp = { ...createStamp({ ...asset, id: "stamp-rotate" }, geometry, "Pofumofu friends"), rotationDeg: 90 as const };
    const preview = renderToStaticMarkup(
      <DielineSvg
        geometry={geometry}
        backgroundColor={initialState.backgroundColor}
        artworkLayers={[]}
        stamps={[stamp]}
        texts={[]}
        lineColors={initialState.lineColors}
        showGuides={false}
        selectedArtworkId={null}
        selectedStampId={stamp.id}
        selectedTextId={null}
        exportMode={false}
        onSelectArtwork={() => undefined}
        onMoveArtwork={() => undefined}
        onSelectStamp={() => undefined}
        onMoveStamp={() => undefined}
        onRotateStamp={() => undefined}
        onSelectText={() => undefined}
        onMoveText={() => undefined}
      />,
    );
    const pdf = renderToStaticMarkup(
      <A4ExportSvg
        geometry={geometry}
        fit={fit}
        backgroundColor={initialState.backgroundColor}
        artworkLayers={[]}
        stamps={[stamp]}
        texts={[]}
        lineColors={initialState.lineColors}
      />,
    );

    expect(preview).toContain(`data-stamp-rotate-handle="${stamp.id}"`);
    expect(preview).toContain('aria-label="Pofumofu friendsを90度回転"');
    expect(preview).toMatch(/data-stamp-rotate-handle="stamp-rotate"[\s\S]*?transform="[^"]*rotate\(-90\)"/);
    expect(pdf).not.toContain("data-stamp-rotate-handle");
  });
});
