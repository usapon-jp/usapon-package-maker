import { describe, expect, it } from "vitest";

import { parseNumberDraft } from "../src/app/number-input";

describe("parseNumberDraft", () => {
  it("入力途中の空欄を展開図へ渡さない", () => {
    expect(parseNumberDraft("", 10, 500)).toBeNull();
    expect(parseNumberDraft("   ", 10, 500)).toBeNull();
  });

  it("範囲内の数値だけを返す", () => {
    expect(parseNumberDraft("80", 10, 500)).toBe(80);
    expect(parseNumberDraft("9", 10, 500)).toBeNull();
    expect(parseNumberDraft("501", 10, 500)).toBeNull();
  });

  it("数値でない入力を拒否する", () => {
    expect(parseNumberDraft("not-a-number", 10, 500)).toBeNull();
  });
});
