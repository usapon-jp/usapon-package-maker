import { describe, expect, it } from "vitest";

import { BUILT_IN_STAMPS, builtInStampForKey, markAsBuiltInStamp } from "../src/app/artwork";
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
    expect(BUILT_IN_STAMPS.map((item) => item.key)).toEqual([
      "usapon-box-rabbits",
      "pofumofu-friends",
      "autumn-rabbit-sweet-potato-car",
      "autumn-rabbit-acorn-hug",
      "autumn-rabbit-sweet-potato",
      "autumn-rabbit-chestnut",
    ]);
    expect(builtInStampForKey("usapon-box-rabbits")).toMatchObject({
      fileName: "usapon-box-rabbits.png",
      name: "うさぽんBOX",
    });
    expect(builtInStampForKey("autumn-rabbit-acorn-hug")).toMatchObject({
      fileName: "autumn-rabbit-acorn-hug.png",
      name: "どんぐりぎゅっ",
    });
  });

  it("追加した内蔵スタンプの参照を持たせる", () => {
    expect(markAsBuiltInStamp(asset, "usapon-box-rabbits").assetRef).toEqual({
      kind: "builtin",
      key: "usapon-box-rabbits",
    });
  });
});
