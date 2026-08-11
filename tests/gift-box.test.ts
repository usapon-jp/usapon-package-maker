import { describe, expect, it } from "vitest";

import { generateGiftBox } from "../src/domain/boxes/gift-box";
import { generateDieline } from "../src/domain/boxes/registry";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const input = {
  type: "gift-box-v1" as const,
  widthMm: 100,
  heightMm: 80,
  depthMm: 30,
  paperThicknessMm: 0.27,
  glueFlapMm: 12,
};

describe("gift-box-v1", () => {
  it("100 × 80 × 30mmをA4安全余白内に実寸で収める", () => {
    const geometry = generateGiftBox(input);
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);

    expect(geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 278.54, heightMm: 140 });
    expect(fit.status).toBe("safe");
    expect(fit.orientation).toBe("landscape");
    expect(geometry.panels.find((panel) => panel.id === "panel-lid")).toMatchObject({ width: 100, height: 80 });
    expect(geometry.panels.find((panel) => panel.id === "panel-base")).toMatchObject({ width: 100, height: 80 });
  });

  it("底面からヒンジフタまでつながった中央列を生成する", () => {
    const geometry = generateGiftBox(input);
    const polygonIds = geometry.clipPolygons.map((polygon) => polygon.id);
    const foldIds = geometry.layers.fold.map((line) => line.id);

    expect(polygonIds).toEqual(expect.arrayContaining([
      "lid-tuck",
      "lid-panel",
      "rear-wall",
      "base-panel",
      "front-wall",
    ]));
    expect(foldIds).toEqual(expect.arrayContaining([
      "tuck-fold",
      "lid-rear-fold",
      "rear-base-fold",
      "base-front-fold",
    ]));
  });

  it("フタと底面の左右に組み立て用フラップを生成する", () => {
    const geometry = generateGiftBox(input);
    const polygonIds = geometry.clipPolygons.map((polygon) => polygon.id);

    expect(polygonIds).toEqual(expect.arrayContaining([
      "lid-dust-left",
      "lid-dust-right",
      "side-wall-left",
      "side-wall-right",
    ]));
  });

  it("左上フラップの左斜辺・上辺・右斜辺をカット線で連続して描く", () => {
    const geometry = generateGiftBox(input);
    const cut = geometry.layers.cut.find((path) => path.id === "lid-dust-left-cut");

    expect(cut?.d).toBe("M 20.58,30 L 24.78,9.6 L 112.3,9.6 L 116.5,30");
  });

  it("前後4か所ののりしろで側面を固定する", () => {
    const geometry = generateGiftBox(input);

    expect(geometry.layers.glue.map((region) => region.id)).toEqual([
      "glue-rear-left",
      "glue-rear-right",
      "glue-front-left",
      "glue-front-right",
    ]);
  });

  it("カット、折り、のりしろ、ガイドを別レイヤーで返す", () => {
    const geometry = generateGiftBox(input);

    expect(geometry.layers.cut.length).toBeGreaterThan(0);
    expect(geometry.layers.fold.length).toBeGreaterThan(0);
    expect(geometry.layers.glue).toHaveLength(4);
    expect(geometry.layers.guide.length).toBeGreaterThan(0);
  });

  it("紙厚を差し込み舌の逃げに反映する", () => {
    const thin = generateGiftBox(input);
    const thick = generateGiftBox({ ...input, paperThicknessMm: 0.8 });

    expect(thick.bounds.widthMm).toBeGreaterThan(thin.bounds.widthMm);
    expect(thick.bounds.heightMm).toBe(thin.bounds.heightMm);
  });

  it("収まらない寸法は自動縮小せずoverflowにする", () => {
    const geometry = generateGiftBox({ ...input, widthMm: 220, heightMm: 180, depthMm: 50 });
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);

    expect(geometry.bounds.widthMm).toBe(562);
    expect(fit.status).toBe("overflow");
  });

  it("レジストリから選択でき、既存箱型も維持する", () => {
    expect(generateDieline(input).type).toBe("gift-box-v1");
    expect(generateDieline({
      ...input,
      type: "straight-tuck-carton-v1",
      widthMm: 40,
      heightMm: 60,
      depthMm: 25,
    }).type).toBe("straight-tuck-carton-v1");
  });

  it("0以下の寸法を拒否する", () => {
    expect(() => generateGiftBox({ ...input, depthMm: 0 })).toThrow(RangeError);
  });
});
