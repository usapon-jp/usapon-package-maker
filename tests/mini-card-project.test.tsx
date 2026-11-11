import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { appReducer, initialState } from "../src/app/app-state";
import { captureCardDesign, reconcileCardSlots } from "../src/features/letter-set/mini-card-project";
import { DEFAULT_WRITING_FRAME } from "../src/features/letter-set/writing-frame";
import { A4ExportSvg } from "../src/components/dieline/A4ExportSvg";
import { WritingFrameLayer } from "../src/components/dieline/layers/WritingFrameLayer";
import { CardDesignSvg } from "../src/features/letter-set/CardDesignSvg";
import { generateDieline } from "../src/domain/boxes/registry";
import { printImposition } from "../src/domain/paper/imposition";
import { evaluateA4Fit } from "../src/domain/paper/a4";
import { collectUserAssetIds, hydrateBoxDocument, serializeBoxDocument } from "../src/app/box-document";
import { createStamp } from "../src/app/artwork";

function start() { return appReducer(initialState, { type: "replace-state", state: { ...initialState, box: { ...initialState.box, type: "mini-card-v1", widthMm: 91, heightMm: 55 } } }); }
const geometry = generateDieline(start().box);

describe("完成デザインと印刷シート", () => {
  it("2種類を4枚ずつの計8枚で始め、空白2枠を保つ", () => {
    const project = start().miniCardProject!;
    expect(project.designs.map((design) => design.copies)).toEqual([4, 4]);
    expect(project.slots).toEqual(["card-a", "card-a", "card-a", "card-a", "card-b", "card-b", "card-b", "card-b", null, null]);
  });
  it("デザインの背景・文字・枠を切替後も独立して保つ", () => {
    let state = start();
    state = appReducer(state, { type: "set-background-color", pageId: "main", color: "#aabbcc" });
    state = appReducer(state, { type: "set-card-writing-frame", value: true });
    state = appReducer(state, { type: "update-writing-frame", pageId: "main", patch: { shape: "bubble", flipX: true, opacity: 0.5, rotationDeg: 30 } });
    state = appReducer(state, { type: "card-select", id: "card-b" });
    expect(state.backgroundColors.main).toBe("#fffdf9"); expect(state.showCardWritingFrame).toBe(false);
    state = appReducer(state, { type: "set-background-color", pageId: "main", color: "#ffeedd" });
    state = appReducer(state, { type: "card-select", id: "card-a" });
    expect(state.backgroundColors.main).toBe("#aabbcc"); expect(state.showCardWritingFrame).toBe(true);
    expect(state.writingFrames?.main).toMatchObject({ shape: "bubble", flipX: true, opacity: 0.5, rotationDeg: 30 });
    expect(state.miniCardProject!.designs[1].data.backgroundColor).toBe("#ffeedd");
  });
  it("3種類3/3/2と、合計12枚の複数ページを作れる", () => {
    let state = appReducer(start(), { type: "card-add", id: "card-c" });
    for (const [id, copies] of [["card-a", 3], ["card-b", 3], ["card-c", 2]] as const) state = appReducer(state, { type: "card-copies", id, copies });
    expect(state.miniCardProject!.slots.filter(Boolean)).toHaveLength(8);
    state = appReducer(state, { type: "card-copies", id: "card-a", copies: 7 });
    expect(state.miniCardProject!.slots).toHaveLength(20);
    expect(state.miniCardProject!.slots.filter(Boolean)).toHaveLength(12);
    expect(state.miniCardProject!.designs.find((design) => design.id === "card-c")!.copies).toBe(2);
  });
  it("手動の配置を保って空白へ追加し、0枚にしてもデザインを保つ", () => {
    let state = appReducer(start(), { type: "card-place", index: 0, id: null });
    state = appReducer(state, { type: "card-place", index: 9, id: "card-a" });
    state = appReducer(state, { type: "card-copies", id: "card-b", copies: 5 });
    expect(state.miniCardProject!.slots[9]).toBe("card-a"); expect(state.miniCardProject!.slots[0]).toBe("card-b");
    state = appReducer(state, { type: "card-copies", id: "card-a", copies: 0 });
    expect(state.miniCardProject!.designs).toHaveLength(2); expect(state.miniCardProject!.slots.filter((id) => id === "card-a")).toHaveLength(0);
  });
  it("複製とライブラリ取り込みは別の作業コピーになる", () => {
    let state = appReducer(start(), { type: "update-writing-frame", pageId: "main", patch: { flipY: true } });
    const source = state.miniCardProject!.designs[0].data;
    state = appReducer(state, { type: "card-add", id: "copy", duplicate: true });
    state = appReducer(state, { type: "update-writing-frame", pageId: "main", patch: { flipY: false } });
    expect(source.frame?.flipY).toBe(true); expect(state.miniCardProject!.designs[0].data.frame?.flipY).toBe(true);
  });
  it("非編集中のデザインの画像も保存・クラウド復元の対象になる", async () => {
    let state = start();
    const stamp = createStamp({ id: "c0a8012e-fb4a-4e8b-aac1-33ea68be17c1", fileName: "user.png", dataUrl: "data:image/png;base64,private", sourceType: "png", aspectRatio: 1 }, geometry);
    state = appReducer(state, { type: "add-stamp", item: stamp });
    state = appReducer(state, { type: "card-select", id: "card-b" });
    const document = serializeBoxDocument(state);
    expect(JSON.stringify(document)).not.toContain("data:image/png");
    expect(collectUserAssetIds(document)).toContain("c0a8012e-fb4a-4e8b-aac1-33ea68be17c1");
    // Match the existing save_box_project RPC's root-array reference check.
    const rootIds = [...document.design.artworkLayers, ...document.design.stamps].flatMap((item) => "assetRef" in item && item.assetRef.kind === "user" ? [item.assetRef.assetId] : []);
    expect([...new Set(rootIds)].sort()).toEqual(collectUserAssetIds(document).sort());
    const restored = await hydrateBoxDocument(document, async () => ({ dataUrl: "data:image/png;base64,restored" }));
    expect(restored.miniCardProject!.designs[0].data.stamps[0].dataUrl).toBe("data:image/png;base64,restored");
    expect(restored.stamps).toHaveLength(0);
    expect(restored.miniCardProject!.slots).toEqual(state.miniCardProject!.slots);
  });
  it("完成デザインごとにA4へ描画し、空白や他のデザインを混ぜない", () => {
    const state = start(); const a = { ...captureCardDesign(state), backgroundColor: "#ff0000", frame: { ...DEFAULT_WRITING_FRAME, shape: "bubble" as const, flipX: true }, showFrame: true };
    const b = { ...captureCardDesign(state), backgroundColor: "#0000ff", frame: { ...DEFAULT_WRITING_FRAME, shape: "ellipse" as const }, showFrame: true };
    const size = printImposition(geometry); const fit = evaluateA4Fit(size.widthMm, size.heightMm);
    const markup = renderToStaticMarkup(<A4ExportSvg geometry={geometry} fit={fit} backgroundColor="#ffffff" artworkLayers={[]} stamps={[]} texts={[]} lineColors={state.lineColors} cardDesigns={[a, a, a, a, b, b, b, b, null, null]} />);
    expect(markup.match(/data-imposition-item=/g)).toHaveLength(8);
    expect(markup.match(/data-writing-frame="bubble"/g)).toHaveLength(4);
    expect(markup.match(/data-writing-frame="ellipse"/g)).toHaveLength(4);
    expect(markup).not.toContain("data-writing-frame-handle");
    const single = renderToStaticMarkup(<CardDesignSvg data={a} geometry={geometry} prefix="single" />);
    expect(single).toMatch(/data-layer="cut"[^>]*><\/g>/); expect(single).not.toContain("data-writing-frame-handle");
  });
});

describe("記入枠", () => {
  it("旧作品は角丸92%の見た目を保つ", () => {
    const markup = renderToStaticMarkup(<WritingFrameLayer geometry={geometry} />);
    expect(markup).toContain('data-writing-frame="rounded"'); expect(markup).toContain('fill-opacity="0.92"'); expect(markup).toContain('width="77" height="41"');
  });
  it("反転を枠の内側にかけ、文字やハンドルは反転しない", () => {
    const markup = renderToStaticMarkup(<WritingFrameLayer geometry={geometry} selected settings={{ ...DEFAULT_WRITING_FRAME, shape: "bubble", flipX: true, flipY: true, rotationDeg: 30, opacity: 0 }} />);
    expect(markup).toContain('rotate(30)'); expect(markup).toContain('scale(-1 -1)'); expect(markup).toContain('fill-opacity="0"');
    expect(markup.match(/scale\(-1 -1\)/g)).toHaveLength(1); expect(markup).toContain('data-writing-frame-handle="rotate"');
  });
  it("不正な枠設定を適用しない", () => {
    const state = start(); expect(appReducer(state, { type: "update-writing-frame", pageId: "main", patch: { scale: -1 } }).writingFrames?.main).toBeUndefined();
  });
});
