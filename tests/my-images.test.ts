import { expect, it } from "vitest";
import { mergeMyImages } from "../src/features/stamps/my-images";
import type { StampItem } from "../src/app/app-types";

it("groups user uploads by asset, across placements, without including built-in stamps", () => {
  const uploaded = { id: "placement-1", assetRef: { kind: "user", assetId: "image-1" }, name: "image" } as StampItem;
  const duplicate = { ...uploaded, id: "placement-2" };
  const builtin = { id: "builtin", assetRef: { kind: "builtin", key: "usapon-box-rabbits" } } as StampItem;
  expect(mergeMyImages([uploaded, builtin], [duplicate])).toEqual([duplicate]);
});
