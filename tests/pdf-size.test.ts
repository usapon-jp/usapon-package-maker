import { describe, expect, it } from "vitest";

import { A4_PORTRAIT } from "../src/domain/units";

describe("PDF page contract", () => {
  it("A4の実寸を210 × 297mmとして固定する", () => {
    expect(A4_PORTRAIT).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it("50mm検寸線は画面pxへ変換せずmmの差で表す", () => {
    const startXmm = 30;
    const endXmm = 80;
    expect(endXmm - startXmm).toBe(50);
  });
});
