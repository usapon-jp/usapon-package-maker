import { describe, expect, it } from "vitest";

import {
  addFavoriteColor,
  BASIC_DESIGN_COLORS,
  MAX_FAVORITE_COLORS,
  parseFavoriteColors,
  RECOMMENDED_DESIGN_COLORS,
  removeFavoriteColor,
} from "../src/app/design-colors";

describe("デザインカラー", () => {
  it("基本色と参考画像・おすすめ色を用意する", () => {
    expect(BASIC_DESIGN_COLORS.map((item) => item.name)).toContain("アイボリー");
    expect(RECOMMENDED_DESIGN_COLORS).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "水玉イエロー", value: "#f6d96f" }),
      expect.objectContaining({ name: "ひよこイエロー", value: "#ffd400" }),
      expect.objectContaining({ name: "うさぎベージュ", value: "#e6d8cc" }),
      expect.objectContaining({ name: "文字ブラウン", value: "#4b3a37" }),
    ]));
  });

  it("お気に入り色を正規化して追加・削除する", () => {
    const added = addFavoriteColor([], "#F6D96F");
    expect(added).toEqual(["#f6d96f"]);
    expect(addFavoriteColor(added, "#f6d96f")).toBe(added);
    expect(removeFavoriteColor(added, "#F6D96F")).toEqual([]);
  });

  it("保存データを検証し、重複と上限を処理する", () => {
    const colors = Array.from({ length: MAX_FAVORITE_COLORS + 2 }, (_, index) => `#${index.toString(16).padStart(6, "0")}`);
    const parsed = parseFavoriteColors(JSON.stringify(["invalid", ...colors, colors.at(-1)]));

    expect(parsed).toHaveLength(MAX_FAVORITE_COLORS);
    expect(parsed.at(-1)).toBe(colors.at(-1));
    expect(parseFavoriteColors("not json")).toEqual([]);
  });
});
