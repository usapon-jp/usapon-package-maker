import { describe, expect, it } from "vitest";

import { BUILT_IN_STAMPS, builtInStampForKey, isBuiltInStampPickerVisible, markAsBuiltInStamp } from "../src/app/artwork";
import { AUTUMN_STAMP_IDS, LEGACY_AUTUMN_STAMP_FILES } from "../src/features/theme-packs/autumn-stamp-catalog";
import type { UploadedAsset } from "../src/app/app-types";

const asset: UploadedAsset = {
  id: "stamp-asset",
  fileName: "usapon-box-rabbits.png",
  sourceType: "png",
  dataUrl: "data:image/png;base64,AA==",
  aspectRatio: 865 / 1024,
};

describe("内蔵スタンプ", () => {
  it("プリセットごとに保存用キーと画像を引ける", () => {
    expect(BUILT_IN_STAMPS.map((item) => item.key)).toEqual(expect.arrayContaining([
      "usapon-box-rabbits", "pofumofu-friends", "autumn-rabbit-sweet-potato-car", ...AUTUMN_STAMP_IDS,
    ]));
    expect(builtInStampForKey("usapon-box-rabbits")).toMatchObject({
      fileName: "usapon-box-rabbits.png",
      name: "うさぽんBOX",
    });
    expect(builtInStampForKey("autumn-rabbit-acorn-hug")).toMatchObject({ fileName: "autumn-rabbit-acorn-hug.png", delivery: "private" });
    expect(LEGACY_AUTUMN_STAMP_FILES).toEqual({
      "autumn-rabbit-sweet-potato-car": "autumn-rabbit-sweet-potato-car.png",
      "autumn-rabbit-acorn-hug": "autumn-rabbit-acorn-hug.png",
      "autumn-rabbit-sweet-potato": "autumn-rabbit-sweet-potato.png",
      "autumn-rabbit-chestnut": "autumn-rabbit-chestnut.png",
      "autumn-rabbit-sleeping-sweet-potato": "autumn-rabbit-sleeping-sweet-potato-no-text.png",
    });
    expect(builtInStampForKey("autumn-stamp-9803")).toMatchObject({ fileName: "autumn-stamp-9803.png", delivery: "public", themePackId: null });
    expect(BUILT_IN_STAMPS.filter(isBuiltInStampPickerVisible).map((item) => item.key)).not.toEqual(expect.arrayContaining([
      "autumn-rabbit-sweet-potato-car", "autumn-rabbit-acorn-hug", "autumn-rabbit-sweet-potato", "autumn-rabbit-chestnut", "autumn-rabbit-sleeping-sweet-potato",
    ]));
  });

  it("追加した内蔵スタンプの参照を持たせる", () => {
    expect(markAsBuiltInStamp(asset, "usapon-box-rabbits").assetRef).toEqual({
      kind: "builtin",
      key: "usapon-box-rabbits",
    });
  });
});
