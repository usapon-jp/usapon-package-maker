import { describe, expect, it } from "vitest";

import type { BoxInput } from "../src/domain/boxes/types";
import { generateEnvelope } from "../src/domain/boxes/stationery";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const baseInput: Omit<BoxInput, "widthMm" | "heightMm"> = {
  type: "envelope-v1",
  depthMm: 1,
  paperThicknessMm: 0.12,
  glueFlapMm: 12,
};

describe("洋形2号カマス貼りの幾何計算", () => {
  it("A4内へ実寸で収まり、A/B/Cと左右のりしろを生成する", () => {
    const geometry = generateEnvelope({ ...baseInput, widthMm: 162, heightMm: 114, envelopeConstruction: "kamasu" });
    expect(geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 186, heightMm: 258 });
    expect(evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm)).toMatchObject({ status: "safe", orientation: "portrait" });
    expect(geometry.panels.slice(0, 3)).toMatchObject([
      { id: "panel-envelope-front", x: 12, y: 30, width: 162, height: 114 },
      { id: "panel-envelope-flap", x: 12, y: 0, width: 162, height: 30 },
      { id: "panel-envelope-back", x: 12, y: 144, width: 162, height: 114 },
    ]);
    expect(geometry.layers.fold.map((line) => line.id)).toEqual(["envelope-flap-fold", "envelope-front-back-fold", "envelope-left-glue-fold", "envelope-right-glue-fold"]);
    expect(geometry.layers.glue).toHaveLength(2);
  });
});
