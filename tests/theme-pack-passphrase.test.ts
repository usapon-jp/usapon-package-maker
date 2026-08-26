import { describe, expect, it } from "vitest";

import { constantTimeEqual, normalizePassphrase, sha256Hex } from "../supabase/functions/redeem-theme-pack/passphrase";

describe("テーマパック合言葉", () => {
  it("前後空白とUnicode表現を正規化して同じハッシュにする", async () => {
    expect(normalizePassphrase("  あきが来た  ")).toBe("あきが来た");
    expect(await sha256Hex("あきが来た")).toBe(await sha256Hex("  あきが来た "));
  });

  it("同じ64桁ハッシュだけを一致として扱う", () => {
    const value = "a".repeat(64);
    expect(constantTimeEqual(value, value)).toBe(true);
    expect(constantTimeEqual(value, `${"a".repeat(63)}b`)).toBe(false);
    expect(constantTimeEqual(value, "a".repeat(63))).toBe(false);
  });
});
