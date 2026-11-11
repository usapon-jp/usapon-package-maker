import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { appReducer, initialState } from "../src/app/app-state";
import { createStamp } from "../src/app/artwork";
import { generateDieline } from "../src/domain/boxes/registry";
import { loadCardLibrary, saveLibraryCard } from "../src/features/letter-set/card-library";
import { captureCardDesign } from "../src/features/letter-set/mini-card-project";
import { loadLocalDraft, saveLocalDraft } from "../src/lib/drafts/local-draft";
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb", () => ({ openDB: async (name: string) => ({
  get: async (table: string, key: unknown) => store.get(`${name}:${table}:${JSON.stringify(key)}`),
  put: async (table: string, value: unknown, key: unknown) => { store.set(`${name}:${table}:${JSON.stringify(key)}`, structuredClone(value)); },
  getAll: async (table: string, range: { lower: string[] }) => [...store.entries()].filter(([key]) => key.startsWith(`${name}:${table}:["${range.lower[0]}",`)).map(([, value]) => value),
}) }));
vi.mock("../src/lib/uploads/read-pattern", () => ({ blobToDataUrl: async () => "data:image/png;base64,restored" }));
beforeEach(() => { store.clear(); vi.stubGlobal("indexedDB", {}); vi.stubGlobal("IDBKeyRange", { bound: (lower: string[], upper: string[]) => ({ lower, upper }) }); });
afterEach(() => vi.unstubAllGlobals());
function start() { return appReducer(initialState, { type: "replace-state", state: { ...initialState, box: { ...initialState.box, type: "mini-card-v1", widthMm: 91, heightMm: 55 } } }); }
it("完成したカードを別の印刷で再利用でき、アカウントをまたいで表示しない", async () => {
  const data = captureCardDesign(start());
  data.frame = { shape: "bubble", flipX: true, flipY: true, opacity: .5, rotationDeg: 30, scale: .75, widthScale: 1, heightScale: 1, offsetXmm: 3, offsetYmm: -2 };
  await saveLibraryCard("device", { id: "card", name: "吹き出し", data });
  const [saved] = await loadCardLibrary("device");
  const reused = appReducer(start(), { type: "card-add", id: "reuse", name: saved.name, data: saved.data, libraryId: saved.id });
  expect(reused.writingFrames?.main).toEqual(data.frame);
  expect(reused.miniCardProject!.designs.at(-1)?.copies).toBe(0);
  expect(await loadCardLibrary("different-user")).toEqual([]);
});
it("端末内の下書きでも非編集中の画像と割り付け・枠設定を復元する", async () => {
  let state = start();
  const geometry = generateDieline(state.box);
  const stamp = createStamp({ id: "user-asset", fileName: "user.png", dataUrl: "data:image/png;base64,original", sourceType: "png", aspectRatio: 1, blob: new Blob(["png"]) }, geometry);
  state = appReducer(state, { type: "add-stamp", item: stamp });
  state = appReducer(state, { type: "update-writing-frame", pageId: "main", patch: { flipY: true } });
  state = appReducer(state, { type: "card-select", id: "card-b" });
  await saveLocalDraft(state, null);
  const restored = (await loadLocalDraft())!.state;
  expect(restored.miniCardProject!.designs[0].data.stamps[0].dataUrl).toBe("data:image/png;base64,restored");
  expect(restored.miniCardProject!.designs[0].data.frame?.flipY).toBe(true);
  expect(restored.miniCardProject!.slots).toEqual(state.miniCardProject!.slots);
});
