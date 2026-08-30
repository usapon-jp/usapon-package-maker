// @ts-expect-error Vitest runs in Node, while the browser app intentionally omits Node globals from tsconfig.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("円形カラーピッカー", () => {
  it("背景・柄・文字で共通利用する色選択部品に円形UI、明るさ、HEX入力がある", () => {
    const source = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");
    expect(source).toContain("function CircularColorPicker");
    expect(source).toContain('className="circular-color-wheel"');
    expect(source).toContain('aria-label={`${label}の明るさ`}');
    expect(source).toContain('aria-label={`${label}のHEX値`}');
    expect(source).toContain("<CircularColorPicker label={label} value={value} onChange={onChange} />");
    expect(source).not.toContain('aria-label={label} type="color"');
  });
});
