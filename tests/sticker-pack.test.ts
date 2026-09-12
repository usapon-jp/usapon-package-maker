import { expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readUsaponStickerPack } from "../src/features/stamps/sticker-pack";

it("reads a memo sticker pack with its folder", async () => {
  const archive = zipSync({
    "manifest.json": strToU8(JSON.stringify({
      format: "usapon-sticker-pack",
      version: 1,
      folders: [{ id: "animals", name: "どうぶつ", order: 0 }],
      stickers: [{ id: "rabbit", name: "うさぎ", folderId: "animals", order: 0, file: "stickers/rabbit.png", contentHash: "abc" }]
    })),
    "stickers/rabbit.png": new Uint8Array([137, 80, 78, 71])
  });
  const bytes = new Uint8Array(archive.length);
  bytes.set(archive);
  const file = new File([bytes.buffer], "pack.usapon-stickers.zip", { type: "application/zip" });
  const result = await readUsaponStickerPack(file);
  expect(result.folders).toEqual([{ id: "animals", name: "どうぶつ", order: 0 }]);
  expect(result.stickers[0]).toMatchObject({ id: "rabbit", name: "うさぎ", folderId: "animals", folderName: "どうぶつ", contentHash: "abc" });
});
