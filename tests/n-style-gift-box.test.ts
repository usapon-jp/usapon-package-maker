import { describe, expect, it } from "vitest";

import { generateNStyleGiftBox } from "../src/domain/boxes/n-style-gift-box";
import { generateDieline } from "../src/domain/boxes/registry";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const input = {
  type: "n-style-gift-box-v1" as const,
  widthMm: 100,
  heightMm: 80,
  depthMm: 30,
  paperThicknessMm: 0.27,
  glueFlapMm: 12,
};

describe("n-style-gift-box-v1", () => {
  it("100 × 80 × 30mmをA4横の安全余白内に実寸で収める", () => {
    const geometry = generateNStyleGiftBox(input);
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);

    expect(geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 282.04, heightMm: 181.48 });
    expect(fit.status).toBe("safe");
    expect(fit.orientation).toBe("landscape");
    expect(geometry.panels.find((panel) => panel.id === "panel-lid")).toMatchObject({ width: 80, height: 100 });
    expect(geometry.panels.find((panel) => panel.id === "panel-base")).toMatchObject({ width: 80, height: 100 });
  });

  it("参考図に沿う一続きの中央6面を生成する", () => {
    const geometry = generateNStyleGiftBox(input);

    expect(geometry.clipPolygons.map((polygon) => polygon.id)).toEqual(expect.arrayContaining([
      "lid-tuck",
      "lid-panel",
      "rear-wall",
      "base-panel",
      "front-wall",
      "front-return",
    ]));
  });

  it("上下側壁と前後の角ロックを生成する", () => {
    const geometry = generateNStyleGiftBox(input);

    expect(geometry.clipPolygons.map((polygon) => polygon.id)).toEqual(expect.arrayContaining([
      "side-wall-top",
      "side-wall-bottom",
      "side-lock-lip-top",
      "side-lock-lip-bottom",
      "corner-lock-rear-top",
      "corner-lock-rear-bottom",
      "corner-lock-front-top",
      "corner-lock-front-bottom",
    ]));
  });

  it("のりしろを使わず、カット・折り・ガイドを別レイヤーで返す", () => {
    const geometry = generateNStyleGiftBox(input);

    expect(geometry.layers.cut.length).toBeGreaterThan(0);
    expect(geometry.layers.fold.length).toBeGreaterThan(0);
    expect(geometry.layers.glue).toEqual([]);
    expect(geometry.layers.guide.length).toBeGreaterThan(0);
  });

  it("前面の2ロックと後方角ロックのスリットを生成する", () => {
    const cutIds = generateNStyleGiftBox(input).layers.cut.map((path) => path.id);

    expect(cutIds).toEqual(expect.arrayContaining([
      "front-lock-notch-upper",
      "front-lock-notch-lower",
      "corner-slot-rear-top",
      "corner-slot-rear-bottom",
    ]));
  });

  it("紙厚を差し込み部とロック部の逃げに反映する", () => {
    const thin = generateNStyleGiftBox(input);
    const thick = generateNStyleGiftBox({ ...input, paperThicknessMm: 0.8 });

    expect(thick.bounds.widthMm).toBeGreaterThan(thin.bounds.widthMm);
    expect(thick.bounds.heightMm).toBeGreaterThan(thin.bounds.heightMm);
  });

  it("収まらない寸法は自動縮小せずoverflowにする", () => {
    const geometry = generateNStyleGiftBox({ ...input, widthMm: 220, heightMm: 180, depthMm: 50 });
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);

    expect(geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 562.04, heightMm: 352 });
    expect(fit.status).toBe("overflow");
  });

  it("レジストリから3種類目として選択できる", () => {
    expect(generateDieline(input).type).toBe("n-style-gift-box-v1");
    expect(generateDieline({ ...input, type: "gift-box-v1" }).type).toBe("gift-box-v1");
    expect(generateDieline({ ...input, type: "straight-tuck-carton-v1" }).type).toBe("straight-tuck-carton-v1");
  });

  it("0以下の寸法を拒否する", () => {
    expect(() => generateNStyleGiftBox({ ...input, depthMm: 0 })).toThrow(RangeError);
  });
});
