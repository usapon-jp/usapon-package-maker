import { describe, expect, it } from "vitest";

import { generateDielineDocument } from "../src/domain/boxes/registry";
import { generateTwoPieceGiftBox } from "../src/domain/boxes/two-piece-gift-box";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const input = {
  type: "two-piece-gift-box-v1" as const,
  widthMm: 100,
  heightMm: 75,
  depthMm: 40,
  paperThicknessMm: 0.4,
  glueFlapMm: 12,
  lidDepthMm: 40,
  lidClearanceMm: 0.6,
  foldoverMm: 25,
};

describe("two-piece-gift-box-v1", () => {
  it("蓋、本体の順にA4横2ページの展開図を生成する", () => {
    const document = generateTwoPieceGiftBox(input);
    const [lid, base] = document.pages;

    expect(document.pages.map((page) => page.id)).toEqual(["lid", "base"]);
    expect(lid.geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 232, heightMm: 207 });
    expect(base.geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 230, heightMm: 205 });
    for (const page of document.pages) {
      const fit = evaluateA4Fit(page.geometry.bounds.widthMm, page.geometry.bounds.heightMm);
      expect(fit.status).toBe("paper-only");
      expect(fit.orientation).toBe("landscape");
      expect(fit.pageWidthMm).toBe(297);
      expect(fit.pageHeightMm).toBe(210);
    }
  });

  it("蓋内寸へ紙厚と片側余裕だけを加える", () => {
    const document = generateTwoPieceGiftBox(input);
    const lidPanel = document.pages[0].geometry.panels.find((panel) => panel.id === "lid-center");
    const basePanel = document.pages[1].geometry.panels.find((panel) => panel.id === "base-center");

    expect(lidPanel).toMatchObject({ width: 102, height: 77 });
    expect(basePanel).toMatchObject({ width: 100, height: 75 });

    const looser = generateTwoPieceGiftBox({ ...input, paperThicknessMm: 0.6, lidClearanceMm: 0.8 });
    expect(looser.pages[0].geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 232.8, heightMm: 207.8 });
    expect(looser.pages[1].geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 230, heightMm: 205 });
  });

  it("蓋深さ27mmでも嵌合寸法を維持する", () => {
    const full = generateTwoPieceGiftBox(input).pages[0].geometry;
    const shallow = generateTwoPieceGiftBox({ ...input, lidDepthMm: 27 }).pages[0].geometry;
    const fullPanel = full.panels.find((panel) => panel.id === "lid-center");
    const shallowPanel = shallow.panels.find((panel) => panel.id === "lid-center");

    expect(shallowPanel).toMatchObject({ width: fullPanel?.width, height: fullPanel?.height });
    expect(shallow.bounds).toEqual({ x: 0, y: 0, widthMm: 206, heightMm: 181 });
  });

  it("両パーツに四隅のりしろと分離レイヤーを生成する", () => {
    const document = generateTwoPieceGiftBox(input);
    for (const page of document.pages) {
      expect(page.geometry.layers.glue).toHaveLength(4);
      expect(page.geometry.layers.cut.length).toBeGreaterThan(0);
      expect(page.geometry.layers.fold).toHaveLength(8);
      expect(page.geometry.layers.foldover).toHaveLength(4);
      expect(page.geometry.layers.guide.length).toBeGreaterThan(0);
      expect(page.geometry.panels.filter((panel) => panel.id.includes("foldover"))).toHaveLength(4);
    }
  });

  it("25mm折り返しを通常折り線と別レイヤーにし、4側面を上端から二重にする", () => {
    const document = generateTwoPieceGiftBox(input);
    for (const page of document.pages) {
      expect(page.geometry.layers.foldover.map((line) => line.id)).toEqual([
        `${page.id}-top-foldover-fold`,
        `${page.id}-right-foldover-fold`,
        `${page.id}-bottom-foldover-fold`,
        `${page.id}-left-foldover-fold`,
      ]);
      for (const panel of page.geometry.panels.filter((item) => item.id.includes("foldover"))) {
        expect(Math.min(panel.width, panel.height)).toBe(25);
      }
    }
  });

  it("一方でもA4外ならoverflowになる", () => {
    const document = generateTwoPieceGiftBox({ ...input, widthMm: 230, heightMm: 180, depthMm: 50 });
    const fits = document.pages.map((page) => evaluateA4Fit(page.geometry.bounds.widthMm, page.geometry.bounds.heightMm));

    expect(fits.some((fit) => fit.status === "overflow")).toBe(true);
  });

  it("ドキュメントレジストリで既存形式は1ページ、蓋身箱は2ページを維持する", () => {
    expect(generateDielineDocument(input).pages).toHaveLength(2);
    expect(generateDielineDocument({ ...input, type: "gift-box-v1", depthMm: 30 }).pages).toHaveLength(1);
    expect(generateDielineDocument({ ...input, type: "n-style-gift-box-v1", depthMm: 30 }).pages).toHaveLength(1);
    expect(generateDielineDocument({ ...input, type: "straight-tuck-carton-v1", widthMm: 40, heightMm: 60, depthMm: 25 }).pages).toHaveLength(1);
  });

  it("不正な蓋の入力値を拒否する", () => {
    expect(() => generateTwoPieceGiftBox({ ...input, lidDepthMm: 0 })).toThrow(RangeError);
    expect(() => generateTwoPieceGiftBox({ ...input, lidClearanceMm: 0 })).toThrow(RangeError);
    expect(() => generateTwoPieceGiftBox({ ...input, foldoverMm: 0 })).toThrow(RangeError);
  });
});
