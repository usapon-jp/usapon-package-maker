import { describe, expect, it } from "vitest";

import { appReducer, initialState } from "../src/app/app-state";
import {
  createFullPanelArtwork,
  createDotPattern,
  createStamp,
  createStripePattern,
  createUploadedArtwork,
  rotateQuarterTurn,
} from "../src/app/artwork";
import { createTextItem } from "../src/features/auto-layout/text-layout";
import type { UploadedAsset } from "../src/app/app-types";
import { generateStraightTuckCarton } from "../src/domain/boxes/straight-tuck-carton";

const geometry = generateStraightTuckCarton(initialState.box);
const asset: UploadedAsset = {
  id: "asset-1",
  fileName: "sample.png",
  sourceType: "png",
  dataUrl: "data:image/png;base64,AA==",
  aspectRatio: 2,
};

describe("背景・柄・スタンプの状態管理", () => {
  it("基本色と柄プリセットの初期値を設定する", () => {
    const stripe = createStripePattern("stripe-1", 1);
    const dots = createDotPattern("dots-1", 1);

    expect(initialState.backgroundColors.main).toBe("#fffdf9");
    expect(stripe).toMatchObject({ color: "#f6d96f", stripeWidthMm: 5, gapMm: 5, angleDeg: 45 });
    expect(dots).toMatchObject({ color: "#f6d96f", dotDiameterMm: 8, spacingMm: 24 });
  });

  it("背景・柄レイヤーを追加、選択、更新、複製、並べ替え、削除できる", () => {
    const stripe = createStripePattern("stripe-1", 1);
    const dots = createDotPattern("dots-1", 1);
    let state = appReducer(initialState, { type: "add-artwork", item: stripe });
    state = appReducer(state, { type: "add-artwork", item: dots });
    state = appReducer(state, { type: "update-artwork", id: dots.id, patch: { visible: false, opacity: 0.45 } });

    expect(state.selectedArtworkId).toBe(dots.id);
    expect(state.artworkLayers[1]).toMatchObject({ visible: false, opacity: 0.45 });

    state = appReducer(state, { type: "move-artwork", id: dots.id, direction: "backward" });
    expect(state.artworkLayers.map((item) => item.id)).toEqual([dots.id, stripe.id]);

    state = appReducer(state, { type: "duplicate-artwork", id: stripe.id, newId: "stripe-copy" });
    expect(state.artworkLayers.at(-1)).toMatchObject({ id: "stripe-copy", name: "ストライプ 1 コピー" });

    state = appReducer(state, { type: "remove-artwork", id: dots.id });
    expect(state.artworkLayers.map((item) => item.id)).toEqual([stripe.id, "stripe-copy"]);
  });

  it("アップロード背景とスタンプを主要面中央へ追加する", () => {
    const artwork = createUploadedArtwork(asset, geometry);
    const targetPanel = geometry.panels[1];
    const fullPanelArtwork = createFullPanelArtwork(asset, geometry, "main", targetPanel);
    const stamp = createStamp({ ...asset, id: "stamp-1" }, geometry, "Pofumofu friends");
    const firstPanel = geometry.panels[0];
    const expectedCenter = {
      x: firstPanel.x + firstPanel.width / 2,
      y: firstPanel.y + firstPanel.height / 2,
    };

    expect(artwork).toMatchObject({ kind: "uploaded-artwork", repeat: false, rotationDeg: 0, offsetXmm: expectedCenter.x, offsetYmm: expectedCenter.y });
    expect(fullPanelArtwork).toMatchObject({
      widthMm: Math.min(targetPanel.width, targetPanel.height * asset.aspectRatio),
      offsetXmm: targetPanel.x + targetPanel.width / 2,
      offsetYmm: targetPanel.y + targetPanel.height / 2,
    });
    expect(stamp).toMatchObject({ kind: "stamp", name: "Pofumofu friends", rotationDeg: 0, xMm: expectedCenter.x, yMm: expectedCenter.y });
    expect(stamp.widthMm / asset.aspectRatio).toBeLessThanOrEqual(firstPanel.height * 0.72);
  });

  it("差し込み箱の縦長画像は回転後の横幅を前面幅に合わせる", () => {
    const portrait = { ...asset, id: "portrait", aspectRatio: 0.5, assetRef: { kind: "builtin" as const, key: "autumn-trial-cover" as const } };
    const stamp = createStamp(portrait, geometry, "縦長の表紙");
    const front = geometry.panels[0];

    expect(stamp.rotationDeg).toBe(90);
    expect(stamp.widthMm / portrait.aspectRatio).toBe(front.width);
    expect(stamp).toMatchObject({ xMm: front.x + front.width / 2, yMm: front.y + front.height / 2 });
  });

  it("その他の縦長スタンプは従来の向きと余白を保つ", () => {
    const portrait = { ...asset, id: "portrait", aspectRatio: 0.5 };
    const stamp = createStamp(portrait, geometry, "縦長スタンプ");

    expect(stamp.rotationDeg).toBe(0);
    expect(stamp.widthMm).toBeLessThan(geometry.panels[0].width);
  });

  it("背景付きと判定された縦長画像は蓋幅に合わせる", () => {
    const portrait = { ...asset, id: "future-cover", aspectRatio: 0.5 };
    const stamp = createStamp(portrait, geometry, "追加の表紙", "main", undefined, true);

    expect(stamp.rotationDeg).toBe(90);
    expect(stamp.widthMm / portrait.aspectRatio).toBe(geometry.panels[0].width);
  });

  it("スタンプを追加、更新、複製、並べ替え、表示切替、削除できる", () => {
    const first = createStamp({ ...asset, id: "stamp-1" }, geometry, "1つ目");
    const second = createStamp({ ...asset, id: "stamp-2" }, geometry, "2つ目");
    let state = appReducer(initialState, { type: "add-stamp", item: first });
    state = appReducer(state, { type: "add-stamp", item: second });
    state = appReducer(state, { type: "update-stamp", id: second.id, patch: { visible: false, opacity: 0.6, rotationDeg: 90 } });

    expect(state.stamps[1]).toMatchObject({ visible: false, opacity: 0.6, rotationDeg: 90 });

    state = appReducer(state, { type: "move-stamp", id: second.id, direction: "backward" });
    expect(state.stamps.map((item) => item.id)).toEqual([second.id, first.id]);

    state = appReducer(state, { type: "duplicate-stamp", id: first.id, newId: "stamp-copy" });
    expect(state.stamps.at(-1)).toMatchObject({ id: "stamp-copy", name: "1つ目 コピー" });

    state = appReducer(state, { type: "remove-stamp", id: second.id });
    expect(state.stamps.map((item) => item.id)).toEqual([first.id, "stamp-copy"]);
  });

  it("90度ずつ回転し、蛇腹は開いている1項目だけを状態に保持する", () => {
    expect(rotateQuarterTurn(0)).toBe(90);
    expect(rotateQuarterTurn(90)).toBe(180);
    expect(rotateQuarterTurn(180)).toBe(270);
    expect(rotateQuarterTurn(270)).toBe(0);

    const stampsOpen = appReducer(initialState, { type: "set-open-editor-section", section: "stamps" });
    const textOpen = appReducer(stampsOpen, { type: "set-open-editor-section", section: "text" });
    expect(stampsOpen.openEditorSection).toBe("stamps");
    expect(textOpen.openEditorSection).toBe("text");
  });

  it("蓋と本体の背景・柄を別々に保持する", () => {
    const lidDots = createDotPattern("lid-dots", 1, "lid");
    const baseStripe = createStripePattern("base-stripe", 1, "base");
    let state = appReducer(initialState, { type: "set-box-type", boxType: "two-piece-gift-box-v1" });
    state = appReducer(state, { type: "set-background-color", pageId: "lid", color: "#f6d96f" });
    state = appReducer(state, { type: "add-artwork", item: lidDots });
    state = appReducer(state, { type: "add-artwork", item: baseStripe });

    expect(state.activePageId).toBe("lid");
    expect(state.backgroundColors).toMatchObject({ lid: "#f6d96f", base: "#fffdf9" });
    expect(state.artworkLayers.filter((item) => item.pageId === "lid")).toEqual([lidDots]);
    expect(state.artworkLayers.filter((item) => item.pageId === "base")).toEqual([baseStripe]);

    state = appReducer(state, { type: "set-active-page", pageId: "base" });
    expect(state.activePageId).toBe("base");
    expect(state.selectedArtworkId).toBeNull();

    state = appReducer(state, { type: "update-box", field: "depthMm", value: 30 });
    expect(state.box.lidDepthMm).toBe(30);
  });

  it("蓋の背景だけを本体へコピーし、スタンプと文字は維持する", () => {
    const lidDots = { ...createDotPattern("lid-dots", 1, "lid"), offsetXmm: 12, offsetYmm: -4 };
    const oldBase = createStripePattern("old-base", 1, "base");
    let state = appReducer(initialState, { type: "set-box-type", boxType: "two-piece-gift-box-v1" });
    state = {
      ...state,
      backgroundColors: { ...state.backgroundColors, lid: "#f6d96f", base: "#ffffff" },
      artworkLayers: [lidDots, oldBase],
      stamps: [{ ...createStamp({ ...asset, id: "base-stamp" }, geometry, "本体スタンプ", "base") }],
      texts: [{ ...createTextItem("base-text", "base", "残す", 10, 10, "#333333"), fontSizeMm: 4 }],
    };

    state = appReducer(state, {
      type: "replace-page-background",
      sourcePageId: "lid",
      targetPageId: "base",
      items: [{ ...lidDots, id: "base-dots-copy", pageId: "base" }],
    });

    expect(state.backgroundColors.base).toBe("#f6d96f");
    expect(state.artworkLayers.filter((item) => item.pageId === "base")).toEqual([
      { ...lidDots, id: "base-dots-copy", pageId: "base" },
    ]);
    expect(state.stamps).toHaveLength(1);
    expect(state.texts).toHaveLength(1);

    state = appReducer(state, { type: "update-artwork", id: "base-dots-copy", patch: { offsetXmm: 99 } });
    expect(state.artworkLayers.find((item) => item.id === "lid-dots")?.offsetXmm).toBe(12);
    expect(state.artworkLayers.find((item) => item.id === "base-dots-copy")?.offsetXmm).toBe(99);
  });
});
