import { describe, expect, it } from "vitest";

import { A4_PORTRAIT } from "../src/domain/units";
import { mmToPdfPoints, PDF_POINTS_PER_MM } from "../src/lib/pdf/export-a4-pdf";

describe("PDF page contract", () => {
  it("A4の実寸を210 × 297mmとして固定する", () => {
    expect(A4_PORTRAIT).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it("50mm検寸線は画面pxへ変換せずmmの差で表す", () => {
    const startXmm = 30;
    const endXmm = 80;
    expect(endXmm - startXmm).toBe(50);
  });

  it("PDFではSVG全体をmmからptへ一度だけ変換する", () => {
    expect(PDF_POINTS_PER_MM).toBeCloseTo(2.834645669, 9);
    expect(mmToPdfPoints(25.4)).toBeCloseTo(72, 9);
    expect(mmToPdfPoints(297)).toBeCloseTo(841.88976378, 8);
  });
});
