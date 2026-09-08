import { describe, expect, it } from "vitest";

import { dominantOpaqueEdgeColor } from "../src/lib/uploads/image-edge-color";

describe("画像外周の背景色", () => {
  it("透明部分を除外して外周の多数色を返す", () => {
    const pixels = new Uint8ClampedArray([
      243, 235, 220, 255, 243, 235, 220, 255, 0, 0, 0, 0,
      243, 235, 220, 255, 80, 30, 20, 255, 243, 235, 220, 255,
      243, 235, 220, 255, 243, 235, 220, 255, 243, 235, 220, 255,
    ]);
    expect(dominantOpaqueEdgeColor(pixels, 3, 3)).toBe("#f3ebdc");
  });
});
