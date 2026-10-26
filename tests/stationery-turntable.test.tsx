import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialState } from "../src/app/app-state";
import { StationeryTurntable } from "../src/components/common/StationeryTurntable";
import { envelopeFoldParts, foldRotation } from "../src/domain/boxes/finished-envelope";
import { generateDielineDocument } from "../src/domain/boxes/registry";
import type { BoxInput } from "../src/domain/boxes/types";

const render = (type: BoxInput["type"], envelopeConstruction?: "diamond" | "kamasu") => {
  const box = { ...initialState.box, type, envelopeConstruction } as BoxInput;
  const page = generateDielineDocument(box).pages[0];
  return renderToStaticMarkup(<StationeryTurntable state={{ ...initialState, box }} pageId={page.id} geometry={page.geometry} />);
};

describe("便箋・カード・封筒の3D完成イメージ", () => {
  it.each(["letter-paper-v1", "mini-card-v1"] as const)("%s は表と裏の2面を持ち、ドラッグで回せる", (type) => {
    const html = render(type);
    expect(html).toContain('data-finished-face="front"');
    expect(html).toContain('data-finished-face="back"');
    expect(html).toContain("ドラッグで回せます");
    expect(html).toContain("完成イメージ・斜め");
    expect(html).toContain("finished-turntable-blank");
  });
  it("封筒は展開図の各パーツを折って組み立て、ふたを開け閉めできる", () => {
    const kamasu = render("envelope-v1", "kamasu");
    for (const part of ["front", "envelope-back", "envelope-top-flap"]) expect(kamasu).toContain(`data-fold-part="${part}"`);
    expect(kamasu).toContain("うら（A・C）");
    expect(kamasu).toContain("ふたを開ける");
    const diamond = render("envelope-v1", "diamond");
    for (const part of ["front", "envelope-left-flap", "envelope-right-flap", "envelope-bottom-flap", "envelope-top-flap"]) expect(diamond).toContain(`data-fold-part="${part}"`);
  });
});

describe("封筒の折りたたみ", () => {
  const geometry = (envelopeConstruction: "diamond" | "kamasu") => generateDielineDocument({ ...initialState.box, type: "envelope-v1", widthMm: 162, heightMm: 114, glueFlapMm: 12, envelopeConstruction } as BoxInput).pages[0].geometry;
  it("ふたは表面の上辺、のこりは下辺・左右辺を折り目にして、ふたが一番上に重なる", () => {
    for (const construction of ["kamasu", "diamond"] as const) {
      const { front, parts } = envelopeFoldParts(geometry(construction));
      const flap = parts.find(p => p.isFlap)!;
      expect(flap.edge).toBe("top");
      expect(flap.hinge).toBe(front.y);
      expect(Math.max(...parts.map(p => p.layer))).toBe(flap.layer);
      for (const part of parts) {
        if (part.edge === "bottom") expect(part.hinge).toBe(front.y + front.height);
        if (part.edge === "left") expect(part.hinge).toBe(front.x);
        if (part.edge === "right") expect(part.hinge).toBe(front.x + front.width);
      }
    }
  });
  it("折り返す向きは辺ごとに表面の裏側へ向かう", () => {
    expect(foldRotation("top", 180)).toBe("rotateX(180deg)");
    expect(foldRotation("bottom", 180)).toBe("rotateX(-180deg)");
    expect(foldRotation("left", 180)).toBe("rotateY(-180deg)");
    expect(foldRotation("right", 180)).toBe("rotateY(180deg)");
  });
});
