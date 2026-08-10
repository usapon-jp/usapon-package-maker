import { describe, expect, it } from "vitest";

import { generateStraightTuckCarton } from "../src/domain/boxes/straight-tuck-carton";

const input = {
  type: "straight-tuck-carton-v1" as const,
  widthMm: 40,
  depthMm: 25,
  heightMm: 60,
  paperThicknessMm: 0.27,
  glueFlapMm: 12,
};

describe("straight-tuck-carton-v1", () => {
  it("胴をのりしろ + W + D + W + Dで計算する", () => {
    const result = generateStraightTuckCarton(input);
    expect(result.bounds.widthMm).toBe(142);
    expect(result.panels.map((panel) => panel.width)).toEqual([40, 25, 40, 25]);
  });

  it("カット、折り、のりしろ、ガイドを別レイヤーで返す", () => {
    const result = generateStraightTuckCarton(input);
    expect(result.layers.cut.length).toBeGreaterThan(0);
    expect(result.layers.fold.length).toBeGreaterThan(0);
    expect(result.layers.glue).toHaveLength(1);
    expect(result.layers.guide).toHaveLength(8);
  });

  it("紙厚を差し込み部の逃げへ反映する", () => {
    const thin = generateStraightTuckCarton(input);
    const thick = generateStraightTuckCarton({ ...input, paperThicknessMm: 0.8 });
    expect(thick.bounds.heightMm).toBeGreaterThan(thin.bounds.heightMm);
    expect(thick.bounds.widthMm).toBe(thin.bounds.widthMm);
  });

  it("0以下の寸法を拒否する", () => {
    expect(() => generateStraightTuckCarton({ ...input, widthMm: 0 })).toThrow(RangeError);
  });
});
