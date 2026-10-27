import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialState } from "../src/app/app-state";
import { createRepeatingArtwork } from "../src/app/artwork";
import { StationeryTurntable } from "../src/components/common/StationeryTurntable";
import { envelopeFoldParts, foldRotation } from "../src/domain/boxes/finished-envelope";
import { generateDielineDocument } from "../src/domain/boxes/registry";
import type { BoxInput } from "../src/domain/boxes/types";

const render = (type: BoxInput["type"]) => {
  const box = { ...initialState.box, type } as BoxInput;
  const page = generateDielineDocument(box).pages[0];
  return renderToStaticMarkup(<StationeryTurntable state={{ ...initialState, box }} pageId={page.id} geometry={page.geometry} />);
};

describe("便箋・カード・封筒の3D完成イメージ", () => {
  it.each(["kamasu", "diamond"] as const)("%s封筒の各面で繰り返し柄が展開図全体を覆う", (envelopeConstruction) => {
    const box = { ...initialState.box, type: "envelope-v1", widthMm: 162, heightMm: 114, envelopeConstruction } as BoxInput;
    const { geometry } = generateDielineDocument(box).pages[0];
    const artwork = createRepeatingArtwork({ id: "repeat", fileName: "pattern.png", sourceType: "png", dataUrl: "data:image/png;base64,AA==", aspectRatio: 1 }, geometry);
    const html = renderToStaticMarkup(<StationeryTurntable state={{ ...initialState, box, artworkLayers: [artwork] }} pageId="main" geometry={geometry} />);
    // Each SVG shows a different crop of the same net. Percentage lengths use
    // that small viewport and leave parts of the printed net uncovered.
    const fills = [...html.matchAll(/<rect width="([^"]+)" height="([^"]+)" fill="url\(#[^"]+-repeat\)"/g)];
    expect(fills.length).toBe(1 + envelopeFoldParts(geometry).parts.length);
    for (const [, width, height] of fills) {
      expect(Number(width)).toBe(geometry.bounds.widthMm);
      expect(Number(height)).toBe(geometry.bounds.heightMm);
    }
  });
  it.each(["letter-paper-v1", "mini-card-v1"] as const)("%s は表と裏の2面を持ち、ドラッグで回せる", (type) => {
    const html = render(type);
    expect(html).toContain('data-finished-face="front"');
    expect(html).toContain('data-finished-face="back"');
    expect(html).toContain("ドラッグで回せます");
    expect(html).toContain("完成イメージ・斜め");
    expect(html).toContain("finished-turntable-blank");
  });
  it("封筒は展開図の各パーツを折って組み立て、ふたを開け閉めできる", () => {
    const kamasu = render("envelope-v1");
    for (const part of ["front", "envelope-back", "envelope-top-flap"]) expect(kamasu).toContain(`data-fold-part="${part}"`);
    expect(kamasu).toContain("うら（A・C）");
    expect(kamasu).toContain("ふたを開ける");
  });
});

describe("封筒の折りたたみ", () => {
  const geometry = generateDielineDocument({ ...initialState.box, type: "envelope-v1", widthMm: 162, heightMm: 114, glueFlapMm: 12 } as BoxInput).pages[0].geometry;
  it("ふたは表面の上辺、うらは下辺を折り目にして、ふたが一番上に重なる", () => {
    const { front, parts } = envelopeFoldParts(geometry);
    const flap = parts.find(p => p.isFlap)!, back = parts.find(p => !p.isFlap)!;
    expect(flap.edge).toBe("top");
    expect(flap.hinge).toBe(front.y);
    expect(back.edge).toBe("bottom");
    expect(back.hinge).toBe(front.y + front.height);
    expect(flap.layer).toBeGreaterThan(back.layer);
  });
  it("折り返す向きは辺ごとに表面の裏側へ向かう", () => {
    expect(foldRotation("top", 180)).toBe("rotateX(180deg)");
    expect(foldRotation("bottom", 180)).toBe("rotateX(-180deg)");
    expect(foldRotation("left", 180)).toBe("rotateY(-180deg)");
    expect(foldRotation("right", 180)).toBe("rotateY(180deg)");
  });
});
