import { expect, it } from "vitest";
import { mergeMyImages, myImageFolders } from "../src/features/stamps/my-images";
import type { StampItem } from "../src/app/app-types";

it("groups user uploads by asset, across placements, without including built-in stamps", () => {
  const uploaded = { id: "placement-1", assetRef: { kind: "user", assetId: "image-1" }, name: "image" } as StampItem;
  const duplicate = { ...uploaded, id: "placement-2" };
  const builtin = { id: "builtin", assetRef: { kind: "builtin", key: "usapon-box-rabbits" } } as StampItem;
  expect(mergeMyImages([uploaded, builtin], [duplicate])).toEqual([duplicate]);
});

it("preserves imported folder metadata while a saved image is reused in a design", () => {
  const saved = {
    id: "saved",
    assetRef: { kind: "user", assetId: "image-1" },
    libraryFolderId: "animals",
    libraryFolderName: "どうぶつ",
    libraryFolderOrder: 2,
    libraryOrder: 4,
  } as StampItem & { libraryFolderId: string; libraryFolderName: string; libraryFolderOrder: number; libraryOrder: number };
  const placed = { id: "placed", assetRef: { kind: "user", assetId: "image-1" } } as StampItem;
  const result = mergeMyImages([saved], [placed]);
  expect(result[0].libraryFolderId).toBe("animals");
  expect(myImageFolders(result)).toEqual([{ id: "animals", name: "どうぶつ", order: 2 }]);
});
