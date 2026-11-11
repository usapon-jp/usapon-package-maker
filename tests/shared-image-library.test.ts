import { beforeEach, expect, it, vi } from "vitest";
import { initialState } from "../src/app/app-state";
import { createStamp, createRepeatingArtwork } from "../src/app/artwork";
import { generateDieline } from "../src/domain/boxes/registry";
import { loadMyImages, saveMyImage } from "../src/features/stamps/my-images";

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb", () => ({ openDB: async () => ({
  get: async (_store: string, key: unknown) => store.get(JSON.stringify(key)),
  put: async (_store: string, value: unknown, key: unknown) => { store.set(JSON.stringify(key), value); },
  getAll: async (_store: string, range: { lower: string[] }) => [...store.entries()].filter(([key]) => JSON.parse(key)[0] === range.lower[0]).map(([, value]) => value),
}) }));
beforeEach(() => { store.clear(); vi.stubGlobal("IDBKeyRange", { bound: (lower: string[], upper: string[]) => ({ lower, upper }) }); });

it("一度保存した背景PNGを、種類を変えても背景として使える（アカウントは分離）", async () => {
  const envelope = generateDieline({ ...initialState.box, type: "envelope-v1", widthMm: 162, heightMm: 114 });
  const asset = { id: "uploaded-background", assetRef: { kind: "user" as const, assetId: "asset-background" }, fileName: "pattern.png", sourceType: "png" as const, dataUrl: "data:image/png;base64,AA==", aspectRatio: 1 };
  const original = createRepeatingArtwork(asset, envelope);
  await saveMyImage("device", createStamp(asset, envelope));
  for (const type of ["letter-paper-v1", "mini-card-v1"] as const) {
    const [saved] = await loadMyImages("device");
    const geometry = generateDieline({ ...initialState.box, type, widthMm: 91, heightMm: 55 });
    const reused = createRepeatingArtwork({ ...saved, id: saved.assetRef.kind === "user" ? saved.assetRef.assetId : saved.id }, geometry);
    expect(reused.assetRef).toEqual(original.assetRef);
    expect(reused.dataUrl).toBe(original.dataUrl);
    expect(reused.repeat).toBe(true);
  }
  expect(await loadMyImages("different-account")).toEqual([]);
});

it("既存画像を背景に使い直しても、素材フォルダの情報を保つ", async () => {
  const geometry = generateDieline(initialState.box);
  const item = createStamp({ id: "asset", assetRef: { kind: "user", assetId: "asset" }, fileName: "a.png", sourceType: "png", dataUrl: "data:image/png;base64,AA==", aspectRatio: 1 }, geometry);
  await saveMyImage("device", { ...item, libraryFolderId: "animals", libraryFolderName: "どうぶつ", libraryOrder: 7 });
  await saveMyImage("device", item);
  expect((await loadMyImages("device"))[0]).toMatchObject({ libraryFolderId: "animals", libraryFolderName: "どうぶつ", libraryOrder: 7 });
});
