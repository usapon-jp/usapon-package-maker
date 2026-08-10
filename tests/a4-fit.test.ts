import { describe, expect, it } from "vitest";

import { evaluateA4Fit } from "../src/domain/paper/a4";

describe("A4 fit", () => {
  it("安全余白込みで縦置きに収める", () => {
    const result = evaluateA4Fit(130, 142);
    expect(result.status).toBe("safe");
    expect(result.orientation).toBe("portrait");
  });

  it("縦置きと横置きを比較する", () => {
    const result = evaluateA4Fit(250, 180);
    expect(result.status).toBe("safe");
    expect(result.orientation).toBe("landscape");
  });

  it("用紙内だが5mm余白を確保できない場合はpaper-onlyにする", () => {
    const result = evaluateA4Fit(205, 280);
    expect(result.status).toBe("paper-only");
    expect(result.orientation).toBe("portrait");
  });

  it("モック例の100 × 60mm胴は自動縮小せずoverflowにする", () => {
    const result = evaluateA4Fit(15 + 2 * (100 + 60), 180);
    expect(result.status).toBe("overflow");
    expect(result.excessWidthMm).toBe(38);
  });
});
