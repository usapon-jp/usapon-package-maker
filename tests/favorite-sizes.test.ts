import { describe, expect, it } from "vitest";

import { parseFavoriteSizes, registerFavoriteSize } from "../src/app/favorite-sizes";

const box = {
  type: "straight-tuck-carton-v1" as const,
  widthMm: 40,
  depthMm: 25,
  heightMm: 60,
  paperThicknessMm: 0.27,
  glueFlapMm: 12,
};

describe("名前付きお気に入り寸法", () => {
  it("名前を付けて寸法一式を登録する", () => {
    const result = registerFavoriteSize([], "  プレゼント箱  ", box, "favorite-1");

    expect(result).toEqual([{ id: "favorite-1", name: "プレゼント箱", box }]);
  });

  it("同じ名前を登録すると寸法を更新する", () => {
    const first = registerFavoriteSize([], "定番", box, "favorite-1");
    const result = registerFavoriteSize(first, "定番", { ...box, widthMm: 55 }, "favorite-2");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("favorite-1");
    expect(result[0].box.widthMm).toBe(55);
  });

  it("壊れた端末保存値を読み込まない", () => {
    expect(parseFavoriteSizes("not json")).toEqual([]);
    expect(parseFavoriteSizes(JSON.stringify([{ id: "x", name: "壊れた寸法", box: { widthMm: 0 } }]))).toEqual([]);
  });
});
